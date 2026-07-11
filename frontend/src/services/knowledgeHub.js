const SECTION_DEFINITIONS = [
  { key: 'entries', label: '知识条目', description: '查看已入库的资料、来源证据和可信状态' },
  { key: 'structure', label: '框架全览', description: '以 XMind 形式查看项目模块、页面、状态和规则' },
  { key: 'flow', label: '流程图', description: '按页面原型串起交互路径和跳转关系' },
  { key: 'prototype', label: '交互 Demo', description: '播放后端截图资产上的点击热区和页面跳转' },
  { key: 'markdown', label: 'Markdown', description: '完整蓝图文档，适合复制、审阅和交付' }
]

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function compactText(...parts) {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => typeof part === 'string' ? part : JSON.stringify(part))
    .join(' ')
}

function keywordsFromText(text = '') {
  return Array.from(new Set(
    String(text)
      .split(/[^\p{L}\p{N}]+/u)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2)
      .slice(0, 12)
  ))
}

const MARKDOWN_SECTION_GROUPS = [
  { value: 'overview', label: '总览', pattern: /\bwhat\b|\bwhy\b|\bhow\b|文档核心|核心分析|产品机会|战略价值|背景目标|项目交互设计方案/i },
  { value: 'scope', label: '范围', pattern: /优先级|p0|p1|p2|风险|确认|边界|待确认/i },
  { value: 'architecture', label: '结构', pattern: /项目档案|产品结构|结构树|页面框架|框架图|模块|信息架构/i },
  { value: 'interaction', label: '交互', pattern: /交互|路径|流程|状态|异常|页面|demo/i },
  { value: 'delivery', label: '交付', pattern: /接口|契约|前后端|分工|验收|标准|评审|清单|开发/i }
]

function markdownSectionGroup(title = '') {
  const normalized = String(title || '').toLowerCase()
  return MARKDOWN_SECTION_GROUPS.find((group) => group.pattern.test(normalized))
    || { value: 'delivery', label: '交付' }
}

function markdownTabValue(title = '', index = 0) {
  const normalized = String(title).toLowerCase()
  const semanticKey = [
    ['what', /\bwhat\b|文档核心|核心分析|背景目标/],
    ['why', /\bwhy\b|产品机会|战略价值|价值/],
    ['how', /\bhow\b|产品结构|交互主路径|主路径|流程/],
    ['priority', /优先级|p0|p1|p2/],
    ['risk', /风险|确认|边界/],
    ['acceptance', /验收|标准/]
  ].find(([, pattern]) => pattern.test(normalized))?.[0]
  if (semanticKey) return semanticKey
  const slug = normalized
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug || `section-${index + 1}`
}

