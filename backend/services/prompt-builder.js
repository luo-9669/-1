function documentSummary(documents = []) {
  const list = documents
    .map((doc) => {
      const body = String(doc.text || doc.content || doc.summary || '').slice(0, 1200)
      return `- ${doc.name || '未命名文档'}：${body || '暂无正文'}`
    })
    .join('\n')
  return list || '- 暂无上传文档'
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
      '- intent: 根据输入返回 "auth-modal"、"auth-page"、"interaction-design"、"page-generation" 或 "requirement-analysis"',
      '- title: 分析标题',
      '- sections: 数组，每项包含 title 和 items',
      '- frontendHandoff: 前端接管事项数组',
      '- backendHandoff: 后端接管事项数组',
      '- apiContract: 接口契约数组；涉及登录注册时至少包含 POST /api/auth/login',
      '- canvas: 画布对象，至少包含 nodes 数组，每个节点包含 id、title、summary、content',
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

export function buildSkillPrompt(context = {}) {
  const skill = context.skill || {}
  const responseSchema = skill.outputSchema || 'requirement-analysis'
  const demandScope = context.demandScope === 'non-project' ? 'non-project' : 'project'
  const systemPrompt = [
    skill.promptTemplate || '你是资深产品、UX 和研发协作助手。',
    '',
    '只输出 JSON，不要输出 Markdown，不要解释，不要包裹代码块。',
    '必须区分事实、推断和待确认项。',
    '必须让产品、UX、前端、后端可以直接评审。',
    demandScopeInstruction(demandScope, responseSchema),
    qualityCheckInstruction(skill.qualityChecks || []),
    schemaInstruction(responseSchema)
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
    responseSchema
  }
}
