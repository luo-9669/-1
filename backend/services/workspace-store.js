/**
 * Workspace Store - 双模式存储
 * 
 * 【Coze 端改动说明】
 * 本文件支持两种存储模式：
 * 1. 数据库模式：当 COZE_SUPABASE_URL 环境变量存在时，优先从 Supabase 数据库加载
 * 2. 本地 JSON 模式：数据库不可用时，回退到本地 JSON 文件（workspace.local.json）
 * 
 * 数据库表：workspace_state (id TEXT PK, data JSONB, updated_at TIMESTAMPTZ)
 * 数据库操作封装：backend/services/database-store.mjs
 * 
 * 持久化逻辑：
 * - load(): 先尝试数据库 → 失败则读本地 JSON → 都没有则用空 workspace
 * - persistStore(): 先写本地 JSON（缓存）→ 再尝试写数据库（持久化）
 * 
 * 【注意】不要修改此文件的双模式逻辑，如需新增存储路径请使用 server-config.mjs 中的 storageRoot
 */
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  createDefaultWorkspaceStore,
  createWorkspaceAsset,
  createWorkspaceCompetitor,
  createWorkspaceMonitorTask,
  createWorkspacePageSnapshot,
  createWorkspaceChangeRecord,
  createWorkspaceAiAnalysis,
  createWorkspaceCompetitorInsight,
  createWorkspaceCompetitorReport,
  createWorkspaceCompetitorAuditLog,
  createWorkspaceMaterial,
  createWorkspaceBackendKnowledge,
  createWorkspaceGeneratedKnowledge,
  createWorkspaceParseJob,
  createWorkspaceProject,
  createWorkspaceRestoredPage,
  createWorkspaceRun,
  createWorkspaceSetting,
  createWorkspaceSkill,
  createWorkspaceUser,
  createWorkspaceWorkflowRun,
  publicWorkspaceUser
} from '../models/workspace.js'
import { listSkillDefinitions } from './skill-registry.js'
import { isDatabaseAvailable, loadWorkspace as loadWorkspaceFromDatabase, saveWorkspace as saveWorkspaceToDatabase } from './database-store.mjs'

const DEFAULT_BACKEND_KNOWLEDGE = [
  createWorkspaceBackendKnowledge({
    id: 'backend-auth-page-generation-route',
    title: '登录注册页面生成路由备份知识',
    category: 'route-fallback',
    content: 'auth-page-generation 是后端内部页面生成能力 ID，只用于登录注册页面生成意图的兜底路由，不应作为用户项目知识优先召回。',
    roleScopes: ['ai-retrieval', 'product', 'ux', 'development']
  }),
  createWorkspaceBackendKnowledge({
    id: 'backend-skill-routing-fallback',
    title: 'Skill 编排路由备份知识',
    category: 'route-fallback',
    content: '后端路由知识只解释系统如何选择 Skill、生成器和 fallback；当用户沉淀知识和项目资料没有命中时，才作为备份上下文提供。',
    roleScopes: ['ai-retrieval', 'product', 'ux', 'development']
  })
]

function parseWorkspaceJson(raw = '') {
  return JSON.parse(raw)
}

function parseFirstJsonObject(raw = '') {
  let depth = 0
  let inString = false
  let escaped = false
  let started = false
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (!started) {
      if (/\s/.test(char)) continue
      if (char !== '{') return null
      started = true
      depth = 1
      continue
    }
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return JSON.parse(raw.slice(0, index + 1))
      }
    }
  }
  return null
}

async function readWorkspaceFileState(filePath) {
  const raw = await readFile(filePath, 'utf8')
  try {
    return { state: parseWorkspaceJson(raw), recovered: false }
  } catch (error) {
    const recoveredState = parseFirstJsonObject(raw)
    if (!recoveredState) throw error
    return { state: recoveredState, recovered: true }
  }
}

async function readWorkspaceBackupCandidates(filePath) {
  const directory = dirname(filePath)
  const fileName = basename(filePath)
  let entries = []
  try {
    entries = await readdir(directory)
  } catch {
    return []
  }

  const candidateEntries = (await Promise.all(entries
    .filter((entry) => entry.startsWith(`${fileName}.bak-`) || entry.startsWith(`${fileName}.corrupt-`))
    .map(async (entry) => {
      const candidatePath = join(directory, entry)
      try {
        const fileStat = await stat(candidatePath)
        return { entry, candidatePath, mtimeMs: fileStat.mtimeMs }
      } catch {
        return null
      }
    })))
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 40)

  const candidates = []
  for (const entry of candidateEntries) {
    const candidatePath = entry.candidatePath
    try {
      const raw = await readFile(candidatePath, 'utf8')
      let state
      let recovered = false
      try {
        state = parseWorkspaceJson(raw)
      } catch {
        state = parseFirstJsonObject(raw)
        recovered = Boolean(state)
      }
      if (!state) continue
      candidates.push({
        filePath: candidatePath,
        fileName: entry.entry,
        state,
        recovered,
        mtimeMs: entry.mtimeMs
      })
      if (candidates.length >= 5) break
    } catch {}
  }
  return candidates
}

function workspaceRecoveryScore(store = {}) {
  const projects = Array.isArray(store.projects) ? store.projects : []
  const projectCount = projects.length
  const restoredCount = Array.isArray(store.restoredPages) ? store.restoredPages.length : 0
  const workflowCount = Array.isArray(store.workflowRuns) ? store.workflowRuns.length : 0
  const assetCount = Array.isArray(store.assets) ? store.assets.length : 0
  const materialCount = Array.isArray(store.materials) ? store.materials.length : 0
  const canonicalProjectBonus = projects.reduce((score, project) => {
    const name = String(project.name || '')
    if (name.includes('蝉镜')) return score + 500
    if (name.includes('流程通')) return score + 300
    return score
  }, 0)
  return (restoredCount * 1000) + (workflowCount * 500) + (assetCount * 200) + (materialCount * 20) + (projectCount * 50) + canonicalProjectBonus
}

async function recoverWorkspaceStateFromBackups(filePath) {
  const candidates = await readWorkspaceBackupCandidates(filePath)
  let best = null
  candidates.forEach((candidate) => {
    const normalizedState = normalizeStore(candidate.state)
    const score = workspaceRecoveryScore(normalizedState)
    if (!score) return
    const next = {
      ...candidate,
      normalizedState,
      score
    }
    if (!best || next.score > best.score || (next.score === best.score && next.mtimeMs > best.mtimeMs)) {
      best = next
    }
  })
  return best
}

function normalizeStore(input = {}) {
  const defaults = createDefaultWorkspaceStore()
  const users = Array.isArray(input.users) && input.users.length
    ? input.users.map((user) => createWorkspaceUser(user))
    : defaults.users
  const userIds = new Set(users.map((user) => user.id).filter(Boolean))
  const currentUserId = userIds.has(input.currentUserId) ? input.currentUserId : users[0].id
  const store = {
    currentUserId,
    users,
    projects: dedupeById(Array.isArray(input.projects) && input.projects.length
      ? input.projects.map((project) => createWorkspaceProject({
          ...project,
          ownerUserId: project.ownerUserId || currentUserId
        }))
      : defaults.projects),
    assets: dedupeById(Array.isArray(input.assets) ? input.assets : []),
    skillRuns: dedupeById(Array.isArray(input.skillRuns) ? input.skillRuns : []),
    materials: dedupeById(Array.isArray(input.materials) ? input.materials : []),
    generatedKnowledge: dedupeById(Array.isArray(input.generatedKnowledge)
      ? input.generatedKnowledge.map((item) => createWorkspaceGeneratedKnowledge({
          ...item,
          userId: item.userId || currentUserId
        }))
      : []),
    backendKnowledge: dedupeById(Array.isArray(input.backendKnowledge) && input.backendKnowledge.length
      ? input.backendKnowledge.map((item) => createWorkspaceBackendKnowledge(item))
      : DEFAULT_BACKEND_KNOWLEDGE),
    parseJobs: dedupeById(Array.isArray(input.parseJobs) ? input.parseJobs : []),
    modelCallLogs: dedupeById(Array.isArray(input.modelCallLogs) ? input.modelCallLogs : []),
    restoredPages: dedupeById(Array.isArray(input.restoredPages) ? input.restoredPages : []),
    competitors: dedupeById(Array.isArray(input.competitors) ? input.competitors : []),
    monitorTasks: dedupeById(Array.isArray(input.monitorTasks) ? input.monitorTasks : []),
    pageSnapshots: dedupeById(Array.isArray(input.pageSnapshots) ? input.pageSnapshots : []),
    changeRecords: dedupeById(Array.isArray(input.changeRecords) ? input.changeRecords : []),
    aiAnalyses: dedupeById(Array.isArray(input.aiAnalyses) ? input.aiAnalyses : []),
    competitorInsights: dedupeById(Array.isArray(input.competitorInsights) ? input.competitorInsights : []),
    competitorReports: dedupeById(Array.isArray(input.competitorReports) ? input.competitorReports : []),
    competitorAuditLogs: dedupeById(Array.isArray(input.competitorAuditLogs) ? input.competitorAuditLogs : []),
    workflowRuns: dedupeById(Array.isArray(input.workflowRuns) ? input.workflowRuns : []),
    skills: dedupeById(Array.isArray(input.skills) ? input.skills : []),
    settings: dedupeById(Array.isArray(input.settings) ? input.settings : [])
  }
  const accountProjectIds = new Set(
    store.projects
      .filter((project) => project.ownerUserId === currentUserId)
      .map((project) => project.id)
  )
  store.currentProjectId = accountProjectIds.has(input.currentProjectId)
    ? input.currentProjectId
    : (store.projects.find((project) => project.ownerUserId === currentUserId)?.id || store.projects[0]?.id || '')
  foldLegacyProjectShells(store)
  reassignOrphanResourcesToCurrentProject(store)
  dedupeWorkspaceCollections(store)
  return store
}

