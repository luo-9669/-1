function documentSummary(documents = [], options = {}) {
  const bodyLimit = Number(options.bodyLimit || 1200)
  const maxDocuments = Number(options.maxDocuments || documents.length || 0)
  const list = documents
    .slice(0, maxDocuments || documents.length)
    .map((doc) => {
      const body = String(doc.text || doc.content || doc.summary || '').slice(0, bodyLimit)
      return `- ${doc.name || '未命名文档'}：${body || '暂无正文'}`
    })
    .join('\n')
  return list || '- 暂无上传文档'
}

function hasSelectedKnowledgeScopeDocument(documents = []) {
  return documents.some((doc) =>
    doc?.sourceType === 'selected-knowledge-scope' ||
    /^框选功能/.test(String(doc?.name || '')) ||
    doc?.selectedKnowledgeScope
  )
}

function selectedKnowledgeScopeInstruction(documents = []) {
  if (!hasSelectedKnowledgeScopeDocument(documents)) return ''
  return [
    '当前请求带有“框选功能”资料：必须优先且主要基于框选功能资料分析。',
    '项目全局知识只能作为相邻依赖补充，不能把需求扩展成全量产品蓝图。',
    '如果框选功能资料不足，只能输出待确认问题，不能借用其他项目、历史需求或行业模板补全。',
    '输出必须明确本次影响范围、非影响范围、上下游依赖和验收边界。'
  ].join('\n')
}

function projectSummary(project = {}) {
  if (!project || !Object.keys(project).length) return '暂无绑定项目'
  return [
    `项目名称：${project.name || project.title || '未命名项目'}`,
    `领域：${project.domain || '未设置'}`,
    `目标用户：${project.targetUsers || '未设置'}`,
    `说明：${project.description || '暂无'}`
  ].join('\n')
}

function schemaInstruction(schemaId = '') {
  if (schemaId === 'auth-page') {
    return [
      '必须返回一个 JSON 对象，字段如下：',
      '- intent: 固定为 "auth-page"',
      '- title: 页面标题',
      '- sections: 数组，每项包含 title 和 items',
      '- frontendHandoff: 前端接管事项数组',
      '- backendHandoff: 后端接管事项数组',
      '- apiContract: 接口契约数组，至少包含 POST /api/auth/login',
      '- html: 可独立预览的完整 HTML 字符串',
      '- preview: 预览配置对象',
      '- qualityReport: 包含 passed 和 checks 的质量报告'
    ].join('\n')
  }
  if (schemaId === 'smart-canvas') {
    return [
      '必须返回一个 JSON 对象，字段如下：',
      '- intent: 根据输入自由命名，例如 "media-broll-panel"、"auth-modal"、"interaction-design"、"page-generation" 或 "requirement-analysis"',
      '- mode: 推荐返回 "free-canvas"',
      '- canvasTitle: 画布标题',
      '- canvasType: "module-board"、"flow-board" 或 "mixed-board"',
      '- layoutRule: "top-down"、"left-right" 或 "force"',
      '- summary: 一句话总结，不超过 80 字',
      '- groups: 分组数组；一级大模块或业务域作为 group，每项包含 groupId、groupName、groupDesc、nodes',
      '- groups[].nodes: 节点数组；二级功能、步骤、判断或对象作为节点，每项包含 nodeId、nodeType、nodeName、summary、highlights、sections',
      '- groups[].nodes[].highlights: 2-4 个短重点，只放主画布卡片展示',
      '- groups[].nodes[].sections: 节点详情小标题，每项包含 title 和 items；长内容放这里，不要塞进 summary',
      '- edges: 节点连线数组，每项包含 fromNodeId、toNodeId、edgeLabel',
      '- totalDesignFlow: 可选但推荐；如果当前是“总流程”，返回 totalDesignFlow.stageCanvases，key 为阶段 id，每个阶段包含 nodes',
      '- totalDesignFlow.requirementSlices: 总流程小需求切片数组；每项包含 id、title、goal、sourceExcerpt、priority、pageCount、pendingQuestionCount',
      '- totalDesignFlow.pages: 总流程页面节点数组；每项包含 id、sliceId、title、summary、route、detailSections',
      '- totalDesignFlow.pages[].detailSections: 页面详情必须覆盖 页面目标、页面核心模块、用户点击动作、跳转到哪个页面、加载 / 空状态 / 失败 / 权限等状态、前后端接口或数据依赖、验收点',
      '- totalDesignFlow.stageCanvases[].nodes: 节点数组；node.id、node.title 或 node.sourcePageId 需要稳定且可回查，至少包含 summary、content、detailSections；后续阶段允许根据需求自定义 nodes，不需要套固定节点',
      '- 总流程阶段 id 包括 requirement-dissection、interaction-lofi、ui-visual、html-output、vue-output、acceptance-deposit',
      '- apiContract: 接口契约数组；涉及登录注册时至少包含 POST /api/auth/login',
      '- canvas: 可选兼容字段；如果返回 groups，可不返回 canvas',
      '- sections/frontendHandoff/backendHandoff: 可选兼容字段',
      '- designMarkdown: 可选，完整设计方案 Markdown',
      '- qualityReport: 包含 passed 和 checks 的质量报告'
    ].join('\n')
  }
  if (schemaId === 'product-interaction-review') {
    return [
      '必须返回一个 JSON 对象，字段如下：',
      '- intent: 固定为 "product-interaction-review"',
      '- title: 评审标题',
      '- sections: 数组，必须覆盖业务目标、用户任务、信息架构、交互流程、异常边界、交付协作',
      '- frontendHandoff: 前端接管事项数组，说明页面路径、状态、组件、前端缓存和刷新恢复',
      '- backendHandoff: 后端接管事项数组，说明账号、项目、资源 ID、接口、权限、数据归属',
      '- apiContract: 接口契约数组，说明前后端谁给谁什么数据',
      '- qualityReport: 包含 passed 和 checks 的质量报告，列出 P0/P1/P2 风险'
    ].join('\n')
  }
  return '必须返回 JSON 对象，并包含 sections 和 qualityReport。'
}

