<template>
  <section class="workflow-canvas-page">
    <header class="workflow-canvas-topbar">
      <div>
        <button class="workflow-back-control" type="button" aria-label="返回分析" @click="$emit('back')">
          <span class="workflow-back-logo">流</span>
          <span class="workflow-back-label">返回分析</span>
        </button>
        <strong>{{ title || '需求分析画布' }}</strong>
        <span>{{ parsedCount }} 个文档已解析 · 白色画布</span>
        <span v-if="knowledgeStatus.status" class="workflow-knowledge-status" :class="knowledgeStatus.status">
          {{ knowledgeStatus.message || '知识库状态已更新' }}
          <button v-if="knowledgeStatus.status === 'success'" type="button" @click="$emit('open-knowledge')">查看知识库</button>
        </span>
      </div>
      <div class="actions">
        <button type="button" @click="$emit('zoom', -0.1)">缩小</button>
        <button type="button" @click="$emit('zoom', 0.1)">放大 {{ Math.round(zoom * 100) }}%</button>
        <button type="button" @click="$emit('open-agent', activeNode?.id || 'analysis')">Agent</button>
        <button type="button" @click="$emit('persist-knowledge')">沉淀知识库</button>
        <button class="primary" type="button" @click="$emit('convert-requirement')">转需求文档</button>
        <button class="canvas-agent-launcher" type="button" aria-label="打开 Agent 对话" @click="$emit('open-agent', activeNode?.id || 'analysis')">
          <span></span>
        </button>
      </div>
    </header>

    <main class="workflow-canvas-shell">
      <aside class="workflow-canvas-tabs">
        <button
          v-for="tab in canvas.orderedTabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeNode?.id === tab.key }"
          @click="$emit('focus-node', tab.key)"
        >
          {{ tab.label }}
        </button>
        <section v-if="versionHistory.length" class="workflow-canvas-meta-panel">
          <strong>版本历史</strong>
          <article v-for="version in versionHistory" :key="version.id">
            <b>{{ version.label || version.id }}</b>
            <span>{{ version.source || 'analysis' }} · {{ version.qualityScore ?? '待检' }} 分</span>
            <small v-if="version.diff" class="workflow-version-diff">
              版本对比：节点 {{ signedDelta(version.diff.nodeDelta) }} · 连线 {{ signedDelta(version.diff.edgeDelta) }} · 质量 {{ signedDelta(version.diff.qualityDelta) }}
            </small>
            <small v-if="version.diff?.changedBlueprintFields?.length">
              变更：{{ version.diff.changedBlueprintFields.join('、') }}
            </small>
            <div v-if="version.appliedPatch?.nodeDiffs?.length" class="workflow-version-node-diffs">
              <small>节点改动</small>
              <div
                v-for="diff in visibleVersionNodeDiffs(version)"
                :key="`${version.id}-${diff.nodeId}`"
                class="workflow-version-node-diff"
              >
                <b>{{ diff.title || diff.nodeId }}</b>
                <span>条目 {{ contentCountDelta(diff) }}</span>
                <small v-if="diff.before?.summary">更新前：{{ diff.before.summary }}</small>
                <small v-if="diff.after?.summary">更新后：{{ diff.after.summary }}</small>
              </div>
            </div>
            <div v-if="rollbackPreviewVersionId === version.id" class="workflow-version-rollback-preview">
              <b>预览回滚影响</b>
              <small>将回到 {{ version.label || version.id }}，当前画布会替换为该版本快照。</small>
              <small v-if="version.qualityScore !== undefined">目标质量分：{{ version.qualityScore }} 分</small>
              <div v-if="version.appliedPatch?.nodeDiffs?.length" class="workflow-version-node-diffs">
                <small>相关节点</small>
                <div
                  v-for="diff in visibleVersionNodeDiffs(version)"
                  :key="`${version.id}-rollback-${diff.nodeId}`"
                  class="workflow-version-node-diff"
                >
                  <b>{{ diff.title || diff.nodeId }}</b>
                  <small v-if="diff.before?.summary">回滚前参考：{{ diff.after?.summary || diff.before.summary }}</small>
                  <small v-if="diff.after?.summary">回滚后参考：{{ diff.before?.summary || diff.after.summary }}</small>
                </div>
              </div>
              <div>
                <button type="button" @click="confirmRollbackVersion">确认回滚</button>
                <button type="button" @click="closeRollbackPreview">取消</button>
              </div>
            </div>
            <button type="button" :disabled="!version.snapshot" @click="openRollbackPreview(version)">
              {{ rollbackPreviewVersionId === version.id ? '正在预览' : '回滚到此版本' }}
            </button>
          </article>
        </section>
        <section v-if="qualityGate.checks?.length" class="workflow-canvas-meta-panel">
          <strong>质量检查</strong>
          <article
            v-for="check in qualityGate.checks"
            :key="check.id"
            :class="{ failed: !check.passed }"
          >
            <b>{{ check.label }}</b>
            <span>{{ check.passed ? '通过' : '待检查' }} · {{ check.severity || 'info' }}</span>
            <small v-if="check.detail">{{ check.detail }}</small>
            <small v-if="!check.passed && check.repairSuggestion" class="workflow-repair-suggestion">
              修复建议：{{ check.repairSuggestion }}
            </small>
          </article>
          <article v-if="qualityGate.repairActions?.length" class="workflow-repair-actions">
            <b>修复建议</b>
            <div v-for="action in qualityGate.repairActions" :key="action.id || action.checkId" class="workflow-repair-action-row">
              <small>{{ action.owner || 'backend' }}：{{ action.suggestion || action.label }}</small>
              <button
                type="button"
                @click="$emit('quick-action', {
                  nodeId: 'analysis',
                  action: action.suggestion || action.label,
                  type: 'repair-action',
                  checkId: action.checkId
                })"
              >
                交给 Agent
              </button>
            </div>
          </article>
        </section>
      </aside>
      <section ref="viewportRef" class="workflow-canvas-viewport">
        <div class="workflow-canvas-surface" :style="{ transform: `scale(${zoom})` }">
          <svg class="workflow-canvas-edges" :width="4400" :height="900" aria-hidden="true">
            <path
              v-for="edge in edges"
              :key="edge.id"
              :d="edgePath(edge)"
              :class="{ 'active-flow': isActiveIncomingEdge(edge) }"
            />
          </svg>
          <article
            v-for="node in nodes"
            :key="node.id"
            :data-node-id="node.id"
            class="canvas-node-card"
            :class="{ active: activeNode?.id === node.id, spotlight: spotlightNodeId === node.id }"
            :style="{ left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px`, minHeight: `${node.height}px` }"
          >
            <div class="canvas-node-head">
              <div>
                <span>{{ node.loading ? '生成中' : node.id === 'analysis' ? '文档分析结果' : '环节' }}</span>
                <h3>{{ node.title }}</h3>
              </div>
              <div class="canvas-node-actions">
                <button type="button" :disabled="node.loading" @click="$emit('open-agent', node.id)">Agent</button>
                <button type="button" :disabled="node.loading" @click="$emit('fullscreen', node.id)">全屏</button>
              </div>
            </div>
            <p>{{ node.summary }}</p>
            <div v-if="node.loading" class="canvas-node-loading">
              <span class="loading-spinner-large"></span>
              <b>{{ node.content?.[0] || '正在生成节点数据...' }}</b>
              <small>{{ node.content?.[1] || '稍后自动填充真实内容' }}</small>
            </div>
            <div v-else class="canvas-node-content">
              <span v-for="item in compactNodeContent(node)" :key="`${node.id}-preview-${item}`">{{ treeItemLabel(item) }}</span>
            </div>
            <div class="canvas-node-footer">
              <button
                v-for="action in visibleNodeQuickActions(node)"
                :key="action"
                type="button"
                :disabled="node.loading"
                @click.stop="$emit('quick-action', { nodeId: node.id, action })"
              >
                {{ action }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>
  </section>

  <div v-if="fullscreenNode" class="canvas-fullscreen-modal" @click.self="$emit('close-fullscreen')">
    <section>
      <header>
        <div>
          <span>当前环节</span>
          <h3>{{ fullscreenNode.title }}</h3>
          <p>{{ fullscreenNode.agentScope }}</p>
        </div>
        <div class="actions">
          <button type="button" @click="$emit('open-agent', fullscreenNode.id)">Agent</button>
          <button v-if="!isFullscreenEditing(fullscreenNode)" type="button" @click="startFullscreenEdit(fullscreenNode)">编辑</button>
          <button v-else type="button" @click="cancelFullscreenEdit">取消编辑</button>
          <button v-if="isFullscreenEditing(fullscreenNode)" type="button" :disabled="!canSaveFullscreenEdit" @click="saveFullscreenEdit(fullscreenNode)">保存</button>
          <button type="button" @click="$emit('close-fullscreen')">退出全屏</button>
        </div>
      </header>
      <div class="canvas-fullscreen-content">
        <section class="canvas-detail-overview">
          <div v-if="isFullscreenEditing(fullscreenNode)" class="canvas-fullscreen-edit-panel">
            <label>
              <span>摘要</span>
              <textarea v-model="fullscreenEditSummary" rows="3"></textarea>
            </label>
            <label>
              <span>内容条目</span>
              <textarea v-model="fullscreenEditContentText" rows="8"></textarea>
            </label>
            <label>
              <span>补充详情</span>
              <textarea v-model="fullscreenEditDetailText" rows="6"></textarea>
            </label>
          </div>
          <p v-else>{{ fullscreenNode.summary }}</p>
          <div v-if="hasPathGraph(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="canvas-path-graph">
            <div class="canvas-path-legend">
              <span v-for="item in pathGraphLegend(fullscreenNode)" :key="`${fullscreenNode.id}-legend-${item.type}`">
                <i :class="`path-shape ${item.type}`"></i>{{ item.label }}
              </span>
            </div>
            <div class="canvas-path-graph-body">
              <article
                v-for="node in pathGraphNodes(fullscreenNode)"
                :key="`${fullscreenNode.id}-path-${node.id}`"
                class="path-graph-node"
                :class="node.type"
              >
                <i></i>
                <span>{{ node.label }}</span>
              </article>
            </div>
            <div class="canvas-path-edges">
              <span v-for="edge in pathGraphEdges(fullscreenNode)" :key="`${fullscreenNode.id}-edge-${edge.from}-${edge.to}-${edge.label}`">
                {{ pathGraphNodeLabel(fullscreenNode, edge.from) }} → {{ pathGraphNodeLabel(fullscreenNode, edge.to) }}
                <b v-if="edge.label">{{ edge.label }}</b>
              </span>
            </div>
          </div>
          <div v-if="hasPathGraph(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="canvas-flow-insights">
            <div class="flow-metric-grid">
              <article
                v-for="metric in flowDetailMetrics(fullscreenNode)"
                :key="`${fullscreenNode.id}-metric-${metric.label}`"
                class="flow-metric"
                :class="metric.tone"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.hint }}</small>
              </article>
            </div>
            <div class="flow-detail-grid">
              <section class="flow-detail-panel wide">
                <header>
                  <strong>步骤明细</strong>
                  <small>按真实连线拆解用户动作、系统判断和页面状态变化。</small>
                </header>
                <div class="flow-step-list">
                  <article
                    v-for="row in flowStepRows(fullscreenNode)"
                    :key="`${fullscreenNode.id}-step-${row.index}-${row.from}-${row.to}`"
                    class="flow-step-row"
                  >
                    <b>{{ row.index }}</b>
                    <div>
                      <span class="flow-step-route">{{ row.from }} → {{ row.to }}</span>
                      <small>{{ row.action }}</small>
                    </div>
                    <em class="flow-tag" :class="row.tone">{{ row.type }}</em>
                  </article>
                </div>
              </section>
              <section class="flow-detail-panel">
                <header>
                  <strong>前后端协作</strong>
                  <small>把接口边单独抽出，便于后端、联调和测试对齐。</small>
                </header>
                <div class="flow-step-list compact">
                  <article
                    v-for="row in flowBackendRows(fullscreenNode)"
                    :key="`${fullscreenNode.id}-backend-${row.index}`"
                    class="flow-step-row"
                  >
                    <b>{{ row.index }}</b>
                    <div>
                      <span class="flow-step-route">{{ row.api }}</span>
                      <small>{{ row.detail }}</small>
                    </div>
                  </article>
                </div>
              </section>
              <section class="flow-detail-panel">
                <header>
                  <strong>异常与恢复</strong>
                  <small>错误、回退和断点恢复集中展示，避免漏掉失败态。</small>
                </header>
                <div class="flow-step-list compact">
                  <article
                    v-for="row in flowExceptionRows(fullscreenNode)"
                    :key="`${fullscreenNode.id}-exception-${row.index}-${row.title}`"
                    class="flow-step-row warning"
                  >
                    <b>{{ row.index }}</b>
                    <div>
                      <span class="flow-step-route">{{ row.title }}</span>
                      <small>{{ row.detail }}</small>
                    </div>
                  </article>
                </div>
              </section>
              <section class="flow-detail-panel wide">
                <header>
                  <strong>验收点</strong>
                  <small>用路径图自动反推交付检查项。</small>
                </header>
                <ul class="flow-check-list">
                  <li
                    v-for="check in flowAcceptanceChecks(fullscreenNode)"
                    :key="`${fullscreenNode.id}-check-${check.label}`"
                    :class="{ passed: check.passed }"
                  >
                    <i>{{ check.passed ? '✓' : '!' }}</i>
                    <div>
                      <strong>{{ check.label }}</strong>
                      <span>{{ check.detail }}</span>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
          </div>
          <div v-show="!isFullscreenEditing(fullscreenNode)" class="canvas-detail-tree">
            <button
              v-for="treeItem in visibleTreeItems(fullscreenNode)"
              :key="`${fullscreenNode.id}-${treeItem.key}`"
              type="button"
              class="canvas-tree-node"
              :class="{ expanded: isTreeItemExpanded(fullscreenNode.id, treeItem.key), leaf: !treeItem.hasChildren }"
              :style="{ '--tree-depth': treeItem.depth }"
              @click="toggleTreeItem(fullscreenNode.id, treeItem.key)"
            >
              <i>{{ treeItem.hasChildren ? (isTreeItemExpanded(fullscreenNode.id, treeItem.key) ? '−' : '+') : '' }}</i>
              <span>{{ treeItem.label }}</span>
            </button>
          </div>
        </section>
        <article v-for="section in fullscreenNode.detailSections || []" v-show="!isFullscreenEditing(fullscreenNode)" :key="`${fullscreenNode.id}-detail-${section.title}`" class="canvas-detail-section">
          <header>
            <strong>{{ section.title }}</strong>
            <small v-if="section.meta">{{ section.meta }}</small>
          </header>
          <ul>
            <li v-for="item in section.items || []" :key="`${section.title}-${item}`">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  parsedCount: { type: Number, default: 0 },
  canvas: { type: Object, default: () => ({ nodes: [], edges: [], orderedTabs: [] }) },
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  activeNode: { type: Object, default: null },
  fullscreenNode: { type: Object, default: null },
  routing: { type: Object, default: () => ({}) },
  generation: { type: Object, default: () => ({}) },
  versionMeta: { type: Object, default: () => ({}) },
  versionHistory: { type: Array, default: () => [] },
  qualityGate: { type: Object, default: () => ({}) },
  knowledgeStatus: { type: Object, default: () => ({}) },
  zoom: { type: Number, default: 1 }
})

