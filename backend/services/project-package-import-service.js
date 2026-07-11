const IGNORED_PATH_PARTS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.env'
]

const DEFAULT_ROLE_SCOPES = ['product', 'ux', 'development', 'qa', 'ai-retrieval']

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeFilePath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function normalizeProjectName(fileName = '') {
  return String(fileName || 'project-package')
    .replace(/\.(zip|tar\.gz|tgz)$/i, '')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project-package'
}

function safeJsonParse(value = '') {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function findProjectPackageJson(files = [], names = []) {
  const normalizedNames = names.map((name) => normalizeFilePath(name).toLowerCase())
  const file = files.find((item) => normalizedNames.includes(normalizeFilePath(item.path).toLowerCase().split('/').pop())) ||
    files.find((item) => normalizedNames.includes(normalizeFilePath(item.path).toLowerCase()))
  return file ? safeJsonParse(file.content) : null
}

function fileContentByPath(files = []) {
  const map = new Map()
  files.forEach((file) => {
    const path = normalizeFilePath(file.path).toLowerCase()
    if (path) map.set(path, file.content)
  })
  return map
}

function resolvePackageFileContent(fileMap, source = '') {
  const normalized = normalizeFilePath(source).toLowerCase()
  if (!normalized) return ''
  if (String(source).startsWith('data:')) return source
  if (fileMap.has(normalized)) return fileMap.get(normalized)
  const suffixMatch = Array.from(fileMap.entries()).find(([path]) => path.endsWith(`/${normalized}`) || path.endsWith(normalized))
  return suffixMatch?.[1] || ''
}

function normalizeHotspotRect(rect = {}, index = 0) {
  const source = rect && typeof rect === 'object' ? rect : {}
  const raw = {
    x: Number(source.x ?? source.left ?? 8),
    y: Number(source.y ?? source.top ?? Math.min(82, 18 + index * 12)),
    width: Number(source.width ?? source.w ?? 18),
    height: Number(source.height ?? source.h ?? 8)
  }
  const normalized = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number.isFinite(value) ? value : 0]))
  const looksNormalized = Math.max(
    Math.abs(normalized.x),
    Math.abs(normalized.y),
    Math.abs(normalized.width),
    Math.abs(normalized.height)
  ) <= 1
  return looksNormalized
    ? {
        x: normalized.x * 100,
        y: normalized.y * 100,
        width: normalized.width * 100,
        height: normalized.height * 100
      }
    : normalized
}

function normalizeHotspotTarget(hotspot = {}) {
  return hotspot.targetScreenId ||
    hotspot.targetPageId ||
    hotspot.to ||
    hotspot.target ||
    hotspot.screenId ||
    hotspot.action?.targetPageId ||
    hotspot.action?.targetScreen ||
    hotspot.action?.target ||
    hotspot.action?.to ||
    hotspot.action?.screenId ||
    ''
}

function normalizePackageHotspot(hotspot = {}, index = 0) {
  const action = hotspot.action || {}
  return {
    ...hotspot,
    id: hotspot.id || `hotspot-${index + 1}`,
    label: hotspot.label || hotspot.title || hotspot.name || `点击热区 ${index + 1}`,
    event: hotspot.event || action.type || 'click',
    type: hotspot.type || action.type || hotspot.event || 'click',
    targetScreenId: normalizeHotspotTarget(hotspot),
    targetUrl: hotspot.targetUrl || hotspot.href || hotspot.url || action.route || '',
    rect: normalizeHotspotRect(hotspot.rect || hotspot.hotspot, index),
    feedback: hotspot.feedback || hotspot.message || hotspot.state || action.result || action.feedback || action.guard || '',
    guard: hotspot.guard || action.guard || '',
    field: hotspot.field || action.field || '',
    value: hotspot.value || action.value || '',
    name: hotspot.name || action.name || '',
    result: hotspot.result || action.result || ''
  }
}

function hotspotTargetLabel(hotspot = {}) {
  return normalizeHotspotTarget(hotspot) ||
    hotspot.targetUrl ||
    hotspot.href ||
    hotspot.url ||
    hotspot.action?.route ||
    hotspot.action?.name ||
    hotspot.action?.field ||
    hotspot.action?.value ||
    hotspot.action?.target ||
    ''
}