function demandScopeInstruction(scope = 'project', responseSchema = '') {
  if (scope === 'non-project' && responseSchema !== 'auth-page') {
    return [
      '当前是非项目需求：输出应服务于调研总结、信息整理、判断是否立项和转项目建议。',
      '禁止把项目知识库内容当作当前已知事实引用。',
      '证据来源只能来自用户输入、上传附件、对话确认、模型假设和待确认问题。',
      '必须包含结论、关键依据、风险、不确定项、是否立项建议、转项目建议。',
      '除非识别到页面或代码强意图，否则只输出调研和立项判断相关章节。'
    ].join('\n')
  }
  return [
    '当前是项目需求：输出应作为项目交付物，能被产品、UX、前端、后端和测试接管。',
    '必须明确前端接管、后端接管、接口契约、状态异常、验收标准和后续开发分工。',
    '如果涉及页面或流程，必须描述页面结构、交互路径、数据流、错误码和联调边界。'
  ].join('\n')
}

function qualityCheckInstruction(checks = []) {
  const list = Array.isArray(checks) ? checks.map((item) => String(item || '').trim()).filter(Boolean) : []
  return list.length
    ? `必须逐项满足以下质量检查：${list.join('、')}。`
    : '必须输出质量检查结果，说明通过项、风险项和待确认项。'
}

function displaySafetyInstruction() {
  // 展示契约只管“怎么安全展示”，不要在这里把业务字段写死。
  // 前端会 Raw First + Display Overlay：先显示 rawContent，再把合法 displayBlocks 升级成表格/结构树；页面布局成果统一走 page-layout-artifact。
  // 后续改这里前，先确认前端 WorkflowAgentDrawer.vue 的 AGENT_SPECIAL_CONTENT_RENDERING_CONTRACT 和 displayBlockSegments 逻辑。
  return [
    '展示安全契约：必须保留 rawContent 作为模型原文兜底；如果同时返回 displayBlocks，只能作为前端增强展示使用。',
    '展示协议只约束展示外壳，不约束业务内容字段；业务内容保持开放，由模型根据真实需求自由组织。',
    '不要为了展示而强制输出 currentRequirement、goal、outputType、structureTree 这类固定业务字段；这些只能作为兼容旧输出的字段，不是新输出模板。',
    'displayBlocks 可选；每项包含 type、title、content/table/tree 中至少一种，只用于表格、结构树、代码等展示增强，不用于页面布局成果。',
    '结构树优先输出纯文本树图，使用 ├─、└─、│ 体现层级；页面框架、页面骨架、线框图、布局方案必须改用 :::page-layout-artifact 卡片块，不要再作为 displayBlocks.framework 或“框架层”单独输出。',
    '用户可见标题必须使用中文，例如“文本”“表格”“结构树”“框架层”“页面骨架”；不要把 plaintext、schema、id、key、stage、version 等内部字段作为标题或正文展示。',
    '普通说明文字不要伪装成表格；只有真实行列表格才用 table，结构树/框架层必须有清晰层级或框架文本。'
  ].join('\n')
}

