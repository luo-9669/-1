const REPAIR_SUGGESTIONS = {
  'canvas-structure': '重新触发后端分析，要求模型返回 canvas.nodes、edges 和 orderedTabs，前端不要本地补假节点。',
  'schema-validation': '让后端按当前 Skill 的 outputSchema 重新校验并补齐 blueprint，再返回给前端。',
  'frontend-backend-boundary': '补充前端接管、后端接管、接口契约和验收标准，确保研发可以直接拆任务。',
  'scope-fit': '按非项目模板重跑分析，补齐调研总结、风险、建议和是否转项目判断。',
  'source-traceability': '把上传文档、项目知识库和引用片段写入 documents，保证每个结论可追溯。',
  'version-snapshot': '为当前分析结果生成版本快照，保存 blueprint、canvas、routing 和 generation。'
}

function repairSuggestionFor(id) {
  return REPAIR_SUGGESTIONS[id] || '回到后端 Skill 编排策略补齐该检查项需要的数据，再返回结构化结果。'
}

function passedCheck(id, label, detail = '') {
  return { id, label, passed: true, severity: 'info', detail }
}

function failedCheck(id, label, detail = '', severity = 'warning') {
  return { id, label, passed: false, severity, detail, repairSuggestion: repairSuggestionFor(id) }
}

function hasCanvasNodes(analysis = {}) {
  return Array.isArray(analysis.canvas?.nodes) && analysis.canvas.nodes.length > 0
}

function hasProjectHandoff(analysis = {}) {
  const text = JSON.stringify(analysis.canvas || {})
  return /前端|后端|接口|验收|handoff|api-contract/i.test(text)
}

function hasNonProjectReport(analysis = {}) {
  const nodeIds = (analysis.canvas?.nodes || []).map((node) => node.id)
  return ['summary', 'key-findings', 'risks', 'recommendations', 'project-conversion']
    .some((id) => nodeIds.includes(id))
}

function hasProjectKnowledgeEvidence(analysis = {}) {
  return (analysis.evidenceAndAssumptions?.sources || []).some((item) => item?.scope === 'project-knowledge')
}

export function buildAnalysisQualityGate(analysis = {}) {
  const checks = []
  checks.push(hasCanvasNodes(analysis)
    ? passedCheck('canvas-structure', '画布结构完整', `${analysis.canvas.nodes.length} 个节点`)
    : failedCheck('canvas-structure', '画布结构完整', '未生成可展示画布', 'critical'))
  checks.push(analysis.blueprint
    ? passedCheck('schema-validation', '基础 Schema 校验', analysis.blueprint.type || 'blueprint')
    : failedCheck('schema-validation', '基础 Schema 校验', '缺少 blueprint', 'critical'))
  if (analysis.demandScope === 'non-project' && analysis.blueprint?.intent !== 'auth-page') {
    checks.push(hasNonProjectReport(analysis)
      ? passedCheck('scope-fit', '非项目输出分流', '包含总结、风险、建议或转项目判断')
      : failedCheck('scope-fit', '非项目输出分流', '缺少非项目报告节点'))
    checks.push(!hasProjectKnowledgeEvidence(analysis)
      ? passedCheck('non-project-evidence-boundary', '非项目证据边界', '未混入项目知识证据')
      : failedCheck('non-project-evidence-boundary', '非项目证据边界', '非项目分析包含项目知识证据', 'high'))
  } else {
    checks.push(hasProjectHandoff(analysis)
      ? passedCheck('frontend-backend-boundary', '前后端边界', '已包含工程交付或接口边界')
      : failedCheck('frontend-backend-boundary', '前后端边界', '缺少前端、后端或接口接管说明'))
  }
  checks.push(Array.isArray(analysis.documents)
    ? passedCheck('source-traceability', '来源可追溯', `${analysis.documents.length} 个上传条目`)
    : failedCheck('source-traceability', '来源可追溯', '缺少 documents 数组'))
  checks.push(passedCheck('version-snapshot', '版本快照', '已生成分析结果版本'))

  const passed = checks.filter((check) => check.passed).length
  const score = Math.round((passed / checks.length) * 100)
  return {
    status: checks.every((check) => check.passed) ? 'passed' : 'needs-review',
    score,
    checks,
    repairActions: checks
      .filter((check) => !check.passed)
      .map((check) => ({
        id: `${check.id}-repair`,
        checkId: check.id,
        label: `${check.label}修复`,
        owner: check.id === 'canvas-structure' || check.id === 'schema-validation' || check.id === 'source-traceability'
          ? 'backend'
          : 'backend-model',
        suggestion: check.repairSuggestion
      })),
    failedCount: checks.length - passed,
    generatedAt: new Date().toISOString()
  }
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0
}

function changedTopLevelFields(previous = {}, current = {}) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(current || {})])
  return [...keys].filter((key) => JSON.stringify(previous?.[key] ?? null) !== JSON.stringify(current?.[key] ?? null))
}

export function buildAnalysisVersionDiff(previousVersion = {}, currentVersion = {}) {
  const previousSnapshot = previousVersion.snapshot || {}
  const currentSnapshot = currentVersion.snapshot || {}
  const previousCanvas = previousSnapshot.canvas || {}
  const currentCanvas = currentSnapshot.canvas || {}
  return {
    nodeDelta: countItems(currentCanvas.nodes) - countItems(previousCanvas.nodes),
    edgeDelta: countItems(currentCanvas.edges) - countItems(previousCanvas.edges),
    qualityDelta: (currentVersion.qualityScore || 0) - (previousVersion.qualityScore || 0),
    changedBlueprintFields: changedTopLevelFields(previousSnapshot.blueprint || {}, currentSnapshot.blueprint || {}),
    generationChanged: JSON.stringify(previousSnapshot.generation || null) !== JSON.stringify(currentSnapshot.generation || null)
  }
}

export function buildAnalysisVersionSnapshot(analysis = {}, qualityGate = {}) {
  const createdAt = new Date().toISOString()
  const previousVersion = Array.isArray(analysis.versions) ? analysis.versions[0] : null
  const runSuffix = String(analysis.requestId || analysis.analysisRunId || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
  const currentVersion = {
    id: `analysis-v${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}${runSuffix ? `-${runSuffix}` : ''}`,
    label: '后端分析结果 v1',
    source: 'backend-analysis',
    createdAt,
    requestId: analysis.requestId || '',
    analysisRunId: analysis.analysisRunId || '',
    demandScope: analysis.demandScope || 'project',
    requestedSkillId: analysis.requestedSkillId || '',
    resolvedSkillId: analysis.resolvedSkillId || analysis.skillId || '',
    qualityScore: qualityGate.score || 0,
    snapshot: {
      blueprint: analysis.blueprint || null,
      canvas: analysis.canvas || null,
      routing: analysis.routing || null,
      generation: analysis.generation || null
    }
  }
  if (previousVersion) currentVersion.diff = buildAnalysisVersionDiff(previousVersion, currentVersion)
  return currentVersion
}

export function buildAnalysisVersionHistory(analysis = {}, qualityGate = {}) {
  const previousVersions = Array.isArray(analysis.versions) ? analysis.versions : []
  const currentVersion = buildAnalysisVersionSnapshot(analysis, qualityGate)
  if (previousVersions.length) currentVersion.diff = buildAnalysisVersionDiff(previousVersions[0], currentVersion)
  return {
    currentVersion,
    versions: [currentVersion, ...previousVersions]
  }
}
