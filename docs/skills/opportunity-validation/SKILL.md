---
name: opportunity-validation
description: Use when evaluating a product/project flow, blueprint, interactive demo, roadmap, feature priority, user journey, opportunity map, UX pain points, or iteration plan before deciding what to build next.
---

# Opportunity Validation

## Purpose

Use this skill to turn project materials, blueprints, state machines, demos, and user journeys into a validated iteration plan. The skill must produce evidence, opportunity scoring, solution experiments, three review rounds, and executable next steps.

The core rule: **no opportunity without journey evidence; no solution without validation; no iteration without a decision log.**

## When To Use

Use when the user asks to:
- run every project path and find real pain points
- review a blueprint or demo for opportunities
- compare competitor workflows and explain what to reference or avoid
- decide what to build next
- prioritize features, flows, or UX fixes
- validate whether a product idea is executable
- produce a roadmap, iteration plan, or PM/UX review
- compare product, interaction, engineering, and business value

Do not use for small isolated UI copy edits, simple bug fixes, or implementation-only tasks unless the user asks for product/UX opportunity analysis.

## Required Inputs

Collect or infer these before analysis. If some are missing, continue with explicit assumptions.

```json
{
  "projectProfile": {},
  "personas": [],
  "documents": [],
  "knowledgeBase": [],
  "competitors": [],
  "referenceProducts": [],
  "conversationSignals": [],
  "currentFlows": [],
  "blueprints": [],
  "interactionSkillV3": {},
  "demoSchema": {},
  "stateMachines": [],
  "qaProtocol": {},
  "currentDemoHtml": ""
}
```

## Mandatory Framework Stack

Apply these frameworks in this order:

1. **Persona**: one journey map per user type.
2. **JTBD / Jobs Scoping**: define the real job and scope boundaries.
3. **Behavior Intent / Information Appetite**: define what the user wants to do, see, avoid, defer, or omit.
4. **Competitor Workflow Reverse Analysis**: compare how public competitors solve the same job and why.
5. **User Journey Map**: map scenario, touchpoints, actions, feedback, emotion, pain, opportunity.
6. **Service Blueprint**: map frontstage, backstage, support systems, waiting points, failure points.
7. **Opportunity Solution Tree**: outcome -> opportunities -> solutions -> experiments.
8. **Problem-Solution Fit**: verify problem evidence and solution evidence.
9. **Kano**: classify features as must-be, performance, attractive, indifferent, reverse.
10. **RICE**: score reach, impact, confidence, effort.
11. **Feature Priority Pyramid**: classify foundation, reliability, usability, experience, differentiation.
12. **Three-Round Review**: UX, product value, engineering execution.

## Execution Workflow

### 1. Build Project Context Brief

Summarize:
- product positioning
- target users
- current stage
- primary jobs
- available materials
- current blueprints and demos
- known risks and assumptions

Output: `projectContextBrief`.

### 2. Define Personas And Jobs

Create 2-5 personas when possible. Each persona must include:

```json
{
  "id": "pm",
  "role": "产品经理",
  "goal": "把 PRD 快速变成可评审的交互方案",
  "constraints": ["时间少", "需要可展示", "需要可落地"],
  "jobToBeDone": "当我有一个产品文档时，我想快速得到蓝图、路径、Demo 和迭代建议，以便推进评审和开发。",
  "jobStages": ["Define", "Locate", "Prepare", "Confirm", "Execute", "Monitor", "Modify", "Conclude"]
}
```

### 3. Analyze Behavior Intent And Information Appetite

Before scoring opportunities, infer what each user is trying to accomplish in the moment.
Do not treat all visible information as equally useful. Rank information by whether it helps the user's current job.

For each persona and major journey, output:

```json
{
  "personaId": "",
  "journeyId": "",
  "currentBehavior": "what the user is likely doing now",
  "wantedOutcome": "what they want to complete",
  "wantedFirstView": "what they expect to see first",
  "wantedNextProof": "what evidence/result makes them trust progress",
  "userMentalModel": "how they think this task is organized",
  "primaryDecision": "the decision/action they are trying to make now",
  "wantedControls": [],
  "unwantedInformation": [],
  "lowestPriorityInformation": [],
  "mainFunctionCandidate": "",
  "sameLevelFunctionCandidates": [],
  "secondaryFunctionCandidates": [],
  "mustNotInterrupt": [],
  "acceptableSecondaryDepth": "none|one-level|multi-level",
  "confidence": "high|medium|low",
  "evidence": []
}
```

