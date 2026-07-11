function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function slug(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    || 'node'
}

function makeNodeId(path = [], fallback = 'node') {
  return path.map((item) => slug(item)).filter(Boolean).join('/') || fallback
}

function treeChildren(node = {}, path = [], kind = 'module') {
  return asArray(node.children).map((child) => frameNodeFromTree(child, [...path, child.title || child.name], kind))
}

function frameNodeFromTree(node = {}, path = [], kind = 'module') {
  const title = node.title || node.name || '未命名节点'
  return {
    id: node.id || makeNodeId(path.length ? path : [title]),
    title,
    kind,
    meta: node.meta || node.detail || '',
    ui: node.ui || null,
    children: treeChildren(node, path.length ? path : [title], kind)
  }
}

function pageNode(screen = {}, index = 0) {
  return {
    id: screen.id || `page-${index}`,
    title: screen.title || screen.pageName || `页面 ${index + 1}`,
    kind: 'page',
    meta: screen.description || screen.wireframe?.layout || '',
    page: screen,
    children: asArray(screen.wireframe?.components).map((component, componentIndex) => ({
      id: `${screen.id || `page-${index}`}/component-${componentIndex}`,
      title: component.label || component.type || `组件 ${componentIndex + 1}`,
      kind: 'component',
      meta: component.detail || component.behavior || '',
      component,
      children: []
    }))
  }
}

function stateNode(machine = {}, index = 0) {
  return {
    id: machine.pageId || `state-${index}`,
    title: `${machine.pageName || machine.pageId || '页面'}状态机`,
    kind: 'state-machine',
    meta: `初始状态：${machine.initialState || 'idle'}`,
    stateMachine: machine,
    children: asArray(machine.transitions).map((transition, transitionIndex) => ({
      id: `${machine.pageId || `state-${index}`}/transition-${transitionIndex}`,
      title: transition.event || `状态流转 ${transitionIndex + 1}`,
      kind: 'transition',
      meta: `${transition.from || ''} -> ${transition.to || ''}`,
      transition,
      children: []
    }))
  }
}

function journeyNode(tree = {}, index = 0) {
  const base = frameNodeFromTree(tree, [tree.title || `用户路径 ${index + 1}`], 'flow')
  return {
    ...base,
    id: base.id === 'node' ? `journey-${index}` : base.id,
    kind: 'flow'
  }
}

function decisionNodes(blueprint = {}) {
  const optionDecisions = asArray(blueprint.interactionSkillV2?.solutionGroups).flatMap((group) =>
    asArray(group.options)
      .filter((option) => option.id === group.selectedOptionId || /推荐/.test(`${option.title} ${option.label}`))
      .map((option) => ({
        id: `decision-${group.id}`,
        title: `${group.title}：${option.title || option.label || '推荐方案'}`,
        kind: 'decision',
        meta: `${option.description || ''}${option.tradeoff ? `｜取舍：${option.tradeoff}` : ''}`,
        decision: { group, option },
        children: []
      }))
  )
  const repairDecisions = asArray(blueprint.interactionSkillV2?.qualityReport?.repairItems).map((item) => ({
    id: `decision-${item.id}`,
    title: item.reason || item.id,
    kind: 'decision',
    meta: item.action || '',
    decision: item,
    children: []
  }))
  return [...optionDecisions, ...repairDecisions]
}

function flattenTree(node = null, parentId = '') {
  if (!node) return []
  return [
    { ...node, parentId },
    ...asArray(node.children).flatMap((child) => flattenTree(child, node.id))
  ]
}

function textIncludesNode(item = {}, node = {}) {
  const haystack = [
    item.title,
    item.content,
    item.notes,
    item.meta,
    JSON.stringify(item.relations || [])
  ].join('\n').toLowerCase()
  return [node.id, node.title].filter(Boolean).some((part) => haystack.includes(String(part).toLowerCase()))
}

function relatedKnowledgeForNode(node = {}, knowledge = []) {
  return asArray(knowledge).filter((item) =>
    asArray(item.relations).some((relation) => relation.type === 'blueprint-node' && (
      relation.targetId === node.id ||
      relation.targetId === node.page?.id ||
      node.id.endsWith(`/${relation.targetId}`) ||
      (relation.targetId === 'home' && /首页|入口|home/i.test(node.title || ''))
    )) ||
    textIncludesNode(item, node)
  )
}

