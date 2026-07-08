import { getSkillDefinition } from './skill-registry.js'
import { validateSkillOutput } from './schema-validator.js'
import { buildSkillPrompt } from './prompt-builder.js'

function authPageOutput(context = {}) {
  const title = /注册/.test(context.input || '') ? '登录注册双页面' : '登录注册页面'
  return {
    intent: 'auth-page',
    title,
    sections: [
      {
        title: '功能说明',
        items: [
          '支持登录和注册表单切换。',
          '支持手机号或邮箱作为账号。',
          '支持密码显示/隐藏和基础格式校验。',
          '提交后由后端认证接口返回成功态或错误码。'
        ]
      },
      {
        title: '页面状态',
        items: ['初始态', '输入校验错误', '提交中', '认证失败', '成功跳转']
      }
    ],
    frontendHandoff: [
      '前端负责登录/注册 tab、表单输入、按钮禁用、错误展示和成功跳转。',
      '前端提交 account、password、captchaCode、agreeTerms 等字段给后端。',
      '前端根据后端 errorCode 映射字段错误或全局提示。'
    ],
    backendHandoff: [
      '后端负责账号存在性、密码校验、验证码校验、token 签发和注册写入。',
      '后端必须返回稳定错误码，避免前端解析自然语言。',
      '后端需要对登录、注册、发送验证码做限流和审计。'
    ],
    apiContract: [
      {
        method: 'POST',
        path: '/api/auth/login',
        description: '登录认证',
        requestFields: ['account', 'password'],
        responseFields: ['token', 'user', 'redirectUri']
      },
      {
        method: 'POST',
        path: '/api/auth/register',
        description: '注册账号',
        requestFields: ['account', 'password', 'captchaCode', 'agreeTerms'],
        responseFields: ['registered', 'autoLogin', 'nextAction']
      }
    ],
    html: [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>登录注册</title></head>',
      '<body><main><section><h1>登录</h1><form><input placeholder="手机号/邮箱"><input type="password" placeholder="密码"><button type="button">登录</button></form><button type="button">去注册</button></section></main></body>',
      '</html>'
    ].join(''),
    preview: {
      mode: 'html',
      entry: 'index.html'
    },
    qualityReport: {
      passed: true,
      checks: [
        { id: 'frontend-backend-handoff', passed: true, label: '前后端分工完整' },
        { id: 'api-contract', passed: true, label: '接口契约完整' },
        { id: 'html-preview', passed: true, label: 'HTML 预览可生成' }
      ]
    }
  }
}

