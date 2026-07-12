import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

function zeroUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
}

function resolveTimeoutMs(value, fallback = 0) {
  if (value === 0) return 0
  const resolved = Number(value || fallback || 0)
  return Number.isFinite(resolved) && resolved > 0 ? resolved : 0
}

function buildActionResult(context = {}) {
  const base = {
    type: context.actionType,
    nodeId: context.scopeId,
    nodeTitle: context.node?.title || '当前环节',
    model: context.model,
    referenceCount: context.references?.length || 0,
    generatedAt: context.now
  }
  if (context.actionType === 'module-breakdown') {
    base.suggestions = ['入口模块', '编辑生成模块', '资产沉淀模块', '分发增长模块']
  } else if (context.actionType === 'priority-adjustment') {
    base.suggestions = ['先保留一期闭环', '推迟增长型能力', '补齐验收指标']
  } else if (context.actionType === 'page-generation') {
    base.suggestions = ['首页创作入口', '核心编辑器', '作品库', '设置与异常状态']
  } else if (context.actionType === 'confirmation') {
    base.confirmed = true
  } else if (context.actionType === 'blueprint') {
    base.suggestions = ['产品档案', '产品框架', '交互路径', '页面框架', '验收清单']
  } else if (context.actionType === 'supplement-detail' || context.actionType === 'canvas-action-advice') {
    base.suggestions = ['补齐需求边界', '补充验收标准', '补充交互状态', '补充接口约束']
  }
  return base
}

function deterministicContent(context = {}) {
  const title = context.node?.title || '当前环节'
  const summary = context.node?.summary || '围绕当前小画板继续补充。'
  const content = context.message?.content || ''
  const facts = (context.node?.content || []).slice(0, 3)
  const factText = facts.length
    ? `已纳入画布事实：${facts.join('；')}`
    : '待补事实：目标用户、触发入口、主流程、异常状态和验收标准。'

  if (context.actionType === 'module-breakdown') {
    return [
      `【${title}｜模块拆解】`,
      `我已收到“${content}”，会把「${summary}」拆成模块、页面和能力边界。`,
      factText,
      '可写入内容：入口模块、核心流程模块、资产沉淀模块、异常与权限模块。',
      '待确认：每个模块的负责人、P0/P1 优先级、前后端接口边界。'
    ].filter(Boolean).join('\n')
  }
  if (context.actionType === 'priority-adjustment') {
    return [
      `【${title}｜优先级调整】`,
      '我会按用户价值、实现复杂度、依赖关系和验收风险重新排序。',
      factText,
      '可写入内容：P0 保证主流程闭环，P1 补体验增强，P2 放增长和自动化能力。',
      '待确认：哪些能力没有它就无法验收，哪些能力可以进入二期。'
    ].join('\n')
  }
  if (context.actionType === 'page-generation') {
    return [
      `【${title}｜页面生成准备】`,
      '我会根据当前产品框架生成页面清单、关键控件、主按钮和异常状态。',
      factText,
      '可写入内容：页面名称、页面目标、核心控件、主按钮、空状态、异常状态。',
      '待确认：页面形态是页面、弹窗、抽屉还是新页签。'
    ].filter(Boolean).join('\n')
  }
  if (context.actionType === 'supplement-detail') {
    return [
      `【${title}｜补充分析】`,
      `详细分析：当前节点聚焦「${summary}」，需要把用户目标、关键场景、边界状态和交付口径补全，避免后续页面框架只停留在概念描述。`,
      factText,
      `需求缺口：${title} 还需要补齐核心用户、触发入口、主流程、异常状态、验收标准和前后端交接字段。`,
      '可写入内容：把以上缺口整理为当前节点的补充说明，确认后可合并进画布并刷新后续节点。',
      '待确认：是否采用这版补充，或继续补充业务资料后再生成。'
    ].join('\n')
  }
  if (context.actionType === 'canvas-action-advice') {
    const actionLabel = context.canvasAction?.action || context.message?.content?.match(/画布动作「([^」]+)」/)?.[1] || context.message?.content || '当前动作'
    const normalizedAction = actionLabel.replace(/\s+/g, '')
    if (/目标用户|用户人群|人群/.test(normalizedAction)) {
      return [
        `【${title}｜补目标用户】`,
        `详细建议：围绕「${summary}」，目标用户不要只写“所有用户”，需要拆成可设计、可验收的人群分层。`,
        factText,
        '用户分层：1. 未登录用户，需要快速理解登录价值并进入登录；2. 新注册用户，需要低摩擦完成账号创建；3. 忘记密码用户，需要安全找回并回到原任务；4. 需要第三方登录的用户，需要明确授权、绑定和失败处理。',
        '可补充内容：用户身份、进入场景、核心任务、顾虑点、成功标准、需要的权限或数据字段。',
        '可写入内容：把用户分层、场景触发和验收标准写入当前节点，用于后续页面结构、表单校验和接口契约。',
        '待确认：是否存在企业账号、手机号/邮箱限制、第三方登录范围和地区合规要求。'
      ].join('\n')
    }
    if (/调整定位|定位|页面定位|产品定位/.test(normalizedAction)) {
      return [
        `【${title}｜调整定位】`,
        `详细建议：当前节点应定位为「${summary}」的业务入口，而不是单纯的表单集合。`,
        factText,
        '定位表达：认证页面负责让用户安全进入系统、完成新账号创建，并在忘记密码或第三方授权失败时提供可恢复路径。',
        '设计判断：优先保证可信、安全、低摩擦；登录和注册可以共用弹窗容器，但必须区分主任务、次任务和异常恢复。',
        '可写入内容：页面定位、核心价值、适用场景、不包含范围、与后端账号体系的依赖关系。',
        '待确认：该认证入口是全站通用弹窗、独立页面，还是在业务流程中被动唤起。'
      ].join('\n')
    }
    if (/成功标准|验收标准|验收/.test(normalizedAction)) {
      return [
        `【${title}｜补成功标准】`,
        `详细建议：针对「${summary}」，成功标准需要同时覆盖用户完成度、异常恢复、前后端联调和安全约束。`,
        factText,
        '验收标准：1. 用户能完成登录、注册、忘记密码主流程；2. 表单错误、账号不存在、密码错误、验证码失败都有明确提示；3. 第三方登录失败可返回重试；4. 成功后能回到触发登录前的页面或任务；5. 前后端字段、错误码和埋点事件可对齐。',
        '可补充内容：成功率指标、关键路径耗时、错误提示规则、安全限制、接口返回码、埋点口径。',
        '可写入内容：把以上标准作为当前节点验收清单，并同步给后续表单校验、交互路径和接口契约节点。',
        '待确认：验证码、二次验证、账号锁定和第三方登录是否进入本期范围。'
      ].join('\n')
    }
    if (/接口契约|补接口|接口字段|接口|API|错误码|Mock|前后端/.test(normalizedAction)) {
      return [
        `【${title}｜补接口契约】`,
        `详细建议：针对「${summary}」，接口契约需要把前端状态、后端校验、错误码和 Mock 数据一次对齐。`,
        factText,
        '接口契约：1. 明确登录、注册、找回密码、第三方授权回调端点；2. 标注请求字段、返回字段、字段格式和必填规则；3. 统一账号不存在、密码错误、验证码过期、账号锁定、授权失败、频控和超时错误码。',
        '前后端分工：前端接管表单校验、loading、错误展示和回跳；后端接管认证校验、验证码、风控、token 签发和统一错误码。',
        '可写入内容：把端点、字段、错误码、Mock 示例和联调验收口径写入当前节点，并同步后续交接节点。',
        '待确认：是否需要手机号、邮箱、第三方登录、二次验证和地区合规字段。'
      ].join('\n')
    }
    if (/异常状态|补异常|错误态|空状态|加载态|失败态|权限态|恢复入口|状态/.test(normalizedAction)) {
      return [
        `【${title}｜补异常状态】`,
        `详细建议：针对「${summary}」，异常状态需要从触发条件、UI 反馈、后端条件和恢复入口四层补齐。`,
        factText,
        '状态清单：1. 提交 loading 防重复；2. 必填为空和格式错误字段级提示；3. 密码/验证码/第三方授权失败区域提示；4. 账号锁定、频控、权限限制安全说明；5. 网络超时和服务异常保留输入并允许重试。',
        '恢复入口：重新输入、重新获取验证码、切换登录/注册、返回登录、重新授权、联系客服或稍后重试。',
        '可写入内容：把状态名称、触发条件、提示方式、恢复入口和对应错误码写入当前节点。',
        '待确认：账号锁定、二次验证、频控和第三方授权是否进入本期。'
      ].join('\n')
    }
    if (/埋点指标|补埋点|埋点|指标|转化|事件|数据观察|漏斗/.test(normalizedAction)) {
      return [
        `【${title}｜补埋点指标】`,
        `详细建议：针对「${summary}」，埋点需要覆盖打开、提交、成功、失败、关闭和回流，支撑转化漏斗分析。`,
        factText,
        '事件建议：auth_modal_open、auth_login_submit、auth_login_success、auth_register_submit、auth_error_show、auth_third_party_fail、auth_modal_close。',
        '事件属性：entry_source、auth_mode、error_code、provider、is_new_user、duration_ms、redirect_target、experiment_id；禁止上报密码、验证码、token 或明文账号。',
        '可写入内容：把事件名、触发时机、事件属性、核心指标、漏斗影响和隐私边界写入当前节点。',
        '待确认：是否有实验分组、渠道来源和数据看板命名规范。'
      ].join('\n')
    }
    return [
      `【${title}｜动作建议】`,
      `详细建议：针对「${actionLabel}」，当前节点应围绕「${summary}」补出可执行、可验收、可写回画布的内容。`,
      factText,
      `可补充内容：1. ${actionLabel} 的目标与适用场景；2. 关键判断标准；3. 正常/异常/边界状态；4. 前后端或产品验收需要交接的字段。`,
      '可写入内容：把认可的建议合并到当前节点，并触发后续画布刷新。',
      '待确认：是否按这版内容入画布。'
    ].join('\n')
  }
  if (context.actionType === 'confirmation') {
    return [
      `【${title}｜已记录确认】`,
      '当前框架已作为后续路径树、页面框架图和交付文档的上游依据。',
      '可写入内容：确认当前节点作为后续产出的上游约束。',
      '待确认：是否继续补充边界条件。'
    ].join('\n')
  }
  if (context.actionType === 'blueprint') {
    return [
      `【${title}｜蓝图生成反馈】`,
      '我会把当前补充合并到项目蓝图，覆盖产品档案、结构树、页面框架、交互说明和验收清单。',
      '可写入内容：产品档案、结构树、页面框架、交互说明和验收清单。',
      '待确认：是否继续补充资料，或进入设计文档检查交付结构。'
    ].join('\n')
  }
  if (context.actionType === 'regenerate') {
    return [
      `【${title}｜重新生成要求已接收】`,
      `我会把“${content}”作为质疑条件，重新组织当前环节输出。`,
      factText,
      '可写入内容：重新生成后的判断依据、修正点和影响范围。'
    ].join('\n')
  }
  return [
    `【${title}｜上下文建议】`,
    `针对“${content || '当前问题'}”，建议先回到「${summary}」确认目标、边界、异常状态和验收标准。`,
    factText,
    '可写入内容：目标、边界、异常状态、验收标准。',
    '待确认：选择一个画布动作继续细化，或补充来源资料后再入画布。'
  ].join('\n')
}

