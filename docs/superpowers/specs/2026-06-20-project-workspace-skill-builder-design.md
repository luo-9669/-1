# 项目工作台与 Skill Builder 设计

## 背景

当前系统已经有项目诊断、流程运行、资产库、Skill 中心和资料库，但“当前项目”还只是一个顶部选择器，没有真正控制知识库、流程、资产和 Skill 的数据范围。

用户的目标不是做一个单页 Skill 演示，而是做一个产品/交互设计师能长期使用的 AI 项目工作台：每个项目有自己的知识、流程、资产和 Skill，AI 执行时必须知道当前项目背景，并且用户可以创建可编辑的 Skill。

本阶段目标是把系统从“功能页面集合”升级为“项目级 AI 设计工作台”。

## 产品目标

- 项目是系统的一级工作边界。
- 切换项目后，知识库、需求文档、竞品资料、资产、运行记录和项目 Skill 都随项目切换。
- 系统 Skill、我的通用 Skill、项目 Skill 能清晰区分。
- 新建 Skill 支持结构化表单字段，初级用户不用写 Markdown。
- 高级用户仍然可以切换到 Markdown 编辑。
- Skill 可以选择读取哪个项目、哪些资料类型、哪些知识条目。
- 流程运行每一步能给出多个方案选项，最后必须形成最终结论。

## 范围

### 本阶段包含

- 项目级数据归属和过滤。
- 旧本地数据迁移到默认项目。
- 项目创建和项目切换。
- Skill 可见范围：系统、我的通用、当前项目。
- Skill Builder 表单字段配置。
- Skill Builder 知识范围配置。
- 自建 Skill 编辑保存。
- 流程步骤生成 3 个候选方案。
- 最后一步完成后生成最终结论。
- 保存资产时主内容展示最终结论，运行链路隐藏保存。

### 本阶段不包含

- 多人协作权限。
- 后端数据库和账号体系。
- 真正向量检索服务。
- 真实大模型 API 接入。
- Figma 自动生成设计稿。
- 可视化流程编排器。

## 推荐信息架构

系统保留当前主导航：

- 项目诊断
- 流程运行
- 资产库
- Skill 中心
- 网页工厂
- 资料库
- 设置

顶部“当前项目”成为全局上下文。除网页工厂的页面采集能力外，主要数据页面默认读取当前项目。

项目切换后的规则：

- 资料库只显示当前项目的知识、需求和竞品。
- 资产库只显示当前项目资产。
- 项目诊断只读取当前项目资料。
- 流程运行创建的 run 归属当前项目。
- Skill 中心显示系统 Skill、我的通用 Skill、当前项目 Skill。
- 最近活动只显示当前项目运行记录。

## 项目模型

项目数据结构：

```js
{
  id,
  name,
  description,
  domain,
  targetUsers,
  stage,
  createdAt,
  updatedAt
}
```

阶段 `stage` 可选值：

- `discovery`：探索期
- `design`：设计中
- `delivery`：交付中
- `iteration`：迭代中

所有项目内数据增加 `projectId`：

- knowledge
- requirements
- competitors
- assets
- skillRuns
- activeWorkflowRun
- workflow assets

旧数据迁移规则：

- 如果数据没有 `projectId`，自动写入当前默认项目 `project-flow`。
- 如果没有项目列表，创建 `流程通默认项目`。
- 如果当前项目不存在，切回第一个项目。

## Skill 分层

Skill 分为三类：

### 系统 Skill

- `source: system`
- 全项目可见。
- 不允许直接覆盖原始定义。
- 可以复制为“我的 Skill”后编辑。

### 我的通用 Skill

- `source: user`
- `visibility: global`
- 所有项目可见。
- 用户可编辑。

### 项目 Skill

- `source: user`
- `visibility: project`
- 带 `projectId`
- 只在对应项目可见。
- 用户可编辑。

Skill 列表展示时需要标明：

- 系统
- 我的通用
- 当前项目
- 待审核

## Skill Builder 表单字段

Skill 增加 `inputFields`：

```js
{
  id,
  label,
  type,
  required,
  placeholder,
  helpText,
  options,
  defaultValue
}
```

字段类型：

- `text`：单行文本
- `textarea`：多行文本
- `single-select`：单选
- `multi-select`：多选
- `number`：数字
- `boolean`：开关

表单模式支持：

- 添加字段
- 删除字段
- 修改字段名
- 修改字段类型
- 设置必填
- 设置占位提示
- 设置选项

保存 Skill 时，旧的 `requiredInputs` 仍保留，用于 Markdown 导入和兼容；新的运行表单优先读取 `inputFields`。

## Skill 知识范围

Skill 增加 `knowledgeScopeConfig`：

```js
{
  mode,
  projectIds,
  itemIds,
  sourceTypes
}
```

`mode` 可选：

- `current-project`：当前项目
- `selected-projects`：指定项目
- `selected-items`：指定知识条目
- `all-projects`：全部项目

