import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Input, Row, Select, Space, Steps, Switch, Tag, Typography } from 'antd';
import { BuildOutlined, ClockCircleOutlined, EnvironmentOutlined, HeartOutlined, HistoryOutlined, HomeOutlined, StarOutlined } from '@ant-design/icons';
import { visitorAPI, type AdvisoryProfile, type RoutePlanResponse, type RoutePlanningRequest } from '../../services/api';
import type { RouteGraph } from '../../../../backend/src/services/route/route-types';
import { createRouteGraphCache, restoreRouteGraphCache, planOfflineRoute } from '../../services/offline-route';
import { openAmapNavigation, openBaiduNavigation } from '../../utils/navigation';
import { getClarificationPrompt, getRouteOutcomeLabel, getRouteRejectionMessage, getRouteRequestLabel, getSceneExtractionNote, type RouteOutcome } from './route-outcome';

const { Title, Paragraph, Text } = Typography;
const SPOT_COORDS: Record<string, { lat: number; lng: number }> = {
  '景区南门': { lat: 31.42190, lng: 120.09720 }, '灵山大照壁': { lat: 31.42250, lng: 120.09740 }, '五明桥': { lat: 31.42240, lng: 120.09740 }, '佛足坛': { lat: 31.42330, lng: 120.09700 }, '五智门': { lat: 31.42460, lng: 120.09630 }, '菩提大道': { lat: 31.42400, lng: 120.09670 }, '九龙灌浴': { lat: 31.42662, lng: 120.09523 }, '降魔浮雕': { lat: 31.42500, lng: 120.09610 }, '阿育王柱': { lat: 31.42530, lng: 120.09590 }, '百子戏弥勒': { lat: 31.42540, lng: 120.09760 }, '祥符禅寺': { lat: 31.42986, lng: 120.09309 }, '灵山大佛': { lat: 31.43205, lng: 120.09151 }, '佛教文化博览馆': { lat: 31.43205, lng: 120.09151 }, '灵山梵宫': { lat: 31.43065, lng: 120.09756 }, '五印坛城': { lat: 31.42664, lng: 120.09813 }, '曼飞龙塔': { lat: 31.42800, lng: 120.09900 }, '无尽意斋': { lat: 31.43050, lng: 120.09180 }, '拈花广场': { lat: 31.41780, lng: 120.06950 }, '梵天花海': { lat: 31.41960, lng: 120.07620 }, '香月花街': { lat: 31.41950, lng: 120.07080 }, '拈花堂': { lat: 31.42120, lng: 120.07220 }, '五灯湖': { lat: 31.42000, lng: 120.07280 }, '鹿鸣谷': { lat: 31.42430, lng: 120.07630 },
};
const SPOT_IMAGES: Record<string, string> = { '景区南门': 'shengjing_gate.jpg', '灵山大照壁': 'lingshan_zhaobi.jpg', '五明桥': 'wuming_bridge.jpg', '佛足坛': 'fozu_altar.jpg', '五智门': 'wuzhi_gate.jpg', '菩提大道': 'puti_avenue.jpg', '九龙灌浴': 'jiulong_guanyu.jpg', '降魔浮雕': 'xiangmo_relief.jpg', '阿育王柱': 'ayuwang_pillar.jpg', '百子戏弥勒': 'baiziximile.jpg', '祥符禅寺': 'xiangfu_temple.jpg', '灵山大佛': 'lingshan_dafo.jpg', '佛教文化博览馆': 'fojiao_museum.jpg', '灵山梵宫': 'lingshan_fangong.jpg', '五印坛城': 'wuyin_tancheng.jpg', '曼飞龙塔': 'manfeilong_pagoda.jpg', '无尽意斋': 'https://www.xiangfusi.com/UploadImages/image/201805251612383590.jpg', '拈花广场': 'nianhua_square.jpg', '梵天花海': 'fantian_huahai.jpg', '香月花街': 'xiangyue_street.jpg', '拈花堂': 'nianhua_hall.jpg', '五灯湖': 'wuhu_lamp.jpg', '鹿鸣谷': 'luming_valley.jpg' };
const interests = [
  { key: '历史', icon: <HistoryOutlined />, label: '历史文化', desc: '千年佛教传承' }, { key: '文化', icon: <StarOutlined />, label: '佛教文化', desc: '深度文化体验' }, { key: '自然', icon: <EnvironmentOutlined />, label: '自然风光', desc: '太湖山水美景' }, { key: '建筑', icon: <BuildOutlined />, label: '建筑艺术', desc: '佛教建筑杰作' }, { key: '祈福', icon: <HeartOutlined />, label: '祈福体验', desc: '吉祥平安之旅' },
];
const defaultQuery = '我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？';