function dedupeById(items = []) {
  const map = new Map()
  const noId = []
  items.forEach((item) => {
    if (!item?.id) {
      noId.push(item)
      return
    }
    map.set(item.id, item)
  })
  return [...noId, ...map.values()]
}

function dedupeWorkspaceCollections(store) {
  ;[
    'projects',
    'assets',
    'skillRuns',
    'materials',
    'generatedKnowledge',
    'backendKnowledge',
    'parseJobs',
    'modelCallLogs',
    'restoredPages',
    'competitors',
    'monitorTasks',
    'pageSnapshots',
    'changeRecords',
    'aiAnalyses',
    'competitorInsights',
    'competitorReports',
    'competitorAuditLogs',
    'workflowRuns',
    'skills',
    'settings'
  ].forEach((key) => {
    store[key] = dedupeById(store[key])
  })
}

function projectModuleForItem(collectionKey = '', item = {}) {
  if (item.module) return item.module
  if (collectionKey === 'materials') {
    if (item.type === 'requirements') return 'requirements'
    if (item.type === 'competitors') return 'competitors'
    return 'knowledge'
  }
  const map = {
    assets: 'assets',
    skillRuns: 'skills',
    generatedKnowledge: 'knowledge',
    parseJobs: 'knowledge',
    modelCallLogs: 'settings',
    restoredPages: 'factory',
    competitors: 'competitors',
    monitorTasks: 'competitors',
    pageSnapshots: 'competitors',
    changeRecords: 'competitors',
    aiAnalyses: 'competitors',
    competitorInsights: 'competitors',
    competitorReports: 'competitors',
    competitorAuditLogs: 'competitors',
    workflowRuns: 'design',
    skills: 'skills'
  }
  return map[collectionKey] || 'assets'
}

function isLegacyProjectShell(project = {}) {
  const id = String(project.id || '')
  const name = String(project.name || '')
  return project.stage === 'recovered' ||
    /^debug-/.test(id) ||
    /恢复项目$/.test(name) ||
    name === '账号下的新项目' ||
    name === '后端化项目'
}

function fallbackProjectIdForOrphanResources(store) {
  const accountProject = store.projects.find((project) =>
    project.id === store.currentProjectId &&
    project.ownerUserId === store.currentUserId
  ) || store.projects.find((project) => project.ownerUserId === store.currentUserId) || store.projects[0]
  return accountProject?.id || 'project-flow'
}

function reassignResourceProjectIds(store, shouldReassign, fallbackProjectId) {
  ;[
    ['assets', store.assets],
    ['skillRuns', store.skillRuns],
    ['materials', store.materials],
    ['generatedKnowledge', store.generatedKnowledge],
    ['parseJobs', store.parseJobs],
    ['modelCallLogs', store.modelCallLogs],
    ['restoredPages', store.restoredPages],
    ['competitors', store.competitors],
    ['monitorTasks', store.monitorTasks],
    ['pageSnapshots', store.pageSnapshots],
    ['changeRecords', store.changeRecords],
    ['aiAnalyses', store.aiAnalyses],
    ['competitorInsights', store.competitorInsights],
    ['competitorReports', store.competitorReports],
    ['competitorAuditLogs', store.competitorAuditLogs],
    ['workflowRuns', store.workflowRuns],
    ['skills', store.skills]
  ].forEach(([collectionKey, items]) => {
    if (!Array.isArray(items)) return
    items.forEach((item) => {
      if (!item || typeof item !== 'object') return
      const projectId = item.projectId || ''
      if (projectId && shouldReassign(projectId)) {
        item.originProjectId = item.originProjectId || projectId
        item.projectId = fallbackProjectId
      }
      if (!item.module) item.module = projectModuleForItem(collectionKey, item)
    })
  })
}

function foldLegacyProjectShells(store) {
  const legacyProjectIds = new Set(store.projects.filter(isLegacyProjectShell).map((project) => project.id).filter(Boolean))
  if (!legacyProjectIds.size) return
  const realProjects = store.projects.filter((project) => !legacyProjectIds.has(project.id))
  if (!realProjects.length) return
  store.projects = realProjects
  if (legacyProjectIds.has(store.currentProjectId)) {
    store.currentProjectId = store.projects.find((project) => project.ownerUserId === store.currentUserId)?.id ||
      store.projects[0]?.id ||
      ''
  }
  const fallbackProjectId = fallbackProjectIdForOrphanResources(store)
  reassignResourceProjectIds(store, (projectId) => legacyProjectIds.has(projectId), fallbackProjectId)
}

function reassignOrphanResourcesToCurrentProject(store) {
  const projectIds = new Set(store.projects.map((project) => project.id).filter(Boolean))
  const fallbackProjectId = fallbackProjectIdForOrphanResources(store)
  reassignResourceProjectIds(store, (projectId) => !projectIds.has(projectId), fallbackProjectId)
}

function workspaceStorePayload(store) {
  return {
    currentUserId: store.currentUserId,
    currentProjectId: store.currentProjectId,
    users: store.users,
    projects: store.projects,
    assets: store.assets,
    skillRuns: store.skillRuns,
    materials: store.materials,
    generatedKnowledge: store.generatedKnowledge,
    backendKnowledge: store.backendKnowledge,
    parseJobs: store.parseJobs,
    modelCallLogs: store.modelCallLogs,
    restoredPages: store.restoredPages,
    competitors: store.competitors,
    monitorTasks: store.monitorTasks,
    pageSnapshots: store.pageSnapshots,
    changeRecords: store.changeRecords,
    aiAnalyses: store.aiAnalyses,
    competitorInsights: store.competitorInsights,
    competitorReports: store.competitorReports,
    competitorAuditLogs: store.competitorAuditLogs,
    workflowRuns: store.workflowRuns,
    skills: store.skills,
    settings: store.settings
  }
}

const DEFAULT_PERSISTED_STRING_LIMIT = 20000
const ADVANCED_UX_MARKDOWN_PERSIST_LIMIT = 1000000

function compactPersistedString(value = '', limit = DEFAULT_PERSISTED_STRING_LIMIT) {
  const text = typeof value === 'string' ? value : ''
  if (!text) return text
  if (text.startsWith('data:')) return ''
  return text.length > limit ? '' : text
}

function compactPersistedJsonValue(value, limit = DEFAULT_PERSISTED_STRING_LIMIT) {
  if (typeof value === 'string') return compactPersistedString(value, limit)
  if (Array.isArray(value)) return value.map((item) => compactPersistedJsonValue(item, limit))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      compactPersistedJsonValue(item, limit)
    ]))
  }
  return value
}

function preserveMarkdownDocumentForPersistence(target = null, source = null) {
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return
  if ('markdown' in source) {
    target.markdown = compactPersistedString(source.markdown || '', ADVANCED_UX_MARKDOWN_PERSIST_LIMIT)
  }
}

function preserveAdvancedUxReportForPersistence(target = null, source = null) {
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return
  preserveMarkdownDocumentForPersistence(target, source)
  preserveMarkdownDocumentForPersistence(target.pageInteractionDocument, source.pageInteractionDocument)
  preserveMarkdownDocumentForPersistence(target.pageInteractionDocumentArtifact, source.pageInteractionDocumentArtifact)
  if (Array.isArray(target.previousReports) && Array.isArray(source.previousReports)) {
    target.previousReports.forEach((previousReport, index) => {
      preserveMarkdownDocumentForPersistence(previousReport, source.previousReports[index])
    })
  }
}

function preserveAdvancedUxAnalysisMarkdownForPersistence(compact = null, source = null) {
  if (!compact || !source || typeof compact !== 'object' || typeof source !== 'object') return compact
  preserveAdvancedUxReportForPersistence(compact.advancedUxReport, source.advancedUxReport)
  preserveAdvancedUxReportForPersistence(compact.totalDesignFlow?.advancedUxReport, source.totalDesignFlow?.advancedUxReport)
  preserveMarkdownDocumentForPersistence(
    compact.totalDesignFlow?.pageInteractionDocumentArtifact,
    source.totalDesignFlow?.pageInteractionDocumentArtifact
  )
  preserveMarkdownDocumentForPersistence(compact.pageInteractionDocumentArtifact, source.pageInteractionDocumentArtifact)
  return compact
}

