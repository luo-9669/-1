import { createWorkspaceAiAnalysis } from '../models/workspace.js'

function parseJsonObject(value = '') {
  const text = String(value || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1])
    } catch {}
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {}
  }
  return null
}

function normalizeTags(value = []) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : []
}

function normalizeSeverity(value = '', fallback = 'medium') {
  return ['low', 'medium', 'high'].includes(value) ? value : fallback
}

function normalizeTokenUsage(value = {}) {
  const usage = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const input = Number(usage.input ?? usage.input_tokens ?? usage.prompt_tokens) || 0
  const output = Number(usage.output ?? usage.output_tokens ?? usage.completion_tokens) || 0
  return {
    input,
    output,
    total: Number(usage.total ?? usage.total_tokens) || input + output
  }
}

function fallbackAnalysis(change = {}, competitor = {}) {
  return {
    factualObservation: `${competitor.name || '竞品'} 页面内容出现变化`,
    interpretation: '该变化可能反映竞品正在调整页面定位或转化表达。',
    productImpact: '需要关注对方卖点、入口和套餐表达是否影响我们的产品对比。',
    uxImpact: '建议检查信息层级、CTA 路径和关键任务是否发生变化。',
    uiImpact: '当前先按页面内容变化记录，不额外扩大视觉结论。',
    recommendation: '把该变化加入后续产品与体验对比清单，并结合截图和正文做人工复核。',
    tags: [change.changeType, change.severity].filter(Boolean),
    severitySuggestion: normalizeSeverity(change.severity)
  }
}

function normalizeAnalysis(payload = {}, change = {}, competitor = {}, meta = {}) {
  const fallback = fallbackAnalysis(change, competitor)
  return createWorkspaceAiAnalysis({
    projectId: change.projectId || '',
    competitorId: competitor.id,
    changeId: change.id,
    factualObservation: payload.factualObservation || fallback.factualObservation,
    interpretation: payload.interpretation || fallback.interpretation,
    productImpact: payload.productImpact || fallback.productImpact,
    uxImpact: payload.uxImpact || fallback.uxImpact,
    uiImpact: payload.uiImpact || fallback.uiImpact,
    recommendation: payload.recommendation || fallback.recommendation,
    tags: normalizeTags(payload.tags).length ? normalizeTags(payload.tags) : fallback.tags,
    severitySuggestion: normalizeSeverity(payload.severitySuggestion, fallback.severitySuggestion),
    analysisProvider: meta.provider || '',
    analysisModel: meta.model || '',
    analysisDurationMs: meta.durationMs || 0,
    analysisTokenUsage: normalizeTokenUsage(meta.usage),
    analysisFallbackUsed: Boolean(meta.fallbackUsed),
    analysisFallbackReason: meta.fallbackReason || ''
  })
}

function buildAnalysisPrompt(change = {}, competitor = {}, snapshot = {}) {
  return [
    '你是竞品监控分析助手。请只返回 JSON，不要输出 Markdown。',
    'JSON 字段必须包含 factualObservation, interpretation, productImpact, uxImpact, uiImpact, recommendation, tags, severitySuggestion。',
    `竞品：${competitor.name || '未知竞品'}`,
    `官网：${competitor.websiteUrl || snapshot.url || ''}`,
    `变化类型：${change.changeType || ''}`,
    `变化摘要：${change.changeSummary || ''}`,
    `变化正文：${change.diffText || snapshot.textContent || ''}`
  ].join('\n')
}

export function createCompetitorAnalysisAdapter({ provider = null, model = 'gpt-5.5' } = {}) {
  return async function competitorAnalysisAdapter(change = {}, competitor = {}, snapshot = {}) {
    if (!provider || typeof provider.generate !== 'function') {
      return normalizeAnalysis({}, change, competitor, {
        provider: 'deterministic',
        model: 'deterministic-analysis',
        fallbackUsed: true,
        fallbackReason: '未配置可用模型，已使用本地分析。'
      })
    }
    const startedAt = Date.now()
    try {
      const result = await provider.generate({
        model,
        actionType: 'competitor-change-analysis',
        scopeId: change.id || '',
        node: {
          id: change.id || '',
          title: `${competitor.name || '竞品'}变化分析`,
          summary: change.changeSummary || ''
        },
        message: {
          role: 'user',
          content: buildAnalysisPrompt(change, competitor, snapshot)
        },
        references: [],
        retrievedKnowledge: []
      })
      const parsed = parseJsonObject(result.content)
      return normalizeAnalysis(parsed || {}, change, competitor, {
        provider: result.provider || provider.name || 'model-provider',
        model: result.model || model,
        durationMs: result.durationMs || Date.now() - startedAt,
        usage: result.usage,
        fallbackUsed: !parsed,
        fallbackReason: parsed ? '' : '模型结果暂未形成可用结构，已使用本地分析。'
      })
    } catch (error) {
      return normalizeAnalysis({}, change, competitor, {
        provider: provider.name || 'model-provider',
        model,
        durationMs: Date.now() - startedAt,
        fallbackUsed: true,
        fallbackReason: error?.message || '模型分析暂不可用，已使用本地分析。'
      })
    }
  }
}
