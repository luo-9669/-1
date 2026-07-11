function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function prototypeDemoScore(asset = {}) {
  const demo = asset.prototypeDemo || (asset.type === 'prototype-demo' ? asset : null)
  if (!demo) return -1
  const screens = asArray(demo.screens)
  const screenshotCount = screens.filter((screen) => normalizeText(
    screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl
  )).length
  const hotspotCount = screens.reduce((total, screen) => total + asArray(screen.hotspots || screen.actions).length, 0)
  const transitionCount = asArray(demo.transitions).length
  const updatedAt = Date.parse(asset.updatedAt || asset.createdAt || demo.capturedAt || '') || 0
  return screenshotCount * 1000000 + transitionCount * 10000 + hotspotCount * 100 + screens.length + updatedAt / 100000000000000
}

function prototypeFlowScore(asset = {}) {
  const demo = asset.prototypeDemo || (asset.type === 'prototype-demo' ? asset : null)
  if (!demo) return -1
  const screens = asArray(demo.screens)
  const transitionCount = asArray(demo.transitions).length
  const hotspotCount = screens.reduce((total, screen) => total + asArray(screen.hotspots || screen.actions).length, 0)
  const screenshotCount = screens.filter((screen) => normalizeText(
    screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl
  )).length
  const updatedAt = Date.parse(asset.updatedAt || asset.createdAt || demo.capturedAt || '') || 0
  return screens.length * 1000000 + transitionCount * 10000 + hotspotCount * 100 + screenshotCount + updatedAt / 100000000000000
}

export function selectBestPrototypeDemoAsset(assets = []) {
  return asArray(assets)
    .filter((asset) => asset?.type === 'prototype-demo' || asset?.prototypeDemo)
    .sort((left, right) => prototypeDemoScore(right) - prototypeDemoScore(left))[0] || null
}

export function selectCompletePrototypeFlowAsset(assets = []) {
  return asArray(assets)
    .filter((asset) => asset?.type === 'prototype-demo' || asset?.prototypeDemo)
    .sort((left, right) => prototypeFlowScore(right) - prototypeFlowScore(left))[0] || null
}

function prototypeKeyVariants(value = '') {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return []
  const normalized = normalizePrototypeRoute(raw).replace(/^https?:\/\/[^/]+/i, '')
  return Array.from(new Set([
    raw,
    normalized,
    raw.replace(/^tool-/, 'tools-'),
    raw.replace(/^tools-/, 'tool-'),
    normalized.replace(/^\/tools\//, 'tools-').replace(/\//g, '-'),
    normalized.replace(/^\/tools\//, 'tool-').replace(/\//g, '-')
  ].filter(Boolean)))
}

function screenshotBackfillKeys(screen = {}) {
  return Array.from(new Set([
    screen.id,
    screen.title,
    screen.route,
    screen.path,
    screen.url,
    screen.sourceUrl,
    normalizePrototypeRoute(screen.route || screen.path || screen.url || screen.sourceUrl || '').replace(/^https?:\/\/[^/]+/i, ''),
    normalizePrototypeRoute(screen.url || screen.sourceUrl || '').replace(/^https?:\/\/[^/]+/i, '')
  ].flatMap(prototypeKeyVariants).filter(Boolean)))
}

export function enrichPrototypeFlowScreenshots(flowDemo = {}, screenshotDemos = []) {
  const screenshotLookup = new Map()
  asArray(screenshotDemos).flatMap((demo) => asArray(demo?.screens)).forEach((screen) => {
    const screenshotUrl = normalizeText(screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl)
    if (!screenshotUrl) return
    screenshotBackfillKeys(screen).forEach((key) => {
      if (!screenshotLookup.has(key)) screenshotLookup.set(key, screen)
    })
  })
  return {
    ...flowDemo,
    screens: asArray(flowDemo.screens).map((screen) => {
      if (normalizeText(screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl)) return screen
      const matchedScreen = screenshotBackfillKeys(screen).map((key) => screenshotLookup.get(key)).find(Boolean)
      if (!matchedScreen) return screen
      return {
        ...screen,
        screenshotUrl: matchedScreen.screenshotUrl || matchedScreen.captureUrl || matchedScreen.imageUrl || matchedScreen.coverUrl || '',
        screenshotAssetId: matchedScreen.screenshotAssetId || matchedScreen.assetId || `${screen.id || matchedScreen.id}-runtime-screenshot`,
        screenshotStorage: 'runtime-screenshot-backfill',
        screenshotSourceScreenId: matchedScreen.id || ''
      }
    })
  }
}

function splitHierarchyText(value = '') {
  return String(value || '')
    .split(/\s*(?:>|›|→|\/|\n)\s*/g)
    .map((part) => normalizeText(part))
    .filter(Boolean)
}

function normalizeHierarchyCandidate(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => Array.isArray(item) ? item : splitHierarchyText(item))
      .map((item) => normalizeText(item))
      .filter(Boolean)
  }
  if (typeof value === 'string') return splitHierarchyText(value)
  return []
}

