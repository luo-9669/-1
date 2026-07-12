# 流程通本地开发说明

## 启动

```bash
pnpm run install:all
pnpm run dev:all
```

- 前台产品工作台：http://localhost:5588
- 后端 API / 后台管理台：http://localhost:5599

## 完整部署

完整部署不是纯前端静态部署，需要同时部署前端、后端 Node 服务、模型通道和 Chrome/Chromium。

- 环境变量模板：[.env.production.example](.env.production.example)
- 完整部署说明：[docs/deployment/full-deploy.md](docs/deployment/full-deploy.md)

本地 Mac 已跑通时可以继续使用当前 Codex / CC Switch / `codex-cli` 通道；服务器部署时推荐用部署平台 Secret 配置 `WORKFLOW_AGENT_PROVIDER=openai-compatible`、`OPENAI_API_KEY`、`OPENAI_BASE_URL` 和模型名。真实 key 不要提交到 GitHub。

部署安装依赖请使用 `pnpm run install:all`，不要只执行根目录 `pnpm install`；Linux 服务器需要 Chrome/Chromium。可执行 `pnpm run install:browsers` 安装 Playwright Chromium，或使用系统 Chrome/Chromium 并配置 `CHROME_EXECUTABLE`。

## 当前发布门禁

默认测试命令只覆盖当前有效产品方向，重点保护高级 UX Markdown-first 流程、统一 Agent、画布导入、workspace hydration、系统 Skill 和联网 Evidence Pack。

```bash
pnpm test
pnpm run build
git diff --check
```

`pnpm test` 当前执行：

```bash
node --test tests/workflow-agent-actions.test.mjs backend/routes/workspace.test.js tests/system-skills.test.mjs tests/web-evidence-search.test.mjs
```

## 本地数据边界

不要提交本地运行数据或生成产物：

- `.git/`
- `node_modules/`
- `dist/`
- `backend/storage/workspace/*.json`
- `backend/storage/workspace/generated-images/`
- `backend/storage/auth-states/`
- 日志、临时文件和个人导出包
