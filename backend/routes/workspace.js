export { createWorkspaceStore } from '../services/workspace-store.js'

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addAsset,
  addGeneratedKnowledge,
  addMaterial,
  addModelCallLog,
  addParseJob,
  addProject,
  addRestoredPage,
  addRun,
  addSkill,
  deleteAsset,
  deleteMaterial,
  deleteRestoredPage,
  deleteWorkflowRun,
  exportRoleKnowledgePackage,
  getModelSettingsRaw,
  getMaterial,
  getRestoredPage,
  getWorkflowRun,
  governMaterials,
  listGeneratedKnowledge,
  listMaterials,
  listModelCallLogs,
  listParseJobs,
  modelSettingsView,
  restoredPagePreview,
  restoredPageFrame,
  restoredPageSource,
  searchMaterials,
  saveWorkspaceContext,
  skillOrchestrationSettingsView,
  saveModelSettings,
  saveSkillOrchestrationSettings,
  updateMaterial,
  updateParseJob,
  updateSkill,
  updateWorkflowRun,
  upsertWorkflowRun,
  workspaceSnapshot
} from '../services/workspace-store.js'
import { workflowRoutes } from './workflows.js'
import { repairAnalysisResult } from '../services/analysis-repair.js'
import { analyzeRequirementDocumentsWithGeneration } from '../services/document-parser.js'
import {
  buildTotalDesignFlow,
  failAdvancedUxMarkdownGenerationInTotalFlow,
  withDownstreamStageArtifactContext
} from '../services/total-design-flow.js'
import {
  buildPageLayoutArtifactFromSpec,
  buildInteractionSpecArtifactFromPageLayoutArtifact,
  parsePageLayoutArtifactFromText
} from '../services/page-layout-artifact-renderer.js'
import { withWorkflowStageRuntime } from '../services/stage-runtime.js'
import { buildProjectPackageKnowledgeImport } from '../services/project-package-import-service.js'
import { createProjectRuntimeService } from '../services/project-runtime-service.js'
import { createAuthService } from '../services/auth-service.js'
import { blueprintKnowledgeItems, buildProjectBlueprint } from '../../frontend/src/services/projectBlueprint.js'
import { buildWebsiteKnowledgeImport, websiteBlueprintDocumentFromImport } from '../../frontend/src/services/websiteKnowledge.js'
import { createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { safeParseModelJson } from '../services/generation-runner.js'
import { storageRoot } from '../server/server-config.mjs'

const DEFAULT_GENERATED_IMAGE_DIR = join(storageRoot, 'workspace', 'generated-images')
const DEFAULT_MATERIAL_PREVIEW_DIR = join(storageRoot, 'workspace', 'material-previews')

function normalizeDocumentText(document = {}) {
  return String(document.text || document.content || document.markdown || '').trim()
}

function resolveMaterialPreviewDir(options = {}) {
  return options.materialPreviewDir || process.env.WORKSPACE_MATERIAL_PREVIEW_DIR || DEFAULT_MATERIAL_PREVIEW_DIR
}

function materialPreviewFileExtension(preview = {}) {
  const format = String(preview.format || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (format) return format
  const fromName = extname(String(preview.fileName || '')).replace('.', '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName) return fromName
  if (/pdf/i.test(preview.mimeType || '')) return 'pdf'
  return 'bin'
}

function materialPreviewContentType(filePath = '') {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (extension === '.pdf') return 'application/pdf'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

function dataUrlBuffer(dataUrl = '') {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/)
  if (!match) return null
  const [, mimeType = '', base64Flag = '', payload = ''] = match
  return {
    mimeType,
    buffer: base64Flag ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
  }
}

function isImageDataUrl(value = '') {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || ''))
}

function imageExtensionForMimeType(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase()
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('webp')) return 'webp'
  return 'png'
}

function safeAttachmentSegment(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image'
}

function safeDownloadFileName(value = '', fallback = 'document.pdf') {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim() || fallback
}

function markdownPdfFileName(value = '') {
  const safeName = safeDownloadFileName(value || 'Markdown 文档.md', 'Markdown 文档.md')
  return safeName.replace(/\.(md|markdown)$/i, '') + '.pdf'
}

async function persistMaterialPreviewFile(materialId = '', preview = {}, options = {}) {
  if (!materialId || !preview?.dataUrl) return preview || null
  const parsed = dataUrlBuffer(preview.dataUrl)
  if (!parsed?.buffer?.length) return preview
  const extension = materialPreviewFileExtension(preview)
  const directory = resolveMaterialPreviewDir(options)
  await mkdir(directory, { recursive: true })
  const fileName = `${materialId}.${extension}`
  await writeFile(join(directory, fileName), parsed.buffer)
  return {
    format: preview.format || extension,
    fileName: preview.fileName || fileName,
    mimeType: preview.mimeType || parsed.mimeType || 'application/octet-stream',
    url: `/api/workspace/material-previews/${encodeURIComponent(fileName)}`,
    dataUrl: '',
    storage: 'workspace-database',
    storageDataUrl: preview.storageDataUrl || preview.dataUrl
  }
}

async function persistWorkspaceImageAttachment(ownerId = '', itemId = '', dataUrl = '', options = {}) {
  if (!ownerId || !itemId || !isImageDataUrl(dataUrl)) return null
  const parsed = dataUrlBuffer(dataUrl)
  if (!parsed?.buffer?.length || !/^image\//i.test(parsed.mimeType || '')) return null
  const directory = resolveMaterialPreviewDir(options)
  await mkdir(directory, { recursive: true })
  const extension = imageExtensionForMimeType(parsed.mimeType)
  const digest = createHash('sha1')
    .update(parsed.buffer)
    .digest('hex')
    .slice(0, 12)
  const fileName = [
    safeAttachmentSegment(ownerId),
    safeAttachmentSegment(itemId),
    digest
  ].join('-') + `.${extension}`
  await writeFile(join(directory, fileName), parsed.buffer)
  return {
    fileName,
    mimeType: parsed.mimeType || generatedImageContentType(fileName),
    url: `/api/workspace/material-previews/${encodeURIComponent(fileName)}`,
    storage: 'workspace-database',
    storageDataUrl: dataUrl
  }
}

async function persistPrototypeDemoScreenshotAttachments(asset = {}, options = {}) {
  const demo = asset?.prototypeDemo
  if (!demo || typeof demo !== 'object' || Array.isArray(demo)) return asset
  const assetId = asset.id || 'prototype-demo'
  const screenUrlById = new Map()
  const screens = []
  for (const [index, screen] of (Array.isArray(demo.screens) ? demo.screens : []).entries()) {
    const screenId = screen.id || `screen-${index + 1}`
    let screenshotUrl = screen.screenshotUrl || ''
    let screenshotStorage = screen.screenshotStorage || screen.storage || ''
    let storageDataUrl = screen.storageDataUrl || ''
    if (isImageDataUrl(screenshotUrl)) {
      const persistedAttachment = await persistWorkspaceImageAttachment(assetId, screenId, screenshotUrl, options)
      if (persistedAttachment?.url) {
        screenshotUrl = persistedAttachment.url
        screenshotStorage = persistedAttachment.storage
        storageDataUrl = persistedAttachment.storageDataUrl
      }
    }
    if (screenId && screenshotUrl) screenUrlById.set(screenId, screenshotUrl)
    const screenRecord = {
      ...screen,
      screenshotUrl,
      screenshotStorage
    }
    if (storageDataUrl) screenRecord.storageDataUrl = storageDataUrl
    screens.push({
      ...screenRecord
    })
  }
  const screenshotAssets = []
  for (const [index, screenshotAsset] of (Array.isArray(demo.screenshotAssets) ? demo.screenshotAssets : []).entries()) {
    const screenId = screenshotAsset.screenId || screenshotAsset.id || `asset-${index + 1}`
    let screenshotUrl = screenshotAsset.screenshotUrl || screenshotAsset.url || ''
    let storage = screenshotAsset.storage || ''
    let storageDataUrl = screenshotAsset.storageDataUrl || ''
    if (isImageDataUrl(screenshotUrl)) {
      const persistedAttachment = await persistWorkspaceImageAttachment(assetId, screenId, screenshotUrl, options)
      const persistedUrl = screenUrlById.get(screenId) || persistedAttachment?.url
      if (persistedUrl) {
        screenshotUrl = persistedUrl
        storage = persistedAttachment?.storage || 'workspace-database'
        storageDataUrl = persistedAttachment?.storageDataUrl || storageDataUrl
      }
    } else if (screenUrlById.has(screenId)) {
      screenshotUrl = screenUrlById.get(screenId)
      storage = storage === 'local-upload' ? 'workspace-database' : storage
    }
    const screenshotAssetRecord = {
      ...screenshotAsset,
      screenshotUrl,
      storage
    }
    if (storageDataUrl) screenshotAssetRecord.storageDataUrl = storageDataUrl
    screenshotAssets.push(screenshotAssetRecord)
  }
  return {
    ...asset,
    prototypeDemo: {
      ...demo,
      screens,
      screenshotAssets
    },
    screenshotAssets: Array.isArray(asset.screenshotAssets)
      ? asset.screenshotAssets.map((screenshotAsset) => {
          const screenId = screenshotAsset.screenId || screenshotAsset.id || ''
          return screenUrlById.has(screenId)
            ? { ...screenshotAsset, screenshotUrl: screenUrlById.get(screenId), storage: 'workspace-database' }
            : screenshotAsset
        })
      : asset.screenshotAssets
  }
}

function previewResponseFromDataUrl(dataUrl = '', fallbackContentType = 'application/octet-stream') {
  const parsed = dataUrlBuffer(dataUrl)
  if (!parsed?.buffer?.length) return null
  return {
    contentType: parsed.mimeType || fallbackContentType,
    body: parsed.buffer
  }
}

function materialPreviewRecordMatches(record = {}, fileName = '') {
  if (!record || typeof record !== 'object') return false
  const safeName = basename(String(fileName || ''))
  const urlFileName = decodeURIComponent(String(record.url || record.screenshotUrl || '').split('/').pop() || '')
  return safeName && (
    safeName === basename(String(record.fileName || '')) ||
    safeName === basename(urlFileName)
  )
}

function materialPreviewFromWorkspaceRecord(store, fileName = '') {
  for (const material of store.materials || []) {
    const preview = material?.preview
    if (materialPreviewRecordMatches(preview, fileName)) {
      return previewResponseFromDataUrl(preview.storageDataUrl || preview.dataUrl || '', preview.mimeType)
    }
  }
  for (const asset of store.assets || []) {
    const screens = Array.isArray(asset?.prototypeDemo?.screens) ? asset.prototypeDemo.screens : []
    const screenshotAssets = Array.isArray(asset?.prototypeDemo?.screenshotAssets) ? asset.prototypeDemo.screenshotAssets : []
    for (const item of [...screens, ...screenshotAssets, ...(Array.isArray(asset?.screenshotAssets) ? asset.screenshotAssets : [])]) {
      if (materialPreviewRecordMatches(item, fileName)) {
        return previewResponseFromDataUrl(item.storageDataUrl || '', item.mimeType || generatedImageContentType(fileName))
      }
    }
  }
  return null
}

function materialPreviewPath(fileName = '', options = {}) {
  const safeName = basename(String(fileName || ''))
  if (!safeName) return ''
  return join(resolveMaterialPreviewDir(options), safeName)
}

function stableMaterialId(parts = []) {
  const hash = createHash('sha1')
    .update(parts.map((part) => String(part || '')).join('\u001f'))
    .digest('hex')
    .slice(0, 16)
  return `material-${hash}`
}

function normalizedSourcePage(value = '') {
  try {
    const url = new URL(String(value || ''))
    const pathname = url.pathname.replace(/\/$/, '') || '/'
    return `${url.origin}${pathname}`
  } catch {
    return String(value || '').split('?')[0].replace(/\/$/, '') || String(value || '')
  }
}

function normalizePrototypeUrl(value = '', baseUrl = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    return normalizedSourcePage(baseUrl ? new URL(raw, baseUrl).href : raw)
  } catch {
    return normalizedSourcePage(raw)
  }
}

function arrayTextItems(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') return String(item.label || item.title || item.text || item.content || '').trim()
      return ''
    })
    .filter(Boolean)
}

function acceptanceDepositNodesFromAnalysis(analysis = {}) {
  const stageNodes = analysis?.totalDesignFlow?.stageCanvases?.['acceptance-deposit']?.nodes
  const canvasNodes = analysis?.canvas?.nodes
  return [
    ...(Array.isArray(stageNodes) ? stageNodes : []),
    ...(Array.isArray(canvasNodes) ? canvasNodes : [])
  ].filter((node, index, list) =>
    node &&
    (node.detailLayout === 'acceptance-deposit' || node.stageId === 'acceptance-deposit') &&
    list.findIndex((item) => item?.id && item.id === node.id) === index
  )
}

