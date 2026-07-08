<template>
  <aside ref="drawerRef" class="agent-drawer" :style="{ '--agent-drawer-width': `${width}px` }">
    <button class="agent-resize-handle" type="button" aria-label="拖拽调整 Agent 宽度" @pointerdown="$emit('start-resize', $event)"></button>
    <div class="agent-drawer-head">
      <div class="agent-title-row">
        <div v-if="visibleCanvasTabs.length" class="agent-node-switcher">
          <button class="agent-node-trigger" type="button" aria-label="切换当前环节" @click="toggleAgentNodeMenu">
            <span>{{ activeNodeLabel }}</span>
            <i></i>
          </button>
          <div v-if="nodeMenuOpen" class="agent-node-menu">
            <button
              v-for="(tab, index) in visibleCanvasTabs"
              :key="canvasTabKey(tab, index)"
              type="button"
              :class="{ active: canvasTabId(tab, index) === activeNodeId }"
              @click="selectNode(canvasTabId(tab, index))"
            >
              {{ canvasTabLabel(tab, index) }}
            </button>
          </div>
        </div>
      </div>
      <div class="agent-head-actions">
        <div v-if="visibleHistoryItems.length" class="agent-history-entry">
          <button class="agent-history-icon" type="button" title="历史版本" aria-label="历史版本" @click="$emit('toggle-history')">
            <span></span>
          </button>
          <div v-if="historyOpen" class="agent-history-popover">
            <strong>历史版本</strong>
            <small>近 {{ visibleHistoryItems.length }} 个版本</small>
            <button
              v-for="(item, index) in visibleHistoryItems"
              :key="historyItemKey(item, index)"
              type="button"
              @click="selectHistoryItem(historyItemContent(item))"
            >
              {{ historyItemLabel(item, index) }}
            </button>
          </div>
        </div>
        <button class="agent-collapse-icon" type="button" title="收起对话区" @click="$emit('close')" aria-label="收起 Agent">
          <span></span>
        </button>
      </div>
    </div>

    <section v-if="visibleAgentInteraction" class="agent-interaction-panel">
      <strong>{{ agentInteractionGoal() }}</strong>
      <p>{{ agentInteractionConfirmationRule() }}</p>
      <div v-if="visibleSuggestedQuestions.length" class="agent-suggested-questions">
        <button
          v-for="question in visibleSuggestedQuestions"
          :key="question"
          type="button"
          :disabled="sending"
          @click="$emit('quick-reply', question)"
        >
          {{ question }}
        </button>
      </div>
    </section>

    <div class="agent-chat-region">
      <section ref="chatListRef" class="agent-chat-list" @scroll="handleChatScroll">
        <article
          v-for="(message, index) in visibleMessages"
          :key="messageKey(message, index)"
          data-state-class="agent-message-pending"
          :class="[
            `agent-message agent-${messageRole(message)}`,
            {
              'agent-message-pending': isMessageBusy(message),
              'agent-message-failed': isMessageFailed(message)
            }
          ]"
        >
          <small>{{ messageRole(message) === 'user' ? '你' : 'Agent' }}</small>
          <pre>{{ messageContent(message) }}</pre>
          <div v-if="shouldShowMessageMeta(message)" class="agent-message-meta">
            <span
              v-for="item in messageMetaItems(message, model)"
              :key="item.key"
              :class="item.class"
            >
              {{ item.label }}
            </span>
            <span v-if="messageProposalStatusLabel(message)" class="proposal-status">
              {{ messageProposalStatusLabel(message) }}
            </span>
          </div>
          <details v-if="messageKnowledgeItems(message).length" class="agent-knowledge-evidence">
            <summary>已引用项目知识 {{ messageKnowledgeItems(message).length }}</summary>
            <article
              v-for="(item, index) in messageKnowledgeItems(message)"
              :key="knowledgeEvidenceKey(item, index)"
              class="agent-knowledge-card"
            >
              <strong>{{ knowledgeTitle(item, index) }}</strong>
              <div class="agent-knowledge-meta-grid">
                <span>来源标题：{{ knowledgeSourceTitle(item) }}</span>
                <span>所属项目：{{ knowledgeProjectLabel(item) }}</span>
                <span>资料类型：{{ knowledgeMaterialTypeLabel(item) }}</span>
                <span>来源：{{ knowledgeSourceLabel(item) }}</span>
              </div>
              <p class="agent-knowledge-snippet">命中片段：{{ knowledgeSnippet(item) }}</p>
              <p class="agent-knowledge-reason">命中原因：{{ knowledgeMatchReason(item) }}</p>
            </article>
          </details>
          <details v-if="messageProposalEvidence(message).rationale.length || messageProposalEvidence(message).contextSources.length" class="agent-proposal-evidence">
            <summary>提案依据</summary>
            <div v-if="messageProposalEvidence(message).rationale.length" class="agent-proposal-rationale">
              <span
                v-for="item in messageProposalEvidence(message).rationale"
                :key="item"
              >
                {{ item }}
              </span>
            </div>
            <article
              v-for="(item, index) in messageProposalEvidence(message).contextSources"
              :key="proposalEvidenceKey(item, index)"
              class="agent-knowledge-card"
            >
              <strong>{{ proposalSourceTitle(item, index) }}</strong>
              <div class="agent-proposal-source-meta">
                <span>来源类型：{{ item.typeLabel }}</span>
                <span>可信状态：{{ item.verificationLabel }}</span>
              </div>
              <p class="agent-knowledge-snippet">{{ proposalSourceSnippet(item) }}</p>
              <p class="agent-knowledge-reason">命中原因：{{ proposalSourceReason(item) }}</p>
            </article>
          </details>
          <section v-if="messageAppliedPatchSummary(message).changedNodeIds.length || messageAppliedPatchSummary(message).reason" class="agent-applied-patch-card">
            <strong>已更新画布</strong>
            <div v-if="messageAppliedPatchSummary(message).changedNodeIds.length">
              <span
                v-for="nodeId in messageAppliedPatchSummary(message).changedNodeIds"
                :key="nodeId"
              >
                {{ nodeId }}
              </span>
            </div>
            <div v-if="messageAppliedPatchSummary(message).nodeDiffs.length" class="agent-node-diff-list">
              <article
                v-for="diff in messageAppliedPatchSummary(message).nodeDiffs"
                :key="diff.nodeId"
                class="agent-node-diff-item"
              >
                <strong>{{ diff.title || diff.nodeId }}</strong>
                <p>改前：{{ diff.before.summary || '暂无摘要' }}</p>
                <p>改后：{{ diff.after.summary || '暂无摘要' }}</p>
              </article>
            </div>
            <div v-if="messageAppliedPatchSummary(message).auditItems.length" class="agent-applied-audit">
              <strong>审计信息</strong>
              <span
                v-for="item in messageAppliedPatchSummary(message).auditItems"
                :key="item"
              >
                {{ item }}
              </span>
            </div>
            <p v-if="messageAppliedPatchSummary(message).reason">{{ messageAppliedPatchSummary(message).reason }}</p>
          </section>
          <p v-if="messageErrorText(message)" class="agent-message-error">
            {{ messageErrorText(message) }}
          </p>
          <p v-if="messageKnowledgeRetrievalError(message)" class="agent-message-error">
            {{ messageKnowledgeRetrievalError(message) }}
          </p>
          <div v-if="messageRecoveryActions(message).length" class="agent-recovery-actions">
            <button
              v-for="action in messageRecoveryActions(message)"
              :key="action"
              type="button"
              :disabled="sending"
              @click="$emit('recovery-action', message, action)"
            >
              {{ action }}
            </button>
          </div>
          <div v-if="messageConfirmProgressSteps(message).length" class="agent-confirm-progress">
            <span
              v-for="step in messageConfirmProgressSteps(message)"
              :key="step.key"
              class="agent-confirm-progress-step"
              :class="{ active: step.active, done: step.done }"
            >
              {{ step.label }}
            </span>
          </div>
          <div v-if="hasMessageActions(message)" class="agent-message-actions">
            <button v-if="canCopyMessage(message)" type="button" @click="$emit('copy-message', message)">复制</button>
            <button v-if="canRetryMessage(message)" type="button" :disabled="sending" @click="$emit('retry-message', message)">
              {{ retryActionLabel(message) }}
            </button>
            <button v-if="canEditMessage(message)" type="button" :disabled="sending" @click="$emit('edit-message', message)">编辑重发</button>
            <button v-if="canConfirmMessage(message)" type="button" :disabled="sending" @click="$emit('confirm-message', message)">确认入画布</button>
          </div>
        </article>
      </section>
      <button
        class="agent-scroll-bottom"
        :class="{ visible: showScrollBottom }"
        type="button"
        aria-label="回到底部"
        @click="scrollAgentChatToBottom"
      >
        ↓
      </button>
    </div>

    <section v-if="visibleQuickReplies.length" class="agent-quick-row">
      <button v-for="reply in visibleQuickReplies" :key="reply" type="button" :disabled="sending" @click="$emit('quick-reply', reply)">
        {{ reply }}
      </button>
    </section>

    <footer class="agent-composer-shell">
      <div v-if="editingMessage" class="agent-editing-banner">
        <div>
          <strong>正在编辑</strong>
          <span>{{ messageContent(editingMessage) }}</span>
        </div>
        <button type="button" :disabled="sending" @click="$emit('cancel-edit')">取消</button>
      </div>
      <div v-if="retryMessage" class="agent-retry-banner">
        <div>
          <strong>正在重新生成</strong>
          <span>{{ messageContent(retryMessage) }}</span>
        </div>
        <button type="button" :disabled="sending" @click="$emit('cancel-retry')">取消</button>
      </div>
      <input
        ref="fileInput"
        class="hidden-file-input"
        type="file"
          multiple
          accept="image/*,.pdf,.docx,.md,.txt,.xlsx,.csv,.json"
          :disabled="sending"
          @change="$emit('import-files', $event)"
        />
      <div class="agent-composer-box">
        <textarea
          ref="composerRef"
          :value="input"
          :placeholder="composerPlaceholder"
          :disabled="sending"
          @input="$emit('update-input', $event.target.value)"
          @keydown="handleComposerKeydown"
        ></textarea>
        <div class="agent-composer-toolbar">
          <div class="agent-composer-tools">
            <div class="agent-plus-wrap">
              <button type="button" class="agent-plus-button" :disabled="sending" @click="$emit('toggle-upload-menu')">＋</button>
              <div v-if="uploadOpen" class="agent-upload-menu">
                <button type="button" :disabled="sending" @click="triggerUpload">上传文件或图片</button>
                <button type="button" :disabled="sending" @click="$emit('add-cloud-doc')">添加飞书云文档</button>
              </div>
            </div>
            <div v-if="visibleReferences.length" class="agent-reference-list">
              <article
                v-for="(file, index) in visibleReferences"
                :key="referenceKey(file, index)"
                class="agent-reference-card"
                :class="referenceStatusClass(file)"
              >
                <img v-if="referencePreview(file)" :src="referencePreview(file)" :alt="referenceName(file, index)" />
                <span v-else>{{ referenceKindLabel(file) }}</span>
                <div>
                  <strong>{{ referenceName(file, index) }}</strong>
                  <small class="agent-reference-status">{{ referenceStatusLabel(referenceStatus(file)) }}</small>
                  <small v-if="referenceStatus(file) === 'failed' && referenceErrorMessage(file)" class="agent-reference-error">{{ referenceErrorMessage(file) }}</small>
                </div>
                <button type="button" aria-label="删除参考文件" title="删除后重新上传" :disabled="sending" @click="$emit('remove-reference', referenceId(file, index))">×</button>
              </article>
            </div>
            <select class="agent-model-select" :value="model" aria-label="选择模型" :disabled="sending" @change="$emit('update-model', $event.target.value)">
              <option v-for="(item, index) in visibleModelOptions" :key="modelOptionKey(item, index)" :value="modelOptionValue(item, index)">{{ modelOptionLabel(item, index) }}</option>
            </select>
          </div>
          <button v-if="sending" class="agent-stop-button" type="button" @click="$emit('stop-generating')">停止生成</button>
          <button class="primary agent-send-button" type="button" :disabled="!canSubmitComposer()" @click="$emit('send')">
            {{ sending ? '…' : '↑' }}
          </button>
        </div>
      </div>
    </footer>
  </aside>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  session: { type: Object, required: true },
  canvasTabs: { type: Array, default: () => [] },
  activeNode: { type: Object, default: null },
  activeNodeId: { type: String, default: '' },
  model: { type: String, default: 'gpt-5.5' },
  quickReplies: { type: Array, default: () => [] },
  historyOpen: { type: Boolean, default: false },
  references: { type: Array, default: () => [] },
  input: { type: String, default: '' },
  editingMessage: { type: Object, default: null },
  retryMessage: { type: Object, default: null },
  uploadOpen: { type: Boolean, default: false },
  width: { type: Number, default: 680 },
  sending: { type: Boolean, default: false }
})

