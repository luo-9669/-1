import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageUrl = new URL('../frontend/src/pages/competitor-analysis/CompetitorAnalysisPage.vue', import.meta.url)
const dataTableUrl = new URL('../frontend/src/components/base/BaseDataTable.vue', import.meta.url)
const apiUrl = new URL('../frontend/src/services/api.js', import.meta.url)
const frontendPackageUrl = new URL('../frontend/package.json', import.meta.url)
const backendServiceUrl = new URL('../backend/services/competitor-analysis-engine-service.js', import.meta.url)
const monitorServiceUrl = new URL('../backend/services/competitor-monitor-service.js', import.meta.url)
const workspaceStoreUrl = new URL('../backend/services/workspace-store.js', import.meta.url)
const competitorRoutesUrl = new URL('../backend/routes/competitors.js', import.meta.url)
const mockApiUrl = new URL('../backend/server/mock-api.mjs', import.meta.url)
const adminConsoleUrl = new URL('../backend/services/admin-console.js', import.meta.url)

function cssRule(source, selector) {
  return source.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[\\s\\S]*?\\}`))?.[0] || ''
}

test('competitor analysis dialog uses the confirmed field order and selectors', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.ok(
    pageSource.indexOf('选择分析类型') < pageSource.indexOf('选择分析竞品'),
    'analysis type should appear before competitor selection'
  )
  assert.ok(
    pageSource.indexOf('选择分析竞品') < pageSource.indexOf('分析的功能名称'),
    'competitor selection should appear before feature name'
  )
  assert.ok(
    pageSource.indexOf('分析的功能名称') < pageSource.indexOf('分析的目标'),
    'feature name should appear before analysis goal'
  )
  assert.match(pageSource, /v-if="analysisRequiresScopeFields"/)
  assert.match(pageSource, /const analysisRequiresScopeFields = computed/)
  assert.match(pageSource, /!\['daily', 'weekly'\]\.includes\(analysisForm\.kind\)/)
  assert.match(pageSource, /analysisCompetitorOptions/)
  assert.match(pageSource, /handleAnalysisCompetitorChange/)
  assert.match(pageSource, /multiple/)
  assert.match(pageSource, /collapse-tags/)
  assert.match(pageSource, /<ElOption label="全部" value="__all__" \/>/)
  assert.doesNotMatch(pageSource, /pinnedCompetitorOptions/)
  assert.doesNotMatch(pageSource, /togglePinnedCompetitor/)
  assert.doesNotMatch(pageSource, /showAllCompetitors/)
  assert.doesNotMatch(pageSource, />展示所有竞品</)
  assert.match(pageSource, /feature:\s*record\.feature/)
  assert.match(pageSource, /goal:\s*record\.goal/)
  assert.match(pageSource, /<ElSelect\s+v-model="analysisForm\.kind"/)
  assert.match(pageSource, /<ElOption v-for="item in analysisTabs"/)
  assert.doesNotMatch(pageSource, /class="competitor-analysis-kind-select"/)
})

test('competitor analysis list does not auto-restore stale latest temp reports into empty projects', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const refreshStart = pageSource.indexOf('async function refreshPageData()')
  const refreshEnd = pageSource.indexOf('onMounted', refreshStart)
  const refreshSource = pageSource.slice(refreshStart, refreshEnd)

  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'refreshPageData should be present')
  assert.match(refreshSource, /await Promise\.all\(\[loadCompetitors\(\), loadRecords\(\)\]\)/)
  assert.doesNotMatch(refreshSource, /loadLatestAnalysis\(\)/)
  assert.match(pageSource, /Current project records are authoritative/)
  assert.doesNotMatch(pageSource, /const canConfirmAnalysis = computed/)
})

test('competitor analysis restores primary tabs with competitor table first', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const backendServiceSource = await readFile(backendServiceUrl, 'utf8')
  const primaryTabsRule = cssRule(pageSource, '.competitor-analysis-primary-tabs')
  const primaryTabsStart = pageSource.indexOf('const primaryTabs = [')
  const primaryTabsEnd = pageSource.indexOf(']', primaryTabsStart)
  const primaryTabsSource = pageSource.slice(primaryTabsStart, primaryTabsEnd)

  assert.match(pageSource, /BaseTabs/)
  assert.match(pageSource, /class="competitor-analysis-primary-tabs"/)
  assert.match(pageSource, /label="竞品分析"/)
  assert.match(pageSource, /@change="setActiveKind"/)
  assert.match(pageSource, /const primaryTabs = \[/)
  assert.match(pageSource, /\{ value: 'competitors', label: '竞品表' \}/)
  assert.match(pageSource, /\{ value: 'daily', label: '每日生成' \}/)
  assert.ok(
    primaryTabsSource.indexOf("value: 'competitors'") < primaryTabsSource.indexOf("value: 'daily'") &&
    primaryTabsSource.indexOf("value: 'daily'") < primaryTabsSource.indexOf("value: 'weekly'") &&
    primaryTabsSource.indexOf("value: 'weekly'") < primaryTabsSource.indexOf("value: 'flow'") &&
    primaryTabsSource.indexOf("value: 'flow'") < primaryTabsSource.indexOf("value: 'framework'") &&
    primaryTabsSource.indexOf("value: 'framework'") < primaryTabsSource.indexOf("value: 'gap'"),
    'primary tabs should be competitor table, daily, weekly, flow, framework, gap'
  )
  assert.match(pageSource, /const activeKind = ref\('competitors'\)/)
  assert.match(pageSource, /kind: 'daily'/)
  assert.match(pageSource, /record\.kind !== activeKind\.value/)
  assert.match(pageSource, /if \(\['daily', 'weekly'\]\.includes\(record\.kind\)\) return '全部功能'/)
  assert.match(pageSource, /kind:\s*\['daily', 'weekly', 'flow', 'framework', 'gap'\]\.includes\(record\.kind\)/)
  assert.match(pageSource, /:items="primaryTabs"/)
  assert.match(pageSource, /<ElOption v-for="item in analysisTabs"/)
  assert.doesNotMatch(pageSource, /<ElOption[^>]+label="竞品表"/)
  assert.match(primaryTabsRule, /display:\s*flex/)
  assert.match(primaryTabsRule, /gap:\s*28px/)
  assert.match(primaryTabsRule, /min-height:\s*44px/)
  assert.doesNotMatch(primaryTabsRule, /display:\s*block/)
  assert.doesNotMatch(pageSource, /\.competitor-analysis-primary-tabs\s+:deep\(\.ui-tabs\)/)
  assert.match(backendServiceSource, /return '每日生成'/)
  assert.doesNotMatch(pageSource, />竞品分析<\/h1>/)
  assert.doesNotMatch(pageSource, /<ElOption label="分析类型" value="all" \/>/)
  assert.doesNotMatch(pageSource, /筛选分析类型/)
})

test('competitor analysis competitor table tab renders project competitors as the first view', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const apiSource = await readFile(apiUrl, 'utf8')
  const monitorServiceSource = await readFile(monitorServiceUrl, 'utf8')
  const workspaceStoreSource = await readFile(workspaceStoreUrl, 'utf8')
  const competitorRoutesSource = await readFile(competitorRoutesUrl, 'utf8')
  const mockApiSource = await readFile(mockApiUrl, 'utf8')
  const competitorTableStart = pageSource.indexOf("v-if=\"activeKind === 'competitors'\"")
  const competitorTableEnd = pageSource.indexOf('<section v-else class="competitor-analysis-list-card">', competitorTableStart)
  const competitorTableSource = pageSource.slice(competitorTableStart, competitorTableEnd)

  assert.ok(competitorTableStart >= 0, 'competitor table should render before analysis record list')
  assert.match(competitorTableSource, /class="competitor-analysis-competitor-table-section"/)
  assert.match(competitorTableSource, /filteredCompetitors/)
  assert.match(competitorTableSource, /<th>竞品名称<\/th>/)
  assert.match(competitorTableSource, /<th>官网地址<\/th>/)
  assert.match(competitorTableSource, /<th>来源<\/th>/)
  assert.match(competitorTableSource, /<th>更新时间<\/th>/)
  assert.match(competitorTableSource, /<th>操作<\/th>/)
  assert.match(competitorTableSource, /competitorSourceLabel\(competitor\)/)
  assert.match(competitorTableSource, /competitor\.websiteUrl/)
  assert.match(competitorTableSource, /openEditCompetitorDialog\(competitor\)/)
  assert.match(competitorTableSource, /deleteCompetitor\(competitor\)/)
  assert.match(competitorTableSource, />编辑</)
  assert.match(competitorTableSource, />删除</)
  assert.match(competitorTableSource, /暂无竞品/)
  assert.match(pageSource, /const filteredCompetitors = computed/)
  assert.match(pageSource, /function competitorSourceLabel/)
  assert.match(pageSource, /const editingCompetitorId = ref\(''\)/)
  assert.match(pageSource, /function openEditCompetitorDialog/)
  assert.match(pageSource, /async function handleSaveCompetitor/)
  assert.match(pageSource, /async function deleteCompetitor/)
  assert.match(pageSource, /api\.competitors\.update/)
  assert.match(pageSource, /api\.competitors\.delete/)
  assert.match(pageSource, /\{\{ editingCompetitorId \? '编辑竞品' : '新增竞品' \}\}/)
  assert.match(pageSource, /@click="handleSaveCompetitor"/)
  assert.match(pageSource, /python-default/)
  assert.match(apiSource, /update\(config, competitorId, payload = \{\}\)/)
  assert.match(apiSource, /delete\(config, competitorId, payload = \{\}\)/)
  assert.match(competitorRoutesSource, /PATCH \/api\/competitors\/:id/)
  assert.match(competitorRoutesSource, /DELETE \/api\/competitors\/:id/)
  assert.match(monitorServiceSource, /async updateCompetitor/)
  assert.match(monitorServiceSource, /async deleteCompetitor/)
  assert.match(workspaceStoreSource, /export async function updateCompetitor/)
  assert.match(workspaceStoreSource, /export async function deleteCompetitor/)
  assert.match(mockApiSource, /updateCompetitor/)
  assert.match(mockApiSource, /deleteCompetitor/)
  assert.doesNotMatch(competitorTableSource, /competitor-analysis-list-card[\s\S]*competitor-analysis-table-wrap[\s\S]*BaseDataTable[\s\S]*BaseDataTable/)
})

test('admin console labels competitor objects as the competitor table, not monitor reports', async () => {
  const adminConsoleSource = await readFile(adminConsoleUrl, 'utf8')

  assert.match(adminConsoleSource, /data-view="competitors">竞品表<\/button>/)
  assert.match(adminConsoleSource, /title:\s*'竞品表'/)
  assert.match(adminConsoleSource, /对应前台“竞品分析”的“竞品表”/)
  assert.match(adminConsoleSource, /data-view="competitorAnalysis">竞品分析<\/button>/)
  assert.doesNotMatch(adminConsoleSource, /data-view="competitors">竞品监控<\/button>/)
  assert.doesNotMatch(adminConsoleSource, /title:\s*'竞品监控'/)
  assert.doesNotMatch(adminConsoleSource, /对应前台“竞品监控”/)
})

test('competitor analysis display removes nested framed panels', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(pageSource, /<BaseCard class="competitor-analysis-detail-card">/)
  assert.doesNotMatch(pageSource, /\.competitor-analysis-dialog-section\s*\{[^}]*border:/)
  assert.doesNotMatch(pageSource, /\.competitor-analysis-artifact-card\s*\{[^}]*border:/)
})

test('competitor analysis list shows feature display and markdown detail rendering', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const apiSource = await readFile(apiUrl, 'utf8')
  const backendServiceSource = await readFile(backendServiceUrl, 'utf8')
  const mockApiSource = await readFile(mockApiUrl, 'utf8')

  assert.match(pageSource, /<th>功能展示<\/th>/)
  assert.match(pageSource, /recordFeatureLabel\(record\)/)
  assert.match(pageSource, /names\.join\('、'\)/)
  assert.match(pageSource, /markdownBlocksFor/)
  assert.match(pageSource, /competitor-analysis-md-table/)
  assert.match(pageSource, /class="competitor-analysis-row-actions"/)
  assert.match(pageSource, /@click\.stop="deleteRecord\(record\)"/)
  assert.match(pageSource, /class="competitor-analysis-delete-button"/)
  assert.match(pageSource, /function deleteRecord/)
  assert.match(pageSource, /api\.competitorAnalysis\.deleteRecord/)
  assert.match(apiSource, /deleteRecord\(config, payload = \{\}\)/)
  assert.match(apiSource, /method:\s*'DELETE'/)
  assert.match(backendServiceSource, /async deleteRecord\(input = \{\}\)/)
  assert.match(mockApiSource, /DELETE \/api\/competitor-analysis\/records\/:id/)
  assert.doesNotMatch(pageSource, /<pre v-else-if="selectedDetailMarkdown" class="competitor-analysis-markdown">/)
  assert.doesNotMatch(pageSource, /<pre class="competitor-analysis-markdown">\{\{ selectedInteractionArtifacts\.documentMarkdown \}\}<\/pre>/)
})

test('competitor analysis detail renders fenced markdown code blocks as code blocks', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const parserStart = pageSource.indexOf('function markdownBlocksFor')
  const parserEnd = pageSource.indexOf('function markdownBlockKey', parserStart)
  const parserSource = pageSource.slice(parserStart, parserEnd)

  assert.ok(parserStart >= 0 && parserEnd > parserStart, 'markdownBlocksFor should be present')
  assert.match(parserSource, /fence/i)
  assert.match(parserSource, /type:\s*'code'/)
  assert.match(parserSource, /language/)
  assert.match(pageSource, /block\.type === 'code'/)
  assert.match(pageSource, /class="competitor-analysis-md-code"/)
  assert.match(pageSource, /\.competitor-analysis-md-code/)
})

test('competitor analysis detail enhances structured markdown tables without changing raw markdown', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const enhancerStart = pageSource.indexOf('function enhancedMarkdownBlocksFor')
  const enhancerEnd = pageSource.indexOf('function markdownBlockKey', enhancerStart)
  const enhancerSource = pageSource.slice(enhancerStart, enhancerEnd)
  const classifierStart = pageSource.indexOf('function classifyMarkdownTableBlock')
  const classifierEnd = pageSource.indexOf('function enhancedMarkdownBlocksFor', classifierStart)
  const classifierSource = pageSource.slice(classifierStart, classifierEnd)

  assert.ok(enhancerStart >= 0 && enhancerEnd > enhancerStart, 'enhancedMarkdownBlocksFor should wrap parsed markdown blocks')
  assert.ok(classifierStart >= 0 && classifierEnd > classifierStart, 'classifyMarkdownTableBlock should be present')
  assert.match(enhancerSource, /classifyMarkdownTableBlock/)
  assert.match(classifierSource, /flow-table/)
  assert.match(classifierSource, /state-machine-table/)
  assert.match(classifierSource, /page-overview-table/)
  assert.match(enhancerSource, /architecture-map/)
  assert.match(enhancerSource, /headingContext/)
  assert.match(pageSource, /enhancedMarkdownBlocksFor\(selectedInteractionArtifacts\.documentMarkdown\)/)
  assert.match(pageSource, /enhancedMarkdownBlocksFor\(selectedDetailMarkdown\)/)
  assert.match(pageSource, /class="competitor-analysis-flow-timeline"/)
  assert.match(pageSource, /class="competitor-analysis-state-board"/)
  assert.match(pageSource, /class="competitor-analysis-page-card-grid"/)
  assert.match(pageSource, /class="competitor-analysis-architecture-map"/)
  assert.match(pageSource, /class="competitor-analysis-md-table"/)
})

test('competitor analysis report modal lets long markdown scroll without clipping content', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const reportDialogRule = cssRule(pageSource, '.competitor-analysis-report-dialog')
  const detailCardRule = cssRule(pageSource, '.competitor-analysis-report-dialog .competitor-analysis-detail-card')
  const markdownRule = cssRule(pageSource, '.competitor-analysis-markdown')

  assert.match(reportDialogRule, /height:\s*min\(860px,\s*calc\(100vh - 48px\)\)/)
  assert.match(reportDialogRule, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/)
  assert.match(detailCardRule, /overflow:\s*auto/)
  assert.match(markdownRule, /max-height:\s*none/)
  assert.match(markdownRule, /overflow:\s*visible/)
  assert.doesNotMatch(markdownRule, /max-height:\s*calc\(100vh - 300px\)/)
})

test('monitor report detail shows structured feature events and deep analysis action', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const backendServiceSource = await readFile(backendServiceUrl, 'utf8')

  assert.match(backendServiceSource, /featureEvents:\s*normalizeFeatureEvents/)
  assert.match(backendServiceSource, /extractFeatureEventsFromAnalysisData/)
  assert.match(pageSource, /selectedFeatureEvents/)
  assert.match(pageSource, /新功能事件/)
  assert.match(pageSource, /featureEventName\(event\)/)
  assert.match(pageSource, /featureEventCompetitorName\(event\)/)
  assert.match(pageSource, /featureEventSourceText\(event\)/)
  assert.match(pageSource, /deepAnalyzeFeatureEvent\(event\)/)
  assert.match(pageSource, /kind:\s*'flow'/)
  assert.match(pageSource, /feature:\s*featureEventName\(event\)/)
  assert.match(pageSource, /goal:\s*`基于监控报告发现的新功能/)
  assert.match(pageSource, /result\.data\?\.featureEvents/)
  assert.match(pageSource, /featureEvents:\s*normalizeFeatureEvents\(record\.featureEvents/)
  assert.doesNotMatch(pageSource, /competitor-analysis-feature-event-card/)
})

