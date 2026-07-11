import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendRunMessageStream,
  confirmRunAgentProposal,
  createWorkflowRunnerStore,
  generateRunCanvasNodeArtifact
} from './workflow-runner.js'

test('dialogue skill stream skips workflow traces and forwards deltas directly', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'dialogue-run',
        workflowId: 'dialogue-skill',
        skillId: 'dialogue-skill',
        input: '做一个鞋类电商小程序',
        currentStepId: 'dialogue-agent',
        model: 'gpt-5.5',
        steps: [{ id: 'dialogue-agent', title: '纯模型对话' }],
        agentSessions: { 'dialogue-agent': [] },
        referenceFiles: {}
      }
    ]
  })
  const events = []
  const provider = {
    name: 'stream-test-provider',
    async *stream(context) {
      assert.equal(context.mode, 'dialogue-chat')
      yield { type: 'delta', content: '{"reply":"' }
      yield { type: 'delta', content: '可以先按普通聊天分析。"}' }
      yield { type: 'final', content: '可以先按普通聊天分析。', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'dialogue-run',
      stepId: 'dialogue-agent',
      model: 'gpt-5.5',
      clientMessageId: 'dialogue-client-1',
      message: { role: 'user', content: '继续聊分类' }
    },
    { agentProvider: provider },
    (event, data) => events.push({ event, data })
  )

  assert.deepEqual(events.map((item) => item.event), ['delta', 'delta'])
  assert.equal(result.assistantMessage.trace.length, 0)
  assert.equal(result.assistantMessage.content, '可以先按普通聊天分析。')
  assert.equal(result.run.agentSessions['dialogue-agent'].filter((item) => item.role === 'assistant').length, 1)
})

test('stage agent stream works when the requested scope is not a workflow step', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'total-flow-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: {
                  id: 'requirement-dissection-agent',
                  title: '需求解剖',
                  stageId: 'requirement-dissection',
                  summary: '确认原始需求与缺口'
                },
                nodes: []
              }
            }
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const events = []
  const provider = {
    name: 'stage-agent-provider',
    async *stream(context) {
      assert.equal(context.scopeId, 'requirement-dissection-agent')
      assert.equal(context.mode, 'dialogue-chat')
      assert.equal(context.node.id, 'requirement-dissection-agent')
      yield { type: 'delta', content: '请继续补充目标用户。' }
      yield { type: 'final', content: '请继续补充目标用户。', usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'total-flow-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'stage-agent-client-1',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        },
        canvasAction: {
          action: '补充背景',
          actionLabel: '阶段 Agent 对话',
          actionIntent: 'stage-agent-workbench',
          nodeId: 'requirement-dissection-agent',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '补充背景' }
    },
    { agentProvider: provider },
    (event, data) => events.push({ event, data })
  )

  assert.ok(events.some((item) => item.event === 'delta'))
  assert.equal(result.assistantMessage.trace.length, 0)
  assert.equal(result.assistantMessage.content, '请继续补充目标用户。')
  assert.equal(result.proposal, null)
  assert.equal(result.run.agentSessions['requirement-dissection-agent'].filter((item) => item.role === 'assistant').length, 1)
})

test('requirement stage stream carries analysis guidance outside uploaded documents and evidence', async () => {
  let capturedContext = null
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'requirement-guidance-stream-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        demandScope: 'non-project',
        currentStepId: 'requirement-dissection-agent',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            requirementDissectionArtifact: {
              analysisGuidance: {
                version: 'requirement-dissection-guidance/v1',
                hardConstraints: [{ id: 'workflow-agent-chat', title: 'Workflow Agent Chat', path: 'docs/product-contracts/workflow-agent-chat.md', summary: 'One shared Agent shell.', sourceType: 'product-contract' }],
                methodGuides: [{ id: 'requirement-dissection-guidance', title: 'Requirement Dissection Guidance', path: 'docs/skills/requirement-dissection-guidance/SKILL.md', summary: 'Separate evidence and assumptions.', sourceType: 'skill' }],
                referenceNotes: []
              }
            },
            stages: [{ id: 'requirement-dissection', name: '需求分析' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: { id: 'requirement-dissection-agent', title: '需求分析', stageId: 'requirement-dissection' },
                nodes: [{ id: 'requirement-source', title: '需求识别与产品判断', stageId: 'requirement-dissection' }]
              }
            }
          }
        },
        referenceFiles: {
          'requirement-dissection-agent': [
            { id: 'uploaded-1', name: '用户附件', kind: 'document', text: '用户给出的真实业务资料' }
          ]
        },
        agentSessions: { 'requirement-dissection-agent': [] }
      }
    ]
  })
  const provider = {
    name: 'requirement-guidance-stream-provider',
    async *stream(context) {
      capturedContext = context
      yield { type: 'delta', content: '继续按需求分析规则推进。' }
      yield { type: 'final', content: '继续按需求分析规则推进。', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'requirement-guidance-stream-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'requirement-guidance-stream-client',
      message: { role: 'user', content: '继续分析' }
    },
    { agentProvider: provider }
  )

  assert.equal(capturedContext.analysisGuidance.version, 'requirement-dissection-guidance/v1')
  assert.equal(capturedContext.references.length, 1)
  assert.equal(capturedContext.references[0].name, '用户附件')
  assert.doesNotMatch(JSON.stringify(capturedContext.references), /product-contracts|docs\/skills/)
  assert.doesNotMatch(JSON.stringify(result.assistantMessage.meta.evidencePack.sources), /product-contracts|docs\/skills/)
})

test('requirement stage stream persists guidance onto restored runs without adding references', async () => {
  let capturedContext = null
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'restored-non-project-guidance-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '历史非项目需求',
        input: '做一个茶饮点单小程序',
        demandScope: 'non-project',
        currentStepId: 'requirement-dissection',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            requirementDissectionArtifact: {},
            stages: [{ id: 'requirement-dissection', name: '需求分析' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: { id: 'requirement-dissection-agent', title: '需求分析', stageId: 'requirement-dissection' },
                nodes: [{ id: 'requirement-understanding', title: '需求理解', stageId: 'requirement-dissection' }]
              }
            }
          }
        },
        referenceFiles: {},
        agentSessions: { 'requirement-dissection': [] }
      }
    ]
  })
  const provider = {
    name: 'restored-guidance-provider',
    async *stream(context) {
      capturedContext = context
      yield { type: 'delta', content: '继续确认缺口。' }
      yield { type: 'final', content: '继续确认缺口。', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'restored-non-project-guidance-run',
      stepId: 'requirement-dissection',
      model: 'gpt-5.5',
      clientMessageId: 'restored-guidance-client',
      message: { role: 'user', content: '继续' }
    },
    { agentProvider: provider }
  )

  const guidance = result.run.documentAnalysis.totalDesignFlow.requirementDissectionArtifact.analysisGuidance
  assert.equal(capturedContext.analysisGuidance.version, 'requirement-dissection-guidance/v1')
  assert.equal(guidance.version, 'requirement-dissection-guidance/v1')
  assert.equal(result.run.demandScope, 'non-project')
  assert.deepEqual(result.run.referenceFiles['requirement-dissection'], [])
  assert.doesNotMatch(JSON.stringify(result.run.referenceFiles), /product-contracts|docs\/skills|superpowers\/specs/)
  assert.doesNotMatch(JSON.stringify(result.assistantMessage.meta.evidencePack.sources), /product-contracts|docs\/skills|superpowers\/specs|已引用项目知识/)
})

test('page node agent stream carries the canvas page layout artifact for detailed rendering', async () => {
  const pageLayoutArtifact = {
    title: '页面骨架',
    modelDecision: '推荐布局：左侧 AppNavRail + 内容区首屏 PodcastStep1 输入面板 + 输入框内部快捷提示词 Chips',
    asciiWireframe: [
      '首页 Video Podcast 页面框架',
      '┌────────────────────────────────────────────────────────┐',
      '│ 左侧 AppNavRail：Logo / Home(active) / Projects / Tools │',
      '├────────────────────────────────────────────────────────┤',
      '│ Topic/input composer                                   │',
      '│ placeholder：Enter topic / script / URL                │',
      '│ Chips 内嵌：[快捷1] [快捷2] [更多/换一批]              │',
      '│ 底部操作：Try Sample        [Generate podcast]         │',
      '└────────────────────────────────────────────────────────┘'
    ].join('\n'),
    interactionDetails: '点击快捷提示词写入或追加到输入框，用户仍可编辑，再点击 Generate podcast 进入原创建链路。'
  }
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'layout-artifact-agent-run',
        workflowId: 'total-design-flow',
        workflowName: 'Jogg',
        input: '我想在首页增加几个快捷输入提示词的功能',
        currentStepId: 'interaction-lofi',
        model: 'gpt-5.5',
        steps: [{ id: 'interaction-lofi', title: '交互低保' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'p1',
                    stageId: 'interaction-lofi',
                    title: '首页 Video Podcast',
                    summary: '在首页输入区展示快捷提示词。',
                    pageLayoutArtifact
                  }
                ],
                edges: []
              }
            }
          }
        },
        agentSessions: { p1: [] },
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'page-layout-agent-provider',
    async *stream(context) {
      assert.equal(context.node.pageLayoutArtifact.asciiWireframe.includes('Topic/input composer'), true)
      yield { type: 'delta', content: '建议沿用当前首页输入区框架，把快捷提示词放在输入框内部。' }
      yield { type: 'final', content: '建议沿用当前首页输入区框架，把快捷提示词放在输入框内部。' }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'layout-artifact-agent-run',
      stepId: 'p1',
      model: 'gpt-5.5',
      clientMessageId: 'layout-artifact-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请把这个页面框架说详细一点' },
      context: {
        activeNode: { id: 'p1', title: '首页 Video Podcast', stageId: 'interaction-lofi' },
        canvasAction: {
          actionLabel: '补充资料',
          actionIntent: 'supplement-detail',
          nodeId: 'p1'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.equal(result.assistantMessage.meta.pageLayoutArtifact.asciiWireframe, pageLayoutArtifact.asciiWireframe)
  assert.match(result.assistantMessage.meta.pageLayoutArtifact.asciiWireframe, /左侧 AppNavRail/)
  assert.match(result.assistantMessage.meta.pageLayoutArtifact.asciiWireframe, /placeholder：Enter topic \/ script \/ URL/)
  assert.match(result.assistantMessage.meta.pageLayoutArtifact.asciiWireframe, /Chips 内嵌/)
  assert.equal(
    result.run.agentSessions.p1.find((message) => message.role === 'assistant').meta.pageLayoutArtifact.asciiWireframe,
    pageLayoutArtifact.asciiWireframe
  )
})

