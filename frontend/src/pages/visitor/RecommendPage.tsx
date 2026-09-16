import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Card, Tag, Row, Col, Steps, Select, Space, Input, Alert } from 'antd';
import {
  HistoryOutlined, EnvironmentOutlined, HomeOutlined,
  HeartOutlined, BuildOutlined, StarOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { visitorAPI } from '../../services/api';
import { openBaiduNavigation } from '../../utils/navigation';
import { getRouteOutcomeLabel, getRouteRejectionMessage, type RouteOutcome } from './route-outcome';

const { Title, Paragraph, Text } = Typography;

// WGS84 坐标（与浏览器 GPS 同一坐标系），与 HomePage / 后端保持一致
const SPOT_COORDS: Record<string, { lat: number; lng: number }> = {
  '灵山大佛': { lat: 31.43205, lng: 120.09151 },
  '九龙灌浴': { lat: 31.42662, lng: 120.09523 },
  '灵山梵宫': { lat: 31.43065, lng: 120.09756 },
  '五印坛城': { lat: 31.42664, lng: 120.09813 },
  '祥符禅寺': { lat: 31.42986, lng: 120.09309 },
  '拈花湾': { lat: 31.42112, lng: 120.07161 },
  '灵山大照壁': { lat: 31.42250, lng: 120.09740 },
  '菩提大道': { lat: 31.42400, lng: 120.09670 },
  '百子戏弥勒': { lat: 31.42540, lng: 120.09760 },
  '曼飞龙塔': { lat: 31.42800, lng: 120.09900 },
  '无尽意斋': { lat: 31.43050, lng: 120.09180 },
  '佛足坛': { lat: 31.42330, lng: 120.09700 },
  '五智门': { lat: 31.42460, lng: 120.09630 },
  '降魔浮雕': { lat: 31.42500, lng: 120.09610 },
  '阿育王柱': { lat: 31.42530, lng: 120.09590 },
  '梵天花海': { lat: 31.41960, lng: 120.07620 },
  '香月花街': { lat: 31.41950, lng: 120.07080 },
  '五灯湖': { lat: 31.42000, lng: 120.07280 },
  '鹿鸣谷': { lat: 31.42430, lng: 120.07630 },
  '佛教文化博览馆': { lat: 31.43205, lng: 120.09151 },
  '拈花广场': { lat: 31.41780, lng: 120.06950 },
  '拈花堂': { lat: 31.42120, lng: 120.07220 },
  '五明桥': { lat: 31.42240, lng: 120.09740 },
};

// 景点实景照片映射（public 目录下的图片文件名）
const SPOT_IMAGES: Record<string, string> = {
  '灵山大佛': 'lingshan_dafo.jpg',
  '九龙灌浴': 'jiulong_guanyu.jpg',
  '灵山梵宫': 'lingshan_fangong.jpg',
  '五印坛城': 'wuyin_tancheng.jpg',
  '祥符禅寺': 'xiangfu_temple.jpg',
  '拈花湾': 'nianhua_wan.jpg',
  '灵山大照壁': 'lingshan_zhaobi.jpg',
  '菩提大道': 'puti_avenue.jpg',
  '百子戏弥勒': 'baiziximile.jpg',
  '曼飞龙塔': 'manfeilong_pagoda.jpg',
  '佛足坛': 'fozu_altar.jpg',
  '五智门': 'wuzhi_gate.jpg',
  '降魔浮雕': 'xiangmo_relief.jpg',
  '阿育王柱': 'ayuwang_pillar.jpg',
  '佛教文化博览馆': 'fojiao_museum.jpg',
  '拈花广场': 'nianhua_square.jpg',
  '梵天花海': 'fantian_huahai.jpg',
  '香月花街': 'xiangyue_street.jpg',
  '五灯湖': 'wuhu_lamp.jpg',
  '鹿鸣谷': 'luming_valley.jpg',
  '五明桥': 'wuming_bridge.jpg',
  '拈花堂': 'nianhua_hall.jpg',
};

const interests = [
  { key: '历史', icon: <HistoryOutlined />, label: '历史文化', desc: '千年佛教传承' },
  { key: '文化', icon: <StarOutlined />, label: '佛教文化', desc: '深度文化体验' },
  { key: '自然', icon: <EnvironmentOutlined />, label: '自然风光', desc: '太湖山水美景' },
  { key: '建筑', icon: <BuildOutlined />, label: '建筑艺术', desc: '佛教建筑杰作' },
  { key: '祈福', icon: <HeartOutlined />, label: '祈福体验', desc: '吉祥平安之旅' },
];

export default function RecommendPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(4);
  const [travelType, setTravelType] = useState('朋友');
  const [ageGroup, setAgeGroup] = useState('青年');
  const [budget, setBudget] = useState('舒适型');
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<any>(null);
  const [sceneQuery, setSceneQuery] = useState('我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？');
  const [sceneRoute, setSceneRoute] = useState<any>(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  const toggleInterest = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleRecommend = async () => {
    setRoute(null);
    setLoading(true);
    try {
      const payload = {
        interests: [...selected],
        duration,
        travelType,
        ageGroup,
        budget,
      };
      const res = await visitorAPI.recommend(payload);
      setRoute(res.data);
    } catch (err) {
      console.error('Recommend error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScenePlan = async () => {
    setSceneRoute(null);
    setSceneLoading(true);
    try {
      const res = await visitorAPI.planRoute(sceneQuery);
      setSceneRoute(res.data);
    } catch (err) {
      console.error('Scene route error:', err);
    } finally {
      setSceneLoading(false);
    }
  };

  const routeStepCount = sceneRoute?.route?.steps?.length ?? 0;
  const routeOutcome = (sceneRoute?.outcome ?? (sceneRoute?.feasibility ? 'feasible' : 'infeasible')) as RouteOutcome;
  const routeOutcomeLabel = getRouteOutcomeLabel(routeOutcome, routeStepCount);
  const routeIsExecutable = routeOutcome === 'feasible' && routeStepCount > 0;
  const routeHasAdjustedPreferences = routeOutcome === 'feasible_with_rejected_preferences' && routeStepCount > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #c41d7f 0%, #e91e63 100%)',
        padding: '20px',
        textAlign: 'center',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <Button type="text" icon={<HomeOutlined />} onClick={() => navigate('/')}
          style={{ color: '#fff', position: 'absolute', left: 16, top: 20 }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>🗺️ 个性化游览推荐</Title>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
        <Card
          title="🧭 场景约束路线规划"
          style={{ borderRadius: 16, marginBottom: 20, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          <Paragraph type="secondary">
            告诉导游你现在在哪里、还剩多久、同行人和必须看的演出；系统会先提取约束，再由确定性路线引擎检查是否可行。
          </Paragraph>
          <Input.TextArea
            value={sceneQuery}
            onChange={event => setSceneQuery(event.target.value)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="例如：我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？"
          />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button type="primary" onClick={handleScenePlan} loading={sceneLoading} disabled={!sceneQuery.trim()}>
              生成可执行路线
            </Button>
          </div>
        </Card>

        {sceneRoute && (
          <Card
            title={routeIsExecutable || routeHasAdjustedPreferences ? '✅ 场景路线结果' : '⚠️ 场景路线结果'}
            style={{ borderRadius: 16, marginBottom: 20, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <Space wrap>
              <Tag color={routeIsExecutable ? 'green' : routeHasAdjustedPreferences ? 'gold' : 'orange'}>
                {routeOutcomeLabel}
              </Tag>
              <Tag>总时长 {sceneRoute.route?.totalMinutes ?? 0} 分钟</Tag>
              <Tag>步行 {sceneRoute.route?.walkingMinutes ?? 0} 分钟</Tag>
              <Tag>游览 {sceneRoute.route?.visitingMinutes ?? 0} 分钟</Tag>
            </Space>
            {sceneRoute.scene_state?.missingCriticalFields?.length > 0 && (
              <Alert
                style={{ marginTop: 14 }}
                type="warning"
                message={`需要补充：${sceneRoute.scene_state.missingCriticalFields.join('、')}`}
              />
            )}
            {sceneRoute.route?.rejectedRequests?.length > 0 && (
              <Alert
                style={{ marginTop: 14 }}
                type="info"
                message="系统明确保留了未满足请求"
                description={sceneRoute.route.rejectedRequests.map((item: any) => `${item.item}：${getRouteRejectionMessage(item.reasonCode)}`).join('；')}
              />
            )}
            <Steps
              style={{ marginTop: 18 }}
              direction="vertical"
              items={(sceneRoute.route?.steps || []).map((item: any, index: number) => ({
                title: `${item.start}–${item.end} ${item.spotId}`,
                description: `到达 ${item.arrive}，步行 ${item.walkMinutes} 分钟，停留 ${item.visitMinutes} 分钟${item.performanceId ? `，演出 ${item.performanceStartTime}` : ''}`,
                icon: <Tag color="magenta">{index + 1}</Tag>,
              }))}
            />
            {sceneRoute.evidence?.length > 0 && (
              <Paragraph type="secondary" style={{ marginTop: 12 }}>
                证据来源：{sceneRoute.evidence.map((item: any) => `${item.name}（${item.confidence}）`).join('、')}
              </Paragraph>
            )}
          </Card>
        )}

        {/* Interest Selection */}
        <Card
          title="选择您的兴趣偏好"
          style={{ borderRadius: 16, marginBottom: 20, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          <Row gutter={[12, 12]}>
            {interests.map(item => (
              <Col xs={12} sm={8} md={8} lg={8} key={item.key}>
                <Card
                  hoverable
                  onClick={() => toggleInterest(item.key)}
                  style={{
                    borderRadius: 12,
                    textAlign: 'center',
                    border: selected.includes(item.key) ? '2px solid #c41d7f' : '1px solid #f0f0f0',
                    background: selected.includes(item.key) ? '#fdf2f8' : '#fff',
                    transition: 'all 0.3s',
                  }}
                >
                  <div style={{ fontSize: 28, color: '#c41d7f', marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{item.desc}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Space wrap size={12}>
              <Text>出行类型：</Text>
              <Select
                value={travelType}
                onChange={setTravelType}
                style={{ width: 110 }}
                options={[
                  { value: '朋友', label: '朋友' },
                  { value: '情侣', label: '情侣' },
                  { value: '亲子', label: '亲子' },
                  { value: '带长辈', label: '带长辈' },
                ]}
              />
              <Text>年龄段：</Text>
              <Select
                value={ageGroup}
                onChange={setAgeGroup}
                style={{ width: 110 }}
                options={[
                  { value: '青年', label: '青年' },
                  { value: '中年', label: '中年' },
                  { value: '老年', label: '老年' },
                ]}
              />
              <Text>预算类型：</Text>
              <Select
                value={budget}
                onChange={setBudget}
                style={{ width: 110 }}
                options={[
                  { value: '经济型', label: '经济型' },
                  { value: '舒适型', label: '舒适型' },
                  { value: '豪华型', label: '豪华型' },
                ]}
              />
            </Space>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Text>预计游览时长：</Text>
            {[3, 4, 5, 6].map(h => (
              <Tag
                key={h}
                color={duration === h ? 'magenta' : 'default'}
                style={{ cursor: 'pointer', margin: '0 4px', padding: '4px 16px', borderRadius: 16 }}
                onClick={() => setDuration(h)}
              >
                <ClockCircleOutlined /> {h} 小时
              </Tag>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              onClick={handleRecommend}
              loading={loading}
              disabled={selected.length === 0}
              style={{
                background: 'linear-gradient(135deg, #c41d7f, #e91e63)',
                border: 'none',
                height: 48,
                borderRadius: 24,
                paddingInline: 40,
              }}
            >
              生成推荐路线
            </Button>
          </div>
        </Card>

        {/* Route Result */}
        {route && (
          <Card
            title="✨ 推荐路线"
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            className="fade-in"
          >
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fdf2f8', borderRadius: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <Space size={6} wrap>
                  <Tag color="magenta" style={{ borderRadius: 12 }}>{travelType}</Tag>
                  <Tag color="purple" style={{ borderRadius: 12 }}>{ageGroup}</Tag>
                  <Tag color="gold" style={{ borderRadius: 12 }}>{budget}</Tag>
                  <Tag color="cyan" style={{ borderRadius: 12 }}>{duration}小时</Tag>
                  <Tag color="geekblue" style={{ borderRadius: 12 }}>{selected.join('、')}</Tag>
                </Space>
              </div>
              <Text strong>总游览时长：{route.total_duration} 分钟</Text>
              <br />
              <Text type="secondary">{route.tips}</Text>
            </div>

            <Row gutter={[16, 16]}>
              {/* 路线列表 */}
              <Col xs={24} lg={13}>
                <Steps
                  direction="vertical"
                  current={-1}
                  items={route.route.map((item: any, i: number) => ({
                    title: <Text strong>{item.name}</Text>,
                    description: (
                      <div>
                        <Paragraph type="secondary" style={{ marginBottom: 4 }}>{item.reason}</Paragraph>
                        <Tag color="magenta" style={{ borderRadius: 12 }}>⏱️ {item.visit_duration}分钟</Tag>
                        <Tag
                          color="blue"
                          style={{ borderRadius: 12, cursor: 'pointer' }}
                          onClick={() => navigate(`/qa?q=${encodeURIComponent(item.name)}`)}
                        >
                          💬 了解更多
                        </Tag>
                        {SPOT_COORDS[item.name] && (
                          <a
                            style={{ fontSize: 12, color: '#c41d7f', textDecoration: 'none', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const coords = SPOT_COORDS[item.name];
                              openBaiduNavigation(coords, item.name);
                            }}
                          >
                            🚗 到这里
                          </a>
                        )}
                      </div>
                    ),
                    icon: <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #c41d7f, #e91e63)',
                      color: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 12, fontWeight: 700,
                    }}>
                      {i + 1}
                    </div>,
                  }))}
                />
              </Col>

              {/* 竖向路线示意图（时间轴） */}
              <Col xs={24} lg={11}>
                <div style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 12,
                  padding: '16px 20px',
                }}>
                  {route.route.map((item: any, i: number) => {
                    const img = SPOT_IMAGES[item.name];
                    const isLast = i === route.route.length - 1;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 14 }}>
                        {/* 左侧序号 + 连接竖线 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #c41d7f, #e91e63)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}>
                            {i + 1}
                          </div>
                          {!isLast && (
                            <div style={{ width: 2, flex: 1, background: '#e0c7d8', margin: '4px 0' }} />
                          )}
                        </div>

                        {/* 右侧名称 + 缩略图 */}
                        <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.name}</div>
                          {img ? (
                            <img
                              src={`/${img}`}
                              alt={item.name}
                              style={{
                                width: '100%',
                                maxWidth: 240,
                                height: 120,
                                objectFit: 'cover',
                                borderRadius: 8,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '100%',
                              maxWidth: 240,
                              height: 60,
                              borderRadius: 8,
                              background: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#bbb',
                              fontSize: 12,
                            }}>
                              暂无图片
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Button
                type="primary"
                onClick={() => navigate('/qa')}
                style={{
                  background: 'linear-gradient(135deg, #c41d7f, #e91e63)',
                  border: 'none',
                  borderRadius: 20,
                }}
              >
                开始游览，了解更多景点详情
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