function describePackageHotspot(hotspot = {}) {
  const rect = normalizeHotspotRect(hotspot.rect || hotspot.hotspot)
  const action = hotspot.action || {}
  return [
    action.type || hotspot.event ? `类型：${action.type || hotspot.event}` : '',
    hotspotTargetLabel(hotspot) ? `目标：${hotspotTargetLabel(hotspot)}` : '',
    action.guard ? `守卫：${action.guard}` : '',
    `坐标：x=${Number(rect.x.toFixed(2))}%, y=${Number(rect.y.toFixed(2))}%, w=${Number(rect.width.toFixed(2))}%, h=${Number(rect.height.toFixed(2))}%`
  ].filter(Boolean).join('；')
}

function normalizePrototypeDemo(prototypeDemo = null, files = []) {
  if (!prototypeDemo || typeof prototypeDemo !== 'object' || Array.isArray(prototypeDemo)) return null
  const fileMap = fileContentByPath(files)
  const screens = Array.isArray(prototypeDemo.screens) ? prototypeDemo.screens : []
  return {
    ...prototypeDemo,
    source: prototypeDemo.source || 'project-package',
    screens: screens.map((screen, index) => {
      const screenshotUrl = resolvePackageFileContent(fileMap, screen.screenshotUrl || screen.screenshot || screen.image || '') ||
        screen.screenshotUrl ||
        screen.screenshot ||
        screen.image ||
        ''
      return {
        ...screen,
        id: screen.id || `screen-${index + 1}`,
        title: screen.title || screen.name || `页面 ${index + 1}`,
        screenshotUrl,
        hotspots: asArray(screen.hotspots).map((hotspot, hotspotIndex) => normalizePackageHotspot(hotspot, hotspotIndex))
      }
    }),
    transitions: Array.isArray(prototypeDemo.transitions) ? prototypeDemo.transitions : []
  }
}

function enrichFrameworkWithPrototypeHotspots(framework = null, prototypeDemo = null) {
  if (!framework) return framework
  const screens = asArray(prototypeDemo?.screens)
  if (!screens.length) return framework
  const byId = new Map(screens.map((screen) => [screen.id, screen]).filter(([id]) => id))
  const byRoute = new Map(screens.map((screen) => [screen.route, screen]).filter(([route]) => route))
  const enrichNode = (node = {}, claimedScreenIds = new Set()) => {
    const screen = byId.get(node.id) || byRoute.get(node.route)
    const nextClaimedScreenIds = new Set(claimedScreenIds)
    if (screen?.id) nextClaimedScreenIds.add(screen.id)
    const children = asArray(node.children).map((child) => enrichNode(child, nextClaimedScreenIds))
    if (screen?.id && claimedScreenIds.has(screen.id)) return { ...node, children }
    if (!screen || !asArray(screen.hotspots).length) return { ...node, children }
    const existingIds = new Set(children.map((child) => child.id))
    const hotspotChildren = asArray(screen.hotspots)
      .filter((hotspot) => hotspot.id && !existingIds.has(hotspot.id))
      .map((hotspot) => ({
        id: hotspot.id,
        title: hotspot.label || hotspot.title || hotspot.name || '点击热区',
        meta: describePackageHotspot(hotspot),
        action: hotspot.action?.name || hotspot.action?.type || hotspot.event || '',
        route: hotspot.targetUrl || hotspot.action?.route || '',
        guard: hotspot.action?.guard || '',
        rect: hotspot.rect || normalizeHotspotRect(hotspot.hotspot),
        children: []
      }))
    if (!hotspotChildren.length) return { ...node, children }
    const clickDetailsGroup = {
      id: `${node.id}-click-details`,
      title: '点击细节',
      meta: `${screen.title || node.title || node.id} · ${hotspotChildren.length} 个点击热区`,
      children: hotspotChildren
    }
    return {
      ...node,
      children: children.some((child) => child.id === clickDetailsGroup.id)
        ? children
        : [...children, clickDetailsGroup]
    }
  }
  return enrichNode(framework)
}