function smartCanvasOutput(context = {}) {
  const intent = context.routing?.detectedIntent || context.detectedIntent || 'requirement-analysis'
  const isAuthModal = intent === 'auth-modal' || /(弹窗|弹层|浮层|对话框|modal|dialog|popup)/i.test(context.input || '')
  const title = isAuthModal ? '登录注册弹窗分析方案' : '智能推荐需求分析方案'
  const apiContract = isAuthModal
    ? [
        {
          method: 'POST',
          path: '/api/auth/login',
          description: '登录弹窗提交账号密码后由后端认证并返回 token、user、nextAction 或 errorCode。',
          requestFields: ['account', 'password', 'rememberMe?', 'redirectUri?'],
          responseFields: ['token', 'user', 'nextAction', 'redirectUri', 'errorCode?']
        },
        {
          method: 'POST',
          path: '/api/auth/register',
          description: '注册弹窗提交账号、验证码、密码和协议勾选，由后端创建账号并返回下一步。',
          requestFields: ['account', 'password', 'verificationCode', 'agreeTerms'],
          responseFields: ['registered', 'autoLogin', 'token?', 'nextAction', 'errorCode?']
        }
      ]
    : []
  return {
    intent: isAuthModal ? 'auth-modal' : intent,
    title,
    sections: [
      {
        title: '模型分析结论',
        items: isAuthModal
          ? [
              '用户要的是登录注册弹窗，不是独立登录注册页面。',
              '默认使用智能推荐 Skill 的 design-scheme-ux / UX 决策链路，内容由模型基于输入生成。',
              '弹窗确认/提交必须把表单数据交给后端，后端返回结构化结果驱动前端状态。'
            ]
          : [context.input || '暂无输入', '按智能推荐 Skill 的 design-scheme-ux / UX 决策链路生成可进入画布的分析结果。']
      },
      {
        title: '用户行为与功能层级',
        items: [
          '先判断用户当前想完成的任务、第一眼想看到的信息和不需要出现的内容。',
          '把功能拆成主要功能、同级功能、次要功能、三级功能和最低等级不展示内容。'
        ]
      },
      {
        title: '页面形态、路径与生命周期',
        items: [
          '为页面、二级页面、弹窗、抽屉、内联区域、新页签、Toast、Banner 和状态页说明使用条件。',
          '补齐入口、跳转、返回点，以及筛选、搜索、分页、滚动、选中项、草稿和生成结果的保留规则。',
          '定义弹窗与提示生命周期：关闭方式、Toast 停留时长、Loading 超时和关键错误恢复。'
        ]
      },
      {
        title: '画布更新策略',
        items: ['用户确认 Agent 补充后，后端合并原画布与确认内容，返回完整新画布，前端替换显示。']
      }
    ],
    frontendHandoff: isAuthModal
      ? [
          '前端接管弹窗打开/关闭、登录注册切换、字段输入、loading、错误提示和成功关闭。',
          '前端点击提交时调用后端接口，不在本地伪造认证成功。',
          '前端根据后端 errorCode 映射字段错误、全局提示或下一步动作。'
        ]
      : ['前端接管画布展示、用户确认按钮、刷新 loading 和结果替换。'],
    backendHandoff: isAuthModal
      ? [
          '后端接管账号认证、注册写入、验证码、限流、token 签发和错误码。',
          '后端接入大模型用于需求分析链路，认证业务本身仍由领域服务保证确定性。',
          '后端返回完整 analysis/canvas，前端不拼接关键业务结论。'
        ]
      : ['后端接管 Skill 编排、模型调用、结果校验、fallback 和画布重算。'],
    apiContract,
    canvas: {
      nodes: [
        {
          id: 'analysis',
          title: isAuthModal ? '登录注册弹窗分析' : '智能推荐分析',
          summary: isAuthModal ? '识别为弹窗级认证交互，需要补齐前后端数据链路。' : '按智能推荐 Skill 生成分析画布。',
          content: isAuthModal
            ? ['形态：弹窗/Modal', '提交：前端 POST 后端', '反馈：后端返回 token/user/errorCode/nextAction']
            : [context.input || '暂无输入']
        },
        {
          id: 'design-scheme-ux',
          title: 'UX 决策链路',
          summary: '用户行为、功能层级、页面形态、路径返回、状态错误和弹窗提示生命周期。',
          content: [
            '用户行为结论：识别用户想完成什么、先看什么、不需要看什么。',
            '功能层级：主要/同级/次要/三级/最低等级。',
            '形态决策：页面、二级页面、弹窗、抽屉、内联、新页签、Toast、Banner、状态页。',
            '返回状态：保留筛选、搜索、滚动、选中项、草稿和生成结果。',
            '生命周期：确认弹窗不自动消失，成功 Toast 2-3 秒，错误 Toast 至少 6 秒且提供恢复动作。'
          ]
        }
      ]
    },
    qualityReport: {
      passed: true,
      checks: [
        { id: 'ux-framework', passed: true, label: '已使用智能推荐 UX 框架' },
        { id: 'surface-decision', passed: true, label: '已覆盖页面形态决策' },
        { id: 'overlay-lifecycle', passed: true, label: '已覆盖弹窗与提示生命周期' },
        { id: 'route-return-state', passed: true, label: '已覆盖路径与返回状态' },
        { id: 'frontend-backend-handoff', passed: true, label: '前后端分工明确' },
        { id: 'api-contract', passed: !isAuthModal || apiContract.length > 0, label: '接口契约完整' }
      ]
    }
  }
}

function deterministicOutput(skill, context) {
  if (skill.outputSchema === 'auth-page') return authPageOutput(context)
  if (skill.outputSchema === 'smart-canvas') return smartCanvasOutput(context)
  return {
    intent: context.routing?.detectedIntent || 'requirement-analysis',
    sections: [{ title: '分析结果', items: [context.input || '暂无输入'] }],
    qualityReport: { passed: true, checks: [] }
  }
}

