function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function parseMarkdownTables(markdown = '') {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const tables = []
  const parseRow = (row = '') => row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cleanText(cell.replace(/\*\*/g, '')))
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index] || ''
    const separator = lines[index + 1] || ''
    const isTableHeader = header.trim().startsWith('|') &&
      separator.trim().startsWith('|') &&
      /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator.trim())
    if (!isTableHeader) continue
    const rows = []
    index += 1
    while (index + 1 < lines.length && lines[index + 1].trim().startsWith('|')) {
      index += 1
      rows.push(parseRow(lines[index]))
    }
    tables.push({ headers: parseRow(header), rows })
  }
  return tables
}

function tableHasColumns(table = null, requiredColumns = []) {
  const headers = Array.isArray(table?.headers) ? table.headers : []
  return requiredColumns.every((required) =>
    headers.some((header) => cleanText(header).includes(required))
  )
}

function firstTableWithColumns(tables = [], requiredColumns = []) {
  return (Array.isArray(tables) ? tables : []).find((table) => tableHasColumns(table, requiredColumns)) || null
}

function tableFilledRows(table = null) {
  return Array.isArray(table?.rows)
    ? table.rows.filter((row) =>
        Array.isArray(row) &&
        row.some((cell) => cleanText(cell))
      )
    : []
}

function tableColumnIndex(table = {}, columnName = '') {
  return (Array.isArray(table?.headers) ? table.headers : [])
    .findIndex((header) => cleanText(header).includes(columnName))
}

function rowsAsObjects(table = null) {
  const headers = Array.isArray(table?.headers) ? table.headers.map(cleanText) : []
  return tableFilledRows(table).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, cleanText(row[index] || '')]))
  )
}

function rowsForColumns(tables = [], columnGroups = []) {
  const groups = Array.isArray(columnGroups?.[0]) ? columnGroups : [columnGroups]
  const table = groups
    .map((columns) => firstTableWithColumns(tables, columns))
    .find(Boolean)
  return rowsAsObjects(table)
}

function stageTwoDocumentArtifact(markdown = '', pageInteractionDocument = {}, pages = []) {
  const tables = parseMarkdownTables(markdown)
  const overviewRows = rowsForColumns(tables, [
    ['编号', '页面名称', '类型', '所属模块', '核心职责'],
    ['页面编号', '页面名称', '页面类型', '核心职责']
  ])
  const flowRows = rowsForColumns(tables, [
    ['源页面', '目标页面', '触发操作', '流转类型'],
    ['源页面', '目标页面', '触发动作', '流转类型']
  ])
  const dataFlowRows = rowsForColumns(tables, [
    ['源页面', '目标页面', '传递数据', '触发动作']
  ])
  const entityRows = rowsForColumns(tables, [
    ['信息实体', '核心属性', '关系/依赖', '状态/流转', '设计提示'],
    ['实体', '核心属性', '关系/依赖', '状态流转', '设计提示']
  ])
  const mainFlowRows = rowsForColumns(tables, [
    ['步骤', '名称', '用户行为', '系统响应', '页面'],
    ['步骤编号', '步骤名称', '用户行为', '系统反馈', '关联页面']
  ])
  const stateRows = rowsForColumns(tables, [
    ['当前状态', '触发事件', '目标状态', '页面表现', '数据变更']
  ])
  const modalRows = rowsForColumns(tables, [
    ['编号', '名称', '触发动作', '关闭行为', '提交/取消去向', '关联页面'],
    ['编号', '弹窗名称', '触发动作', '关闭行为', '去向', '关联页面']
  ])
  const breakpointRows = rowsForColumns(tables, [
    ['断点节点', '断点风险', '优化动作', '覆盖路径'],
    ['断点', '位置', '问题描述', '用户影响', '优化方案']
  ])
  const globalInteractionRows = rowsForColumns(tables, [
    ['规范类型', '规则', '示例', '例外'],
    ['类型', '规则', '示例', '例外']
  ])
  const planComparisonRows = rowsForColumns(tables, [
    ['对比维度', '方案A', '方案B', '方案C'],
    ['维度', '方案一', '方案二', '方案三']
  ])
  const fitRows = rowsForColumns(tables, [
    ['核心问题', '对应方案', '匹配证据', '未匹配风险', '验证方式'],
    ['问题', '方案', '证据', '风险', '验证']
  ])
  const deliveryRows = rowsForColumns(tables, [
    ['产物', '状态', '说明'],
    ['产物', '必须/可选', '工具', '输出格式']
  ])
  const analyzedPages = pages.filter((page) => page.analyzed !== false)
  return {
    version: 'advanced-ux-stage-two-detail/v1',
    fileName: pageInteractionDocument.fileName || '',
    stageId: 'interaction-lofi',
    sourceArtifactType: 'advanced-ux-page-interaction-document',
    overviewRows,
    flowRows,
    dataFlowRows,
    entityRows,
    mainFlowRows,
    stateRows,
    modalRows,
    breakpointRows,
    globalInteractionRows,
    planComparisonRows,
    fitRows,
    deliveryRows,
    stats: {
      pageCount: pages.length,
      analyzedCount: analyzedPages.length,
      coverageRate: pages.length ? Math.round((analyzedPages.length / pages.length) * 100) : 0
    }
  }
}

