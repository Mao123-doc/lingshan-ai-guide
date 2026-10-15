import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography } from 'antd';
import { MessageOutlined, CompassOutlined, BookOutlined } from '@ant-design/icons';
import './HomePage.css';

const QUESTIONS = ['灵山大佛有多高？', '门票价格是多少？', '九龙灌浴表演时间？', '梵宫有什么好看的？'];

export default function HomePage() {
  const navigate = useNavigate();
  return <main className="home-page">
    <header className="core-home-header"><Typography.Text>灵山胜境 · 灵小禅</Typography.Text>
      <Button icon={<BookOutlined />} onClick={() => navigate('/admin/knowledge')}>知识库入口</Button></header>
    <section className="core-home-intro"><Typography.Title>可信问答，可行路线</Typography.Title>
      <Typography.Paragraph>查阅景区知识与回答依据，按时间和行动能力安排游览。</Typography.Paragraph></section>
    <section className="core-home-modules" aria-label="核心功能">
      <Card title={<><MessageOutlined /> 智能问答</>}><p>了解景点、演出和实用信息，查看知识出处。</p>
        <Button type="primary" aria-label="智能问答，点击进入" onClick={() => navigate('/qa')}>开始问答</Button></Card>
      <Card title={<><CompassOutlined /> 规划路线</>}><p>输入所在位置、游览时长和行动能力，查看安排与不可行原因。</p>
        <Button type="primary" aria-label="规划路线，点击进入" onClick={() => navigate('/recommend')}>规划路线</Button></Card>
    </section>
    <section className="core-home-questions"><Typography.Title level={2}>常见问题</Typography.Title>
      {QUESTIONS.map(question => <Button key={question} onClick={() => navigate(`/qa?q=${encodeURIComponent(question)}`)}>{question}</Button>)}
    </section>
  </main>;
}