function projectHierarchyFor(item = {}) {
  const meta = item.meta || {}
  const action = item.action || {}
  const candidates = [
    item.flowHierarchy,
    item.hierarchy,
    item.breadcrumbs,
    item.breadcrumb,
    item.levels,
    item.flowPath,
    item.groupPath,
    item.categoryPath,
    meta.flowHierarchy,
    meta.hierarchy,
    meta.breadcrumbs,
    meta.flowPath,
    action.flowHierarchy,
    action.hierarchy,
    action.breadcrumbs,
    action.flowPath
  ]
  return candidates.map(normalizeHierarchyCandidate).find((parts) => parts.length) || []
}

function neutralRouteHierarchy(screen = {}) {
  const route = routePathForScreen(screen)
  const routeParts = route
    .split('/')
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .slice(0, 4)
  const title = normalizeText(screen.title || screen.pageName || screen.name || screen.id)
  return [...routeParts, title].filter(Boolean)
}

function uniqueFlowScreenIds(ids = []) {
  const seen = new Set()
  return ids.filter((id) => {
    const normalizedId = normalizeText(id)
    if (!normalizedId || seen.has(normalizedId)) return false
    seen.add(normalizedId)
    return true
  })
}

function mergeGeneratedFlows(flows = []) {
  const byHierarchy = new Map()
  asArray(flows).forEach((flow) => {
    const key = asArray(flow.hierarchy).join(' / ') || flow.id
    if (!byHierarchy.has(key)) {
      byHierarchy.set(key, {
        ...flow,
        screenIds: [...flow.screenIds],
        steps: [...flow.steps]
      })
      return
    }
    const existing = byHierarchy.get(key)
    existing.screenIds = uniqueFlowScreenIds([...existing.screenIds, ...flow.screenIds])
    existing.steps = [...existing.steps, ...flow.steps]
  })
  return Array.from(byHierarchy.values()).map((flow, index) => ({
    ...flow,
    id: flow.id || `generated-flow-${index + 1}`
  }))
}

function findHotspotForTransition(fromScreen = {}, transition = {}) {
  const target = normalizeText(transition.to || transition.targetScreenId || transition.target)
  const label = normalizeText(transition.label || transition.title || transition.name)
  return asArray(fromScreen.hotspots || fromScreen.actions).find((hotspot) =>
    normalizeText(hotspot.id) === normalizeText(transition.hotspotId) ||
    normalizeText(hotspot.label || hotspot.title || hotspot.name) === label ||
    normalizeText(hotspot.targetScreenId || hotspot.to || hotspot.target || hotspot.targetPageId) === target
  ) || null
}

function flowHierarchyForStep(fromScreen = {}, toScreen = {}, action = {}, transition = {}) {
  const projectHierarchy = [
    projectHierarchyFor(action),
    projectHierarchyFor(transition),
    projectHierarchyFor(fromScreen),
    projectHierarchyFor(toScreen)
  ].find((parts) => parts.length)
  if (projectHierarchy?.length) return projectHierarchy.slice(0, 5)
  const actionLabel = normalizeText(action.label || action.title || action.name || transition.label || transition.title || transition.name)
  const base = neutralRouteHierarchy(fromScreen)
  return [...base, actionLabel].filter(Boolean).slice(0, 5)
}

function flowStepFromTransition(transition = {}, screenById = new Map(), index = 0) {
  const fromScreen = screenById.get(transition.from) || {}
  const toScreen = screenById.get(transition.to) || {}
  const hotspot = findHotspotForTransition(fromScreen, transition) || {}
  const actionLabel = normalizeText(
    transition.label ||
    transition.title ||
    transition.name ||
    hotspot.label ||
    hotspot.title ||
    hotspot.name,
    `动作 ${index + 1}`
  )
  const screenIds = uniqueFlowScreenIds([fromScreen.id || transition.from, toScreen.id || transition.to])
  return {
    id: normalizeText(transition.id, `transition-flow-${index + 1}`),
    title: flowHierarchyForStep(fromScreen, toScreen, hotspot, transition).at(-1) || actionLabel,
    hierarchy: flowHierarchyForStep(fromScreen, toScreen, hotspot, transition),
    screenIds,
    steps: [{
      id: normalizeText(transition.id, `transition-step-${index + 1}`),
      from: fromScreen.id || transition.from || '',
      to: toScreen.id || transition.to || '',
      fromTitle: fromScreen.title || transition.from || '',
      toTitle: toScreen.title || transition.to || '',
      actionLabel
    }],
    source: flowHierarchyForStep(fromScreen, toScreen, hotspot, transition).length ? 'project-or-route' : 'transition'
  }
}

