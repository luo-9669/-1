import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import JSZip from 'jszip'
import {
  acceptCurrentStep,
  applyCandidateOption,
  canAdvanceStep,
  canEnterNextStep,
  createWorkflowRun,
  ensureFinalConclusion,
  getBuiltinWorkflows,
  produceStepOutput,
  completeCurrentStep,
  exportWorkflowRunMarkdown,
  generateStepDraft,
  regenerateStepDraft
} from '../src/services/workflows.js'
import {
  availableProjectSkills,
  createProject,
  DEFAULT_PROJECT_ID,
  reconcileProjectSelection,
  normalizeWorkspaceState,
  projectScopedContext,
  stripEphemeralWorkspaceState,
  scopeItems
} from '../src/services/projectWorkspace.js'
import { buildSkillExecutionContext, createSystemSkills, normalizeSkill } from '../src/services/skills.js'
import {
  blueprintKnowledgeItems,
  buildBlueprintDemoHtml,
  buildProjectBlueprint,
  deleteMaterialItemsById,
  exportBlueprintMarkdown,
  toggleAllMaterialIds
} from '../src/services/projectBlueprint.js'
import { buildDocumentAnalysisView } from '../src/services/documentAnalysis.js'
import { analyzeRequirementDocuments } from '../后端/services/document-parser.js'
import { getSkillDefinition, listSkillDefinitions } from '../后端/services/skill-registry.js'
import { orchestrateRequirementSkill } from '../后端/services/skill-orchestrator.js'
import { runSkillGeneration, safeParseModelJson } from '../后端/services/generation-runner.js'
import { buildSkillPrompt } from '../后端/services/prompt-builder.js'
import { validateSkillOutput } from '../后端/services/schema-validator.js'
import { importLocalDocuments, normalizeExtractedText } from '../src/services/documentImport.js'
import { buildWebsiteKnowledgeBatchImport, buildWebsiteKnowledgeImport, parseWebsiteHtml } from '../src/services/websiteKnowledge.js'
import { compactWorkspaceStateForStorage, saveState } from '../src/services/storage.js'
import {
  captureQualityGate,
  captureRestoreReadiness,
  captureActionState,
  captureLoadingExperience,
  createRestoredPageAsset,
  restoredPagePreviewSummary,
  restoredPagePreviewHtml,
  normalizeFactoryWorkspace,
  restoredPagesForProject
} from '../src/services/factoryWorkspace.js'
import {
  buildSnapshotCaptureRequest,
  normalizeSnapshotAuthMode,
  snapshotCaptureStatusMessage
} from '../src/services/snapshotCapture.js'
import {
  designSourceFromCaptureResult,
  designSourcesForProject,
  upsertDesignSource
} from '../src/services/designSources.js'
import { parseWebsnapFile } from '../src/services/websnap.js'
import {
  buildVisualVerificationReport,
  visualVerificationPassed
} from '../src/services/visualVerification.js'
import { compareImageDataUrls } from '../src/services/visualVerification.node.js'
import {
  buildWorkflowWorkbenchView,
  buildWorkflowAgentSession,
  defaultWorkflowStepInputs,
  buildWorkflowArtifactStages
} from '../src/services/workflowWorkbench.js'
import {
  buildKnowledgeHubView,
  buildBlueprintIndex,
  classifyKnowledgeMaterial,
  relatedKnowledgeForBlueprintNode
} from '../src/services/knowledgeHub.js'
import {
  buildPrototypeDemoAsset,
  selectPrototypeDemoScreen
} from '../src/services/prototypeDemo.js'
import {
  KNOWLEDGE_DEPOSIT_TYPES,
  buildKnowledgeDepositPayload
} from '../src/services/knowledgeDeposit.js'
import {
  buildBlueprintWorkbench,
  visibleBlueprintFrameNodes
} from '../src/services/blueprintWorkbench.js'
import { getSidebarNavItems } from '../src/services/navigation.js'
import {
  createWorkspaceStore,
  workspaceRoutes
} from '../后端/routes/workspace.js'
import { saveModelSettings } from '../后端/services/workspace-store.js'
import { uploadRoutes } from '../后端/routes/uploads.js'
import { captureRoutes } from '../后端/routes/capture.js'
import { createWorkflowRunnerStore, workflowRoutes } from '../后端/routes/workflows.js'
import { buildAgentContext } from '../后端/services/agent-context-builder.js'
import {
  createDeterministicAgentProvider,
  createOpenAICompatibleAgentProvider,
  normalizeModelProviderError
} from '../后端/services/llm-provider.js'
import { generateAgentReply } from '../后端/services/agent-service.js'
import { buildAdminSummary } from '../后端/services/admin-dashboard.js'
import { adminRoutes } from '../后端/routes/admin.js'
import { renderAdminConsoleHtml } from '../后端/services/admin-console.js'
import { createBrowserSessionManager } from '../server/browser-session-manager.mjs'
import { matchRoute, routes } from '../server/mock-api.mjs'

async function test(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

function pngDataUrl([r, g, b, a = 255]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const chunk = (type, data) => Buffer.concat([
    Buffer.alloc(4, data.length),
    Buffer.from(type),
    data,
    Buffer.alloc(4)
  ].map((item, index) => {
    if (index === 0) item.writeUInt32BE(data.length, 0)
    return item
  }))
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = deflateSync(Buffer.from([0, r, g, b, a]))
  return `data:image/png;base64,${Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]).toString('base64')}`
}

function solidPngDataUrl(width, height, [r, g, b, a = 255]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    return value >>> 0
  })
  const crc32 = (buffer) => {
    let crc = 0xffffffff
    for (const byte of buffer) {
      crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const typeBuffer = Buffer.from(type)
    const payload = Buffer.concat([typeBuffer, data])
    const output = Buffer.alloc(12 + data.length)
    output.writeUInt32BE(data.length, 0)
    typeBuffer.copy(output, 4)
    data.copy(output, 8)
    output.writeUInt32BE(crc32(payload), 8 + data.length)
    return output
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const row = Buffer.alloc(1 + width * 4)
  row[0] = 0
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4
    row[offset] = r
    row[offset + 1] = g
    row[offset + 2] = b
    row[offset + 3] = a
  }
  const idat = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))
  return `data:image/png;base64,${Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]).toString('base64')}`
}

test('provides demand decomposition and journey map workflows', () => {
  const workflows = getBuiltinWorkflows()
  assert.ok(workflows.find((workflow) => workflow.id === 'demand-four-step'))
  assert.ok(workflows.find((workflow) => workflow.id === 'user-journey-map-flow'))
  assert.ok(workflows.find((workflow) => workflow.id === 'eight-module-fuzzy-architecture'))
  assert.ok(workflows.find((workflow) => workflow.id === 'five-stage-client-c-consensus-breakdown'))
  assert.equal(workflows.find((workflow) => workflow.id === 'demand-four-step').steps.length, 4)
  assert.equal(workflows.find((workflow) => workflow.id === 'user-journey-map-flow').steps.length, 7)
  assert.equal(workflows.find((workflow) => workflow.id === 'eight-module-fuzzy-architecture').steps.length, 8)
  assert.equal(workflows.find((workflow) => workflow.id === 'five-stage-client-c-consensus-breakdown').steps.length, 5)
})

test('design scheme puts interaction skill second', () => {
  const workflows = getBuiltinWorkflows()
  assert.equal(workflows[1].id, 'product-interaction-design-review-skill')
  assert.equal(workflows[1].name, '交互skill')
  assert.equal(new Set(workflows.map((workflow) => workflow.id)).size, workflows.length)
})

test('backend skill registry stays synced with frontend system skills and workflows', () => {
  const frontendIds = new Set([
    ...createSystemSkills().filter((skill) => skill.source === 'system').map((skill) => skill.id),
    ...getBuiltinWorkflows().map((workflow) => workflow.id)
  ])
  const backendIds = new Set(listSkillDefinitions().map((skill) => skill.id))
  const runtimeSkillIds = [
    'smart-recommendation-skill',
    'product-interaction-design-review-skill',
    'demand-four-step',
    'demand-card-flow',
    'eight-module-fuzzy-architecture',
    'five-stage-client-c-consensus-breakdown',
    'user-journey-map-flow',
    'interaction-design-workflow',
    'podcastor-product-flow'
  ]

  runtimeSkillIds.forEach((skillId) => {
    assert.ok(frontendIds.has(skillId), `${skillId} should exist in frontend skills or workflows`)
    assert.ok(backendIds.has(skillId), `${skillId} should exist in backend registry`)
  })

  const interactionSkill = getSkillDefinition('product-interaction-design-review-skill')
  assert.equal(interactionSkill.name, '交互skill')
  assert.equal(interactionSkill.outputSchema, 'product-interaction-review')
  assert.match(interactionSkill.promptTemplate, /业务目标|用户任务|信息架构|异常边界|交付协作/)
})

test('sidebar navigation uses project workspace labels and semantic icon names', () => {
  const items = getSidebarNavItems()
  assert.deepEqual(items.map((item) => item.label), [
    '需求文档',
    '知识库',
    '设计方案',
    '工程开发',
    '交付资产',
    '技能中心',
    '竞品监控'
  ])
  assert.deepEqual(items.map((item) => item.icon), [
    'file-text',
    'book-open',
    'route',
    'layout',
    'archive',
    'spark',
    'radar'
  ])
})

testAsync('sidebar exposes competitor monitoring below skill center', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const navSource = await readFile(new URL('../src/services/navigation.js', import.meta.url), 'utf8')

  assert.match(navSource, /key: 'skillCenter'[\s\S]*key: 'competitors'/)
  assert.match(navSource, /key: 'competitors', label: '竞品监控', icon: 'radar'/)
  assert.match(appSource, /if \(key === 'competitors'\)[\s\S]*materialsTab\.value = 'competitors'[\s\S]*activeView\.value = 'materials'/)
  assert.match(appSource, /if \(key === 'competitors'\) return activeView\.value === 'materials' && materialsTab\.value === 'competitors'/)
  assert.match(appSource, /radar:\s*\[/)
})

testAsync('app shell maps every primary page to a stable hash route', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /const APP_PAGE_ROUTES = \{/)
  assert.match(appSource, /requirements:\s*'\/projects\/:projectId\/requirements'/)
  assert.match(appSource, /materials:\s*'\/projects\/:projectId\/knowledge'/)
  assert.match(appSource, /workflow:\s*'\/projects\/:projectId\/design'/)
  assert.match(appSource, /factory:\s*'\/projects\/:projectId\/factory'/)
  assert.match(appSource, /assets:\s*'\/projects\/:projectId\/assets'/)
  assert.match(appSource, /skillCenter:\s*'\/projects\/:projectId\/skills'/)
  assert.match(appSource, /competitors:\s*'\/projects\/:projectId\/competitors'/)
  assert.match(appSource, /settings:\s*'\/projects\/:projectId\/settings'/)
  assert.match(appSource, /function projectScopedRoute\(/)
  assert.match(appSource, /function parseProjectScopedHash\(/)
  assert.match(appSource, /function syncRouteToView\(key/)
  assert.match(appSource, /function restoreAppRouteFromUrl\(\)/)
  assert.match(appSource, /function initialActiveViewFromHash\(\)/)
  assert.match(appSource, /projectRoute\?\.route\?\.startsWith\('\/factory'\)[\s\S]*projectRoute\?\.route\?\.startsWith\('\/assets\/'\)[\s\S]*return 'factory'/)
  assert.match(appSource, /const activeView = ref\(initialActiveViewFromHash\(\)\)/)
  assert.match(appSource, /const isFactoryView = computed/)
  assert.match(appSource, /isFactoryHash\(window\.location\.hash\)/)
  assert.match(appSource, /if \(key === 'factory'\) return isFactoryView\.value/)
  assert.match(appSource, /restoreAppRouteFromUrl\(\)/)
  assert.match(appSource, /window\.addEventListener\('hashchange', restoreAppRouteFromUrl\)/)
  assert.match(appSource, /window\.removeEventListener\('hashchange', restoreAppRouteFromUrl\)/)
  assert.match(appSource, /if \(hash === '#\/workflow'\)[\s\S]*applyRouteState\('workflow'/)
  assert.match(appSource, /if \(projectRoute && restoreProjectScopedRoute\(projectRoute\)\) return true/)
  assert.match(appSource, /case '#\/knowledge':[\s\S]*applyRouteState\('materials'/)
  assert.match(appSource, /case '#\/competitors':[\s\S]*applyRouteState\('competitors'/)
  assert.match(appSource, /window\.history\.(pushState|replaceState)\(null,\s*'',\s*projectScopedUrl\(route\)\)/)
  assert.match(appSource, /function openSnapshotAsset\(assetId/)
  assert.match(appSource, /openSnapshotAsset\(asset\.id\)/)
  assert.match(appSource, /function openSkillCenterForCreation\(\)/)
  assert.match(appSource, /openSkillCenterForCreation/)
  assert.match(appSource, /function startRecommendedWorkflow\(workflowId\)[\s\S]*syncRouteToView\('workflow'\)/)
})

testAsync('app shell moves project and settings into account popover', async () => {
  const navSource = await readFile(new URL('../src/services/navigation.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const sidebarStart = appSource.indexOf('<aside class="sidebar">')
  const sidebarEnd = appSource.indexOf('</aside>', sidebarStart)
  const sidebarSource = appSource.slice(sidebarStart, sidebarEnd)
  const mainStart = appSource.indexOf('<main class="main">')
  const firstModalStart = appSource.indexOf('<div v-if="showProjectPicker"', mainStart)
  const mainChromeSource = appSource.slice(mainStart, firstModalStart)

  assert.doesNotMatch(navSource, /key: 'projects'/)
  assert.doesNotMatch(navSource, /key: 'settings'/)
  assert.match(navSource, /key: 'requirements', label: '需求文档'/)
  assert.match(navSource, /key: 'materials', label: '知识库'/)
  assert.match(navSource, /key: 'workflow', label: '设计方案'/)
  assert.match(navSource, /key: 'factory', label: '工程开发'/)
  assert.match(navSource, /key: 'assets', label: '交付资产'/)
  assert.match(navSource, /key: 'skillCenter', label: '技能中心'/)
  assert.match(sidebarSource, /class="account-dock"/)
  assert.match(sidebarSource, /:class="\{ open: accountDockOpen \}"/)
  assert.match(sidebarSource, /@mouseenter="accountDockOpen = true"/)
  assert.match(sidebarSource, /class="account-hover-bridge"/)
  assert.match(sidebarSource, /class="account-project-popover"/)
  assert.match(sidebarSource, /currentUser/)
  assert.doesNotMatch(sidebarSource, /class="account-current-project"/)
  assert.match(sidebarSource, /class="account-project-item"/)
  assert.match(sidebarSource, /class="account-project-switch"/)
  assert.match(sidebarSource, /selectProject\(project\.id\)/)
  assert.match(sidebarSource, /个人设置/)
  assert.match(sidebarSource, /系统设置/)
  assert.doesNotMatch(mainChromeSource, /account-topbar|account-trigger|account-project-popover/)
  assert.doesNotMatch(appSource, /showAccountProjectPopover/)
  assert.match(appSource, /const accountDockOpen = ref\(false\)/)
  assert.match(cssSource, /\.account-dock:hover\s+\.account-project-popover/)
  assert.match(cssSource, /\.account-dock:focus-within\s+\.account-project-popover/)
  assert.match(cssSource, /\.account-dock\.open\s+\.account-project-popover/)
  assert.match(cssSource, /\.account-hover-bridge/)
  assert.match(cssSource, /\.account-dock:hover\s+\.account-hover-bridge/)
  assert.match(cssSource, /\.account-hover-bridge:hover\s*\+\s*\.account-project-popover/)
  assert.match(cssSource, /width:\s*min\(620px,\s*calc\(100vw - 120px\)\)/)
  assert.match(cssSource, /min-height:\s*min\(620px,\s*calc\(100vh - 32px\)\)/)
  assert.match(cssSource, /\.sidebar\s*\{[\s\S]*?z-index:\s*120;/)
  assert.match(cssSource, /\.account-dock\s*\{[\s\S]*?z-index:\s*130;/)
  assert.match(cssSource, /\.account-project-popover\s*\{[\s\S]*?z-index:\s*140;/)
  assert.match(cssSource, /margin-top:\s*auto;/)
  assert.match(appSource, /const accountDockOpen = ref\(false\)/)
  assert.match(appSource, /const currentUser = computed/)
  assert.match(appSource, /const accountProjects = computed/)
})

testAsync('app shell uses zero main padding for edge to edge workspace views', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /<main class="main" :class="\{ 'edge-to-edge': isEdgeToEdgeView \}">/)
  assert.match(appSource, /const isEdgeToEdgeView = computed/)
  assert.match(appSource, /activeView\.value === 'workflow'/)
  assert.match(appSource, /isFactoryView\.value/)
  const mainRule = cssSource.match(/\.main\s*\{[^}]*\}/)?.[0] || ''
  const edgeRule = cssSource.match(/\.main\.edge-to-edge\s*\{[^}]*\}/)?.[0] || ''
  const analysisMainRule = cssSource.match(/\.analysis-focus\s+\.main\s*\{[^}]*\}/)?.[0] || ''
  assert.match(mainRule, /padding:\s*0;/)
  assert.doesNotMatch(mainRule, /padding:\s*24px;/)
  assert.match(edgeRule, /padding:\s*0;/)
  assert.match(analysisMainRule, /padding:\s*0;/)
})

testAsync('workspace account owns backend generated project ids', async () => {
  const workspace = await routes['GET /api/workspace']()

  assert.ok(Array.isArray(workspace.users))
  assert.ok(workspace.currentUserId)
  assert.ok(workspace.users.some((user) => user.id === workspace.currentUserId))
  assert.ok(workspace.projects.every((project) => project.ownerUserId))

  const created = await routes['POST /api/workspace/projects']({
    id: 'frontend-should-not-win',
    ownerUserId: workspace.currentUserId,
    name: '账号下的新项目'
  })

  assert.notEqual(created.project.id, 'frontend-should-not-win')
  assert.equal(created.project.ownerUserId, workspace.currentUserId)

  const after = await routes['GET /api/workspace']()
  assert.ok(after.projects.some((project) =>
    project.id === created.project.id &&
    project.ownerUserId === workspace.currentUserId
  ))
})

testAsync('project account switch persists workspace before full page reload', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const bootStart = appSource.indexOf('const saved = loadState()')
  const bootEnd = appSource.indexOf('const state = reactive(bootState)', bootStart)
  const bootSource = appSource.slice(bootStart, bootEnd)
  const addProjectStart = appSource.indexOf('async function addProject()')
  const addProjectEnd = appSource.indexOf('function applyApiResult', addProjectStart)
  const addProjectSource = appSource.slice(addProjectStart, addProjectEnd)
  const selectProjectStart = appSource.indexOf('async function selectProject(projectId)')
  const selectProjectEnd = appSource.indexOf('function ensurePodcastorProject', selectProjectStart)
  const selectProjectSource = appSource.slice(selectProjectStart, selectProjectEnd)
  const syncStart = appSource.indexOf('async function syncProjectContextBeforeReload(projectId)')
  const syncEnd = appSource.indexOf('function selectNoReferenceProject', syncStart)
  const syncSource = appSource.slice(syncStart, syncEnd)

  assert.match(appSource, /function reloadAfterProjectAccountSwitch\(\)/)
  assert.match(appSource, /saveState\(state\)[\s\S]*window\.location\.reload\(\)/)
  assert.match(appSource, /async function selectProject\(projectId\)/)
  assert.match(appSource, /async function syncProjectContextBeforeReload\(projectId\)/)
  assert.match(appSource, /api\.workspace\.saveContext\(state\.apiConfig,\s*\{[\s\S]*currentProjectId:\s*projectId/)
  assert.match(syncSource, /result\.data\?\.accepted === true/)
  assert.match(syncSource, /result\.data\?\.currentProjectId === projectId/)
  assert.match(syncSource, /throw new Error/)
  assert.match(appSource, /const switchingProjectId = ref\(''\)/)
  assert.match(appSource, /const projectSwitchOverlayMessage = ref\(''\)/)
  assert.match(appSource, /class="project-switch-overlay"/)
  assert.match(appSource, /正在切换项目/)
  assert.match(appSource, /请稍候，正在同步项目数据/)
  assert.match(appSource, /切换成功，正在刷新页面/)
  assert.match(appSource, /switchingProjectId\.value = projectId/)
  assert.match(appSource, /switchingProjectId\.value = ''/)
  assert.match(selectProjectSource, /projectSwitchOverlayMessage\.value = '正在切换项目'/)
  assert.match(selectProjectSource, /projectSwitchOverlayMessage\.value = '切换成功，正在刷新页面'/)
  assert.match(selectProjectSource, /await syncProjectContextBeforeReload\(projectId\)[\s\S]*applyProjectSelection\(\{[\s\S]*currentProjectId: projectId/)
  assert.doesNotMatch(selectProjectSource.slice(0, selectProjectSource.indexOf('await syncProjectContextBeforeReload(projectId)')), /applyProjectSelection\(\{[\s\S]*currentProjectId: projectId/)
  assert.match(selectProjectSource, /catch \(error\)[\s\S]*切换项目失败/)
  assert.match(selectProjectSource, /finally[\s\S]*switchingProjectId\.value = ''/)
  assert.match(selectProjectSource, /projectSwitchOverlayMessage\.value = ''/)
  assert.match(appSource, /:disabled="project\.id === state\.currentProjectId \|\| Boolean\(switchingProjectId\)"/)
  assert.match(appSource, /switchingProjectId === project\.id \? '正在切换\.\.\.'/)
  assert.match(styles, /\.project-switch-overlay/)
  assert.match(styles, /\.project-switch-spinner/)
  assert.match(apiSource, /saveContext\(config,\s*payload\)[\s\S]*\/api\/workspace\/context/)
  assert.match(addProjectSource, /api\.workspace\.createProject/)
  assert.match(addProjectSource, /applyProjectSelection\(\{[\s\S]*currentProjectId: project\.id[\s\S]*\}\)/)
  assert.match(addProjectSource, /await syncProjectContextBeforeReload\(project\.id\)/)
  assert.match(addProjectSource, /reloadAfterProjectAccountSwitch\(\)/)
  assert.doesNotMatch(bootSource, /if\s*\(saved\)\s*\{[\s\S]*?saveState\(bootState\)/)

  const referenceBranchEnd = appSource.indexOf('return', selectProjectStart)
  const referenceBranchSource = appSource.slice(selectProjectStart, referenceBranchEnd)
  assert.doesNotMatch(referenceBranchSource, /reloadAfterProjectAccountSwitch/)
})

testAsync('skill center saves created skills through backend workspace api', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const saveStart = appSource.indexOf('async function saveSkillDraft()')
  const saveSource = appSource.slice(saveStart, appSource.indexOf('function syncWorkflowDraftFromRun', saveStart))
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend()')
  const hydrateSource = appSource.slice(hydrateStart, appSource.indexOf('async function persistWorkspaceRun', hydrateStart))

  assert.match(apiSource, /saveSkill\(config,\s*payload\)[\s\S]*\/api\/workspace\/skills/)
  assert.match(apiSource, /updateSkill\(config,\s*id,\s*payload\)[\s\S]*\/api\/workspace\/skills\/\$\{encodeURIComponent\(id\)\}/)
  assert.match(saveSource, /await\s+persistWorkspaceSkill\(skill\)/)
  assert.match(saveSource, /persistedSkill\.id/)
  assert.match(hydrateSource, /skills:\s*result\.data\.skills\s*\|\|\s*\[\]/)
  assert.match(hydrateSource, /state\.skills\s*=\s*next\.skills/)
})

testAsync('backend workspace context persists selected project for account refresh', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const created = await backendRoutes['POST /api/workspace/projects']({ name: '上下文项目' })
  const saved = await backendRoutes['PATCH /api/workspace/context']({
    currentProjectId: created.project.id
  })
  const workspace = await backendRoutes['GET /api/workspace']()

  assert.equal(saved.currentProjectId, created.project.id)
  assert.equal(workspace.currentProjectId, created.project.id)
})

testAsync('backend workspace persists user created skills with backend ids', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const created = await backendRoutes['POST /api/workspace/skills']({
    name: '团队登录评审 Skill',
    description: '检查登录注册功能的产品和交互边界。',
    category: '交互设计',
    visibility: 'project',
    projectId: store.currentProjectId,
    applicableScenarios: ['登录注册评审'],
    requiredInputs: ['业务目标'],
    knowledgeScopes: ['需求文档'],
    steps: ['检查主流程', '补齐异常状态'],
    outputFormat: '评审报告',
    qualityChecks: ['状态完整']
  })

  assert.ok(created.skill.id.startsWith('skill-'))
  assert.equal(created.skill.source, 'user')
  assert.equal(created.skill.status, 'active')
  assert.equal(created.skill.projectId, store.currentProjectId)
  assert.deepEqual(created.skill.steps, ['检查主流程', '补齐异常状态'])

  const updated = await backendRoutes['PUT /api/workspace/skills/:id']({
    id: created.skill.id,
    name: '团队登录评审 Skill v2',
    visibility: 'global',
    steps: ['检查主流程', '补齐异常状态', '输出接口契约']
  })
  const workspace = await backendRoutes['GET /api/workspace']()

  assert.equal(updated.skill.id, created.skill.id)
  assert.equal(updated.skill.name, '团队登录评审 Skill v2')
  assert.equal(updated.skill.projectId, '')
  assert.ok(workspace.skills.some((skill) => skill.id === created.skill.id && skill.name === '团队登录评审 Skill v2'))
})

testAsync('backend generated knowledge is stored separately and searched before materials', async () => {
  const store = createWorkspaceStore({
    currentUserId: 'user-local-default',
    currentProjectId: 'project-a',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [{ id: 'project-a', ownerUserId: 'user-local-default', name: '项目 A' }],
    assets: [],
    skillRuns: [],
    materials: [
      {
        id: 'material-login',
        projectId: 'project-a',
        type: 'knowledge',
        title: '上传文档里的登录方案',
        content: '登录注册采用邮箱密码。',
        roleScopes: ['ai-retrieval'],
        chunks: [{ id: 'm1', text: '登录注册采用邮箱密码。', roleScopes: ['ai-retrieval'] }]
      }
    ],
    generatedKnowledge: [],
    parseJobs: [],
    restoredPages: [],
    workflowRuns: [],
    skills: [],
    settings: []
  })
  const backendRoutes = workspaceRoutes(store)

  const created = await backendRoutes['POST /api/workspace/generated-knowledge']({
    projectId: 'project-a',
    sourceRunId: 'run-login',
    sourceSkillId: 'product-interaction-design-review-skill',
    title: '用户确认后的登录方案',
    content: '登录注册采用手机号验证码优先，邮箱密码作为备用路径。',
    roleScopes: ['ai-retrieval'],
    verifiedStatus: 'verified'
  })
  const searched = await backendRoutes['POST /api/workspace/materials/search']({
    projectId: 'project-a',
    query: '登录注册',
    roleScope: 'ai-retrieval',
    limit: 5
  })
  const workspace = await backendRoutes['GET /api/workspace']()

  assert.equal(created.generatedKnowledge.projectId, 'project-a')
  assert.equal(created.generatedKnowledge.knowledgeSource, 'generated')
  assert.ok(Array.isArray(workspace.generatedKnowledge))
  assert.ok(workspace.generatedKnowledge.some((item) => item.id === created.generatedKnowledge.id))
  assert.equal(searched.results[0].knowledgeSource, 'generated')
  assert.equal(searched.results[0].title, '用户确认后的登录方案')
  assert.ok(searched.results.some((item) => item.knowledgeSource === 'material'))
})

testAsync('backend route knowledge is fallback after generated knowledge and materials miss', async () => {
  const store = createWorkspaceStore({
    currentUserId: 'user-local-default',
    currentProjectId: 'project-a',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [{ id: 'project-a', ownerUserId: 'user-local-default', name: '项目 A' }],
    assets: [],
    skillRuns: [],
    materials: [
      {
        id: 'material-login',
        projectId: 'project-a',
        type: 'knowledge',
        title: '项目登录知识',
        content: '登录注册采用手机号验证码。',
        roleScopes: ['ai-retrieval'],
        chunks: [{ id: 'm1', text: '登录注册采用手机号验证码。', roleScopes: ['ai-retrieval'] }]
      }
    ],
    generatedKnowledge: [],
    backendKnowledge: [
      {
        id: 'backend-auth-route',
        title: '登录注册路由备份知识',
        content: 'auth-page-generation 只作为后端路由兜底能力。',
        category: 'route-fallback',
        roleScopes: ['ai-retrieval']
      }
    ],
    parseJobs: [],
    restoredPages: [],
    workflowRuns: [],
    skills: [],
    settings: []
  })
  const backendRoutes = workspaceRoutes(store)

  const projectHit = await backendRoutes['POST /api/workspace/materials/search']({
    projectId: 'project-a',
    query: '登录注册',
    roleScope: 'ai-retrieval',
    limit: 5
  })
  const fallbackHit = await backendRoutes['POST /api/workspace/materials/search']({
    projectId: 'project-a',
    query: 'auth-page-generation',
    roleScope: 'ai-retrieval',
    limit: 5
  })

  assert.ok(projectHit.results.some((item) => item.knowledgeSource === 'material'))
  assert.ok(!projectHit.results.some((item) => item.knowledgeSource === 'backend'))
  assert.equal(fallbackHit.results[0].knowledgeSource, 'backend')
  assert.equal(fallbackHit.results[0].fallback, true)
  assert.match(fallbackHit.results[0].title, /路由/)
})

testAsync('backend workspace context reports accepted status and rejects foreign projects', async () => {
  const store = createWorkspaceStore({
    currentUserId: 'user-a',
    currentProjectId: 'project-a',
    users: [
      { id: 'user-a', name: '账号 A' },
      { id: 'user-b', name: '账号 B' }
    ],
    projects: [
      { id: 'project-a', ownerUserId: 'user-a', name: '项目 A' },
      { id: 'project-b', ownerUserId: 'user-b', name: '项目 B' }
    ],
    assets: [],
    skillRuns: [],
    materials: [],
    parseJobs: [],
    restoredPages: [],
    workflowRuns: [],
    skills: [],
    settings: []
  })
  const backendRoutes = workspaceRoutes(store)

  const rejected = await backendRoutes['PATCH /api/workspace/context']({
    currentUserId: 'user-a',
    currentProjectId: 'project-b'
  })
  const afterRejected = await backendRoutes['GET /api/workspace']()
  const accepted = await backendRoutes['PATCH /api/workspace/context']({
    currentUserId: 'user-b',
    currentProjectId: 'project-b'
  })

  assert.equal(rejected.accepted, false)
  assert.equal(rejected.requestedProjectId, 'project-b')
  assert.equal(rejected.currentProjectId, 'project-a')
  assert.match(rejected.message, /当前账号|不存在/)
  assert.equal(afterRejected.currentProjectId, 'project-a')
  assert.equal(accepted.accepted, true)
  assert.equal(accepted.currentUserId, 'user-b')
  assert.equal(accepted.currentProjectId, 'project-b')
  assert.equal(accepted.project.id, 'project-b')
})

testAsync('backend assigns orphan resources to current project modules instead of restoring them as projects', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-'))
  const filePath = join(dir, 'workspace.json')
  try {
    await writeFile(filePath, JSON.stringify({
      currentUserId: 'user-local-default',
      currentProjectId: 'project-flow',
      users: [{ id: 'user-local-default', name: '流程通用户' }],
      projects: [
        { id: 'project-flow', ownerUserId: 'user-local-default', name: '流程通默认项目' }
      ],
      assets: [
        { id: 'asset-duplicated', projectId: 'project-podcastor', title: '旧资产' },
        { id: 'asset-duplicated', projectId: 'project-podcastor', title: '新资产' }
      ],
      skillRuns: [],
      materials: [
        { id: 'material-duplicated', projectId: 'project-podcastor', type: 'knowledge', title: '旧知识' },
        { id: 'material-duplicated', projectId: 'project-podcastor', type: 'knowledge', title: '新知识' }
      ],
      parseJobs: [],
      restoredPages: [
        { id: 'restored-orphan', projectId: 'debug-codex-ccswitch', title: '调试恢复页' }
      ],
      workflowRuns: [],
      skills: [],
      settings: []
    }), 'utf8')

    const store = createWorkspaceStore({}, { filePath })
    await store.load()
    const backendRoutes = workspaceRoutes(store)
    const workspace = await backendRoutes['GET /api/workspace']()
    const saved = await backendRoutes['PATCH /api/workspace/context']({
      currentUserId: 'user-local-default',
      currentProjectId: 'project-podcastor'
    })

    assert.equal(workspace.projects.length, 1)
    assert.ok(!workspace.projects.some((project) => project.id === 'project-podcastor'))
    assert.ok(!workspace.projects.some((project) => project.id === 'debug-codex-ccswitch'))
    assert.equal(workspace.assets.filter((item) => item.id === 'asset-duplicated').length, 1)
    assert.equal(workspace.assets.find((item) => item.id === 'asset-duplicated').title, '新资产')
    assert.equal(workspace.assets.find((item) => item.id === 'asset-duplicated').projectId, 'project-flow')
    assert.equal(workspace.assets.find((item) => item.id === 'asset-duplicated').originProjectId, 'project-podcastor')
    assert.equal(workspace.assets.find((item) => item.id === 'asset-duplicated').module, 'assets')
    assert.equal(workspace.materials.filter((item) => item.id === 'material-duplicated').length, 1)
    assert.equal(workspace.materials.find((item) => item.id === 'material-duplicated').title, '新知识')
    assert.equal(workspace.materials.find((item) => item.id === 'material-duplicated').projectId, 'project-flow')
    assert.equal(workspace.materials.find((item) => item.id === 'material-duplicated').module, 'knowledge')
    assert.equal(workspace.restoredPages.find((item) => item.id === 'restored-orphan').projectId, 'project-flow')
    assert.equal(workspace.restoredPages.find((item) => item.id === 'restored-orphan').module, 'factory')
    assert.equal(saved.accepted, false)
    assert.equal(saved.currentProjectId, 'project-flow')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend folds legacy project shells into real top level projects', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-'))
  const filePath = join(dir, 'workspace.json')
  try {
    await writeFile(filePath, JSON.stringify({
      currentUserId: 'user-local-default',
      currentProjectId: 'project-legacy-shell',
      users: [{ id: 'user-local-default', name: '流程通用户' }],
      projects: [
        { id: 'project-legacy-shell', ownerUserId: 'user-local-default', name: '账号下的新项目' },
        { id: 'project-backendized', ownerUserId: 'user-local-default', name: '后端化项目' },
        { id: 'debug-codex-ccswitch', ownerUserId: 'user-local-default', name: 'debug-codex-ccswitch 恢复项目' },
        { id: 'project-chanjing', ownerUserId: 'user-local-default', name: '蝉镜' },
        { id: 'project-flow', ownerUserId: 'user-local-default', name: '流程通默认项目' }
      ],
      assets: [{ id: 'asset-backendized', projectId: 'project-backendized', title: '真实资产' }],
      skillRuns: [{ id: 'run-backendized', projectId: 'project-backendized', title: '真实运行记录' }],
      materials: [],
      parseJobs: [],
      restoredPages: [
        { id: 'page-legacy', projectId: 'project-legacy-shell', title: '微信截图恢复页' },
        { id: 'page-debug', projectId: 'debug-codex-ccswitch', title: '调试恢复页' }
      ],
      workflowRuns: [],
      skills: [],
      settings: []
    }), 'utf8')

    const store = createWorkspaceStore({}, { filePath })
    await store.load()
    const savedFile = JSON.parse(await readFile(filePath, 'utf8'))
    const savedProjectIds = savedFile.projects.map((project) => project.id)

    assert.deepEqual(savedProjectIds.sort(), ['project-chanjing', 'project-flow'].sort())
    assert.equal(savedFile.currentProjectId, 'project-chanjing')
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-backendized').projectId, 'project-chanjing')
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-backendized').originProjectId, 'project-backendized')
    assert.equal(savedFile.skillRuns.find((item) => item.id === 'run-backendized').module, 'skills')
    assert.equal(savedFile.restoredPages.find((item) => item.id === 'page-legacy').projectId, 'project-chanjing')
    assert.equal(savedFile.restoredPages.find((item) => item.id === 'page-legacy').originProjectId, 'project-legacy-shell')
    assert.equal(savedFile.restoredPages.find((item) => item.id === 'page-debug').originProjectId, 'debug-codex-ccswitch')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend workspace store recovers trailing corrupted JSON without resetting projects', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-'))
  const filePath = join(dir, 'workspace.json')
  const workspace = {
    currentUserId: 'user-local-default',
    currentProjectId: 'project-chanjing',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [
      { id: 'project-chanjing', ownerUserId: 'user-local-default', name: '蝉镜' },
      { id: 'project-flow', ownerUserId: 'user-local-default', name: '流程通默认项目' }
    ],
    assets: [{ id: 'asset-chanjing', projectId: 'project-chanjing', title: '蝉镜资产' }],
    skillRuns: [],
    materials: [{ id: 'material-chanjing', projectId: 'project-chanjing', type: 'knowledge', title: '蝉镜知识' }],
    parseJobs: [],
    modelCallLogs: [],
    restoredPages: [],
    workflowRuns: [],
    skills: [],
    settings: []
  }
  try {
    await writeFile(filePath, `${JSON.stringify(workspace, null, 2)}\n{\"partial\":`, 'utf8')

    const store = createWorkspaceStore({}, { filePath })
    await store.load()
    const loaded = await workspaceRoutes(store)['GET /api/workspace']()
    const savedRaw = JSON.parse(await readFile(filePath, 'utf8'))

    assert.equal(loaded.currentProjectId, 'project-chanjing')
    assert.equal(loaded.projects.length, 2)
    assert.ok(loaded.projects.some((project) => project.id === 'project-chanjing'))
    assert.ok(loaded.materials.some((item) => item.projectId === 'project-chanjing'))
    assert.equal(savedRaw.currentProjectId, 'project-chanjing')
    assert.equal(savedRaw.projects.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('app shell cache-busts entry module when shell styles change', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

  assert.match(html, /\/src\/main\.js\?v=image-restore-detail-v1/)
  assert.doesNotMatch(html, /workspace-popover-layer-v2/)
  assert.doesNotMatch(html, /workspace-data-audit-v1/)
})

testAsync('vite build separates vendor chunks to avoid a single oversized app bundle', async () => {
  const configSource = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')

  assert.match(configSource, /manualChunks/)
  assert.match(configSource, /vue-vendor/)
  assert.match(configSource, /document-vendor/)
  assert.match(configSource, /automation-vendor/)
})

test('renders backend admin console with workspace operations', () => {
  const html = renderAdminConsoleHtml({
    title: '流程通后端管理台',
    apiBasePath: '/api'
  })

  assert.match(html, /<!doctype html>/)
  assert.match(html, /流程通后端管理台/)
  assert.ok(html.includes("const apiBase = '/api';"))
  assert.ok(html.includes("requestJson('/workspace')"))
  assert.ok(html.includes("requestJson('/admin/records/' + config.collection"))
  assert.match(html, /method: 'DELETE'/)
  assert.match(html, /项目数/)
  assert.match(html, /资料/)
  assert.match(html, /还原页面/)
  assert.match(html, /API 调试/)
  assert.match(html, /系统诊断/)
  assert.match(html, /前后端分工/)
  assert.match(html, /requestJson\('\/admin\/summary'\)/)
  assert.match(html, /导出 Workspace/)
  assert.match(html, /npm run api:restart/)
  assert.match(html, /Element Plus Admin/)
  assert.match(html, /data-view="projects"/)
  assert.match(html, /data-view="materials"/)
  assert.match(html, /data-view="generatedKnowledge"/)
  assert.match(html, /data-view="assets"/)
  assert.match(html, /data-view="workflowRuns"/)
  assert.match(html, /data-view="skills"/)
  assert.match(html, /data-view="settings"/)
  assert.match(html, /class="admin-drawer"/)
  assert.match(html, /class="admin-dialog"/)
  assert.match(html, /openCreate\(/)
  assert.match(html, /openEdit\(/)
  assert.match(html, /openDetail\(/)
  assert.match(html, /confirmDelete\(/)
  assert.match(html, /confirmBatchDelete\(/)
  assert.match(html, /分页/)
  assert.match(html, /搜索/)
})

testAsync('project UI and backend admin do not expose project stage as status', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const projectViewStart = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const projectViewEnd = appSource.indexOf('<section v-if="activeView === \'materials\'"', projectViewStart)
  const projectView = appSource.slice(projectViewStart, projectViewEnd)
  const projectModalStart = appSource.indexOf('aria-label="新建项目"')
  const projectModalEnd = appSource.indexOf('aria-label="资料编辑"', projectModalStart)
  const projectModal = appSource.slice(projectModalStart, projectModalEnd)
  const adminHtml = renderAdminConsoleHtml()
  const projectModuleStart = adminHtml.indexOf('projects: {')
  const projectModuleEnd = adminHtml.indexOf('materials: {', projectModuleStart)
  const adminProjectModule = adminHtml.slice(projectModuleStart, projectModuleEnd)

  assert.doesNotMatch(projectView, /project\.stage|selectedProjectDetail\.stage/)
  assert.doesNotMatch(projectModal, /projectForm\.stage|探索期|设计中|交付中|迭代中/)
  assert.doesNotMatch(adminProjectModule, /stage|阶段/)
  assert.doesNotMatch(adminProjectModule, /状态/)
})

test('builds admin summary with ownership and health diagnostics', () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-a', name: 'A' }],
    materials: [{ id: 'mat-a', title: '资料 A', type: 'knowledge', status: '已保存' }],
    generatedKnowledge: [{ id: 'gk-a', title: '沉淀知识 A', projectId: 'project-a', content: '用户确认知识' }],
    assets: [{ id: 'asset-a', title: '资产 A', status: '已保存' }],
    restoredPages: [{ id: 'page-a', title: '页面 A', codeFormat: 'html' }],
    workflowRuns: [{ id: 'run-a', workflowName: '流程 A', status: 'running' }],
    skillRuns: [],
    skills: [{ id: 'skill-a', name: 'Skill A', status: 'active' }],
    settings: [{ id: 'setting-a', key: 'apiBaseUrl', value: '/api', status: 'active' }]
  }, { filePath: '/tmp/workspace.local.json' })

  const summary = buildAdminSummary(store, {
    apiPort: 5299,
    frontendPort: 5288,
    storageFile: '/tmp/workspace.local.json'
  })

  assert.deepEqual(summary.counts, {
    projects: 1,
    materials: 1,
    generatedKnowledge: 1,
    parseJobs: 0,
    assets: 1,
    restoredPages: 1,
    workflowRuns: 1,
    skillRuns: 0,
    skills: 1,
    settings: 1
  })
  assert.equal(summary.health.api.status, 'ok')
  assert.equal(summary.health.storage.filePath, '/tmp/workspace.local.json')
  assert.ok(summary.ownership.frontend.includes('页面布局和交互状态'))
  assert.ok(summary.ownership.backend.includes('数据模型、持久化和业务规则'))
  assert.ok(summary.ownership.admin.includes('内部数据查看、诊断和安全操作'))
  assert.ok(summary.endpoints.some((endpoint) => endpoint.path === '/api/workspace'))
})

test('admin routes expose summary and export without replacing workspace API', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-a', name: 'A' }],
    materials: [],
    assets: [],
    restoredPages: [],
    workflowRuns: [],
    skillRuns: [],
    skills: [],
    settings: []
  })
  const routeMap = adminRoutes(store, { apiPort: 5299, frontendPort: 5288 })

  const summary = await routeMap['GET /api/admin/summary']()
  const exported = await routeMap['GET /api/admin/export']()

  assert.equal(summary.counts.projects, 1)
  assert.equal(summary.health.api.port, 5299)
  assert.equal(exported.workspace.projects[0].id, 'project-a')
  assert.match(exported.generatedAt, /^\d{4}-/)
})

test('admin routes provide generic CRUD for managed workspace records', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-a', name: 'A' }],
    materials: [],
    assets: [],
    restoredPages: [],
    workflowRuns: [],
    skillRuns: [],
    skills: [],
    settings: []
  })
  const routeMap = adminRoutes(store, { apiPort: 5299, frontendPort: 5288 })

  const created = await routeMap['POST /api/admin/records/:collection']({
    collection: 'projects',
    name: '后台项目',
    stage: 'design'
  })
  const updated = await routeMap['PATCH /api/admin/records/:collection/:id']({
    collection: 'projects',
    id: created.record.id,
    name: '后台项目 v2'
  })
  const batchOne = await routeMap['POST /api/admin/records/:collection']({
    collection: 'projects',
    name: '批量项目 A'
  })
  const batchTwo = await routeMap['POST /api/admin/records/:collection']({
    collection: 'projects',
    name: '批量项目 B'
  })
  const list = await routeMap['GET /api/admin/records/:collection']({ collection: 'projects' })
  const batchDeleted = await routeMap['POST /api/admin/records/:collection/batch-delete']({
    collection: 'projects',
    ids: [batchOne.record.id, batchTwo.record.id]
  })
  const deleted = await routeMap['DELETE /api/admin/records/:collection/:id']({
    collection: 'projects',
    id: created.record.id
  })
  const skill = await routeMap['POST /api/admin/records/:collection']({
    collection: 'skills',
    name: '后台 Skill',
    category: '交互设计',
    status: 'active'
  })
  const setting = await routeMap['POST /api/admin/records/:collection']({
    collection: 'settings',
    key: 'apiBaseUrl',
    value: '/api',
    group: 'api',
    status: 'active'
  })

  assert.equal(created.record.name, '后台项目')
  assert.equal(updated.record.name, '后台项目 v2')
  assert.ok(list.records.some((record) => record.id === created.record.id))
  assert.equal(batchDeleted.deleted, 2)
  assert.deepEqual(deleted, { collection: 'projects', id: created.record.id, deleted: true })
  assert.equal(skill.record.name, '后台 Skill')
  assert.equal(setting.record.key, 'apiBaseUrl')
})

testAsync('admin routes and console expose parse job management details', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const adminRouteMap = adminRoutes(store, { apiPort: 5299, frontendPort: 5288 })

  const imported = await backendRoutes['POST /api/workspace/materials/import-documents']({
    projectId: 'project-admin-jobs',
    type: 'requirements',
    documents: [{ id: 'doc-admin', name: '后台需求.md', type: 'text/markdown', content: '后台需要看到解析任务来源、数量和耗时。' }]
  })
  const listed = await adminRouteMap['GET /api/admin/records/:collection']({ collection: 'parseJobs' })
  const updated = await adminRouteMap['PATCH /api/admin/records/:collection/:id']({
    collection: 'parseJobs',
    id: imported.parseJob.id,
    summary: '人工复核完成',
    status: 'reviewed'
  })
  const deleted = await adminRouteMap['DELETE /api/admin/records/:collection/:id']({
    collection: 'parseJobs',
    id: imported.parseJob.id
  })
  const adminHtml = renderAdminConsoleHtml()

  assert.ok(listed.records.some((record) => record.id === imported.parseJob.id))
  assert.equal(updated.record.summary, '人工复核完成')
  assert.equal(updated.record.sourceType, 'document')
  assert.equal(deleted.deleted, true)
  assert.match(adminHtml, /data-view="parseJobs"/)
  assert.match(adminHtml, /解析任务/)
  assert.match(adminHtml, /sourceType/)
  assert.match(adminHtml, /materialCount/)
  assert.match(adminHtml, /durationMs/)
})

testAsync('workspace store keeps orphan resource ids as origin metadata instead of project entries', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-flow', name: '流程通默认项目' }],
    materials: [],
    assets: [{ id: 'asset-a', projectId: 'project-podcastor', title: 'Podcastor 蓝图' }],
    restoredPages: [{ id: 'page-a', projectId: 'project-legacy', title: '旧工程页' }],
    workflowRuns: [
      { id: 'run-a', projectId: 'project-podcastor', workflowName: 'Podcastor 产品体验流' },
      { id: 'run-b', projectId: '', workflowName: '非项目需求' }
    ],
    skillRuns: [{ id: 'skill-run-a', projectId: 'project-podcastor', title: 'Podcastor 生成记录' }],
    skills: [{ id: 'skill-a', projectId: 'project-legacy', name: '旧项目 Skill' }],
    settings: []
  })
  const snapshot = await store.load()

  assert.equal(snapshot.projects.length, 1)
  assert.ok(!snapshot.projects.some((project) => project.id === 'project-podcastor'))
  assert.ok(!snapshot.projects.some((project) => project.id === 'project-legacy'))
  assert.equal(snapshot.assets.find((item) => item.id === 'asset-a').projectId, 'project-flow')
  assert.equal(snapshot.assets.find((item) => item.id === 'asset-a').originProjectId, 'project-podcastor')
  assert.equal(snapshot.assets.find((item) => item.id === 'asset-a').module, 'assets')
  assert.equal(snapshot.restoredPages.find((item) => item.id === 'page-a').projectId, 'project-flow')
  assert.equal(snapshot.restoredPages.find((item) => item.id === 'page-a').originProjectId, 'project-legacy')
  assert.equal(snapshot.restoredPages.find((item) => item.id === 'page-a').module, 'factory')
  assert.equal(snapshot.skills.find((item) => item.id === 'skill-a').projectId, 'project-flow')
  assert.equal(snapshot.skills.find((item) => item.id === 'skill-a').module, 'skills')
  assert.ok(!snapshot.projects.some((project) => project.id === ''))
})

testAsync('backend readme documents admin console and restart commands', async () => {
  const readme = await readFile(new URL('../后端/README.md', import.meta.url), 'utf8')

  assert.match(readme, /后台管理台：http:\/\/localhost:5299\/admin/)
  assert.match(readme, /npm run api:restart/)
  assert.match(readme, /GET  \/api\/admin\/summary/)
  assert.match(readme, /GET  \/api\/admin\/export/)
  assert.match(readme, /parseJobs/)
  assert.match(readme, /POST \/api\/workspace\/materials\/import-blueprint/)
  assert.match(readme, /POST \/api\/workspace\/materials\/import-documents/)
  assert.match(readme, /幂等/)
  assert.match(readme, /`\/api\/\*` 必须保持 JSON 契约/)
})

test('mock api exposes admin console as an html page', async () => {
  const admin = await routes['GET /admin']()

  assert.equal(admin.contentType, 'text/html; charset=utf-8')
  assert.match(admin.body, /流程通后端管理台/)
  assert.match(admin.body, /Workspace 数据/)
  assert.match(admin.body, /Element Plus Admin/)
})

testAsync('app opens requirements workspace when diagnosis tab is hidden', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /function initialActiveViewFromHash\(\)/)
  assert.match(appSource, /const activeView = ref\(initialActiveViewFromHash\(\)\)/)
  assert.match(appSource, /const materialsTab = ref\('requirements'\)/)
  assert.doesNotMatch(appSource, /const activeView = ref\('diagnosis'\)/)
})

testAsync('requirements workspace uses source tabs table fields and knowledge state', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const requirementsStart = appSource.indexOf('<section v-if="materialsTab === \'requirements\'" class="requirements-workspace">')
  const requirementsEnd = appSource.indexOf('<section v-if="materialsTab === \'knowledge\'"', requirementsStart)
  const requirementsSource = appSource.slice(requirementsStart, requirementsEnd)

  assert.match(appSource, /const requirementSourceTabs = \[/)
  assert.match(appSource, /key: 'product', label: '产品需求'/)
  assert.match(appSource, /key: 'fuzzy', label: '模糊需求'/)
  assert.match(appSource, /key: 'design', label: '设计需求'/)
  assert.match(appSource, /const requirementSourceTab = ref\('all'\)/)
  assert.match(appSource, /const requirementDocumentRows = computed/)
  assert.match(appSource, /const filteredRequirementDocumentRows = computed/)
  assert.match(appSource, /function requirementDocumentSourceLabel/)
  assert.match(appSource, /function requirementKnowledgeStatusLabel/)
  assert.match(requirementsSource, /class="requirements-source-tabs"/)
  assert.match(requirementsSource, /v-for="tab in requirementSourceTabs"/)
  assert.match(requirementsSource, /需求文件/)
  assert.match(requirementsSource, /需求来源/)
  assert.match(requirementsSource, /状态/)
  assert.match(requirementsSource, /知识状态/)
  assert.match(requirementsSource, /上传时间/)
  assert.match(requirementsSource, /已转知识/)
  assert.doesNotMatch(requirementsSource, /已归档/)
  assert.match(cssSource, /\.requirements-workspace/)
  assert.match(cssSource, /\.requirements-table/)
})

testAsync('materials toolbar keeps primary import buttons black and right aligned', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const requirementsStart = appSource.indexOf('<section v-if="materialsTab === \'requirements\'" class="requirements-workspace">')
  const requirementsEnd = appSource.indexOf('<section v-if="materialsTab === \'knowledge\'"', requirementsStart)
  const requirementsSource = appSource.slice(requirementsStart, requirementsEnd)
  const requirementActionsStart = requirementsSource.indexOf('class="materials-toolbar-actions"')
  const requirementActionsEnd = requirementsSource.indexOf('</div>', requirementActionsStart)
  const requirementActionsSource = requirementsSource.slice(requirementActionsStart, requirementActionsEnd)
  const knowledgeStart = appSource.indexOf('<section v-if="materialsTab === \'knowledge\'"')
  const knowledgeEnd = appSource.indexOf('<div class="knowledge-primary-tabs"', knowledgeStart)
  const knowledgeSource = appSource.slice(knowledgeStart, knowledgeEnd)

  assert.ok(requirementActionsSource.indexOf('批量管理') < requirementActionsSource.indexOf('上传需求文件'))
  assert.match(requirementActionsSource, /<button class="primary" type="button" @click="openMaterialCreate">上传需求文件<\/button>/)
  assert.ok(knowledgeSource.indexOf('批量管理') < knowledgeSource.indexOf('导入文件'))
  assert.match(knowledgeSource, /<button class="primary" type="button" @click="openMaterialCreate">导入文件<\/button>/)
})

testAsync('project workspace sorts active and resource backed projects before recovered history', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const projectViewStart = appSource.indexOf("<section v-if=\"activeView === 'projects'\"")
  const projectViewEnd = appSource.indexOf("<section v-if=\"activeView === 'materials'\"", projectViewStart)
  const projectView = appSource.slice(projectViewStart, projectViewEnd)

  assert.match(appSource, /const projectDisplayList = computed/)
  assert.match(appSource, /projectActivityScore/)
  assert.match(projectView, /v-for="project in projectDisplayList"/)
})

testAsync('app defines normalized capture auth mode before setup watchers read it', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const computedIndex = appSource.indexOf('const normalizedCaptureAuthMode = computed')
  const watcherIndex = appSource.indexOf('watch([activeView, normalizedCaptureAuthMode]')

  assert.ok(computedIndex > 0)
  assert.ok(watcherIndex > 0)
  assert.ok(computedIndex < watcherIndex)
})

testAsync('diagnosis view keeps generated result code preview hidden', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const viewStart = appSource.indexOf('<section v-if="activeView === \'diagnosis\'"')
  const viewEnd = appSource.indexOf('<section v-if="activeView === \'workflow\'', viewStart)
  const diagnosisSource = appSource.slice(viewStart, viewEnd)

  assert.ok(viewStart > 0)
  assert.ok(viewEnd > viewStart)
  assert.doesNotMatch(diagnosisSource, /<pre[^>]*class="code-block tall"[^>]*>\{\{\s*skillWorkbenchResult\s*\}\}<\/pre>/)
  assert.doesNotMatch(diagnosisSource, /inline-code-preview/)
})

test('builds internal web snapshot capture requests for public and authenticated pages', () => {
  const publicRequest = buildSnapshotCaptureRequest({
    projectId: 'project-a',
    url: ' https://example.com/dashboard ',
    scope: 'single',
    authMode: 'none'
  })
  assert.equal(publicRequest.authMode, 'public')
  assert.equal(publicRequest.captureKind, 'internal-web-snapshot')
  assert.equal(publicRequest.output.includeDom, true)
  assert.equal(publicRequest.output.includeInteractions, true)
  assert.equal(publicRequest.url, 'https://example.com/dashboard')

  const browserRequest = buildSnapshotCaptureRequest({
    projectId: 'project-a',
    url: 'https://example.com/admin',
    authMode: 'browser',
    sessionId: 'session-1'
  })
  assert.equal(browserRequest.authSession.type, 'browser-session')
  assert.equal(browserRequest.authSession.projectScoped, true)

  const cookieRequest = buildSnapshotCaptureRequest({
    projectId: 'project-a',
    url: 'https://example.com/admin',
    authMode: 'cookie',
    cookieText: 'token=abc'
  })
  assert.equal(cookieRequest.authSession.type, 'cookie-import')
  assert.equal(cookieRequest.authSession.cookieText, 'token=abc')
})

test('normalizes legacy auth modes and describes snapshot capture status', () => {
  assert.equal(normalizeSnapshotAuthMode('none'), 'public')
  assert.equal(normalizeSnapshotAuthMode('session'), 'browser')
  assert.equal(normalizeSnapshotAuthMode('unknown'), 'public')
  assert.match(snapshotCaptureStatusMessage('public'), /内部网页快照/)
  assert.match(snapshotCaptureStatusMessage('browser'), /授权浏览器/)
  assert.match(snapshotCaptureStatusMessage('cookie'), /Cookie/)
})

test('converts a capture result into a project scoped design source', () => {
  const source = designSourceFromCaptureResult({
    taskId: 'task-1',
    url: 'https://example.com/app',
    title: 'Example App',
    status: 'completed',
    screenshot: 'data:image/png;base64,shot',
    pages: [{ title: 'Example App', url: 'https://example.com/app', screenshot: 'data:image/png;base64,page' }],
    layoutNodes: [{ id: 'node-1' }, { id: 'node-2' }],
    components: [{ name: 'Button', type: 'button' }],
    assets: [{ type: 'image' }],
    designTokens: { primary: '#111111' },
    raw: {
      capturedAt: '2026-06-20T08:00:00.000Z',
      captureKind: 'internal-web-snapshot',
      authMode: 'browser',
      transport: 'chrome-render-session'
    }
  }, { projectId: 'project-a', origin: 'url' })

  assert.equal(source.projectId, 'project-a')
  assert.equal(source.type, 'web-snapshot')
  assert.equal(source.origin, 'url')
  assert.equal(source.title, 'Example App')
  assert.equal(source.coverImage, 'data:image/png;base64,shot')
  assert.equal(source.summary.layoutNodes, 2)
  assert.equal(source.summary.components, 1)
  assert.equal(source.summary.hasScreenshot, true)
  assert.equal(source.rawRef.authMode, 'browser')
})

test('upserts and filters design sources by project', () => {
  const first = {
    id: 'source-1',
    projectId: 'project-a',
    type: 'web-snapshot',
    origin: 'url',
    sourceUrl: 'https://example.com',
    updatedAt: '2026-06-20T08:00:00.000Z'
  }
  const newer = {
    ...first,
    id: 'source-2',
    updatedAt: '2026-06-20T09:00:00.000Z'
  }
  const otherProject = {
    id: 'source-3',
    projectId: 'project-b',
    type: 'web-snapshot',
    origin: 'url',
    sourceUrl: 'https://example.com',
    updatedAt: '2026-06-20T10:00:00.000Z'
  }

  const sources = upsertDesignSource(upsertDesignSource([otherProject], first), newer)
  assert.deepEqual(sources.map((source) => source.id), ['source-2', 'source-3'])
  assert.deepEqual(designSourcesForProject(sources, 'project-a').map((source) => source.id), ['source-2'])
})

testAsync('imports screenshot files from uploaded web snapshot packages', async () => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({
    title: 'Snapshot Package Page',
    url: 'https://example.com/snapshot',
    viewport: { width: 1440, height: 900 },
    capturedAt: '2026-06-20T08:30:00.000Z'
  }))
  zip.file('snapshot.json', JSON.stringify({
    semanticNodes: [{ tag: 'h1', text: 'Snapshot Package Page' }]
  }))
  zip.file('layout.json', JSON.stringify({
    nodes: [
      {
        tag: 'h1',
        text: 'Snapshot Package Page',
        rect: { x: 80, y: 96, width: 420, height: 48 },
        style: { color: '#111111', fontSize: '32px', fontWeight: '700' }
      }
    ]
  }))
  zip.file('screenshots/full-page.png', Buffer.from('fake-png-image'))
  const fileBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  const capture = await parseWebsnapFile({
    name: 'snapshot-package.zip',
    arrayBuffer: async () => fileBuffer
  })

  assert.match(capture.screenshot, /^data:image\/png;base64,/)
  assert.match(capture.pages[0].screenshot, /^data:image\/png;base64,/)
  assert.equal(capture.raw.screenshotCaptured, true)
})

test('visual verification passes identical screenshots and fails different screenshots', () => {
  const redPixel = pngDataUrl([255, 0, 0, 255])
  const bluePixel = pngDataUrl([0, 0, 255, 255])

  const same = compareImageDataUrls(redPixel, redPixel)
  assert.equal(same.dimensionMatch, true)
  assert.equal(same.score, 100)
  assert.equal(visualVerificationPassed(same), true)

  const different = compareImageDataUrls(redPixel, bluePixel)
  assert.equal(different.dimensionMatch, true)
  assert.ok(different.score < 98)
  assert.equal(visualVerificationPassed(different), false)
})

test('builds a visual verification report with per-breakpoint status', () => {
  const redPixel = pngDataUrl([255, 0, 0, 255])
  const bluePixel = pngDataUrl([0, 0, 255, 255])

  const report = buildVisualVerificationReport({
    url: 'https://example.com',
    breakpoints: [
      { id: 'desktop', width: 1440, baseline: redPixel, generated: redPixel },
      { id: 'mobile', width: 390, baseline: redPixel, generated: bluePixel }
    ],
    compare: (breakpoint) => compareImageDataUrls(breakpoint.baseline, breakpoint.generated)
  })

  assert.equal(report.url, 'https://example.com')
  assert.equal(report.status, 'failed')
  assert.equal(report.summary.total, 2)
  assert.equal(report.summary.passed, 1)
  assert.equal(report.summary.failed, 1)
  assert.equal(report.results.find((item) => item.id === 'desktop').status, 'passed')
  assert.equal(report.results.find((item) => item.id === 'mobile').status, 'failed')
  assert.match(report.recommendations.join('\n'), /mobile/)
})

testAsync('capture page generation blocks low value dom captures instead of returning a guessed preview', async () => {
  const captureResult = {
    title: 'Filtered capture',
    url: 'https://example.com',
    viewport: { width: 1440, height: 900 },
    pageBackground: '#ffffff',
    layoutNodes: [
      {
        id: 'root-surface',
        type: 'surface',
        tag: 'div',
        x: 0,
        y: 0,
        width: 1440,
        height: 900,
        style: { backgroundColor: 'rgb(255, 255, 255)' }
      },
      {
        id: 'headline',
        type: 'text',
        tag: 'h1',
        text: '采集到了 DOM 节点',
        x: 24,
        y: 32,
        width: 220,
        height: 48,
        style: { color: 'rgb(34, 37, 41)', fontSize: '24px', lineHeight: '32px' }
      },
      {
        id: 'subcopy',
        type: 'text',
        tag: 'p',
        text: '用于生成空状态提示',
        x: 24,
        y: 96,
        width: 220,
        height: 32,
        style: { color: 'rgb(80, 88, 98)', fontSize: '14px', lineHeight: '22px' }
      }
    ],
    raw: { layoutNodeCount: 3 }
  }

  const result = await routes['POST /api/capture/generate-page']({ captureResult, palette: {}, designRules: {} })

  assert.equal(result.status, 'blocked')
  assert.equal(result.html, '')
  assert.match(result.message, /可用于还原的文本\/图片\/控件不足/)
})

test('capture restore readiness blocks screenshot-only captures', () => {
  const readiness = captureRestoreReadiness({
    title: 'Screenshot only',
    screenshot: pngDataUrl([255, 255, 255]),
    pages: [{ screenshot: pngDataUrl([255, 255, 255]) }],
    layoutNodes: [],
    raw: { layoutNodeCount: 0, screenshotCaptured: true }
  })

  assert.equal(readiness.canRestore, false)
  assert.equal(readiness.nodeCount, 0)
  assert.match(readiness.reason, /没有采集到可还原 DOM 节点/)
  assert.ok(readiness.actions.some((action) => /使用登录态/.test(action)))
})

test('capture quality gate passes SingleFile static html as a formal static asset', () => {
  const gate = captureQualityGate({
    title: 'SingleFile page',
    url: 'https://example.com/singlefile',
    singleFileHtml: '<!doctype html><html><body><main><h1>完整静态页面</h1><p>content</p></main></body></html>',
    layoutNodes: [],
    raw: { singleFileCaptured: true, layoutNodeCount: 0 }
  })

  assert.equal(gate.passed, true)
  assert.equal(gate.mode, 'singlefile-static')
  assert.equal(gate.status, 'passed')
  assert.equal(gate.metrics.singleFileLength > 40, true)
})

test('capture quality gate passes authorized browser html as a formal static asset', () => {
  const authorizedHtml = '<!doctype html><html><body><main><h1>已登录工作台</h1><section><p>真实页面内容</p><button>开始创作</button></section></main></body></html>'
  const gate = captureQualityGate({
    title: 'Authorized page',
    url: 'https://example.com/dashboard',
    staticHtml: authorizedHtml,
    singleFileHtml: '',
    layoutNodes: [],
    raw: { staticHtmlCaptured: true, singleFileCaptured: false, layoutNodeCount: 0 }
  })

  assert.equal(gate.passed, true)
  assert.equal(gate.mode, 'static-html')
  assert.equal(gate.status, 'passed')
  assert.equal(gate.metrics.staticHtmlLength > 40, true)
})

test('capture quality gate blocks access denied and 405 error pages from restored assets', () => {
  const gate = captureQualityGate({
    title: '稿定 AI',
    url: 'https://www.gaoding.art/creation',
    singleFileHtml: '<!doctype html><html><body><main><h1>405 异常访问</h1><p>非常抱歉，检测到您的请求有异常行为。</p><p>您的请求地址是https://www.gaoding.art/creation</p></main></body></html>',
    layoutNodes: [],
    raw: { singleFileCaptured: true, layoutNodeCount: 0 }
  })

  assert.equal(gate.passed, false)
  assert.equal(gate.status, 'blocked')
  assert.equal(gate.mode, 'access-denied-page')
  assert.ok(gate.reasons.some((reason) => /异常访问|风控|登录|错误页/.test(reason)))
  assert.ok(gate.actions.some((action) => /授权浏览器|Cookie|快照包|截图/.test(action)))
})

test('capture quality gate blocks empty designTree with only flat absolute nodes', () => {
  const flatNodes = Array.from({ length: 20 }, (_, index) => ({
    id: `node-${index}`,
    type: 'text',
    tag: 'span',
    text: index % 2 ? '创作' : 'Agent模式',
    x: 24 + index,
    y: 40,
    width: 120,
    height: 24,
    style: { fontSize: '14px' }
  }))
  const gate = captureQualityGate({
    title: 'Flat page',
    url: 'https://example.com/flat',
    designTree: {
      id: 'root',
      type: 'container',
      tag: 'main',
      children: [
        { id: 'empty-1', type: 'container', tag: 'section', children: [] },
        { id: 'empty-2', type: 'container', tag: 'section', children: [] }
      ]
    },
    layoutNodes: flatNodes,
    raw: { layoutNodeCount: flatNodes.length, capturedPageHeight: 4129, viewportHeight: 900 }
  })

  assert.equal(gate.passed, false)
  assert.equal(gate.status, 'blocked')
  assert.equal(gate.mode, 'flat-nodes-only')
  assert.ok(gate.reasons.some((reason) => /父子层级/.test(reason)))
  assert.ok(gate.actions.some((action) => /重新采集/.test(action)))
})

test('capture quality gate blocks screenshot-only captures before asset save', () => {
  const gate = captureQualityGate({
    title: 'Screenshot only',
    screenshot: pngDataUrl([255, 255, 255]),
    pages: [{ screenshot: pngDataUrl([255, 255, 255]) }],
    layoutNodes: [],
    raw: { screenshotCaptured: true, layoutNodeCount: 0 }
  })

  assert.equal(gate.passed, false)
  assert.equal(gate.status, 'blocked')
  assert.equal(gate.mode, 'screenshot-only')
  assert.ok(gate.reasons.some((reason) => /截图/.test(reason)))
})

testAsync('capture page generation rejects insufficient dom data instead of guessing html', async () => {
  const baseline = solidPngDataUrl(320, 480, [255, 255, 255, 255])
  const captureResult = {
    title: 'Insufficient capture',
    url: 'https://example.com/insufficient',
    viewport: { width: 320, height: 480 },
    screenshot: baseline,
    pages: [{ screenshot: baseline }],
    layoutNodes: [],
    raw: { layoutNodeCount: 0, screenshotCaptured: true }
  }

  const result = await routes['POST /api/capture/generate-page']({ captureResult, palette: {}, designRules: {} })

  assert.equal(result.status, 'blocked')
  assert.equal(result.html, '')
  assert.match(result.message, /没有采集到可还原 DOM 节点/)
})

testAsync('capture page generation blocks flat nodes without meaningful design tree', async () => {
  const captureResult = {
    title: 'Flat generated page',
    url: 'https://example.com/flat-generated',
    viewport: { width: 1440, height: 900 },
    screenshot: solidPngDataUrl(320, 480, [255, 255, 255, 255]),
    designTree: {
      id: 'root',
      type: 'container',
      tag: 'main',
      children: [
        { id: 'empty-section', type: 'container', tag: 'section', children: [] }
      ]
    },
    layoutNodes: Array.from({ length: 18 }, (_, index) => ({
      id: `flat-${index}`,
      type: 'text',
      tag: 'span',
      text: index % 2 ? '创作' : 'Agent模式',
      x: 40 + index,
      y: 60,
      width: 120,
      height: 24
    })),
    raw: { layoutNodeCount: 18, capturedPageHeight: 4129, viewportHeight: 900 }
  }

  const result = await routes['POST /api/capture/generate-page']({ captureResult, palette: {}, designRules: {}, restoreMode: 'dom' })

  assert.equal(result.status, 'blocked')
  assert.equal(result.html, '')
  assert.equal(result.qualityGate.mode, 'flat-nodes-only')
  assert.ok(result.diagnosticReport.reasons.some((reason) => /父子层级/.test(reason)))
})

testAsync('capture page generation returns visual verification report from rendered output', async () => {
  const baseline = solidPngDataUrl(320, 480, [255, 0, 0, 255])
  const captureResult = {
    title: 'Visual verify',
    url: 'https://example.com/visual',
    viewport: { width: 320, height: 480 },
    screenshot: baseline,
    pages: [{ screenshot: baseline }],
    layoutNodes: [
      {
        id: 'blue-panel',
        type: 'surface',
        tag: 'div',
        x: 0,
        y: 0,
        width: 320,
        height: 480,
        style: { backgroundColor: 'rgb(0, 0, 255)' }
      },
      {
        id: 'visual-title',
        type: 'text',
        tag: 'h1',
        text: '视觉校验页面',
        x: 24,
        y: 32,
        width: 220,
        height: 48,
        style: { color: 'rgb(255, 255, 255)', fontSize: '24px', lineHeight: '32px' }
      },
      {
        id: 'visual-copy',
        type: 'text',
        tag: 'p',
        text: 'DOM 生成结果',
        x: 24,
        y: 96,
        width: 220,
        height: 32,
        style: { color: 'rgb(255, 255, 255)', fontSize: '14px', lineHeight: '22px' }
      },
      {
        id: 'visual-action',
        type: 'control',
        tag: 'button',
        placeholder: '开始',
        x: 24,
        y: 144,
        width: 96,
        height: 36,
        style: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 255)', borderRadius: '8px' }
      }
    ],
    raw: { layoutNodeCount: 4, screenshotCaptured: true }
  }

  const result = await routes['POST /api/capture/generate-page']({
    captureResult,
    palette: {},
    designRules: {},
    restoreMode: 'dom'
  })

  assert.ok(result.visualVerification)
  assert.equal(result.visualVerification.url, 'https://example.com/visual')
  assert.equal(result.visualVerification.status, 'failed')
  assert.ok(result.visualVerification.summary.averageScore < 98)
  assert.ok(result.visualVerification.results[0].comparison.differentPixelRatio > 0)
})

testAsync('capture page generation defaults to real html dom instead of screenshot baseline', async () => {
  const baseline = solidPngDataUrl(320, 480, [255, 0, 0, 255])
  const captureResult = {
    title: 'DOM default restore',
    url: 'https://example.com/dom-default',
    viewport: { width: 320, height: 480 },
    screenshot: baseline,
    pages: [{ screenshot: baseline }],
    layoutNodes: [
      {
        id: 'headline',
        type: 'text',
        tag: 'h1',
        text: '真实 HTML 节点',
        x: 24,
        y: 32,
        width: 220,
        height: 48,
        style: { color: 'rgb(34, 37, 41)', fontSize: '24px', lineHeight: '32px' }
      },
      {
        id: 'subtitle',
        type: 'text',
        tag: 'p',
        text: '第二个真实节点',
        x: 24,
        y: 92,
        width: 220,
        height: 32,
        style: { color: 'rgb(80, 88, 98)', fontSize: '14px', lineHeight: '22px' }
      },
      {
        id: 'button',
        type: 'control',
        tag: 'button',
        placeholder: '开始使用',
        x: 24,
        y: 140,
        width: 120,
        height: 36,
        style: { backgroundColor: 'rgb(34, 37, 41)', color: 'rgb(255, 255, 255)', borderRadius: '8px' }
      }
    ],
    raw: { layoutNodeCount: 3, screenshotCaptured: true }
  }

  const result = await routes['POST /api/capture/generate-page']({ captureResult, palette: {}, designRules: {} })

  assert.doesNotMatch(result.html, /pixel-baseline-layer/)
  assert.doesNotMatch(result.html, /mode":\s*"pixel-baseline"/)
  assert.match(result.html, /capture-node/)
  assert.match(result.html, /真实 HTML 节点/)
})

testAsync('capture page generation prefers SingleFile html when available', async () => {
  const singleFileHtml = '<!doctype html><html><body><main data-singlefile="true"><h1>SingleFile 高保真页面</h1></main></body></html>'
  const captureResult = {
    title: 'SingleFile restore',
    url: 'https://example.com/singlefile',
    viewport: { width: 320, height: 480 },
    singleFileHtml,
    domSnapshot: { documents: [{ nodes: { nodeName: ['HTML', 'BODY'] } }] },
    layoutNodes: [],
    raw: {
      layoutNodeCount: 0,
      singleFileCaptured: true,
      domSnapshotCaptured: true
    }
  }

  const result = await routes['POST /api/capture/generate-page']({ captureResult, palette: {}, designRules: {} })

  assert.equal(result.html, singleFileHtml)
  assert.equal(result.summary, '已使用 SingleFile 生成高保真静态 HTML。')
})

testAsync('capture page generation uses authorized browser static html when available', async () => {
  const staticHtml = '<!doctype html><html><body><main data-authorized-browser="true"><h1>授权浏览器页面</h1></main></body></html>'
  const captureResult = {
    title: 'Authorized restore',
    url: 'https://example.com/dashboard',
    viewport: { width: 320, height: 480 },
    staticHtml,
    singleFileHtml: '',
    domSnapshot: { documents: [{ nodes: { nodeName: ['HTML', 'BODY'] } }] },
    layoutNodes: [],
    raw: {
      layoutNodeCount: 0,
      staticHtmlCaptured: true,
      singleFileCaptured: false,
      domSnapshotCaptured: true
    }
  }

  const result = await routes['POST /api/capture/generate-page']({ captureResult, palette: {}, designRules: {} })

  assert.equal(result.html, staticHtml)
  assert.equal(result.summary, '已使用授权浏览器当前页 HTML 生成高保真静态页面。')
})

testAsync('image to html builds a visual model and screenshot restoration html', async () => {
  const result = await routes['POST /api/generate/image-to-html']({
    projectId: 'project-flow',
    title: 'workflow-analysis.png',
    target: 'static-html',
    prompt: '工作流分析详情页，包含左侧菜单、顶部操作、八个分析 Tab、Mermaid 图表和 RICE 表格。',
    imageDataUrl: solidPngDataUrl(320, 180, [240, 248, 255, 255])
  })

  assert.equal(result.status, 'generated')
  assert.equal(result.visualModel.source.type, 'screenshot')
  assert.equal(result.visualModel.source.target, 'static-html')
  assert.equal(result.captureResult.raw.visualModelCaptured, true)
  assert.match(result.html, /data-restore-source="screenshot"/)
  assert.match(result.html, /视觉结构解析/)
  assert.match(result.html, /工作流分析/)
  assert.match(result.html, /Mermaid/)
  assert.match(result.html, /RICE/)
  assert.doesNotMatch(result.html, /<img[^>]+src="data:image\/png/)
  assert.match(result.summary, /截图视觉结构/)
})

testAsync('capture page generation can use screenshot baseline for pixel level 1:1 restore', async () => {
  const baseline = solidPngDataUrl(320, 480, [255, 0, 0, 255])
  const captureResult = {
    title: 'Pixel baseline restore',
    url: 'https://example.com/pixel',
    viewport: { width: 320, height: 480 },
    screenshot: baseline,
    pages: [{ screenshot: baseline }],
    layoutNodes: [
      {
        id: 'blue-panel',
        type: 'surface',
        tag: 'div',
        x: 0,
        y: 0,
        width: 320,
        height: 480,
        style: { backgroundColor: 'rgb(0, 0, 255)' }
      }
    ],
    raw: { layoutNodeCount: 1, screenshotCaptured: true }
  }

  const result = await routes['POST /api/capture/generate-page']({
    captureResult,
    palette: {},
    designRules: {},
    restoreMode: 'pixel'
  })

  assert.match(result.html, /pixel-baseline-layer/)
  assert.equal(result.visualVerification.status, 'passed')
  assert.equal(result.visualVerification.summary.averageScore, 100)
})

test('builds source-traceable knowledge from a website URL and HTML', () => {
  const result = buildWebsiteKnowledgeImport({
    projectId: 'project-a',
    url: 'https://example.com/pricing?ref=ad',
    importType: 'project-website',
    scope: 'single',
    html: `
      <html>
        <head><title>Example AI Pricing</title><meta name="description" content="AI workflow platform for product teams"></head>
        <body>
          <h1>Example AI</h1>
          <h2>Pricing</h2>
          <p>Starter plan for small teams. Pro plan includes knowledge base, website import, and collaboration.</p>
          <a href="/docs">Docs</a>
          <a href="/help">Help center</a>
        </body>
      </html>
    `
  })

  assert.equal(result.summary.pageCount, 1)
  assert.equal(result.summary.importType, 'project-website')
  assert.ok(result.items.length >= 3)
  assert.equal(result.items[0].projectId, 'project-a')
  assert.equal(result.items[0].sourceType, 'website')
  assert.equal(result.items[0].sourceUrl, 'https://example.com/pricing')
  assert.ok(result.items.some((item) => item.category === 'pricing'))
  assert.ok(result.items.some((item) => item.category === 'product-fact'))
  assert.ok(result.items.every((item) => item.evidence?.[0]?.url === 'https://example.com/pricing'))
  assert.ok(result.items.some((item) => item.entities?.features?.includes('knowledge base')))
})

testAsync('backend workspace imports website knowledge as persisted materials', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const imported = await backendRoutes['POST /api/workspace/materials/import-website']({
    projectId: 'project-a',
    url: 'https://example.com/product?utm=1',
    importType: 'project-website',
    html: `
      <html>
        <head><title>Example Product</title><meta name="description" content="Product workspace knowledge base"></head>
        <body>
          <h1>Example Product</h1>
          <h2>Knowledge base</h2>
          <p>Import websites, extract feature lists, pricing, CTAs, and source evidence.</p>
          <a href="/signup">Start free</a>
        </body>
      </html>
    `
  })
  const listed = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-a',
    type: 'knowledge'
  })

  assert.equal(imported.summary.projectId, 'project-a')
  assert.ok(imported.materials.length >= 2)
  assert.ok(imported.materials.every((item) => item.type === 'knowledge'))
  assert.ok(imported.materials.every((item) => item.projectId === 'project-a'))
  assert.ok(imported.materials.every((item) => item.sourceType === 'website'))
  assert.ok(imported.materials.every((item) => item.sourceUrl === 'https://example.com/product'))
  assert.ok(imported.materials.every((item) => item.evidence?.[0]?.url === 'https://example.com/product'))
  assert.ok(imported.materials.some((item) => item.entities?.features?.includes('knowledge base')))
  assert.ok(imported.materials.every((item) => item.verification?.status === 'unverified'))
  assert.ok(imported.materials.every((item) => item.owner === '知识库管理员'))
  assert.ok(imported.materials.every((item) => item.roleScopes?.includes('product')))
  assert.ok(imported.materials.every((item) => item.roleScopes?.includes('ux')))
  assert.ok(imported.materials.every((item) => item.roleScopes?.includes('development')))
  assert.ok(imported.materials.every((item) => item.roleScopes?.includes('ai-retrieval')))
  assert.ok(imported.materials.some((item) => item.chunks?.some((chunk) => chunk.roleScopes?.includes('ux'))))
  assert.ok(imported.materials.some((item) => item.relations?.some((relation) => relation.type === 'source-page')))
  assert.equal(listed.materials.length, imported.materials.length)
})

testAsync('backend website import can generate a project blueprint asset and blueprint knowledge', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const imported = await backendRoutes['POST /api/workspace/materials/import-website']({
    projectId: 'project-url-blueprint',
    url: 'https://example.com/product',
    importType: 'project-website',
    generateBlueprint: true,
    html: `
      <html>
        <head><title>FlowPilot AI</title><meta name="description" content="AI product workspace for teams"></head>
        <body>
          <h1>FlowPilot AI</h1>
          <h2>Import websites</h2>
          <p>Turn project websites into product blueprints, knowledge cards, design plans, and engineering handoff.</p>
          <h2>Design workflow</h2>
          <p>Teams review pages, user journeys, business rules, and delivery assets from one blueprint.</p>
          <a href="/signup">Start free</a>
          <a href="/docs">Read docs</a>
        </body>
      </html>
    `
  })
  const snapshot = await backendRoutes['GET /api/workspace']()

  assert.ok(imported.blueprintAsset)
  assert.ok(imported.prototypeAsset)
  assert.equal(imported.blueprintAsset.projectId, 'project-url-blueprint')
  assert.equal(imported.blueprintAsset.type, 'project-blueprint')
  assert.equal(imported.prototypeAsset.projectId, 'project-url-blueprint')
  assert.equal(imported.prototypeAsset.type, 'prototype-demo')
  assert.equal(imported.prototypeAsset.sourceAssetId, imported.blueprintAsset.id)
  assert.ok(imported.prototypeAsset.prototypeDemo.screens.length >= 3)
  assert.ok(imported.prototypeAsset.prototypeDemo.screens.some((screen) => screen.hotspots?.length))
  assert.ok(imported.prototypeAsset.prototypeDemo.transitions.length >= 1)
  assert.equal(imported.blueprintAsset.blueprint.profile.productName, 'FlowPilot AI')
  assert.ok(imported.blueprintAsset.blueprint.framework.children.length >= 3)
  assert.ok(imported.blueprintAsset.blueprint.demoScreens.length >= 3)
  assert.ok(imported.blueprintMaterials.length >= 4)
  assert.ok(imported.blueprintMaterials.every((item) => item.sourceType === 'blueprint'))
  assert.ok(imported.blueprintMaterials.every((item) => item.sourceAssetId === imported.blueprintAsset.id))
  assert.equal(imported.parseJob.sourceType, 'website')
  assert.match(imported.parseJob.summary, /网站知识/)
  assert.match(imported.parseJob.summary, /交互 Demo/)
  assert.ok(snapshot.assets.some((asset) => asset.id === imported.blueprintAsset.id && asset.blueprint))
  assert.ok(snapshot.assets.some((asset) => asset.id === imported.prototypeAsset.id && asset.prototypeDemo))
  assert.ok(snapshot.materials.some((item) => item.sourceAssetId === imported.blueprintAsset.id))
})

testAsync('backend website import captures every prototype page screenshot and restores url jumps', async () => {
  const store = createWorkspaceStore()
  const capturedRequests = []
  const backendRoutes = workspaceRoutes(store, {
    captureWebsitePrototype: async (payload) => {
      capturedRequests.push(payload)
      return {
        source: 'backend-url-capture',
        pages: payload.pages.map((page, index) => ({
          id: index === 0 ? 'home' : page.url.split('/').pop(),
          url: page.url,
          title: page.title || (index === 0 ? 'FlowPilot AI' : page.url),
          screenshot: `data:image/png;base64,screen-${index}`,
          viewport: { width: 1440, height: 900 },
          links: page.url.endsWith('/product')
            ? [{ label: 'Start free', href: 'https://example.com/signup', rect: { x: 70, y: 8, width: 12, height: 6 } }]
            : [{ label: 'Back home', href: 'https://example.com/product', rect: { x: 6, y: 8, width: 14, height: 6 } }]
        }))
      }
    }
  })
  const imported = await backendRoutes['POST /api/workspace/materials/import-website']({
    projectId: 'project-url-prototype',
    url: 'https://example.com/product',
    importType: 'project-website',
    scope: 'same-domain',
    generateBlueprint: true,
    html: `
      <html>
        <head><title>FlowPilot AI</title><meta name="description" content="AI product workspace for teams"></head>
        <body>
          <h1>FlowPilot AI</h1>
          <p>Turn project websites into product blueprints.</p>
          <a href="/signup">Start free</a>
        </body>
      </html>
    `
  })
  const demo = imported.prototypeAsset.prototypeDemo
  const home = demo.screens.find((screen) => screen.url === 'https://example.com/product')
  const signup = demo.screens.find((screen) => screen.url === 'https://example.com/signup')

  assert.equal(capturedRequests.length, 1)
  assert.deepEqual(capturedRequests[0].pages.map((page) => page.url), [
    'https://example.com/product',
    'https://example.com/signup'
  ])
  assert.equal(demo.source, 'backend-url-capture')
  assert.ok(home)
  assert.ok(signup)
  assert.equal(home.screenshotUrl, 'data:image/png;base64,screen-0')
  assert.equal(signup.screenshotUrl, 'data:image/png;base64,screen-1')
  assert.equal(home.source, 'backend-url-capture')
  assert.equal(home.hotspots[0].label, 'Start free')
  assert.equal(home.hotspots[0].targetScreenId, signup.id)
  assert.deepEqual(home.hotspots[0].rect, { x: 70, y: 8, width: 12, height: 6 })
  assert.ok(demo.transitions.some((transition) => transition.from === home.id && transition.to === signup.id && transition.label === 'Start free'))
})

testAsync('backend website prototype normalizes relative captured links and stores screenshot assets', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store, {
    captureWebsitePrototype: async (payload) => ({
      source: 'backend-url-capture',
      pages: payload.pages.map((page, index) => ({
        id: index === 0 ? 'product-screen' : 'signup-screen',
        url: page.url,
        title: page.title || page.url,
        screenshotUrl: `data:image/png;base64,normalized-screen-${index}`,
        viewport: { width: 1365, height: 768 },
        links: page.url.endsWith('/product')
          ? [{ label: 'Start free', href: '/signup?utm=cta#top', rect: { x: 64, y: 12, width: 18, height: 7 } }]
          : [{ label: 'Back to product', href: 'https://example.com/product?back=1#hero', rect: { x: 4, y: 5, width: 16, height: 6 } }]
      }))
    })
  })
  const imported = await backendRoutes['POST /api/workspace/materials/import-website']({
    projectId: 'project-url-prototype-normalized',
    url: 'https://example.com/product?ref=nav#hero',
    importType: 'project-website',
    scope: 'same-domain',
    generateBlueprint: true,
    html: `
      <html>
        <head><title>FlowPilot AI</title></head>
        <body>
          <h1>FlowPilot AI</h1>
          <a href="/signup?utm=cta#top">Start free</a>
        </body>
      </html>
    `
  })
  const demo = imported.prototypeAsset.prototypeDemo
  const product = demo.screens.find((screen) => screen.url === 'https://example.com/product')
  const signup = demo.screens.find((screen) => screen.url === 'https://example.com/signup')

  assert.ok(product)
  assert.ok(signup)
  assert.equal(product.hotspots[0].targetScreenId, signup.id)
  assert.equal(product.hotspots[0].targetUrl, 'https://example.com/signup')
  assert.equal(signup.hotspots[0].targetScreenId, product.id)
  assert.ok(Array.isArray(demo.screenshotAssets))
  assert.equal(demo.screenshotAssets.length, demo.screens.length)
  assert.deepEqual(demo.screenshotAssets.map((asset) => asset.screenId), demo.screens.map((screen) => screen.id))
  assert.ok(demo.screenshotAssets.every((asset) => asset.storage === 'workspace-asset'))
  assert.ok(demo.screenshotAssets.every((asset) => asset.screenshotUrl.startsWith('data:image/png;base64,normalized-screen-')))
})

testAsync('backend website knowledge import is idempotent by normalized source page', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const payload = {
    projectId: 'project-website-idempotent',
    url: 'https://example.com/product?utm=first',
    importType: 'project-website',
    html: '<html><head><title>Example Product</title></head><body><h1>Example Product</h1><p>Knowledge base website import.</p><a href="/signup">Start</a></body></html>'
  }

  const first = await backendRoutes['POST /api/workspace/materials/import-website'](payload)
  const second = await backendRoutes['POST /api/workspace/materials/import-website']({
    ...payload,
    url: 'https://example.com/product?utm=second'
  })
  const listed = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-website-idempotent',
    type: 'knowledge'
  })

  assert.deepEqual(
    second.materials.map((item) => item.id).sort(),
    first.materials.map((item) => item.id).sort()
  )
  assert.equal(listed.materials.length, first.materials.length)
  assert.ok(listed.materials.every((item) => item.sourceUrl === 'https://example.com/product'))
})

testAsync('backend parse jobs record website import lifecycle', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const created = await backendRoutes['POST /api/workspace/parse-jobs']({
    projectId: 'project-a',
    sourceType: 'website',
    sourceUrl: 'https://example.com/docs',
    action: 'website-import'
  })

  assert.equal(created.job.projectId, 'project-a')
  assert.equal(created.job.status, 'pending')
  assert.equal(created.job.sourceUrl, 'https://example.com/docs')

  const imported = await backendRoutes['POST /api/workspace/materials/import-website']({
    projectId: 'project-a',
    url: 'https://example.com/product',
    importType: 'project-website',
    html: '<html><head><title>Product</title></head><body><h1>Product</h1><p>Knowledge base website import for collaboration.</p></body></html>'
  })
  const listed = await backendRoutes['GET /api/workspace/parse-jobs']({
    projectId: 'project-a'
  })

  assert.ok(imported.parseJob)
  assert.equal(imported.parseJob.status, 'succeeded')
  assert.equal(imported.parseJob.materialCount, imported.materials.length)
  assert.ok(imported.parseJob.durationMs >= 0)
  assert.ok(listed.jobs.some((job) => job.id === created.job.id && job.status === 'pending'))
  assert.ok(listed.jobs.some((job) => job.id === imported.parseJob.id && job.status === 'succeeded'))
})

testAsync('backend workspace imports same-domain website pages as one parse job', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store, {
    importWebsiteKnowledge: (payload) => buildWebsiteKnowledgeBatchImport({
      ...payload,
      pages: [
        {
          url: 'https://example.com/',
          html: '<html><head><title>Example Home</title></head><body><h1>Example Home</h1><p>Knowledge base website import.</p><a href="/pricing">Pricing</a></body></html>'
        },
        {
          url: 'https://example.com/pricing',
          html: '<html><head><title>Pricing</title></head><body><h1>Pricing</h1><p>Starter plan is free. Pro plan is $19.</p></body></html>'
        }
      ]
    })
  })

  const imported = await backendRoutes['POST /api/workspace/materials/import-website']({
    projectId: 'project-a',
    url: 'https://example.com/',
    importType: 'project-website',
    scope: 'same-domain'
  })
  const listed = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-a',
    type: 'knowledge'
  })

  assert.equal(imported.summary.pageCount, 2)
  assert.equal(imported.summary.scope, 'same-domain')
  assert.ok(imported.materials.some((item) => item.sourceUrl === 'https://example.com/'))
  assert.ok(imported.materials.some((item) => item.sourceUrl === 'https://example.com/pricing'))
  assert.equal(listed.materials.length, imported.materials.length)
  assert.equal(imported.parseJob.status, 'succeeded')
  assert.equal(imported.parseJob.materialCount, imported.materials.length)
})

testAsync('backend workspace imports blueprint knowledge atomically with parse job', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const blueprint = buildProjectBlueprint({
    project: { id: 'project-blueprint', name: 'Blueprint App' },
    input: '做一个支持上传解析和蓝图生成的项目',
    documents: [{ name: 'PRD.md', text: '上传资料后生成蓝图、页面和验收标准。' }]
  })

  const imported = await backendRoutes['POST /api/workspace/materials/import-blueprint']({
    projectId: 'project-blueprint',
    sourceAssetId: 'asset-blueprint-1',
    blueprint
  })
  const listed = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-blueprint',
    type: 'knowledge'
  })

  assert.ok(imported.materials.length >= 4)
  assert.ok(imported.materials.every((item) => item.type === 'knowledge'))
  assert.ok(imported.materials.every((item) => item.sourceType === 'blueprint'))
  assert.ok(imported.materials.every((item) => item.sourceAssetId === 'asset-blueprint-1'))
  assert.equal(imported.parseJob.status, 'succeeded')
  assert.equal(imported.parseJob.sourceType, 'blueprint')
  assert.equal(imported.parseJob.materialCount, imported.materials.length)
  assert.equal(listed.materials.length, imported.materials.length)
})

testAsync('backend workspace imports document knowledge atomically with parse job', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const imported = await backendRoutes['POST /api/workspace/materials/import-documents']({
    projectId: 'project-docs',
    type: 'requirements',
    documents: [
      { name: '需求.md', type: 'text/markdown', content: '# 需求\n需要知识库后端解析任务。' },
      { name: '空文件.pdf', type: 'application/pdf', content: '' }
    ]
  })
  const listed = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-docs',
    type: 'requirements'
  })

  assert.equal(imported.summary.total, 2)
  assert.equal(imported.summary.parsed, 1)
  assert.equal(imported.summary.failed, 1)
  assert.equal(imported.materials.length, 1)
  assert.equal(imported.materials[0].sourceType, 'document')
  assert.equal(imported.materials[0].title, '需求.md')
  assert.equal(imported.parseJob.status, 'succeeded')
  assert.equal(imported.parseJob.sourceType, 'document')
  assert.equal(imported.parseJob.materialCount, 1)
  assert.equal(listed.materials.length, 1)
})

testAsync('backend workspace import routes are idempotent by source fingerprint', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const blueprint = buildProjectBlueprint({
    project: { id: 'project-idempotent', name: 'Idempotent App' },
    input: '把蓝图和上传资料沉淀为知识库',
    documents: [{ name: 'PRD.md', text: '需要避免重复导入同一来源资料。' }]
  })

  const firstBlueprintImport = await backendRoutes['POST /api/workspace/materials/import-blueprint']({
    projectId: 'project-idempotent',
    sourceAssetId: 'asset-blueprint-idempotent',
    blueprint
  })
  const secondBlueprintImport = await backendRoutes['POST /api/workspace/materials/import-blueprint']({
    projectId: 'project-idempotent',
    sourceAssetId: 'asset-blueprint-idempotent',
    blueprint
  })
  const documentFirst = await backendRoutes['POST /api/workspace/materials/import-documents']({
    projectId: 'project-idempotent',
    type: 'requirements',
    documents: [{ id: 'doc-prd', name: 'PRD.md', type: 'text/markdown', content: '# 需求\n第一版内容。' }]
  })
  const documentSecond = await backendRoutes['POST /api/workspace/materials/import-documents']({
    projectId: 'project-idempotent',
    type: 'requirements',
    documents: [{ id: 'doc-prd', name: 'PRD.md', type: 'text/markdown', content: '# 需求\n第二版内容，应该更新同一条资料。' }]
  })
  const listedKnowledge = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-idempotent',
    type: 'knowledge'
  })
  const listedRequirements = await backendRoutes['GET /api/workspace/materials']({
    projectId: 'project-idempotent',
    type: 'requirements'
  })

  assert.deepEqual(
    secondBlueprintImport.materials.map((item) => item.id).sort(),
    firstBlueprintImport.materials.map((item) => item.id).sort()
  )
  assert.equal(listedKnowledge.materials.length, firstBlueprintImport.materials.length)
  assert.equal(documentSecond.materials[0].id, documentFirst.materials[0].id)
  assert.equal(listedRequirements.materials.length, 1)
  assert.match(listedRequirements.materials[0].content, /第二版内容/)
})

testAsync('workspace material model preserves knowledge governance fields', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const { material } = await backendRoutes['POST /api/workspace/materials']({
    id: 'material-governed',
    projectId: 'project-a',
    type: 'knowledge',
    title: '官网产品事实',
    roleScopes: ['product', 'ux', 'development'],
    owner: '产品负责人',
    verification: { status: 'verified', verifiedBy: 'PM', verifiedAt: '2026-06-21T08:00:00.000Z' },
    expiresAt: '2026-09-21T08:00:00.000Z',
    tags: ['官网', '定价'],
    relations: [{ type: 'source-page', target: 'https://example.com' }],
    chunks: [{ id: 'chunk-a', text: 'Starter plan', roleScopes: ['product'] }]
  })

  assert.deepEqual(material.roleScopes, ['product', 'ux', 'development'])
  assert.equal(material.owner, '产品负责人')
  assert.equal(material.verification.status, 'verified')
  assert.equal(material.expiresAt, '2026-09-21T08:00:00.000Z')
  assert.deepEqual(material.tags, ['官网', '定价'])
  assert.equal(material.relations[0].type, 'source-page')
  assert.equal(material.chunks[0].id, 'chunk-a')
})

testAsync('backend material search returns role scoped chunks with evidence', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  await backendRoutes['POST /api/workspace/materials']({
    id: 'knowledge-product',
    projectId: 'project-a',
    type: 'knowledge',
    title: '官网定价资料',
    content: 'Starter plan supports product teams.',
    roleScopes: ['product', 'ai-retrieval'],
    chunks: [
      {
        id: 'chunk-pricing',
        heading: 'Pricing',
        text: 'Starter plan is free and Pro plan includes collaboration.',
        roleScopes: ['product', 'ai-retrieval']
      }
    ],
    evidence: [{ url: 'https://example.com/pricing', title: 'Pricing' }]
  })
  await backendRoutes['POST /api/workspace/materials']({
    id: 'knowledge-dev',
    projectId: 'project-a',
    type: 'knowledge',
    title: 'API 集成资料',
    content: 'Webhook and API integration notes.',
    roleScopes: ['development', 'ai-retrieval'],
    chunks: [
      {
        id: 'chunk-api',
        heading: 'API',
        text: 'Developers can use webhook callbacks and API keys.',
        roleScopes: ['development', 'ai-retrieval']
      }
    ],
    evidence: [{ url: 'https://example.com/docs/api', title: 'API Docs' }]
  })

  const productResult = await backendRoutes['POST /api/workspace/materials/search']({
    projectId: 'project-a',
    query: 'pro plan collaboration',
    roleScope: 'product'
  })
  const devResult = await backendRoutes['POST /api/workspace/materials/search']({
    projectId: 'project-a',
    query: 'webhook api keys',
    roleScope: 'development'
  })

  assert.equal(productResult.results[0].materialId, 'knowledge-product')
  assert.equal(productResult.results[0].chunk.id, 'chunk-pricing')
  assert.equal(productResult.results[0].evidence[0].url, 'https://example.com/pricing')
  assert.ok(productResult.results[0].score > 0)
  assert.equal(devResult.results[0].materialId, 'knowledge-dev')
  assert.equal(devResult.results[0].chunk.id, 'chunk-api')
  assert.equal(devResult.results[0].evidence[0].url, 'https://example.com/docs/api')
  assert.ok(devResult.results.every((item) => item.roleScopes.includes('development')))
})

testAsync('backend material governance can verify owner and reason in batch', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  await backendRoutes['POST /api/workspace/materials']({
    id: 'knowledge-review-a',
    projectId: 'project-a',
    type: 'knowledge',
    title: '待审核知识 A'
  })
  await backendRoutes['POST /api/workspace/materials']({
    id: 'knowledge-review-b',
    projectId: 'project-a',
    type: 'knowledge',
    title: '待审核知识 B'
  })

  const result = await backendRoutes['POST /api/workspace/materials/governance']({
    ids: ['knowledge-review-a', 'knowledge-review-b'],
    action: 'verify',
    owner: '产品负责人',
    verificationStatus: 'verified',
    reason: '已由 PM 审核'
  })

  assert.equal(result.updated, 2)
  assert.ok(result.materials.every((item) => item.owner === '产品负责人'))
  assert.ok(result.materials.every((item) => item.verification.status === 'verified'))
  assert.ok(result.materials.every((item) => item.verification.reason === '已由 PM 审核'))
})

testAsync('backend exports role scoped knowledge package as markdown and json', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  await backendRoutes['POST /api/workspace/materials']({
    id: 'knowledge-export-product',
    projectId: 'project-a',
    type: 'knowledge',
    title: '产品定位',
    content: '面向产品团队的 AI 项目工作台。',
    roleScopes: ['product', 'ai-retrieval'],
    chunks: [{ id: 'chunk-positioning', heading: '定位', text: 'AI 项目工作台', roleScopes: ['product'] }],
    evidence: [{ url: 'https://example.com/product', title: 'Product' }]
  })
  await backendRoutes['POST /api/workspace/materials']({
    id: 'knowledge-export-dev',
    projectId: 'project-a',
    type: 'knowledge',
    title: '开发接口',
    content: 'Webhook API。',
    roleScopes: ['development'],
    evidence: [{ url: 'https://example.com/api', title: 'API' }]
  })

  const exported = await backendRoutes['POST /api/workspace/materials/export-role-package']({
    projectId: 'project-a',
    roleScope: 'product'
  })

  assert.equal(exported.fileName, 'project-a-product-knowledge-package.md')
  assert.match(exported.markdown, /# project-a 产品知识包/)
  assert.match(exported.markdown, /产品定位/)
  assert.match(exported.markdown, /https:\/\/example\.com\/product/)
  assert.doesNotMatch(exported.markdown, /开发接口/)
  assert.deepEqual(exported.json.items.map((item) => item.id), ['knowledge-export-product'])
})

test('parses real website details into outline chunks ctas and product signals', () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Flow AI - Product workspace</title>
        <meta name="description" content="Flow AI helps product teams turn websites, docs, and user feedback into reusable knowledge.">
      </head>
      <body>
        <nav>
          <a href="/pricing">Pricing</a>
          <a href="/pricing">Pricing</a>
          <a href="/docs">Docs</a>
        </nav>
        <main>
          <section>
            <h1>Flow AI product workspace</h1>
            <p>Import project websites, parse product positioning, and generate a knowledge base for product managers and designers.</p>
            <a class="primary" href="/signup">Start free</a>
          </section>
          <section>
            <h2>Knowledge base import</h2>
            <p>Website import extracts page structure, CTA buttons, FAQ, pricing, feature lists, and source evidence.</p>
          </section>
          <section>
            <h2>Pricing</h2>
            <p>Starter plan is free. Pro plan costs $19 per editor and includes collaboration, automation, and API access.</p>
            <a href="/contact">Contact sales</a>
          </section>
          <section>
            <h2>FAQ</h2>
            <h3>Can I sync docs?</h3>
            <p>Yes, teams can sync docs weekly and disable low quality chunks.</p>
          </section>
        </main>
      </body>
    </html>
  `

  const parsed = parseWebsiteHtml({
    url: 'https://flow.example.com/?utm=source#hero',
    importType: 'project-website',
    html
  }, { capturedAt: '2026-06-20T08:00:00.000Z' })

  assert.equal(parsed.sourceUrl, 'https://flow.example.com/')
  assert.equal(parsed.title, 'Flow AI - Product workspace')
  assert.equal(parsed.description, 'Flow AI helps product teams turn websites, docs, and user feedback into reusable knowledge.')
  assert.equal(parsed.pageType, 'pricing')
  assert.deepEqual(parsed.headings.map((heading) => `${heading.level}:${heading.text}`), [
    '1:Flow AI product workspace',
    '2:Knowledge base import',
    '2:Pricing',
    '2:FAQ',
    '3:Can I sync docs?'
  ])
  assert.deepEqual(parsed.links.map((link) => link.href), [
    'https://flow.example.com/pricing',
    'https://flow.example.com/docs',
    'https://flow.example.com/signup',
    'https://flow.example.com/contact'
  ])
  assert.deepEqual(parsed.ctas.map((cta) => cta.label), ['Start free', 'Contact sales'])
  assert.ok(parsed.chunks.length >= 4)
  assert.ok(parsed.chunks.some((chunk) => chunk.heading === 'Pricing' && chunk.text.includes('$19 per editor')))
  assert.ok(parsed.signals.features.includes('website import'))
  assert.ok(parsed.signals.features.includes('api'))
  assert.ok(parsed.signals.pricing.some((item) => item.includes('$19 per editor')))
  assert.ok(parsed.signals.faq.some((item) => item.includes('Can I sync docs?')))
  assert.ok(parsed.evidenceText.includes('Import project websites'))

  const result = buildWebsiteKnowledgeImport({
    projectId: 'project-c',
    url: 'https://flow.example.com/',
    importType: 'project-website',
    html
  }, { capturedAt: '2026-06-20T08:00:00.000Z' })
  const overview = result.items.find((item) => item.category === 'product-fact')
  assert.equal(overview.parsed.title, 'Flow AI - Product workspace')
  assert.equal(overview.parsed.headings.length, 5)
  assert.ok(result.items.some((item) => item.category === 'knowledge-chunk' && item.parsed.chunk.heading === 'Pricing'))
})

testAsync('builds a website knowledge batch import from multiple site pages', async () => {
  const result = buildWebsiteKnowledgeBatchImport({
    projectId: 'project-c',
    importType: 'project-website',
    scope: 'same-domain',
    pages: [
      {
        url: 'https://flow.example.com/',
        html: '<html><head><title>Flow Home</title></head><body><h1>Flow Home</h1><p>Knowledge base collaboration workspace.</p></body></html>'
      },
      {
        url: 'https://flow.example.com/pricing',
        html: '<html><head><title>Pricing</title></head><body><h1>Pricing</h1><p>Starter plan is free. Pro plan is $19 per editor.</p></body></html>'
      }
    ]
  }, { capturedAt: '2026-06-20T08:00:00.000Z' })

  assert.equal(result.summary.projectId, 'project-c')
  assert.equal(result.summary.pageCount, 2)
  assert.equal(result.summary.scope, 'same-domain')
  assert.ok(result.items.some((item) => item.sourceUrl === 'https://flow.example.com/'))
  assert.ok(result.items.some((item) => item.sourceUrl === 'https://flow.example.com/pricing'))
  assert.ok(result.items.some((item) => item.category === 'pricing'))
})

testAsync('website knowledge API returns current-project knowledge items', async () => {
  const result = await routes['POST /api/knowledge/from-website']({
    projectId: 'project-b',
    url: 'https://notion.example/help',
    importType: 'help-center',
    scope: 'single',
    html: `
      <html>
        <head><title>Help workspace</title></head>
        <body>
          <h1>Help center</h1>
          <p>Docs explain how teams import websites into a knowledge base.</p>
        </body>
      </html>
    `
  })

  assert.equal(result.summary.projectId, 'project-b')
  assert.ok(result.items.length >= 2)
  assert.ok(result.items.every((item) => item.projectId === 'project-b'))
  assert.ok(result.items.every((item) => item.status === '已解析'))
  assert.ok(result.items.every((item) => item.meta.includes('网站导入')))
})

test('storage falls back to compact capture data when full workspace exceeds quota', () => {
  const writes = []
  const originalWarn = console.warn
  console.warn = () => {}
  globalThis.localStorage = {
    setItem(key, value) {
      writes.push({ key, value })
      if (writes.length === 1) {
        const error = new Error('QuotaExceededError')
        error.name = 'QuotaExceededError'
        throw error
      }
    }
  }
  const screenshot = `data:image/png;base64,${'a'.repeat(5000)}`

  try {
    saveState({
      currentProjectId: 'project-flow',
      projects: [{ id: 'project-flow', name: '流程通默认项目' }],
      captureResult: {
        title: '采集页',
        url: 'https://example.com',
        screenshot,
        raw: { layoutNodeCount: 117, screenshotCaptured: true },
        layoutNodes: [
          { id: 'hero', type: 'image', src: screenshot, svg: '<svg></svg>', text: 'Hero', width: 100, height: 80 }
        ],
        components: [{ name: 'Hero' }]
      },
      generatedPageHtml: '<!doctype html><main>页面已生成</main>'
    })
  } finally {
    console.warn = originalWarn
  }

  assert.equal(writes.length, 2)
  const compact = JSON.parse(writes[1].value)
  assert.equal(compact.captureResult.raw.layoutNodeCount, 117)
  assert.equal(compact.captureResult.screenshot, null)
  assert.equal(compact.captureResult.layoutNodes[0].src, '')
  assert.match(compact.generatedPageHtml, /页面已生成/)
})

test('storage never blocks workflow navigation when compact save also exceeds quota', () => {
  const writes = []
  const originalWarn = console.warn
  console.warn = () => {}
  globalThis.localStorage = {
    removeItem(key) {
      writes.push({ key, removed: true })
    },
    setItem(key, value) {
      writes.push({ key, value })
      const setAttempts = writes.filter((write) => 'value' in write).length
      if (setAttempts <= 2) {
        const error = new Error('QuotaExceededError')
        error.name = 'QuotaExceededError'
        throw error
      }
    }
  }

  assert.doesNotThrow(() => saveState({
    currentProjectId: 'project-flow',
    projects: [{ id: 'project-flow', name: '流程通默认项目' }],
    activeWorkflowRun: {
      id: 'run-1',
      currentStepId: 'analysis',
      input: '分发能力 Youtube 管理端',
      projectBlueprint: { title: 'Podcastor.ai 项目蓝图', framework: { children: [] } },
      documentAnalysis: {
        documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', text: 'a'.repeat(500000) }],
        blueprint: { title: '重复蓝图', large: 'b'.repeat(500000) },
        canvas: { nodes: [{ id: 'analysis', title: '文档分析结果', content: 'c'.repeat(500000) }] }
      },
      referenceFiles: {
        analysis: [{ name: 'Podcastor.ai v1.0产品文档.docx', text: 'd'.repeat(500000) }]
      }
    },
    requirements: [{ title: 'Podcastor.ai v1.0产品文档.docx', content: 'e'.repeat(500000) }],
    restoredPages: [{ id: 'page-1', html: 'f'.repeat(500000), files: [{ path: 'index.html', content: 'g'.repeat(500000) }] }]
  }))

  console.warn = originalWarn
  assert.ok(writes.filter((write) => write.removed).length >= 1)
  assert.ok(writes.filter((write) => 'value' in write).length >= 2)
  const compact = JSON.parse(writes.filter((write) => 'value' in write).at(-1).value)
  assert.equal(compact.activeWorkflowRun.documentAnalysis, null)
  assert.equal(compact.activeWorkflowRun.referenceFiles.analysis[0].text, '')
  assert.equal(compact.requirements[0].content, '')
})

test('compact workspace keeps capture summary without large binary fields', () => {
  const compact = compactWorkspaceStateForStorage({
    captureResult: {
      screenshot: 'data:image/png;base64,large',
      singleFileHtml: '<!doctype html><html><body>large</body></html>',
      domSnapshot: { documents: [{ nodes: { nodeName: ['HTML'] } }] },
      layoutNodes: [
        { id: 'node-1', type: 'svg', svg: '<svg><path /></svg>', src: 'data:image/png;base64,large', text: '保留文本' }
      ]
    }
  })

  assert.equal(compact.captureResult.screenshot, null)
  assert.equal(compact.captureResult.singleFileHtml, '')
  assert.equal(compact.captureResult.domSnapshot, null)
  assert.equal(compact.captureResult.layoutNodes[0].svg, '')
  assert.equal(compact.captureResult.layoutNodes[0].src, '')
  assert.equal(compact.captureResult.layoutNodes[0].text, '保留文本')
})

testAsync('capture diagnostic shows SingleFile and DOMSnapshot status', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const diagnosticStart = appSource.indexOf('class="capture-diagnostic-detail"')
  const diagnosticEnd = appSource.indexOf('</details>', diagnosticStart)
  const diagnosticSource = appSource.slice(diagnosticStart, diagnosticEnd)

  assert.ok(diagnosticStart > 0)
  assert.ok(diagnosticEnd > diagnosticStart)
  assert.match(diagnosticSource, /SingleFile/)
  assert.match(diagnosticSource, /DOMSnapshot/)
})

testAsync('web factory exposes browser authorization session creation', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(appSource, /打开授权浏览器/)
  assert.match(appSource, /capture-browser-auth-panel/)
  assert.match(appSource, /我已登录，开始采集/)
  assert.match(appSource, /openManualBrowserAuthorization/)
  assert.match(appSource, /captureAfterManualBrowserLogin/)
  assert.doesNotMatch(appSource, /授权浏览器账号/)
  assert.doesNotMatch(appSource, /授权浏览器密码/)
  assert.doesNotMatch(appSource, /captureBrowserCredentials/)
  assert.doesNotMatch(appSource, /submitBrowserCredentialCapture/)
  assert.match(appSource, /captureForm\.authMode = 'browser'[\s\S]*selectedCaptureRecoveryFlowId\.value = 'remote-browser'/)
  assert.match(appSource, /embedded-browser-panel/)
  assert.match(appSource, /refreshBrowserPreview/)
  assert.match(appSource, /browserPreview\.autoRefresh/)
  assert.match(appSource, /startBrowserPreviewPolling/)
  assert.match(appSource, /scrollBrowserPreview/)
  assert.match(appSource, /options\.silent/)
  const refreshStart = appSource.indexOf('async function refreshBrowserPreview')
  const refreshEnd = appSource.indexOf('async function runBrowserSessionAction', refreshStart)
  const refreshSource = appSource.slice(refreshStart, refreshEnd)
  assert.match(refreshSource, /options\.silent[\s\S]*\?\s*\(result\.ok \? result\.data : null\)/)
  assert.match(refreshSource, /:\s*applyApiResult\(browserPreviewStatus, result, '授权浏览器画面获取失败'\)/)
  assert.match(appSource, /clickBrowserPreview/)
  assert.match(appSource, /createBrowserSession/)
  assert.match(appSource, /请先打开授权浏览器并完成登录/)
  assert.match(apiSource, /\/api\/browser-sessions\/create/)
  assert.match(apiSource, /\/api\/browser-sessions\/preview/)
  assert.match(apiSource, /\/api\/browser-sessions\/action/)
  assert.match(apiSource, /\/api\/browser-sessions\/close/)
})

testAsync('web factory explains four capture fallback paths and uses image restore composer layout', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const imageStart = appSource.indexOf("factoryHomeTab === 'image-code'")
  const imageEnd = appSource.indexOf("factoryHomeTab === 'url-code'", imageStart)
  const imageSource = appSource.slice(imageStart, imageEnd)

  assert.match(appSource, /使用远程浏览器登录后再采集/)
  assert.match(appSource, /提供 Cookie \/ 登录态/)
  assert.match(appSource, /上传网页快照包/)
  assert.match(appSource, /上传截图走“图片转代码”/)
  assert.match(imageSource, /image-restore-composer/)
  assert.match(imageSource, /image-restore-dropzone/)
  assert.match(imageSource, /image-restore-upload-tile/)
  assert.match(imageSource, /image-restore-actions/)
  assert.match(imageSource, /image-prompt-upload/)
  assert.match(imageSource, /placeholder="上传截图、设计稿或参考图，系统会先识别页面布局、视觉层级和组件结构，再生成静态 HTML。"/)
  assert.doesNotMatch(imageSource, /image-prompt-meta/)
  assert.doesNotMatch(imageSource, /∞ Agent/)
  assert.match(imageSource, /composer-chip-menu/)
  assert.match(imageSource, /composer-floating-menu/)
  assert.match(imageSource, /selectImageCodeTarget/)
  assert.doesNotMatch(imageSource, /<select class="composer-chip-select" v-model="imageCodeForm\.target"/)
  assert.doesNotMatch(imageSource, /上传设计图生成代码/)
  assert.match(cssSource, /\.image-restore-composer\s*\{[\s\S]*width:\s*min\(1120px, calc\(100vw - 220px\)\)/)
  assert.match(cssSource, /\.image-restore-dropzone\s*\{[\s\S]*grid-template-columns:\s*104px minmax\(0, 1fr\)/)
  assert.match(cssSource, /\.composer-floating-menu\s*\{[\s\S]*?box-shadow:\s*0 18px 44px rgba\(34, 37, 41, 0\.16\)/)
})

testAsync('image to code entry never wraps the uploaded screenshot as html', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const imageStart = appSource.indexOf("factoryHomeTab === 'image-code'")
  const imageEnd = appSource.indexOf("factoryHomeTab === 'url-code'", imageStart)
  const imageSource = appSource.slice(imageStart, imageEnd)
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(imageSource, /@change="handleImageCodeFile"/)
  assert.match(imageSource, /v-model="imageCodeForm\.prompt"/)
  assert.match(imageSource, /:disabled="imageCodeStatus\.status === 'loading' \|\| !imageCodeForm\.imageDataUrl"/)
  assert.match(imageSource, /@click="generateFromImage"/)
  assert.match(generateSource, /captureKind:\s*'image-to-code'/)
  assert.match(generateSource, /screenshotCaptured:\s*true/)
  assert.match(generateSource, /state\.captureResult = captureResult/)
  assert.match(generateSource, /后端正在根据上传图片生成结构化 HTML/)
  assert.doesNotMatch(generateSource, /imageToStaticHtml/)
  assert.doesNotMatch(generateSource, /<img[^>]+imageCodeForm\.imageDataUrl/)
})

testAsync('image to code calls backend vision html generation before saving restored asset', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(apiSource, /imageToHtmlStream\(config,\s*payload,\s*options = \{\}\)/)
  assert.match(apiSource, /\/api\/generate\/image-to-html/)
  assert.match(generateSource, /api\.generation\.imageToHtmlStream\(state\.apiConfig,\s*imagePayload,\s*\{/)
  assert.match(generateSource, /imageDataUrl:\s*imageCodeForm\.imageDataUrl/)
  assert.match(generateSource, /prompt:\s*imageCodeForm\.prompt/)
  assert.match(generateSource, /state\.captureResult = data\.visualModel/)
  assert.match(generateSource, /state\.generatedPageHtml = data\.html/)
  assert.match(generateSource, /upsertRestoredPageFromBackend\(data\.restoredPage\)/)
  assert.doesNotMatch(generateSource, /saveRestoredPageAsset/)
  assert.match(generateSource, /persistRestoredPageSelection\(restoredPage\.id\)/)
  assert.match(generateSource, /writeStaticHtmlPreviewWindow\(previewWindow,\s*buildStaticHtmlResultShell\(data\.html,\s*title,\s*\{/)
  assert.match(generateSource, /thumbnail:\s*imageCodeForm\.imageDataUrl/)
  assert.doesNotMatch(generateSource, /closeStaticHtmlPreviewWindow\(previewWindow\)/)
  assert.doesNotMatch(generateSource, /await openRestoredPageDetail\(restoredPage\.id\)/)
  assert.doesNotMatch(generateSource, /<img[^>]+imageCodeForm\.imageDataUrl/)
})

testAsync('image to code opens standalone browser result page without app sidebar', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)
  const previewStart = appSource.indexOf('function writeStaticHtmlPreviewWindow')
  const previewEnd = appSource.indexOf('function selectImageCodeTarget', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(generateSource, /const clientTaskId = `image-html-\$\{crypto\.randomUUID\(\)\}`/)
  assert.match(generateSource, /const previewWindow = window\.open\(previewTaskUrl\(clientTaskId\),\s*'_blank'\)/)
  assert.match(generateSource, /writeStaticHtmlPreviewWindow\(previewWindow,\s*buildStaticHtmlLoadingPage\(title,[\s\S]*clientTaskId/)
  assert.match(generateSource, /updateStaticHtmlPreviewUrl\(previewWindow,\s*projectScopedRoute\(`\/assets\/\$\{encodeURIComponent\(restoredPage\.id\)\}\/preview`/)
  assert.match(generateSource, /writeStaticHtmlPreviewWindow\(previewWindow,\s*buildStaticHtmlResultShell\(data\.html,\s*title,\s*\{/)
  assert.doesNotMatch(generateSource, /closeStaticHtmlPreviewWindow\(previewWindow\)/)
  assert.doesNotMatch(generateSource, /await openRestoredPageDetail\(restoredPage\.id\)/)
  assert.match(previewSource, /function previewTaskUrl\(taskId/)
  assert.match(previewSource, /function updateStaticHtmlPreviewUrl\(previewWindow,\s*taskId/)
  assert.match(previewSource, /function writeStaticHtmlPreviewWindow\(previewWindow,\s*html/)
  assert.match(previewSource, /previewWindow\.document\.write\(html\)/)
  assert.match(previewSource, /function buildStaticHtmlLoadingPage/)
  assert.match(previewSource, /function buildStaticHtmlStatusPage/)
  assert.match(previewSource, /function buildStaticHtmlFailurePage/)
  assert.match(previewSource, /function buildStaticHtmlResultShell\(html,\s*title/)
  assert.match(previewSource, /result-shell-standalone/)
  assert.match(previewSource, /result-topbar/)
  assert.match(previewSource, /height:\s*80px/)
  assert.match(previewSource, /返回首页/)
  assert.match(previewSource, /转 Vue 代码/)
  assert.match(previewSource, /下载 HTML/)
  assert.match(previewSource, /result-split-layout/)
  assert.match(previewSource, /generated-preview-frame/)
  assert.match(previewSource, /generated-source-code/)
  assert.match(previewSource, /任务 ID/)
  assert.match(previewSource, /code-rain/)
  assert.match(previewSource, /typing-cursor/)
  assert.match(previewSource, /AI 正在敲 HTML \/ CSS/)
  assert.match(previewSource, /grid-template-columns:\s*1fr/)
  assert.doesNotMatch(previewSource, /class="box"/)
  assert.doesNotMatch(previewSource, /grid-template-columns:\s*minmax\(0,\s*\.92fr\)\s+minmax\(320px,\s*\.78fr\)/)
  assert.match(previewSource, /生成骨架/)
  assert.match(previewSource, /补齐样式/)
  assert.match(previewSource, /写入交互/)
  assert.match(previewSource, /页面生成中/)
  assert.match(generateSource, /buildStaticHtmlStatusPage\(title,\s*event\.data\.label/)
  assert.match(generateSource, /buildStaticHtmlFailurePage\('生成失败'/)
  assert.doesNotMatch(previewSource, /app-shell/)
  assert.doesNotMatch(previewSource, /global-sidebar/)
})

testAsync('image to code standalone result splits generated preview and code', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)
  const previewStart = appSource.indexOf('function writeStaticHtmlPreviewWindow')
  const previewEnd = appSource.indexOf('function selectImageCodeTarget', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(previewSource, /function buildStaticHtmlResultShell\(html,\s*title/)
  assert.match(previewSource, /返回首页/)
  assert.match(previewSource, /转 Vue 代码/)
  assert.match(previewSource, /下载 HTML/)
  assert.match(previewSource, /<iframe class="generated-preview-frame"/)
  assert.match(previewSource, /<pre id="generated-source-code"/)
  assert.match(previewSource, /const previewSrcdoc = escapeHtmlAttr\(html\)/)
  assert.match(previewSource, /srcdoc="\$\{previewSrcdoc\}"/)
  assert.match(previewSource, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/)
  assert.match(previewSource, /max-width:\s*1760px/)
  assert.match(previewSource, /overflow-wrap:\s*anywhere/)
  assert.match(previewSource, /white-space:\s*pre-wrap/)
  assert.match(previewSource, /data-task-id/)
  assert.match(previewSource, /asset-id/)
  assert.match(previewSource, /escapeHtml\(html\)/)
  assert.match(generateSource, /writeStaticHtmlPreviewWindow\(previewWindow,\s*buildStaticHtmlResultShell\(data\.html,\s*title,\s*\{[\s\S]*taskId:\s*restoredPage\.id/)
  assert.doesNotMatch(generateSource, /closeStaticHtmlPreviewWindow\(previewWindow\)/)
  assert.doesNotMatch(generateSource, /writeStaticHtmlPreviewWindow\(previewWindow,\s*data\.html\)/)
})

testAsync('static html result shell escapes closing script tag for vue sfc build', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const previewStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const previewEnd = appSource.indexOf('function handleImageCodeFile', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(previewSource, /scriptCloseTag = '<\/scr' \+ 'ipt>'/)
  assert.match(previewSource, /\$\{scriptCloseTag\}/)
  assert.doesNotMatch(previewSource, /\n\s*<\/script>\n/)
})

testAsync('mock image to html generation returns structured html without embedding uploaded screenshot', async () => {
  const imageDataUrl = solidPngDataUrl(320, 240, [24, 32, 48, 255])
  const result = await routes['POST /api/generate/image-to-html']({
    projectId: 'project-flow',
    title: '登录页面截图',
    prompt: '还原成左侧品牌介绍、右侧登录表单的网页',
    imageDataUrl
  })

  assert.equal(result.status, 'generated')
  assert.ok(result.taskId)
  assert.match(result.html, /<!doctype html>/i)
  assert.match(result.html, /<main class="screenshot-restore-page" data-restore-source="screenshot">/)
  assert.match(result.html, /登录页面截图/)
  assert.doesNotMatch(result.html, /<img/i)
  assert.doesNotMatch(result.html, /data:image\/png/)
  assert.equal(result.captureResult.raw.captureKind, 'image-to-code')
  assert.equal(result.captureResult.raw.screenshotCaptured, true)
  assert.equal(result.visualVerification.status, 'passed')
  assert.ok(result.captureResult.layoutNodes.length >= 4)
  assert.ok(result.restoredPage?.id)
  assert.equal(result.restoredPage.projectId, 'project-flow')
  assert.match(result.restoredPage.html, /<main class="screenshot-restore-page" data-restore-source="screenshot">/)
  assert.match(result.restoredPage.files.find((file) => file.path === 'index.html')?.content || '', /<main class="screenshot-restore-page" data-restore-source="screenshot">/)
})

testAsync('image to html generation uses vision model output when provider is available', async () => {
  const { createMockApiRoutes } = await import('../server/mock-api.mjs')
  let receivedContext = null
  const provider = {
    name: 'fake-vision-model',
    async generate(context) {
      receivedContext = context
      return {
        content: JSON.stringify({
          visualModel: {
            source: { type: 'screenshot', title: '蝉镜AI首页', target: 'static-html', prompt: context.prompt || '', hasImage: true },
            pageType: 'SaaS / AI 工具后台首页',
            layout: [
              { id: 'sidebar', role: 'fixed-navigation', position: 'left', width: 180 },
              { id: 'workspace', role: 'workbench', position: 'main' },
              { id: 'hero-cards', role: 'primary-actions', position: 'top' }
            ],
            components: [
              { type: 'sidebar-nav', count: 1 },
              { type: 'gradient-card', count: 3 },
              { type: 'video-card', count: 6 }
            ],
            styleTokens: { colors: { orange: '#ff7a4d', purple: '#7b68ff', surface: '#ffffff' } },
            sections: [{ id: 'hero-cards', title: '顶部三个大功能入口', content: '创建数字人视频 / 定制数字人 / PPT/PDF 转视频' }]
          },
          html: '<!doctype html><html><body><main class="model-vision-page"><aside>首页</aside><section>创建数字人视频</section></main></body></html>',
          summary: '视觉模型已识别为 SaaS / AI 工具后台首页。'
        }),
        provider: 'fake-vision-model',
        model: 'vision-test',
        usage: { inputTokens: 11, outputTokens: 22, totalTokens: 33 }
      }
    }
  }
  const testRoutes = createMockApiRoutes({ agentProvider: provider })
  const imageDataUrl = solidPngDataUrl(320, 240, [255, 122, 77, 255])

  const result = await testRoutes['POST /api/generate/image-to-html']({
    projectId: 'project-flow',
    title: '蝉镜AI首页',
    prompt: '还原 SaaS / AI 工具后台首页',
    target: 'static-html',
    imageDataUrl
  })

  assert.ok(receivedContext)
  assert.equal(receivedContext.task, 'image-to-html-vision-analysis')
  assert.equal(receivedContext.imageDataUrl, imageDataUrl)
  assert.equal(receivedContext.timeoutMs, 180000)
  assert.match(receivedContext.userPrompt, /页面类型/)
  assert.match(receivedContext.userPrompt, /布局/)
  assert.equal(result.provider, 'fake-vision-model')
  assert.equal(result.model, 'vision-test')
  assert.equal(result.fallbackUsed, false)
  assert.match(result.html, /model-vision-page/)
  assert.equal(result.visualModel.pageType, 'SaaS / AI 工具后台首页')
  assert.equal(result.captureResult.raw.model, 'vision-test')
  assert.equal(result.captureResult.raw.provider, 'fake-vision-model')
  assert.equal(result.restoredPage.html, result.html)
})

testAsync('image to html generation prefers streaming vision output for long html responses', async () => {
  const { createMockApiRoutes } = await import('../server/mock-api.mjs')
  let streamed = false
  const provider = {
    name: 'fake-streaming-vision-model',
    async generate() {
      throw new Error('non-streaming generate should not be used for image html')
    },
    async *stream(context) {
      streamed = true
      yield {
        type: 'delta',
        content: JSON.stringify({
          visualModel: {
            source: { type: 'screenshot', title: '流式截图', target: 'static-html', prompt: context.prompt || '', hasImage: true },
            pageType: 'SaaS / AI 工具后台首页',
            layout: [{ id: 'main', role: 'workspace', position: 'main' }],
            components: [{ type: 'code-panel', count: 1 }]
          },
          html: '<!doctype html><html><body><main class="stream-model-page">流式生成 HTML</main></body></html>',
          summary: '流式视觉模型已生成 HTML。'
        })
      }
      yield {
        type: 'final',
        content: '',
        provider: 'fake-streaming-vision-model',
        model: 'vision-stream-test',
        usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 }
      }
    }
  }
  const testRoutes = createMockApiRoutes({ agentProvider: provider })

  const result = await testRoutes['POST /api/generate/image-to-html']({
    projectId: 'project-flow',
    title: '流式截图',
    target: 'static-html',
    imageDataUrl: solidPngDataUrl(320, 240, [69, 225, 245, 255])
  })

  assert.equal(streamed, true)
  assert.equal(result.fallbackUsed, false)
  assert.equal(result.provider, 'fake-streaming-vision-model')
  assert.equal(result.model, 'vision-stream-test')
  assert.match(result.html, /stream-model-page/)
})

testAsync('mock api defaults local runtime to Codex CCswitch model settings', async () => {
  const apiSource = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')

  assert.match(apiSource, /CODEX_CCSWITCH_MODEL_SETTINGS/)
  assert.match(apiSource, /apiKey:\s*'PROXY_MANAGED'/)
  assert.match(apiSource, /baseUrl:\s*'http:\/\/127\.0\.0\.1:15721\/v1'/)
  assert.match(apiSource, /defaultModel:\s*'gpt-5\.5'/)
  assert.match(apiSource, /apiSurface:\s*'responses'/)
  assert.match(apiSource, /timeoutMs:\s*180000/)
  assert.match(apiSource, /Number\(settings\?\.timeoutMs\)\s*===\s*CODEX_CCSWITCH_MODEL_SETTINGS\.timeoutMs/)
  assert.match(apiSource, /await ensureCcswitchModelSettings\(workspaceStore\)/)
  assert.match(apiSource, /createDefaultWorkflowAgentProvider\(globalThis\.fetch\)/)
  assert.match(apiSource, /if\s*\(isTestRuntime\)\s*\{[\s\S]*createAgentProviderFromEnv/)
  assert.match(apiSource, /return createAgentProviderFromModelSettings\(CODEX_CCSWITCH_MODEL_SETTINGS,\s*fetchImpl\)/)
})

testAsync('mock api streams workflow agent sse events as they are generated', async () => {
  const apiSource = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const workflowRouteSource = await readFile(new URL('../后端/routes/workflows.js', import.meta.url), 'utf8')

  assert.match(apiSource, /const wantsSse = req\.method === 'POST' && url\.pathname\.endsWith\('\/stream'\)/)
  assert.match(apiSource, /'Content-Type': 'text\/event-stream; charset=utf-8'/)
  assert.match(apiSource, /'X-Accel-Buffering': 'no'/)
  assert.match(apiSource, /writeEvent:\s*\(chunk\) => \{[\s\S]*res\.write\(chunk\)/)
  assert.match(apiSource, /const data = await handler\(payload,\s*req,\s*routeContext\)/)
  assert.match(apiSource, /routes\[`POST \/api\/workspace\/workflow-runs\/:id\/\$\{workflowRunMatch\[2\]\}`\]\(\{[\s\S]*\},\s*req,\s*routeContext\)/)
  assert.match(workflowRouteSource, /const writeEvent = typeof routeContext\.writeEvent === 'function'/)
  assert.match(workflowRouteSource, /writeEvent\?\.\(chunk\)/)
  assert.match(workflowRouteSource, /pushEvent\('status',\s*\{ status: 'generating', label: '生成回复' \}\)/)
})

testAsync('image to html stream reports fallback status before artifact', async () => {
  const apiSource = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const streamStart = apiSource.indexOf('async function generateImageToHtmlStream')
  const streamEnd = apiSource.indexOf('export function createMockApiRoutes', streamStart)
  const streamSource = apiSource.slice(streamStart, streamEnd)

  assert.match(streamSource, /if \(result\.fallbackUsed\)/)
  assert.match(streamSource, /stream\.push\('status',\s*\{/)
  assert.match(streamSource, /status:\s*'fallback'/)
  assert.match(streamSource, /视觉模型暂未返回/)
  assert.ok(streamSource.indexOf('result.fallbackUsed') < streamSource.indexOf("stream.push('artifact'"))
})

testAsync('mock api converts thrown stream route failures into sse error and done events', async () => {
  const apiSource = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const uploadRoutesSource = await readFile(new URL('../后端/routes/uploads.js', import.meta.url), 'utf8')
  const captureRoutesSource = await readFile(new URL('../后端/routes/capture.js', import.meta.url), 'utf8')

  assert.match(apiSource, /if \(wantsSse\) \{[\s\S]*res\.write\(sseEvent\('error'/)
  assert.match(apiSource, /res\.write\(sseEvent\('done',\s*\{ error:/)
  assert.match(apiSource, /res\.end\(\)[\s\S]*return[\s\S]*\}/)
  assert.match(uploadRoutesSource, /catch \(error\) \{[\s\S]*push\('error'/)
  assert.match(uploadRoutesSource, /push\('done',\s*\{ error:/)
  assert.match(captureRoutesSource, /catch \(error\) \{[\s\S]*push\('error'/)
  assert.match(captureRoutesSource, /push\('done',\s*\{ error:/)
})

testAsync('heavy generation APIs expose stream variants for incremental UI updates', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const mockSource = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const uploadRoutesSource = await readFile(new URL('../后端/routes/uploads.js', import.meta.url), 'utf8')
  const captureRoutesSource = await readFile(new URL('../后端/routes/capture.js', import.meta.url), 'utf8')

  assert.match(mockSource, /'POST \/api\/generate\/image-to-html\/stream'/)
  assert.match(captureRoutesSource, /'POST \/api\/capture\/generate-page\/stream'/)
  assert.match(uploadRoutesSource, /'POST \/api\/uploads\/documents\/analyze\/stream'/)
  assert.match(apiSource, /imageToHtmlStream\(config,\s*payload,\s*options = \{\}\)/)
  assert.match(apiSource, /\/api\/generate\/image-to-html\/stream/)
  assert.match(apiSource, /generatePageStream\(config,\s*payload,\s*options = \{\}\)/)
  assert.match(apiSource, /\/api\/capture\/generate-page\/stream/)
  assert.match(apiSource, /analyzeDocumentsStream\(config,\s*payload,\s*options = \{\}\)/)
  assert.match(apiSource, /\/api\/uploads\/documents\/analyze\/stream/)
})

testAsync('web factory documents frontend backend ownership for capture recovery flows', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const flowStart = appSource.indexOf('const captureRecoveryFlows')
  const flowEnd = appSource.indexOf('const factoryHeroCopy', flowStart)
  const flowSource = appSource.slice(flowStart, flowEnd)
  const modalStart = appSource.indexOf('class="project-create-modal capture-flow-info-modal"')
  const modalEnd = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'", modalStart)
  const modalSource = appSource.slice(modalStart, modalEnd)

  assert.ok(flowStart > 0)
  assert.match(flowSource, /remote-browser/)
  assert.match(flowSource, /cookie-session/)
  assert.match(flowSource, /snapshot-package/)
  assert.match(flowSource, /image-to-code/)
  assert.match(flowSource, /推荐方案/)
  assert.match(flowSource, /前端负责/)
  assert.match(flowSource, /后端负责/)
  assert.match(flowSource, /后端接管采集编排/)
  assert.match(flowSource, /handoff/)
  assert.match(appSource, /captureMethodOptions/)
  assert.match(appSource, /selectCaptureMethod/)
  assert.match(appSource, /goRecoveryFlow/)
  assert.match(modalSource, /selectedCaptureFlowInfo\.frontendOwner/)
  assert.match(modalSource, /selectedCaptureFlowInfo\.backendOwner/)
  assert.match(modalSource, /selectedCaptureFlowInfo\.handoff/)
})

testAsync('web factory moves temporary capture inputs into modal dialogs', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const urlStart = appSource.indexOf("factoryHomeTab === 'url-code'")
  const urlEnd = appSource.indexOf("factoryHomeTab === 'style-transfer'", urlStart)
  const urlComposerSource = appSource.slice(urlStart, urlEnd)
  const modalStart = appSource.indexOf('class="project-create-modal capture-auth-modal"')
  const modalEnd = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'", modalStart)
  const modalSource = appSource.slice(modalStart, modalEnd)

  assert.match(appSource, /showCaptureAuthModal/)
  assert.match(appSource, /openCaptureAuthModal/)
  assert.match(appSource, /closeCaptureAuthModal/)
  assert.match(modalSource, /capture-auth-modal/)
  assert.match(modalSource, /embedded-browser-panel/)
  assert.match(modalSource, /composer-cookie-input/)
  assert.match(modalSource, /composer-upload-chip/)
  assert.doesNotMatch(urlComposerSource, /embedded-browser-panel|composer-cookie-input|composer-upload-chip/)
})

testAsync('web factory hides implementation handoff fields behind an info modal', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryHomeStart = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'")
  const factoryHomeEnd = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'capture-detail'")
  const factoryHomeSource = appSource.slice(factoryHomeStart, factoryHomeEnd)
  const modalStart = appSource.indexOf('class="project-create-modal capture-flow-info-modal"')
  const modalEnd = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'", modalStart)
  const modalSource = appSource.slice(modalStart, modalEnd)

  assert.match(appSource, /showCaptureFlowInfoModal/)
  assert.match(appSource, /openCaptureFlowInfo/)
  assert.match(appSource, /closeCaptureFlowInfo/)
  assert.doesNotMatch(factoryHomeSource, /<dt>前端负责<\/dt>|<dt>后端负责<\/dt>|<dt>数据交接<\/dt>/)
  assert.doesNotMatch(factoryHomeSource, /selectedCaptureRecoveryFlow\.frontendOwner|selectedCaptureRecoveryFlow\.backendOwner|selectedCaptureRecoveryFlow\.handoff/)
  assert.match(modalSource, /selectedCaptureFlowInfo\.frontendOwner/)
  assert.match(modalSource, /selectedCaptureFlowInfo\.backendOwner/)
  assert.match(modalSource, /selectedCaptureFlowInfo\.handoff/)
  assert.match(cssSource, /\.capture-flow-info-modal\s*\{/)
})

testAsync('web factory presents capture method as a dropdown in the url composer', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const urlStart = appSource.indexOf("factoryHomeTab === 'url-code'")
  const urlEnd = appSource.indexOf("factoryHomeTab === 'style-transfer'", urlStart)
  const urlComposerSource = appSource.slice(urlStart, urlEnd)

  assert.match(urlComposerSource, /capture-method-menu/)
  assert.match(urlComposerSource, /captureMethodOptions/)
  assert.match(urlComposerSource, /captureMethodLabel/)
  assert.match(urlComposerSource, /selectCaptureMethod\(option\.id\)/)
  assert.match(urlComposerSource, /aria-label="采集方式"/)
  assert.match(appSource, /captureMethodOptions[\s\S]*remote-browser[\s\S]*授权浏览器/)
  assert.match(appSource, /captureMethodOptions[\s\S]*snapshot-package[\s\S]*网页快照包/)
  assert.match(appSource, /const selectedCaptureRecoveryFlowId = ref\('snapshot-package'\)/)
  assert.match(appSource, /const captureAuthModalMode = ref\('snapshot-package'\)/)
  assert.match(appSource, /const captureFlowInfoId = ref\('snapshot-package'\)/)
  assert.doesNotMatch(urlComposerSource, /capture-method-panel|capture-method-card|capture-method-detail|capture-tool-row/)
  assert.match(cssSource, /\.capture-method-menu\s*\{/)
  assert.match(cssSource, /\.composer-floating-menu\s*\{/)
})

testAsync('web factory keeps snapshot assets behind a modal instead of the main canvas', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryHomeStart = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'")
  const factoryHomeEnd = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'capture-detail'")
  const factoryHomeSource = appSource.slice(factoryHomeStart, factoryHomeEnd)
  const modalStart = appSource.indexOf('class="project-create-modal snapshot-assets-modal"')
  const modalEnd = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'", modalStart)
  const modalSource = appSource.slice(modalStart, modalEnd)

  assert.match(appSource, /showSnapshotAssetsModal/)
  assert.doesNotMatch(factoryHomeSource, /@click="showSnapshotAssetsModal = true"/)
  assert.doesNotMatch(factoryHomeSource, />快照记录</)
  assert.doesNotMatch(factoryHomeSource, /<section class="snapshot-assets-section">/)
  assert.match(modalSource, /snapshot-assets-section/)
  assert.match(modalSource, /currentSnapshotAssets/)
  assert.match(cssSource, /\.snapshot-assets-modal\s*\{/)
})

testAsync('capture detail keeps technical diagnostics collapsed by default', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`)
  const detailEnd = appSource.indexOf(`state.currentFactoryRoute === 'restored-detail'`, detailStart)
  const detailSource = appSource.slice(detailStart, detailEnd)
  const diagnosticStart = detailSource.indexOf('class="capture-diagnostic-detail"')
  const diagnosticEnd = detailSource.indexOf('</details>', diagnosticStart)
  const diagnosticSource = detailSource.slice(diagnosticStart, diagnosticEnd)
  const panelBeforeDiagnostic = detailSource.slice(0, diagnosticStart)

  assert.match(detailSource, /capture-diagnostic-detail/)
  assert.match(diagnosticSource, /<summary>采集诊断<\/summary>/)
  assert.match(diagnosticSource, /SingleFile/)
  assert.match(diagnosticSource, /DOMSnapshot/)
  assert.doesNotMatch(panelBeforeDiagnostic, /方式：|快照：|授权：|SingleFile：|DOMSnapshot：/)
  assert.match(detailSource, /生成高保真 HTML/)
  assert.match(cssSource, /\.capture-diagnostic-detail\s*\{/)
})

testAsync('web factory capture action opens capture detail in a new tab immediately', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const startCaptureStart = appSource.indexOf('async function startCapture()')
  const startCaptureEnd = appSource.indexOf('async function parseAndGenerateFromUrl', startCaptureStart)
  const startCaptureSource = appSource.slice(startCaptureStart, startCaptureEnd)
  const runCaptureStart = appSource.indexOf('async function runCaptureTask')
  const runCaptureEnd = appSource.indexOf('async function startCapture', runCaptureStart)
  const runCaptureSource = appSource.slice(runCaptureStart, runCaptureEnd)
  const routeStart = appSource.indexOf('function restoreFactoryRouteFromUrl')
  const routeEnd = appSource.indexOf('function restoreWorkflowAnalysisFromUrl', routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)

  assert.match(appSource, /#\/factory\/capture/)
  assert.match(appSource, /const PENDING_CAPTURE_TASK_KEY = 'liuchengtong-pending-capture-task'/)
  assert.match(appSource, /const captureDetailHref = computed/)
  assert.match(appSource, /target="_blank"/)
  assert.match(appSource, /:href="captureDetailHref"/)
  assert.match(appSource, /rel="noopener noreferrer"/)
  assert.match(appSource, /function persistPendingCaptureTask\(\)/)
  assert.match(appSource, /function consumePendingCaptureTask\(\)/)
  assert.match(appSource, /function resumePendingCaptureTask\(\)/)
  assert.match(appSource, /window\.location\.href\.split\('#'\)\[0\]/)
  assert.match(appSource, /window\.history\.replaceState\(\{\}, '', baseUrl\)/)
  assert.match(startCaptureSource, /persistPendingCaptureTask\(\)/)
  assert.match(startCaptureSource, /if \(captureAction\.value\.disabled\) return/)
  assert.doesNotMatch(startCaptureSource, /openCaptureDetailInNewTab\(\)/)
  assert.match(runCaptureSource, /recordFactoryTask\('capture'/)
  assert.match(runCaptureSource, /api\.capture\.start\(state\.apiConfig, snapshotCapturePayload\(\)\)/)
  assert.match(routeSource, /window\.location\.hash === '#\/factory\/capture'/)
  assert.match(routeSource, /openCaptureDetail\(\)/)
  assert.match(routeSource, /resumePendingCaptureTask\(\)/)
})

testAsync('web factory empty restored assets capture action runs the same capture flow', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const emptyActionStart = appSource.indexOf('function handleRestoredEmptyCaptureAction')
  const emptyActionEnd = appSource.indexOf('function adjustRestoredZoom', emptyActionStart)
  const emptyActionSource = appSource.slice(emptyActionStart, emptyActionEnd)
  const emptyStateStart = appSource.indexOf('<strong>暂无还原资产</strong>')
  const emptyStateEnd = appSource.indexOf('</section>', emptyStateStart)
  const emptyStateSource = appSource.slice(emptyStateStart, emptyStateEnd)

  assert.ok(emptyActionStart > 0)
  assert.match(emptyStateSource, /@click="handleRestoredEmptyCaptureAction"/)
  assert.match(emptyStateSource, /:disabled="captureAction\.loading"/)
  assert.match(emptyStateSource, /button-spinner/)
  assert.match(emptyActionSource, /factoryHomeTab\.value = 'url-code'/)
  assert.match(emptyActionSource, /if \(!captureForm\.url\.trim\(\)\)/)
  assert.match(emptyActionSource, /请先输入要采集的网页 URL/)
  assert.match(emptyActionSource, /void startCapture\(\)/)
  assert.doesNotMatch(emptyStateSource, /@click="factoryHomeTab = 'url-code'"/)
})

testAsync('web factory capture detail restores empty-state actions and can start capture from the detail page', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`)
  const detailEnd = appSource.indexOf(`state.currentFactoryRoute === 'restored-detail'`, detailStart)
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(detailSource, /capture-empty-actions/)
  assert.match(detailSource, /当前还没有采集结果/)
  assert.match(detailSource, /@click="runCaptureTask\(\)"/)
  assert.match(detailSource, /开始采集/)
  assert.match(detailSource, /返回采集页修改 URL/)
  assert.match(detailSource, /openCaptureAuthModal\(selectedCaptureRecoveryFlowId\)/)
})

testAsync('capture api falls back to workspace api base url for capture task endpoints', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const captureStart = apiSource.indexOf('  capture: {')
  const captureEnd = apiSource.indexOf('  generation:', captureStart)
  const captureSource = apiSource.slice(captureStart, captureEnd)

  assert.match(captureSource, /start\(config,\s*payload\)[\s\S]*request\(config\.captureBaseUrl \|\| config\.apiBaseUrl,\s*'\/api\/capture\/start'/)
  assert.match(captureSource, /result\(config,\s*taskId\)[\s\S]*request\(config\.captureBaseUrl \|\| config\.apiBaseUrl,\s*`\/api\/capture\/tasks\/\$\{taskId\}\/result`/)
  assert.doesNotMatch(captureSource, /request\(config\.captureBaseUrl,\s*'\/api\/capture\/start'/)
  assert.doesNotMatch(captureSource, /request\(config\.captureBaseUrl,\s*`\/api\/capture\/tasks/)
})

testAsync('capture task failure always leaves loading state and shows recovery actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const runCaptureStart = appSource.indexOf('async function runCaptureTask')
  const runCaptureEnd = appSource.indexOf('async function startCapture', runCaptureStart)
  const runCaptureSource = appSource.slice(runCaptureStart, runCaptureEnd)
  const detailStart = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`)
  const detailEnd = appSource.indexOf(`state.currentFactoryRoute === 'restored-detail'`, detailStart)
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(runCaptureSource, /try\s*\{[\s\S]*api\.capture\.start/)
  assert.match(runCaptureSource, /catch\s*\(error\)[\s\S]*setStatus\(captureStatus,\s*'failed'/)
  assert.match(runCaptureSource, /finally\s*\{[\s\S]*captureLoadingSeconds\.value/)
  assert.match(detailSource, /captureStatus\.status === 'failed' && !state\.captureResult/)
  assert.match(detailSource, /capture-failure-recovery/)
  assert.match(detailSource, /goRecoveryFlow\(flow\.id\)/)
})

testAsync('floating notices do not cover primary page header actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const noticeRule = cssSource.match(/\.notice\.floating\s*\{[\s\S]*?\}/)?.[0] || ''
  const noticeStart = appSource.indexOf('const Notice = defineComponent')
  const noticeEnd = appSource.indexOf('const Metric = defineComponent', noticeStart)
  const noticeSource = appSource.slice(noticeStart, noticeEnd)

  assert.match(appSource, /function clearStatusNotice\(/)
  assert.match(noticeSource, /onClick:\s*\(\)\s*=>\s*clearStatusNotice\(props\.result\)/)
  assert.match(noticeRule, /position:\s*fixed/)
  assert.match(noticeRule, /right:\s*24px/)
  assert.match(noticeRule, /left:\s*auto/)
  assert.match(noticeRule, /top:\s*24px/)
  assert.match(noticeRule, /width:\s*min\(420px,\s*calc\(100vw - 48px\)\)/)
  assert.doesNotMatch(noticeRule, /left:\s*50%/)
  assert.doesNotMatch(noticeRule, /transform:\s*translateX\(-50%\)/)
})

test('compact workspace removes large restored page and snapshot asset fields', () => {
  const largeImage = `data:image/png;base64,${'x'.repeat(1000)}`
  const compact = compactWorkspaceStateForStorage({
    restoredPages: [
      {
        id: 'restored-1',
        coverImage: largeImage,
        html: `<html>${largeImage}</html>`,
        files: [
          { path: 'src/pageData.js', content: largeImage },
          { path: 'src/App.vue', content: '<template />' }
        ]
      }
    ],
    assets: [
      {
        id: 'asset-1',
        type: 'web-snapshot',
        content: largeImage,
        designSource: {
          coverImage: largeImage,
          pages: [{ screenshot: largeImage }],
          raw: { layoutNodeCount: 2 }
        }
      }
    ]
  })

  assert.equal(compact.restoredPages[0].coverImage, null)
  assert.match(compact.restoredPages[0].html, /预览内容已压缩/)
  assert.equal(compact.restoredPages[0].files[0].content, '')
  assert.equal(compact.restoredPages[0].files[1].content, '<template />')
  assert.equal(compact.assets[0].content, '')
  assert.equal(compact.assets[0].designSource.coverImage, null)
  assert.equal(compact.assets[0].designSource.pages[0].screenshot, null)
})

test('normalizes factory workspace state for restored page assets', () => {
  const state = normalizeFactoryWorkspace({
    currentFactoryRoute: '',
    restoredPages: 'bad-value',
    selectedRestoredPageId: 123
  })

  assert.equal(state.currentFactoryRoute, 'home')
  assert.deepEqual(state.restoredPages, [])
  assert.equal(state.selectedRestoredPageId, '')
})

test('creates restored page asset with cover, source, generated time and files', () => {
  const capturedAt = '2026-06-20T08:00:00.000Z'
  const asset = createRestoredPageAsset({
    projectId: 'project-flow',
    captureResult: {
      title: '稿定 AI',
      url: 'https://www.gaoding.art/creation',
      screenshot: 'data:image/png;base64,cover',
      pages: [{ title: '稿定 AI', screenshot: 'data:image/png;base64,page-cover' }],
    raw: { capturedAt }
    },
    html: '<!doctype html><main>还原页面</main>',
    files: [{ path: 'src/App.vue', content: '<template />' }],
    visualVerification: {
      status: 'passed',
      summary: { averageScore: 99.2, passed: 1, failed: 0 }
    }
  })

  assert.equal(asset.projectId, 'project-flow')
  assert.equal(asset.title, '稿定 AI')
  assert.equal(asset.sourceUrl, 'https://www.gaoding.art/creation')
  assert.equal(asset.coverImage, 'data:image/png;base64,page-cover')
  assert.equal(asset.createdAt, capturedAt)
  assert.match(asset.html, /还原页面/)
  assert.deepEqual(asset.files.map((file) => file.path), ['src/App.vue'])
  assert.equal(asset.visualVerification.status, 'passed')
  assert.equal(asset.visualVerification.summary.averageScore, 99.2)
})

test('creates html-only restored page before optional vue conversion', () => {
  const captureResult = {
    title: 'HTML 优先还原页',
    url: 'https://example.com/html-first',
    pages: [{ title: 'HTML 优先还原页' }]
  }
  const asset = createRestoredPageAsset({
    projectId: 'project-flow',
    captureResult,
    html: '<!doctype html><html><body><main>HTML first</main></body></html>'
  })

  assert.equal(asset.codeFormat, 'html')
  assert.deepEqual(asset.files.map((file) => file.path), ['index.html'])
  assert.match(asset.files[0].content, /HTML first/)
  assert.equal(asset.html, '<!doctype html><html><body><main>HTML first</main></body></html>')
  assert.doesNotMatch(asset.html, /html-preview-frame|data-preview-mode|结构节点/)
  assert.ok(!asset.files.some((file) => file.path === 'src/App.vue'))
  assert.equal(asset.captureResult.url, captureResult.url)
})

test('normalizing restored pages preserves raw static html instead of wrapping preview shell', () => {
  const rawHtml = '<!doctype html><html><body><main><h1>Raw static result</h1></main></body></html>'
  const state = normalizeFactoryWorkspace({
    restoredPages: [{
      id: 'page-html',
      projectId: 'project-flow',
      title: 'Raw HTML',
      html: rawHtml,
      files: [{ path: 'index.html', content: rawHtml }]
    }]
  })

  assert.equal(state.restoredPages[0].html, rawHtml)
  assert.doesNotMatch(state.restoredPages[0].html, /html-preview-frame|data-preview-mode/)
})

test('normalizing restored pages repairs legacy image-to-code screenshot shells', () => {
  const screenshotShell = '<!doctype html><html><body><main><section><img src="data:image/png;base64,legacy" alt="wechat.png" /></section></main></body></html>'
  const state = normalizeFactoryWorkspace({
    restoredPages: [{
      id: 'legacy-image-page',
      projectId: 'project-flow',
      title: 'wechat.png',
      sourceUrl: 'image://wechat.png',
      html: screenshotShell,
      files: [{ path: 'index.html', content: screenshotShell }],
      captureResult: {
        raw: { captureKind: 'image-to-code' },
        textBlocks: [{ text: '生成后台管理页' }]
      }
    }]
  })

  const repaired = state.restoredPages[0]
  assert.match(repaired.html, /image-to-html-page/)
  assert.match(repaired.html, /旧图片转代码资产已迁移/)
  assert.doesNotMatch(repaired.html, /data:image\/png;base64,legacy/)
  assert.match(repaired.files.find((file) => file.path === 'index.html').content, /image-to-html-page/)
  assert.doesNotMatch(repaired.files.find((file) => file.path === 'index.html').content, /data:image\/png;base64,legacy/)
})

test('filters restored page cards by current project newest first', () => {
  const pages = [
    { id: 'old-current', projectId: 'project-a', createdAt: '2026-06-20T08:00:00.000Z', html: '<main>可展示旧页面</main>'.repeat(30) },
    { id: 'other-project', projectId: 'project-b', createdAt: '2026-06-20T09:00:00.000Z', html: '<main>其他项目</main>'.repeat(30) },
    { id: 'new-current', projectId: 'project-a', createdAt: '2026-06-20T10:00:00.000Z', html: '<main>可展示新页面</main>'.repeat(30) },
    { id: 'debug-current', projectId: 'project-a', createdAt: '2026-06-20T11:00:00.000Z', sourceUrl: 'https://example.com/debug', html: '<main>debug</main>' }
  ]

  assert.deepEqual(restoredPagesForProject(pages, 'project-a').map((page) => page.id), [
    'debug-current',
    'new-current',
    'old-current'
  ])
})

test('capture action state drives one primary button while loading', () => {
  assert.deepEqual(captureActionState('loading'), {
    loading: true,
    disabled: true,
    captureLabel: '快照生成中'
  })
  assert.deepEqual(captureActionState('idle'), {
    loading: false,
    disabled: false,
    captureLabel: '生成网页快照'
  })
})

test('capture loading experience exposes rotating copy steps and estimated time', () => {
  const early = captureLoadingExperience(12)
  assert.equal(early.estimatedLabel, '预计 45-90 秒')
  assert.equal(early.elapsedLabel, '已用 12 秒')
  assert.equal(early.currentStep.id, 'dom')
  assert.ok(early.steps.length >= 4)
  assert.match(early.typedCopy, /正在|先|把/)

  const later = captureLoadingExperience(96)
  assert.equal(later.currentStep.id, 'waiting')
  assert.match(later.estimatedLabel, /仍在等待返回/)
  assert.notEqual(later.typedCopy, early.typedCopy)
})

test('capture loading experience can use backend estimated seconds', () => {
  const view = captureLoadingExperience(8, { estimatedSeconds: 24 })
  assert.equal(view.estimatedLabel, '预计 24 秒')
})

testAsync('factory composer textarea cannot cover the capture button', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryTextareaRule = css.match(/\.capture-entry-panel\s+\.agent-composer\s+textarea\s*\{[\s\S]*?\}/)?.[0] || ''
  const globalAgentComposerOverrides = css.match(/(?:^|\n)\.agent-composer(?:\s|,|\{)[\s\S]*?(?=\n\.[\w-]|\n@|$)/g) || []

  assert.match(factoryTextareaRule, /resize:\s*none/)
  assert.match(factoryTextareaRule, /pointer-events:\s*auto/)
  assert.deepEqual(globalAgentComposerOverrides.map((rule) => rule.trim()), [])
})

testAsync('workflow canvas sidebar focuses nodes by centering the viewport', async () => {
  const source = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(source, /ref="viewportRef"/)
  assert.match(source, /data-node-id/)
  assert.match(source, /scrollTo\(\{[\s\S]*behavior:\s*'smooth'/)
  assert.match(source, /defineExpose\(\{[\s\S]*focusNode/)
  assert.match(source, /detailSections/)
  assert.match(source, /canvas-detail-section/)
  assert.match(source, /\$emit\('quick-action',\s*\{\s*nodeId:\s*node\.id,\s*action\s*\}\)/)
  assert.match(styles, /\.canvas-node-card\.spotlight/)
})

testAsync('workflow canvas renders curved active incoming edges without per-node resize controls', async () => {
  const source = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(source, /<path[\s\S]*v-for="edge in edges"/)
  assert.match(source, /:d="edgePath\(edge\)"/)
  assert.match(source, /['"]active-flow['"]:\s*isActiveIncomingEdge\(edge\)/)
  assert.doesNotMatch(source, /<line[\s\S]*v-for="edge in edges"/)
  assert.doesNotMatch(source, /resize-node/)
  assert.match(styles, /\.workflow-canvas-edges path/)
  assert.match(styles, /\.workflow-canvas-edges path\.active-flow/)
  assert.match(styles, /@keyframes canvas-edge-flow/)
  assert.doesNotMatch(styles, /\.canvas-node-resize/)
})

testAsync('workflow canvas detail supports progressive tree expansion while small cards stay static', async () => {
  const source = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const cardStart = source.indexOf('<article\n            v-for="node in nodes"')
  const cardEnd = source.indexOf('<div v-if="fullscreenNode"', cardStart)
  const cardSource = source.slice(cardStart, cardEnd)
  const fullscreenStart = source.indexOf('<div v-if="fullscreenNode"')
  const fullscreenEnd = source.indexOf('</template>', fullscreenStart)
  const fullscreenSource = source.slice(fullscreenStart, fullscreenEnd)

  assert.match(source, /const expandedTreeItems = ref\(new Set\(\)\)/)
  assert.match(source, /function normalizeTreeItems/)
  assert.match(source, /function visibleTreeItems/)
  assert.match(source, /function toggleTreeItem/)
  assert.doesNotMatch(cardSource, /class="canvas-tree-node"/)
  assert.doesNotMatch(cardSource, /toggleTreeItem/)
  assert.match(cardSource, /v-for="item in compactNodeContent\(node\)"/)
  assert.match(fullscreenSource, /class="canvas-tree-node"/)
  assert.match(fullscreenSource, /class="canvas-detail-tree"/)
  assert.match(fullscreenSource, /@click="toggleTreeItem\(fullscreenNode\.id,\s*treeItem\.key\)"/)
  assert.match(source, /treeItem\.hasChildren/)
  assert.match(source, /:style="\{\s*'--tree-depth': treeItem\.depth/)
  assert.match(source, /function compactNodeContent\(node = \{\}\)/)
  assert.match(styles, /\.canvas-tree-node/)
  assert.match(styles, /\.canvas-detail-tree/)
  assert.match(styles, /\.canvas-tree-node span/)
  assert.match(styles, /\.canvas-node-content span/)
  assert.match(styles, /box-sizing:\s*border-box/)
  assert.match(styles, /overflow-wrap:\s*anywhere/)
  assert.match(styles, /white-space:\s*normal/)
  assert.match(styles, /\.canvas-tree-node\.expanded/)
  assert.match(styles, /padding-left:\s*calc\(12px \+ var\(--tree-depth\) \* 22px\)/)
})

testAsync('workflow canvas fullscreen tree items keep long content visible within a limited height', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const treeRule = (styles.match(/\.canvas-tree-node\s*\{[\s\S]*?\}/g) || [])
    .find((rule) => /grid-template-columns/.test(rule)) || ''
  const spanRule = styles.match(/\.canvas-tree-node span\s*\{[\s\S]*?\}/)?.[0] || ''

  assert.match(treeRule, /max-height:\s*128px;/)
  assert.match(treeRule, /align-items:\s*start;/)
  assert.doesNotMatch(treeRule, /height:\s*auto;/)
  assert.match(spanRule, /max-height:\s*96px;/)
  assert.match(spanRule, /overflow-y:\s*auto;/)
  assert.match(spanRule, /display:\s*block;/)
  assert.match(spanRule, /padding-right:\s*6px;/)
})

testAsync('workflow canvas fullscreen renders Axure style path graph only for flow node details', async () => {
  const source = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const cardStart = source.indexOf('<article\n            v-for="node in nodes"')
  const cardEnd = source.indexOf('<div v-if="fullscreenNode"', cardStart)
  const cardSource = source.slice(cardStart, cardEnd)
  const fullscreenStart = source.indexOf('<div v-if="fullscreenNode"')
  const fullscreenEnd = source.indexOf('</template>', fullscreenStart)
  const fullscreenSource = source.slice(fullscreenStart, fullscreenEnd)

  assert.match(source, /function hasPathGraph\(node = \{\}\)/)
  assert.match(source, /function pathGraphNodes\(node = \{\}\)/)
  assert.match(source, /function pathGraphEdges\(node = \{\}\)/)
  assert.match(source, /function flowDetailMetrics\(node = \{\}\)/)
  assert.match(source, /function flowStepRows\(node = \{\}\)/)
  assert.match(source, /function flowBackendRows\(node = \{\}\)/)
  assert.match(source, /function flowExceptionRows\(node = \{\}\)/)
  assert.match(source, /function flowAcceptanceChecks\(node = \{\}\)/)
  assert.match(fullscreenSource, /v-if="hasPathGraph\(fullscreenNode\)"/)
  assert.match(fullscreenSource, /class="canvas-path-graph"/)
  assert.match(fullscreenSource, /class="canvas-flow-insights"/)
  assert.match(fullscreenSource, /flowDetailMetrics\(fullscreenNode\)/)
  assert.match(fullscreenSource, /flowStepRows\(fullscreenNode\)/)
  assert.match(fullscreenSource, /flowBackendRows\(fullscreenNode\)/)
  assert.match(fullscreenSource, /flowExceptionRows\(fullscreenNode\)/)
  assert.match(fullscreenSource, /flowAcceptanceChecks\(fullscreenNode\)/)
  assert.match(fullscreenSource, /pathGraphNodes\(fullscreenNode\)/)
  assert.match(fullscreenSource, /pathGraphEdges\(fullscreenNode\)/)
  assert.doesNotMatch(cardSource, /canvas-path-graph/)
  assert.match(styles, /\.canvas-path-graph/)
  assert.match(styles, /\.canvas-flow-insights/)
  assert.match(styles, /\.flow-metric-grid/)
  assert.match(styles, /\.flow-detail-panel/)
  assert.match(styles, /\.flow-step-row/)
  assert.match(styles, /\.flow-check-list/)
  assert.match(styles, /\.path-graph-node\.decision/)
  assert.match(styles, /\.path-graph-node\.error/)
  assert.match(styles, /\.path-graph-node\.start/)
  assert.match(styles, /\.path-graph-node\.end/)
})

testAsync('workflow canvas surfaces backend skill routing decision', async () => {
  const source = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const topbarSource = source.slice(
    source.indexOf('<header class="workflow-canvas-topbar">'),
    source.indexOf('<main class="workflow-canvas-shell">')
  )

  assert.match(source, /routing:\s*\{\s*type:\s*Object/)
  assert.match(source, /generation:\s*\{\s*type:\s*Object/)
  assert.doesNotMatch(topbarSource, /workflow-canvas-routing/)
  assert.doesNotMatch(topbarSource, /workflow-generation-meta/)
  assert.doesNotMatch(topbarSource, /已采用：/)
  assert.doesNotMatch(topbarSource, /模型：/)
  assert.match(appSource, /:routing="workflowSkillRouting"/)
  assert.match(appSource, /:generation="workflowGenerationMeta"/)
  assert.match(appSource, /const workflowSkillRouting = computed/)
  assert.match(appSource, /const workflowGenerationMeta = computed/)
})

testAsync('workflow agent drawer uses compact header upload toolbar and resizable launcher', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const workflowWorkbenchSource = await readFile(new URL('../src/services/workflowWorkbench.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(drawerSource, /class="agent-node-switcher"/)
  assert.match(drawerSource, /class="agent-node-trigger"/)
  assert.match(drawerSource, /function selectNode\(nodeId\)/)
  assert.match(drawerSource, /emit\('update-node',\s*nodeId\)/)
  assert.match(drawerSource, /agentInteraction/)
  assert.match(drawerSource, /class="agent-interaction-panel"/)
  assert.match(drawerSource, /visibleAgentInteraction/)
  assert.match(drawerSource, /agentInteractionGoal/)
  assert.match(drawerSource, /agentInteractionConfirmationRule/)
  assert.match(drawerSource, /class="agent-suggested-questions"/)
  assert.match(drawerSource, /composerPlaceholder/)
  assert.match(drawerSource, /class="agent-composer-tools"/)
  assert.match(drawerSource, /class="agent-collapse-icon"/)
  assert.match(drawerSource, /class="agent-history-entry"/)
  assert.match(drawerSource, /class="agent-history-popover"/)
  assert.match(drawerSource, /class="agent-scroll-bottom"/)
  assert.match(drawerSource, /handleChatScroll/)
  assert.match(drawerSource, /scrollAgentChatToBottom/)
  assert.match(drawerSource, /class="agent-resize-handle"/)
  assert.doesNotMatch(drawerSource, /class="agent-current-context"/)
  assert.doesNotMatch(drawerSource, /class="agent-history-panel"/)
  assert.doesNotMatch(drawerSource, /class="agent-logo"/)
  assert.doesNotMatch(drawerSource, /class="agent-title-copy"/)
  assert.doesNotMatch(drawerSource, /class="agent-plan-label"/)
  assert.match(appSource, /workflowAgentDrawerWidth/)
  assert.match(appSource, /workflowAgentSession\.value\?\.quickReplies/)
  assert.match(workflowWorkbenchSource, /agentInteraction\?\.quickReplies/)
  assert.match(workflowWorkbenchSource, /activeNode\?\.quickActions/)
  assert.match(appSource, /@update-node="selectWorkflowCanvasNode"/)
  assert.match(appSource, /:active-node="workflowAgentNode"/)
  assert.match(appSource, /const workflowAgentNode = computed/)
  assert.match(appSource, /return workflowAgentNodeId\.value \|\| workflowAgentNode\.value\?\.id/)
  assert.match(appSource, /function selectWorkflowCanvasNode\(nodeId\)/)
  assert.match(appSource, /workflowAgentInput\.value = ''/)
  assert.match(appSource, /function runWorkflowNodeQuickAction\(payload\)/)
  assert.match(appSource, /if \(nodeId\) selectWorkflowCanvasNode\(nodeId\)/)
  assert.doesNotMatch(appSource, /workflow-agent-launcher/)
  assert.match(appSource, /startWorkflowAgentResize/)
  assert.match(await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8'), /canvas-agent-launcher/)
  assert.match(styles, /\.agent-interaction-panel/)
  assert.match(styles, /\.agent-suggested-questions/)
  assert.match(styles, /\.agent-node-menu/)
  assert.match(styles, /\.agent-drawer\s*\{[\s\S]*width:\s*min\(var\(--agent-drawer-width/)
  assert.match(styles, /\.canvas-agent-launcher/)
  assert.doesNotMatch(styles, /\.workflow-agent-launcher\s*\{[\s\S]*position:\s*fixed/)
  assert.match(styles, /\.agent-history-popover/)
  assert.match(styles, /\.agent-scroll-bottom/)
  assert.match(styles, /opacity:\s*0/)
  assert.match(styles, /\.agent-scroll-bottom\.visible/)
  assert.match(styles, /animation:\s*agent-drawer-slide-in/)
  assert.match(styles, /\.agent-resize-handle/)
})

testAsync('workflow agent interaction panel tolerates missing backend copy', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const panelStart = drawerSource.indexOf('class="agent-interaction-panel"')
  const panelEnd = drawerSource.indexOf('</section>', panelStart)
  const panelSource = drawerSource.slice(drawerSource.lastIndexOf('<section', panelStart), panelEnd)
  const helperStart = drawerSource.indexOf('const agentInteraction')
  const helperEnd = drawerSource.indexOf('const composerPlaceholder', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(panelSource, /v-if="visibleAgentInteraction"/)
  assert.match(panelSource, /agentInteractionGoal/)
  assert.match(panelSource, /agentInteractionConfirmationRule/)
  assert.match(helperSource, /const visibleAgentInteraction = computed/)
  assert.match(helperSource, /function agentInteractionGoal\(\)/)
  assert.match(helperSource, /function agentInteractionConfirmationRule\(\)/)
  assert.match(helperSource, /String\(agentInteraction\.value\?\.goal \|\| ''\)\.trim\(\)/)
  assert.match(helperSource, /String\(agentInteraction\.value\?\.confirmationRule \|\| ''\)\.trim\(\)/)
  assert.doesNotMatch(panelSource, /agentInteraction\.goal/)
  assert.doesNotMatch(panelSource, /agentInteraction\.confirmationRule/)
})

testAsync('workflow agent drawer emit contract has no duplicate event names', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const emitsStart = drawerSource.indexOf('const emit = defineEmits([')
  const emitsEnd = drawerSource.indexOf('])', emitsStart)
  const emitsSource = drawerSource.slice(emitsStart, emitsEnd)
  const eventNames = Array.from(emitsSource.matchAll(/'([^']+)'/g), (match) => match[1])
  const duplicateEventNames = eventNames.filter((eventName, index) => eventNames.indexOf(eventName) !== index)

  assert.ok(eventNames.length > 0)
  assert.deepEqual(duplicateEventNames, [])
})

testAsync('workflow agent messages use workspace scoped API route', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const appendSource = apiSource.slice(
    apiSource.indexOf('appendMessage(config, runId, stepId, payload)'),
    apiSource.indexOf('completeRun(config, runId', apiSource.indexOf('appendMessage(config, runId, stepId, payload)'))
  )

  assert.match(appendSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/messages/)
  assert.match(appendSource, /JSON\.stringify\(\{\s*...payload,\s*stepId\s*\}\)/)
  assert.doesNotMatch(appendSource, /\/api\/workflows\/runs\/\$\{runId\}\/steps/)
  assert.match(appSource, /context:\s*workflowAgentRequestContext\(\{[\s\S]*knowledgeRetrievalError:\s*options\.knowledgeRetrievalError[\s\S]*\}\)/)
  assert.match(appSource, /async function persistWorkflowAgentMessageStream\(message,\s*options\s*=\s*\{\}\)/)
  assert.match(appSource, /api\.workflows\.appendMessageStream/)
  assert.match(appSource, /onEvent:\s*\(event\)\s*=>/)
  assert.match(appSource, /event\.type === 'status'/)
  assert.match(appSource, /event\.type === 'message'/)
  assert.match(appSource, /event\.type === 'done'/)
  assert.match(appSource, /mergeWorkflowAgentStreamedAssistantMessage\(event\.data\.assistantMessage,\s*streamedContent/)
  assert.match(appSource, /replaceWorkflowAgentMessage\(options\.pendingMessageId,\s*normalizeWorkflowAgentAssistantMessage\(assistantMessage/)
  assert.match(appSource, /applyWorkflowAgentPersistedResult\(result,\s*scopeId\)/)
  assert.match(appSource, /const backendHandled = Boolean\(persisted\?\.ok && persisted\.data\?\.assistantMessage\)/)
  assert.match(appSource, /result\.data\?\.quickReplies/)
  assert.match(appSource, /agentQuickReplies/)
  assert.doesNotMatch(appSource, /appendWorkflowAgentMessage\('user', content\)\s*\n\s*await persistWorkflowAgentMessage/)
  assert.match(appSource, /const workflowAgentSending = ref\(false\)/)
  assert.match(appSource, /if \(!content \|\| !state\.activeWorkflowRun \|\| workflowAgentSending\.value\) return/)
  assert.match(appSource, /workflowAgentSending\.value = true/)
  assert.match(appSource, /workflowAgentSending\.value = false/)
  assert.match(apiSource, /appendMessageStream\(config,\s*runId,\s*stepId,\s*payload/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/messages\/stream/)
  assert.match(apiSource, /Accept':\s*'text\/event-stream'/)
  assert.match(apiSource, /response\.body\?\.getReader\?\.\(\)/)
  assert.match(apiSource, /new TextDecoder\(\)/)
  assert.match(apiSource, /reader\.read\(\)/)
  assert.match(apiSource, /flushSseBuffer/)
  assert.match(apiSource, /onEvent\?\.\(event\)/)
  assert.match(apiSource, /return api\.workflows\.appendMessage\(config,\s*runId,\s*stepId,\s*payload\)/)
  assert.match(appSource, /const pendingStreamOptions = \{[\s\S]*retrievedKnowledge,[\s\S]*pendingMessageId,[\s\S]*requestToken,[\s\S]*signal:\s*workflowAgentStreamController\.value\.signal[\s\S]*\}/)
  assert.match(appSource, /persistWorkflowAgentMessageStream\(\{[\s\S]*\},\s*pendingStreamOptions\)/)
  assert.match(appSource, /function sendWorkflowAgentCanvasAction\(action,\s*nodeId = ''\)/)
  assert.match(appSource, /nodeId:\s*nodeId \|\| workflowAgentScopeId\(\)/)
  assert.match(appSource, /action:\s*'canvas-action-advice'/)
  assert.match(appSource, /function runWorkflowNodeQuickAction\(payload\)/)
  assert.match(appSource, /sendWorkflowAgentCanvasAction\(action,\s*nodeId\)/)
  assert.doesNotMatch(appSource, /openWorkflowAgent\(\)\s*\n\s*void sendWorkflowAgentMessage\(action\)/)
  assert.match(appSource, /if \(backendHandled\) \{[\s\S]*await typeWorkflowAgentAssistantMessage[\s\S]*clearWorkflowAgentActiveDraft\(\)[\s\S]*return[\s\S]*\} else \{/)
  assert.doesNotMatch(appSource, /\/生成\|草稿\/\.test\(content\)/)

  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  assert.match(canvasSource, /@click\.stop="\$emit\('quick-action', \{ nodeId: node\.id, action \}\)"/)

  assert.match(drawerSource, /message\.meta/)
  assert.match(drawerSource, /agent-message-meta/)
  assert.match(drawerSource, /Provider/)
  assert.match(drawerSource, /Tokens/)
  assert.match(drawerSource, /messageKnowledgeItems\(message\)/)
  assert.match(drawerSource, /agent-knowledge-evidence/)
  assert.match(drawerSource, /messageMeta\(message\)\.error/)
  assert.match(drawerSource, /sending:\s*\{\s*type:\s*Boolean/)
  assert.match(drawerSource, /:disabled="sending"/)
})

testAsync('backend workflow agent stream route emits sse events with non streaming fallback result', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } }
  })

  assert.match(streamed.contentType, /text\/event-stream/)
  assert.match(streamed.body, /event: status/)
  assert.match(streamed.body, /event: message/)
  assert.match(streamed.body, /event: done/)
  assert.match(streamed.body, /"assistantMessage"/)
  assert.match(streamed.body, /"quickReplies"/)
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.run.agentSessions.framework.length, 2)
  assert.equal(result.assistantMessage.role, 'assistant')
})

testAsync('backend workflow agent stream route emits error sse event when provider fails', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      generate: async () => {
        throw new Error('stream provider down')
      }
    },
    fallback: 'none'
  })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' }
  })

  assert.match(streamed.contentType, /text\/event-stream/)
  assert.match(streamed.body, /event: status/)
  assert.match(streamed.body, /event: error/)
  assert.match(streamed.body, /event: done/)
  assert.match(streamed.body, /stream provider down/)
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.error.message, 'stream provider down')
})

testAsync('backend workflow agent stream route returns structured model errors to frontend', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      generate: async () => {
        const error = new Error('The model `gpt-5.5` does not exist')
        error.code = 'LLM_MODEL_NOT_FOUND'
        error.recoveryActions = ['切换模型', '检查配置']
        error.model = 'gpt-5.5'
        error.apiSurface = 'responses'
        error.provider = 'openai-compatible'
        throw error
      }
    },
    fallback: 'none'
  })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' }
  })

  const errorMatch = streamed.body.match(/event: error\ndata: (.+)\n\n/)
  assert.ok(errorMatch)
  const error = JSON.parse(errorMatch[1])
  assert.equal(error.code, 'LLM_MODEL_NOT_FOUND')
  assert.equal(error.message, 'The model `gpt-5.5` does not exist')
  assert.deepEqual(error.recoveryActions, ['切换模型', '检查配置'])
  assert.equal(error.model, 'gpt-5.5')
  assert.equal(error.apiSurface, 'responses')
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.error.code, 'LLM_MODEL_NOT_FOUND')
  assert.deepEqual(result.error.recoveryActions, ['切换模型', '检查配置'])
})

testAsync('backend workflow agent stream route emits delta events when provider supports streaming', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'stream-provider',
      async *stream(context) {
        yield { type: 'delta', content: `stream ${context.actionType}` }
        yield { type: 'delta', content: ' done' }
        yield {
          type: 'final',
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
          provider: 'stream-provider',
          model: context.model
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' }
  })

  assert.match(streamed.body, /event: delta/)
  assert.match(streamed.body, /stream module-breakdown/)
  assert.match(streamed.body, /event: message/)
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.assistantMessage.content, 'stream module-breakdown done')
  assert.equal(result.assistantMessage.meta.provider, 'stream-provider')
  assert.equal(result.run.agentSessions.framework.length, 2)
})

testAsync('backend workflow agent stream route sanitizes structured json deltas and persists final content', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'structured-json-stream-provider',
      async *stream(context) {
        yield { type: 'delta', content: '{"content":"已整理目标用户、核心价值和成功标准。","proposal":' }
        yield { type: 'delta', content: '{"title":"目标用户补充","summary":"补齐用户分层。","writeableContent":{"summary":"补齐目标用户"},"downstreamImpact":[{"nodeId":"users-value","reason":"影响价值说明"}]}}' }
        yield {
          type: 'final',
          content: '已整理目标用户、核心价值和成功标准。',
          provider: 'structured-json-stream-provider',
          model: context.model,
          proposal: {
            title: '目标用户补充',
            summary: '补齐用户分层。',
            writeableContent: { summary: '补齐目标用户' },
            downstreamImpact: [{ nodeId: 'users-value', reason: '影响价值说明' }]
          }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补目标用户' }
  })

  assert.match(streamed.body, /event: delta/)
  assert.match(streamed.body, /正在整理结构化建议/)
  const deltaEvents = [...streamed.body.matchAll(/event: delta\ndata: (.+)\n\n/g)].map((match) => match[1]).join('\n')
  assert.doesNotMatch(deltaEvents, /"writeableContent"/)
  assert.doesNotMatch(deltaEvents, /"downstreamImpact"/)
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.assistantMessage.content, '已整理目标用户、核心价值和成功标准。')
  assert.equal(result.proposal.title, '目标用户补充')
})

testAsync('backend workflow agent stream route returns and persists proposal in final message', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'stream-proposal-provider',
      async *stream(context) {
        yield { type: 'delta', content: '流式生成登录注册弹窗提案' }
        yield {
          type: 'final',
          provider: 'stream-proposal-provider',
          model: context.model,
          proposal: {
            title: '流式结构化提案',
            summary: '流式模型建议补齐登录、注册、找回密码和异常态。',
            writeableContent: {
              summary: '流式 proposal 可直接写入页面结构节点。',
              items: ['登录入口', '注册入口', '找回密码入口'],
              acceptanceCriteria: ['确认后刷新表单校验节点']
            },
            downstreamImpact: [{ nodeId: 'form-validation', reason: '结构变化影响字段校验。' }]
          }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-stream-proposal',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })

  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '流式补充登录注册弹窗结构' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })

  const messageMatch = streamed.body.match(/event: message\ndata: (.+)\n\n/)
  const doneMatch = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(messageMatch)
  assert.ok(doneMatch)
  const messageEvent = JSON.parse(messageMatch[1])
  const doneEvent = JSON.parse(doneMatch[1])
  assert.equal(messageEvent.assistantMessage.meta.proposalId, doneEvent.proposal.id)
  assert.equal(doneEvent.proposal.title, '流式结构化提案')
  assert.equal(doneEvent.run.agentProposals['page-structure'][0].id, doneEvent.proposal.id)
  assert.equal(doneEvent.run.agentProposals['page-structure'][0].title, '流式结构化提案')
})

testAsync('backend workflow agent proposal explains rationale and context sources', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'proposal-explain-provider',
      async generate(context) {
        return {
          provider: 'proposal-explain-provider',
          model: context.model,
          content: '建议把登录注册弹窗补齐为账号登录、验证码登录、注册、找回密码和协议确认。',
          proposal: {
            title: '认证弹窗结构补齐',
            summary: '补齐登录注册弹窗的主路径、异常态和验收标准。',
            writeableContent: {
              summary: '登录注册弹窗需要覆盖登录、注册、找回密码、协议确认和错误态。',
              items: ['账号登录', '验证码登录', '注册入口', '找回密码', '协议勾选'],
              acceptanceCriteria: ['用户可以在弹窗内完成登录或注册闭环']
            },
            downstreamImpact: [{ nodeId: 'form-validation', reason: '字段和协议确认会影响表单校验。' }]
          }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-explain',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })

  const result = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '请给出更详细的登录注册弹窗建议' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] },
    retrievedKnowledge: [
      {
        title: '认证 UX 规范',
        snippet: '登录注册弹窗必须包含协议勾选、验证码错误态和找回密码入口。',
        sourceTitle: 'Auth UX Spec',
        projectName: '认证项目',
        sourceType: 'knowledge',
        matchReason: '命中登录注册弹窗关键词'
      }
    ]
  })

  assert.ok(result.proposal.rationale?.length)
  assert.ok(result.proposal.contextSources?.length)
  assert.equal(result.proposal.contextSources[0].title, '认证 UX 规范')
  assert.equal(result.proposal.contextSources[0].type, 'knowledge')
  assert.equal(result.proposal.downstreamImpact[0].nodeId, 'form-validation')
  assert.equal(result.assistantMessage.meta.proposalSummary.title, '认证弹窗结构补齐')
  assert.equal(result.assistantMessage.meta.proposalSummary.summary, '补齐登录注册弹窗的主路径、异常态和验收标准。')
  assert.ok(result.assistantMessage.meta.proposalSummary.rationale.length)
  assert.ok(result.assistantMessage.meta.proposalSummary.contextSources.length)
})

testAsync('backend workflow agent streaming preserves retrieved knowledge metadata', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'stream-provider',
      async *stream() {
        yield { type: 'delta', content: '结合资料补充认证弹窗方案' }
        yield { type: 'final', provider: 'stream-provider', model: 'gpt-5.5' }
      }
    }
  })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    retrievedKnowledge: [
      {
        title: '认证体验资料',
        snippet: '登录注册弹窗需要覆盖验证码、协议勾选和错误态。',
        projectId: 'project-auth',
        projectName: '认证项目',
        sourceTitle: 'Auth UX Spec',
        materialType: 'ux-spec',
        sourceType: 'knowledge',
        sourceUrl: 'https://example.com/auth',
        roleScopes: ['ux'],
        matchReason: '命中登录注册关键词'
      }
    ]
  })
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.assistantMessage.meta.retrievedKnowledge.length, 1)
  assert.equal(result.assistantMessage.meta.retrievedKnowledge[0].sourceTitle, 'Auth UX Spec')
  assert.equal(result.assistantMessage.meta.retrievedKnowledge[0].projectName, '认证项目')
  assert.equal(result.assistantMessage.meta.retrievedKnowledge[0].matchReason, '命中登录注册关键词')
})

testAsync('backend workflow agent streaming preserves knowledge retrieval errors in final metadata', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'stream-provider',
      async *stream() {
        yield { type: 'delta', content: '基于当前画布继续分析' }
        yield { type: 'final', provider: 'stream-provider', model: 'gpt-5.5' }
      }
    }
  })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗',
    model: 'gpt-5.5'
  })
  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '分析登录注册弹窗' },
    retrievedKnowledge: [],
    context: {
      knowledgeRetrievalError: '知识检索服务超时'
    }
  })
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])
  assert.equal(result.assistantMessage.meta.knowledgeRetrievalError, '知识检索服务超时')
  assert.equal(result.run.agentSessions.framework[1].meta.knowledgeRetrievalError, '知识检索服务超时')
})

testAsync('workflow agent send uses optimistic message and pending assistant feedback', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(appSource, /function appendWorkflowAgentMessage\(role,\s*content,\s*options\s*=\s*\{\}\)/)
  assert.match(appSource, /function replaceWorkflowAgentMessage\(messageId,\s*nextMessage/)
  assert.match(appSource, /function removeWorkflowAgentMessage\(messageId\)/)
  assert.match(sendSource, /const userMessageId = appendWorkflowAgentMessage\('user',\s*content/)
  assert.match(sendSource, /const pendingMessageId = appendWorkflowAgentMessage\('assistant',/)
  assert.match(sendSource, /status:\s*'pending'/)
  assert.match(sendSource, /const currentPendingMessage = workflowAgentMessageById\(pendingMessageId\)/)
  assert.match(sendSource, /const assistantMessage = normalizeWorkflowAgentAssistantMessage\(mergeWorkflowAgentStreamedAssistantMessage\(persisted\.data\.assistantMessage/)
  assert.match(sendSource, /await typeWorkflowAgentAssistantMessage\(pendingMessageId,\s*assistantMessage/)
  assert.match(sendSource, /后端没有返回 Agent 结果/)
  assert.match(sendSource, /后端响应缺少 assistantMessage/)
  assert.doesNotMatch(sendSource, /removeWorkflowAgentMessage\(pendingMessageId\)/)
  assert.match(sendSource, /catch \(error\)/)
  assert.match(sendSource, /status:\s*'failed'/)
  assert.match(sendSource, /发送失败/)
  assert.doesNotMatch(sendSource, /if \(!backendHandled\)\s*\{\s*appendWorkflowAgentMessage\('user',\s*content\)/)
  assert.match(drawerSource, /isMessageBusy\(message\)/)
  assert.match(drawerSource, /isMessageFailed\(message\)/)
  assert.match(drawerSource, /'agent-message-pending': isMessageBusy\(message\)/)
  assert.match(drawerSource, /agent-message-failed/)
  assert.match(drawerSource, /生成回复/)
  assert.match(styles, /\.agent-message-pending/)
  assert.match(styles, /\.agent-message-failed/)
  assert.match(styles, /@keyframes agent-pending-pulse/)
})

testAsync('workflow agent drawer supports mature chat controls', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(drawerSource, /@keydown="handleComposerKeydown"/)
  assert.match(drawerSource, /function handleComposerKeydown\(event\)/)
  assert.match(drawerSource, /event\.key === 'Enter' && !event\.shiftKey/)
  assert.match(drawerSource, /emit\('send'\)/)
  assert.match(drawerSource, /ref="composerRef"/)
  assert.match(drawerSource, /function focusComposer\(\)/)
  assert.match(drawerSource, /defineExpose\(\{\s*focusComposer,\s*scrollAgentChatToBottom\s*\}\)/)
  assert.match(drawerSource, /class="agent-message-actions"/)
  assert.match(drawerSource, /copy-message/)
  assert.match(drawerSource, /retry-message/)
  assert.match(drawerSource, /edit-message/)
  assert.match(drawerSource, /confirm-message/)
  assert.match(drawerSource, /stop-generating/)
  assert.match(drawerSource, /停止生成/)
  assert.match(drawerSource, /editingMessage/)
  assert.match(drawerSource, /retryMessage/)
  assert.match(drawerSource, /class="agent-editing-banner"/)
  assert.match(drawerSource, /class="agent-retry-banner"/)
  assert.match(drawerSource, /正在编辑/)
  assert.match(drawerSource, /正在重新生成/)
  assert.match(drawerSource, /cancel-edit/)
  assert.match(drawerSource, /cancel-retry/)
  assert.match(drawerSource, /agent-reference-status/)
  assert.match(drawerSource, /上传中/)
  assert.match(drawerSource, /读取失败/)
  assert.match(drawerSource, /待解析/)
  assert.match(drawerSource, /已读取/)

  assert.match(appSource, /ref="workflowAgentDrawerRef"/)
  assert.match(appSource, /@copy-message="copyWorkflowAgentMessage"/)
  assert.match(appSource, /@retry-message="retryWorkflowAgentMessage"/)
  assert.match(appSource, /@edit-message="editWorkflowAgentMessage"/)
  assert.match(appSource, /:editing-message="workflowAgentEditingMessage"/)
  assert.match(appSource, /:retry-message="workflowAgentRetryMessage"/)
  assert.match(appSource, /@cancel-edit="cancelWorkflowAgentEdit"/)
  assert.match(appSource, /@cancel-retry="cancelWorkflowAgentRetry"/)
  assert.match(appSource, /@confirm-message="openWorkflowAgentConfirmPreview"/)
  assert.match(appSource, /@stop-generating="stopWorkflowAgentGeneration"/)
  assert.match(appSource, /function copyWorkflowAgentMessage\(message\)/)
  assert.match(appSource, /function retryWorkflowAgentMessage\(message\)/)
  assert.match(appSource, /function editWorkflowAgentMessage\(message\)/)
  assert.match(appSource, /function cancelWorkflowAgentEdit\(\)/)
  assert.match(appSource, /function cancelWorkflowAgentRetry\(\)/)
  assert.match(appSource, /const workflowAgentEditingMessage = computed/)
  assert.match(appSource, /const workflowAgentRetryMessage = computed/)
  assert.match(appSource, /function openWorkflowAgentConfirmPreview\(message\)/)
  assert.match(appSource, /function confirmWorkflowAgentMessage\(message\)/)
  assert.match(appSource, /function stopWorkflowAgentGeneration\(\)/)
  assert.match(styles, /\.agent-message-actions/)
  assert.match(styles, /\.agent-stop-button/)
  assert.match(styles, /\.agent-editing-banner/)
  assert.match(styles, /\.agent-retry-banner/)
  assert.match(styles, /\.agent-reference-status/)
})

testAsync('workflow agent hides copy action for busy or empty placeholder messages', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const actionStart = drawerSource.indexOf('class="agent-message-actions"')
  const actionEnd = drawerSource.indexOf('</div>', actionStart)
  const actionSource = drawerSource.slice(actionStart, actionEnd)
  const canCopyStart = drawerSource.indexOf('function canCopyMessage')
  const canCopyEnd = drawerSource.indexOf('function canRetryMessage', canCopyStart)
  const canCopySource = drawerSource.slice(canCopyStart, canCopyEnd)

  assert.match(actionSource, /v-if="canCopyMessage\(message\)"/)
  assert.match(canCopySource, /function canCopyMessage\(message\)/)
  assert.match(canCopySource, /isMessageBusy\(message\)/)
  assert.match(canCopySource, /messageContent\(message\)\.trim\(\)/)
})

testAsync('workflow agent message list tolerates missing ids and non array history', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const listStart = drawerSource.indexOf('class="agent-chat-list"')
  const listEnd = drawerSource.indexOf('</section>', listStart)
  const listSource = drawerSource.slice(listStart, listEnd)
  const visibleStart = drawerSource.indexOf('const visibleMessages')
  const visibleEnd = drawerSource.indexOf('const visibleSuggestedQuestions', visibleStart)
  const visibleSource = drawerSource.slice(visibleStart, visibleEnd)

  assert.match(listSource, /v-for="\(\s*message,\s*index\s*\) in visibleMessages"/)
  assert.match(listSource, /:key="messageKey\(message,\s*index\)"/)
  assert.match(visibleSource, /const visibleMessages = computed/)
  assert.match(visibleSource, /Array\.isArray\(props\.session\?\.messages\)/)
  assert.match(drawerSource, /function messageKey\(message = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /message\.id \|\| message\.clientMessageId \|\| message\.meta\?\.clientMessageId/)
  assert.doesNotMatch(listSource, /:key="message\.id"/)
})

testAsync('workflow agent hides legacy placeholder advice messages from chat history', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const visibleStart = drawerSource.indexOf('const visibleMessages')
  const visibleEnd = drawerSource.indexOf('const visibleHistoryItems', visibleStart)
  const visibleSource = drawerSource.slice(visibleStart, visibleEnd)

  assert.match(drawerSource, /function isLegacyPlaceholderAgentMessage\(message = \{\}\)/)
  assert.match(visibleSource, /props\.session\.messages\.filter\(isPlainRecord\)\.filter\(\(message\) => !isLegacyPlaceholderAgentMessage\(message\)\)/)
  assert.match(drawerSource, /补充信息已接收/)
  assert.match(drawerSource, /已把[\s\S]*写入当前小画板上下文/)
  assert.match(drawerSource, /context-note/)
})

testAsync('workflow agent history popover tolerates malformed history data', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const historyStart = drawerSource.indexOf('class="agent-history-entry"')
  const historyEnd = drawerSource.indexOf('class="agent-collapse-icon"', historyStart)
  const historySource = drawerSource.slice(drawerSource.lastIndexOf('<div', historyStart), historyEnd)
  const helperStart = drawerSource.indexOf('const visibleHistoryItems')
  const helperEnd = drawerSource.indexOf('const visibleSuggestedQuestions', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(historySource, /v-if="visibleHistoryItems\.length"/)
  assert.match(historySource, /近 \{\{ visibleHistoryItems\.length \}\} 个版本/)
  assert.match(historySource, /v-for="\(\s*item,\s*index\s*\) in visibleHistoryItems"/)
  assert.match(historySource, /:key="historyItemKey\(item,\s*index\)"/)
  assert.match(historySource, /selectHistoryItem\(historyItemContent\(item\)\)/)
  assert.match(historySource, /historyItemLabel\(item,\s*index\)/)
  assert.match(drawerSource, /const visibleHistoryItems = computed/)
  assert.match(helperSource, /Array\.isArray\(props\.session\?\.history\)/)
  assert.match(drawerSource, /function historyItemKey\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function historyItemLabel\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function historyItemContent\(item = \{\}\)/)
  assert.match(drawerSource, /item\.id \|\| item\.createdAt \|\| item\.label/)
  assert.doesNotMatch(historySource, /session\.history/)
  assert.doesNotMatch(historySource, /selectHistoryItem\(item\.content\)/)
  assert.doesNotMatch(historySource, /\{\{ item\.label \}\}/)
})

testAsync('workflow agent model selector tolerates malformed model option data', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const selectStart = drawerSource.indexOf('class="agent-model-select"')
  const selectEnd = drawerSource.indexOf('</select>', selectStart)
  const selectSource = drawerSource.slice(drawerSource.lastIndexOf('<select', selectStart), selectEnd)
  const helperStart = drawerSource.indexOf('const visibleModelOptions')
  const helperEnd = drawerSource.indexOf('const visibleSuggestedQuestions', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(selectSource, /v-for="\(\s*item,\s*index\s*\) in visibleModelOptions"/)
  assert.match(selectSource, /:key="modelOptionKey\(item,\s*index\)"/)
  assert.match(selectSource, /:value="modelOptionValue\(item,\s*index\)"/)
  assert.match(selectSource, /modelOptionLabel\(item,\s*index\)/)
  assert.match(drawerSource, /const visibleModelOptions = computed/)
  assert.match(helperSource, /Array\.isArray\(props\.session\?\.model\?\.options\)/)
  assert.match(helperSource, /props\.session\.model\.options/)
  assert.match(helperSource, /return \[\{ value: props\.model, label: props\.model \}\]/)
  assert.match(drawerSource, /function modelOptionKey\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function modelOptionValue\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function modelOptionLabel\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /item\.value \|\| item\.label/)
  assert.doesNotMatch(selectSource, /session\.model\.options/)
  assert.doesNotMatch(selectSource, /:value="item\.value"/)
  assert.doesNotMatch(selectSource, /\{\{ item\.label \}\}/)
})

testAsync('workflow agent model selector falls back when filtered model options are empty', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const helperStart = drawerSource.indexOf('const visibleModelOptions')
  const helperEnd = drawerSource.indexOf('const composerPlaceholder', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(helperSource, /const modelOptions = props\.session\.model\.options\.filter\(isPlainRecord\)/)
  assert.match(helperSource, /return modelOptions\.length \? modelOptions : \[\{ value: props\.model, label: props\.model \}\]/)
  assert.doesNotMatch(helperSource, /props\.session\.model\.options\.length\) return props\.session\.model\.options\.filter\(isPlainRecord\)/)
})

testAsync('workflow agent node switcher tolerates malformed canvas tabs', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const switcherStart = drawerSource.indexOf('class="agent-node-switcher"')
  const switcherEnd = drawerSource.indexOf('</div>', drawerSource.indexOf('class="agent-node-menu"', switcherStart))
  const switcherSource = drawerSource.slice(drawerSource.lastIndexOf('<div', switcherStart), switcherEnd)
  const helperStart = drawerSource.indexOf('const visibleCanvasTabs')
  const helperEnd = drawerSource.indexOf('const activeNodeLabel', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)
  const labelStart = drawerSource.indexOf('const activeNodeLabel')
  const labelEnd = drawerSource.indexOf('const visibleModelOptions', labelStart)
  const labelSource = drawerSource.slice(labelStart, labelEnd)

  assert.match(switcherSource, /v-if="visibleCanvasTabs\.length"/)
  assert.match(switcherSource, /v-for="\(\s*tab,\s*index\s*\) in visibleCanvasTabs"/)
  assert.match(switcherSource, /:key="canvasTabKey\(tab,\s*index\)"/)
  assert.match(switcherSource, /canvasTabId\(tab,\s*index\) === activeNodeId/)
  assert.match(switcherSource, /selectNode\(canvasTabId\(tab,\s*index\)\)/)
  assert.match(switcherSource, /canvasTabLabel\(tab,\s*index\)/)
  assert.match(drawerSource, /const visibleCanvasTabs = computed/)
  assert.match(helperSource, /Array\.isArray\(props\.canvasTabs\)/)
  assert.match(labelSource, /const activeTabIndex = visibleCanvasTabs\.value\.findIndex\(\(tab,\s*index\) => canvasTabId\(tab,\s*index\) === props\.activeNodeId\)/)
  assert.match(labelSource, /activeTabIndex >= 0/)
  assert.match(labelSource, /visibleCanvasTabs\.value\[activeTabIndex\]/)
  assert.match(labelSource, /canvasTabLabel\(/)
  assert.match(drawerSource, /function canvasTabKey\(tab = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function canvasTabId\(tab = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function canvasTabLabel\(tab = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /tab\.key \|\| tab\.id \|\| tab\.label/)
  assert.doesNotMatch(switcherSource, /v-for="tab in canvasTabs"/)
  assert.doesNotMatch(switcherSource, /tab\.key/)
  assert.doesNotMatch(switcherSource, /tab\.label/)
})

testAsync('workflow agent reference list tolerates malformed reference data', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const referenceStart = drawerSource.indexOf('class="agent-reference-list"')
  const referenceEnd = drawerSource.indexOf('</article>', referenceStart)
  const referenceSource = drawerSource.slice(drawerSource.lastIndexOf('<div', referenceStart), referenceEnd)
  const helperStart = drawerSource.indexOf('const visibleReferences')
  const helperEnd = drawerSource.indexOf('const visibleMessages', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(referenceSource, /v-if="visibleReferences\.length"/)
  assert.match(referenceSource, /v-for="\(\s*file,\s*index\s*\) in visibleReferences"/)
  assert.match(referenceSource, /:key="referenceKey\(file,\s*index\)"/)
  assert.match(referenceSource, /referenceStatusClass\(file\)/)
  assert.match(referenceSource, /referencePreview\(file\)/)
  assert.match(referenceSource, /referenceName\(file,\s*index\)/)
  assert.match(referenceSource, /referenceKindLabel\(file\)/)
  assert.match(referenceSource, /referenceStatus\(file\) === 'failed'/)
  assert.match(referenceSource, /referenceErrorMessage\(file\)/)
  assert.match(referenceSource, /remove-reference', referenceId\(file,\s*index\)/)
  assert.match(drawerSource, /const visibleReferences = computed/)
  assert.match(helperSource, /Array\.isArray\(props\.references\)/)
  assert.match(drawerSource, /function referenceKey\(file = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function referenceId\(file = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function referenceName\(file = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function referenceStatus\(file = \{\}\)/)
  assert.match(drawerSource, /function referenceStatusClass\(file = \{\}\)/)
  assert.match(drawerSource, /function referencePreview\(file = \{\}\)/)
  assert.match(drawerSource, /function referenceKindLabel\(file = \{\}\)/)
  assert.match(drawerSource, /function referenceErrorMessage\(file = \{\}\)/)
  assert.match(drawerSource, /file\.id \|\| file\.name/)
  assert.doesNotMatch(referenceSource, /v-if="references\.length"/)
  assert.doesNotMatch(referenceSource, /v-for="file in references"/)
  assert.doesNotMatch(referenceSource, /file\.status/)
  assert.doesNotMatch(referenceSource, /file\.preview/)
  assert.doesNotMatch(referenceSource, /file\.name/)
  assert.doesNotMatch(referenceSource, /file\.kind/)
  assert.doesNotMatch(referenceSource, /file\.errorMessage/)
  assert.doesNotMatch(referenceSource, /file\.id/)
})

testAsync('workflow agent app filters malformed references before drawer and backend payloads', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const referencesStart = appSource.indexOf('const workflowAgentReferences')
  const referencesEnd = appSource.indexOf('function workflowAgentSessionMessages', referencesStart)
  const referencesSource = appSource.slice(referencesStart, referencesEnd)
  const persistStart = appSource.indexOf('async function persistWorkflowAgentMessage')
  const persistEnd = appSource.indexOf('function applyWorkflowAgentPersistedResult', persistStart)
  const persistSource = appSource.slice(persistStart, persistEnd)
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function applyWorkflowAgentStreamResult', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)

  assert.match(appSource, /function isWorkflowAgentReferenceFile\(file\)/)
  assert.match(referencesSource, /Array\.isArray\(workflowAgentSession\.value\?\.references\)/)
  assert.match(referencesSource, /\.filter\(isWorkflowAgentReferenceFile\)/)
  assert.match(persistSource, /references: workflowAgentReferencePayload\(\)/)
  assert.match(streamSource, /references: workflowAgentReferencePayload\(\)/)
  assert.match(appSource, /function workflowAgentReferencePayload\(\)/)
  assert.match(appSource, /return ensureWorkflowReferenceFiles\(\)\.filter\(isWorkflowAgentReferenceFile\)/)
  assert.doesNotMatch(persistSource, /references: ensureWorkflowReferenceFiles\(\)/)
  assert.doesNotMatch(streamSource, /references: ensureWorkflowReferenceFiles\(\)/)
})

testAsync('workflow agent visible collections filter non object items before template access', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const helpersStart = drawerSource.indexOf('function isPlainRecord')
  const helpersEnd = drawerSource.indexOf('const composerPlaceholder', helpersStart)
  const helpersSource = drawerSource.slice(helpersStart, helpersEnd)

  assert.match(drawerSource, /function isPlainRecord\(value\)/)
  assert.match(helpersSource, /return Boolean\(value && typeof value === 'object' && !Array\.isArray\(value\)\)/)
  assert.match(helpersSource, /props\.canvasTabs\.filter\(isPlainRecord\)/)
  assert.match(helpersSource, /props\.references\.filter\(isPlainRecord\)/)
  assert.match(helpersSource, /props\.session\.messages\.filter\(isPlainRecord\)/)
  assert.match(helpersSource, /props\.session\.history\.filter\(isPlainRecord\)/)
  assert.match(helpersSource, /props\.session\.model\.options\.filter\(isPlainRecord\)/)
  assert.match(drawerSource, /messageKnowledgeItemsRaw\(message\)\.filter\(isPlainRecord\)/)
})

testAsync('workflow agent hides the whole action row when no message actions are available', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const classStart = drawerSource.indexOf('class="agent-message-actions"')
  const actionStart = drawerSource.lastIndexOf('<div', classStart)
  const actionEnd = drawerSource.indexOf('</div>', actionStart)
  const actionSource = drawerSource.slice(actionStart, actionEnd)
  const helperStart = drawerSource.indexOf('function hasMessageActions')
  const helperEnd = drawerSource.indexOf('function canCopyMessage', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(actionSource, /v-if="hasMessageActions\(message\)"/)
  assert.match(helperSource, /function hasMessageActions\(message\)/)
  assert.match(helperSource, /canCopyMessage\(message\)/)
  assert.match(helperSource, /canRetryMessage\(message\)/)
  assert.match(helperSource, /canEditMessage\(message\)/)
  assert.match(helperSource, /canConfirmMessage\(message\)/)
})

testAsync('workflow agent hides confirm canvas action for empty assistant messages', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const confirmStart = drawerSource.indexOf('function canConfirmMessage')
  const confirmEnd = drawerSource.indexOf('function retryActionLabel', confirmStart)
  const confirmSource = drawerSource.slice(confirmStart, confirmEnd)

  assert.match(confirmSource, /function canConfirmMessage\(message\)/)
  assert.match(confirmSource, /messageContent\(message\)\.trim\(\)/)
})

testAsync('workflow agent hides edit resend action for empty user messages', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const editStart = drawerSource.indexOf('function canEditMessage')
  const editEnd = drawerSource.indexOf('function canConfirmMessage', editStart)
  const editSource = drawerSource.slice(editStart, editEnd)

  assert.match(editSource, /function canEditMessage\(message\)/)
  assert.match(editSource, /messageContent\(message\)\.trim\(\)/)
  assert.match(editSource, /return isUser && !isMessageBusy\(message\) && Boolean\(messageContent\(message\)\.trim\(\)\)/)
})

testAsync('workflow agent treats legacy assistant messages without status as successful for retry actions', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const statusStart = drawerSource.indexOf('function messageActionStatus')
  const statusEnd = drawerSource.indexOf('function canRetryMessage', statusStart)
  const statusSource = drawerSource.slice(statusStart, statusEnd)
  const retryStart = drawerSource.indexOf('function canRetryMessage')
  const retryEnd = drawerSource.indexOf('function canEditMessage', retryStart)
  const retrySource = drawerSource.slice(retryStart, retryEnd)

  assert.match(statusSource, /function messageActionStatus\(message\)/)
  assert.match(statusSource, /messageRole\(message\) === 'assistant'/)
  assert.match(statusSource, /messageContent\(message\)\.trim\(\)/)
  assert.match(statusSource, /return 'success'/)
  assert.match(retrySource, /const status = messageActionStatus\(message\)/)
  assert.match(retrySource, /status === 'success'/)
})

testAsync('workflow agent filters empty quick replies and hides the empty quick row', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const quickRowStart = drawerSource.indexOf('class="agent-quick-row"')
  const quickRowEnd = drawerSource.indexOf('</section>', quickRowStart)
  const quickRowSource = drawerSource.slice(drawerSource.lastIndexOf('<section', quickRowStart), quickRowEnd)
  const quickRepliesStart = drawerSource.indexOf('const visibleQuickReplies')
  const quickRepliesEnd = drawerSource.indexOf('const composerPlaceholder', quickRepliesStart)
  const quickRepliesSource = drawerSource.slice(quickRepliesStart, quickRepliesEnd)

  assert.match(quickRowSource, /v-if="visibleQuickReplies\.length"/)
  assert.match(quickRowSource, /v-for="reply in visibleQuickReplies"/)
  assert.match(quickRepliesSource, /const visibleQuickReplies = computed/)
  assert.match(quickRepliesSource, /props\.quickReplies/)
  assert.match(quickRepliesSource, /\.map\(/)
  assert.match(quickRepliesSource, /\.filter\(Boolean\)/)
})

testAsync('workflow agent normalizes suggested question chips before rendering', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const suggestedStart = drawerSource.indexOf('class="agent-suggested-questions"')
  const suggestedEnd = drawerSource.indexOf('</div>', suggestedStart)
  const suggestedSource = drawerSource.slice(drawerSource.lastIndexOf('<div', suggestedStart), suggestedEnd)
  const helperStart = drawerSource.indexOf('const visibleSuggestedQuestions')
  const helperEnd = drawerSource.indexOf('const visibleQuickReplies', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(suggestedSource, /v-if="visibleSuggestedQuestions\.length"/)
  assert.match(suggestedSource, /v-for="question in visibleSuggestedQuestions"/)
  assert.match(helperSource, /const visibleSuggestedQuestions = computed/)
  assert.match(helperSource, /agentInteraction\.value\?\.suggestedQuestions/)
  assert.match(helperSource, /Array\.isArray\(agentInteraction\.value\?\.suggestedQuestions\)/)
  assert.match(helperSource, /\.map\(/)
  assert.match(helperSource, /\.filter\(Boolean\)/)
  assert.match(helperSource, /Array\.from\(new Set/)
  assert.doesNotMatch(suggestedSource, /agentInteraction\.suggestedQuestions/)
})

testAsync('workflow agent quick suggestions tolerate non array backend data', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const suggestedStart = drawerSource.indexOf('const visibleSuggestedQuestions')
  const suggestedEnd = drawerSource.indexOf('const visibleQuickReplies', suggestedStart)
  const suggestedSource = drawerSource.slice(suggestedStart, suggestedEnd)
  const quickStart = drawerSource.indexOf('const visibleQuickReplies')
  const quickEnd = drawerSource.indexOf('const composerPlaceholder', quickStart)
  const quickSource = drawerSource.slice(quickStart, quickEnd)

  assert.match(suggestedSource, /const suggestedQuestions = Array\.isArray\(agentInteraction\.value\?\.suggestedQuestions\)\s*\? agentInteraction\.value\.suggestedQuestions\s*:\s*\[\]/)
  assert.match(suggestedSource, /suggestedQuestions\s*\n\s*\.map\(/)
  assert.match(quickSource, /const quickReplies = Array\.isArray\(props\.quickReplies\)\s*\? props\.quickReplies\s*:\s*\[\]/)
  assert.match(quickSource, /quickReplies\s*\n\s*\.map\(/)
})

testAsync('workflow agent quick reply blocks empty content before sending', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const quickStart = appSource.indexOf('function useWorkflowAgentQuickReply')
  const quickEnd = appSource.indexOf('async function copyWorkflowAgentMessage', quickStart)
  const quickSource = appSource.slice(quickStart, quickEnd)

  assert.match(quickSource, /const content = String\(reply \|\| ''\)\.trim\(\)/)
  assert.match(quickSource, /if \(!content\) \{[\s\S]*setStatus\(skillWorkbenchStatus,\s*'failed',\s*'没有可发送的快捷回复'\)[\s\S]*return[\s\S]*\}/)
  assert.match(quickSource, /if \(workflowAgentSending\.value\) \{[\s\S]*Agent 正在生成回复[\s\S]*return[\s\S]*\}/)
  assert.match(quickSource, /if \(isWorkflowAgentCanvasAdviceQuickReply\(content\)\) \{[\s\S]*sendWorkflowAgentCanvasAction\(content,\s*workflowAgentScopeId\(\)\)[\s\S]*return[\s\S]*\}/)
  assert.match(quickSource, /void sendWorkflowAgentMessage\(content,\s*\{\s*ignoreDraftState:\s*true\s*\}\)/)
  assert.doesNotMatch(quickSource, /sendWorkflowAgentMessage\(reply,\s*\{\s*ignoreDraftState:\s*true\s*\}\)/)
})

testAsync('workflow agent quick replies route canvas advice actions through backend action context', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const classifierStart = appSource.indexOf('function isWorkflowAgentCanvasAdviceQuickReply')
  const classifierEnd = appSource.indexOf('function runWorkflowNodeQuickAction', classifierStart)
  const classifierSource = appSource.slice(classifierStart, classifierEnd)
  const quickStart = appSource.indexOf('function useWorkflowAgentQuickReply')
  const quickEnd = appSource.indexOf('async function copyWorkflowAgentMessage', quickStart)
  const quickSource = appSource.slice(quickStart, quickEnd)

  assert.match(classifierSource, /activeNode\.quickActions/)
  assert.match(classifierSource, /activeNode\.agentInteraction\?\.quickReplies/)
  assert.match(classifierSource, /activeNode\.agentInteraction\?\.suggestedQuestions/)
  assert.match(classifierSource, /nodeActions\.includes\(normalized\)/)
  assert.match(classifierSource, /补\|检查\|调整\|拆\|生成/)
  assert.match(quickSource, /sendWorkflowAgentCanvasAction\(content,\s*workflowAgentScopeId\(\)\)/)
  assert.doesNotMatch(quickSource, /isWorkflowAgentCanvasAdviceQuickReply\(content\)[\s\S]*sendWorkflowAgentMessage\(content,\s*\{\s*ignoreDraftState:\s*true\s*\}\)[\s\S]*return/)
})

testAsync('workflow agent deduplicates visible quick replies after trimming', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const quickRepliesStart = drawerSource.indexOf('const visibleQuickReplies')
  const quickRepliesEnd = drawerSource.indexOf('const composerPlaceholder', quickRepliesStart)
  const quickRepliesSource = drawerSource.slice(quickRepliesStart, quickRepliesEnd)

  assert.match(quickRepliesSource, /new Set\(/)
  assert.match(quickRepliesSource, /Array\.from\(/)
})

testAsync('workflow agent edit and retry banners normalize message content', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const editingStart = drawerSource.indexOf('class="agent-editing-banner"')
  const editingEnd = drawerSource.indexOf('class="agent-retry-banner"', editingStart)
  const editingSource = drawerSource.slice(editingStart, editingEnd)
  const retryStart = drawerSource.indexOf('class="agent-retry-banner"')
  const retryEnd = drawerSource.indexOf('ref="fileInput"', retryStart)
  const retrySource = drawerSource.slice(retryStart, retryEnd)

  assert.match(editingSource, /messageContent\(editingMessage\)/)
  assert.match(retrySource, /messageContent\(retryMessage\)/)
  assert.doesNotMatch(editingSource, /editingMessage\.content/)
  assert.doesNotMatch(retrySource, /retryMessage\.content/)
})

testAsync('workflow agent normalizes quick replies before limiting to six', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function normalizeWorkflowAgentQuickReplies')
  const helperEnd = appSource.indexOf('const workflowAgentQuickReplies', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const quickStart = appSource.indexOf('const workflowAgentQuickReplies')
  const quickEnd = appSource.indexOf('const interactionSkillInputEntries', quickStart)
  const quickSource = appSource.slice(quickStart, quickEnd)

  assert.match(helperSource, /function normalizeWorkflowAgentQuickReplies\(replies/)
  assert.match(helperSource, /\.map\(/)
  assert.match(helperSource, /\.filter\(Boolean\)/)
  assert.match(helperSource, /!isWorkflowAgentConfirmationAction\(reply\)/)
  assert.match(helperSource, /Array\.from\(new Set/)
  assert.match(helperSource, /\.slice\(0,\s*6\)/)
  assert.match(quickSource, /normalizeWorkflowAgentQuickReplies\(workflowAgentSession\.value\?\.quickReplies/)
  assert.doesNotMatch(quickSource, /workflowAgentSession\.value\?\.quickReplies\?\.slice\(0,\s*6\)/)
})

testAsync('workflow canvas hides confirmation quick actions while agent keeps confirm handoff', async () => {
  const canvasSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const canvasActionsStart = canvasSource.indexOf('v-for="action in visibleNodeQuickActions(node)"')
  const confirmHelperStart = canvasSource.indexOf('function isCanvasConfirmAction')
  const confirmHelperEnd = canvasSource.indexOf('function visibleNodeQuickActions', confirmHelperStart)
  const confirmHelperSource = canvasSource.slice(confirmHelperStart, confirmHelperEnd)
  const helperStart = canvasSource.indexOf('function visibleNodeQuickActions')
  const helperEnd = canvasSource.indexOf('function isTreeItemExpanded', helperStart)
  const helperSource = canvasSource.slice(helperStart, helperEnd)

  assert.ok(canvasActionsStart > -1)
  assert.match(confirmHelperSource, /function isCanvasConfirmAction\(action = ''\)/)
  assert.match(confirmHelperSource, /\/确认\//)
  assert.match(helperSource, /function visibleNodeQuickActions\(node = \{\}\)/)
  assert.match(helperSource, /!isCanvasConfirmAction\(action\)/)
  assert.match(drawerSource, /确认入画布/)
  assert.match(drawerSource, /@click="\$emit\('confirm-message', message\)"/)
})

testAsync('workflow agent retry uses an explicit draft before resending', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)

  assert.match(appSource, /const workflowAgentRetryMessageId = ref\(''\)/)
  assert.match(appSource, /const workflowAgentRetryTargetMessageId = ref\(''\)/)
  assert.match(appSource, /const workflowAgentRetryMessage = computed/)
  assert.match(drawerSource, /retryMessage: \{ type: Object, default: null \}/)
  assert.match(drawerSource, /class="agent-retry-banner"/)
  assert.match(drawerSource, /正在重新生成/)
  assert.match(drawerSource, /messageContent\(retryMessage\)/)
  assert.match(drawerSource, /cancel-retry/)
  assert.match(retrySource, /workflowAgentRetryMessageId\.value = message\?\.id \|\| ''/)
  assert.match(retrySource, /workflowAgentRetryTargetMessageId\.value = previousUser\?\.id \|\| ''/)
  assert.match(retrySource, /workflowAgentInput\.value = content/)
  assert.match(retrySource, /setStatus\(skillWorkbenchStatus,\s*'success',\s*'已放回输入框，确认后重新生成'\)/)
  const normalRetrySource = retrySource.slice(retrySource.indexOf('const session = ensureWorkflowAgentSession()'))
  assert.doesNotMatch(normalRetrySource, /void sendWorkflowAgentMessage/)
  assert.match(sendSource, /const retryOfMessageId = options\.retryOfMessageId \|\| \(options\.ignoreDraftState \? '' : workflowAgentRetryMessageId\.value\) \|\| ''/)
  assert.match(sendSource, /const messageAction = options\.action \|\| \(editOfMessageId \? 'edit-resend' : retryOfMessageId \? 'retry' : 'send'\)/)
  assert.match(sendSource, /retryOfMessageId/)
  assert.match(sendSource, /clearWorkflowAgentDraftState\(\)/)
  assert.match(appSource, /function cancelWorkflowAgentRetry\(\)/)
})

testAsync('workflow agent edit retry computed state tolerates malformed session messages', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function workflowAgentSessionMessages')
  const helperEnd = appSource.indexOf('const workflowAgentEditingMessage', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const editStart = appSource.indexOf('const workflowAgentEditingMessage = computed')
  const editEnd = appSource.indexOf('const workflowAgentRetryMessage', editStart)
  const editSource = appSource.slice(editStart, editEnd)
  const retryStart = appSource.indexOf('const workflowAgentRetryMessage = computed')
  const retryEnd = appSource.indexOf('const workflowAgentModel', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)

  assert.match(appSource, /function workflowAgentSessionMessages\(\)/)
  assert.match(helperSource, /Array\.isArray\(workflowAgentSession\.value\?\.messages\)/)
  assert.match(helperSource, /workflowAgentSession\.value\.messages\.filter\(\(message\) => message && typeof message === 'object' && !Array\.isArray\(message\)\)/)
  assert.match(editSource, /workflowAgentSessionMessages\(\)\.find/)
  assert.match(retrySource, /const messages = workflowAgentSessionMessages\(\)/)
  assert.doesNotMatch(editSource, /workflowAgentSession\.value\?\.messages\?\.find/)
  assert.doesNotMatch(retrySource, /workflowAgentSession\.value\?\.messages \|\| \[\]/)
})

testAsync('workflow agent retry and edit close stale confirmation preview before drafting', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)
  const editStart = appSource.indexOf('function editWorkflowAgentMessage')
  const editEnd = appSource.indexOf('function cancelWorkflowAgentEdit', editStart)
  const editSource = appSource.slice(editStart, editEnd)

  assert.match(retrySource, /closeWorkflowAgentConfirmPreview\(\)/)
  assert.match(editSource, /closeWorkflowAgentConfirmPreview\(\)/)
  assert.ok(retrySource.indexOf('closeWorkflowAgentConfirmPreview()') < retrySource.indexOf('workflowAgentInput.value = content'))
  assert.ok(editSource.indexOf('closeWorkflowAgentConfirmPreview()') < editSource.indexOf('workflowAgentInput.value = content'))
})

testAsync('workflow agent retry and edit block empty draft content before composer handoff', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)
  const copyStart = appSource.indexOf('async function copyWorkflowAgentMessage')
  const copyEnd = appSource.indexOf('async function copyTextToClipboard', copyStart)
  const copySource = appSource.slice(copyStart, copyEnd)
  const editStart = appSource.indexOf('function editWorkflowAgentMessage')
  const editEnd = appSource.indexOf('function cancelWorkflowAgentEdit', editStart)
  const editSource = appSource.slice(editStart, editEnd)

  assert.match(retrySource, /const content = \(workflowAgentMessageText\(previousUser\) \|\| workflowAgentMessageText\(message\)\)\.trim\(\)/)
  assert.match(retrySource, /if \(!content\) \{[\s\S]*setStatus\(skillWorkbenchStatus,\s*'failed',\s*'没有可重新生成的消息内容'\)[\s\S]*return[\s\S]*\}/)
  assert.match(editSource, /const content = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(editSource, /if \(!content\) \{[\s\S]*setStatus\(skillWorkbenchStatus,\s*'failed',\s*'没有可编辑重发的消息内容'\)[\s\S]*return[\s\S]*\}/)
  assert.match(editSource, /workflowAgentInput\.value = content/)
})

testAsync('workflow agent confirmation preview clears stale retry edit draft state', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const previewStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const previewEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(previewSource, /clearWorkflowAgentDraftState\(\)/)
  assert.match(previewSource, /workflowAgentInput\.value = ''/)
  assert.ok(previewSource.indexOf('clearWorkflowAgentDraftState()') < previewSource.indexOf('workflowAgentConfirmPreview.open = true'))
  assert.ok(previewSource.indexOf("workflowAgentInput.value = ''") < previewSource.indexOf('workflowAgentConfirmPreview.open = true'))
})

testAsync('workflow agent enter send ignores ime composition empty input and sending state', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const keydownStart = drawerSource.indexOf('function handleComposerKeydown')
  const keydownEnd = drawerSource.indexOf('function focusComposer', keydownStart)
  const keydownSource = drawerSource.slice(keydownStart, keydownEnd)

  assert.match(keydownSource, /event\.isComposing/)
  assert.match(keydownSource, /event\.keyCode === 229/)
  assert.match(drawerSource, /function canSubmitComposer\(\)/)
  assert.match(drawerSource, /return !props\.sending && Boolean\(composerDraftText\(\)\)/)
  assert.match(keydownSource, /!canSubmitComposer\(\)/)
  assert.match(keydownSource, /event\.key === 'Enter' && !event\.shiftKey/)
  assert.match(keydownSource, /event\.preventDefault\(\)/)
  assert.match(keydownSource, /emit\('send'\)/)
})

testAsync('workflow agent node menu closes on outside click escape and unmount cleanup', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')

  assert.match(drawerSource, /ref="drawerRef"/)
  assert.match(drawerSource, /const drawerRef = ref\(null\)/)
  assert.match(drawerSource, /function closeAgentNodeMenu\(\)/)
  assert.match(drawerSource, /function handleGlobalPointerDown\(event\)/)
  assert.match(drawerSource, /function isInsideAgentPopoverControl\(event,\s*selector\)/)
  assert.match(drawerSource, /if \(!insideNodeSwitcher\) closeAgentNodeMenu\(\)/)
  assert.match(drawerSource, /function handleGlobalKeydown\(event\)/)
  assert.match(drawerSource, /event\.key === 'Escape'/)
  assert.match(drawerSource, /onMounted\(\(\) =>/)
  assert.match(drawerSource, /document\.addEventListener\('pointerdown',\s*handleGlobalPointerDown\)/)
  assert.match(drawerSource, /document\.addEventListener\('keydown',\s*handleGlobalKeydown\)/)
  assert.match(drawerSource, /onBeforeUnmount\(\(\) =>/)
  assert.match(drawerSource, /document\.removeEventListener\('pointerdown',\s*handleGlobalPointerDown\)/)
  assert.match(drawerSource, /document\.removeEventListener\('keydown',\s*handleGlobalKeydown\)/)
})

testAsync('workflow agent history popover closes on outside click escape and selection', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(drawerSource, /'close-history'/)
  assert.match(drawerSource, /function closeAgentHistory\(\)/)
  assert.match(drawerSource, /if \(props\.historyOpen\) emit\('close-history'\)/)
  assert.match(drawerSource, /closeAgentHistory\(\)\s*\n\s*closeAgentNodeMenu\(\)/)
  assert.match(drawerSource, /event\.key === 'Escape'[\s\S]*closeAgentHistory\(\)/)
  assert.match(drawerSource, /function selectHistoryItem\(content\)/)
  assert.match(drawerSource, /emit\('select-history',\s*content\)/)
  assert.match(drawerSource, /closeAgentHistory\(\)/)
  assert.match(drawerSource, /@click="selectHistoryItem\(historyItemContent\(item\)\)"/)
  assert.match(appSource, /@close-history="workflowAgentHistoryOpen = false"/)
})

testAsync('workflow agent popovers close when clicking drawer areas outside their own controls', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const pointerStart = drawerSource.indexOf('function handleGlobalPointerDown')
  const pointerEnd = drawerSource.indexOf('function handleGlobalKeydown', pointerStart)
  const pointerSource = drawerSource.slice(pointerStart, pointerEnd)

  assert.match(drawerSource, /function isInsideAgentPopoverControl\(event,\s*selector\)/)
  assert.match(drawerSource, /event\.target\?\.closest\?\.\(selector\)/)
  assert.match(pointerSource, /const insideNodeSwitcher = isInsideAgentPopoverControl\(event,\s*'\.agent-node-switcher'\)/)
  assert.match(pointerSource, /const insideHistoryEntry = isInsideAgentPopoverControl\(event,\s*'\.agent-history-entry'\)/)
  assert.match(pointerSource, /if \(!insideNodeSwitcher\) closeAgentNodeMenu\(\)/)
  assert.match(pointerSource, /if \(!insideHistoryEntry\) closeAgentHistory\(\)/)
  assert.doesNotMatch(pointerSource, /if \(drawerRef\.value\?\.contains\?\.\(event\.target\)\) return/)
})

testAsync('workflow agent upload menu closes on outside click and escape', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const pointerStart = drawerSource.indexOf('function handleGlobalPointerDown')
  const pointerEnd = drawerSource.indexOf('function handleGlobalKeydown', pointerStart)
  const pointerSource = drawerSource.slice(pointerStart, pointerEnd)
  const keydownStart = drawerSource.indexOf('function handleGlobalKeydown')
  const keydownEnd = drawerSource.indexOf('function selectHistoryItem', keydownStart)
  const keydownSource = drawerSource.slice(keydownStart, keydownEnd)

  assert.match(drawerSource, /'close-upload-menu'/)
  assert.match(drawerSource, /function closeAgentUploadMenu\(\)/)
  assert.match(drawerSource, /if \(props\.uploadOpen\) emit\('close-upload-menu'\)/)
  assert.match(pointerSource, /const insideUploadMenu = isInsideAgentPopoverControl\(event,\s*'\.agent-plus-wrap'\)/)
  assert.match(pointerSource, /if \(!insideUploadMenu\) closeAgentUploadMenu\(\)/)
  assert.match(keydownSource, /event\.key === 'Escape'[\s\S]*closeAgentUploadMenu\(\)/)
  assert.match(appSource, /@close-upload-menu="workflowAgentUploadOpen = false"/)
})

testAsync('workflow agent header popovers are mutually exclusive', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const toggleNodeStart = drawerSource.indexOf('function toggleAgentNodeMenu')
  const toggleNodeEnd = drawerSource.indexOf('function selectNode', toggleNodeStart)
  const toggleNodeSource = drawerSource.slice(toggleNodeStart, toggleNodeEnd)
  const appTemplateStart = appSource.indexOf('<WorkflowAgentDrawer')
  const appTemplateEnd = appSource.indexOf('@send="sendWorkflowAgentMessage"', appTemplateStart)
  const appTemplateSource = appSource.slice(appTemplateStart, appTemplateEnd)

  assert.match(drawerSource, /@click="toggleAgentNodeMenu"/)
  assert.match(drawerSource, /function toggleAgentNodeMenu\(\)/)
  assert.match(toggleNodeSource, /closeAgentHistory\(\)/)
  assert.match(toggleNodeSource, /closeAgentUploadMenu\(\)/)
  assert.match(appTemplateSource, /@toggle-history="toggleWorkflowAgentHistory"/)
  assert.match(appTemplateSource, /@toggle-upload-menu="toggleWorkflowAgentUploadMenu"/)
  assert.match(appSource, /function toggleWorkflowAgentHistory\(\)/)
  assert.match(appSource, /workflowAgentHistoryOpen\.value = !workflowAgentHistoryOpen\.value/)
  assert.match(appSource, /if \(workflowAgentHistoryOpen\.value\) workflowAgentUploadOpen\.value = false/)
  assert.match(appSource, /function toggleWorkflowAgentUploadMenu\(\)/)
  assert.match(appSource, /workflowAgentUploadOpen\.value = !workflowAgentUploadOpen\.value/)
  assert.match(appSource, /if \(workflowAgentUploadOpen\.value\) workflowAgentHistoryOpen\.value = false/)
})

testAsync('workflow agent send closes transient header popovers before showing progress', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(sendSource, /workflowAgentHistoryOpen\.value = false/)
  assert.match(sendSource, /workflowAgentUploadOpen\.value = false/)
  assert.match(sendSource, /workflowAgentSending\.value = true/)
  assert.ok(sendSource.indexOf('workflowAgentHistoryOpen.value = false') < sendSource.indexOf('workflowAgentSending.value = true'))
  assert.ok(sendSource.indexOf('workflowAgentUploadOpen.value = false') < sendSource.indexOf('workflowAgentSending.value = true'))
})

testAsync('workflow agent send closes confirmation preview before showing progress', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(sendSource, /closeWorkflowAgentConfirmPreview\(\)/)
  assert.ok(sendSource.indexOf('closeWorkflowAgentConfirmPreview()') < sendSource.indexOf('workflowAgentSending.value = true'))
})

testAsync('workflow agent upload picker closes menu immediately even when file selection is cancelled', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const triggerStart = drawerSource.indexOf('function triggerUpload')
  const triggerEnd = drawerSource.indexOf('function referenceStatusLabel', triggerStart)
  const triggerSource = drawerSource.slice(triggerStart, triggerEnd)

  assert.match(triggerSource, /closeAgentUploadMenu\(\)/)
  assert.ok(triggerSource.indexOf('closeAgentUploadMenu()') < triggerSource.indexOf("fileInput.value?.click?.()"))
})

testAsync('workflow agent draft states are mutually exclusive and explicit actions avoid stale retry metadata', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const quickStart = appSource.indexOf('function useWorkflowAgentQuickReply')
  const quickEnd = appSource.indexOf('async function copyWorkflowAgentMessage', quickStart)
  const quickSource = appSource.slice(quickStart, quickEnd)
  const editStart = appSource.indexOf('function editWorkflowAgentMessage')
  const editEnd = appSource.indexOf('function cancelWorkflowAgentEdit', editStart)
  const editSource = appSource.slice(editStart, editEnd)
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)
  const copyStart = appSource.indexOf('async function copyWorkflowAgentMessage')
  const copyEnd = appSource.indexOf('async function copyTextToClipboard', copyStart)
  const copySource = appSource.slice(copyStart, copyEnd)

  assert.match(appSource, /function clearWorkflowAgentDraftState\(\)/)
  assert.match(quickSource, /void sendWorkflowAgentMessage\(content,\s*\{\s*ignoreDraftState:\s*true\s*\}\)/)
  assert.match(confirmSource, /api\.workflows\.confirmProposal/)
  assert.match(retrySource, /workflowAgentEditingMessageId\.value = ''/)
  assert.match(editSource, /workflowAgentRetryMessageId\.value = ''/)
  assert.match(editSource, /workflowAgentRetryTargetMessageId\.value = ''/)
  assert.match(appSource, /const editOfMessageId = options\.editOfMessageId \|\| \(options\.ignoreDraftState \? '' : workflowAgentEditingMessageId\.value\) \|\| ''/)
  assert.match(appSource, /const retryOfMessageId = options\.retryOfMessageId \|\| \(options\.ignoreDraftState \? '' : workflowAgentRetryMessageId\.value\) \|\| ''/)
})

testAsync('workflow agent retry keeps original confirmed canvas content', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const retryEntryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEntryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryEntryStart)
  const retryEntrySource = appSource.slice(retryEntryStart, retryEntryEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.doesNotMatch(sendSource, /confirmedCanvasContent/)
  assert.doesNotMatch(sendSource, /targetCanvasNodeId/)
  assert.match(retryEntrySource, /message\?\.meta\?\.action === 'confirm-canvas'/)
  assert.match(retryEntrySource, /confirmWorkflowAgentMessage\(\{/)
  assert.match(retryEntrySource, /confirmedContent/)
  assert.match(retryEntrySource, /nodeId:\s*message\?\.meta\?\.nodeId/)
  assert.match(retryEntrySource, /proposalId/)
})

testAsync('workflow agent confirm canvas retry blocks empty confirmed content', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const retryStart = appSource.indexOf('function retryWorkflowAgentConfirmCanvas')
  const entryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const entryEnd = appSource.indexOf('function editWorkflowAgentMessage', entryStart)
  const retryEntrySource = retryStart >= 0
    ? appSource.slice(retryStart, appSource.indexOf('function retryWorkflowAgentMessage', retryStart))
    : appSource.slice(entryStart, entryEnd)

  assert.match(retryEntrySource, /const confirmedContent = \(message\?\.meta\?\.confirmedContent \|\| workflowAgentMessageText\(message\)\)\.trim\(\)/)
  assert.match(retryEntrySource, /if \(!confirmedContent\) \{[\s\S]*setStatus\(skillWorkbenchStatus,\s*'failed',\s*'没有可重新写入画布的确认内容'\)[\s\S]*return[\s\S]*\}/)
  assert.match(retryEntrySource, /confirmedContent,/)
  assert.doesNotMatch(retryEntrySource, /confirmedContent:\s*message\?\.meta\?\.confirmedContent \|\| message\?\.content \|\| ''/)
})

testAsync('workflow agent failed proposal confirm stores confirmed content in confirm handler', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(confirmSource, /const confirmedContent = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(confirmSource, /confirmedContent,/)
  assert.match(confirmSource, /proposalId/)
})

testAsync('workflow agent proposal confirm pending states carry retryable canvas metadata', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(confirmSource, /const targetNodeId = workflowAgentResolvedNodeId\(message\?\.nodeId \|\| message\?\.meta\?\.nodeId\)/)
  assert.match(confirmSource, /confirmedContent,/)
  assert.match(confirmSource, /nodeId:\s*targetNodeId/)
  assert.match(confirmSource, /proposalId/)
})

testAsync('workflow agent proposal confirm success preserves proposal metadata for audit trail', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)
  const successStart = confirmSource.indexOf('const confirmSuccessContent = workflowAgentConfirmSuccessContent')
  const successEnd = confirmSource.indexOf('workflowAgentNodeId.value =', successStart)
  const successSource = confirmSource.slice(successStart, successEnd)

  assert.match(successSource, /status:\s*'success'/)
  assert.match(successSource, /clientMessageId/)
  assert.match(successSource, /proposalId/)
  assert.match(successSource, /confirmedContent/)
  assert.match(successSource, /nodeId:\s*targetNodeId/)
})

testAsync('workflow agent proposal confirm success explains changed nodes and refresh reason', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function workflowAgentConfirmSuccessContent')
  const helperEnd = appSource.indexOf('function workflowAgentConfirmPreviewNodeKey', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(helperSource, /appliedPatch\?\.changedNodeIds/)
  assert.match(helperSource, /appliedPatch\?\.reason/)
  assert.match(helperSource, /刷新节点/)
  assert.match(helperSource, /刷新原因/)
  assert.match(confirmSource, /const confirmSuccessContent = workflowAgentConfirmSuccessContent\(data\.appliedPatch/)
  assert.match(confirmSource, /content:\s*confirmSuccessContent/)
  assert.match(confirmSource, /changedNodeIds:\s*data\.appliedPatch\?\.changedNodeIds \|\| \[\]/)
  assert.match(confirmSource, /refreshReason:\s*data\.appliedPatch\?\.reason \|\| ''/)
})

testAsync('workflow agent invalid proposal confirm failure explains model patch issue and stays retryable', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)
  const catchStart = confirmSource.indexOf('} catch (error) {')
  const finallyStart = confirmSource.indexOf('} finally {', catchStart)
  const catchSource = confirmSource.slice(catchStart, finallyStart)
  const helperStart = appSource.indexOf('function workflowAgentConfirmFailureContent')
  const helperEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)

  assert.match(helperSource, /AGENT_MODEL_PATCH_INVALID/)
  assert.match(helperSource, /模型返回内容不可写入画布/)
  assert.match(catchSource, /workflowAgentConfirmRecoveryActions\(error\)/)
  assert.match(catchSource, /workflowAgentConfirmFailureContent\(error\)/)
  assert.match(catchSource, /errorCode/)
  assert.match(catchSource, /status:\s*'failed'/)
  assert.match(catchSource, /action:\s*'confirm-canvas'/)
  assert.match(catchSource, /proposalId/)
  assert.match(catchSource, /confirmedContent/)
  assert.match(catchSource, /nodeId:\s*targetNodeId/)
  assert.match(catchSource, /recoveryActions:\s*\[/)
  assert.match(confirmSource, /workflowCanvasLoading\.value = false/)
  assert.match(confirmSource, /workflowCanvasRefreshingNodeId\.value = ''/)
})

testAsync('workflow agent invalid proposal failure regenerates advice instead of retrying same invalid confirm', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)
  const labelStart = drawerSource.indexOf('function retryActionLabel')
  const labelEnd = drawerSource.indexOf('function messageKnowledgeItems', labelStart)
  const labelSource = drawerSource.slice(labelStart, labelEnd)

  assert.match(labelSource, /AGENT_MODEL_PATCH_INVALID/)
  assert.match(labelSource, /重新生成建议/)
  assert.match(retrySource, /message\?\.meta\?\.error\?\.code === 'AGENT_MODEL_PATCH_INVALID'/)
  const invalidStart = appSource.indexOf('function retryInvalidWorkflowAgentPatch')
  const invalidEnd = invalidStart >= 0 ? appSource.indexOf('function retryWorkflowAgentMessage', invalidStart) : -1
  const branchStart = retrySource.indexOf("message?.meta?.error?.code === 'AGENT_MODEL_PATCH_INVALID'")
  const branchEnd = retrySource.indexOf('const confirmedContent', branchStart)
  const recoverySource = invalidStart >= 0
    ? appSource.slice(invalidStart, invalidEnd)
    : retrySource.slice(branchStart, branchEnd)
  assert.match(recoverySource, /workflowAgentRetryMessageId\.value = message\?\.id \|\| ''/)
  assert.match(recoverySource, /workflowAgentInput\.value = content/)
  assert.doesNotMatch(recoverySource, /confirmWorkflowAgentMessage/)
})

testAsync('workflow agent expired proposal failure regenerates advice instead of retrying stale confirm', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)
  const helperStart = appSource.indexOf('function workflowAgentConfirmFailureContent')
  const helperEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const labelStart = drawerSource.indexOf('function retryActionLabel')
  const labelEnd = drawerSource.indexOf('function messageAppliedPatchSummary', labelStart)
  const labelSource = drawerSource.slice(labelStart, labelEnd)

  assert.match(appSource, /workflowAgentStaleProposalErrorCodes = \['AGENT_PROPOSAL_NOT_FOUND', 'AGENT_PROPOSAL_NOT_PENDING', 'AGENT_PROPOSAL_STALE'\]/)
  assert.match(helperSource, /workflowAgentStaleProposalErrorCodes\.includes\(errorCode\)/)
  assert.match(helperSource, /isStaleProposal/)
  assert.match(helperSource, /重新生成建议/)
  assert.match(confirmSource, /workflowAgentConfirmFailureContent\(error\)/)
  assert.match(labelSource, /AGENT_PROPOSAL_NOT_FOUND/)
  assert.match(labelSource, /AGENT_PROPOSAL_NOT_PENDING/)
  assert.match(labelSource, /AGENT_PROPOSAL_STALE/)
  assert.match(labelSource, /重新生成建议/)
  assert.match(retrySource, /workflowAgentStaleProposalErrorCodes\.includes\(message\?\.meta\?\.error\?\.code\)/)
  assert.match(retrySource, /retryInvalidWorkflowAgentPatch\(message\)/)
})

testAsync('workflow agent confirm failure helper explains stale invalid and timeout errors', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function workflowAgentConfirmFailureContent')
  const helperEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)

  assert.match(helperSource, /AGENT_MODEL_PATCH_INVALID/)
  assert.match(helperSource, /workflowAgentStaleProposalErrorCodes\.includes\(errorCode\)/)
  assert.match(helperSource, /timeout|TIMEOUT|timed?out/i)
  assert.match(helperSource, /模型返回内容不可写入画布/)
  assert.match(helperSource, /提案已失效或已处理/)
  assert.match(helperSource, /确认入画布超时/)
})

testAsync('workflow agent confirm failure helper explains persist failures separately', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function workflowAgentConfirmFailureContent')
  const helperEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const recoveryStart = appSource.indexOf('function workflowAgentConfirmRecoveryActions')
  const recoveryEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', recoveryStart)
  const recoverySource = appSource.slice(recoveryStart, recoveryEnd)

  assert.match(helperSource, /AGENT_CONFIRM_PERSIST_FAILED/)
  assert.match(helperSource, /画布已生成但保存失败/)
  assert.match(recoverySource, /AGENT_CONFIRM_PERSIST_FAILED/)
  assert.match(recoverySource, /重试保存/)
})

testAsync('workflow agent retry save uses save-only proposal api instead of rebuilding canvas', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const recoverStart = appSource.indexOf('function recoverWorkflowAgentMessage')
  const recoverEnd = appSource.indexOf('function editWorkflowAgentMessage', recoverStart)
  const recoverSource = appSource.slice(recoverStart, recoverEnd)
  const saveStart = appSource.indexOf('async function retrySaveWorkflowAgentConfirmedCanvas')
  const saveEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', saveStart)
  const saveSource = appSource.slice(saveStart, saveEnd)
  const apiSaveStart = apiSource.indexOf('saveConfirmedProposal(config, runId, proposalId')
  const apiSaveEnd = apiSource.indexOf('completeRun(config', apiSaveStart)
  const apiSaveSource = apiSource.slice(apiSaveStart, apiSaveEnd)

  assert.match(recoverSource, /action === '重试保存'/)
  assert.match(recoverSource, /retrySaveWorkflowAgentConfirmedCanvas\(message\)/)
  assert.doesNotMatch(recoverSource, /action === '重试确认' \|\| action === '重试保存'/)
  assert.match(saveSource, /api\.workflows\.saveConfirmedProposal/)
  assert.match(saveSource, /message\?\.meta\?\.error\?\.run/)
  assert.match(saveSource, /message\?\.meta\?\.error\?\.analysis/)
  assert.match(saveSource, /saveIdempotent:\s*Boolean\(data\.idempotent\)/)
  assert.match(apiSaveSource, /\/confirm\/save/)
})

testAsync('workflow agent confirm preview exposes target summary and downstream refresh scope', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stateStart = appSource.indexOf('const workflowAgentConfirmPreview = reactive')
  const stateEnd = appSource.indexOf('const workflowAgentConfirmPreviewDownstream', stateStart)
  const stateSource = appSource.slice(stateStart, stateEnd)
  const templateStart = appSource.indexOf('<section class="agent-confirm-preview"')
  const templateEnd = appSource.indexOf('</section>', templateStart)
  const templateSource = appSource.slice(templateStart, templateEnd)
  const openStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const openEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', openStart)
  const openSource = appSource.slice(openStart, openEnd)
  const closeStart = appSource.indexOf('function closeWorkflowAgentConfirmPreview')
  const closeEnd = appSource.indexOf('function submitWorkflowAgentConfirmPreview', closeStart)
  const closeSource = appSource.slice(closeStart, closeEnd)

  assert.match(stateSource, /summary:\s*''/)
  assert.match(stateSource, /refreshScopeLabel:\s*''/)
  assert.match(templateSource, /workflowAgentConfirmPreview\.summary/)
  assert.match(templateSource, /workflowAgentConfirmPreview\.refreshScopeLabel/)
  assert.match(templateSource, /将写入/)
  assert.match(templateSource, /后续刷新/)
  assert.match(openSource, /workflowAgentConfirmPreview\.summary =/)
  assert.match(openSource, /workflowAgentConfirmPreview\.refreshScopeLabel =/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.summary = ''/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.refreshScopeLabel = ''/)
})

testAsync('workflow agent confirm preview exposes proposal rationale before writing canvas', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stateStart = appSource.indexOf('const workflowAgentConfirmPreview = reactive')
  const stateEnd = appSource.indexOf('const workflowAgentConfirmPreviewDownstream', stateStart)
  const stateSource = appSource.slice(stateStart, stateEnd)
  const templateStart = appSource.indexOf('<section class="agent-confirm-preview"')
  const templateEnd = appSource.indexOf('</section>', templateStart)
  const templateSource = appSource.slice(templateStart, templateEnd)
  const openStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const openEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', openStart)
  const openSource = appSource.slice(openStart, openEnd)
  const closeStart = appSource.indexOf('function closeWorkflowAgentConfirmPreview')
  const closeEnd = appSource.indexOf('function submitWorkflowAgentConfirmPreview', closeStart)
  const closeSource = appSource.slice(closeStart, closeEnd)
  const submitStart = appSource.indexOf('function submitWorkflowAgentConfirmPreview')
  const submitEnd = appSource.indexOf('async function confirmWorkflowAgentMessage', submitStart)
  const submitSource = appSource.slice(submitStart, submitEnd)

  assert.match(stateSource, /rationale:\s*\[\]/)
  assert.match(stateSource, /contextSources:\s*\[\]/)
  assert.match(templateSource, /提案依据/)
  assert.match(templateSource, /上下文来源/)
  assert.match(templateSource, /workflowAgentConfirmPreview\.rationale/)
  assert.match(templateSource, /workflowAgentConfirmPreview\.contextSources/)
  assert.match(openSource, /message\?\.meta\?\.proposalSummary/)
  assert.match(openSource, /workflowAgentConfirmPreview\.rationale =/)
  assert.match(openSource, /workflowAgentConfirmPreview\.contextSources =/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.rationale = \[\]/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.contextSources = \[\]/)
  assert.doesNotMatch(submitSource, /rationale/)
  assert.doesNotMatch(submitSource, /contextSources/)
})

testAsync('workflow agent confirm preview exposes writeable content and downstream impact reasons', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stateStart = appSource.indexOf('const workflowAgentConfirmPreview = reactive')
  const stateEnd = appSource.indexOf('const workflowAgentConfirmPreviewDownstream', stateStart)
  const stateSource = appSource.slice(stateStart, stateEnd)
  const templateStart = appSource.indexOf('<section class="agent-confirm-preview"')
  const templateEnd = appSource.indexOf('</section>', templateStart)
  const templateSource = appSource.slice(templateStart, templateEnd)
  const openStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const openEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', openStart)
  const openSource = appSource.slice(openStart, openEnd)
  const closeStart = appSource.indexOf('function closeWorkflowAgentConfirmPreview')
  const closeEnd = appSource.indexOf('function submitWorkflowAgentConfirmPreview', closeStart)
  const closeSource = appSource.slice(closeStart, closeEnd)

  assert.match(stateSource, /actionIntent:\s*''/)
  assert.match(stateSource, /writeableItems:\s*\[\]/)
  assert.match(stateSource, /acceptanceCriteria:\s*\[\]/)
  assert.match(templateSource, /动作意图/)
  assert.match(templateSource, /写入条目/)
  assert.match(templateSource, /验收标准/)
  assert.match(templateSource, /影响原因/)
  assert.match(templateSource, /workflowAgentConfirmPreview\.writeableItems/)
  assert.match(templateSource, /workflowAgentConfirmPreview\.acceptanceCriteria/)
  assert.match(templateSource, /node\.reason/)
  assert.match(openSource, /proposalSummary\.writeableContent/)
  assert.match(openSource, /proposalSummary\.downstreamImpact/)
  assert.match(openSource, /workflowAgentConfirmPreview\.actionIntent =/)
  assert.match(openSource, /workflowAgentConfirmPreview\.writeableItems =/)
  assert.match(openSource, /workflowAgentConfirmPreview\.acceptanceCriteria =/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.actionIntent = ''/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.writeableItems = \[\]/)
  assert.match(closeSource, /workflowAgentConfirmPreview\.acceptanceCriteria = \[\]/)
})

testAsync('workflow agent drawer can explain proposal rationale and context sources', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const templateStart = drawerSource.indexOf('<details v-if="messageKnowledgeItems(message).length"')
  const templateEnd = drawerSource.indexOf('<p v-if="messageErrorText(message)"', templateStart)
  const evidenceTemplate = drawerSource.slice(templateStart, templateEnd)
  const helperStart = drawerSource.indexOf('function messageProposalEvidence')
  const helperEnd = drawerSource.indexOf('function messageKnowledgeItems', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(evidenceTemplate, /agent-proposal-evidence/)
  assert.match(evidenceTemplate, /提案依据/)
  assert.match(evidenceTemplate, /messageProposalEvidence\(message\)\.rationale/)
  assert.match(evidenceTemplate, /messageProposalEvidence\(message\)\.contextSources/)
  assert.match(evidenceTemplate, /agent-proposal-source-meta/)
  assert.match(evidenceTemplate, /来源类型/)
  assert.match(evidenceTemplate, /可信状态/)
  assert.match(evidenceTemplate, /命中原因/)
  assert.match(helperSource, /proposalSummary/)
  assert.match(helperSource, /contextSources/)
  assert.match(helperSource, /rationale/)
  assert.match(helperSource, /proposalSourceTypeLabel/)
  assert.match(helperSource, /proposalSourceVerificationLabel/)
})

testAsync('workflow agent drawer renders confirmed canvas applied patch as a structured success card', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const templateStart = drawerSource.indexOf('<details v-if="messageKnowledgeItems(message).length"')
  const templateEnd = drawerSource.indexOf('<p v-if="messageErrorText(message)"', templateStart)
  const evidenceTemplate = drawerSource.slice(templateStart, templateEnd)
  const helperStart = drawerSource.indexOf('function messageAppliedPatchSummary')
  const helperEnd = drawerSource.indexOf('function messageProposalEvidence', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)
  const styleSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(evidenceTemplate, /agent-applied-patch-card/)
  assert.match(evidenceTemplate, /已更新画布/)
  assert.match(evidenceTemplate, /messageAppliedPatchSummary\(message\)\.changedNodeIds/)
  assert.match(evidenceTemplate, /messageAppliedPatchSummary\(message\)\.nodeDiffs/)
  assert.match(evidenceTemplate, /messageAppliedPatchSummary\(message\)\.auditItems/)
  assert.match(evidenceTemplate, /审计信息/)
  assert.match(evidenceTemplate, /diff\.before\.summary/)
  assert.match(evidenceTemplate, /diff\.after\.summary/)
  assert.match(evidenceTemplate, /messageAppliedPatchSummary\(message\)\.reason/)
  assert.match(helperSource, /appliedPatch/)
  assert.match(helperSource, /audit/)
  assert.match(helperSource, /auditItems/)
  assert.match(helperSource, /changedNodeIds/)
  assert.match(helperSource, /nodeDiffs/)
  assert.match(helperSource, /refreshReason/)
  assert.match(styleSource, /\.agent-applied-patch-card/)
})

testAsync('workflow agent hides confirm action for superseded proposals and labels stale proposal state', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const confirmStart = drawerSource.indexOf('function canConfirmMessage')
  const confirmEnd = drawerSource.indexOf('function retryActionLabel', confirmStart)
  const confirmSource = drawerSource.slice(confirmStart, confirmEnd)

  assert.match(drawerSource, /function messageProposalStatus\(message = \{\}\)/)
  assert.match(drawerSource, /function messageProposalStatusLabel\(message = \{\}\)/)
  assert.match(drawerSource, /proposalStatus !== 'superseded'/)
  assert.match(drawerSource, /proposalStatus !== 'stale'/)
  assert.match(drawerSource, /proposalStatus !== 'confirmed'/)
  assert.match(drawerSource, /提案已被新版替代|提案已确认|提案已失效/)
  assert.match(confirmSource, /const proposalStatus = messageProposalStatus\(message\)/)
})

testAsync('workflow agent confirm canvas pending message shows staged progress', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const templateStart = drawerSource.indexOf('<p v-if="messageErrorText(message)"')
  const templateEnd = drawerSource.indexOf('<div v-if="hasMessageActions(message)"', templateStart)
  const templateSource = drawerSource.slice(templateStart, templateEnd)
  const helperStart = drawerSource.indexOf('function messageConfirmProgressSteps')
  const helperEnd = drawerSource.indexOf('function messageAppliedPatchSummary', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)

  assert.match(templateSource, /agent-confirm-progress/)
  assert.match(templateSource, /messageConfirmProgressSteps\(message\)/)
  assert.match(helperSource, /validating-proposal/)
  assert.match(helperSource, /rewriting-current/)
  assert.match(helperSource, /refreshing-downstream/)
  assert.match(helperSource, /saving-version/)
  assert.match(styleSource, /\.agent-confirm-progress/)
  assert.match(styleSource, /\.agent-confirm-progress-step\.active/)
})

testAsync('workflow agent proposal confirm uses model timeout instead of short generic request timeout', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)
  const apiConfirmStart = apiSource.indexOf('confirmProposalStream(config, runId, proposalId')
  const apiConfirmEnd = apiSource.indexOf('completeRun(config', apiConfirmStart)
  const apiConfirmSource = apiSource.slice(apiConfirmStart, apiConfirmEnd)

  assert.match(apiConfirmSource, /confirmProposalStream\(config,\s*runId,\s*proposalId,\s*payload = \{\},\s*options = \{\}\)/)
  assert.match(apiConfirmSource, /confirmProposal\(config,\s*runId,\s*proposalId,\s*payload = \{\},\s*options = \{\}\)/)
  assert.match(apiConfirmSource, /timeoutMs:\s*options\.timeoutMs\s*\|\|\s*210000/)
  assert.match(confirmSource, /timeoutMs:\s*workflowAgentRequestTimeoutMs\(\)/)
  assert.match(confirmSource, /signal:\s*workflowAgentStreamController\.value\.signal/)
})

testAsync('workflow agent typed confirmation words remain normal chat actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.doesNotMatch(sendSource, /isWorkflowAgentConfirmationAction\(content\)/)
  assert.match(sendSource, /const effectiveMessageAction = messageAction/)
  assert.match(sendSource, /action:\s*effectiveMessageAction/)
  assert.match(sendSource, /messageAction/)
  assert.doesNotMatch(sendSource, /confirm-canvas/)
})

testAsync('workflow agent thrown send failures do not carry canvas confirm metadata', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const catchStart = sendSource.indexOf('} catch (error) {')
  const catchEnd = sendSource.indexOf('} finally {', catchStart)
  const catchSource = sendSource.slice(catchStart, catchEnd)

  assert.match(catchSource, /action:\s*effectiveMessageAction/)
  assert.doesNotMatch(catchSource, /confirmedContent/)
  assert.doesNotMatch(catchSource, /nodeId:\s*targetCanvasNodeId/)
  assert.doesNotMatch(catchSource, /action:\s*messageAction/)
})

testAsync('workflow agent confirmation preview and metadata visibility are explicit', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /const workflowAgentConfirmPreview = reactive/)
  assert.match(appSource, /function openWorkflowAgentConfirmPreview\(message\)/)
  assert.match(appSource, /function submitWorkflowAgentConfirmPreview\(\)/)
  assert.match(appSource, /function closeWorkflowAgentConfirmPreview\(\)/)
  assert.match(appSource, /v-if="workflowAgentConfirmPreview\.open"/)
  assert.match(appSource, /class="agent-confirm-preview"/)
  assert.match(appSource, /即将写入/)
  assert.match(appSource, /确认写入/)
  assert.match(appSource, /后续刷新/)
  assert.match(appSource, /目标节点/)
  assert.match(appSource, /function workflowCanvasDownstreamNodes\(nodeId\)/)
  assert.match(appSource, /workflowAgentConfirmPreview\.nodeId/)
  assert.match(appSource, /workflowAgentConfirmPreview\.downstream/)
  assert.match(appSource, /const targetNodeId = workflowAgentResolvedNodeId\(message\?\.nodeId \|\| message\?\.meta\?\.nodeId\)/)
  assert.match(appSource, /nodeId:\s*targetNodeId/)
  assert.match(appSource, /@confirm-message="openWorkflowAgentConfirmPreview"/)
  assert.doesNotMatch(appSource, /workflowStatus/)

  assert.match(drawerSource, /function shouldShowMessageMeta\(message\)/)
  assert.match(drawerSource, /function shouldShowProviderMeta\(message\)/)
  assert.match(drawerSource, /function shouldShowUsageMeta\(message\)/)
  assert.match(drawerSource, /function messageMetaItems\(message,\s*fallbackModel = ''\)/)
  assert.match(drawerSource, /function isConfirmCanvasMessage\(message\)/)
  assert.match(drawerSource, /!isConfirmCanvasMessage\(message\)/)
  assert.match(drawerSource, /v-if="shouldShowMessageMeta\(message\)"/)
  assert.match(drawerSource, /messageMetaItems\(message,\s*model\)/)
  assert.match(drawerSource, /messageRole\(message\) === 'assistant'/)
  assert.match(drawerSource, /messageMeta\(message\)\.provider/)
  assert.doesNotMatch(drawerSource, /Provider \{\{ message\.meta\.provider \|\| 'unknown' \}\}/)
  assert.doesNotMatch(drawerSource, /Tokens \{\{ message\.meta\.usage\?\.totalTokens \?\? 0 \}\}/)
  assert.match(styles, /\.agent-confirm-preview/)
})

testAsync('workflow agent message metadata template uses safe helpers for missing meta', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const metaStart = drawerSource.indexOf('class="agent-message-meta"')
  const metaEnd = drawerSource.indexOf('</div>', metaStart)
  const metaSource = drawerSource.slice(drawerSource.lastIndexOf('<div', metaStart), metaEnd)
  const errorStart = drawerSource.indexOf('class="agent-message-error"')
  const errorEnd = drawerSource.indexOf('</p>', errorStart)
  const errorSource = drawerSource.slice(drawerSource.lastIndexOf('<p', errorStart), errorEnd)

  assert.match(drawerSource, /function messageMeta\(message\)/)
  assert.match(drawerSource, /return message && typeof message\.meta === 'object' && !Array\.isArray\(message\.meta\) \? message\.meta : \{\}/)
  assert.match(drawerSource, /function messageMetaItems\(message,\s*fallbackModel = ''\)/)
  assert.match(metaSource, /v-for="item in messageMetaItems\(message,\s*model\)"/)
  assert.match(metaSource, /:key="item\.key"/)
  assert.match(metaSource, /:class="item\.class"/)
  assert.match(metaSource, /\{\{ item\.label \}\}/)
  assert.match(errorSource, /messageErrorText\(message\)/)
  assert.match(drawerSource, /function messageStatus\(message\)/)
  assert.match(drawerSource, /function messageStatusClass\(message\)/)
  assert.match(drawerSource, /function messageProviderLabel\(message\)/)
  assert.match(drawerSource, /function messageModelLabel\(message,\s*fallbackModel = ''\)/)
  assert.match(drawerSource, /function messageUsageTotal\(message\)/)
  assert.match(drawerSource, /function messageActionTypeLabel\(message\)/)
  assert.match(drawerSource, /function messageErrorText\(message\)/)
  assert.match(drawerSource, /return messageMetaItems\(message\)\.length > 0/)
  assert.doesNotMatch(metaSource, /message\.meta\./)
  assert.doesNotMatch(errorSource, /message\.meta\./)
  assert.doesNotMatch(metaSource, /messageMeta\(message\)\.provider/)
  assert.doesNotMatch(metaSource, /messageMeta\(message\)\.model/)
  assert.doesNotMatch(metaSource, /messageMeta\(message\)\.usage/)
  assert.doesNotMatch(metaSource, /Provider \{\{/)
  assert.doesNotMatch(metaSource, /Tokens \{\{/)
  assert.doesNotMatch(errorSource, /messageMeta\(message\)\.error/)
})

testAsync('workflow agent hides provider model and action type debug chips in normal chat', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const metaItemsStart = drawerSource.indexOf('function messageMetaItems')
  const metaItemsEnd = drawerSource.indexOf('function shouldShowMessageMeta', metaItemsStart)
  const metaItemsSource = drawerSource.slice(metaItemsStart, metaItemsEnd)
  const providerStart = drawerSource.indexOf('function shouldShowProviderMeta')
  const providerEnd = drawerSource.indexOf('function shouldShowUsageMeta', providerStart)
  const providerSource = drawerSource.slice(providerStart, providerEnd)
  const usageStart = drawerSource.indexOf('function shouldShowUsageMeta')
  const usageEnd = drawerSource.indexOf('function shouldShowActionTypeMeta', usageStart)
  const usageSource = drawerSource.slice(usageStart, usageEnd)
  const actionTypeStart = drawerSource.indexOf('function shouldShowActionTypeMeta')
  const actionTypeEnd = drawerSource.indexOf('function composerDraftText', actionTypeStart)
  const actionTypeSource = drawerSource.slice(actionTypeStart, actionTypeEnd)

  assert.doesNotMatch(metaItemsSource, /Provider \$\{messageProviderLabel\(message\)\}/)
  assert.doesNotMatch(metaItemsSource, /messageModelLabel\(message,\s*fallbackModel\)/)
  assert.match(providerSource, /return false/)
  assert.match(usageSource, /return false/)
  assert.match(drawerSource, /function shouldShowActionTypeMeta\(message\)/)
  assert.match(actionTypeSource, /return false/)
})

testAsync('workflow agent message template normalizes missing role and content', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const articleStart = drawerSource.indexOf('v-for="(message, index) in visibleMessages"')
  const articleEnd = drawerSource.indexOf('<div v-if="shouldShowMessageMeta(message)"', articleStart)
  const articleSource = drawerSource.slice(drawerSource.lastIndexOf('<article', articleStart), articleEnd)

  assert.match(drawerSource, /function messageRole\(message\)/)
  assert.match(drawerSource, /function messageContent\(message\)/)
  assert.match(drawerSource, /return \['user', 'assistant'\]\.includes\(message\?\.role\) \? message\.role : 'assistant'/)
  assert.match(drawerSource, /return String\(message\?\.content \?\? ''\)/)
  assert.match(articleSource, /`agent-message agent-\$\{messageRole\(message\)\}`/)
  assert.match(articleSource, /isMessageFailed\(message\)/)
  assert.match(drawerSource, /function isMessageFailed\(message\)/)
  assert.match(articleSource, /messageRole\(message\) === 'user' \? '你' : 'Agent'/)
  assert.match(articleSource, /<pre>\{\{ messageContent\(message\) \}\}<\/pre>/)
  assert.doesNotMatch(articleSource, /message\.role/)
  assert.doesNotMatch(articleSource, /message\.content/)
  assert.doesNotMatch(articleSource, /message\.meta\?\./)
  assert.doesNotMatch(articleSource, /messageMeta\(message\)\.status/)
})

testAsync('workflow agent message actions use normalized role and content', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const canCopyStart = drawerSource.indexOf('function canCopyMessage')
  const canCopyEnd = drawerSource.indexOf('function messageActionStatus', canCopyStart)
  const canCopySource = drawerSource.slice(canCopyStart, canCopyEnd)
  const statusStart = drawerSource.indexOf('function messageActionStatus')
  const statusEnd = drawerSource.indexOf('function canRetryMessage', statusStart)
  const statusSource = drawerSource.slice(statusStart, statusEnd)
  const retryStart = drawerSource.indexOf('function canRetryMessage')
  const retryEnd = drawerSource.indexOf('function canEditMessage', retryStart)
  const retrySource = drawerSource.slice(retryStart, retryEnd)
  const editStart = drawerSource.indexOf('function canEditMessage')
  const editEnd = drawerSource.indexOf('function canConfirmMessage', editStart)
  const editSource = drawerSource.slice(editStart, editEnd)
  const confirmStart = drawerSource.indexOf('function canConfirmMessage')
  const confirmEnd = drawerSource.indexOf('function retryActionLabel', confirmStart)
  const confirmSource = drawerSource.slice(confirmStart, confirmEnd)

  assert.match(canCopySource, /Boolean\(messageContent\(message\)\.trim\(\)\)/)
  assert.match(statusSource, /messageRole\(message\) === 'assistant'/)
  assert.match(statusSource, /messageContent\(message\)\.trim\(\)/)
  assert.match(retrySource, /const isAssistant = messageRole\(message\) === 'assistant'/)
  assert.match(editSource, /const isUser = messageRole\(message\) === 'user'/)
  assert.match(editSource, /Boolean\(messageContent\(message\)\.trim\(\)\)/)
  assert.match(confirmSource, /const isAssistant = messageRole\(message\) === 'assistant'/)
  assert.match(confirmSource, /!messageContent\(message\)\.trim\(\)/)
  assert.doesNotMatch(canCopySource, /message\?\.content/)
  assert.doesNotMatch(statusSource, /message\?\.content/)
  assert.doesNotMatch(retrySource, /message\?\.role/)
  assert.doesNotMatch(editSource, /message\?\.content/)
  assert.doesNotMatch(confirmSource, /message\?\.content/)
})

testAsync('workflow agent confirmation preview disables submit while agent is sending', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const previewStart = appSource.indexOf('v-if="workflowAgentConfirmPreview.open"')
  const previewEnd = appSource.indexOf('<section v-if="false" class="panel final-conclusion-panel"', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)
  const submitStart = appSource.indexOf('function submitWorkflowAgentConfirmPreview')
  const submitEnd = appSource.indexOf('function confirmWorkflowAgentMessage', submitStart)
  const submitSource = appSource.slice(submitStart, submitEnd)

  assert.match(previewSource, /:disabled="workflowAgentSending"/)
  assert.match(previewSource, /@click="submitWorkflowAgentConfirmPreview"/)
  assert.match(submitSource, /if \(workflowAgentSending\.value\) return/)
  assert.match(submitSource, /confirmWorkflowAgentMessage/)
})

testAsync('workflow agent confirmation preview explains when no downstream nodes refresh', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const previewStart = appSource.indexOf('v-if="workflowAgentConfirmPreview.open"')
  const previewEnd = appSource.indexOf('<section v-if="false" class="panel final-conclusion-panel"', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(previewSource, /workflowAgentConfirmPreviewDownstream\.length/)
  assert.match(previewSource, /无后续节点，仅刷新当前节点/)
})

testAsync('workflow agent confirmation preview filters malformed downstream nodes', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const previewStart = appSource.indexOf('v-if="workflowAgentConfirmPreview.open"')
  const previewEnd = appSource.indexOf('<section v-if="false" class="panel final-conclusion-panel"', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)
  const helperStart = appSource.indexOf('const workflowAgentConfirmPreviewDownstream')
  const helperEnd = appSource.indexOf('function workflowAgentConfirmPreviewNodeKey', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const keyStart = appSource.indexOf('function workflowAgentConfirmPreviewNodeKey')
  const keyEnd = appSource.indexOf('function cancelWorkflowAgentEdit', keyStart)
  const keySource = appSource.slice(keyStart, keyEnd)
  const openStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const openEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', openStart)
  const openSource = appSource.slice(openStart, openEnd)

  assert.match(appSource, /const workflowAgentConfirmPreviewDownstream = computed/)
  assert.match(helperSource, /Array\.isArray\(workflowAgentConfirmPreview\.downstream\)/)
  assert.match(helperSource, /workflowAgentConfirmPreview\.downstream\.filter\(\(node\) => node && typeof node === 'object' && !Array\.isArray\(node\)\)/)
  assert.match(previewSource, /v-if="workflowAgentConfirmPreviewDownstream\.length"/)
  assert.match(previewSource, /v-for="\(\s*node,\s*index\s*\) in workflowAgentConfirmPreviewDownstream"/)
  assert.match(previewSource, /:key="workflowAgentConfirmPreviewNodeKey\(node,\s*index\)"/)
  assert.match(keySource, /function workflowAgentConfirmPreviewNodeKey\(node = \{\},\s*index = 0\)/)
  assert.match(keySource, /node\.id \|\| node\.title/)
  assert.match(openSource, /downstream\.filter\(\(item\) => item && typeof item === 'object' && !Array\.isArray\(item\)\)/)
  assert.doesNotMatch(previewSource, /workflowAgentConfirmPreview\.downstream\.length/)
  assert.doesNotMatch(previewSource, /v-for="node in workflowAgentConfirmPreview\.downstream"/)
})

testAsync('workflow agent downstream node lookup filters malformed canvas nodes before reading ids', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function workflowCanvasDownstreamNodes')
  const helperEnd = appSource.indexOf('function workflowAgentRequestContext', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)

  assert.match(helperSource, /const nodes = \(Array\.isArray\(workflowCanvasNodes\.value\) \? workflowCanvasNodes\.value : \[\]\)\.filter\(\(node\) => node && typeof node === 'object' && !Array\.isArray\(node\)\)/)
  assert.match(helperSource, /const index = nodes\.findIndex\(\(node\) => node\.id === nodeId\)/)
  assert.doesNotMatch(helperSource, /const nodes = workflowCanvasNodes\.value \|\| \[\]/)
})

testAsync('workflow canvas nodes filters malformed canvas data before adding defaults', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('const workflowCanvasNodes = computed')
  const helperEnd = appSource.indexOf('const workflowCanvasEdges', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)

  assert.match(helperSource, /\(Array\.isArray\(workflowCanvas\.value\?\.nodes\) \? workflowCanvas\.value\.nodes : \[\]\)/)
  assert.match(helperSource, /\.filter\(\(node\) => node && typeof node === 'object' && !Array\.isArray\(node\)\)/)
  assert.match(helperSource, /width: node\.width \|\| 320/)
  assert.match(helperSource, /height: node\.height \|\| 220/)
  assert.doesNotMatch(helperSource, /\(workflowCanvas\.value\.nodes \|\| \[\]\)\.map/)
})

testAsync('workflow agent confirmation preview closes on escape and cleans listener', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const keyStart = appSource.indexOf('function handleWorkflowAgentGlobalKeydown')
  const keyEnd = appSource.indexOf('function initialActiveViewFromHash', keyStart)
  const keySource = appSource.slice(keyStart, keyEnd)

  assert.match(appSource, /function handleWorkflowAgentGlobalKeydown\(event\)/)
  assert.match(keySource, /if \(event\.key !== 'Escape'\) return/)
  assert.match(keySource, /if \(workflowAgentConfirmPreview\.open\) closeWorkflowAgentConfirmPreview\(\)/)
  assert.match(appSource, /window\.addEventListener\('keydown',\s*handleWorkflowAgentGlobalKeydown\)/)
  assert.match(appSource, /window\.removeEventListener\('keydown',\s*handleWorkflowAgentGlobalKeydown\)/)
})

testAsync('workflow agent confirmation resolves a valid canvas node before repair handoff', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const resolvedStart = appSource.indexOf('function workflowAgentResolvedNodeId')
  const resolvedEnd = appSource.indexOf('function workflowCanvasDownstreamNodes', resolvedStart)
  const resolvedSource = appSource.slice(resolvedStart, resolvedEnd)
  const supplementStart = appSource.indexOf('async function applyWorkflowAgentSupplement')
  const supplementEnd = appSource.indexOf('async function repairWorkflowAnalysis', supplementStart)
  const supplementSource = appSource.slice(supplementStart, supplementEnd)
  const previewStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const previewEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(resolvedSource, /function workflowAgentResolvedNodeId\(candidateId = ''\)/)
  assert.match(resolvedSource, /canvasNodeById\(candidateId\)/)
  assert.match(resolvedSource, /workflowCanvasNodes\.value\[0\]\?\.id/)
  assert.match(supplementSource, /const targetNodeId = workflowAgentResolvedNodeId\(payload\.nodeId\)/)
  assert.match(supplementSource, /if \(targetNodeId\) selectWorkflowCanvasNode\(targetNodeId\)/)
  assert.match(supplementSource, /workflowCanvasRefreshingNodeId\.value = targetNodeId/)
  assert.match(supplementSource, /nodeId:\s*targetNodeId/)
  assert.match(previewSource, /const nodeId = workflowAgentResolvedNodeId\(message\?\.meta\?\.nodeId\)/)
  assert.match(confirmSource, /const targetNodeId = workflowAgentResolvedNodeId\(message\?\.nodeId \|\| message\?\.meta\?\.nodeId\)/)
})

testAsync('workflow agent confirmation preview ignores whitespace-only assistant content', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const previewStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const previewEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(previewSource, /const confirmedContent = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(previewSource, /if \(!confirmedContent\) return/)
  assert.match(previewSource, /workflowAgentConfirmPreview\.content = confirmedContent/)
  assert.doesNotMatch(previewSource, /workflowAgentConfirmPreview\.content = message\.content/)
})

testAsync('workflow agent app normalizes message content before edit retry and confirm handoff', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const retryStart = appSource.indexOf('function retryWorkflowAgentMessage')
  const retryEnd = appSource.indexOf('function editWorkflowAgentMessage', retryStart)
  const retrySource = appSource.slice(retryStart, retryEnd)
  const copyStart = appSource.indexOf('async function copyWorkflowAgentMessage')
  const copyEnd = appSource.indexOf('async function copyTextToClipboard', copyStart)
  const copySource = appSource.slice(copyStart, copyEnd)
  const editStart = appSource.indexOf('function editWorkflowAgentMessage')
  const editEnd = appSource.indexOf('function cancelWorkflowAgentEdit', editStart)
  const editSource = appSource.slice(editStart, editEnd)
  const previewStart = appSource.indexOf('function openWorkflowAgentConfirmPreview')
  const previewEnd = appSource.indexOf('function closeWorkflowAgentConfirmPreview', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(appSource, /function workflowAgentMessageText\(message\)/)
  assert.match(appSource, /return String\(message\?\.content \?\? ''\)/)
  assert.match(retrySource, /workflowAgentMessageText\(message\)/)
  assert.match(copySource, /const text = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(editSource, /const content = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(previewSource, /const confirmedContent = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(confirmSource, /const confirmedContent = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.doesNotMatch(copySource, /message\?\.content\?\.trim\?\.\(\)/)
  assert.doesNotMatch(editSource, /message\?\.content\?\.trim\?\.\(\)/)
  assert.doesNotMatch(previewSource, /message\?\.content\?\.trim\?\.\(\)/)
  assert.doesNotMatch(confirmSource, /message\?\.content\?\.trim\?\.\(\)/)
})

testAsync('workflow agent confirmation handoff blocks empty confirmed content before backend supplement', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(confirmSource, /const confirmedContent = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(confirmSource, /if \(!confirmedContent\) \{[\s\S]*setStatus\(skillWorkbenchStatus,\s*'failed',\s*'没有可写入画布的确认内容'\)[\s\S]*return[\s\S]*\}/)
  assert.match(confirmSource, /confirmedContent,/)
  assert.doesNotMatch(confirmSource, /confirmedContent:\s*message\?\.content \|\| ''/)
})

testAsync('workflow agent message actions are scoped by role and status', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const confirmStart = drawerSource.indexOf('function canConfirmMessage')
  const confirmEnd = drawerSource.indexOf('function retryActionLabel', confirmStart)
  const confirmSource = drawerSource.slice(confirmStart, confirmEnd)

  assert.match(drawerSource, /function canRetryMessage\(message\)/)
  assert.match(drawerSource, /function canEditMessage\(message\)/)
  assert.match(drawerSource, /function canConfirmMessage\(message\)/)
  assert.match(drawerSource, /v-if="canRetryMessage\(message\)"/)
  assert.match(drawerSource, /v-if="canEditMessage\(message\)"/)
  assert.match(drawerSource, /v-if="canConfirmMessage\(message\)"/)
  assert.match(drawerSource, /messageRole\(message\) === 'user'/)
  assert.match(drawerSource, /messageRole\(message\) === 'assistant'/)
  assert.match(drawerSource, /messageStatus\(message\) === 'failed' \|\| messageStatus\(message\) === 'cancelled'/)
  assert.doesNotMatch(confirmSource, /shouldShowProviderMeta\(message\)/)
  assert.match(drawerSource, /!isMessageBusy\(message\)/)
})

testAsync('workflow agent confirmed canvas result cannot be confirmed into canvas again', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const confirmStart = drawerSource.indexOf('function canConfirmMessage')
  const confirmEnd = drawerSource.indexOf('function retryActionLabel', confirmStart)
  const confirmSource = drawerSource.slice(confirmStart, confirmEnd)

  assert.match(drawerSource, /function isConfirmCanvasMessage\(message\)/)
  assert.match(confirmSource, /!isConfirmCanvasMessage\(message\)/)
  assert.match(confirmSource, /messageActionStatus\(message\) !== 'failed'/)
  assert.match(confirmSource, /messageActionStatus\(message\) !== 'cancelled'/)
  assert.doesNotMatch(confirmSource, /messageMeta\(message\)\.action/)
  assert.doesNotMatch(confirmSource, /messageMeta\(message\)\.status/)
})

testAsync('workflow agent model metadata hides for canvas confirmation action messages', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const metaItemsStart = drawerSource.indexOf('function messageMetaItems')
  const metaItemsEnd = drawerSource.indexOf('function shouldShowMessageMeta', metaItemsStart)
  const metaItemsSource = drawerSource.slice(metaItemsStart, metaItemsEnd)
  const providerStart = drawerSource.indexOf('function shouldShowProviderMeta')
  const providerEnd = drawerSource.indexOf('function shouldShowUsageMeta', providerStart)
  const providerSource = drawerSource.slice(providerStart, providerEnd)
  const usageStart = drawerSource.indexOf('function shouldShowUsageMeta')
  const usageEnd = drawerSource.indexOf('function shouldShowActionTypeMeta', usageStart)
  const usageSource = drawerSource.slice(usageStart, usageEnd)

  assert.match(providerSource, /return false/)
  assert.match(usageSource, /return false/)
  assert.doesNotMatch(metaItemsSource, /Provider \$\{messageProviderLabel\(message\)\}/)
  assert.doesNotMatch(metaItemsSource, /messageModelLabel\(message,\s*fallbackModel\)/)
  assert.doesNotMatch(providerSource, /messageMeta\(message\)\.action/)
  assert.doesNotMatch(usageSource, /messageMeta\(message\)\.action/)
})

testAsync('workflow agent model usage metadata hides zero token counts', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const usageStart = drawerSource.indexOf('function shouldShowUsageMeta')
  const usageEnd = drawerSource.indexOf('function shouldShowActionTypeMeta', usageStart)
  const usageSource = drawerSource.slice(usageStart, usageEnd)
  const metaItemsStart = drawerSource.indexOf('function messageMetaItems')
  const metaItemsEnd = drawerSource.indexOf('function shouldShowMessageMeta', metaItemsStart)
  const metaItemsSource = drawerSource.slice(metaItemsStart, metaItemsEnd)

  assert.match(usageSource, /return false/)
  assert.match(metaItemsSource, /if \(shouldShowUsageMeta\(message\)\)/)
  assert.match(metaItemsSource, /Tokens \$\{messageUsageTotal\(message\)\}/)
})

testAsync('workflow agent confirmed canvas success does not show regenerate retry action', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const retryStart = drawerSource.indexOf('function canRetryMessage')
  const retryEnd = drawerSource.indexOf('function canEditMessage', retryStart)
  const retrySource = drawerSource.slice(retryStart, retryEnd)

  assert.match(retrySource, /if \(isConfirmCanvasMessage\(message\)\)/)
  assert.match(retrySource, /return status === 'failed' \|\| status === 'cancelled'/)
  const confirmBranchStart = retrySource.indexOf('if (isConfirmCanvasMessage(message))')
  const confirmRetryBranch = retrySource.slice(
    confirmBranchStart,
    retrySource.indexOf('}', confirmBranchStart) + 1
  )
  assert.doesNotMatch(confirmRetryBranch, /status === 'success'/)
})

testAsync('workflow agent composer centralizes send eligibility and trims drafts', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const buttonStart = drawerSource.indexOf('<button class="primary agent-send-button"')
  const buttonEnd = drawerSource.indexOf('</button>', buttonStart)
  const sendButtonSource = drawerSource.slice(buttonStart, buttonEnd)
  const keydownStart = drawerSource.indexOf('function handleComposerKeydown')
  const keydownEnd = drawerSource.indexOf('function focusComposer', keydownStart)
  const keydownSource = drawerSource.slice(keydownStart, keydownEnd)

  assert.match(drawerSource, /function composerDraftText\(\)/)
  assert.match(drawerSource, /function canSubmitComposer\(\)/)
  assert.match(drawerSource, /return props\.input\.trim\(\)/)
  assert.match(sendButtonSource, /:disabled="!canSubmitComposer\(\)"/)
  assert.match(keydownSource, /if \(!canSubmitComposer\(\)\) return/)
  assert.doesNotMatch(sendButtonSource, /input\.trim\(\)/)
  assert.doesNotMatch(keydownSource, /props\.input\.trim\(\)/)
})

testAsync('workflow agent file upload supports reselecting the same failed file', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const importStart = appSource.indexOf('async function importWorkflowAgentFiles')
  const importEnd = appSource.indexOf('async function removeWorkflowAgentReference', importStart)
  const importSource = appSource.slice(importStart, importEnd)
  const triggerStart = drawerSource.indexOf('function triggerUpload')
  const triggerEnd = drawerSource.indexOf('function referenceStatusLabel', triggerStart)
  const triggerSource = drawerSource.slice(triggerStart, triggerEnd)

  assert.match(triggerSource, /fileInput\.value\.value = ''/)
  assert.match(importSource, /finally\s*\{[\s\S]*event\.target\.value = ''/)
  assert.match(importSource, /workflowAgentUploadOpen\.value = false/)
  assert.match(importSource, /const readyCount = uploadedReferences\.filter/)
  assert.match(importSource, /const failedCount = uploadedReferences\.filter/)
  assert.match(importSource, /const pendingCount = uploadedReferences\.filter/)
  assert.match(importSource, /failedCount === files\.length/)
  assert.match(importSource, /部分文件读取失败/)
  assert.match(importSource, /待后端解析/)
  assert.doesNotMatch(importSource, /setStatus\(skillWorkbenchStatus,\s*'success',\s*`已加入 \$\{files\.length\} 个 Agent 参考文件`\)/)
})

testAsync('workflow agent file upload rolls back local references when backend sync fails', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const importStart = appSource.indexOf('async function importWorkflowAgentFiles')
  const importEnd = appSource.indexOf('async function removeWorkflowAgentReference', importStart)
  const importSource = appSource.slice(importStart, importEnd)

  assert.match(importSource, /try\s*\{[\s\S]*await persistWorkflowAgentMessage/)
  assert.match(importSource, /const uploadedReferenceIds = new Set\(uploadedReferences\.map\(\(file\) => file\.id\)\)/)
  assert.match(importSource, /references\.splice\(0,\s*references\.length,\s*\.\.\.references\.filter\(\(file\) => !uploadedReferenceIds\.has\(file\.id\)\)\)/)
  assert.doesNotMatch(importSource, /references\.splice\(startIndex,\s*uploadedReferences\.length\)/)
  assert.match(importSource, /Agent 参考文件同步失败/)
  assert.ok(importSource.indexOf('await persistWorkflowAgentMessage') < importSource.indexOf('if (failedCount === files.length)'))
})

testAsync('workflow agent failed reference cards expose retryable error reason', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const importStart = appSource.indexOf('async function importWorkflowAgentFiles')
  const importEnd = appSource.indexOf('async function removeWorkflowAgentReference', importStart)
  const importSource = appSource.slice(importStart, importEnd)

  assert.match(importSource, /const errorMessage = error\.message \|\| '文件读取失败'/)
  assert.match(importSource, /errorMessage/)
  assert.match(drawerSource, /referenceStatus\(file\) === 'failed'/)
  assert.match(drawerSource, /referenceErrorMessage\(file\)/)
  assert.match(drawerSource, /title="删除后重新上传"/)
})

testAsync('workflow agent reference deletion rolls back when backend sync fails', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const removeStart = appSource.indexOf('async function removeWorkflowAgentReference')
  const removeEnd = appSource.indexOf('async function retrieveWorkflowKnowledge', removeStart)
  const removeSource = appSource.slice(removeStart, removeEnd)

  assert.match(removeSource, /const \[removed\] = references\.splice\(index,\s*1\)/)
  assert.match(removeSource, /try\s*\{[\s\S]*await persistWorkflowAgentMessage/)
  assert.match(removeSource, /catch \(error\)/)
  assert.match(removeSource, /references\.splice\(index,\s*0,\s*removed\)/)
  assert.match(removeSource, /删除参考文件失败/)
})

testAsync('workflow agent cloud document placeholder persists and rolls back on backend sync failure', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const addStart = appSource.indexOf('async function addFeishuReferencePlaceholder')
  const addEnd = appSource.indexOf('async function runWorkflowArtifactAction', addStart)
  const addSource = appSource.slice(addStart, addEnd)

  assert.match(addSource, /async function addFeishuReferencePlaceholder\(\)/)
  assert.match(addSource, /references\.push\(reference\)/)
  assert.match(addSource, /try\s*\{[\s\S]*await persistWorkflowAgentMessage/)
  assert.match(addSource, /content:\s*`已添加云文档引用：\$\{reference\.name\}/)
  assert.match(addSource, /catch \(error\)/)
  assert.match(addSource, /const referenceId = reference\.id/)
  assert.match(addSource, /references\.splice\(0,\s*references\.length,\s*\.\.\.references\.filter\(\(file\) => file\.id !== referenceId\)\)/)
  assert.doesNotMatch(addSource, /references\.splice\(index,\s*1\)/)
  assert.match(addSource, /添加飞书云文档失败/)
})

testAsync('workflow agent request token prevents stale replies and sends retry edit metadata', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const persistStart = appSource.indexOf('async function persistWorkflowAgentMessage')
  const persistEnd = appSource.indexOf('function openWorkflowAgent', persistStart)
  const persistSource = appSource.slice(persistStart, persistEnd)

  assert.match(appSource, /const workflowAgentRequestToken = ref\(''\)/)
  assert.match(appSource, /const workflowAgentDrawerRef = ref\(null\)/)
  assert.match(sendSource, /const requestToken = crypto\.randomUUID\(\)/)
  assert.match(sendSource, /workflowAgentRequestToken\.value = requestToken/)
  assert.match(sendSource, /if \(workflowAgentRequestToken\.value !== requestToken\) return/)
  assert.match(sendSource, /clientMessageId/)
  assert.match(sendSource, /retryOfMessageId/)
  assert.match(sendSource, /editOfMessageId/)
  assert.match(sendSource, /const messageAction = options\.action \|\| \(editOfMessageId \? 'edit-resend' : retryOfMessageId \? 'retry' : 'send'\)/)
  assert.match(sendSource, /action:\s*messageAction/)
  assert.match(sendSource, /workflowAgentDrawerRef\.value\?\.focusComposer\?\.\(\)/)
  assert.match(persistSource, /clientMessageId:\s*message\.clientMessageId/)
  assert.match(persistSource, /retryOfMessageId:\s*message\.retryOfMessageId/)
  assert.match(persistSource, /editOfMessageId:\s*message\.editOfMessageId/)
  assert.match(persistSource, /action:\s*message\.action/)
  assert.match(apiSource, /cancelMessage\(config,\s*runId,\s*payload\s*=\s*\{\}\)/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/messages\/cancel/)
})

testAsync('workflow agent normalizes backend assistant success status before rendering actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)

  assert.match(appSource, /function normalizeWorkflowAgentAssistantMessage\(message,\s*fallbackMeta\s*=\s*\{\}\)/)
  assert.match(appSource, /status:\s*message\.meta\?\.status \|\| 'success'/)
  assert.match(appSource, /statusLabel:\s*message\.meta\?\.statusLabel \|\| workflowAgentStatusLabel\('success'\)/)
  assert.match(sendSource, /const assistantMessage = normalizeWorkflowAgentAssistantMessage\(mergeWorkflowAgentStreamedAssistantMessage\(persisted\.data\.assistantMessage/)
  assert.match(sendSource, /await typeWorkflowAgentAssistantMessage\(pendingMessageId,\s*assistantMessage/)
  assert.match(streamSource, /normalizeWorkflowAgentAssistantMessage\(assistantMessage/)
})

testAsync('workflow agent stop generation replaces current pending message instead of leaving spinner', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function evaluateWorkflowStepQuality', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(appSource, /const workflowAgentPendingMessageId = ref\(''\)/)
  assert.match(appSource, /const workflowAgentStreamController = ref\(null\)/)
  assert.match(sendSource, /workflowAgentPendingMessageId\.value = pendingMessageId/)
  assert.match(sendSource, /workflowAgentStreamController\.value = new AbortController\(\)/)
  assert.match(sendSource, /signal:\s*workflowAgentStreamController\.value\.signal/)
  assert.match(sendSource, /workflowAgentStreamController\.value = null/)
  assert.match(stopSource, /workflowAgentStreamController\.value\?\.abort\?\.\(\)/)
  assert.match(stopSource, /workflowAgentStreamController\.value = null/)
  assert.match(stopSource, /replaceWorkflowAgentMessage\(workflowAgentPendingMessageId\.value,/)
  assert.match(stopSource, /status:\s*'cancelled'/)
  assert.match(stopSource, /已停止生成/)
  assert.match(stopSource, /workflowAgentPendingMessageId\.value = ''/)
  assert.match(sendSource, /workflowAgentPendingMessageId\.value = ''/)
})

testAsync('workflow agent stop generation cancels backend with the pending message client id', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function runWorkflowWorkbenchAction', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(stopSource, /const pendingMessage = workflowAgentPendingMessageId\.value[\s\S]*ensureWorkflowAgentSession\(\)\.find/)
  assert.match(stopSource, /const pendingMeta = pendingMessage\?\.meta \|\| \{\}/)
  assert.match(stopSource, /const clientMessageId = pendingMeta\.clientMessageId \|\| ''/)
  assert.doesNotMatch(stopSource, /const clientMessageId = workflowAgentRequestToken\.value/)
  assert.match(stopSource, /api\.workflows\.cancelMessage\(state\.apiConfig,[\s\S]*clientMessageId/)
})

testAsync('workflow agent stop generation preserves pending confirm canvas retry metadata', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function runWorkflowWorkbenchAction', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(stopSource, /const pendingMeta = pendingMessage\?\.meta \|\| \{\}/)
  assert.match(stopSource, /const clientMessageId = pendingMeta\.clientMessageId \|\| ''/)
  assert.match(stopSource, /retryOfMessageId:\s*pendingMeta\.retryOfMessageId/)
  assert.match(stopSource, /editOfMessageId:\s*pendingMeta\.editOfMessageId/)
  assert.match(stopSource, /action:\s*pendingMeta\.action \|\| 'cancel'/)
  assert.match(stopSource, /confirmedContent:\s*pendingMeta\.confirmedContent/)
  assert.match(stopSource, /nodeId:\s*pendingMeta\.nodeId/)
})

testAsync('workflow agent failed send keeps sent text in chat and clears composer while stop restores draft', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function runWorkflowWorkbenchAction', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(appSource, /const workflowAgentActiveDraft = ref\(''\)/)
  assert.match(sendSource, /workflowAgentActiveDraft\.value = content/)
  assert.match(sendSource, /clearWorkflowAgentActiveDraft\(\)/)
  assert.match(stopSource, /restoreWorkflowAgentActiveDraft\(\)/)
  assert.doesNotMatch(sendSource, /catch \(error\)[\s\S]*restoreWorkflowAgentActiveDraft\(\)/)
  assert.match(appSource, /function restoreWorkflowAgentActiveDraft\(\) \{[\s\S]*if \(!workflowAgentInput\.value\) workflowAgentInput\.value = workflowAgentActiveDraft\.value[\s\S]*clearWorkflowAgentActiveDraft\(\)[\s\S]*\}/)
  assert.match(appSource, /function clearWorkflowAgentActiveDraft\(\) \{[\s\S]*workflowAgentActiveDraft\.value = ''[\s\S]*workflowAgentActiveDraftMeta\.value = \{\}[\s\S]*\}/)
})

testAsync('workflow agent failed or stopped edit retry send restores draft metadata', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function runWorkflowWorkbenchAction', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(appSource, /const workflowAgentActiveDraftMeta = ref\(\{\}\)/)
  assert.match(sendSource, /workflowAgentActiveDraftMeta\.value = \{[\s\S]*editOfMessageId,[\s\S]*retryOfMessageId,[\s\S]*retryTargetMessageId:[\s\S]*\}/)
  assert.match(sendSource, /clearWorkflowAgentActiveDraft\(\)/)
  assert.match(stopSource, /restoreWorkflowAgentActiveDraft\(\)/)
  assert.match(appSource, /function restoreWorkflowAgentActiveDraft\(\) \{[\s\S]*restoreWorkflowAgentDraftState\(workflowAgentActiveDraftMeta\.value\)[\s\S]*clearWorkflowAgentActiveDraft\(\)[\s\S]*\}/)
  assert.match(appSource, /function clearWorkflowAgentActiveDraft\(\) \{[\s\S]*workflowAgentActiveDraftMeta\.value = \{\}[\s\S]*\}/)
  assert.match(appSource, /function restoreWorkflowAgentDraftState\(draftMeta = \{\}\)/)
  assert.match(appSource, /workflowAgentEditingMessageId\.value = draftMeta\.editOfMessageId \|\| ''/)
  assert.match(appSource, /workflowAgentRetryMessageId\.value = draftMeta\.retryOfMessageId \|\| ''/)
  assert.match(appSource, /workflowAgentRetryTargetMessageId\.value = draftMeta\.retryTargetMessageId \|\| ''/)
})

testAsync('workflow agent request cleanup centralizes active draft restore and clear paths', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function runWorkflowWorkbenchAction', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(appSource, /function restoreWorkflowAgentActiveDraft\(\)/)
  assert.match(appSource, /function clearWorkflowAgentActiveDraft\(\)/)
  assert.match(sendSource, /clearWorkflowAgentActiveDraft\(\)/)
  assert.match(stopSource, /restoreWorkflowAgentActiveDraft\(\)/)
  assert.match(sendSource, /clearWorkflowAgentActiveDraft\(\)/)
  assert.match(appSource, /function restoreWorkflowAgentActiveDraft\(\) \{[\s\S]*clearWorkflowAgentActiveDraft\(\)[\s\S]*\}/)
  assert.doesNotMatch(sendSource, /workflowAgentActiveDraft\.value = ''[\s\S]*workflowAgentActiveDraftMeta\.value = \{\}/)
  assert.doesNotMatch(stopSource, /workflowAgentActiveDraft\.value = ''[\s\S]*workflowAgentActiveDraftMeta\.value = \{\}/)
})

testAsync('workflow agent copy message falls back when clipboard api is unavailable', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const copyStart = appSource.indexOf('async function copyWorkflowAgentMessage')
  const copyEnd = appSource.indexOf('function retryWorkflowAgentMessage', copyStart)
  const copySource = appSource.slice(copyStart, copyEnd)

  assert.match(appSource, /async function copyTextToClipboard\(text = ''\)/)
  assert.match(copySource, /navigator\?\.clipboard\?\.writeText/)
  assert.match(copySource, /document\.createElement\('textarea'\)/)
  assert.match(copySource, /document\.body\.appendChild\(textarea\)/)
  assert.match(copySource, /document\.execCommand\('copy'\)/)
  assert.match(copySource, /document\.body\.removeChild\(textarea\)/)
  assert.match(copySource, /await copyTextToClipboard\(text\)/)
})

testAsync('workflow agent copy message blocks empty content before clipboard write', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const copyStart = appSource.indexOf('async function copyWorkflowAgentMessage')
  const copyEnd = appSource.indexOf('async function copyTextToClipboard', copyStart)
  const copySource = appSource.slice(copyStart, copyEnd)

  assert.match(copySource, /const text = workflowAgentMessageText\(message\)\.trim\(\)/)
  assert.match(copySource, /if \(!text\) \{[\s\S]*setStatus\(skillWorkbenchStatus,\s*'failed',\s*'没有可复制的消息内容'\)[\s\S]*return[\s\S]*\}/)
  assert.match(copySource, /await copyTextToClipboard\(text\)/)
  assert.doesNotMatch(copySource, /await copyTextToClipboard\(message\?\.content \|\| ''\)/)
})

testAsync('workflow agent stop generation tolerates backend cancel failures', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function evaluateWorkflowStepQuality', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(stopSource, /try\s*\{[\s\S]*api\.workflows\.cancelMessage/)
  assert.match(stopSource, /catch \(error\)/)
  assert.match(stopSource, /let cancelFailed = false/)
  assert.match(stopSource, /cancelFailed = true/)
  assert.match(stopSource, /if \(!cancelFailed\) setStatus/)
  assert.match(stopSource, /取消请求未完成/)
  assert.match(stopSource, /workflowAgentSending\.value = false/)
  assert.match(stopSource, /workflowAgentPendingMessageId\.value = ''/)
})

testAsync('workflow agent normal stop generation does not mark global status as failed', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function evaluateWorkflowStepQuality', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)
  const normalStopStart = stopSource.indexOf('if (!cancelFailed) setStatus')
  const normalStopSource = stopSource.slice(normalStopStart, stopSource.indexOf('workflowAgentDrawerRef.value', normalStopStart))

  assert.match(normalStopSource, /setStatus\(skillWorkbenchStatus,\s*'success',\s*'已停止生成，迟到回复不会写入当前会话'\)/)
  assert.doesNotMatch(normalStopSource, /setStatus\(skillWorkbenchStatus,\s*'failed',\s*'已停止生成/)
  assert.match(stopSource, /setStatus\(skillWorkbenchStatus,\s*'failed',\s*error\.message \? `取消请求未完成/)
})

testAsync('workflow agent stop generation no-ops when there is no pending message', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const stopStart = appSource.indexOf('async function stopWorkflowAgentGeneration')
  const stopEnd = appSource.indexOf('function runWorkflowWorkbenchAction', stopStart)
  const stopSource = appSource.slice(stopStart, stopEnd)

  assert.match(stopSource, /if \(!workflowAgentPendingMessageId\.value\) \{[\s\S]*workflowAgentStreamController\.value\?\.abort\?\.\(\)[\s\S]*workflowAgentStreamController\.value = null[\s\S]*workflowAgentRequestToken\.value = ''[\s\S]*workflowAgentSending\.value = false[\s\S]*restoreWorkflowAgentActiveDraft\(\)[\s\S]*workflowAgentDrawerRef\.value\?\.focusComposer\?\.\(\)[\s\S]*return[\s\S]*\}/)
  assert.ok(stopSource.indexOf('if (!workflowAgentPendingMessageId.value)') < stopSource.indexOf('api.workflows.cancelMessage'))
  const guardSource = stopSource.slice(
    stopSource.indexOf('if (!workflowAgentPendingMessageId.value)'),
    stopSource.indexOf('}', stopSource.indexOf('if (!workflowAgentPendingMessageId.value)')) + 1
  )
  assert.doesNotMatch(guardSource, /api\.workflows\.cancelMessage/)
  assert.doesNotMatch(guardSource, /setStatus\(skillWorkbenchStatus,\s*'failed'/)
})

testAsync('workflow agent stream api passes abort signal to fetch', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const requestStart = apiSource.indexOf('async function requestSse')
  const requestEnd = apiSource.indexOf('export const api', requestStart)
  const requestSource = apiSource.slice(requestStart, requestEnd)
  const streamStart = apiSource.indexOf('appendMessageStream(config, runId, stepId, payload')
  const streamEnd = apiSource.indexOf('cancelMessage(config', streamStart)
  const streamSource = apiSource.slice(streamStart, streamEnd)

  assert.match(requestSource, /signal:\s*options\.signal/)
  assert.match(streamSource, /signal:\s*options\.signal/)
})

testAsync('workflow agent frontend sse reader cancels body stream on abort', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const requestStart = apiSource.indexOf('async function requestSse')
  const requestEnd = apiSource.indexOf('export const api', requestStart)
  const requestSource = apiSource.slice(requestStart, requestEnd)

  assert.match(requestSource, /const cancelReader = \(\) =>/)
  assert.match(requestSource, /options\.signal\?\.addEventListener\?\.\('abort',\s*cancelReader,\s*\{\s*once:\s*true\s*\}\)/)
  assert.match(requestSource, /reader\.cancel\?\.\(\)/)
  assert.match(requestSource, /options\.signal\?\.removeEventListener\?\.\('abort',\s*cancelReader\)/)
  assert.match(requestSource, /if \(cancelled \|\| options\.signal\?\.aborted\) return \{ ok: false,\s*status: 'cancelled'/)
})

testAsync('workflow agent aborted stream does not fallback to non streaming message request', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const requestStart = apiSource.indexOf('async function requestSse')
  const requestEnd = apiSource.indexOf('export const api', requestStart)
  const requestSource = apiSource.slice(requestStart, requestEnd)
  const streamStart = apiSource.indexOf('appendMessageStream(config, runId, stepId, payload')
  const streamEnd = apiSource.indexOf('cancelMessage(config', streamStart)
  const streamSource = apiSource.slice(streamStart, streamEnd)

  assert.match(requestSource, /error\.name === 'AbortError'/)
  assert.match(requestSource, /status:\s*'cancelled'/)
  assert.match(requestSource, /message:\s*'流式请求已停止'/)
  assert.match(streamSource, /if \(streamed\.status === 'cancelled'\) return streamed/)
  assert.match(streamSource, /if \(streamed\.ok\) return streamed/)
  assert.match(streamSource, /return api\.workflows\.appendMessage\(config,\s*runId,\s*stepId,\s*payload\)/)
})

testAsync('workflow agent stream request has timeout and converts timeout into failed card', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const requestStart = apiSource.indexOf('async function requestSse')
  const requestEnd = apiSource.indexOf('export const api', requestStart)
  const requestSource = apiSource.slice(requestStart, requestEnd)
  const streamStart = apiSource.indexOf('appendMessageStream(config, runId, stepId, payload')
  const streamEnd = apiSource.indexOf('cancelMessage(config', streamStart)
  const streamSource = apiSource.slice(streamStart, streamEnd)
  const persistStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const persistEnd = appSource.indexOf('function openWorkflowAgent', persistStart)
  const persistSource = appSource.slice(persistStart, persistEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(requestSource, /const timeoutMs = options\.timeoutMs \|\| 90000/)
  assert.match(requestSource, /const timer = setTimeout\(\(\) => \{[\s\S]*timedOut = true[\s\S]*controller\.abort\(\)[\s\S]*\}, timeoutMs\)/)
  assert.match(requestSource, /clearTimeout\(timer\)/)
  assert.match(requestSource, /message:\s*'Agent 生成超时，请稍后重试或缩短问题后再试'/)
  assert.match(streamSource, /timeoutMs:\s*options\.timeoutMs \|\| 210000/)
  assert.match(streamSource, /if \(streamed\.status === 'failed'\) return streamed/)
  assert.match(persistSource, /timeoutMs:\s*options\.timeoutMs/)
  assert.match(sendSource, /timeoutMs:\s*workflowAgentRequestTimeoutMs\(\)/)
})

testAsync('workflow agent confirm proposal stream api exposes progress events and fallback', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStreamStart = apiSource.indexOf('confirmProposalStream(config, runId, proposalId')
  const confirmStreamEnd = apiSource.indexOf('completeRun(config', confirmStreamStart)
  const confirmStreamSource = apiSource.slice(confirmStreamStart, confirmStreamEnd)
  const confirmStart = appSource.indexOf('async function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(confirmStreamSource, /requestSse\(config\.apiBaseUrl/)
  assert.match(confirmStreamSource, /\/agent-proposals\/\$\{encodeURIComponent\(proposalId\)\}\/confirm\/stream/)
  assert.match(confirmStreamSource, /onEvent:\s*options\.onEvent/)
  assert.match(confirmStreamSource, /timeoutMs:\s*options\.timeoutMs \|\| 210000/)
  assert.match(confirmStreamSource, /return api\.workflows\.confirmProposal\(config,\s*runId,\s*proposalId,\s*payload,\s*options\)/)
  assert.match(confirmSource, /api\.workflows\.confirmProposalStream/)
  assert.match(confirmSource, /event\.type === 'status'/)
  assert.match(confirmSource, /progressStep:\s*event\.data\?\.step/)
  assert.match(confirmSource, /replaceWorkflowAgentMessage\(pendingMessageId,\s*\{/)
})

testAsync('workflow agent confirm proposal stream error event replaces pending confirm card', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const confirmStart = appSource.indexOf('async function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(confirmSource, /const confirmStreamEventState = \{ failed: false \}/)
  assert.match(confirmSource, /if \(confirmStreamEventState\.failed && event\.type !== 'done'\) return/)
  assert.match(confirmSource, /if \(event\.type === 'error' && pendingMessageId\)/)
  assert.match(confirmSource, /confirmStreamEventState\.failed = true/)
  assert.match(confirmSource, /workflowAgentConfirmFailureContent\(event\.data/)
  assert.match(confirmSource, /status:\s*'failed'/)
  assert.match(confirmSource, /action:\s*'confirm-canvas'/)
  assert.match(confirmSource, /proposalId/)
  assert.match(confirmSource, /confirmedContent/)
  assert.match(confirmSource, /nodeId:\s*targetNodeId/)
  assert.match(confirmSource, /recoveryActions:\s*\[/)
  assert.match(confirmSource, /if \(confirmStreamEventState\.failed\) return/)
})

testAsync('workflow agent stream error event replaces pending message with failed card', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)

  assert.match(streamSource, /if \(event\.type === 'error' && options\.pendingMessageId\)/)
  assert.match(streamSource, /replaceWorkflowAgentMessage\(options\.pendingMessageId,\s*\{[\s\S]*status:\s*'failed'/)
  assert.match(streamSource, /event\.data\?\.message \|\| 'Agent 流式生成失败'/)
  assert.match(streamSource, /error:\s*\{\s*message:/)
})

testAsync('workflow agent non stream failure card includes status label', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const catchStart = sendSource.indexOf('} catch (error) {')
  const catchEnd = sendSource.indexOf('} finally {', catchStart)
  const catchSource = sendSource.slice(catchStart, catchEnd)

  assert.match(catchSource, /status:\s*'failed'/)
  assert.match(catchSource, /statusLabel:\s*workflowAgentStatusLabel\('failed'\)/)
  assert.match(catchSource, /error:\s*\{/)
})

testAsync('workflow agent failed message renders backend recovery actions', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const errorStart = drawerSource.indexOf('function messageErrorText')
  const errorEnd = drawerSource.indexOf('function messageKnowledgeRetrievalError', errorStart)
  const errorSource = drawerSource.slice(errorStart, errorEnd)
  const templateStart = drawerSource.indexOf('<div v-if="messageRecoveryActions(message).length" class="agent-recovery-actions">')
  const templateEnd = drawerSource.indexOf('</div>', templateStart)
  const templateSource = drawerSource.slice(templateStart, templateEnd)

  assert.match(errorSource, /recoveryActions/)
  assert.match(errorSource, /new Set/)
  assert.match(templateSource, /messageRecoveryActions\(message\)/)
  assert.match(templateSource, /\$emit\('recovery-action',\s*message,\s*action\)/)
})

testAsync('workflow agent failed confirm card exposes recovery actions as explicit buttons', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const templateStart = drawerSource.indexOf('<div v-if="messageRecoveryActions(message).length" class="agent-recovery-actions">')
  const templateEnd = drawerSource.indexOf('<div v-if="messageConfirmProgressSteps(message).length"', templateStart)
  const templateSource = drawerSource.slice(templateStart, templateEnd)
  const recoveryStart = drawerSource.indexOf('function messageRecoveryActions')
  const recoveryEnd = drawerSource.indexOf('function messageKnowledgeRetrievalError', recoveryStart)
  const recoverySource = drawerSource.slice(recoveryStart, recoveryEnd)
  const appTemplateStart = appSource.indexOf('<WorkflowAgentDrawer')
  const appTemplateEnd = appSource.indexOf('</WorkflowAgentDrawer>', appTemplateStart)
  const appTemplateSource = appSource.slice(appTemplateStart, appTemplateEnd)
  const handlerStart = appSource.indexOf('function recoverWorkflowAgentMessage')
  const handlerEnd = appSource.indexOf('function editWorkflowAgentMessage', handlerStart)
  const handlerSource = appSource.slice(handlerStart, handlerEnd)

  assert.match(drawerSource, /'recovery-action'/)
  assert.match(templateSource, /messageRecoveryActions\(message\)/)
  assert.match(templateSource, /\$emit\('recovery-action',\s*message,\s*action\)/)
  assert.match(recoverySource, /error\.recoveryActions/)
  assert.match(recoverySource, /new Set/)
  assert.match(appTemplateSource, /@recovery-action="recoverWorkflowAgentMessage"/)
  assert.match(handlerSource, /action === '重试确认'/)
  assert.match(handlerSource, /confirmWorkflowAgentMessage/)
  assert.match(handlerSource, /action === '重新生成建议'/)
  assert.match(handlerSource, /retryInvalidWorkflowAgentPatch/)
})

testAsync('workflow agent keeps stream error failed card after done event without assistant message', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(streamSource, /const streamEventState = options\.streamEventState/)
  assert.match(streamSource, /streamEventState\.failed = true/)
  assert.match(sendSource, /const streamEventState = \{\s*failed:\s*false\s*\}/)
  assert.match(sendSource, /streamEventState,/)
  assert.match(sendSource, /if \(streamEventState\.failed\) \{[\s\S]*workflowAgentPendingMessageId\.value = ''[\s\S]*clearWorkflowAgentActiveDraft\(\)[\s\S]*return/)
  assert.match(sendSource, /const backendHandled = Boolean\(persisted\?\.ok && persisted\.data\?\.assistantMessage\)/)
})

testAsync('workflow agent ignores late stream delta and message events after an error', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const eventHandlerStart = streamSource.indexOf('onEvent: (event) =>')
  const eventHandlerEnd = streamSource.indexOf('signal: options.signal', eventHandlerStart)
  const eventHandlerSource = streamSource.slice(eventHandlerStart, eventHandlerEnd)
  const guardIndex = eventHandlerSource.indexOf("if (streamEventState?.failed && event.type !== 'done') return")

  assert.match(eventHandlerSource, /if \(streamEventState\?\.failed && event\.type !== 'done'\) return/)
  assert.ok(guardIndex >= 0 && guardIndex < eventHandlerSource.indexOf("if (event.type === 'delta'"))
  assert.ok(guardIndex >= 0 && guardIndex < eventHandlerSource.indexOf("if (event.type === 'message'"))
  assert.ok(eventHandlerSource.indexOf("if (event.type === 'error'") < eventHandlerSource.indexOf("if (event.type === 'done'"))
})

testAsync('frontend sse request treats done error payload as failed result', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const requestStart = apiSource.indexOf('async function requestSse')
  const requestEnd = apiSource.indexOf('export const api', requestStart)
  const requestSource = apiSource.slice(requestStart, requestEnd)

  assert.match(requestSource, /if \(done\?\.error\) \{/)
  assert.match(requestSource, /ok:\s*false/)
  assert.match(requestSource, /status:\s*'failed'/)
  assert.match(requestSource, /message:\s*done\.error\.message/)
})

testAsync('workflow agent stream error keeps failed card and clears active draft', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const streamFailedStart = sendSource.indexOf('if (streamEventState.failed)')
  const streamFailedEnd = sendSource.indexOf('const backendHandled = Boolean', streamFailedStart)
  const streamFailedSource = sendSource.slice(streamFailedStart, streamFailedEnd)

  assert.match(streamFailedSource, /clearWorkflowAgentActiveDraft\(\)/)
  assert.doesNotMatch(streamFailedSource, /if \(!workflowAgentInput\.value\) workflowAgentInput\.value = workflowAgentActiveDraft\.value/)
  assert.doesNotMatch(streamFailedSource, /restoreWorkflowAgentDraftState\(workflowAgentActiveDraftMeta\.value\)/)
  assert.doesNotMatch(streamFailedSource, /restoreWorkflowAgentActiveDraft\(\)/)
})

testAsync('workflow agent delta events append content to the pending assistant bubble', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)

  assert.match(streamSource, /let streamedContent = ''/)
  assert.match(streamSource, /if \(event\.type === 'delta' && options\.pendingMessageId\)/)
  assert.match(streamSource, /streamedContent \+= event\.data\?\.content \|\| event\.data\?\.text \|\| ''/)
  assert.match(streamSource, /content:\s*workflowAgentStreamDisplayContent\(streamedContent\)/)
  assert.match(streamSource, /status:\s*'generating'/)
})

testAsync('workflow agent final stream message preserves longer streamed content instead of replacing it with a shorter summary', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(appSource, /function mergeWorkflowAgentStreamedAssistantMessage\(/)
  assert.match(appSource, /function workflowAgentMessageById\(/)
  assert.match(streamSource, /mergeWorkflowAgentStreamedAssistantMessage\(event\.data\.assistantMessage,\s*streamedContent/)
  assert.match(sendSource, /const currentPendingMessage = workflowAgentMessageById\(pendingMessageId\)/)
  assert.match(sendSource, /mergeWorkflowAgentStreamedAssistantMessage\(persisted\.data\.assistantMessage,\s*workflowAgentMessageText\(currentPendingMessage\)/)
  assert.doesNotMatch(streamSource, /replaceWorkflowAgentMessage\(options\.pendingMessageId,\s*normalizeWorkflowAgentAssistantMessage\(event\.data\.assistantMessage/)
})

testAsync('workflow agent structured json stream shows a stable writing status and uses final assistant content', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(appSource, /function isWorkflowAgentStructuredStreamContent\(/)
  assert.match(appSource, /function workflowAgentStreamDisplayContent\(/)
  assert.match(streamSource, /content:\s*workflowAgentStreamDisplayContent\(streamedContent\)/)
  assert.match(appSource, /正在整理结构化建议/)
  assert.match(appSource, /if \(isWorkflowAgentStructuredStreamContent\(visibleContent\)\) return normalized/)
  assert.match(sendSource, /mergeWorkflowAgentStreamedAssistantMessage\(persisted\.data\.assistantMessage,\s*workflowAgentMessageText\(currentPendingMessage\)/)
})

testAsync('workflow agent non streaming replies type into the pending bubble and scroll down', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const typeStart = appSource.indexOf('async function typeWorkflowAgentAssistantMessage')
  const typeEnd = appSource.indexOf('function openWorkflowAgent', typeStart)
  const typeSource = appSource.slice(typeStart, typeEnd)
  const watchStart = drawerSource.indexOf('watch(')
  const watchSource = drawerSource.slice(watchStart)

  assert.match(appSource, /async function typeWorkflowAgentAssistantMessage\(messageId,\s*assistantMessage,\s*options = \{\}\)/)
  assert.match(typeSource, /const fullContent = workflowAgentMessageText\(assistantMessage\)/)
  assert.match(typeSource, /content:\s*fullContent\.slice\(0,\s*index\)/)
  assert.match(typeSource, /await wait\(options\.delayMs \?\? 12\)/)
  assert.match(typeSource, /status:\s*'generating'/)
  assert.match(typeSource, /status:\s*assistantMessage\.meta\?\.status \|\| 'success'/)
  assert.match(typeSource, /scrollWorkflowAgentToBottomTick\(\)/)
  assert.match(sendSource, /await typeWorkflowAgentAssistantMessage\(pendingMessageId,\s*assistantMessage/)
  assert.doesNotMatch(sendSource, /replaceWorkflowAgentMessage\(pendingMessageId,\s*assistantMessage\)/)
  assert.match(drawerSource, /function scrollAgentChatToBottom\(behavior = 'smooth'\)/)
  assert.match(watchSource, /\(\) => visibleMessages\.value\.map\(\(message\) => messageContent\(message\)\)\.join\('\\n---\\n'\)/)
  assert.match(watchSource, /scrollAgentChatToBottom\('auto'\)/)
})

testAsync('workflow agent backend cancelled result stops local fallback actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(sendSource, /const backendCancelled = Boolean\(persisted\?\.data\?\.cancelled/)
  assert.match(sendSource, /if \(backendCancelled\) \{[\s\S]*status:\s*'cancelled'/)
  assert.match(sendSource, /if \(backendCancelled\) \{[\s\S]*return/)
  assert.match(sendSource, /const backendHandled = Boolean\(persisted\?\.ok && persisted\.data\?\.assistantMessage\)/)
})

testAsync('workflow agent messages retrieve project knowledge before backend handoff', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const agentServiceSource = await readFile(new URL('../后端/services/agent-service.js', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const retrieveStart = appSource.indexOf('async function retrieveWorkflowKnowledge')
  const retrieveEnd = appSource.indexOf('async function persistWorkflowAgentMessage', retrieveStart)
  const retrieveSource = appSource.slice(retrieveStart, retrieveEnd)
  const persistStart = appSource.indexOf('async function persistWorkflowAgentMessage')
  const persistEnd = appSource.indexOf('function openWorkflowAgent', persistStart)
  const persistSource = appSource.slice(persistStart, persistEnd)

  assert.match(retrieveSource, /api\.workspace\.searchMaterials\(state\.apiConfig/)
  assert.match(retrieveSource, /projectId:\s*state\.currentProjectId/)
  assert.match(retrieveSource, /const roleScope = roleScopes\.includes\(scopeId\) \? scopeId : 'ai-retrieval'/)
  assert.match(retrieveSource, /roleScope,\s*\n/)
  assert.match(persistSource, /Array\.isArray\(options\.retrievedKnowledge\)/)
  assert.match(persistSource, /await retrieveWorkflowKnowledge\(workflowAgentMessageText\(message\),\s*scopeId\)/)
  assert.match(persistSource, /retrievedKnowledge,/)
  assert.match(agentServiceSource, /projectId:\s*item\.projectId/)
  assert.match(agentServiceSource, /projectName:\s*item\.projectName/)
  assert.match(agentServiceSource, /sourceTitle:\s*item\.sourceTitle/)
  assert.match(agentServiceSource, /materialType:\s*item\.materialType/)
  assert.match(agentServiceSource, /sourceType:\s*item\.sourceType/)
  assert.match(agentServiceSource, /sourceUrl:\s*item\.sourceUrl/)
  assert.match(agentServiceSource, /roleScopes:\s*item\.roleScopes/)
  assert.match(agentServiceSource, /matchReason:/)
  assert.match(drawerSource, /details[\s\S]*class="agent-knowledge-evidence"/)
  assert.match(drawerSource, /来源标题/)
  assert.match(drawerSource, /所属项目/)
  assert.match(drawerSource, /资料类型/)
  assert.match(drawerSource, /命中片段/)
  assert.match(drawerSource, /命中原因/)
  assert.match(drawerSource, /knowledgeSourceTitle\(item\)/)
  assert.match(drawerSource, /knowledgeProjectLabel\(item\)/)
  assert.match(drawerSource, /knowledgeMaterialTypeLabel\(item\)/)
  assert.match(drawerSource, /knowledgeTitle\(item,\s*index\)/)
  assert.match(drawerSource, /knowledgeSnippet\(item\)/)
  assert.match(drawerSource, /knowledgeMatchReason\(item\)/)
  assert.match(cssSource, /\.agent-knowledge-card/)
  assert.match(cssSource, /\.agent-knowledge-snippet/)
  assert.match(cssSource, /\.agent-knowledge-meta-grid/)
})

testAsync('workflow agent pending status explains retrieval generation and canvas merge phases', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(appSource, /function workflowAgentStatusLabel\(status/)
  assert.match(appSource, /replaceWorkflowAgentMessage\(pendingMessageId,\s*\{[\s\S]*status:\s*'retrieving'/)
  assert.match(appSource, /replaceWorkflowAgentMessage\(pendingMessageId,\s*\{[\s\S]*status:\s*'generating'/)
  assert.match(appSource, /replaceWorkflowAgentMessage\(pendingMessageId,\s*\{[\s\S]*status:\s*'merging-canvas'/)
  assert.match(sendSource, /const knowledgeResult = await retrieveWorkflowKnowledge\(content,\s*workflowAgentScopeId\(\)\)/)
  assert.match(sendSource, /const retrievedKnowledge = knowledgeResult\.items/)
  assert.match(sendSource, /persistWorkflowAgentMessageStream\(\{[\s\S]*\},\s*pendingStreamOptions\)/)
  assert.match(sendSource, /const pendingStreamOptions = \{[\s\S]*retrievedKnowledge,[\s\S]*pendingMessageId,[\s\S]*requestToken,[\s\S]*signal:\s*workflowAgentStreamController\.value\.signal[\s\S]*\}/)
  assert.match(drawerSource, /function messageStatusLabel\(message\)/)
  assert.match(drawerSource, /检索知识/)
  assert.match(drawerSource, /生成回复/)
  assert.match(drawerSource, /合并画布/)
  assert.match(drawerSource, /messageStatusLabel\(message\)/)
  assert.match(drawerSource, /isMessageBusy\(message\)/)
  assert.match(styles, /\.agent-status-chip/)
})

testAsync('workflow agent distinguishes knowledge retrieval failure from empty results', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const retrieveStart = appSource.indexOf('async function retrieveWorkflowKnowledge')
  const retrieveEnd = appSource.indexOf('function workflowAgentStatusLabel', retrieveStart)
  const retrieveSource = appSource.slice(retrieveStart, retrieveEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')

  assert.match(retrieveSource, /return \{\s*items:\s*result\.data\.results/)
  assert.match(retrieveSource, /return \{\s*items:\s*\[\],\s*error:/)
  assert.match(sendSource, /const knowledgeResult = await retrieveWorkflowKnowledge\(content,\s*workflowAgentScopeId\(\)\)/)
  assert.match(sendSource, /const retrievedKnowledge = knowledgeResult\.items/)
  assert.match(sendSource, /knowledgeResult\.error\s*\?\s*'知识检索失败，正在基于当前画布生成回复\.\.\.'/)
  assert.match(sendSource, /knowledgeRetrievalError:\s*knowledgeResult\.error/)
  assert.match(sendSource, /knowledgeRetrievalError:\s*knowledgeResult\.error/)
  assert.match(sendSource, /const pendingStreamOptions = \{[\s\S]*knowledgeRetrievalError:\s*knowledgeResult\.error/)
  assert.match(appSource, /context:\s*workflowAgentRequestContext\(\{[\s\S]*knowledgeRetrievalError:\s*options\.knowledgeRetrievalError/)
  assert.match(drawerSource, /messageMeta\(message\)\.knowledgeRetrievalError/)
})

testAsync('workflow agent knowledge evidence cards use stable keys for duplicate titles', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const evidenceStart = drawerSource.indexOf('class="agent-knowledge-evidence"')
  const evidenceEnd = drawerSource.indexOf('</details>', evidenceStart)
  const evidenceSource = drawerSource.slice(evidenceStart, evidenceEnd)

  assert.match(evidenceSource, /v-for="\(\s*item,\s*index\s*\) in messageKnowledgeItems\(message\)"/)
  assert.match(evidenceSource, /:key="knowledgeEvidenceKey\(item,\s*index\)"/)
  assert.match(drawerSource, /function knowledgeEvidenceKey\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /item\.id \|\| item\.materialId \|\| item\.sourceUrl \|\| item\.sourceTitle \|\| item\.title/)
  assert.doesNotMatch(evidenceSource, /:key="item\.title"/)
})

testAsync('workflow agent knowledge evidence tolerates malformed retrieved knowledge metadata', async () => {
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const metaStart = drawerSource.indexOf('class="agent-message-meta"')
  const metaEnd = drawerSource.indexOf('</div>', metaStart)
  const metaSource = drawerSource.slice(metaStart, metaEnd)
  const evidenceStart = drawerSource.indexOf('class="agent-knowledge-evidence"')
  const evidenceEnd = drawerSource.indexOf('</details>', evidenceStart)
  const evidenceSource = drawerSource.slice(drawerSource.lastIndexOf('<details', evidenceStart), evidenceEnd)
  const helperStart = drawerSource.indexOf('function messageKnowledgeItems')
  const helperEnd = drawerSource.indexOf('function knowledgeSourceLabel', helperStart)
  const helperSource = drawerSource.slice(helperStart, helperEnd)
  const showMetaStart = drawerSource.indexOf('function shouldShowMessageMeta')
  const showMetaEnd = drawerSource.indexOf('function shouldShowProviderMeta', showMetaStart)
  const showMetaSource = drawerSource.slice(showMetaStart, showMetaEnd)
  const metaItemsStart = drawerSource.indexOf('function messageMetaItems')
  const metaItemsEnd = drawerSource.indexOf('function shouldShowMessageMeta', metaItemsStart)
  const metaItemsSource = drawerSource.slice(metaItemsStart, metaItemsEnd)

  assert.match(drawerSource, /function messageKnowledgeItems\(message = \{\}\)/)
  assert.match(drawerSource, /function messageKnowledgeItemsRaw\(message\)/)
  assert.match(helperSource, /messageKnowledgeItemsRaw\(message\)\.filter\(isPlainRecord\)/)
  assert.match(helperSource, /return \[\]/)
  assert.match(metaSource, /messageMetaItems\(message,\s*model\)/)
  assert.match(drawerSource, /const knowledgeCount = messageKnowledgeItems\(message\)\.length/)
  assert.match(evidenceSource, /v-if="messageKnowledgeItems\(message\)\.length"/)
  assert.match(evidenceSource, /messageKnowledgeItems\(message\)\.length/)
  assert.match(evidenceSource, /v-for="\(\s*item,\s*index\s*\) in messageKnowledgeItems\(message\)"/)
  assert.match(evidenceSource, /knowledgeTitle\(item,\s*index\)/)
  assert.match(evidenceSource, /knowledgeSnippet\(item\)/)
  assert.match(evidenceSource, /knowledgeMatchReason\(item\)/)
  assert.match(drawerSource, /function knowledgeTitle\(item = \{\},\s*index = 0\)/)
  assert.match(drawerSource, /function knowledgeSnippet\(item = \{\}\)/)
  assert.match(drawerSource, /function knowledgeMatchReason\(item = \{\}\)/)
  assert.match(metaItemsSource, /messageKnowledgeItems\(message\)\.length/)
  assert.match(showMetaSource, /messageMetaItems\(message\)\.length > 0/)
  assert.doesNotMatch(evidenceSource, /message\.meta\?\.retrievedKnowledge\?\.length/)
  assert.doesNotMatch(evidenceSource, /message\.meta\.retrievedKnowledge/)
  assert.doesNotMatch(evidenceSource, /item\.title/)
  assert.doesNotMatch(evidenceSource, /item\.snippet/)
  assert.doesNotMatch(evidenceSource, /item\.matchReason/)
})

testAsync('workflow agent stream progress keeps retrieved knowledge metadata while generating', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function openWorkflowAgent', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)

  assert.match(streamSource, /await retrieveWorkflowKnowledge\(workflowAgentMessageText\(message\),\s*scopeId\)/)
  assert.match(streamSource, /retrievedKnowledge,/)
  assert.match(streamSource, /knowledgeRetrievalError:\s*options\.knowledgeRetrievalError/)
  assert.match(streamSource, /status:\s*event\.data\?\.status \|\| 'generating'[\s\S]*retrievedKnowledge,[\s\S]*knowledgeRetrievalError:\s*options\.knowledgeRetrievalError/)
  assert.match(streamSource, /status:\s*'generating'[\s\S]*retrievedKnowledge,[\s\S]*knowledgeRetrievalError:\s*options\.knowledgeRetrievalError/)
})

testAsync('frontend api exposes backend material and restored page resource contracts', async () => {
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(apiSource, /importWebsiteMaterials\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/materials\/import-website/)
  assert.match(apiSource, /searchMaterials\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/materials\/search/)
  assert.match(apiSource, /listMaterials\(config,\s*payload\s*=\s*\{\}\)/)
  assert.match(apiSource, /new URLSearchParams\(/)
  assert.match(apiSource, /\/api\/workspace\/materials\?\$\{query\.toString\(\)\}/)
  assert.match(apiSource, /updateMaterial\(config,\s*id,\s*payload\)/)
  assert.match(apiSource, /method:\s*'PATCH'/)
  assert.match(apiSource, /getRestoredPage\(config,\s*id\)/)
  assert.match(apiSource, /previewRestoredPage\(config,\s*id\)/)
  assert.match(apiSource, /sourceRestoredPage\(config,\s*id\)/)
  assert.match(apiSource, /\/api\/workspace\/restored-pages\/\$\{encodeURIComponent\(id\)\}\/preview/)
  assert.match(apiSource, /\/api\/workspace\/restored-pages\/\$\{encodeURIComponent\(id\)\}\/source/)
})

testAsync('frontend materials and restored details use backend as source of truth', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const saveMaterialStart = appSource.indexOf('async function saveMaterialItem')
  const saveMaterialEnd = appSource.indexOf('async function deleteMaterialItem', saveMaterialStart)
  const saveMaterialSource = appSource.slice(saveMaterialStart, saveMaterialEnd)
  const deleteMaterialStart = appSource.indexOf('async function deleteMaterialItem')
  const deleteMaterialEnd = appSource.indexOf('async function addProject', deleteMaterialStart)
  const deleteMaterialSource = appSource.slice(deleteMaterialStart, deleteMaterialEnd)
  const importWebsiteStart = appSource.indexOf('async function importKnowledgeFromWebsite')
  const importWebsiteEnd = appSource.indexOf('function importRequirementFiles', importWebsiteStart)
  const importWebsiteSource = appSource.slice(importWebsiteStart, importWebsiteEnd)
  const openRestoredStart = appSource.indexOf('async function openRestoredPageDetail')
  const openRestoredEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', openRestoredStart)
  const openRestoredSource = appSource.slice(openRestoredStart, openRestoredEnd)

  assert.match(appSource, /async function refreshMaterialsFromBackend\(type = materialsTab\.value\)/)
  assert.match(appSource, /api\.workspace\.listMaterials\(state\.apiConfig,\s*\{\s*projectId:\s*state\.currentProjectId,\s*type\s*\}\)/)
  assert.match(saveMaterialSource, /materialEditor\.mode === 'edit'[\s\S]*api\.workspace\.updateMaterial/)
  assert.match(saveMaterialSource, /refreshMaterialsFromBackend\(materialEditor\.type\)/)
  assert.match(deleteMaterialSource, /api\.workspace\.deleteMaterial/)
  assert.match(deleteMaterialSource, /refreshMaterialsFromBackend\(materialEditor\.type\)/)
  assert.match(importWebsiteSource, /api\.workspace\.importWebsiteMaterials/)
  assert.doesNotMatch(importWebsiteSource, /api\.knowledge\.fromWebsite/)
  assert.match(importWebsiteSource, /generateBlueprint:\s*true/)
  assert.match(importWebsiteSource, /data\?\.blueprintAsset/)
  assert.match(importWebsiteSource, /state\.assets\.unshift\(data\.blueprintAsset\)/)
  assert.match(importWebsiteSource, /data\?\.prototypeAsset/)
  assert.match(importWebsiteSource, /state\.assets\.unshift\(data\.prototypeAsset\)/)
  assert.match(importWebsiteSource, /data\?\.blueprintMaterials/)
  assert.match(importWebsiteSource, /refreshMaterialsFromBackend\('knowledge'\)/)
  assert.match(importWebsiteSource, /refreshParseJobs\(\)/)
  assert.match(importWebsiteSource, /data\?\.parseJob/)
  assert.match(openRestoredSource, /api\.workspace\.getRestoredPage\(state\.apiConfig,\s*pageId\)/)
  assert.match(openRestoredSource, /api\.workspace\.previewRestoredPage\(state\.apiConfig,\s*pageId\)/)
  assert.match(openRestoredSource, /api\.workspace\.sourceRestoredPage\(state\.apiConfig,\s*pageId\)/)
})

testAsync('frontend stops instead of creating formal resources when backend persistence fails', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const saveMaterialStart = appSource.indexOf('async function saveMaterialItem')
  const saveMaterialEnd = appSource.indexOf('async function deleteMaterialItem', saveMaterialStart)
  const saveMaterialSource = appSource.slice(saveMaterialStart, saveMaterialEnd)
  const deleteMaterialStart = appSource.indexOf('async function deleteMaterialItem')
  const deleteMaterialEnd = appSource.indexOf('async function addProject', deleteMaterialStart)
  const deleteMaterialSource = appSource.slice(deleteMaterialStart, deleteMaterialEnd)
  const addProjectStart = appSource.indexOf('async function addProject')
  const addProjectEnd = appSource.indexOf('function applyApiResult', addProjectStart)
  const addProjectSource = appSource.slice(addProjectStart, addProjectEnd)
  const persistRunStart = appSource.indexOf('async function persistWorkspaceRun')
  const persistRunEnd = appSource.indexOf('async function persistWorkspaceAsset', persistRunStart)
  const persistRunSource = appSource.slice(persistRunStart, persistRunEnd)
  const persistAssetStart = appSource.indexOf('async function persistWorkspaceAsset')
  const persistAssetEnd = appSource.indexOf('async function persistWorkspaceSkill', persistAssetStart)
  const persistAssetSource = appSource.slice(persistAssetStart, persistAssetEnd)

  assert.match(saveMaterialSource, /const data = applyApiResult/)
  assert.match(saveMaterialSource, /if \(!data\?\.material\) return/)
  assert.doesNotMatch(saveMaterialSource, /:\s*item\b/)
  assert.match(deleteMaterialSource, /if \(!data\) return/)
  assert.match(addProjectSource, /if \(!data\?\.project\) return/)
  assert.doesNotMatch(addProjectSource, /createProject\(projectPayload\)/)
  assert.match(persistRunSource, /throw new Error\(result\.message \|\| '后端运行记录保存失败'\)/)
  assert.match(persistAssetSource, /throw new Error\(result\.message \|\| '后端资产保存失败'\)/)
})

testAsync('web factory code generation uses backend output without local fake file fallback', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const convertStart = appSource.indexOf('async function convertRestoredPageToVue')
  const convertEnd = appSource.indexOf('async function generateReactCode', convertStart)
  const convertSource = appSource.slice(convertStart, convertEnd)
  const generateStart = appSource.indexOf('async function generateReactCode')
  const generateEnd = appSource.indexOf('async function copySelectedReactFile', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)
  const transformStart = appSource.indexOf('async function transformStyle')
  const transformEnd = appSource.indexOf('async function readJsonFile', transformStart)
  const transformSource = appSource.slice(transformStart, transformEnd)

  assert.match(convertSource, /const files = data\?\.files \|\| \[\]/)
  assert.match(convertSource, /if \(!files\.length\)/)
  assert.match(convertSource, /if \(!saveData\?\.restoredPage\)/)
  assert.doesNotMatch(convertSource, /createVueViteFiles/)
  assert.doesNotMatch(convertSource, /result\.status === 'unconfigured'/)
  assert.match(generateSource, /state\.reactFiles = \[\]/)
  assert.doesNotMatch(generateSource, /createVueViteFiles/)
  assert.doesNotMatch(generateSource, /result\.status === 'unconfigured'/)
  assert.doesNotMatch(transformSource, /createVueViteFiles/)
  assert.doesNotMatch(transformSource, /result\.status === 'unconfigured'/)
})

testAsync('workflow and skill execution do not locally advance persisted backend state on API failure', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const importsStart = appSource.indexOf("import {")
  const importsEnd = appSource.indexOf("} from './services/workflows'", importsStart)
  const workflowImportsSource = appSource.slice(importsStart, importsEnd)
  const startWorkflowStart = appSource.indexOf('async function startWorkflowRun')
  const startWorkflowEnd = appSource.indexOf('async function generateProjectBlueprint', startWorkflowStart)
  const startWorkflowSource = appSource.slice(startWorkflowStart, startWorkflowEnd)
  const generateProjectStart = appSource.indexOf('async function generateProjectBlueprint')
  const generateProjectEnd = appSource.indexOf('function startRecommendedWorkflow', generateProjectStart)
  const generateProjectSource = appSource.slice(generateProjectStart, generateProjectEnd)
  const generateStepStart = appSource.indexOf('async function generateWorkflowStepOutput')
  const generateStepEnd = appSource.indexOf('async function saveProjectBlueprintAsset', generateStepStart)
  const generateStepSource = appSource.slice(generateStepStart, generateStepEnd)
  const regenerateStepStart = appSource.indexOf('async function regenerateWorkflowStepOutput')
  const regenerateStepEnd = appSource.indexOf('function chooseWorkflowOption', regenerateStepStart)
  const regenerateStepSource = appSource.slice(regenerateStepStart, regenerateStepEnd)
  const acceptStepStart = appSource.indexOf('async function acceptWorkflowStep')
  const acceptStepEnd = appSource.indexOf('async function confirmWorkflowStep', acceptStepStart)
  const acceptStepSource = appSource.slice(acceptStepStart, acceptStepEnd)
  const confirmStepStart = appSource.indexOf('async function confirmWorkflowStep')
  const confirmStepEnd = appSource.indexOf('async function saveWorkflowAsset', confirmStepStart)
  const confirmStepSource = appSource.slice(confirmStepStart, confirmStepEnd)
  const runSkillStart = appSource.indexOf('async function runWorkbenchSkill')
  const runSkillEnd = appSource.indexOf('async function downloadReactZip', runSkillStart)
  const runSkillSource = appSource.slice(runSkillStart, runSkillEnd)

  assert.doesNotMatch(workflowImportsSource, /acceptCurrentStep|completeCurrentStep|generateStepDraft|regenerateStepDraft/)
  assert.doesNotMatch(appSource, /runSkillLocally/)
  assert.match(startWorkflowSource, /if \(!result\.ok \|\| !result\.data\?\.run\)/)
  assert.match(startWorkflowSource, /return/)
  assert.doesNotMatch(startWorkflowSource, /:\s*localRun\b/)
  assert.match(generateProjectSource, /if \(!result\.ok \|\| !result\.data\?\.run\)/)
  assert.doesNotMatch(generateProjectSource, /generateStepDraft/)
  assert.match(generateStepSource, /if \(!result\.ok \|\| !result\.data\?\.run\)/)
  assert.doesNotMatch(generateStepSource, /generateStepDraft/)
  assert.match(regenerateStepSource, /if \(!result\.ok \|\| !result\.data\?\.run\)/)
  assert.doesNotMatch(regenerateStepSource, /regenerateStepDraft/)
  assert.match(acceptStepSource, /if \(!result\.ok \|\| !result\.data\?\.run\)/)
  assert.doesNotMatch(acceptStepSource, /acceptCurrentStep/)
  assert.match(confirmStepSource, /if \(!result\.ok \|\| !result\.data\?\.run\)/)
  assert.doesNotMatch(confirmStepSource, /completeCurrentStep/)
  assert.match(runSkillSource, /applyApiResult\(skillWorkbenchStatus,\s*result,\s*'Skill 执行失败'\)/)
  assert.match(runSkillSource, /if \(!data\?\.run && !data\?\.diagnosis\) return/)
  assert.match(runSkillSource, /Skill 结果保存失败/)
})

testAsync('frontend uses backend atomic import routes for blueprint and documents', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const blueprintStart = appSource.indexOf('async function importBlueprintToKnowledge')
  const blueprintEnd = appSource.indexOf('function importActiveBlueprintToKnowledge', blueprintStart)
  const blueprintSource = appSource.slice(blueprintStart, blueprintEnd)
  const documentStart = appSource.indexOf('async function importMaterialFiles')
  const documentEnd = appSource.indexOf('async function importBlueprintToKnowledge', documentStart)
  const documentSource = appSource.slice(documentStart, documentEnd)

  assert.match(apiSource, /importBlueprintMaterials\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/materials\/import-blueprint/)
  assert.match(apiSource, /importDocumentMaterials\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/materials\/import-documents/)
  assert.match(blueprintSource, /api\.workspace\.importBlueprintMaterials/)
  assert.doesNotMatch(blueprintSource, /api\.workspace\.createMaterial/)
  assert.match(documentSource, /api\.workspace\.importDocumentMaterials/)
  assert.doesNotMatch(documentSource, /api\.workspace\.createMaterial/)
  assert.match(documentSource, /refreshParseJobs/)
})

test('prototype demo asset links blueprint pages screenshots and click hotspots', () => {
  const blueprint = {
    profile: { productName: 'Podcastor' },
    demoScreens: [
      {
        id: 'home',
        title: '首页创作入口',
        description: '选择创作方式并进入编辑器。',
        screenshotUrl: '/api/workspace/prototype-screens/home.png',
        wireframe: {
          components: [
            { type: 'tab', label: '三入口 Tab' },
            { type: 'button', label: 'Next' }
          ]
        },
        actions: [{ label: 'Next', to: 'editor' }]
      },
      {
        id: 'editor',
        title: '核心编辑器',
        description: '编辑脚本、选择音色并生成视频。',
        wireframe: {
          components: [
            { type: 'select', label: '音色下拉' },
            { type: 'button', label: 'Generate Video' }
          ]
        },
        actions: [{ label: 'Generate Video', to: 'generating' }]
      }
    ]
  }
  const asset = buildPrototypeDemoAsset({ blueprint, projectId: 'project-podcastor' })
  assert.equal(asset.projectId, 'project-podcastor')
  assert.equal(asset.storagePlan.owner, 'backend')
  assert.equal(asset.storagePlan.screenshotSource, 'url-browser-capture')
  assert.equal(asset.storagePlan.frontendRole, 'prototype-playback')
  assert.equal(asset.screens.length, 2)
  assert.equal(asset.screens[0].screenshotUrl, '/api/workspace/prototype-screens/home.png')
  assert.equal(asset.screens[0].hotspots[0].label, 'Next')
  assert.equal(asset.screens[0].hotspots[0].targetScreenId, 'editor')
  assert.equal(asset.transitions[0].from, 'home')
  assert.equal(asset.transitions[0].to, 'editor')
  assert.equal(selectPrototypeDemoScreen(asset, 'editor').title, '核心编辑器')
})

test('prototype demo asset can use backend captured screens as source of truth', () => {
  const backendAsset = {
    id: 'prototype-auth',
    type: 'prototype-demo',
    projectId: 'project-auth',
    title: '认证页面交互 Demo',
    prototypeDemo: {
      source: 'backend-url-capture',
      screens: [
        {
          id: 'login',
          title: '登录页',
          url: 'https://example.com/login',
          screenshotUrl: '/api/workspace/prototype-assets/login.png',
          viewport: { width: 1440, height: 900 },
          hotspots: [{ id: 'go-register', label: '去注册', targetScreenId: 'register', rect: { x: 12, y: 60, width: 76, height: 8 } }]
        },
        {
          id: 'register',
          title: '注册页',
          screenshotUrl: '/api/workspace/prototype-assets/register.png',
          hotspots: [{ id: 'go-login', label: '已有账号登录', targetScreenId: 'login', rect: { x: 12, y: 72, width: 76, height: 8 } }]
        }
      ],
      screenshotAssets: [{ id: 'login-screenshot', screenId: 'login', screenshotUrl: '/api/workspace/prototype-assets/login.png', storage: 'workspace-asset' }],
      transitions: [{ id: 'login-register', from: 'login', to: 'register', label: '去注册', event: 'click' }]
    }
  }
  const asset = buildPrototypeDemoAsset({ prototypeAsset: backendAsset, projectId: 'project-auth' })
  assert.equal(asset.source, 'backend-url-capture')
  assert.equal(asset.screens[0].screenshotUrl, '/api/workspace/prototype-assets/login.png')
  assert.equal(asset.screens[0].url, 'https://example.com/login')
  assert.deepEqual(asset.screens[0].viewport, { width: 1440, height: 900 })
  assert.equal(asset.screenshotAssets[0].screenId, 'login')
  assert.equal(asset.screens[0].hotspots[0].targetScreenId, 'register')
  assert.equal(asset.transitions[0].from, 'login')
})

testAsync('knowledge base frontend exposes blueprint reader tabs and node detail evidence', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /const knowledgeCanvasZoom = ref/)
  assert.match(appSource, /const currentKnowledgeBlueprintWorkbench = computed/)
  assert.match(appSource, /const knowledgePrototypePages = computed/)
  assert.match(appSource, /const currentKnowledgePrototypeDemo = computed/)
  assert.match(appSource, /const currentProjectPrototypeAsset = computed/)
  assert.match(appSource, /const selectedKnowledgePrototypeScreen = computed/)
  assert.match(appSource, /const selectedKnowledgeNodeVisualContext = computed/)
  assert.match(appSource, /const selectedKnowledgeNodeAiContext = computed/)
  assert.match(appSource, /function visualContextForKnowledgeNode/)
  assert.match(appSource, /const currentKnowledgeMarkdown = computed/)
  assert.match(appSource, /function openKnowledgeNodeDetail/)
  assert.match(appSource, /function selectKnowledgePrototypeScreen/)
  assert.match(appSource, /function triggerKnowledgePrototypeHotspot/)
  assert.match(appSource, /交互 Demo/)
  assert.match(appSource, /knowledgeHubSection === 'prototype'/)
  assert.match(appSource, /后台截图资产/)
  assert.match(appSource, /读取前端代码/)
  assert.match(appSource, /目标/)
  assert.match(appSource, /输入输出/)
  assert.match(appSource, /流程步骤/)
  assert.match(appSource, /异常状态/)
  assert.match(appSource, /关联页面/)
  assert.match(appSource, /关联知识/)
  assert.match(appSource, /来源证据/)
  assert.match(appSource, /截图定位/)
  assert.match(appSource, /AI 识别上下文/)
  assert.match(appSource, /knowledge-screenshot-region-box/)
  assert.match(styles, /\.knowledge-primary-tabs/)
  assert.match(styles, /\.knowledge-xmind-node/)
  assert.match(styles, /\.knowledge-structure-inspector/)
  assert.match(styles, /\.knowledge-screenshot-region-box/)
  assert.match(styles, /\.knowledge-ai-context/)
  assert.match(styles, /\.knowledge-prototype-card/)
  assert.match(styles, /\.knowledge-flow-demo/)
  assert.match(styles, /\.knowledge-prototype-player/)
  assert.match(styles, /\.prototype-demo-stage/)
  assert.match(styles, /\.prototype-hotspot/)
  assert.match(styles, /\.knowledge-node-detail-grid/)
})

testAsync('knowledge material detail keeps governance metadata collapsed by default', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const governanceStart = appSource.indexOf('<details class="website-detail-section governance-detail">')
  const governanceEnd = appSource.indexOf('</details>', governanceStart)
  const governanceSource = appSource.slice(governanceStart, governanceEnd)

  assert.ok(governanceStart > 0)
  assert.match(governanceSource, /<summary>[\s\S]*治理信息/)
  assert.doesNotMatch(governanceSource, /<details[^>]*\sopen/)
  assert.match(governanceSource, /knowledge-governance-grid/)
  assert.match(styles, /\.governance-detail\s*\{/)
})

testAsync('knowledge material cards keep low frequency metadata in hover hints', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const materialsStart = appSource.indexOf('<section v-if="activeView === \'materials\'"')
  const materialsEnd = appSource.indexOf('<section v-if="activeView === \'diagnosis\'"', materialsStart)
  const materialsSource = appSource.slice(materialsStart, materialsEnd)
  const cardStart = materialsSource.indexOf('class="material-card"')
  const cardEnd = materialsSource.indexOf('</button>', cardStart)
  const cardSource = materialsSource.slice(cardStart, cardEnd)

  assert.match(cardSource, /:title="materialCardHint\(item\)"/)
  assert.doesNotMatch(cardSource, /class="material-source"/)
  assert.doesNotMatch(cardSource, /class="scope-chip-row material-role-row"/)
  assert.match(appSource, /function materialCardHint\(item\)/)
  assert.doesNotMatch(styles, /\.material-role-row\s*\{/)
})

testAsync('knowledge base frontend exposes retrieval test powered by backend search', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /const knowledgeRetrievalForm = reactive/)
  assert.match(appSource, /async function runKnowledgeRetrievalTest/)
  assert.match(appSource, /api\.workspace\.searchMaterials/)
  assert.match(appSource, /knowledgeRetrievalResults/)
  assert.match(appSource, /召回测试/)
  assert.match(appSource, /命中证据/)
  assert.match(styles, /\.knowledge-retrieval-panel/)
  assert.match(styles, /\.retrieval-result-list/)
})

testAsync('knowledge base frontend exposes parse job center', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(apiSource, /listParseJobs\(config,\s*payload/)
  assert.match(apiSource, /\/api\/workspace\/parse-jobs/)
  assert.match(appSource, /knowledgeParseJobs/)
  assert.match(appSource, /refreshParseJobs/)
  assert.match(appSource, /解析任务中心/)
  assert.match(appSource, /parse-job-list/)
  assert.match(styles, /\.parse-job-panel/)
})

testAsync('knowledge base advanced import retrieval and parse jobs live in modal tools', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const materialsStart = appSource.indexOf('<section v-if="activeView === \'materials\'"')
  const materialsEnd = appSource.indexOf('<section v-if="activeView === \'diagnosis\'"', materialsStart)
  const materialsSource = appSource.slice(materialsStart, materialsEnd)
  const modalStart = appSource.indexOf('class="project-create-modal material-tool-modal"')
  const modalEnd = appSource.indexOf('<section v-if="activeView === \'factory\'"', modalStart)
  const modalSource = appSource.slice(modalStart, modalEnd)

  assert.match(appSource, /showMaterialToolModal/)
  assert.match(appSource, /materialToolModalMode/)
  assert.match(materialsSource, /knowledge-hub-layout/)
  assert.match(materialsSource, /openMaterialTool\('website-import'\)/)
  assert.match(materialsSource, /openMaterialTool\('retrieval-test'\)/)
  assert.match(materialsSource, /openMaterialTool\('parse-jobs'\)/)
  assert.doesNotMatch(materialsSource, /class="panel website-import-panel"/)
  assert.doesNotMatch(materialsSource, /class="panel knowledge-retrieval-panel"/)
  assert.doesNotMatch(materialsSource, /class="panel parse-job-panel"/)
  assert.match(modalSource, /website-import-panel/)
  assert.match(modalSource, /knowledge-retrieval-panel/)
  assert.match(modalSource, /parse-job-panel/)
  assert.match(cssSource, /\.material-tool-modal\s*\{/)
  assert.match(cssSource, /\.knowledge-hub-layout\s*\{/)
})

testAsync('knowledge import closes modal and uses floating timed notice', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const modalStart = appSource.indexOf('class="project-create-modal material-tool-modal"')
  const modalEnd = appSource.indexOf('<section v-if="activeView === \'factory\'"', modalStart)
  const modalSource = appSource.slice(modalStart, modalEnd)
  const materialsStart = appSource.indexOf('<section v-if="activeView === \'materials\'"')
  const materialsEnd = appSource.indexOf('<section v-if="activeView === \'diagnosis\'"', materialsStart)
  const materialsSource = appSource.slice(materialsStart, materialsEnd)
  const knowledgeStart = materialsSource.indexOf('<section v-if="materialsTab === \'knowledge\'" class="knowledge-hub-layout">')
  const knowledgeEnd = materialsSource.indexOf('<template v-else>', knowledgeStart)
  const knowledgeSource = materialsSource.slice(knowledgeStart, knowledgeEnd)
  const listSource = materialsSource.slice(knowledgeEnd)

  assert.match(modalSource, /@click="submitWebsiteImportAndClose"/)
  assert.match(appSource, /function submitWebsiteImportAndClose/)
  assert.match(appSource, /closeMaterialTool\(\)[\s\S]*importKnowledgeFromWebsite/)
  assert.match(appSource, /NOTICE_AUTO_HIDE_MS/)
  assert.match(appSource, /window\.setTimeout/)
  assert.match(knowledgeSource, /<Notice :result="currentMaterialStatus" floating/)
  assert.doesNotMatch(listSource, /<Notice :result="currentMaterialStatus" \/>/)
  assert.match(styles, /\.notice\.floating/)
  assert.match(styles, /\.knowledge-hub-layout\s*\{[\s\S]*?position:\s*relative/)
})

test('knowledge hub builds blueprint led project knowledge structure', () => {
  const blueprintAsset = {
    id: 'asset-blueprint',
    title: 'Podcastor 项目蓝图',
    blueprint: {
      profile: {
        positioning: 'AI 播客项目工作台',
        targetUsers: '产品、UX、开发',
        primaryGoal: '从需求生成方案和工程页面',
        coreScenarios: ['上传资料', '生成设计方案']
      },
      pages: [
        { id: 'upload', name: '上传资料页', goal: '导入原始资料', states: ['empty', 'loading', 'failed'] }
      ],
      flows: [
        { id: 'upload-flow', title: '上传资料流程', steps: ['选择文件', '后端解析', '写入知识库'] }
      ],
      acceptance: ['失败时保留文件名和原因']
    }
  }
  const materials = [
    { id: 'card-1', type: 'knowledge', title: '上传失败处理规则', content: '保留文件名和失败原因', sourceType: 'manual', category: 'knowledge-card', roleScopes: ['ux'] },
    { id: 'blueprint-node-1', type: 'knowledge', title: '上传资料页页面结构', content: '上传控件、解析状态、失败恢复', sourceType: 'blueprint', category: 'blueprint-demo-screen', roleScopes: ['ux'] },
    { id: 'decision-1', type: 'knowledge', title: '上传入口位置', category: 'design-decision', content: '上传入口放在输入框下方' },
    { id: 'rule-1', type: 'knowledge', title: '解析失败业务规则', category: 'business-rule', content: '失败时允许重试并保留原文件' },
    { id: 'source-1', type: 'knowledge', title: '官网定价页', content: 'Pro 套餐支持协作', sourceType: 'website', sourceUrl: 'https://example.com/pricing' }
  ]
  const hub = buildKnowledgeHubView({
    project: { id: 'project-podcastor', name: 'Podcastor' },
    blueprintAsset,
    materials,
    parseJobs: [{ id: 'job-a', status: 'succeeded' }]
  })

  assert.equal(hub.overview.projectName, 'Podcastor')
  assert.equal(hub.overview.blueprintNodeCount > 0, true)
  assert.equal(
    hub.sections.map((section) => section.key).join(','),
    'structure,flow,prototype,markdown'
  )
  assert.ok(hub.blueprint.nodes.some((node) => node.type === 'flow' && node.title === '上传资料流程'))
  assert.equal(hub.cards.items.length, 1)
  assert.equal(hub.blueprintMaterials.items.length, 1)
  assert.equal(hub.decisions.items.length, 1)
  assert.equal(hub.rules.items.length, 1)
  assert.equal(hub.sources.items.length, 1)
  assert.equal(hub.jobs.items.length, 1)
})

test('knowledge hub relates materials to a blueprint node for design context', () => {
  const node = { id: 'upload-flow', title: '上传资料流程', keywords: ['上传', '失败'] }
  const related = relatedKnowledgeForBlueprintNode(node, [
    { id: 'a', title: '上传失败处理规则', content: '失败时保留文件名', type: 'knowledge' },
    { id: 'b', title: '定价规则', content: 'Pro 套餐', type: 'knowledge' }
  ])

  assert.deepEqual(related.map((item) => item.id), ['a'])
})

test('knowledge hub classifies decisions rules cards and source evidence', () => {
  assert.equal(classifyKnowledgeMaterial({ category: 'design-decision', title: '按钮位置' }), 'decision')
  assert.equal(classifyKnowledgeMaterial({ category: 'business-rule', title: '权限规则' }), 'rule')
  assert.equal(classifyKnowledgeMaterial({ sourceType: 'website', sourceUrl: 'https://example.com' }), 'source')
  assert.equal(classifyKnowledgeMaterial({ category: 'knowledge-card', title: '上传流程' }), 'card')
  assert.equal(classifyKnowledgeMaterial({ category: 'blueprint-interaction', title: '上传流程' }), 'blueprint')
  assert.equal(classifyKnowledgeMaterial({ category: 'blueprint-demo-screen', title: '上传页面结构' }), 'blueprint')
})

test('knowledge deposit builds backend material payload with source evidence and blueprint binding', () => {
  const payload = buildKnowledgeDepositPayload({
    projectId: 'project-podcastor',
    source: {
      id: 'req-1',
      type: 'requirements',
      title: '上传需求文档',
      meta: 'PRD v1',
      content: '上传失败时保留文件名和失败原因。'
    },
    depositType: 'business-rule',
    roleScopes: ['product', 'ux', 'ai-retrieval'],
    blueprintNode: {
      id: 'upload-flow',
      title: '上传资料流程',
      type: 'flow'
    },
    title: '上传失败保留文件规则',
    notes: '来自需求评审结论'
  })

  assert.equal(payload.type, 'knowledge')
  assert.equal(payload.projectId, 'project-podcastor')
  assert.equal(payload.category, 'business-rule')
  assert.equal(payload.sourceMaterialId, 'req-1')
  assert.equal(payload.sourceType, 'requirements')
  assert.deepEqual(payload.roleScopes, ['product', 'ux', 'ai-retrieval'])
  assert.ok(payload.evidence.some((item) => item.title === '上传需求文档' && item.text.includes('上传失败')))
  assert.ok(payload.relations.some((item) => item.type === 'blueprint-node' && item.targetId === 'upload-flow'))
})

test('knowledge deposit exposes the four allowed deposit types', () => {
  assert.deepEqual(
    KNOWLEDGE_DEPOSIT_TYPES.map((item) => item.key),
    ['knowledge-card', 'design-decision', 'business-rule', 'source-evidence']
  )
})

testAsync('frontend exposes unified knowledge deposit modal with blueprint node binding', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /buildKnowledgeDepositPayload/)
  assert.match(appSource, /const showKnowledgeDepositModal = ref\(false\)/)
  assert.match(appSource, /const knowledgeDepositForm = reactive/)
  assert.match(appSource, /function openKnowledgeDeposit/)
  assert.match(appSource, /async function submitKnowledgeDeposit/)
  assert.match(appSource, /api\.workspace\.createMaterial/)
  assert.match(appSource, /aria-label="沉淀到知识库"/)
  assert.match(appSource, /沉淀到知识库/)
  assert.match(appSource, /沉淀类型/)
  assert.match(appSource, /绑定蓝图节点/)
  assert.match(appSource, /适用角色/)
  assert.match(appSource, /sourceType: 'requirements'/)
  assert.match(appSource, /sourceType: 'competitors'/)
  assert.match(appSource, /sourceType: 'knowledge'/)
  assert.match(styles, /\.knowledge-deposit-modal\s*\{/)
  assert.match(styles, /\.knowledge-deposit-type-grid\s*\{/)
})

test('blueprint workbench builds expandable frame tree relation graph and node details', () => {
  const blueprint = buildProjectBlueprint({
    project: { id: 'project-podcastor', name: 'Podcastor' },
    input: '做一个上传资料生成播客的工具',
    documents: [{ name: 'PRD.md', text: '上传失败需要保留文件名和失败原因。' }]
  })
  const baseWorkbench = buildBlueprintWorkbench({ blueprint, knowledge: [] })
  const targetNode = baseWorkbench.nodes.find((node) => node.kind === 'page') || baseWorkbench.nodes[0]
  const workbench = buildBlueprintWorkbench({
    blueprint,
    knowledge: [
      {
        id: 'knowledge-upload-failure',
        title: '上传失败处理规则',
        content: '失败时保留文件名和失败原因。',
        evidence: ['PRD.md：上传失败需要保留文件名和失败原因。'],
        relations: [{ type: 'blueprint-node', targetId: targetNode.id }]
      }
    ]
  })
  const homeNode = workbench.nodes.find((node) => node.id === targetNode.id)
  const expandableNode = workbench.nodes.find((node) => node.children?.length)
  const visibleCollapsed = visibleBlueprintFrameNodes(workbench.frameTree, new Set())
  const visibleExpanded = visibleBlueprintFrameNodes(workbench.frameTree, new Set([expandableNode.id]))

  assert.ok(workbench.frameTree.children.length >= 3)
  assert.ok(workbench.structureTree.some((node) => node.kind === 'page'))
  assert.ok(workbench.relationGraph.edges.some((edge) => edge.fromType === 'requirements' && edge.toType === 'blueprint-node'))
  assert.ok(homeNode.detail.goal)
  assert.ok(homeNode.detail.inputs.length)
  assert.ok(homeNode.detail.outputs.length)
  assert.ok(homeNode.detail.flowSteps.length)
  assert.ok(homeNode.detail.exceptionStates.length)
  assert.ok(homeNode.detail.relatedKnowledge.some((item) => item.title === '上传失败处理规则'))
  assert.ok(visibleExpanded.length > visibleCollapsed.length)
})

testAsync('frontend exposes expandable blueprint frame workbench with node detail and relation graph', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /buildBlueprintWorkbench/)
  assert.match(appSource, /visibleBlueprintFrameNodes/)
  assert.match(appSource, /const blueprintWorkbenchViewMode = ref\('frame'\)/)
  assert.match(appSource, /const expandedBlueprintNodeIds = reactive/)
  assert.match(appSource, /function handleBlueprintWorkbenchNodeSelect/)
  assert.match(appSource, /function handleBlueprintWorkbenchNodeToggle/)
  assert.match(appSource, /class="blueprint-workbench"/)
  assert.match(appSource, /class="blueprint-frame-canvas"/)
  assert.match(appSource, /class="blueprint-relation-graph"/)
  assert.match(appSource, /节点详情/)
  assert.match(appSource, /输入输出/)
  assert.match(appSource, /异常状态/)
  assert.match(appSource, /关联知识/)
  assert.match(appSource, /来源证据/)
  assert.match(styles, /\.blueprint-workbench\s*\{/)
  assert.match(styles, /\.blueprint-frame-canvas\s*\{/)
  assert.match(styles, /\.blueprint-node-detail\s*\{/)
})

test('knowledge base frontend uses project knowledge hub sections', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const materialsStart = appSource.indexOf('<section v-if="activeView === \'materials\'"')
  const materialsEnd = appSource.indexOf('<section v-if="activeView === \'diagnosis\'"', materialsStart)
  const materialsSource = appSource.slice(materialsStart, materialsEnd)
  const knowledgeStart = materialsSource.indexOf('<section v-if="materialsTab === \'knowledge\'" class="knowledge-hub-layout">')
  const knowledgeEnd = materialsSource.indexOf('<template v-else>', knowledgeStart)
  const knowledgeSource = materialsSource.slice(knowledgeStart, knowledgeEnd)

  assert.match(appSource, /buildKnowledgeHubView/)
  assert.match(appSource, /const knowledgeHubSection = ref\('structure'\)/)
  assert.match(appSource, /const currentKnowledgeHub = computed/)
  assert.match(knowledgeSource, /class="knowledge-hub-layout"/)
  assert.match(knowledgeSource, /结构树/)
  assert.match(knowledgeSource, /流程图/)
  assert.match(knowledgeSource, /交互 Demo/)
  assert.match(knowledgeSource, /Markdown/)
  assert.match(knowledgeSource, /knowledge-primary-tabs/)
  assert.match(knowledgeSource, /knowledge-xmind-canvas/)
  assert.match(knowledgeSource, /knowledge-flow-board/)
  assert.match(knowledgeSource, /knowledge-markdown-view/)
  assert.match(appSource, /showKnowledgeNodeDetailModal/)
  assert.match(appSource, /selectedKnowledgeNodeDetail/)
  assert.doesNotMatch(appSource, /knowledgeHubSection\.value = 'overview'/)
  assert.doesNotMatch(appSource, /knowledgeHubSection\.value = 'cards'/)
  assert.doesNotMatch(appSource, /knowledgeHubSection\.value = 'decisions'/)
  assert.doesNotMatch(appSource, /knowledgeHubSection\.value = 'rules'/)
  assert.doesNotMatch(appSource, /knowledgeHubSection\.value = 'sources'/)
  assert.doesNotMatch(knowledgeSource, /knowledgeHubSection === 'overview'/)
  assert.doesNotMatch(knowledgeSource, /knowledgeHubSection === 'cards'/)
  assert.doesNotMatch(knowledgeSource, /knowledgeHubSection === 'decisions'/)
  assert.doesNotMatch(knowledgeSource, /knowledgeHubSection === 'rules'/)
  assert.doesNotMatch(knowledgeSource, /knowledgeHubSection === 'sources'/)
  assert.doesNotMatch(knowledgeSource, /class="knowledge-role-tabs"/)
  assert.match(styles, /\.knowledge-hub-layout\s*\{/)
  assert.match(styles, /\.knowledge-primary-tabs\s*\{/)
  assert.match(styles, /\.knowledge-xmind-canvas\s*\{/)
  assert.match(styles, /\.knowledge-flow-board\s*\{/)
  assert.match(styles, /\.knowledge-node-modal\s*\{/)
})

test('project blueprint workbench is not auto-rendered from existing blueprint assets', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /<WorkflowCanvasPage[\s\S]*v-if="activeView === 'workflow' && workflowRoute === 'canvas'"/)
  assert.doesNotMatch(appSource, /<section v-if="activeProjectBlueprint" class="panel project-blueprint-panel">/)
})

testAsync('settings frontend exposes backend model provider configuration without storing key locally', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(apiSource, /getModelSettings\(config\)/)
  assert.match(apiSource, /saveModelSettings\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/model-settings/)
  assert.match(appSource, /const modelSettingsForm = reactive/)
  assert.match(appSource, /loadModelSettings/)
  assert.match(appSource, /saveBackendModelSettings/)
  assert.match(appSource, /后端模型配置/)
  assert.match(appSource, /modelSettingsStatus\.hasApiKey/)
  assert.match(appSource, /enabled:\s*Boolean\(modelSettings\.enabled \|\| \(modelSettings\.provider === 'openai-compatible' && modelSettings\.hasApiKey\)\)/)
  assert.match(appSource, /const shouldEnableBackendModel = Boolean\(/)
  assert.doesNotMatch(appSource, /state\.apiConfig\.openaiApiKey/)
})

testAsync('workflow agent model selector only exposes backend configured model', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const workbenchSource = await readFile(new URL('../src/services/workflowWorkbench.js', import.meta.url), 'utf8')
  const sessionStart = appSource.indexOf('const workflowAgentSession = computed')
  const sessionEnd = appSource.indexOf('const workflowArtifactStages', sessionStart)
  const sessionSource = appSource.slice(sessionStart, sessionEnd)
  const optionsStart = appSource.indexOf('const workflowAgentAvailableModelOptions = computed')
  const optionsEnd = appSource.indexOf('function workflowAgentSessionMessages', optionsStart)
  const optionsSource = appSource.slice(optionsStart, optionsEnd)
  const modelStart = appSource.indexOf('const workflowAgentModel = computed')
  const modelEnd = appSource.indexOf('const workflowGate = computed', modelStart)
  const modelSource = appSource.slice(modelStart, modelEnd)

  assert.match(sessionSource, /model:\s*modelSettingsForm\.defaultModel \|\| 'gpt-5\.5'/)
  assert.match(sessionSource, /modelOptions:\s*workflowAgentAvailableModelOptions\.value/)
  assert.match(optionsSource, /modelSettingsForm\.defaultModel \|\| 'gpt-5\.5'/)
  assert.match(optionsSource, /!modelSettingsForm\.enabled \|\| !modelSettingsStatus\.hasApiKey/)
  assert.match(modelSource, /return modelSettingsForm\.defaultModel \|\| workflowAgentSession\.value\?\.model\?\.current \|\| 'gpt-5\.5'/)
  assert.match(modelSource, /const allowed = workflowAgentAvailableModelOptions\.value\.some/)
  assert.doesNotMatch(workbenchSource, /value:\s*'gpt-4\.1'/)
  assert.doesNotMatch(workbenchSource, /value:\s*'gpt-4\.1-mini'/)
  assert.doesNotMatch(workbenchSource, /value:\s*'gpt-4o'/)
})

testAsync('settings frontend can trigger backend model connectivity test', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(apiSource, /testModelSettings\(config,\s*payload/)
  assert.match(apiSource, /\/api\/workspace\/model-settings\/test/)
  assert.match(appSource, /testBackendModelSettings/)
  assert.match(appSource, /测试模型/)
  assert.match(appSource, /modelSettingsTestResult/)
  assert.match(appSource, /模型连通/)
  assert.match(appSource, /usage\.totalTokens/)
})

testAsync('settings frontend can run auth modal model sample analysis', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(apiSource, /runModelSampleAnalysis\(config,\s*payload/)
  assert.match(apiSource, /\/api\/workspace\/model-settings\/sample-analysis/)
  assert.match(appSource, /runBackendModelSampleAnalysis/)
  assert.match(appSource, /测试登录注册弹窗/)
  assert.match(appSource, /modelSettingsSampleResult/)
  assert.match(appSource, /auth-modal/)
  assert.match(appSource, /智能推荐 Skill/)
})

testAsync('settings frontend displays backend model call logs with fallback and token diagnostics', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(apiSource, /listModelCallLogs\(config,\s*payload/)
  assert.match(apiSource, /\/api\/workspace\/model-call-logs/)
  assert.match(appSource, /const modelCallLogs = ref\(\[\]\)/)
  assert.match(appSource, /loadModelCallLogs/)
  assert.match(appSource, /模型调用日志/)
  assert.match(appSource, /fallbackReason/)
  assert.match(appSource, /totalTokens/)
  assert.match(appSource, /durationMs/)
  assert.match(appSource, /demandScope/)
  assert.match(appSource, /projectId/)
  assert.match(appSource, /detectedIntent/)
  assert.match(appSource, /routingReason/)
})

testAsync('settings frontend filters model call logs by status skill project and scope', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const settingsStart = appSource.indexOf('<section class="panel model-call-log-panel">')
  const settingsEnd = appSource.indexOf('<section class="panel">', settingsStart + 1)
  const settingsSource = appSource.slice(settingsStart, settingsEnd)
  const loaderStart = appSource.indexOf('async function loadModelCallLogs')
  const loaderEnd = appSource.indexOf('async function saveBackendModelSettings', loaderStart)
  const loaderSource = appSource.slice(loaderStart, loaderEnd)

  assert.match(appSource, /const modelCallLogFilters = reactive/)
  assert.match(settingsSource, /v-model="modelCallLogFilters\.status"/)
  assert.match(settingsSource, /v-model="modelCallLogFilters\.skillId"/)
  assert.match(settingsSource, /v-model="modelCallLogFilters\.projectId"/)
  assert.match(settingsSource, /v-model="modelCallLogFilters\.demandScope"/)
  assert.match(loaderSource, /status:\s*modelCallLogFilters\.status/)
  assert.match(loaderSource, /skillId:\s*modelCallLogFilters\.skillId/)
  assert.match(loaderSource, /projectId:\s*modelCallLogFilters\.projectId/)
  assert.match(loaderSource, /demandScope:\s*modelCallLogFilters\.demandScope/)
})

testAsync('workflow analysis refreshes model call logs after backend generation', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const analyzeSource = appSource.slice(
    appSource.indexOf('async function analyzeWorkflowDocuments'),
    appSource.indexOf('async function autoAnalyzeWorkflowInput')
  )

  assert.match(analyzeSource, /api\.uploads\.analyzeDocuments/)
  assert.match(apiSource, /timeoutMs:\s*90000/)
  assert.match(analyzeSource, /loadModelCallLogs/)
})

testAsync('workflow document analysis frontend timeout follows backend model timeout with buffer', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(apiSource, /analyzeDocumentsStream\(config,\s*payload,\s*options\s*=\s*\{\}\)/)
  assert.match(apiSource, /timeoutMs:\s*options\.timeoutMs\s*\|\|\s*210000/)
  assert.match(appSource, /function workflowAnalysisRequestTimeoutMs/)
  assert.match(appSource, /Math\.max\(90000,\s*modelTimeoutMs\s*\+\s*30000\)/)
  assert.match(analyzeSource, /api\.uploads\.analyzeDocumentsStream\(state\.apiConfig,\s*analysisPayload,\s*\{[\s\S]*timeoutMs:\s*workflowAnalysisRequestTimeoutMs\(\)/)
})

testAsync('workflow document analysis frontend merges streamed canvas nodes into the pending run', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.ok(analyzeStart > 0)
  assert.match(appSource, /function buildWorkflowAnalysisProgressResult\(/)
  assert.match(appSource, /function mergeWorkflowAnalysisStreamNode\(/)
  assert.match(appSource, /async function persistWorkflowAnalysisProgressRun\(/)
  assert.match(analyzeSource, /workflowAnalysisResult\.value\s*=\s*buildWorkflowAnalysisProgressResult\(persistedPendingRun/)
  assert.match(analyzeSource, /event\.data\?\.type === 'workflow-canvas-meta'/)
  assert.match(analyzeSource, /event\.data\?\.type === 'workflow-node'/)
  assert.match(analyzeSource, /mergeWorkflowAnalysisStreamNode\(/)
  assert.match(analyzeSource, /persistWorkflowAnalysisProgressRun\(persistedPendingRun/)
  assert.match(analyzeSource, /node:\s*event\.data\.node/)
})

testAsync('settings frontend exposes backend skill orchestration configuration', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')

  assert.match(apiSource, /getSkillOrchestrationSettings\(config\)/)
  assert.match(apiSource, /saveSkillOrchestrationSettings\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/skill-orchestration-settings/)
  assert.match(appSource, /const skillOrchestrationForm = reactive/)
  assert.match(appSource, /loadSkillOrchestrationSettings/)
  assert.match(appSource, /saveBackendSkillOrchestrationSettings/)
  assert.match(appSource, /Skill 编排策略/)
  assert.match(appSource, /auth-page-generation/)
  assert.match(appSource, /qualityChecksText/)
})

testAsync('backend readme documents materials and restored page APIs', async () => {
  const readme = await readFile(new URL('../后端/README.md', import.meta.url), 'utf8')

  assert.match(readme, /GET\s+\/api\/workspace\/materials\?projectId=&type=/)
  assert.match(readme, /PATCH\s+\/api\/workspace\/materials\/:id/)
  assert.match(readme, /DELETE\s+\/api\/workspace\/materials\/:id/)
  assert.match(readme, /GET\s+\/api\/workspace\/restored-pages\/:id/)
  assert.match(readme, /GET\s+\/api\/workspace\/restored-pages\/:id\/preview/)
  assert.match(readme, /GET\s+\/api\/workspace\/restored-pages\/:id\/source/)
})

testAsync('backend readme documents model and skill orchestration contracts', async () => {
  const readme = await readFile(new URL('../后端/README.md', import.meta.url), 'utf8')

  assert.match(readme, /GET\s+\/api\/workspace\/model-settings/)
  assert.match(readme, /PUT\s+\/api\/workspace\/model-settings/)
  assert.match(readme, /GET\s+\/api\/workspace\/skill-orchestration-settings/)
  assert.match(readme, /PUT\s+\/api\/workspace\/skill-orchestration-settings/)
  assert.match(readme, /skillOverrides/)
  assert.match(readme, /promptTemplate/)
  assert.match(readme, /qualityChecks/)
})

testAsync('backend readme documents workflow agent retry edit stream cancel contracts', async () => {
  const readme = await readFile(new URL('../后端/README.md', import.meta.url), 'utf8')

  assert.match(readme, /POST\s+\/api\/workspace\/workflow-runs\/:id\/messages/)
  assert.match(readme, /POST\s+\/api\/workspace\/workflow-runs\/:id\/messages\/stream/)
  assert.match(readme, /POST\s+\/api\/workspace\/workflow-runs\/:id\/messages\/cancel/)
  assert.match(readme, /clientMessageId/)
  assert.match(readme, /retryOfMessageId/)
  assert.match(readme, /editOfMessageId/)
  assert.match(readme, /action/)
  assert.match(readme, /cancelled/)
})

testAsync('web factory uses creation tabs and keeps restored assets below the tools', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const tabsSource = appSource.slice(appSource.indexOf('const factoryHomeTabs'), appSource.indexOf('const factoryHeroContent'))
  const firstTabIndex = tabsSource.indexOf("label: '图片转代码'")
  const secondTabIndex = tabsSource.indexOf("label: 'URL转代码'")
  const thirdTabIndex = tabsSource.indexOf("label: '风格转换'")
  const factoryHomeStart = appSource.indexOf(`state.currentFactoryRoute === 'home'`)
  const factoryHomeEnd = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`, factoryHomeStart)
  const factoryHomeSource = appSource.slice(factoryHomeStart, factoryHomeEnd)
  const agentCopySource = factoryHomeSource.match(/<div class="agent-copy">[\s\S]*?<\/div>/)?.[0] || ''

  assert.ok(firstTabIndex >= 0)
  assert.ok(secondTabIndex > firstTabIndex)
  assert.ok(thirdTabIndex > secondTabIndex)
  assert.match(tabsSource, /key:\s*'image-code'/)
  assert.match(tabsSource, /key:\s*'url-code'/)
  assert.match(tabsSource, /key:\s*'style-transfer'/)
  assert.match(factoryHomeSource, /factoryHomeTab === 'url-code'[\s\S]*采集网页/)
  assert.match(factoryHomeSource, /factoryHeroCopy\.titleBefore/)
  assert.match(factoryHomeSource, /factoryHeroCopy\.subtitle/)
  assert.match(appSource, /const factoryHeroContent/)
  assert.match(appSource, /image-code[\s\S]*上传设计图/)
  assert.match(appSource, /url-code[\s\S]*输入目标网址/)
  assert.match(appSource, /style-transfer[\s\S]*描述目标风格/)
  assert.doesNotMatch(factoryHomeSource, />Web Agent</)
  assert.doesNotMatch(agentCopySource, /project-context-chip/)
  assert.doesNotMatch(factoryHomeSource, /class="project-context-chip composer-project-chip"/)
  assert.doesNotMatch(factoryHomeSource, /保存到：/)
  assert.doesNotMatch(factoryHomeSource, /agent-composer[\s\S]*capture-path-panel/)
  const imageComposerSource = factoryHomeSource.slice(
    factoryHomeSource.indexOf("factoryHomeTab === 'image-code'"),
    factoryHomeSource.indexOf("factoryHomeTab === 'url-code'")
  )
  const urlComposerSource = factoryHomeSource.slice(
    factoryHomeSource.indexOf("factoryHomeTab === 'url-code'"),
    factoryHomeSource.indexOf('restored-assets-section')
  )
  assert.doesNotMatch(imageComposerSource, /capture-method-panel|selectedCaptureRecoveryFlow|选择采集方式/)
  assert.match(urlComposerSource, /capture-method-menu[\s\S]*captureMethodLabel/)
  assert.doesNotMatch(urlComposerSource, /capture-method-panel|capture-method-card|capture-method-detail|选择采集方式/)
  assert.match(appSource, /function applyRouteState\(key, options = \{\}\)[\s\S]*openFactoryHome\(options\.factoryTab \|\| 'image-code'\)/)
  assert.match(appSource, /function switchView\(key\)[\s\S]*applyRouteState\(key\)/)
  assert.doesNotMatch(css, /\.capture-path-panel\.inline\s*\{[\s\S]*?margin-right/)
  assert.match(css, /\.capture-method-menu\s*\{[\s\S]*?left:\s*calc\(var\(--factory-composer-control-left\) \+ var\(--factory-composer-control-gap\)\)/)
  assert.doesNotMatch(factoryHomeSource, /<strong>\{\{ selectedSnapshotAuthMode\.title \}\}<\/strong>/)
  assert.doesNotMatch(factoryHomeSource, /基于当前还原资产/)
  assert.doesNotMatch(tabsSource, /网页快照|快照资产|还原页面/)
  assert.match(factoryHomeSource, /还原资产/)
  assert.doesNotMatch(factoryHomeSource, /当前项目：/)
  assert.doesNotMatch(factoryHomeSource, /切换项目/)
  assert.doesNotMatch(factoryHomeSource, /<StatusBadge :status="pageGenerationStatus\.status"/)
  assert.match(factoryHomeSource, /查看详情/)
  assert.match(factoryHomeSource, /formatRestoredPageTime\(page\)/)
  assert.match(factoryHomeSource, /restoredPageTags\(page\)/)
  assert.match(factoryHomeSource, /restored-page-tags/)
  assert.match(css, /\.restored-assets-section\s*\{[\s\S]*?border:\s*0/)
  assert.match(css, /\.restored-page-cover\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/)
  assert.match(css, /\.restored-page-cover iframe\s*\{[\s\S]*?object-fit:\s*contain/)
  assert.match(css, /\.restored-card-action\s*\{[\s\S]*?transform:\s*translateY/)
})

testAsync('web factory defaults to image to code and persists restored asset tags', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const workspaceSource = await readFile(new URL('../src/services/factoryWorkspace.js', import.meta.url), 'utf8')
  const backendModelSource = await readFile(new URL('../后端/models/workspace.js', import.meta.url), 'utf8')
  const routeStart = appSource.indexOf('function applyRouteState')
  const routeEnd = appSource.indexOf('function switchView', routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)
  const helpersStart = appSource.indexOf('function restoredPageTags')
  const helpersEnd = appSource.indexOf('async function openRestoredPageDetail', helpersStart)
  const helpersSource = appSource.slice(helpersStart, helpersEnd)
  const upsertStart = appSource.indexOf('function upsertRestoredPageFromBackend')
  const upsertEnd = appSource.indexOf('function factoryTaskTypeLabel', upsertStart)
  const upsertSource = appSource.slice(upsertStart, upsertEnd)
  const createAssetStart = workspaceSource.indexOf('export function createRestoredPageAsset')
  const createAssetEnd = workspaceSource.indexOf('export function captureActionState', createAssetStart)
  const createAssetSource = workspaceSource.slice(createAssetStart, createAssetEnd)

  assert.match(appSource, /const factoryHomeTab = ref\('image-code'\)/)
  assert.match(routeSource, /openFactoryHome\(options\.factoryTab \|\| 'image-code'\)/)
  assert.match(helpersSource, /function restoredPageTags\(page = \{\}\)/)
  assert.match(helpersSource, /图片转代码/)
  assert.match(helpersSource, /html/)
  assert.match(helpersSource, /vue/)
  assert.match(helpersSource, /function formatRestoredPageTime\(page = \{\}\)/)
  assert.match(upsertSource, /restoreKind:\s*restoredPage\.restoreKind \|\| 'image-to-code'/)
  assert.match(upsertSource, /normalizedRestoredPage\.tags = restoredPageTags\(normalizedRestoredPage\)/)
  assert.match(createAssetSource, /restoreKind:\s*captureResult\.raw\?\.captureKind \|\| 'image-to-code'/)
  assert.match(createAssetSource, /const tags = \[/)
  assert.match(createAssetSource, /\n\s+tags,\n/)
  assert.match(createAssetSource, /'图片转代码'/)
  assert.match(createAssetSource, /rawHtml \? 'html'/)
  assert.match(createAssetSource, /codeFormat === 'vue' \? 'vue'/)
  assert.match(backendModelSource, /restoreKind:\s*input\.restoreKind \|\| input\.captureResult\?\.raw\?\.captureKind \|\| 'image-to-code'/)
  assert.match(backendModelSource, /tags:\s*Array\.isArray\(input\.tags\) \? input\.tags : \[\]/)
})

testAsync('restored page cards use lightweight backend preview urls instead of overview html', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const factoryHomeStart = appSource.indexOf(`state.currentFactoryRoute === 'home'`)
  const factoryHomeEnd = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`, factoryHomeStart)
  const factoryHomeSource = appSource.slice(factoryHomeStart, factoryHomeEnd)
  const restoredAssetsStart = factoryHomeSource.indexOf('restored-assets-section')
  const restoredAssetsEnd = factoryHomeSource.indexOf('<div v-else class="materials-empty">', restoredAssetsStart)
  const restoredAssetsSource = factoryHomeSource.slice(restoredAssetsStart, restoredAssetsEnd)

  assert.match(restoredAssetsSource, /restoredPagePreviewFrameSrc\(page\)/)
  assert.doesNotMatch(restoredAssetsSource, /:srcdoc="page\.html"/)
})

testAsync('image to code composer uses Doubao style restore upload layout', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryHomeStart = appSource.indexOf(`state.currentFactoryRoute === 'home'`)
  const factoryHomeEnd = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`, factoryHomeStart)
  const factoryHomeSource = appSource.slice(factoryHomeStart, factoryHomeEnd)
  const imageComposerSource = factoryHomeSource.slice(
    factoryHomeSource.indexOf("factoryHomeTab === 'image-code'"),
    factoryHomeSource.indexOf("factoryHomeTab === 'url-code'")
  )

  assert.match(appSource, /今天你想要/)
  assert.match(appSource, /还原/)
  assert.match(imageComposerSource, /image-restore-composer/)
  assert.match(imageComposerSource, /image-restore-dropzone/)
  assert.match(imageComposerSource, /image-restore-upload-tile/)
  assert.match(imageComposerSource, /image-restore-footer/)
  assert.match(imageComposerSource, /上传截图、设计稿或参考图/)
  assert.match(imageComposerSource, /生成页面代码/)
  assert.match(css, /\.image-restore-composer/)
  assert.match(css, /\.image-restore-upload-tile/)
  assert.match(css, /\.image-restore-actions/)
})

testAsync('image to code upload preview stays contained inside the composer', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.capture-entry-panel \.agent-composer\s*\{[\s\S]*?width:\s*min\(100%,\s*860px\)/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?width:\s*64px/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?height:\s*64px/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?margin:\s*0;/)
  assert.doesNotMatch(css, /\.image-prompt-upload\s*\{[\s\S]*?margin:\s*0 0 0 14px/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?border:\s*2px solid #fff/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?border-radius:\s*8px/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?box-shadow:\s*none/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?overflow:\s*hidden/)
  assert.match(css, /\.image-prompt-upload\s*\{[\s\S]*?transform:\s*rotate\(-7deg\)/)
  assert.match(css, /\.image-prompt-upload:hover\s*\{[\s\S]*?transform:\s*rotate\(-7deg\)/)
  assert.doesNotMatch(css, /\.image-prompt-upload span\s*\{[\s\S]*?transform:\s*rotate\(7deg\)/)
  assert.doesNotMatch(css, /\.image-prompt-upload img\s*\{[\s\S]*?transform:\s*rotate\(7deg\)/)
  assert.doesNotMatch(css, /\.image-prompt-upload:hover span,\s*\n\.image-prompt-upload:hover img\s*\{[\s\S]*?transform:/)
  assert.match(css, /\.image-prompt-upload img\s*\{[\s\S]*?width:\s*100%/)
  assert.match(css, /\.image-prompt-upload img\s*\{[\s\S]*?height:\s*100%/)
  assert.match(css, /\.image-prompt-upload img\s*\{[\s\S]*?object-fit:\s*contain/)
  assert.match(css, /\.image-prompt-upload img\s*\{[\s\S]*?max-width:\s*100%/)
  assert.match(css, /\.image-prompt-upload img\s*\{[\s\S]*?max-height:\s*100%/)
})

testAsync('web factory home removes extra top and asset gap spacing', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryRule = css.match(/\.factory-view\s*\{[\s\S]*?\}/)?.[0] || ''
  const captureRule = css.match(/\.capture-entry-panel\s*\{[\s\S]*?\}/)?.[0] || ''
  const assetsRule = css.match(/\.restored-assets-section\s*\{[\s\S]*?\}/)?.[0] || ''

  assert.match(factoryRule, /padding-top:\s*0/)
  assert.match(factoryRule, /background:\s*radial-gradient\(circle at 50% 10%, rgba\(105, 225, 245, 0\.16\), transparent 28%\)/)
  assert.match(captureRule, /min-height:\s*auto/)
  assert.match(captureRule, /padding:\s*96px 24px 22px/)
  assert.match(captureRule, /background:\s*transparent/)
  assert.match(assetsRule, /margin-top:\s*0/)
})

testAsync('web factory composer frames share one sizing system', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  const composerRule = css.match(/\.capture-entry-panel\s+\.agent-composer\s*\{[\s\S]*?\}/)?.[0] || ''
  assert.match(composerRule, /--factory-composer-padding-x:\s*24px/)
  assert.match(composerRule, /--factory-composer-padding-y:\s*22px/)
  assert.match(composerRule, /--factory-composer-control-bottom:\s*22px/)
  assert.match(composerRule, /--factory-composer-control-left:\s*24px/)
  assert.match(composerRule, /--factory-composer-control-gap:\s*120px/)
  assert.match(composerRule, /padding:\s*var\(--factory-composer-padding-y\) var\(--factory-composer-padding-x\) 70px/)

  assert.match(css, /\.composer-actions\s*\{[\s\S]*?right:\s*var\(--factory-composer-padding-x\)/)
  assert.match(css, /\.composer-actions\s*\{[\s\S]*?bottom:\s*var\(--factory-composer-control-bottom\)/)
  assert.match(css, /\.composer-chip-menu\s*\{[\s\S]*?left:\s*var\(--factory-composer-control-left\)/)
  assert.match(css, /\.composer-chip-menu\s*\{[\s\S]*?bottom:\s*var\(--factory-composer-control-bottom\)/)
  assert.match(css, /\.composer-chip-select:nth-of-type\(1\)\s*\{[\s\S]*?left:\s*var\(--factory-composer-control-left\)/)
  assert.match(css, /\.composer-chip-select:nth-of-type\(2\)\s*\{[\s\S]*?left:\s*calc\(var\(--factory-composer-control-left\) \+ var\(--factory-composer-control-gap\)\)/)
  assert.doesNotMatch(css, /\.capture-entry-panel\s+\.image-code-composer\s*\{[\s\S]*?padding:/)
  assert.doesNotMatch(css, /\.image-code-composer\s+\.composer-actions\s*\{[\s\S]*?(right|bottom):/)
  assert.doesNotMatch(css, /\.image-code-composer\s+\.composer-chip-select\s*\{[\s\S]*?(left|bottom):/)
})

testAsync('web factory home spacing follows the design workflow entry rhythm', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const captureRule = css.match(/\.capture-entry-panel\s*\{[\s\S]*?\}/)?.[0] || ''
  const workflowRule = css.match(/\.workflow-capture-entry\s*\{[\s\S]*?\}/)?.[0] || ''

  assert.match(workflowRule, /padding-top:\s*96px/)
  assert.match(workflowRule, /padding-bottom:\s*22px/)
  assert.match(captureRule, /padding:\s*96px 24px 22px/)
  assert.match(captureRule, /min-height:\s*auto/)
  assert.doesNotMatch(captureRule, /padding:\s*84px 24px 0/)
  assert.doesNotMatch(captureRule, /padding:\s*168px 24px 64px/)
})

testAsync('agent floating cards use unified roomy padding', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.agent-reference-card\s*\{[\s\S]*?padding:\s*20px;/)
  assert.match(css, /\.agent-message\s*\{[\s\S]*?padding:\s*20px;/)
})

testAsync('capture API returns backend timing metadata', async () => {
  const result = await routes['POST /api/capture/start']({ url: 'https://example.com' })
  assert.ok(result.timing.durationMs >= 0)
  assert.ok(result.timing.estimatedSeconds > 0)
  assert.equal(result.raw.durationMs, result.timing.durationMs)
  assert.equal(result.raw.estimatedSeconds, result.timing.estimatedSeconds)
  assert.equal(result.timing.source, 'backend-current-run')
  assert.equal(typeof result.raw.singleFileCaptured, 'boolean')
  assert.equal(typeof result.raw.domSnapshotCaptured, 'boolean')
  assert.equal(typeof result.raw.singleFileError, 'string')
  assert.equal(typeof result.raw.domSnapshotError, 'string')
  assert.equal(typeof result.singleFileHtml, 'string')
  if (result.raw.singleFileCaptured) assert.ok(result.singleFileHtml.includes('<html'))
  if (result.raw.domSnapshotCaptured) assert.ok(result.domSnapshot)
})

testAsync('backend capture routes expose web factory endpoints through injected services', async () => {
  const backendRoutes = captureRoutes({
    createBrowserSession: async (payload) => ({ sessionId: 'session-test', projectId: payload.projectId, status: 'active' }),
    previewBrowserSession: async (payload) => ({ sessionId: payload.sessionId, status: 'active', screenshot: 'data:image/png;base64,preview' }),
    browserSessionAction: async (payload) => ({ sessionId: payload.sessionId, status: 'ok', action: payload.type }),
    closeBrowserSession: async (payload) => ({ sessionId: payload.sessionId, status: 'closed' }),
    captureStart: async (payload) => ({ taskId: 'capture-test', url: payload.url, status: 'completed' }),
    generatePage: async (payload) => ({ taskId: 'generate-test', html: payload.html || '<main>ok</main>' }),
    captureResult: async (payload) => ({ taskId: payload.taskId, status: 'completed' }),
    latestResult: async () => ({ taskId: 'latest-test', status: 'completed' })
  })

  assert.equal((await backendRoutes['POST /api/browser-sessions/create']({ projectId: 'project-flow' })).sessionId, 'session-test')
  assert.equal((await backendRoutes['POST /api/browser-sessions/preview']({ sessionId: 'session-test' })).status, 'active')
  assert.equal((await backendRoutes['POST /api/browser-sessions/action']({ sessionId: 'session-test', type: 'scroll' })).action, 'scroll')
  assert.equal((await backendRoutes['POST /api/browser-sessions/close']({ sessionId: 'session-test' })).status, 'closed')
  assert.equal((await backendRoutes['POST /api/capture/start']({ url: 'https://example.com' })).taskId, 'capture-test')
  assert.equal((await backendRoutes['POST /api/capture/generate-page']({ html: '<main>generated</main>' })).html, '<main>generated</main>')
  assert.equal((await backendRoutes['GET /api/capture/tasks/:taskId/result']({ taskId: 'capture-test' })).taskId, 'capture-test')
  assert.equal((await backendRoutes['GET /api/capture/tasks/latest/result']()).taskId, 'latest-test')
})

testAsync('backend capture task store persists every run and resolves latest result', async () => {
  const { createCaptureTaskStore } = await import('../后端/services/capture-task-store.js')
  let id = 0
  const taskStore = createCaptureTaskStore({
    uuid: () => `task-${++id}`,
    now: (() => {
      let time = 1000
      return () => {
        time += 100
        return time
      }
    })()
  })
  const runner = {
    makeCaptureResult: async (payload) => ({
      taskId: 'runner-result-id',
      url: payload.url,
      status: 'completed',
      title: `Captured ${payload.url}`,
      raw: { transport: 'unit' }
    })
  }

  const first = await taskStore.runTask({ projectId: 'project-flow', url: 'https://example.com' }, runner)
  const second = await taskStore.runTask({ projectId: 'project-flow', url: 'https://example.com' }, runner)
  const storedFirst = taskStore.result(first.taskId)
  const storedSecond = taskStore.result(second.taskId)
  const latest = taskStore.latestResult()

  assert.equal(first.taskId, 'task-1')
  assert.equal(second.taskId, 'task-2')
  assert.notEqual(first.taskId, second.taskId)
  assert.equal(storedFirst.result.taskId, 'task-1')
  assert.equal(storedSecond.result.taskId, 'task-2')
  assert.equal(storedSecond.result.url, 'https://example.com')
  assert.equal(latest.taskId, 'task-2')
  assert.equal(latest.result.title, 'Captured https://example.com')
  assert.equal(storedSecond.status, 'success')
  assert.equal(storedSecond.sourceType, 'url')
})

testAsync('backend capture task store persists failed capture tasks', async () => {
  const { createCaptureTaskStore } = await import('../后端/services/capture-task-store.js')
  const taskStore = createCaptureTaskStore({
    uuid: () => 'task-failed',
    now: () => 1000
  })
  const runner = {
    makeCaptureResult: async () => {
      throw new Error('capture exploded')
    }
  }

  await assert.rejects(
    () => taskStore.runTask({ url: 'https://example.com/fail' }, runner),
    /capture exploded/
  )

  const stored = taskStore.result('task-failed')
  assert.equal(stored.taskId, 'task-failed')
  assert.equal(stored.status, 'failed')
  assert.equal(stored.error.message, 'capture exploded')
  assert.equal(stored.result, null)
})

testAsync('mock api mounts capture routes from backend route module', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const routesStart = source.indexOf('export function createMockApiRoutes')
  const routesEnd = source.indexOf("'POST /api/generate/react-vite'", routesStart)
  const routeSource = source.slice(routesStart, routesEnd)

  assert.match(source, /import \{ captureRoutes \} from '\.\.\/后端\/routes\/capture\.js'/)
  assert.match(source, /const captureApiRoutes = captureRoutes\(/)
  assert.match(source, /export const routes = createMockApiRoutes/)
  assert.match(routeSource, /\.\.\.captureApiRoutes/)
  assert.doesNotMatch(routeSource, /'POST \/api\/capture\/start'/)
  assert.doesNotMatch(routeSource, /'POST \/api\/browser-sessions\/create'/)
})

testAsync('backend capture service owns page generation quality gate', async () => {
  const { generatePageFromCapturePayload } = await import('../后端/services/capture-service.js')
  const captureResult = {
    title: 'Screenshot only',
    url: 'https://example.com/screenshot-only',
    screenshot: solidPngDataUrl(320, 480, [255, 255, 255, 255]),
    pages: [{ screenshot: solidPngDataUrl(320, 480, [255, 255, 255, 255]) }],
    layoutNodes: [],
    raw: { layoutNodeCount: 0, screenshotCaptured: true }
  }

  const result = await generatePageFromCapturePayload({ captureResult }, {
    generatedPageHtml: () => '<main>should not render</main>',
    verifyGeneratedPage: async () => ({ status: 'passed' })
  })

  assert.equal(result.status, 'blocked')
  assert.equal(result.html, '')
  assert.match(result.message, /没有采集到可还原 DOM 节点/)
  assert.equal(result.visualVerification.status, 'blocked')
})

testAsync('backend capture service returns generated html and visual verification', async () => {
  const { generatePageFromCapturePayload } = await import('../后端/services/capture-service.js')
  const singleFileHtml = '<!doctype html><html><body><main><h1>SingleFile 页面</h1></main></body></html>'
  const captureResult = {
    title: 'SingleFile restore',
    url: 'https://example.com/singlefile',
    singleFileHtml,
    layoutNodes: [],
    raw: { singleFileCaptured: true, layoutNodeCount: 0 }
  }

  const result = await generatePageFromCapturePayload({ captureResult }, {
    generatedPageHtml: () => singleFileHtml,
    verifyGeneratedPage: async (_captureResult, html) => ({
      url: 'https://example.com/singlefile',
      status: html === singleFileHtml ? 'passed' : 'failed',
      summary: { averageScore: 100 }
    })
  })

  assert.equal(result.html, singleFileHtml)
  assert.equal(result.summary, '已使用 SingleFile 生成高保真静态 HTML。')
  assert.equal(result.visualVerification.status, 'passed')
})

testAsync('backend capture service can persist generated html as restored page asset', async () => {
  const { generatePageFromCapturePayload } = await import('../后端/services/capture-service.js')
  const html = '<!doctype html><html><body><main><h1>持久化还原页面</h1></main></body></html>'
  const captureResult = {
    title: '持久化还原页面',
    url: 'https://example.com/persisted',
    singleFileHtml: html,
    screenshot: pngDataUrl([9, 9, 9]),
    layoutNodes: [],
    raw: { singleFileCaptured: true, layoutNodeCount: 0 }
  }
  const persisted = []

  const result = await generatePageFromCapturePayload({
    projectId: 'project-flow',
    captureResult,
    palette: {},
    designRules: {}
  }, {
    generatedPageHtml: () => html,
    verifyGeneratedPage: async () => ({
      url: captureResult.url,
      status: 'passed',
      summary: { averageScore: 100 }
    }),
    persistRestoredPage: async (asset) => {
      persisted.push(asset)
      return { ...asset, id: 'restored-from-capture-service' }
    }
  })

  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].projectId, 'project-flow')
  assert.equal(persisted[0].sourceUrl, 'https://example.com/persisted')
  assert.equal(persisted[0].html, html)
  assert.equal(persisted[0].files.find((file) => file.path === 'index.html').content, html)
  assert.equal(persisted[0].visualVerification.status, 'passed')
  assert.equal(result.restoredPage.id, 'restored-from-capture-service')
  assert.equal(result.restoredPage.html, html)
})

testAsync('backend capture runner assembles capture result from injected target capture', async () => {
  const { createCaptureRunner } = await import('../后端/services/capture-runner.js')
  const runner = createCaptureRunner({
    uuid: () => 'capture-test-id',
    now: (() => {
      const times = [1000, 5400]
      return () => times.shift() ?? 5400
    })(),
    designRules: {
      colors: {
        primary: '#111111',
        canvas: '#ffffff',
        ink: '#222222',
        border: '#eeeeee',
        shell: '#f7f7f7',
        accentCyan: '#00ffff'
      },
      layout: { spacing: [8, 16] }
    },
    decodeEntities: (value) => value,
    pickMeta: () => '',
    extractTextBlocks: () => [],
    extractImages: () => [],
    extractLinks: () => [],
    captureTarget: async () => ({
      ok: true,
      statusCode: 200,
      finalUrl: 'https://example.com/final',
      html: '<html><head><title>Runner Page</title></head><body><h1>Runner</h1></body></html>',
      transport: 'unit-capture',
      screenshotDataUrl: pngDataUrl([1, 2, 3]),
      singleFileHtml: '<!doctype html><html><body>single</body></html>',
      singleFileError: '',
      domSnapshot: { documents: [{ nodes: { nodeName: ['HTML'] } }] },
      domSnapshotError: '',
      snapshot: {
        title: 'Runner Page',
        description: 'Runner description',
        textBlocks: [{ tag: 'h1', text: 'Runner' }],
        images: [{ type: 'image', name: 'Logo', source: 'https://example.com/logo.png' }],
        links: [{ text: 'Docs', href: 'https://example.com/docs' }],
        layoutNodes: [{ id: 'title', type: 'text', text: 'Runner', x: 0, y: 0, width: 100, height: 24 }],
        designTree: { id: 'root', type: 'container', children: [{ id: 'title', type: 'text', text: 'Runner' }] },
        viewport: { width: 1280, height: 720 },
        pageBackground: '#fafafa'
      }
    })
  })

  const result = await runner.makeCaptureResult({
    url: 'https://example.com',
    authMode: 'none',
    captureKind: 'internal-web-snapshot',
    output: 'html'
  })

  assert.equal(result.taskId, 'capture-test-id')
  assert.equal(result.status, 'completed')
  assert.equal(result.title, 'Runner Page')
  assert.equal(result.raw.authMode, 'public')
  assert.equal(result.raw.transport, 'unit-capture')
  assert.equal(result.raw.durationMs, 4400)
  assert.equal(result.timing.estimatedSeconds, 11)
  assert.equal(result.raw.singleFileCaptured, true)
  assert.equal(result.raw.domSnapshotCaptured, true)
  assert.equal(result.layoutNodes.length, 1)
  assert.equal(result.designTree.id, 'root')
  assert.equal(result.pageBackground, '#fafafa')
  assert.match(result.pages[0].summary, /SingleFile/)
  assert.match(result.pages[0].summary, /DOMSnapshot/)
})

testAsync('backend capture runner records fallback capture failures as partial result', async () => {
  const { createCaptureRunner } = await import('../后端/services/capture-runner.js')
  const runner = createCaptureRunner({
    uuid: () => 'capture-fallback-id',
    now: (() => {
      const times = [2000, 3000]
      return () => times.shift() ?? 3000
    })(),
    designRules: {
      colors: {
        primary: '#111111',
        canvas: '#ffffff',
        ink: '#222222',
        border: '#eeeeee',
        shell: '#f7f7f7',
        accentCyan: '#00ffff'
      },
      layout: { spacing: [8, 16] }
    },
    decodeEntities: (value) => value,
    pickMeta: () => '',
    extractTextBlocks: () => [],
    extractImages: () => [],
    extractLinks: () => [],
    captureTarget: async () => {
      throw new Error('Chrome failed')
    },
    fallbackCaptureTarget: async () => {
      throw new Error('fetch failed')
    }
  })

  const result = await runner.makeCaptureResult({ url: 'https://example.com/fail', authMode: 'cookie' })

  assert.equal(result.taskId, 'capture-fallback-id')
  assert.equal(result.status, 'partial')
  assert.match(result.pages[0].summary, /Chrome failed; fallback: fetch failed/)
  assert.equal(result.raw.authMode, 'cookie')
  assert.equal(result.raw.fetched, false)
  assert.equal(result.raw.fetchError, 'Chrome failed; fallback: fetch failed')
  assert.equal(result.raw.singleFileCaptured, false)
  assert.equal(result.raw.domSnapshotCaptured, false)
})

testAsync('mock api delegates capture generation to backend capture service', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')

  assert.match(source, /import \{ generatePageFromCapturePayload \} from '\.\.\/后端\/services\/capture-service\.js'/)
  assert.doesNotMatch(source, /async function generatePageFromCapturePayload/)
  assert.match(source, /generatePageFromCapturePayload\(payload,\s*\{[\s\S]*generatedPageHtml[\s\S]*verifyGeneratedPage[\s\S]*\}\)/)
})

testAsync('mock api injects restored page persistence into capture generation service', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')

  assert.match(source, /persistRestoredPage:\s*async\s*\(asset\)\s*=>\s*addRestoredPage\(workspaceStore,\s*asset\)/)
})

testAsync('mock api delegates capture start to backend capture runner', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')

  assert.match(source, /import \{ createCaptureRunner \} from '\.\.\/后端\/services\/capture-runner\.js'/)
  assert.match(source, /import \{ createCaptureTaskStore \} from '\.\.\/后端\/services\/capture-task-store\.js'/)
  assert.match(source, /const captureRunner = createCaptureRunner\(/)
  assert.match(source, /const captureTaskStore = createCaptureTaskStore\(/)
  assert.match(source, /captureStart: async \(payload\) => captureTaskStore\.runTask\(payload,\s*captureRunner\)/)
  assert.match(source, /captureResult: async \(payload\) => captureTaskStore\.result\(payload\.taskId\)/)
  assert.match(source, /latestResult: async \(\) => captureTaskStore\.latestResult\(\)/)
  assert.doesNotMatch(source, /export async function makeCaptureResult/)
})

testAsync('browser session routes create reusable project scoped login sessions', async () => {
  const created = await routes['POST /api/browser-sessions/create']({
    projectId: 'project-flow',
    url: 'https://example.com/login'
  })

  assert.equal(created.status, 'active')
  assert.equal(created.projectId, 'project-flow')
  assert.ok(created.sessionId.startsWith('session_'))
  assert.match(created.debuggingUrl, /^http:\/\/127\.0\.0\.1:\d+$/)
  assert.equal(created.loginUrl, 'https://example.com/login')

  const closed = await routes['POST /api/browser-sessions/close']({
    sessionId: created.sessionId
  })
  assert.equal(closed.status, 'closed')
  assert.equal(closed.sessionId, created.sessionId)
})

testAsync('browser session manager can allocate ports without opening local sockets', async () => {
  const manager = createBrowserSessionManager({
    launchChrome: false,
    allocatePort: async () => 44557
  })
  const created = await manager.createSession({
    projectId: 'project-flow',
    url: 'https://example.com/login'
  })

  assert.equal(created.port, 44557)
  assert.equal(created.debuggingUrl, 'http://127.0.0.1:44557')
  await manager.closeSession(created.sessionId)
})

testAsync('browser session routes expose embedded preview and actions', async () => {
  const created = await routes['POST /api/browser-sessions/create']({
    projectId: 'project-flow',
    url: 'https://example.com/login'
  })

  const preview = await routes['POST /api/browser-sessions/preview']({
    sessionId: created.sessionId
  })
  assert.equal(preview.sessionId, created.sessionId)
  assert.equal(preview.status, 'active')
  assert.equal(preview.url, 'https://example.com/login')
  assert.match(preview.screenshot, /^data:image\/png;base64,/)

  const action = await routes['POST /api/browser-sessions/action']({
    sessionId: created.sessionId,
    type: 'navigate',
    url: 'https://example.com/dashboard'
  })
  assert.equal(action.status, 'ok')
  assert.equal(action.sessionId, created.sessionId)
  assert.equal(action.url, 'https://example.com/dashboard')

  const scroll = await routes['POST /api/browser-sessions/action']({
    sessionId: created.sessionId,
    type: 'scroll',
    deltaY: 480
  })
  assert.equal(scroll.status, 'ok')
  assert.equal(scroll.action, 'scroll')

  const back = await routes['POST /api/browser-sessions/action']({
    sessionId: created.sessionId,
    type: 'back'
  })
  assert.equal(back.status, 'ok')

  const forward = await routes['POST /api/browser-sessions/action']({
    sessionId: created.sessionId,
    type: 'forward'
  })
  assert.equal(forward.status, 'ok')

  await routes['POST /api/browser-sessions/close']({ sessionId: created.sessionId })
})

testAsync('browser authorization uses manual login instead of collecting credentials', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const serverSource = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const captureAfterStart = appSource.indexOf('async function captureAfterManualBrowserLogin')
  const captureAfterEnd = appSource.indexOf('function clickBrowserPreview', captureAfterStart)
  const captureAfterSource = appSource.slice(captureAfterStart, captureAfterEnd)

  assert.match(appSource, /async function openManualBrowserAuthorization/)
  assert.match(appSource, /async function captureAfterManualBrowserLogin/)
  assert.match(appSource, /我已登录，开始采集/)
  assert.match(captureAfterSource, /await runCaptureTask\(\)/)
  assert.doesNotMatch(captureAfterSource, /createBrowserSession\(\)/)
  assert.doesNotMatch(appSource, /type:\s*'login'/)
  assert.doesNotMatch(serverSource, /async function performBrowserLogin/)
  assert.doesNotMatch(serverSource, /loginSubmitted/)
  assert.doesNotMatch(serverSource, /accountSelector|passwordSelector|submitSelector/)
})

testAsync('remote browser capture requires a valid browser session instead of silently falling back', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const captureTargetStart = source.indexOf('captureTarget: async (payload) => {')
  const captureTargetEnd = source.indexOf('  },\n  fallbackCaptureTarget', captureTargetStart)
  const captureTargetSource = source.slice(captureTargetStart, captureTargetEnd)

  assert.match(captureTargetSource, /if \(payload\.authMode === 'browser' && !browserSession\)/)
  assert.match(captureTargetSource, /CAPTURE_BROWSER_SESSION_MISSING/)
  assert.match(captureTargetSource, /throw error/)
  assert.match(captureTargetSource, /captureWithRemoteBrowser\(payload\.url,\s*browserSession\)/)
  assert.doesNotMatch(captureTargetSource, /browserSession && !isTestRuntime\s*\?/)
})

testAsync('remote browser capture reuses the logged-in page instead of opening a new one', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const captureStart = source.indexOf('async function captureWithRemoteBrowser')
  const captureEnd = source.indexOf('function placeholderBrowserScreenshot', captureStart)
  const captureSource = source.slice(captureStart, captureEnd)

  assert.match(captureSource, /context\.pages\(\)\[0\]/)
  assert.match(captureSource, /page\.url\(\)/)
  assert.match(captureSource, /session\.currentUrl = page\.url\(\)/)
  assert.match(captureSource, /capturePreparedPage\(page,\s*captureUrl/)
  assert.match(captureSource, /跳过会重新打开页面的 SingleFile 捕获/)
  assert.doesNotMatch(captureSource, /context\.newPage\(\)/)
  assert.doesNotMatch(captureSource, /captureSingleFileHtml\([^)]*remoteDebuggingUrl/)
})

testAsync('cookie capture parses pasted cookie text before session capture', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  const captureTargetStart = source.indexOf('captureTarget: async (payload) => {')
  const captureTargetEnd = source.indexOf('  },\n  fallbackCaptureTarget', captureTargetStart)
  const captureTargetSource = source.slice(captureTargetStart, captureTargetEnd)

  assert.match(source, /function parseCookieText\(cookieText = '', fallbackDomain = ''\)/)
  assert.match(source, /String\(cookieText \|\| ''\)[\s\S]*\.split\(';'\)/)
  assert.match(captureTargetSource, /const cookieSession = normalizeCookieSession\(sessionPayload,\s*payload\.url\)/)
  assert.match(captureTargetSource, /cookieSession\.cookies\?\.length/)
  assert.match(captureTargetSource, /captureWithChromeAndSession\(payload\.url,\s*cookieSession\)/)
})

test('restored page preview falls back to generated pageData files when html is missing', () => {
  const html = restoredPagePreviewHtml({
    title: '源码还原页',
    html: '',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "源码还原页",
          "viewport": { "width": 1440, "height": 900 },
          "pageBackground": "#ffffff",
          "nodes": [
            { "id": "hero", "type": "text", "tag": "h1", "x": 40, "y": 48, "width": 360, "height": 64, "text": "Hello Preview", "style": { "fontSize": "32px", "color": "#222529" } }
          ]
        }`
      }
    ]
  })

  assert.match(html, /<!doctype html>/)
  assert.match(html, /Hello Preview/)
  assert.doesNotMatch(html, /无法打开页面预览/)
})

test('restored page preview renders designTree from generated pageData files', () => {
  const html = restoredPagePreviewHtml({
    title: '设计树还原页',
    html: '',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "设计树还原页",
          "viewport": { "width": 1440, "height": 900 },
          "pageBackground": "#ffffff",
          "designTree": {
            "id": "root",
            "type": "container",
            "tag": "main",
            "text": "",
            "style": { "position": "relative", "width": "1440px", "minHeight": "900px", "backgroundColor": "#ffffff" },
            "children": [
              {
                "id": "title",
                "type": "text",
                "tag": "h1",
                "text": "Design Tree Preview",
                "style": { "fontSize": "40px", "color": "#222529" },
                "children": []
              }
            ]
          },
          "nodes": []
        }`
      }
    ]
  })

  assert.match(html, /Design Tree Preview/)
  assert.match(html, /tree-node/)
  assert.doesNotMatch(html, /无法打开页面预览/)
})

test('restored page preview ignores empty generated shells and falls back to pageData', () => {
  const html = restoredPagePreviewHtml({
    title: '旧空白资产',
    html: '<!doctype html><html><body><main><section class="stage"></section></main></body></html>',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "旧空白资产",
          "viewport": { "width": 1440, "height": 900 },
          "pageBackground": "#ffffff",
          "nodes": [
            { "id": "hero", "type": "text", "tag": "h1", "x": 48, "y": 56, "width": 460, "height": 72, "text": "Visible fallback", "style": { "fontSize": "36px", "color": "#222529" } }
          ]
        }`
      }
    ]
  })

  assert.match(html, /Visible fallback/)
  assert.doesNotMatch(html, /<section class="stage"><\/section>/)
})

test('normalization repairs old restored pages that saved blank preview html', () => {
  const state = normalizeFactoryWorkspace({
    currentFactoryRoute: 'restored-detail',
    restoredPages: [
      {
        id: 'old-page',
        projectId: 'project-flow',
        title: '旧空白资产',
        html: '<!doctype html><html><body><main><section class="stage"></section></main></body></html>',
        files: [
          {
            path: 'src/pageData.js',
            content: `export const pageData = {
              "title": "旧空白资产",
              "viewport": { "width": 1440, "height": 900 },
              "nodes": [
                { "id": "hero", "type": "text", "tag": "h1", "x": 48, "y": 56, "width": 460, "height": 72, "text": "Repaired preview", "style": { "fontSize": "36px", "color": "#222529" } }
              ]
            }`
          }
        ]
      }
    ],
    selectedRestoredPageId: 'old-page'
  })

  assert.match(state.restoredPages[0].html, /Repaired preview/)
  assert.doesNotMatch(state.restoredPages[0].html, /<section class="stage"><\/section>/)
})

test('restored page preview falls back to captured cover image when source data cannot render', () => {
  const html = restoredPagePreviewHtml({
    title: '截图兜底资产',
    html: '',
    coverImage: 'data:image/png;base64,cover-image',
    files: []
  })

  assert.match(html, /截图兜底资产/)
  assert.match(html, /data:image\/png;base64,cover-image/)
  assert.doesNotMatch(html, /无法打开页面预览/)
})

test('restored page preview structure mode shows pageData nodes when cover exists', () => {
  const html = restoredPagePreviewHtml({
    title: '有截图的源码还原页',
    coverImage: 'data:image/png;base64,cover',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "有截图的源码还原页",
          "viewport": { "width": 1440, "height": 900 },
          "nodes": [
            {
              "id": "hero",
              "type": "text",
              "tag": "h1",
              "text": "可见标题",
              "x": 40,
              "y": 40,
              "width": 400,
              "height": 60,
              "style": { "fontSize": "32px", "color": "rgb(17, 24, 39)" }
            }
          ]
        };`
      }
    ]
  }, { mode: 'structure' })

  assert.doesNotMatch(html, /<img class="capture-cover-layer"/)
  assert.match(html, /可见标题/)
})

test('restored page preview screenshot mode does not duplicate captured text nodes', () => {
  const page = {
    title: '截图模式',
    coverImage: 'data:image/png;base64,cover',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "截图模式",
          "viewport": { "width": 1440, "height": 900 },
          "nodes": [
            {
              "id": "title",
              "type": "text",
              "tag": "h1",
              "text": "截图里已经有的标题",
              "x": 40,
              "y": 40,
              "width": 480,
              "height": 60,
              "style": { "fontSize": "32px", "color": "rgb(17, 24, 39)" }
            }
          ]
        };`
      }
    ]
  }

  const screenshotHtml = restoredPagePreviewHtml(page, { mode: 'screenshot', device: 'desktop', zoom: 0.5 })
  assert.match(screenshotHtml, /data-preview-mode="screenshot"/)
  assert.match(screenshotHtml, /transform:scale\(0.5\)/)
  assert.match(screenshotHtml, /capture-cover-layer/)
  assert.doesNotMatch(screenshotHtml, /截图里已经有的标题/)

  const structureHtml = restoredPagePreviewHtml(page, { mode: 'structure', device: 'mobile', zoom: 1 })
  assert.match(structureHtml, /data-preview-mode="structure"/)
  assert.match(structureHtml, /width:390px/)
  assert.doesNotMatch(structureHtml, /<img class="capture-cover-layer"/)
  assert.match(structureHtml, /截图里已经有的标题/)
})

test('restored page preview compare mode exposes screenshot and generated panes', () => {
  const html = restoredPagePreviewHtml({
    title: '对照模式',
    coverImage: 'data:image/png;base64,cover',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "对照模式",
          "viewport": { "width": 1440, "height": 900 },
          "nodes": [
            { "id": "title", "type": "text", "tag": "h1", "text": "生成层标题", "x": 40, "y": 40, "width": 400, "height": 60, "style": { "fontSize": "32px", "color": "#111" } }
          ]
        };`
      }
    ]
  }, { mode: 'compare', device: 'tablet', zoom: 0.75 })

  assert.match(html, /data-preview-mode="compare"/)
  assert.match(html, /compare-pane screenshot-pane/)
  assert.match(html, /compare-pane structure-pane/)
  assert.match(html, /width:1024px/)
  assert.match(html, /生成层标题/)
})

test('html-only compare mode renders static html before original screenshot', () => {
  const html = '<!doctype html><html><body><main><h1>HTML真实页面</h1></main></body></html>'
  const preview = restoredPagePreviewHtml({
    title: 'HTML 对照页',
    sourceUrl: 'https://example.test/html',
    coverImage: 'data:image/png;base64,cover',
    html,
    files: [{ path: 'index.html', content: html }]
  }, { mode: 'compare', device: 'desktop', zoom: 0.25 })

  assert.match(preview, /data-preview-mode="compare"/)
  assert.match(preview, /compare-pane screenshot-pane/)
  assert.match(preview, /原网页截图/)
  assert.match(preview, /capture-cover-layer/)
  assert.match(preview, /compare-pane html-pane/)
  assert.match(preview, /HTML 还原页面/)
  assert.ok(preview.indexOf('compare-pane html-pane') < preview.indexOf('compare-pane screenshot-pane'))
  assert.match(preview, /class="html-preview-frame"/)
  assert.match(preview, /HTML真实页面/)
  assert.match(preview, /class="compare-scale-frame"/)
  assert.match(preview, /transform:scale\(0.25\)/)
  assert.doesNotMatch(preview, /capture-cover-stage"[^>]*transform:scale/)
  assert.doesNotMatch(preview, /html-stage-inner"[^>]*transform:scale/)
  assert.doesNotMatch(preview, /<div class="html-structure-panel"/)
})

test('restored page preview prefers saved static html over generated pageData files', () => {
  const html = '<!doctype html><html><body><main><h1>真正静态HTML</h1></main></body></html>'
  const preview = restoredPagePreviewHtml({
    title: '静态 HTML 优先',
    coverImage: 'data:image/png;base64,cover',
    html,
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "源码数据",
          "nodes": [
            { "id": "hero", "type": "text", "tag": "h1", "x": 32, "y": 32, "width": 300, "height": 64, "text": "PageData 不应优先", "style": { "fontSize": "32px", "color": "#222529" } }
          ]
        }`
      }
    ]
  }, { mode: 'compare', device: 'desktop', zoom: 0.25 })

  assert.match(preview, /真正静态HTML/)
  assert.match(preview, /HTML 还原页面/)
  assert.match(preview, /原网页截图/)
  assert.doesNotMatch(preview, /PageData 不应优先/)
})

test('restored page preview shows generation progress when html is still rendering', () => {
  const preview = restoredPagePreviewHtml({
    title: '生成中的页面',
    sourceUrl: 'https://example.test/loading',
    coverImage: 'data:image/png;base64,cover',
    html: '',
    files: []
  }, { mode: 'compare', device: 'desktop', zoom: 0.25, loading: true, loadingView: captureLoadingExperience(12, { estimatedSeconds: 24 }) })

  assert.match(preview, /data-preview-loading="true"/)
  assert.match(preview, /原网页截图/)
  assert.match(preview, /HTML 还原生成中/)
  assert.match(preview, /capture-loading-copy/)
  assert.match(preview, /预计 24 秒/)
})

test('restored page preview structure mode does not render full white surface nodes', () => {
  const html = restoredPagePreviewHtml({
    title: '白色容器快照',
    coverImage: 'data:image/png;base64,cover',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "白色容器快照",
          "viewport": { "width": 1440, "height": 900 },
          "nodes": [
            {
              "id": "surface",
              "type": "surface",
              "tag": "div",
              "x": 0,
              "y": 0,
              "width": 1440,
              "height": 900,
              "style": { "backgroundColor": "rgb(255, 255, 255)" }
            },
            {
              "id": "title",
              "type": "text",
              "tag": "h1",
              "text": "截图上方文本",
              "x": 40,
              "y": 40,
              "width": 400,
              "height": 60,
              "style": { "fontSize": "32px", "color": "rgb(17, 24, 39)" }
            }
          ]
        };`
      }
    ]
  }, { mode: 'structure' })

  assert.doesNotMatch(html, /id="surface"/)
  assert.doesNotMatch(html, /background:rgb\(255, 255, 255\)/)
  assert.doesNotMatch(html, /<img class="capture-cover-layer"/)
  assert.match(html, /截图上方文本/)
})

test('restored page preview structure mode avoids design tree white surface when cover exists', () => {
  const html = restoredPagePreviewHtml({
    title: '结构树白屏快照',
    coverImage: 'data:image/png;base64,cover',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "结构树白屏快照",
          "viewport": { "width": 1440, "height": 900 },
          "designTree": {
            "id": "body",
            "tag": "body",
            "type": "container",
            "text": "",
            "style": { "display": "block", "width": "1440px", "height": "900px", "backgroundColor": "rgb(255, 255, 255)" },
            "children": []
          },
          "nodes": [
            {
              "id": "title",
              "type": "text",
              "tag": "h1",
              "text": "结构树上方文本",
              "x": 40,
              "y": 40,
              "width": 400,
              "height": 60,
              "style": { "fontSize": "32px", "color": "rgb(17, 24, 39)" }
            }
          ]
        };`
      }
    ]
  }, { mode: 'structure' })

  assert.doesNotMatch(html, /<img class="capture-cover-layer"/)
  assert.match(html, /结构树上方文本/)
  assert.doesNotMatch(html, /tree-container/)
})

test('restored page preview summary exposes visible pageData diagnostics', () => {
  const summary = restoredPagePreviewSummary({
    title: '诊断预览',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "诊断预览",
          "sourceUrl": "https://example.com",
          "nodes": [
            { "id": "hero", "type": "text", "tag": "h1", "text": "首屏标题" },
            { "id": "cta", "type": "text", "tag": "button", "text": "开始使用" }
          ]
        }`
      }
    ]
  })

  assert.equal(summary.title, '诊断预览')
  assert.equal(summary.nodeCount, 2)
  assert.deepEqual(summary.samples, ['首屏标题', '开始使用'])
  assert.equal(summary.sourceUrl, 'https://example.com')
})

test('restored page preview prefers saved html over pageData when static html exists', () => {
  const html = restoredPagePreviewHtml({
    title: '优先静态 HTML',
    html: '<!doctype html><html><body><main>Saved HTML Shell</main></body></html>',
    files: [
      {
        path: 'src/pageData.js',
        content: `export const pageData = {
          "title": "优先源码数据",
          "nodes": [
            { "id": "hero", "type": "text", "tag": "h1", "x": 32, "y": 32, "width": 300, "height": 64, "text": "PageData Wins", "style": { "fontSize": "32px", "color": "#222529" } }
          ]
        }`
      }
    ]
  })

  assert.match(html, /Saved HTML Shell/)
  assert.doesNotMatch(html, /PageData Wins/)
})

test('html-only restored page preview responds to mode and device controls', () => {
  const page = {
    title: 'HTML 控制预览',
    sourceUrl: 'https://example.test/page',
    html: '<!doctype html><html><body><main><h1>HTML 还原</h1></main></body></html>',
    files: [{ path: 'index.html', content: '<!doctype html><html><body><main><h1>HTML 还原</h1></main></body></html>' }]
  }

  const structure = restoredPagePreviewHtml(page, { mode: 'structure', device: 'mobile', zoom: 0.8 })
  const compare = restoredPagePreviewHtml(page, { mode: 'compare', device: 'tablet', zoom: 0.5 })

  assert.match(structure, /data-preview-mode="structure"/)
  assert.match(structure, /data-preview-device="mobile"/)
  assert.match(structure, /width:390px/)
  assert.match(compare, /data-preview-mode="compare"/)
  assert.match(compare, /compare-grid/)
  assert.match(compare, /width:1024px/)
})

test('html-only restored page preview shows static page iframe before code', () => {
  const page = {
    title: '静态页面还原',
    html: '<!doctype html><html><body><main><h1>用户先看到页面</h1></main></body></html>',
    files: [{ path: 'index.html', content: '<!doctype html><html><body><main><h1>用户先看到页面</h1></main></body></html>' }]
  }
  const preview = restoredPagePreviewHtml(page, { mode: 'screenshot', device: 'desktop', zoom: 0.72 })

  assert.match(preview, /class="html-preview-frame"/)
  assert.match(preview, /srcdoc=/)
  assert.match(preview, /用户先看到页面/)
  assert.doesNotMatch(preview, /<pre class=/)
})

testAsync('restored detail keeps source code behind an explicit source action', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(detailSource, /查看源码/)
  assert.match(detailSource, /v-if="showRestoredSource"/)
  assert.doesNotMatch(appSource, /showRestoredSource\\.value = true/)
})

testAsync('restored page cards open standalone result shell and keep project-owned assets', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryHomeStart = appSource.indexOf(`state.currentFactoryRoute === 'home'`)
  const factoryHomeEnd = appSource.indexOf(`state.currentFactoryRoute === 'capture-detail'`, factoryHomeStart)
  const factoryHomeSource = appSource.slice(factoryHomeStart, factoryHomeEnd)
  const restoreStart = appSource.indexOf('function restoreFactoryRouteFromUrl')
  const restoreEnd = appSource.indexOf('function restoreWorkflowAnalysisFromUrl', restoreStart)
  const restoreSource = appSource.slice(restoreStart, restoreEnd)
  const standaloneStart = appSource.indexOf('async function openRestoredPageStandalone')
  const standaloneEnd = appSource.indexOf('function persistRestoredPageSelection', standaloneStart)
  const standaloneSource = appSource.slice(standaloneStart, standaloneEnd)
  const upsertStart = appSource.indexOf('function upsertRestoredPageFromBackend')
  const upsertEnd = appSource.indexOf('function factoryTaskTypeLabel', upsertStart)
  const upsertSource = appSource.slice(upsertStart, upsertEnd)

  assert.match(factoryHomeSource, /:href="previewTaskUrl\(page\.id\)"/)
  assert.match(factoryHomeSource, /target="_blank"/)
  assert.match(factoryHomeSource, /rel="noopener noreferrer"/)
  assert.match(factoryHomeSource, /@click\.prevent="openRestoredPageStandalone\(page\.id\)"/)
  assert.doesNotMatch(factoryHomeSource, /@click="persistRestoredPageSelection\(page\.id\)"/)
  assert.doesNotMatch(factoryHomeSource, /@click="openRestoredPageDetail\(page\.id\)"/)
  assert.doesNotMatch(factoryHomeSource, /:href="restoredPageDetailHref\(page\.id\)"/)
  assert.match(standaloneSource, /async function openRestoredPageStandalone\(pageId\)/)
  assert.match(standaloneSource, /const previewWindow = window\.open\(restoredPageDetailHref\(pageId\),\s*'_blank'\)/)
  assert.match(standaloneSource, /await openRestoredPageDetail\(pageId,\s*\{\s*syncRoute:\s*false\s*\}\)/)
  assert.match(standaloneSource, /buildStaticHtmlResultShell\(html,\s*page\.title/)
  assert.match(standaloneSource, /thumbnail:\s*page\.coverImage/)
  assert.match(standaloneSource, /taskId:\s*page\.id/)
  assert.match(standaloneSource, /assetId:\s*page\.id/)
  assert.match(standaloneSource, /homeUrl:\s*projectScopedRoute\('\/factory',\s*page\.projectId \|\| state\.currentProjectId\)/)
  assert.match(standaloneSource, /writeStaticHtmlPreviewWindow\(previewWindow,\s*resultHtml\)/)
  assert.match(upsertSource, /projectId:\s*restoredPage\.projectId \|\| state\.currentProjectId/)
  assert.match(appSource, /const currentRestoredPages = computed\(\(\) => restoredPagesForProject\(state\.restoredPages,\s*state\.currentProjectId\)\)/)
  assert.match(appSource, /function restoredPageDetailHref\(pageId\)/)
  assert.match(appSource, /function persistRestoredPageSelection\(pageId\)/)
  assert.match(appSource, /function openRestoredPageDetailInNewTab\(pageId\)/)
  assert.match(appSource, /projectScopedUrl\(`\/assets\/\$\{encodeURIComponent\(pageId\)\}\/preview`\)/)
  assert.match(appSource, /window\.open\(url,\s*'_blank'\)/)
  assert.match(restoreSource, /route\.match\(\/\^\\\/\(\?:factory\\\/restored\|assets\)/)
  assert.match(restoreSource, /window\.location\.hash\.match\(/)
  assert.match(restoreSource, /#\\\/factory\\\/restored\\\//)
  assert.match(restoreSource, /\[\^\/\?\#\]\+/)
  assert.match(restoreSource, /decodeURIComponent\(match\[1\]\)/)
  assert.match(restoreSource, /state\.currentFactoryRoute\s*=\s*'restored-detail'/)
  assert.match(restoreSource, /void openRestoredPageDetail\(pageId\)/)
  const detailViewRule = cssSource.match(/\.factory-detail-view\s*\{[\s\S]*?\}/)?.[0] || ''
  assert.doesNotMatch(detailViewRule, /inset:\s*0;/)
  assert.match(cssSource, /\.factory-detail-view\s*\{[\s\S]*?inset:\s*0 0 0 72px/)
})

testAsync('restored detail header keeps action buttons horizontal and visible', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(detailSource, /<div class="factory-detail-actions actions">/)
  assert.doesNotMatch(detailSource, /<div class="actions">/)
  assert.match(cssSource, /\.factory-detail-header\s*\{[\s\S]*?grid-template-columns:\s*40px minmax\(0,\s*1fr\)/)
  assert.match(cssSource, /\.factory-detail-actions\s*\{[\s\S]*?display:\s*flex/)
  assert.match(cssSource, /\.factory-detail-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap/)
  assert.match(cssSource, /\.factory-detail-actions\s*\{[\s\S]*?overflow-x:\s*auto/)
  assert.match(cssSource, /\.factory-detail-actions button\s*\{[\s\S]*?white-space:\s*nowrap/)
})

testAsync('restored detail defaults to compare mode with static html result', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(appSource, /value:\s*'html',\s*label:\s*'HTML 结果'/)
  assert.match(appSource, /value:\s*'compare',\s*label:\s*'对照'/)
  assert.doesNotMatch(appSource, /value:\s*'structure',\s*label:\s*'结构'/)
  assert.match(appSource, /mode:\s*'compare'/)
  assert.match(appSource, /restoredPreview\.mode = 'compare'/)
  assert.match(detailSource, /selectedRestoredPreviewHtml/)
})

testAsync('restored detail prioritizes html code and original snapshot comparison', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)
  const compareStart = detailSource.indexOf('class="restored-compare-stage"')
  const compareEnd = detailSource.indexOf('</section>', compareStart)
  const compareSource = detailSource.slice(compareStart, compareEnd)

  assert.match(detailSource, /restored-compare-stage/)
  assert.match(compareSource, /html-code-pane/)
  assert.match(compareSource, /original-snapshot-pane/)
  assert.match(compareSource, /<strong>html<\/strong>/)
  assert.match(compareSource, /code-preview-button/)
  assert.match(compareSource, /预览/)
  assert.match(compareSource, /<pre class="restored-code-block"><code>{{ selectedRestoredFileContent }}<\/code><\/pre>/)
  assert.doesNotMatch(compareSource, /iframe title="静态 HTML 还原结果"/)
  assert.doesNotMatch(compareSource, /sandbox="[^"]*allow-scripts/)
  assert.doesNotMatch(compareSource, /sandbox="[^"]*allow-same-origin/)
  assert.doesNotMatch(detailSource, /sandbox="[^"]*allow-scripts/)
  assert.doesNotMatch(detailSource, /sandbox="[^"]*allow-same-origin/)
  assert.match(compareSource, /selectedRestoredPage\?\.coverImage/)
  assert.ok(compareSource.indexOf('html-code-pane') < compareSource.indexOf('original-snapshot-pane'))
  assert.match(detailSource, /restored-source-actions/)
  assert.match(detailSource, /查看源码/)
  assert.match(detailSource, /下载 HTML/)
  assert.match(cssSource, /\.restored-compare-stage\s*\{/)
  assert.match(cssSource, /\.html-code-pane\s*\{/)
  assert.match(cssSource, /\.restored-code-block\s*\{/)
  assert.match(cssSource, /\.code-preview-button\s*\{/)
  assert.match(cssSource, /\.original-snapshot-pane\s*\{/)
})

testAsync('restored detail removes redundant status and acceptance summary chrome', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(detailSource, /openRestoredPreviewInNewTab/)
  assert.match(detailSource, /restored-compare-stage/)
  assert.doesNotMatch(detailSource, /selectedRestoredPage\?\.title \|\| '还原页面详情'/)
  assert.doesNotMatch(detailSource, /selectedRestoredPage\?\.sourceUrl \|\| '来自网页工厂生成结果'/)
  assert.doesNotMatch(detailSource, /restored-preview-mode-label/)
  assert.doesNotMatch(detailSource, /restored-preview-status/)
  assert.doesNotMatch(detailSource, /restored-preview-samples/)
  assert.doesNotMatch(detailSource, /visual-verification-strip/)
  assert.doesNotMatch(detailSource, /visual-acceptance-report/)
  assert.doesNotMatch(detailSource, /视觉验收报告/)
  assert.doesNotMatch(detailSource, /视觉验收通过/)
  assert.doesNotMatch(detailSource, /静态 HTML 预览/)
})

testAsync('restored detail comparison labels live html and original snapshot clearly', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)
  const compareStart = detailSource.indexOf('class="restored-compare-stage"')
  const compareEnd = detailSource.indexOf('</section>', compareStart)
  const compareSource = detailSource.slice(compareStart, compareEnd)

  assert.match(compareSource, /compare-pane-label/)
  assert.match(compareSource, /<strong>html<\/strong>/)
  assert.match(compareSource, /code-preview-button/)
  assert.match(compareSource, /右侧 · 原始截图/)
  assert.match(cssSource, /\.compare-pane-label\s*\{/)
  assert.match(cssSource, /\.restored-compare-stage\s*\{[\s\S]*?align-items:\s*stretch/)
  assert.match(cssSource, /\.restored-code-block\s*\{[\s\S]*?height:\s*min\(72vh,\s*760px\)/)
  assert.match(cssSource, /\.original-snapshot-frame\s*\{[\s\S]*?height:\s*min\(72vh,\s*760px\)/)
})

testAsync('web factory keeps generation task status in a modal center', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const factoryStart = appSource.indexOf("isFactoryView && state.currentFactoryRoute === 'home'")
  const factoryEnd = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'", factoryStart)
  const factorySource = appSource.slice(factoryStart, factoryEnd)

  assert.match(appSource, /showFactoryTaskCenter/)
  assert.match(appSource, /factoryTaskRecords/)
  assert.match(appSource, /recordFactoryTask\(/)
  assert.match(appSource, /updateFactoryTask\(/)
  assert.match(appSource, /retryFactoryTask\(/)
  assert.match(appSource, /recordFactoryTask\('capture'/)
  assert.match(appSource, /recordFactoryTask\('generate'/)
  assert.match(appSource, /updateFactoryTask\(task\.id/)
  assert.match(appSource, /aria-label="生成任务中心"/)
  assert.match(appSource, /生成任务/)
  assert.match(appSource, /失败原因/)
  assert.match(appSource, /重新执行/)
  assert.doesNotMatch(factorySource, /@click="showFactoryTaskCenter = true"/)
  assert.doesNotMatch(factorySource, />生成任务</)
  assert.doesNotMatch(factorySource, /class="factory-task-list"/)
  assert.match(cssSource, /\.factory-task-modal\s*\{/)
  assert.match(cssSource, /\.factory-task-list\s*\{/)
})

testAsync('restored detail keeps visual acceptance logic out of the visible detail chrome', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const detailEnd = appSource.indexOf('<section v-if="activeView === \'projects\'"')
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(appSource, /function selectedVisualFailureReason/)
  assert.match(appSource, /async function regenerateSelectedRestoredPage/)
  assert.doesNotMatch(detailSource, /visual-acceptance-report/)
  assert.doesNotMatch(detailSource, /selectedVisualFailureReason\(\)/)
  assert.doesNotMatch(cssSource, /\.visual-acceptance-report\s*\{/)
})

testAsync('main content shell uses zero padding', async () => {
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const mainRule = cssSource.match(/\.main\s*\{[\s\S]*?\}/)?.[0] || ''

  assert.match(mainRule, /padding:\s*0;/)
  assert.doesNotMatch(mainRule, /padding:\s*24px/)
})

testAsync('web factory capture detail hides the global sidebar', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)

  assert.match(appSource, /const isSidebarHidden = computed/)
  assert.match(appSource, /state\.currentFactoryRoute === 'capture-detail'/)
  assert.match(appSource, /window\.location\.hash === '#\/factory\/capture'/)
  assert.match(appSource, /'sidebar-hidden': isSidebarHidden/)
  assert.match(appSource, /<template v-if="!isSidebarHidden">\s*<aside class="sidebar">/)
  assert.match(cssSource, /\.app-shell\.sidebar-hidden\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(cssSource, /\.sidebar-hidden\s+\.factory-detail-view\s*\{[\s\S]*?inset:\s*0;/)
  assert.match(captureDetailSource, /class="factory-detail-view"/)
})

testAsync('app shell declares favicon to avoid browser 404 noise', async () => {
  const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const faviconSource = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')

  assert.match(htmlSource, /rel="icon"/)
  assert.match(htmlSource, /href="\/favicon\.svg"/)
  assert.match(faviconSource, /<svg/)
})

testAsync('web factory requests dom restore mode for html results', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generatePageFromCapture')
  const generateEnd = appSource.indexOf('function generatedPageBlobUrl')
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(generateSource, /restoreMode:\s*'dom'/)
})

testAsync('web factory handles quality gate blocks before saving restored assets', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generatePageFromCapture')
  const generateEnd = appSource.indexOf('function generatedPageBlobUrl')
  const generateSource = appSource.slice(generateStart, generateEnd)
  const qualityGateIndex = generateSource.indexOf('data?.qualityGate')
  const upsertIndex = generateSource.indexOf('upsertRestoredPageFromBackend')

  assert.ok(qualityGateIndex > 0)
  assert.ok(upsertIndex > qualityGateIndex)
  assert.match(generateSource, /diagnosticReport/)
  assert.match(generateSource, /采集质量门禁未通过/)
  assert.doesNotMatch(generateSource, /saveRestoredPageAsset/)
  assert.doesNotMatch(generateSource, /createRestoredPage/)
})

testAsync('web factory uses backend persisted restored page returned by generation', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generatePageFromCapture')
  const generateEnd = appSource.indexOf('function generatedPageBlobUrl')
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(generateSource, /data\.restoredPage/)
  assert.match(generateSource, /upsertRestoredPageFromBackend\(data\.restoredPage/)
  assert.match(generateSource, /if \(!data\.restoredPage\)/)
  assert.doesNotMatch(generateSource, /saveRestoredPageAsset/)
  assert.doesNotMatch(generateSource, /createRestoredPage/)
})

testAsync('web factory generation hydrates restored detail from backend static html asset', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generatePageFromCapture')
  const generateEnd = appSource.indexOf('function generatedPageBlobUrl')
  const generateSource = appSource.slice(generateStart, generateEnd)
  const detailStart = appSource.indexOf('async function openRestoredPageDetail')
  const detailEnd = appSource.indexOf('function captureDurationLabel', detailStart)
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(generateSource, /await openRestoredPageDetail\(restoredPage\.id\)/)
  assert.match(detailSource, /api\.workspace\.getRestoredPage\(state\.apiConfig,\s*pageId\)/)
  assert.match(detailSource, /api\.workspace\.previewRestoredPage\(state\.apiConfig,\s*pageId\)/)
  assert.match(detailSource, /api\.workspace\.sourceRestoredPage\(state\.apiConfig,\s*pageId\)/)
  assert.match(detailSource, /const html = preview\?\.html\s*\|\|\s*backendPage\?\.html\s*\|\|\s*currentPage\.html\s*\|\|\s*''/)
  assert.match(detailSource, /html,\s*\n\s*files:/)
  assert.match(detailSource, /files:\s*ensureIndexHtmlFile\(files,\s*preview\?\.html\s*\|\|\s*backendPage\?\.html\s*\|\|\s*currentPage\.html\s*\|\|\s*''\)/)
})

testAsync('restored detail normalizes backend legacy image screenshot html before rendering', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const detailStart = appSource.indexOf('async function openRestoredPageDetail')
  const detailEnd = appSource.indexOf('function handleImageCodeFile', detailStart)
  const detailSource = appSource.slice(detailStart, detailEnd)

  assert.match(detailSource, /normalizeFactoryWorkspace\(\{\s*restoredPages:\s*\[nextPage\]/)
  assert.match(detailSource, /const normalizedPage = normalizedDetail\.restoredPages\[0\]/)
  assert.match(detailSource, /normalizedPage,\s*\n\s*\.\.\.state\.restoredPages\.filter/)
})

testAsync('web factory regenerates a new restored asset even when the same URL already has an asset', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)

  assert.doesNotMatch(captureDetailSource, /currentCaptureRestoredPage\s*\?\s*openCurrentCaptureRestoredPage/)
  assert.match(captureDetailSource, /@click=\"generatePageFromCapture\(\{\s*openPreview:\s*false\s*\}\)\"/)
  assert.match(captureDetailSource, /生成高保真 HTML/)
})

testAsync('web factory disables 1:1 restore when capture readiness fails', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)

  assert.match(appSource, /captureRestoreReadiness/)
  assert.match(appSource, /captureReadiness/)
  assert.match(captureDetailSource, /:disabled="[^"]*!captureReadiness\.canRestore/)
  assert.match(captureDetailSource, /captureReadiness\.reason/)
  assert.match(captureDetailSource, /生成高保真 HTML/)
})

testAsync('web factory capture detail surfaces html generation progress and failure reason', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)
  const generateApiStart = apiSource.indexOf('generatePage(config, payload)')
  const generateApiEnd = apiSource.indexOf('result(config, taskId)', generateApiStart)
  const generateApiSource = apiSource.slice(generateApiStart, generateApiEnd)

  assert.match(captureDetailSource, /class="\['restore-generation-status', pageGenerationStatus\.status\]"/)
  assert.match(captureDetailSource, /pageGenerationStatus\.message/)
  assert.match(captureDetailSource, /pageGenerationStatus\.status !== 'idle'/)
  assert.match(captureDetailSource, /正在根据采集结果生成页面/)
  assert.match(captureDetailSource, /采集不足或目标站返回错误页/)
  assert.match(captureDetailSource, /重新生成 HTML/)
  assert.match(generateApiSource, /timeoutMs:\s*180000/)
  assert.match(styles, /\.restore-generation-status\s*\{/)
  assert.match(styles, /\.restore-generation-status\.failed\s*\{/)
  assert.match(styles, /\.restore-generation-status\.loading\s*\{/)
})

testAsync('web factory capture detail exposes recovery actions when html generation is blocked', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)

  assert.match(captureDetailSource, /pageGenerationStatus\.status === 'failed'/)
  assert.match(captureDetailSource, /restore-generation-recovery/)
  assert.match(captureDetailSource, /captureRecoveryFlows/)
  assert.match(captureDetailSource, /goRecoveryFlow\(flow\.id\)/)
  assert.match(captureDetailSource, /没有生成正式 HTML/)
  assert.match(styles, /\.restore-generation-recovery\s*\{/)
  assert.match(styles, /\.restore-generation-recovery-actions\s*\{/)
})

testAsync('web factory capture result status is not overwritten by html generation failures', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)
  const panelHeadStart = captureDetailSource.indexOf('<div class="panel-head">')
  const panelHeadEnd = captureDetailSource.indexOf('<div class="metric-grid">', panelHeadStart)
  const panelHeadSource = captureDetailSource.slice(panelHeadStart, panelHeadEnd)

  assert.match(appSource, /const captureResultPanelStatus = computed/)
  assert.match(panelHeadSource, /<StatusBadge :status="captureResultPanelStatus"/)
  assert.doesNotMatch(panelHeadSource, /pageGenerationStatus\.status/)
  assert.match(captureDetailSource, /pageGenerationStatus\.status === 'loading'/)
})

testAsync('web factory capture detail offers recovery flows when capture fails without result', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const captureDetailStart = appSource.indexOf("state.currentFactoryRoute === 'capture-detail'")
  const captureDetailEnd = appSource.indexOf("state.currentFactoryRoute === 'restored-detail'")
  const captureDetailSource = appSource.slice(captureDetailStart, captureDetailEnd)

  assert.match(captureDetailSource, /captureStatus\.status === 'failed' && !state\.captureResult/)
  assert.match(captureDetailSource, /class="capture-failure-recovery"/)
  assert.match(captureDetailSource, /采集失败，可以换一种方式继续/)
  assert.match(captureDetailSource, /v-for="flow in captureRecoveryFlows"/)
  assert.match(captureDetailSource, /goRecoveryFlow\(flow\.id\)/)
  assert.match(captureDetailSource, /openFactoryHome\('url-code'\)/)
  assert.match(styles, /\.capture-failure-recovery\s*\{/)
  assert.match(styles, /\.capture-failure-actions\s*\{/)
})

test('html-only structure preview uses capture layout nodes when available', () => {
  const html = '<!doctype html><html><body><div class="hero"><span>视觉文本</span></div></body></html>'
  const preview = restoredPagePreviewHtml({
    title: '采集结构页',
    html,
    files: [{ path: 'index.html', content: html }],
    captureResult: {
      layoutNodes: [
        { tag: 'div', type: 'container', text: '', className: 'hero', rect: { width: 100, height: 80 } },
        { tag: 'span', type: 'text', text: '视觉文本', rect: { width: 80, height: 24 } }
      ]
    }
  }, { mode: 'structure', device: 'desktop', zoom: 1 })

  assert.match(preview, /2 个结构节点/)
  assert.match(preview, /&lt;div&gt;/)
  assert.match(preview, /hero/)
  assert.match(preview, /视觉文本/)
})

test('blocks advancing when required fields are missing', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-four-step')
  const run = createWorkflowRun(workflow, '想做一个用户画像功能')
  const gate = canAdvanceStep(run)
  assert.equal(gate.ok, false)
  assert.deepEqual(gate.missing, ['主要用户', '业务目标', '成功标准'])
})

test('produces output and advances through a workflow step', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-four-step')
  const run = createWorkflowRun(workflow, '想优化后台审批流程')
  run.stepInputs[run.currentStepId] = {
    主要用户: '运营审批人员',
    业务目标: '减少审批等待时间',
    成功标准: '平均审批时长降低 30%'
  }
  const output = produceStepOutput(run)
  assert.match(output.content, /五问法/)
  const advanced = completeCurrentStep(run, output.content)
  assert.equal(advanced.currentStepId, 'structure-breakdown')
  assert.equal(advanced.steps[0].status, 'completed')
  assert.equal(advanced.steps[1].status, 'active')
})

test('exports completed workflow as markdown asset', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'user-journey-map-flow')
  const run = createWorkflowRun(workflow, '给 AI Skill 工作台生成用户旅程')
  run.stepOutputs = {
    'journey-object': '主用户：产品交互设计师',
    'journey-boundary': '从模糊需求输入到资产沉淀',
    'journey-stages': '| 阶段 | 用户目标 |',
    'journey-touchpoints': '触点：项目诊断台',
    'journey-painpoints': '痛点：流程不可点击',
    'journey-actions': '设计动作：分步运行器',
    'journey-validation': '校验通过'
  }
  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /# 用户旅程地图/)
  assert.match(markdown, /## Step 1：确定旅程对象/)
  assert.match(markdown, /痛点：流程不可点击/)
})

test('provides interaction design workflow with seven precise steps', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'interaction-design-workflow')
  assert.ok(workflow)
  assert.equal(workflow.name, '交互方案生成')
  assert.equal(workflow.assetType, '交互方案')
  assert.deepEqual(workflow.steps.map((step) => step.id), [
    'interaction-diagnosis',
    'information-architecture',
    'core-task-flow',
    'page-structure',
    'component-states',
    'interaction-review',
    'delivery-breakdown'
  ])
  workflow.steps.forEach((step) => {
    assert.ok(step.title)
    assert.ok(step.goal)
    assert.ok(Array.isArray(step.requiredFields))
    assert.ok(step.requiredFields.length > 0)
    assert.ok(step.outputTitle)
  })
})

test('interaction design workflow blocks missing fields and produces diagnosis output', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'interaction-design-workflow')
  const run = createWorkflowRun(workflow, '后台 Skill 工作台全部挤在一个页面，用户无法完整点击流程')

  assert.deepEqual(canAdvanceStep(run), {
    ok: false,
    missing: ['目标用户', '核心问题', '成功标准']
  })

  run.stepInputs[run.currentStepId] = {
    目标用户: '产品交互设计师',
    核心问题: '功能都堆在一个页面，主流程不清楚',
    成功标准: '用户能从诊断进入流程并保存资产'
  }

  const output = produceStepOutput(run)
  assert.equal(output.title, '需求诊断卡')
  assert.match(output.content, /# 需求诊断卡/)
  assert.match(output.content, /产品交互设计师/)
  assert.match(output.content, /推荐下一步/)
})

test('interaction design workflow advances and exports all confirmed outputs', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'interaction-design-workflow')
  let run = createWorkflowRun(workflow, '重构流程通 Skill 工作台')
  const requiredInputsByStep = {
    'interaction-diagnosis': {
      目标用户: '交互设计师',
      核心问题: '页面信息架构混乱',
      成功标准: '完整流程可点击'
    },
    'information-architecture': {
      核心对象: '项目、Skill、流程、资产',
      导航结构: '项目诊断、流程运行、资产库、Skill 中心'
    },
    'core-task-flow': {
      主任务: '从需求进入 Skill 流程',
      关键分支: '信息不足时先诊断，信息足够时开始流程'
    },
    'page-structure': {
      关键页面: '项目诊断页、流程运行页、资产库页',
      主操作: '开始流程、确认步骤、保存资产'
    },
    'component-states': {
      关键组件: '步骤导航、输入表单、输出编辑器',
      异常状态: '缺少必填字段、输出为空、重复保存'
    },
    'interaction-review': {
      评审维度: '效率、一致性、可恢复性',
      主要风险: '用户不知道下一步动作'
    },
    'delivery-breakdown': {
      交付对象: '设计任务和开发任务',
      验收标准: '用户能完成至少前两步并保存资产'
    }
  }

  workflow.steps.forEach((step) => {
    run.stepInputs[run.currentStepId] = requiredInputsByStep[step.id]
    const output = produceStepOutput(run)
    run = completeCurrentStep(run, output.content)
  })

  assert.equal(run.status, 'completed')
  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /# 交互方案生成/)
  assert.match(markdown, /## Step 4：页面结构/)
  assert.match(markdown, /## Step 7：交付拆解/)
})

test('provides demand card flow with six card steps', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  assert.ok(workflow)
  assert.equal(workflow.name, '需求拆解卡片流')
  assert.equal(workflow.assetType, '需求拆解卡片资产')
  assert.deepEqual(workflow.steps.map((step) => step.id), [
    'card-requirement-understanding',
    'card-requirement-challenge',
    'card-scenario-breakdown',
    'card-solution-generation',
    'card-interaction-transform',
    'card-quality-validation'
  ])
})

test('workflow run starts with card state stores', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '做一个 AI 需求拆解工具')

  assert.deepEqual(run.stepDraftOutputs, {})
  assert.deepEqual(run.stepChallenges, {})
  assert.deepEqual(run.stepVersions, {})
  assert.equal(canEnterNextStep(run).ok, false)
  assert.equal(canEnterNextStep(run).reason, '当前步骤还未采纳')
})

test('generates draft output and accepts current card step', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '想把模糊需求拆成可执行交互方案')
  run.stepInputs[run.currentStepId] = {
    目标用户: '产品交互设计师',
    原始目标: '减少需求理解偏差'
  }

  const generated = generateStepDraft(run)
  assert.match(generated.stepDraftOutputs[run.currentStepId], /# 需求理解/)
  assert.equal(generated.stepVersions[run.currentStepId].length, 1)
  assert.equal(generated.stepVersions[run.currentStepId][0].accepted, false)

  const accepted = acceptCurrentStep(generated, generated.stepDraftOutputs[generated.currentStepId])
  assert.equal(accepted.stepOutputs['card-requirement-understanding'], generated.stepDraftOutputs[generated.currentStepId])
  assert.equal(accepted.stepVersions['card-requirement-understanding'][0].accepted, true)
  assert.equal(canEnterNextStep(accepted).ok, true)
})

test('regenerates card output from challenge and records versions', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '审批流程太乱，需要重新拆解')
  run.stepInputs[run.currentStepId] = {
    目标用户: '审批发起人',
    原始目标: '减少审批返工'
  }

  const generated = generateStepDraft(run)
  const challenged = regenerateStepDraft(generated, '补充 B 端权限和异常状态，不要只写主流程')

  assert.equal(challenged.stepChallenges[run.currentStepId].length, 1)
  assert.equal(challenged.stepVersions[run.currentStepId].length, 2)
  assert.match(challenged.stepDraftOutputs[run.currentStepId], /补充 B 端权限和异常状态/)
})

test('exports accepted card outputs with challenge history', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  let run = createWorkflowRun(workflow, '拆解 AI 工作流卡片')
  run.stepInputs[run.currentStepId] = {
    目标用户: 'UX 设计师',
    原始目标: '让 AI 产出可质疑'
  }

  run = generateStepDraft(run)
  run = regenerateStepDraft(run, '增加质疑和重新生成机制')
  run = acceptCurrentStep(run, run.stepDraftOutputs[run.currentStepId])

  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /# 需求拆解卡片流/)
  assert.match(markdown, /## Step 1：需求理解/)
  assert.match(markdown, /### 质疑记录/)
  assert.match(markdown, /增加质疑和重新生成机制/)
})

test('normalizes legacy workspace data into the default project', () => {
  const state = normalizeWorkspaceState({
    currentProjectId: 'missing-project',
    projects: [],
    knowledge: [{ id: 'k1', title: '旧知识' }],
    requirements: [{ id: 'r1', title: '旧需求' }],
    competitors: [{ id: 'c1', title: '旧竞品' }],
    assets: [{ id: 'a1', title: '旧资产' }],
    skillRuns: [{ id: 'run1', title: '旧运行' }],
    skills: []
  })

  assert.equal(state.currentProjectId, DEFAULT_PROJECT_ID)
  assert.equal(state.projects[0].id, DEFAULT_PROJECT_ID)
  assert.equal(state.knowledge[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.requirements[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.competitors[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.assets[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.skillRuns[0].projectId, DEFAULT_PROJECT_ID)
})

test('strips ephemeral workflow demo state when booting from saved workspace', () => {
  const savedState = {
    currentProjectId: 'project-flow',
    projects: [{ id: 'project-flow', name: '流程通默认项目' }],
    activeWorkflowRun: {
      id: 'run-demo',
      workflowId: 'podcastor-product-flow',
      projectId: 'project-flow',
      projectBlueprint: { title: 'Podcastor.ai 项目蓝图' }
    },
    generatedPageHtml: '<html>临时页面</html>',
    captureResult: { title: '临时采集' },
    reactFiles: [{ path: 'src/App.vue', content: 'temp' }],
    currentFactoryRoute: 'capture-detail',
    selectedRestoredPageId: 'restored-demo',
    assets: [
      {
        id: 'asset-1',
        projectId: 'project-flow',
        title: '已保存资产',
        blueprint: { title: 'Podcastor.ai 项目蓝图' }
      }
    ],
    skillRuns: [{ id: 'run-1', projectId: 'project-flow', title: '已保存运行记录' }]
  }

  const bootState = stripEphemeralWorkspaceState(savedState)

  assert.equal(bootState.activeWorkflowRun, null)
  assert.equal(bootState.generatedPageHtml, '')
  assert.equal(bootState.captureResult, null)
  assert.deepEqual(bootState.reactFiles, [])
  assert.equal(bootState.currentFactoryRoute, 'home')
  assert.equal(bootState.selectedRestoredPageId, '')
  assert.equal(bootState.assets.length, 1)
  assert.equal(bootState.skillRuns.length, 1)
})

testAsync('workspace API persists projects assets and run records as backend resources', async () => {
  const existingWorkspace = await routes['GET /api/workspace']()
  assert.equal(existingWorkspace.projects.filter((item) => item.name === '后端化项目').length, 0)
  const project = await routes['POST /api/workspace/projects']({
    name: '后端化项目',
    description: '用于验证资源边界'
  })
  const asset = await routes['POST /api/workspace/assets']({
    projectId: project.project.id,
    title: '真实资产',
    meta: '项目蓝图',
    status: '已保存',
    content: 'asset-content'
  })
  const run = await routes['POST /api/workspace/runs']({
    projectId: project.project.id,
    title: '真实运行记录',
    status: '已完成',
    content: 'run-content'
  })
  const workspace = await routes['GET /api/workspace']()

  assert.ok(workspace.projects.some((item) => item.id === project.project.id))
  assert.ok(workspace.assets.some((item) => item.id === asset.asset.id && item.projectId === project.project.id))
  assert.ok(workspace.skillRuns.some((item) => item.id === run.run.id && item.projectId === project.project.id))
  assert.ok(workspace.projects.length >= existingWorkspace.projects.length)
})

testAsync('backend workspace routes persist resources in an isolated store', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)

  const project = await backendRoutes['POST /api/workspace/projects']({
    name: '后端服务项目',
    targetUsers: '产品经理'
  })
  const asset = await backendRoutes['POST /api/workspace/assets']({
    projectId: project.project.id,
    title: '前后端拆分交付清单',
    type: 'delivery'
  })
  const run = await backendRoutes['POST /api/workspace/runs']({
    projectId: project.project.id,
    title: '后端服务运行记录',
    status: '已完成'
  })
  const workspace = await backendRoutes['GET /api/workspace']()

  assert.equal(project.project.name, '后端服务项目')
  assert.equal(project.project.targetUsers, '产品经理')
  assert.equal(asset.asset.projectId, project.project.id)
  assert.equal(run.run.projectId, project.project.id)
  assert.ok(workspace.projects.some((item) => item.id === project.project.id))
  assert.ok(workspace.assets.some((item) => item.id === asset.asset.id))
  assert.ok(workspace.skillRuns.some((item) => item.id === run.run.id))
})

testAsync('backend workspace store persists resources to a JSON file across instances', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-'))
  const filePath = join(dir, 'workspace.json')
  try {
    const firstStore = createWorkspaceStore({}, { filePath })
    const firstRoutes = workspaceRoutes(firstStore)
    const project = await firstRoutes['POST /api/workspace/projects']({ name: '文件持久化项目' })
    await firstRoutes['POST /api/workspace/assets']({
      projectId: project.project.id,
      title: '文件资产',
      content: 'saved-to-json'
    })

    const savedFile = JSON.parse(await readFile(filePath, 'utf8'))
    assert.ok(savedFile.projects.some((item) => item.id === project.project.id))

    const secondStore = createWorkspaceStore({}, { filePath })
    await secondStore.load()
    const secondWorkspace = await workspaceRoutes(secondStore)['GET /api/workspace']()

    assert.ok(secondWorkspace.projects.some((item) => item.id === project.project.id))
    assert.ok(secondWorkspace.assets.some((item) => item.title === '文件资产'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend workspace store persists orphan resource reassignment after loading a JSON file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-'))
  const filePath = join(dir, 'workspace.json')
  try {
    await writeFile(filePath, JSON.stringify({
      currentUserId: 'user-local-default',
      currentProjectId: 'project-flow',
      users: [{ id: 'user-local-default', name: '流程通用户' }],
      projects: [{ id: 'project-flow', name: '流程通默认项目' }],
      assets: [{ id: 'asset-a', projectId: 'project-podcastor', title: 'Podcastor 蓝图' }],
      skillRuns: [{ id: 'skill-run-a', projectId: 'project-podcastor', title: 'Podcastor 生成记录' }],
      materials: [{ id: 'material-a', projectId: 'project-podcastor', type: 'competitors', title: '竞品资料' }],
      parseJobs: [],
      restoredPages: [{ id: 'page-a', projectId: 'debug-codex-ccswitch', title: '调试恢复页' }],
      workflowRuns: [],
      skills: [],
      settings: []
    }), 'utf8')

    const store = createWorkspaceStore({}, { filePath })
    await store.load()
    const savedFile = JSON.parse(await readFile(filePath, 'utf8'))

    assert.ok(!savedFile.projects.some((project) => project.id === 'project-podcastor'))
    assert.ok(!savedFile.projects.some((project) => project.id === 'debug-codex-ccswitch'))
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-a').projectId, 'project-flow')
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-a').originProjectId, 'project-podcastor')
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-a').module, 'assets')
    assert.equal(savedFile.skillRuns.find((item) => item.id === 'skill-run-a').projectId, 'project-flow')
    assert.equal(savedFile.skillRuns.find((item) => item.id === 'skill-run-a').originProjectId, 'project-podcastor')
    assert.equal(savedFile.skillRuns.find((item) => item.id === 'skill-run-a').module, 'skills')
    assert.equal(savedFile.materials.find((item) => item.id === 'material-a').projectId, 'project-flow')
    assert.equal(savedFile.materials.find((item) => item.id === 'material-a').module, 'competitors')
    assert.equal(savedFile.restoredPages.find((item) => item.id === 'page-a').projectId, 'project-flow')
    assert.equal(savedFile.restoredPages.find((item) => item.id === 'page-a').originProjectId, 'debug-codex-ccswitch')
    assert.equal(savedFile.restoredPages.find((item) => item.id === 'page-a').module, 'factory')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend workspace store falls back to an owned real project when current project is orphaned', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-'))
  const filePath = join(dir, 'workspace.json')
  try {
    await writeFile(filePath, JSON.stringify({
      currentUserId: 'user-local-default',
      currentProjectId: 'project-podcastor',
      users: [{ id: 'user-local-default', name: '流程通用户' }],
      projects: [{ id: 'project-flow', ownerUserId: 'user-local-default', name: '流程通默认项目' }],
      assets: [{ id: 'asset-a', projectId: 'project-podcastor', title: 'Podcastor 蓝图' }],
      skillRuns: [],
      materials: [],
      restoredPages: [],
      workflowRuns: [],
      skills: [],
      settings: []
    }), 'utf8')

    const store = createWorkspaceStore({}, { filePath })
    await store.load()
    const savedFile = JSON.parse(await readFile(filePath, 'utf8'))

    assert.equal(savedFile.currentProjectId, 'project-flow')
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-a').projectId, 'project-flow')
    assert.equal(savedFile.assets.find((item) => item.id === 'asset-a').originProjectId, 'project-podcastor')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend workspace store backs up corrupt JSON and starts cleanly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-corrupt-'))
  const filePath = join(dir, 'workspace.json')
  try {
    await import('node:fs/promises').then(({ writeFile }) => writeFile(filePath, '{"projects":[', 'utf8'))

    const store = createWorkspaceStore({}, { filePath })
    const snapshot = await store.load()

    assert.ok(snapshot.projects.length >= 1)
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dir)
    assert.ok(files.some((file) => /^workspace\.json\.corrupt-/.test(file)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend workspace store does not overwrite corrupt workspace with default data after startup saves', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liuchengtong-workspace-corrupt-save-'))
  const filePath = join(dir, 'workspace.json')
  try {
    await writeFile(filePath, '{"projects":[', 'utf8')

    const store = createWorkspaceStore({}, { filePath })
    await store.load()
    await saveModelSettings(store, {
      provider: 'openai-compatible',
      apiKey: 'PROXY_MANAGED',
      baseUrl: 'http://127.0.0.1:15721/v1',
      defaultModel: 'gpt-5.5',
      apiSurface: 'responses',
      timeoutMs: 180000,
      fallback: 'deterministic',
      enabled: true
    })

    const raw = await readFile(filePath, 'utf8')
    assert.equal(raw, '{"projects":[')
    const files = await readdir(dir)
    assert.ok(files.some((file) => /^workspace\.json\.corrupt-/.test(file)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

testAsync('backend workspace routes persist factory restored pages and materials', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const restored = await backendRoutes['POST /api/workspace/restored-pages']({
    projectId: 'project-flow',
    title: '首页还原',
    sourceUrl: 'https://example.com',
    html: '<main>Restored</main>',
    visualVerification: { status: 'passed' }
  })
  const material = await backendRoutes['POST /api/workspace/materials']({
    projectId: 'project-flow',
    type: 'requirements',
    title: '需求文档 A',
    content: '需求内容'
  })
  await backendRoutes['DELETE /api/workspace/materials/:id']({ id: material.material.id })
  const workspace = await backendRoutes['GET /api/workspace']()

  assert.equal(restored.restoredPage.projectId, 'project-flow')
  assert.equal(restored.restoredPage.visualVerification.status, 'passed')
  assert.ok(workspace.restoredPages.some((item) => item.id === restored.restoredPage.id))
  assert.ok(!workspace.materials.some((item) => item.id === material.material.id))
})

testAsync('backend workspace overview omits heavy generated assets from list payload', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const largeImage = `data:image/png;base64,${'a'.repeat(300000)}`
  const largeHtml = `<!doctype html><html><body>${'b'.repeat(300000)}</body></html>`
  await backendRoutes['POST /api/workspace/restored-pages']({
    id: 'restored-heavy-overview',
    projectId: 'project-flow',
    title: '大型还原页面',
    sourceUrl: 'https://example.com/heavy',
    html: largeHtml,
    files: [{ path: 'index.html', content: largeHtml }],
    coverImage: largeImage,
    captureResult: {
      url: 'https://example.com/heavy',
      screenshot: largeImage,
      singleFileHtml: largeHtml,
      pages: [{ screenshot: largeImage }],
      layoutNodes: [{ id: 'node-a', text: '节点 A' }]
    }
  })
  await backendRoutes['POST /api/workspace/assets']({
    id: 'asset-heavy-overview',
    projectId: 'project-flow',
    title: '大型原型资产',
    type: 'prototype-demo',
    prototypeDemo: {
      screens: [{ id: 'screen-a', screenshotUrl: largeImage }],
      screenshotAssets: [{ id: 'shot-a', screenId: 'screen-a', screenshotUrl: largeImage }]
    },
    screenshotAssets: [{ id: 'shot-a', screenId: 'screen-a', screenshotUrl: largeImage }]
  })
  await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'workflow-heavy-overview',
    projectId: 'project-flow',
    workflowName: '大型分析运行',
    status: 'completed',
    documentAnalysis: {
      canvas: { nodes: [{ id: 'analysis', content: 'c'.repeat(300000) }] },
      blueprint: { versions: [{ snapshot: { blueprint: { content: 'd'.repeat(300000) } } }] }
    },
    projectBlueprint: { versions: [{ snapshot: { blueprint: { content: 'e'.repeat(300000) } } }] }
  })

  const workspace = await backendRoutes['GET /api/workspace']()
  const raw = JSON.stringify(workspace)
  const page = workspace.restoredPages.find((item) => item.id === 'restored-heavy-overview')
  const asset = workspace.assets.find((item) => item.id === 'asset-heavy-overview')
  const run = workspace.workflowRuns.find((item) => item.id === 'workflow-heavy-overview')

  assert.ok(raw.length < 200000, `workspace overview too large: ${raw.length}`)
  assert.equal(page.coverImage, '')
  assert.equal(page.html, '')
  assert.deepEqual(page.files, [])
  assert.equal(page.captureResult, null)
  assert.equal(page.frameUrl, '/api/workspace/restored-pages/restored-heavy-overview/frame')
  assert.equal(page.previewUrl, '/api/workspace/restored-pages/restored-heavy-overview/preview')
  assert.doesNotMatch(JSON.stringify(asset.prototypeDemo || {}), /data:image\/png/)
  assert.deepEqual(asset.screenshotAssets, [])
  assert.equal(run.documentAnalysis, null)
  assert.equal(run.projectBlueprint, null)
  assert.equal(run.hasDocumentAnalysisDetail, true)
  assert.equal(run.documentAnalysisSummary.nodeCount, 1)
  assert.equal(run.documentAnalysisSummary.hasCanvas, true)
})

testAsync('backend materials routes support project scoped list update and delete', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const projectA = 'project-material-a'
  const projectB = 'project-material-b'

  const first = await backendRoutes['POST /api/workspace/materials']({
    id: 'material-a-knowledge',
    projectId: projectA,
    type: 'knowledge',
    title: '知识条目 A',
    content: '原始知识内容'
  })
  await backendRoutes['POST /api/workspace/materials']({
    id: 'material-a-requirement',
    projectId: projectA,
    type: 'requirements',
    title: '需求文档 A',
    content: '需求内容'
  })
  await backendRoutes['POST /api/workspace/materials']({
    id: 'material-b-knowledge',
    projectId: projectB,
    type: 'knowledge',
    title: '其他项目知识',
    content: '不应该出现在项目 A'
  })

  const listed = await backendRoutes['GET /api/workspace/materials']({
    projectId: projectA,
    type: 'knowledge'
  })

  assert.deepEqual(listed.materials.map((item) => item.id), ['material-a-knowledge'])

  const updated = await backendRoutes['PATCH /api/workspace/materials/:id']({
    id: first.material.id,
    title: '知识条目 A 已编辑',
    content: '编辑后的知识内容'
  })

  assert.equal(updated.material.id, first.material.id)
  assert.equal(updated.material.title, '知识条目 A 已编辑')
  assert.equal(updated.material.content, '编辑后的知识内容')

  await backendRoutes['DELETE /api/workspace/materials/:id']({ id: first.material.id })
  const afterDelete = await backendRoutes['GET /api/workspace/materials']({
    projectId: projectA,
    type: 'knowledge'
  })

  assert.deepEqual(afterDelete.materials, [])
})

testAsync('backend restored page routes expose unified detail preview and source urls', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)

  const created = await backendRoutes['POST /api/workspace/restored-pages']({
    id: 'restored-unified-detail',
    projectId: 'project-flow',
    title: '统一详情页面',
    sourceUrl: 'https://example.com/source',
    html: '<!doctype html><html><body><main><h1>统一详情页面</h1></main></body></html>',
    files: [
      { path: 'index.html', content: '<!doctype html><html><body><main><h1>统一详情页面</h1></main></body></html>' },
      { path: 'README.md', content: '# 统一详情页面' }
    ],
    coverImage: 'data:image/png;base64,cover',
    visualVerification: { status: 'passed', summary: { averageScore: 99 } }
  })

  assert.equal(created.restoredPage.previewUrl, '/api/workspace/restored-pages/restored-unified-detail/preview')
  assert.equal(created.restoredPage.frameUrl, '/api/workspace/restored-pages/restored-unified-detail/frame')
  assert.equal(created.restoredPage.sourceUrlPath, '/api/workspace/restored-pages/restored-unified-detail/source')
  assert.equal(created.restoredPage.downloadUrl, '/api/workspace/restored-pages/restored-unified-detail/download')

  const detail = await backendRoutes['GET /api/workspace/restored-pages/:id']({
    id: created.restoredPage.id
  })

  assert.equal(detail.restoredPage.id, created.restoredPage.id)
  assert.equal(detail.restoredPage.html, created.restoredPage.html)
  assert.equal(detail.restoredPage.files[0].path, 'index.html')
  assert.equal(detail.restoredPage.visualVerification.status, 'passed')

  const preview = await backendRoutes['GET /api/workspace/restored-pages/:id/preview']({
    id: created.restoredPage.id
  })
  const frame = await backendRoutes['GET /api/workspace/restored-pages/:id/frame']({
    id: created.restoredPage.id
  })
  const source = await backendRoutes['GET /api/workspace/restored-pages/:id/source']({
    id: created.restoredPage.id
  })

  assert.match(preview.html, /<h1>统一详情页面<\/h1>/)
  assert.equal(frame.contentType, 'text/html; charset=utf-8')
  assert.match(frame.body, /<h1>统一详情页面<\/h1>/)
  assert.equal(source.files.find((file) => file.path === 'index.html').content, created.restoredPage.html)
})

testAsync('backend workspace routes can create and advance workflow runs', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const started = await backendRoutes['POST /api/workspace/workflow-runs']({
    projectId: 'project-flow',
    workflowId: 'demand-card-flow',
    input: '给产品交互设计 AI 应用做需求拆解'
  })

  assert.equal(started.run.projectId, 'project-flow')
  assert.equal(started.run.workflowId, 'demand-card-flow')
  assert.equal(started.run.status, 'running')
  assert.ok(started.run.currentStepId)

  const firstStepId = started.run.currentStepId
  const generated = await backendRoutes['POST /api/workspace/workflow-runs/:id/generate']({
    id: started.run.id,
    stepInputs: {
      目标用户: '产品交互设计师',
      原始目标: '把模糊需求拆成可执行流程'
    }
  })
  assert.match(generated.run.stepDraftOutputs[firstStepId], /需求理解/)

  const accepted = await backendRoutes['POST /api/workspace/workflow-runs/:id/accept']({
    id: started.run.id,
    output: generated.run.stepDraftOutputs[firstStepId]
  })
  assert.equal(accepted.run.stepOutputs[firstStepId], generated.run.stepDraftOutputs[firstStepId])

  const advanced = await backendRoutes['POST /api/workspace/workflow-runs/:id/complete-step']({
    id: started.run.id
  })
  assert.notEqual(advanced.run.currentStepId, firstStepId)

  const workspace = await backendRoutes['GET /api/workspace']()
  assert.ok(workspace.workflowRuns.some((item) => item.id === started.run.id))
})

testAsync('backend workspace routes persist prebuilt document analysis workflow runs by id', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  const prebuiltRun = {
    ...createWorkflowRun(workflow, 'Podcastor 文档分析'),
    projectId: 'project-flow',
    projectBlueprint: { title: 'Podcastor 蓝图' },
    documentAnalysis: {
      canvas: {
        nodes: [{ id: 'wireframes', title: '页面框架图' }],
        edges: [],
        orderedTabs: [{ key: 'wireframes', label: '页面框架图' }]
      }
    },
    agentSessions: {},
    referenceFiles: {}
  }
  const saved = await backendRoutes['POST /api/workspace/workflow-runs'](prebuiltRun)

  assert.equal(saved.run.id, prebuiltRun.id)
  assert.equal(saved.run.projectBlueprint.title, 'Podcastor 蓝图')
  assert.equal(saved.run.documentAnalysis.canvas.nodes[0].id, 'wireframes')

  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: prebuiltRun.id,
    stepId: 'wireframes',
    message: { role: 'user', content: '补充页面框架图细节' },
    references: [{ id: 'ref-1', name: 'wireframe.png', kind: 'image', status: 'ready' }]
  })

  assert.equal(updated.run.id, prebuiltRun.id)
  assert.match(updated.run.agentSessions.wireframes[0].content, /页面框架图/)
  assert.equal(updated.run.referenceFiles.wireframes[0].name, 'wireframe.png')
})

testAsync('workflow analysis deep links load full run detail instead of overview summary', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const restoreStart = appSource.indexOf('function restoreWorkflowAnalysisFromUrl')
  const restoreEnd = appSource.indexOf('function returnToWorkflowEntry', restoreStart)
  const restoreSource = appSource.slice(restoreStart, restoreEnd)
  const pollingStart = appSource.indexOf('function startWorkflowAnalysisDeepLinkPolling')
  const pollingEnd = appSource.indexOf('function failWorkflowAnalysisDeepLink', pollingStart)
  const pollingSource = appSource.slice(pollingStart, pollingEnd)

  await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'workflow-detail-analysis',
    projectId: 'project-flow',
    workflowName: '详情分析运行',
    status: 'completed',
    documentAnalysis: {
      canvas: {
        nodes: [{ id: 'analysis', title: '完整画布节点' }],
        edges: [],
        orderedTabs: [{ key: 'analysis', label: '文档分析结果' }]
      }
    },
    projectBlueprint: { title: '完整蓝图' }
  })

  const overview = await backendRoutes['GET /api/workspace']()
  const summaryRun = overview.workflowRuns.find((item) => item.id === 'workflow-detail-analysis')
  assert.equal(summaryRun.documentAnalysis, null)

  const detail = await backendRoutes['GET /api/workspace/workflow-runs/:id']({ id: 'workflow-detail-analysis' })
  assert.equal(detail.run.documentAnalysis.canvas.nodes[0].id, 'analysis')
  assert.equal(detail.run.projectBlueprint.title, '完整蓝图')

  assert.match(apiSource, /getWorkflowRun\(config,\s*runId\)/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}/)
  assert.match(appSource, /async function loadWorkflowRunDetail/)
  assert.match(restoreSource, /void loadWorkflowRunDetail\(runId/)
  assert.match(pollingSource, /await loadWorkflowRunDetail\(runId/)
  assert.doesNotMatch(restoreSource, /workflowAnalysisResult\.value = run\.documentAnalysis \|\| null/)
})

testAsync('backend upload routes parse uploaded document payloads and report failures', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents']({
    projectId: 'project-flow',
    documents: [
      { name: 'Podcastor PRD.md', type: 'text/markdown', content: '# Podcastor\n零门槛 AI 播客工作站' },
      { name: 'empty.pdf', type: 'application/pdf', content: '' }
    ]
  })

  assert.equal(result.summary.total, 2)
  assert.equal(result.summary.parsed, 1)
  assert.equal(result.summary.failed, 1)
  assert.equal(result.documents[0].status, 'parsed')
  assert.match(result.documents[0].text, /Podcastor/)
  assert.equal(result.documents[1].status, 'failed')
  assert.ok(result.documents[1].recoveryActions.includes('手动粘贴文本'))
})

testAsync('backend upload routes analyze documents into blueprint architecture and flow tree', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    project: {
      id: 'project-podcastor',
      name: 'Podcastor.ai',
      description: 'AI 播客工作站'
    },
    input: '用户上传需求文档后，需要先看到初步架构和交互路径树。',
    documents: [
      {
        name: 'Podcastor PRD.md',
        type: 'text/markdown',
        content: '# Podcastor\n支持 Generate Script、Upload Script、Upload Audio Podcast，并生成视频播客。'
      }
    ]
  })

  assert.equal(result.status, 'analyzed')
  assert.equal(result.blueprint.profile.productName, 'Podcastor.ai')
  assert.ok(result.architecture.nodes.some((node) => /首页|入口|Home/.test(node.title)))
  assert.ok(result.flowTree.children.length > 0)
  assert.ok(result.navigationPlan.some((item) => item.from && item.action && item.to))
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'analysis',
    'product-analysis',
    'profile',
    'structure-tree',
    'framework',
    'outline',
    'flow',
    'wireframes',
    'spec',
    'design-md',
    'skill-v2',
    'skill-v3',
    'opportunity',
    'demo',
    'html',
    'figma',
    'vue',
    'review'
  ])
  assert.equal(result.canvas.edges[0].from, 'analysis')
  assert.equal(result.canvas.edges[0].to, 'product-analysis')
  assert.ok(result.canvas.nodes.every((node) => node.agentScope && node.quickActions.length <= 4))
  assert.ok(result.canvas.nodes.every((node) => node.detailSections?.length >= 4))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'html').detailSections.some((section) => /网页工厂|HTML|源码/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'figma').detailSections.some((section) => /Figma|设计/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'vue').detailSections.some((section) => /Vue|前端|后端/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(result.nextActions.some((item) => /Agent|追问|重新生成/.test(item.label)))
})

testAsync('backend upload analysis stream emits canvas meta and node artifacts progressively', async () => {
  const backendRoutes = uploadRoutes()
  const chunks = []
  const result = await backendRoutes['POST /api/uploads/documents/analyze/stream']({
    project: {
      id: 'project-podcastor',
      name: 'Podcastor.ai',
      description: 'AI 播客工作站'
    },
    input: '用户上传需求文档后，需要先看到初步架构和交互路径树。',
    documents: [
      {
        name: 'Podcastor PRD.md',
        type: 'text/markdown',
        content: '# Podcastor\n支持 Generate Script、Upload Script、Upload Audio Podcast，并生成视频播客。'
      }
    ]
  }, null, {
    writeEvent(chunk) {
      chunks.push(chunk)
    }
  })
  const streamed = chunks.join('')

  assert.equal(result.contentType, 'text/event-stream; charset=utf-8')
  assert.match(streamed, /"type":"workflow-canvas-meta"/)
  assert.match(streamed, /"type":"workflow-node"/)
  assert.match(streamed, /"type":"workflow-analysis"/)
  assert.ok((streamed.match(/"type":"workflow-node"/g) || []).length >= 3)
  assert.ok(streamed.indexOf('"type":"workflow-canvas-meta"') < streamed.indexOf('"type":"workflow-node"'))
  assert.ok(streamed.indexOf('"type":"workflow-node"') < streamed.indexOf('event: done'))
})

testAsync('backend analysis returns page handoff canvas for login registration requests', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    project: {
      id: 'project-auth',
      name: '业务系统',
      description: '企业级 SaaS'
    },
    input: '做一个登录注册页面，点击按钮要把数据传给后端，后端调用大模型或账号服务后再把结果传给前端。',
    documents: []
  })

  assert.equal(result.status, 'analyzed')
  assert.equal(result.blueprint.intent, 'auth-page')
  assert.equal(result.blueprint.type, 'page-blueprint')
  assert.ok(result.architecture.nodes.some((node) => /登录页/.test(node.title)))
  assert.ok(result.architecture.nodes.some((node) => /注册页/.test(node.title)))
  assert.ok(result.navigationPlan.some((item) => /api\/auth\/login/.test(item.api || '')))
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'analysis',
    'page-report',
    'page-profile',
    'page-structure',
    'form-validation',
    'flow',
    'wireframes',
    'api-contract',
    'handoff',
    'demo',
    'review'
  ])
  assert.ok(result.canvas.nodes.find((node) => node.id === 'form-validation').content.some((item) => /邮箱|手机号|密码|验证码/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'api-contract').content.some((item) => /POST \/api\/auth\/login/.test(item)))
  const flowNode = result.canvas.nodes.find((node) => node.id === 'flow')
  assert.ok(Array.isArray(flowNode.pathGraph?.nodes))
  assert.ok(Array.isArray(flowNode.pathGraph?.edges))
  assert.ok(flowNode.pathGraph.nodes.some((node) => node.type === 'start' && /登录/.test(node.label)))
  assert.ok(flowNode.pathGraph.nodes.some((node) => node.type === 'decision' && /正确|成功|失败/.test(node.label)))
  assert.ok(flowNode.pathGraph.nodes.some((node) => node.type === 'error' && /错误|返回|退回/.test(node.label)))
  assert.ok(flowNode.pathGraph.edges.some((edge) => /正确|成功/.test(edge.label || '')))
  assert.ok(flowNode.pathGraph.edges.some((edge) => /错误|失败/.test(edge.label || '')))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'handoff').detailSections.some((section) => /前端接管/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'handoff').detailSections.some((section) => /后端接管/.test(`${section.title} ${section.items.join(' ')}`)))
  const demoNode = result.canvas.nodes.find((node) => node.id === 'demo')
  assert.ok(demoNode.content.some((item) => /index\.html|<!doctype html>|data-demo-engine/.test(item)))
  assert.ok(demoNode.detailSections.some((section) => /HTML 代码|源码/.test(section.title) && section.items.join('\n').includes('<!doctype html>')))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'review').content.some((item) => /登录成功|注册成功|错误码|限流/.test(item)))
  assert.ok(!result.canvas.nodes.some((node) => node.id === 'opportunity'))
})

testAsync('backend analysis binds project scope and selected skill into project canvas schema', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    demandScope: 'project',
    skillId: 'interaction-design-workflow',
    projectId: 'project-ux',
    project: {
      id: 'project-ux',
      name: '审批系统',
      description: 'B 端审批体验优化',
      targetUsers: '审批发起人、审批人、管理员'
    },
    input: '优化审批流程，需要给 UX 和研发交付页面、状态和验收。',
    documents: []
  })

  assert.equal(result.demandScope, 'project')
  assert.equal(result.skillId, 'interaction-design-workflow')
  assert.equal(result.projectId, 'project-ux')
  assert.equal(result.blueprint.skillId, 'interaction-design-workflow')
  assert.equal(result.blueprint.demandScope, 'project')
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'analysis',
    'ux-diagnosis',
    'information-architecture',
    'task-flow',
    'page-structure',
    'states',
    'handoff',
    'review'
  ])
  assert.ok(result.canvas.nodes.find((node) => node.id === 'information-architecture').content.some((item) => /审批系统|信息架构|核心对象/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'handoff').detailSections.some((section) => /前端|后端|测试|UX/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(result.canvas.orderedTabs.every((tab) => result.canvas.nodes.some((node) => node.id === tab.key)))
})

testAsync('backend analysis returns non-project report schema without project handoff canvas', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    demandScope: 'non-project',
    skillId: 'demand-four-step',
    projectId: '',
    project: {},
    input: '总结这份调研材料，提炼结论、风险和是否值得立项。',
    documents: [
      {
        name: 'research.md',
        type: 'text/markdown',
        content: '用户反馈：登录流程复杂，验证码失败率高，但当前阶段只需要判断问题是否值得立项。'
      }
    ]
  })

  assert.equal(result.demandScope, 'non-project')
  assert.equal(result.skillId, 'demand-four-step')
  assert.equal(result.blueprint.type, 'analysis-report')
  assert.equal(result.blueprint.demandScope, 'non-project')
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'analysis',
    'summary',
    'key-findings',
    'risks',
    'recommendations',
    'sources',
    'project-conversion'
  ])
  assert.ok(result.canvas.nodes.find((node) => node.id === 'summary').content.some((item) => /调研|总结|结论/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'project-conversion').content.some((item) => /转为项目需求|立项|项目/.test(item)))
  assert.ok(!result.canvas.nodes.some((node) => /handoff|api-contract|vue|figma/.test(node.id)))
})

test('backend analysis uses 8-module fuzzy architecture canvas nodes when selected', () => {
  const result = analyzeRequirementDocuments({
    demandScope: 'non-project',
    skillId: 'eight-module-fuzzy-architecture',
    skillSelectionMode: 'manual',
    input: '做一个播客视频的 ai 工具',
    documents: []
  })

  assert.equal(result.resolvedSkillId, 'eight-module-fuzzy-architecture')
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'requirement-understanding',
    'reversible-assumptions',
    'target-users',
    'core-jtbd',
    'main-path',
    'feature-scope',
    'confirmation-questions',
    'page-structure'
  ])
  assert.deepEqual(result.canvas.orderedTabs.map((tab) => tab.label), [
    '需求理解',
    '合理假设',
    '目标用户',
    '核心JTBD',
    '主路径草案',
    'P0/P1功能范围',
    '待确认问题',
    '初版页面结构'
  ])
})

test('backend analysis uses 5-stage client consensus canvas nodes when selected', () => {
  const result = analyzeRequirementDocuments({
    demandScope: 'non-project',
    skillId: 'five-stage-client-c-consensus-breakdown',
    skillSelectionMode: 'manual',
    input: '甲方想做一个面向宝妈的本地亲子活动小程序',
    documents: []
  })

  assert.equal(result.resolvedSkillId, 'five-stage-client-c-consensus-breakdown')
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'empathy-recap',
    'consensus-presets',
    'users-value',
    'minimum-loop',
    'mutual-confirmation'
  ])
  assert.deepEqual(result.canvas.orderedTabs.map((tab) => tab.label), [
    '需求共情复盘',
    '可控共识预设',
    '人群&核心价值',
    '最小闭环交付',
    '双向共识确认'
  ])
})

test('backend analysis derives canvas nodes from manually selected workflow steps', () => {
  const result = analyzeRequirementDocuments({
    demandScope: 'non-project',
    skillId: 'demand-card-flow',
    skillSelectionMode: 'manual',
    input: '帮我把一个模糊需求拆成卡片式分析流程',
    documents: []
  })

  assert.equal(result.resolvedSkillId, 'demand-card-flow')
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'card-requirement-understanding',
    'card-requirement-challenge',
    'card-scenario-breakdown',
    'card-solution-generation',
    'card-interaction-transform',
    'card-quality-validation'
  ])
  assert.deepEqual(result.canvas.orderedTabs.map((tab) => tab.label), [
    '需求理解',
    '需求质疑',
    '场景拆解',
    '方案生成',
    '交互转化',
    '质量校验'
  ])
})

testAsync('backend authentication page intent overrides non-project report schema for realistic page handoff', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    demandScope: 'non-project',
    skillId: 'demand-card-flow',
    projectId: '',
    project: {},
    input: '做一个登录注册界面，要求把登录、注册、忘记密码、验证码、错误状态、接口字段和前后端交接都写清楚。',
    documents: []
  })

  assert.equal(result.demandScope, 'non-project')
  assert.equal(result.blueprint.intent, 'auth-page')
  assert.equal(result.blueprint.type, 'page-blueprint')
  assert.deepEqual(result.canvas.nodes.map((node) => node.id), [
    'analysis',
    'page-report',
    'page-profile',
    'page-structure',
    'form-validation',
    'flow',
    'wireframes',
    'api-contract',
    'handoff',
    'demo',
    'review'
  ])
  assert.ok(result.canvas.nodes.find((node) => node.id === 'api-contract').content.some((item) => /POST \/api\/auth\/login/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'handoff').detailSections.some((section) => /前端接管|后端接管/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(!result.canvas.nodes.some((node) => node.id === 'project-conversion'))
})

testAsync('backend document analysis returns fresh document-specific canvas node content', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    project: {
      id: 'project-podcastor',
      name: 'Podcastor.ai',
      description: '旧项目：AI 播客工作站'
    },
    input: 'Pets/Cartoon Podcast v1.0版本 一、需求背景 近期播客市场上宠物和卡通的播客内容逐渐火热起来。',
    documents: [
      {
        name: 'Pets_Cartoon Podcast v1.0版本.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: 'Pets/Cartoon Podcast v1.0版本 一、需求背景 近期播客市场上宠物和卡通的播客内容逐渐火热起来，消费市场的火热创造出生产端的需求。'
      }
    ]
  })

  assert.equal(result.blueprint.profile.productName, 'Pets/Cartoon Podcast')
  assert.doesNotMatch(JSON.stringify(result.canvas), /Podcastor\.ai|Generate Script|Turn Your Ideas Into Podcasts/)
  assert.ok(result.canvas.nodes.find((node) => node.id === 'analysis').content.some((item) => /Pets_Cartoon|解析文档/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'profile').content.some((item) => /宠物|卡通|Pets\/Cartoon/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'skill-v2').content.every(Boolean))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'skill-v2').content.some((item) => /需求拆解审阅|Wireframe|质量检查/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'skill-v3').content.some((item) => /状态机|UI 节点|Demo Schema/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'opportunity').content.some((item) => /机会|旅程|上传解析/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'demo').detailSections.some((section) => /交互|状态|异常|跳转/.test(`${section.title} ${section.items.join(' ')}`)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'html').content.some((item) => /完整 HTML|网页工厂|预览/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'figma').content.some((item) => /Figma|设计稿/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'vue').content.some((item) => /Vue|前端|后端/.test(item)))
})

testAsync('document analysis returns product report structure tree wireframes and design markdown', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    project: {
      id: 'project-podcastor',
      name: 'Podcastor.ai',
      description: 'AI 播客工作站'
    },
    input: 'Podcastor.ai v1.0 产品文档：用户可以从想法、脚本、音频开始生成播客。',
    documents: [
      {
        name: 'Podcastor.ai v1.0产品文档.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: 'Podcastor.ai 是面向海外内容创作者的 AI 播客工作站，支持 Generate Script、Upload Script、Upload Audio、核心编辑器、Project、Host、Voice、Pricing。'
      }
    ]
  })

  assert.ok(result.productAnalysis)
  assert.deepEqual(result.productAnalysis.sections.map((section) => section.id), [
    'what',
    'why',
    'how',
    'priority',
    'risk'
  ])
  assert.ok(result.productAnalysis.sections.find((section) => section.id === 'what').items.some((item) => /AI 播客工作站|Podcastor/.test(item)))
  assert.ok(result.productAnalysis.sections.find((section) => section.id === 'priority').items.some((item) => /P0/.test(item)))

  assert.ok(result.structureTree.lines.some((line) => /├── Home|首页/.test(line)))
  assert.ok(result.frameworkDiagrams.pages.some((page) => page.id === 'home' && page.layoutLines.some((line) => /输入框|上传|CTA|Next/.test(line))))
  assert.ok(result.designMarkdown.includes('Podcastor.ai 项目交互设计方案'))
  assert.ok(result.designMarkdown.includes('## What｜文档核心分析'))
  assert.ok(result.designMarkdown.includes('## 产品结构树'))
  assert.ok(result.designMarkdown.includes('## 页面框架图'))
  assert.ok(result.designMarkdown.includes('## 状态与异常'))

  assert.ok(result.canvas.nodes.every((node) => node.agentInteraction))
  assert.ok(result.canvas.nodes.every((node) => node.agentInteraction.goal && node.agentInteraction.inputPlaceholder))
  assert.ok(result.canvas.nodes.every((node) => node.agentInteraction.quickReplies.length >= 3 && node.agentInteraction.quickReplies.length <= 4))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'product-analysis').agentInteraction.suggestedQuestions.some((item) => /Why|机会|风险|优先级/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'wireframes').agentInteraction.suggestedQuestions.some((item) => /页面|控件|按钮|输入框/.test(item)))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'design-md').agentInteraction.confirmationRule.includes('导出'))

  assert.ok(result.canvas.nodes.find((node) => node.id === 'product-analysis'))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'structure-tree'))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'wireframes'))
  assert.ok(result.canvas.nodes.find((node) => node.id === 'design-md'))
})

testAsync('backend workflow routes run generate accept and complete lifecycle', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })
  const stepId = created.run.currentStepId
  const generated = await backendRoutes['POST /api/workflows/runs/:runId/steps/:stepId/generate']({
    runId: created.run.id,
    stepId,
    input: defaultWorkflowStepInputs(created.run, created.run.steps[0], 'example')
  })
  const accepted = await backendRoutes['POST /api/workflows/runs/:runId/steps/:stepId/accept']({
    runId: created.run.id,
    stepId,
    content: generated.run.stepDraftOutputs[stepId]
  })
  const completed = await backendRoutes['POST /api/workflows/runs/:runId/complete']({
    runId: created.run.id
  })

  assert.equal(created.run.workflowId, 'podcastor-product-flow')
  assert.match(generated.output, /播客需求诊断/)
  assert.equal(accepted.run.stepOutputs[stepId], generated.run.stepDraftOutputs[stepId])
  assert.equal(completed.run.currentStepId, created.run.steps[1].id)
})

testAsync('backend workflow routes persist agent messages and model selection', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站',
    model: 'gpt-5.5'
  })
  const stepId = created.run.currentStepId
  const updated = await backendRoutes['POST /api/workflows/runs/:runId/steps/:stepId/messages']({
    runId: created.run.id,
    stepId,
    model: 'gpt-4.1',
    message: {
      role: 'user',
      content: '请用上传文档作为参考，先生成蓝图。'
    },
    references: [
      { id: 'file-1', name: 'Podcastor PRD.docx', kind: 'document', status: 'ready' }
    ]
  })

  assert.equal(updated.run.model, 'gpt-4.1')
  assert.equal(updated.run.agentSessions[stepId].length, 2)
  assert.equal(updated.assistantMessage.role, 'assistant')
  assert.match(updated.assistantMessage.content, /蓝图|引用资料|下一步/)
  assert.equal(updated.actionResult.type, 'blueprint')
  assert.equal(updated.provider, 'deterministic')
  assert.deepEqual(updated.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 })
  assert.equal(updated.run.referenceFiles[stepId][0].name, 'Podcastor PRD.docx')
})

testAsync('agent context builder compacts active node references and message history', async () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  const run = {
    ...createWorkflowRun(workflow, 'Podcastor.ai 项目'),
    agentSessions: {
      framework: [
        { role: 'user', content: '上一轮：先看首页入口' },
        { role: 'assistant', content: '上一轮回复：已记录首页入口' }
      ]
    }
  }
  const step = run.steps.find((item) => item.id === run.currentStepId)
  const context = buildAgentContext({
    run,
    step,
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    references: [
      { id: 'ref-1', name: 'Podcastor PRD.docx', kind: 'document', status: 'ready', text: '支持 Generate Script 和 Upload Audio Podcast。' }
    ],
    context: {
      activeNode: {
        id: 'framework',
        title: '产品框架',
        summary: '模块、页面和能力结构。',
        content: ['首页创作入口：Generate Script / Upload Script / Upload Audio Podcast']
      }
    },
    now: '2026-06-21T00:00:00.000Z'
  })

  assert.equal(context.actionType, 'module-breakdown')
  assert.equal(context.node.title, '产品框架')
  assert.equal(context.references[0].name, 'Podcastor PRD.docx')
  assert.match(context.systemPrompt, /产品级工作流 Agent/)
  assert.match(context.userPrompt, /拆模块/)
  assert.match(context.userPrompt, /首页创作入口/)
  assert.equal(context.history.length, 2)
})

testAsync('deterministic agent provider returns normalized module feedback', async () => {
  const provider = createDeterministicAgentProvider()
  const context = buildAgentContext({
    run: { input: 'Podcastor.ai 项目', workflowName: 'Podcastor 产品体验流', agentSessions: {} },
    step: { id: 'podcast-diagnosis', title: '需求诊断', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    references: [],
    context: {
      activeNode: {
        id: 'framework',
        title: '产品框架',
        summary: '模块、页面和能力结构。',
        content: ['首页创作入口：Generate Script / Upload Script']
      }
    },
    now: '2026-06-21T00:00:00.000Z'
  })
  const result = await provider.generate(context)

  assert.equal(provider.name, 'deterministic')
  assert.equal(result.provider, 'deterministic')
  assert.match(result.content, /模块拆解/)
  assert.doesNotMatch(result.content, /模型：|当前没有引用资料|建议下一步|下一步建议/)
  assert.equal(result.actionResult.type, 'module-breakdown')
  assert.equal(result.usage.totalTokens, 0)
})

testAsync('agent service uses injected provider and returns assistant message contract', async () => {
  const provider = {
    name: 'fake-provider',
    async generate(context) {
      return {
        content: `provider saw ${context.actionType} for ${context.node.title}`,
        actionResult: { type: context.actionType, nodeId: context.scopeId, nodeTitle: context.node.title },
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
        provider: 'fake-provider',
        model: context.model
      }
    }
  }
  const result = await generateAgentReply({
    run: { input: 'Podcastor.ai 项目', workflowName: 'Podcastor 产品体验流', agentSessions: {} },
    step: { id: 'podcast-diagnosis', title: '需求诊断', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    references: [],
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } },
    now: '2026-06-21T00:00:00.000Z'
  }, provider)

  assert.equal(result.assistantMessage.role, 'assistant')
  assert.equal(result.assistantMessage.content, 'provider saw module-breakdown for 产品框架')
  assert.equal(result.provider, 'fake-provider')
  assert.equal(result.usage.totalTokens, 7)
})

test('agent context includes retrieved knowledge evidence snippets', () => {
  const context = buildAgentContext({
    run: { input: '流程通项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'development', title: '开发方案', goal: '生成开发上下文' },
    scopeId: 'development',
    model: 'gpt-5.5',
    message: { role: 'user', content: '根据知识库生成接口方案' },
    retrievedKnowledge: [
      {
        title: 'API 集成资料',
        snippet: 'Developers can use webhook callbacks and API keys.',
        evidence: [{ url: 'https://example.com/docs/api', title: 'API Docs' }],
        verification: { status: 'verified' }
      }
    ],
    context: { activeNode: { id: 'development', title: '开发方案', summary: '接口和数据模型。' } },
    now: '2026-06-21T00:00:00.000Z'
  })

  assert.equal(context.retrievedKnowledge[0].title, 'API 集成资料')
  assert.match(context.userPrompt, /知识库召回/)
  assert.match(context.userPrompt, /Developers can use webhook callbacks/)
  assert.match(context.userPrompt, /https:\/\/example\.com\/docs\/api/)
})

test('agent context preserves knowledge retrieval failures for provider prompts', () => {
  const context = buildAgentContext({
    run: { input: '流程通项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'ux', title: 'UX 方案', goal: '生成交互建议' },
    scopeId: 'ux',
    model: 'gpt-5.5',
    message: { role: 'user', content: '分析登录注册弹窗' },
    retrievedKnowledge: [],
    context: {
      activeNode: { id: 'ux', title: 'UX 方案', summary: '交互和状态设计。' },
      knowledgeRetrievalError: '知识检索服务超时'
    },
    now: '2026-06-21T00:00:00.000Z'
  })

  assert.equal(context.knowledgeRetrievalError, '知识检索服务超时')
  assert.match(context.userPrompt, /知识检索状态/)
  assert.match(context.userPrompt, /知识检索服务超时/)
})

testAsync('openai compatible provider normalizes responses api output', async () => {
  const calls = []
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        async json() {
          return {
            output_text: '真实模型返回：请先拆首页入口和核心编辑器。',
            usage: { input_tokens: 11, output_tokens: 13, total_tokens: 24 }
          }
        }
      }
    }
  })
  const context = buildAgentContext({
    run: { input: 'Podcastor.ai 项目', workflowName: 'Podcastor 产品体验流', agentSessions: {} },
    step: { id: 'podcast-diagnosis', title: '需求诊断', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    references: [],
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } },
    now: '2026-06-21T00:00:00.000Z'
  })
  const result = await provider.generate(context)

  assert.equal(calls[0].url, 'https://api.openai.test/v1/responses')
  assert.match(calls[0].init.headers.Authorization, /Bearer test-key/)
  assert.match(calls[0].init.body, /产品级工作流 Agent/)
  assert.equal(result.provider, 'openai-compatible')
  assert.equal(result.content, '真实模型返回：请先拆首页入口和核心编辑器。')
  assert.equal(result.usage.totalTokens, 24)
})

testAsync('openai compatible provider sends image input through responses api', async () => {
  const calls = []
  const imageDataUrl = solidPngDataUrl(8, 8, [255, 122, 77, 255])
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    defaultModel: 'gpt-5.5',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) })
      return {
        ok: true,
        async json() {
          return {
            output_text: '{"ok":true}',
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
          }
        }
      }
    }
  })

  await provider.generate({
    systemPrompt: '分析图片',
    userPrompt: '生成 HTML',
    imageDataUrl
  })

  assert.equal(calls[0].body.model, 'gpt-5.5')
  assert.equal(calls[0].body.input[0].role, 'user')
  assert.deepEqual(calls[0].body.input[0].content[0], { type: 'input_text', text: '生成 HTML' })
  assert.deepEqual(calls[0].body.input[0].content[1], { type: 'input_image', image_url: imageDataUrl })
})

testAsync('openai compatible provider sends image input through chat completions api', async () => {
  const calls = []
  const imageDataUrl = solidPngDataUrl(8, 8, [123, 64, 255, 255])
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'chat.completions',
    defaultModel: 'gpt-5.5',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) })
      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
          }
        }
      }
    }
  })

  await provider.generate({
    systemPrompt: '分析图片',
    userPrompt: '生成 HTML',
    imageDataUrl
  })

  assert.equal(calls[0].body.model, 'gpt-5.5')
  assert.equal(calls[0].body.messages[1].role, 'user')
  assert.deepEqual(calls[0].body.messages[1].content[0], { type: 'text', text: '生成 HTML' })
  assert.deepEqual(calls[0].body.messages[1].content[1], { type: 'image_url', image_url: { url: imageDataUrl } })
})

testAsync('openai compatible provider normalizes chat completions output', async () => {
  const calls = []
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'chat.completions',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: 'Chat 模式返回：先做页面清单。' } }],
            usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 }
          }
        }
      }
    }
  })
  const context = buildAgentContext({
    run: { input: 'Podcastor.ai 项目', workflowName: 'Podcastor 产品体验流', agentSessions: {} },
    step: { id: 'podcast-diagnosis', title: '需求诊断', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    references: [],
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } },
    now: '2026-06-21T00:00:00.000Z'
  })
  const result = await provider.generate(context)

  assert.equal(calls[0].url, 'https://api.openai.test/v1/chat/completions')
  assert.match(calls[0].init.body, /messages/)
  assert.equal(result.content, 'Chat 模式返回：先做页面清单。')
  assert.equal(result.usage.totalTokens, 11)
})

testAsync('openai compatible provider classifies missing key as configuration error', async () => {
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: '',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    fetchImpl: async () => {
      throw new Error('fetch should not be called without api key')
    }
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    now: '2026-06-21T00:00:00.000Z'
  })

  await assert.rejects(
    () => provider.generate(context),
    (error) => {
      assert.equal(error.code, 'LLM_PROVIDER_UNCONFIGURED')
      assert.equal(error.message, '请先配置模型 key')
      assert.deepEqual(error.recoveryActions.slice(0, 2), ['检查配置', '填写模型 key'])
      assert.equal(error.model, 'gpt-5.5')
      assert.equal(error.apiSurface, 'responses')
      assert.equal(error.provider, 'openai-compatible')
      return true
    }
  )
})

testAsync('openai compatible provider classifies unsupported model response', async () => {
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      async json() {
        return { error: { message: 'The model `gpt-5.5` does not exist or you do not have access to it.' } }
      }
    })
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    now: '2026-06-21T00:00:00.000Z'
  })

  await assert.rejects(
    () => provider.generate(context),
    (error) => {
      assert.equal(error.code, 'LLM_MODEL_NOT_FOUND')
      assert.equal(error.message, '当前 provider 不支持 gpt-5.5')
      assert.ok(error.recoveryActions.includes('切换模型'))
      assert.equal(error.status, 404)
      assert.equal(error.model, 'gpt-5.5')
      return true
    }
  )
})

testAsync('openai compatible provider classifies api surface mismatch response', async () => {
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      async json() {
        return { error: { message: 'This provider only supports chat.completions endpoint, responses endpoint not found.' } }
      }
    })
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    now: '2026-06-21T00:00:00.000Z'
  })

  await assert.rejects(
    () => provider.generate(context),
    (error) => {
      assert.equal(error.code, 'LLM_API_SURFACE_MISMATCH')
      assert.equal(error.message, '接口不匹配，请切换 responses / chat.completions 后重试')
      assert.ok(error.recoveryActions.includes('切换 responses/chat.completions'))
      assert.equal(error.apiSurface, 'responses')
      return true
    }
  )
})

testAsync('openai compatible provider classifies timeout as retryable timeout error', async () => {
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    timeoutMs: 1,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    })
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    now: '2026-06-21T00:00:00.000Z'
  })

  await assert.rejects(
    () => provider.generate(context),
    (error) => {
      assert.equal(error.code, 'LLM_PROVIDER_TIMEOUT')
      assert.equal(error.message, '模型请求超时，请调大 timeout 或重试')
      assert.ok(error.recoveryActions.includes('调大 timeout'))
      assert.equal(error.timeoutMs, 1)
      return true
    }
  )
})

test('model provider error normalizer preserves structured provider errors', () => {
  const source = new Error('当前 provider 不支持 gpt-5.5')
  source.code = 'LLM_MODEL_NOT_FOUND'
  source.recoveryActions = ['切换模型', '检查配置']
  source.model = 'gpt-5.5'
  const normalized = normalizeModelProviderError(source, {
    provider: 'openai-compatible',
    apiSurface: 'responses',
    model: 'gpt-5.5'
  })

  assert.equal(normalized.code, 'LLM_MODEL_NOT_FOUND')
  assert.equal(normalized.message, '当前 provider 不支持 gpt-5.5')
  assert.deepEqual(normalized.recoveryActions, ['切换模型', '检查配置'])
  assert.equal(normalized.provider, 'openai-compatible')
  assert.equal(normalized.apiSurface, 'responses')
  assert.equal(normalized.model, 'gpt-5.5')
})

testAsync('openai compatible provider streams responses api deltas', async () => {
  const calls = []
  const encoder = new TextEncoder()
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        body: {
          getReader() {
            const chunks = [
              'event: response.output_text.delta\ndata: {"delta":"流式"}\n\n',
              'event: response.output_text.delta\ndata: {"delta":"返回"}\n\n',
              'event: response.completed\ndata: {"response":{"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7}}}\n\n'
            ].map((chunk) => encoder.encode(chunk))
            return {
              async read() {
                return chunks.length ? { value: chunks.shift(), done: false } : { done: true }
              }
            }
          }
        }
      }
    }
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    now: '2026-06-21T00:00:00.000Z'
  })
  const events = []
  for await (const chunk of provider.stream(context)) events.push(chunk)

  assert.equal(calls[0].url, 'https://api.openai.test/v1/responses')
  assert.match(calls[0].init.body, /"stream":true/)
  assert.deepEqual(events.map((event) => event.type), ['delta', 'delta', 'final'])
  assert.equal(events[0].content, '流式')
  assert.equal(events[1].content, '返回')
  assert.equal(events[2].usage.totalTokens, 7)
})

testAsync('openai compatible provider streams chat completion deltas', async () => {
  const calls = []
  const encoder = new TextEncoder()
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'chat.completions',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        body: {
          getReader() {
            const chunks = [
              'data: {"choices":[{"delta":{"content":"Chat "}}]}\n\n',
              'data: {"choices":[{"delta":{"content":"流式"}}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\n',
              'data: [DONE]\n\n'
            ].map((chunk) => encoder.encode(chunk))
            return {
              async read() {
                return chunks.length ? { value: chunks.shift(), done: false } : { done: true }
              }
            }
          }
        }
      }
    }
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    now: '2026-06-21T00:00:00.000Z'
  })
  const events = []
  for await (const chunk of provider.stream(context)) events.push(chunk)

  assert.equal(calls[0].url, 'https://api.openai.test/v1/chat/completions')
  assert.match(calls[0].init.body, /"stream":true/)
  assert.equal(events[0].content, 'Chat ')
  assert.equal(events[1].content, '流式')
  assert.equal(events.at(-1).type, 'final')
  assert.equal(events.at(-1).usage.totalTokens, 5)
})

testAsync('openai compatible provider cancels response reader when stream signal aborts', async () => {
  let readerCancelled = false
  let resolveRead
  const waitingRead = new Promise((resolve) => {
    resolveRead = resolve
  })
  const controller = new AbortController()
  const encoder = new TextEncoder()
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.test/v1',
    apiSurface: 'responses',
    fetchImpl: async () => ({
      ok: true,
      body: {
        getReader() {
          let reads = 0
          return {
            async read() {
              reads += 1
              if (reads === 1) {
                return {
                  value: encoder.encode('event: response.output_text.delta\ndata: {"delta":"第一段"}\n\n'),
                  done: false
                }
              }
              await waitingRead
              return {
                value: encoder.encode('event: response.output_text.delta\ndata: {"delta":"迟到段"}\n\n'),
                done: false
              }
            },
            async cancel() {
              readerCancelled = true
              resolveRead()
            }
          }
        }
      }
    })
  })
  const context = buildAgentContext({
    run: { input: '认证项目', workflowName: '产品流程', agentSessions: {} },
    step: { id: 'framework', title: '产品框架', goal: '理解需求' },
    scopeId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    now: '2026-06-21T00:00:00.000Z'
  })
  const iterator = provider.stream(context, { signal: controller.signal })
  const first = await iterator.next()
  controller.abort()
  const second = await iterator.next()

  assert.deepEqual(first.value, { type: 'delta', content: '第一段' })
  assert.equal(second.done, true)
  assert.equal(readerCancelled, true)
})

test('openai compatible provider wires stream signal into sse body reader', () => {
  const providerSource = readFileSync(new URL('../后端/services/llm-provider.js', import.meta.url), 'utf8')

  assert.match(providerSource, /async function\* readSseStream\(response,\s*signal\)/)
  assert.match(providerSource, /signal\?\.addEventListener\?\.\('abort',\s*cancelReader,\s*\{\s*once:\s*true\s*\}\)/)
  assert.match(providerSource, /reader\.cancel\?\.\(\)/)
  assert.match(providerSource, /signal\?\.removeEventListener\?\.\('abort',\s*cancelReader\)/)
  assert.match(providerSource, /readSseStream\(response,\s*streamOptions\.signal\)/)
  assert.match(providerSource, /if \(streamOptions\.signal\?\.aborted\) return/)
})

testAsync('backend workflow agent actions return model generated feedback for canvas quick actions', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站',
    model: 'gpt-5.5'
  })
  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '拆模块'
    },
    context: {
      activeNode: {
        id: 'framework',
        title: '产品框架',
        summary: '模块、页面和能力结构。',
        content: ['首页创作入口：Generate Script / Upload Script / Upload Audio Podcast'],
        agentInteraction: {
          goal: '拆解模块、页面和能力边界。'
        }
      },
      currentStepId: created.run.currentStepId
    }
  })

  assert.equal(updated.run.agentSessions.framework.length, 2)
  assert.equal(updated.assistantMessage.role, 'assistant')
  assert.match(updated.assistantMessage.content, /模块拆解|产品框架/)
  assert.match(updated.assistantMessage.content, /可写入内容|待确认/)
  assert.doesNotMatch(updated.assistantMessage.content, /GPT-4\.1 mini|gpt-4\.1-mini|模型：|当前没有引用资料/)
  assert.equal(updated.actionResult.type, 'module-breakdown')
  assert.equal(updated.actionResult.nodeId, 'framework')
  assert.equal(updated.provider, 'deterministic')
  assert.equal(updated.usage.totalTokens, 0)
  assert.ok(Array.isArray(updated.quickReplies))
  assert.ok(updated.quickReplies.length > 0)
  assert.deepEqual(updated.run.agentQuickReplies.framework, updated.quickReplies)
  assert.equal(updated.assistantMessage.meta.provider, 'deterministic')
  assert.equal(updated.assistantMessage.meta.model, 'gpt-5.5')
  assert.deepEqual(updated.assistantMessage.meta.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 })
  assert.equal(updated.assistantMessage.meta.actionType, 'module-breakdown')
  assert.equal(updated.assistantMessage.meta.error, null)
  assert.equal(updated.assistantMessage.meta.proposalId, updated.proposal.id)
  assert.equal(updated.assistantMessage.meta.proposalSummary.title, updated.proposal.title)
  assert.ok(updated.assistantMessage.meta.proposalSummary.rationale.length)
  assert.deepEqual(updated.run.agentSessions.framework[1].meta, updated.assistantMessage.meta)
})

testAsync('backend workflow agent supplement action returns detailed analysis instead of placeholder receipt', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5'
  })
  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'analysis',
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '补充资料：请基于当前节点直接给出更详细的需求分析、缺口和下一步建议'
    },
    context: {
      activeNode: {
        id: 'analysis',
        title: '文档分析结果',
        summary: '识别到页面级认证需求，输出登录注册交付物。',
        content: ['意图：auth-page', '解析文档：0/0', '需要覆盖登录、注册、忘记密码']
      }
    }
  })

  assert.equal(updated.assistantMessage.role, 'assistant')
  assert.equal(updated.actionResult.type, 'supplement-detail')
  assert.match(updated.assistantMessage.content, /详细分析|需求分析|补充分析/)
  assert.match(updated.assistantMessage.content, /缺口|风险|待补/)
  assert.match(updated.assistantMessage.content, /可写入|待确认|建议/)
  assert.doesNotMatch(updated.assistantMessage.content, /补充信息已接收/)
  assert.doesNotMatch(updated.assistantMessage.content, /已把“.*”写入当前小画板上下文/)
  assert.doesNotMatch(updated.assistantMessage.content, /模型：|当前没有引用资料|建议下一步|下一步建议/)
  assert.equal(updated.assistantMessage.meta.actionType, 'supplement-detail')
})

testAsync('backend workflow agent canvas actions return model advice instead of context notes', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5'
  })
  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-profile',
    model: 'gpt-5.5',
    action: 'canvas-action-advice',
    message: {
      role: 'user',
      content: '画布动作「补成功标准」：请基于当前节点给出可直接使用的详细建议'
    },
    context: {
      activeNode: {
        id: 'page-profile',
        title: '页面档案',
        summary: '面向真实业务系统的账号认证入口',
        content: ['页面名称：认证页面', '目标人群：未登录用户、新注册用户、忘记密码用户']
      },
      canvasAction: {
        action: '补成功标准',
        nodeId: 'page-profile'
      }
    }
  })

  assert.equal(updated.actionResult.type, 'canvas-action-advice')
  assert.equal(updated.assistantMessage.meta.actionType, 'canvas-action-advice')
  assert.match(updated.assistantMessage.content, /动作建议|详细建议|可补充内容/)
  assert.match(updated.assistantMessage.content, /补成功标准|成功标准/)
  assert.match(updated.assistantMessage.content, /可写入|待确认|建议/)
  assert.doesNotMatch(updated.assistantMessage.content, /补充信息已接收|context-note/)
  assert.doesNotMatch(updated.assistantMessage.content, /模型：|当前没有引用资料|建议下一步|下一步建议/)
})

testAsync('backend workflow agent canvas actions preserve explicit action and tailor advice by button label', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5'
  })
  const baseContext = {
    activeNode: {
      id: 'page-profile',
      title: '页面档案',
      summary: '面向真实业务系统的账号认证入口',
      content: ['页面名称：认证页面', '目标人群：未登录用户、新注册用户、忘记密码用户']
    }
  }
  const targetUser = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-profile',
    model: 'gpt-5.5',
    action: 'canvas-action-advice',
    message: {
      role: 'user',
      content: '画布动作「补目标用户」：请基于当前节点给出可直接使用的详细建议'
    },
    context: {
      ...baseContext,
      canvasAction: { action: '补目标用户', nodeId: 'page-profile' }
    }
  })
  const positioning = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-profile',
    model: 'gpt-5.5',
    action: 'canvas-action-advice',
    message: {
      role: 'user',
      content: '画布动作「调整定位」：请基于当前节点给出可直接使用的详细建议'
    },
    context: {
      ...baseContext,
      canvasAction: { action: '调整定位', nodeId: 'page-profile' }
    }
  })

  assert.equal(targetUser.assistantMessage.meta.actionType, 'canvas-action-advice')
  assert.match(targetUser.assistantMessage.content, /补目标用户|目标用户|用户分层|用户画像/)
  assert.match(targetUser.assistantMessage.content, /未登录用户|新注册用户|忘记密码/)
  assert.doesNotMatch(targetUser.assistantMessage.content, /调整定位|定位表达/)
  assert.equal(positioning.assistantMessage.meta.actionType, 'canvas-action-advice')
  assert.match(positioning.assistantMessage.content, /调整定位|定位表达|页面定位|业务定位/)
  assert.match(positioning.assistantMessage.content, /账号认证入口|认证页面/)
  assert.doesNotMatch(positioning.assistantMessage.content, /用户分层|用户画像/)
})

testAsync('backend workflow agent canvas action intents shape proposal writeable content and downstream impact', async () => {
  const run = {
    input: '做一个登录注册弹窗',
    workflowName: '认证弹窗需求分析',
    agentSessions: {},
    documentAnalysis: {
      canvas: {
        nodes: [
          {
            id: 'page-profile',
            title: '弹窗档案',
            summary: '面向真实业务系统的账号认证入口',
            content: ['页面名称：认证弹窗', '目标人群：未登录用户、新注册用户、忘记密码用户']
          },
          {
            id: 'page-structure',
            title: '页面结构',
            summary: '登录、注册、忘记密码和第三方授权结构'
          },
          {
            id: 'form-validation',
            title: '表单校验',
            summary: '账号密码、验证码、第三方授权错误处理'
          }
        ],
        edges: [],
        orderedTabs: ['page-profile', 'page-structure', 'form-validation']
      }
    }
  }
  const basePayload = {
    run,
    step: { id: 'page-profile', title: '弹窗档案', goal: '明确弹窗定位和用户' },
    scopeId: 'page-profile',
    model: 'gpt-5.5',
    references: [],
    now: '2026-06-21T00:00:00.000Z',
    action: 'canvas-action-advice',
    context: {
      activeNode: run.documentAnalysis.canvas.nodes[0]
    }
  }
  const targetUser = await generateAgentReply({
    ...basePayload,
    message: { role: 'user', content: '请处理画布动作：补目标用户' },
    context: {
      ...basePayload.context,
      canvasAction: {
        action: '补目标用户',
        actionIntent: 'target-user-enrichment',
        nodeId: 'page-profile'
      }
    }
  })
  const positioning = await generateAgentReply({
    ...basePayload,
    message: { role: 'user', content: '请处理画布动作：调整定位' },
    context: {
      ...basePayload.context,
      canvasAction: {
        action: '调整定位',
        actionIntent: 'positioning-adjustment',
        nodeId: 'page-profile'
      }
    }
  })

  assert.equal(targetUser.proposal.nodeId, 'page-profile')
  assert.match(targetUser.proposal.writeableContent.items.join('\n'), /用户分层|进入场景|核心任务|顾虑点|成功标准/)
  assert.doesNotMatch(targetUser.proposal.writeableContent.items.join('\n'), /页面定位|不包含范围|上下游依赖/)
  assert.equal(targetUser.proposal.downstreamImpact[0].nodeId, 'page-structure')
  assert.match(targetUser.proposal.downstreamImpact.map((item) => item.reason).join('\n'), /目标用户|页面结构|表单校验/)
  assert.match(positioning.proposal.writeableContent.items.join('\n'), /页面定位|核心价值|不包含范围|上下游依赖|业务边界/)
  assert.doesNotMatch(positioning.proposal.writeableContent.items.join('\n'), /用户分层|顾虑点/)
  assert.equal(positioning.proposal.downstreamImpact[0].nodeId, 'page-structure')
  assert.match(positioning.proposal.downstreamImpact.map((item) => item.reason).join('\n'), /定位|页面结构|表单校验/)
})

testAsync('backend workflow agent acceptance criteria action has dedicated prompt and proposal structure', async () => {
  const run = {
    input: '做一个登录注册弹窗',
    workflowName: '认证弹窗需求分析',
    agentSessions: {},
    documentAnalysis: {
      canvas: {
        nodes: [
          {
            id: 'acceptance',
            title: '验收标准',
            summary: '当前缺少可测试验收标准',
            content: ['需要覆盖登录、注册、忘记密码']
          },
          {
            id: 'api-contract',
            title: '接口契约',
            summary: '认证接口需要跟随验收标准补齐'
          }
        ],
        edges: [],
        orderedTabs: ['acceptance', 'api-contract']
      }
    }
  }
  const payload = {
    run,
    step: { id: 'acceptance', title: '验收标准', goal: '明确可测试的验收口径' },
    scopeId: 'acceptance',
    model: 'gpt-5.5',
    references: [],
    now: '2026-06-21T00:00:00.000Z',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '请处理画布动作：补验收标准' },
    context: {
      activeNode: run.documentAnalysis.canvas.nodes[0],
      canvasAction: {
        action: '补验收标准',
        nodeId: 'acceptance'
      }
    }
  }
  const context = buildAgentContext(payload)
  const result = await generateAgentReply(payload)
  const joinedItems = result.proposal.writeableContent.items.join('\n')
  const joinedCriteria = result.proposal.writeableContent.acceptanceCriteria.join('\n')

  assert.equal(context.canvasAction.actionIntent, 'acceptance-criteria-enrichment')
  assert.match(context.userPrompt, /动作意图：acceptance-criteria-enrichment/)
  assert.match(context.userPrompt, /验收标准|通过条件|失败条件|测试口径/)
  assert.equal(result.proposal.actionIntent, 'acceptance-criteria-enrichment')
  assert.match(joinedItems, /验收场景|通过条件|失败条件|测试口径|埋点/)
  assert.match(joinedCriteria, /可测试|可验收|失败态|成功路径/)
  assert.equal(result.proposal.downstreamImpact[0].nodeId, 'api-contract')
  assert.match(result.proposal.downstreamImpact[0].reason, /验收标准|接口契约/)
})

testAsync('backend workflow agent api contract action has dedicated prompt and proposal structure', async () => {
  const run = {
    input: '做一个登录注册弹窗',
    workflowName: '认证弹窗需求分析',
    agentSessions: {},
    documentAnalysis: {
      canvas: {
        nodes: [
          {
            id: 'api-contract',
            title: '接口契约',
            summary: '当前缺少请求字段、返回字段和错误码',
            content: ['需要覆盖登录、注册、忘记密码']
          },
          {
            id: 'handoff',
            title: '前后端交接',
            summary: '交接内容需要跟随接口契约补齐'
          }
        ],
        edges: [],
        orderedTabs: ['api-contract', 'handoff']
      }
    }
  }
  const payload = {
    run,
    step: { id: 'api-contract', title: '接口契约', goal: '明确前后端接口字段和错误码' },
    scopeId: 'api-contract',
    model: 'gpt-5.5',
    references: [],
    now: '2026-06-21T00:00:00.000Z',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '请处理画布动作：补接口契约' },
    context: {
      activeNode: run.documentAnalysis.canvas.nodes[0],
      canvasAction: {
        action: '补接口契约',
        nodeId: 'api-contract'
      }
    }
  }
  const context = buildAgentContext(payload)
  const result = await generateAgentReply(payload)
  const joinedItems = result.proposal.writeableContent.items.join('\n')
  const joinedCriteria = result.proposal.writeableContent.acceptanceCriteria.join('\n')

  assert.equal(context.canvasAction.actionIntent, 'api-contract-enrichment')
  assert.match(context.userPrompt, /动作意图：api-contract-enrichment/)
  assert.match(context.userPrompt, /接口契约|请求字段|返回字段|错误码/)
  assert.equal(result.proposal.actionIntent, 'api-contract-enrichment')
  assert.match(joinedItems, /接口|请求字段|返回字段|错误码|前端接管|后端接管|Mock/)
  assert.match(joinedCriteria, /字段|错误码|联调|Mock/)
  assert.equal(result.proposal.downstreamImpact[0].nodeId, 'handoff')
  assert.match(result.proposal.downstreamImpact[0].reason, /接口契约|前后端交接/)
})

testAsync('backend workflow agent exception state action has dedicated prompt and proposal structure', async () => {
  const run = {
    input: '做一个登录注册弹窗',
    workflowName: '认证弹窗需求分析',
    agentSessions: {},
    documentAnalysis: {
      canvas: {
        nodes: [
          {
            id: 'states',
            title: '状态与异常',
            summary: '当前缺少加载态、错误态和恢复入口',
            content: ['需要覆盖登录、注册、第三方授权']
          },
          {
            id: 'acceptance',
            title: '验收标准',
            summary: '验收标准需要引用异常状态'
          }
        ],
        edges: [],
        orderedTabs: ['states', 'acceptance']
      }
    }
  }
  const payload = {
    run,
    step: { id: 'states', title: '状态与异常', goal: '明确异常状态和恢复策略' },
    scopeId: 'states',
    model: 'gpt-5.5',
    references: [],
    now: '2026-06-21T00:00:00.000Z',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '请处理画布动作：补异常状态' },
    context: {
      activeNode: run.documentAnalysis.canvas.nodes[0],
      canvasAction: {
        action: '补异常状态',
        nodeId: 'states'
      }
    }
  }
  const context = buildAgentContext(payload)
  const result = await generateAgentReply(payload)
  const joinedItems = result.proposal.writeableContent.items.join('\n')
  const joinedCriteria = result.proposal.writeableContent.acceptanceCriteria.join('\n')

  assert.equal(context.canvasAction.actionIntent, 'exception-state-enrichment')
  assert.match(context.userPrompt, /动作意图：exception-state-enrichment/)
  assert.match(context.userPrompt, /异常状态|空状态|加载态|恢复入口/)
  assert.equal(result.proposal.actionIntent, 'exception-state-enrichment')
  assert.match(joinedItems, /加载态|空状态|错误态|权限|恢复入口|后端条件/)
  assert.match(joinedCriteria, /触发条件|恢复入口|可测试/)
  assert.equal(result.proposal.downstreamImpact[0].nodeId, 'acceptance')
  assert.match(result.proposal.downstreamImpact[0].reason, /异常状态|验收标准/)
})

testAsync('backend workflow agent analytics action has dedicated prompt and proposal structure', async () => {
  const run = {
    input: '做一个登录注册弹窗',
    workflowName: '认证弹窗需求分析',
    agentSessions: {},
    documentAnalysis: {
      canvas: {
        nodes: [
          {
            id: 'analytics',
            title: '埋点指标',
            summary: '当前缺少事件名、触发时机和属性',
            content: ['需要观察登录注册转化']
          },
          {
            id: 'quality',
            title: '质量评估',
            summary: '质量评估需要引用埋点指标'
          }
        ],
        edges: [],
        orderedTabs: ['analytics', 'quality']
      }
    }
  }
  const payload = {
    run,
    step: { id: 'analytics', title: '埋点指标', goal: '明确关键事件和转化指标' },
    scopeId: 'analytics',
    model: 'gpt-5.5',
    references: [],
    now: '2026-06-21T00:00:00.000Z',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '请处理画布动作：补埋点指标' },
    context: {
      activeNode: run.documentAnalysis.canvas.nodes[0],
      canvasAction: {
        action: '补埋点指标',
        nodeId: 'analytics'
      }
    }
  }
  const context = buildAgentContext(payload)
  const result = await generateAgentReply(payload)
  const joinedItems = result.proposal.writeableContent.items.join('\n')
  const joinedCriteria = result.proposal.writeableContent.acceptanceCriteria.join('\n')

  assert.equal(context.canvasAction.actionIntent, 'analytics-enrichment')
  assert.match(context.userPrompt, /动作意图：analytics-enrichment/)
  assert.match(context.userPrompt, /埋点|事件名|触发时机|指标/)
  assert.equal(result.proposal.actionIntent, 'analytics-enrichment')
  assert.match(joinedItems, /事件名|触发时机|事件属性|转化|隐私/)
  assert.match(joinedCriteria, /埋点|指标|漏斗|隐私/)
  assert.equal(result.proposal.downstreamImpact[0].nodeId, 'quality')
  assert.match(result.proposal.downstreamImpact[0].reason, /埋点|质量评估/)
})

testAsync('backend workflow agent quick replies prioritize action result and provider errors', async () => {
  const moduleProvider = {
    name: 'module-provider',
    async generate(context) {
      return {
        content: '已拆完模块，建议确认框架后补接口契约。',
        actionResult: {
          type: 'module-breakdown',
          nodeId: context.scopeId,
          nodeTitle: context.node.title
        },
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        provider: 'module-provider',
        model: context.model
      }
    }
  }
  const moduleRoutes = workflowRoutes(undefined, { agentProvider: moduleProvider })
  const created = await moduleRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })
  const moduleUpdated = await moduleRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '拆模块' },
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } }
  })

  assert.deepEqual(moduleUpdated.quickReplies.slice(0, 3), ['确认框架', '补接口契约', '拆前后端'])
  assert.deepEqual(moduleUpdated.run.agentQuickReplies.framework.slice(0, 3), ['确认框架', '补接口契约', '拆前后端'])

  const failingProvider = {
    name: 'failing-provider',
    async generate() {
      const error = new Error('模型配置无效')
      error.code = 'MODEL_CONFIG_INVALID'
      throw error
    }
  }
  const failedRoutes = workflowRoutes(undefined, { agentProvider: failingProvider })
  const failedCreated = await failedRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })
  const failedUpdated = await failedRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: failedCreated.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } }
  })

  assert.deepEqual(failedUpdated.quickReplies.slice(0, 3), ['重试', '换模型', '检查配置'])
  assert.equal(failedUpdated.error.code, 'MODEL_CONFIG_INVALID')
})

testAsync('backend workflow agent preserves structured provider error in assistant metadata', async () => {
  const failingProvider = {
    name: 'openai-compatible',
    async generate() {
      const error = new Error('当前 provider 不支持 gpt-5.5')
      error.code = 'LLM_MODEL_NOT_FOUND'
      error.recoveryActions = ['切换模型', '检查配置']
      error.model = 'gpt-5.5'
      error.apiSurface = 'responses'
      error.provider = 'openai-compatible'
      throw error
    }
  }
  const failedRoutes = workflowRoutes(undefined, { agentProvider: failingProvider })
  const failedCreated = await failedRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5'
  })
  const failedUpdated = await failedRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: failedCreated.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } }
  })

  assert.equal(failedUpdated.error.code, 'LLM_MODEL_NOT_FOUND')
  assert.equal(failedUpdated.error.message, '当前 provider 不支持 gpt-5.5')
  assert.deepEqual(failedUpdated.error.recoveryActions, ['切换模型', '检查配置'])
  assert.equal(failedUpdated.error.model, 'gpt-5.5')
  assert.equal(failedUpdated.error.apiSurface, 'responses')
  assert.deepEqual(failedUpdated.assistantMessage.meta.error, failedUpdated.error)
  assert.ok(failedUpdated.quickReplies.includes('切换模型'))
  assert.ok(failedUpdated.quickReplies.includes('检查配置'))
})

testAsync('backend workflow runner normalizes quick replies before persistence', async () => {
  const runnerSource = await readFile(new URL('../后端/services/workflow-runner.js', import.meta.url), 'utf8')
  const helperStart = runnerSource.indexOf('function normalizeAgentQuickReplies')
  const helperEnd = runnerSource.indexOf('function persistRunAgentReply', helperStart)
  const helperSource = runnerSource.slice(helperStart, helperEnd)
  const persistStart = runnerSource.indexOf('function persistRunAgentReply')
  const persistEnd = runnerSource.indexOf('function retrievedKnowledgeMeta', persistStart)
  const persistSource = runnerSource.slice(persistStart, persistEnd)

  assert.match(helperSource, /function normalizeAgentQuickReplies\(replies/)
  assert.match(helperSource, /\.map\(/)
  assert.match(helperSource, /\.filter\(/)
  assert.match(helperSource, /new Set\(/)
  assert.match(helperSource, /\.slice\(0,\s*6\)/)
  assert.match(persistSource, /const quickReplies = normalizeAgentQuickReplies\(/)
  assert.match(persistSource, /buildWorkflowAgentQuickReplies\(input\.run/)
  assert.match(persistSource, /\[input\.stepId\]: quickReplies/)
})

testAsync('backend workflow routes allow injected agent provider to own replies', async () => {
  const fakeProvider = {
    name: 'enterprise-provider',
    async generate(context) {
      return {
        content: `enterprise reply for ${context.actionType}`,
        actionResult: {
          type: context.actionType,
          nodeId: context.scopeId,
          nodeTitle: context.node.title
        },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        provider: 'enterprise-provider',
        model: context.model
      }
    }
  }
  const backendRoutes = workflowRoutes(undefined, { agentProvider: fakeProvider })
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })
  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    message: { role: 'user', content: '生成页面' },
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } }
  })

  assert.equal(updated.assistantMessage.content, 'enterprise reply for page-generation')
  assert.equal(updated.provider, 'enterprise-provider')
  assert.equal(updated.usage.totalTokens, 30)
  assert.equal(updated.run.agentSessions.framework[1].content, 'enterprise reply for page-generation')
})

testAsync('backend workspace workflow agent uses persisted model settings provider', async () => {
  const store = createWorkspaceStore()
  const workspaceBackendRoutes = workspaceRoutes(store)
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      async json() {
        return {
          output_text: 'persisted model reply',
          usage: { input_tokens: 5, output_tokens: 6, total_tokens: 11 }
        }
      }
    }
  }
  const backendRoutes = workspaceRoutes(store, { fetchImpl })
  await workspaceBackendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-workflow-agent',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-workflow-agent',
    apiSurface: 'responses',
    enabled: true
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })

  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-workflow-agent',
    message: { role: 'user', content: '生成页面' },
    context: { activeNode: { id: 'framework', title: '产品框架', summary: '模块、页面和能力结构。' } }
  })

  assert.equal(updated.provider, 'openai-compatible')
  assert.equal(updated.assistantMessage.content, 'persisted model reply')
  assert.equal(updated.usage.totalTokens, 11)
  assert.equal(calls[0].url, 'https://llm.example.com/v1/responses')
  assert.equal(calls[0].body.model, 'gpt-workflow-agent')
})

testAsync('backend workspace workflow agent records model call log with node action and timing', async () => {
  const store = createWorkspaceStore()
  const workspaceBackendRoutes = workspaceRoutes(store)
  await workspaceBackendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-workflow-agent-log',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-workflow-agent-log',
    apiSurface: 'responses',
    enabled: true
  })
  const backendRoutes = workspaceRoutes(store, {
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      async json() {
        return {
          output_text: JSON.stringify({
            content: '补验收标准建议',
            proposal: {
              title: '补验收标准',
              summary: '补齐当前节点验收标准。',
              writeableContent: {
                summary: '补齐验收标准。',
                items: ['提交按钮禁用态', '错误提示', '成功跳转'],
                acceptanceCriteria: ['登录成功后关闭弹窗']
              },
              downstreamImpact: []
            }
          }),
          usage: { input_tokens: 8, output_tokens: 13, total_tokens: 21 }
        }
      }
    })
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    projectId: 'project-agent-log',
    input: '做一个登录注册弹窗'
  })

  await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'acceptance',
    model: 'gpt-workflow-agent-log',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '请处理画布动作：补验收标准' },
    context: {
      activeNode: { id: 'acceptance', title: '验收标准', summary: '当前验收缺失' },
      canvasAction: {
        actionLabel: '补验收标准',
        actionIntent: 'canvas-action-advice',
        nodeId: 'acceptance'
      }
    }
  })
  const listed = await backendRoutes['GET /api/workspace/model-call-logs']({
    skillId: 'workflow-agent'
  })

  assert.equal(listed.logs.length, 1)
  assert.equal(listed.logs[0].skillId, 'workflow-agent')
  assert.equal(listed.logs[0].status, 'success')
  assert.equal(listed.logs[0].provider, 'openai-compatible')
  assert.equal(listed.logs[0].model, 'gpt-workflow-agent-log')
  assert.equal(listed.logs[0].projectId, 'project-agent-log')
  assert.equal(listed.logs[0].nodeId, 'acceptance')
  assert.equal(listed.logs[0].actionIntent, 'canvas-action-advice')
  assert.equal(listed.logs[0].entrySource, 'message')
  assert.equal(typeof listed.logs[0].durationMs, 'number')
  assert.equal(listed.logs[0].usage.totalTokens, 21)
})

testAsync('backend workspace workflow agent records fallback model call log with recovery metadata', async () => {
  const store = createWorkspaceStore()
  const workspaceBackendRoutes = workspaceRoutes(store)
  await workspaceBackendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-workflow-agent-log-fail',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-workflow-agent-log-fail',
    apiSurface: 'responses',
    enabled: true
  })
  const backendRoutes = workspaceRoutes(store, {
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      async json() {
        return { error: { message: 'provider down', code: 'provider_error' } }
      }
    })
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    projectId: 'project-agent-log-fail',
    input: '做一个登录注册弹窗'
  })

  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'acceptance',
    model: 'gpt-workflow-agent-log-fail',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '请处理画布动作：补验收标准' },
    context: {
      activeNode: { id: 'acceptance', title: '验收标准', summary: '当前验收缺失' },
      canvasAction: {
        actionLabel: '补验收标准',
        actionIntent: 'canvas-action-advice',
        nodeId: 'acceptance'
      }
    }
  })
  const listed = await backendRoutes['GET /api/workspace/model-call-logs']({
    skillId: 'workflow-agent',
    status: 'fallback'
  })

  assert.equal(updated.provider, 'deterministic')
  assert.equal(listed.logs.length, 1)
  assert.equal(listed.logs[0].status, 'fallback')
  assert.equal(listed.logs[0].nodeId, 'acceptance')
  assert.equal(listed.logs[0].actionIntent, 'canvas-action-advice')
  assert.match(listed.logs[0].fallbackReason, /provider down|模型/)
  assert.ok(listed.logs[0].recoveryActions.length)
})

testAsync('backend workflow routes persist canvas node scoped agent messages', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workflows/runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })
  const nodeId = 'wireframes'
  const updated = await backendRoutes['POST /api/workflows/runs/:runId/steps/:stepId/messages']({
    runId: created.run.id,
    stepId: nodeId,
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '只讨论低保真页面的控件细节。'
    },
    references: [
      { id: 'file-node', name: '低保真参考.png', kind: 'image', status: 'ready' }
    ]
  })

  assert.equal(updated.run.agentSessions[nodeId].length, 2)
  assert.match(updated.run.agentSessions[nodeId][0].content, /低保真页面/)
  assert.equal(updated.run.referenceFiles[nodeId][0].name, '低保真参考.png')
  assert.equal(updated.run.agentSessions[created.run.currentStepId], undefined)
})

testAsync('backend workflow agent message route preserves retry edit metadata and supports cancel', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    input: 'Podcastor.ai 是零门槛 AI 播客工作站'
  })
  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'framework',
    model: 'gpt-5.5',
    clientMessageId: 'client-message-1',
    retryOfMessageId: 'assistant-old',
    editOfMessageId: 'user-old',
    action: 'edit-resend',
    message: {
      role: 'user',
      content: '编辑后重新发送：请拆登录弹窗流程。'
    },
    context: {
      activeNode: {
        id: 'framework',
        title: '产品框架',
        summary: '模块、页面和能力结构。'
      }
    }
  })

  assert.equal(updated.run.agentSessions.framework[0].meta.clientMessageId, 'client-message-1')
  assert.equal(updated.run.agentSessions.framework[0].meta.retryOfMessageId, 'assistant-old')
  assert.equal(updated.run.agentSessions.framework[0].meta.editOfMessageId, 'user-old')
  assert.equal(updated.run.agentSessions.framework[0].meta.action, 'edit-resend')
  assert.equal(updated.assistantMessage.meta.clientMessageId, 'client-message-1')
  assert.equal(updated.assistantMessage.meta.retryOfMessageId, 'assistant-old')
  assert.equal(updated.assistantMessage.meta.editOfMessageId, 'user-old')
  assert.equal(updated.assistantMessage.meta.action, 'edit-resend')

  const cancelled = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/cancel']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-message-1'
  })

  assert.equal(cancelled.cancelled, true)
  assert.equal(cancelled.clientMessageId, 'client-message-1')
  assert.equal(cancelled.run.agentCancels.framework.clientMessageId, 'client-message-1')
})

testAsync('backend workflow agent cancel aborts active streaming provider request', async () => {
  let capturedSignal = null
  let resolveStarted
  let releaseStream
  const started = new Promise((resolve) => {
    resolveStarted = resolve
  })
  const released = new Promise((resolve) => {
    releaseStream = resolve
  })
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'abortable-stream-provider',
      async *stream(context, options = {}) {
        capturedSignal = options.signal
        resolveStarted()
        yield { type: 'delta', content: '开始生成' }
        await released
        yield {
          type: 'final',
          provider: 'abortable-stream-provider',
          model: context.model
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗'
  })
  const streaming = backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-stream-1',
    message: { role: 'user', content: '拆模块' }
  })
  await started

  const cancelled = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/cancel']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-stream-1'
  })

  assert.equal(cancelled.cancelled, true)
  assert.equal(cancelled.aborted, true)
  assert.equal(capturedSignal.aborted, true)
  releaseStream()
  await streaming
})

testAsync('backend workflow agent cancelled stream does not persist late assistant reply', async () => {
  let capturedSignal = null
  let resolveStarted
  let releaseStream
  const started = new Promise((resolve) => {
    resolveStarted = resolve
  })
  const released = new Promise((resolve) => {
    releaseStream = resolve
  })
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'signal-ignoring-provider',
      async *stream(context, options = {}) {
        capturedSignal = options.signal
        resolveStarted()
        yield { type: 'delta', content: '开始生成' }
        await released
        yield { type: 'delta', content: '迟到内容' }
        yield {
          type: 'final',
          provider: 'signal-ignoring-provider',
          model: context.model
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗'
  })
  const streaming = backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-stream-late',
    message: { role: 'user', content: '拆模块' }
  })
  await started
  await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/cancel']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-stream-late'
  })
  assert.equal(capturedSignal.aborted, true)
  releaseStream()
  const streamed = await streaming
  const afterDone = streamed.body.match(/event: done\ndata: (.+)\n\n/)
  assert.ok(afterDone)
  const result = JSON.parse(afterDone[1])

  assert.equal(result.cancelled, true)
  assert.equal(result.run.agentSessions?.framework?.length || 0, 0)
  assert.doesNotMatch(streamed.body, /迟到内容/)
})

testAsync('backend workflow agent cancelled stream does not emit empty assistant message event', async () => {
  let resolveStarted
  let releaseStream
  const started = new Promise((resolve) => {
    resolveStarted = resolve
  })
  const released = new Promise((resolve) => {
    releaseStream = resolve
  })
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'cancel-clean-protocol-provider',
      async *stream() {
        resolveStarted()
        await released
        yield { type: 'final', provider: 'cancel-clean-protocol-provider' }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    workflowId: 'podcastor-product-flow',
    input: '登录注册弹窗'
  })
  const streaming = backendRoutes['POST /api/workspace/workflow-runs/:id/messages/stream']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-stream-clean-cancel',
    message: { role: 'user', content: '拆模块' }
  })
  await started
  await backendRoutes['POST /api/workspace/workflow-runs/:id/messages/cancel']({
    id: created.run.id,
    stepId: 'framework',
    clientMessageId: 'client-stream-clean-cancel'
  })
  releaseStream()
  const streamed = await streaming

  assert.doesNotMatch(streamed.body, /event: message\ndata: \{\}\n\n/)
  assert.doesNotMatch(streamed.body, /"assistantMessage"/)
  assert.match(streamed.body, /event: done/)
  assert.match(streamed.body, /"cancelled":true/)
})

test('filters project scoped items by current project', () => {
  const items = [
    { id: 'one', projectId: 'project-a' },
    { id: 'two', projectId: 'project-b' },
    { id: 'legacy' }
  ]

  assert.deepEqual(scopeItems(items, 'project-a').map((item) => item.id), ['one'])
})

test('filters available skills by system global and current project visibility', () => {
  const skills = [
    { id: 'system', source: 'system' },
    { id: 'global', source: 'user', visibility: 'global' },
    { id: 'current', source: 'user', visibility: 'project', projectId: 'project-a' },
    { id: 'other', source: 'user', visibility: 'project', projectId: 'project-b' }
  ]

  assert.deepEqual(availableProjectSkills(skills, 'project-a').map((skill) => skill.id), [
    'system',
    'global',
    'current'
  ])
})

test('skill center loads smart recommendation as a system skill', () => {
  const skills = createSystemSkills()
  const smartSkill = skills.find((skill) => skill.id === 'smart-recommendation-skill')
  const interactionSkill = skills.find((skill) => skill.id === 'product-interaction-design-review-skill')

  assert.ok(smartSkill)
  assert.equal(smartSkill.name, '智能推荐 Skill')
  assert.equal(smartSkill.source, 'system')
  assert.match(smartSkill.description, /UX|大模型/)
  assert.ok(smartSkill.steps.some((step) => /画布/.test(step)))
  assert.ok(availableProjectSkills(skills, 'project-a').some((skill) => skill.id === 'smart-recommendation-skill'))
  assert.ok(interactionSkill)
  assert.equal(interactionSkill.name, '交互skill')
  assert.equal(interactionSkill.source, 'system')
  assert.equal(interactionSkill.category, '交互设计')
  assert.match(interactionSkill.description, /产品|交互|异常|交付/)
  assert.ok(interactionSkill.steps.some((step) => /业务目标/.test(step)))
  assert.ok(interactionSkill.steps.some((step) => /异常边界/.test(step)))
  assert.ok(availableProjectSkills(skills, 'project-a').some((skill) => skill.id === 'product-interaction-design-review-skill'))
  assert.equal(new Set(skills.map((skill) => skill.id)).size, skills.length)
})

test('smart recommendation skill uses design scheme ux decision framework', () => {
  const skills = createSystemSkills()
  const smartSkill = skills.find((skill) => skill.id === 'smart-recommendation-skill')

  assert.match(smartSkill.description, /design-scheme-ux|UX 决策链路/)
  assert.ok(smartSkill.steps.some((step) => /用户行为/.test(step)))
  assert.ok(smartSkill.steps.some((step) => /功能层级/.test(step)))
  assert.ok(smartSkill.steps.some((step) => /页面形态|弹窗|抽屉|新页签/.test(step)))
  assert.ok(smartSkill.steps.some((step) => /路径|返回状态/.test(step)))
  assert.ok(smartSkill.steps.some((step) => /弹窗|提示生命周期|Toast/.test(step)))
  assert.match(smartSkill.outputFormat, /用户行为结论/)
  assert.match(smartSkill.outputFormat, /形态决策/)
  assert.match(smartSkill.outputFormat, /弹窗与提示生命周期/)
  assert.ok(smartSkill.qualityChecks.includes('surface-decision'))
  assert.ok(smartSkill.qualityChecks.includes('overlay-lifecycle'))
  assert.ok(smartSkill.qualityChecks.includes('route-return-state'))
})

test('builds context from selected project scope and source types', () => {
  const state = normalizeWorkspaceState({
    currentProjectId: 'project-a',
    projects: [{ id: 'project-a', name: 'A' }, { id: 'project-b', name: 'B' }],
    knowledge: [{ id: 'k1', projectId: 'project-a' }, { id: 'k2', projectId: 'project-b' }],
    requirements: [{ id: 'r1', projectId: 'project-a' }],
    competitors: [{ id: 'c1', projectId: 'project-a' }],
    assets: [{ id: 'a1', projectId: 'project-a' }]
  })

  const context = projectScopedContext(state, {
    mode: 'current-project',
    sourceTypes: ['knowledge', 'assets']
  })

  assert.deepEqual(context.knowledge.map((item) => item.id), ['k1'])
  assert.deepEqual(context.assets.map((item) => item.id), ['a1'])
  assert.deepEqual(context.requirements, [])
  assert.deepEqual(context.competitors, [])
})

test('creates a project with stable required fields', () => {
  const project = createProject({
    name: '审批后台',
    description: '优化审批链路',
    domain: 'B 端后台',
    targetUsers: '审批发起人',
    stage: 'design'
  })

  assert.equal(project.name, '审批后台')
  assert.equal(project.stage, 'design')
  assert.ok(project.id)
  assert.ok(project.createdAt)
  assert.ok(project.updatedAt)
})

test('normalizes skill builder fields visibility and knowledge scope config', () => {
  const skill = normalizeSkill({
    name: '交互评审',
    source: 'user',
    projectId: 'project-a',
    visibility: 'project',
    inputFields: [
      {
        id: 'scene',
        label: '场景',
        type: 'textarea',
        required: true,
        placeholder: '描述业务场景',
        options: 'A\nB'
      }
    ],
    knowledgeScopeConfig: {
      mode: 'selected-projects',
      projectIds: ['project-a'],
      sourceTypes: ['knowledge']
    }
  })

  assert.equal(skill.visibility, 'project')
  assert.equal(skill.projectId, 'project-a')
  assert.equal(skill.inputFields[0].type, 'textarea')
  assert.deepEqual(skill.inputFields[0].options, ['A', 'B'])
  assert.equal(skill.knowledgeScopeConfig.mode, 'selected-projects')
  assert.deepEqual(skill.knowledgeScopeConfig.sourceTypes, ['knowledge'])
})

test('skill execution context respects knowledge scope config', () => {
  const state = normalizeWorkspaceState({
    currentProjectId: 'project-a',
    projects: [{ id: 'project-a', name: 'A' }, { id: 'project-b', name: 'B' }],
    knowledge: [{ id: 'k1', projectId: 'project-a' }, { id: 'k2', projectId: 'project-b' }],
    requirements: [{ id: 'r1', projectId: 'project-a' }],
    competitors: [{ id: 'c1', projectId: 'project-a' }],
    assets: [{ id: 'a1', projectId: 'project-a' }],
    palette: { primary: '#000' }
  })
  const skill = normalizeSkill({
    name: '只读知识',
    knowledgeScopeConfig: {
      mode: 'current-project',
      sourceTypes: ['knowledge']
    }
  })

  const context = buildSkillExecutionContext(state, skill, '生成方案')

  assert.deepEqual(context.knowledge.map((item) => item.id), ['k1'])
  assert.deepEqual(context.requirements, [])
  assert.deepEqual(context.competitors, [])
  assert.deepEqual(context.assets, [])
  assert.equal(context.projectId, 'project-a')
})

test('workflow draft generation creates three candidate options', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '优化审批流程')
  run.stepInputs[run.currentStepId] = {
    目标用户: '审批发起人',
    原始目标: '减少返工'
  }

  const generated = generateStepDraft(run)
  const options = generated.candidateOptions[generated.currentStepId]

  assert.equal(options.length, 3)
  assert.deepEqual(options.map((option) => option.title), ['低风险方案', '推荐方案', '完整方案'])
  assert.match(options[1].content, /推荐方案/)
})

test('can apply a candidate option to current workflow draft', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  let run = createWorkflowRun(workflow, '优化审批流程')
  run.stepInputs[run.currentStepId] = {
    目标用户: '审批发起人',
    原始目标: '减少返工'
  }
  run = generateStepDraft(run)
  const optionId = run.candidateOptions[run.currentStepId][1].id

  run = applyCandidateOption(run, optionId)

  assert.match(run.stepDraftOutputs[run.currentStepId], /推荐方案/)
})

test('final workflow completion creates final conclusion and exports it first', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  let run = createWorkflowRun(workflow, '拆解 AI 需求工具')

  workflow.steps.forEach((step) => {
    run.stepInputs[run.currentStepId] = Object.fromEntries(step.requiredFields.map((field) => [field, `${field} 内容`]))
    run = generateStepDraft(run)
    run = acceptCurrentStep(run, run.stepDraftOutputs[run.currentStepId])
    run = completeCurrentStep(run, run.stepOutputs[step.id])
  })

  run = ensureFinalConclusion(run)

  assert.equal(run.status, 'completed')
  assert.ok(run.finalConclusion)
  assert.match(run.finalConclusion.recommendedPlan, /推荐方案/)

  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /## 最终结论/)
  assert.ok(markdown.indexOf('## 最终结论') < markdown.indexOf('## Step 1：需求理解'))
})

test('provides a Podcastor product flow with product positioning and MVP scope', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  assert.ok(workflow)
  assert.equal(workflow.name, 'Podcastor 产品体验流')
  assert.equal(workflow.assetType, 'Podcastor 产品方案')
  assert.deepEqual(workflow.steps[0].requiredFields, ['目标创作者', '核心痛点', '产品定位', '一期范围', '成功标准'])

  const run = createWorkflowRun(workflow, 'Podcastor.ai 是零门槛的 AI 播客工作站，支持 Generate Script、Upload Script、Upload Audio Podcast。')
  run.stepInputs[run.currentStepId] = {
    目标创作者: '独立播客创作者、自媒体 IP、内容营销人员',
    核心痛点: '出镜门槛高、脚本音频视频制作割裂',
    产品定位: '零门槛的 AI 播客工作站',
    一期范围: '脚本生成、音频播客生成、视频播客生成、作品存储',
    成功标准: '从想法、URL、文档或音频开始完成播客生成'
  }

  const output = produceStepOutput(run)
  assert.match(output.content, /零门槛的 AI 播客工作站/)
  assert.match(output.content, /脚本生成、音频播客生成、视频播客生成/)
})

test('builds an actionable workflow workbench with lock reasons and primary actions', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  const run = createWorkflowRun(workflow, 'Podcastor.ai 项目')
  const firstView = buildWorkflowWorkbenchView(run)

  assert.equal(firstView.title, 'AI 分步工作台')
  assert.equal(firstView.steps[0].statusLabel, '可生成')
  assert.equal(firstView.steps[1].statusLabel, '未解锁')
  assert.equal(firstView.steps[1].canInspect, true)
  assert.match(firstView.steps[1].lockReason, /请先确认 Step 1/)
  assert.match(firstView.steps[1].lockReason, /目标创作者/)
  assert.equal(firstView.current.primaryAction.label, '生成本步草稿')
  assert.ok(firstView.current.secondaryActions.find((action) => action.id === 'use-example'))
  assert.ok(firstView.current.secondaryActions.find((action) => action.id === 'skip-defaults'))
  assert.match(firstView.current.emptyOutputHint, /AI 产出会出现在这里/)

  const generated = generateStepDraft({
    ...run,
    stepInputs: {
      [run.currentStepId]: defaultWorkflowStepInputs(run, run.steps[0], 'example')
    }
  })
  const generatedView = buildWorkflowWorkbenchView(generated)
  assert.equal(generatedView.steps[0].statusLabel, '待确认')
  assert.equal(generatedView.current.primaryAction.label, '采纳并进入 Step 2')

  const accepted = acceptCurrentStep(generated, generated.stepDraftOutputs[generated.currentStepId])
  const acceptedView = buildWorkflowWorkbenchView(accepted)
  assert.equal(acceptedView.steps[0].statusLabel, '已确认')
  assert.equal(acceptedView.current.primaryAction.label, '进入下一步')

  const next = completeCurrentStep(accepted, accepted.stepOutputs[accepted.currentStepId])
  const nextView = buildWorkflowWorkbenchView(next)
  assert.equal(nextView.steps[1].statusLabel, '可生成')
})

test('builds a workflow agent session with step history and suggested replies', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  let run = createWorkflowRun(workflow, 'Podcastor.ai 项目')
  run.model = 'gpt-4.1'
  run.referenceFiles = {
    [run.currentStepId]: [
      { id: 'file-1', name: 'Podcastor PRD.docx', kind: 'document', status: 'ready', text: '播客产品需求' }
    ]
  }
  const initialSession = buildWorkflowAgentSession(run)

  assert.equal(initialSession.title, 'Step 1：播客需求诊断')
  assert.ok(initialSession.messages.some((message) => message.role === 'assistant' && /先回答/.test(message.content)))
  assert.equal(initialSession.model.current, 'gpt-4.1')
  assert.ok(initialSession.model.options.some((option) => option.value === 'gpt-4.1'))
  const backendConfiguredSession = buildWorkflowAgentSession(run, {
    model: 'gpt-5.5',
    modelOptions: [{ value: 'gpt-5.5', label: 'GPT-5.5' }]
  })
  assert.equal(backendConfiguredSession.model.current, 'gpt-5.5')
  assert.deepEqual(backendConfiguredSession.model.options, [{ value: 'gpt-5.5', label: 'GPT-5.5' }])
  const defaultModelSession = buildWorkflowAgentSession({ ...run, model: '' })
  assert.equal(defaultModelSession.model.current, 'gpt-5.5')
  assert.equal(defaultModelSession.model.options[0].value, 'gpt-5.5')
  assert.equal(initialSession.references.length, 1)
  assert.equal(initialSession.references[0].name, 'Podcastor PRD.docx')
  assert.ok(initialSession.quickReplies.includes('无疑问，跳过'))
  assert.ok(initialSession.quickReplies.includes('使用示例生成'))
  assert.ok(initialSession.quickReplies.includes('补充资料'))

  run.agentSessions = {
    [run.currentStepId]: [
      { role: 'user', content: '目标用户是独立播客创作者', createdAt: '2026-06-20T00:00:00.000Z' }
    ]
  }
  run = generateStepDraft({
    ...run,
    stepInputs: {
      [run.currentStepId]: defaultWorkflowStepInputs(run, run.steps[0], 'example')
    }
  })
  const generatedSession = buildWorkflowAgentSession(run)

  assert.ok(generatedSession.messages.some((message) => message.role === 'user' && /独立播客/.test(message.content)))
  assert.ok(generatedSession.messages.some((message) => message.role === 'assistant' && /已生成草稿/.test(message.content)))
  assert.ok(generatedSession.history.some((item) => item.label.includes('版本')))
  assert.ok(generatedSession.quickReplies.includes('采纳并进入下一步'))
  assert.ok(generatedSession.quickReplies.includes('重新生成'))
})

test('workflow agent quick replies adapt to node state artifacts and history', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  let run = createWorkflowRun(workflow, 'Podcastor.ai 项目')

  let session = buildWorkflowAgentSession(run)
  assert.deepEqual(session.quickReplies.slice(0, 4), ['使用示例生成', '补充资料', '生成本步草稿', '无疑问，跳过'])

  run = generateStepDraft({
    ...run,
    stepInputs: {
      [run.currentStepId]: defaultWorkflowStepInputs(run, run.steps[0], 'example')
    }
  })
  session = buildWorkflowAgentSession(run)
  assert.ok(session.quickReplies.includes('采纳并进入下一步'))
  assert.ok(session.quickReplies.includes('重新生成'))

  run.stepOutputs[run.currentStepId] = '已确认当前步骤'
  run.projectBlueprint = { title: 'Podcastor 蓝图' }
  run.demoArtifacts = { lowFi: { screens: [] }, html: '<main>demo</main>' }
  session = buildWorkflowAgentSession(run)
  assert.ok(session.quickReplies.includes('进入下一步'))
  assert.ok(session.quickReplies.includes('生成低保真') || session.quickReplies.includes('生成可交互 HTML') || session.quickReplies.includes('导出 Vue 代码'))

  const nodeSession = buildWorkflowAgentSession(run, {
    activeNode: {
      id: 'handoff',
      title: '前后端交接',
      quickActions: ['补接口契约', '拆前后端'],
      agentInteraction: {
        goal: '只讨论前后端交接。',
        quickReplies: ['确认交接']
      }
    }
  })
  assert.deepEqual(nodeSession.quickReplies.slice(0, 3), ['确认交接', '补接口契约', '拆前后端'])
})

test('builds a workflow agent session scoped to the active canvas node', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  const run = createWorkflowRun(workflow, 'Podcastor.ai 项目')
  const activeNode = {
    id: 'wireframes',
    title: '低保真页面',
    agentInteraction: {
      goal: '只讨论低保真页面的结构、控件和跳转。',
      quickReplies: ['补充空状态', '确认低保真'],
      inputPlaceholder: '只针对低保真页面提问。',
      confirmationRule: '确认页面结构后再进入可交互 Demo。'
    }
  }

  run.agentSessions = {
    [run.currentStepId]: [
      { role: 'user', content: '这是大步骤里的消息', createdAt: '2026-06-20T00:00:00.000Z' }
    ],
    wireframes: [
      { role: 'user', content: '低保真需要展示上传区和状态区', createdAt: '2026-06-20T00:01:00.000Z' }
    ]
  }
  run.referenceFiles = {
    [run.currentStepId]: [
      { id: 'step-file', name: '步骤资料.docx', kind: 'document', status: 'ready' }
    ],
    wireframes: [
      { id: 'node-file', name: '低保真参考.png', kind: 'image', status: 'ready' }
    ]
  }

  const session = buildWorkflowAgentSession(run, { activeNode })

  assert.equal(session.title, '低保真页面')
  assert.equal(session.subtitle, '只讨论低保真页面的结构、控件和跳转。')
  assert.equal(session.references.length, 1)
  assert.equal(session.references[0].name, '低保真参考.png')
  assert.ok(session.messages.some((message) => /只讨论「低保真页面」/.test(message.content)))
  assert.ok(session.messages.some((message) => /低保真需要展示上传区/.test(message.content)))
  assert.ok(!session.messages.some((message) => /这是大步骤里的消息/.test(message.content)))
  assert.deepEqual(session.quickReplies.slice(0, 2), ['补充空状态', '确认低保真'])
})

test('builds ordered artifact stages for blueprint low-fi html and vue export', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  const run = createWorkflowRun(workflow, 'Podcastor.ai 项目')
  const initialStages = buildWorkflowArtifactStages(run)

  assert.deepEqual(initialStages.map((stage) => stage.id), ['blueprint', 'lofi', 'html-demo', 'vue-export'])
  assert.equal(initialStages[0].status, 'available')
  assert.equal(initialStages[1].status, 'locked')

  const withBlueprint = { ...run, projectBlueprint: { title: 'Podcastor 蓝图' } }
  const afterBlueprint = buildWorkflowArtifactStages(withBlueprint)
  assert.equal(afterBlueprint[0].status, 'done')
  assert.equal(afterBlueprint[1].status, 'available')

  const withDemo = { ...withBlueprint, demoArtifacts: { lowFi: true, html: '<main>Demo</main>', vueZipReady: true } }
  const afterDemo = buildWorkflowArtifactStages(withDemo)
  assert.deepEqual(afterDemo.map((stage) => stage.status), ['done', 'done', 'done', 'done'])
})

test('Podcastor delivery output separates frontend and backend files', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'podcastor-product-flow')
  let run = createWorkflowRun(workflow, 'Podcastor.ai 项目')
  run.currentStepId = 'podcast-validation-delivery'
  run.steps = run.steps.map((step) => ({
    ...step,
    status: step.id === 'podcast-validation-delivery' ? 'active' : 'accepted'
  }))
  run.stepInputs[run.currentStepId] = defaultWorkflowStepInputs(run, run.steps.find((step) => step.id === run.currentStepId), 'example')

  const output = produceStepOutput(run).content
  assert.match(output, /## 前端文件/)
  assert.match(output, /## 后端文件/)
  assert.match(output, /src\/App.vue/)
  assert.match(output, /后端\//)
})

test('builds a project scoped Podcastor blueprint with interaction tree and demo screens', () => {
  const project = createProject({
    id: 'project-podcastor',
    name: 'Podcastor.ai',
    domain: 'AI 播客工作站',
    targetUsers: '独立播客创作者、自媒体 IP、内容营销人员',
    stage: 'design',
    description: '从想法、URL、文档或音频开始，一站式生成播客。'
  })
  const blueprint = buildProjectBlueprint({
    project,
    input: 'Podcastor.ai 支持 Generate Script、Upload Script、Upload Audio Podcast，进入核心编辑器后选择主持人、音色、预览音频并生成视频。',
    documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', text: '零门槛的AI播客工作站。长播客切为 TikTok/IG Reels 竖屏短切片。' }]
  })

  assert.equal(blueprint.projectId, 'project-podcastor')
  assert.equal(blueprint.profile.productName, 'Podcastor.ai')
  assert.match(blueprint.profile.positioning, /AI 播客工作站/)
  assert.ok(blueprint.framework.children.find((node) => node.title === '核心编辑器'))
  assert.ok(blueprint.interactionTree.children.find((node) => node.title === '首页创作入口'))
  assert.ok(blueprint.demoScreens.find((screen) => screen.id === 'editor'))
  assert.ok(blueprint.outlineDiff.added.some((item) => /三 Tab/.test(item)))
  const homeFlow = blueprint.interactionTree.children.find((node) => node.title === '首页创作入口')
  assert.ok(homeFlow.ui)
  assert.equal(homeFlow.ui.layout, '居中创作面板')
  assert.ok(homeFlow.ui.components.some((component) => component.type === 'segmented-tabs'))
  assert.ok(homeFlow.ui.components.some((component) => component.type === 'textarea'))
  const homeDemo = blueprint.demoScreens.find((screen) => screen.id === 'home')
  assert.ok(homeDemo.wireframe.sections.find((section) => section.name === '创作输入框'))
  assert.ok(homeDemo.wireframe.components.some((component) => component.type === 'upload-chip'))
  const editorDemo = blueprint.demoScreens.find((screen) => screen.id === 'editor')
  assert.ok(editorDemo.wireframe.components.some((component) => component.type === 'sidebar-card-list'))
  assert.ok(editorDemo.wireframe.components.some((component) => component.type === 'script-editor'))
  assert.ok(blueprint.interactionSpec)
  assert.ok(blueprint.interactionSpec.standards.some((item) => /Material/.test(item.source)))
  assert.ok(blueprint.interactionSpec.pageSpecs.find((page) => page.screenId === 'home'))
  assert.ok(blueprint.interactionSpec.pageSpecs.every((page) => page.states?.length >= 4))
  assert.ok(blueprint.interactionSpec.pageSpecs.some((page) => page.exceptions?.some((item) => /权限|失败|网络|解析/.test(item.trigger))))
  assert.ok(blueprint.interactionSpec.navigationRules.some((rule) => /返回/.test(rule.rule)))
  assert.ok(blueprint.interactionSpec.acceptanceChecks.some((item) => /空状态/.test(item)))
  assert.ok(blueprint.interactionSkillV2)
  assert.equal(blueprint.interactionSkillV2.version, 'v2')
  assert.match(blueprint.interactionSkillV2.inputStrategy.uploadPlacement, /输入框底部|输入框下方/)
  assert.deepEqual(blueprint.interactionSkillV2.agentStages.map((stage) => stage.id), [
    'requirement-review',
    'solution-grouping',
    'wireframe-plan',
    'quality-repair',
    'interactive-demo',
    'html-delivery',
    'figma-handoff',
    'vue-export'
  ])
  assert.ok(blueprint.interactionSkillV2.requirementGroups.some((group) => /首页|创作入口/.test(group.title)))
  assert.ok(blueprint.interactionSkillV2.pageGroups.some((group) => group.pages.includes('home') && group.priority === 'P0'))
  assert.ok(blueprint.interactionSkillV2.solutionGroups.some((group) => group.options.length >= 2 && group.selectedOptionId))
  assert.ok(blueprint.interactionSkillV2.wireframePlan.pages.some((page) => page.id === 'home' && page.components.some((item) => item.type === 'dropzone')))
  assert.ok(blueprint.interactionSkillV2.wireframePlan.actions.some((action) => action.actionType === 'navigate' && action.target?.pageId === 'editor'))
  assert.ok(blueprint.interactionSkillV2.qualityReport.score >= 80)
  assert.ok(blueprint.interactionSkillV2.qualityReport.repairItems.some((item) => /上传|状态|返回/.test(item.reason)))
  assert.ok(blueprint.interactionSkillV2.demoScenarioMatrix.some((item) => item.id === 'upload-error' && item.recovery))
  assert.ok(blueprint.interactionSkillV3)
  assert.equal(blueprint.interactionSkillV3.version, 'v3')
  assert.ok(blueprint.interactionSkillV3.stateMachines.some((machine) => machine.pageId === 'home' && machine.transitions.some((transition) => transition.event === 'upload.failed' && /重新上传|保留/.test(transition.recovery))))
  assert.ok(blueprint.interactionSkillV3.uiNodeTree.some((page) => page.pageId === 'home' && page.nodes.some((node) => node.control === 'dropzone' && /输入框/.test(node.placement))))
  assert.ok(blueprint.interactionSkillV3.demoSchema.pages.some((page) => page.id === 'home' && page.defaultScenarioId === 'happy-path'))
  assert.ok(blueprint.interactionSkillV3.demoSchema.interactionModes.includes('split'))
  assert.ok(blueprint.interactionSkillV3.reviewWorkbench.panels.some((panel) => panel.id === 'requirement-tree' && /右侧/.test(panel.placement)))
  assert.ok(blueprint.interactionSkillV3.qaProtocol.gates.some((gate) => gate.id === 'state-machine-coverage' && gate.required))
  assert.ok(blueprint.interactionSkillV3.qaProtocol.repairLoop.some((step) => /修复/.test(step.action)))
  assert.ok(blueprint.opportunityValidation)
  assert.equal(blueprint.opportunityValidation.version, 'v1')
  assert.ok(blueprint.opportunityValidation.journeyMaps.some((journey) => journey.touchpoints.some((touchpoint) => /上传|解析/.test(touchpoint.touchpoint) && touchpoint.evidence.length)))
  assert.ok(blueprint.opportunityValidation.serviceBlueprints.some((item) => item.failurePoints.some((failure) => /解析失败|Demo/.test(failure))))
  assert.ok(blueprint.opportunityValidation.topOpportunities.some((item) => item.priority === 'P0' && item.surfaceDecision.recommended === 'inline-panel' && item.weight >= 80))
  assert.ok(blueprint.opportunityValidation.topOpportunities.every((item) => item.rice?.score > 0 && item.kano && item.pyramidLevel))
  assert.ok(blueprint.opportunityValidation.threeRoundReview.uxReviewPatch.items.some((item) => /解析|上传/.test(item.action)))
  assert.ok(blueprint.opportunityValidation.finalIterationPlan.some((item) => /上传解析透明化/.test(item.title)))

  const markdown = exportBlueprintMarkdown(blueprint)
  assert.match(markdown, /# Podcastor.ai 项目蓝图/)
  assert.match(markdown, /## 交互路径树/)
  assert.match(markdown, /## 交互说明规格/)
  assert.match(markdown, /## Interaction Skill v2/)
  assert.match(markdown, /## Interaction Skill v3/)
  assert.match(markdown, /## Opportunity Validation/)
  assert.match(markdown, /机会点 Top/)
  assert.match(markdown, /State Machine/)
  assert.match(markdown, /Demo Schema JSON/)
  assert.match(markdown, /Wireframe Plan JSON/)
  assert.match(markdown, /页面状态矩阵/)
  assert.match(markdown, /异常与恢复/)
  assert.match(markdown, /Generate Script/)
  assert.match(markdown, /控件：分段 Tab/)
  assert.match(markdown, /创作输入框/)

  const html = buildBlueprintDemoHtml(blueprint)
  assert.match(html, /<!doctype html>/)
  assert.match(html, /Turn Your Ideas Into Podcasts/)
  assert.match(html, /Generate Script/)
  assert.match(html, /Preview Audio/)
  assert.match(html, /data-screen="editor"/)
  assert.match(html, /const demoState =/)
  assert.match(html, /data-tab="generate"/)
  assert.match(html, /data-upload-kind="document"/)
  assert.match(html, /function renderComposer/)
  assert.match(html, /function renderEditorState/)
  assert.match(html, /function startGeneration/)
  assert.match(html, /data-action="preview-audio"/)
  assert.match(html, /data-action="save-draft"/)
  assert.match(html, /data-action="open-work"/)
  assert.match(html, /data-scenario="upload-error"/)
  assert.match(html, /data-scenario="permission"/)
  assert.match(html, /data-scenario="empty"/)
  assert.match(html, /function applyScenario/)
  assert.match(html, /异常演练/)
  assert.match(html, /data-demo-engine="skill-v3"/)
  assert.match(html, /const demoSchema =/)
  assert.match(html, /const stateMachines =/)
  assert.match(html, /function applyStateTransition/)
  assert.match(html, /function runDemoQualityCheck/)
  assert.match(html, /Demo QA/)
  assert.match(html, /State Machine/)
  assert.match(html, /未保存返回/)
  assert.match(html, /data-scenario="unsaved-back"/)
  assert.match(html, /data-mode-panel="command"/)
  assert.match(html, /data-mode-panel="split"/)

  const variantHtml = buildBlueprintDemoHtml(blueprint, {
    styleVariant: 'editorial',
    interactionMode: 'split',
    referenceUrl: 'https://www.gaoding.art/creation',
    revision: 2
  })
  assert.match(variantHtml, /data-style="editorial"/)
  assert.match(variantHtml, /data-interaction="split"/)
  assert.match(variantHtml, /参考风格：https:\/\/www.gaoding.art\/creation/)
  assert.match(variantHtml, /Demo v2/)
  assert.match(variantHtml, /Split Workspace/)
  assert.match(variantHtml, /data-demo-engine="skill-v3"/)

  const refreshedHtml = buildBlueprintDemoHtml(blueprint, {
    styleVariant: 'product',
    interactionMode: 'command',
    revision: 3
  })
  assert.match(refreshedHtml, /data-style="product"/)
  assert.match(refreshedHtml, /data-interaction="command"/)
  assert.match(refreshedHtml, /Demo v3/)
  assert.match(refreshedHtml, /Command Palette/)
  assert.match(refreshedHtml, /刷新策略：强调更快主操作和更明显恢复入口/)
})

test('builds a document-specific blueprint for non-Podcastor podcast products', () => {
  const project = createProject({
    id: 'project-pets-cartoon',
    name: 'Pets/Cartoon Podcast',
    domain: '宠物和卡通播客内容生产工具',
    targetUsers: '播客创作者、宠物内容创作者、卡通 IP 内容团队',
    stage: 'discovery'
  })
  const blueprint = buildProjectBlueprint({
    project,
    input: 'Pets/Cartoon Podcast v1.0版本 一、需求背景 近期播客市场上宠物和卡通的播客内容逐渐火热起来，消费市场的火热创造出生产端的需求。',
    documents: [{
      name: 'Pets_Cartoon Podcast v1.0版本.docx',
      text: 'Pets/Cartoon Podcast v1.0版本 一、需求背景 近期播客市场上宠物和卡通的播客内容逐渐火热起来，消费市场的火热创造出生产端的需求，我们可以进入需求拆解。'
    }]
  })

  assert.equal(blueprint.profile.productName, 'Pets/Cartoon Podcast')
  assert.doesNotMatch(blueprint.title, /Podcastor\.ai/)
  assert.doesNotMatch(blueprint.profile.primaryGoal, /脚本、音频、视频播客并沉淀资产/)
  assert.ok(blueprint.framework.children.some((item) => /宠物|卡通|内容|需求/.test(item.title)))
  assert.ok(blueprint.demoScreens.some((screen) => /需求|创作|内容/.test(`${screen.title} ${screen.description}`)))
  assert.ok(blueprint.interactionSkillV2.requirementGroups.some((group) => /宠物|卡通|内容|需求/.test(`${group.title} ${group.reviewPoints.join(' ')}`)))
  assert.ok(blueprint.reviewChecklist.some((item) => /宠物|卡通|目标用户|需求/.test(item)))
})

test('routes login and registration requirements to an auth page blueprint', () => {
  const project = createProject({
    id: 'project-auth',
    name: '业务系统',
    domain: '企业级 SaaS',
    targetUsers: '注册用户、运营人员',
    stage: 'design'
  })
  const blueprint = buildProjectBlueprint({
    project,
    input: '做一个登录注册页面，需要真正能和后端接口联调。',
    documents: []
  })

  const screenText = blueprint.demoScreens.map((screen) => `${screen.id} ${screen.title} ${screen.description}`).join('\n')
  const frameworkText = blueprint.framework.children.map((item) => `${item.title} ${(item.children || []).map((child) => child.title).join(' ')}`).join('\n')
  const markdown = exportBlueprintMarkdown(blueprint)

  assert.equal(blueprint.intent, 'auth-page')
  assert.equal(blueprint.type, 'page-blueprint')
  assert.match(blueprint.profile.productName, /登录注册|认证/)
  assert.match(screenText, /登录页/)
  assert.match(screenText, /注册页/)
  assert.match(screenText, /忘记密码|重置密码/)
  assert.match(frameworkText, /表单校验/)
  assert.match(frameworkText, /账号安全|认证接口/)
  assert.ok(blueprint.demoScreens.some((screen) => screen.actions.some((action) => /api\/auth\/login/.test(action.api || ''))))
  assert.ok(blueprint.demoScreens.some((screen) => screen.actions.some((action) => /api\/auth\/register/.test(action.api || ''))))
  assert.ok(blueprint.backendContract?.endpoints?.some((endpoint) => endpoint.path === '/api/auth/login' && endpoint.method === 'POST'))
  assert.ok(blueprint.backendContract?.endpoints?.some((endpoint) => endpoint.path === '/api/auth/register' && endpoint.method === 'POST'))
  assert.ok(blueprint.backendContract?.errorCodes?.some((item) => item.code === 'INVALID_CREDENTIALS'))
  assert.doesNotMatch(screenText, /Podcastor|播客|宠物|卡通/)
  assert.doesNotMatch(markdown, /Opportunity Validation|机会点 Top|Podcastor/)
  assert.match(markdown, /前端接管/)
  assert.match(markdown, /后端接管/)
})

test('uploaded document context overrides stale Podcastor project selection', () => {
  const staleProject = createProject({
    id: 'project-podcastor',
    name: 'Podcastor.ai',
    domain: 'AI 播客工作站',
    targetUsers: '独立播客创作者',
    stage: 'design',
    description: '从想法、URL、文档或音频开始，一站式生成播客。'
  })
  const blueprint = buildProjectBlueprint({
    project: staleProject,
    input: 'Pets/Cartoon Podcast v1.0版本 一、需求背景 近期播客市场上宠物和卡通的播客内容逐渐火热起来。',
    documents: [{
      name: 'Pets_Cartoon Podcast v1.0版本.docx',
      text: 'Pets/Cartoon Podcast v1.0版本 一、需求背景 宠物和卡通播客内容需求增长，需要规划内容创作和分发验证流程。'
    }]
  })

  assert.equal(blueprint.profile.productName, 'Pets/Cartoon Podcast')
  assert.doesNotMatch(blueprint.title, /Podcastor\.ai/)
  assert.ok(blueprint.framework.children.some((item) => /宠物|卡通|内容/.test(item.title)))
})

test('converts project blueprint into structured knowledge items', () => {
  const project = createProject({
    id: 'project-podcastor',
    name: 'Podcastor.ai',
    domain: 'AI 播客工作站',
    targetUsers: '独立播客创作者、自媒体 IP、内容营销人员',
    stage: 'design'
  })
  const blueprint = buildProjectBlueprint({
    project,
    input: 'Podcastor.ai 支持从 URL 和文档开始生成播客。',
    documents: [{ name: 'Podcastor.ai PRD', text: '核心编辑器、脚本编辑、音频预览、视频生成。' }]
  })

  const items = blueprintKnowledgeItems(blueprint, { projectId: 'project-podcastor', sourceAssetId: 'asset-1' })

  assert.ok(items.length >= 6)
  assert.ok(items.every((item) => item.projectId === 'project-podcastor'))
  assert.ok(items.every((item) => item.sourceType === 'blueprint'))
  assert.ok(items.every((item) => item.sourceAssetId === 'asset-1'))
  assert.ok(items.every((item) => item.status === '已沉淀'))
  assert.ok(items.some((item) => item.category === 'blueprint-profile' && /零门槛的 AI 播客工作站/.test(item.content)))
  assert.ok(items.some((item) => item.category === 'blueprint-framework' && /核心编辑器/.test(item.content)))
  assert.ok(items.some((item) => item.category === 'blueprint-interaction' && /首页创作入口/.test(item.title)))
  assert.ok(items.some((item) => item.category === 'blueprint-interaction-spec' && /页面状态矩阵/.test(item.content)))
  assert.ok(items.some((item) => item.category === 'blueprint-interaction-skill-v3' && /Demo Schema JSON/.test(item.content)))
  assert.ok(items.some((item) => item.category === 'blueprint-interaction-skill-v2' && /页面交互说明规则/.test(item.title)))
  assert.ok(items.some((item) => item.category === 'blueprint-interaction-skill-v3' && /Demo 生成规则/.test(item.title)))
  assert.ok(items.every((item) => !/Interaction Skill v[23]/.test(item.title)))
  assert.ok(items.some((item) => item.category === 'blueprint-opportunity-validation' && /机会点 Top/.test(item.content)))
  assert.ok(items.some((item) => item.category === 'blueprint-demo-screen' && /Generate Video/.test(item.content)))
  assert.ok(items.some((item) => item.category === 'blueprint-review' && /PDF\/PPT/.test(item.content)))
})

test('builds transparent document analysis view for uploaded requirement files', () => {
  const view = buildDocumentAnalysisView([
    { id: 'a', name: 'Podcastor PRD.docx', status: '已读取', text: '产品定位\n核心编辑器\n视频生成' },
    { id: 'b', name: 'Broken.pdf', status: '读取失败', text: '读取失败：格式异常' },
    { id: 'c', name: 'Need backend.pdf', status: '待后端解析', text: '' }
  ])

  assert.equal(view.total, 3)
  assert.equal(view.readyCount, 1)
  assert.equal(view.failedCount, 1)
  assert.equal(view.pendingCount, 1)
  assert.equal(view.stage, 'partial')
  assert.ok(view.items.find((item) => item.id === 'a').summary.length)
  assert.ok(view.items.find((item) => item.id === 'b').recoveryActions.includes('重新上传'))
  assert.ok(view.items.find((item) => item.id === 'c').nextStep.includes('后端'))
})

testAsync('workflow entry isolates document analysis from legacy workbench panels', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage')
  const entrySource = appSource.slice(entryStart, entryEnd)

  assert.ok(entryStart > 0)
  assert.ok(entryEnd > entryStart)
  assert.doesNotMatch(entrySource, /workflow-runner-panel/)
  assert.match(entrySource, /@click="analyzeWorkflowDocuments">分析文档<\/button>/)
  assert.match(entrySource, /分析记录/)
  assert.match(entrySource, /workflowAnalysisRecords/)
  assert.match(entrySource, /openWorkflowAnalysisRecord/)
  assert.doesNotMatch(entrySource, /保存蓝图|导出 Markdown/)
  assert.doesNotMatch(appSource, /workflowRoute === 'entry' && activeProjectBlueprint/)
  assert.doesNotMatch(appSource, /workflowRoute === 'entry' && activeWorkflowRun && workflowWorkbenchView/)
  assert.doesNotMatch(appSource, /workflowRoute === 'entry' && activeWorkflowRun\?\.finalConclusion/)
  assert.doesNotMatch(appSource, /workflowRoute === 'entry' && !activeWorkflowRun/)
})

testAsync('workflow analysis records persist successful document analysis runs', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const clearUploadSource = appSource.slice(
    appSource.indexOf('function clearWorkflowRequirementFiles'),
    appSource.indexOf('async function analyzeWorkflowDocuments')
  )

  assert.match(appSource, /workflowRuns:\s*\[\]/)
  assert.match(appSource, /const savedRunResult = await api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*nextRun\)/)
  assert.match(appSource, /state\.workflowRuns\s*=\s*upsertWorkflowRunRecord\(state\.workflowRuns,\s*persistedRun\)/)
  assert.doesNotMatch(appSource, /void api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*nextRun\)/)
  assert.match(appSource, /const workflowAnalysisRecords = computed/)
  assert.match(appSource, /documentAnalysis\?\.canvas/)
  assert.match(appSource, /function openWorkflowAnalysisRecord/)
  assert.doesNotMatch(clearUploadSource, /workflowRuns\s*=\s*\[\]/)
})

testAsync('workflow analysis records open the persisted canvas and reset viewport context', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function openWorkflowCanvasRun')
  const helperEnd = appSource.indexOf('function openWorkflowAnalysisRecord', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const openStart = appSource.indexOf('function openWorkflowAnalysisRecord')
  const openEnd = appSource.indexOf('function rollbackWorkflowAnalysisVersion', openStart)
  const openSource = appSource.slice(openStart, openEnd)
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.ok(helperStart > 0)
  assert.match(helperSource, /state\.activeWorkflowRun\s*=\s*run/)
  assert.match(helperSource, /workflowAnalysisResult\.value\s*=\s*run\.documentAnalysis/)
  assert.match(helperSource, /workflowCanvasLoading\.value\s*=\s*false/)
  assert.match(helperSource, /activeView\.value\s*=\s*'workflow'/)
  assert.match(helperSource, /workflowRoute\.value\s*=\s*'canvas'/)
  assert.match(helperSource, /window\.scrollTo\(\{\s*top:\s*0/)
  assert.match(openSource, /openWorkflowCanvasRun\(run\)/)
  assert.doesNotMatch(analyzeSource, /openWorkflowCanvasRun\(persistedRun\)/)
})

testAsync('workflow analysis record click loads backend detail when overview is compact', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)
  const openStart = appSource.indexOf('async function openWorkflowAnalysisRecord')
  const openEnd = appSource.indexOf('function adjustWorkflowCanvasZoom', openStart)
  const openSource = appSource.slice(openStart, openEnd)

  assert.match(entrySource, /<a[\s\S]*class="workflow-record-card"/)
  assert.match(entrySource, /:href="workflowAnalysisDeepLink\(record\.id\)"/)
  assert.ok(openStart > 0)
  assert.match(appSource, /function syncWorkflowAnalysisRoute\(runId,\s*mode = 'push'\)/)
  assert.match(openSource, /syncWorkflowAnalysisRoute\(runId\)/)
  assert.match(openSource, /run\?\.documentAnalysis\?\.canvas/)
  assert.match(openSource, /await loadWorkflowRunDetail\(runId,\s*\{\s*fallbackRun:\s*run\s*\}\)/)
  assert.match(openSource, /workflowCanvasLoading\.value\s*=\s*true/)
  assert.match(openSource, /setStatus\(skillWorkbenchStatus,\s*'failed'/)
})

testAsync('workflow document analysis failure stays on canvas with recovery state', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)
  const openStart = appSource.indexOf('function openWorkflowCanvasRun')
  const openEnd = appSource.indexOf('function openWorkflowAnalysisRecord', openStart)
  const openSource = appSource.slice(openStart, openEnd)

  assert.ok(analyzeStart > 0)
  assert.match(appSource, /function buildWorkflowAnalysisFailureResult/)
  assert.match(analyzeSource, /const failureAnalysis = buildWorkflowAnalysisFailureResult\(/)
  assert.match(analyzeSource, /result\.message\s*\|\|\s*result\.error/)
  assert.match(analyzeSource, /documentAnalysis:\s*failureAnalysis/)
  assert.doesNotMatch(openSource, /!run\.projectBlueprint\)\s*return/)
  assert.match(openSource, /run\.projectBlueprint\?\.demoScreens/)
  assert.doesNotMatch(analyzeSource, /workflowAnalysisResult\.value\s*=\s*failureAnalysis/)
  assert.doesNotMatch(analyzeSource, /workflowRoute\.value\s*=\s*'entry'/)
  assert.doesNotMatch(analyzeSource, /workflowRoute\.value\s*=\s*'canvas'/)
  assert.match(appSource, /重新分析文档/)
  assert.match(appSource, /返回分析页调整输入/)
})

testAsync('workflow analysis deep link polling fails visibly instead of spinning forever', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const pollingStart = appSource.indexOf('function startWorkflowAnalysisDeepLinkPolling')
  const pollingEnd = appSource.indexOf('function restoreWorkflowRouteFromUrl', pollingStart)
  const pollingSource = appSource.slice(pollingStart, pollingEnd)

  assert.ok(pollingStart > 0)
  assert.match(appSource, /const WORKFLOW_ANALYSIS_POLL_MAX_ATTEMPTS/)
  assert.match(appSource, /function failWorkflowAnalysisDeepLink\(/)
  assert.match(pollingSource, /failedLoads\s*\+=\s*1/)
  assert.match(pollingSource, /attempts\s*>=\s*WORKFLOW_ANALYSIS_POLL_MAX_ATTEMPTS/)
  assert.match(pollingSource, /failWorkflowAnalysisDeepLink\(runId,/)
  assert.match(appSource, /workflowCanvasLoading\.value\s*=\s*false/)
  assert.match(appSource, /后端分析超时|无法获取分析结果/)
})

testAsync('workflow analysis deep link polling loads detail when overview only exposes document analysis summary', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const pollingStart = appSource.indexOf('function startWorkflowAnalysisDeepLinkPolling')
  const pollingEnd = appSource.indexOf('function restoreWorkflowRouteFromUrl', pollingStart)
  const pollingSource = appSource.slice(pollingStart, pollingEnd)

  assert.ok(pollingStart > 0)
  assert.match(pollingSource, /run\.hasDocumentAnalysisDetail/)
  assert.match(pollingSource, /run\.documentAnalysisSummary\?\.hasCanvas/)
  assert.match(pollingSource, /run\.documentAnalysis\?\.canvas \|\| run\.hasDocumentAnalysisDetail \|\| run\.documentAnalysisSummary\?\.hasCanvas/)
  assert.match(pollingSource, /await loadWorkflowRunDetail\(runId,\s*\{\s*fallbackRun:\s*run\s*\}\)/)
})

testAsync('workflow analysis opens a runId deep link in a new tab before backend analysis completes', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.ok(analyzeStart > 0)
  assert.match(appSource, /function workflowAnalysisDeepLink\(runId/)
  assert.match(appSource, /function openWorkflowAnalysisTab\(runId/)
  assert.match(appSource, /function restoreWorkflowAnalysisFromUrl\(/)
  assert.match(appSource, /window\.location\.hash\.match\(/)
  assert.match(appSource, /projectScopedRoute\(`\/workflow\/analysis\/\$\{encodeURIComponent\(runId\)\}`/)
  assert.match(appSource, /projectRoute\.route\.match\(\/\^\\\/workflow\\\/analysis/)
  assert.match(analyzeSource, /const pendingRun =/)
  assert.match(analyzeSource, /status:\s*'analyzing'/)
  assert.match(analyzeSource, /documentAnalysis:\s*null/)
  assert.match(analyzeSource, /state\.workflowRuns\s*=\s*upsertWorkflowRunRecord\(state\.workflowRuns,\s*persistedPendingRun\)/)
  assert.match(analyzeSource, /openWorkflowAnalysisTab\(persistedPendingRun\.id\)/)
  assert.match(analyzeSource, /setStatus\(skillWorkbenchStatus,\s*'loading',\s*'已在新标签页打开分析画布/)
  assert.doesNotMatch(analyzeSource, /workflowCanvasLoading\.value = true/)
  assert.doesNotMatch(analyzeSource, /workflowAnalysisResult\.value = null/)
  assert.doesNotMatch(analyzeSource, /workflowRoute\.value = 'canvas'/)
  assert.match(analyzeSource, /const nextRun = \{\s*\.\.\.persistedPendingRun,/)
  assert.match(analyzeSource, /api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*nextRun\)/)
})

testAsync('workflow entry keeps analysis records unfiltered while backend project selection stays stable', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)
  const mergeStart = appSource.indexOf('function mergeWorkflowRunRecords')
  const mergeEnd = appSource.indexOf('function upsertWorkflowRunRecord', mergeStart)
  const mergeSource = appSource.slice(mergeStart, mergeEnd)
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)
  const recordsStart = appSource.indexOf('const workflowAnalysisRecords = computed')
  const recordsEnd = appSource.indexOf('const workflowLoadingTabs', recordsStart)
  const recordsSource = appSource.slice(recordsStart, recordsEnd)

  assert.ok(hydrateStart > 0)
  assert.match(hydrateSource, /const backendProjects = result\.data\.projects \|\| \[\]/)
  assert.match(hydrateSource, /currentProjectId:\s*result\.data\.currentProjectId \|\| state\.currentProjectId/)
  assert.match(hydrateSource, /reconcileProjectSelection\(/)
  assert.match(hydrateSource, /workflowRuns:\s*mergeWorkflowRunRecords\(state\.workflowRuns,\s*result\.data\.workflowRuns/)
  assert.ok(mergeStart > 0)
  assert.match(mergeSource, /documentAnalysis:\s*remote\.documentAnalysis \|\| local\.documentAnalysis/)
  assert.match(mergeSource, /projectBlueprint:\s*remote\.projectBlueprint \|\| local\.projectBlueprint/)
  assert.doesNotMatch(hydrateSource, /state\.currentProjectId = backendProjects\[0\]\?\.id \|\| next\.currentProjectId/)
  assert.ok(recordsStart > 0)
  assert.doesNotMatch(recordsSource, /workflowForm\.demandScope === 'non-project'/)
  assert.doesNotMatch(recordsSource, /workflowReferenceProjectId\.value/)
  assert.doesNotMatch(recordsSource, /run\.projectId === state\.currentProjectId/)
  assert.match(recordsSource, /run\.documentAnalysis\?\.canvas \|\| run\.hasDocumentAnalysisDetail/)
  assert.match(recordsSource, /run\.projectBlueprint \|\| run\.documentAnalysis \|\| run\.hasDocumentAnalysisDetail/)
  assert.match(appSource, /function workflowRecordSummary/)
  assert.match(entrySource, /workflowRecordSummary\(record\)\.parsed/)
  assert.match(entrySource, /workflowRecordSummary\(record\)\.nodeCount/)
  assert.match(entrySource, /workflowRecordSummary\(record\)\.qualityScore/)
})

testAsync('workspace hydration preserves local restored pages when backend returns an empty list', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)

  assert.ok(hydrateStart > 0)
  assert.match(hydrateSource, /const remoteRestoredPages = Array\.isArray\(result\.data\.restoredPages\) \? result\.data\.restoredPages : \[\]/)
  assert.match(hydrateSource, /restoredPages:\s*mergeById\(state\.restoredPages,\s*remoteRestoredPages\)/)
  assert.doesNotMatch(hydrateSource, /restoredPages:\s*result\.data\.restoredPages \|\| \[\]/)
})

testAsync('workflow analysis records show all scopes with project and non project tags', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)
  const recordsStart = appSource.indexOf('const workflowAnalysisRecords = computed')
  const recordsEnd = appSource.indexOf('const workflowLoadingTabs', recordsStart)
  const recordsSource = appSource.slice(recordsStart, recordsEnd)

  assert.ok(recordsStart > 0)
  assert.doesNotMatch(recordsSource, /workflowForm\.demandScope/)
  assert.doesNotMatch(recordsSource, /workflowReferenceProjectId/)
  assert.doesNotMatch(recordsSource, /run\.projectId === state\.currentProjectId/)
  assert.match(recordsSource, /run\.documentAnalysis\?\.canvas \|\| run\.hasDocumentAnalysisDetail/)
  assert.match(recordsSource, /run\.projectBlueprint \|\| run\.documentAnalysis \|\| run\.hasDocumentAnalysisDetail/)
  assert.match(entrySource, /workflow-record-scope-tag/)
  assert.match(entrySource, /record\.demandScope === 'non-project' \? '非项目需求' : '项目需求'/)
  assert.match(entrySource, /record\.demandScope === 'non-project' \? 'non-project' : 'project'/)
})

test('reconciles project selection without switching away from a valid local project', () => {
  const state = reconcileProjectSelection({
    currentProjectId: 'project-local',
    projects: [
      { id: 'project-local', name: '本地项目' },
      { id: 'project-backend', name: '后端项目' }
    ],
    assets: [
      { id: 'asset-local', projectId: 'project-local' },
      { id: 'asset-backend', projectId: 'project-backend' }
    ],
    restoredPages: [
      { id: 'page-local', projectId: 'project-local' },
      { id: 'page-backend', projectId: 'project-backend' }
    ],
    workflowRuns: [
      { id: 'run-backend', projectId: 'project-backend' },
      { id: 'run-local', projectId: 'project-local' }
    ],
    selectedAssetId: 'asset-backend',
    selectedRestoredPageId: 'page-backend',
    activeWorkflowRun: { id: 'run-backend', projectId: 'project-backend' }
  })

  assert.equal(state.currentProjectId, 'project-local')
  assert.equal(state.selectedAssetId, '')
  assert.equal(state.selectedRestoredPageId, '')
  assert.equal(state.activeWorkflowRun.id, 'run-local')
})

test('reconciles invalid project selection to a resource-backed project and clears cross-project records', () => {
  const state = reconcileProjectSelection({
    currentProjectId: 'missing-project',
    projects: [
      { id: 'project-a', name: '项目 A' },
      { id: 'project-b', name: '项目 B' }
    ],
    assets: [{ id: 'asset-b', projectId: 'project-b' }],
    restoredPages: [{ id: 'page-b', projectId: 'project-b' }],
    workflowRuns: [{ id: 'run-a', projectId: 'project-a' }],
    selectedAssetId: 'asset-b',
    selectedRestoredPageId: 'page-b',
    activeWorkflowRun: { id: 'run-b', projectId: 'project-b' }
  })

  assert.equal(state.currentProjectId, 'project-a')
  assert.equal(state.selectedAssetId, '')
  assert.equal(state.selectedRestoredPageId, '')
  assert.equal(state.activeWorkflowRun.id, 'run-a')
})

testAsync('workflow document analysis sends failed uploads as reasons instead of input body', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /\.filter\(\(doc\) => doc\.status === '已读取' && doc\.text\)/)
  assert.match(appSource, /content: doc\.status === '已读取' \? \(doc\.text \|\| ''\) : ''/)
  assert.match(appSource, /reason: doc\.status !== '已读取' \? \(doc\.text \|\| doc\.reason \|\| ''\) : ''/)
})

testAsync('workflow entry sends demand scope project binding and selected skill to backend analysis', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage')
  const entrySource = appSource.slice(entryStart, entryEnd)
  const analyzeSource = appSource.slice(
    appSource.indexOf('async function analyzeWorkflowDocuments'),
    appSource.indexOf('async function autoAnalyzeWorkflowInput')
  )

  assert.match(appSource, /selectedWorkflowId:\s*'auto'/)
  assert.match(appSource, /value="auto"/)
  assert.match(appSource, /智能推荐 Skill/)
  assert.match(appSource, /const workflowScopeTabs = \[/)
  assert.match(appSource, /key:\s*'project',\s*label:\s*'项目需求'/)
  assert.match(appSource, /key:\s*'non-project',\s*label:\s*'非项目需求'/)
  assert.match(appSource, /workflowReferenceProjectId/)
  assert.match(appSource, /不参考项目/)
  assert.match(appSource, /function selectNoReferenceProject/)
  assert.match(entrySource, /<TabBar v-model="workflowForm\.demandScope" :tabs="workflowScopeTabs" \/>/)
  assert.match(entrySource, /绑定项目|参考项目|保存到/)
  assert.doesNotMatch(entrySource, /workflow-scope-toggle/)
  assert.match(entrySource, /workflowForm\.selectedWorkflowId/)
  assert.match(analyzeSource, /demandScope:\s*workflowForm\.demandScope/)
  assert.match(analyzeSource, /skillSelectionMode:\s*workflowForm\.selectedWorkflowId === 'auto' \? 'auto' : 'manual'/)
  assert.match(analyzeSource, /skillId:\s*workflowForm\.selectedWorkflowId/)
  assert.match(analyzeSource, /result\.data\.routing\?\.displaySkillName \|\| result\.data\.displaySkillName/)
  assert.match(analyzeSource, /projectId:\s*workflowAnalysisProject\.value\?\.id \|\| ''/)
  assert.match(analyzeSource, /project:\s*workflowAnalysisProject\.value \|\| \{\}/)
})

test('backend keeps auto selection on smart recommendation skill while detecting auth modal intent', () => {
  const result = analyzeRequirementDocuments({
    demandScope: 'non-project',
    skillId: 'auto',
    skillSelectionMode: 'auto',
    input: '做一个登录注册弹窗',
    documents: []
  })

  assert.equal(result.requestedSkillId, 'auto')
  assert.equal(result.resolvedSkillId, 'smart-recommendation-skill')
  assert.equal(result.displaySkillName, '智能推荐 Skill')
  assert.equal(result.skillSelectionMode, 'auto')
  assert.equal(result.detectedIntent, 'auth-modal')
  assert.match(result.routingReason, /智能推荐 Skill/)
  assert.equal(result.blueprint.skillId, 'smart-recommendation-skill')
  assert.equal(result.blueprint.requestedSkillId, 'auto')
  assert.equal(result.blueprint.intent, 'auth-modal')
  assert.equal(result.generation.status, 'generated')
  assert.equal(result.generation.validation.ok, true)
  assert.equal(result.generation.output.intent, 'auth-modal')
  assert.ok(result.generation.output.apiContract.some((endpoint) => endpoint.path === '/api/auth/login'))
  assert.equal(result.canvas.nodes[0].id, 'analysis')
})

test('backend preserves manual skill selection when user switches skill', () => {
  const routing = orchestrateRequirementSkill({
    skillId: 'interaction-design-workflow',
    skillSelectionMode: 'manual',
    input: '做一个登录注册弹窗'
  })

  assert.equal(routing.requestedSkillId, 'interaction-design-workflow')
  assert.equal(routing.resolvedSkillId, 'interaction-design-workflow')
  assert.equal(routing.skillSelectionMode, 'manual')
  assert.equal(routing.displaySkillName, '交互方案生成')
  assert.equal(routing.detectedIntent, 'auth-modal')
})

test('backend preserves manual interaction review skill without falling back on auth requests', () => {
  const routing = orchestrateRequirementSkill({
    skillId: 'product-interaction-design-review-skill',
    skillSelectionMode: 'manual',
    input: '做一个登录注册功能'
  })
  const skill = getSkillDefinition(routing.resolvedSkillId)

  assert.equal(routing.requestedSkillId, 'product-interaction-design-review-skill')
  assert.equal(routing.resolvedSkillId, 'product-interaction-design-review-skill')
  assert.equal(routing.displaySkillName, '交互skill')
  assert.equal(routing.skillSelectionMode, 'manual')
  assert.equal(skill.id, 'product-interaction-design-review-skill')
  assert.equal(skill.name, '交互skill')
  assert.equal(skill.outputSchema, 'product-interaction-review')
})

test('backend defaults missing skill selection to smart recommendation skill', () => {
  const result = analyzeRequirementDocuments({
    input: '用户上传需求文档后，需要先看到初步架构和交互路径树。',
    documents: []
  })

  assert.equal(result.requestedSkillId, 'auto')
  assert.equal(result.resolvedSkillId, 'smart-recommendation-skill')
  assert.equal(result.displaySkillName, '智能推荐 Skill')
  assert.equal(result.skillSelectionMode, 'auto')
  assert.equal(result.detectedIntent, 'interaction-design')
  assert.match(result.routingReason, /智能推荐 Skill/)
  assert.equal(result.blueprint.skillId, 'smart-recommendation-skill')
})

test('backend skill registry exposes smart recommendation and auth generation contracts', () => {
  const smartSkill = getSkillDefinition('smart-recommendation-skill')
  const authSkill = getSkillDefinition('auth-page-generation')
  const allSkills = listSkillDefinitions()

  assert.equal(smartSkill.id, 'smart-recommendation-skill')
  assert.equal(smartSkill.name, '智能推荐 Skill')
  assert.equal(smartSkill.outputSchema, 'smart-canvas')
  assert.ok(smartSkill.intentTypes.includes('auth-modal'))
  assert.match(smartSkill.promptTemplate, /UX|画布|弹窗/)
  assert.equal(authSkill.id, 'auth-page-generation')
  assert.equal(authSkill.outputSchema, 'auth-page')
  assert.ok(authSkill.intentTypes.includes('auth-page'))
  assert.ok(authSkill.inputRequirements.includes('input'))
  assert.match(authSkill.promptTemplate, /登录注册|接口契约|前后端/)
  assert.ok(authSkill.qualityChecks.includes('frontend-backend-handoff'))
  assert.ok(allSkills.some((skill) => skill.id === 'smart-recommendation-skill'))
  assert.ok(allSkills.some((skill) => skill.id === 'auth-page-generation'))
})

test('backend smart recommendation prompt exposes design scheme ux rules', () => {
  const smartSkill = getSkillDefinition('smart-recommendation-skill')
  const prompt = buildSkillPrompt({
    skill: smartSkill,
    input: '帮我设计一个需求分析后的画布体验，包含弹窗、二级页面、返回状态和错误提示。',
    project: { name: '流程通', domain: 'AI 产品设计' },
    documents: [],
    routing: { detectedIntent: 'interaction-design', resolvedSkillId: 'smart-recommendation-skill' }
  })

  assert.match(smartSkill.promptTemplate, /design-scheme-ux|UX 决策链路/)
  assert.match(prompt.systemPrompt, /用户行为/)
  assert.match(prompt.systemPrompt, /功能层级/)
  assert.match(prompt.systemPrompt, /页面形态/)
  assert.match(prompt.systemPrompt, /弹窗与提示生命周期/)
  assert.match(prompt.systemPrompt, /返回状态/)
  assert.equal(prompt.responseSchema, 'smart-canvas')
})

testAsync('skill documentation package includes feature and usage docs for related skills', async () => {
  const packageDir = new URL('../docs/skills/smart-recommendation-skill-pack/', import.meta.url)
  const packageReadme = await readFile(new URL('README.md', packageDir), 'utf8')
  const entries = await readdir(packageDir)
  const zipBuffer = await readFile(new URL('../docs/skills/smart-recommendation-skill-pack.zip', import.meta.url))
  const zip = await JSZip.loadAsync(zipBuffer)
  const requiredSkillDirs = [
    'smart-recommendation-skill',
    'default-general-design-skill',
    'interaction-design-workflow',
    'system-prd-interaction-plan',
    'opportunity-validation',
    'podcastor-product-flow'
  ]

  assert.match(packageReadme, /智能推荐 Skill/)
  assert.match(packageReadme, /design-scheme-ux/)
  for (const skillId of requiredSkillDirs) {
    assert.ok(entries.includes(skillId))
    const intro = await readFile(new URL(`${skillId}/FUNCTION.md`, packageDir), 'utf8')
    const usage = await readFile(new URL(`${skillId}/USAGE.md`, packageDir), 'utf8')
    assert.match(intro, /功能说明/)
    assert.match(usage, /使用说明/)
    assert.ok(zip.file(`smart-recommendation-skill-pack/${skillId}/FUNCTION.md`))
    assert.ok(zip.file(`smart-recommendation-skill-pack/${skillId}/USAGE.md`))
  }
})

test('backend prompt builder creates strict json prompts for auth page skill', () => {
  const prompt = buildSkillPrompt({
    skill: getSkillDefinition('auth-page-generation'),
    input: '做一个登录注册页面',
    project: { name: '流程通' },
    documents: [{ name: '需求.md', text: '需要前后端分工' }],
    routing: { detectedIntent: 'auth-page', resolvedSkillId: 'auth-page-generation' }
  })

  assert.match(prompt.systemPrompt, /只输出 JSON/)
  assert.match(prompt.systemPrompt, /apiContract/)
  assert.match(prompt.systemPrompt, /frontendHandoff/)
  assert.match(prompt.systemPrompt, /backendHandoff/)
  assert.match(prompt.userPrompt, /做一个登录注册页面/)
  assert.match(prompt.userPrompt, /流程通/)
  assert.match(prompt.userPrompt, /需求\.md/)
  assert.equal(prompt.responseSchema, 'auth-page')
})

test('backend prompt builder separates project and non-project delivery instructions', () => {
  const projectPrompt = buildSkillPrompt({
    demandScope: 'project',
    skill: getSkillDefinition('interaction-design-workflow'),
    input: '优化审批流程',
    project: { name: '审批系统' },
    documents: [],
    routing: { detectedIntent: 'interaction-design', resolvedSkillId: 'interaction-design-workflow' }
  })
  const nonProjectPrompt = buildSkillPrompt({
    demandScope: 'non-project',
    skill: getSkillDefinition('demand-four-step'),
    input: '总结调研材料，判断是否值得立项',
    project: {},
    documents: [],
    routing: { detectedIntent: 'requirement-analysis', resolvedSkillId: 'demand-four-step' }
  })

  assert.match(projectPrompt.systemPrompt, /项目需求/)
  assert.match(projectPrompt.systemPrompt, /前端接管/)
  assert.match(projectPrompt.systemPrompt, /后端接管/)
  assert.match(projectPrompt.systemPrompt, /接口契约/)
  assert.match(projectPrompt.systemPrompt, /验收标准/)
  assert.match(nonProjectPrompt.systemPrompt, /非项目需求/)
  assert.match(nonProjectPrompt.systemPrompt, /调研总结/)
  assert.match(nonProjectPrompt.systemPrompt, /是否立项/)
  assert.match(nonProjectPrompt.systemPrompt, /转项目建议/)
  assert.doesNotMatch(nonProjectPrompt.systemPrompt, /前端接管/)
})

test('backend model json parser extracts json from markdown code fences', () => {
  const parsed = safeParseModelJson('```json\n{"intent":"auth-page","sections":[{"title":"功能说明","items":["登录"]}]}\n```')

  assert.equal(parsed.ok, true)
  assert.equal(parsed.value.intent, 'auth-page')
  assert.equal(parsed.value.sections[0].title, '功能说明')
})

test('backend validates auth page structured output for frontend handoff', () => {
  const valid = validateSkillOutput('auth-page', {
    intent: 'auth-page',
    sections: [{ title: '功能说明', items: ['登录', '注册'] }],
    frontendHandoff: ['前端负责表单和错误展示'],
    backendHandoff: ['后端负责认证接口'],
    apiContract: [{ method: 'POST', path: '/api/auth/login', requestFields: ['account'], responseFields: ['token'] }],
    html: '<!doctype html><html><body><form>登录</form></body></html>',
    preview: { mode: 'html' },
    qualityReport: { passed: true, checks: [] }
  })
  const invalid = validateSkillOutput('auth-page', {
    intent: 'auth-page',
    sections: []
  })

  assert.equal(valid.ok, true)
  assert.deepEqual(valid.missing, [])
  assert.equal(invalid.ok, false)
  assert.ok(invalid.missing.includes('apiContract'))
  assert.ok(invalid.missing.includes('frontendHandoff'))
  assert.ok(invalid.missing.includes('backendHandoff'))
})

testAsync('backend generation runner returns validated auth page payload with deterministic fallback', async () => {
  const result = await runSkillGeneration({
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面',
    project: {},
    documents: [],
    routing: {
      requestedSkillId: 'auto',
      resolvedSkillId: 'auth-page-generation',
      detectedIntent: 'auth-page'
    }
  })

  assert.equal(result.status, 'generated')
  assert.equal(result.provider, 'deterministic')
  assert.equal(result.skill.id, 'auth-page-generation')
  assert.equal(result.validation.ok, true)
  assert.equal(result.output.intent, 'auth-page')
  assert.ok(result.output.apiContract.some((endpoint) => endpoint.path === '/api/auth/login'))
  assert.match(result.output.html, /登录|注册/)
  assert.ok(result.output.frontendHandoff.length)
  assert.ok(result.output.backendHandoff.length)
})

testAsync('backend generation runner uses model output when json validates', async () => {
  const modelOutput = {
    intent: 'auth-page',
    sections: [{ title: '模型功能说明', items: ['邮箱登录'] }],
    frontendHandoff: ['前端负责输入校验'],
    backendHandoff: ['后端负责 token 签发'],
    apiContract: [{ method: 'POST', path: '/api/auth/login', requestFields: ['account'], responseFields: ['token'] }],
    html: '<!doctype html><html><body>模型登录</body></html>',
    preview: { mode: 'html' },
    qualityReport: { passed: true, checks: [] }
  }
  const provider = {
    name: 'fake-openai',
    async generate() {
      return {
        content: `\`\`\`json\n${JSON.stringify(modelOutput)}\n\`\`\``,
        provider: 'openai-compatible',
        model: 'gpt-test',
        usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 }
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面',
    agentProvider: provider
  })

  assert.equal(result.status, 'generated')
  assert.equal(result.provider, 'openai-compatible')
  assert.equal(result.model, 'gpt-test')
  assert.equal(result.fallbackUsed, false)
  assert.equal(result.output.sections[0].title, '模型功能说明')
  assert.equal(result.usage.totalTokens, 46)
})

testAsync('backend upload analysis route injects model provider into auth page generation', async () => {
  const modelOutput = {
    intent: 'auth-page',
    sections: [{ title: '企业模型登录注册方案', items: ['账号密码登录', '短信验证码注册'] }],
    frontendHandoff: ['前端负责表单输入、tab 切换、字段校验和错误提示'],
    backendHandoff: ['后端负责认证接口、验证码校验、token 签发和审计'],
    apiContract: [{ method: 'POST', path: '/api/auth/login', requestFields: ['account', 'password'], responseFields: ['token', 'user'] }],
    html: '<!doctype html><html><body>企业模型登录注册</body></html>',
    preview: { mode: 'html' },
    qualityReport: { passed: true, checks: [] }
  }
  let receivedContext = null
  const provider = {
    name: 'enterprise-model',
    async generate(context) {
      receivedContext = context
      return {
        content: JSON.stringify(modelOutput),
        provider: 'enterprise-model',
        model: 'enterprise-auth-v1',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 }
      }
    }
  }
  const backendRoutes = uploadRoutes({ agentProvider: provider })

  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面，需要前后端接口契约和可预览页面。',
    documents: []
  })

  assert.equal(receivedContext.responseSchema, 'auth-page')
  assert.equal(result.generation.provider, 'enterprise-model')
  assert.equal(result.generation.model, 'enterprise-auth-v1')
  assert.equal(result.generation.fallbackUsed, false)
  assert.equal(result.generation.validation.ok, true)
  assert.equal(result.generation.usage.totalTokens, 300)
  assert.equal(result.generation.output.sections[0].title, '企业模型登录注册方案')
})

testAsync('backend model settings save key server side and return masked config', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)

  const saved = await backendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-live-secret',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-enterprise',
    apiSurface: 'responses',
    timeoutMs: 25000,
    fallback: 'deterministic',
    enabled: true
  })
  const loaded = await backendRoutes['GET /api/workspace/model-settings']()

  assert.equal(saved.modelSettings.provider, 'openai-compatible')
  assert.equal(saved.modelSettings.hasApiKey, true)
  assert.equal(saved.modelSettings.apiKeyMasked, 'sk-l***cret')
  assert.equal(saved.modelSettings.apiKey, undefined)
  assert.equal(loaded.modelSettings.defaultModel, 'gpt-enterprise')
  assert.equal(loaded.modelSettings.apiKey, undefined)
  assert.equal(store.settings.find((item) => item.key === 'workflowModelProvider').value.apiKey, 'sk-live-secret')
})

testAsync('backend model settings auto enables openai compatible provider when key exists', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)

  const saved = await backendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-live-secret',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-5.5',
    apiSurface: 'responses',
    timeoutMs: 25000,
    fallback: 'deterministic'
  })

  assert.equal(saved.modelSettings.enabled, true)
  assert.equal(saved.modelSettings.hasApiKey, true)
  assert.equal(store.settings.find((item) => item.key === 'workflowModelProvider').value.enabled, true)
})

testAsync('backend model settings test route verifies provider and records call log', async () => {
  const store = createWorkspaceStore()
  const workspaceBackendRoutes = workspaceRoutes(store)
  await workspaceBackendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-test-secret',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-test-connect',
    apiSurface: 'responses',
    enabled: true
  })

  const backendRoutes = workspaceRoutes(store, {
    fetchImpl: async (url, options = {}) => {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        async json() {
          return {
            output_text: JSON.stringify({ ok: true, message: 'pong', capability: 'workflow-analysis' }),
            usage: { input_tokens: 7, output_tokens: 9, total_tokens: 16 },
            request_url: url,
            request_body: JSON.parse(options.body)
          }
        }
      }
    }
  })

  const result = await backendRoutes['POST /api/workspace/model-settings/test']({
    input: 'ping'
  })
  const listed = await backendRoutes['GET /api/workspace/model-call-logs']({
    skillId: 'model-settings-test'
  })

  assert.equal(result.status, 'success')
  assert.equal(result.provider, 'openai-compatible')
  assert.equal(result.model, 'gpt-test-connect')
  assert.equal(result.validation.ok, true)
  assert.equal(result.usage.totalTokens, 16)
  assert.equal(listed.logs.length, 1)
  assert.equal(listed.logs[0].skillId, 'model-settings-test')
  assert.equal(listed.logs[0].status, 'success')
})

testAsync('backend model settings sample route runs auth modal analysis through smart skill', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)

  const result = await backendRoutes['POST /api/workspace/model-settings/sample-analysis']({
    input: '做一个登录注册弹窗'
  })

  assert.equal(result.analysis.requestedSkillId, 'auto')
  assert.equal(result.analysis.resolvedSkillId, 'smart-recommendation-skill')
  assert.equal(result.analysis.displaySkillName, '智能推荐 Skill')
  assert.equal(result.analysis.detectedIntent, 'auth-modal')
  assert.equal(result.analysis.blueprint.intent, 'auth-modal')
  assert.equal(result.analysis.generation.output.intent, 'auth-modal')
  assert.ok(result.analysis.canvas.nodes.some((node) => /弹窗/.test(`${node.title}${node.summary}${(node.content || []).join('')}`)))
})

testAsync('backend upload analysis can use model provider from persisted model settings', async () => {
  const modelOutput = {
    intent: 'auth-page',
    sections: [{ title: '配置模型登录注册方案', items: ['登录注册'] }],
    frontendHandoff: ['前端负责交互状态'],
    backendHandoff: ['后端负责认证接口'],
    apiContract: [{ method: 'POST', path: '/api/auth/login', requestFields: ['account'], responseFields: ['token'] }],
    html: '<!doctype html><html><body>配置模型</body></html>',
    preview: { mode: 'html' },
    qualityReport: { passed: true, checks: [] }
  }
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      async json() {
        return {
          output_text: JSON.stringify(modelOutput),
          usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 }
        }
      }
    }
  }
  const store = createWorkspaceStore()
  const workspaceBackendRoutes = workspaceRoutes(store)
  await workspaceBackendRoutes['PUT /api/workspace/model-settings']({
    provider: 'openai-compatible',
    apiKey: 'sk-persisted-secret',
    baseUrl: 'https://llm.example.com/v1',
    defaultModel: 'gpt-persisted',
    apiSurface: 'responses',
    enabled: true
  })
  const backendRoutes = uploadRoutes({ store, fetchImpl })

  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面',
    documents: []
  })

  assert.equal(result.generation.provider, 'openai-compatible')
  assert.equal(result.generation.model, 'gpt-persisted')
  assert.equal(result.generation.usage.totalTokens, 33)
  assert.equal(result.generation.output.sections[0].title, '配置模型登录注册方案')
  assert.equal(calls[0].url, 'https://llm.example.com/v1/responses')
  assert.equal(calls[0].body.model, 'gpt-persisted')
})

testAsync('backend skill orchestration settings persist and override runtime skill contracts', async () => {
  const store = createWorkspaceStore()
  const workspaceBackendRoutes = workspaceRoutes(store)

  const saved = await workspaceBackendRoutes['PUT /api/workspace/skill-orchestration-settings']({
    enabled: true,
    skillOverrides: {
      'auth-page-generation': {
        promptTemplate: '企业级登录注册策略：必须先区分前端接管、后端接管和接口契约。',
        outputSchema: 'auth-page',
        qualityChecks: ['enterprise-auth-review', 'api-contract'],
        fallbackSkillId: 'demand-four-step'
      }
    }
  })
  const loaded = await workspaceBackendRoutes['GET /api/workspace/skill-orchestration-settings']()

  assert.equal(saved.skillOrchestrationSettings.enabled, true)
  assert.equal(loaded.skillOrchestrationSettings.skillOverrides['auth-page-generation'].fallbackSkillId, 'demand-four-step')
  assert.ok(loaded.skillOrchestrationSettings.skillOverrides['auth-page-generation'].qualityChecks.includes('enterprise-auth-review'))

  let receivedContext = null
  const provider = {
    name: 'enterprise-model',
    async generate(context) {
      receivedContext = context
      return {
        content: JSON.stringify({
          intent: 'auth-page',
          sections: [{ title: '编排策略登录注册', items: ['登录', '注册'] }],
          frontendHandoff: ['前端接管表单、状态和错误提示'],
          backendHandoff: ['后端接管认证、验证码和 token'],
          apiContract: [{ method: 'POST', path: '/api/auth/login', requestFields: ['account'], responseFields: ['token'] }],
          html: '<!doctype html><html><body>编排策略</body></html>',
          preview: { mode: 'html' },
          qualityReport: { passed: true, checks: [] }
        }),
        provider: 'enterprise-model',
        model: 'enterprise-auth',
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
      }
    }
  }
  const backendRoutes = uploadRoutes({ store, agentProvider: provider })
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    demandScope: 'project',
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面',
    documents: []
  })

  assert.match(receivedContext.systemPrompt, /企业级登录注册策略/)
  assert.match(receivedContext.systemPrompt, /enterprise-auth-review/)
  assert.equal(result.generation.skill.fallbackSkillId, 'demand-four-step')
  assert.ok(result.generation.skill.qualityChecks.includes('enterprise-auth-review'))
  assert.equal(result.generation.output.sections[0].title, '编排策略登录注册')
})

testAsync('backend analysis attaches version snapshot and structured quality gate', async () => {
  const backendRoutes = uploadRoutes()
  const result = await backendRoutes['POST /api/uploads/documents/analyze']({
    demandScope: 'project',
    skillId: 'interaction-design-workflow',
    projectId: 'project-quality',
    project: { id: 'project-quality', name: '质量项目' },
    input: '做一个登录注册页面，需要清楚前后端分工和接口契约。',
    documents: []
  })

  assert.ok(Array.isArray(result.versions))
  assert.equal(result.versions.length, 1)
  assert.match(result.versions[0].id, /^analysis-v/)
  assert.equal(result.versions[0].source, 'backend-analysis')
  assert.equal(result.versions[0].demandScope, 'project')
  assert.equal(result.versions[0].resolvedSkillId, result.resolvedSkillId)
  assert.ok(result.versions[0].snapshot?.blueprint)
  assert.ok(result.qualityGate)
  assert.equal(typeof result.qualityGate.score, 'number')
  assert.ok(result.qualityGate.checks.some((check) => check.id === 'schema-validation'))
  assert.ok(result.qualityGate.checks.some((check) => check.id === 'frontend-backend-boundary'))
  assert.ok(result.qualityGate.checks.some((check) => check.id === 'version-snapshot'))
  assert.equal(result.blueprint.qualityGate.score, result.qualityGate.score)
})

testAsync('workflow canvas frontend displays analysis version and quality gate metadata', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const topbarSource = componentSource.slice(
    componentSource.indexOf('<header class="workflow-canvas-topbar">'),
    componentSource.indexOf('<main class="workflow-canvas-shell">')
  )

  assert.match(componentSource, /versionMeta/)
  assert.match(componentSource, /qualityGate/)
  assert.doesNotMatch(topbarSource, /版本：/)
  assert.doesNotMatch(topbarSource, /质量分/)
  assert.match(componentSource, /版本历史/)
  assert.match(componentSource, /质量检查/)
  assert.match(componentSource, /analysisVersionMeta/)
  assert.match(componentSource, /analysisQualityGate/)
  assert.match(appSource, /const workflowAnalysisVersionMeta = computed/)
  assert.match(appSource, /const workflowAnalysisQualityGate = computed/)
  assert.match(appSource, /:version-meta="workflowAnalysisVersionMeta"/)
  assert.match(appSource, /:quality-gate="workflowAnalysisQualityGate"/)
})

testAsync('workflow canvas can persist analysis blueprint into knowledge base', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /沉淀知识库/)
  assert.match(componentSource, /persist-knowledge/)
  assert.match(componentSource, /defineEmits\(\[[^\]]*'persist-knowledge'/)
  assert.match(componentSource, /knowledgeStatus/)
  assert.match(componentSource, /workflow-knowledge-status/)
  assert.match(componentSource, /查看知识库/)
  assert.match(componentSource, /open-knowledge/)
  assert.match(appSource, /@persist-knowledge="importWorkflowAnalysisToKnowledge"/)
  assert.match(appSource, /@open-knowledge="openWorkflowKnowledgeBase"/)
  assert.match(appSource, /const workflowKnowledgeStatus = reactive/)
  assert.match(appSource, /function importWorkflowAnalysisToKnowledge/)
  assert.match(appSource, /importBlueprintToKnowledge\(blueprint,\s*sourceAssetId(?:,\s*\{ openKnowledge: false \})?\)/)
  assert.match(appSource, /function openWorkflowKnowledgeBase/)
})

testAsync('workflow canvas converts blueprint into selected requirements tab', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /转需求文档/)
  assert.match(componentSource, /convert-requirement/)
  assert.match(componentSource, /defineEmits\(\[[^\]]*'convert-requirement'/)
  assert.doesNotMatch(componentSource, /保存蓝图/)
  assert.match(appSource, /@convert-requirement="openWorkflowRequirementConvertModal"/)
  assert.match(appSource, /showRequirementConvertModal/)
  assert.match(appSource, /requirementConvertForm/)
  assert.match(appSource, /产品需求/)
  assert.match(appSource, /模糊需求/)
  assert.match(appSource, /设计需求/)
  assert.match(appSource, /function submitWorkflowRequirementConvert/)
  assert.match(appSource, /requirementSource:\s*requirementConvertForm\.source/)
  assert.match(appSource, /materialsTab\.value = 'requirements'/)
  assert.match(appSource, /requirementSourceTab\.value = requirementConvertForm\.source/)
})

testAsync('workflow canvas frontend displays version history and quality check details', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /versionHistory/)
  assert.match(componentSource, /版本历史/)
  assert.match(componentSource, /qualityGate\.checks/)
  assert.match(componentSource, /质量检查/)
  assert.match(componentSource, /check\.passed/)
  assert.match(componentSource, /check\.severity/)
  assert.match(appSource, /const workflowAnalysisVersionHistory = computed/)
  assert.match(appSource, /:version-history="workflowAnalysisVersionHistory"/)
})

testAsync('backend analysis quality service compares analysis version snapshots', async () => {
  const { buildAnalysisVersionDiff } = await import('../后端/services/analysis-quality.js')
  const diff = buildAnalysisVersionDiff(
    {
      qualityScore: 70,
      snapshot: {
        blueprint: { title: '登录注册', profile: { productName: '旧版' } },
        canvas: { nodes: [{ id: 'analysis' }], edges: [] },
        generation: { model: 'deterministic' }
      }
    },
    {
      qualityScore: 90,
      snapshot: {
        blueprint: { title: '登录注册', profile: { productName: '新版' }, apiContract: [{ path: '/api/auth/login' }] },
        canvas: { nodes: [{ id: 'analysis' }, { id: 'api-contract' }], edges: [{ id: 'a-b' }] },
        generation: { model: 'enterprise-auth' }
      }
    }
  )

  assert.equal(diff.nodeDelta, 1)
  assert.equal(diff.edgeDelta, 1)
  assert.equal(diff.qualityDelta, 20)
  assert.ok(diff.changedBlueprintFields.includes('profile'))
  assert.ok(diff.changedBlueprintFields.includes('apiContract'))
  assert.equal(diff.generationChanged, true)
})

testAsync('workflow canvas frontend exposes version compare and rollback controls', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /版本对比/)
  assert.match(componentSource, /回滚到此版本/)
  assert.match(componentSource, /rollback-version/)
  assert.match(componentSource, /version\.diff/)
  assert.match(appSource, /@rollback-version="rollbackWorkflowAnalysisVersion"/)
  assert.match(appSource, /function rollbackWorkflowAnalysisVersion/)
})

testAsync('workflow canvas version history displays applied node diff summaries', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const stylesSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(componentSource, /version\.appliedPatch\?\.nodeDiffs/)
  assert.match(componentSource, /节点改动/)
  assert.match(componentSource, /更新前/)
  assert.match(componentSource, /更新后/)
  assert.match(componentSource, /contentCountDelta/)
  assert.match(stylesSource, /\.workflow-version-node-diffs/)
})

testAsync('workflow canvas rollback requires preview confirmation', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const stylesSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  assert.match(componentSource, /rollbackPreviewVersionId/)
  assert.match(componentSource, /预览回滚影响/)
  assert.match(componentSource, /确认回滚/)
  assert.match(componentSource, /取消/)
  assert.match(componentSource, /openRollbackPreview/)
  assert.match(componentSource, /confirmRollbackVersion/)
  assert.match(componentSource, /emit\('rollback-version', version/)
  assert.match(stylesSource, /\.workflow-version-rollback-preview/)
})

testAsync('workflow rollback syncs active run and analysis record list', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const rollbackStart = appSource.indexOf('function rollbackWorkflowAnalysisVersion')
  const rollbackEnd = appSource.indexOf('function openWorkflowAgentForNode', rollbackStart)
  const rollbackSource = appSource.slice(rollbackStart, rollbackEnd)

  assert.match(rollbackSource, /state\.activeWorkflowRun/)
  assert.match(rollbackSource, /documentAnalysis:\s*nextAnalysis/)
  assert.match(rollbackSource, /projectBlueprint:\s*nextAnalysis\.blueprint/)
  assert.match(rollbackSource, /upsertWorkflowRunRecord\(state\.workflowRuns/)
})

testAsync('backend quality gate provides repair suggestions for failed checks', async () => {
  const { buildAnalysisQualityGate } = await import('../后端/services/analysis-quality.js')
  const qualityGate = buildAnalysisQualityGate({
    demandScope: 'project',
    canvas: { nodes: [] }
  })
  const failedChecks = qualityGate.checks.filter((check) => !check.passed)

  assert.ok(failedChecks.length > 0)
  assert.ok(failedChecks.every((check) => check.repairSuggestion))
  assert.ok(Array.isArray(qualityGate.repairActions))
  assert.ok(qualityGate.repairActions.length >= failedChecks.length)
})

testAsync('backend analysis repair route returns repaired analysis version and quality gate', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const brokenAnalysis = {
    status: 'analyzed',
    demandScope: 'project',
    input: '做一个登录注册页面',
    projectId: 'project-repair',
    requestedSkillId: 'interaction-design-workflow',
    resolvedSkillId: 'auth-page-generation',
    routing: { resolvedSkillId: 'auth-page-generation', detectedIntent: 'auth-page' },
    documents: [],
    blueprint: { title: '登录注册页面' },
    canvas: { nodes: [], edges: [], orderedTabs: [] },
    generation: { provider: 'deterministic', model: 'deterministic-v1' },
    qualityGate: {
      status: 'needs-review',
      score: 60,
      checks: [{ id: 'frontend-backend-boundary', passed: false }]
    },
    versions: [{
      id: 'analysis-v-old',
      label: '旧版本',
      qualityScore: 60,
      snapshot: {
        blueprint: { title: '登录注册页面' },
        canvas: { nodes: [], edges: [], orderedTabs: [] },
        routing: { resolvedSkillId: 'auth-page-generation' },
        generation: { provider: 'deterministic' }
      }
    }]
  }

  const result = await backendRoutes['POST /api/workspace/analysis/repair']({
    checkId: 'frontend-backend-boundary',
    action: '补齐前后端分工和接口契约',
    analysis: brokenAnalysis
  })

  assert.equal(result.repair.checkId, 'frontend-backend-boundary')
  assert.equal(result.analysis.status, 'repaired')
  assert.ok(result.analysis.canvas.nodes.length > 0)
  assert.ok(result.analysis.qualityGate.checks.find((check) => check.id === 'frontend-backend-boundary').passed)
  assert.ok(result.analysis.versions.length >= 2)
  assert.equal(result.analysis.versions[0].source, 'backend-repair')
  assert.ok(result.analysis.versions[0].diff)
})

testAsync('workflow canvas frontend displays quality repair suggestions', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /修复建议/)
  assert.match(componentSource, /repairSuggestion/)
  assert.match(componentSource, /qualityGate\.repairActions/)
})

testAsync('workflow canvas repair suggestions can hand off context to agent', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /交给 Agent/)
  assert.match(componentSource, /repair-action/)
  assert.match(componentSource, /checkId:\s*action\.checkId/)
  assert.match(componentSource, /\$emit\('quick-action'/)
})

testAsync('backend agent context includes full canvas, node order and existing proposals', async () => {
  const run = {
    id: 'run-proposal-context',
    input: '做一个登录注册弹窗',
    workflowName: '认证弹窗设计',
    documentAnalysis: {
      canvas: {
        nodes: [
          { id: 'requirement', title: '需求结论', summary: '登录注册弹窗', content: ['需要登录、注册、忘记密码'] },
          { id: 'page-structure', title: '页面结构树', summary: '弹窗结构', content: ['登录表单', '注册表单'] },
          { id: 'form-validation', title: '表单校验', summary: '字段与错误态', content: ['手机号格式校验'] }
        ],
        edges: [{ id: 'requirement-page', source: 'requirement', target: 'page-structure' }]
      }
    },
    agentSessions: {
      'page-structure': [{ role: 'assistant', content: '上一轮建议保留验证码。' }]
    },
    agentProposals: {
      'page-structure': [
        {
          id: 'proposal-old',
          nodeId: 'page-structure',
          status: 'pending',
          summary: '补充弹窗结构'
        }
      ]
    }
  }

  const context = buildAgentContext({
    run,
    step: { id: 'page-structure', title: '页面结构树' },
    scopeId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构' },
    context: {
      activeNode: run.documentAnalysis.canvas.nodes[1]
    }
  })

  assert.equal(context.currentNode.id, 'page-structure')
  assert.deepEqual(context.upstreamNodes.map((node) => node.id), ['requirement'])
  assert.deepEqual(context.downstreamNodes.map((node) => node.id), ['form-validation'])
  assert.equal(context.fullCanvas.nodes.length, 3)
  assert.equal(context.pendingProposals.length, 1)
  assert.match(context.userPrompt, /完整画布/)
  assert.match(context.userPrompt, /上游节点/)
  assert.match(context.userPrompt, /下游节点/)
  assert.match(context.userPrompt, /已有提案/)
  assert.match(context.userPrompt, /知识库为空时/)
})

testAsync('backend agent context requires json content and proposal output contract', async () => {
  const context = buildAgentContext({
    run: {
      input: '做一个登录注册弹窗',
      documentAnalysis: {
        canvas: {
          nodes: [
            { id: 'page-structure', title: '页面结构树', summary: '弹窗结构', content: ['登录', '注册'] },
            { id: 'form-validation', title: '表单校验', summary: '校验规则', content: ['手机号'] }
          ]
        }
      }
    },
    step: { id: 'page-structure', title: '页面结构树' },
    scopeId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充结构建议' },
    context: {
      activeNode: { id: 'page-structure', title: '页面结构树', summary: '弹窗结构', content: ['登录', '注册'] }
    }
  })

  assert.match(context.systemPrompt, /只输出 JSON/)
  assert.match(context.systemPrompt, /proposal/)
  assert.match(context.systemPrompt, /writeableContent/)
  assert.match(context.systemPrompt, /downstreamImpact/)
  assert.match(context.systemPrompt, /rationale/)
  assert.match(context.systemPrompt, /contextSources/)
  assert.match(context.systemPrompt, /来源标题/)
  assert.match(context.systemPrompt, /命中原因/)
})

testAsync('backend workflow agent message returns and persists writeable proposal', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-message',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '登录注册弹窗结构', content: ['登录表单', '注册表单'] },
          { id: 'form-validation', title: '表单校验', summary: '字段校验', content: ['手机号格式校验'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })

  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充资料：请给登录注册弹窗更详细的结构建议' },
    context: {
      activeNode: created.run.documentAnalysis.canvas.nodes[0]
    }
  })

  assert.ok(updated.proposal?.id)
  assert.equal(updated.proposal.nodeId, 'page-structure')
  assert.equal(updated.proposal.status, 'pending')
  assert.ok(updated.proposal.writeableContent.summary)
  assert.ok(updated.proposal.writeableContent.items.length > 0)
  assert.equal(updated.assistantMessage.meta.proposalId, updated.proposal.id)
  assert.deepEqual(updated.assistantMessage.meta.proposalSummary.writeableContent, updated.proposal.writeableContent)
  assert.deepEqual(updated.assistantMessage.meta.proposalSummary.downstreamImpact, updated.proposal.downstreamImpact)
  assert.equal(updated.run.agentProposals['page-structure'][0].id, updated.proposal.id)
})

testAsync('backend workflow agent supersedes older pending proposals on follow-up refinement', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-follow-up',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '登录注册弹窗结构', content: ['登录表单', '注册表单'] },
          { id: 'form-validation', title: '表单校验', summary: '字段校验', content: ['手机号格式校验'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const first = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })
  const second = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '继续细化，把找回密码和第三方登录也放进去' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })

  const proposals = second.run.agentProposals['page-structure']
  assert.equal(proposals.length, 2)
  assert.equal(proposals[0].id, first.proposal.id)
  assert.equal(proposals[0].status, 'superseded')
  assert.equal(proposals[0].supersededByProposalId, second.proposal.id)
  assert.equal(proposals[1].id, second.proposal.id)
  assert.equal(proposals[1].status, 'pending')
})

testAsync('backend workflow agent marks older proposal messages as superseded for frontend confirmation safety', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-message-supersede',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '登录注册弹窗结构', content: ['登录表单'] },
          { id: 'form-validation', title: '表单校验', summary: '字段校验', content: ['手机号格式校验'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const first = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '先补登录注册弹窗结构' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })
  const second = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '继续补找回密码和第三方登录' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })
  const oldAssistantMessage = second.run.agentSessions['page-structure'].find((message) => message?.meta?.proposalId === first.proposal.id)

  assert.equal(oldAssistantMessage.meta.proposalStatus, 'superseded')
  assert.equal(oldAssistantMessage.meta.supersededByProposalId, second.proposal.id)
  assert.equal(oldAssistantMessage.meta.proposalSummary.status, 'superseded')
})

testAsync('backend workflow agent adopts structured model proposal when provider returns one', async () => {
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'structured-provider',
      async generate(context) {
        return {
          content: '模型已生成结构化登录注册弹窗提案。',
          provider: 'structured-provider',
          model: context.model,
          proposal: {
            title: '模型结构化提案',
            summary: '模型判断登录注册弹窗需要覆盖账号登录、注册、找回密码和第三方授权。',
            writeableContent: {
              summary: '使用模型结构化输出作为可写入内容。',
              items: ['账号密码登录', '手机号验证码注册', '忘记密码恢复', '第三方授权失败态'],
              acceptanceCriteria: ['所有错误态有字段级提示', '成功后回到触发登录前的页面']
            },
            downstreamImpact: [
              { nodeId: 'form-validation', reason: '新增验证码和第三方授权会影响校验规则。' }
            ]
          },
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-structured-proposal',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })

  const updated = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗完整提案' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })

  assert.equal(updated.proposal.title, '模型结构化提案')
  assert.equal(updated.proposal.summary, '模型判断登录注册弹窗需要覆盖账号登录、注册、找回密码和第三方授权。')
  assert.deepEqual(updated.proposal.writeableContent.items, ['账号密码登录', '手机号验证码注册', '忘记密码恢复', '第三方授权失败态'])
  assert.equal(updated.proposal.downstreamImpact[0].nodeId, 'form-validation')
  assert.equal(updated.assistantMessage.meta.proposalId, updated.proposal.id)
  assert.equal(updated.run.agentProposals['page-structure'][0].title, '模型结构化提案')
})

testAsync('openai compatible agent provider extracts proposal from json response text', async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        output_text: JSON.stringify({
          content: '模型已基于完整画布给出登录注册弹窗建议。',
          proposal: {
            title: '正文 JSON 提案',
            summary: '登录注册弹窗需要覆盖登录、注册、找回密码和异常恢复。',
            writeableContent: {
              summary: '可写入页面结构节点的认证弹窗建议。',
              items: ['登录表单', '注册表单', '找回密码入口'],
              acceptanceCriteria: ['确认后刷新表单校验节点']
            },
            downstreamImpact: [{ nodeId: 'form-validation', reason: '结构变化会影响字段校验。' }]
          }
        }),
        usage: { input_tokens: 8, output_tokens: 16, total_tokens: 24 }
      }
    }
  })
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://model.example/v1',
    defaultModel: 'gpt-5.5',
    fetchImpl
  })

  const result = await provider.generate({
    model: 'gpt-5.5',
    systemPrompt: 'system',
    userPrompt: 'user',
    actionType: 'supplement-detail',
    scopeId: 'page-structure',
    node: { title: '页面结构树' },
    references: []
  })

  assert.equal(result.content, '模型已基于完整画布给出登录注册弹窗建议。')
  assert.equal(result.proposal.title, '正文 JSON 提案')
  assert.equal(result.proposal.downstreamImpact[0].nodeId, 'form-validation')
})

testAsync('openai compatible agent stream extracts proposal from json delta text', async () => {
  const encoder = new TextEncoder()
  const jsonText = JSON.stringify({
    content: '流式模型已基于完整画布给出结构建议。',
    proposal: {
      title: '流式正文 JSON 提案',
      summary: '流式输出中包含可确认的登录注册弹窗结构建议。',
      writeableContent: {
        summary: '可写入当前节点的流式提案。',
        items: ['登录入口', '注册入口', '找回密码入口'],
        acceptanceCriteria: ['确认后刷新后续节点']
      },
      downstreamImpact: [{ nodeId: 'form-validation', reason: '后续校验需要同步。' }]
    }
  })
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: jsonText.slice(0, 40) })}\n\n`))
      controller.enqueue(encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: jsonText.slice(40) })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'https://model.example/v1',
    defaultModel: 'gpt-5.5',
    fetchImpl: async () => ({
      ok: true,
      body: stream
    })
  })

  const chunks = []
  for await (const chunk of provider.stream({
    model: 'gpt-5.5',
    systemPrompt: 'system',
    userPrompt: 'user',
    actionType: 'supplement-detail',
    scopeId: 'page-structure',
    node: { title: '页面结构树' },
    references: []
  })) {
    chunks.push(chunk)
  }

  const finalChunk = chunks.find((chunk) => chunk.type === 'final')
  assert.ok(chunks.some((chunk) => chunk.type === 'delta'))
  assert.equal(finalChunk.content, '流式模型已基于完整画布给出结构建议。')
  assert.equal(finalChunk.proposal.title, '流式正文 JSON 提案')
  assert.equal(finalChunk.proposal.downstreamImpact[0].nodeId, 'form-validation')
})

testAsync('backend confirm proposal route rebuilds current and downstream canvas nodes', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-confirm',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构、错误态和验收标准' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })

  const confirmed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
    id: created.run.id,
    proposalId: proposed.proposal.id,
    nodeId: 'page-structure',
    conversationId: 'agent-thread-page-structure',
    confirmMode: 'merge-current-and-downstream'
  })

  assert.ok(confirmed.analysis?.canvas)
  assert.equal(confirmed.appliedPatch.currentNodeId, 'page-structure')
  assert.ok(confirmed.appliedPatch.changedNodeIds.includes('page-structure'))
  assert.ok(confirmed.appliedPatch.changedNodeIds.includes('form-validation'))
  assert.ok(Array.isArray(confirmed.appliedPatch.nodeDiffs))
  assert.equal(confirmed.appliedPatch.nodeDiffs[0].nodeId, 'page-structure')
  assert.equal(confirmed.appliedPatch.nodeDiffs[0].before.summary, '旧结构')
  assert.match(confirmed.appliedPatch.nodeDiffs[0].after.summary, /上下文建议|登录注册/)
  assert.equal(confirmed.appliedPatch.nodeDiffs[1].nodeId, 'form-validation')
  assert.equal(confirmed.analysis.versions[0].appliedPatch.nodeDiffs.length, confirmed.appliedPatch.nodeDiffs.length)
  assert.equal(confirmed.appliedPatch.audit.proposalId, proposed.proposal.id)
  assert.equal(confirmed.appliedPatch.audit.model, 'gpt-5.5')
  assert.equal(confirmed.appliedPatch.audit.source, 'agent-proposal-confirm')
  assert.equal(confirmed.analysis.versions[0].appliedPatch.audit.proposalId, proposed.proposal.id)
  assert.equal(confirmed.run.agentProposals['page-structure'][0].status, 'confirmed')
  assert.equal(confirmed.analysis.versions[0].source, 'agent-proposal-confirm')
  assert.match(confirmed.analysis.canvas.nodes[0].content.join('\n'), /Agent 提案已确认|可写入/)
  assert.match(confirmed.analysis.canvas.nodes[1].content.join('\n'), /上游 page-structure 已更新/)
})

testAsync('backend confirm proposal route uses model patch with full canvas context', async () => {
  const seenContexts = []
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'patch-provider',
      async generate(context) {
        seenContexts.push(context)
        if (context.actionType === 'agent-proposal-confirm') {
          return {
            content: JSON.stringify({
              currentNode: {
                summary: '模型重写后的弹窗结构',
                content: ['模型补充：登录 Tab', '模型补充：注册 Tab', '模型补充：找回密码入口']
              },
              downstreamNodes: [
                {
                  nodeId: 'form-validation',
                  summary: '模型重写后的表单校验',
                  content: ['模型补充：验证码错误码', '模型补充：第三方授权失败态']
                }
              ],
              reason: '模型根据完整画布和确认提案重写当前节点与后续节点。'
            }),
            provider: 'patch-provider',
            model: context.model,
            usage: { inputTokens: 11, outputTokens: 22, totalTokens: 33 }
          }
        }
        return {
          content: '模型先返回结构化提案。',
          provider: 'patch-provider',
          model: context.model,
          proposal: {
            title: '待确认结构提案',
            summary: '确认后需要重写当前节点和表单校验节点。',
            actionIntent: 'target-user-enrichment',
            writeableContent: {
              summary: '补齐登录注册弹窗的结构、校验和异常态。',
              items: ['登录 Tab', '注册 Tab', '找回密码入口'],
              acceptanceCriteria: ['当前节点和后续节点保持一致']
            },
            downstreamImpact: [{ nodeId: 'form-validation', reason: '结构变化影响校验。' }]
          }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-model-patch-confirm',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'requirement', title: '需求结论', summary: '认证弹窗', content: ['登录注册弹窗'] },
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充完整结构提案' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[1] }
  })

  const confirmed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
    id: created.run.id,
    proposalId: proposed.proposal.id,
    nodeId: 'page-structure',
    confirmMode: 'merge-current-and-downstream'
  })

  const confirmContext = seenContexts.find((context) => context.actionType === 'agent-proposal-confirm')
  assert.ok(confirmContext)
  assert.equal(confirmContext.proposal.id, proposed.proposal.id)
  assert.equal(confirmContext.currentNode.id, 'page-structure')
  assert.deepEqual(confirmContext.upstreamNodes.map((node) => node.id), ['requirement'])
  assert.deepEqual(confirmContext.downstreamNodes.map((node) => node.id), ['form-validation'])
  assert.match(confirmContext.userPrompt, /完整画布/)
  assert.match(confirmContext.userPrompt, /待确认结构提案/)
  assert.match(confirmContext.userPrompt, /动作意图：target-user-enrichment/)
  assert.match(confirmContext.userPrompt, /确认写入内容：/)
  assert.match(confirmContext.userPrompt, /登录 Tab/)
  assert.match(confirmContext.userPrompt, /下游刷新约束：/)
  assert.match(confirmContext.systemPrompt, /必须优先消化 proposal\.writeableContent/)
  assert.equal(confirmed.analysis.canvas.nodes[1].summary, '模型重写后的弹窗结构')
  assert.deepEqual(confirmed.analysis.canvas.nodes[1].content, ['模型补充：登录 Tab', '模型补充：注册 Tab', '模型补充：找回密码入口'])
  assert.equal(confirmed.analysis.canvas.nodes[2].summary, '模型重写后的表单校验')
  assert.deepEqual(confirmed.analysis.canvas.nodes[2].content, ['模型补充：验证码错误码', '模型补充：第三方授权失败态'])
  assert.equal(confirmed.appliedPatch.reason, '模型根据完整画布和确认提案重写当前节点与后续节点。')
})

testAsync('backend confirm proposal fallback writes downstream nodes with proposal impact reasons', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-confirm-impact-fallback',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-profile', title: '弹窗档案' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-profile', title: '弹窗档案', summary: '旧档案', content: ['目标用户：所有人'] },
          { id: 'page-structure', title: '页面结构', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {
      'page-profile': [{
        id: 'proposal-target-user-impact',
        nodeId: 'page-profile',
        title: '目标用户补充提案',
        summary: '补齐目标用户分层。',
        status: 'pending',
        actionIntent: 'target-user-enrichment',
        writeableContent: {
          summary: '需要补齐未登录用户、新注册用户、忘记密码用户和第三方登录用户。',
          items: ['用户分层：未登录用户、新注册用户、忘记密码用户、第三方登录用户。'],
          acceptanceCriteria: ['后续结构和校验能引用目标用户口径。']
        },
        downstreamImpact: [
          { nodeId: 'page-structure', reason: '目标用户会影响页面结构的信息层级。' },
          { nodeId: 'form-validation', reason: '目标用户会影响表单校验和错误提示。' }
        ]
      }]
    }
  })

  const confirmed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
    id: created.run.id,
    proposalId: 'proposal-target-user-impact',
    nodeId: 'page-profile',
    confirmMode: 'merge-current-and-downstream'
  })

  assert.match(confirmed.analysis.canvas.nodes[1].content.join('\n'), /目标用户会影响页面结构的信息层级/)
  assert.match(confirmed.analysis.canvas.nodes[2].content.join('\n'), /目标用户会影响表单校验和错误提示/)
  assert.match(confirmed.appliedPatch.reason, /目标用户/)
})

testAsync('backend confirm proposal stream route emits staged progress and final canvas', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-confirm-stream',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构、错误态和验收标准' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })

  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/stream']({
    id: created.run.id,
    proposalId: proposed.proposal.id,
    nodeId: 'page-structure',
    confirmMode: 'merge-current-and-downstream'
  })

  assert.equal(streamed.contentType, 'text/event-stream; charset=utf-8')
  assert.match(streamed.body, /event: status\ndata: \{"step":"validating-proposal"/)
  assert.match(streamed.body, /event: status\ndata: \{"step":"rewriting-current"/)
  assert.match(streamed.body, /event: status\ndata: \{"step":"refreshing-downstream"/)
  assert.match(streamed.body, /event: status\ndata: \{"step":"saving-version"/)
  assert.match(streamed.body, /event: done/)
  assert.match(streamed.body, /"analysis":/)
  assert.match(streamed.body, /"appliedPatch":/)
})

test('mock api route matcher resolves workflow agent proposal confirm dynamic routes', () => {
  const runId = 'a73c0bb8-32b0-4ef6-a6d7-dd02fccbc11c'
  const proposalId = 'proposal-1782179096114-loa7me'
  const handler = matchRoute(
    'POST',
    `/api/workspace/workflow-runs/${runId}/agent-proposals/${proposalId}/confirm`
  )
  const streamHandler = matchRoute(
    'POST',
    `/api/workspace/workflow-runs/${runId}/agent-proposals/${proposalId}/confirm/stream`
  )

  assert.equal(typeof handler, 'function')
  assert.equal(typeof streamHandler, 'function')
})

testAsync('backend confirm proposal stream route reports persist failure after canvas rebuild', async () => {
  const failingStore = createWorkspaceStore({
    currentUserId: 'user-local-default',
    currentProjectId: 'project-flow',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [{ id: 'project-flow', ownerUserId: 'user-local-default', name: '默认项目' }],
    workflowRuns: []
  })
  const backendRoutes = workflowRoutes(failingStore)
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-confirm-stream-persist-fail',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构、错误态和验收标准' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })
  failingStore.persist = async () => {
    throw new Error('磁盘写入失败')
  }

  const streamed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/stream']({
    id: created.run.id,
    proposalId: proposed.proposal.id,
    nodeId: 'page-structure',
    confirmMode: 'merge-current-and-downstream'
  })

  assert.match(streamed.body, /event: status\ndata: \{"step":"saving-version"/)
  assert.match(streamed.body, /event: error/)
  assert.match(streamed.body, /"code":"AGENT_CONFIRM_PERSIST_FAILED"/)
  assert.match(streamed.body, /"recoveryActions":\["重试保存","重新生成建议"\]/)
  assert.match(streamed.body, /"appliedPatch":/)
  assert.match(streamed.body, /"run":/)
  assert.match(streamed.body, /"analysis":/)
})

testAsync('backend confirm proposal save route persists a generated canvas without rebuilding it', async () => {
  let persistCount = 0
  const store = createWorkspaceStore({
    currentUserId: 'user-local-default',
    currentProjectId: 'project-flow',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [{ id: 'project-flow', ownerUserId: 'user-local-default', name: '默认项目' }],
    workflowRuns: []
  })
  const backendRoutes = workflowRoutes(store)
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-confirm-save-only',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构、错误态和验收标准' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })
  const confirmed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
    id: created.run.id,
    proposalId: proposed.proposal.id,
    nodeId: 'page-structure',
    confirmMode: 'merge-current-and-downstream'
  })
  const rebuiltSummary = confirmed.analysis.canvas.nodes[0].summary
  store.workflowRuns = store.workflowRuns.filter((run) => run.id !== confirmed.run.id)
  store.persist = async () => {
    persistCount += 1
  }

  const saved = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/save']({
    id: confirmed.run.id,
    proposalId: proposed.proposal.id,
    run: confirmed.run,
    analysis: confirmed.analysis,
    appliedPatch: confirmed.appliedPatch
  })

  assert.equal(persistCount, 1)
  assert.equal(saved.analysis.canvas.nodes[0].summary, rebuiltSummary)
  assert.equal(saved.appliedPatch.currentNodeId, 'page-structure')
  assert.ok(store.workflowRuns.some((run) => run.id === confirmed.run.id))
})

testAsync('backend confirm proposal save route is idempotent for the same generated canvas', async () => {
  let persistCount = 0
  const store = createWorkspaceStore({
    currentUserId: 'user-local-default',
    currentProjectId: 'project-flow',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [{ id: 'project-flow', ownerUserId: 'user-local-default', name: '默认项目' }],
    workflowRuns: []
  })
  const backendRoutes = workflowRoutes(store)
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-proposal-confirm-save-idempotent',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构、错误态和验收标准' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })
  const confirmed = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
    id: created.run.id,
    proposalId: proposed.proposal.id,
    nodeId: 'page-structure',
    confirmMode: 'merge-current-and-downstream'
  })
  store.workflowRuns = store.workflowRuns.filter((run) => run.id !== confirmed.run.id)
  store.persist = async () => {
    persistCount += 1
  }

  const firstSave = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/save']({
    id: confirmed.run.id,
    proposalId: proposed.proposal.id,
    run: confirmed.run,
    analysis: confirmed.analysis,
    appliedPatch: confirmed.appliedPatch
  })
  const secondSave = await backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/save']({
    id: confirmed.run.id,
    proposalId: proposed.proposal.id,
    run: confirmed.run,
    analysis: confirmed.analysis,
    appliedPatch: confirmed.appliedPatch
  })

  assert.equal(persistCount, 1)
  assert.equal(firstSave.idempotent, false)
  assert.equal(secondSave.idempotent, true)
  assert.equal(secondSave.analysis.versions[0].id, confirmed.analysis.versions[0].id)
})

testAsync('backend proposal confirm rejects stale proposal when canvas version changed', async () => {
  const runnerStore = createWorkflowRunnerStore()
  const backendRoutes = workflowRoutes(runnerStore)
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-stale-proposal-version',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充登录注册弹窗结构、错误态和验收标准' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[0] }
  })

  assert.ok(proposed.proposal.canvasVersion)
  runnerStore.runs[0] = {
    ...runnerStore.runs[0],
    documentAnalysis: {
      ...runnerStore.runs[0].documentAnalysis,
      canvas: {
        ...runnerStore.runs[0].documentAnalysis.canvas,
        nodes: [
          { ...runnerStore.runs[0].documentAnalysis.canvas.nodes[0], summary: '用户已通过其它操作改过画布' },
          ...runnerStore.runs[0].documentAnalysis.canvas.nodes.slice(1)
        ]
      }
    }
  }

  await assert.rejects(
    () => backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
      id: created.run.id,
      proposalId: proposed.proposal.id,
      nodeId: 'page-structure',
      confirmMode: 'merge-current-and-downstream'
    }),
    (error) => {
      assert.equal(error.code, 'AGENT_PROPOSAL_STALE')
      assert.equal(error.currentCanvasVersion !== proposed.proposal.canvasVersion, true)
      assert.deepEqual(error.recoveryActions, ['重新生成建议'])
      return true
    }
  )

  const record = runnerStore.runs.find((run) => run.id === created.run.id)
  assert.equal(record.agentProposals['page-structure'][0].status, 'stale')
  assert.equal(record.agentProposals['page-structure'][0].staleReason, 'canvas-version-changed')
})

testAsync('backend confirm proposal route rejects invalid model patch without changing canvas', async () => {
  const runnerStore = createWorkflowRunnerStore()
  const backendRoutes = workflowRoutes(runnerStore, {
    agentProvider: {
      name: 'invalid-patch-provider',
      async generate(context) {
        if (context.actionType === 'agent-proposal-confirm') {
          return {
            content: JSON.stringify({ currentNode: {}, downstreamNodes: [], reason: '空 patch 不应应用。' }),
            provider: 'invalid-patch-provider',
            model: context.model
          }
        }
        return {
          content: '模型先返回结构化提案。',
          provider: 'invalid-patch-provider',
          model: context.model,
          proposal: {
            title: '待确认空 patch 提案',
            summary: '确认后模型返回空 patch，应被拒绝。',
            writeableContent: {
              summary: '补齐登录注册弹窗结构。',
              items: ['登录入口', '注册入口'],
              acceptanceCriteria: ['不能应用空 patch']
            },
            downstreamImpact: [{ nodeId: 'form-validation', reason: '结构变化影响校验。' }]
          }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-invalid-model-patch',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'requirement', title: '需求结论', summary: '原始需求', content: ['登录注册弹窗'] },
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充完整结构提案' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[1] }
  })

  await assert.rejects(
    () => backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
      id: created.run.id,
      proposalId: proposed.proposal.id,
      nodeId: 'page-structure',
      confirmMode: 'merge-current-and-downstream'
    }),
    (error) => error.code === 'AGENT_MODEL_PATCH_INVALID'
  )

  const record = runnerStore.runs.find((run) => run.id === created.run.id)
  assert.equal(record.documentAnalysis.canvas.nodes[1].summary, '旧结构')
  assert.equal(record.agentProposals['page-structure'][0].status, 'pending')
})

testAsync('backend confirm proposal route rejects model patch targeting upstream nodes', async () => {
  const runnerStore = createWorkflowRunnerStore()
  const backendRoutes = workflowRoutes(runnerStore, {
    agentProvider: {
      name: 'upstream-patch-provider',
      async generate(context) {
        if (context.actionType === 'agent-proposal-confirm') {
          return {
            content: JSON.stringify({
              currentNode: {
                summary: '模型准备改当前结构',
                content: ['登录入口', '注册入口']
              },
              downstreamNodes: [
                { nodeId: 'requirement', summary: '不允许改上游需求结论', content: ['篡改上游'] },
                { nodeId: 'form-validation', summary: '新校验', content: ['验证码校验'] }
              ],
              reason: '包含上游节点 patch，必须整体拒绝。'
            }),
            provider: 'upstream-patch-provider',
            model: context.model
          }
        }
        return {
          content: '模型先返回结构化提案。',
          provider: 'upstream-patch-provider',
          model: context.model,
          proposal: {
            title: '待确认上游 patch 提案',
            summary: '确认后模型试图改上游节点，应被拒绝。',
            writeableContent: {
              summary: '补齐登录注册弹窗结构。',
              items: ['登录入口', '注册入口'],
              acceptanceCriteria: ['不能改上游节点']
            },
            downstreamImpact: [{ nodeId: 'form-validation', reason: '结构变化影响校验。' }]
          }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-upstream-model-patch',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'requirement', title: '需求结论', summary: '原始需求', content: ['登录注册弹窗'] },
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] }
        ],
        edges: []
      },
      versions: []
    },
    agentSessions: {},
    agentProposals: {}
  })
  const proposed = await backendRoutes['POST /api/workspace/workflow-runs/:id/messages']({
    id: created.run.id,
    stepId: 'page-structure',
    model: 'gpt-5.5',
    message: { role: 'user', content: '补充完整结构提案' },
    context: { activeNode: created.run.documentAnalysis.canvas.nodes[1] }
  })

  await assert.rejects(
    () => backendRoutes['POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm']({
      id: created.run.id,
      proposalId: proposed.proposal.id,
      nodeId: 'page-structure',
      confirmMode: 'merge-current-and-downstream'
    }),
    (error) => error.code === 'AGENT_MODEL_PATCH_INVALID'
  )

  const record = runnerStore.runs.find((run) => run.id === created.run.id)
  assert.equal(record.documentAnalysis.canvas.nodes[0].summary, '原始需求')
  assert.equal(record.documentAnalysis.canvas.nodes[1].summary, '旧结构')
  assert.equal(record.documentAnalysis.canvas.nodes[2].summary, '旧校验')
  assert.equal(record.agentProposals['page-structure'][0].status, 'pending')
})

testAsync('frontend confirms only proposal backed agent messages through proposal route', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/workflow/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const confirmStart = drawerSource.indexOf('function canConfirmMessage')
  const confirmEnd = drawerSource.indexOf('function retryActionLabel', confirmStart)
  const confirmSource = drawerSource.slice(confirmStart, confirmEnd)
  const appConfirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const appConfirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', appConfirmStart)
  const appConfirmSource = appSource.slice(appConfirmStart, appConfirmEnd)
  const applyStart = appSource.indexOf('function applyWorkflowAgentConfirmedCanvasResult')
  const applyEnd = appSource.indexOf('async function retrySaveWorkflowAgentConfirmedCanvas', applyStart)
  const applySource = appSource.slice(applyStart, applyEnd)

  assert.match(confirmSource, /messageMeta\(message\)\.proposalId/)
  assert.match(confirmSource, /Boolean\(proposalId\)/)
  assert.match(apiSource, /confirmProposal\(config,\s*runId,\s*proposalId,\s*payload = \{\},\s*options = \{\}\)/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/agent-proposals\/\$\{encodeURIComponent\(proposalId\)\}\/confirm/)
  assert.match(appConfirmSource, /const proposalId = message\?\.meta\?\.proposalId/)
  assert.match(appConfirmSource, /api\.workflows\.confirmProposal/)
  assert.match(appConfirmSource, /applyWorkflowAgentConfirmedCanvasResult\(data,\s*targetNodeId\)/)
  assert.match(applySource, /workflowAnalysisResult\.value = data\.analysis/)
  assert.match(applySource, /documentAnalysis:\s*data\.analysis/)
  assert.match(appConfirmSource, /已写入画布并刷新后续节点/)
  assert.doesNotMatch(appConfirmSource, /sendWorkflowAgentMessage\('确认此环节'/)
})

testAsync('frontend repair action calls backend analysis repair and replaces canvas analysis', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const quickActionStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const quickActionEnd = appSource.indexOf('function openWorkflowAnalysisRecord', quickActionStart)
  const quickActionSource = appSource.slice(quickActionStart, quickActionEnd)

  assert.match(apiSource, /repairAnalysis\(config,\s*payload\)/)
  assert.match(apiSource, /\/api\/workspace\/analysis\/repair/)
  assert.match(appSource, /async function repairWorkflowAnalysis/)
  assert.match(quickActionSource, /payload\?\.type === 'repair-action'/)
  assert.match(quickActionSource, /void repairWorkflowAnalysis\(payload\)/)
  assert.match(appSource, /workflowAnalysisResult\.value = data\.analysis/)
  assert.match(appSource, /documentAnalysis:\s*data\.analysis/)
  assert.match(appSource, /upsertWorkflowRunRecord\(state\.workflowRuns/)
})

testAsync('workflow fullscreen node editing saves through backend and refreshes current plus downstream canvas', async () => {
  const componentSource = await readFile(new URL('../src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const editStart = componentSource.indexOf('function startFullscreenEdit')
  const editEnd = componentSource.indexOf('function focusNode', editStart)
  const editSource = componentSource.slice(editStart, editEnd)
  const saveStart = appSource.indexOf('async function saveWorkflowCanvasNodeEdit')
  const saveEnd = appSource.indexOf('function openWorkflowCanvasRun', saveStart)
  const saveSource = appSource.slice(saveStart, saveEnd)

  assert.match(componentSource, /defineEmits\(\[[^\]]*'edit-node'/)
  assert.match(componentSource, /@click="startFullscreenEdit\(fullscreenNode\)"/)
  assert.match(componentSource, /取消编辑/)
  assert.match(componentSource, /保存/)
  assert.match(componentSource, /<textarea[\s\S]*v-model="fullscreenEditSummary"/)
  assert.match(componentSource, /<textarea[\s\S]*v-model="fullscreenEditContentText"/)
  assert.match(componentSource, /<textarea[\s\S]*v-model="fullscreenEditDetailText"/)
  assert.match(editSource, /emit\('edit-node'/)
  assert.match(editSource, /editedSummary/)
  assert.match(editSource, /editedContentText/)
  assert.match(editSource, /editedDetailText/)
  assert.match(appSource, /@edit-node="saveWorkflowCanvasNodeEdit"/)
  assert.match(apiSource, /editWorkflowCanvasNode\(config,\s*runId,\s*nodeId,\s*payload = \{\}/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/canvas-nodes\/\$\{encodeURIComponent\(nodeId\)\}\/edit/)
  assert.match(saveSource, /workflowCanvasLoading\.value = true/)
  assert.match(saveSource, /workflowCanvasRefreshingNodeId\.value = targetNodeId/)
  assert.match(saveSource, /api\.workflows\.editWorkflowCanvasNode/)
  assert.match(saveSource, /workflowAnalysisResult\.value = data\.analysis/)
  assert.match(saveSource, /documentAnalysis:\s*data\.analysis/)
  assert.match(saveSource, /workflowFullscreenNodeId\.value = targetNodeId/)
  assert.match(saveSource, /finally \{[\s\S]*workflowCanvasLoading\.value = false[\s\S]*workflowCanvasRefreshingNodeId\.value = ''[\s\S]*\}/)
})

testAsync('backend canvas node edit route updates current node, downstream nodes, and version history', async () => {
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-canvas-node-edit',
    workflowId: 'podcastor-product-flow',
    input: '做一个登录注册弹窗',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'page-structure', title: '页面结构树' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个登录注册弹窗',
      canvas: {
        nodes: [
          { id: 'page-structure', title: '页面结构树', summary: '旧结构', content: ['只有登录'] },
          { id: 'form-validation', title: '表单校验', summary: '旧校验', content: ['只校验手机号'] },
          { id: 'flow', title: '用户路径', summary: '旧路径', content: ['登录后结束'] }
        ],
        edges: []
      },
      versions: []
    }
  })

  const edited = await backendRoutes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/edit']({
    id: created.run.id,
    nodeId: 'page-structure',
    editedSummary: '用户编辑后的弹窗结构',
    editedContentText: '登录 Tab\n注册 Tab\n找回密码入口',
    editedDetailText: '需要覆盖账号密码登录、验证码登录和错误提示。'
  })

  assert.ok(edited.analysis?.canvas)
  assert.equal(edited.appliedPatch.currentNodeId, 'page-structure')
  assert.ok(edited.appliedPatch.changedNodeIds.includes('page-structure'))
  assert.ok(edited.appliedPatch.changedNodeIds.includes('form-validation'))
  assert.ok(edited.appliedPatch.changedNodeIds.includes('flow'))
  assert.equal(edited.analysis.canvas.nodes[0].summary, '用户编辑后的弹窗结构')
  assert.deepEqual(edited.analysis.canvas.nodes[0].content.slice(0, 3), ['登录 Tab', '注册 Tab', '找回密码入口'])
  assert.match(edited.analysis.canvas.nodes[0].detailSections.at(-1).items.join('\n'), /账号密码登录/)
  assert.match(edited.analysis.canvas.nodes[1].content.join('\n'), /上游 page-structure 已手动编辑/)
  assert.match(edited.analysis.canvas.nodes[2].content.join('\n'), /上游 page-structure 已手动编辑/)
  assert.equal(edited.analysis.versions[0].source, 'canvas-node-edit')
  assert.equal(edited.analysis.versions[0].appliedPatch.changedNodeIds.length, edited.appliedPatch.changedNodeIds.length)
  assert.equal(edited.run.documentAnalysis.canvas.nodes[0].summary, '用户编辑后的弹窗结构')
})

testAsync('backend canvas node edit route lets model rewrite current and downstream nodes from full canvas context', async () => {
  const seenContexts = []
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'canvas-edit-provider',
      async generate(context) {
        seenContexts.push(context)
        return {
          content: JSON.stringify({
            currentNode: {
              summary: '模型重写后的娱乐小程序摘要',
              content: ['模型结论：先定位线上娱乐互动场景', '模型结论：补齐目标用户与成功指标']
            },
            downstreamNodes: [
              {
                nodeId: 'insights',
                summary: '模型重写后的核心观点',
                content: ['模型补充：机会来自轻量娱乐玩法', '模型补充：约束包括合规、留存和内容安全']
              },
              {
                nodeId: 'risk',
                summary: '模型重写后的风险问题',
                content: ['模型补充：需求范围不清会影响后续方案', '模型补充：需补充平台规则和审核边界']
              }
            ],
            reason: '模型根据完整画布和用户编辑内容重写当前节点与后续节点。'
          }),
          provider: 'canvas-edit-provider',
          model: context.model,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-canvas-node-edit-model',
    workflowId: 'podcastor-product-flow',
    input: '做一个娱乐小程序 项目蓝图',
    model: 'gpt-5.5',
    status: 'running',
    steps: [{ id: 'summary', title: '文档摘要' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个娱乐小程序 项目蓝图',
      canvas: {
        nodes: [
          { id: 'summary', title: '文档摘要', summary: '旧摘要', content: ['旧内容'] },
          { id: 'insights', title: '核心观点', summary: '旧观点', content: ['旧观点内容'] },
          { id: 'risk', title: '风险问题', summary: '旧风险', content: ['旧风险内容'] }
        ],
        edges: []
      },
      versions: []
    }
  })

  const edited = await backendRoutes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/edit']({
    id: created.run.id,
    nodeId: 'summary',
    editedSummary: '用户编辑：这是一个娱乐小程序项目蓝图',
    editedContentText: '需要明确娱乐类型\n需要补充用户和成功指标',
    editedDetailText: '用户希望后续节点真正按这个方向重写。'
  })

  const context = seenContexts.find((item) => item.actionType === 'canvas-node-edit')
  assert.ok(context)
  assert.equal(context.currentNode.id, 'summary')
  assert.deepEqual(context.downstreamNodes.map((node) => node.id), ['insights', 'risk'])
  assert.match(context.userPrompt, /完整画布/)
  assert.match(context.userPrompt, /用户编辑：这是一个娱乐小程序项目蓝图/)
  assert.match(context.userPrompt, /需要明确娱乐类型/)
  assert.match(context.systemPrompt, /只能更新当前节点和它之后的节点/)
  assert.equal(edited.analysis.canvas.nodes[0].summary, '模型重写后的娱乐小程序摘要')
  assert.deepEqual(edited.analysis.canvas.nodes[0].content, ['模型结论：先定位线上娱乐互动场景', '模型结论：补齐目标用户与成功指标'])
  assert.equal(edited.analysis.canvas.nodes[1].summary, '模型重写后的核心观点')
  assert.equal(edited.analysis.canvas.nodes[2].summary, '模型重写后的风险问题')
  assert.equal(edited.appliedPatch.reason, '模型根据完整画布和用户编辑内容重写当前节点与后续节点。')
  assert.equal(edited.appliedPatch.audit.source, 'canvas-node-edit')
  assert.equal(edited.appliedPatch.audit.provider, 'canvas-edit-provider')
  assert.equal(edited.analysis.versions[0].source, 'canvas-node-edit')
})

testAsync('workflow canvas small nodes clamp summary to three lines and scroll content inside the card', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const cardRule = styles.match(/\.canvas-node-card\s*\{[\s\S]*?\}/)?.[0] || ''
  const summaryRule = styles.match(/\.canvas-node-card p\s*\{[\s\S]*?\}/)?.[0] || ''
  const contentRule = styles.match(/\.canvas-node-content\s*\{[\s\S]*?\}/)?.[0] || ''

  assert.match(cardRule, /max-height:\s*\d+px;/)
  assert.match(cardRule, /grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto;/)
  assert.match(summaryRule, /-webkit-line-clamp:\s*3;/)
  assert.match(summaryRule, /overflow:\s*hidden;/)
  assert.match(contentRule, /min-height:\s*0;/)
  assert.match(contentRule, /overflow-y:\s*auto;/)
  assert.doesNotMatch(summaryRule, /overflow-y:\s*auto/)
})

test('backend analysis repair can apply confirmed agent supplement and refresh downstream canvas', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const analysis = analyzeRequirementDocuments({
    demandScope: 'project',
    skillId: 'auto',
    skillSelectionMode: 'auto',
    input: '做一个登录注册页面',
    documents: []
  })

  const result = await backendRoutes['POST /api/workspace/analysis/repair']({
    type: 'agent-supplement',
    action: '只是一个弹窗就行，你只要补充交互流程',
    analysis
  })

  assert.equal(result.analysis.status, 'repaired')
  assert.equal(result.analysis.detectedIntent, 'auth-modal')
  assert.equal(result.analysis.blueprint.intent, 'auth-modal')
  assert.ok(result.analysis.canvas.nodes.some((node) => /弹窗/.test(`${node.title}${node.summary}${(node.content || []).join('')}`)))
  assert.equal(result.analysis.versions[0].source, 'agent-supplement')
})

testAsync('frontend agent supplement action sends context to backend and refreshes canvas loading state', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const quickActionStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const quickActionEnd = appSource.indexOf('function openWorkflowAnalysisRecord', quickActionStart)
  const quickActionSource = appSource.slice(quickActionStart, quickActionEnd)

  assert.match(quickActionSource, /payload\?\.type === 'agent-supplement'/)
  assert.match(quickActionSource, /void applyWorkflowAgentSupplement\(payload\)/)
  assert.match(appSource, /async function applyWorkflowAgentSupplement/)
  assert.match(appSource, /workflowCanvasLoading\.value = true/)
  assert.match(appSource, /type:\s*'agent-supplement'/)
  assert.match(appSource, /workflowAnalysisResult\.value = data\.analysis/)
})

testAsync('workflow canvas quick actions open agent with backend advice generation request', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const quickActionStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const quickActionEnd = appSource.indexOf('async function applyWorkflowAgentSupplement', quickActionStart)
  const quickActionSource = appSource.slice(quickActionStart, quickActionEnd)
  const canvasActionStart = appSource.indexOf('function sendWorkflowAgentCanvasAction')
  const canvasActionEnd = appSource.indexOf('function runWorkflowNodeQuickAction', canvasActionStart)
  const canvasActionSource = appSource.slice(canvasActionStart, canvasActionEnd)

  assert.match(appSource, /function sendWorkflowAgentCanvasAction\(action,\s*nodeId = ''\)/)
  assert.match(appSource, /function normalizeWorkflowCanvasAction\(action,\s*nodeId = ''\)/)
  assert.match(quickActionSource, /sendWorkflowAgentCanvasAction\(action,\s*nodeId\)/)
  assert.match(canvasActionSource, /openWorkflowAgent\(\)/)
  assert.match(canvasActionSource, /const targetNodeId = nodeId \|\| workflowAgentScopeId\(\)/)
  assert.match(canvasActionSource, /const canvasAction = normalizeWorkflowCanvasAction\(action,\s*targetNodeId\)/)
  assert.match(canvasActionSource, /sendWorkflowAgentMessage\(userMessage,\s*\{[\s\S]*nodeId:\s*targetNodeId[\s\S]*action:\s*'canvas-action-advice'[\s\S]*canvasAction:\s*\{[\s\S]*action:[\s\S]*nodeId:\s*targetNodeId/)
  assert.match(canvasActionSource, /actionIntent:\s*canvasAction\.actionIntent/)
  assert.match(canvasActionSource, /expectedSections:\s*canvasAction\.expectedSections/)
  assert.doesNotMatch(canvasActionSource, /输出要求|不要回复|详细建议/)
  assert.doesNotMatch(quickActionSource, /openWorkflowAgent\(\)\s*\n\s*void sendWorkflowAgentMessage\(action\)/)
})

testAsync('workflow canvas action classifier gives specific intents for common canvas advice actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const intentStart = appSource.indexOf('function workflowCanvasActionIntent')
  const intentEnd = appSource.indexOf('function workflowCanvasActionTemplate', intentStart)
  const intentSource = appSource.slice(intentStart, intentEnd)
  const templateStart = appSource.indexOf('function workflowCanvasActionTemplate')
  const templateEnd = appSource.indexOf('function normalizeWorkflowCanvasAction', templateStart)
  const templateSource = appSource.slice(templateStart, templateEnd)

  assert.match(intentSource, /验收标准|验收|测试口径|通过条件/)
  assert.match(intentSource, /acceptance-criteria-enrichment/)
  assert.match(intentSource, /接口契约|补接口|错误码|前后端/)
  assert.match(intentSource, /api-contract-enrichment/)
  assert.match(intentSource, /异常状态|补异常|空状态|加载态|恢复入口/)
  assert.match(intentSource, /exception-state-enrichment/)
  assert.match(intentSource, /埋点指标|补埋点|转化|漏斗/)
  assert.match(intentSource, /analytics-enrichment/)
  assert.match(templateSource, /acceptance-criteria-enrichment/)
  assert.match(templateSource, /成功路径|失败态|测试口径|可验收/)
  assert.match(templateSource, /api-contract-enrichment/)
  assert.match(templateSource, /接口端点|请求字段|返回字段|错误码|Mock/)
  assert.match(templateSource, /exception-state-enrichment/)
  assert.match(templateSource, /加载|空|错|权限|恢复入口/)
  assert.match(templateSource, /analytics-enrichment/)
  assert.match(templateSource, /事件名|触发时机|事件属性|转化指标|隐私/)
})

testAsync('backend agent context owns canvas action prompt details from structured payload', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const contextSource = await readFile(new URL('../后端/services/agent-context-builder.js', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const requestContextStart = appSource.indexOf('function workflowAgentRequestContext')
  const requestContextEnd = appSource.indexOf('function ensureWorkflowAgentSession', requestContextStart)
  const requestContextSource = appSource.slice(requestContextStart, requestContextEnd)

  assert.match(sendSource, /canvasAction:\s*options\.canvasAction \|\| null/)
  assert.match(requestContextSource, /canvasAction:\s*options\.canvasAction \|\| null/)
  assert.match(contextSource, /const canvasAction = payload\.context\?\.canvasAction/)
  assert.match(contextSource, /function normalizeCanvasActionIntent\(canvasAction = \{\}\)/)
  assert.match(contextSource, /function canvasActionOutputGuide\(actionIntent = ''\)/)
  assert.match(contextSource, /画布动作：\$\{normalizedCanvasAction\.action/)
  assert.match(contextSource, /动作意图：\$\{normalizedCanvasAction\.actionIntent/)
  assert.match(contextSource, /输出章节：\$\{normalizedCanvasAction\.expectedSections/)
  assert.match(contextSource, /结论/)
  assert.match(contextSource, /依据与假设/)
  assert.match(contextSource, /缺口与风险/)
  assert.match(contextSource, /可写入画布内容/)
  assert.match(contextSource, /后续画布影响/)
  assert.match(contextSource, /输出要求：直接给出详细建议、依据、缺口风险、可补充到画布的结构化内容/)
})

testAsync('workflow canvas quick action pins request context active node to clicked canvas node', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const requestContextStart = appSource.indexOf('function workflowAgentRequestContext')
  const requestContextEnd = appSource.indexOf('function ensureWorkflowAgentSession', requestContextStart)
  const requestContextSource = appSource.slice(requestContextStart, requestContextEnd)
  const persistStreamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const persistStreamEnd = appSource.indexOf('function openWorkflowAgent', persistStreamStart)
  const persistStreamSource = appSource.slice(persistStreamStart, persistStreamEnd)
  const canvasActionStart = appSource.indexOf('function sendWorkflowAgentCanvasAction')
  const canvasActionEnd = appSource.indexOf('function runWorkflowNodeQuickAction', canvasActionStart)
  const canvasActionSource = appSource.slice(canvasActionStart, canvasActionEnd)

  assert.match(requestContextSource, /const explicitNode = options\.nodeId \? canvasNodeById\(options\.nodeId\) : null/)
  assert.match(requestContextSource, /const node = explicitNode \|\| workflowAgentNode\.value/)
  assert.match(persistStreamSource, /nodeId:\s*options\.nodeId \|\| ''/)
  assert.match(canvasActionSource, /nodeId:\s*targetNodeId/)
})

testAsync('workflow agent confirmation words stay in chat while proposal confirm writes canvas', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const confirmStart = appSource.indexOf('function confirmWorkflowAgentMessage')
  const confirmEnd = appSource.indexOf('async function stopWorkflowAgentGeneration', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)
  const quickActionStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const quickActionEnd = appSource.indexOf('async function applyWorkflowAgentSupplement', quickActionStart)
  const quickActionSource = appSource.slice(quickActionStart, quickActionEnd)

  assert.match(appSource, /function isWorkflowAgentConfirmationAction\(content/)
  assert.match(appSource, /确认此环节\|确认结构\|确认框架\|下一步\|进入下一步/)
  assert.doesNotMatch(sendSource, /isConfirmCanvasAction/)
  assert.doesNotMatch(sendSource, /await applyWorkflowAgentSupplement\(\{\s*nodeId:\s*targetCanvasNodeId/)
  assert.match(confirmSource, /api\.workflows\.confirmProposal/)
  assert.match(confirmSource, /workflowCanvasLoading\.value = true/)
  assert.match(quickActionSource, /isWorkflowAgentConfirmationAction\(action\)/)
  assert.match(quickActionSource, /type:\s*'agent-supplement'/)
})

testAsync('workflow agent backend handled replies skip legacy local command side effects', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)
  const backendHandledStart = sendSource.indexOf('if (backendHandled) {')
  const backendHandledEnd = sendSource.indexOf('} else {', backendHandledStart)
  const backendHandledSource = sendSource.slice(backendHandledStart, backendHandledEnd)

  assert.match(backendHandledSource, /return/)
  assert.doesNotMatch(sendSource, /\/使用示例\|示例/)
  assert.doesNotMatch(sendSource, /\/采纳\|进入下一步\|下一步/)
  assert.doesNotMatch(sendSource, /runWorkflowArtifactAction\('blueprint'/)
  assert.doesNotMatch(sendSource, /silent:\s*backendHandled/)
})

testAsync('workflow canvas reanalysis quick action repairs current node instead of sending agent chat', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const quickActionStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const quickActionEnd = appSource.indexOf('async function applyWorkflowAgentSupplement', quickActionStart)
  const quickActionSource = appSource.slice(quickActionStart, quickActionEnd)
  const repairStart = appSource.indexOf('async function repairWorkflowAnalysis')
  const repairEnd = appSource.indexOf('function openWorkflowCanvasRun', repairStart)
  const repairSource = appSource.slice(repairStart, repairEnd)
  const reanalysisBranch = quickActionSource.slice(
    quickActionSource.indexOf('if (isWorkflowAgentReanalysisAction(action))'),
    quickActionSource.indexOf('if (isWorkflowAgentConfirmationAction(action))')
  )

  assert.match(appSource, /function isWorkflowAgentReanalysisAction\(content = ''\)/)
  assert.match(appSource, /重新分析\|重新分析文档\|重跑分析/)
  assert.match(quickActionSource, /isWorkflowAgentReanalysisAction\(action\)/)
  assert.match(reanalysisBranch, /selectWorkflowCanvasNode\(nodeId\)/)
  assert.match(reanalysisBranch, /void repairWorkflowAnalysis\(\{[\s\S]*type:\s*'reanalysis'[\s\S]*nodeId:[\s\S]*action:[\s\S]*checkId:\s*'node-reanalysis'/)
  assert.doesNotMatch(reanalysisBranch, /openWorkflowAgent\(\)/)
  assert.doesNotMatch(reanalysisBranch, /sendWorkflowAgentMessage\(action\)/)
  assert.match(repairSource, /const targetNodeId = workflowAgentResolvedNodeId\(payload\.nodeId\)/)
  assert.match(repairSource, /workflowCanvasLoading\.value = true/)
  assert.match(repairSource, /workflowCanvasRefreshingNodeId\.value = targetNodeId/)
  assert.match(repairSource, /正在重新分析当前节点/)
  assert.match(repairSource, /catch \(error\)/)
  assert.match(repairSource, /finally \{[\s\S]*workflowCanvasLoading\.value = false[\s\S]*workflowCanvasRefreshingNodeId\.value = ''[\s\S]*\}/)
})

testAsync('workflow agent confirmation shows failed card when canvas supplement is not applied', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const supplementStart = appSource.indexOf('async function applyWorkflowAgentSupplement')
  const supplementEnd = appSource.indexOf('async function repairWorkflowAnalysis', supplementStart)
  const supplementSource = appSource.slice(supplementStart, supplementEnd)
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(supplementSource, /return false/)
  assert.match(supplementSource, /return true/)
  assert.doesNotMatch(sendSource, /isConfirmCanvasAction/)
  assert.doesNotMatch(sendSource, /const canvasApplied = await applyWorkflowAgentSupplement/)
  assert.doesNotMatch(sendSource, /if \(!canvasApplied\)/)
  assert.match(sendSource, /status:\s*'failed'/)
  assert.match(appSource, /确认入画布失败/)
  assert.doesNotMatch(sendSource, /await applyWorkflowAgentSupplement\(\{[\s\S]*\}\)\s*\n\s*if \(workflowAgentRequestToken\.value !== requestToken\) return\s*\n\s*replaceWorkflowAgentMessage\(pendingMessageId,\s*\{[\s\S]*已确认当前环节/)
})

testAsync('backend generation runner falls back when model json is invalid', async () => {
  const provider = {
    name: 'fake-openai',
    async generate() {
      return {
        content: '{"intent":"auth-page","sections":[]}',
        provider: 'openai-compatible',
        model: 'gpt-test',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面',
    agentProvider: provider
  })

  assert.equal(result.status, 'generated')
  assert.equal(result.provider, 'deterministic')
  assert.equal(result.fallbackUsed, true)
  assert.match(result.fallbackReason, /校验失败|missing/)
  assert.equal(result.output.intent, 'auth-page')
  assert.equal(result.validation.ok, true)
})

testAsync('backend generation runner falls back when model provider throws', async () => {
  const provider = {
    name: 'fake-timeout-model',
    async generate() {
      throw new Error('模型请求超时')
    }
  }

  const result = await runSkillGeneration({
    skillId: 'smart-recommendation-skill',
    input: '做一个登录注册弹窗',
    routing: { resolvedSkillId: 'smart-recommendation-skill', detectedIntent: 'auth-modal' },
    agentProvider: provider
  })

  assert.equal(result.status, 'generated')
  assert.equal(result.provider, 'deterministic')
  assert.equal(result.fallbackUsed, true)
  assert.match(result.fallbackReason, /模型请求超时/)
  assert.equal(result.output.intent, 'auth-modal')
  assert.equal(result.validation.ok, true)
})

testAsync('backend generation runner records model call logs for success and fallback', async () => {
  const logs = []
  const provider = {
    name: 'fake-openai',
    async generate() {
      return {
        content: '{"intent":"auth-page","sections":[]}',
        provider: 'openai-compatible',
        model: 'gpt-test',
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'auth-page-generation',
    input: '做一个登录注册页面',
    agentProvider: provider,
    modelCallLog: logs
  })

  assert.equal(result.fallbackUsed, true)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].skillId, 'auth-page-generation')
  assert.equal(logs[0].provider, 'openai-compatible')
  assert.equal(logs[0].model, 'gpt-test')
  assert.equal(logs[0].status, 'fallback')
  assert.equal(logs[0].usage.totalTokens, 7)
  assert.equal(typeof logs[0].durationMs, 'number')
  assert.match(logs[0].fallbackReason, /校验失败|missing/)
})

testAsync('backend workspace stores and lists model call logs', async () => {
  const store = createWorkspaceStore()
  const backendRoutes = workspaceRoutes(store)
  const saved = await backendRoutes['POST /api/workspace/model-call-logs']({
    skillId: 'auth-page-generation',
    provider: 'openai-compatible',
    model: 'gpt-test',
    status: 'success',
    durationMs: 123,
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
  })
  const listed = await backendRoutes['GET /api/workspace/model-call-logs']({
    skillId: 'auth-page-generation'
  })

  assert.match(saved.log.id, /^model-call-/)
  assert.equal(listed.logs.length, 1)
  assert.equal(listed.logs[0].skillId, 'auth-page-generation')
  assert.equal(listed.logs[0].usage.totalTokens, 3)
})

testAsync('backend upload analysis persists model call logs into workspace store', async () => {
  const store = createWorkspaceStore()
  const provider = {
    name: 'enterprise-model',
    async generate() {
      return {
        content: JSON.stringify({
          intent: 'auth-page',
          sections: [{ title: '落库日志登录注册', items: ['登录', '注册'] }],
          frontendHandoff: ['前端接管表单状态'],
          backendHandoff: ['后端接管认证接口'],
          apiContract: [{ method: 'POST', path: '/api/auth/login', requestFields: ['account'], responseFields: ['token'] }],
          html: '<!doctype html><html><body>日志落库</body></html>',
          preview: { mode: 'html' },
          qualityReport: { passed: true, checks: [] }
        }),
        provider: 'enterprise-model',
        model: 'enterprise-auth-log',
        usage: { inputTokens: 11, outputTokens: 22, totalTokens: 33 }
      }
    }
  }
  const uploadBackendRoutes = uploadRoutes({ store, agentProvider: provider })
  const workspaceBackendRoutes = workspaceRoutes(store)

  await uploadBackendRoutes['POST /api/uploads/documents/analyze']({
    demandScope: 'project',
    skillId: 'auth-page-generation',
    projectId: 'project-auth-log',
    project: { id: 'project-auth-log', name: '认证项目' },
    input: '做一个登录注册页面，需要接模型并记录调用日志。',
    documents: []
  })
  const listed = await workspaceBackendRoutes['GET /api/workspace/model-call-logs']({
    skillId: 'auth-page-generation'
  })

  assert.equal(listed.logs.length, 1)
  assert.equal(listed.logs[0].provider, 'enterprise-model')
  assert.equal(listed.logs[0].model, 'enterprise-auth-log')
  assert.equal(listed.logs[0].status, 'success')
  assert.equal(listed.logs[0].usage.totalTokens, 33)
  assert.equal(listed.logs[0].demandScope, 'project')
  assert.equal(listed.logs[0].projectId, 'project-auth-log')
  assert.equal(listed.logs[0].detectedIntent, 'auth-page')
  assert.match(listed.logs[0].routingReason, /登录注册|认证/)
})

test('deletes selected material items by id without touching other entries', () => {
  const items = [
    { id: 'keep-a', title: '保留 A' },
    { id: 'delete-a', title: '删除 A' },
    { id: 'keep-b', title: '保留 B' },
    { id: 'delete-b', title: '删除 B' }
  ]

  const next = deleteMaterialItemsById(items, ['delete-a', 'delete-b', 'missing'])

  assert.deepEqual(next.map((item) => item.id), ['keep-a', 'keep-b'])
})

test('toggles all material selections from visible item ids', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  assert.deepEqual(toggleAllMaterialIds(items, []), ['a', 'b', 'c'])
  assert.deepEqual(toggleAllMaterialIds(items, ['a', 'b', 'c']), [])
  assert.deepEqual(toggleAllMaterialIds(items, ['a']), ['a', 'b', 'c'])
})

test('imports multiple local documents into project scoped material items and reports failures', async () => {
  const files = [
    {
      name: '需求.md',
      type: 'text/markdown',
      text: async () => '第一行\r\n\r\n\r\n第二行'
    },
    {
      name: '坏文件.bin',
      type: 'application/octet-stream'
    }
  ]

  const results = await importLocalDocuments(files, {
    projectId: 'project-a',
    type: 'requirements'
  })

  assert.equal(results.length, 2)
  assert.equal(results[0].ok, true)
  assert.equal(results[0].item.projectId, 'project-a')
  assert.equal(results[0].item.title, '需求.md')
  assert.equal(results[0].item.meta, '需求文档 · 本地导入')
  assert.equal(results[0].item.content, '第一行\n\n第二行')
  assert.equal(results[1].ok, false)
  assert.equal(results[1].name, '坏文件.bin')
  assert.match(results[1].error, /不支持|file.text/)
  assert.equal(normalizeExtractedText('a\r\n\r\n\r\nb'), 'a\n\nb')
})