test('competitor analysis detail footer exposes report actions', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const detailFooterRule = cssRule(pageSource, '.competitor-analysis-detail-actions')

  assert.match(pageSource, /class="competitor-analysis-detail-actions"/)
  assert.match(pageSource, /selectedDetailMetaRows/)
  assert.match(pageSource, /competitor-analysis-detail-meta/)
  assert.match(pageSource, /detailMetaRowsForRecord/)
  assert.match(pageSource, /formatDuration/)
  assert.match(pageSource, /copySelectedReport/)
  assert.match(pageSource, /downloadSelectedReport/)
  assert.match(pageSource, /quickAnalyzeSelectedReport/)
  assert.match(pageSource, /canQuickAnalyzeSelectedRecord/)
  assert.match(pageSource, /selectedReportCopyText/)
  assert.match(pageSource, />快速分析</)
  assert.match(pageSource, />下载报告</)
  assert.match(pageSource, /kind:\s*'gap'/)
  assert.match(pageSource, /sourceContent:\s*content/)
  assert.match(pageSource, /sourceRecordId:\s*record\.id/)
  assert.match(pageSource, /runGapAnalysis\(created,\s*draft\)/)
  assert.match(pageSource, /api\.competitorAnalysis\.run\(props\.apiConfig,\s*requestBodyForRecord\(createdRecord\)\)/)
  assert.doesNotMatch(pageSource, /emit\('quick-analyze-report'/)
  assert.match(pageSource, /selectedSourceRecord/)
  assert.match(pageSource, /openSourceRecord/)
  assert.match(pageSource, />查看来源报告</)
  assert.match(pageSource, /selectedRecord\.value\?\.kind !== 'gap'/)
  assert.match(pageSource, />复制报告</)
  assert.match(pageSource, /selectedFeatureEventId/)
  assert.match(pageSource, /selectedFeatureEventForAction/)
  assert.match(pageSource, /selectedFeatureEvents\.length > 1/)
  assert.match(pageSource, /placeholder="选择新功能"/)
  assert.match(pageSource, />深度分析</)
  assert.match(pageSource, /deepAnalyzeFeatureEvent\(selectedFeatureEventForAction\)/)
  assert.match(pageSource, /navigator\.clipboard\.writeText/)
  assert.match(pageSource, /URL\.createObjectURL/)
  assert.match(pageSource, /selectedReportFileName/)
  assert.match(detailFooterRule, /justify-content:\s*flex-end/)
  assert.doesNotMatch(detailFooterRule, /border:\s*1px/)
  assert.doesNotMatch(pageSource, /competitor-analysis-detail-actions-card/)
  assert.doesNotMatch(pageSource, /深度分析首个新功能/)
  assert.doesNotMatch(pageSource, /deepAnalyzeFeatureEvent\(selectedFeatureEvents\[0\]\)/)
})

