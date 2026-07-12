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
    passwordHash: input.passwordHash || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function publicWorkspaceUser(user = {}) {
  return {
    id: user.id || '',
    name: user.name || '流程通用户',
    email: user.email || '',
    avatar: user.avatar || '流',
    role: user.role || 'owner',
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || ''
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
    members: Array.isArray(input.members) ? input.members : [],
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
  const chunks = Array.isArray(input.chunks) ? input.chunks : []
  const chunkContent = chunks
    .map((chunk) => String(chunk?.text || chunk?.content || '').trim())
    .filter(Boolean)
    .join('\n\n')
  const preview = input.preview && typeof input.preview === 'object'
    ? {
        format: input.preview.format || '',
        fileName: input.preview.fileName || input.title || '',
        mimeType: input.preview.mimeType || '',
        dataUrl: input.preview.dataUrl || '',
        url: input.preview.url || '',
        storage: input.preview.storage || '',
        storageDataUrl: input.preview.storageDataUrl || ''
      }
    : null
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
    content: input.content || chunkContent || '',
    preview,
    requirementSource: input.requirementSource || '',
    knowledgeStatus: input.knowledgeStatus || '',
    uploadedAt: input.uploadedAt || input.createdAt || now,
    depositedAt: input.depositedAt || '',
    knowledgeMaterialId: input.knowledgeMaterialId || '',
    category: input.category || '',
    sourceType: input.sourceType || '',
    sourceUrl: input.sourceUrl || '',
    sourceAssetId: input.sourceAssetId || '',
    // Keep deposit provenance even when the source requirement is later deleted.
    sourceMaterialId: input.sourceMaterialId || '',
    parsed: input.parsed || null,
    entities: input.entities || null,
    roleScopes: Array.isArray(input.roleScopes) ? input.roleScopes : [],
    owner: input.owner || '',
    verification: input.verification || { status: 'unverified' },
    expiresAt: input.expiresAt || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    relations: Array.isArray(input.relations) ? input.relations : [],
    chunks,
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
    clientTaskId: input.clientTaskId || input.captureResult?.taskId || '',
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

export function createWorkspaceCompetitor(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `competitor-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    name: input.name || '未命名竞品',
    websiteUrl: input.websiteUrl || input.meta || '',
    status: input.status || 'active',
    notes: input.notes || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    lastCheckedAt: input.lastCheckedAt || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceMonitorTask(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `monitor-task-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    competitorId: input.competitorId || '',
    url: input.url || '',
    pageType: input.pageType || 'Homepage',
    frequency: input.frequency || 'weekly',
    status: input.status || 'active',
    lastRunAt: input.lastRunAt || '',
    nextRunAt: input.nextRunAt || '',
    lastError: input.lastError || '',
    failureType: input.failureType || '',
    recoverySuggestion: input.recoverySuggestion || '',
    failureHistory: Array.isArray(input.failureHistory) ? input.failureHistory : [],
    runHistory: Array.isArray(input.runHistory) ? input.runHistory : [],
    retrySummary: input.retrySummary && typeof input.retrySummary === 'object' && !Array.isArray(input.retrySummary)
      ? input.retrySummary
      : { failureCount: 0, nextRetryAt: '', backoffSeconds: 0, failureType: '', recoverySuggestion: '' },
    notification: input.notification && typeof input.notification === 'object' && !Array.isArray(input.notification)
      ? input.notification
      : { enabled: false, channels: ['in-app'], recipients: [], updatedAt: '' },
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspacePageSnapshot(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `page-snapshot-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    competitorId: input.competitorId || '',
    taskId: input.taskId || '',
    url: input.url || '',
    title: input.title || '',
    textContent: input.textContent || '',
    screenshotUrl: input.screenshotUrl || '',
    status: input.status || 'succeeded',
    capturedAt: input.capturedAt || now,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceChangeRecord(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `change-record-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    competitorId: input.competitorId || '',
    taskId: input.taskId || '',
    oldSnapshotId: input.oldSnapshotId || '',
    newSnapshotId: input.newSnapshotId || '',
    changeType: input.changeType || 'content-update',
    changeSummary: input.changeSummary || '',
    diffText: input.diffText || '',
    severity: input.severity || 'medium',
    status: input.status || 'ready',
    failureType: input.failureType || '',
    recoverySuggestion: input.recoverySuggestion || '',
    detectedAt: input.detectedAt || now,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceAiAnalysis(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `ai-analysis-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    competitorId: input.competitorId || '',
    changeId: input.changeId || '',
    factualObservation: input.factualObservation || '',
    interpretation: input.interpretation || '',
    productImpact: input.productImpact || '',
    uxImpact: input.uxImpact || '',
    uiImpact: input.uiImpact || '',
    recommendation: input.recommendation || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    severitySuggestion: input.severitySuggestion || 'medium',
    analysisProvider: input.analysisProvider || '',
    analysisModel: input.analysisModel || '',
    analysisDurationMs: Number.isFinite(Number(input.analysisDurationMs)) ? Number(input.analysisDurationMs) : 0,
    analysisTokenUsage: input.analysisTokenUsage && typeof input.analysisTokenUsage === 'object' && !Array.isArray(input.analysisTokenUsage)
      ? {
          input: Number(input.analysisTokenUsage.input) || 0,
          output: Number(input.analysisTokenUsage.output) || 0,
          total: Number(input.analysisTokenUsage.total) || 0
        }
      : { input: 0, output: 0, total: 0 },
    analysisFallbackUsed: Boolean(input.analysisFallbackUsed),
    analysisFallbackReason: input.analysisFallbackReason || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceCompetitorInsight(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `competitor-insight-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    competitorId: input.competitorId || '',
    changeId: input.changeId || '',
    reportId: input.reportId || '',
    knowledgeMaterialId: input.knowledgeMaterialId || '',
    requirementMaterialIds: Array.isArray(input.requirementMaterialIds) ? input.requirementMaterialIds : [],
    category: input.category || 'product',
    title: input.title || '未命名竞品洞察',
    summary: input.summary || '',
    recommendation: input.recommendation || '',
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    priority: input.priority || 'medium',
    status: input.status || 'saved',
    note: input.note || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceCompetitorReport(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `competitor-report-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    competitorId: input.competitorId || '',
    changeId: input.changeId || '',
    sourceDraftId: input.sourceDraftId || '',
    title: input.title || '未命名竞品报告',
    status: input.status || 'ready',
    summary: input.summary || '',
    factualObservation: input.factualObservation || '',
    productImpact: input.productImpact || '',
    uxImpact: input.uxImpact || '',
    uiImpact: input.uiImpact || '',
    recommendation: input.recommendation || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    severity: input.severity || 'medium',
    sourceSnapshotId: input.sourceSnapshotId || '',
    sourceUrl: input.sourceUrl || '',
    sections: Array.isArray(input.sections) ? input.sections : [],
    reportVersions: Array.isArray(input.reportVersions) ? input.reportVersions : [],
    shareEnabled: Boolean(input.shareEnabled),
    shareToken: input.shareToken || '',
    shareUrl: input.shareUrl || '',
    shareAllowDownload: Boolean(input.shareAllowDownload),
    sharedAt: input.sharedAt || '',
    shareExpiresAt: input.shareExpiresAt || '',
    shareRevokedAt: input.shareRevokedAt || '',
    shareAccessCount: Number(input.shareAccessCount) || 0,
    lastSharedAccessAt: input.lastSharedAccessAt || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceCompetitorAuditLog(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `competitor-audit-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    originProjectId: input.originProjectId || '',
    module: input.module || 'competitors',
    actorUserId: input.actorUserId || '',
    actorName: input.actorName || '流程通用户',
    action: input.action || '',
    summary: input.summary || '',
    targetType: input.targetType || '',
    targetId: input.targetId || '',
    targetTitle: input.targetTitle || '',
    meta: input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta) ? input.meta : {},
    createdAt: input.createdAt || now
  }
}

export function createWorkspaceWorkflowRun(input = {}) {
  const now = nowIso()
  const isNonProjectScope = input.demandScope === 'non-project'
  const analysisNodes = Array.isArray(input.documentAnalysis?.canvas?.nodes) ? input.documentAnalysis.canvas.nodes : []
  const advancedUxReport = input.documentAnalysis?.totalDesignFlow?.advancedUxReport || {}
  const hasPendingAdvancedUxMarkdownGeneration =
    advancedUxReport.status === 'generating' &&
    !String(advancedUxReport.markdown || '').trim()
  const hasCompletedAnalysisCanvas = analysisNodes.some((node) =>
    node &&
    node.loading !== true &&
    node.id !== 'model-generating' &&
    node.id !== `${input.documentAnalysis?.totalDesignFlow?.currentStage || ''}-loading`
  )
  const hasPersistedModelReply = Object.values(input.agentSessions || {}).some((session) =>
    Array.isArray(session) &&
    session.some((message) =>
      message?.role === 'assistant' &&
      message?.meta?.source === 'model' &&
      !message?.meta?.transient &&
      String(message?.content || '').trim()
    )
  )
  const status = (
    !hasPendingAdvancedUxMarkdownGeneration &&
    (
      (input.status === 'running' && hasCompletedAnalysisCanvas) ||
      (input.status === 'analyzing' && hasCompletedAnalysisCanvas)
    )
  )
    ? 'analyzed'
    : (input.status || 'running')
  return {
    ...input,
    id: input.id || `workflow-run-${randomUUID()}`,
    projectId: isNonProjectScope ? '' : (input.projectId || 'project-flow'),
    originProjectId: input.originProjectId || '',
    module: input.module || 'design',
    workflowId: input.workflowId || '',
    workflowName: input.workflowName || '未命名流程',
    status,
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
    competitors: [],
    monitorTasks: [],
    pageSnapshots: [],
    changeRecords: [],
    aiAnalyses: [],
    workflowRuns: [],
    skills: [],
    settings: []
  }
}