function usageFromOpenAI(usage = {}) {
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? (inputTokens + outputTokens)
  }
}

function usageFromCodex(usage = {}) {
  const inputTokens = usage.input_tokens ?? usage.inputTokens ?? 0
  const outputTokens = usage.output_tokens ?? usage.outputTokens ?? 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? usage.totalTokens ?? (inputTokens + outputTokens)
  }
}

function extractResponseText(data = {}) {
  if (typeof data.output_text === 'string') return data.output_text
  const outputText = (data.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || item.content || '')
    .filter(Boolean)
    .join('\n')
  if (outputText) return outputText
  return data.choices?.[0]?.message?.content || ''
}

function parseJsonObject(value) {
  const text = String(value || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1])
    } catch {}
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {}
  }
  return null
}

function parseJsonLines(chunk = '', state = { buffer: '' }) {
  state.buffer += String(chunk || '')
  const lines = state.buffer.split(/\r?\n/)
  state.buffer = lines.pop() || ''
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function codexItemText(item = {}) {
  if (!item || typeof item !== 'object') return ''
  if (typeof item.text === 'string') return item.text
  if (typeof item.message === 'string') return item.message
  if (typeof item.content === 'string') return item.content
  if (Array.isArray(item.content)) {
    return item.content
      .map((part) => part?.text || part?.content || '')
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function codexProgressLabel(event = {}) {
  if (event.type === 'thread.started') return 'Codex 通道已建立'
  if (event.type === 'turn.started') return 'Codex 正在分析需求'
  if (event.type === 'turn.completed') return 'Codex 分析完成，正在生成画布'
  if (event.type === 'item.started') {
    const itemType = event.item?.type || ''
    if (itemType === 'reasoning') return 'Codex 正在梳理结构'
    if (itemType === 'agent_message') return 'Codex 正在整理输出'
    return 'Codex 正在处理'
  }
  return ''
}

function normalizeAgentModelText(text = '') {
  const parsed = parseJsonObject(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { content: text, proposal: null, quickReplies: [] }
  }
  const proposal = parsed.proposal || parsed.structuredProposal || parsed.agentProposal || null
  const quickReplies = normalizeAgentModelQuickReplies(
    parsed.quickReplies ||
    parsed.quick_replies ||
    parsed.suggestedReplies ||
    parsed.suggestedActions ||
    parsed.nextActions
  )
  const hasAgentEnvelope = Object.prototype.hasOwnProperty.call(parsed, 'content') ||
    Object.prototype.hasOwnProperty.call(parsed, 'answer') ||
    Object.prototype.hasOwnProperty.call(parsed, 'reply') ||
    quickReplies.length > 0
  if (!proposal && !hasAgentEnvelope) return { content: text, proposal: null, quickReplies }
  if (!proposal) return { content: parsed.content || parsed.answer || parsed.reply || parsed.message || text, proposal: null, quickReplies }
  return {
    content: parsed.content || parsed.message || parsed.answer || parsed.reply || text,
    proposal,
    quickReplies
  }
}

function normalizeAgentModelQuickReplies(replies = []) {
  const seen = new Set()
  return (Array.isArray(replies) ? replies : [])
    .map((reply) => {
      if (typeof reply === 'string') return reply
      if (!reply || typeof reply !== 'object') return ''
      return reply.label || reply.text || reply.title || reply.action || reply.content || ''
    })
    .map((reply) => String(reply || '').trim())
    .filter((reply) => {
      if (!reply || seen.has(reply)) return false
      seen.add(reply)
      return true
    })
    .slice(0, 6)
}

function uniqueActions(actions = []) {
  const seen = new Set()
  return actions
    .map((action) => String(action || '').trim())
    .filter((action) => {
      if (!action || seen.has(action)) return false
      seen.add(action)
      return true
    })
}

function providerErrorMessage(error = {}) {
  return String(
    error?.response?.error?.message ||
    error?.response?.message ||
    error?.cause?.message ||
    error?.message ||
    ''
  )
}

function providerErrorCauseDetails(error = {}) {
  const cause = error?.cause
  if (!cause || typeof cause !== 'object') return {}
  return {
    causeName: cause.name || '',
    causeCode: cause.code || '',
    causeMessage: cause.message || ''
  }
}

function createProviderError(message, fields = {}) {
  return assignProviderError(new Error(message), fields)
}

function assignProviderError(target, fields = {}) {
  Object.assign(target, fields)
  return target
}

function isTimeoutLikeProviderError(error = {}) {
  const message = providerErrorMessage(error)
  return /AbortError|aborted|timeout|timed?\s*out|超时|取消/i.test(`${error?.name || ''} ${message}`)
}

export function normalizeModelProviderError(error = {}, context = {}) {
  const sourceMessage = providerErrorMessage(error)
  const status = error?.status || error?.response?.status || context.status
  const model = error?.model || context.model || ''
  const apiSurface = error?.apiSurface || context.apiSurface || ''
  const provider = error?.provider || context.provider || 'openai-compatible'
  const timeoutMs = error?.timeoutMs || context.timeoutMs
  const response = error?.response || context.response
  const knownCode = String(error?.code || '')

  if (knownCode && knownCode !== 'LLM_PROVIDER_FAILED') {
    const message = error?.message || sourceMessage || '模型服务暂时不可用'
    return assignProviderError(new Error(message), {
      code: knownCode,
      message,
      recoveryActions: uniqueActions(error.recoveryActions || context.recoveryActions || ['重试', '检查配置']),
      provider,
      model,
      apiSurface,
      ...(status ? { status } : {}),
      ...(timeoutMs ? { timeoutMs } : {}),
      ...(response ? { response } : {})
    })
  }

  if (isTimeoutLikeProviderError(error)) {
    return assignProviderError(new Error('模型请求超时，请调大 timeout 或重试'), {
      code: 'LLM_PROVIDER_TIMEOUT',
      message: '模型请求超时，请调大 timeout 或重试',
      recoveryActions: ['调大 timeout', '重试'],
      provider,
      model,
      apiSurface,
      ...(status ? { status } : {}),
      ...(timeoutMs ? { timeoutMs } : {}),
      ...(response ? { response } : {})
    })
  }

  if (/请使用\s*Codex\s*客户端|use\s+Codex\s+client/i.test(sourceMessage)) {
    return assignProviderError(new Error('当前模型要求 Codex 客户端通道，后端普通 HTTP 调用不可用'), {
      code: 'LLM_CODEX_CLIENT_REQUIRED',
      message: '当前模型要求 Codex 客户端通道，后端普通 HTTP 调用不可用',
      recoveryActions: ['切换为后端可调用模型', '改用 Codex 客户端代理通道'],
      provider,
      model,
      apiSurface,
      ...(status ? { status } : {}),
      ...(response ? { response } : {})
    })
  }

  if (/api[_\s-]?key|unauthorized|invalid key|missing key|无效的令牌|invalid token|未配置|鉴权|认证|401|403/i.test(sourceMessage)) {
    return assignProviderError(new Error('请先配置模型 key'), {
      code: 'LLM_PROVIDER_UNCONFIGURED',
      message: '请先配置模型 key',
      recoveryActions: ['检查配置', '填写模型 key'],
      provider,
      model,
      apiSurface,
      ...(status ? { status } : {}),
      ...(response ? { response } : {})
    })
  }

  if (/does not exist|model.*not.*found|not.*support.*model|unsupported model|model_not_found|模型.*不存在|不支持.*模型|当前.*不支持/i.test(sourceMessage)) {
    const modelLabel = model || '当前模型'
    return assignProviderError(new Error(`当前 provider 不支持 ${modelLabel}`), {
      code: 'LLM_MODEL_NOT_FOUND',
      message: `当前 provider 不支持 ${modelLabel}`,
      recoveryActions: ['切换模型', '检查配置'],
      provider,
      model,
      apiSurface,
      ...(status ? { status } : {}),
      ...(response ? { response } : {})
    })
  }

  if (/(responses|chat\.completions|chat\/completions|endpoint|接口|path|route|not found|404)/i.test(sourceMessage) && (status === 400 || status === 404 || /responses|chat\.completions|chat\/completions|endpoint|接口/i.test(sourceMessage))) {
    return assignProviderError(new Error('接口不匹配，请切换 responses / chat.completions 后重试'), {
      code: 'LLM_API_SURFACE_MISMATCH',
      message: '接口不匹配，请切换 responses / chat.completions 后重试',
      recoveryActions: ['切换 responses/chat.completions', '检查配置'],
      provider,
      model,
      apiSurface,
      ...(status ? { status } : {}),
      ...(response ? { response } : {})
    })
  }

  return assignProviderError(new Error(sourceMessage || '模型服务暂时不可用'), {
    code: 'LLM_PROVIDER_FAILED',
    message: sourceMessage || '模型服务暂时不可用',
    recoveryActions: uniqueActions(error.recoveryActions || ['重试', '检查配置']),
    provider,
    model,
    apiSurface,
    ...providerErrorCauseDetails(error),
    ...(status ? { status } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
    ...(response ? { response } : {})
  })
}

function curlConfigValue(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function postJsonWithCurl({ url, apiKey, timeoutMs, body, provider, model, apiSurface, spawnImpl = spawn }) {
  const tempDir = await mkdtemp(join(tmpdir(), 'llm-curl-'))
  const bodyPath = join(tempDir, 'request.json')
  const configPath = join(tempDir, 'curl.conf')
  try {
    await writeFile(bodyPath, JSON.stringify(body), 'utf8')
    const args = ['-sS', '--config', configPath, '-w', '\n%{http_code}']
    const configLines = [
      `url = "${curlConfigValue(url)}"`,
      'request = "POST"',
      'header = "Content-Type: application/json"',
      `header = "Authorization: Bearer ${curlConfigValue(apiKey)}"`,
      `data-binary = "@${curlConfigValue(bodyPath)}"`
    ]
    if (timeoutMs) configLines.push(`max-time = ${Math.max(1, Math.ceil(timeoutMs / 1000))}`)
    await writeFile(configPath, configLines.join('\n'), 'utf8')

    const { stdout, stderr } = await new Promise((resolve, reject) => {
      const child = spawnImpl('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdoutBuffer = ''
      let stderrBuffer = ''
      child.stdout?.on?.('data', (chunk) => { stdoutBuffer += String(chunk) })
      child.stderr?.on?.('data', (chunk) => { stderrBuffer += String(chunk) })
      child.on?.('error', reject)
      child.on?.('close', (code) => {
        if (code === 0) {
          resolve({ stdout: stdoutBuffer, stderr: stderrBuffer })
        } else {
          reject(createProviderError(stderrBuffer || `curl 请求失败：${code}`, {
            code: isTimeoutLikeProviderError({ message: stderrBuffer }) ? 'LLM_PROVIDER_TIMEOUT' : 'LLM_PROVIDER_FAILED',
            provider,
            model,
            apiSurface,
            ...(timeoutMs ? { timeoutMs } : {})
          }))
        }
      })
    })
    const match = String(stdout).match(/([\s\S]*)\n(\d{3})\s*$/)
    const text = match ? match[1] : stdout
    const status = match ? Number(match[2]) : 0
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (error) {
        throw normalizeModelProviderError(error, {
          provider,
          model,
          apiSurface,
          timeoutMs,
          status,
          response: text.slice(0, 1000)
        })
      }
    }
    if (status >= 400) {
      throw normalizeModelProviderError(new Error(data?.error?.message || data?.message || `模型服务返回 ${status}`), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status,
        response: data
      })
    }
    if (!data) {
      throw normalizeModelProviderError(new Error(`模型服务没有返回 JSON${stderr ? `：${stderr}` : ''}`), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status
      })
    }
    Object.defineProperty(data, '__transport', { value: 'curl', enumerable: false })
    return data
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function postJson({ fetchImpl, url, apiKey, timeoutMs, body, provider, model, apiSurface, curlPostJsonImpl, spawnImpl, allowCurlFallback = true }) {
  const controller = new AbortController()
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const text = await response.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (error) {
        throw normalizeModelProviderError(error, {
          provider,
          model,
          apiSurface,
          timeoutMs,
          status: response.status,
          response: text.slice(0, 1000)
        })
      }
    }
    if (!response.ok) {
      throw normalizeModelProviderError(new Error(data?.error?.message || data?.message || `模型服务返回 ${response.status}`), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status: response.status,
        response: data
      })
    }
    if (!data) {
      throw normalizeModelProviderError(new Error('模型服务没有返回 JSON'), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status: response.status
      })
    }
    return data
  } catch (error) {
    if (allowCurlFallback && isTimeoutLikeProviderError(error)) {
      const fallback = curlPostJsonImpl || postJsonWithCurl
      try {
        return await fallback({ url, apiKey, timeoutMs, body, provider, model, apiSurface, spawnImpl })
      } catch (fallbackError) {
        throw normalizeModelProviderError(fallbackError, { provider, model, apiSurface, timeoutMs })
      }
    }
    throw normalizeModelProviderError(error, { provider, model, apiSurface, timeoutMs })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function postFormData({ fetchImpl, url, apiKey, timeoutMs, formData, provider, model, apiSurface }) {
  const controller = new AbortController()
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData,
      signal: controller.signal
    })
    const text = await response.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (error) {
        throw normalizeModelProviderError(error, {
          provider,
          model,
          apiSurface,
          timeoutMs,
          status: response.status,
          response: text.slice(0, 1000)
        })
      }
    }
    if (!response.ok) {
      throw normalizeModelProviderError(new Error(data?.error?.message || data?.message || `模型服务返回 ${response.status}`), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status: response.status,
        response: data
      })
    }
    if (!data) {
      throw normalizeModelProviderError(new Error('模型服务没有返回 JSON'), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status: response.status
      })
    }
    return data
  } catch (error) {
    throw normalizeModelProviderError(error, { provider, model, apiSurface, timeoutMs })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function parseSseBlock(block = '') {
  const event = { type: 'message', data: null }
  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event.type = line.slice(6).trim()
    if (line.startsWith('data:')) {
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') {
        event.data = '[DONE]'
      } else {
        try {
          event.data = raw ? JSON.parse(raw) : null
        } catch {
          event.data = raw
        }
      }
    }
  })
  return event.data === null ? null : event
}

