const MODEL_LABELS = {
  'gpt-4.1': 'GPT-4.1',
  'gpt-5.5': 'GPT-5.5',
  'gpt-4o': 'GPT-4o',
  codex: 'Codex'
}

export function modelLabel(model = '') {
  return MODEL_LABELS[model] || model || 'GPT-5.5'
}

export function classifyAgentAction(content = '') {
  if (/补充资料|补充细节|补充信息|补充上下文|补资料|展开分析/.test(content)) return 'supplement-detail'
  if (/拆模块|展开结构|拆解模块|模块/.test(content)) return 'module-breakdown'
  if (/调整优先级|优先级|排序/.test(content)) return 'priority-adjustment'
  if (/生成页面|页面|低保真|框架图|wireframe/i.test(content)) return 'page-generation'
  if (/确认框架|确认结构|确认/.test(content)) return 'confirmation'
  if (/生成蓝图|出蓝图|蓝图/.test(content)) return 'blueprint'
  if (/重新生成|重新对比|重来/.test(content)) return 'regenerate'
  return 'context-note'
}

function compactText(value = '', maxLength = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function compactList(items = [], limit = 6, maxLength = 220) {
  return items
    .map((item) => compactText(item, maxLength))
    .filter(Boolean)
    .slice(0, limit)
}

function compactReferences(references = []) {
  return references
    .filter((item) => item && item.status !== 'failed')
    .slice(0, 6)
    .map((item) => ({
      id: item.id || '',
      name: item.name || '未命名引用',
      kind: item.kind || item.type || 'document',
      status: item.status || 'ready',
      text: compactText(item.text || item.content || '', 800)
    }))
}

function compactHistory(run = {}, scopeId = '') {
  return ((run.agentSessions || {})[scopeId] || [])
    .slice(-6)
    .map((item) => ({
      role: item.role || 'user',
      content: compactText(item.content || '', 500)
    }))
    .filter((item) => item.content)
}

function compactRetrievedKnowledge(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 6)
    .map((item) => ({
      title: item.title || '未命名知识',
      snippet: compactText(item.snippet || item.content || item.text || '', 800),
      evidence: Array.isArray(item.evidence) ? item.evidence.slice(0, 3) : [],
      projectId: item.projectId || '',
      projectName: item.projectName || '',
      sourceTitle: item.sourceTitle || item.evidence?.[0]?.title || item.title || '',
      materialType: item.materialType || item.type || item.category || '',
      sourceType: item.sourceType || '',
      sourceUrl: item.sourceUrl || '',
      roleScopes: Array.isArray(item.roleScopes) ? item.roleScopes : [],
      matchReason: item.matchReason || item.chunk?.heading || item.category || '',
      verification: item.verification || { status: 'unverified' }
    }))
    .filter((item) => item.snippet || item.evidence.length)
}

function compactCanvasNode(node = {}) {
  return {
    id: node.id || '',
    title: node.title || node.id || '未命名节点',
    summary: compactText(node.summary || '', 260),
    content: compactList(node.content || [], 8, 260),
    agentScope: compactText(node.agentScope || '', 220)
  }
}

