import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  List,
  Progress,
  Select,
  Skeleton,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  FileOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { active, api, statusLabels } from '../../api/client';
import type { NodeInfo, RunInput } from '../../api/client';
import { Status } from '../../components/Status';
import { formatDate } from '../../lib/date';
import { Artifact } from './Artifact';
import { RunDialog } from './RunDialog';
const reports: Record<string, string> = {
  literature: 'literature/RESEARCH_REPORT.md',
  data_search: 'data-search/DATA_REPORT.md',
  ideas: 'idea-stage/IDEA_REPORT.md',
  refine: 'refine-logs/FINAL_PROPOSAL.md',
  experiment_plan: 'refine-logs/EXPERIMENT_PLAN.md',
  experiment_bridge: 'refine-logs/EXPERIMENT_TRACKER.md',
  paper_plan: 'PAPER_PLAN.md',
  paper_figure: 'figures/figure_plan.md',
  paper_compile: 'paper/main.pdf',
  improvement: 'paper/main.pdf',
  paper_write: 'paper/main.tex',
};
export function Workbench({ nodes }: { nodes: NodeInfo[] }) {
  const { id = '' } = useParams();
  const { message, modal } = App.useApp();
  const client = useQueryClient();
  const project = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.project(id),
    refetchInterval: 4000,
  });
  const files = useQuery({
    queryKey: ['files', id],
    queryFn: () => api.files(id),
    refetchInterval: 10000,
  });
  const logs = useQuery({
    queryKey: ['log', id],
    queryFn: () => api.log(id),
    refetchInterval: project.data && active(project.data.status) ? 2000 : 10000,
  });
  const [selectedNode, setSelectedNode] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [runOpen, setRunOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [tab, setTab] = useState('report');
  const [streamState, setStreamState] = useState('connecting');
  const dirtyRef = useRef(false);
  function selectFile(path: string) {
    const select = () => {
      dirtyRef.current = false;
      setSelectedFile(path);
    };
    if (dirtyRef.current) modal.confirm({ title: '放弃未保存的修改？', onOk: select });
    else select();
  }
  useEffect(() => {
    const events = new EventSource(`/api/projects/${id}/events`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    events.onopen = () => setStreamState('connected');
    events.onerror = () => setStreamState('reconnecting');
    events.onmessage = () => {
      // Coalesce replay bursts into a single refresh.
      if (timer) return;
      timer = setTimeout(() => {
        client.invalidateQueries({ queryKey: ['project', id] });
        client.invalidateQueries({ queryKey: ['files', id] });
        client.invalidateQueries({ queryKey: ['log', id] });
        timer = undefined;
      }, 500);
    };
    return () => {
      events.close();
      if (timer) clearTimeout(timer);
    };
  }, [id, client]);
  useEffect(() => {
    setSelectedNode('');
    setSelectedFile('');
    setAnswer('');
  }, [id]);
  const run = useMutation({
    mutationFn: (values: RunInput) => api.run(id, values),
    onSuccess: () => {
      setRunOpen(false);
      setAnswer('');
      client.invalidateQueries({ queryKey: ['project', id] });
      client.invalidateQueries({ queryKey: ['projects'] });
      message.success('运行请求已提交');
    },
    onError: (e: Error) => {
      message.error(e.message);
      client.invalidateQueries({ queryKey: ['project', id] });
    },
  });
  const stop = useMutation({
    mutationFn: () => api.stop(id),
    onSuccess: () => {
      message.success('已请求停止，正在保存执行状态');
      client.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: (e: Error) => message.error(e.message),
  });
  if (project.isPending)
    return (
      <div className="page">
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  if (project.isError || !project.data)
    return (
      <div className="page">
        <Alert
          type="error"
          showIcon
          message="项目加载失败"
          description={(project.error as Error)?.message}
          action={<Button onClick={() => project.refetch()}>重试</Button>}
        />
      </div>
    );
  const p = project.data;
  const running = active(p.status);
  const checkpoint = p.status === 'awaiting_user' ? p.state.expert_checkpoint : undefined;
  const currentNode = selectedNode || p.state.current_node || nodes[0]?.id;
  const completedNodes = new Set(
    p.state.history?.filter((h) => nodes.some((n) => n.id === h.node)).map((h) => h.node),
  );
  const fileList = files.data?.files || [];
  const defaultFile = checkpoint?.node === currentNode ? checkpoint.report : reports[currentNode];
  const file = selectedFile || (fileList.some((f) => f.path === defaultFile) ? defaultFile : '');
  const changeNode = (node: string) => {
    const change = () => {
      dirtyRef.current = false;
      setSelectedNode(node);
      setSelectedFile('');
      setTab('report');
    };
    if (dirtyRef.current) modal.confirm({ title: '放弃未保存的修改？', onOk: change });
    else change();
  };
  const phase = nodes.find((n) => n.id === currentNode);
  return (
    <div className="workbench-page">
      <div className="workbench-heading">
        <div>
          <Link to="/" className="back-link">
            <ArrowLeftOutlined /> 研究项目
          </Link>
          <h1>
            {p.name}
            <Status value={p.status} />
          </h1>
          <Tooltip title={p.path}>
            <p className="project-path">
              <FolderOpenOutlined /> {p.path}
            </p>
          </Tooltip>
        </div>
        <Space>
          <Tooltip title="刷新">
            <Button
              aria-label="刷新"
              icon={<ReloadOutlined />}
              onClick={() => {
                project.refetch();
                files.refetch();
                logs.refetch();
              }}
            />
          </Tooltip>
          {p.status === 'external_running' ? (
            <Tooltip title="该任务由终端启动，请在原终端管理；工作台可以浏览研究产物。">
              <Button disabled icon={<LoadingOutlined />}>
                终端运行中
              </Button>
            </Tooltip>
          ) : running ? (
            <Button
              danger
              icon={<StopOutlined />}
              loading={stop.isPending || p.status === 'stopping'}
              onClick={() =>
                modal.confirm({
                  title: '停止当前运行？',
                  content: '将中断当前模型或实验进程并保留已保存的产物。后续可从已有节点恢复。',
                  okText: '停止运行',
                  okButtonProps: { danger: true },
                  onOk: () => stop.mutateAsync(),
                })
              }
            >
              停止运行
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              size="large"
              disabled={!!checkpoint}
              onClick={() => setRunOpen(true)}
            >
              {p.state.task_prompt ? '继续研究' : '启动研究'}
            </Button>
          )}
        </Space>
      </div>
      {(p.runs[0]?.error || p.state.error) && !running && (
        <Alert
          className="run-alert"
          closable
          type="error"
          showIcon
          message="上次运行需要处理"
          description={p.runs[0]?.error || p.state.error}
        />
      )}
      <div className="workbench-grid">
        <aside className="phase-panel">
          <div className="panel-caption">
            研究流程 <span>{completedNodes.size}/11</span>
          </div>
          <div className="phase-progress">
            <Progress
              percent={Math.round((completedNodes.size / 11) * 100)}
              showInfo={false}
              strokeColor="#49876b"
              size="small"
            />
          </div>
          <div className="phase-list">
            {nodes.map((node, i) => {
              const isCurrent = p.state.current_node === node.id;
              const done = completedNodes.has(node.id);
              return (
                <button
                  key={node.id}
                  className={`phase-item ${currentNode === node.id ? 'selected' : ''} ${done ? 'done' : ''}`}
                  onClick={() => changeNode(node.id)}
                >
                  <span className="phase-number">
                    {isCurrent && running ? (
                      <LoadingOutlined spin />
                    ) : done ? (
                      <CheckOutlined />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <span>
                    {node.label}
                    <small>
                      {isCurrent
                        ? statusLabels[p.status] || p.status
                        : done
                          ? '已有执行记录'
                          : '等待执行'}
                    </small>
                  </span>
                  {currentNode === node.id && <span className="phase-selected-dot" />}
                </button>
              );
            })}
          </div>
          <div className="phase-footer">
            <span className={`connection-dot ${streamState === 'connected' ? 'online' : ''}`} />
            {streamState === 'connected'
              ? '实时同步已连接'
              : streamState === 'connecting'
                ? '正在建立连接'
                : '重连中 · 定时刷新仍可用'}
          </div>
        </aside>
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <span className="eyebrow">RESEARCH ARTIFACTS</span>
              <h2>{phase?.label || '研究产物'}</h2>
            </div>
            <Tag bordered={false}>
              {p.state.mode === 'expert'
                ? '专家模式'
                : p.state.mode === 'auto'
                  ? '自动模式'
                  : '待配置'}
            </Tag>
          </div>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            className="workspace-tabs"
            items={[
              {
                key: 'report',
                label: '阶段产物',
                children: (
                  <>
                    <div className="file-selector">
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        value={file || undefined}
                        placeholder="选择项目文件查看"
                        onChange={(v) => selectFile(v || '')}
                        options={fileList.map((f) => ({ value: f.path, label: f.path }))}
                        suffixIcon={<FileOutlined />}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <Artifact
                      key={`${id}:${file}`}
                      projectId={id}
                      path={file}
                      running={running}
                      onDirtyChange={(v) => {
                        dirtyRef.current = v;
                      }}
                    />
                  </>
                ),
              },
              {
                key: 'files',
                label: `项目文件${fileList.length ? ` · ${fileList.length}` : ''}`,
                children: (
                  <div className="files-tab">
                    {files.data?.truncated && (
                      <Alert type="warning" message="仅显示前 5000 个文件" />
                    )}
                    <Input.Search
                      placeholder="搜索文件路径"
                      onChange={(e) => {
                        const v = e.target.value.toLowerCase();
                        document.querySelectorAll<HTMLElement>('.file-list-row').forEach((el) => {
                          el.hidden = !el.dataset.path?.toLowerCase().includes(v);
                        });
                      }}
                    />
                    <List
                      dataSource={fileList}
                      locale={{ emptyText: '暂无研究文件' }}
                      renderItem={(f) => (
                        <List.Item
                          className="file-list-row"
                          data-path={f.path}
                          actions={[
                            <span key="size" className="muted">
                              {f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`}
                            </span>,
                          ]}
                        >
                          <button
                            className="file-row-button"
                            onClick={() => {
                              selectFile(f.path);
                              setTab('report');
                            }}
                          >
                            <FileOutlined />
                            {f.path}
                          </button>
                        </List.Item>
                      )}
                    />
                  </div>
                ),
              },
              {
                key: 'experiments',
                label: '实验任务',
                children: (
                  <Experiments
                    projectId={id}
                    hasManifest={fileList.some((f) => f.path === 'experiments/manifest.json')}
                    running={running}
                  />
                ),
              },
              {
                key: 'history',
                label: '运行历史',
                children: (
                  <div className="history-tab">
                    {p.runs.length ? (
                      p.runs.map((r) => (
                        <div className="history-row" key={r.id}>
                          <span className="history-icon">
                            <ClockCircleOutlined />
                          </span>
                          <div>
                            <strong>
                              {r.options.action === 'review'
                                ? '专家审阅与继续'
                                : r.options.action === 'resume'
                                  ? '恢复研究'
                                  : '启动研究'}
                            </strong>
                            <p>
                              {formatDate(r.created_at)} <span>→</span>{' '}
                              {r.finished_at ? formatDate(r.finished_at) : '执行中'}
                            </p>
                            {r.error && <small className="error-text">{r.error}</small>}
                          </div>
                          <Status value={r.status} />
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无运行记录" />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </section>
        <aside className="activity-panel">
          <div className="panel-caption">
            运行动态
            <span className={`connection-dot ${running ? 'online' : ''}`} />
          </div>
          <div className="activity-current">
            <span className="eyebrow">CURRENT ACTIVITY</span>
            <h3>
              {running
                ? nodes.find((n) => n.id === p.state.current_node)?.label || '正在启动'
                : checkpoint
                  ? '等待你的研究判断'
                  : p.status === 'idle'
                    ? '准备开始探索'
                    : statusLabels[p.status]}
            </h3>
            <p>
              {running
                ? String(p.progress.tool || p.progress.phase || '研究引擎正在执行任务')
                : checkpoint
                  ? '审阅阶段产物，确认方向后继续。'
                  : '运行记录和工具活动将显示在这里。'}
            </p>
            {running && (
              <div className="live-indicator">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="activity-section-title">
            执行日志{' '}
            <Button
              type="text"
              size="small"
              aria-label="刷新日志"
              icon={<ReloadOutlined />}
              onClick={() => logs.refetch()}
            />
          </div>
          {logs.data?.content ? (
            <pre className="live-log">{logs.data.content}</pre>
          ) : (
            <div className="quiet-state">
              <ClockCircleOutlined />
              <span>暂无本工作台的运行日志</span>
            </div>
          )}
          <div className="activity-bottom">
            <CheckCircleFilled /> 运行状态持续保存至本机
          </div>
        </aside>
      </div>
      {checkpoint && (
        <section className="review-panel">
          <div className="review-heading">
            <span className="review-icon">✦</span>
            <div>
              <span className="eyebrow">HUMAN IN THE LOOP</span>
              <h2>这一阶段，听听你的判断</h2>
            </div>
            <Tag color="gold" bordered={false}>
              等待审阅
            </Tag>
          </div>
          <p className="review-summary">{checkpoint.summary}</p>
          <ol className="review-questions">
            {checkpoint.questions?.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
          <div className="review-input-row">
            <Input.TextArea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoSize={{ minRows: 3, maxRows: 8 }}
              maxLength={20000}
              placeholder="输入你的回答或修改意见；留空表示接受当前产物并继续。"
            />
            <Button
              type="primary"
              size="large"
              loading={run.isPending}
              disabled={running}
              icon={<ArrowRightOutlined />}
              onClick={() => {
                if (dirtyRef.current) {
                  message.warning('请先保存报告修改，再提交审阅');
                  return;
                }
                modal.confirm({
                  title: answer.trim() ? '提交意见并继续研究？' : '确认当前产物并继续？',
                  content: answer.trim()
                    ? '系统将按意见修订当前节点产物，再进入后续节点。'
                    : '系统将校验当前产物并进入后续节点，可能调用模型或启动实验。',
                  onOk: () =>
                    run.mutateAsync({
                      action: 'review',
                      answer,
                      checkpoint_token: p.checkpoint_token,
                    }),
                });
              }}
            >
              {answer.trim() ? '提交意见并继续' : '确认并继续'}
            </Button>
          </div>
        </section>
      )}
      <RunDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onRun={(values) => run.mutate(values)}
        pending={run.isPending}
        project={p}
        nodes={nodes}
      />
    </div>
  );
}
function Experiments({
  projectId,
  hasManifest,
  running,
}: {
  projectId: string;
  hasManifest: boolean;
  running: boolean;
}) {
  const manifest = useQuery({
    queryKey: ['manifest', projectId],
    queryFn: () => api.file(projectId, 'experiments/manifest.json'),
    enabled: hasManifest,
    refetchInterval: running ? 5000 : false,
  });
  if (!hasManifest)
    return (
      <div className="tab-empty">
        <Empty description="实验规划完成后，这里将展示任务与依赖。" />
      </div>
    );
  if (manifest.isPending) return <Spin />;
  if (manifest.isError) return <Alert type="error" message={(manifest.error as Error).message} />;
  let jobs: Record<string, unknown>[];
  try {
    jobs = JSON.parse(manifest.data?.content || '{}').jobs || [];
  } catch {
    return <Alert type="warning" message="实验清单暂时无法解析，请检查 manifest.json。" />;
  }
  return (
    <div className="experiments-tab">
      <Alert
        type="info"
        showIcon
        message="下表展示实验任务定义。任务完成情况请结合执行日志、tracker 和实际回执确认。"
      />
      <Table
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={jobs}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 550 }}
        columns={[
          { title: '任务', dataIndex: 'id', render: (value) => <code>{String(value)}</code> },
          {
            title: '依赖',
            dataIndex: 'depends_on',
            render: (value) =>
              Array.isArray(value) && value.length ? value.join(', ') : '独立任务',
          },
          {
            title: '超时',
            dataIndex: 'timeout_seconds',
            render: (value) => (value ? `${value} 秒` : '—'),
          },
          {
            title: '预期产物',
            dataIndex: 'expected_outputs',
            render: (value) => (Array.isArray(value) ? `${value.length} 项` : '—'),
          },
        ]}
      />
    </div>
  );
}
