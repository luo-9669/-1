import { buildAnalysisQualityGate, buildAnalysisVersionDiff } from './analysis-quality.js'

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function buildCanvasVersion(canvas = {}) {
  const text = stableStringify({
    nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
    edges: Array.isArray(canvas.edges) ? canvas.edges : [],
    orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
  })
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return `canvas-${Math.abs(hash).toString(36)}-${text.length.toString(36)}`
}

function compactLine(value = '', maxLength = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function uniqueLines(lines = [], limit = 8) {
  const seen = new Set()
  return lines
    .map((line) => compactLine(line))
    .filter((line) => {
      if (!line || seen.has(line)) return false
      seen.add(line)
      return true
    })
    .slice(0, limit)
}

function contentLinesFromText(content = '') {
  return uniqueLines(String(content || '')
    .split(/\n|。|；|;/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean), 8)
}

function parseJsonObject(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
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

function downstreamImpactFromContext(context = {}) {
  return (context.downstreamNodes || []).slice(0, 6).map((node) => ({
    nodeId: node.id,
    reason: `当前节点 ${context.scopeId} 的确认内容会影响「${node.title || node.id}」的口径。`
  }))
}

function canvasActionIntentWriteableContent(context = {}, actionResult = {}, fallbackItems = []) {
  const intent = context.canvasAction?.actionIntent || ''
  const nodeTitle = actionResult.nodeTitle || context.node?.title || context.currentNode?.title || '当前画布'
  const actionLabel = context.canvasAction?.actionLabel || context.canvasAction?.action || '当前动作'
  const map = {
    'target-user-enrichment': {
      summary: `${nodeTitle}需要补齐目标用户分层、进入场景、核心任务、顾虑点和成功标准。`,
      items: [
        '用户分层：未登录用户、新注册用户、忘记密码用户、第三方登录用户需要分别描述。',
        '进入场景：从业务页被动唤起、主动点击登录、注册后回流、忘记密码恢复后返回原任务。',
        '核心任务：快速登录、低摩擦注册、安全找回密码、处理授权失败或账号绑定。',
        '顾虑点：账号安全、验证码可达、第三方授权隐私、错误提示是否可理解。',
        '成功标准：用户能完成主路径并在失败后获得可恢复入口，后续页面结构和校验规则可据此展开。'
      ],
      acceptanceCriteria: [
        '目标用户不再是泛称，至少包含 3 类可设计、可验收的人群。',
        '每类用户都能对应进入场景、核心任务和成功判断。',
        '后续页面结构、表单校验和接口契约能引用这些人群口径。'
      ],
      impactKeyword: '目标用户'
    },
    'positioning-adjustment': {
      summary: `${nodeTitle}需要重新校准页面定位、核心价值、不包含范围、上下游依赖和业务边界。`,
      items: [
        '页面定位：认证弹窗是安全进入系统与账号创建的业务入口，不只是表单集合。',
        '核心价值：降低登录注册摩擦，同时保证账号安全、错误可恢复、成功后能回到原任务。',
        '不包含范围：不在本节点展开复杂账号体系、风控策略后台配置和完整运营增长链路。',
        '上下游依赖：上游由触发登录的业务页面决定，下游影响页面结构、表单校验、接口契约和埋点。',
        '业务边界：登录、注册、忘记密码、第三方授权失败态需要有统一容器和清晰主次任务。'
      ],
      acceptanceCriteria: [
        '页面定位能指导 UX、产品和研发对齐同一交付目标。',
        '明确本期包含和不包含范围，避免后续画布继续发散。',
        '下游节点能基于定位重写结构、校验和接口说明。'
      ],
      impactKeyword: '定位'
    },
    'acceptance-criteria-enrichment': {
      summary: `${nodeTitle}需要补齐可测试、可验收、可追踪的验收标准，覆盖成功路径、失败态和边界条件。`,
      items: [
        '验收场景：覆盖登录、注册、忘记密码、第三方授权和协议确认等主路径。',
        '成功路径：用户输入合法信息后能完成认证，弹窗关闭并回到触发登录前的业务任务。',
        '失败条件：账号密码错误、验证码错误或过期、手机号格式错误、第三方授权失败时必须有字段级或区域级提示。',
        '测试口径：每条验收标准都要能被前端、后端和测试分别验证，不使用“体验良好”“功能正常”等模糊描述。',
        '埋点观察：记录弹窗打开、登录提交、注册提交、找回密码、第三方授权失败和成功回流事件。'
      ],
      acceptanceCriteria: [
        '成功路径、失败态和边界条件都有明确可测试结果。',
        '每条验收标准能对应页面状态、接口返回或埋点事件。',
        '失败态有可恢复入口，不会让用户停留在无反馈状态。',
        '后续接口契约和表单校验能引用这些验收标准。'
      ],
      impactKeyword: '验收标准'
    },
    'api-contract-enrichment': {
      summary: `${nodeTitle}需要补齐接口端点、请求字段、返回字段、错误码、Mock 数据和前后端接管边界。`,
      items: [
        '接口端点：至少明确登录、注册、忘记密码/重置密码、第三方授权回调等端点及方法。',
        '请求字段：账号、密码、验证码、手机号/邮箱、协议确认、redirectUri、第三方 provider 和 traceId 需要标注必填、格式和来源。',
        '返回字段：token、用户基础信息、下一步动作、回跳地址、错误提示文案 key 和安全策略字段需要给前端可消费结构。',
        '错误码：账号不存在、密码错误、验证码错误或过期、账号锁定、第三方授权失败、频控命中和服务超时必须有可恢复说明。',
        '前端接管：表单校验、按钮 loading、错误展示、回跳和本地 Mock；后端接管：认证校验、验证码、风控、token 签发和错误码。',
        'Mock 数据：为成功、字段错误、业务错误、系统异常和第三方失败分别提供示例响应。'
      ],
      acceptanceCriteria: [
        '每个端点都有请求字段、返回字段、错误码和示例 Mock。',
        '前端能基于接口契约实现 loading、错误提示和成功回跳。',
        '后端能基于契约实现认证、风控、验证码和统一错误码。',
        '联调时字段命名、错误码和状态流转不需要二次猜测。'
      ],
      impactKeyword: '接口契约'
    },
    'exception-state-enrichment': {
      summary: `${nodeTitle}需要补齐加载、空、错、权限、超时等异常状态，并明确触发条件、反馈文案和恢复入口。`,
      items: [
        '加载态：提交登录/注册/找回密码后按钮进入 loading，禁止重复提交，并保留用户已输入内容。',
        '空状态：未输入账号、验证码为空或未勾选协议时，展示字段级提示并定位到对应输入项。',
        '错误态：密码错误、验证码错误或第三方授权失败时，说明原因、影响范围和下一步动作。',
        '权限/安全态：账号锁定、频控、二次验证或地区限制需要给出安全说明和可恢复路径。',
        '恢复入口：支持重新输入、重新获取验证码、返回登录、切换注册、重新授权和联系客服。',
        '后端条件：错误状态必须能映射到接口错误码、超时、网络失败或风控返回。'
      ],
      acceptanceCriteria: [
        '每个异常状态都有明确触发条件、UI 反馈和恢复入口。',
        '异常提示不覆盖用户已输入内容，用户能继续完成主任务。',
        '前端状态能对应后端错误码或网络状态，测试可以复现。',
        '加载、失败、超时和权限场景都有可测试结果。'
      ],
      impactKeyword: '异常状态'
    },
    'analytics-enrichment': {
      summary: `${nodeTitle}需要补齐关键事件、触发时机、事件属性、成功指标、漏斗影响和隐私边界。`,
      items: [
        '事件名：auth_modal_open、auth_login_submit、auth_login_success、auth_register_submit、auth_error_show、auth_third_party_fail。',
        '触发时机：弹窗打开、切换登录/注册、提交表单、接口返回成功、错误提示曝光、关闭或成功回跳时记录。',
        '事件属性：entry_source、auth_mode、error_code、provider、is_new_user、duration_ms、redirect_target 和 experiment_id。',
        '转化指标：登录成功率、注册完成率、找回密码完成率、第三方授权失败率、错误恢复率和平均完成耗时。',
        '漏斗影响：从触发登录到认证成功回流分层观察，区分字段校验失败、业务错误和系统失败。',
        '隐私边界：不得上报明文账号、密码、验证码、token 或可直接识别个人身份的信息。'
      ],
      acceptanceCriteria: [
        '埋点事件能覆盖打开、提交、成功、失败、关闭和回流关键节点。',
        '指标能支撑登录注册漏斗分析和异常定位。',
        '事件属性不包含敏感信息，满足隐私和安全边界。',
        '前端、后端和数据同学能按同一事件口径验收。'
      ],
      impactKeyword: '埋点指标'
    },
    'supplement-detail': {
      summary: `${nodeTitle}需要补齐当前结论的依据、缺口风险、边界状态和可确认写入内容。`,
      items: [
        '补充结论：明确当前节点已有事实、缺失事实和需要用户确认的判断。',
        '依据与假设：区分来自原始需求、画布事实、知识库引用和模型推断的内容。',
        '缺口与风险：列出影响后续页面、交互、接口和验收的空白点。',
        '可写入画布内容：把可确认的补充资料整理成当前节点条目。',
        '待确认问题：保留无法从上下文确定、需要用户继续补充的问题。'
      ],
      acceptanceCriteria: [
        '补充内容可直接进入当前画布节点。',
        '不把未知信息伪装成项目事实。',
        '后续节点能根据补充结论重新对齐。'
      ],
      impactKeyword: '补充资料'
    },
    reanalysis: {
      summary: `${nodeTitle}需要重新分析当前结论，并明确原结论不足、修正结论和后续影响。`,
      items: [
        '重新分析结论：给出当前节点更新后的核心判断。',
        '原结论不足：指出原画布内容缺少或不准确的部分。',
        '修正内容：补齐用户目标、业务边界、异常状态或验收标准。',
        '后续画布影响：说明哪些后续节点需要随当前结论重算。',
        '确认建议：用户确认后再写入画布并刷新后续节点。'
      ],
      acceptanceCriteria: [
        '新结论比原画布更具体且可交付。',
        '明确哪些内容来自现有画布，哪些是模型修正建议。',
        '后续节点刷新范围清晰。'
      ],
      impactKeyword: '重新分析'
    }
  }
  const shaped = map[intent]
  if (!shaped) return null
  return {
    summary: shaped.summary,
    items: uniqueLines([...shaped.items, ...fallbackItems], 12),
    acceptanceCriteria: uniqueLines(shaped.acceptanceCriteria, 8),
    impactKeyword: shaped.impactKeyword,
    actionLabel
  }
}

function canvasActionIntentDownstreamImpact(context = {}, keyword = '') {
  const nodes = Array.isArray(context.downstreamNodes) ? context.downstreamNodes : []
  return nodes.slice(0, 6).map((node) => ({
    nodeId: node.id,
    reason: `${keyword || '当前动作'}会影响「${node.title || node.id}」的内容口径，需要确认后同步刷新。`
  }))
}

function proposalImpactReasonForNode(proposal = {}, nodeId = '') {
  const impact = (Array.isArray(proposal.downstreamImpact) ? proposal.downstreamImpact : [])
    .find((item) => (item?.nodeId || item?.id) === nodeId)
  return compactLine(impact?.reason || '', 260)
}

function proposalRationaleFromContext(context = {}, summary = '') {
  return uniqueLines([
    summary ? `提案结论：${summary}` : '',
    context.node?.summary ? `当前节点目标：${context.node.summary}` : '',
    context.message?.content ? `用户本轮诉求：${context.message.content}` : '',
    context.retrievedKnowledge?.length ? '已结合项目知识库召回片段。' : '',
    context.downstreamNodes?.length ? '当前节点变化会影响后续画布节点，需要确认后同步刷新。' : ''
  ], 5)
}

function proposalContextSourcesFromContext(context = {}) {
  const knowledgeSources = (Array.isArray(context.retrievedKnowledge) ? context.retrievedKnowledge : []).slice(0, 4).map((item) => ({
    type: item.sourceType || item.materialType || 'knowledge',
    title: item.title || item.sourceTitle || '未命名知识',
    snippet: compactLine(item.snippet || item.content || item.text || '', 220),
    matchReason: compactLine(item.matchReason || item.verification?.reason || '与当前问题相关', 160)
  }))
  const canvasSources = [
    context.currentNode?.id ? {
      type: 'canvas-current',
      title: context.currentNode.title || context.currentNode.id,
      snippet: compactLine(context.currentNode.summary || (context.currentNode.content || []).join('；'), 220),
      matchReason: '当前画布节点'
    } : null,
    ...(Array.isArray(context.downstreamNodes) ? context.downstreamNodes.slice(0, 3).map((node) => ({
      type: 'canvas-downstream',
      title: node.title || node.id,
      snippet: compactLine(node.summary || (node.content || []).join('；'), 180),
      matchReason: '确认后需要同步刷新的后续节点'
    })) : [])
  ].filter(Boolean)
  return [...knowledgeSources, ...canvasSources].filter((item) => item.title || item.snippet).slice(0, 6)
}

function enrichProposalExplainability(proposal = {}, context = {}) {
  const summary = proposal.summary || proposal.writeableContent?.summary || ''
  const canvasVersion = proposal.canvasVersion || buildCanvasVersion(context.fullCanvas || context.run?.documentAnalysis?.canvas || {})
  const parsedRationale = uniqueLines(proposal.rationale || proposal.reasons || [], 6)
  const parsedSources = Array.isArray(proposal.contextSources) ? proposal.contextSources : []
  const contextSources = parsedSources
    .map((item) => ({
      type: item?.type || item?.sourceType || 'context',
      title: compactLine(item?.title || item?.sourceTitle || '', 120),
      snippet: compactLine(item?.snippet || item?.content || item?.text || '', 220),
      matchReason: compactLine(item?.matchReason || item?.reason || '', 160)
    }))
    .filter((item) => item.title || item.snippet)
  return {
    ...proposal,
    canvasVersion,
    rationale: parsedRationale.length ? parsedRationale : proposalRationaleFromContext(context, summary),
    contextSources: contextSources.length ? contextSources : proposalContextSourcesFromContext(context)
  }
}

export function normalizeModelProposal(rawProposal = {}, context = {}, fallback = {}) {
  const parsed = parseJsonObject(rawProposal)
  if (!parsed) return null
  const nodeId = parsed.nodeId || fallback.nodeId || context.scopeId || context.node?.id || 'analysis'
  const title = compactLine(parsed.title || fallback.title || `${context.node?.title || '当前画布'}补充建议`, 120)
  const summary = compactLine(parsed.summary || parsed.writeableContent?.summary || fallback.summary || '', 360)
  const items = uniqueLines(parsed.writeableContent?.items || parsed.items || fallback.writeableContent?.items || [], 12)
  const acceptanceCriteria = uniqueLines(
    parsed.writeableContent?.acceptanceCriteria || parsed.acceptanceCriteria || fallback.writeableContent?.acceptanceCriteria || [],
    8
  )
  if (!summary || !items.length) return null
  const downstreamImpact = (Array.isArray(parsed.downstreamImpact) ? parsed.downstreamImpact : [])
    .map((item) => ({
      nodeId: item?.nodeId || item?.id || '',
      reason: compactLine(item?.reason || '', 220)
    }))
    .filter((item) => item.nodeId)
  return enrichProposalExplainability({
    ...fallback,
    id: fallback.id || `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    title,
    summary,
    actionIntent: parsed.actionIntent || fallback.actionIntent || context.canvasAction?.actionIntent || '',
    writeableContent: {
      summary: compactLine(parsed.writeableContent?.summary || summary, 360),
      items,
      acceptanceCriteria: acceptanceCriteria.length
        ? acceptanceCriteria
        : uniqueLines(fallback.writeableContent?.acceptanceCriteria || ['当前节点内容可直接支撑产品、UX 和研发继续拆解。'], 6)
    },
    downstreamImpact: downstreamImpact.length ? downstreamImpact : fallback.downstreamImpact || downstreamImpactFromContext(context),
    status: 'pending',
    createdAt: fallback.createdAt || context.now || new Date().toISOString(),
    model: parsed.model || fallback.model || context.model || '',
    source: 'model-structured'
  }, context)
}

export function buildAgentProposal(feedback = {}, context = {}) {
  const content = feedback.assistantMessage?.content || feedback.content || ''
  const actionResult = feedback.actionResult || {}
  const nodeId = actionResult.nodeId || context.scopeId || context.node?.id || 'analysis'
  const nodeTitle = actionResult.nodeTitle || context.node?.title || context.currentNode?.title || '当前画布'
  const items = uniqueLines([
    ...(Array.isArray(actionResult.suggestions) ? actionResult.suggestions : []),
    ...contentLinesFromText(content)
  ], 8)
  const intentWriteable = context.actionType === 'canvas-action-advice'
    ? canvasActionIntentWriteableContent(context, actionResult, items)
    : null
  const summary = compactLine(intentWriteable?.summary || items.find((item) => /可写入|详细|建议|补充|验收/.test(item)) || content || `${nodeTitle}补充建议`, 260)
  const fallback = {
    id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    title: `${nodeTitle}补充建议`,
    summary,
    actionIntent: context.canvasAction?.actionIntent || actionResult.actionIntent || '',
    writeableContent: {
      summary,
      items: intentWriteable?.items || (items.length ? items : [`补充 ${nodeTitle} 的目标、边界、异常状态和验收标准。`]),
      acceptanceCriteria: intentWriteable?.acceptanceCriteria || uniqueLines([
        '当前节点内容可直接支撑产品、UX 和研发继续拆解。',
        '后续节点需要根据当前确认内容重新对齐。',
        ...(Array.isArray(actionResult.acceptanceCriteria) ? actionResult.acceptanceCriteria : [])
      ], 6)
    },
    downstreamImpact: intentWriteable
      ? canvasActionIntentDownstreamImpact(context, intentWriteable.impactKeyword)
      : downstreamImpactFromContext(context),
    status: 'pending',
    createdAt: context.now || new Date().toISOString(),
    model: context.model || feedback.model || feedback.assistantMessage?.meta?.model || '',
    source: 'deterministic-fallback'
  }
  return normalizeModelProposal(feedback.proposal || feedback.raw?.proposal || feedback.raw?.agentProposal, context, fallback) || enrichProposalExplainability(fallback, context)
}

function normalizeAnalysis(run = {}) {
  const analysis = run.documentAnalysis || {}
  const canvas = analysis.canvas || { nodes: [], edges: [], orderedTabs: [] }
  return {
    ...analysis,
    input: analysis.input || run.input || '',
    status: 'repaired',
    canvas: {
      ...canvas,
      nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
      edges: Array.isArray(canvas.edges) ? canvas.edges : [],
      orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
    },
    documents: Array.isArray(analysis.documents) ? analysis.documents : [],
    versions: Array.isArray(analysis.versions) ? analysis.versions : []
  }
}

function findNodeIndex(nodes = [], nodeId = '') {
  const index = nodes.findIndex((node) => node?.id === nodeId)
  return index >= 0 ? index : 0
}

function normalizeModelPatch(rawPatch = {}, nodes = [], currentIndex = 0) {
  const parsed = parseJsonObject(rawPatch)
  if (!parsed) return null
  const currentNode = parsed.currentNode && typeof parsed.currentNode === 'object' && !Array.isArray(parsed.currentNode)
    ? parsed.currentNode
    : null
  const downstreamNodes = Array.isArray(parsed.downstreamNodes) ? parsed.downstreamNodes : []
  if (!currentNode && !downstreamNodes.length) return null
  const invalidTarget = downstreamNodes.some((node) => {
    const nodeId = node?.nodeId || node?.id || ''
    const index = nodes.findIndex((item) => item.id === nodeId)
    return !nodeId || index < 0 || index <= currentIndex
  })
  if (invalidTarget) return null
  return {
    currentNode,
    downstreamNodes: downstreamNodes
      .map((node) => ({
        nodeId: node.nodeId || node.id || '',
        summary: compactLine(node.summary || '', 360),
        content: uniqueLines(node.content || node.items || [], 16)
      }))
      .filter((node) => node.nodeId && (node.summary || node.content.length)),
    reason: compactLine(parsed.reason || '模型根据完整画布和确认提案重写当前节点与后续节点。', 360)
  }
}

function invalidModelPatchError(message = '模型返回的画布 patch 无效，未写入画布') {
  const error = new Error(message)
  error.code = 'AGENT_MODEL_PATCH_INVALID'
  return error
}

function staleProposalError(proposal = {}, currentCanvasVersion = '') {
  const error = new Error('该 Agent 提案基于旧画布生成，需重新生成建议后再写入画布')
  error.code = 'AGENT_PROPOSAL_STALE'
  error.recoveryActions = ['重新生成建议']
  error.proposalId = proposal.id || ''
  error.proposalCanvasVersion = proposal.canvasVersion || ''
  error.currentCanvasVersion = currentCanvasVersion
  error.staleReason = 'canvas-version-changed'
  return error
}

function nodeContentCount(node = {}) {
  return Array.isArray(node.content) ? node.content.length : (node.content ? 1 : 0)
}

function buildNodeDiffs(beforeNodes = [], afterNodes = [], changedNodeIds = []) {
  const changed = new Set(changedNodeIds.filter(Boolean))
  return afterNodes
    .filter((node) => changed.has(node.id))
    .map((afterNode) => {
      const beforeNode = beforeNodes.find((node) => node.id === afterNode.id) || {}
      return {
        nodeId: afterNode.id,
        title: afterNode.title || beforeNode.title || afterNode.id,
        before: {
          summary: beforeNode.summary || '',
          contentCount: nodeContentCount(beforeNode)
        },
        after: {
          summary: afterNode.summary || '',
          contentCount: nodeContentCount(afterNode)
        }
      }
    })
}

function applyModelPatch(nodes = [], currentIndex = 0, patch = {}, proposal = {}) {
  if (!patch) return null
  const nextNodes = nodes.map((node) => ({ ...node }))
  const changedNodeIds = []
  const currentPatch = patch.currentNode || {}
  if (currentPatch.summary || Array.isArray(currentPatch.content)) {
    nextNodes[currentIndex] = {
      ...nextNodes[currentIndex],
      ...(currentPatch.summary ? { summary: currentPatch.summary } : {}),
      ...(Array.isArray(currentPatch.content) ? { content: uniqueLines(currentPatch.content, 16) } : {}),
      updatedByAgentProposalId: proposal.id,
      loading: false
    }
    changedNodeIds.push(nextNodes[currentIndex].id)
  }
  for (const downstreamPatch of patch.downstreamNodes || []) {
    const index = nextNodes.findIndex((node) => node.id === downstreamPatch.nodeId)
    if (index < 0 || index <= currentIndex) continue
    nextNodes[index] = {
      ...nextNodes[index],
      ...(downstreamPatch.summary ? { summary: downstreamPatch.summary } : {}),
      ...(downstreamPatch.content.length ? { content: downstreamPatch.content } : {}),
      impactedByAgentProposalId: proposal.id,
      loading: false
    }
    changedNodeIds.push(nextNodes[index].id)
  }
  if (!changedNodeIds.length) return null
  return {
    nodes: nextNodes,
    appliedPatch: {
      currentNodeId: nextNodes[currentIndex].id,
      changedNodeIds: Array.from(new Set(changedNodeIds)),
      nodeDiffs: buildNodeDiffs(nodes, nextNodes, changedNodeIds),
      reason: patch.reason || '模型根据完整画布和确认提案重写当前节点与后续节点。'
    }
  }
}

function buildConfirmAudit(proposal = {}, payload = {}) {
  const appliedAt = new Date().toISOString()
  return {
    source: 'agent-proposal-confirm',
    proposalId: proposal.id || '',
    proposalTitle: compactLine(proposal.title || '', 120),
    model: payload.model || '',
    appliedAt,
    confirmMode: payload.confirmMode || 'merge-current-and-downstream'
  }
}

function buildConfirmVersion(analysis = {}, previousVersions = [], appliedPatch = {}) {
  const createdAt = new Date().toISOString()
  const version = {
    id: `agent-proposal-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    label: 'Agent 确认入画布版本',
    source: 'agent-proposal-confirm',
    createdAt,
    demandScope: analysis.demandScope || 'project',
    requestedSkillId: analysis.requestedSkillId || '',
    resolvedSkillId: analysis.resolvedSkillId || analysis.skillId || '',
    qualityScore: analysis.qualityGate?.score || 0,
    appliedPatch,
    snapshot: {
      blueprint: analysis.blueprint || null,
      canvas: analysis.canvas || null,
      routing: analysis.routing || null,
      generation: analysis.generation || null
    }
  }
  if (previousVersions[0]) version.diff = buildAnalysisVersionDiff(previousVersions[0], version)
  return version
}

export function confirmAgentProposalOnRun(run = {}, proposal = {}, payload = {}) {
  if (!proposal?.id) {
    const error = new Error('未找到可确认的 Agent 提案')
    error.code = 'AGENT_PROPOSAL_NOT_FOUND'
    throw error
  }
  if (proposal.status && proposal.status !== 'pending') {
    const error = new Error('该 Agent 提案已经处理，不能重复写入画布')
    error.code = 'AGENT_PROPOSAL_NOT_PENDING'
    throw error
  }
  const analysis = normalizeAnalysis(run)
  const auditPayload = {
    ...payload,
    model: payload.model || proposal.model || proposal.meta?.model || run.model || analysis.generation?.model || ''
  }
  const nodes = analysis.canvas.nodes.map((node) => ({ ...node }))
  if (!nodes.length) {
    const error = new Error('当前分析结果没有可更新的画布节点')
    error.code = 'AGENT_CANVAS_EMPTY'
    throw error
  }
  const currentCanvasVersion = buildCanvasVersion(analysis.canvas)
  if (proposal.canvasVersion && proposal.canvasVersion !== currentCanvasVersion) {
    throw staleProposalError(proposal, currentCanvasVersion)
  }
  const currentNodeId = payload.nodeId || proposal.nodeId || nodes[0].id
  const currentIndex = findNodeIndex(nodes, currentNodeId)
  const hasModelPatch = payload.modelPatch !== null && payload.modelPatch !== undefined
  const normalizedModelPatch = normalizeModelPatch(payload.modelPatch || payload.patch, nodes, currentIndex)
  if (hasModelPatch && !normalizedModelPatch) throw invalidModelPatchError()
  const modelPatchResult = applyModelPatch(nodes, currentIndex, normalizedModelPatch, proposal)
  if (hasModelPatch && !modelPatchResult) throw invalidModelPatchError()
  if (modelPatchResult) {
    modelPatchResult.appliedPatch.audit = buildConfirmAudit(proposal, auditPayload)
    const nextAnalysis = {
      ...analysis,
      canvas: {
        ...analysis.canvas,
        nodes: modelPatchResult.nodes
      },
      repair: {
        checkId: 'agent-proposal-confirm',
        action: proposal.summary || proposal.title || '',
        repairedAt: new Date().toISOString(),
        owner: 'backend-model'
      }
    }
    nextAnalysis.qualityGate = buildAnalysisQualityGate(nextAnalysis)
    const version = buildConfirmVersion(nextAnalysis, analysis.versions, modelPatchResult.appliedPatch)
    nextAnalysis.versions = [version, ...analysis.versions]
    nextAnalysis.blueprint = {
      ...(nextAnalysis.blueprint || {}),
      qualityGate: nextAnalysis.qualityGate,
      versions: nextAnalysis.versions
    }
    return {
      analysis: nextAnalysis,
      appliedPatch: modelPatchResult.appliedPatch
    }
  }
  const confirmedItems = uniqueLines([
    `Agent 提案已确认：${proposal.summary || proposal.title || '补充建议'}`,
    `可写入总结：${proposal.writeableContent?.summary || proposal.summary || ''}`,
    ...(proposal.writeableContent?.items || []),
    ...(proposal.writeableContent?.acceptanceCriteria || []).map((item) => `验收：${item}`)
  ], 12)
  nodes[currentIndex] = {
    ...nodes[currentIndex],
    summary: proposal.writeableContent?.summary || proposal.summary || nodes[currentIndex].summary,
    content: uniqueLines([
      ...(Array.isArray(nodes[currentIndex].content) ? nodes[currentIndex].content : []),
      ...confirmedItems
    ], 14),
    updatedByAgentProposalId: proposal.id,
    loading: false
  }
  const changedNodeIds = [nodes[currentIndex].id]
  for (let index = currentIndex + 1; index < nodes.length; index += 1) {
    const node = nodes[index]
    const impactReason = proposalImpactReasonForNode(proposal, node.id)
    changedNodeIds.push(node.id)
    nodes[index] = {
      ...node,
      content: uniqueLines([
        impactReason
          ? `上游 ${nodes[currentIndex].id} 已更新：${impactReason}`
          : `上游 ${nodes[currentIndex].id} 已更新：需要重新对齐本节点的结论。`,
        ...(Array.isArray(node.content) ? node.content : []),
        `同步依据：${proposal.writeableContent?.summary || proposal.summary || 'Agent 确认提案'}`
      ], 10),
      impactedByAgentProposalId: proposal.id,
      loading: false
    }
  }
  const appliedPatch = {
    currentNodeId: nodes[currentIndex].id,
    changedNodeIds,
    nodeDiffs: buildNodeDiffs(analysis.canvas.nodes, nodes, changedNodeIds),
    audit: buildConfirmAudit(proposal, auditPayload),
    reason: proposal.downstreamImpact?.[0]?.reason
      ? `当前节点确认写入后，后续节点按影响说明同步刷新：${proposal.downstreamImpact[0].reason}`
      : '当前节点确认写入后，后续节点需要根据新的上游结论同步刷新。'
  }
  const nextAnalysis = {
    ...analysis,
    canvas: {
      ...analysis.canvas,
      nodes
    },
    repair: {
      checkId: 'agent-proposal-confirm',
      action: proposal.summary || proposal.title || '',
      repairedAt: new Date().toISOString(),
      owner: 'backend-model'
    }
  }
  nextAnalysis.qualityGate = buildAnalysisQualityGate(nextAnalysis)
  const version = buildConfirmVersion(nextAnalysis, analysis.versions, appliedPatch)
  nextAnalysis.versions = [version, ...analysis.versions]
  nextAnalysis.blueprint = {
    ...(nextAnalysis.blueprint || {}),
    qualityGate: nextAnalysis.qualityGate,
    versions: nextAnalysis.versions
  }
  return {
    analysis: nextAnalysis,
    appliedPatch
  }
}