const emit = defineEmits([
  'close',
  'update-node',
  'update-model',
  'quick-reply',
  'toggle-history',
  'close-history',
  'close-upload-menu',
  'select-history',
  'import-files',
  'remove-reference',
  'copy-message',
  'retry-message',
  'recovery-action',
  'edit-message',
  'cancel-edit',
  'cancel-retry',
  'confirm-message',
  'update-input',
  'toggle-upload-menu',
  'add-cloud-doc',
  'start-resize',
  'stop-generating',
  'send'
])

const fileInput = ref(null)
const composerRef = ref(null)
const chatListRef = ref(null)
const drawerRef = ref(null)
const showScrollBottom = ref(false)
const nodeMenuOpen = ref(false)

const agentInteraction = computed(() => props.activeNode?.agentInteraction || null)
function isPlainRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const visibleCanvasTabs = computed(() =>
  Array.isArray(props.canvasTabs) ? props.canvasTabs.filter(isPlainRecord) : []
)
const activeNodeLabel = computed(() => {
  const activeTabIndex = visibleCanvasTabs.value.findIndex((tab, index) => canvasTabId(tab, index) === props.activeNodeId)
  if (activeTabIndex >= 0) return canvasTabLabel(visibleCanvasTabs.value[activeTabIndex], activeTabIndex)
  return props.activeNode?.title || props.session.title
})
function agentInteractionGoal() {
  return String(agentInteraction.value?.goal || '').trim() || '围绕当前环节补充需求'
}

