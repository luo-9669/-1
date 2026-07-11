import { exportBlueprintMarkdown } from './projectBlueprint.js'

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function textOf(...parts) {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => typeof part === 'string' ? part : JSON.stringify(part))
    .join(' ')
}

function compactText(value = '', limit = 2400) {
  return String(value || '').replace(/\s{3,}/g, '\n\n').trim().slice(0, limit)
}

function tokenize(value = '') {
  return Array.from(new Set(
    String(value || '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
  ))
}

function projectIdentityTokens(project = {}) {
  const tokens = tokenize(textOf(project.name, project.title, project.domain))
  return tokens.filter((token) => !['project', 'default', 'demo', 'test', 'website', 'app'].includes(token))
}

function assetEvidenceText(asset = {}) {
  const blueprint = asset.blueprint || {}
  const profile = blueprint.profile || {}
  return textOf(
    asset.title,
    asset.name,
    asset.type,
    asset.meta,
    blueprint.title,
    profile.productName,
    profile.positioning,
    profile.primaryGoal,
    blueprint.framework?.title,
    asArray(blueprint.framework?.children).map((item) => item.title || item.name),
    asArray(blueprint.demoScreens || blueprint.pages).map((item) => item.title || item.name || item.pageName)
  )
}

function updatedScore(asset = {}) {
  const value = Date.parse(asset.updatedAt || asset.createdAt || asset.importedAt || '') || 0
  return value / 100000000000000
}

function projectAssetScore(asset = {}, project = {}) {
  const text = assetEvidenceText(asset).toLowerCase()
  const assetTokens = new Set(tokenize(text))
  const projectTokens = projectIdentityTokens(project)
  const matchedProjectTokens = projectTokens.filter((token) => assetTokens.has(token) || text.includes(token))
  const typeScore = asset.type === 'project-blueprint' ? 28 : asset.type === 'blueprint' ? 24 : asset.blueprint ? 10 : 0
  const structureScore = asset.blueprint?.framework ? 16 : 0
  const screenScore = asArray(asset.blueprint?.demoScreens || asset.blueprint?.pages).length ? 8 : 0
  return typeScore + structureScore + screenScore + matchedProjectTokens.length * 120 + updatedScore(asset)
}

export function selectProjectBlueprintAsset(assets = [], project = {}) {
  return asArray(assets)
    .filter((asset) => asset?.blueprint && ['project-blueprint', 'blueprint'].includes(asset.type || ''))
    .map((asset) => ({ asset, score: projectAssetScore(asset, project) }))
    .sort((left, right) => right.score - left.score)
    .map(({ asset }) => asset)[0] || null
}

function prototypeDemo(asset = {}) {
  return asset.prototypeDemo || (asset.type === 'prototype-demo' ? asset : null)
}

function prototypeScore(asset = {}, project = {}, blueprintAsset = null, mode = 'prototype') {
  const demo = prototypeDemo(asset)
  if (!demo) return -1
  const screens = asArray(demo.screens)
  const screenshotCount = screens.filter((screen) =>
    String(screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl || '').trim()
  ).length
  const hotspotCount = screens.reduce((total, screen) => total + asArray(screen.hotspots || screen.actions).length, 0)
  const transitionCount = asArray(demo.transitions).length
  const linkedScore = blueprintAsset?.id && asset.sourceAssetId === blueprintAsset.id ? 90 : 0
  const projectScore = projectAssetScore(asset, project)
  const contentScore = mode === 'flow'
    ? screens.length * 1000 + transitionCount * 80 + hotspotCount * 10 + screenshotCount
    : screenshotCount * 1000 + transitionCount * 80 + hotspotCount * 10 + screens.length
  return linkedScore + projectScore + contentScore + updatedScore(asset)
}

export function selectProjectPrototypeDemoAsset(assets = [], project = {}, blueprintAsset = null, mode = 'prototype') {
  return asArray(assets)
    .filter((asset) => asset?.type === 'prototype-demo' || asset?.prototypeDemo)
    .map((asset) => ({ asset, score: prototypeScore(asset, project, blueprintAsset, mode) }))
    .sort((left, right) => right.score - left.score)
    .map(({ asset }) => asset)[0] || null
}

function renderTreeLines(node = {}, depth = 0) {
  if (!node) return []
  const title = node.title || node.name || node.label || ''
  const current = title ? [`${'  '.repeat(depth)}- ${title}`] : []
  return [
    ...current,
    ...asArray(node.children).flatMap((child) => renderTreeLines(child, depth + 1))
  ]
}

function renderBlueprintFrameworkDocument(project = {}, blueprintAsset = null) {
  const blueprint = blueprintAsset?.blueprint || null
  if (!blueprint) return null
  const profile = blueprint.profile || {}
  const content = [
    `项目：${project.name || project.title || profile.productName || blueprint.title || ''}`,
    `蓝图：${blueprint.title || blueprintAsset.title || ''}`,
    profile.productName ? `产品名称：${profile.productName}` : '',
    profile.positioning ? `定位：${profile.positioning}` : '',
    profile.primaryGoal ? `核心目标：${profile.primaryGoal}` : '',
    renderTreeLines(blueprint.framework).length ? `框架全览：\n${renderTreeLines(blueprint.framework).join('\n')}` : '',
    asArray(blueprint.demoScreens || blueprint.pages).length
      ? `页面清单：${asArray(blueprint.demoScreens || blueprint.pages).map((page) => page.title || page.name || page.pageName).filter(Boolean).slice(0, 24).join(' / ')}`
      : ''
  ].filter(Boolean).join('\n')
  return {
    id: `project-knowledge-framework-${blueprintAsset.id || 'blueprint'}`,
    name: `知识库：框架全览 · ${blueprint.title || blueprintAsset.title || project.name || '项目蓝图'}`,
    type: 'knowledge',
    sourceType: 'project-knowledge-framework',
    content: compactText(content, 3200),
    text: compactText(content, 3200),
    status: '已读取',
    knowledgeMaterialId: blueprintAsset.id || ''
  }
}

function renderPrototypeDocument(project = {}, asset = null, sourceType = 'project-knowledge-prototype') {
  const demo = prototypeDemo(asset)
  if (!demo) return null
  const screens = asArray(demo.screens)
  const transitions = asArray(demo.transitions)
  const screenLines = screens.slice(0, sourceType === 'project-knowledge-flow' ? 18 : 8).map((screen, index) => {
    const screenshot = screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl || ''
    const hotspots = asArray(screen.hotspots || screen.actions)
      .map((item) => [item.label || item.action || item.event || item.id, item.targetScreenId || item.to || item.target].filter(Boolean).join(' -> '))
      .filter(Boolean)
      .slice(0, 8)
      .join('；')
    return [
      `${index + 1}. ${screen.title || screen.pageName || screen.id || '页面'}`,
      screen.route || screen.path ? `路径：${screen.route || screen.path}` : '',
      screenshot ? `截图：${screenshot}` : '',
      hotspots ? `热区：${hotspots}` : ''
    ].filter(Boolean).join('；')
  })
  const transitionLines = transitions.slice(0, 18).map((item) =>
    [item.from, item.label || item.event, item.to].filter(Boolean).join(' -> ')
  )
  const label = sourceType === 'project-knowledge-flow' ? '流程图' : '交互 Demo'
  const content = [
    `项目：${project.name || project.title || ''}`,
    `${label}：${asset.title || demo.title || ''}`,
    screenLines.length ? `页面/状态：\n${screenLines.join('\n')}` : '',
    transitionLines.length ? `跳转链路：\n${transitionLines.join('\n')}` : ''
  ].filter(Boolean).join('\n')
  return {
    id: `${sourceType}-${asset.id || 'prototype'}`,
    name: `知识库：${label} · ${asset.title || demo.title || '项目原型'}`,
    type: 'knowledge',
    sourceType,
    content: compactText(content, sourceType === 'project-knowledge-flow' ? 3600 : 2600),
    text: compactText(content, sourceType === 'project-knowledge-flow' ? 3600 : 2600),
    status: '已读取',
    knowledgeMaterialId: asset.id || ''
  }
}

function renderMarkdownDocument(project = {}, blueprintAsset = null, materials = []) {
  const blueprint = blueprintAsset?.blueprint || null
  const material = asArray(materials)
    .filter((item) => item?.category === 'markdown-blueprint' && item.content)
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || '') - Date.parse(left.updatedAt || left.createdAt || ''))[0]
  const markdown = blueprint ? exportBlueprintMarkdown(blueprint) : material?.content || ''
  if (!markdown) return null
  return {
    id: `project-knowledge-markdown-${blueprintAsset?.id || material?.id || 'markdown'}`,
    name: `知识库：Markdown · ${blueprint?.title || material?.title || project.name || '项目文档'}`,
    type: 'knowledge',
    sourceType: 'project-knowledge-markdown',
    content: compactText(markdown, 3600),
    text: compactText(markdown, 3600),
    status: '已读取',
    knowledgeMaterialId: blueprintAsset?.id || material?.id || ''
  }
}

