function text(value = '') {
  return String(value || '').trim()
}

function nodesForStage(totalFlow = {}, stageId = '') {
  const nodes = totalFlow?.stageCanvases?.[stageId]?.nodes
  return Array.isArray(nodes) ? nodes : []
}

function nodeIsLoadingPlaceholder(node = {}, stageId = '') {
  const nodeId = text(node?.id)
  return !node ||
    node.loading === true ||
    nodeId === `${stageId}-loading` ||
    nodeId === 'model-generating' ||
    text(node?.contentStatus) === 'model-pending' ||
    text(node?.contentStatus) === 'waiting-model' ||
    text(node?.contentSource) === 'model-pending'
}

function nodeHasTextContent(node = {}) {
  return [
    node?.summary,
    ...(Array.isArray(node?.content) ? node.content : []),
    ...(Array.isArray(node?.detailSections)
      ? node.detailSections.flatMap((section) => [
          section?.title,
          ...(Array.isArray(section?.items) ? section.items : [])
        ])
      : [])
  ].some((item) => text(item))
}

function nodeHasInteractionArtifact(node = {}) {
  const artifact = node?.pageLayoutArtifact || {}
  return Boolean(text(artifact.asciiWireframe) || text(artifact.rawText))
}

function nodeHasVisualArtifact(node = {}) {
  return text(node?.artifactStatus) === 'generated' ||
    text(node?.visualPreview?.imageStatus) === 'generated' ||
    Boolean(
      text(node?.visualPreview?.imageUrl) ||
      text(node?.visualPreview?.imageDataUrl) ||
      text(node?.artifact?.imageUrl) ||
      text(node?.artifact?.imageDataUrl)
    )
}

function nodeHasCodeArtifact(node = {}) {
  return text(node?.artifactStatus) === 'generated' && Boolean(
    text(node?.codePreview?.code) ||
    text(node?.artifact?.code) ||
    text(node?.artifact?.html) ||
    text(node?.artifact?.source) ||
    text(node?.code)
  )
}

export function workflowStageHasGeneratedContent(totalFlow = {}, stageId = '') {
  const nodes = nodesForStage(totalFlow, stageId).filter((node) => !nodeIsLoadingPlaceholder(node, stageId))
  if (!nodes.length) return false
  if (stageId === 'interaction-lofi') return nodes.some(nodeHasInteractionArtifact)
  if (stageId === 'ui-visual') return nodes.some(nodeHasVisualArtifact)
  if (['html-output', 'vue-output'].includes(stageId)) return nodes.some(nodeHasCodeArtifact)
  if (stageId === 'acceptance-deposit') {
    return Boolean(totalFlow?.stageConfirmations?.['vue-output']) && nodes.some(nodeHasTextContent)
  }
  return nodes.some(nodeHasTextContent)
}

export function buildWorkflowStageRuntime(totalFlow = {}) {
  const stages = Array.isArray(totalFlow?.stages) ? totalFlow.stages : []
  const stageIds = stages.map((stage) => text(stage?.id)).filter(Boolean)
  const currentStage = text(totalFlow?.currentStage || stageIds[0] || '')
  const currentIndex = Math.max(0, stageIds.indexOf(currentStage))
  const confirmations = totalFlow?.stageConfirmations || {}
  const statuses = totalFlow?.stageStatuses || {}

  return Object.fromEntries(stageIds.map((stageId, index) => {
    const stageStatus = text(statuses?.[stageId]?.status)
    const generated = workflowStageHasGeneratedContent(totalFlow, stageId)
    const previousStageId = stageIds[index - 1] || ''
    const previousConfirmed = Boolean(previousStageId && confirmations?.[previousStageId])
    const isCurrent = stageId === currentStage
    const statusCanOpen = ['generating', 'paused'].includes(stageStatus)
    const canOpen = index === 0 ||
      index <= currentIndex ||
      isCurrent ||
      statusCanOpen ||
      (previousConfirmed && index <= currentIndex + 1)
    const state = stageStatus === 'generating' || stageStatus === 'paused' || stageStatus === 'failed'
      ? stageStatus
      : generated
        ? 'generated'
        : canOpen
          ? 'available'
          : 'locked'
    return [stageId, {
      state,
      canOpen,
      scaffoldOnly: nodesForStage(totalFlow, stageId).length > 0 && !generated,
      generated,
      current: isCurrent,
      previousStageId,
      previousConfirmed
    }]
  }))
}

export function withWorkflowStageRuntime(totalFlow = {}) {
  if (!totalFlow || typeof totalFlow !== 'object') return totalFlow
  return {
    ...totalFlow,
    stageRuntime: buildWorkflowStageRuntime(totalFlow)
  }
}
