import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './App.css';

const HomePage = lazy(() => import('./pages/visitor/HomePage'));
const QAPage = lazy(() => import('./pages/visitor/QAPage'));
const RecommendPage = lazy(() => import('./pages/visitor/RecommendPage'));
const AdminLoginPage = lazy(() => import('./pages/admin/LoginPage'));
const KnowledgeBasePage = lazy(() => import('./pages/admin/KnowledgeBasePage'));

/** Redirect unauthenticated users to admin login. */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#c41d7f',
          borderRadius: 8,
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <BrowserRouter>
        <Suspense fallback={<div role="status" style={{ padding: 24 }}>正在打开页面…</div>}>
        <Routes>
          {/* Visitor */}
          <Route path="/" element={<HomePage />} />
          <Route path="/qa" element={<QAPage />} />
          <Route path="/recommend" element={<RecommendPage />} />

          {/* Knowledge maintenance — protected by auth guard */}
          <Route path="/admin" element={<Navigate to="/admin/knowledge" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/knowledge" element={<AdminGuard><KnowledgeBasePage /></AdminGuard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
