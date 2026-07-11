import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAgentContext } from './agent-context-builder.js'
import { buildAgentProposal } from './agent-proposal-service.js'

test('explicit reanalysis action is preserved for agent context', () => {
  const context = buildAgentContext({
    action: 'reanalysis',
    scopeId: 'analysis',
    message: { role: 'user', content: '请重新给方案' },
    run: {
      id: 'run-1',
      workflowName: '测试项目',
      input: '测试需求',
      documentAnalysis: {
        canvas: {
          nodes: [
            { id: 'analysis', title: '文档分析结果', summary: '原结论', content: ['原内容'] }
          ],
          edges: []
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: { id: 'analysis', title: '文档分析结果', summary: '原结论', content: ['原内容'] }
    }
  })

  assert.equal(context.actionType, 'reanalysis')
  assert.match(context.userPrompt, /动作类型：reanalysis/)
})

test('total flow stage and requirement slice are included in agent context', () => {
  const context = buildAgentContext({
    action: 'canvas-action-advice',
    scopeId: 'menu-page',
    message: { role: 'user', content: '补充这个页面的异常状态' },
    run: {
      id: 'run-total-flow',
      workflowId: 'total-design-flow',
      workflowName: '茶饮点单',
      input: '做一个茶饮点单小程序',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'interaction-lofi',
          activeSliceId: 'tea-ordering-main-flow',
          stages: [
            { id: 'requirement-dissection', name: '需求解剖' },
            { id: 'interaction-lofi', name: '交互低保' }
          ],
          requirementSlices: [
            { id: 'tea-ordering-main-flow', title: '茶饮点单主流程', goal: '完成选店到取餐通知' }
          ],
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                { id: 'home-page', stageId: 'interaction-lofi', title: '首页与选店', summary: '选择门店' },
                { id: 'menu-page', stageId: 'interaction-lofi', title: '菜单与商品', summary: '浏览商品并加入购物车', content: ['展示分类、商品、售罄状态'] }
              ],
              edges: [{ id: 'home-menu', from: 'home-page', to: 'menu-page', label: '进入菜单' }],
              orderedTabs: [
                { key: 'home-page', label: '首页与选店' },
                { key: 'menu-page', label: '菜单与商品' }
              ]
            }
          }
        },
        canvas: {
          nodes: [
            { id: 'legacy-node', title: '旧画布节点', summary: '不应优先使用' }
          ],
          edges: []
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: { id: 'menu-page' },
      canvasAction: { actionLabel: '补异常状态', nodeId: 'menu-page' }
    }
  })

  assert.equal(context.currentNode.title, '菜单与商品')
  assert.equal(context.totalFlow.currentStage.name, '交互低保')
  assert.equal(context.totalFlow.activeSlice.title, '茶饮点单主流程')
  assert.match(context.userPrompt, /当前总流程阶段：交互低保/)
  assert.match(context.userPrompt, /当前小需求：茶饮点单主流程/)
  assert.match(context.userPrompt, /阶段画布节点/)
  assert.match(context.userPrompt, /菜单与商品/)
  assert.doesNotMatch(context.userPrompt, /旧画布节点/)
})

test('workflow agent prompt asks for complete readable content instead of short replies', () => {
  const context = buildAgentContext({
    action: 'canvas-action-advice',
    scopeId: 'menu-page',
    message: { role: 'user', content: '补交互细节' },
    run: {
      id: 'run-complete-agent-content',
      workflowId: 'total-design-flow',
      workflowName: '茶饮点单',
      input: '做一个茶饮点单小程序',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'interaction-lofi',
          stages: [{ id: 'interaction-lofi', name: '交互低保' }],
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                { id: 'menu-page', stageId: 'interaction-lofi', title: '菜单与商品', summary: '浏览商品并加入购物车' }
              ],
              edges: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: { id: 'menu-page', title: '菜单与商品', stageId: 'interaction-lofi' },
      canvasAction: { actionLabel: '补交互细节', nodeId: 'menu-page' }
    }
  })

  assert.match(context.systemPrompt, /content 是给用户看的完整回复/)
  assert.match(context.systemPrompt, /不要只给一句结论/)
  assert.doesNotMatch(context.systemPrompt, /content 是给用户看的短回复/)
})