function detailForNode(node = {}, blueprint = {}, knowledge = []) {
  const page = node.page || asArray(blueprint.demoScreens).find((screen) => screen.id === node.id || screen.title === node.title)
  const machine = node.stateMachine || asArray(blueprint.interactionSkillV3?.stateMachines).find((item) => item.pageId === node.id)
  const pageSpec = asArray(blueprint.interactionSpec?.pageSpecs).find((item) => item.screenId === page?.id || item.pageName === node.title)
  const relatedKnowledge = relatedKnowledgeForNode(node, knowledge)
  const components = asArray(page?.wireframe?.components || node.ui?.components)
  const transitions = asArray(machine?.transitions)
  return {
    id: node.id,
    title: node.title,
    kind: node.kind,
    goal: page?.description || page?.wireframe?.layout || node.ui?.layout || node.meta || `${node.title} 的结构、流程和规则。`,
    inputs: [
      ...components.filter((item) => /input|textarea|upload|dropzone|select|输入|上传/i.test(`${item.type} ${item.label}`)).map((item) => item.label || item.type),
      ...(page?.visibleRegions || []).filter((item) => /输入|上传|表单|筛选/.test(item))
    ].filter(Boolean),
    outputs: [
      ...asArray(page?.actions).map((action) => action.to ? `${action.label} -> ${action.to}` : action.label),
      ...components.filter((item) => /button|submit|save|generate|next|生成|保存|提交/i.test(`${item.type} ${item.label}`)).map((item) => item.label || item.type)
    ].filter(Boolean),
    flowSteps: [
      ...asArray(node.children).map((child) => child.title),
      ...asArray(pageSpec?.states).map((state) => `${state.name}: ${state.trigger} -> ${state.next}`),
      ...asArray(page?.actions).map((action) => `点击 ${action.label} 后进入 ${action.to || '下一步'}`),
      ...transitions.map((transition) => `${transition.event}: ${transition.from || ''} -> ${transition.to || ''}`)
    ].filter(Boolean),
    exceptionStates: [
      ...transitions.filter((transition) => /fail|error|denied|empty|失败|错误|权限|空/.test(`${transition.event} ${transition.to}`)).map((transition) => transition.recovery || transition.feedback || transition.event),
      ...asArray(pageSpec?.exceptions).map((item) => `${item.trigger}: ${item.recovery || item.message || ''}`),
      ...(blueprint.interactionSpec?.errorStates || [])
    ].filter(Boolean),
    relatedPages: page ? [page.title || page.id] : asArray(blueprint.demoScreens).filter((screen) => textIncludesNode(screen, node)).map((screen) => screen.title || screen.id),
    relatedKnowledge,
    evidence: relatedKnowledge.flatMap((item) => asArray(item.evidence)),
    raw: node
  }
}

function relationGraphFor({ nodes = [], knowledge = [], blueprint = {} } = {}) {
  const graphNodes = [
    { id: 'requirements', label: '需求文档', type: 'requirements' },
    { id: 'competitors', label: '竞品分析', type: 'competitors' },
    { id: 'website', label: '项目网站解析', type: 'website' },
    { id: 'design', label: '设计方案', type: 'design' },
    { id: 'engineering', label: '工程开发', type: 'engineering' },
    { id: 'delivery', label: '交付资产', type: 'delivery' },
    ...nodes.map((node) => ({ id: node.id, label: node.title, type: 'blueprint-node' })),
    ...asArray(knowledge).map((item) => ({ id: item.id, label: item.title, type: 'knowledge' }))
  ]
  const blueprintTargets = nodes.slice(0, 4)
  const edges = [
    ...blueprintTargets.map((node) => ({ from: 'requirements', to: node.id, fromType: 'requirements', toType: 'blueprint-node' })),
    ...blueprintTargets.map((node) => ({ from: node.id, to: 'design', fromType: 'blueprint-node', toType: 'design' })),
    ...asArray(knowledge).map((item) => ({ from: item.id, to: 'design', fromType: 'knowledge', toType: 'design' })),
    { from: 'design', to: 'engineering', fromType: 'design', toType: 'engineering' },
    { from: 'engineering', to: 'delivery', fromType: 'engineering', toType: 'delivery' },
    ...asArray(knowledge).flatMap((item) =>
      asArray(item.relations)
        .filter((relation) => relation.type === 'blueprint-node')
        .map((relation) => ({
          from: relation.targetId,
          to: item.id,
          fromType: 'blueprint-node',
          toType: 'knowledge'
        }))
    )
  ]
  return {
    title: `${blueprint.profile?.productName || blueprint.title || '项目'} 蓝图关系图`,
    nodes: graphNodes,
    edges
  }
}