export default function RecommendPage() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<RouteGraph | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{savedAt:string;sha256:string} | null>(null);
  const [offlineResult, setOfflineResult] = useState(false);
  const [offlineMobility, setOfflineMobility] = useState<'normal' | 'limited' | 'wheelchair'>('normal');
  const [cachedView, setCachedView] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [progressLocation, setProgressLocation] = useState('south_gate');
  const [progressTime, setProgressTime] = useState('09:00');
  const [deadlineTime, setDeadlineTime] = useState('13:00');
  const [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => {
    visitorAPI.routeGraph().then(async response => {
      // Online route planning remains usable even if cache verification is unavailable.
      setGraph(response.data);
      try {
        const record=await createRouteGraphCache(response.data);
        setGraph(record.graph);setCacheInfo({savedAt:record.savedAt,sha256:record.sha256});
        localStorage.setItem('route-graph-view-v2',JSON.stringify(record));
      } catch(error) {setCacheInfo(null);setRouteError(error instanceof Error ? error.message : '无法校验路网，请联网使用在线规划。');}
    }).catch(async () => {
      try {
        const saved=localStorage.getItem('route-graph-view-v2');
        if(saved) {const record=await restoreRouteGraphCache(JSON.parse(saved));setGraph(record.graph);setCacheInfo({savedAt:record.savedAt,sha256:record.sha256});setCachedView(true);}
      } catch(error) {setGraph(null);setCacheInfo(null);setRouteError(error instanceof Error ? error.message : '缓存损坏，请重新联网加载。');}
    });
  }, []);
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(4);
  const [travelType, setTravelType] = useState('朋友');
  const [ageGroup, setAgeGroup] = useState<AdvisoryProfile['ageGroup']>('青年');
  const [budget, setBudget] = useState<AdvisoryProfile['budget']>('舒适型');
  const currentLocation = 'south_gate';
  const currentTime = '09:00';
  const mobility = 'normal' as const;
  const pace = 'normal' as const;
  const [sceneQuery, setSceneQuery] = useState(defaultQuery);
  const [sceneRoute, setSceneRoute] = useState<RoutePlanResponse | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<'natural' | 'interest'>('natural');
  const [loading, setLoading] = useState(false);
  const [autoCorrect, setAutoCorrect] = useState(false);
  const [progressNotice, setProgressNotice] = useState('');
  const lastAutoProgress = useRef('');
  const requestSequence = useRef(0);
  const inFlight = useRef(false);
  const progressRevision = useRef(0);
  const updateLocation = (value:string) => {progressRevision.current+=1;setProgressLocation(value);};
  const updateTime = (value:string) => {progressRevision.current+=1;setProgressTime(value);};
  const updateDeadline = (value:string) => {progressRevision.current+=1;setDeadlineTime(value);};
  const updateCompleted = (value:string[]) => {progressRevision.current+=1;setCompleted(value);};
  const [clarificationInput, setClarificationInput] = useState('');

  const hydrateProgress = (result:RoutePlanResponse) => {
    const state=result.scene_state;
    if(state?.currentLocation) setProgressLocation(state.currentLocation);
    if(state?.currentTime) {setProgressTime(state.currentTime);const [h,m]=state.currentTime.split(':').map(Number);const end=h*60+m+(state.remainingMinutes || 0);setDeadlineTime(`${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`);}
    setCompleted(state?.visitedSpotIds || []);
    if(state?.mobility === 'normal' || state?.mobility === 'limited' || state?.mobility === 'wheelchair') setOfflineMobility(state.mobility);
  };
  const submitRoute = async (request:RoutePlanningRequest, origin:'natural'|'interest') => {
    const sequence=++requestSequence.current;
    const revision=progressRevision.current;
    inFlight.current=true;
    setOfflineResult(false);setCachedView(false);setRouteOrigin(origin);setRouteError('');setSceneRoute(null);setLoading(true);
    try {
      const result=(await visitorAPI.planRoute(request)).data;
      if(sequence!==requestSequence.current)return;
      setSceneRoute(result);
      if(revision===progressRevision.current)hydrateProgress(result);
      localStorage.setItem('saved-route-view-v1',JSON.stringify(result));
    } catch(error) {if(sequence===requestSequence.current)setRouteError(error instanceof Error?error.message:'路线服务暂时不可用，请稍后重试。');}
    finally {if(sequence===requestSequence.current){inFlight.current=false;setLoading(false);}}
  };
  const handleRecommend = () => submitRoute({ scene_state: { returnToExit: true, exitSpotId: 'south_gate', currentLocation, currentTime, remainingMinutes: duration * 60, partyType: travelType, mobility, pace, interests: [...selected], mustVisitSpotIds: [], preferredPerformanceIds: [], visitedSpotIds: [] }, advisory_profile: { ageGroup, budget } }, 'interest');
  const handleScenePlan = (query = sceneQuery) => { if (query.trim()) void submitRoute({ query, scene_state: { returnToExit: true, exitSpotId: 'south_gate' } }, 'natural'); };
  const handleClarification = () => { const extra = clarificationInput.trim(); if (!extra) return; const query = `${sceneQuery.trim()}，${extra}`; setSceneQuery(query); setClarificationInput(''); handleScenePlan(query); };
  const toggleInterest = (key: string) => setSelected(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);

  const steps = sceneRoute?.route?.steps ?? [];
  const names = steps.map(step => sceneRoute?.evidence?.find(evidence => evidence.spot_id === step.spotId)?.name || step.spotId);
  const outcome = (sceneRoute?.outcome ?? (sceneRoute?.feasibility ? 'feasible' : 'infeasible')) as RouteOutcome;
  const adjusted = outcome === 'feasible_with_rejected_preferences' && steps.length > 0;
  const feasible = outcome === 'feasible' && steps.length > 0;
  const missing = Array.from(new Set([...(sceneRoute?.scene_state?.missingCriticalFields ?? []), ...(sceneRoute?.scene_extraction?.missingFields ?? [])]));
  const clarificationPrompts = missing.map(getClarificationPrompt).filter(prompt => prompt !== '请补充相关游览信息。');
  const clarification = sceneRoute?.clarification || sceneRoute?.explanation?.clarification || (clarificationPrompts.length ? [...new Set(clarificationPrompts)].join(' ') : undefined);
  const rejected = sceneRoute?.route?.rejectedRequests ?? sceneRoute?.explanation?.rejected_requests ?? [];
  const inputEffects = sceneRoute?.explanation?.input_effects?.filter(effect => effect.applied) ?? [];

  const replan = (visited=completed) => {
    if(inFlight.current)return;
    const minutes = (value:string) => { const [h,m] = value.split(':').map(Number); return h*60+m; };
    const remainingMinutes = minutes(deadlineTime)-minutes(progressTime);
    if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) { setRouteError('离园截止时间已到，请直接前往出口；无法生成负数或零时间预算。'); return; }
    void submitRoute({ scene_state: { ...sceneRoute?.scene_state, currentLocation:progressLocation, currentTime:progressTime, remainingMinutes, visitedSpotIds:visited, returnToExit:true, exitSpotId:'south_gate', preferredPerformanceIds:(sceneRoute?.scene_state?.preferredPerformanceIds || []).filter(id=>!steps.some(step=>step.performanceId===id && visited.includes(step.spotId) && minutes(step.end)<=minutes(progressTime))), preferredPerformanceTimes:sceneRoute?.scene_state?.preferredPerformanceTimes } }, routeOrigin);
  };
  const confirmProgress = () => {
    if(inFlight.current)return;
    const visited=[...new Set([...completed,progressLocation])];
    updateCompleted(visited);
    const step=steps.find(item=>item.spotId===progressLocation && item.reasonCode!=='return_to_exit');
    const mins=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
    if(!step || !Number.isFinite(mins(progressTime)) || !Number.isFinite(mins(step.end))) {setProgressNotice('已记录进度；当前位置没有可比对的计划结束时间，可手动按更新进度重算。');return;}
    const delay=mins(progressTime)-mins(step.end);
    setProgressNotice(`当前位置游览完成时间比计划${delay>0 ? '晚' : '提前'}${Math.abs(delay)}分钟；${autoCorrect ? '超过10分钟将按更新进度重算。' : '自动纠偏未开启。'}`);
    const key=`${progressLocation}|${progressTime}|${deadlineTime}`;
    if(autoCorrect && delay>10 && lastAutoProgress.current!==key) {lastAutoProgress.current=key;replan(visited);}
  };
  const offlinePlan = () => {
    if (!graph || !cacheInfo || !globalThis.crypto?.subtle) {setRouteError('暂无经过完整校验的缓存路网，请重新联网加载；在线规划仍可使用。');return;}
    try {
      const mins=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
      const remainingMinutes=mins(deadlineTime)-mins(progressTime);
      if (!Number.isFinite(remainingMinutes) || remainingMinutes<=0) throw new Error('离园截止时间已到，请直接前往出口；无法生成负数或零时间预算。');
      const result=planOfflineRoute(graph,{currentLocation:progressLocation,currentTime:progressTime,remainingMinutes,mobility:offlineMobility,pace,partyType:travelType,interests:selected,visitedSpotIds:completed});
      requestSequence.current+=1;inFlight.current=false;setLoading(false);setSceneRoute(result);setOfflineResult(true);setCachedView(true);setRouteError('');
      localStorage.setItem('saved-route-view-v1',JSON.stringify(result));
    } catch(error) {setRouteError(error instanceof Error ? error.message : '缓存数据无法用于规划，请联网更新。');}
  };
  const mapSpots = graph?.spots || [];
  const pathIds = steps.flatMap(step => step.pathSpotIds || [step.spotId]);
  const points = pathIds.map(id => mapSpots.find(spot => spot.id === id)).filter((spot): spot is NonNullable<typeof spot> => Boolean(spot));
  const minLat = Math.min(...points.map(p=>p.lat)), maxLat = Math.max(...points.map(p=>p.lat));
  const minLng = Math.min(...points.map(p=>p.lng)), maxLng = Math.max(...points.map(p=>p.lng));
  const xy = (p:{lat:number;lng:number}) => `${20+(p.lng-minLng)/(maxLng-minLng || 1)*460},${260-(p.lat-minLat)/(maxLat-minLat || 1)*240}`;
  return <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
    <div style={{ background: 'linear-gradient(135deg, #c41d7f 0%, #e91e63 100%)', padding: 20, textAlign: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}><Button type="text" icon={<HomeOutlined />} onClick={() => navigate('/')} style={{ color: '#fff', position: 'absolute', left: 16, top: 20 }} /><Title level={3} style={{ color: '#fff', margin: 0 }}>🗺️ 个性化游览推荐</Title></div>
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
      {routeError && <Alert type="error" message={routeError} closable onClose={() => setRouteError('')} style={{marginBottom:16}} />}
      <Button onClick={() => { try { const saved=localStorage.getItem('saved-route-view-v1'); if(saved) {const restored=JSON.parse(saved);requestSequence.current+=1;inFlight.current=false;setLoading(false);setSceneRoute(restored);hydrateProgress(restored);setCachedView(true);setOfflineResult(false);} else setRouteError('暂无已保存路线。'); } catch {setRouteError('保存的路线无法读取。');} }}>查看已保存路线</Button>
      {cachedView && <Alert type="info" message="正在使用缓存资料，开放时间、无障碍条件与路况可能过期；离线应急规划不安排演出，在线规划需要连接服务。" />}
      <Card size="small" title="离线应急路线" style={{marginBlock:12}}><Space wrap><Select aria-label="离线规划起点" style={{width:160}} value={progressLocation} onChange={updateLocation} options={(graph?.spots || []).map(p=>({value:p.id,label:p.name}))} /><Input aria-label="离线当前时间" type="time" value={progressTime} onChange={e=>updateTime(e.target.value)} style={{width:120}} /><Input aria-label="离线离园截止" type="time" value={deadlineTime} onChange={e=>updateDeadline(e.target.value)} style={{width:120}} /><Select aria-label="离线行动能力" value={offlineMobility} onChange={setOfflineMobility} style={{width:130}} options={[{value:'normal',label:'行动正常'},{value:'limited',label:'行动不便'},{value:'wheelchair',label:'轮椅'}]} /><Button onClick={offlinePlan} disabled={!graph || !cacheInfo}>离线应急规划</Button></Space><Paragraph type="secondary">当前起点、当前时间与离园截止由你确认；使用缓存路网计算并预留返回南门，不安排演出和接驳。距离、道路可达性及开放时间可能过期，估算路段仍标记为估算。</Paragraph>{cacheInfo && <Paragraph type="secondary" style={{wordBreak:'break-all'}}>路网缓存 v2；保存于 {cacheInfo.savedAt}；SHA-256：{cacheInfo.sha256}（无签名校验和仅检查损坏，不作为来源认证）</Paragraph>}{offlineResult && <Alert type="warning" message="离线应急规划结果：使用缓存数据，未核验实时开放或道路条件。" />}</Card>
      <Card title="🧭 按你的情况规划路线" style={{ borderRadius: 16, marginBottom: 20, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}><Paragraph type="secondary">告诉我你现在在哪里、还剩多久、和谁一起，我会先确认时间是否来得及，再为你安排路线。</Paragraph><Input.TextArea value={sceneQuery} onChange={event => setSceneQuery(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} placeholder={defaultQuery} /><div style={{ textAlign: 'center', marginTop: 16 }}><Button type="primary" onClick={() => handleScenePlan()} loading={loading} disabled={!sceneQuery.trim()}>帮我规划路线</Button></div></Card>

      <Card title="选择您的兴趣偏好" style={{ order: 3, borderRadius: 16, marginBottom: 20, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}><Row gutter={[12, 12]}>{interests.map(item => <Col xs={12} sm={8} md={8} lg={8} key={item.key}><Card hoverable onClick={() => toggleInterest(item.key)} style={{ borderRadius: 12, textAlign: 'center', border: selected.includes(item.key) ? '2px solid #c41d7f' : '1px solid #f0f0f0', background: selected.includes(item.key) ? '#fdf2f8' : '#fff' }}><div style={{ fontSize: 28, color: '#c41d7f', marginBottom: 8 }}>{item.icon}</div><div style={{ fontWeight: 600 }}>{item.label}</div><div style={{ fontSize: 12, color: '#999' }}>{item.desc}</div></Card></Col>)}</Row><div style={{ marginTop: 20, textAlign: 'center' }}><Space wrap size={12}><Text>出行类型：</Text><Select value={travelType} onChange={setTravelType} style={{ width: 110 }} options={['朋友', '情侣', '亲子', '带长辈'].map(value => ({ value, label: value }))} /><Text>年龄段：</Text><Select value={ageGroup} onChange={setAgeGroup} style={{ width: 110 }} options={['青年', '中年', '老年'].map(value => ({ value, label: value }))} /><Text>预算类型：</Text><Select value={budget} onChange={setBudget} style={{ width: 110 }} options={['经济型', '舒适型', '豪华型'].map(value => ({ value, label: value }))} /></Space></div><div style={{ marginTop: 20, textAlign: 'center' }}><Text>预计游览时长：</Text>{[3, 4, 5, 6].map(hours => <Tag key={hours} color={duration === hours ? 'magenta' : 'default'} style={{ cursor: 'pointer', margin: '0 4px', padding: '4px 16px', borderRadius: 16 }} onClick={() => setDuration(hours)}><ClockCircleOutlined /> {hours} 小时</Tag>)}</div><div style={{ marginTop: 18, textAlign: 'center', color: '#888', fontSize: 13 }}>位置、时间、行动能力和节奏会参与路线计算；年龄与预算只影响个性化提示。</div><div style={{ textAlign: 'center', marginTop: 24 }}><Button type="primary" size="large" onClick={() => handleRecommend()} loading={loading} disabled={selected.length === 0} style={{ background: 'linear-gradient(135deg, #c41d7f, #e91e63)', border: 'none', height: 48, borderRadius: 24, paddingInline: 40 }}>生成推荐路线</Button></div></Card>

      {sceneRoute && <Card title={feasible || adjusted ? '✨ 推荐路线' : '⚠️ 路线安排提示'} style={{ order: routeOrigin === 'interest' ? 4 : 2, borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }} className="fade-in"><div style={{ marginBottom: 16, padding: '12px 16px', background: '#fdf2f8', borderRadius: 12 }}><Space size={6} wrap><Tag color={feasible ? 'green' : adjusted ? 'gold' : 'orange'} style={{ borderRadius: 12 }}>{getRouteOutcomeLabel(outcome, steps.length)}</Tag><Tag color="cyan" style={{ borderRadius: 12 }}>总游览时长：{sceneRoute.route?.totalMinutes ?? 0} 分钟</Tag><Tag>步行 {sceneRoute.route?.walkingMinutes ?? 0} 分钟</Tag><Tag>游览 {sceneRoute.route?.visitingMinutes ?? 0} 分钟</Tag>{(sceneRoute.route?.waitingMinutes ?? 0) > 0 && <Tag>等待 {sceneRoute.route?.waitingMinutes ?? 0} 分钟</Tag>}</Space>{getSceneExtractionNote(sceneRoute.scene_extraction) && <Alert style={{ marginTop: 12 }} type="info" message={getSceneExtractionNote(sceneRoute.scene_extraction)} />}{inputEffects.length > 0 && <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>{inputEffects.map(effect => effect.summary).join('；')}</Text>}{sceneRoute.explanation?.route_rationale?.length ? <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{sceneRoute.explanation.route_rationale.join('；')}</Text> : null}{sceneRoute.explanation?.consumer_advice?.length ? <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{sceneRoute.explanation.consumer_advice.join('；')}</Text> : null}</div>{clarification && <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={10}><Alert type="warning" message="还需要补充一点信息" description={clarification} /><Space.Compact block><Input aria-label="路线补充信息" value={clarificationInput} onChange={event => setClarificationInput(event.target.value)} onPressEnter={handleClarification} placeholder="例如：现在上午10点" /><Button type="primary" onClick={handleClarification} disabled={!clarificationInput.trim()} loading={loading}>补充并重新规划</Button></Space.Compact></Space>}{rejected.length > 0 && <Alert style={{ marginBottom: 16 }} type="info" message="有一项安排暂时无法加入路线" description={rejected.map(item => `${getRouteRequestLabel(item.item)}：${getRouteRejectionMessage(item.reasonCode)}`).join('；')} />}
        <Card size="small" title="更新游览进度" style={{marginBottom:16}}><Space wrap><Text>当前位置</Text><Select aria-label="更新当前位置" style={{width:160}} value={progressLocation} onChange={updateLocation} options={mapSpots.map(p=>({value:p.id,label:p.name}))} /><Text>当前时间</Text><Input aria-label="当前时间" type="time" value={progressTime} onChange={e=>updateTime(e.target.value)} style={{width:120}} /><Text>离园截止</Text><Input aria-label="离园截止时间" type="time" value={deadlineTime} onChange={e=>updateDeadline(e.target.value)} style={{width:120}} /><Select mode="multiple" aria-label="已游览景点" placeholder="已游览景点" style={{minWidth:180}} value={completed} onChange={updateCompleted} options={mapSpots.filter(p=>p.id!=='south_gate').map(p=>({value:p.id,label:p.name}))} /><Switch aria-label="超时自动纠偏" checked={autoCorrect} onChange={setAutoCorrect} /><Text>超时自动纠偏</Text><Button disabled={loading} onClick={confirmProgress}>确认当前位置游览完成</Button><Button loading={loading} onClick={()=>replan()}>按当前进度重新规划</Button></Space><Paragraph type="secondary">确认当前位置游览完成后，按你填写的时间与该站计划结束时间比较；开启自动纠偏且晚于计划超过10分钟时，自动按更新进度重算。保留返程及未完成的演出偏好，不采集被动GPS或猜测实际时间。</Paragraph>{progressNotice && <Alert type="info" message={progressNotice} />}</Card>
        {points.length > 1 && <figure><svg viewBox="0 0 500 280" role="img" aria-label="按登记坐标绘制的路线示意图" style={{width:'100%',maxHeight:280,background:'#f3f8f5'}}><polyline points={points.map(xy).join(' ')} fill="none" stroke="#c41d7f" strokeWidth="3" />{points.map((p,i)=><circle key={`${p.id}-${i}`} cx={xy(p).split(',')[0]} cy={xy(p).split(',')[1]} r="4" fill="#167858"><title>{p.name}</title></circle>)}</svg><figcaption>登记坐标路线示意；连线表示路网节点顺序，不代表实测道路形状。已含返回出口路段。</figcaption></figure>}
        <Row gutter={[16, 16]}><Col xs={24} lg={13}><Steps direction="vertical" current={-1} items={steps.map((item, index) => { const name = names[index] || '下一站'; const coords = mapSpots.find(spot => spot.id === item.spotId) || SPOT_COORDS[name]; return { title: <Text strong>{item.performanceId ? `${item.start}–${item.end} 观看${item.performanceName || '目标演出'}` : `${item.start}–${item.end} ${item.reasonCode === 'return_to_exit' ? '返回出口：' : ''}${name}`}</Text>, description: <div><Paragraph type="secondary" style={{ marginBottom: 4 }}>{item.arrive} 到达{name}，步行 {item.walkMinutes} 分钟，路网距离 {item.distanceMeters ?? 0} 米{item.waitingMinutes ? `，等待 ${item.waitingMinutes} 分钟后观看` : `，停留 ${item.visitMinutes} 分钟`}</Paragraph>{item.pathEvidence?.length ? <details><summary>查看沿途路段依据</summary>{item.pathEvidence.map((edge,i)=><div key={i}>{edge.from} → {edge.to}：{edge.distance_m}米，{edge.walk_minutes}分钟；{edge.accessible ? '登记为可无障碍通行' : '未登记为无障碍通行'}；{edge.confidence === 'estimated' ? '估算，待现场核验' : '已核验'}；来源：{edge.source}</div>)}</details> : null}<Text type="secondary">{item.pathEvidence?.some(edge=>edge.confidence === 'estimated') ? '含估算路段，待现场核验' : '距离与可达性依据登记路网'}；未提供实测坡度或接驳班次。</Text><Tag color="magenta" style={{ borderRadius: 12 }}>⏱️ {item.visitMinutes}分钟</Tag>{coords && <Space wrap><Button type="link" onClick={() => openAmapNavigation(coords, name)}>高德步行导航</Button><Button type="link" onClick={() => openBaiduNavigation(coords, name)}>百度步行导航</Button></Space>}</div>, icon: <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #c41d7f, #e91e63)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{index + 1}</div> }; })} /></Col><Col xs={24} lg={11}><div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 12, padding: '16px 20px' }}>{names.map((name, index) => <div key={`${name}-${index}`} style={{ display: 'flex', gap: 14 }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #c41d7f, #e91e63)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{index + 1}</div>{index < names.length - 1 && <div style={{ width: 2, flex: 1, background: '#e0c7d8', margin: '4px 0' }} />}</div><div style={{ paddingBottom: index < names.length - 1 ? 20 : 0, flex: 1 }}><div style={{ fontWeight: 600, marginBottom: 6 }}>{name}</div>{SPOT_IMAGES[name] ? <img src={SPOT_IMAGES[name].startsWith('http') ? SPOT_IMAGES[name] : `/${SPOT_IMAGES[name]}`} alt={name} style={{ width: '100%', maxWidth: 240, height: 120, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ color: '#bbb', fontSize: 12 }}>暂无图片</div>}</div></div>)}</div></Col></Row><div style={{ textAlign: 'center', marginTop: 20 }}><Button type="primary" onClick={() => navigate('/qa')} style={{ background: 'linear-gradient(135deg, #c41d7f, #e91e63)', border: 'none', borderRadius: 20 }}>开始游览，了解更多景点详情</Button></div></Card>}
    </div>
  </div>;
}
