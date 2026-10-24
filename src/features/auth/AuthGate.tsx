import { useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Spin } from 'antd';
import { request } from '../../api/client';

type Session = { enabled: boolean; authenticated: boolean };
export function AuthGate({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => request<Session>('/auth/session'),
    refetchInterval: 60000,
  });
  const login = useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['session'] }),
  });
  useEffect(() => {
    const expired = () => {
      client.clear();
      client.setQueryData(['session'], { enabled: true, authenticated: false });
    };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [client]);
  if (session.isPending)
    return (
      <div className="auth-screen">
        <Spin size="large" />
      </div>
    );
  if (session.isError)
    return (
      <div className="auth-screen">
        <Card title="Paper Agent">
          <Alert type="error" message="暂时无法连接研究服务" description="请稍后重试。" />
          <Button onClick={() => session.refetch()}>重新连接</Button>
        </Card>
      </div>
    );
  if (!session.data.authenticated)
    return (
      <div className="auth-screen">
        <Card title="Paper Agent · 科研工作台" className="auth-card">
          <p>登录你的研究空间</p>
          <Form layout="vertical" onFinish={(values) => login.mutate(values)}>
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input autoComplete="username" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password autoComplete="current-password" maxLength={1024} />
            </Form.Item>
            {login.isError && <Alert type="error" message={login.error.message} />}
            <Button type="primary" htmlType="submit" loading={login.isPending} block>
              登录
            </Button>
          </Form>
        </Card>
      </div>
    );
  return (
    <>
      {session.data.enabled && (
        <Button
          className="logout-button"
          onClick={async () => {
            await request('/auth/logout', { method: 'POST' });
            client.clear();
            window.location.reload();
          }}
        >
          退出登录
        </Button>
      )}
      {children}
    </>
  );
}
