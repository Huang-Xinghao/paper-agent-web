import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Form, Input, Modal, Segmented, Skeleton, Tooltip } from 'antd';
import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { active, api } from '../../api/client';
import { Status } from '../../components/Status';
import { formatDate } from '../../lib/date';
export function Projects() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects,
    refetchInterval: 7000,
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('全部项目');
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm<{ name: string; path?: string }>();
  const create = useMutation({
    mutationFn: api.create,
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setOpen(false);
      form.resetFields();
      navigate(`/projects/${p.id}`);
    },
    onError: (error: Error) => message.error(error.message),
  });
  const all = useMemo(() => projects.data || [], [projects.data]);
  const filtered = useMemo(
    () =>
      all.filter(
        (p) =>
          `${p.name} ${p.state.task_prompt || ''}`.toLowerCase().includes(search.toLowerCase()) &&
          (filter === '全部项目' ||
            (filter === '运行中'
              ? active(p.status)
              : filter === '待审阅'
                ? p.status === 'awaiting_user'
                : p.status === 'completed')),
      ),
    [all, filter, search],
  );
  const showCreate = (isImport: boolean) => {
    setImporting(isImport);
    form.resetFields();
    setOpen(true);
  };
  return (
    <div className="page projects-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RESEARCH, IN PROGRESS</div>
          <h1>
            研究项目<span className="title-dot">.</span>
          </h1>
          <p className="page-description">从研究问题出发，管理每一步探索与发现。</p>
        </div>
        <div className="heading-actions">
          <Button icon={<FolderOpenOutlined />} onClick={() => showCreate(true)}>
            导入项目
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => showCreate(false)}
          >
            新建研究项目
          </Button>
        </div>
      </div>
      <div className="overview-strip">
        {[
          ['全部项目', all.length, '持续积累研究成果'],
          ['正在运行', all.filter((p) => active(p.status)).length, '研究引擎执行中'],
          [
            '等待审阅',
            all.filter((p) => p.status === 'awaiting_user').length,
            '你的判断，让研究更进一步',
          ],
          ['已完成', all.filter((p) => p.status === 'completed').length, '阶段任务已完成'],
        ].map(([label, value, hint], i) => (
          <div className="overview-item" key={label}>
            <div>
              <span className={`stat-dot stat-${i}`} />
              {label}
            </div>
            <strong>
              {value}
              <small>{hint}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="section-toolbar">
        <Segmented
          options={['全部项目', '运行中', '待审阅', '已完成']}
          value={filter}
          onChange={(value) => setFilter(value)}
        />
        <div className="search-actions">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索项目或研究目标"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tooltip title="刷新项目">
            <Button
              aria-label="刷新项目"
              icon={<ReloadOutlined spin={projects.isFetching} />}
              onClick={() => projects.refetch()}
            />
          </Tooltip>
        </div>
      </div>
      {projects.isError && (
        <Alert
          type="error"
          showIcon
          message="项目加载失败"
          description={(projects.error as Error).message}
          action={<Button onClick={() => projects.refetch()}>重试</Button>}
        />
      )}
      {projects.isPending ? (
        <div className="project-grid">
          {[1, 2, 3].map((i) => (
            <div className="project-card" key={i}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="empty-projects">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              search || filter !== '全部项目' ? '没有匹配的项目' : '从你的第一个研究问题开始'
            }
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreate(false)}>
            创建研究项目
          </Button>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((p, index) => {
            const done = new Set(
              p.state.history
                ?.map((h) => h.node)
                .filter((n) =>
                  [
                    'literature',
                    'data_search',
                    'ideas',
                    'refine',
                    'experiment_plan',
                    'experiment_bridge',
                    'paper_plan',
                    'paper_figure',
                    'paper_write',
                    'paper_compile',
                    'improvement',
                  ].includes(n || ''),
                ),
            ).size;
            return (
              <Link to={`/projects/${p.id}`} className="project-card" key={p.id}>
                <div className="project-card-top">
                  <span className={`project-icon tone-${index % 3}`}>
                    <FolderOpenOutlined />
                  </span>
                  <Status value={p.status} />
                </div>
                <h3>{p.name}</h3>
                <p className="project-summary">
                  {p.state.task_prompt || '研究空间已准备就绪，进入项目开始新的探索。'}
                </p>
                <div className="project-phase">
                  <span>
                    {p.state.current_node
                      ? `当前阶段 · ${p.state.current_node.replaceAll('_', ' ')}`
                      : '等待配置研究目标'}
                  </span>
                  <span>{done}/11</span>
                </div>
                <div className="mini-progress">
                  <span style={{ width: `${(done / 11) * 100}%` }} />
                </div>
                <div className="project-card-bottom">
                  <span>
                    <ClockCircleOutlined />
                    {formatDate(p.runs[0]?.created_at || p.created_at)}
                  </span>
                  <span className="enter-project">
                    进入项目 <ArrowRightOutlined />
                  </span>
                </div>
              </Link>
            );
          })}
          <button className="new-project-card" onClick={() => showCreate(false)}>
            <span>
              <FolderAddOutlined />
            </span>
            <strong>开启新的研究</strong>
            <small>把下一个想法，变成项目</small>
          </button>
        </div>
      )}
      <div className="page-footnote">
        <span className="connection-dot online" />
        研究文件保存在本机 · 每一次探索都有迹可循
      </div>
      <Modal
        title={importing ? '导入已有项目' : '新建研究项目'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText={importing ? '导入项目' : '创建项目'}
        destroyOnHidden
      >
        <p className="muted">
          {importing
            ? '登记项目目录，保留其中已有的研究文件和运行状态。'
            : '先为研究创建一个空间，再配置研究目标和运行方式。'}
        </p>
        <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, whitespace: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如：退役电池寿命预测研究" maxLength={100} />
          </Form.Item>
          {importing && (
            <Form.Item
              name="path"
              label="已有项目绝对路径"
              rules={[{ required: true, message: '请输入项目路径' }]}
            >
              <Input placeholder="/data/xinghaohuang/paper-agent-projects/demo-project23" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