function booleanFromText(value = '') {
  const text = cleanText(value).toLowerCase()
  if (!text) return false
  return /^(true|yes|y|1|是|已分析|已完成|完成|完整|分析完成)$/.test(text)
}

function headingBlocks(markdown = '') {
  const text = String(markdown || '').replace(/\r\n/g, '\n')
  const headings = [...text.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    title: cleanText(match[2]),
    start: match.index || 0,
    end: (match.index || 0) + match[0].length
  }))
  const pageHeadings = headings
    .map((heading, index) => ({ ...heading, index }))
    .filter((heading) => heading.level === 3 && /^P\d{2}\b/.test(heading.title))
  return pageHeadings.map((heading) => {
    const next = headings
      .slice(heading.index + 1)
      .find((item) => item.level <= heading.level)
    return {
      id: heading.title.match(/^(P\d{2})\b/)?.[1] || '',
      title: heading.title,
      body: text.slice(heading.end, next?.start ?? text.length).trim()
    }
  })
}

function overviewPages(markdown = '') {
  const tables = parseMarkdownTables(markdown)
  const overview = firstTableWithColumns(tables, ['编号', '页面名称', '类型', '所属模块', '核心职责'])
  const idIndex = tableColumnIndex(overview, '编号')
  const nameIndex = tableColumnIndex(overview, '页面名称')
  const typeIndex = tableColumnIndex(overview, '类型')
  const moduleIndex = tableColumnIndex(overview, '所属模块')
  const entryIndex = tableColumnIndex(overview, '入口来源')
  const responsibilityIndex = tableColumnIndex(overview, '核心职责')
  const correspondingStepsIndex = tableColumnIndex(overview, '对应步骤')
  const analyzedIndex = tableColumnIndex(overview, 'analyzed')
  const analyzedCnIndex = tableColumnIndex(overview, '是否分析')
  const roleIndex = tableColumnIndex(overview, '角色权限')
  const dataIndex = tableColumnIndex(overview, '数据来源')
  const permissionIndex = tableColumnIndex(overview, '权限规则')
  const routeIndex = tableColumnIndex(overview, '路由路径')
  return tableFilledRows(overview).map((row) => {
    const pageId = cleanText(row[idIndex >= 0 ? idIndex : 0] || '').match(/^P\d{2}\b/)?.[0] || ''
    return {
      pageId,
      pageName: cleanText(row[nameIndex >= 0 ? nameIndex : 1] || ''),
      type: cleanText(row[typeIndex] || ''),
      module: cleanText(row[moduleIndex] || ''),
      entrySource: cleanText(row[entryIndex] || ''),
      responsibility: cleanText(row[responsibilityIndex] || ''),
      correspondingSteps: cleanText(row[correspondingStepsIndex] || ''),
      analyzed: booleanFromText(row[analyzedIndex >= 0 ? analyzedIndex : analyzedCnIndex] || ''),
      roleAccess: cleanText(row[roleIndex] || ''),
      dataSource: cleanText(row[dataIndex] || ''),
      permissionRule: cleanText(row[permissionIndex] || ''),
      routePath: cleanText(row[routeIndex] || '')
    }
  }).filter((page) => page.pageId)
}

