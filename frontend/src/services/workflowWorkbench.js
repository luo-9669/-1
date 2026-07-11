const STATUS_LABELS = {
  locked: '未解锁',
  active: '可生成',
  generated: '待确认',
  challenged: '待确认',
  accepted: '已确认',
  completed: '已完成'
}

const EXAMPLE_INPUTS = {
  '目标创作者': '独立播客创作者、自媒体 IP、内容营销人员、轻量知识变现用户',
  '核心痛点': '出镜门槛高、脚本/配音/视频制作割裂、缺少灵感和一键同款、多端分发成本高',
  '产品定位': '零门槛的 AI 播客工作站',
  '一期范围': '脚本生成、音频播客生成、视频播客生成、图片+波纹图播客、作品存储、核心资产库',
  '成功标准': '用户能从一个想法、URL、文档或音频开始，在同一工作流内生成脚本、音频、视频并沉淀资产',
  '首页入口': 'Turn Your Ideas Into Podcasts 首屏创作模块',
  '输入方式': '文本提示词、URL 链接、上传 PDF/PPT/DOCX、上传音频',
  '核心编辑器': '左侧播客主持人选择，右侧脚本预览、编辑和生成操作',
  '关键操作': '预览音频、下载脚本、复制脚本、替换音色、角色对调、增加停顿、生成视频播客',
  '资产类型': '脚本&灵感库、音色&音频资产库、播客主播库、作品库、背景和波纹图',
  '分发渠道': 'YouTube，后续 Spotify、Apple Podcast、TikTok/Instagram Reels 短切片',
  '验收标准': '用户能从文本/URL/文档/音频任一入口开始，完成脚本生成或解析、预览音频、选择主持人和音色、生成视频播客并保存作品'
}

const CHAT_ONLY_STAGE_AGENT_SCOPES = [
  'requirement-dissection',
  'requirement-dissection-agent',
  'requirement-slicing',
  'requirement-slicing-agent',
  'gap-confirmation',
  'gap-confirmation-agent'
]

const WORKFLOW_AGENT_STAGE_SCOPE_TITLES = {
  'requirement-dissection': '需求分析',
  'interaction-lofi': '交互低保',
  'ui-visual': 'UI视觉',
  'html-demo': 'HTML',
  'vue-export': 'Vue',
  'acceptance-deposit': '验收沉淀'
}

const REQUIREMENT_DISSECTION_STAGE_ADVANCE_REPLY = '进入交互低保'
const REQUIREMENT_DISSECTION_LEGACY_STAGE_ADVANCE_REPLIES = ['输出页面框架', REQUIREMENT_DISSECTION_STAGE_ADVANCE_REPLY]
const REQUIREMENT_DISSECTION_FIXED_QUICK_REPLIES = ['补充背景', '列出风险']

function stepNumber(step = {}, steps = []) {
  const index = steps.findIndex((item) => item.id === step.id)
  return index >= 0 ? index + 1 : 1
}

function previousStep(step = {}, steps = []) {
  const index = steps.findIndex((item) => item.id === step.id)
  return index > 0 ? steps[index - 1] : null
}

function compactReplies(items = [], fallback = []) {
  const seen = new Set()
  return [...items, ...fallback]
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function keepRequiredQuickReply(replies = [], requiredReply = '', limit = 6) {
  const next = replies.slice(0, limit)
  const required = String(requiredReply || '').trim()
  if (!required || next.includes(required)) return next
  if (next.length < limit) return [...next, required]
  return [...next.slice(0, Math.max(limit - 1, 0)), required]
}

function normalizeRequirementDissectionQuickReplyLabel(reply = '') {
  const normalized = String(reply || '').trim()
  return REQUIREMENT_DISSECTION_LEGACY_STAGE_ADVANCE_REPLIES.includes(normalized)
    ? ''
    : normalized
}

export function normalizeRequirementDissectionQuickReplies(replies = [], limit = 6) {
  const normalizedReplies = replies.map(normalizeRequirementDissectionQuickReplyLabel)
  const fixedReplies = new Set([
    ...REQUIREMENT_DISSECTION_FIXED_QUICK_REPLIES,
    ...REQUIREMENT_DISSECTION_LEGACY_STAGE_ADVANCE_REPLIES
  ])
  const orderedReplies = compactReplies([
    ...normalizedReplies.filter((reply) => !fixedReplies.has(String(reply || '').trim()))
  ], [])
  return orderedReplies.slice(0, limit)
}

function modelOptionLabel(model = '') {
  if (model === 'gpt-5.5') return 'GPT-5.5'
  return model || 'GPT-5.5'
}

function stringifyWorkflowAgentDisplayValue(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '').trim()
  }
}

