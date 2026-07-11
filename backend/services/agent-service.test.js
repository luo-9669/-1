import assert from 'node:assert/strict'
import test from 'node:test'

import { generateAgentReply } from './agent-service.js'

test('agent reply reports provider failure instead of deterministic fallback on timeout', async () => {
  const provider = {
    name: 'slow-provider',
    generate() {
      return new Promise(() => {})
    }
  }

  const reply = await generateAgentReply({
    model: 'slow-model',
    message: { role: 'user', content: '卖绿茶的商城主要是线下转线上' },
    scopeId: 'requirement-clarification',
    step: { id: 'requirement-clarification', title: '需求澄清' },
    run: { agentSessions: {} },
    now: '2026-06-26T00:00:00.000Z'
  }, provider, {
    timeoutMs: 10
  })

  assert.equal(reply.assistantMessage.role, 'assistant')
  assert.equal(reply.assistantMessage.content, '生成失败，请重试。')
  assert.equal(reply.provider, 'slow-provider')
  assert.equal(reply.error.code, 'LLM_PROVIDER_TIMEOUT')
  assert.equal(reply.error.provider, 'slow-provider')
  assert.equal(reply.assistantMessage.meta.status, 'failed')
})

test('dialogue skill sends a plain chat prompt without structured workflow instructions', async () => {
  let capturedContext = null
  const provider = {
    name: 'plain-chat-provider',
    async generate(context) {
      capturedContext = context
      return {
        content: '可以，我先按普通对话分析这个商城小程序。',
        provider: 'plain-chat-provider',
        model: context.model,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      }
    }
  }

  const reply = await generateAgentReply({
    model: 'gpt-5.5',
    message: { role: 'user', content: '做一个商城小程序，主要卖包的' },
    scopeId: 'dialogue-agent',
    step: { id: 'dialogue-agent', title: '纯模型对话' },
    run: {
      skillId: 'dialogue-skill',
      input: '做一个商城小程序',
      agentSessions: {
        'dialogue-agent': [
          { role: 'assistant', content: '已进入对话 Skill。' },
          { role: 'user', content: '做一个商城小程序' }
        ]
      }
    },
    now: '2026-06-26T00:00:00.000Z'
  }, provider)

  assert.equal(capturedContext.mode, 'dialogue-chat')
  assert.equal(capturedContext.actionType, 'dialogue-chat')
  assert.match(capturedContext.userPrompt, /用户：做一个商城小程序，主要卖包的/)
  assert.doesNotMatch(capturedContext.systemPrompt, /JSON|proposal|画布节点|可写入提案/)
  assert.equal(reply.assistantMessage.content, '可以，我先按普通对话分析这个商城小程序。')
  assert.equal(reply.proposal, null)
  assert.equal(reply.assistantMessage.meta.proposalId, undefined)
})