export function buildProjectKnowledgeContextDocuments({ project = {}, assets = [], materials = [], query = '', limit = 8 } = {}) {
  const projectId = project.id || ''
  const scopedAssets = projectId ? asArray(assets).filter((asset) => !asset.projectId || asset.projectId === projectId) : asArray(assets)
  const scopedMaterials = projectId ? asArray(materials).filter((item) => !item.projectId || item.projectId === projectId) : asArray(materials)
  const blueprintAsset = selectProjectBlueprintAsset(scopedAssets, project)
  const flowAsset = selectProjectPrototypeDemoAsset(scopedAssets, project, blueprintAsset, 'flow')
  const prototypeAsset = selectProjectPrototypeDemoAsset(scopedAssets, project, blueprintAsset, 'prototype')
  const docs = [
    renderBlueprintFrameworkDocument(project, blueprintAsset),
    renderPrototypeDocument(project, flowAsset, 'project-knowledge-flow'),
    renderPrototypeDocument(project, prototypeAsset, 'project-knowledge-prototype'),
    renderMarkdownDocument(project, blueprintAsset, scopedMaterials)
  ].filter((item) => item?.content)
  const queryTokens = tokenize(query)
  return docs
    .map((doc) => {
      const haystack = `${doc.name}\n${doc.content}`.toLowerCase()
      const score = queryTokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0)
      return { doc, score }
    })
    .sort((left, right) => right.score - left.score)
    .map(({ doc }) => doc)
    .slice(0, Math.max(1, Number(limit) || 8))
}