Use these rules:
- Put information the user considers irrelevant or premature into `lowestPriorityInformation`; remove it from the first screen unless it is required for safety, trust, or task completion.
- If the user is choosing, show options, tradeoffs, and evidence. If the user is executing, show progress, result, recovery, and next action.
- If the user is comparing or reviewing, prefer side-by-side surfaces, drawers, or secondary pages instead of blocking modals.
- If the user is confirming a destructive, expensive, or irreversible action, use a modal.
- If an item is only useful after the main decision, move it to a secondary page, drawer, collapsed section, filter, or advanced control.
- A low-frequency expert control should not compete with the main path unless hiding it would block expert completion.
- A function is primary only if it directly advances the user's current job. Functions are same-level only if they serve the same user goal, same frequency, same decision moment, and same risk level.
- If the user would not naturally ask for a feature while completing the current step, do not place it beside the main action; put it in secondary, advanced, or lowest-priority space.

Output: `behaviorIntentMatrix`.

### 4. Mine Design-Scheme Evidence

When user conversation, design docs, plans, specs, screenshots, or current flows are available, extract reusable UX evidence for design-scheme output / 设计方案产出. Do not prefill conclusions from an unrelated project. Useful signals include:
- **弹窗 / popover / modal**: identify whether the action is interruptive, confirmational, destructive, high-cost, temporary, or account/context related.
- **页面 / 二级页面**: identify whether the content is durable, reviewable, deep, reusable, navigable, or only needed after the main decision.
- **路径 / route**: identify the user's real task path, entry point, return path, branch path, and whether navigation matches that path.
- **优先级 / information rank**: identify what must be seen first, what can be secondary, and what should be omitted because the user does not need it now.
- **区域重叠 / overlap**: identify visual competition, click-target conflict, navigation hierarchy conflict, reading-order conflict, and popup/drawer/preview competition.
- **不需要就不放**: content the user would not look for at that moment should be omitted, collapsed, moved down, or treated as P3.

The evidence map must quote or summarize the current task evidence behind each design decision. If no evidence exists, mark the item as an assumption instead of inventing a project-specific pattern.

Output: `conversationEvidenceMap`.

### 5. Build Design-Scheme Decision Matrix

For design-scheme output, convert behavior evidence into concrete UI decisions. Every important feature or flow must answer:

```json
{
  "featureId": "",
  "featureName": "",
  "userBehavior": "",
  "userWantedOutcome": "",
  "userWantedFirstView": "",
  "userDoesNotNeed": [],
  "functionLevel": "primary|same-level|secondary|tertiary|lowest",
  "siblingFunctions": [],
  "parentFunction": "",
  "surface": "page|secondary-page|modal|drawer|inline-panel|side-panel|new-tab|toast|status-page",
  "placementRegion": "global-nav|page-header|primary-work-area|right-panel|left-panel|content-section|table-row|card|toolbar|footer|empty-state|error-state|settings|advanced",
  "routeDecision": {
    "entry": "",
    "transition": "stay|navigate|open-modal|open-drawer|open-new-tab|inline-expand",
    "returnState": "preserve-scroll|preserve-selection|preserve-draft|restore-filter|return-to-origin|new-task",
    "backBehavior": "",
    "deepLinkNeeded": true
  },
  "stateDecision": {
    "empty": "",
    "loading": "",
    "success": "",
    "partialSuccess": "",
    "error": "",
    "permission": "",
    "unsaved": ""
  },
  "errorDecision": {
    "message": "",
    "reasonVisible": true,
    "recoveryAction": "",
    "fallbackSurface": "inline-panel|toast|modal|status-page|none"
  },
  "priorityReason": "",
  "layoutReason": ""
}
```

Use these decision rules:

- **Page**: use for durable workflows, main work surfaces, reviewable artifacts, shareable URLs, deep information architecture, or tasks that need navigation and return state.
- **Secondary page**: use for durable but non-first-step content, detailed records, configuration, history, advanced analysis, or content that would crowd the primary page.
- **Modal**: use only for blocking confirmation, irreversible/destructive/high-cost actions, short required forms, or decisions that must finish before the user continues.
- **Drawer / side panel**: use for side-by-side inspection, detail editing while keeping list/context visible, comments, evidence, properties, and review notes.
- **Inline panel**: use for local progress, validation, small errors, generated previews, expandable details, and feedback close to the trigger.
- **New tab**: use for external URLs, independent previews, generated demos/code previews, documents that need full viewport, or flows where the original context must remain open.
- **Toast**: use for non-blocking success or minor status. Do not use toast as the only place for critical errors or required next actions.
- **Status page**: use when the whole workflow is blocked, processing is long-running, or the user needs to come back later.

Function hierarchy rules:
- `primary`: the main action or content that completes the user's current job.
- `same-level`: functions that serve the same goal, same timing, and same importance; place them in the same navigation level or same toolbar group.
- `secondary`: useful after the primary decision; place in a panel, secondary section, secondary page, or contextual action.
- `tertiary`: expert, rare, or administrative; place in advanced/settings/more menus.
- `lowest`: information the user does not need now; omit, collapse, or only expose through search/filter/history if necessary.

Placement rules:
- Put the user's first needed information in the primary work area.
- Put global context and cross-page switching in global/nav/header only when it affects multiple pages.
- Put object-specific actions near the object: row actions in rows, card actions in cards, field actions near fields.
- Put evidence, logs, comments, and properties in side panels or drawers when they support review without replacing the main work.
- Put destructive actions away from primary actions and require confirmation when loss is possible.
- Do not place two same-looking actions together if they have different risk or scope.
- Do not let a secondary panel, modal, preview, or toolbar steal the first reading position from the primary task.

Path and return-state rules:
- Define entry, transition, return path, and preserved state for every surface.
- Preserve drafts, filters, selected item, scroll position, and generated result when the user goes back.
- If a new tab opens, keep the origin page state unchanged and provide a clear way to identify the generated artifact.
- If a modal closes, return focus to the trigger and preserve the underlying page.
- If a route changes from list to detail and back, preserve filters, pagination, selection, and scroll.

Error rules:
- Inline errors for local field/action problems.
- Toasts for non-blocking status only.
- Modal errors only when the user must decide before continuing.
- Status page for workflow-level failure or long-running unavailable states.
- Every error must state what happened, why if known, what remains safe, and what the user can do next.
- If recovery is possible, recovery action must sit beside the error, not hidden in another page.

Output: `designSchemeDecisionMatrix`.

### 6. Run Competitor Workflow Reverse Analysis

Competitor analysis is mandatory for P0/P1 decisions. It must compare flows for the same user job, not generic product positioning.

Use only:
- public product pages
- public documentation
- user-provided screenshots, recordings, exports, or notes
- first-hand observations from authorized pages

Do not claim access to hidden prompts, private agent configuration, non-public thinking chains, internal Markdown, or protected systems. If a competitor detail is inferred, mark it as `inference`.

#### 6.1 Define The Comparison Task

Create one or more comparison tasks from the current project job:

```json
{
  "taskId": "upload-prd-to-interactive-demo",
  "job": "上传产品文档并得到可评审的流程蓝图和交互 Demo",
  "input": ["产品文档", "参考站点", "现有项目资料"],
  "expectedOutput": ["蓝图", "交互路径", "Demo", "评审建议", "开发任务"],
  "successCriteria": ["不用输入也能预览价值", "状态透明", "失败可恢复", "产物可沉淀"]
}
```

#### 6.2 Select Competitor Set

Use three competitor types when possible:

```json
{
  "directCompetitors": ["同类 PM/UX/AI agent 工具"],
  "indirectCompetitors": ["Coze", "Notion AI", "Feishu/Lark", "Copilot Studio"],
  "benchmarkProducts": ["Figma", "Linear", "Cursor", "Lovable"]
}
```