test('competitor analysis detail meta follows five-tab display rules without frontend business conclusions', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const metaStart = pageSource.indexOf('function detailMetaRowsForRecord')
  const metaEnd = pageSource.indexOf('function formatTime', metaStart)
  const metaSource = pageSource.slice(metaStart, metaEnd)

  assert.ok(metaStart >= 0 && metaEnd > metaStart, 'detail meta helper should be present')
  assert.match(metaSource, /标题/)
  assert.match(metaSource, /状态/)
  assert.match(metaSource, /耗时/)
  assert.match(metaSource, /竞品/)
  assert.match(metaSource, /功能/)
  assert.match(metaSource, /产品URL/)
  assert.match(metaSource, /证据质量/)
  assert.match(metaSource, /来源报告/)
  assert.match(metaSource, /来源类型/)
  assert.doesNotMatch(metaSource, /SIG01|CHG01|OP01|机会点标题|战略建议/)
})

test('competitor analysis creates combined monitor records and per competitor deep analysis records', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const recordDraftStart = pageSource.indexOf('function recordsForSelectedCompetitors()')
  const recordDraftEnd = pageSource.indexOf('function setDialogKind', recordDraftStart)
  const recordDraftSource = pageSource.slice(recordDraftStart, recordDraftEnd)

  assert.match(recordDraftSource, /const selected = selectedCompetitors\(\)/)
  assert.match(recordDraftSource, /if \(\['daily', 'weekly'\]\.includes\(analysisForm\.kind\)\)/)
  assert.match(recordDraftSource, /competitorIds:\s*selected\.map\(\(item\) => item\.id\)\.filter\(Boolean\)/)
  assert.match(recordDraftSource, /competitorNames:\s*selected\.map\(competitorDisplayName\)/)
  assert.match(recordDraftSource, /productUrls:\s*selected\.map\(competitorWebsiteUrl\)/)
  assert.match(recordDraftSource, /competitorName:\s*selected\.map\(competitorDisplayName\)\.join\('、'\)/)
  assert.match(recordDraftSource, /return selected\.map\(\(item\) =>/)
  assert.match(recordDraftSource, /competitorIds:\s*\[item\.id\]/)
  assert.match(recordDraftSource, /competitorNames:\s*\[name\]/)
  assert.match(recordDraftSource, /productUrls:\s*\[websiteUrl\]/)
  assert.match(pageSource, /productUrls:\s*Array\.isArray\(record\.productUrls\) \? record\.productUrls : \[\]/)
  assert.match(pageSource, /productUrls:\s*record\.productUrls/)
})