export function buildProjectVisualContext({ project = {}, assets = [], materials = [], nodeTitle = '', limit = 6 } = {}) {
  const blueprintAsset = selectProjectBlueprintAsset(assets, project)
  const prototypeAsset = selectProjectPrototypeDemoAsset(assets, project, blueprintAsset, 'prototype')
  const demo = prototypeDemo(prototypeAsset)
  const normalizedTitle = String(nodeTitle || '').toLowerCase().replace(/\s+/g, '')
  const pages = asArray(demo?.screens)
    .filter((screen) => screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl)
    .map((screen) => {
      const title = screen.title || screen.pageName || screen.id || ''
      const score = normalizedTitle && title.toLowerCase().replace(/\s+/g, '').includes(normalizedTitle) ? 2 : 1
      return {
        id: screen.id || '',
        title,
        screenshotUrl: screen.screenshotUrl || screen.captureUrl || screen.imageUrl || screen.coverUrl || '',
        viewport: screen.viewport || null,
        visualRect: screen.visualRect || screen.highlightRect || null,
        components: asArray(screen.components).map((item) => item.label || item.name || item.type || item).filter(Boolean).slice(0, 8),
        score
      }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ score, ...page }) => page)
  const notes = buildProjectKnowledgeContextDocuments({ project, assets, materials, query: nodeTitle, limit: 4 })
    .map((item) => `${item.name}：${item.content}`.slice(0, 500))
  if (!pages.length && !notes.length) return null
  return {
    source: 'project-knowledge',
    pages,
    notes
  }
}