test('stage agent stream emits immediate visible progress before first model delta', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stage-agent-immediate-progress-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: {
                  id: 'requirement-dissection-agent',
                  title: '需求解剖',
                  stageId: 'requirement-dissection',
                  summary: '确认原始需求与缺口'
                },
                nodes: []
              }
            }
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const events = []
  const provider = {
    name: 'delayed-stage-agent-provider',
    async *stream(context) {
      assert.equal(context.mode, 'dialogue-chat')
      yield { type: 'status', status: 'generating', label: '模型开始生成' }
      yield { type: 'delta', content: '这里是模型真正返回的完整分析。' }
      yield {
        type: 'final',
        content: '这里是模型真正返回的完整分析。',
        usage: { inputTokens: 2, outputTokens: 10, totalTokens: 12 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'stage-agent-immediate-progress-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'stage-agent-immediate-progress-client',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '继续展开' }
    },
    { agentProvider: provider },
    (event, data) => events.push({ event, data })
  )

  assert.equal(events[0].event, 'delta')
  assert.match(events[0].data.content, /已接收|展开/)
  assert.equal(events.some((item) => item.event === 'delta' && /模型真正返回/.test(item.data.content)), true)
  assert.equal(result.assistantMessage.content, '这里是模型真正返回的完整分析。')
  assert.doesNotMatch(result.assistantMessage.content, /已接收/)
})

test('structured canvas agent stream emits immediate visible preview before readable model content', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'structured-preview-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          canvas: {
            nodes: [{ id: 'analysis', title: '需求分析', summary: '当前画布节点' }],
            edges: []
          }
        },
        agentSessions: { analysis: [] },
        referenceFiles: {}
      }
    ]
  })
  const events = []
  const provider = {
    name: 'structured-preview-provider',
    async *stream(context) {
      assert.equal(context.mode, undefined)
      assert.equal(context.actionType, 'canvas-action-advice')
      yield { type: 'delta', content: '{"proposal":' }
      yield { type: 'delta', content: '{"title":"补充方案"},"content":"先补齐点单闭环，再补异常状态。' }
      yield { type: 'delta', content: '"}' }
      yield {
        type: 'final',
        content: '先补齐点单闭环，再补异常状态。',
        usage: { inputTokens: 3, outputTokens: 8, totalTokens: 11 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'structured-preview-run',
      stepId: 'analysis',
      model: 'gpt-5.5',
      clientMessageId: 'structured-preview-client',
      action: 'canvas-action-advice',
      context: {
        activeNode: { id: 'analysis', title: '需求分析' },
        canvasAction: {
          action: '补充资料',
          actionLabel: '补充资料',
          actionIntent: 'supplement-detail',
          nodeId: 'analysis'
        }
      },
      message: { role: 'user', content: '补充资料' }
    },
    { agentProvider: provider },
    (event, data) => events.push({ event, data })
  )

  assert.equal(events[0].event, 'trace')
  const firstDelta = events.find((item) => item.event === 'delta')
  assert.equal(firstDelta?.data?.preview, true)
  assert.match(firstDelta?.data?.content || '', /已接收|生成/)
  assert.equal(events.some((item) => item.event === 'delta' && /点单闭环/.test(item.data?.content || '')), true)
  assert.match(result.assistantMessage.content, /点单闭环/)
  assert.doesNotMatch(result.assistantMessage.content, /已接收/)
})

test('structured canvas agent stream persists context data lookup and evidence pack metadata', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'structured-evidence-stream-run',
        workflowId: 'total-design-flow',
        workflowName: '会员点餐',
        input: '做一个会员点餐小程序',
        currentStepId: 'menu-page',
        model: 'gpt-5.5',
        steps: [{ id: 'menu-page', title: '菜单页' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            activeSliceId: 'ordering-flow',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            requirementSlices: [{ id: 'ordering-flow', title: '点餐主流程', goal: '完成选品到结算' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'menu-page',
                    stageId: 'interaction-lofi',
                    title: '菜单页',
                    summary: '展示分类、商品、售罄状态和购物车',
                    content: ['分类切换', '商品列表', '购物车入口']
                  }
                ],
                edges: []
              }
            }
          }
        },
        agentSessions: { 'menu-page': [] },
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'structured-evidence-stream-provider',
    async *stream(context) {
      assert.equal(context.actionType, 'canvas-action-advice')
      yield { type: 'delta', content: '{"content":"补齐空状态、售罄和接口失败恢复。"}' }
      yield {
        type: 'final',
        content: '补齐空状态、售罄和接口失败恢复。',
        usage: { inputTokens: 3, outputTokens: 6, totalTokens: 9 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'structured-evidence-stream-run',
      stepId: 'menu-page',
      model: 'gpt-5.5',
      clientMessageId: 'structured-evidence-client',
      action: 'canvas-action-advice',
      references: [
        { id: 'ref-1', name: '接口说明', kind: 'document', text: '商品列表接口返回 empty、soldOut、networkError。' }
      ],
      retrievedKnowledge: [
        {
          title: '点餐异常状态规范',
          snippet: '菜单页必须覆盖空列表、售罄和接口错误恢复。',
          evidence: [{ title: '规范第 3 节' }],
          projectId: 'project-order',
          projectName: '会员点餐'
        }
      ],
      context: {
        activeNode: { id: 'menu-page', title: '菜单页', stageId: 'interaction-lofi' },
        canvasAction: { actionLabel: '补异常状态', nodeId: 'menu-page' }
      },
      message: { role: 'user', content: '补充这个页面的异常状态' }
    },
    { agentProvider: provider }
  )

  assert.equal(result.assistantMessage.meta.contextSummary.scopeId, 'menu-page')
  assert.equal(result.assistantMessage.meta.contextSummary.currentStage, '交互低保')
  assert.equal(result.assistantMessage.meta.dataLookups.find((item) => item.key === 'retrieved-knowledge').status, 'done')
  assert.equal(result.assistantMessage.meta.evidencePack.confidence, 'high')
  assert.match(result.assistantMessage.trace.find((item) => item.key === 'evidence').summary, /证据包/)
})

test('structured canvas agent stream normalizes final-only json envelopes before persisting content', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'final-json-envelope-run',
        workflowId: 'total-design-flow',
        workflowName: 'Podcastor',
        input: '做一个 Video Podcast 创作工具',
        currentStepId: 'home-page',
        model: 'gpt-5.5',
        steps: [{ id: 'home-page', title: '首页' }],
        documentAnalysis: {
          canvas: {
            nodes: [
              {
                id: 'home-page',
                title: '首页',
                summary: '展示产品定位、创作入口、案例线索和登录状态'
              }
            ],
            edges: []
          }
        },
        agentSessions: { 'home-page': [] },
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'final-json-envelope-provider',
    async *stream(context) {
      assert.equal(context.actionType, 'canvas-action-advice')
      yield {
        type: 'final',
        content: JSON.stringify({
          content: '结论：建议将「首页」重新定义为 Video Podcast 创作转化首页。\n\n新的首页方案应采用创作优先、案例说明和状态分流结构。',
          quickReplies: ['补目标用户']
        }),
        usage: { inputTokens: 2, outputTokens: 4, totalTokens: 6 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'final-json-envelope-run',
      stepId: 'home-page',
      model: 'gpt-5.5',
      clientMessageId: 'final-json-envelope-client',
      action: 'canvas-action-advice',
      context: {
        activeNode: { id: 'home-page', title: '首页' },
        canvasAction: { actionLabel: '给布局方案', nodeId: 'home-page' }
      },
      message: { role: 'user', content: '给布局方案' }
    },
    { agentProvider: provider }
  )

  assert.match(result.assistantMessage.content, /Video Podcast 创作转化首页/)
  assert.doesNotMatch(result.assistantMessage.content, /^\s*\{/)
  assert.equal(result.quickReplies.includes('补目标用户'), true)
})

test('weak answer evaluation actions are persisted as quick replies', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'weak-evaluation-action-run',
        workflowId: 'total-design-flow',
        workflowName: '未知需求',
        input: '',
        currentStepId: 'empty-node',
        model: 'gpt-5.5',
        steps: [{ id: 'empty-node', title: '空节点' }],
        documentAnalysis: { canvas: { nodes: [], edges: [] } },
        agentSessions: { 'empty-node': [] },
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'weak-evaluation-action-provider',
    async *stream(context) {
      assert.equal(context.actionType, 'canvas-action-advice')
      yield { type: 'delta', content: '{"content":"可以继续推进，但当前资料不足，需要确认接口和页面状态。"}' }
      yield {
        type: 'final',
        content: '可以继续推进，但当前资料不足，需要确认接口和页面状态。',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'weak-evaluation-action-run',
      stepId: 'empty-node',
      model: 'gpt-5.5',
      clientMessageId: 'weak-evaluation-action-client',
      action: 'canvas-action-advice',
      context: {
        activeNode: { id: 'empty-node', title: '空节点' },
        canvasAction: { actionLabel: '继续', nodeId: 'empty-node' }
      },
      message: { role: 'user', content: '继续' }
    },
    { agentProvider: provider }
  )

  assert.equal(result.assistantMessage.meta.answerEvaluation.status, 'needs-review')
  assert.equal(result.assistantMessage.meta.answerEvaluation.recommendedActions.some((item) => item.label === '补充依据'), true)
  assert.equal(result.quickReplies.includes('补充依据'), true)
  assert.equal(result.run.agentQuickReplies['empty-node'].includes('补充依据'), true)
})

test('stage agent stream tolerates legacy failed analysis runs without steps', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'legacy-failed-analysis-run',
        workflowId: '',
        workflowName: '需求分析画布',
        title: '需求分析画布',
        input: '做一个茶饮点单小程序',
        status: 'failed',
        model: 'gpt-5.5',
        documentAnalysis: {
          status: 'failed',
          canvas: {
            nodes: [{
              id: 'requirement-dissection-agent',
              title: '分析失败',
              summary: '文档分析失败恢复',
              agentScope: '围绕分析失败原因继续排查和补充。'
            }],
            edges: [],
            orderedTabs: [{ key: 'analysis', label: '分析失败' }]
          }
        },
        agentSessions: {
          'requirement-dissection-agent': []
        },
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'legacy-run-provider',
    async *stream(context) {
      assert.equal(context.scopeId, 'requirement-dissection-agent')
      assert.equal(context.mode, 'dialogue-chat')
      assert.equal(context.step.id, 'requirement-dissection-agent')
      yield { type: 'delta', content: '可以继续基于失败上下文排查。' }
      yield { type: 'final', content: '可以继续基于失败上下文排查。', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'legacy-failed-analysis-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'legacy-client-1',
      message: { role: 'user', content: '继续' },
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '分析失败',
          summary: '文档分析失败恢复'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.equal(result.assistantMessage.content, '可以继续基于失败上下文排查。')
  assert.equal(result.run.agentSessions['requirement-dissection-agent'].at(-1).role, 'assistant')
})

test('stage agent stream replaces persisted pending message for the same request id only', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'request-dedupe-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }]
          }
        },
        agentSessions: {
          'requirement-dissection': [
            { id: 'previous-user', role: 'user', content: '继续', meta: { clientMessageId: 'previous-request', action: 'send' } },
            { id: 'previous-assistant', role: 'assistant', content: '上一轮继续的回复', meta: { clientMessageId: 'previous-request', action: 'send', status: 'success' } },
            { id: 'optimistic-user', role: 'user', content: '继续', meta: { clientMessageId: 'same-request', action: 'send', optimistic: true } },
            { id: 'pending-assistant', role: 'assistant', content: '正在生成回复...', meta: { clientMessageId: 'same-request', action: 'send', status: 'pending', optimistic: true } }
          ]
        },
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'request-dedupe-provider',
    async *stream() {
      yield { type: 'delta', content: '这一轮继续的最终回复' }
      yield { type: 'final', content: '这一轮继续的最终回复', usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'request-dedupe-run',
      stepId: 'requirement-dissection',
      model: 'gpt-5.5',
      clientMessageId: 'same-request',
      action: 'send',
      message: { role: 'user', content: '继续' }
    },
    { agentProvider: provider }
  )

  const messages = result.run.agentSessions['requirement-dissection']
  assert.equal(messages.filter((item) => item.role === 'user' && item.content === '继续').length, 2)
  assert.equal(messages.filter((item) => item.meta?.clientMessageId === 'same-request' && item.role === 'user').length, 1)
  assert.equal(messages.filter((item) => item.meta?.clientMessageId === 'same-request' && item.role === 'assistant').length, 1)
  assert.equal(messages.some((item) => item.id === 'pending-assistant'), false)
  assert.equal(messages.some((item) => item.meta?.clientMessageId === 'previous-request'), true)
  assert.equal(messages.at(-1).content, '这一轮继续的最终回复')
})

