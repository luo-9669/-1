function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
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

function buildHotspots(screen = {}, screens = []) {
  const actions = asArray(screen.rawActions)
  return actions.map((action, index) => ({
    id: normalizeText(action.id, `${screen.id}-hotspot-${index}`),
    label: normalizeText(action.label || action.title || action.name, `动作 ${index + 1}`),
    event: normalizeText(action.event || action.trigger || 'click'),
    targetScreenId: normalizeActionTarget(action, screens),
    rect: action.rect || action.hotspot || defaultHotspotRect(index),
    feedback: normalizeText(action.feedback || action.message || action.state)
  }))
}

function normalizeBackendScreen(screen = {}, index = 0) {
  return {
    id: normalizeText(screen.id || screen.pageId, `screen-${index}`),
    title: normalizeText(screen.title || screen.pageName || screen.name, `页面 ${index + 1}`),
    summary: normalizeText(screen.summary || screen.description || screen.goal),
    url: normalizeText(screen.url || screen.sourceUrl),
    screenshotUrl: normalizeText(screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl),
    source: screen.source || 'backend-url-capture',
    viewport: screen.viewport || null,
    screenshotAssetId: normalizeText(screen.screenshotAssetId || screen.assetId),
    screenshotStorage: normalizeText(screen.screenshotStorage || screen.storage),
    components: asArray(screen.components),
    hotspots: asArray(screen.hotspots).map((hotspot, hotspotIndex) => ({
      id: normalizeText(hotspot.id, `${screen.id || `screen-${index}`}-hotspot-${hotspotIndex}`),
      label: normalizeText(hotspot.label || hotspot.title || hotspot.name, `热点 ${hotspotIndex + 1}`),
      event: normalizeText(hotspot.event || 'click'),
      targetScreenId: normalizeText(hotspot.targetScreenId || hotspot.to || hotspot.target),
      targetUrl: normalizeText(hotspot.targetUrl || hotspot.href || hotspot.url),
      rect: hotspot.rect || hotspot.hotspot || defaultHotspotRect(hotspotIndex),
      feedback: normalizeText(hotspot.feedback || hotspot.message || hotspot.state)
    }))
  }
}

export function buildPrototypeDemoAsset({ blueprint = {}, prototypeAsset = null, projectId = '', assetId = '' } = {}) {
  const backendDemo = prototypeAsset?.prototypeDemo || (prototypeAsset?.type === 'prototype-demo' ? prototypeAsset : null)
  if (backendDemo) {
    const screens = asArray(backendDemo.screens).map(normalizeBackendScreen)
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
