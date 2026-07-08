function summarizeText(text = '') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '暂无可分析文本'
  return normalized.slice(0, 80)
}

function itemStage(item = {}) {
  if (/失败|错误/.test(item.status || item.text || '')) return 'failed'
  if (/待|后端|解析中/.test(item.status || '')) return 'pending'
  if (String(item.text || '').trim()) return 'ready'
  return 'pending'
}

export function buildDocumentAnalysisView(items = []) {
  const normalized = items.map((item) => {
    const stage = itemStage(item)
    return {
      id: item.id,
      name: item.name || '未命名文件',
      status: item.status || (stage === 'ready' ? '已读取' : '待解析'),
      stage,
      summary: summarizeText(item.text),
      recoveryActions: stage === 'failed' ? ['重新上传', '换格式导入', '联系后端解析'] : [],
      nextStep: stage === 'pending' ? '等待后端解析完成后再进入需求拆解。' : '可进入需求拆解。'
    }
  })
  const readyCount = normalized.filter((item) => item.stage === 'ready').length
  const failedCount = normalized.filter((item) => item.stage === 'failed').length
  const pendingCount = normalized.filter((item) => item.stage === 'pending').length
  return {
    total: normalized.length,
    readyCount,
    failedCount,
    pendingCount,
    stage: failedCount || pendingCount ? 'partial' : readyCount ? 'ready' : 'empty',
    items: normalized
  }
}