function workflowAcceptanceKnowledgeItems(run = {}, payload = {}) {
  const projectId = payload.projectId || run.projectId || ''
  const sourceRunId = run.id || payload.id || payload.runId || ''
  return acceptanceDepositNodesFromAnalysis(run.documentAnalysis || {})
    .map((node) => {
      const acceptanceChecklist = arrayTextItems(node.acceptanceChecklist)
      const riskItems = arrayTextItems(node.riskItems)
      const knowledgeDeposits = arrayTextItems(node.knowledgeDeposits)
      const content = [
        '# 验收清单',
        ...(acceptanceChecklist.length ? acceptanceChecklist.map((item) => `- ${item}`) : ['- 暂无明确验收项']),
        '',
        '# 风险项',
        ...(riskItems.length ? riskItems.map((item) => `- ${item}`) : ['- 暂无明确风险项']),
        '',
        '# 知识库沉淀内容',
        ...(knowledgeDeposits.length ? knowledgeDeposits.map((item) => `- ${item}`) : ['- 暂无明确沉淀内容'])
      ].join('\n')
      return {
        id: stableMaterialId([projectId, 'workflow-acceptance', sourceRunId, node.id || node.title]),
        projectId,
        type: 'knowledge',
        title: node.title || `${run.title || run.input || '总流程'} 验收沉淀`,
        meta: '验收沉淀',
        status: '待审核',
        content,
        notes: `来自总流程分析：${run.title || run.input || sourceRunId}`,
        category: 'acceptance-deposit',
        sourceMaterialId: sourceRunId,
        sourceType: 'workflow-analysis',
        roleScopes: ['product', 'ux', 'development', 'qa', 'ai-retrieval'],
        evidence: [{
          title: run.title || run.input || '总流程分析',
          text: node.summary || content,
          sourceType: 'workflow-analysis',
          sourceMaterialId: sourceRunId
        }],
        relations: [
          { type: 'workflow-run', targetId: sourceRunId, title: run.title || run.input || sourceRunId },
          { type: 'workflow-node', targetId: node.id || '', title: node.title || '' }
        ],
        verification: {
          status: 'unverified',
          reason: '由总流程验收沉淀阶段自动创建，待人工确认'
        },
        owner: '知识库管理员'
      }
    })
}

function isTotalDesignWorkflowRun(run = {}) {
  return run.workflowId === 'total-design-flow' ||
    run.requestedSkillId === 'total-design-flow' ||
    run.resolvedSkillId === 'total-design-flow' ||
    run.skillId === 'total-design-flow' ||
    run.documentAnalysis?.routing?.requestedSkillId === 'total-design-flow' ||
    run.documentAnalysis?.routing?.resolvedSkillId === 'total-design-flow' ||
    run.documentAnalysis?.routing?.displaySkillName === '总流程' ||
    run.documentAnalysis?.totalDesignFlow?.mode === 'total-design-flow'
}

function textListLength(value = []) {
  return (Array.isArray(value) ? value : [value]).filter(Boolean).length
}

function staleMallWireframeText(value = '') {
  return /门店选择|自提\/外卖|优惠券|热销商品|限时秒杀|点餐/.test(String(value || ''))
}

function podcastShortcutContextText(run = {}) {
  const analysis = run.documentAnalysis || {}
  const documents = Array.isArray(analysis.documents) ? analysis.documents : []
  return [
    run.title,
    run.input,
    analysis.input,
    analysis.blueprint?.title,
    analysis.blueprint?.profile?.productName,
    analysis.blueprint?.profile?.primaryGoal,
    ...(documents.flatMap((document) => [
      document?.name,
      document?.title,
      document?.text,
      document?.content,
      document?.markdown
    ]))
  ].filter(Boolean).join(' ')
}

function hasStalePodcastShortcutMallWireframe(run = {}, interactionNodes = []) {
  const context = podcastShortcutContextText(run)
  if (!/PodcastStep1|Generate Script|Upload Script|Upload Audio|Video Podcast|快捷提示词/i.test(context)) return false
  return interactionNodes.some((node) => {
    const nodeText = [
      node?.title,
      node?.page,
      node?.summary,
      node?.pageLayoutArtifact?.asciiWireframe,
      node?.pageLayoutArtifact?.rawText,
      node?.pageLayoutArtifact?.modelDecision
    ].filter(Boolean).join(' ')
    const hasStaleDesktopTopNav = /顶部固定区：Logo \/ Home \/ Projects|顶部导航：Logo \/ Home|顶部导航：Logo \/ 社媒入口/.test(nodeText)
    return /首页|Home|Video Podcast/i.test(nodeText) &&
      (staleMallWireframeText(nodeText) || hasStaleDesktopTopNav)
  })
}

function isPodcastShortcutHomepageLike(item = {}) {
  const text = [
    item?.id,
    item?.nodeId,
    item?.pageId,
    item?.sourcePageId,
    item?.title,
    item?.page,
    item?.summary,
    item?.route
  ].filter(Boolean).join(' ')
  return /首页|Home|Video Podcast/i.test(text) &&
    !/Studio|登录|注册|Auth|弹窗|Modal|Pricing|设置|账号/i.test(text)
}

function hasDuplicatePodcastShortcutHomepages(run = {}, interactionNodes = []) {
  const context = podcastShortcutContextText(run)
  if (!/PodcastStep1|Generate Script|Upload Script|Upload Audio|Video Podcast|快捷提示词/i.test(context)) return false
  const totalFlowPages = Array.isArray(run.documentAnalysis?.totalDesignFlow?.pages)
    ? run.documentAnalysis.totalDesignFlow.pages
    : []
  return totalFlowPages.filter(isPodcastShortcutHomepageLike).length > 1 ||
    interactionNodes.filter(isPodcastShortcutHomepageLike).length > 1
}

function hasRuleOnlyPromptShortcutInteractionNode(run = {}, interactionNodes = []) {
  const context = podcastShortcutContextText(run)
  if (!/PodcastStep1|Generate Script|Upload Script|Upload Audio|Video Podcast|快捷提示词/i.test(context)) return false
  return interactionNodes.some((node) => {
    const title = String(node?.title || '')
    const text = [
      node?.title,
      node?.summary,
      node?.content,
      node?.sliceId,
      node?.sourceSliceId
    ].filter(Boolean).join(' ')
    return /提示词|prompt|chip|快捷|输入/i.test(text) &&
      /配置|降级|兜底|数据契约|字段|开关|频控|权限|埋点/.test(text) &&
      !/页面|首页|详情页|弹窗|列表|工作台|控制台|Dashboard|Home/i.test(title)
  })
}

