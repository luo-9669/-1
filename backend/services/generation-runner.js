import { getSkillDefinition } from './skill-registry.js'
import { validateSkillOutput } from './schema-validator.js'
import { buildSkillPrompt } from './prompt-builder.js'

function authPageOutput(context = {}) {
  const title = /注册/.test(context.input || '') ? '登录注册双页面' : '登录注册页面'
  return {
    intent: 'auth-page',
    title,
    sections: [
      {
        title: '功能说明',
        items: [
          '支持登录和注册表单切换。',
          '支持手机号或邮箱作为账号。',
          '支持密码显示/隐藏和基础格式校验。',
          '提交后由后端认证接口返回成功态或错误码。'
        ]
      },
      {
        title: '页面状态',
        items: ['初始态', '输入校验错误', '提交中', '认证失败', '成功跳转']
      }
    ],
    frontendHandoff: [
      '前端负责登录/注册 tab、表单输入、按钮禁用、错误展示和成功跳转。',
      '前端提交 account、password、captchaCode、agreeTerms 等字段给后端。',
      '前端根据后端 errorCode 映射字段错误或全局提示。'
    ],
    backendHandoff: [
      '后端负责账号存在性、密码校验、验证码校验、token 签发和注册写入。',
      '后端必须返回稳定错误码，避免前端解析自然语言。',
      '后端需要对登录、注册、发送验证码做限流和审计。'
    ],
    apiContract: [
      {
        method: 'POST',
        path: '/api/auth/login',
        description: '登录认证',
        requestFields: ['account', 'password'],
        responseFields: ['token', 'user', 'redirectUri']
      },
      {
        method: 'POST',
        path: '/api/auth/register',
        description: '注册账号',
        requestFields: ['account', 'password', 'captchaCode', 'agreeTerms'],
        responseFields: ['registered', 'autoLogin', 'nextAction']
      }
    ],
    html: [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>登录注册</title></head>',
      '<body><main><section><h1>登录</h1><form><input placeholder="手机号/邮箱"><input type="password" placeholder="密码"><button type="button">登录</button></form><button type="button">去注册</button></section></main></body>',
      '</html>'
    ].join(''),
    preview: {
      mode: 'html',
      entry: 'index.html'
    },
    qualityReport: {
      passed: true,
      checks: [
        { id: 'frontend-backend-handoff', passed: true, label: '前后端分工完整' },
        { id: 'api-contract', passed: true, label: '接口契约完整' },
        { id: 'html-preview', passed: true, label: 'HTML 预览可生成' }
      ]
    }
  }
}