async function* readSseStream(response, signal) {
  const reader = response.body?.getReader?.()
  if (!reader) return
  if (signal?.aborted) return
  const decoder = new TextDecoder()
  let buffer = ''
  let cancelled = false
  const cancelReader = () => {
    cancelled = true
    Promise.resolve(reader.cancel?.()).catch(() => {})
  }
  signal?.addEventListener?.('abort', cancelReader, { once: true })
  const readBlocks = function* (nextChunk = '', force = false) {
    buffer += nextChunk
    const parts = buffer.split(/\n\n+/)
    buffer = force ? '' : (parts.pop() || '')
    const ready = force ? parts : parts.slice(0)
    for (const part of ready) {
      const event = parseSseBlock(part)
      if (event) yield event
    }
  }
  try {
    while (true) {
      if (cancelled || signal?.aborted) break
      const { value, done } = await reader.read()
      if (cancelled || signal?.aborted) break
      if (done) break
      for (const event of readBlocks(decoder.decode(value, { stream: true }))) yield event
    }
    if (cancelled || signal?.aborted) return
    for (const event of readBlocks(decoder.decode(), true)) yield event
  } finally {
    signal?.removeEventListener?.('abort', cancelReader)
  }
}

async function fetchStream({ fetchImpl, url, apiKey, timeoutMs, body, signal, provider, model, apiSurface }) {
  const controller = new AbortController()
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null
  const abortFromOuterSignal = () => controller.abort()
  signal?.addEventListener?.('abort', abortFromOuterSignal, { once: true })
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    if (!response.ok) {
      let data = {}
      try {
        data = await response.json()
      } catch {
        data = {}
      }
      throw normalizeModelProviderError(new Error(data?.error?.message || data?.message || `模型服务返回 ${response.status}`), {
        provider,
        model,
        apiSurface,
        timeoutMs,
        status: response.status,
        response: data
      })
    }
    return { response, close: () => { if (timer) clearTimeout(timer) } }
  } catch (error) {
    if (timer) clearTimeout(timer)
    throw normalizeModelProviderError(error, { provider, model, apiSurface, timeoutMs })
  } finally {
    signal?.removeEventListener?.('abort', abortFromOuterSignal)
  }
}