function agentPageLayoutArtifactScore(message = {}, artifact = null, scopeId = '', index = 0) {
  if (!artifact?.rawText) return 0
  const content = String(message?.content || '')
  let score = 10 + index / 1000
  if (message?.role === 'assistant') score += 10
  if (message?.meta?.action === 'stage-confirm-next') score += 30
  if (/requirement-dissection|需求/.test(scopeId)) score += 10
  if (/Topic\/input composer|快捷提示词|Generate podcast|换一批|Video Podcast/i.test(content)) score += 30
  if (/##\s*ASCII 页面线框图/.test(content)) score += 10
  if (/##\s*模块交互明细/.test(content)) score += 10
  return score
}

function bestAgentPageLayoutArtifact(run = {}) {
  const candidates = []
  Object.entries(run.agentSessions || {}).forEach(([scopeId, messages]) => {
    if (!Array.isArray(messages)) return
    messages.forEach((message, index) => {
      if (message?.role !== 'assistant') return
      const artifact = parsePageLayoutArtifactFromText(message.content || '')
      if (!artifact) return
      candidates.push({
        artifact,
        scopeId,
        messageIndex: index,
        meta: message.meta || {},
        score: agentPageLayoutArtifactScore(message, artifact, scopeId, index)
      })
    })
  })
  candidates.sort((a, b) => b.score - a.score || b.messageIndex - a.messageIndex)
  return candidates[0] || null
}

function stageNodeText(node = {}) {
  return [
    node?.id,
    node?.nodeId,
    node?.pageId,
    node?.sourcePageId,
    node?.title,
    node?.page,
    node?.summary,
    node?.route
  ].filter(Boolean).join(' ')
}

function agentArtifactTargetNodeScore(node = {}, artifact = {}) {
  const nodeText = stageNodeText(node)
  const artifactText = [
    artifact.modelDecision,
    artifact.asciiWireframe,
    artifact.interactionDetails,
    artifact.rawText
  ].filter(Boolean).join(' ')
  let score = 0
  if (/首页|Home|Video Podcast/i.test(nodeText)) score += 30
  if (/Video Podcast|AI Video Podcast/i.test(nodeText) && /Video Podcast|AI Video Podcast/i.test(artifactText)) score += 30
  if (/快捷提示词|Topic\/input composer|Generate podcast|换一批/i.test(artifactText)) score += 30
  if (/登录|注册|Auth|弹窗|Modal|Studio|Pricing|设置|账号/i.test(nodeText)) score -= 40
  const titleWords = String(node?.title || '')
    .split(/[\s/|｜·、，,：:（）()]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
  titleWords.forEach((word) => {
    if (artifactText.includes(word)) score += 5
  })
  return score
}

function runProjectEvidenceText(run = {}) {
  const analysis = run.documentAnalysis || {}
  return [
    run.projectId,
    run.workflowName,
    run.title,
    run.input,
    analysis.input,
    analysis.blueprint?.title,
    analysis.blueprint?.profile?.productName,
    ...(Array.isArray(analysis.documents)
      ? analysis.documents.map((doc) => [doc?.name, doc?.text || doc?.content || doc?.summary].filter(Boolean).join('\n'))
      : [])
  ].filter(Boolean).join('\n')
}

function isJoggPodcastHomeNode(node = {}, run = {}) {
  const text = [
    stageNodeText(node),
    runProjectEvidenceText(run)
  ].filter(Boolean).join('\n')
  return /jogg|Video Podcast|PodcastStep1|Generate Script|Upload Script|Upload Audio/i.test(text) &&
    /首页|Home|Video Podcast/i.test(stageNodeText(node))
}

function agentArtifactNeedsJoggHomeRepair(artifact = {}) {
  const text = [
    artifact.modelDecision,
    artifact.asciiWireframe,
    artifact.interactionDetails,
    artifact.rawText
  ].filter(Boolean).join('\n')
  if (!/Topic\/input composer|快捷提示词|Generate podcast|Video Podcast/i.test(text)) return false
  return /顶部固定区：Logo \/ Home \/ Projects|顶部导航：Logo \/ Home|顶部导航：Logo \/ 社媒入口/.test(text) ||
    !/左侧 (AppNavRail|全局导航|Sidebar)/.test(text) ||
    !/输入框内部|placeholder|Chips 内嵌/.test(text)
}

function repairedJoggPodcastHomeArtifact(node = {}, run = {}, sourceArtifact = {}) {
  const artifact = buildPageLayoutArtifactFromSpec({
    projectName: 'Jogg',
    evidenceRefs: [
      {
        id: 'knowledge/navigation.md',
        type: 'knowledge',
        source: 'project knowledge',
        summary: 'Jogg 桌面端导航为左侧 AppNavRail，不能还原成顶部 Home/Projects 菜单。',
        priority: 3,
        confidence: 0.92
      },
      {
        id: 'source/HomeLayout_V2.vue',
        type: 'source',
        source: 'frontend source',
        summary: '首页首屏包含 PodcastStep1、输入类型 Tabs、Topic/input composer 与 Generate podcast。',
        priority: 2,
        confidence: 0.9
      },
      {
        id: 'agent-page-layout-artifact',
        type: 'agent',
        source: sourceArtifact?.source || 'agent-page-layout-artifact',
        summary: 'Agent 已给出快捷提示词、换一批、输入框和 Generate podcast 的交互意图。',
        priority: 4,
        confidence: 0.76
      }
    ],
    conflicts: [
      {
        field: 'navigation.desktop',
        sources: ['agent:top-nav', 'knowledge:navigation.md', 'source:AppNavRail.vue', 'source:HomeLayout_V2.vue'],
        decision: 'left-app-nav',
        reason: '桌面端以知识库和源码证据为准，保留左侧 AppNavRail；Agent 顶部导航只作为错误候选被记录。'
      },
      {
        field: 'composer.shortcut-chips',
        sources: ['agent:shortcut-chips', 'source:HomeLayout_V2.vue'],
        decision: 'inside-topic-composer',
        reason: '快捷提示词属于输入框内部/附近的启动辅助，不应被抽成页面顶部或独立商城模块。'
      }
    ],
    pages: [
      {
        page: node.title || '首页 Video Podcast',
        pageType: '首页 Video Podcast 创建入口',
        layoutType: '左侧 AppNavRail + 内容区首屏 PodcastStep1 输入面板 + 输入框内部快捷提示词 Chips',
        topFixed: [
          '左侧 AppNavRail 固定：Logo / Home(active) / Projects / Tools / Studio / Voice',
          '内容区右上：Sign up +50 / Log in / Upgrade / credits'
        ],
        scrollModules: [
          'Hero 标题 Turn Your Ideas Into Podcasts / AI Video Podcast',
          '输入类型 Tabs：Generate Script / Upload Script / Upload Audio',
          'Topic/input composer 输入框内部：placeholder「Enter a topic, script, or link」',
          'Topic/input composer 输入框内部：快捷提示词 Chips / 更多/换一批',
          '输入框内部操作：Try Sample / Generate podcast',
          '参数栏：host / storytelling / duration / language',
          '次级内容区：公开模板 / 工具入口 / 示例内容'
        ],
        overlays: ['LoginDialog', 'Pricing Drawer/credits 拦截', '提示词更多弹层（可选）'],
        interactions: [
          '点击快捷提示词：写入或追加到 Topic/input composer，不覆盖用户已输入内容。',
          '点击「更多/换一批」：刷新输入框内部 Chips 列表，保留当前 composer 内容。',
          '输入框手动编辑：更新 composer 内容和 Generate podcast 可用状态。',
          '点击 Generate podcast：沿用原 checkOpenGuestLoginDialog 和 createPodcastVideoTask，成功后进入 Studio。',
          '未登录或 credits 不足：弹出 LoginDialog 或 Pricing Drawer，并保留输入框内容。'
        ],
        frontendTasks: [
          '按知识库和源码证据保留左侧 AppNavRail，不把桌面端导航改成顶部菜单。',
          '在 Topic/input composer 内部渲染 placeholder、Chips、换一批和 Generate podcast。',
          '维护 Chips 选中、追加/替换、手动编辑、登录拦截和 loading 状态。'
        ],
        backendTasks: [
          '返回首页快捷提示词列表、刷新结果、用户登录态、credits/权限状态。',
          '保留原 Video Podcast 创建任务接口和 Studio 跳转链路。'
        ],
        reasons: [
          '项目知识库 navigation.md 明确桌面端使用左侧 AppNavRail，HomeLayout_V2 不再使用传统顶部菜单。',
          sourceArtifact?.modelDecision || '当前需求是在首页输入区增强快捷提示词，必须围绕原 Topic/input composer。'
        ]
      }
    ]
  })
  return artifact || sourceArtifact
}

function normalizeAgentPageLayoutArtifactForTarget(artifact = {}, node = {}, run = {}) {
  if (isJoggPodcastHomeNode(node, run) && agentArtifactNeedsJoggHomeRepair(artifact)) {
    return {
      ...repairedJoggPodcastHomeArtifact(node, run, artifact),
      source: artifact.source || 'agent-page-layout-artifact',
      repairedFromAgentArtifact: {
        reason: 'jogg-desktop-left-nav-evidence',
        originalSource: artifact.source || 'agent-page-layout-artifact'
      }
    }
  }
  return artifact
}

function applyAgentPageLayoutArtifactsToInteractionCanvas(totalFlow = {}, run = {}) {
  const canvas = totalFlow?.stageCanvases?.['interaction-lofi']
  if (!Array.isArray(canvas?.nodes) || !canvas.nodes.length) return totalFlow
  const best = bestAgentPageLayoutArtifact(run)
  if (!best?.artifact) return totalFlow
  let targetIndex = -1
  let targetScore = 0
  canvas.nodes.forEach((node, index) => {
    const score = agentArtifactTargetNodeScore(node, best.artifact)
    if (score > targetScore) {
      targetScore = score
      targetIndex = index
    }
  })
  if (targetIndex < 0 || targetScore < 30) return totalFlow
  const nextNodes = canvas.nodes.map((node, index) => {
    if (index !== targetIndex) return node
    const normalizedArtifact = normalizeAgentPageLayoutArtifactForTarget(best.artifact, node, run)
    const pageLayoutArtifact = {
      ...(node.pageLayoutArtifact || {}),
      ...normalizedArtifact,
      importedFromAgent: {
        source: 'agent-session',
        scopeId: best.scopeId,
        messageIndex: best.messageIndex,
        action: best.meta?.action || ''
      }
    }
    return {
      ...node,
      pageLayoutArtifact,
      interactionSpecArtifact: buildInteractionSpecArtifactFromPageLayoutArtifact(pageLayoutArtifact, {
        pageName: node.title || best.artifact.title || '页面'
      })
    }
  })
  return {
    ...totalFlow,
    stageCanvases: {
      ...(totalFlow.stageCanvases || {}),
      'interaction-lofi': {
        ...canvas,
        nodes: nextNodes
      }
    }
  }
}

function hasSparseRequirementDissectionDetail(totalFlow = {}) {
  const artifact = totalFlow?.requirementDissectionArtifact || {}
  const scenarios = artifact.userScenarios || {}
  const designMap = artifact.designRequirementMap || {}
  const competitive = artifact.competitiveAnalysis || {}
  const pages = Array.isArray(designMap.pages) ? designMap.pages : []
  const hasThinUsers = textListLength(scenarios.primaryUsers) < 2 ||
    textListLength(scenarios.coreScenarios) < 2 ||
    textListLength(scenarios.jobsToBeDone) < 3
  const hasThinPageRows = pages.length > 0 && pages.some((page) =>
    !page?.primaryAction ||
    textListLength(page?.states) < 3 ||
    textListLength(page?.dataDependencies) < 2
  )
  const requirementCanvas = totalFlow?.stageCanvases?.['requirement-dissection'] || {}
  const userNode = Array.isArray(requirementCanvas.nodes)
    ? requirementCanvas.nodes.find((node) => node?.id === 'requirement-user-scenarios' || /目标用户|用户与场景/.test(String(node?.title || '')))
    : null
  const hasThinUserNode = userNode && textListLength(userNode.content) < 2
  const hasThinCompetitiveReference = Boolean(competitive.referenceMode) && (
    !competitive.evidenceStatus ||
    !competitive.evidenceNotice ||
    textListLength(competitive.nextActions) < 3 ||
    textListLength(competitive.researchSearchDirections) < 2 ||
    textListLength(competitive.comparisonDimensions) < 3
  )
  return Boolean(
    artifact &&
    (artifact.productDefinition || designMap || artifact.competitiveAnalysis || artifact.downstreamHints) &&
    (hasThinUsers || hasThinPageRows || hasThinUserNode || hasThinCompetitiveReference)
  )
}

const ORDINARY_REQUIREMENT_PIPELINE_NODE_IDS = [
  'requirement-understanding',
  'gap-confirmation',
  'user-journey-analysis',
  'feature-page-decomposition',
  'business-rules-stateflow',
  'flow-architecture',
  'design-opportunity',
  'priority-roadmap',
  'acceptance-standards'
]

const ADVANCED_UX_REQUIREMENT_PIPELINE_NODE_IDS = [
  'ux-original-requirement-analysis',
  'ux-design-problem-definition',
  'ux-user-scenario',
  'ux-interaction-chain',
  'ux-three-design-solutions',
  'ux-exception-flow',
  'ux-recommendation-decision'
]

function requirementArtifactForHydrationCheck(totalFlow = {}) {
  return totalFlow?.modelOnlyRequirementDissectionArtifact ||
    totalFlow?.requirementDissectionArtifact ||
    totalFlow?.requirementAnalysisArtifact ||
    totalFlow?.productRequirementBrief ||
    {}
}

function isAdvancedUxRequirementArtifact(artifact = {}) {
  return [
    artifact.analysisFramework,
    artifact.skillId,
    artifact.resolvedSkillId,
    artifact.requestedSkillId,
    artifact.routing?.resolvedSkillId,
    artifact.routing?.requestedSkillId
  ].some((value) => value === 'advanced-ux-requirement-analysis')
}

function hasExplicitAdvancedUxWorkflowIdentity(run = {}, totalFlow = {}) {
  return [
    run.workflowId,
    run.skillId,
    run.requestedSkillId,
    run.resolvedSkillId,
    run.documentAnalysis?.skillId,
    run.documentAnalysis?.requestedSkillId,
    run.documentAnalysis?.resolvedSkillId,
    totalFlow?.skillId,
    totalFlow?.requestedSkillId,
    totalFlow?.resolvedSkillId
  ].map((value) => String(value || '').trim()).includes('advanced-ux-requirement-analysis')
}

function isAdvancedUxWorkflowRunForHydration(run = {}, totalFlow = {}) {
  const hasAdvancedUxReport = Boolean(totalFlow?.advancedUxReport?.markdown || run.documentAnalysis?.advancedUxReport?.markdown)
  const hasAdvancedUxIdentity = hasExplicitAdvancedUxWorkflowIdentity(run, totalFlow) ||
    isAdvancedUxRequirementArtifact(requirementArtifactForHydrationCheck(totalFlow)) ||
    hasAdvancedUxReport
  if (hasAdvancedUxIdentity) return true
  if (isTotalDesignWorkflowRun(run) && !hasAdvancedUxReport) return false
  return false
}

function advancedUxPageInteractionDocumentFromRun(run = {}, totalFlow = {}) {
  return [
    totalFlow?.advancedUxReport?.pageInteractionDocument,
    totalFlow?.pageInteractionDocumentArtifact,
    totalFlow?.advancedUxReport?.pageInteractionDocumentArtifact,
    run.documentAnalysis?.advancedUxReport?.pageInteractionDocument,
    run.documentAnalysis?.pageInteractionDocumentArtifact
  ].find((document) =>
    String(document?.markdown || '').trim() ||
    ['failed', 'quality_failed', 'import_failed'].includes(String(document?.status || '').trim()) ||
    String(document?.importError || '').trim()
  ) || null
}

function advancedUxStageGeneratingCanvas(stageId = '') {
  const stageName = stageId === 'ui-visual' ? 'UI视觉' : stageId === 'interaction-lofi' ? '交互低保' : '当前阶段'
  const summary = stageId === 'ui-visual'
    ? '正在生成 Draw.io 和低保真线框图产物'
    : '正在生成页面交互框架与说明 Markdown'
  return {
    title: stageName,
    summary,
    canvasType: 'advanced-ux-stage-generating',
    layoutRule: 'single-loading',
    nodes: [{
      id: `advanced-ux-${stageId || 'stage'}-generating`,
      stageId,
      title: stageName,
      summary,
      content: [
        summary,
        '完成后会自动替换为该阶段的真实产物。'
      ],
      x: 120,
      y: 140,
      width: 360,
      height: 220,
      loading: true,
      artifactStatus: 'generating',
      contentStatus: 'model-pending',
      contentSource: 'model-pending',
      quickActions: ['等待生成']
    }],
    edges: [],
    orderedTabs: [{ key: `advanced-ux-${stageId || 'stage'}-generating`, label: stageName }]
  }
}

function advancedUxStageFailedCanvas(stageId = '', errorMessage = '') {
  const stageName = stageId === 'ui-visual' ? 'UI视觉' : stageId === 'interaction-lofi' ? '交互低保' : '当前阶段'
  const message = String(errorMessage || '阶段生成失败').trim()
  return {
    title: stageName,
    summary: `${stageName}生成失败`,
    canvasType: 'advanced-ux-stage-failed',
    layoutRule: 'single-failed',
    status: 'failed',
    nodes: [{
      id: `advanced-ux-${stageId || 'stage'}-failed`,
      stageId,
      title: stageName,
      summary: `${stageName}生成失败`,
      content: [
        `${stageName}生成失败`,
        message
      ],
      x: 120,
      y: 140,
      width: 360,
      height: 220,
      loading: false,
      artifactStatus: 'failed',
      failureReason: message,
      importError: message,
      quickActions: ['重新生成该阶段']
    }],
    edges: [],
    orderedTabs: [{ key: `advanced-ux-${stageId || 'stage'}-failed`, label: stageName }]
  }
}

function suppressAdvancedUxPendingInteractionFallbackCanvas(totalFlow = {}, run = {}) {
  if (!hasExplicitAdvancedUxWorkflowIdentity(run, totalFlow)) return totalFlow
  if (!isAdvancedUxWorkflowRunForHydration(run, totalFlow)) return totalFlow
  const pageInteractionDocument = advancedUxPageInteractionDocumentFromRun(run, totalFlow)
  const pageInteractionStatus = String(pageInteractionDocument?.status || '').trim()
  const pageInteractionFailed = ['failed', 'quality_failed', 'import_failed'].includes(pageInteractionStatus) || String(pageInteractionDocument?.importError || '').trim()
  if (pageInteractionDocument?.markdown) return totalFlow
  if (pageInteractionFailed) {
    const canvas = advancedUxStageFailedCanvas('interaction-lofi', pageInteractionDocument.importError || '页面交互框架与说明 Markdown 生成失败')
    return {
      ...totalFlow,
      stageStatuses: {
        ...(totalFlow.stageStatuses || {}),
        'interaction-lofi': {
          ...(totalFlow.stageStatuses?.['interaction-lofi'] || {}),
          status: 'failed',
          pendingSummary: false
        }
      },
      stageCanvases: {
        ...(totalFlow.stageCanvases || {}),
        'interaction-lofi': canvas
      }
    }
  }
  const existingInteractionNodes = Array.isArray(totalFlow.stageCanvases?.['interaction-lofi']?.nodes)
    ? totalFlow.stageCanvases['interaction-lofi'].nodes
    : []
  const hasImportedInteractionCanvas = existingInteractionNodes.some((node) =>
    String(node?.contentStatus || '') !== 'model-pending' &&
    String(node?.contentSource || '') !== 'model-pending' &&
    (
      node?.pageLayoutArtifact?.asciiWireframe ||
      node?.pageLayoutArtifact?.rawText ||
      node?.interactionSpecArtifact ||
      node?.interactionSpec?.length
    )
  )
  if (hasImportedInteractionCanvas) return totalFlow
  const reportMarkdown = String(totalFlow?.advancedUxReport?.markdown || run.documentAnalysis?.advancedUxReport?.markdown || '').trim()
  const interactionStatus = String(totalFlow?.stageStatuses?.['interaction-lofi']?.status || '').trim()
  const shouldShowPendingInteraction = Boolean(
    reportMarkdown ||
    totalFlow?.currentStage === 'interaction-lofi' ||
    ['generating', 'waiting', 'paused', 'failed'].includes(interactionStatus)
  )
  if (!shouldShowPendingInteraction) return totalFlow
  const canvas = advancedUxStageGeneratingCanvas('interaction-lofi')
  return {
    ...totalFlow,
    stageStatuses: {
      ...(totalFlow.stageStatuses || {}),
      'interaction-lofi': {
        ...(totalFlow.stageStatuses?.['interaction-lofi'] || {}),
        status: interactionStatus === 'failed' ? 'failed' : 'generating',
        pendingSummary: true
      }
    },
    stageCanvases: {
      ...(totalFlow.stageCanvases || {}),
      'interaction-lofi': canvas
    }
  }
}

function requirementPipelineIds(totalFlow = {}) {
  const artifact = requirementArtifactForHydrationCheck(totalFlow)
  const pipelineTabs = Array.isArray(artifact?.productAnalysisPipeline?.tabs)
    ? artifact.productAnalysisPipeline.tabs
    : []
  if (pipelineTabs.length) {
    return pipelineTabs.map((tab) => String(tab?.id || '').trim()).filter(Boolean)
  }
  const requirementNodes = Array.isArray(totalFlow?.stageCanvases?.['requirement-dissection']?.nodes)
    ? totalFlow.stageCanvases['requirement-dissection'].nodes
    : []
  return requirementNodes
    .map((node) => String(node?.requirementPipelineTabId || node?.id || '').trim())
    .filter(Boolean)
}

function hasLegacyRequirementPipeline(totalFlow = {}, run = {}) {
  const ids = requirementPipelineIds(totalFlow)
  if (!ids.length) return false
  const artifact = requirementArtifactForHydrationCheck(totalFlow)
  const expectedIds = isAdvancedUxWorkflowRunForHydration(run, totalFlow) || (!run?.id && isAdvancedUxRequirementArtifact(artifact))
    ? ADVANCED_UX_REQUIREMENT_PIPELINE_NODE_IDS
    : ORDINARY_REQUIREMENT_PIPELINE_NODE_IDS
  return ids.length !== expectedIds.length || expectedIds.some((id, index) => ids[index] !== id)
}

function isLooseRequirementField(value, canonicalShape = '') {
  if (value === undefined || value === null) return false
  if (canonicalShape === 'object') return typeof value === 'string' || Array.isArray(value)
  if (canonicalShape === 'array-to-object') return Array.isArray(value) || typeof value === 'string'
  return false
}

function hasLooseRequirementDissectionArtifact(totalFlow = {}, run = {}) {
  const artifact = requirementArtifactForHydrationCheck(totalFlow)
  if (!artifact || typeof artifact !== 'object') return false
  return Boolean(
    hasLegacyRequirementPipeline(totalFlow, run) ||
    isLooseRequirementField(artifact.navigationStructure, 'object') ||
    isLooseRequirementField(artifact.pageHierarchyTree, 'object') ||
    isLooseRequirementField(artifact.userJourneyMap, 'object') ||
    isLooseRequirementField(artifact.dataFlowGraph, 'object') ||
    isLooseRequirementField(artifact.stateMachineMap, 'object') ||
    isLooseRequirementField(artifact.featureJumpGraph, 'object') ||
    isLooseRequirementField(artifact.designOpportunityMatrix, 'array-to-object') ||
    isLooseRequirementField(artifact.priorityRoadmap, 'array-to-object') ||
    isLooseRequirementField(artifact.acceptanceBasis, 'array-to-object') ||
    Array.isArray(artifact.designRequirementMap)
  )
}

function needsTotalDesignFlowHydration(run = {}) {
  const analysis = run.documentAnalysis || {}
  const analysisSourceText = [
    run.title,
    run.input,
    analysis.input,
    analysis.blueprint?.title,
    analysis.blueprint?.profile?.productName,
    analysis.blueprint?.profile?.primaryGoal
  ].filter(Boolean).join(' ')
  const stageCanvases = analysis.totalDesignFlow?.stageCanvases || {}
  const hasStageCanvasNodes = Object.values(stageCanvases).some((canvas) => Array.isArray(canvas?.nodes) && canvas.nodes.length)
  const interactionNodes = Array.isArray(stageCanvases?.['interaction-lofi']?.nodes)
    ? stageCanvases['interaction-lofi'].nodes
    : []
  const hasLegacyInteractionNodesWithoutArtifact = interactionNodes.length &&
    interactionNodes.some((node) => node?.detailLayout === 'interaction-page-split' && !node?.pageLayoutArtifact)
  const hasLegacyInteractionNodesWithoutScreenContract = interactionNodes.length &&
    interactionNodes.some((node) => node?.detailLayout === 'interaction-page-split' && !node?.pageLayoutArtifact?.screenContract)
  const hasLegacyInteractionNodesWithoutSliceId = interactionNodes.length &&
    interactionNodes.some((node) => node?.detailLayout === 'interaction-page-split' && !node?.sliceId)
  const requirementCanvas = stageCanvases?.['requirement-dissection'] || {}
  const requirementNodes = Array.isArray(requirementCanvas.nodes) ? requirementCanvas.nodes : []
  const hasLegacyRequirementDissectionWithoutArtifact = Boolean(
    requirementNodes.length &&
    (
      !analysis.totalDesignFlow?.requirementDissectionArtifact ||
      !requirementCanvas.agentNode?.requirementDissectionArtifact ||
      hasLegacyRequirementPipeline(analysis.totalDesignFlow, run)
    )
  )
  const hasSparseRequirementDissectionArtifact = hasSparseRequirementDissectionDetail(analysis.totalDesignFlow)
  const hasLooseRequirementDissectionDetail = hasLooseRequirementDissectionArtifact(analysis.totalDesignFlow, run)
  const hasStaleProductDetailMenuWireframe = interactionNodes.some((node) =>
    /商品详情|商品定制|规格/.test(String(node?.title || '')) &&
    /点餐菜单页|左右分栏特殊框架/.test(String(node?.pageLayoutArtifact?.asciiWireframe || node?.pageLayoutArtifact?.rawText || ''))
  )
  const hasStalePodcastShortcutWireframe = hasStalePodcastShortcutMallWireframe(run, interactionNodes)
  const hasDuplicatePodcastShortcutHomeNodes = hasDuplicatePodcastShortcutHomepages(run, interactionNodes)
  const hasRuleOnlyPodcastPromptNodes = hasRuleOnlyPromptShortcutInteractionNode(run, interactionNodes)
  const totalFlowPages = Array.isArray(analysis.totalDesignFlow?.pages) ? analysis.totalDesignFlow.pages : []
  const totalFlowPageTitles = totalFlowPages.map((page) => String(page?.title || ''))
  const hasShortTeaMiniProgramPages = /茶饮|奶茶|点单|点餐|小程序/.test(analysisSourceText) &&
    totalFlowPages.length > 0 &&
    totalFlowPages.length < 8 &&
    totalFlowPageTitles.some((title) => /点单|点餐|菜单/.test(title)) &&
    totalFlowPageTitles.some((title) => /商品详情|商品定制|规格/.test(title)) &&
    !totalFlowPageTitles.some((title) => /购物车|结算/.test(title))
  return Boolean(
    isTotalDesignWorkflowRun(run) &&
    (
      (analysis.canvas?.nodes?.length && (!analysis.totalDesignFlow || !hasStageCanvasNodes)) ||
      hasLegacyInteractionNodesWithoutArtifact ||
      hasLegacyInteractionNodesWithoutScreenContract ||
      hasLegacyInteractionNodesWithoutSliceId ||
      hasLegacyRequirementDissectionWithoutArtifact ||
      hasSparseRequirementDissectionArtifact ||
      hasLooseRequirementDissectionDetail ||
      hasStaleProductDetailMenuWireframe ||
      hasStalePodcastShortcutWireframe ||
      hasDuplicatePodcastShortcutHomeNodes ||
      hasRuleOnlyPodcastPromptNodes ||
      hasShortTeaMiniProgramPages
    )
  )
}

function nodeHasGeneratedArtifact(node = {}) {
  return Boolean(
    node?.artifact ||
    node?.codePreview ||
    node?.visualPreview?.imageUrl ||
    node?.visualPreview?.imageDataUrl ||
    ['generated', 'failed', 'generating'].includes(String(node?.artifactStatus || ''))
  )
}

function normalizedVisualNodeTitle(value = '') {
  return String(value || '')
    .replace(/UI视觉|高保真图|视觉稿/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function visualNodeIdentityKeys(stageId = '', node = {}) {
  if (stageId !== 'ui-visual' || !node || typeof node !== 'object') return []
  return [
    node.sourcePageId ? `source-page:${node.sourcePageId}` : '',
    node.pageId ? `page:${node.pageId}` : '',
    node.route ? `route:${node.route}` : '',
    normalizedVisualNodeTitle(node.title) ? `title:${normalizedVisualNodeTitle(node.title)}` : ''
  ].filter(Boolean)
}

function preserveStageCanvasNodeArtifacts(nextTotalFlow = {}, previousTotalFlow = {}) {
  const previousCanvases = previousTotalFlow?.stageCanvases || {}
  const artifactByStageNode = new Map()
  const artifactByStageIdentity = new Map()
  const duplicateStageIdentities = new Set()
  const rememberArtifact = (stageId, node) => {
    const artifact = {
      artifactStatus: node.artifactStatus,
      artifact: node.artifact,
      visualPreview: node.visualPreview,
      codePreview: node.codePreview,
      generationActions: node.generationActions,
      targetGenerator: node.targetGenerator,
      contentStatusLabel: node.contentStatusLabel
    }
    artifactByStageNode.set(`${stageId}:${node.id}`, artifact)
    visualNodeIdentityKeys(stageId, node).forEach((key) => {
      const stageKey = `${stageId}:${key}`
      if (artifactByStageIdentity.has(stageKey)) {
        duplicateStageIdentities.add(stageKey)
        return
      }
      artifactByStageIdentity.set(stageKey, artifact)
    })
  }
  Object.entries(previousCanvases).forEach(([stageId, canvas]) => {
    if (!Array.isArray(canvas?.nodes)) return
    canvas.nodes.forEach((node) => {
      if (!node?.id || !nodeHasGeneratedArtifact(node)) return
      rememberArtifact(stageId, node)
    })
  })
  if ((!artifactByStageNode.size && !artifactByStageIdentity.size) || !nextTotalFlow?.stageCanvases) return nextTotalFlow
  const preservedArtifactForNode = (stageId, node = {}) => {
    const exact = artifactByStageNode.get(`${stageId}:${node?.id}`)
    if (exact) return exact
    for (const key of visualNodeIdentityKeys(stageId, node)) {
      const stageKey = `${stageId}:${key}`
      if (duplicateStageIdentities.has(stageKey)) continue
      const preserved = artifactByStageIdentity.get(stageKey)
      if (preserved) return preserved
    }
    return null
  }
  return {
    ...nextTotalFlow,
    stageCanvases: Object.fromEntries(Object.entries(nextTotalFlow.stageCanvases).map(([stageId, canvas]) => [
      stageId,
      Array.isArray(canvas?.nodes)
        ? {
            ...canvas,
            nodes: canvas.nodes.map((node) => {
              const preserved = preservedArtifactForNode(stageId, node)
              if (!preserved) return node
              return {
                ...node,
                ...Object.fromEntries(Object.entries(preserved).filter(([, value]) => value !== undefined))
              }
            })
          }
        : canvas
    ]))
  }
}

function safeGeneratedImageSegment(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image'
}

function generatedImageRecoveryDir(options = {}) {
  return options.generatedImageDir || process.env.WORKFLOW_GENERATED_IMAGE_DIR || DEFAULT_GENERATED_IMAGE_DIR
}

function generatedImageContentType(fileName = '') {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  return 'image/png'
}

async function latestGeneratedImageFileForNode(runId = '', nodeId = '', options = {}) {
  const directory = generatedImageRecoveryDir(options)
  const prefix = `${safeGeneratedImageSegment(runId)}-${safeGeneratedImageSegment(nodeId)}-`
  let entries = []
  try {
    entries = await readdir(directory)
  } catch {
    return null
  }
  const matches = []
  for (const fileName of entries) {
    if (!fileName.startsWith(prefix) || !/\.(png|jpg|jpeg|webp)$/i.test(fileName)) continue
    const localImagePath = join(directory, fileName)
    try {
      const fileStat = await stat(localImagePath)
      matches.push({ fileName, localImagePath, mtimeMs: fileStat.mtimeMs })
    } catch {}
  }
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return matches[0] || null
}

async function recoverGeneratedVisualArtifactsFromFiles(totalFlow = {}, run = {}, options = {}) {
  const visualCanvas = totalFlow?.stageCanvases?.['ui-visual']
  if (!Array.isArray(visualCanvas?.nodes) || !run?.id) return totalFlow
  const recoveredNodes = []
  let changed = false
  for (const node of visualCanvas.nodes) {
    const hasImage = Boolean(node?.visualPreview?.imageUrl || node?.visualPreview?.imageDataUrl || node?.artifact?.imageUrl || node?.artifact?.imageDataUrl)
    if (!node?.id || hasImage) {
      recoveredNodes.push(node)
      continue
    }
    const imageFile = await latestGeneratedImageFileForNode(run.id, node.id, options)
    if (!imageFile) {
      recoveredNodes.push(node)
      continue
    }
    const imageUrl = `/api/workspace/generated-images/${encodeURIComponent(imageFile.fileName)}`
    const localImageContentType = generatedImageContentType(imageFile.fileName)
    changed = true
    recoveredNodes.push({
      ...node,
      artifactStatus: 'generated',
      artifact: {
        ...(node.artifact || {}),
        kind: node.artifact?.kind || 'visual',
        imageStatus: 'generated',
        imageUrl,
        localImagePath: imageFile.localImagePath,
        localImageContentType
      },
      visualPreview: {
        ...(node.visualPreview || {}),
        imageStatus: 'generated',
        imageUrl,
        localImagePath: imageFile.localImagePath,
        localImageContentType,
        configurationMessage: '',
        errorCode: ''
      },
      generationActions: Array.isArray(node.generationActions)
        ? node.generationActions.map((action, index) => index === 0
            ? { ...(typeof action === 'object' ? action : { label: String(action || '') }), status: 'generated' }
            : action)
        : node.generationActions,
      contentStatusLabel: '已生成'
    })
  }
  if (!changed) return totalFlow
  return {
    ...totalFlow,
    stageCanvases: {
      ...(totalFlow.stageCanvases || {}),
      'ui-visual': {
        ...visualCanvas,
        nodes: recoveredNodes
      }
    }
  }
}

function preserveConfirmedStageProgress(nextTotalFlow = {}, previousTotalFlow = {}) {
  const previousConfirmations = previousTotalFlow?.stageConfirmations || {}
  const confirmationEntries = Object.values(previousConfirmations)
    .filter((confirmation) => confirmation && typeof confirmation === 'object')
  if (!confirmationEntries.length) return nextTotalFlow
  const stages = Array.isArray(previousTotalFlow.stages) && previousTotalFlow.stages.length
    ? previousTotalFlow.stages
    : Array.isArray(nextTotalFlow.stages) && nextTotalFlow.stages.length
      ? nextTotalFlow.stages
      : []
  const stageIndex = (stageId = '') => {
    const index = stages.findIndex((stage) => stage?.id === stageId)
    return index >= 0 ? index : -1
  }
  const confirmedNextStageIds = new Set(
    confirmationEntries
      .map((confirmation) => String(confirmation.nextStageId || '').trim())
      .filter(Boolean)
  )
  const previousCanvases = previousTotalFlow?.stageCanvases || {}
  const preservedCanvases = Object.fromEntries(Object.entries(previousCanvases).filter(([stageId, canvas]) => {
    const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes : []
    if (!nodes.length) return false
    if (confirmedNextStageIds.has(stageId)) return true
    return nodes.some((node) => node?.stageContextSummary)
  }))
  const currentStageId = previousTotalFlow.currentStage || nextTotalFlow.currentStage || ''
  const latestConfirmedNextStageId = [...confirmedNextStageIds]
    .filter((stageId) => Array.isArray(previousCanvases?.[stageId]?.nodes) && previousCanvases[stageId].nodes.length)
    .sort((a, b) => stageIndex(b) - stageIndex(a))[0] || ''
  const shouldAdvanceCurrentStage = latestConfirmedNextStageId &&
    stageIndex(latestConfirmedNextStageId) >= 0 &&
    (stageIndex(currentStageId) < 0 || stageIndex(latestConfirmedNextStageId) > stageIndex(currentStageId))
  return {
    ...nextTotalFlow,
    currentStage: shouldAdvanceCurrentStage
      ? latestConfirmedNextStageId
      : previousTotalFlow.currentStage || nextTotalFlow.currentStage,
    stageConfirmations: {
      ...(nextTotalFlow.stageConfirmations || {}),
      ...previousConfirmations
    },
    stageCanvases: {
      ...(nextTotalFlow.stageCanvases || {}),
      ...preservedCanvases
    }
  }
}

function normalizeTotalFlowHydrationAnalysisIdentity(analysis = {}, previousTotalFlow = {}, run = {}) {
  const hasAdvancedUxReport = Boolean(previousTotalFlow?.advancedUxReport?.markdown || analysis?.advancedUxReport?.markdown)
  if (!isTotalDesignWorkflowRun(run) || hasAdvancedUxReport) return analysis
  return {
    ...analysis,
    skillId: 'total-design-flow',
    requestedSkillId: 'total-design-flow',
    resolvedSkillId: 'total-design-flow',
    routing: {
      ...(analysis.routing || {}),
      requestedSkillId: 'total-design-flow',
      resolvedSkillId: 'total-design-flow',
      displaySkillName: '总流程'
    }
  }
}

function totalFlowModelForHydration(previousTotalFlow = {}, run = {}) {
  if (!isTotalDesignWorkflowRun(run)) return previousTotalFlow
  const normalizeArtifact = (artifact = null) => {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return artifact
    return {
      ...artifact,
      analysisFramework: 'total-design-flow',
      skillId: 'total-design-flow',
      requestedSkillId: 'total-design-flow',
      resolvedSkillId: 'total-design-flow'
    }
  }
  return {
    requirementDissectionArtifact: normalizeArtifact(previousTotalFlow.requirementDissectionArtifact),
    modelOnlyRequirementDissectionArtifact: normalizeArtifact(previousTotalFlow.modelOnlyRequirementDissectionArtifact),
    requirementAnalysisArtifact: normalizeArtifact(previousTotalFlow.requirementAnalysisArtifact),
    productRequirementBrief: normalizeArtifact(previousTotalFlow.productRequirementBrief)
  }
}

const ADVANCED_UX_GENERIC_FAILURE_REASON = '模型调用未生成可导入的高级 UX Markdown。请重新生成。'

function isAdvancedUxInternalRuntimeNoise(text = '') {
  return /codex_core_plugins|plugin catalog|401 Unauthorized|find_thread_path_by_id_str|\.codex\/\.tmp\/plugins|thread in cwd|WARN\s|DEBUG\s|INFO\s|startup warning|failed to load plugin/i.test(String(text || ''))
}

function sanitizeAdvancedUxFailureReason(reason = '') {
  const text = String(reason || '').trim()
  if (!text) return ''
  if (isAdvancedUxInternalRuntimeNoise(text)) return ADVANCED_UX_GENERIC_FAILURE_REASON
  return text
}

function advancedUxFailedReportForHydration(run = {}, totalFlow = {}) {
  const report = [
    totalFlow?.advancedUxReport,
    run.documentAnalysis?.advancedUxReport,
    run.documentAnalysis?.totalDesignFlow?.advancedUxReport
  ].find((candidate) => ['failed', 'quality_failed', 'import_failed'].includes(String(candidate?.status || candidate?.reportStatus || '').trim())) || {}
  const status = String(report.status || report.reportStatus || '').trim()
  if (!['failed', 'quality_failed', 'import_failed'].includes(status)) return null
  const issueText = Array.isArray(report.qualityIssues)
    ? report.qualityIssues.map((issue) => typeof issue === 'string' ? issue : issue?.message || issue?.title || '').filter(Boolean).join('；')
    : ''
  const importError = sanitizeAdvancedUxFailureReason(report.importError || issueText || run.error || '高级 UX Markdown 未生成成功。')
  return {
    ...report,
    status,
    importError
  }
}

function sanitizeAdvancedUxAgentSessionsForHydration(sessions = {}) {
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) return sessions || {}
  return Object.fromEntries(Object.entries(sessions).map(([scopeId, session]) => [
    scopeId,
    (Array.isArray(session) ? session : []).flatMap((message) => {
      if (message?.role !== 'assistant') return [message]
      const meta = message.meta || {}
      const action = String(meta.action || '').trim()
      const content = String(message.content || '').trim()
      if (action === 'workflow-analysis-result' && isAdvancedUxInternalRuntimeNoise(content)) return []
      if (action !== 'advanced-ux-markdown-report') return [message]
      const importError = sanitizeAdvancedUxFailureReason(meta.importError || '')
      const nextContent = sanitizeAdvancedUxFailureReason(content)
      return [{
        ...message,
        content: nextContent || content,
        meta: {
          ...meta,
          ...(importError ? { importError } : {})
        }
      }]
    })
  ]))
}

function hydrateAdvancedUxFailedRequirementCanvas(totalFlow = {}, run = {}) {
  if (!isAdvancedUxWorkflowRunForHydration(run, totalFlow)) return totalFlow
  const failedReport = advancedUxFailedReportForHydration(run, totalFlow)
  if (!failedReport) return totalFlow
  const hasMarkdown = Boolean(String(failedReport.markdown || '').trim())
  const cleanFailedTotalFlow = hasMarkdown
    ? totalFlow
    : {
        mode: totalFlow.mode || 'total-design-flow',
        type: totalFlow.type || 'total-design-flow',
        skillId: totalFlow.skillId || 'advanced-ux-requirement-analysis',
        requestedSkillId: totalFlow.requestedSkillId || 'advanced-ux-requirement-analysis',
        resolvedSkillId: totalFlow.resolvedSkillId || 'advanced-ux-requirement-analysis',
        currentStage: 'requirement-dissection',
        stages: Array.isArray(totalFlow.stages) && totalFlow.stages.length ? totalFlow.stages : undefined,
        stageCanvases: {},
        stageStatuses: {}
      }
  const hydratedFlow = failAdvancedUxMarkdownGenerationInTotalFlow(
    {
      ...cleanFailedTotalFlow,
      advancedUxReport: {
        ...(cleanFailedTotalFlow.advancedUxReport || {}),
        ...failedReport
      }
    },
    failedReport.importError
  )
  return {
    ...hydratedFlow,
    advancedUxReport: {
      ...(hydratedFlow.advancedUxReport || {}),
      ...failedReport,
      markdown: failedReport.markdown || hydratedFlow.advancedUxReport?.markdown || ''
    }
  }
}

function analysisForTotalFlowHydration(analysis = {}, previousTotalFlow = {}, run = {}) {
  const baseAnalysis = normalizeTotalFlowHydrationAnalysisIdentity(analysis, previousTotalFlow, run)
  if (!previousTotalFlow || typeof previousTotalFlow !== 'object' || !Object.keys(previousTotalFlow).length) return baseAnalysis
  const generation = analysis.generation && typeof analysis.generation === 'object' ? analysis.generation : {}
  const output = generation.output && typeof generation.output === 'object' ? generation.output : {}
  const nextAnalysis = {
    ...baseAnalysis,
    generation: {
      ...generation,
      output: {
        ...output,
        totalDesignFlow: totalFlowModelForHydration(previousTotalFlow, run)
      }
    }
  }
  if (output.totalDesignFlow || output.totalFlow) return nextAnalysis
  return nextAnalysis
}

async function hydrateWorkflowRunDetail(store, run = {}, options = {}) {
  if (!run?.id) return run
  const shouldHydrate = needsTotalDesignFlowHydration(run)
  const previousTotalFlow = run.documentAnalysis?.totalDesignFlow || {}
  const shouldHydrateAdvancedFailure = Boolean(advancedUxFailedReportForHydration(run, previousTotalFlow))
  if (!previousTotalFlow?.stageCanvases && !shouldHydrate && !shouldHydrateAdvancedFailure) return run
  const shouldUsePreviousRequirementModel = shouldHydrate && hasLooseRequirementDissectionArtifact(previousTotalFlow, run)
  const sourceAnalysis = shouldHydrate
    ? shouldUsePreviousRequirementModel
      ? analysisForTotalFlowHydration(run.documentAnalysis, previousTotalFlow, run)
      : normalizeTotalFlowHydrationAnalysisIdentity(run.documentAnalysis, previousTotalFlow, run)
    : run.documentAnalysis
  const sourceTotalFlow = shouldHydrate
    ? preserveStageCanvasNodeArtifacts(
      buildTotalDesignFlow(sourceAnalysis),
      previousTotalFlow
    )
    : !previousTotalFlow?.stageCanvases && shouldHydrateAdvancedFailure
      ? buildTotalDesignFlow(sourceAnalysis)
      : previousTotalFlow
  const baseTotalFlow = preserveConfirmedStageProgress(
    sourceTotalFlow,
    previousTotalFlow
  )
  const recoveredTotalFlow = await recoverGeneratedVisualArtifactsFromFiles(baseTotalFlow, run, options)
  const failureHydratedTotalFlow = hydrateAdvancedUxFailedRequirementCanvas(recoveredTotalFlow, run)
  const sourceGatedTotalFlow = suppressAdvancedUxPendingInteractionFallbackCanvas(
    applyAgentPageLayoutArtifactsToInteractionCanvas(failureHydratedTotalFlow, run),
    run
  )
  const hydratedTotalFlow = withWorkflowStageRuntime(
    withDownstreamStageArtifactContext(
      sourceGatedTotalFlow
    )
  )
  if (!shouldHydrate && hydratedTotalFlow === previousTotalFlow) return run
  const nextAnalysis = {
    ...run.documentAnalysis,
    advancedUxReport: hydratedTotalFlow.advancedUxReport || run.documentAnalysis?.advancedUxReport,
    totalDesignFlow: hydratedTotalFlow
  }
  return await updateWorkflowRun(store, run.id, {
    ...run,
    documentAnalysis: nextAnalysis,
    agentSessions: isAdvancedUxWorkflowRunForHydration(run, hydratedTotalFlow)
      ? sanitizeAdvancedUxAgentSessionsForHydration(run.agentSessions || {})
      : run.agentSessions
  })
}

function sameOriginPrototypeUrls(urls = [], sourceUrl = '', limit = 8) {
  let origin = ''
  try {
    origin = new URL(sourceUrl).origin
  } catch {
    return []
  }
  const seen = new Set()
  return urls
    .map((url) => normalizePrototypeUrl(url))
    .filter((url) => {
      try {
        const parsed = new URL(url)
        if (parsed.origin !== origin) return false
        if (seen.has(url)) return false
        seen.add(url)
        return true
      } catch {
        return false
      }
    })
    .slice(0, limit)
}

function parsedWebsitePages(imported = {}, payload = {}) {
  const parsedItems = (Array.isArray(imported.items) ? imported.items : [])
    .map((item) => item.parsed)
    .filter((parsed) => parsed?.sourceUrl)
  const pageByUrl = new Map()
  parsedItems.forEach((parsed) => {
    const url = normalizePrototypeUrl(parsed.sourceUrl)
    if (!url || pageByUrl.has(url)) return
    pageByUrl.set(url, {
      url,
      title: parsed.title || url,
      description: parsed.description || '',
      links: Array.isArray(parsed.links) ? parsed.links : [],
      ctas: Array.isArray(parsed.ctas) ? parsed.ctas : []
    })
  })
  if (!pageByUrl.size && payload.url) {
    pageByUrl.set(normalizePrototypeUrl(payload.url), {
      url: normalizePrototypeUrl(payload.url),
      title: payload.url,
      description: '',
      links: [],
      ctas: []
    })
  }
  return [...pageByUrl.values()]
}

function prototypeCaptureTargets(imported = {}, payload = {}) {
  const pages = parsedWebsitePages(imported, payload)
  const urls = sameOriginPrototypeUrls([
    payload.url,
    ...pages.map((page) => page.url),
    ...pages.flatMap((page) => [
      ...page.ctas.map((link) => link.href),
      ...page.links.map((link) => link.href)
    ])
  ], payload.url || pages[0]?.url || '')
  const pageByUrl = new Map(pages.map((page) => [normalizePrototypeUrl(page.url), page]))
  return urls.map((url) => ({
    ...(pageByUrl.get(url) || {}),
    url,
    title: pageByUrl.get(url)?.title || url
  }))
}

function websiteBlueprintInput(imported = {}, payload = {}) {
  const items = imported.items || []
  const document = websiteBlueprintDocumentFromImport(imported, payload)
  return [
    document.text,
    imported.summary?.title || payload.url || '网站导入',
    imported.summary?.description || '',
    ...items.map((item) => `${item.title || ''}\n${item.content || item.summary || ''}`)
  ].filter(Boolean).join('\n\n')
}

function normalizedPrototypeRect(index = 0, actionCount = 1) {
  const width = actionCount > 1 ? 38 : 48
  const gap = 4
  return {
    x: Math.min(78, 8 + index * (width + gap)),
    y: 78,
    width,
    height: 8
  }
}

function screenshotForBlueprintScreen(screen = {}, payload = {}) {
  const pages = Array.isArray(payload.captureResult?.pages)
    ? payload.captureResult.pages
    : Array.isArray(payload.pages)
      ? payload.pages
      : []
  const sourcePage = pages.find((page) =>
    page.id === screen.id ||
    page.title === screen.title ||
    page.url === screen.url ||
    String(page.url || '').includes(String(screen.id || ''))
  )
  return sourcePage?.screenshot || sourcePage?.screenshotUrl || sourcePage?.captureUrl || ''
}

function stableScreenId(value = '', index = 0) {
  const raw = String(value || '').trim()
  const slug = raw
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || `screen-${index + 1}`
}

function normalizeHotspotRect(rect = {}, fallbackIndex = 0, actionCount = 1) {
  const fallback = normalizedPrototypeRect(fallbackIndex, actionCount)
  return {
    x: Number.isFinite(Number(rect.x)) ? Number(rect.x) : fallback.x,
    y: Number.isFinite(Number(rect.y)) ? Number(rect.y) : fallback.y,
    width: Number.isFinite(Number(rect.width)) ? Number(rect.width) : fallback.width,
    height: Number.isFinite(Number(rect.height)) ? Number(rect.height) : fallback.height
  }
}

function capturePageLinks(page = {}) {
  const links = Array.isArray(page.links) ? page.links : []
  const interactions = Array.isArray(page.interactions) ? page.interactions : []
  return [...links, ...interactions].map((link) => ({
    label: link.label || link.text || link.name || link.title || link.href || link.targetUrl || '打开页面',
    href: normalizePrototypeUrl(link.href || link.targetUrl || link.url || link.to || '', page.url || page.sourceUrl || ''),
    rect: link.rect || link.hotspot || null
  })).filter((link) => link.href)
}

function buildCapturedPrototypeScreens(capture = {}, payload = {}) {
  const capturePages = Array.isArray(capture.pages) ? capture.pages : []
  if (!capturePages.length) return null
  const normalizedPages = capturePages.map((page, index) => {
    const url = normalizePrototypeUrl(page.url || page.sourceUrl || '')
    return {
      ...page,
      id: page.id || stableScreenId(url || page.title, index),
      url,
      title: page.title || url || `页面 ${index + 1}`,
      screenshotUrl: page.screenshotUrl || page.screenshot || page.captureUrl || page.imageUrl || '',
      screenshotAssetId: page.screenshotAssetId || page.assetId || '',
      screenshotStorage: page.screenshotStorage || page.storage || ''
    }
  }).filter((page) => page.url || page.screenshotUrl)
  const screenByUrl = new Map(normalizedPages.map((page) => [page.url, page]))
  const screens = normalizedPages.map((page, pageIndex) => {
    const links = capturePageLinks(page)
    const matchedLinks = links.filter((link) => screenByUrl.has(link.href))
    return {
      id: page.id,
      url: page.url,
      title: page.title,
      summary: page.summary || page.description || '',
      screenshotUrl: page.screenshotUrl,
      source: 'backend-url-capture',
      viewport: page.viewport || capture.viewport || { width: 1440, height: 900 },
      screenshotAssetId: page.screenshotAssetId || `${page.id}-screenshot`,
      screenshotStorage: page.screenshotStorage || 'workspace-asset',
      components: page.components || [],
      hotspots: matchedLinks.map((link, linkIndex) => ({
        id: `${page.id}-hotspot-${linkIndex + 1}`,
        label: link.label || `跳转 ${linkIndex + 1}`,
        event: 'click',
        targetScreenId: screenByUrl.get(link.href)?.id || '',
        targetUrl: link.href,
        rect: normalizeHotspotRect(link.rect || {}, linkIndex, matchedLinks.length),
        feedback: '点击后跳转到截图对应页面'
      }))
    }
  })
  return {
    source: capture.source || 'backend-url-capture',
    screens,
    screenshotAssets: screens.map((screen) => ({
      id: screen.screenshotAssetId,
      screenId: screen.id,
      url: screen.url,
      title: screen.title,
      screenshotUrl: screen.screenshotUrl,
      storage: screen.screenshotStorage || 'workspace-asset',
      source: screen.source
    })),
    transitions: screens.flatMap((screen) =>
      (screen.hotspots || [])
        .filter((hotspot) => hotspot.targetScreenId)
        .map((hotspot) => ({
          id: `${screen.id}-${hotspot.id}-${hotspot.targetScreenId}`,
          from: screen.id,
          to: hotspot.targetScreenId,
          label: hotspot.label,
          event: hotspot.event,
          sourceUrl: screen.url,
          targetUrl: hotspot.targetUrl
        }))
    )
  }
}

function buildBlueprintPrototypeDemo(blueprint = {}, payload = {}) {
  const screens = (Array.isArray(blueprint.demoScreens) ? blueprint.demoScreens : []).map((screen, index) => {
    const actions = Array.isArray(screen.actions) ? screen.actions : []
    const screenshotUrl = screenshotForBlueprintScreen(screen, payload)
    return {
      id: screen.id || `screen-${index + 1}`,
      title: screen.title || `页面 ${index + 1}`,
      summary: screen.description || screen.wireframe?.layout || '',
      screenshotUrl,
      source: screenshotUrl ? 'backend-url-capture' : 'website-blueprint-fallback',
      components: screen.wireframe?.components || screen.components || [],
      hotspots: actions.map((action, actionIndex) => ({
        id: `${screen.id || `screen-${index + 1}`}-hotspot-${actionIndex + 1}`,
        label: action.label || `动作 ${actionIndex + 1}`,
        event: action.event || 'click',
        targetScreenId: action.to || action.targetScreenId || action.target || '',
        rect: action.rect || normalizedPrototypeRect(actionIndex, actions.length),
        feedback: action.feedback || '点击后跳转到目标页面'
      }))
    }
  })
  const transitions = screens.flatMap((screen) =>
    (screen.hotspots || [])
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
    source: screens.some((screen) => screen.screenshotUrl) ? 'backend-url-capture' : 'website-blueprint-fallback',
    screens,
    transitions
  }
}

function buildWebsitePrototypeDemoAsset({ blueprint = {}, payload = {}, blueprintAssetId = '', capture = null, captureError = '' } = {}) {
  const demo = buildCapturedPrototypeScreens(capture || payload.prototypeCapture, payload) || buildBlueprintPrototypeDemo(blueprint, payload)
  const metaParts = [`${normalizedSourcePage(payload.url)} · URL 解析原型资产`]
  if (captureError) metaParts.push(`截图采集失败：${captureError}`)
  return {
    id: stableMaterialId([payload.projectId, 'website-prototype-demo', normalizedSourcePage(payload.url)]).replace(/^material-/, 'asset-'),
    projectId: payload.projectId,
    type: 'prototype-demo',
    title: `${blueprint.profile?.productName || blueprint.title || '网站项目'} 交互 Demo`,
    meta: metaParts.join(' · '),
    status: '已生成',
    sourceAssetId: blueprintAssetId,
    sourceUrl: payload.url,
    prototypeDemo: {
      source: demo.source,
      screens: demo.screens,
      screenshotAssets: demo.screenshotAssets || [],
      transitions: demo.transitions
    },
    screenshotAssets: demo.screenshotAssets || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

async function testModelSettings(store, payload = {}, options = {}) {
  const savedSettings = store.settings?.find((item) => item.key === 'workflowModelProvider')?.value || {}
  const incomingSettings = { ...(payload.modelSettings || {}) }
  if (!incomingSettings.apiKey || incomingSettings.apiKey === '__KEEP__') incomingSettings.apiKey = savedSettings.apiKey || ''
  const settings = {
    ...modelSettingsView(store),
    ...savedSettings,
    ...incomingSettings
  }
  const startedAt = Date.now()
  const provider = createAgentProviderFromModelSettings(settings, options.fetchImpl)
  try {
    const result = await provider.generate({
      model: payload.model || settings.defaultModel,
      systemPrompt: [
        '你是模型连通性测试助手。',
        '只输出 JSON，不要输出 Markdown。',
        '返回 {"ok":true,"message":"pong","capability":"workflow-analysis"}。'
      ].join('\n'),
      userPrompt: payload.input || 'ping',
      actionType: 'model-settings-test',
      scopeId: 'settings',
      now: new Date().toISOString()
    })
    const parsed = safeParseModelJson(result.content)
    const validation = {
      ok: parsed.ok && parsed.value?.ok === true,
      parsed: parsed.ok ? parsed.value : null,
      error: parsed.ok ? '' : parsed.error
    }
    const response = {
      status: validation.ok ? 'success' : 'failed',
      provider: result.provider || provider.name,
      model: result.model || settings.defaultModel,
      content: result.content,
      validation,
      usage: result.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      durationMs: Date.now() - startedAt
    }
    await addModelCallLog(store, {
      skillId: 'model-settings-test',
      requestedSkillId: 'model-settings-test',
      resolvedSkillId: 'model-settings-test',
      status: response.status,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      durationMs: response.durationMs,
      demandScope: 'settings',
      projectId: '',
      detectedIntent: 'model-connectivity-test',
      routingReason: '后端模型配置连通性测试',
      fallbackReason: validation.ok ? '' : validation.error,
      createdAt: new Date().toISOString()
    })
    return response
  } catch (error) {
    const response = {
      status: 'failed',
      provider: settings.provider || 'openai-compatible',
      model: payload.model || settings.defaultModel || '',
      content: '',
      validation: { ok: false, parsed: null, error: error.message || '模型测试失败' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      durationMs: Date.now() - startedAt
    }
    await addModelCallLog(store, {
      skillId: 'model-settings-test',
      requestedSkillId: 'model-settings-test',
      resolvedSkillId: 'model-settings-test',
      status: 'error',
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      durationMs: response.durationMs,
      demandScope: 'settings',
      projectId: '',
      detectedIntent: 'model-connectivity-test',
      routingReason: '后端模型配置连通性测试',
      fallbackReason: response.validation.error,
      createdAt: new Date().toISOString()
    })
    return response
  }
}

async function runModelSampleAnalysis(store, payload = {}, options = {}) {
  const savedSettings = store.settings?.find((item) => item.key === 'workflowModelProvider')?.value || {}
  const incomingSettings = { ...(payload.modelSettings || {}) }
  if (!incomingSettings.apiKey || incomingSettings.apiKey === '__KEEP__') incomingSettings.apiKey = savedSettings.apiKey || ''
  const settings = {
    ...modelSettingsView(store),
    ...savedSettings,
    ...incomingSettings
  }
  const provider = createAgentProviderFromModelSettings(settings, options.fetchImpl)
  const modelCallLog = []
  const analysis = await analyzeRequirementDocumentsWithGeneration({
    demandScope: 'project',
    skillId: 'auto',
    skillSelectionMode: 'auto',
    input: payload.input || '做一个登录注册弹窗',
    documents: [],
    agentProvider: provider,
    model: payload.model || settings.defaultModel,
    modelCallLog
  }, {
    agentProvider: provider,
    model: payload.model || settings.defaultModel,
    skillOrchestration: skillOrchestrationSettingsView(store),
    modelCallLog
  })
  for (const entry of modelCallLog) {
    await addModelCallLog(store, {
      ...entry,
      skillId: entry.skillId || analysis.resolvedSkillId,
      requestedSkillId: entry.requestedSkillId || analysis.requestedSkillId,
      resolvedSkillId: entry.resolvedSkillId || analysis.resolvedSkillId,
      demandScope: entry.demandScope || analysis.demandScope,
      projectId: entry.projectId || analysis.projectId || '',
      detectedIntent: entry.detectedIntent || analysis.detectedIntent,
      routingReason: entry.routingReason || analysis.routingReason,
      createdAt: entry.createdAt || new Date().toISOString()
    })
  }
  return { analysis }
}

function resolveWorkspaceAgentProvider(store, options = {}) {
  if (typeof options.resolveAgentProvider === 'function') {
    return options.resolveAgentProvider(options)
  }
  const settings = getModelSettingsRaw(store)
  if (settings.enabled) return createAgentProviderFromModelSettings(settings, options.fetchImpl)
  return options.agentProvider || null
}

export function workspaceRoutes(store, options = {}) {
  const importWebsiteKnowledge = options.importWebsiteKnowledge || ((payload) => buildWebsiteKnowledgeImport(payload))
  const captureWebsitePrototype = options.captureWebsitePrototype || null
  const projectRuntimeService = options.projectRuntimeService || createProjectRuntimeService()
  const authService = createAuthService(store, options.auth || {})

  return {
    ...authService.routes(),
    'GET /api/workspace': async () => workspaceSnapshot(store),
    'PATCH /api/workspace/context': async (payload) => saveWorkspaceContext(store, payload),
    'GET /api/workspace/model-settings': async () => ({
      modelSettings: modelSettingsView(store)
    }),
    'PUT /api/workspace/model-settings': async (payload) => ({
      modelSettings: await saveModelSettings(store, payload)
    }),
    'POST /api/workspace/model-settings/test': async (payload) => testModelSettings(store, payload, options),
    'POST /api/workspace/model-settings/sample-analysis': async (payload) => runModelSampleAnalysis(store, payload, options),
    'POST /api/workspace/markdown-pdf': async (payload) => {
      if (typeof options.renderMarkdownPdf !== 'function') {
        const error = new Error('当前后端未配置 PDF 生成能力')
        error.code = 'PDF_RENDERER_UNAVAILABLE'
        throw error
      }
      const fileName = markdownPdfFileName(payload.fileName || payload.title || 'Markdown 文档.md')
      const body = await options.renderMarkdownPdf({
        markdown: payload.markdown || '',
        fileName,
        title: payload.title || payload.fileName || 'Markdown 文档'
      })
      return {
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        },
        body
      }
    },
    'GET /api/workspace/skill-orchestration-settings': async () => ({
      skillOrchestrationSettings: skillOrchestrationSettingsView(store)
    }),
    'PUT /api/workspace/skill-orchestration-settings': async (payload) => ({
      skillOrchestrationSettings: await saveSkillOrchestrationSettings(store, payload)
    }),
    'POST /api/workspace/projects': async (payload) => {
      const project = await addProject(store, payload)
      return { project }
    },
    'POST /api/workspace/assets': async (payload) => {
      const assetPayload = await persistPrototypeDemoScreenshotAttachments(payload, options)
      const asset = await addAsset(store, assetPayload)
      return { asset }
    },
    'DELETE /api/workspace/assets/:id': async (payload) => {
      return await deleteAsset(store, payload.id)
    },
    'POST /api/workspace/runs': async (payload) => {
      const run = await addRun(store, payload)
      return { run }
    },
    'POST /api/workspace/skills': async (payload) => {
      const skill = await addSkill(store, payload)
      return { skill }
    },
    'PUT /api/workspace/skills/:id': async (payload) => {
      const skill = await updateSkill(store, payload.id, payload)
      return { skill }
    },
    'POST /api/workspace/materials': async (payload) => {
      const material = await addMaterial(store, payload)
      return { material }
    },
    'POST /api/workspace/project-runtime/start': async (payload) => {
      const startedAt = Date.now()
      const runningJob = await addParseJob(store, {
        projectId: payload.projectId,
        sourceType: 'project-runtime',
        sourceUrl: payload.fileName || '',
        action: 'project-runtime-start',
        status: 'running',
        summary: '正在安装依赖并启动外部项目预览'
      })

      try {
        const runtime = await projectRuntimeService.start(payload)
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: runtime.status === 'running' ? 'succeeded' : 'running',
          sourceUrl: runtime.url,
          durationMs: Date.now() - startedAt,
          summary: runtime.status === 'running'
            ? `外部项目预览已启动：${runtime.url}`
            : `外部项目预览启动中：${runtime.url}`
        })
        return { runtime, parseJob }
      } catch (error) {
        await updateParseJob(store, runningJob.id, {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: error.message || '外部项目预览启动失败',
          summary: '外部项目预览启动失败'
        })
        throw error
      }
    },
    'POST /api/workspace/project-runtime/stop': async (payload) => {
      const runtime = await projectRuntimeService.stop(payload.runtimeId || payload.id || '')
      return { runtime }
    },
    'POST /api/workspace/generated-knowledge': async (payload) => {
      const generatedKnowledge = await addGeneratedKnowledge(store, payload)
      return { generatedKnowledge }
    },
    'GET /api/workspace/generated-knowledge': async (payload) => {
      const generatedKnowledge = listGeneratedKnowledge(store, payload)
      return { generatedKnowledge }
    },
    'POST /api/workspace/parse-jobs': async (payload) => {
      const job = await addParseJob(store, payload)
      return { job }
    },
    'GET /api/workspace/parse-jobs': async (payload) => {
      const jobs = listParseJobs(store, payload)
      return { jobs }
    },
    'POST /api/workspace/model-call-logs': async (payload) => {
      const log = await addModelCallLog(store, payload)
      return { log }
    },
    'GET /api/workspace/model-call-logs': async (payload) => {
      const logs = listModelCallLogs(store, payload)
      return { logs }
    },
    'POST /api/workspace/materials/import-website': async (payload) => {
      const startedAt = Date.now()
      const runningJob = await addParseJob(store, {
        projectId: payload.projectId,
        sourceType: 'website',
        sourceUrl: payload.url,
        action: 'website-import',
        status: 'running',
        summary: '正在解析网站并写入知识库'
      })

      try {
        const imported = await importWebsiteKnowledge(payload)
        const materials = []
        for (const item of imported.items) {
          materials.push(await addMaterial(store, {
            ...item,
            id: stableMaterialId([
              item.projectId || payload.projectId,
              'website',
              normalizedSourcePage(item.sourceUrl || payload.url),
              item.category,
              item.title
            ]),
            projectId: item.projectId || payload.projectId,
            type: 'knowledge'
          }))
        }
        let blueprintAsset = null
        let prototypeAsset = null
        let blueprintMaterials = []
        let prototypeCapture = null
        let prototypeCaptureError = ''
        if (payload.generateBlueprint) {
          const captureTargets = prototypeCaptureTargets(imported, payload)
          if (captureWebsitePrototype && captureTargets.length) {
            try {
              prototypeCapture = await captureWebsitePrototype({
                projectId: payload.projectId,
                url: payload.url,
                sourceUrl: payload.url,
                scope: payload.scope || 'single',
                pages: captureTargets
              })
            } catch (error) {
              prototypeCaptureError = error.message || '交互 Demo 截图采集失败'
            }
          }
          const blueprintDocument = websiteBlueprintDocumentFromImport(imported, payload)
          const blueprint = buildProjectBlueprint({
            project: {
              id: payload.projectId,
              name: blueprintDocument.name.replace(/\s+网站解析\.md$/, '').replace(/\.md$/, '') || payload.url || '网站项目',
              description: `由 ${normalizedSourcePage(payload.url)} 网站 URL 解析生成`
            },
            input: websiteBlueprintInput(imported, payload),
            documents: [blueprintDocument]
          })
          blueprintAsset = await addAsset(store, {
            id: stableMaterialId([payload.projectId, 'website-blueprint', normalizedSourcePage(payload.url)]).replace(/^material-/, 'asset-'),
            projectId: payload.projectId,
            type: 'project-blueprint',
            title: blueprint.title,
            meta: `${normalizedSourcePage(payload.url)} · URL 解析生成`,
            status: '已生成',
            content: blueprint.designMarkdown || '',
            blueprint,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          prototypeAsset = await addAsset(store, buildWebsitePrototypeDemoAsset({
            blueprint,
            payload,
            blueprintAssetId: blueprintAsset.id,
            capture: prototypeCapture,
            captureError: prototypeCaptureError
          }))
          const blueprintItems = blueprintKnowledgeItems(blueprint, {
            projectId: payload.projectId,
            sourceAssetId: blueprintAsset.id
          })
          for (const item of blueprintItems) {
            blueprintMaterials.push(await addMaterial(store, {
              ...item,
              id: stableMaterialId([
                payload.projectId,
                'website-blueprint',
                blueprintAsset.id,
                item.category,
                item.title
              ]),
              projectId: item.projectId || payload.projectId,
              type: 'knowledge'
            }))
          }
        }
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: 'succeeded',
          materialCount: materials.length + blueprintMaterials.length,
          durationMs: Date.now() - startedAt,
          summary: blueprintAsset
            ? `已导入 ${materials.length} 条网站知识，并生成 1 份项目蓝图、1 份交互 Demo、${blueprintMaterials.length} 条蓝图知识`
            : `已导入 ${materials.length} 条网站知识`
        })
        return {
          summary: imported.summary,
          materials,
          blueprintAsset,
          prototypeAsset,
          blueprintMaterials,
          parseJob
        }
      } catch (error) {
        await updateParseJob(store, runningJob.id, {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: error.message || '网站解析失败',
          summary: '网站解析失败'
        })
        throw error
      }
    },
    'POST /api/workspace/materials/import-blueprint': async (payload) => {
      const startedAt = Date.now()
      const runningJob = await addParseJob(store, {
        projectId: payload.projectId,
        sourceType: 'blueprint',
        sourceAssetId: payload.sourceAssetId,
        action: 'blueprint-import',
        status: 'running',
        summary: '正在从项目蓝图沉淀知识'
      })

      try {
        const items = blueprintKnowledgeItems(payload.blueprint, {
          projectId: payload.projectId,
          sourceAssetId: payload.sourceAssetId
        })
        const materials = []
        for (const item of items) {
          materials.push(await addMaterial(store, {
            ...item,
            id: stableMaterialId([
              payload.projectId,
              'blueprint',
              payload.sourceAssetId,
              item.category,
              item.title
            ]),
            projectId: item.projectId || payload.projectId,
            type: 'knowledge'
          }))
        }
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: 'succeeded',
          sourceType: 'blueprint',
          sourceAssetId: payload.sourceAssetId,
          materialCount: materials.length,
          durationMs: Date.now() - startedAt,
          summary: `已从蓝图导入 ${materials.length} 条知识`
        })
        return {
          summary: {
            total: items.length,
            parsed: materials.length,
            failed: 0,
            sourceType: 'blueprint'
          },
          materials,
          parseJob
        }
      } catch (error) {
        await updateParseJob(store, runningJob.id, {
          status: 'failed',
          sourceType: 'blueprint',
          durationMs: Date.now() - startedAt,
          error: error.message || '蓝图导入失败',
          summary: '蓝图导入失败'
        })
        throw error
      }
    },
    'POST /api/workspace/materials/import-project-package': async (payload) => {
      const startedAt = Date.now()
      const runningJob = await addParseJob(store, {
        projectId: payload.projectId,
        sourceType: 'project-package',
        sourceUrl: payload.fileName || '',
        action: 'project-package-import',
        status: 'running',
        summary: '正在静态分析项目包并写入知识库'
      })

      try {
        const imported = buildProjectPackageKnowledgeImport(payload)
        const materials = []
        for (const item of imported.items) {
          materials.push(await addMaterial(store, {
            ...item,
            id: stableMaterialId([
              item.projectId || payload.projectId,
              'project-package',
              payload.fileName,
              item.category,
              item.title
            ]),
            projectId: item.projectId || payload.projectId,
            type: 'knowledge'
          }))
        }
        const blueprintAsset = imported.blueprint
          ? await addAsset(store, {
              id: stableMaterialId([
                payload.projectId,
                'project-package-blueprint',
                payload.fileName,
                imported.blueprint.title
              ]).replace(/^material-/, 'asset-'),
              projectId: payload.projectId,
              module: 'knowledge',
              type: 'blueprint',
              title: imported.blueprint.title || `${imported.summary.packageName} 项目蓝图`,
              meta: `项目包导入 · ${payload.fileName || imported.summary.packageName}`,
              status: '已生成',
              content: imported.markdown || '',
              blueprint: imported.blueprint,
              sourceUrl: payload.fileName || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          : null
        const prototypeAsset = imported.prototypeDemo
          ? await addAsset(store, await persistPrototypeDemoScreenshotAttachments({
              id: stableMaterialId([
                payload.projectId,
                'project-package-prototype-demo',
                payload.fileName,
                imported.prototypeDemo.screens?.map((screen) => screen.id).join(',')
              ]).replace(/^material-/, 'asset-'),
              projectId: payload.projectId,
              module: 'knowledge',
              type: 'prototype-demo',
              title: `${imported.summary.packageName} 交互 Demo`,
              meta: `项目包导入 · ${payload.fileName || imported.summary.packageName}`,
              status: '已生成',
              content: '',
              prototypeDemo: imported.prototypeDemo,
              sourceAssetId: blueprintAsset?.id || '',
              sourceUrl: payload.fileName || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, options))
          : null
        const assetCount = Number(Boolean(blueprintAsset)) + Number(Boolean(prototypeAsset))
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: 'succeeded',
          sourceType: 'project-package',
          sourceUrl: payload.fileName || '',
          materialCount: materials.length + assetCount,
          durationMs: Date.now() - startedAt,
          summary: `已从项目包导入 ${materials.length} 条知识${blueprintAsset ? '，生成 1 份结构蓝图' : ''}${prototypeAsset ? '，生成 1 份交互 Demo' : ''}`
        })
        return {
          summary: imported.summary,
          materials,
          blueprintAsset,
          prototypeAsset,
          markdown: imported.markdown,
          parseJob
        }
      } catch (error) {
        await updateParseJob(store, runningJob.id, {
          status: 'failed',
          sourceType: 'project-package',
          sourceUrl: payload.fileName || '',
          durationMs: Date.now() - startedAt,
          error: error.message || '项目包导入失败',
          summary: '项目包导入失败'
        })
        throw error
      }
    },
    'POST /api/workspace/materials/import-documents': async (payload) => {
      const startedAt = Date.now()
      const documents = Array.isArray(payload.documents) ? payload.documents : []
      const runningJob = await addParseJob(store, {
        projectId: payload.projectId,
        sourceType: 'document',
        action: 'document-import',
        status: 'running',
        summary: '正在解析上传文档并写入资料库'
      })

      try {
        const materials = []
        const failedDocuments = []
        for (const document of documents) {
          const text = normalizeDocumentText(document)
          if (!text) {
            failedDocuments.push({
              name: document.name || '未命名文档',
              reason: '文档内容为空或无法解析'
            })
            continue
          }
          const createdAt = new Date().toISOString()
          const materialId = stableMaterialId([
            payload.projectId,
            'document',
            payload.type || 'requirements',
            document.id || document.name || 'document'
          ])
          const preview = await persistMaterialPreviewFile(materialId, document.preview, options)
          materials.push(await addMaterial(store, {
            id: materialId,
            projectId: payload.projectId,
            type: payload.type || 'requirements',
            title: document.name || '未命名文档',
            meta: document.type || 'document',
            status: payload.type === 'requirements' ? '待设计' : '已解析',
            content: text,
            preview,
            summary: text.replace(/\s+/g, ' ').slice(0, 180),
            sourceType: 'document',
            requirementSource: payload.type === 'requirements' ? (document.requirementSource || 'product') : document.requirementSource,
            knowledgeStatus: payload.type === 'requirements' ? (document.knowledgeStatus || 'pending') : document.knowledgeStatus,
            uploadedAt: createdAt,
            sourceAssetId: document.id || '',
            chunks: [{
              id: `${document.id || document.name || 'document'}-chunk-1`,
              heading: document.name || '文档内容',
              text,
              roleScopes: ['product', 'ux', 'development', 'ai-retrieval']
            }],
            evidence: [{
              type: 'document',
              title: document.name || '未命名文档',
              text: text.slice(0, 240),
              capturedAt: createdAt
            }],
            verification: {
              status: 'unverified',
              reason: '上传文档自动解析，等待人工确认。'
            },
            createdAt,
            updatedAt: createdAt
          }))
        }
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: 'succeeded',
          sourceType: 'document',
          materialCount: materials.length,
          failedCount: failedDocuments.length,
          durationMs: Date.now() - startedAt,
          summary: `已解析 ${materials.length} 个文档，失败 ${failedDocuments.length} 个`
        })
        return {
          summary: {
            total: documents.length,
            parsed: materials.length,
            failed: failedDocuments.length
          },
          materials,
          failedDocuments,
          parseJob
        }
      } catch (error) {
        await updateParseJob(store, runningJob.id, {
          status: 'failed',
          sourceType: 'document',
          durationMs: Date.now() - startedAt,
          error: error.message || '文档导入失败',
          summary: '文档导入失败'
        })
        throw error
      }
    },
    'POST /api/workspace/materials/search': async (payload) => {
      const results = searchMaterials(store, payload)
      return {
        query: payload.query || '',
        roleScope: payload.roleScope || '',
        results
      }
    },
    'POST /api/workspace/materials/governance': async (payload) => {
      return await governMaterials(store, payload)
    },
    'POST /api/workspace/materials/export-role-package': async (payload) => {
      return exportRoleKnowledgePackage(store, payload)
    },
    'POST /api/workspace/analysis/repair': async (payload) => repairAnalysisResult(payload),
    'GET /api/workspace/materials': async (payload) => {
      const materials = listMaterials(store, payload)
      return { materials }
    },
    'GET /api/workspace/materials/:id': async (payload) => {
      const material = getMaterial(store, payload.id)
      return { material }
    },
    'GET /api/workspace/material-previews/:fileName': async (payload) => {
      const storedPreview = materialPreviewFromWorkspaceRecord(store, payload.fileName)
      if (storedPreview) return storedPreview
      const filePath = materialPreviewPath(payload.fileName, options)
      if (!filePath) {
        const error = new Error('资料预览文件不存在')
        error.code = 'MATERIAL_PREVIEW_NOT_FOUND'
        throw error
      }
      const body = await readFile(filePath)
      return { contentType: materialPreviewContentType(filePath), body }
    },
    'PATCH /api/workspace/materials/:id': async (payload) => {
      const material = await updateMaterial(store, payload.id, payload)
      return { material }
    },
    'DELETE /api/workspace/materials/:id': async (payload) => {
      return await deleteMaterial(store, payload.id)
    },
    'POST /api/workspace/restored-pages': async (payload) => {
      const restoredPage = await addRestoredPage(store, payload)
      return { restoredPage }
    },
    'GET /api/workspace/restored-pages/:id': async (payload) => {
      const restoredPage = getRestoredPage(store, payload.id)
      return { restoredPage }
    },
    'DELETE /api/workspace/restored-pages/:id': async (payload) => {
      return await deleteRestoredPage(store, payload.id)
    },
    'GET /api/workspace/restored-pages/:id/preview': async (payload) => restoredPagePreview(store, payload.id),
    'GET /api/workspace/restored-pages/:id/frame': async (payload) => restoredPageFrame(store, payload.id),
    'GET /api/workspace/restored-pages/:id/source': async (payload) => restoredPageSource(store, payload.id),
    'GET /api/workspace/workflow-runs/:id': async (payload) => {
      const run = getWorkflowRun(store, payload.id)
      return {
        run: await hydrateWorkflowRunDetail(store, run, options)
      }
    },
    'DELETE /api/workspace/workflow-runs/:id': async (payload) => {
      return await deleteWorkflowRun(store, payload.id)
    },
    'POST /api/workspace/workflow-runs/:id/import-acceptance-knowledge': async (payload) => {
      const run = getWorkflowRun(store, payload.id || payload.runId)
      if (!run) {
        const error = new Error('工作流分析记录不存在')
        error.code = 'WORKFLOW_RUN_NOT_FOUND'
        throw error
      }
      const startedAt = Date.now()
      const runningJob = await addParseJob(store, {
        projectId: payload.projectId || run.projectId,
        sourceType: 'workflow-analysis',
        sourceAssetId: run.id,
        action: 'workflow-acceptance-import',
        status: 'running',
        summary: '正在从总流程验收沉淀阶段写入知识库'
      })
      try {
        const items = workflowAcceptanceKnowledgeItems(run, payload)
        const materials = []
        for (const item of items) {
          materials.push(await addMaterial(store, item))
        }
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: 'succeeded',
          sourceType: 'workflow-analysis',
          sourceAssetId: run.id,
          materialCount: materials.length,
          durationMs: Date.now() - startedAt,
          summary: materials.length
            ? `已从总流程验收沉淀导入 ${materials.length} 条知识`
            : '总流程暂无可沉淀的验收节点'
        })
        return {
          summary: {
            total: items.length,
            parsed: materials.length,
            failed: 0,
            sourceType: 'workflow-analysis'
          },
          materials,
          parseJob
        }
      } catch (error) {
        const parseJob = await updateParseJob(store, runningJob.id, {
          status: 'failed',
          sourceType: 'workflow-analysis',
          sourceAssetId: run.id,
          durationMs: Date.now() - startedAt,
          summary: error.message || '总流程验收沉淀导入失败'
        })
        return {
          summary: {
            total: 0,
            parsed: 0,
            failed: 1,
            sourceType: 'workflow-analysis'
          },
          materials: [],
          parseJob,
          error: error.message || '总流程验收沉淀导入失败'
        }
      }
    },
    ...workflowRoutes(store, {
      persist: (run) => upsertWorkflowRun(store, run),
      update: (id, updater) => updateWorkflowRun(store, id, updater),
      agentProvider: () => resolveWorkspaceAgentProvider(store, options),
      persistGeneratedImages: true,
      generatedImageDir: options.generatedImageDir,
      fallback: options.fallback
    })
  }
}