test('competitor analysis confirm shows running records before waiting for backend work', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const confirmStart = pageSource.indexOf('async function handleConfirmAnalysis()')
  const confirmEnd = pageSource.indexOf('async function runAnalysisForRecord', confirmStart)
  const confirmSource = pageSource.slice(confirmStart, confirmEnd)

  assert.ok(confirmStart >= 0 && confirmEnd > confirmStart, 'confirm handler should be present')
  assert.ok(
    confirmSource.indexOf('closeAnalysisDialog()') < confirmSource.indexOf('api.competitorAnalysis.createRecord'),
    'the dialog should close before any backend request can block'
  )
  assert.ok(
    confirmSource.indexOf('recordsForSelectedCompetitors()') < confirmSource.indexOf('api.competitorAnalysis.createRecord'),
    'record drafts should be prepared before the backend request'
  )
  assert.ok(
    confirmSource.indexOf('mergeRecord({') < confirmSource.indexOf('api.competitorAnalysis.createRecord'),
    'a visible running record should be inserted before the backend request'
  )
  assert.ok(
    confirmSource.indexOf('await nextTick()') >= 0 &&
    confirmSource.indexOf('await nextTick()') < confirmSource.indexOf('api.competitorAnalysis.createRecord'),
    'the running table should render before the backend request starts'
  )
  assert.match(confirmSource, /status:\s*'running'/)
  assert.match(confirmSource, /statusLabel:\s*'分析中'/)
  assert.match(confirmSource, /summary:\s*'分析任务已创建，正在调用竞品分析引擎。'/)
})

