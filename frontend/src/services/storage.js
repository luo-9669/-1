const STORAGE_KEY = 'liuchengtong-state-v2'
const COMPRESSED_PREVIEW_HTML = '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>预览内容已压缩</title></head><body><main style="font-family:PingFang SC,Microsoft YaHei,Arial,sans-serif;padding:24px;color:#222529;"><h1 style="font-size:20px;">预览内容已压缩</h1><p style="color:#7f8792;line-height:1.7;">本地存储空间不足时，系统会移除大体积截图和源码缓存。请重新打开源码生成或重新采集页面。</p></main></body></html>'

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('Failed to read local state', error)
    return null
  }
}

function stripLargeCaptureFields(captureResult) {
  if (!captureResult || typeof captureResult !== 'object') return captureResult
  return {
    ...captureResult,
    screenshot: null,
    singleFileHtml: '',
    domSnapshot: null,
    layoutNodes: Array.isArray(captureResult.layoutNodes)
      ? captureResult.layoutNodes.map((node) => ({
          ...node,
          src: typeof node.src === 'string' && node.src.startsWith('data:') ? '' : node.src,
          svg: '',
          style: node.style ? { ...node.style } : node.style
        }))
      : captureResult.layoutNodes,
    designTree: null,
    websnap: captureResult.websnap
      ? {
          ...captureResult.websnap,
          pages: Array.isArray(captureResult.websnap.pages)
            ? captureResult.websnap.pages.map((page) => ({
                ...page,
                screenshot: null,
                html: undefined
              }))
            : captureResult.websnap.pages
        }
      : captureResult.websnap
  }
}

function stripLargeRestoredPageFields(page) {
  if (!page || typeof page !== 'object') return page
  return {
    ...page,
    coverImage: null,
    html: page.html && String(page.html).length > 800 ? COMPRESSED_PREVIEW_HTML : page.html,
    files: Array.isArray(page.files)
      ? page.files.map((file) => ({
          ...file,
          content: typeof file.content === 'string' && (file.content.includes('data:image') || file.content.length > 120000) ? '' : file.content
        }))
      : page.files
  }
}

function stripLargeDesignSourceFields(source) {
  if (!source || typeof source !== 'object') return source
  return {
    ...source,
    coverImage: null,
    pages: Array.isArray(source.pages)
      ? source.pages.map((page) => ({
          ...page,
          screenshot: null
        }))
      : source.pages
  }
}

function stripLargeAssetFields(asset) {
  if (!asset || typeof asset !== 'object') return asset
  return {
    ...asset,
    content: asset.type === 'web-snapshot' ? '' : asset.content,
    designSource: stripLargeDesignSourceFields(asset.designSource)
  }
}

function stripLargeMaterialFields(item) {
  if (!item || typeof item !== 'object') return item
  return {
    ...item,
    content: typeof item.content === 'string' && item.content.length > 20000 ? '' : item.content,
    raw: undefined
  }
}

function stripLargeWorkflowRunFields(run) {
  if (!run || typeof run !== 'object') return run
  return {
    ...run,
    input: typeof run.input === 'string' && run.input.length > 20000 ? run.input.slice(0, 20000) : run.input,
    projectBlueprint: run.projectBlueprint
      ? {
          ...run.projectBlueprint,
          profile: run.projectBlueprint.profile
            ? {
                ...run.projectBlueprint.profile,
                sourceSummary: ''
              }
            : run.projectBlueprint.profile
        }
      : run.projectBlueprint,
    documentAnalysis: null,
    referenceFiles: run.referenceFiles && typeof run.referenceFiles === 'object'
      ? Object.fromEntries(Object.entries(run.referenceFiles).map(([key, files]) => [
          key,
          Array.isArray(files)
            ? files.map((file) => ({
                ...file,
                text: '',
                content: '',
                summary: file.summary || ''
              }))
            : files
        ]))
      : run.referenceFiles
  }
}

export function compactWorkspaceStateForStorage(state) {
  return {
    ...state,
    activeWorkflowRun: stripLargeWorkflowRunFields(state.activeWorkflowRun),
    workflowRuns: Array.isArray(state.workflowRuns)
      ? state.workflowRuns.map(stripLargeWorkflowRunFields)
      : state.workflowRuns,
    captureResult: stripLargeCaptureFields(state.captureResult),
    restoredPages: Array.isArray(state.restoredPages)
      ? state.restoredPages.map(stripLargeRestoredPageFields)
      : state.restoredPages,
    requirements: Array.isArray(state.requirements)
      ? state.requirements.map(stripLargeMaterialFields)
      : state.requirements,
    materials: Array.isArray(state.materials)
      ? state.materials.map(stripLargeMaterialFields)
      : state.materials,
    assets: Array.isArray(state.assets)
      ? state.assets.map(stripLargeAssetFields)
      : state.assets,
    designSources: Array.isArray(state.designSources)
      ? state.designSources.map(stripLargeDesignSourceFields)
      : state.designSources
  }
}

function emergencyCompactWorkspaceStateForStorage(state) {
  const compact = compactWorkspaceStateForStorage(state)
  return {
    ...compact,
    activeWorkflowRun: stripLargeWorkflowRunFields(compact.activeWorkflowRun),
    workflowRuns: Array.isArray(compact.workflowRuns)
      ? compact.workflowRuns.map(stripLargeWorkflowRunFields)
      : compact.workflowRuns,
    requirements: Array.isArray(compact.requirements)
      ? compact.requirements.map(stripLargeMaterialFields)
      : compact.requirements,
    materials: Array.isArray(compact.materials)
      ? compact.materials.map(stripLargeMaterialFields)
      : compact.materials,
    generatedPageHtml: typeof compact.generatedPageHtml === 'string' && compact.generatedPageHtml.length > 120000
      ? COMPRESSED_PREVIEW_HTML
      : compact.generatedPageHtml,
    reactFiles: Array.isArray(compact.reactFiles)
      ? compact.reactFiles.map((file) => ({
          ...file,
          content: typeof file.content === 'string' && file.content.length > 120000 ? '' : file.content
        }))
      : compact.reactFiles
  }
}

export function saveState(state) {
  const safeState = compactWorkspaceStateForStorage(state)
  const safeSetItem = (value, { clearFirst = false } = {}) => {
    if (clearFirst && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(STORAGE_KEY)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }
  try {
    safeSetItem(safeState)
  } catch (error) {
    try {
      const compactState = compactWorkspaceStateForStorage(state)
      safeSetItem(compactState, { clearFirst: true })
      console.warn('Workspace state was compacted before saving', error)
    } catch (compactError) {
      try {
        const emergencyState = emergencyCompactWorkspaceStateForStorage(state)
        safeSetItem(emergencyState, { clearFirst: true })
        console.warn('Workspace state was heavily compacted before saving', compactError)
      } catch (emergencyError) {
        // Ignore exhausted browser storage after all compaction attempts; runtime state and backend persistence remain usable.
      }
    }
  }
}
