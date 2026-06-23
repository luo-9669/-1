const STATUS_LABELS = {
  locked: '未解锁',
  active: '可生成',
  generated: '待确认',
  challenged: '待确认',
  accepted: '已确认',
  completed: '已完成'
}

const EXAMPLE_INPUTS = {
  '目标创作者': '独立播客创作者、自媒体 IP、内容营销人员、轻量知识变现用户',
  '核心痛点': '出镜门槛高、脚本/配音/视频制作割裂、缺少灵感和一键同款、多端分发成本高',
  '产品定位': '零门槛的 AI 播客工作站',
  '一期范围': '脚本生成、音频播客生成、视频播客生成、图片+波纹图播客、作品存储、核心资产库',
  '成功标准': '用户能从一个想法、URL、文档或音频开始，在同一工作流内生成脚本、音频、视频并沉淀资产',
  '首页入口': 'Turn Your Ideas Into Podcasts 首屏创作模块',
  '输入方式': '文本提示词、URL 链接、上传 PDF/PPT/DOCX、上传音频',
  '核心编辑器': '左侧播客主持人选择，右侧脚本预览、编辑和生成操作',
  '关键操作': '预览音频、下载脚本、复制脚本、替换音色、角色对调、增加停顿、生成视频播客',
  '资产类型': '脚本&灵感库、音色&音频资产库、播客主播库、作品库、背景和波纹图',
  '分发渠道': 'YouTube，后续 Spotify、Apple Podcast、TikTok/Instagram Reels 短切片',
  '验收标准': '用户能从文本/URL/文档/音频任一入口开始，完成脚本生成或解析、预览音频、选择主持人和音色、生成视频播客并保存作品'
}

function stepNumber(step = {}, steps = []) {
  const index = steps.findIndex((item) => item.id === step.id)
  return index >= 0 ? index + 1 : 1
}

function previousStep(step = {}, steps = []) {
  const index = steps.findIndex((item) => item.id === step.id)
  return index > 0 ? steps[index - 1] : null
}