const emit = defineEmits(['back', 'zoom', 'save', 'convert-requirement', 'persist-knowledge', 'open-knowledge', 'focus-node', 'open-agent', 'fullscreen', 'close-fullscreen', 'edit-node', 'quick-action', 'rollback-version'])

const viewportRef = ref(null)
const spotlightNodeId = ref('')
const expandedTreeItems = ref(new Set())
const rollbackPreviewVersionId = ref('')
const fullscreenEditingNodeId = ref('')
const fullscreenEditSummary = ref('')
const fullscreenEditContentText = ref('')
const fullscreenEditDetailText = ref('')
let spotlightTimer = null
const analysisVersionMeta = computed(() => props.versionMeta || {})
const analysisQualityGate = computed(() => props.qualityGate || {})
const canSaveFullscreenEdit = computed(() =>
  Boolean(fullscreenEditingNodeId.value && (
    fullscreenEditSummary.value.trim() ||
    fullscreenEditContentText.value.trim() ||
    fullscreenEditDetailText.value.trim()
  ))
)

function treeItemDepth(item = '') {
  const prefix = String(item).match(/^[\s│├└─—|]+/)?.[0] || ''
  const branchDepth = (prefix.match(/[│|]/g) || []).length
  const spaceDepth = Math.floor((prefix.match(/\s/g) || []).length / 2)
  return Math.min(5, Math.max(0, branchDepth + spaceDepth))
}

