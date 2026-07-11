export const APP_PAGE_ROUTES = {
  requirements: '/projects/:projectId/requirements',
  materials: '/projects/:projectId/knowledge',
  workflow: '/projects/:projectId/design',
  factory: '/projects/:projectId/factory',
  assets: '/projects/:projectId/assets',
  skillCenter: '/projects/:projectId/skills',
  competitorAnalysis: '/projects/:projectId/competitor-analysis',
  settings: '/projects/:projectId/settings'
}

export function routeProjectId(projectId = '') {
  return encodeURIComponent(projectId || 'project-flow')
}

export function projectScopedRoute(route = '', projectId = '') {
  const source = String(route || '')
  const normalized = source.startsWith('/') ? source : `/${source}`
  if (normalized.startsWith('/projects/')) return normalized.replace(':projectId', routeProjectId(projectId))
  return `/projects/${routeProjectId(projectId)}${normalized}`
}

export function parseProjectScopedHash(hash = '') {
  const match = String(hash || '').match(/^#\/projects\/([^/?#]+)(\/[^#]*)?/)
  if (!match) return null
  return {
    projectId: decodeURIComponent(match[1]),
    route: match[2] || '/'
  }
}

export function initialActiveViewFromHash(hash = '') {
  const sourceHash = String(hash || '')
  const projectRoute = parseProjectScopedHash(sourceHash)
  if (projectRoute?.route?.startsWith('/factory') || projectRoute?.route?.startsWith('/assets/')) return 'factory'
  if (projectRoute?.route?.startsWith('/workflow') || projectRoute?.route === '/design') return 'workflow'
  if (projectRoute?.route === '/diagrams') return 'workflow'
  if (projectRoute?.route === '/assets') return 'assets'
  if (projectRoute?.route === '/skills') return 'skillCenter'
  if (projectRoute?.route === '/competitor-analysis') return 'competitorAnalysis'
  if (projectRoute?.route === '/settings') return 'settings'
  if (sourceHash.startsWith('#/factory')) return 'factory'
  if (sourceHash.startsWith('#/workflow') || sourceHash === '#/design') return 'workflow'
  if (sourceHash === '#/diagrams') return 'workflow'
  if (sourceHash === '#/assets') return 'assets'
  if (sourceHash === '#/skills') return 'skillCenter'
  if (sourceHash === '#/competitor-analysis') return 'competitorAnalysis'
  if (sourceHash === '#/settings') return 'settings'
  return 'materials'
}

export function initialMaterialsTabFromHash(hash = '') {
  const sourceHash = String(hash || '')
  const projectRoute = parseProjectScopedHash(sourceHash)
  const route = projectRoute?.route || ''
  if (route === '/knowledge' || sourceHash === '#/knowledge') return 'knowledge'
  return 'requirements'
}