test('competitor analysis refresh preserves local running gap records until backend returns them', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const loadRecordsStart = pageSource.indexOf('async function loadRecords()')
  const loadRecordsEnd = pageSource.indexOf('async function loadLatestAnalysis()', loadRecordsStart)
  const loadRecordsSource = pageSource.slice(loadRecordsStart, loadRecordsEnd)

  assert.ok(loadRecordsStart >= 0 && loadRecordsEnd > loadRecordsStart, 'loadRecords should be present')
  assert.match(pageSource, /function mergeBackendRecordsWithLocalRunning/)
  assert.match(loadRecordsSource, /mergeBackendRecordsWithLocalRunning\(result\.data\.records\.map\(normalizeRecord\)\)/)
  assert.match(pageSource, /runningRecordIds\.value\.has\(record\.id\)/)
  assert.match(pageSource, /backendIds\.has\(record\.id\)/)
})

test('competitor analysis keeps gap draft visible before switching to the gap tab', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const quickAnalyzeStart = pageSource.indexOf('function quickAnalyzeSelectedReport()')
  const quickAnalyzeEnd = pageSource.indexOf('async function runGapAnalysis', quickAnalyzeStart)
  const quickAnalyzeSource = pageSource.slice(quickAnalyzeStart, quickAnalyzeEnd)
  const markRunningIndex = quickAnalyzeSource.indexOf('markRecordRunning(created.id)')
  const mergeIndex = quickAnalyzeSource.indexOf('mergeRecord({')
  const setActiveKindIndex = quickAnalyzeSource.indexOf("setActiveKind('gap')")

  assert.ok(quickAnalyzeStart >= 0 && quickAnalyzeEnd > quickAnalyzeStart, 'quickAnalyzeSelectedReport should be present')
  assert.ok(markRunningIndex >= 0, 'quickAnalyzeSelectedReport should mark the gap draft as running')
  assert.ok(mergeIndex >= 0, 'quickAnalyzeSelectedReport should merge the gap draft locally')
  assert.ok(setActiveKindIndex >= 0, 'quickAnalyzeSelectedReport should switch to the gap tab')
  assert.ok(
    markRunningIndex < setActiveKindIndex,
    'gap draft should be marked running before setActiveKind triggers a list refresh'
  )
  assert.ok(
    mergeIndex < setActiveKindIndex,
    'gap draft should be merged locally before switching to the gap tab'
  )
})