function smartCanvasOutput(context = {}) {
  const intent = context.routing?.detectedIntent || context.detectedIntent || 'requirement-analysis'
  const isNoSkill = (context.skillId || context.routing?.resolvedSkillId) === 'none'
  const isAuthModal = intent === 'auth-modal' || /(弹窗|弹层|浮层|对话框|modal|dialog|popup)/i.test(context.input || '')
  const title = isNoSkill
    ? '不选择 Skill 自由画布方案'
    : isAuthModal ? '登录注册弹窗分析方案' : '智能推荐需求分析方案'
  const apiContract = isAuthModal
    ? [
        {
          method: 'POST',
          path: '/api/auth/login',
          description: '登录弹窗提交账号密码后由后端认证并返回 token、user、nextAction 或 errorCode。',
          requestFields: ['account', 'password', 'rememberMe?', 'redirectUri?'],
          responseFields: ['token', 'user', 'nextAction', 'redirectUri', 'errorCode?']
        },
        {
          method: 'POST',
          path: '/api/auth/register',
          description: '注册弹窗提交账号、验证码、密码和协议勾选，由后端创建账号并返回下一步。',
          requestFields: ['account', 'password', 'verificationCode', 'agreeTerms'],
          responseFields: ['registered', 'autoLogin', 'token?', 'nextAction', 'errorCode?']
        }
      ]
    : []
  return {
    mode: isNoSkill ? 'free-canvas' : undefined,
    intent: isAuthModal ? 'auth-modal' : intent,
    title,
    canvasTitle: isNoSkill ? title : undefined,
    canvasType: isNoSkill ? 'module-board' : undefined,
    layoutRule: isNoSkill ? 'top-down' : undefined,
    summary: isNoSkill ? '不套固定 Skill，由 AI 根据输入生成一个主画布、分组、节点和连线。' : undefined,
    groups: isNoSkill ? [
      {
        groupId: 'document-understanding',
        groupName: '文档理解',
        groupDesc: '识别输入材料的真实需求和范围',
        nodes: [
          {
            nodeId: 'analysis',
            nodeType: 'module',
            nodeName: '文档自主分析',
            summary: '不套固定 Skill，先根据输入材料识别真实需求边界。',
            highlights: ['业务对象', '用户目标', '交付边界'],
            sections: [
              {
                title: '识别重点',
                items: [
                  context.input || '暂无输入',
                  '识别材料中的业务对象、用户目标、平台边界和必须交付的功能。',
                  '把事实、推断、待确认项分开，避免混入其它历史方案。'
                ]
              }
            ]
          }
        ]
      },
      {
        groupId: 'canvas-output',
        groupName: '画布输出',
        groupDesc: '自动生成单画布结构',
        nodes: [
          {
            nodeId: 'canvas-structure',
            nodeType: 'module',
            nodeName: '自由画布结构',
            summary: '由模型决定节点数量、标题和顺序，并直接落到一个主画布。',
            highlights: ['groups', 'nodes', 'edges'],
            sections: [
              {
                title: '生成规则',
                items: [
                  '节点围绕当前文档生成，不继承固定 Skill 的节点模板。',
                  '每个节点只在卡片展示摘要和重点，详细内容进入 sections。',
                  '真实模型返回多少节点，前端先展示多少节点。'
                ]
              }
            ]
          },
          {
            nodeId: 'handoff-review',
            nodeType: 'step',
            nodeName: '交付与验收',
            summary: '补齐前端、后端、测试可接管的边界和验收点。',
            highlights: ['前端边界', '后端接口', '测试验收'],
            sections: [
              {
                title: '接管范围',
                items: [
                  '前端：页面/组件/状态/交互路径。',
                  '后端：接口、数据结构、解析、模型调用和异常恢复。',
                  '测试：主路径、异常场景、重复上传、重新分析和历史隔离。'
                ]
              }
            ]
          }
        ]
      }
    ] : undefined,
    edges: isNoSkill ? [
      { fromNodeId: 'analysis', toNodeId: 'canvas-structure', edgeLabel: '生成结构' },
      { fromNodeId: 'canvas-structure', toNodeId: 'handoff-review', edgeLabel: '进入交付' }
    ] : undefined,
    sections: [
      {
        title: isNoSkill ? '自主分析结论' : '模型分析结论',
        items: isNoSkill
          ? [
              '用户明确选择不套固定 Skill，当前输出按上传文档和原始输入自主拆解。',
              '画布节点应围绕文档里的真实业务对象、页面/Tab、核心流程、异常兜底和交付边界组织。',
              '后续接入真实模型时，后端会保留该模式并把模型返回的 canvas.nodes 直接写入画布。'
            ]
          : isAuthModal
          ? [
              '用户要的是登录注册弹窗，不是独立登录注册页面。',
              '默认使用智能推荐 Skill 的 design-scheme-ux / UX 决策链路，内容由模型基于输入生成。',
              '弹窗确认/提交必须把表单数据交给后端，后端返回结构化结果驱动前端状态。'
            ]
          : [context.input || '暂无输入', '按智能推荐 Skill 的 design-scheme-ux / UX 决策链路生成可进入画布的分析结果。']
      },
      {
        title: isNoSkill ? '画布拆解原则' : '用户行为与功能层级',
        items: isNoSkill
          ? [
              '不要复用其它固定模板，除非输入文档本身明确要求。',
              '每个节点必须能被产品、UX、前端、后端、测试单独评审。',
              '复杂模块优先拆成信息层级、分 Tab/页面方案、核心交互、异常状态、接口与验收。'
            ]
          : [
              '先判断用户当前想完成的任务、第一眼想看到的信息和不需要出现的内容。',
              '把功能拆成主要功能、同级功能、次要功能、三级功能和最低等级不展示内容。'
            ]
      },
      {
        title: '页面形态、路径与生命周期',
        items: [
          '为页面、二级页面、弹窗、抽屉、内联区域、新页签、Toast、Banner 和状态页说明使用条件。',
          '补齐入口、跳转、返回点，以及筛选、搜索、分页、滚动、选中项、草稿和生成结果的保留规则。',
          '定义弹窗与提示生命周期：关闭方式、Toast 停留时长、Loading 超时和关键错误恢复。'
        ]
      },
      {
        title: '画布更新策略',
        items: ['用户确认 Agent 补充后，后端合并原画布与确认内容，返回完整新画布，前端替换显示。']
      }
    ],
    frontendHandoff: isAuthModal
      ? [
          '前端接管弹窗打开/关闭、登录注册切换、字段输入、loading、错误提示和成功关闭。',
          '前端点击提交时调用后端接口，不在本地伪造认证成功。',
          '前端根据后端 errorCode 映射字段错误、全局提示或下一步动作。'
        ]
      : ['前端接管画布展示、用户确认按钮、刷新 loading 和结果替换。'],
    backendHandoff: isAuthModal
      ? [
          '后端接管账号认证、注册写入、验证码、限流、token 签发和错误码。',
          '后端接入大模型用于需求分析链路，认证业务本身仍由领域服务保证确定性。',
          '后端返回完整 analysis/canvas，前端不拼接关键业务结论。'
        ]
      : ['后端接管 Skill 编排、模型调用、结果校验、fallback 和画布重算。'],
    apiContract,
    canvas: isNoSkill ? undefined : {
      nodes: isNoSkill ? [
        {
          id: 'analysis',
          title: '文档自主分析',
          summary: '不套固定 Skill，先根据输入材料识别真实需求边界。',
          content: [
            context.input || '暂无输入',
            '识别材料中的业务对象、用户目标、平台边界和必须交付的功能。',
            '把事实、推断、待确认项分开，避免混入其它历史方案。'
          ]
        },
        {
          id: 'canvas-structure',
          title: '自由画布结构',
          summary: '由模型决定节点数量、标题和顺序，并直接落到画布。',
          content: [
            '节点围绕当前文档生成，不继承固定 Skill 的节点模板。',
            '每个节点包含 summary、content、detailSections 和可追问动作。',
            '真实模型返回 canvas.nodes 后，前端按返回多少先展示多少。'
          ]
        },
        {
          id: 'handoff-review',
          title: '交付与验收',
          summary: '补齐前端、后端、测试可接管的边界和验收点。',
          content: [
            '前端：页面/组件/状态/交互路径。',
            '后端：接口、数据结构、解析、模型调用和异常恢复。',
            '测试：主路径、异常场景、重复上传、重新分析和历史隔离。'
          ]
        }
      ] : [
        {
          id: 'analysis',
          title: isAuthModal ? '登录注册弹窗分析' : '智能推荐分析',
          summary: isAuthModal ? '识别为弹窗级认证交互，需要补齐前后端数据链路。' : '按智能推荐 Skill 生成分析画布。',
          content: isAuthModal
            ? ['形态：弹窗/Modal', '提交：前端 POST 后端', '反馈：后端返回 token/user/errorCode/nextAction']
            : [context.input || '暂无输入']
        },
        {
          id: 'design-scheme-ux',
          title: 'UX 决策链路',
          summary: '用户行为、功能层级、页面形态、路径返回、状态错误和弹窗提示生命周期。',
          content: [
            '用户行为结论：识别用户想完成什么、先看什么、不需要看什么。',
            '功能层级：主要/同级/次要/三级/最低等级。',
            '形态决策：页面、二级页面、弹窗、抽屉、内联、新页签、Toast、Banner、状态页。',
            '返回状态：保留筛选、搜索、滚动、选中项、草稿和生成结果。',
            '生命周期：确认弹窗不自动消失，成功 Toast 2-3 秒，错误 Toast 至少 6 秒且提供恢复动作。'
          ]
        }
      ]
    },
    qualityReport: {
      passed: true,
      checks: [
        { id: 'ux-framework', passed: true, label: '已使用智能推荐 UX 框架' },
        { id: 'surface-decision', passed: true, label: '已覆盖页面形态决策' },
        { id: 'overlay-lifecycle', passed: true, label: '已覆盖弹窗与提示生命周期' },
        { id: 'route-return-state', passed: true, label: '已覆盖路径与返回状态' },
        { id: 'frontend-backend-handoff', passed: true, label: '前后端分工明确' },
        { id: 'api-contract', passed: !isAuthModal || apiContract.length > 0, label: '接口契约完整' }
      ]
    }
  }
}