function agentInteractionConfirmationRule() {
  return String(agentInteraction.value?.confirmationRule || '').trim() || '补充资料后可由后端重新分析当前画布。'
}

const visibleSuggestedQuestions = computed(() => {
  const suggestedQuestions = Array.isArray(agentInteraction.value?.suggestedQuestions) ? agentInteraction.value.suggestedQuestions : []
  return Array.from(new Set(
    suggestedQuestions
      .map((question) => String(question || '').trim())
      .filter(Boolean)
  ))
})
const visibleAgentInteraction = computed(() =>
  Boolean(agentInteraction.value || visibleSuggestedQuestions.value.length)
)
const visibleQuickReplies = computed(() => {
  const quickReplies = Array.isArray(props.quickReplies) ? props.quickReplies : []
  return Array.from(new Set(
    quickReplies
      .map((reply) => String(reply || '').trim())
      .filter(Boolean)
      .filter((reply) => reply && !isConfirmReply(reply))
  ))
})
const visibleReferences = computed(() =>
  Array.isArray(props.references) ? props.references.filter(isPlainRecord) : []
)
const visibleMessages = computed(() =>
  Array.isArray(props.session?.messages)
    ? props.session.messages.filter(isPlainRecord).filter((message) => !isLegacyPlaceholderAgentMessage(message))
    : []
)
const visibleHistoryItems = computed(() =>
  Array.isArray(props.session?.history) ? props.session.history.filter(isPlainRecord) : []
)
const visibleModelOptions = computed(() => {
  if (Array.isArray(props.session?.model?.options)) {
    const modelOptions = props.session.model.options.filter(isPlainRecord)
    return modelOptions.length ? modelOptions : [{ value: props.model, label: props.model }]
  }
  return [{ value: props.model, label: props.model }]
})
const composerPlaceholder = computed(() =>
  agentInteraction.value?.inputPlaceholder ||
  `只针对「${props.activeNode?.title || props.session.title}」提问、补充资料，或选择无疑问跳过。`
)