function isNoneSkill(context = {}) {
  return context.skill?.id === 'none' || context.skillId === 'none' || context.routing?.resolvedSkillId === 'none'
}

function compactFreeCanvasSchemaInstruction() {
  return [
    '必须返回一个 JSON 对象，业务主结构优先包含这些字段：',
    '- intent: 根据真实需求自由命名',
    '- mode: 固定为 "free-canvas"',
    '- canvasTitle: 画布标题',
    '- canvasType: "module-board"、"flow-board" 或 "mixed-board"',
    '- layoutRule: "top-down"、"left-right" 或 "force"',
    '- summary: 一句话总结，不超过 60 字',
    '- readableSummary: 面向普通用户的可读总览对象，包含 oneSentence、userGoal、coreModules、recommendedFlow、questions',
    '- readableSummary.oneSentence: 一句话说明这份需求本质在做什么',
    '- readableSummary.userGoal: 用户想解决的问题，不超过 80 字',
    '- readableSummary.coreModules: 3-5 个核心模块名称或短句',
    '- readableSummary.recommendedFlow: 3-6 步推荐推进流程',
    '- readableSummary.questions: 0-4 个待确认问题',
    '- groups: 最多 4 个 groups；每项包含 groupId、groupName、groupDesc、nodes',
    '- groups[].nodes: 全部 groups 合计最多 8 个 nodes；每项包含 nodeId、nodeType、nodeName、summary、highlights、sections',
    '- groups[].nodes[].summary: 不超过 50 字',
    '- groups[].nodes[].highlights: 最多 3 条，每条不超过 18 字，只放主画布卡片重点',
    '- groups[].nodes[].sections: 最多 2 个详情小节，每节最多 3 条 items，长内容不要放主画布',
    '- edges: 只连接关键节点，最多 10 条',
    '- qualityReport: 包含 passed 和 checks',
    '- rawContent: 可选；面向用户的中文原文兜底，便于前端先流式展示',
    '- displayBlocks: 可选；只放表格、结构树、代码等展示增强块，不替代 groups/nodes 业务结构；页面框架/页面骨架/线框图必须走 :::page-layout-artifact 卡片块',
    '不要输出 designMarkdown、html、frontendHandoff、backendHandoff、长篇报告或解释文字。'
  ].join('\n')
}

function isTotalDesignFlowContext(context = {}) {
  return context.skill?.id === 'total-design-flow' ||
    context.skill?.id === 'advanced-ux-requirement-analysis' ||
    context.skillId === 'total-design-flow' ||
    context.skillId === 'advanced-ux-requirement-analysis' ||
    context.routing?.resolvedSkillId === 'total-design-flow' ||
    context.routing?.resolvedSkillId === 'advanced-ux-requirement-analysis' ||
    context.routing?.requestedSkillId === 'total-design-flow' ||
    context.routing?.requestedSkillId === 'advanced-ux-requirement-analysis'
}