function compactReplies(items = [], fallback = []) {
  const seen = new Set()
  return [...items, ...fallback]
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function modelOptionLabel(model = '') {
  if (model === 'gpt-5.5') return 'GPT-5.5'
  return model || 'GPT-5.5'
}

export function lockReasonForStep(run = {}, step = {}) {
  if (step.status !== 'locked') return ''
  const steps = run.steps || []
  const previous = previousStep(step, steps)
  if (!previous) return '请先开始当前流程。'
  const required = (previous.requiredFields || []).join('、') || '前置信息'
  return `请先确认 Step ${stepNumber(previous, steps)} 的${required}。`
}

export function defaultWorkflowStepInputs(run = {}, step = {}, mode = 'example') {
  const source = mode === 'skip' ? '默认假设' : ''
  return Object.fromEntries((step.requiredFields || []).map((field) => {
    const value = EXAMPLE_INPUTS[field] || `${source}${field || '字段'}`
    return [field, value]
  }))
}

export function buildWorkflowWorkbenchView(run = {}) {
  const steps = run.steps || []
  const current = steps.find((step) => step.id === run.currentStepId) || steps[0] || {}
  const currentOutput = run.stepOutputs?.[current.id] || ''
  const currentDraft = run.stepDraftOutputs?.[current.id] || ''
  const hasDraft = Boolean(String(currentDraft || currentOutput).trim())
  const hasAccepted = Boolean(String(currentOutput).trim())
  const currentNumber = stepNumber(current, steps)

  return {
    title: 'AI 分步工作台',
    subtitle: 'AI 会先基于资料生成草稿，你可以编辑、质疑、重新生成，再采纳进入下一步。',
    steps: steps.map((step) => ({
      id: step.id,
      title: step.title,
      goal: step.goal,
      status: step.status,
      statusLabel: STATUS_LABELS[step.status] || '待处理',
      canInspect: true,
      lockReason: lockReasonForStep(run, step),
      requiredFields: step.requiredFields || [],
      hasOutput: Boolean(run.stepOutputs?.[step.id]),
      isCurrent: step.id === current.id
    })),
    current: {
      id: current.id,
      title: current.title,
      goal: current.goal,
      stepNumber: currentNumber,
      requiredFields: current.requiredFields || [],
      taskHint: `这一步用于${current.goal || '生成当前步骤草稿'}。AI 会先根据上传资料生成草稿，你可以编辑后确认。`,
      emptyOutputHint: '点击生成本步草稿后，AI 产出会出现在这里。',
      primaryAction: hasAccepted
        ? { id: 'next', label: currentNumber < steps.length ? '进入下一步' : '完成完整流程' }
        : hasDraft
          ? { id: 'accept-next', label: currentNumber < steps.length ? `采纳并进入 Step ${currentNumber + 1}` : '采纳并完成流程' }
          : { id: 'generate', label: '生成本步草稿' },
      secondaryActions: [
        { id: 'use-example', label: '使用示例' },
        { id: 'skip-defaults', label: '跳过，使用默认假设' },
        { id: 'view-evidence', label: '查看依据' },
        { id: 'regenerate', label: '重新生成', disabled: !hasDraft }
      ]
    }
  }
}

export function buildWorkflowAgentQuickReplies(run = {}, context = {}) {
  const current = context.current || (run.steps || []).find((step) => step.id === run.currentStepId) || (run.steps || [])[0] || {}
  const activeNode = context.activeNode || null
  const scopeId = context.scopeId || activeNode?.id || current.id || 'step'
  const draft = context.draft ?? run.stepDraftOutputs?.[current.id] ?? ''
  const output = context.output ?? run.stepOutputs?.[current.id] ?? ''
  const references = run.referenceFiles?.[scopeId] || []
  const hasDraft = Boolean(String(draft || '').trim())
  const hasOutput = Boolean(String(output || '').trim())
  const hasReferenceIssues = references.some((file) => ['failed', 'uploading', 'pending'].includes(file.status))
  const artifactReplies = []
  const artifacts = run.demoArtifacts || {}
  const actionType = context.actionResult?.type || context.actionType || ''
  const error = context.error || context.assistantMessage?.meta?.error || null
  const actionRepliesByType = {
    'module-breakdown': ['确认框架', '补接口契约', '拆前后端'],
    'page-generation': ['确认页面清单', '补交互状态', '补异常流程'],
    'interaction-flow': ['确认流程', '补边界状态', '生成低保真'],
    'agent-supplement': ['确认已更新', '继续补充', '查看后续影响'],
    blueprint: ['确认蓝图', '生成低保真', '补业务规则']
  }
  const hasConfigError = String(error?.code || '').includes('CONFIG') || /配置|key|api/i.test(error?.message || '')
  const errorReplies = error
    ? [
        '重试',
        '换模型',
        ...(hasConfigError ? ['检查配置'] : []),
        ...(error.recoveryActions || [])
      ]
    : []

  if (run.projectBlueprint) {
    if (!artifacts.lowFi) artifactReplies.push('生成低保真')
    else if (!artifacts.html) artifactReplies.push('生成可交互 HTML')
    else if (!artifacts.vueZipReady && !(artifacts.vueFiles || []).length) artifactReplies.push('导出 Vue 代码')
  } else if (hasOutput || hasDraft) {
    artifactReplies.push('生成蓝图')
  }

  const stateReplies = hasOutput
    ? ['进入下一步', '补充细节', '查看历史']
    : hasDraft
      ? ['采纳并进入下一步', '重新生成', '补充资料']
      : ['使用示例生成', '补充资料', '生成本步草稿', '无疑问，跳过']

  return compactReplies([
    ...errorReplies,
    ...(hasReferenceIssues ? ['检查参考文件'] : []),
    ...(actionRepliesByType[actionType] || []),
    ...(activeNode?.agentInteraction?.quickReplies || []),
    ...(activeNode?.quickActions || []),
    ...stateReplies,
    ...artifactReplies
  ], ['补充资料', '重新生成']).slice(0, 6)
}

export function buildWorkflowAgentSession(run = {}, options = {}) {
  const steps = run.steps || []
  const current = steps.find((step) => step.id === run.currentStepId) || steps[0] || {}
  const activeNode = options.activeNode || null
  const scopeId = activeNode?.id || current.id || 'step'
  const scopeTitle = activeNode?.title || current.title || '当前步骤'
  const scopeGoal = activeNode?.agentInteraction?.goal || activeNode?.agentScope || current.goal || ''
  const savedMessages = run.agentSessions?.[scopeId] || []
  const versions = run.stepVersions?.[current.id] || []
  const draft = run.stepDraftOutputs?.[current.id] || ''
  const output = run.stepOutputs?.[current.id] || ''
  const messages = [
    {
      id: `${scopeId}-intro`,
      role: 'assistant',
      content: activeNode
        ? `我们只讨论「${scopeTitle}」。${scopeGoal || '你可以补充、质疑或确认当前环节。'}`
        : `我们先回答 ${scopeTitle}。${scopeGoal || '我会根据资料生成草稿，你可以补充、质疑或采纳。'}`,
      createdAt: run.createdAt || ''
    },
    ...savedMessages.map((message, index) => ({
      id: message.id || `${scopeId}-message-${index}`,
      role: message.role || 'user',
      content: message.content || '',
      createdAt: message.createdAt || '',
      meta: message.meta || null
    }))
  ]

  if (draft || output) {
    messages.push({
      id: `${scopeId}-draft`,
      role: 'assistant',
      content: output ? `已采纳当前步骤输出：\n\n${output}` : `已生成草稿：\n\n${draft}`,
      createdAt: versions.at(-1)?.createdAt || ''
    })
  }

  const currentModel = options.model || run.model || 'gpt-5.5'
  const modelOptions = Array.isArray(options.modelOptions) && options.modelOptions.length
    ? options.modelOptions
    : [{ value: currentModel, label: modelOptionLabel(currentModel) }]
  if (!modelOptions.some((option) => option.value === currentModel)) {
    modelOptions.unshift({ value: currentModel, label: modelOptionLabel(currentModel) })
  }
  return {
    title: scopeTitle,
    subtitle: scopeGoal,
    scopeId,
    model: {
      current: currentModel,
      options: modelOptions
    },
    references: run.referenceFiles?.[scopeId] || [],
    messages,
    history: versions.map((version, index) => ({
      id: version.id || `${current.id}-version-${index}`,
      label: `${version.accepted ? '已采纳版本' : '版本'} ${index + 1}`,
      content: version.content || '',
      createdAt: version.createdAt || ''
    })),
    quickReplies: run.agentQuickReplies?.[scopeId]?.length
      ? run.agentQuickReplies[scopeId]
      : buildWorkflowAgentQuickReplies(run, {
        current,
        activeNode,
        scopeId,
        draft,
        output
      })
  }
}

export function buildWorkflowArtifactStages(run = {}) {
  const hasBlueprint = Boolean(run.projectBlueprint)
  const artifacts = run.demoArtifacts || {}
  const hasLowFi = Boolean(artifacts.lowFi)
  const hasHtml = Boolean(artifacts.html)
  const hasVue = Boolean(artifacts.vueZipReady || artifacts.vueFiles?.length)

  return [
    {
      id: 'blueprint',
      label: '项目蓝图',
      title: '出蓝图',
      description: '包含项目档案、流程树、页面细节、状态异常和评审清单。',
      status: hasBlueprint ? 'done' : 'available'
    },
    {
      id: 'lofi',
      label: '低保真',
      title: '生成低保真',
      description: '把蓝图转成页面级线框和控件说明。',
      status: hasLowFi ? 'done' : hasBlueprint ? 'available' : 'locked'
    },
    {
      id: 'html-demo',
      label: 'HTML Demo',
      title: '生成可交互 HTML',
      description: '基于低保真生成可点击 Demo，用来预览跳转和状态。',
      status: hasHtml ? 'done' : hasLowFi ? 'available' : 'locked'
    },
    {
      id: 'vue-export',
      label: 'Vue 导出',
      title: '导出 Vue 代码',
      description: '确认 Demo 后再导出前端工程代码。',
      status: hasVue ? 'done' : hasHtml ? 'available' : 'locked'
    }
  ]
}