function messageKey(message = {}, index = 0) {
  return message.id || message.clientMessageId || message.meta?.clientMessageId || `${message.role || 'message'}-${message.createdAt || index}-${index}`
}

function historyItemKey(item = {}, index = 0) {
  return item.id || item.createdAt || item.label || `history-${index}`
}

function historyItemLabel(item = {}, index = 0) {
  return String(item.label || item.createdAt || `版本 ${index + 1}`)
}

function historyItemContent(item = {}) {
  return String(item.content ?? '')
}

function modelOptionKey(item = {}, index = 0) {
  return item.value || item.label || `model-${index}`
}

function modelOptionValue(item = {}, index = 0) {
  return String(item.value || item.id || item.label || props.model || `model-${index}`)
}

function modelOptionLabel(item = {}, index = 0) {
  return String(item.label || item.name || item.value || item.id || `模型 ${index + 1}`)
}

function canvasTabKey(tab = {}, index = 0) {
  return tab.key || tab.id || tab.label || `tab-${index}`
}

function canvasTabId(tab = {}, index = 0) {
  return String(tab.key || tab.id || `tab-${index}`)
}

function canvasTabLabel(tab = {}, index = 0) {
  return String(tab.label || tab.title || tab.key || tab.id || `环节 ${index + 1}`)
}

