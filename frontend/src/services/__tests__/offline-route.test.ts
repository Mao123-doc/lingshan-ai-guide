import { describe, expect, it, vi } from 'vitest';
import { planOfflineRoute, createRouteGraphCache, restoreRouteGraphCache } from '../offline-route';
import { planRoute } from '../../../../backend/src/services/route/route-planner';
import { SceneStateSchema } from '../../../../backend/src/services/scene/scene-state';
import type { RouteGraph } from '../../../../backend/src/services/route/route-types';
const graph:RouteGraph={spots:[{id:'south_gate',name:'南门',lat:31,lng:120,visit_minutes:0,mobility:{wheelchair_accessible:true},opening_windows:['00:00-24:00'],source:'fixture',confidence:'estimated'},{id:'a',name:'景点A',lat:31.01,lng:120.01,visit_minutes:10,mobility:{wheelchair_accessible:true},opening_windows:['00:00-24:00'],source:'fixture',confidence:'estimated'}],edges:[{from:'south_gate',to:'a',walk_minutes:5,distance_m:300,accessible:true,source:'fixture',confidence:'estimated'}],performances:[],facilities:[]};
describe('same-source offline route solver',()=>{
  it('matches the server solver, reserves return and preserves estimated provenance',()=>{
    const input={currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:30,mobility:'normal' as const};
    const offline=planOfflineRoute(graph,input);
    const server=planRoute(SceneStateSchema.parse({...input,returnToExit:true,exitSpotId:'south_gate',interests:[],mustVisitSpotIds:[],visitedSpotIds:[],preferredPerformanceIds:[],preferredPerformanceTimes:{},missingCriticalFields:[]}),graph,12);
    expect(offline.route?.steps).toEqual(server.steps);
    expect(offline.route?.steps?.at(-1)?.spotId).toBe('south_gate');
    expect(offline.route?.distanceMeters).toBe(600);
    expect(offline.route?.steps?.[0].pathEvidence?.[0].confidence).toBe('estimated');
  });
  it('rejects an exhausted deadline and never uses cached performances',()=>{
    expect(()=>planOfflineRoute(graph,{remainingMinutes:-1})).toThrow();
    const result=planOfflineRoute(graph,{currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:15,preferredPerformanceIds:['cached-show']});
    expect(result.route?.steps?.some(step=>step.performanceId)).toBe(false);
    expect(result.feasibility).toBe(false);
  });
});

const digest=vi.fn(async(_algorithm:unknown,data:unknown)=>new Uint8Array(32).fill(Array.from(data as Uint8Array).reduce((sum,value)=>sum+value,0)%256).buffer);
const subtle={digest} as unknown as SubtleCrypto;
describe('offline graph cache corruption detection',()=>{
  it('validates graphs before solving, including references',()=>{
    expect(()=>planOfflineRoute({...graph,edges:[{...graph.edges[0],distance_m:-1}]},{currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:30})).toThrow(/路网/);
    expect(()=>planOfflineRoute({...graph,edges:[{...graph.edges[0],to:'missing'}]},{currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:30})).toThrow(/路网/);
  });
  it('recomputes SHA-256 and rejects a mismatching stored checksum',async()=>{
    const record=await createRouteGraphCache(graph,subtle);
    const restored=await restoreRouteGraphCache(record,subtle);
    expect(restored.graph).toEqual(graph);
    expect(digest.mock.calls.at(-1)?.[0]).toBe('SHA-256');
    expect((digest.mock.calls.at(-1)?.[1] as Uint8Array).byteLength).toBeGreaterThan(0);
    const tampered=structuredClone(record);tampered.graph.spots[0].name+='changed';
    await expect(restoreRouteGraphCache(tampered,subtle)).rejects.toThrow(/校验/);
    await expect(restoreRouteGraphCache({...record,sha256:'1'.repeat(64)},subtle)).rejects.toThrow(/校验/);
  });
  it('rejects invalid cached graphs even when checksum matches and refuses missing crypto',async()=>{
    const record=await createRouteGraphCache(graph,subtle);
    await expect(restoreRouteGraphCache({...record,graph:{...graph,edges:[{...graph.edges[0],to:'missing'}]}},subtle)).rejects.toThrow(/路网/);
    await expect(createRouteGraphCache(graph,null)).rejects.toThrow(/校验/);
    await expect(restoreRouteGraphCache(record,null)).rejects.toThrow(/校验/);
  });
});