If the user provides specific competitors, include them first. If public evidence is missing, record the gap instead of inventing behavior.

#### 6.3 Reconstruct Competitor Flows

For every relevant competitor, output:

```json
{
  "competitor": "",
  "sourceType": "public-doc|public-page|user-screenshot|authorized-observation|inference",
  "sourceEvidence": [],
  "targetTask": "",
  "entryPoint": "",
  "inputMethod": "",
  "firstRunExperience": "",
  "emptyState": "",
  "uploadPlacement": "",
  "generationFeedback": "",
  "humanConfirmation": "",
  "artifactPersistence": "",
  "retryOrVersioning": "",
  "failureRecovery": "",
  "handoffToExecution": "",
  "notableInteractionDetails": []
}
```

#### 6.4 Explain Why They Do It

Every competitor pattern must include a reason analysis:

```json
{
  "pattern": "",
  "competitorsUsingIt": [],
  "productReason": "",
  "interactionReason": "",
  "technicalReason": "",
  "businessReason": "",
  "riskOrTradeoff": ""
}
```

Common reason categories:
- reduce first-use friction
- make AI progress observable
- split long-running work into confirmable stages
- increase trust through evidence and source references
- make generated artifacts reusable
- keep expert controls hidden until needed
- protect users from destructive or irreversible actions

#### 6.5 Convert References Into Decisions

Do not stop at "can reference". Convert each useful pattern into a decision:

```json
{
  "referenceId": "",
  "competitorPattern": "",
  "whyItWorks": "",
  "whatToReference": "",
  "whatNotToCopy": "",
  "ourBetterVersion": "",
  "targetFlow": "",
  "targetSurface": "page|secondary-page|modal|drawer|inline-panel|side-panel|new-tab|toast|status-page",
  "priorityImpact": "raise|keep|lower",
  "evidenceStrength": "strong|medium|weak",
  "openQuestions": []
}
```

Required comparison conclusions:
- What competitors make easy that we currently make hard.
- What competitors hide that we should expose.
- What competitors expose that we should simplify.
- Where we can be more trustworthy, more reviewable, or more executable.
- Which ideas should be rejected because they add configuration burden without user value.

Output: `competitorWorkflowAnalysis`.

### 7. Run Journey Simulations

For each persona, simulate the most important flows. At minimum cover:
- first-time empty input
- upload document or URL
- parse/generate blueprint
- inspect interaction path and Skill v3
- generate 1:1 demo
- switch style or interaction mode
- handle upload failure
- handle permission/error/empty state
- save/export/import to knowledge
- return and modify requirements

Each journey must include:

```json
{
  "journeyId": "",
  "personaId": "",
  "scenario": "",
  "start": "",
  "end": "",
  "successCriteria": [],
  "touchpoints": [
    {
      "step": 1,
      "touchpoint": "",
      "userAction": "",
      "systemFeedback": "",
      "emotion": "",
      "emotionScore": 0,
      "painPoint": "",
      "wantedToSee": "",
      "unwantedOrPrematureInfo": [],
      "surfaceEvidence": "page|secondary-page|modal|drawer|inline-panel|side-panel|new-tab|toast|status-page|none",
      "pathEvidence": "",
      "priorityEvidence": "",
      "overlapEvidence": "",
      "functionHierarchyEvidence": "",
      "placementEvidence": "",
      "returnStateEvidence": "",
      "errorFeedbackEvidence": "",
      "evidence": [],
      "opportunityHint": ""
    }
  ]
}
```

### 8. Build Service Blueprints

For every P0/P1 journey, map:

```json
{
  "journeyId": "",
  "userAction": "",
  "frontstage": "",
  "backstage": "",
  "supportSystem": "",
  "waitingPoints": [],
  "failurePoints": [],
  "missingSignals": [],
  "requiredStateExposure": []
}
```

Use this to identify hidden backend states that must become visible UI feedback.

### 9. Extract Pain Point Evidence

Pain points must come from a journey step or service blueprint. No unsupported guesses.