function referenceKey(file = {}, index = 0) {
  return file.id || file.name || `reference-${index}`
}

function referenceId(file = {}, index = 0) {
  return String(file.id || file.name || `reference-${index}`)
}

function referenceName(file = {}, index = 0) {
  return String(file.name || file.title || `参考文件 ${index + 1}`)
}

function referenceStatus(file = {}) {
  const status = String(file.status || '').trim()
  return ['uploading', 'ready', 'failed', 'pending'].includes(status) ? status : 'pending'
}

function referenceStatusClass(file = {}) {
  return `reference-${referenceStatus(file)}`
}

function referencePreview(file = {}) {
  return String(file.preview || '')
}

function referenceKindLabel(file = {}) {
  return file.kind === 'image' ? '图' : '文'
}

function referenceErrorMessage(file = {}) {
  return String(file.errorMessage || '')
}

function selectNode(nodeId) {
  nodeMenuOpen.value = false
  emit('update-node', nodeId)
}

function closeAgentNodeMenu() {
  nodeMenuOpen.value = false
}

function closeAgentHistory() {
  if (props.historyOpen) emit('close-history')
}

function closeAgentUploadMenu() {
  if (props.uploadOpen) emit('close-upload-menu')
}

function toggleAgentNodeMenu() {
  nodeMenuOpen.value = !nodeMenuOpen.value
  if (nodeMenuOpen.value) {
    closeAgentHistory()
    closeAgentUploadMenu()
  }
}

function isInsideAgentPopoverControl(event, selector) {
  return Boolean(event.target?.closest?.(selector))
}

function handleGlobalPointerDown(event) {
  const insideNodeSwitcher = isInsideAgentPopoverControl(event, '.agent-node-switcher')
  const insideHistoryEntry = isInsideAgentPopoverControl(event, '.agent-history-entry')
  const insideUploadMenu = isInsideAgentPopoverControl(event, '.agent-plus-wrap')

  if (!insideNodeSwitcher) closeAgentNodeMenu()
  if (!insideHistoryEntry) closeAgentHistory()
  if (!insideUploadMenu) closeAgentUploadMenu()
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    closeAgentHistory()
    closeAgentNodeMenu()
    closeAgentUploadMenu()
  }
}

function selectHistoryItem(content) {
  emit('select-history', content)
  closeAgentHistory()
}

function triggerUpload() {
  closeAgentUploadMenu()
  if (fileInput.value) fileInput.value.value = ''
  fileInput.value?.click?.()
}

function referenceStatusLabel(status = '') {
  if (status === 'ready') return '已读取'
  if (status === 'failed') return '读取失败'
  if (status === 'uploading') return '上传中'
  return '待解析'
}

function messageStatus(message) {
  return String(messageMeta(message).status || '')
}

function messageStatusClass(message) {
  return `status-${messageStatus(message)}`
}

function messageStatusLabel(message) {
  const status = messageStatus(message)
  const labels = {
    pending: '准备发送',
    retrieving: '检索知识',
    generating: '生成回复',
    'merging-canvas': '合并画布',
    success: '已完成',
    failed: '发送失败',
    cancelled: '已停止'
  }
  return String(messageMeta(message).statusLabel || labels[status] || status)
}

