# Workflow Agent Provider Design

## Goal

把方案流程画布右侧 Agent 做成真正的前后端项目链路：前端只发送用户动作和上下文，后端接管会话、上下文组装、模型调用、持久化和错误恢复；先完成可测的本地 Provider，再接真实 OpenAI/兼容模型 Provider。

## Scope

阶段 1 完成产品级工程骨架：

- 前端所有 Agent 发送入口统一走后端 `/api/workspace/workflow-runs/:id/messages`。
- 后端拆出 Agent 服务、上下文构建器和 LLM Provider 边界。
- Deterministic Provider 保留当前可回放反馈能力，用于本地开发、测试和模型不可用时降级。
- 后端响应统一返回 `run`、`assistantMessage`、`actionResult`、`usage`、`provider`。

阶段 2 完成真实模型接入：

- 后端提供 OpenAI Compatible Provider。
- 默认优先使用 Responses API；当配置为 `chat.completions` 时走 Chat Completions 兼容模式。
- 前端不接触 API key、base URL 或具体模型 API。
- 模型失败时返回可恢复错误，并支持自动降级到 Deterministic Provider。

## Architecture

前端仍由 `src/App.vue` 和 `WorkflowAgentDrawer.vue` 负责 UI 状态。前端只传递 `runId`、`stepId/nodeId`、用户消息、引用资料、模型选择和当前画布上下文，不拼 prompt，不生成最终 Agent 回复。

后端由 `后端/routes/workflows.js` 接收请求，委托 `后端/services/workflow-runner.js` 更新 run。`workflow-runner` 不再直接生成 Agent 文案，而是调用 `agent-service`。`agent-service` 调用 `agent-context-builder` 构造模型上下文，再调用 `llm-provider`。Provider 输出统一归一化为 assistant message 和 action result 后持久化。

模型 Provider 是可替换边界。`deterministic` provider 用本地规则生成稳定输出；`openai-compatible` provider 使用后端环境变量调用 OpenAI Responses API 或 Chat Completions API。业务层只依赖 `provider.generate(context)`。

## Responsibilities

前端接管：

- 画布节点聚焦、右侧抽屉开合、输入框、快捷按钮和模型下拉展示。
- 请求 loading、失败重试和错误提示。
- 引用文件的本地读取和上传入口。
- 展示后端返回的消息，不自行生成成功文案。

后端接管：

- action 分类，例如 `module-breakdown`、`priority-adjustment`、`page-generation`、`confirmation`。
- Agent 上下文构建，包括 run、step、activeNode、references、history、model。
- Provider 选择、模型调用、超时、错误归一化、降级。
- user/assistant 消息持久化。
- 响应结构和恢复建议。

LLM Provider 接管：

- `deterministic`：本地、稳定、可测、无外部依赖。
- `openai-compatible`：后端环境变量配置，真实调用模型。
- 输出统一字段：`content`、`usage`、`provider`、`model`、`raw`。

## Data Contract

前端请求：

```json
{
  "stepId": "framework",
  "model": "gpt-4.1-mini",
  "message": { "role": "user", "content": "拆模块" },
  "references": [
    { "id": "file-1", "name": "PRD.docx", "kind": "document", "status": "ready", "text": "..." }
  ],
  "context": {
    "currentStepId": "podcast-diagnosis",
    "activeNode": {
      "id": "framework",
      "title": "产品框架",
      "summary": "模块、页面和能力结构。",
      "content": ["首页创作入口：Generate Script / Upload Script"]
    },
    "blueprintTab": "framework",
    "parsedDocuments": 1
  }
}
```

后端响应：

```json
{
  "run": {},
  "assistantMessage": {
    "id": "assistant-...",
    "role": "assistant",
    "content": "【产品框架｜模块拆解】...",
    "createdAt": "2026-06-21T00:00:00.000Z"
  },
  "actionResult": {
    "type": "module-breakdown",
    "nodeId": "framework",
    "nodeTitle": "产品框架",
    "suggestions": ["入口模块", "编辑生成模块"]
  },
  "usage": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0 },
  "provider": "deterministic"
}
```

错误响应由 API wrapper 转成失败状态，后端错误对象应包含：

```json
{
  "code": "LLM_PROVIDER_FAILED",
  "message": "模型服务暂时不可用",
  "recoveryActions": ["稍后重试", "切换模型", "使用本地生成器兜底"]
}
```

## Environment

后端环境变量：

- `WORKFLOW_AGENT_PROVIDER`: `auto`、`deterministic`、`openai-compatible`。
- `OPENAI_API_KEY`: 模型 API key。
- `OPENAI_BASE_URL`: 默认 `https://api.openai.com/v1`。
- `OPENAI_DEFAULT_MODEL`: 默认 `gpt-4.1-mini`，前端传入模型时优先使用前端模型。
- `OPENAI_API_SURFACE`: `responses` 或 `chat.completions`，默认 `responses`。
- `OPENAI_TIMEOUT_MS`: 默认 `20000`。
- `WORKFLOW_AGENT_FALLBACK`: `deterministic` 或 `none`，默认 `deterministic`。

## Testing

- 服务测试验证 deterministic provider 输出稳定结构。
- 服务测试验证 OpenAI provider 对 Responses 和 Chat Completions 响应都能归一化。
- 路由测试验证 `/messages` 返回 `assistantMessage/actionResult/provider/usage/run`。
- 前端源码测试验证 `context: workflowAgentRequestContext()` 会随请求发送，且不会先本地追加假 user/assistant 消息。
- 浏览器验证点击 `拆模块 / 调整优先级 / 生成页面 / 确认框架` 不串台、不重复消息、不 500。

## Source Notes

OpenAI 官方文档建议新项目使用 Responses API；Chat Completions 仍可生成基于 messages 的对话响应，但新项目建议优先尝试 Responses API。Provider 因此默认 Responses，并保留 Chat Completions 兼容模式。