function normalizeEntryTreeNode(node = {}, index = 0) {
  const title = node.title || node.label || node.name || node.id || `节点 ${index + 1}`
  const meta = [
    node.route ? `路由：${node.route}` : '',
    node.action ? `动作：${node.action}` : '',
    node.condition ? `条件：${node.condition}` : '',
    node.guard ? `守卫：${node.guard}` : '',
    node.note || ''
  ].filter(Boolean).join('；')
  return {
    ...node,
    id: node.id || `entry-${index + 1}`,
    title,
    meta: node.meta || meta,
    children: asArray(node.children).map((child, childIndex) => normalizeEntryTreeNode(child, childIndex))
  }
}

function normalizeEntryTreeFramework(entryTree = null, projectName = '项目结构') {
  if (!entryTree) return null
  if (entryTree.root) return normalizeEntryTreeNode(entryTree.root)
  const nodes = asArray(entryTree)
  if (!nodes.length) return null
  const nodeById = new Map(nodes.map((node) => [node.id, node]).filter(([id]) => id))
  const referencedIds = new Set()
  nodes.forEach((node) => {
    asArray(node.children).forEach((child) => {
      if (typeof child === 'string') referencedIds.add(child)
      else if (child?.id) referencedIds.add(child.id)
    })
  })
  const normalizeChild = (child, childIndex = 0, seen = new Set()) => {
    const source = typeof child === 'string' ? nodeById.get(child) || { id: child, title: child } : child
    if (!source || typeof source !== 'object') return null
    if (source.id && seen.has(source.id)) return { id: source.id, title: source.title || source.label || source.id, children: [] }
    const nextSeen = new Set(seen)
    if (source.id) nextSeen.add(source.id)
    const children = asArray(source.children)
      .map((grandchild, grandchildIndex) => normalizeChild(grandchild, grandchildIndex, nextSeen))
      .filter(Boolean)
    return {
      ...normalizeEntryTreeNode({ ...source, children: [] }, childIndex),
      children
    }
  }
  const rootChildren = nodes
    .filter((node) => !referencedIds.has(node.id))
    .map((node, index) => normalizeChild(node, index))
    .filter(Boolean)
  return {
    id: 'project-framework',
    title: projectName || '项目结构',
    meta: '项目包 entryTree',
    children: rootChildren.length ? rootChildren : nodes.map((node, index) => normalizeChild(node, index)).filter(Boolean)
  }
}

function normalizeFlowGraphTree(flowGraph = {}) {
  const nodes = asArray(flowGraph.nodes)
  const edges = asArray(flowGraph.edges)
  if (!nodes.length) return null
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Set(edges.map((edge) => edge.to).filter(Boolean))
  const roots = nodes.filter((node) => !incoming.has(node.id))
  const rootNodes = roots.length ? roots : nodes.slice(0, 1)
  const childrenFor = (nodeId = '') => edges.filter((edge) => edge.from === nodeId)
  const toTree = (node = {}, edgeLabel = '', seen = new Set()) => {
    const nextSeen = new Set(seen)
    nextSeen.add(node.id)
    return {
      id: node.id || `flow-${nextSeen.size}`,
      title: node.title || node.label || node.name || node.id || '流程节点',
      meta: [node.type, node.route, edgeLabel ? `来源：${edgeLabel}` : ''].filter(Boolean).join(' · '),
      children: childrenFor(node.id)
        .filter((edge) => edge.to && !nextSeen.has(edge.to))
        .map((edge) => toTree(nodeById.get(edge.to) || { id: edge.to, label: edge.to }, edge.label, nextSeen))
    }
  }
  return {
    id: 'interaction-flow',
    title: flowGraph.title || '核心交互流程',
    meta: flowGraph.summary || '',
    children: rootNodes.map((node) => toTree(node))
  }
}