function isMessageBusy(message) {
  return ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(messageStatus(message))
}

function isMessageFailed(message) {
  return messageStatus(message) === 'failed'
}

function hasMessageActions(message) {
  return canCopyMessage(message) ||
    canRetryMessage(message) ||
    canEditMessage(message) ||
    canConfirmMessage(message)
}

function canCopyMessage(message) {
  return Boolean(messageContent(message).trim()) && !isMessageBusy(message)
}

function isConfirmCanvasMessage(message) {
  return messageMeta(message).action === 'confirm-canvas'
}

function messageActionStatus(message) {
  if (messageStatus(message)) return messageStatus(message)
  if (messageRole(message) === 'assistant' && messageContent(message).trim()) return 'success'
  return ''
}

function canRetryMessage(message) {
  const isAssistant = messageRole(message) === 'assistant'
  if (!isAssistant || isMessageBusy(message)) return false
  const status = messageActionStatus(message)
  if (isConfirmCanvasMessage(message)) {
    return status === 'failed' || status === 'cancelled'
  }
  return status === 'failed' || status === 'cancelled' || status === 'success'
}

function canEditMessage(message) {
  const isUser = messageRole(message) === 'user'
  return isUser && !isMessageBusy(message) && Boolean(messageContent(message).trim())
}

function isConfirmReply(reply = '') {
  return /确认/.test(String(reply || ''))
}

function canConfirmMessage(message) {
  const isAssistant = messageRole(message) === 'assistant'
  const proposalId = messageMeta(message).proposalId
  const proposalStatus = messageProposalStatus(message)
  if (!messageContent(message).trim()) return false
  return isAssistant &&
    Boolean(proposalId) &&
    proposalStatus !== 'superseded' &&
    proposalStatus !== 'stale' &&
    proposalStatus !== 'confirmed' &&
    !isMessageBusy(message) &&
    !isConfirmCanvasMessage(message) &&
    messageActionStatus(message) !== 'failed' &&
    messageActionStatus(message) !== 'cancelled'
}

function messageProposalStatus(message = {}) {
  const meta = messageMeta(message)
  return String(meta.proposalStatus || meta.proposalSummary?.status || '').trim()
}

function messageProposalStatusLabel(message = {}) {
  const status = messageProposalStatus(message)
  if (status === 'superseded') return '提案已被新版替代'
  if (status === 'confirmed') return '提案已确认'
  if (status === 'stale') return '提案已失效'
  return ''
}

function retryActionLabel(message) {
  if (messageMeta(message).error?.code === 'AGENT_MODEL_PATCH_INVALID' ||
    messageMeta(message).error?.code === 'AGENT_PROPOSAL_NOT_FOUND' ||
    messageMeta(message).error?.code === 'AGENT_PROPOSAL_NOT_PENDING' ||
    messageMeta(message).error?.code === 'AGENT_PROPOSAL_STALE') return '重新生成建议'
  return messageStatus(message) === 'failed' || messageStatus(message) === 'cancelled' ? '重试' : '重新生成'
}

function messageConfirmProgressSteps(message = {}) {
  if (!isConfirmCanvasMessage(message) || !isMessageBusy(message)) return []
  const current = messageStatus(message) || 'merging-canvas'
  const activeKey = messageMeta(message).progressStep || (current === 'merging-canvas' ? 'refreshing-downstream' : 'validating-proposal')
  const steps = [
    { key: 'validating-proposal', label: '校验提案' },
    { key: 'rewriting-current', label: '重写当前画布' },
    { key: 'refreshing-downstream', label: '刷新后续画布' },
    { key: 'saving-version', label: '保存版本' }
  ]
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === activeKey))
  return steps.map((step, index) => ({
    ...step,
    active: index === activeIndex,
    done: index < activeIndex
  }))
}