test('competitor analysis merges the backend-created gap record before long model generation finishes', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const runGapStart = pageSource.indexOf('async function runGapAnalysis')
  const runGapEnd = pageSource.indexOf('async function copySelectedReport', runGapStart)
  const runGapSource = pageSource.slice(runGapStart, runGapEnd)

  assert.ok(runGapStart >= 0 && runGapEnd > runGapStart, 'runGapAnalysis should be present')
  assert.match(runGapSource, /const createdRecord = createResult\.ok/)
  assert.match(runGapSource, /mergeRecord\(createdRecord\)/)
  assert.ok(
    runGapSource.indexOf('mergeRecord(createdRecord)') < runGapSource.indexOf('api.competitorAnalysis.run'),
    'backend-created gap record should appear in the list before waiting for the model run'
  )
})

test('competitor analysis dialog type is bound to the primary tab state', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const dialogKindStart = pageSource.indexOf('function setDialogKind')
  const dialogKindEnd = pageSource.indexOf('function fillDialogDefaults', dialogKindStart)
  const dialogKindSource = pageSource.slice(dialogKindStart, dialogKindEnd)

  assert.ok(dialogKindStart >= 0 && dialogKindEnd > dialogKindStart, 'setDialogKind should be present')
  assert.match(dialogKindSource, /setActiveKind\(kind\)/)
  assert.doesNotMatch(dialogKindSource, /analysisForm\.kind = kind/)
  assert.match(pageSource, /function currentDialogAnalysisKind\(\)/)
  assert.match(pageSource, /if \(isAnalysisKind\(activeKind\.value\)\) return activeKind\.value/)
  assert.match(pageSource, /if \(isAnalysisKind\(analysisForm\.kind\)\) return analysisForm\.kind/)
  assert.match(pageSource, /const kind = currentDialogAnalysisKind\(\)/)
  assert.doesNotMatch(pageSource, /const kind = analysisForm\.kind/)
  assert.doesNotMatch(pageSource, /const kind = activeKind\.value/)
})

test('competitor analysis confirm shows validation feedback instead of silently doing nothing', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const confirmStart = pageSource.indexOf('async function handleConfirmAnalysis()')
  const confirmEnd = pageSource.indexOf('async function runAnalysisForRecord', confirmStart)
  const confirmSource = pageSource.slice(confirmStart, confirmEnd)
  const validationStart = pageSource.indexOf('function analysisDialogValidationMessage()')
  const validationEnd = pageSource.indexOf('async function handleConfirmAnalysis()', validationStart)
  const validationSource = pageSource.slice(validationStart, validationEnd)

  assert.ok(validationStart >= 0 && validationEnd > validationStart, 'validation helper should be present')
  assert.match(validationSource, /请选择至少一个竞品/)
  assert.match(validationSource, /请输入分析的功能名称/)
  assert.match(validationSource, /请输入分析目标/)
  assert.match(pageSource, /analysisDialogMessage = ref\(''\)/)
  assert.match(pageSource, /class="competitor-analysis-dialog-message"/)
  assert.match(pageSource, /submittingAnalysis = ref\(false\)/)
  assert.match(pageSource, /:disabled="submittingAnalysis"/)
  assert.doesNotMatch(pageSource, /:disabled="!canConfirmAnalysis \|\| running"/)
  assert.match(confirmSource, /const validationMessage = analysisDialogValidationMessage\(\)/)
  assert.match(confirmSource, /analysisDialogMessage\.value = validationMessage/)
  assert.match(confirmSource, /if \(validationMessage\) \{[\s\S]*?return[\s\S]*?\}/)
})

test('competitor analysis shows a table shell while a new analysis is starting', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.match(pageSource, /<BaseDataTable v-if="filteredRecords\.length \|\| hasRunningTasks"/)
  assert.match(pageSource, /v-if="hasRunningTasks && !filteredRecords\.length"/)
  assert.match(pageSource, /正在创建分析记录/)
  assert.match(pageSource, /colspan="6"/)
})

test('competitor analysis can submit additional tasks while previous analyses run', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const confirmStart = pageSource.indexOf('async function handleConfirmAnalysis()')
  const confirmEnd = pageSource.indexOf('async function runAnalysisForRecord', confirmStart)
  const confirmSource = pageSource.slice(confirmStart, confirmEnd)

  assert.match(pageSource, /const runningRecordIds = ref\(new Set\(\)\)/)
  assert.match(pageSource, /const hasRunningTasks = computed\(\(\) => runningRecordIds\.value\.size > 0\)/)
  assert.match(pageSource, /function markRecordRunning\(id = ''\)/)
  assert.match(pageSource, /function clearRecordRunning\(id = ''\)/)
  assert.match(pageSource, /<BaseButton variant="primary" type="button" @click="openAnalysisDialog">/)
  assert.match(pageSource, /<BaseButton variant="primary" type="button" @click="openAnalysisDialog">[\s\S]*?开始分析[\s\S]*?<\/BaseButton>/)
  assert.doesNotMatch(pageSource, /正在分析/)
  assert.doesNotMatch(confirmSource, /for \(const record of createdRecords\) \{\s*await runAnalysisForRecord\(record\)\s*\}/)
  assert.match(confirmSource, /const runTasks = createdRecords\.map\(\(record\) => runAnalysisForRecord\(record\)\)/)
  assert.match(confirmSource, /void Promise\.allSettled\(runTasks\)/)
})