function demoScreensFromPrototypeDemo(prototypeDemo = null) {
  return asArray(prototypeDemo?.screens).map((screen, index) => ({
    id: screen.id || `screen-${index + 1}`,
    title: screen.title || screen.name || `页面 ${index + 1}`,
    description: screen.summary || screen.description || screen.route || '',
    screenshotUrl: screen.screenshotUrl || '',
    route: screen.route || '',
    actions: asArray(screen.hotspots).map((hotspot, hotspotIndex) => ({
      id: hotspot.id || `${screen.id || `screen-${index + 1}`}-action-${hotspotIndex + 1}`,
      label: hotspot.label || hotspot.title || `动作 ${hotspotIndex + 1}`,
      to: hotspot.targetScreenId || hotspot.to || hotspot.target || '',
      targetScreenId: hotspot.targetScreenId || hotspot.to || hotspot.target || '',
      targetUrl: hotspot.targetUrl || hotspot.action?.route || '',
      rect: hotspot.rect || normalizeHotspotRect({}, hotspotIndex),
      event: hotspot.event || 'click',
      type: hotspot.action?.type || hotspot.event || 'click',
      guard: hotspot.action?.guard || '',
      field: hotspot.action?.field || '',
      value: hotspot.action?.value || '',
      name: hotspot.action?.name || '',
      detail: describePackageHotspot(hotspot)
    }))
  }))
}

function normalizeInteractionBlueprintArtifact(artifact = null, files = []) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return { blueprint: null, prototypeDemo: null }
  const fileMap = fileContentByPath(files)
  const projectName = artifact.appName || artifact.projectName || artifact.title || artifact.project?.name || '交互蓝图'
  const pages = asArray(artifact.pages || artifact.screens).map((page, index) => {
    const screenshotSource = page.screenshotUrl || page.screenshot || page.image || page.imageUrl || ''
    const screenshotUrl = resolvePackageFileContent(fileMap, screenshotSource) || screenshotSource
    return {
      ...page,
      id: page.id || page.pageId || `screen-${index + 1}`,
      title: page.title || page.name || page.pageName || `页面 ${index + 1}`,
      route: page.route || page.path || page.url || '',
      screenshotUrl,
      hotspots: asArray(page.hotspots || page.actions).map((hotspot, hotspotIndex) => normalizePackageHotspot(hotspot, hotspotIndex))
    }
  })
  const prototypeDemo = {
    source: artifact.source || 'interaction-blueprint',
    metadata: artifact.metadata || {},
    screens: pages,
    states: asArray(artifact.states),
    apiCalls: asArray(artifact.apiCalls || artifact.apis),
    transitions: asArray(artifact.transitions).length
      ? artifact.transitions
      : pages.flatMap((page) =>
          asArray(page.hotspots)
            .filter((hotspot) => hotspot.targetScreenId)
            .map((hotspot) => ({
              id: `${page.id}-${hotspot.id}-${hotspot.targetScreenId}`,
              from: page.id,
              to: hotspot.targetScreenId,
              label: hotspot.label,
              event: hotspot.event || hotspot.type || 'click',
              targetUrl: hotspot.targetUrl || ''
            }))
        )
  }
  const framework = {
    id: 'interaction-blueprint',
    title: projectName,
    meta: artifact.summary || artifact.description || '外部项目导出的交互蓝图',
    children: pages.map((page) => ({
      id: page.id,
      title: page.title,
      route: page.route,
      meta: [
        page.route ? `路由：${page.route}` : '',
        `${asArray(page.hotspots).length} 个点击热区`
      ].filter(Boolean).join('；'),
      children: asArray(page.hotspots).length
        ? [{
            id: `${page.id}-click-details`,
            title: '点击细节',
            meta: `${page.title} · ${asArray(page.hotspots).length} 个点击热区`,
            children: asArray(page.hotspots).map((hotspot) => ({
              id: hotspot.id,
              title: hotspot.label,
              meta: describePackageHotspot(hotspot),
              action: hotspot.name || hotspot.type || hotspot.event || '',
              route: hotspot.targetUrl || '',
              guard: hotspot.guard || '',
              rect: hotspot.rect,
              children: []
            }))
          }]
        : []
    }))
  }
  const interactionTree = asArray(artifact.flows).length
    ? {
        id: 'interaction-flow',
        title: '核心交互流程',
        meta: `${artifact.flows.length} 条外部项目流程`,
        children: artifact.flows.map((flow, flowIndex) => ({
          id: flow.id || `flow-${flowIndex + 1}`,
          title: flow.name || flow.title || `流程 ${flowIndex + 1}`,
          meta: flow.summary || '',
          children: asArray(flow.steps).map((step, stepIndex) => ({
            id: step.id || `${flow.id || `flow-${flowIndex + 1}`}-step-${stepIndex + 1}`,
            title: step.title || step.action || step.label || step.pageId || `步骤 ${stepIndex + 1}`,
            meta: [step.pageId ? `页面：${step.pageId}` : '', step.result ? `结果：${step.result}` : ''].filter(Boolean).join('；'),
            children: []
          }))
        }))
      }
    : null
  const blueprint = {
    title: artifact.title || `${projectName} 交互蓝图`,
    source: 'interaction-blueprint',
    interactionBlueprintArtifact: artifact,
    profile: {
      productName: projectName,
      positioning: artifact.description || artifact.summary || '',
      primaryGoal: artifact.primaryGoal || artifact.project?.purpose || '',
      stage: '交互蓝图包导入'
    },
    framework,
    interactionTree,
    demoScreens: demoScreensFromPrototypeDemo(prototypeDemo),
    reviewChecklist: asArray(artifact.reviewChecklist || artifact.knownGaps)
  }
  return { blueprint, prototypeDemo }
}

