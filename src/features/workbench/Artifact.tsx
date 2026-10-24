import { lazy, Suspense, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Segmented, Skeleton, Space, Spin } from 'antd';
import { DownloadOutlined, EditOutlined, FileTextOutlined, SaveOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { api } from '../../api/client';
const Editor = lazy(() => import('./Editor'));
export function Artifact({
  projectId,
  path,
  running,
  onDirtyChange,
}: {
  projectId: string;
  path: string;
  running: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { message, modal } = App.useApp();
  const client = useQueryClient();
  const file = useQuery({
    queryKey: ['file', projectId, path],
    queryFn: () => api.file(projectId, path),
    enabled: !!path,
    refetchInterval: running ? 6000 : false,
  });
  const [mode, setMode] = useState('预览');
  const [draft, setDraft] = useState('');
  const [baseHash, setBaseHash] = useState('');
  useEffect(() => {
    setMode('预览');
    setDraft('');
    setBaseHash('');
  }, [path, projectId]);
  const save = useMutation({
    mutationFn: () => api.save(projectId, path, draft, baseHash),
    onSuccess: (data) => {
      client.setQueryData(['file', projectId, path], data);
      client.invalidateQueries({ queryKey: ['project', projectId] });
      setBaseHash(data.sha256 || '');
      message.success('文件已保存');
      setMode('预览');
    },
    onError: (error: Error) => message.error(error.message),
  });
  const dirty = mode === '编辑' && draft !== file.data?.content;
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const dialog = modal.confirm({
      title: '放弃未保存的修改并离开？',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker, modal]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function changeMode(next: string) {
    if (next === '预览' && dirty) {
      modal.confirm({ title: '放弃未保存的修改？', onOk: () => setMode(next) });
      return;
    }
    if (next === '编辑') {
      setDraft(file.data?.content || '');
      setBaseHash(file.data?.sha256 || '');
    }
    setMode(next);
  }
  if (!path)
    return (
      <div className="artifact-empty">
        <span className="empty-document">
          <FileTextOutlined />
        </span>
        <h3>研究产物将在这里呈现</h3>
        <p>选择阶段报告或项目文件，查看研究的每一步。</p>
      </div>
    );
  return (
    <div className="artifact-panel">
      <div className="artifact-toolbar">
        <span className="artifact-filename">
          <FileTextOutlined />
          {path}
        </span>
        <Space>
          {file.data?.editable && !running && (
            <Segmented
              size="small"
              value={mode}
              onChange={(v) => changeMode(v)}
              options={[
                { label: '预览', value: '预览' },
                {
                  label: (
                    <span>
                      <EditOutlined /> 编辑
                    </span>
                  ),
                  value: '编辑',
                },
              ]}
            />
          )}
          {mode === '编辑' && (
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              保存
            </Button>
          )}
          <Button
            size="small"
            aria-label="下载文件"
            href={api.download(projectId, path)}
            target="_blank"
            rel="noreferrer"
            icon={<DownloadOutlined />}
          />
        </Space>
      </div>
      {dirty && (
        <Alert type="warning" banner message="有未保存的修改，请在切换文件或页面前保存。" />
      )}
      {file.isPending ? (
        <div className="artifact-padding">
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      ) : file.isError ? (
        <Alert
          type="error"
          showIcon
          message="文件加载失败"
          description={(file.error as Error).message}
          action={<Button onClick={() => file.refetch()}>重试</Button>}
        />
      ) : mode === '编辑' ? (
        <Suspense fallback={<Spin className="editor-loading" />}>
          <Editor value={draft} path={path} onChange={setDraft} />
        </Suspense>
      ) : file.data?.kind === 'binary' ? (
        path.endsWith('.pdf') ? (
          <iframe className="pdf-preview" title={path} src={api.download(projectId, path)} />
        ) : /\.(png|jpe?g|webp)$/i.test(path) ? (
          <div className="image-preview">
            <img alt={path} src={api.download(projectId, path)} />
          </div>
        ) : (
          <Empty description="此文件可下载后查看" />
        )
      ) : path.endsWith('.md') ? (
        <article className="markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
              img: ({ alt }) => (
                <span className="muted">[图片：{alt || '请在项目文件中查看'}]</span>
              ),
            }}
          >
            {file.data?.content || ''}
          </ReactMarkdown>
        </article>
      ) : (
        <pre className="source-preview">{file.data?.content || ''}</pre>
      )}
    </div>
  );
}
