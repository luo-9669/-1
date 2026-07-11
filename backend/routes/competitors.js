function requiredHandler(handlers = {}, name = '') {
  if (typeof handlers[name] === 'function') return handlers[name]
  return async () => {
    const error = new Error(`Competitor route handler is not configured: ${name}`)
    error.code = 'COMPETITOR_HANDLER_NOT_CONFIGURED'
    throw error
  }
}

export function competitorRoutes(handlers = {}) {
  const getOverview = requiredHandler(handlers, 'getOverview')
  const getPermissions = requiredHandler(handlers, 'getPermissions')
  const listProjectMembers = requiredHandler(handlers, 'listProjectMembers')
  const listUiReferences = requiredHandler(handlers, 'listUiReferences')
  const listUiReferenceFavorites = requiredHandler(handlers, 'listUiReferenceFavorites')
  const favoriteUiReference = requiredHandler(handlers, 'favoriteUiReference')
  const unfavoriteUiReference = requiredHandler(handlers, 'unfavoriteUiReference')
  const listCompetitors = requiredHandler(handlers, 'listCompetitors')
  const createCompetitor = requiredHandler(handlers, 'createCompetitor')
  const updateCompetitor = requiredHandler(handlers, 'updateCompetitor')
  const deleteCompetitor = requiredHandler(handlers, 'deleteCompetitor')
  const getCompetitor = requiredHandler(handlers, 'getCompetitor')
  const listTasks = requiredHandler(handlers, 'listTasks')
  const createTask = requiredHandler(handlers, 'createTask')
  const updateTaskStatus = requiredHandler(handlers, 'updateTaskStatus')
  const runCompetitorCheck = requiredHandler(handlers, 'runCompetitorCheck')
  const runDueMonitorTasks = requiredHandler(handlers, 'runDueMonitorTasks')
  const listChanges = requiredHandler(handlers, 'listChanges')
  const getChangeDetail = requiredHandler(handlers, 'getChangeDetail')
  const listReports = requiredHandler(handlers, 'listReports')
  const saveReport = requiredHandler(handlers, 'saveReport')
  const exportReport = requiredHandler(handlers, 'exportReport')
  const shareReport = requiredHandler(handlers, 'shareReport')
  const revokeReportShare = requiredHandler(handlers, 'revokeReportShare')
  const getSharedReport = requiredHandler(handlers, 'getSharedReport')
  const exportSharedReport = requiredHandler(handlers, 'exportSharedReport')
  const listAuditLogs = requiredHandler(handlers, 'listAuditLogs')
  const exportAuditLogs = requiredHandler(handlers, 'exportAuditLogs')
  const listReportVersions = requiredHandler(handlers, 'listReportVersions')
  const compareReportVersions = requiredHandler(handlers, 'compareReportVersions')
  const listInsights = requiredHandler(handlers, 'listInsights')
  const updateInsight = requiredHandler(handlers, 'updateInsight')
  const batchUpdateInsights = requiredHandler(handlers, 'batchUpdateInsights')
  const exportInsight = requiredHandler(handlers, 'exportInsight')
  const batchExportInsights = requiredHandler(handlers, 'batchExportInsights')
  const batchDepositInsightsToKnowledge = requiredHandler(handlers, 'batchDepositInsightsToKnowledge')
  const linkInsightRequirements = requiredHandler(handlers, 'linkInsightRequirements')
  const depositInsightToKnowledge = requiredHandler(handlers, 'depositInsightToKnowledge')
  const saveInsight = requiredHandler(handlers, 'saveInsight')

  return {
    'GET /api/competitor-monitor/overview': async (payload = {}) => getOverview(payload),
    'GET /api/competitor-monitor/permissions': async (payload = {}) => getPermissions(payload),
    'GET /api/competitor-monitor/members': async (payload = {}) => listProjectMembers(payload),
    'GET /api/competitor-monitor/ui-references': async (payload = {}) => listUiReferences(payload),
    'GET /api/competitor-monitor/ui-reference-favorites': async (payload = {}) => listUiReferenceFavorites(payload),
    'POST /api/competitor-monitor/ui-reference-favorites': async (payload = {}) => favoriteUiReference(payload),
    'DELETE /api/competitor-monitor/ui-reference-favorites/:id': async (payload = {}) => unfavoriteUiReference({ ...payload, referenceId: payload.id }),
    'GET /api/competitor-monitor/reports': async (payload = {}) => listReports(payload),
    'POST /api/competitor-monitor/reports/:id/save': async (payload = {}) => saveReport({ ...payload, reportId: payload.id }),
    'GET /api/competitor-monitor/reports/:id/export': async (payload = {}) => exportReport({ ...payload, reportId: payload.id }),
    'POST /api/competitor-monitor/reports/:id/share': async (payload = {}) => shareReport({ ...payload, reportId: payload.id }),
    'POST /api/competitor-monitor/reports/:id/share/revoke': async (payload = {}) => revokeReportShare({ ...payload, reportId: payload.id }),
    'GET /api/competitor-monitor/reports/:id/shared': async (payload = {}) => getSharedReport({ ...payload, reportId: payload.id }),
    'GET /api/competitor-monitor/reports/:id/shared/export': async (payload = {}) => exportSharedReport({ ...payload, reportId: payload.id }),
    'GET /api/competitor-monitor/audit-logs': async (payload = {}) => listAuditLogs(payload),
    'GET /api/competitor-monitor/audit-logs/export': async (payload = {}) => exportAuditLogs(payload),
    'GET /api/competitor-monitor/reports/:id/versions': async (payload = {}) => listReportVersions({ ...payload, reportId: payload.id }),
    'GET /api/competitor-monitor/reports/:id/versions/compare': async (payload = {}) => compareReportVersions({ ...payload, reportId: payload.id }),
    'GET /api/competitor-monitor/insights': async (payload = {}) => listInsights(payload),
    'PATCH /api/competitor-monitor/insights/batch': async (payload = {}) => batchUpdateInsights(payload),
    'POST /api/competitor-monitor/insights/batch-export': async (payload = {}) => batchExportInsights(payload),
    'POST /api/competitor-monitor/insights/batch-deposit-knowledge': async (payload = {}) => batchDepositInsightsToKnowledge(payload),
    'PATCH /api/competitor-monitor/insights/:id': async (payload = {}) => updateInsight({ ...payload, insightId: payload.id }),
    'GET /api/competitor-monitor/insights/:id/export': async (payload = {}) => exportInsight({ ...payload, insightId: payload.id }),
    'POST /api/competitor-monitor/insights/:id/link-requirements': async (payload = {}) => linkInsightRequirements({ ...payload, insightId: payload.id }),
    'POST /api/competitor-monitor/insights/:id/deposit-knowledge': async (payload = {}) => depositInsightToKnowledge({ ...payload, insightId: payload.id }),
    'GET /api/competitors': async (payload = {}) => listCompetitors(payload),
    'POST /api/competitors': async (payload = {}) => createCompetitor(payload),
    'PATCH /api/competitors/:id': async (payload = {}) => updateCompetitor({ ...payload, competitorId: payload.id }),
    'DELETE /api/competitors/:id': async (payload = {}) => deleteCompetitor({ ...payload, competitorId: payload.id }),
    'GET /api/competitors/:id': async (payload = {}) => getCompetitor(payload),
    'GET /api/monitor-tasks': async (payload = {}) => listTasks(payload),
    'POST /api/monitor-tasks': async (payload = {}) => createTask(payload),
    'PATCH /api/monitor-tasks/:id': async (payload = {}) => updateTaskStatus({ ...payload, taskId: payload.id }),
    'POST /api/competitors/:id/check': async (payload = {}) => runCompetitorCheck(payload),
    'POST /api/competitor-monitor/scheduler/run-due': async (payload = {}) => runDueMonitorTasks(payload),
    'GET /api/changes': async (payload = {}) => listChanges(payload),
    'GET /api/changes/:id': async (payload = {}) => getChangeDetail(payload),
    'POST /api/changes/:id/save-as-insight': async (payload = {}) => saveInsight({ ...payload, changeId: payload.id })
  }
}
