import { buildAnalysisQualityGate, buildAnalysisVersionDiff } from './analysis-quality.js'

function ensureCanvasNode(analysis, node) {
  const canvas = analysis.canvas || { nodes: [], edges: [], orderedTabs: [] }
  const nodes = Array.isArray(canvas.nodes) ? [...canvas.nodes] : []
  if (!nodes.some((item) => item.id === node.id)) nodes.push(node)
  const orderedTabs = Array.isArray(canvas.orderedTabs) ? [...canvas.orderedTabs] : []
  if (!orderedTabs.some((item) => item.key === node.id)) orderedTabs.push({ key: node.id, label: node.title })
  analysis.canvas = {
    ...canvas,
    nodes,
    edges: Array.isArray(canvas.edges) ? canvas.edges : [],
    orderedTabs
  }
}

function repairFrontendBackendBoundary(analysis, action = '') {
  analysis.blueprint = {
    ...(analysis.blueprint || {}),
    frontendHandoff: [
      '前端接管页面结构、表单输入、状态展示、错误提示和跳转。',
      '前端按接口契约提交 account、password、captchaCode、agreeTerms 等字段。'
    ],
    backendHandoff: [
      '后端接管认证、注册、验证码校验、token 签发、错误码和风控审计。',
      '后端返回稳定结构化错误码，避免前端解析自然语言。'
    ],
    apiContract: [
      {
        method: 'POST',
        path: '/api/auth/login',
        requestFields: ['account', 'password'],
        responseFields: ['token', 'user', 'redirectUri']
      },
      {
        method: 'POST',
        path: '/api/auth/register',
        requestFields: ['account', 'password', 'captchaCode', 'agreeTerms'],
        responseFields: ['registered', 'autoLogin', 'nextAction']
      }
    ],
    acceptanceCriteria: [
      '前端可根据错误码展示字段级或全局错误。',
      '后端接口契约可直接进入联调。',
      action || '补齐前后端边界后重新进入质量检查。'
    ]
  }
  ensureCanvasNode(analysis, {
    id: 'frontend-backend-boundary',
    title: '前后端接管边界',
    summary: '后端修复已补齐研发交接所需的分工、接口契约和验收口径。',
    content: [
      '前端：页面、交互、状态、错误提示。',
      '后端：认证、注册、验证码、token、错误码。',
      '接口：POST /api/auth/login、POST /api/auth/register。'
    ],
    quickActions: ['继续细化接口字段', '生成联调清单'],
    x: 700,
    y: 120,
    width: 340,
    height: 220
  })
}

function repairCanvasStructure(analysis) {
  ensureCanvasNode(analysis, {
    id: 'analysis',
    title: analysis.blueprint?.title || '需求分析结果',
    summary: analysis.input || '后端已补齐基础画布节点。',
    content: ['需求输入', '后端分析', '质量检查'],
    quickActions: ['重新分析', '补充上下文'],
    x: 80,
    y: 120,
    width: 320,
    height: 220
  })
}

function repairSchemaValidation(analysis) {
  analysis.blueprint = {
    title: analysis.input || '需求分析结果',
    type: 'project-blueprint',
    intent: analysis.routing?.detectedIntent || 'requirement-analysis',
    ...(analysis.blueprint || {})
  }
}

function repairSourceTraceability(analysis) {
  if (Array.isArray(analysis.documents)) return
  analysis.documents = []
}

