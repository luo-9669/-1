export function buildCompetitorOverviewCards(overview = {}) {
  const metrics = overview.metrics || {}
  return [
    { key: 'activeCompetitors', label: '监控竞品数', value: metrics.activeCompetitors || 0 },
    { key: 'weeklyChanges', label: '本周变化数', value: metrics.weeklyChanges || 0 },
    { key: 'highSeverityChanges', label: '高优先级变化', value: metrics.highSeverityChanges || 0 },
    { key: 'pendingAnalyses', label: '待处理分析', value: metrics.pendingAnalyses || 0 }
  ]
}

export function buildCompetitorWorkspaceSummary(competitors = []) {
  return competitors.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    title: item.name,
    meta: item.websiteUrl,
    status: item.status === 'active' ? '监控中' : '待监控',
    notes: item.notes || ''
  }))
}

export function severityLabel(severity = '') {
  if (severity === 'high') return '高优先级'
  if (severity === 'low') return '低优先级'
  if (severity === 'medium') return '中优先级'
  if (!severity) return '待确认优先级'
  return '待确认优先级'
}

export function changeStatusLabel(status = '') {
  if (status === 'ready') return '已就绪'
  if (status === 'analyzing') return '分析中'
  if (status === 'failed') return '失败'
  return '待检测'
}

export function changeTypeLabel(type = '') {
  if (type === 'homepage-copy') return '首页文案'
  if (type === 'visual-update') return '视觉变化'
  if (type === 'pricing-update') return '价格变化'
  if (type === 'cta-update') return '转化入口'
  if (type === 'monitor-failed') return '检测失败'
  return '内容变化'
}

export function userFacingChangeSummary(change = {}) {
  const raw = String(change.changeSummary || change.diffText || '').trim()
  const unsafePattern = new RegExp([
    'COMPETITOR',
    ['Change', 'Detail'].join('\\s+'),
    ['Report', 'Draft'].join('\\s+'),
    'content-update',
    'monitor-failed',
    'monitor-scheduler-ran',
    'runDueMonitorTasks',
    'scheduler/run-due',
    'backoffSeconds',
    'worker',
    'payload',
    'stack',
    'debug',
    'prompt',
    'tokens?',
    'provider-timeout',
    '调试',
    '模型：'
  ].join('|'), 'i')
  if (!raw || unsafePattern.test(raw)) {
    return change.changeType === 'monitor-failed'
      ? '本次检测未完成，请按失败原因处理。'
      : '本次检测已记录变化摘要。'
  }
  return raw
}

export function taskStatusDisplayLabel(status = '') {
  if (status === 'succeeded') return '检测完成'
  if (status === 'running') return '检测中'
  if (status === 'failed') return '检测失败'
  if (status === 'paused') return '已暂停'
  if (status === 'active') return '监控中'
  return '待检测'
}

export function failureTypeLabel(type = '') {
  if (type === 'network') return '页面访问异常'
  if (type === 'login-required') return '需要访问授权'
  if (type === 'blocked') return '访问受到限制'
  if (type === 'timeout') return '页面响应超时'
  if (type === 'analysis') return '分析暂未完成'
  return '检测未完成'
}

export function recoverySuggestionLabel(task = {}) {
  return task?.recoverySuggestion || '请稍后重试；如果连续失败，请检查监控地址是否仍可访问。'
}

export function frequencyDisplayLabel(frequency = '') {
  if (frequency === 'daily') return '每天'
  if (frequency === 'weekly') return '每周'
  if (frequency === 'monthly') return '每月'
  return '未设置'
}

export function reportStatusLabel(status = '') {
  if (status === 'ready') return '已生成'
  if (status === 'archived') return '已归档'
  return '草稿'
}

export function insightCategoryLabel(category = '') {
  if (category === 'ux') return '体验建议'
  if (category === 'ui') return '视觉趋势'
  if (category === 'risk') return '风险提醒'
  if (category === 'strategy') return '商业策略'
  if (category === 'product') return '产品机会'
  return '待确认分类'
}