function compactTotalDesignFlowSchemaInstruction() {
  return [
    '当前是总流程后台画布生成：必须返回首屏紧凑 JSON，让前端先进入可用画布。',
    '必须返回一个 JSON 对象，业务主结构优先包含这些字段：',
    '- intent: 固定或接近 "total-design-flow"',
    '- mode: 固定为 "free-canvas"',
    '- canvasTitle: 画布标题，优先使用中文，不超过 16 个字',
    '- canvasType: 推荐 "module-board" 或 "flow-board"',
    '- layoutRule: 推荐 "top-down"',
    '- summary: 一句话总结，不超过 60 字',
    '- readableSummary: 面向普通用户的可读总览对象，包含 oneSentence、userGoal、coreModules、recommendedFlow、questions',
    '- groups: 最多 4 个 groups；每项包含 groupId、groupName、groupDesc、nodes',
    '- groups[].nodes: 全部 groups 合计最多 8 个 nodes；每项包含 nodeId、nodeType、nodeName、summary、highlights、sections',
    '- groups[].nodes[].summary: 不超过 50 字',
    '- groups[].nodes[].highlights: 最多 3 条，每条不超过 18 字',
    '- groups[].nodes[].sections: 最多 2 个详情小节，每节最多 3 条 items',
    '- edges: 只连接关键节点，最多 10 条',
    '- totalDesignFlow: 必须包含 requirementDissectionArtifact、requirementSlices 和 pages 的少量线索',
    '- totalDesignFlow.requirementDissectionArtifact: 模型必须显式返回需求分析阶段要展示的结构化字段；未返回的字段不要由前端或展示层补写',
    '- totalDesignFlow.requirementDissectionArtifact.productAnalysisPipeline: 必须包含 tabs；detailBlocks 只放 sourceRef、title、type、summary，不复制正文，不写 rows/items 正文，正文只写入 canonical 字段',
    '- 普通总流程的 productAnalysisPipeline 必须覆盖 9 个需求分析画布章节：需求理解、缺口确认、用户旅程分析、功能与页面拆解、业务规则与状态流、流程与架构、设计机会、优先级与排期、验收标准',
    '- 9 个需求分析画布章节 sourceRef 映射必须固定：需求理解=productDefinition/userScenarios/evidenceAndAssumptions/riskAssessment；缺口确认=gapConfirmation/openQuestions；用户旅程分析=personaScenarioMatrix/userJourneyMap；功能与页面拆解=functionModuleMatrix/designRequirementMap/pageHierarchyTree/pageCoverageMatrix/pageFrameContracts；业务规则与状态流=businessRuleMatrix/permissionMatrix/boundaryConditionMatrix/stateMachineMap；流程与架构=navigationStructure/dataFlowGraph/featureJumpGraph/exceptionRecoveryMatrix；设计机会=designOpportunityMatrix/competitiveAnalysis；优先级与排期=priorityRoadmap/scopeBoundary；验收标准=acceptanceBasis',
    '- 如果当前 skillId 或 requestedSkillId 是 advanced-ux-requirement-analysis，则需求分析第一阶段改用高级 UX 10 节点：ux-original-requirement-analysis、ux-design-problem-definition、ux-user-scenario、ux-assumption-validation、ux-design-opportunity、ux-interaction-chain、ux-three-design-solutions、ux-exception-flow、ux-recommendation-decision、ux-priority-phasing',
    '- 高级 UX 10 节点必须体现：原始需求分析、设计问题定义、用户与场景、假设与验证、设计机会、整体交互链路、三套设计方案、异常流补充、推荐方案建议、设计优先级与分阶段计划；每个判断标注 confidence，并区分 facts/inferences/suggestions/risks',
    '- 高级 UX 阶段一必须遵守仓库内 docs/skills/advanced-ux/需求分析阶段一skill.md 与 docs/skills/advanced-ux/需求阶段一产出约束.md；阶段二必须遵守 docs/skills/advanced-ux/交互低保阶段二.md',
    '- totalDesignFlow.requirementDissectionArtifact.productDefinition: 可返回 oneLine、productType、sourceSummary、surfaceAsk、bottomIntent、successSignals',
    '- totalDesignFlow.requirementDissectionArtifact.userScenarios: 可返回 primaryUsers、coreScenarios、jobsToBeDone、designImplications',
    '- totalDesignFlow.requirementDissectionArtifact.evidenceAndAssumptions: 可返回 evidenceSources、assumptions、openQuestions，并明确用户输入/附件/项目知识/模型假设来源',
    '- totalDesignFlow.requirementDissectionArtifact.riskAssessment: 必须返回 risks、assumptions、validationMethods；风险不足时也返回 needs-confirmation 项，不要省略字段',
    '- totalDesignFlow.requirementDissectionArtifact.gapConfirmation: 可返回 confirmedFacts、questions、affectedPages、blockingItems、nextSteps；questions 按 P0/P1/P2 标注阻塞程度',
    '- totalDesignFlow.requirementDissectionArtifact.personaScenarioMatrix、navigationStructure、functionModuleMatrix、pageHierarchyTree、userJourneyMap、pageCoverageMatrix、pageFrameContracts、businessRuleMatrix、permissionMatrix、boundaryConditionMatrix、dataFlowGraph、stateMachineMap、featureJumpGraph、exceptionRecoveryMatrix、designOpportunityMatrix、competitiveAnalysis、priorityRoadmap、scopeBoundary、acceptanceBasis: 按真实需求返回；未知小点必须返回 needs-confirmation 结构，而不是省略字段',
    '- totalDesignFlow.requirementSlices: 最多 3 条，每项包含 id、title、goal、sourceExcerpt、priority、pageCount、pendingQuestionCount',
    '- totalDesignFlow.pages: 最多 5 个页面线索，每项包含 id、sliceId、title、summary、route',
    '- qualityReport: 包含 passed 和 checks',
    '- rawContent: 可选；面向用户的中文原文兜底，便于前端先流式展示，不能替代业务结构',
    '- displayBlocks: 可选；只放表格、结构树、代码等展示增强块，展示协议不固定业务字段；页面框架/页面骨架/线框图必须走 :::page-layout-artifact 卡片块',
    '不要返回完整 totalDesignFlow.stageCanvases。',
    '不要返回所有 6 个阶段的详细节点。',
    '不要返回长篇 designMarkdown、html、frontendHandoff、backendHandoff 或解释文字。',
    '完整六阶段结构由后端 buildTotalDesignFlow 根据首屏 JSON、切片和页面线索补齐。'
  ].join('\n')
}

