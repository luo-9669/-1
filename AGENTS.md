## 项目概述

流程通（liuchengtong-workspace）是一个工作流/流程管理 Web 应用，支持 Markdown-first 流程编排、统一 Agent 调度、画布导入、workspace hydration、系统 Skill 和联网 Evidence Pack 等能力。前后端分离架构。

## 技术栈

- **前端**：Vue 3 + Vite 5 + Element Plus + lucide-vue-next
- **后端**：Node.js (ESM) 原生 HTTP 服务，无框架依赖
- **浏览器自动化**：playwright-core（用于网页截图/抓取）
- **测试**：node --test（内置测试运行器）
- **包管理**：pnpm（平台要求，原项目使用 npm）

## 目录结构

```
/workspace/projects/
├── frontend/              # Vue 3 前端 SPA
│   ├── src/
│   │   ├── App.vue        # 根组件（主入口，含路由和布局）
│   │   ├── main.js        # Vue 应用入口
│   │   ├── pages/         # 页面模块（workflow, diagnosis, diagrams, knowledge, projects, settings, skill-center, factory, competitor-analysis, design-system）
│   │   ├── components/    # 公共组件（base, layout, DataList, ListHeader, Notice, StatusBadge）
│   │   ├── features/      # 功能模块
│   │   ├── services/      # 前端服务层（API 调用）
│   │   ├── styles/        # 样式文件
│   │   ├── styles.css     # 全局样式
│   │   └── designRules.js # 设计规则
│   ├── index.html
│   └── vite.config.js     # Vite 配置（端口 5588，代理 /api 到后端）
├── backend/               # Node.js 后端 API
│   ├── server/
│   │   ├── mock-api.mjs   # 后端主入口（HTTP 服务 + 路由分发）
│   │   ├── http-server.mjs
│   │   ├── server-config.mjs
│   │   ├── env-loader.mjs
│   │   ├── model-provider.mjs
│   │   ├── route-matcher.mjs
│   │   └── sse.mjs
│   ├── routes/            # API 路由处理（admin, auth, capture, competitors, diagrams, uploads, workflows, workspace）
│   ├── services/          # 业务服务（agent, workflow-runner, workspace-store, llm-provider, diagram-generator, document-parser, capture, competitor-analysis 等）
│   ├── models/            # 数据模型
│   └── storage/           # 本地存储（workspace JSON, 生成图片, auth states）
├── docs/                  # 项目文档（部署、设计、图表、产品合同、技能）
├── scripts/               # 启动脚本（start-dev.mjs）
├── tests/                 # 集成测试
└── package.json           # 根 package.json（脚本入口）
```

## 关键入口 / 核心模块

- **前端入口**：`frontend/src/main.js` → `frontend/src/App.vue`
- **后端入口**：`backend/server/mock-api.mjs`（端口 5599）
- **前端构建**：`vite build`（输出到 frontend/dist）
- **API 代理**：前端 Vite dev server 将 `/api` 请求代理到后端 5599 端口
- **核心服务**：
  - `backend/services/workflow-runner.js` - 工作流执行引擎
  - `backend/services/workspace-store.js` - 工作区数据存储
  - `backend/services/agent-service.js` - Agent 调度
  - `backend/services/llm-provider.js` - LLM 模型接入
  - `backend/services/diagram-generator.js` - 图表生成
  - `backend/services/total-design-flow.js` - 设计流程引擎

## 运行与预览

- **开发启动**：前后端同时启动，前端 5588 端口，后端 5599 端口
- **前端代理**：Vite 自动将 `/api` 代理到后端
- **预览**：通过 Vite dev server 预览前端页面
- **测试**：`node --test tests/*.test.mjs backend/routes/*.test.js`
- **构建**：`pnpm --filter liuchengtong-frontend run build`
- **干净安装**：`pnpm install --frozen-lockfile`；`pnpm-workspace.yaml` 中的 `allowBuilds.esbuild: true` 和 `postcss: 8.5.16` override 是部署构建契约，不要移回 `package.json` 或删除。

### 预览链路配置

本项目被判定为 Web 预览型项目，因为前端是 Vue 3 SPA 应用，需要通过浏览器直接访问和交互验证。

**预览链路**：
- 根 `.coze` 位于 `/workspace/projects/.coze`
- 子项目 `.coze`：`frontend/.coze`（web 类型，可预览）、`backend/.coze`（后端服务，不可预览）
- 预览脚本位于 `scripts/` 目录：
  - `scripts/coze-preview-build.sh` - 安装依赖
  - `scripts/coze-preview-run.sh` - 启动 Vite dev server 在 5000 端口
- 根 `.coze` 的 `[dev]` 命令指向根目录脚本，脚本内部进入 `frontend/` 子目录执行预览
- 预览服务监听 `0.0.0.0:5000`（IPv4 全接口）

**注意事项**：
- 预览只启动前端 Vite dev server，后端 API 服务不会自动启动
- 前端页面中的 API 调用在预览环境下可能无法正常工作（因为后端未启动）
- 如需完整功能测试，需要同时启动后端服务（端口 5599）

### 部署配置

本项目部署时需要同时提供前端静态文件和后端 API 服务。

**部署架构**：
- 后端服务监听 5000 端口，同时提供：
  - API 服务（`/api/*` 路由）
  - 静态文件服务（`frontend/dist` 目录）
- 前端构建产物位于 `frontend/dist`
- 后端通过 `static-file-server.mjs` 模块提供静态文件服务

**部署脚本**：
- `scripts/coze-deploy-build.sh` - 安装依赖并构建前端
- `scripts/coze-deploy-run.sh` - 启动后端服务（监听 5000 端口）

**关键文件**：
- `backend/server/static-file-server.mjs` - 静态文件服务模块
- `backend/server/api-handler.mjs` - API 请求处理（集成静态文件服务）

**注意事项**：
- 部署前必须执行 `coze-deploy-build.sh` 构建前端产物
- 后端服务会同时提供 API 和静态文件，无需额外的静态文件服务器
- 环境变量通过 `.env` 文件或部署平台 Secret 配置

## 用户偏好与长期约束

- Node.js 项目使用 pnpm 管理依赖（平台要求）
- 后端为纯 Node.js HTTP 服务，不引入 Express 等框架
- 前端使用 Vue 3 Composition API + Element Plus 组件库
- 环境变量通过 `.env` 文件管理，参考 `.env.example` 和 `.env.production.example`
- 本地数据不提交（workspace JSON、生成图片、auth states、日志等）
- 新对话继续开发时先 `git pull` 最新 `main`，确认不要回退模型 curl fallback、`/api/workspace/storage-status`、高级 UX 10 节点阶段产出、图片转 HTML 临时预览等待、pnpm 构建策略。

## 常见问题和预防

- 后端启动依赖环境变量（模型 API key 等），缺失时部分功能不可用
- Playwright/Chromium 用于网页截图，部署时需要安装浏览器依赖
- 前端 App.vue 文件较大（~892KB），包含主要路由和布局逻辑
- 后端 mock-api.mjs 文件较大（~102KB），是核心路由分发入口
- `single-file-cli` 用于网页抓取，依赖 Chrome/Chromium
- 图片转 HTML 的临时预览路由 `image-html-*` 必须保持 15 秒轮询、无前端最大等待时间，并保留 `standalonePreviewLoadToken` 防止刷新/水合产生的旧等待循环覆盖当前 iframe；相关 contract 在 `docs/product-contracts/frontend-backend-handoff.md`。
