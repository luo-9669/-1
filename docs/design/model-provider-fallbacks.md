# 模型供应商备用方案

本文档记录当前工作流分析的模型接入方案，便于后续按口令快速切换。

## 当前默认方案：Codex CLI 内部认证通道

当前工作流分析默认走本机 Codex CLI，由 Codex App/CLI 自己复用内部认证和模型 provider。该方案用于绕过普通后端 HTTP 调用 `gpt-5.5` 时返回「请使用 Codex 客户端」的问题。

- provider: `codex-cli`
- baseUrl: 当前项目根目录；代码中复用该字段作为 `codex exec -C` 工作目录
- defaultModel: `gpt-5.5`
- apiSurface: `codex.exec`
- timeoutMs: `600000`
- fallback: `deterministic`
- apiKey: 不需要；认证由 Codex CLI/App 管理

保存接口：

```bash
curl -X PUT http://localhost:5299/api/workspace/model-settings \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "codex-cli",
    "apiKey": "__KEEP__",
    "baseUrl": "/Users/cds-dn-868/Desktop/流程通区分前后端",
    "defaultModel": "gpt-5.5",
    "apiSurface": "codex.exec",
    "timeoutMs": 600000,
    "fallback": "deterministic",
    "enabled": true
  }'
```

实现方式：

- 后端新增 `codex-cli` provider。
- 调用 `codex exec --ephemeral --skip-git-repo-check --sandbox read-only --model gpt-5.5 -C <project> --json -`。
- 后端把 Codex JSONL 事件转成现有模型 provider 的 `delta/final` 事件。
- 前端仍走原 SSE 链路：先显示 loading，再展示阶段文字，最终用模型 JSON 生成画布。

限制：

- 这是本地/内部工具通道，不是标准 OpenAI HTTP API。
- 启动 Codex 代理比普通模型 API 慢，并发能力也更弱。
- `--json` 输出的是 Codex 运行事件，不保证 token 级实时流；前端可以先显示阶段进度，最终收到 agent message 后入画布。

## 指定备用方案：URL 直连 GPT-5.5

当用户明确说「切换 url gpt5.5 模型」或「启用 URL GPT-5.5 方案」时，恢复以下配置：

- provider: `openai-compatible`
- baseUrl: `https://ai-platform-cicada-llm-api.limayao.com/v1`
- defaultModel: `gpt-5.5`
- apiSurface: `chat.completions`
- timeoutMs: `600000`
- fallback: `deterministic`
- allowInsecureTLS: `true`
- apiKey: 使用已保存的真实 key；文档中不记录明文 key。

保存接口：

```bash
curl -X PUT http://localhost:5299/api/workspace/model-settings \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "openai-compatible",
    "apiKey": "__KEEP__",
    "baseUrl": "https://ai-platform-cicada-llm-api.limayao.com/v1",
    "defaultModel": "gpt-5.5",
    "apiSurface": "chat.completions",
    "timeoutMs": 600000,
    "fallback": "deterministic",
    "allowInsecureTLS": true,
    "enabled": true
  }'
```

## 已知限制

当前实测结果：该 URL 下 `gpt-5.5` 会返回「请使用 Codex 客户端」，说明普通后端 HTTP 调用可能被模型服务限制。代码里保留了这个错误分类：

- error code: `LLM_CODEX_CLIENT_REQUIRED`
- message: `当前模型要求 Codex 客户端通道，后端普通 HTTP 调用不可用`

后续如果模型服务放开直连、切换到可用代理，或用户明确要求继续用 GPT-5.5，即按本方案启用，不删除相关代码。

## 切换后验证

```bash
curl -sS http://localhost:5299/api/workspace/model-settings

curl -X POST http://localhost:5299/api/workspace/model-settings/test \
  -H 'Content-Type: application/json' \
  -d '{"input":"ping"}'
```

如果连通性测试失败但仍然显示 `model: gpt-5.5`，说明方案已启用，只是模型服务当前拒绝普通后端调用。

## 历史备用方案：CCswitch 本地代理

旧方案来自本机 Codex/CCswitch 配置和历史会话记录，用于通过本机代理接入模型：

- provider: `openai-compatible`
- baseUrl: `http://127.0.0.1:15721/v1`
- defaultModel: `gpt-5.5`
- apiSurface: `responses`
- apiKey: `PROXY_MANAGED`
- timeoutMs: `180000` 或按当前项目调到 `600000`
- enabled: `true`

对应 Codex 配置：

```toml
model_provider = "newapi"
model = "gpt-5.5"

[model_providers.newapi]
name = "NewAPI"
base_url = "http://127.0.0.1:15721/v1"
wire_api = "responses"
requires_openai_auth = true
```

历史后端常量形态：

```js
const CODEX_CCSWITCH_MODEL_SETTINGS = {
  provider: 'openai-compatible',
  apiKey: 'PROXY_MANAGED',
  baseUrl: 'http://127.0.0.1:15721/v1',
  defaultModel: 'gpt-5.5',
  apiSurface: 'responses',
  timeoutMs: 180000,
  fallback: 'deterministic',
  enabled: true
}
```

旧记录里，`codex login status` 曾显示 `Logged in using ChatGPT`，`~/.codex/auth.json` 曾有 `tokens.access_token`。当时可用链路主要验证在图片生成：`POST /v1/responses` + `tools: [{ type: "image_generation" }]` 成功，`/v1/images/generations` 返回 404。

当前实测状态：

- `cc-switch` 进程仍监听 `127.0.0.1:15721`
- 当前 `~/.codex/config.toml` 仍指向 `newapi` / `http://127.0.0.1:15721/v1`
- 当前 `~/.codex/auth.json` 只有 `OPENAI_API_KEY`，没有旧记录里的 `tokens.access_token`
- 当前直接请求 `http://127.0.0.1:15721/v1/responses` 会返回 `403 openai_error`

因此，后面如果要启用 CCswitch 方案，需要先恢复 CCswitch/ChatGPT 登录态或确认本地代理允许项目后端调用。用户如果说「切换 ccswitch 方案」，优先按本节配置保存；如果测试失败，再检查 `codex login status`、`~/.codex/auth.json` 和 `cc-switch` 代理授权状态。