test('agent context separates workflow shell from the active business project', () => {
  const context = buildAgentContext({
    scopeId: 'requirement-dissection-agent',
    message: { role: 'user', content: '我想在首页增加几个快捷输入提示词' },
    run: {
      id: 'run-project-context',
      projectId: 'project-podcast',
      workflowName: '流程通',
      input: '我想在首页增加一个功能，增加几个快捷输入提示词的功能',
      documentAnalysis: {
        project: { id: 'project-podcast', name: 'jogg- podcast' },
        totalDesignFlow: {
          currentStage: 'requirement-dissection',
          stages: [{ id: 'requirement-dissection', name: '需求分析' }],
          stageCanvases: {
            'requirement-dissection': {
              nodes: [
                { id: 'requirement-dissection-agent', title: '需求分析', summary: '确认原始需求与缺口' }
              ],
              edges: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      project: { id: 'project-podcast', name: 'jogg- podcast' },
      activeNode: {
        id: 'requirement-dissection-agent',
        title: '需求分析',
        stageId: 'requirement-dissection',
        summary: '确认原始需求与缺口'
      }
    },
    retrievedKnowledge: [
      {
        title: 'Podcastor.ai 首页创作入口',
        snippet: '首页 Step 1 提供 Generate Script 快捷提示词 Chips。',
        projectId: 'project-podcast',
        projectName: 'jogg- podcast'
      }
    ]
  })

  assert.match(context.systemPrompt, /流程通只是工作台名称，不是当前业务项目名/)
  assert.match(context.userPrompt, /当前业务项目：jogg- podcast/)
  assert.match(context.userPrompt, /项目知识所属项目：jogg- podcast/)
  assert.doesNotMatch(context.userPrompt, /项目\/需求：流程通/)
  assert.doesNotMatch(context.systemPrompt, /茶饮点单小程序上下文/)
})

test('stage agent prompts page layout artifact contract without brand-style wording', () => {
  const context = buildAgentContext({
    scopeId: 'requirement-dissection',
    message: { role: 'user', content: '把茶饮点餐页输出成更详细的页面骨架和交互布局' },
    run: {
      id: 'run-layout-artifact',
      workflowName: '茶饮点单',
      input: '做一个茶饮点单小程序',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'interaction-lofi',
          activeSliceId: 'tea-ordering',
          stages: [{ id: 'interaction-lofi', name: '交互低保' }],
          requirementSlices: [{ id: 'tea-ordering', title: '点餐主流程', goal: '完成浏览、加购、结算' }],
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                { id: 'requirement-dissection', stageId: 'interaction-lofi', title: '交互低保', summary: '补齐页面骨架' }
              ],
              edges: [],
              orderedTabs: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: { id: 'requirement-dissection', title: '交互低保', summary: '补齐页面骨架' }
    }
  })

  assert.match(context.systemPrompt, /page-layout-artifact/)
  assert.match(context.systemPrompt, /模型推荐方案/)
  assert.match(context.systemPrompt, /ASCII 页面线框图/)
  assert.match(context.systemPrompt, /模块交互明细/)
  assert.match(context.systemPrompt, /前后端交付/)
  assert.match(context.systemPrompt, /瀑布流|卡片流|信息流|左右分栏/)
  assert.match(context.systemPrompt, /quickReplies/)
  assert.match(context.systemPrompt, /大模型推荐按钮/)
  const removedBrandPattern = new RegExp(['豆', '包'].join('') + '|Dou' + 'bao|dou' + 'bao')
  assert.doesNotMatch(`${context.systemPrompt}\n${context.userPrompt}`, removedBrandPattern)
})

test('layout plan action allows different tones while preserving functional outline', () => {
  const context = buildAgentContext({
    action: 'canvas-action-advice',
    scopeId: 'menu-page',
    message: { role: 'user', content: '给布局方案' },
    run: {
      id: 'run-layout-plan-tone',
      workflowName: '茶饮点单',
      input: '做一个茶饮点单小程序',
      documentAnalysis: {
        totalDesignFlow: {
          currentStage: 'interaction-lofi',
          stages: [{ id: 'interaction-lofi', name: '交互低保' }],
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                { id: 'menu-page', stageId: 'interaction-lofi', title: '点单首页', summary: '门店、搜索、切换、分类商品和购物车' }
              ],
              edges: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      activeNode: { id: 'menu-page', title: '点单首页', stageId: 'interaction-lofi' },
      canvasAction: { actionLabel: '给布局方案', actionIntent: 'page-layout-plan', nodeId: 'menu-page' }
    }
  })

  assert.match(context.userPrompt, /layoutStyle/)
  assert.match(context.userPrompt, /设计调性/)
  assert.match(context.userPrompt, /保留当前页面同一套功能大纲/)
  assert.match(context.userPrompt, /轻量入口型|运营推荐型|效率任务型|科技感/)
  assert.doesNotMatch(context.userPrompt, /只改变布局组织方式/)
})

test('competitor reference canvas action preserves evidence boundaries', () => {
  const context = buildAgentContext({
    action: 'canvas-action-advice',
    scopeId: 'requirement-competitive-reference',
    message: { role: 'user', content: '请处理画布动作：让 Agent 找 3 个竞品' },
    run: {
      id: 'run-competitor-reference',
      workflowId: 'total-design-flow',
      workflowName: '流程通',
      input: '我想在首页增加一个功能，增加几个快捷输入提示词的功能',
      projectId: 'project-podcast',
      documentAnalysis: {
        project: { id: 'project-podcast', name: 'jogg- podcast' },
        totalDesignFlow: {
          currentStage: 'requirement-dissection',
          stages: [{ id: 'requirement-dissection', name: '需求分析' }],
          stageCanvases: {
            'requirement-dissection': {
              nodes: [
                {
                  id: 'requirement-competitive-reference',
                  stageId: 'requirement-dissection',
                  title: '竞品参考',
                  summary: '未提供具体竞品，先按行业常识形成可推翻参考。',
                  content: [
                    '证据状态：未识别到明确竞品名称、链接或截图。',
                    '对比维度：首屏入口、快捷开始/模板入口、状态反馈'
                  ]
                }
              ],
              edges: []
            }
          }
        }
      },
      agentSessions: {}
    },
    context: {
      project: { id: 'project-podcast', name: 'jogg- podcast' },
      activeNode: { id: 'requirement-competitive-reference', title: '竞品参考', stageId: 'requirement-dissection' },
      canvasAction: {
        actionLabel: '让 Agent 找 3 个竞品',
        actionIntent: 'competitor-reference-enrichment',
        nodeId: 'requirement-competitive-reference'
      }
    }
  })

  assert.equal(context.canvasAction.actionIntent, 'competitor-reference-enrichment')
  assert.match(context.userPrompt, /动作意图：competitor-reference-enrichment/)
  assert.match(context.userPrompt, /不要编造真实竞品名称、价格、研究结论或市场事实/)
  assert.match(context.userPrompt, /当前业务项目：jogg- podcast/)
  assert.doesNotMatch(context.userPrompt, /项目：流程通/)

  const proposal = buildAgentProposal({
    assistantMessage: { content: '先补齐证据状态，再按项目首页提示词入口找可参考方向。' }
  }, context)
  assert.equal(proposal.actionIntent, 'competitor-reference-enrichment')
  assert.match(proposal.writeableContent.summary, /竞品参考证据边界/)
  assert.ok(proposal.writeableContent.items.some((item) => /不编造真实竞品名称/.test(item)))
  assert.ok(proposal.writeableContent.acceptanceCriteria.some((item) => /事实证据和模型假设/.test(item)))
})