function compactAgentSessionsForPersistence(agentSessions = {}) {
  const compact = compactPersistedJsonValue(agentSessions)
  Object.entries(agentSessions || {}).forEach(([scopeId, sourceSession]) => {
    const compactSession = compact?.[scopeId]
    if (!Array.isArray(sourceSession) || !Array.isArray(compactSession)) return
    sourceSession.forEach((sourceMessage, index) => {
      const compactMessage = compactSession[index]
      if (sourceMessage?.meta?.action !== 'advanced-ux-markdown-report' || !compactMessage?.meta) return
      if ('markdown' in sourceMessage.meta) {
        compactMessage.meta.markdown = compactPersistedString(
          sourceMessage.meta.markdown || '',
          ADVANCED_UX_MARKDOWN_PERSIST_LIMIT
        )
      }
      preserveMarkdownDocumentForPersistence(
        compactMessage.meta.pageInteractionDocument,
        sourceMessage.meta.pageInteractionDocument
      )
    })
  })
  return compact
}

function compactReferenceFilesForPersistence(referenceFiles = {}) {
  if (!referenceFiles || typeof referenceFiles !== 'object' || Array.isArray(referenceFiles)) return referenceFiles
  return Object.fromEntries(Object.entries(referenceFiles).map(([scopeId, files]) => [
    scopeId,
    Array.isArray(files)
      ? files.map((file) => ({
          ...compactPersistedJsonValue(file),
          text: '',
          content: '',
          preview: compactDataUrl(file?.preview || '')
        }))
      : files
  ]))
}

function compactDocumentAnalysisForPersistence(analysis = null) {
  if (!analysis || typeof analysis !== 'object') return analysis
  const compact = compactPersistedJsonValue(analysis)
  preserveAdvancedUxAnalysisMarkdownForPersistence(compact, analysis)
  if ('rawContent' in compact) compact.rawContent = ''
  if (compact.blueprint && typeof compact.blueprint === 'object') {
    compact.blueprint = {
      title: compact.blueprint.title || compact.blueprint.profile?.productName || '',
      profile: compact.blueprint.profile
        ? {
            productName: compact.blueprint.profile.productName || '',
            primaryGoal: compact.blueprint.profile.primaryGoal || ''
          }
        : undefined,
      qualityGate: compact.blueprint.qualityGate || undefined
    }
  }
  if (Array.isArray(compact.versions)) compact.versions = []
  if (Array.isArray(compact.documents)) {
    compact.documents = compact.documents.map((document) => ({
      ...document,
      text: '',
      content: '',
      raw: undefined
    }))
  }
  if (compact.generation && typeof compact.generation === 'object') {
    compact.generation = {
      ...compact.generation,
      rawContent: '',
      prompt: compactPersistedString(compact.generation.prompt || '')
    }
  }
  return compact
}

function compactWorkflowRunForPersistence(run = {}) {
  return {
    ...compactPersistedJsonValue(run),
    input: compactPersistedString(run.input || ''),
    documentAnalysis: compactDocumentAnalysisForPersistence(run.documentAnalysis),
    projectBlueprint: compactPersistedJsonValue(run.projectBlueprint),
    agentSessions: compactAgentSessionsForPersistence(run.agentSessions),
    referenceFiles: compactReferenceFilesForPersistence(run.referenceFiles)
  }
}

function compactSettingForPersistence(setting = {}) {
  return {
    ...setting,
    value: compactPersistedJsonValue(setting.value)
  }
}

function workspaceStorePersistPayload(store) {
  const payload = workspaceStorePayload(store)
  return {
    ...payload,
    assets: payload.assets.map(compactAssetForOverview),
    materials: payload.materials.map(compactMaterialForOverview),
    restoredPages: payload.restoredPages.map(compactRestoredPageForPersistence),
    workflowRuns: payload.workflowRuns.map(compactWorkflowRunForPersistence),
    settings: payload.settings.map(compactSettingForPersistence)
  }
}