function documentPages(markdown = '') {
  const pages = overviewPages(markdown)
  const headingPages = headingBlocks(markdown)
  const headingMap = new Map(headingPages.map((page) => [page.id, page]))
  const normalizedPages = pages.length
    ? pages.map((page) => ({
        ...page,
        title: headingMap.get(page.pageId)?.title || `${page.pageId} ${page.pageName}`.trim(),
        body: headingMap.get(page.pageId)?.body || ''
      }))
    : headingPages.map((page) => ({
        pageId: page.id,
        pageName: cleanText(page.title.replace(/^P\d{2}\s*/, '')),
        type: '',
        module: '',
        responsibility: '',
        correspondingSteps: '',
        analyzed: true,
        title: page.title,
        body: page.body || ''
      }))
  return normalizedPages.filter((page) => page.pageId && page.body)
}

function frameTable(tables = []) {
  return firstTableWithColumns(tables, ['区域', '内容', '说明']) ||
    firstTableWithColumns(tables, ['区域编号', '区域名称', '区域类型', '位置', '内容摘要', '关键元素']) ||
    firstTableWithColumns(tables, ['region_id', 'region_name', 'region_type', 'position', 'content_summary', 'key_elements'])
}

function frameRowsAsObjects(table = null) {
  return rowsAsObjects(table).map((row) => {
    if (row['区域'] || row['内容'] || row['说明']) {
      const stateDescription = row['状态说明'] || row.stateDescription || row.state_description || ''
      const componentReference = row['组件引用'] || row.componentReference || row.component_reference || ''
      const regionId = row['区域编号'] || row.regionId || row.region_id || ''
      const regionName = row['区域名称'] || row.regionName || row.region_name || ''
      return {
        ...row,
        regionId,
        regionName,
        stateDescription,
        componentReference
      }
    }
    const regionId = row['区域编号'] || row.region_id || ''
    const regionName = row['区域名称'] || row.region_name || ''
    const regionType = row['区域类型'] || row.region_type || ''
    const position = row['位置'] || row.position || ''
    const layout = row['布局'] || row.layout || ''
    const contentSummary = row['内容摘要'] || row.content_summary || ''
    const keyElements = row['关键元素'] || row.key_elements || ''
    const interaction = row['交互'] || row.interaction || ''
    const responsive = row['响应式'] || row.responsive || ''
    const priority = row['优先级'] || row.priority || ''
    const stateVariants = row['状态变体'] || row.state_variants || ''
    const stateDescription = row['状态说明'] || row.state_description || row.stateDescription || ''
    const componentReference = row['组件引用'] || row.component_reference || row.componentReference || ''
    return {
      ...row,
      regionId,
      regionName,
      regionType,
      position,
      layout,
      contentSummary,
      keyElements,
      interaction,
      responsive,
      priority,
      stateVariants,
      stateDescription,
      componentReference,
      '区域': [regionId, regionName].filter(Boolean).join(' '),
      '内容': [contentSummary, keyElements].filter(Boolean).join('；'),
      '说明': [regionType, position, layout, interaction, responsive, priority, stateVariants, stateDescription, componentReference].filter(Boolean).join('；')
    }
  })
}

function ownProductRuleRows(markdown = '') {
  const tables = parseMarkdownTables(markdown)
  const table = firstTableWithColumns(tables, ['规则编号', '页面编号', '区域编号', '触发元素', '触发动作', '前置条件', '交互行为']) ||
    firstTableWithColumns(tables, ['rule_id', 'page_id', 'region_id', 'target_element', 'trigger', 'pre_condition', 'behavior'])
  return rowsAsObjects(table)
}

