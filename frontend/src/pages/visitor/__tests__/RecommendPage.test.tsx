import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecommendPage from '../RecommendPage';
import { visitorAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  visitorAPI: {
    recommend: vi.fn(),
    routeGraph: vi.fn(),
    planRoute: vi.fn(),
  },
}));

describe('RecommendPage critical states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(visitorAPI.routeGraph).mockResolvedValue({data:{spots:[],edges:[]}} as never);
  });

  it('shows an explicit route outcome returned by the scene planner', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'needs_clarification',
        route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
        scene_state: { missingCriticalFields: ['current_time'] },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/我带腿脚不方便的妈妈/);
    fireEvent.change(input, { target: { value: '我在景区入口，还剩三小时' } });
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('还需要一点信息')).toBeInTheDocument());
    expect(screen.getByText(/请告诉我现在几点/)).toBeInTheDocument();
  });

  it('shows visitor language instead of route engine details', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible_with_rejected_preferences',
        route: {
          steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }],
          totalMinutes: 60,
          walkingMinutes: 10,
          visitingMinutes: 50,
          rejectedRequests: [{ item: 'performance_lingshan_jixiangsong', reasonCode: 'performance_outside_time_budget' }],
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ spot_id: 'LS-011', name: '灵山大佛', confidence: 'high' }],
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    expect(screen.getByText(/按你的情况规划路线/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('已为你安排替代方案')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText(/灵山大佛/).length).toBeGreaterThan(0));
    expect(screen.getByText('有一项安排暂时无法加入路线')).toBeInTheDocument();
    expect(screen.getByText(/在剩余时间内赶不上这场演出/)).toBeInTheDocument();
    expect(screen.queryByText('LS-011')).not.toBeInTheDocument();
    expect(screen.queryByText(/证据来源/)).not.toBeInTheDocument();
  });

  it('explains arrival, waiting, and the exact performance time', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible',
        route: {
          steps: [{
            spotId: 'LS-013',
            start: '14:00',
            end: '14:20',
            arrive: '13:02',
            walkMinutes: 25,
            visitMinutes: 20,
            waitingMinutes: 58,
            performanceId: 'performance_lingshan_jixiangsong',
            performanceName: '《灵山吉祥颂》',
            performanceStartTime: '14:00',
          }],
          totalMinutes: 173,
          walkingMinutes: 45,
          visitingMinutes: 70,
          waitingMinutes: 58,
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ spot_id: 'LS-013', name: '灵山梵宫', confidence: 'verified' }],
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText(/观看《灵山吉祥颂》/)).toBeInTheDocument());
    expect(screen.getByText(/13:02 到达灵山梵宫/)).toBeInTheDocument();
    expect(screen.getByText('等待 58 分钟')).toBeInTheDocument();
    expect(screen.getByText(/13:02 到达灵山梵宫，步行 25 分钟，路网距离 0 米，等待 58 分钟后观看/)).toBeInTheDocument();
  });

  it('resubmits the original route request after the user supplies missing time', async () => {
    vi.mocked(visitorAPI.planRoute)
      .mockResolvedValueOnce({
        data: {
          outcome: 'needs_clarification',
          route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
          scene_state: { missingCriticalFields: ['currentTime'] },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          outcome: 'feasible',
          feasibility: true,
          route: { steps: [{ spotId: 'LS-011' }], totalMinutes: 120, walkingMinutes: 20, visitingMinutes: 100 },
          scene_state: { missingCriticalFields: [] },
        },
      } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    const supplement = await screen.findByPlaceholderText(/现在上午10点/);
    fireEvent.change(supplement, { target: { value: '现在上午10点' } });
    fireEvent.click(screen.getByRole('button', { name: '补充并重新规划' }));

    await waitFor(() => expect(visitorAPI.planRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: expect.stringContaining('现在上午10点') }),
    ));
  });

  it('renders a natural question instead of raw field names when current time is missing', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'needs_clarification',
        route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
        scene_state: { missingCriticalFields: ['currentTime'] },
        scene_extraction: {
          source: 'rules',
          confidence: {},
          missingFields: ['currentTime'],
          conflicts: [],
          trace: { configured: true, executed: true, status: 'success', fallbackUsed: false },
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('还需要一点信息')).toBeInTheDocument());
    expect(screen.getByText(/还需要知道您现在大约几点开始游览/)).toBeInTheDocument();
    expect(screen.queryByText('currentTime')).not.toBeInTheDocument();
    expect(screen.queryByText(/missingCriticalFields/i)).not.toBeInTheDocument();
  });

  it('renders visitor language and conceals internal trace terms when fallback is used', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible',
        feasibility: true,
        route: {
          steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }],
          totalMinutes: 60,
          walkingMinutes: 10,
          visitingMinutes: 50,
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ spot_id: 'LS-011', name: '灵山大佛', confidence: 'high' }],
        scene_extraction: {
          source: 'fallback',
          confidence: {},
          missingFields: [],
          conflicts: [],
          trace: {
            configured: true,
            executed: true,
            status: 'fallback',
            fallbackUsed: true,
            reason: 'llm_unavailable',
            model: 'qwen-plus-internal',
            latencyMs: 120,
          },
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('我先按您提供的信息安排路线。')).toBeInTheDocument());
    expect(screen.getAllByText(/灵山大佛/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/fallback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configured/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/executed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/llm_unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/qwen-plus-internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trace/i)).not.toBeInTheDocument();
  });

  it('preserves route rejection explanation when a preferred performance cannot be scheduled', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible_with_rejected_preferences',
        route: {
          steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }],
          totalMinutes: 60,
          walkingMinutes: 10,
          visitingMinutes: 50,
          rejectedRequests: [{ item: 'performance_lingshan_jixiangsong', reasonCode: 'performance_outside_time_budget' }],
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ spot_id: 'LS-011', name: '灵山大佛', confidence: 'high' }],
        scene_extraction: {
          source: 'llm',
          confidence: { partyType: 0.95 },
          missingFields: [],
          conflicts: [],
          trace: { configured: true, executed: true, status: 'success', fallbackUsed: false },
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('已为你安排替代方案')).toBeInTheDocument());
    expect(screen.getByText('有一项安排暂时无法加入路线')).toBeInTheDocument();
    expect(screen.getByText(/在剩余时间内赶不上这场演出/)).toBeInTheDocument();
    expect(screen.getByText(/你想看的演出/)).toBeInTheDocument();
  });

  it('submits the selection form as structured scene state through the unified planner', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible',
        route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
        scene_state: { missingCriticalFields: [] },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('佛教文化'));
    fireEvent.click(screen.getByRole('button', { name: '生成推荐路线' }));

    await waitFor(() => expect(visitorAPI.planRoute).toHaveBeenCalledWith(expect.objectContaining({
      scene_state: expect.objectContaining({
        currentLocation: 'south_gate',
        currentTime: '09:00',
        remainingMinutes: 240,
        mobility: 'normal',
        pace: 'normal',
        interests: ['文化'],
      }),
      advisory_profile: { ageGroup: '青年', budget: '舒适型' },
    })));
    expect(visitorAPI.recommend).not.toHaveBeenCalled();
  });

  it('renders auditable input effects without exposing planner internals', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible',
        route: { steps: [], totalMinutes: 60, walkingMinutes: 20, visitingMinutes: 40, waitingMinutes: 0 },
        scene_state: { missingCriticalFields: [] },
        explanation: {
          input_effects: [
            { field: 'budget', kind: 'advisory', applied: true, summary: '预算用于消费建议，不改变物理路线。' },
          ],
          route_rationale: ['文化兴趣参与评分。'],
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('预算用于消费建议，不改变物理路线。')).toBeInTheDocument());
    expect(screen.getByText('文化兴趣参与评分。')).toBeInTheDocument();
    expect(screen.queryByText(/Beam Search|trace/i)).not.toBeInTheDocument();
  });
  it('replans from progress with the original deadline and never submits negative time', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({data:{outcome:'feasible',scene_state:{currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:180,visitedSpotIds:[],missingCriticalFields:[]},route:{steps:[]}}} as never);
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'帮我规划路线'}));
    await screen.findByText('更新游览进度');
    expect(visitorAPI.planRoute).toHaveBeenCalledWith(expect.objectContaining({scene_state:{returnToExit:true,exitSpotId:'south_gate'}}));
    fireEvent.change(screen.getByLabelText('当前时间'),{target:{value:'10:00'}});
    fireEvent.click(screen.getByRole('button',{name:'按当前进度重新规划'}));
    await waitFor(()=>expect(visitorAPI.planRoute).toHaveBeenLastCalledWith(expect.objectContaining({scene_state:expect.objectContaining({currentTime:'10:00',remainingMinutes:120,returnToExit:true,visitedSpotIds:[]})})));
    await waitFor(()=>expect(screen.getByLabelText('当前时间')).toHaveValue('09:00'));
    fireEvent.change(screen.getByLabelText('当前时间'),{target:{value:'13:00'}});
    const count=vi.mocked(visitorAPI.planRoute).mock.calls.length;
    fireEvent.click(screen.getByRole('button',{name:'按当前进度重新规划'}));
    expect(visitorAPI.planRoute).toHaveBeenCalledTimes(count);
    expect(screen.getByText(/离园截止时间已到/)).toBeInTheDocument();
  });

  it('computes an offline emergency route without invoking the planning API', async () => {
    const spot=(id:string,name:string)=>({id,name,lat:31,lng:120,visit_minutes:id==='south_gate'?0:10,mobility:{wheelchair_accessible:true},opening_windows:['00:00-24:00'],source:'test-fixture',confidence:'estimated'});
    vi.mocked(visitorAPI.routeGraph).mockResolvedValue({data:{spots:[spot('south_gate','南门'),spot('a','离线景点')],edges:[{from:'south_gate',to:'a',walk_minutes:5,distance_m:300,accessible:true,source:'test-fixture',confidence:'estimated'}],performances:[],facilities:[]}} as never);
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    const button=screen.getByRole('button',{name:'离线应急规划'});
    await waitFor(()=>expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText(/离线应急规划结果/);
    expect(visitorAPI.planRoute).not.toHaveBeenCalled();
    expect(screen.getByText(/返回出口：南门/)).toBeInTheDocument();
    expect(screen.getAllByText(/含估算路段/).length).toBeGreaterThan(0);
    expect(screen.getByText(/SHA-256/)).toBeInTheDocument();
  });

  it('hydrates progress fields when opening a saved route', async () => {
    localStorage.setItem('saved-route-view-v1',JSON.stringify({outcome:'feasible',scene_state:{currentLocation:'LS-013',currentTime:'12:10',remainingMinutes:70,visitedSpotIds:['LS-003'],missingCriticalFields:[]},route:{steps:[]}}));
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'查看已保存路线'}));
    await waitFor(()=>expect(screen.getByLabelText('当前时间')).toHaveValue('12:10'));
    expect(screen.getByLabelText('离园截止时间')).toHaveValue('13:20');
    fireEvent.click(screen.getByRole('button',{name:'按当前进度重新规划'}));
    await waitFor(()=>expect(visitorAPI.planRoute).toHaveBeenCalledWith(expect.objectContaining({scene_state:expect.objectContaining({currentLocation:'LS-013',currentTime:'12:10',remainingMinutes:70,visitedSpotIds:['LS-003'],returnToExit:true})})));
  });

  it('rejects a corrupted graph cache and asks to reconnect',async()=>{
    const spot={id:'south_gate',name:'南门',lat:31,lng:120,visit_minutes:0,mobility:{wheelchair_accessible:true},opening_windows:['00:00-24:00'],source:'fixture',confidence:'estimated'};
    localStorage.setItem('route-graph-view-v2',JSON.stringify({version:2,savedAt:new Date().toISOString(),sha256:'0'.repeat(64),graph:{spots:[spot],edges:[],performances:[],facilities:[]}}));
    vi.mocked(visitorAPI.routeGraph).mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    await screen.findByText(/路网缓存校验失败/);
    expect(screen.getByRole('button',{name:'离线应急规划'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'帮我规划路线'})).toBeEnabled();
  });

  it('auto-corrects once only after confirmed progress exceeds ten minutes and keeps the future show',async()=>{
    const result={outcome:'feasible',scene_state:{currentLocation:'LS-011',currentTime:'09:00',remainingMinutes:300,visitedSpotIds:[],preferredPerformanceIds:['future-show'],preferredPerformanceTimes:{'future-show':'13:00'},missingCriticalFields:[]},route:{steps:[{spotId:'LS-011',arrive:'09:30',start:'09:30',end:'10:00',walkMinutes:30,visitMinutes:30}]},evidence:[{spot_id:'LS-011',name:'灵山大佛'}]};
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({data:result} as never);
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'帮我规划路线'}));
    await screen.findByText('更新游览进度');
    fireEvent.change(screen.getByLabelText('当前时间'),{target:{value:'10:11'}});
    fireEvent.click(screen.getByRole('button',{name:'确认当前位置游览完成'}));
    expect(visitorAPI.planRoute).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('switch',{name:'超时自动纠偏'}));
    fireEvent.change(screen.getByLabelText('当前时间'),{target:{value:'10:10'}});
    fireEvent.click(screen.getByRole('button',{name:'确认当前位置游览完成'}));
    expect(visitorAPI.planRoute).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('当前时间'),{target:{value:'10:11'}});
    fireEvent.click(screen.getByRole('button',{name:'确认当前位置游览完成'}));
    await waitFor(()=>expect(visitorAPI.planRoute).toHaveBeenCalledTimes(2));
    expect(visitorAPI.planRoute).toHaveBeenLastCalledWith(expect.objectContaining({scene_state:expect.objectContaining({currentTime:'10:11',remainingMinutes:229,visitedSpotIds:['LS-011'],preferredPerformanceIds:['future-show'],preferredPerformanceTimes:{'future-show':'13:00'},returnToExit:true})}));
    await screen.findByText('更新游览进度');
    fireEvent.change(screen.getByLabelText('当前时间'),{target:{value:'10:11'}});
    fireEvent.click(screen.getByRole('button',{name:'确认当前位置游览完成'}));
    expect(visitorAPI.planRoute).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite progress edited while a route response is pending',async()=>{
    let resolve:(value:unknown)=>void=()=>{};
    vi.mocked(visitorAPI.planRoute).mockReturnValue(new Promise(done=>{resolve=done;}) as never);
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'帮我规划路线'}));
    fireEvent.change(screen.getByLabelText('离线当前时间'),{target:{value:'10:35'}});
    resolve({data:{outcome:'feasible',scene_state:{currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:180,missingCriticalFields:[]},route:{steps:[]}}});
    await screen.findByText('更新游览进度');
    expect(screen.getByLabelText('当前时间')).toHaveValue('10:35');
  });

  it('ignores an old response after a saved route is explicitly selected',async()=>{
    let resolve:(value:unknown)=>void=()=>{};
    vi.mocked(visitorAPI.planRoute).mockReturnValue(new Promise(done=>{resolve=done;}) as never);
    localStorage.setItem('saved-route-view-v1',JSON.stringify({outcome:'feasible',scene_state:{currentLocation:'south_gate',currentTime:'12:00',remainingMinutes:60,missingCriticalFields:[]},route:{steps:[]}}));
    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'帮我规划路线'}));
    fireEvent.click(screen.getByRole('button',{name:'查看已保存路线'}));
    resolve({data:{outcome:'feasible',scene_state:{currentLocation:'south_gate',currentTime:'09:00',remainingMinutes:180,missingCriticalFields:[]},route:{steps:[]}}});
    await screen.findByText('更新游览进度');
    await waitFor(()=>expect(screen.getByLabelText('当前时间')).toHaveValue('12:00'));
  });

});
