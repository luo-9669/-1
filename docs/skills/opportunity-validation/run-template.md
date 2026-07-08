# Opportunity Validation Run Template

## 运行目标

对当前项目执行机会验证，基于真实路径、蓝图、Demo、状态机和 QA 结果，输出三轮评审后的可执行迭代方案。

## 输入

```json
{
  "projectId": "",
  "projectName": "",
  "projectProfile": {
    "positioning": "",
    "targetUsers": "",
    "stage": "",
    "primaryGoal": ""
  },
  "materials": {
    "documents": [],
    "knowledgeBase": [],
    "conversationSignals": [],
    "competitors": [],
    "referenceSites": [],
    "currentDemoHtml": ""
  },
  "currentArtifacts": {
    "blueprints": [],
    "interactionSkillV3": {},
    "demoSchema": {},
    "stateMachines": [],
    "qaProtocol": {}
  },
  "focus": [
    "竞品流程对比",
    "竞品为什么这样做",
    "我们如何做得更好",
    "完整路径模拟",
    "用户行为意图",
    "信息优先级",
    "页面/弹窗/二级页面判断",
    "新页签/抽屉/内联面板判断",
    "路径跳转和返回状态",
    "错误反馈位置和恢复动作",
    "主功能/同级功能/二级功能判断",
    "区域位置排布",
    "区域重叠检查",
    "真实痛点",
    "机会点",
    "方案形态",
    "功能排序",
    "三轮评审",
    "迭代计划"
  ]
}
```

## 竞品/参考产品输入

优先使用用户指定的竞品；如果没有指定，至少选择：

```json
{
  "directCompetitors": ["同类 PM/UX/AI agent 工具"],
  "indirectCompetitors": ["Coze", "Notion AI", "Feishu/Lark", "Copilot Studio"],
  "benchmarkProducts": ["Figma", "Linear", "Cursor", "Lovable"]
}
```

每个竞品必须围绕同一个任务比较：

```json
{
  "task": "上传产品文档并得到可评审的流程蓝图和交互 Demo",
  "compareDimensions": [
    "入口在哪里",
    "输入方式",
    "空状态",
    "上传位置",
    "生成中反馈",
    "人工确认",
    "失败恢复",
    "产物沉淀",
    "继续刷新/版本对比",
    "交付到开发"
  ]
}
```

## 必跑路径

1. 新用户不输入，直接体验。
2. 上传文档，生成蓝图。
3. 查看交互路径树和 Skill v3。
4. 生成 1:1 Demo。
5. 切换风格和交互方式。
6. 上传失败后恢复。
7. Demo 生成失败或空白兜底。
8. 修改需求后重新生成。
9. 保存资产、导出 Markdown、导入知识库。
10. 返回并修改方案后继续生成。

## 必提取的 UX 证据

从当前需求资料、对话记录、设计文档和页面验证里提取：

- 用户正在做什么、想完成什么、想先看到什么。
- 用户认为不需要、过早、干扰主路径的信息，并把它们标为最低等级或移出当前路径。
- 什么时候用弹窗、页面、二级页面、抽屉、内联面板、新页签、toast 或状态页。
- 路径如何跳转，返回时保留什么状态：草稿、筛选、滚动、选中项、生成结果。
- 错误应该报在哪里、报什么、是否展示原因、用户下一步如何恢复。
- 哪个功能是主要功能，哪些是同级功能，哪些是二级/三级/最低优先级功能。
- 入口、首页、主路径、二级页面、详情区、设置/上下文入口应该放在哪个区域。
- 区域是否重叠：视觉焦点、点击目标、导航层级、阅读顺序、弹窗/抽屉/预览区是否互相竞争。

## 输出要求

必须输出：

```json
{
  "behaviorIntentMatrix": [],
  "conversationEvidenceMap": [],
  "designSchemeDecisionMatrix": [],
  "competitorWorkflowAnalysis": {
    "comparisonTasks": [],
    "competitorFlowMatrix": [],
    "patternReasoning": [],
    "referenceDecisions": [],
    "differentiationStrategy": []
  },
  "topOpportunities": [],
  "journeyEvidence": [],
  "surfaceDecisions": [],
  "priorityMap": [],
  "reviewRounds": [],
  "finalIterationPlan": [],
  "developmentTasks": []
}
```

## 验收

- 每个 P0/P1 机会点都有路径证据。
- 每个 P0/P1 机会点都说明用户当下想做什么、想看到什么、哪些信息不需要。
- 每个 P0/P1 机会点都说明竞品证据是否影响优先级。
- 每个参考竞品点都说明“为什么这么做、参考什么、不照搬什么、我们怎么更好”。
- 每个方案都有页面/二级页面/弹窗/抽屉/新页签/内联面板/toast/状态页等形态判断。
- 每个方案都有路径跳转、返回状态、错误反馈、恢复动作。
- 每个方案都说明主要功能、同级功能、二级功能、最低优先级功能。
- 每个方案都说明功能应该放在哪个区域，以及为什么。
- 每个方案都检查区域重叠、视觉竞争、点击目标冲突和阅读顺序。
- 每个功能都有优先级、权重、RICE、Kano 和金字塔层级。
- 三轮评审都产生修改项。
- 最终任务能直接进入开发。