test('chat-only stage stream does not attach proposal metadata to assistant messages', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'chat-only-stage-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: {
                  id: 'requirement-dissection-agent',
                  title: '需求解剖',
                  stageId: 'requirement-dissection',
                  summary: '确认原始需求与缺口'
                },
                nodes: []
              }
            }
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'chat-only-stage-provider',
    async *stream() {
      yield { type: 'delta', content: '建议先明确目标用户与支付边界。' }
      yield { type: 'final', content: '建议先明确目标用户与支付边界。', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'chat-only-stage-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'stage-agent-client-2',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '继续分析' }
    },
    { agentProvider: provider }
  )

  assert.equal(result.proposal, null)
  assert.equal(result.assistantMessage.meta?.proposalId || '', '')
  assert.notEqual(result.assistantMessage.meta?.action, 'confirm-canvas')
})

test('chat-only stage stream preserves the full streamed model answer over short final content', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'chat-only-full-answer-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: {
                  id: 'requirement-dissection-agent',
                  title: '需求解剖',
                  stageId: 'requirement-dissection',
                  summary: '确认原始需求与缺口'
                },
                nodes: []
              }
            }
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const fullAnswer = [
    '做茶饮小程序建议先拆成一条完整用户闭环，而不是只写两句话。',
    '第一步是选店：支持定位附近门店、手动切换门店、展示营业状态、距离和是否支持自提。',
    '第二步是点单：包含饮品分类、商品详情、规格定制、甜度冰量、加料、库存状态和会员价。',
    '第三步是购物车和支付：支持数量修改、优惠券、备注、微信支付、支付失败重试。',
    '第四步是取餐和查订单：展示取餐码、预计完成时间、订单状态、再来一单、退款或客服入口。'
  ].join('\n')
  const provider = {
    name: 'chat-only-full-answer-provider',
    async *stream() {
      yield { type: 'delta', content: fullAnswer.slice(0, 70) }
      yield { type: 'delta', content: fullAnswer.slice(70) }
      yield {
        type: 'final',
        content: '可以先按用户点单闭环来做。',
        usage: { inputTokens: 2, outputTokens: 20, totalTokens: 22 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'chat-only-full-answer-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'stage-agent-client-full-answer',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '做一个茶饮小程序怎么做' }
    },
    { agentProvider: provider }
  )

  assert.equal(result.assistantMessage.content, fullAnswer)
  assert.match(result.assistantMessage.content, /规格定制/)
  assert.match(result.assistantMessage.content, /取餐码/)
  assert.notEqual(result.assistantMessage.content, '可以先按用户点单闭环来做。')
  assert.equal(result.assistantMessage.meta?.rawModelContentPreserved, true)
})

test('stage agent stream keeps requirement dissection quick replies model-authored only', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'model-quick-replies-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: {
                  id: 'requirement-dissection-agent',
                  title: '需求解剖',
                  stageId: 'requirement-dissection',
                  summary: '确认原始需求与缺口'
                },
                nodes: []
              }
            }
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'model-quick-replies-provider',
    async *stream() {
      yield { type: 'delta', content: '建议先补充用户路径。' }
      yield {
        type: 'final',
        content: '建议先补充用户路径。',
        quickReplies: ['继续拆用户路径', '总结并进入下一步', '继续拆用户路径'],
        usage: { inputTokens: 2, outputTokens: 8, totalTokens: 10 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'model-quick-replies-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'stage-agent-client-model-quick-replies',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '继续分析' }
    },
    { agentProvider: provider }
  )

  assert.deepEqual(result.quickReplies, ['继续拆用户路径', '总结并进入下一步'])
  assert.deepEqual(result.run.agentQuickReplies['requirement-dissection-agent'], ['继续拆用户路径', '总结并进入下一步'])
  assert.equal(result.quickReplies.includes('进入交互低保'), false)
  assert.equal(result.quickReplies.includes('补充背景'), false)
  assert.equal(result.quickReplies.includes('列出风险'), false)
})

test('stage agent stream keeps short requirement dissection model quick replies without stage defaults', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'short-model-quick-replies-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        skillId: 'ux-design-confirmation-skill',
        input: '做一个茶饮点单小程序',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [
              { id: 'requirement-dissection', name: '需求解剖' },
              { id: 'interaction-lofi', name: '交互低保' }
            ],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                agentNode: {
                  id: 'requirement-dissection-agent',
                  title: '需求解剖',
                  stageId: 'requirement-dissection',
                  summary: '确认原始需求与缺口',
                  agentInteraction: {
                    quickReplies: ['继续补充边界', '调整本阶段', '转低保真画布']
                  }
                },
                nodes: []
              }
            }
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'short-model-quick-replies-provider',
    async *stream() {
      yield { type: 'delta', content: '可以进入低保真。' }
      yield {
        type: 'final',
        content: '可以进入低保真。',
        quickReplies: ['生成低保真'],
        usage: { inputTokens: 2, outputTokens: 8, totalTokens: 10 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'short-model-quick-replies-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'stage-agent-client-short-model-quick-replies',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection',
          agentInteraction: {
            quickReplies: ['继续补充边界', '调整本阶段', '转低保真画布']
          }
        }
      },
      message: { role: 'user', content: '继续分析' }
    },
    { agentProvider: provider }
  )

  assert.equal(result.quickReplies.includes('转低保真画布'), false)
  assert.equal(result.quickReplies.includes('进入交互低保'), false)
  assert.equal(result.quickReplies.includes('补充背景'), false)
  assert.equal(result.quickReplies.includes('列出风险'), false)
  assert.deepEqual(result.quickReplies, ['生成低保真'])
  assert.deepEqual(result.run.agentQuickReplies['requirement-dissection-agent'], ['生成低保真'])
})

test('output page framework quick reply uses model stream content instead of deterministic renderer', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'page-framework-artifact-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        skillId: 'total-design-flow',
        input: '做一个茶饮点单小程序：首页、点餐、购物车、订单、我的，支持规格选择、优惠券、支付、取餐码。',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }]
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  let modelCalled = false
  const modelArtifact = [
    ':::page-layout-artifact title="页面骨架"',
    '## 模型推荐方案',
    '页面类型：模型基于茶饮需求分析后的页面框架',
    '推荐布局：模型返回的左右分栏方案',
    '## ASCII 页面线框图',
    '┌──模型输出──┐',
    '│ 点餐页模型线框 │',
    '└──────────┘',
    ':::'
  ].join('\n')

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'page-framework-artifact-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'page-framework-client',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '输出页面框架' }
    },
    {
      agentProvider: {
        name: 'page-framework-model-provider',
        async *stream() {
          modelCalled = true
          yield { type: 'delta', content: modelArtifact }
          yield {
            type: 'final',
            content: modelArtifact,
            quickReplies: ['继续细化页面'],
            usage: { inputTokens: 3, outputTokens: 20, totalTokens: 23 }
          }
        }
      }
    }
  )

  assert.equal(modelCalled, true)
  assert.match(result.assistantMessage.content, /:::page-layout-artifact title="页面骨架"/)
  assert.match(result.assistantMessage.content, /## 模型推荐方案/)
  assert.match(result.assistantMessage.content, /模型返回的左右分栏方案/)
  assert.match(result.assistantMessage.content, /点餐页模型线框/)
  assert.doesNotMatch(result.assistantMessage.content, /点餐菜单页（左右分栏特殊框架）/)
  assert.deepEqual(result.quickReplies, ['继续细化页面'])
  assert.equal(result.quickReplies.includes('进入交互低保'), false)
  assert.equal(result.quickReplies.includes('补充背景'), false)
})

test('output page framework quick reply persists model failure instead of template fallback', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'podcastor-auth-framework-run',
        workflowId: 'total-design-flow',
        workflowName: 'Podcastor.ai 认证页面',
        skillId: 'total-design-flow',
        input: 'Podcastor.ai 认证页面。认证与账号入口页面，包含登录、注册、忘记密码、重置密码、OAuth 回调和登录拦截弹窗。',
        currentStepId: 'analysis',
        model: 'gpt-5.5',
        steps: [{ id: 'analysis', title: '需求分析' }],
        documentAnalysis: {
          input: [
            'page type: 认证与账号入口页面',
            '核心闭环：用户从首页 Generate Script、Upload Script、Upload Audio、工具页或 Pricing 触发需要登录的动作。',
            '支持 Google、Discord、邮箱登录，登录成功后回到原始创作上下文。',
            '依赖 redirect_uri、source、draft_id、临时创作上下文、credits、免费次数、AppSumo/LTD 权限隔离。',
            'page framework: 登录页 Sign In、注册页 Sign Up、忘记密码页 Forgot Password、重置密码页 Reset Password、OAuth 回调处理中页、登录拦截弹窗 Auth Modal。'
          ].join('\n'),
          blueprint: {
            profile: {
              productName: 'Podcastor.ai 认证页面',
              primaryGoal: '认证与账号入口页面'
            }
          },
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }]
          },
          canvas: { nodes: [], edges: [] }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'podcastor-auth-framework-run',
      stepId: 'requirement-dissection-agent',
      model: 'gpt-5.5',
      clientMessageId: 'podcastor-auth-framework-client',
      action: 'stage-agent-message',
      context: {
        activeNode: {
          id: 'requirement-dissection-agent',
          title: '需求解剖',
          stageId: 'requirement-dissection'
        }
      },
      message: { role: 'user', content: '输出页面框架' }
    },
    {
      agentProvider: {
        name: 'failing-page-framework-model',
        async *stream() {
          throw new Error('模型服务不可用')
        }
      }
    }
  )

  assert.equal(result.assistantMessage.content, '生成失败，请重试。')
  assert.equal(result.assistantMessage.meta?.status, 'failed')
  assert.equal(result.error?.message, '模型服务不可用')
  assert.doesNotMatch(result.assistantMessage.content, /:::page-layout-artifact/)
  assert.doesNotMatch(result.assistantMessage.content, /登录页 Sign In/)
  assert.doesNotMatch(result.assistantMessage.content, /点餐菜单页/)
})