export function createDeterministicAgentProvider() {
  return {
    name: 'deterministic',
    async generate(context = {}) {
      return {
        content: deterministicContent(context),
        actionResult: buildActionResult(context),
        usage: zeroUsage(),
        provider: 'deterministic',
        model: context.model,
        raw: null
      }
    }
  }
}

export function createOpenAICompatibleAgentProvider(options = {}) {
  const apiKey = options.apiKey || ''
  const baseUrl = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const apiSurface = options.apiSurface || 'responses'
  const defaultTimeoutMs = resolveTimeoutMs(options.timeoutMs, 20000)
  const fetchImpl = options.fetchImpl || (options.allowInsecureTLS
    ? async (url, init = {}) => {
        const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        try {
          return await globalThis.fetch(url, init)
        } finally {
          if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
          else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous
        }
      }
    : globalThis.fetch)
  const curlPostJsonImpl = options.curlPostJsonImpl
  const spawnImpl = options.spawnImpl
  if (!fetchImpl) throw new Error('当前运行环境不支持 fetch')

  const chatUserContent = (context = {}) => context.imageDataUrl
    ? [
        { type: 'text', text: context.userPrompt || '' },
        { type: 'image_url', image_url: { url: context.imageDataUrl } }
      ]
    : context.userPrompt
  const responsesInput = (context = {}) => context.imageDataUrl
    ? [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: context.userPrompt || '' },
            { type: 'input_image', image_url: context.imageDataUrl }
          ]
        }
      ]
    : context.userPrompt
  const maxOutputTokenLimit = (context = {}) => {
    const value = Number(context.maxOutputTokens || context.max_output_tokens || context.maxTokens || context.max_tokens || 0)
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  }

  return {
    name: 'openai-compatible',
    async *stream(context = {}, streamOptions = {}) {
      const model = context.model || options.defaultModel || 'gpt-5.5'
      const timeoutMs = resolveTimeoutMs(context.timeoutMs, defaultTimeoutMs)
      if (!apiKey) {
        throw normalizeModelProviderError(new Error('OPENAI_API_KEY 未配置'), {
          provider: 'openai-compatible',
          model,
          apiSurface,
          timeoutMs
        })
      }
      const endpoint = apiSurface === 'chat.completions' ? 'chat/completions' : 'responses'
      const maxTokens = maxOutputTokenLimit(context)
      const body = apiSurface === 'chat.completions'
        ? {
            model,
            stream: true,
            stream_options: { include_usage: true },
            messages: [
              { role: 'system', content: context.systemPrompt },
              { role: 'user', content: chatUserContent(context) }
            ],
            ...(maxTokens ? { max_tokens: maxTokens } : {})
          }
        : {
            model,
            stream: true,
            instructions: context.systemPrompt,
            input: responsesInput(context),
            ...(maxTokens ? { max_output_tokens: maxTokens } : {})
          }
      const { response, close } = await fetchStream({
        fetchImpl,
        url: `${baseUrl}/${endpoint}`,
        apiKey,
        timeoutMs,
        body,
        signal: streamOptions.signal,
        provider: 'openai-compatible',
        model,
        apiSurface
      })
      let usage = zeroUsage()
      let streamedContent = ''
      try {
        for await (const event of readSseStream(response, streamOptions.signal)) {
          if (event.data === '[DONE]') break
          const data = event.data || {}
          const delta = apiSurface === 'chat.completions'
            ? data.choices?.[0]?.delta?.content || ''
            : data.delta || data.output_text_delta || ''
          if (delta) {
            streamedContent += delta
            yield { type: 'delta', content: delta }
          }
          const nextUsage = data.usage || data.response?.usage
          if (nextUsage) usage = usageFromOpenAI(nextUsage)
        }
      } finally {
        close()
      }
      if (streamOptions.signal?.aborted) return
      const normalized = normalizeAgentModelText(streamedContent)
      yield {
        type: 'final',
        content: normalized.content,
        proposal: normalized.proposal,
        quickReplies: normalized.quickReplies,
        usage,
        provider: 'openai-compatible',
        model
      }
    },
    async generate(context = {}) {
      const model = context.model || options.defaultModel || 'gpt-5.5'
      const timeoutMs = resolveTimeoutMs(context.timeoutMs, defaultTimeoutMs)
      if (!apiKey) {
        throw normalizeModelProviderError(new Error('OPENAI_API_KEY 未配置'), {
          provider: 'openai-compatible',
          model,
          apiSurface,
          timeoutMs
        })
      }
      const endpoint = apiSurface === 'chat.completions' ? 'chat/completions' : 'responses'
      const maxTokens = maxOutputTokenLimit(context)
      const body = apiSurface === 'chat.completions'
        ? {
            model,
            messages: [
              { role: 'system', content: context.systemPrompt },
              { role: 'user', content: chatUserContent(context) }
            ],
            ...(maxTokens ? { max_tokens: maxTokens } : {})
          }
        : {
            model,
            instructions: context.systemPrompt,
            input: responsesInput(context),
            ...(maxTokens ? { max_output_tokens: maxTokens } : {})
          }
      const raw = await postJson({
        fetchImpl,
        url: `${baseUrl}/${endpoint}`,
        apiKey,
        timeoutMs,
        body,
        provider: 'openai-compatible',
        model,
        apiSurface,
        curlPostJsonImpl,
        spawnImpl
      })
      const normalized = normalizeAgentModelText(extractResponseText(raw))
      return {
        content: normalized.content,
        proposal: normalized.proposal,
        quickReplies: normalized.quickReplies,
        actionResult: buildActionResult(context),
        usage: usageFromOpenAI(raw.usage || {}),
        provider: 'openai-compatible',
        model,
        raw
      }
    }
  }
}