function deterministicOutput(skill, context) {
  if (skill.outputSchema === 'auth-page') return authPageOutput(context)
  if (skill.outputSchema === 'smart-canvas') return smartCanvasOutput(context)
  return {
    intent: context.routing?.detectedIntent || 'requirement-analysis',
    sections: [{ title: '分析结果', items: [context.input || '暂无输入'] }],
    qualityReport: { passed: true, checks: [] }
  }
}

export function safeParseModelJson(content = '') {
  const raw = String(content || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || raw
  try {
    return { ok: true, value: JSON.parse(candidate), error: '' }
  } catch (error) {
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0]
    if (objectText && objectText !== candidate) {
      try {
        return { ok: true, value: JSON.parse(objectText), error: '' }
      } catch {}
    }
    return { ok: false, value: null, error: error.message || 'JSON 解析失败' }
  }
}

function deterministicGeneration(skill, context = {}, fallbackReason = '') {
  const output = deterministicOutput(skill, context)
  const validation = validateSkillOutput(skill.outputSchema, output)
  return {
    status: validation.ok ? 'generated' : 'invalid',
    provider: 'deterministic',
    model: 'deterministic-v1',
    fallbackUsed: Boolean(fallbackReason),
    fallbackReason,
    skill,
    output,
    validation,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }
}