`sourceTypes` 可选：

- `knowledge`
- `requirements`
- `competitors`
- `assets`
- `designRules`

默认值：

```js
{
  mode: 'current-project',
  projectIds: [],
  itemIds: [],
  sourceTypes: ['knowledge', 'requirements', 'competitors', 'assets']
}
```

执行 Skill 时按该配置组装上下文。系统必须区分两类内容：

- 项目事实：来自知识库、需求、竞品、资产。
- AI 推断：根据事实和用户输入生成。

## Skill 编辑规则

- 新建 Skill 时默认 `visibility: project`，归属当前项目。
- 用户可以切换为“所有项目可用”。
- 编辑已有自建 Skill 时保留原 ID。
- 保存 Markdown 模式时解析为结构化 Skill，同时保留 Markdown 原文。
- 系统 Skill 被编辑时，不覆盖系统 Skill，而是复制成用户 Skill。

## 流程运行三选项

每个步骤生成结果时，除当前正文外，还生成 `candidateOptions`：

```js
{
  [stepId]: [
    {
      id,
      title,
      summary,
      content,
      tradeoffs
    }
  ]
}
```

默认生成 3 个选项：

- 低风险方案
- 推荐方案
- 完整方案

不同步骤可以调整命名，例如需求理解可使用：

- 保守理解
- 推荐理解
- 扩展理解

用户可以：

- 直接采纳当前正文。
- 点击某个候选方案，把它填入当前正文。
- 对候选方案提出质疑后重新生成。

## 最终结论

流程最后一步采纳后，系统自动生成 `finalConclusion`：

```js
{
  title,
  summary,
  recommendedPlan,
  keyDecisions,
  risks,
  openQuestions,
  nextTasks,
  createdAt
}
```

最终结论展示在流程页底部，并作为保存资产的主内容。

资产内容结构：

- 主内容：最终结论。
- 附录：每一步采纳结果。
- 隐藏运行链路：质疑记录、版本记录、候选方案记录。

这样资产库不会被过程记录挤满，但仍能追溯 AI 是怎么生成的。

## 关键用户流程

### 创建项目

1. 用户在顶部点击新建项目。
2. 填写项目名称、描述、领域、目标用户和阶段。
3. 系统创建项目并切换到该项目。
4. 资料库、资产库、流程运行变为空项目状态。

### 导入项目知识

1. 用户在资料库导入知识、需求或竞品。
2. 系统自动写入当前 `projectId`。
3. 项目诊断和 Skill 执行只能读取当前项目范围内的资料，除非 Skill 明确选择全部项目或指定项目。

### 新建项目 Skill

1. 用户进入 Skill 中心。
2. 点击新建我的 Skill。
3. 默认归属当前项目。
4. 用户配置适用场景、输入字段、工作步骤、输出格式、知识范围。
5. 保存后 Skill 出现在当前项目 Skill 列表。

### 运行流程

1. 用户输入需求并开始流程。
2. 每一步补充必要字段。
3. 点击生成后看到 3 个候选方案。
4. 用户选择一个方案或提出质疑重新生成。
5. 采纳后进入下一步。
6. 最后一步采纳后生成最终结论。
7. 用户保存为资产，资产归属当前项目。

## 错误与空状态

- 当前项目没有资料：提示可以先导入资料，但不阻断运行。
- Skill 知识范围没有命中内容：显示“未命中项目资料，本次结果主要来自用户输入和 AI 推断”。
- 项目被删除或不存在：自动切换到第一个可用项目。
- 自建 Skill 缺少必填结构：保存时提示缺失字段，不阻止保存草稿。
- 流程没有最终结论时保存资产：自动先生成最终结论，再保存。

## 测试策略

### 单元测试

- 旧数据迁移到默认项目。
- 当前项目数据过滤。
- 可用 Skill 过滤：系统、全局、当前项目。
- Skill normalize 保留 `inputFields`、`visibility`、`knowledgeScopeConfig`。
- Skill 执行上下文按知识范围过滤。
- 流程生成 3 个候选方案。
- 最后一步采纳后生成最终结论。
- 导出 Markdown 包含最终结论和步骤附录。

### 浏览器验证

- 新建项目后切换项目，资料库和资产库内容隔离。
- 新建项目 Skill，添加表单字段，保存后可编辑。
- Skill 知识范围可选择当前项目和资料类型。
- 运行需求拆解流程，选择候选方案，采纳到最后一步。
- 最后一步后能看到最终结论，并保存到资产库。

## 实施顺序

1. 新增项目工作台数据辅助函数和测试。
2. 增强 Skill 数据模型和测试。
3. 改造 App 的 computed 数据，所有页面读取当前项目过滤结果。
4. 增加项目创建入口。
5. 改造 Skill Builder 表单字段和知识范围 UI。
6. 增强流程服务，支持候选方案和最终结论。
7. 改造流程运行 UI 展示候选方案和最终结论。
8. 执行单元测试、构建和浏览器完整流程验证。
