import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = await mkdtemp(join(tmpdir(), 'paper-agent-e2e-'));
const projects = join(root, 'projects');
const project = join(projects, 'battery-study');
await mkdir(join(project, 'literature'), { recursive: true });
await writeFile(
  join(project, 'literature', 'RESEARCH_REPORT.md'),
  '# 电池寿命研究\n\n这是用于浏览器测试的隔离报告。\n\n## 研究证据\n\n需要验证跨电芯泛化。\n\n$E = mc^2$\n',
);
await writeFile(
  join(project, 'workflow-state.json'),
  JSON.stringify({
    run_id: 'browser-fixture',
    task_prompt: '研究退役电池的寿命预测与跨电芯泛化',
    mode: 'expert',
    status: 'awaiting_user',
    current_node: 'literature',
    history: [{ node: 'literature', timestamp: new Date().toISOString() }],
    expert_checkpoint: {
      node: 'literature',
      summary: '已有证据提示跨电芯泛化值得进一步验证。',
      questions: ['优先研究哪一个泛化问题？'],
      report: 'literature/RESEARCH_REPORT.md',
      files: ['literature/RESEARCH_REPORT.md'],
      status: 'pending',
      next_node: 'data_search',
    },
  }),
);
const python =
  process.env.PAPER_AGENT_RUNTIME_PYTHON || '/data/apps/micromamba/envs/xinghao/bin/python';
const backend =
  process.env.PAPER_AGENT_BACKEND_DIR ||
  fileURLToPath(new URL('../../paper-agent', import.meta.url));
const child = spawn(python, ['-m', 'paper_agent.api.app'], {
  cwd: backend,
  stdio: 'inherit',
  env: {
    ...process.env,
    PAPER_AGENT_PROJECT_ROOTS: projects,
    PAPER_AGENT_WEB_DATA: join(root, 'metadata'),
    PAPER_AGENT_API_PORT: '8001',
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', async (code) => {
  await rm(root, { recursive: true, force: true });
  process.exit(code || 0);
});