function flowStepFromHotspot(screen = {}, hotspot = {}, index = 0) {
  const hierarchy = flowHierarchyForStep(screen, {}, hotspot, {})
  const targetId = normalizeText(hotspot.targetScreenId || hotspot.targetPageId || hotspot.to || hotspot.target)
  return {
    id: normalizeText(hotspot.id, `${screen.id || 'screen'}-hotspot-flow-${index + 1}`),
    title: hierarchy.at(-1) || normalizeText(hotspot.label || hotspot.title || hotspot.name, `动作 ${index + 1}`),
    hierarchy,
    screenIds: uniqueFlowScreenIds([screen.id, targetId]),
    steps: [{
      id: normalizeText(hotspot.id, `${screen.id || 'screen'}-hotspot-step-${index + 1}`),
      from: screen.id || '',
      to: targetId,
      fromTitle: screen.title || screen.id || '',
      toTitle: targetId,
      actionLabel: normalizeText(hotspot.label || hotspot.title || hotspot.name, `动作 ${index + 1}`)
    }],
    source: 'hotspot'
  }
}

function screenFlow(screen = {}, index = 0) {
  const hierarchy = (projectHierarchyFor(screen).length ? projectHierarchyFor(screen) : neutralRouteHierarchy(screen)).slice(0, 5)
  return {
    id: normalizeText(screen.id, `screen-flow-${index + 1}`),
    title: hierarchy.at(-1) || normalizeText(screen.title || screen.name, `页面 ${index + 1}`),
    hierarchy,
    screenIds: uniqueFlowScreenIds([screen.id]),
    steps: [],
    source: projectHierarchyFor(screen).length ? 'project-hierarchy' : 'route'
  }
}

function addFlowToTree(roots = [], flow = {}) {
  let siblings = roots
  const pathIds = []
  asArray(flow.hierarchy).forEach((title, depth) => {
    pathIds.push(String(title).toLowerCase())
    const id = `flow-level-${pathIds.join('__').replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-')}`
    let node = siblings.find((item) => item.id === id)
    if (!node) {
      node = {
        id,
        title,
        depth: depth + 1,
        flowIds: [],
        screenIds: [],
        children: []
      }
      siblings.push(node)
    }
    if (!node.flowIds.includes(flow.id)) node.flowIds.push(flow.id)
    node.screenIds = uniqueFlowScreenIds([...node.screenIds, ...flow.screenIds])
    siblings = node.children
  })
}

function normalizeFlow(flow = {}, index = 0, screenById = new Map()) {
  const screenIds = uniqueFlowScreenIds(asArray(flow.screenIds || flow.screens).map((item) => typeof item === 'string' ? item : item.id))
  const fallbackScreen = screenIds.map((id) => screenById.get(id)).find(Boolean) || {}
  const hierarchy = (projectHierarchyFor(flow).length
    ? projectHierarchyFor(flow)
    : [...neutralRouteHierarchy(fallbackScreen), normalizeText(flow.title || flow.name)]
  ).filter(Boolean).slice(0, 5)
  return {
    id: normalizeText(flow.id, `project-flow-${index + 1}`),
    title: normalizeText(flow.title || flow.name || hierarchy.at(-1), `流程 ${index + 1}`),
    hierarchy,
    screenIds,
    steps: asArray(flow.steps),
    source: 'project-flow'
  }
}

export function buildPrototypeFlowTree(demo = {}) {
  const screens = asArray(demo.screens)
  const screenById = new Map(screens.map((screen, index) => [normalizeText(screen.id, `screen-${index}`), screen]))
  const projectFlows = asArray(demo.flows || demo.flowGroups || demo.groups).map((flow, index) => normalizeFlow(flow, index, screenById))
  const transitionFlows = asArray(demo.transitions).map((transition, index) => flowStepFromTransition(transition, screenById, index))
  const hotspotFlows = screens.flatMap((screen) =>
    asArray(screen.hotspots || screen.actions).map((hotspot, index) => flowStepFromHotspot(screen, hotspot, index))
  )
  const screenFlows = screens.map(screenFlow)
  const flows = (projectFlows.length
    ? projectFlows
    : transitionFlows.length
      ? mergeGeneratedFlows(transitionFlows)
      : hotspotFlows.length
        ? mergeGeneratedFlows(hotspotFlows)
        : screenFlows)
    .filter((flow) => asArray(flow.hierarchy).length)
  const roots = []
  flows.forEach((flow) => addFlowToTree(roots, flow))
  return {
    roots,
    flows,
    selectedFlow: flows[0] || null
  }
}

function hotspotMergeKey(hotspot = {}) {
  const rect = hotspot.rect || hotspot.hotspot || {}
  return [
    hotspot.id,
    hotspot.label,
    hotspot.targetScreenId || hotspot.to || hotspot.target || hotspot.targetUrl || hotspot.href || hotspot.url,
    Number(rect.x).toFixed(2),
    Number(rect.y).toFixed(2),
    Number(rect.width).toFixed(2),
    Number(rect.height).toFixed(2)
  ].map((part) => String(part || '').trim().toLowerCase()).join('|')
}

