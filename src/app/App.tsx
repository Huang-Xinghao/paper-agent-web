import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Result, Spin, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  ArrowUpOutlined,
  BookOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { Projects } from '../features/projects/Projects';
import { Workbench } from '../features/workbench/Workbench';
export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 30000 });
  const location = useLocation();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <FileTextOutlined />
          </span>
          <div>
            Paper Agent<small>RESEARCH WORKSPACE</small>
          </div>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">研</span>
          <div>
            我的研究空间<small>本地工作台</small>
          </div>
          <span className="version">v0.1</span>
        </div>
        <div className="nav-caption">工作空间</div>
        <Link className={`nav-item ${location.pathname !== '/settings' ? 'selected' : ''}`} to="/">
          <ApartmentOutlined />
          研究项目<span className="nav-arrow">↗</span>
        </Link>
        <Tooltip title="实验和论文位于各项目工作台内" placement="right">
          <div className="nav-hint">
            <ExperimentOutlined />
            实验与产物<small>项目内查看</small>
          </div>
        </Tooltip>
        <div className="sidebar-note">
          <BookOutlined />
          <p>让研究，循证向前。</p>
          <span>
            从一个问题，到一篇论文。
            <br />
            每个阶段都有据可查。
          </span>
        </div>
        <Link
          className={`nav-item settings-link ${location.pathname === '/settings' ? 'selected' : ''}`}
          to="/settings"
        >
          <SettingOutlined />
          工作台设置
        </Link>
        <div className="sidebar-footer">
          <span className={`connection-dot ${health.isSuccess ? 'online' : ''}`} />
          {health.isSuccess ? '已连接研究引擎' : '研究引擎未连接'}
          <ArrowUpOutlined rotate={45} />
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <span>
            WORKSPACE <span className="topbar-separator">/</span>{' '}
            {location.pathname === '/settings' ? '设置' : '研究项目'}
          </span>
          <div>
            <span className="local-chip">LOCAL</span>
            <span className="user-avatar">研</span>
          </div>
        </header>
        {health.isError && (
          <Alert
            className="connection-alert"
            type="error"
            showIcon
            message="无法连接后端服务"
            description="研究服务暂时不可用，请稍后重试。"
            action={<Button onClick={() => health.refetch()}>重试</Button>}
          />
        )}
        <Routes>
          <Route path="/" element={<Projects />} />
          <Route path="/projects/:id" element={<Workbench nodes={health.data?.nodes || []} />} />
          <Route
            path="/settings"
            element={
              <div className="page">
                <div className="eyebrow">PREFERENCES</div>
                <h1>工作台设置</h1>
                <p className="page-description">运行环境与服务连接</p>
                {health.isPending ? (
                  <Spin />
                ) : health.data ? (
                  <div className="settings-card">
                    <h3>研究引擎</h3>
                    <dl>
                      <dt>运行解释器</dt>
                      <dd>
                        <code>{health.data.runtime}</code>
                      </dd>
                      <dt>项目根目录</dt>
                      <dd>
                        {health.data.project_roots.map((p) => (
                          <div key={p}>
                            <code>{p}</code>
                          </div>
                        ))}
                      </dd>
                      <dt>并发策略</dt>
                      <dd>
                        同时运行 {health.data.concurrency} 个项目；项目内实验按现有队列策略调度。
                      </dd>
                      <dt>接口文档</dt>
                      <dd>
                        <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                          查看 OpenAPI 文档 ↗
                        </a>
                      </dd>
                    </dl>
                    <Alert
                      type="info"
                      showIcon
                      message="模型密钥保存在后端环境配置中。项目计算策略仍由 project-config.json 管理。"
                    />
                  </div>
                ) : null}
              </div>
            }
          />
          <Route
            path="*"
            element={
              <Result status="404" title="页面不存在" extra={<Link to="/">返回研究项目</Link>} />
            }
          />
          <Route path="/projects" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