```json
{
  "id": "",
  "title": "",
  "sourceJourney": "",
  "triggerStep": "",
  "observedIssue": "",
  "userImpact": "",
  "behaviorIntentMismatch": "",
  "informationPriorityProblem": "",
  "surfaceOrPathProblem": "",
  "overlapProblem": "",
  "functionHierarchyProblem": "",
  "placementProblem": "",
  "returnStateProblem": "",
  "errorFeedbackProblem": "",
  "severity": "P0|P1|P2|P3",
  "evidence": [],
  "emotionLowPoint": true
}
```

Competitor evidence can strengthen or weaken a pain point, but cannot replace journey evidence from the current product.

### 10. Build Opportunity Solution Tree

Start from product outcomes, not features.

```json
{
  "outcome": "提升用户从资料到可交互 Demo 的完成率和信任感",
  "opportunities": [
    {
      "id": "",
      "title": "",
      "sourcePainPoints": [],
      "opportunityType": "fix-pain|amplify-delight",
      "solutions": [],
      "experiments": []
    }
  ]
}
```

Each solution must include:
- target flows
- target blueprints
- competitor references and anti-patterns
- surface decision
- information to show, defer, or omit
- function hierarchy and placement
- path, return-state, and error decisions
- UI nodes
- state machine changes
- demo validation
- expected value
- risks

### 11. Decide Product Surface, Path, And Placement

Every solution must decide its form, path behavior, return state, error handling, and layout placement:

```json
{
  "featureId": "",
  "recommended": "page|secondary-page|modal|drawer|inline-panel|side-panel|new-tab|toast|status-page",
  "reason": "",
  "alternatives": [
    { "surface": "", "tradeoff": "" }
  ],
  "placement": "",
  "entryPoint": "",
  "exitPath": "",
  "returnState": "",
  "errorFeedback": "",
  "functionLevel": "primary|same-level|secondary|tertiary|lowest",
  "sameLevelWith": [],
  "layoutRegion": "",
  "informationToShow": [],
  "informationToDefer": [],
  "informationToOmit": []
}
```

Rules:
- Use `inline-panel` for progress, parsing, local errors, lightweight feedback.
- Use `drawer` for side-by-side review/edit.
- Use `modal` for confirmation and destructive/high-cost actions.
- Use `new-tab` for 1:1 demo, code preview, or external pages.
- Use `page` for long workflows and durable assets.
- Use `secondary-page` when the content is durable and navigable but should not compete with the primary module.
- Use `side-panel` for requirement tree, QA, opportunities, and review comments.
- Do not put a surface on the first screen only because the data exists. Put it there only if the user needs it for the current behavior.
- If two regions compete for the same attention, click target, or reading order, lower the less task-critical region or move it to a secondary surface.
- If two features are not same-level, do not put them in the same navigation group, same button style, or same visual weight.
- If a feature is the primary function, it must appear before supporting content and have the clearest action affordance.
- If a feature is secondary, place it near the primary object it supports, not in global navigation.

### 12. Score And Prioritize

Each opportunity must include product, interaction, Kano, RICE, and pyramid scores.

```json
{
  "productReview": {
    "userValue": 0,
    "frequency": 0,
    "trustImpact": 0,
    "businessValue": 0,
    "reuseValue": 0
  },
  "interactionReview": {
    "clarity": 0,
    "feedback": 0,
    "recoverability": 0,
    "cognitiveLoad": 0,
    "flowContinuity": 0,
    "informationRelevance": 0,
    "surfaceFit": 0,
    "overlapRisk": 0,
    "hierarchyFit": 0,
    "placementFit": 0,
    "returnStateClarity": 0,
    "errorFeedbackClarity": 0
  },
  "kano": "must-be|performance|attractive|indifferent|reverse",
  "rice": {
    "reach": 0,
    "impact": 0,
    "confidence": 0,
    "effort": 0,
    "score": 0
  },
  "pyramidLevel": "L1-foundation|L2-reliability|L3-usability|L4-experience|L5-differentiation",
  "competitorReferenceValue": 0,
  "competitorDifferentiationValue": 0,
  "priority": "P0|P1|P2|P3",
  "weight": 0
}
```