function screenLookupByKeys(screens = []) {
  const lookup = new Map()
  asArray(screens).forEach((screen) => {
    screenshotBackfillKeys(screen).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, screen)
    })
  })
  return lookup
}

function routePathForScreen(screen = {}) {
  return normalizePrototypeRoute(screen.route || screen.path || screen.url || screen.sourceUrl || '')
    .replace(/^https?:\/\/[^/]+/i, '')
}

const TOOL_NAVIGATION_ORDER = [
  /ai-video-podcast-generator|ai-podcast-generator/i,
  /podcast-script-generator/i,
  /audio-to-script/i,
  /true-crime-podcast-generator/i,
  /ai-podcast-voice-generator/i,
  /ai-study-podcast/i,
  /language-learning-podcasts/i,
  /text-to-speech/i,
  /text-to-podcast/i,
  /blog-to-podcast/i,
  /url-to-podcast/i,
  /pdf-to-podcast/i
]

function toolNavigationOrder(screen = {}) {
  const text = `${screen.id || ''} ${screen.title || ''} ${screen.route || ''} ${screen.path || ''} ${screen.url || ''}`
  const index = TOOL_NAVIGATION_ORDER.findIndex((pattern) => pattern.test(text))
  return index >= 0 ? index : TOOL_NAVIGATION_ORDER.length
}