test('proposal stage stream preserves the full raw model text for display', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'proposal-stage-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'page-structure',
        model: 'gpt-5.5',
        steps: [{ id: 'page-structure', title: '页面结构树' }],
        documentAnalysis: {
          canvas: {
            nodes: [
              {
                id: 'page-structure',
                title: '页面结构树',
                summary: '拆解茶饮点单页面结构',
                content: ['选店', '点单', '购物车']
              }
            ],
            edges: []
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const rawModelText = JSON.stringify({
    content: '短摘要：建议先收敛茶饮点单核心闭环。',
    proposal: {
      title: '展开茶饮点单核心闭环',
      summary: '完整展开选店、点单、购物车、支付、取餐、查订单。',
      rationale: ['需要支撑后续页面和功能拆分'],
      contextSources: [],
      writeableContent: {
        summary: '完整方案：从用户进入小程序开始，先完成门店选择，再进入菜单点单，支持规格定制、加料、冷热甜度、购物车合并、优惠券、支付、取餐码和订单查询。',
        items: [
          '选店：定位附近门店、手动切换门店、展示营业状态和距离。',
          '点单：分类菜单、商品详情、规格定制、加料、冷热甜度、库存状态。',
          '购物车：合并同类项、修改数量、展示优惠、起送或自提规则。',
          '支付：微信支付、优惠券、会员余额、支付失败重试。',
          '取餐：生成取餐码、展示预计完成时间、到店提醒。',
          '查订单：订单状态、退款、再来一单、发票或客服入口。'
        ],
        acceptanceCriteria: ['页面展示不能只剩短摘要，必须保留模型完整原文。']
      },
      downstreamImpact: []
    }
  })
  const provider = {
    name: 'proposal-provider',
    async *stream() {
      yield { type: 'delta', content: rawModelText.slice(0, 120) }
      yield { type: 'delta', content: rawModelText.slice(120) }
      yield {
        type: 'final',
        content: '短摘要：建议先收敛茶饮点单核心闭环。',
        proposal: JSON.parse(rawModelText).proposal,
        usage: { inputTokens: 1, outputTokens: 10, totalTokens: 11 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'proposal-stage-run',
      stepId: 'page-structure',
      model: 'gpt-5.5',
      clientMessageId: 'proposal-stage-client-1',
      message: { role: 'user', content: '完整展开茶饮小程序怎么做' },
      context: {
        activeNode: {
          id: 'page-structure',
          title: '页面结构树',
          summary: '拆解茶饮点单页面结构'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.match(result.assistantMessage.content, /完整方案/)
  assert.match(result.assistantMessage.content, /取餐码/)
  assert.notEqual(result.assistantMessage.content, '短摘要：建议先收敛茶饮点单核心闭环。')
  assert.equal(result.assistantMessage.meta?.rawModelContentPreserved, true)
  assert.equal(result.assistantMessage.meta?.modelParsedContent, '短摘要：建议先收敛茶饮点单核心闭环。')
  assert.ok(result.proposal?.id)
})

test('proposal stage stream expands final proposal object when raw stream only contains short content', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'proposal-final-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'page-structure',
        model: 'gpt-5.5',
        steps: [{ id: 'page-structure', title: '页面结构树' }],
        documentAnalysis: {
          canvas: {
            nodes: [
              {
                id: 'page-structure',
                title: '页面结构树',
                summary: '收敛茶饮点单核心路径',
                content: ['选店', '点单']
              }
            ],
            edges: []
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const finalProposal = {
    title: '补齐茶饮点单主流程',
    summary: '把茶饮小程序拆成选店、点单、定制、购物车、支付、取餐、查订单的主路径。',
    rationale: ['主路径决定后续页面结构、功能拆分和验收标准。'],
    contextSources: [
      {
        type: 'project_fact',
        title: '用户需求',
        snippet: '做一个茶饮点单小程序',
        matchReason: '这是当前需求解剖的根需求。'
      }
    ],
    writeableContent: {
      summary: '完整写入建议：先按到店自提的一期闭环推进，覆盖门店选择、菜单浏览、规格定制、购物车、微信支付、取餐码、订单查询。',
      items: [
        '选店：定位附近门店、切换门店、展示营业状态。',
        '点单：分类菜单、商品详情、规格定制、冷热甜度和加料。',
        '购物车：数量调整、优惠券、价格合计和备注。',
        '支付：微信支付、支付失败重试、支付成功页。',
        '取餐：取餐码、预计完成时间、订单状态通知。',
        '查订单：历史订单、再来一单、退款或客服入口。'
      ],
      acceptanceCriteria: [
        '主流程必须能从选店走到取餐码。',
        '规格定制和购物车价格必须联动。',
        '支付失败后必须能重试或返回购物车。'
      ]
    },
    downstreamImpact: [
      { nodeId: 'flow', reason: '交互路径需要承接选店到查订单的完整闭环。' },
      { nodeId: 'wireframe', reason: '低保真页面需要覆盖菜单、购物车、支付和取餐。' }
    ]
  }
  const provider = {
    name: 'proposal-final-provider',
    async *stream() {
      yield { type: 'delta', content: '已整理“选店、点单、定制、购物车、支付、取餐、查订单”的核心用户路径，建议作为需求解剖阶段的主流程写入画布。' }
      yield {
        type: 'final',
        content: '已整理“选店、点单、定制、购物车、支付、取餐、查订单”的核心用户路径，建议作为需求解剖阶段的主流程写入画布。',
        proposal: finalProposal,
        usage: { inputTokens: 2, outputTokens: 12, totalTokens: 14 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'proposal-final-run',
      stepId: 'page-structure',
      model: 'gpt-5.5',
      clientMessageId: 'proposal-final-client-1',
      message: { role: 'user', content: '整理茶饮点单主流程' },
      context: {
        activeNode: {
          id: 'page-structure',
          title: '页面结构树',
          summary: '收敛茶饮点单核心路径'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.match(result.assistantMessage.content, /完整写入建议/)
  assert.match(result.assistantMessage.content, /规格定制和购物车价格必须联动/)
  assert.match(result.assistantMessage.content, /交互路径需要承接/)
  assert.notEqual(result.assistantMessage.content, '已整理“选店、点单、定制、购物车、支付、取餐、查订单”的核心用户路径，建议作为需求解剖阶段的主流程写入画布。')
  assert.equal(result.assistantMessage.meta?.proposalExpandedForDisplay, true)
})

test('canvas page actions build rich writable proposals when model only returns a short reply', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'canvas-action-rich-fallback-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'menu-page',
        model: 'gpt-5.5',
        steps: [{ id: 'menu-page', title: '菜单首页' }],
        documentAnalysis: {
          canvas: {
            nodes: [
              { id: 'menu-page', title: '菜单首页', summary: '展示门店、分类、商品和购物车', content: ['旧首页'] },
              { id: 'cart-page', title: '购物车', summary: '承接加购结算', content: ['旧购物车'] }
            ],
            edges: []
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'short-canvas-action-provider',
    async generate() {
      return {
        content: '可以，建议补一下。',
        provider: 'short-canvas-action-provider',
        model: 'gpt-5.5'
      }
    }
  }

  const layoutResult = await appendRunMessageStream(
    store,
    {
      runId: 'canvas-action-rich-fallback-run',
      stepId: 'menu-page',
      model: 'gpt-5.5',
      clientMessageId: 'layout-action-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请处理画布动作：给布局方案' },
      context: {
        activeNode: { id: 'menu-page', title: '菜单首页', summary: '展示门店、分类、商品和购物车' },
        canvasAction: {
          actionLabel: '给布局方案',
          actionIntent: 'page-layout-plan',
          nodeId: 'menu-page'
        }
      }
    },
    { agentProvider: provider }
  )

  const detailResult = await appendRunMessageStream(
    store,
    {
      runId: 'canvas-action-rich-fallback-run',
      stepId: 'menu-page',
      model: 'gpt-5.5',
      clientMessageId: 'interaction-action-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请处理画布动作：补交互细节' },
      context: {
        activeNode: { id: 'menu-page', title: '菜单首页', summary: '展示门店、分类、商品和购物车' },
        canvasAction: {
          actionLabel: '补交互细节',
          actionIntent: 'interaction-detail-enrichment',
          nodeId: 'menu-page'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.match(layoutResult.proposal.writeableContent.items.join('\n'), /信息层级|首屏|区域|固定操作区/)
  assert.match(layoutResult.proposal.writeableContent.acceptanceCriteria.join('\n'), /布局|页面/)
  assert.equal(layoutResult.proposal.writeableContent.layoutOptions.length, 3)
  assert.ok(
    Array.isArray(layoutResult.proposal.writeableContent.layoutComparisonRows) &&
    layoutResult.proposal.writeableContent.layoutComparisonRows.length >= 4,
    'layout plan proposals should include model/backend-owned comparison rows for matrix rendering'
  )
  assert.deepEqual(
    layoutResult.proposal.writeableContent.layoutComparisonRows.map((row) => row.label).slice(0, 4),
    ['设计调性', '布局组织', '适合场景', '风险取舍'],
    'comparison rows should make the three candidates scan-friendly before details expand'
  )
  assert.deepEqual(
    layoutResult.proposal.writeableContent.layoutOptions.map((option) => option.id),
    ['layout-option-1', 'layout-option-2', 'layout-option-3']
  )
  assert.ok(
    layoutResult.proposal.writeableContent.layoutOptions.every((option) => Array.isArray(option.frameworkRows) && option.frameworkRows.length >= 4),
    'each layout candidate should keep same-page framework rows for the frontend preview'
  )
  assert.match(
    layoutResult.proposal.writeableContent.layoutOptions.map((option) => option.frameworkRows.join('\n')).join('\n---\n'),
    /顶部固定区[\s\S]*首屏核心区[\s\S]*内容滚动区[\s\S]*底部固定区/,
    'fallback layout candidates should reuse the current page framework regions instead of generic detached cards'
  )
  assert.deepEqual(
    layoutResult.proposal.writeableContent.layoutOptions.map((option) => option.title),
    ['轻量入口型', '运营推荐型', '效率任务型'],
    'fallback layout candidates should be allowed to differ by product tone, not only small arrangement changes'
  )
  assert.ok(
    layoutResult.proposal.writeableContent.layoutOptions.every((option) => option.layoutStyle),
    'each fallback candidate should expose a product/design tone for comparison'
  )
  assert.match(layoutResult.assistantMessage.content, /### 3 套候选框架/)
  assert.match(layoutResult.assistantMessage.content, /方案一/)
  assert.match(layoutResult.assistantMessage.content, /方案二/)
  assert.match(layoutResult.assistantMessage.content, /方案三/)
  assert.deepEqual(layoutResult.quickReplies.slice(0, 4), ['选 1 应用到画布', '选 2 应用到画布', '选 3 应用到画布', '不满意，重生成 3 个'])
  assert.match(detailResult.proposal.writeableContent.items.join('\n'), /点击|滑动|输入|反馈|跳转/)
  assert.match(detailResult.proposal.writeableContent.acceptanceCriteria.join('\n'), /交互|状态/)
})

test('streamed layout plan action expands short replies into three visible candidates', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stream-layout-action-rich-fallback-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'menu-page',
        model: 'gpt-5.5',
        steps: [{ id: 'menu-page', title: '菜单首页' }],
        documentAnalysis: {
          canvas: {
            nodes: [
              { id: 'menu-page', title: '菜单首页', summary: '展示门店、分类、商品和购物车', content: ['旧首页'] },
              { id: 'cart-page', title: '购物车', summary: '承接加购结算', content: ['旧购物车'] }
            ],
            edges: []
          }
        },
        agentSessions: {}
      }
    ]
  })
  const provider = {
    name: 'short-stream-layout-provider',
    async *stream(context) {
      yield { type: 'delta', content: '可以，建议补一下。' }
      yield {
        type: 'final',
        provider: 'short-stream-layout-provider',
        model: context.model
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'stream-layout-action-rich-fallback-run',
      stepId: 'menu-page',
      model: 'gpt-5.5',
      clientMessageId: 'stream-layout-action-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请处理画布动作：给布局方案' },
      context: {
        activeNode: { id: 'menu-page', title: '菜单首页', summary: '展示门店、分类、商品和购物车' },
        canvasAction: {
          actionLabel: '给布局方案',
          actionIntent: 'page-layout-plan',
          nodeId: 'menu-page'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.match(result.assistantMessage.content, /### 3 套候选框架/)
  assert.match(result.assistantMessage.content, /方案一/)
  assert.match(result.assistantMessage.content, /方案二/)
  assert.match(result.assistantMessage.content, /方案三/)
  assert.equal(result.proposal.writeableContent.layoutOptions.length, 3)
  assert.ok(
    Array.isArray(result.proposal.writeableContent.layoutComparisonRows) &&
    result.proposal.writeableContent.layoutComparisonRows.length >= 4,
    'streamed short layout fallback should include comparison rows for matrix rendering'
  )
  assert.ok(
    result.proposal.writeableContent.layoutComparisonRows.some((row) => row.label === '设计调性'),
    'streamed short layout fallback should compare product tone before drilling into details'
  )
  assert.ok(
    result.proposal.writeableContent.layoutOptions.every((option) => Array.isArray(option.frameworkRows) && option.frameworkRows.length >= 4),
    'streamed short layout fallback should still provide page-framework rows for all three candidates'
  )
  assert.deepEqual(result.quickReplies.slice(0, 4), ['选 1 应用到画布', '选 2 应用到画布', '选 3 应用到画布', '不满意，重生成 3 个'])
})

test('layout plan candidates reuse the current page wireframe content with different arrangements', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'layout-plan-current-wireframe-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'order-home',
        model: 'gpt-5.5',
        steps: [{ id: 'order-home', title: '点单首页' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'order-home',
                    stageId: 'interaction-lofi',
                    title: '点单首页',
                    summary: '展示门店、搜索、自提外卖切换、分类商品和悬浮购物车。',
                    content: ['页面总框架：顶部导航 + 左右分栏主体 + 悬浮购物车栏'],
                    pageLayoutArtifact: {
                      title: '点单首页页面骨架',
                      modelDecision: '点餐菜单页（左右分栏特殊框架）',
                      asciiWireframe: [
                        '点餐菜单页（左右分栏特殊框架）',
                        '页面总框架：顶部导航 + 左右分栏主体 + 悬浮购物车栏',
                        '推荐布局：左右分栏 + 右侧商品列表 + 悬浮购物车',
                        '门店  搜索  自提/外卖切换',
                        '左右分栏主体',
                        '左侧分类栏',
                        '右侧商品列表',
                        '悬浮购物车'
                      ].join('\n')
                    }
                  }
                ],
                edges: [],
                orderedTabs: ['order-home']
              }
            }
          }
        },
        agentSessions: {}
      }
    ]
  })
  const provider = {
    name: 'short-current-wireframe-provider',
    async generate() {
      return {
        content: '可以，建议补一下。',
        provider: 'short-current-wireframe-provider',
        model: 'gpt-5.5'
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'layout-plan-current-wireframe-run',
      stepId: 'order-home',
      model: 'gpt-5.5',
      clientMessageId: 'layout-current-wireframe-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请处理画布动作：给布局方案' },
      context: {
        activeNode: { id: 'order-home', stageId: 'interaction-lofi', title: '点单首页', summary: '展示门店、搜索、自提外卖切换、分类商品和悬浮购物车。' },
        canvasAction: {
          actionLabel: '给布局方案',
          actionIntent: 'page-layout-plan',
          nodeId: 'order-home'
        }
      }
    },
    { agentProvider: provider }
  )

  const optionText = result.proposal.writeableContent.layoutOptions
    .map((option) => option.frameworkRows.join('\n'))
    .join('\n---\n')

  assert.equal(result.proposal.writeableContent.layoutOptions.length, 3)
  assert.ok(
    result.proposal.writeableContent.layoutComparisonRows.some((row) => row.label === '保留框架'),
    'wireframe-based layout plans should expose retained framework content in comparison rows'
  )
  assert.ok(
    result.proposal.writeableContent.layoutOptions.every((option) =>
      /门店/.test(option.frameworkRows.join('\n')) &&
      /搜索/.test(option.frameworkRows.join('\n')) &&
      /自提\/外卖切换/.test(option.frameworkRows.join('\n')) &&
      /左右分栏主体/.test(option.frameworkRows.join('\n')) &&
      /悬浮购物车/.test(option.frameworkRows.join('\n'))
    ),
    'all three layout candidates should reuse the current page wireframe content'
  )
  assert.ok(
    result.proposal.writeableContent.layoutOptions.every((option) =>
      option.frameworkRows.some((row) => /^门店\s+搜索\s+自提\/外卖切换$/.test(row)) &&
      option.frameworkRows.some((row) => row === '左右分栏主体') &&
      option.frameworkRows.some((row) => row === '悬浮购物车')
    ),
    'wireframe rows should stay separated instead of collapsing the whole ascii frame into one long preview line'
  )
  assert.match(optionText, /轻量入口|运营推荐|效率任务/, 'candidates should differ by product tone and layout strategy, not by replacing page content')
  assert.deepEqual(
    result.proposal.writeableContent.layoutOptions.map((option) => option.title),
    ['轻量入口型', '运营推荐型', '效率任务型'],
    'wireframe-based fallback candidates should offer clearly different layout styles while keeping the same functional outline'
  )
})

test('layout plan quality guard falls back when model candidates are too similar or incomplete', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'layout-plan-quality-guard-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'order-home',
        model: 'gpt-5.5',
        steps: [{ id: 'order-home', title: '点单首页' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'order-home',
                    stageId: 'interaction-lofi',
                    title: '点单首页',
                    summary: '展示门店、搜索、自提外卖切换、分类商品和悬浮购物车。',
                    pageLayoutArtifact: {
                      title: '点单首页页面骨架',
                      modelDecision: '点餐菜单页',
                      asciiWireframe: [
                        '门店 搜索 自提/外卖切换',
                        '左右分栏主体',
                        '左侧分类栏',
                        '右侧商品列表',
                        '悬浮购物车'
                      ].join('\n')
                    }
                  }
                ],
                edges: [],
                orderedTabs: ['order-home']
              }
            }
          }
        },
        agentSessions: {}
      }
    ]
  })
  const provider = {
    name: 'weak-layout-provider',
    async generate() {
      return {
        content: '给三套布局。',
        proposal: {
          title: '点单首页布局方案',
          summary: '三套候选方案。',
          writeableContent: {
            summary: '三套候选方案。',
            items: ['保留点单首页功能。'],
            acceptanceCriteria: ['不丢失关键入口。'],
            layoutOptions: [
              {
                id: 'weak-1',
                label: '方案一',
                title: '推荐布局',
                summary: '顶部导航、内容列表、底部按钮。',
                layoutStyle: '通用',
                layoutStrategy: '顶部导航、内容列表、底部按钮。',
                layout: ['顶部导航', '内容列表', '底部按钮']
              },
              {
                id: 'weak-2',
                label: '方案二',
                title: '推荐布局',
                summary: '顶部导航、内容列表、底部按钮。',
                layoutStyle: '通用',
                layoutStrategy: '顶部导航、内容列表、底部按钮。',
                layout: ['顶部导航', '内容列表', '底部按钮']
              },
              {
                id: 'weak-3',
                label: '方案三',
                title: '推荐布局',
                summary: '顶部导航、内容列表、底部按钮。',
                layoutStyle: '通用',
                layoutStrategy: '顶部导航、内容列表、底部按钮。',
                layout: ['顶部导航', '内容列表', '底部按钮']
              }
            ]
          }
        },
        provider: 'weak-layout-provider',
        model: 'gpt-5.5'
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'layout-plan-quality-guard-run',
      stepId: 'order-home',
      model: 'gpt-5.5',
      clientMessageId: 'layout-quality-guard-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请处理画布动作：给布局方案' },
      context: {
        activeNode: { id: 'order-home', stageId: 'interaction-lofi', title: '点单首页' },
        canvasAction: {
          actionLabel: '给布局方案',
          actionIntent: 'page-layout-plan',
          nodeId: 'order-home'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.deepEqual(
    result.proposal.writeableContent.layoutOptions.map((option) => option.title),
    ['轻量入口型', '运营推荐型', '效率任务型'],
    'weak or duplicate model layout options should be replaced by high-contrast fallback candidates'
  )
  assert.equal(result.proposal.writeableContent.layoutQualityStatus, 'fallback-applied')
  assert.match(result.proposal.writeableContent.layoutQualityReason, /区分度不足|缺少/)
})

test('layout plan quality guard rejects D E F candidates with duplicate framework previews', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'layout-plan-duplicate-framework-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'order-home',
        model: 'gpt-5.5',
        steps: [{ id: 'order-home', title: '点单首页' }],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'order-home',
                    stageId: 'interaction-lofi',
                    title: '点单首页',
                    summary: '展示门店、搜索、自提外卖切换、分类商品和悬浮购物车。',
                    pageLayoutArtifact: {
                      title: '点单首页页面骨架',
                      modelDecision: '点餐菜单页（左右分栏特殊框架）',
                      asciiWireframe: [
                        '点餐菜单页（左右分栏特殊框架）',
                        '门店 搜索 自提/外卖切换',
                        '左右分栏主体',
                        '左侧分类栏',
                        '右侧商品列表',
                        '悬浮购物车'
                      ].join('\n')
                    }
                  }
                ],
                edges: [],
                orderedTabs: ['order-home']
              }
            }
          }
        },
        agentSessions: {}
      }
    ]
  })
  const duplicateFramework = ['顶部导航', '左右分栏主体', '左侧分类栏', '右侧商品列表', '悬浮购物车']
  const provider = {
    name: 'duplicate-framework-provider',
    async generate() {
      return {
        content: '给 D/E/F 三套方案。',
        proposal: {
          title: '点单首页布局方案',
          summary: '三套候选方案。',
          writeableContent: {
            summary: '三套候选方案。',
            items: ['保留点单首页功能。'],
            acceptanceCriteria: ['不丢失关键入口。'],
            layoutOptions: ['D', 'E', 'F'].map((suffix, index) => ({
              id: `model-${suffix}`,
              label: `方案${suffix}`,
              title: `方案${suffix}`,
              summary: `方案${suffix}保留同一套页面框架。`,
              layoutStyle: ['科技感', '内容沉浸型', '数据看板型'][index],
              layoutStrategy: `方案${suffix}采用相同布局组织。`,
              frameworkRows: duplicateFramework,
              layout: duplicateFramework,
              bestFor: '当前页面',
              risk: '区分度不足'
            }))
          }
        },
        provider: 'duplicate-framework-provider',
        model: 'gpt-5.5'
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'layout-plan-duplicate-framework-run',
      stepId: 'order-home',
      model: 'gpt-5.5',
      clientMessageId: 'layout-duplicate-framework-client',
      action: 'canvas-action-advice',
      message: { role: 'user', content: '请处理画布动作：给布局方案' },
      context: {
        activeNode: { id: 'order-home', stageId: 'interaction-lofi', title: '点单首页' },
        canvasAction: {
          actionLabel: '给布局方案',
          actionIntent: 'page-layout-plan',
          nodeId: 'order-home'
        }
      }
    },
    { agentProvider: provider }
  )

  assert.deepEqual(
    result.proposal.writeableContent.layoutOptions.map((option) => option.title),
    ['轻量入口型', '运营推荐型', '效率任务型'],
    'D/E/F candidates with duplicate framework previews should be replaced by distinct same-page fallbacks'
  )
  assert.equal(result.proposal.writeableContent.layoutQualityStatus, 'fallback-applied')
  assert.match(result.proposal.writeableContent.layoutQualityReason, /框架预览区分度不足/)
})

