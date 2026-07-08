export const DEFAULT_PROJECT_ID = 'project-flow'
export const DEFAULT_USER_ID = 'user-local-default'

const PROJECT_SCOPED_KEYS = ['knowledge', 'requirements', 'competitors', 'assets', 'skillRuns', 'factoryTasks']
const SOURCE_TYPES = ['knowledge', 'requirements', 'competitors', 'assets']

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function createProject(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `project-${randomId()}`,
    ownerUserId: input.ownerUserId || DEFAULT_USER_ID,
    name: input.name || '未命名项目',
    description: input.description || '',
    domain: input.domain || '',
    targetUsers: input.targetUsers || '',
    stage: input.stage || 'discovery',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createUser(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `user-${randomId()}`,
    name: input.name || '流程通用户',
    email: input.email || 'local@liuchengtong.test',
    avatar: input.avatar || '流',
    role: input.role || 'owner',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

function defaultUser() {
  return createUser({ id: DEFAULT_USER_ID })
}

function defaultProject() {
  return createProject({
    id: DEFAULT_PROJECT_ID,
    ownerUserId: DEFAULT_USER_ID,
    name: '流程通默认项目',
    description: '本地默认项目，用于承接旧数据和快速试用。',
    stage: 'design'
  })
}

function normalizeUserList(users) {
  const list = asArray(users).map((user) => createUser(user))
  if (!list.length) return [defaultUser()]
  if (!list.some((user) => user.id === DEFAULT_USER_ID)) return [defaultUser(), ...list]
  return list
}

function normalizeProjectList(projects, ownerUserId = DEFAULT_USER_ID) {
  const list = asArray(projects).map((project) => createProject({
    ...project,
    ownerUserId: project.ownerUserId || ownerUserId
  }))
  if (!list.length) return [defaultProject()]
  if (!list.some((project) => project.id === DEFAULT_PROJECT_ID)) return [defaultProject(), ...list]
  return list
}

function withProjectId(item, projectId) {
  return item && typeof item === 'object' && !item.projectId ? { ...item, projectId } : item
}

export function normalizeWorkspaceState(state = {}) {
  const users = normalizeUserList(state.users)
  const userIds = new Set(users.map((user) => user.id))
  const currentUserId = userIds.has(state.currentUserId) ? state.currentUserId : users[0].id
  const projects = normalizeProjectList(state.projects, currentUserId)
  const projectIds = new Set(projects.map((project) => project.id))
  const accountProjects = projects.filter((project) => project.ownerUserId === currentUserId)
  const fallbackProjectId = accountProjects[0]?.id || projects[0].id
  const currentProjectId = projectIds.has(state.currentProjectId) &&
    projects.some((project) => project.id === state.currentProjectId && project.ownerUserId === currentUserId)
    ? state.currentProjectId
    : fallbackProjectId
  const normalized = { ...state, users, currentUserId, projects, currentProjectId }

  PROJECT_SCOPED_KEYS.forEach((key) => {
    normalized[key] = asArray(state[key]).map((item) => withProjectId(item, currentProjectId || DEFAULT_PROJECT_ID))
  })

  if (normalized.activeWorkflowRun && !normalized.activeWorkflowRun.projectId) {
    normalized.activeWorkflowRun = { ...normalized.activeWorkflowRun, projectId: currentProjectId }
  }

  return normalized
}

export function stripEphemeralWorkspaceState(state = {}) {
  return {
    ...state,
    activeWorkflowRun: null,
    captureResult: null,
    generatedPageHtml: '',
    reactFiles: [],
    currentFactoryRoute: 'home',
    selectedRestoredPageId: ''
  }
}

export function scopeItems(items = [], projectId) {
  return asArray(items).filter((item) => item?.projectId === projectId)
}

function firstProjectId(projects = []) {
  return asArray(projects).find((project) => project?.id)?.id || DEFAULT_PROJECT_ID
}

function itemBelongsToProject(items = [], itemId = '', projectId = '') {
  return Boolean(itemId) && asArray(items).some((item) => item?.id === itemId && item.projectId === projectId)
}

function latestProjectRun(runs = [], projectId = '') {
  return asArray(runs)
    .filter((run) => run?.projectId === projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null
}

export function reconcileProjectSelection(state = {}, patch = {}) {
  const next = { ...state, ...patch }
  const projects = asArray(next.projects)
  const projectIds = new Set(projects.map((project) => project?.id).filter(Boolean))
  const currentProjectId = projectIds.has(next.currentProjectId)
    ? next.currentProjectId
    : firstProjectId(projects)

  const activeWorkflowRun = next.activeWorkflowRun?.projectId === currentProjectId
    ? next.activeWorkflowRun
    : latestProjectRun(next.workflowRuns, currentProjectId)

  return {
    ...next,
    currentProjectId,
    selectedAssetId: itemBelongsToProject(next.assets, next.selectedAssetId, currentProjectId)
      ? next.selectedAssetId
      : '',
    selectedRestoredPageId: itemBelongsToProject(next.restoredPages, next.selectedRestoredPageId, currentProjectId)
      ? next.selectedRestoredPageId
      : '',
    activeWorkflowRun
  }
}

export function availableProjectSkills(skills = [], projectId) {
  return asArray(skills).filter((skill) => {
    if (skill.source === 'system') return true
    if ((skill.visibility || 'global') === 'global') return true
    return skill.projectId === projectId
  })
}

function idsForMode(state, config = {}) {
  if (config.mode === 'all-projects') return new Set(asArray(state.projects).map((project) => project.id))
  if (config.mode === 'selected-projects') return new Set(asArray(config.projectIds))
  return new Set([state.currentProjectId])
}

function filterByItemIds(items, itemIds) {
  const ids = new Set(asArray(itemIds))
  if (!ids.size) return items
  return items.filter((item) => ids.has(item.id))
}

export function projectScopedContext(state = {}, config = {}) {
  const sourceTypes = asArray(config.sourceTypes).length ? config.sourceTypes : SOURCE_TYPES
  const projectIds = idsForMode(state, config)
  const result = {
    knowledge: [],
    requirements: [],
    competitors: [],
    assets: []
  }

  SOURCE_TYPES.forEach((key) => {
    if (!sourceTypes.includes(key)) return
    const scoped = asArray(state[key]).filter((item) => projectIds.has(item.projectId))
    result[key] = config.mode === 'selected-items' ? filterByItemIds(scoped, config.itemIds) : scoped
  })

  return result
}