function messageAppliedPatchSummary(message = {}) {
  const meta = messageMeta(message)
  const appliedPatch = isPlainRecord(meta.appliedPatch) ? meta.appliedPatch : {}
  const changedNodeIds = Array.isArray(meta.changedNodeIds)
    ? meta.changedNodeIds
    : (Array.isArray(appliedPatch.changedNodeIds) ? appliedPatch.changedNodeIds : [])
  const nodeDiffs = Array.isArray(appliedPatch.nodeDiffs) ? appliedPatch.nodeDiffs.filter(isPlainRecord).slice(0, 6) : []
  const audit = isPlainRecord(appliedPatch.audit) ? appliedPatch.audit : {}
  const auditItems = [
    audit.proposalId ? `提案 ${audit.proposalId}` : '',
    audit.model ? `模型 ${audit.model}` : '',
    audit.source ? `来源 ${audit.source}` : '',
    audit.appliedAt ? `时间 ${audit.appliedAt}` : ''
  ].filter(Boolean)
  return {
    changedNodeIds: changedNodeIds.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
    nodeDiffs,
    audit,
    auditItems,
    reason: String(meta.refreshReason || appliedPatch.reason || '').trim()
  }
}

function messageProposalEvidence(message = {}) {
  const proposalSummary = isPlainRecord(messageMeta(message).proposalSummary) ? messageMeta(message).proposalSummary : {}
  return {
    rationale: Array.isArray(proposalSummary.rationale)
      ? proposalSummary.rationale.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
      : [],
    contextSources: Array.isArray(proposalSummary.contextSources)
      ? proposalSummary.contextSources.filter(isPlainRecord).slice(0, 6).map((item) => ({
        ...item,
        typeLabel: proposalSourceTypeLabel(item),
        verificationLabel: proposalSourceVerificationLabel(item)
      }))
      : []
  }
}

function proposalEvidenceKey(item = {}, index = 0) {
  return `${item.type || 'proposal'}-${item.title || item.snippet || index}-${index}`
}

function proposalSourceTitle(item = {}, index = 0) {
  return String(item.title || item.type || `上下文 ${index + 1}`)
}

function proposalSourceTypeLabel(item = {}) {
  return String(item.type || item.sourceType || item.materialType || '上下文')
}

function proposalSourceVerificationLabel(item = {}) {
  const verification = item.verification && typeof item.verification === 'object' && !Array.isArray(item.verification)
    ? item.verification
    : {}
  return String(verification.status || item.verificationStatus || item.status || '未验证')
}

function proposalSourceSnippet(item = {}) {
  return String(item.snippet || '暂无片段')
}

function proposalSourceReason(item = {}) {
  return String(item.matchReason || '用于生成本次可确认提案')
}

function messageKnowledgeItems(message = {}) {
  const items = messageKnowledgeItemsRaw(message).filter(isPlainRecord)
  if (items.length) return items
  return []
}

function messageKnowledgeItemsRaw(message) {
  const meta = messageMeta(message)
  return Array.isArray(meta.retrievedKnowledge) ? meta.retrievedKnowledge : []
}

function knowledgeSourceLabel(item = {}) {
  const roleScopes = Array.isArray(item.roleScopes) && item.roleScopes.length ? item.roleScopes.join('/') : ''
  return [item.sourceType || '知识库', item.sourceUrl || '', roleScopes].filter(Boolean).join(' · ')
}

function knowledgeTitle(item = {}, index = 0) {
  return String(item.title || item.sourceTitle || item.materialId || `知识引用 ${index + 1}`)
}

function knowledgeSourceTitle(item = {}) {
  return item.sourceTitle || item.evidence?.[0]?.title || item.title || '未命名来源'
}

function knowledgeProjectLabel(item = {}) {
  return item.projectName || item.projectId || '当前项目'
}

function knowledgeMaterialTypeLabel(item = {}) {
  return item.materialType || item.sourceType || '知识资料'
}

function knowledgeSnippet(item = {}) {
  return String(item.snippet || item.content || item.evidence?.[0]?.text || '暂无片段')
}

function knowledgeMatchReason(item = {}) {
  return String(item.matchReason || '与当前问题相关')
}

function knowledgeEvidenceKey(item = {}, index = 0) {
  return `${item.id || item.materialId || item.sourceUrl || item.sourceTitle || item.title || 'knowledge'}-${index}`
}

function messageMeta(message) {
  return message && typeof message.meta === 'object' && !Array.isArray(message.meta) ? message.meta : {}
}