test('confirming a layout option writes only the selected candidate into canvas', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'layout-option-confirm-run',
        workflowId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'home-page',
        model: 'gpt-5.5',
        steps: [{ id: 'home-page', title: '首页与选店' }],
        documentAnalysis: {
          canvas: {
            nodes: [
              { id: 'home-page', title: '首页与选店', summary: '旧首页布局', content: ['旧首页内容'] },
              { id: 'menu-page', title: '菜单页', summary: '旧菜单', content: ['旧菜单内容'] }
            ],
            edges: []
          },
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'home-page',
                    stageId: 'interaction-lofi',
                    title: '首页与选店',
                    summary: '旧首页布局',
                    content: ['旧首页内容'],
                    pageLayoutArtifact: {
                      title: '首页与选店页面骨架',
                      asciiWireframe: '旧线框'
                    }
                  },
                  { id: 'menu-page', stageId: 'interaction-lofi', title: '菜单页', summary: '旧菜单', content: ['旧菜单内容'] }
                ],
                edges: [],
                orderedTabs: []
              }
            }
          },
          versions: []
        },
        agentSessions: {},
        agentProposals: {
          'home-page': [{
            id: 'proposal-layout-options',
            nodeId: 'home-page',
            title: '首页与选店 3 套布局候选',
            summary: '选择一套布局后写入画布。',
            status: 'pending',
            actionIntent: 'page-layout-plan',
            writeableContent: {
              summary: '先从 3 套布局里选择一套。',
              items: ['待选择布局候选。'],
              acceptanceCriteria: ['只写入被选中的候选。'],
              layoutOptions: [
                {
                  id: 'layout-option-1',
                  label: '方案一',
                  title: '轻量入口型',
                  summary: '首页优先降低进入点单前的决策成本。',
                  layout: ['顶部定位与门店切换', '中部推荐门店卡片', '底部开始点单按钮'],
                  risk: '运营露出较弱。'
                },
                {
                  id: 'layout-option-2',
                  label: '方案二',
                  title: '运营推荐型',
                  summary: '首页承载活动、推荐和会员入口，再引导开始点单。',
                  layout: ['顶部定位与搜索', '中部活动横幅和推荐门店', '底部开始点单与会员入口'],
                  risk: '信息密度偏高。'
                },
                {
                  id: 'layout-option-3',
                  label: '方案三',
                  title: '效率任务型',
                  summary: '首页直接突出最近门店和一键继续点单。',
                  layout: ['顶部最近门店', '中部继续点单卡片', '底部订单状态'],
                  risk: '新用户引导较少。'
                }
              ]
            },
            downstreamImpact: [{ nodeId: 'menu-page', reason: '首页入口会影响菜单页承接口径。' }]
          }]
        }
      }
    ]
  })

  const result = await confirmRunAgentProposal(
    store,
    {
      runId: 'layout-option-confirm-run',
      proposalId: 'proposal-layout-options',
      nodeId: 'home-page',
      selectedLayoutOptionId: 'layout-option-2',
      confirmMode: 'merge-current-and-downstream'
    }
  )

  assert.match(result.analysis.canvas.nodes[0].summary, /运营推荐型/)
  assert.match(result.analysis.canvas.nodes[0].content.join('\n'), /活动横幅/)
  assert.doesNotMatch(result.analysis.canvas.nodes[0].content.join('\n'), /继续点单卡片/)
  assert.match(result.analysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes[0].pageLayoutArtifact.modelDecision, /运营推荐型/)
  assert.equal(result.appliedPatch.selectedLayoutOption.title, '运营推荐型')
  assert.equal(result.appliedPatch.selectedLayoutOption.id, 'layout-option-2')
  assert.match(result.analysis.versions[0].label, /应用方案二 · 运营推荐型/)
  assert.match(result.analysis.versions[0].summary, /运营推荐型/)
  assert.equal(result.analysis.versions[0].source, 'agent-layout-option')
})