test('competitor analysis refreshes backend data when switching primary tabs', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const setKindStart = pageSource.indexOf('function setActiveKind')
  const setKindEnd = pageSource.indexOf('function statusLabel', setKindStart)
  const setKindSource = pageSource.slice(setKindStart, setKindEnd)

  assert.ok(setKindStart >= 0 && setKindEnd > setKindStart, 'setActiveKind should be present')
  assert.match(setKindSource, /void refreshActiveKindData\(kind\)/)
  assert.doesNotMatch(setKindSource, /running\.value/)
  assert.match(pageSource, /async function refreshActiveKindData\(kind = activeKind\.value\)/)
  assert.match(pageSource, /if \(kind === 'competitors'\) \{\s*await loadCompetitors\(\)\s*return\s*\}/)
  assert.match(pageSource, /await loadRecords\(\)/)
  assert.match(pageSource, /watch\(\(\) => activeKind\.value, \(kind\) => \{/)
  assert.match(pageSource, /\}, \{ immediate: true \}\)/)
})

test('competitor analysis uses the account-bound project id before the route fallback for backend reads', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.match(pageSource, /function routeProjectIdFromLocation\(\)/)
  assert.match(pageSource, /const effectiveProjectId = computed/)
  assert.match(pageSource, /props\.projectId \|\| routeProjectIdFromLocation\(\) \|\| 'default'/)
  assert.match(pageSource, /api\.competitors\.list\(props\.apiConfig, requestProjectId\)/)
  assert.match(pageSource, /projectId:\s*effectiveProjectId\.value/)
  assert.doesNotMatch(pageSource, /api\.competitorAnalysis\.listRecords\(props\.apiConfig,\s*\{\s*projectId:\s*props\.projectId/)
})

test('competitor analysis ignores stale project responses after project switching', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const competitorsStart = pageSource.indexOf('async function loadCompetitors()')
  const competitorsEnd = pageSource.indexOf('async function loadRecords()', competitorsStart)
  const competitorsSource = pageSource.slice(competitorsStart, competitorsEnd)
  const recordsStart = pageSource.indexOf('async function loadRecords()')
  const recordsEnd = pageSource.indexOf('async function loadLatestAnalysis()', recordsStart)
  const recordsSource = pageSource.slice(recordsStart, recordsEnd)

  assert.ok(competitorsStart >= 0 && competitorsEnd > competitorsStart, 'loadCompetitors should be present')
  assert.ok(recordsStart >= 0 && recordsEnd > recordsStart, 'loadRecords should be present')
  assert.match(competitorsSource, /const requestProjectId = effectiveProjectId\.value/)
  assert.match(competitorsSource, /api\.competitors\.list\(props\.apiConfig, requestProjectId\)/)
  assert.match(competitorsSource, /if \(requestProjectId !== effectiveProjectId\.value\) return/)
  assert.match(recordsSource, /const requestProjectId = effectiveProjectId\.value/)
  assert.match(recordsSource, /projectId:\s*requestProjectId/)
  assert.match(recordsSource, /if \(requestProjectId !== effectiveProjectId\.value\) return/)
})

test('competitor analysis ignores empty feature event payloads from backend records', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const normalizeStart = pageSource.indexOf('function normalizeFeatureEvents(events = [])')
  const normalizeEnd = pageSource.indexOf('function normalizeRecord(record = {})', normalizeStart)
  const normalizeSource = pageSource.slice(normalizeStart, normalizeEnd)

  assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, 'normalizeFeatureEvents should be present')
  assert.match(normalizeSource, /filter\(\(event\) => event && typeof event === 'object'\)/)
  assert.ok(
    normalizeSource.indexOf("typeof event === 'object'") < normalizeSource.indexOf('.map((event) =>'),
    'empty or non-object feature events should be removed before mapping'
  )
  assert.match(pageSource, /sourceFeatureEvent:\s*normalizeFeatureEvents\(\[record\.sourceFeatureEvent \|\| record\.source_feature_event\]\)\.at\(0\) \|\| null/)
})

