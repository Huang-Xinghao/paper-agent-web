import type { components } from './schema';
type Schemas = components['schemas'];
export type NodeInfo = Schemas['NodeView'];
export type Checkpoint = Schemas['CheckpointView'];
export type WorkflowState = Schemas['WorkflowView'];
export type Run = Schemas['RunView'];
export type Project = Schemas['ProjectView'];
export type ProjectFile = { path: string; size: number; modified: number };
export type FileContent = {
  kind: 'text' | 'binary';
  path: string;
  content?: string;
  sha256?: string;
  editable?: boolean;
};
export type RunInput = import('./schema').components['schemas']['RunCreate'];
export type Health = Schemas['HealthView'];
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      window.dispatchEvent(new Event('session-expired'));
    }
    let detail = `请求失败 (${response.status})`;
    try {
      const data = await response.json();
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* Non-JSON errors, e.g. reverse proxy unavailable. */
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}
export const api = {
  health: () => request<Health>('/health'),
  projects: () => request<Project[]>('/projects'),
  project: (id: string) => request<Project>(`/projects/${id}`),
  create: (body: { name: string; path?: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  run: (id: string, body: RunInput) =>
    request<{ id: string }>(`/projects/${id}/runs`, { method: 'POST', body: JSON.stringify(body) }),
  stop: (id: string) => request(`/projects/${id}/stop`, { method: 'POST' }),
  files: (id: string) =>
    request<{ files: ProjectFile[]; truncated: boolean }>(`/projects/${id}/files`),
  file: (id: string, path: string) =>
    request<FileContent>(`/projects/${id}/file?${new URLSearchParams({ path })}`),
  save: (id: string, path: string, content: string, sha256: string) =>
    request<FileContent>(`/projects/${id}/file?${new URLSearchParams({ path })}`, {
      method: 'PUT',
      body: JSON.stringify({ content, sha256 }),
    }),
  log: (id: string) => request<{ content: string }>(`/projects/${id}/log`),
  download: (id: string, path: string) =>
    `/api/projects/${id}/download?${new URLSearchParams({ path })}`,
};
export const active = (status: string) =>
  ['queued', 'running', 'stopping', 'external_running'].includes(status);
export const statusLabels: Record<string, string> = {
  external_running: '终端运行中',
  idle: '尚未启动',
  queued: '等待启动',
  running: '运行中',
  stopping: '正在停止',
  interrupted: '已中断',
  awaiting_user: '等待审阅',
  awaiting_results: '等待实验结果',
  completed: '已完成',
  failed: '运行失败',
};