test('bare chat-only stage stream persists without active canvas node or workflow step', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'bare-chat-stage-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: '',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          totalDesignFlow: {
            currentStage: 'requirement-dissection',
            stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
            stageCanvases: {
              'requirement-dissection': {
                mode: 'stage-agent-workbench',
                agentWorkbench: true,
                nodes: []
              }
            }
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })
  const provider = {
    name: 'bare-chat-provider',
    async *stream() {
      yield { type: 'delta', content: '模型完整回复：先按自提点单闭环拆解茶饮小程序。' }
      yield {
        type: 'final',
        content: '短回复',
        usage: { inputTokens: 2, outputTokens: 12, totalTokens: 14 }
      }
    }
  }

  const result = await appendRunMessageStream(
    store,
    {
      runId: 'bare-chat-stage-run',
      stepId: 'requirement-dissection',
      model: 'gpt-5.5',
      clientMessageId: 'bare-chat-client-1',
      message: { role: 'user', content: '继续分析' },
      context: {
        activeNode: null,
        canvasAction: null
      }
    },
    { agentProvider: provider }
  )

  assert.equal(result.assistantMessage.role, 'assistant')
  assert.equal(result.assistantMessage.content, '模型完整回复：先按自提点单闭环拆解茶饮小程序。')
  assert.equal(result.proposal, null)
  assert.equal(result.run.agentSessions['requirement-dissection'].filter((item) => item.role === 'assistant').length, 1)
  assert.deepEqual(result.run.agentProposals || {}, {})
})

test('proposal confirm ignores plain model text and falls back to proposal writeable content', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'plain-confirm-patch-run',
        workflowId: 'total-design-flow',
        input: '做一个茶饮点单小程序',
        model: 'gpt-5.5',
        documentAnalysis: {
          canvas: {
            nodes: [
              { id: 'menu', title: '首页菜单', summary: '旧首页', content: ['只展示活动'] },
              { id: 'cart', title: '购物车', summary: '旧购物车', content: ['只展示总价'] }
            ],
            edges: [],
            orderedTabs: []
          },
          versions: []
        },
        agentSessions: {},
        agentProposals: {
          menu: [
            {
              id: 'proposal-menu-layout',
              nodeId: 'menu',
              title: '首页菜单布局建议',
              summary: '补齐点餐首页布局。',
              status: 'pending',
              writeableContent: {
                summary: '首页菜单采用顶部门店与搜索、左右分栏商品列表、底部购物车栏。',
                items: ['顶部放门店与搜索', '左侧分类列表', '右侧商品卡片', '底部购物车栏'],
                acceptanceCriteria: ['用户能从首页进入点餐、加购和结算']
              },
              downstreamImpact: [{ nodeId: 'cart', reason: '首页加购会影响购物车结算口径。' }]
            }
          ]
        }
      }
    ]
  })
  const provider = {
    name: 'plain-confirm-provider',
    async generate(context) {
      assert.equal(context.actionType, 'agent-proposal-confirm')
      return {
        content: '可以，已按首页菜单方案整理写入内容。',
        provider: 'plain-confirm-provider',
        model: context.model
      }
    }
  }

  const result = await confirmRunAgentProposal(
    store,
    {
      runId: 'plain-confirm-patch-run',
      proposalId: 'proposal-menu-layout',
      nodeId: 'menu',
      confirmMode: 'merge-current-and-downstream'
    },
    { agentProvider: provider }
  )

  assert.equal(result.analysis.canvas.nodes[0].summary, '首页菜单采用顶部门店与搜索、左右分栏商品列表、底部购物车栏。')
  assert.match(result.analysis.canvas.nodes[0].content.join('\n'), /左侧分类列表/)
  assert.match(result.analysis.canvas.nodes[1].content.join('\n'), /首页加购会影响购物车结算口径/)
  assert.equal(result.run.agentProposals.menu[0].status, 'confirmed')
})

