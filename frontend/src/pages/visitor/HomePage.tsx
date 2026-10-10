import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography } from 'antd';
import { CompassOutlined, MessageOutlined } from '@ant-design/icons';
import './HomePage.css';

const QUESTIONS = ['灵山大佛有多高？', '门票价格是多少？', '九龙灌浴表演时间？', '梵宫有什么好看的？'];

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <main className="home-page">
      <header className="home-header">
        <Typography.Text strong>灵小禅 · 灵山胜境</Typography.Text>
        <Button type="text" onClick={() => navigate('/admin/knowledge')}>知识库管理</Button>
      </header>
      <section className="home-intro">
        <Typography.Title>问清楚，再出发</Typography.Title>
        <Typography.Paragraph>了解景区事实，安排走得通的游览路线。</Typography.Paragraph>
      </section>
      <section className="home-actions" aria-label="核心功能">
        <Card>
          <MessageOutlined className="home-icon" />
          <Typography.Title level={2}>可信问答</Typography.Title>
          <Typography.Paragraph>询问票价、演出时间和景点文化，查看回答的知识来源。</Typography.Paragraph>
          <Button type="primary" size="large" onClick={() => navigate('/qa')}>开始提问</Button>
        </Card>
        <Card>
          <CompassOutlined className="home-icon" />
          <Typography.Title level={2}>路线规划</Typography.Title>
          <Typography.Paragraph>结合剩余时间、当前位置与行动能力安排行程；走不通时说明原因。</Typography.Paragraph>
          <Button size="large" onClick={() => navigate('/recommend')}>规划路线</Button>
        </Card>
      </section>
      <section className="home-questions" aria-label="常见问题">
        <Typography.Title level={3}>你可能想问</Typography.Title>
        <div>{QUESTIONS.map(question => <Button key={question} onClick={() => navigate(`/qa?q=${encodeURIComponent(question)}`)}>{question}</Button>)}</div>
      </section>
    </main>
  );
}