function collectToolNavigationScreens(screens = []) {
  const byPath = new Map()
  asArray(screens).forEach((screen) => {
    const path = routePathForScreen(screen)
    if (!/^\/tools\//.test(path)) return
    const key = path.replace(/\/+$/g, '')
    if (!byPath.has(key)) byPath.set(key, screen)
  })
  return Array.from(byPath.values())
    .sort((left, right) => toolNavigationOrder(left) - toolNavigationOrder(right) || String(left.title || '').localeCompare(String(right.title || '')))
}

function supplementToolNavigationHotspots(screen = {}, existingHotspots = [], allScreens = [], playbackLookup = new Map()) {
  const currentPath = routePathForScreen(screen)
  if (!/^\/tools\//.test(currentPath)) return existingHotspots
  const existingKeys = new Set(existingHotspots.flatMap((hotspot) => [
    String(hotspot.label || '').trim().toLowerCase(),
    ...prototypeKeyVariants(hotspot.targetScreenId || hotspot.targetUrl || hotspot.route || '')
  ].filter(Boolean)))
  const navScreens = collectToolNavigationScreens(allScreens)
  const generated = navScreens
    .filter((targetScreen) => routePathForScreen(targetScreen) !== currentPath)
    .map((targetScreen, index) => {
      const targetPath = routePathForScreen(targetScreen)
      const label = normalizeText(targetScreen.title || targetScreen.name, `工具 ${index + 1}`)
      const targetScreenId = screenshotBackfillKeys(targetScreen).map((key) => playbackLookup.get(key)?.id).find(Boolean) || ''
      return {
        id: `${screen.id || 'screen'}-tool-sidebar-${targetScreen.id || index + 1}`,
        label,
        event: 'click',
        targetScreenId,
        targetUrl: targetScreen.url || targetScreen.route || targetPath,
        rect: {
          x: 6.2,
          y: 9.5 + index * 8.45,
          width: 14.4,
          height: 7.8
        },
        feedback: `侧边导航切换到 ${label}`,
        type: 'click',
        source: 'complete-flow-sidebar-navigation'
      }
    })
    .filter((hotspot) => {
      const keys = [
        String(hotspot.label || '').trim().toLowerCase(),
        ...prototypeKeyVariants(hotspot.targetScreenId || hotspot.targetUrl || '')
      ]
      if (keys.some((key) => existingKeys.has(key))) return false
      keys.forEach((key) => existingKeys.add(key))
      return true
    })
  return [...existingHotspots, ...generated]
}

function resolveMergedHotspotTarget(hotspot = {}, playbackLookup = new Map()) {
  const action = hotspot.action || {}
  const targetKeys = [
    hotspot.targetScreenId,
    hotspot.targetPageId,
    hotspot.to,
    hotspot.target,
    hotspot.screenId,
    hotspot.targetUrl,
    hotspot.href,
    hotspot.url,
    hotspot.route,
    action.targetScreenId,
    action.targetPageId,
    action.to,
    action.target,
    action.targetUrl,
    action.href,
    action.url,
    action.route
  ].flatMap(prototypeKeyVariants)
  return targetKeys.map((key) => playbackLookup.get(key)?.id).find(Boolean)
    || hotspot.targetScreenId
    || hotspot.to
    || hotspot.target
    || hotspot.targetUrl
    || ''
}

export function enrichPrototypeDemoHotspots(playbackDemo = {}, flowDemos = []) {
  const playbackScreens = asArray(playbackDemo.screens)
  const playbackLookup = screenLookupByKeys(playbackScreens)
  const sourceScreens = asArray(flowDemos).flatMap((demo) => asArray(demo?.screens))
  const navigationScreens = [...sourceScreens, ...playbackScreens]
  const sourceLookup = screenLookupByKeys(sourceScreens)
  return {
    ...playbackDemo,
    screens: playbackScreens.map((screen) => {
      const sourceScreen = screenshotBackfillKeys(screen).map((key) => sourceLookup.get(key)).find(Boolean)
      if (!sourceScreen) return screen
      const mergedKeys = new Set()
      const existingHotspots = asArray(screen.hotspots).map((hotspot) => {
        mergedKeys.add(hotspotMergeKey(hotspot))
        return hotspot
      })
      const mergedHotspots = asArray(sourceScreen.hotspots || sourceScreen.actions)
        .map((hotspot, index) => ({
          ...hotspot,
          id: hotspot.id || `${screen.id || sourceScreen.id}-flow-hotspot-${index + 1}`,
          rect: hotspot.rect || hotspot.hotspot || defaultHotspotRect(index),
          targetScreenId: resolveMergedHotspotTarget(hotspot, playbackLookup),
          source: hotspot.source || 'complete-flow-hotspot'
        }))
        .filter((hotspot) => {
          const key = hotspotMergeKey(hotspot)
          if (mergedKeys.has(key)) return false
          mergedKeys.add(key)
          return true
        })
      return {
        ...screen,
        hotspots: supplementToolNavigationHotspots(screen, [...existingHotspots, ...mergedHotspots], navigationScreens, playbackLookup)
      }
    }).map((screen) => ({
      ...screen,
      hotspots: supplementToolNavigationHotspots(screen, asArray(screen.hotspots), navigationScreens, playbackLookup)
    }))
  }
}

function normalizeText(value = '', fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function normalizeActionTarget(action = {}, screens = []) {
  const raw = normalizeText(action.to || action.target || action.targetScreenId || action.screenId)
  if (!raw) return ''
  const direct = screens.find((screen) => screen.id === raw || screen.title === raw)
  if (direct) return direct.id
  const loose = screens.find((screen) =>
    String(screen.id || '').toLowerCase().includes(raw.toLowerCase()) ||
    String(screen.title || '').toLowerCase().includes(raw.toLowerCase())
  )
  return loose?.id || raw
}

function defaultHotspotRect(index = 0) {
  return {
    x: 8,
    y: Math.min(82, 18 + index * 12),
    width: 84,
    height: 10
  }
}

function buildScreen(screen = {}, index = 0) {
  const components = asArray(screen.wireframe?.components || screen.components)
  const actions = asArray(screen.actions)
  return {
    id: normalizeText(screen.id || screen.pageId, `screen-${index}`),
    title: normalizeText(screen.title || screen.pageName || screen.name, `页面 ${index + 1}`),
    summary: normalizeText(screen.description || screen.goal || screen.wireframe?.layout),
    screenshotUrl: normalizeText(screen.screenshotUrl || screen.coverUrl || screen.previewUrl || screen.imageUrl),
    source: screen.source || screen.sourceType || 'blueprint',
    components: components.map((component, componentIndex) => ({
      id: normalizeText(component.id, `component-${componentIndex}`),
      type: normalizeText(component.type, 'component'),
      label: normalizeText(component.label || component.name || component.title, `组件 ${componentIndex + 1}`),
      behavior: normalizeText(component.behavior || component.detail)
    })),
    rawActions: actions
  }
}

function normalizeActionMetadata(hotspot = {}) {
  const action = hotspot.action || {}
  return {
    type: normalizeText(action.type || hotspot.type || hotspot.event || 'click'),
    guard: normalizeText(action.guard || hotspot.guard || hotspot.feedback),
    field: normalizeText(action.field || hotspot.field),
    value: normalizeText(action.value || hotspot.value),
    name: normalizeText(action.name || hotspot.name),
    route: normalizeText(action.route || hotspot.targetUrl || hotspot.href || hotspot.url)
  }
}

function actionTargetLabel(hotspot = {}) {
  const meta = normalizeActionMetadata(hotspot)
  return normalizeText(
    hotspot.targetScreenId ||
    hotspot.to ||
    hotspot.target ||
    meta.route ||
    meta.name ||
    meta.field ||
    meta.value
  )
}

function formatRectNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0
}

function describeHotspot(hotspot = {}) {
  const meta = normalizeActionMetadata(hotspot)
  const rect = hotspot.rect || hotspot.hotspot || defaultHotspotRect()
  return [
    meta.type ? `类型：${meta.type}` : '',
    actionTargetLabel(hotspot) ? `目标：${actionTargetLabel(hotspot)}` : '',
    meta.guard ? `守卫：${meta.guard}` : '',
    `坐标：x=${formatRectNumber(rect.x)}%, y=${formatRectNumber(rect.y)}%, w=${formatRectNumber(rect.width)}%, h=${formatRectNumber(rect.height)}%`
  ].filter(Boolean).join('；')
}

function buildHotspots(screen = {}, screens = []) {
  const actions = asArray(screen.rawActions)
  return actions.map((action, index) => ({
    id: normalizeText(action.id, `${screen.id}-hotspot-${index}`),
    label: normalizeText(action.label || action.title || action.name, `动作 ${index + 1}`),
    event: normalizeText(action.event || action.trigger || 'click'),
    targetScreenId: normalizeActionTarget(action, screens),
    rect: action.rect || action.hotspot || defaultHotspotRect(index),
    feedback: normalizeText(action.feedback || action.message || action.state),
    ...normalizeActionMetadata(action),
    detail: describeHotspot(action)
  }))
}

function normalizeScreenKey(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizePrototypeRoute(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw, 'https://prototype.local')
    parsed.hash = ''
    parsed.search = ''
    const pathname = parsed.pathname.replace(/\/+$/g, '') || '/'
    return raw.startsWith('http') ? `${parsed.origin}${pathname}` : pathname
  } catch {
    return raw.replace(/[?#].*$/g, '').replace(/\/+$/g, '') || raw
  }
}

function screenRouteKeys(screen = {}) {
  return [
    screen.id,
    screen.route,
    screen.path,
    screen.url,
    screen.sourceUrl,
    screen.targetUrl
  ].map(normalizePrototypeRoute).filter(Boolean)
}

function hotspotRouteKeys(hotspot = {}) {
  const action = hotspot.action || {}
  return [
    hotspot.targetUrl,
    hotspot.href,
    hotspot.url,
    hotspot.route,
    action.route,
    action.targetUrl,
    action.href,
    action.url
  ].map(normalizePrototypeRoute).filter(Boolean)
}

export function resolvePrototypeHotspotTarget(asset = {}, hotspot = {}, currentScreenId = '') {
  const screens = asArray(asset.screens)
  const directTarget = normalizeText(
    hotspot.targetScreenId ||
    hotspot.targetPageId ||
    hotspot.to ||
    hotspot.target ||
    hotspot.screenId ||
    hotspot.action?.targetScreenId ||
    hotspot.action?.targetPageId ||
    hotspot.action?.target ||
    hotspot.action?.to
  )
  if (directTarget) {
    const direct = screens.find((screen) =>
      screen.id === directTarget ||
      screen.title === directTarget ||
      screen.route === directTarget ||
      screen.url === directTarget
    )
    if (direct) return direct.id
  }
  const routeKeys = hotspotRouteKeys(hotspot)
  if (routeKeys.length) {
    const byRoute = screens.find((screen) => {
      const keys = screenRouteKeys(screen)
      return routeKeys.some((targetKey) =>
        keys.includes(targetKey) ||
        keys.some((key) => key.endsWith(targetKey) || targetKey.endsWith(key))
      )
    })
    if (byRoute) return byRoute.id
  }
  const transition = asArray(asset.transitions).find((item) =>
    (!currentScreenId || item.from === currentScreenId) &&
    (
      item.hotspotId === hotspot.id ||
      item.label === hotspot.label ||
      item.targetUrl === hotspot.targetUrl ||
      item.event === hotspot.event
    )
  )
  return transition?.to || directTarget || ''
}

function buildBlueprintScreenLookup(blueprint = {}) {
  const lookup = new Map()
  asArray(blueprint.demoScreens || blueprint.pages).forEach((screen) => {
    const built = buildScreen(screen)
    const keys = [built.id, built.title]
    keys.forEach((key) => {
      const normalizedKey = normalizeScreenKey(key)
      if (normalizedKey && !lookup.has(normalizedKey)) {
        lookup.set(normalizedKey, built)
      }
    })
  })
  return lookup
}

function findBlueprintScreen(screen = {}, blueprintScreenLookup = new Map()) {
  const keys = [
    screen.id,
    screen.pageId,
    screen.title,
    screen.pageName,
    screen.name
  ].map(normalizeScreenKey).filter(Boolean)
  return keys.map((key) => blueprintScreenLookup.get(key)).find(Boolean) || null
}

function normalizeBackendScreen(screen = {}, index = 0, blueprintScreenLookup = new Map()) {
  const blueprintScreen = findBlueprintScreen(screen, blueprintScreenLookup)
  return {
    id: normalizeText(screen.id || screen.pageId, `screen-${index}`),
    title: normalizeText(screen.title || screen.pageName || screen.name, `页面 ${index + 1}`),
    summary: normalizeText(screen.summary || screen.description || screen.goal),
    route: normalizeText(screen.route || screen.path),
    url: normalizeText(screen.url || screen.sourceUrl || screen.route || screen.path),
    screenshotUrl: normalizeText(
      screen.screenshotUrl ||
      screen.captureUrl ||
      screen.imageUrl ||
      screen.coverUrl ||
      blueprintScreen?.screenshotUrl ||
      blueprintScreen?.captureUrl ||
      blueprintScreen?.imageUrl ||
      blueprintScreen?.coverUrl
    ),
    source: screen.source || 'backend-url-capture',
    viewport: screen.viewport || null,
    screenshotAssetId: normalizeText(screen.screenshotAssetId || screen.assetId),
    screenshotStorage: normalizeText(screen.screenshotStorage || screen.storage),
    components: asArray(screen.components),
    hotspots: asArray(screen.hotspots).map((hotspot, hotspotIndex) => ({
      id: normalizeText(hotspot.id, `${screen.id || `screen-${index}`}-hotspot-${hotspotIndex}`),
      label: normalizeText(hotspot.label || hotspot.title || hotspot.name, `热点 ${hotspotIndex + 1}`),
      event: normalizeText(hotspot.event || 'click'),
      targetScreenId: normalizeText(hotspot.targetScreenId || hotspot.targetPageId || hotspot.to || hotspot.target || hotspot.action?.targetScreenId || hotspot.action?.targetPageId),
      targetUrl: normalizeText(hotspot.targetUrl || hotspot.href || hotspot.url),
      rect: hotspot.rect || hotspot.hotspot || defaultHotspotRect(hotspotIndex),
      feedback: normalizeText(hotspot.feedback || hotspot.message || hotspot.state),
      ...normalizeActionMetadata(hotspot),
      detail: describeHotspot(hotspot)
    }))
  }
}

function findScreenForNode(node = {}, screens = []) {
  return screens.find((screen) =>
    (screen.id && node.id && screen.id === node.id) ||
    (screen.route && node.route && screen.route === node.route) ||
    (screen.title && node.title && screen.title === node.title) ||
    (screen.title && node.name && screen.title === node.name)
  ) || null
}

function hotspotTreeNode(hotspot = {}) {
  return {
    id: hotspot.id,
    title: hotspot.label || hotspot.title || hotspot.name || '点击热区',
    meta: hotspot.detail || describeHotspot(hotspot),
    action: hotspot.name || hotspot.type || hotspot.event || '',
    route: hotspot.targetUrl || hotspot.route || '',
    guard: hotspot.guard || '',
    rect: hotspot.rect || defaultHotspotRect(),
    children: []
  }
}

function enrichFrameworkTreeWithScreens(node = null, screens = [], claimedScreenIds = new Set()) {
  if (!node) return node
  const screen = findScreenForNode(node, screens)
  const nextClaimedScreenIds = new Set(claimedScreenIds)
  if (screen?.id) nextClaimedScreenIds.add(screen.id)
  const children = asArray(node.children).map((child) => enrichFrameworkTreeWithScreens(child, screens, nextClaimedScreenIds))
  if (screen?.id && claimedScreenIds.has(screen.id)) return { ...node, children }
  const hotspots = asArray(screen?.hotspots)
  if (!hotspots.length) return { ...node, children }
  const existingIds = new Set(children.map((child) => child.id))
  const hotspotChildren = hotspots
    .filter((hotspot) => hotspot.id && !existingIds.has(hotspot.id))
    .map(hotspotTreeNode)
  if (!hotspotChildren.length) return { ...node, children }
  const clickDetailsGroup = {
    id: `${node.id || screen.id}-click-details`,
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

function mergeDemoScreensWithPrototypeScreens(blueprintScreens = [], prototypeScreens = []) {
  const screensById = new Map(prototypeScreens.map((screen) => [screen.id, screen]).filter(([id]) => id))
  const used = new Set()
  const mergeActions = (actions = [], prototypeHotspots = []) => {
    const prototypeById = new Map(asArray(prototypeHotspots).map((hotspot) => [hotspot.id, hotspot]).filter(([id]) => id))
    const prototypeByLabel = new Map(asArray(prototypeHotspots).map((hotspot) => [hotspot.label, hotspot]).filter(([label]) => label))
    if (!asArray(actions).length) return asArray(prototypeHotspots)
    return asArray(actions).map((action) => {
      const prototypeAction = prototypeById.get(action.id) || prototypeByLabel.get(action.label)
      if (!prototypeAction) return action
      return {
        ...prototypeAction,
        ...action,
        rect: prototypeAction.rect || action.rect || action.hotspot,
        targetScreenId: action.targetScreenId || action.to || action.target || prototypeAction.targetScreenId,
        targetUrl: action.targetUrl || prototypeAction.targetUrl,
        type: action.type || prototypeAction.type,
        event: action.event || prototypeAction.event,
        guard: action.guard || prototypeAction.guard,
        field: action.field || prototypeAction.field,
        value: action.value || prototypeAction.value,
        name: action.name || prototypeAction.name,
        detail: action.detail || prototypeAction.detail
      }
    })
  }
  const merged = asArray(blueprintScreens).map((screen) => {
    const prototypeScreen = screensById.get(screen.id) || prototypeScreens.find((item) => item.title === screen.title || item.route === screen.route)
    if (prototypeScreen?.id) used.add(prototypeScreen.id)
    return {
      ...screen,
      screenshotUrl: screen.screenshotUrl || prototypeScreen?.screenshotUrl || '',
      actions: mergeActions(screen.actions || screen.hotspots, prototypeScreen?.hotspots)
    }
  })
  const appended = prototypeScreens
    .filter((screen) => !used.has(screen.id))
    .map((screen) => ({
      ...screen,
      description: screen.summary || screen.description || '',
      actions: asArray(screen.hotspots)
    }))
  return [...merged, ...appended]
}

export function enrichBlueprintWithPrototypeDemo(blueprint = {}, prototypeAsset = null) {
  const backendDemo = prototypeAsset?.prototypeDemo || (prototypeAsset?.type === 'prototype-demo' ? prototypeAsset : null)
  if (!backendDemo) return blueprint || {}
  const prototypeScreens = asArray(backendDemo.screens).map((screen, index) => normalizeBackendScreen(screen, index))
  if (!prototypeScreens.length) return blueprint || {}
  return {
    ...(blueprint || {}),
    framework: enrichFrameworkTreeWithScreens(blueprint?.framework, prototypeScreens),
    demoScreens: mergeDemoScreensWithPrototypeScreens(blueprint?.demoScreens || blueprint?.pages, prototypeScreens)
  }
}

export function buildPrototypeDemoAsset({ blueprint = {}, prototypeAsset = null, projectId = '', assetId = '' } = {}) {
  const backendDemo = prototypeAsset?.prototypeDemo || (prototypeAsset?.type === 'prototype-demo' ? prototypeAsset : null)
  if (backendDemo) {
    const blueprintScreenLookup = buildBlueprintScreenLookup(blueprint)
    const screens = asArray(backendDemo.screens).map((screen, index) =>
      normalizeBackendScreen(screen, index, blueprintScreenLookup)
    )
    const transitions = asArray(backendDemo.transitions).length
      ? asArray(backendDemo.transitions)
      : screens.flatMap((screen) => asArray(screen.hotspots)
        .filter((hotspot) => hotspot.targetScreenId)
        .map((hotspot) => ({
          id: `${screen.id}-${hotspot.id}-${hotspot.targetScreenId}`,
          from: screen.id,
          to: hotspot.targetScreenId,
          label: hotspot.label,
          event: hotspot.event
        })))
    return {
      id: prototypeAsset?.id || assetId || `${projectId || 'project'}-prototype-demo`,
      type: 'prototype-demo',
      projectId: projectId || prototypeAsset?.projectId || '',
      title: prototypeAsset?.title || backendDemo.title || '交互 Demo',
      source: backendDemo.source || prototypeAsset?.source || 'backend-url-capture',
      screens,
      screenshotAssets: asArray(backendDemo.screenshotAssets || prototypeAsset?.screenshotAssets),
      transitions,
      storagePlan: {
        owner: 'backend',
        screenshotSource: 'url-browser-capture',
        frontendRole: 'prototype-playback',
        codeImportRole: 'optional-enrichment'
      }
    }
  }
  const screens = asArray(blueprint.demoScreens || blueprint.pages).map(buildScreen)
  const screensWithHotspots = screens.map((screen) => ({
    ...screen,
    hotspots: buildHotspots(screen, screens)
  }))
  const transitions = screensWithHotspots.flatMap((screen) =>
    asArray(screen.hotspots)
      .filter((hotspot) => hotspot.targetScreenId)
      .map((hotspot) => ({
        id: `${screen.id}-${hotspot.id}-${hotspot.targetScreenId}`,
        from: screen.id,
        to: hotspot.targetScreenId,
        label: hotspot.label,
        event: hotspot.event
      }))
  )
  return {
    id: assetId || blueprint.prototypeAssetId || `${projectId || 'project'}-prototype-demo`,
    type: 'prototype-demo',
    projectId: projectId || blueprint.projectId || '',
    title: `${blueprint.profile?.productName || blueprint.title || '项目'} 交互 Demo`,
    source: 'blueprint',
    screens: screensWithHotspots,
    transitions,
    storagePlan: {
      owner: 'backend',
      screenshotSource: 'url-browser-capture',
      frontendRole: 'prototype-playback',
      codeImportRole: 'optional-enrichment'
    }
  }
}

export function selectPrototypeDemoScreen(asset = {}, screenId = '') {
  const screens = asArray(asset.screens)
  return screens.find((screen) => screen.id === screenId) || screens[0] || null
}