export function visibleBlueprintFrameNodes(root = {}, expandedIds = new Set()) {
  const output = []
  const expandedIdList = [...expandedIds]
  function visit(node, depth = 0) {
    if (!node?.id) return
    const hasExpandedDescendant = expandedIdList.some((id) => String(id || '').startsWith(`${node.id}/`))
    const isExpanded = expandedIds.has(node.id) || hasExpandedDescendant
    output.push({ ...node, depth, collapsed: asArray(node.children).length > 0 && !isExpanded })
    if (isExpanded) {
      asArray(node.children).forEach((child) => visit(child, depth + 1))
    }
  }
  asArray(root.children).forEach((child) => visit(child, 0))
  return output
}

export function buildBlueprintWorkbench({ blueprint = {}, knowledge = [] } = {}) {
  const frameworkRoot = frameNodeFromTree(blueprint.framework || { title: blueprint.profile?.productName || blueprint.title || '产品结构' }, ['product'], 'module')
  const journeyRoot = {
    id: 'journeys',
    title: '用户路径',
    kind: 'group',
    meta: '从需求入口到交付资产的用户主路径。',
    children: [
      ...(blueprint.interactionTree ? [journeyNode(blueprint.interactionTree)] : []),
      ...asArray(blueprint.opportunityValidation?.journeyMaps).map((journey) => ({
        id: journey.journeyId || `journey-${slug(journey.scenario)}`,
        title: journey.scenario || '用户路径',
        kind: 'flow',
        meta: `${journey.start || '开始'} -> ${journey.end || '结束'}`,
        journey,
        children: asArray(journey.touchpoints).map((point, index) => ({
          id: `${journey.journeyId || 'journey'}/touchpoint-${index}`,
          title: point.touchpoint || point.step || `触点 ${index + 1}`,
          kind: 'flow-step',
          meta: point.painPoint || point.opportunityHint || '',
          point,
          children: []
        }))
      }))
    ]
  }
  const pageRoot = {
    id: 'pages',
    title: '页面清单',
    kind: 'group',
    meta: '蓝图里的页面、区域和组件。',
    children: asArray(blueprint.demoScreens).map(pageNode)
  }
  const stateRoot = {
    id: 'states',
    title: '交互状态',
    kind: 'group',
    meta: '页面状态机和状态流转。',
    children: asArray(blueprint.interactionSkillV3?.stateMachines).map(stateNode)
  }
  const ruleRoot = {
    id: 'rules',
    title: '业务规则',
    kind: 'group',
    meta: '验收标准、异常恢复和业务约束。',
    children: asArray(blueprint.interactionSpec?.acceptanceChecks).map((rule, index) => ({
      id: `rule-${index}`,
      title: typeof rule === 'string' ? rule : rule.title || rule.label || `规则 ${index + 1}`,
      kind: 'rule',
      meta: typeof rule === 'string' ? rule : rule.description || '',
      children: []
    }))
  }
  const decisionRoot = {
    id: 'decisions',
    title: '设计决策',
    kind: 'group',
    meta: '推荐方案、质量修复和关键取舍。',
    children: decisionNodes(blueprint)
  }
  const acceptanceRoot = {
    id: 'acceptance',
    title: '验收标准',
    kind: 'group',
    meta: '页面、流程、状态机和异常恢复的验收清单。',
    children: asArray(blueprint.interactionSkillV3?.qaProtocol?.acceptance).map((item, index) => ({
      id: `acceptance-${index}`,
      title: item,
      kind: 'acceptance',
      meta: item,
      children: []
    }))
  }
  const frameTree = {
    id: 'blueprint-root',
    title: '产品结构',
    kind: 'root',
    children: [frameworkRoot, journeyRoot, pageRoot, stateRoot, ruleRoot, decisionRoot, acceptanceRoot]
  }
  const nodes = flattenTree(frameTree).filter((node) => node.kind !== 'root')
  const detailMap = Object.fromEntries(nodes.map((node) => [node.id, detailForNode(node, blueprint, knowledge)]))
  return {
    frameTree,
    structureTree: nodes,
    nodes: nodes.map((node) => ({ ...node, detail: detailMap[node.id] })),
    detailMap,
    relationGraph: relationGraphFor({ nodes, knowledge, blueprint })
  }
}
