import { Tag } from 'antd';
import { statusLabels } from '../api/client';
export function Status({ value }: { value: string }) {
  const color = (
    {
      running: 'processing',
      queued: 'processing',
      completed: 'success',
      failed: 'error',
      awaiting_user: 'warning',
      stopping: 'warning',
    } as Record<string, string>
  )[value];
  return (
    <Tag bordered={false} color={color}>
      {statusLabels[value] || value}
    </Tag>
  );
}
