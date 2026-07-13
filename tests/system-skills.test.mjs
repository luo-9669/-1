import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { availableProjectSkills } from '../frontend/src/services/projectWorkspace.js'
import { createSystemSkills, normalizeSkill } from '../frontend/src/services/skills.js'
import { getSkillDefinition, listSkillDefinitions } from '../backend/services/skill-registry.js'
import { orchestrateRequirementSkill } from '../backend/services/skill-orchestrator.js'
import { analyzeRequirementDocuments } from '../backend/services/document-parser.js'
import {
  buildAdvancedUxMarkdownReport,
  buildTotalDesignFlow,
  failAdvancedUxMarkdownGenerationInTotalFlow,
  importAdvancedUxMarkdownReportToTotalFlow,
  TOTAL_DESIGN_FLOW_STAGES,
  withDownstreamStageArtifactContext
} from '../backend/services/total-design-flow.js'
import { buildWorkflowStageRuntime } from '../backend/services/stage-runtime.js'
import { buildRequirementDissectionGuidanceArtifact } from '../backend/services/requirement-dissection-guidance.js'
import { validateSkillOutput } from '../backend/services/schema-validator.js'
import { buildSkillPrompt } from '../backend/services/prompt-builder.js'
import { advancedUxInteractionLofiCanvasFromPageInteractionDocument } from '../backend/services/advanced-ux-page-interaction.js'

test('system skill list only exposes latest advanced UX skill', () => {
  const normalized = normalizeSkill({
    name: '元数据测试',
    mode: 'agent-confirmation',
    stages: [{ id: 'clarify', name: '需求澄清' }],
    agentInteraction: { nextActions: [{ id: 'next', label: '下一步' }] },
    outputTypes: ['低保真画布']
  })

  assert.equal(normalized.mode, 'agent-confirmation')
  assert.equal(normalized.stages[0].id, 'clarify')
  assert.equal(normalized.stages[0].name, '需求澄清')
  assert.equal(normalized.agentInteraction.nextActions[0].id, 'next')
  assert.equal(normalized.agentInteraction.nextActions[0].label, '下一步')
  assert.deepEqual(normalized.outputTypes, ['低保真画布'])

  const skills = createSystemSkills()
  assert.deepEqual(skills.map((skill) => skill.id), ['advanced-ux-requirement-analysis'])
  assert.deepEqual(availableProjectSkills(skills, 'project-a').map((skill) => skill.id), ['advanced-ux-requirement-analysis'])
})

test('public system skill list only exposes advanced UX while hidden definitions stay available', () => {
  const frontendIds = createSystemSkills().map((skill) => skill.id)
  const backendSkill = getSkillDefinition('competitor-monitor-skill')
  const backendIds = listSkillDefinitions().map((skill) => skill.id)

  assert.deepEqual(frontendIds, ['advanced-ux-requirement-analysis'])
  assert.equal(backendSkill.id, 'competitor-monitor-skill')
  assert.equal(backendSkill.outputSchema, 'competitor-analysis-report')
  assert.deepEqual(backendIds, ['advanced-ux-requirement-analysis'])
})

test('requirement dissection guidance loads skill contracts and specs without duplicate source paths', () => {
  const guidance = buildRequirementDissectionGuidanceArtifact()
  const allSources = [
    ...guidance.hardConstraints,
    ...guidance.methodGuides,
    ...guidance.referenceNotes
  ]

  assert.equal(guidance.version, 'requirement-dissection-guidance/v1')
  assert.ok(guidance.hardConstraints.some((item) => item.path === 'docs/product-contracts/frontend-backend-handoff.md'))
  assert.ok(guidance.methodGuides.some((item) => item.path === 'docs/skills/requirement-dissection-guidance/SKILL.md'))
  assert.ok(guidance.referenceNotes.some((item) => item.path === 'docs/superpowers/specs/2026-06-28-total-design-flow-workbench-design.md'))
  assert.equal(new Set(allSources.map((item) => item.path)).size, allSources.length)
  assert.ok(allSources.every((item) => item.id && item.title && item.summary && item.sourceType))
})

test('generic podcast requirements do not auto-route to legacy Podcastor skill', () => {
  const generic = orchestrateRequirementSkill({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    input: 'Jogg AI video podcast generator 首页需要改版，突出生成入口和真实项目流程。'
  })
  const explicitLegacy = orchestrateRequirementSkill({
    skillId: 'podcastor-product-flow',
    skillSelectionMode: 'manual',
    input: 'Podcastor.ai v1.0 产品文档，需要分析首页和核心编辑器。'
  })

  assert.notEqual(generic.detectedIntent, 'podcastor-product')
  assert.notEqual(generic.resolvedSkillId, 'podcastor-product-flow')
  assert.equal(explicitLegacy.detectedIntent, 'podcastor-product')
  assert.equal(explicitLegacy.resolvedSkillId, 'advanced-ux-requirement-analysis')
  assert.match(explicitLegacy.routingReason, /清空其它 Skill|高级 UX/)
})

test('Jogg homepage prompt shortcuts keep route intent from auth knowledge noise', () => {
  const routing = orchestrateRequirementSkill({
    skillId: 'total-design-flow',
    skillSelectionMode: 'auto',
    input: '我想在首页加入提示词方便用户快捷输入',
    documents: [
      {
        name: '框选功能：Jogg 产品结构',
        sourceType: 'selected-knowledge-scope',
        text: '页面：Home / AI Podcast Generator\n热区：Topic/input composer / Generate podcast / LoginDialog'
      },
      {
        name: '项目知识库：Jogg 核心用户流程',
        text: 'Jogg 包含 Pricing/Login/Profile 流程；未登录生成时打开登录弹窗；创建成功后进入 Studio。'
      }
    ]
  })

  assert.equal(routing.detectedIntent, 'requirement-analysis')
  assert.notEqual(routing.detectedIntent, 'auth-modal')
})

test('Jogg homepage prompt shortcuts do not build an auth blueprint from retrieved knowledge', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页加入提示词方便用户快捷输入',
    documents: [
      {
        name: '框选功能：Jogg 产品结构',
        sourceType: 'selected-knowledge-scope',
        selectedKnowledgeScope: true,
        text: '页面：Home / AI Podcast Generator\n热区：Topic/input composer / Generate podcast / LoginDialog'
      },
      {
        name: '项目知识库：Jogg 核心用户流程',
        text: 'Jogg 包含 Pricing/Login/Profile 流程；未登录生成时打开登录弹窗；创建成功后进入 Studio。'
      }
    ]
  })

  assert.equal(analysis.detectedIntent, 'requirement-analysis')
  assert.notEqual(analysis.blueprint?.intent, 'auth-page')
  assert.notEqual(analysis.blueprint?.intent, 'auth-modal')
  assert.match(analysis.totalDesignFlow?.requirementSlices?.[0]?.title || '', /首页|提示词/)
  assert.ok((analysis.totalDesignFlow?.pages || []).some((page) => /首页/.test(page.title || '')))
})

test('legacy dialogue skill is hidden and routed to advanced UX', () => {
  const frontendSkill = createSystemSkills().find((skill) => skill.id === 'dialogue-skill')
  const backendIds = listSkillDefinitions().map((skill) => skill.id)
  const routing = orchestrateRequirementSkill({
    skillSelectionMode: 'manual',
    skillId: 'dialogue-skill',
    input: '先跟我聊一下需求'
  })

  assert.equal(frontendSkill, undefined)
  assert.ok(!backendIds.includes('dialogue-skill'))
  assert.equal(routing.requestedSkillId, 'dialogue-skill')
  assert.equal(routing.resolvedSkillId, 'advanced-ux-requirement-analysis')
  assert.equal(routing.displaySkillName, '高级 UX 需求分析')
})

test('advanced UX requirement analysis skill copies total-flow behavior with ten UX nodes', () => {
  const frontendSkill = createSystemSkills().find((skill) => skill.id === 'advanced-ux-requirement-analysis')
  const backendSkill = getSkillDefinition('advanced-ux-requirement-analysis')
  const backendIds = listSkillDefinitions().map((skill) => skill.id)

  assert.ok(frontendSkill)
  assert.equal(frontendSkill.name, '高级 UX 需求分析')
  assert.equal(frontendSkill.mode, 'total-design-flow')
  assert.deepEqual(frontendSkill.stages.map((stage) => stage.id), [
    'ux-original-requirement-analysis',
    'ux-design-problem-definition',
    'ux-user-scenario',
    'ux-assumption-validation',
    'ux-design-opportunity',
    'ux-interaction-chain',
    'ux-three-design-solutions',
    'ux-exception-flow',
    'ux-recommendation-decision',
    'ux-priority-phasing'
  ])
  assert.match(frontendSkill.outputFormat, /原始需求分析|假设与验证|设计机会|推荐方案建议|设计优先级/)

  assert.equal(backendSkill.id, 'advanced-ux-requirement-analysis')
  assert.equal(backendSkill.outputSchema, 'smart-canvas')
  assert.equal(backendSkill.mode, 'total-design-flow')
  assert.match(backendSkill.promptTemplate, /高级 UX 需求分析|10 步|原始需求分析|假设与验证|设计机会|推荐方案建议|设计优先级|置信度|事实、推断、建议、风险/)
  assert.match(backendSkill.promptTemplate, /页面交互框架与说明|低保真|Draw\.io/)
  assert.ok(backendSkill.qualityChecks.includes('page-interaction-doc-planning'))
  assert.ok(backendSkill.qualityChecks.includes('visual-artifact-status'))
  assert.match(frontendSkill.outputFormat, /页面交互框架与说明\.md|低保真|Draw\.io/)
  assert.ok(frontendSkill.qualityChecks.includes('page-interaction-doc-planning'))
  assert.ok(frontendSkill.qualityChecks.includes('visual-artifact-status'))
  assert.ok(backendIds.includes('advanced-ux-requirement-analysis'))
})

test('advanced UX upload route prompts require the latest ten headings and new required fields', async () => {
  const uploadsSource = await readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8')
  const directPromptSource = uploadsSource.slice(
    uploadsSource.indexOf('const advancedUxDirectMarkdownPrompt'),
    uploadsSource.indexOf('const advancedUxMarkdownCompletenessPrompt')
  )
  const repairPromptSource = uploadsSource.slice(
    uploadsSource.indexOf('const advancedUxMarkdownCompletenessPrompt'),
    uploadsSource.indexOf('const fastMarkdownReplyPrompt')
  )
  const latestHeadings = [
    '原始需求分析',
    '设计问题定义',
    '用户与场景',
    '假设与验证',
    '设计机会',
    '整体交互链路',
    '三套设计方案',
    '异常流补充',
    '推荐方案建议',
    '设计优先级与分阶段计划'
  ]

  latestHeadings.forEach((heading) => {
    assert.match(uploadsSource, new RegExp(`'${heading}'`))
    assert.match(repairPromptSource, new RegExp(heading))
  })
  assert.match(directPromptSource, /ADVANCED_UX_CURRENT_SECTION_LIST/)
  assert.match(repairPromptSource, /ADVANCED_UX_CURRENT_SECTION_NAMES/)
  assert.match(uploadsSource, /docs\/skills\/advanced-ux\/需求分析阶段一skill\.md/)
  assert.match(uploadsSource, /docs\/skills\/advanced-ux\/需求阶段一产出约束\.md/)
  assert.match(uploadsSource, /docs\/skills\/advanced-ux\/交互低保阶段二\.md/)
  assert.match(uploadsSource, /docs\/skills\/advanced-ux\/AI视频爆款复刻-对照参考\.md/)
  assert.match(uploadsSource, /docs\/skills\/advanced-ux\/AI视频爆款复刻工具-阶段二产出参考\.md/)
  assert.match(directPromptSource, /禁止复制、套用或改写参考文档中的业务内容/)
  ;[
    'GWT',
    '5 Whys',
    'HMW',
    'Journey Map',
    '假设分类总表',
    '高风险假设聚焦',
    '设计机会总表',
    '机会→步骤映射',
    '页面三件套',
    '弹窗/抽屉定义表',
    '状态迁移图',
    '迁移规则表',
    'ASCII 低保真线框图',
    '方案对比矩阵',
    '关键节点低保真',
    'Problem-Solution Fit',
    '六顶思考帽',
    '优先级排序总览',
    '分期交付计划',
    '待确认决策'
  ].forEach((token) => {
    assert.match(uploadsSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })
  assert.match(uploadsSource, /缺少 5 Whys 根因追溯/)
  assert.match(uploadsSource, /缺少标准 Journey Map/)
  assert.match(uploadsSource, /缺少三方案横向对比矩阵/)
  assert.match(uploadsSource, /缺少 Problem-Solution Fit 验证/)
  assert.match(uploadsSource, /advancedUxSixHatsReviewPattern/)
  assert.match(uploadsSource, /缺少推荐方案建议下的六顶思考帽评审/)
  assert.match(uploadsSource, /advancedUxLowFiDrawioStatusPattern/)
  assert.match(uploadsSource, /图编号（如图1、图6）/)
  assert.match(uploadsSource, /图编号内容仍是兜底说明/)
  assert.doesNotMatch(directPromptSource, /必须包含且仅用以下 7 个二级标题：## 需求理解/)
  assert.doesNotMatch(repairPromptSource, /保持高级 UX 7 节点结构：需求理解/)
  assert.match(uploadsSource, /包含旧章节标题/)
})

test('advanced UX page interaction prompt allows required text code blocks', async () => {
  const uploadsSource = await readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8')
  const pagePromptSource = uploadsSource.slice(
    uploadsSource.indexOf('const pageInteractionDocumentPrompt'),
    uploadsSource.indexOf('const generateAdvancedUxPageInteractionDocument')
  )

  assert.match(pagePromptSource, /不要用代码块包裹整篇文档/)
  assert.match(pagePromptSource, /必须使用 ```text 代码块输出页面流转文本流程图/)
  assert.match(pagePromptSource, /必须保留精确二级标题/)
  assert.doesNotMatch(pagePromptSource, /不输出 JSON、解释、代码围栏或前后缀/)
})

test('advanced UX prompts require readable cross-reference labels', async () => {
  const [uploadsSource, stageOneConstraints, stageTwoSkill] = await Promise.all([
    readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8'),
    readFile(new URL('../docs/skills/advanced-ux/需求阶段一产出约束.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/skills/advanced-ux/交互低保阶段二.md', import.meta.url), 'utf8')
  ])
  const pagePromptSource = uploadsSource.slice(
    uploadsSource.indexOf('const pageInteractionDocumentPrompt'),
    uploadsSource.indexOf('const generateAdvancedUxPageInteractionDocument')
  )

  ;[uploadsSource, stageOneConstraints, stageTwoSkill].forEach((source) => {
    assert.match(source, /禁止裸编号引用/)
    assert.match(source, /编号 - 名称\/说明/)
  })
  assert.match(stageOneConstraints, /弹窗\/抽屉编号统一使用 `M \+ 两位数字`/)
  assert.match(stageTwoSkill, /弹窗\/抽屉\s+\| M \+ 两位数字/)
  assert.match(stageTwoSkill, /M\[N\].*\[关联的页面：P01 - 页面名\]/)
  assert.match(pagePromptSource, /弹窗与抽屉编号使用 M01/)
})

test('advanced UX low-fi comparison prompts require separated solution wireframes', async () => {
  const [uploadsSource, stageOneConstraints, stageTwoSkill, stageOneSkill] = await Promise.all([
    readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8'),
    readFile(new URL('../docs/skills/advanced-ux/需求阶段一产出约束.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/skills/advanced-ux/交互低保阶段二.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/skills/advanced-ux/需求分析阶段一skill.md', import.meta.url), 'utf8')
  ])

  ;[uploadsSource, stageOneConstraints, stageTwoSkill, stageOneSkill].forEach((source) => {
    assert.match(source, /禁止把方案A\/方案B\/方案C挤在同一个 ASCII 代码块/)
    assert.match(source, /每个方案单独一个 ```text 代码块/)
    assert.match(source, /差异表/)
    assert.doesNotMatch(source, /用 ASCII (?:文本布局图|线框图)(?:或 image_generate 工具生成)?并排对比/)
    assert.doesNotMatch(source, /用 ```text 代码块并排展示方案一\/方案二\/方案三/)
  })
})

test('advanced UX stage two import keeps spec-shaped detail content', () => {
  const markdown = [
    '# 复刻工具-页面交互框架与说明',
    '',
    '## 1. 文档概述',
    '',
    '| 核心假设 | 依据 | 风险 | 验证方式 | 置信度 |',
    '| --- | --- | --- | --- | --- |',
    '| 支持用户从首页导入参考视频 | 阶段一结论 | 输入不完整 | 原型评审 | 高 |',
    '',
    '## 2. 页面总览',
    '',
    '| 编号 | 页面名称 | 类型 | 所属模块 | 入口来源 | 核心职责 | 角色权限 | 数据来源 | 权限规则 | 路由路径 | analyzed |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| P01 | 复制首页 | 页面 | 核心流程 | 顶部入口 | 导入参考视频并启动解析 | user | 上传/链接 | 登录后可用 | /copy | true |',
    '',
    '## 3. 页面流转总览',
    '',
    '| 源页面 | 源页面名称 | 目标页面 | 目标页面名称 | 触发操作 | 前置条件 | 流转类型 | 触发角色 | 跳转方式 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| P01 | 复制首页 | P01 | 复制首页 | 点击开始解析 | 链接有效 | 主流程 | user | stay | 进入解析状态 |',
    '',
    '| 源页面 | 目标页面 | 传递数据 | 触发动作 | 数据用途 | 异常处理 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| P01 | P01 | 链接、上传文件 | 点击开始解析 | 创建解析任务 | 链接失败展示重试 |',
    '',
    '```text',
    'P01 复制首页 ──[点击开始解析]──> P01 解析中',
    '```',
    '',
    '## 4. 信息架构实体表',
    '',
    '| 信息实体 | 核心属性 | 关系/依赖 | 状态/流转 | 设计提示 |',
    '| --- | --- | --- | --- | --- |',
    '| 参考视频 | 链接、文件、时长 | 输入到解析任务 | 待解析/解析中/完成 | 明确格式限制 |',
    '',
    '## 5. 核心用户流程',
    '',
    '| 步骤 | 名称 | 用户行为 | 系统响应 | 产出 | 页面 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| S1 | 导入 | 用户粘贴链接 | 校验链接 | 有效输入 | P01 |',
    '',
    '## 6. 状态机',
    '',
    '| 当前状态 | 触发事件 | 目标状态 | 页面表现 | 数据变更 |',
    '| --- | --- | --- | --- | --- |',
    '| ST0 待输入 | 用户粘贴链接 | ST1 待解析 | 输入框展示链接 | 暂存输入 |',
    '',
    '## 7. 弹窗与抽屉定义表',
    '',
    '| 编号 | 名称 | 触发动作 | 关闭行为 | 提交/取消去向 | 关联页面 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| P10 | 上传说明弹窗 | 点击格式说明 | 点击关闭 | 返回 P01 | P01 |',
    '',
    '## 8. 逐页交互说明',
    '',
    '### P01 复制首页',
    '',
    '**页面定位**：导入参考视频，展示支持说明和启动入口。',
    '',
    '**页面框架**：',
    '',
    '| 区域 | 内容 | 说明 | 状态说明 | 组件引用 |',
    '| --- | --- | --- | --- | --- |',
    '| R01 顶部导航 | Logo、复制首页、模板广场 | 固定顶部 | 当前页高亮 | NavBar |',
    '| R02 主导入区 | 链接输入框、开始解析按钮、本地上传按钮 | 页面核心 CTA | 支持粘贴/拖拽 | UploadPanel |',
    '',
    '**文本布局图（ASCII）**：',
    '',
    '```text',
    '┌────────────────────┐',
    '│ R01 顶部导航        │',
    '├────────────────────┤',
    '│ R02 主导入区        │',
    '└────────────────────┘',
    '```',
    '',
    '**交互规则**：',
    '',
    '| 编号 | 用户操作 | 系统反馈 | 关联状态/弹窗 | 备注 |',
    '| --- | --- | --- | --- | --- |',
    '| IR1 | 粘贴链接 | 校验格式并显示成功状态 | ST1 | 失败时提示原因 |',
    '| IR2 | 点击开始解析 | 按钮 loading，进入解析中 | ST2 | 防重复点击 |',
    '',
    '**异常状态**：',
    '',
    '| 编号 | 状态 | 表现 | 处理方式 |',
    '| --- | --- | --- | --- |',
    '| E1 | 加载中 | 骨架屏 | 禁用重复提交 |',
    '| E2 | 空状态 | 引导输入链接 | 聚焦输入框 |',
    '| E3 | 错误态 | Toast 展示错误原因 | 支持重试 |',
    '| E4 | 无权限 | 登录提示 | 登录后恢复输入 |',
    '| E5 | 链接不可解析 | 红色提示 | 更换链接或上传文件 |',
    '',
    '## 9. 关键断点与优化节点',
    '',
    '| 断点节点 | 断点风险 | 优化动作 | 覆盖路径 | 置信度 |',
    '| --- | --- | --- | --- | --- |',
    '| S1/P01 | 用户不知道支持格式 | 展示格式说明 | 主路径 | 高 |',
    '',
    '## 10. 交互规则表（自有产品）',
    '',
    '| 规则编号 | 页面编号 | 区域编号 | 触发元素 | 触发动作 | 前置条件 | 交互行为 | 成功反馈 | 失败反馈 | 边界情况 | 关联接口 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| IR-G1 | P01 | R02 | 开始解析按钮 | 点击 | 链接有效 | 创建解析任务 | 进入解析中 | 展示错误 | 防重复点击 | /parse |',
    '',
    '## 11. 全局交互规范',
    '',
    '| 规范类型 | 规则 | 示例 | 例外 |',
    '| --- | --- | --- | --- |',
    '| 加载状态 | 超过 300ms 展示 loading | 解析按钮 loading | 极短操作可省略 |',
    '',
    '## 12. 页面3方案',
    '',
    '| 对比维度 | 方案A | 方案B | 方案C | 推荐判断 |',
    '| --- | --- | --- | --- | --- |',
    '| 入口密度 | 单入口 | 双入口 | 多入口 | 方案B |',
    '',
    '## 13. 方案验证与收敛',
    '',
    '| 核心问题 | 对应方案 | 匹配证据 | 未匹配风险 | 验证方式 |',
    '| --- | --- | --- | --- | --- |',
    '| 导入效率 | 方案B | 覆盖链接和上传 | 格式仍需确认 | 可用性测试 |',
    '',
    '## 14. 交付物清单',
    '',
    '| 产物 | 状态 | 说明 |',
    '| --- | --- | --- |',
    '| 页面交互文档 | 已生成 | Markdown 结构化内容 |'
  ].join('\n')

  const canvas = advancedUxInteractionLofiCanvasFromPageInteractionDocument({
    fileName: '复刻工具-页面交互框架与说明.md',
    markdown
  })

  assert.ok(canvas.pageInteractionDocumentArtifact, 'stage canvas should keep document-level stage two detail artifact')
  assert.equal(canvas.pageInteractionDocumentArtifact.overviewRows.length, 1)
  assert.equal(canvas.pageInteractionDocumentArtifact.flowRows.length, 1)
  assert.equal(canvas.pageInteractionDocumentArtifact.entityRows.length, 1)
  assert.equal(canvas.pageInteractionDocumentArtifact.stateRows.length, 1)
  assert.equal(canvas.pageInteractionDocumentArtifact.globalInteractionRows.length, 1)
  assert.equal(canvas.nodes[0].pageLayoutArtifact.detailSections.map((section) => section.key).join(','), 'position,framework-table,text-layout,interaction-rules,exception-states')
  assert.equal(canvas.nodes[0].pageLayoutArtifact.detailSections.find((section) => section.key === 'interaction-rules').rows.length, 3)
  assert.equal(canvas.nodes[0].pageLayoutArtifact.detailSections.find((section) => section.key === 'exception-states').rows.length, 5)
})

test('advanced UX requirement analysis builds total-flow canvas with PDF ten-node requirement stage', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个 AI 创作工具，需要深度分析用户路径、风险、机会和优先级。',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)

  assert.deepEqual(totalFlow.stages.map((stage) => stage.id), [
    'requirement-dissection',
    'interaction-lofi',
    'ui-visual',
    'html-output',
    'vue-output',
    'acceptance-deposit'
  ])
  assert.deepEqual(totalFlow.stageCanvases['requirement-dissection'].nodes.map((node) => node.id), [
    'ux-original-requirement-analysis',
    'ux-design-problem-definition',
    'ux-user-scenario',
    'ux-assumption-validation',
    'ux-design-opportunity',
    'ux-interaction-chain',
    'ux-three-design-solutions',
    'ux-exception-flow',
    'ux-recommendation-decision',
    'ux-priority-phasing'
  ])
  assert.ok(totalFlow.stageCanvases['requirement-dissection'].nodes.every((node) => node.artifactStatus === 'generating'))
  assert.equal(totalFlow.advancedUxReport?.status, 'generating')
  assert.match(totalFlow.advancedUxReport?.fileName || '', /^高级UX需求分析-\d{8}-\d{4}\.md$/)
})

test('advanced UX markdown report imports into generated ten-node requirement canvas', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const report = buildAdvancedUxMarkdownReport(analysis)
  const importedFlow = importAdvancedUxMarkdownReportToTotalFlow(totalFlow, report)

  assert.equal(importedFlow.advancedUxReport.status, 'imported')
  assert.match(importedFlow.advancedUxReport.markdown, /## 原始需求分析/)
  assert.equal(importedFlow.advancedUxReport.sections.length, 10)
  assert.deepEqual(importedFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.map((tab) => tab.id), [
    'ux-original-requirement-analysis',
    'ux-design-problem-definition',
    'ux-user-scenario',
    'ux-assumption-validation',
    'ux-design-opportunity',
    'ux-interaction-chain',
    'ux-three-design-solutions',
    'ux-exception-flow',
    'ux-recommendation-decision',
    'ux-priority-phasing'
  ])
  assert.ok(importedFlow.stageCanvases['requirement-dissection'].nodes.every((node) => node.artifactStatus === 'generated'))
  assert.ok(importedFlow.stageCanvases['requirement-dissection'].nodes.every((node) => /我要做一个卖鞋子的小程序|卖鞋子的小程序/.test(node.markdown || node.summary || '')))
})

test('advanced UX fallback markdown report follows stage one output standard sections', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个给企业销售团队使用的线索跟进 Web 工具',
    documents: []
  })
  const report = buildAdvancedUxMarkdownReport(analysis)
  const markdown = report.markdown

  ;[
    '需求理解清单',
    '需求清晰度评分表',
    'GWT 功能行为描述',
    '5 Whys 根因追溯',
    '关键缺口清单',
    '追问清单',
    '目标矩阵表',
    '体验矛盾表',
    'HMW 问题卡片',
    '用户旅程地图',
    '页面优先级初判表',
    '假设分类总表',
    '高风险假设聚焦',
    '设计机会总表',
    '优先 Top 3-5 机会',
    '机会→步骤映射',
    '页面总览表',
    '页面流转表',
    '页面框架表',
    '状态机表',
    '信息架构实体表',
    '全局交互规范表',
    '方案卡片',
    '三方案对比矩阵',
    '异常流矩阵表',
    '推荐决策卡片',
    '假设回检',
    '六帽评审表',
    '优先级排序总览',
    '分期交付计划',
    '待确认决策',
    '数据埋点方案表',
    '最终方案页面清单',
    '下一步行动表',
    '页面交互框架与说明.md'
  ].forEach((token) => assert.match(markdown, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
  assert.match(markdown, /```text[\s\S]*┌[\s\S]*┘[\s\S]*```/)
  assert.equal(report.sections.length, 10)
})

test('advanced UX markdown import turns framework subsections into structured detail blocks', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const markdown = [
    '## 节点 01：原始需求分析',
    '',
    '### 1. 原始需求识别清单（4维提取）',
    '',
    '| 维度 | 提取内容 | 置信度 |',
    '|------|---------|--------|',
    '| 用户 | 鞋类消费者 | 低 |',
    '| 场景 | 浏览鞋款、筛选尺码、下单支付 | 低 |',
    '',
    '### 2. 需求清晰度评分',
    '',
    '| 子维度 | 评分(1-5) | 判断依据 |',
    '|--------|----------|---------|',
    '| 清晰度 | 2 | 方向明确但定位不足 |',
    '| 完整度 | 1 | 缺少履约和售后 |',
    '| 总分 | 6 | 需要先补齐P0问题 |',
    '',
    '### 4. 完整性缺口清单',
    '',
    '| 优先级 | 缺口 | 影响的用户行为 | 不补齐的风险 | 补全建议 | 置信度 |',
    '|--------|------|--------------|-------------|---------|--------|',
    '| P0 | 售后政策不明 | 尺码不合 | 用户不敢下单 | 明确换码规则 | 低 |',
    '',
    '### 6. 追问清单',
    '',
    '| 优先级 | 追问问题 | 阻塞程度 |',
    '|--------|---------|---------|',
    '| P0 | 是单品牌还是集合店？ | 完全阻塞 |',
    '',
    '## 节点 02：设计问题定义',
    '',
    '### 1. 功能点总览',
    '',
    '| # | 功能点 | 类型 | 用户故事 | 验收标准数 | 初步优先级 |',
    '|---|--------|------|---------|-----------|-----------|',
    '| 1 | 商品分类与筛选 | 核心 | As a 买鞋用户, I want to 按尺码筛选, so that 更快找到有货尺码 | 3 | P0 |',
    '',
    '### 2. 功能点详情',
    '',
    '#### 功能点 1：商品分类与筛选',
    '',
    '- **类型**：核心功能',
    '- **用户故事**：As a 买鞋用户, I want to 按尺码筛选, so that 更快找到有货尺码',
    '- **功能描述**：支持品牌、尺码、颜色筛选。',
    '- **体验验收标准**：',
    '  - Given 用户选择42码, When 列表刷新, Then 只展示42码有货商品。',
    '- **补充体验要求**：',
    '  - 边界条件：无库存尺码必须置灰且不可加入购物车。',
    '  - 信息表达：筛选结果要展示可售尺码和库存状态。',
    '- **依赖关系**：',
    '  - 前置依赖：商品 SKU 库存服务。',
    '  - 被依赖：商品详情页、购物车。',
    '- **优先级判断**：',
    '  - 用户价值：5/5 — 直接影响选购效率。',
    '  - 实现复杂度：2/5 — 依赖现有筛选能力。',
    '  - 建议优先级：P0',
    '- **置信度**：中',
    '',
    '## 节点 03：用户与场景',
    '',
    '### 1. 假设清单',
    '',
    '| # | 类型 | 假设 | 如果不成立的影响 | 验证方式 | 置信度 |',
    '|---|------|------|----------------|---------|--------|',
    '| 1 | 用户-信任 | 用户相信正品保障 | 转化低 | 访谈 | 低 |',
    '',
    '### 2. 体验风险清单',
    '',
    '| 优先级 | 风险 | 触发路径 | 用户影响 | 预案 |',
    '|--------|------|---------|---------|------|',
    '| P0 | 尺码不合且换码困难 | 用户选码→收货试穿→发现不合适→寻找换码入口 | 信任下降 | 换码入口前置 |',
    '',
    '## 节点 04：假设与验证',
    '',
    '### 1. 假设分类总表',
    '',
    '| 假设内容 | 分类 | 来源追溯 | 不成立的影响 | 验证方式 | 置信度 | 当前状态 |',
    '|---------|------|----------|--------------|----------|--------|----------|',
    '| 用户愿意在线完成尺码决策 | 用户假设 | 用户与场景 | 转化下降 | 原型测试 | 中 | 待验证 |',
    '',
    '### 2. 高风险假设聚焦',
    '',
    '| 高风险假设 | 置信度 | 降级策略 | 触发验证的时间节点 |',
    '|------------|--------|----------|--------------------|',
    '| 尺码助手能降低退换率 | 中 | 保留人工客服入口 | MVP 原型测试后 |',
    '',
    '### 3. 假设回检点',
    '',
    '| 假设编号 | 回检节点 | 回检方式 |',
    '|----------|----------|----------|',
    '| H1 | 推荐方案建议 | 对照 PSF 和原型测试结果回检 |',
    '',
    '## 节点 05：设计机会',
    '',
    '### 1. 设计机会总表',
    '',
    '| 机会编号 | 机会描述 | 类型 | 上游依据 | 可承接步骤 | 预期价值 | 优先级 |',
    '|----------|----------|------|----------|------------|----------|--------|',
    '| O1 | 尺码助手前置 | 体验 | 尺码不合风险 | 步骤07 三套设计方案 | 降低决策成本 | P0 |',
    '',
    '### 2. 优先 Top 3-5 机会',
    '',
    '| 排序 | 机会编号 | 机会描述 | 优先理由 | 设计方向提示 |',
    '|------|----------|----------|----------|--------------|',
    '| Top 1 | O1 | 尺码助手前置 | 直接影响下单 | 在详情页给出推荐尺码 |',
    '',
    '### 3. 机会→步骤映射',
    '',
    '| 机会编号 | 承接步骤 | 承接方式 |',
    '|----------|----------|----------|',
    '| O1 | 步骤06 整体交互链路 | 进入商品详情与下单主流程 |',
    '',
    '## 节点 06：整体交互链路',
    '',
    '### 1. 用户流程图',
    '',
    '```text',
    '浏览首页 → 筛选尺码 → 查看详情 → 加入购物车 → 支付 → 查看物流',
    '```',
    '',
    '### 3. 信息架构',
    '',
    '| 信息实体 | 核心属性 | 关系/依赖 | 状态/流转 | 设计提示 |',
    '|---------|---------|----------|----------|---------|',
    '| 商品SPU | 品牌、款名、图片 | 1:N SKU | 上架/下架 | 卡片突出可选尺码 |',
    '',
    '## 节点 07：三套设计方案',
    '',
    '### 1. 机会总览',
    '',
    '| 类型 | 数量 | 主要判断 |',
    '|------|------|---------|',
    '| 功能机会 | 5 | 尺码、库存、售后是关键 |',
    '',
    '### 5. 关键交互流程（Top 3 优先机会）',
    '',
    '#### 交互流程 1：尺码助手',
    '',
    '```text',
    '商品详情 → 点击尺码助手 → 输入脚长 → 输出建议尺码 → 一键选中',
    '```',
    '',
    '### 6. 优先方案收敛（Top 3）',
    '',
    '| Top | 方案 | 理由 | 用户行为依据 | 建议落点 | 置信度 |',
    '|-----|------|------|-------------|---------|--------|',
    '| 1 | 尺码助手 | 降低尺码决策成本 | 用户需要先判断尺码 | 商品详情 | 高 |',
    '',
    '## 节点 08：异常流补充',
    '',
    '### 1. 全局排序',
    '',
    '| 排名 | 项目 | 类型 | 设计价值(1-5) | 实现成本(1-5) | 验证必要性 | 排序理由 |',
    '|------|------|------|-------------|-------------|-----------|---------|',
    '| 1 | 商品详情与尺码决策 | 核心功能 | 5 | 4 | 高 | 直接影响支付 |',
    '',
    '### 2. 分阶段打包',
    '',
    '#### 第一阶段：优先打磨（MVP验证）',
    '',
    '| 项目 | 推荐做法 | 用户收益 | 关键风险 |',
    '|------|---------|---------|---------|',
    '| 基础售后 | 退货/换码申请入口 | 提升购买信心 | SOP不清 |',
    '',
    '## 节点 09：推荐方案建议',
    '',
    '### 1. 交付物清单',
    '',
    '| 交付物 | 负责人 | 交付时间 | 验收标准 |',
    '|--------|--------|---------|---------|',
    '| PRD产品需求文档 | 产品经理 | T+2周 | 覆盖P0功能 |',
    '',
    '### 3. 开发对接Checklist',
    '',
    '| # | 检查项 | 说明 | 状态 |',
    '|---|--------|------|------|',
    '| 1 | SPU/SKU字段是否完整？ | 品牌、尺码、库存 | ☐ |',
    '',
    '### 4. 数据埋点方案',
    '',
    '| 埋点事件 | 触发条件 | 上报参数 | 用途 |',
    '|---------|---------|---------|------|',
    '| size_select | 选择尺码 | 商品id、尺码 | 分析尺码需求 |',
    '',
    '## 节点 10：设计优先级与分阶段计划',
    '',
    '### 1. 优先级排序总览',
    '',
    '| 功能/机会 | 用户价值 | 业务价值 | 实施成本 | 综合优先级 | 分期建议 |',
    '|-----------|----------|----------|----------|------------|----------|',
    '| O1 尺码助手 | 高 | 高 | 中 | P0 | 一期 |',
    '',
    '### 2. 分期交付计划',
    '',
    '| 阶段 | 范围 | 核心目标 | 交付物 | 验证标准 | 预计周期 |',
    '|------|------|----------|--------|----------|----------|',
    '| 一期 | 商品详情与尺码决策 | 降低选码成本 | 原型与接口 | 任务完成率提升 | 2周 |',
    '',
    '### 3. 待确认决策',
    '',
    '| 决策事项 | 影响范围 | 需要谁确认 | 确认时限 | 不确认的影响 |',
    '|----------|----------|------------|----------|--------------|',
    '| 退换码规则 | 售后入口 | 运营/法务 | 开发前 | 影响下单信任 |'
  ].join('\n')

  const importedFlow = importAdvancedUxMarkdownReportToTotalFlow(totalFlow, {
    fileName: '高级UX需求分析-20260709-1200.md',
    markdown
  })
  const tabs = importedFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs
  const understandingBlocks = tabs.find((tab) => tab.id === 'ux-original-requirement-analysis').detailBlocks
  const decompositionBlocks = tabs.find((tab) => tab.id === 'ux-design-problem-definition').detailBlocks
  const flowBlocks = tabs.find((tab) => tab.id === 'ux-interaction-chain').detailBlocks
  const opportunityBlocks = tabs.find((tab) => tab.id === 'ux-three-design-solutions').detailBlocks
  const deliveryBlocks = tabs.find((tab) => tab.id === 'ux-recommendation-decision').detailBlocks

  assert.ok(understandingBlocks.some((block) => block.type === 'score-card' && block.rows?.length >= 3))
  assert.ok(understandingBlocks.some((block) => block.type === 'risk-matrix' && block.title.includes('缺口')))
  assert.ok(understandingBlocks.some((block) => block.type === 'question-list' && block.rows?.[0]?.cells?.includes('完全阻塞')))
  assert.ok(decompositionBlocks.some((block) => block.type === 'priority-table' && block.columns?.includes('As a') && block.columns?.includes('I want to') && block.columns?.includes('so that')))
  assert.ok(decompositionBlocks.some((block) => block.type === 'priority-table' && block.rows?.[0]?.cells?.includes('买鞋用户') && block.rows?.[0]?.cells?.includes('按尺码筛选') && block.rows?.[0]?.cells?.includes('更快找到有货尺码')))
  const featureItem = decompositionBlocks.find((block) => block.type === 'feature-list')?.items?.[0]
  assert.equal(featureItem.asA, '买鞋用户')
  assert.equal(featureItem.iWantTo, '按尺码筛选')
  assert.equal(featureItem.soThat, '更快找到有货尺码')
  assert.equal(featureItem.boundaryCondition, '无库存尺码必须置灰且不可加入购物车。')
  assert.equal(featureItem.informationExpression, '筛选结果要展示可售尺码和库存状态。')
  assert.equal(featureItem.prerequisiteDependencies, '商品 SKU 库存服务。')
  assert.equal(featureItem.dependentDependencies, '商品详情页、购物车。')
  assert.equal(featureItem.userValue, '5/5 — 直接影响选购效率。')
  assert.equal(featureItem.implementationComplexity, '2/5 — 依赖现有筛选能力。')
  assert.equal(featureItem.suggestedPriority, 'P0')
  assert.equal(featureItem.confidence, '中')
  const riskBlock = importedFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs
    .find((tab) => tab.id === 'ux-user-scenario')
    .detailBlocks
    .find((block) => block.title.includes('体验风险清单'))
  assert.match(riskBlock.rows?.[0]?.cells?.[2] || '', /用户选码→收货试穿→发现不合适→寻找换码入口/)
  assert.ok(flowBlocks.some((block) => block.type === 'flow-wireframe' && /筛选尺码/.test(block.content || '')))
  assert.ok(flowBlocks.some((block) => block.type === 'entity-table' && block.columns?.includes('信息实体')))
  assert.ok(opportunityBlocks.some((block) => block.type === 'flow-wireframe' && /尺码助手/.test(block.content || '')))
  assert.ok(opportunityBlocks.some((block) => block.title.includes('优先方案收敛') && block.rows?.[0]?.cells?.[0] === 'Top 1：尺码助手'))
  assert.ok(deliveryBlocks.some((block) => block.type === 'checklist' && block.rows?.[0]?.cells?.includes('☐')))
  assert.ok(deliveryBlocks.some((block) => block.type === 'metric-table' && block.columns?.includes('埋点事件')))
  assert.ok(importedFlow.stageCanvases['requirement-dissection'].nodes.every((node) => node.detailBlocks?.some((block) => block.type !== 'markdown')))
})

test('advanced UX markdown import wraps natural diagrams and rejects placeholder figure content', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    input: '我要做一个 AI 视频爆款复刻工具',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const markdown = [
    '## 节点 06：整体交互链路',
    '',
    '### 1. 用户流程图',
    '',
    '[进入工具]',
    '↓',
    '[粘贴链接或上传视频]',
    '├─ 失败 → [展示失败原因]',
    '└─ 成功 → [创建参考视频对象]',
    '',
    '### 2. 业务流程图',
    '',
    '[项目草稿创建]',
    '↓',
    '[写入参考视频]',
    '↓',
    '[生成拆解任务]',
    '',
    '### 7. 状态迁移图',
    '',
    'ST0(草稿) -> ST1(解析中) -> ST2(已完成)',
    'ST1(解析中) -> ST3(解析失败) -> ST1(解析中)',
    '',
    '### 9. 低保真线框图',
    '',
    '┌────────────────────┐',
    '│ 顶部导航             │',
    '├────────────────────┤',
    '│ 导入区 / 拆解区 / 预览区 │',
    '└────────────────────┘',
    '',
    '## 节点 07：三套设计方案',
    '',
    '### 7. 关键节点低保真对比',
    '',
    '#### 方案一 - 分步向导',
    '',
    '```text',
    '┌────────┐',
    '│ 导入   │',
    '└────────┘',
    '```',
    '',
    '#### 方案二 - 单页工作台',
    '',
    '```text',
    '┌────────┐',
    '│ 输入区 │',
    '└────────┘',
    '```',
    '',
    '#### 方案三 - AI 对话助手',
    '',
    '```text',
    '┌────────┐',
    '│ 对话区 │',
    '└────────┘',
    '```',
    '',
    '| 对比点 | 方案一 | 方案二 | 方案三 |',
    '|--------|--------|--------|--------|',
    '| 布局差异 | 分步进入 | 单页集中 | 对话引导 |',
    '',
    '## 节点 09：推荐方案建议',
    '',
    '### 2. 六顶思考帽评审',
    '',
    '| 帽子 | 方案一 | 方案二 | 方案三 | 结论 |',
    '|------|--------|--------|--------|------|',
    '| 白帽 | 流程清晰 | 信息密度高 | 依赖 AI 稳定性 | 事实上方案一最稳 |',
    '| 红帽 | 用户安心 | 老手顺手 | 新手轻松 | 情绪价值各有侧重 |',
    '| 黑帽 | 流程偏长 | 容易迷失 | 输出不可控 | 一期避免高不确定 |',
    '| 黄帽 | 易上线 | 效率高 | 差异化强 | 可分阶段吸收 |',
    '| 绿帽 | 可局部回流 | 可演进工作台 | 可做辅助助手 | 路线可组合 |',
    '| 蓝帽 | 一期主方案 | 二期增强 | 三期探索 | 先选方案一 |',
    '',
    '### 10. 低保真线框图产物约束',
    '',
    '| 项目 | 约束 |',
    '|------|------|',
    '| 图6 | 当前仅输出 ASCII 文本布局；真实低保真图片和 Draw.io 文件待后续按触发条件生成 |'
  ].join('\n')

  const importedFlow = importAdvancedUxMarkdownReportToTotalFlow(totalFlow, {
    fileName: '高级UX需求分析-20260712-1200.md',
    markdown
  })
  const normalized = importedFlow.advancedUxReport.markdown
  assert.match(normalized, /### 1\. 用户流程图[\s\S]*```text[\s\S]*\[进入工具\][\s\S]*```/)
  assert.match(normalized, /### 2\. 业务流程图[\s\S]*```text[\s\S]*\[项目草稿创建\][\s\S]*```/)
  assert.match(normalized, /### 7\. 状态迁移图[\s\S]*```text[\s\S]*ST0\(草稿\).*ST1\(解析中\)[\s\S]*```/)
  assert.match(normalized, /### 9\. 低保真线框图[\s\S]*```text[\s\S]*┌/)
  assert.match(normalized, /### 7\. 关键节点低保真对比[\s\S]*#### 方案一[\s\S]*```text[\s\S]*┌[\s\S]*```[\s\S]*#### 方案二[\s\S]*```text[\s\S]*┌[\s\S]*```[\s\S]*#### 方案三[\s\S]*```text[\s\S]*┌[\s\S]*```/)
  const normalizedTextBlocks = Array.from(normalized.matchAll(/```text\s*([\s\S]*?)```/g), (match) => match[1] || '')
  assert.ok(normalizedTextBlocks.every((block) => !/方案一[\s\S]{0,120}方案二[\s\S]{0,120}方案三/.test(block)))
  assert.doesNotMatch(normalized, /当前仅输出 ASCII 文本布局；真实低保真图片和 Draw\.io 文件待后续按触发条件生成/)

  const flowBlocks = importedFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs
    .find((tab) => tab.id === 'ux-interaction-chain')
    .detailBlocks
  const solutionBlocks = importedFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs
    .find((tab) => tab.id === 'ux-three-design-solutions')
    .detailBlocks
  assert.ok(flowBlocks.filter((block) => block.type === 'flow-wireframe').length >= 4)
  assert.ok(solutionBlocks.filter((block) => block.type === 'flow-wireframe' && /┌/.test(block.content || '')).length >= 3)
})

test('advanced UX markdown import recognizes natural numbered node headings', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const markdown = [
    '## 01 原始需求分析：这是什么？包含什么？缺什么？',
    '',
    '### 1. 下一步判断',
    '',
    '判断结果：可继续，但需要补齐关键假设。',
    '',
    '## 02 设计问题定义：真正要解决什么？',
    '',
    '### 1. 功能点总览',
    '',
    '| # | 功能点 | 类型 |',
    '|---|--------|------|',
    '| 1 | 商品详情 | 核心 |',
    '',
    '## 03 用户与场景：谁在什么情况下使用？',
    '',
    '### 1. 假设清单',
    '',
    '- 假设用户愿意在线买鞋。',
    '',
    '## 04 假设与验证：哪些判断需要验证？',
    '',
    '### 1. 假设分类总表',
    '',
    '| 假设内容 | 分类 | 来源追溯 | 不成立的影响 | 验证方式 | 置信度 | 当前状态 |',
    '|---------|------|----------|--------------|----------|--------|----------|',
    '| 用户愿意在线买鞋 | 用户假设 | 用户输入 | 转化下降 | 访谈 | 低 | 待验证 |',
    '',
    '## 05 设计机会：哪些机会值得承接？',
    '',
    '### 1. 设计机会总表',
    '',
    '| 机会描述 | 类型 | 上游依据 | 可承接步骤 | 预期价值 | 优先级 |',
    '|----------|------|----------|------------|----------|--------|',
    '| 尺码助手 | 体验 | 尺码风险 | 步骤07 | 降低退换 | P0 |',
    '',
    '## 06 整体交互链路：怎么串起来？',
    '',
    '### 1. 用户流程图',
    '',
    '浏览 → 下单',
    '',
    '## 07 三套设计方案：有什么方案？具体怎么做？',
    '',
    '### 1. 机会总览',
    '',
    '- 尺码助手。',
    '',
    '## 08 异常流补充：哪里会失败？怎么恢复？',
    '',
    '### 1. 全局排序',
    '',
    '- 商品详情 P0。',
    '',
    '## 09 推荐方案建议：怎么落地？怎么验证？',
    '',
    '### 1. 交付物清单',
    '',
    '- PRD。',
    '',
    '## 10 设计优先级与分阶段计划：先做什么？',
    '',
    '### 1. 优先级排序总览',
    '',
    '| 功能/机会 | 用户价值 | 业务价值 | 实施成本 | 综合优先级 | 分期建议 |',
    '|-----------|----------|----------|----------|------------|----------|',
    '| 尺码助手 | 高 | 高 | 中 | P0 | 一期 |'
  ].join('\n')

  const importedFlow = importAdvancedUxMarkdownReportToTotalFlow(totalFlow, {
    fileName: '高级UX需求分析-20260709-1200.md',
    markdown
  })
  const nodes = importedFlow.stageCanvases['requirement-dissection'].nodes

  assert.equal(importedFlow.advancedUxReport.status, 'imported')
  assert.deepEqual(nodes.map((node) => node.id), [
    'ux-original-requirement-analysis',
    'ux-design-problem-definition',
    'ux-user-scenario',
    'ux-assumption-validation',
    'ux-design-opportunity',
    'ux-interaction-chain',
    'ux-three-design-solutions',
    'ux-exception-flow',
    'ux-recommendation-decision',
    'ux-priority-phasing'
  ])
  assert.match(nodes.find((node) => node.id === 'ux-design-problem-definition').markdown, /02 设计问题定义/)
})

test('advanced UX markdown import failure keeps report and marks placeholder nodes failed', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const importedFlow = importAdvancedUxMarkdownReportToTotalFlow(totalFlow, {
    fileName: '高级UX需求分析-20260709-1200.md',
    markdown: '## 需求理解\n只有一个章节'
  })

  assert.equal(importedFlow.advancedUxReport.status, 'import_failed')
  assert.match(importedFlow.advancedUxReport.importError, /缺少章节/)
  assert.equal(importedFlow.stageCanvases['requirement-dissection'].nodes.length, 10)
  assert.ok(importedFlow.stageCanvases['requirement-dissection'].nodes.every((node) => node.artifactStatus === 'failed'))
  const returnedNode = importedFlow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'ux-original-requirement-analysis')
  assert.match(returnedNode.markdown || '', /只有一个章节/)
  assert.ok(returnedNode.detailBlocks?.length, 'failed import should still expose returned section detail blocks')
})

test('advanced UX quality failure canvas nodes do not keep generating placeholder status', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    input: '做一个 AI 生成视频工具',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const failedFlow = failAdvancedUxMarkdownGenerationInTotalFlow(totalFlow, '高级 UX Markdown 未符合输出规范')
  const nodes = failedFlow.stageCanvases['requirement-dissection'].nodes

  assert.ok(nodes.every((node) => node.artifactStatus === 'failed'))
  assert.ok(nodes.every((node) => node.generationPlaceholderStatus === 'failed'))
  assert.ok(nodes.every((node) => !/正在生成/.test(`${node.summary || ''} ${node.content?.join(' ') || ''}`)))
})

test('advanced UX quality failure keeps returned markdown visible while marking nodes failed', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    input: '做一个 AI 生成视频工具',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const returnedMarkdown = [
    '## 原始需求分析',
    '### 本节点结论',
    '模型已经返回了原始需求分析，但仍缺少部分门禁要求。',
    '',
    '## 设计问题定义',
    '### 本节点结论',
    '模型已经返回了设计问题定义。',
    '',
    '## 用户与场景',
    '### 本节点结论',
    '模型已经返回了用户与场景。',
    '',
    '## 整体交互链路',
    '### 本节点结论',
    '模型已经返回了整体交互链路。',
    '',
    '## 三套设计方案',
    '### 本节点结论',
    '模型已经返回了三套设计方案。',
    '',
    '## 异常流补充',
    '### 本节点结论',
    '模型已经返回了异常流补充。',
    '',
    '## 推荐方案建议',
    '### 本节点结论',
    '模型已经返回了推荐方案建议。'
  ].join('\n')
  const failedFlow = failAdvancedUxMarkdownGenerationInTotalFlow({
    ...totalFlow,
    advancedUxReport: {
      status: 'quality_failed',
      fileName: '高级UX需求分析.md',
      markdown: returnedMarkdown
    }
  }, '高级 UX Markdown 未符合输出规范')
  const nodes = failedFlow.stageCanvases['requirement-dissection'].nodes
  const firstNode = nodes.find((node) => node.id === 'ux-original-requirement-analysis')

  assert.ok(nodes.every((node) => node.artifactStatus === 'failed'))
  assert.match(firstNode.markdown || '', /模型已经返回了原始需求分析/)
  assert.doesNotMatch(firstNode.summary || '', /未生成可导入内容/)
  assert.ok(firstNode.detailBlocks?.some((block) => block.type === 'markdown'))
  assert.equal(failedFlow.advancedUxReport.markdown, returnedMarkdown)
})

test('manual legacy dialogue skill routes to the active advanced UX skill', () => {
  const routing = orchestrateRequirementSkill({
    skillSelectionMode: 'manual',
    skillId: 'dialogue-skill',
    input: '先对话分析，最后再出页面画布'
  })

  assert.equal(routing.skillSelectionMode, 'manual')
  assert.equal(routing.requestedSkillId, 'dialogue-skill')
  assert.equal(routing.resolvedSkillId, 'advanced-ux-requirement-analysis')
  assert.equal(routing.displaySkillName, '高级 UX 需求分析')
  assert.match(routing.routingReason, /清空其它 Skill|高级 UX/)
})

test('workflow entry exposes only advanced UX skill', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const optionsSource = appSource.slice(
    appSource.indexOf('const workflowSkillOptions = computed'),
    appSource.indexOf('const workflowSelectedSkillLabel = computed')
  )

  assert.match(appSource, /selectedWorkflowId:\s*'advanced-ux-requirement-analysis'/)
  assert.match(optionsSource, /value:\s*'advanced-ux-requirement-analysis',\s*label:\s*'高级 UX 需求分析'/)
  assert.match(optionsSource, /const workflowInternalSkillOptions = computed/)
  assert.doesNotMatch(optionsSource, /value:\s*'total-design-flow',\s*label:\s*'总流程'/)
  assert.doesNotMatch(optionsSource, /value:\s*'ux-design-confirmation-skill',\s*label:\s*'UX 设计确认 Skill'/)
  assert.doesNotMatch(optionsSource, /value:\s*'dialogue-skill',\s*label:\s*'对话 Skill'/)
  assert.doesNotMatch(optionsSource, /value:\s*'competitor-monitor-skill',\s*label:\s*'竞品分析 Skill'/)
  assert.match(appSource, /function isTotalFlowLikeWorkflowId\(workflowId = ''\)/)
  assert.match(appSource, /const analysisSkillId = isTotalFlowLikeWorkflowId\(workflowForm\.selectedWorkflowId\) \? workflowForm\.selectedWorkflowId : workflowForm\.selectedWorkflowId/)
  assert.match(appSource, /requestedSkillId:\s*workflowForm\.selectedWorkflowId/)
  assert.match(appSource, /const analysisSkillSelectionMode = isTotalFlowLikeWorkflowId\(workflowForm\.selectedWorkflowId\) \|\| analysisSkillId === 'auto' \? 'auto' : 'manual'/)
  assert.match(appSource, /isTotalFlowLikeWorkflowId\(workflowForm\.selectedWorkflowId\) \? workflowSelectedSkillLabel\.value : analysisSkillId === 'auto' \? '智能推荐 Skill' : workflowSelectedSkillLabel\.value/)
  assert.match(appSource, /const isUxConfirmationSkillSelected = computed/)
  assert.match(appSource, /const isTotalDesignFlowSelected = computed/)
  assert.match(appSource, /const isDialogueSkillSelected = computed/)
  assert.match(appSource, /const workflowPrimaryActionLabel = computed/)
  assert.match(appSource, /立即分析/)
  assert.doesNotMatch(appSource, /进入总流程/)
  assert.match(appSource, /@submit\.prevent="handleWorkflowPrimaryAction"/)
  assert.match(appSource, /type="submit"[\s\S]*workflowPrimaryActionLabel/)
})

test('workflow entry always exposes the skill selector and defaults to advanced UX', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const optionsSource = appSource.slice(
    appSource.indexOf('const workflowSkillOptions = computed'),
    appSource.indexOf('const workflowSelectedSkillLabel = computed')
  )
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('class="workflow-records-section"', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)

  assert.match(appSource, /const shouldShowWorkflowSkillSelector = computed\(\(\) => true\)/)
  assert.match(appSource, /selectedWorkflowId:\s*'advanced-ux-requirement-analysis'/)
  assert.doesNotMatch(optionsSource, /value:\s*'ux-design-confirmation-skill',\s*label:\s*'UX 设计确认 Skill'/)
  assert.doesNotMatch(optionsSource, /value:\s*'dialogue-skill',\s*label:\s*'对话 Skill'/)
  assert.match(entrySource, /v-if="shouldShowWorkflowSkillSelector"[\s\S]*workflow-skill-dropdown/)
  assert.match(entrySource, /@submit\.prevent="handleWorkflowPrimaryAction"/)
  assert.match(entrySource, /@keydown\.enter\.exact\.prevent="handleWorkflowPrimaryAction"/)
  assert.match(appSource, /const workflowPrimaryActionLabel = computed/)
})

test('workflow entry hides project binding control while keeping project demand context', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('class="workflow-records-section"', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)

  assert.doesNotMatch(entrySource, /class="composer-project-chip"/)
  assert.doesNotMatch(entrySource, /showProjectPicker = true/)
  assert.match(appSource, /const workflowAnalysisProject = computed\(\(\) => \{[\s\S]*workflowForm\.demandScope === 'project'[\s\S]*return currentProject\.value/)
  assert.doesNotMatch(appSource, /参考项目/)
  assert.doesNotMatch(appSource, /不参考项目/)
})

test('workflow analysis injects bound project knowledge only for project demands', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const projectKnowledgeSource = await readFile(new URL('../frontend/src/services/projectKnowledgeContext.js', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('const isCurrentAnalysisRequest', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(appSource, /function workflowSelectedKnowledgeScopeDocuments\(/)
  assert.match(appSource, /sourceType:\s*'selected-knowledge-scope'/)
  assert.match(appSource, /selectedKnowledgeNodeAiContext\.value/)
  assert.match(appSource, /selectedKnowledgePrototypePage\.value/)
  assert.match(appSource, /function workflowKnowledgeContextDocuments\(/)
  assert.match(appSource, /function workflowKnowledgeContextDocuments\(limit = 8, query = '', projectId = state\.currentProjectId\)/)
  assert.match(appSource, /buildProjectKnowledgeContextDocuments\(\{[\s\S]*assets:\s*scopeItems\(state\.assets, projectId\)[\s\S]*materials:\s*scopeItems\(state\.knowledge, projectId\)/)
  assert.match(projectKnowledgeSource, /sourceType:\s*'project-knowledge-framework'/)
  assert.match(projectKnowledgeSource, /renderPrototypeDocument\(project, flowAsset, 'project-knowledge-flow'\)/)
  assert.match(projectKnowledgeSource, /renderPrototypeDocument\(project, prototypeAsset, 'project-knowledge-prototype'\)/)
  assert.match(projectKnowledgeSource, /sourceType:\s*'project-knowledge-markdown'/)
  assert.match(appSource, /rankWorkflowKnowledgeItems\(query, scopeItems\(state\.knowledge, projectId\), workflowActiveKnowledgeScope\(\)\)/)
  assert.match(appSource, /sourceType:\s*'project-knowledge'/)
  assert.match(appSource, /name:\s*`项目知识库：\$\{item\.title/)
  assert.match(appSource, /content:\s*workflowKnowledgeContextText\(item\)/)
  assert.match(analyzeSource, /const selectedKnowledgeScopeDocuments = workflowSelectedKnowledgeScopeDocuments\(workflowEntrySnapshot\.input, persistedPendingRun\.projectId\)/)
  assert.match(analyzeSource, /const knowledgeContextDocuments = workflowKnowledgeContextDocuments\(8, workflowEntrySnapshot\.input, persistedPendingRun\.projectId\)/)
  assert.match(analyzeSource, /persistedPendingRun\.demandScope === 'project' \? knowledgeContextDocuments : \[\]/)
  assert.match(analyzeSource, /documents:\s*\[\s*\.\.\.workflowEntrySnapshot\.documents\.map/)
  assert.match(analyzeSource, /\.\.\.\(persistedPendingRun\.demandScope === 'project' \? selectedKnowledgeScopeDocuments : \[\]\)/)
  assert.match(analyzeSource, /\.\.\.\(persistedPendingRun\.demandScope === 'project' \? knowledgeContextDocuments : \[\]\)/)
})

test('workflow entry matches factory background and primary action uses a default prompt for empty input', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const emptyInputStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const emptyInputEnd = appSource.indexOf('const pendingRun = {', emptyInputStart)
  const emptyInputGuard = appSource.slice(emptyInputStart, emptyInputEnd)

  assert.match(styleSource, /\.factory-view\s*\{/)
  assert.match(styleSource, /\.workflow-entry-view\s*\{[\s\S]*background:\s*#fff/)
  assert.match(styleSource, /\.workflow-capture-entry\s*\{[\s\S]*min-height:\s*620px/)
  assert.match(styleSource, /\.workflow-capture-entry\s*\{[\s\S]*radial-gradient\(circle at 50% 5%, rgba\(105, 225, 245, 0\.18\), transparent 24%\)/)
  assert.match(styleSource, /radial-gradient\(circle at 50% 10%, rgba\(105, 225, 245, 0\.16\), transparent 28%\)/)
  assert.match(styleSource, /linear-gradient\(180deg, #ffffff 0%, #fbfcfd 56%, #ffffff 100%\)/)
  assert.match(appSource, /function workflowDefaultPrompt\(\)/)
  assert.match(emptyInputGuard, /const fallbackInput = workflowDefaultPrompt\(\)/)
  assert.match(emptyInputGuard, /workflowForm\.input = fallbackInput/)
  assert.doesNotMatch(emptyInputGuard, /请先输入设计需求或上传需求文档/)
  assert.match(appSource, /function createClientId\(/)
  assert.match(emptyInputGuard, /const analysisRequestId = createClientId\(\)/)
  assert.doesNotMatch(emptyInputGuard, /crypto\.randomUUID\(\)/)
})

test('workflow canvas keeps requirement slices below stages and leaves left rail for node tabs', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const headerSource = canvasSource.slice(
    canvasSource.indexOf('<header class="workflow-canvas-topbar">'),
    canvasSource.indexOf('<main class="workflow-canvas-shell"')
  )
  const asideSource = canvasSource.slice(
    canvasSource.indexOf('<aside class="workflow-canvas-tabs">'),
    canvasSource.indexOf('<section class="workflow-canvas-viewport">')
  )

  assert.match(headerSource, /v-if="shouldShowRequirementSlices"/)
  assert.match(headerSource, /class="workflow-total-slice-rail"/)
  assert.doesNotMatch(asideSource, /workflow-total-slice-rail/)
  assert.match(canvasSource, /const filterableRequirementSlices = computed\(\(\) =>/)
  assert.match(canvasSource, /const shouldShowRequirementSlices = computed\(\(\) =>[\s\S]*filterableRequirementSlices\.value\.length > 1/)
  assert.match(canvasSource, /function selectRequirementSlice/)
  assert.match(canvasSource, /'update-slice'/)
  assert.match(canvasSource, /emit\('update-slice', sliceId\)/)
  assert.match(appSource, /@update-slice="selectWorkflowSlice"/)
  assert.match(appSource, /function persistWorkflowActiveSlice\(sliceId\)/)
  assert.match(appSource, /function selectWorkflowSlice\(sliceId\)/)
  assert.match(appSource, /activeSliceId:\s*sliceId/)
  assert.doesNotMatch(styleSource, /grid-template-rows:\s*minmax\(140px, 24%\) minmax\(180px, 1fr\)/)
  assert.match(styleSource, /\.workflow-canvas-tabs\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)/)
  assert.match(styleSource, /\.workflow-total-slice-rail\s*\{[\s\S]*display:\s*flex/)
  assert.match(styleSource, /\.workflow-total-slice-rail\s*\{[\s\S]*overflow-x:\s*auto/)
})

test('workflow stage confirmation records the next stage and next action enters the progression flow', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const recordStart = appSource.indexOf('function recordWorkflowStageConfirmation')
  const recordEnd = appSource.indexOf('function patchWorkflowCanvasNodeArtifactStatus', recordStart)
  const recordSource = appSource.slice(recordStart, recordEnd)
  const runQuickStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const runQuickEnd = appSource.indexOf('function recordWorkflowStageConfirmation', runQuickStart)
  const runQuickSource = appSource.slice(runQuickStart, runQuickEnd)

  assert.match(recordSource, /const confirmedNextStageId = normalizeWorkflowStageId\(payload\.nextStageId \|\| ''\)/)
  assert.doesNotMatch(recordSource, /currentStage:\s*confirmedNextStageId \|\| currentTotalFlow\.currentStage \|\| stageId/)
  assert.doesNotMatch(recordSource, /workflowActiveStageId\.value = confirmedNextStageId/)
  assert.match(recordSource, /currentStage:\s*confirmedNextStageId \|\| stageId/)
  assert.match(
    runQuickSource,
    /if \(payload\.mode === 'stage-agent-confirm-next'\) \{[\s\S]*void confirmWorkflowStageWithAgentSummary\(payload\)[\s\S]*return/,
    'the next action should route through the shared stage progression flow'
  )
})

test('workflow stage confirmation refreshes only the confirmed next stage', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const runQuickStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const runQuickEnd = appSource.indexOf('function recordWorkflowStageConfirmation', runQuickStart)
  const runQuickSource = appSource.slice(runQuickStart, runQuickEnd)
  const summaryStart = appSource.indexOf('async function confirmWorkflowStageWithAgentSummary')
  const summaryEnd = appSource.indexOf('function recordWorkflowStageConfirmation', summaryStart)
  const summarySource = appSource.slice(summaryStart, summaryEnd)

  assert.match(runQuickSource, /void confirmWorkflowStageWithAgentSummary\(payload\)/)
  assert.match(summarySource, /const confirmedNextStageId = recordWorkflowStageConfirmation\(/)
  assert.match(summarySource, /selectWorkflowStageForPendingGeneration\(confirmedNextStageId,\s*\{\s*confirmedPreviousStageId:\s*currentStageId\s*\}\)/)
  assert.match(summarySource, /await regenerateWorkflowStage\(confirmedNextStageId\)/)
  assert.doesNotMatch(runQuickSource, /shouldAutoGenerateWorkflowStage\(confirmedNextStageId\)/)
})

test('workflow canvas only auto-generates placeholder stages after explicit stage confirmation', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const autoStart = appSource.indexOf('function scheduleWorkflowStageAutoGeneration')
  const autoEnd = appSource.indexOf('function persistWorkflowActiveSlice', autoStart)
  const autoSource = appSource.slice(autoStart, autoEnd)
  const openStart = appSource.indexOf('function openWorkflowCanvasRun')
  const openEnd = appSource.indexOf('function openDialogueSkillRecord', openStart)
  const openSource = appSource.slice(openStart, openEnd)
  const watcherArea = appSource.slice(appSource.indexOf('watch(() => activeWorkflowRun.value?.currentStepId'), appSource.indexOf('function matchSearchResult', appSource.indexOf('watch(() => activeWorkflowRun.value?.currentStepId')))

  assert.match(appSource, /const workflowStageAutoGenerationTimer = ref\(null\)/)
  assert.match(appSource, /function scheduleWorkflowStageAutoGeneration\(stageId = workflowCurrentStageId\.value\)/)
  assert.match(autoSource, /window\.clearTimeout\(workflowStageAutoGenerationTimer\.value\)/)
  assert.match(autoSource, /shouldAutoGenerateWorkflowStage\(stageId\)/)
  assert.match(autoSource, /void regenerateWorkflowStage\(stageId\)/)
  assert.doesNotMatch(watcherArea, /workflowCurrentStageId\.value, workflowAnalysisResult\.value\?\.analysisRunId/)
  assert.doesNotMatch(watcherArea, /scheduleWorkflowStageAutoGeneration\(stageId\)/)
  assert.doesNotMatch(openSource, /scheduleWorkflowStageAutoGeneration\(\)/)
})

test('frontend entry does not cache-bust source modules to avoid duplicate Vue runtimes', async () => {
  const indexSource = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8')
  const mainSource = await readFile(new URL('../frontend/src/main.js', import.meta.url), 'utf8')

  assert.match(indexSource, /\/src\/main\.js/)
  assert.doesNotMatch(indexSource, /\/src\/main\.js\?v=/)
  assert.match(mainSource, /AppShell\.vue'/)
  assert.doesNotMatch(mainSource, /AppShell\.vue\?v=/)
  assert.doesNotMatch(`${indexSource}\n${mainSource}`, /workflow-agent-stream-ui-v2/)
})

test('workflow analysis deep link is not reset back to entry by generic workflow route state', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const applyStart = appSource.indexOf('function applyRouteState')
  const applyEnd = appSource.indexOf('function switchView', applyStart)
  const applySource = appSource.slice(applyStart, applyEnd)
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)

  assert.match(applySource, /if \(key === 'workflow' && isWorkflowAnalysisRouteActive\(\)\)/)
  assert.match(appSource, /ensureWorkflowDeepLinkRouteState\(\)/)
  assert.doesNotMatch(applySource, /key !== 'workflow' && isWorkflowAnalysisRouteActive\(\)/)
  assert.match(hydrateSource, /const deepLinkWorkflowRun = workflowDeepLinkRunId/)
  assert.match(hydrateSource, /state\.activeWorkflowRun = deepLinkWorkflowRun/)
  assert.match(hydrateSource, /normalizeWorkflowAnalysisForDisplay\(deepLinkWorkflowRun\.documentAnalysis\)/)
  assert.match(hydrateSource, /workflowAnalysisResult\.value = displayAnalysis/)

  const openStart = appSource.indexOf('async function openWorkflowAnalysisRecord')
  const openEnd = appSource.indexOf('function adjustWorkflowCanvasZoom', openStart)
  const openSource = appSource.slice(openStart, openEnd)
  assert.match(openSource, /if \(!loaded && isWorkflowAnalysisRouteActive\(\)\)/)
  assert.match(openSource, /ensureWorkflowDeepLinkRouteState\(\)/)
  assert.match(openSource, /startWorkflowAnalysisDeepLinkPolling\(runId\)/)
})

test('workflow design route stays on entry while analysis canvases use run-specific deep links', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const applyStart = appSource.indexOf('function applyRouteState')
  const applyEnd = appSource.indexOf('function switchView', applyStart)
  const applySource = appSource.slice(applyStart, applyEnd)
  const restoreStart = appSource.indexOf('function restoreWorkflowRouteFromUrl')
  const restoreEnd = appSource.indexOf('function workflowCanvasRestoreCandidateRun', restoreStart)
  const restoreSource = appSource.slice(restoreStart, restoreEnd)
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('let persistedPendingRun = pendingRun', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.doesNotMatch(applySource, /restoreActiveWorkflowCanvasIfAvailable\(\)/)
  assert.doesNotMatch(restoreSource, /restoreActiveWorkflowCanvasIfAvailable\(\)/)
  assert.match(restoreSource, /workflowRoute\.value = 'entry'/)
  assert.match(restoreSource, /workflowCanvasLoading\.value = false/)
  assert.match(hydrateSource, /if \(hydratedProjectRoute\?\.route === '\/workflow' \|\| hydratedProjectRoute\?\.route === '\/design'\) return/)
  assert.doesNotMatch(hydrateSource, /await loadWorkflowRunDetail\(hydratedWorkflowRun\.id/)
  assert.doesNotMatch(analyzeSource, /syncWorkflowAnalysisRoute\(pendingRun\.id/)
  assert.match(analyzeSource, /openWorkflowAnalysisTab\(pendingRun\.id\)/)
  assert.doesNotMatch(analyzeSource, /workflowRoute\.value = 'canvas'/)
  assert.doesNotMatch(analyzeSource, /workflowCanvasLoading\.value = true/)
})

test('workflow design route skips stale analyzing runs when restoring a canvas', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const candidateStart = appSource.indexOf('function workflowCanvasRestoreCandidateRun')
  const candidateEnd = appSource.indexOf('function restoreActiveWorkflowCanvasIfAvailable', candidateStart)
  const candidateSource = appSource.slice(candidateStart, candidateEnd)

  assert.match(candidateSource, /run\.status !== 'analyzing'/)
  assert.match(candidateSource, /isWorkflowRunAnalysisFinal\(run\)/)
  assert.match(candidateSource, /run\.hasDocumentAnalysisDetail \|\| run\.documentAnalysisSummary\?\.hasCanvas/)
  assert.match(candidateSource, /sort\(\(a, b\) => new Date\(b\.updatedAt \|\| b\.createdAt \|\| 0\) - new Date\(a\.updatedAt \|\| a\.createdAt \|\| 0\)\)/)
})

test('workflow analysis carries entry input into runs and does not fake model-started copy before backend events', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const storeSource = await readFile(new URL('../backend/services/workspace-store.js', import.meta.url), 'utf8')
  const generationSource = await readFile(new URL('../backend/services/generation-runner.js', import.meta.url), 'utf8')
  const parserSource = await readFile(new URL('../backend/services/document-parser.js', import.meta.url), 'utf8')
  const settingsSource = await readFile(new URL('../frontend/src/pages/settings/SettingsPage.vue', import.meta.url), 'utf8')
  const loadingStart = appSource.indexOf('const workflowLoadingCanvas = computed')
  const loadingEnd = appSource.indexOf('const workflowCurrentStageId = computed', loadingStart)
  const loadingSource = appSource.slice(loadingStart, loadingEnd)
  const snapshotStart = appSource.indexOf('function workflowEntryPayloadSnapshot')
  const snapshotEnd = appSource.indexOf('function workflowDefaultPrompt', snapshotStart)
  const snapshotSource = appSource.slice(snapshotStart, snapshotEnd)
  const progressStart = appSource.indexOf('function buildWorkflowAnalysisProgressResult')
  const progressEnd = appSource.indexOf('function mergeWorkflowAnalysisStreamNode', progressStart)
  const progressSource = appSource.slice(progressStart, progressEnd)
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('const knowledgeContextDocuments = workflowKnowledgeContextDocuments(8, workflowEntrySnapshot.input, persistedPendingRun.projectId)', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(loadingSource, /正在提交需求/)
  assert.match(loadingSource, /等待后端接收/)
  assert.doesNotMatch(loadingSource, /正在连接后端模型服务/)
  assert.match(snapshotSource, /input:\s*String\(workflowForm\.input \|\| ''\)\.trim\(\)/)
  assert.match(progressSource, /input:\s*meta\.input \|\| run\.input \|\| workflowForm\.input \|\| ''/)
  assert.match(analyzeSource, /input:\s*workflowEntrySnapshot\.input \|\| '需求文档分析'/)
  assert.match(analyzeSource, /input:\s*workflowEntrySnapshot\.input/)
  assert.match(parserSource, /analysisRunId:\s*payload\.analysisRunId \|\| ''/)
  assert.match(generationSource, /const inputPreview = String\(context\.input \|\| context\.prompt \|\| ''\)\.trim\(\)\.slice\(0, 240\)/)
  assert.match(generationSource, /runId:\s*context\.analysisRunId \|\| context\.runId \|\| context\.requestId \|\| ''/)
  assert.match(storeSource, /inputPreview:\s*payload\.inputPreview \|\| ''/)
  assert.match(settingsSource, /inputPreview：\{\{ log\.inputPreview \}\}/)
})

test('workflow total-flow entry input is shown as the first stage user message and final analysis reply', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const generationSource = await readFile(new URL('../backend/services/generation-runner.js', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(appSource, /const WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID = 'requirement-dissection'/)
  assert.match(appSource, /function createWorkflowEntryUserMessage/)
  assert.doesNotMatch(appSource, /function createWorkflowEntryInitialAssistantMessage/)
  assert.match(appSource, /function createWorkflowAnalysisAssistantMessage/)
  assert.match(appSource, /function workflowModelReplyText/)
  assert.match(appSource, /function ensureWorkflowEntryMessageSession/)
  assert.match(appSource, /function ensureWorkflowPendingAnalysisMessageSession/)
  assert.doesNotMatch(appSource, /workflow-entry-initial-analysis/)
  assert.doesNotMatch(appSource, /收到，我先按/)
  assert.doesNotMatch(appSource, /createWorkflowEntryInitialAssistantMessage\(entryInput,\s*\{ runId: run\.id \}\)/)
  assert.match(generationSource, /rawContent:\s*modelResult\.content/)
  assert.match(appSource, /workflowModelReplyText\(analysis\)/)
  assert.doesNotMatch(analyzeSource, /run:\s*\{\s*id:\s*analysisRequestId/)
  assert.match(analyzeSource, /pendingRun\.agentSessions = ensureWorkflowImmediateAssistantMessageSession\(\{\s*input:\s*workflowEntrySnapshot\.input,\s*run:\s*pendingRun/)
  assert.match(appSource, /transient:\s*true/)
  assert.doesNotMatch(analyzeSource, /pendingRun\.agentSessions = ensureWorkflowPendingAnalysisMessageSession/)
  assert.match(appSource, /function upsertWorkflowAnalysisStreamAssistantMessage/)
  assert.match(analyzeSource, /nextRun\.agentSessions = ensureWorkflowAnalysisAssistantMessageSession\(\{\s*run:\s*nextRun,\s*analysis:\s*result\.data/)
  assert.match(analyzeSource, /persistedRun = mergeWorkflowAgentLocalSessionIntoRun\(persistedRun,\s*WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID\)/)
})

test('workflow analysis streams in background without mutating the source tab state', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(analyzeSource, /let backgroundAnalysisResult = buildWorkflowAnalysisProgressResult\(persistedPendingRun\)/)
  assert.match(analyzeSource, /const isViewingAnalysisRun = \(\) => currentWorkflowAnalysisDeepLinkRunId\(\) === persistedPendingRun\.id/)
  assert.match(analyzeSource, /persistWorkflowAnalysisBackgroundRun\(persistedPendingRun,\s*backgroundAnalysisResult/)
  assert.doesNotMatch(analyzeSource, /const isCurrentAnalysisRequest = \(\) => currentWorkflowAnalysisRequestId\.value === analysisRequestId/)
  assert.doesNotMatch(analyzeSource, /if \(isCurrentAnalysisRequest\(\)\) \{\s*state\.activeWorkflowRun = nextRun/)
})

test('base dropdown renders plain label without relying on slot fallback', async () => {
  const dropdownSource = await readFile(new URL('../frontend/src/components/base/BaseDropdown.vue', import.meta.url), 'utf8')

  assert.match(dropdownSource, /<slot v-if="\$slots\.trigger" name="trigger" \/>/)
  assert.match(dropdownSource, /<span v-else class="ui-dropdown__label">\{\{ label \}\}<\/span>/)
  assert.doesNotMatch(dropdownSource, /<slot name="trigger">\{\{ label \}\}<\/slot>/)
})

test('advanced UX stage-one canvas cards and detail prefer markdown-style tables', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(canvasSource, /requirementCanvasPreviewTable\(node\)/)
  assert.match(canvasSource, /class="requirement-canvas-card-table-preview"/)
  assert.match(canvasSource, /requirementPreviewTableHeaders\(requirementCanvasPreviewTable\(node\)\)/)
  assert.match(canvasSource, /requirementPreviewTableRows\(requirementCanvasPreviewTable\(node\)\)/)
  assert.match(canvasSource, /isAdvancedUxTablePreferredBlock\(block,\s*fullscreenNode\)/)
  assert.match(canvasSource, /function requirementMarkdownPreviewTable/)
  assert.match(canvasSource, /function requirementBlockPreviewTable/)
  assert.doesNotMatch(canvasSource, /<span v-for="item in requirementCanvasPreviewItems\(node\)"/)

  assert.match(styleSource, /\.requirement-canvas-card-table-preview/)
  assert.match(styleSource, /\.requirement-canvas-card-table-preview table/)
  assert.match(styleSource, /\.requirement-pipeline-block\.layout-advanced-ux-table/)
})

test('workflow canvas promotes stages and version history to topbar while hiding quality checks', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const topbarSource = canvasSource.slice(
    canvasSource.indexOf('<header class="workflow-canvas-topbar">'),
    canvasSource.indexOf('<main class="workflow-canvas-shell"')
  )
  const asideSource = canvasSource.slice(
    canvasSource.indexOf('<aside class="workflow-canvas-tabs">'),
    canvasSource.indexOf('<section ref="viewportRef"', canvasSource.indexOf('<aside class="workflow-canvas-tabs">'))
  )

  assert.match(topbarSource, /class="workflow-canvas-head-row"/)
  assert.match(topbarSource, /class="workflow-canvas-title-row"/)
  assert.match(topbarSource, /class="workflow-stage-strip"/)
  assert.match(canvasSource, /const totalFlowStages = computed/)
  assert.match(canvasSource, /DEFAULT_TOTAL_FLOW_STAGES/)
  assert.match(canvasSource, /const TOTAL_FLOW_STAGE_ORDER = \[/)
  assert.match(canvasSource, /const DEPRECATED_TOTAL_FLOW_STAGE_IDS = new Set/)
  assert.match(canvasSource, /'wireframe-preview'/)
  const deprecatedStageSource = canvasSource.slice(
    canvasSource.indexOf('const DEPRECATED_TOTAL_FLOW_STAGE_IDS = new Set'),
    canvasSource.indexOf('const AGENT_WORKBENCH_STAGE_IDS')
  )
  assert.match(deprecatedStageSource, /'requirement-slicing'/)
  assert.match(deprecatedStageSource, /'gap-confirmation'/)
  assert.match(canvasSource, /!DEPRECATED_TOTAL_FLOW_STAGE_IDS\.has\(stage\.id\)/)
  assert.match(canvasSource, /!DEPRECATED_TOTAL_FLOW_STAGE_NAMES\.has\(stage\.name\)/)
  assert.match(canvasSource, /isTotalFlowCanvas/)
  assert.match(canvasSource, /Array\.isArray\(props\.totalFlow\?\.stages\)/)
  assert.match(canvasSource, /需求分析/)
  assert.match(canvasSource, /验收沉淀/)
  assert.match(topbarSource, /class="workflow-version-menu"/)
  assert.match(topbarSource, /class="workflow-version-popover"/)
  assert.doesNotMatch(asideSource, /版本历史/)
  assert.doesNotMatch(asideSource, /质量检查/)
  assert.doesNotMatch(asideSource, /qualityGate\.checks/)
  assert.match(styleSource, /\.workflow-stage-strip/)
  assert.match(styleSource, /\.workflow-version-popover/)
})

test('total flow streams stage canvases and exposes pause/regenerate stage controls', async () => {
  const uploadSource = await readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(uploadSource, /type:\s*'workflow-stage-canvas'/)
  assert.match(uploadSource, /emitTotalDesignFlowStages/)
  assert.match(uploadSource, /stageStatusSnapshot/)
  assert.match(uploadSource, /emitSequentialTotalDesignFlowStages/)
  assert.match(uploadSource, /totalFlowMeta/)
  assert.match(uploadSource, /stagePayload/)
  assert.match(uploadSource, /status:\s*'generating'/)
  assert.match(uploadSource, /status:\s*'completed'/)
  assert.match(uploadSource, /POST \/api\/uploads\/documents\/analyze\/stage\/stream/)
  assert.match(uploadSource, /totalDesignFlow:\s*options\.includeFullFlow/)

  assert.match(appSource, /const workflowStageStatusMap = ref\(\{\}\)/)
  assert.match(appSource, /normalizeWorkflowTotalFlowMeta/)
  assert.match(appSource, /function mergeWorkflowStageCanvasEvent/)
  assert.match(appSource, /event\.data\?\.type === 'workflow-stage-canvas'/)
  assert.match(appSource, /function firstOpenWorkflowStageId/)
  assert.match(appSource, /workflowActiveStageId\.value = firstOpenWorkflowStageId\(totalFlow\)/)
  assert.match(appSource, /function pauseWorkflowStage/)
  assert.match(appSource, /function regenerateWorkflowStage/)
  assert.match(appSource, /function buildWorkflowStageVersion\(/)
  assert.match(appSource, /function buildWorkflowStageDiff\(/)
  assert.match(appSource, /stageNodeTitles/)
  assert.match(appSource, /stageNodeCount/)
  assert.match(appSource, /function appendWorkflowAnalysisVersion\(/)
  assert.match(appSource, /const workflowAnalysisStreamController = ref\(null\)/)
  assert.match(appSource, /new AbortController\(\)/)
  assert.match(appSource, /function applyWorkflowStageStatusesToAnalysis\(/)
  assert.match(appSource, /applyWorkflowStageStatusesToAnalysis\(nextStatuses\)/)
  assert.match(appSource, /persistWorkflowAnalysisProgressRun\(state\.activeWorkflowRun \|\| \{\}, \{ immediate:\s*true/)
  assert.match(appSource, /workflowAnalysisStreamController\.value = controller/)
  assert.match(appSource, /if \(workflowAnalysisStreamController\.value === controller\)/)
  assert.doesNotMatch(appSource, /@pause-stage="pauseWorkflowStage"/)
  assert.match(appSource, /@regenerate-stage="regenerateWorkflowStage"/)
  assert.match(appSource, /appendWorkflowAnalysisVersion\([^)]*stage-confirmation/)
  assert.match(appSource, /appendWorkflowAnalysisVersion\([^)]*stage-regenerate/)
  assert.match(appSource, /diff:\s*buildWorkflowStageDiff\(workflowAnalysisResult\.value, stageId\)/)

  assert.match(appSource, /:stage-statuses="workflowStageStatusMap"/)
  assert.match(canvasSource, /stageStatuses/)
  assert.match(canvasSource, /class="workflow-stage-step-index"/)
  assert.match(canvasSource, /class="workflow-stage-list"/)
  assert.doesNotMatch(canvasSource, /class="workflow-stage-state-label"/)
  assert.doesNotMatch(canvasSource, /class="workflow-stage-hover-label"/)
  assert.doesNotMatch(canvasSource, /stageStateLabel\(stage\.id\)/)
  assert.doesNotMatch(canvasSource, /v-if="stageStateLabel\(stage\.id\) && !canRegenerateStage\(stage\.id\)"/)
  assert.match(canvasSource, /stageConfirmation\(stageId\)/)
  assert.match(canvasSource, /下一阶段/)
  assert.doesNotMatch(canvasSource, /class="stage-agent-confirmation-card"/)
  assert.doesNotMatch(styleSource, /\.stage-agent-confirmation-card/)
  assert.doesNotMatch(canvasSource, /canRegenerateStage\(stage\.id\)/)
  assert.doesNotMatch(canvasSource, /@click\.stop="\$emit\('regenerate-stage', stage\.id\)"/)
  assert.doesNotMatch(canvasSource, /可查看/)
  assert.doesNotMatch(canvasSource, /已完成/)
  assert.match(canvasSource, /canOpenStage\(stage\.id\)/)
  assert.doesNotMatch(canvasSource, /canMoveToNextStage/)
  assert.doesNotMatch(canvasSource, /goNextStage\(/)
  assert.doesNotMatch(canvasSource, /advanceStageFromTopbar/)
  assert.match(canvasSource, /class="workflow-stage-next-button"/)
  assert.doesNotMatch(canvasSource, /pause-stage/)
  assert.match(canvasSource, /regenerate-stage/)
  assert.doesNotMatch(canvasSource, /LoaderCircle/)
  assert.doesNotMatch(canvasSource, /Pause/)
  assert.doesNotMatch(canvasSource, />暂停</)
  assert.doesNotMatch(canvasSource, /class="workflow-stage-main"[\s\S]*class="workflow-stage-inline-action"[\s\S]*<\/button>/)
  assert.doesNotMatch(canvasSource, /RefreshCw/)
  assert.doesNotMatch(canvasSource, /workflow-stage-regenerate/)
  assert.doesNotMatch(canvasSource, /stageStatus\(stage\.id\)/)
  assert.match(canvasSource, /hasNodeContent\(node\)/)
  assert.doesNotMatch(styleSource, /\.workflow-stage-status-icon\.spinning/)
  assert.match(styleSource, /\.workflow-stage-strip\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/)
  assert.match(styleSource, /\.workflow-stage-list\s*\{[\s\S]*overflow-x:\s*auto/)
  assert.doesNotMatch(styleSource, /\.workflow-stage-state-label/)
  assert.doesNotMatch(styleSource, /\.workflow-stage-hover-label/)
  assert.doesNotMatch(styleSource, /\.workflow-stage-chip:hover \.workflow-stage-hover-label/)
  assert.doesNotMatch(styleSource, /\.workflow-stage-regenerate/)
  assert.doesNotMatch(styleSource, /\.workflow-stage-inline-action\s*\{[\s\S]*position:\s*static/)
  assert.match(styleSource, /\.workflow-stage-main\s*\{[\s\S]*position:\s*relative/)
  assert.match(styleSource, /\.workflow-stage-next-button/)
  assert.match(styleSource, /\.workflow-canvas-transition-band/)
  assert.match(styleSource, /\.canvas-node-card\s*\{[\s\S]*transition:/)
})

test('total-flow side agent keeps messages in a stable stage scope', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const sessionSource = appSource.slice(
    appSource.indexOf('const workflowAgentSession = computed'),
    appSource.indexOf('const workflowArtifactStages = computed')
  )
  const scopeSource = appSource.slice(
    appSource.indexOf('function workflowAgentScopeId'),
    appSource.indexOf('function workflowAgentResolvedNodeId')
  )

  assert.match(sessionSource, /scopeId:\s*workflowAgentScopeId\(\)/)
  assert.match(appSource, /const workflowUsesStageAgentScope = computed\(\(\) =>[\s\S]*isWorkflowAgentWorkbenchStageId\(workflowCurrentStageId\.value\)/)
  assert.match(scopeSource, /if \(workflowUsesStageAgentScope\.value\)/)
  assert.match(scopeSource, /return workflowCurrentStageId\.value/)
  assert.match(scopeSource, /return workflowAgentNodeId\.value \|\| workflowAgentNode\.value\?\.id \|\| activeWorkflowStep\.value\?\.id \|\| ''/)
})

test('embedded agent stages do not show duplicate next button in the right side of the canvas', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const slotSource = appSource.slice(
    appSource.indexOf('<template #agent-workbench'),
    appSource.indexOf('</template>', appSource.indexOf('<template #agent-workbench'))
  )

  assert.match(slotSource, /workflow-stage-agent-workbench-anchor/)
  assert.doesNotMatch(slotSource, /<WorkflowAgentDrawer/)
  assert.doesNotMatch(slotSource, /class="workflow-embedded-agent-next"/)
  assert.doesNotMatch(styleSource, /\.workflow-embedded-agent-next/)
})

test('embedded agent quick actions align with the composer edge', async () => {
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const drawerStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer.agent-drawer-embedded'),
    styleSource.indexOf('.agent-drawer.agent-drawer-fullscreen', styleSource.indexOf('.agent-drawer.agent-drawer-embedded'))
  )
  const headStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-drawer-head'),
    styleSource.indexOf('.agent-drawer-embedded .agent-title-row', styleSource.indexOf('.agent-drawer-embedded .agent-drawer-head'))
  )
  const chatStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-chat-list'),
    styleSource.indexOf('.agent-drawer-embedded .agent-message', styleSource.indexOf('.agent-drawer-embedded .agent-chat-list'))
  )
  const interactionStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-interaction-panel'),
    styleSource.indexOf('.agent-drawer-embedded .agent-composer-box')
  )
  const composerStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-composer-shell'),
    styleSource.indexOf('.agent-drawer-embedded .agent-interaction-panel')
  )

  assert.match(drawerStyle, /--agent-inline-gutter:\s*clamp\(96px,\s*18vw,\s*280px\)/)
  assert.match(headStyle, /padding:\s*0 var\(--agent-inline-gutter\)/)
  assert.match(chatStyle, /padding:\s*16px var\(--agent-inline-gutter\) 36px/)
  assert.match(composerStyle, /padding:\s*12px var\(--agent-inline-gutter\) 18px/)
  assert.match(interactionStyle, /padding-left:\s*var\(--agent-inline-gutter\)/)
  assert.match(interactionStyle, /padding-right:\s*var\(--agent-inline-gutter\)/)
})

test('embedded agent workbench fills the canvas area and reuses upload menu on hover', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const workbenchViewportStyle = styleSource.slice(
    styleSource.indexOf('.workflow-canvas-shell.is-agent-workbench-stage .workflow-canvas-viewport'),
    styleSource.indexOf('.workflow-canvas-tabs', styleSource.indexOf('.workflow-canvas-shell.is-agent-workbench-stage .workflow-canvas-viewport'))
  )
  const uploadMenuTemplate = drawerSource.slice(
    drawerSource.indexOf('class="agent-upload-trigger"'),
    drawerSource.indexOf('<div v-if="visibleReferences.length"', drawerSource.indexOf('class="agent-upload-trigger"'))
  )

  assert.match(canvasSource, /class="workflow-stage-agent-workbench"/)
  assert.match(workbenchViewportStyle, /padding:\s*0/)
  assert.doesNotMatch(workbenchViewportStyle, /padding:\s*18px/)
  assert.match(styleSource, /\.agent-drawer\.agent-drawer-embedded\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/)
  assert.match(styleSource, /\.agent-drawer-embedded \.agent-drawer-head\s*\{[\s\S]*padding:\s*0 var\(--agent-inline-gutter\)/)
  assert.match(styleSource, /\.agent-drawer-embedded \.agent-title-row\s*\{[\s\S]*align-items:\s*center/)
  assert.match(styleSource, /\.agent-drawer-embedded \.agent-chat-list\s*\{[\s\S]*padding:\s*16px var\(--agent-inline-gutter\) 36px/)
  assert.match(drawerSource, /const agentUploadAccept = ref/)
  assert.match(drawerSource, /const agentUploadAcceptMap =/)
  assert.match(drawerSource, /triggerUpload\('all'\)/)
  assert.match(uploadMenuTemplate, /class="workflow-upload-popover agent-upload-popover"/)
  assert.match(uploadMenuTemplate, /上传文件/)
  assert.match(uploadMenuTemplate, /上传图片/)
  assert.match(uploadMenuTemplate, /上传 Word/)
  assert.match(uploadMenuTemplate, /上传 PDF/)
  assert.match(styleSource, /\.agent-upload-trigger:hover \.agent-upload-popover/)
})

test('embedded agent does not show fake canvas thinking text while waiting for analysis', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.doesNotMatch(appSource, /inlineText:\s*'正在思考'/)
  assert.doesNotMatch(appSource, /message:\s*message \|\| '正在思考'/)
  assert.doesNotMatch(drawerSource, /visibleCanvasStatusLine/)
  assert.doesNotMatch(drawerSource, /class="agent-inline-status"/)
  assert.doesNotMatch(drawerSource, /正在思考/)
  assert.doesNotMatch(drawerSource, /agent-canvas-status-card/)
  assert.doesNotMatch(drawerSource, /画布状态同步/)
  assert.doesNotMatch(drawerSource, /canvasStatusSteps/)
  assert.doesNotMatch(drawerSource, /正在同步画布状态/)
  assert.doesNotMatch(styleSource, /\.agent-inline-status/)
  assert.doesNotMatch(styleSource, /\.agent-canvas-status-card/)
  assert.doesNotMatch(styleSource, /\.agent-canvas-status-steps/)
})

test('agent reply actions render as icons with recommendations below each assistant reply', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const messageTemplate = drawerSource.slice(
    drawerSource.indexOf('v-for="(message, index) in visibleMessages"'),
    drawerSource.indexOf('</article>', drawerSource.indexOf('v-for="(message, index) in visibleMessages"'))
  )

  assert.match(drawerSource, /Copy/)
  assert.match(drawerSource, /RotateCcw/)
  assert.match(drawerSource, /class="agent-message-actions"/)
  assert.match(drawerSource, /class="agent-message-icon-action"/)
  assert.match(drawerSource, /<Copy/)
  assert.match(drawerSource, /<RotateCcw/)
  assert.match(drawerSource, /class="agent-message-recommendations"/)
  assert.match(drawerSource, /visibleMessageRecommendations\(message\)/)
  assert.match(drawerSource, /\$emit\('quick-reply', recommendation, message\)/)
  assert.doesNotMatch(drawerSource, /<section v-if="visibleQuickReplies\.length" class="agent-quick-row">/)
  assert.match(styleSource, /\.agent-message-icon-action/)
  assert.match(styleSource, /\.agent-message-recommendations/)
  assert.match(styleSource, /\.agent-message-recommendation-chip/)
})

test('structured agent messages render with Chinese labels instead of raw internal keys', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')

  assert.match(drawerSource, /status:\s*'状态'/)
  assert.match(drawerSource, /missing:\s*'缺失'/)
  assert.match(drawerSource, /drafted:\s*'已起草'/)
  assert.match(drawerSource, /passed:\s*'已通过'/)
  assert.match(drawerSource, /neededFor:\s*'判断依据'/)
  assert.match(drawerSource, /needed_for:\s*'判断依据'/)
  assert.match(drawerSource, /factInferenceSeparation:\s*'事实与推断分离'/)
  assert.match(drawerSource, /nonProjectDemandCompliance:\s*'非项目诉求处理'/)
  assert.match(drawerSource, /canvasContent:\s*'画布内容'/)
  assert.match(drawerSource, /canvas_content:\s*'画布内容'/)
  assert.match(drawerSource, /demandSummary:\s*'需求摘要'/)
  assert.match(drawerSource, /businessGoal:\s*'业务目标'/)
  assert.match(drawerSource, /ready:\s*'已就绪'/)
  assert.match(drawerSource, /function structuredAgentValueLabel/)
  assert.match(drawerSource, /function structuredAgentValueLabel\(key = '', value = ''\)/)
  assert.match(drawerSource, /structuredAgentValueLabel\(key,\s*item\)/)
})

test('agent drawer scroll, copy toast, busy meta and recommendation UX stay clean', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(drawerSource, /function scrollElementToBottom/)
  assert.match(drawerSource, /function scrollWindowToBottom/)
  assert.match(drawerSource, /requestAnimationFrame\(\(\) => \{[\s\S]*scrollWindowToBottom/)
  assert.match(drawerSource, /if \(isMessageBusy\(message\)\) return \[\]/)
  assert.match(drawerSource, /const defaultAssistantRecommendations = \['待确认的问题', '建议', '下一步'\]/)
  assert.match(drawerSource, /复制成功/)
  assert.match(styleSource, /\.agent-copy-toast/)
  assert.match(styleSource, /@keyframes agentCopyToastIn/)
  assert.match(styleSource, /animation:\s*agentCopyToastIn/)
})

test('backend tops up short model quick replies except requirement analysis model-owned replies', async () => {
  const runnerSource = await readFile(new URL('../backend/services/workflow-runner.js', import.meta.url), 'utf8')
  const persistSource = runnerSource.slice(
    runnerSource.indexOf('function persistRunAgentReply'),
    runnerSource.indexOf('function retrievedKnowledgeMeta')
  )

  assert.match(persistSource, /const modelQuickReplies = normalizeAgentQuickReplies\(feedback\.quickReplies\)/)
  assert.match(persistSource, /const fallbackQuickReplies = normalizeAgentQuickReplies\(buildWorkflowAgentQuickReplies/)
  assert.match(persistSource, /const mergedQuickReplies = \[\s*\.\.\.modelQuickReplies,\s*\.\.\.fallbackQuickReplies\s*\]/)
  assert.match(persistSource, /const quickReplies = isRequirementDissectionAgentScope\(input\.stepId, activeNode, input\.step\)\s*\?\s*normalizeRequirementDissectionQuickReplies\(modelQuickReplies, 6\)\s*:\s*normalizeAgentQuickReplies\(mergedQuickReplies\)/)
  assert.doesNotMatch(persistSource, /const quickReplies = modelQuickReplies\.length \? modelQuickReplies : fallbackQuickReplies/)
})

test('typing canvas confirmation in an agent stage advances to the next stage', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const sendStart = appSource.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appSource.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appSource.slice(sendStart, sendEnd)

  assert.match(appSource, /function isWorkflowStageAdvanceInput/)
  assert.match(appSource, /function confirmWorkflowStageFromAgentInput/)
  assert.match(appSource, /function nextWorkflowStageId/)
  assert.match(sendSource, /if \(!options\.skipStageAdvanceInputHandling && isWorkflowStageAdvanceInput\(content\) && confirmWorkflowStageFromAgentInput\(content, targetScopeId\)\) return/)
  assert.match(appSource, /selectWorkflowStageAndRefresh\(confirmedNextStageId, \{ force: true \}\)/)
})

test('low-fi quick replies advance total flow into the next stage instead of staying in chat', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const quickReplySource = appSource.slice(
    appSource.indexOf('function useWorkflowAgentQuickReply'),
    appSource.indexOf('function retryWorkflowAgentMessage')
  )
  const quickActionSource = appSource.slice(
    appSource.indexOf('function runWorkflowNodeQuickAction'),
    appSource.indexOf('function recordWorkflowStageConfirmation')
  )

  assert.match(appSource, /function isWorkflowLowFiStageAdvanceAction/)
  assert.match(quickReplySource, /isWorkflowLowFiStageAdvanceAction\(content\)/)
  assert.match(quickReplySource, /mode:\s*'stage-agent-confirm-next'/)
  assert.match(quickReplySource, /nextStageId:\s*nextStage\?\.id \|\| ''/)
  assert.doesNotMatch(quickReplySource, /if \(state\.activeWorkflowRun\?\.skillId === 'ux-design-confirmation-skill'\)[\s\S]{0,220}sendWorkflowAgentMessage\(mappedContent/)
  assert.match(quickActionSource, /isWorkflowLowFiStageAdvanceAction\(action\)/)
  assert.match(quickActionSource, /confirmWorkflowStageWithAgentSummary\(\{[\s\S]*nextStageId:\s*nextStage\?\.id \|\| ''/)
  assert.match(appSource, /async function confirmWorkflowStageWithAgentSummary[\s\S]*selectWorkflowStageForPendingGeneration\(confirmedNextStageId, \{ confirmedPreviousStageId: currentStageId \}\)/)
})

test('total flow streams one active stage at a time and renders available fields before model enhancement', async () => {
  const uploadSource = await readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const sequentialStart = uploadSource.indexOf('const emitSequentialTotalDesignFlowStages')
  const sequentialEnd = uploadSource.indexOf('const noneSkillLoadingCanvas', sequentialStart)
  const sequentialSource = uploadSource.slice(sequentialStart, sequentialEnd)
  const selectStart = appSource.indexOf('function selectWorkflowStage(stageId)')
  const selectEnd = appSource.indexOf('function shouldAutoGenerateWorkflowStage', selectStart)
  const selectSource = appSource.slice(selectStart, selectEnd)

  assert.match(sequentialSource, /const activeIndex = Math\.max\(0, stages\.findIndex/)
  assert.match(sequentialSource, /const activeStage = stages\[activeIndex\] \|\| stages\[0\]/)
  assert.match(sequentialSource, /stageStatusSnapshot\(stages, activeIndex, status\)/)
  assert.match(uploadSource, /status:\s*index === activeIndex \? activeStatus : index < activeIndex \? 'completed' : 'waiting'/)
  assert.match(uploadSource, /emitSequentialTotalDesignFlowStages\(push, progressResult\.totalDesignFlow/)
  assert.match(uploadSource, /emitSequentialTotalDesignFlowStages\(push, result\.totalDesignFlow/)
  assert.doesNotMatch(uploadSource, /emitTotalDesignFlowStages\(push, progressResult\.totalDesignFlow \|\| null, 'generating'\)/)
  assert.doesNotMatch(sequentialSource, /stages\.forEach/)
  assert.doesNotMatch(sequentialSource, /stageStatusSnapshot\(stages, index, status\)/)
  assert.doesNotMatch(selectSource, /scheduleWorkflowStageAutoGeneration\(stageId\)/)

  assert.match(canvasSource, /v-if="isNodeActuallyLoading\(node\)"/)
  assert.match(canvasSource, /function hasNodeContent\(node = \{\}\)/)
  assert.match(canvasSource, /function isNodeActuallyLoading\(node = \{\}\)/)
})

test('workflow canvas keeps board visible and docks the shared agent at the bottom for requirement dissection', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const workflowPageSource = await readFile(new URL('../frontend/src/pages/workflow/WorkflowPage.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const agentStageSource = canvasSource.slice(
    canvasSource.indexOf('const AGENT_WORKBENCH_STAGE_IDS = ['),
    canvasSource.indexOf('const AGENT_WORKBENCH_STAGE_NAMES')
  )

  assert.match(agentStageSource, /const AGENT_WORKBENCH_STAGE_IDS = \[/)
  assert.match(agentStageSource, /'requirement-dissection'/)
  assert.doesNotMatch(agentStageSource, /'requirement-slicing'/)
  assert.doesNotMatch(agentStageSource, /'gap-confirmation'/)
  assert.match(canvasSource, /showStageAgentWorkbench:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/)
  assert.match(
    canvasSource,
    /const shouldRenderAgentWorkbench = computed\(\(\) =>\s*props\.showStageAgentWorkbench &&[\s\S]*isRequirementDissectionStageId\(activeStageId\.value\)[\s\S]*forceAgentWorkbenchForActiveStage\.value \|\| isAgentWorkbenchStage\.value \|\| stageHasAgentWorkbenchNode\.value/,
    'shared embedded workbench code path should be hidden unless explicitly enabled'
  )
  assert.match(canvasSource, /const shouldRenderCanvasBoard = computed\(\(\) => true\)/)
  assert.match(canvasSource, /const shouldRenderCanvasTabs = computed\(\(\) => shouldRenderCanvasBoard\.value && !shouldRenderAgentWorkbench\.value\)/)
  assert.match(canvasSource, /<slot name="agent-workbench" :stage-id="activeStageId" :stage-label="activeStageLabel" :node="stageAgentNode" :next="confirmStageAndGoNext" \/>/)
  assert.match(canvasSource, /v-if="shouldRenderCanvasTabs" class="workflow-canvas-tabs"/)
  assert.match(canvasSource, /v-if="shouldRenderCanvasBoard" ref="viewportRef" class="workflow-canvas-scrollarea"/)
  assert.match(canvasSource, /v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls"/)
  assert.match(canvasSource, /const shouldShowRequirementSlices = computed\(\(\) =>[\s\S]*filterableRequirementSlices\.value\.length > 1/)
  assert.doesNotMatch(canvasSource, /function sendStageAgentPrompt/)
  assert.doesNotMatch(canvasSource, /function handleStageAgentComposerAction/)
  assert.doesNotMatch(canvasSource, /stageAgentConversationItems/)
  assert.doesNotMatch(canvasSource, /stage-agent-doubao/)
  assert.doesNotMatch(canvasSource, /stage-agent-message/)
  assert.doesNotMatch(canvasSource, /agentSessions/)

  assert.match(workflowPageSource, /<template #agent-workbench="slotProps">/)
  assert.match(workflowPageSource, /<slot name="agent-workbench" v-bind="slotProps" \/>/)

  assert.match(appSource, /const workflowUsesStageAgentScope = computed\(\(\) =>/)
  assert.match(appSource, /isWorkflowAgentWorkbenchStageId\(workflowCurrentStageId\.value\)/)
  assert.match(appSource, /activeView\.value === 'workflow'/)
  assert.match(appSource, /workflowRoute\.value === 'canvas'/)
  assert.match(appSource, /const workflowUsesEmbeddedAgent = computed\(\(\) => false\)/)
  assert.match(appSource, /<template #agent-workbench>/)
  assert.match(appSource, /class="workflow-stage-agent-workbench-anchor"/)
  assert.match(appSource, /<WorkflowAgentDrawer[\s\S]*:embedded="workflowAgentDisplayMode === 'inline'"[\s\S]*@send="sendWorkflowAgentMessage"/)
  assert.match(appSource, /v-if="workflowAgentShellVisible"/)
  assert.match(appSource, /@close="setWorkflowAgentDisplayMode\('hidden'\)"/)
  assert.match(appSource, /function showWorkflowAgentInline\(\) \{\s*setWorkflowAgentDisplayMode\('sidebar'\)\s*\}/)
  assert.doesNotMatch(appSource, /workflowAgentOpen\.value = true/)
  assert.match(appSource, /workflowAgentDrawerRef\.value\?\.focusComposer\?\.\(\)/)
  assert.doesNotMatch(appSource, /class="workflow-embedded-agent-next"/)
  const openAgentSource = appSource.slice(
    appSource.indexOf('function openWorkflowAgent()'),
    appSource.indexOf('function toggleWorkflowAgentHistory()', appSource.indexOf('function openWorkflowAgent()'))
  )
  assert.match(openAgentSource, /if \(workflowDefaultAgentDisplayMode\(\) === 'inline'\)/)
  assert.match(openAgentSource, /workflowAgentDrawerRef\.value\?\.focusComposer\?\.\(\)/)
  assert.match(openAgentSource, /showWorkflowAgentSidebar\(\)/)

  assert.match(drawerSource, /embedded: \{ type: Boolean, default: false \}/)
  assert.match(drawerSource, /class="agent-drawer"/)
  assert.match(drawerSource, /'agent-drawer-embedded': resolvedDisplayMode\.value === 'inline'/)
  assert.match(drawerSource, /v-if="resolvedDisplayMode === 'sidebar'" class="agent-resize-handle"/)
  assert.match(drawerSource, /v-if="resolvedDisplayMode !== 'inline'" class="agent-collapse-icon"/)
  assert.match(drawerSource, /function handlePrimaryAction\(\)/)
  assert.match(drawerSource, /emit\('stop-generating'\)/)
  assert.match(drawerSource, /emit\('send'\)/)

  assert.match(styleSource, /\.workflow-canvas-shell\.is-agent-workbench-stage\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(styleSource, /\.workflow-stage-agent-workbench\s*\{[\s\S]*position:\s*fixed/)
  assert.match(styleSource, /\.agent-drawer\.agent-drawer-embedded\s*\{[\s\S]*position:\s*fixed/)
  assert.match(styleSource, /\.agent-drawer-embedded \.agent-composer-box\s*\{[\s\S]*border:\s*1px solid #b8d2ff/)
  assert.doesNotMatch(styleSource, /\.workflow-embedded-agent-next/)
  assert.doesNotMatch(styleSource, /\.stage-agent-doubao-shell/)
})

test('agent workbench keeps pre-analysis stages and avoids fixed quick-reply fallbacks', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const workbenchSource = await readFile(new URL('../frontend/src/services/workflowWorkbench.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(canvasSource, /const visibleTotalFlowStages = computed/)
  assert.match(canvasSource, /function isHiddenAgentPreparationStage/)
  assert.match(canvasSource, /DEPRECATED_TOTAL_FLOW_STAGE_IDS/)
  const deprecatedStageSource = canvasSource.slice(
    canvasSource.indexOf('const DEPRECATED_TOTAL_FLOW_STAGE_IDS = new Set'),
    canvasSource.indexOf('const AGENT_WORKBENCH_STAGE_IDS')
  )
  assert.match(deprecatedStageSource, /'requirement-slicing'/)
  assert.match(deprecatedStageSource, /'gap-confirmation'/)
  assert.match(canvasSource, /v-for="\(\s*stage,\s*stageIndex\s*\) in visibleTotalFlowStages"/)
  assert.doesNotMatch(workbenchSource, /: \['使用示例生成', '补充资料', '生成本步草稿', '无疑问，跳过'\]/)
  assert.match(workbenchSource, /quickReplies: run\.agentQuickReplies\?\.\[scopeId\]\?\.length/)
  assert.match(appSource, /function normalizeWorkflowAgentQuickReplies\(replies = \[\]\)/)
  assert.match(appSource, /workflowAgentSession\.value\?\.quickReplies \|\| \[\]/)
})

test('total flow docs do not reference removed legacy stage names', async () => {
  const planSource = await readFile(new URL('../docs/superpowers/plans/2026-06-28-total-design-flow-workbench.md', import.meta.url), 'utf8')
  const specSource = await readFile(new URL('../docs/superpowers/specs/2026-06-28-total-design-flow-workbench-design.md', import.meta.url), 'utf8')
  const docsSource = `${planSource}\n${specSource}`

  assert.doesNotMatch(docsSource, /wireframe-preview/)
  assert.doesNotMatch(docsSource, /低保预览/)
  assert.doesNotMatch(docsSource, /html-vue/)
  assert.doesNotMatch(docsSource, /HTML \/ Vue/)
  assert.doesNotMatch(docsSource, /wireframes/)
  ;['需求分析', '交互低保', 'UI视觉', 'HTML', 'Vue', '验收沉淀'].forEach((stageName) => {
    assert.match(docsSource, new RegExp(stageName))
  })
})

test('total flow spec acceptance checklist records implemented first-version scope', async () => {
  const specSource = await readFile(new URL('../docs/superpowers/specs/2026-06-28-total-design-flow-workbench-design.md', import.meta.url), 'utf8')
  const checklistSource = specSource.slice(specSource.indexOf('## 验收清单'))
  const checkedItems = [...checklistSource.matchAll(/^- \[x\] /gm)]

  assert.equal(checkedItems.length, 10)
  assert.doesNotMatch(checklistSource, /^- \[ \] /m)
  ;[
    '设计方案入口默认进入总流程',
    '上传完整产品文档后，系统先拆小需求',
    'Podcastor 文档不会被识别成认证弹窗',
    '茶饮小程序能生成单一小需求和 9 个页面节点',
    '左侧展示小需求切片',
    '底部展示当前小需求下的页面节点导航',
    '交互低保页面节点包含页面目标、核心模块、动作、跳转、状态、接口、验收点',
    '右侧 Agent 能拿到当前阶段、当前小需求和当前节点上下文',
    '转阶段或重新生成会保存版本',
    '小 Skill 不再作为主流程心智出现'
  ].forEach((item) => {
    assert.match(checklistSource, new RegExp(`- \\[x\\] ${item}`))
  })
})

test('total-flow agent stages keep the unified canvas visible while docking the agent workbench', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const forceStart = canvasSource.indexOf('const forceAgentWorkbenchForActiveStage = computed')
  const forceEnd = canvasSource.indexOf('const shouldRenderCanvasBoard = computed', forceStart)
  const forceSource = canvasSource.slice(forceStart, forceEnd)

  assert.match(forceSource, /isTotalFlowCanvas\.value/)
  assert.match(forceSource, /isAgentWorkbenchStageId\(activeStageId\.value\)/)
  assert.match(forceSource, /props\.showStageAgentWorkbench &&[\s\S]*forceAgentWorkbenchForActiveStage\.value \|\| isAgentWorkbenchStage\.value \|\| stageHasAgentWorkbenchNode\.value/)
  assert.match(canvasSource, /if \(!shouldRenderAgentWorkbench\.value\) return activeSliceStageCanvasNodes\.value/)
  assert.match(canvasSource, /return agentNode \? \[agentNode\] : \[\]/)
  assert.match(canvasSource, /const shouldRenderCanvasBoard = computed\(\(\) => true\)/)
  assert.match(canvasSource, /const shouldRenderCanvasTabs = computed\(\(\) => shouldRenderCanvasBoard\.value && !shouldRenderAgentWorkbench\.value\)/)
})

test('workflow stage stream does not force active stage away after user selected another loaded stage', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const mergeStart = appSource.indexOf('function mergeWorkflowStageCanvasEvent')
  const mergeEnd = appSource.indexOf('function mergeWorkflowAnalysisStreamError', mergeStart)
  const mergeSource = appSource.slice(mergeStart, mergeEnd)
  const syncStart = appSource.indexOf('function syncWorkflowActiveStageFromAnalysis')
  const syncEnd = appSource.indexOf('function pauseWorkflowStage', syncStart)
  const syncSource = appSource.slice(syncStart, syncEnd)

  assert.match(appSource, /const workflowActiveStageTouchedByUser = ref\(false\)/)
  assert.match(mergeSource, /if \(!workflowActiveStageId\.value\) workflowActiveStageId\.value = stageId/)
  assert.doesNotMatch(mergeSource, /currentStage:\s*stageId \|\|/)
  assert.match(syncSource, /if \(!workflowActiveStageTouchedByUser\.value\)/)
  assert.match(appSource, /workflowActiveStageTouchedByUser\.value = true/)
})

test('workflow stage statuses clear streaming generating state after final analysis', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf("if (event.data?.type === 'workflow-analysis' && event.data?.canvas)")
  const streamEnd = appSource.indexOf('workflowCanvasLoading.value = false', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const syncStart = appSource.indexOf('function syncWorkflowActiveStageFromAnalysis')
  const syncEnd = appSource.indexOf('function pauseWorkflowStage', syncStart)
  const syncSource = appSource.slice(syncStart, syncEnd)
  const syncDefaultIndex = syncSource.indexOf("...buildWorkflowStageStatuses(totalFlow, 'waiting')")
  const syncInferredIndex = syncSource.indexOf("...inferredWorkflowStageStatuses(totalFlow, 'waiting')")
  const syncPersistedIndex = syncSource.indexOf('...totalFlow.stageStatuses')
  const syncLocalIndex = syncSource.indexOf('workflowStageStatusMap.value')

  assert.match(appSource, /function finalWorkflowStageStatuses/)
  assert.match(appSource, /function persistedWorkflowStageStatuses/)
  assert.match(appSource, /if \(status !== 'generating'\) return \[stageId, stageStatus\]/)
  assert.match(appSource, /workflowStageCanvasHasGeneratedContent\(totalFlow\?\.stageCanvases\?\.\[stageId\], stageId\) \? 'completed' : 'waiting'/)
  assert.match(streamSource, /workflowStageStatusMap\.value = finalWorkflowStageStatuses\(workflowAnalysisResult\.value\?\.totalDesignFlow\)/)
  assert.doesNotMatch(streamSource, /\.\.\.workflowStageStatusMap\.value/)
  assert.equal(syncDefaultIndex, -1)
  assert.ok(syncInferredIndex >= 0)
  assert.equal(syncPersistedIndex, -1)
  assert.ok(syncLocalIndex >= 0)
  assert.match(appSource, /function applyWorkflowStageStatusesToAnalysis/)
})

test('workflow stage status sync keeps future stages waiting until the user advances', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const initialStatusStart = appSource.indexOf('function buildWorkflowStageStatuses')
  const initialStatusEnd = appSource.indexOf('function isWorkflowAgentWorkbenchStageId', initialStatusStart)
  const initialStatusSource = appSource.slice(initialStatusStart, initialStatusEnd)
  const streamStart = appSource.indexOf("if (event.data?.type === 'workflow-analysis' && event.data?.canvas)")
  const streamEnd = appSource.indexOf('workflowCanvasLoading.value = false', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const syncStart = appSource.indexOf('function syncWorkflowActiveStageFromAnalysis')
  const syncEnd = appSource.indexOf('function pauseWorkflowStage', syncStart)
  const syncSource = appSource.slice(syncStart, syncEnd)

  assert.match(initialStatusSource, /status:\s*fallbackStatus/)
  assert.doesNotMatch(initialStatusSource, /index === 0 && fallbackStatus === 'waiting' \? 'generating' : fallbackStatus/)
  assert.match(streamSource, /finalWorkflowStageStatuses\(workflowAnalysisResult\.value\?\.totalDesignFlow\)/)
  assert.doesNotMatch(syncSource, /buildWorkflowStageStatuses\(totalFlow,\s*'completed'\)/)
  assert.match(syncSource, /inferredWorkflowStageStatuses\(totalFlow,\s*'waiting'\)/)
  assert.match(syncSource, /persistedWorkflowStageStatuses\(\{ \.\.\.totalFlow, stageStatuses: workflowStageStatusMap\.value \}, \{ keepGenerating: workflowCanvasLoading\.value \}\)/)
})

test('workflow final stage statuses infer completed stages from persisted model canvas', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const initialStatusStart = appSource.indexOf('function buildWorkflowStageStatuses')
  const initialStatusEnd = appSource.indexOf('function isWorkflowAgentWorkbenchStageId', initialStatusStart)
  const initialStatusSource = appSource.slice(initialStatusStart, initialStatusEnd)
  const syncStart = appSource.indexOf('function syncWorkflowActiveStageFromAnalysis')
  const syncEnd = appSource.indexOf('function pauseWorkflowStage', syncStart)
  const syncSource = appSource.slice(syncStart, syncEnd)

  assert.match(initialStatusSource, /function workflowStageCanvasHasGeneratedContent/)
  assert.match(initialStatusSource, /function inferredWorkflowStageStatuses/)
  assert.match(initialStatusSource, /finalWorkflowStageStatuses\(totalFlow = null\)[\s\S]*inferredWorkflowStageStatuses\(totalFlow,\s*'waiting'\)/)
  assert.doesNotMatch(initialStatusSource, /index === 0 && fallbackStatus === 'waiting' \? 'generating' : fallbackStatus/)
  assert.match(initialStatusSource, /contentStatus === 'model-pending'/)
  assert.match(syncSource, /inferredWorkflowStageStatuses\(totalFlow,\s*'waiting'\)/)
})

test('workflow canvas title is capped at 16 characters while keeping the full title as tooltip', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(canvasSource, /const CANVAS_TITLE_MAX_LENGTH = 16/)
  assert.match(canvasSource, /const fullCanvasTitle = computed/)
  assert.match(canvasSource, /const displayCanvasTitle = computed/)
  assert.match(canvasSource, /fullCanvasTitle\.value\.slice\(0, CANVAS_TITLE_MAX_LENGTH\)/)
  assert.match(canvasSource, /<strong class="workflow-canvas-title" :title="fullCanvasTitle">\{\{ displayCanvasTitle \}\}<\/strong>/)
  assert.match(styleSource, /\.workflow-canvas-title\s*\{[\s\S]*white-space:\s*nowrap/)
})

test('workflow total-flow stages render all entries and disable unreached stages', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const visibleStart = canvasSource.indexOf('const visibleTotalFlowStages = computed')
  const visibleEnd = canvasSource.indexOf('const nextWorkflowStage', visibleStart)
  const visibleSource = canvasSource.slice(visibleStart, visibleEnd)
  const canOpenStart = canvasSource.indexOf('function canOpenStage')
  const canOpenEnd = canvasSource.indexOf('function goNextStage', canOpenStart)
  const canOpenSource = canvasSource.slice(canOpenStart, canOpenEnd)

  assert.match(visibleSource, /totalFlowStages\.value\.filter\(\(stage\) => !isHiddenAgentPreparationStage\(stage\.id\)\)/)
  assert.doesNotMatch(visibleSource, /index <= activeStageIndex\.value/)
  assert.match(canOpenSource, /if \(index <= 0\) return true/)
  assert.match(canOpenSource, /if \(stageId === activeStageId\.value\) return true/)
  assert.match(canOpenSource, /const runtime = stageRuntime\(stageId\)/)
  assert.match(canOpenSource, /if \(runtime && typeof runtime\.canOpen === 'boolean'\) return runtime\.canOpen === true/)
  assert.match(canOpenSource, /index < activeStageIndex\.value/)
  assert.match(canOpenSource, /if \(stageConfirmation\(stageId\)\) return true/)
  assert.match(canOpenSource, /const previousStageId = previousStageIdForCanvasStage\(stageId\)/)
  assert.match(canOpenSource, /if \(previousStageId && stageConfirmation\(previousStageId\)\) return true/)
  assert.match(canOpenSource, /loadedStageIds\.value\.has\(stageId\)/)
  assert.match(canOpenSource, /return false/)
  assert.match(canvasSource, /function stageCanvasHasRenderedContent\(stageId = ''\)/)
  assert.match(canvasSource, /contentStatus !== 'model-pending'/)
})

test('workflow canvas zoom controls live at the bottom-left of the viewport without borders', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const topbarSource = canvasSource.slice(
    canvasSource.indexOf('<header class="workflow-canvas-topbar">'),
    canvasSource.indexOf('<main class="workflow-canvas-shell"')
  )
  const viewportStart = canvasSource.indexOf('<section class="workflow-canvas-viewport">')
  const viewportSource = canvasSource.slice(viewportStart, canvasSource.indexOf('</main>', viewportStart))

  assert.doesNotMatch(topbarSource, /\$emit\('zoom'/)
  assert.match(viewportSource, /class="workflow-canvas-zoom-controls"/)
  assert.match(viewportSource, /\$emit\('zoom', -0\.1\)/)
  assert.match(viewportSource, /\$emit\('zoom', 0\.1\)/)
  assert.match(styleSource, /\.workflow-canvas-zoom-controls\s*\{[\s\S]*bottom:\s*16px/)
  assert.match(styleSource, /\.workflow-canvas-zoom-controls \.ui-button\s*\{[\s\S]*border:\s*0/)
  assert.match(styleSource, /\.workflow-canvas-viewport\s*\{[\s\S]*overflow:\s*hidden/)
  assert.match(styleSource, /\.workflow-canvas-scrollarea\s*\{[\s\S]*overflow:\s*auto/)
  assert.match(styleSource, /\.workflow-canvas-zoom-controls\s*\{[\s\S]*position:\s*absolute/)
  assert.match(styleSource, /\.workflow-page-node-nav\s*\{[\s\S]*padding-left:\s*220px/)
})

test('workflow page node chips resolve real canvas node ids before focusing', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const tabStart = canvasSource.indexOf('const activeCanvasTabId = computed')
  const tabEnd = canvasSource.indexOf('const requirementSlices', tabStart)
  const tabSource = canvasSource.slice(tabStart, tabEnd)

  assert.match(canvasSource, /function focusPageNode\(page = \{\}\)/)
  assert.match(canvasSource, /function resolvePageNodeId\(page = \{\}\)/)
  assert.match(canvasSource, /nodesByTitle/)
  assert.match(canvasSource, /emit\('focus-node', resolvedNodeId\)/)
  assert.match(canvasSource, /nextTick\(\(\) => focusNode\(resolvedNodeId\)\)/)
  assert.match(canvasSource, /<BaseTabs v-model="activeCanvasTabId" :items="canvasTabItems"/)
  assert.match(tabSource, /set: \(value\) => \{[\s\S]*emit\('focus-node', value\)/)
  assert.match(canvasSource, /const canvasTabItems = computed/)
  assert.match(canvasSource, /activeSliceStageCanvasNodes\.value\.map\(\(node\) => \(\{ key: node\.id, label: node\.title \|\| node\.id \}\)\)/)
})

test('total flow analysis keeps the total flow run identity after backend auto routing', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(analyzeSource, /const isTotalDesignFlowRun = isTotalFlowLikeWorkflowId\(workflowForm\.selectedWorkflowId\)/)
  assert.match(analyzeSource, /const resolvedWorkflowId = isTotalDesignFlowRun\s*\?\s*workflowForm\.selectedWorkflowId\s*:/)
  assert.match(analyzeSource, /workflowId: isTotalDesignFlowRun \? workflowForm\.selectedWorkflowId : workflow\.id/)
  assert.match(analyzeSource, /workflowName: isTotalDesignFlowRun \? workflowSelectedSkillLabel\.value : workflow\.name/)
  assert.match(analyzeSource, /displaySkillName: isTotalDesignFlowRun\s*\?\s*workflowSelectedSkillLabel\.value\s*:/)
  assert.match(analyzeSource, /skillId: isTotalDesignFlowRun \? workflowForm\.selectedWorkflowId : resolvedWorkflowId/)
})

test('workflow primary analysis persists background progress without switching the source tab', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)
  const saveIndex = analyzeSource.indexOf('api.workspace.createWorkflowRun(state.apiConfig, pendingRun)')
  const openTabIndex = analyzeSource.indexOf('openWorkflowAnalysisTab(pendingRun.id)')

  assert.ok(saveIndex > 0, 'primary analysis should still persist the pending run')
  assert.ok(openTabIndex > 0, 'primary analysis should open a dedicated analysis tab')
  assert.ok(openTabIndex < saveIndex, 'analysis tab should open before waiting for backend save')
  assert.match(analyzeSource, /openWorkflowAnalysisTab\(pendingRun\.id\)/)
  assert.match(analyzeSource, /persistWorkflowAnalysisBackgroundRun\(persistedPendingRun,\s*backgroundAnalysisResult/)
  assert.doesNotMatch(analyzeSource, /syncWorkflowAnalysisRoute\(pendingRun\.id\)/)
  assert.doesNotMatch(analyzeSource, /workflowRoute\.value = 'canvas'/)
  assert.doesNotMatch(analyzeSource, /workflowCanvasLoading\.value = true/)
})

test('workflow entry defaults to advanced UX instead of legacy skill selection', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /selectedWorkflowId:\s*'advanced-ux-requirement-analysis'/)
  assert.match(appSource, /value:\s*'advanced-ux-requirement-analysis',\s*label:\s*'高级 UX 需求分析'/)
  assert.match(appSource, /需求分析/)
  assert.doesNotMatch(appSource, /selectedWorkflowId:\s*'ux-design-confirmation-skill'/)
})

test('workflow entry examples use demand prompts through the advanced UX default presets', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /const workflowPromptExamplePresets = \{/)
  assert.match(appSource, /茶饮小程序/)
  assert.match(appSource, /workflowPromptExamplePresets\[workflowForm\.selectedWorkflowId\]/)
  assert.match(appSource, /workflowPromptExamplePresets\.default/)
  assert.doesNotMatch(appSource, /'interaction-design-workflow':/)
  assert.doesNotMatch(appSource, /'competitor-monitor-skill':/)
  assert.doesNotMatch(appSource, /商品套图 Agent/)
  assert.doesNotMatch(appSource, /视频生成 Agent/)
})

test('workflow canvas topbar shows current skill name instead of white canvas placeholder', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')

  assert.match(appSource, /const workflowCanvasSkillLabel = computed/)
  assert.match(appSource, /activeWorkflowRun\.value\?\.displaySkillName/)
  assert.match(appSource, /:skill-label="workflowCanvasSkillLabel"/)
  assert.match(canvasSource, /skillLabel:\s*\{\s*type:\s*String,\s*default:\s*''\s*\}/)
  assert.match(canvasSource, /parsedCount.*skillLabel/)
  assert.doesNotMatch(canvasSource, /白色画布/)
})

test('workflow canvas renders multiple total flow slices below stages and page nodes at the bottom', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const pageSource = await readFile(new URL('../frontend/src/pages/workflow/WorkflowPage.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /:total-flow="workflowStageTotalDesignFlow"/)
  assert.match(appSource, /const workflowTotalDesignFlow = computed/)
  assert.match(pageSource, /<WorkflowCanvasPage v-bind="\$attrs" :total-flow="totalFlow">/)
  assert.match(pageSource, /<template #agent-workbench="slotProps">/)
  assert.match(pageSource, /<slot name="agent-workbench" v-bind="slotProps" \/>/)
  assert.match(pageSource, /<\/WorkflowCanvasPage>/)
  assert.match(canvasSource, /totalFlow:\s*\{\s*type:\s*Object/)
  assert.match(canvasSource, /class="workflow-total-slice-rail"/)
  assert.match(canvasSource, /shouldShowRequirementSlices/)
  assert.match(canvasSource, /requirementSlices/)
  assert.match(canvasSource, /<BaseTabs v-model="activeCanvasTabId" :items="canvasTabItems"/)
  assert.match(canvasSource, /const canvasTabItems = computed/)
  assert.match(canvasSource, /pageNodesForActiveSlice/)
  assert.match(canvasSource, /focus-node/)
  assert.match(styleSource, /\.workflow-total-slice-rail/)
  assert.match(styleSource, /\.workflow-canvas-tabs/)
})

test('workflow canvas keeps one unified total-flow canvas and uses stages only for focus', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const workspaceRouteSource = await readFile(new URL('../backend/routes/workspace.js', import.meta.url), 'utf8')

  assert.match(appSource, /const workflowActiveStageId = ref\(''\)/)
  assert.match(appSource, /function selectWorkflowStage\(stageId, options = \{\}\)/)
  assert.match(appSource, /function persistWorkflowCurrentStage\(stageId\)/)
  assert.match(appSource, /persistWorkflowCurrentStage\(stageId\)/)
  assert.match(appSource, /currentStage:\s*stageId/)
  assert.match(appSource, /documentAnalysis:\s*workflowAnalysisResult\.value/)
  assert.match(appSource, /function syncWorkflowActiveStageFromAnalysis\(analysis = null\)/)
  assert.match(appSource, /@update-stage="selectWorkflowStage"/)
  assert.match(appSource, /function workflowUnifiedTotalFlowCanvas\(totalFlow = null\)/)
  assert.match(appSource, /workflowUnifiedTotalFlowCanvas\(workflowTotalDesignFlow\.value\)/)
  assert.doesNotMatch(appSource, /const stageAwareCanvas = workflowTotalDesignFlow\.value[\s\S]{0,180}workflowStageCanvas\.value/)
  assert.match(appSource, /workflowStageTotalDesignFlow/)
  assert.match(appSource, /stageSlices\?\.\[workflowCurrentStageId\.value\]/)
  assert.match(appSource, /stagePages\?\.\[workflowCurrentStageId\.value\]/)
  assert.match(appSource, /const persistedSliceId = normalizedTotalFlow\.activeSliceId/)
  assert.match(appSource, /stageSlices\.some\(\(slice\) => slice\.id === persistedSliceId\) \? persistedSliceId : stageSlices\[0\]\?\.id \|\| ''/)
  assert.match(appSource, /normalizeWorkflowTotalFlowMeta\(meta\.totalDesignFlow \|\| meta\.totalFlowMeta\) \|\| run\.documentAnalysis\?\.totalDesignFlow \|\| null/)
  assert.match(workspaceRouteSource, /import \{[\s\S]*buildTotalDesignFlow[\s\S]*\} from '\.\.\/services\/total-design-flow\.js'/)
  assert.match(workspaceRouteSource, /function hydrateWorkflowRunDetail\(store, run = \{\}, options = \{\}\)/)
  assert.match(workspaceRouteSource, /needsTotalDesignFlowHydration\(run\)/)
  assert.match(workspaceRouteSource, /const sourceAnalysis = shouldHydrate[\s\S]{0,260}analysisForTotalFlowHydration\(run\.documentAnalysis, previousTotalFlow, run\)/)
  assert.match(workspaceRouteSource, /normalizeTotalFlowHydrationAnalysisIdentity\(run\.documentAnalysis, previousTotalFlow, run\)/)
  assert.match(workspaceRouteSource, /buildTotalDesignFlow\(sourceAnalysis\)/)
  assert.match(workspaceRouteSource, /'GET \/api\/workspace\/workflow-runs\/:id'[\s\S]*hydrateWorkflowRunDetail\(store, run, options\)/)
  assert.match(appSource, /syncWorkflowActiveStageFromAnalysis\(workflowAnalysisResult\.value\)/)
  assert.match(canvasSource, /const emit = defineEmits\(\[[^\]]*'update-stage'/)
  assert.match(canvasSource, /emit\('update-stage', stage\.id\)/)
  assert.match(canvasSource, /if \(!shouldRenderAgentWorkbench\.value\) return activeSliceStageCanvasNodes\.value/)
  assert.match(canvasSource, /const sourceNodes = displayNodes\.value/)
})

test('workflow analysis knowledge deposit prefers total-flow acceptance stage before blueprint fallback', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const depositStart = appSource.indexOf('function importWorkflowAnalysisToKnowledge()')
  const depositEnd = appSource.indexOf('function openWorkflowKnowledgeBase()', depositStart)
  const depositSource = appSource.slice(depositStart, depositEnd)

  assert.match(apiSource, /importWorkflowAcceptanceKnowledge\(config, runId, payload/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/import-acceptance-knowledge/)
  assert.match(depositSource, /stageCanvases\?\.\['acceptance-deposit'\]\?\.nodes/)
  assert.match(depositSource, /api\.workspace\.importWorkflowAcceptanceKnowledge/)
  assert.match(depositSource, /refreshMaterialsFromBackend\('knowledge'\)/)
  assert.match(depositSource, /refreshParseJobs\(\)/)
  assert.match(depositSource, /importBlueprintToKnowledge\(blueprint, sourceAssetId\)/)
  assert.match(depositSource, /已沉淀 \${materials\.length} 条验收知识/)
})

test('workflow analysis record cards show skill name and user input', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)

  assert.match(appSource, /function workflowRecordSkillLabel\(record = \{\}\)/)
  assert.match(appSource, /record\.displaySkillName/)
  assert.match(appSource, /record\.documentAnalysis\?\.routing\?\.displaySkillName/)
  assert.match(appSource, /function isDialogueSkillRecord\(run = \{\}\)/)
  assert.match(appSource, /isDialogueSkillRecord\(run\)/)
  assert.match(appSource, /function workflowRecordInputTitle\(record = \{\}\)/)
  assert.match(appSource, /String\(record\.input \|\| record\.documentAnalysis\?\.input \|\| ''\)/)
  assert.match(entrySource, /<strong>\{\{ workflowRecordSkillLabel\(record\) \}\}<\/strong>/)
  assert.match(entrySource, /<strong>\{\{ workflowRecordInputTitle\(record\) \}\}<\/strong>/)
  assert.doesNotMatch(entrySource, /record\.projectBlueprint\?\.profile\?\.productName \|\| record\.projectBlueprint\?\.title \|\| record\.workflowName/)
})

test('workflow analysis record cards open saved records in a new tab by default', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="workflow-record-card"')
  const entryEnd = appSource.indexOf('<div class="workflow-record-cover">', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)

  assert.match(entrySource, /:href="workflowAnalysisDeepLink\(record\.id\)"/)
  assert.match(entrySource, /target="_blank"/)
  assert.match(entrySource, /rel="noopener noreferrer"/)
  assert.doesNotMatch(entrySource, /@click="handleWorkflowAnalysisRecordClick/)
  assert.match(appSource, /function restoreWorkflowAnalysisFromUrl\([\s\S]*loadWorkflowRunDetail\(runId,\s*\{ fallbackRun:\s*run \}\)/)
  assert.doesNotMatch(appSource, /function handleWorkflowAnalysisRecordClick/)
})

test('workflow analysis record cards expose delete action and sync local records', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const entryStart = appSource.indexOf('class="view-panel workflow-view workflow-entry-view"')
  const entryEnd = appSource.indexOf('<WorkflowCanvasPage', entryStart)
  const entrySource = appSource.slice(entryStart, entryEnd)
  const deleteStart = appSource.indexOf('async function deleteWorkflowAnalysisRecord')
  const deleteEnd = appSource.indexOf('function workflowRunHasModelAssistantReply', deleteStart)
  const deleteSource = appSource.slice(deleteStart, deleteEnd)

  assert.match(entrySource, /class="workflow-record-delete"/)
  assert.match(entrySource, /@click\.stop\.prevent="deleteWorkflowAnalysisRecord\(record\)"/)
  assert.match(entrySource, /删除分析记录/)
  assert.match(apiSource, /deleteWorkflowRun\(config,\s*runId\)/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}/)
  assert.match(deleteSource, /api\.workspace\.deleteWorkflowRun\(state\.apiConfig,\s*record\.id\)/)
  assert.match(deleteSource, /state\.workflowRuns\s*=\s*state\.workflowRuns\.filter\(\(run\) => run\?\.id !== record\.id\)/)
  assert.match(deleteSource, /if \(state\.activeWorkflowRun\?\.id === record\.id\)/)
  assert.match(deleteSource, /state\.activeWorkflowRun = null/)
  assert.match(deleteSource, /workflowAnalysisResult\.value = null/)
  assert.match(styleSource, /\.workflow-record-card:hover \.workflow-record-delete/)
})

test('eligible skills expose model return copy separately in fullscreen', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /:ai-summary="workflowAnalysisResult\?\.aiSummary \|\| null"/)
  assert.match(canvasSource, /aiSummary:\s*\{\s*type:\s*Object,\s*default:\s*null\s*\}/)
  assert.match(canvasSource, /showModelReturnSummary\(fullscreenNode\)/)
  assert.match(canvasSource, /showNodeOwnContentSummary\(fullscreenNode\)/)
  assert.match(canvasSource, /模型返回/)
  assert.match(canvasSource, /模型产出内容/)
  assert.match(canvasSource, /function nodeOwnSummaryItems\(node = \{\}, limit = 0\)/)
  assert.match(canvasSource, /function showNodeOwnContentSummary\(node = \{\}\)/)
  assert.match(canvasSource, /nodeOwnSummaryItems\(node\)\.length/)
  assert.match(canvasSource, /function shouldShowModelReturnSummary\(\)/)
  assert.match(canvasSource, /function isModelReturnSummaryNode\(node = \{\}\)/)
  assert.match(canvasSource, /firstNodeId = props\.nodes\?\.\[0\]\?\.id/)
  assert.match(canvasSource, /\['analysis',\s*'summary',\s*'model-generating'\]\.includes\(node\?\.id\)/)
  assert.match(canvasSource, /isModelReturnSummaryNode\(node\)/)
  assert.match(canvasSource, /不选择 Skill/)
  assert.match(canvasSource, /智能推荐 Skill/)
  assert.match(appSource, /value:\s*'advanced-ux-requirement-analysis',\s*label:\s*'高级 UX 需求分析'/)
  assert.doesNotMatch(canvasSource, /交互方案生成/)
  assert.doesNotMatch(canvasSource, /竞品分析 Skill/)
  const showNodeOwnStart = canvasSource.indexOf('function showNodeOwnContentSummary')
  const showNodeOwnEnd = canvasSource.indexOf('function nodeOwnSummaryItems', showNodeOwnStart)
  const showNodeOwnSource = canvasSource.slice(showNodeOwnStart, showNodeOwnEnd)
  assert.doesNotMatch(showNodeOwnSource, /!isAgentConfirmationNode\(node\)/)
  assert.doesNotMatch(showNodeOwnSource, /!isPureContentNode\(node\)/)
  assert.match(canvasSource, /modelReturnSummarySections/)
  assert.match(canvasSource, /aiSummary\.summary/)
  assert.match(styleSource, /\.canvas-model-return-summary/)
  assert.match(styleSource, /\.canvas-model-return-grid/)
  assert.match(styleSource, /\.canvas-node-own-summary/)
  assert.match(styleSource, /\.canvas-node-own-list/)
  assert.doesNotMatch(canvasSource, /canvas-node-own-grid/)
  assert.doesNotMatch(canvasSource, /节点条目/)
  assert.doesNotMatch(canvasSource, /补充详情/)
  const nodeOwnSummaryStyle = styleSource.slice(
    styleSource.indexOf('.canvas-node-own-summary'),
    styleSource.indexOf('.canvas-detail-tree')
  )
  assert.doesNotMatch(nodeOwnSummaryStyle, /max-height:\s*320px/)
  assert.match(nodeOwnSummaryStyle, /overflow:\s*visible/)
  assert.doesNotMatch(nodeOwnSummaryStyle, /minmax\(0,\s*1fr\)/)
  assert.doesNotMatch(nodeOwnSummaryStyle, /overflow-y:\s*auto/)
})

test('manual legacy ux confirmation skill routes to advanced UX', () => {
  const routing = orchestrateRequirementSkill({
    skillSelectionMode: 'manual',
    skillId: 'ux-design-confirmation-skill',
    input: '帮我做一个设计方案，需要先确认需求再转低保真画布'
  })

  assert.equal(routing.skillSelectionMode, 'manual')
  assert.equal(routing.requestedSkillId, 'ux-design-confirmation-skill')
  assert.equal(routing.resolvedSkillId, 'advanced-ux-requirement-analysis')
  assert.equal(routing.displaySkillName, '高级 UX 需求分析')
  assert.match(routing.routingReason, /清空其它 Skill|高级 UX/)
})

test('smart recommendation routes to the active advanced UX workflow', () => {
  const result = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'non-project',
    input: '做一个茶饮小程序，需要系统智能推荐 Skill，并输出页面、流程、状态和交付建议。',
    documents: []
  })

  assert.equal(result.displaySkillName, '高级 UX 需求分析')
  assert.equal(result.skillId, 'advanced-ux-requirement-analysis')
  assert.deepEqual(result.totalDesignFlow.stageCanvases['requirement-dissection'].nodes.map((node) => node.id), [
    'ux-original-requirement-analysis',
    'ux-design-problem-definition',
    'ux-user-scenario',
    'ux-assumption-validation',
    'ux-design-opportunity',
    'ux-interaction-chain',
    'ux-three-design-solutions',
    'ux-exception-flow',
    'ux-recommendation-decision',
    'ux-priority-phasing'
  ])
})

test('ux confirmation entry creates an agent-first run before canvas generation', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const startSource = appSource.slice(
    appSource.indexOf('async function startUxDesignConfirmationAgent'),
    appSource.indexOf('async function analyzeWorkflowDocuments')
  )

  assert.match(startSource, /createUxConfirmationCanvas/)
  assert.match(startSource, /createWorkflowRun\(pendingWorkflow, workflowEntrySnapshot\.input \|\| 'UX 设计确认'/)
  assert.match(startSource, /status:\s*'confirming'/)
  assert.match(startSource, /agentSessions:\s*\{\s*'requirement-clarification'/)
  assert.match(startSource, /showWorkflowAgentInline\(\)/)
  assert.doesNotMatch(startSource, /analyzeDocumentsStream/)
})

test('interaction design entry directly generates page-based canvas instead of agent confirmation', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const parserSource = await readFile(new URL('../backend/services/document-parser.js', import.meta.url), 'utf8')
  const handleSource = appSource.slice(
    appSource.indexOf('function handleWorkflowPrimaryAction'),
    appSource.indexOf('function dialogueSkillInitialMessage')
  )
  const canvasSource = parserSource.slice(
    parserSource.indexOf('function projectInteractionCanvasPlan'),
    parserSource.indexOf('function nonProjectCanvasPlan')
  )

  assert.match(appSource, /const isInteractionDesignWorkflowSelected = computed/)
  assert.match(handleSource, /isInteractionDesignWorkflowSelected\.value/)
  assert.match(handleSource, /analyzeWorkflowDocuments/)
  assert.doesNotMatch(handleSource, /isInteractionDesignWorkflowSelected\.value[\s\S]{0,120}startUxDesignConfirmationAgent/)
  assert.match(parserSource, /function extractInteractionPageNodes/)
  assert.match(canvasSource, /extractInteractionPageNodes\(blueprint\)/)
  assert.match(canvasSource, /mode:\s*'interaction-page'/)
  assert.match(canvasSource, /groupName:\s*'页面画布'/)
  assert.doesNotMatch(canvasSource, /canvasNode\('analysis'/)
  assert.doesNotMatch(canvasSource, /canvasNode\('ux-diagnosis'/)
})

test('legacy interaction design workflow routes to advanced UX requirement analysis', () => {
  const result = analyzeRequirementDocuments({
    skillId: 'interaction-design-workflow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，包含首页选店、取餐方式、菜单商品、商品定制、购物车结算、支付下单、取餐通知、会员优惠、订单状态。请输出所有页面和交互路径。',
    documents: []
  })

  assert.equal(result.displaySkillName, '高级 UX 需求分析')
  assert.equal(result.skillId, 'advanced-ux-requirement-analysis')
  assert.equal(result.totalDesignFlow.stageCanvases['requirement-dissection'].nodes.length, 10)
  assert.ok(result.totalDesignFlow.advancedUxReport)
})

test('total design flow wraps tea ordering analysis into one requirement slice with page navigation', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，包含首页选店、取餐方式、菜单商品、商品定制、购物车结算、支付下单、取餐通知、会员优惠、订单状态。请输出所有页面和交互路径。',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)

  assert.deepEqual(TOTAL_DESIGN_FLOW_STAGES.map((stage) => stage.id), [
    'requirement-dissection',
    'interaction-lofi',
    'ui-visual',
    'html-output',
    'vue-output',
    'acceptance-deposit'
  ])
  assert.ok(!TOTAL_DESIGN_FLOW_STAGES.some((stage) => stage.id === 'wireframe-preview' || stage.name === '低保预览'))
  assert.equal(totalFlow.currentStage, 'requirement-dissection')
  assert.ok(totalFlow.stageCanvases)
  assert.deepEqual(Object.keys(totalFlow.stageCanvases), TOTAL_DESIGN_FLOW_STAGES.map((stage) => stage.id))
  assert.notDeepEqual(
    totalFlow.stageCanvases['requirement-dissection'].orderedTabs.map((tab) => tab.label),
    totalFlow.stageCanvases['interaction-lofi'].orderedTabs.map((tab) => tab.label)
  )
  assert.equal(totalFlow.stageCanvases['requirement-dissection'].mode, 'stage-agent-workbench')
  assert.deepEqual(totalFlow.stagePages['requirement-dissection'], [])
  assert.equal(totalFlow.stageCanvases['requirement-slicing'], undefined)
  assert.equal(totalFlow.stageCanvases['gap-confirmation'], undefined)
  assert.equal(totalFlow.stageRuntime['requirement-dissection'].canOpen, true)
  assert.equal(totalFlow.stageRuntime['interaction-lofi'].canOpen, false)
  const secondStageRuntime = buildWorkflowStageRuntime({
    ...totalFlow,
    currentStage: 'interaction-lofi',
    stageConfirmations: {
      'requirement-dissection': {
        action: '下一步',
        confirmedAt: '2026-07-08T00:00:00.000Z'
      }
    }
  })
  assert.equal(secondStageRuntime['requirement-dissection'].canOpen, true)
  assert.equal(secondStageRuntime['interaction-lofi'].canOpen, true)
  assert.ok(totalFlow.stagePages['interaction-lofi'].length)
  assert.ok(totalFlow.stagePages['ui-visual'].length)
  assert.ok(totalFlow.stageCanvases['requirement-dissection'].agentWorkbench)
  assert.equal(totalFlow.stageCanvases['requirement-dissection'].agentNode.id, 'requirement-dissection-agent')
  assert.ok(totalFlow.stageCanvases['requirement-dissection'].agentNode.detailSections.some((section) => section.title === '待确认问题'))
  assert.ok(totalFlow.requirementDissectionArtifact, 'requirement dissection should produce a product-to-design artifact')
  assert.ok(totalFlow.requirementDissectionArtifact.productDefinition?.oneLine, 'artifact should define the product in one line')
  assert.ok(totalFlow.requirementDissectionArtifact.designRequirementMap?.pages?.length, 'artifact should translate product demand into page design requirements')
  assert.ok(totalFlow.requirementDissectionArtifact.designRequirementMap?.pages?.every((page) =>
    Array.isArray(page.interactionHotspots) &&
    page.interactionHotspots.length >= 3 &&
    page.interactionHotspots.every((hotspot) =>
      hotspot.target &&
      hotspot.gesture &&
      hotspot.operation &&
      hotspot.feedback &&
      hotspot.result &&
      hotspot.enableCondition &&
      hotspot.disableCondition &&
      hotspot.dataDependencies?.length &&
      hotspot.testPoints?.length
    )
  ), 'requirement dissection should inventory page-level controls for downstream interaction specs')
  const checkoutRequirement = totalFlow.requirementDissectionArtifact.designRequirementMap.pages.find((page) => page.pageName === '购物车与结算')
  assert.ok(checkoutRequirement?.interactionHotspots?.length >= 4, 'checkout page should have multiple page-specific controls')
  assert.ok(
    checkoutRequirement.interactionHotspots.some((hotspot) => /优惠|金额|支付|结算|提交/.test(`${hotspot.target}${hotspot.operation}${hotspot.result}`)),
    'checkout controls should not collapse into generic title/navigation placeholders'
  )
  assert.ok(totalFlow.requirementDissectionArtifact.competitiveAnalysis?.referenceMode, 'artifact should include competitive reference mode')
  assert.ok(totalFlow.requirementDissectionArtifact.competitiveAnalysis?.implicationsForThisProject?.pageHints?.length, 'competitive analysis should influence page hints')
  assert.ok(totalFlow.requirementDissectionArtifact.downstreamHints?.interactionLofi?.length, 'artifact should feed interaction lofi generation')
  assert.equal(totalFlow.requirementDissectionArtifact.evidenceAndAssumptions?.demandScope, 'project')
  assert.ok(totalFlow.requirementDissectionArtifact.evidenceAndAssumptions?.assumptions?.length, 'artifact should separate assumptions from confirmed facts')
  assert.ok(totalFlow.requirementDissectionArtifact.pageHierarchyTree?.leafPageCount >= 1, 'artifact should expose a page hierarchy tree')
  assert.ok(totalFlow.requirementDissectionArtifact.decisionPointMatrix?.length >= 2, 'artifact should expose a decision point matrix')
  assert.ok(totalFlow.requirementDissectionArtifact.exceptionRecoveryMatrix?.length >= 3, 'artifact should expose exception and recovery paths')
  assert.ok(totalFlow.requirementDissectionArtifact.dataFlowGraph?.edges?.length, 'artifact should expose cross-stage data flow')
  assert.ok(totalFlow.requirementDissectionArtifact.stateMachineMap?.globalStates?.length, 'artifact should expose workflow states')
  assert.ok(totalFlow.requirementDissectionArtifact.featureJumpGraph?.edges?.length, 'artifact should expose feature/page jumps')
  assert.ok(totalFlow.requirementDissectionArtifact.dataSharingMechanism?.resources?.length, 'artifact should expose data sharing mechanism')
  assert.equal(totalFlow.requirementDissectionArtifact.analysisGuidance?.version, 'requirement-dissection-guidance/v1')
  assert.ok(totalFlow.requirementDissectionArtifact.analysisGuidance?.hardConstraints?.length >= 5, 'guidance should include product contracts')
  assert.equal(totalFlow.requirementDissectionArtifact.analysisGuidance?.methodGuides?.length, 1, 'guidance should include the dedicated requirement-dissection skill')
  assert.ok(totalFlow.requirementDissectionArtifact.analysisGuidance?.referenceNotes?.length >= 2, 'guidance should include specs and implementation-plan references')
  const guidancePaths = [
    ...totalFlow.requirementDissectionArtifact.analysisGuidance.hardConstraints,
    ...totalFlow.requirementDissectionArtifact.analysisGuidance.methodGuides,
    ...totalFlow.requirementDissectionArtifact.analysisGuidance.referenceNotes
  ].map((item) => item.path)
  assert.equal(new Set(guidancePaths).size, guidancePaths.length, 'guidance source files should be de-duplicated by path')
  assert.doesNotMatch(
    JSON.stringify(totalFlow.requirementDissectionArtifact.evidenceAndAssumptions?.evidenceSources || []),
    /product-contracts|docs\/skills|superpowers\/specs|superpowers\/plans/,
    'guidance source files should not be mixed into business evidence sources'
  )
  assert.ok(!Object.prototype.hasOwnProperty.call(totalFlow.requirementDissectionArtifact.designRequirementMap || {}, 'pageCoverageMatrix'), 'page coverage matrix should have one canonical artifact field')
  assert.ok(!Object.prototype.hasOwnProperty.call(totalFlow.requirementDissectionArtifact || {}, 'projectFunctionMap'), 'project function map should stay on totalFlow and requirement agent node, not duplicate inside requirementDissectionArtifact')
  assert.ok(totalFlow.stageCanvases['requirement-dissection'].agentNode.requirementDissectionArtifact, 'requirement agent node should carry the artifact')
  assert.equal(totalFlow.stageCanvases['requirement-dissection'].agentNode.requirementDissectionArtifact, totalFlow.requirementDissectionArtifact)
  assert.equal(totalFlow.requirementDissectionArtifact.productAnalysisPipeline?.version, 'product-analysis-pipeline/v1')
  assert.deepEqual(totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.map((tab) => tab.id), [
    'requirement-understanding',
    'gap-confirmation',
    'user-journey-analysis',
    'feature-page-decomposition',
    'business-rules-stateflow',
    'flow-architecture',
    'design-opportunity',
    'priority-roadmap',
    'acceptance-standards'
  ])
  assert.deepEqual(totalFlow.stageCanvases['requirement-dissection'].nodes.map((node) => node.requirementPipelineTabId), [
    'requirement-understanding',
    'gap-confirmation',
    'user-journey-analysis',
    'feature-page-decomposition',
    'business-rules-stateflow',
    'flow-architecture',
    'design-opportunity',
    'priority-roadmap',
    'acceptance-standards'
  ])
  assert.equal(totalFlow.stageCanvases['requirement-dissection'].nodes.length, 9, 'requirement dissection should render the nine stable product-analysis chapters')
  const pipelineRefs = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.flatMap((tab) =>
    (tab.detailBlocks || []).map((block) => block.sourceRef).filter(Boolean)
  )
  assert.equal(new Set(pipelineRefs).size, pipelineRefs.length, 'pipeline detail sourceRefs should be unique across the nine chapters')
  assert.ok(totalFlow.stageCanvases['requirement-dissection'].nodes.every((node) => !Object.prototype.hasOwnProperty.call(node, 'projectFunctionMap')), 'ordinary requirement tabs should not duplicate projectFunctionMap')
  assert.ok(totalFlow.requirementDissectionArtifact.riskAssessment?.risks?.length, 'artifact should expose riskAssessment as the canonical risk field for requirement understanding')
  assert.ok(totalFlow.requirementDissectionArtifact.gapConfirmation?.questions?.length, 'artifact should expose gap confirmation questions for the PDF-style detail')
  assert.ok(totalFlow.requirementDissectionArtifact.personaScenarioMatrix?.length, 'artifact should expose persona-scenario matrix for the journey detail')
  assert.ok(totalFlow.requirementDissectionArtifact.businessRuleMatrix?.rules?.length, 'artifact should expose business rules as a canonical matrix')
  assert.ok(totalFlow.requirementDissectionArtifact.permissionMatrix?.roles?.length, 'artifact should expose permission roles')
  assert.ok(totalFlow.requirementDissectionArtifact.permissionMatrix?.operations?.length, 'artifact should expose permission operations')
  assert.ok(totalFlow.requirementDissectionArtifact.boundaryConditionMatrix?.length, 'artifact should expose boundary conditions')
  assert.ok(totalFlow.requirementDissectionArtifact.designOpportunityMatrix?.opportunities?.length, 'artifact should expose design opportunities')
  assert.ok(totalFlow.requirementDissectionArtifact.designOpportunityMatrix?.solutionOptions?.length >= 3, 'artifact should expose comparable design solution cards')
  assert.ok(totalFlow.requirementDissectionArtifact.priorityRoadmap?.quadrants?.length, 'artifact should expose priority quadrants')
  assert.ok(totalFlow.requirementDissectionArtifact.priorityRoadmap?.milestones?.length, 'artifact should expose delivery milestones')
  assert.ok(totalFlow.requirementDissectionArtifact.acceptanceBasis?.functional?.length, 'artifact should expose acceptance basis for acceptance-deposit')
  assert.ok(!Object.prototype.hasOwnProperty.call(totalFlow.requirementDissectionArtifact || {}, 'businessRules'), 'businessRules should be normalized into businessRuleMatrix to avoid duplicate rule fields')
  const flowInfoTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'flow-architecture')
  assert.deepEqual(flowInfoTab.detailBlocks.map((block) => block.sourceRef), [
    'navigationStructure',
    'dataFlowGraph',
    'featureJumpGraph',
    'exceptionRecoveryMatrix'
  ], 'flow and information architecture should expose the absorbed structures by sourceRef without copying their rows')
  const journeyTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'user-journey-analysis')
  assert.deepEqual(journeyTab.detailBlocks.map((block) => block.sourceRef), [
    'personaScenarioMatrix',
    'userJourneyMap'
  ], 'journey analysis should own persona and journey fields')
  const decompositionTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'feature-page-decomposition')
  assert.deepEqual(decompositionTab.detailBlocks.map((block) => block.sourceRef), [
    'functionModuleMatrix',
    'designRequirementMap',
    'pageHierarchyTree',
    'pageCoverageMatrix',
    'pageFrameContracts'
  ], 'feature and page decomposition should own page hierarchy and frame contracts')
  const understandingTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'requirement-understanding')
  assert.deepEqual(understandingTab.detailBlocks.map((block) => block.sourceRef), [
    'productDefinition',
    'userScenarios',
    'evidenceAndAssumptions',
    'riskAssessment'
  ], 'requirement understanding should expose positioning, scenarios, evidence, and risk by sourceRef')
  const gapTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'gap-confirmation')
  assert.deepEqual(gapTab.detailBlocks.map((block) => block.sourceRef), [
    'gapConfirmation',
    'openQuestions'
  ], 'gap confirmation should expose gap questions and open questions by sourceRef')
  const rulesTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'business-rules-stateflow')
  assert.deepEqual(rulesTab.detailBlocks.map((block) => block.sourceRef), [
    'businessRuleMatrix',
    'permissionMatrix',
    'boundaryConditionMatrix',
    'stateMachineMap'
  ], 'business rules and state flow should expose rules, states, permissions, and boundaries by sourceRef')
  const opportunityTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'design-opportunity')
  assert.deepEqual(opportunityTab.detailBlocks.map((block) => block.sourceRef), [
    'designOpportunityMatrix',
    'competitiveAnalysis'
  ], 'design opportunity should expose opportunities and competitive analysis by sourceRef')
  const roadmapTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'priority-roadmap')
  assert.deepEqual(roadmapTab.detailBlocks.map((block) => block.sourceRef), [
    'priorityRoadmap',
    'scopeBoundary'
  ], 'priority roadmap should expose roadmap and scope boundary by sourceRef')
  const acceptanceTab = totalFlow.requirementDissectionArtifact.productAnalysisPipeline.tabs.find((tab) => tab.id === 'acceptance-standards')
  assert.deepEqual(acceptanceTab.detailBlocks.map((block) => block.sourceRef), [
    'acceptanceBasis'
  ], 'acceptance standards should expose acceptance basis by sourceRef')
  assert.ok(
    totalFlow.requirementDissectionArtifact.navigationStructure?.navigationItems?.length >= totalFlow.pages.length,
    'navigation structure should expose page-bound navigation items for framework reconstruction'
  )
  assert.ok(
    totalFlow.requirementDissectionArtifact.navigationStructure.navigationItems.every((item) =>
      item.id &&
      item.label &&
      item.targetPageId &&
      item.activeState &&
      item.visibilityRule
    ),
    'each navigation item should bind target page, active state, and visibility rule'
  )
  const hierarchyPageNodes = totalFlow.requirementDissectionArtifact.pageHierarchyTree.nodes
    .flatMap((node) => node.children || [])
    .filter((node) => node.type === 'page')
  assert.ok(hierarchyPageNodes.length >= totalFlow.pages.length, 'page hierarchy should include every generated page as a typed node')
  assert.ok(
    hierarchyPageNodes.every((node) =>
      node.pageId &&
      node.parentId &&
      Number.isFinite(node.level) &&
      node.pageType
    ),
    'page hierarchy page nodes should carry pageId, parentId, level, and pageType'
  )
  assert.ok(
    totalFlow.requirementDissectionArtifact.dataFlowGraph?.nodes?.every((node) =>
      node.id &&
      node.label &&
      node.nodeType
    ),
    'data flow graph nodes should be structured graph nodes, not bare strings'
  )
  assert.ok(
    totalFlow.requirementDissectionArtifact.dataFlowGraph?.pageData?.every((row) =>
      row.pageId &&
      row.pageName &&
      Array.isArray(row.reads) &&
      Array.isArray(row.writes) &&
      Array.isArray(row.downstream)
    ),
    'page data flow rows should bind reads, writes, and downstream pages to a page id'
  )
  assert.ok(
    totalFlow.requirementDissectionArtifact.stateMachineMap?.pageStates?.every((row) =>
      row.pageId &&
      row.pageName &&
      Array.isArray(row.states) &&
      row.transitions?.every((transition) => transition.from && transition.event && transition.to)
    ),
    'page state machines should bind states and transitions to page ids'
  )
  assert.ok(
    totalFlow.requirementDissectionArtifact.featureJumpGraph?.edges?.every((edge) =>
      edge.id &&
      edge.from &&
      edge.to &&
      edge.fromPageId &&
      edge.toPageId &&
      edge.condition &&
      typeof edge.preserveState === 'boolean'
    ),
    'feature jump graph edges should expose page ids, trigger conditions, and state preservation'
  )
  assert.ok(totalFlow.requirementDissectionArtifact.pageFrameContracts?.length >= totalFlow.pages.length, 'artifact should expose page frame contracts for downstream 1:1 page reconstruction')
  assert.ok(totalFlow.requirementDissectionArtifact.pageFrameContracts.every((contract) =>
    contract.pageId &&
    contract.pageName &&
    contract.sourceRefs?.coverageRowId &&
    Array.isArray(contract.sourceRefs?.journeyStepIds) &&
    Array.isArray(contract.sourceRefs?.stateMachineIds) &&
    Array.isArray(contract.sourceRefs?.jumpEdgeIds) &&
    contract.layoutFrame?.regions?.length &&
    contract.navigationBindings?.length &&
    contract.contentHierarchy?.length &&
    contract.interactionHotspots?.length &&
    contract.stateVariants?.length &&
    contract.transitionEdges?.length
  ), 'each page frame contract should bind coverage, journey, states, jumps, layout regions, data blocks, hotspots, states, and transitions')
  assert.ok(!totalFlow.requirementDissectionArtifact.crossPageFunctionGraph, 'cross page/function relation should not duplicate featureJumpGraph as a new artifact field')
  assert.ok(!totalFlow.requirementDissectionArtifact.interactionSpecSchema, 'interaction spec schema should be a derived view, not a duplicate root artifact field')
  assert.ok(!totalFlow.requirementDissectionArtifact.interactionSpecRequirementArtifact, 'interaction spec requirement artifact should not duplicate the page frame contract')
  assert.ok(totalFlow.projectFunctionMap, 'requirement dissection should produce a global project function map')
  assert.equal(totalFlow.stageCanvases['requirement-dissection'].agentNode.projectFunctionMap, totalFlow.projectFunctionMap)
  assert.ok(totalFlow.projectFunctionMap.rootModules.some((module) => module.pages?.length), 'function map should group pages under modules')
  assert.ok(totalFlow.projectFunctionMap.pageMap.some((page) => page.pageName === '首页与选店'), 'function map should include page ownership')
  assert.ok(totalFlow.projectFunctionMap.navigationMap.length, 'function map should expose navigation/entry relationships')
  assert.notEqual(totalFlow.stageCanvases['interaction-lofi'].mode, 'stage-agent-workbench')
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.agentWorkbench !== true))
  assert.ok(
    totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) =>
      node.interactionSpecArtifact?.interactionRows?.some((row) => /^I-(decision|exception)-/.test(row.id))
    ),
    'interaction lofi pages should inherit decision and exception rows into page-level interaction specs'
  )
  const acceptanceNode = totalFlow.stageCanvases['acceptance-deposit'].nodes[0]
  assert.ok(acceptanceNode.ruleAcceptance?.length, 'acceptance deposit should inherit rule acceptance from businessRuleMatrix')
  assert.ok(acceptanceNode.stateAcceptance?.length, 'acceptance deposit should inherit state acceptance from stateMachineMap')
  assert.ok(acceptanceNode.nonFunctionalAcceptance?.length, 'acceptance deposit should expose non-functional acceptance items')
  assert.ok(acceptanceNode.deliveryPackage?.artifacts?.some((item) => /业务规则|状态机|权限矩阵|验收/.test(item)), 'delivery package should list PDF-style detailed deliverables')
  const pickupModeNode = totalFlow.stageCanvases['interaction-lofi'].nodes.find((node) => node.title === '取餐方式')
  assert.ok(
    pickupModeNode?.relatedJumpEdges?.some((edge) => edge.from === '首页与选店' && edge.to === '取餐方式'),
    'target pages should inherit incoming feature jump edges from the requirement graph'
  )
  assert.deepEqual(totalFlow.pages.map((page) => page.title), [
    '首页与选店',
    '取餐方式',
    '菜单与商品',
    '商品定制',
    '购物车与结算',
    '支付与订单生成',
    '制作与取餐通知',
    '会员与优惠',
    '前后端与验收'
  ])
  assert.deepEqual(totalFlow.stagePages['interaction-lofi'].map((page) => page.title), [
    '首页与选店',
    '取餐方式',
    '菜单与商品',
    '商品定制',
    '购物车与结算',
    '支付与订单生成',
    '制作与取餐通知',
    '会员与优惠',
    '前后端与验收'
  ])
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.some((node) => node.title === '首页与选店'))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.some((node) => node.title === '前后端与验收'))
  assert.ok(!Object.prototype.hasOwnProperty.call(totalFlow, 'wireframes'))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.stageId === 'ui-visual'))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.detailLayout === 'interaction-page-split'))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.wireframeTree?.length && node.interactionSpec?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.pageArchitecture?.sections?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.pageArchitecture?.states?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionDetails?.clickActions?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionDetails?.routeTargets?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionDetails?.dataDependencies?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionDetails?.acceptanceCriteria?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.pageName === node.title))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.snapshotRef === 'pageLayoutArtifact.asciiWireframe'))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.interactionRows?.length))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) =>
    node.interactionSpecArtifact.interactionRows.length >= Math.min(3, node.interactionHotspots?.length || 3)
  ), 'interaction specs should be generated from page control inventory, not only one generic main button')
  const checkoutSpec = totalFlow.stageCanvases['interaction-lofi'].nodes.find((node) => node.title === '购物车与结算')?.interactionSpecArtifact
  assert.ok(checkoutSpec?.interactionRows?.some((row) => /优惠|金额|支付|结算|提交/.test(`${row.target}${row.operation}${row.result}`)))
  const checkoutRowStateSignatures = new Set(checkoutSpec.interactionRows.map((row) => (row.states || []).join('|')))
  assert.ok(checkoutRowStateSignatures.size > 1, 'row states should be control-specific instead of repeating the same global state list on every row')
  assert.ok(checkoutSpec.interactionRows.every((row) => (row.states || []).length <= 3), 'global page states should stay in stateMatrix instead of being copied into every interaction row')
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.gestureNotes?.some((item) => /下拉手势/.test(item))))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.gestureNotes?.some((item) => /内容区域纵向滚动/.test(item))))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.interactionRows?.every((row) =>
    row.target &&
    row.gesture &&
    row.feedback &&
    row.statePromptCopy &&
    row.enableCondition &&
    row.disableCondition &&
    row.displayCondition &&
    row.hideCondition &&
    row.operation &&
    row.motion &&
    row.testPoints?.length
  )))
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.interactionSpecArtifact?.stateMatrix?.every((state) =>
    state.state &&
    state.trigger &&
    state.display &&
    state.promptCopy &&
    state.recovery
  )))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.detailLayout === 'visual-gallery'))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.visualPreview?.imagePrompt && node.visualPreview?.figmaReady))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.visualBrief?.componentChecklist?.length))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.visualBrief?.stateShots?.length))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.visualBrief?.figmaHandoff?.ready === true))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.targetGenerator === 'gpt-image-2'))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.artifactStatus === 'pending'))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.generationActions?.some((action) => action.label === '生成高保真图')))
  assert.ok(totalFlow.stageCanvases['ui-visual'].nodes.every((node) => node.sourceInteractionSpecArtifact?.interactionRows?.length), 'UI visual nodes should inherit page interaction specs from interaction lofi')
  const htmlNodes = totalFlow.stageCanvases['html-output'].nodes
  const htmlPageNodes = htmlNodes.filter((node) => node.htmlOutputKind === 'page')
  const htmlTotalNode = htmlNodes.find((node) => node.htmlOutputKind === 'total-interactive')
  assert.equal(htmlNodes.length, totalFlow.pages.length + 1)
  assert.equal(htmlPageNodes.length, totalFlow.pages.length)
  assert.ok(htmlTotalNode, 'HTML stage should keep a total interactive preview after page-level HTML cards')
  assert.ok(htmlPageNodes.every((node) => node.detailLayout === 'preview-code-split'))
  assert.ok(htmlPageNodes.every((node) => node.targetGenerator === 'html'))
  assert.ok(htmlPageNodes.every((node) => node.sourcePageId))
  assert.ok(htmlPageNodes.every((node) => node.sliceId))
  assert.ok(htmlPageNodes.every((node) => node.engineeringPlan?.outputFiles?.length))
  assert.ok(htmlPageNodes.every((node) => node.engineeringPlan?.runtimeStates?.length))
  assert.ok(htmlPageNodes.every((node) => node.engineeringPlan?.acceptanceCriteria?.length))
  assert.ok(htmlPageNodes.every((node) => node.generationActions?.some((action) => action.label === '生成 HTML')))
  assert.ok(htmlPageNodes.every((node) => node.sourceInteractionSpecArtifact?.interactionRows?.length), 'HTML page nodes should inherit page interaction specs from interaction lofi')
  assert.equal(htmlTotalNode.detailLayout, 'preview-code-split')
  assert.equal(htmlTotalNode.targetGenerator, 'html')
  assert.ok(htmlTotalNode.generationActions?.some((action) => action.label === '生成总交互 HTML'))
  assert.equal(totalFlow.stageCanvases['vue-output'].nodes[0].detailLayout, 'preview-code-split')
  assert.equal(totalFlow.stageCanvases['vue-output'].nodes[0].targetGenerator, 'vue')
  assert.ok(totalFlow.stageCanvases['vue-output'].nodes[0].engineeringPlan?.outputFiles?.length)
  assert.ok(totalFlow.stageCanvases['vue-output'].nodes[0].engineeringPlan?.dataContracts?.length)
  assert.ok(totalFlow.stageCanvases['vue-output'].nodes[0].engineeringPlan?.acceptanceCriteria?.length)
  assert.ok(totalFlow.stageCanvases['vue-output'].nodes[0].generationActions?.some((action) => action.label === '生成 Vue'))
  assert.ok(totalFlow.stageCanvases['vue-output'].nodes[0].upstreamPageContracts?.every((contract) => contract.interactionSpecVersion), 'Vue output should receive upstream page interaction spec versions')
  assert.equal(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].detailLayout, 'acceptance-deposit')
  assert.ok(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].acceptanceChecklist?.length)
  assert.ok(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].riskItems?.length)
  assert.ok(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].knowledgeDeposits?.length)
  assert.ok(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].deliveryPackage?.summary)
  assert.ok(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].deliveryPackage?.metrics?.length)
  assert.ok(totalFlow.stageCanvases['acceptance-deposit'].nodes[0].deliveryPackage?.artifacts?.length)
  assert.ok(totalFlow.stageSlices['interaction-lofi'].every((slice) => slice.stageId === 'interaction-lofi'))
  assert.ok(totalFlow.stagePages['interaction-lofi'].some((page) => page.title === '首页与选店'))
  assert.equal(totalFlow.requirementSlices.length, 1)
  assert.equal(totalFlow.requirementSlices[0].title, '茶饮点单主流程')
  assert.equal(totalFlow.activeSliceId, totalFlow.requirementSlices[0].id)
  assert.deepEqual(totalFlow.pages.map((page) => page.title), [
    '首页与选店',
    '取餐方式',
    '菜单与商品',
    '商品定制',
    '购物车与结算',
    '支付与订单生成',
    '制作与取餐通知',
    '会员与优惠',
    '前后端与验收'
  ])
  assert.ok(totalFlow.details[totalFlow.pages[0].id].sections.some((section) => section.title === '页面目标'))
})

test('requirement dissection returns complete participating pages for workflow analysis requests', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'interaction-design-workflow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '现在选择项目——输入需求——分析需求——进入第一阶段，接着让agent识别输入需求的内容再根据项目知识库取资料——回复，回复这一个步骤需要针对问题回复交互流程参与的所有页面然后给出全流程页面交互，一个不漏。',
    documents: [
      {
        name: '流程通项目知识库',
        sourceType: 'selected-knowledge-scope',
        text: '页面包括项目选择、需求输入、分析进度、需求分析 Agent 回复、交互低保画布、页面详情全屏。流程为选择项目 -> 输入需求 -> 分析需求 -> 需求分析 -> Agent 回复 -> 下一步。'
      }
    ]
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const artifact = totalFlow.requirementDissectionArtifact
  const pageCoverageMatrix = artifact.pageCoverageMatrix || artifact.designRequirementMap?.pageCoverageMatrix || []
  const pageNames = pageCoverageMatrix.map((row) => row.pageName)

  assert.equal(artifact.evidenceAndAssumptions?.demandScope, 'project')
  assert.match(artifact.evidenceAndAssumptions?.knowledgePolicy || '', /项目知识/)
  assert.ok(artifact.pageHierarchyTree?.leafPageCount >= 8, 'workflow analysis should expose a page hierarchy tree')
  assert.ok(artifact.decisionPointMatrix?.some((row) => /完整页面范围/.test(row.decisionPoint || '')), 'workflow analysis should expose page-completeness decisions')
  assert.ok(artifact.exceptionRecoveryMatrix?.some((row) => /分析生成失败|页面覆盖不确定/.test(row.scenario || '')), 'workflow analysis should expose recoverable exception paths')
  assert.ok(artifact.dataFlowGraph?.edges?.some((edge) => edge.from === '页面覆盖矩阵' && edge.to === '交互低保页面'), 'workflow analysis should connect coverage to interaction lofi')
  assert.ok(artifact.stateMachineMap?.globalStates?.some((row) => row.state === '已进入交互低保'), 'workflow analysis should expose stage state machine')
  assert.ok(artifact.featureJumpGraph?.edges?.length, 'workflow analysis should expose feature jump graph')
  assert.ok(artifact.dataSharingMechanism?.resources?.some((row) => row.storedIn === 'interactionSpecArtifact'), 'workflow analysis should expose data sharing mechanism')
  assert.ok(pageCoverageMatrix.length >= 8, 'requirement reply should enumerate every participating page in a coverage matrix')
  ;[
    '项目选择页',
    '需求输入页',
    '分析进度页',
    '需求分析 Agent 回复区',
    '页面覆盖矩阵',
    '交互低保画布',
    '页面详情全屏',
    '阶段切换/下一步'
  ].forEach((pageName) => {
    assert.ok(pageNames.includes(pageName), `coverage matrix should include ${pageName}`)
  })
  ;['文档分析结果', '产品分析报告', 'Skill v2', '完整 HTML'].forEach((artifactNodeName) => {
    assert.ok(!pageNames.includes(artifactNodeName), `${artifactNodeName} should not replace the participating workflow pages`)
  })
  assert.ok(
    pageCoverageMatrix.every((row) =>
      row.participationReason &&
      row.entryFrom &&
      row.exitTo &&
      /流程通项目知识库/.test(row.sourceEvidence || '') &&
      Array.isArray(row.primaryActions) &&
      row.primaryActions.length &&
      Array.isArray(row.stateCoverage) &&
      row.stateCoverage.length
    ),
    'each participating page should carry reason, entry, exit, actions and state coverage'
  )
  assert.deepEqual(
    totalFlow.pages.map((page) => page.title),
    pageNames,
    'total design flow pages should align with the complete participating page coverage'
  )
  assert.ok(totalFlow.projectFunctionMap.pageMap.some((page) => page.pageName === '需求分析 Agent 回复区'))
  assert.ok(
    totalFlow.stageCanvases['interaction-lofi'].nodes.some((node) => node.title === '页面详情全屏'),
    'interaction lofi stage should inherit every covered page'
  )

  const nonProjectAnalysis = analyzeRequirementDocuments({
    skillId: 'interaction-design-workflow',
    skillSelectionMode: 'manual',
    demandScope: 'non-project',
    input: '现在选择项目——输入需求——分析需求——进入第一阶段，接着让agent识别输入需求的内容再回复，回复这一个步骤需要针对问题回复交互流程参与的所有页面然后给出全流程页面交互，一个不漏。',
    documents: []
  })
  const nonProjectFlow = buildTotalDesignFlow(nonProjectAnalysis)
  const nonProjectEvidence = JSON.stringify(nonProjectFlow.requirementDissectionArtifact.pageCoverageMatrix || [])
  assert.doesNotMatch(nonProjectEvidence, /流程通项目知识库|已引用项目知识|selected-knowledge-scope|项目资料/)
  assert.equal(nonProjectFlow.requirementDissectionArtifact.evidenceAndAssumptions?.demandScope, 'non-project')
  assert.doesNotMatch(
    JSON.stringify(nonProjectFlow.requirementDissectionArtifact.evidenceAndAssumptions?.evidenceSources || []),
    /项目知识库|已引用项目知识|selected-knowledge-scope/
  )
  const totalDesignFlowSource = await readFile(new URL('../backend/services/total-design-flow.js', import.meta.url), 'utf8')
  const pageCoverageSource = totalDesignFlowSource.slice(
    totalDesignFlowSource.indexOf('function pageCoverageMatrixForAnalysis'),
    totalDesignFlowSource.indexOf('function evidenceAndAssumptionsForAnalysis')
  )
  assert.doesNotMatch(
    pageCoverageSource,
    /sourceEvidence:[^\n]*项目资料/,
    'non-project page coverage fallback evidence should not mention project materials'
  )
})

test('workflow first-stage reply and page artifact do not truncate participating pages', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const compactStart = appSource.indexOf('function workflowCompactJsonReplyText')
  const compactEnd = appSource.indexOf('function workflowPageDetailItems', compactStart)
  const compactSource = appSource.slice(compactStart, compactEnd)
  const artifactStart = appSource.indexOf('function workflowPageLayoutArtifactText')
  const artifactEnd = appSource.indexOf('function workflowAnalysisFallbackReplyText', artifactStart)
  const artifactSource = appSource.slice(artifactStart, artifactEnd)

  assert.match(appSource, /function workflowReplyPagesForDisplay/)
  assert.match(compactSource, /workflowReplyPagesForDisplay\(parsed\.totalDesignFlow\?\.pages\)/)
  assert.match(artifactSource, /workflowReplyPagesForDisplay\(totalFlow\?\.pages\)/)
  assert.doesNotMatch(compactSource, /pages\.slice\(0,\s*8\)/)
  assert.doesNotMatch(artifactSource, /pages\.slice\(0,\s*6\)/)
})

test('total design flow distinguishes waiting, model generated and fallback content sources', () => {
  const waitingAnalysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const waitingFlow = buildTotalDesignFlow({
    ...waitingAnalysis,
    totalDesignFlowMode: 'waiting-model'
  })
  const waitingNode = waitingFlow.stageCanvases['requirement-dissection'].nodes[0]

  assert.equal(waitingFlow.contentStatus, 'waiting-model')
  assert.equal(waitingNode.contentLoading, false)
  assert.equal(waitingNode.contentSource, 'model-pending')
  assert.match(waitingNode.summary, /模型增强中/)
  assert.match(waitingNode.content.join('\n'), /文档数量|来源摘要|当前判断/)

  const fallbackFlow = buildTotalDesignFlow(waitingAnalysis)
  const fallbackNode = fallbackFlow.stageCanvases['requirement-dissection'].nodes[0]
  assert.equal(fallbackFlow.contentStatus, 'fallback-structure')
  assert.equal(fallbackNode.loading, false)
  assert.equal(fallbackNode.contentSource, 'fallback-structure')
  assert.match(fallbackNode.summary, /基础结构/)

  const modelFlow = buildTotalDesignFlow({
    ...waitingAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        readableSummary: {
          oneSentence: '茶饮小程序应围绕就近选店、快速点单和取餐通知闭环。',
          userGoal: '让用户快速完成茶饮下单并获得取餐提醒。',
          coreModules: ['选店', '菜单', '结算', '取餐通知'],
          recommendedFlow: ['选店', '点单', '支付', '取餐'],
          questions: ['是否支持堂食']
        }
      }
    },
    aiSummary: {
      items: ['模型结论：茶饮小程序应围绕就近选店、快速点单和取餐通知闭环。']
    }
  })
  const modelNode = modelFlow.stageCanvases['requirement-dissection'].nodes[0]
  assert.equal(modelFlow.contentStatus, 'model-generated')
  assert.equal(modelNode.loading, false)
  assert.equal(modelNode.contentSource, 'model-generated')
  assert.match(modelNode.summary, /模型生成/)
  assert.match(modelNode.content.join('\n'), /模型未返回需求分析结构/)
  assert.doesNotMatch(modelNode.content.join('\n'), /产品类型|底层意图|模型结论/)
})

test('total design flow normalizes loose model requirement fields for canvas detail', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'manual',
    demandScope: 'non-project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementDissectionArtifact: {
            productDefinition: {
              oneLine: '面向茶饮门店的用户自助点单与取餐小程序。',
              productType: '交易型微信小程序'
            },
            navigationStructure: ['首页/门店入口', '菜单', '购物车', '订单'],
            pageHierarchyTree: '茶饮点单小程序\n├─ 首页/菜单\n├─ 商品详情\n└─ 订单详情',
            userJourneyMap: [
              { step: '进入', userAction: '打开小程序', keyQuestion: '是否先选门店' },
              { step: '下单', userAction: '选择商品并支付', keyQuestion: '是否支付成功' }
            ],
            dataFlowGraph: '用户选择商品 -> 购物车计算 -> 提交订单 -> 支付确认 -> 商家接单',
            stateMachineMap: [
              { entity: '订单', states: ['待支付', '已支付', '制作中', '待取餐', '已完成'] }
            ],
            boundaryConditionMatrix: {
              paymentFailure: {
                scenario: '支付失败',
                triggerCondition: '支付渠道失败或用户取消支付',
                expectedBehavior: '保留订单和购物车选择',
                recoveryPath: '返回订单详情重新支付或取消订单'
              },
              stockChanged: {
                trigger: '提交订单时商品售罄',
                behavior: '提示库存变化并重新计算购物车',
                recovery: '回到购物车调整商品'
              }
            },
            featureJumpGraph: [
              { from: '首页/菜单', to: '商品详情', trigger: '选择商品' },
              { from: '商品详情', to: '购物车', trigger: '加入购物车' }
            ],
            designOpportunityMatrix: [
              { opportunity: '快速复购', value: '提升老用户下单效率', priority: 'P1' }
            ],
            priorityRoadmap: [
              { phase: 'MVP', focus: '自提点单闭环', items: ['菜单', '商品规格', '购物车', '支付'] }
            ],
            acceptanceBasis: ['用户能从菜单完成下单支付。']
          }
        }
      }
    }
  })

  const artifact = flow.modelOnlyRequirementDissectionArtifact
  assert.deepEqual(
    flow.stageCanvases['requirement-dissection'].nodes.map((node) => node.id),
    [
      'requirement-understanding',
      'gap-confirmation',
      'user-journey-analysis',
      'feature-page-decomposition',
      'business-rules-stateflow',
      'flow-architecture',
      'design-opportunity',
      'priority-roadmap',
      'acceptance-standards'
    ],
    'model-only requirement canvas should use the ordinary nine-chapter tabs'
  )
  assert.ok(Array.isArray(artifact.navigationStructure.navigationItems))
  assert.ok(artifact.navigationStructure.navigationItems.length >= 4)
  assert.ok(Array.isArray(artifact.pageHierarchyTree.nodes))
  assert.ok(artifact.pageHierarchyTree.nodes.length >= 3)
  assert.ok(Array.isArray(artifact.userJourneyMap.firstTimePath))
  assert.equal(artifact.userJourneyMap.firstTimePath.length, 2)
  assert.ok(Array.isArray(artifact.dataFlowGraph.edges))
  assert.ok(artifact.dataFlowGraph.edges.length >= 4)
  assert.ok(Array.isArray(artifact.stateMachineMap.globalStates))
  assert.ok(artifact.stateMachineMap.globalStates.length >= 5)
  assert.ok(Array.isArray(artifact.boundaryConditionMatrix))
  assert.equal(artifact.boundaryConditionMatrix.length, 2)
  assert.equal(artifact.boundaryConditionMatrix[1].scenario, 'stockChanged')
  assert.match(artifact.boundaryConditionMatrix[1].recoveryPath, /购物车/)
  assert.ok(Array.isArray(artifact.featureJumpGraph.edges))
  assert.equal(artifact.featureJumpGraph.edges.length, 2)
  assert.ok(Array.isArray(artifact.designOpportunityMatrix.opportunities))
  assert.ok(Array.isArray(artifact.priorityRoadmap.milestones))
  assert.ok(Array.isArray(artifact.acceptanceBasis.functional))

  const flowArchitectureNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'flow-architecture')
  const designOpportunityNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'design-opportunity')
  const priorityNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'priority-roadmap')
  const acceptanceNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'acceptance-standards')
  assert.doesNotMatch(flowArchitectureNode.content.join('\n'), /模型未返回该字段/)
  assert.doesNotMatch(designOpportunityNode.content.join('\n'), /模型未返回该字段/)
  assert.doesNotMatch(priorityNode.content.join('\n'), /模型未返回该字段/)
  assert.doesNotMatch(acceptanceNode.content.join('\n'), /模型未返回该字段/)
})

test('total design flow keeps requirement pipeline canonical when model stage nodes also exist', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          stageCanvases: {
            'requirement-dissection': {
              nodes: [
                {
                  id: 'requirement-understanding',
                  summary: '模型判断：这是茶饮点单小程序的一期主流程需求。',
                  content: ['模型拆解：用户要从选店到取餐通知完成闭环。'],
                  detailSections: [
                    { title: '模型依据', items: ['输入包含选店、菜单、购物车、支付、取餐通知。'] }
                  ]
                },
                {
                  id: 'business-rules-stateflow',
                  summary: '模型判断：风险集中在门店库存、支付失败和取餐通知。',
                  content: ['风险：库存售罄、支付超时、通知失败。']
                }
              ]
            }
          }
        }
      }
    }
  })
  const sourceNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'requirement-understanding')
  const riskNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'business-rules-stateflow')
  const breakdownNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'feature-page-decomposition')

  assert.equal(sourceNode.contentSource, 'model-generated')
  assert.notEqual(sourceNode.summary, '模型生成：模型判断：这是茶饮点单小程序的一期主流程需求。')
  assert.notDeepEqual(sourceNode.content, ['模型拆解：用户要从选店到取餐通知完成闭环。'])
  assert.ok(Array.isArray(sourceNode.detailBlocks))
  assert.ok(Array.isArray(riskNode.detailBlocks))
  assert.doesNotMatch(sourceNode.content.join('\n'), /取餐通知完成闭环/)
  assert.doesNotMatch(riskNode.content.join('\n'), /库存售罄/)
  assert.doesNotMatch(breakdownNode.content.join('\n'), /库存售罄|取餐通知完成闭环/)
})

test('total design flow fills sparse model requirement artifact with usable user scenario detail', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，需要首页菜单、商品详情、购物车结算、支付订单和会员优惠',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementDissectionArtifact: {
            productDefinition: {
              oneLine: '茶饮点单小程序用于完成用户自助下单闭环。',
              productType: '微信小程序'
            },
            userScenarios: {
              primaryUsers: [],
              coreScenarios: ['让用户从浏览商品到提交订单形成完整链路。']
            }
          }
        }
      }
    }
  })
  const artifact = flow.requirementDissectionArtifact
  const userScenarioNode = flow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'requirement-understanding')

  assert.ok(artifact.userScenarios.primaryUsers.length >= 2, 'sparse model artifact should be completed with target user roles')
  assert.ok(artifact.userScenarios.coreScenarios.length >= 2, 'sparse model artifact should be completed with page-driven scenarios')
  assert.ok(artifact.userScenarios.jobsToBeDone.length >= 3, 'sparse model artifact should be completed with JTBD detail')
  assert.ok(artifact.userScenarios.designImplications.length >= 3, 'sparse model artifact should include design implications for detailed fullscreen output')
  assert.ok(artifact.designRequirementMap.pages.every((page) => page.primaryAction && page.states?.length && page.dataDependencies?.length && page.acceptanceCriteria?.length), 'sparse model page requirements should be completed with action, state, data, and acceptance detail')
  assert.doesNotMatch(artifact.userScenarios.primaryUsers.join('\n'), /待确认/)
  assert.equal(flow.modelOnlyRequirementDissectionArtifact.userScenarios.primaryUsers.length, 0, 'model-only artifact should not fill missing users from fallback')
  assert.match(userScenarioNode.content.join('\n'), /核心场景/)
  assert.match(userScenarioNode.content.join('\n'), /产品类型：微信小程序/)
  assert.doesNotMatch(userScenarioNode.content.join('\n'), /核心用户|目标用户待确认|底层意图/)
})

test('total flow prompt asks the model to return requirement analysis fields explicitly', async () => {
  const promptSource = await readFile(new URL('../backend/services/prompt-builder.js', import.meta.url), 'utf8')
  assert.match(promptSource, /requirementDissectionArtifact/)
  assert.match(promptSource, /productAnalysisPipeline/)
  assert.match(promptSource, /9 个需求分析画布章节/)
  assert.match(promptSource, /riskAssessment/)
  assert.match(promptSource, /pageFrameContracts/)
  assert.match(promptSource, /needs-confirmation/)
  assert.match(promptSource, /detailBlocks.*sourceRef/s)
  assert.match(promptSource, /模型必须显式返回/)
  assert.match(promptSource, /未返回的字段不要由前端或展示层补写/)
})

test('total design flow lets model returned slices and pages drive canvas structure', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，补充会员积分兑换和退款售后流程。',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            {
              id: 'points-redemption-flow',
              title: '会员积分兑换流程',
              goal: '让用户用积分兑换优惠券或商品权益。',
              sourceExcerpt: '补充会员积分兑换',
              priority: 'P0',
              pageCount: 2,
              pendingQuestionCount: 1
            },
            {
              id: 'refund-after-sale-flow',
              title: '退款售后流程',
              goal: '让用户在订单完成前后申请退款并查看处理结果。',
              sourceExcerpt: '退款售后流程',
              priority: 'P1',
              pageCount: 2
            }
          ],
          pages: [
            {
              id: 'points-mall-page',
              sliceId: 'points-redemption-flow',
              title: '积分商城',
              summary: '展示可兑换权益和积分余额。',
              detailSections: [
                { title: '页面目标', items: ['让用户理解积分可兑换什么。'] },
                { title: '页面核心模块', items: ['积分余额', '权益列表', '兑换入口'] },
                { title: '用户点击动作', items: ['点击兑换权益'] },
                { title: '跳转到哪个页面', items: ['兑换确认'] },
                { title: '加载 / 空状态 / 失败 / 权限等状态', items: ['积分不足', '权益售罄'] },
                { title: '前后端接口或数据依赖', items: ['GET /api/member/points', 'POST /api/points/redeem'] },
                { title: '验收点', items: ['积分不足不能兑换'] }
              ]
            },
            {
              id: 'points-confirm-page',
              sliceId: 'points-redemption-flow',
              title: '兑换确认',
              summary: '确认兑换权益和消耗积分。',
              route: '兑换完成或返回积分商城'
            },
            {
              id: 'refund-apply-page',
              sliceId: 'refund-after-sale-flow',
              title: '退款申请',
              summary: '选择订单、退款原因和提交凭证。',
              route: '退款进度'
            }
          ]
        }
      }
    }
  })

  assert.deepEqual(flow.requirementSlices.map((slice) => slice.title), ['会员积分兑换流程', '退款售后流程'])
  assert.equal(flow.activeSliceId, 'points-redemption-flow')
  assert.deepEqual(flow.pages.map((page) => page.title), ['积分商城', '兑换确认', '退款申请'])
  assert.equal(flow.pages[0].sliceId, 'points-redemption-flow')
  assert.equal(flow.stagePages['interaction-lofi'][0].title, '积分商城')
  assert.ok(flow.stageCanvases['interaction-lofi'].nodes.some((node) => node.title === '积分商城'))
  assert.equal(flow.stageCanvases['requirement-slicing'], undefined)
  assert.equal(flow.stageCanvases['gap-confirmation'], undefined)
  assert.ok(flow.details['points-mall-page'].sections.some((section) => section.title === '页面核心模块'))
})

test('total design flow enriches broad tea mini program model pages and keeps page wireframes distinct', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'tea-main', title: '茶饮点单主流程', goal: '完成用户点单闭环。' },
            { id: 'tea-merchant', title: '商家订单处理', goal: '让门店处理用户订单。' }
          ],
          pages: [
            { id: 'menu-home', sliceId: 'tea-main', title: '点单首页', summary: '浏览菜单并加购。' },
            { id: 'product-detail', sliceId: 'tea-main', title: '商品详情', summary: '选择规格和加料。' },
            { id: 'order-confirm', sliceId: 'tea-main', title: '订单确认', summary: '确认商品和优惠。' },
            { id: 'order-detail', sliceId: 'tea-main', title: '订单详情', summary: '查看取餐码和状态。' },
            { id: 'merchant-board', sliceId: 'tea-merchant', title: '商家订单台', summary: '商家处理订单。' }
          ]
        }
      }
    }
  })

  const pageTitles = flow.pages.map((page) => page.title)
  assert.ok(pageTitles.length > 5)
  assert.ok(pageTitles.includes('点单首页'))
  assert.ok(pageTitles.includes('商品详情'))
  assert.ok(pageTitles.includes('购物车与结算'))
  assert.ok(pageTitles.includes('会员与优惠'))

  const nodes = flow.stageCanvases['interaction-lofi'].nodes
  const menuNode = nodes.find((node) => node.title === '点单首页')
  const detailNode = nodes.find((node) => node.title === '商品详情')
  assert.ok(menuNode?.pageLayoutArtifact?.asciiWireframe)
  assert.ok(detailNode?.pageLayoutArtifact?.asciiWireframe)
  assert.notEqual(menuNode.pageLayoutArtifact.asciiWireframe, detailNode.pageLayoutArtifact.asciiWireframe)
  assert.match(menuNode.pageLayoutArtifact.asciiWireframe, /左右分栏主体/)
  assert.match(detailNode.pageLayoutArtifact.asciiWireframe, /商品详情页/)
  assert.match(detailNode.pageLayoutArtifact.asciiWireframe, /规格选择/)
})

test('total design flow lets model stage canvases replace generated stage node structure', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，UI 阶段需要按设计系统总览和页面状态总览拆。',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          stageCanvases: {
            'ui-visual': {
              nodes: [
                {
                  id: 'visual-system-overview',
                  title: '视觉设计系统总览',
                  summary: '统一茶饮小程序的颜色、组件、圆角和状态视觉规则。',
                  content: ['主色：清爽青绿', '组件：商品卡、门店卡、底部结算条'],
                  detailSections: [
                    { title: '视觉变量', items: ['主色 #22C55E', '圆角 12px', '按钮高度 44px'] }
                  ]
                },
                {
                  id: 'visual-state-matrix',
                  title: '页面状态视觉矩阵',
                  summary: '集中定义加载、空、失败、权限、禁用态。',
                  content: ['状态：加载骨架屏', '状态：失败可重试'],
                  detailSections: [
                    { title: '状态样式', items: ['加载骨架屏', '空状态插画', '失败重试按钮'] }
                  ]
                }
              ],
              edges: [
                { id: 'visual-system-overview-visual-state-matrix', from: 'visual-system-overview', to: 'visual-state-matrix', label: '补充状态' }
              ],
              orderedTabs: [
                { key: 'visual-system-overview', label: '视觉设计系统总览' },
                { key: 'visual-state-matrix', label: '页面状态视觉矩阵' }
              ]
            }
          }
        }
      }
    }
  })
  const visualCanvas = flow.stageCanvases['ui-visual']

  assert.deepEqual(visualCanvas.nodes.map((node) => node.id), ['visual-system-overview', 'visual-state-matrix'])
  assert.ok(visualCanvas.nodes.every((node) => node.contentSource === 'model-generated'))
  assert.ok(visualCanvas.nodes.every((node) => node.detailLayout === 'visual-gallery'))
  assert.equal(visualCanvas.edges[0].label, '补充状态')
  assert.deepEqual(visualCanvas.orderedTabs.map((tab) => tab.label), ['视觉设计系统总览', '页面状态视觉矩阵'])
  assert.ok(!visualCanvas.nodes.some((node) => /首页与选店 UI视觉/.test(node.title)))
})

test('total design flow derives interaction stage page nav from final model canvas', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，交互低保由模型自定义页面节点。',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          pages: [
            {
              id: 'stale-page',
              title: '旧页面导航',
              summary: '这个 pages 列表不应该覆盖模型交互低保画布。'
            }
          ],
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                {
                  id: 'lofi-custom-entry',
                  title: '自定义入口页',
                  summary: '模型定义的入口页面。',
                  detailSections: [
                    { title: '页面目标', items: ['让用户快速进入点单。'] }
                  ]
                },
                {
                  id: 'lofi-custom-result',
                  title: '自定义结果页',
                  summary: '模型定义的结果页面。',
                  detailSections: [
                    { title: '验收点', items: ['结果状态清晰。'] }
                  ]
                }
              ]
            }
          }
        }
      }
    }
  })

  assert.deepEqual(
    flow.stageCanvases['interaction-lofi'].nodes.map((node) => node.title),
    ['自定义入口页', '自定义结果页']
  )
  assert.deepEqual(
    flow.stagePages['interaction-lofi'].map((page) => page.title),
    ['自定义入口页', '自定义结果页']
  )
  assert.deepEqual(
    flow.stagePages['interaction-lofi'].map((page) => page.nodeId),
    ['lofi-custom-entry', 'lofi-custom-result']
  )
  assert.ok(!flow.stagePages['interaction-lofi'].some((page) => page.title === '旧页面导航'))
})

test('downstream UI visual canvas realigns stale pending nodes to interaction lofi pages', () => {
  const flow = withDownstreamStageArtifactContext({
    currentStage: 'ui-visual',
    stages: TOTAL_DESIGN_FLOW_STAGES,
    stageCanvases: {
      'interaction-lofi': {
        nodes: [
          {
            id: 'advanced-ux-page-home',
            stageId: 'interaction-lofi',
            title: '复制首页',
            sourcePageId: 'page-home',
            sliceId: 'slice-main',
            pageLayoutArtifact: {
              version: 'layout-v1',
              asciiWireframe: 'A1 顶部导航区 | Logo | 项目 | 模板',
              layout: {
                shell: 'top-fixed-scroll-body',
                regions: [
                  { id: 'topbar', label: '顶部导航区', type: 'navigation' },
                  { id: 'upload', label: '上传区域', type: 'input' }
                ],
                states: [{ id: 'ready', label: '待输入' }]
              },
              evidenceRefs: [{ id: 'page-home' }]
            },
            interactionSpecArtifact: {
              version: 'interaction-v1',
              interactionRows: [
                { target: '上传区域', targetRegionId: 'upload', gesture: '点击上传' }
              ],
              stateMatrix: [{ state: '待输入' }]
            }
          }
        ],
        edges: [],
        orderedTabs: []
      },
      'ui-visual': {
        nodes: [
          {
            id: 'ui-doc-summary',
            stageId: 'ui-visual',
            title: '文档分析结果 UI视觉',
            sourcePageId: 'doc-summary',
            artifactStatus: 'pending',
            visualPreview: { imageStatus: 'pending' }
          }
        ],
        edges: [],
        orderedTabs: []
      }
    }
  })

  const visualNodes = flow.stageCanvases['ui-visual'].nodes
  assert.deepEqual(visualNodes.map((node) => node.title), ['复制首页 UI视觉'])
  assert.equal(visualNodes[0].sourceNodeId, 'advanced-ux-page-home')
  assert.equal(visualNodes[0].sourcePageId, 'page-home')
  assert.equal(visualNodes[0].sliceId, 'slice-main')
  assert.equal(visualNodes[0].sourcePageLayoutArtifact.asciiWireframe, 'A1 顶部导航区 | Logo | 项目 | 模板')
  assert.equal(visualNodes[0].visualBrief.pageTitle, '复制首页')
  assert.match(visualNodes[0].visualPreview.imagePrompt, /必须延续上一阶段交互低保和页面骨架/)
  assert.deepEqual(flow.stageCanvases['ui-visual'].orderedTabs, [
    { key: 'ui-advanced-ux-page-home', label: '复制首页 UI视觉' }
  ])
})

test('downstream UI visual and HTML canvases sync all interaction pages while preserving unchanged generated nodes', () => {
  const sourceNodes = [
    {
      id: 'advanced-ux-page-home',
      stageId: 'interaction-lofi',
      title: '复刻首页',
      sliceId: 'slice-main',
      pageLayoutArtifact: {
        version: 'layout-home-v1',
        asciiWireframe: 'A1 顶部导航区 | A2 上传区',
        layout: { regions: [{ id: 'upload', label: '上传区' }] }
      },
      interactionSpecArtifact: {
        version: 'interaction-home-v1',
        interactionRows: [{ target: '点击上传区', targetRegionId: 'upload' }]
      }
    },
    {
      id: 'advanced-ux-page-result',
      stageId: 'interaction-lofi',
      title: '拆解结果页',
      sliceId: 'slice-main',
      pageLayoutArtifact: {
        version: 'layout-result-v1',
        asciiWireframe: 'B1 摘要区 | B2 分镜列表',
        layout: { regions: [{ id: 'storyboard', label: '分镜列表' }] }
      },
      interactionSpecArtifact: {
        version: 'interaction-result-v1',
        interactionRows: [{ target: '点击分镜行', targetRegionId: 'storyboard' }]
      }
    }
  ]
  const flow = withDownstreamStageArtifactContext({
    currentStage: 'html-output',
    stages: TOTAL_DESIGN_FLOW_STAGES,
    stageCanvases: {
      'interaction-lofi': {
        nodes: sourceNodes,
        edges: [],
        orderedTabs: sourceNodes.map((node) => ({ key: node.id, label: node.title }))
      },
      'ui-visual': {
        nodes: [
          {
            id: 'ui-advanced-ux-page-home',
            stageId: 'ui-visual',
            title: '复刻首页 UI视觉',
            sourcePageId: 'advanced-ux-page-home',
            artifactStatus: 'generated',
            visualPreview: {
              imageStatus: 'generated',
              imageUrl: '/generated/home.png',
              imagePrompt: '已生成的首页提示词'
            }
          }
        ],
        edges: [],
        orderedTabs: [{ key: 'ui-advanced-ux-page-home', label: '复刻首页 UI视觉' }]
      },
      'html-output': {
        nodes: [
          {
            id: 'html-page-advanced-ux-page-home',
            stageId: 'html-output',
            title: '复刻首页 HTML',
            htmlOutputKind: 'page',
            sourcePageId: 'advanced-ux-page-home',
            artifactStatus: 'generated',
            codePreview: { code: '<main>home</main>', filePath: 'pages/advanced-ux-page-home.html' },
            artifact: { html: '<main>home</main>' }
          },
          {
            id: 'html-total-preview',
            stageId: 'html-output',
            title: '总交互 HTML 预览',
            htmlOutputKind: 'total-interactive',
            artifactStatus: 'generated',
            codePreview: { code: '<main>total</main>', filePath: 'index.html' },
            artifact: { html: '<main>total</main>' }
          }
        ],
        edges: [],
        orderedTabs: [{ key: 'html-page-advanced-ux-page-home', label: '复刻首页 HTML' }]
      }
    }
  })

  const visualNodes = flow.stageCanvases['ui-visual'].nodes
  assert.deepEqual(visualNodes.map((node) => node.title), ['复刻首页 UI视觉', '拆解结果页 UI视觉'])
  assert.equal(visualNodes[0].artifactStatus, 'generated')
  assert.equal(visualNodes[0].visualPreview.imageUrl, '/generated/home.png')
  assert.equal(visualNodes[1].sourceNodeId, 'advanced-ux-page-result')
  assert.equal(visualNodes[1].artifactStatus, 'pending')

  const htmlNodes = flow.stageCanvases['html-output'].nodes
  const htmlPageNodes = htmlNodes.filter((node) => node.htmlOutputKind === 'page')
  const htmlTotalNode = htmlNodes.find((node) => node.htmlOutputKind === 'total-interactive')
  assert.deepEqual(htmlPageNodes.map((node) => node.title), ['复刻首页 HTML', '拆解结果页 HTML'])
  assert.equal(htmlPageNodes[0].artifactStatus, 'generated')
  assert.equal(htmlPageNodes[0].codePreview.code, '<main>home</main>')
  assert.equal(htmlPageNodes[1].sourceNodeId, 'advanced-ux-page-result')
  assert.equal(htmlPageNodes[1].artifactStatus, 'pending')
  assert.deepEqual(htmlTotalNode.linkedPageIds, ['advanced-ux-page-home', 'advanced-ux-page-result'])
})

test('total design flow attaches model page layout artifact to interaction canvas nodes', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: 'Podcastor.ai 认证页面，输出页面框架。',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          pages: [
            {
              id: 'auth-sign-in',
              title: '登录页 Sign In',
              summary: '承接 Google、Discord、邮箱登录和原创作上下文回跳。',
              pageLayoutSpec: {
                page: '登录页 Sign In',
                pageType: '认证与账号入口页面',
                layoutType: '左右分栏价值展示 + 右侧认证表单',
                topFixed: ['Podcastor.ai Logo', '返回原创作入口'],
                scrollModules: ['左侧创作价值与案例预览', 'Google 登录', 'Discord 登录', '邮箱登录表单'],
                bottomFixed: ['继续当前任务按钮'],
                overlays: ['OAuth 授权窗口', '账号合并提示'],
                interactions: ['Google 登录成功后回到原创作上下文'],
                frontendTasks: ['前端渲染左右分栏、移动端单列表单和 OAuth pending 状态'],
                backendTasks: ['后端保存 redirect_uri/source/draft_id 并初始化 credits']
              }
            }
          ]
        }
      }
    }
  })
  const node = flow.stageCanvases['interaction-lofi'].nodes.find((item) => item.title === '登录页 Sign In')

  assert.ok(node.pageLayoutArtifact)
  assert.equal(node.pageLayoutArtifact.title, '页面骨架')
  assert.match(node.pageLayoutArtifact.modelDecision, /认证与账号入口页面/)
  assert.match(node.pageLayoutArtifact.asciiWireframe, /登录页 Sign In/)
  assert.match(node.pageLayoutArtifact.asciiWireframe, /Google 登录/)
  assert.match(node.pageLayoutArtifact.interactionDetails, /Google 登录成功后回到原创作上下文/)
  assert.deepEqual(node.pageLayoutArtifact.frontendHandoff, ['前端渲染左右分栏、移动端单列表单和 OAuth pending 状态'])
  assert.deepEqual(node.pageLayoutArtifact.backendHandoff, ['后端保存 redirect_uri/source/draft_id 并初始化 credits'])
  assert.match(node.content.join('\n'), /页面骨架已生成/)
})

test('total design flow builds page wireframe artifacts for interaction pages even when model layout spec is missing', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: 'Podcastor.ai 认证页面，输出页面框架。',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          pages: [
            {
              id: 'auth-sign-in',
              title: '登录页 Sign In',
              summary: '模型只给了摘要，没有结构化布局。'
            }
          ]
        }
      }
    }
  })
  const node = flow.stageCanvases['interaction-lofi'].nodes.find((item) => item.title === '登录页 Sign In')

  assert.ok(node.pageLayoutArtifact)
  assert.equal(node.pageLayoutArtifact.title, '页面骨架')
  assert.match(node.pageLayoutArtifact.asciiWireframe, /登录页 Sign In/)
  assert.match(node.pageLayoutArtifact.asciiWireframe, /顶部/)
  assert.match(node.pageLayoutArtifact.asciiWireframe, /滚动/)
  assert.match(node.content.join('\n'), /页面骨架已生成/)
})

test('total design flow keeps generic homepage feature wireframes out of tea ordering templates', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加一个功能，增加几个快捷输入提示词的功能',
    documents: [
      {
        name: '项目知识库：Podcastor.ai 首页创作入口页面结构',
        text: '首页包含 Turn Your Ideas Into Podcasts 标题、Generate Script / Upload Script / Upload Audio Podcast 三段式 Tab、创作输入框、上传入口和生成按钮。'
      }
    ]
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'home-prompt-shortcuts', title: '首页快捷提示词展示', goal: '让用户在首页快速选择常见输入提示词。' }
          ],
          pages: [
            {
              id: 'home',
              sliceId: 'home-prompt-shortcuts',
              title: '首页',
              summary: '在主输入区附近展示快捷提示词入口。',
              detailSections: [
                { title: '页面目标', items: ['在首页创作输入框附近展示快捷提示词按钮。'] },
                { title: '核心模块', items: ['创作输入框', '快捷提示词按钮组', '上传入口', '生成按钮'] },
                { title: '用户点击动作', items: ['点击提示词后填充输入框', '继续编辑输入内容', '点击生成按钮'] }
              ]
            }
          ]
        }
      }
    }
  })

  const node = flow.stageCanvases['interaction-lofi'].nodes.find((item) => item.title === '首页')
  const wireframe = node?.pageLayoutArtifact?.asciiWireframe || ''
  const content = node?.content?.join('\n') || ''

  assert.match(wireframe, /快捷提示词按钮组/)
  assert.match(content, /快捷提示词|创作输入框/)
  assert.doesNotMatch(wireframe, /门店|自提|外卖|取餐|热销商品|限时秒杀/)
  assert.doesNotMatch(content, /门店选择|自提|外卖/)
})

test('total design flow grounds sparse Jogg homepage wireframes in project evidence', () => {
  const joggEvidence = [
    'Jogg 高级编辑器首页需要保留 Home、Tools、Studio、Voice、Projects 全局入口。',
    '首页生成入口承接 Tools 生成，Studio 负责编辑渲染，Voice 负责音色配置，Projects 负责项目管理。',
    'Media 模块支持 My Media、Stock、AI Generate 三个素材区。',
    'My Media 支持 Upload、Capture Screen、Search from Space；Stock 支持 Pexels/Pixabay；AI Generate 支持 Image/Video 生成。'
  ].join('\n')
  const baseAnalysis = analyzeRequirementDocuments({
    demandScope: 'project',
    skillSelectionMode: 'manual',
    skillId: 'none',
    input: 'Jogg 项目首页生成结果要跟项目首页一致，不要给通用首页壳。',
    documents: [
      {
        name: 'Jogg 核心用户流程',
        text: joggEvidence
      }
    ]
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'jogg-home', title: 'Jogg 首页与创作入口', goal: '让用户从首页进入生成、编辑、音色和项目管理。' }
          ],
          pages: [
            {
              id: 'home',
              sliceId: 'jogg-home',
              title: '首页',
              summary: 'Jogg 首页生成入口和工作台。'
            }
          ]
        }
      }
    }
  })

  const node = flow.stageCanvases['interaction-lofi'].nodes.find((item) => item.title === '首页')
  const wireframe = node?.pageLayoutArtifact?.asciiWireframe || ''

  assert.match(wireframe, /Jogg/)
  assert.match(wireframe, /Home|Tools|Studio|Voice|Projects/)
  assert.match(wireframe, /My Media|Stock|AI Generate/)
  assert.doesNotMatch(wireframe, /内容类型待确认|建议补/)
  assert.doesNotMatch(wireframe, /模块1：首屏主任务区|产品导航\s+账号入口/)
  assert.doesNotMatch(wireframe, /门店|自提|外卖|点单|购物车|订单/)
})

test('total design flow turns local feature optimization docs into control-level lofi pages', () => {
  const docText = [
    'Podcastor造人画面比例问题优化',
    '增强顶部画面比例的按钮样式',
    'Speaker Focus、Cartoon、Pet - Generate From Reference',
    '增加生成的画面比例选项，同一个背景图支持配置不同的画面比例素材',
    '如果最终生成的数字人画面比例与当前tab的画面比例不匹配，需要切到对应的画面比例下展示正在生成中的数字人',
    'Speaker Focus、Cartoon、Pet - Use your Photo',
    '下方增加生成的数字人画面比例参数，默认为当前tab的画面比例数值',
    'Split Screen、Solo（AI Host、Cartoon、Pet）- AI generate host',
    '生图的下方增加生成的画面比例（16:9/9:16），默认为当前tab的画面比例数值',
    'Split Screen、Solo（AI Host、Cartoon、Pet）- Photo to Host',
    '图片上传后，画框中出现符合当前生成画面比例的虚线画框，替换掉点击右上角的裁剪，可以直接在画框中框选'
  ].join('\n')
  const baseAnalysis = analyzeRequirementDocuments({
    demandScope: 'project',
    skillSelectionMode: 'manual',
    skillId: 'none',
    input: docText,
    documents: [
      { name: 'Podcastor造人画面比例问题优化.docx', text: docText },
      {
        id: 'project-knowledge-avatar-types',
        name: '项目知识库：avatar 页面结构',
        type: 'knowledge',
        sourceType: 'project-package',
        knowledgeMaterialId: 'material-5ae5dc7e2f84e45c',
        text: 'AIGC Avatar 入口到后端接口共用的头像类型：default / pet / cartoon，对应 AI Host、Pet Host、Cartoon Host。'
      },
      {
        id: 'project-knowledge-ai-hosts',
        name: '项目知识库：AI Hosts That Bring Your Show to Life',
        type: 'knowledge',
        sourceType: 'website',
        knowledgeMaterialId: 'material-d663681e83d631c1',
        text: 'Choose a digital human, cartoon, or pet avatar depending on your content.'
      },
      {
        id: 'project-knowledge-generator-screenshot',
        name: '知识库：流程图 · jogg-workflow-knowledge-import 交互 Demo',
        type: 'knowledge',
        sourceType: 'project-knowledge-flow',
        knowledgeMaterialId: 'asset-0361fd9d16b42cfd',
        screenshotUrl: '/api/workspace/material-previews/asset-0361fd9d16b42cfd-tool-ai-video-podcast-generator-0b3b94f94e85.jpg',
        text: '页面/状态：AI Video Podcast Generator；截图：/api/workspace/material-previews/asset-0361fd9d16b42cfd-tool-ai-video-podcast-generator-0b3b94f94e85.jpg；热区：Generate podcast -> studio-talk-show'
      }
    ]
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'slice-1', title: '造人比例选择', goal: '统一顶部比例 tab 与生成比例参数的默认、修改和提交规则。' },
            { id: 'slice-2', title: '多比例素材配置', goal: '支持同一个背景图按不同画面比例配置和读取素材。' },
            { id: 'slice-3', title: '上传图片框选', goal: '上传后用比例虚线框替代旧裁剪入口。' }
          ],
          pages: [
            { id: 'p1', title: '造人顶部比例切换区', summary: '展示并切换 16:9、9:16 等比例 tab。' },
            { id: 'p2', title: '参考图生成入口', summary: '同一背景图支持不同画面比例素材配置。' },
            { id: 'p3', title: '照片生成入口', summary: '下方增加生成数字人比例参数。' },
            { id: 'p4', title: 'AI 生成主播入口', summary: 'Split Screen 与 Solo 生图下方增加比例选项。' },
            { id: 'p5', title: '照片转主播裁剪区', summary: '上传后按目标比例在画框内直接框选。' }
          ]
        }
      }
    }
  })

  const nodes = flow.stageCanvases['interaction-lofi'].nodes
  const text = JSON.stringify(nodes)
  const wireframes = nodes.map((node) => node.pageLayoutArtifact?.asciiWireframe || '')
  const uniqueWireframes = new Set(wireframes.map((wireframe) => wireframe.replace(/^.*?页面框架\n/, '').slice(0, 600)))

  assert.notEqual(baseAnalysis.blueprint?.intent, 'auth-page')
  assert.ok(uniqueWireframes.size >= 4, 'local feature pages should not collapse to repeated generic wireframes')
  assert.match(text, /比例 tab|画面比例/)
  assert.match(text, /16:9/)
  assert.match(text, /9:16/)
  assert.match(text, /默认.*当前tab|当前tab.*默认/)
  assert.match(text, /actualAspectRatio|最终生成.*比例不匹配|自动切/)
  assert.match(text, /虚线画框|框选/)
  assert.match(text, /cropBox|裁剪框/)
  assert.match(text, /Speaker Focus|Cartoon|Pet/)
  assert.match(text, /Generate From Reference|Use your Photo|AI generate host|Photo to Host/)
  assert.ok(nodes.every((node) => node.pageLayoutArtifact?.layoutType || node.pageLayoutArtifact?.layout?.layoutType || node.pageLayoutArtifact?.screenContract?.layoutStrategy?.archetype))
  assert.ok(nodes.every((node) => node.interactionSpecArtifact?.interactionRows?.some((row) => /比例|裁剪|框选|生成/.test(`${row.target} ${row.operation}`))))
  assert.doesNotMatch(text, /内容类型待确认|建议补|按钮\/价格\/状态|宫格排列|卡片头部 可选区|卡片主体内容区/)
  const evidenceText = JSON.stringify(nodes.map((node) => node.pageLayoutArtifact?.evidenceRefs || []))
  assert.match(evidenceText, /Podcastor造人画面比例问题优化/)
  assert.match(evidenceText, /项目知识库：avatar 页面结构|material-5ae5dc7e2f84e45c/)
  assert.match(evidenceText, /项目知识库：AI Hosts That Bring Your Show to Life|material-d663681e83d631c1/)
  assert.match(evidenceText, /asset-0361fd9d16b42cfd-tool-ai-video-podcast-generator/)
  assert.ok(nodes.some((node) => (node.pageLayoutArtifact?.evidenceRefs || []).some((ref) => ref.screenshotUrl || ref.imageUrl)), 'image evidence should remain structured, not only text')
  assert.doesNotMatch(wireframes.join('\n'), /图片依据|证据来源|依据：/)
  assert.match(evidenceText, /截图|screenshotUrl|imageUrl/)
})

test('strong Podcastor local feature docs override product-wide framework cards', () => {
  const docText = [
    'Podcastor造人画面比例问题优化',
    '增强顶部画面比例的按钮样式',
    '',
    'Speaker Focus、Cartoon、Pet - Generate From Reference',
    '增加生成的画面比例选项，同一个背景图支持配置不同的画面比例素材',
    '如果最终生成的数字人画面比例与当前tab的画面比例不匹配，需要切到对应的画面比例下展示正在生成中的数字人',
    '',
    'Speaker Focus、Cartoon、Pet - Use your Photo',
    '下方增加生成的数字人画面比例参数，默认为当前tab的画面比例数值',
    '如果最终生成的数字人画面比例与当前tab的画面比例不匹配，需要切到对应的画面比例下展示正在生成中的数字人',
    '',
    'Split Screen、Solo（AI Host、Cartoon、Pet）- AI generate host',
    '生图的下方增加生成的画面比例（16:9/9:16），默认为当前tab的画面比例数值',
    '如果最终生成的数字人画面比例与当前tab的画面比例不匹配，需要切到对应的画面比例下展示正在生成中的数字人',
    '',
    'Split Screen、Solo（AI Host、Cartoon、Pet）- Photo to Host',
    '生图的下方增加生成的画面比例（16:9/9:16），默认为当前tab的画面比例数值',
    '图片上传后，画框中出现符合当前生成画面比例的虚线画框，替换掉点击右上角的裁剪，可以直接在画框中框选',
    '如果最终生成的数字人画面比例与当前tab的画面比例不匹配，需要切到对应的画面比例下展示正在生成中的数字人'
  ].join('\n')
  const analysis = analyzeRequirementDocuments({
    demandScope: 'project',
    skillSelectionMode: 'manual',
    skillId: 'total-design-flow',
    input: `【上传文档：Podcastor造人画面比例问题优化.docx】\n${docText}`,
    documents: [
      { name: 'Podcastor造人画面比例问题优化.docx', type: 'docx', text: docText },
      {
        id: 'project-knowledge-generator-screenshot',
        name: '图片知识库：Jogg 实测完整点击链路 Demo',
        type: 'knowledge',
        sourceType: 'project-image-evidence',
        knowledgeMaterialId: 'asset-jogg-runtime-complete-click-path-20260705',
        screenshotUrl: '/api/workspace/material-previews/asset-jogg-runtime-complete-click-path-20260705-tools-ai-video-podcast-generator-5c79c394c367.jpg',
        text: '页面：AI Video Podcast Generator；截图：/api/workspace/material-previews/asset-jogg-runtime-complete-click-path-20260705-tools-ai-video-podcast-generator-5c79c394c367.jpg；热区：Speaker Focus / Cartoon / Pet / Generate From Reference / Use your Photo / Photo to Host'
      }
    ]
  })
  const flow = buildTotalDesignFlow(analysis)
  const nodes = flow.stageCanvases['interaction-lofi'].nodes
  const titles = nodes.map((node) => node.title)
  const allText = JSON.stringify({ slices: flow.requirementSlices, nodes })
  const uniqueWireframes = new Set(nodes.map((node) => (node.pageLayoutArtifact?.asciiWireframe || '').replace(/^.*?页面框架\n/, '').slice(0, 700)))

  assert.equal(analysis.detectedIntent, 'requirement-analysis')
  assert.ok(nodes.length >= 4 && nodes.length <= 6, `expected local feature page count, got ${nodes.length}: ${titles.join('、')}`)
  assert.ok(titles.some((title) => /比例|顶部/.test(title)))
  assert.ok(titles.some((title) => /参考图|Reference/.test(title)))
  assert.ok(titles.some((title) => /照片|Photo/.test(title)))
  assert.ok(titles.some((title) => /裁剪|框选|上传/.test(title)))
  assert.ok(uniqueWireframes.size >= 4, 'local feature cards should not collapse to repeated framework cards')
  assert.match(allText, /16:9/)
  assert.match(allText, /9:16/)
  assert.match(allText, /actualAspectRatio/)
  assert.match(allText, /cropBox|虚线画框|框选/)
  assert.match(JSON.stringify(nodes.map((node) => node.pageLayoutArtifact?.evidenceRefs || [])), /截图|screenshotUrl|imageUrl/)
  assert.doesNotMatch(nodes.map((node) => node.pageLayoutArtifact?.asciiWireframe || '').join('\n'), /图片依据|证据来源|依据：/)
  assert.doesNotMatch(titles.join('\n'), /文档分析结果|页面需求报告|页面档案|页面结构树|接口契约|前后端交接|可交互 Demo|验收清单|产品分析报告|产品结构树|完整 HTML|Figma 文件|Vue 页面/)
  assert.doesNotMatch(JSON.stringify(flow.requirementSlices), /首页与创作入口|脚本生成流程|音频播客生成流程|登录注册与商业化|管理端与平台分发/)
  assert.doesNotMatch(allText, /内容类型待确认|建议补|按钮\/价格\/状态|宫格排列|卡片头部 可选区|卡片主体内容区|05:00/)
})

test('total design flow keeps selected knowledge scope as focused feature evidence', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加一个功能，增加几个快捷输入提示词的功能',
    documents: [
      {
        name: '框选功能：Podcastor.ai 首页创作入口',
        type: 'knowledge',
        sourceType: 'selected-knowledge-scope',
        content: [
          '当前框选功能：PodcastStep1 首页创作入口。',
          '页面包含 Turn Your Ideas Into Podcasts、Generate Script / Upload Script / Upload Audio、主输入框、Try Sample、参数栏和 Next。',
          'Next 沿用 checkOpenGuestLoginDialog 与 createPodcastVideoTask，成功后进入 Studio。',
          '本次只在 Generate Script 输入区增加快捷提示词，不扩展全量 Podcastor 产品结构。'
        ].join('\n')
      },
      {
        name: '项目知识库：Podcastor.ai v1.0 产品总览',
        type: 'knowledge',
        sourceType: 'project-knowledge',
        content: [
          '定位：零门槛 AI 播客工作站。',
          '核心功能：脚本生成、音频播客生成、视频播客制作、声音库、项目库、分发。'
        ].join('\n')
      }
    ]
  })
  const flow = buildTotalDesignFlow(analysis)
  const sliceTitles = flow.requirementSlices.map((slice) => slice.title)
  const pageText = JSON.stringify(flow.stageCanvases['interaction-lofi'].nodes)

  assert.ok(sliceTitles.includes('首页快捷提示词展示'))
  assert.ok(sliceTitles.includes('登录/提交链路兼容'))
  assert.ok(sliceTitles.length <= 3)
  assert.doesNotMatch(sliceTitles.join('\n'), /音频播客生成流程|视频播客制作流程|主持人\/音色|短视频切片|管理端/)
  assert.match(pageText, /PodcastStep1|Generate Script|Next|Studio|快捷提示词/)
  assert.doesNotMatch(pageText, /门店|自提|外卖|热销商品|购物车/)
})

test('total design flow ignores removed model generated preparation stage canvases', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          stageCanvases: {
            'requirement-slicing': {
              nodes: [
                {
                  id: 'requirement-slicing-agent',
                  title: '小需求切片',
                  summary: '模型判断：茶饮需求应先作为一个主流程切片，再按页面节点拆低保。',
                  content: ['切片：茶饮点单主流程', '边界：会员优惠属于主流程内能力，不单独拆分。'],
                  detailSections: [
                    { title: '模型切片依据', items: ['输入围绕同一条下单闭环，没有出现多个独立业务模块。'] }
                  ]
                }
              ]
            }
          }
        }
      }
    }
  })
  assert.equal(flow.stageCanvases['requirement-slicing'], undefined)
  assert.equal(flow.stageCanvases['gap-confirmation'], undefined)
  assert.equal(flow.stageCanvases['requirement-dissection'].agentNode.id, 'requirement-dissection-agent')
})

test('total flow stage canvas default node positions do not trigger frontend collision drift', async () => {
  const serviceSource = await readFile(new URL('../backend/services/total-design-flow.js', import.meta.url), 'utf8')
  const stageNodeStart = serviceSource.indexOf('function stageCanvasNode')
  const stageNodeEnd = serviceSource.indexOf('function stageCanvasFromNodes', stageNodeStart)
  const stageNodeSource = serviceSource.slice(stageNodeStart, stageNodeEnd)
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const overlapStart = canvasSource.indexOf('function rectanglesOverlap')
  const overlapEnd = canvasSource.indexOf('function focusStage', overlapStart)
  const overlapSource = canvasSource.slice(overlapStart, overlapEnd)

  assert.match(overlapSource, /const gutter = 24/)
  assert.match(stageNodeSource, /width:\s*340/)
  assert.match(stageNodeSource, /x:\s*80 \+ \(index % 4\) \* 400/)
  assert.match(stageNodeSource, /y:\s*140 \+ Math\.floor\(index \/ 4\) \* 300/)
  assert.doesNotMatch(stageNodeSource, /x:\s*80 \+ index \* 360/)
  assert.doesNotMatch(stageNodeSource, /y:\s*index % 2 === 0 \? 140 : 360/)
})

test('total design flow model node normalization keeps section metadata once', async () => {
  const source = await readFile(new URL('../backend/services/total-design-flow.js', import.meta.url), 'utf8')
  const normalizerSource = source.slice(
    source.indexOf('function normalizeModelStageNode'),
    source.indexOf('function modelStageNodeMap')
  )
  const metaMatches = normalizerSource.match(/meta:\s*section\.meta \|\| ''/g) || []

  assert.equal(metaMatches.length, 1)
})

test('total design flow maps model page details by title and keeps per-page fullscreen content distinct', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，包含取餐方式和制作取餐通知。',
    documents: []
  })
  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                {
                  title: '取餐方式',
                  summary: '模型判断：取餐方式页用于选择自取/外送并确认门店可用时段。',
                  content: ['自取：显示门店地址和预计制作时间。', '外送：要求填写地址并校验配送范围。'],
                  detailSections: [
                    { title: '页面目标', items: ['让用户在下单前明确自取或外送。'] },
                    { title: '跳转到哪个页面', items: ['确认后进入菜单与商品。'] }
                  ]
                },
                {
                  title: '制作与取餐通知',
                  summary: '模型判断：制作与取餐通知页负责展示制作进度和取餐码。',
                  content: ['制作中：展示进度条。', '可取餐：展示取餐码和柜台提示。'],
                  detailSections: [
                    { title: '页面目标', items: ['让用户知道何时取餐以及凭什么取餐。'] },
                    { title: '状态覆盖', items: ['制作中、已完成、通知失败、订单取消。'] }
                  ]
                }
              ]
            }
          }
        }
      }
    }
  })
  const pickupNode = flow.stageCanvases['interaction-lofi'].nodes.find((node) => node.title === '取餐方式')
  const notifyNode = flow.stageCanvases['interaction-lofi'].nodes.find((node) => node.title === '制作与取餐通知')

  assert.equal(pickupNode.contentSource, 'model-generated')
  assert.equal(notifyNode.contentSource, 'model-generated')
  assert.match(pickupNode.summary, /自取\/外送/)
  assert.match(notifyNode.summary, /取餐码/)
  assert.match(pickupNode.content.join('\n'), /配送范围/)
  assert.match(notifyNode.content.join('\n'), /进度条/)
  assert.notDeepEqual(pickupNode.detailSections, notifyNode.detailSections)
})

test('total design flow runs model generation for repeated demand analysis instead of reusing template fallback', async () => {
  const documentParserSource = await readFile(new URL('../backend/services/document-parser.js', import.meta.url), 'utf8')
  const promptBuilderSource = await readFile(new URL('../backend/services/prompt-builder.js', import.meta.url), 'utf8')
  const shouldRunGenerationSource = documentParserSource.slice(
    documentParserSource.indexOf('const shouldRunGeneration ='),
    documentParserSource.indexOf('const generation = shouldRunGeneration')
  )
  const asyncGenerationGateSource = documentParserSource.slice(
    documentParserSource.indexOf("if (!provider || !['none'"),
    documentParserSource.indexOf('const input = [', documentParserSource.indexOf("if (!provider || !['none'"))
  )

  assert.match(shouldRunGenerationSource, /total-design-flow/)
  assert.match(asyncGenerationGateSource, /total-design-flow/)
  assert.match(promptBuilderSource, /node\.id、node\.title 或 node\.sourcePageId/)
  assert.doesNotMatch(promptBuilderSource, /node\.id 必须匹配阶段固定节点 id/)
})

test('smart canvas schema and prompt support total flow stage canvas output', () => {
  const validation = validateSkillOutput('smart-canvas', {
    intent: 'requirement-analysis',
    qualityReport: { passed: true, checks: [] },
    totalDesignFlow: {
      stageCanvases: {
        'requirement-dissection': {
          nodes: [
            {
              id: 'requirement-source',
              summary: '模型生成的原始需求拆解',
              content: ['模型内容'],
              detailSections: [{ title: '依据', items: ['输入内容'] }]
            }
          ]
        }
      }
    }
  })
  const prompt = buildSkillPrompt({
    skill: getSkillDefinition('smart-recommendation-skill'),
    input: '做一个茶饮小程序',
    demandScope: 'project'
  })

  assert.equal(validation.ok, true)
  assert.match(prompt.systemPrompt, /totalDesignFlow\.stageCanvases/)
  assert.match(prompt.systemPrompt, /totalDesignFlow\.requirementSlices/)
  assert.match(prompt.systemPrompt, /totalDesignFlow\.pages/)
  assert.match(prompt.systemPrompt, /页面目标、页面核心模块、用户点击动作、跳转到哪个页面/)
  assert.match(prompt.systemPrompt, /requirement-dissection/)
  assert.match(prompt.systemPrompt, /requirement-dissection、interaction-lofi、ui-visual、html-output、vue-output、acceptance-deposit/)
  assert.match(prompt.systemPrompt, /需求分析阶段保持 Agent 工作台/)
  assert.match(prompt.systemPrompt, /后续阶段允许根据需求自定义 nodes/)
  assert.doesNotMatch(prompt.systemPrompt, /只填充每个节点的模型分析内容/)
  assert.doesNotMatch(prompt.systemPrompt, /保留系统固定阶段和节点 id/)
  assert.doesNotMatch(prompt.systemPrompt, /总流程阶段 id 包括[\s\S]*wireframe-preview/)
})

test('total design flow prompt asks for compact first canvas json instead of full stage canvases', () => {
  const prompt = buildSkillPrompt({
    skill: getSkillDefinition('smart-recommendation-skill'),
    skillId: 'total-design-flow',
    input: '做一个茶饮小程序，需要点单、会员、优惠券和取餐进度。',
    demandScope: 'project'
  })

  assert.equal(prompt.responseSchema, 'smart-canvas')
  assert.equal(prompt.maxOutputTokens, 3200)
  assert.match(prompt.systemPrompt, /总流程后台画布生成/)
  assert.match(prompt.systemPrompt, /首屏紧凑 JSON/)
  assert.match(prompt.systemPrompt, /不要返回完整 totalDesignFlow\.stageCanvases/)
  assert.match(prompt.systemPrompt, /由后端 buildTotalDesignFlow/)
  assert.match(prompt.systemPrompt, /最多 4 个 groups/)
  assert.match(prompt.systemPrompt, /合计最多 8 个 nodes/)
  assert.doesNotMatch(prompt.systemPrompt, /返回 totalDesignFlow\.stageCanvases，key 为阶段 id/)
  assert.doesNotMatch(prompt.systemPrompt, /totalDesignFlow\.stageCanvases\[\]\.nodes/)
})

test('total design flow slices Podcastor product documents into multiple requirements', () => {
  const podcastorText = [
    'Podcastor.ai v1.0产品文档',
    '定位：零门槛的AI播客工作站',
    '核心功能一：灵感与脚本创作，支持文本提示词、URL网页链接、上传PDF/PPT。',
    '核心功能二：音频播客创作，提供多语言 TTS 声音库。',
    '核心功能三：视频播客制作，支持真人、卡通、宠物播客主持人。',
    '用户资产：脚本&灵感库、音色&音频资产库、播客主播库。',
    '基础能力：注册/登录、商业化、作品生成&存储&调用、分发能力。'
  ].join('\n')
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '请基于 Podcastor.ai v1.0 产品文档做设计方案分析。',
    documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', type: 'docx', content: podcastorText }]
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const sliceTitles = totalFlow.requirementSlices.map((slice) => slice.title)

  assert.notEqual(analysis.detectedIntent, 'auth-modal')
  assert.notEqual(analysis.detectedIntent, 'auth-page')
  assert.ok(sliceTitles.includes('首页与创作入口'))
  assert.ok(sliceTitles.includes('脚本生成流程'))
  assert.ok(sliceTitles.includes('音频播客生成流程'))
  assert.ok(sliceTitles.includes('视频播客制作流程'))
  assert.ok(sliceTitles.includes('登录注册与商业化'))
  assert.ok(totalFlow.requirementSlices.every((slice) => slice.sourceExcerpt))
})

test('document analysis includes total design flow and preserves product-document intent before auth keywords', () => {
  const podcastorText = [
    'Podcastor.ai v1.0产品文档',
    '定位：零门槛的AI播客工作站',
    '基础能力：注册/登录、商业化（Stripe、PayPal）、作品生成&存储&调用。',
    '核心功能：脚本生成、音频播客生成、视频播客生成。'
  ].join('\n')
  const result = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '请基于 Podcastor.ai v1.0 产品文档做设计方案分析。',
    documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', type: 'docx', content: podcastorText }]
  })

  assert.equal(result.detectedIntent, 'podcastor-product')
  assert.ok(result.totalDesignFlow)
  assert.ok(result.totalDesignFlow.requirementSlices.length >= 5)
  assert.ok(result.totalDesignFlow.requirementSlices.map((slice) => slice.title).includes('登录注册与商业化'))
})

test('total flow default tea analysis exposes page-level tea ordering navigation', () => {
  const result = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，包含首页选店、取餐方式、菜单商品、商品定制、购物车结算、支付下单、取餐通知、会员优惠、订单状态。',
    documents: []
  })

  assert.equal(result.totalDesignFlow.requirementSlices[0].title, '茶饮点单主流程')
  assert.deepEqual(result.totalDesignFlow.pages.map((page) => page.title), [
    '首页与选店',
    '取餐方式',
    '菜单与商品',
    '商品定制',
    '购物车与结算',
    '支付与订单生成',
    '制作与取餐通知',
    '会员与优惠',
    '前后端与验收'
  ])
})

test('requirement dissection competitive reference stays useful without explicit competitors', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'total-design-flow',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '想针对 AI 播客产品首页进行改版，有更好的方案吗',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const competitive = totalFlow.requirementDissectionArtifact.competitiveAnalysis
  const competitiveCard = totalFlow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'design-opportunity')

  assert.equal(competitive.referenceMode, 'industry-assumption')
  assert.equal(competitive.evidenceStatus, 'needs-user-or-search-evidence')
  assert.match(competitive.evidenceNotice, /未识别到明确竞品名称、链接或截图/)
  assert.ok(competitive.nextActions.includes('让 Agent 找 3 个竞品'))
  assert.ok(competitive.nextActions.includes('上传竞品截图/链接'))
  assert.ok(competitive.nextActions.includes('从知识库选择参考'))
  assert.ok(competitive.researchSearchDirections.some((item) => /AI 播客|podcast|homepage|首页/i.test(item)))
  assert.ok(competitive.comparisonDimensions.includes('首屏入口'))
  assert.ok(competitive.comparisonDimensions.includes('状态反馈'))
  assert.ok(competitiveCard.content.some((item) => /证据状态|竞品|设计机会/.test(item)))
  assert.ok(competitiveCard.detailBlocks?.some((block) => block.sourceRef === 'competitiveAnalysis'), 'design opportunities tab should reference competitive analysis without creating a separate card')
  assert.ok(competitiveCard.quickActions.includes('让 Agent 找 3 个竞品'))
  assert.doesNotMatch(JSON.stringify(competitive.referenceProducts), /Descript|Riverside|Podcastle|NotebookLM/)
})

test('dialogue skill starts agent-only without initial canvas generation', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const workbenchSource = await readFile(new URL('../frontend/src/services/workflowWorkbench.js', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const startSource = appSource.slice(
    appSource.indexOf('async function startDialogueSkillAgent'),
    appSource.indexOf('function createUxConfirmationCanvas')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )
  const handleSource = appSource.slice(
    appSource.indexOf('function handleWorkflowPrimaryAction'),
    appSource.indexOf('function createDialogueSkill')
  )

  assert.match(handleSource, /isDialogueSkillSelected\.value/)
  assert.match(handleSource, /startDialogueSkillAgent/)
  assert.match(startSource, /skillId:\s*'dialogue-skill'/)
  assert.match(startSource, /status:\s*'chatting'/)
  assert.match(startSource, /documentAnalysis:\s*null/)
  assert.match(startSource, /agentSessions:\s*\{\s*'dialogue-agent'/)
  assert.match(startSource, /showWorkflowAgentSidebar\(\)/)
  assert.doesNotMatch(startSource, /createUxConfirmationCanvas/)
  assert.doesNotMatch(startSource, /analyzeDocumentsStream/)
  assert.match(appSource, /function dialogueSkillRawPrompt/)
  assert.match(startSource, /await sendWorkflowAgentMessage\(dialogueSkillRawPrompt\(workflowEntrySnapshot\.input\)/)
  assert.match(startSource, /agentQuickReplies:\s*\{\s*'dialogue-agent':\s*\['生成方案画布',\s*'转 UX 设计确认'\]/)
  assert.match(workbenchSource, /run\.skillId === 'dialogue-skill'/)
  assert.match(workbenchSource, /\['生成方案画布',\s*'转 UX 设计确认'\]/)
  assert.match(drawerSource, /props\.session\?\.skillId === 'dialogue-skill'/)
  assert.match(drawerSource, /像普通聊天一样输入完整问题/)
  assert.doesNotMatch(sendSource, /isDialogueSkillRun/)
  assert.doesNotMatch(sendSource, /usesDialogueStyleAgent/)
  assert.match(sendSource, /await retrieveWorkflowKnowledge\(content,\s*contextNodeId \|\| targetScopeId\)/)
  assert.doesNotMatch(sendSource, /skipKnowledgeRetrieval/)
  assert.match(sendSource, /正在检索项目知识与当前节点上下文/)
  assert.doesNotMatch(appSource, /event\.type === 'trace'\) return/)
  assert.match(appSource, /function normalizeDialogueSkillReplyText/)
  assert.match(appSource, /parsed\.reply/)
  assert.match(appSource, /function openDialogueSkillRecord\(run = \{\}\)/)
  assert.match(appSource, /workflowAgentNodeId\.value = 'dialogue-agent'/)
  assert.doesNotMatch(appSource, /workflowAgentOpen\.value = true/)
  assert.match(appSource, /function setWorkflowAgentDisplayMode\(mode = 'sidebar'\)/)
  assert.match(appSource, /openWorkflowAnalysisRecord\(runId\)[\s\S]*isDialogueSkillRecord\(run\)[\s\S]*openDialogueSkillRecord\(run\)/)
  assert.doesNotMatch(startSource, /dialogueSkillInitialPrompt/)
  assert.doesNotMatch(startSource, /当前理解/)
  assert.doesNotMatch(startSource, /请先输出/)
  assert.doesNotMatch(workbenchSource, /dialogue-skill'[\s\S]{0,240}使用示例生成/)
})

test('workflow entry document attachments are snapshotted then cleared for the next analysis', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const dialogueStartSource = appSource.slice(
    appSource.indexOf('async function startDialogueSkillAgent'),
    appSource.indexOf('function dialogueSkillAssistantCanvasText')
  )
  const uxStartSource = appSource.slice(
    appSource.indexOf('async function startUxDesignConfirmationAgent'),
    appSource.indexOf('async function analyzeWorkflowDocuments')
  )
  const analyzeSource = appSource.slice(
    appSource.indexOf('async function analyzeWorkflowDocuments'),
    appSource.indexOf('function workflowAgentKnowledgeProjectId')
  )

  assert.match(appSource, /function workflowEntryPayloadSnapshot\(\)/)
  assert.match(appSource, /function clearWorkflowEntryDocumentsAfterRun\(snapshot = \{\}\)/)
  for (const source of [dialogueStartSource, uxStartSource, analyzeSource]) {
    assert.match(source, /const workflowEntrySnapshot = workflowEntryPayloadSnapshot\(\)/)
    assert.match(source, /clearWorkflowEntryDocumentsAfterRun\(workflowEntrySnapshot\)/)
  }
  assert.match(dialogueStartSource, /referenceFiles:\s*\{[\s\S]*'dialogue-agent': workflowEntrySnapshot\.documents/)
  assert.match(dialogueStartSource, /dialogueSkillRawPrompt\(workflowEntrySnapshot\.input\)/)
  assert.match(uxStartSource, /referenceFiles:\s*\{[\s\S]*'requirement-clarification': workflowEntrySnapshot\.documents/)
  assert.match(uxStartSource, /uxConfirmationInitialAnalysisPrompt\(workflowEntrySnapshot\.input\)/)
  assert.match(analyzeSource, /pendingRun\.referenceFiles\[pendingRun\.currentStepId\] = workflowEntrySnapshot\.documents/)
  assert.match(analyzeSource, /documents:\s*\[\s*\.\.\.workflowEntrySnapshot\.documents\.map/)
  assert.match(analyzeSource, /\.\.\.\(persistedPendingRun\.demandScope === 'project' \? knowledgeContextDocuments : \[\]\)/)
})

test('dialogue skill can convert completed chat into page canvas with pure content detail frame', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const dialogueSource = appSource.slice(
    appSource.indexOf('function createDialogueSkillPageCanvas'),
    appSource.indexOf('function createUxConfirmationCanvas')
  )
  const useReplySource = appSource.slice(
    appSource.indexOf('function useWorkflowAgentQuickReply'),
    appSource.indexOf('async function copyWorkflowAgentMessage')
  )
  const pureFrameStyle = styleSource.slice(
    styleSource.indexOf('.canvas-fullscreen-content .canvas-pure-content-frame'),
    styleSource.indexOf('.canvas-fullscreen-content .canvas-detail-tree')
  )

  assert.match(dialogueSource, /function createDialogueSkillPageCanvas/)
  assert.match(dialogueSource, /mode:\s*'dialogue-page'/)
  assert.match(dialogueSource, /pureContent:/)
  assert.match(dialogueSource, /if \(!dialogueSkillAssistantCanvasText\(messages\)\)/)
  assert.match(appSource, /function dialogueSkillAssistantCanvasText/)
  assert.match(appSource, /function extractDialogueSkillPageContent/)
  assert.match(appSource, /function extractDialogueSkillJsonCanvasPages/)
  assert.match(appSource, /parsed\['主路径顺序'\]/)
  assert.match(appSource, /dialogue-skill-canvas-content/)
  assert.match(appSource, /页面目标\[:：\]\[\\s\\S\]\*核心模块/)
  assert.match(dialogueSource, /orderedTabs:/)
  assert.match(dialogueSource, /edges:/)
  assert.match(useReplySource, /state\.activeWorkflowRun\?\.skillId === 'dialogue-skill'/)
  assert.match(dialogueSource, /dialogueSkillCanvasGenerationPrompt/)
  assert.match(useReplySource, /createDialogueSkillPageCanvasFromChat/)
  assert.match(useReplySource, /transferDialogueSkillToUxConfirmation/)
  assert.match(dialogueSource, /await sendWorkflowAgentMessage\(dialogueSkillCanvasGenerationPrompt\(\),\s*\{[\s\S]*action:\s*'dialogue-skill-canvas-content'[\s\S]*\}\)[\s\S]*activeRun = state\.activeWorkflowRun[\s\S]*messages = Array\.isArray\(activeRun\?\.agentSessions\?\.\['dialogue-agent'\]\)/)
  assert.match(dialogueSource, /workflowRoute\.value = 'canvas'[\s\S]*workflowCanvasLoading\.value = true[\s\S]*workflowAgentNodeId\.value = 'dialogue-agent'/)
  assert.match(dialogueSource, /const sourceRun = activeRun \|\| \{\}/)
  assert.match(dialogueSource, /id:\s*`dialogue-canvas-\$\{analysisRequestId\}`/)
  assert.match(dialogueSource, /sourceDialogueRunId:\s*sourceRun\.id \|\| ''/)
  assert.match(dialogueSource, /sourceWorkflowRunId:\s*sourceRun\.id \|\| ''/)
  assert.match(dialogueSource, /openWorkflowAnalysisTab\(persistedRun\.id\)/)
  assert.doesNotMatch(dialogueSource, /\.\.\.\(activeRun \|\| \{\}\),[\s\S]*workflowId:\s*'dialogue-skill'/)
  assert.match(useReplySource, /void createDialogueSkillPageCanvasFromChat\(\{ requireCanvasText:\s*true \}\)/)
  assert.doesNotMatch(useReplySource, /void sendWorkflowAgentMessage\(dialogueSkillCanvasGenerationPrompt\(\)/)
  assert.match(appSource, /async function transferDialogueSkillToUxConfirmation/)
  assert.match(appSource, /dialogueSkillTransferSummary/)
  assert.match(appSource, /createUxConfirmationCanvas\(transferInput,\s*\{\s*sourceContext:\s*transferInput\s*\}\)/)
  assert.match(appSource, /sourceContext:\s*normalizedSourceContext/)
  assert.match(appSource, /skillId:\s*'ux-design-confirmation-skill'/)
  assert.match(appSource, /sourceDialogueRunId:\s*sourceRun\.id/)
  assert.match(appSource, /openWorkflowAnalysisTab\(persistedRun\.id\)/)
  assert.match(appSource, /uxConfirmationInitialAnalysisPrompt\(transferInput\)/)
  assert.match(drawerSource, /function isDialogueSkillTransferReply/)
  assert.match(drawerSource, /if \(isDialogueSkillTransferReply\(reply\)\) return false/)
  assert.match(appSource, /skipTypewriter/)
  assert.match(appSource, /assistantMessage\.meta\?\.action === 'dialogue-skill-canvas-content'/)
  assert.match(useReplySource, /void sendWorkflowAgentMessage\(normalizedContent, \{ ignoreDraftState: true \}\)/)
  assert.doesNotMatch(useReplySource, /const mappedContent = content === '整理页面'/)
  assert.match(canvasSource, /canvas-pure-content-frame/)
  assert.match(canvasSource, /v-if="isPureContentNode\(fullscreenNode\)"/)
  assert.match(canvasSource, /agentConfirmationContextText\(fullscreenNode\)/)
  assert.match(canvasSource, /对话上下文/)
  assert.match(canvasSource, /来自对话 Skill 的完整输出/)
  assert.doesNotMatch(pureFrameStyle, /height:\s*320px/)
  assert.match(pureFrameStyle, /overflow:\s*visible/)
})

test('workflow canvas toolbar can rerun current canvas through other skill analysis', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const transferContextStart = appSource.indexOf('function workflowCanvasTransferContext')
  const transferContextEnd = appSource.indexOf('const workflowLoadingTabs', transferContextStart)
  const transferContextSource = appSource.slice(transferContextStart, transferContextEnd)
  const confirmStart = appSource.indexOf('async function confirmWorkflowCanvasSkillTransfer')
  const confirmEnd = appSource.indexOf('async function startUxDesignConfirmationAgent', confirmStart)
  const confirmSource = appSource.slice(confirmStart, confirmEnd)

  assert.match(canvasSource, /转其它 Skill 分析/)
  assert.match(canvasSource, /\$emit\('transfer-other-skill'\)/)
  assert.match(canvasSource, /defineEmits\(\[[\s\S]*'transfer-other-skill'[\s\S]*\]\)/)
  assert.match(appSource, /@transfer-other-skill="transferWorkflowCanvasToOtherSkillAnalysis"/)
  assert.match(appSource, /showWorkflowSkillTransferModal/)
  assert.match(appSource, /workflowSkillTransferForm/)
  assert.match(appSource, /确认转分析/)
  assert.match(appSource, /v-model="workflowSkillTransferForm\.selectedSkillId"/)
  assert.match(appSource, /function workflowCanvasTransferContext\(\)/)
  assert.match(appSource, /function transferWorkflowCanvasToOtherSkillAnalysis\(\)/)
  assert.match(appSource, /async function confirmWorkflowCanvasSkillTransfer\(\)/)
  assert.match(appSource, /workflowSkillTransferForm\.selectedSkillId = 'advanced-ux-requirement-analysis'/)
  assert.match(confirmSource, /workflowSkillTransferForm\.selectedSkillId \|\| 'auto'/)
  assert.match(transferContextSource, /上一份 Skill 画布完整内容/)
  assert.match(transferContextSource, /原分析记录 ID/)
  assert.match(transferContextSource, /原 Skill/)
  assert.match(transferContextSource, /当前画布节点完整内容/)
  assert.match(transferContextSource, /nodeLines\.join\('\\n\\n'\)/)
  assert.doesNotMatch(transferContextSource, /\.slice\(0,\s*12\)/)
  assert.doesNotMatch(transferContextSource, /\.slice\(0,\s*10\)/)
  assert.match(confirmSource, /const sourceRun = state\.activeWorkflowRun \|\| \{\}/)
  assert.match(confirmSource, /const targetSkillId = workflowSkillTransferForm\.selectedSkillId \|\| 'auto'/)
  assert.match(confirmSource, /const pendingRun = \{[\s\S]*sourceWorkflowRunId:\s*sourceRun\.id \|\| ''/)
  assert.match(confirmSource, /sourceSkillId:\s*sourceRun\.skillId \|\| workflowSkillRouting\.value\.resolvedSkillId \|\| ''/)
  assert.match(confirmSource, /transferSource:\s*\{[\s\S]*type:\s*'workflow-canvas-transfer'/)
  assert.match(confirmSource, /const selectedKnowledgeScopeDocuments = workflowSelectedKnowledgeScopeDocuments\(transferInputWithNotes, pendingRun\.projectId\)/)
  assert.match(confirmSource, /const knowledgeContextDocuments = workflowKnowledgeContextDocuments\(8, transferInputWithNotes, pendingRun\.projectId\)/)
  assert.match(confirmSource, /const analysisPayload = \{[\s\S]*skillSelectionMode:\s*targetSkillId === 'auto' \? 'auto' : 'manual'/)
  assert.match(confirmSource, /skillId:\s*targetSkillId/)
  assert.match(confirmSource, /const analysisPayload = \{[\s\S]*requestedSkillId:\s*targetSkillId/)
  assert.match(confirmSource, /input:\s*transferInputWithNotes/)
  assert.match(confirmSource, /documents:\s*pendingRun\.demandScope === 'project' \? \[\.\.\.selectedKnowledgeScopeDocuments, \.\.\.knowledgeContextDocuments\] : \[\]/)
  assert.match(confirmSource, /api\.uploads\.analyzeDocumentsStream/)
  assert.match(confirmSource, /openWorkflowAnalysisTab\(persistedPendingRun\.id\)/)
  assert.match(confirmSource, /api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*pendingRun\)/)
  assert.doesNotMatch(confirmSource, /workflowForm\.selectedWorkflowId =/)
  assert.doesNotMatch(confirmSource, /await analyzeWorkflowDocuments\(\)/)
})

test('workflow canvas transfer opens a new analysis without replacing the source page state', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const transferStart = appSource.indexOf('async function confirmWorkflowCanvasSkillTransfer')
  const transferEnd = appSource.indexOf('async function startUxDesignConfirmationAgent', transferStart)
  const transferSource = appSource.slice(transferStart, transferEnd)

  assert.match(appSource, /async function persistWorkflowAnalysisBackgroundRun/)
  assert.match(transferSource, /openWorkflowAnalysisTab\(persistedPendingRun\.id\)/)
  assert.match(transferSource, /let backgroundAnalysisResult =/)
  assert.match(transferSource, /persistWorkflowAnalysisBackgroundRun\(persistedPendingRun,\s*backgroundAnalysisResult/)
  assert.doesNotMatch(transferSource, /state\.activeWorkflowRun = persistedPendingRun/)
  assert.doesNotMatch(transferSource, /state\.activeWorkflowRun = nextRun/)
  assert.doesNotMatch(transferSource, /if \(isCurrentAnalysisRequest\(\)\) state\.activeWorkflowRun = persistedRun/)
  assert.doesNotMatch(transferSource, /workflowAnalysisResult\.value = buildWorkflowAnalysisProgressResult\(persistedPendingRun/)
  assert.doesNotMatch(transferSource, /workflowCanvasLoading\.value = true/)
})

test('workflow analysis deep link displays persisted progress while polling for final result', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const restoreStart = appSource.indexOf('function restoreWorkflowAnalysisFromUrl')
  const restoreEnd = appSource.indexOf('function returnToWorkflowEntry', restoreStart)
  const restoreSource = appSource.slice(restoreStart, restoreEnd)
  const loadStart = appSource.indexOf('async function loadWorkflowRunDetail')
  const loadEnd = appSource.indexOf('function failWorkflowAnalysisDeepLink', loadStart)
  const loadSource = appSource.slice(loadStart, loadEnd)

  assert.match(appSource, /function startWorkflowAnalysisBroadcastChannel/)
  assert.match(appSource, /restoreWorkflowDeepLinkFromCurrentHashSoon\(\)/)
  assert.match(appSource, /function startWorkflowAnalysisDeepLinkPolling\(runId\)/)
  assert.match(restoreSource, /const displayAnalysis = run\?\.status === 'analyzing'[\s\S]*workflowDisplayAnalysisForAnalyzingRun\(run\)[\s\S]*normalizeWorkflowAnalysisForDisplay\(run\?\.documentAnalysis\)/)
  assert.match(restoreSource, /workflowAnalysisResult\.value = displayAnalysis\?\.canvas \? displayAnalysis : null/)
  assert.match(restoreSource, /loadWorkflowRunDetail\(runId,\s*\{\s*fallbackRun:\s*run\s*\}\)/)
  assert.match(restoreSource, /startWorkflowAnalysisDeepLinkPolling\(runId\)/)
  assert.match(appSource, /function workflowDisplayAnalysisForAnalyzingRun\(run = \{\}\)[\s\S]*workflowAnalysisHasGeneratingArtifacts\(displayAnalysis\)[\s\S]*buildWorkflowAnalysisProgressResult\(\{ \.\.\.run, documentAnalysis: null \}/)
  assert.match(loadSource, /if \(run\.status === 'analyzing'\) \{[\s\S]*workflowAnalysisResult\.value = workflowDisplayAnalysisForAnalyzingRun\(run\)[\s\S]*workflowCanvasLoading\.value = true[\s\S]*startWorkflowAnalysisDeepLinkPolling\(runId\)/)
  assert.match(loadSource, /if \(fallbackRun\?\.status === 'analyzing'\) \{[\s\S]*workflowAnalysisResult\.value = workflowDisplayAnalysisForAnalyzingRun\(fallbackRun\)[\s\S]*workflowCanvasLoading\.value = true[\s\S]*startWorkflowAnalysisDeepLinkPolling\(runId\)/)
  assert.ok(
    loadSource.indexOf("if (run.status === 'analyzing')") < loadSource.indexOf('if (hasWorkflowAnalysisResultData(run.documentAnalysis)'),
    'analyzing runs must enter loading/polling before stale canvas data can be opened as final'
  )
})

test('failed Advanced UX runs without canvas render failed placeholders instead of generic loading copy', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const failedStart = appSource.indexOf('function buildAdvancedUxFailedAnalysisResult')
  const failedEnd = appSource.indexOf('function buildWorkflowAnalysisProgressResult', failedStart)
  const failedSource = appSource.slice(failedStart, failedEnd)
  const displayStart = appSource.indexOf('function workflowDisplayAnalysisForAnalyzingRun')
  const displayEnd = appSource.indexOf('function isWorkflowRunAnalysisFinal', displayStart)
  const displaySource = appSource.slice(displayStart, displayEnd)

  assert.ok(failedStart >= 0, 'App should have a dedicated failed Advanced UX display builder')
  assert.match(
    failedSource,
    /artifactStatus:\s*'failed'[\s\S]*generationPlaceholderStatus:\s*'failed'/,
    'failed Advanced UX placeholder nodes should be marked failed, not generating'
  )
  assert.match(
    failedSource,
    /totalDesignFlow:\s*\{[\s\S]*stageCanvases:\s*\{[\s\S]*'requirement-dissection':\s*\{[\s\S]*nodes/,
    'failed Advanced UX display should also populate totalFlow requirement-dissection stage nodes so the visible total-flow canvas is not empty'
  )
  assert.match(
    failedSource,
    /quickActions:\s*\['重新分析'\]/,
    'failed Advanced UX placeholders should offer retry instead of waiting'
  )
  assert.doesNotMatch(
    failedSource,
    /等待生成|正在生成「需求分析|正在解析输入|正在连接后端模型服务/,
    'failed Advanced UX placeholders must not reuse generic loading copy'
  )
  assert.match(
    displaySource,
    /buildAdvancedUxFailedAnalysisResult\(run\)[\s\S]*return failedAdvancedUxAnalysis/,
    'failed Advanced UX runs without importable canvas should use the failed display builder before generic loading fallback'
  )
})

test('workflow analysis deep link restores entry input while waiting for final model result', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const persistStart = appSource.indexOf('async function persistWorkflowAnalysisBackgroundRun')
  const persistEnd = appSource.indexOf('const workflowSkillRouting = computed', persistStart)
  const persistSource = appSource.slice(persistStart, persistEnd)
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function selectWorkflowAnalysisRecord', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(persistSource, /agentSessions:\s*baseRun\.agentSessions/)
  assert.match(persistSource, /referenceFiles:\s*baseRun\.referenceFiles/)
  assert.match(analyzeSource, /shouldRevealWorkflowAnalysisIntermediateArtifact\(event\.data\)/)
  assert.doesNotMatch(analyzeSource, /backgroundAnalysisResult = mergeWorkflowAnalysisModelDelta/)
  assert.doesNotMatch(analyzeSource, /upsertWorkflowAnalysisStreamAssistantMessage\(persistedPendingRun\.id,\s*event\.data/)
  assert.match(analyzeSource, /persistWorkflowAnalysisBackgroundRun\(persistedPendingRun,\s*backgroundAnalysisResult/)
})

test('workflow analysis deep link opens the entry stage agent session immediately', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const restoreStart = appSource.indexOf('function restoreWorkflowAnalysisFromUrl')
  const restoreEnd = appSource.indexOf('function returnToWorkflowEntry', restoreStart)
  const restoreSource = appSource.slice(restoreStart, restoreEnd)
  const routeStart = appSource.indexOf('function ensureWorkflowDeepLinkRouteState')
  const routeEnd = appSource.indexOf('function workflowRunProjectIdForCurrentRoute', routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)

  assert.match(appSource, /function workflowDefaultAgentNodeIdForAnalysis/)
  assert.match(appSource, /WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID/)
  assert.match(routeSource, /workflowDefaultAgentNodeIdForAnalysis\(workflowAnalysisResult\.value\)/)
  assert.match(restoreSource, /workflowAgentNodeId\.value = workflowDefaultAgentNodeIdForAnalysis\(displayAnalysis \|\| run\?\.documentAnalysis\)/)
  assert.doesNotMatch(restoreSource, /workflowAgentNodeId\.value = 'analysis'/)
})

test('workflow analysis deep link failure persists failed run to backend', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const failStart = appSource.indexOf('function failWorkflowAnalysisDeepLink')
  const failEnd = appSource.indexOf('function restoreWorkflowRouteFromUrl', failStart)
  const failSource = appSource.slice(failStart, failEnd)

  assert.match(failSource, /const failedRun = \{[\s\S]*status:\s*'failed'/)
  assert.match(failSource, /api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*failedRun\)/)
  assert.match(failSource, /void persistFailedWorkflowAnalysisRun\(failedRun\)/)
})

test('workflow analysis deep link resumes pending run using the original input', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const resumeStart = appSource.indexOf('async function resumeWorkflowAnalysisRun')
  const resumeEnd = appSource.indexOf('function failWorkflowAnalysisDeepLink', resumeStart)
  const resumeSource = appSource.slice(resumeStart, resumeEnd)
  const loadStart = appSource.indexOf('async function loadWorkflowRunDetail')
  const loadEnd = appSource.indexOf('function failWorkflowAnalysisDeepLink', loadStart)
  const loadSource = appSource.slice(loadStart, loadEnd)

  assert.match(appSource, /const workflowAnalysisResumeRunIds = new Set\(\)/)
  assert.match(appSource, /function shouldResumeWorkflowAnalysisRun/)
  assert.match(resumeSource, /analysisRunId:\s*baseRun\.id/)
  assert.match(resumeSource, /input:\s*baseRun\.input/)
  assert.match(resumeSource, /api\.uploads\.analyzeDocumentsStream/)
  assert.match(resumeSource, /shouldRevealWorkflowAnalysisIntermediateArtifact\(event\.data\)/)
  assert.doesNotMatch(resumeSource, /upsertWorkflowAnalysisStreamAssistantMessage\(baseRun\.id,\s*event\.data/)
  assert.match(resumeSource, /nextRun\.agentSessions = ensureWorkflowAnalysisAssistantMessageSession/)
  assert.match(resumeSource, /api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*nextRun\)/)
  assert.match(loadSource, /if \(shouldResumeWorkflowAnalysisRun\(run\)\) return resumeWorkflowAnalysisRun\(run\)/)
  assert.match(loadSource, /if \(shouldResumeWorkflowAnalysisRun\(fallbackRun\)\) return resumeWorkflowAnalysisRun\(fallbackRun\)/)
})

test('workflow analysis deep link resumes half-saved runs without model reply', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const shouldStart = appSource.indexOf('function shouldResumeWorkflowAnalysisRun')
  const shouldEnd = appSource.indexOf('function workflowDefaultAgentNodeIdForAnalysis', shouldStart)
  const shouldSource = appSource.slice(shouldStart, shouldEnd)
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)

  assert.match(appSource, /function workflowRunHasModelAssistantReply/)
  assert.match(shouldSource, /if \(workflowRunHasModelAssistantReply\(run\)\) return false/)
  assert.doesNotMatch(shouldSource, /if \(hasWorkflowAnalysisResultData\(run\.documentAnalysis\)\) return false/)
  assert.match(analyzeSource, /persistWorkflowAnalysisBackgroundRun\(persistedPendingRun,\s*backgroundAnalysisResult,\s*\{ immediate: true, status: 'analyzed' \}\)/)
  assert.match(analyzeSource, /await api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*nextRun\)/)
})

test('advanced UX stale generating placeholders can resume after backend restart', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const interruptedSource = appSource.slice(
    appSource.indexOf('function isInterruptedAdvancedUxRun'),
    appSource.indexOf('function shouldResumeWorkflowAnalysisRun')
  )
  const pollingSource = appSource.slice(
    appSource.indexOf('function startWorkflowAnalysisDeepLinkPolling'),
    appSource.indexOf('function keepWorkflowAnalysisDeepLinkWaiting')
  )

  assert.match(appSource, /const ADVANCED_UX_STALE_GENERATING_RESUME_MS = \d+/)
  assert.match(appSource, /function advancedUxGeneratingStartedAt\(run = \{\}\)/)
  assert.match(appSource, /function isStaleAdvancedUxGeneratingRun\(run = \{\}\)/)
  assert.doesNotMatch(
    appSource.slice(
      appSource.indexOf('function isStaleAdvancedUxGeneratingRun'),
      appSource.indexOf('function isInterruptedAdvancedUxRun')
    ),
    /updatedAt/
  )
  assert.match(interruptedSource, /isStaleAdvancedUxGeneratingRun\(run\)[\s\S]*return true/)
  assert.match(
    pollingSource,
    /isInterruptedAdvancedUxRun\(run\) && !workflowAnalysisResumeRunIds\.has\(run\.id\)/
  )
  assert.doesNotMatch(pollingSource, /workflowAnalysisResumeRunIds\.has\(run\.id\)[\s\S]*\|\|\s*isStaleAdvancedUxGeneratingRun\(run\)/)
})

test('workflow canvas fullscreen renders stage-specific detail layouts and tree controls', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(canvasSource, /class="canvas-detail-tree-actions"/)
  assert.match(canvasSource, /全部展开/)
  assert.match(canvasSource, /全部收起/)
  assert.match(canvasSource, /function expandAllTreeItems/)
  assert.match(canvasSource, /function collapseAllTreeItems/)
  assert.match(canvasSource, /isInteractionPageDetail\(fullscreenNode\)/)
  assert.match(canvasSource, /class="interaction-page-detail-split"/)
  assert.match(canvasSource, /class="stage-specific-detail-actions"/)
  assert.match(canvasSource, /expandAllStageDetailSections\(fullscreenNode\)/)
  assert.match(canvasSource, /collapseAllStageDetailSections\(fullscreenNode\)/)
  assert.match(canvasSource, /isStageDetailSectionExpanded\(fullscreenNode\.id, section\.title\)/)
  assert.match(canvasSource, /toggleStageDetailSection\(fullscreenNode\.id, section\.title\)/)
  assert.match(canvasSource, /pageArchitectureSections\(fullscreenNode\)/)
  assert.match(canvasSource, /interactionDetailSections\(fullscreenNode\)/)
  assert.match(canvasSource, /interactionRouteSummary\(fullscreenNode\)/)
  assert.match(canvasSource, /class="interaction-route-summary"/)
  assert.match(canvasSource, /页面目标/)
  assert.match(canvasSource, /主动作/)
  assert.match(canvasSource, /下一页面/)
  assert.match(canvasSource, /数据依赖/)
  assert.match(canvasSource, /class="interaction-spec-section"/)
  assert.match(canvasSource, /function interactionSpecSections/)
  assert.match(canvasSource, /function pageArchitecture/)
  assert.match(canvasSource, /function interactionDetails/)
  assert.match(canvasSource, /function pageArchitectureSections/)
  assert.match(canvasSource, /function interactionDetailSections/)
  assert.match(canvasSource, /const architecture = pageArchitecture\(node\)/)
  assert.match(canvasSource, /const details = interactionDetails\(node\)/)
  assert.match(canvasSource, /function interactionRouteSummary/)
  assert.match(canvasSource, /function detailSectionItemsExcept/)
  assert.match(canvasSource, /excludeMatcher:\s*\/内容状态\//)
  assert.match(canvasSource, /function interactionSpecFieldName/)
  assert.match(canvasSource, /function interactionSpecSectionItems/)
  assert.match(canvasSource, /interactionSpecSectionItems\(node, config\.matcher, config\.excludeMatcher \|\| \/内容状态\//)
  assert.match(canvasSource, /function normalizeInteractionSpecItems/)
  assert.match(canvasSource, /normalizeInteractionSpecItems\(\[\.\.\.detailItems, \.\.\.specItems\]\)/)
  assert.match(canvasSource, /interactionSpecItems\(node\)[\s\S]*\.filter\(\(item\) => matcher\.test\(interactionSpecFieldName\(item\)\)\)/)
  ;['页面目标', '页面核心模块', '用户点击动作', '跳转到哪个页面', '加载 / 空状态 / 失败 / 权限等状态', '前后端接口或数据依赖', '验收点'].forEach((label) => {
    assert.match(canvasSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })
  assert.match(canvasSource, /isVisualGalleryDetail\(fullscreenNode\)/)
  assert.match(canvasSource, /class="visual-gallery-detail"/)
  assert.match(canvasSource, /visualPreview\(fullscreenNode\)/)
  assert.match(canvasSource, /visualBrief\(fullscreenNode\)/)
  assert.match(canvasSource, /visualBriefSections\(fullscreenNode\)/)
  assert.match(canvasSource, /visualPreviewImage\(fullscreenNode\)/)
  assert.match(canvasSource, /visualPreviewNeedsConfiguration\(fullscreenNode\)/)
  assert.match(canvasSource, /class="visual-image-result"/)
  assert.match(canvasSource, /class="visual-image-config-required"/)
  assert.match(canvasSource, /visualStagePages\(fullscreenNode\)/)
  assert.match(canvasSource, /class="visual-gallery-page-grid"/)
  assert.match(canvasSource, /class="visual-gallery-page-card"/)
  assert.match(canvasSource, /生成高保真图/)
  assert.match(canvasSource, /function visualStagePages/)
  assert.match(canvasSource, /function visualBrief/)
  assert.match(canvasSource, /function visualBriefSections/)
  assert.match(canvasSource, /generationActions\(fullscreenNode\)/)
  assert.match(canvasSource, /runFullscreenGenerationAction/)
  assert.match(canvasSource, /class="stage-detail-generation-actions"/)
  assert.match(canvasSource, /isPreviewCodeDetail\(fullscreenNode\)/)
  assert.match(canvasSource, /class="preview-code-detail"/)
  assert.match(canvasSource, /class="preview-code-summary"/)
  assert.match(canvasSource, /previewCodeSummary\(fullscreenNode\)/)
  assert.match(canvasSource, /engineeringPlan\(fullscreenNode\)/)
  assert.match(canvasSource, /engineeringPlanSections\(fullscreenNode\)/)
  assert.match(canvasSource, /function previewCodeSummary/)
  assert.match(canvasSource, /function engineeringPlan/)
  assert.match(canvasSource, /function engineeringPlanSections/)
  assert.match(canvasSource, /class="preview-code-meta-grid"/)
  assert.match(canvasSource, /文件数量/)
  assert.match(canvasSource, /当前文件/)
  assert.match(canvasSource, /生成状态/)
  assert.match(canvasSource, /class="preview-code-frame-wrap"/)
  assert.match(canvasSource, /:srcdoc="previewCodeSrcdoc\(fullscreenNode\)"/)
  assert.match(canvasSource, /function previewCodeSrcdoc/)
  assert.match(canvasSource, /codePreview\(fullscreenNode\)/)
  assert.match(canvasSource, /class="source-file-tree"/)
  assert.match(canvasSource, /class="source-file"/)
  assert.match(canvasSource, /codePreviewFiles\(fullscreenNode\)/)
  assert.match(canvasSource, /selectedCodePreviewFile\(fullscreenNode\)/)
  assert.match(canvasSource, /function selectCodePreviewFile/)
  assert.match(canvasSource, /function selectedCodePreviewCode/)
  assert.match(canvasSource, /isAcceptanceDepositDetail\(fullscreenNode\)/)
  assert.match(canvasSource, /class="acceptance-deposit-detail"/)
  assert.match(canvasSource, /class="acceptance-delivery-package"/)
  assert.match(canvasSource, /deliveryPackage\(fullscreenNode\)/)
  assert.match(canvasSource, /交付包摘要/)
  assert.match(canvasSource, /acceptanceChecklist\(fullscreenNode\)/)
  assert.match(canvasSource, /class="acceptance-check-row"/)
  assert.match(canvasSource, /class="acceptance-risk-card"/)
  assert.match(canvasSource, /class="acceptance-knowledge-card"/)
  assert.match(canvasSource, /沉淀到知识库/)
  assert.match(canvasSource, /\$emit\('persist-knowledge'\)/)
  assert.match(styleSource, /\.interaction-page-detail-split/)
  assert.match(styleSource, /\.interaction-route-summary/)
  assert.match(styleSource, /\.interaction-spec-section/)
  assert.match(styleSource, /\.stage-specific-detail-actions/)
  assert.match(styleSource, /\.interaction-spec-section\.collapsed/)
  assert.match(styleSource, /\.visual-gallery-detail/)
  assert.match(styleSource, /\.visual-gallery-page-grid/)
  assert.match(styleSource, /\.visual-gallery-page-card/)
  assert.match(styleSource, /\.visual-image-result/)
  assert.match(styleSource, /\.visual-image-config-required/)
  assert.match(styleSource, /\.preview-code-detail/)
  assert.match(styleSource, /\.preview-code-summary/)
  assert.match(styleSource, /\.preview-code-meta-grid/)
  assert.match(styleSource, /\.preview-code-frame/)
  assert.match(styleSource, /\.preview-code-frame iframe/)
  assert.match(styleSource, /\.preview-code-file-tabs/)
  assert.match(styleSource, /\.acceptance-deposit-detail/)
  assert.match(styleSource, /\.acceptance-delivery-package/)
  assert.match(styleSource, /\.acceptance-check-row/)
  assert.match(styleSource, /\.acceptance-risk-card/)
  assert.match(styleSource, /\.acceptance-knowledge-card/)
})

test('workflow generation detail actions update artifact status before handing off to agent', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const quickStart = appSource.indexOf('function runWorkflowNodeQuickAction')
  const quickEnd = appSource.indexOf('async function applyWorkflowAgentSupplement', quickStart)
  const quickSource = appSource.slice(quickStart, quickEnd)
  const generationStart = appSource.indexOf('function runWorkflowGenerationAction')
  const generationEnd = appSource.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appSource.slice(generationStart, generationEnd)

  assert.match(quickSource, /payload\?\.generationAction/)
  assert.match(quickSource, /runWorkflowGenerationAction\(payload\)/)
  assert.match(generationSource, /function runWorkflowGenerationAction/)
  assert.match(generationSource, /patchWorkflowCanvasNodeArtifactStatus/)
  assert.match(generationSource, /artifactStatus:\s*'generating'/)
  assert.match(generationSource, /generationAction:\s*\{[\s\S]*status:\s*'generating'/)
  assert.match(generationSource, /api\.workflows\.generateCanvasNodeArtifact/)
  assert.match(generationSource, /patchWorkflowCanvasNodeArtifactStatus\(nodeId,[\s\S]*artifactStatus:\s*'generated'/)
  assert.match(apiSource, /generateCanvasNodeArtifact\(config,\s*runId,\s*nodeId,\s*payload = \{\}/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/canvas-nodes\/\$\{encodeURIComponent\(nodeId\)\}\/generate-artifact/)
  assert.match(generationSource, /const agentScopeId = workflowGenerationAgentScopeId\(nodeId\)/)
  assert.match(generationSource, /appendWorkflowGeneratedCodeAgentMessage\(generatedNode, generationAction, \{ scopeId: agentScopeId \}\)/)
  assert.match(generationSource, /appendWorkflowVisualArtifactAgentMessage\(generatedNode, generationAction, \{ scopeId: agentScopeId \}\)/)
})

test('backend workflow route generates and persists canvas node artifacts', async () => {
  const { workflowRoutes } = await import('../backend/routes/workflows.js')
  const backendRoutes = workflowRoutes(undefined, {
    agentProvider: {
      name: 'test-html-provider',
      async generate() {
        return {
          content: '<!doctype html><html><body><main><h1>HTML 预览</h1><section>顶部搜索区 饮品分类横向 Tab 固定底部结算栏 清爽茶饮品牌高保真点单页</section></main></body></html>',
          provider: 'test-html-provider',
          model: 'test-html-model'
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-canvas-artifact',
    workflowId: 'total-design-flow',
    input: '做一个茶饮点单小程序',
    status: 'running',
    steps: [{ id: 'html-preview', title: 'HTML 预览' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个茶饮点单小程序',
      canvas: {
        nodes: [
          {
            id: 'html-preview',
            stageId: 'html-output',
            title: 'HTML 预览',
            summary: '把确认后的页面方案转成可打开 HTML。',
            content: ['输入：低保页面、UI视觉规则、状态说明'],
            detailLayout: 'preview-code-split',
            targetGenerator: 'html',
            artifactStatus: 'pending',
            generationActions: [{ id: 'generate-html', label: '生成 HTML', status: 'pending', targetGenerator: 'html' }],
            codePreview: { previewTitle: 'HTML 运行预览', previewSummary: '等待生成。', codeLanguage: 'html', code: '' }
          }
        ],
        edges: [],
        orderedTabs: [{ key: 'html-preview', label: 'HTML 预览' }]
      },
      totalDesignFlow: {
        stageCanvases: {
          'interaction-lofi': {
            nodes: [
              {
                id: 'order-page',
                stageId: 'interaction-lofi',
                title: '点单首页',
                summary: '用户选择饮品、规格和加料后进入结算。',
                sourcePageId: 'order-page',
                pageLayoutArtifact: {
                  asciiWireframe: '+ 顶部搜索区\n+ 饮品分类横向 Tab\n+ 商品卡片列表\n+ 固定底部结算栏',
                  sections: [
                    { title: '顶部搜索区', items: ['搜索饮品', '切换门店'] },
                    { title: '固定底部结算栏', items: ['合计金额', '去结算按钮'] }
                  ],
                  interactionDetails: '点击商品卡片打开规格弹层；点击去结算进入确认订单页。'
                },
                interactionSpecArtifact: {
                  states: ['默认态', '规格选择态', '空搜索态'],
                  gestures: ['点击商品卡片', '切换分类 Tab']
                }
              }
            ],
            edges: [],
            orderedTabs: [{ key: 'order-page', label: '点单首页' }]
          },
          'ui-visual': {
            nodes: [
              {
                id: 'ui-order-page',
                stageId: 'ui-visual',
                title: '点单首页 UI视觉',
                sourcePageId: 'order-page',
                visualBrief: {
                  pageTitle: '点单首页',
                  layoutFocus: '顶部搜索、分类 Tab、商品卡片、底部结算栏层级清晰。',
                  componentChecklist: ['搜索栏', '分类 Tab', '商品卡片', '底部结算栏']
                },
                visualPreview: {
                  imagePrompt: '清爽茶饮品牌高保真点单页，保留固定底部结算栏。'
                }
              }
            ],
            edges: [],
            orderedTabs: [{ key: 'ui-order-page', label: '点单首页 UI视觉' }]
          },
          'html-output': {
            nodes: [
              {
                id: 'html-preview',
                stageId: 'html-output',
                title: 'HTML 预览',
                summary: '把确认后的页面方案转成可打开 HTML。',
                sourcePageId: 'order-page',
                content: ['输入：低保页面、UI视觉规则、状态说明'],
                detailLayout: 'preview-code-split',
                targetGenerator: 'html',
                artifactStatus: 'pending',
                generationActions: [{ id: 'generate-html', label: '生成 HTML', status: 'pending', targetGenerator: 'html' }],
                codePreview: { previewTitle: 'HTML 运行预览', previewSummary: '等待生成。', codeLanguage: 'html', code: '' }
              }
            ],
            edges: [],
            orderedTabs: [{ key: 'html-preview', label: 'HTML 预览' }]
          }
        }
      },
      versions: []
    }
  })

  const generated = await backendRoutes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
    id: created.run.id,
    nodeId: 'html-preview',
    generationAction: { id: 'generate-html', label: '生成 HTML', targetGenerator: 'html' },
    targetGenerator: 'html'
  })

  const node = generated.analysis.canvas.nodes[0]
  const stageNode = generated.analysis.totalDesignFlow.stageCanvases['html-output'].nodes[0]
  assert.equal(node.artifactStatus, 'generated')
  assert.equal(stageNode.artifactStatus, 'generated')
  assert.match(node.codePreview.code, /<!doctype html>/)
  assert.match(node.codePreview.code, /HTML 预览/)
  assert.match(node.codePreview.code, /顶部搜索区/)
  assert.match(node.codePreview.code, /饮品分类横向 Tab/)
  assert.match(node.codePreview.code, /固定底部结算栏/)
  assert.match(node.codePreview.code, /清爽茶饮品牌高保真点单页/)
  assert.equal(node.generationActions[0].status, 'generated')
  assert.equal(generated.run.documentAnalysis.canvas.nodes[0].artifactStatus, 'generated')
})

test('backend workflow route generates Vue canvas artifacts as an engineering file package', async () => {
  const { workflowRoutes } = await import('../backend/routes/workflows.js')
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs']({
    id: 'run-vue-artifact',
    workflowId: 'total-design-flow',
    input: '做一个茶饮点单小程序',
    status: 'running',
    steps: [{ id: 'vue-app', title: 'Vue 页面' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个茶饮点单小程序',
      canvas: {
        nodes: [
          {
            id: 'vue-app',
            stageId: 'vue-output',
            title: 'Vue 页面',
            summary: '把 HTML/视觉方案拆成可维护 Vue 工程。',
            content: ['输入：HTML Demo、页面状态、接口依赖'],
            detailLayout: 'preview-code-split',
            targetGenerator: 'vue',
            artifactStatus: 'pending',
            generationActions: [{ id: 'generate-vue', label: '生成 Vue', status: 'pending', targetGenerator: 'vue' }],
            codePreview: { previewTitle: 'Vue 运行预览', previewSummary: '等待生成。', codeLanguage: 'vue', code: '' }
          }
        ],
        edges: [],
        orderedTabs: [{ key: 'vue-app', label: 'Vue 页面' }]
      },
      totalDesignFlow: {
        stageCanvases: {
          'vue-output': {
            nodes: [
              {
                id: 'vue-app',
                stageId: 'vue-output',
                title: 'Vue 页面',
                summary: '把 HTML/视觉方案拆成可维护 Vue 工程。',
                content: ['输入：HTML Demo、页面状态、接口依赖'],
                detailLayout: 'preview-code-split',
                targetGenerator: 'vue',
                artifactStatus: 'pending',
                generationActions: [{ id: 'generate-vue', label: '生成 Vue', status: 'pending', targetGenerator: 'vue' }],
                codePreview: { previewTitle: 'Vue 运行预览', previewSummary: '等待生成。', codeLanguage: 'vue', code: '' }
              }
            ],
            edges: [],
            orderedTabs: [{ key: 'vue-app', label: 'Vue 页面' }]
          }
        }
      },
      versions: []
    }
  })

  const generated = await backendRoutes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
    id: created.run.id,
    nodeId: 'vue-app',
    generationAction: { id: 'generate-vue', label: '生成 Vue', targetGenerator: 'vue' },
    targetGenerator: 'vue'
  })

  const node = generated.analysis.canvas.nodes[0]
  const stageNode = generated.analysis.totalDesignFlow.stageCanvases['vue-output'].nodes[0]
  assert.equal(node.artifactStatus, 'generated')
  assert.equal(node.artifact.kind, 'vue')
  assert.deepEqual(node.artifact.files.map((file) => file.path), [
    'package.json',
    'index.html',
    'src/main.js',
    'src/App.vue',
    'README.md'
  ])
  assert.match(node.artifact.files.find((file) => file.path === 'package.json').content, /"scripts"/)
  assert.match(node.artifact.files.find((file) => file.path === 'src/main.js').content, /createApp/)
  assert.match(node.artifact.files.find((file) => file.path === 'src/App.vue').content, /<template>/)
  assert.equal(node.codePreview.codeLanguage, 'vue')
  assert.equal(node.codePreview.filePath, 'src/App.vue')
  assert.match(node.codePreview.code, /<template>/)
  assert.equal(stageNode.artifact.files.length, node.artifact.files.length)
  assert.match(stageNode.artifact.files.find((file) => file.path === 'src/App.vue').content, /Vue 页面/)
})

function visualCanvasRunPayload(id = 'run-visual-artifact') {
  return {
    id,
    workflowId: 'total-design-flow',
    input: '做一个茶饮点单小程序',
    status: 'running',
    steps: [{ id: 'ui-home', title: '首页与选店 UI视觉' }],
    currentStepIndex: 0,
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个茶饮点单小程序',
      canvas: {
        nodes: [
          {
            id: 'ui-home',
            stageId: 'ui-visual',
            title: '首页与选店 UI视觉',
            summary: '定义视觉层级、组件、状态和风格。',
            content: ['视觉重点：信息层级、主按钮、卡片/列表/表单状态'],
            detailLayout: 'visual-gallery',
            targetGenerator: 'gpt-image-2',
            artifactStatus: 'pending',
            generationActions: [{ id: 'generate-visual', label: '生成高保真图', status: 'pending', targetGenerator: 'gpt-image-2' }],
            visualPreview: {
              imagePrompt: '为「首页与选店」生成一张移动端高保真 UI 视觉稿。',
              imageStatus: 'pending',
              figmaReady: true,
              componentNotes: ['导航与页面标题', '核心内容卡片/列表']
            }
          }
        ],
        edges: [],
        orderedTabs: [{ key: 'ui-home', label: '首页与选店 UI视觉' }]
      },
      totalDesignFlow: {
        stageCanvases: {
          'ui-visual': {
            nodes: [
              {
                id: 'ui-home',
                stageId: 'ui-visual',
                title: '首页与选店 UI视觉',
                summary: '定义视觉层级、组件、状态和风格。',
                content: ['视觉重点：信息层级、主按钮、卡片/列表/表单状态'],
                detailLayout: 'visual-gallery',
                targetGenerator: 'gpt-image-2',
                artifactStatus: 'pending',
                generationActions: [{ id: 'generate-visual', label: '生成高保真图', status: 'pending', targetGenerator: 'gpt-image-2' }],
                visualPreview: {
                  imagePrompt: '为「首页与选店」生成一张移动端高保真 UI 视觉稿。',
                  imageStatus: 'pending',
                  figmaReady: true,
                  componentNotes: ['导航与页面标题', '核心内容卡片/列表']
                }
              }
            ],
            edges: [],
            orderedTabs: [{ key: 'ui-home', label: '首页与选店 UI视觉' }]
          }
        }
      },
      versions: []
    }
  }
}

test('backend workflow route generates visual canvas artifacts with image provider output', async () => {
  const { workflowRoutes } = await import('../backend/routes/workflows.js')
  const calls = []
  const backendRoutes = workflowRoutes(undefined, {
    imageProvider: {
      name: 'test-image-provider',
      async generate(payload = {}) {
        calls.push(payload)
        return {
          imageDataUrl: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
          provider: 'test-image-provider',
          model: 'gpt-image-2',
          revisedPrompt: `${payload.prompt} refined`
        }
      }
    }
  })
  const created = await backendRoutes['POST /api/workspace/workflow-runs'](visualCanvasRunPayload('run-visual-provider-artifact'))

  const generated = await backendRoutes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
    id: created.run.id,
    nodeId: 'ui-home',
    generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  })

  const node = generated.analysis.canvas.nodes[0]
  const stageNode = generated.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
  assert.equal(calls.length, 1)
  assert.match(calls[0].prompt, /首页与选店/)
  assert.equal(node.artifactStatus, 'generated')
  assert.equal(node.artifact.kind, 'visual')
  assert.equal(node.artifact.imageStatus, 'generated')
  assert.equal(node.artifact.imageDataUrl, 'data:image/png;base64,ZmFrZS1pbWFnZQ==')
  assert.equal(node.visualPreview.imageStatus, 'generated')
  assert.equal(node.visualPreview.imageDataUrl, 'data:image/png;base64,ZmFrZS1pbWFnZQ==')
  assert.equal(node.visualPreview.provider, 'test-image-provider')
  assert.equal(stageNode.visualPreview.imageDataUrl, node.visualPreview.imageDataUrl)
})

test('backend workflow route marks visual artifacts configuration-required when no image provider is configured', async () => {
  const { workflowRoutes } = await import('../backend/routes/workflows.js')
  const backendRoutes = workflowRoutes()
  const created = await backendRoutes['POST /api/workspace/workflow-runs'](visualCanvasRunPayload('run-visual-no-provider-artifact'))

  const generated = await backendRoutes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
    id: created.run.id,
    nodeId: 'ui-home',
    generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  })

  const node = generated.analysis.canvas.nodes[0]
  assert.equal(node.artifactStatus, 'pending')
  assert.equal(node.artifact.kind, 'visual')
  assert.equal(node.artifact.imageStatus, 'configuration-required')
  assert.equal(node.visualPreview.imageStatus, 'configuration-required')
  assert.ok(!node.visualPreview.imageDataUrl)
  assert.match(node.visualPreview.configurationMessage, /图片生成模型|未配置/)
})

test('workflow canvas fullscreen and agent actions resolve valid nodes for every skill canvas', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const resolverStart = appSource.indexOf('function workflowCanvasResolvableNodeId')
  const resolverEnd = appSource.indexOf('function openWorkflowCanvasFullscreen', resolverStart)
  const resolverSource = appSource.slice(resolverStart, resolverEnd)
  const fullscreenStart = appSource.indexOf('function openWorkflowCanvasFullscreen')
  const fullscreenEnd = appSource.indexOf('function closeWorkflowCanvasFullscreen', fullscreenStart)
  const fullscreenSource = appSource.slice(fullscreenStart, fullscreenEnd)
  const canvasNodeStart = appSource.indexOf('function canvasNodeById')
  const canvasNodeEnd = appSource.indexOf('function canvasNodeCenter', canvasNodeStart)
  const canvasNodeSource = appSource.slice(canvasNodeStart, canvasNodeEnd)
  const agentStart = appSource.indexOf('function openWorkflowAgentForNode')
  const agentEnd = appSource.indexOf('function workflowAgentScopeId', agentStart)
  const agentSource = appSource.slice(agentStart, agentEnd)

  assert.match(canvasSource, /data-canvas-action="open-agent" :data-node-id="node\.id"/)
  assert.match(canvasSource, /data-canvas-action="open-detail" :data-node-id="node\.id"/)
  assert.match(canvasSource, /function handleCanvasActionClick\(event\)[\s\S]*closest\?\.\('\[data-canvas-action\]\[data-node-id\]'\)[\s\S]*emit\('open-agent', nodeId\)[\s\S]*emit\('open-agent', \{ action: 'open-detail', nodeId, node \}\)/)
  assert.match(resolverSource, /function workflowCanvasResolvableNodeId\(candidateId = ''\)/)
  assert.match(resolverSource, /canvasNodeById\(candidateId\)/)
  assert.match(resolverSource, /activeCanvasNode\.value\?\.id/)
  assert.match(resolverSource, /workflowCurrentCanvasNodes\.value\[0\]\?\.id/)
  assert.match(
    canvasNodeSource,
    /workflowStageCanvasNodeById\(nodeId\)[\s\S]*workflowCurrentCanvasNodes\.value\.find/,
    'fullscreen detail should prefer canonical stage canvas nodes before merged canvas fallbacks'
  )
  assert.match(fullscreenSource, /const candidateNode = nodeId && typeof nodeId === 'object' && !Array\.isArray\(nodeId\) \? nodeId : null/)
  assert.match(fullscreenSource, /const resolvedNode = candidateNodeId \? canvasNodeById\(candidateNodeId\) : null/)
  assert.match(fullscreenSource, /const targetNodeId = resolvedNode\?\.id \|\| candidateNode\?\.id \|\| workflowCanvasResolvableNodeId\(candidateNodeId\)/)
  assert.match(fullscreenSource, /if \(!targetNodeId\) return/)
  assert.match(fullscreenSource, /workflowFullscreenNodeOverride\.value = resolvedNode \? null : \(candidateNode\?\.id === targetNodeId \? candidateNode : null\)/)
  assert.match(fullscreenSource, /workflowFullscreenNodeId\.value = targetNodeId/)
  assert.match(agentSource, /const targetNodeId = workflowCanvasResolvableNodeId\(nodeId\)/)
  assert.match(agentSource, /workflowAgentNodeId\.value = targetNodeId/)
})

test('workflow agent typewriter defaults stay fast enough for chat replies', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const typewriterSource = appSource.slice(
    appSource.indexOf('async function typeWorkflowAgentAssistantMessage'),
    appSource.indexOf('function removeWorkflowAgentMessage')
  )
  assert.match(typewriterSource, /const step = options\.step \?\? 18/)
  assert.match(typewriterSource, /await wait\(options\.delayMs \?\? 3\)/)
  assert.match(typewriterSource, /assistantMessage\.meta\?\.streamedContentPreserved/)
  assert.match(typewriterSource, /content:\s*fullContent[\s\S]*typewriterDone:\s*true/)
})

test('ux confirmation quick replies stay in agent chat instead of becoming one-shot canvas actions', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const quickReplySource = appSource.slice(
    appSource.indexOf('function isWorkflowAgentCanvasAdviceQuickReply'),
    appSource.indexOf('function runWorkflowNodeQuickAction')
  )
  const useReplySource = appSource.slice(
    appSource.indexOf('function useWorkflowAgentQuickReply'),
    appSource.indexOf('async function copyWorkflowAgentMessage')
  )

  assert.match(quickReplySource, /\^\(下一步\|调整本阶段\)\$/)
  assert.match(quickReplySource, /转低保真画布/)
  assert.match(useReplySource, /uxConfirmationPromptMap/)
  assert.match(useReplySource, /state\.activeWorkflowRun\?\.skillId === 'ux-design-confirmation-skill'/)
  assert.match(useReplySource, /UX 设计确认 Skill 的下一阶段/)
  assert.match(useReplySource, /低保真画布方案/)
  assert.match(useReplySource, /sendWorkflowAgentMessage\(mappedContent, \{ ignoreDraftState: true \}\)/)
  assert.ok(
    useReplySource.indexOf("state.activeWorkflowRun?.skillId === 'ux-design-confirmation-skill'") <
      useReplySource.indexOf('isWorkflowAgentCanvasAdviceQuickReply'),
    'UX confirmation quick replies should be mapped to chat before canvas-action interception'
  )
})

test('workflow agent persists assistant replies back to active run records', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const applySource = appSource.slice(
    appSource.indexOf('function applyWorkflowAgentPersistedResult'),
    appSource.indexOf('async function persistWorkflowAgentMessageStream')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )

  assert.match(applySource, /state\.workflowRuns = upsertWorkflowRunRecord\(state\.workflowRuns, state\.activeWorkflowRun\)/)
  assert.match(applySource, /saveState\(state\)/)
  assert.match(sendSource, /persistedAssistantMessage/)
  assert.match(sendSource, /recoveredFromRun/)
  assert.match(sendSource, /recoveredFromBackend/)
  assert.match(sendSource, /persisted\.data\?\.assistantMessage \|\| persistedAssistantMessage \|\| recoveredBackendResult\.assistantMessage/)
})

test('workflow agent streams model content progressively without replacing it with placeholders', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const streamDisplaySource = appSource.slice(
    appSource.indexOf('function workflowAgentStreamDisplayContent'),
    appSource.indexOf('function normalizeWorkflowAgentTraceItem')
  )
  const persistSource = appSource.slice(
    appSource.indexOf('async function persistWorkflowAgentMessageStream'),
    appSource.indexOf('async function sendWorkflowAgentMessage')
  )

  assert.doesNotMatch(appSource, /function createWorkflowAnalysisLoadingMessage/)
  assert.doesNotMatch(appSource, /模型返回后会直接展示完整结果/)
  assert.match(appSource, /function workflowAgentPartialStructuredStreamText/)
  assert.match(streamDisplaySource, /workflowAgentPartialStructuredStreamText\(value\) \|\| value/)
  assert.doesNotMatch(streamDisplaySource, /正在整理模型回复/)
  assert.match(persistSource, /const visibleStreamContent = workflowAgentStreamDisplayContent\(streamedContent\)/)
  assert.match(persistSource, /content:\s*workflowAgentMessageText\(currentMessage\)/)
  assert.doesNotMatch(persistSource, /content:\s*workflowAgentMessageText\(currentMessage\) \|\| event\.data\?\.label \|\| workflowAgentStatusLabel/)
  assert.match(persistSource, /placeholderOnly:\s*!workflowAgentMessageText\(currentMessage\)/)
})

test('workflow analysis stream waits for final result instead of writing model deltas into agent chat', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const uploadSource = await readFile(new URL('../backend/routes/uploads.js', import.meta.url), 'utf8')
  const pendingSessionSource = appSource.slice(
    appSource.indexOf('function ensureWorkflowPendingAnalysisMessageSession'),
    appSource.indexOf('function ensureWorkflowAnalysisAssistantMessageSession')
  )
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function selectWorkflowAnalysisRecord', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)
  const broadcastStart = appSource.indexOf('function applyWorkflowAnalysisStreamEvent')
  const broadcastEnd = appSource.indexOf('function restoreWorkflowDeepLinkFromCurrentHashSoon', broadcastStart)
  const broadcastSource = appSource.slice(broadcastStart, broadcastEnd)

  assert.doesNotMatch(pendingSessionSource, /createWorkflowAnalysisLoadingMessage/)
  assert.doesNotMatch(analyzeSource, /ensureWorkflowPendingAnalysisMessageSession/)
  assert.match(appSource, /function upsertWorkflowAnalysisStreamAssistantMessage/)
  assert.match(appSource, /function shouldRevealWorkflowAnalysisIntermediateArtifact\(/)
  assert.doesNotMatch(analyzeSource, /upsertWorkflowAnalysisStreamAssistantMessage\(persistedPendingRun\.id,\s*event\.data/)
  assert.doesNotMatch(broadcastSource, /upsertWorkflowAnalysisStreamAssistantMessage\(currentWorkflowAnalysisDeepLinkRunId\(\),\s*event\.data/)
  assert.match(analyzeSource, /if \(event\.type === 'artifact' && !shouldRevealWorkflowAnalysisIntermediateArtifact\(event\.data\)\)/)
  assert.match(broadcastSource, /if \(!shouldRevealWorkflowAnalysisIntermediateArtifact\(event\.data\)\)/)
  assert.match(uploadSource, /const shouldEmitAssistantMarkdown = isNoSkillPayload\(payload\) \|\| isTotalDesignFlowPayload\(payload\)/)
  assert.match(uploadSource, /const shouldForwardModelDelta = isNoSkillPayload\(payload\)/)
  assert.match(uploadSource, /const shouldForwardModelStatus = shouldEmitAssistantMarkdown/)
  assert.match(uploadSource, /onModelDelta: shouldForwardModelDelta/)
  assert.doesNotMatch(uploadSource, /text:\s*modelText\.slice\(-6000\)/)
  assert.match(uploadSource, /text:\s*modelText/)
  assert.match(uploadSource, /generation:\s*result\.generation \|\| null/)
})

test('workflow analysis loading assistant is transient and model reply uses full streamed text', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const loadingStart = appSource.indexOf('function createWorkflowAnalysisLoadingAssistantMessage')
  const loadingEnd = appSource.indexOf('function mergeWorkflowAgentSessionMessages', loadingStart)
  const loadingSource = appSource.slice(loadingStart, loadingEnd)
  const streamStart = appSource.indexOf('function workflowAnalysisStreamAssistantMessage')
  const streamEnd = appSource.indexOf('function upsertWorkflowAnalysisStreamAssistantMessage', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)
  const finalizeStart = appSource.indexOf('function finalizeWorkflowAnalysisAgentSessions')
  const finalizeEnd = appSource.indexOf('function upsertWorkflowAnalysisStreamAssistantMessage', finalizeStart)
  const finalizeSource = appSource.slice(finalizeStart, finalizeEnd)
  const openCanvasStart = appSource.indexOf('function openWorkflowCanvasRun')
  const openCanvasEnd = appSource.indexOf('function openDialogueSkillRecord', openCanvasStart)
  const openCanvasSource = appSource.slice(openCanvasStart, openCanvasEnd)
  const hasReplyStart = appSource.indexOf('function workflowRunHasModelAssistantReply')
  const hasReplyEnd = appSource.indexOf('function shouldResumeWorkflowAnalysisRun', hasReplyStart)
  const hasReplySource = appSource.slice(hasReplyStart, hasReplyEnd)
  const statusStart = drawerSource.indexOf('function messageStatus')
  const statusEnd = drawerSource.indexOf('function messageStatusClass', statusStart)
  const statusSource = drawerSource.slice(statusStart, statusEnd)

  assert.match(loadingSource, /transient:\s*true/)
  assert.match(loadingSource, /status:\s*'generating'/)
  assert.match(loadingSource, /const isAdvancedUxGenerating = isAdvancedUxMarkdownGeneratingRun\(run\)/)
  assert.match(loadingSource, /trace:\s*isAdvancedUxGenerating \? workflowAdvancedUxGeneratingTraceItems\(run\) : workflowAgentPendingTraceItems\(\)/)
  assert.doesNotMatch(loadingSource, /收到首段输出后会直接展示模型原文/)
  assert.match(loadingSource, /content:\s*meta\.content \|\| \(isAdvancedUxGenerating \? advancedUxMarkdownGeneratingStatusText\(run\) : ''\)/)
  assert.match(loadingSource, /statusLabel:\s*isAdvancedUxGenerating \? '生成高级 UX Markdown' : '生成回复'/)
  assert.doesNotMatch(loadingSource, /正在连接模型/)
  assert.match(hasReplySource, /message\?\.meta\?\.transient/)
  assert.match(streamSource, /workflowAgentStreamDisplayContent\(payload\.text \|\| payload\.delta \|\| ''\)/)
  assert.match(streamSource, /hideStatus:\s*true/)
  assert.match(streamSource, /status:\s*meta\.status \|\| 'success'/)
  assert.match(streamSource, /clientMessageId:\s*`\$\{runId \|\| 'workflow'\}-analysis-assistant`/)
  assert.match(finalizeSource, /function finalizeWorkflowAnalysisAgentSessions/)
  assert.match(finalizeSource, /status:\s*'success'/)
  assert.match(finalizeSource, /typewriterDone:\s*true/)
  assert.match(openCanvasSource, /const analysisSessions = ensureWorkflowAnalysisAssistantMessageSession\(\{[\s\S]*run:\s*recoveredRun,[\s\S]*analysis:\s*recoveredRun\.documentAnalysis[\s\S]*\}\)/)
  assert.match(openCanvasSource, /finalizeWorkflowAnalysisAgentSessions\(\{[\s\S]*\.\.\.recoveredRun,[\s\S]*agentSessions:\s*analysisSessions[\s\S]*\}\)/)
  assert.match(openCanvasSource, /recoverInterruptedWorkflowAgentSessions\(\{[\s\S]*finalizeWorkflowAnalysisAgentSessions/)
  assert.match(statusSource, /messageMeta\(message\)\.action === 'workflow-analysis-result'/)
  assert.match(statusSource, /messageContent\(message\)\.trim\(\)/)
  assert.match(statusSource, /return 'success'/)
})

test('workflow analysis completed canvas without raw generation still shows a stable assistant result', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const replyStart = appSource.indexOf('function workflowModelReplyText')
  const replyEnd = appSource.indexOf('function hasWorkflowAnalysisResultData', replyStart)
  const replySource = appSource.slice(replyStart, replyEnd)
  const shouldStart = appSource.indexOf('function shouldResumeWorkflowAnalysisRun')
  const shouldEnd = appSource.indexOf('function workflowDefaultAgentNodeIdForAnalysis', shouldStart)
  const shouldSource = appSource.slice(shouldStart, shouldEnd)
  const assistantStart = appSource.indexOf('function createWorkflowAnalysisAssistantMessage')
  const assistantEnd = appSource.indexOf('function createWorkflowAnalysisLoadingAssistantMessage', assistantStart)
  const assistantSource = appSource.slice(assistantStart, assistantEnd)

  assert.match(appSource, /function workflowAnalysisFallbackReplyText/)
  assert.match(replySource, /workflowAnalysisFallbackReplyText\(analysis\)/)
  assert.match(assistantSource, /status:\s*'success'/)
  assert.match(assistantSource, /typewriterDone:\s*true/)
  assert.match(shouldSource, /if \(hasWorkflowAnalysisResultData\(run\.documentAnalysis\) && !isWorkflowAnalysisPlaceholder\(run\.documentAnalysis\)\) return false/)
  assert.match(appSource, /function ensureWorkflowAnalysisAssistantMessageSession/)
})

test('workflow analysis legacy loading copy is filtered from agent chat', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const loadingStart = appSource.indexOf('function createWorkflowAnalysisLoadingAssistantMessage')
  const loadingEnd = appSource.indexOf('function mergeWorkflowAgentSessionMessages', loadingStart)
  const loadingSource = appSource.slice(loadingStart, loadingEnd)
  const placeholderStart = drawerSource.indexOf('function isWorkflowAnalysisLegacyPlaceholder')
  const placeholderEnd = drawerSource.indexOf('function markdownAgentMessageContent', placeholderStart)
  const placeholderSource = drawerSource.slice(placeholderStart, placeholderEnd)

  assert.doesNotMatch(loadingSource, /正在把你的需求发送给模型，收到首段输出后会直接展示模型原文/)
  assert.match(placeholderSource, /收到首段输出后会直接展示模型原文/)
  assert.match(placeholderSource, /正在把你的需求发送给模型/)
})

test('workflow analysis final save preserves streamed markdown reply over background json', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function workflowRunHasModelAssistantReply')
  const helperEnd = appSource.indexOf('function shouldResumeWorkflowAnalysisRun', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const analyzeStart = appSource.indexOf('async function analyzeWorkflowDocuments')
  const analyzeEnd = appSource.indexOf('async function autoAnalyzeWorkflowInput', analyzeStart)
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd)
  const resumeStart = appSource.indexOf('async function resumeWorkflowAnalysisRun')
  const resumeEnd = appSource.indexOf('function failWorkflowAnalysisDeepLink', resumeStart)
  const resumeSource = appSource.slice(resumeStart, resumeEnd)

  assert.match(appSource, /function ensureWorkflowAnalysisAssistantMessageSession/)
  assert.match(helperSource, /!message\?\.meta\?\.transient/)
  assert.match(analyzeSource, /if \(!workflowRunHasModelAssistantReply\(nextRun\)\) \{[\s\S]*nextRun\.agentSessions = ensureWorkflowAnalysisAssistantMessageSession/)
  assert.match(resumeSource, /if \(!workflowRunHasModelAssistantReply\(nextRun\)\) \{[\s\S]*nextRun\.agentSessions = ensureWorkflowAnalysisAssistantMessageSession/)
})

test('workflow analysis final stream events are never persisted as analyzing', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const finalEventPersistPattern = /event\.data\?\.type === 'workflow-analysis'[\s\S]{0,1400}?persistWorkflowAnalysisBackgroundRun\([^)]*\{ immediate: true, status: 'analyzing' \}/g
  const matches = appSource.match(finalEventPersistPattern) || []

  assert.deepEqual(matches, [])
  assert.match(appSource, /event\.data\?\.type === 'workflow-analysis'[\s\S]{0,1400}?persistWorkflowAnalysisBackgroundRun\([^)]*\{ immediate: true, status: 'analyzed' \}/)
})

test('workflow agent keeps model markdown headings and hides local skill routing notices', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const messageSource = drawerSource.slice(
    drawerSource.indexOf('function messageStructuredContent'),
    drawerSource.indexOf('function isLegacyPlaceholderAgentMessage')
  )

  assert.match(drawerSource, /function markdownAgentMessageContent/)
  assert.match(drawerSource, /function isLocalSkillRoutingNotice/)
  assert.match(messageSource, /markdownAgentMessageContent\(message\?\.content\)/)
  assert.match(messageSource, /isLocalSkillRoutingNotice\(message\)/)
  assert.match(drawerSource, /messageContentSegments\(message\)/)
  assert.match(drawerSource, /<AgentPlainMarkdown v-if="segment\.type === 'markdown'"/)
  assert.match(drawerSource, /<AgentMarkdownCard v-else-if="segment\.type === 'frame'"/)
  assert.doesNotMatch(drawerSource, /<template v-else-if="markdownAgentMessageContent\(messageContent\(message\)\)">/)
  assert.match(styleSource, /\.agent-markdown-message h1/)
  assert.match(styleSource, /\.agent-markdown-message h2/)
  assert.match(styleSource, /\.agent-markdown-message h3/)
})

test('agent drawer bottom arrow scrolls every parent container and the page', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const scrollSource = drawerSource.slice(
    drawerSource.indexOf('function handleChatScroll'),
    drawerSource.indexOf('defineExpose')
  )

  assert.match(scrollSource, /function scrollParentContainersToBottom/)
  assert.match(scrollSource, /function scrollDocumentToBottom/)
  assert.match(scrollSource, /scrollParentContainersToBottom\(el,\s*behavior\)/)
  assert.match(scrollSource, /scrollDocumentToBottom\(behavior\)/)
  assert.match(drawerSource, /@click="scrollAgentChatToBottom\('auto'\)"/)
})

test('workflow agent context includes total flow stage and active requirement slice', async () => {
  const contextBuilderSource = await readFile(new URL('../backend/services/agent-context-builder.js', import.meta.url), 'utf8')

  assert.match(contextBuilderSource, /function resolveTotalFlowContext\(run = \{\}, rawNode = \{\}, scopeId = ''\)/)
  assert.match(contextBuilderSource, /totalFlow\.stageCanvases/)
  assert.match(contextBuilderSource, /const currentStageId = rawNode\.stageId/)
  assert.match(contextBuilderSource, /const activeSlice = slices\.find/)
  assert.match(contextBuilderSource, /fullCanvas: totalFlowContext\.stageCanvas/)
  assert.match(contextBuilderSource, /const totalFlowContext = canvasContext\.totalFlowContext \|\| null/)
  assert.match(contextBuilderSource, /当前总流程阶段：\$\{totalFlowContext\.currentStage\.name\}/)
  assert.match(contextBuilderSource, /当前小需求：\$\{totalFlowContext\.activeSlice\.title\}/)
  assert.match(contextBuilderSource, /renderNodeLines\('阶段画布节点', totalFlowContext\.stageCanvas\.nodes\)/)
  assert.match(contextBuilderSource, /totalFlow: totalFlowContext/)
})

test('workflow agent keeps local pending message id when backend run arrives before final render', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const mergeSource = appSource.slice(
    appSource.indexOf('function mergeWorkflowAgentLocalSessionIntoRun'),
    appSource.indexOf('function applyWorkflowAgentPersistedResult')
  )
  const localMutationSource = appSource.slice(
    appSource.indexOf('function ensureWorkflowAgentSession'),
    appSource.indexOf('function isWorkflowAgentStructuredStreamContent')
  )
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')

  assert.match(mergeSource, /workflowAgentMessageMergeKey/)
  assert.match(mergeSource, /localByMergeKey/)
  assert.match(mergeSource, /incomingByMergeKey/)
  assert.match(mergeSource, /if \(localMessage && incomingMessage\)/)
  assert.match(mergeSource, /const mergedMessage = \{\s*\.\.\.incomingMessage,[\s\S]*\.\.\.localMessage,/)
  assert.match(mergeSource, /return normalizeWorkflowAgentAssistantMessage\(mergedMessage\)/)
  assert.match(mergeSource, /id:\s*localMessage\.id \|\| incomingMessage\.id/)
  assert.match(mergeSource, /seenKeys\.has\(mergeKey\)/)
  assert.match(drawerSource, /function visibleMessageDedupeKey/)
  assert.match(drawerSource, /visibleMessageMap/)
  assert.match(drawerSource, /messageMeta\(message\)\.clientMessageId/)
  assert.match(localMutationSource, /function syncWorkflowAgentSessionChange/)
  assert.match(localMutationSource, /nextSession/)
  assert.match(localMutationSource, /function appendWorkflowAgentMessage\(role, content, options = \{\}\)[\s\S]*const nextSession = \[\.\.\.session, message\]/)
  assert.match(localMutationSource, /function replaceWorkflowAgentMessage\(messageId, nextMessage, scopeId = workflowAgentScopeId\(\)\)[\s\S]*const nextSession = \[\.\.\.session\]/)
  assert.match(localMutationSource, /id:\s*messageId,/)
  assert.match(localMutationSource, /state\.activeWorkflowRun = \{/)
  assert.match(localMutationSource, /state\.workflowRuns = upsertWorkflowRunRecord/)
  assert.match(localMutationSource, /syncWorkflowAgentSessionChange\(scopeId,\s*nextSession\)/)
})

test('workflow agent always leaves a visible assistant reply for a sent message', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const localMutationSource = appSource.slice(
    appSource.indexOf('function ensureWorkflowAgentSession'),
    appSource.indexOf('function isWorkflowAgentStructuredStreamContent')
  )
  const typewriterSource = appSource.slice(
    appSource.indexOf('async function typeWorkflowAgentAssistantMessage'),
    appSource.indexOf('function removeWorkflowAgentMessage')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )

  assert.match(localMutationSource, /function replaceWorkflowAgentMessage\(messageId, nextMessage, scopeId = workflowAgentScopeId\(\)\)[\s\S]*return true/)
  assert.match(localMutationSource, /function replaceOrAppendWorkflowAgentMessage/)
  assert.match(localMutationSource, /if \(replaceWorkflowAgentMessage\(messageId, nextMessage, scopeId\)\) return messageId/)
  assert.match(typewriterSource, /replaceOrAppendWorkflowAgentMessage/)
  assert.match(sendSource, /recoverWorkflowAgentStreamAssistantFromBackend\(state\.activeWorkflowRun\.id,\s*targetScopeId,\s*clientMessageId\)/)
  assert.match(sendSource, /if \(streamEventState\.failed && !backendHandled && !recoveredFromRun && !recoveredFromBackend\)[\s\S]*replaceOrAppendWorkflowAgentMessage\(pendingMessageId/)
  assert.doesNotMatch(sendSource, /if \(streamEventState\.failed && !backendHandled && !recoveredFromRun && !recoveredFromBackend\)[\s\S]{0,220}clearWorkflowAgentActiveDraft\(\)\s*return/)
})

test('workflow agent keeps optimistic chat messages while backend run catches up', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const mergeSource = appSource.slice(
    appSource.indexOf('function mergeWorkflowAgentLocalSessionIntoRun'),
    appSource.indexOf('function applyWorkflowAgentPersistedResult')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )

  assert.match(mergeSource, /const localPendingMessages = localSession\.filter/)
  assert.match(mergeSource, /message\?\.meta\?\.optimistic === true/)
  assert.match(mergeSource, /message\?\.role === 'user'/)
  assert.match(mergeSource, /message\?\.role === 'assistant'[\s\S]*\['pending', 'retrieving', 'generating', 'merging-canvas'\]/)
  assert.match(mergeSource, /mergedSession\.push\(localMessage\)/)
  assert.match(sendSource, /optimistic:\s*true/)
})

test('workflow agent chat-only stages show a visible loading assistant while waiting', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )
  const streamSource = appSource.slice(
    appSource.indexOf('async function persistWorkflowAgentMessageStream'),
    appSource.indexOf('function setWorkflowAgentDisplayMode')
  )

  assert.match(appSource, /function workflowAgentPendingAssistantContent/)
  assert.match(sendSource, /appendWorkflowAgentMessage\('assistant',\s*workflowAgentPendingAssistantContent\(\)/)
  assert.doesNotMatch(sendSource, /appendWorkflowAgentMessage\('assistant',\s*''/)
  assert.doesNotMatch(sendSource, /usesDialogueStyleAgent/)
  assert.doesNotMatch(streamSource, /suppressTrace/)
  assert.doesNotMatch(streamSource, /assistantMessage\.trace\s*=\s*suppressTrace/)
  assert.match(appSource, /function workflowAgentPendingAssistantContent\(\)\s*\{\s*return ''\s*\}/)
  assert.match(sendSource, /placeholderOnly:\s*true/)
  assert.match(sendSource, /trace:\s*workflowAgentPendingTraceItems\(\)/)
  assert.match(sendSource, /status:\s*'pending'/)
})

test('workflow agent persists optimistic user and pending assistant messages before streaming', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const persistSource = appSource.slice(
    appSource.indexOf('async function persistWorkflowAgentPendingSession'),
    appSource.indexOf('function mergeWorkflowAgentLocalSessionIntoRun')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )

  assert.match(appSource, /async function persistWorkflowAgentPendingSession/)
  assert.match(persistSource, /api\.workspace\.createWorkflowRun\(state\.apiConfig,\s*pendingRun\)/)
  assert.match(persistSource, /mergeWorkflowAgentLocalSessionIntoRun\(persisted,\s*scopeId\)/)
  assert.match(sendSource, /const userMessageId = appendWorkflowAgentMessage\('user'/)
  assert.match(sendSource, /const pendingMessageId = appendWorkflowAgentMessage\('assistant'/)
  assert.match(sendSource, /await persistWorkflowAgentPendingSession\(targetScopeId\)/)
  assert.match(sendSource, /await persistWorkflowAgentMessageStream/)
  assert.ok(
    sendSource.indexOf('await persistWorkflowAgentPendingSession(targetScopeId)') <
      sendSource.indexOf('await persistWorkflowAgentMessageStream'),
    'pending session must be saved before the stream request can be interrupted by refresh'
  )
})

test('workflow agent structured content field is rendered as markdown instead of raw json fields', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const contentSource = drawerSource.slice(
    drawerSource.indexOf('function messageContent'),
    drawerSource.indexOf('function isLegacyPlaceholderAgentMessage')
  )
  const templateSource = drawerSource.slice(
    drawerSource.indexOf('<div class="agent-message-body">'),
    drawerSource.indexOf('<div v-if="isEditingMessage(message)" class="agent-message-edit-actions">')
  )
  const structuredSource = drawerSource.slice(
    drawerSource.indexOf('function structuredAgentPlainText'),
    drawerSource.indexOf('function isLocalSkillRoutingNotice')
  )

  assert.match(drawerSource, /function primaryStructuredAgentMarkdownContent/)
  assert.match(structuredSource, /primaryStructuredAgentMarkdownContent\(structured\)/)
  assert.match(contentSource, /primaryStructuredAgentMarkdownContent\(formatStructuredAgentMessageContent\(message\?\.content\)\)/)
  assert.match(templateSource, /messageContentSegments\(message\)/)
})

test('workflow agent renders vue json and html as code cards while markdown stays readable', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const templateSource = drawerSource.slice(
    drawerSource.indexOf('<div class="agent-message-body">'),
    drawerSource.indexOf('<div v-if="isEditingMessage(message)" class="agent-message-edit-actions">')
  )
  const markdownSource = drawerSource.slice(
    drawerSource.indexOf('function markdownAgentMessageContent'),
    drawerSource.indexOf('function messageStructuredContent')
  )

  assert.match(drawerSource, /const AgentCodeCard =/)
  assert.match(drawerSource, /const AgentMarkdownCard =/)
  assert.match(templateSource, /<AgentCodeCard/)
  assert.match(drawerSource, /language: section\.codeLanguage \|\| section\.title \|\| 'code'/)
  assert.match(drawerSource, /:language="segment\.language"/)
  assert.match(drawerSource, /return \(\) => h\(AgentCardShell/)
  assert.doesNotMatch(drawerSource, /const AgentCodeCard[\s\S]{0,900}?template:\s*`/)
  assert.doesNotMatch(drawerSource, /const AgentMarkdownCard[\s\S]{0,1200}?template:\s*`/)
  assert.match(drawerSource, /agentMarkdownContentCards\(agentMarkdownRenderableBlocks\(section\.markdown\)\)/)
  assert.match(drawerSource, /agentMarkdownRenderableBlocks\(section\.markdown\)/)
  assert.match(markdownSource, /codeLanguage/)
  assert.match(markdownSource, /codeFence/)
  assert.match(drawerSource, /function isStructuredAgentMarkdownKey/)
  assert.doesNotMatch(drawerSource, /\^\(code\|html\|css\|js\|javascript\|ts\|typescript\|vue\|json\|schema\|snippet\|source\|markdown\)/)
  assert.match(styleSource, /\.agent-code-card/)
  assert.match(styleSource, /\.agent-code-card-head/)
  assert.match(styleSource, /\.agent-code-card-source/)
  assert.match(styleSource, /\.agent-drawer-embedded \.agent-code-card/)
  assert.match(styleSource, /\.agent-markdown-field/)
})

test('workflow agent frames markdown tables and structure trees as readable content cards', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const templateSource = drawerSource.slice(
    drawerSource.indexOf('<div class="agent-message-body">'),
    drawerSource.indexOf('<div v-if="isEditingMessage(message)" class="agent-message-edit-actions">')
  )
  const markdownSource = drawerSource.slice(
    drawerSource.indexOf('function isMarkdownTableDivider'),
    drawerSource.indexOf('function messageStructuredContent')
  )

  assert.match(drawerSource, /const AgentCardShell =/)
  assert.match(drawerSource, /const AgentMarkdownCard =/)
  assert.match(drawerSource, /const AgentTableCard =/)
  assert.match(drawerSource, /AGENT_CONTENT_CARD_CONTRACT/)
  assert.match(drawerSource, /markdown、表格、结构树、框架层/)
  assert.match(drawerSource, /displayCardTitle/)
  assert.match(templateSource, /<AgentMarkdownCard/)
  assert.match(drawerSource, /<AgentTableCard/)
  assert.match(drawerSource, /h\('table'/)
  assert.doesNotMatch(drawerSource, /const AgentTableCard[\s\S]{0,1400}?template:\s*`/)
  assert.match(drawerSource, /segment\.type === 'table'/)
  assert.match(drawerSource, /function messageContentSegments\(message = \{\}\)/)
  assert.match(markdownSource, /isMarkdownTableDivider/)
  assert.match(markdownSource, /parseMarkdownTableBlock/)
  assert.match(markdownSource, /blocks\.push\(\{ type: 'table'/)
  assert.match(drawerSource, /tree\|structure\|framework\|architecture\|sitemap\|layout\|plaintext\|text/)
  assert.match(drawerSource, /return '文本'/)
  assert.match(drawerSource, /return 'Markdown'/)
  assert.match(styleSource, /\.agent-content-card/)
  assert.match(styleSource, /\.agent-markdown-card-body/)
  assert.match(styleSource, /\.agent-table-card-body/)
  assert.match(styleSource, /\.agent-table-card table/)
  assert.match(styleSource, /\.agent-table-card th/)
})

test('workflow agent hides empty markdown cards and renders pending trace as plain text', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const cardSource = drawerSource.slice(
    drawerSource.indexOf('function agentMarkdownContentCards'),
    drawerSource.indexOf('function markdownAgentMessageContent')
  )
  const structuredSource = drawerSource.slice(
    drawerSource.indexOf('const STRUCTURED_AGENT_INTERNAL_KEYS'),
    drawerSource.indexOf('function humanizeStructuredAgentKey')
  )
  const pendingStyle = styleSource.slice(
    styleSource.indexOf('.agent-pending-trace-disclosure'),
    styleSource.indexOf('.agent-markdown-message', styleSource.indexOf('.agent-pending-trace-disclosure'))
  )

  assert.match(cardSource, /block\?\.text/)
  assert.match(cardSource, /filter\(Boolean\)/)
  assert.match(cardSource, /if \(hasContent\) markdownBlocks\.push\(block\)/)
  assert.match(drawerSource, /function agentMarkdownRenderableBlocks/)
  assert.match(drawerSource, /agentMarkdownRenderableBlocks\(section\.markdown\)/)
  assert.match(drawerSource, /return text \? \[\{ type: 'p', text \}\] : \[\]/)
  assert.match(drawerSource, /function shouldShowStructuredSectionTitle/)
  assert.match(drawerSource, /function structuredContentSegments\(structured = null\)/)
  assert.match(drawerSource, /if \(shouldShowStructuredSectionTitle\(section\)\) sectionLines\.push\(`## \$\{sectionTitle\}`\)/)
  assert.doesNotMatch(drawerSource, /<template\s+v-if="section\.markdown"\s+v-for=/)
  assert.match(structuredSource, /'type'/)
  assert.match(structuredSource, /'action'/)
  assert.doesNotMatch(structuredSource, /'markdown'/)
  assert.match(pendingStyle, /\.agent-pending-trace-summary\s*\{[\s\S]*border:\s*0/)
  assert.match(pendingStyle, /\.agent-pending-trace-summary\s*\{[\s\S]*background:\s*transparent/)
  assert.match(pendingStyle, /\.agent-pending-trace-summary\s*\{[\s\S]*padding:\s*0/)
  assert.doesNotMatch(pendingStyle, /border:\s*1px solid #d8e8ff/)
  assert.doesNotMatch(pendingStyle, /background:\s*rgba\(239, 246, 255/)
})

test('workflow agent summarizes total-flow compact json instead of rendering schema fields', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const replyStart = appSource.indexOf('function workflowModelReplyText')
  const replyEnd = appSource.indexOf('function workflowAnalysisFallbackReplyText', replyStart)
  const replySource = appSource.slice(replyStart, replyEnd)
  const compactStart = appSource.indexOf('function workflowCompactJsonReplyText')
  const compactEnd = appSource.indexOf('function workflowModelReplyText', compactStart)
  const compactSource = appSource.slice(compactStart, compactEnd)
  const drawerCompactStart = drawerSource.indexOf('function compactWorkflowJsonMarkdownContent')
  const drawerCompactEnd = drawerSource.indexOf('function formatStructuredAgentMessageContent', drawerCompactStart)
  const drawerCompactSource = drawerSource.slice(drawerCompactStart, drawerCompactEnd)
  const messageContentStart = drawerSource.indexOf('function messageContent')
  const messageContentEnd = drawerSource.indexOf('function isLegacyPlaceholderAgentMessage', messageContentStart)
  const messageContentSource = drawerSource.slice(messageContentStart, messageContentEnd)

  assert.match(appSource, /function workflowCompactJsonReplyText/)
  assert.match(replySource, /workflowCompactJsonReplyText\(generation\)/)
  assert.match(compactSource, /readableSummary/)
  assert.match(compactSource, /需求切片/)
  assert.match(compactSource, /页面与流程/)
  assert.doesNotMatch(compactSource, /intent[^\n]+mode[^\n]+canvasTitle/)
  assert.match(drawerSource, /function compactWorkflowJsonMarkdownContent/)
  assert.match(drawerCompactSource, /readableSummary/)
  assert.match(drawerCompactSource, /需求切片/)
  assert.match(drawerCompactSource, /页面与流程/)
  assert.match(messageContentSource, /compactWorkflowJsonMarkdownContent\(message\?\.content\)/)
  assert.match(drawerSource, /const STRUCTURED_AGENT_INTERNAL_KEYS = \[[\s\S]*'intent'[\s\S]*'mode'[\s\S]*'canvasTitle'/)
})

test('workflow agent keeps proposal evidence and handled trace in the unified drawer', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const templateStart = drawerSource.indexOf('<details v-if="messageTraceItems(message).length && !isMessageBusy(message)"')
  const templateEnd = drawerSource.indexOf('<p v-if="messageErrorText(message)"', templateStart)
  const templateSource = drawerSource.slice(templateStart, templateEnd)
  const evidenceStart = drawerSource.indexOf('function messageProposalEvidence')
  const evidenceEnd = drawerSource.indexOf('function proposalEvidenceKey', evidenceStart)
  const evidenceSource = drawerSource.slice(evidenceStart, evidenceEnd)
  const structuredStart = drawerSource.indexOf('function isStructuredAgentInternalKey')
  const structuredEnd = drawerSource.indexOf('function humanizeStructuredAgentKey', structuredStart)
  const structuredSource = drawerSource.slice(structuredStart, structuredEnd)

  assert.match(templateSource, /visibleTraceSummary\(message\)/)
  assert.match(templateSource, /&& !isMessageBusy\(message\)/)
  assert.match(drawerSource, /return `已处理 \$\{items\.length\} 项`/)
  assert.match(templateSource, /agent-proposal-evidence/)
  assert.match(templateSource, /提案依据/)
  assert.match(evidenceSource, /messageProposalSummary\(message\)/)
  assert.match(evidenceSource, /rationale/)
  assert.match(evidenceSource, /contextSources/)
  assert.match(drawerSource, /function messageProposalSummary/)
  assert.match(drawerSource, /extractStructuredAgentJson\(message\?\.content\)/)
  assert.match(structuredSource, /proposal|structuredProposal|agentProposal/)
})

test('all workflow skills share one agent shell while medium and large modes are hidden', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const shellStart = appSource.indexOf('<WorkflowAgentDrawer')
  const shellEnd = appSource.indexOf('/>', shellStart)
  const shellSource = appSource.slice(shellStart, shellEnd)

  assert.match(appSource, /const workflowAgentDisplayMode = ref\('hidden'\)/)
  assert.match(appSource, /const workflowAgentShellVisible = computed/)
  assert.match(appSource, /function setWorkflowAgentDisplayMode\(mode = 'sidebar'\)/)
  assert.match(appSource, /function showWorkflowAgentInline\(\)/)
  assert.match(appSource, /function showWorkflowAgentSidebar\(\)/)
  assert.match(appSource, /function showWorkflowAgentFullscreen\(\)/)
  assert.equal((appSource.match(/<WorkflowAgentDrawer/g) || []).length, 1)
  assert.match(drawerSource, /AGENT_SINGLE_SHELL_CONTRACT/)
  assert.match(drawerSource, /只能有同一套 Agent/)
  assert.match(drawerSource, /displayMode 的不同状态/)
  assert.match(drawerSource, /不能再拆成大 Agent \/ 小 Agent \/ 阶段专用 Agent/)
  assert.match(appSource, /class="workflow-stage-agent-workbench-anchor"/)
  assert.match(shellSource, /v-if="workflowAgentShellVisible"/)
  assert.match(shellSource, /:embedded="workflowAgentDisplayMode === 'inline'"/)
  assert.match(shellSource, /:display-mode="workflowAgentDisplayMode"/)
  assert.match(shellSource, /:can-inline="false"/)
  assert.match(shellSource, /:can-large-modes="false"/)
  assert.match(shellSource, /@change-display-mode="setWorkflowAgentDisplayMode"/)
  assert.doesNotMatch(appSource, /!workflowUsesEmbeddedAgent && workflowAgentOpen && workflowAgentSession/)
  assert.match(drawerSource, /displayMode: \{ type: String, default: '' \}/)
  assert.match(drawerSource, /canInline: \{ type: Boolean, default: false \}/)
  assert.match(drawerSource, /const resolvedDisplayMode = computed/)
  assert.match(drawerSource, /'agent-drawer-sidebar'/)
  assert.match(drawerSource, /'agent-drawer-fullscreen'/)
  assert.match(drawerSource, /emit\('change-display-mode', 'fullscreen'\)/)
  assert.match(drawerSource, /emit\('change-display-mode', 'sidebar'\)/)
  assert.doesNotMatch(appSource, /UxAgentDrawer|DialogueAgentDrawer|TotalFlowAgentDrawer/)
})

test('workflow agent uses one mounted host for panel sidebar and fullscreen modes', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const shellStart = appSource.indexOf('<WorkflowAgentDrawer')
  const shellEnd = appSource.indexOf('/>', shellStart)
  const shellSource = appSource.slice(shellStart, shellEnd)
  const slotStart = appSource.indexOf('<template #agent-workbench>')
  const slotEnd = appSource.indexOf('</template>', slotStart)
  const slotSource = appSource.slice(slotStart, slotEnd)
  const displaySource = appSource.slice(
    appSource.indexOf('function setWorkflowAgentDisplayMode'),
    appSource.indexOf('function showWorkflowAgentInline')
  )

  assert.equal((appSource.match(/<WorkflowAgentDrawer/g) || []).length, 1)
  assert.match(slotSource, /class="workflow-stage-agent-workbench-anchor"/)
  assert.doesNotMatch(slotSource, /<WorkflowAgentDrawer/)
  assert.match(shellSource, /v-if="workflowAgentShellVisible"/)
  assert.match(shellSource, /:display-mode="workflowAgentDisplayMode"/)
  assert.match(shellSource, /:can-inline="false"/)
  assert.match(shellSource, /:can-large-modes="false"/)
  assert.match(shellSource, /:inline-width="workflowAgentInlineWidth"/)
  assert.match(shellSource, /@start-inline-resize="startWorkflowAgentInlineResize"/)
  assert.match(appSource, /const workflowCanUseInlineAgent = computed/)
  assert.doesNotMatch(displaySource, /normalizedMode === 'inline' && !workflowUsesEmbeddedAgent/)
  assert.match(appSource, /function workflowDefaultAgentDisplayMode/)
  assert.match(appSource, /return 'sidebar'/)
})

test('workflow agent retrieves project knowledge for stage and node scopes before model replies', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const retrieveSource = appSource.slice(
    appSource.indexOf('async function retrieveWorkflowKnowledge'),
    appSource.indexOf('function workflowAgentStatusLabel')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )
  const contextSource = appSource.slice(
    appSource.indexOf('function workflowAgentRequestContext'),
    appSource.indexOf('function workflowAgentKnowledgeProjectId')
  )
  const knowledgeProjectSource = appSource.slice(
    appSource.indexOf('function workflowAgentAllowsProjectKnowledge'),
    appSource.indexOf('function workflowAgentKnowledgeQuery')
  )

  assert.match(appSource, /function workflowAgentAllowsProjectKnowledge/)
  assert.match(knowledgeProjectSource, /state\.activeWorkflowRun\?\.demandScope \|\| workflowForm\.demandScope/)
  assert.match(knowledgeProjectSource, /return runScope === 'project'/)
  assert.match(knowledgeProjectSource, /if \(!workflowAgentAllowsProjectKnowledge\(\)\) return ''/)
  assert.match(retrieveSource, /const queryText = workflowAgentKnowledgeQuery\(trimmed,\s*scopeId\)/)
  assert.match(retrieveSource, /if \(!trimmed \|\| !workflowAgentAllowsProjectKnowledge\(\) \|\| !projectId\) return \{ items: \[\], error: null, skipped: !projectId \|\| !workflowAgentAllowsProjectKnowledge\(\) \}/)
  assert.match(retrieveSource, /query:\s*queryText/)
  assert.doesNotMatch(sendSource, /const skipKnowledgeRetrieval = usesDialogueStyleAgent/)
  assert.doesNotMatch(sendSource, /skipKnowledgeRetrieval\s*\?/)
  assert.match(sendSource, /await retrieveWorkflowKnowledge\(content,\s*contextNodeId \|\| targetScopeId\)/)
  assert.match(contextSource, /knowledgeRetrievalError/)
  assert.match(appSource, /function workflowAgentKnowledgeQuery/)
  assert.match(appSource, /workflowStageNameById\(scopeId\)/)
  assert.match(appSource, /node\.title/)
  assert.match(appSource, /node\.summary/)
})

test('single workflow agent defaults to full-width inline mode and resizes horizontally', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const inlineStart = appSource.indexOf('<WorkflowAgentDrawer')
  const inlineEnd = appSource.indexOf('/>', inlineStart)
  const inlineSource = appSource.slice(inlineStart, inlineEnd)
  const resizeStart = appSource.indexOf('function startWorkflowAgentInlineResize')
  const resizeEnd = appSource.indexOf('async function addFeishuReferencePlaceholder', resizeStart)
  const resizeSource = appSource.slice(resizeStart, resizeEnd)
  const embeddedStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer.agent-drawer-embedded'),
    styleSource.indexOf('.agent-drawer.agent-drawer-fullscreen', styleSource.indexOf('.agent-drawer.agent-drawer-embedded'))
  )

  assert.match(appSource, /const workflowAgentInlineWidth = ref\('100vw'\)/)
  assert.match(inlineSource, /:inline-width="workflowAgentInlineWidth"/)
  assert.match(inlineSource, /@start-inline-resize="startWorkflowAgentInlineResize"/)
  assert.match(drawerSource, /inlineWidth: \{ type: String, default: '100vw' \}/)
  assert.match(drawerSource, /'--agent-inline-width': props\.inlineWidth/)
  assert.match(drawerSource, /resolvedDisplayMode === 'inline'" class="agent-inline-resize-handle" type="button" aria-label="拖拽调整 Agent 宽度"/)
  assert.match(drawerSource, /'start-inline-resize'/)
  assert.match(styleSource, /\.agent-drawer\.agent-drawer-embedded\s*\{[\s\S]*right:\s*0/)
  assert.match(styleSource, /\.agent-drawer\.agent-drawer-embedded\s*\{[\s\S]*left:\s*auto/)
  assert.match(styleSource, /\.agent-drawer\.agent-drawer-embedded\s*\{[\s\S]*width:\s*min\(var\(--agent-inline-width, 100vw\), 100vw\)/)
  assert.match(embeddedStyle, /border-left:\s*0/)
  assert.doesNotMatch(embeddedStyle, /border-left:\s*1px solid #e1e6ef/)
  assert.match(styleSource, /\.agent-drawer\.agent-drawer-embedded\s*\{[\s\S]*box-shadow:\s*-18px 0 42px rgba\(15, 23, 42, 0\.08\)/)
  assert.match(styleSource, /\.agent-inline-resize-handle\s*\{[\s\S]*cursor:\s*ew-resize/)
  assert.match(styleSource, /\.agent-inline-resize-handle::after\s*\{[\s\S]*opacity:\s*0/)
  assert.match(resizeSource, /const startX = event\?\.clientX \|\| 0/)
  assert.match(resizeSource, /const startWidth = drawerElement\?\.getBoundingClientRect\?\.\(\)\.width \|\| window\.innerWidth/)
  assert.match(resizeSource, /workflowAgentInlineWidth\.value = `\$\{Math\.min\(maxWidth, Math\.max\(minWidth, startWidth \+ delta\)\)\}px`/)
  assert.doesNotMatch(appSource, /LargeAgent|SmallAgent|WorkflowLargeAgent|WorkflowSmallAgent/)
})

test('inline workflow agent removes top dead space and reveals resize line only on interaction', async () => {
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const embeddedHeadStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-drawer-head'),
    styleSource.indexOf('.agent-drawer-embedded .agent-node-switcher', styleSource.indexOf('.agent-drawer-embedded .agent-drawer-head'))
  )
  const embeddedTitleStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-title-row'),
    styleSource.indexOf('.agent-drawer-embedded .agent-chat-list', styleSource.indexOf('.agent-drawer-embedded .agent-title-row'))
  )
  const embeddedChatStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer-embedded .agent-chat-list'),
    styleSource.indexOf('.agent-drawer-embedded .agent-message', styleSource.indexOf('.agent-drawer-embedded .agent-chat-list'))
  )
  const handleStyle = styleSource.slice(
    styleSource.indexOf('.agent-inline-resize-handle::after'),
    styleSource.indexOf('.agent-drawer-head', styleSource.indexOf('.agent-inline-resize-handle::after'))
  )

  assert.match(embeddedHeadStyle, /padding:\s*0 var\(--agent-inline-gutter\)/)
  assert.match(embeddedHeadStyle, /align-items:\s*center/)
  assert.match(embeddedTitleStyle, /align-items:\s*center/)
  assert.match(embeddedChatStyle, /padding:\s*16px var\(--agent-inline-gutter\) 36px/)
  assert.doesNotMatch(embeddedChatStyle, /padding:\s*40px 56px 36px/)
  assert.match(handleStyle, /\.agent-inline-resize-handle::after\s*\{[\s\S]*opacity:\s*0/)
  assert.match(handleStyle, /\.agent-inline-resize-handle:hover::after,\s*\.agent-inline-resize-handle:focus-visible::after,\s*\.agent-drawer\.is-resizing \.agent-inline-resize-handle::after\s*\{[\s\S]*opacity:\s*1/)
  assert.match(appSource, /workflowAgentInlineResizing\.value = true/)
  assert.match(appSource, /workflowAgentInlineResizing\.value = false/)
})

test('inline workflow agent sits above the canvas chrome while staying the single drawer', async () => {
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const workbenchStyle = styleSource.slice(
    styleSource.indexOf('.workflow-stage-agent-workbench'),
    styleSource.indexOf('.workflow-canvas-scrollarea', styleSource.indexOf('.workflow-stage-agent-workbench'))
  )
  const embeddedStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer.agent-drawer-embedded'),
    styleSource.indexOf('.agent-drawer.agent-drawer-fullscreen', styleSource.indexOf('.agent-drawer.agent-drawer-embedded'))
  )

  assert.match(workbenchStyle, /position:\s*fixed/)
  assert.match(workbenchStyle, /top:\s*112px/)
  assert.match(workbenchStyle, /left:\s*0/)
  assert.match(workbenchStyle, /right:\s*0/)
  assert.match(workbenchStyle, /bottom:\s*0/)
  assert.match(workbenchStyle, /z-index:\s*160/)
  assert.match(workbenchStyle, /pointer-events:\s*none/)
  assert.match(workbenchStyle, /background:\s*transparent/)
  assert.doesNotMatch(workbenchStyle, /background:\s*#fff/)
  assert.match(embeddedStyle, /z-index:\s*var\(--z-agent-embedded\)/)
  assert.match(embeddedStyle, /pointer-events:\s*auto/)
  assert.match(styleSource, /\.agent-inline-resize-handle\s*\{[\s\S]*z-index:\s*calc\(var\(--z-agent-embedded\) \+ 1\)/)
  assert.match(styleSource, /\.workflow-canvas-topbar\s*\{[\s\S]*z-index:\s*var\(--z-workflow-topbar\)/)
  assert.match(styleSource, /\.workflow-canvas-tabs\s*\{[\s\S]*z-index:\s*5/)
  assert.match(appSource, /<WorkflowAgentDrawer[\s\S]*:display-mode="workflowAgentDisplayMode"[\s\S]*@start-inline-resize="startWorkflowAgentInlineResize"/)
  assert.doesNotMatch(appSource, /LargeAgent|SmallAgent|WorkflowLargeAgent|WorkflowSmallAgent/)
})

test('workflow agent hides internal model preambles and uses trace loader for pending replies', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const contentSource = drawerSource.slice(
    drawerSource.indexOf('function messageContent'),
    drawerSource.indexOf('function isLegacyPlaceholderAgentMessage')
  )
  const pendingTemplateSource = drawerSource.slice(
    drawerSource.indexOf('<div class="agent-message-body">'),
    drawerSource.indexOf('<div v-if="isEditingMessage(message)" class="agent-message-edit-actions">')
  )
  const streamSource = appSource.slice(
    appSource.indexOf('function workflowAgentStreamDisplayContent'),
    appSource.indexOf('function workflowAgentTraceFromProgress')
  )
  const appSanitizeSource = appSource.slice(
    appSource.indexOf('function sanitizeWorkflowAgentModelLeakText'),
    appSource.indexOf('function workflowAgentStreamDisplayContent')
  )

  assert.match(drawerSource, /function sanitizeAgentMessageDisplayContent/)
  assert.match(contentSource, /sanitizeAgentMessageDisplayContent/)
  assert.match(streamSource, /sanitizeWorkflowAgentModelLeakText/)
  assert.match(appSanitizeSource, /using-superpowers/)
  assert.match(pendingTemplateSource, /v-else-if="shouldShowThinkingLoader\(message\)"/)
  assert.match(pendingTemplateSource, /agent-thinking-loader/)
  assert.match(pendingTemplateSource, /agent-pending-trace-disclosure/)
  assert.doesNotMatch(pendingTemplateSource, /agent-thinking-dots/)
  assert.doesNotMatch(pendingTemplateSource, /agent-dot-loader/)
  assert.doesNotMatch(styleSource, /\.agent-thinking-dots/)
  assert.doesNotMatch(styleSource, /\.agent-dot-loader/)
  assert.match(styleSource, /\.agent-thinking-loader/)
  assert.match(styleSource, /\.agent-trace-disclosure/)
})

test('workflow agent uses trace thinking loader only before streamed content arrives', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )

  assert.match(appSource, /function workflowAgentPendingTraceItems/)
  assert.match(sendSource, /trace:\s*workflowAgentPendingTraceItems\(\)/)
  assert.doesNotMatch(sendSource, /trace:\s*usesDialogueStyleAgent\s*\?/)
  assert.doesNotMatch(sendSource, /assistantMessage\.trace = usesDialogueStyleAgent/)
  assert.match(drawerSource, /v-else-if="shouldShowThinkingLoader\(message\)" class="agent-thinking-loader"/)
  assert.match(drawerSource, /function shouldShowThinkingLoader\(message = \{\}\)[\s\S]*return isMessageBusy\(message\) && !messageContent\(message\)\.trim\(\)/)
  assert.match(drawerSource, /messageTraceItems\(message\)\.length/)
})

test('workflow agent shows only one active loading reply and avoids duplicate trace headings', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const templateSource = drawerSource.slice(
    drawerSource.indexOf('<article'),
    drawerSource.indexOf('<div v-if="isEditingMessage(message)" class="agent-message-edit-actions">')
  )
  const visibleSource = drawerSource.slice(
    drawerSource.indexOf('const visibleMessages = computed'),
    drawerSource.indexOf('const visibleHistoryItems = computed')
  )
  const sendSource = appSource.slice(
    appSource.indexOf('async function sendWorkflowAgentMessage'),
    appSource.indexOf('function useWorkflowAgentQuickReply')
  )

  assert.match(drawerSource, /function latestBusyAssistantIndex/)
  assert.match(visibleSource, /const latestBusyIndex = latestBusyAssistantIndex\(messages\)/)
  assert.match(visibleSource, /isMessageBusy\(message\) && messageRole\(message\) === 'assistant' && index !== latestBusyIndex/)
  assert.match(appSource, /function removeWorkflowAgentBusyMessages/)
  assert.match(sendSource, /removeWorkflowAgentBusyMessages\(targetScopeId\)/)
  assert.doesNotMatch(templateSource, /<details v-if="messageTraceItems\(message\)\.length" class="agent-trace-disclosure">/)
  assert.match(templateSource, /<details v-if="messageTraceItems\(message\)\.length && !isMessageBusy\(message\)" class="agent-trace-disclosure">/)
})

test('workflow agent pending trace keeps only text summary visible until expanded', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const pendingTemplateSource = drawerSource.slice(
    drawerSource.indexOf('<div v-else-if="shouldShowThinkingLoader(message)" class="agent-thinking-loader"'),
    drawerSource.indexOf("<pre v-else-if=\"messageRole(message) === 'user'\"", drawerSource.indexOf('<div v-else-if="shouldShowThinkingLoader(message)" class="agent-thinking-loader"'))
  )
  const embeddedStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer.agent-drawer-embedded'),
    styleSource.indexOf('.agent-drawer.agent-drawer-fullscreen', styleSource.indexOf('.agent-drawer.agent-drawer-embedded'))
  )
  const workbenchStyle = styleSource.slice(
    styleSource.indexOf('.workflow-stage-agent-workbench'),
    styleSource.indexOf('.workflow-canvas-scrollarea', styleSource.indexOf('.workflow-stage-agent-workbench'))
  )
  const thinkingStyle = styleSource.slice(
    styleSource.indexOf('.agent-thinking-loader'),
    styleSource.indexOf('.agent-markdown-message', styleSource.indexOf('.agent-thinking-loader'))
  )

  assert.match(pendingTemplateSource, /<details v-if="messageTraceItems\(message\)\.length" class="agent-pending-trace-disclosure">/)
  assert.match(pendingTemplateSource, /<summary class="agent-trace-summary agent-pending-trace-summary">/)
  assert.match(pendingTemplateSource, /visibleTraceSummary\(message\)/)
  assert.match(pendingTemplateSource, /agent-trace-typewriter-running/)
  assert.doesNotMatch(pendingTemplateSource, /<ol v-if="messageTraceItems\(message\)\.length" class="agent-trace-timeline"/)
  assert.match(thinkingStyle, /\.agent-pending-trace-disclosure:not\(\[open\]\) \.agent-trace-timeline\s*\{[\s\S]*display:\s*none/)
  assert.match(thinkingStyle, /border:\s*0/)
  assert.match(thinkingStyle, /background:\s*transparent/)
  assert.match(embeddedStyle, /top:\s*var\(--workflow-agent-embedded-top\)/)
  assert.match(embeddedStyle, /height:\s*calc\(100vh - var\(--workflow-agent-embedded-top\)\)/)
  assert.match(embeddedStyle, /max-height:\s*calc\(100vh - var\(--workflow-agent-embedded-top\)\)/)
  assert.match(workbenchStyle, /top:\s*112px/)
})

test('workflow agent completed replies render as plain conversation without completed status chips', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const metaSource = drawerSource.slice(
    drawerSource.indexOf('function messageMetaItems'),
    drawerSource.indexOf('function shouldShowMessageMeta')
  )

  assert.match(metaSource, /if \(status === 'success'\) return \[\]/)
  assert.doesNotMatch(metaSource, /label:\s*messageStatusLabel\(message\)[\s\S]{0,120}status-success/)
})

test('workflow agent structured results render like agent markdown instead of nested cards', async () => {
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const richStart = styleSource.indexOf('.agent-rich-message {')
  const richEnd = styleSource.indexOf('.agent-content-card', richStart)
  const richSource = styleSource.slice(richStart, richEnd)

  assert.match(richSource, /\.agent-rich-message\s*\{[\s\S]*font-size:\s*17px/)
  assert.match(richSource, /\.agent-rich-message-section\s*\{[\s\S]*margin-top:\s*14px/)
  assert.doesNotMatch(richSource, /border:\s*1px/)
  assert.doesNotMatch(richSource, /background:\s*#f8fafc/)
  assert.doesNotMatch(richSource, /border-radius:\s*12px/)
  assert.doesNotMatch(richSource, /padding:\s*12px/)
})

test('workflow agent normalizes inline markdown headings from model replies', async () => {
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const markdownSource = drawerSource.slice(
    drawerSource.indexOf('function markdownAgentMessageContent'),
    drawerSource.indexOf('function messageStructuredContent')
  )
  const normalizeSource = drawerSource.slice(
    drawerSource.indexOf('function normalizeAgentMarkdownText'),
    drawerSource.indexOf('function markdownAgentMessageContent')
  )

  assert.match(drawerSource, /function normalizeAgentMarkdownText/)
  assert.match(markdownSource, /normalizeAgentMarkdownText\(content\)/)
  assert.match(normalizeSource, /replace\(\s*\/\\s\+\(#\{2,3\}\)\\s\+\/g/)
})

test('ux confirmation fullscreen keeps stage structure after the live node output', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')

  assert.match(appSource, /mode:\s*'agent-confirmation'/)
  assert.match(appSource, /confirmation:\s*\{/)
  assert.match(appSource, /currentUnderstanding/)
  assert.match(appSource, /confirmedFacts/)
  assert.match(appSource, /aiAssumptions/)
  assert.match(appSource, /openQuestions/)
  assert.match(appSource, /nextSuggestions/)

  assert.match(canvasSource, /function isAgentConfirmationNode/)
  assert.match(canvasSource, /showNodeOwnContentSummary\(fullscreenNode\)/)
  assert.match(canvasSource, /agent-confirmation-fullscreen/)
  assert.match(canvasSource, /agentConfirmationSections/)
  assert.match(canvasSource, /function nodeContentConfirmationSections\(node = \{\}\)/)
  assert.match(canvasSource, /const liveSections = nodeContentConfirmationSections\(node\)/)
  assert.match(canvasSource, /if \(liveSections\.length\) return liveSections/)
  assert.match(canvasSource, /node\.detailSections/)
  assert.match(canvasSource, /当前理解/)
  assert.match(canvasSource, /已确认事实/)
  assert.match(canvasSource, /AI 推断/)
  assert.match(canvasSource, /待确认问题/)
  assert.match(canvasSource, /下一步建议/)
  assert.match(canvasSource, /v-else-if="isAgentConfirmationNode\(fullscreenNode\)"/)
  assert.match(
    canvasSource,
    /showModelReturnSummary\(fullscreenNode\) && !isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !shouldUseRequirementReportDetail\(fullscreenNode\) && !shouldUseRequirementPipelineDetail\(fullscreenNode\)/,
    'stage-specific page details should not be preceded by the generic model return card'
  )
  assert.match(canvasSource, /v-if="!isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !isAgentConfirmationNode\(fullscreenNode\) && !shouldUseRequirementPipelineDetail\(fullscreenNode\) && !shouldUseRequirementSectionDetail\(fullscreenNode\)" v-show="!isFullscreenEditing\(fullscreenNode\)" class="canvas-detail-tree"/)
  assert.doesNotMatch(canvasSource, /<template v-if="!isAgentConfirmationNode\(fullscreenNode\)">/)
  assert.doesNotMatch(canvasSource, /v-for="section in visibleFullscreenDetailSections\(fullscreenNode\)"/)
})

test('ux confirmation start sends entry input into agent analysis instead of only showing intro copy', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const startSource = appSource.slice(
    appSource.indexOf('async function startUxDesignConfirmationAgent'),
    appSource.indexOf('async function analyzeWorkflowDocuments')
  )

  assert.match(appSource, /function uxConfirmationInitialAnalysisPrompt/)
  assert.match(startSource, /const initialAnalysisPrompt = uxConfirmationInitialAnalysisPrompt\(workflowEntrySnapshot\.input\)/)
  assert.match(startSource, /await nextTick\(\)/)
  assert.match(startSource, /await sendWorkflowAgentMessage\(initialAnalysisPrompt,\s*\{/)
  assert.match(startSource, /action:\s*'ux-confirmation-initial-analysis'/)
  assert.match(startSource, /ignoreDraftState:\s*true/)
})

test('ux confirmation fullscreen removes duplicated stage hero copy', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.doesNotMatch(canvasSource, /<span>当前环节<\/span>/)
  assert.doesNotMatch(canvasSource, /agent-confirmation-hero/)
  assert.doesNotMatch(canvasSource, /<span>当前阶段<\/span>/)
  assert.doesNotMatch(styleSource, /\.agent-confirmation-hero/)
})

test('fullscreen node detail does not duplicate node own sections below the main content', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const fullscreenStart = canvasSource.indexOf('<div v-if="fullscreenNode"')
  const fullscreenSource = canvasSource.slice(fullscreenStart, canvasSource.indexOf('</template>', fullscreenStart))

  assert.match(fullscreenSource, /showNodeOwnContentSummary\(fullscreenNode\)/)
  assert.doesNotMatch(fullscreenSource, /visibleFullscreenDetailSections\(fullscreenNode\)/)
  assert.doesNotMatch(fullscreenSource, /class="canvas-detail-section"/)
})

test('ux confirmation fullscreen hides current understanding and confirmed facts panels', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const fullscreenStart = canvasSource.indexOf('v-else-if="isAgentConfirmationNode(fullscreenNode)"')
  const fullscreenEnd = canvasSource.indexOf('<div v-if="isPureContentNode(fullscreenNode)"', fullscreenStart)
  const fullscreenConfirmationSource = canvasSource.slice(fullscreenStart, fullscreenEnd)

  assert.match(canvasSource, /function visibleAgentConfirmationSections\(node = \{\}\)/)
  assert.match(fullscreenConfirmationSource, /visibleAgentConfirmationSections\(fullscreenNode\)/)
  assert.doesNotMatch(fullscreenConfirmationSource, /agentConfirmationSections\(fullscreenNode\)/)
  assert.match(canvasSource, /!\['当前理解', '已确认事实', '待确认问题'\]\.includes\(section\.title\)/)
  assert.match(canvasSource, /sortAgentConfirmationSections/)
  assert.match(canvasSource, /section\.title === '待确认问题'/)
  assert.match(canvasSource, /class="canvas-detail-right-questions"/)
  assert.match(canvasSource, /fullscreenRightQuestions\(fullscreenNode\)/)
})

test('fullscreen detail text wraps inside the viewport instead of overflowing horizontally', async () => {
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const contentStyle = styleSource.slice(
    styleSource.indexOf('.canvas-fullscreen-content'),
    styleSource.indexOf('.canvas-detail-overview')
  )
  const overviewStyle = styleSource.slice(
    styleSource.indexOf('.canvas-detail-overview'),
    styleSource.indexOf('.canvas-model-return-summary')
  )
  const textWrapStyle = styleSource.slice(
    styleSource.indexOf('.canvas-fullscreen-content :where('),
    styleSource.indexOf('.canvas-path-graph', styleSource.indexOf('.canvas-fullscreen-content :where('))
  )

  assert.match(contentStyle, /min-width:\s*0/)
  assert.match(overviewStyle, /min-width:\s*0/)
  assert.match(textWrapStyle, /overflow-wrap:\s*anywhere/)
  assert.match(textWrapStyle, /word-break:\s*break-word/)
  assert.match(textWrapStyle, /max-width:\s*100%/)
})

test('non-confirmation fullscreen spreads content across the full page', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const modalShellStyle = styleSource.slice(
    styleSource.indexOf('.canvas-fullscreen-modal > section'),
    styleSource.indexOf('.canvas-fullscreen-modal header')
  )
  const contentStyle = styleSource.slice(
    styleSource.indexOf('.canvas-fullscreen-content'),
    styleSource.indexOf('.canvas-detail-overview')
  )
  const detailTreeStyle = styleSource.slice(
    styleSource.indexOf('.canvas-fullscreen-content .canvas-detail-tree'),
    styleSource.indexOf('.canvas-fullscreen-content .canvas-tree-node')
  )
  const nodeOwnStyle = styleSource.slice(
    styleSource.indexOf('.canvas-node-own-summary'),
    styleSource.indexOf('.canvas-node-own-summary header')
  )

  assert.match(canvasSource, /v-if="!isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !isAgentConfirmationNode\(fullscreenNode\) && !shouldUseRequirementPipelineDetail\(fullscreenNode\) && !shouldUseRequirementSectionDetail\(fullscreenNode\)" v-show="!isFullscreenEditing\(fullscreenNode\)" class="canvas-detail-tree"/)
  assert.match(modalShellStyle, /width:\s*100%/)
  assert.match(modalShellStyle, /height:\s*100%/)
  assert.match(contentStyle, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(360px,\s*1fr\)\)/)
  assert.doesNotMatch(detailTreeStyle, /height:\s*320px/)
  assert.doesNotMatch(detailTreeStyle, /max-height:\s*320px/)
  assert.doesNotMatch(nodeOwnStyle, /max-height:\s*320px/)
})

test('confirmation fullscreen and agent drawer keep bounded scroll frames', async () => {
  const canvasSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../frontend/src/features/workflow/components/WorkflowAgentDrawer.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')
  const confirmationFrameStyle = styleSource.slice(
    styleSource.indexOf('.agent-confirmation-frame'),
    styleSource.indexOf('.agent-confirmation-panel small')
  )
  const drawerStyle = styleSource.slice(
    styleSource.indexOf('.agent-drawer {'),
    styleSource.indexOf('.agent-drawer.agent-drawer-embedded')
  )
  const chatRegionStyle = styleSource.slice(
    styleSource.indexOf('.agent-chat-region'),
    styleSource.indexOf('.agent-chat-list', styleSource.indexOf('.agent-chat-region'))
  )
  const aiSummaryStyle = styleSource.slice(
    styleSource.indexOf('.agent-ai-summary-panel {'),
    styleSource.indexOf('.agent-ai-summary-panel > small')
  )
  const workflowStyleSource = await readFile(new URL('../frontend/src/features/workflow/styles.css', import.meta.url), 'utf8')
  const workflowDrawerStyle = workflowStyleSource.slice(
    workflowStyleSource.indexOf('.agent-drawer {'),
    workflowStyleSource.indexOf('.agent-message-body')
  )

  assert.match(canvasSource, /class="agent-confirmation-frame"/)
  assert.match(confirmationFrameStyle, /height:\s*320px/)
  assert.match(confirmationFrameStyle, /max-height:\s*320px/)
  assert.match(confirmationFrameStyle, /border:\s*1px solid #e8eaec/)
  assert.match(confirmationFrameStyle, /overflow-y:\s*auto/)
  assert.match(drawerSource, /<div class="agent-dialog-body">/)
  assert.match(drawerStyle, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto auto/)
  assert.match(drawerStyle, /overflow:\s*hidden/)
  assert.match(workflowDrawerStyle, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto auto/)
  assert.match(aiSummaryStyle, /max-height:\s*clamp\(180px,\s*32vh,\s*320px\)/)
  assert.match(aiSummaryStyle, /overflow-y:\s*auto/)
  assert.match(chatRegionStyle, /overflow:\s*hidden/)
})
