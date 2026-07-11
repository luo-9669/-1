import { randomUUID } from 'node:crypto'
import {
  addCompetitor,
  updateCompetitor as updateWorkspaceCompetitor,
  deleteCompetitor as deleteWorkspaceCompetitor,
  getCompetitor,
  addMonitorTask,
  listCompetitors,
  listMonitorTasks,
  addPageSnapshot,
  listPageSnapshots,
  addChangeRecord,
  listChangeRecords,
  getChangeRecord,
  addAiAnalysis,
  getAiAnalysisByChangeId,
  addCompetitorInsight,
  listCompetitorInsights,
  addCompetitorReport,
  listCompetitorReports,
  addCompetitorAuditLog,
  listCompetitorAuditLogs,
  addMaterial,
  deleteMaterial,
  listMaterials
} from './workspace-store.js'
import {
  createWorkspaceCompetitor,
  createWorkspaceMonitorTask,
  createWorkspacePageSnapshot,
  createWorkspaceChangeRecord,
  createWorkspaceAiAnalysis,
  createWorkspaceCompetitorInsight,
  createWorkspaceCompetitorReport
} from '../models/workspace.js'

const PYTHON_DEFAULT_COMPETITORS = [
  {
    name: '创客贴',
    websiteUrl: 'https://www.chuangkit.com',
    notes: '国内领先的在线设计平台，提供海报、PPT、视频等设计工具'
  },
  {
    name: '稿定设计',
    websiteUrl: 'https://www.gaoding.com',
    notes: '在线设计工具，专注商业设计的数字化解决方案'
  },
  {
    name: 'HeyGen',
    websiteUrl: 'https://www.heygen.com',
    notes: 'AI数字人视频生成平台，提供数字人、视频翻译等功能'
  },
  {
    name: 'Higgsfield AI',
    websiteUrl: 'https://www.higgsfield.ai',
    notes: 'AI视频生成平台，专注于短视频创作'
  },
  {
    name: 'Riverside',
    websiteUrl: 'https://riverside.fm',
    notes: '在线播客和视频会议录制平台，提供高质量音视频录制'
  }
]

function validationError(message = '') {
  const error = new Error(message)
  error.code = 'COMPETITOR_INPUT_INVALID'
  return error
}

function normalizedCompetitorName(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizedCompetitorUrl(value = '') {
  try {
    const parsed = new URL(String(value || '').trim())
    parsed.hash = ''
    parsed.search = ''
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    return parsed.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return String(value || '').trim().replace(/\/+$/, '').toLowerCase()
  }
}

function defaultCompetitorId(projectId = '', name = '') {
  return `competitor-default-${projectId}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function defaultCompetitorAlreadyExists(competitors = [], defaultCompetitor = {}) {
  const defaultName = normalizedCompetitorName(defaultCompetitor.name)
  const defaultUrl = normalizedCompetitorUrl(defaultCompetitor.websiteUrl)
  return competitors.some((item) =>
    normalizedCompetitorName(item.name) === defaultName ||
    normalizedCompetitorUrl(item.websiteUrl) === defaultUrl
  )
}

function isPythonDefaultCompetitor(competitor = {}) {
  return Array.isArray(competitor.tags) && competitor.tags.includes('python-default')
}

function competitorVisibleDedupeKey(competitor = {}) {
  return normalizedCompetitorName(competitor.name) ||
    normalizedCompetitorUrl(competitor.websiteUrl) ||
    competitor.id ||
    ''
}

function competitorVisibleRank(competitor = {}) {
  const manualScore = isPythonDefaultCompetitor(competitor) ? 0 : 1000000000000000
  const timestamp = new Date(competitor.updatedAt || competitor.createdAt || 0).getTime()
  return manualScore + (Number.isFinite(timestamp) ? timestamp : 0)
}

function dedupeVisibleCompetitors(competitors = []) {
  const selectedByKey = new Map()
  for (const competitor of competitors) {
    const key = competitorVisibleDedupeKey(competitor)
    if (!key) continue
    const selected = selectedByKey.get(key)
    if (!selected || competitorVisibleRank(competitor) > competitorVisibleRank(selected)) {
      selectedByKey.set(key, competitor)
    }
  }
  const selectedIds = new Set([...selectedByKey.values()].map((item) => item.id))
  return competitors.filter((item) => selectedIds.has(item.id))
}

function taskStatusError(message = '') {
  const error = new Error(message)
  error.code = 'COMPETITOR_TASK_STATUS_INVALID'
  return error
}

function taskFrequencyError(message = '') {
  const error = new Error(message)
  error.code = 'COMPETITOR_TASK_FREQUENCY_INVALID'
  return error
}

function taskNotificationError(message = '') {
  const error = new Error(message)
  error.code = 'COMPETITOR_TASK_NOTIFICATION_INVALID'
  return error
}

function normalizeCompetitorInput(payload = {}) {
  const projectId = `${payload.projectId || ''}`.trim()
  const name = `${payload.name || ''}`.trim()
  const websiteUrl = `${payload.websiteUrl || ''}`.trim()
  if (!projectId) throw validationError('请先选择项目')
  if (!name) throw validationError('请填写竞品名称')
  try {
    const parsed = new URL(websiteUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw validationError('请输入有效的 http 或 https 官网 URL')
    }
  } catch (error) {
    if (error.code === 'COMPETITOR_INPUT_INVALID') throw error
    throw validationError('请输入有效的 http 或 https 官网 URL')
  }
  return {
    ...payload,
    projectId,
    name,
    websiteUrl
  }
}

function normalizeMonitorTaskInput(payload = {}, store) {
  const projectId = `${payload.projectId || ''}`.trim()
  const competitorId = `${payload.competitorId || ''}`.trim()
  const url = `${payload.url || ''}`.trim()
  const pageType = `${payload.pageType || 'Homepage'}`.trim()
  const frequency = `${payload.frequency || 'weekly'}`.trim()
  if (!projectId) throw validationError('请先选择项目')
  if (!competitorId) throw validationError('请选择要监控的竞品')
  const competitor = getCompetitor(store, competitorId)
  if (!competitor || competitor.projectId !== projectId) throw validationError('请选择当前项目下的竞品')
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw validationError('请输入有效的 http 或 https 监控页面 URL')
    }
  } catch (error) {
    if (error.code === 'COMPETITOR_INPUT_INVALID') throw error
    throw validationError('请输入有效的 http 或 https 监控页面 URL')
  }
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
    throw taskFrequencyError('当前只支持每天、每周或每月监控频率')
  }
  return {
    ...payload,
    projectId,
    competitorId,
    url,
    pageType: pageType || 'Homepage',
    frequency
  }
}

function nextRunAtForFrequency(baseTime = '', frequency = '') {
  const date = new Date(baseTime)
  if (Number.isNaN(date.getTime())) return ''
  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + 1)
  else if (frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1)
  else date.setUTCDate(date.getUTCDate() + 7)
  return date.toISOString()
}

async function ensurePythonDefaultCompetitors(store, projectId = '', now = () => new Date().toISOString()) {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) return
  const existing = listCompetitors(store, { projectId: normalizedProjectId, includeDeleted: true })
  for (const defaultCompetitor of PYTHON_DEFAULT_COMPETITORS) {
    if (defaultCompetitorAlreadyExists(existing, defaultCompetitor)) continue
    const timestamp = now()
    const competitor = await addCompetitor(store, createWorkspaceCompetitor({
      id: defaultCompetitorId(normalizedProjectId, defaultCompetitor.name),
      projectId: normalizedProjectId,
      name: defaultCompetitor.name,
      websiteUrl: defaultCompetitor.websiteUrl,
      notes: defaultCompetitor.notes,
      tags: ['python-default'],
      createdAt: timestamp,
      updatedAt: timestamp
    }))
    existing.push(competitor)
    if (!listMonitorTasks(store, { projectId: normalizedProjectId, competitorId: competitor.id }).length) {
      await addMonitorTask(store, createWorkspaceMonitorTask({
        projectId: normalizedProjectId,
        competitorId: competitor.id,
        url: competitor.websiteUrl,
        pageType: 'Homepage',
        nextRunAt: nextRunAtForFrequency(timestamp, 'weekly'),
        createdAt: timestamp,
        updatedAt: timestamp
      }))
    }
  }
}

function frequencyAuditLabel(frequency = '') {
  if (frequency === 'daily') return '每天'
  if (frequency === 'monthly') return '每月'
  return '每周'
}

function reportStatusDisplayLabel(status = '') {
  if (status === 'ready') return '已生成'
  if (status === 'archived') return '已归档'
  return '草稿'
}

function insightCategoryDisplayLabel(category = '') {
  if (category === 'ux') return '体验建议'
  if (category === 'ui') return '视觉趋势'
  if (category === 'risk') return '风险提醒'
  if (category === 'strategy') return '商业策略'
  if (category === 'product') return '产品机会'
  return '待确认分类'
}

function priorityDisplayLabel(priority = '') {
  if (priority === 'high') return '高优先级'
  if (priority === 'low') return '低优先级'
  if (priority === 'medium') return '中优先级'
  return '待确认优先级'
}

function pageTypeDisplayLabel(pageType = '') {
  if (pageType === 'Homepage') return '官网首页'
  return pageType || '监控页面'
}

function auditActionDisplayLabel(action = '') {
  const labels = {
    'competitor-created': '添加竞品',
    'competitor-updated': '更新竞品',
    'competitor-deleted': '删除竞品',
    'competitor-check-ran': '完成检测',
    'competitor-check-failed': '检测失败',
    'monitor-scheduler-ran': '执行调度',
    'monitor-task-created': '新建监控任务',
    'monitor-task-status-updated': '调整监控状态',
    'monitor-task-frequency-updated': '调整监控频率',
    'monitor-task-notification-updated': '调整通知设置',
    'report-saved': '保存报告',
    'report-exported': '导出报告',
    'report-shared': '分享报告',
    'report-share-revoked': '撤销分享',
    'report-shared-accessed': '公开访问',
    'ui-reference-favorited': '收藏参考',
    'ui-reference-unfavorited': '取消收藏',
    'insight-saved': '保存洞察',
    'insight-updated': '整理洞察',
    'insights-batch-updated': '批量整理洞察',
    'insight-exported': '导出洞察',
    'insights-batch-exported': '批量导出洞察',
    'insight-requirements-linked': '关联需求',
    'insight-knowledge-deposited': '沉淀知识',
    'insights-batch-knowledge-deposited': '批量沉淀知识'
  }
  return labels[action] || '竞品监控操作'
}

function safeUserFacingSummary(value = '', fallback = '本次检测已记录变化摘要。') {
  const raw = String(value || '').trim()
  const unsafePattern = /COMPETITOR|content-update|monitor-failed|monitor-scheduler-ran|runDueMonitorTasks|scheduler\/run-due|backoffSeconds|worker|payload|stack|debug|prompt|tokens?|provider-timeout|调试|模型：/i
  return raw && !unsafePattern.test(raw) ? raw : fallback
}

function appendTaskFailureHistory(task = {}, entry = {}) {
  const history = Array.isArray(task.failureHistory) ? task.failureHistory : []
  return [
    {
      message: entry.message || '竞品检测失败',
      failureType: entry.failureType || 'unknown',
      recoverySuggestion: entry.recoverySuggestion || '请稍后重试；如果连续失败，请检查监控地址是否仍可访问。',
      failedAt: entry.failedAt || '',
      status: 'failed'
    },
    ...history
  ].slice(0, 10)
}

function appendTaskRunHistory(task = {}, entry = {}) {
  const history = Array.isArray(task.runHistory) ? task.runHistory : []
  return [
    {
      status: entry.status || 'failed',
      runAt: entry.runAt || '',
      changeId: entry.changeId || '',
      snapshotId: entry.snapshotId || '',
      failureType: entry.failureType || '',
      recoverySuggestion: entry.recoverySuggestion || ''
    },
    ...history
  ].slice(0, 20)
}

function emptyRetrySummary() {
  return { failureCount: 0, nextRetryAt: '', backoffSeconds: 0, failureType: '', recoverySuggestion: '' }
}

function retryBackoffSeconds(failureCount = 0) {
  if (failureCount <= 1) return 300
  if (failureCount === 2) return 900
  return 1800
}

function nextRetryAt(runAt = '', backoffSeconds = 0) {
  const date = new Date(runAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() + backoffSeconds * 1000).toISOString()
}

function buildRetrySummary(task = {}, runAt = '', failure = {}) {
  const previousCount = Number(task.retrySummary?.failureCount || 0)
  const failureCount = previousCount + 1
  const backoffSeconds = retryBackoffSeconds(failureCount)
  return {
    failureCount,
    nextRetryAt: nextRetryAt(runAt, backoffSeconds),
    backoffSeconds,
    failureType: failure.failureType || 'unknown',
    recoverySuggestion: failure.recoverySuggestion || '请稍后重试；如果连续失败，请检查监控地址是否仍可访问。'
  }
}

function isRetryDue(task = {}, checkedAt = '') {
  if (task.status === 'paused') return false
  if (task.status !== 'failed') return false
  if (!task.retrySummary?.nextRetryAt) return false
  const retryTime = new Date(task.retrySummary.nextRetryAt).getTime()
  const checkedTime = new Date(checkedAt).getTime()
  if (Number.isNaN(retryTime) || Number.isNaN(checkedTime)) return false
  return retryTime <= checkedTime
}

function classifyMonitorFailure(error = {}) {
  const code = String(error.code || error.name || '').toLowerCase()
  const message = String(error.message || '').toLowerCase()
  const combined = `${code} ${message}`
  if (/login|auth|401|403|permission|unauthorized|forbidden/.test(combined)) {
    return {
      failureType: 'login-required',
      recoverySuggestion: '该页面可能需要登录或授权，请先完成访问授权后再重试。'
    }
  }
  if (/timeout|timed out|abort/.test(combined)) {
    return {
      failureType: 'timeout',
      recoverySuggestion: '页面响应较慢，请稍后重试；如果仍失败，建议降低监控频率。'
    }
  }
  if (/block|captcha|robot|rate limit|429/.test(combined)) {
    return {
      failureType: 'blocked',
      recoverySuggestion: '页面可能触发访问限制，请稍后重试或改用已授权的访问方式。'
    }
  }
  if (/capture|network|fetch|econn|enotfound|dns|unavailable|socket|503|502|500/.test(combined)) {
    return {
      failureType: 'network',
      recoverySuggestion: '页面暂时无法访问，请稍后重试或确认网址是否可打开。'
    }
  }
  if (/\b(model|analysis|ai|json)\b/.test(combined)) {
    return {
      failureType: 'analysis',
      recoverySuggestion: '页面已访问但分析暂未完成，请稍后重新生成分析。'
    }
  }
  return {
    failureType: 'unknown',
    recoverySuggestion: '请稍后重试；如果连续失败，请检查监控地址是否仍可访问。'
  }
}

function normalizeTaskNotification(input = {}, updatedAt = '') {
  const allowedChannels = ['in-app', 'email', 'webhook']
  const requestedChannels = Array.isArray(input.channels) ? input.channels : []
  const invalidChannels = requestedChannels.filter((item) => !allowedChannels.includes(item))
  if (invalidChannels.length) throw taskNotificationError('通知渠道仅支持站内、邮箱或 Webhook')
  const channels = Array.from(new Set(requestedChannels)).filter((item) => allowedChannels.includes(item))
  return {
    enabled: Boolean(input.enabled),
    channels: channels.length ? channels : ['in-app'],
    recipients: Array.from(new Set(
      (Array.isArray(input.recipients) ? input.recipients : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )),
    updatedAt
  }
}

function deterministicCapture(competitor = {}, task = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const pageLabel = pageTypeDisplayLabel(task.pageType)
  return {
    title: `${competitor.name} ${pageLabel}`,
    textContent: `${competitor.name} ${pageLabel} 文案更新于 ${stamp}`,
    screenshotUrl: `https://dummyimage.com/1200x800/f6f7f9/222529&text=${encodeURIComponent(competitor.name || 'competitor')}`
  }
}

