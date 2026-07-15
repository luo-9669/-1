import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { join } from 'node:path'
import {
  buildWorkflowAgentQuickReplies,
  buildWorkflowAgentSession,
  normalizeRequirementDissectionQuickReplies,
  normalizeWorkflowAgentReplyContent
} from '../frontend/src/services/workflowWorkbench.js'

const appVue = readFileSync(join(process.cwd(), 'frontend/src/App.vue'), 'utf8')
const drawerVue = readFileSync(join(process.cwd(), 'frontend/src/features/workflow/components/WorkflowAgentDrawer.vue'), 'utf8')
const canvasVue = readFileSync(join(process.cwd(), 'frontend/src/features/workflow/components/WorkflowCanvasPage.vue'), 'utf8')
const navigationSource = readFileSync(join(process.cwd(), 'frontend/src/services/navigation.js'), 'utf8')
const routeSource = readFileSync(join(process.cwd(), 'frontend/src/app/routes.js'), 'utf8')
const workbenchSource = readFileSync(join(process.cwd(), 'frontend/src/services/workflowWorkbench.js'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'frontend/src/styles.css'), 'utf8')
const runnerSource = readFileSync(join(process.cwd(), 'backend/services/workflow-runner.js'), 'utf8')
const totalDesignFlowSource = readFileSync(join(process.cwd(), 'backend/services/total-design-flow.js'), 'utf8')
const agentContextBuilderSource = readFileSync(join(process.cwd(), 'backend/services/agent-context-builder.js'), 'utf8')
const uploadsSource = readFileSync(join(process.cwd(), 'backend/routes/uploads.js'), 'utf8')

test('workflow agent message action buttons use native clickable buttons', () => {
  assert.match(
    drawerVue,
    /<button\s+v-if="canCopyMessage\(message\)"[\s\S]*?@click="copyMessage\(message\)"[\s\S]*?<\/button>/,
    'copy action should be a native button with a direct click handler'
  )
  assert.match(
    drawerVue,
    /<button\s+v-if="canRetryMessage\(message\)"[\s\S]*?@click="\$emit\('retry-message', message\)"[\s\S]*?<\/button>/,
    'retry action should be a native button with a direct click handler'
  )
  assert.doesNotMatch(
    drawerVue,
    /v-if="canRetryMessage\(message\)"[\s\S]{0,300}:disabled="sending"/,
    'retry should not be silently disabled by stale global sending state'
  )
})

test('workflow agent recommendation chips only stay on the latest actionable assistant reply', () => {
  assert.match(
    drawerVue,
    /const latestRecommendationMessageKey = computed\(\(\) =>[\s\S]*visibleMessages\.value[\s\S]*messageRole\(message\) !== 'assistant'[\s\S]*return messageKey\(message, index\)/,
    'Agent should derive the single latest assistant message allowed to show recommendation chips'
  )

  assert.match(
    drawerVue,
    /function visibleMessageRecommendations\(message\)[\s\S]*messageKey\(message, visibleMessages\.value\.indexOf\(message\)\) !== latestRecommendationMessageKey\.value[\s\S]*return \[\]/,
    'older assistant messages should stop showing recommendation chips after the user starts the next turn'
  )

  assert.match(
    drawerVue,
    /function shouldSuppressMessageRecommendations\(message = \{\}\)[\s\S]*stage-confirm-next[\s\S]*advanced-ux-stage-confirm-next/,
    'system stage-confirmation replies should not inherit stale recommendation chips'
  )
})

test('workflow agent hides old recommendations after the next turn starts', () => {
  assert.match(
    drawerVue,
    /const latestRecommendationMessageKey = computed\(\(\) =>[\s\S]*if \(messageRole\(message\) !== 'assistant'\) return ''[\s\S]*if \(isMessageBusy\(message\) \|\| isMessageFailed\(message\)\) return ''[\s\S]*if \(shouldSuppressMessageRecommendations\(message\)\) return ''[\s\S]*return messageKey\(message, index\)/,
    'once a user reply, busy reply, failed reply, or suppressed stage-confirmation reply starts the next turn, older assistant recommendation chips should not reappear'
  )
})

test('workflow stage confirmation messages do not show detached action icons', () => {
  assert.match(
    drawerVue,
    /function shouldSuppressMessageActions\(message = \{\}\)[\s\S]*stage-confirm-next[\s\S]*advanced-ux-stage-confirm-next/,
    'system stage-confirmation replies should suppress copy/retry/edit action icons'
  )

  assert.match(
    drawerVue,
    /function hasMessageActions\(message\)[\s\S]*if \(shouldSuppressMessageActions\(message\)\) return false[\s\S]*canCopyMessage\(message\)/,
    'message action visibility should check the stage-confirmation suppressor before ordinary actions'
  )
})

test('workflow stage confirmation text fallback suppresses actions and recommendations', () => {
  assert.match(
    drawerVue,
    /function isStageConfirmationSystemMessage\(message = \{\}\)[\s\S]*已确认[\s\S]*正在生成/s,
    'historical stage-confirmation replies without action metadata should still be recognized by their system text'
  )

  assert.match(
    drawerVue,
    /function shouldSuppressMessageRecommendations\(message = \{\}\)[\s\S]*return isStageConfirmationSystemMessage\(message\)/,
    'stage-confirmation fallback should also prevent stale recommendations'
  )

  assert.match(
    drawerVue,
    /function shouldSuppressMessageActions\(message = \{\}\)[\s\S]*return isStageConfirmationSystemMessage\(message\)/,
    'stage-confirmation fallback should hide copy and retry icons'
  )
})

test('workflow agent recommendations exclude passive pending-generation labels', () => {
  const replies = buildWorkflowAgentQuickReplies({
    skillId: 'advanced-ux-requirement-analysis',
    currentStepId: 'interaction-lofi',
    steps: [{ id: 'interaction-lofi', title: '交互低保' }]
  }, {
    scopeId: 'interaction-lofi',
    activeNode: {
      id: 'advanced-ux-interaction-lofi-generating',
      stageId: 'interaction-lofi',
      title: '交互低保',
      quickActions: ['等待生成', '生成完成后查看', '重生成本页']
    }
  })

  assert.equal(replies.includes('等待生成'), false)
  assert.equal(replies.includes('生成完成后查看'), false)
  assert.deepEqual(replies, ['重生成本页'])

  const session = buildWorkflowAgentSession({
    skillId: 'advanced-ux-requirement-analysis',
    currentStepId: 'interaction-lofi',
    steps: [{ id: 'interaction-lofi', title: '交互低保' }],
    agentQuickReplies: {
      'interaction-lofi': ['等待生成']
    }
  }, {
    scopeId: 'interaction-lofi',
    activeNode: {
      id: 'advanced-ux-interaction-lofi-generating',
      stageId: 'interaction-lofi',
      title: '交互低保'
    }
  })

  assert.deepEqual(session.quickReplies, [])
})

test('advanced UX agent keeps one visible conversation when opening downstream stages', () => {
  const session = buildWorkflowAgentSession({
    id: 'run-advanced-ux',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    agentSessions: {
      'requirement-dissection': [
        {
          id: 'stage-report',
          role: 'assistant',
          content: '高级 UX Markdown 文件已生成：高级UX需求分析.md',
          meta: { action: 'advanced-ux-markdown-report', status: 'success' }
        }
      ]
    }
  }, {
    scopeId: 'advanced-ux-page-p01',
    activeNode: {
      id: 'advanced-ux-page-p01',
      stageId: 'interaction-lofi',
      title: '创作首页',
      summary: '输入爆款链接并进入解析'
    },
    model: 'gpt-5.5'
  })

  assert.equal(session.messages.length, 1)
  assert.equal(session.messages[0].role, 'assistant')
  assert.match(session.messages[0].content, /高级 UX Markdown 文件已生成/)
  assert.equal(session.messages[0].meta.action, 'advanced-ux-markdown-report')
  assert.notEqual(session.messages[0].meta.action, 'stage-context-bridge')
})

test('advanced UX agent hides duplicate plain failure replies when markdown report exists', () => {
  const failureText = '高级 UX Markdown 未符合输出规范：HMW 问题至少需要 3 条；缺少低保真线框图 5 项禁止项'
  const session = buildWorkflowAgentSession({
    id: 'run-advanced-ux-failed',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    documentAnalysis: {
      advancedUxReport: {
        fileName: '高级UX需求分析-20260711-1100.md',
        markdown: '# 高级 UX 需求分析',
        status: 'quality_failed',
        importError: failureText
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          id: 'report-failed',
          role: 'assistant',
          content: failureText,
          meta: {
            action: 'advanced-ux-markdown-report',
            source: 'model',
            status: 'failed',
            fileName: '高级UX需求分析-20260711-1100.md',
            markdown: '# 高级 UX 需求分析'
          }
        },
        {
          id: 'plain-failed',
          role: 'assistant',
          content: failureText,
          meta: {
            action: 'workflow-analysis-result',
            source: 'model',
            status: 'failed'
          }
        }
      ]
    }
  }, {
    scopeId: 'requirement-dissection',
    model: 'gpt-5.5'
  })

  assert.equal(session.messages.length, 1)
  assert.equal(session.messages[0].meta.action, 'advanced-ux-markdown-report')
  assert.equal(session.messages[0].content, failureText)
})

test('advanced UX downstream agent timeline merges generated file cards without bridge-only messages', () => {
  const session = buildWorkflowAgentSession({
    id: 'run-advanced-ux-downstream',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    documentAnalysis: {
      advancedUxReport: {
        fileName: '高级UX需求分析.md',
        markdown: '# 高级 UX 需求分析',
        pageInteractionDocument: {
          fileName: 'AI爆款视频复刻工具-页面交互框架与说明.md',
          markdown: '# AI爆款视频复刻工具-页面交互框架与说明'
        }
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          id: 'legacy-stage-confirm-next',
          role: 'assistant',
          content: [
            ':::page-layout-artifact title="页面骨架"',
            '## 模型推荐方案',
            '普通总流程页面骨架',
            ':::'
          ].join('\n'),
          meta: { action: 'stage-confirm-next', status: 'success' }
        }
      ],
      'interaction-lofi': [
        {
          id: 'page-doc',
          role: 'assistant',
          content: '页面交互文档已生成：AI爆款视频复刻工具-页面交互框架与说明.md',
          meta: {
            action: 'advanced-ux-page-interaction-document',
            fileName: 'AI爆款视频复刻工具-页面交互框架与说明.md',
            markdown: '# AI爆款视频复刻工具-页面交互框架与说明',
            status: 'success'
          }
        }
      ]
    }
  }, {
    scopeId: 'advanced-ux-page-p01',
    activeNode: {
      id: 'advanced-ux-page-p01',
      stageId: 'interaction-lofi',
      title: '新建任务页',
      summary: '上传参考视频并创建解析任务'
    },
    model: 'gpt-5.5'
  })

  assert.equal(session.messages.length, 2)
  assert.equal(session.messages[0].meta.action, 'stage-confirm-next')
  assert.equal(session.messages[1].meta.action, 'advanced-ux-page-interaction-document')
  assert.match(session.messages[1].content, /页面交互文档已生成/)
  assert.match(session.messages[1].content, /AI爆款视频复刻工具-页面交互框架与说明\.md/)
  assert.ok(session.messages.every((message) => message.meta?.action !== 'stage-context-bridge'))
})

test('advanced UX stage confirmations synthesize visible user advance bubbles for restored history', () => {
  const session = buildWorkflowAgentSession({
    id: 'run-advanced-ux-confirm-history',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    documentAnalysis: {
      advancedUxReport: {
        fileName: '高级UX需求分析.md',
        markdown: '# 高级 UX 需求分析',
        pageInteractionDocument: {
          fileName: 'AI爆款视频复刻工具-页面交互框架与说明.md',
          markdown: '# AI爆款视频复刻工具-页面交互框架与说明'
        }
      }
    },
    agentSessions: {
      'interaction-lofi': [
        {
          id: 'legacy-user-confirm-ui',
          role: 'user',
          content: '请确认「交互低保」阶段结果，并基于当前阶段产出进入下一阶段「UI视觉」。',
          createdAt: '2026-07-12T06:47:21.461Z',
          meta: {
            action: 'stage-confirm-next',
            clientMessageId: 'confirm-ui-1',
            stageId: 'interaction-lofi',
            nextStageId: 'ui-visual'
          }
        },
        {
          id: 'legacy-confirm-ui',
          role: 'assistant',
          content: '已确认「交互低保」，正在生成「UI视觉」。',
          createdAt: '2026-07-12T06:47:21.462Z',
          meta: {
            action: 'advanced-ux-stage-confirm-next',
            clientMessageId: 'confirm-ui-1',
            stageId: 'interaction-lofi',
            nextStageId: 'ui-visual',
            status: 'success'
          }
        }
      ]
    }
  }, {
    scopeId: 'ui-visual',
    activeNode: {
      id: 'ui-advanced-ux-page-p01',
      stageId: 'ui-visual',
      title: '复刻首页 UI视觉'
    },
    model: 'gpt-5.5'
  })

  const userAdvance = session.messages.find((message) =>
    message.role === 'user' &&
    message.content === '进入下一阶段' &&
    message.meta?.clientMessageId === 'confirm-ui-1'
  )
  const assistantConfirm = session.messages.find((message) =>
    message.role === 'assistant' &&
    message.meta?.action === 'advanced-ux-stage-confirm-next' &&
    message.meta?.clientMessageId === 'confirm-ui-1'
  )

  assert.ok(userAdvance, 'restored advanced UX confirmation should have a visible user bubble')
  assert.ok(assistantConfirm, 'the original confirmation assistant message should remain visible')
  assert.ok(session.messages.indexOf(userAdvance) < session.messages.indexOf(assistantConfirm))
})

test('advanced UX downstream agent timeline ignores stale node-scoped generating chats', () => {
  const session = buildWorkflowAgentSession({
    id: 'run-advanced-ux-stale-node-scope',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    documentAnalysis: {
      advancedUxReport: {
        fileName: '高级UX需求分析.md',
        markdown: '# 高级 UX 需求分析',
        pageInteractionDocument: {
          fileName: 'AI爆款视频复刻工具-页面交互框架与说明.md',
          markdown: '# AI爆款视频复刻工具-页面交互框架与说明'
        }
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          id: 'stage-report',
          role: 'assistant',
          content: '高级 UX Markdown 文件已生成：高级UX需求分析.md',
          meta: { action: 'advanced-ux-markdown-report', status: 'success' }
        }
      ],
      'interaction-lofi': [
        {
          id: 'page-doc',
          role: 'assistant',
          content: '页面交互文档已生成：AI爆款视频复刻工具-页面交互框架与说明.md',
          meta: {
            action: 'advanced-ux-page-interaction-document',
            fileName: 'AI爆款视频复刻工具-页面交互框架与说明.md',
            markdown: '# AI爆款视频复刻工具-页面交互框架与说明',
            status: 'success'
          }
        }
      ],
      'advanced-ux-interaction-lofi-generating': [
        {
          id: 'stale-user-next',
          role: 'user',
          content: '进入下一阶段',
          meta: { action: 'send' }
        },
        {
          id: 'stale-layout-advice',
          role: 'assistant',
          content: '3 套候选框架\n\n布局方案对比',
          meta: { action: 'send' }
        }
      ]
    }
  }, {
    scopeId: 'advanced-ux-interaction-lofi-generating',
    activeNode: {
      id: 'advanced-ux-interaction-lofi-generating',
      stageId: 'interaction-lofi',
      title: '交互低保'
    },
    model: 'gpt-5.5'
  })

  assert.deepEqual(
    session.messages.map((message) => message.meta?.action),
    ['advanced-ux-markdown-report', 'advanced-ux-page-interaction-document']
  )
  assert.equal(session.messages.some((message) => /3 套候选框架|布局方案对比/.test(message.content || '')), false)
})

test('interaction page wireframes keep evidence structured but out of the default framework view', () => {
  assert.doesNotMatch(
    canvasVue,
    /class="canvas-node-evidence-strip"/,
    'canvas cards should not put evidence chips above the page wireframe preview'
  )
  assert.doesNotMatch(
    canvasVue,
    /class="canvas-page-evidence-strip"/,
    'fullscreen wireframes should keep the main view focused on layout instead of evidence cards'
  )
  assert.match(
    canvasVue,
    /function pageLayoutEvidenceRefs\(node = \{\}\)/,
    'evidence refs should remain available as backend-owned metadata for Agent or diagnostics'
  )
  assert.match(
    canvasVue,
    /pageLayoutArtifact\(node\)\.evidenceRefs/,
    'the frontend should still read evidenceRefs without rendering them in the primary framework'
  )
})

test('workflow agent user message actions are detached below the bubble and always visible', () => {
  assert.match(
    drawerVue,
    /<div class="agent-message-frame">[\s\S]*<div class="agent-message-body">[\s\S]*<\/div>[\s\S]*<\/div>[\s\S]*<div v-if="hasMessageActions\(message\)" class="agent-message-actions"/,
    'message actions should be outside the message bubble frame'
  )

  assert.match(
    drawerVue,
    /<button\s+v-if="canEditMessage\(message\)"[\s\S]*class="agent-message-icon-action"[\s\S]*aria-label="编辑"[\s\S]*<Pencil/,
    'edit should be a detached native icon action below the user message'
  )

  assert.doesNotMatch(
    drawerVue,
    /messageRole\(message\) === 'user' \? '你' : 'Agent'/,
    'message role labels should be hidden in the main conversation'
  )

  assert.match(
    stylesSource,
    /\.agent-message-actions[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
    'message actions should be visible by default'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer-embedded \.agent-user[\s\S]*background:\s*transparent;[\s\S]*padding:\s*0;/,
    'embedded user message should not have an extra outer gray wrapper'
  )

  assert.match(
    stylesSource,
    /\.agent-user \.agent-message-frame[\s\S]*background:\s*#eef3ff;[\s\S]*padding:\s*20px;/,
    'the inner user bubble can keep its blue fill and padding'
  )
})

test('workflow agent edit pauses generation and edits the message inline before resending', () => {
  assert.match(
    drawerVue,
    /<textarea\s+v-if="isEditingMessage\(message\)"[\s\S]*class="agent-message-edit-textarea"[\s\S]*:value="input"[\s\S]*@input="\$emit\('update-input', \$event\.target\.value\)"/,
    'editing a user message should turn the original message into an inline textarea'
  )

  assert.match(
    drawerVue,
    /<button\s+v-if="isEditingMessage\(message\)"[\s\S]*class="agent-message-edit-confirm"[\s\S]*@click="\$emit\('send'\)"[\s\S]*确认发送/,
    'inline editing should confirm by continuing the conversation'
  )

  assert.match(
    appVue,
    /async function editWorkflowAgentMessage\(message\)\s*\{\s*if \(workflowAgentSending\.value\) \{\s*await stopWorkflowAgentGeneration\(\)\s*await nextTick\(\)\s*\}/,
    'editing should stop the current generation before entering edit state'
  )
})

test('workflow agent retry stops stale generation before resending', () => {
  assert.match(
    appVue,
    /async function retryWorkflowAgentMessage\(message\)\s*\{\s*if \(workflowAgentSending\.value\) \{\s*await stopWorkflowAgentGeneration\(\)\s*await nextTick\(\)\s*\}/,
    'retry should clear stale sending state before sending again'
  )
})

test('chat-only workflow stages do not inject a summarize-and-next quick reply', () => {
  assert.match(
    workbenchSource,
    /const chatOnlyStageReplies\s*=\s*\[\]/,
    'chat-only stage quick replies should not inject summarize-and-next'
  )
  assert.doesNotMatch(workbenchSource, /isWorkflowChatOnlyStageScope\(scopeId\)\s*\?\s*\['总结并进入下一步'\]/)

  assert.match(
    drawerVue,
    /function visibleMessageRecommendations\(message\)[\s\S]*visibleQuickReplies\.value\.slice\(0,\s*3\)/,
    'assistant reply recommendations should reuse workflow quick replies'
  )

  assert.match(
    appVue,
    /if \(isWorkflowChatOnlyStageScope\(workflowAgentScopeId\(\)\) && content === '总结并进入下一步'\)[\s\S]*mode:\s*'stage-agent-confirm-next'/,
    'summarize-and-next quick reply should confirm the current chat-only stage and advance'
  )
})

test('requirement dissection agent uses model recommendations without fixed stage-advance replies', () => {
  const replies = buildWorkflowAgentQuickReplies({
    skillId: 'total-design-flow',
    currentStepId: 'requirement-dissection',
    steps: [{ id: 'requirement-dissection', title: '需求解剖' }]
  }, {
    scopeId: 'requirement-dissection-agent',
    activeNode: {
      id: 'requirement-dissection-agent',
      title: '需求解剖',
      quickActions: ['确认继续'],
      agentInteraction: {
        quickReplies: ['继续补充边界', '补齐异常状态', '确认页面范围']
      }
    }
  })

  assert.deepEqual(replies.slice(0, 3), ['继续补充边界', '补齐异常状态', '确认页面范围'])
  assert.equal(replies.includes('进入交互低保'), false)
  assert.equal(replies.includes('输出页面框架'), false)
  assert.equal(replies.includes('确认继续'), true)
})

test('requirement dissection does not reserve a fixed stage action when model recommendations overflow', () => {
  const replies = buildWorkflowAgentQuickReplies({
    skillId: 'total-design-flow',
    currentStepId: 'requirement-dissection',
    steps: [{ id: 'requirement-dissection', title: '需求解剖' }]
  }, {
    scopeId: 'requirement-dissection-agent',
    activeNode: {
      id: 'requirement-dissection-agent',
      title: '需求解剖',
      agentInteraction: {
        quickReplies: ['推荐1', '推荐2', '推荐3', '推荐4', '推荐5', '推荐6']
      }
    }
  })

  assert.equal(replies.length, 6)
  assert.equal(replies.includes('进入交互低保'), false)
  assert.equal(replies.includes('输出页面框架'), false)
  assert.deepEqual(replies.slice(0, 3), ['推荐1', '推荐2', '推荐3'])
})

test('workflow agent session removes persisted fixed requirement-stage replies instead of reordering them', () => {
  const session = buildWorkflowAgentSession({
    skillId: 'total-design-flow',
    currentStepId: 'requirement-dissection',
    steps: [{ id: 'requirement-dissection', title: '需求解剖' }],
    agentQuickReplies: {
      'requirement-dissection-agent': ['补充背景', '列出风险', '输出页面框架', '继续拆用户路径', '补齐异常状态']
    }
  }, {
    scopeId: 'requirement-dissection-agent',
    activeNode: {
      id: 'requirement-dissection-agent',
      title: '需求解剖',
      stageId: 'requirement-dissection'
    }
  })

  assert.deepEqual(session.quickReplies, ['继续拆用户路径', '补齐异常状态'])
  assert.equal(session.quickReplies.includes('进入交互低保'), false)
  assert.equal(session.quickReplies.includes('输出页面框架'), false)
})

test('requirement dissection agent nodes do not inject fixed frontend or backend quick actions', () => {
  const requirementAgentSource = totalDesignFlowSource.slice(
    totalDesignFlowSource.indexOf('function requirementDissectionAgentNode'),
    totalDesignFlowSource.indexOf('function pendingQuestions', totalDesignFlowSource.indexOf('function requirementDissectionAgentNode'))
  )
  const workbenchSource = appVue.slice(
    appVue.indexOf('function workflowAgentWorkbenchStageCanvas'),
    appVue.indexOf('function workflowCanvasForStage', appVue.indexOf('function workflowAgentWorkbenchStageCanvas'))
  )
  const canvasRequirementAgentSource = canvasVue.slice(
    canvasVue.indexOf('function buildRequirementDissectionAgentNode()'),
    canvasVue.indexOf('function workflowMessageText', canvasVue.indexOf('function buildRequirementDissectionAgentNode()'))
  )
  const canvasStageReplySource = canvasVue.slice(
    canvasVue.indexOf('const stageAgentQuickReplies = computed(() =>'),
    canvasVue.indexOf('function stageStatus', canvasVue.indexOf('const stageAgentQuickReplies = computed(() =>'))
  )

  assert.doesNotMatch(
    requirementAgentSource,
    /补充背景|列出风险|确认继续/,
    'backend requirement analysis Agent node should not inject fixed recommendation buttons'
  )
  assert.doesNotMatch(
    workbenchSource,
    /补充背景|列出待确认问题|确认继续/,
    'frontend workbench fallback should not inject fixed requirement analysis recommendation buttons'
  )
  assert.doesNotMatch(
    canvasRequirementAgentSource,
    /quickActions:\s*\[[^\]]*(?:补充背景|列出风险|确认继续)/,
    'requirement dissection canvas fallback node should not inject fixed recommendation buttons'
  )
  assert.doesNotMatch(
    canvasStageReplySource,
    /拆更细|合并切片|补充资料|使用默认假设继续/,
    'requirement dissection stage agent quick replies should not fall back to frontend-authored recommendation chips'
  )
})

test('backend agent reply persists model recommendations before frontend fallback replies', () => {
  const persistSource = runnerSource.slice(
    runnerSource.indexOf('function persistRunAgentReply'),
    runnerSource.indexOf('function retrievedKnowledgeMeta')
  )

  assert.match(persistSource, /const modelQuickReplies = normalizeAgentQuickReplies\(feedback\.quickReplies\)/)
  assert.match(persistSource, /const fallbackQuickReplies = normalizeAgentQuickReplies\(buildWorkflowAgentQuickReplies/)
  assert.match(
    persistSource,
    /const quickReplies = isRequirementDissectionAgentScope\(input\.stepId, activeNode, input\.step\)\s*\?\s*normalizeRequirementDissectionQuickReplies\(modelQuickReplies, 6\)\s*:\s*normalizeAgentQuickReplies\(mergedQuickReplies\)/,
    'backend should persist only model quick replies for requirement analysis stage replies'
  )
  assert.doesNotMatch(persistSource, /fixedFallbackReplies/)
})

test('workflow stage progression waits for requirement dissection page framework confirmation', () => {
  assert.match(
    canvasVue,
    /function isRequirementDissectionStageId\(stageId = ''\)/,
    'stage gating should centralize requirement-dissection detection'
  )

  assert.match(
    appVue,
    /function canAutoGenerateWorkflowStage\(stageId = ''\)[\s\S]*const previousStageId = stageIds\[targetIndex - 1\][\s\S]*workflowStageConfirmation\(previousStageId\)/,
    'stage auto-generation should be blocked until the immediately previous stage is confirmed'
  )

  assert.match(
    appVue,
    /if \(!canAutoGenerateWorkflowStage\(stageId\)\) return false/,
    'shouldAutoGenerateWorkflowStage should respect the requirement-dissection gate'
  )

  assert.match(
    appVue,
    /function canSelectWorkflowStage\(stageId = ''\)[\s\S]*const previousStageId = stageIds\[targetIndex - 1\][\s\S]*workflowStageConfirmation\(previousStageId\)/,
    'programmatic stage switching should only unlock the next stage after the immediately previous stage is confirmed'
  )

  assert.match(
    appVue,
    /if \(!stageId \|\| !canSelectWorkflowStage\(stageId\)\) return/,
    'selectWorkflowStage should not bypass the stage gate when called from code'
  )
})

test('requirement dissection page framework quick reply confirms and advances to next stage', () => {
  assert.match(
    appVue,
    /function isWorkflowLowFiStageAdvanceAction\(content = ''\)[\s\S]*输出页面框架[\s\S]*进入交互低保[\s\S]*页面框架/,
    'legacy 输出页面框架 and visible 进入交互低保 should both confirm requirement dissection'
  )

  assert.match(
    appVue,
    /if \(isWorkflowLowFiStageAdvanceAction\(action\) && isWorkflowAgentWorkbenchStageId\(workflowCurrentStageId\.value\)\)/,
    'page framework advance should not depend on the Agent display mode being embedded'
  )

  assert.match(
    appVue,
    /void confirmWorkflowStageWithAgentSummary\(\{[\s\S]*mode:\s*'stage-agent-confirm-next'[\s\S]*\}\)/,
    'the page framework action should use the shared stage-summary and pending-generation flow'
  )

  assert.match(
    appVue,
    /if \(isWorkflowLowFiStageAdvanceAction\(content\) && isWorkflowAgentWorkbenchStageId\(workflowCurrentStageId\.value\)\)[\s\S]*runWorkflowNodeQuickAction\(\{[\s\S]*mode:\s*'stage-agent-confirm-next'[\s\S]*\}\)[\s\S]*return[\s\S]*if \(isWorkflowAgentCanvasAdviceQuickReply\(content\)\)/,
    'page framework quick reply should advance the stage before generic canvas advice handling'
  )
})

test('typed requirement dissection low-fi advance input uses stage progression instead of generic chat', () => {
  const sendStart = appVue.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appVue.indexOf('const requestToken = createClientId()', sendStart)
  const earlySendSource = appVue.slice(sendStart, sendEnd)

  assert.match(
    earlySendSource,
    /isWorkflowLowFiStageAdvanceAction\(content\)[\s\S]*confirmWorkflowStageWithAgentSummary\(\{[\s\S]*mode:\s*'stage-agent-confirm-next'/,
    'typing 进入交互低保 in the composer should enter the shared stage-progression flow'
  )

  assert.match(
    earlySendSource,
    /confirmWorkflowStageWithAgentSummary\(\{[\s\S]*action:\s*content[\s\S]*stageId:\s*currentStageId[\s\S]*nextStageId:\s*nextStage\?\.id \|\| ''/,
    'manual stage advance input should use the current stage and next sequential stage'
  )
})

test('requirement dissection stage advance uses pending next-stage generation flow', () => {
  const quickActionBranch = appVue.slice(
    appVue.indexOf('if (isWorkflowLowFiStageAdvanceAction(action) && isWorkflowAgentWorkbenchStageId(workflowCurrentStageId.value))'),
    appVue.indexOf("if (['stage-agent-workbench', 'stage-agent-confirm-next', 'stage-canvas-confirm-next'].includes(payload?.mode))")
  )

  assert.match(
    quickActionBranch,
    /void confirmWorkflowStageWithAgentSummary\(\{[\s\S]*mode:\s*'stage-agent-confirm-next'/,
    'low-fi stage advance card actions should enter the same pending-generation flow as Agent recommendations'
  )
  assert.doesNotMatch(
    quickActionBranch,
    /selectWorkflowStageAndRefresh\(confirmedNextStageId,\s*\{\s*force:\s*true\s*\}\)/,
    'stage advance should not bypass the Agent-summary/pending-generation path with a forced refresh'
  )
})

test('stage confirmation persists the confirmed next stage as current stage', () => {
  const confirmationSource = appVue.slice(
    appVue.indexOf('function recordWorkflowStageConfirmation(payload = {})'),
    appVue.indexOf('function patchWorkflowCanvasNodeArtifactStatus')
  )

  assert.match(
    confirmationSource,
    /currentStage:\s*confirmedNextStageId \|\| stageId/,
    'confirming a stage should persist the next stage so refresh does not reopen the previous stage'
  )
})

test('workflow stages with real rendered canvas content stay selectable after refresh', () => {
  const canSelectSource = appVue.slice(
    appVue.indexOf("function canSelectWorkflowStage(stageId = '')"),
    appVue.indexOf("function canAutoGenerateWorkflowStage(stageId = '')")
  )
  const canOpenSource = canvasVue.slice(
    canvasVue.indexOf("function canOpenStage(stageId = '')"),
    canvasVue.indexOf('function layoutCanvasNodes')
  )

  assert.match(
    canSelectSource,
    /workflowStageCanvasHasRenderedContent\(workflowTotalDesignFlow\.value\?\.stageCanvases\?\.\[normalizedStageId\],\s*normalizedStageId\)/,
    'restored stages with backend-owned renderable canvas nodes should remain selectable even without a stage confirmation record'
  )
  assert.match(
    canOpenSource,
    /loadedStageIds\.value\.has\(stageId\)/,
    'stage chips should unlock from loadedStageIds, which filters out loading/model-pending placeholder nodes'
  )
})

test('workflow stage selectors ignore stale runtime locks for reached stages', () => {
  const canSelectSource = appVue.slice(
    appVue.indexOf("function canSelectWorkflowStage(stageId = '')"),
    appVue.indexOf("function canAutoGenerateWorkflowStage(stageId = '')")
  )
  const canOpenSource = canvasVue.slice(
    canvasVue.indexOf("function canOpenStage(stageId = '')"),
    canvasVue.indexOf('function layoutCanvasNodes')
  )

  assert.match(
    canSelectSource,
    /const currentIndex = workflowStageIndexById\(workflowCurrentStageId\.value\)[\s\S]*if \(currentIndex >= 0 && targetIndex <= currentIndex\) return true[\s\S]*const runtime = workflowStageRuntime\(normalizedStageId\)/,
    'outer stage selection should allow already reached stages before consulting stale persisted runtime locks'
  )
  assert.match(
    canOpenSource,
    /if \(stageId === activeStageId\.value\) return true[\s\S]*if \(index < activeStageIndex\.value\) return true[\s\S]*const runtime = stageRuntime\(stageId\)/,
    'canvas stage chips should allow active and previous reached stages before consulting stale persisted runtime locks'
  )
})

test('future generating workflow stages stay locked until previous stage is confirmed', () => {
  const canSelectSource = appVue.slice(
    appVue.indexOf("function canSelectWorkflowStage(stageId = '')"),
    appVue.indexOf("function canAutoGenerateWorkflowStage(stageId = '')")
  )
  const pendingAdvancedUxSource = appVue.slice(
    appVue.indexOf("function shouldUseAdvancedUxPendingStageCanvas(stageId = '', totalFlow = null)"),
    appVue.indexOf("function shouldResumeAdvancedUxPendingStageGeneration", appVue.indexOf("function shouldUseAdvancedUxPendingStageCanvas(stageId = '', totalFlow = null)"))
  )
  const loadedStageSource = canvasVue.slice(
    canvasVue.indexOf('const loadedStageIds = computed'),
    canvasVue.indexOf('const activeStageCanvas = computed')
  )
  const canOpenSource = canvasVue.slice(
    canvasVue.indexOf("function canOpenStage(stageId = '')"),
    canvasVue.indexOf('function layoutCanvasNodes')
  )

  assert.match(
    appVue,
    /function workflowStageHasConfirmedAccess\(stageId = '', totalFlow = workflowTotalDesignFlow\.value\)/,
    'App should centralize confirmed-stage access instead of trusting stale future generating statuses'
  )
  assert.match(
    canSelectSource,
    /\['generating', 'paused'\]\.includes\(targetStatus\) && workflowStageHasConfirmedAccess\(normalizedStageId\)/,
    'future generating or paused stages should only be selectable after the previous stage was confirmed'
  )
  assert.match(
    pendingAdvancedUxSource,
    /if \(!workflowStageHasConfirmedAccess\(stageId, totalFlow\)\) return false/,
    'Advanced UX pending downstream placeholders should not render before the user confirms the previous stage'
  )
  assert.match(
    loadedStageSource,
    /stageStatusCanOpen\(stageId,\s*status\?\.status\)/,
    'Canvas stage strip should not mark stale future generating statuses as loaded'
  )
  assert.match(
    canOpenSource,
    /\['generating', 'paused'\]\.includes\(stageStatus\(stageId\)\) && stageStatusCanOpen\(stageId,\s*stageStatus\(stageId\)\)/,
    'Canvas stage open guard should require confirmed access for future generating statuses'
  )
})

test('workflow canvas suppresses stale node generating state after stage completion', () => {
  const loadingSource = canvasVue.slice(
    canvasVue.indexOf("function isNodeActuallyLoading(node = {})"),
    canvasVue.indexOf("function canvasNodeSummary(node = {})")
  )

  assert.match(
    loadingSource,
    /const owningStageId = nodeWorkflowStageId\(node\)[\s\S]*if \(owningStageId && stageStatus\(owningStageId\) === 'completed' && isAdvancedUxGeneratingNode\(node\)\) return false/,
    'completed requirement-analysis stages should stop stale advanced-UX placeholders from spinning forever'
  )
})

test('requirement dissection stage advance aliases stay compatible but not visible as fixed recommendations', () => {
  assert.match(
    workbenchSource,
    /const REQUIREMENT_DISSECTION_LEGACY_STAGE_ADVANCE_REPLIES = \['输出页面框架', REQUIREMENT_DISSECTION_STAGE_ADVANCE_REPLY\]/,
    'legacy page-framework and old visible stage-advance wording should remain compatibility aliases'
  )

  assert.deepEqual(
    normalizeRequirementDissectionQuickReplies(['输出页面框架', '进入交互低保', '补充背景', '列出风险', '补齐页面边界']),
    ['补齐页面边界'],
    'persisted fixed requirement-stage quick replies should be removed before display'
  )
})

test('workflow agent project knowledge only applies to project-scoped runs', () => {
  assert.match(
    appVue,
    /function workflowAgentAllowsProjectKnowledge\(\)[\s\S]*const runScope = state\.activeWorkflowRun\?\.demandScope \|\| workflowForm\.demandScope[\s\S]*return runScope === 'project'/,
    'Agent project-knowledge retrieval should be gated by the current run demand scope'
  )

  assert.match(
    appVue,
    /function workflowAgentKnowledgeProjectId\(\) \{\s*if \(!workflowAgentAllowsProjectKnowledge\(\)\) return ''\s*return state\.activeWorkflowRun\?\.projectId \|\| ''\s*\}/,
    'non-project Agent runs should not inherit the URL/current project id for knowledge retrieval'
  )

  assert.match(
    appVue,
    /async function retrieveWorkflowKnowledge\(query = '', scopeId = ''\)[\s\S]*if \(!trimmed \|\| !workflowAgentAllowsProjectKnowledge\(\) \|\| !projectId\) return \{ items: \[\], error: null, skipped: !projectId \|\| !workflowAgentAllowsProjectKnowledge\(\) \}/,
    'non-project Agent runs should skip project knowledge retrieval before messages are sent to the backend'
  )
})

test('workflow analysis records use independent project and non-project tabs', () => {
  assert.match(
    appVue,
    /const workflowRecordScopeTab\s*=\s*ref\('project'\)/,
    'analysis record tabs should use their own state instead of reusing the new-analysis demand scope'
  )

  assert.match(
    appVue,
    /<div class="panel-head">[\s\S]*<h3>分析记录<\/h3>[\s\S]*<\/div>\s*<div class="workflow-record-scope-tabs">\s*<BaseSecondaryTabs[\s\S]*v-model="workflowRecordScopeTab"[\s\S]*:items="workflowRecordScopeTabItems"[\s\S]*label="分析记录类型"/,
    'analysis records should expose project/non-project secondary tabs below the record title'
  )

  assert.match(
    appVue,
    /function workflowRecordBelongsToSelectedScope\(run = \{\}\)[\s\S]*if \(workflowRecordScopeTab\.value === 'non-project'\) return run\?\.demandScope === 'non-project'[\s\S]*run\?\.demandScope !== 'non-project'[\s\S]*runProjectId === state\.currentProjectId/,
    'record filtering should keep non-project runs account-level and project runs scoped to the current project'
  )

  const recordsStart = appVue.indexOf('<section class="workflow-records-section">')
  const recordsEnd = appVue.indexOf('</section>', recordsStart)
  const recordsSource = appVue.slice(recordsStart, recordsEnd)
  assert.doesNotMatch(
    recordsSource,
    /v-model="workflowForm\.demandScope"/,
    'switching record tabs must not mutate the new-analysis project/non-project selector'
  )
})

test('workflow agent request context uses the active run project as business context', () => {
  assert.match(
    appVue,
    /function workflowProjectForRun\(run = state\.activeWorkflowRun \|\| \{\}\)[\s\S]*const runScope = run\.demandScope \|\| workflowForm\.demandScope[\s\S]*if \(runScope !== 'project'\) return null[\s\S]*const runProjectId = run\.projectId \|\| run\.originProjectId \|\| ''[\s\S]*state\.projects\.find\(\(project\) => project\.id === runProjectId\)/,
    'Agent requests should resolve business project from the active workflow run project id'
  )
  assert.match(
    appVue,
    /function workflowProjectForRun\(run = state\.activeWorkflowRun \|\| \{\}\)[\s\S]*const runProjectId = run\.projectId \|\| run\.originProjectId \|\| ''[\s\S]*if \(!runProjectId\) return null/,
    'Agent requests should not infer a business project from the current route when the run has no project id'
  )

  const contextSource = appVue.slice(
    appVue.indexOf('function workflowAgentRequestContext'),
    appVue.indexOf('function workflowAgentAllowsProjectKnowledge')
  )
  assert.match(
    contextSource,
    /const runProject = workflowProjectForRun\(state\.activeWorkflowRun \|\| \{\}\)/,
    'Agent context should not rely only on workflow form/current project state'
  )
  assert.match(
    contextSource,
    /project:\s*runProject\s*\|\|\s*\{\}/,
    'Agent context should pass the resolved business project to the backend'
  )
  assert.doesNotMatch(
    contextSource,
    /project:\s*workflowAnalysisProject\.value\s*\|\|\s*\{\}/,
    'Agent context must not send stale form-derived project data'
  )
})

test('workflow canvas restore uses the run demand scope before switching project context', () => {
  const openRunSource = appVue.slice(
    appVue.indexOf('function openWorkflowCanvasRun'),
    appVue.indexOf('function openDialogueSkillRecord')
  )

  assert.match(
    openRunSource,
    /const runProject = workflowProjectForRun\(finalizedRun\)/,
    'restored workflow runs should resolve project context from the run object, including its demandScope'
  )
  assert.match(
    openRunSource,
    /const runProjectId = runProject\?\.id \|\| ''/,
    'non-project restored runs should not inherit a project id from route or current UI state'
  )
  assert.doesNotMatch(
    openRunSource,
    /workflowProjectIdForRun\(finalizedRun\.id\)/,
    'restoring a run should not infer project context from runId lookup that can miss freshly loaded non-project runs'
  )
})

test('workflow agent renders backend page layout artifact metadata before loose text parsing', () => {
  assert.match(
    drawerVue,
    /function messagePageLayoutArtifact\(message = \{\}\)[\s\S]*const metaArtifact = message\?\.meta\?\.pageLayoutArtifact[\s\S]*if \(metaArtifact[\s\S]*return metaArtifact/,
    'Agent drawer should render backend-owned pageLayoutArtifact metadata from the assistant message'
  )
  assert.match(
    drawerVue,
    /const metaArtifactSegments = pageLayoutArtifactMetaSegments\(message\)[\s\S]*if \(metaArtifactSegments\.length\) \{[\s\S]*\.\.\.metaArtifactSegments[\s\S]*\.\.\.titledMarkdownSegment\('说明', text\)/,
    'metadata page layouts should be shown before explanatory text so Agent and canvas use the same artifact'
  )
})

test('workflow agent recovers missing page layout metadata from the active canvas node', () => {
  assert.match(
    drawerVue,
    /function messagePageLayoutArtifact\(message = \{\}\)[\s\S]*messageRole\(message\) !== 'assistant'[\s\S]*message\?\.meta\?\.pageLayoutArtifact[\s\S]*props\.activeNode\?\.pageLayoutArtifact/,
    'old assistant messages without metadata should recover the backend-owned artifact from the selected canvas node'
  )
  assert.match(
    drawerVue,
    /function pageLayoutArtifactMetaSegments\(message = \{\}\)[\s\S]*const artifact = messagePageLayoutArtifact\(message\)/,
    'page-layout rendering should use the normalized metadata-or-active-node artifact source'
  )
})

test('workflow agent keeps top entry but hides drawer medium and large modes', () => {
  const toolbarStart = canvasVue.indexOf('<div class="canvas-toolbar-actions">')
  const toolbarEnd = canvasVue.indexOf('<div class="workflow-canvas-stage-row"', toolbarStart)
  const toolbarSource = canvasVue.slice(toolbarStart, toolbarEnd)

  assert.match(
    toolbarSource,
    /@click="\$emit\('open-agent'/,
    'top toolbar should keep the Agent entry'
  )

  assert.match(
    toolbarSource,
    /<template #icon><Bot class="ui-icon"[\s\S]*Agent/,
    'top toolbar Agent entry should keep the bot icon and label'
  )

  assert.doesNotMatch(
    toolbarSource,
    /persist-knowledge|沉淀知识库|Database/,
    'top toolbar should not expose the global knowledge-deposit action'
  )

  assert.match(
    appVue,
    /:can-inline="false"/,
    'drawer should not expose the medium embedded mode switch'
  )

  assert.match(
    appVue,
    /:can-large-modes="false"/,
    'drawer should not expose the large fullscreen mode switch'
  )

  assert.match(
    appVue,
    /function workflowDefaultAgentDisplayMode\(\)[\s\S]*return 'sidebar'/,
    'opening the top Agent entry should default to the side Agent'
  )

  assert.match(
    appVue,
    /if \(\['inline', 'fullscreen'\]\.includes\(normalizedMode\) && !workflowAgentCanUseLargeModes\.value\) \{\s*workflowAgentDisplayMode\.value = 'sidebar'/,
    'inline/fullscreen requests should still be forced back to sidebar when large modes are not allowed'
  )

  assert.match(
    appVue,
    /watch\(\s*\(\) => workflowAgentCanUseLargeModes\.value[\s\S]*setWorkflowAgentDisplayMode\('sidebar'\)/,
    'stage changes should collapse an existing inline/fullscreen Agent back to sidebar when large modes are no longer allowed'
  )
})

test('workflow agent size modes share one shell and one logic pipeline', () => {
  const drawerMounts = appVue.match(/<WorkflowAgentDrawer/g) || []
  assert.equal(drawerMounts.length, 1, 'workflow should mount exactly one Agent drawer')

  const shellStart = appVue.indexOf('<WorkflowAgentDrawer')
  const shellEnd = appVue.indexOf('/>', shellStart)
  const shellSource = appVue.slice(shellStart, shellEnd)

  assert.match(shellSource, /:display-mode="workflowAgentDisplayMode"/)
  assert.match(shellSource, /:session="workflowAgentSession"/)
  assert.match(shellSource, /:quick-replies="workflowAgentQuickReplies"/)
  assert.match(shellSource, /:history-open="workflowAgentHistoryOpen"/)
  assert.match(shellSource, /@send="sendWorkflowAgentMessage"/)
  assert.match(shellSource, /@quick-reply="useWorkflowAgentQuickReply"/)
  assert.match(shellSource, /@retry-message="retryWorkflowAgentMessage"/)
  assert.match(shellSource, /@confirm-message="openWorkflowAgentConfirmPreview"/)
  assert.doesNotMatch(appVue, /SmallAgent|MediumAgent|LargeAgent|SmallAgentDrawer|MediumAgentDrawer|LargeAgentDrawer|StageAgentDrawer/)

  assert.match(
    drawerVue,
    /小\/中\/大 Agent 只能改变尺寸、位置和层级，不能分叉 session、发送、历史、推荐按钮、上传、重试、应用画布或下一步逻辑/,
    'code contract should state that Agent sizes are display-only variants'
  )
})

test('embedded workflow agent composer keeps compact 160px height', () => {
  assert.match(
    stylesSource,
    /\.agent-drawer-embedded \.agent-composer-shell[\s\S]*height:\s*160px;[\s\S]*max-height:\s*160px;/,
    'embedded Agent composer shell should keep the requested 160px total height'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer-embedded \.agent-composer-box[\s\S]*min-height:\s*0;[\s\S]*height:\s*100%;/,
    'embedded Agent composer box should fit inside the fixed 160px shell instead of stretching it'
  )
})

test('sidebar workflow agent composer stays inside the drawer bottom edge', () => {
  assert.match(
    stylesSource,
    /\.agent-drawer-sidebar \.agent-composer-shell[\s\S]*padding:\s*12px 16px 16px;[\s\S]*max-height:\s*min\(248px,\s*34vh\);[\s\S]*overflow:\s*visible;/,
    'sidebar Agent composer shell should keep the input controls within the visible drawer bottom edge'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer-sidebar \.agent-composer-box[\s\S]*min-height:\s*190px;[\s\S]*height:\s*auto;[\s\S]*max-height:\s*220px;[\s\S]*overflow:\s*visible;/,
    'sidebar Agent visible composer box should leave room for context reference, input, and bottom controls'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer-sidebar \.agent-composer-bottom-bar[\s\S]*min-height:\s*42px;/,
    'sidebar Agent bottom controls should reserve visible vertical space'
  )

  assert.match(
    stylesSource,
    /\.agent-composer-bottom-bar[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/,
    'composer bottom controls should stay on one aligned grid row instead of drifting under the input'
  )

  assert.match(
    stylesSource,
    /\.agent-composer-tools[\s\S]*flex-wrap:\s*nowrap;[\s\S]*overflow:\s*hidden;/,
    'composer tool controls should not wrap below the visible input box'
  )
})

test('requirement dissection uses the side agent while keeping a stable stage scope', () => {
  assert.match(
    canvasVue,
    /showStageAgentWorkbench:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/,
    'the stage Agent workbench should be hidden by default instead of rendering the medium Agent in the canvas'
  )

  assert.match(
    canvasVue,
    /const shouldRenderAgentWorkbench = computed\(\(\) =>\s*props\.showStageAgentWorkbench &&[\s\S]*isRequirementDissectionStageId\(activeStageId\.value\)/,
    'the requirement-dissection embedded workbench should only render behind an explicit feature flag'
  )

  assert.match(
    appVue,
    /const workflowUsesStageAgentScope = computed\(\(\) =>[\s\S]*isWorkflowAgentStageSessionScopeId\(workflowCurrentStageId\.value\)/,
    'stage Agent session scope should be independent from the embedded display mode'
  )

  assert.match(
    appVue,
    /function workflowAgentScopeId\(\) \{\s*if \(workflowUsesStageAgentScope\.value\) \{\s*return workflowCurrentStageId\.value\s*\}/,
    'opening the side Agent in requirement dissection should still use the requirement-dissection stage session'
  )

  assert.match(
    appVue,
    /function confirmWorkflowStageFromAgentInput\(content = '', scopeId = workflowAgentScopeId\(\)\) \{[\s\S]*if \(!isWorkflowAgentWorkbenchStageId\(stageId\)\) return false/,
    'stage confirmation from side Agent input should not depend on the old embedded display mode'
  )

  assert.match(
    appVue,
    /function showWorkflowAgentInline\(\) \{\s*setWorkflowAgentDisplayMode\('sidebar'\)\s*\}/,
    'legacy inline open calls should route to the side Agent while medium mode is hidden'
  )
})

test('workflow agent shows canvas context reference on sent canvas-action messages only', () => {
  const drawerHeadStart = drawerVue.indexOf('<div class="agent-drawer-head">')
  const drawerHeadEnd = drawerVue.indexOf('<div class="agent-dialog-body">', drawerHeadStart)
  const drawerHeadSource = drawerVue.slice(drawerHeadStart, drawerHeadEnd)

  assert.match(
    appVue,
    /:canvas-tabs="workflowAgentCanvasTabs"/,
    'Agent should still receive the current-stage node list as context'
  )
  assert.match(
    appVue,
    /const workflowAgentCanvasTabs = computed\(\(\) =>[\s\S]*workflowCurrentCanvasNodes\.value[\s\S]*key:\s*node\.id[\s\S]*label:\s*node\.title \|\| node\.id/,
    'Agent context tabs should be derived from current stage nodes, not workflowCanvas.orderedTabs'
  )
  assert.doesNotMatch(
    appVue,
    /<WorkflowAgentDrawer[\s\S]*:canvas-tabs="workflowCanvas\.orderedTabs"[\s\S]*@send="sendWorkflowAgentMessage"/,
    'Agent context must not use historical unified root canvas tabs'
  )
  assert.match(
    drawerVue,
    /v-if="messageContextReference\(message\)"[\s\S]*class="agent-context-reference agent-message-context-reference"/,
    'Agent should render canvas context reference on the sent message after sending'
  )
  assert.match(
    drawerVue,
    /function normalizeAgentContextReference\(reference = null\)[\s\S]*正在引用画布节点[\s\S]*function messageContextReference\(message = \{\}\)[\s\S]*normalizeAgentContextReference\(messageMeta\(message\)\.contextReference\)/,
    'Agent message reference should be driven by message metadata instead of hardcoded node names'
  )
  assert.match(
    drawerVue,
    /v-if="composerReferenceView"[\s\S]*class="agent-composer-reference-pill"[\s\S]*@click="\$emit\('clear-composer-reference'\)"/,
    'Agent composer should show a removable pending reference after a canvas action is selected'
  )
  assert.match(
    appVue,
    /:composer-reference="workflowAgentComposerReference"[\s\S]*@clear-composer-reference="clearWorkflowAgentComposerReference"/,
    'Agent composer reference should be owned by app state and removable from the drawer'
  )
  assert.match(
    appVue,
    /function workflowAgentContextReferenceForNode\(nodeId = '', canvasAction = null\)[\s\S]*canvasNodeById\(nodeId\)[\s\S]*canvasAction:\s*canvasAction \|\| null[\s\S]*title:\s*node\.title \|\| node\.name \|\| node\.id/,
    'canvas action references should be built from the active canvas node instead of fixed business fields'
  )
  assert.match(
    appVue,
    /const pendingComposerReference = options\.contextReference \|\| workflowAgentComposerReference\.value \|\| null[\s\S]*const contextReference = pendingComposerReference \|\| \(pendingComposerCanvasAction[\s\S]*contextReference \? \{ contextReference \} : \{\}/,
    'sent canvas action user messages should persist the dynamic context reference in metadata'
  )
  assert.match(
    appVue,
    /function sendWorkflowAgentCanvasAction\(action, nodeId = ''\)[\s\S]*setWorkflowAgentComposerReference\(workflowAgentContextReferenceForNode\(targetNodeId, canvasAction\)\)[\s\S]*workflowAgentInput\.value = canvasAction\.actionLabel/,
    'clicking a canvas action should stage the reference in the composer instead of immediately sending'
  )
  assert.match(
    appVue,
    /function isWorkflowAgentCanvasUpdateRequest\(content = ''\)[\s\S]*更新[\s\S]*优化[\s\S]*重生成/,
    'typed canvas update requests should route through the same canvas action reference path'
  )
  assert.doesNotMatch(
    drawerHeadSource,
    /class="agent-context-reference/,
    'Agent header should not host the reference block'
  )
  assert.doesNotMatch(
    drawerVue,
    /class="agent-node-trigger"/,
    'Agent header should not expose the old manual node dropdown trigger'
  )
  assert.doesNotMatch(
    drawerVue,
    /aria-label="切换当前环节"/,
    'Agent header should not imply that context switching is a separate Agent mode'
  )
})

test('workflow canvas actions keep one stage Agent session while passing node context separately', () => {
  assert.match(
    appVue,
    /const contextNodeId = options\.nodeId \|\| pendingComposerReference\?\.nodeId \|\| workflowAgentResolvedNodeId\(\)/,
    'canvas action messages should resolve the active node as context, not as the conversation session key'
  )
  assert.match(
    appVue,
    /const isStageProgressionMessage = options\.action === 'stage-confirm-next'[\s\S]*const targetScopeId = isStageProgressionMessage[\s\S]*\? \(options\.nodeId \|\| workflowAgentScopeId\(\)\)[\s\S]*: workflowUsesStageAgentScope\.value[\s\S]*\? workflowCurrentStageId\.value[\s\S]*: \(options\.nodeId \|\| pendingComposerReference\?\.nodeId \|\| workflowAgentScopeId\(\)\)/,
    'stage workbench Agent messages should stay in the stage-level conversation session while stage-next summaries keep their confirmed stage scope'
  )
  assert.match(
    appVue,
    /const contextReference = pendingComposerReference \|\| \(pendingComposerCanvasAction[\s\S]*workflowAgentContextReferenceForNode\(contextNodeId, pendingComposerCanvasAction\)/,
    'sent canvas action references should point at the page/node context even when the session is stage-scoped'
  )
  assert.match(
    appVue,
    /const knowledgeResult = await retrieveWorkflowKnowledge\(content, contextNodeId \|\| targetScopeId\)/,
    'project knowledge retrieval should use the active node context before falling back to the stage scope'
  )
  assert.match(
    appVue,
    /const pendingStreamOptions = \{[\s\S]*scopeId:\s*targetScopeId,[\s\S]*nodeId:\s*contextNodeId \|\| targetScopeId,[\s\S]*canvasAction:/,
    'backend stream requests should persist to the stage scope while receiving the active node id as request context'
  )
})

test('workflow stage Agent header stays stage-scoped instead of page-node scoped', () => {
  assert.match(
    workbenchSource,
    /const scopeIsActiveNodeStage = Boolean\(activeNode\?\.stageId && scopeId === activeNode\.stageId\)/,
    'stage Agent sessions should detect when the active page is only contextual metadata'
  )
  assert.match(
    workbenchSource,
    /const scopeTitle = scopeIsActiveNodeStage[\s\S]*\? workflowAgentStageScopeTitle\(scopeId, current\)[\s\S]*: activeNode\?\.title \|\| current\.title \|\| '当前步骤'/,
    'Agent header title should use the stage title when the session is stage-scoped'
  )
  assert.doesNotMatch(
    workbenchSource,
    /const scopeTitle = activeNode\?\.title \|\| current\.title \|\| '当前步骤'/,
    'stage-scoped Agent header must not make the selected page look like a separate Agent'
  )
})

test('later workflow stages collapse the side agent by default while requirement analysis keeps it available', () => {
  const defaultStageStart = appVue.indexOf('const WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES = [')
  const defaultStageEnd = appVue.indexOf(']', defaultStageStart)
  const defaultStageSource = appVue.slice(defaultStageStart, defaultStageEnd)
  const selectStart = appVue.indexOf('function selectWorkflowStage(stageId')
  const selectEnd = appVue.indexOf('function selectWorkflowStageAndRefresh', selectStart)
  const selectSource = appVue.slice(selectStart, selectEnd)
  const canvasDefaultStageStart = canvasVue.indexOf('const DEFAULT_TOTAL_FLOW_STAGES = [')
  const canvasDefaultStageEnd = canvasVue.indexOf(']', canvasDefaultStageStart)
  const canvasDefaultStageSource = canvasVue.slice(canvasDefaultStageStart, canvasDefaultStageEnd)

  assert.match(
    defaultStageSource,
    /\{ id: 'requirement-dissection', name: '需求分析' \}/,
    'App default stage label should show 需求分析 instead of the old 需求解剖 wording'
  )
  assert.match(
    canvasDefaultStageSource,
    /\{ id: 'requirement-dissection', name: '需求分析' \}/,
    'canvas stage strip fallback should show 需求分析'
  )
  assert.match(
    appVue,
    /function workflowStageDisplayName\(stage = \{\}\)[\s\S]*stageId === WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID \|\| stageName === '需求解剖'[\s\S]*return '需求分析'/,
    'legacy backend runs named 需求解剖 should display as 需求分析'
  )
  assert.match(
    canvasVue,
    /stage\.id === 'requirement-dissection' \|\| stage\.name === '需求解剖'[\s\S]*\? '需求分析'/,
    'canvas should normalize legacy 需求解剖 stage names to 需求分析'
  )
  assert.match(
    selectSource,
    /if \(workflowActiveStageId\.value === stageId\) \{[\s\S]*if \(stageId !== WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID\) setWorkflowAgentDisplayMode\('hidden'\)[\s\S]*return[\s\S]*\}/,
    'clicking an already active later stage should still collapse the side Agent'
  )
  assert.match(
    selectSource,
    /workflowActiveStageId\.value = stageId[\s\S]*if \(stageId !== WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID\) setWorkflowAgentDisplayMode\('hidden'\)/,
    'selecting any stage after requirement analysis should hide the side Agent by default'
  )
})

test('workflow canvas topbar keeps version history immediately before Agent', () => {
  const toolbarStart = canvasVue.indexOf('<div class="canvas-toolbar-actions">')
  const toolbarEnd = canvasVue.indexOf('<div class="workflow-canvas-stage-row">', toolbarStart)
  const toolbarSource = canvasVue.slice(toolbarStart, toolbarEnd)
  const versionIndex = toolbarSource.indexOf('版本历史')
  const agentIndex = toolbarSource.indexOf('Agent')

  assert.notEqual(versionIndex, -1, 'top toolbar should expose version history')
  assert.notEqual(agentIndex, -1, 'top toolbar should expose Agent')
  assert.ok(versionIndex < agentIndex, 'version history should sit to the left of Agent')
})

test('interaction lofi page cards expose fixed Agent tool entries instead of business output', () => {
  const interactionPageStart = totalDesignFlowSource.indexOf('function interactionPageNode')
  const interactionPageEnd = totalDesignFlowSource.indexOf('function buildStageCanvases', interactionPageStart)
  const interactionPageSource = totalDesignFlowSource.slice(interactionPageStart, interactionPageEnd)

  assert.match(
    interactionPageSource,
    /\['给布局方案', '补交互细节', '重生成本页'\]/,
    'interaction page cards should expose fixed tool-entry actions for Agent/model'
  )
  assert.doesNotMatch(
    interactionPageSource,
    /\['补页面目标', '补跳转', '补状态'\]/,
    'old generic page-detail actions should not return on interaction page cards'
  )
})

test('interaction lofi page cards normalize legacy persisted quick actions immediately', () => {
  const quickActionStart = canvasVue.indexOf('const INTERACTION_LOFI_PAGE_TOOL_ACTIONS')
  const quickActionEnd = canvasVue.indexOf('function nodeDetailText', quickActionStart)
  const quickActionSource = canvasVue.slice(quickActionStart, quickActionEnd)

  assert.match(
    quickActionSource,
    /function isInteractionLofiPageNode\(node = \{\}\)/,
    'canvas should detect interaction-lofi page nodes before rendering card actions'
  )

  assert.match(
    quickActionSource,
    /const INTERACTION_LOFI_PAGE_TOOL_ACTIONS = \['给布局方案', '补交互细节', '重生成本页'\]/,
    'interaction page tool actions should be centralized for current and historical runs'
  )

  assert.match(
    quickActionSource,
    /if \(isInteractionLofiPageNode\(node\)\) return \[\.\.\.INTERACTION_LOFI_PAGE_TOOL_ACTIONS\]/,
    'historical persisted nodes with old quickActions should render the new tool entries immediately'
  )
})

test('workflow stage strip exposes stage-level next action', () => {
  const stageRowStart = canvasVue.indexOf('<div class="workflow-canvas-stage-row">')
  const stageRowEnd = canvasVue.indexOf('<section v-if="shouldShowRequirementSlices"', stageRowStart)
  const stageRowSource = canvasVue.slice(stageRowStart, stageRowEnd)

  assert.match(
    stageRowSource,
    /class="workflow-stage-actions"[\s\S]*confirmStageAndGoNext[\s\S]*下一步/,
    'stage-level next should sit beside the stage strip'
  )

  assert.match(
    canvasVue,
    /const nextWorkflowStage = computed\(\(\) => totalFlowStages\.value\[activeStageIndex\.value \+ 1\] \|\| null\)/,
    'canvas should compute the next workflow stage for the top-level next button'
  )

  assert.match(
    canvasVue,
    /const canAdvanceWorkflowStage = computed\(\(\) => Boolean\(props\.totalFlow && nextWorkflowStage\.value\?\.id\)\)/,
    'stage-level next should stay hidden until the saved run totalFlow is hydrated'
  )
})

test('workflow stage strip keeps all stage entries and disables unreached future stages', () => {
  assert.match(
    canvasVue,
    /const visibleTotalFlowStages = computed\(\(\) =>\s*totalFlowStages\.value\.filter\(\(stage\) => !isHiddenAgentPreparationStage\(stage\.id\)\)/,
    'stage strip should render all workflow stage entries except hidden preparation stages'
  )

  assert.doesNotMatch(
    canvasVue,
    /visibleTotalFlowStages[\s\S]{0,220}index <= activeStageIndex\.value/,
    'stage strip must not remove future stages from the entry list'
  )

  assert.match(
    canvasVue,
    /function previousStageIdForCanvasStage\(stageId = ''\)[\s\S]*return totalFlowStages\.value\[index - 1\]\?\.id \|\| ''/,
    'canvas stage strip should resolve the previous stage for sequential unlocks'
  )

  assert.match(
    canvasVue,
    /function canOpenStage\(stageId = ''\)[\s\S]*if \(index < activeStageIndex\.value\) return true[\s\S]*const previousStageId = previousStageIdForCanvasStage\(stageId\)[\s\S]*if \(previousStageId && stageConfirmation\(previousStageId\)\) return true[\s\S]*const runtime = stageRuntime\(stageId\)[\s\S]*if \(runtime && typeof runtime\.canOpen === 'boolean'\) return runtime\.canOpen === true[\s\S]*return false/,
    'stage tabs should allow reached and sequentially confirmed stages before falling back to backend runtime'
  )

  assert.doesNotMatch(
    canvasVue,
    /function canOpenStage\(stageId = ''\)[\s\S]*stageCanvasHasRenderedContent\(stageId\)/,
    'scaffold canvas nodes must not unlock future stage tabs'
  )

  assert.match(
    canvasVue,
    /function stageCanvasHasRenderedContent\(stageId = ''\)[\s\S]*contentStatus !== 'model-pending'[\s\S]*contentStatus !== 'waiting-model'[\s\S]*contentSource !== 'model-pending'/,
    'rendered-stage detection should ignore model-pending placeholder canvas nodes'
  )

  assert.match(
    appVue,
    /function canSelectWorkflowStage\(stageId = ''\)[\s\S]*if \(currentIndex >= 0 && targetIndex <= currentIndex\) return true[\s\S]*if \(\['generating', 'paused'\]\.includes\(targetStatus\) && workflowStageHasConfirmedAccess\(normalizedStageId\)\) return true[\s\S]*const previousStageId = stageIds\[targetIndex - 1\][\s\S]*if \(previousStageId && workflowStageConfirmation\(previousStageId\)\) return true[\s\S]*const runtime = workflowStageRuntime\(normalizedStageId\)/,
    'App-level stage guard should unlock reached or confirmed active generation before checking sequential confirmation and runtime fallback'
  )
})

test('workflow current stage prefers backend currentStage until the user manually switches stages', () => {
  assert.match(
    appVue,
    /const workflowCurrentStageId = computed\(\(\) => \{[\s\S]*const backendCurrentStageId = normalizeWorkflowStageId\(workflowTotalDesignFlow\.value\?\.currentStage \|\| ''\)[\s\S]*if \(!workflowActiveStageTouchedByUser\.value && validStageIds\.includes\(backendCurrentStageId\)\) return backendCurrentStageId[\s\S]*if \(validStageIds\.includes\(workflowActiveStageId\.value\)\) return workflowActiveStageId\.value/,
    'restored runs should render the backend-owned currentStage instead of a stale local active stage before manual switching'
  )
})

test('stage-level next switches immediately while agent summary prepares next-stage generation', () => {
  const runQuickStart = appVue.indexOf('function runWorkflowNodeQuickAction')
  const runQuickEnd = appVue.indexOf('function recordWorkflowStageConfirmation', runQuickStart)
  const runQuickSource = appVue.slice(runQuickStart, runQuickEnd)
  const canvasNextStart = canvasVue.indexOf('function confirmStageAndGoNext()')
  const canvasNextEnd = canvasVue.indexOf('function handleCanvasWheel', canvasNextStart)
  const canvasNextSource = canvasVue.slice(canvasNextStart, canvasNextEnd)
  const summaryStart = appVue.indexOf('async function confirmWorkflowStageWithAgentSummary')
  const summaryEnd = appVue.indexOf('function isWorkflowAgentCanvasAdviceQuickReply', summaryStart)
  const summarySource = appVue.slice(summaryStart, summaryEnd)

  assert.match(
    runQuickSource,
    /if \(payload\.mode === 'stage-canvas-confirm-next'\)[\s\S]*void confirmWorkflowStageWithAgentSummary\(payload\)[\s\S]*return/,
    'stage canvas next should route through the stage progression flow'
  )

  assert.match(
    runQuickSource,
    /if \(payload\.mode === 'stage-agent-confirm-next'\)[\s\S]*void confirmWorkflowStageWithAgentSummary\(payload\)[\s\S]*return/,
    'stage agent next should route through the same stage progression flow'
  )

  assert.match(
    appVue,
    /function selectWorkflowStageForPendingGeneration\(stageId = '', options = \{\}\)[\s\S]*canAdvanceToConfirmedNextStage\(stageId, options\.confirmedPreviousStageId\)[\s\S]*selectWorkflowStage\(stageId, \{ skipGuard: true \}\)[\s\S]*workflowCanvasLoading\.value = true[\s\S]*workflowCanvasRefreshingNodeId\.value = workflowStageRefreshNodeId\(stageId\)/,
    'stage progression should use the fresh previous-stage confirmation and then switch without the normal click guard'
  )

  assert.match(
    appVue,
    /async function confirmWorkflowStageWithAgentSummary\(payload = \{\}\)[\s\S]*const confirmedNextStageId = recordWorkflowStageConfirmation\([\s\S]*if \(!selectWorkflowStageForPendingGeneration\(confirmedNextStageId, \{ confirmedPreviousStageId: currentStageId \}\)\) return[\s\S]*const result = await sendWorkflowAgentMessage\(/,
    'stage progression should record a provisional confirmation and switch stages before awaiting Agent summary'
  )

  assert.match(
    appVue,
    /const summary = workflowAgentStageSummaryFromSendResult\(result, targetScopeId\)[\s\S]*recordWorkflowStageConfirmation\(\{[\s\S]*summary[\s\S]*\}\)[\s\S]*await regenerateWorkflowStage\(confirmedNextStageId\)/,
    'after the Agent summary returns, it should be saved as stage confirmation context before generating the next canvas'
  )

  assert.match(
    canvasNextSource,
    /nodeId:\s*activeStageId\.value/,
    'top-level stage next should use the stage id as Agent scope instead of the currently focused card node'
  )

  assert.match(
    canvasVue,
    /watch\(\s*\(\) => props\.totalFlow\?\.currentStage \|\| '',\s*\(stageId\) => \{[\s\S]*activeStageOverrideId\.value = stageId[\s\S]*\}/,
    'canvas-local stage overrides should follow parent stage progression after top-level next'
  )

  assert.match(
    summarySource,
    /const targetScopeId = isStageProgressionPayload\(payload\)\s*\?\s*currentStageId\s*:/,
    'stage progression summaries should force stage scope even when a card node id is present'
  )

  assert.doesNotMatch(
    summarySource,
    /if \(targetNodeId\) selectWorkflowCanvasNode\(targetNodeId\)/,
    'stage progression should not focus a canvas node before switching stages'
  )

  assert.doesNotMatch(
    runQuickSource,
    /if \(\['stage-agent-workbench', 'stage-agent-confirm-next', 'stage-canvas-confirm-next'\]\.includes\(payload\?\.mode\)\) \{[\s\S]*const targetNodeId = nodeId \|\| workflowAgentScopeId\(\)[\s\S]*if \(targetNodeId\) selectWorkflowCanvasNode\(targetNodeId\)[\s\S]*if \(payload\.mode === 'stage-canvas-confirm-next'\)/,
    'stage progression modes should not preselect the currently focused card before entering the stage flow'
  )
})

test('stage summary prefers explicit page layout artifacts from agent context', () => {
  assert.match(
    appVue,
    /function workflowAgentStageSummaryCandidateScore\(message = \{\}, index = 0\)[\s\S]*:::\\s\*page-layout-artifact[\s\S]*stage-confirm-next[\s\S]*Topic\\\/input composer\|快捷提示词\|Generate podcast/,
    'stage confirmation summary selection should score artifact-bearing Agent messages above plain summaries'
  )

  assert.match(
    appVue,
    /function workflowAgentStageSummaryFromSendResult\(result = \{\}, scopeId = workflowAgentScopeId\(\)\)[\s\S]*candidates\.sort[\s\S]*workflowAgentStageSummaryCandidateScore/,
    'stage confirmation summary should choose the best Agent context result rather than blindly using the latest assistant message'
  )
})

test('stage-level next refreshes the confirmed next stage canvas from current total flow', () => {
  const runQuickStart = appVue.indexOf('function runWorkflowNodeQuickAction')
  const runQuickEnd = appVue.indexOf('function recordWorkflowStageConfirmation', runQuickStart)
  const runQuickSource = appVue.slice(runQuickStart, runQuickEnd)
  const regenerateStart = appVue.indexOf('async function regenerateWorkflowStage')
  const regenerateEnd = appVue.indexOf('function selectWorkflowCanvasNode', regenerateStart)
  const regenerateSource = appVue.slice(regenerateStart, regenerateEnd)

  assert.match(
    appVue,
    /function selectWorkflowStageForPendingGeneration\(stageId = '', options = \{\}\)[\s\S]*selectWorkflowStage\(stageId, \{ skipGuard: true \}\)[\s\S]*mergeWorkflowStageStatus\(stageId, 'generating'[\s\S]*applyWorkflowStageStatusesToAnalysis\(\)/,
    'stage advance should mark the confirmed next stage as generating immediately'
  )

  assert.match(
    appVue,
    /async function confirmWorkflowStageWithAgentSummary\(payload = \{\}\)[\s\S]*await sendWorkflowAgentMessage\([\s\S]*action:\s*'stage-confirm-next'[\s\S]*await regenerateWorkflowStage\(confirmedNextStageId\)/,
    'next-stage generation should happen after the Agent stage summary request'
  )

  assert.match(
    runQuickSource,
    /if \(payload\.mode === 'stage-canvas-confirm-next'\)[\s\S]*void confirmWorkflowStageWithAgentSummary\(payload\)[\s\S]*return/,
    'top-level next should use the summary-backed stage progression flow'
  )

  assert.match(
    runQuickSource,
    /if \(payload\.mode === 'stage-agent-confirm-next'\)[\s\S]*void confirmWorkflowStageWithAgentSummary\(payload\)[\s\S]*return/,
    'Agent next should use the same summary-backed stage progression flow'
  )

  assert.match(
    regenerateSource,
    /currentTotalDesignFlow:\s*workflowAnalysisResult\.value\.totalDesignFlow/,
    'next-stage regeneration should send the current total flow so backend can use prior stage outputs and confirmations'
  )

  assert.match(
    regenerateSource,
    /const runProject = workflowProjectForRun\(run\)/,
    'stage regeneration should resolve business project from the active workflow run instead of the current route project'
  )

  assert.match(
    regenerateSource,
    /const stageKnowledgeDocuments = run\.demandScope === 'project'[\s\S]*workflowSelectedKnowledgeScopeDocuments\(stageInput, runProjectId\)[\s\S]*workflowKnowledgeContextDocuments\(8, stageInput, runProjectId\)/,
    'project-scoped stage regeneration should include selected scope and knowledge hub tab documents'
  )

  assert.match(
    regenerateSource,
    /documents:\s*\[[\s\S]*\.\.\.\(run\.referenceFiles\?\.\[run\.currentStepId\] \|\| \[\]\)[\s\S]*\.\.\.stageKnowledgeDocuments[\s\S]*\]/,
    'stage regeneration should send uploaded references plus project knowledge documents to the backend'
  )

  assert.match(
    regenerateSource,
    /workflowCanvasLoading\.value = true[\s\S]*workflowCanvasRefreshingNodeId\.value = workflowStageRefreshNodeId\(stageId\)[\s\S]*workflowCanvasLoading\.value = false[\s\S]*workflowCanvasRefreshingNodeId\.value = ''/,
    'stage regeneration should show and clear canvas refresh state without requiring a manual browser refresh'
  )

  assert.match(
    appVue,
    /return nodes\.map\(\(node, index\) => index !== startIndex \? node : \{/,
    'active stage refresh should mark only the current canvas card instead of all downstream cards'
  )
})

test('workflow stage tabs use backend stageRuntime without letting stale locks override reached stages', () => {
  const canOpenStart = canvasVue.indexOf("function canOpenStage(stageId = '')")
  const canOpenEnd = canvasVue.indexOf('function layoutCanvasNodes', canOpenStart)
  const canOpenSource = canvasVue.slice(canOpenStart, canOpenEnd)
  const generatedStart = appVue.indexOf('function workflowStageCanvasHasGeneratedContent')
  const generatedEnd = appVue.indexOf('function inferredWorkflowStageStatuses', generatedStart)
  const generatedSource = appVue.slice(generatedStart, generatedEnd)

  assert.match(
    canOpenSource,
    /if \(index < activeStageIndex\.value\) return true[\s\S]*const runtime = stageRuntime\(stageId\)[\s\S]*if \(runtime && typeof runtime\.canOpen === 'boolean'\) return runtime\.canOpen === true/,
    'stage tab clickability should use backend runtime only after reached-stage guards'
  )

  assert.match(
    appVue,
    /function normalizeWorkflowTotalFlowMeta\(meta = null\)[\s\S]*stageRuntime:\s*normalizeWorkflowStageScopedMap\(meta\.stageRuntime\)/,
    'frontend totalFlow normalization should preserve backend-owned stageRuntime'
  )

  assert.doesNotMatch(
    canOpenSource,
    /stageCanvasHasRenderedContent\(stageId\)/,
    'stage tabs must not unlock future stages merely because a scaffold canvas has nodes'
  )

  assert.match(
    generatedSource,
    /if \(stageId === 'ui-visual'\)[\s\S]*artifactStatus === 'generated'[\s\S]*imageUrl[\s\S]*imageDataUrl/,
    'UI visual scaffold nodes with pending previews should not count as generated'
  )

  assert.match(
    generatedSource,
    /if \(\['html-output', 'vue-output'\]\.includes\(stageId\)\)[\s\S]*codePreview\?\.code[\s\S]*artifact\?\.code/,
    'HTML/Vue scaffold nodes with empty codePreview should not count as generated'
  )
})

test('workflow agent normalized display decodes json envelopes and literal escaped newlines', () => {
  const normalized = normalizeWorkflowAgentReplyContent('{"content":"结论：可进入下一阶段\\\\n\\\\n依据：使用项目知识库。"}')

  assert.equal(normalized, '结论：可进入下一阶段\n\n依据：使用项目知识库。')
  assert.doesNotMatch(normalized, /\\n/)
  assert.doesNotMatch(normalized, /^\{"content"/)
})

test('UI visual canvas cards render image canvas without duplicate inline generation button', () => {
  const cardStart = canvasVue.indexOf('<article\n              v-for="node in displayNodes"')
  const cardEnd = canvasVue.indexOf('<div v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls"', cardStart)
  const cardSource = canvasVue.slice(cardStart, cardEnd)
  const visualCardStart = canvasVue.indexOf('<section v-else-if="isVisualGalleryDetail(node)" class="visual-canvas-card-preview">')
  const visualCardEnd = canvasVue.indexOf('<section v-else-if="!isNodeActuallyLoading(node) && isPreviewCodeDetail(node)"', visualCardStart)
  const visualCardSource = canvasVue.slice(visualCardStart, visualCardEnd)
  const fullscreenStart = canvasVue.indexOf('<div v-else-if="isVisualGalleryDetail(fullscreenNode)"')
  const fullscreenEnd = canvasVue.indexOf('<div v-else-if="isPreviewCodeDetail(fullscreenNode)"', fullscreenStart)
  const fullscreenSource = canvasVue.slice(fullscreenStart, fullscreenEnd)

  assert.match(
    cardSource,
    /isVisualGalleryDetail\(node\)[\s\S]*class="visual-canvas-card-preview"[\s\S]*visualPreviewImage\(node\)[\s\S]*visualPreviewNeedsConfiguration\(node\)[\s\S]*visualPreviewGenerationFailed\(node\)/,
    'UI visual cards should show an inline image canvas and generation states'
  )

  assert.match(
    canvasVue,
    /function isVisualGalleryDetail\(node = \{\}\)[\s\S]*node\?\.detailLayout === 'visual-gallery'[\s\S]*node\?\.stageId === 'ui-visual'[\s\S]*String\(node\?\.id \|\| ''\)\.startsWith\('ui-'\)[\s\S]*node\?\.visualPreview[\s\S]*node\?\.visualBrief/,
    'UI visual nodes, including failed historical nodes, should never fall back to generic summary cards'
  )

  assert.doesNotMatch(
    cardSource,
    /class="visual-canvas-card-actions"[\s\S]*variant="primary"[\s\S]*runCanvasGenerationAction\(node, action\)/,
    'UI visual cards should not show a duplicate black generate button above the fixed page action row'
  )

  assert.match(
    visualCardSource,
    /visualCanvasPlaceholderDescription\(node, 'pending'\)/,
    'pending UI visual cards should show a concise status placeholder instead of the generation prompt'
  )

  assert.match(
    visualCardSource,
    /visualCanvasPlaceholderDescription\(node, 'generating'\)/,
    'generating UI visual cards should show a concise status placeholder instead of the generation prompt'
  )

  assert.doesNotMatch(
    visualCardSource,
    /\{\{\s*visualPreview\(node\)\.imagePrompt\s*\}\}/,
    'UI visual cards should not dump imagePrompt/screen-contract text into the canvas card body'
  )

  assert.match(
    fullscreenSource,
    /visualCanvasPlaceholderDescription\(fullscreenNode, 'pending'\)/,
    'fullscreen pending UI visual detail should use the same concise placeholder'
  )

  assert.doesNotMatch(
    fullscreenSource,
    /\{\{\s*visualPreview\(fullscreenNode\)\.imagePrompt\s*\}\}/,
    'fullscreen UI visual detail should not dump imagePrompt/screen-contract text as the default body'
  )

  assert.match(
    stylesSource,
    /\.canvas-node-card\.visual-canvas-node[\s\S]*overflow:\s*hidden;/,
    'visual cards should contain their image and content inside the card bounds'
  )
})

test('UI visual quick action routes generate visual through the artifact generation pipeline', () => {
  const cardStart = canvasVue.indexOf('<article\n              v-for="node in displayNodes"')
  const cardEnd = canvasVue.indexOf('<div v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls"', cardStart)
  const cardSource = canvasVue.slice(cardStart, cardEnd)
  const visibleActionsStart = canvasVue.indexOf('function visibleNodeQuickActions')
  const visibleActionsEnd = canvasVue.indexOf('function visualQuickGenerationAction', visibleActionsStart)
  const visibleActionsSource = canvasVue.slice(visibleActionsStart, visibleActionsEnd)
  const quickHelperStart = canvasVue.indexOf('function visualQuickGenerationAction')
  const quickHelperEnd = canvasVue.indexOf('function nodeDetailText', quickHelperStart)
  const quickHelperSource = canvasVue.slice(quickHelperStart, quickHelperEnd)

  assert.match(
    cardSource,
    /@click\.stop="runNodeQuickAction\(node, action\)"/,
    'card quick actions should be normalized before emitting to App'
  )

  assert.match(
    visibleActionsSource,
    /if \(isVisualGalleryDetail\(node\) && generationActions\(node\)\.length\)[\s\S]*generationActions\(node\)\[0\]\?\.label/,
    'UI visual cards should expose backend-owned generationActions in the fixed footer even when quickActions are absent'
  )

  assert.match(
    quickHelperSource,
    /function visualQuickGenerationAction\(node = \{\}, action = ''\)[\s\S]*生成视觉[\s\S]*generationActions\(node\)\[0\]/,
    'the legacy 生成视觉 label should map to the node generation action'
  )

  assert.match(
    quickHelperSource,
    /emit\('quick-action', \{[\s\S]*generationAction[\s\S]*targetGenerator[\s\S]*mode:\s*'stage-detail-generation'/,
    'normalized visual quick actions should enter the generation route instead of generic Agent chat'
  )
})

test('UI visual card quick actions stay in a fixed footer while visual content scrolls inside the card', () => {
  const cardStart = canvasVue.indexOf('<article\n              v-for="node in displayNodes"')
  const cardEnd = canvasVue.indexOf('<div v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls"', cardStart)
  const cardSource = canvasVue.slice(cardStart, cardEnd)
  const quickHelperStart = canvasVue.indexOf('function visibleNodeQuickActionLabel')
  const quickHelperEnd = canvasVue.indexOf('function nodeDetailText', quickHelperStart)
  const quickHelperSource = canvasVue.slice(quickHelperStart, quickHelperEnd)

  assert.match(
    cardSource,
    /:disabled="isNodeQuickActionDisabled\(node, action\)"[\s\S]*\{\{ visibleNodeQuickActionLabel\(node, action\) \}\}/,
    'card footer buttons should render normalized labels and loading disabled state'
  )

  assert.match(
    quickHelperSource,
    /function visibleNodeQuickActionLabel\(node = \{\}, action = ''\)[\s\S]*const visualGenerationAction = visualQuickGenerationAction\(node, action\)[\s\S]*visualGenerationButtonLabel\(node, visualGenerationAction\)/,
    'legacy 生成视觉 text should display as the current visual generation label'
  )

  assert.match(
    stylesSource,
    /\.canvas-node-card\.visual-canvas-node \.canvas-node-hitbox[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;[\s\S]*overflow:\s*hidden;/,
    'visual cards should keep the same header/body/footer rows as interaction lofi cards so footer actions stay visible'
  )

  assert.match(
    stylesSource,
    /\.canvas-node-card\.visual-canvas-node \.canvas-node-body[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/,
    'visual card previews should scroll inside the body row instead of overflowing over the footer'
  )
})

test('UI visual generation marks the image canvas as loading before the image returns', () => {
  const loadingStart = canvasVue.indexOf('function isNodeActuallyLoading')
  const loadingEnd = canvasVue.indexOf('function canvasNodeSummary', loadingStart)
  const loadingSource = canvasVue.slice(loadingStart, loadingEnd)
  const generationStart = appVue.indexOf('function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    loadingSource,
    /node\.artifactStatus === 'generating'/,
    'visual cards should show the loading block when artifact generation starts'
  )
  assert.match(
    loadingSource,
    /visualPreview\(node\)\.imageStatus === 'generating'/,
    'visual cards should also honor visualPreview imageStatus while generating'
  )
  assert.match(
    generationSource,
    /visualPreview:\s*\{[\s\S]*imageStatus:\s*'generating'/,
    'frontend should optimistically patch visualPreview.imageStatus so the red preview area enters loading immediately'
  )
  assert.match(
    generationSource,
    /visualPreview:\s*\{[\s\S]*imageStatus:\s*'failed'/,
    'frontend should patch visualPreview failure metadata when image generation fails'
  )
})

test('UI visual artifact generation does not start a second Agent layout-advice chat', () => {
  const generationStart = appVue.indexOf('function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.doesNotMatch(
    generationSource,
    /sendWorkflowAgentCanvasAction\(payload\.action \|\| generationAction\.label \|\| '生成', nodeId\)/,
    'artifact generation should only update the generated canvas node, not send a follow-up Agent text action'
  )
})

test('Agent visual generation recommendations use the same artifact generation flow as canvas buttons', () => {
  const quickReplyStart = appVue.indexOf('function useWorkflowAgentQuickReply')
  const quickReplyEnd = appVue.indexOf('async function copyWorkflowAgentMessage', quickReplyStart)
  const quickReplySource = appVue.slice(quickReplyStart, quickReplyEnd)

  assert.match(
    appVue,
    /function workflowAgentVisualGenerationQuickAction\(content = '', sourceMessage = null\)[\s\S]*生成视觉[\s\S]*generationActions\[0\]/,
    'Agent quick replies such as 生成视觉 should resolve the current UI visual node generation action'
  )

  assert.match(
    quickReplySource,
    /const visualGenerationPayload = workflowAgentVisualGenerationQuickAction\(content, sourceMessage\)[\s\S]*runWorkflowGenerationAction\(visualGenerationPayload\)[\s\S]*return/,
    'Agent visual generation recommendations should run the artifact generation pipeline instead of generic Agent advice'
  )

  assert.match(
    quickReplySource,
    /workflowAgentVisualGenerationQuickAction\(content, sourceMessage\)[\s\S]*confirmWorkflowAgentApplyToCanvasRecommendation/,
    'visual generation should be handled before apply-to-canvas or generic canvas-advice routing'
  )
})

test('UI visual generation keeps previous image visible and synchronizes action loading state', () => {
  const visualCardStart = canvasVue.indexOf('<section v-else-if="isVisualGalleryDetail(node)" class="visual-canvas-card-preview">')
  const visualCardEnd = canvasVue.indexOf('<section v-else-if="!isNodeActuallyLoading(node) && isPreviewCodeDetail(node)"', visualCardStart)
  const visualCardSource = canvasVue.slice(visualCardStart, visualCardEnd)
  const fullscreenStart = canvasVue.indexOf('<div v-else-if="isVisualGalleryDetail(fullscreenNode)"')
  const fullscreenEnd = canvasVue.indexOf('<div v-else-if="isPreviewCodeDetail(fullscreenNode)"', fullscreenStart)
  const fullscreenSource = canvasVue.slice(fullscreenStart, fullscreenEnd)

  assert.match(
    visualCardSource,
    /<div v-if="visualPreviewImage\(node\)" class="visual-canvas-card-image"[\s\S]*<div v-if="isNodeActuallyLoading\(node\)" class="visual-image-generating-overlay"/,
    'card regeneration should keep the previous generated image visible and add a loading overlay'
  )

  assert.match(
    visualCardSource,
    /<div v-else-if="isNodeActuallyLoading\(node\)" class="visual-canvas-card-placeholder is-generating visual-canvas-card-generating-image-placeholder"[\s\S]*<strong>生图中<\/strong>/,
    'first-time canvas image generation should reserve an image-like placeholder and clearly say 生图中'
  )

  assert.match(
    fullscreenSource,
    /<div v-if="visualPreviewImage\(fullscreenNode\)" class="visual-image-result"[\s\S]*<div v-if="isNodeActuallyLoading\(fullscreenNode\)" class="visual-image-generating-overlay"/,
    'fullscreen regeneration should keep the previous generated image visible and add a loading overlay'
  )

  assert.match(
    fullscreenSource,
    /:disabled="isNodeActuallyLoading\(fullscreenNode\)"[\s\S]*\{\{ visualGenerationButtonLabel\(fullscreenNode, action\) \}\}/,
    'fullscreen generation actions should be disabled and relabeled while the image artifact is generating'
  )

  assert.match(
    fullscreenSource,
    /:disabled="isNodeActuallyLoading\(pageNode\)"[\s\S]*\{\{ visualGenerationButtonLabel\(pageNode, generationActions\(pageNode\)\[0\]\) \}\}/,
    'page overview generation buttons should share the same loading state'
  )

  assert.match(
    canvasVue,
    /function visualGenerationButtonLabel\(node = \{\}, action = \{\}\)[\s\S]*if \(isNodeActuallyLoading\(node\)\) return '生成中'/,
    'visual generation button labels should be derived from node loading state'
  )

  assert.match(
    stylesSource,
    /\.visual-image-generating-overlay[\s\S]*position:\s*absolute;/,
    'loading overlays should be visually layered above existing images'
  )

  assert.match(
    stylesSource,
    /\.visual-canvas-card-generating-image-placeholder[\s\S]*aspect-ratio:[\s\S]*\.visual-canvas-card-generating-image-placeholder::before[\s\S]*animation:/,
    'canvas generating placeholders should keep an image slot with an animated skeleton surface'
  )
})

test('generated visual images expose download and fullscreen preview tools', () => {
  assert.match(
    canvasVue,
    /class="visual-image-tools"[\s\S]*downloadVisualImage\(node\)[\s\S]*openVisualImagePreview\(node\)/,
    'generated visual card images should expose download and fullscreen preview actions'
  )
  assert.match(
    canvasVue,
    /class="visual-image-tools"[\s\S]*downloadVisualImage\(fullscreenNode\)[\s\S]*openVisualImagePreview\(fullscreenNode\)/,
    'fullscreen visual image result should expose the same image actions'
  )
  assert.match(
    canvasVue,
    /v-if="visualImagePreview" class="visual-image-preview-modal"[\s\S]*visualImagePreview\.src/,
    'visual image preview should render in a dedicated fullscreen modal'
  )
  assert.match(
    canvasVue,
    /async function downloadVisualImage\(node = \{\}\)/,
    'image download should be implemented by the canvas component'
  )
  assert.match(
    stylesSource,
    /\.visual-image-tools[\s\S]*position:\s*absolute;[\s\S]*\.visual-image-preview-modal[\s\S]*z-index:\s*var\(--z-modal\);/,
    'image tools and preview modal should have stable styling and use the modal layer token'
  )
})

test('generated visual image tools are hover revealed and images keep aspect ratio', () => {
  const visualCardStart = canvasVue.indexOf('<section v-else-if="isVisualGalleryDetail(node)" class="visual-canvas-card-preview">')
  const visualCardEnd = canvasVue.indexOf('<section v-else-if="!isNodeActuallyLoading(node) && isPreviewCodeDetail(node)"', visualCardStart)
  const visualCardSource = canvasVue.slice(visualCardStart, visualCardEnd)
  const fullscreenStart = canvasVue.indexOf('<div v-else-if="isVisualGalleryDetail(fullscreenNode)"')
  const fullscreenEnd = canvasVue.indexOf('<div v-else-if="isPreviewCodeDetail(fullscreenNode)"', fullscreenStart)
  const fullscreenSource = canvasVue.slice(fullscreenStart, fullscreenEnd)

  assert.match(
    visualCardSource,
    /class="visual-canvas-card-image"\s*:class="visualCanvasSurfaceClass\(node\)"/,
    'canvas visual image viewport should carry a web/app surface class derived from generation metadata'
  )
  assert.match(
    fullscreenSource,
    /class="visual-image-result"\s*:class="visualCanvasSurfaceClass\(fullscreenNode\)"/,
    'fullscreen visual image viewport should carry the same web/app surface class'
  )
  assert.match(
    canvasVue,
    /function visualTargetLogicalWidth\(node = \{\}\)[\s\S]*targetImageSize[\s\S]*artifact\?\.targetImageSize[\s\S]*1920[\s\S]*375/,
    'visual display should infer web/app from targetImageSize first and then from node text'
  )
  assert.match(
    canvasVue,
    /function visualCanvasSurfaceClass\(node = \{\}\)[\s\S]*visualTargetLogicalWidth\(node\)[\s\S]*visual-surface-web[\s\S]*visual-surface-app/,
    'visual display should expose stable surface classes for web and app image viewports'
  )
  assert.match(
    stylesSource,
    /\.visual-canvas-card-image\s*\{[\s\S]*height:\s*230px;[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/,
    'canvas visual images should live inside a fixed-height viewport that scrolls vertically'
  )
  assert.match(
    stylesSource,
    /\.visual-canvas-card-image\.visual-surface-app[\s\S]*width:\s*min\(180px,\s*100%\);[\s\S]*height:\s*300px;/,
    'app visual images should use a fixed phone-like canvas viewport'
  )
  assert.match(
    stylesSource,
    /\.visual-canvas-card-image img[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*height:\s*auto;[\s\S]*max-height:\s*none;/,
    'canvas visual cards should fit viewport width only and let generated image height follow the natural ratio'
  )
  assert.match(
    stylesSource,
    /\.visual-gallery-page-thumb img[\s\S]*width:\s*auto;[\s\S]*height:\s*auto;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*object-fit:\s*contain;/,
    'visual detail thumbnails should preserve the generated image ratio'
  )
  assert.match(
    stylesSource,
    /\.visual-image-tools[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/,
    'image tools should be hidden until the user hovers or focuses the image'
  )
  assert.match(
    stylesSource,
    /\.visual-canvas-card-image:hover \.visual-image-tools[\s\S]*\.visual-image-result:hover \.visual-image-tools[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
    'image tools should appear on hover/focus for card and detail images'
  )
  assert.match(
    stylesSource,
    /\.visual-image-result\s*\{[\s\S]*height:\s*min\(72vh,\s*760px\);[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/,
    'fullscreen generated images should live inside a fixed viewport that scrolls vertically'
  )
  assert.match(
    stylesSource,
    /\.visual-image-result\.visual-surface-app[\s\S]*width:\s*min\(375px,\s*100%\);/,
    'fullscreen app generated images should render in a fixed 375-style viewport'
  )
  assert.match(
    stylesSource,
    /\.visual-image-result img[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*height:\s*auto;[\s\S]*max-height:\s*none;/,
    'fullscreen detail generated images should fit width only and let height follow the natural ratio'
  )

  assert.match(
    stylesSource,
    /\.agent-visual-artifact-image img[\s\S]*width:\s*auto;[\s\S]*max-width:\s*100%;[\s\S]*height:\s*auto;[\s\S]*max-height:\s*min\(58vh,\s*680px\);[\s\S]*object-fit:\s*contain;/,
    'Agent generated image cards should choose width or height bounds and preserve the generated image ratio'
  )
})

test('Agent visual image cards use one max display width and proportional scaling', () => {
  const agentImageStart = stylesSource.indexOf('.agent-visual-artifact-image {')
  const agentImageEnd = stylesSource.indexOf('.agent-visual-artifact-image img', agentImageStart)
  const agentImageSource = stylesSource.slice(agentImageStart, agentImageEnd)

  assert.match(
    stylesSource,
    /\.agent-visual-artifact-card[\s\S]*max-width:\s*min\(100%,\s*560px\);[\s\S]*justify-self:\s*start;/,
    'Agent image artifact cards should use one maximum display width instead of stretching to the whole drawer'
  )

  assert.match(
    stylesSource,
    /\.agent-visual-artifact-image[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/,
    'Agent image wrapper should not impose a fixed crop height'
  )

  assert.match(
    stylesSource,
    /\.agent-visual-artifact-image[\s\S]*justify-items:\s*start;/,
    'Agent image wrapper should align generated images and placeholders to the left'
  )

  assert.doesNotMatch(
    agentImageSource,
    /border:\s*1px solid/,
    'Agent image wrapper should not draw an extra framed box around generated images'
  )

  assert.doesNotMatch(
    agentImageSource,
    /background:\s*#[0-9a-fA-F]+/,
    'Agent image wrapper should not add a bottom background frame behind generated images'
  )

  assert.doesNotMatch(
    agentImageSource,
    /max-height:\s*62vh;/,
    'Agent image wrapper should not cap portrait UI screenshots into a crop box'
  )
})

test('generated visual images expose aspect ratio labels across canvas and Agent result cards', () => {
  const visualCardStart = canvasVue.indexOf('<section v-else-if="isVisualGalleryDetail(node)" class="visual-canvas-card-preview">')
  const visualCardEnd = canvasVue.indexOf('<section v-else-if="!isNodeActuallyLoading(node) && isPreviewCodeDetail(node)"', visualCardStart)
  const visualCardSource = canvasVue.slice(visualCardStart, visualCardEnd)
  const fullscreenStart = canvasVue.indexOf('<div v-else-if="isVisualGalleryDetail(fullscreenNode)"')
  const fullscreenEnd = canvasVue.indexOf('<div v-else-if="isPreviewCodeDetail(fullscreenNode)"', fullscreenStart)
  const fullscreenSource = canvasVue.slice(fullscreenStart, fullscreenEnd)

  assert.match(
    canvasVue,
    /function visualImageAspectRatioLabel\(node = \{\}\)[\s\S]*aspectRatio[\s\S]*targetAspectRatio[\s\S]*screenRatio/,
    'canvas should normalize explicit aspectRatio, targetAspectRatio, or screenRatio metadata'
  )

  assert.match(
    canvasVue,
    /const visualImageNaturalRatios = ref\(\{\}\)/,
    'canvas should keep loaded image natural ratios so actual generated dimensions can override target metadata'
  )

  assert.match(
    canvasVue,
    /function recordVisualImageNaturalRatio\(node = \{\}, event\)[\s\S]*naturalWidth[\s\S]*naturalHeight[\s\S]*visualImageNaturalRatios\.value/,
    'canvas should record natural image dimensions from img load events'
  )

  assert.match(
    canvasVue,
    /visualImageNaturalRatioLabel\(node\)[\s\S]*const candidates = \[/,
    'canvas ratio labels should prefer loaded natural dimensions before target aspect ratio metadata'
  )

  assert.match(
    visualCardSource,
    /<img :src="visualPreviewImage\(node\)"[\s\S]*@load="recordVisualImageNaturalRatio\(node, \$event\)"[\s\S]*v-if="visualImageAspectRatioLabel\(node\)" class="visual-image-ratio-badge"[\s\S]*\{\{ visualImageAspectRatioLabel\(node\) \}\}/,
    'canvas card thumbnails should show a compact ratio badge for mixed portrait/landscape images'
  )

  assert.match(
    fullscreenSource,
    /<img :src="visualPreviewImage\(fullscreenNode\)"[\s\S]*@load="recordVisualImageNaturalRatio\(fullscreenNode, \$event\)"[\s\S]*v-if="visualImageAspectRatioLabel\(fullscreenNode\)" class="visual-image-ratio-badge"[\s\S]*\{\{ visualImageAspectRatioLabel\(fullscreenNode\) \}\}/,
    'fullscreen visual result should keep the same ratio label near the generated image'
  )

  assert.match(
    drawerVue,
    /const naturalAspectRatioLabel = ref\(''\)[\s\S]*function recordImageNaturalRatio\(event\)[\s\S]*naturalWidth[\s\S]*naturalHeight/,
    'Agent generated image card should record loaded natural dimensions'
  )

  assert.match(
    drawerVue,
    /const aspectRatioLabel = computed\(\(\) => naturalAspectRatioLabel\.value \|\| metadataAspectRatioLabel\.value\)/,
    'Agent generated image card should prefer natural image ratio before visual artifact target metadata'
  )

  assert.match(
    drawerVue,
    /h\('img', \{[\s\S]*src: imageUrl\.value[\s\S]*onLoad: recordImageNaturalRatio/,
    'Agent visual artifact card should show a ratio badge without exposing long prompt text'
  )

  assert.match(
    stylesSource,
    /\.visual-image-ratio-badge[\s\S]*position:\s*absolute;[\s\S]*\.agent-visual-ratio-badge[\s\S]*border-radius:\s*999px;/,
    'ratio badges should be overlaid and styled as compact metadata, not body text'
  )
})

test('UI visual artifact generation appends image result into the same Agent conversation', () => {
  const generationStart = appVue.indexOf('async function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    appVue,
    /function appendWorkflowVisualArtifactAgentMessage\(node = \{\}, generationAction = \{\}, options = \{\}\)/,
    'frontend should centralize the generated-image assistant message write-back'
  )
  assert.match(
    generationSource,
    /openWorkflowAgent\(\)[\s\S]*appendWorkflowAgentMessage\('user'[\s\S]*生成高保真图/,
    'clicking generate should open the same Agent and record the user generation request'
  )
  assert.match(
    generationSource,
    /const generatedNode = workflowAgentGeneratedArtifactNode\(data, nodeId\)[\s\S]*appendWorkflowVisualArtifactAgentMessage\(generatedNode,[\s\S]*generationAction/,
    'successful generation should append the hydrated canvas node when the backend returned node lacks the persisted image URL'
  )
  assert.match(
    drawerVue,
    /<AgentVisualArtifactCard[\s\S]*v-if="messageVisualArtifact\(message\)"/,
    'Agent drawer should render generated visual artifacts as image result cards'
  )
  assert.match(
    drawerVue,
    /function messageVisualArtifact\(message = \{\}\)[\s\S]*meta\.visualArtifact/,
    'Agent visual result should come from message meta instead of parsing arbitrary prose'
  )

  assert.match(
    drawerVue,
    /<template v-if="!messageVisualArtifact\(message\) && !visibleMessageLayoutOptions\(message\)\.length && messageContentSegments\(message\)\.length">/,
    'visual artifact messages should render the generated image card instead of dumping the image prompt or screen contract prose'
  )

  assert.doesNotMatch(
    drawerVue,
    /cardProps\.artifact\?\.prompt\s*\?\s*h\('p'/,
    'generated visual image cards should not show the long prompt beneath the image by default'
  )
})

test('HTML stage generation uses workflow stage job polling without restored page asset creation', () => {
  const apiSource = readFileSync(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const ensureStart = appVue.indexOf('async function ensureWorkflowHtmlStageGeneration')
  const ensureEnd = appVue.indexOf('function workflowStageConfirmation', ensureStart)
  const htmlStageSource = appVue.slice(ensureStart, ensureEnd)
  const selectStart = appVue.indexOf('function selectWorkflowStage')
  const selectEnd = appVue.indexOf('function canAdvanceToConfirmedNextStage', selectStart)
  const selectSource = appVue.slice(selectStart, selectEnd)
  const scheduleStart = appVue.indexOf('function scheduleWorkflowStageAutoGeneration')
  const scheduleEnd = appVue.indexOf('function persistWorkflowActiveSlice', scheduleStart)
  const scheduleSource = appVue.slice(scheduleStart, scheduleEnd)

  assert.match(apiSource, /generateHtmlStageArtifacts\(config,\s*runId,\s*payload = \{\}/)
  assert.match(apiSource, /\/api\/workspace\/workflow-runs\/\$\{encodeURIComponent\(runId\)\}\/stages\/html-output\/generate/)
  assert.match(htmlStageSource, /api\.workflows\.generateHtmlStageArtifacts/)
  assert.match(htmlStageSource, /timeoutMs:\s*workflowAgentRequestTimeoutMs\(\)/)
  assert.match(htmlStageSource, /scheduleWorkflowHtmlStagePolling\(run\.id\)/)
  assert.match(appVue, /workflowHtmlStagePollTimer[\s\S]*15000/)
  assert.match(appVue, /api\.workspace\.getWorkflowRun\(state\.apiConfig,\s*runId\)/)
  assert.match(appVue, /function isManualArtifactStageId\(stageId = ''\)[\s\S]*'ui-visual'[\s\S]*'html-output'[\s\S]*'vue-output'/)
  assert.doesNotMatch(selectSource, /stageId === 'html-output'[\s\S]*ensureWorkflowHtmlStageGeneration\(\)/)
  assert.match(scheduleSource, /if \(isManualArtifactStageId\(stageId\)\) return/)
  assert.equal(
    [...appVue.matchAll(/ensureWorkflowHtmlStageGeneration\(/g)].length,
    1,
    'HTML stage generation helper should not be invoked automatically by stage selection, scheduling, or run opening'
  )
  assert.doesNotMatch(htmlStageSource, /restoredPage|upsertRestoredPageFromBackend|selectedRestoredPageId/)
})

test('manual artifact stages open as empty canvases and do not auto-generate on stage selection', () => {
  const renderedStart = appVue.indexOf('function workflowStageCanvasHasRenderedContent')
  const renderedEnd = appVue.indexOf('function inferredWorkflowStageStatuses', renderedStart)
  const renderedSource = appVue.slice(renderedStart, renderedEnd)
  const shouldStart = appVue.indexOf('function shouldAutoGenerateWorkflowStage')
  const shouldEnd = appVue.indexOf('function workflowHtmlNodeHasGeneratedCode', shouldStart)
  const shouldSource = appVue.slice(shouldStart, shouldEnd)
  const canSelectStart = appVue.indexOf('function canSelectWorkflowStage')
  const canSelectEnd = appVue.indexOf('function canAutoGenerateWorkflowStage', canSelectStart)
  const canSelectSource = appVue.slice(canSelectStart, canSelectEnd)

  assert.match(renderedSource, /if \(isManualArtifactStageId\(stageId\)\) return true/)
  assert.match(shouldSource, /if \(isManualArtifactStageId\(stageId\)\) return false/)
  assert.match(canSelectSource, /workflowStageCanvasHasRenderedContent/)
})

test('UI visual artifact generation writes request and result messages to the visible Agent scope', () => {
  const generationStart = appVue.indexOf('async function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    appVue,
    /function isWorkflowAgentWorkbenchStageId\(stageId = ''\)[\s\S]*'ui-visual'/,
    'UI visual canvas actions should use the visible stage Agent session instead of a hidden node-scoped session'
  )

  assert.match(
    appVue,
    /function workflowGenerationAgentScopeId\(nodeId = ''\)[\s\S]*workflowUsesStageAgentScope\.value[\s\S]*workflowCurrentStageId\.value/,
    'generation messages should resolve to the visible stage Agent session when the canvas is in a stage workbench scope'
  )

  assert.match(
    generationSource,
    /const agentScopeId = workflowGenerationAgentScopeId\(nodeId\)/,
    'generation should not write user and pending messages directly to the canvas node session when the drawer is showing a stage session'
  )

  assert.match(
    generationSource,
    /appendWorkflowVisualArtifactAgentMessage\(generatedNode, generationAction, \{ scopeId: agentScopeId \}\)/,
    'successful image generation should append the image card into the same visible Agent session as the request and pending status'
  )

  assert.match(
    appVue,
    /function appendWorkflowVisualArtifactAgentMessage\(node = \{\}, generationAction = \{\}, options = \{\}\)[\s\S]*const scopeId = options\.scopeId \|\| node\.id[\s\S]*removeWorkflowAgentBusyMessages\(scopeId\)[\s\S]*scopeId,/,
    'visual artifact message helper should support writing to a stage-scoped Agent session while keeping the node artifact metadata'
  )
})

test('UI visual artifact generation keeps backend failure status instead of overwriting it as generated', () => {
  const generationStart = appVue.indexOf('async function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    generationSource,
    /const generatedNode = workflowAgentGeneratedArtifactNode\(data, nodeId\)[\s\S]*workflowGeneratedArtifactFailed\(generatedNode\)[\s\S]*throw new Error/,
    'frontend should treat backend-owned failed visual artifacts as failed instead of continuing into generated success handling'
  )

  const generatedNodeIndex = generationSource.indexOf('const generatedNode = workflowAgentGeneratedArtifactNode(data, nodeId)')
  const failedCheckIndex = generationSource.indexOf('workflowGeneratedArtifactFailed(generatedNode)')
  const successPatchIndex = generationSource.indexOf("patchWorkflowCanvasNodeArtifactStatus(nodeId, {\n      artifactStatus: 'generated'")

  assert.ok(generatedNodeIndex >= 0, 'frontend should resolve the generated node before patching success')
  assert.ok(failedCheckIndex > generatedNodeIndex, 'frontend should check backend failure status on the generated node')
  assert.ok(successPatchIndex > failedCheckIndex, 'frontend should only patch generated status after the failure check')
})

test('opening a generated UI visual node repairs empty Agent image artifact messages from the canvas node', () => {
  assert.match(
    appVue,
    /function workflowAgentGeneratedArtifactNode\(data = \{\}, nodeId = ''\)[\s\S]*const returnedNode = data\.node[\s\S]*const currentNode = canvasNodeById\(nodeId\)[\s\S]*workflowVisualPreviewImage\(currentNode\)[\s\S]*return currentNode/,
    'Agent generation should prefer the current hydrated canvas node when it has the generated image URL'
  )

  assert.match(
    appVue,
    /function ensureWorkflowAgentVisualArtifactMessage\(nodeId = '', options = \{\}\)[\s\S]*const scopeId = options\.scopeId \|\| node\.id[\s\S]*ensureWorkflowAgentSession\(scopeId\)[\s\S]*syncWorkflowAgentSessionChange\(scopeId, nextSession\)/,
    'opening a generated visual node should repair persisted visual artifact messages in the visible Agent scope when that scope differs from the node id'
  )

  assert.match(
    appVue,
    /function openWorkflowAgentForNode\(nodeId\) \{[\s\S]*const artifactScopeId = workflowGenerationAgentScopeId\(targetNodeId\)[\s\S]*ensureWorkflowAgentCodeArtifactMessage\(targetNodeId, \{ scopeId: artifactScopeId \}\)[\s\S]*ensureWorkflowAgentVisualArtifactMessage\(targetNodeId, \{ scopeId: artifactScopeId \}\)[\s\S]*openWorkflowAgent\(\)/,
    'node Agent entry should sync generated visual artifacts into the visible stage Agent session'
  )
})

test('HTML and Vue node generation quick actions use the shared artifact generation pipeline', () => {
  assert.match(
    canvasVue,
    /function codeQuickGenerationAction\(node = \{\}, action = ''\)[\s\S]*generationActions\(node\)\.find[\s\S]*targetGenerator[\s\S]*html|function codeQuickGenerationAction\(node = \{\}, action = ''\)[\s\S]*generationActions\(node\)\.find[\s\S]*targetGenerator[\s\S]*vue/,
    'HTML/Vue quick actions should resolve to a node generationAction instead of generic Agent chat'
  )

  assert.match(
    canvasVue,
    /function runNodeQuickAction\(node = \{\}, action = ''\)[\s\S]*visualQuickGenerationAction\(node, action\)[\s\S]*codeQuickGenerationAction\(node, action\)[\s\S]*emit\('quick-action', \{[\s\S]*generationAction/,
    'node quick actions should emit the same generation payload for visual and code artifacts'
  )
})

test('HTML and Vue artifact generation appends code result into the same Agent conversation', () => {
  const generationStart = appVue.indexOf('async function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    appVue,
    /function appendWorkflowGeneratedCodeAgentMessage\(node = \{\}, generationAction = \{\}, options = \{\}\)/,
    'frontend should centralize generated HTML/Vue assistant message write-back'
  )

  assert.match(
    appVue,
    /function workflowCodeArtifactSource\(node = \{\}\)[\s\S]*codePreview[\s\S]*artifact[\s\S]*html/,
    'code artifact source should come from backend node codePreview or artifact HTML'
  )

  assert.match(
    appVue,
    /function isWorkflowRunnableCodeArtifact\(code = '', language = ''\)[\s\S]*Screen Contract[\s\S]*页面契约[\s\S]*asciiWireframe/,
    'generated code source selection should reject upstream screen contracts and ASCII wireframe text'
  )

  assert.match(
    appVue,
    /const orderedCandidates = language === 'html'[\s\S]*artifact\.html[\s\S]*artifact\.code[\s\S]*preview\.code/,
    'HTML generated-code messages should prefer backend artifact HTML before any legacy preview code'
  )

  assert.match(
    appVue,
    /const label = language === 'vue' \? 'Vue 代码' : 'HTML 代码'/,
    'Agent generated-code messages should label copyable HTML as HTML code, not framework notes'
  )

  assert.match(
    appVue,
    /function isWorkflowPlaceholderCodeArtifact\(code = ''\)[\s\S]*根据交互低保与 UI 视觉生成 HTML 页面[\s\S]*根据交互低保与 UI 视觉生成 Vue 页面/,
    'placeholder HTML/Vue shells should be detected instead of being treated as generated code'
  )

  assert.match(
    appVue,
    /function isWorkflowRunnableCodeArtifact\(code = '', language = ''\)[\s\S]*isWorkflowPlaceholderCodeArtifact\(source\)[\s\S]*return false/,
    'Agent generated-code messages should not append the initial placeholder codePreview as a successful code artifact'
  )

  assert.match(
    generationSource,
    /const generatedNode = workflowAgentGeneratedArtifactNode\(data, nodeId\)[\s\S]*if \(workflowCodeArtifactSource\(generatedNode\)\)[\s\S]*appendWorkflowGeneratedCodeAgentMessage\(generatedNode,[\s\S]*generationAction,[\s\S]*\{ scopeId: agentScopeId \}[\s\S]*else[\s\S]*appendWorkflowVisualArtifactAgentMessage\(generatedNode,[\s\S]*generationAction,[\s\S]*\{ scopeId: agentScopeId \}/,
    'successful generation should append code artifacts through the existing Agent code-card renderer and keep image artifacts on the visual path'
  )

  assert.match(
    appVue,
    /function isWorkflowAgentStageSessionScopeId\(stageId = ''\)[\s\S]*'html-output'[\s\S]*'vue-output'/,
    'HTML/Vue stages should use one visible stage Agent session instead of hiding generation messages in node-scoped sessions'
  )

  assert.match(
    appVue,
    /function workflowGenerationAgentScopeId\(nodeId = ''\)[\s\S]*workflowUsesStageAgentScope\.value[\s\S]*workflowCurrentStageId\.value/,
    'HTML/Vue generation requests should resolve to the visible stage Agent scope when that stage is active'
  )

  assert.match(
    appVue,
    /function ensureWorkflowAgentCodeArtifactMessage\(nodeId = '', options = \{\}\)[\s\S]*const scopeId = options\.scopeId \|\| node\.id[\s\S]*ensureWorkflowAgentSession\(scopeId\)[\s\S]*appendWorkflowGeneratedCodeAgentMessage\(node, \{\}, \{ scopeId \}\)/,
    'opening an HTML/Vue node should repair generated code messages into the visible stage Agent scope'
  )

  assert.doesNotMatch(
    generationSource,
    /workflowFullscreenNodeId\.value = nodeId/,
    'regenerating HTML/Vue artifacts should not automatically open the fullscreen detail modal'
  )

  assert.match(
    drawerVue,
    /<AgentCodeCard v-else-if="segment\.type === 'code'"/,
    'generated HTML/Vue should reuse the shared AgentCodeCard renderer'
  )
})

test('Agent HTML and Vue recommendation chips enter the shared code generation conversation', () => {
  const quickReplyStart = appVue.indexOf('function useWorkflowAgentQuickReply')
  const quickReplyEnd = appVue.indexOf('function openWorkflowAgentHistory', quickReplyStart)
  const quickReplySource = appVue.slice(quickReplyStart, quickReplyEnd)

  assert.match(
    appVue,
    /function workflowAgentCodeGenerationQuickAction\(content = '', sourceMessage = null\)[\s\S]*isWorkflowAgentCodeGenerationQuickReply\(normalizedContent\)[\s\S]*findWorkflowGenerationTargetNode/,
    'Agent recommendation buttons such as 生成 HTML/Vue should resolve a backend-owned code target node'
  )

  assert.match(
    appVue,
    /function findWorkflowGenerationTargetNode\(sourceNode = \{\}, targetStageId = ''\)[\s\S]*workflowStageNodesForId\(targetStageId\)[\s\S]*workflowGenerationNodeIdentityKeys/,
    'code generation recommendations should map UI visual messages to the matching HTML/Vue stage node by page identity'
  )

  assert.match(
    quickReplySource,
    /const codeGenerationPayload = workflowAgentCodeGenerationQuickAction\(content, sourceMessage\)[\s\S]*runWorkflowGenerationAction\(codeGenerationPayload\)/,
    'useWorkflowAgentQuickReply should route code recommendations into runWorkflowGenerationAction so user and pending messages appear'
  )

  assert.match(
    quickReplySource,
    /selectWorkflowStage\(codeGenerationPayload\.stageId\)/,
    'clicking an HTML/Vue recommendation from another stage should switch to the target manual artifact stage before generation'
  )
})

test('opening a generated HTML or Vue node syncs its code artifact into the visible Agent session', () => {
  assert.match(
    appVue,
    /function ensureWorkflowAgentCodeArtifactMessage\(nodeId = '', options = \{\}\)[\s\S]*const node = canvasNodeById\(nodeId\)[\s\S]*workflowCodeArtifactSource\(node\)[\s\S]*appendWorkflowGeneratedCodeAgentMessage\(node, \{\}, \{ scopeId \}\)/,
    'opening an existing generated code node should ensure the visible Agent scope has its code artifact message'
  )

  assert.match(
    appVue,
    /function openWorkflowAgentForNode\(nodeId\) \{[\s\S]*const targetNodeId = workflowCanvasResolvableNodeId\(nodeId\)[\s\S]*workflowAgentNodeId\.value = targetNodeId[\s\S]*ensureWorkflowAgentCodeArtifactMessage\(targetNodeId, \{ scopeId: artifactScopeId \}\)[\s\S]*openWorkflowAgent\(\)/,
    'Agent node entry should sync generated code before opening, without creating a stage-specific Agent implementation'
  )
})

test('HTML and Vue output nodes start without fake placeholder source code', () => {
  assert.match(
    totalDesignFlowSource,
    /function codePreviewArtifact\(kind = 'html'\)[\s\S]*code:\s*''/,
    'new HTML/Vue output nodes should not seed placeholder source code before generation succeeds'
  )

  assert.doesNotMatch(
    totalDesignFlowSource,
    /根据交互低保与 UI 视觉生成 HTML 页面|根据交互低保与 UI 视觉生成 Vue 页面/,
    'placeholder code shells should not be used as initial backend-owned code artifacts'
  )
})

test('HTML and Vue pending cards expose generation actions from backend-owned generationActions', () => {
  const actionStart = canvasVue.indexOf('function visibleNodeQuickActions')
  const actionEnd = canvasVue.indexOf('function visualQuickGenerationAction', actionStart)
  const actionSource = canvasVue.slice(actionStart, actionEnd)

  assert.match(actionSource, /if \(isPreviewCodeDetail\(node\) && generationActions\(node\)\.length\)/)
  assert.match(actionSource, /codeQuickGenerationAction\(node, action\)/)
  assert.match(actionSource, /fallbackAction = generationActions\(node\)\[0\]\?\.label/)
})

test('Agent visual generation pending message shows an image placeholder artifact', () => {
  const generationStart = appVue.indexOf('async function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    generationSource,
    /visualArtifact:\s*\{[\s\S]*status:\s*'generating'[\s\S]*targetImageSize:\s*visualGenerationContext\.targetImageSize/,
    'pending Agent message should include visual artifact metadata so the drawer can show a generating image placeholder'
  )

  assert.match(
    drawerVue,
    /const isGenerating = computed\(\(\) =>[\s\S]*cardProps\.artifact\?\.status === 'generating'/,
    'Agent visual artifact card should support generating placeholders without imageUrl'
  )

  assert.match(
    drawerVue,
    /isGenerating\.value[\s\S]*h\('div', \{ class: 'agent-visual-artifact-placeholder'/,
    'Agent visual artifact card should render a placeholder image area while generation is running'
  )
})

test('project-scoped UI visual generation sends project visual context and target ratio to backend', () => {
  const generationStart = appVue.indexOf('async function runWorkflowGenerationAction')
  const generationEnd = appVue.indexOf('async function applyWorkflowAgentSupplement', generationStart)
  const generationSource = appVue.slice(generationStart, generationEnd)

  assert.match(
    appVue,
    /function workflowVisualGenerationContext\(node = \{\}\)[\s\S]*workflowAgentAllowsProjectKnowledge\(\)[\s\S]*buildProjectVisualContext\(\{[\s\S]*assets:\s*scopeItems\(state\.assets, projectId\)[\s\S]*materials:\s*scopeItems\(state\.knowledge, projectId\)[\s\S]*projectVisualContext/,
    'frontend should build project visual context from project knowledge tabs/prototype screenshots only for project-scoped runs'
  )

  assert.match(
    generationSource,
    /const visualGenerationSourceNode = canvasNodeById\(nodeId\) \|\| \{\}[\s\S]*const visualGenerationContext = workflowVisualGenerationContext\(visualGenerationSourceNode\)/,
    'generation should derive visual context from the current node before calling backend'
  )

  assert.match(
    generationSource,
    /projectVisualContext:\s*visualGenerationContext\.projectVisualContext[\s\S]*targetAspectRatio:\s*visualGenerationContext\.targetAspectRatio/,
    'backend artifact generation payload should include project visual context and target aspect ratio'
  )

  assert.match(
    appVue,
    /function workflowVisualArtifactMessagePayload\(node = \{\}, generationAction = \{\}\)[\s\S]*aspectRatio:\s*workflowVisualAspectRatioLabel\(node\)/,
    'Agent result card metadata should carry the generated node aspect ratio'
  )
})

test('UI visual generation uses app and web target dimensions when no explicit ratio exists', () => {
  const contextStart = appVue.indexOf('function workflowVisualGenerationContext')
  const contextEnd = appVue.indexOf('function appendWorkflowGeneratedCodeAgentMessage', contextStart)
  const contextSource = appVue.slice(contextStart, contextEnd)

  assert.match(
    appVue,
    /function workflowVisualTargetPreset\(node = \{\}\)[\s\S]*width:\s*1920[\s\S]*surface:\s*'web'[\s\S]*width:\s*375[\s\S]*surface:\s*'app'/,
    'frontend should infer app and web target image widths for image generation without fixing height'
  )

  assert.match(
    appVue,
    /targetAspectRatio:\s*visualGenerationContext\.targetAspectRatio[\s\S]*targetImageSize:\s*visualGenerationContext\.targetImageSize/,
    'frontend artifact generation payload should include ratio metadata and target width'
  )

  assert.doesNotMatch(
    appVue,
    /targetImageSize:\s*\{\s*width:\s*targetPreset\.width,\s*height:\s*targetPreset\.height\s*\}/,
    'frontend should not send a fixed target image height for app or web UI visual generation'
  )

  assert.match(
    appVue,
    /targetImageSize:\s*\{\s*width:\s*targetPreset\.width\s*\}/,
    'frontend should send only the target image width so height can follow the generated image ratio'
  )

  assert.match(
    contextSource,
    /const targetAspectRatio = workflowVisualAspectRatioLabel\(node\)/,
    'frontend should send explicit ratio metadata only when the backend/model supplied it on the node'
  )

  assert.doesNotMatch(
    contextSource,
    /targetPreset\.aspectRatio/,
    'frontend should not inject a default 1920:1080 or 375:812 ratio when the generation contract is width-only'
  )
})


test('workflow stage canvas merge preserves generated UI visual images', () => {
  assert.match(
    appVue,
    /function workflowVisualNodeIdentityKeys\(node = \{\}\)[\s\S]*sourcePageId[\s\S]*pageId[\s\S]*normalizeWorkflowVisualNodeTitle/,
    'frontend generated visual preservation should match renamed nodes by stable page identity, not only node id'
  )

  assert.match(
    appVue,
    /function preserveGeneratedWorkflowVisualArtifactsInCanvas\(currentCanvas = \{\}, incomingCanvas = \{\}\)[\s\S]*visualPreview:\s*node\.visualPreview[\s\S]*artifactStatus:\s*preserved\.artifactStatus/,
    'frontend stage canvas merges should preserve generated UI visual image artifacts by page identity when fresh stage output is pending'
  )

  assert.match(
    appVue,
    /function mergeWorkflowStageCanvasEvent\(currentAnalysis = \{\}, payload = \{\}\)[\s\S]*preserveGeneratedWorkflowVisualArtifactsInCanvas\([\s\S]*currentTotalFlow\?\.stageCanvases\?\.\['ui-visual'\][\s\S]*incomingTotalFlow\.stageCanvases\?\.\['ui-visual'\]/,
    'incoming ui-visual stage canvases should pass through the generated-image preservation guard before replacing current state'
  )
})

test('HTML output canvas cards render the generated page while Agent keeps source display', () => {
  const cardStart = canvasVue.indexOf('<article\n              v-for="node in displayNodes"')
  const cardEnd = canvasVue.indexOf('<div v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls"', cardStart)
  const cardSource = canvasVue.slice(cardStart, cardEnd)
  const detailStart = canvasVue.indexOf('<div v-else-if="isPreviewCodeDetail(fullscreenNode)"')
  const detailEnd = canvasVue.indexOf('<div v-else-if="isAcceptanceDepositDetail(fullscreenNode)"', detailStart)
  const detailSource = canvasVue.slice(detailStart, detailEnd)
  const quickHelperStart = canvasVue.indexOf('function visibleNodeQuickActionLabel')
  const quickHelperEnd = canvasVue.indexOf('function nodeDetailText', quickHelperStart)
  const quickHelperSource = canvasVue.slice(quickHelperStart, quickHelperEnd)

  assert.match(
    cardSource,
    /isPreviewCodeDetail\(node\)[\s\S]*class="preview-code-card-preview"[\s\S]*previewCodeSrcdoc\(node\)[\s\S]*title="HTML 画布渲染预览"[\s\S]*iframe/,
    'HTML/Vue stage canvas cards should render the generated page through the same backend-owned HTML artifact'
  )

  assert.match(
    canvasVue,
    /function isPreviewCodeDetail\(node = \{\}\)[\s\S]*node\?\.stageId === 'html-output'[\s\S]*node\?\.stageId === 'vue-output'[\s\S]*targetGenerator/,
    'legacy HTML/Vue nodes should still render as preview-code cards even when detailLayout is missing'
  )

  assert.doesNotMatch(
    cardSource,
    /class="preview-code-card-source-only"|canvasCodePreviewSource\(node\)|class="preview-code-card-editor-head"|copyCodePreview\(node\)|downloadCodePreview\(node\)|class="preview-code-card-editor-tools"/,
    'HTML/Vue stage canvas cards should not show source-editor UI because source belongs in Agent and the fullscreen source pane'
  )

  assert.match(
    canvasVue,
    /const height = visualNode[\s\S]*previewCodeNode \? 292/,
    'HTML/Vue stage canvas nodes should normalize to the same 292px card height as interaction-lofi page cards instead of the taller visual-card height'
  )

  assert.match(
    quickHelperSource,
    /const codeGenerationAction = codeQuickGenerationAction\(node, action\)[\s\S]*if \(codeGenerationAction\) return codeGenerationButtonLabel\(node, codeGenerationAction\)/,
    'HTML/Vue stage quick actions should show 重新生成 HTML/Vue instead of reusing the high-fidelity image label'
  )

  assert.match(
    canvasVue,
    /function codeGenerationButtonLabel\(node = \{\}, action = \{\}\)[\s\S]*重新生成 Vue[\s\S]*重新生成 HTML/,
    'code generation labels should be stage-specific and never say 重新生成保真图'
  )

  assert.match(
    detailSource,
    /class="preview-code-result-card"[\s\S]*data-preview-code-tab="render"[\s\S]*HTML 渲染[\s\S]*data-preview-code-tab="source"[\s\S]*源码展示/,
    'fullscreen preview-code detail should use engineering-style tabs for render and source views'
  )

  assert.match(
    detailSource,
    /data-preview-code-panel="render"[\s\S]*v-for="width in \[390, 768, 1440\]"[\s\S]*preview-code-size-button[\s\S]*previewCodeFrameWidth\(fullscreenNode\)/,
    'fullscreen render tab should expose 390/768/1440 preview size switching'
  )

  assert.match(
    detailSource,
    /class="generated-preview-frame"[\s\S]*sandbox="allow-forms allow-scripts"/,
    'fullscreen render tab should allow generated HTML demo scripts and forms like the engineering preview shell'
  )

  assert.match(
    detailSource,
    /data-preview-code-panel="source"[\s\S]*source-project-layout[\s\S]*generated-source-code[\s\S]*selectedCodePreviewCode\(fullscreenNode\)/,
    'fullscreen source tab should show the generated HTML source in a project-like source layout'
  )

  assert.match(
    detailSource,
    /v-if="codePreviewFiles\(fullscreenNode\)\.length"[\s\S]*source-project-layout[\s\S]*v-if="selectedCodePreviewCode\(fullscreenNode\)\.trim\(\)"[\s\S]*generated-source-code[\s\S]*v-else[\s\S]*preview-code-source-empty[\s\S]*待生成源码/,
    'fullscreen source tab should show a clean empty state instead of rendering pending summaries or escaped placeholder text as code'
  )

  assert.match(
    canvasVue,
    /function previewCodeSrcdoc\(node = \{\}\)[\s\S]*generatedHtmlCodeForPreview\(node\)[\s\S]*withPreviewCodeFitStyle/,
    'HTML iframe preview should only render validated generated HTML, not summary or pending placeholder text'
  )

  assert.doesNotMatch(
    canvasVue,
    /function compactCodePreview\(node = \{\}\)[\s\S]*previewSummary[\s\S]*等待生成 HTML/,
    'compact code preview should not fall back to previewSummary because that leaks non-code text into copy/download/source paths'
  )

  assert.match(
    detailSource,
    /runFullscreenGenerationAction\(fullscreenNode, action\)[\s\S]*codeGenerationButtonLabel\(fullscreenNode, action\)/,
    'fullscreen HTML/Vue generation actions should use code-specific regenerate labels'
  )

  assert.doesNotMatch(
    detailSource,
    /class="preview-code-render"[\s\S]*class="preview-code-source"/,
    'fullscreen preview-code detail should no longer render the old side-by-side render/source layout'
  )

  assert.match(
    stylesSource,
    /\.canvas-node-card\.preview-code-node[\s\S]*min-height:\s*292px;[\s\S]*overflow:\s*hidden;[\s\S]*\.preview-code-card-preview[\s\S]*min-height:\s*132px;[\s\S]*border:\s*1px solid #dfe3e8;[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*#fff;[\s\S]*\.preview-code-card-frame iframe[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/,
    'HTML/Vue canvas cards should match interaction-lofi card height and render generated HTML inside a bounded iframe preview'
  )

  assert.match(
    drawerVue,
    /<AgentCodeCard v-else-if="segment\.type === 'code'"[\s\S]*:language="segment\.language"[\s\S]*:code="segment\.text"/,
    'Agent should keep generated HTML/Vue source display on the shared code-card path'
  )
})

test('Agent hides duplicate confirm-to-canvas when apply-to-canvas recommendation is visible', () => {
  const quickReplyStart = appVue.indexOf('function useWorkflowAgentQuickReply')
  const quickReplyEnd = appVue.indexOf('async function copyWorkflowAgentMessage', quickReplyStart)
  const quickReplySource = appVue.slice(quickReplyStart, quickReplyEnd)

  assert.match(
    drawerVue,
    /function normalizeVisibleQuickReply\(reply = ''\)[\s\S]*生成低保真[\s\S]*应用到画布/,
    'drawer should normalize legacy low-fi generation recommendations into the single apply-to-canvas action'
  )

  assert.match(
    drawerVue,
    /quickReplies[\s\S]*\.map\(normalizeVisibleQuickReply\)/,
    'visible recommendations should pass through the quick-reply normalizer before rendering'
  )

  assert.match(
    drawerVue,
    /function isApplyToCanvasRecommendation\(reply = ''\)[\s\S]*应用到画布/,
    'drawer should centralize detection of apply-to-canvas recommendations'
  )

  assert.match(
    drawerVue,
    /function messageHasApplyToCanvasRecommendation\(message\)[\s\S]*visibleMessageRecommendations\(message\)\.some\(isApplyToCanvasRecommendation\)/,
    'drawer should inspect the current assistant message recommendations for apply-to-canvas'
  )

  assert.match(
    drawerVue,
    /function canConfirmMessage\(message\)[\s\S]*if \(messageHasApplyToCanvasRecommendation\(message\)\) return false/,
    'confirm-to-canvas should be hidden when the model already offers 应用到画布'
  )

  assert.match(
    appVue,
    /function confirmWorkflowAgentApplyToCanvasRecommendation\(content = '', sourceMessage = null\)[\s\S]*normalizedContent !== '应用到画布'[\s\S]*proposalId[\s\S]*confirmWorkflowAgentMessage/,
    'plain 应用到画布 recommendations should confirm the source proposal instead of sending a new chat prompt'
  )

  assert.match(
    appVue,
    /function confirmWorkflowAgentApplyToCanvasRecommendation\(content = '', sourceMessage = null\)[\s\S]*workflowAnalysisResult\.value\?\.totalDesignFlow[\s\S]*applyWorkflowAgentStageSupplement\(\{[\s\S]*stageId:\s*workflowCurrentStageId\.value[\s\S]*confirmedContent:\s*sourceContent/,
    'apply-to-canvas without a proposal should refresh the current total-flow stage instead of patching only the legacy root canvas'
  )

  assert.match(
    appVue,
    /function confirmWorkflowAgentApplyToCanvasRecommendation\(content = '', sourceMessage = null\)[\s\S]*applyWorkflowAgentSupplement\(\{[\s\S]*type:\s*'agent-supplement'[\s\S]*confirmedContent:\s*sourceContent/,
    'legacy non-total-flow apply-to-canvas should still refresh the current canvas from the source assistant content instead of sending a chat message'
  )

  assert.match(
    quickReplySource,
    /if \(confirmWorkflowAgentLayoutOption\(content, sourceMessage\)\) return[\s\S]*if \(confirmWorkflowAgentApplyToCanvasRecommendation\(content, sourceMessage\)\) return[\s\S]*if \(/,
    'apply-to-canvas recommendation should be handled before generic quick-reply routing'
  )

  assert.match(
    appVue,
    /async function confirmWorkflowAgentMessage\(message\)[\s\S]*workflowCanvasLoading\.value = true[\s\S]*workflowCanvasRefreshingNodeId\.value = targetNodeId[\s\S]*appendWorkflowAgentMessage\('assistant', selectedLayoutLabel \? `正在应用/,
    'confirming apply-to-canvas should put the current canvas node/stage into a refreshing state'
  )

  assert.match(
    appVue,
    /async function applyWorkflowAgentStageSupplement\(payload = \{\}\)[\s\S]*recordWorkflowStageConfirmation\(\{[\s\S]*summary:\s*confirmedContent[\s\S]*workflowCanvasLoading\.value = true[\s\S]*await regenerateWorkflowStage\(stageId\)/,
    'stage apply-to-canvas should record the source assistant content as current-stage context before regenerating that stage'
  )
})

test('requirement dissection recommendations stay model-authored and do not force stage advance', () => {
  assert.match(
    drawerVue,
    /function isRequirementDissectionAgentScope\(\)[\s\S]*requirement-dissection[\s\S]*需求分析/,
    'drawer should know when recommendations belong to the requirement analysis stage'
  )

  const visibleQuickReplyNormalizer = drawerVue.slice(
    drawerVue.indexOf('function normalizeVisibleQuickReply'),
    drawerVue.indexOf('const visibleReferences')
  )
  assert.match(
    visibleQuickReplyNormalizer,
    /if \(\/生成低保真\|转低保真画布\|低保真画布\/\.test\(normalized\)\) return '应用到画布'/,
    'drawer should keep the generic low-fi to apply-to-canvas compatibility for non-requirement stages'
  )
  assert.doesNotMatch(
    visibleQuickReplyNormalizer,
    /进入交互低保/,
    'drawer should not rewrite requirement-stage model recommendations into a fixed stage-advance action'
  )

  assert.deepEqual(
    normalizeRequirementDissectionQuickReplies(['应用到画布', '生成低保真', '继续拆用户路径', '进入交互低保', '输出页面框架'], 6),
    ['应用到画布', '生成低保真', '继续拆用户路径'],
    'requirement-stage quick replies should preserve model-authored operations and drop legacy fixed stage-advance labels'
  )
  assert.match(
    workbenchSource,
    /function normalizeRequirementDissectionQuickReplyLabel\(reply = ''\)[\s\S]*return REQUIREMENT_DISSECTION_LEGACY_STAGE_ADVANCE_REPLIES\.includes\(normalized\)[\s\S]*\? ''[\s\S]*: normalized/,
    'saved requirement analysis quick replies should remove legacy fixed stage-advance labels instead of rewriting model operations'
  )

  assert.match(
    appVue,
    /function normalizeRequirementDissectionRunQuickReplies\(run = \{\}\)[\s\S]*normalizeRequirementDissectionQuickReplies\(replies, 6\)[\s\S]*function recordWorkflowStageConfirmation/,
    'stage confirmation should clean historical requirement-analysis quick replies before persisting the run'
  )

  assert.match(
    appVue,
    /const nextRun = normalizeRequirementDissectionRunQuickReplies\(\{[\s\S]*documentAnalysis: nextAnalysis[\s\S]*updatedAt: confirmation\.confirmedAt[\s\S]*\}\)/,
    'entering interaction lofi should not re-save stale requirement-analysis labels such as 生成低保真'
  )
})

test('layout plan recommendations render three visual comparable candidates', () => {
  assert.match(
    drawerVue,
    /@click="\$emit\('quick-reply', recommendation, message\)"/,
    'assistant recommendation clicks should include the source message so layout option choices can confirm the right proposal'
  )

  assert.match(
    drawerVue,
    /function visibleMessageRecommendations\(message\)[\s\S]*isLayoutOptionsProposalMessage\(message\)[\s\S]*slice\(0,\s*4\)/,
    'layout option proposals should show select 1/2/3 plus regenerate instead of truncating to three chips'
  )

  assert.match(
    drawerVue,
    /AgentLayoutOptionsCard[\s\S]*visibleMessageLayoutOptions\(message\)[\s\S]*class: 'agent-layout-options-list'/,
    'layout plan proposals should render the three candidate framework options as a vertical comparable list, not a three-column grid'
  )

  assert.match(
    drawerVue,
    /AgentLayoutOptionsCard[\s\S]*:comparison-rows="visibleMessageLayoutComparisonRows\(message\)"/,
    'layout plan proposals should pass backend/model comparison rows into the specialized renderer'
  )

  assert.match(
    drawerVue,
    /class: 'agent-layout-comparison-table'[\s\S]*布局方案对比[\s\S]*class: 'agent-layout-option-plain'/,
    'layout plan proposals should render a comparison matrix before plain per-option explanations'
  )

  assert.match(
    drawerVue,
    /class: 'agent-layout-option-style'[\s\S]*设计调性/,
    'layout option details should expose the product/design tone when the backend returns one'
  )

  assert.match(
    drawerVue,
    /function visibleMessageLayoutComparisonRows\(message = \{\}\)[\s\S]*writeableContent\.layoutComparisonRows[\s\S]*writeableContent\.comparisonRows[\s\S]*fallbackLayoutComparisonRows/,
    'layout comparison rows should come from backend/model writeableContent with a frontend structural fallback'
  )

  assert.match(
    drawerVue,
    /function layoutOptionFrameText\(option = \{\}\)[\s\S]*option\.frameworkRows[\s\S]*option\.sharedFramework[\s\S]*option\.pageFramework[\s\S]*option\.wireframeRows[\s\S]*option\.layout[\s\S]*┌/,
    'layout option cards should prefer model/backend same-page framework rows before falling back to generic layout rows'
  )

  assert.match(
    drawerVue,
    /function layoutOptionFrameworkText\(option = \{\}\)[\s\S]*option\.pageLayoutArtifact\?\.asciiWireframe[\s\S]*option\.asciiWireframe[\s\S]*option\.frameworkRows[\s\S]*option\.pageFramework[\s\S]*option\.wireframeRows/,
    'layout option details should render the same backend/model page skeleton fields that the canvas uses'
  )

  assert.match(
    drawerVue,
    /class:\s*'agent-layout-option-prose'[\s\S]*layoutOptionExplanationBlocks\(option\)[\s\S]*AgentPlainMarkdown/,
    'layout option explanation should stay as plain prose instead of being wrapped in a candidate card'
  )

  assert.match(
    drawerVue,
    /h\(AgentPageLayoutCard,\s*\{[\s\S]*class:\s*'agent-layout-option-framework-card'[\s\S]*blocks:\s*layoutOptionFrameworkBlocks\(option\)/,
    'layout option framework should reuse the copyable page-layout card wrapper'
  )

  assert.match(
    drawerVue,
    /function layoutOptionFrameworkBlocks\(option = \{\}\)[\s\S]*pageLayoutArtifactWireframeText\(text,\s*'页面框架'\)/,
    'layout option framework cards should reuse the same page-layout wireframe conversion as canvas artifacts instead of showing rough pipe text'
  )

  assert.match(
    drawerVue,
    /layoutOptionExplanationBlocks\(option\)[\s\S]*AgentPlainMarkdown/,
    'layout option explanation should stay as plain prose outside the framed skeleton card'
  )

  assert.match(
    stylesSource,
    /\.agent-layout-option-plain[\s\S]*\.agent-layout-option-prose[\s\S]*\.agent-layout-option-framework-card/,
    'layout option proposals should style prose and copyable framework blocks separately'
  )

  assert.doesNotMatch(
    drawerVue,
    /class: 'agent-layout-option-details'/,
    'layout option proposals should not wrap each scheme in a details/card container'
  )

  assert.doesNotMatch(
    stylesSource,
    /\.agent-layout-options-grid[\s\S]*grid-template-columns:\s*repeat\(3/,
    'layout option proposals should not use the old three-column side-by-side grid'
  )

  assert.match(
    appVue,
    /function useWorkflowAgentQuickReply\(content,\s*sourceMessage = null\)[\s\S]*confirmWorkflowAgentLayoutOption\(content, sourceMessage\)/,
    'quick reply handler should route layout option selection into the existing canvas confirmation flow'
  )

  assert.match(
    appVue,
    /selectedLayoutOptionId:\s*selectedOption\.id/,
    'confirm payload should include the selected layout option id for backend write-back'
  )

  assert.match(
    drawerVue,
    /function isLegacyLayoutOptionsMessage\(message = \{\}\)[\s\S]*旧规则[\s\S]*按新规则重生成/,
    'old layout proposal messages should show an explicit regenerate affordance instead of looking like the latest layout renderer'
  )

  assert.match(
    drawerVue,
    /agent-layout-legacy-notice[\s\S]*按新规则重生成/,
    'legacy layout proposals should render a small notice with a regenerate action'
  )

  assert.match(
    appVue,
    /function selectedWorkflowAgentLayoutOptionFromMessage\(message = \{\}\)[\s\S]*layoutStyle[\s\S]*layoutOptionTitle/,
    'frontend should keep the selected layout option metadata for loading and success feedback'
  )

  assert.match(
    appVue,
    /selectedLayoutOption:\s*selectedWorkflowAgentLayoutOptionFromMessage\(message\)/,
    'confirm request metadata should include the selected layout option summary'
  )

  assert.match(
    appVue,
    /workflowCanvasRefreshingLayoutLabel\.value = selectedLayoutOptionLabel\(message\.meta\?\.selectedLayoutOption\)/,
    'confirming a layout option should put the canvas into a layout-specific refreshing state'
  )
})

test('workflow agent routes natural requests for more options to layout plan regeneration', () => {
  assert.match(
    appVue,
    /function isWorkflowAgentLayoutAlternativeRequest\(content = ''\)[\s\S]*还有其他方案[\s\S]*换一批[\s\S]*再来/,
    'natural wording such as 还有其他方案吗 should be recognized as a request for more layout options'
  )

  assert.match(
    appVue,
    /function isWorkflowAgentLayoutPlanInputScope\(scopeId = ''\)[\s\S]*workflowCurrentStageId\.value[\s\S]*interaction-lofi[\s\S]*pageLayoutArtifact/,
    'natural layout option requests should only reroute when the active context is an interaction-lofi page wireframe'
  )

  assert.match(
    appVue,
    /async function sendWorkflowAgentMessage\(text = workflowAgentInput\.value, options = \{\}\)[\s\S]*isWorkflowAgentLayoutAlternativeRequest\(content\)[\s\S]*sendWorkflowAgentCanvasAction\('给布局方案', contextNodeId\)/,
    'typed requests for more layout options should use the same canvas action path while keeping node context separate from the Agent session'
  )
})

test('workflow agent only reroutes more-options wording after structured layout options exist', () => {
  assert.match(
    appVue,
    /function hasRecentWorkflowAgentLayoutOptions\(scopeId = ''\)[\s\S]*ensureWorkflowAgentSession\(scopeId\)[\s\S]*workflowAgentLayoutOptionsFromMessage\(message\)\.length >= 3/,
    'natural more-options wording should only be treated as layout regeneration when the recent Agent history has structured layoutOptions'
  )

  assert.match(
    appVue,
    /async function sendWorkflowAgentMessage\(text = workflowAgentInput\.value, options = \{\}\)[\s\S]*isWorkflowAgentLayoutAlternativeRequest\(content\)[\s\S]*isWorkflowAgentLayoutPlanInputScope\(contextNodeId\)[\s\S]*hasRecentWorkflowAgentLayoutOptions\(targetScopeId\)[\s\S]*sendWorkflowAgentCanvasAction\('给布局方案', contextNodeId\)/,
    'without recent structured layout options in the shared stage Agent session, wording such as 还有其他方案吗 should remain an ordinary Agent chat message'
  )
})

test('workflow agent prose parser supports Chinese numbered sections and dot bullets', () => {
  assert.match(
    drawerVue,
    /\\d\+\[）\)\][\s\S]*·/,
    'agent markdown parser should detect Chinese numbered sections and dot bullets as structured prose'
  )

  assert.match(
    drawerVue,
    /const numberedSection = raw\.match\([\s\S]*\\d\+\)\[）\)\][\s\S]*blocks\.push\(\{ type: 'h3'/,
    'Chinese numbered sections such as 1） should render as section headings, not collapse into one paragraph'
  )

  assert.match(
    drawerVue,
    /const dotList = raw\.match\([\s\S]*·[\s\S]*listItems\.push/,
    'Chinese dot bullets should render as list items in the plain explanation text'
  )

  assert.match(
    drawerVue,
    /function normalizeAgentReadableLongText\(content = ''\)[\s\S]*项目事实[\s\S]*模型推断[\s\S]*方案\\s\*\[A-Z一二三四五六\]/,
    'long Chinese assistant prose should be split around evidence labels and方案 markers instead of staying as one dense paragraph'
  )

  assert.match(
    drawerVue,
    /const schemeSection = raw\.match\([\s\S]*方案\\s\*\[A-Z一二三四五六\][\s\S]*blocks\.push\(\{ type: 'h3'/,
    'scheme markers such as 方案 D「搜索优先型」 should render as scan-friendly headings'
  )
})

test('layout plan proposal cards are scoped to interaction-lofi only', () => {
  assert.match(
    drawerVue,
    /function isInteractionLofiAgentScope\(\)[\s\S]*props\.activeNode\?\.stageId === 'interaction-lofi'[\s\S]*props\.session\?\.scopeId === 'interaction-lofi'/,
    'drawer should know whether the active Agent context belongs to interaction-lofi'
  )

  assert.match(
    drawerVue,
    /function visibleMessageLayoutOptions\(message = \{\}\)[\s\S]*if \(!isInteractionLofiAgentScope\(\)\) return \[\][\s\S]*return messageLayoutOptions\(message\)/,
    'layout option cards should not render on UI visual, HTML, Vue, or acceptance stages'
  )

  assert.match(
    drawerVue,
    /function isLayoutOptionsProposalMessage\(message = \{\}\)[\s\S]*visibleMessageLayoutOptions\(message\)\.length >= 3/,
    'layout quick replies should follow the same interaction-lofi scoping as the visual cards'
  )
})

test('workflow canvas version history popover closes when clicking blank area', () => {
  assert.match(
    canvasVue,
    /const versionMenuRef = ref\(null\)/,
    'version history menu should keep a ref for outside-click detection'
  )

  assert.match(
    canvasVue,
    /<div ref="versionMenuRef" class="workflow-version-menu">/,
    'version history menu ref should wrap both the trigger and popover'
  )

  assert.match(
    canvasVue,
    /function handleCanvasGlobalPointerDown\(event\)[\s\S]*const menu = versionMenuRef\.value[\s\S]*menu\.contains\(event\.target\)[\s\S]*showVersionHistory\.value = false/,
    'clicking outside the version history menu should close the popover'
  )

  assert.match(
    canvasVue,
    /onMounted\(\(\) => \{[\s\S]*document\.addEventListener\('pointerdown', handleCanvasGlobalPointerDown\)[\s\S]*\}\)/,
    'canvas page should register a global pointerdown listener'
  )

  assert.match(
    canvasVue,
    /onBeforeUnmount\(\(\) => \{[\s\S]*document\.removeEventListener\('pointerdown', handleCanvasGlobalPointerDown\)[\s\S]*\}\)/,
    'canvas page should clean up the global pointerdown listener'
  )
})

test('interaction page tool entries route to Agent canvas advice when clicked or replied', () => {
  const classifierStart = appVue.indexOf('function isWorkflowAgentCanvasAdviceQuickReply')
  const classifierEnd = appVue.indexOf('function runWorkflowNodeQuickAction', classifierStart)
  const classifierSource = appVue.slice(classifierStart, classifierEnd)

  assert.match(
    classifierSource,
    /给布局方案\|补交互细节\|重生成本页/,
    'fixed interaction page tool entries should be classified as Agent canvas advice'
  )
})

test('workflow agent expands short proposal messages from proposal summary metadata', () => {
  assert.match(
    drawerVue,
    /function expandedProposalMessageContent\(message = \{\}\)[\s\S]*proposalSummary\.writeableContent[\s\S]*downstreamImpact/,
    'assistant messages with short content should render the full proposal summary metadata'
  )
  assert.match(
    drawerVue,
    /function messageContent\(message\)[\s\S]*const rawText = rawFirstAgentMessageText\(message\)[\s\S]*expandedProposalMessageContent\(message\) \|\| rawText \|\| compactWorkflowJsonMarkdownContent\(message\?\.content\)/,
    'main message content should prefer proposal expansion, then raw model text, then structured fallback summaries'
  )
})

test('workflow agent formats structured model JSON into readable chat content', () => {
  assert.match(
    drawerVue,
    /function formatStructuredAgentMessageContent\(content = ''\)/,
    'assistant JSON content should pass through a structured readable formatter'
  )

  assert.match(
    drawerVue,
    /requirement_type:\s*'需求类型'/,
    'structured formatter should map internal snake_case keys to user-facing labels'
  )

  assert.match(
    drawerVue,
    /pending_questions:\s*'待确认问题'[\s\S]*recommended_next_step:\s*'建议下一步'/,
    'common model output keys should be localized instead of shown as English headings'
  )

  assert.match(
    drawerVue,
    /sections:\s*'分析章节'[\s\S]*qualityReport:\s*'质量报告'[\s\S]*missing_information:\s*'缺失信息'/,
    'analysis JSON keys from model output should be localized instead of leaking English field names'
  )

  assert.match(
    drawerVue,
    /detectedIntent:\s*'识别意图'[\s\S]*routingReason:\s*'路由原因'/,
    'routing metadata should be localized when it is rendered as fallback structured content'
  )

  assert.match(
    drawerVue,
    /function isStructuredAgentCodeKey\(key = ''\)/,
    'structured formatter should preserve code-like fields instead of flattening them into prose'
  )

  assert.match(
    drawerVue,
    /segments\.push\(\{ type: 'code', language: section\.codeLanguage \|\| section\.title \|\| 'code', text: section\.code \}\)/,
    'structured code fields should render through code card segments'
  )

  assert.match(
    drawerVue,
    /if \(isStructuredAgentInternalKey\(key\)\) return/,
    'internal stage identifiers should not be shown in the main chat'
  )

  assert.match(
    drawerVue,
    /return sanitizeAgentMessageDisplayContent\(expandedProposalMessageContent\(message\) \|\| rawText \|\| compactWorkflowJsonMarkdownContent\(message\?\.content\) \|\| primaryStructuredAgentMarkdownContent\(formatStructuredAgentMessageContent\(message\?\.content\)\) \|\| structuredAgentPlainText\(formatStructuredAgentMessageContent\(message\?\.content\)\) \|\| normalizeRawAgentMessageText\(message\?\.content\) \|\| String\(message\?\.content \?\? ''\)\)/,
    'main message content should prefer proposal expansion, rawContent, structured fallback summaries, then normalized message.content before raw string fallback'
  )

  assert.match(
    drawerVue,
    /function normalizeRawAgentMessageText\(content = ''\)[\s\S]*displayKeys = \['displayContent', 'reply', 'content', 'markdown', 'text', 'answer', 'message'\]/,
    'rawContent restored after refresh should unwrap model JSON envelopes before display'
  )

  assert.match(
    drawerVue,
    /return sanitizeAgentMessageDisplayContent\(normalizeRawAgentMessageText\(rawContent\) \|\| normalizeRawAgentMessageText\(parsedContent\)\)/,
    'raw-first display should normalize rawContent and parsedContent before it can override message.content'
  )

  assert.match(
    drawerVue,
    /normalizeRawAgentMessageText\(message\?\.content\)[\s\S]*String\(message\?\.content \?\? ''\)/,
    'assistant message.content JSON envelopes should be unwrapped before the raw string fallback can display them'
  )

  assert.match(
    stylesSource,
    /\.agent-message-text[\s\S]*font-family:\s*inherit;[\s\S]*font-size:\s*17px;[\s\S]*line-height:\s*1\.72;/,
    'formatted assistant content should render as normal prose instead of raw monospace JSON'
  )
})

test('structured agent content renders markdown hierarchy and hides internal fields', () => {
  assert.match(
    drawerVue,
    /if \(structured\.title\) lines\.push\(`# \$\{structured\.title\}`\)/,
    'structured content should render the model title as a markdown h1'
  )

  assert.match(
    drawerVue,
    /lines\.push\('', `## \$\{section\.title\}`\)/,
    'structured sections should render as markdown h2 headings'
  )

  assert.match(
    drawerVue,
    /const STRUCTURED_AGENT_INTERNAL_KEYS = \[[\s\S]*'stage'[\s\S]*'id'[\s\S]*'key'[\s\S]*'schema'[\s\S]*'schemaVersion'[\s\S]*'version'[\s\S]*\]/,
    'structured formatter should centralize hidden internal keys'
  )

  assert.match(
    drawerVue,
    /if \(isStructuredAgentInternalKey\(key\)\) return null/,
    'top-level internal fields should not become visible sections'
  )

  assert.match(
    drawerVue,
    /\.filter\(\(\[key\]\) => !isStructuredAgentInternalKey\(key\)\)/,
    'nested internal fields should not leak inside bullet text'
  )
})

test('workflow agent rich content keeps raw text fallback and only upgrades validated blocks', () => {
  assert.match(
    drawerVue,
    /AGENT_CONTENT_RENDER_SAFETY_CONTRACT/,
    'the renderer should document the raw-content fallback and validated-upgrade contract'
  )

  assert.match(
    drawerVue,
    /function hasRenderableAgentSegments\(segments = \[\]\)/,
    'assistant rendering should validate parsed segments before replacing raw model text'
  )

  assert.match(
    drawerVue,
    /rawSegments = hasRenderableAgentSegments\(rawSegments\)[\s\S]*: titledMarkdownSegment\('文本', rawText\)/,
    'non-empty raw model text should always fall back to a text card instead of rendering blank'
  )

  assert.match(
    drawerVue,
    /function tableSegmentIsRenderable\(segment = \{\}\)/,
    'table cards should be gated by table-shape validation'
  )

  assert.match(
    drawerVue,
    /headers\.length >= 2 && rows\.length >= 1/,
    'a table should require at least two headers and one data row'
  )

  assert.match(
    drawerVue,
    /function inferPlaintextFrameTitle\(text = '', fallbackTitle = '文本'\)/,
    'plaintext code-like blocks should infer structure/framework/page-frame titles from stable text evidence'
  )

  const codeKeyStart = drawerVue.indexOf("function isStructuredAgentCodeKey(key = '')")
  const codeKeyEnd = drawerVue.indexOf('function isStructuredAgentMarkdownKey', codeKeyStart)
  const codeKeySource = drawerVue.slice(codeKeyStart, codeKeyEnd)
  assert.doesNotMatch(
    codeKeySource,
    /plaintext\|text/,
    'generic plaintext/text structured fields should stay ordinary prose unless their content clearly looks like a frame'
  )

  assert.match(
    drawerVue,
    /const primarySection = structured\.sections\?\.find\(\(section\) =>[\s\S]*\['正文', '回答', '回复', '文本'\]\.includes\(section\?\.title\)/,
    'a top-level plaintext/text JSON field should render as unframed prose instead of a visible 文本 card'
  )

  assert.match(
    drawerVue,
    /const normalizedKey = String\(key \|\| ''\)\.trim\(\)\.toLowerCase\(\)[\s\S]*\/\^\(plaintext\|text\|plain text\)\$\/\.test\(normalizedKey\)[\s\S]*inferPlaintextFrameTitle\(value, '文本'\)/,
    'generic plaintext should not stay as an English title and should only upgrade to tree/framework/page-frame when evidence exists'
  )

  assert.match(
    drawerVue,
    /if \(!hasRenderableAgentSegments\(overlaySegments\)\) return rawSegments/,
    'plain prose containing the word 表格 should remain text unless parsed table structure is valid'
  )

  assert.match(
    drawerVue,
    /function structuredAgentCodeLanguage\(key = '', title = '代码'\)/,
    'code-like structured sections should normalize their visible card title through a dedicated helper'
  )

  assert.match(
    drawerVue,
    /structuretree\|treestructure\|sitemap/,
    'tree-like structured keys including structureTree should render with a visible 结构树 title instead of 文本 or plaintext'
  )

  assert.match(
    drawerVue,
    /framework\|frameworklayer\|architecture/,
    'framework-like structured keys including frameworkLayer should still be detected before being normalized into page layout artifacts'
  )

  assert.match(
    drawerVue,
    /codeLanguage:\s*structuredAgentCodeLanguage\(key, title\)/,
    'structured code cards should use the display-safe title helper instead of raw language labels'
  )

  assert.match(
    drawerVue,
    /function markdownHeadingCardTitle\(block = \{\}\)/,
    'markdown h2/h3 headings should drive card titles instead of wrapping the whole answer as 文本'
  )

  assert.match(
    drawerVue,
    /if \(block\?\.type === 'h2'\) \{[\s\S]*flushMarkdown\(\)[\s\S]*markdownTitle = markdownHeadingCardTitle\(block\)/,
    'a new h2 section should flush the previous card and start a separate content card'
  )

  assert.match(
    drawerVue,
    /function markdownHeadingCardTitle\(block = \{\}\)[\s\S]*结构树[\s\S]*框架层/,
    'structure-tree headings should be upgraded to a 结构树 card title'
  )
})

test('workflow prompts require display-safe Chinese cards while preserving raw content fallback', () => {
  const promptBuilderSource = readFileSync(join(process.cwd(), 'backend/services/prompt-builder.js'), 'utf8')

  assert.match(
    promptBuilderSource,
    /displayBlocks/,
    'backend prompts should give the model an optional displayBlocks contract for typed presentation'
  )

  assert.match(
    promptBuilderSource,
    /只约束展示外壳，不约束业务内容字段/,
    'backend prompts should keep the presentation protocol stable without freezing business fields'
  )

  assert.match(
    promptBuilderSource,
    /不要为了展示而强制输出 currentRequirement、goal、outputType、structureTree 这类固定业务字段/,
    'backend prompts should avoid turning model output into a rigid business-field template'
  )

  assert.match(
    promptBuilderSource,
    /rawContent/,
    'backend prompts should require preserving rawContent as fallback text'
  )

  assert.match(
    promptBuilderSource,
    /业务主结构优先包含这些字段/,
    'compact smart-canvas prompts should not exclude rawContent/displayBlocks by saying only fixed business fields are allowed'
  )

  assert.match(
    promptBuilderSource,
    /displayBlocks: 可选；只放表格、结构树、代码等展示增强块[\s\S]*page-layout-artifact/,
    'displayBlocks should not encourage framework/page skeleton cards; page layouts should use page-layout-artifact'
  )

  assert.match(
    promptBuilderSource,
    /用户可见标题必须使用中文/,
    'backend prompts should explicitly ban user-visible English block titles'
  )

  assert.match(
    promptBuilderSource,
    /plaintext|schema|id|key|stage/,
    'backend prompts should explicitly mention internal keys that must not leak to users'
  )
})

test('workflow agent improves framed tree and framework markdown into readable diagrams', () => {
  assert.match(
    drawerVue,
    /function markdownHeadingLooksLikePageTitle\(text = ''\)/,
    'page-like headings such as 购物车页 and 订单确认页 should be recognized without fixing business fields'
  )

  assert.match(
    drawerVue,
    /function markdownBlocksLookLikePageFramework\(blocks = \[\], title = ''\)/,
    'page title plus layout-like module lists should be upgraded as output framework blocks'
  )

  assert.match(
    drawerVue,
    /购物车页\|订单确认页\|订单页/,
    'cart and order page headings should be recognized as page framework titles'
  )

  assert.match(
    drawerVue,
    /function framedMarkdownBlocks\(blocks = \[\], title = '文本'\)/,
    'framed markdown should be normalized before rendering so cards do not show a loose heading plus bullets pile'
  )

  assert.match(
    drawerVue,
    /function markdownBlocksToFrameText\(blocks = \[\], title = '文本'\)/,
    'special cards should convert heading/list markdown into preformatted tree-like text'
  )

  assert.match(
    drawerVue,
    /function markdownBlocksHaveLayoutEvidence\(blocks = \[\], title = ''\)/,
    'page-like headings should only become framed page skeletons when the list content has layout evidence'
  )

  assert.match(
    drawerVue,
    /function treeTextLooksLikePageLayout\(text = ''\)/,
    'tree-shaped text with top/left/right/floating/bottom page regions should be recognized as a page layout'
  )

  assert.match(
    drawerVue,
    /function pageLayoutTreeToWireframeText\(text = '', title = '页面骨架'\)/,
    'page-layout trees should be converted into wireframe-style boxes instead of being shown as raw hierarchy'
  )

  const frameTextStart = drawerVue.indexOf("function markdownBlocksToFrameText(blocks = [], title = '文本')")
  const frameTextEnd = drawerVue.indexOf("function treeTextLooksLikePageLayout(text = '')", frameTextStart)
  const frameTextSource = drawerVue.slice(frameTextStart, frameTextEnd)
  const preserveWireframeIndex = frameTextSource.indexOf('if (textLooksLikeWireframeBoxes(sourceText) && textLooksLikePageLayoutWireframe(sourceText)) return sourceText')
  const fallbackLayoutIndex = frameTextSource.indexOf('return pageLayoutTreeToWireframeText(sourceText, title)')
  assert.ok(
    preserveWireframeIndex >= 0 && fallbackLayoutIndex > preserveWireframeIndex,
    'markdown frame normalization should preserve real page-layout wireframes before using fallback page-layout conversion'
  )

  assert.match(
    drawerVue,
    /const hasSideBySideLayout =/,
    'fallback page skeleton conversion should choose a layout form instead of always forcing the same two-column diagram'
  )

  assert.match(
    drawerVue,
    /return renderStackedWireframe\(\)/,
    'single-page skeletons such as store, cart, and order pages should render as stacked wireframes when they are not left-right layouts'
  )

  assert.match(
    drawerVue,
    /treeTextLooksLikePageLayout\(value\)[\s\S]*return '页面骨架'/,
    'page-layout tree text should be classified as 页面骨架 before generic structure tree detection'
  )

  assert.match(
    drawerVue,
    /index === items\.length - 1 \? '└─' : '├─'/,
    'frame text should use tree branches for list items inside structure/framework cards'
  )

  assert.match(
    drawerVue,
    /blocks:\s*isPageLayoutArtifact[\s\S]*shouldUseFrame[\s\S]*markdownBlocks/,
    'agent markdown segmentation should split page-layout artifacts, framed structure blocks, and ordinary markdown without wrapping all text'
  )

  assert.match(
    drawerVue,
    /建议\|风险\|待确认\|结论/,
    'generic prose sections should be excluded from page-framework framing'
  )

  assert.match(
    drawerVue,
    /function compactWorkflowJsonStructuredContent\(content = ''\)/,
    'smart-canvas JSON should be converted into structured display segments instead of losing framework text in a compact markdown summary'
  )

  assert.match(
    drawerVue,
    /sections\.push\(\.\.\.frameSections\)/,
    'framework/page-skeleton sections inside model groups and nodes should survive as framed cards'
  )

  assert.match(
    drawerVue,
    /if \(compactStructured\) return compactStructured/,
    'smart-canvas structured conversion should run before markdown compaction so special cards are preserved'
  )

  const wireframeBranchIndex = drawerVue.indexOf('if (/(┌|┐|┘|┬|┴|┼)/.test(value)) return')
  const treeBranchIndex = drawerVue.indexOf('if (/(├|└|│|─|页面结构树|信息架构树|结构树)/.test(value)) return')
  assert.ok(
    wireframeBranchIndex >= 0 && treeBranchIndex > wireframeBranchIndex,
    'box-drawing wireframes should be classified before tree branches so page skeletons are not mislabeled as structure trees'
  )
})

test('workflow agent progress details stay collapsed until clicked and show disclosure arrows', () => {
  assert.match(
    drawerVue,
    /<details v-if="messageTraceItems\(message\)\.length && !isMessageBusy\(message\)" class="agent-trace-disclosure">[\s\S]*<summary class="agent-trace-summary">[\s\S]*<ChevronDown/,
    'trace progress should render as a collapsed disclosure with an arrow'
  )

  assert.match(
    drawerVue,
    /<summary class="agent-proposal-evidence-summary">[\s\S]*<span>提案依据<\/span>[\s\S]*<ChevronDown/,
    'proposal evidence should show an arrow in its summary row'
  )

  assert.match(
    appVue,
    /const pendingMessageId = appendWorkflowAgentMessage\('assistant',\s*workflowAgentPendingAssistantContent\(\),/,
    'pending assistant messages should reserve a stream target without showing fake local copy as model content'
  )

  assert.match(
    appVue,
    /placeholderOnly:\s*true/,
    'pending assistant messages should be marked as placeholder-only until real model content arrives'
  )

  assert.doesNotMatch(
    appVue,
    /正在连接模型，马上开始回复\.\.\.|正在生成 Agent 回复\.\.\./,
    'local connection/generation copy should not appear as assistant message text'
  )

  assert.match(
    appVue,
    /workflowAgentPendingScopeId\.value = targetScopeId\s*scrollWorkflowAgentToBottomTick\(\)/,
    'sending a message should scroll to the immediate pending feedback'
  )
})

test('workflow agent renders page layout artifacts as light bordered cards', () => {
  assert.match(
    drawerVue,
    /AGENT_PAGE_LAYOUT_ARTIFACT_CONTRACT/,
    'drawer should document the page layout artifact rendering contract'
  )

  assert.match(
    drawerVue,
    /function pageLayoutArtifactSegments\(content = ''\)/,
    'drawer should parse explicit page-layout-artifact blocks from model replies'
  )

  assert.match(
    drawerVue,
    /return \{\s*text:\s*'',\s*segments\s*\}/,
    'when an artifact exists, the Agent should render only the artifact result block and hide extra model prose'
  )

  assert.match(
    drawerVue,
    /:::\s*page-layout-artifact/,
    'drawer parser should recognize the explicit artifact marker used by backend prompts'
  )

  assert.match(
    drawerVue,
    /normalizePageLayoutArtifactMarkers\(content\)/,
    'drawer should repair clipped page-layout artifact markers before parsing so protocol text is not shown as prose'
  )

  assert.match(
    drawerVue,
    /replace\(\s*\/\(\^\|\\n\)\\s\*\\\.\\\.\\\.\\s\*page-layout-artifact\/g/,
    'drawer should recognize historical messages where ::: was normalized into ...'
  )

  assert.match(
    drawerVue,
    /class:\s*'agent-page-layout-card'/,
    'page layout artifacts should use a dedicated light card class instead of generic code cards'
  )

  assert.match(
    drawerVue,
    /class:\s*'agent-page-layout-pre'/,
    'page layout wireframes should render through a dedicated pre element instead of the generic markdown code block'
  )

  assert.match(
    drawerVue,
    /function pageLayoutArtifactStructuredBlocks\(text = '', title = '页面骨架'\)/,
    'page layout artifacts should split ## model/wireframe/interaction/handoff sections before rendering'
  )

  assert.match(
    drawerVue,
    /type:\s*'page-layout-section'/,
    'page layout artifact sections should use a dedicated render block type'
  )

  assert.match(
    drawerVue,
    /kind === 'wireframe'[\s\S]*agent-page-layout-wireframe-wrap/,
    'ASCII wireframe sections should render inside the page-layout artifact body instead of naked prose'
  )

  assert.match(
    drawerVue,
    /const fallbackArtifactResult = firstArtifactResult\.segments\.length[\s\S]*pageLayoutArtifactSegments\(messageContent\(message\)\)/,
    'artifact markers persisted in message.content should still be parsed into the page-layout card instead of falling through to markdown'
  )

  assert.match(
    stylesSource,
    /\.agent-page-layout-section[\s\S]*border:\s*0;[\s\S]*\.agent-page-layout-pre[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;/,
    'page layout artifact sections should avoid nested card borders; only the outer artifact card frames the result'
  )

  assert.match(
    drawerVue,
    /expandable:\s*true/,
    'page layout artifact cards should enable a real fullscreen preview action'
  )

  assert.match(
    drawerVue,
    /class:\s*'agent-content-card-expanded-backdrop'[\s\S]*cardProps\.title \|\| displayTitle\.value/,
    'page layout card fullscreen should render an actual expanded preview'
  )

  assert.match(
    drawerVue,
    /title:\s*'放大预览'[\s\S]*h\(ScanSearch,\s*\{ class:\s*'ui-icon'/,
    'page layout card fullscreen action should use the requested preview icon'
  )

  assert.match(
    drawerVue,
    /components:\s*\{ Copy,\s*Download,\s*FileDown,\s*ScanSearch,\s*X \}/,
    'structured Agent cards should share the same copy/download/pdf/preview icon set'
  )

  assert.match(
    drawerVue,
    /title:\s*'复制内容'[\s\S]*title:\s*'下载内容'[\s\S]*title:\s*'下载 PDF'[\s\S]*title:\s*'放大预览'/,
    'structured Agent card actions should keep a consistent copy, download, pdf, preview order with hover labels'
  )

  assert.doesNotMatch(
    drawerVue,
    /h\(ArrowRight,\s*\{ class:\s*'ui-icon'[\s\S]*cardProps\.actionLabel/,
    'page layout card header should not keep the old inert arrow action'
  )

  assert.match(
    drawerVue,
    /function pageLayoutArtifactSegment\(title = '页面骨架', text = ''\)/,
    'legacy framework/page skeleton content should be normalized into the same page-layout artifact segment'
  )

  assert.match(
    drawerVue,
    /function pageLayoutArtifactWireframeText\(text = '', title = '页面骨架'\)/,
    'plain framework paragraphs inside page-layout artifacts should be converted into ASCII wireframes with box-drawing symbols'
  )

  assert.match(
    drawerVue,
    /wireframe\/i\.test\(text\)/,
    'english headings like ascii Wireframe should also be normalized into page layout artifacts'
  )

  assert.match(
    drawerVue,
    /ascii wireframe\|page wireframe\|layout/,
    'english page layout artifact titles should not fall through to ordinary markdown'
  )

  assert.match(
    drawerVue,
    /function textLooksLikePageLayoutWireframe\(text = ''\)/,
    'page layout artifacts should distinguish real page-space wireframes from raw trees or flow arrows'
  )

  assert.match(
    drawerVue,
    /textLooksLikeWireframeBoxes\(body\) && textLooksLikePageLayoutWireframe\(body\)/,
    'artifact conversion should only preserve existing ASCII when it has page layout regions, not just any line characters'
  )

  assert.match(
    drawerVue,
    /页面线框兜底：顶部固定导航 \+ 主体内容区 \+ 底部固定操作/,
    'fallback wireframes should render an actual page layout instead of a pure hierarchy skeleton'
  )

  assert.match(
    drawerVue,
    /const artifactSegment = pageLayoutArtifactSegment\(title \|\| '页面骨架', body\)[\s\S]*if \(artifactSegment\) segments\.push\(artifactSegment\)/,
    'explicit page-layout-artifact model replies should be normalized through the ASCII wireframe generator before rendering'
  )

  assert.match(
    drawerVue,
    /textLooksLikePageLayoutWireframe\(body\)[\s\S]*pageLayoutParagraphsToWireframeText\(body, title\)/,
    'existing page-layout ASCII wireframes should be preserved while raw trees and paragraph-only content get a generated wireframe'
  )

  assert.match(
    drawerVue,
    /isPageLayoutArtifactKind\(frameKind\)[\s\S]*pageLayoutArtifactSegment\(frameKind, text\)/,
    'old frameworkLayer/pageSkeleton/wireframe display blocks should not render as generic frame cards'
  )

  assert.match(
    drawerVue,
    /textLooksLikeImplicitPageLayoutArtifact\(text, titleText\)/,
    'natural markdown replies that contain page layout wireframe sections should be upgraded into the page-layout artifact card'
  )

  assert.match(
    stylesSource,
    /\.agent-page-layout-card[\s\S]*background:\s*#fff;/,
    'page layout card should use a light background'
  )

  assert.match(
    stylesSource,
    /\.agent-page-layout-card[\s\S]*border:\s*1px solid #d9dde3;/,
    'page layout card should keep the bordered container style from the requested reference'
  )

  assert.match(
    stylesSource,
    /\.agent-page-layout-card-body[\s\S]*max-height:\s*min\(52vh,\s*560px\);[\s\S]*overflow:\s*auto;/,
    'long page layout framework content should scroll inside the card body'
  )

  assert.match(
    stylesSource,
    /\.agent-copy-toast[\s\S]*position:\s*fixed;[\s\S]*top:\s*50%;[\s\S]*transform:\s*translate\(-50%,\s*-50%\);/,
    'copy feedback should use the existing centered toast treatment'
  )

  assert.match(
    stylesSource,
    /\.agent-page-layout-pre[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;/,
    'page layout wireframes should not create an inner bordered box inside the artifact card'
  )

  assert.match(
    stylesSource,
    /\.agent-table-card th,\s*\.agent-table-card td[\s\S]*padding:\s*12px 16px;[\s\S]*font-size:\s*13px;/,
    'Agent table cells should use the compact 12px/16px spacing instead of the old oversized layout'
  )

  assert.doesNotMatch(
    stylesSource,
    /\.agent-page-layout-card-body \.agent-markdown-pre[\s\S]*border:\s*1px/,
    'page layout card body should not restyle generic markdown pre into a nested inner box'
  )

  const removedBrandPattern = new RegExp('DOU' + 'BAO_RENDERING_CONTRACT|豆' + '包|Dou' + 'bao|dou' + 'bao')
  assert.doesNotMatch(
    drawerVue,
    removedBrandPattern,
    'workflow drawer source should not expose the removed brand-style wording'
  )
})

test('workflow agent pending state uses pure text trace without fake assistant text', () => {
  assert.match(
    appVue,
    /function workflowAgentPendingAssistantContent\(\)\s*\{\s*return ''\s*\}/,
    'pending assistant messages should not inject fake loading text'
  )

  assert.match(
    appVue,
    /placeholderOnly:\s*true/,
    'pending assistant messages should be placeholder-only until the model returns content'
  )

  assert.match(
    drawerVue,
    /meta\.placeholderOnly && !content\) return !isMessageBusy\(message\)/,
    'placeholder-only pending messages must remain visible while busy'
  )

  assert.doesNotMatch(
    drawerVue,
    /agent-thinking-dots|agent-dot-loader/,
    'pending state should not use the old three-dot loading logic'
  )

  assert.match(
    drawerVue,
    /const traceTypewriterText = ref\(''\)[\s\S]*function restartTraceTypewriter\(\)/,
    'pending text should keep the typewriter effect'
  )

  assert.match(
    stylesSource,
    /\.agent-thinking-loader[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;/,
    'busy messages should use pure text pending treatment'
  )

  assert.match(
    drawerVue,
    /function shouldShowThinkingLoader\(message = \{\}\)/,
    'pending visibility should be centralized so streamed content can replace the processing line immediately'
  )

  assert.match(
    drawerVue,
    /return isMessageBusy\(message\) && !messageContent\(message\)\.trim\(\)/,
    'the processing loader should only show before any model content has arrived'
  )

  assert.match(
    drawerVue,
    /v-else-if="shouldShowThinkingLoader\(message\)"/,
    'busy messages with streamed content should fall through to normal content cards'
  )

  assert.doesNotMatch(
    drawerVue,
    /正在处理：\$\{running\.label/,
    'the visible stuck processing sentence should not be rendered while waiting'
  )
})

test('workflow agent streaming failure asks user to retry without partial content', () => {
  const streamStart = appVue.indexOf('function workflowAgentStreamFailureContent')
  const streamEnd = appVue.indexOf('function setWorkflowAgentDisplayMode', streamStart)
  const streamSource = appVue.slice(streamStart, streamEnd)

  assert.match(
    streamSource,
    /function workflowAgentStreamFailureContent\(fallbackMessage = ''\)/,
    'stream failure should use a retry-only helper'
  )
  assert.match(
    streamSource,
    /workflowAgentStreamFailureContent\(event\.data\?\.message \|\| 'Agent 流式生成失败'\)/,
    'server error events should not preserve partial stream content'
  )
  assert.match(
    streamSource,
    /if \(!result\?\.ok && options\.pendingMessageId && result\?\.status !== 'cancelled'\)[\s\S]*const failureMessage = result\?\.message \|\| 'Agent 请求失败'[\s\S]*workflowAgentStreamFailureContent\(failureMessage\)/,
    'network or fallback request failures should ask users to retry'
  )
  assert.doesNotMatch(
    streamSource,
    /生成中断|已保留已生成内容|本次消息已保留/,
    'failed Agent replies should not claim partial content was preserved'
  )
  assert.match(
    streamSource,
    /workflowAgentTraceFromProgress\('intent', '需求识别', 'done', '已接收用户问题。'\)[\s\S]*workflowAgentTraceFromProgress\('answer', '回答\/提案', 'running', '正在连接后端并请求模型...'\)/,
    'frontend should advance the trace immediately while waiting for backend/model events'
  )
})

test('workflow agent keeps streamed deltas internal until the final assistant message arrives', () => {
  const streamStart = appVue.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appVue.indexOf('function setWorkflowAgentDisplayMode', streamStart)
  const streamSource = appVue.slice(streamStart, streamEnd)

  assert.doesNotMatch(
    appVue,
    /const workflowAgentStreamDeltaQueues = new Map\(\)/,
    'frontend should not keep a queue for displaying interim deltas in the main reply'
  )

  assert.doesNotMatch(
    appVue,
    /function enqueueWorkflowAgentStreamDelta\([\s\S]*flushWorkflowAgentStreamDeltaQueue/,
    'stream deltas should not enqueue before final answer display'
  )

  assert.doesNotMatch(
    appVue,
    /function flushWorkflowAgentStreamDeltaQueue\([\s\S]*slice\(0,\s*Math\.min\(queue\.pending\.length,\s*18\)\)[\s\S]*replaceWorkflowAgentMessage/,
    'queued delta flushing should not write interim text into the main reply'
  )

  assert.doesNotMatch(
    streamSource,
    /enqueueWorkflowAgentStreamDelta\(\{[\s\S]*messageId:\s*options\.pendingMessageId[\s\S]*fullContent:\s*event\.data\?\.preview \? deltaContent : visibleStreamContent/,
    'SSE delta handling should not route visible model content through the frontend display queue'
  )

  assert.doesNotMatch(
    streamSource,
    /flushWorkflowAgentStreamDeltaQueue\(\{[\s\S]*force:\s*true/,
    'final message merge should not flush queued stream text into the pending message'
  )

  assert.doesNotMatch(
    appVue,
    /function stopWorkflowAgentGeneration\(\)[\s\S]*clearWorkflowAgentStreamDeltaQueue\(workflowAgentPendingMessageId\.value,\s*pendingScopeId\)[\s\S]*replaceWorkflowAgentMessage\(workflowAgentPendingMessageId\.value/,
    'cancelling a generation should not need to clear visible delta queues'
  )
})

test('workflow agent merge drops local pending once backend reply exists for the same request', () => {
  const mergeStart = appVue.indexOf('function mergeWorkflowAgentLocalSessionIntoRun')
  const mergeEnd = appVue.indexOf('function applyWorkflowAgentPersistedResult', mergeStart)
  const mergeSource = appVue.slice(mergeStart, mergeEnd)

  assert.match(
    mergeSource,
    /function localPendingMessageIsCoveredByIncomingReply/,
    'merge should centralize the check for backend replies that supersede local pending messages'
  )

  assert.match(
    mergeSource,
    /localPendingMessages\.forEach\(\(localMessage\) => \{[\s\S]*if \(localPendingMessageIsCoveredByIncomingReply\(localMessage, incomingSession\)\) return/,
    'local pending/generating assistant messages should not be re-added after backend persisted the same request'
  )

  assert.match(
    mergeSource,
    /if \(localPendingMessageIsCoveredByIncomingReply\(localMessage, incomingSession\)\) return incomingMessage/,
    'incoming persisted assistant content should win over local pending/generating messages for the same request'
  )

  assert.match(
    mergeSource,
    /status:\s*incomingMessage\.meta\?\.status \|\| localMessage\.meta\?\.status[\s\S]*optimistic:\s*false/,
    'merge metadata should keep the backend assistant status instead of preserving local pending status'
  )
})

test('workflow agent treats missing final assistant message as retryable failure', () => {
  const sendStart = appVue.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appVue.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appVue.slice(sendStart, sendEnd)

  assert.doesNotMatch(
    sendSource,
    /const hasVisibleStreamedReply = Boolean\(workflowAgentMessageText\(workflowAgentMessageById\(pendingMessageId, targetScopeId\)\)\.trim\(\)\)/,
    'send flow should not treat visible streamed content as a completed assistant answer'
  )

  assert.doesNotMatch(
    sendSource,
    /if \(hasVisibleStreamedReply && !backendHandled && !recoveredFromRun && !streamEventState\.failed\)/,
    'missing backend assistant message should not finalize frontend streamed content'
  )

  assert.match(
    sendSource,
    /workflowAgentStreamFailureContent\(failureView\.message\)/,
    'missing final assistant messages should show a retryable failure message'
  )
})

test('workflow agent image uploads auto-send and render as user message attachments', () => {
  const importStart = appVue.indexOf('async function importWorkflowAgentFiles')
  const importEnd = appVue.indexOf('async function removeWorkflowAgentReference', importStart)
  const importSource = appVue.slice(importStart, importEnd)
  const sendStart = appVue.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appVue.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appVue.slice(sendStart, sendEnd)

  assert.match(
    importSource,
    /const shouldAutoSendUploadedImages = uploadedReferences\.some\(\(file\) => file\.kind === 'image' && file\.status === 'ready'\)/,
    'image uploads should be detected as ready attachments that can trigger an automatic Agent send'
  )
  assert.match(
    importSource,
    /void sendWorkflowAgentMessage\([\s\S]*skipEmptyContentForAttachments:\s*true[\s\S]*attachmentIds:/,
    'image uploads should route through the shared Agent send path instead of only persisting an upload note'
  )
  assert.doesNotMatch(
    importSource,
    /persistWorkflowAgentMessage\(\{[\s\S]*已上传 \$\{files\.length\} 个参考文件/,
    'uploading files should not create a separate upload-summary chat message before the real user turn'
  )
  assert.match(
    sendSource,
    /const pendingAttachments = workflowAgentPendingMessageAttachments\(targetScopeId, options\.attachmentIds\)/,
    'send flow should snapshot current uploaded references as attachments for the outgoing user message'
  )
  assert.match(
    sendSource,
    /\.\.\.\(pendingAttachments\.length \? \{ attachments: pendingAttachments \} : \{\}\)/,
    'user message metadata should carry uploaded image/document attachments for rendering'
  )
  assert.match(
    drawerVue,
    /<div v-if="messageAttachments\(message\)\.length" class="agent-message-attachments"/,
    'user message bubbles should render attachment previews above the text'
  )
  assert.match(
    drawerVue,
    /<img v-if="attachmentPreview\(attachment\)" :src="attachmentPreview\(attachment\)" :alt="attachmentName\(attachment, attachmentIndex\)" \/>/,
    'image attachments should render their preview data url in the sent user message'
  )
})

test('workflow agent assistant content uses plain fallback except structured layout proposals', () => {
  assert.match(
    drawerVue,
    /function messageContentSegments\(message = \{\}\)/,
    'assistant content should be normalized into one shared segment pipeline'
  )

  assert.match(
    drawerVue,
    /const blocks = agentMarkdownRenderableBlocks\(text\)/,
    'plain text should still render as markdown-card blocks instead of becoming empty'
  )

  assert.doesNotMatch(
    drawerVue,
    /<pre v-else class="agent-typewriter-text">/,
    'assistant replies should no longer fall through to the old raw pre/textwriter renderer'
  )

  assert.match(
    drawerVue,
    /<template v-if="!messageVisualArtifact\(message\) && !visibleMessageLayoutOptions\(message\)\.length && messageContentSegments\(message\)\.length">/,
    'assistant segment rendering should skip duplicate long text when structured layout options or visual artifacts use dedicated renderers'
  )

  assert.match(
    drawerVue,
    /<AgentPlainMarkdown v-else-if="!messageVisualArtifact\(message\) && messageRole\(message\) !== 'user' && messageContent\(message\)\.trim\(\)" :blocks="agentMarkdownRenderableBlocks\(messageContent\(message\)\)" \/>/,
    'non-empty assistant text must render as plain markdown fallback instead of a framed text card'
  )
})

test('workflow agent treats fenced text blocks as prose instead of code cards', () => {
  assert.match(
    drawerVue,
    /function isPlainTextAgentCodeLanguage\(language = ''\)/,
    'plain text code-fence language detection should be centralized'
  )

  assert.match(
    drawerVue,
    /if \(isPlainTextAgentCodeLanguage\(codeLanguage\)\) \{[\s\S]*blocks\.push\(\{ type: 'p', text: value \}\)[\s\S]*return/,
    '```text and ```plaintext blocks should be merged back into markdown prose'
  )

  assert.match(
    drawerVue,
    /if \(block\?\.type === 'code' && isPlainTextAgentCodeLanguage\(block\.language\)\) \{[\s\S]*markdownBlocks\.push\(\{ type: 'p', text: block\.text \|\| '' \}\)[\s\S]*return/,
    'plaintext code blocks that reach card segmentation should not render through AgentCodeCard'
  )
})

test('workflow agent uses raw-first display overlay instead of replacing model text', () => {
  assert.match(
    drawerVue,
    /function rawFirstAgentMessageText\(message = \{\}\)/,
    'assistant rendering should centralize rawContent-first text selection'
  )

  assert.match(
    drawerVue,
    /rawContent[\s\S]*modelParsedContent/,
    'rawContent should be preferred before parsed model summaries'
  )

  assert.match(
    drawerVue,
    /function displayBlockSegments\(blocks = \[\]\)/,
    'displayBlocks should be converted into overlay segments without replacing raw text'
  )

  assert.match(
    drawerVue,
    /const overlaySegments = displayBlockSegments\(structuredDisplayBlocks\(message\)\)/,
    'message content segments should append displayBlocks as an overlay track'
  )

  assert.match(
    drawerVue,
    /return mergeRawFirstOverlaySegments\(rawSegments, artifactAndOverlaySegments, rawText\)/,
    'raw text segments and artifact/display overlay segments should merge without dropping raw text'
  )

  assert.match(
    drawerVue,
    /if \(!hasRenderableAgentSegments\(overlaySegments\)\) return rawSegments/,
    'invalid displayBlocks should not replace or blank the model raw text'
  )

  assert.match(
    drawerVue,
    /if \(!text && hasRenderableAgentSegments\(artifactAndOverlaySegments\)\) return artifactAndOverlaySegments/,
    'valid artifacts and displayBlocks should still render when rawContent is absent'
  )
})

test('workflow agent renders ordinary markdown as prose and only frames special blocks', () => {
  assert.match(
    drawerVue,
    /const AgentPlainMarkdown =/,
    'ordinary markdown should have a prose renderer outside framed cards'
  )

  assert.match(
    drawerVue,
    /<AgentPlainMarkdown v-if="segment\.type === 'markdown'"/,
    'normal markdown segments should render as unframed prose'
  )

  assert.match(
    drawerVue,
    /const isPageLayoutArtifact = shouldUseFrame && markdownBlocksShouldUsePageLayoutArtifact\(markdownBlocks, markdownTitle\)/,
    'markdown should only become a page-layout artifact after explicit page-layout evidence, not because ordinary prose mentions modules or buttons'
  )

  assert.match(
    drawerVue,
    /<AgentTableCard v-else-if="segment\.type === 'table'"/,
    'validated markdown tables should still render as framed table cards'
  )

  assert.match(
    drawerVue,
    /<AgentCodeCard v-else-if="segment\.type === 'code'"/,
    'code/html/vue blocks should still render as framed code cards'
  )

  assert.match(
    drawerVue,
    /const displayLanguage = computed\(\(\) => codeLanguageLabel\(cardProps\.language\)\)/,
    'code-card titles should keep the literal lowercase language label such as html in the shared Agent renderer'
  )

  assert.match(
    drawerVue,
    /<AgentMarkdownCard v-else-if="segment\.type === 'frame'"/,
    'structure trees can still render as framed cards while page layout results use page-layout artifacts'
  )
})

test('workflow agent renders backend evidence pack as a compact disclosure', () => {
  assert.match(
    drawerVue,
    /<details v-if="messageEvidencePack\(message\)" class="agent-evidence-pack"/,
    'assistant messages with backend evidencePack metadata should render a dedicated evidence disclosure'
  )

  assert.match(
    drawerVue,
    /<summary class="agent-evidence-pack-summary">[\s\S]*证据包[\s\S]*messageEvidencePackConfidence\(message\)/,
    'evidence disclosure should expose the backend confidence label'
  )

  assert.match(
    drawerVue,
    /v-for="item in messageEvidenceSources\(message\)"/,
    'evidence disclosure should render backend-provided evidence sources'
  )

  assert.match(
    drawerVue,
    /function messageEvidencePack\(message = \{\}\)/,
    'evidence pack parsing should be centralized in a helper'
  )

  assert.match(
    drawerVue,
    /function messageEvidenceSources\(message = \{\}\)/,
    'evidence source rendering should use backend metadata rather than frontend-authored business content'
  )
})

test('workflow agent avoids rendering duplicate evidence disclosures when evidence pack exists', () => {
  assert.match(
    drawerVue,
    /<details v-if="messageKnowledgeItems\(message\)\.length && !messageEvidencePack\(message\)" class="agent-knowledge-evidence"/,
    'project knowledge details should not duplicate the unified evidence pack disclosure'
  )

  assert.match(
    drawerVue,
    /<details v-if="\(\s*messageProposalEvidence\(message\)\.rationale\.length \|\| messageProposalEvidence\(message\)\.contextSources\.length\s*\) && !messageEvidencePack\(message\)" class="agent-proposal-evidence"/,
    'proposal evidence details should not duplicate the unified evidence pack disclosure'
  )

  assert.match(
    drawerVue,
    /const knowledgeCount = !messageEvidencePack\(message\) \? messageKnowledgeItems\(message\)\.length : 0/,
    'metadata chips should not show project knowledge again when evidence pack is present'
  )
})

test('workflow agent renders backend data lookup status as a compact disclosure', () => {
  assert.match(
    drawerVue,
    /<details v-if="messageDataLookups\(message\)\.length" class="agent-data-lookups"/,
    'assistant messages with backend dataLookups metadata should render a data lookup disclosure'
  )

  assert.match(
    drawerVue,
    /<summary class="agent-data-lookups-summary">[\s\S]*数据查询[\s\S]*messageDataLookupStatusLabel\(message\)/,
    'data lookup disclosure should summarize backend lookup status'
  )

  assert.match(
    drawerVue,
    /v-for="item in messageDataLookups\(message\)"/,
    'data lookup rows should come from backend-provided dataLookups'
  )

  assert.match(
    drawerVue,
    /function messageDataLookups\(message = \{\}\)/,
    'data lookup parsing should be centralized in a helper'
  )
})

test('workflow agent renders backend answer evaluation as a compact disclosure', () => {
  assert.match(
    drawerVue,
    /<details v-if="messageAnswerEvaluation\(message\)" class="agent-answer-evaluation"/,
    'assistant messages with backend answerEvaluation metadata should render an evaluation disclosure'
  )

  assert.match(
    drawerVue,
    /<summary class="agent-answer-evaluation-summary">[\s\S]*回答评估[\s\S]*messageAnswerEvaluationLabel\(message\)/,
    'answer evaluation disclosure should expose the backend status label'
  )

  assert.match(
    drawerVue,
    /v-for="item in messageAnswerEvaluationChecks\(message\)"/,
    'evaluation checks should render backend-provided check results'
  )

  assert.match(
    drawerVue,
    /v-for="action in messageAnswerEvaluationActions\(message\)"/,
    'evaluation recommended actions should render from backend metadata'
  )

  assert.match(
    drawerVue,
    /function messageAnswerEvaluation\(message = \{\}\)/,
    'answer evaluation parsing should be centralized in a helper'
  )

  assert.match(
    drawerVue,
    /function messageAnswerEvaluationActions\(message = \{\}\)/,
    'answer evaluation actions should be parsed in a helper'
  )
})

test('workflow agent code cards match the compact html editor reference without a separate Agent branch', () => {
  assert.doesNotMatch(
    drawerVue + appVue,
    /messageCodeArtifact|codeArtifact|appendWorkflowCodeArtifact|isWorkflowCodeGenerationAction/,
    'HTML code display should not add a separate Agent message branch or metadata path'
  )

  assert.match(
    drawerVue,
    /const AgentCodeCard =[\s\S]*codeLanguageLabel\(cardProps\.language\)[\s\S]*codeCardClass = computed\(\(\) => `agent-code-card agent-code-card-\$\{displayLanguage\.value\}`\)/,
    'the existing AgentCodeCard should keep the shared code renderer and add language-scoped styling without a separate branch'
  )

  assert.match(
    drawerVue,
    /class:\s*'agent-code-card-head'[\s\S]*h\(Eye[\s\S]*h\(Copy[\s\S]*h\(Download[\s\S]*h\(Maximize2/,
    'AgentCodeCard should render preview, copy, download, and fullscreen icons in the requested order'
  )

  assert.match(
    drawerVue,
    /class:\s*\['agent-code-card-source'[\s\S]*h\('code', sourceCode\.value\)/,
    'AgentCodeCard should render source in the shared compact source body'
  )

  assert.match(
    stylesSource,
    /\.agent-code-card[\s\S]*border:\s*1px solid #dfe3e8;[\s\S]*\.agent-code-card-head[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;[\s\S]*\.agent-code-card-source[\s\S]*max-height:\s*160px;/,
    'Agent non-HTML code cards should keep the compact bordered editor treatment and 160px scrollable source body'
  )

  assert.match(
    drawerVue,
    /function looseHtmlAgentCodeSegments\(content = ''\)[\s\S]*language:\s*'html'/,
    'assistant replies with loose unfenced HTML fragments should be promoted into shared HTML code cards'
  )

  assert.match(
    drawerVue,
    /const looseHtmlSegments = looseHtmlAgentCodeSegments\(text\)[\s\S]*if \(hasRenderableAgentSegments\(looseHtmlSegments\)\) return mergeRawFirstOverlaySegments\(looseHtmlSegments/,
    'loose HTML detection should run before markdown fallback so raw HTML is not rendered as plain prose'
  )

  assert.match(
    drawerVue,
    /const text = artifactResult\.text \|\| messageContent\(message\)/,
    'legacy generated-code messages that only persisted fenced HTML in message.content should still enter the code-card segment path'
  )

  assert.match(
    stylesSource,
    /\.agent-code-card-html \.agent-code-card-source[\s\S]*min-height:\s*clamp\(360px,\s*56vh,\s*560px\);[\s\S]*max-height:\s*min\(62vh,\s*620px\);/,
    'HTML Agent code cards should use the tall editor-style source area from the requested reference'
  )
})

test('workflow canvas fullscreen renders backend page layout artifacts without protocol text', () => {
  assert.match(
    canvasVue,
    /v-if="hasPageLayoutArtifact\(fullscreenNode\)"/,
    'canvas fullscreen should have a dedicated page layout artifact renderer'
  )

  assert.match(
    canvasVue,
    /pageFrameworkDocumentSections\(fullscreenNode\)[\s\S]*section\.title[\s\S]*section\.body[\s\S]*section\.code/,
    'canvas fullscreen should render the backend generated page framework through a document-style hierarchy'
  )

  assert.doesNotMatch(
    canvasVue,
    /pageLayoutHandoff\(fullscreenNode, 'frontend'\)/,
    'canvas fullscreen should keep frontend handoff hidden from the visible page artifact panel'
  )

  assert.doesNotMatch(
    canvasVue,
    /pageLayoutHandoff\(fullscreenNode, 'backend'\)/,
    'canvas fullscreen should keep backend handoff hidden from the visible page artifact panel'
  )

  assert.match(
    canvasVue,
    /function pageLayoutHandoff\(node = \{\}, side = 'frontend'\)/,
    'handoff parsing should stay available because the backend-owned artifact still carries it'
  )

  assert.doesNotMatch(
    canvasVue,
    /pageLayoutArtifact\(fullscreenNode\)\.rawText/,
    'canvas fullscreen must not render the raw :::page-layout-artifact protocol text'
  )
})

test('workflow canvas fullscreen switches page wireframe and page-level interaction spec', () => {
  const detailStart = canvasVue.indexOf('<div v-if="isInteractionPageDetail(fullscreenNode)"')
  const detailEnd = canvasVue.indexOf('<div v-else-if="isVisualGalleryDetail(fullscreenNode)"', detailStart)
  const detailTemplate = canvasVue.slice(detailStart, detailEnd)

  assert.match(
    canvasVue,
    /function isInteractionPageDetail\(node = \{\}\)[\s\S]*return isInteractionLofiPageNode\(node\)/,
    'interaction page fullscreen should use the same stage/page-artifact detection as the visible page cards'
  )
  assert.match(
    detailTemplate,
    /class="canvas-page-layout-mode-toggle"[\s\S]*框架图[\s\S]*低保原型[\s\S]*交互说明/,
    'interaction page fullscreen should expose framework, low-fi prototype, and interaction spec segmented switch'
  )
  assert.match(
    detailTemplate,
    /v-if="fullscreenPageDetailMode\(fullscreenNode\) === 'wireframe'"[\s\S]*class="page-framework-document"[\s\S]*pageFrameworkDocumentSections\(fullscreenNode\)/,
    'wireframe mode should keep the backend framework as the default document-style page detail'
  )
  assert.match(
    detailTemplate,
    /v-if="isAdvancedUxInteractionPageNode\(fullscreenNode\)"[\s\S]*页面定位[\s\S]*页面框架表格[\s\S]*框架图/,
    'advanced UX page details should explicitly expose page positioning, page framework table, and framework diagram'
  )
  assert.match(
    detailTemplate,
    /v-else-if="fullscreenPageDetailMode\(fullscreenNode\) === 'lofi-prototype'"[\s\S]*class="page-lofi-prototype-artifact"/,
    'low-fi prototype mode should render a visual prototype from the backend page layout artifact'
  )
  assert.match(
    detailTemplate,
    /pageLofiPrototypeBlueprint\(fullscreenNode\)[\s\S]*page-lofi-wireframe-board[\s\S]*blueprint\.archetype[\s\S]*page-lofi-wireframe-region-map[\s\S]*region in blueprint\.regions[\s\S]*pageLofiRegionStyle\(region\)[\s\S]*page-lofi-wireframe-actionbar[\s\S]*page-lofi-wireframe-exception/,
    'low-fi prototype should render an archetype-specific region map derived from the current page framework'
  )
  assert.match(
    detailTemplate,
    /v-if="pageLowFiWireframeImage\(fullscreenNode\)"[\s\S]*class="page-lofi-generated-image"/,
    'low-fi prototype mode should render the generated low-fi image when backend attached one to the page node'
  )
  assert.match(
    detailTemplate,
    /v-else-if="fullscreenPageDetailMode\(fullscreenNode\) === 'interaction-spec' && hasInteractionSpecArtifact\(fullscreenNode\)"[\s\S]*class="page-interaction-spec-artifact"/,
    'interaction-spec mode should render a dedicated page-level interaction specification artifact'
  )
  assert.match(
    detailTemplate,
    /interactionSpecRows\(fullscreenNode\)[\s\S]*row\.target[\s\S]*row\.gesture[\s\S]*row\.feedback[\s\S]*row\.statePromptCopy[\s\S]*row\.result/,
    'interaction spec rows should expose object, gesture, feedback, state copy, and navigation/result fields'
  )
  assert.match(
    detailTemplate,
    /v-if="isAdvancedUxInteractionPageNode\(fullscreenNode\)"[\s\S]*交互规则表格[\s\S]*异常状态表格/,
    'advanced UX page interaction details should render interaction-rule and exception-state tables explicitly'
  )
  assert.match(
    detailTemplate,
    /交互手势说明[\s\S]*interactionSpecGestureNotes\(fullscreenNode\)/,
    'interaction spec should render page-level gesture notes from the backend artifact'
  )
  assert.match(
    detailTemplate,
    /状态提示文案[\s\S]*interactionSpecStateMatrix\(fullscreenNode\)[\s\S]*state\.promptCopy/,
    'interaction spec should render state prompt copy from the backend artifact'
  )
  assert.match(
    detailTemplate,
    /状态与流程闭环[\s\S]*interactionSpecFlowPreview\(fullscreenNode\)[\s\S]*step\.from[\s\S]*step\.to/,
    'interaction spec should show a state and flow closure preview from backend-owned state and transition data'
  )
  assert.match(
    canvasVue,
    /function interactionSpecArtifact\(node = \{\}\)/,
    'frontend should read the backend-owned interactionSpecArtifact'
  )
  assert.match(
    canvasVue,
    /function pageLofiPrototypeBlueprint\(node = \{\}\)[\s\S]*pageLayoutArtifact\(node\)[\s\S]*lofiPageArchetype\(node[\s\S]*lofiBlueprintRegions\([\s\S]*asciiWireframe/,
    'low-fi prototype board should derive page archetype and region positions from pageLayoutArtifact and its ASCII wireframe'
  )
  assert.match(
    canvasVue,
    /function isAdvancedUxInteractionPageNode\(node = \{\}\)[\s\S]*advanced-ux-page-interaction-document/,
    'advanced UX imported page nodes should use the dedicated page-document detail path'
  )
  assert.match(
    canvasVue,
    /function pageLowFiWireframeArtifact\(node = \{\}\)[\s\S]*lowFiWireframeArtifact/,
    'page detail should read backend-attached low-fi wireframe image artifacts'
  )
  assert.match(
    canvasVue,
    /function pageFrameworkDocumentSections\(node = \{\}\)[\s\S]*pageLayoutArtifact\(node\)[\s\S]*pageArchitecture\(node\)[\s\S]*interactionDetails\(node\)[\s\S]*asciiWireframe/,
    'framework document sections should be derived from backend-owned pageLayoutArtifact, pageArchitecture, and interactionDetails'
  )
  assert.match(
    canvasVue,
    /function interactionSpecFlowPreview\(node = \{\}\)[\s\S]*interactionSpecStateMatrix\(node\)[\s\S]*interactionSpecRows\(node\)/,
    'flow closure preview should be derived from interactionSpecArtifact state and row data'
  )
  assert.match(
    canvasVue,
    /node\?\.interactionSpecArtifact[\s\S]*return legacyInteractionSpecArtifact\(node\)/,
    'frontend may normalize legacy backend-owned interaction fields when older records do not yet have interactionSpecArtifact'
  )
  assert.match(
    canvasVue,
    /function legacyInteractionSpecArtifact\(node = \{\}\)[\s\S]*interactionDetails\(node\)[\s\S]*interactionSpecItems\(node\)/,
    'legacy normalization should reuse existing backend/model fields instead of fixed frontend business copy'
  )
  assert.match(
    canvasVue,
    /function interactionSpecGestureNotes\(node = \{\}\)/,
    'frontend should expose backend-owned gesture notes for the interaction spec'
  )
  assert.match(
    canvasVue,
    /function interactionSpecStateMatrix\(node = \{\}\)/,
    'frontend should expose backend-owned state prompt copy for the interaction spec'
  )
  assert.match(
    stylesSource,
    /\.page-interaction-spec-artifact[\s\S]*display:\s*grid;/,
    'page-level interaction spec should have a dedicated readable layout'
  )
  assert.match(
    stylesSource,
    /\.page-lofi-prototype-artifact[\s\S]*\.page-lofi-wireframe-board[\s\S]*\.page-lofi-wireframe-board\.list[\s\S]*\.page-lofi-wireframe-board\.modal[\s\S]*\.page-lofi-wireframe-region-map[\s\S]*grid-template-areas[\s\S]*\.page-lofi-wireframe-region/,
    'low-fi prototype mode should style distinct page archetypes and a region map rather than one fixed two-column board'
  )
  assert.match(
    stylesSource,
    /\.page-framework-document[\s\S]*\.page-framework-title[\s\S]*\.page-framework-overview[\s\S]*\.page-framework-code-block/,
    'framework view should use document-style hierarchy styling with distinct level colors'
  )
  assert.match(
    stylesSource,
    /\.page-interaction-flow-preview[\s\S]*\.page-interaction-flow-step/,
    'interaction spec should have dedicated state/flow preview styling'
  )
})

test('workflow canvas framework document view does not hardcode HeyGen reference content', () => {
  assert.doesNotMatch(
    canvasVue,
    /HeyGen|语音克隆|Voice Cloning|Happy Path|上传音频样本/,
    'framework view may borrow the reference document layout, but business content must come from backend artifacts'
  )
})

test('workflow canvas page cards preview backend generated ASCII wireframes', () => {
  assert.match(
    canvasVue,
    /hasPageLayoutArtifact\(node\)[\s\S]*class="canvas-node-wireframe-preview"/,
    'page canvas cards should render each page as a wireframe preview instead of plain summary text'
  )

  assert.match(
    canvasVue,
    /<pre>\{\{ pageLayoutArtifact\(node\)\.asciiWireframe \}\}<\/pre>/,
    'page canvas card previews should use the backend generated ASCII wireframe'
  )

  assert.match(
    stylesSource,
    /\.canvas-node-wireframe-preview[\s\S]*font-family:\s*var\(--font-mono/,
    'page canvas wireframes should use a monospace preview block'
  )
})

test('workflow canvas keeps wireframe cards after slice filtering and hides bottom page nav', () => {
  assert.doesNotMatch(
    canvasVue,
    /class="workflow-page-node-nav"/,
    'bottom page-node navigation bar should be hidden while keeping the zoom controls'
  )

  assert.match(
    canvasVue,
    /const filteredNodes = nodes\.filter\(\(node\) => nodeMatchesActiveSlice\(node\)\)[\s\S]*if \(filteredNodes\.length\) return filteredNodes[\s\S]*const fallbackNodes = interactionLofiPageFallbackNodes\.value[\s\S]*return fallbackNodes\.length \? fallbackNodes : nodes/,
    'slice filtering should keep matching backend stage nodes and fall back to all lofi stage nodes when the page fallback is empty'
  )
})

test('workflow canvas filters interaction page cards by active requirement slice', () => {
  assert.match(
    canvasVue,
    /const activeSliceStageCanvasNodes = computed\(\(\) => \{/,
    'interaction-lofi canvas should derive a slice-aware node list before rendering page cards'
  )

  assert.match(
    canvasVue,
    /const sliceFilterableStageIds = computed\(\(\) => new Set\(\[[\s\S]*'interaction-lofi'[\s\S]*'ui-visual'/,
    'slice-aware filtering should cover both interaction-lofi and UI visual stages'
  )

  assert.match(
    canvasVue,
    /if \(!sliceFilterableStageIds\.value\.has\(activeStageId\.value\) \|\| !resolvedActiveSliceId\.value\) return stageCanvasNodeSource\.value[\s\S]*nodeMatchesActiveSlice\(node\)/,
    'slice-filterable stage nodes should be filtered by activeSliceId so clicking a slice changes the canvas content'
  )

  assert.match(
    canvasVue,
    /if \(!shouldRenderAgentWorkbench\.value\) return activeSliceStageCanvasNodes\.value/,
    'non-agent stage rendering should use the slice-aware stage nodes instead of the unfiltered stage node source'
  )

  assert.match(
    canvasVue,
    /const nodes = shouldRenderAgentWorkbench\.value \? activeStageAgentNodes\.value : activeSliceStageCanvasNodes\.value/,
    'fullscreen and tab node sources should stay aligned with the same filtered canvas nodes'
  )
})

test('workflow canvas shows related page nodes for rule-only interaction slices', () => {
  assert.match(
    canvasVue,
    /function nodeMatchesSlice\(node = \{\}, sourceSliceId = ''\)[\s\S]*node\.sliceId === sourceSliceId[\s\S]*node\.sourceSliceId === sourceSliceId[\s\S]*node\.relatedSliceIds[\s\S]*sourceSliceId/,
    'rule-only slices such as prompt fallback should render their related page node instead of an empty canvas'
  )
  assert.match(
    canvasVue,
    /function nodeMatchesActiveSlice\(node = \{\}\)[\s\S]*return nodeMatchesSlice\(node, sourceSliceId\)/,
    'active-slice filtering should use the shared related-slice matcher'
  )
  assert.match(
    canvasVue,
    /const filteredNodes = nodes\.filter\(\(node\) => nodeMatchesActiveSlice\(node\)\)/,
    'slice filtering should use the shared related-slice matcher'
  )
})

test('workflow canvas resolves stage slice ids back to source slice ids for page wireframes', () => {
  assert.match(
    canvasVue,
    /function sourceSliceIdForActiveSlice\(/,
    'interaction-lofi filtering should translate stage-scoped slice ids back to source requirement slice ids'
  )

  assert.match(
    canvasVue,
    /node\.sliceId === sourceSliceId/,
    'page wireframe nodes should be filtered by their source slice id so backend artifacts are not replaced by page fallbacks'
  )

  assert.match(
    canvasVue,
    /page\.sliceId === activeSourceSliceId\.value/,
    'fallback page filtering should use the same source slice id mapping as stage canvas nodes'
  )
})

test('workflow fullscreen uses current stage canvas nodes before root canvas nodes', () => {
  const lookupStart = appVue.indexOf('function canvasNodeById(nodeId)')
  const lookupEnd = appVue.indexOf('function workflowStageCanvasNodeById', lookupStart)
  const lookupSource = appVue.slice(lookupStart, lookupEnd)

  assert.match(
    appVue,
    /const workflowCurrentCanvasNodes = computed\(\(\) =>/,
    'App should expose a current-stage node pool for active/fullscreen lookups'
  )

  assert.match(
    lookupSource,
    /workflowStageCanvasNodeById\(nodeId\)[\s\S]*workflowCurrentCanvasNodes\.value\.find\(\(node\) => node\.id === nodeId\)[\s\S]*workflowCanvasNodes\.value\.find\(\(node\) => node\.id === nodeId\)/,
    'canvas node lookup should prefer canonical stage canvas nodes before merged root canvas fallbacks so interaction details keep pageLayoutArtifact'
  )

  assert.match(
    appVue,
    /const fullscreenCanvasNode = computed\(\(\) =>\s*canvasNodeById\(workflowFullscreenNodeId\.value\) \|\|[\s\S]*workflowFullscreenNodeOverride\.value/,
    'fullscreen lookup should use the shared canvas node resolver before falling back to a visible node snapshot'
  )

  assert.match(
    appVue,
    /:nodes="workflowCurrentCanvasNodes"/,
    'WorkflowCanvasPage should receive the same current-stage nodes used by fullscreen lookups'
  )
})

test('requirement dissection fullscreen renders the global function hierarchy map', () => {
  const confirmationStart = canvasVue.indexOf('v-else-if="isAgentConfirmationNode(fullscreenNode)"')
  const confirmationEnd = canvasVue.indexOf('<div v-if="isPureContentNode(fullscreenNode)"', confirmationStart)
  const confirmationTemplate = canvasVue.slice(confirmationStart, confirmationEnd)

  assert.match(
    confirmationTemplate,
    /v-if="isRequirementDissectionNode\(fullscreenNode\) && hasProjectFunctionMap\(fullscreenNode\)"[\s\S]*class="requirement-function-map"/,
    'requirement dissection fullscreen should render a dedicated function hierarchy map before generic confirmation cards'
  )
  assert.match(
    confirmationTemplate,
    /功能层级地图[\s\S]*页面清单[\s\S]*用户主路径/,
    'function map display should expose hierarchy, page map, and user path sections'
  )
  assert.match(
    canvasVue,
    /function projectFunctionMap\(node = \{\}\)/,
    'frontend should read the backend-owned projectFunctionMap instead of hardcoding business modules'
  )
  assert.match(
    canvasVue,
    /function buildRequirementDissectionAgentNode\(\)[\s\S]*projectFunctionMap:\s*props\.totalFlow\?\.projectFunctionMap/,
    'frontend fallback agent node should keep the totalFlow projectFunctionMap on the requirement-dissection detail'
  )
  assert.match(
    stylesSource,
    /\.requirement-function-map[\s\S]*display:\s*grid;/,
    'function map should have a dedicated readable detail layout'
  )
})

test('requirement dissection fullscreen renders nine-chapter product-analysis blocks without duplicate report panels', () => {
  const confirmationStart = canvasVue.indexOf('v-else-if="isAgentConfirmationNode(fullscreenNode)"')
  const confirmationEnd = canvasVue.indexOf('<div v-if="isPureContentNode(fullscreenNode)"', confirmationStart)
  const confirmationTemplate = canvasVue.slice(confirmationStart, confirmationEnd)
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-else-if="isAgentConfirmationNode(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)

  assert.match(
    overviewTemplate,
    /v-if="!isNodeActuallyLoading\(fullscreenNode\) && shouldUseRequirementPipelineDetail\(fullscreenNode\)"[\s\S]*class="requirement-pipeline-detail"/,
    'requirement dissection tab detail should render the backend-owned product-analysis pipeline'
  )
  assert.match(
    canvasVue,
    /function requirementPipelineTabs\(node = \{\}\)[\s\S]*productAnalysisPipeline\?\.tabs/,
    'frontend should read the nine chapters from requirementDissectionArtifact.productAnalysisPipeline'
  )
  assert.match(
    canvasVue,
    /function requirementPipelineTabId\(node = \{\}\)[\s\S]*node\?\.requirementPipelineTabId/,
    'frontend should prefer the backend-provided tab id instead of guessing from the title'
  )
  assert.match(
    canvasVue,
    /function requirementDetailBlocks\(node = \{\}\)[\s\S]*detailBlocks/,
    'frontend should render tab details from backend-owned detailBlocks'
  )
  assert.match(
    canvasVue,
    /function hasRequirementDissectionArtifact\(node = \{\}\)[\s\S]*productAnalysisPipeline\?\.tabs\?\.length[\s\S]*advancedUxMarkdownSections/,
    'frontend should treat Advanced UX markdown sections as requirement pipeline detail data instead of falling back to legacy node content'
  )
  assert.match(
    canvasVue,
    /function resolveRequirementSourceRef\(sourceRef = '', node = \{\}\)[\s\S]*case 'pageCoverageMatrix'[\s\S]*case 'decisionPointMatrix'[\s\S]*case 'exceptionRecoveryMatrix'[\s\S]*case 'dataFlowGraph'[\s\S]*case 'stateMachineMap'[\s\S]*case 'featureJumpGraph'[\s\S]*case 'dataSharingMechanism'/,
    'sourceRef resolver should map detail blocks to canonical artifact fields'
  )
  assert.match(
    canvasVue,
    /function requirementBlockRows\(block = \{\}, node = \{\}\)[\s\S]*resolveRequirementSourceRef/,
    'detail block rows should resolve canonical sources at render time instead of storing duplicated rows'
  )
  assert.match(
    canvasVue,
    /function requirementBlockGroups\(block = \{\}, node = \{\}\)[\s\S]*navigationItems[\s\S]*targetPageId[\s\S]*activeState[\s\S]*visibilityRule/,
    'navigation detail should expose backend-owned navigation bindings instead of only summary strings'
  )
  assert.match(
    canvasVue,
    /function requirementBlockGroups\(block = \{\}, node = \{\}\)[\s\S]*pageId[\s\S]*level[\s\S]*pageType/,
    'page hierarchy detail should expose page ids, levels, and page types for page-frame reconstruction'
  )
  assert.match(
    overviewTemplate,
    /requirementBlockType\(block\) === 'state-machine'[\s\S]*requirement-state-machine/,
    'pipeline detail should have a dedicated state-machine renderer'
  )
  assert.match(
    overviewTemplate,
    /requirementBlockType\(block\) === 'relation-table'[\s\S]*requirement-relation-table/,
    'pipeline detail should have a dedicated cross-feature relation renderer'
  )
  assert.match(
    overviewTemplate,
    /requirementBlockType\(block\) === 'graph'[\s\S]*requirement-graph-block/,
    'pipeline detail should have a dedicated graph renderer for data flow'
  )
  assert.match(
    overviewTemplate,
    /isRequirementDocumentTableBlock\(block\)[\s\S]*requirement-detail-table/,
    'pipeline detail should render backend matrix detailBlocks through the unified table renderer'
  )
  assert.match(
    canvasVue,
    /function requirementBlockHeaders\(block = \{\}, node = \{\}\)[\s\S]*column\.label/,
    'matrix/table headers should display column labels instead of raw column objects'
  )
  assert.match(
    canvasVue,
    /function requirementBlockRows\(block = \{\}, node = \{\}\)[\s\S]*column\.key[\s\S]*row\[column\.key\]/,
    'matrix/table rows should read values through backend-provided column keys'
  )
  assert.doesNotMatch(
    confirmationTemplate,
    /class="requirement-dissection-report"/,
    'pipeline runs should not render the old all-in-one requirement report in the Agent confirmation branch'
  )
  assert.doesNotMatch(
    canvasVue,
    /requirementAnalysisGuidanceGroups|分析规则来源/,
    'analysis guidance is backend/model-only and should not render in the canvas detail'
  )
  assert.match(
    canvasVue,
    /function requirementPageCoverageRows\(node = \{\}\)[\s\S]*pageCoverageMatrix/,
    'frontend should read backend-owned pageCoverageMatrix for the coverage view'
  )
  assert.match(
    canvasVue,
    /case 'coverage'[\s\S]*tableHeaders:\s*\['页面', '类型', '入口\/出口', '主操作\/状态'\]/,
    'fullscreen coverage card should use a dedicated coverage matrix table'
  )
  assert.match(
    canvasVue,
    /function requirementDecisionRows\(node = \{\}\)[\s\S]*decisionPointMatrix/,
    'frontend should read backend-owned decisionPointMatrix for the decision view'
  )
  assert.match(
    canvasVue,
    /function requirementExceptionRows\(node = \{\}\)[\s\S]*exceptionRecoveryMatrix/,
    'frontend should read backend-owned exceptionRecoveryMatrix for the exception view'
  )
  assert.match(
    canvasVue,
    /function requirementDataFlowItems\(node = \{\}\)[\s\S]*dataFlowGraph/,
    'frontend should read backend-owned dataFlowGraph for the data and state view'
  )
  assert.match(
    canvasVue,
    /function requirementSharingRows\(node = \{\}\)[\s\S]*dataSharingMechanism/,
    'frontend should read backend-owned dataSharingMechanism for the sharing view'
  )
  const crossPageRowsStart = canvasVue.indexOf('function requirementCrossPageRelationRows(node = {})')
  const crossPageRowsEnd = canvasVue.indexOf('function requirementSectionKey', crossPageRowsStart)
  const crossPageRowsSource = canvasVue.slice(crossPageRowsStart, crossPageRowsEnd)
  assert.match(
    crossPageRowsSource,
    /featureJumpGraph/,
    'cross-page relation view should reuse backend-owned featureJumpGraph'
  )
  assert.doesNotMatch(
    crossPageRowsSource,
    /dataSharingMechanism|sharingRows/,
    'cross-page relation view should not duplicate rows owned by the data sharing mechanism view'
  )
  assert.doesNotMatch(
    canvasVue,
    /crossPageFunctionGraph|crossPageRelationsArtifact/,
    'frontend should not depend on duplicate cross-page artifact fields'
  )
  assert.match(
    canvasVue,
    /function requirementInteractionSpecRows\(node = \{\}\)[\s\S]*designRequirementMap\?\.pages[\s\S]*interactionHotspots/,
    'interaction spec view should derive from existing page requirement hotspots'
  )
  assert.doesNotMatch(
    canvasVue,
    /interactionSpecSchema|interactionSpecRequirementArtifact/,
    'frontend should not depend on duplicate interaction spec schema fields'
  )
  assert.doesNotMatch(
    canvasVue,
    /来自模型 artifact/,
    'requirement detail should not expose useless English technical subtitles'
  )
  assert.match(
    canvasVue,
    /function requirementDissectionArtifact\(node = \{\}\)[\s\S]*props\.totalFlow\?\.requirementDissectionArtifact/,
    'frontend should read requirementDissectionArtifact from backend totalFlow or node'
  )
  assert.match(
    canvasVue,
    /function buildRequirementDissectionAgentNode\(\)[\s\S]*requirementDissectionArtifact:\s*props\.totalFlow\?\.requirementDissectionArtifact/,
    'fallback requirement agent node should preserve the backend-owned requirement artifact'
  )
  assert.doesNotMatch(
    drawerVue,
    /analysis-guidance|分析规则来源/,
    'Agent drawer should not render a second guidance disclosure that duplicates the requirement detail'
  )
  assert.match(
    stylesSource,
    /\.requirement-pipeline-detail[\s\S]*display:\s*grid;/,
    'requirement pipeline detail should have dedicated readable styling'
  )

  assert.match(
    canvasVue,
    /function requirementPipelineFallbackTab\(legacyKey = ''\)[\s\S]*competitiveAnalysis/,
    'legacy competitive details should fold into the nine-chapter pipeline instead of a separate card'
  )

  assert.match(
    canvasVue,
    /function visibleNodeQuickActions\(node = \{\}\)[\s\S]*const actions = \(Array\.isArray\(node\.quickActions\) \? node\.quickActions : \[\]\)[\s\S]*filter\(\(action\) => action && !isCanvasConfirmAction\(action\)\)[\s\S]*return actions/,
    'competitive reference next actions should be visible as node quick actions instead of only static text'
  )

  assert.match(
    appVue,
    /const nodeActions = \[[\s\S]*activeNode\.quickActions[\s\S]*activeNode\.agentInteraction\?\.quickReplies[\s\S]*activeNode\.agentInteraction\?\.suggestedQuestions[\s\S]*if \(nodeActions\.includes\(normalized\)\) return true/,
    'clicking competitive reference quick actions should route to the current node Agent supplement path'
  )

  assert.match(
    appVue,
    /function workflowCanvasActionIntent\(action = ''\)[\s\S]*竞品\|对标\|参考对象[\s\S]*return 'competitor-reference-enrichment'/,
    'competitive reference actions should use a dedicated Agent intent instead of generic canvas advice'
  )

  assert.match(
    appVue,
    /'competitor-reference-enrichment': '围绕当前项目和需求分析节点补齐竞品参考证据[\s\S]*不要编造竞品事实/,
    'competitor reference Agent prompts should keep evidence boundaries instead of inventing verified competitor facts'
  )
})

test('requirement dissection detail absorbs PDF-style stage tabs and hides noisy duplicate fields', () => {
  assert.match(
    canvasVue,
    /const REQUIREMENT_DOCUMENT_SECTION_DEFINITIONS = \[[\s\S]*title: '需求理解'[\s\S]*sourceRefs: \['productDefinition', 'userScenarios', 'evidenceAndAssumptions', 'riskAssessment'\][\s\S]*title: '缺口确认'[\s\S]*sourceRefs: \['gapConfirmation', 'openQuestions'\][\s\S]*title: '用户旅程分析'[\s\S]*sourceRefs: \['personaScenarioMatrix', 'userJourneyMap'\][\s\S]*title: '功能与页面拆解'[\s\S]*sourceRefs: \['functionModuleMatrix', 'designRequirementMap', 'pageHierarchyTree', 'pageCoverageMatrix', 'pageFrameContracts'\][\s\S]*title: '业务规则与状态流'[\s\S]*sourceRefs: \['businessRuleMatrix', 'permissionMatrix', 'boundaryConditionMatrix', 'stateMachineMap'\][\s\S]*title: '流程与架构'[\s\S]*sourceRefs: \['navigationStructure', 'dataFlowGraph', 'featureJumpGraph', 'exceptionRecoveryMatrix'\][\s\S]*title: '设计机会'[\s\S]*sourceRefs: \['designOpportunityMatrix', 'competitiveAnalysis'\][\s\S]*title: '优先级与排期'[\s\S]*sourceRefs: \['priorityRoadmap', 'scopeBoundary'\][\s\S]*title: '验收标准'[\s\S]*sourceRefs: \['acceptanceBasis'\]/,
    'requirement detail chapters should follow the PDF-style detail framework while keeping sourceRefs canonical'
  )
  assert.match(
    canvasVue,
    /case 'riskAssessment':[\s\S]*artifact\.riskAssessment/,
    'sourceRef resolver should expose riskAssessment from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'gapConfirmation':[\s\S]*artifact\.gapConfirmation/,
    'sourceRef resolver should expose gap confirmation from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'businessRuleMatrix':[\s\S]*artifact\.businessRuleMatrix/,
    'sourceRef resolver should expose businessRuleMatrix from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'permissionMatrix':[\s\S]*artifact\.permissionMatrix/,
    'sourceRef resolver should expose permissionMatrix from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'boundaryConditionMatrix':[\s\S]*artifact\.boundaryConditionMatrix/,
    'sourceRef resolver should expose boundaryConditionMatrix from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'designOpportunityMatrix':[\s\S]*artifact\.designOpportunityMatrix/,
    'sourceRef resolver should expose designOpportunityMatrix from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'priorityRoadmap':[\s\S]*artifact\.priorityRoadmap/,
    'sourceRef resolver should expose priorityRoadmap from the backend artifact'
  )
  assert.match(
    canvasVue,
    /case 'acceptanceBasis':[\s\S]*artifact\.acceptanceBasis/,
    'sourceRef resolver should expose acceptanceBasis from the backend artifact'
  )
  assert.match(
    canvasVue,
    /isRequirementBusinessRuleBlock\(block\)[\s\S]*requirement-business-rule-list/,
    'business rules should have a dedicated PDF-style rule list renderer'
  )
  assert.match(
    canvasVue,
    /isRequirementPermissionMatrixBlock\(block\)[\s\S]*requirement-permission-matrix/,
    'permission matrix should have a dedicated matrix renderer'
  )
  assert.match(
    canvasVue,
    /isRequirementBoundaryConditionBlock\(block\)[\s\S]*requirement-boundary-condition-list/,
    'boundary conditions should have a dedicated card renderer'
  )
  assert.match(
    canvasVue,
    /isRequirementOpportunityPriorityBlock\(block\)[\s\S]*requirement-opportunity-priority/,
    'design opportunities and priority should have a dedicated comparison/roadmap renderer'
  )
  assert.match(
    canvasVue,
    /function isRequirementOpportunityPriorityBlock\(block = \{\}\)[\s\S]*return \['priorityRoadmap', 'acceptanceBasis'\]\.includes\(block\?\.sourceRef\)/,
    'design opportunity detail should use the same unified table layout as the stage-one markdown card instead of vertical opportunity cards'
  )
  assert.match(
    canvasVue,
    /isRequirementDocumentTableBlock\(block\)[\s\S]*class="requirement-document-table-block requirement-detail-table"[\s\S]*requirementBlockHeaders\(block, fullscreenNode\)[\s\S]*requirementBlockRows\(block, fullscreenNode\)/,
    'designOpportunityMatrix should fall through to the unified table renderer with headers and grid rows'
  )
  assert.doesNotMatch(
    canvasVue,
    /artifact\.businessRules|const business = artifact\.businessRules/,
    'frontend should not read the old duplicated businessRules root field'
  )
  assert.doesNotMatch(
    canvasVue,
    /source:\s*'来自模型结构化结果'|source:\s*'来自模型 artifact'/,
    'fullscreen detail should remove noisy technical source subtitles'
  )
})

test('requirement knowledge references render as one-line citations with expandable sources', () => {
  assert.match(
    canvasVue,
    /function requirementKnowledgeCitationSummary\(node = \{\}\)/,
    'requirement detail should summarize knowledge references into one readable line'
  )
  assert.match(
    canvasVue,
    /function requirementKnowledgeCitationSources\(node = \{\}\)[\s\S]*knowledgeLoadingContext[\s\S]*evidenceAndAssumptions/,
    'knowledge citation sources should come from project knowledge context and evidence, not guidance'
  )
  assert.match(
    canvasVue,
    /class="requirement-knowledge-citation"[\s\S]*requirementKnowledgeCitationSummary\(fullscreenNode\)[\s\S]*class="requirement-knowledge-citation-mark"/,
    'canvas detail should show one-line knowledge citation text followed by a citation mark'
  )
  assert.match(
    canvasVue,
    /<details[\s\S]*class="requirement-knowledge-citation-sources"[\s\S]*requirementKnowledgeCitationSources\(fullscreenNode\)/,
    'clicking the citation should reveal knowledge source details'
  )
  assert.doesNotMatch(
    drawerVue,
    /requirement-knowledge-citation|knowledgeLoadingContext|知识库上下文/,
    'Agent drawer should not render a duplicate requirement knowledge citation block'
  )
})

test('acceptance deposit detail renders PDF-style functional rule state and non-functional acceptance', () => {
  assert.match(
    canvasVue,
    /ruleAcceptance\(fullscreenNode\)[\s\S]*class="acceptance-rule-section"/,
    'acceptance detail should render rule acceptance inherited from businessRuleMatrix'
  )
  assert.match(
    canvasVue,
    /stateAcceptance\(fullscreenNode\)[\s\S]*class="acceptance-state-section"/,
    'acceptance detail should render state acceptance inherited from stateMachineMap'
  )
  assert.match(
    canvasVue,
    /nonFunctionalAcceptance\(fullscreenNode\)[\s\S]*class="acceptance-non-functional-section"/,
    'acceptance detail should render non-functional acceptance'
  )
  assert.match(
    stylesSource,
    /\.acceptance-rule-section[\s\S]*\.acceptance-state-section[\s\S]*\.acceptance-non-functional-section/,
    'PDF-style acceptance sections should have dedicated styling'
  )
})

test('requirement dissection child fullscreen renders pipeline tab detail with legacy fallback only', () => {
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-else-if="isAgentConfirmationNode(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)

  assert.match(
    overviewTemplate,
    /v-if="!isNodeActuallyLoading\(fullscreenNode\) && shouldUseRequirementPipelineDetail\(fullscreenNode\)"[\s\S]*class="requirement-pipeline-detail"/,
    'requirement child cards should render the nine-chapter pipeline detail before falling through to generic detail'
  )
  assert.match(
    canvasVue,
    /function requirementPipelineFallbackTab\(legacyKey = ''\)[\s\S]*case 'product'[\s\S]*case 'users'[\s\S]*case 'scope'[\s\S]*case 'pages'[\s\S]*case 'risk'[\s\S]*case 'competitive'[\s\S]*case 'downstream'/,
    'legacy section keys should map into the nine-chapter pipeline instead of keeping separate detail branches'
  )
  assert.match(
    canvasVue,
    /function requirementPipelineFallbackTab\(legacyKey = ''\)[\s\S]*flow-architecture/,
    'legacy flow-related cards should open the flow architecture pipeline tab'
  )
  assert.match(
    canvasVue,
    /function requirementDetailBlocks\(node = \{\}\)[\s\S]*requirementPipelineTab\(node\)[\s\S]*detailBlocks/,
    'pipeline detail should read block definitions from the active pipeline tab'
  )
  assert.match(
    canvasVue,
    /function requirementBlockRows\(block = \{\}, node = \{\}\)[\s\S]*requirementPageCoverageRows\(node\)[\s\S]*requirementDecisionRows\(node\)[\s\S]*requirementExceptionRows\(node\)/,
    'pipeline blocks should derive page coverage, decision, and exception rows from canonical artifact helpers'
  )
  assert.match(
    canvasVue,
    /function requirementBlockRows\(block = \{\}, node = \{\}\)[\s\S]*requirementDataFlowItems\(node\)[\s\S]*requirementJumpRows\(node\)[\s\S]*requirementSharingRows\(node\)/,
    'pipeline blocks should derive data flow, jump, and sharing rows from canonical artifact helpers'
  )
  assert.match(
    canvasVue,
    /function requirementPipelineTabId\(node = \{\}\)[\s\S]*requirementSectionKey\(node\)/,
    'old persisted requirement cards should still map through legacy section keys when no pipeline tab id exists'
  )
  assert.match(
    canvasVue,
    /function shouldUseRequirementPipelineDetail\(node = \{\}\)[\s\S]*!isAgentConfirmationNode\(node\)/,
    'pipeline detail should target child tabs while leaving Agent confirmation nodes out of the detail renderer'
  )
  assert.doesNotMatch(
    canvasVue,
    /茶饮门店|奶茶|小程序点单/,
    'requirement pipeline detail must not hardcode tea-drink business conclusions in the frontend'
  )
  assert.match(
    stylesSource,
    /\.requirement-pipeline-detail[\s\S]*display:\s*grid;/,
    'pipeline detail should have readable styling for richer artifact content'
  )
})

test('workflow requirement agent summary acts as a canvas navigator without fixed quick replies', () => {
  const summaryStart = appVue.indexOf('function workflowRequirementArtifactSummaryLines(totalFlow = {})')
  const summaryEnd = appVue.indexOf('function workflowCompactJsonReplyText', summaryStart)
  const summaryFunction = appVue.slice(summaryStart, summaryEnd)
  assert.match(
    summaryFunction,
    /function workflowRequirementArtifactSummaryLines\(totalFlow = \{\}\)[\s\S]*## 图表入口[\s\S]*页面层级[\s\S]*页面覆盖矩阵[\s\S]*决策点矩阵[\s\S]*异常与恢复[\s\S]*数据流与状态机/,
    'requirement summary should expose graph entry points that point back to canvas artifact sections'
  )
  assert.match(
    summaryFunction,
    /function workflowRequirementArtifactSummaryLines\(totalFlow = \{\}\)[\s\S]*## 缺口追问[\s\S]*页面是否遗漏[\s\S]*可后续补充/,
    'requirement summary should explain blocking versus follow-up gaps'
  )
  assert.doesNotMatch(
    summaryFunction,
    /quickReplies:\s*\[/,
    'navigator summary must not inject fixed quick replies from the frontend'
  )
})

test('requirement dissection pipeline detail uses mixed layouts for absorbed structures', () => {
  assert.match(
    canvasVue,
    /:class="\[`layout-\$\{requirementBlockType\(block\)\}`, \{ 'layout-advanced-ux-table': isAdvancedUxTablePreferredBlock\(block, fullscreenNode\) \}\]"/,
    'requirement pipeline blocks should expose layout classes so trees, timelines, graphs, state machines, relations, risks, and advanced UX tables can render differently'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'tree'[\s\S]*requirement-tree-lines/,
    'function hierarchy detail should render as a tree-like structure'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'timeline'[\s\S]*requirement-timeline/,
    'user journey detail should render as a timeline instead of generic text'
  )
  assert.match(
    canvasVue,
    /isRequirementDocumentTableBlock\(block\)[\s\S]*requirement-detail-table/,
    'page requirements detail should render through the unified table renderer'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'risk-matrix'[\s\S]*requirement-risk-matrix/,
    'risk detail should render as a risk matrix'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'graph'[\s\S]*requirement-graph-block/,
    'data flow detail should render as a graph block'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'state-machine'[\s\S]*requirement-state-machine/,
    'state machine detail should render as state transition blocks'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'relation-table'[\s\S]*requirement-relation-table/,
    'cross-feature detail should render as a relation table'
  )
  assert.match(
    stylesSource,
    /\.requirement-pipeline-block\.layout-tree[\s\S]*\.requirement-tree-lines[\s\S]*\.requirement-pipeline-block\.layout-timeline[\s\S]*\.requirement-timeline[\s\S]*\.requirement-pipeline-block\.layout-graph[\s\S]*\.requirement-graph-block[\s\S]*\.requirement-pipeline-block\.layout-state-machine[\s\S]*\.requirement-state-machine[\s\S]*\.requirement-pipeline-block\.layout-relation-table[\s\S]*\.requirement-relation-table/,
    'mixed requirement pipeline layouts should have dedicated styling'
  )
})

test('flow information architecture blocks use sourceRef-specific visual renderers', () => {
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-else-if="isAgentConfirmationNode(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)

  assert.match(
    overviewTemplate,
    /isRequirementNavigationBlock\(block\)[\s\S]*requirement-navigation-map/,
    'top navigation should use a dedicated navigation map renderer instead of the generic tree fallback'
  )
  assert.match(
    overviewTemplate,
    /isRequirementPageHierarchyBlock\(block\)[\s\S]*requirement-page-hierarchy-map/,
    'page hierarchy should use a dedicated hierarchy renderer that can expose page ids and levels'
  )
  assert.match(
    overviewTemplate,
    /isRequirementJourneyBlock\(block\)[\s\S]*requirement-journey-map/,
    'user journey should use a backend-field renderer instead of a legacy swimlane template'
  )
  assert.match(
    overviewTemplate,
    /isRequirementDataFlowBlock\(block\)[\s\S]*requirement-data-flow-map/,
    'data flow should use a dedicated source-page-downstream renderer'
  )
  assert.match(
    overviewTemplate,
    /isRequirementStateMachineBlock\(block\)[\s\S]*requirement-state-machine-map/,
    'state machine should use a dedicated transition renderer'
  )
  assert.match(
    overviewTemplate,
    /isRequirementFeatureJumpBlock\(block\)[\s\S]*requirement-feature-jump-map/,
    'cross-function relations should use a dedicated jump-edge renderer'
  )
  assert.match(
    canvasVue,
    /function requirementNavigationVisualRows\(block = \{\}, node = \{\}\)[\s\S]*targetPageId[\s\S]*activeState[\s\S]*visibilityRule/,
    'navigation renderer should preserve targetPageId, activeState, and visibilityRule from backend artifacts'
  )
  assert.match(
    canvasVue,
    /function requirementPageHierarchyVisualRows\(block = \{\}, node = \{\}\)[\s\S]*pageId[\s\S]*parentId[\s\S]*level[\s\S]*pageType/,
    'hierarchy renderer should preserve pageId, parentId, level, and pageType'
  )
  assert.match(
    canvasVue,
    /function requirementDataFlowVisualRows\(block = \{\}, node = \{\}\)[\s\S]*reads[\s\S]*writes[\s\S]*downstream/,
    'data flow renderer should preserve reads, writes, and downstream dependencies'
  )
  assert.match(
    canvasVue,
    /function requirementStateMachineVisualRows\(block = \{\}, node = \{\}\)[\s\S]*transitions[\s\S]*from[\s\S]*event[\s\S]*to/,
    'state machine renderer should preserve transition from/event/to fields'
  )
  assert.match(
    canvasVue,
    /function requirementFeatureJumpVisualRows\(block = \{\}, node = \{\}\)[\s\S]*fromPageId[\s\S]*toPageId[\s\S]*condition[\s\S]*preserveState/,
    'feature jump renderer should preserve page ids, conditions, and state-preservation flags'
  )
  assert.match(
    stylesSource,
    /\.requirement-navigation-map[\s\S]*\.requirement-page-hierarchy-map[\s\S]*\.requirement-journey-map[\s\S]*\.requirement-data-flow-map[\s\S]*\.requirement-state-machine-map[\s\S]*\.requirement-feature-jump-map/,
    'absorbed flow and information architecture structures should have dedicated visual styles'
  )
})

test('requirement dissection fullscreen uses a document-style chapter layout from canonical blocks', () => {
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-else-if="isAgentConfirmationNode(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)

  assert.match(
    overviewTemplate,
    /class="requirement-pipeline-document"[\s\S]*v-for="section in requirementDocumentSections\(fullscreenNode\)"/,
    'requirement detail should group backend detailBlocks into document-style chapters'
  )
  assert.match(
    overviewTemplate,
    /class="requirement-pipeline-section"[\s\S]*<h2>\{\{ section\.indexLabel \}\}、\{\{ section\.title \}\}<\/h2>[\s\S]*section\.blocks/,
    'each chapter should render like a markdown document heading instead of a card title'
  )
  assert.match(
    overviewTemplate,
    /<h3>\{\{ requirementDocumentBlockHeading\(section, block, blockIndex\) \}\}<\/h3>/,
    'each canonical block should render as a numbered markdown subsection'
  )
  assert.match(
    overviewTemplate,
    /isRequirementNavigationBlock\(block\)[\s\S]*class="requirement-navigation-map"/,
    'navigation structures should render through the dedicated visual map instead of flattening into generic plaintext'
  )
  assert.match(
    overviewTemplate,
    /v-else-if="isRequirementDocumentTableBlock\(block\)"[\s\S]*class="requirement-document-table-block requirement-detail-table"/,
    'matrix and table structures should render as markdown-like table blocks'
  )
  assert.match(
    overviewTemplate,
    /requirementBlockType\(block\) === 'risk-matrix'[\s\S]*class="requirement-risk-matrix requirement-detail-table"[\s\S]*requirementBlockHeaders\(block, fullscreenNode\)[\s\S]*requirementBlockTableStyle\(block, fullscreenNode\)/,
    'risk-matrix blocks imported from markdown should render as markdown-like tables with dynamic columns'
  )
  assert.match(
    canvasVue,
    /function isRequirementDocumentTableBlock\(block = \{\}\)[\s\S]*question-list/,
    'question-list blocks with backend table rows should stay in markdown-like table form instead of card rows'
  )
  assert.match(
    canvasVue,
    /function requirementBlockTableStyle\(block = \{\}, node = \{\}\)[\s\S]*requirementBlockColumnCount\(block, node\)[\s\S]*--requirement-table-columns/,
    'requirement tables should derive their grid columns from backend headers/rows instead of a fixed four-column layout'
  )
  assert.match(
    canvasVue,
    /const REQUIREMENT_DOCUMENT_SECTION_DEFINITIONS = \[[\s\S]*title: '需求理解'[\s\S]*sourceRefs: \['productDefinition', 'userScenarios', 'evidenceAndAssumptions', 'riskAssessment'\][\s\S]*title: '缺口确认'[\s\S]*sourceRefs: \['gapConfirmation', 'openQuestions'\][\s\S]*title: '用户旅程分析'[\s\S]*sourceRefs: \['personaScenarioMatrix', 'userJourneyMap'\][\s\S]*title: '功能与页面拆解'[\s\S]*sourceRefs: \['functionModuleMatrix', 'designRequirementMap', 'pageHierarchyTree', 'pageCoverageMatrix', 'pageFrameContracts'\][\s\S]*title: '业务规则与状态流'[\s\S]*sourceRefs: \['businessRuleMatrix', 'permissionMatrix', 'boundaryConditionMatrix', 'stateMachineMap'\][\s\S]*title: '流程与架构'[\s\S]*sourceRefs: \['navigationStructure', 'dataFlowGraph', 'featureJumpGraph', 'exceptionRecoveryMatrix'\][\s\S]*title: '设计机会'[\s\S]*sourceRefs: \['designOpportunityMatrix', 'competitiveAnalysis'\][\s\S]*title: '优先级与排期'[\s\S]*sourceRefs: \['priorityRoadmap', 'scopeBoundary'\][\s\S]*title: '验收标准'[\s\S]*sourceRefs: \['acceptanceBasis'\]/,
    'chapter definitions should follow the PDF-style product-analysis order without duplicating artifact fields'
  )
  assert.match(
    canvasVue,
    /function requirementDocumentSections\(node = \{\}\)[\s\S]*const blocks = requirementDetailBlocks\(node\)[\s\S]*definition\.sourceRefs\.includes\(block\.sourceRef\)[\s\S]*remainingBlocks/,
    'chapter grouping should reuse existing detailBlocks/sourceRef instead of creating duplicate display fields'
  )
  assert.doesNotMatch(
    overviewTemplate,
    /requirementAnalysisGuidanceGroups|分析规则来源|硬约束|方法指南|参考记录/,
    'analysis guidance should not be visible in requirement detail chapters'
  )
  assert.match(
    stylesSource,
    /\.requirement-pipeline-document[\s\S]*\.requirement-pipeline-section h2[\s\S]*\.requirement-document-block h3[\s\S]*\.requirement-document-code-block[\s\S]*\.requirement-document-table-block/,
    'document chapters should have markdown-reader styling for headings, code blocks, and tables'
  )
  assert.match(
    stylesSource,
    /\.requirement-detail-table article[\s\S]*grid-template-columns:\s*var\(--requirement-table-columns/,
    'markdown-like requirement tables should use per-block dynamic columns so titles and table cells align'
  )
})

test('requirement dissection canvas cards show artifact previews and recommended actions', () => {
  const cardStart = canvasVue.indexOf('<article\n              v-for="node in displayNodes"')
  const cardEnd = canvasVue.indexOf('<div v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls"', cardStart)
  const cardTemplate = canvasVue.slice(cardStart, cardEnd)

  assert.match(
    cardTemplate,
    /isRequirementPipelineCanvasNode\(node\)[\s\S]*class="requirement-canvas-card-table-preview"[\s\S]*requirementPreviewTableRows\(requirementCanvasPreviewTable\(node\)\)/,
    'requirement dissection canvas cards should render compact table previews derived from backend artifact blocks'
  )
  assert.match(
    canvasVue,
    /function requirementCanvasPreviewTable\(node = \{\}\)[\s\S]*requirementMarkdownPreviewTable\(advancedUxRequirementNodeMarkdown\(node\), 3\)[\s\S]*requirementDetailBlocks\(node\)[\s\S]*requirementBlockPreviewTable/,
    'requirement canvas table previews should prefer markdown tables and then derive from canonical detailBlocks'
  )
  assert.match(
    canvasVue,
    /function requirementCanvasRecommendedActions\(node = \{\}\)[\s\S]*return \['补充细节', '列出风险'\]/,
    'requirement canvas cards should keep node-scoped Agent actions only when backend quickActions are absent'
  )
  assert.doesNotMatch(
    canvasVue,
    /function requirementCanvasRecommendedActions\(node = \{\}\)[\s\S]*进入交互低保/,
    'requirement canvas cards should not show a per-card stage advance button'
  )
  assert.match(
    canvasVue,
    /function visibleNodeQuickActions\(node = \{\}\)[\s\S]*if \(isRequirementPipelineCanvasNode\(node\)\)[\s\S]*requirementCanvasRecommendedActions\(node\)/,
    'requirement recommended actions should flow through the same quick-action pipeline as other canvas card actions'
  )
  assert.match(
    stylesSource,
    /\.requirement-canvas-card-preview[\s\S]*max-height:\s*100%;[\s\S]*overflow-y:\s*auto;[\s\S]*\.requirement-canvas-card-preview span[\s\S]*border-left:\s*4px solid #222529;[\s\S]*background:\s*#f8fafc;/,
    'requirement canvas previews should match the detail block style and scroll within the card body'
  )
})

test('requirement dissection document uses mixed visual blocks instead of flattening every section to plaintext', () => {
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-else-if="isAgentConfirmationNode(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)

  assert.match(
    overviewTemplate,
    /isRequirementJourneyBlock\(block\)[\s\S]*class="requirement-journey-map"/,
    'userJourneyMap should render as backend-owned journey rows, not a plaintext block'
  )
  assert.match(
    overviewTemplate,
    /isRequirementStructuredDetailBlock\(block\)[\s\S]*class="requirement-structured-detail-list"/,
    'summary/list blocks should render as structured detail rows instead of legacy diagrams'
  )
  assert.match(
    canvasVue,
    /function isRequirementStructuredDetailBlock\(block = \{\}\)[\s\S]*productDefinition[\s\S]*userScenarios[\s\S]*evidenceAndAssumptions/,
    'structured detail renderer should be selected from canonical sourceRef values'
  )
  assert.doesNotMatch(
    totalDesignFlowSource,
    /interactionFrameworkArtifact|targetDisassemblyArtifact|processThinkingArtifact|journeySwimlaneArtifact/,
    'backend should not add parallel root artifacts for these visual renderers'
  )
  assert.doesNotMatch(
    canvasVue,
    /isRequirementJourneySwimlaneBlock|isRequirementTargetDisassemblyBlock|isRequirementProcessThinkingBlock|isRequirementInteractionFrameworkBlock/,
    'legacy diagram renderer helper functions should not exist in the requirement detail'
  )
  assert.doesNotMatch(
    canvasVue,
    /requirement-journey-swimlane|requirement-target-disassembly|requirement-process-thinking|requirement-interaction-framework/,
    'legacy diagram renderer classes should not be used by the Vue template'
  )
  assert.match(
    stylesSource,
    /\.requirement-structured-detail-list[\s\S]*\.requirement-structured-detail-list article/,
    'structured detail blocks should have a dedicated field-level list style'
  )
  assert.doesNotMatch(
    stylesSource,
    /requirement-journey-swimlane|requirement-target-disassembly|requirement-process-thinking|requirement-interaction-framework/,
    'legacy diagram renderer styles should be removed from the canvas stylesheet'
  )
})

test('advanced UX markdown report sections render as markdown instead of page layout artifacts', () => {
  assert.match(
    canvasVue,
    /function resolveRequirementSourceRef\(sourceRef = '', node = \{\}\)[\s\S]*advancedUxMarkdownSections/,
    'requirement source resolver should read imported advanced UX markdown sections from the backend artifact'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'markdown'[\s\S]*requirement-markdown-report-block/,
    'advanced UX imported markdown sections should render through a dedicated markdown report block'
  )
  assert.match(
    drawerVue,
    /function markdownBlocksShouldUsePageLayoutArtifact\(blocks = \[\], title = ''\)[\s\S]*isAdvancedUxMarkdownReportTitle\(titleText\)[\s\S]*return false/,
    'agent markdown renderer should not convert advanced UX report chapters into page-layout artifacts'
  )
})

test('advanced UX stage-one fullscreen markdown details use the same markdown block style as file cards', () => {
  assert.match(
    canvasVue,
    /function requirementMarkdownRenderableBlocks\(content = ''\)/,
    'stage-one fullscreen details should parse Markdown blocks instead of dumping raw markdown'
  )
  assert.match(
    canvasVue,
    /function renderRequirementMarkdownBlock\(block = \{\}\)/,
    'stage-one fullscreen details should render headings, tables, lists, and text code blocks'
  )
  assert.match(
    canvasVue,
    /shouldRenderAdvancedUxRequirementMarkdown\(fullscreenNode\)[\s\S]*requirementMarkdownRenderableBlocks\(advancedUxRequirementNodeMarkdown\(fullscreenNode\)\)[\s\S]*renderRequirementMarkdownBlock/,
    'advanced UX raw section fallback should use the parsed markdown renderer used by md file cards'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'markdown'[\s\S]*requirementMarkdownRenderableBlocks\(requirementDocumentBlockPlaintext\(block, fullscreenNode\)\)[\s\S]*renderRequirementMarkdownBlock/,
    'advanced UX markdown detail blocks should render parsed markdown instead of raw pre text'
  )
  assert.doesNotMatch(
    canvasVue,
    /requirementBlockType\(block\) === 'markdown'[\s\S]{0,180}<pre>\{\{ requirementDocumentBlockPlaintext\(block, fullscreenNode\) \}\}<\/pre>/,
    'markdown blocks in stage-one details should no longer use raw pre output'
  )
})

test('advanced UX fullscreen details use structured blocks before raw markdown fallback', () => {
  assert.match(
    canvasVue,
    /function advancedUxRequirementNodeMarkdown\(node = \{\}\)[\s\S]*node\?\.markdown[\s\S]*advancedUxMarkdownSections/,
    'fullscreen detail should resolve the backend-imported Advanced UX markdown section before generic detail fallbacks'
  )
  assert.match(
    canvasVue,
    /function hasStructuredRequirementDetailBlocks\(node = \{\}\)[\s\S]*requirementDetailBlocks\(node\)[\s\S]*requirementBlockType\(block\) !== 'markdown'/,
    'Advanced UX fullscreen detail should detect backend-imported structured blocks'
  )
  assert.match(
    canvasVue,
    /function shouldRenderAdvancedUxRequirementMarkdown\(node = \{\}\)[\s\S]*!hasStructuredRequirementDetailBlocks\(node\)/,
    'raw Advanced UX markdown should be a fallback only when no structured blocks exist'
  )
  assert.match(
    canvasVue,
    /v-if="shouldRenderAdvancedUxRequirementMarkdown\(fullscreenNode\)"[\s\S]*requirement-advanced-ux-markdown-detail[\s\S]*advancedUxRequirementNodeMarkdown\(fullscreenNode\)/,
    'Advanced UX fullscreen detail may still render raw markdown for legacy unstructured imports'
  )
})

test('advanced UX structured report blocks render with document-specific layouts', () => {
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'score-card'[\s\S]*requirement-score-card-block/,
    'advanced UX clarity scores should render as score cards instead of raw markdown'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'feature-list'[\s\S]*requirement-feature-list-block/,
    'advanced UX function details should render as feature detail cards'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'flow-wireframe'[\s\S]*requirement-flow-wireframe-block/,
    'advanced UX flow code blocks should render as flow or wireframe blocks'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'checklist'[\s\S]*requirement-checklist-block/,
    'advanced UX handoff checklists should render as checklists'
  )
  assert.match(
    canvasVue,
    /requirementBlockType\(block\) === 'metric-table'[\s\S]*requirement-metric-table-block/,
    'advanced UX tracking and validation plans should render as metric tables'
  )
  assert.match(
    totalDesignFlowSource,
    /function parseAdvancedUxSectionBlocks\(section = \{\}\)[\s\S]*score-card[\s\S]*flow-wireframe[\s\S]*checklist[\s\S]*metric-table/,
    'backend should parse advanced UX markdown subsections into typed detail blocks'
  )
})

test('advanced UX stage regeneration keeps backend returned total flow and skill route', () => {
  const regenerateStart = appVue.indexOf('async function regenerateWorkflowStage')
  const regenerateEnd = appVue.indexOf('function selectWorkflowCanvasNode', regenerateStart)
  const regenerateSource = appVue.slice(regenerateStart, regenerateEnd)

  assert.match(
    regenerateSource,
    /const workflowSkillId = run\.skillId \|\| run\.requestedSkillId \|\| run\.workflowId \|\| 'auto'/,
    'stage regeneration should preserve the active Advanced UX skill id instead of falling back to ordinary total-flow'
  )
  assert.match(
    regenerateSource,
    /requestedSkillId:\s*workflowSkillId === 'auto' \? 'total-design-flow' : workflowSkillId/,
    'stage regeneration should request Advanced UX downstream rules when the active run is Advanced UX'
  )
  assert.doesNotMatch(
    regenerateSource,
    /totalDesignFlow:\s*workflowAnalysisResult\.value\?\.totalDesignFlow \|\| result\.data\.totalDesignFlow/,
    'stage regeneration must not discard backend returned stage canvases by preferring stale local totalDesignFlow'
  )
  assert.match(
    regenerateSource,
    /const returnedTotalDesignFlow = normalizeWorkflowTotalFlowMeta\(result\.data\.totalDesignFlow \|\| result\.data\.totalFlowMeta\)/,
    'stage regeneration should normalize and use the backend returned totalDesignFlow'
  )
})

test('advanced UX generating canvas nodes show loading state until markdown import completes', () => {
  assert.match(
    totalDesignFlowSource,
    /function advancedUxGeneratingNodes\(importError = ''\)[\s\S]*artifactStatus:\s*status[\s\S]*'generating'/,
    'backend should create generating placeholder nodes for advanced UX report generation'
  )
  assert.match(
    canvasVue,
    /isAdvancedUxGeneratingNode\(node\)[\s\S]*正在生成高级 UX 分析/,
    'frontend should recognize advanced UX generating nodes and keep details in loading state'
  )
  assert.match(
    canvasVue,
    /<p v-if="!isNodeActuallyLoading\(node\) && !hasPageLayoutArtifact\(node\)[\s\S]*canvasNodeSummary\(node\)/,
    'generating advanced UX cards should not render the ordinary summary above the loading row'
  )
  assert.match(
    canvasVue,
    /<div v-else-if="!isNodeActuallyLoading\(node\) && !hasPageLayoutArtifact\(node\) && !isVisualGalleryDetail\(node\) && !isPreviewCodeDetail\(node\) && compactNodeContent\(node\)\.length" class="canvas-node-content">/,
    'generating advanced UX cards should not render compact content chips below the loading row'
  )
})

test('advanced UX failed canvas nodes hide stale generating placeholders', () => {
  assert.match(
    canvasVue,
    /function isNodeActuallyLoading\(node = \{\}\) \{[\s\S]*if \(node\.artifactStatus === 'failed'\) return false/,
    'failed canvas nodes should not keep rendering as loading even if historical placeholder flags remain'
  )
  assert.match(
    canvasVue,
    /function compactNodeContent\(node = \{\}\)[\s\S]*isFailedGenerationPlaceholderCopy\(node, item\)[\s\S]*function isFailedGenerationPlaceholderCopy\(node = \{\}, text = ''\)[\s\S]*node\.artifactStatus !== 'failed'[\s\S]*正在生成\|等待生成\|生成完成后\|阶段完成后/,
    'failed Advanced UX nodes should filter stale generating copy from old persisted node content'
  )
})

test('advanced UX pending interaction stage suppresses stale fallback nodes before page document import', () => {
  assert.match(
    appVue,
    /function shouldUseAdvancedUxPendingStageCanvas\(stageId = '', totalFlow = null\)[\s\S]*stageId !== 'interaction-lofi'[\s\S]*workflowAdvancedUxPageInteractionDocument\(totalFlow\)[\s\S]*return Boolean/,
    'App should detect advanced UX interaction-lofi pending state before rendering stage nodes'
  )
  assert.match(
    appVue,
    /const sourceCanvas = shouldUseAdvancedUxPendingStageCanvas\(stageId, normalizedTotalFlow\)[\s\S]*workflowAdvancedUxPendingStageCanvasForStage\(stageId\)[\s\S]*normalizedTotalFlow\.stageCanvases\?\.\[stageId\]/,
    'unified workflow canvas should replace stale interaction-lofi nodes with the advanced UX loading canvas'
  )
  assert.match(
    appVue,
    /const sourceStageCanvas = shouldUseAdvancedUxPendingStageCanvas\(stageId, normalizedTotalFlow\)[\s\S]*workflowAdvancedUxPendingStageCanvasForStage\(stageId\)[\s\S]*normalizedTotalFlow\.stageCanvases\?\.\[stageId\]/,
    'current stage canvas should also render the advanced UX loading canvas while the page document is missing'
  )
  assert.match(
    appVue,
    /function shouldResumeAdvancedUxPendingStageGeneration\(stageId = '', totalFlow = null\)[\s\S]*workflowAnalysisStreamController\.value[\s\S]*workflowCanvasLoading\.value[\s\S]*shouldUseAdvancedUxPendingStageCanvas\(stageId, totalFlow\)/,
    'App should distinguish stale generating state from an active backend stream for Advanced UX interaction stage'
  )
  assert.match(
    appVue,
    /function shouldAutoGenerateWorkflowStage\(stageId = ''\)[\s\S]*currentStatus === 'generating' && !shouldResumeAdvancedUxPendingStageGeneration\(stageId\)/,
    'stale Advanced UX interaction-lofi generating status should be allowed to restart instead of waiting forever'
  )
  assert.match(
    appVue,
    /watch\([\s\S]*advancedUxPendingStageGenerationWatchKey[\s\S]*shouldResumeAdvancedUxPendingStageGeneration\(workflowCurrentStageId\.value\)[\s\S]*scheduleWorkflowStageAutoGeneration\(workflowCurrentStageId\.value\)/,
    'opening or refreshing a stale Advanced UX interaction stage should schedule the backend generation stream again'
  )
})

test('stopping Agent generation also stops the active workflow stage canvas', () => {
  assert.match(
    appVue,
    /function workflowStagePausedCanvasForStage\(stageId = '', existingCanvas = null\)[\s\S]*artifactStatus:\s*'paused'[\s\S]*loading:\s*false[\s\S]*重新生成该阶段/,
    'paused stage canvas should render as stopped instead of a loading placeholder'
  )
  assert.match(
    appVue,
    /function stopActiveWorkflowStageGenerationIfNeeded\(\)[\s\S]*workflowAnalysisStreamController\.value[\s\S]*workflowCanvasLoading\.value[\s\S]*hasPendingStageNode[\s\S]*pauseWorkflowStage\(stageId\)/,
    'Agent stop should pause the active workflow stage when a stage stream or pending canvas exists'
  )
  assert.match(
    appVue,
    /async function stopWorkflowAgentGeneration\(\)\s*\{[\s\S]*const stoppedStageGeneration = stopActiveWorkflowStageGenerationIfNeeded\(\)[\s\S]*已停止生成，左侧画布已同步停止/,
    'the Agent stop action should explicitly synchronize the left canvas stopped state'
  )
  assert.match(
    appVue,
    /function shouldUseAdvancedUxPendingStageCanvas\(stageId = '', totalFlow = null\)[\s\S]*workflowAdvancedUxPageInteractionDocumentFailure\(totalFlow\)[\s\S]*return false[\s\S]*runtimeState === 'paused' \|\| stageStatus === 'paused'[\s\S]*return false[\s\S]*runtimeState === 'generating' \|\| stageStatus === 'generating'/,
    'failed or paused Advanced UX stages must not be wrapped back into a generating canvas'
  )
})

test('model generated status keeps artifact-specific card content before generic model summary', () => {
  assert.match(
    totalDesignFlowSource,
    /content:\s*hasModelNode \|\| ownContent\.length\s*\?\s*ownContent\s*:\s*generatedItems\.length \? generatedItems\.slice\(0,\s*6\) : ownContent/,
    'stage cards that already have artifact-specific content should not be overwritten by generic modelSummaryItems'
  )
})

test('requirement dissection canvas uses flow grid layout so report cards do not overlap', () => {
  assert.match(
    canvasVue,
    /:class="\{[\s\S]*'requirement-dissection-board': isRequirementDissectionStageId\(activeStageId\)[\s\S]*\}"/,
    'requirement-dissection stage should mark the canvas surface for non-overlapping report layout'
  )
  assert.match(
    canvasVue,
    /:style="isRequirementDissectionStageId\(activeStageId\) \? undefined : \{ left: `\$\{node\.x\}px`, top: `\$\{node\.y\}px`, width: `\$\{node\.width\}px`, minHeight: `\$\{node\.height\}px` \}"/,
    'requirement-dissection cards should not keep absolute x/y positioning that can overlap after content grows'
  )
  assert.match(
    stylesSource,
    /\.workflow-canvas-surface\.requirement-dissection-board[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*320px\);/,
    'requirement-dissection board should use fixed-size grid columns matching page canvas cards'
  )
  assert.match(
    stylesSource,
    /\.workflow-canvas-surface\.requirement-dissection-board \.canvas-node-card[\s\S]*position:\s*relative;[\s\S]*width:\s*320px;[\s\S]*height:\s*292px;[\s\S]*overflow:\s*hidden;/,
    'requirement-dissection cards should participate in normal layout flow without growing beyond the page-card size'
  )
  assert.match(
    canvasVue,
    /<div class="canvas-node-body">[\s\S]*<div class="canvas-node-footer">/,
    'canvas cards should keep body content separate from the fixed footer actions'
  )
  assert.match(
    stylesSource,
    /\.canvas-node-body[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;/,
    'canvas card body should scroll internally when content exceeds the fixed card area'
  )
})

test('workflow canvas card header actions use native buttons for reliable fullscreen clicks', () => {
  const nodeHeadTemplateStart = canvasVue.indexOf('<div class="canvas-node-head">')
  const nodeHeadTemplateEnd = canvasVue.indexOf('<div class="canvas-node-body">', nodeHeadTemplateStart)
  const nodeHeadTemplate = canvasVue.slice(nodeHeadTemplateStart, nodeHeadTemplateEnd)
  const nodeHeadStart = canvasVue.indexOf('<div class="canvas-node-actions">')
  const nodeHeadEnd = canvasVue.indexOf('</div>', nodeHeadStart)
  const nodeHeadActions = canvasVue.slice(nodeHeadStart, nodeHeadEnd)

  assert.doesNotMatch(
    nodeHeadTemplate,
    /canvasNodeKicker\(node\)|contentStatusLabel|groupName|node\.type/,
    'canvas card headers should not render generic fields such as 环节, node type, group name, or content status label'
  )
  assert.match(
    nodeHeadActions,
    /<button type="button" data-canvas-action="open-agent" :data-node-id="node\.id">Agent<\/button>/,
    'canvas card Agent action should use a native button with stable action metadata for delegated clicks'
  )
  assert.match(
    nodeHeadActions,
    /<button type="button" data-canvas-action="open-detail" :data-node-id="node\.id">全屏<\/button>/,
    'canvas card fullscreen action should use a native button with stable action metadata for delegated clicks'
  )
  assert.doesNotMatch(
    nodeHeadActions,
    /<BaseButton/,
    'canvas card header actions should not rely on component event fallthrough for critical clicks'
  )
})

test('workflow canvas card header actions use delegated capture clicks on the scaled surface', () => {
  assert.match(
    canvasVue,
    /class="workflow-canvas-scrollarea"[\s\S]*@wheel="handleCanvasWheel"[\s\S]*@click\.capture="handleCanvasActionClick"/,
    'canvas scrollarea should capture card action clicks before scaled-card focus handling can swallow them'
  )
  assert.match(
    canvasVue,
    /function handleCanvasActionClick\(event\)[\s\S]*closest\?\.\('\[data-canvas-action\]\[data-node-id\]'\)[\s\S]*const node = displayNodes\.value\.find\(\(item\) => item\?\.id === nodeId\)[\s\S]*event\.stopPropagation\(\)[\s\S]*emit\('open-agent', nodeId\)[\s\S]*emit\('open-agent', \{ action: 'open-detail', nodeId, node \}\)/,
    'delegated canvas action handler should route Agent and fullscreen buttons through the proven open-agent emit boundary'
  )
  assert.match(
    appVue,
    /@open-agent="handleWorkflowCanvasNodeAction"/,
    'App should route delegated canvas actions through one reliable component listener'
  )
  assert.match(
    appVue,
    /function handleWorkflowCanvasNodeAction\(payload = ''\)[\s\S]*payload\?\.action === 'open-detail'[\s\S]*openWorkflowCanvasFullscreen\(payload\.node \|\| payload\.nodeId\)[\s\S]*openWorkflowAgentForNode\(payload\)/,
    'App should split delegated canvas action payloads between Agent and fullscreen behavior'
  )
  assert.match(
    appVue,
    /const workflowFullscreenNodeOverride = ref\(null\)[\s\S]*const fullscreenCanvasNode = computed\(\(\) =>\s*canvasNodeById\(workflowFullscreenNodeId\.value\) \|\|\s*\(workflowFullscreenNodeOverride\.value\?\.id === workflowFullscreenNodeId\.value \? workflowFullscreenNodeOverride\.value : null\)\s*\)/,
    'fullscreen detail should keep a visible child-stage node snapshot when parent current-stage lookup cannot resolve it'
  )
})

test('workflow fullscreen model summary rendering tolerates missing aiSummary', () => {
  assert.doesNotMatch(
    canvasVue,
    /v-if="aiSummary\.summary"/,
    'fullscreen detail should not crash when historical runs have a null aiSummary prop'
  )
  assert.match(
    canvasVue,
    /v-if="aiSummary\?\.summary"/,
    'fullscreen detail should guard optional aiSummary before reading summary'
  )
})

test('workflow canvas card clicks are routed through an inner hitbox on the scaled surface', () => {
  const cardTemplateStart = canvasVue.indexOf('class="canvas-node-card"')
  const articleStart = canvasVue.lastIndexOf('<article', cardTemplateStart)
  const cardTemplateEnd = canvasVue.indexOf('</article>', cardTemplateStart)
  const cardTemplate = canvasVue.slice(articleStart, cardTemplateEnd)

  assert.match(
    cardTemplate,
    /<div\s+class="canvas-node-hitbox"[\s\S]*@click="\$emit\('focus-node', node\.id\)"/,
    'canvas cards should route focus clicks through an inner hitbox instead of the absolute-positioned surface shell'
  )
  assert.doesNotMatch(
    cardTemplate.slice(0, cardTemplate.indexOf('>') + 1),
    /@click="\$emit\('focus-node', node\.id\)"/,
    'the absolute-positioned card shell should not compete with child buttons for click hit testing'
  )
  assert.match(
    stylesSource,
    /\.canvas-node-card[\s\S]*pointer-events:\s*none;[\s\S]*\.canvas-node-hitbox[\s\S]*pointer-events:\s*auto;/,
    'the scaled canvas card shell should ignore pointer events while the visible hitbox receives them'
  )
  assert.match(
    stylesSource,
    /\.canvas-node-card\.active \.canvas-node-hitbox[\s\S]*border-color:\s*#222529;/,
    'active card visuals should move to the hitbox so the positioning shell stays transparent to pointer events'
  )
})

test('workflow Agent opens from total-flow stage canvas even when top-level canvas is absent', () => {
  const ensureStart = appVue.indexOf('function ensureActiveWorkflowRunForAgent()')
  const ensureEnd = appVue.indexOf('function openWorkflowAgentForNode', ensureStart)
  const ensureSource = appVue.slice(ensureStart, ensureEnd)

  assert.doesNotMatch(
    ensureSource,
    /if \(!workflowAnalysisResult\.value\?\.canvas\) return null/,
    'Agent opening should not fail only because total-flow analysis stores visible nodes in stageCanvases instead of a top-level canvas'
  )
  assert.match(
    ensureSource,
    /workflowCurrentCanvasNodes\.value/,
    'Agent fallback run should derive steps from the same current-stage node pool rendered on the canvas'
  )
  assert.match(
    ensureSource,
    /workflowCanvas\.value/,
    'Agent fallback run should keep a canvas snapshot even when the analysis has only total-flow stage canvases'
  )
})

test('workflow canvas actions resolve visible nodes across stage canvases after local stage switching', () => {
  const lookupStart = appVue.indexOf('function canvasNodeById(nodeId)')
  const lookupEnd = appVue.indexOf('function canvasNodeCenter(nodeId)', lookupStart)
  const lookupSource = appVue.slice(lookupStart, lookupEnd)

  assert.match(
    appVue,
    /function workflowStageCanvasNodeById\(nodeId = ''\)[\s\S]*workflowStageTotalDesignFlow\.value\?\.stageCanvases[\s\S]*Object\.values\(stageCanvases\)[\s\S]*canvas\?\.nodes\.find\(\(node\) => node\?\.id === nodeId\)/,
    'canvas node lookup should include all backend-owned stageCanvases so child-local stage switches can still open Agent/fullscreen for the visible node'
  )
  assert.match(
    lookupSource,
    /workflowStageCanvasNodeById\(nodeId\)/,
    'canvasNodeById should fall through to stageCanvases after checking the current stage and root canvas nodes'
  )
  assert.match(
    appVue,
    /const workflowAgentNode = computed\(\(\) =>\s*canvasNodeById\(workflowAgentNodeId\.value\) \|\|\s*activeCanvasNode\.value\s*\)/,
    'Agent detail should use the same cross-stage resolver as the card action that opened it'
  )
  assert.match(
    appVue,
    /const fullscreenCanvasNode = computed\(\(\) =>\s*canvasNodeById\(workflowFullscreenNodeId\.value\) \|\|\s*\(workflowFullscreenNodeOverride\.value\?\.id === workflowFullscreenNodeId\.value \? workflowFullscreenNodeOverride\.value : null\)\s*\)/,
    'fullscreen detail should render the resolved cross-stage node or the visible child-stage node snapshot after the fullscreen action sets its id'
  )
})

test('requirement dissection detail hides duplicate raw model fields when report artifact exists', () => {
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-if="isFullscreenEditing(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)

  assert.match(
    overviewTemplate,
    /showModelReturnSummary\(fullscreenNode\) && !isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !shouldUseRequirementReportDetail\(fullscreenNode\)/,
    'requirement report detail should hide the generic model-return summary when structured report exists'
  )
  assert.match(
    overviewTemplate,
    /showNodeOwnContentSummary\(fullscreenNode\) && !isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !hasPageLayoutArtifact\(fullscreenNode\) && !shouldUseRequirementReportDetail\(fullscreenNode\)/,
    'requirement report detail should hide duplicate node content chips'
  )
  assert.match(
    canvasVue,
    /function shouldUseRequirementReportDetail\(node = \{\}\)[\s\S]*isRequirementDissectionNode\(node\) && hasRequirementDissectionArtifact\(node\)/,
    'requirement report gating should be centralized and based on backend-owned artifacts'
  )
  assert.doesNotMatch(
    canvasVue,
    /<strong>模型产出内容<\/strong>[\s\S]{0,240}<section v-if="isRequirementDissectionNode\(fullscreenNode\) && hasRequirementDissectionArtifact\(fullscreenNode\)"/,
    'generic raw model content should not appear before the report in requirement dissection detail'
  )
})

test('requirement dissection section detail hides generic fullscreen tree fallback', () => {
  assert.match(
    canvasVue,
    /<div v-if="!isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !isAgentConfirmationNode\(fullscreenNode\) && !shouldUseRequirementPipelineDetail\(fullscreenNode\) && !shouldUseRequirementSectionDetail\(fullscreenNode\)"/,
    'requirement section detail should not render the generic canvas-detail-tree fallback underneath structured artifact detail'
  )
})

test('requirement pipeline detail hides generic fullscreen tree fallback', () => {
  assert.match(
    canvasVue,
    /<div v-if="!isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !isAgentConfirmationNode\(fullscreenNode\) && !shouldUseRequirementPipelineDetail\(fullscreenNode\) && !shouldUseRequirementSectionDetail\(fullscreenNode\)"/,
    'requirement pipeline detail should use its document renderer only, without the generic tree fallback underneath'
  )
})

test('fullscreen requirement details hide imported content while node is generating', () => {
  assert.match(
    canvasVue,
    /v-if="!isNodeActuallyLoading\(fullscreenNode\) && shouldUseRequirementPipelineDetail\(fullscreenNode\)"/,
    'pipeline document detail should not render stale imported content while the node is generating'
  )
  assert.match(
    canvasVue,
    /v-else-if="!isNodeActuallyLoading\(fullscreenNode\) && shouldUseRequirementSectionDetail\(fullscreenNode\)"/,
    'section detail should not render stale imported content while the node is generating'
  )
})

test('requirement dissection section detail avoids duplicate headers and technical source labels', () => {
  const sectionStart = canvasVue.indexOf('v-if="shouldUseRequirementSectionDetail(fullscreenNode)"')
  const sectionEnd = canvasVue.indexOf('<div v-else-if="isAgentConfirmationNode(fullscreenNode)"', sectionStart)
  const sectionTemplate = canvasVue.slice(sectionStart, sectionEnd)
  const pipelineStart = canvasVue.indexOf('v-if="shouldUseRequirementPipelineDetail(fullscreenNode)"')
  const pipelineEnd = canvasVue.indexOf('<section\n            v-else-if="shouldUseRequirementSectionDetail(fullscreenNode)"', pipelineStart)
  const pipelineTemplate = canvasVue.slice(pipelineStart, pipelineEnd)

  assert.doesNotMatch(
    canvasVue,
    /<p v-if="fullscreenNodeSubtitle\(fullscreenNode\)">\{\{ fullscreenNodeSubtitle\(fullscreenNode\) \}\}<\/p>/,
    'fullscreen header should not show duplicate generated subtitles under the node title'
  )
  assert.doesNotMatch(
    canvasVue,
    /function fullscreenNodeSubtitle\(node = \{\}\)/,
    'duplicate fullscreen subtitle helper should be removed from the canvas'
  )
  assert.doesNotMatch(
    pipelineTemplate,
    /requirementPipelineTab\(fullscreenNode\)\.title|requirementPipelineTab\(fullscreenNode\)\.summary/,
    'requirement pipeline detail should not render a duplicate tab title/summary card above the document body'
  )
  assert.doesNotMatch(
    sectionTemplate,
    /requirementSectionDetail\(fullscreenNode\)\.title|requirementSectionDetail\(fullscreenNode\)\.source|来自模型 artifact/,
    'structured section content should not repeat the page title or expose technical artifact source labels'
  )
})

test('advanced UX canvas cards suppress title-only duplicate summary and content chips', () => {
  assert.ok(
    canvasVue.includes(".replace(/^节点\\s*\\d+\\s*[:：]\\s*/u, '')"),
    'canvas display should normalize node-number prefixes before duplicate comparison'
  )
  assert.match(
    canvasVue,
    /function nodeTextDuplicatesTitle\(value = '', node = \{\}\)[\s\S]*normalizeNodeDisplayComparison\(node\.title/,
    'canvas display should compare summary/content against the node title generically'
  )
  assert.match(
    canvasVue,
    /function canvasNodeSummary\(node = \{\}\)[\s\S]*nodeTextDuplicatesTitle\(summary, node\)[\s\S]*return ''/,
    'canvas summary should hide title-only duplicate copy'
  )
  assert.match(
    canvasVue,
    /function compactNodeContent\(node = \{\}\)[\s\S]*filterDuplicateNodeDisplayItems\(/,
    'canvas content chips should hide title-only duplicate copy'
  )
  assert.match(
    canvasVue,
    /function nodeOwnSummaryItems\(node = \{\}, limit = 0\)[\s\S]*filterDuplicateNodeDisplayItems\(items, node\)/,
    'fullscreen own-content summary should reuse the same duplicate filtering rules'
  )
})

test('fullscreen canvas detail shows one loading state instead of duplicate generating fields', () => {
  const overviewStart = canvasVue.indexOf('<section class="canvas-detail-overview">')
  const overviewEnd = canvasVue.indexOf('<div v-if="isFullscreenEditing(fullscreenNode)"', overviewStart)
  const overviewTemplate = canvasVue.slice(overviewStart, overviewEnd)
  const treeStart = canvasVue.indexOf('class="canvas-detail-tree"')
  const treeTemplateStart = canvasVue.lastIndexOf('<div v-if=', treeStart)
  const treeTemplate = canvasVue.slice(treeTemplateStart, treeStart + 240)

  assert.match(
    overviewTemplate,
    /<article v-if="isNodeActuallyLoading\(fullscreenNode\)" class="canvas-fullscreen-loading-state">/,
    'fullscreen detail should render a single dedicated loading block while a node is generating'
  )
  assert.match(
    overviewTemplate,
    /showNodeOwnContentSummary\(fullscreenNode\) && !isNodeActuallyLoading\(fullscreenNode\)/,
    'fullscreen model-output summary should be hidden during generating state'
  )
  assert.match(
    overviewTemplate,
    /<p v-if="canvasNodeSummary\(fullscreenNode\)">\{\{ canvasNodeSummary\(fullscreenNode\) \}\}<\/p>/,
    'fullscreen model-output summary should reuse the shared duplicate-clean summary helper'
  )
  assert.match(
    treeTemplate,
    /!isNodeActuallyLoading\(fullscreenNode\)/,
    'fullscreen generic tree should be hidden during generating state to avoid repeated loading fields'
  )
})

test('fullscreen canvas generic tree filters duplicate summary and content rows', () => {
  assert.match(
    canvasVue,
    /function normalizeTreeItems\(node = \{\}\) \{[\s\S]*filterDuplicateNodeDisplayItems\([\s\S]*node,[\s\S]*canvasNodeSummary\(node\)/,
    'generic tree rows should share duplicate filtering with card and fullscreen summaries'
  )
})

test('workflow fullscreen detail avoids card inside card framing for plain model output', () => {
  assert.match(
    stylesSource,
    /\.canvas-detail-overview[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*padding:\s*0;/,
    'fullscreen detail overview should be an unframed layout container instead of an outer card'
  )
  assert.match(
    stylesSource,
    /\.canvas-fullscreen-content \.canvas-tree-node[\s\S]*border:\s*0;[\s\S]*border-bottom:\s*1px solid #eef2f6;[\s\S]*background:\s*transparent;/,
    'plain model output rows should use text-row dividers instead of nested dashed cards'
  )
  assert.doesNotMatch(
    stylesSource.slice(
      stylesSource.indexOf('.canvas-fullscreen-content .canvas-tree-node'),
      stylesSource.indexOf('.canvas-path-graph', stylesSource.indexOf('.canvas-fullscreen-content .canvas-tree-node'))
    ),
    /border:\s*1px dashed/,
    'fullscreen tree rows should not reintroduce dashed framed chips'
  )
})

test('workflow fullscreen detail uses one left-aligned layout shell across skills', () => {
  const pipelineStart = canvasVue.indexOf('v-if="shouldUseRequirementPipelineDetail(fullscreenNode)"')
  const pipelineEnd = canvasVue.indexOf('<section\n            v-else-if="shouldUseRequirementSectionDetail(fullscreenNode)"', pipelineStart)
  const pipelineTemplate = canvasVue.slice(pipelineStart, pipelineEnd)

  assert.match(
    stylesSource,
    /\.canvas-fullscreen-content[\s\S]*justify-items:\s*stretch;[\s\S]*text-align:\s*left;/,
    'fullscreen canvas detail shell should left-align all skill detail content by default'
  )
  assert.match(
    stylesSource,
    /\.canvas-detail-overview[\s\S]*width:\s*100%;[\s\S]*justify-items:\s*stretch;[\s\S]*text-align:\s*left;/,
    'fullscreen detail overview should stretch to the left instead of centering as a narrow card'
  )
  assert.match(
    stylesSource,
    /\.requirement-pipeline-document[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*margin:\s*0;/,
    'requirement pipeline document should use the same left-aligned full-width layout shell'
  )
  for (const className of ['interaction-page-detail-split', 'visual-gallery-detail', 'preview-code-detail', 'acceptance-deposit-detail']) {
    assert.match(
      stylesSource,
      new RegExp(`\\.${className}\\s*\\{[^}]*width:\\s*100%;[^}]*justify-items:\\s*stretch;[^}]*text-align:\\s*left;`),
      `${className} should share the left-aligned full-width detail shell`
    )
  }
  assert.match(
    stylesSource,
    /\.page-lofi-wireframe-board\.mobile[\s\S]*margin:\s*0;[\s\S]*justify-self:\s*start;/,
    'mobile low-fidelity prototype detail should start from the left edge instead of centering in fullscreen detail'
  )
  assert.match(
    stylesSource,
    /\.canvas-fullscreen-content :where\(article, section, div, p, pre, ul, li, span, small, strong, b\)[\s\S]*text-align:\s*left;/,
    'nested detail text should inherit left alignment unless a specific preview component overrides it'
  )
  assert.doesNotMatch(
    pipelineTemplate,
    /<p>\{\{ section\.summary \}\}<\/p>/,
    'requirement pipeline chapters should not render section summary as a duplicate paragraph under the heading'
  )
})

test('fullscreen requirement document headings align with table left edge', () => {
  assert.match(
    stylesSource,
    /\.requirement-pipeline-section\s*>\s*header,\s*\.requirement-pipeline-block\s*>\s*header\s*\{[\s\S]*padding-left:\s*0;[\s\S]*margin-left:\s*0;/,
    'requirement document chapter and block headings should use the same left edge as the table block'
  )
  assert.match(
    stylesSource,
    /\.requirement-document-block h3\s*\{[\s\S]*padding-left:\s*0;[\s\S]*margin-left:\s*0;/,
    'requirement document subheadings should not inherit any title indentation'
  )
  assert.match(
    stylesSource,
    /\.requirement-pipeline-block\.layout-table \.requirement-detail-table[\s\S]*margin-left:\s*0;[\s\S]*justify-self:\s*stretch;/,
    'requirement detail tables should remain on the same stretched left edge as their heading'
  )
})

test('workflow canvas supports huge workspace and trackpad pinch zoom', () => {
  assert.match(
    canvasVue,
    /const CANVAS_SURFACE_WIDTH = 24000[\s\S]*const CANVAS_SURFACE_HEIGHT = 32000/,
    'workflow canvas should expose a large workspace that can hold many cards horizontally and vertically'
  )
  assert.match(
    canvasVue,
    /:width="CANVAS_SURFACE_WIDTH"[\s\S]*:height="CANVAS_SURFACE_HEIGHT"/,
    'edge SVG should expand with the large canvas surface'
  )
  assert.match(
    canvasVue,
    /@wheel="handleCanvasWheel"/,
    'canvas scrollarea should listen for precision trackpad pinch wheel events'
  )
  assert.match(
    canvasVue,
    /function handleCanvasWheel\(event\)[\s\S]*if \(!event\.ctrlKey && !event\.metaKey && !event\.deltaZ\) return[\s\S]*event\.preventDefault\(\)[\s\S]*emit\('zoom', zoomDelta\)/,
    'pinch zoom should only intercept gesture-like wheel events and emit normalized zoom deltas'
  )
  assert.match(
    stylesSource,
    /\.workflow-canvas-surface[\s\S]*width:\s*24000px;[\s\S]*height:\s*32000px;/,
    'base canvas surface should be much larger than the viewport'
  )
  assert.match(
    stylesSource,
    /\.workflow-canvas-surface\.requirement-dissection-board[\s\S]*width:\s*24000px;[\s\S]*min-height:\s*32000px;/,
    'requirement dissection grid board should keep the same large workspace capacity'
  )
  assert.match(
    appVue,
    /workflowCanvasZoom\.value = Math\.min\(2\.2, Math\.max\(0\.25, workflowCanvasZoom\.value \+ delta\)\)/,
    'workflow zoom bounds should allow deeper zoom out and larger zoom in for big canvases'
  )
})

test('workflow analysis record cards open the same workflow page in a new tab', () => {
  const entryStart = appVue.indexOf('class="workflow-record-card"')
  const entryEnd = appVue.indexOf('<div class="workflow-record-cover">', entryStart)
  const entrySource = appVue.slice(entryStart, entryEnd)
  const restoreStart = appVue.indexOf('function restoreWorkflowAnalysisFromUrl')
  const restoreEnd = appVue.indexOf('function returnToWorkflowEntry', restoreStart)
  const restoreSource = appVue.slice(restoreStart, restoreEnd)

  assert.match(
    entrySource,
    /:href="workflowAnalysisDeepLink\(record\.id\)"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"/,
    'record cards should open the same workflow analysis deep-link route in a new tab'
  )

  assert.doesNotMatch(
    entrySource,
    /@click="handleWorkflowAnalysisRecordClick/,
    'record cards should not intercept normal clicks and steal the current workflow page'
  )

  assert.match(
    restoreSource,
    /ensureWorkflowDeepLinkRouteState\(\)[\s\S]*workflowCanvasLoading\.value = true[\s\S]*loadWorkflowRunDetail\(runId,\s*\{ fallbackRun:\s*run \}\)/,
    'the new tab should hydrate the saved backend run detail on the same workflow canvas route'
  )

  assert.match(
    appVue,
    /function workflowCanvasRestoreCandidateRun\(\) \{[\s\S]*const routeRunId = currentWorkflowAnalysisDeepLinkRunId\(\)[\s\S]*if \(routeRunId && run\.id !== routeRunId\) return false/,
    'deep-linked workflow pages must not restore a different historical run as a fallback canvas'
  )

  assert.doesNotMatch(
    restoreSource,
    /regenerateWorkflowStage|analyzeWorkflowDocuments\(/,
    'opening a saved record must not rerun the workflow generation flow'
  )
})

test('workflow canvas fullscreen model output defaults to three lines', () => {
  assert.match(
    canvasVue,
    /nodeOwnSummaryItems\(fullscreenNode, 3\)/,
    'fullscreen model output should render only the first three lines by default'
  )

  assert.match(
    canvasVue,
    /function nodeOwnSummaryItems\(node = \{\}, limit = 0\)/,
    'nodeOwnSummaryItems should accept a display limit'
  )
})

test('workflow canvas hides duplicate fullscreen summaries when page layout artifact is available', () => {
  assert.match(
    canvasVue,
    /showNodeOwnContentSummary\(fullscreenNode\) && !isNodeActuallyLoading\(fullscreenNode\) && !isStageSpecificDetail\(fullscreenNode\) && !hasPageLayoutArtifact\(fullscreenNode\)/,
    'page layout fullscreen should not show a duplicate model-output summary above the wireframe'
  )
  assert.match(
    canvasVue,
    /v-if="!hasPageLayoutArtifact\(fullscreenNode\)" class="interaction-page-wireframe"/,
    'page layout fullscreen should not render the fallback page architecture panel alongside the artifact wireframe'
  )
  assert.match(
    canvasVue,
    /v-if="!hasPageLayoutArtifact\(fullscreenNode\)" class="interaction-page-spec"/,
    'page layout fullscreen should not render the fallback interaction spec panel alongside the artifact wireframe'
  )
})

test('workflow canvas uses active stage canvas nodes outside agent workbench stages', () => {
  assert.match(
    canvasVue,
    /const activeStageDisplayNodes = computed\(\(\) => \{[\s\S]*if \(!shouldRenderAgentWorkbench\.value\) return activeSliceStageCanvasNodes\.value/,
    'non-agent stages should render the active stage canvas nodes instead of stale root canvas nodes'
  )
})

test('workflow canvas fullscreen prioritizes the wireframe and hides auxiliary artifact metadata', () => {
  const layoutStart = canvasVue.indexOf('<section v-if="hasPageLayoutArtifact(fullscreenNode)" class="canvas-page-layout-artifact">')
  const layoutEnd = canvasVue.indexOf('<section v-if="!hasPageLayoutArtifact(fullscreenNode)" class="interaction-page-wireframe">', layoutStart)
  const layoutTemplate = canvasVue.slice(layoutStart, layoutEnd)

  const asciiIndex = layoutTemplate.indexOf('page-framework-code-block')
  assert.ok(asciiIndex >= 0, 'fullscreen artifact should keep the backend ASCII wireframe inside the main framework document')
  assert.equal(
    layoutTemplate.includes('<b>模块交互明细</b>'),
    false,
    'interaction details should remain in the backend artifact but not render as a separate fullscreen card'
  )
  assert.equal(
    layoutTemplate.includes('<b>模型推荐方案</b>'),
    false,
    'model recommendation should remain in the backend artifact but not render as a separate fullscreen card'
  )

  assert.equal(
    canvasVue.includes('class="canvas-page-layout-panel compact-recommendation"'),
    false,
    'hidden auxiliary metadata should not keep a dedicated recommendation panel in the frontend template'
  )
  assert.equal(
    layoutTemplate.includes('<b>前端接管</b>'),
    false,
    'frontend handoff should remain in the backend artifact but not render as a separate fullscreen card'
  )
  assert.equal(
    layoutTemplate.includes('<b>后端接管</b>'),
    false,
    'backend handoff should remain in the backend artifact but not render as a separate fullscreen card'
  )
})

test('workflow canvas keeps screen contract logic but hides it from fullscreen frontend display', () => {
  assert.equal(
    canvasVue.includes('<b>页面契约</b>'),
    false,
    'screen contract should not be displayed as a frontend fullscreen card'
  )
  assert.match(
    canvasVue,
    /function screenContractRows\(node = \{\}\)/,
    'screen contract parsing logic should stay available because later generation may depend on the artifact shape'
  )
  assert.match(
    canvasVue,
    /pageLayoutArtifact\(node\)\.screenContract/,
    'screen contract logic should still read the backend-owned pageLayoutArtifact screenContract'
  )
})

test('workflow canvas keeps requirement slice tabs above embedded agent overlay', () => {
  const sliceRailStart = canvasVue.indexOf('<section v-if="shouldShowRequirementSlices" class="workflow-total-slice-rail"')
  const sliceRailEnd = canvasVue.indexOf('</section>', sliceRailStart)
  const sliceRailSource = canvasVue.slice(sliceRailStart, sliceRailEnd)

  assert.match(
    stylesSource,
    /\.workflow-canvas-topbar[\s\S]*position:\s*relative;[\s\S]*z-index:\s*var\(--z-workflow-topbar\);/,
    'topbar should sit above the embedded Agent layer so small requirement tabs remain clickable'
  )

  assert.doesNotMatch(
    sliceRailSource,
    /requirementSlices\.length|slice\.priority|slice\.pageCount|slice\.pendingQuestionCount|个切片|个页面|待确认/,
    'small requirement rail should not show slice counts, page counts, priority, or pending-question metadata'
  )

  assert.match(
    canvasVue,
    /const filterableRequirementSlices = computed\(\(\) =>[\s\S]*sourceSliceIdForActiveSlice[\s\S]*stageCanvasNodeSource\.value\.some\(\(node\) => nodeMatchesSlice\(node, sourceSliceId\)\)/,
    'small requirement rail should only include slices that can actually filter current stage nodes'
  )

  assert.match(
    canvasVue,
    /const shouldShowRequirementSlices = computed\(\(\) =>[\s\S]*filterableRequirementSlices\.value\.length > 1/,
    'small requirement rail should hide when clicking would not change the canvas'
  )

  assert.match(
    stylesSource,
    /\.workflow-total-slice-card[\s\S]*min-height:\s*52px;[\s\S]*padding:\s*10px 16px;/,
    'small requirement cards should be compact once metadata subtitles are removed'
  )
})

test('workflow fullscreen detail stays above embedded agent and topbar but below nested confirm modal', () => {
  assert.match(
    stylesSource,
    /--z-agent-embedded:\s*210;[\s\S]*--z-workflow-topbar:\s*220;[\s\S]*--z-canvas-fullscreen:\s*300;[\s\S]*--z-agent-fullscreen:\s*320;[\s\S]*--z-modal:\s*340;[\s\S]*--z-agent-confirm-modal:\s*420;/,
    'workflow z-index tokens should keep fullscreen canvas details above embedded Agent/topbar and nested confirms above Agent'
  )

  assert.match(
    stylesSource,
    /\.canvas-fullscreen-modal[\s\S]*z-index:\s*var\(--z-canvas-fullscreen\);/,
    'canvas fullscreen should use the dedicated top detail token'
  )

  assert.match(
    appVue,
    /function openWorkflowCanvasFullscreen\(nodeId = '', options = \{\}\) \{[\s\S]*const targetNodeId = resolvedNode\?\.id \|\| candidateNode\?\.id \|\| workflowCanvasResolvableNodeId\(candidateNodeId\)[\s\S]*if \(!targetNodeId\) return[\s\S]{0,220}setWorkflowAgentDisplayMode\('hidden'\)[\s\S]*workflowFullscreenNodeId\.value = targetNodeId/,
    'opening a canvas fullscreen detail should close the side Agent before showing the fullscreen canvas'
  )
  assert.match(
    appVue,
    /function selectWorkflowCanvasNode\(nodeId\) \{[\s\S]*const keepFullscreenNode = workflowFullscreenNodeId\.value === nodeId[\s\S]*if \(!keepFullscreenNode\) workflowFullscreenNodeId\.value = ''/,
    'focusing the same card after a fullscreen button click should not immediately clear the fullscreen node'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer\.agent-drawer-embedded[\s\S]*z-index:\s*var\(--z-agent-embedded\);/,
    'embedded Agent should use the dedicated layer above canvas/detail content'
  )

  assert.match(
    drawerVue,
    /'--workflow-agent-embedded-top':\s*props\.inlineTop/,
    'embedded Agent should receive a measured top offset instead of relying on a fixed stage height'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer\.agent-drawer-sidebar[\s\S]*top:\s*0;[\s\S]*height:\s*100vh;[\s\S]*max-height:\s*100vh;/,
    'sidebar Agent should be a full-height special case while embedded Agent keeps adaptive topbar placement'
  )

  assert.match(
    appVue,
    /function updateWorkflowAgentInlineTop\(\)[\s\S]*querySelector\('\.workflow-canvas-topbar'\)[\s\S]*workflowAgentInlineTop\.value = `\$\{Math\.ceil\(rect\.bottom\)\}px`/,
    'App should measure the actual workflow topbar bottom for adaptive embedded Agent placement'
  )

  assert.match(
    appVue,
    /const workflowCurrentCanvasNodes = computed\(\(\) => \{[\s\S]*workflowCanvasRefreshingNodes\(uniqueWorkflowCanvasNodes\(nodes\)\)/,
    'current stage canvas nodes should receive the Agent confirm refreshing state, not only the unified fallback canvas'
  )

  assert.match(
    canvasVue,
    /function isNodeActuallyLoading\(node = \{\}\) \{[\s\S]*return Boolean\([\s\S]*node\.refreshing/,
    'refreshing stage nodes should show the loading state even when they already have page content'
  )

  assert.match(
    stylesSource,
    /\.agent-drawer\.agent-drawer-fullscreen[\s\S]*z-index:\s*var\(--z-agent-fullscreen\);/,
    'fullscreen Agent should sit above embedded Agent'
  )

  assert.match(
    stylesSource,
    /\.agent-confirm-backdrop[\s\S]*z-index:\s*var\(--z-agent-confirm-modal\);/,
    'Agent confirmation modal should sit above Agent fullscreen and ordinary modals'
  )
})

test('workflow requirement slice cards hide the subtitle goal line', () => {
  assert.doesNotMatch(
    canvasVue,
    /<span>\{\{ slice\.goal \}\}<\/span>/,
    'small requirement cards should not show the goal subtitle under the title'
  )
})

test('workflow agent renders structured tree fields as Chinese framed blocks', () => {
  assert.match(
    drawerVue,
    /currentRequirement:\s*'当前需求'/,
    'structured currentRequirement keys should render as Chinese titles'
  )

  assert.match(
    drawerVue,
    /outputType:\s*'输出类型'/,
    'structured outputType keys should render as Chinese titles'
  )

  assert.match(
    drawerVue,
    /structureTree:\s*'结构树'/,
    'structured structureTree keys should not leak as structure Tree'
  )

  assert.match(
    drawerVue,
    /function structuredAgentFrameKind\(key = '', title = '', value = ''\)/,
    'frontend should classify structure trees, framework layers and page skeletons before rendering'
  )

  assert.match(
    drawerVue,
    /function structuredAgentFrameText\(value, frameKind = '文本'\)/,
    'object or array structureTree values should be converted to readable tree text instead of raw JSON'
  )

  assert.match(
    drawerVue,
    /const frameText = structuredAgentFrameText\(value, frameKind\)/,
    'framed structured fields should use the display formatter that preserves readable hierarchy'
  )

  assert.match(
    drawerVue,
    /isPageLayoutArtifactKind\(section\.frameKind \|\| sectionTitle\)[\s\S]*pageLayoutArtifactSegment\(section\.frameKind \|\| sectionTitle, section\.frameText\)/,
    'page layout structured fields should become page-layout artifacts instead of the old generic frame card'
  )

  assert.match(
    drawerVue,
    /if \(segment\?\.type === 'frame'\) return Array\.isArray\(segment\?\.blocks\)/,
    'frame segments must count as renderable so they do not fall back to blank or plain text'
  )
})

test('workflow agent content cards do not rely on runtime template compilation', () => {
  assert.match(
    drawerVue,
    /import \{ computed, h,/,
    'inline card components should render with h() because the app uses runtime-only Vue'
  )
  assert.doesNotMatch(
    drawerVue,
    /const Agent(?:CardShell|CodeCard|TableCard|MarkdownCard)[\s\S]{0,900}?template:\s*`/,
    'inline agent card components must not use template strings that runtime-only Vue cannot compile'
  )
})

test('workflow agent stage session keeps assistant content when active node is a stage child', () => {
  const session = buildWorkflowAgentSession({
    id: 'run-stage-session',
    workflowId: 'total-design-flow',
    skillId: 'total-design-flow',
    currentStepId: '',
    agentSessions: {
      'requirement-dissection': [
        {
          id: 'user-1',
          role: 'user',
          content: '做一个茶饮点单小程序'
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '# 茶饮点单小程序产品方案\n\n## 产品定位\n\n完整模型回复内容。',
          meta: {
            action: 'workflow-analysis-result',
            status: 'success',
            clientMessageId: 'assistant-1'
          }
        }
      ]
    },
    documentAnalysis: {
      totalDesignFlow: {
        currentStage: 'requirement-dissection'
      }
    }
  }, {
    scopeId: 'requirement-dissection',
    activeNode: {
      id: 'requirement-source',
      title: '原始需求',
      stageId: 'requirement-dissection'
    },
    model: 'gpt-5.5'
  })

  assert.equal(session.scopeId, 'requirement-dissection')
  assert.equal(session.messages.length, 2)
  assert.match(session.messages[1].content, /茶饮点单小程序产品方案/)
})

test('workflow agent hides legacy placeholder messages from persisted sessions', () => {
  assert.match(
    drawerVue,
    /function isWorkflowAnalysisLegacyPlaceholder\(message = \{\}\)/,
    'drawer should centralize stale workflow-analysis placeholder detection'
  )

  assert.match(
    drawerVue,
    /正在连接模型，收到内容后会边生成边展示/,
    'legacy persisted model-connection placeholders should be filtered'
  )

  assert.match(
    drawerVue,
    /meta\.placeholderOnly/,
    'stream-target placeholders without model content should be hidden'
  )

  assert.match(
    drawerVue,
    /function isTruncatedWorkflowJsonFragment\(content = ''\)/,
    'legacy persisted JSON fragments from old truncated streams should be filtered'
  )

  assert.match(
    drawerVue,
    /api\/staff\/orders|PICKUP_CODE_INVALID|quality Report|missing information/,
    'known old truncated JSON stream fragments should not remain visible as assistant prose'
  )

  assert.match(
    drawerVue,
    /filter\(\(message\) => !isLegacyPlaceholderAgentMessage\(message\)\)/,
    'visible messages should filter placeholder-only and legacy local assistant copy'
  )

  assert.match(
    drawerVue,
    /function isLegacyAdvancedUxDownstreamPageLayoutArtifact\(message = \{\}\)[\s\S]*!isAdvancedUxAgentScope\(\)[\s\S]*stage-confirm-next[\s\S]*page-layout-artifact/,
    'advanced UX Agent should identify historical total-flow page-layout artifacts in every Advanced UX stage'
  )

  assert.match(
    drawerVue,
    /function agentSessionHasAdvancedUxReportMessage\(\)[\s\S]*advanced-ux-markdown-report[\s\S]*function isAdvancedUxAgentScope\(\)[\s\S]*agentSessionHasAdvancedUxReportMessage\(\)/,
    'advanced UX scope detection should survive restored sessions that still use requirement-dissection as the session key'
  )

  assert.match(
    drawerVue,
    /function shouldSuppressActiveNodePageLayoutArtifactInAgent\(\)[\s\S]*return isAdvancedUxAgentScope\(\)[\s\S]*function messagePageLayoutArtifact\(message = \{\}\)[\s\S]*shouldSuppressActiveNodePageLayoutArtifactInAgent\(\)[\s\S]*return null[\s\S]*const metaArtifact/,
    'advanced UX downstream Agent should not inject the selected canvas pageLayoutArtifact as a separate page skeleton card'
  )

  assert.match(
    drawerVue,
    /filter\(\(message\) => !isLegacyAdvancedUxDownstreamPageLayoutArtifact\(message\)\)/,
    'visible messages should hide legacy total-flow page skeleton cards in Advanced UX downstream stages'
  )

  assert.match(
    drawerVue,
    /filter\(\(message\) => !isLegacyAdvancedUxStageConfirmUserPrompt\(message\)\)/,
    'visible messages should hide historical system-authored Advanced UX stage-confirm prompts'
  )

  assert.match(
    drawerVue,
    /function shouldSuppressAdvancedUxAgentDiagnostics\(message = \{\}\)[\s\S]*isAdvancedUxAgentScope\(\)[\s\S]*messageRole\(message\) !== 'assistant'[\s\S]*return true/,
    'advanced UX Agent replies should suppress diagnostic metadata blocks for file and downstream messages'
  )

  assert.match(
    drawerVue,
    /function messageDataLookups\(message = \{\}\)[\s\S]*shouldSuppressAdvancedUxAgentDiagnostics\(message\)[\s\S]*return \[\]/,
    'advanced UX Agent should hide backend data lookup diagnostic rows'
  )

  assert.match(
    drawerVue,
    /function messageAnswerEvaluation\(message = \{\}\)[\s\S]*shouldSuppressAdvancedUxAgentDiagnostics\(message\)[\s\S]*return null/,
    'advanced UX Agent should hide answer-evaluation diagnostic rows'
  )

  assert.match(
    drawerVue,
    /function messageEvidencePack\(message = \{\}\)[\s\S]*shouldSuppressAdvancedUxAgentDiagnostics\(message\)[\s\S]*return null/,
    'advanced UX Agent should hide evidence-pack diagnostic rows'
  )
})

test('workflow agent recovers orphaned busy assistant messages when reopening a run', () => {
  assert.match(
    appVue,
    /function recoverInterruptedWorkflowAgentSessions\(run = \{\}\)[\s\S]*isWorkflowAgentBusyStatus\(status\)[\s\S]*AGENT_STREAM_INTERRUPTED/,
    'persisted pending/retrieving/generating assistant messages should be marked interrupted instead of waiting forever'
  )

  const openRunSource = appVue.slice(
    appVue.indexOf('function openWorkflowCanvasRun(run)'),
    appVue.indexOf('function openDialogueSkillRecord', appVue.indexOf('function openWorkflowCanvasRun(run)'))
  )

  assert.match(
    openRunSource,
    /const recoveredRun = recoverInterruptedWorkflowAgentSessions\(run\)/,
    'opening a workflow canvas should recover interrupted Agent sessions before display'
  )

  assert.match(
    openRunSource,
    /const analysisSessions = ensureWorkflowAnalysisAssistantMessageSession\(\{[\s\S]*run:\s*recoveredRun,[\s\S]*analysis:\s*recoveredRun\.documentAnalysis[\s\S]*\}\)/,
    'completed workflow canvas runs should rebuild the analysis assistant message from backend analysis when sessions are empty'
  )

  assert.match(
    openRunSource,
    /recoverInterruptedWorkflowAgentSessions\(\{[\s\S]*finalizeWorkflowAnalysisAgentSessions\(\{[\s\S]*\.\.\.recoveredRun,[\s\S]*agentSessions:\s*analysisSessions[\s\S]*\}\)/,
    'finalized analysis sessions should still clear orphaned busy assistant statuses after normal finalization'
  )
})

test('workflow agent clears stale interrupted errors from successful historical replies', () => {
  assert.match(
    appVue,
    /function workflowAgentSuccessMetaWithoutStaleInterruption\(meta = \{\}\)[\s\S]*AGENT_STREAM_INTERRUPTED[\s\S]*delete nextMeta\.error/,
    'successful assistant messages should drop stale interrupted errors before the Drawer renders them'
  )

  assert.match(
    appVue,
    /function workflowAgentTraceWithoutStaleInterruption\(trace = \[\], meta = \{\}\)[\s\S]*AGENT_STREAM_INTERRUPTED[\s\S]*status: 'done'/,
    'successful assistant messages should also repair stale failed trace rows from the interrupted recovery path'
  )

  assert.match(
    appVue,
    /finalizeWorkflowAnalysisAgentSessions\(run = \{\}\)[\s\S]*workflowAgentSuccessMetaWithoutStaleInterruption\(message\.meta[\s\S]*workflowAgentTraceWithoutStaleInterruption\(message\.trace/,
    'analysis finalization should normalize old success messages that still carry interrupted error metadata'
  )

  assert.match(
    appVue,
    /normalizeWorkflowAgentAssistantMessage\(message, fallbackMeta = \{\}\)[\s\S]*workflowAgentSuccessMetaWithoutStaleInterruption\(/,
    'stream and restored assistant messages should share the same stale-error cleanup path'
  )
})

test('advanced UX markdown reports dedupe restored file cards and clear interrupted placeholders', () => {
  assert.match(
    appVue,
    /function workflowAgentMessageMergeKey\(message = \{\}\)[\s\S]*advanced-ux-markdown-report[\s\S]*fileName/,
    'Advanced UX report messages should merge by report action and file name, not only by historical message id'
  )

  assert.match(
    appVue,
    /function workflowAgentSessionWithoutDuplicateAdvancedUxReports\(session = \[\]\)[\s\S]*seenAdvancedUxReportKeys[\s\S]*isAdvancedUxReportAssistantMessage/,
    'restored sessions should keep one visible file card per generated Advanced UX markdown file'
  )

  assert.match(
    appVue,
    /function workflowAgentMessageMergeKey\(message = \{\}\)[\s\S]*isFailedAdvancedUxReportMessage\(message\)[\s\S]*advanced-ux-markdown-report:failed/,
    'failed Advanced UX report messages without markdown should merge into one failure card even when historical file names differ'
  )

  assert.match(
    appVue,
    /function shouldDropInterruptedAnalysisPlaceholder\(message = \{\}, hasAdvancedUxReport = false\)[\s\S]*AGENT_STREAM_INTERRUPTED/,
    'stale interrupted analysis placeholders should be removed once the Advanced UX markdown report exists'
  )
})

test('advanced UX interrupted analyzing runs auto resume instead of polling forever', () => {
  assert.match(
    appVue,
    /function isInterruptedAdvancedUxRun\(run = \{\}\)/,
    'App should centralize detection for Advanced UX runs interrupted before markdown generation/import completed'
  )

  assert.match(
    appVue,
    /function isAdvancedUxWorkflowRun\(run = \{\}\)[\s\S]*advanced-ux-requirement-analysis[\s\S]*function isInterruptedAdvancedUxRun\(run = \{\}\)[\s\S]*run\.status !== 'analyzing' && run\.status !== 'analyzed'[\s\S]*workflowAnalysisHasGeneratingArtifacts[\s\S]*workflowAdvancedUxReportFromAnalysis/,
    'Interrupted Advanced UX detection should cover generating placeholders and historical analyzed-without-result runs that have no markdown report yet'
  )

  assert.match(
    appVue,
    /function shouldResumeWorkflowAnalysisRun\(run = null\)[\s\S]*isInterruptedAdvancedUxRun\(run\)/,
    'resume decision should treat interrupted Advanced UX placeholder runs as resumable even when they contain generating canvas data'
  )

  const pollingStart = appVue.indexOf('function startWorkflowAnalysisDeepLinkPolling')
  const pollingEnd = appVue.indexOf('function keepWorkflowAnalysisDeepLinkWaiting', pollingStart)
  const pollingSource = appVue.slice(pollingStart, pollingEnd)
  assert.match(
    pollingSource,
    /api\.workspace\.getWorkflowRun\(state\.apiConfig,\s*runId\)/,
    'deep-link polling should hydrate the current run detail instead of relying on compact workspace-list records'
  )

  assert.doesNotMatch(
    pollingSource,
    /api\.workspace\.load\(state\.apiConfig\)/,
    'deep-link polling should not use compact workspace-list records because they omit documentAnalysis detail'
  )

  assert.match(
    pollingSource,
    /isInterruptedAdvancedUxRun\(run\)[\s\S]*resumeWorkflowAnalysisRun\(run\)/,
    'deep-link polling should automatically rerun interrupted Advanced UX runs instead of waiting forever'
  )

  const resumeStart = appVue.indexOf('async function resumeWorkflowAnalysisRun')
  const resumeEnd = appVue.indexOf('function failWorkflowAnalysisDeepLink', resumeStart)
  const resumeSource = appVue.slice(resumeStart, resumeEnd)
  assert.match(
    resumeSource,
    /skillId:\s*baseRun\.skillId \|\| baseRun\.requestedSkillId \|\| 'total-design-flow'[\s\S]*requestedSkillId:\s*baseRun\.requestedSkillId \|\| baseRun\.skillId \|\| 'total-design-flow'[\s\S]*timeoutMs:\s*0[\s\S]*generationTimeoutMs:\s*0/,
    'auto resume should rerun with the original Advanced UX skill ids and no frontend generation timeout'
  )
})

test('advanced UX generating run explains markdown wait state instead of generic evidence trace', () => {
  assert.match(
    appVue,
    /function workflowAdvancedUxReportCandidateFromAnalysis\(analysis = \{\}\)/,
    'App should read Advanced UX report metadata even before markdown exists'
  )

  assert.match(
    appVue,
    /function isAdvancedUxMarkdownGeneratingRun\(run = \{\}\)[\s\S]*isAdvancedUxWorkflowRun\(run\)[\s\S]*workflowAdvancedUxReportCandidateFromAnalysis[\s\S]*checking\|repairing\|rechecking\|retrying/,
    'App should recognize Advanced UX runs that are still waiting for the markdown model result'
  )

  assert.match(
    appVue,
    /function advancedUxMarkdownGeneratingStatusText\(run = \{\}\)[\s\S]*checking[\s\S]*repairing[\s\S]*发现 \$\{issueCount \|\| '若干'\} 项缺失，第 1 次补齐中[\s\S]*retrying[\s\S]*仍有 \$\{issueCount \|\| '若干'\} 项缺失，第 2 次补齐中[\s\S]*后台正在生成高级 UX Markdown[\s\S]*模型尚未返回完整文档[\s\S]*刷新页面不会丢失任务/,
    'Advanced UX waiting copy should expose backend checking, repairing, retrying, automatic import, and refresh-safe states'
  )

  assert.match(
    appVue,
    /function workflowAdvancedUxGeneratingTraceItems\(run = \{\}\)[\s\S]*const markdownStatus[\s\S]*advancedUxMarkdownGeneratingStatusText\(run\)[\s\S]*Markdown 生成[\s\S]*markdownStatus[\s\S]*画布导入[\s\S]*生成完成后会自动导入需求分析画布/,
    'Advanced UX loading assistant should expose a specific markdown-generation trace instead of the generic evidence trace'
  )

  assert.match(
    appVue,
    /event\.data\?\.phase === 'advanced-ux-markdown'[\s\S]*repairState[\s\S]*persistWorkflowAnalysisBackgroundRun\(persistedPendingRun,\s*backgroundAnalysisResult,\s*\{ status: 'analyzing' \}\)/,
    'Advanced UX markdown status events should update and persist the run while backend repair is still active'
  )

  const loadingStart = appVue.indexOf('function createWorkflowAnalysisLoadingAssistantMessage')
  const loadingEnd = appVue.indexOf('function isAdvancedUxReportAssistantMessage', loadingStart)
  const loadingSource = appVue.slice(loadingStart, loadingEnd)
  assert.match(
    loadingSource,
    /const isAdvancedUxGenerating = isAdvancedUxMarkdownGeneratingRun\(run\)[\s\S]*content:\s*meta\.content \|\| \(isAdvancedUxGenerating \? advancedUxMarkdownGeneratingStatusText\(run\) : ''\)[\s\S]*trace:\s*isAdvancedUxGenerating \? workflowAdvancedUxGeneratingTraceItems\(run\) : workflowAgentPendingTraceItems\(\)[\s\S]*statusLabel:\s*isAdvancedUxGenerating \? '生成高级 UX Markdown' : '生成回复'/,
    'Advanced UX loading assistant should use the markdown wait copy, trace, and status label'
  )

  const pollingStart = appVue.indexOf('function startWorkflowAnalysisDeepLinkPolling')
  const pollingEnd = appVue.indexOf('function keepWorkflowAnalysisDeepLinkWaiting', pollingStart)
  const pollingSource = appVue.slice(pollingStart, pollingEnd)
  assert.match(
    pollingSource,
    /isAdvancedUxMarkdownGeneratingRun\(run\)\s*\? advancedUxMarkdownGeneratingStatusText\(run\)\s*:\s*'后台正在执行分析，完成后会自动展示结果。'/,
    'Deep-link polling should show the clearer Advanced UX markdown wait status while the backend keeps running'
  )
})

test('advanced UX quality gate failure keeps markdown file before canvas import', () => {
  assert.match(
    uploadsSource,
    /status:\s*'quality_failed'[\s\S]*markdown[\s\S]*qualityIssues[\s\S]*importError[\s\S]*repairState/,
    'backend should keep the model-returned markdown and repair state as a quality_failed file artifact when the quality gate blocks canvas import'
  )

  assert.match(
    uploadsSource,
    /const advancedUxRepairState[\s\S]*remainingIssueCount[\s\S]*const generateAdvancedUxMarkdownReport[\s\S]*const repairStatus = attempt === 1 \? 'repairing' : 'retrying'[\s\S]*第 1 次补齐中[\s\S]*第 2 次补齐中[\s\S]*advancedUxMarkdownStatus\(hooks,\s*'rechecking'/,
    'backend should expose the explicit repairing -> rechecking -> retrying -> rechecking state flow'
  )

  assert.match(
    uploadsSource,
    /report\.status === 'quality_failed'[\s\S]*failAdvancedUxMarkdownGenerationInTotalFlow[\s\S]*advancedUxMarkdownAnalysisResult[\s\S]*persistAdvancedUxWorkflowRun\(payload,\s*analysis,\s*'failed'\)/,
    'quality_failed markdown should persist as a failed run while preserving parsed section details for review'
  )
  assert.match(
    canvasVue,
    /requirementPipelineFailureMessages\(fullscreenNode\)\.length[\s\S]*门禁未通过，但已保留模型返回内容/,
    'quality_failed Advanced UX node details should show the parsed model content with a visible gate failure notice'
  )

  assert.match(
    uploadsSource,
    /function advancedUxMarkdownReportDisplayText\(report = \{\}\)[\s\S]*quality_failed[\s\S]*Markdown 文件已生成，但未通过质量门禁[\s\S]*暂未导入需求分析画布/,
    'Advanced UX file-card copy should distinguish quality_failed markdown from successfully imported markdown'
  )

  assert.match(
    appVue,
    /function workflowAdvancedUxMarkdownReportDisplayText\(report = \{\}\)[\s\S]*quality_failed[\s\S]*Markdown 文件已生成，但未通过质量门禁[\s\S]*暂未导入需求分析画布/,
    'frontend restored file-card copy should also distinguish quality_failed markdown from imported markdown'
  )
  assert.match(
    appVue,
    /function workflowAdvancedUxHasReviewableMarkdownFailure\(run = \{\}\)[\s\S]*report\.markdown[\s\S]*report\.sections[\s\S]*detailBlocks[\s\S]*function buildAdvancedUxFailedAnalysisResult\(run = \{\}\)[\s\S]*workflowAdvancedUxHasReviewableMarkdownFailure\(run\)\) return null/,
    'frontend should not replace quality_failed Advanced UX markdown sections with empty failed placeholder nodes'
  )

  const upsertStart = appVue.indexOf('function upsertAdvancedUxMarkdownReportAssistantMessage')
  const upsertEnd = appVue.indexOf('function upsertAdvancedUxPageInteractionDocumentAssistantMessage', upsertStart)
  const upsertSource = appVue.slice(upsertStart, upsertEnd)
  assert.match(
    upsertSource,
    /const reportStatus = String\(report\.status \|\| ''\)[\s\S]*status:\s*isFailedReport \? 'failed' : 'success'/,
    'frontend should render quality_failed markdown file cards as failed artifacts instead of success'
  )
})

test('workflow agent hides historical apply-to-canvas pending pairs', () => {
  assert.match(
    drawerVue,
    /function isLegacyApplyToCanvasPendingPair\(messages = \[\], index = 0\)/,
    'drawer should centralize detection for old 应用到画布 requests that were misrouted as normal chat'
  )

  assert.match(
    drawerVue,
    /isLegacyApplyToCanvasText\(messageContent\(message\)\)[\s\S]*isLegacyApplyToCanvasPendingAssistant\(nextMessage\)/,
    'the stale user 应用到画布 message should be hidden when followed by a busy placeholder assistant'
  )

  assert.match(
    drawerVue,
    /isLegacyApplyToCanvasPendingAssistant\(message\)[\s\S]*isLegacyApplyToCanvasText\(messageContent\(previousMessage\)\)/,
    'the stale busy assistant should be hidden when it belongs to an old 应用到画布 user message'
  )

  assert.match(
    drawerVue,
    /filter\(\(message, index, sourceMessages\) => !isLegacyApplyToCanvasPendingPair\(sourceMessages, index\)\)/,
    'visible messages should remove historical apply-to-canvas pending pairs before picking the latest busy assistant'
  )

  assert.match(
    appVue,
    /function localMessageIsLegacyApplyToCanvasPendingPair\(sourceSession = \[\], index = 0\)[\s\S]*workflowAgentMessageText\(message\)[\s\S]*workflowAgentMessageText\(previousMessage\)/,
    'persisted run merge should detect the same historical apply-to-canvas pending pairs'
  )

  assert.match(
    appVue,
    /localSession\.filter\(\(message, index\) =>[\s\S]*if \(localMessageIsLegacyApplyToCanvasPendingPair\(localSession, index\)\) return false/,
    'merge should not re-add historical apply-to-canvas pending pairs from local optimistic state'
  )
})

test('workflow agent keeps active workflow analysis loading visible', () => {
  const placeholderStart = drawerVue.indexOf('function isWorkflowAnalysisLegacyPlaceholder')
  const placeholderEnd = drawerVue.indexOf('function sanitizeAgentMessageDisplayContent', placeholderStart)
  const placeholderSource = drawerVue.slice(placeholderStart, placeholderEnd)
  const sanitizeStart = drawerVue.indexOf('function sanitizeAgentMessageDisplayContent')
  const sanitizeEnd = drawerVue.indexOf('function normalizeAgentMarkdownText', sanitizeStart)
  const sanitizeSource = drawerVue.slice(sanitizeStart, sanitizeEnd)

  assert.match(
    placeholderSource,
    /isMessageBusy\(message\)/,
    'active analysis loading messages should stay visible instead of being treated as legacy placeholders'
  )

  assert.match(
    placeholderSource,
    /meta\.action === 'workflow-analysis-result' && isMessageBusy\(message\)\) return false/,
    'busy workflow-analysis-result messages should render the shared loading UI'
  )

  assert.match(
    sanitizeSource,
    /replace\(\s*\/\\n\(\?:\[ \\t\]\*\\n\)\{2,\}\/g,\s*'\\n\\n'\s*\)/,
    'docx image/object placeholders that parse as whitespace-only blocks should be collapsed in Agent display'
  )
})

test('workflow analysis streamed content replaces the pending processing line', () => {
  assert.match(
    drawerVue,
    /<div v-else-if="shouldShowThinkingLoader\(message\)" class="agent-thinking-loader"/,
    'the pending loader should be gated by an explicit helper'
  )

  assert.match(
    drawerVue,
    /function shouldShowThinkingLoader\(message = \{\}\)[\s\S]*return isMessageBusy\(message\) && !messageContent\(message\)\.trim\(\)/,
    'busy assistant messages with streamed model content should render content instead of loader text'
  )

  assert.doesNotMatch(
    drawerVue,
    /正在处理：\$\{running\.label/,
    'the stuck processing summary should be removed from the UI'
  )
})

test('workflow analysis model reply includes page layout artifact for total-flow pages', () => {
  assert.match(
    appVue,
    /function workflowPageLayoutArtifactText\(analysis = \{\}\)/,
    'completed total-flow analysis should build a page-layout artifact for the first assistant reply'
  )

  const replyStart = appVue.indexOf('function workflowModelReplyText')
  const replyEnd = appVue.indexOf('function workflowAnalysisFallbackReplyText', replyStart)
  const replySource = appVue.slice(replyStart, replyEnd)
  assert.match(
    replySource,
    /workflowPageLayoutArtifactText\(analysis\)/,
    'workflowModelReplyText should prepend the page-layout artifact when total-flow pages exist'
  )

  assert.match(
    appVue,
    /:::page-layout-artifact title="页面骨架"/,
    'the initial analysis assistant reply should use the same artifact marker as Agent chat replies'
  )

  assert.match(
    appVue,
    /## 模型推荐方案[\s\S]*## ASCII 页面线框图[\s\S]*## 模块交互明细[\s\S]*## 前后端交付/,
    'the artifact should keep the detailed sections expected by the page-layout card'
  )

  assert.match(
    appVue,
    /if \(layoutArtifact\) return layoutArtifact/,
    'the initial Agent reply should show only the generated artifact card when the page skeleton result exists'
  )
})

test('advanced UX analysis uses markdown file message instead of total-flow page artifact replies', () => {
  assert.match(
    appVue,
    /function workflowAdvancedUxMarkdownReportDisplayText\(report = \{\}\)/,
    'App should centralize the short Advanced UX Markdown file-entry text'
  )

  const createMessageStart = appVue.indexOf('function createWorkflowAnalysisAssistantMessage')
  const createMessageEnd = appVue.indexOf('function createWorkflowAnalysisLoadingAssistantMessage', createMessageStart)
  const createMessageSource = appVue.slice(createMessageStart, createMessageEnd)
  assert.match(
    createMessageSource,
    /const advancedUxReport = workflowAdvancedUxReportFromAnalysis\(analysis\)[\s\S]*action: 'advanced-ux-markdown-report'/,
    'restored Advanced UX runs should rebuild an advanced-ux-markdown-report assistant message, not workflow-analysis-result'
  )
  assert.doesNotMatch(
    createMessageSource,
    /workflowPageLayoutArtifactText\(analysis\)[\s\S]*advanced-ux-markdown-report/,
    'Advanced UX assistant message creation should bypass total-flow page layout artifact generation'
  )

  assert.match(
    appVue,
    /upsertAdvancedUxMarkdownReportAssistantMessage\(baseRun\.id,\s*result\.data\.advancedUxReport/,
    'resumed Advanced UX runs should append the markdown file message instead of generic workflow analysis text'
  )

  assert.match(
    appVue,
    /event\.data\?\.type === 'advanced-ux-drawio-artifacts'[\s\S]*drawioArtifacts[\s\S]*upsertAdvancedUxMarkdownReportAssistantMessage/,
    'Advanced UX stream should merge backend Draw.io artifacts into the existing file-card assistant message'
  )

  assert.match(
    appVue,
    /event\.data\?\.type === 'advanced-ux-lowfi-wireframe-artifacts'[\s\S]*lowFiWireframeArtifacts[\s\S]*upsertAdvancedUxMarkdownReportAssistantMessage/,
    'Advanced UX stream should merge backend low-fi wireframe images into the existing file-card assistant message'
  )
})

test('workflow agent does not render page-layout-artifact blocks for advanced UX markdown report messages', () => {
  assert.match(
    drawerVue,
    /function isAdvancedUxMarkdownReportMessage\(message = \{\}\)/,
    'drawer should identify Advanced UX markdown report messages before artifact parsing'
  )

  const messageSegmentsStart = drawerVue.indexOf('function messageContentSegments')
  const messageSegmentsEnd = drawerVue.indexOf('function agentMarkdownRenderableBlocks', messageSegmentsStart)
  const messageSegmentsSource = drawerVue.slice(messageSegmentsStart, messageSegmentsEnd)
  assert.match(
    messageSegmentsSource,
    /if \(isAdvancedUxMarkdownReportMessage\(message\)\)[\s\S]*advancedUxMarkdownReportSegments\(message\)/,
    'Advanced UX markdown report messages should use a dedicated file-summary segment'
  )
  assert.match(
    messageSegmentsSource,
    /isAdvancedUxMarkdownReportMessage\(message\)[\s\S]*pageLayoutArtifactSegments/,
    'the Advanced UX guard should run before page-layout-artifact parsing'
  )

  assert.match(
    drawerVue,
    /meta\.action === 'advanced-ux-markdown-report'[\s\S]*hasMarkdown[\s\S]*isFailedReport[\s\S]*return hasMarkdown \|\| isFailedReport/,
    'failed Advanced UX report messages without markdown should still render through the dedicated report-card path instead of plain prose'
  )
})

test('advanced UX failed report messages without markdown render a failure card', () => {
  assert.match(
    drawerVue,
    /function advancedUxMarkdownReportSegments\(message = \{\}\)[\s\S]*hasMarkdown[\s\S]*isFailedReport/,
    'Advanced UX report segment builder should distinguish missing markdown from failed report status'
  )

  assert.match(
    drawerVue,
    /hasMarkdown\s*\?[\s\S]*高级 UX Markdown 文件已生成[\s\S]*未生成可导入的高级 UX Markdown 文件/,
    'failed Advanced UX report card should explain that no importable markdown file exists without pretending a file was generated'
  )

  assert.match(
    drawerVue,
    /markdown:\s*hasMarkdown \? String\(meta\.markdown \|\| ''\)\.trim\(\) : ''/,
    'failure cards should not fabricate markdown content when the backend did not return it'
  )

  assert.match(
    drawerVue,
    /const detailSource = computed\(\(\) => source\.value \|\| String\(cardProps\.summary \|\| ''\)\)/,
    'failure cards should use the failure summary as an expandable detail source when markdown is absent'
  )

  assert.match(
    drawerVue,
    /expandable:\s*Boolean\(detailSource\.value\)/,
    'failed Advanced UX file cards without markdown should still be openable for details'
  )

  assert.match(
    appVue,
    /advancedUxReportCandidate[\s\S]*artifactType:\s*advancedUxReportCandidate\.artifactType \|\| 'requirements-markdown'[\s\S]*markdown:\s*advancedUxReportCandidate\.markdown \|\| ''/,
    'restored quality-failed Advanced UX report cards should keep model markdown when the backend persisted it'
  )
})

test('advanced UX failure cards hide internal Codex runtime warnings from historical records', () => {
  assert.match(
    appVue,
    /ADVANCED_UX_GENERIC_FAILURE_REASON = '模型调用未生成可导入的高级 UX Markdown[\s\S]*function sanitizeAdvancedUxFailureReason\(reason = ''\)[\s\S]*isAdvancedUxInternalRuntimeNoise[\s\S]*ADVANCED_UX_GENERIC_FAILURE_REASON/,
    'App-level failed canvas/detail display should sanitize internal runtime noise from persisted failure reasons'
  )

  assert.match(
    drawerVue,
    /ADVANCED_UX_GENERIC_FAILURE_REASON = '模型调用未生成可导入的高级 UX Markdown[\s\S]*function sanitizeAdvancedUxFailureReason\(reason = ''\)[\s\S]*isAdvancedUxInternalRuntimeNoise[\s\S]*ADVANCED_UX_GENERIC_FAILURE_REASON/,
    'Agent file cards should sanitize internal runtime noise from historical failed Advanced UX messages'
  )

  assert.match(
    drawerVue,
    /codex_core_plugins[\s\S]*plugin catalog[\s\S]*401 Unauthorized[\s\S]*find_thread_path_by_id_str/,
    'sanitizer should identify Codex CLI plugin/startup warning text that must never be shown to users'
  )

  assert.match(
    drawerVue,
    /const issueText = sanitizeAdvancedUxFailureReason\(meta\.importError \|\| message\.content \|\| ''\)/,
    'Advanced UX failed file cards should use sanitized failure text instead of raw message content'
  )

  assert.match(
    appVue,
    /importError:\s*sanitizeAdvancedUxFailureReason\(advancedUxReportCandidate\.importError \|\| ''\)/,
    'restored Advanced UX report message metadata should not preserve raw internal warning text as importError'
  )
})

test('advanced UX markdown report messages render as openable file cards', () => {
  assert.match(
    drawerVue,
    /const AgentMarkdownFileCard = \{/,
    'Advanced UX markdown reports should have a dedicated file card renderer'
  )

  assert.match(
    drawerVue,
    /<AgentMarkdownFileCard\s+v-else-if="segment\.type === 'advanced-ux-file'"/,
    'Advanced UX markdown report segments should render as a file card instead of plain prose'
  )

  assert.match(
    drawerVue,
    /function advancedUxMarkdownReportSegments\(message = \{\}\)[\s\S]*markdown:\s*String\(meta\.markdown \|\| ''\)\.trim\(\)[\s\S]*type:\s*'advanced-ux-file'/,
    'the file card segment should carry the full markdown from message metadata'
  )

  assert.match(
    drawerVue,
    /async function exportMarkdownAsPdf\(markdown = '', fileName = '', title = ''\)[\s\S]*\/api\/workspace\/markdown-pdf[\s\S]*response\.blob\(\)/,
    'Markdown file cards should request a backend-generated PDF blob instead of opening a print window'
  )

  assert.match(
    drawerVue,
    /pdfFileName:\s*markdownFileNameToPdfFileName\(cardProps\.fileName \|\| '高级 UX 需求分析\.md'\)/,
    'Advanced UX markdown file cards should expose a PDF download action alongside the original md download'
  )

  assert.match(
    drawerVue,
    /const renderExpandedBody = \(\) => slots\.expanded\?\.\(\) \|\| renderBody\(\)[\s\S]*class: 'agent-content-card-expanded-body' \}, renderExpandedBody\(\)/,
    'expanded Agent cards should allow file cards to render a cleaner modal body than the compact card body'
  )

  assert.match(
    drawerVue,
    /expanded:\s*\(\) => detailSource\.value[\s\S]*agent-markdown-message agent-markdown-file-preview[\s\S]*detailBlocks\.value\.map\(renderAgentMarkdownBlock\)/,
    'Markdown file card modal should show the markdown body or, for failed reports without markdown, the failure detail body'
  )

  assert.doesNotMatch(
    drawerVue,
    /function advancedUxMarkdownReportSegments\(message = \{\}\)[\s\S]*pageInteractionDocument[\s\S]*segments\.push\(\{[\s\S]*title:\s*'页面交互文档'/,
    'Advanced UX requirement report messages must not merge the page interaction document into the same card'
  )

  assert.match(
    drawerVue,
    /function isAdvancedUxPageInteractionDocumentMessage\(message = \{\}\)[\s\S]*advanced-ux-page-interaction-document/,
    'the page interaction document should have its own Advanced UX message type'
  )

  assert.match(
    drawerVue,
    /function advancedUxPageInteractionDocumentSegments\(message = \{\}\)[\s\S]*title:\s*'页面交互文档'[\s\S]*fileName/,
    'the page interaction document should render as an independent file card when that stage generates it'
  )

  assert.match(
    drawerVue,
    /const AgentDrawioFileCard = \{/,
    'Advanced UX Draw.io artifacts should have a dedicated downloadable file card renderer'
  )

  assert.match(
    drawerVue,
    /<AgentDrawioFileCard\s+v-else-if="segment\.type === 'advanced-ux-drawio-file'"/,
    'Advanced UX Draw.io segments should render as file cards instead of prose'
  )

  assert.match(
    drawerVue,
    /<AgentLowFiWireframeCard\s+v-else-if="segment\.type === 'advanced-ux-lowfi-image'"/,
    'Advanced UX low-fi wireframe image segments should render as image cards'
  )

  assert.match(
    drawerVue,
    /const drawioArtifacts = Array\.isArray\(meta\.drawioArtifacts\)[\s\S]*meta\.drawioArtifacts\.filter/,
    'Advanced UX report messages should read backend-generated Draw.io artifacts from metadata'
  )

  assert.match(
    drawerVue,
    /drawioArtifacts\.forEach\(\(artifact\) => \{[\s\S]*type:\s*'advanced-ux-drawio-file'[\s\S]*content:\s*String\(artifact\.content \|\| ''\)\.trim\(\)/,
    'Advanced UX report messages should turn each backend Draw.io artifact into a downloadable segment'
  )

  assert.match(
    drawerVue,
    /const lowFiWireframeArtifacts = Array\.isArray\(meta\.lowFiWireframeArtifacts\)[\s\S]*meta\.lowFiWireframeArtifacts\.filter/,
    'Advanced UX report messages should read backend-generated low-fi images from metadata'
  )

  assert.match(
    drawerVue,
    /lowFiWireframeArtifacts\.forEach\(\(artifact\) => \{[\s\S]*type:\s*'advanced-ux-lowfi-image'[\s\S]*imageDataUrl:\s*artifact\.imageDataUrl/,
    'Advanced UX report messages should turn each backend low-fi image into a previewable segment'
  )

  assert.match(
    drawerVue,
    /if \(block\.type === 'table'\)[\s\S]*agent-markdown-table/,
    'markdown tables inside the file preview should render as visible tables instead of disappearing'
  )

  assert.match(
    drawerVue,
    /agentMarkdownRenderableBlocks\(source\.value,\s*\{\s*preservePlainTextCode:\s*true\s*\}\)/,
    'the full Advanced UX markdown file preview should preserve fenced text flowcharts as preformatted blocks'
  )

  assert.match(
    drawerVue,
    /if \(options\.preservePlainTextCode\) \{[\s\S]*blocks\.push\(\{ type: 'pre', text: value \}\)/,
    'plain text code fences should stay preformatted when rendering an opened markdown file'
  )

  assert.match(
    drawerVue,
    /function markdownTableCellContent[\s\S]*sixHatMarkdownLabel/,
    'markdown tables should decorate six-hat cells without changing backend business content'
  )

  assert.match(
    drawerVue,
    /sixHatMarkdownLabel[\s\S]*白帽[\s\S]*⚪[\s\S]*红帽[\s\S]*🔴[\s\S]*黑帽[\s\S]*⚫[\s\S]*黄帽[\s\S]*🟡[\s\S]*绿帽[\s\S]*🟢[\s\S]*蓝帽[\s\S]*🔵/,
    'six-hat review tables should show the colored hat markers users expect in markdown previews'
  )

  assert.match(
    stylesSource,
    /\.agent-markdown-file-preview\s+\.agent-markdown-pre[\s\S]*border:\s*1px\s+solid[\s\S]*background:\s*#f8fafc/,
    'Advanced UX markdown file preview should wrap flowcharts and wireframes in a visible preformatted document block'
  )

  assert.match(
    drawerVue,
    /const heading = raw\.match\(\/\^\(#\{1,6\}\)\\s\+\(\.\+\)\$\/\)/,
    'the markdown parser should preserve H4 feature headings from the UX output specification'
  )
})

test('advanced UX page interaction document is staged separately from the requirement report card', () => {
  assert.match(
    appVue,
    /function workflowAdvancedUxPageInteractionDocumentDisplayText\(document = \{\}\)[\s\S]*页面交互文档已生成/,
    'App should build a dedicated short message for the stage-2 page interaction document'
  )

  assert.match(
    appVue,
    /function upsertAdvancedUxPageInteractionDocumentAssistantMessage\(runId = '', document = \{\}\)[\s\S]*scopeId:\s*'interaction-lofi'[\s\S]*action:\s*'advanced-ux-page-interaction-document'/,
    'page interaction markdown should be inserted into the interaction-lofi Agent scope, not the requirement report message'
  )

  assert.match(
    appVue,
    /event\.data\?\.type === 'advanced-ux-page-interaction-document'[\s\S]*upsertAdvancedUxPageInteractionDocumentAssistantMessage\(persistedPendingRun\.id, event\.data\)/,
    'stage-2 stream artifacts should create the independent page-interaction file message'
  )

  const reportUpsertStart = appVue.indexOf('function upsertAdvancedUxMarkdownReportAssistantMessage')
  const reportUpsertEnd = appVue.indexOf('function upsertAdvancedUxPageInteractionDocumentAssistantMessage', reportUpsertStart)
  const reportUpsertSource = appVue.slice(reportUpsertStart, reportUpsertEnd)
  assert.doesNotMatch(
    reportUpsertSource,
    /pageInteractionDocument/,
    'the requirement report upsert should not attach pageInteractionDocument metadata to the stage-1 card'
  )
})

test('advanced UX next stage bypasses generic Agent summary and old page-layout rendering', () => {
  assert.match(
    appVue,
    /function workflowIsAdvancedUxActiveRun\(\)[\s\S]*advanced-ux-requirement-analysis/,
    'stage progression should detect the Advanced UX run before using the generic summary path'
  )

  assert.match(
    appVue,
    /async function confirmAdvancedUxStageWithoutGenericAgentSummary[\s\S]*action:\s*'advanced-ux-stage-confirm-next'[\s\S]*await regenerateWorkflowStage\(confirmedNextStageId\)/,
    'Advanced UX stage next should record progress and generate the next stage without asking the ordinary Agent for a page-layout summary'
  )

  assert.match(
    appVue,
    /function appendWorkflowStageAdvanceUserMessage\([\s\S]*workflowStageAdvanceUserMessage\(content\)[\s\S]*appendWorkflowAgentMessage\('user', displayContent,[\s\S]*action:\s*'stage-confirm-next'/,
    'clicking stage next should create a visible user-facing reply that says 进入下一阶段'
  )

  assert.match(
    appVue,
    /async function confirmAdvancedUxStageWithoutGenericAgentSummary[\s\S]*const stageAdvanceClientMessageId = appendWorkflowStageAdvanceUserMessage\(\{[\s\S]*scopeIds:\s*\[currentStageId,\s*confirmedNextStageId \|\| nextStageId\][\s\S]*\}\)[\s\S]*appendWorkflowAgentMessage\('assistant'/,
    'Advanced UX next should write the user stage-advance message before the system confirmation and mirror it into the next-stage visible scope'
  )

  assert.match(
    appVue,
    /async function confirmWorkflowStageWithAgentSummary\(payload = \{\}\)[\s\S]*if \(workflowIsAdvancedUxActiveRun\(\)\) \{[\s\S]*confirmAdvancedUxStageWithoutGenericAgentSummary[\s\S]*return[\s\S]*const result = await sendWorkflowAgentMessage/,
    'the Advanced UX bypass must run before the generic stage-confirm-next send path'
  )

  assert.match(
    appVue,
    /function isWorkflowAgentWorkbenchStageId\(stageId = ''\)[\s\S]*\['requirement-dissection',\s*'interaction-lofi',\s*'ui-visual'\]/,
    'interaction-lofi and UI visual must use the stage Agent scope so canvas actions stay visible in the shared stage conversation'
  )
})

test('top-level stage next mirrors the user instruction into the next visible Agent scope', () => {
  const summaryStart = appVue.indexOf('async function confirmWorkflowStageWithAgentSummary')
  const summaryEnd = appVue.indexOf('function isWorkflowAgentCanvasAdviceQuickReply', summaryStart)
  const summarySource = appVue.slice(summaryStart, summaryEnd)

  assert.match(
    summarySource,
    /const stageAdvanceClientMessageId = appendWorkflowStageAdvanceUserMessage\(\{[\s\S]*content:\s*action[\s\S]*currentStageId[\s\S]*nextStageId[\s\S]*scopeIds:\s*confirmedNextStageId !== targetScopeId \? \[confirmedNextStageId\] : \[\][\s\S]*\}\)/,
    'top-level next should mirror the user instruction into the newly visible next-stage Agent scope'
  )

  assert.match(
    summarySource,
    /await sendWorkflowAgentMessage\(workflowStageAdvanceUserMessage\(action\), \{[\s\S]*clientMessageId:\s*stageAdvanceClientMessageId/,
    'the current-stage Agent summary request should reuse the same client message id as the visible mirrored user instruction'
  )
})

test('Agent next-stage replies outside the stage workbench switch the canvas stage', () => {
  const sendStart = appVue.indexOf('async function sendWorkflowAgentMessage')
  const sendEnd = appVue.indexOf('function useWorkflowAgentQuickReply', sendStart)
  const sendSource = appVue.slice(sendStart, sendEnd)
  const quickStart = appVue.indexOf('function useWorkflowAgentQuickReply')
  const quickEnd = appVue.indexOf('if (isWorkflowAgentCanvasAdviceQuickReply(content))', quickStart)
  const quickSource = appVue.slice(quickStart, quickEnd)

  assert.match(
    appVue,
    /function isWorkflowStageAdvanceInput\(content = ''\)[\s\S]*进入下一阶段/,
    'stage-advance detection should include the visible Agent reply label 进入下一阶段'
  )

  assert.match(
    sendSource,
    /isWorkflowStageAdvanceInput\(content\)[\s\S]*workflowCanMoveToNextStage\.value[\s\S]*confirmWorkflowStageWithAgentSummary\(\{[\s\S]*stageId:\s*currentStageId[\s\S]*nextStageId:\s*nextStage\?\.id \|\| ''[\s\S]*mode:\s*'stage-agent-confirm-next'/,
    'typed Agent stage-advance input outside the stage workbench should route through the same stage progression flow'
  )

  assert.match(
    quickSource,
    /isWorkflowStageAdvanceInput\(normalizedContent\)[\s\S]*workflowCanMoveToNextStage\.value[\s\S]*runWorkflowNodeQuickAction\(\{[\s\S]*stageId:\s*currentStageId[\s\S]*nextStageId:\s*nextStage\?\.id \|\| ''[\s\S]*mode:\s*'stage-agent-confirm-next'/,
    'Agent quick reply stage-advance actions outside the stage workbench should switch the canvas stage immediately'
  )
})

test('advanced UX markdown file cards use compact attachment styling in the shared Agent shell', () => {
  assert.match(
    stylesSource,
    /\.agent-assistant \.agent-message-frame:has\(\.agent-markdown-file-card\)[\s\S]*border-radius:\s*24px[\s\S]*background:\s*#f3f4f6/,
    'assistant file messages should render as compact gray chat bubbles'
  )

  assert.match(
    stylesSource,
    /\.agent-markdown-file-preview\s*\{[\s\S]*display:\s*none[\s\S]*\.agent-content-card-expanded-body \.agent-markdown-file-preview\s*\{[\s\S]*display:\s*block/,
    'full markdown previews should stay collapsed in chat and open only in the shared expanded card'
  )
})

test('workflow agent requests include advanced UX markdown report context', () => {
  assert.match(
    appVue,
    /function workflowAdvancedUxReportContext\(run = state\.activeWorkflowRun \|\| \{\}\)/,
    'frontend should derive Advanced UX report context from the active run'
  )

  const requestContextStart = appVue.indexOf('function workflowAgentRequestContext')
  const requestContextEnd = appVue.indexOf('function workflowAgentAllowsProjectKnowledge', requestContextStart)
  const requestContextSource = appVue.slice(requestContextStart, requestContextEnd)
  assert.match(
    requestContextSource,
    /advancedUxReport:\s*workflowAdvancedUxReportContext\(state\.activeWorkflowRun \|\| \{\}\)/,
    'Agent request context should include the full Advanced UX markdown report when available'
  )

  assert.match(
    agentContextBuilderSource,
    /function renderAdvancedUxReport\(report = null\)[\s\S]*完整 Markdown 文件正文[\s\S]*不要说你看不到文件[\s\S]*report\.markdown/,
    'backend Agent prompt should include the full Advanced UX markdown report when the user asks about the file'
  )
})

test('structure diagram workbench is hidden from product navigation and legacy routes fall back to agent design', () => {
  assert.doesNotMatch(
    navigationSource,
    /key: 'diagrams'|label: '结构图'/,
    'the standalone diagram workbench should not appear as a product sidebar item'
  )

  assert.doesNotMatch(
    routeSource,
    /if \(projectRoute\?\.route === '\/diagrams'\) return 'diagrams'|if \(sourceHash === '#\/diagrams'\) return 'diagrams'/,
    'opening an old diagrams hash should not select a standalone diagrams product view'
  )

  assert.doesNotMatch(
    appVue,
    /applyRouteState\('diagrams'\)/,
    'legacy diagrams routes should be redirected into the Agent design workflow instead of mounting the workbench'
  )
})

test('workflow agent progress summary types on one line before details expand', () => {
  assert.match(
    drawerVue,
    /class="agent-trace-typewriter">\{\{ visibleTraceSummary\(message\) \}\}<\/span>/,
    'trace summary should render through one stable line'
  )

  assert.match(
    drawerVue,
    /class="agent-trace-typewriter agent-trace-typewriter-running">/,
    'pending trace text should keep the typing caret while busy'
  )

  assert.match(
    drawerVue,
    /function visibleTraceSummary\(message = \{\}\)/,
    'trace summary should fall back to the static summary after generation finishes'
  )

  assert.match(
    stylesSource,
    /\.agent-trace-typewriter[\s\S]*white-space:\s*nowrap;[\s\S]*overflow:\s*hidden;[\s\S]*text-overflow:\s*ellipsis;/,
    'trace summary should stay fixed to one visual line'
  )

  assert.match(
    stylesSource,
    /\.agent-trace-typewriter-running::after/,
    'pending trace caret should animate while the message is busy'
  )

  assert.doesNotMatch(
    stylesSource,
    /\.agent-trace-typewriter::after/,
    'completed trace summaries should not keep the typing caret'
  )
})

test('advanced UX stage one can use a controlled web evidence pack', () => {
  assert.match(
    uploadsSource,
    /buildAdvancedUxWebEvidencePack/,
    'advanced UX stage one should build a backend-owned web evidence pack before prompting the model'
  )

  assert.match(
    uploadsSource,
    /webSearchEnabled\s*!==\s*false/,
    'advanced UX web search should be enabled by default and opt-out via payload.webSearchEnabled === false'
  )

  assert.match(
    uploadsSource,
    /advancedUxEvidencePackPrompt/,
    'advanced UX prompt should include structured search evidence instead of letting the model invent facts'
  )

  assert.match(
    uploadsSource,
    /禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论/,
    'advanced UX prompt should prohibit facts outside the evidence pack'
  )

  assert.match(
    uploadsSource,
    /evidencePack/,
    'advanced UX report result should preserve the evidence pack for audit and rendering'
  )
})

test('advanced UX quality gate accepts 5 Whys tables that use question wording headers', () => {
  assert.match(
    uploadsSource,
    /advancedUxTablesWithColumns\(tables,\s*\['层级',\s*'问题',\s*'回答'\]\)/,
    '5 Whys quality gate should keep accepting the original 层级/问题/回答 table shape'
  )

  assert.match(
    uploadsSource,
    /advancedUxTablesWithColumns\(tables,\s*\['层级',\s*'追问',\s*'回答'\]\)/,
    '5 Whys quality gate should also accept the prompted 层级/追问/回答 table shape'
  )
})

test('advanced UX stage one requires demand understanding checklist in prompt and gate', () => {
  assert.match(
    uploadsSource,
    /需求理解清单/,
    'stage one prompt should explicitly require the demand understanding checklist'
  )

  assert.match(
    uploadsSource,
    /需求理解清单[\s\S]{0,80}原始诉求识别[\s\S]{0,80}需求清晰度评分表|原始诉求识别[\s\S]{0,120}需求理解清单[\s\S]{0,120}需求清晰度评分表/,
    'stage one prompt should require demand understanding between original intent and clarity scoring'
  )

  assert.match(
    uploadsSource,
    /\['需求要素',\s*'理解转译',\s*'置信度',\s*'依据'\]/,
    'quality gate should accept the standard demand understanding checklist headers'
  )

  assert.match(
    uploadsSource,
    /缺少需求理解清单/,
    'quality gate should fail documents missing the demand understanding checklist'
  )

  assert.match(
    uploadsSource,
    /需求理解清单位置错误/,
    'quality gate should fail documents that place the checklist in the wrong section order'
  )
})

test('workflow Agent composer exposes a removable web search toggle and sends it to backend', () => {
  assert.match(
    drawerVue,
    /webSearchEnabled:\s*\{\s*type:\s*Boolean,\s*default:\s*true\s*\}/,
    'Agent drawer should default the web-search toggle to enabled'
  )

  assert.match(
    drawerVue,
    /class="agent-web-search-toggle"[\s\S]*@click="\$emit\('toggle-web-search'\)"/,
    'Agent composer should render a clickable web-search toggle in the bottom toolbar'
  )

  assert.match(
    appVue,
    /const workflowAgentWebSearchEnabled\s*=\s*ref\(true\)/,
    'App should own the shared Agent web-search enabled state'
  )

  assert.match(
    appVue,
    /:web-search-enabled="workflowAgentWebSearchEnabled"/,
    'All Agent display modes should receive the same web-search toggle state through the single drawer'
  )

  assert.match(
    appVue,
    /@toggle-web-search="toggleWorkflowAgentWebSearch"/,
    'The Agent drawer should update the shared web-search state through one event path'
  )

  assert.match(
    appVue,
    /webSearchEnabled:\s*workflowAgentWebSearchEnabled\.value/,
    'Agent messages and workflow analysis payloads should send webSearchEnabled to the backend'
  )
})
