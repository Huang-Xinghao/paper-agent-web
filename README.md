# Paper Agent Web

与 `../paper-agent` 平级的科研工作台。React + TypeScript + Vite + Ant Design，FastAPI 服务层位于后端 `paper_agent/api/`。研究状态及产物继续保存在原项目目录，SQLite 只保存项目登记、Web 运行记录与事件。

## 启动

需要 Node.js >=22.12，建议 npm >=9.5。当前机器已有的 npm 9.2 已完成安装及构建验证，但部分开发依赖声明要求更新版本。

```bash
cd /home/xinghaohuang/paper-agent
/data/apps/micromamba/envs/xinghao/bin/python -m pip install -e '.[web,test]'

cd /home/xinghaohuang/paper-agent-web
npm ci
npm run dev:all
```

打开 http://127.0.0.1:5173 。后端监听 http://127.0.0.1:8000，API 文档通过前端 `/api/docs` 访问。

也可分别运行后端 `./run-web-api` 与前端 `npm run dev`。已有服务占用端口时，不要重复启动。远程开发可通过 SSH 转发前端端口：

```bash
ssh -L 5173:127.0.0.1:5173 your-server
```

Vite 的代理目标使用启动进程环境变量 `PAPER_AGENT_API_URL`；例如 `PAPER_AGENT_API_URL=http://127.0.0.1:8002 npm run dev`。后端路径由 `PAPER_AGENT_BACKEND_DIR` 指定，运行解释器由 `PAPER_AGENT_RUNTIME_PYTHON` 指定，默认沿用项目的 xinghao 环境。

## 当前功能

- 自动发现默认项目根目录中的已有工作流；支持新建、导入和搜索项目。
- 11 个研究阶段导航、报告和公式渲染、图片与 PDF 预览、文件下载。
- 本地加载 Monaco 编辑器；文件保存前检查 SHA256，运行期间禁止从界面修改产物；未保存内容离开时确认。
- 自动 / 专家模式、起始与停止节点、恢复节点、运行参数设置。
- 专家摘要、研究问题与反馈提交；提交和实际执行前均核对产物版本。
- 独立进程执行、停止进程树、持久化事件、SSE 自动重连、轮询兜底。
- 实验 manifest 任务表、运行日志、运行历史。
- 识别 CLI 启动的工作流并展示终端来源，不接管其生命周期。

## 开发结构

```text
src/
  app/                 # 应用布局、路由、主题
  api/                 # 请求封装、OpenAPI 生成的接口类型
  components/          # 共用视图组件
  features/projects/   # 项目列表和创建/导入
  features/workbench/  # 工作台、运行配置、产物编辑、专家审阅
  lib/                 # 通用格式化函数
scripts/               # 开发启动、接口类型生成、隔离测试服务
tests/                # Playwright 端到端回归
deploy/               # nginx / systemd 部署示例
```

```bash
npm run api:generate  # 后端请求协议变动后重新生成类型，无需启动服务
npm run typecheck
npm run lint
npm run format:check
npm run build
npx playwright install chromium
npm test
```

如果机器已有 Chromium，可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome npm test` 指定。测试使用临时项目目录和独立端口 8001/5174，审阅运行请求由浏览器拦截，不启动真实模型或 GPU 实验。

## 运行与部署边界

本版本面向单用户本机 / SSH 隧道使用。API 默认仅监听回环地址并限制 Host 与 Origin，尚未提供登录、租户权限或公开网络访问入口。`deploy/` 提供构建后静态文件与 API 同源部署示例；正式远程部署应接入现有身份认证层。

Web 运行采用全局单项目并发策略，项目内并发交给已有实验调度器。终端 CLI 仍可独立运行：Web 启动前会检测已登记项目的终端进程，但无法阻止用户随后从终端另启任务；同一项目应统一选择一种运行入口。

“停止运行”会请求中断执行进程及其子进程，并保留已保存文件；恢复通过已有节点入口和实验回执继续，不承诺恢复未落盘的模型对话或训练内存。浏览器关闭、API 正常重启不影响独立研究进程；机器重启后会标记为已中断，不自动重启实验。

实验页目前展示任务定义，完成状态仍应结合 tracker、日志和回执确认。Wiki 图谱、多用户、跨项目 GPU 调度、配置编辑和指标对比为后续扩展。

后端管理数据默认位于 `../paper-agent/.paper-agent/web/`。备份时一并保存该目录和研究项目文件；这部分数据不是前端构建产物。

## 当前公网部署

- 前端：`https://www.xora.top`（Vercel，框架 Vite，Node.js 22）。
- `/api/*` 通过 Vercel 外部 rewrite 转发到 `https://api.xora.top/api/*`，浏览器保持同源请求。
- 后端：Cloudflare Tunnel → `127.0.0.1:8000`；隧道重写 Host 为 `localhost`。
- 单用户登录：scrypt 密码摘要、12 小时服务端会话、HttpOnly/Secure/SameSite Cookie、登录限速、Origin 校验。下载、日志、事件流及 API 文档同样受保护。
- 配置和凭据：`~/.config/paper-agent/`；初始登录信息位于该目录下的 `login.txt`，仅所有者可读。不要提交或发送 Tunnel 凭据。
- 服务：`paper-agent-api.service`、`paper-agent-tunnel.service`，均为用户 systemd 服务；已启用 linger。

```bash
systemctl --user status paper-agent-api paper-agent-tunnel
journalctl --user -u paper-agent-api -u paper-agent-tunnel -n 100
systemctl --user restart paper-agent-api
```

网络连通检查使用 `/api/auth/session`；未登录请求 `/api/health` 应返回 401。API 重启会保留研究进程及已落盘的登录会话。Tunnel 重启不会终止研究进程，事件连接会重连。修改密码摘要后应清空管理数据库中的 `web_sessions` 以撤销旧会话。

Vercel 项目目前通过 CLI 部署，GitHub 集成尚未获得新私有仓库权限。需要自动部署时，在 GitHub 为 Vercel App 授权 `Huang-Xinghao/paper-agent-web`，再连接仓库。不要从携带不被 Vercel 识别的 Git 作者信息的目录直接部署；可以将源码复制到不含 `.git` 和任何 `.env*` 的临时目录，复制 `.vercel/project.json` 后执行 `vercel deploy --prod`。

## 论文、图片和专家问答

- 在项目的“阶段产物”文件选择器或“项目文件”中打开 `.tex`：使用 LaTeX 高亮编辑器与已有 PDF 双栏对照，支持全屏、PDF 文件选择、源码保存和未保存离开保护。窄屏采用上下布局。保存源码不会编译 PDF，界面会提示源码与 PDF 可能不同步；重新生成 PDF 使用“继续研究 → 起始节点 → 编译交付”，如仅需该阶段也将“运行至”设为“编译交付”。这沿用真实工作流，会调用现有工具，请核对运行参数。
- “图片画廊”集中查看 PNG/JPEG/WebP，点击打开缩放、旋转及前后切换预览。Markdown 内的相对图片路径只解析到已登记的项目图片，不自动加载外部链接或 SVG。
- “协作方式设置”打开启动/继续窗口，可选择专家或自动模式；切换在下一次节点运行时生效，不修改正在执行的任务。已有待审阅检查点必须先完成审阅。专家问题仅在阶段完成并等待审阅时出现，顶部“查看问题并回答”可直接跳转。