async function persistStoreAtomically(store) {
  dedupeWorkspaceCollections(store)
  const directory = dirname(store.filePath)
  await mkdir(directory, { recursive: true })
  const serialized = JSON.stringify(workspaceStorePersistPayload(store), null, 2)
  JSON.parse(serialized)
  const tempFilePath = join(
    directory,
    `.${basename(store.filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  try {
    await writeFile(tempFilePath, serialized, 'utf8')
    await rename(tempFilePath, store.filePath)
  } catch (error) {
    try {
      await rm(tempFilePath, { force: true })
    } catch {}
    throw error
  }
}

async function persistStore(store) {
  if (store.persistenceDisabled) return
  
  // Save to database if available
  if (isDatabaseAvailable()) {
    try {
      const data = workspaceStorePersistPayload(store)
      await saveWorkspaceToDatabase(data)
    } catch (error) {
      console.error('[workspace-store] Failed to save to database:', error.message)
      // Fall through to file-based persistence
    }
  }
  
  // Also save to file if filePath is set
  if (!store.filePath) return
  const persistTask = (store.persistQueue || Promise.resolve())
    .catch(() => {})
    .then(() => persistStoreAtomically(store))
  store.persistQueue = persistTask
  try {
    await persistTask
  } finally {
    if (store.persistQueue === persistTask) store.persistQueue = null
  }
}

export function createWorkspaceStore(seed = null, options = {}) {
  const initial = normalizeStore(seed || createDefaultWorkspaceStore())
  const store = {
    currentUserId: initial.currentUserId,
    currentProjectId: initial.currentProjectId,
    users: [...(initial.users || [])],
    projects: [...(initial.projects || [])],
    assets: [...(initial.assets || [])],
    skillRuns: [...(initial.skillRuns || [])],
    materials: [...(initial.materials || [])],
    generatedKnowledge: [...(initial.generatedKnowledge || [])],
    backendKnowledge: [...(initial.backendKnowledge || [])],
    parseJobs: [...(initial.parseJobs || [])],
    modelCallLogs: [...(initial.modelCallLogs || [])],
    restoredPages: [...(initial.restoredPages || [])],
    competitors: [...(initial.competitors || [])],
    monitorTasks: [...(initial.monitorTasks || [])],
    pageSnapshots: [...(initial.pageSnapshots || [])],
    changeRecords: [...(initial.changeRecords || [])],
    aiAnalyses: [...(initial.aiAnalyses || [])],
    competitorInsights: [...(initial.competitorInsights || [])],
    competitorReports: [...(initial.competitorReports || [])],
    competitorAuditLogs: [...(initial.competitorAuditLogs || [])],
    workflowRuns: [...(initial.workflowRuns || [])],
    skills: [...(initial.skills || [])],
    settings: [...(initial.settings || [])],
    filePath: options.filePath || '',
    persistenceDisabled: false,
    persist() {
      return persistStore(store)
    },
    applyState(fileState) {
      store.currentUserId = fileState.currentUserId
      store.currentProjectId = fileState.currentProjectId
      store.users.splice(0, store.users.length, ...fileState.users)
      store.projects.splice(0, store.projects.length, ...fileState.projects)
      store.assets.splice(0, store.assets.length, ...fileState.assets)
      store.skillRuns.splice(0, store.skillRuns.length, ...fileState.skillRuns)
      store.materials.splice(0, store.materials.length, ...fileState.materials)
      store.generatedKnowledge.splice(0, store.generatedKnowledge.length, ...fileState.generatedKnowledge)
      store.backendKnowledge.splice(0, store.backendKnowledge.length, ...fileState.backendKnowledge)
      store.parseJobs.splice(0, store.parseJobs.length, ...fileState.parseJobs)
      store.modelCallLogs.splice(0, store.modelCallLogs.length, ...fileState.modelCallLogs)
      store.restoredPages.splice(0, store.restoredPages.length, ...fileState.restoredPages)
      store.competitors.splice(0, store.competitors.length, ...(fileState.competitors || []))
      store.monitorTasks.splice(0, store.monitorTasks.length, ...(fileState.monitorTasks || []))
      store.pageSnapshots.splice(0, store.pageSnapshots.length, ...(fileState.pageSnapshots || []))
      store.changeRecords.splice(0, store.changeRecords.length, ...(fileState.changeRecords || []))
      store.aiAnalyses.splice(0, store.aiAnalyses.length, ...(fileState.aiAnalyses || []))
      store.competitorInsights.splice(0, store.competitorInsights.length, ...(fileState.competitorInsights || []))
      store.competitorReports.splice(0, store.competitorReports.length, ...(fileState.competitorReports || []))
      store.competitorAuditLogs.splice(0, store.competitorAuditLogs.length, ...(fileState.competitorAuditLogs || []))
      store.workflowRuns.splice(0, store.workflowRuns.length, ...fileState.workflowRuns)
      store.skills.splice(0, store.skills.length, ...fileState.skills)
      store.settings.splice(0, store.settings.length, ...fileState.settings)
    },
    async load() {
      // First try to load from database if available
      if (isDatabaseAvailable()) {
        try {
          const dbState = await loadWorkspaceFromDatabase()
          if (dbState) {
            const normalizedState = normalizeStore(dbState)
            store.applyState(normalizedState)
            console.log('[workspace-store] Loaded from database')
            return workspaceSnapshot(store)
          }
        } catch (error) {
          console.error('[workspace-store] Failed to load from database:', error.message)
          // Fall through to file-based loading
        }
      }
      
      // Fall back to file-based loading
      if (!store.filePath) return workspaceSnapshot(store)
      try {
        const { state: rawFileState, recovered } = await readWorkspaceFileState(store.filePath)
        const fileState = normalizeStore(rawFileState)
        store.applyState(fileState)
        // If loaded from file and database is available, sync to database
        if (isDatabaseAvailable()) {
          try {
            const data = workspaceStorePersistPayload(store)
            await saveWorkspaceToDatabase(data)
            console.log('[workspace-store] Synced file state to database')
          } catch (error) {
            console.error('[workspace-store] Failed to sync to database:', error.message)
          }
        }
        if (recovered) {
          const backupPath = `${store.filePath}.corrupt-${Date.now()}.json`
          try {
            await copyFile(store.filePath, backupPath)
          } catch {}
          await persistStore(store)
        } else if (JSON.stringify(fileState) !== JSON.stringify(rawFileState)) {
          await persistStore(store)
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          const backupPath = `${store.filePath}.corrupt-${Date.now()}.json`
          try {
            await copyFile(store.filePath, backupPath)
          } catch {}
          const recovered = await recoverWorkspaceStateFromBackups(store.filePath)
          if (recovered) {
            store.applyState(recovered.normalizedState)
            await persistStore(store)
            return workspaceSnapshot(store)
          }
          store.persistenceDisabled = true
          return workspaceSnapshot(store)
        }
        await persistStore(store)
      }
      return workspaceSnapshot(store)
    }
  }
  return store
}

export function workspaceSnapshot(store) {
  return {
    currentUserId: store.currentUserId,
    currentProjectId: store.currentProjectId,
    users: store.users.map(publicWorkspaceUser),
    projects: store.projects,
    assets: store.assets.map(compactAssetForOverview),
    skillRuns: store.skillRuns,
    materials: store.materials.map(compactMaterialForOverview),
    generatedKnowledge: store.generatedKnowledge,
    parseJobs: store.parseJobs,
    modelCallLogs: store.modelCallLogs,
    restoredPages: store.restoredPages.map(compactRestoredPageForOverview),
    competitors: store.competitors,
    monitorTasks: store.monitorTasks,
    pageSnapshots: store.pageSnapshots,
    changeRecords: store.changeRecords,
    aiAnalyses: store.aiAnalyses,
    competitorInsights: store.competitorInsights,
    competitorReports: store.competitorReports,
    competitorAuditLogs: store.competitorAuditLogs,
    workflowRuns: store.workflowRuns.map(compactWorkflowRunForOverview),
    skills: workspaceSkillsView(store),
    settings: store.settings
  }
}

function systemSkillView(skill = {}) {
  return createWorkspaceSkill({
    id: skill.id,
    name: skill.name,
    source: 'system',
    visibility: 'global',
    status: 'active',
    category: skill.category || '系统',
    description: skill.description || skill.promptTemplate || '',
    qualityChecks: skill.qualityChecks || [],
    outputFormat: skill.outputSchema || '',
    applicableScenarios: skill.intentTypes || []
  })
}

function workspaceSkillsView(store) {
  return dedupeById([
    ...listSkillDefinitions().map(systemSkillView),
    ...store.skills
  ])
}

function compactText(value = '', limit = 20000) {
  const text = typeof value === 'string' ? value : ''
  return text.length > limit ? '' : text
}

function compactDataUrl(value = '') {
  return typeof value === 'string' && value.startsWith('data:') ? '' : value
}

function compactDesignSourceForOverview(source = null) {
  if (!source || typeof source !== 'object') return source
  return {
    ...source,
    coverImage: compactDataUrl(source.coverImage || ''),
    pages: Array.isArray(source.pages)
      ? source.pages.map((page) => ({
          ...page,
          screenshot: compactDataUrl(page.screenshot || '')
        }))
      : source.pages,
    rawRef: source.rawRef || null
  }
}

function compactPrototypeDemoForOverview(demo = null) {
  if (!demo || typeof demo !== 'object') return demo
  return {
    ...demo,
    screens: Array.isArray(demo.screens)
      ? demo.screens.map((screen) => ({
          ...screen,
          screenshotUrl: compactDataUrl(screen.screenshotUrl || ''),
          screenshot: compactDataUrl(screen.screenshot || '')
        }))
      : demo.screens,
    screenshotAssets: []
  }
}

function compactAssetForOverview(asset = {}) {
  return {
    ...asset,
    content: compactText(asset.content),
    designSource: compactDesignSourceForOverview(asset.designSource),
    prototypeDemo: compactPrototypeDemoForOverview(asset.prototypeDemo),
    screenshotAssets: [],
    versions: Array.isArray(asset.versions) && JSON.stringify(asset.versions).length > 200000 ? [] : asset.versions
  }
}

function compactMaterialForOverview(material = {}) {
  const preview = material.preview && typeof material.preview === 'object'
    ? {
        ...material.preview,
        dataUrl: ''
      }
    : ''
  return {
    ...material,
    content: compactText(material.content),
    preview,
    raw: undefined
  }
}

function compactRestoredPageForOverview(page = {}) {
  const id = page.id || ''
  const encodedId = encodeURIComponent(id)
  const hasHtml = Boolean(
    page.html ||
    (Array.isArray(page.files) && page.files.some((file) =>
      (file?.path === 'index.html' || file?.path === 'src/pageData.js') &&
      String(file?.content || '').trim()
    ))
  )
  return {
    ...page,
    hasHtml,
    html: '',
    files: [],
    coverImage: '',
    visualVerification: null,
    captureResult: null,
    previewUrl: id ? `/api/workspace/restored-pages/${encodedId}/preview` : (page.previewUrl || ''),
    frameUrl: id ? `/api/workspace/restored-pages/${encodedId}/frame` : (page.frameUrl || ''),
    sourceUrlPath: id ? `/api/workspace/restored-pages/${encodedId}/source` : (page.sourceUrlPath || ''),
    downloadUrl: id ? `/api/workspace/restored-pages/${encodedId}/download` : (page.downloadUrl || '')
  }
}

function compactRestoredPageForPersistence(page = {}) {
  const id = page.id || ''
  const encodedId = encodeURIComponent(id)
  return {
    ...page,
    coverImage: '',
    visualVerification: null,
    captureResult: null,
    previewUrl: id ? `/api/workspace/restored-pages/${encodedId}/preview` : (page.previewUrl || ''),
    frameUrl: id ? `/api/workspace/restored-pages/${encodedId}/frame` : (page.frameUrl || ''),
    sourceUrlPath: id ? `/api/workspace/restored-pages/${encodedId}/source` : (page.sourceUrlPath || ''),
    downloadUrl: id ? `/api/workspace/restored-pages/${encodedId}/download` : (page.downloadUrl || '')
  }
}

function workflowRunAnalysisSummary(run = {}) {
  const analysis = run.documentAnalysis || {}
  const canvas = analysis.canvas || {}
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : []
  const orderedTabs = Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
  return {
    hasCanvas: nodes.length > 0,
    parsed: analysis.summary?.parsed || 0,
    nodeCount: nodes.length,
    qualityScore: analysis.qualityGate?.score ?? analysis.blueprint?.qualityGate?.score ?? null,
    tabPreview: orderedTabs.slice(0, 4).map((tab) => ({
      key: tab.key || '',
      label: tab.label || tab.key || ''
    })).filter((tab) => tab.key || tab.label)
  }
}

function compactWorkflowRunForOverview(run = {}) {
  const documentAnalysisSummary = workflowRunAnalysisSummary(run)
  const hasDocumentAnalysisDetail = Boolean(run.documentAnalysis?.canvas)
  return {
    ...run,
    input: compactText(run.input),
    documentAnalysis: null,
    documentAnalysisSummary,
    hasDocumentAnalysisDetail,
    projectBlueprint: null,
    referenceFiles: undefined
  }
}

export async function saveWorkspaceContext(store, payload = {}) {
  reassignOrphanResourcesToCurrentProject(store)
  dedupeWorkspaceCollections(store)
  const currentUserId = store.users.some((user) => user.id === payload.currentUserId)
    ? payload.currentUserId
    : store.currentUserId
  store.currentUserId = currentUserId

  const accountProjects = store.projects.filter((project) => project.ownerUserId === currentUserId)
  const projectIds = new Set(accountProjects.map((project) => project.id))
  const requestedProjectId = payload.currentProjectId || ''
  let accepted = false
  let message = '当前账号下不存在该项目，项目切换未生效'
  if (projectIds.has(payload.currentProjectId)) {
    store.currentProjectId = payload.currentProjectId
    accepted = true
    message = '项目上下文已切换'
  } else if (!projectIds.has(store.currentProjectId)) {
    store.currentProjectId = accountProjects[0]?.id || store.projects[0]?.id || ''
  }
  const project = store.projects.find((item) => item.id === store.currentProjectId) || null

  await persistStore(store)
  return {
    accepted,
    requestedProjectId,
    message,
    currentUserId: store.currentUserId,
    currentProjectId: store.currentProjectId,
    project
  }
}

export async function addProject(store, payload = {}) {
  const ownerUserId = store.users.some((user) => user.id === payload.ownerUserId)
    ? payload.ownerUserId
    : store.currentUserId
  const project = createWorkspaceProject({
    ...payload,
    id: '',
    ownerUserId
  })
  store.projects.unshift(project)
  store.currentProjectId = project.id
  await persistStore(store)
  return project
}

export async function addAsset(store, payload = {}) {
  const asset = createWorkspaceAsset(payload)
  store.assets.unshift(asset)
  await persistStore(store)
  return asset
}

export async function deleteAsset(store, id = '') {
  const before = store.assets.length
  store.assets = store.assets.filter((item) => item.id !== id)
  await persistStore(store)
  return { id, deleted: store.assets.length < before }
}

export async function addCompetitor(store, payload = {}) {
  const competitor = createWorkspaceCompetitor(payload)
  const index = store.competitors.findIndex((item) => item.id === competitor.id)
  if (index >= 0) store.competitors.splice(index, 1, competitor)
  else store.competitors.unshift(competitor)
  await persistStore(store)
  return competitor
}

export async function updateCompetitor(store, competitorOrId = '', patch = {}) {
  const competitorId = typeof competitorOrId === 'string' ? competitorOrId : competitorOrId?.id
  const current = store.competitors.find((item) => item.id === competitorId)
  if (!current) return null
  const updated = createWorkspaceCompetitor({
    ...current,
    ...patch,
    id: current.id,
    projectId: patch.projectId || current.projectId,
    createdAt: current.createdAt,
    updatedAt: patch.updatedAt || new Date().toISOString()
  })
  const index = store.competitors.findIndex((item) => item.id === current.id)
  store.competitors.splice(index, 1, updated)
  await persistStore(store)
  return updated
}

export async function deleteCompetitor(store, id = '', patch = {}) {
  const competitor = store.competitors.find((item) => item.id === id)
  if (!competitor) return { id, deleted: false }
  await updateCompetitor(store, competitor, {
    ...patch,
    status: 'deleted',
    updatedAt: patch.updatedAt || new Date().toISOString()
  })
  return { id, deleted: true }
}

export function listCompetitors(store, payload = {}) {
  const projectId = payload.projectId || ''
  const includeDeleted = Boolean(payload.includeDeleted)
  return store.competitors
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => includeDeleted || item.status !== 'deleted')
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export function getCompetitor(store, id = '') {
  return store.competitors.find((item) => item.id === id) || null
}

export async function addMonitorTask(store, payload = {}) {
  const task = createWorkspaceMonitorTask(payload)
  const index = store.monitorTasks.findIndex((item) => item.id === task.id)
  if (index >= 0) store.monitorTasks.splice(index, 1, task)
  else store.monitorTasks.unshift(task)
  await persistStore(store)
  return task
}

export function listMonitorTasks(store, payload = {}) {
  const projectId = payload.projectId || ''
  const competitorId = payload.competitorId || ''
  return store.monitorTasks
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !competitorId || item.competitorId === competitorId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export async function addPageSnapshot(store, payload = {}) {
  const snapshot = createWorkspacePageSnapshot(payload)
  const index = store.pageSnapshots.findIndex((item) => item.id === snapshot.id)
  if (index >= 0) store.pageSnapshots.splice(index, 1, snapshot)
  else store.pageSnapshots.unshift(snapshot)
  await persistStore(store)
  return snapshot
}

export function listPageSnapshots(store, payload = {}) {
  const projectId = payload.projectId || ''
  const competitorId = payload.competitorId || ''
  const taskId = payload.taskId || ''
  return store.pageSnapshots
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !competitorId || item.competitorId === competitorId)
    .filter((item) => !taskId || item.taskId === taskId)
    .slice()
    .sort((a, b) => new Date(b.capturedAt || b.updatedAt || b.createdAt || 0) - new Date(a.capturedAt || a.updatedAt || a.createdAt || 0))
}

export async function addChangeRecord(store, payload = {}) {
  const record = createWorkspaceChangeRecord(payload)
  const index = store.changeRecords.findIndex((item) => item.id === record.id)
  if (index >= 0) store.changeRecords.splice(index, 1, record)
  else store.changeRecords.unshift(record)
  await persistStore(store)
  return record
}

export function listChangeRecords(store, payload = {}) {
  const projectId = payload.projectId || ''
  const competitorId = payload.competitorId || ''
  const taskId = payload.taskId || ''
  return store.changeRecords
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !competitorId || item.competitorId === competitorId)
    .filter((item) => !taskId || item.taskId === taskId)
    .slice()
    .sort((a, b) => new Date(b.detectedAt || b.updatedAt || b.createdAt || 0) - new Date(a.detectedAt || a.updatedAt || a.createdAt || 0))
}

export function getChangeRecord(store, id = '') {
  return store.changeRecords.find((item) => item.id === id) || null
}

export async function addAiAnalysis(store, payload = {}) {
  const analysis = createWorkspaceAiAnalysis(payload)
  const index = store.aiAnalyses.findIndex((item) => item.id === analysis.id)
  if (index >= 0) store.aiAnalyses.splice(index, 1, analysis)
  else store.aiAnalyses.unshift(analysis)
  await persistStore(store)
  return analysis
}

export function getAiAnalysisByChangeId(store, changeId = '') {
  return store.aiAnalyses.find((item) => item.changeId === changeId) || null
}

export async function addCompetitorInsight(store, payload = {}) {
  const insight = createWorkspaceCompetitorInsight(payload)
  const index = store.competitorInsights.findIndex((item) => item.id === insight.id)
  if (index >= 0) store.competitorInsights.splice(index, 1, insight)
  else store.competitorInsights.unshift(insight)
  await persistStore(store)
  return insight
}

export function listCompetitorInsights(store, payload = {}) {
  const projectId = payload.projectId || ''
  const competitorId = payload.competitorId || ''
  return store.competitorInsights
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !competitorId || item.competitorId === competitorId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export async function addCompetitorReport(store, payload = {}) {
  const report = createWorkspaceCompetitorReport(payload)
  const index = store.competitorReports.findIndex((item) => item.id === report.id)
  if (index >= 0) store.competitorReports.splice(index, 1, report)
  else store.competitorReports.unshift(report)
  await persistStore(store)
  return report
}

export function listCompetitorReports(store, payload = {}) {
  const projectId = payload.projectId || ''
  const competitorId = payload.competitorId || ''
  return store.competitorReports
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !competitorId || item.competitorId === competitorId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export async function addCompetitorAuditLog(store, payload = {}) {
  const log = createWorkspaceCompetitorAuditLog(payload)
  store.competitorAuditLogs.unshift(log)
  await persistStore(store)
  return log
}

export function listCompetitorAuditLogs(store, payload = {}) {
  const projectId = payload.projectId || ''
  const action = payload.action || ''
  const targetType = payload.targetType || ''
  const actorUserId = payload.actorUserId || ''
  const limit = Math.max(1, Math.min(100, Number(payload.limit) || 30))
  return store.competitorAuditLogs
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !action || item.action === action)
    .filter((item) => !targetType || item.targetType === targetType)
    .filter((item) => !actorUserId || item.actorUserId === actorUserId)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
}

export async function addRun(store, payload = {}) {
  const run = createWorkspaceRun(payload)
  store.skillRuns.unshift(run)
  await persistStore(store)
  return run
}

function normalizeSkillProject(store, payload = {}) {
  const visibility = payload.visibility || 'global'
  if (visibility === 'global') return ''
  const requestedProjectId = payload.projectId || store.currentProjectId
  const ownsProject = store.projects.some((project) =>
    project.id === requestedProjectId &&
    project.ownerUserId === store.currentUserId
  )
  return ownsProject ? requestedProjectId : store.currentProjectId
}

function createUserWorkspaceSkill(store, payload = {}, existing = {}) {
  const now = new Date().toISOString()
  return createWorkspaceSkill({
    ...existing,
    ...payload,
    id: existing.id || '',
    source: 'user',
    status: payload.status || existing.status || 'active',
    visibility: payload.visibility || existing.visibility || 'global',
    projectId: normalizeSkillProject(store, {
      ...existing,
      ...payload,
      visibility: payload.visibility || existing.visibility || 'global'
    }),
    createdAt: existing.createdAt || payload.createdAt || now,
    updatedAt: now
  })
}

export async function addSkill(store, payload = {}) {
  const skill = createUserWorkspaceSkill(store, payload)
  store.skills.unshift(skill)
  await persistStore(store)
  return skill
}

export async function updateSkill(store, id = '', payload = {}) {
  const current = store.skills.find((item) => item.id === id)
  if (!current || current.source === 'system') {
    const error = new Error('用户 Skill 不存在或不可编辑')
    error.code = 'WORKSPACE_SKILL_NOT_FOUND'
    throw error
  }
  const skill = createUserWorkspaceSkill(store, payload, current)
  const index = store.skills.findIndex((item) => item.id === id)
  store.skills.splice(index, 1, skill)
  await persistStore(store)
  return skill
}

export async function addMaterial(store, payload = {}) {
  const material = createWorkspaceMaterial(payload)
  const index = store.materials.findIndex((item) => item.id === material.id)
  if (index >= 0) store.materials.splice(index, 1, material)
  else store.materials.unshift(material)
  await persistStore(store)
  return material
}

export function getMaterial(store, id = '') {
  return store.materials.find((item) => item.id === id) || null
}

export async function addParseJob(store, payload = {}) {
  const job = createWorkspaceParseJob(payload)
  store.parseJobs.unshift(job)
  await persistStore(store)
  return job
}

export function listParseJobs(store, payload = {}) {
  const projectId = payload.projectId || ''
  return store.parseJobs
    .filter((item) => !projectId || item.projectId === projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export async function updateParseJob(store, id = '', patch = {}) {
  const current = store.parseJobs.find((item) => item.id === id)
  if (!current) return null
  const job = createWorkspaceParseJob({
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  })
  const index = store.parseJobs.findIndex((item) => item.id === id)
  store.parseJobs.splice(index, 1, job)
  await persistStore(store)
  return job
}

export async function addModelCallLog(store, payload = {}) {
  const log = {
    id: payload.id || `model-call-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    skillId: payload.skillId || '',
    requestedSkillId: payload.requestedSkillId || '',
    resolvedSkillId: payload.resolvedSkillId || payload.skillId || '',
    demandScope: payload.demandScope || '',
    projectId: payload.projectId || '',
    detectedIntent: payload.detectedIntent || '',
    routingReason: payload.routingReason || '',
    runId: payload.runId || '',
    stepId: payload.stepId || '',
    nodeId: payload.nodeId || '',
    nodeTitle: payload.nodeTitle || '',
    action: payload.action || '',
    actionIntent: payload.actionIntent || '',
    actionLabel: payload.actionLabel || '',
    entrySource: payload.entrySource || '',
    inputPreview: payload.inputPreview || '',
    promptPreview: payload.promptPreview || '',
    provider: payload.provider || '',
    model: payload.model || '',
    status: payload.status || 'unknown',
    durationMs: Number(payload.durationMs || 0),
    usage: payload.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    fallbackReason: payload.fallbackReason || '',
    errorCode: payload.errorCode || '',
    errorMessage: payload.errorMessage || '',
    recoveryActions: Array.isArray(payload.recoveryActions) ? payload.recoveryActions : [],
    createdAt: payload.createdAt || new Date().toISOString()
  }
  store.modelCallLogs.unshift(log)
  await persistStore(store)
  return log
}