function repairAgentSupplement(analysis, action = '') {
  const wantsModal = /(弹窗|弹层|浮层|对话框|modal|dialog|popup)/i.test(action)
  if (wantsModal) {
    analysis.detectedIntent = 'auth-modal'
    analysis.routing = {
      ...(analysis.routing || {}),
      detectedIntent: 'auth-modal'
    }
    analysis.blueprint = {
      ...(analysis.blueprint || {}),
      intent: 'auth-modal',
      type: 'modal-blueprint',
      title: '登录注册弹窗交互蓝图',
      profile: {
        ...(analysis.blueprint?.profile || {}),
        productName: '登录注册弹窗',
        positioning: '嵌入业务页面的认证 Modal',
        primaryGoal: '用户不离开当前页面即可完成登录、注册或找回密码，后端返回结构化结果驱动弹窗状态和画布刷新。'
      },
      handoff: {
        ...(analysis.blueprint?.handoff || {}),
        frontend: [
          '前端接管弹窗打开/关闭、遮罩/ESC、登录注册切换、字段校验、loading 和错误展示。',
          '前端点击提交时把表单字段提交给后端认证接口。',
          '前端点击补充到画布后展示刷新状态，并用后端返回的完整 canvas 替换当前画布。'
        ],
        backend: [
          '后端接管认证、注册、验证码、限流、token、错误码和审计。',
          '后端接管 Agent 补充合并、模型重算、schema 校验和完整画布返回。'
        ],
        dataFlow: [
          '前端收集弹窗表单',
          '前端提交认证接口',
          '后端返回 token/user/errorCode/nextAction',
          '用户确认 Agent 补充',
          '后端合并原画布和补充内容并重算',
          '前端替换完整画布'
        ]
      }
    }
    ensureCanvasNode(analysis, {
      id: 'auth-modal-flow',
      title: '登录注册弹窗交互流程',
      summary: '根据用户确认补充，已从独立页面调整为弹窗 Modal 方案。',
      content: [
        '打开：业务页面点击登录/注册触发 Modal。',
        '提交：弹窗内表单 POST 到后端认证接口。',
        '反馈：后端返回 token/user/errorCode/nextAction，前端更新弹窗或关闭。',
        '画布：补充确认后由后端重算并返回完整新画布。'
      ],
      quickActions: ['补关闭规则', '补错误码', '确认弹窗流程'],
      x: 520,
      y: 120,
      width: 340,
      height: 240
    })
    analysis.canvas.nodes = (analysis.canvas.nodes || []).map((node) => {
      if (node.id !== 'analysis') return node
      return {
        ...node,
        summary: '识别为登录注册弹窗需求，已按用户确认补充刷新。',
        content: [
          '形态：弹窗 Modal',
          '链路：前端提交后端，后端返回认证结果',
          '补充：用户确认内容已进入画布重算'
        ]
      }
    })
  }
}

function applyRepair(analysis, checkId, action) {
  if (checkId === 'node-reanalysis') {
    repairSchemaValidation(analysis)
    repairCanvasStructure(analysis)
  } else if (checkId === 'frontend-backend-boundary') repairFrontendBackendBoundary(analysis, action)
  else if (checkId === 'canvas-structure') repairCanvasStructure(analysis)
  else if (checkId === 'schema-validation') repairSchemaValidation(analysis)
  else if (checkId === 'source-traceability') repairSourceTraceability(analysis)
  else {
    repairSchemaValidation(analysis)
    repairCanvasStructure(analysis)
  }
}

export function repairAnalysisResult(payload = {}) {
  const checkId = payload.checkId || ''
  const action = [payload.action || '', payload.confirmedContent || ''].filter(Boolean).join('\n')
  const repairType = payload.type || ''
  const previousAnalysis = payload.analysis || {}
  const previousVersions = Array.isArray(previousAnalysis.versions) ? previousAnalysis.versions : []
  const analysis = {
    ...previousAnalysis,
    status: 'repaired',
    repair: {
      checkId,
      action,
      repairedAt: new Date().toISOString(),
      owner: 'backend'
    },
    versions: previousVersions
  }

  repairSchemaValidation(analysis)
  repairSourceTraceability(analysis)
  if (repairType === 'agent-supplement') repairAgentSupplement(analysis, action)
  else applyRepair(analysis, checkId, action)

  analysis.qualityGate = buildAnalysisQualityGate(analysis)
  const createdAt = new Date().toISOString()
  const versionSource = repairType === 'agent-supplement'
    ? 'agent-supplement'
    : repairType === 'reanalysis'
      ? 'node-reanalysis'
      : 'backend-repair'
  const version = {
    id: `analysis-repair-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    label: repairType === 'reanalysis' ? '重新分析节点版本' : `修复 ${checkId || 'quality'} 版本`,
    source: versionSource,
    createdAt,
    demandScope: analysis.demandScope || 'project',
    requestedSkillId: analysis.requestedSkillId || '',
    resolvedSkillId: analysis.resolvedSkillId || analysis.skillId || '',
    qualityScore: analysis.qualityGate.score || 0,
    repair: analysis.repair,
    snapshot: {
      blueprint: analysis.blueprint || null,
      canvas: analysis.canvas || null,
      routing: analysis.routing || null,
      generation: analysis.generation || null
    }
  }
  const previousVersion = previousVersions[0]
  if (previousVersion) version.diff = buildAnalysisVersionDiff(previousVersion, version)
  analysis.versions = [version, ...previousVersions]
  analysis.blueprint = {
    ...(analysis.blueprint || {}),
    qualityGate: analysis.qualityGate,
    versions: analysis.versions
  }

  return {
    repair: analysis.repair,
    analysis
  }
}