test('proposal confirm syncs interaction lofi stage canvas page node', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stage-confirm-sync-run',
        workflowId: 'total-design-flow',
        input: '做一个茶饮点单小程序',
        model: 'gpt-5.5',
        documentAnalysis: {
          canvas: {
            nodes: [
              { id: 'menu-page', title: '菜单首页', summary: '旧首页摘要', content: ['旧内容'] },
              { id: 'cart-page', title: '购物车', summary: '旧购物车', content: ['旧购物车内容'] }
            ],
            edges: [],
            orderedTabs: []
          },
          totalDesignFlow: {
            currentStage: 'interaction-lofi',
            stages: [{ id: 'interaction-lofi', name: '交互低保' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'menu-page',
                    stageId: 'interaction-lofi',
                    title: '菜单首页',
                    summary: '旧首页摘要',
                    content: ['旧内容'],
                    pageLayoutArtifact: {
                      title: '菜单首页页面骨架',
                      asciiWireframe: '旧线框',
                      screenContract: {
                        screenPurpose: { primaryJob: '浏览商品' },
                        designInvariants: { mustSee: ['商品列表'] }
                      }
                    }
                  },
                  {
                    id: 'cart-page',
                    stageId: 'interaction-lofi',
                    title: '购物车',
                    summary: '旧购物车',
                    content: ['旧购物车内容']
                  }
                ],
                edges: [],
                orderedTabs: []
              }
            }
          },
          versions: []
        },
        agentSessions: {},
        agentProposals: {
          'menu-page': [
            {
              id: 'proposal-menu-page-layout',
              nodeId: 'menu-page',
              title: '菜单首页布局建议',
              summary: '补齐菜单首页布局。',
              status: 'pending',
              actionIntent: 'page-layout-plan',
              writeableContent: {
                summary: '菜单首页需要保留顶部门店与搜索、左侧分类、右侧商品卡、底部购物车栏。',
                items: ['顶部门店与搜索常驻', '左侧分类和右侧商品卡联动', '底部购物车栏始终可见'],
                acceptanceCriteria: ['应用后当前交互低保页卡片能看到新的布局摘要']
              },
              downstreamImpact: [{ nodeId: 'cart-page', reason: '菜单加购会影响购物车入口和结算口径。' }]
            }
          ]
        }
      }
    ]
  })

  const result = await confirmRunAgentProposal(
    store,
    {
      runId: 'stage-confirm-sync-run',
      proposalId: 'proposal-menu-page-layout',
      nodeId: 'menu-page',
      confirmMode: 'merge-current-and-downstream'
    }
  )

  const stageNodes = result.analysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes
  assert.equal(stageNodes[0].summary, '菜单首页需要保留顶部门店与搜索、左侧分类、右侧商品卡、底部购物车栏。')
  assert.match(stageNodes[0].content.join('\n'), /左侧分类和右侧商品卡联动/)
  assert.equal(stageNodes[0].updatedByAgentProposalId, 'proposal-menu-page-layout')
  assert.equal(stageNodes[0].pageLayoutArtifact.asciiWireframe, '旧线框')
  assert.match(stageNodes[0].pageLayoutArtifact.modelDecision, /顶部门店与搜索/)
  assert.match(stageNodes[0].pageLayoutArtifact.interactionDetails, /底部购物车栏/)
  assert.match(stageNodes[1].content.join('\n'), /菜单加购会影响购物车入口和结算口径/)
  assert.ok(result.appliedPatch.changedNodeIds.includes('menu-page'))
  assert.ok(result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes[0].content.some((item) => /底部购物车栏/.test(item)))
})

test('canvas artifact generation resolves nodes from total design flow stage canvases', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stage-canvas-artifact-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        demandScope: 'project',
        projectId: 'project-tea',
        currentStepId: 'ui-visual',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          canvas: { nodes: [], edges: [] },
          totalDesignFlow: {
            currentStage: 'ui-visual',
            stages: [{ id: 'ui-visual', name: 'UI 视觉' }],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'p1',
                    stageId: 'interaction-lofi',
                    title: '菜单首页',
                    sliceId: 'rs1',
                    pageLayoutArtifact: {
                      title: '页面骨架',
                      asciiWireframe: [
                        '页面总框架：顶部导航 + 左右分栏主体 + 悬浮购物车栏 + 底部Tab',
                        '左固定分类栏，右滚动商品列表',
                        '商品卡左图右文，底部固定购物车操作栏'
                      ].join('\n'),
                      screenContract: {
                        screenPurpose: {
                          userRole: '消费者',
                          primaryJob: '快速浏览饮品并连续加购',
                          businessGoal: '提高加购和结算转化'
                        },
                        designInvariants: {
                          mustSee: ['分类导航', '商品列表', '购物车状态'],
                          mustDo: ['切换分类', '加购', '去结算'],
                          mustKeepRelations: ['分类导航必须和商品列表形成一一对应关系', '购物车入口必须始终可见']
                        },
                        freedomBudget: {
                          imageModelCanChange: ['品牌视觉', '商品图片风格', '促销标签'],
                          imageModelCannotChange: ['分类-商品关系', '购物车常驻', '主结算入口']
                        },
                        evaluationRubric: {
                          pass: ['用户一眼知道如何选商品', '能连续加购'],
                          fail: ['取消分类导航', '商品卡缺少价格或加购']
                        }
                      }
                    }
                  }
                ],
                edges: [],
                orderedTabs: [{ key: 'p1', label: '菜单首页' }]
              },
              'ui-visual': {
                nodes: [
                  {
                    id: 'ui-p1',
                    stageId: 'ui-visual',
                    title: '首页与选店 UI视觉',
                    targetGenerator: 'gpt-image-2',
                    generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
                    visualPreview: {
                      imagePrompt: '为茶饮点单首页生成移动端高保真图。',
                      aspectRatio: '9:16',
                      imageStatus: 'failed',
                      configurationMessage: '旧失败原因',
                      errorCode: 'OLD_ERROR'
                    }
                  }
                ],
                edges: [],
                orderedTabs: [{ key: 'ui-p1', label: '首页与选店 UI视觉' }]
              }
            }
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })

  const result = await generateRunCanvasNodeArtifact(
    store,
    {
      runId: 'stage-canvas-artifact-run',
      nodeId: 'ui-p1',
      generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
      targetGenerator: 'gpt-image-2',
      projectVisualContext: {
        source: 'project-knowledge',
        pages: [
          {
            title: '项目知识库首页截图',
            screenshotUrl: '/api/workspace/prototype-assets/menu-home.png',
            viewport: { width: 390, height: 844 },
            components: ['顶部门店栏', '品牌商品卡', '底部购物车']
          }
        ],
        notes: ['沿用项目知识库里的浅色品牌底、圆角商品卡和橙色主按钮。']
      }
    },
    {
      resolveImageReference: async (url) => {
        if (url === '/api/workspace/prototype-assets/menu-home.png') {
          return {
            imageDataUrl: 'data:image/png;base64,a25vd2xlZGdlLXJlZmVyZW5jZQ==',
            sourceUrl: url,
            title: '项目知识库首页截图'
          }
        }
        return null
      },
      imageProvider: {
        name: 'test-image-provider',
        async generate(context) {
          assert.match(context.prompt, /上一阶段交互低保/)
          assert.match(context.prompt, /左右分栏主体/)
          assert.match(context.prompt, /左固定分类栏/)
          assert.match(context.prompt, /悬浮购物车/)
          assert.match(context.prompt, /Screen Contract/)
          assert.match(context.prompt, /快速浏览饮品并连续加购/)
          assert.match(context.prompt, /imageModelCannotChange/)
          assert.match(context.prompt, /目标图片比例：9:16/)
          assert.match(context.prompt, /项目知识库视觉参考/)
          assert.match(context.prompt, /项目知识库首页截图/)
          assert.match(context.prompt, /浅色品牌底/)
          assert.equal(context.aspectRatio, '9:16')
          assert.equal(context.projectVisualContext.pages[0].title, '项目知识库首页截图')
          assert.equal(context.referenceImages.length, 1)
          assert.equal(context.referenceImages[0].imageDataUrl, 'data:image/png;base64,a25vd2xlZGdlLXJlZmVyZW5jZQ==')
          assert.equal(context.referenceImages[0].title, '项目知识库首页截图')
          return {
            imageDataUrl: 'data:image/png;base64,c3RhZ2UtY2FudmFzLWltYWdl',
            provider: 'test-image-provider',
            model: 'gpt-image-2'
          }
        }
      }
    }
  )

  const stageNode = result.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
  assert.equal(stageNode.artifactStatus, 'generated')
  assert.equal(stageNode.visualPreview.imageStatus, 'generated')
  assert.equal(stageNode.visualPreview.imageDataUrl, 'data:image/png;base64,c3RhZ2UtY2FudmFzLWltYWdl')
  assert.equal(stageNode.visualPreview.configurationMessage, '')
  assert.equal(stageNode.visualPreview.errorCode, '')
  assert.equal(stageNode.visualPreview.aspectRatio, '9:16')
  assert.equal(stageNode.artifact.aspectRatio, '9:16')
  assert.match(stageNode.artifact.imagePrompt, /上一阶段交互低保/)
  assert.match(stageNode.artifact.imagePrompt, /项目知识库视觉参考/)
  assert.equal(result.node.id, 'ui-p1')
  assert.equal(result.artifact.imageStatus, 'generated')
})

test('canvas artifact generation normalizes guidance on legacy total flow without changing demand scope', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'legacy-total-flow-artifact-guidance-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '历史非项目需求',
        input: '做一个茶饮点单小程序',
        demandScope: 'non-project',
        currentStepId: 'ui-visual',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          canvas: { nodes: [], edges: [] },
          totalDesignFlow: {
            currentStage: 'ui-visual',
            stages: [{ id: 'ui-visual', name: 'UI 视觉' }],
            stageCanvases: {
              'ui-visual': {
                nodes: [
                  {
                    id: 'visual-p1',
                    stageId: 'ui-visual',
                    title: '菜单首页 UI',
                    generationActions: [{ id: 'generate-visual', targetGenerator: 'gpt-image-2' }],
                    visualPreview: { imagePrompt: '生成菜单首页 UI' }
                  }
                ],
                edges: []
              }
            }
          }
        },
        referenceFiles: {},
        agentSessions: {}
      }
    ]
  })

  const result = await generateRunCanvasNodeArtifact(store, {
    runId: 'legacy-total-flow-artifact-guidance-run',
    nodeId: 'visual-p1',
    generationAction: { id: 'generate-visual', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  }, {
    imageProvider: {
      name: 'legacy-guidance-image-provider',
      async generate() {
        return { imageUrl: 'https://example.test/menu.png', provider: 'legacy-guidance-image-provider', model: 'gpt-image-2' }
      }
    }
  })

  const guidance = result.run.documentAnalysis.totalDesignFlow.requirementDissectionArtifact.analysisGuidance
  assert.equal(guidance.version, 'requirement-dissection-guidance/v1')
  assert.equal(result.run.demandScope, 'non-project')
  assert.doesNotMatch(JSON.stringify(result.run.referenceFiles), /product-contracts|docs\/skills|superpowers\/specs/)
})

