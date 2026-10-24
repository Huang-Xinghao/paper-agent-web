import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const backend =
  process.env.PAPER_AGENT_BACKEND_DIR ||
  fileURLToPath(new URL('../../paper-agent', import.meta.url));
const children = [
  spawn('./run-web-api', [], { cwd: backend, stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    stdio: 'inherit',
    env: process.env,
  }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1200);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(0));
for (const child of children) {
  child.on('exit', (code) => stop(code || 0));
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}
