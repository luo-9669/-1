function sourceSummary(context) {
  return [
    ...(context.knowledge || []).slice(0, 3).map((item) => ({ type: '知识库', title: item.title, meta: item.meta || item.status || '' })),
    ...(context.requirements || []).slice(0, 2).map((item) => ({ type: '需求', title: item.title, meta: item.meta || item.status || '' })),
    ...(context.competitors || []).slice(0, 2).map((item) => ({ type: '竞品', title: item.title, meta: item.meta || item.status || '' }))
  ]
}

function inferScenario(input = '') {
  if (/审批|权限|后台|B\s*端|表单|流程|状态/.test(input)) return 'B 端复杂系统设计'
  if (/优化|改版|不好用|很乱|体验/.test(input)) return '已有项目改版优化'
  if (/新|从 0|0 到 1|想做|搭一个/.test(input)) return '新项目从 0 到 1 梳理'
  return '模糊需求诊断'
}

function diagnosis(context) {
  const input = context.input || ''
  const sources = sourceSummary(context)
  const missing = []
  if (!/用户|角色|客户|设计师|产品/.test(input)) missing.push('目标用户或角色')
  if (!/目标|指标|成功|提升|降低|减少/.test(input)) missing.push('成功标准')
  if (!/流程|页面|场景|任务|路径/.test(input)) missing.push('关键使用场景或流程')
  return {
    clarity: missing.length >= 2 ? '模糊' : missing.length === 1 ? '初步' : '较明确',
    scenario: inferScenario(input),
    missing,
    recommendedSkills: missing.length ? ['模糊需求澄清', '用户旅程地图'] : ['用户旅程地图', 'PRD/交互方案生成'],
    sourceCount: sources.length
  }
}

function renderSources(sources) {
  if (!sources.length) return '- 暂无已引用资料，以下内容主要基于用户输入和 AI 推断。'
  return sources.map((source) => `- ${source.type}：${source.title}${source.meta ? `（${source.meta}）` : ''}`).join('\n')
}

function renderDiagnosis(context, diag, sources) {
  return `# 需求诊断\n\n## 当前理解\n${context.input || '用户尚未输入明确需求。'}\n\n## 需求类型\n${diag.scenario}\n\n## 需求成熟度\n${diag.clarity}\n\n## 已引用资料\n${renderSources(sources)}\n\n## 缺失信息\n${diag.missing.length ? diag.missing.map((item) => `- ${item}`).join('\n') : '- 暂无明显缺失，可以进入方案生成。'}\n\n## 推荐 Skill 链\n${diag.recommendedSkills.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n## 下一步\n${diag.missing.length ? '先补齐缺失信息，再进入用户旅程或 PRD/交互方案生成。' : '可以直接执行用户旅程地图或 PRD/交互方案生成。'}`
}

function renderJourney(context, sources) {
  return `# 用户旅程地图\n\n## 已引用资料\n${renderSources(sources)}\n\n| 阶段 | 用户目标 | 用户行为 | 触点 | 情绪 | 痛点 | 机会点 | 设计建议 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 发现问题 | 明确当前要解决什么 | 描述需求、上传资料、选择项目 | 项目诊断台 | 困惑 | 需求模糊，资料分散 | 用默认 Skill 先诊断 | 提供需求诊断卡和推荐 Skill 链 |\n| 补齐上下文 | 让 AI 理解项目 | 导入知识库、竞品、流程资料 | 知识库 | 谨慎 | 担心 AI 编造 | 展示引用来源 | 输出区区分知识库事实和 AI 推断 |\n| 生成方案 | 获得可比较方案 | 选择系统或自定义 Skill 执行 | Skill 工作台 | 期待 | 不知道方案取舍 | 输出多方案与风险 | 给出推荐方案、适用条件和验收标准 |\n| 沉淀资产 | 后续可复用 | 保存结果到运行记录和资产库 | 运行记录 | 稳定 | 聊天结果难追溯 | 资产化保存 | 保存输入、Skill、引用资料和版本 |`
}

function renderPrd(context, diag, sources) {
  return `# ${context.skill.name}\n\n## 背景和目标\n基于用户输入“${context.input || '未提供'}”生成第一版产品/交互方案。当前判断为：${diag.scenario}。\n\n## 用户和场景\n- 主要用户：产品经理、交互设计师、体验设计师。\n- 场景：围绕项目知识库和 Skill 编排完成需求澄清、方案生成和资产沉淀。\n\n## 范围和非范围\n- 范围：默认通用 Skill、系统 Skill、用户自定义 Skill、知识库引用、执行记录。\n- 非范围：Skill 市场、直接执行 GitHub 代码、Figma/Jira/Confluence 自动发布。\n\n## 已引用资料\n${renderSources(sources)}\n\n## 核心流程\n1. 用户输入需求。\n2. 默认通用 Skill 诊断需求并读取知识库。\n3. 系统推荐 Skill 链或用户选择自己的 Skill。\n4. 目标 Skill 生成结构化结果。\n5. 系统保存运行记录和输出资产。\n\n## 待确认问题\n${diag.missing.length ? diag.missing.map((item) => `- 请补充：${item}`).join('\n') : '- 当前输入可以进入下一轮细化。'}\n\n## 验收标准\n- 输出必须包含引用资料或说明暂无引用。\n- 输出必须区分已知事实和 AI 推断。\n- 执行结果必须保存到运行记录。`
}

export function runSkillLocally(context) {
  const diag = diagnosis(context)
  const sources = sourceSummary(context)
  const skillName = context.skill?.name || ''
  let content = renderDiagnosis(context, diag, sources)
  let assetType = '需求诊断'

  if (/旅程/.test(skillName)) {
    content = renderJourney(context, sources)
    assetType = '用户旅程地图'
  } else if (/PRD|交互方案/.test(skillName)) {
    content = renderPrd(context, diag, sources)
    assetType = 'PRD/交互方案'
  }

  return {
    title: `${context.skill.name} · ${assetType}`,
    content,
    diagnosis: diag,
    sources,
    assetType
  }
}