export function listModelCallLogs(store, payload = {}) {
  const skillId = payload.skillId || ''
  const status = payload.status || ''
  const projectId = payload.projectId || ''
  const demandScope = payload.demandScope || ''
  const limit = Math.max(1, Math.min(100, Number(payload.limit) || 50))
  return store.modelCallLogs
    .filter((item) => !skillId || item.skillId === skillId || item.resolvedSkillId === skillId)
    .filter((item) => !status || item.status === status)
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !demandScope || item.demandScope === demandScope)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
}

const MODEL_SETTING_KEY = 'workflowModelProvider'

function getSettingValue(store, key = '') {
  const settings = Array.isArray(store?.settings) ? store.settings : []
  const setting = settings.find((item) => item.key === key)
  return setting?.value && typeof setting.value === 'object' ? setting.value : {}
}

async function saveSettingValue(store, key = '', value = {}, meta = {}) {
  const now = new Date().toISOString()
  const existingIndex = store.settings.findIndex((item) => item.key === key)
  const setting = createWorkspaceSetting({
    ...(existingIndex >= 0 ? store.settings[existingIndex] : {}),
    key,
    value,
    group: meta.group || 'general',
    status: meta.status || 'active',
    sensitive: Boolean(meta.sensitive),
    description: meta.description || '',
    updatedAt: now
  })
  if (existingIndex >= 0) store.settings.splice(existingIndex, 1, setting)
  else store.settings.unshift(setting)
  await persistStore(store)
  return setting.value
}
const SKILL_ORCHESTRATION_SETTING_KEY = 'skillOrchestrationStrategies'