function normalizeImageModel(settings = {}, fallback = 'gpt-image-2') {
  return String(settings.imageModel || settings.defaultImageModel || settings.defaultImageGenerationModel || fallback || 'gpt-image-2').trim() || 'gpt-image-2'
}

function parseTomlScalar(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw === 'true') return true
  if (raw === 'false') return false
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

function parseCodexConfigToml(text = '') {
  const result = { model: '', modelProvider: '', providers: {} }
  let activeTable = ''
  for (const sourceLine of String(text || '').split(/\r?\n/)) {
    const line = sourceLine.trim()
    if (!line || line.startsWith('#')) continue
    const tableMatch = line.match(/^\[model_providers\.([^\]]+)\]$/)
    if (tableMatch) {
      activeTable = tableMatch[1].trim().replace(/^["']|["']$/g, '')
      result.providers[activeTable] ||= {}
      continue
    }
    const assignmentMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/)
    if (!assignmentMatch) continue
    const key = assignmentMatch[1]
    const value = parseTomlScalar(assignmentMatch[2])
    if (activeTable) {
      result.providers[activeTable][key] = value
    } else if (key === 'model_provider') {
      result.modelProvider = String(value || '')
    } else if (key === 'model') {
      result.model = String(value || '')
    }
  }
  return result
}

function readCodexAuthApiKey(authPath = '', authJson = '') {
  if (authJson) {
    try {
      const raw = JSON.parse(authJson)
      return String(raw.OPENAI_API_KEY || raw.openaiApiKey || '').trim()
    } catch {}
  }
  try {
    const raw = JSON.parse(readFileSync(authPath, 'utf8'))
    return String(raw.OPENAI_API_KEY || raw.openaiApiKey || '').trim()
  } catch {
    return ''
  }
}

function isLocalProxyBaseUrl(baseUrl = '') {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(String(baseUrl || '').trim())
}