function resolveCanvas(run = {}, rawNode = {}, scopeId = '') {
  const canvas = run.documentAnalysis?.canvas || run.projectBlueprint?.canvas || {}
  const nodes = (Array.isArray(canvas.nodes) ? canvas.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
  const currentIndex = nodes.findIndex((node) => node.id === (rawNode.id || scopeId))
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const currentNode = nodes[safeIndex] || rawNode || {}
  return {
    fullCanvas: {
      nodes: nodes.map(compactCanvasNode),
      edges: Array.isArray(canvas.edges) ? canvas.edges.slice(0, 20) : [],
      orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs.slice(0, 20) : []
    },
    currentNode: compactCanvasNode(currentNode),
    upstreamNodes: safeIndex > 0 ? nodes.slice(0, safeIndex).map(compactCanvasNode) : [],
    downstreamNodes: currentIndex >= 0 ? nodes.slice(safeIndex + 1).map(compactCanvasNode) : []
  }
}

function compactProposals(run = {}, scopeId = '') {
  const proposalsByNode = run.agentProposals || {}
  const scoped = Array.isArray(proposalsByNode[scopeId]) ? proposalsByNode[scopeId] : []
  return scoped
    .slice(-4)
    .map((proposal) => ({
      id: proposal.id || '',
      nodeId: proposal.nodeId || scopeId,
      title: proposal.title || '',
      summary: compactText(proposal.summary || proposal.writeableContent?.summary || '', 320),
      status: proposal.status || 'pending'
    }))
    .filter((proposal) => proposal.id || proposal.summary)
}

function renderLines(title, items = []) {
  if (!items.length) return `${title}：暂无`
  return `${title}：\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
}

function renderNodeLines(title, nodes = []) {
  return renderLines(title, nodes.map((node) => {
    const content = Array.isArray(node.content) && node.content.length ? `；内容：${node.content.join(' / ')}` : ''
    return `${node.title || node.id}（${node.id}）：${node.summary || '暂无摘要'}${content}`
  }))
}

function normalizeCanvasActionIntent(canvasAction = {}) {
  const action = compactText(canvasAction.actionLabel || canvasAction.action || '', 80)
  const normalized = action.replace(/\s+/g, '')
  const explicitIntent = compactText(canvasAction.actionIntent || '', 120)
  const knownIntents = new Set([
    'target-user-enrichment',
    'positioning-adjustment',
    'acceptance-criteria-enrichment',
    'api-contract-enrichment',
    'exception-state-enrichment',
    'analytics-enrichment',
    'supplement-detail',
    'reanalysis',
    'canvas-action-advice'
  ])
  const actionIntent = knownIntents.has(explicitIntent)
    ? explicitIntent
    : /目标用户|用户人群|人群/.test(normalized)
    ? 'target-user-enrichment'
    : /调整定位|定位|页面定位|产品定位/.test(normalized)
    ? 'positioning-adjustment'
    : /验收标准|补验收|验收|测试口径|通过条件|失败条件/.test(normalized)
    ? 'acceptance-criteria-enrichment'
    : /接口契约|补接口|接口字段|接口|API|错误码|Mock|前后端/.test(normalized)
    ? 'api-contract-enrichment'
    : /异常状态|补异常|错误态|空状态|加载态|失败态|权限态|恢复入口|状态/.test(normalized)
    ? 'exception-state-enrichment'
    : /埋点指标|补埋点|埋点|指标|转化|事件|数据观察|漏斗/.test(normalized)
    ? 'analytics-enrichment'
    : /补充资料|补充细节|补充信息|补资料|资料/.test(normalized)
    ? 'supplement-detail'
    : /重新分析|重新解析|重跑分析|重新生成分析/.test(normalized)
    ? 'reanalysis'
    : 'canvas-action-advice'
  const expectedSections = compactList(canvasAction.expectedSections || [
    '结论',
    '依据与假设',
    '缺口与风险',
    '可写入画布内容',
    '后续画布影响'
  ], 8, 80)
  return {
    ...canvasAction,
    action,
    actionLabel: action,
    nodeId: canvasAction.nodeId || '',
    actionIntent,
    actionTemplate: canvasAction.actionTemplate || canvasActionOutputGuide(actionIntent),
    expectedSections
  }
}

function canvasActionOutputGuide(actionIntent = '') {
  const guides = {
    'target-user-enrichment': '动作指南：按用户分层、进入场景、核心任务、顾虑点、成功标准输出，避免泛泛写“所有用户”。',
    'positioning-adjustment': '动作指南：按页面/弹窗定位、核心价值、不包含范围、上下游依赖、业务边界输出，避免只复述按钮名。',
    'acceptance-criteria-enrichment': '动作指南：按验收场景、成功路径、失败态、通过条件、测试口径和埋点观察输出，避免只写“功能正常”。',
    'api-contract-enrichment': '动作指南：按接口端点、请求字段、返回字段、错误码、前端接管、后端接管、Mock 数据和依赖影响输出。',
    'exception-state-enrichment': '动作指南：按状态名称、触发条件、UI 反馈、恢复入口、后端条件和可测试标准输出，覆盖加载、空、错、权限和超时。',
    'analytics-enrichment': '动作指南：按事件名、触发时机、事件属性、成功指标、漏斗影响和隐私边界输出，避免只写“需要埋点”。',
    'supplement-detail': '动作指南：按当前结论补充、依据、缺口风险、可写入条目、待确认问题输出，直接给可用资料。',
    reanalysis: '动作指南：先给重新分析结论，再指出原画布不足、修正内容、后续节点需要重算的影响。'
  }
  return [
    '输出要求：直接给出详细建议、依据、缺口风险、可补充到画布的结构化内容；不要回复“已接收”这类过程说明。',
    `动作意图：${actionIntent || 'canvas-action-advice'}`,
    guides[actionIntent] || '动作指南：按动作目标输出清晰结论、依据、缺口风险、可写入画布内容和后续画布影响。',
    '必须包含：结论、依据与假设、缺口与风险、可写入画布内容、后续画布影响。'
  ].join('\n')
}

export function buildAgentContext(payload = {}) {
  const message = payload.message || {}
  const run = payload.run || {}
  const step = payload.step || {}
  const rawNode = payload.context?.activeNode || {}
  const scopeId = payload.scopeId || rawNode.id || step.id || 'step'
  const model = payload.model || run.model || 'gpt-5.5'
  const canvasAction = payload.context?.canvasAction && typeof payload.context.canvasAction === 'object'
    ? payload.context.canvasAction
    : null
  const normalizedCanvasAction = canvasAction ? normalizeCanvasActionIntent(canvasAction) : null
  const explicitAction = payload.action || message.meta?.action || (canvasAction ? 'canvas-action-advice' : '')
  const actionType = explicitAction === 'canvas-action-advice'
    ? 'canvas-action-advice'
    : classifyAgentAction(message.content || '')
  const node = {
    id: rawNode.id || scopeId,
    title: rawNode.title || step.title || '当前环节',
    summary: rawNode.summary || rawNode.agentScope || step.goal || '围绕当前小画板继续补充。',
    content: compactList(rawNode.content || [], 8, 260),
    agentScope: rawNode.agentScope || '',
    interactionGoal: rawNode.agentInteraction?.goal || ''
  }
  const references = compactReferences(payload.references || [])
  const history = compactHistory(run, scopeId)
  const canvasContext = resolveCanvas(run, rawNode, scopeId)
  const pendingProposals = compactProposals(run, scopeId)
  const retrievedKnowledge = compactRetrievedKnowledge(payload.retrievedKnowledge || [])
  const knowledgeRetrievalError = compactText(payload.context?.knowledgeRetrievalError || '', 220)
  const systemPrompt = [
    '你是流程通的产品级工作流 Agent。',
    '你只围绕当前画布节点回答，必须区分项目事实、引用资料和模型推断。',
    '只输出 JSON，不要输出 Markdown，不要包裹代码块。',
    'JSON 结构必须是 {"content":"","proposal":{"title":"","summary":"","rationale":[],"contextSources":[{"type":"","title":"","snippet":"","matchReason":""}],"writeableContent":{"summary":"","items":[],"acceptanceCriteria":[]},"downstreamImpact":[{"nodeId":"","reason":""}]}}。',
    'content 是给用户看的短回复；proposal 是后端用于“确认入画布”的可写入提案。',
    'proposal.rationale 必须解释为什么这么建议；proposal.contextSources 必须列出来源标题、片段和命中原因，用于前端确认前审计。',
    '你必须基于原始需求、完整画布、当前节点、上下游节点和对话历史生成可确认提案。',
    '知识库为空时，也要基于原始需求和当前画布给出结构化建议，不要只说缺少资料。',
    '不要声称已完成后端没有执行的动作。'
  ].join('\n')
  const userPrompt = [
    `原始需求：${run.input || run.workflowName || '未命名项目'}`,
    `项目：${run.workflowName || run.input || '未命名项目'}`,
    `当前节点：${node.title}`,
    `节点说明：${node.summary}`,
    `动作类型：${actionType}`,
    normalizedCanvasAction?.action ? `画布动作：${normalizedCanvasAction.action}` : '',
    normalizedCanvasAction?.nodeId ? `画布动作节点：${normalizedCanvasAction.nodeId}` : '',
    normalizedCanvasAction ? `动作意图：${normalizedCanvasAction.actionIntent}` : '',
    normalizedCanvasAction ? `输出章节：${normalizedCanvasAction.expectedSections.join('、')}` : '',
    normalizedCanvasAction?.actionTemplate ? `动作模板：${normalizedCanvasAction.actionTemplate}` : '',
    `用户消息：${message.content || ''}`,
    normalizedCanvasAction ? canvasActionOutputGuide(normalizedCanvasAction.actionIntent) : '',
    renderNodeLines('完整画布', canvasContext.fullCanvas.nodes),
    renderNodeLines('上游节点', canvasContext.upstreamNodes),
    renderNodeLines('下游节点', canvasContext.downstreamNodes),
    renderLines('已有提案', pendingProposals.map((proposal) => `${proposal.id}｜${proposal.status}｜${proposal.summary || proposal.title}`)),
    '知识库为空时：仍需结合原始需求、完整画布和当前节点输出可确认、可写入画布的结构化建议。',
    renderLines('画布事实', node.content),
    renderLines('引用资料', references.map((item) => `${item.name}：${item.text || item.kind}`)),
    `知识检索状态：${knowledgeRetrievalError || (retrievedKnowledge.length ? '已召回项目知识' : '未命中项目知识')}`,
    renderLines('知识库召回', retrievedKnowledge.map((item) => {
      const evidence = item.evidence.map((source) => source.url || source.title || source.text).filter(Boolean).join('、')
      return `${item.title}：${item.snippet}${evidence ? `；证据：${evidence}` : ''}`
    })),
    renderLines('最近对话', history.map((item) => `${item.role}：${item.content}`))
  ].join('\n\n')

  return {
    actionType,
    scopeId,
    model,
    modelLabel: modelLabel(model),
    run,
    step,
    node,
    fullCanvas: canvasContext.fullCanvas,
    currentNode: canvasContext.currentNode,
    upstreamNodes: canvasContext.upstreamNodes,
    downstreamNodes: canvasContext.downstreamNodes,
    canvasAction: normalizedCanvasAction || canvasAction,
    message: {
      role: message.role || 'user',
      content: message.content || ''
    },
    references,
    retrievedKnowledge,
    knowledgeRetrievalError,
    history,
    pendingProposals,
    now: payload.now || new Date().toISOString(),
    systemPrompt,
    userPrompt
  }
}