function treeItemLabel(item = '') {
  return String(item)
    .replace(/^[\s│├└─—|]+/, '')
    .replace(/^[-•]\s*/, '')
    .trim() || String(item)
}

function normalizeTreeItems(node = {}) {
  return (node.content || []).map((item, index, list) => {
    const depth = treeItemDepth(item)
    const nextDepth = index < list.length - 1 ? treeItemDepth(list[index + 1]) : -1
    return {
      key: `${index}-${treeItemLabel(item)}`,
      label: treeItemLabel(item),
      depth,
      hasChildren: nextDepth > depth
    }
  })
}

function compactNodeContent(node = {}) {
  return (node.content || []).slice(0, 3)
}

function isCanvasConfirmAction(action = '') {
  return /确认/.test(String(action || ''))
}

function visibleNodeQuickActions(node = {}) {
  return (Array.isArray(node.quickActions) ? node.quickActions : [])
    .map((action) => String(action || '').trim())
    .filter((action) => action && !isCanvasConfirmAction(action))
}

function nodeDetailText(node = {}) {
  return (Array.isArray(node.detailSections) ? node.detailSections : [])
    .flatMap((section) => [
      section.title ? `【${section.title}】` : '',
      ...(Array.isArray(section.items) ? section.items : [])
    ])
    .filter(Boolean)
    .join('\n')
}