function htmlToText(value = '') {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCaptureResult(capture = {}, competitor = {}, task = {}) {
  const textBlocks = Array.isArray(capture.textBlocks)
    ? capture.textBlocks.map((item) => item?.text || item?.content || item).filter(Boolean)
    : []
  const htmlText = htmlToText(capture.singleFileHtml || capture.staticHtml || capture.html || '')
  const pageLabel = pageTypeDisplayLabel(task.pageType)
  return {
    title: capture.title || `${competitor.name || '竞品'} ${pageLabel}`,
    textContent: capture.textContent || textBlocks.join('\n') || htmlText,
    screenshotUrl: capture.screenshotUrl || capture.pages?.[0]?.screenshot || capture.screenshot || ''
  }
}

function deterministicAiAnalysis(change = {}, competitor = {}) {
  return createWorkspaceAiAnalysis({
    competitorId: competitor.id,
    changeId: change.id,
    factualObservation: `${competitor.name} 首页主文案发生变化`,
    interpretation: '竞品正在强化当前首页定位表达。',
    productImpact: '需关注对方定位与卖点收敛方式。',
    uxImpact: '重点检查信息层级和 CTA 是否同步调整。',
    uiImpact: '视觉层暂按文案变化记录，不额外夸大 UI 结论。',
    recommendation: '把该变化加入后续产品与体验对比清单。',
    tags: [change.changeType, change.severity],
    severitySuggestion: change.severity
  })
}

function buildReportDraft({ change = {}, competitor = {}, snapshot = {}, analysis = {} } = {}) {
  const createdAt = analysis.createdAt || change.detectedAt || snapshot.capturedAt || ''
  const summary = safeUserFacingSummary(
    analysis.interpretation || change.changeSummary,
    '已生成一份可继续编辑的变化分析草稿。'
  )
  const factualObservation = safeUserFacingSummary(
    analysis.factualObservation || change.diffText,
    '本次检测已记录可供复盘的事实变化。'
  )
  const productImpact = safeUserFacingSummary(analysis.productImpact, '暂无产品影响分析。')
  const uxImpact = safeUserFacingSummary(analysis.uxImpact, '暂无体验影响分析。')
  const uiImpact = safeUserFacingSummary(analysis.uiImpact, '暂无视觉影响分析。')
  const recommendation = safeUserFacingSummary(analysis.recommendation, '暂无设计建议。')
  return {
    id: `report-draft-${change.id || randomUUID()}`,
    projectId: change.projectId || competitor.projectId || '',
    competitorId: competitor.id || change.competitorId || '',
    changeId: change.id || '',
    title: `${competitor.name || '竞品'} 变化分析报告`,
    status: 'draft',
    summary,
    factualObservation,
    productImpact,
    uxImpact,
    uiImpact,
    recommendation,
    tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    severity: analysis.severitySuggestion || change.severity || 'medium',
    sourceSnapshotId: snapshot.id || change.newSnapshotId || '',
    sourceUrl: snapshot.url || competitor.websiteUrl || '',
    createdAt,
    updatedAt: createdAt,
    sections: [
      { key: 'factualObservation', title: '事实观察', content: factualObservation || '暂无事实观察。' },
      { key: 'productImpact', title: '产品影响', content: productImpact || '暂无产品影响分析。' },
      { key: 'uxImpact', title: '体验影响', content: uxImpact || '暂无体验影响分析。' },
      { key: 'uiImpact', title: '视觉影响', content: uiImpact || '暂无视觉影响分析。' },
      { key: 'recommendation', title: '设计建议', content: recommendation || '暂无设计建议。' }
    ]
  }
}

function buildInsightFromChange({ change = {}, competitor = {}, analysis = {}, payload = {}, now = '' } = {}) {
  const category = payload.category || 'product'
  const factualObservation = safeUserFacingSummary(
    analysis.factualObservation || change.changeSummary,
    '本次检测已记录可供复盘的事实变化。'
  )
  const impactSummary = safeUserFacingSummary(
    analysis.productImpact || analysis.uxImpact || analysis.recommendation,
    '建议纳入后续产品与体验对比清单。'
  )
  const recommendation = safeUserFacingSummary(
    analysis.recommendation || payload.recommendation,
    '建议纳入后续产品与体验对比清单。'
  )
  const evidence = [
    factualObservation,
    safeUserFacingSummary(change.diffText, '本次检测已记录变化证据。')
  ].filter(Boolean).slice(0, 2)
  const summaryParts = [
    factualObservation,
    impactSummary
  ].filter(Boolean)
  const summary = summaryParts.join('；')
  return createWorkspaceCompetitorInsight({
    projectId: change.projectId || payload.projectId || '',
    competitorId: change.competitorId || competitor.id || '',
    changeId: change.id || payload.changeId || '',
    category,
    title: payload.title || `${competitor.name || '竞品'} ${category === 'ux' ? '体验' : category === 'ui' ? '视觉' : '产品'}洞察`,
    summary,
    recommendation,
    evidence,
    tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    priority: analysis.severitySuggestion || change.severity || 'medium',
    note: payload.note || '',
    createdAt: now,
    updatedAt: now
  })
}

function findReportByIdOrDraft(store, projectId = '', reportId = '') {
  const savedReport = listCompetitorReports(store, { projectId })
    .find((item) => item.id === reportId || item.sourceDraftId === reportId)
  if (savedReport) return savedReport
  return listChangeRecords(store, { projectId })
    .filter((change) => change.status === 'ready')
    .map((change) => {
      const competitor = getCompetitor(store, change.competitorId) || {}
      const snapshot = listPageSnapshots(store, {
        projectId: change.projectId,
        competitorId: change.competitorId,
        taskId: change.taskId
      }).find((item) => item.id === change.newSnapshotId) || {}
      const analysis = getAiAnalysisByChangeId(store, change.id) || {}
      return buildReportDraft({ change, competitor, snapshot, analysis })
    })
    .find((item) => item.id === reportId)
}

function findSharedReportById(store, reportId = '') {
  return listCompetitorReports(store)
    .find((item) => item.id === reportId)
}

function shareExpiryDate(sharedAt = '', expiresInDays = 7) {
  const days = Number(expiresInDays)
  if (!Number.isFinite(days) || days <= 0) return ''
  const baseDate = new Date(sharedAt)
  if (Number.isNaN(baseDate.getTime())) return ''
  baseDate.setUTCMinutes(0, 0, 0)
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

function validateSharedReportAccess(store, { reportId, shareToken, accessedAt } = {}) {
  const report = findSharedReportById(store, reportId)
  if (!report || report.shareToken !== shareToken) {
    const error = new Error('分享链接无效')
    error.code = 'COMPETITOR_REPORT_SHARE_INVALID'
    throw error
  }
  if (report.shareRevokedAt || !report.shareEnabled) {
    const error = new Error('分享链接已撤销')
    error.code = 'COMPETITOR_REPORT_SHARE_REVOKED'
    throw error
  }
  if (report.shareExpiresAt && new Date(report.shareExpiresAt).getTime() <= new Date(accessedAt).getTime()) {
    const error = new Error('分享链接已过期')
    error.code = 'COMPETITOR_REPORT_SHARE_EXPIRED'
    throw error
  }
  return report
}

function currentActor(store) {
  return store.users?.find((user) => user.id === store.currentUserId) || store.users?.[0] || {}
}

function projectForPermission(store, projectId = '') {
  return store.projects?.find((project) => project.id === projectId) || null
}

function projectMemberRole(project = {}, actor = {}) {
  if (!project || !actor?.id) return ''
  if (project.ownerUserId === actor.id || actor.role === 'owner') return 'owner'
  const member = Array.isArray(project.members)
    ? project.members.find((item) => item.userId === actor.id || item.id === actor.id)
    : null
  return ['editor', 'viewer', 'guest'].includes(member?.role) ? member.role : ''
}

function permissionRoleLabel(role = '') {
  if (role === 'owner') return '负责人'
  if (role === 'editor') return '编辑者'
  if (role === 'viewer') return '只读成员'
  if (role === 'guest') return '访客'
  return '项目成员'
}

function permissionActionItems(canEdit = false) {
  const actions = [
    { key: 'createCompetitor', label: '添加竞品', enabled: canEdit },
    { key: 'runCheck', label: '立即检测', enabled: canEdit },
    { key: 'saveReport', label: '保存报告', enabled: canEdit },
    { key: 'exportReport', label: '导出报告', enabled: canEdit },
    { key: 'shareReport', label: '分享报告', enabled: canEdit },
    { key: 'manageInsights', label: '整理洞察', enabled: canEdit }
  ]
  return {
    allowedActions: ['查看竞品监控', ...actions.filter((item) => item.enabled).map((item) => item.label)],
    restrictedActions: actions.filter((item) => !item.enabled).map((item) => item.label)
  }
}

function buildProjectPermissions(store, projectId = '') {
  const actor = currentActor(store)
  const project = projectForPermission(store, projectId)
  const role = project ? (projectMemberRole(project, actor) || 'viewer') : 'guest'
  const canEdit = ['owner', 'editor'].includes(role)
  const reason = canEdit ? '' : '仅项目编辑者或负责人可以执行该操作'
  const actionSummary = permissionActionItems(canEdit)
  return {
    projectId,
    actorUserId: actor.id || '',
    actorName: actor.name || '流程通用户',
    role,
    roleLabel: permissionRoleLabel(role),
    canView: Boolean(project),
    canCreateCompetitor: canEdit,
    canRunCheck: canEdit,
    canSaveReport: canEdit,
    canExportReport: canEdit,
    canShareReport: canEdit,
    canRevokeShare: canEdit,
    canManageInsights: canEdit,
    reason,
    allowedActions: actionSummary.allowedActions,
    restrictedActions: actionSummary.restrictedActions,
    guidance: canEdit ? '你可以执行当前项目开放的竞品监控动作。' : '如需添加竞品、检测、保存或分享，请联系项目负责人调整你的协作权限。'
  }
}

function projectMemberPermissionRoster(store, projectId = '') {
  const project = projectForPermission(store, projectId)
  if (!project) return []
  const memberIds = [
    project.ownerUserId,
    ...(Array.isArray(project.members) ? project.members.map((item) => item.userId || item.id) : [])
  ].filter(Boolean)
  return Array.from(new Set(memberIds)).map((userId) => {
    const user = store.users?.find((item) => item.id === userId) || {}
    const role = projectMemberRole(project, { ...user, id: userId }) || (project.ownerUserId === userId ? 'owner' : 'viewer')
    const canEdit = ['owner', 'editor'].includes(role)
    const actionSummary = permissionActionItems(canEdit)
    return {
      userId,
      name: user.name || '项目成员',
      role,
      roleLabel: permissionRoleLabel(role),
      isCurrentUser: userId === store.currentUserId,
      allowedActions: actionSummary.allowedActions,
      restrictedActions: actionSummary.restrictedActions
    }
  })
}

function assertPermission(store, projectId = '', key = '') {
  const permissions = buildProjectPermissions(store, projectId)
  if (permissions[key]) return permissions
  const error = new Error(permissions.reason || '当前账号无权执行该操作')
  error.code = 'COMPETITOR_PERMISSION_DENIED'
  throw error
}

async function recordAudit(store, payload = {}) {
  const actor = currentActor(store)
  return addCompetitorAuditLog(store, {
    actorUserId: actor.id || '',
    actorName: actor.name || '流程通用户',
    ...payload
  })
}

function analysisGovernanceMeta(analysis = {}) {
  const usage = analysis.analysisTokenUsage && typeof analysis.analysisTokenUsage === 'object' && !Array.isArray(analysis.analysisTokenUsage)
    ? analysis.analysisTokenUsage
    : {}
  return {
    analysisRecorded: Boolean(analysis.id || analysis.changeId),
    analysisDurationMs: Number(analysis.analysisDurationMs) || 0,
    analysisFallbackUsed: Boolean(analysis.analysisFallbackUsed),
    analysisTokenTotal: Number(usage.total) || 0
  }
}

function safeReportContent(value = '', fallback = '已保留为安全报告内容，可在后台证据链路中复盘。') {
  const raw = String(value || '').trim()
  const unsafePattern = /https?:\/\/|COMPETITOR|content-update|monitor-failed|monitor-scheduler-ran|runDueMonitorTasks|scheduler\/run-due|backoffSeconds|worker|payload|stack|debug|prompt|tokens?|provider-timeout|sourceUrl|sourceChangeId|sourceSnapshotId|change-record-|snapshot-|diffText|textContent|html|raw|analysisProvider|analysisModel|analysisTokenUsage|analysisFallbackReason|模型：|调试/i
  return raw && !unsafePattern.test(raw) ? raw : fallback
}

function safeReportSections(sections = []) {
  return normalizeReportSections(sections).map((section) => ({
    ...section,
    title: safeReportContent(section.title, '报告章节'),
    content: safeReportContent(section.content, '已保留为安全报告内容，可在后台证据链路中复盘。')
  }))
}

function normalizeReportSections(sections = [], fallbackSections = []) {
  const fallback = (Array.isArray(fallbackSections) ? fallbackSections : [])
    .map((section) => ({
      key: section.key || section.title || 'section',
      title: section.title || section.key || '报告章节',
      content: section.content || ''
    }))
  const incoming = (Array.isArray(sections) ? sections : [])
    .map((section) => ({
      key: section.key || section.title || 'section',
      title: section.title || section.key || '报告章节',
      content: section.content || ''
    }))
  if (!incoming.length) return fallback
  const merged = fallback.map((section) => {
    const patch = incoming.find((item) => item.key === section.key)
    return patch ? { ...section, ...patch } : section
  })
  incoming.forEach((section) => {
    if (!merged.some((item) => item.key === section.key)) merged.push(section)
  })
  return merged
}

function buildReportVersion(report = {}, savedAt = '') {
  const previousVersions = Array.isArray(report.reportVersions) ? report.reportVersions : []
  return {
    id: `report-version-${report.id || 'draft'}-${previousVersions.length + 1}`,
    version: previousVersions.length + 1,
    title: safeReportContent(report.title, '竞品分析报告'),
    summary: safeReportContent(report.summary, '暂无摘要。'),
    sections: safeReportSections(report.sections),
    savedAt
  }
}

function sectionMap(sections = []) {
  return new Map(
    normalizeReportSections(sections).map((section) => [
      section.key || section.title,
      section
    ])
  )
}

function buildReportVersionComparison(fromVersion = {}, toVersion = {}) {
  const previousSections = sectionMap(fromVersion.sections)
  const nextSections = sectionMap(toVersion.sections)
  const keys = Array.from(new Set([...previousSections.keys(), ...nextSections.keys()]))
  return {
    fromVersion: {
      id: fromVersion.id || '',
      version: fromVersion.version || 0,
      title: fromVersion.title || '',
      summary: fromVersion.summary || '',
      savedAt: fromVersion.savedAt || ''
    },
    toVersion: {
      id: toVersion.id || '',
      version: toVersion.version || 0,
      title: toVersion.title || '',
      summary: toVersion.summary || '',
      savedAt: toVersion.savedAt || ''
    },
    titleChanged: (fromVersion.title || '') !== (toVersion.title || ''),
    summaryChanged: (fromVersion.summary || '') !== (toVersion.summary || ''),
    previousSummary: fromVersion.summary || '',
    nextSummary: toVersion.summary || '',
    sectionDiffs: keys.map((key) => {
      const previous = previousSections.get(key) || { key, title: key, content: '' }
      const next = nextSections.get(key) || { key, title: previous.title || key, content: '' }
      return {
        key,
        title: next.title || previous.title || key,
        previousContent: previous.content || '',
        nextContent: next.content || '',
        changed: (previous.content || '') !== (next.content || '')
      }
    }).sort((a, b) => Number(b.changed) - Number(a.changed))
  }
}

const UI_COMPONENT_PATTERNS = [
  { name: '导航', pattern: /导航|nav|menu|header/i },
  { name: 'CTA', pattern: /CTA|转化|按钮|button|行动/i },
  { name: '表单', pattern: /表单|输入|登录|注册|form|input/i },
  { name: '卡片', pattern: /卡片|价格卡|pricing|card/i },
  { name: '定价模块', pattern: /定价|价格|pricing|price/i }
]

const UI_VISUAL_TAG_PATTERNS = [
  { name: '首页', pattern: /首页|homepage|home/i },
  { name: '信息层级', pattern: /信息层级|层级|hierarchy/i },
  { name: '转化入口', pattern: /CTA|转化|按钮|button/i },
  { name: '版式', pattern: /版式|布局|layout/i },
  { name: '颜色', pattern: /颜色|色彩|color/i },
  { name: '动效', pattern: /动效|动画|motion|animation/i },
  { name: '视觉趋势', pattern: /视觉|UI|ui|visual/i }
]

function uniqueBy(items = [], keyOf = (item) => item.id) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function compactText(parts = []) {
  return parts.filter(Boolean).join(' ')
}

function buildUiReferenceDto({ projectId = '', competitors = [], snapshots = [], changes = [], insights = [], analyses = [] } = {}) {
  const competitorById = new Map(competitors.map((item) => [item.id, item]))
  const changeBySnapshotId = new Map(changes.map((item) => [item.newSnapshotId, item]))
  const analysisByChangeId = new Map(analyses.map((item) => [item.changeId, item]))
  const sourceRecords = changes.map((change) => {
    const analysis = analysisByChangeId.get(change.id) || {}
    const relatedInsights = insights.filter((item) => item.changeId === change.id)
    return {
      change,
      competitor: competitorById.get(change.competitorId) || {},
      text: compactText([
        change.changeSummary,
        change.diffText,
        analysis.factualObservation,
        analysis.uiImpact,
        analysis.recommendation,
        ...(Array.isArray(analysis.tags) ? analysis.tags : []),
        ...relatedInsights.flatMap((item) => [item.title, item.summary, item.recommendation, item.category, item.note])
      ])
    }
  })
  const components = uniqueBy(
    sourceRecords.flatMap(({ change, competitor, text }) =>
      UI_COMPONENT_PATTERNS
        .filter((item) => item.pattern.test(text))
        .map((item) => ({
          id: `ui-component-${change.id}-${item.name}`,
          projectId,
          type: 'component',
          typeLabel: '组件参考',
          name: item.name,
          competitorId: competitor.id || change.competitorId || '',
          competitorName: competitor.name || '未命名竞品',
          sourceChangeId: change.id || '',
          summary: safeUserFacingSummary(change.changeSummary, '已从竞品变化中识别到可复用组件线索。'),
          updatedAt: change.detectedAt || change.updatedAt || change.createdAt || ''
        }))
    ),
    (item) => `${item.name}-${item.sourceChangeId}`
  )
  const visualTags = uniqueBy(
    sourceRecords.flatMap(({ change, competitor, text }) =>
      UI_VISUAL_TAG_PATTERNS
        .filter((item) => item.pattern.test(text))
        .map((item) => ({
          id: `ui-tag-${change.id}-${item.name}`,
          projectId,
          type: 'visual-tag',
          typeLabel: '视觉标签',
          name: item.name,
          competitorId: competitor.id || change.competitorId || '',
          competitorName: competitor.name || '未命名竞品',
          sourceChangeId: change.id || '',
          summary: safeUserFacingSummary(change.changeSummary, '已从竞品变化中识别到视觉参考标签。'),
          updatedAt: change.detectedAt || change.updatedAt || change.createdAt || ''
        }))
    ),
    (item) => `${item.name}-${item.sourceChangeId}`
  )
  const screenshots = snapshots
    .filter((snapshot) => snapshot.screenshotUrl)
    .map((snapshot) => {
      const competitor = competitorById.get(snapshot.competitorId) || {}
      const change = changeBySnapshotId.get(snapshot.id) || {}
      return {
        id: `ui-screenshot-${snapshot.id}`,
        projectId,
        type: 'screenshot',
        typeLabel: '截图参考',
        competitorId: snapshot.competitorId || '',
        competitorName: competitor.name || '未命名竞品',
        title: snapshot.title || `${competitor.name || '竞品'} 页面截图`,
        screenshotUrl: snapshot.screenshotUrl || '',
        sourceSnapshotId: snapshot.id || '',
        sourceChangeId: change.id || '',
        capturedAt: snapshot.capturedAt || snapshot.updatedAt || snapshot.createdAt || ''
      }
    })

  return { screenshots, components, visualTags }
}

function publicUiReferenceDto(references = {}) {
  return {
    screenshots: (Array.isArray(references.screenshots) ? references.screenshots : []).map((item) => {
      const { sourceSnapshotId, sourceChangeId, pageUrl, textContent, html, raw, ...safeItem } = item
      return safeItem
    }),
    components: (Array.isArray(references.components) ? references.components : []).map((item) => {
      const { sourceSnapshotId, sourceChangeId, pageUrl, textContent, html, raw, ...safeItem } = item
      return safeItem
    }),
    visualTags: (Array.isArray(references.visualTags) ? references.visualTags : []).map((item) => {
      const { sourceSnapshotId, sourceChangeId, pageUrl, textContent, html, raw, ...safeItem } = item
      return safeItem
    })
  }
}

function uiReferenceTypeDisplayLabel(type = '') {
  if (type === 'screenshot') return '截图参考'
  if (type === 'component') return '组件参考'
  if (type === 'visual-tag') return '视觉标签'
  return '设计参考'
}

function normalizeUiReferenceFavorite(input = {}, now = '') {
  const projectId = String(input.projectId || '').trim()
  const referenceId = String(input.referenceId || '').trim()
  const referenceType = String(input.referenceType || 'ui-reference').trim()
  const referenceTypeLabel = uiReferenceTypeDisplayLabel(referenceType)
  const sourceChangeId = String(input.resolvedSourceChangeId || '').trim()
  if (!projectId) throw validationError('请先选择项目')
  if (!referenceId) throw validationError('请选择要收藏的 UI 参考')
  return {
    id: `material-ui-reference-favorite-${projectId}-${referenceId}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    projectId,
    module: 'competitors',
    type: 'ui-reference-favorite',
    title: String(input.title || 'UI 参考收藏').trim(),
    meta: referenceTypeLabel,
    status: '已收藏',
    notes: String(input.competitorName || '').trim(),
    content: String(input.summary || '').trim(),
    sourceType: 'ui-reference',
    sourceUrl: sourceChangeId,
    sourceAssetId: referenceId,
    category: referenceTypeLabel,
    owner: '竞品监控',
    tags: Array.from(new Set(['UI 参考', referenceTypeLabel].filter(Boolean))),
    relations: [
      { type: 'ui-reference', id: referenceId, title: String(input.title || '').trim(), referenceType },
      { type: 'change-record', id: sourceChangeId }
    ].filter((item) => item.id),
    createdAt: input.createdAt || now,
    updatedAt: now,
    uploadedAt: input.createdAt || now
  }
}

function uiReferenceRawTypeFromMaterial(material = {}) {
  const referenceRelation = Array.isArray(material.relations)
    ? material.relations.find((item) => item.type === 'ui-reference')
    : null
  return referenceRelation?.referenceType || ''
}

function uiReferenceFavoriteDto(material = {}) {
  return {
    id: material.id || '',
    projectId: material.projectId || '',
    referenceId: material.sourceAssetId || '',
    referenceType: uiReferenceRawTypeFromMaterial(material),
    title: material.title || '',
    competitorName: material.notes || '',
    createdAt: material.createdAt || '',
    updatedAt: material.updatedAt || ''
  }
}

function findUiReferenceSourceChangeId({ projectId = '', referenceId = '', competitors = [], snapshots = [], changes = [], insights = [], analyses = [] } = {}) {
  const references = buildUiReferenceDto({ projectId, competitors, snapshots, changes, insights, analyses })
  const allReferences = [
    ...(Array.isArray(references.screenshots) ? references.screenshots : []),
    ...(Array.isArray(references.components) ? references.components : []),
    ...(Array.isArray(references.visualTags) ? references.visualTags : [])
  ]
  return allReferences.find((item) => item.id === referenceId)?.sourceChangeId || ''
}

function reportMarkdown(report = {}) {
  const lines = [
    `# ${safeReportContent(report.title, '竞品分析报告')}`,
    '',
    `状态：${reportStatusDisplayLabel(report.status || 'ready')}`,
    '来源：竞品变化分析',
    '',
    '## 摘要',
    safeReportContent(report.summary, '暂无摘要。'),
    ''
  ]
  safeReportSections(report.sections).forEach((section) => {
    lines.push(`## ${section.title || section.key || '报告章节'}`)
    lines.push(section.content || '暂无内容。')
    lines.push('')
  })
  if (report.recommendation) {
    lines.push('## 后续建议')
    lines.push(safeReportContent(report.recommendation, '已保留为安全报告内容，可在后台证据链路中复盘。'))
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}

function insightMarkdown(insight = {}) {
  const evidenceItems = safeInsightEvidenceForExport(insight)
  const lines = [
    `# ${insight.title || '竞品洞察'}`,
    '',
    `分类：${insightCategoryDisplayLabel(insight.category || 'product')}`,
    `优先级：${priorityDisplayLabel(insight.priority || 'medium')}`,
    '',
    '## 摘要',
    insight.summary || '暂无摘要。',
    '',
    '## 建议动作',
    insight.recommendation || '暂无建议。',
    ''
  ]
  if (evidenceItems.length) {
    lines.push('## 依据')
    evidenceItems.forEach((item) => lines.push(`- ${item}`))
    lines.push('')
  }
  if (insight.note) {
    lines.push('## 备注')
    lines.push(insight.note)
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}

function batchInsightMarkdown(insights = []) {
  const lines = [
    '# 竞品洞察批量导出',
    '',
    `共 ${insights.length} 条洞察`,
    ''
  ]
  insights.forEach((insight, index) => {
    lines.push(`## ${index + 1}. ${insight.title || '竞品洞察'}`)
    lines.push('')
    lines.push(`分类：${insightCategoryDisplayLabel(insight.category || 'product')}`)
    lines.push(`优先级：${priorityDisplayLabel(insight.priority || 'medium')}`)
    lines.push('')
    lines.push(insight.summary || '暂无摘要。')
    lines.push('')
    lines.push(`建议动作：${insight.recommendation || '暂无建议。'}`)
    if (insight.note) {
      lines.push('')
      lines.push(`备注：${insight.note}`)
    }
    lines.push('')
  })
  return lines.join('\n').trim() + '\n'
}

function insightExportTitle(title = '') {
  const normalizedTitle = String(title || '').trim()
  if (!normalizedTitle || normalizedTitle === '未命名竞品洞察') return '竞品洞察'
  return normalizedTitle
}

function safeInsightEvidenceForExport(insight = {}) {
  const unsafePattern = /https?:\/\/|COMPETITOR|content-update|monitor-failed|monitor-scheduler-ran|runDueMonitorTasks|scheduler\/run-due|backoffSeconds|worker|payload|stack|debug|prompt|tokens?|provider-timeout|sourceUrl|sourceChangeId|diffText|textContent|raw|调试|模型：/i
  const items = Array.isArray(insight.evidence) ? insight.evidence : []
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => unsafePattern.test(item) ? '已保留为安全证据，可在报告或变化记录中复盘。' : item)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5)
}

function insightTagDisplayLabel(tag = '') {
  const labels = {
    'homepage-copy': '官网首页文案',
    'homepage-layout': '官网首页布局',
    'pricing': '价格页',
    'feature': '功能卖点',
    'cta': '行动按钮',
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

function userFacingInsightTags(insight = {}) {
  const unsafePattern = /COMPETITOR|content-update|monitor-failed|monitor-scheduler-ran|runDueMonitorTasks|scheduler\/run-due|backoffSeconds|worker|payload|stack|debug|prompt|tokens?|provider-timeout|调试|模型：/i
  return Array.from(new Set([
    '竞品监控',
    insightCategoryDisplayLabel(insight.category),
    priorityDisplayLabel(insight.priority),
    ...(Array.isArray(insight.tags) ? insight.tags.map(insightTagDisplayLabel) : [])
  ])).filter((tag) => tag && !unsafePattern.test(tag))
}

function auditLogMarkdown(logs = []) {
  const lines = [
    '# 竞品监控操作记录',
    '',
    `导出时间：${new Date().toISOString()}`,
    `记录数量：${logs.length}`,
    ''
  ]
  if (!logs.length) {
    lines.push('暂无符合筛选条件的操作记录。')
    return lines.join('\n').trim() + '\n'
  }
  logs.forEach((log, index) => {
    lines.push(`## ${index + 1}. ${log.summary || '竞品监控操作'}`)
    lines.push(`动作：${log.actionLabel || auditActionDisplayLabel(log.action)}`)
    lines.push(`时间：${log.createdAt || '暂无时间'}`)
    lines.push(`操作者：${log.actorName || '流程通用户'}`)
    lines.push(`对象：${log.targetTitle || log.targetType || '竞品监控'}`)
    lines.push('')
  })
  return lines.join('\n').trim() + '\n'
}

const PUBLIC_AUDIT_META_BLOCKLIST = new Set([
  'results',
  'payload',
  'stack',
  'worker',
  'debug',
  'raw',
  'taskId',
  'changeId',
  'snapshotId',
  'sourceChangeId',
  'sourceSnapshotId',
  'sourceUrl',
  'sourceDraftId',
  'sourceAssetId',
  'materialId',
  'analysisGovernance'
])

function auditLogDto(log = {}) {
  const safeMeta = Object.fromEntries(
    Object.entries(log.meta || {}).filter(([key]) => !PUBLIC_AUDIT_META_BLOCKLIST.has(key))
  )
  return {
    ...log,
    meta: safeMeta,
    actionLabel: auditActionDisplayLabel(log.action)
  }
}

function sharedReportDto(report = {}) {
  return {
    id: report.id || '',
    title: safeReportContent(report.title, '竞品分析报告'),
    status: report.status || 'ready',
    summary: safeReportContent(report.summary, '这是一份通过分享链接查看的竞品分析报告。'),
    factualObservation: safeReportContent(report.factualObservation, '暂无事实观察。'),
    productImpact: safeReportContent(report.productImpact, '暂无产品影响分析。'),
    uxImpact: safeReportContent(report.uxImpact, '暂无体验影响分析。'),
    uiImpact: safeReportContent(report.uiImpact, '暂无视觉影响分析。'),
    recommendation: safeReportContent(report.recommendation, '暂无建议动作。'),
    sections: safeReportSections(report.sections),
    severity: report.severity || 'medium',
    shareAllowDownload: Boolean(report.shareAllowDownload),
    shareExpiresAt: report.shareExpiresAt || '',
    sharedAt: report.sharedAt || '',
    shareAccessCount: Number(report.shareAccessCount || 0),
    lastSharedAccessAt: report.lastSharedAccessAt || '',
    updatedAt: report.updatedAt || ''
  }
}

function reportDto(report = {}) {
  return {
    id: report.id || '',
    projectId: report.projectId || '',
    title: safeReportContent(report.title, '竞品分析报告'),
    status: report.status || 'draft',
    summary: safeReportContent(report.summary, '已生成一份可继续编辑的变化分析草稿。'),
    factualObservation: safeReportContent(report.factualObservation, '暂无事实观察。'),
    productImpact: safeReportContent(report.productImpact, '暂无产品影响分析。'),
    uxImpact: safeReportContent(report.uxImpact, '暂无体验影响分析。'),
    uiImpact: safeReportContent(report.uiImpact, '暂无视觉影响分析。'),
    recommendation: safeReportContent(report.recommendation, '暂无建议动作。'),
    sections: safeReportSections(report.sections),
    severity: ['high', 'medium', 'low'].includes(report.severity) ? report.severity : '',
    tags: userFacingInsightTags({
      category: '',
      priority: report.severity,
      tags: Array.isArray(report.tags) ? report.tags : []
    }).filter((tag) => tag !== '竞品监控'),
    shareEnabled: Boolean(report.shareEnabled),
    shareUrl: report.shareUrl || '',
    shareAllowDownload: Boolean(report.shareAllowDownload),
    shareExpiresAt: report.shareExpiresAt || '',
    shareRevokedAt: report.shareRevokedAt || '',
    sharedAt: report.sharedAt || '',
    shareAccessCount: Number(report.shareAccessCount || 0),
    lastSharedAccessAt: report.lastSharedAccessAt || '',
    createdAt: report.createdAt || '',
    updatedAt: report.updatedAt || ''
  }
}

function normalizedIds(ids = []) {
  return Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)))
}

function buildInsightKnowledgeMaterial(insight = {}, now = '') {
  const content = insightMarkdown(insight)
  const categoryLabel = insightCategoryDisplayLabel(insight.category)
  return {
    id: insight.knowledgeMaterialId || `material-competitor-insight-${insight.id}`,
    projectId: insight.projectId || 'project-flow',
    module: 'knowledge',
    type: 'knowledge',
    title: insight.title || '竞品洞察',
    meta: '竞品洞察沉淀',
    status: '已保存',
    notes: insight.note || '',
    content,
    knowledgeStatus: 'verified',
    depositedAt: now,
    category: categoryLabel,
    sourceType: 'competitor-insight',
    sourceUrl: insight.changeId || insight.id,
    sourceAssetId: insight.id || '',
    owner: '竞品监控',
    verification: {
      status: 'verified',
      reason: '由竞品洞察沉淀',
      updatedAt: now
    },
    roleScopes: ['product', 'ux', 'development', 'ai-retrieval'],
    tags: userFacingInsightTags(insight),
    relations: [
      { type: 'competitor-insight', id: insight.id || '' },
      { type: 'change-record', id: insight.changeId || '' }
    ].filter((item) => item.id),
    chunks: [
      {
        id: `${insight.id || 'insight'}-summary`,
        heading: '洞察摘要',
        text: [insight.summary, insight.recommendation, insight.note].filter(Boolean).join('\n'),
        roleScopes: ['product', 'ux', 'ai-retrieval']
      }
    ],
    evidence: safeInsightEvidenceForExport(insight).map((item, index) => ({
      title: `依据 ${index + 1}`,
      text: item
    })),
    createdAt: now,
    updatedAt: now
  }
}

async function updateMonitorTaskStatus(store, task = {}, patch = {}) {
  if (!task?.id) return null
  return addMonitorTask(store, createWorkspaceMonitorTask({
    ...task,
    ...patch
  }))
}

function monitorTaskDto(task = {}) {
  const failureHistory = Array.isArray(task.failureHistory)
    ? task.failureHistory.map((item) => ({
        failureType: item.failureType || '',
        recoverySuggestion: item.recoverySuggestion || '',
        failedAt: item.failedAt || '',
        status: item.status || 'failed'
      }))
    : []
  return {
    ...task,
    lastError: '',
    failureHistory
  }
}

function changeRecordDto(change = {}) {
  const fallback = change.status === 'failed' || change.changeType === 'monitor-failed'
    ? '竞品检测失败，请按恢复建议处理。'
    : '本次检测已记录变化摘要。'
  return {
    ...change,
    diffText: '',
    changeSummary: safeUserFacingSummary(change.changeSummary, fallback)
  }
}

function snapshotDto(snapshot = {}) {
  if (!snapshot || !snapshot.id) return null
  return {
    id: snapshot.id || '',
    projectId: snapshot.projectId || '',
    competitorId: snapshot.competitorId || '',
    taskId: snapshot.taskId || '',
    url: snapshot.url || '',
    title: snapshot.title || '',
    screenshotUrl: snapshot.screenshotUrl || '',
    status: snapshot.status || '',
    capturedAt: snapshot.capturedAt || '',
    createdAt: snapshot.createdAt || '',
    updatedAt: snapshot.updatedAt || ''
  }
}

function analysisDetailDto(analysis = {}) {
  if (!analysis || !analysis.changeId) return {}
  const usage = analysis.analysisTokenUsage && typeof analysis.analysisTokenUsage === 'object' && !Array.isArray(analysis.analysisTokenUsage)
    ? analysis.analysisTokenUsage
    : {}
  const tokenTotal = Number(usage.total) || 0
  return {
    id: analysis.id || '',
    projectId: analysis.projectId || '',
    competitorId: analysis.competitorId || '',
    changeId: analysis.changeId || '',
    factualObservation: safeUserFacingSummary(analysis.factualObservation, '当前暂无事实观察，分析完成后会展示。'),
    interpretation: safeUserFacingSummary(analysis.interpretation, '当前暂无分析解读。'),
    productImpact: safeUserFacingSummary(analysis.productImpact, '当前暂无产品影响分析。'),
    uxImpact: safeUserFacingSummary(analysis.uxImpact, '当前暂无体验影响分析。'),
    uiImpact: safeUserFacingSummary(analysis.uiImpact, '当前暂无视觉影响分析。'),
    recommendation: safeUserFacingSummary(analysis.recommendation, '当前暂无设计建议。'),
    tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    severitySuggestion: analysis.severitySuggestion || 'medium',
    analysisMode: analysis.analysisModel ? '智能分析' : '基础分析',
    analysisDurationMs: Number(analysis.analysisDurationMs) || 0,
    analysisUsageRecorded: tokenTotal > 0,
    analysisFallbackUsed: Boolean(analysis.analysisFallbackUsed),
    createdAt: analysis.createdAt || '',
    updatedAt: analysis.updatedAt || ''
  }
}

export function createCompetitorMonitorService({
  store,
  now = () => new Date().toISOString(),
  captureAdapter = deterministicCapture,
  aiAdapter = deterministicAiAnalysis
} = {}) {
  return {
    async getOverview({ projectId } = {}) {
      const competitors = await this.listCompetitors({ projectId })
      const changes = await this.listChanges({ projectId })
      return {
        metrics: {
          activeCompetitors: competitors.length,
          weeklyChanges: changes.length,
          highSeverityChanges: changes.filter((item) => item.severity === 'high').length,
          pendingAnalyses: changes.filter((item) => item.status !== 'ready').length
        },
        importantChanges: changes.slice(0, 5),
        recentReports: (await this.listReports({ projectId })).slice(0, 3),
        pendingInsights: (await this.listInsights({ projectId })).slice(0, 3)
      }
    },

    async getPermissions({ projectId } = {}) {
      return buildProjectPermissions(store, projectId)
    },

    async listProjectMembers({ projectId } = {}) {
      return projectMemberPermissionRoster(store, projectId)
    },

    async listUiReferences({ projectId } = {}) {
      const competitors = listCompetitors(store, { projectId })
      const snapshots = listPageSnapshots(store, { projectId })
      const changes = listChangeRecords(store, { projectId }).filter((item) => item.status === 'ready')
      const insights = listCompetitorInsights(store, { projectId })
      const analyses = changes
        .map((change) => getAiAnalysisByChangeId(store, change.id))
        .filter(Boolean)
      return publicUiReferenceDto(buildUiReferenceDto({ projectId, competitors, snapshots, changes, insights, analyses }))
    },

    async listUiReferenceFavorites({ projectId } = {}) {
      const normalizedProjectId = String(projectId || '').trim()
      if (!normalizedProjectId) throw validationError('请先选择项目')
      return listMaterials(store, { projectId: normalizedProjectId, type: 'ui-reference-favorite' })
        .map(uiReferenceFavoriteDto)
        .filter((item) => item.referenceId)
    },

    async favoriteUiReference(payload = {}) {
      assertPermission(store, payload.projectId, 'canManageInsights')
      const savedAt = now()
      const projectId = String(payload.projectId || '').trim()
      const referenceId = String(payload.referenceId || '').trim()
      const changes = listChangeRecords(store, { projectId }).filter((item) => item.status === 'ready')
      const analyses = changes
        .map((change) => getAiAnalysisByChangeId(store, change.id))
        .filter(Boolean)
      const resolvedSourceChangeId = findUiReferenceSourceChangeId({
        projectId,
        referenceId,
        competitors: listCompetitors(store, { projectId }),
        snapshots: listPageSnapshots(store, { projectId }),
        changes,
        insights: listCompetitorInsights(store, { projectId }),
        analyses
      })
      const material = normalizeUiReferenceFavorite({ ...payload, resolvedSourceChangeId }, savedAt)
      const existing = listMaterials(store, { projectId: material.projectId, type: 'ui-reference-favorite' })
        .find((item) => item.sourceAssetId === material.sourceAssetId)
      const saved = await addMaterial(store, {
        ...material,
        id: existing?.id || material.id,
        createdAt: existing?.createdAt || material.createdAt
      })
      if (!existing) {
        await recordAudit(store, {
          projectId: material.projectId,
          action: 'ui-reference-favorited',
          summary: `收藏 UI 参考「${saved.title}」`,
          targetType: 'ui-reference',
          targetId: material.sourceAssetId,
          targetTitle: saved.title,
          meta: {
            referenceType: uiReferenceRawTypeFromMaterial(saved),
            sourceChangeId: saved.sourceUrl || ''
          }
        })
      }
      return uiReferenceFavoriteDto(saved)
    },

    async unfavoriteUiReference({ projectId, referenceId } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const normalizedProjectId = String(projectId || '').trim()
      const normalizedReferenceId = String(referenceId || '').trim()
      if (!normalizedProjectId) throw validationError('请先选择项目')
      if (!normalizedReferenceId) throw validationError('请选择要取消收藏的 UI 参考')
      const material = listMaterials(store, { projectId: normalizedProjectId, type: 'ui-reference-favorite' })
        .find((item) => item.sourceAssetId === normalizedReferenceId)
      if (!material) return { referenceId: normalizedReferenceId, deleted: false }
      const result = await deleteMaterial(store, material.id)
      if (result.deleted) {
        await recordAudit(store, {
          projectId: normalizedProjectId,
          action: 'ui-reference-unfavorited',
          summary: `取消收藏 UI 参考「${material.title}」`,
          targetType: 'ui-reference',
          targetId: normalizedReferenceId,
          targetTitle: material.title || '',
          meta: {
            referenceType: uiReferenceRawTypeFromMaterial(material),
            sourceChangeId: material.sourceUrl || ''
          }
        })
      }
      return { referenceId: normalizedReferenceId, deleted: result.deleted }
    },

    async listCompetitors({ projectId } = {}) {
      await ensurePythonDefaultCompetitors(store, projectId, now)
      return dedupeVisibleCompetitors(listCompetitors(store, { projectId }))
    },

    async getCompetitor({ competitorId } = {}) {
      return getCompetitor(store, competitorId)
    },

    async listTasks({ projectId, competitorId = '' } = {}) {
      return listMonitorTasks(store, { projectId, competitorId }).map(monitorTaskDto)
    },

    async createTask(payload = {}) {
      const normalizedPayload = normalizeMonitorTaskInput(payload, store)
      assertPermission(store, normalizedPayload.projectId, 'canRunCheck')
      const createdAt = now()
      const task = await addMonitorTask(store, createWorkspaceMonitorTask({
        ...normalizedPayload,
        notification: normalizeTaskNotification(normalizedPayload.notification || {}, createdAt),
        nextRunAt: nextRunAtForFrequency(createdAt, normalizedPayload.frequency),
        createdAt,
        updatedAt: createdAt
      }))
      const competitor = getCompetitor(store, task.competitorId)
      const targetTitle = `${competitor?.name || '竞品'} ${pageTypeDisplayLabel(task.pageType)}`
      await recordAudit(store, {
        projectId: task.projectId,
        action: 'monitor-task-created',
        summary: `新建监控任务「${targetTitle}」`,
        targetType: 'monitor-task',
        targetId: task.id,
        targetTitle,
        meta: {
          url: task.url,
          pageType: task.pageType,
          frequency: task.frequency,
          notificationEnabled: Boolean(task.notification?.enabled)
        }
      })
      return task
    },

    async updateTaskStatus({ projectId, taskId, status, frequency, notification } = {}) {
      assertPermission(store, projectId, 'canRunCheck')
      const task = listMonitorTasks(store, { projectId }).find((item) => item.id === taskId)
      if (!task) {
        const error = new Error('监控任务不存在')
        error.code = 'COMPETITOR_TASK_NOT_FOUND'
        throw error
      }
      const hasStatusUpdate = status !== undefined && status !== ''
      const hasFrequencyUpdate = frequency !== undefined && frequency !== ''
      const hasNotificationUpdate = notification !== undefined
      if (!hasStatusUpdate && !hasFrequencyUpdate && !hasNotificationUpdate) {
        throw taskStatusError('请选择要更新的监控任务设置')
      }
      if (hasStatusUpdate && !['active', 'paused'].includes(status)) {
        throw taskStatusError('当前只支持暂停或恢复监控任务')
      }
      if (hasFrequencyUpdate && !['daily', 'weekly', 'monthly'].includes(frequency)) {
        throw taskFrequencyError('当前只支持每天、每周或每月监控频率')
      }
      const updatedAt = now()
      const nextStatus = hasStatusUpdate ? status : task.status
      const nextFrequency = hasFrequencyUpdate ? frequency : task.frequency
      const updatedTask = await updateMonitorTaskStatus(store, task, {
        status: nextStatus,
        frequency: nextFrequency,
        notification: hasNotificationUpdate ? normalizeTaskNotification(notification, updatedAt) : task.notification,
        nextRunAt: nextStatus === 'paused' ? '' : nextRunAtForFrequency(updatedAt, nextFrequency),
        lastError: hasStatusUpdate && nextStatus === 'active' ? '' : task.lastError,
        failureType: hasStatusUpdate && nextStatus === 'active' ? '' : task.failureType,
        recoverySuggestion: hasStatusUpdate && nextStatus === 'active' ? '' : task.recoverySuggestion,
        updatedAt
      })
      const targetTitle = `${getCompetitor(store, task.competitorId)?.name || '竞品'} ${pageTypeDisplayLabel(task.pageType)}`
      if (hasStatusUpdate) {
        await recordAudit(store, {
          projectId,
          action: 'monitor-task-status-updated',
          summary: `${nextStatus === 'paused' ? '暂停' : '恢复'}监控任务「${targetTitle}」`,
          targetType: 'monitor-task',
          targetId: task.id,
          targetTitle,
          meta: { status: nextStatus }
        })
      }
      if (hasFrequencyUpdate) {
        await recordAudit(store, {
          projectId,
          action: 'monitor-task-frequency-updated',
          summary: `将监控任务「${targetTitle}」频率调整为${frequencyAuditLabel(nextFrequency)}`,
          targetType: 'monitor-task',
          targetId: task.id,
          targetTitle,
          meta: { frequency: nextFrequency }
        })
      }
      if (hasNotificationUpdate) {
        await recordAudit(store, {
          projectId,
          action: 'monitor-task-notification-updated',
          summary: `更新监控任务「${targetTitle}」通知设置`,
          targetType: 'monitor-task',
          targetId: task.id,
          targetTitle,
          meta: {
            enabled: Boolean(updatedTask.notification?.enabled),
            channels: updatedTask.notification?.channels || []
          }
        })
      }
      return updatedTask
    },

    async createCompetitor(payload = {}) {
      const normalizedPayload = normalizeCompetitorInput(payload)
      assertPermission(store, normalizedPayload.projectId, 'canCreateCompetitor')
      const competitor = await addCompetitor(store, createWorkspaceCompetitor(normalizedPayload))
      await addMonitorTask(store, createWorkspaceMonitorTask({
        projectId: competitor.projectId,
        competitorId: competitor.id,
        url: competitor.websiteUrl,
        pageType: 'Homepage',
        nextRunAt: nextRunAtForFrequency(now(), 'weekly')
      }))
      await recordAudit(store, {
        projectId: competitor.projectId,
        action: 'competitor-created',
        summary: `添加竞品「${competitor.name}」`,
        targetType: 'competitor',
        targetId: competitor.id,
        targetTitle: competitor.name,
        meta: { websiteUrl: competitor.websiteUrl }
      })
      return competitor
    },

    async updateCompetitor(payload = {}) {
      const competitorId = String(payload.competitorId || payload.id || '').trim()
      const current = getCompetitor(store, competitorId)
      if (!current || current.status === 'deleted') {
        const error = new Error('竞品不存在')
        error.code = 'COMPETITOR_NOT_FOUND'
        throw error
      }
      const normalizedPayload = normalizeCompetitorInput({
        ...payload,
        projectId: payload.projectId || current.projectId,
        name: payload.name ?? current.name,
        websiteUrl: payload.websiteUrl ?? current.websiteUrl
      })
      if (current.projectId !== normalizedPayload.projectId) {
        throw validationError('请选择当前项目下的竞品')
      }
      assertPermission(store, normalizedPayload.projectId, 'canCreateCompetitor')
      const updatedAt = now()
      const updated = await updateWorkspaceCompetitor(store, current, {
        name: normalizedPayload.name,
        websiteUrl: normalizedPayload.websiteUrl,
        notes: payload.notes ?? current.notes,
        tags: Array.isArray(payload.tags) ? payload.tags : current.tags,
        status: 'active',
        updatedAt
      })
      const homepageTask = listMonitorTasks(store, {
        projectId: updated.projectId,
        competitorId: updated.id
      }).find((task) => task.pageType === 'Homepage') || null
      if (homepageTask && homepageTask.url !== updated.websiteUrl) {
        await updateMonitorTaskStatus(store, homepageTask, {
          url: updated.websiteUrl,
          updatedAt
        })
      }
      await recordAudit(store, {
        projectId: updated.projectId,
        action: 'competitor-updated',
        summary: `更新竞品「${updated.name}」`,
        targetType: 'competitor',
        targetId: updated.id,
        targetTitle: updated.name,
        meta: { websiteUrl: updated.websiteUrl }
      })
      return updated
    },

    async deleteCompetitor(payload = {}) {
      const projectId = String(payload.projectId || '').trim()
      const competitorId = String(payload.competitorId || payload.id || '').trim()
      if (!projectId) throw validationError('请先选择项目')
      if (!competitorId) throw validationError('请选择要删除的竞品')
      assertPermission(store, projectId, 'canCreateCompetitor')
      const current = getCompetitor(store, competitorId)
      if (!current || current.projectId !== projectId || current.status === 'deleted') {
        return { id: competitorId, deleted: false }
      }
      const deletedAt = now()
      const result = await deleteWorkspaceCompetitor(store, competitorId, { updatedAt: deletedAt })
      for (const task of listMonitorTasks(store, { projectId, competitorId })) {
        await updateMonitorTaskStatus(store, task, {
          status: 'paused',
          nextRunAt: '',
          updatedAt: deletedAt
        })
      }
      if (result.deleted) {
        await recordAudit(store, {
          projectId,
          action: 'competitor-deleted',
          summary: `删除竞品「${current.name}」`,
          targetType: 'competitor',
          targetId: current.id,
          targetTitle: current.name,
          meta: { websiteUrl: current.websiteUrl }
        })
      }
      return result
    },

    async runCompetitorCheck({ competitorId, projectId } = {}) {
      assertPermission(store, projectId, 'canRunCheck')
      const competitor = getCompetitor(store, competitorId)
      const task = listMonitorTasks(store, { projectId, competitorId })[0]
      const runAt = now()
      await updateMonitorTaskStatus(store, task, {
        status: 'running',
        lastRunAt: runAt,
        lastError: '',
        failureType: '',
        recoverySuggestion: '',
        updatedAt: runAt
      })
      try {
        const currentCapture = normalizeCaptureResult(await captureAdapter(competitor, task), competitor, task)
        const previousSnapshot = listPageSnapshots(store, { projectId, competitorId, taskId: task?.id })[0] || null
        const snapshot = await addPageSnapshot(store, createWorkspacePageSnapshot({
          id: `page-snapshot-${randomUUID()}`,
          projectId,
          competitorId,
          taskId: task?.id || '',
          url: task?.url || competitor?.websiteUrl || '',
          title: currentCapture.title,
          textContent: currentCapture.textContent,
          screenshotUrl: currentCapture.screenshotUrl,
          capturedAt: runAt
        }))
        const change = await addChangeRecord(store, createWorkspaceChangeRecord({
          id: `change-record-${randomUUID()}`,
          projectId,
          competitorId,
          taskId: task?.id || '',
          oldSnapshotId: previousSnapshot?.id || '',
          newSnapshotId: snapshot.id,
          changeType: 'homepage-copy',
          changeSummary: `${competitor.name} 首页监控发现新变化`,
          diffText: previousSnapshot ? `${previousSnapshot.textContent}\n---\n${snapshot.textContent}` : snapshot.textContent,
          severity: previousSnapshot ? 'medium' : 'high',
          status: 'ready',
          detectedAt: runAt
        }))
        const analysis = await addAiAnalysis(store, await aiAdapter(change, competitor, snapshot))
        const completedTask = await updateMonitorTaskStatus(store, task, {
          status: 'succeeded',
          lastRunAt: runAt,
          lastError: '',
          failureType: '',
          recoverySuggestion: '',
          retrySummary: emptyRetrySummary(),
          runHistory: appendTaskRunHistory(task, {
            status: 'succeeded',
            runAt,
            changeId: change.id,
            snapshotId: snapshot.id
          }),
          updatedAt: runAt
        })
        await recordAudit(store, {
          projectId,
          action: 'competitor-check-ran',
          summary: `完成「${competitor.name}」检测`,
          targetType: 'competitor',
          targetId: competitor.id,
          targetTitle: competitor.name,
          meta: { taskId: task?.id || '', changeId: change.id, snapshotId: snapshot.id }
        })
        return { competitor, task: completedTask, snapshot: snapshotDto(snapshot), change: changeRecordDto(change), analysis: analysisDetailDto(analysis) }
      } catch (error) {
        const message = error?.message || '竞品检测失败'
        const failure = classifyMonitorFailure(error)
        const failedChange = await addChangeRecord(store, createWorkspaceChangeRecord({
          id: `change-record-${randomUUID()}`,
          projectId,
          competitorId,
          taskId: task?.id || '',
          changeType: 'monitor-failed',
          changeSummary: `${competitor?.name || '竞品'} 检测失败`,
          diffText: message,
          severity: 'high',
          status: 'failed',
          failureType: failure.failureType,
          recoverySuggestion: failure.recoverySuggestion,
          detectedAt: runAt
        }))
        const failedTask = await updateMonitorTaskStatus(store, task, {
          status: 'failed',
          lastRunAt: runAt,
          lastError: message,
          failureType: failure.failureType,
          recoverySuggestion: failure.recoverySuggestion,
          failureHistory: appendTaskFailureHistory(task, { message, failedAt: runAt, ...failure }),
          retrySummary: buildRetrySummary(task, runAt, failure),
          runHistory: appendTaskRunHistory(task, {
            status: 'failed',
            runAt,
            changeId: failedChange.id,
            failureType: failure.failureType,
            recoverySuggestion: failure.recoverySuggestion
          }),
          updatedAt: runAt
        })
        await recordAudit(store, {
          projectId,
          action: 'competitor-check-failed',
          summary: `${competitor?.name || '竞品'} 检测失败`,
          targetType: 'competitor',
          targetId: competitor?.id || competitorId || '',
          targetTitle: competitor?.name || '竞品',
          meta: {
            taskId: task?.id || '',
            changeId: failedChange.id,
            failureType: failure.failureType,
            recoverySuggestion: failure.recoverySuggestion
          }
        })
        error.task = failedTask
        throw error
      }
    },

    async runDueMonitorTasks({ projectId } = {}) {
      assertPermission(store, projectId, 'canRunCheck')
      const checkedAt = now()
      const dueTasks = listMonitorTasks(store, { projectId }).filter((task) => isRetryDue(task, checkedAt))
      const results = []
      for (const task of dueTasks) {
        try {
          const result = await this.runCompetitorCheck({ projectId, competitorId: task.competitorId })
          results.push({
            taskId: task.id,
            competitorId: task.competitorId,
            status: 'succeeded',
            changeId: result.change?.id || '',
            snapshotId: result.snapshot?.id || ''
          })
        } catch (error) {
          const latestTask = listMonitorTasks(store, { projectId, competitorId: task.competitorId })[0] || {}
          results.push({
            taskId: task.id,
            competitorId: task.competitorId,
            status: 'failed',
            failureType: latestTask.failureType || 'unknown',
            recoverySuggestion: latestTask.recoverySuggestion || '请稍后重试；如果连续失败，请检查监控地址是否仍可访问。'
          })
        }
      }
      const summary = {
        projectId,
        checkedAt,
        totalDue: dueTasks.length,
        succeeded: results.filter((item) => item.status === 'succeeded').length,
        failed: results.filter((item) => item.status === 'failed').length,
        results
      }
      await recordAudit(store, {
        projectId,
        action: 'monitor-scheduler-ran',
        summary: `执行竞品监控调度：${summary.totalDue} 个到期任务，成功 ${summary.succeeded} 个，失败 ${summary.failed} 个`,
        targetType: 'monitor-scheduler',
        targetId: projectId,
        targetTitle: '竞品监控调度',
        meta: {
          checkedAt: summary.checkedAt,
          totalDue: summary.totalDue,
          succeeded: summary.succeeded,
          failed: summary.failed,
          results: summary.results
        }
      })
      return summary
    },

    async listChanges({ projectId, competitorId = '' } = {}) {
      return listChangeRecords(store, { projectId, competitorId }).map(changeRecordDto)
    },

    async listReports({ projectId } = {}) {
      const drafts = listChangeRecords(store, { projectId })
        .filter((change) => change.status === 'ready')
        .map((change) => {
          const competitor = getCompetitor(store, change.competitorId) || {}
          const snapshot = listPageSnapshots(store, {
            projectId: change.projectId,
            competitorId: change.competitorId,
            taskId: change.taskId
          }).find((item) => item.id === change.newSnapshotId) || {}
          const analysis = getAiAnalysisByChangeId(store, change.id) || {}
          return buildReportDraft({ change, competitor, snapshot, analysis })
        })
      const savedReports = listCompetitorReports(store, { projectId })
      return drafts.map((draft) =>
        savedReports.find((report) => report.sourceDraftId === draft.id) || draft
      ).map(reportDto)
    },

    async saveReport({ projectId, reportId, title, summary, sections } = {}) {
      assertPermission(store, projectId, 'canSaveReport')
      const baseReport = findReportByIdOrDraft(store, projectId, reportId)
      if (!baseReport || baseReport.projectId !== projectId) {
        const error = new Error('分析报告不存在')
        error.code = 'COMPETITOR_REPORT_NOT_FOUND'
        throw error
      }
      const existing = listCompetitorReports(store, { projectId })
        .find((item) => item.id === reportId || item.sourceDraftId === reportId || item.id === baseReport.id)
      const savedAt = now()
      const nextReport = createWorkspaceCompetitorReport({
        ...baseReport,
        ...(existing || {}),
        id: existing?.id || `competitor-report-${baseReport.changeId || reportId}`,
        sourceDraftId: baseReport.sourceDraftId || (String(baseReport.id || '').startsWith('report-draft-') ? baseReport.id : existing?.sourceDraftId || ''),
        title: title || existing?.title || baseReport.title,
        summary: summary || existing?.summary || baseReport.summary,
        sections: normalizeReportSections(sections, existing?.sections || baseReport.sections),
        status: 'ready',
        createdAt: existing?.createdAt || savedAt,
        updatedAt: savedAt
      })
      nextReport.reportVersions = [
        ...(Array.isArray(existing?.reportVersions) ? existing.reportVersions : []),
        buildReportVersion(nextReport, savedAt)
      ]
      const savedReport = await addCompetitorReport(store, nextReport)
      await recordAudit(store, {
        projectId,
        action: 'report-saved',
        summary: `保存报告「${savedReport.title}」`,
        targetType: 'report',
        targetId: savedReport.id,
        targetTitle: savedReport.title,
        meta: {
          sourceDraftId: savedReport.sourceDraftId,
          version: savedReport.reportVersions.length,
          analysisGovernance: analysisGovernanceMeta(getAiAnalysisByChangeId(store, savedReport.changeId) || {})
        }
      })
      return reportDto(savedReport)
    },

    async exportReport({ projectId, reportId } = {}) {
      assertPermission(store, projectId, 'canExportReport')
      const report = findReportByIdOrDraft(store, projectId, reportId)
      if (!report || report.projectId !== projectId) {
        const error = new Error('分析报告不存在')
        error.code = 'COMPETITOR_REPORT_NOT_FOUND'
        throw error
      }
      const title = String(report.title || '竞品分析报告').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
      const exported = {
        fileName: `${title || '竞品分析报告'}.md`,
        markdown: reportMarkdown(report)
      }
      await recordAudit(store, {
        projectId,
        action: 'report-exported',
        summary: `导出报告「${report.title || '竞品分析报告'}」`,
        targetType: 'report',
        targetId: report.id,
        targetTitle: report.title || '竞品分析报告',
        meta: { fileName: exported.fileName }
      })
      return exported
    },

    async shareReport({ projectId, reportId, expiresInDays = 7, allowDownload = false } = {}) {
      assertPermission(store, projectId, 'canShareReport')
      const report = findReportByIdOrDraft(store, projectId, reportId)
      if (!report || report.projectId !== projectId || report.status !== 'ready') {
        const error = new Error('分析报告不存在')
        error.code = 'COMPETITOR_REPORT_NOT_FOUND'
        throw error
      }
      const sharedAt = report.sharedAt || now()
      const shareToken = report.shareToken || `share-${report.id}`
      const shareExpiresAt = shareExpiryDate(sharedAt, expiresInDays)
      const sharedReport = await addCompetitorReport(store, createWorkspaceCompetitorReport({
        ...report,
        shareEnabled: true,
        shareToken,
        shareUrl: `/competitor-monitor/reports/${encodeURIComponent(report.id)}?share=${encodeURIComponent(shareToken)}`,
        shareAllowDownload: Boolean(allowDownload),
        sharedAt,
        shareExpiresAt,
        shareRevokedAt: '',
        updatedAt: sharedAt
      }))
      await recordAudit(store, {
        projectId,
        action: 'report-shared',
        summary: `生成报告「${sharedReport.title}」分享链接`,
        targetType: 'report',
        targetId: sharedReport.id,
        targetTitle: sharedReport.title,
        meta: { shareExpiresAt: sharedReport.shareExpiresAt }
      })
      return reportDto(sharedReport)
    },

    async revokeReportShare({ projectId, reportId } = {}) {
      assertPermission(store, projectId, 'canRevokeShare')
      const report = findReportByIdOrDraft(store, projectId, reportId)
      if (!report || report.projectId !== projectId || report.status !== 'ready') {
        const error = new Error('分析报告不存在')
        error.code = 'COMPETITOR_REPORT_NOT_FOUND'
        throw error
      }
      const revokedAt = now()
      const revokedReport = await addCompetitorReport(store, createWorkspaceCompetitorReport({
        ...report,
        shareEnabled: false,
        shareRevokedAt: revokedAt,
        updatedAt: revokedAt
      }))
      await recordAudit(store, {
        projectId,
        action: 'report-share-revoked',
        summary: `撤销报告「${revokedReport.title}」分享`,
        targetType: 'report',
        targetId: revokedReport.id,
        targetTitle: revokedReport.title,
        meta: { shareRevokedAt: revokedReport.shareRevokedAt }
      })
      return reportDto(revokedReport)
    },

    async getSharedReport({ reportId, shareToken } = {}) {
      const accessedAt = now()
      const report = validateSharedReportAccess(store, { reportId, shareToken, accessedAt })
      const accessedReport = await addCompetitorReport(store, createWorkspaceCompetitorReport({
        ...report,
        shareAccessCount: Number(report.shareAccessCount || 0) + 1,
        lastSharedAccessAt: accessedAt,
        updatedAt: report.updatedAt || accessedAt
      }))
      await recordAudit(store, {
        projectId: accessedReport.projectId,
        action: 'report-shared-accessed',
        summary: `访问公开报告「${accessedReport.title}」`,
        targetType: 'report',
        targetId: accessedReport.id,
        targetTitle: accessedReport.title,
        meta: {
          accessedAt,
          shareAccessCount: accessedReport.shareAccessCount
        }
      })
      return sharedReportDto(accessedReport)
    },

    async exportSharedReport({ reportId, shareToken } = {}) {
      const sharedReport = findSharedReportById(store, reportId)
      const report = validateSharedReportAccess(store, {
        reportId,
        shareToken,
        accessedAt: sharedReport?.lastSharedAccessAt || sharedReport?.sharedAt || now()
      })
      if (!report.shareAllowDownload) {
        const error = new Error('当前分享不允许下载')
        error.code = 'COMPETITOR_REPORT_SHARE_DOWNLOAD_DENIED'
        throw error
      }
      const title = String(report.title || '竞品分析报告').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
      return {
        fileName: `${title || '竞品分析报告'}.md`,
        markdown: reportMarkdown(report)
      }
    },

    async listAuditLogs({ projectId, action, targetType, actorUserId, limit } = {}) {
      return listCompetitorAuditLogs(store, { projectId, action, targetType, actorUserId, limit })
        .map(auditLogDto)
    },

    async exportAuditLogs({ projectId, action, targetType, actorUserId, limit } = {}) {
      const logs = listCompetitorAuditLogs(store, { projectId, action, targetType, actorUserId, limit: limit || 100 })
        .map(auditLogDto)
      return {
        fileName: '竞品监控操作记录.md',
        markdown: auditLogMarkdown(logs)
      }
    },

    async listReportVersions({ projectId, reportId } = {}) {
      const report = findReportByIdOrDraft(store, projectId, reportId)
      if (!report || report.projectId !== projectId) {
        const error = new Error('分析报告不存在')
        error.code = 'COMPETITOR_REPORT_NOT_FOUND'
        throw error
      }
      return (Array.isArray(report.reportVersions) ? report.reportVersions : [])
        .slice()
        .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
    },

    async compareReportVersions({ projectId, reportId, fromVersion, toVersion } = {}) {
      const report = findReportByIdOrDraft(store, projectId, reportId)
      if (!report || report.projectId !== projectId) {
        const error = new Error('分析报告不存在')
        error.code = 'COMPETITOR_REPORT_NOT_FOUND'
        throw error
      }
      const versions = Array.isArray(report.reportVersions) ? report.reportVersions : []
      const previous = versions.find((item) => Number(item.version) === Number(fromVersion))
      const next = versions.find((item) => Number(item.version) === Number(toVersion))
      if (!previous || !next) {
        const error = new Error('报告版本不存在')
        error.code = 'COMPETITOR_REPORT_VERSION_NOT_FOUND'
        throw error
      }
      return buildReportVersionComparison(previous, next)
    },

    async listInsights({ projectId, competitorId = '' } = {}) {
      return listCompetitorInsights(store, { projectId, competitorId })
    },

    async saveInsight({ projectId, changeId, category = 'product', note = '' } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const change = getChangeRecord(store, changeId)
      if (!change || change.projectId !== projectId) {
        const error = new Error('变化记录不存在')
        error.code = 'COMPETITOR_CHANGE_NOT_FOUND'
        throw error
      }
      const existingInsight = listCompetitorInsights(store, { projectId, competitorId: change.competitorId })
        .find((item) => item.changeId === changeId && item.category === category)
      if (existingInsight) return existingInsight
      const competitor = getCompetitor(store, change.competitorId) || {}
      const analysis = getAiAnalysisByChangeId(store, change.id) || {}
      const insight = await addCompetitorInsight(store, buildInsightFromChange({
        change,
        competitor,
        analysis,
        payload: { projectId, changeId, category, note },
        now: now()
      }))
      await recordAudit(store, {
        projectId,
        action: 'insight-saved',
        summary: `保存洞察「${insight.title}」`,
        targetType: 'insight',
        targetId: insight.id,
        targetTitle: insight.title,
        meta: {
          changeId,
          category: insight.category,
          analysisGovernance: analysisGovernanceMeta(analysis)
        }
      })
      return insight
    },

    async updateInsight({ projectId, insightId, category, note } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const insight = listCompetitorInsights(store, { projectId })
        .find((item) => item.id === insightId)
      if (!insight) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const updatedInsight = await addCompetitorInsight(store, createWorkspaceCompetitorInsight({
        ...insight,
        category: category || insight.category,
        note: note !== undefined ? note : insight.note,
        updatedAt: now()
      }))
      await recordAudit(store, {
        projectId,
        action: 'insight-updated',
        summary: `更新洞察「${updatedInsight.title}」`,
        targetType: 'insight',
        targetId: updatedInsight.id,
        targetTitle: updatedInsight.title,
        meta: { category: updatedInsight.category }
      })
      return updatedInsight
    },

    async batchUpdateInsights({ projectId, insightIds = [], category, note } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const ids = normalizedIds(insightIds)
      if (!ids.length) {
        const error = new Error('请选择要整理的洞察')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const insights = listCompetitorInsights(store, { projectId })
        .filter((item) => ids.includes(item.id))
      if (insights.length !== ids.length) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const updatedAt = now()
      const updatedInsights = []
      for (const insight of insights) {
        updatedInsights.push(await addCompetitorInsight(store, createWorkspaceCompetitorInsight({
          ...insight,
          category: category || insight.category,
          note: note !== undefined ? note : insight.note,
          updatedAt
        })))
      }
      await recordAudit(store, {
        projectId,
        action: 'insights-batch-updated',
        summary: `批量整理 ${updatedInsights.length} 条洞察`,
        targetType: 'insight-batch',
        targetId: updatedInsights.map((item) => item.id).join(','),
        targetTitle: '洞察批量整理',
        meta: { count: updatedInsights.length, category: category || '' }
      })
      return {
        updatedCount: updatedInsights.length,
        insights: updatedInsights
      }
    },

    async exportInsight({ projectId, insightId } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const insight = listCompetitorInsights(store, { projectId })
        .find((item) => item.id === insightId)
      if (!insight) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const title = insightExportTitle(insight.title).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
      const fileName = `${title || '竞品洞察'}.md`
      await recordAudit(store, {
        projectId,
        action: 'insight-exported',
        summary: `导出洞察「${insight.title}」`,
        targetType: 'insight',
        targetId: insight.id,
        targetTitle: insight.title,
        meta: { fileName }
      })
      return {
        fileName,
        markdown: insightMarkdown(insight)
      }
    },

    async batchExportInsights({ projectId, insightIds = [] } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const ids = normalizedIds(insightIds)
      if (!ids.length) {
        const error = new Error('请选择要导出的洞察')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const insights = listCompetitorInsights(store, { projectId })
        .filter((item) => ids.includes(item.id))
      if (insights.length !== ids.length) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      await recordAudit(store, {
        projectId,
        action: 'insights-batch-exported',
        summary: `批量导出 ${insights.length} 条洞察`,
        targetType: 'insight-batch',
        targetId: insights.map((item) => item.id).join(','),
        targetTitle: '洞察批量导出',
        meta: { count: insights.length, fileName: '竞品洞察批量导出.md' }
      })
      return {
        count: insights.length,
        fileName: '竞品洞察批量导出.md',
        markdown: batchInsightMarkdown(insights)
      }
    },

    async linkInsightRequirements({ projectId, insightId, requirementMaterialIds = [] } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const insight = listCompetitorInsights(store, { projectId })
        .find((item) => item.id === insightId)
      if (!insight) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const requestedIds = Array.from(new Set((Array.isArray(requirementMaterialIds) ? requirementMaterialIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)))
      const requirements = listMaterials(store, { projectId, type: 'requirements' })
        .filter((item) => requestedIds.includes(item.id))
      if (requestedIds.length && requirements.length !== requestedIds.length) {
        const error = new Error('需求文档不存在')
        error.code = 'COMPETITOR_REQUIREMENT_NOT_FOUND'
        throw error
      }
      const linkedAt = now()
      const nextRequirementIds = Array.from(new Set([
        ...(Array.isArray(insight.requirementMaterialIds) ? insight.requirementMaterialIds : []),
        ...requirements.map((item) => item.id)
      ]))
      const updatedRequirements = []
      for (const requirement of requirements) {
        const relations = Array.isArray(requirement.relations) ? requirement.relations : []
        const hasRelation = relations.some((item) => item.type === 'competitor-insight' && item.id === insight.id)
        updatedRequirements.push(await addMaterial(store, {
          ...requirement,
          relations: hasRelation
            ? relations
            : [...relations, { type: 'competitor-insight', id: insight.id, title: insight.title || '' }],
          updatedAt: linkedAt
        }))
      }
      const updatedInsight = await addCompetitorInsight(store, createWorkspaceCompetitorInsight({
        ...insight,
        requirementMaterialIds: nextRequirementIds,
        updatedAt: linkedAt
      }))
      await recordAudit(store, {
        projectId,
        action: 'insight-requirements-linked',
        summary: `关联需求「${updatedInsight.title}」`,
        targetType: 'insight',
        targetId: updatedInsight.id,
        targetTitle: updatedInsight.title,
        meta: { requirementMaterialIds: nextRequirementIds, count: requirements.length }
      })
      return { insight: updatedInsight, requirements: updatedRequirements }
    },

    async depositInsightToKnowledge({ projectId, insightId } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const insight = listCompetitorInsights(store, { projectId })
        .find((item) => item.id === insightId)
      if (!insight) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const depositedAt = now()
      const material = await addMaterial(store, buildInsightKnowledgeMaterial(insight, depositedAt))
      const updatedInsight = await addCompetitorInsight(store, createWorkspaceCompetitorInsight({
        ...insight,
        knowledgeMaterialId: material.id,
        updatedAt: depositedAt
      }))
      await recordAudit(store, {
        projectId,
        action: 'insight-knowledge-deposited',
        summary: `沉淀洞察「${updatedInsight.title}」`,
        targetType: 'insight',
        targetId: updatedInsight.id,
        targetTitle: updatedInsight.title,
        meta: { materialId: material.id }
      })
      return { insight: updatedInsight, material }
    },

    async batchDepositInsightsToKnowledge({ projectId, insightIds = [] } = {}) {
      assertPermission(store, projectId, 'canManageInsights')
      const ids = normalizedIds(insightIds)
      if (!ids.length) {
        const error = new Error('请选择要沉淀的洞察')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const insights = listCompetitorInsights(store, { projectId })
        .filter((item) => ids.includes(item.id))
      if (insights.length !== ids.length) {
        const error = new Error('洞察不存在')
        error.code = 'COMPETITOR_INSIGHT_NOT_FOUND'
        throw error
      }
      const deposited = []
      for (const insight of insights) {
        deposited.push(await this.depositInsightToKnowledge({ projectId, insightId: insight.id }))
      }
      await recordAudit(store, {
        projectId,
        action: 'insights-batch-knowledge-deposited',
        summary: `批量沉淀 ${deposited.length} 条洞察`,
        targetType: 'insight-batch',
        targetId: deposited.map((item) => item.insight.id).join(','),
        targetTitle: '洞察批量沉淀',
        meta: {
          count: deposited.length,
          materialIds: deposited.map((item) => item.material.id)
        }
      })
      return {
        depositedCount: deposited.length,
        insights: deposited.map((item) => item.insight),
        materials: deposited.map((item) => item.material)
      }
    },

    async getChangeDetail({ changeId } = {}) {
      const change = getChangeRecord(store, changeId)
      const snapshot = listPageSnapshots(store, {
        projectId: change?.projectId,
        competitorId: change?.competitorId,
        taskId: change?.taskId
      }).find((item) => item.id === change?.newSnapshotId) || null
      return {
        change: changeRecordDto(change),
        snapshot: snapshotDto(snapshot),
        analysis: analysisDetailDto(getAiAnalysisByChangeId(store, change?.id || ''))
      }
    }
  }
}