function prototypeDemoKnowledgeContent(prototypeDemo = null, source = {}) {
  const screens = asArray(prototypeDemo?.screens)
  if (!screens.length) return ''
  const transitions = asArray(prototypeDemo?.transitions)
  const states = asArray(prototypeDemo?.states)
  const apiCalls = asArray(prototypeDemo?.apiCalls)
  return [
    `交互蓝图：${source.packageName || source.fileName || '外部项目'}`,
    '',
    '## 页面与热区',
    ...screens.flatMap((screen) => [
      `- ${screen.title || screen.id}${screen.route ? `（${screen.route}）` : ''}`,
      ...asArray(screen.hotspots).map((hotspot) => `  - ${hotspot.label}：${describePackageHotspot(hotspot)}${hotspot.feedback ? `；反馈：${hotspot.feedback}` : ''}${hotspot.result ? `；结果：${hotspot.result}` : ''}`)
    ]),
    '',
    '## 路径跳转',
    ...(transitions.length
      ? transitions.map((transition) => `- ${transition.from} / ${transition.label || transition.event || '操作'} -> ${transition.to}`)
      : ['- 暂无显式跳转路径']),
    '',
    '## 状态',
    ...(states.length
      ? states.map((state) => `- ${state.pageId || state.screenId || '全局'}：${state.state || state.name || state.type}${state.trigger ? `；触发：${state.trigger}` : ''}${state.display ? `；展示：${state.display}` : ''}`)
      : ['- 暂无显式状态']),
    '',
    '## 接口',
    ...(apiCalls.length
      ? apiCalls.map((api) => `- ${api.pageId || api.screenId || '全局'}：${api.method || 'GET'} ${api.url || api.path || ''}${api.trigger ? `；触发：${api.trigger}` : ''}${api.responseSummary ? `；响应：${api.responseSummary}` : ''}`)
      : ['- 暂无接口摘要'])
  ].join('\n')
}

function normalizeProjectPackageBlueprint(blueprint = null, prototypeDemo = null) {
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) return null
  const projectName = blueprint.project?.name || blueprint.profile?.productName || blueprint.title || '项目交互蓝图'
  const interactionTree = blueprint.interactionTree || normalizeFlowGraphTree(blueprint.flowGraph)
  const demoScreens = asArray(blueprint.demoScreens || blueprint.pages).length
    ? asArray(blueprint.demoScreens || blueprint.pages)
    : demoScreensFromPrototypeDemo(prototypeDemo)
  const normalizedFramework = blueprint.framework || normalizeEntryTreeFramework(blueprint.entryTree, projectName)
  const framework = enrichFrameworkWithPrototypeHotspots(normalizedFramework, prototypeDemo)
  return {
    ...blueprint,
    title: blueprint.title || `${projectName} 交互蓝图`,
    profile: {
      productName: projectName,
      positioning: blueprint.project?.purpose || blueprint.profile?.positioning || '',
      targetUsers: blueprint.profile?.targetUsers || '',
      primaryGoal: blueprint.project?.purpose || blueprint.profile?.primaryGoal || '',
      stage: blueprint.profile?.stage || '项目包导入',
      ...(blueprint.profile || {})
    },
    framework: framework || blueprint.framework,
    interactionTree: interactionTree || blueprint.interactionTree,
    demoScreens,
    reviewChecklist: asArray(blueprint.reviewChecklist).length
      ? blueprint.reviewChecklist
      : asArray(blueprint.knownGaps).map((gap) => gap.description || gap.id)
  }
}

