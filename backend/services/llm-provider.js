function zeroUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
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

function normalizeAgentModelText(text = '') {
  const parsed = parseJsonObject(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { content: text, proposal: null }
  }
  const proposal = parsed.proposal || parsed.structuredProposal || parsed.agentProposal || null
  if (!proposal) return { content: text, proposal: null }
  return {
    content: parsed.content || parsed.message || parsed.answer || text,
    proposal
  }
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

function assignProviderError(target, fields = {}) {
  Object.assign(target, fields)
  return target
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

  if (/AbortError|aborted|timeout|timed?\s*out|超时|取消/i.test(`${error?.name || ''} ${sourceMessage}`)) {
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

  if (/api[_\s-]?key|unauthorized|invalid key|missing key|未配置|鉴权|认证|401|403/i.test(sourceMessage)) {
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

async function postJson({ fetchImpl, url, apiKey, timeoutMs, body, provider, model, apiSurface }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
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
    const data = await response.json()
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
    return data
  } catch (error) {
    throw normalizeModelProviderError(error, { provider, model, apiSurface, timeoutMs })
  } finally {
    clearTimeout(timer)
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
  const timer = setTimeout(() => controller.abort(), timeoutMs)
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
    return { response, close: () => clearTimeout(timer) }
  } catch (error) {
    clearTimeout(timer)
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
  const defaultTimeoutMs = Number(options.timeoutMs || 20000)
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

  return {
    name: 'openai-compatible',
    async *stream(context = {}, streamOptions = {}) {
      const model = context.model || options.defaultModel || 'gpt-5.5'
      const timeoutMs = Number(context.timeoutMs || defaultTimeoutMs)
      if (!apiKey) {
        throw normalizeModelProviderError(new Error('OPENAI_API_KEY 未配置'), {
          provider: 'openai-compatible',
          model,
          apiSurface,
          timeoutMs
        })
      }
      const endpoint = apiSurface === 'chat.completions' ? 'chat/completions' : 'responses'
      const body = apiSurface === 'chat.completions'
        ? {
            model,
            stream: true,
            stream_options: { include_usage: true },
            messages: [
              { role: 'system', content: context.systemPrompt },
              { role: 'user', content: chatUserContent(context) }
            ]
          }
        : {
            model,
            stream: true,
            instructions: context.systemPrompt,
            input: responsesInput(context)
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
        usage,
        provider: 'openai-compatible',
        model
      }
    },
    async generate(context = {}) {
      const model = context.model || options.defaultModel || 'gpt-5.5'
      const timeoutMs = Number(context.timeoutMs || defaultTimeoutMs)
      if (!apiKey) {
        throw normalizeModelProviderError(new Error('OPENAI_API_KEY 未配置'), {
          provider: 'openai-compatible',
          model,
          apiSurface,
          timeoutMs
        })
      }
      const endpoint = apiSurface === 'chat.completions' ? 'chat/completions' : 'responses'
      const body = apiSurface === 'chat.completions'
        ? {
            model,
            messages: [
              { role: 'system', content: context.systemPrompt },
              { role: 'user', content: chatUserContent(context) }
            ]
          }
        : {
            model,
            instructions: context.systemPrompt,
            input: responsesInput(context)
          }
      const raw = await postJson({
        fetchImpl,
        url: `${baseUrl}/${endpoint}`,
        apiKey,
        timeoutMs,
        body,
        provider: 'openai-compatible',
        model,
        apiSurface
      })
      const normalized = normalizeAgentModelText(extractResponseText(raw))
      return {
        content: normalized.content,
        proposal: normalized.proposal,
        actionResult: buildActionResult(context),
        usage: usageFromOpenAI(raw.usage || {}),
        provider: 'openai-compatible',
        model,
        raw
      }
    }
  }
}

export function createAgentProviderFromEnv(env = {}, fetchImpl = globalThis.fetch) {
  const provider = env.WORKFLOW_AGENT_PROVIDER || 'auto'
  const hasOpenAIConfig = Boolean(env.OPENAI_API_KEY)
  if (provider === 'deterministic' || (provider === 'auto' && !hasOpenAIConfig)) {
    return createDeterministicAgentProvider()
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

export { buildActionResult, normalizeAgentModelText }