function extractWorkflowAgentJsonObjectText(source = '') {
  const text = String(source || '').trim()
  const start = text.indexOf('{')
  if (start < 0) return ''
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = inString
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return ''
}

export function normalizeWorkflowAgentReplyContent(content = '') {
  const source = stringifyWorkflowAgentDisplayValue(content)
  if (!source) return source
  const jsonSource = /^[{\[]/.test(source) ? source : extractWorkflowAgentJsonObjectText(source)
  if (!jsonSource) return decodeWorkflowAgentEscapedWhitespace(source)
  try {
    const parsed = JSON.parse(jsonSource)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return source
    const displayKeys = ['displayContent', 'reply', 'content', 'markdown', 'text', 'answer', 'message']
    for (const key of displayKeys) {
      const value = stringifyWorkflowAgentDisplayValue(parsed[key])
      if (value) return decodeWorkflowAgentEscapedWhitespace(value)
    }
  } catch {
    return decodeWorkflowAgentEscapedWhitespace(source)
  }
  return decodeWorkflowAgentEscapedWhitespace(source)
}

function decodeWorkflowAgentEscapedWhitespace(content = '') {
  return String(content || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
}

function workflowAgentMessageRequestId(message = {}) {
  return String(message?.meta?.clientMessageId || message?.clientMessageId || '').trim()
}

function isPendingWorkflowAgentAssistantMessage(message = {}) {
  return message?.role === 'assistant' && ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status)
}

function normalizeWorkflowAgentSessionMessages(messages = []) {
  const normalizedMessages = messages.map((message, index) => ({
    id: message.id || `message-${index}`,
    role: message.role || 'user',
    content: message.role === 'assistant'
      ? normalizeWorkflowAgentReplyContent(message.content)
      : stringifyWorkflowAgentDisplayValue(message.content),
    createdAt: message.createdAt || '',
    trace: Array.isArray(message.trace) ? message.trace : [],
    meta: message.meta || null
  }))
  const requestsWithFinalAssistant = new Set(normalizedMessages
    .filter((message) => message.role === 'assistant' && !isPendingWorkflowAgentAssistantMessage(message))
    .map(workflowAgentMessageRequestId)
    .filter(Boolean))
  const seenUserRequestIds = new Set()
  return normalizedMessages.filter((message) => {
    const requestId = workflowAgentMessageRequestId(message)
    if (!requestId) return true
    if (message.role === 'user') {
      if (seenUserRequestIds.has(requestId)) return false
      seenUserRequestIds.add(requestId)
      return true
    }
    if (isPendingWorkflowAgentAssistantMessage(message) && requestsWithFinalAssistant.has(requestId)) return false
    return true
  })
}

export function workflowChatOnlyStageScopes() {
  return [...CHAT_ONLY_STAGE_AGENT_SCOPES]
}

export function isWorkflowChatOnlyStageScope(scopeId = '') {
  return CHAT_ONLY_STAGE_AGENT_SCOPES.includes(String(scopeId || '').trim())
}

function workflowAgentStageScopeTitle(scopeId = '', current = {}) {
  const normalizedScopeId = String(scopeId || '').trim()
  return WORKFLOW_AGENT_STAGE_SCOPE_TITLES[normalizedScopeId] || current.title || normalizedScopeId || '当前步骤'
}

function advancedUxAgentSessionScopeOrder(run = {}, scopeId = '') {
  const sessions = run.agentSessions && typeof run.agentSessions === 'object' ? run.agentSessions : {}
  const stageOrder = Object.keys(WORKFLOW_AGENT_STAGE_SCOPE_TITLES)
  const stageScopeSet = new Set(stageOrder)
  const ordered = []
  const addScope = (value = '') => {
    const key = String(value || '').trim()
    if (!key || ordered.includes(key)) return
    if (!stageScopeSet.has(key)) return
    if (!Array.isArray(sessions[key])) return
    ordered.push(key)
  }
  stageOrder.forEach(addScope)
  addScope(scopeId)
  Object.keys(sessions).forEach(addScope)
  return ordered
}

function advancedUxMergedAgentSessionMessages(run = {}, scopeId = '') {
  if (!isAdvancedUxWorkflowRun(run)) return null
  const sessions = run.agentSessions && typeof run.agentSessions === 'object' ? run.agentSessions : {}
  const messages = advancedUxAgentSessionScopeOrder(run, scopeId).flatMap((sourceScopeId) =>
    (Array.isArray(sessions[sourceScopeId]) ? sessions[sourceScopeId] : []).map((message, index) => ({
      ...message,
      id: message.id || `${sourceScopeId}-message-${index}`,
      meta: {
        ...(message.meta || {}),
        sourceScopeId: message.meta?.sourceScopeId || sourceScopeId
      }
    }))
  )
  return advancedUxMessagesWithoutDuplicatePlainFailures(messages, run)
}

function advancedUxMessagesWithoutDuplicatePlainFailures(messages = [], run = {}) {
  const reportMessages = messages.filter((message) =>
    message?.role === 'assistant' &&
    message?.meta?.action === 'advanced-ux-markdown-report' &&
    (String(message?.meta?.markdown || '').trim() || String(message?.meta?.importError || '').trim() || String(message?.content || '').trim())
  )
  if (!reportMessages.length) return messages
  const failureTexts = new Set([
    run?.documentAnalysis?.advancedUxReport?.importError,
    run?.documentAnalysis?.totalDesignFlow?.advancedUxReport?.importError,
    ...reportMessages.flatMap((message) => [message?.meta?.importError, message?.content])
  ].map((item) => String(item || '').trim()).filter(Boolean))
  const isInternalRuntimeNoise = (value = '') =>
    /codex_core_plugins|plugin catalog|401 Unauthorized|find_thread_path_by_id_str|\.codex\/\.tmp\/plugins|thread in cwd|WARN\s|DEBUG\s|INFO\s|startup warning|failed to load plugin/i.test(String(value || ''))
  return messages.filter((message) => {
    if (message?.role !== 'assistant') return true
    if (message?.meta?.action === 'advanced-ux-markdown-report') return true
    if (message?.meta?.action !== 'workflow-analysis-result') return true
    const content = String(message.content || '').trim()
    if (!content) return true
    if (isInternalRuntimeNoise(content)) return false
    if (failureTexts.has(content)) return false
    return !/^高级 UX Markdown 未符合输出规范/.test(content)
  })
}

function isRequirementDissectionAgentScope(scopeId = '', activeNode = null, current = {}) {
  const values = [
    scopeId,
    activeNode?.id,
    activeNode?.stageId,
    activeNode?.title,
    current?.id,
    current?.title
  ].map((item) => String(item || '').trim())
  return values.some((item) => item === 'requirement-dissection' || item === 'requirement-dissection-agent' || item === '需求分析' || item === '需求解剖')
}

export function buildWorkflowStageConfirmationSummary({
  action = '',
  messages = [],
  fallback = '',
  defaultAssumption = false
} = {}) {
  const assistantMessages = Array.isArray(messages)
    ? messages.filter((item) => item?.role === 'assistant' && String(item?.content || '').trim())
    : []
  const latestAssistant = assistantMessages.at(-1)
  const base = String(latestAssistant?.content || fallback || action || '当前阶段已确认').trim()
  if (!base) return '当前阶段已确认'
  return defaultAssumption && !/默认假设|风险/.test(base)
    ? `默认假设继续：${base}`
    : base
}

export function lockReasonForStep(run = {}, step = {}) {
  if (step.status !== 'locked') return ''
  const steps = run.steps || []
  const previous = previousStep(step, steps)
  if (!previous) return '请先开始当前流程。'
  const required = (previous.requiredFields || []).join('、') || '前置信息'
  return `请先确认 Step ${stepNumber(previous, steps)} 的${required}。`
}

export function defaultWorkflowStepInputs(run = {}, step = {}, mode = 'example') {
  const source = mode === 'skip' ? '默认假设' : ''
  return Object.fromEntries((step.requiredFields || []).map((field) => {
    const value = EXAMPLE_INPUTS[field] || `${source}${field || '字段'}`
    return [field, value]
  }))
}

export function buildWorkflowWorkbenchView(run = {}) {
  const steps = run.steps || []
  const current = steps.find((step) => step.id === run.currentStepId) || steps[0] || {}
  const currentOutput = run.stepOutputs?.[current.id] || ''
  const currentDraft = run.stepDraftOutputs?.[current.id] || ''
  const hasDraft = Boolean(String(currentDraft || currentOutput).trim())
  const hasAccepted = Boolean(String(currentOutput).trim())
  const currentNumber = stepNumber(current, steps)

  return {
    title: 'AI 分步工作台',
    subtitle: 'AI 会先基于资料生成草稿，你可以编辑、质疑、重新生成，再采纳进入下一步。',
    steps: steps.map((step) => ({
      id: step.id,
      title: step.title,
      goal: step.goal,
      status: step.status,
      statusLabel: STATUS_LABELS[step.status] || '待处理',
      canInspect: true,
      lockReason: lockReasonForStep(run, step),
      requiredFields: step.requiredFields || [],
      hasOutput: Boolean(run.stepOutputs?.[step.id]),
      isCurrent: step.id === current.id
    })),
    current: {
      id: current.id,
      title: current.title,
      goal: current.goal,
      stepNumber: currentNumber,
      requiredFields: current.requiredFields || [],
      taskHint: `这一步用于${current.goal || '生成当前步骤草稿'}。AI 会先根据上传资料生成草稿，你可以编辑后确认。`,
      emptyOutputHint: '点击生成本步草稿后，AI 产出会出现在这里。',
      primaryAction: hasAccepted
        ? { id: 'next', label: currentNumber < steps.length ? '进入下一步' : '完成完整流程' }
        : hasDraft
          ? { id: 'accept-next', label: currentNumber < steps.length ? `采纳并进入 Step ${currentNumber + 1}` : '采纳并完成流程' }
          : { id: 'generate', label: '生成本步草稿' },
      secondaryActions: [
        { id: 'use-example', label: '使用示例' },
        { id: 'skip-defaults', label: '跳过，使用默认假设' },
        { id: 'view-evidence', label: '查看依据' },
        { id: 'regenerate', label: '重新生成', disabled: !hasDraft }
      ]
    }
  }
}

export function buildWorkflowAgentQuickReplies(run = {}, context = {}) {
  if (run.skillId === 'dialogue-skill') return ['生成方案画布', '转 UX 设计确认']
  const current = context.current || (run.steps || []).find((step) => step.id === run.currentStepId) || (run.steps || [])[0] || {}
  const activeNode = context.activeNode || null
  const scopeId = context.scopeId || activeNode?.id || current.id || 'step'
  const draft = context.draft ?? run.stepDraftOutputs?.[current.id] ?? ''
  const output = context.output ?? run.stepOutputs?.[current.id] ?? ''
  const references = run.referenceFiles?.[scopeId] || []
  const hasDraft = Boolean(String(draft || '').trim())
  const hasOutput = Boolean(String(output || '').trim())
  const hasReferenceIssues = references.some((file) => ['failed', 'uploading', 'pending'].includes(file.status))
  const artifactReplies = []
  const artifacts = run.demoArtifacts || {}
  const actionType = context.actionResult?.type || context.actionType || ''
  const error = context.error || context.assistantMessage?.meta?.error || null
  const chatOnlyStageReplies = []
  const isRequirementDissectionScope = isRequirementDissectionAgentScope(scopeId, activeNode, current)
  const fixedStageReplies = []
  const actionRepliesByType = {
    'module-breakdown': ['确认框架', '补接口契约', '拆前后端'],
    'page-generation': ['确认页面清单', '补交互状态', '补异常流程'],
    'interaction-flow': ['确认流程', '补边界状态', '生成低保真'],
    'agent-supplement': ['确认已更新', '继续补充', '查看后续影响'],
    blueprint: ['确认蓝图', '生成低保真', '补业务规则']
  }
  const errorReplies = error
    ? ['重试']
    : []
  if (errorReplies.length) return errorReplies

  if (run.projectBlueprint) {
    if (!artifacts.lowFi) artifactReplies.push('生成低保真')
    else if (!artifacts.html) artifactReplies.push('生成可交互 HTML')
    else if (!artifacts.vueZipReady && !(artifacts.vueFiles || []).length) artifactReplies.push('导出 Vue 代码')
  } else if (hasOutput || hasDraft) {
    artifactReplies.push('生成蓝图')
  }

  const stateReplies = hasOutput
    ? ['进入下一步', '补充细节', '查看历史']
    : hasDraft
      ? ['采纳并进入下一步', '重新生成', '补充资料']
      : []

  const replies = compactReplies([
    ...chatOnlyStageReplies,
    ...errorReplies,
    ...(hasReferenceIssues ? ['检查参考文件'] : []),
    ...(actionRepliesByType[actionType] || []),
    ...(activeNode?.agentInteraction?.quickReplies || []),
    ...(activeNode?.quickActions || []),
    ...fixedStageReplies,
    ...stateReplies,
    ...artifactReplies
  ], [])

  return isRequirementDissectionScope
    ? normalizeRequirementDissectionQuickReplies(replies, 6)
    : replies.slice(0, 6)
}

export function buildWorkflowAgentSession(run = {}, options = {}) {
  const steps = run.steps || []
  const current = steps.find((step) => step.id === run.currentStepId) || steps[0] || {}
  const activeNode = options.activeNode || null
  const scopeId = options.scopeId || activeNode?.id || current.id || 'step'
  const scopeIsActiveNodeStage = Boolean(activeNode?.stageId && scopeId === activeNode.stageId)
  const scopeTitle = scopeIsActiveNodeStage
    ? workflowAgentStageScopeTitle(scopeId, current)
    : activeNode?.title || current.title || '当前步骤'
  const scopeGoal = scopeIsActiveNodeStage
    ? current.goal || ''
    : activeNode?.agentInteraction?.goal || activeNode?.agentScope || current.goal || ''
  const savedMessages = advancedUxMergedAgentSessionMessages(run, scopeId) || run.agentSessions?.[scopeId] || []
  const versions = run.stepVersions?.[current.id] || []
  const draft = run.stepDraftOutputs?.[current.id] || ''
  const output = run.stepOutputs?.[current.id] || ''
  const aiSummary = run.documentAnalysis?.aiSummary || run.projectBlueprint?.aiSummary || null
  const messages = normalizeWorkflowAgentSessionMessages(savedMessages.map((message, index) => ({
    ...message,
    id: message.id || `${scopeId}-message-${index}`
  })))

  if (draft || output) {
    messages.push({
      id: `${scopeId}-draft`,
      role: 'assistant',
      content: output ? `已采纳当前步骤输出：\n\n${output}` : `已生成草稿：\n\n${draft}`,
      createdAt: versions.at(-1)?.createdAt || ''
    })
  }
  if (!messages.length) {
    const upstreamContext = upstreamStageContextMessage(run, scopeId, activeNode)
    if (upstreamContext) messages.push(upstreamContext)
  }

  const currentModel = options.model || run.model || 'gpt-5.5'
  const modelOptions = Array.isArray(options.modelOptions) && options.modelOptions.length
    ? options.modelOptions
    : [{ value: currentModel, label: modelOptionLabel(currentModel) }]
  if (!modelOptions.some((option) => option.value === currentModel)) {
    modelOptions.unshift({ value: currentModel, label: modelOptionLabel(currentModel) })
  }
  return {
    title: scopeTitle,
    subtitle: scopeGoal,
    skillId: run.skillId || run.resolvedSkillId || run.requestedSkillId || run.workflowId || '',
    scopeId,
    aiSummary,
    model: {
      current: currentModel,
      options: modelOptions
    },
    references: run.referenceFiles?.[scopeId] || [],
    messages,
    history: versions.map((version, index) => ({
      id: version.id || `${current.id}-version-${index}`,
      label: `${version.accepted ? '已采纳版本' : '版本'} ${index + 1}`,
      content: version.content || '',
      createdAt: version.createdAt || ''
    })),
    quickReplies: run.agentQuickReplies?.[scopeId]?.length
      ? (isRequirementDissectionAgentScope(scopeId, activeNode, current)
          ? normalizeRequirementDissectionQuickReplies(run.agentQuickReplies[scopeId], 6)
          : compactReplies(run.agentQuickReplies[scopeId], []).slice(0, 6))
      : buildWorkflowAgentQuickReplies(run, {
        current,
        activeNode,
        scopeId,
        draft,
        output
      })
  }
}

function upstreamStageContextMessage(run = {}, scopeId = '', activeNode = null) {
  if (!activeNode || !scopeId) return null
  const stageId = String(activeNode.stageId || '').trim()
  if (!stageId || CHAT_ONLY_STAGE_AGENT_SCOPES.includes(scopeId)) return null
  const advancedUxContext = advancedUxUpstreamContextMessage(run, scopeId, activeNode, stageId)
  if (advancedUxContext) return advancedUxContext
  const stageMessages = Array.isArray(run.agentSessions?.['requirement-dissection'])
    ? run.agentSessions['requirement-dissection']
    : []
  const upstreamAssistant = [...stageMessages].reverse().find((message) =>
    message?.role === 'assistant' &&
    String(message?.content || '').trim() &&
    !['pending', 'retrieving', 'generating', 'merging-canvas'].includes(String(message?.meta?.status || ''))
  )
  if (!upstreamAssistant) return null
  const nodeTitle = String(activeNode.title || '当前节点').trim()
  const upstreamText = String(upstreamAssistant.content || '').trim()
  return {
    id: `${scopeId}-stage-context-bridge`,
    role: 'assistant',
    content: [
      `已打开「${nodeTitle}」。`,
      '上游需求分析已有阶段结论，可围绕当前节点继续提问、补资料或使用页面级操作。',
      upstreamText.split(/\n{2,}/).slice(0, 2).join('\n\n')
    ].filter(Boolean).join('\n\n'),
    createdAt: upstreamAssistant.createdAt || '',
    meta: {
      action: 'stage-context-bridge',
      sourceScopeId: 'requirement-dissection',
      sourceMessageId: upstreamAssistant.id || ''
    }
  }
}

function isAdvancedUxWorkflowRun(run = {}) {
  const values = [
    run.workflowId,
    run.skillId,
    run.requestedSkillId,
    run.resolvedSkillId,
    run.documentAnalysis?.skillId,
    run.documentAnalysis?.requestedSkillId,
    run.documentAnalysis?.resolvedSkillId,
    run.documentAnalysis?.totalDesignFlow?.skillId,
    run.documentAnalysis?.totalDesignFlow?.requestedSkillId,
    run.documentAnalysis?.totalDesignFlow?.resolvedSkillId
  ].map((value) => String(value || '').trim())
  return values.includes('advanced-ux-requirement-analysis') ||
    Boolean(advancedUxReportFromRun(run)?.markdown)
}

function advancedUxReportFromRun(run = {}) {
  const report = run.documentAnalysis?.advancedUxReport ||
    run.documentAnalysis?.totalDesignFlow?.advancedUxReport ||
    null
  return report && typeof report === 'object' ? report : null
}

function advancedUxPageInteractionDocumentFromRun(run = {}, report = null) {
  const document = report?.pageInteractionDocument ||
    run.documentAnalysis?.totalDesignFlow?.pageInteractionDocumentArtifact ||
    run.documentAnalysis?.pageInteractionDocumentArtifact ||
    null
  return document && typeof document === 'object' ? document : null
}

function advancedUxUpstreamContextMessage(run = {}, scopeId = '', activeNode = null, stageId = '') {
  if (!isAdvancedUxWorkflowRun(run)) return null
  const report = advancedUxReportFromRun(run)
  const pageInteractionDocument = advancedUxPageInteractionDocumentFromRun(run, report)
  const nodeTitle = String(activeNode?.title || '当前节点').trim()
  const lines = [
    `已打开「${nodeTitle}」。`
  ]
  if (stageId === 'interaction-lofi' && String(pageInteractionDocument?.markdown || '').trim()) {
    lines.push(
      `页面交互文档已生成：${pageInteractionDocument.fileName || '页面交互框架与说明.md'}`,
      '可围绕当前页面继续提问、补资料，或使用页面级操作。'
    )
  } else if (String(report?.markdown || '').trim()) {
    lines.push(
      `高级 UX Markdown 文件已生成：${report.fileName || '高级 UX 需求分析.md'}`,
      '可围绕当前节点继续提问、补资料，或引用需求分析结论。'
    )
  } else {
    return null
  }
  return {
    id: `${scopeId}-stage-context-bridge`,
    role: 'assistant',
    content: lines.filter(Boolean).join('\n\n'),
    createdAt: pageInteractionDocument?.generatedAt || report?.generatedAt || '',
    meta: {
      action: 'stage-context-bridge',
      sourceScopeId: 'requirement-dissection',
      sourceArtifactType: stageId === 'interaction-lofi' && pageInteractionDocument ? 'advanced-ux-page-interaction-document' : 'advanced-ux-markdown-report'
    }
  }
}

export function buildWorkflowArtifactStages(run = {}) {
  const hasBlueprint = Boolean(run.projectBlueprint)
  const artifacts = run.demoArtifacts || {}
  const hasLowFi = Boolean(artifacts.lowFi)
  const hasHtml = Boolean(artifacts.html)
  const hasVue = Boolean(artifacts.vueZipReady || artifacts.vueFiles?.length)

  return [
    {
      id: 'blueprint',
      label: '项目蓝图',
      title: '出蓝图',
      description: '包含项目档案、流程树、页面细节、状态异常和评审清单。',
      status: hasBlueprint ? 'done' : 'available'
    },
    {
      id: 'lofi',
      label: '低保真',
      title: '生成低保真',
      description: '把蓝图转成页面级线框和控件说明。',
      status: hasLowFi ? 'done' : hasBlueprint ? 'available' : 'locked'
    },
    {
      id: 'html-demo',
      label: 'HTML Demo',
      title: '生成可交互 HTML',
      description: '基于低保真生成可点击 Demo，用来预览跳转和状态。',
      status: hasHtml ? 'done' : hasLowFi ? 'available' : 'locked'
    },
    {
      id: 'vue-export',
      label: 'Vue 导出',
      title: '导出 Vue 代码',
      description: '确认 Demo 后再导出前端工程代码。',
      status: hasVue ? 'done' : hasHtml ? 'available' : 'locked'
    }
  ]
}