function pageArtifacts(page = {}, globalRuleRows = []) {
  const tables = parseMarkdownTables(page.body || '')
  const frames = frameRowsAsObjects(frameTable(tables))
  const interactionSourceRows = rowsAsObjects(
    firstTableWithColumns(tables, ['用户操作', '系统反馈']) ||
    firstTableWithColumns(tables, ['编号', '用户操作', '系统反馈'])
  )
  const exceptionRows = rowsAsObjects(
    firstTableWithColumns(tables, ['状态', '表现', '处理方式']) ||
    firstTableWithColumns(tables, ['编号', '状态', '表现'])
  )
  const localInteractionRows = interactionSourceRows.map((row, index) => {
    const id = row['编号'] || row.id || `${page.pageId}-interaction-${index + 1}`
    const userAction = row['用户操作'] || ''
    const systemFeedback = row['系统反馈'] || ''
    const remark = row['备注'] || ''
    const relatedStateOrModal = row['关联状态/弹窗'] || row['关联状态'] || row['关联弹窗'] || row.relatedStateOrModal || ''
    return {
      id,
      target: userAction,
      gesture: userAction,
      feedback: systemFeedback,
      result: systemFeedback,
      notes: remark,
      relatedStateOrModal,
      userAction,
      systemFeedback,
      remark
    }
  })
  const ownRows = globalRuleRows
    .filter((row) => cleanText(row['页面编号'] || row.page_id || '') === page.pageId)
    .map((row) => ({
      id: row['规则编号'] || row.rule_id || '',
      targetRegionId: row['区域编号'] || row.region_id || '',
      target: row['触发元素'] || row.target_element || '',
      gesture: row['触发动作'] || row.trigger || '',
      enableCondition: row['前置条件'] || row.pre_condition || '',
      operation: row['交互行为'] || row.behavior || '',
      feedback: row['成功反馈'] || row.success_feedback || '',
      errorFeedback: row['失败反馈'] || row['错误反馈'] || row.error_feedback || '',
      edgeCases: row['边界情况'] || row.edge_cases || '',
      relatedApi: row['关联接口'] || row.related_api || '',
      source: '交互规则表（自有产品）'
    }))
  const stateMatrix = exceptionRows.map((row, index) => ({
    id: row['编号'] || row.id || `${page.pageId}-state-${index + 1}`,
    state: row['状态'] || '',
    display: row['表现'] || '',
    handling: row['处理方式'] || '',
    promptCopy: row['表现'] || '',
    recovery: row['处理方式'] || ''
  }))
  return {
    frameRows: frames,
    interactionRows: [...localInteractionRows, ...ownRows],
    stateMatrix
  }
}

