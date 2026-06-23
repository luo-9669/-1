import { randomUUID } from 'node:crypto'

export function nowIso() {
  return new Date().toISOString()
}

export const DEFAULT_USER_ID = 'user-local-default'
export const DEFAULT_PROJECT_OWNER_ID = DEFAULT_USER_ID

export function createWorkspaceUser(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `user-${randomUUID()}`,
    name: input.name || '流程通用户',
    email: input.email || 'local@liuchengtong.test',
    avatar: input.avatar || '流',
    role: input.role || 'owner',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceProject(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `project-${randomUUID()}`,
    ownerUserId: input.ownerUserId || DEFAULT_PROJECT_OWNER_ID,
    name: input.name || '未命名项目',
    description: input.description || '',
    domain: input.domain || '',
    targetUsers: input.targetUsers || '',
    stage: input.stage || 'discovery',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceAsset(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `asset-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'assets',
    title: input.title || '未命名资产',
    meta: input.meta || '',
    status: input.status || '已保存',
    type: input.type || 'asset',
    workflowId: input.workflowId || '',
    skillId: input.skillId || '',
    runId: input.runId || '',
    content: input.content || '',
    blueprint: input.blueprint || null,
    prototypeDemo: input.prototypeDemo || null,
    screenshotAssets: Array.isArray(input.screenshotAssets) ? input.screenshotAssets : [],
    sourceAssetId: input.sourceAssetId || '',
    sourceUrl: input.sourceUrl || '',
    versions: Array.isArray(input.versions) ? input.versions : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceRun(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `run-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'skills',
    title: input.title || '未命名运行记录',
    meta: input.meta || '',
    status: input.status || '草稿',
    workflowId: input.workflowId || '',
    skillId: input.skillId || '',
    content: input.content || '',
    finalConclusion: input.finalConclusion || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceMaterial(input = {}) {
  const now = nowIso()
  const type = input.type || 'knowledge'
  return {
    id: input.id || `material-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || (type === 'requirements' ? 'requirements' : type === 'competitors' ? 'competitors' : 'knowledge'),
    type,
    title: input.title || '未命名资料',
    meta: input.meta || '',
    status: input.status || '已保存',
    notes: input.notes || '',
    content: input.content || '',
    requirementSource: input.requirementSource || '',
    knowledgeStatus: input.knowledgeStatus || '',
    uploadedAt: input.uploadedAt || input.createdAt || now,
    depositedAt: input.depositedAt || '',
    knowledgeMaterialId: input.knowledgeMaterialId || '',
    category: input.category || '',
    sourceType: input.sourceType || '',
    sourceUrl: input.sourceUrl || '',
    sourceAssetId: input.sourceAssetId || '',
    parsed: input.parsed || null,
    entities: input.entities || null,
    roleScopes: Array.isArray(input.roleScopes) ? input.roleScopes : [],
    owner: input.owner || '',
    verification: input.verification || { status: 'unverified' },
    expiresAt: input.expiresAt || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    relations: Array.isArray(input.relations) ? input.relations : [],
    chunks: Array.isArray(input.chunks) ? input.chunks : [],
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceGeneratedKnowledge(input = {}) {
  const now = nowIso()
  const content = input.content || input.summary || input.notes || ''
  return {
    id: input.id || `generated-knowledge-${randomUUID()}`,
    userId: input.userId || input.ownerUserId || '',
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'knowledge',
    sourceRunId: input.sourceRunId || '',
    sourceSkillId: input.sourceSkillId || input.skillId || '',
    sourceMessageId: input.sourceMessageId || '',
    title: input.title || '未命名沉淀知识',
    summary: input.summary || String(content).replace(/\s+/g, ' ').slice(0, 180),
    content,
    tags: Array.isArray(input.tags) ? input.tags : [],
    roleScopes: Array.isArray(input.roleScopes) ? input.roleScopes : ['product', 'ux', 'development', 'ai-retrieval'],
    confidence: Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 1,
    verifiedStatus: input.verifiedStatus || input.status || 'verified',
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    chunks: Array.isArray(input.chunks) && input.chunks.length
      ? input.chunks
      : [{
          id: `${input.id || 'generated'}-content`,
          heading: input.title || '沉淀知识',
          text: content,
          roleScopes: Array.isArray(input.roleScopes) ? input.roleScopes : ['product', 'ux', 'development', 'ai-retrieval']
        }],
    knowledgeSource: 'generated',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceBackendKnowledge(input = {}) {
  const now = nowIso()
  const content = input.content || input.summary || ''
  return {
    id: input.id || `backend-knowledge-${randomUUID()}`,
    title: input.title || '后端备份知识',
    content,
    category: input.category || 'backend-fallback',
    sourceType: input.sourceType || 'backend-route',
    roleScopes: Array.isArray(input.roleScopes) ? input.roleScopes : ['ai-retrieval'],
    chunks: Array.isArray(input.chunks) && input.chunks.length
      ? input.chunks
      : [{
          id: `${input.id || 'backend'}-content`,
          heading: input.title || '后端备份知识',
          text: content,
          roleScopes: Array.isArray(input.roleScopes) ? input.roleScopes : ['ai-retrieval']
        }],
    knowledgeSource: 'backend',
    fallback: true,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceParseJob(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `parse-job-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'knowledge',
    sourceType: input.sourceType || 'unknown',
    sourceUrl: input.sourceUrl || '',
    action: input.action || 'parse',
    status: input.status || 'pending',
    materialCount: Number(input.materialCount) || 0,
    durationMs: Number(input.durationMs) || 0,
    error: input.error || '',
    summary: input.summary || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceRestoredPage(input = {}) {
  const now = nowIso()
  const id = input.id || `restored-${randomUUID()}`
  return {
    id,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'factory',
    restoreKind: input.restoreKind || input.captureResult?.raw?.captureKind || 'image-to-code',
    tags: Array.isArray(input.tags) ? input.tags : [],
    codeFormat: input.codeFormat || (Array.isArray(input.files) && input.files.some((file) => file.path === 'src/App.vue') ? 'vue' : 'html'),
    title: input.title || '未命名还原页面',
    sourceUrl: input.sourceUrl || '',
    html: input.html || '',
    files: Array.isArray(input.files) ? input.files : [],
    coverImage: input.coverImage || '',
    visualVerification: input.visualVerification || null,
    captureResult: input.captureResult || null,
    previewUrl: `/api/workspace/restored-pages/${encodeURIComponent(id)}/preview`,
    frameUrl: `/api/workspace/restored-pages/${encodeURIComponent(id)}/frame`,
    sourceUrlPath: `/api/workspace/restored-pages/${encodeURIComponent(id)}/source`,
    downloadUrl: `/api/workspace/restored-pages/${encodeURIComponent(id)}/download`,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceWorkflowRun(input = {}) {
  const now = nowIso()
  return {
    ...input,
    id: input.id || `workflow-run-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'design',
    workflowId: input.workflowId || '',
    workflowName: input.workflowName || '未命名流程',
    status: input.status || 'running',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceSkill(input = {}) {
  const now = nowIso()
  const visibility = input.visibility || 'global'
  return {
    id: input.id || `skill-${randomUUID()}`,
    projectId: visibility === 'global' ? '' : (input.projectId || ''),
    originProjectId: input.originProjectId || '',
    module: input.module || 'skills',
    name: input.name || '未命名 Skill',
    category: input.category || '自定义',
    source: input.source || 'user',
    visibility,
    status: input.status || 'draft',
    description: input.description || '',
    content: input.content || '',
    inputFields: Array.isArray(input.inputFields) ? input.inputFields : [],
    knowledgeScopeConfig: input.knowledgeScopeConfig || {
      mode: 'current-project',
      projectIds: [],
      itemIds: [],
      sourceTypes: ['knowledge', 'requirements', 'competitors', 'assets']
    },
    applicableScenarios: Array.isArray(input.applicableScenarios) ? input.applicableScenarios : [],
    nonApplicableScenarios: Array.isArray(input.nonApplicableScenarios) ? input.nonApplicableScenarios : [],
    requiredInputs: Array.isArray(input.requiredInputs) ? input.requiredInputs : [],
    knowledgeScopes: Array.isArray(input.knowledgeScopes) ? input.knowledgeScopes : [],
    steps: Array.isArray(input.steps) ? input.steps : [],
    followUpRules: Array.isArray(input.followUpRules) ? input.followUpRules : [],
    outputFormat: input.outputFormat || '',
    qualityChecks: Array.isArray(input.qualityChecks) ? input.qualityChecks : [],
    exampleInput: input.exampleInput || '',
    exampleOutput: input.exampleOutput || '',
    markdown: input.markdown || '',
    sourceUrl: input.sourceUrl || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceSetting(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `setting-${randomUUID()}`,
    key: input.key || 'unnamed',
    value: input.value || '',
    group: input.group || 'general',
    status: input.status || 'active',
    description: input.description || '',
    sensitive: Boolean(input.sensitive),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createDefaultWorkspaceStore() {
  const now = nowIso()
  const defaultUser = createWorkspaceUser({
    id: DEFAULT_USER_ID,
    name: '流程通用户',
    email: 'local@liuchengtong.test',
    avatar: '流',
    createdAt: now,
    updatedAt: now
  })
  return {
    currentUserId: defaultUser.id,
    currentProjectId: 'project-flow',
    users: [defaultUser],
    projects: [
      {
        id: 'project-flow',
        ownerUserId: defaultUser.id,
        name: '流程通默认项目',
        description: '本地默认项目，用于承接旧数据和快速试用。',
        stage: 'design',
        createdAt: now,
        updatedAt: now
      }
    ],
    assets: [],
    skillRuns: [],
    materials: [],
    restoredPages: [],
    workflowRuns: [],
    skills: [],
    settings: []
  }
}