function isFullscreenEditing(node = {}) {
  return Boolean(node?.id && fullscreenEditingNodeId.value === node.id)
}

function startFullscreenEdit(node = {}) {
  if (!node?.id) return
  fullscreenEditingNodeId.value = node.id
  fullscreenEditSummary.value = node.summary || ''
  fullscreenEditContentText.value = (Array.isArray(node.content) ? node.content : []).map((item) => treeItemLabel(item)).join('\n')
  fullscreenEditDetailText.value = nodeDetailText(node)
}

function cancelFullscreenEdit() {
  fullscreenEditingNodeId.value = ''
  fullscreenEditSummary.value = ''
  fullscreenEditContentText.value = ''
  fullscreenEditDetailText.value = ''
}

function saveFullscreenEdit(node = {}) {
  if (!node?.id || !canSaveFullscreenEdit.value) return
  emit('edit-node', {
    nodeId: node.id,
    editedSummary: fullscreenEditSummary.value.trim(),
    editedContentText: fullscreenEditContentText.value.trim(),
    editedDetailText: fullscreenEditDetailText.value.trim(),
    originalNode: node
  })
  cancelFullscreenEdit()
}

function hasPathGraph(node = {}) {
  return node.id === 'flow' && Array.isArray(node.pathGraph?.nodes) && node.pathGraph.nodes.length > 0
}