function maskApiKey(apiKey = '') {
  const value = String(apiKey || '')
  if (!value) return ''
  if (value.length <= 8) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

function isPlaceholderApiKey(apiKey = '') {
  return String(apiKey || '').trim() === 'PROXY_MANAGED'
}

function normalizeModelApiSurface(provider = '', ...candidates) {
  const normalizedProvider = String(provider || '').trim()
  if (normalizedProvider === 'codex-cli') return 'codex.exec'
  const validHttpSurfaces = new Set(['responses', 'chat.completions'])
  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (validHttpSurfaces.has(value)) return value
  }
  return normalizedProvider === 'deterministic' ? 'chat.completions' : 'responses'
}

export function getModelSettingsRaw(store) {
  return getSettingValue(store, MODEL_SETTING_KEY)
}

export function modelSettingsView(store) {
  const raw = getModelSettingsRaw(store)
  const hasRealApiKey = Boolean(raw.apiKey) && !isPlaceholderApiKey(raw.apiKey)
  const provider = raw.provider || 'deterministic'
  const usesInternalAuth = provider === 'codex-cli' || provider === 'codex-proxy'
  return {
    provider,
    baseUrl: raw.baseUrl || '',
    defaultModel: raw.defaultModel || 'gpt-5.5',
    apiSurface: normalizeModelApiSurface(provider, raw.apiSurface),
    timeoutMs: raw.timeoutMs === 0 ? 0 : Number(raw.timeoutMs || 20000),
    fallback: raw.fallback || 'deterministic',
    enabled: Boolean(raw.enabled),
    hasApiKey: usesInternalAuth || hasRealApiKey,
    apiKeyMasked: usesInternalAuth ? '' : (hasRealApiKey ? maskApiKey(raw.apiKey) : '')
  }
}

export async function saveModelSettings(store, payload = {}) {
  const current = getModelSettingsRaw(store)
  const apiKey = payload.apiKey === '__KEEP__' || payload.apiKey === undefined
    ? current.apiKey || ''
    : String(payload.apiKey || '')
  const provider = payload.provider || current.provider || 'openai-compatible'
  const enabled = payload.enabled !== undefined
    ? Boolean(payload.enabled)
    : (provider === 'codex-cli' || provider === 'codex-proxy' ? true : (provider === 'openai-compatible' ? Boolean(apiKey || current.enabled) : Boolean(current.enabled)))
  const apiSurface = normalizeModelApiSurface(provider, payload.apiSurface, current.apiSurface)
  const value = {
    provider,
    apiKey,
    baseUrl: payload.baseUrl || current.baseUrl || '',
    defaultModel: payload.defaultModel || current.defaultModel || 'gpt-5.5',
    apiSurface,
    timeoutMs: payload.timeoutMs === 0 ? 0 : Number(payload.timeoutMs || current.timeoutMs || 20000),
    fallback: payload.fallback || current.fallback || 'deterministic',
    allowInsecureTLS: Boolean(payload.allowInsecureTLS ?? current.allowInsecureTLS),
    enabled
  }
  await saveSettingValue(store, MODEL_SETTING_KEY, value, {
    group: 'model',
    status: value.enabled ? 'active' : 'inactive',
    sensitive: true,
    description: '后端工作流模型供应商配置，前端只读取脱敏状态。'
  })
  return modelSettingsView(store)
}

function normalizeSkillOverrides(input = {}) {
  return Object.entries(input && typeof input === 'object' ? input : {}).reduce((overrides, [skillId, override]) => {
    if (!override || typeof override !== 'object') return overrides
    const normalized = {}
    if (typeof override.promptTemplate === 'string') normalized.promptTemplate = override.promptTemplate
    if (typeof override.outputSchema === 'string') normalized.outputSchema = override.outputSchema
    if (Array.isArray(override.qualityChecks)) {
      normalized.qualityChecks = override.qualityChecks.map((item) => String(item || '').trim()).filter(Boolean)
    }
    if (typeof override.fallbackSkillId === 'string') normalized.fallbackSkillId = override.fallbackSkillId
    overrides[skillId] = normalized
    return overrides
  }, {})
}

export function getSkillOrchestrationSettingsRaw(store) {
  const setting = store.settings.find((item) => item.key === SKILL_ORCHESTRATION_SETTING_KEY)
  return setting?.value && typeof setting.value === 'object' ? setting.value : {}
}

export function skillOrchestrationSettingsView(store) {
  const raw = getSkillOrchestrationSettingsRaw(store)
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    skillOverrides: normalizeSkillOverrides(raw.skillOverrides || {})
  }
}