test('requirement dissection agent receives analysis guidance without polluting evidence pack', async () => {
  let capturedContext = null
  const provider = {
    name: 'requirement-guidance-provider',
    async generate(context) {
      capturedContext = context
      return {
        content: '我会按需求分析规则继续拆解页面覆盖、决策点和待确认问题。',
        provider: 'requirement-guidance-provider',
        model: context.model,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      }
    }
  }

  const reply = await generateAgentReply({
    model: 'gpt-5.5',
    message: { role: 'user', content: '继续分析这个需求' },
    scopeId: 'requirement-dissection-agent',
    step: { id: 'requirement-dissection-agent', title: '需求分析' },
    run: {
      workflowId: 'total-design-flow',
      skillId: 'total-design-flow',
      demandScope: 'non-project',
      input: '做一个茶饮点单小程序',
      documentAnalysis: {
        demandScope: 'non-project',
        totalDesignFlow: {
          currentStage: 'requirement-dissection',
          requirementDissectionArtifact: {
            analysisGuidance: {
              version: 'requirement-dissection-guidance/v1',
              hardConstraints: [{ id: 'frontend-backend-handoff', title: 'Frontend Backend Handoff', path: 'docs/product-contracts/frontend-backend-handoff.md', summary: 'Backend owns artifacts.', sourceType: 'product-contract' }],
              methodGuides: [{ id: 'requirement-dissection-guidance', title: 'Requirement Dissection Guidance', path: 'docs/skills/requirement-dissection-guidance/SKILL.md', summary: 'Analyze facts assumptions and gaps.', sourceType: 'skill' }],
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
      agentSessions: { 'requirement-dissection-agent': [] }
    },
    references: [
      { id: 'user-input', name: '用户输入', kind: 'document', text: '做一个茶饮点单小程序' }
    ],
    now: '2026-07-08T00:00:00.000Z'
  }, provider)

  assert.equal(capturedContext.analysisGuidance.version, 'requirement-dissection-guidance/v1')
  assert.match(capturedContext.userPrompt, /需求模式：非项目需求/)
  assert.match(capturedContext.userPrompt, /分析规则来源/)
  assert.match(capturedContext.userPrompt, /docs\/product-contracts\/frontend-backend-handoff\.md/)
  assert.doesNotMatch(
    JSON.stringify(reply.assistantMessage.meta.evidencePack.sources),
    /product-contracts|docs\/skills|superpowers\/specs/
  )
  assert.doesNotMatch(
    JSON.stringify(reply.assistantMessage.meta.evidencePack.facts),
    /product-contracts|docs\/skills|superpowers\/specs/
  )
})

test('agent reply normalizes json wrapped model text before saving assistant content', async () => {
  const provider = {
    name: 'json-wrapper-provider',
    async generate(context) {
      return {
        content: JSON.stringify({ reply: '这是应该直接展示给用户的正文。', type: 'canvas_action', action: 'continue' }),
        provider: 'json-wrapper-provider',
        model: context.model,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      }
    }
  }

  const reply = await generateAgentReply({
    model: 'gpt-5.5',
    message: { role: 'user', content: '继续' },
    scopeId: 'requirement-clarification',
    step: { id: 'requirement-clarification', title: '需求澄清' },
    run: { skillId: 'ux-design-confirmation-skill', agentSessions: {} },
    now: '2026-06-26T00:00:00.000Z'
  }, provider)

  assert.equal(reply.assistantMessage.content, '这是应该直接展示给用户的正文。')
})

test('agent reply attaches context data lookup and evidence pack metadata', async () => {
  const provider = {
    name: 'evidence-provider',
    async generate(context) {
      return {
        content: JSON.stringify({
          content: '建议补齐菜单页的空状态、售罄状态和接口错误恢复。',
          quickReplies: ['补接口契约'],
          proposal: {
            title: '菜单页异常状态补齐',
            summary: '补齐商品列表为空、售罄、接口失败三类状态。',
            rationale: ['当前节点已经包含商品分类和加入购物车，需要覆盖异常路径。'],
            contextSources: [
              {
                type: 'current-node',
                title: context.node.title,
                snippet: context.node.summary,
                matchReason: '当前用户正在要求补异常状态'
              }
            ],
            writeableContent: {
              summary: '菜单页增加空状态、售罄标签和重试入口。',
              items: ['空状态提示', '售罄不可加购', '接口失败可重试'],
              acceptanceCriteria: ['商品接口失败时显示重试入口']
            }
          }
        }),
        provider: 'evidence-provider',
        model: context.model,
        usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
      }
    }
  }

  const reply = await generateAgentReply({
    model: 'gpt-5.5',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '补充这个页面的异常状态' },
    scopeId: 'menu-page',
    step: { id: 'menu-page', title: '菜单页' },
    run: {
      id: 'run-evidence-pack',
      workflowName: '会员点餐',
      input: '做一个会员点餐小程序',
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
      agentSessions: {
        'menu-page': [{ role: 'assistant', content: '上一轮已确认主流程。' }]
      }
    },
    references: [
      { id: 'ref-1', name: '接口说明', kind: 'document', text: '商品列表接口返回 empty、soldOut、networkError。' }
    ],
    retrievedKnowledge: [
      {
        title: '点餐异常状态规范',
        snippet: '菜单页必须覆盖空列表、售罄和接口错误恢复。',
        evidence: [{ title: '规范第 3 节', url: 'https://example.com/spec' }],
        projectId: 'project-order',
        projectName: '会员点餐'
      }
    ],
    context: {
      activeNode: { id: 'menu-page', title: '菜单页', stageId: 'interaction-lofi' },
      canvasAction: { actionLabel: '补异常状态', nodeId: 'menu-page' }
    },
    now: '2026-07-06T00:00:00.000Z'
  }, provider)

  assert.equal(reply.assistantMessage.meta.contextSummary.scopeId, 'menu-page')
  assert.equal(reply.assistantMessage.meta.contextSummary.nodeTitle, '菜单页')
  assert.equal(reply.assistantMessage.meta.contextSummary.currentStage, '交互低保')
  assert.equal(reply.assistantMessage.meta.contextSummary.activeSlice, '点餐主流程')
  assert.deepEqual(
    reply.assistantMessage.meta.dataLookups.map((item) => item.key),
    ['current-node', 'canvas-context', 'uploaded-references', 'retrieved-knowledge', 'conversation-history', 'pending-proposals']
  )
  assert.equal(reply.assistantMessage.meta.dataLookups.find((item) => item.key === 'retrieved-knowledge').status, 'done')
  assert.equal(reply.assistantMessage.meta.evidencePack.sources.length, 3)
  assert.match(reply.assistantMessage.meta.evidencePack.facts.join('\n'), /菜单页/)
  assert.match(reply.assistantMessage.meta.evidencePack.facts.join('\n'), /点餐异常状态规范/)
  assert.equal(reply.assistantMessage.meta.evidencePack.confidence, 'high')
  assert.equal(reply.assistantMessage.meta.answerEvaluation.status, 'passed')
  assert.equal(reply.assistantMessage.meta.answerEvaluation.score >= 80, true)
  assert.equal(reply.assistantMessage.meta.answerEvaluation.checks.some((item) => item.key === 'evidence-grounded' && item.status === 'passed'), true)
  assert.equal(reply.assistantMessage.meta.answerEvaluation.checks.some((item) => item.key === 'answered-question' && item.status === 'passed'), true)
  assert.equal(reply.assistantMessage.trace.find((item) => item.key === 'evidence').status, 'done')
  assert.match(reply.assistantMessage.trace.find((item) => item.key === 'evidence').summary, /证据包/)
})

test('agent reply marks weak evidence answers as needing review', async () => {
  const provider = {
    name: 'weak-evaluation-provider',
    async generate(context) {
      return {
        content: JSON.stringify({
          content: '可以继续推进，但当前资料不足，需要确认接口和页面状态。',
          quickReplies: ['补充资料']
        }),
        provider: 'weak-evaluation-provider',
        model: context.model,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      }
    }
  }

  const reply = await generateAgentReply({
    model: 'gpt-5.5',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '继续' },
    scopeId: 'empty-node',
    step: { id: 'empty-node', title: '空节点' },
    run: {
      id: 'run-weak-evaluation',
      workflowName: '未知需求',
      input: '',
      documentAnalysis: { canvas: { nodes: [], edges: [] } },
      agentSessions: {}
    },
    now: '2026-07-06T00:00:00.000Z'
  }, provider)

  assert.equal(reply.assistantMessage.meta.answerEvaluation.status, 'needs-review')
  assert.equal(reply.assistantMessage.meta.answerEvaluation.score < 80, true)
  assert.equal(reply.assistantMessage.meta.answerEvaluation.checks.some((item) => item.key === 'evidence-grounded' && item.status === 'warning'), true)
  assert.match(reply.assistantMessage.meta.answerEvaluation.warnings.join('\n'), /证据|依据/)
  assert.equal(reply.assistantMessage.meta.answerEvaluation.recommendedActions.some((item) => item.key === 'provide-evidence' && item.label === '补充依据'), true)
})

test('agent provider receives evidence pack grounding before generating an answer', async () => {
  let capturedContext = null
  const provider = {
    name: 'grounded-provider',
    async generate(context) {
      capturedContext = context
      return {
        content: JSON.stringify({
          content: '基于当前节点和接口说明，建议补齐错误恢复。',
          quickReplies: []
        }),
        provider: 'grounded-provider',
        model: context.model,
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }
      }
    }
  }

  await generateAgentReply({
    model: 'gpt-5.5',
    action: 'canvas-action-advice',
    message: { role: 'user', content: '补充错误恢复' },
    scopeId: 'api-contract',
    step: { id: 'api-contract', title: '接口契约' },
    run: {
      id: 'run-grounding',
      workflowName: '会员点餐',
      input: '做一个会员点餐小程序',
      documentAnalysis: {
        canvas: {
          nodes: [{ id: 'api-contract', title: '接口契约', summary: '商品接口和错误码', content: ['GET /products'] }],
          edges: []
        }
      },
      agentSessions: {}
    },
    references: [
      { id: 'ref-api', name: '接口说明', kind: 'document', text: 'GET /products 可能返回 NETWORK_ERROR。' }
    ],
    now: '2026-07-06T00:00:00.000Z'
  }, provider)

  assert.equal(capturedContext.evidencePack.sources.length, 2)
  assert.equal(capturedContext.contextSummary.scopeId, 'api-contract')
  assert.equal(capturedContext.availableDataTools.some((tool) => tool.key === 'current-node' && tool.inputSchema), true)
  assert.equal(capturedContext.availableDataTools.some((tool) => tool.key === 'retrieved-knowledge' && tool.permission === 'project-scope-only'), true)
  assert.equal(capturedContext.dataLookups.find((item) => item.key === 'uploaded-references').toolKey, 'uploaded-references')
  assert.equal(capturedContext.dataLookups.find((item) => item.key === 'uploaded-references').outputSchema.type, 'array')
  assert.match(capturedContext.systemPrompt, /只能基于证据包/)
  assert.match(capturedContext.userPrompt, /可用数据工具/)
  assert.match(capturedContext.userPrompt, /本轮证据包/)
  assert.match(capturedContext.userPrompt, /接口说明/)
})