Recommended formulas:

```text
RICE = reach * impact * confidence / effort
weight = userValue*1.4 + frequency*1.1 + trustImpact*1.2 + recoverability + flowContinuity + competitorReferenceValue*0.8 + competitorDifferentiationValue*1.1 - effort*1.3 - riskPenalty
```

Priority guidance:
- `P0`: blocks task completion, trust, data safety, generation reliability, or return/recovery.
- `P1`: improves completion rate, clarity, reviewability, or cross-project reuse.
- `P2`: improves efficiency, polish, or expert workflows.
- `P3`: exploratory, delight-only, low-frequency, or information the user does not need in the current path.

### 13. Run Three Review Rounds

#### Round 1: UX Review

Check:
- user knows where they are
- user knows what happened
- user knows next step
- feedback is close to trigger
- empty/error/permission/unsaved states are recoverable
- surface choice does not interrupt the wrong task
- referenced competitor pattern is adapted to this user's job, not copied blindly
- first screen shows what the user wants to see now
- unwanted or premature information is omitted, collapsed, deferred, or marked P3
- modal/page/secondary-page/drawer choices match task cost, durability, and interruption level
- regions do not overlap visually, semantically, or in click targets
- primary, same-level, secondary, tertiary, and lowest-level functions are not mixed in one visual level
- placement matches user behavior and object ownership
- path jumps preserve the right return state
- errors appear in the right surface with visible recovery

Output: `uxReviewPatch`.

#### Round 2: Product Value Review

Check:
- opportunity maps to a real outcome
- pain has evidence
- benefit is measurable
- feature fits Kano and pyramid level
- RICE confidence is high enough
- opportunity is not just a nice-to-have
- competitor evidence explains why the opportunity matters or why differentiation is possible

Output: `productOpportunityPatch`.

#### Round 3: Execution Review

Check:
- can be represented in `stateMachines`
- can be represented in `demoSchema`
- can be validated in demo
- does not break multi-project behavior
- has clear data dependencies
- has testable acceptance criteria
- competitor-inspired behavior is feasible with current data, tools, and UI architecture

Output: `executionPatch`.

### 14. Produce Final Outputs

The final answer must include:

```json
{
  "projectContextBrief": {},
  "personaMaps": [],
  "jobMaps": [],
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
  "journeyMaps": [],
  "serviceBlueprints": [],
  "painPointEvidenceMatrix": [],
  "opportunitySolutionTree": {},
  "surfaceDecisions": [],
  "priorityMap": [],
  "threeRoundReview": {
    "uxReviewPatch": {},
    "productOpportunityPatch": {},
    "executionPatch": {}
  },
  "finalIterationPlan": [],
  "developmentTasks": []
}
```

## Quality Gates

Before finishing, verify:
- Competitor analysis is task-based, sourced, and clearly marks inferences.
- Every referenced competitor pattern explains why it works and what not to copy.
- Every P0/P1 opportunity states whether competitor evidence raises, lowers, or does not affect priority.
- Every P0/P1 opportunity has journey evidence.
- Every P0/P1 opportunity explains the user's behavior, what they want to see, and what should be deferred or omitted.
- Every P0/P1 opportunity has function hierarchy, surface, placement, route, return-state, and error-feedback decisions.
- Every solution has a surface decision.
- Every surface decision has alternatives and tradeoffs.
- Every surface decision states what to show, defer, and omit.
- Every solution maps to flows, blueprints, UI nodes, and state changes.
- Every opportunity has product score, interaction score, Kano, RICE, pyramid level, priority, and weight.
- Three review rounds produce concrete patches.
- Final iteration plan is ordered and executable.

## Output Format For Users

When presenting the result, use this order:

1. **结论**
2. **竞品流程对比与可参考点**
3. **最重要机会点 Top 5**
4. **每个机会点的证据**
5. **推荐方案与形态**
6. **产品/交互/工程评分**
7. **三轮评审后的修改**
8. **最终迭代计划**
9. **可执行开发任务**

Keep claims grounded in journey evidence. Clearly mark assumptions.