test('competitor analysis page adds figma-matched search and filters below the title', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')
  const dataTableSource = await readFile(dataTableUrl, 'utf8')
  const frontendPackageSource = await readFile(frontendPackageUrl, 'utf8')
  const filterBarRule = cssRule(pageSource, '.competitor-analysis-filter-bar')
  const pageRule = cssRule(pageSource, '.competitor-analysis-page')
  const filterSearchRule = cssRule(pageSource, '.competitor-analysis-filter-search')
  const filterFieldRule = cssRule(pageSource, '.competitor-analysis-filter-field')
  const filterPopperRule = cssRule(pageSource, ':global(.competitor-analysis-filter-popper)')
  const filterPopperOptionRule = cssRule(pageSource, ':global(.competitor-analysis-filter-popper .el-select-dropdown__item.is-selected)')
  const tableWrapRule = cssRule(pageSource, '.competitor-analysis-table-wrap')
  const listCardRule = cssRule(pageSource, '.competitor-analysis-list-card')
  const detailCardRule = cssRule(pageSource, '.competitor-analysis-detail-card')

  assert.ok(
    pageSource.indexOf('class="competitor-analysis-filter-bar"') > pageSource.indexOf('class="competitor-analysis-toolbar"'),
    'filter bar should render below the title toolbar'
  )
  assert.ok(
    pageSource.indexOf('class="competitor-analysis-filter-bar"') < pageSource.indexOf('<section v-else class="competitor-analysis-list-card">'),
    'filter bar should render above the analysis list'
  )
  assert.ok(
    pageSource.indexOf('class="competitor-analysis-filter-left"') < pageSource.indexOf('class="competitor-analysis-filter-right"'),
    'filter controls should stay on the left and search controls on the right'
  )
  assert.ok(
    pageSource.indexOf('class="competitor-analysis-filter-field"') < pageSource.indexOf('class="competitor-analysis-filter-search"'),
    'figma layout places dropdown filters before search'
  )
  assert.match(frontendPackageSource, /"element-plus"/)
  assert.match(pageSource, /from 'element-plus'/)
  assert.match(pageSource, /<ElSelect/)
  assert.match(pageSource, /<ElOption/)
  assert.match(pageSource, /<ElInput/)
  assert.doesNotMatch(pageSource, /<ElButton/)
  assert.doesNotMatch(pageSource, /competitor-analysis-filter-query/)
  assert.doesNotMatch(pageSource, />查询<\/ElButton>/)
  assert.match(pageSource, /popper-class="competitor-analysis-filter-popper"/)
  assert.doesNotMatch(pageSource, /<select/)
  assert.doesNotMatch(pageSource, /BaseSearchInput/)
  assert.match(pageSource, /BaseDataTable/)
  assert.match(pageSource, /table-class="competitor-analysis-table"/)
  assert.match(pageSource, /placeholder="搜索报告、竞品、功能或目标"/)
  assert.match(pageSource, /筛选竞品/)
  assert.match(pageSource, /筛选状态/)
  assert.match(pageSource, /recordMatchesFilters/)
  assert.match(pageSource, /competitorFilterOptions/)
  assert.match(pageSource, /var\(--color-primary\)/)
  assert.match(pageSource, /var\(--color-n2\)/)
  assert.match(pageRule, /--el-color-primary:\s*var\(--color-primary\)/)
  assert.match(pageRule, /--el-border-radius-base:\s*var\(--radius-small\)/)
  assert.match(filterSearchRule, /--el-input-border-radius:\s*var\(--radius-small\)/)
  assert.match(filterFieldRule, /--el-border-radius-base:\s*var\(--radius-small\)/)
  assert.match(filterPopperRule, /border-radius:\s*var\(--radius-middle\)/)
  assert.match(filterPopperRule, /border:\s*1px\s+solid\s+var\(--color-n2\)/)
  assert.match(filterPopperRule, /background:\s*var\(--color-n0\)/)
  assert.match(filterPopperOptionRule, /background:\s*var\(--color-n1\)/)
  assert.match(filterPopperOptionRule, /color:\s*var\(--color-primary\)/)
  assert.doesNotMatch(pageSource, /#409eff/i)
  assert.doesNotMatch(pageSource, /rgba\(22,\s*119,\s*255/)
  assert.doesNotMatch(filterBarRule, /border:\s*1px/)
  assert.doesNotMatch(filterBarRule, /border-radius:/)
  assert.doesNotMatch(filterBarRule, /background:\s*var\(--color-n0\)/)
  assert.doesNotMatch(filterBarRule, /padding:/)
  assert.match(dataTableSource, /border:\s*1px\s+solid\s+var\(--color-n2\)/)
  assert.match(dataTableSource, /border-radius:\s*var\(--radius-middle\)/)
  assert.match(dataTableSource, /background:\s*var\(--color-n0\)/)
  assert.match(dataTableSource, /font-size:\s*14px/)
  assert.doesNotMatch(tableWrapRule, /border:\s*1px/)
  assert.doesNotMatch(tableWrapRule, /background:\s*var\(--color-n0\)/)
  assert.doesNotMatch(pageSource, /<div v-if="filteredRecords\.length" class="competitor-analysis-table-wrap">\s*<table/)
  assert.doesNotMatch(listCardRule, /background:\s*#fff/)
  assert.doesNotMatch(listCardRule, /background:\s*var\(--color-n0\)/)
  assert.doesNotMatch(listCardRule, /border:\s*1px/)
  assert.doesNotMatch(detailCardRule, /background:\s*#fff/)
  assert.doesNotMatch(detailCardRule, /background:\s*var\(--color-n0\)/)
  assert.doesNotMatch(detailCardRule, /border:\s*1px/)
})

test('competitor analysis record detail opens as a modal over the list', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.match(pageSource, /v-if="selectedRecord" class="competitor-analysis-dialog-backdrop competitor-analysis-detail-backdrop"/)
  assert.match(pageSource, /class="competitor-analysis-dialog competitor-analysis-report-dialog" role="dialog"/)
  assert.match(pageSource, /aria-label="分析报告详情"/)
  assert.match(pageSource, /@click\.self="closeRecord"/)
  assert.match(pageSource, /<section v-else class="competitor-analysis-list-card">/)
  assert.doesNotMatch(pageSource, /返回列表/)
  assert.doesNotMatch(pageSource, /ArrowLeft/)
})

test('competitor analysis detail does not show competitor switch tabs', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(pageSource, /competitor-analysis-report-meta/)
  assert.doesNotMatch(pageSource, /const detailTabs = \[/)
  assert.doesNotMatch(pageSource, /activeDetailTab/)
  assert.doesNotMatch(pageSource, /competitorTabsForSelectedRecord/)
  assert.doesNotMatch(pageSource, /competitor-analysis-secondary-tabs/)
  assert.doesNotMatch(pageSource, /role="tablist" aria-label="分析竞品"/)
  assert.doesNotMatch(pageSource, /selectedDetailCompetitorName/)
  assert.doesNotMatch(pageSource, /selectCompetitorTab\(item\)/)
  assert.doesNotMatch(pageSource, /markdownForCompetitorName/)
  assert.doesNotMatch(pageSource, /未找到该竞品的独立分析内容/)
})

test('competitor analysis page does not hide list content inside a bare template element', async () => {
  const pageSource = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(pageSource, /<section class="competitor-analysis-page">\s*<template>\s*<div class="competitor-analysis-toolbar">/)
  assert.match(pageSource, /<section class="competitor-analysis-page">\s*<div class="competitor-analysis-toolbar">/)
})