function messageRole(message) {
  return ['user', 'assistant'].includes(message?.role) ? message.role : 'assistant'
}

function messageContent(message) {
  return String(message?.content ?? '')
}

function isLegacyPlaceholderAgentMessage(message = {}) {
  const content = messageContent(message)
  const actionType = messageActionTypeLabel(message)
  return messageRole(message) === 'assistant' && (
    /补充信息已接收/.test(content) ||
    /已把[\s\S]*写入当前小画板上下文/.test(content) ||
    actionType === 'context-note'
  )
}

function messageProviderLabel(message) {
  return String(messageMeta(message).provider || 'unknown')
}

function messageModelLabel(message, fallbackModel = '') {
  return String(messageMeta(message).model || fallbackModel || 'unknown')
}

function messageUsageTotal(message) {
  return Number.isFinite(messageMeta(message).usage?.totalTokens) ? messageMeta(message).usage.totalTokens : 0
}

function messageActionTypeLabel(message) {
  return String(messageMeta(message).actionType || '')
}

function messageErrorText(message) {
  const error = messageMeta(message).error
  if (!error) return ''
  const text = String(error.message || error || '模型服务暂时不可用，已使用兜底反馈。')
  return text
}

function messageRecoveryActions(message) {
  const error = messageMeta(message).error
  if (!error) return []
  const recoveryActions = Array.isArray(error.recoveryActions)
    ? error.recoveryActions.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  return [...new Set(recoveryActions)]
}

function messageKnowledgeRetrievalError(message) {
  return String(messageMeta(message).knowledgeRetrievalError || '')
}

function messageMetaItems(message, fallbackModel = '') {
  if (messageRole(message) !== 'assistant') return []
  const items = []
  const status = messageStatus(message)
  if (status) {
    items.push({
      key: 'status',
      label: messageStatusLabel(message),
      class: ['agent-status-chip', messageStatusClass(message)]
    })
  }
  if (status === 'failed') {
    items.push({ key: 'failed-label', label: '发送失败', class: 'agent-message-failed' })
  }
  if (shouldShowUsageMeta(message)) {
    items.push({ key: 'usage', label: `Tokens ${messageUsageTotal(message)}` })
  }
  const knowledgeCount = messageKnowledgeItems(message).length
  if (knowledgeCount) {
    items.push({ key: 'knowledge', label: `知识 ${knowledgeCount}` })
  }
  if (messageKnowledgeRetrievalError(message)) {
    items.push({ key: 'knowledge-error', label: '知识检索失败' })
  }
  return items
}

function shouldShowMessageMeta(message) {
  return messageMetaItems(message).length > 0
}

function shouldShowProviderMeta(message) {
  return false
}

function shouldShowActionTypeMeta(message) {
  return false
}

function shouldShowUsageMeta(message) {
  return false
}

function composerDraftText() {
  return props.input.trim()
}

function canSubmitComposer() {
  return !props.sending && Boolean(composerDraftText())
}

function handleComposerKeydown(event) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!canSubmitComposer()) return
    emit('send')
  }
}

function focusComposer() {
  nextTick(() => composerRef.value?.focus?.())
}

function isChatAtBottom() {
  const el = chatListRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 24
}

function handleChatScroll() {
  showScrollBottom.value = !isChatAtBottom()
}

function scrollAgentChatToBottom(behavior = 'smooth') {
  const el = chatListRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior })
  showScrollBottom.value = false
}

watch(
  () => visibleMessages.value.length,
  async () => {
    await nextTick()
    if (!showScrollBottom.value) scrollAgentChatToBottom()
    else handleChatScroll()
  },
  { immediate: true }
)

watch(
  () => visibleMessages.value.map((message) => messageContent(message)).join('\n---\n'),
  async () => {
    await nextTick()
    if (!showScrollBottom.value) scrollAgentChatToBottom('auto')
    else handleChatScroll()
  }
)

watch(
  () => props.sending,
  (sending, previous) => {
    if (previous && !sending) focusComposer()
  }
)

onMounted(() => {
  document.addEventListener('pointerdown', handleGlobalPointerDown)
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleGlobalPointerDown)
  document.removeEventListener('keydown', handleGlobalKeydown)
})

defineExpose({ focusComposer, scrollAgentChatToBottom })
</script>
