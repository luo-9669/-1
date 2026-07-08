export { createWorkspaceStore } from '../services/workspace-store.js'

import { createHash } from 'node:crypto'
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
  deleteMaterial,
  exportRoleKnowledgePackage,
  getModelSettingsRaw,
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
import { blueprintKnowledgeItems, buildProjectBlueprint } from '../../frontend/src/services/projectBlueprint.js'
import { buildWebsiteKnowledgeImport, websiteBlueprintDocumentFromImport } from '../../frontend/src/services/websiteKnowledge.js'
import { createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { safeParseModelJson } from '../services/generation-runner.js'

function normalizeDocumentText(document = {}) {
  return String(document.text || document.content || document.markdown || '').trim()
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
  const settings = getModelSettingsRaw(store)
  if (settings.enabled) return createAgentProviderFromModelSettings(settings, options.fetchImpl)
  return options.agentProvider || null
}

export function workspaceRoutes(store, options = {}) {
  const importWebsiteKnowledge = options.importWebsiteKnowledge || ((payload) => buildWebsiteKnowledgeImport(payload))
  const captureWebsitePrototype = options.captureWebsitePrototype || null

  return {
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
      const asset = await addAsset(store, payload)
      return { asset }
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
          materials.push(await addMaterial(store, {
            id: stableMaterialId([
              payload.projectId,
              'document',
              payload.type || 'requirements',
              document.id || document.name || 'document'
            ]),
            projectId: payload.projectId,
            type: payload.type || 'requirements',
            title: document.name || '未命名文档',
            meta: document.type || 'document',
            status: payload.type === 'requirements' ? '待设计' : '已解析',
            content: text,
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
    'GET /api/workspace/restored-pages/:id/preview': async (payload) => restoredPagePreview(store, payload.id),
    'GET /api/workspace/restored-pages/:id/frame': async (payload) => restoredPageFrame(store, payload.id),
    'GET /api/workspace/restored-pages/:id/source': async (payload) => restoredPageSource(store, payload.id),
    'GET /api/workspace/workflow-runs/:id': async (payload) => ({
      run: getWorkflowRun(store, payload.id)
    }),
    ...workflowRoutes(store, {
      persist: (run) => upsertWorkflowRun(store, run),
      update: (id, updater) => updateWorkflowRun(store, id, updater),
      agentProvider: () => resolveWorkspaceAgentProvider(store, options),
      fallback: options.fallback
    })
  }
}