function readCcSwitchCurrentCodexSettings(dbPath = '') {
  const targetPath = dbPath || join(homedir(), '.cc-switch', 'cc-switch.db')
  try {
    const output = execFileSync('sqlite3', [
      targetPath,
      '-json',
      "select settings_config from providers where app_type='codex' and is_current=1 limit 1;"
    ], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
    const rows = JSON.parse(output || '[]')
    const rawConfig = rows?.[0]?.settings_config
    if (!rawConfig) return null
    return JSON.parse(rawConfig)
  } catch {
    return null
  }
}

function normalizeCodexWireApi(value = '') {
  const api = String(value || '').trim()
  if (!api) return ''
  if (/^chat(?:\.completions)?$/i.test(api)) return 'chat.completions'
  if (/^responses$/i.test(api)) return 'responses'
  return api
}

function codexProviderOptionsFromSettings({ settings = {}, codexConfig = {}, providerConfig = {}, apiKey = '' } = {}) {
  const baseUrl = String(providerConfig.base_url || providerConfig.baseUrl || '').trim()
  const requiresAuth = providerConfig.requires_openai_auth !== false
  if (!baseUrl || (requiresAuth && !apiKey)) return null
  return {
    apiKey,
    baseUrl,
    defaultModel: settings.defaultModel || codexConfig.model || 'gpt-5.5',
    apiSurface: settings.apiSurface || normalizeCodexWireApi(providerConfig.wire_api || providerConfig.apiSurface) || 'responses',
    timeoutMs: settings.timeoutMs,
    allowInsecureTLS: settings.allowInsecureTLS
  }
}

function resolveCcSwitchCodexProxySettings(settings = {}) {
  const ccSwitchSettings = settings.ccSwitchCodexSettings || readCcSwitchCurrentCodexSettings(settings.ccSwitchDbPath)
  const codexConfig = parseCodexConfigToml(String(ccSwitchSettings?.config || ''))
  const activeProvider = codexConfig.modelProvider
  const providerConfig = codexConfig.providers?.[activeProvider] || {}
  const apiKey = String(settings.imageApiKey || ccSwitchSettings?.auth?.OPENAI_API_KEY || settings.apiKey || '').trim()
  return codexProviderOptionsFromSettings({ settings, codexConfig, providerConfig, apiKey })
}

function resolveCodexProxySettings(settings = {}) {
  const configPath = settings.codexConfigPath || process.env.CODEX_CONFIG_PATH || join(homedir(), '.codex', 'config.toml')
  const authPath = settings.codexAuthPath || process.env.CODEX_AUTH_PATH || join(homedir(), '.codex', 'auth.json')
  try {
    const configText = settings.codexConfigText || process.env.CODEX_CONFIG_TEXT || readFileSync(configPath, 'utf8')
    const codexConfig = parseCodexConfigToml(configText)
    const activeProvider = codexConfig.modelProvider
    const providerConfig = codexConfig.providers?.[activeProvider] || {}
    const baseUrl = String(providerConfig.base_url || providerConfig.baseUrl || '').trim()
    if (!baseUrl) return null
    if (isLocalProxyBaseUrl(baseUrl)) {
      const ccSwitchOptions = resolveCcSwitchCodexProxySettings(settings)
      if (ccSwitchOptions) return ccSwitchOptions
    }
    const apiKey = String(settings.imageApiKey || readCodexAuthApiKey(authPath, settings.codexAuthJson || process.env.CODEX_AUTH_JSON) || settings.apiKey || '').trim()
    return codexProviderOptionsFromSettings({ settings, codexConfig, providerConfig, apiKey })
  } catch {
    return null
  }
}

function resolveCodexImageProxySettings(settings = {}) {
  const options = resolveCodexProxySettings(settings)
  if (!options) return null
  return {
    ...options,
    defaultModel: normalizeImageModel(settings, 'gpt-image-2'),
    timeoutMs: settings.imageTimeoutMs || settings.timeoutMs
  }
}

function positiveDimension(value) {
  const number = Math.round(Number(value) || 0)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function roundToMultiple(value = 0, multiple = 16) {
  const rounded = Math.round(Number(value) / multiple) * multiple
  return Math.max(multiple, rounded)
}

function normalizeImageGenerationSize(context = {}, options = {}) {
  const explicitSize = String(context.size || options.size || '').trim()
  if (/^\d+x\d+$/i.test(explicitSize)) return explicitSize.toLowerCase()

  const targetWidth = positiveDimension(context.targetImageSize?.width)
  const targetHeight = positiveDimension(context.targetImageSize?.height)
  const aspectRatio = String(context.aspectRatio || context.targetAspectRatio || '').replace(/\s+/g, '').replace(/[：:xX]/g, ':')

  if (targetWidth && !targetHeight) {
    if (targetWidth === 375 || aspectRatio === '375:812') return '752x1632'
    if (targetWidth === 1920 || aspectRatio === '1920:1080') return '1920x1088'
    return `${roundToMultiple(targetWidth)}x1024`
  }
  if (!targetWidth || !targetHeight) return '1024x1024'

  if (targetWidth === 375 && targetHeight === 812) return '752x1632'
  if (targetWidth === 1920 && targetHeight === 1080) return '1920x1088'

  const normalizedWidth = roundToMultiple(targetWidth)
  const normalizedHeight = roundToMultiple(targetHeight)
  return `${normalizedWidth}x${normalizedHeight}`
}

function imageReferenceFileName(reference = {}, index = 0, extension = 'png') {
  const title = String(reference.title || reference.name || `reference-${index + 1}`)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `reference-${index + 1}`
  return `${title}.${extension || 'png'}`
}

function normalizeImageReferenceInputs(references = []) {
  return (Array.isArray(references) ? references : [])
    .map((reference, index) => {
      const parsed = parseImageDataUrl(reference?.imageDataUrl || reference?.dataUrl || '')
      if (!parsed?.buffer?.length) return null
      return {
        title: reference.title || reference.name || `reference-${index + 1}`,
        sourceUrl: reference.sourceUrl || reference.url || '',
        imageDataUrl: reference.imageDataUrl || reference.dataUrl || '',
        buffer: parsed.buffer,
        mimeType: parsed.mimeType || 'image/png',
        fileName: imageReferenceFileName(reference, index, parsed.extension || 'png')
      }
    })
    .filter(Boolean)
    .slice(0, 4)
}

export function createOpenAICompatibleImageProvider(options = {}) {
  const apiKey = options.apiKey || ''
  const baseUrl = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const defaultModel = normalizeImageModel(options, 'gpt-image-2')
  const defaultTimeoutMs = resolveTimeoutMs(options.timeoutMs, 60000)
  const fetchImpl = options.fetchImpl || (options.allowInsecureTLS
    ? async (url, init = {}) => {
        const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        try {
          return await globalThis.fetch(url, init)
        } finally {
          if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
          else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous
        }
      }
    : globalThis.fetch)
  if (!fetchImpl) throw new Error('当前运行环境不支持 fetch')

  return {
    name: 'openai-compatible-image',
    async generate(context = {}) {
      const model = context.targetGenerator || context.model || defaultModel
      const timeoutMs = resolveTimeoutMs(context.timeoutMs, defaultTimeoutMs)
      const prompt = String(context.prompt || context.imagePrompt || '').trim()
      if (!apiKey) {
        throw normalizeModelProviderError(new Error('OPENAI_API_KEY 未配置'), {
          provider: 'openai-compatible-image',
          model,
          apiSurface: 'images.generations',
          timeoutMs
        })
      }
      const referenceImages = normalizeImageReferenceInputs(context.referenceImages)
      const size = normalizeImageGenerationSize(context, options)
      let raw = null
      if (referenceImages.length) {
        const formData = new FormData()
        formData.append('model', model)
        formData.append('prompt', prompt)
        formData.append('size', size)
        formData.append('response_format', 'b64_json')
        referenceImages.forEach((reference) => {
          formData.append(
            'image[]',
            new Blob([reference.buffer], { type: reference.mimeType }),
            reference.fileName
          )
        })
        raw = await postFormData({
          fetchImpl,
          url: `${baseUrl}/images/edits`,
          apiKey,
          timeoutMs,
          formData,
          provider: 'openai-compatible-image',
          model,
          apiSurface: 'images.edits'
        })
      } else {
        raw = await postJson({
            fetchImpl,
            url: `${baseUrl}/images/generations`,
            apiKey,
            timeoutMs,
            body: {
              model,
              prompt,
              size,
              response_format: 'b64_json'
            },
            provider: 'openai-compatible-image',
            model,
            apiSurface: 'images.generations'
          })
      }
      const firstImage = Array.isArray(raw.data) ? raw.data[0] || {} : {}
      const imageDataUrl = firstImage.b64_json
        ? `data:image/png;base64,${firstImage.b64_json}`
        : (firstImage.url || '')
      return {
        imageDataUrl,
        revisedPrompt: firstImage.revised_prompt || firstImage.revisedPrompt || raw.revised_prompt || '',
        provider: 'openai-compatible-image',
        model,
        referenceImageCount: referenceImages.length,
        raw
      }
    }
  }
}

function buildCodexPrompt(context = {}) {
  const wantsMarkdown = context.responseFormat === 'markdown'
  const outputContract = wantsMarkdown
    ? '请严格遵守 system 指令和 user 输入，只输出中文 Markdown 正文，不要 JSON，不要解释执行过程，不要提工具、skills、仓库或会话规则。'
    : '请严格遵守 system 指令和 user 输入，最终只输出可被 JSON.parse 解析的 JSON，不要 Markdown，不要解释。'
  return [
    wantsMarkdown ? '你是当前产品工作流后端的主对话回复模型。' : '你是当前产品工作流后端的结构化生成模型。',
    '这是产品后端的一次模型生成请求，不是代码代理任务。',
    '不要读取文件，不要调用工具，不要执行命令，不要加载或执行 skills，不要检查仓库。',
    wantsMarkdown
      ? '只把 System 和 User 当作普通模型上下文，直接生成最终回复。'
      : '只把 System 和 User 当作普通模型上下文，直接生成最终 JSON。',
    outputContract,
    context.systemPrompt ? `\n【System】\n${context.systemPrompt}` : '',
    context.userPrompt ? `\n【User】\n${context.userPrompt}` : '',
    `\n【Final Output Contract】\n${outputContract}`
  ].filter(Boolean).join('\n')
}

function parseImageDataUrl(imageDataUrl = '') {
  const match = String(imageDataUrl || '').match(/^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i)
  if (!match) return null
  const type = match[1].toLowerCase()
  const extension = type === 'jpeg' ? 'jpg' : type.replace(/[^a-z0-9]/g, '')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length) return null
  return {
    buffer,
    extension: extension || 'png',
    mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension || 'png'}`
  }
}

async function createCodexImageAttachment(imageDataUrl = '') {
  const parsed = parseImageDataUrl(imageDataUrl)
  if (!parsed) return null
  const dir = await mkdtemp(join(tmpdir(), 'codex-image-input-'))
  const filePath = join(dir, `input.${parsed.extension}`)
  await writeFile(filePath, parsed.buffer)
  return {
    path: filePath,
    async cleanup() {
      await rm(dir, { recursive: true, force: true })
    }
  }
}

function codexExecArgs({ sandbox, model, cwd, imagePath } = {}) {
  const args = [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    sandbox,
    '--model',
    model,
    '-C',
    cwd
  ]
  if (imagePath) args.push('--image', imagePath)
  args.push('--json', '-')
  return args
}

function meaningfulCodexCliStderr(stderr = '') {
  const lines = String(stderr || '').split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines
    .filter((line) => !/\b(?:WARN|INFO|DEBUG)\b/.test(line))
    .join('\n')
    .trim()
}

function runCodexCli({ command, args, prompt, timeoutMs, spawnImpl, signal }) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    })
    let stdoutBuffer = ''
    let stderr = ''
    const events = []
    const jsonState = { buffer: '' }
    let timer = null
    let settled = false
    const cleanup = () => {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener?.('abort', abort)
    }
    const finish = (error, value) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(value)
    }
    const abort = () => {
      try {
        child.kill?.('SIGTERM')
      } catch {}
      finish(createProviderError('Codex CLI 调用已取消', {
        code: 'LLM_CODEX_CLI_ABORTED',
        provider: 'codex-cli'
      }))
    }
    if (timeoutMs) {
      timer = setTimeout(() => {
        try {
          child.kill?.('SIGTERM')
        } catch {}
        finish(createProviderError(`Codex CLI 调用超时：${timeoutMs}ms`, {
          code: 'LLM_PROVIDER_TIMEOUT',
          provider: 'codex-cli',
          timeoutMs
        }))
      }, timeoutMs)
    }
    signal?.addEventListener?.('abort', abort, { once: true })
    child.stdout?.setEncoding?.('utf8')
    child.stderr?.setEncoding?.('utf8')
    child.stdout?.on?.('data', (chunk) => {
      stdoutBuffer += chunk
      events.push(...parseJsonLines(chunk, jsonState))
    })
    child.stderr?.on?.('data', (chunk) => {
      stderr += String(chunk || '')
    })
    child.on?.('error', (error) => {
      finish(createProviderError(error.message || 'Codex CLI 启动失败', {
        code: 'LLM_CODEX_CLI_FAILED',
        provider: 'codex-cli',
        cause: error
      }))
    })
    child.on?.('close', (code, closeSignal) => {
      if (settled) return
      events.push(...parseJsonLines('\n', jsonState))
      if (closeSignal) {
        finish(createProviderError(`Codex CLI 调用被中断：${closeSignal}`, {
          code: 'LLM_CODEX_CLI_INTERRUPTED',
          provider: 'codex-cli',
          status: code,
          response: { stderr: stderr.trim(), events, signal: closeSignal }
        }))
        return
      }
      if (code !== 0) {
        const jsonError = events.find((event) => event.type === 'error')?.message
        const stderrMessage = meaningfulCodexCliStderr(stderr)
        finish(createProviderError(jsonError || stderrMessage || `Codex CLI 退出码 ${code}`, {
          code: 'LLM_CODEX_CLI_FAILED',
          provider: 'codex-cli',
          status: code,
          response: { stderr: stderr.trim(), events }
        }))
        return
      }
      finish(null, { stdout: stdoutBuffer, stderr, events })
    })
    child.stdin?.write?.(prompt)
    child.stdin?.end?.()
  })
}

function finalTextFromCodexEvents(events = [], stdout = '') {
  const messages = events
    .filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')
    .map((event) => codexItemText(event.item))
    .filter(Boolean)
  if (messages.length) return messages[messages.length - 1]
  const rawLines = String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return rawLines.length ? rawLines[rawLines.length - 1] : ''
}

function finalUsageFromCodexEvents(events = []) {
  const completed = [...events].reverse().find((event) => event.type === 'turn.completed' && event.usage)
  return usageFromCodex(completed?.usage || {})
}

export function createCodexCliAgentProvider(options = {}) {
  const codexBin = options.codexBin || process.env.CODEX_BIN || 'codex'
  const cwd = options.cwd || process.env.CODEX_WORKSPACE_DIR || process.cwd()
  const defaultModel = options.defaultModel || 'gpt-5.5'
  const defaultTimeoutMs = resolveTimeoutMs(options.timeoutMs, 600000)
  const spawnImpl = options.spawnImpl || spawn
  const sandbox = options.sandbox || 'read-only'
  return {
    name: 'codex-cli',
    async *stream(context = {}, streamOptions = {}) {
      const model = context.model || defaultModel
      const timeoutMs = resolveTimeoutMs(context.timeoutMs, defaultTimeoutMs)
      const prompt = buildCodexPrompt(context)
      const imageAttachment = await createCodexImageAttachment(context.imageDataUrl)
      const args = codexExecArgs({ sandbox, model, cwd, imagePath: imageAttachment?.path })
      const child = spawnImpl(codexBin, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      })
      const jsonState = { buffer: '' }
      const events = []
      let stdout = ''
      let stderr = ''
      let finalAgentText = ''
      let lastProgress = ''
      let timer = null
      let done = false
      const queue = []
      let wake = null
      const push = (event) => {
        queue.push(event)
        wake?.()
        wake = null
      }
      const end = () => {
        done = true
        wake?.()
        wake = null
      }
      const abort = () => {
        try {
          child.kill?.('SIGTERM')
        } catch {}
      }
      if (timeoutMs) timer = setTimeout(abort, timeoutMs)
      streamOptions.signal?.addEventListener?.('abort', abort, { once: true })
      child.stdout?.setEncoding?.('utf8')
      child.stderr?.setEncoding?.('utf8')
      child.stdout?.on?.('data', (chunk) => {
        stdout += chunk
        for (const event of parseJsonLines(chunk, jsonState)) {
          events.push(event)
          const label = codexProgressLabel(event)
          if (label && label !== lastProgress) {
            lastProgress = label
            push({ type: 'status', label })
          }
          const text = event.type === 'item.completed' && event.item?.type === 'agent_message'
            ? codexItemText(event.item)
            : ''
          if (text) {
            finalAgentText = text
            push({ type: 'delta', content: text })
          }
        }
      })
      child.stderr?.on?.('data', (chunk) => {
        stderr += String(chunk || '')
      })
      child.on?.('error', (error) => {
        push({ type: 'error', error })
        end()
      })
      child.on?.('close', (code, closeSignal) => {
        if (timer) clearTimeout(timer)
        events.push(...parseJsonLines('\n', jsonState))
        if (closeSignal) {
          push({
            type: 'error',
            error: createProviderError(`Codex CLI 调用被中断：${closeSignal}`, {
              code: 'LLM_CODEX_CLI_INTERRUPTED',
              provider: 'codex-cli',
              model,
              status: code,
              response: { stderr: stderr.trim(), events, signal: closeSignal }
            })
          })
          end()
          return
        }
        if (code !== 0) {
          const jsonError = events.find((event) => event.type === 'error')?.message
          const stderrMessage = meaningfulCodexCliStderr(stderr)
          push({
            type: 'error',
            error: createProviderError(jsonError || stderrMessage || `Codex CLI 退出码 ${code}`, {
              code: 'LLM_CODEX_CLI_FAILED',
              provider: 'codex-cli',
              model,
              status: code,
              response: { stderr: stderr.trim(), events }
            })
          })
          end()
          return
        }
        const normalized = normalizeAgentModelText(finalAgentText || finalTextFromCodexEvents(events, stdout))
        push({
          type: 'final',
          content: normalized.content,
          proposal: normalized.proposal,
          quickReplies: normalized.quickReplies,
          usage: finalUsageFromCodexEvents(events),
          provider: 'codex-cli',
          model,
          raw: { events }
        })
        end()
      })
      child.stdin?.write?.(prompt)
      child.stdin?.end?.()
      try {
        while (!done || queue.length) {
          if (!queue.length) {
            await new Promise((resolve) => { wake = resolve })
            continue
          }
          const event = queue.shift()
          if (event.type === 'error') throw normalizeModelProviderError(event.error, {
            provider: 'codex-cli',
            model,
            timeoutMs
          })
          yield event
        }
      } finally {
        streamOptions.signal?.removeEventListener?.('abort', abort)
        if (timer) clearTimeout(timer)
        await imageAttachment?.cleanup()
      }
    },
    async generate(context = {}) {
      const model = context.model || defaultModel
      const timeoutMs = resolveTimeoutMs(context.timeoutMs, defaultTimeoutMs)
      const imageAttachment = await createCodexImageAttachment(context.imageDataUrl)
      try {
        const { stdout, events } = await runCodexCli({
          command: codexBin,
          args: codexExecArgs({ sandbox, model, cwd, imagePath: imageAttachment?.path }),
          prompt: buildCodexPrompt(context),
          timeoutMs,
          spawnImpl,
          signal: context.signal
        })
        const normalized = normalizeAgentModelText(finalTextFromCodexEvents(events, stdout))
        return {
          content: normalized.content,
          proposal: normalized.proposal,
          quickReplies: normalized.quickReplies,
          actionResult: buildActionResult(context),
          usage: finalUsageFromCodexEvents(events),
          provider: 'codex-cli',
          model,
          raw: { events }
        }
      } catch (error) {
        throw normalizeModelProviderError(error, {
          provider: 'codex-cli',
          model,
          timeoutMs
        })
      } finally {
        await imageAttachment?.cleanup()
      }
    }
  }
}

export function createAgentProviderFromEnv(env = {}, fetchImpl = globalThis.fetch) {
  const provider = env.WORKFLOW_AGENT_PROVIDER || 'auto'
  const hasOpenAIConfig = Boolean(env.OPENAI_API_KEY)
  if (provider === 'codex-proxy') {
    const codexOptions = resolveCodexProxySettings({
      defaultModel: env.OPENAI_DEFAULT_MODEL || env.CODEX_DEFAULT_MODEL || 'gpt-5.5',
      timeoutMs: env.OPENAI_TIMEOUT_MS || env.CODEX_TIMEOUT_MS,
      apiSurface: env.OPENAI_API_SURFACE,
      codexConfigPath: env.CODEX_CONFIG_PATH,
      codexAuthPath: env.CODEX_AUTH_PATH,
      codexConfigText: env.CODEX_CONFIG_TEXT,
      codexAuthJson: env.CODEX_AUTH_JSON,
      ccSwitchDbPath: env.CC_SWITCH_DB_PATH || env.CODEX_CC_SWITCH_DB_PATH
    })
    if (codexOptions) {
      if (fetchImpl) codexOptions.fetchImpl = fetchImpl
      return createOpenAICompatibleAgentProvider(codexOptions)
    }
  }
  if (provider === 'deterministic' || (provider === 'auto' && !hasOpenAIConfig)) {
    return createDeterministicAgentProvider()
  }
  if (provider === 'codex-cli') {
    return createCodexCliAgentProvider({
      codexBin: env.CODEX_BIN,
      cwd: env.CODEX_WORKSPACE_DIR,
      defaultModel: env.OPENAI_DEFAULT_MODEL || env.CODEX_DEFAULT_MODEL || 'gpt-5.5',
      timeoutMs: env.OPENAI_TIMEOUT_MS || env.CODEX_TIMEOUT_MS
    })
  }
  return createOpenAICompatibleAgentProvider({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    defaultModel: env.OPENAI_DEFAULT_MODEL,
    apiSurface: env.OPENAI_API_SURFACE || 'responses',
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    fetchImpl
  })
}

export function createAgentProviderFromModelSettings(settings = {}, fetchImpl) {
  if (!settings.enabled || settings.provider === 'deterministic') {
    return createDeterministicAgentProvider()
  }
  if (settings.provider === 'codex-proxy') {
    const codexOptions = resolveCodexProxySettings(settings)
    if (!codexOptions) return createDeterministicAgentProvider()
    if (fetchImpl) codexOptions.fetchImpl = fetchImpl
    return createOpenAICompatibleAgentProvider(codexOptions)
  }
  if (settings.provider === 'codex-cli') {
    return createCodexCliAgentProvider({
      defaultModel: settings.defaultModel || 'gpt-5.5',
      timeoutMs: settings.timeoutMs,
      codexBin: settings.codexBin,
      cwd: settings.cwd || settings.baseUrl || process.cwd()
    })
  }
  if (settings.provider === 'openai-compatible') {
    const options = {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      defaultModel: settings.defaultModel,
      apiSurface: settings.apiSurface || 'responses',
      timeoutMs: settings.timeoutMs,
      allowInsecureTLS: settings.allowInsecureTLS
    }
    if (fetchImpl) options.fetchImpl = fetchImpl
    return createOpenAICompatibleAgentProvider(options)
  }
  return createDeterministicAgentProvider()
}

export function createImageProviderFromModelSettings(settings = {}, fetchImpl) {
  if (!settings?.enabled) return null
  if (settings.provider === 'codex-cli') {
    const codexOptions = resolveCodexImageProxySettings(settings)
    if (!codexOptions) return null
    if (fetchImpl) codexOptions.fetchImpl = fetchImpl
    return createOpenAICompatibleImageProvider(codexOptions)
  }
  if (settings.provider !== 'openai-compatible' || !settings.apiKey) return null
  const options = {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    defaultModel: normalizeImageModel(settings, 'gpt-image-2'),
    timeoutMs: settings.imageTimeoutMs || settings.timeoutMs,
    allowInsecureTLS: settings.allowInsecureTLS
  }
  if (fetchImpl) options.fetchImpl = fetchImpl
  return createOpenAICompatibleImageProvider(options)
}

export { buildActionResult, normalizeAgentModelText }