function pagePositionText(page = {}) {
  const body = String(page.body || '')
  const inline = body.match(/\*\*页面定位\*\*[：:]\s*(.+?)(?:\n|$)/)
  if (inline?.[1]) return cleanText(inline[1])
  const heading = body.match(/#{4,6}\s*页面定位\s*\n+([\s\S]*?)(?:\n#{1,6}\s|\n\*\*页面框架|$)/)
  if (heading?.[1]) return cleanText(heading[1])
  return cleanText(page.responsibility || '')
}

function pageDetailSections(page = {}, artifacts = {}, wireframe = '') {
  return [
    {
      key: 'position',
      title: '页面定位',
      body: [pagePositionText(page)].filter(Boolean)
    },
    {
      key: 'framework-table',
      title: '页面框架表格',
      rows: artifacts.frameRows || []
    },
    {
      key: 'text-layout',
      title: '文本布局图（ASCII）',
      code: String(wireframe || '').trim()
    },
    {
      key: 'interaction-rules',
      title: '交互规则表格',
      rows: artifacts.interactionRows || []
    },
    {
      key: 'exception-states',
      title: '异常状态表格',
      rows: artifacts.stateMatrix || []
    }
  ]
}

function asciiWireframe(page = {}, frameRows = []) {
  const title = `${page.pageId || ''} ${page.pageName || page.title || '页面'}`.trim()
  const lines = [
    '┌────────────────────────────┐',
    `│ ${title} │`,
    '├────────────────────────────┤'
  ]
  frameRows.forEach((row, index) => {
    const area = cleanText(row['区域'] || `区域 ${index + 1}`)
    const content = cleanText(row['内容'] || '')
    const description = cleanText(row['说明'] || '')
    lines.push(`│ ${area}：${content || description} │`)
    if (index < frameRows.length - 1) lines.push('├────────────────────────────┤')
  })
  lines.push('└────────────────────────────┘')
  return lines.join('\n')
}

function asciiLayoutFromBody(body = '') {
  const text = String(body || '')
  const afterLayoutHeading = text.match(/(?:文本布局图|文本布局示意图|ASCII)[\s\S]*?```(?:text)?\s*([\s\S]*?[┌┐└┘│][\s\S]*?)```/i)
  if (afterLayoutHeading?.[1]) return afterLayoutHeading[1].trim()
  const anyBoxCode = [...text.matchAll(/```(?:text)?\s*([\s\S]*?[┌┐└┘│][\s\S]*?)```/gi)]
    .map((match) => String(match[1] || '').trim())
    .find(Boolean)
  return anyBoxCode || ''
}

function gestureNotes(page = {}, artifacts = {}) {
  const source = [
    page.body,
    ...artifacts.interactionRows.map((row) => [row.target, row.gesture, row.feedback, row.operation].join(' ')),
    ...artifacts.frameRows.map((row) => [row['区域'], row['内容'], row['说明']].join(' '))
  ].join(' ')
  return [
    /滚动|固定|吸底|顶部|底部/.test(source) ? '内容区域纵向滚动 → 顶部/底部固定区不跟随滚动' : '',
    /下拉|刷新/.test(source) ? '下拉手势 → 触发接口刷新页面数据' : ''
  ].filter(Boolean)
}

export function advancedUxInteractionLofiCanvasFromPageInteractionDocument(pageInteractionDocument = null) {
  const markdown = String(pageInteractionDocument?.markdown || '').trim()
  if (!markdown) return null
  const pages = documentPages(markdown)
  if (!pages.length) return null
  const globalRuleRows = ownProductRuleRows(markdown)
  const documentArtifact = stageTwoDocumentArtifact(markdown, pageInteractionDocument, pages)
  const nodes = pages.map((page, index) => {
    const artifacts = pageArtifacts(page, globalRuleRows)
    const pageName = cleanText(page.pageName || page.title.replace(/^P\d{2}\s*/, '') || `页面 ${index + 1}`)
    const areaNames = artifacts.frameRows.map((row) => cleanText(row['区域'] || '')).filter(Boolean)
    const operationNames = artifacts.interactionRows.map((row) => cleanText(row.userAction || row.target || '')).filter(Boolean)
    const stateNames = artifacts.stateMatrix.map((row) => cleanText(row.state || '')).filter(Boolean)
    const wireframe = asciiLayoutFromBody(page.body) || asciiWireframe({ ...page, pageName }, artifacts.frameRows)
    return {
      id: `advanced-ux-page-${String(page.pageId || index + 1).toLowerCase()}`,
      stageId: 'interaction-lofi',
      title: pageName,
      summary: page.responsibility || `${pageName} 页面交互节点。`,
      content: [
        page.responsibility ? `页面职责：${page.responsibility}` : '',
        areaNames.length ? `框架区域：${areaNames.join('、')}` : '',
        operationNames.length ? `关键操作：${operationNames.slice(0, 5).join('、')}` : '',
        stateNames.length ? `异常状态：${stateNames.join('、')}` : ''
      ].filter(Boolean),
      x: 120 + (index % 3) * 360,
      y: 140 + Math.floor(index / 3) * 300,
      width: 320,
      height: 240,
      loading: false,
      artifactStatus: 'generated',
      detailLayout: 'interaction-page-split',
      quickActions: ['给布局方案', '补交互细节', '重生成本页'],
      pageLayoutArtifact: {
        title: '页面骨架',
        version: 'advanced-ux-page-interaction/v1',
        pageId: page.pageId,
        pageName,
        pageMeta: {
          correspondingSteps: page.correspondingSteps || '',
          analyzed: Boolean(page.analyzed),
          roleAccess: page.roleAccess || '',
          entrySource: page.entrySource || '',
          dataSource: page.dataSource || '',
          permissionRule: page.permissionRule || '',
          routePath: page.routePath || '',
          type: page.type || '',
          module: page.module || '',
          responsibility: page.responsibility || ''
        },
        sourceFileName: pageInteractionDocument.fileName || '',
        asciiWireframe: wireframe,
        rawText: page.body || '',
        pagePosition: pagePositionText(page),
        detailSections: pageDetailSections(page, artifacts, wireframe),
        layout: {
          type: page.type || '',
          module: page.module || '',
          responsibility: page.responsibility || '',
          regions: artifacts.frameRows
        },
        layoutRegions: artifacts.frameRows,
        layoutType: page.type || ''
      },
      interactionSpecArtifact: {
        version: 'advanced-ux-page-interaction/v1',
        pageId: page.pageId,
        pageName,
        snapshotRef: 'pageLayoutArtifact.asciiWireframe',
        interactionRows: artifacts.interactionRows,
        stateMatrix: artifacts.stateMatrix,
        gestureNotes: gestureNotes(page, artifacts),
        sourceFileName: pageInteractionDocument.fileName || ''
      },
      sourceArtifact: {
        type: 'advanced-ux-page-interaction-document',
        fileName: pageInteractionDocument.fileName || '',
        pageId: page.pageId
      }
    }
  })
  return {
    title: '页面交互低保画布',
    summary: '由高级 UX 页面交互框架与说明 Markdown 自动导入。',
    canvasType: 'interaction-lofi-page-canvas',
    layoutRule: 'page-grid',
    pageInteractionDocumentArtifact: documentArtifact,
    nodes,
    edges: [],
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}