export function reportTagLabel(tag = '') {
  const labels = {
    'homepage-copy': '官网首页文案',
    'visual-update': '视觉变化',
    'pricing-update': '价格变化',
    'cta-update': '转化入口',
    'model-analysis': '智能分析',
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
    product: '产品机会',
    ux: '体验建议',
    ui: '视觉趋势',
    risk: '风险提醒',
    strategy: '商业策略'
  }
  const normalized = String(tag || '').trim()
  return labels[normalized] || (normalized ? '补充标签' : '')
}

export function safeReportTagLabels(tags = []) {
  const labels = Array.isArray(tags) ? tags.map(reportTagLabel).filter(Boolean) : []
  return [...new Set(labels)]
}

export function safeInsightEvidenceItems(insight = {}) {
  const unsafePattern = /https?:\/\/|COMPETITOR|content-update|monitor-failed|worker|payload|stack|debug|prompt|tokens?|provider-timeout|sourceUrl|sourceChangeId|diffText|textContent|raw|调试|模型：/i
  const items = Array.isArray(insight?.evidence) ? insight.evidence : []
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => unsafePattern.test(item) ? '已保留为安全证据，可在报告或变化记录中复盘。' : item)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3)
}

export function buildReportHighlights(report = {}) {
  const safeTags = safeReportTagLabels(report.tags)
  const tagSummary = safeTags.length ? safeTags.join(' / ') : ''
  return [
    report.summary,
    report.recommendation,
    tagSummary
  ].filter(Boolean).slice(0, 3)
}

export function buildTaskSearchText(task = {}) {
  return [
    task.competitorName,
    task.url,
    task.pageType,
    frequencyDisplayLabel(task.frequency),
    taskStatusDisplayLabel(task.status),
    failureTypeLabel(task.failureType),
    task.recoverySuggestion
  ].filter(Boolean).join(' ')
}

export function buildReportSearchText(report = {}) {
  return [
    report.title,
    report.summary,
    report.recommendation,
    report.factualObservation,
    reportStatusLabel(report.status),
    severityLabel(report.severity),
    ...safeReportTagLabels(report.tags)
  ].filter(Boolean).join(' ')
}

export function buildInsightSearchText(insight = {}) {
  return [
    insight.title,
    insight.summary,
    insight.recommendation,
    insight.note,
    insightCategoryLabel(insight.category),
    severityLabel(insight.priority),
    ...safeReportTagLabels(insight.tags)
  ].filter(Boolean).join(' ')
}

export function buildUiReferenceSummary(references = {}) {
  const screenshots = Array.isArray(references.screenshots) ? references.screenshots : []
  const components = Array.isArray(references.components) ? references.components : []
  const visualTags = Array.isArray(references.visualTags) ? references.visualTags : []
  return [
    { key: 'screenshots', label: '截图参考', value: screenshots.length, description: '来自已完成检测的页面截图' },
    { key: 'components', label: '组件参考', value: components.length, description: '从变化与洞察中识别的组件线索' },
    { key: 'visualTags', label: '视觉标签', value: visualTags.length, description: '可用于设计检索的视觉特征' }
  ]
}

export function buildUiReferenceList(references = {}) {
  const screenshots = Array.isArray(references.screenshots) ? references.screenshots : []
  const components = Array.isArray(references.components) ? references.components : []
  const visualTags = Array.isArray(references.visualTags) ? references.visualTags : []
  return [
    ...screenshots.map((item) => ({
      ...item,
      type: 'screenshot',
      typeLabel: '截图参考',
      title: item.title || '页面截图',
      summary: item.summary || '来自已完成检测的页面截图'
    })),
    ...components.map((item) => ({
      ...item,
      type: 'component',
      typeLabel: '组件参考',
      title: item.name || '组件线索',
      summary: item.summary || '来自竞品变化和洞察的组件线索'
    })),
    ...visualTags.map((item) => ({
      ...item,
      type: 'visual-tag',
      typeLabel: '视觉标签',
      title: item.name || '视觉标签',
      summary: item.summary || '来自竞品变化和洞察的视觉特征'
    }))
  ]
}

export function sortChangesByDetectedAt(changes = []) {
  return [...changes].sort((a, b) => new Date(b.detectedAt || 0) - new Date(a.detectedAt || 0))
}
