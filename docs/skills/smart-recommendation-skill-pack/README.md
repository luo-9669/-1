# 智能推荐 Skill 文档包

这个文档包用于把流程通内置的产品、UX、交互和项目蓝图 Skill 交付给团队阅读、评审和导入后台管理。核心默认框架是 `design-scheme-ux`：先判断用户行为、功能层级和页面形态，再补齐路径返回、状态错误、弹窗提示生命周期、前后端分工和接口契约。

## 包含 Skill

- `smart-recommendation-skill`：系统默认智能推荐 Skill，负责在用户没有手动选择 Skill 时组织完整 UX 决策链路。
- `default-general-design-skill`：默认通用 Skill，负责模糊需求诊断、知识检索和 Skill 推荐。
- `interaction-design-workflow`：交互方案生成流程，负责信息架构、任务流、页面结构、组件状态和交付拆解。
- `system-prd-interaction-plan`：PRD/交互方案生成，负责范围、流程、页面模块、状态异常和验收标准。
- `opportunity-validation`：机会验证 Skill，负责用户路径、竞品原因、差异化方案和优先级判断。
- `podcastor-product-flow`：Podcastor 产品体验流，负责 AI 播客工作站的产品路径和交付链路。

## 使用建议

1. 先用 `smart-recommendation-skill` 识别需求意图、信息缺口和应调用的专用 Skill。
2. 如果需求仍模糊，使用 `default-general-design-skill` 输出诊断卡和最多 3 个关键澄清问题。
3. 如果要落到交互设计，使用 `interaction-design-workflow` 生成结构、路径、状态和交付清单。
4. 如果要形成正式需求说明，使用 `system-prd-interaction-plan` 输出 PRD 级结构。
5. 如果要判断优先级和大厂参考，使用 `opportunity-validation` 做证据矩阵和机会排序。
6. 如果项目是 Podcastor 或 AI 播客工作站，使用 `podcastor-product-flow` 生成专用蓝图。

## 质量边界

- 所有输出必须区分项目事实、来源证据和 AI 推断。
- 方案必须覆盖页面、弹窗、抽屉、内联区、新页签、Toast、Banner、状态页等承载方式的选择原因。
- 交互方案必须包含加载、空状态、处理中、成功、部分成功、失败、权限、超时、未保存和恢复动作。
- 最终产物必须能被产品、UX、前端和后端共同评审。
