# 流程通完整部署说明

本文档用于完整部署流程通，而不是只部署前端静态页面。完整能力需要前端、后端 Node 服务、模型通道和 Chrome/Chromium。

## 部署目标

- 前端：Vue/Vite 构建产物。
- 后端：Node API 服务，默认端口 `5599`。
- 模型：后端统一调用，普通用户不需要也不应该在前端填写系统 key。
- 浏览器能力：Chrome/Chromium 用于网页抓取、截图、PDF、图片转代码等能力。

## 推荐模型配置

生产环境推荐用服务器环境变量配置 OpenAI-compatible 模型：

```bash
WORKFLOW_AGENT_PROVIDER=openai-compatible
OPENAI_API_KEY=当前可用的模型 key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
OPENAI_API_SURFACE=responses
OPENAI_TIMEOUT_MS=600000
```

这套配置只存在服务器环境变量或部署平台 Secret 里，不要提交到 GitHub。

## 本地 Codex / CC Switch 模式

本地 Mac 已经跑通时，可以继续使用当前本机配置：

```bash
WORKFLOW_AGENT_PROVIDER=codex-cli
CODEX_DEFAULT_MODEL=gpt-5.5
CODEX_TIMEOUT_MS=600000
```

如果要让后端直接读取当前 Codex / CC Switch 关联的上游 HTTP 模型，可显式使用：

```bash
WORKFLOW_AGENT_PROVIDER=codex-proxy
CODEX_CONFIG_PATH=/path/to/.codex/config.toml
CODEX_AUTH_PATH=/path/to/.codex/auth.json
CODEX_CC_SWITCH_DB_PATH=/path/to/.cc-switch/cc-switch.db
```

`codex-proxy` 适合部署在同一台已经配置好 Codex 或 CC Switch 的机器上。换到新的服务器时，那台服务器也必须有对应配置文件或改用 `openai-compatible` 环境变量。

## Key 写在哪里

正确位置：

- 服务器环境变量。
- 部署平台 Secret。
- 仅管理员可访问的后端模型配置页，作为补救和测试入口。

不要做：

- 不要把真实 key 写进 GitHub。
- 不要让普通用户在业务页面里填写系统 key。
- 不要把 key 写进 `VITE_*` 前端变量。

前端只显示脱敏状态，例如 `sk-***abcd`。真实 key 只在后端使用。

## Chrome / Chromium

Mac 本地默认路径：

```bash
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Linux 服务器需要安装 Chromium，并配置：

方式 A：使用项目脚本安装 Playwright Chromium：

```bash
pnpm run install:browsers
```

如果服务器缺少浏览器系统依赖，可改用：

```bash
pnpm run install:browsers:deps
```

安装完成后查看实际路径：

```bash
find ~/.cache/ms-playwright -path '*chrome-linux*/chrome' -type f | head -1
```

把输出路径写入 `.env.production`：

```bash
CHROME_EXECUTABLE=/root/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
```

方式 B：使用系统 Chromium：

Ubuntu 22.04 可先尝试：

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
```

如果系统提示 `chromium-browser` 来自 snap 或不可用，可改用：

```bash
sudo snap install chromium
```

安装完成后必须确认真实可执行路径：

```bash
which chromium
which chromium-browser
which google-chrome
```

哪个命令有输出，就把该路径写入 `.env.production`。

```bash
CHROME_EXECUTABLE=/usr/bin/chromium-browser
```

或：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

如果没有配置 Chrome/Chromium，网页抓取、截图、PDF、图片转代码等能力会失败。

## 安装与启动

不要只执行根目录 `pnpm install`。本项目是前后端分目录依赖，安装依赖必须使用：

```bash
pnpm run install:all
```

安装浏览器运行时：

```bash
pnpm run install:browsers
```

构建前端：

```bash
pnpm run build
```

启动后端：

```bash
pnpm --prefix backend run api
```

本地或服务器临时联调时，可同时启动前后端：

```bash
pnpm run dev:all
```

生产环境建议用进程管理器守护后端，例如 `pm2`：

```bash
npm install -g pm2
pm2 start "pnpm --prefix backend run api" --name liuchengtong-api
pm2 save
```

前端构建产物在 `frontend/dist`，可以交给 Nginx、静态托管服务或同域反向代理。

## 前端 API 地址

生产构建前配置：

```bash
VITE_API_BASE_URL=https://your-api.example.com
VITE_AI_API_BASE_URL=https://your-api.example.com
VITE_CAPTURE_API_BASE_URL=https://your-api.example.com
VITE_KNOWLEDGE_API_BASE_URL=https://your-api.example.com
VITE_SEARCH_API_BASE_URL=https://your-api.example.com
VITE_COMPETITOR_API_BASE_URL=https://your-api.example.com
```

如果前端和后端同域反代，可以把这些地址留空或指向同域 API。

## 验证

部署前本地验证：

```bash
pnpm test
pnpm run build
git diff --check
```

部署后验证：

1. 后端启动后访问 API 服务地址，确认服务进程未退出。
2. 打开前端系统设置，点击“读取后端配置”。
3. 确认模型供应商和脱敏 key 状态。
4. 点击“测试模型”，应返回“模型连通：通过”。
5. 新建高级 UX 分析，确认 Agent 生成 Markdown 文件，画布随后导入。
6. 测试需要浏览器能力的功能时，确认服务器已安装并配置 Chrome/Chromium。

## 常见问题

### 写了 `.env` 但模型没通

确认后端进程是在项目根目录启动，且变量名是后端读取的变量，例如 `OPENAI_API_KEY`，不是 `VITE_OPENAI_API_KEY`。

### 本地能跑，服务器不能跑

本地可能走的是 `codex-cli` 或 CC Switch。服务器没有你的本机登录态和配置文件，需要重新配置环境变量，或复制并正确设置 Codex / CC Switch 配置路径。

### 页面里保存 key 后仍失败

优先检查：

- 供应商是否选为 `openai-compatible`、`codex-cli` 或 `codex-proxy`。
- Base URL 是否以 `/v1` 结尾。
- API Surface 是否与服务兼容，推荐 `responses`。
- 后端存储目录是否可写。

### GitHub 里没有 key

这是正确状态。GitHub 只保存源码和模板，真实 key 由部署环境注入。