function pathGraphNodes(node = {}) {
  return Array.isArray(node.pathGraph?.nodes)
    ? node.pathGraph.nodes.filter((item) => item && typeof item === 'object').slice(0, 12)
    : []
}

function pathGraphEdges(node = {}) {
  return Array.isArray(node.pathGraph?.edges)
    ? node.pathGraph.edges.filter((item) => item && typeof item === 'object').slice(0, 16)
    : []
}

function pathGraphLegend(node = {}) {
  return Array.isArray(node.pathGraph?.legend)
    ? node.pathGraph.legend.filter((item) => item && typeof item === 'object').slice(0, 6)
    : []
}

function pathGraphNodeLabel(node = {}, nodeId = '') {
  return pathGraphNodes(node).find((item) => item.id === nodeId)?.label || nodeId
}

function detailSectionItems(node = {}, titlePattern) {
  const matcher = titlePattern instanceof RegExp ? titlePattern : new RegExp(String(titlePattern || ''), 'i')
  return (Array.isArray(node.detailSections) ? node.detailSections : [])
    .filter((section) => matcher.test(`${section.title || ''} ${section.meta || ''}`))
    .flatMap((section) => (Array.isArray(section.items) ? section.items : []))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function edgeTone(label = '', toType = '') {
  const text = `${label} ${toType}`
  if (/错误|失败|异常|回退|返回|error/.test(text)) return 'warning'
  if (/成功|正确|完成|下一步|end/.test(text)) return 'success'
  if (/POST|GET|PUT|PATCH|DELETE|api/i.test(text)) return 'api'
  if (/注册|忘记|找回|切换|分支|decision/.test(text)) return 'branch'
  return 'neutral'
}

function flowDetailMetrics(node = {}) {
  const nodes = pathGraphNodes(node)
  const edges = pathGraphEdges(node)
  const decisionCount = nodes.filter((item) => item.type === 'decision').length
  const exceptionCount = edges.filter((edge) => /错误|失败|异常|回退|返回|error/i.test(edge.label || '')).length
  const apiCount = edges.filter((edge) => /POST|GET|PUT|PATCH|DELETE|api/i.test(edge.label || '')).length
  return [
    { label: '路径节点', value: nodes.length, hint: '覆盖页面、动作和判断点', tone: 'neutral' },
    { label: '用户动作', value: edges.length, hint: '每条连线对应一次状态推进', tone: 'branch' },
    { label: '接口调用', value: apiCount, hint: apiCount ? '需要前后端联调确认' : '当前未识别接口边', tone: 'api' },
    { label: '异常回退', value: exceptionCount + decisionCount, hint: '判断分支与失败路径要单独验收', tone: 'warning' }
  ]
}

function flowStepRows(node = {}) {
  return pathGraphEdges(node).map((edge, index) => {
    const toNode = pathGraphNodes(node).find((item) => item.id === edge.to) || {}
    const action = String(edge.label || '状态推进').trim()
    return {
      index: String(index + 1).padStart(2, '0'),
      from: pathGraphNodeLabel(node, edge.from),
      to: pathGraphNodeLabel(node, edge.to),
      action,
      type: /POST|GET|PUT|PATCH|DELETE|api/i.test(action)
        ? '接口'
        : toNode.type === 'decision'
          ? '判断'
          : /错误|失败|异常|回退/.test(action)
            ? '异常'
            : /返回|注册|忘记|找回|切换/.test(action)
              ? '分支'
              : '动作',
      tone: edgeTone(action, toNode.type)
    }
  })
}

function flowBackendRows(node = {}) {
  const apiRows = flowStepRows(node).filter((row) => row.type === '接口')
  if (apiRows.length) {
    return apiRows.map((row, index) => ({
      index: String(index + 1).padStart(2, '0'),
      api: row.action,
      detail: `${row.from} 触发请求，后端返回后驱动 ${row.to} 的成功或失败状态。`
    }))
  }
  return [{
    index: '01',
    api: '未识别接口边',
    detail: '建议在路径边上标注 POST / GET 等接口，方便生成联调清单。'
  }]
}

function flowExceptionRows(node = {}) {
  const edgeRows = flowStepRows(node)
    .filter((row) => row.tone === 'warning' || /返回|回退|失败|错误|异常/.test(`${row.action} ${row.to}`))
    .map((row, index) => ({
      index: String(index + 1).padStart(2, '0'),
      title: `${row.from} → ${row.to}`,
      detail: row.action
    }))
  const recoveryRows = detailSectionItems(node, /断点|恢复|异常|错误|失败|回退/).slice(0, 4).map((item, index) => ({
    index: String(edgeRows.length + index + 1).padStart(2, '0'),
    title: '补充恢复策略',
    detail: item
  }))
  return [...edgeRows, ...recoveryRows].slice(0, 6)
}

function flowAcceptanceChecks(node = {}) {
  const rows = flowStepRows(node)
  const joined = rows.map((row) => `${row.action} ${row.from} ${row.to}`).join(' ')
  return [
    {
      label: '主路径可闭环',
      passed: /成功|正确|下一步|完成/.test(joined),
      detail: '用户从入口提交后能进入明确的成功态或下一步。'
    },
    {
      label: '失败态可回退',
      passed: /错误|失败|回退|返回/.test(joined),
      detail: '账号错误、校验失败等场景能回到可编辑状态。'
    },
    {
      label: '接口边已标注',
      passed: /POST|GET|PUT|PATCH|DELETE|api/i.test(joined),
      detail: '路径中包含可交付给后端和测试的接口名称。'
    },
    {
      label: '分支入口可追踪',
      passed: /注册|忘记|找回|切换/.test(joined),
      detail: '注册、找回、返回登录等支线不会丢失上下文。'
    }
  ]
}

function isTreeItemExpanded(nodeId, itemKey) {
  return expandedTreeItems.value.has(`${nodeId}:${itemKey}`)
}

function visibleTreeItems(node = {}) {
  const hiddenDepths = []
  return normalizeTreeItems(node).filter((item) => {
    while (hiddenDepths.length && item.depth <= hiddenDepths[hiddenDepths.length - 1]) hiddenDepths.pop()
    if (hiddenDepths.length) return false
    if (item.hasChildren && item.depth > 0 && !isTreeItemExpanded(node.id, item.key)) hiddenDepths.push(item.depth)
    return true
  })
}

function toggleTreeItem(nodeId, itemKey) {
  const next = new Set(expandedTreeItems.value)
  const key = `${nodeId}:${itemKey}`
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedTreeItems.value = next
}

function focusNode(nodeId) {
  const node = props.nodes.find((item) => item.id === nodeId)
  const viewport = viewportRef.value
  if (!node || !viewport) return
  const targetLeft = Math.max(0, node.x * props.zoom - viewport.clientWidth / 2 + (node.width * props.zoom) / 2)
  const targetTop = Math.max(0, node.y * props.zoom - viewport.clientHeight / 2 + (node.height * props.zoom) / 2)
  viewport.scrollTo({
    left: targetLeft,
    top: targetTop,
    behavior: 'smooth'
  })
  spotlightNodeId.value = nodeId
  if (spotlightTimer) window.clearTimeout(spotlightTimer)
  spotlightTimer = window.setTimeout(() => {
    if (spotlightNodeId.value === nodeId) spotlightNodeId.value = ''
  }, 1500)
}

watch(
  () => props.activeNode?.id,
  (nodeId) => {
    if (!nodeId) return
    nextTick(() => focusNode(nodeId))
  }
)

watch(
  () => props.fullscreenNode?.id || '',
  (nodeId) => {
    if (!nodeId || (fullscreenEditingNodeId.value && fullscreenEditingNodeId.value !== nodeId)) cancelFullscreenEdit()
  }
)

defineExpose({ focusNode })

function nodeCenter(nodeId) {
  const node = props.nodes.find((item) => item.id === nodeId)
  if (!node) return { x: 0, y: 0 }
  return {
    x: node.x + node.width,
    y: node.y + node.height / 2
  }
}

function edgePath(edge) {
  const from = nodeCenter(edge.from)
  const to = props.nodes.find((item) => item.id === edge.to)
  const end = to
    ? { x: to.x, y: to.y + to.height / 2 }
    : nodeCenter(edge.to)
  const gap = Math.max(120, Math.abs(end.x - from.x) * 0.42)
  return `M ${from.x} ${from.y} C ${from.x + gap} ${from.y}, ${end.x - gap} ${end.y}, ${end.x} ${end.y}`
}

function isActiveIncomingEdge(edge) {
  return Boolean(props.activeNode?.id && edge.to === props.activeNode.id)
}

function signedDelta(value) {
  const numberValue = Number(value || 0)
  if (numberValue > 0) return `+${numberValue}`
  return `${numberValue}`
}

function visibleVersionNodeDiffs(version = {}) {
  return (Array.isArray(version.appliedPatch?.nodeDiffs) ? version.appliedPatch.nodeDiffs : [])
    .filter((diff) => diff && typeof diff === 'object')
    .slice(0, 4)
}

function contentCountDelta(diff = {}) {
  const beforeCount = Number(diff.before?.contentCount || 0)
  const afterCount = Number(diff.after?.contentCount || 0)
  return signedDelta(afterCount - beforeCount)
}

const rollbackPreviewVersion = computed(() =>
  props.versionHistory.find((version) => version?.id === rollbackPreviewVersionId.value) || null
)

function openRollbackPreview(version = {}) {
  if (!version?.snapshot) return
  rollbackPreviewVersionId.value = rollbackPreviewVersionId.value === version.id ? '' : version.id
}

function closeRollbackPreview() {
  rollbackPreviewVersionId.value = ''
}

function confirmRollbackVersion() {
  if (!rollbackPreviewVersion.value?.snapshot) return
  const version = rollbackPreviewVersion.value
  closeRollbackPreview()
  emit('rollback-version', version)
}
</script>