export async function saveSkillOrchestrationSettings(store, payload = {}) {
  const current = getSkillOrchestrationSettingsRaw(store)
  const value = {
    enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : (current.enabled !== undefined ? Boolean(current.enabled) : true),
    skillOverrides: normalizeSkillOverrides(payload.skillOverrides || current.skillOverrides || {})
  }
  const now = new Date().toISOString()
  const existingIndex = store.settings.findIndex((item) => item.key === SKILL_ORCHESTRATION_SETTING_KEY)
  const setting = createWorkspaceSetting({
    ...(existingIndex >= 0 ? store.settings[existingIndex] : {}),
    key: SKILL_ORCHESTRATION_SETTING_KEY,
    value,
    group: 'skill-orchestration',
    status: value.enabled ? 'active' : 'inactive',
    sensitive: false,
    description: '后端 Skill 编排策略配置，用于覆盖系统 Skill 的提示词、输出 Schema、质量检查和 fallback。',
    updatedAt: now
  })
  if (existingIndex >= 0) store.settings.splice(existingIndex, 1, setting)
  else store.settings.unshift(setting)
  await persistStore(store)
  return skillOrchestrationSettingsView(store)
}

export function listMaterials(store, payload = {}) {
  const projectId = payload.projectId || ''
  const type = payload.type || ''
  return store.materials
    .filter((item) => !projectId || item.projectId === projectId)
    .filter((item) => !type || item.type === type)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export function listGeneratedKnowledge(store, payload = {}) {
  const projectId = payload.projectId || ''
  return store.generatedKnowledge
    .filter((item) => !projectId || item.projectId === projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

function tokenizeQuery(value = '') {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
}

function textScore(text = '', tokens = []) {
  const lower = String(text || '').toLowerCase()
  return tokens.reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0)
}

function materialChunks(material = {}) {
  if (Array.isArray(material.chunks) && material.chunks.length) return material.chunks
  return [{
    id: `${material.id || 'material'}-content`,
    heading: material.title || '资料内容',
    text: material.content || material.notes || material.meta || '',
    roleScopes: material.roleScopes || []
  }]
}

function pushKnowledgeSearchResults(results, items = [], payload = {}, source = 'material') {
  const roleScope = payload.roleScope || ''
  const tokens = tokenizeQuery(payload.query || '')
  items.forEach((item) => {
    const itemRoleScopes = Array.isArray(item.roleScopes) ? item.roleScopes : []
    if (roleScope && roleScope !== 'all' && !itemRoleScopes.includes(roleScope)) return
    materialChunks(item).forEach((chunk) => {
      const chunkRoleScopes = Array.isArray(chunk.roleScopes) && chunk.roleScopes.length ? chunk.roleScopes : itemRoleScopes
      if (roleScope && roleScope !== 'all' && !chunkRoleScopes.includes(roleScope)) return
      const haystack = [
        item.title,
        item.summary,
        item.meta,
        item.content,
        JSON.stringify(item.entities || {}),
        chunk.heading,
        chunk.text
      ].join(' ')
      const score = tokens.length ? textScore(haystack, tokens) : 1
      if (score <= 0) return
      results.push({
        materialId: item.id,
        generatedKnowledgeId: source === 'generated' ? item.id : '',
        backendKnowledgeId: source === 'backend' ? item.id : '',
        title: item.title,
        category: item.category || '',
        sourceType: item.sourceType || (source === 'generated' ? 'generated-knowledge' : source === 'backend' ? 'backend-route' : ''),
        sourceUrl: item.sourceUrl || '',
        roleScopes: chunkRoleScopes,
        score,
        priority: source === 'generated' ? 3 : source === 'material' ? 2 : 1,
        snippet: chunk.text || item.content || item.summary || '',
        chunk,
        evidence: Array.isArray(item.evidence) ? item.evidence : [],
        verification: item.verification || { status: item.verifiedStatus || (source === 'generated' ? 'verified' : 'unverified') },
        knowledgeSource: source,
        fallback: source === 'backend'
      })
    })
  })
}

export function searchMaterials(store, payload = {}) {
  const projectId = payload.projectId || ''
  const type = payload.type || 'knowledge'
  const limit = Math.max(1, Math.min(20, Number(payload.limit) || 8))
  const generated = listGeneratedKnowledge(store, { projectId })
  const materials = listMaterials(store, { projectId, type })
  const results = []
  const backendResults = []

  pushKnowledgeSearchResults(results, generated, payload, 'generated')
  pushKnowledgeSearchResults(results, materials, payload, 'material')
  pushKnowledgeSearchResults(backendResults, store.backendKnowledge, payload, 'backend')

  const primaryResults = results
    .sort((a, b) => b.priority - a.priority || b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
  if (primaryResults.length) return primaryResults
  return backendResults
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export async function addGeneratedKnowledge(store, payload = {}) {
  const item = createWorkspaceGeneratedKnowledge({
    ...payload,
    userId: payload.userId || payload.ownerUserId || store.currentUserId,
    projectId: payload.projectId || store.currentProjectId
  })
  const index = store.generatedKnowledge.findIndex((current) => current.id === item.id)
  if (index >= 0) store.generatedKnowledge.splice(index, 1, item)
  else store.generatedKnowledge.unshift(item)
  await persistStore(store)
  return item
}

export async function governMaterials(store, payload = {}) {
  const ids = Array.isArray(payload.ids) ? payload.ids : []
  const now = new Date().toISOString()
  const materials = []
  ids.forEach((id) => {
    const index = store.materials.findIndex((item) => item.id === id)
    if (index < 0) return
    const current = store.materials[index]
    const verificationStatus = payload.verificationStatus || (payload.action === 'verify' ? 'verified' : current.verification?.status || 'unverified')
    const material = createWorkspaceMaterial({
      ...current,
      owner: payload.owner || current.owner || '',
      verification: {
        ...(current.verification || {}),
        status: verificationStatus,
        reason: payload.reason || current.verification?.reason || '',
        updatedAt: now
      },
      updatedAt: now
    })
    store.materials.splice(index, 1, material)
    materials.push(material)
  })
  await persistStore(store)
  return {
    updated: materials.length,
    materials
  }
}

function roleScopeLabel(roleScope = '') {
  const labels = {
    product: '产品',
    ux: 'UX',
    development: '开发',
    'ai-retrieval': 'AI 检索',
    all: '全部'
  }
  return labels[roleScope] || roleScope || '全部'
}

function evidenceLines(evidence = []) {
  return evidence.length
    ? evidence.map((item) => `- ${item.title || '来源'}：${item.url || item.text || '暂无链接'}`).join('\n')
    : '- 暂无来源证据'
}

export function exportRoleKnowledgePackage(store, payload = {}) {
  const projectId = payload.projectId || ''
  const roleScope = payload.roleScope || 'all'
  const label = roleScopeLabel(roleScope)
  const items = listMaterials(store, { projectId, type: 'knowledge' })
    .filter((item) => roleScope === 'all' || (item.roleScopes || []).includes(roleScope))
  const markdown = [
    `# ${projectId || 'project'} ${label}知识包`,
    '',
    `导出范围：${label}`,
    `资料数量：${items.length}`,
    '',
    ...items.flatMap((item, index) => [
      `## ${index + 1}. ${item.title}`,
      '',
      `- 类型：${item.category || item.meta || 'knowledge'}`,
      `- Owner：${item.owner || '未设置'}`,
      `- 可信状态：${item.verification?.status || 'unverified'}`,
      `- 来源：${item.sourceUrl || item.sourceType || '手动资料'}`,
      '',
      item.content || item.notes || '暂无正文',
      '',
      '### 片段',
      ...(Array.isArray(item.chunks) && item.chunks.length
        ? item.chunks.map((chunk) => `- ${chunk.heading || chunk.id || '片段'}：${chunk.text || ''}`)
        : ['- 暂无片段']),
      '',
      '### 证据',
      evidenceLines(item.evidence),
      ''
    ])
  ].join('\n')
  return {
    fileName: `${projectId || 'project'}-${roleScope}-knowledge-package.md`,
    markdown,
    json: {
      projectId,
      roleScope,
      items
    }
  }
}

export async function updateMaterial(store, id = '', patch = {}) {
  const current = store.materials.find((item) => item.id === id)
  if (!current) {
    const error = new Error('资料不存在')
    error.code = 'MATERIAL_NOT_FOUND'
    throw error
  }
  const material = createWorkspaceMaterial({
    ...current,
    ...patch,
    id: current.id,
    projectId: patch.projectId || current.projectId,
    type: patch.type || current.type,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  })
  const index = store.materials.findIndex((item) => item.id === id)
  store.materials.splice(index, 1, material)
  await persistStore(store)
  return material
}

export async function deleteMaterial(store, id = '') {
  const before = store.materials.length
  store.materials = store.materials.filter((item) => item.id !== id)
  await persistStore(store)
  return { id, deleted: store.materials.length < before }
}

export async function deleteRestoredPage(store, id = '') {
  const before = store.restoredPages.length
  store.restoredPages = store.restoredPages.filter((item) => (
    item.id !== id &&
    item.clientTaskId !== id &&
    item.captureResult?.taskId !== id
  ))
  await persistStore(store)
  return { id, deleted: store.restoredPages.length < before }
}

export async function deleteWorkflowRun(store, id = '') {
  const before = store.workflowRuns.length
  store.workflowRuns = store.workflowRuns.filter((item) => item.id !== id)
  await persistStore(store)
  return { id, deleted: store.workflowRuns.length < before }
}

export async function addRestoredPage(store, payload = {}) {
  const restoredPage = createWorkspaceRestoredPage(payload)
  const index = store.restoredPages.findIndex((item) => item.id === restoredPage.id)
  if (index >= 0) store.restoredPages.splice(index, 1, restoredPage)
  else store.restoredPages.unshift(restoredPage)
  await persistStore(store)
  return restoredPage
}

export function getRestoredPage(store, id = '') {
  // Temporary image-to-HTML preview ids must resolve to the final restored page after persistence.
  const restoredPage = store.restoredPages.find((item) => item.id === id || item.clientTaskId === id || item.captureResult?.taskId === id)
  if (!restoredPage) {
    const error = new Error('还原页面不存在')
    error.code = 'RESTORED_PAGE_NOT_FOUND'
    throw error
  }
  return createWorkspaceRestoredPage(restoredPage)
}

export function restoredPagePreview(store, id = '') {
  const restoredPage = getRestoredPage(store, id)
  return {
    id: restoredPage.id,
    title: restoredPage.title,
    html: restoredPage.html || restoredPage.files.find((file) => file.path === 'index.html')?.content || '',
    sourceUrl: restoredPage.sourceUrl,
    coverImage: restoredPage.coverImage,
    visualVerification: restoredPage.visualVerification,
    previewUrl: restoredPage.previewUrl,
    frameUrl: restoredPage.frameUrl,
    sourceUrlPath: restoredPage.sourceUrlPath,
    downloadUrl: restoredPage.downloadUrl
  }
}

export function restoredPageFrame(store, id = '') {
  const restoredPage = restoredPagePreview(store, id)
  return {
    contentType: 'text/html; charset=utf-8',
    body: restoredPage.html || '<!doctype html><html lang="zh-CN"><body></body></html>'
  }
}

export function restoredPageSource(store, id = '') {
  const restoredPage = getRestoredPage(store, id)
  const files = Array.isArray(restoredPage.files) && restoredPage.files.length
    ? restoredPage.files
    : [{ path: 'index.html', content: restoredPage.html || '' }]
  return {
    id: restoredPage.id,
    title: restoredPage.title,
    codeFormat: restoredPage.codeFormat,
    files,
    downloadUrl: restoredPage.downloadUrl
  }
}

export async function upsertWorkflowRun(store, payload = {}) {
  const incomingRun = createWorkspaceWorkflowRun({
    ...payload,
    updatedAt: new Date().toISOString()
  })
  const index = store.workflowRuns.findIndex((item) => item.id === incomingRun.id)
  const existing = index >= 0 ? createWorkspaceWorkflowRun(store.workflowRuns[index]) : null
  const incomingReportStatus = String(
    incomingRun.documentAnalysis?.advancedUxReport?.status ||
    incomingRun.documentAnalysis?.totalDesignFlow?.advancedUxReport?.status ||
    ''
  ).trim()
  const incomingAdvancedUxStageStatus = String(
    incomingRun.documentAnalysis?.advancedUxReport?.pageInteractionDocument?.status ||
    incomingRun.documentAnalysis?.totalDesignFlow?.advancedUxReport?.pageInteractionDocument?.status ||
    incomingRun.documentAnalysis?.totalDesignFlow?.pageInteractionDocumentArtifact?.status ||
    ''
  ).trim()
  const existingAdvancedUxStageStatus = String(
    existing?.documentAnalysis?.advancedUxReport?.pageInteractionDocument?.status ||
    existing?.documentAnalysis?.totalDesignFlow?.advancedUxReport?.pageInteractionDocument?.status ||
    existing?.documentAnalysis?.totalDesignFlow?.pageInteractionDocumentArtifact?.status ||
    ''
  ).trim()
  const isAdvancedUxRetryOverFailedRun =
    existing?.status === 'analyzed' &&
    (payload.status === 'analyzing' || incomingRun.documentAnalysis?.status === 'streaming' || incomingReportStatus === 'generating' || incomingAdvancedUxStageStatus === 'generating') &&
    String(existing.workflowId || existing.skillId || existing.requestedSkillId || '').includes('advanced-ux-requirement-analysis') &&
    (
      ['failed', 'quality_failed', 'import_failed'].includes(String(existing.documentAnalysis?.advancedUxReport?.status || existing.documentAnalysis?.totalDesignFlow?.advancedUxReport?.status || existing.documentAnalysis?.status || '').trim()) ||
      ['failed', 'quality_failed', 'import_failed'].includes(existingAdvancedUxStageStatus)
    )
  const isStaleProgressOverFinal = existing?.status === 'analyzed' && incomingRun.status !== 'analyzed' && !isAdvancedUxRetryOverFailedRun
  const run = isStaleProgressOverFinal
    ? createWorkspaceWorkflowRun({
        ...existing,
        ...incomingRun,
        status: existing.status,
        documentAnalysis: existing.documentAnalysis || incomingRun.documentAnalysis || null,
        projectBlueprint: existing.projectBlueprint || incomingRun.projectBlueprint || null,
        agentSessions: existing.agentSessions || incomingRun.agentSessions || {},
        referenceFiles: existing.referenceFiles || incomingRun.referenceFiles || {},
        updatedAt: existing.updatedAt || incomingRun.updatedAt
      })
    : incomingRun
  if (index >= 0) store.workflowRuns.splice(index, 1, run)
  else store.workflowRuns.unshift(run)
  await persistStore(store)
  return run
}

export function getWorkflowRun(store, id = '') {
  const run = store.workflowRuns.find((item) => item.id === id)
  if (!run) {
    const error = new Error('流程运行不存在')
    error.code = 'WORKFLOW_RUN_NOT_FOUND'
    throw error
  }
  return createWorkspaceWorkflowRun(run)
}

export async function updateWorkflowRun(store, id, updater) {
  const current = store.workflowRuns.find((item) => item.id === id)
  if (!current) {
    const error = new Error('流程运行不存在')
    error.code = 'WORKFLOW_RUN_NOT_FOUND'
    throw error
  }
  const next = typeof updater === 'function' ? updater(current) : { ...current, ...(updater || {}) }
  return await upsertWorkflowRun(store, next)
}

const COLLECTION_CREATORS = {
  projects: createWorkspaceProject,
  materials: createWorkspaceMaterial,
  generatedKnowledge: createWorkspaceGeneratedKnowledge,
  parseJobs: createWorkspaceParseJob,
  assets: createWorkspaceAsset,
  restoredPages: createWorkspaceRestoredPage,
  competitors: createWorkspaceCompetitor,
  workflowRuns: createWorkspaceWorkflowRun,
  skillRuns: createWorkspaceRun,
  skills: createWorkspaceSkill,
  settings: createWorkspaceSetting,
  competitorAuditLogs: createWorkspaceCompetitorAuditLog
}

function collectionItems(store, collection = '') {
  if (!Object.hasOwn(COLLECTION_CREATORS, collection)) {
    const error = new Error('不支持的后台数据集合')
    error.code = 'ADMIN_COLLECTION_NOT_SUPPORTED'
    throw error
  }
  return store[collection]
}

export function listAdminRecords(store, collection = '') {
  return collectionItems(store, collection)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

export async function createAdminRecord(store, collection = '', payload = {}) {
  const creator = COLLECTION_CREATORS[collection]
  if (!creator) return collectionItems(store, collection)
  const record = creator(payload)
  store[collection].unshift(record)
  await persistStore(store)
  return record
}

export async function updateAdminRecord(store, collection = '', id = '', patch = {}) {
  const items = collectionItems(store, collection)
  const current = items.find((item) => item.id === id)
  if (!current) {
    const error = new Error('后台记录不存在')
    error.code = 'ADMIN_RECORD_NOT_FOUND'
    throw error
  }
  const creator = COLLECTION_CREATORS[collection]
  const next = creator({
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  })
  const index = items.findIndex((item) => item.id === id)
  items.splice(index, 1, next)
  await persistStore(store)
  return next
}

export async function deleteAdminRecord(store, collection = '', id = '') {
  const items = collectionItems(store, collection)
  const before = items.length
  store[collection] = items.filter((item) => item.id !== id)
  await persistStore(store)
  return { collection, id, deleted: store[collection].length < before }
}

export async function deleteAdminRecords(store, collection = '', ids = []) {
  const items = collectionItems(store, collection)
  const idSet = new Set(Array.isArray(ids) ? ids.filter(Boolean) : [])
  const before = items.length
  store[collection] = items.filter((item) => !idSet.has(item.id))
  await persistStore(store)
  return {
    collection,
    ids: [...idSet],
    deleted: before - store[collection].length
  }
}