function shouldIgnoreFile(path = '') {
  const normalized = normalizeFilePath(path)
  const parts = normalized.split('/')
  return parts.some((part) => IGNORED_PATH_PARTS.includes(part) || part.startsWith('.env'))
}

function normalizedFiles(payload = {}) {
  return (Array.isArray(payload.files) ? payload.files : [])
    .map((file) => ({
      path: normalizeFilePath(file.path || file.name || ''),
      content: String(file.content || file.text || '')
    }))
    .filter((file) => file.path && !shouldIgnoreFile(file.path))
}

function detectTechStack(files = []) {
  const packageFile = files.find((file) => /(^|\/)package\.json$/.test(file.path))
  const packageJson = packageFile ? safeJsonParse(packageFile.content) : null
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  }
  const names = Object.keys(dependencies)
  const stack = []
  if (names.includes('vue') || files.some((file) => file.path.endsWith('.vue'))) stack.push('Vue 3')
  if (names.includes('react') || files.some((file) => /\.(jsx|tsx)$/.test(file.path) && /from ['"]react['"]/.test(file.content))) stack.push('React')
  if (names.includes('vite') || files.some((file) => /(^|\/)vite\.config\./.test(file.path))) stack.push('Vite')
  if (names.includes('next')) stack.push('Next.js')
  if (names.includes('nuxt')) stack.push('Nuxt')
  if (names.includes('tailwindcss')) stack.push('Tailwind CSS')
  if (names.includes('lucide-vue-next') || names.includes('lucide-react')) stack.push('Lucide Icons')
  return [...new Set(stack)]
}

function fileTitle(path = '') {
  const name = normalizeFilePath(path).split('/').pop() || path
  return name.replace(/\.(vue|jsx|tsx|js|ts|css|md|json)$/i, '')
}

function componentProps(content = '') {
  const props = []
  const definePropsBody = content.match(/defineProps\s*\(\s*\{([\s\S]*?)\}\s*\)/)?.[1] || ''
  definePropsBody.replace(/([A-Za-z_$][\w$-]*)\s*:/g, (_, name) => {
    props.push(name)
    return ''
  })
  return [...new Set(props)]
}

function classifyFiles(files = []) {
  const pages = files.filter((file) => /(^|\/)(pages|views|app|routes)\//.test(file.path) && /\.(vue|jsx|tsx|js|ts)$/.test(file.path))
  const components = files.filter((file) => /(^|\/)components\//.test(file.path) && /\.(vue|jsx|tsx)$/.test(file.path))
  const services = files.filter((file) => /(^|\/)(services|api|apis)\//.test(file.path) && /\.(js|ts)$/.test(file.path))
  const styles = files.filter((file) => /\.(css|scss|less|sass)$/.test(file.path))
  const docs = files.filter((file) => /\.(md|mdx)$/i.test(file.path))
  return { pages, components, services, styles, docs }
}

function tokenLines(styles = []) {
  const tokens = []
  styles.forEach((file) => {
    for (const match of file.content.matchAll(/(--[A-Za-z0-9-_]+)\s*:\s*([^;]+);/g)) {
      tokens.push(`- \`${match[1]}\` = \`${cleanText(match[2])}\`（${file.path}）`)
    }
  })
  return tokens
}

function makeChunks(title = '', content = '', roleScopes = DEFAULT_ROLE_SCOPES) {
  return [{
    id: `${title || 'project-package'}-chunk-1`,
    heading: title || '项目包知识',
    text: content,
    roleScopes
  }]
}

function materialBase(payload = {}, category = '', title = '', content = '', parsed = null) {
  const projectId = payload.projectId || 'project-flow'
  const packageName = normalizeProjectName(payload.fileName)
  return {
    projectId,
    type: 'knowledge',
    title,
    meta: `项目包导入 · ${packageName}`,
    status: '待审核',
    content,
    notes: `来自项目包：${payload.fileName || packageName}`,
    category,
    sourceType: 'project-package',
    sourceUrl: payload.fileName || packageName,
    parsed,
    roleScopes: DEFAULT_ROLE_SCOPES,
    owner: '知识库管理员',
    verification: {
      status: 'unverified',
      reason: '由项目包静态分析自动创建，待人工确认'
    },
    chunks: makeChunks(title, content),
    evidence: [{
      type: 'project-package',
      title: payload.fileName || packageName,
      text: content.slice(0, 240)
    }],
    tags: ['项目包', category]
  }
}

function sourceTreeContent(files = [], groups = {}) {
  const groupForPath = (path = '') => {
    if (groups.pages?.some((file) => file.path === path)) return 'pages'
    if (groups.components?.some((file) => file.path === path)) return 'components'
    if (groups.services?.some((file) => file.path === path)) return 'services'
    if (groups.styles?.some((file) => file.path === path)) return 'styles'
    if (groups.docs?.some((file) => file.path === path)) return 'docs'
    return 'other'
  }
  const rows = files
    .map((file) => ({ path: file.path, group: groupForPath(file.path) }))
    .sort((left, right) => left.path.localeCompare(right.path))
  return [
    `完整文件数：${rows.length}`,
    '',
    ...rows.map((row) => `- [${row.group}] ${row.path}`)
  ].join('\n')
}

function buildMarkdownBlueprint(payload = {}, analysis = {}) {
  const { packageName, techStack, files, groups, tokens } = analysis
  return [
    `# 项目包蓝图：${packageName}`,
    '',
    '## 1. 项目概况',
    `- 来源文件：${payload.fileName || packageName}`,
    `- 文件数量：${files.length}`,
    `- 技术栈：${techStack.length ? techStack.join(' / ') : '待识别'}`,
    '',
    '## 2. 页面结构',
    ...(groups.pages.length ? groups.pages.map((file) => `- ${fileTitle(file.path)}：${file.path}`) : ['- 暂无明确页面文件']),
    '',
    '## 3. 组件库',
    ...(groups.components.length
      ? groups.components.map((file) => {
          const props = componentProps(file.content)
          return `- ${fileTitle(file.path)}：${file.path}${props.length ? `；Props：${props.join(', ')}` : ''}`
        })
      : ['- 暂无明确组件文件']),
    '',
    '## 4. API 与数据',
    ...(groups.services.length ? groups.services.map((file) => `- ${fileTitle(file.path)}：${file.path}`) : ['- 暂无明确 services 文件']),
    '',
    '## 5. 样式 Token',
    ...(tokens.length ? tokens : ['- 暂无 CSS 变量 token']),
    '',
    '## 6. 文档资料',
    ...(groups.docs.length ? groups.docs.map((file) => `- ${fileTitle(file.path)}：${file.path}`) : ['- 暂无 README / docs']),
    '',
    '## 7. 后续建议',
    '- 将组件规格补齐 Props、Slots、Events 和 Figma 映射。',
    '- 对 AI 推断内容保持待审核状态，确认后再作为开发约束使用。'
  ].join('\n')
}

export function buildProjectPackageKnowledgeImport(payload = {}) {
  const files = normalizedFiles(payload)
  const packageName = normalizeProjectName(payload.fileName)
  const groups = classifyFiles(files)
  const techStack = detectTechStack(files)
  const tokens = tokenLines(groups.styles)
  const standardInteractionBlueprint = normalizeInteractionBlueprintArtifact(
    findProjectPackageJson(files, ['interaction-blueprint.json', 'interactionBlueprint.json']),
    files
  )
  const prototypeDemo = normalizePrototypeDemo(findProjectPackageJson(files, ['prototype-demo.json', 'prototypeDemo.json', 'interaction-demo.json']), files) ||
    standardInteractionBlueprint.prototypeDemo
  const blueprint = normalizeProjectPackageBlueprint(findProjectPackageJson(files, ['blueprint.json', 'project-blueprint.json']), prototypeDemo) ||
    standardInteractionBlueprint.blueprint
  const analysis = { packageName, files, groups, techStack, tokens }
  const items = []

  const overviewContent = [
    `项目包：${payload.fileName || packageName}`,
    `识别技术栈：${techStack.length ? techStack.join(' / ') : '待识别'}`,
    `可分析文件：${files.length}`,
    `页面文件：${groups.pages.length}`,
    `组件文件：${groups.components.length}`,
    `接口服务文件：${groups.services.length}`,
    `样式文件：${groups.styles.length}`,
    `文档文件：${groups.docs.length}`
  ].join('\n')
  items.push(materialBase(payload, 'codebase-overview', `${packageName} 项目概况`, overviewContent, {
    packageName,
    techStack,
    fileCount: files.length
  }))

  if (files.length) {
    items.push(materialBase(
      payload,
      'source-tree',
      `${packageName} 完整源码结构索引`,
      sourceTreeContent(files, groups),
      {
        packageName,
        fileCount: files.length,
        files: files.map((file) => file.path)
      }
    ))
  }

  groups.pages.slice(0, 12).forEach((file) => {
    const title = `${fileTitle(file.path)} 页面结构`
    const content = [`文件路径：${file.path}`, `摘要：${cleanText(file.content).slice(0, 500) || '暂无可读文本'}`].join('\n')
    items.push(materialBase(payload, 'page-structure', title, content, { path: file.path }))
  })

  groups.components.slice(0, 20).forEach((file) => {
    const props = componentProps(file.content)
    const title = `${fileTitle(file.path)} 组件规格`
    const content = [
      `文件路径：${file.path}`,
      `Props：${props.length ? props.join(', ') : '待补充'}`,
      `用途推断：${fileTitle(file.path)} 是从项目包中识别出的组件，需人工确认插槽、事件和设计映射。`
    ].join('\n')
    items.push(materialBase(payload, 'component-spec', title, content, { path: file.path, props }))
  })

  if (groups.services.length) {
    const content = groups.services.slice(0, 20).map((file) => `- ${file.path}：${cleanText(file.content).slice(0, 160)}`).join('\n')
    items.push(materialBase(payload, 'api-data', `${packageName} API 与 services`, content, {
      files: groups.services.map((file) => file.path)
    }))
  }

  if (groups.styles.length || tokens.length) {
    const content = [
      '样式文件：',
      ...(groups.styles.length ? groups.styles.map((file) => `- ${file.path}`) : ['- 暂无样式文件']),
      '',
      '识别 Token：',
      ...(tokens.length ? tokens : ['- 暂无 CSS 变量 token'])
    ].join('\n')
    items.push(materialBase(payload, 'style-token', `${packageName} 样式与 Token`, content, { tokens }))
  }

  if (groups.docs.length) {
    const content = groups.docs.slice(0, 8).map((file) => `## ${file.path}\n${file.content.slice(0, 800)}`).join('\n\n')
    items.push(materialBase(payload, 'project-docs', `${packageName} README 与文档`, content, {
      files: groups.docs.map((file) => file.path)
    }))
  }

  const markdown = buildMarkdownBlueprint(payload, analysis)
  items.push(materialBase(payload, 'markdown-blueprint', `${packageName} Markdown 蓝图`, markdown, {
    packageName,
    sections: ['overview', 'pages', 'components', 'api', 'tokens', 'docs']
  }))

  const interactionKnowledge = prototypeDemoKnowledgeContent(prototypeDemo, {
    packageName,
    fileName: payload.fileName || ''
  })
  if (interactionKnowledge) {
    items.push(materialBase(payload, 'interaction-blueprint', `${packageName} 交互蓝图知识`, interactionKnowledge, {
      packageName,
      screenCount: prototypeDemo.screens?.length || 0,
      transitionCount: prototypeDemo.transitions?.length || 0
    }))
  }

  return {
    summary: {
      projectId: payload.projectId || 'project-flow',
      sourceType: 'project-package',
      packageName,
      fileName: payload.fileName || '',
      fileCount: files.length,
      pageCount: groups.pages.length,
      componentCount: groups.components.length,
      serviceCount: groups.services.length,
      styleCount: groups.styles.length,
      docCount: groups.docs.length,
      techStack,
      hasBlueprint: Boolean(blueprint),
      hasPrototypeDemo: Boolean(prototypeDemo)
    },
    items,
    markdown,
    blueprint,
    prototypeDemo
  }
}