test('canvas artifact generation infers app and web target image sizes when ratio is absent', async () => {
  const runWithNode = (id, input, nodeTitle) => ({
    id,
    workflowId: 'total-design-flow',
    skillId: 'total-design-flow',
    workflowName: nodeTitle,
    input,
    demandScope: 'non-project',
    currentStepId: 'ui-visual',
    model: 'gpt-5.5',
    steps: [],
    documentAnalysis: {
      canvas: { nodes: [], edges: [] },
      totalDesignFlow: {
        currentStage: 'ui-visual',
        stages: [{ id: 'ui-visual', name: 'UI 视觉' }],
        stageCanvases: {
          'ui-visual': {
            nodes: [
              {
                id: `${id}-node`,
                stageId: 'ui-visual',
                title: nodeTitle,
                targetGenerator: 'gpt-image-2',
                generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
                visualPreview: {
                  imagePrompt: `为「${nodeTitle}」生成高保真 UI 视觉稿。`,
                  imageStatus: 'pending'
                }
              }
            ],
            edges: [],
            orderedTabs: [{ key: `${id}-node`, label: nodeTitle }]
          }
        }
      }
    },
    agentSessions: {},
    referenceFiles: {}
  })
  const store = createWorkflowRunnerStore({
    runs: [
      runWithNode('mobile-target-run', '做一个茶饮点单小程序 App', '点单首页 UI视觉'),
      runWithNode('web-target-run', '做一个后台管理 Web 页面', '运营管理后台 UI视觉')
    ]
  })
  const seen = []
  const imageProvider = {
    name: 'test-image-provider',
    async generate(context) {
      seen.push({
        runId: context.run.id,
        aspectRatio: context.aspectRatio,
        targetImageSize: context.targetImageSize,
        prompt: context.prompt
      })
      return {
        imageDataUrl: `data:image/png;base64,${Buffer.from(context.run.id).toString('base64')}`,
        provider: 'test-image-provider',
        model: 'gpt-image-2'
      }
    }
  }

  await generateRunCanvasNodeArtifact(store, {
    runId: 'mobile-target-run',
    nodeId: 'mobile-target-run-node',
    generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  }, { imageProvider })
  await generateRunCanvasNodeArtifact(store, {
    runId: 'web-target-run',
    nodeId: 'web-target-run-node',
    generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  }, { imageProvider })

  const mobile = seen.find((item) => item.runId === 'mobile-target-run')
  const web = seen.find((item) => item.runId === 'web-target-run')
  assert.deepEqual(mobile.targetImageSize, { width: 375 })
  assert.equal(mobile.aspectRatio, '375:812')
  assert.match(mobile.prompt, /目标图片宽度：375px，高度按内容比例自适应/)
  assert.doesNotMatch(mobile.prompt, /目标图片尺寸：375x812/)
  assert.deepEqual(web.targetImageSize, { width: 1920 })
  assert.equal(web.aspectRatio, '1920:1080')
  assert.match(web.prompt, /目标图片宽度：1920px，高度按内容比例自适应/)
  assert.doesNotMatch(web.prompt, /目标图片尺寸：1920x1080/)
})

test('HTML canvas artifact renders UI context and interaction hooks from upstream stages', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stage-canvas-html-runtime-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'html-output',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          canvas: { nodes: [], edges: [] },
          totalDesignFlow: {
            currentStage: 'html-output',
            stages: [
              { id: 'interaction-lofi', name: '交互低保' },
              { id: 'ui-visual', name: 'UI视觉' },
              { id: 'html-output', name: 'HTML' }
            ],
            stageCanvases: {
              'interaction-lofi': {
                nodes: [
                  {
                    id: 'p1',
                    pageId: 'p1',
                    stageId: 'interaction-lofi',
                    title: '点单首页',
                    summary: '顾客浏览门店菜单并连续加购。',
                    pageLayoutArtifact: {
                      title: '点单首页页面骨架',
                      asciiWireframe: '门店搜索栏\n左右分栏菜单\n底部购物车',
                      sections: [
                        { title: '顶部固定区', items: ['门店搜索栏', '自提/外卖切换'] },
                        { title: '内容滚动区', items: ['分类侧栏', '商品卡片列表'] },
                        { title: '底部固定区', items: ['底部购物车', '去结算按钮'] }
                      ],
                      interactionDetails: '内容区纵向滚动，底部购物车固定。'
                    },
                    interactionSpecArtifact: {
                      states: ['默认态', '加载态', '空购物车态', '失败重试态'],
                      gestureNotes: ['下拉刷新触发菜单接口刷新', '点击加购按钮更新底部购物车'],
                      interactionRows: [
                        { target: '加购按钮', gesture: '点击', result: '更新底部购物车数量和金额' }
                      ]
                    }
                  }
                ],
                edges: [],
                orderedTabs: ['p1']
              },
              'ui-visual': {
                nodes: [
                  {
                    id: 'ui-p1',
                    pageId: 'p1',
                    sourcePageId: 'p1',
                    stageId: 'ui-visual',
                    title: '点单首页 UI视觉',
                    visualBrief: {
                      pageTitle: '点单首页',
                      layoutFocus: '浅色品牌底、橙色主按钮、商品卡片有圆角和轻阴影。',
                      componentChecklist: ['门店胶囊栏', '智能推荐商品卡', '悬浮购物车']
                    },
                    visualPreview: {
                      imagePrompt: '移动端茶饮点单首页，高保真截图质感。'
                    }
                  }
                ],
                edges: [],
                orderedTabs: ['ui-p1']
              },
              'html-output': {
                nodes: [
                  {
                    id: 'html-page-p1',
                    pageId: 'p1',
                    sourcePageId: 'p1',
                    stageId: 'html-output',
                    title: '点单首页 HTML',
                    targetGenerator: 'html',
                    artifactStatus: 'pending',
                    generationActions: [{ id: 'generate-html-p1', label: '生成 HTML', targetGenerator: 'html' }],
                    codePreview: { previewTitle: '点单首页 HTML 运行预览', previewSummary: '生成后预览页面。', codeLanguage: 'html', code: '' }
                  }
                ],
                edges: [],
                orderedTabs: ['html-page-p1']
              }
            }
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })

  const result = await generateRunCanvasNodeArtifact(store, {
    runId: 'stage-canvas-html-runtime-run',
    nodeId: 'html-page-p1',
    generationAction: { id: 'generate-html-p1', label: '生成 HTML', targetGenerator: 'html' },
    targetGenerator: 'html'
  })

  const stageNode = result.analysis.totalDesignFlow.stageCanvases['html-output'].nodes[0]
  const html = stageNode.artifact.html
  assert.equal(stageNode.artifactStatus, 'generated')
  assert.equal(stageNode.codePreview.code, html)
  assert.match(html, /data-html-preview="mobile-page"/)
  assert.match(html, /class="mobile-screen"/)
  assert.match(html, /class="app-card"/)
  assert.match(html, /门店搜索栏/)
  assert.match(html, /底部购物车/)
  assert.match(html, /智能推荐商品卡/)
  assert.match(html, /浅色品牌底/)
  assert.match(html, /下拉刷新触发菜单接口刷新/)
  assert.match(html, /data-state-target="demo-state"/)
  assert.match(html, /data-html-demo-action="toggle-loading"/)
  assert.match(html, /data-html-demo-action="toggle-empty"/)
  assert.match(html, /addEventListener\('click'/)
  assert.doesNotMatch(html, /页面结构<\/h2>[\s\S]*视觉组件<\/h2>/)
})

test('canvas artifact generation stores image provider failures on the stage node', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stage-canvas-image-failure-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'ui-visual',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          canvas: { nodes: [], edges: [] },
          totalDesignFlow: {
            currentStage: 'ui-visual',
            stages: [{ id: 'ui-visual', name: 'UI 视觉' }],
            stageCanvases: {
              'ui-visual': {
                nodes: [
                  {
                    id: 'ui-p1',
                    stageId: 'ui-visual',
                    title: '首页与选店 UI视觉',
                    targetGenerator: 'gpt-image-2',
                    generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
                    visualPreview: {
                      imagePrompt: '为茶饮点单首页生成移动端高保真图。',
                      imageStatus: 'pending'
                    }
                  }
                ],
                edges: [],
                orderedTabs: [{ key: 'ui-p1', label: '首页与选店 UI视觉' }]
              }
            }
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })

  const result = await generateRunCanvasNodeArtifact(
    store,
    {
      runId: 'stage-canvas-image-failure-run',
      nodeId: 'ui-p1',
      generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
      targetGenerator: 'gpt-image-2'
    },
    {
      imageProvider: {
        name: 'test-image-provider',
        async generate() {
          throw new Error('图片服务返回空响应')
        }
      }
    }
  )

  const stageNode = result.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
  assert.equal(stageNode.artifactStatus, 'failed')
  assert.equal(stageNode.visualPreview.imageStatus, 'failed')
  assert.match(stageNode.visualPreview.configurationMessage, /图片服务返回空响应/)
  assert.equal(result.artifact.imageStatus, 'failed')
})

test('canvas artifact generation does not mark empty image provider output as generated', async () => {
  const store = createWorkflowRunnerStore({
    runs: [
      {
        id: 'stage-canvas-empty-image-run',
        workflowId: 'total-design-flow',
        skillId: 'total-design-flow',
        workflowName: '茶饮点单',
        input: '做一个茶饮点单小程序',
        currentStepId: 'ui-visual',
        model: 'gpt-5.5',
        steps: [],
        documentAnalysis: {
          canvas: { nodes: [], edges: [] },
          totalDesignFlow: {
            currentStage: 'ui-visual',
            stages: [{ id: 'ui-visual', name: 'UI 视觉' }],
            stageCanvases: {
              'ui-visual': {
                nodes: [
                  {
                    id: 'ui-p1',
                    stageId: 'ui-visual',
                    title: '首页与选店 UI视觉',
                    targetGenerator: 'gpt-image-2',
                    generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
                    visualPreview: {
                      imagePrompt: '为茶饮点单首页生成移动端高保真图。',
                      imageStatus: 'pending'
                    }
                  }
                ],
                edges: [],
                orderedTabs: [{ key: 'ui-p1', label: '首页与选店 UI视觉' }]
              }
            }
          }
        },
        agentSessions: {},
        referenceFiles: {}
      }
    ]
  })

  const result = await generateRunCanvasNodeArtifact(
    store,
    {
      runId: 'stage-canvas-empty-image-run',
      nodeId: 'ui-p1',
      generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
      targetGenerator: 'gpt-image-2'
    },
    {
      imageProvider: {
        name: 'empty-image-provider',
        async generate() {
          return { provider: 'empty-image-provider', model: 'gpt-image-2' }
        }
      }
    }
  )

  const stageNode = result.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
  assert.equal(stageNode.artifactStatus, 'failed')
  assert.equal(stageNode.visualPreview.imageStatus, 'failed')
  assert.ok(!stageNode.visualPreview.imageDataUrl)
  assert.match(stageNode.visualPreview.configurationMessage, /没有返回可展示图片/)
  assert.equal(result.artifact.imageStatus, 'failed')
})
