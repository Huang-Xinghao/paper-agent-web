import { lazy, Suspense, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Image, Segmented, Select, Skeleton, Space, Spin } from 'antd';
import { DownloadOutlined, EditOutlined, FileTextOutlined, SaveOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { api, ApiError, type ProjectFile } from '../../api/client';
import './artifact.css';
const Editor = lazy(() => import('./Editor'));
export function Artifact({
  projectId,
  path,
  running,
  onDirtyChange,
  files,
}: {
  projectId: string;
  path: string;
  running: boolean;
  files: ProjectFile[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { message, modal } = App.useApp();
  const client = useQueryClient();
  const [mode, setMode] = useState('预览');
  const [baseContent, setBaseContent] = useState('');
  const [saveError, setSaveError] = useState('');
  const file = useQuery({
    queryKey: ['file', projectId, path],
    queryFn: () => api.file(projectId, path),
    enabled: !!path,
    refetchInterval: running && mode === '预览' ? 6000 : false,
    refetchOnWindowFocus: mode === '预览',
  });
  const [expanded, setExpanded] = useState(false);
  const [pdfPath, setPdfPath] = useState('');
  const [latexPane, setLatexPane] = useState('source');
  const [savedSource, setSavedSource] = useState(false);
  const isTex = /\.tex$/i.test(path);
  const pdfs = files.filter((file) => /\.pdf$/i.test(file.path));
  const pairedPdf =
    pdfs.find((file) => file.path === path.replace(/\.tex$/i, '.pdf'))?.path ||
    pdfs.find((file) => file.path === 'paper/main.pdf')?.path ||
    pdfs.find((file) => file.path.startsWith(path.slice(0, path.lastIndexOf('/') + 1)))?.path;
  const selectedPdf = pdfPath || pairedPdf || '';
  const pdf = files.find((file) => file.path === selectedPdf);
  const source = files.find((file) => file.path === path);
  const stalePdf = savedSource || (pdf && source && source.modified > pdf.modified);

  const [draft, setDraft] = useState('');
  const [baseHash, setBaseHash] = useState('');
  useEffect(() => {
    setMode('预览');
    setPdfPath('');
    setSavedSource(false);
    setDraft('');
    setBaseHash('');
    setBaseContent('');
    setSaveError('');
  }, [path, projectId]);
  const save = useMutation({
    mutationFn: () => {
      if (running) throw new Error('任务仍在运行，请等待阶段审阅或停止运行后保存。');
      return api.save(projectId, path, draft, baseHash);
    },
    onSuccess: (data) => {
      client.setQueryData(['file', projectId, path], data);
      client.invalidateQueries({ queryKey: ['project', projectId] });
      setBaseHash(data.sha256 || '');
      setBaseContent(data.content || '');
      setSaveError('');
      message.success('文件已保存');
      if (isTex) setSavedSource(true);
      else setMode('预览');
      client.invalidateQueries({ queryKey: ['files', projectId] });
    },
    onError: (error: Error) => {
      setSaveError(
        error instanceof ApiError && error.status === 409
          ? `${error.message}。草稿已保留；可先下载草稿，再重新加载最新文件进行核对。`
          : error.message,
      );
      message.error(error.message);
    },
  });
  const dirty = mode === '编辑' && draft !== baseContent;
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
      setBaseContent(file.data?.content || '');
      setSaveError('');
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
    <div className={`artifact-panel ${expanded ? 'artifact-expanded' : ''}`}>
      <div className="artifact-toolbar">
        <span className="artifact-filename" title={path}>
          <FileTextOutlined />
          {path.split('/').pop()}
        </span>
        <Space wrap className="artifact-actions">
          <Button size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? '退出全屏' : '全屏查看'}
          </Button>
          {file.data?.editable && (
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
              disabled={running || !dirty}
              onClick={() => save.mutate()}
            >
              保存
            </Button>
          )}
          {mode === '编辑' && (
            <Button
              size="small"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([draft], { type: 'text/plain;charset=utf-8' }),
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = `draft-${path.split('/').pop()}`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              下载草稿
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
      {file.data?.editable && running && (
        <Alert
          className="artifact-edit-notice"
          type="info"
          banner
          message="运行中可编辑草稿；等待阶段审阅或停止运行后再保存，避免与 Agent 的修改冲突。"
        />
      )}
      {saveError && (
        <Alert
          className="artifact-edit-notice"
          type="error"
          banner
          message={saveError}
          action={
            <Button
              size="small"
              onClick={() =>
                modal.confirm({
                  title: '重新加载文件并放弃当前草稿？',
                  content: '如需保留修改，请先下载草稿。',
                  onOk: async () => {
                    const result = await file.refetch();
                    if (!result.data || result.isError) throw new Error('重新加载失败，草稿已保留');
                    setDraft(result.data.content || '');
                    setBaseContent(result.data.content || '');
                    setBaseHash(result.data.sha256 || '');
                    setSaveError('');
                  },
                })
              }
            >
              重新加载文件
            </Button>
          }
        />
      )}
      {dirty && (
        <Alert type="warning" banner message="有未保存的修改，请在切换文件或页面前保存。" />
      )}
      <div
        className={`artifact-content ${isTex ? 'is-latex' : ''}`}
        tabIndex={0}
        role="region"
        aria-label="文件内容"
      >
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
        ) : isTex ? (
          <>
            <Alert
              type="info"
              showIcon
              message="LaTeX 论文工作区"
              description="保存后，在“继续研究 → 编译交付”更新 PDF。"
            />
            {(dirty || stalePdf) && (
              <Alert
                type="warning"
                banner
                message="源码已修改，右侧 PDF 可能尚未更新，需重新编译后核对。"
              />
            )}
            <Segmented
              className="latex-mobile-switch"
              aria-label="论文面板"
              value={latexPane}
              onChange={setLatexPane}
              options={[
                { label: 'LaTeX 源码', value: 'source' },
                { label: 'PDF 预览', value: 'pdf' },
              ]}
            />
            <div className={`latex-workspace show-${latexPane}`}>
              <section className="latex-source">
                <div className="pane-heading">
                  LaTeX 源码 · {mode === '编辑' ? '编辑中' : '只读'}
                </div>
                {mode === '编辑' ? (
                  <Suspense fallback={<Spin className="editor-loading" />}>
                    <div className="editor-host">
                      <Editor value={draft} path={path} onChange={setDraft} />
                    </div>
                  </Suspense>
                ) : (
                  <pre className="source-preview" tabIndex={0}>
                    {file.data?.content || ''}
                  </pre>
                )}
              </section>
              <section className="latex-pdf">
                <div className="pane-heading">
                  PDF 预览{' '}
                  <Select
                    aria-label="选择论文 PDF"
                    placeholder="选择已有 PDF"
                    value={selectedPdf || undefined}
                    onChange={setPdfPath}
                    options={pdfs.map((file) => ({ value: file.path, label: file.path }))}
                  />
                </div>
                {selectedPdf ? (
                  <iframe
                    className="pdf-preview"
                    title="论文 PDF 对照预览"
                    src={`${api.download(projectId, selectedPdf)}&v=${pdf?.modified || 0}`}
                  />
                ) : (
                  <Empty description="尚无已编译 PDF，完成编译交付后可在这里对照查看" />
                )}
              </section>
            </div>
          </>
        ) : mode === '编辑' ? (
          <Suspense fallback={<Spin className="editor-loading" />}>
            <div className="editor-host">
              <Editor value={draft} path={path} onChange={setDraft} />
            </div>
          </Suspense>
        ) : file.data?.kind === 'binary' ? (
          path.endsWith('.pdf') ? (
            <iframe className="pdf-preview" title={path} src={api.download(projectId, path)} />
          ) : /\.(png|jpe?g|webp)$/i.test(path) ? (
            <div className="image-preview">
              <Image alt={path} src={api.download(projectId, path)} />
              <p className="muted">点击图片可放大、缩小、旋转和查看原图</p>
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
                img: ({ alt, src }) => {
                  const image = resolveImage(path, src, files);
                  return image ? (
                    <Image alt={alt || image} src={api.download(projectId, image)} />
                  ) : (
                    <span className="muted">[图片：{alt || '请在图片画廊中查看'}]</span>
                  );
                },
              }}
            >
              {file.data?.content || ''}
            </ReactMarkdown>
          </article>
        ) : (
          <pre className="source-preview" tabIndex={0}>
            {file.data?.content || ''}
          </pre>
        )}
      </div>
    </div>
  );
}

function resolveImage(report: string, src: string | undefined, files: ProjectFile[]) {
  if (!src || /^(?:[a-z]+:|\/\/)/i.test(src)) return undefined;
  try {
    const url = new URL(src, `https://project.invalid/${report}`);
    const path = decodeURIComponent(url.pathname.slice(1));
    return files.find((file) => file.path === path && /\.(png|jpe?g|webp)$/i.test(path))?.path;
  } catch {
    return undefined;
  }
}
