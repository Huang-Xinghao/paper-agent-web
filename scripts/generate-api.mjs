import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import { fileURLToPath } from 'node:url';
const backend =
  process.env.PAPER_AGENT_BACKEND_DIR ||
  fileURLToPath(new URL('../../paper-agent', import.meta.url));
const python =
  process.env.PAPER_AGENT_RUNTIME_PYTHON || '/data/apps/micromamba/envs/xinghao/bin/python';
const schema = JSON.parse(
  execFileSync(
    python,
    ['-c', 'import json; from paper_agent.api.app import app; print(json.dumps(app.openapi()))'],
    { cwd: backend, encoding: 'utf8' },
  ),
);
const types = await openapiTS(schema, { defaultNonNullable: false });
await writeFile(new URL('../src/api/schema.d.ts', import.meta.url), astToString(types));
console.log('Generated src/api/schema.d.ts from backend OpenAPI');