function buildNoneSkillPrompt(context = {}) {
  const skill = context.skill || {}
  const systemPrompt = [
    skill.promptTemplate || '你是大厂级产品、交互、前后端协作方案生成助手。',
    '',
    '只输出 JSON，不要输出 Markdown，不要解释，不要包裹代码块。',
    '用户选择“不选择 Skill”：不要套固定 Skill，不要使用“文档摘要/核心观点/风险问题/建议方案”等报告模板。',
    '必须先生成 readableSummary，让用户先看懂 AI 理解是否正确，再看结构画布。',
    '目标是生成可渐进展示的自由画布：先抓核心业务对象、页面/模块、流程和关键决策，再把细节收进 sections。',
    '按模型判断的大标题/小标题自动组织 groups 和 nodes；如果内容很复杂，也只先返回最重要的一屏主画布。',
    '每个节点必须短、清楚、可读；主画布只展示 summary + highlights。',
    displaySafetyInstruction(),
    selectedKnowledgeScopeInstruction(context.documents || []),
    compactFreeCanvasSchemaInstruction()
  ].join('\n')
  const userPrompt = [
    `用户输入：${context.input || '暂无输入'}`,
    '',
    '项目上下文：',
    projectSummary(context.project),
    '',
    '上传文档摘录（只给模型关键上下文，避免输出过长）：',
    documentSummary(context.documents || [], { bodyLimit: 500, maxDocuments: 4 })
  ].join('\n')

  return {
    systemPrompt,
    userPrompt,
    responseSchema: 'smart-canvas',
    maxOutputTokens: Number(context.maxOutputTokens || 3200)
  }
}

export function buildSkillPrompt(context = {}) {
  if (isNoneSkill(context)) return buildNoneSkillPrompt(context)
  const skill = context.skill || {}
  const responseSchema = skill.outputSchema || 'requirement-analysis'
  const demandScope = context.demandScope === 'non-project' ? 'non-project' : 'project'
  const totalDesignFlow = isTotalDesignFlowContext(context)
  const systemPrompt = [
    skill.promptTemplate || '你是资深产品、UX 和研发协作助手。',
    '',
    '只输出 JSON，不要输出 Markdown，不要解释，不要包裹代码块。',
    '必须区分事实、推断和待确认项。',
    '必须让产品、UX、前端、后端可以直接评审。',
    totalDesignFlow
      ? '总流程只生成首屏结构和少量线索；不要让模型一次性生成完整六阶段大画布。'
      : '如果输出用于总流程，请保留系统固定阶段 id 和阶段名称；需求分析阶段保持 Agent 工作台，只填充阶段确认内容；后续阶段允许根据需求自定义 nodes、edges 和 orderedTabs。',
    displaySafetyInstruction(),
    selectedKnowledgeScopeInstruction(context.documents || []),
    demandScopeInstruction(demandScope, responseSchema),
    qualityCheckInstruction(skill.qualityChecks || []),
    totalDesignFlow ? compactTotalDesignFlowSchemaInstruction() : schemaInstruction(responseSchema)
  ].join('\n')
  const userPrompt = [
    `用户输入：${context.input || '暂无输入'}`,
    '',
    `需求类型：${demandScope === 'non-project' ? '非项目需求' : '项目需求'}`,
    '',
    `路由信息：${JSON.stringify(context.routing || {}, null, 2)}`,
    '',
    '项目上下文：',
    projectSummary(context.project),
    '',
    '上传文档：',
    documentSummary(context.documents || [])
  ].join('\n')

  return {
    systemPrompt,
    userPrompt,
    responseSchema,
    ...(totalDesignFlow ? { maxOutputTokens: Number(context.maxOutputTokens || 3200) } : {})
  }
}
