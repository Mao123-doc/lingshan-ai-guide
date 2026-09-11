import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Card, Tag, Row, Col, Steps } from 'antd';
import {
  HistoryOutlined, EnvironmentOutlined, HomeOutlined,
  HeartOutlined, BuildOutlined, StarOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { visitorAPI } from '../../services/api';
import { openBaiduNavigation } from '../../utils/navigation';

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
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<any>(null);

  const toggleInterest = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleRecommend = async () => {
    setLoading(true);
    try {
      const res = await visitorAPI.recommend(selected, duration);
      setRoute(res.data);
    } catch (err) {
      console.error('Recommend error:', err);
    } finally {
      setLoading(false);
    }
  };

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

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
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
              <Text strong>总游览时长：{route.total_duration} 分钟</Text>
              <br />
              <Text type="secondary">{route.tips}</Text>
            </div>

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
