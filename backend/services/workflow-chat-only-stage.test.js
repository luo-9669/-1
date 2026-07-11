import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWorkflowStageConfirmationSummary,
  isWorkflowChatOnlyStageScope
} from '../../frontend/src/services/workflowWorkbench.js'
import { buildAgentContext } from './agent-context-builder.js'

test('chat-only stage scope helper matches the requirement dissection total flow stage', () => {
  assert.equal(isWorkflowChatOnlyStageScope('requirement-dissection'), true)
  assert.equal(isWorkflowChatOnlyStageScope('requirement-slicing'), true)
  assert.equal(isWorkflowChatOnlyStageScope('gap-confirmation'), true)
  assert.equal(isWorkflowChatOnlyStageScope('requirement-dissection-agent'), true)
  assert.equal(isWorkflowChatOnlyStageScope('interaction-lowfi'), false)
})

test('stage confirmation summary prefers latest assistant conclusion and preserves default-assumption framing', () => {
  const summary = buildWorkflowStageConfirmationSummary({
    action: '使用默认假设继续',
    defaultAssumption: true,
    fallback: '需求解剖已确认',
    messages: [
      { role: 'user', content: '还有权限边界没定' },
      { role: 'assistant', content: '建议先按 B 端管理员单角色推进，一期先不做细粒度权限，并把该假设标为风险。' }
    ]
  })

  assert.match(summary, /一期先不做细粒度权限/)
  assert.match(summary, /默认假设|风险/)
})

test('agent context injects stage confirmation summaries for downstream stages', () => {
  const context = buildAgentContext({
    scopeId: 'interaction-lowfi',
    run: {
      input: '做一个茶饮点单小程序',
      workflowName: '茶饮点单',
      model: 'gpt-5.5',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'interaction-lowfi',
          stageConfirmations: {
            'requirement-dissection': {
              stageName: '需求解剖',
              summary: '已确认目标用户是一线门店顾客，支付方式先只做微信支付。'
            },
            'interaction-lofi': {
              stageName: '交互低保',
              summary: '默认假设继续：一期先不做会员积分，标记为后续风险。'
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: {
        id: 'interaction-lowfi',
        title: '交互低保',
        summary: '输出页面级交互低保'
      }
    },
    message: { role: 'user', content: '继续' }
  })

  assert.match(context.userPrompt, /阶段确认：需求解剖/)
  assert.match(context.userPrompt, /微信支付/)
  assert.match(context.userPrompt, /默认假设继续/)
})

test('chat-only stage agent prompt asks for product-level expanded answers', () => {
  const context = buildAgentContext({
    scopeId: 'requirement-dissection-agent',
    run: {
      input: '做一个茶饮点单小程序',
      workflowName: '茶饮点单',
      model: 'gpt-5.5',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'requirement-dissection',
          stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
          stageCanvases: {
            'requirement-dissection': {
              agentNode: {
                id: 'requirement-dissection-agent',
                title: '需求解剖',
                stageId: 'requirement-dissection',
                summary: '确认原始需求与缺口'
              },
              nodes: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: {
        id: 'requirement-dissection-agent',
        title: '需求解剖',
        stageId: 'requirement-dissection',
        summary: '确认原始需求与缺口'
      }
    },
    message: { role: 'user', content: '做一个茶饮小程序怎么做' }
  })

  assert.match(context.systemPrompt, /不要只给一句结论/)
  assert.match(context.systemPrompt, /中文 Markdown 长文/)
  assert.match(context.systemPrompt, /不要固定死模板/)
  assert.match(context.systemPrompt, /1200-2500 字/)
  assert.match(context.systemPrompt, /产品定位与目标/)
  assert.match(context.systemPrompt, /信息架构/)
  assert.match(context.systemPrompt, /核心流程/)
  assert.match(context.systemPrompt, /至少覆盖/)
  assert.match(context.systemPrompt, /核心闭环/)
  assert.match(context.systemPrompt, /quickReplies/)
  assert.match(context.systemPrompt, /content/)
  assert.match(context.systemPrompt, /最多 3 个/)
  assert.match(context.userPrompt, /阶段输出重点/)
})

test('bare total-flow stage scope also uses chat-only stage agent context', () => {
  const context = buildAgentContext({
    scopeId: 'requirement-dissection',
    run: {
      input: '做一个茶饮点单小程序',
      workflowName: '茶饮点单',
      model: 'gpt-5.5',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'requirement-dissection',
          stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
          stageCanvases: {
            'requirement-dissection': {
              agentNode: {
                id: 'requirement-dissection-agent',
                title: '需求解剖',
                stageId: 'requirement-dissection',
                summary: '确认原始需求与缺口'
              },
              nodes: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: null
    },
    message: { role: 'user', content: '继续分析' }
  })

  assert.equal(context.mode, 'dialogue-chat')
  assert.equal(context.actionType, 'stage-agent-chat')
  assert.equal(context.scopeId, 'requirement-dissection')
  assert.equal(context.node.id, 'requirement-dissection')
  assert.match(context.systemPrompt, /不要只给一句结论/)
})

test('pre-analysis stage context injects guidance for restored runs without references', () => {
  const context = buildAgentContext({
    scopeId: 'gap-confirmation',
    run: {
      input: '做一个茶饮点单小程序',
      workflowName: '茶饮点单',
      demandScope: 'non-project',
      model: 'gpt-5.5',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'gap-confirmation',
          stages: [{ id: 'gap-confirmation', name: '缺口确认' }],
          requirementDissectionArtifact: {}
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: {
        id: 'gap-confirmation',
        title: '缺口确认',
        stageId: 'gap-confirmation'
      }
    },
    message: { role: 'user', content: '继续确认缺口' }
  })

  assert.equal(context.analysisGuidance.version, 'requirement-dissection-guidance/v1')
  assert.equal(context.references.length, 0)
  assert.match(context.userPrompt, /docs\/skills\/requirement-dissection-guidance\/SKILL\.md/)
})

test('chat-only stage prompt keeps expanding when user input is conversational noise', () => {
  const context = buildAgentContext({
    scopeId: 'requirement-dissection-agent',
    run: {
      input: '做一个茶饮点单小程序',
      workflowName: '茶饮点单',
      model: 'gpt-5.5',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'requirement-dissection',
          stages: [{ id: 'requirement-dissection', name: '需求解剖' }],
          stageCanvases: {
            'requirement-dissection': {
              agentNode: {
                id: 'requirement-dissection-agent',
                title: '需求解剖',
                stageId: 'requirement-dissection',
                summary: '确认原始需求与缺口'
              },
              nodes: []
            }
          }
        }
      },
      agentSessions: {
        'requirement-dissection-agent': [
          { role: 'user', content: '做一个茶饮点单小程序' },
          { role: 'assistant', content: '建议按选店、点单、购物车、支付、取餐、查订单展开。' }
        ]
      }
    },
    context: {
      activeNode: {
        id: 'requirement-dissection-agent',
        title: '需求解剖',
        stageId: 'requirement-dissection',
        summary: '确认原始需求与缺口'
      }
    },
    message: { role: 'user', content: '啊的情况我都快起哦的' }
  })

  assert.match(context.systemPrompt, /口语化|吐槽|无意义/)
  assert.match(context.systemPrompt, /不要只判定/)
  assert.match(context.systemPrompt, /继续展开/)
  assert.match(context.userPrompt, /茶饮点单小程序/)
  assert.match(context.userPrompt, /选店、点单、购物车/)
})