function markdownTabLabel(title = '', index = 0) {
  const cleanTitle = String(title)
    .replace(/^#+\s*/, '')
    .trim()
  const primaryLabel = cleanTitle.split(/\s*[|｜]\s*/)[0]?.trim() || cleanTitle
  return primaryLabel || `章节 ${index + 1}`
}

export function buildMarkdownSectionTabs(markdown = '') {
  const source = String(markdown || '').trim()
  if (!source) return [{ value: 'all', label: '全部', content: '' }]
  const matches = Array.from(source.matchAll(/^##\s+(.+)$/gm))
  if (!matches.length) return [{ value: 'all', label: '全部', content: source }]
  const rawSections = matches.map((match, index) => {
    const start = match.index
    const end = matches[index + 1]?.index ?? source.length
    const title = match[1].trim()
    return {
      value: markdownTabValue(title, index),
      label: markdownTabLabel(title, index),
      group: markdownSectionGroup(title),
      content: source.slice(start, end).trim()
    }
  })
  const groupedSections = MARKDOWN_SECTION_GROUPS
    .map((group) => {
      const children = rawSections.filter((section) => section.group.value === group.value)
      if (!children.length) return null
      return {
        value: group.value,
        label: group.label,
        content: children.map((section) => section.content).join('\n\n')
      }
    })
    .filter(Boolean)
  const sections = groupedSections.length ? groupedSections : rawSections
  const uniqueSections = sections.map((section, index, allSections) => {
    if (allSections.findIndex((item) => item.value === section.value) === index) return section
    return {
      ...section,
      value: `${section.value}-${index + 1}`
    }
  })
  return [
    { value: 'all', label: '全部', content: source },
    ...uniqueSections
  ]
}

function makeBlueprintNode({ id, type, title, summary = '', meta = '', children = [], raw = null }) {
  const text = compactText(title, summary, meta, children)
  return {
    id: id || `${type}-${title || Math.random().toString(36).slice(2)}`,
    type,
    title: title || '未命名节点',
    summary,
    meta,
    keywords: keywordsFromText(text),
    raw
  }
}

function flattenTree(node, prefix = 'framework') {
  if (!node) return []
  const title = node.title || node.name || node.label || prefix
  const current = makeBlueprintNode({
    id: node.id || `${prefix}-${title}`,
    type: 'framework',
    title,
    summary: node.meta || node.detail || node.description || '',
    children: asArray(node.children).map((child) => child.title || child.name),
    raw: node
  })
  return [
    current,
    ...asArray(node.children).flatMap((child, index) => flattenTree(child, `${current.id}-${index}`))
  ]
}

export function buildBlueprintIndex(blueprintAsset = null) {
  const blueprint = blueprintAsset?.blueprint || blueprintAsset || null
  if (!blueprint) {
    return {
      assetId: blueprintAsset?.id || '',
      title: '暂无项目蓝图',
      summary: '当前项目还没有可索引的蓝图。',
      nodes: []
    }
  }
  const profile = blueprint.profile || {}
  const frameworkNodes = flattenTree(blueprint.framework)
  const pageNodes = asArray(blueprint.pages || blueprint.demoScreens).map((page, index) =>
    makeBlueprintNode({
      id: page.id || page.pageId || `page-${index}`,
      type: 'page',
      title: page.name || page.title || page.pageName,
      summary: page.goal || page.description || page.layout || page.wireframe?.layout || '',
      children: page.states || page.visibleRegions || page.actions?.map((action) => action.label),
      raw: page
    })
  )
  const flowNodes = asArray(blueprint.flows || blueprint.paths || blueprint.interactionTree?.children).map((flow, index) =>
    makeBlueprintNode({
      id: flow.id || flow.pathId || `flow-${index}`,
      type: 'flow',
      title: flow.title || flow.name || flow.label,
      summary: compactText(flow.goal, flow.summary, flow.description),
      children: flow.steps || flow.children?.map((child) => child.title || child.name),
      raw: flow
    })
  )
  const stateNodes = asArray(blueprint.interactionSkillV3?.stateMachines).map((machine, index) =>
    makeBlueprintNode({
      id: machine.pageId || `state-${index}`,
      type: 'state',
      title: `${machine.pageName || machine.pageId || '页面'}状态机`,
      summary: compactText(machine.initialState, asArray(machine.transitions).map((transition) => transition.event)),
      children: asArray(machine.transitions).map((transition) => `${transition.event}: ${transition.from || ''}->${transition.to || ''}`),
      raw: machine
    })
  )
  const ruleNodes = asArray(blueprint.acceptance || blueprint.interactionSpec?.acceptanceChecks).map((rule, index) =>
    makeBlueprintNode({
      id: `acceptance-${index}`,
      type: 'rule',
      title: typeof rule === 'string' ? rule : rule.title || rule.label,
      summary: typeof rule === 'string' ? rule : rule.description || rule.content || '',
      raw: rule
    })
  )
  const nodes = [...frameworkNodes, ...pageNodes, ...flowNodes, ...stateNodes, ...ruleNodes]
  return {
    assetId: blueprintAsset?.id || blueprint.id || '',
    title: blueprint.title || blueprintAsset?.title || profile.productName || '项目蓝图',
    summary: profile.positioning || profile.primaryGoal || blueprint.summary || '项目蓝图已沉淀为知识库索引。',
    profile,
    nodes
  }
}

export function classifyKnowledgeMaterial(material = {}) {
  const category = String(material.category || '').toLowerCase()
  const text = compactText(material.title, material.meta, material.notes).toLowerCase()
  if (/^blueprint-|^interaction-flow$/.test(category)) return 'blueprint'
  if (/knowledge-card|card/.test(category)) return 'card'
  if (/design-decision|decision/.test(category)) return 'decision'
  if (/business-rule|rule|acceptance/.test(category)) return 'rule'
  if (/design-decision|decision|设计决策|取舍|决策/.test(text)) return 'decision'
  if (/business-rule|rule|acceptance|验收|权限|状态|异常|规则/.test(text)) return 'rule'
  if (material.sourceUrl || material.evidence?.length || ['website', 'document'].includes(material.sourceType)) {
    return 'source'
  }
  return 'card'
}

function withKnowledgeSummary(material = {}) {
  return {
    ...material,
    summary: material.notes || material.meta || String(material.content || '').slice(0, 120) || '暂无摘要',
    sourceLabel: material.sourceUrl || material.sourceType || material.meta || '手动知识',
    roleLabel: asArray(material.roleScopes).join(' / ') || '全部角色'
  }
}

function markdownSafeSnippet(value = '', limit = 900) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return '暂无正文摘要'
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function materialEvidenceLine(material = {}) {
  const evidence = asArray(material.evidence)
    .map((item) => item.title || item.sourceUrl || item.text)
    .filter(Boolean)
  if (evidence.length) return evidence.slice(0, 4).join('；')
  return material.sourceUrl || material.sourceType || '暂无明确来源证据'
}

export function buildKnowledgeMaterialsMarkdown({ projectName = '当前项目', materials = [] } = {}) {
  const items = asArray(materials)
  if (!items.length) return ''
  const lines = [
    `# ${projectName || '当前项目'} 知识库材料汇总`,
    '',
    `材料数量：${items.length}`,
    '',
    '## 总览',
    ...items.map((material, index) => `${index + 1}. ${material.title || '未命名知识'} - ${material.category || material.meta || material.sourceType || '未分类'}`)
  ]
  items.forEach((material) => {
    lines.push(
      '',
      `## ${material.title || '未命名知识'}`,
      '',
      `- 分类：${material.category || '未分类'}`,
      `- 角色：${asArray(material.roleScopes).join(' / ') || '全部角色'}`,
      `- 可信状态：${material.verification?.status || material.verifiedStatus || 'unverified'}`,
      `- 来源证据：${materialEvidenceLine(material)}`,
      '',
      markdownSafeSnippet(material.content || material.notes || material.meta)
    )
  })
  return lines.join('\n')
}

export function relatedKnowledgeForBlueprintNode(node = {}, materials = []) {
  const keywords = new Set([
    ...(node.keywords || []),
    ...keywordsFromText(compactText(node.title, node.summary))
  ].map((keyword) => keyword.toLowerCase()))
  if (!keywords.size) return []
  return materials
    .map((material) => {
      const haystack = compactText(material.title, material.meta, material.notes, material.content, material.category).toLowerCase()
      const score = Array.from(keywords).filter((keyword) => haystack.includes(keyword)).length
      return { material, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.material)
}

export function buildKnowledgeHubView({ project = null, blueprintAsset = null, materials = [], parseJobs = [] } = {}) {
  const blueprint = buildBlueprintIndex(blueprintAsset)
  const buckets = {
    blueprint: [],
    card: [],
    decision: [],
    rule: [],
    source: []
  }
  asArray(materials).forEach((material) => {
    const bucket = classifyKnowledgeMaterial(material)
    buckets[bucket].push(withKnowledgeSummary(material))
  })
  const verifiedCount = asArray(materials).filter((item) => item.verification?.status === 'verified').length
  return {
    sections: SECTION_DEFINITIONS.map((section) => ({ ...section })),
    overview: {
      projectName: project?.name || '当前项目',
      blueprintTitle: blueprint.title,
      blueprintNodeCount: blueprint.nodes.length,
      knowledgeCount: asArray(materials).length,
      blueprintMaterialCount: buckets.blueprint.length,
      sourceCount: buckets.source.length,
      decisionCount: buckets.decision.length,
      ruleCount: buckets.rule.length,
      verifiedCount,
      parseJobCount: asArray(parseJobs).length
    },
    blueprint,
    entries: { items: asArray(materials).map(withKnowledgeSummary) },
    blueprintMaterials: { items: buckets.blueprint },
    cards: { items: buckets.card },
    decisions: { items: buckets.decision },
    rules: { items: buckets.rule },
    sources: { items: buckets.source },
    retrieval: { queryHint: '例如：上传失败时界面应该如何恢复？' },
    jobs: { items: asArray(parseJobs) }
  }
}