export function safeParseModelJson(content = '') {
  const raw = String(content || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || raw
  try {
    return { ok: true, value: JSON.parse(candidate), error: '' }
  } catch (error) {
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0]
    if (objectText && objectText !== candidate) {
      try {
        return { ok: true, value: JSON.parse(objectText), error: '' }
      } catch {}
    }
    return { ok: false, value: null, error: error.message || 'JSON 解析失败' }
  }
}

function deterministicGeneration(skill, context = {}, fallbackReason = '') {
  const output = deterministicOutput(skill, context)
  const validation = validateSkillOutput(skill.outputSchema, output)
  return {
    status: validation.ok ? 'generated' : 'invalid',
    provider: 'deterministic',
    model: 'deterministic-v1',
    fallbackUsed: Boolean(fallbackReason),
    fallbackReason,
    skill,
    output,
    validation,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }
}

function recordModelCall(context = {}, entry = {}) {
  const target = context.modelCallLog
  if (!target) return
  const log = {
    id: `model-call-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    skillId: context.skillId || context.routing?.resolvedSkillId || '',
    requestedSkillId: context.routing?.requestedSkillId || context.requestedSkillId || '',
    resolvedSkillId: context.routing?.resolvedSkillId || context.skillId || '',
    demandScope: context.demandScope || '',
    projectId: context.projectId || context.project?.id || '',
    detectedIntent: context.routing?.detectedIntent || context.detectedIntent || '',
    routingReason: context.routing?.routingReason || context.routingReason || '',
    createdAt: new Date().toISOString(),
    ...entry
  }
  if (Array.isArray(target)) target.push(log)
  else if (typeof target === 'function') target(log)
}

export function runSkillGenerationSync(context = {}) {
  const skill = getSkillDefinition(context.skillId || context.routing?.resolvedSkillId, context.skillOrchestration)
  return deterministicGeneration(skill, context)
}

export async function runSkillGeneration(context = {}) {
  const skill = getSkillDefinition(context.skillId || context.routing?.resolvedSkillId, context.skillOrchestration)
  const provider = context.agentProvider
  if (!provider || provider.name === 'deterministic') return deterministicGeneration(skill, context)

  const prompt = buildSkillPrompt({ ...context, skill })
  const startedAt = Date.now()
  try {
    const modelResult = await provider.generate({
      ...context,
      ...prompt,
      model: context.model
    })
    const parsed = safeParseModelJson(modelResult.content)
    if (!parsed.ok) {
      const fallbackReason = `模型 JSON 解析失败：${parsed.error}`
      recordModelCall(context, {
        provider: modelResult.provider || provider.name || 'model',
        model: modelResult.model || context.model || '',
        status: 'fallback',
        durationMs: Date.now() - startedAt,
        usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackReason
      })
      return deterministicGeneration(skill, context, fallbackReason)
    }
    const validation = validateSkillOutput(skill.outputSchema, parsed.value)
    if (!validation.ok) {
      const fallbackReason = `模型输出校验失败：missing=${validation.missing.join(',')} issues=${validation.issues.join(',')}`
      recordModelCall(context, {
        provider: modelResult.provider || provider.name || 'model',
        model: modelResult.model || context.model || '',
        status: 'fallback',
        durationMs: Date.now() - startedAt,
        usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackReason
      })
      return deterministicGeneration(skill, context, fallbackReason)
    }
    recordModelCall(context, {
      provider: modelResult.provider || provider.name || 'model',
      model: modelResult.model || context.model || '',
      status: 'success',
      durationMs: Date.now() - startedAt,
      usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      fallbackReason: ''
    })
    return {
      status: 'generated',
      provider: modelResult.provider || provider.name || 'model',
      model: modelResult.model || context.model || '',
      fallbackUsed: false,
      fallbackReason: '',
      skill,
      output: parsed.value,
      validation,
      usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      prompt
    }
  } catch (error) {
    const fallbackReason = `模型调用失败：${error.message || 'unknown error'}`
    recordModelCall(context, {
      provider: provider.name || 'model',
      model: context.model || '',
      status: 'error',
      durationMs: Date.now() - startedAt,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      fallbackReason
    })
    return deterministicGeneration(skill, context, fallbackReason)
  }
}