function failedGeneration(skill, context = {}, fallbackReason = '') {
  return {
    status: 'failed',
    provider: context.agentProvider?.name || '',
    model: context.model || '',
    fallbackUsed: false,
    fallbackReason,
    skill,
    output: null,
    validation: {
      ok: false,
      schemaId: skill.outputSchema,
      missing: [],
      issues: [fallbackReason || 'model generation failed']
    },
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }
}

function recordModelCall(context = {}, entry = {}) {
  const target = context.modelCallLog
  if (!target) return
  const inputPreview = String(context.input || context.prompt || '').trim().slice(0, 240)
  const promptPreview = String(entry.promptPreview || context.systemPrompt || context.userPrompt || '').trim().slice(0, 240)
  const log = {
    id: `model-call-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    runId: context.analysisRunId || context.runId || context.requestId || '',
    skillId: context.skillId || context.routing?.resolvedSkillId || '',
    requestedSkillId: context.routing?.requestedSkillId || context.requestedSkillId || '',
    resolvedSkillId: context.routing?.resolvedSkillId || context.skillId || '',
    demandScope: context.demandScope || '',
    projectId: context.projectId || context.project?.id || '',
    detectedIntent: context.routing?.detectedIntent || context.detectedIntent || '',
    routingReason: context.routing?.routingReason || context.routingReason || '',
    inputPreview,
    promptPreview,
    createdAt: new Date().toISOString(),
    ...entry
  }
  if (Array.isArray(target)) target.push(log)
  else if (typeof target === 'function') target(log)
}

function generationTimeoutMs(context = {}) {
  if (context.generationTimeoutMs === 0 || context.timeoutMs === 0) return 0
  const value = Number(context.generationTimeoutMs || context.timeoutMs || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

async function generateWithTimeout(provider, payload = {}, timeoutMs = 0) {
  if (!timeoutMs) return provider.generate(payload)
  let timer = null
  try {
    return await Promise.race([
      provider.generate(payload),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`模型生成超时：${timeoutMs}ms`)
          error.code = 'SKILL_GENERATION_TIMEOUT'
          error.timeoutMs = timeoutMs
          reject(error)
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function generateModelResult(provider, payload = {}, timeoutMs = 0) {
  return generateWithTimeout(provider, payload, timeoutMs)
}

async function streamModelResult(provider, payload = {}, timeoutMs = 0, options = {}) {
  if (typeof provider.stream !== 'function') return generateModelResult(provider, payload, timeoutMs)
  const onDelta = typeof options.onDelta === 'function' ? options.onDelta : null
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null
  const controller = new AbortController()
  let timer = null
  if (timeoutMs) {
    timer = setTimeout(() => controller.abort(), timeoutMs)
  }
  let finalResult = null
  let content = ''
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  try {
    for await (const event of provider.stream(payload, { signal: controller.signal })) {
      if (event?.type === 'delta' && event.content) {
        content += event.content
        onEvent?.(event)
        onDelta?.(event.content)
      } else if (event?.type === 'status') {
        onEvent?.(event)
      }
      if (event?.type === 'final') {
        finalResult = event
        if (event.content) content = event.content
        if (event.usage) usage = event.usage
      }
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
  return {
    content: finalResult?.content || content,
    proposal: finalResult?.proposal || null,
    usage: finalResult?.usage || usage,
    provider: finalResult?.provider || provider.name || 'model',
    model: finalResult?.model || payload.model || '',
    raw: finalResult?.raw || null
  }
}

async function generateModelResultWithCompatibilityRetry(provider, payload = {}, timeoutMs = 0, options = {}) {
  const shouldStream = Boolean(options.onDelta || options.onEvent)
  try {
    const result = shouldStream
      ? await streamModelResult(provider, payload, timeoutMs, options)
      : await generateModelResult(provider, payload, timeoutMs)
    return { result, retryReason: '' }
  } catch (error) {
    if (!options.allowRetryWithoutMaxOutputTokens || !payload.maxOutputTokens) throw error
    const retryPayload = removeOutputTokenLimits(payload)
    const result = shouldStream
      ? await streamModelResult(provider, retryPayload, timeoutMs, options)
      : await generateModelResult(provider, retryPayload, timeoutMs)
    return {
      result,
      retryReason: `首次模型调用失败：${error.message || 'unknown error'}；已去掉输出 token 上限后重试成功。`
    }
  }
}

function removeOutputTokenLimits(payload = {}) {
  const retryPayload = { ...payload }
  delete retryPayload.maxOutputTokens
  delete retryPayload.max_output_tokens
  delete retryPayload.maxTokens
  delete retryPayload.max_tokens
  return retryPayload
}

function buildJsonParseRetryPayload(payload = {}, parseError = '') {
  const retryPayload = removeOutputTokenLimits(payload)
  retryPayload.systemPrompt = [
    payload.systemPrompt || '',
    '',
    '上一次输出的 JSON 不完整或无法解析。',
    `解析错误：${parseError || 'JSON 解析失败'}`,
    '请重新生成，并且只返回一个完整、可被 JSON.parse 解析的 JSON 对象。',
    '不要输出 Markdown、解释文字、代码块或省略号。'
  ].filter(Boolean).join('\n')
  return retryPayload
}

async function retryModelResultAfterJsonParseError(provider, payload = {}, timeoutMs = 0, parseError = '', options = {}) {
  const retryPayload = buildJsonParseRetryPayload(payload, parseError)
  const shouldStream = Boolean(options.onDelta || options.onEvent)
  const result = shouldStream
    ? await streamModelResult(provider, retryPayload, timeoutMs, options)
    : await generateModelResult(provider, retryPayload, timeoutMs)
  return {
    result,
    retryReason: `首次模型 JSON 解析失败：${parseError || 'unknown error'}；已要求模型重新输出完整 JSON。`
  }
}

export function runSkillGenerationSync(context = {}) {
  const skill = getSkillDefinition(context.skillId || context.routing?.resolvedSkillId, context.skillOrchestration)
  return deterministicGeneration(skill, context)
}

export async function runSkillGeneration(context = {}) {
  const skill = getSkillDefinition(context.skillId || context.routing?.resolvedSkillId, context.skillOrchestration)
  const provider = context.agentProvider
  const requiresRealModel = (context.skillId || context.routing?.resolvedSkillId) === 'none'
  if ((!provider || provider.name === 'deterministic') && requiresRealModel) {
    return failedGeneration(skill, context, '不选择 Skill 必须调用真实模型生成画布，当前未配置可用模型或仍在使用 deterministic fallback。')
  }
  if (!provider || provider.name === 'deterministic') return deterministicGeneration(skill, context)

  const prompt = buildSkillPrompt({ ...context, skill })
  const startedAt = Date.now()
  try {
    const timeoutMs = generationTimeoutMs(context)
    const modelPayload = {
      ...context,
      ...prompt,
      model: context.model,
      maxOutputTokens: context.maxOutputTokens || prompt.maxOutputTokens
    }
    let { result: modelResult, retryReason } = await generateModelResultWithCompatibilityRetry(provider, modelPayload, timeoutMs, {
      allowRetryWithoutMaxOutputTokens: requiresRealModel,
      onDelta: typeof context.onModelDelta === 'function' ? context.onModelDelta : null,
      onEvent: typeof context.onModelEvent === 'function' ? context.onModelEvent : null
    })
    let parsed = safeParseModelJson(modelResult.content)
    if (!parsed.ok && requiresRealModel) {
      const retry = await retryModelResultAfterJsonParseError(provider, modelPayload, timeoutMs, parsed.error, {
        onDelta: typeof context.onModelDelta === 'function' ? context.onModelDelta : null,
        onEvent: typeof context.onModelEvent === 'function' ? context.onModelEvent : null
      })
      modelResult = retry.result
      retryReason = [retryReason, retry.retryReason].filter(Boolean).join('；')
      parsed = safeParseModelJson(modelResult.content)
    }
    if (!parsed.ok) {
      const fallbackReason = `模型 JSON 解析失败：${parsed.error}`
      recordModelCall(context, {
        provider: modelResult.provider || provider.name || 'model',
        model: modelResult.model || context.model || '',
        status: 'fallback',
        durationMs: Date.now() - startedAt,
        usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackReason
      })
      return requiresRealModel ? failedGeneration(skill, context, fallbackReason) : deterministicGeneration(skill, context, fallbackReason)
    }
    const validation = validateSkillOutput(skill.outputSchema, parsed.value)
    if (!validation.ok) {
      const fallbackReason = `模型输出校验失败：missing=${validation.missing.join(',')} issues=${validation.issues.join(',')}`
      recordModelCall(context, {
        provider: modelResult.provider || provider.name || 'model',
        model: modelResult.model || context.model || '',
        status: 'fallback',
        durationMs: Date.now() - startedAt,
        usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackReason
      })
      return requiresRealModel ? failedGeneration(skill, context, fallbackReason) : deterministicGeneration(skill, context, fallbackReason)
    }
    recordModelCall(context, {
      provider: modelResult.provider || provider.name || 'model',
      model: modelResult.model || context.model || '',
      status: 'success',
      durationMs: Date.now() - startedAt,
      usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      promptPreview: String(prompt.userPrompt || prompt.systemPrompt || '').trim().slice(0, 240),
      fallbackReason: ''
    })
    return {
      status: 'generated',
      provider: modelResult.provider || provider.name || 'model',
      model: modelResult.model || context.model || '',
      fallbackUsed: false,
      fallbackReason: retryReason || '',
      skill,
      output: parsed.value,
      validation,
      usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      rawContent: modelResult.content || '',
      content: modelResult.content || '',
      raw: modelResult.raw || null,
      prompt
    }
  } catch (error) {
    const fallbackReason = `模型调用失败：${error.message || 'unknown error'}`
    recordModelCall(context, {
      provider: provider.name || 'model',
      model: context.model || '',
      status: error.code === 'SKILL_GENERATION_TIMEOUT' ? 'fallback' : 'error',
      durationMs: Date.now() - startedAt,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      fallbackReason
    })
    return requiresRealModel ? failedGeneration(skill, context, fallbackReason) : deterministicGeneration(skill, context, fallbackReason)
  }
}
