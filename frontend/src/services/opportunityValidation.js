export function buildOpportunityValidation() {
  return {
    version: 'v1',
    journeyMaps: [
      {
        persona: '独立播客创作者',
        touchpoints: [
          {
            touchpoint: '上传资料并解析',
            emotion: '不确定',
            pain: '不知道文件是否读取成功',
            evidence: ['上传后需要展示解析状态、可用摘要和失败恢复']
          },
          {
            touchpoint: '进入核心编辑器',
            emotion: '期待',
            pain: '担心脚本、主持人、音色没有继承',
            evidence: ['解析完成后需要带着资料进入 Demo 编辑器']
          }
        ]
      }
    ],
    serviceBlueprints: [
      {
        scenario: '从资料上传到 Demo 生成',
        frontstage: ['上传文件', '显示解析进度', '进入编辑器'],
        backstage: ['文档解析', '脚本结构化', 'Demo 状态生成'],
        failurePoints: ['解析失败需要保留文件并提供重试', 'Demo 生成失败需要展示恢复入口']
      }
    ],
    topOpportunities: [
      {
        id: 'upload-transparency',
        title: '上传解析透明化',
        priority: 'P0',
        weight: 88,
        surfaceDecision: {
          recommended: 'inline-panel',
          reason: '用户需要在输入框附近确认资料是否可用'
        },
        rice: { reach: 9, impact: 8, confidence: 8, effort: 3, score: 192 },
        kano: 'performance',
        pyramidLevel: 'usable'
      }
    ],
    threeRoundReview: {
      uxReviewPatch: {
        items: [
          { action: '补充上传解析状态、失败原因和重新上传入口', owner: 'UX' }
        ]
      }
    },
    finalIterationPlan: [
      { title: '上传解析透明化', scope: '输入框下方展示文件、解析状态、可用摘要和失败恢复。' }
    ]
  }
}

export function renderOpportunityValidationMarkdown(validation = {}) {
  if (!validation.version) return ''
  const top = (validation.topOpportunities || [])
    .map((item) => `- ${item.priority} ${item.title}：权重 ${item.weight}；入口=${item.surfaceDecision?.recommended || ''}；RICE=${item.rice?.score || 0}`)
    .join('\n')
  const journey = (validation.journeyMaps || [])
    .flatMap((map) => (map.touchpoints || []).map((touchpoint) => `- ${map.persona} / ${touchpoint.touchpoint}：${touchpoint.pain}；证据=${(touchpoint.evidence || []).join('、')}`))
    .join('\n')
  const service = (validation.serviceBlueprints || [])
    .map((item) => `- ${item.scenario}：失败点=${(item.failurePoints || []).join('、')}`)
    .join('\n')
  return `版本：${validation.version}

### 机会点 Top
${top}

### 用户旅程证据
${journey}

### Service Blueprint
${service}`
}
