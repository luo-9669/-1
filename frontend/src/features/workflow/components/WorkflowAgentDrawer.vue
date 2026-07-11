<template>
  <aside
    ref="drawerRef"
    class="agent-drawer"
    :class="agentDrawerClasses"
    :style="{ '--agent-drawer-width': `${width}px`, '--agent-inline-width': props.inlineWidth, '--workflow-agent-embedded-top': props.inlineTop }"
  >
    <button v-if="resolvedDisplayMode === 'sidebar'" class="agent-resize-handle" type="button" aria-label="拖拽调整 Agent 宽度" @pointerdown="$emit('start-resize', $event)"></button>
    <button v-if="resolvedDisplayMode === 'inline'" class="agent-inline-resize-handle" type="button" aria-label="拖拽调整 Agent 宽度" @pointerdown="$emit('start-inline-resize', $event)"></button>
    <div class="agent-drawer-head">
      <div v-if="copyToastVisible" class="agent-copy-toast" role="status">复制成功</div>
      <div class="agent-title-row"></div>
      <div class="agent-head-actions">
        <div v-if="visibleHistoryItems.length" class="agent-history-entry">
          <BaseIconButton class="agent-history-icon" label="历史版本" type="button" title="历史版本" aria-label="历史版本" @click="$emit('toggle-history')">
            <History class="ui-icon" aria-hidden="true" :stroke-width="2" />
          </BaseIconButton>
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
        <BaseIconButton v-if="canInline && resolvedDisplayMode !== 'inline'" class="agent-display-icon" label="嵌入主区域" type="button" title="嵌入主区域" aria-label="嵌入主区域" @click="emit('change-display-mode', 'inline')">
          <PanelRightClose class="ui-icon" aria-hidden="true" :stroke-width="2" />
        </BaseIconButton>
        <BaseIconButton v-if="resolvedDisplayMode !== 'sidebar'" class="agent-display-icon" label="侧边栏" type="button" title="缩小到侧边栏" aria-label="缩小到侧边栏" @click="emit('change-display-mode', 'sidebar')">
          <PanelRightClose class="ui-icon" aria-hidden="true" :stroke-width="2" />
        </BaseIconButton>
        <BaseIconButton v-if="canLargeModes && resolvedDisplayMode !== 'fullscreen'" class="agent-display-icon" label="全屏" type="button" title="放大到全屏" aria-label="放大到全屏" @click="emit('change-display-mode', 'fullscreen')">
          <ArrowUp class="ui-icon" aria-hidden="true" :stroke-width="2" />
        </BaseIconButton>
        <BaseIconButton v-if="resolvedDisplayMode !== 'inline'" class="agent-collapse-icon" label="收起 Agent" type="button" title="收起对话区" aria-label="收起 Agent" @click="$emit('close')">
          <PanelRightClose class="ui-icon" aria-hidden="true" :stroke-width="2" />
        </BaseIconButton>
      </div>
    </div>

    <div class="agent-dialog-body">
      <section v-if="visibleAiSummary" class="agent-ai-summary-panel">
        <small>{{ aiSummaryTitle }}</small>
        <h3>{{ aiSummary.summary }}</h3>
        <p v-if="aiSummary.userGoal">{{ aiSummary.userGoal }}</p>
        <div class="agent-ai-summary-grid">
          <article v-if="aiSummaryList(aiSummary.coreModules).length">
            <strong>核心模块</strong>
            <span v-for="item in aiSummaryList(aiSummary.coreModules)" :key="`module-${item}`">{{ item }}</span>
          </article>
          <article v-if="aiSummaryList(aiSummary.recommendedFlow).length">
            <strong>推荐流程</strong>
            <span v-for="(item, index) in aiSummaryList(aiSummary.recommendedFlow)" :key="`flow-${item}`">{{ index + 1 }}. {{ item }}</span>
          </article>
          <article v-if="aiSummaryList(aiSummary.questions).length">
            <strong>待确认</strong>
            <span v-for="item in aiSummaryList(aiSummary.questions)" :key="`question-${item}`">{{ item }}</span>
          </article>
        </div>
      </section>

      <section v-if="visibleAgentInteraction" class="agent-interaction-panel">
        <strong>{{ agentInteractionGoal() }}</strong>
        <p>{{ agentInteractionConfirmationRule() }}</p>
        <div v-if="visibleSuggestedQuestions.length" class="agent-suggested-questions">
          <BaseButton
            v-for="question in visibleSuggestedQuestions"
            :key="question"
            type="button"
            :disabled="sending"
            @click="$emit('quick-reply', question)"
          >
            {{ question }}
          </BaseButton>
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
          <div class="agent-message-frame">
            <details v-if="messageTraceItems(message).length && !isMessageBusy(message)" class="agent-trace-disclosure">
              <summary class="agent-trace-summary">
                <span class="agent-trace-typewriter">{{ visibleTraceSummary(message) }}</span>
                <ChevronDown class="ui-icon" aria-hidden="true" :stroke-width="2" />
              </summary>
              <ol class="agent-trace-timeline" aria-label="Agent 执行进度">
                <li
                  v-for="item in messageTraceItems(message)"
                  :key="item.key"
                  class="agent-trace-item"
                  :class="traceItemClass(item)"
                >
                  <span class="agent-trace-dot" aria-hidden="true"></span>
                  <div>
                    <strong>{{ item.label }}</strong>
                    <small>{{ traceItemText(item) }}</small>
                  </div>
                </li>
              </ol>
            </details>
            <div
              v-if="messageContextReference(message)"
              class="agent-context-reference agent-message-context-reference"
              :aria-label="messageContextReference(message).ariaLabel"
            >
              <span class="agent-context-reference-line" aria-hidden="true"></span>
              <div class="agent-context-reference-body">
                <small>{{ messageContextReference(message).kindLabel }}</small>
                <strong>{{ messageContextReference(message).title }}</strong>
                <p v-if="messageContextReference(message).summary">{{ messageContextReference(message).summary }}</p>
              </div>
            </div>
            <div class="agent-message-body">
              <textarea
                v-if="isEditingMessage(message)"
                class="agent-message-edit-textarea"
                :value="input"
                rows="3"
                @input="$emit('update-input', $event.target.value)"
                @keydown.meta.enter.prevent="$emit('send')"
                @keydown.ctrl.enter.prevent="$emit('send')"
              ></textarea>
              <div v-else-if="shouldShowThinkingLoader(message)" class="agent-thinking-loader" aria-label="正在生成回复" role="status">
                <details v-if="messageTraceItems(message).length" class="agent-pending-trace-disclosure">
                  <summary class="agent-trace-summary agent-pending-trace-summary">
                    <span class="agent-trace-typewriter agent-trace-typewriter-running">{{ visibleTraceSummary(message) }}</span>
                    <ChevronDown class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  </summary>
                  <ol class="agent-trace-timeline" aria-label="Agent 执行进度">
                    <li
                      v-for="item in messageTraceItems(message)"
                      :key="`busy-${item.key}`"
                      class="agent-trace-item"
                      :class="traceItemClass(item)"
                    >
                      <span class="agent-trace-dot" aria-hidden="true"></span>
                      <div>
                        <strong>{{ item.label }}</strong>
                        <small>{{ traceItemText(item) }}</small>
                      </div>
                    </li>
                  </ol>
                </details>
              </div>
              <div v-if="messageAttachments(message).length" class="agent-message-attachments" aria-label="用户上传附件">
                <article
                  v-for="(attachment, attachmentIndex) in messageAttachments(message)"
                  :key="attachmentKey(attachment, attachmentIndex)"
                  class="agent-message-attachment"
                  :class="attachmentKindClass(attachment)"
                >
                  <img v-if="attachmentPreview(attachment)" :src="attachmentPreview(attachment)" :alt="attachmentName(attachment, attachmentIndex)" />
                  <span v-else class="agent-message-attachment-kind">{{ attachmentKindLabel(attachment) }}</span>
                  <div class="agent-message-attachment-meta">
                    <strong>{{ attachmentName(attachment, attachmentIndex) }}</strong>
                    <small>{{ attachmentTypeLabel(attachment) }}</small>
                  </div>
                </article>
              </div>
              <pre v-if="messageRole(message) === 'user'" class="agent-message-text">{{ messageContent(message) }}</pre>
              <AgentLayoutOptionsCard
                v-if="visibleMessageLayoutOptions(message).length"
                :options="visibleMessageLayoutOptions(message)"
                :comparison-rows="visibleMessageLayoutComparisonRows(message)"
              />
              <div v-if="isLegacyLayoutOptionsMessage(message)" class="agent-layout-legacy-notice">
                <span>这条布局方案来自旧规则，可能没有新版的调性对比和质量校验。</span>
                <button type="button" @click="$emit('quick-reply', '按新规则重生成', message)">按新规则重生成</button>
              </div>
              <template v-if="!messageVisualArtifact(message) && !visibleMessageLayoutOptions(message).length && messageContentSegments(message).length">
                <template
                  v-for="(segment, segmentIndex) in messageContentSegments(message)"
                  :key="`${segment.type}-${segmentIndex}`"
                >
                  <AgentPlainMarkdown v-if="segment.type === 'markdown'" :blocks="segment.blocks" />
                  <AgentTableCard v-else-if="segment.type === 'table'" :table="segment.table" />
                  <AgentCodeCard v-else-if="segment.type === 'code'" :language="segment.language" :code="segment.text" />
                  <AgentPageLayoutCard v-else-if="segment.type === 'page-layout-artifact'" :title="segment.title || '页面骨架'" :blocks="segment.blocks" />
                  <AgentMarkdownCard v-else-if="segment.type === 'frame'" :title="segment.title || '文本'" :blocks="segment.blocks" />
                  <AgentMarkdownFileCard v-else-if="segment.type === 'advanced-ux-file'" :file-name="segment.fileName" :markdown="segment.markdown" :summary="segment.summary" />
                  <AgentDrawioFileCard v-else-if="segment.type === 'advanced-ux-drawio-file'" :file-name="segment.fileName" :content="segment.content" :summary="segment.summary" />
                  <AgentLowFiWireframeCard v-else-if="segment.type === 'advanced-ux-lowfi-image'" :artifact="segment" />
                </template>
              </template>
              <AgentPlainMarkdown v-else-if="!messageVisualArtifact(message) && messageRole(message) !== 'user' && messageContent(message).trim()" :blocks="agentMarkdownRenderableBlocks(messageContent(message))" />
              <AgentVisualArtifactCard
                v-if="messageVisualArtifact(message)"
                :artifact="messageVisualArtifact(message)"
              />
              <div v-if="isEditingMessage(message)" class="agent-message-edit-actions">
                <button class="agent-message-edit-cancel" type="button" @click="$emit('cancel-edit')">取消</button>
                <button v-if="isEditingMessage(message)" class="agent-message-edit-confirm" type="button" @click="$emit('send')">确认发送</button>
              </div>
            </div>
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
            <details v-if="messageDataLookups(message).length" class="agent-data-lookups">
              <summary class="agent-data-lookups-summary">
                <span>数据查询</span>
                <small>{{ messageDataLookupStatusLabel(message) }}</small>
              </summary>
              <div class="agent-data-lookup-list">
                <article
                  v-for="item in messageDataLookups(message)"
                  :key="messageDataLookupKey(item)"
                  class="agent-data-lookup-row"
                  :class="`is-${item.status}`"
                >
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.statusLabel }}</span>
                  <small>{{ item.countLabel }}</small>
                  <p>{{ item.summary }}</p>
                </article>
              </div>
            </details>
            <details v-if="messageAnswerEvaluation(message)" class="agent-answer-evaluation">
              <summary class="agent-answer-evaluation-summary">
                <span>回答评估</span>
                <small>{{ messageAnswerEvaluationLabel(message) }}</small>
              </summary>
              <div class="agent-answer-evaluation-grid">
                <span>评分 {{ messageAnswerEvaluation(message).score }}</span>
                <span>{{ messageAnswerEvaluationStatusLabel(messageAnswerEvaluation(message).status) }}</span>
              </div>
              <article
                v-for="item in messageAnswerEvaluationChecks(message)"
                :key="item.key"
                class="agent-answer-evaluation-check"
                :class="`is-${item.status}`"
              >
                <strong>{{ item.label }}</strong>
                <span>{{ messageAnswerEvaluationStatusLabel(item.status) }}</span>
                <p>{{ item.summary }}</p>
              </article>
              <div v-if="messageAnswerEvaluationWarnings(message).length" class="agent-answer-evaluation-warnings">
                <strong>需复核</strong>
                <span v-for="item in messageAnswerEvaluationWarnings(message)" :key="item">{{ item }}</span>
              </div>
              <div v-if="messageAnswerEvaluationActions(message).length" class="agent-answer-evaluation-actions">
                <strong>建议动作</strong>
                <span v-for="action in messageAnswerEvaluationActions(message)" :key="action.key">{{ action.label }}</span>
              </div>
            </details>
            <details v-if="messageKnowledgeItems(message).length && !messageEvidencePack(message)" class="agent-knowledge-evidence">
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
            <details v-if="messageEvidencePack(message)" class="agent-evidence-pack">
              <summary class="agent-evidence-pack-summary">
                <span>证据包</span>
                <small>{{ messageEvidencePackConfidence(message) }}</small>
              </summary>
              <div class="agent-evidence-pack-grid">
                <span>来源 {{ messageEvidenceSources(message).length }}</span>
                <span>事实 {{ messageEvidenceFacts(message).length }}</span>
                <span v-if="messageEvidenceAssumptions(message).length">假设 {{ messageEvidenceAssumptions(message).length }}</span>
                <span v-if="messageEvidenceUncertainties(message).length">待确认 {{ messageEvidenceUncertainties(message).length }}</span>
              </div>
              <article
                v-for="item in messageEvidenceSources(message)"
                :key="messageEvidenceSourceKey(item)"
                class="agent-evidence-source"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.typeLabel }}</span>
                <p>{{ item.snippet }}</p>
              </article>
              <div v-if="messageEvidenceFacts(message).length" class="agent-evidence-lines">
                <strong>事实</strong>
                <span v-for="item in messageEvidenceFacts(message)" :key="item">{{ item }}</span>
              </div>
              <div v-if="messageEvidenceAssumptions(message).length || messageEvidenceUncertainties(message).length" class="agent-evidence-lines muted">
                <strong>边界</strong>
                <span v-for="item in [...messageEvidenceAssumptions(message), ...messageEvidenceUncertainties(message)]" :key="item">{{ item }}</span>
              </div>
            </details>
            <details v-if="(messageProposalEvidence(message).rationale.length || messageProposalEvidence(message).contextSources.length) && !messageEvidencePack(message)" class="agent-proposal-evidence">
              <summary class="agent-proposal-evidence-summary">
                <span>提案依据</span>
                <ChevronDown class="ui-icon" aria-hidden="true" :stroke-width="2" />
              </summary>
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
            <p v-if="messageErrorText(message)" class="agent-message-error">
              {{ messageErrorText(message) }}
            </p>
            <p v-if="messageKnowledgeRetrievalError(message)" class="agent-message-error">
              {{ messageKnowledgeRetrievalError(message) }}
            </p>
            <div v-if="messageRecoveryActions(message).length" class="agent-recovery-actions">
              <BaseButton
                v-for="action in messageRecoveryActions(message)"
                :key="action"
                variant="text"
                type="button"
                :disabled="sending"
                @click="$emit('recovery-action', message, action)"
              >
                {{ action }}
              </BaseButton>
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
          </div>
          <div v-if="hasMessageActions(message)" class="agent-message-actions">
            <button
              v-if="canCopyMessage(message)"
              class="agent-message-icon-action"
              type="button"
              :title="copyTooltipLabel(message)"
              :aria-label="copyTooltipLabel(message)"
              :aria-describedby="messageCopyFeedbackId(message)"
              @click="copyMessage(message)"
            >
              <Copy class="ui-icon" aria-hidden="true" :stroke-width="2" />
            </button>
            <button
              v-if="canRetryMessage(message)"
              class="agent-message-icon-action"
              type="button"
              :title="messageGenerateActionLabel(message)"
              :aria-label="messageGenerateActionLabel(message)"
              @click="$emit('retry-message', message)"
            >
              <RotateCcw class="ui-icon" aria-hidden="true" :stroke-width="2" />
            </button>
            <button
              v-if="canEditMessage(message)"
              class="agent-message-icon-action"
              type="button"
              title="编辑"
              aria-label="编辑"
              @click="$emit('edit-message', message)"
            >
              <Pencil class="ui-icon" aria-hidden="true" :stroke-width="2" />
            </button>
            <BaseButton v-if="canConfirmMessage(message)" variant="primary" type="button" :disabled="sending" @click="$emit('confirm-message', message)">
              确认入画布
            </BaseButton>
          </div>
          <div v-if="visibleMessageRecommendations(message).length" class="agent-message-recommendations">
            <BaseButton
              v-for="recommendation in visibleMessageRecommendations(message)"
              :key="recommendation"
              class="agent-message-recommendation-chip"
              type="button"
              :disabled="sending"
              @click="$emit('quick-reply', recommendation, message)"
            >
              <span>{{ recommendation }}</span>
              <ArrowRight class="ui-icon" aria-hidden="true" :stroke-width="2" />
            </BaseButton>
          </div>
        </article>
        </section>
        <BaseIconButton
          class="agent-scroll-bottom"
          :class="{ visible: showScrollBottom }"
          label="回到底部"
          type="button"
          aria-label="回到底部"
          @click="scrollAgentChatToBottom('auto')"
        >
          <ArrowDown class="ui-icon" aria-hidden="true" :stroke-width="2" />
        </BaseIconButton>
      </div>
    </div>

    <footer class="agent-composer-shell">
      <input
        ref="fileInput"
        class="hidden-file-input"
        type="file"
          multiple
          :accept="agentUploadAccept"
          :disabled="sending"
          @change="$emit('import-files', $event)"
        />
      <div class="agent-composer-box">
        <div
          v-if="composerReferenceView"
          class="agent-composer-reference-pill"
          :aria-label="composerReferenceView.ariaLabel"
        >
          <button
            class="agent-composer-reference-remove"
            type="button"
            title="移除引用"
            aria-label="移除引用"
            :disabled="sending"
            @click="$emit('clear-composer-reference')"
          >
            <X class="ui-icon" aria-hidden="true" :stroke-width="2" />
          </button>
          <span>{{ composerReferenceView.kindLabel }}：</span>
          <strong>{{ composerReferenceView.title }}</strong>
          <small v-if="composerReferenceView.summary">{{ composerReferenceView.summary }}</small>
        </div>
        <textarea
          ref="composerRef"
          class="agent-composer-prompt"
          :value="input"
          :placeholder="composerPlaceholder"
          :disabled="sending"
          @input="$emit('update-input', $event.target.value)"
          @keydown="handleComposerKeydown"
        ></textarea>
        <div class="agent-composer-bottom-bar">
          <div class="agent-composer-tools">
            <div class="agent-upload-trigger">
              <BaseIconButton
                class="agent-upload-button"
                label="上传素材"
                type="button"
                title="上传素材"
                :disabled="sending"
                @click="triggerUpload('all')"
              >
                <Plus class="ui-icon" aria-hidden="true" :stroke-width="2" />
              </BaseIconButton>
              <div class="workflow-upload-popover agent-upload-popover" role="menu" aria-label="上传素材类型">
                <button type="button" role="menuitem" :disabled="sending" @click="triggerUpload('all')">
                  <Upload class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  <span>上传文件</span>
                </button>
                <button type="button" role="menuitem" :disabled="sending" @click="triggerUpload('image')">
                  <Image class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  <span>上传图片</span>
                </button>
                <button type="button" role="menuitem" :disabled="sending" @click="triggerUpload('word')">
                  <FileText class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  <span>上传 Word</span>
                </button>
                <button type="button" role="menuitem" :disabled="sending" @click="triggerUpload('pdf')">
                  <FileText class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  <span>上传 PDF</span>
                </button>
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
                <BaseIconButton class="agent-reference-remove" label="删除参考文件" type="button" aria-label="删除参考文件" title="删除后重新上传" :disabled="sending" @click="$emit('remove-reference', referenceId(file, index))">
                  <X class="ui-icon" aria-hidden="true" :stroke-width="2" />
                </BaseIconButton>
              </article>
            </div>
            <select class="agent-model-select" :value="model" aria-label="选择模型" :disabled="sending" @change="$emit('update-model', $event.target.value)">
              <option v-for="(item, index) in visibleModelOptions" :key="modelOptionKey(item, index)" :value="modelOptionValue(item, index)">{{ modelOptionLabel(item, index) }}</option>
            </select>
            <BaseIconButton
              class="agent-web-search-toggle"
              :class="{ 'is-enabled': webSearchEnabled }"
              :label="webSearchEnabled ? '联网检索已开启' : '联网检索已关闭'"
              type="button"
              :title="webSearchEnabled ? '联网检索已开启，点击关闭' : '联网检索已关闭，点击开启'"
              :aria-label="webSearchEnabled ? '联网检索已开启，点击关闭' : '联网检索已关闭，点击开启'"
              :aria-pressed="webSearchEnabled ? 'true' : 'false'"
              :disabled="sending"
              @click="$emit('toggle-web-search')"
            >
              <Globe2 class="ui-icon" aria-hidden="true" :stroke-width="2" />
            </BaseIconButton>
          </div>
          <div class="agent-composer-primary-actions">
            <BaseIconButton
              class="agent-send-button"
              :label="sending ? '停止生成' : '发送'"
              type="button"
              :aria-label="sending ? '停止生成' : '发送'"
              :disabled="!sending && !canSubmitComposer()"
              @click="handlePrimaryAction"
            >
              <span v-if="sending" class="agent-stop-icon" aria-hidden="true"></span>
              <ArrowUp v-else class="ui-icon" aria-hidden="true" :stroke-width="2.4" />
            </BaseIconButton>
          </div>
        </div>
      </div>
    </footer>
  </aside>
</template>

<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue'
import { ArrowDown, ArrowUp, ChevronDown, Copy, Download, Eye, FileDown, FileText, Globe2, History, Image, Maximize2, PanelRightClose, Pencil, Plus, RotateCcw, ScanSearch, Upload, X } from 'lucide-vue-next'
import { BaseButton, BaseIconButton } from '../../../components/base'
import { isWorkflowChatOnlyStageScope } from '../../../services/workflowWorkbench'

const props = defineProps({
  session: { type: Object, required: true },
  canvasTabs: { type: Array, default: () => [] },
  activeNode: { type: Object, default: null },
  activeNodeId: { type: String, default: '' },
  model: { type: String, default: 'gpt-5.5' },
  webSearchEnabled: { type: Boolean, default: true },
  quickReplies: { type: Array, default: () => [] },
  historyOpen: { type: Boolean, default: false },
  references: { type: Array, default: () => [] },
  composerReference: { type: Object, default: null },
  input: { type: String, default: '' },
  editingMessage: { type: Object, default: null },
  retryMessage: { type: Object, default: null },
  width: { type: Number, default: 680 },
  inlineWidth: { type: String, default: '100vw' },
  inlineTop: { type: String, default: '112px' },
  inlineResizing: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  displayMode: { type: String, default: '' },
  canInline: { type: Boolean, default: false },
  canLargeModes: { type: Boolean, default: false }
})

const emit = defineEmits([
  'close',
  'update-node',
  'update-model',
  'toggle-web-search',
  'quick-reply',
  'toggle-history',
  'close-history',
  'select-history',
  'import-files',
  'remove-reference',
  'clear-composer-reference',
  'copy-message',
  'retry-message',
  'recovery-action',
  'edit-message',
  'cancel-edit',
  'cancel-retry',
  'confirm-message',
  'update-input',
  'start-resize',
  'start-inline-resize',
  'change-display-mode',
  'stop-generating',
  'send'
])

const resolvedDisplayMode = computed(() => {
  const mode = String(props.displayMode || '').trim()
  if (['inline', 'sidebar', 'fullscreen'].includes(mode)) return mode
  return props.embedded ? 'inline' : 'sidebar'
})

const agentDrawerClasses = computed(() => ({
  'agent-drawer-embedded': resolvedDisplayMode.value === 'inline',
  'agent-drawer-inline': resolvedDisplayMode.value === 'inline',
  'is-resizing': resolvedDisplayMode.value === 'inline' && props.inlineResizing,
  'agent-drawer-sidebar': resolvedDisplayMode.value === 'sidebar',
  'agent-drawer-fullscreen': resolvedDisplayMode.value === 'fullscreen'
}))

// AGENT_SINGLE_SHELL_CONTRACT:
// 工作流里只能有同一套 Agent，也就是这个 WorkflowAgentDrawer。
// 侧边栏、大面板、可拉伸、全屏都只是 displayMode 的不同状态，不能再拆成大 Agent / 小 Agent / 阶段专用 Agent。
// 小/中/大 Agent 只能改变尺寸、位置和层级，不能分叉 session、发送、历史、推荐按钮、上传、重试、应用画布或下一步逻辑。
// 每个 skill、每个阶段都把消息、trace、卡片内容交给同一个 Agent shell 渲染，避免后续维护出现两套路由和两套展示逻辑。

// AGENT_CONTENT_CARD_CONTRACT:
// markdown、表格、结构树、框架层、代码/JSON/HTML/Vue 都必须走同一套 Agent 内容卡片。
// 卡片标题必须中文化或业务化，不能把 plaintext/code/markdown 这类内部标签直接展示给用户。
// 忙碌态统一使用图 5 的蓝色 trace 方框样式；不要再加三点 loading 或另一套加载 UI。
// 以后改这里前，先读 AgentCardShell、displayCardTitle、messageStructuredContent、markdownAgentMessageContent 的链路，再确认是否真的需要改展示契约。
// AGENT_CONTENT_RENDER_SAFETY_CONTRACT:
// 模型原文永远是最终兜底，结构化渲染只是增强；只有通过表格/结构树/页面布局成果等形状校验的内容才能升级为特殊卡片。
// 如果解析后 segments 为空但 rawContent 非空，必须回退到“文本”卡，不能输出空白，也不能只因为文字里出现“表格/结构”就强行改成表格或结构树。
// 下次改这里时，先确认后端 rawContent/displayBlocks 契约和前端 hasRenderableAgentSegments 校验逻辑，再决定是否修改展示。
// AGENT_SPECIAL_CONTENT_RENDERING_CONTRACT:
// 普通 Markdown 正文保持不包框；只有代码、表格、结构树、页面骨架/流程框图这类明确特殊内容才包框。
// structureTree 保留结构树卡片；frameworkLayer/pageSkeleton/pageFrame 等旧字段必须兼容转换为 page-layout-artifact，不能再显示成单独“框架层”卡片。
// 后续如果要改这个分类，先和产品确认“哪些内容需要包框、哪些内容必须保持正文”，再改 structuredAgentFrameKind、structuredContentSegments 和回退链路。
// AGENT_PAGE_LAYOUT_ARTIFACT_CONTRACT:
// 后端在页面框架/线框/布局方案场景会要求模型输出 :::page-layout-artifact title="页面骨架" ... :::。
// 前端只识别该展示外壳并渲染为浅色边框卡片，不根据业务类型硬编码布局，也不替模型补业务内容。
function safeAgentFileName(value = '', fallback = 'agent-content') {
  return String(value || fallback).replace(/[\\/:*?"<>|]+/g, '-').trim() || fallback
}

function markdownFileNameToPdfFileName(fileName = '') {
  const safeName = safeAgentFileName(fileName || '高级 UX 需求分析.md')
  return safeName.replace(/\.(md|markdown)$/i, '') + '.pdf'
}

function downloadBlob(blob, fileName = '') {
  if (!blob || typeof document === 'undefined') return
  const link = document.createElement('a')
  link.download = safeAgentFileName(fileName || '高级 UX 需求分析.pdf')
  link.href = URL.createObjectURL(blob)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 30000)
}

async function exportMarkdownAsPdf(markdown = '', fileName = '', title = '') {
  if (!String(markdown || '').trim() || typeof fetch !== 'function') return
  const pdfFileName = markdownFileNameToPdfFileName(fileName || title || '高级 UX 需求分析.md')
  const response = await fetch('/api/workspace/markdown-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markdown,
      fileName: pdfFileName,
      title: title || fileName || 'Markdown 文档'
    })
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'PDF 生成失败')
  }
  downloadBlob(await response.blob(), pdfFileName)
}

const AgentCardShell = {
  name: 'AgentCardShell',
  components: { Copy, Download, FileDown, ScanSearch, X },
  props: {
    title: { type: String, default: '' },
    copyText: { type: String, default: '' },
    downloadFileName: { type: String, default: '' },
    pdfFileName: { type: String, default: '' },
    expandable: { type: Boolean, default: false }
  },
  setup(cardProps, { slots }) {
    const attrs = useAttrs()
    const expanded = ref(false)
    const displayTitle = computed(() => displayCardTitle(cardProps.title))
    const copyCard = async () => {
      const text = String(cardProps.copyText || '')
      if (!text) return
      try {
        await navigator?.clipboard?.writeText?.(text)
      } catch {}
      showCopyFeedback({ id: `content-card-${displayTitle.value}` })
    }
    const downloadCard = (event) => {
      event?.stopPropagation?.()
      const text = String(cardProps.copyText || '')
      if (!text || typeof document === 'undefined') return
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
      const link = document.createElement('a')
      const fallbackName = `${displayTitle.value || 'agent-content'}.md`
      link.download = String(cardProps.downloadFileName || fallbackName).replace(/[\\/:*?"<>|]+/g, '-')
      link.href = URL.createObjectURL(blob)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 30000)
    }
    const openExpanded = (event) => {
      event?.stopPropagation?.()
      if (cardProps.expandable) expanded.value = true
    }
    const exportPdf = async (event) => {
      event?.stopPropagation?.()
      const text = String(cardProps.copyText || '')
      if (!text) return
      try {
        await exportMarkdownAsPdf(text, cardProps.pdfFileName || cardProps.downloadFileName || `${displayTitle.value || 'agent-content'}.pdf`, displayTitle.value)
      } catch (error) {
        window?.alert?.(error?.message || 'PDF 下载失败，请稍后重试')
      }
    }
    const closeExpanded = () => {
      expanded.value = false
    }
    const renderBody = () => slots.default?.() || []
    const renderExpandedBody = () => slots.expanded?.() || renderBody()
    const renderActions = () => [
      cardProps.copyText
        ? h('button', {
            type: 'button',
            title: '复制内容',
            'aria-label': '复制内容',
            onClick: (event) => {
              event?.stopPropagation?.()
              copyCard()
            }
          }, [
            h(Copy, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
          ])
        : null,
      cardProps.copyText
        ? h('button', {
            type: 'button',
            title: '下载内容',
            'aria-label': '下载内容',
            onClick: downloadCard
          }, [
            h(Download, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
          ])
        : null,
      cardProps.pdfFileName && cardProps.copyText
        ? h('button', {
            type: 'button',
            title: '下载 PDF',
            'aria-label': '下载 PDF',
            onClick: exportPdf
          }, [
            h(FileDown, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
          ])
        : null,
      cardProps.expandable
        ? h('button', {
            type: 'button',
            title: '放大预览',
            'aria-label': '放大预览',
            onClick: openExpanded
          }, [
            h(ScanSearch, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
          ])
        : null
    ].filter(Boolean)
    return () => [
      h('section', {
        ...attrs,
        class: ['agent-content-card', attrs.class]
      }, [
        h('header', { class: 'agent-content-card-head' }, [
          h('strong', displayTitle.value),
          h('div', { class: 'agent-content-card-actions' }, renderActions())
        ]),
        ...renderBody()
      ]),
      expanded.value
        ? h('div', { class: 'agent-content-card-expanded-backdrop', onClick: closeExpanded }, [
            h('section', {
              class: 'agent-content-card-expanded',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': cardProps.title || displayTitle.value,
              onClick: (event) => event.stopPropagation()
            }, [
              h('header', [
                h('strong', cardProps.title || displayTitle.value),
                h('button', {
                  type: 'button',
                  title: '关闭',
                  'aria-label': '关闭',
                  onClick: closeExpanded
                }, [
                  h(X, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
                ])
              ]),
              h('div', { class: 'agent-content-card-expanded-body' }, renderExpandedBody())
            ])
          ])
        : null
    ]
  }
}

const AgentCodeCard = {
  name: 'AgentCodeCard',
  props: {
    language: { type: String, default: 'code' },
    code: { type: String, default: '' }
  },
  setup(cardProps) {
    const displayLanguage = computed(() => codeLanguageLabel(cardProps.language))
    const expanded = ref(false)
    const sourceCode = computed(() => String(cardProps.code || ''))
    const codeCardClass = computed(() => `agent-code-card agent-code-card-${displayLanguage.value}`)
    const copyCard = async (event) => {
      event?.stopPropagation?.()
      const text = sourceCode.value
      if (!text) return
      try {
        await navigator?.clipboard?.writeText?.(text)
      } catch {}
      showCopyFeedback({ id: `code-card-${displayLanguage.value}` })
    }
    const downloadCard = (event) => {
      event?.stopPropagation?.()
      const text = sourceCode.value
      if (!text || typeof document === 'undefined') return
      const blob = new Blob([text], { type: displayLanguage.value === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' })
      const link = document.createElement('a')
      link.download = `agent-code.${displayLanguage.value === 'code' ? 'txt' : displayLanguage.value}`.replace(/[\\/:*?"<>|]+/g, '-')
      link.href = URL.createObjectURL(blob)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 30000)
    }
    const openExpanded = (event) => {
      event?.stopPropagation?.()
      expanded.value = true
    }
    const closeExpanded = () => {
      expanded.value = false
    }
    const renderSource = (extraClass = '') => h('pre', { class: ['agent-code-card-source', extraClass].filter(Boolean).join(' ') }, [
      h('code', sourceCode.value)
    ])
    const renderHeader = () => h('header', { class: 'agent-code-card-head' }, [
      h('button', { class: 'agent-code-card-collapse', type: 'button', title: '收起代码预览', 'aria-label': '收起代码预览' }, [
        h(ChevronDown, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
      ]),
      h('strong', displayLanguage.value),
      h('div', { class: 'agent-code-card-actions' }, [
        h('button', { type: 'button', title: '预览', 'aria-label': '预览', onClick: openExpanded }, [
          h(Eye, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
        ]),
        h('button', { type: 'button', title: '复制', 'aria-label': '复制', onClick: copyCard }, [
          h(Copy, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
        ]),
        h('button', { type: 'button', title: '下载', 'aria-label': '下载', onClick: downloadCard }, [
          h(Download, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
        ]),
        h('button', { type: 'button', title: '全屏', 'aria-label': '全屏', onClick: openExpanded }, [
          h(Maximize2, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
        ])
      ])
    ])
    return () => [
      h('section', { class: codeCardClass.value }, [
        renderHeader(),
        renderSource()
      ]),
      expanded.value
        ? h('div', { class: 'agent-content-card-expanded-backdrop', onClick: closeExpanded }, [
            h('section', {
              class: 'agent-content-card-expanded agent-code-card-expanded',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': `${displayLanguage.value} 代码预览`,
              onClick: (event) => event.stopPropagation()
            }, [
              h('header', [
                h('strong', `${displayLanguage.value} 代码预览`),
                h('button', { type: 'button', title: '关闭', 'aria-label': '关闭', onClick: closeExpanded }, [
                  h(X, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
                ])
              ]),
              h('div', { class: 'agent-content-card-expanded-body' }, [
                renderSource('is-expanded')
              ])
            ])
          ])
        : null
    ]
  }
}

const AgentTableCard = {
  name: 'AgentTableCard',
  components: { AgentCardShell },
  props: {
    table: { type: Object, required: true }
  },
  setup(cardProps) {
    const tableCopyText = computed(() => {
      const headers = Array.isArray(cardProps.table?.headers) ? cardProps.table.headers : []
      const rows = Array.isArray(cardProps.table?.rows) ? cardProps.table.rows : []
      return [headers, ...rows]
        .filter((row) => Array.isArray(row) && row.length)
        .map((row) => `| ${row.map((cell) => String(cell || '').trim()).join(' | ')} |`)
        .join('\n')
    })
    return () => {
      const headers = Array.isArray(cardProps.table?.headers) ? cardProps.table.headers : []
      const rows = Array.isArray(cardProps.table?.rows) ? cardProps.table.rows : []
      return h(AgentCardShell, {
        class: 'agent-table-card',
        title: '表格',
        copyText: tableCopyText.value,
        downloadFileName: '表格.md',
        expandable: true
      }, {
        default: () => [
          h('div', { class: 'agent-table-card-body' }, [
            h('table', [
              h('thead', [
                h('tr', headers.map((header, index) =>
                  h('th', { key: `header-${index}` }, String(header || ''))
                ))
              ]),
              h('tbody', rows.map((row, rowIndex) =>
                h('tr', { key: `row-${rowIndex}` }, (Array.isArray(row) ? row : []).map((cell, cellIndex) =>
                  h('td', { key: `cell-${rowIndex}-${cellIndex}` }, String(cell || ''))
                ))
              ))
            ])
          ])
        ]
      })
    }
  }
}

function renderAgentMarkdownBlock(block = {}, blockIndex = 0) {
  const key = `${block?.type || 'block'}-${blockIndex}-${block?.text || block?.table?.headers?.join('|') || ''}`
  if (block.type === 'h1') return h('h1', { key }, String(block.text || ''))
  if (block.type === 'h2') return h('h2', { key }, String(block.text || ''))
  if (block.type === 'h3') return h('h3', { key }, String(block.text || ''))
  if (block.type === 'h4') return h('h4', { key }, String(block.text || ''))
  if (block.type === 'h5') return h('h5', { key }, String(block.text || ''))
  if (block.type === 'h6') return h('h6', { key }, String(block.text || ''))
  if (block.type === 'pre') return h('pre', { key, class: 'agent-markdown-pre' }, String(block.text || ''))
  if (block.type === 'table') {
    const headers = Array.isArray(block.table?.headers) ? block.table.headers : []
    const rows = Array.isArray(block.table?.rows) ? block.table.rows : []
    return h('div', { key, class: 'agent-markdown-table-wrap' }, [
      h('table', { class: 'agent-markdown-table' }, [
        headers.length
          ? h('thead', [
              h('tr', headers.map((header, index) =>
                h('th', { key: `header-${index}` }, String(header || ''))
              ))
            ])
          : null,
        h('tbody', rows.map((row, rowIndex) =>
          h('tr', { key: `row-${rowIndex}` }, (Array.isArray(row) ? row : []).map((cell, cellIndex) =>
            h('td', { key: `cell-${rowIndex}-${cellIndex}` }, String(cell || ''))
          ))
        ))
      ])
    ])
  }
  if (block.type === 'ul') {
    const items = Array.isArray(block.items) ? block.items : []
    return h('ul', { key }, items.map((item, itemIndex) =>
      h('li', { key: `${key}-${itemIndex}` }, String(item || ''))
    ))
  }
  return h('p', { key }, String(block.text || ''))
}

function renderAgentPageLayoutBlock(block = {}, blockIndex = 0) {
  const key = `page-layout-${blockIndex}-${block?.text || ''}`
  if (block.type === 'page-layout-section') {
    const title = String(block.title || '').trim()
    const kind = String(block.kind || '').trim()
    const bodyBlocks = Array.isArray(block.blocks) ? block.blocks : []
    return h('section', {
      key,
      class: ['agent-page-layout-section', kind ? `agent-page-layout-section-${kind}` : ''].filter(Boolean).join(' ')
    }, [
      title ? h('header', { class: 'agent-page-layout-section-head' }, [
        h('span', title)
      ]) : null,
      kind === 'wireframe'
        ? h('div', { class: 'agent-page-layout-wireframe-wrap' }, [
            h('pre', { class: 'agent-page-layout-pre' }, String(block.text || ''))
          ])
        : h('div', { class: 'agent-page-layout-section-body' }, bodyBlocks.map(renderAgentMarkdownBlock))
    ])
  }
  if (block.type === 'pre') return h('pre', { key, class: 'agent-page-layout-pre' }, String(block.text || ''))
  return renderAgentMarkdownBlock(block, blockIndex)
}

const AgentPlainMarkdown = {
  name: 'AgentPlainMarkdown',
  props: {
    blocks: { type: Array, default: () => [] }
  },
  setup(cardProps) {
    return () => h('div', { class: 'agent-markdown-message agent-plain-markdown' }, (
      Array.isArray(cardProps.blocks) ? cardProps.blocks : []
    ).map(renderAgentMarkdownBlock))
  }
}

const AgentMarkdownCard = {
  name: 'AgentMarkdownCard',
  components: { AgentCardShell },
  props: {
    title: { type: String, default: 'Markdown' },
    blocks: { type: Array, default: () => [] }
  },
  setup(cardProps) {
    const markdownCopyText = computed(() => markdownBlocksPlainText(cardProps.blocks))
    return () => h(AgentCardShell, {
      class: 'agent-markdown-card',
      title: cardProps.title,
      copyText: markdownCopyText.value
    }, {
      default: () => [
        h('div', { class: 'agent-markdown-message agent-markdown-card-body' }, (
          Array.isArray(cardProps.blocks) ? cardProps.blocks : []
        ).map(renderAgentMarkdownBlock))
      ]
    })
  }
}

const AgentMarkdownFileCard = {
  name: 'AgentMarkdownFileCard',
  components: { AgentCardShell, FileText },
  props: {
    fileName: { type: String, default: '高级 UX 需求分析.md' },
    markdown: { type: String, default: '' },
    summary: { type: String, default: '' }
  },
  setup(cardProps) {
    const source = computed(() => String(cardProps.markdown || ''))
    const detailSource = computed(() => source.value || String(cardProps.summary || ''))
    const previewBlocks = computed(() => agentMarkdownRenderableBlocks(source.value, { preservePlainTextCode: true }))
    const detailBlocks = computed(() => agentMarkdownRenderableBlocks(detailSource.value, { preservePlainTextCode: true }))
    const fileSizeLabel = computed(() => {
      const length = source.value.length
      if (!length) return '暂无正文'
      if (length < 1024) return `${length} 字符`
      return `${(length / 1024).toFixed(1)} KB`
    })
    return () => h(AgentCardShell, {
      class: 'agent-markdown-file-card',
      title: cardProps.fileName || '高级 UX 需求分析.md',
      copyText: source.value,
      downloadFileName: cardProps.fileName || '高级 UX 需求分析.md',
      pdfFileName: markdownFileNameToPdfFileName(cardProps.fileName || '高级 UX 需求分析.md'),
      expandable: Boolean(detailSource.value)
    }, {
      default: () => [
        h('div', { class: 'agent-markdown-file-card-body' }, [
          h('div', { class: 'agent-markdown-file-icon', 'aria-hidden': 'true' }, [
            h(FileText, { class: 'ui-icon', 'stroke-width': 2 })
          ]),
          h('div', { class: 'agent-markdown-file-info' }, [
            h('strong', cardProps.fileName || '高级 UX 需求分析.md'),
            h('span', fileSizeLabel.value),
            h('p', cardProps.summary || (source.value ? '完整 Markdown 已保存在本轮高级 UX 分析产物中。' : 'Markdown 正文暂不可用。'))
          ])
        ]),
        source.value
          ? h('div', { class: 'agent-markdown-message agent-markdown-file-preview' }, previewBlocks.value.map(renderAgentMarkdownBlock))
          : null
      ],
      expanded: () => detailSource.value
        ? h('div', { class: 'agent-markdown-message agent-markdown-file-preview' }, detailBlocks.value.map(renderAgentMarkdownBlock))
        : null
    })
  }
}

const AgentDrawioFileCard = {
  name: 'AgentDrawioFileCard',
  components: { AgentCardShell, FileText },
  props: {
    fileName: { type: String, default: 'diagram.drawio' },
    content: { type: String, default: '' },
    summary: { type: String, default: '' }
  },
  setup(cardProps) {
    const source = computed(() => String(cardProps.content || ''))
    const fileSizeLabel = computed(() => {
      const length = source.value.length
      if (!length) return '暂无 XML'
      if (length < 1024) return `${length} 字符`
      return `${(length / 1024).toFixed(1)} KB`
    })
    return () => h(AgentCardShell, {
      class: 'agent-markdown-file-card agent-drawio-file-card',
      title: cardProps.fileName || 'diagram.drawio',
      copyText: source.value,
      downloadFileName: cardProps.fileName || 'diagram.drawio',
      expandable: Boolean(source.value)
    }, {
      default: () => [
        h('div', { class: 'agent-markdown-file-card-body' }, [
          h('div', { class: 'agent-markdown-file-icon', 'aria-hidden': 'true' }, [
            h(FileText, { class: 'ui-icon', 'stroke-width': 2 })
          ]),
          h('div', { class: 'agent-markdown-file-info' }, [
            h('strong', cardProps.fileName || 'diagram.drawio'),
            h('span', `Draw.io XML · ${fileSizeLabel.value}`),
            h('p', cardProps.summary || (source.value ? '真实 .drawio XML 已保存，可下载后用 diagrams.net 打开。' : 'Draw.io XML 暂不可用。'))
          ])
        ]),
        source.value
          ? h('pre', { class: 'agent-markdown-pre agent-drawio-file-preview' }, source.value)
          : null
      ]
    })
  }
}

const AgentPageLayoutCard = {
  name: 'AgentPageLayoutCard',
  components: { AgentCardShell },
  props: {
    title: { type: String, default: '页面骨架' },
    blocks: { type: Array, default: () => [] }
  },
  setup(cardProps) {
    const copyText = computed(() => markdownBlocksPlainText(cardProps.blocks))
    return () => h(AgentCardShell, {
      class: 'agent-page-layout-card',
      title: cardProps.title || '页面骨架',
      copyText: copyText.value,
      expandable: true
    }, {
      default: () => [
        h('div', { class: 'agent-markdown-message agent-page-layout-card-body' }, (
          Array.isArray(cardProps.blocks) ? cardProps.blocks : []
        ).map(renderAgentPageLayoutBlock))
      ]
    })
  }
}

const AgentVisualArtifactCard = {
  name: 'AgentVisualArtifactCard',
  props: {
    artifact: { type: Object, required: true }
  },
  setup(cardProps) {
    const imageUrl = computed(() => String(cardProps.artifact?.imageUrl || cardProps.artifact?.imageDataUrl || '').trim())
    const title = computed(() => String(cardProps.artifact?.title || '生成图片').trim())
    const isGenerating = computed(() => cardProps.artifact?.status === 'generating')
    const naturalAspectRatioLabel = ref('')
    const metadataAspectRatioLabel = computed(() => {
      const candidates = [
        cardProps.artifact?.aspectRatio,
        cardProps.artifact?.targetAspectRatio,
        cardProps.artifact?.screenRatio
      ]
      for (const candidate of candidates) {
        const value = String(candidate || '').trim()
        if (!value) continue
        const normalized = value.replace(/\s+/g, '').replace(/[：:xX]/g, ':')
        if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized)) return normalized
      }
      return ''
    })
    const aspectRatioLabel = computed(() => naturalAspectRatioLabel.value || metadataAspectRatioLabel.value)
    function normalizeNaturalRatio(width = 0, height = 0) {
      let a = Math.abs(Math.round(Number(width) || 0))
      let b = Math.abs(Math.round(Number(height) || 0))
      if (!a || !b) return ''
      const originalWidth = a
      const originalHeight = b
      while (b) {
        const next = a % b
        a = b
        b = next
      }
      return `${originalWidth / a}:${originalHeight / a}`
    }
    function recordImageNaturalRatio(event) {
      const image = event?.target
      const naturalWidth = image?.naturalWidth || 0
      const naturalHeight = image?.naturalHeight || 0
      const ratio = normalizeNaturalRatio(naturalWidth, naturalHeight)
      if (ratio) naturalAspectRatioLabel.value = ratio
    }
    const downloadImage = async () => {
      const src = imageUrl.value
      if (!src || typeof document === 'undefined') return
      const link = document.createElement('a')
      link.download = String(cardProps.artifact?.fileName || `${title.value}.png`).replace(/[\\/:*?"<>|]+/g, '-')
      try {
        if (/^data:|^blob:/.test(src)) {
          link.href = src
        } else {
          const response = await fetch(src)
          const blob = await response.blob()
          link.href = URL.createObjectURL(blob)
          setTimeout(() => URL.revokeObjectURL(link.href), 30000)
        }
      } catch {
        link.href = src
      }
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    const openImage = () => {
      if (!imageUrl.value || typeof window === 'undefined') return
      window.open(imageUrl.value, '_blank', 'noopener,noreferrer')
    }
    return () => (imageUrl.value || isGenerating.value)
      ? h('section', { class: 'agent-visual-artifact-card' }, [
          h('header', [
            h('strong', title.value),
            h('div', { class: 'agent-visual-artifact-meta' }, [
              aspectRatioLabel.value ? h('span', { class: 'agent-visual-ratio-badge' }, aspectRatioLabel.value) : null,
              cardProps.artifact?.provider ? h('small', String(cardProps.artifact.provider)) : null
            ])
          ]),
          h('div', { class: 'agent-visual-artifact-image' }, [
            imageUrl.value
              ? h('img', { src: imageUrl.value, alt: cardProps.artifact?.altText || `${title.value} 图片`, onLoad: recordImageNaturalRatio })
              : h('div', { class: 'agent-visual-artifact-placeholder' }, [
                  h('span', { class: 'loading-spinner-large' }),
                  h('strong', '生图中')
                ]),
            imageUrl.value
              ? h('div', { class: 'agent-visual-artifact-tools', 'aria-label': '图片操作' }, [
                  h('button', {
                    type: 'button',
                    title: '下载至本地',
                    'aria-label': '下载至本地',
                    onClick: downloadImage
                  }, [
                    h(Download, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
                  ]),
                  h('button', {
                    type: 'button',
                    title: '放大预览',
                    'aria-label': '放大预览',
                    onClick: openImage
                  }, [
                    h(Maximize2, { class: 'ui-icon', 'aria-hidden': 'true', 'stroke-width': 2 })
                  ])
                ])
              : null
          ])
        ])
      : null
  }
}

const AgentLowFiWireframeCard = {
  name: 'AgentLowFiWireframeCard',
  components: { AgentVisualArtifactCard },
  props: {
    artifact: { type: Object, required: true }
  },
  setup(cardProps) {
    const normalizedArtifact = computed(() => ({
      ...cardProps.artifact,
      title: [
        cardProps.artifact?.pageId,
        cardProps.artifact?.pageName || cardProps.artifact?.fileName || '低保真线框图'
      ].filter(Boolean).join(' '),
      altText: `${cardProps.artifact?.pageName || '页面'}低保真线框图`,
      status: cardProps.artifact?.status || 'generated',
      aspectRatio: cardProps.artifact?.aspectRatio || cardProps.artifact?.targetAspectRatio || ''
    }))
    return () => h(AgentVisualArtifactCard, { artifact: normalizedArtifact.value })
  }
}

const AgentLayoutOptionsCard = {
  name: 'AgentLayoutOptionsCard',
  props: {
    options: { type: Array, default: () => [] },
    comparisonRows: { type: Array, default: () => [] }
  },
  setup(cardProps) {
    const optionLabel = (index) => layoutOptionDisplayLabel(cardProps.options[index] || {}, index)
    return () => h('section', { class: 'agent-layout-options-card' }, [
      h('header', [
        h('strong', '3 套候选框架'),
        h('small', '保留当前页面同一功能大纲，对比不同产品调性、版式结构和布局组织；选择 1/2/3 后写入当前页面画布。')
      ]),
      cardProps.comparisonRows.length
        ? h('div', { class: 'agent-layout-comparison-table' }, [
            h('strong', '布局方案对比'),
            h('table', [
              h('thead', [
                h('tr', [
                  h('th', '对比项'),
                  h('th', optionLabel(0)),
                  h('th', optionLabel(1)),
                  h('th', optionLabel(2))
                ])
              ]),
              h('tbody', cardProps.comparisonRows.map((row, index) =>
                h('tr', { key: `${row.label || 'row'}-${index}` }, [
                  h('th', row.label || `对比项 ${index + 1}`),
                  h('td', row.option1 || row.values?.[0] || ''),
                  h('td', row.option2 || row.values?.[1] || ''),
                  h('td', row.option3 || row.values?.[2] || '')
                ])
              ))
            ])
          ])
        : null,
      h('div', { class: 'agent-layout-options-list' }, cardProps.options.slice(0, 3).map((option, index) =>
        h('article', { key: option.id || `layout-option-${index + 1}`, class: 'agent-layout-option-plain' }, [
          h('header', { class: 'agent-layout-option-head' }, [
            h('span', layoutOptionDisplayLabel(option, index)),
            h('strong', option.title || option.name || layoutOptionDisplayLabel(option, index)),
            option.layoutStyle || option.visualTone || option.tone
              ? h('small', option.layoutStyle || option.visualTone || option.tone)
              : null
          ]),
          h('div', { class: 'agent-layout-option-prose' }, [
            layoutOptionExplanationBlocks(option).length
              ? h(AgentPlainMarkdown, { blocks: layoutOptionExplanationBlocks(option) })
              : null,
            option.layoutStyle || option.visualTone || option.tone
              ? h('p', { class: 'agent-layout-option-style' }, `设计调性：${option.layoutStyle || option.visualTone || option.tone}`)
              : null,
            option.layoutStrategy || option.arrangement
              ? h('p', { class: 'agent-layout-option-strategy' }, `布局组织：${option.layoutStrategy || option.arrangement}`)
              : null,
            h('dl', [
              h('div', [
                h('dt', '适合'),
                h('dd', option.bestFor || option.scenario || '由当前页面上下文决定')
              ]),
              h('div', [
                h('dt', '取舍'),
                h('dd', option.risk || option.tradeoff || '需要结合当前页面重点继续确认')
              ])
            ])
          ]),
          h(AgentPageLayoutCard, {
            class: 'agent-layout-option-framework-card',
            title: '页面框架',
            blocks: layoutOptionFrameworkBlocks(option)
          })
        ])
      ))
    ])
  }
}

const fileInput = ref(null)
const agentUploadAccept = ref('image/*,.pdf,.doc,.docx,.md,.txt,.xlsx,.csv,.json')
const agentUploadAcceptMap = {
  all: 'image/*,.pdf,.doc,.docx,.md,.txt,.xlsx,.csv,.json',
  image: 'image/*',
  word: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: '.pdf,application/pdf'
}
const composerRef = ref(null)
const chatListRef = ref(null)
const drawerRef = ref(null)
const showScrollBottom = ref(false)
const copiedMessageId = ref('')
const copyToastVisible = ref(false)
const traceTypewriterText = ref('')
let copiedMessageTimer = null
let traceTypewriterTimer = null
let traceTypewriterPhraseIndex = 0
let traceTypewriterCharIndex = 0
let traceTypewriterDeleting = false

const agentInteraction = computed(() => props.activeNode?.agentInteraction || null)
const aiSummary = computed(() => props.session?.aiSummary && typeof props.session.aiSummary === 'object' && !Array.isArray(props.session.aiSummary)
  ? props.session.aiSummary
  : null
)
const visibleAiSummary = computed(() => Boolean(aiSummary.value?.summary || aiSummaryList(aiSummary.value?.items).length))
const aiSummaryTitle = computed(() => String(aiSummary.value?.title || 'AI 分析结果'))
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

function aiSummaryList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 6)
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
  false
)
const visibleQuickReplies = computed(() => {
  const quickReplies = Array.isArray(props.quickReplies) ? props.quickReplies : []
  return Array.from(new Set(
    quickReplies
      .map(normalizeVisibleQuickReply)
      .filter(Boolean)
      .filter((reply) => reply && !isConfirmReply(reply))
  ))
})

const latestRecommendationMessageKey = computed(() => {
  for (let index = visibleMessages.value.length - 1; index >= 0; index -= 1) {
    const message = visibleMessages.value[index]
    if (messageRole(message) !== 'assistant') continue
    if (isMessageBusy(message) || isMessageFailed(message)) continue
    if (shouldSuppressMessageRecommendations(message)) continue
    return messageKey(message, index)
  }
  return ''
})

function normalizeVisibleQuickReply(reply = '') {
  const normalized = String(reply || '').trim()
  if (/生成低保真|转低保真画布|低保真画布/.test(normalized)) return '应用到画布'
  return normalized
}
const visibleReferences = computed(() =>
  Array.isArray(props.references) ? props.references.filter(isPlainRecord) : []
)
const composerReferenceView = computed(() => normalizeAgentContextReference(props.composerReference))

function normalizeAgentContextReference(reference = null) {
  if (!isPlainRecord(reference)) return null
  const title = String(reference.title || reference.nodeTitle || reference.name || '').trim()
  if (!title) return null
  const kindLabel = String(reference.kindLabel || reference.label || '正在引用画布节点').trim()
  const summary = String(reference.summary || reference.description || reference.subtitle || '').replace(/\s+/g, ' ').trim()
  return {
    kindLabel,
    ariaLabel: String(reference.ariaLabel || kindLabel || '消息引用上下文').trim(),
    title,
    summary
  }
}

function visibleMessageDedupeKey(message = {}) {
  const meta = messageMeta(message)
  const reportStatus = String(meta.reportStatus || meta.status || '').trim()
  if (
    messageRole(message) === 'assistant' &&
    meta.action === 'advanced-ux-markdown-report' &&
    ['failed', 'quality_failed', 'import_failed'].includes(reportStatus) &&
    !String(meta.markdown || '').trim()
  ) {
    return 'assistant:advanced-ux-markdown-report:failed'
  }
  const clientMessageId = messageMeta(message).clientMessageId || message.clientMessageId || ''
  if (!clientMessageId) return ''
  return [
    messageRole(message),
    clientMessageId,
    messageMeta(message).action || message.action || ''
  ].join(':')
}

function latestBusyAssistantIndex(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (messageRole(message) === 'assistant' && isMessageBusy(message)) return index
  }
  return -1
}

function isLegacyApplyToCanvasText(content = '') {
  return String(content || '').trim() === '应用到画布'
}

function isLegacyApplyToCanvasPendingAssistant(message = {}) {
  const meta = messageMeta(message)
  const action = String(meta.action || message.action || '')
  return messageRole(message) === 'assistant' &&
    isMessageBusy(message) &&
    meta.optimistic === true &&
    (meta.placeholderOnly === true || !messageContent(message).trim()) &&
    ['', 'send', 'stage-agent-message', 'canvas-action-advice'].includes(action)
}

function isLegacyApplyToCanvasPendingPair(messages = [], index = 0) {
  const message = messages[index] || {}
  const previousMessage = messages[index - 1] || {}
  const nextMessage = messages[index + 1] || {}
  if (
    messageRole(message) === 'user' &&
    isLegacyApplyToCanvasText(messageContent(message)) &&
    isLegacyApplyToCanvasPendingAssistant(nextMessage)
  ) return true
  return isLegacyApplyToCanvasPendingAssistant(message) &&
    isLegacyApplyToCanvasText(messageContent(previousMessage))
}

const visibleMessages = computed(() => {
  const messages = Array.isArray(props.session?.messages)
    ? props.session.messages
        .filter(isPlainRecord)
        .filter((message) => !isLegacyAdvancedUxStageConfirmUserPrompt(message))
        .filter((message, index, sourceMessages) => !isLegacyApplyToCanvasPendingPair(sourceMessages, index))
        .filter((message) => !isLegacyAdvancedUxDownstreamPageLayoutArtifact(message))
        .filter((message) => !isLegacyPlaceholderAgentMessage(message))
    : []
  const latestBusyIndex = latestBusyAssistantIndex(messages)
  const visibleMessageMap = new Map()
  const output = []
  messages.forEach((message, index) => {
    if (isMessageBusy(message) && messageRole(message) === 'assistant' && index !== latestBusyIndex) return
    const key = visibleMessageDedupeKey(message)
    if (!key) {
      output.push(message)
      return
    }
    if (visibleMessageMap.has(key)) {
      output[visibleMessageMap.get(key)] = message
      return
    }
    visibleMessageMap.set(key, output.length)
    output.push(message)
  })
  return output
})
const activeTracePhrases = computed(() => {
  const phrases = visibleMessages.value
    .filter((message) => isMessageBusy(message) && messageTraceItems(message).length)
    .flatMap((message) => messageTraceItems(message)
      .filter((item) => ['running', 'queued'].includes(String(item.status || 'queued')))
      .map((item) => traceItemText(item) || item.label)
    )
    .map((phrase) => String(phrase || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return phrases.length ? Array.from(new Set(phrases)).slice(0, 4) : []
})
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
const composerPlaceholder = computed(() => {
  if (props.session?.skillId === 'dialogue-skill') {
    return '像普通聊天一样输入完整问题，Enter 发送。'
  }
  return agentInteraction.value?.inputPlaceholder ||
    `只针对「${props.activeNode?.title || props.session.title}」提问、补充资料，或选择无疑问跳过。`
})

function messageKey(message = {}, index = 0) {
  return message.id || message.clientMessageId || message.meta?.clientMessageId || `${message.role || 'message'}-${message.createdAt || index}-${index}`
}

function messageContextReference(message = {}) {
  return normalizeAgentContextReference(messageMeta(message).contextReference)
}

function messageAttachments(message = {}) {
  const attachments = messageMeta(message).attachments
  return Array.isArray(attachments) ? attachments.filter(isPlainRecord) : []
}

function attachmentKey(attachment = {}, index = 0) {
  return attachment.id || attachment.name || `attachment-${index}`
}

function attachmentName(attachment = {}, index = 0) {
  return String(attachment.name || attachment.title || `附件 ${index + 1}`)
}

function attachmentPreview(attachment = {}) {
  return String(attachment.preview || '')
}

function attachmentKindLabel(attachment = {}) {
  return attachment.kind === 'image' ? '图' : '文'
}

function attachmentKindClass(attachment = {}) {
  return attachment.kind === 'image' ? 'is-image' : 'is-document'
}

function attachmentTypeLabel(attachment = {}) {
  const status = String(attachment.status || '').trim()
  if (status === 'failed') return '读取失败'
  return String(attachment.type || (attachment.kind === 'image' ? '图片' : '文件') || '附件')
}

function messageActionKey(message = {}) {
  return String(message.id || message.clientMessageId || message.meta?.clientMessageId || message.createdAt || '')
}

function messageCopyFeedbackId(message = {}) {
  return `agent-copy-feedback-${messageActionKey(message) || 'message'}`
}

function isMessageCopyFeedbackVisible(message = {}) {
  return Boolean(copiedMessageId.value && copiedMessageId.value === messageActionKey(message))
}

function copyTooltipLabel(message = {}) {
  return isMessageCopyFeedbackVisible(message) ? '已复制' : '复制'
}

function copyMessage(message = {}) {
  emit('copy-message', message, () => showCopyFeedback(message))
}

function showCopyFeedback(message = {}) {
  const key = messageActionKey(message)
  copiedMessageId.value = key
  copyToastVisible.value = false
  if (copiedMessageTimer) clearTimeout(copiedMessageTimer)
  requestAnimationFrame(() => {
    copyToastVisible.value = true
  })
  copiedMessageTimer = setTimeout(() => {
    if (copiedMessageId.value === key) copiedMessageId.value = ''
    copyToastVisible.value = false
  }, 2000)
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

function closeAgentHistory() {
  if (props.historyOpen) emit('close-history')
}

function isInsideAgentPopoverControl(event, selector) {
  return Boolean(event.target?.closest?.(selector))
}

function handleGlobalPointerDown(event) {
  const insideHistoryEntry = isInsideAgentPopoverControl(event, '.agent-history-entry')

  if (!insideHistoryEntry) closeAgentHistory()
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    closeAgentHistory()
  }
}

function selectHistoryItem(content) {
  emit('select-history', content)
  closeAgentHistory()
}

function triggerUpload(type = 'all') {
  agentUploadAccept.value = agentUploadAcceptMap[type] || agentUploadAcceptMap.all
  if (fileInput.value) fileInput.value.value = ''
  requestAnimationFrame(() => fileInput.value?.click?.())
}

function referenceStatusLabel(status = '') {
  if (status === 'ready') return '已读取'
  if (status === 'failed') return '读取失败'
  if (status === 'uploading') return '上传中'
  return '待解析'
}

function messageStatus(message) {
  if (
    messageMeta(message).action === 'workflow-analysis-result' &&
    !messageMeta(message).transient &&
    messageContent(message).trim()
  ) {
    return 'success'
  }
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

// Streaming replies must not be hidden by the busy state: show the loader only
// before the model sends any displayable text, then let the framed content cards render.
function shouldShowThinkingLoader(message = {}) {
  return isMessageBusy(message) && !messageContent(message).trim()
}

function isMessageFailed(message) {
  return messageStatus(message) === 'failed'
}

function isEditingMessage(message = {}) {
  return Boolean(props.editingMessage?.id && props.editingMessage.id === message.id)
}

function hasMessageActions(message) {
  return canCopyMessage(message) ||
    canRetryMessage(message) ||
    canEditMessage(message) ||
    canConfirmMessage(message)
}

function visibleMessageRecommendations(message) {
  if (messageRole(message) !== 'assistant' || isMessageBusy(message) || isMessageFailed(message)) return []
  if (shouldSuppressMessageRecommendations(message)) return []
  if (messageKey(message, visibleMessages.value.indexOf(message)) !== latestRecommendationMessageKey.value) return []
  if (isLegacyLayoutOptionsMessage(message)) {
    return ['按新规则重生成', ...visibleQuickReplies.value.filter((reply) => reply !== '按新规则重生成')].slice(0, 4)
  }
  if (isLayoutOptionsProposalMessage(message) && visibleQuickReplies.value.length) return visibleQuickReplies.value.slice(0, 4)
  if (visibleQuickReplies.value.length) return visibleQuickReplies.value.slice(0, 3)
  return isRequirementDissectionAgentScope() ? [] : defaultAssistantRecommendations
}

const defaultAssistantRecommendations = ['待确认的问题', '建议', '下一步']

function shouldSuppressMessageRecommendations(message = {}) {
  const action = String(messageMeta(message).action || message.action || '').trim()
  return ['stage-confirm-next', 'advanced-ux-stage-confirm-next'].includes(action)
}

function isApplyToCanvasRecommendation(reply = '') {
  return /应用到画布/.test(String(reply || ''))
}

function messageHasApplyToCanvasRecommendation(message) {
  return visibleMessageRecommendations(message).some(isApplyToCanvasRecommendation)
}

function isLayoutOptionsProposalMessage(message = {}) {
  return visibleMessageLayoutOptions(message).length >= 3
}

function isLegacyLayoutOptionsMessage(message = {}) {
  // Contract: old plain-text layout answers stay historical; offer regeneration instead of fabricating structure.
  const legacyLayoutNotice = '旧规则布局方案，可按新规则重生成'
  if (!isInteractionLofiAgentScope()) return false
  if (messageRole(message) !== 'assistant' || isMessageBusy(message) || isMessageFailed(message)) return false
  if (visibleMessageLayoutOptions(message).length) return false
  void legacyLayoutNotice
  const text = messageContent(message)
  return /3\s*套候选框架|方案一|方案二|方案三/.test(text) &&
    /轻量入口型|运营推荐型|效率任务型|布局方案/.test(text)
}

function isInteractionLofiAgentScope() {
  return props.activeNode?.stageId === 'interaction-lofi' ||
    props.session?.scopeId === 'interaction-lofi'
}

function agentSessionHasAdvancedUxReportMessage() {
  return Array.isArray(props.session?.messages) && props.session.messages.some((message) => {
    const meta = messageMeta(message)
    return Boolean(String(meta.markdown || '').trim()) && (
      String(meta.action || message.action || '').trim() === 'advanced-ux-markdown-report' ||
      String(meta.artifactType || '').trim() === 'requirements-markdown'
    )
  })
}

function isAdvancedUxAgentScope() {
  return String(props.session?.skillId || '').trim() === 'advanced-ux-requirement-analysis' ||
    agentSessionHasAdvancedUxReportMessage() ||
    String(props.activeNode?.sourceArtifact?.type || '').trim() === 'advanced-ux-page-interaction-document' ||
    String(props.activeNode?.pageLayoutArtifact?.version || '').includes('advanced-ux-page-interaction') ||
    String(props.activeNode?.interactionSpecArtifact?.version || '').includes('advanced-ux-page-interaction')
}

function isLegacyAdvancedUxDownstreamPageLayoutArtifact(message = {}) {
  if (!isAdvancedUxAgentScope()) return false
  if (messageRole(message) !== 'assistant') return false
  const meta = messageMeta(message)
  const action = String(meta.action || message.action || '').trim()
  const content = messageContent(message)
  return ['stage-confirm-next', 'workflow-analysis-result'].includes(action) &&
    /:::\s*page-layout-artifact/.test(content) &&
    /页面骨架|模型推荐方案|ASCII\s*页面线框图/.test(content)
}

function isLegacyAdvancedUxStageConfirmUserPrompt(message = {}) {
  if (!isAdvancedUxAgentScope()) return false
  if (messageRole(message) !== 'user') return false
  const action = String(messageMeta(message).action || message.action || '').trim()
  if (action !== 'stage-confirm-next') return false
  return /请确认「[^」]+」阶段结果/.test(messageContent(message))
}

function shouldSuppressActiveNodePageLayoutArtifactInAgent() {
  return isAdvancedUxAgentScope()
}

function shouldSuppressAdvancedUxAgentDiagnostics(message = {}) {
  if (!isAdvancedUxAgentScope()) return false
  if (messageRole(message) !== 'assistant') return false
  return true
}

function isRequirementDissectionAgentScope() {
  const values = [
    props.activeNode?.id,
    props.activeNode?.stageId,
    props.activeNode?.title,
    props.session?.scopeId,
    props.session?.title
  ].map((item) => String(item || '').trim())
  return values.some((item) => item === 'requirement-dissection' ||
    item === 'requirement-dissection-agent' ||
    item === '需求分析' ||
    item === '需求解剖')
}

function visibleMessageLayoutOptions(message = {}) {
  if (!isInteractionLofiAgentScope()) return []
  return messageLayoutOptions(message)
}

function visibleMessageLayoutComparisonRows(message = {}) {
  if (!isInteractionLofiAgentScope()) return []
  const writeableContent = messageWriteableContent(message)
  const rows = Array.isArray(writeableContent.layoutComparisonRows)
    ? writeableContent.layoutComparisonRows
    : (Array.isArray(writeableContent.comparisonRows) ? writeableContent.comparisonRows : [])
  const normalizedRows = rows
    .filter(isPlainRecord)
    .map((row) => ({
      label: String(row.label || row.title || row.name || '').trim(),
      option1: String(row.option1 || row.a || row.first || row.values?.[0] || '').trim(),
      option2: String(row.option2 || row.b || row.second || row.values?.[1] || '').trim(),
      option3: String(row.option3 || row.c || row.third || row.values?.[2] || '').trim()
    }))
    .filter((row) => row.label && (row.option1 || row.option2 || row.option3))
    .slice(0, 8)
  return normalizedRows.length ? normalizedRows : fallbackLayoutComparisonRows(messageLayoutOptions(message))
}

function fallbackLayoutComparisonRows(options = []) {
  const optionValues = (index, getter) => {
    const option = options[index] || {}
    return String(getter(option) || '').trim()
  }
  if (options.length < 3) return []
  return [
    {
      label: '布局组织',
      option1: optionValues(0, (option) => option.layoutStrategy || option.arrangement || option.title),
      option2: optionValues(1, (option) => option.layoutStrategy || option.arrangement || option.title),
      option3: optionValues(2, (option) => option.layoutStrategy || option.arrangement || option.title)
    },
    {
      label: '适合场景',
      option1: optionValues(0, (option) => option.bestFor || option.scenario),
      option2: optionValues(1, (option) => option.bestFor || option.scenario),
      option3: optionValues(2, (option) => option.bestFor || option.scenario)
    },
    {
      label: '风险取舍',
      option1: optionValues(0, (option) => option.risk || option.tradeoff),
      option2: optionValues(1, (option) => option.risk || option.tradeoff),
      option3: optionValues(2, (option) => option.risk || option.tradeoff)
    }
  ].filter((row) => row.option1 || row.option2 || row.option3)
}

function messageWriteableContent(message = {}) {
  return isPlainRecord(messageMeta(message).proposalSummary?.writeableContent)
    ? messageMeta(message).proposalSummary.writeableContent
    : {}
}

function messageLayoutOptions(message = {}) {
  const writeableContent = messageWriteableContent(message)
  return (Array.isArray(writeableContent.layoutOptions) ? writeableContent.layoutOptions : [])
    .filter(isPlainRecord)
    .slice(0, 3)
}

function layoutOptionDisplayLabel(option = {}, index = 0) {
  const explicitLabel = String(option.label || '').trim()
  if (explicitLabel) return explicitLabel.replace(/^方案\s*1$/, '方案一').replace(/^方案\s*2$/, '方案二').replace(/^方案\s*3$/, '方案三')
  return ['方案一', '方案二', '方案三'][index] || `方案${index + 1}`
}

function layoutOptionExplanationMarkdown(option = {}) {
  const lines = []
  const summary = String(option.summary || '').trim()
  if (summary) lines.push(summary)
  const bestFor = String(option.bestFor || option.scenario || '').trim()
  const risk = String(option.risk || option.tradeoff || '').trim()
  if (bestFor || risk) {
    if (lines.length) lines.push('')
    lines.push('1）补充说明')
    if (bestFor) lines.push(`· 适合：${bestFor}`)
    if (risk) lines.push(`· 取舍：${risk}`)
  }
  return lines.join('\n')
}

function layoutOptionExplanationBlocks(option = {}) {
  return agentMarkdownRenderableBlocks(layoutOptionExplanationMarkdown(option))
}

function layoutOptionFrameworkBlocks(option = {}) {
  const text = layoutOptionFrameworkText(option)
  const wireframeText = text ? pageLayoutArtifactWireframeText(text, '页面框架') : ''
  return wireframeText ? [{ type: 'pre', text: wireframeText }] : []
}

function layoutOptionFrameworkText(option = {}) {
  const artifactText = String(
    option.pageLayoutArtifact?.asciiWireframe ||
    option.pageLayoutArtifact?.rawText ||
    option.pageLayoutArtifact?.framework ||
    option.pageLayoutArtifact?.wireframe ||
    ''
  ).trim()
  if (artifactText) return artifactText
  const directWireframe = String(option.asciiWireframe || option.wireframe || option.frameworkText || '').trim()
  if (directWireframe) return directWireframe
  return layoutOptionFrameText(option)
}

function layoutOptionFrameText(option = {}) {
  const rows = proposalTextLines(
    option.frameworkRows ||
    option.sharedFramework ||
    option.pageFramework ||
    option.wireframeRows ||
    option.layout ||
    option.items ||
    option.sections,
    10
  )
  const title = String(option.title || option.name || '候选框架').trim()
  const contentRows = rows.length ? rows : [String(option.summary || '等待模型补充框架区域。').trim()].filter(Boolean)
  const width = 42
  const border = '┌' + '─'.repeat(width) + '┐'
  const footer = '└' + '─'.repeat(width) + '┘'
  const line = (text = '') => {
    const value = String(text || '').replace(/\s+/g, ' ').trim().slice(0, width - 2)
    return `│ ${value}${' '.repeat(Math.max(0, width - 1 - value.length))}│`
  }
  return [
    border,
    line(title),
    '├' + '─'.repeat(width) + '┤',
    ...contentRows.map((item) => line(item.replace(/^[^：:]{1,16}[：:]\s*/, ''))),
    footer
  ].join('\n')
}

function canCopyMessage(message) {
  return Boolean(messageContent(message).trim()) && !isMessageBusy(message) && !isEditingMessage(message)
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
  return isUser && !isEditingMessage(message) && Boolean(messageContent(message).trim())
}

function isConfirmReply(reply = '') {
  if (isDialogueSkillTransferReply(reply)) return false
  return /确认/.test(String(reply || ''))
}

function isDialogueSkillTransferReply(reply = '') {
  return /转\s*UX\s*设计确认|UX\s*设计确认|转需求确认|进入\s*UX/i.test(String(reply || ''))
}

function canConfirmMessage(message) {
  if (isWorkflowChatOnlyStageScope(props.session?.scopeId || '')) return false
  const isAssistant = messageRole(message) === 'assistant'
  const proposalId = messageMeta(message).proposalId
  const proposalStatus = messageProposalStatus(message)
  if (!messageContent(message).trim()) return false
  if (messageHasApplyToCanvasRecommendation(message)) return false
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

function messageGenerateActionLabel(message) {
  if (messageStatus(message) === 'generating') return '生成回复'
  return retryActionLabel(message)
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

const defaultTraceItems = [
  { key: 'intent', label: '需求识别', status: 'queued', text: '等待识别需求...' },
  { key: 'plan', label: '任务规划', status: 'queued', text: '等待规划任务...' },
  { key: 'answer', label: '回答/提案', status: 'queued', text: '等待生成回复...' },
  { key: 'evidence', label: '引用依据', status: 'queued', text: '等待整理依据...' }
]

function messageTraceItems(message = {}) {
  if (messageRole(message) !== 'assistant') return []
  const trace = Array.isArray(message.trace) ? message.trace.filter(isPlainRecord) : []
  if (!trace.length) return []
  const hasUnfinishedTrace = trace.some((item) => ['queued', 'running'].includes(String(item.status || 'queued')))
  if (hasUnfinishedTrace && !isMessageBusy(message) && !isMessageFailed(message)) return []
  const byKey = new Map(trace.map((item) => [String(item.key || ''), item]))
  return defaultTraceItems
    .map((fallback) => ({ ...fallback, ...(byKey.get(fallback.key) || {}) }))
    .filter((item) => item.status !== 'skipped' || item.summary || item.text)
}

function messageTraceSummary(message = {}) {
  const items = messageTraceItems(message)
  const running = items.find((item) => String(item.status || '') === 'running')
  const failed = items.find((item) => String(item.status || '') === 'failed')
  if (failed) return `处理失败：${failed.label || 'Agent'}`
  if (isMessageBusy(message) || running) return ''
  return `已处理 ${items.length} 项`
}

function visibleTraceSummary(message = {}) {
  if (isMessageBusy(message) && traceTypewriterText.value) return traceTypewriterText.value
  return messageTraceSummary(message)
}

function stopTraceTypewriter() {
  if (traceTypewriterTimer) {
    clearTimeout(traceTypewriterTimer)
    traceTypewriterTimer = null
  }
}

function resetTraceTypewriterState() {
  traceTypewriterPhraseIndex = 0
  traceTypewriterCharIndex = 0
  traceTypewriterDeleting = false
  traceTypewriterText.value = ''
}

function tickTraceTypewriter() {
  const phrases = activeTracePhrases.value
  if (!phrases.length) {
    stopTraceTypewriter()
    resetTraceTypewriterState()
    return
  }
  const phrase = phrases[traceTypewriterPhraseIndex % phrases.length] || ''
  if (traceTypewriterDeleting) {
    traceTypewriterCharIndex = Math.max(0, traceTypewriterCharIndex - 1)
  } else {
    traceTypewriterCharIndex = Math.min(phrase.length, traceTypewriterCharIndex + 1)
  }
  traceTypewriterText.value = phrase.slice(0, traceTypewriterCharIndex)
  let delay = traceTypewriterDeleting ? 34 : 58
  if (!traceTypewriterDeleting && traceTypewriterCharIndex >= phrase.length) {
    traceTypewriterDeleting = true
    delay = 860
  } else if (traceTypewriterDeleting && traceTypewriterCharIndex === 0) {
    traceTypewriterDeleting = false
    traceTypewriterPhraseIndex = (traceTypewriterPhraseIndex + 1) % phrases.length
    delay = 180
  }
  traceTypewriterTimer = setTimeout(tickTraceTypewriter, delay)
}

function restartTraceTypewriter() {
  stopTraceTypewriter()
  resetTraceTypewriterState()
  if (!activeTracePhrases.value.length) return
  traceTypewriterTimer = setTimeout(tickTraceTypewriter, 80)
}

function traceItemClass(item = {}) {
  const status = String(item.status || 'queued')
  return {
    queued: status === 'queued',
    running: status === 'running',
    done: status === 'done',
    failed: status === 'failed',
    skipped: status === 'skipped'
  }
}

function traceItemText(item = {}) {
  return String(item.text || item.summary || '处理中...').trim()
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

function messageProposalSummary(message = {}) {
  const metaProposalSummary = isPlainRecord(messageMeta(message).proposalSummary)
    ? messageMeta(message).proposalSummary
    : {}
  if (Object.keys(metaProposalSummary).length) return metaProposalSummary
  const parsed = extractStructuredAgentJson(message?.content)
  const parsedProposal = parsed?.proposal || parsed?.structuredProposal || parsed?.agentProposal
  return isPlainRecord(parsedProposal) ? parsedProposal : {}
}

function messageProposalEvidence(message = {}) {
  if (shouldSuppressAdvancedUxAgentDiagnostics(message)) {
    return { rationale: [], contextSources: [] }
  }
  const proposalSummary = messageProposalSummary(message)
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
  if (shouldSuppressAdvancedUxAgentDiagnostics(message)) return []
  const items = messageKnowledgeItemsRaw(message).filter(isPlainRecord)
  if (items.length) return items
  return []
}

function messageKnowledgeItemsRaw(message) {
  const meta = messageMeta(message)
  return Array.isArray(meta.retrievedKnowledge) ? meta.retrievedKnowledge : []
}

function dataLookupStatusLabel(status = '') {
  const labels = {
    done: '已完成',
    skipped: '未命中',
    failed: '失败',
    running: '查询中',
    queued: '排队中'
  }
  return labels[String(status || '')] || String(status || '未知')
}

function messageDataLookups(message = {}) {
  if (shouldSuppressAdvancedUxAgentDiagnostics(message)) return []
  const lookups = messageMeta(message).dataLookups
  return (Array.isArray(lookups) ? lookups : [])
    .filter(isPlainRecord)
    .map((item) => ({
      key: String(item.key || item.toolKey || item.label || ''),
      label: String(item.label || item.toolKey || item.key || '数据工具'),
      status: String(item.status || 'skipped'),
      statusLabel: dataLookupStatusLabel(item.status),
      count: Number.isFinite(Number(item.count)) ? Number(item.count) : 0,
      countLabel: `结果 ${Number.isFinite(Number(item.count)) ? Number(item.count) : 0}`,
      summary: String(item.summary || item.error || '暂无查询摘要')
    }))
    .filter((item) => item.key || item.label)
}

function messageDataLookupKey(item = {}) {
  return `${item.key || item.label || 'lookup'}-${item.status || 'status'}`
}

function messageDataLookupStatusLabel(message = {}) {
  const lookups = messageDataLookups(message)
  const failed = lookups.filter((item) => item.status === 'failed').length
  const done = lookups.filter((item) => item.status === 'done').length
  if (failed) return `${failed} 项失败`
  if (done) return `${done} 项命中`
  return '未命中'
}

function messageAnswerEvaluation(message = {}) {
  if (shouldSuppressAdvancedUxAgentDiagnostics(message)) return null
  const evaluation = messageMeta(message).answerEvaluation
  if (!isPlainRecord(evaluation)) return null
  const score = Number.isFinite(Number(evaluation.score)) ? Number(evaluation.score) : 0
  const checks = Array.isArray(evaluation.checks) ? evaluation.checks : []
  const warnings = Array.isArray(evaluation.warnings) ? evaluation.warnings : []
  if (!checks.length && !warnings.length && !evaluation.status) return null
  return {
    status: String(evaluation.status || 'needs-review'),
    score,
    checks,
    warnings,
    recommendedActions: Array.isArray(evaluation.recommendedActions) ? evaluation.recommendedActions : []
  }
}

function messageAnswerEvaluationStatusLabel(status = '') {
  const labels = {
    passed: '通过',
    'needs-review': '需复核',
    warning: '提醒',
    failed: '失败'
  }
  return labels[String(status || '')] || String(status || '未知')
}

function messageAnswerEvaluationLabel(message = {}) {
  const evaluation = messageAnswerEvaluation(message)
  if (!evaluation) return ''
  return `${messageAnswerEvaluationStatusLabel(evaluation.status)} · ${evaluation.score}`
}

function messageAnswerEvaluationChecks(message = {}) {
  const checks = messageAnswerEvaluation(message)?.checks
  return (Array.isArray(checks) ? checks : [])
    .filter(isPlainRecord)
    .map((item, index) => ({
      key: String(item.key || item.label || `check-${index}`),
      label: String(item.label || item.key || `检查 ${index + 1}`),
      status: String(item.status || 'warning'),
      summary: String(item.summary || '暂无评估说明')
    }))
}

function messageAnswerEvaluationWarnings(message = {}) {
  const warnings = messageAnswerEvaluation(message)?.warnings
  return (Array.isArray(warnings) ? warnings : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

function messageAnswerEvaluationActions(message = {}) {
  const actions = messageAnswerEvaluation(message)?.recommendedActions
  return (Array.isArray(actions) ? actions : [])
    .filter(isPlainRecord)
    .map((item, index) => ({
      key: String(item.key || item.label || `evaluation-action-${index}`),
      label: String(item.label || item.key || `动作 ${index + 1}`),
      action: String(item.action || 'quick-reply'),
      reason: String(item.reason || '')
    }))
    .filter((item) => item.label)
    .slice(0, 4)
}

function messageEvidencePack(message = {}) {
  if (shouldSuppressAdvancedUxAgentDiagnostics(message)) return null
  const pack = messageMeta(message).evidencePack
  if (!isPlainRecord(pack)) return null
  const hasSources = Array.isArray(pack.sources) && pack.sources.length > 0
  const hasFacts = Array.isArray(pack.facts) && pack.facts.length > 0
  const hasBoundary = Array.isArray(pack.assumptions) && pack.assumptions.length > 0 ||
    Array.isArray(pack.uncertainties) && pack.uncertainties.length > 0
  return hasSources || hasFacts || hasBoundary ? pack : null
}

function messageEvidencePackConfidence(message = {}) {
  const confidence = String(messageEvidencePack(message)?.confidence || 'medium')
  const labels = {
    high: '高置信',
    medium: '中置信',
    low: '低置信'
  }
  return labels[confidence] || confidence
}

function messageEvidenceSources(message = {}) {
  const sources = messageEvidencePack(message)?.sources
  return (Array.isArray(sources) ? sources : [])
    .filter(isPlainRecord)
    .map((item, index) => ({
      id: String(item.id || item.sourceUrl || item.title || index),
      title: String(item.title || `来源 ${index + 1}`),
      snippet: String(item.snippet || item.summary || item.content || '暂无片段'),
      typeLabel: String(item.type || item.sourceType || item.materialType || '上下文')
    }))
    .slice(0, 5)
}

function messageEvidenceSourceKey(item = {}) {
  return `${item.typeLabel || 'source'}-${item.id || item.title || item.snippet || ''}`
}

function messageEvidenceFacts(message = {}) {
  const facts = messageEvidencePack(message)?.facts
  return (Array.isArray(facts) ? facts : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function messageEvidenceAssumptions(message = {}) {
  const assumptions = messageEvidencePack(message)?.assumptions
  return (Array.isArray(assumptions) ? assumptions : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

function messageEvidenceUncertainties(message = {}) {
  const uncertainties = messageEvidencePack(message)?.uncertainties
  return (Array.isArray(uncertainties) ? uncertainties : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 4)
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

function messageVisualArtifact(message = {}) {
  const meta = messageMeta(message)
  const artifact = meta.visualArtifact && typeof meta.visualArtifact === 'object' && !Array.isArray(meta.visualArtifact)
    ? meta.visualArtifact
    : null
  const imageUrl = String(artifact?.imageUrl || artifact?.imageDataUrl || '').trim()
  if (imageUrl) return { ...artifact, imageUrl }
  return artifact?.status === 'generating' ? { ...artifact } : null
}

function messageRole(message) {
  return ['user', 'assistant'].includes(message?.role) ? message.role : 'assistant'
}

function proposalTextLines(items = [], limit = 16) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (isPlainRecord(item)) return [item.label, item.title, item.text, item.summary, item.content].filter(Boolean).join('：')
      return String(item || '')
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function proposalObjectLines(items = [], mapper, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .filter(isPlainRecord)
    .map(mapper)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function expandedProposalMessageContent(message = {}) {
  if (messageRole(message) !== 'assistant') return ''
  const proposalSummary = isPlainRecord(messageMeta(message).proposalSummary) ? messageMeta(message).proposalSummary : {}
  const writeableContent = isPlainRecord(proposalSummary.writeableContent) ? proposalSummary.writeableContent : {}
  if (!Object.keys(proposalSummary).length || !Object.keys(writeableContent).length) return ''
  const originalContent = String(message?.content ?? '').trim()
  const lines = []
  const intro = String(messageMeta(message).modelParsedContent || originalContent || proposalSummary.summary || '').trim()
  const title = String(proposalSummary.title || '').trim()
  if (intro) lines.push(intro)
  if (title) lines.push('', `## ${title}`)
  if (proposalSummary.summary && proposalSummary.summary !== intro) lines.push(String(proposalSummary.summary).trim())
  if (writeableContent.summary) lines.push('', '### 可写入内容', String(writeableContent.summary).trim())
  const writeableItems = proposalTextLines(writeableContent.items, 24)
  if (writeableItems.length) lines.push('', ...writeableItems.map((item, index) => `${index + 1}. ${item}`))
  const acceptanceCriteria = proposalTextLines(writeableContent.acceptanceCriteria, 12)
  if (acceptanceCriteria.length) lines.push('', '### 验收标准', ...acceptanceCriteria.map((item, index) => `${index + 1}. ${item}`))
  const downstreamImpact = proposalObjectLines(proposalSummary.downstreamImpact, (item) => {
    const nodeId = item.nodeId || item.id || '后续节点'
    return `${nodeId}：${item.reason || '需要同步刷新口径。'}`
  }, 10)
  if (downstreamImpact.length) lines.push('', '### 后续影响', ...downstreamImpact.map((item) => `- ${item}`))
  const expanded = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return expanded.length > originalContent.length ? expanded : ''
}

const structuredAgentKeyLabels = {
  requirement_type: '需求类型',
  intent: '意图',
  detectedIntent: '识别意图',
  detected_intent: '识别意图',
  routingReason: '路由原因',
  routing_reason: '路由原因',
  resolvedSkillId: '匹配 Skill',
  resolved_skill_id: '匹配 Skill',
  requestedSkillId: '请求 Skill',
  requested_skill_id: '请求 Skill',
  outputPurpose: '输出用途',
  output_purpose: '输出用途',
  suggestions: '建议',
  recommendations: '建议',
  conclusion: '结论',
  currentRequirement: '当前需求',
  current_requirement: '当前需求',
  goal: '目标',
  outputType: '输出类型',
  output_type: '输出类型',
  structureTree: '结构树',
  structure_tree: '结构树',
  treeStructure: '结构树',
  tree_structure: '结构树',
  frameworkLayer: '框架层',
  framework_layer: '框架层',
  pageSkeleton: '页面骨架',
  page_skeleton: '页面骨架',
  pageFrame: '页面骨架',
  page_frame: '页面骨架',
  pageFlow: '页面流程',
  page_flow: '页面流程',
  flowChart: '流程图',
  flow_chart: '流程图',
  evidence: '关键依据',
  keyEvidence: '关键依据',
  key_evidence: '关键依据',
  sections: '分析章节',
  section: '分析章节',
  qualityReport: '质量报告',
  quality_report: '质量报告',
  quality: '质量报告',
  qualityGate: '质量检查',
  quality_gate: '质量检查',
  missingInformation: '缺失信息',
  missing_information: '缺失信息',
  missingInfo: '缺失信息',
  missing_info: '缺失信息',
  checks: '检查项',
  check: '检查项',
  business_goal: '业务目标',
  core_loop: '核心闭环',
  key_roles: '关键角色',
  key_pages: '关键页面',
  main_functions: '核心功能',
  user_journey: '用户流程',
  user_flow: '用户流程',
  order_flow: '下单流程',
  product_scope: '产品范围',
  scope: '范围',
  constraints: '约束条件',
  data_requirements: '数据要求',
  data_model: '数据模型',
  modules: '功能模块',
  pages: '页面',
  functions: '功能',
  features: '功能',
  dependenciesAndBoundaries: '依赖与边界',
  dependencies_and_boundaries: '依赖与边界',
  assumptions: '边界假设',
  gaps: '待确认问题',
  open_questions: '待确认问题',
  pending_questions: '待确认问题',
  pendingQuestions: '待确认问题',
  questions: '待确认问题',
  risks: '风险提醒',
  p0_scope: 'P0 范围',
  p1_scope: 'P1 范围',
  out_of_scope_for_now: '暂不纳入',
  next_stage_takeaways: '下一阶段带走结论',
  nextStepConclusions: '下一阶段带走结论',
  suggested_next_step: '建议下一步',
  recommended_next_step: '建议下一步',
  recommendedNextStep: '建议下一步',
  recommendedNextstep: '建议下一步',
  recommended_nextStep: '建议下一步',
  next_step: '建议下一步',
  nextStep: '建议下一步',
  next_step_recommendation: '建议下一步',
  acceptance_criteria: '验收标准',
  acceptanceCriteria: '验收标准',
  acceptanceCriteriaStatus: '验收标准状态',
  action: '操作',
  canvasContent: '画布内容',
  canvas_content: '画布内容',
  demandSummary: '需求摘要',
  demand_summary: '需求摘要',
  demandType: '需求类型',
  demand_type: '需求类型',
  businessGoal: '业务目标',
  business_goal: '业务目标',
  coreLoop: '核心闭环',
  core_loop: '核心闭环',
  item: '事项',
  items: '事项',
  field: '字段',
  label: '名称',
  value: '内容',
  status: '状态',
  missing: '缺失',
  drafted: '已起草',
  passed: '已通过',
  not_passed: '未通过',
  notPassed: '未通过',
  notpassed: '未通过',
  complete: '已完成',
  incomplete: '未完成',
  failed: '未通过',
  ready: '已就绪',
  needed_for: '判断依据',
  neededFor: '判断依据',
  facts_provided: '事实已提供',
  factsProvided: '事实已提供',
  inferences_provided: '推断已提供',
  inferencesProvided: '推断已提供',
  to_confirm_provided: '待确认项已提供',
  toConfirmProvided: '待确认项已提供',
  includes_conclusion: '包含结论',
  includesConclusion: '包含结论',
  includes_key_evidence: '包含关键证据',
  includesKeyEvidence: '包含关键证据',
  includes_risks: '包含风险',
  includesRisks: '包含风险',
  includes_uncertainties: '包含不确定性',
  includesUncertainties: '包含不确定性',
  includes_project_recommendation: '包含项目建议',
  includesProjectRecommendation: '包含项目建议',
  includes_conversion_advice: '包含转化建议',
  includesConversionAdvice: '包含转化建议',
  excludes_page_or_code_design: '排除页面或代码设计',
  excludesPageOrCodeDesign: '排除页面或代码设计',
  fact_inference_separation: '事实与推断分离',
  factInferenceSeparation: '事实与推断分离',
  non_project_demand_compliance: '非项目诉求处理',
  nonProjectDemandCompliance: '非项目诉求处理',
  code: '代码',
  html: 'HTML 代码',
  css: 'CSS 代码',
  js: 'JavaScript 代码',
  javascript: 'JavaScript 代码',
  vue: 'Vue 代码',
  json: 'JSON 数据',
  schema: '数据结构',
  example: '示例',
  examples: '示例'
}

const structuredAgentValueLabels = {
  status: '状态',
  missing: '缺失',
  drafted: '已起草',
  passed: '已通过',
  failed: '未通过',
  true: '是',
  false: '否'
}

const STRUCTURED_AGENT_INTERNAL_KEYS = [
  'stage',
  'id',
  'key',
  'type',
  'action',
  'schema',
  'schemaVersion',
  'version',
  'intent',
  'mode',
  'canvasTitle',
  'canvasType',
  'layoutRule',
  'qualityReport',
  'edges'
]

function isStructuredAgentInternalKey(key = '') {
  return STRUCTURED_AGENT_INTERNAL_KEYS.includes(String(key || '').trim()) ||
    /^(proposal|structuredProposal|agentProposal)$/i.test(String(key || '').trim())
}

function humanizeStructuredAgentKey(key = '') {
  const normalized = String(key || '').trim()
  if (structuredAgentKeyLabels[normalized]) return structuredAgentKeyLabels[normalized]
  return normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function structuredAgentValueLabel(key = '', value = '') {
  if (typeof value === 'boolean') return value ? '是' : '否'
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''
  return structuredAgentValueLabels[normalized] || normalized
}

function extractStructuredAgentJson(content = '') {
  const text = String(content || '').trim()
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, index + 1))
          return isPlainRecord(parsed) ? parsed : null
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function isStructuredAgentCodeKey(key = '') {
  // plaintext/text 是普通正文入口，不能放进代码 key。
  // 否则模型返回 {"plaintext": "...中文方案..."} 时，整段正文会被误包成“文本/代码”卡片。
  return /^(code|html|css|js|javascript|ts|typescript|vue|json|schema|snippet|source|tree|structure|framework|architecture|sitemap|layout)$/i.test(String(key || '').trim())
}

function isStructuredAgentMarkdownKey(key = '') {
  return /^(markdown|md)$/i.test(String(key || '').trim())
}

function isPlainTextAgentCodeLanguage(language = '') {
  return /^(text|txt|plain|plaintext|plain-text)$/i.test(String(language || '').trim())
}

function codeLanguageLabel(language = '') {
  const normalized = String(language || '').trim().toLowerCase()
  if (!normalized) return 'code'
  if (/tree|structure|framework|architecture|sitemap|layout|plaintext|text/.test(normalized)) return 'plaintext'
  if (/vue/.test(normalized)) return 'vue'
  if (/html/.test(normalized)) return 'html'
  if (/json|schema/.test(normalized)) return 'json'
  if (/markdown|md/.test(normalized)) return 'markdown'
  if (/typescript|\bts\b/.test(normalized)) return 'typescript'
  if (/javascript|\bjs\b/.test(normalized)) return 'javascript'
  if (/css/.test(normalized)) return 'css'
  return normalized.replace(/代码|数据/g, '').trim() || 'code'
}

function structuredAgentCodeLanguage(key = '', title = '代码') {
  const normalized = String(key || '').trim().toLowerCase()
  if (/^(tree|structure|structuretree|treestructure|sitemap)$/.test(normalized)) return '结构树'
  if (/^(framework|frameworklayer|architecture)$/.test(normalized)) return '框架层'
  if (/^(layout|wireframe|pageskeleton|pageframe|pageflow|flowchart)$/.test(normalized)) return '页面骨架'
  if (/^(plaintext|text|plain text)$/.test(normalized)) return title || '文本'
  return codeLanguageLabel(key)
}

function inferPlaintextFrameTitle(text = '', fallbackTitle = '文本') {
  const value = String(text || '').trim()
  if (!value) return fallbackTitle
  if (/(┌|┐|┘|┬|┴|┼)/.test(value)) return /(框架层|页面框架|输出框架|悬浮|底部导航|顶部固定|内容区)/.test(value) ? '框架层' : '页面骨架'
  if (treeTextLooksLikePageLayout(value)) return '页面骨架'
  if (/(├|└|│|─|页面结构树|信息架构树|结构树)/.test(value)) return '结构树'
  if (/(页面骨架|布局图|布局结构|左右分栏|上下分层)/.test(value)) return '页面骨架'
  if (/(框架层|页面总框架|顶部固定导航|底部Tab|滚动内容区|悬浮|弹窗|遮罩层)/.test(value)) return '框架层'
  return fallbackTitle
}

function normalizeStructuredAgentKeyToken(key = '') {
  return String(key || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function structuredAgentFrameKind(key = '', title = '', value = '') {
  const token = normalizeStructuredAgentKeyToken(key || title)
  const titleText = String(title || '').trim()
  const valueText = typeof value === 'string' ? value.trim() : structuredAgentCodeText(value)
  if (/^(structure_tree|tree_structure|tree|structure|sitemap|information_architecture|ia)$/.test(token) || /结构树|信息架构树|页面结构树|产品结构树/.test(titleText)) return '结构树'
  if (/^(framework_layer|framework|architecture|layout_layer)$/.test(token) || /框架层|产品框架|页面框架|业务框架|功能框架/.test(titleText)) return '框架层'
  if (/^(page_skeleton|page_frame|page_flow|flow_chart|wireframe|layout)$/.test(token) || /页面骨架|页面流程|流程图|线框|低保真|布局图/.test(titleText)) return '页面骨架'
  if (/(┌|┐|┘|┬|┴|┼)/.test(valueText)) return inferPlaintextFrameTitle(valueText, '页面骨架')
  if (/(├|└|│|─|┌|┐|┘|┬|┴|┼)/.test(valueText)) return inferPlaintextFrameTitle(valueText, '')
  return ''
}

function isPageLayoutArtifactKind(kind = '') {
  return /^(框架层|页面骨架|页面框架|页面流程|流程图|线框|低保真|布局图|布局|wireframe|ascii wireframe|page wireframe|layout)$/i.test(String(kind || '').trim())
}

function displayCardTitle(title = '') {
  const normalized = String(title || '').trim()
  const key = normalized.toLowerCase()
  if (!key) return '内容'
  if (/^(plaintext|text|plain text|文本)$/.test(key)) return '文本'
  if (/^(markdown|md)$/.test(key)) return 'Markdown'
  if (/^(tree|structure|sitemap|结构树|页面结构树|信息架构树)$/.test(key)) return '结构树'
  if (/^(framework|architecture|框架层|框架|架构)$/.test(key)) return '框架层'
  if (/^(layout|wireframe|布局|布局图)$/.test(key)) return '布局图'
  if (/^vue$/.test(key)) return 'Vue'
  if (/^html$/.test(key)) return 'HTML'
  if (/^json|schema$/.test(key)) return 'JSON'
  if (/^css$/.test(key)) return 'CSS'
  if (/^(javascript|js)$/.test(key)) return 'JavaScript'
  if (/^(typescript|ts)$/.test(key)) return 'TypeScript'
  if (/^code$/.test(key)) return '代码'
  return normalized
}

function structuredAgentCodeText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '').trim()
  }
}

function structuredAgentFrameText(value, frameKind = '文本') {
  if (value == null) return ''
  if (typeof value === 'string') {
    const text = value.trim()
    return (frameKind === '页面骨架' && /(?:├|└|│|─|- |\*)/.test(text)) || treeTextLooksLikePageLayout(text)
      ? pageLayoutTreeToWireframeText(text, frameKind)
      : text
  }
  const nodeLabel = (item, fallback = '') => {
    if (!isPlainRecord(item)) return String(item ?? fallback).trim()
    return String(item.title || item.name || item.page || item.module || item.label || item.role || item.id || fallback).trim()
  }
  const childEntries = (item) => {
    if (Array.isArray(item)) return [['', item]]
    if (!isPlainRecord(item)) return []
    return Object.entries(item)
      .filter(([childKey, childValue]) => !isStructuredAgentInternalKey(childKey) && childValue != null)
      .filter(([childKey]) => !['title', 'name', 'page', 'module', 'label', 'role', 'id', 'summary', 'description', 'value', 'reason'].includes(childKey))
      .filter(([, childValue]) => Array.isArray(childValue) || isPlainRecord(childValue))
  }
  const renderNode = (item, prefix = '', isLast = true, fallback = '') => {
    if (!isPlainRecord(item) && !Array.isArray(item)) {
      const leaf = String(item ?? '').trim()
      return leaf ? [`${prefix}${isLast ? '└─ ' : '├─ '}${leaf}`] : []
    }
    if (Array.isArray(item)) {
      return item.flatMap((child, index) => renderNode(child, prefix, index === item.length - 1, `${frameKind}${index + 1}`))
    }
    const label = nodeLabel(item, fallback)
    const details = [item.summary, item.description, item.value, item.reason]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
    const line = `${prefix}${isLast ? '└─ ' : '├─ '}${[label, ...details].filter(Boolean).join('：')}`
    const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`
    const children = childEntries(item).flatMap(([, childValue], childIndex, entries) =>
      renderNode(childValue, nextPrefix, childIndex === entries.length - 1, '')
    )
    return [line, ...children].filter((part) => String(part || '').trim())
  }
  const lines = Array.isArray(value)
    ? value.flatMap((item, index) => renderNode(item, '', index === value.length - 1, `${frameKind}${index + 1}`))
    : renderNode(value, '', true, frameKind)
  return lines.length ? lines.join('\n') : structuredAgentCodeText(value)
}

function structuredAgentText(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(structuredAgentText).filter(Boolean).join('；')
  if (isPlainRecord(value)) {
    const title = value.title || value.name || value.role || value.page || value.module || value.label || ''
    const description = value.description || value.summary || value.value || value.reason || ''
    const parts = [title, description].map((item) => String(item || '').trim()).filter(Boolean)
    if (parts.length) return Array.from(new Set(parts)).join('：')
    return Object.entries(value)
      .filter(([key]) => !isStructuredAgentInternalKey(key))
      .filter(([key]) => !isStructuredAgentCodeKey(key))
      .filter(([key]) => !isStructuredAgentMarkdownKey(key))
      .map(([key, item]) => `${humanizeStructuredAgentKey(key)}：${isPlainRecord(item) || Array.isArray(item) ? structuredAgentText(item) : structuredAgentValueLabel(key, item)}`)
      .filter(Boolean)
      .join('；')
  }
  return structuredAgentValueLabel('', value)
}

function structuredAgentSection(key = '', value) {
  if (isStructuredAgentInternalKey(key)) return null
  if (['title', 'summary'].includes(key)) return null
  const normalizedKey = String(key || '').trim().toLowerCase()
  const title = /^(plaintext|text|plain text)$/.test(normalizedKey)
    ? inferPlaintextFrameTitle(value, '文本')
    : humanizeStructuredAgentKey(key)
  const frameKind = structuredAgentFrameKind(key, title, value)
  if (frameKind) {
    const frameText = structuredAgentFrameText(value, frameKind)
    return frameText ? { title: frameKind, summary: '', frameKind, frameText, items: [] } : null
  }
  if (isStructuredAgentMarkdownKey(key)) {
    const markdown = structuredAgentCodeText(value)
    return markdown ? { title, summary: '', markdown, items: [] } : null
  }
  if (isStructuredAgentCodeKey(key)) {
    const code = structuredAgentCodeText(value)
    return code ? { title, summary: '', code, codeLanguage: structuredAgentCodeLanguage(key, title), items: [] } : null
  }
  const rawItems = Array.isArray(value) ? value : [value]
  const codeItems = []
  const markdownItems = []
  const items = rawItems
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .flatMap((item) => {
      if (!isPlainRecord(item)) return [item]
      const entries = Object.entries(item)
      const codeEntry = entries.find(([itemKey]) => isStructuredAgentCodeKey(itemKey))
      if (codeEntry) codeItems.push({ code: structuredAgentCodeText(codeEntry[1]), language: codeLanguageLabel(codeEntry[0]) })
      const markdownEntry = entries.find(([itemKey]) => isStructuredAgentMarkdownKey(itemKey))
      if (markdownEntry) markdownItems.push(structuredAgentCodeText(markdownEntry[1]))
      return [item]
    })
    .map(structuredAgentText)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const code = codeItems.map((item) => item.code).filter(Boolean).join('\n\n')
  const codeLanguage = codeItems.find((item) => item.code)?.language || ''
  const markdown = markdownItems.filter(Boolean).join('\n\n')
  if (!items.length && !code && !markdown) return null
  return { title, summary: '', code, codeLanguage, markdown, items }
}

function shouldShowStructuredSectionTitle(section = {}) {
  if (section?.frameText) return false
  return !(section?.markdown && !section?.code && !section?.summary && !section?.items?.length)
}

function compactWorkflowJsonMarkdownContent(content = '') {
  const parsed = extractStructuredAgentJson(content)
  if (!parsed) return ''
  const hasCompactSchema = parsed.readableSummary || parsed.totalDesignFlow || parsed.canvasTitle || parsed.groups
  if (!hasCompactSchema) return ''
  const readableSummary = isPlainRecord(parsed.readableSummary) ? parsed.readableSummary : {}
  const title = String(parsed.canvasTitle || parsed.title || '需求分析结果').trim()
  const lines = [`# ${title}`]
  const oneSentence = String(readableSummary.oneSentence || parsed.summary || '').trim()
  const userGoal = String(readableSummary.userGoal || '').trim()
  if (oneSentence) lines.push('', oneSentence)
  if (userGoal && userGoal !== oneSentence) lines.push('', `用户目标：${userGoal}`)
  const modules = Array.isArray(readableSummary.coreModules)
    ? readableSummary.coreModules.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const fallbackModules = modules.length ? modules : (Array.isArray(parsed.groups)
    ? parsed.groups.map((group) => group.groupName || group.name || group.title).filter(Boolean).slice(0, 5)
    : [])
  if (fallbackModules.length) lines.push('', '## 核心模块', ...fallbackModules.slice(0, 5).map((item) => `- ${item}`))
  const flow = Array.isArray(readableSummary.recommendedFlow)
    ? readableSummary.recommendedFlow.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (flow.length) lines.push('', '## 推荐流程', ...flow.slice(0, 6).map((item, index) => `- ${index + 1}. ${item}`))
  const slices = Array.isArray(parsed.totalDesignFlow?.requirementSlices) ? parsed.totalDesignFlow.requirementSlices : []
  if (slices.length) {
    lines.push('', '## 需求切片')
    slices.slice(0, 4).forEach((slice) => {
      const sliceTitle = String(slice?.title || slice?.name || slice?.id || '').trim()
      const sliceGoal = String(slice?.goal || slice?.summary || slice?.sourceExcerpt || '').trim()
      if (sliceTitle || sliceGoal) lines.push(`- ${[sliceTitle, sliceGoal].filter(Boolean).join('：')}`)
    })
  }
  const pages = Array.isArray(parsed.totalDesignFlow?.pages) ? parsed.totalDesignFlow.pages : []
  if (pages.length) {
    lines.push('', '## 页面与流程')
    pages.slice(0, 8).forEach((page) => {
      const pageTitle = String(page?.title || page?.name || page?.id || '').trim()
      const pageSummary = String(page?.summary || page?.route || '').trim()
      if (pageTitle || pageSummary) lines.push(`- ${[pageTitle, pageSummary].filter(Boolean).join('：')}`)
    })
  }
  const questions = Array.isArray(readableSummary.questions)
    ? readableSummary.questions.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (questions.length) lines.push('', '## 待确认问题', ...questions.slice(0, 4).map((item) => `- ${item}`))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function compactWorkflowJsonStructuredContent(content = '') {
  const parsed = extractStructuredAgentJson(content)
  if (!parsed) return null
  const hasCompactSchema = parsed.readableSummary || parsed.totalDesignFlow || parsed.canvasTitle || parsed.groups
  if (!hasCompactSchema) return null
  const title = String(parsed.canvasTitle || parsed.title || '需求分析结果').trim()
  const readableSummary = isPlainRecord(parsed.readableSummary) ? parsed.readableSummary : {}
  const summary = String(readableSummary.oneSentence || parsed.summary || '').trim()
  const sections = []
  const pushMarkdownSection = (sectionTitle, items = []) => {
    const normalizedItems = (Array.isArray(items) ? items : [items])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    if (normalizedItems.length) sections.push({ title: sectionTitle, summary: '', items: normalizedItems })
  }
  const userGoal = String(readableSummary.userGoal || '').trim()
  if (userGoal && userGoal !== summary) pushMarkdownSection('用户目标', [userGoal])
  pushMarkdownSection('核心模块', readableSummary.coreModules)
  pushMarkdownSection('推荐流程', readableSummary.recommendedFlow)
  const groups = Array.isArray(parsed.groups) ? parsed.groups : []
  const frameSections = []
  const overviewItems = []
  groups.forEach((group) => {
    const groupName = String(group?.groupName || group?.name || group?.title || '').trim()
    const nodes = Array.isArray(group?.nodes) ? group.nodes : []
    if (groupName) overviewItems.push(groupName)
    nodes.forEach((node) => {
      const nodeName = String(node?.nodeName || node?.name || node?.title || '').trim()
      const nodeSummary = String(node?.summary || '').trim()
      const nodeSections = Array.isArray(node?.sections) ? node.sections : []
      if (nodeName || nodeSummary) overviewItems.push([nodeName, nodeSummary].filter(Boolean).join('：'))
      nodeSections.forEach((section) => {
        const sectionTitle = String(section?.title || '').trim()
        const sectionItems = Array.isArray(section?.items) ? section.items : []
        const sectionText = sectionItems.map((item) => String(item || '').trim()).filter(Boolean).join('\n')
        const frameKind = structuredAgentFrameKind('section', sectionTitle, sectionText)
        if (!frameKind || !sectionText) return
        frameSections.push({
          title: frameKind,
          frameKind,
          frameText: [groupName, nodeName, sectionText].filter(Boolean).join('\n')
        })
      })
    })
  })
  if (!readableSummary.coreModules?.length) pushMarkdownSection('核心模块', overviewItems.slice(0, 6))
  const pages = Array.isArray(parsed.totalDesignFlow?.pages) ? parsed.totalDesignFlow.pages : []
  if (pages.length) {
    pushMarkdownSection('页面与流程', pages.slice(0, 8).map((page) => {
      const pageTitle = String(page?.title || page?.name || page?.id || '').trim()
      const pageSummary = String(page?.summary || page?.route || '').trim()
      return [pageTitle, pageSummary].filter(Boolean).join('：')
    }))
  }
  const slices = Array.isArray(parsed.totalDesignFlow?.requirementSlices) ? parsed.totalDesignFlow.requirementSlices : []
  if (slices.length) {
    pushMarkdownSection('需求切片', slices.slice(0, 4).map((slice) => {
      const sliceTitle = String(slice?.title || slice?.name || slice?.id || '').trim()
      const sliceGoal = String(slice?.goal || slice?.summary || slice?.sourceExcerpt || '').trim()
      return [sliceTitle, sliceGoal].filter(Boolean).join('：')
    }))
  }
  pushMarkdownSection('待确认问题', readableSummary.questions)
  sections.push(...frameSections)
  return { title, summary, sections }
}

function formatStructuredAgentMessageContent(content = '') {
  const compactStructured = compactWorkflowJsonStructuredContent(content)
  if (compactStructured) return compactStructured
  if (compactWorkflowJsonMarkdownContent(content)) return null
  const parsed = extractStructuredAgentJson(content)
  if (!parsed) return null
  const title = String(parsed.title || '').trim()
  const summary = String(parsed.summary || '').trim()
  const sections = []
  Object.entries(parsed).forEach(([key, value]) => {
    if (isStructuredAgentInternalKey(key)) return
    const section = structuredAgentSection(key, value)
    if (section) sections.push(section)
  })
  if (!title && !summary && !sections.length) return null
  return { title, summary, sections }
}

function structuredAgentPlainText(structured = null) {
  if (!structured) return ''
  const primaryMarkdown = primaryStructuredAgentMarkdownContent(structured)
  if (primaryMarkdown) return primaryMarkdown
  const lines = []
  if (structured.title) lines.push(`# ${structured.title}`)
  if (structured.summary) lines.push('', structured.summary)
  structured.sections.forEach((section) => {
    lines.push('', `## ${section.title}`)
    if (section.summary) lines.push(section.summary)
    if (section.frameText) lines.push('```', section.frameText, '```')
    if (section.code) lines.push('```', section.code, '```')
    section.items.forEach((item) => lines.push(`- ${item}`))
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function primaryStructuredAgentMarkdownContent(structured = null) {
  if (!structured) return ''
  const primarySection = structured.sections?.find((section) =>
    ['正文', '回答', '回复', '文本'].includes(section?.title) &&
    !section?.code &&
    Array.isArray(section?.items) &&
    section.items.length === 1
  )
  const primaryText = String(primarySection?.items?.[0] || '').trim()
  if (!primaryText || !markdownAgentMessageContent(primaryText)) return ''
  return [
    structured.title ? `# ${structured.title}` : '',
    structured.summary || '',
    primaryText
  ].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function isLocalSkillRoutingNotice(message = {}) {
  const content = String(message?.content ?? '').trim()
  return messageRole(message) === 'assistant' &&
    /^Using [`'"]?[\w-]+[`'"]? because this is /i.test(content)
}

function isTruncatedWorkflowJsonFragment(content = '') {
  const text = String(content || '').trim()
  if (!text) return false
  if (/^(CH"|ATCH"|TH"|H"|",|\},|\],)/.test(text)) return true
  if (/(api\/staff\/orders|PICKUP_CODE_INVALID|quality Report|missing information)/.test(text) && !/^\s*(\{|\[|#|[\u4e00-\u9fa5])/.test(text)) return true
  return false
}

function isWorkflowAnalysisLegacyPlaceholder(message = {}) {
  const meta = messageMeta(message)
  const content = String(message?.content ?? '').trim()
  if (messageRole(message) !== 'assistant') return false
  if (meta.placeholderOnly && !content) return !isMessageBusy(message)
  if (meta.action === 'workflow-analysis-result' && isMessageBusy(message)) return false
  if (meta.action !== 'workflow-analysis-result') return false
  if (isTruncatedWorkflowJsonFragment(content)) return true
  return /正在把你的需求发送给模型|收到首段输出后会直接展示模型原文|正在连接模型，收到内容后会边生成边展示|正在连接模型|正在生成 Agent 回复|正在等待模型首段输出|模型正在输出内容，完成后会自动整理成画布节点/.test(content)
}

function sanitizeAgentMessageDisplayContent(content = '') {
  let value = String(content || '').trim()
  if (!value) return ''
  // Unified chat rendering only shows user/model business content; internal routing/tool preambles stay hidden.
  value = value
    .replace(/^我会先按会话规则加载必要的 [`'"]?using-superpowers[`'"]? skill，然后直接产出你要求的 JSON。[ \t\n]*/i, '')
    .replace(/^我会先按会话规则加载必要的 [`'"]?using-superpowers[`'"]? skill，然后[^\n。]*。[ \t\n]*/i, '')
    .replace(/^Using [^\n]+ skill[^\n]*\n+/i, '')
    .replace(/\n(?:[ \t]*\n){2,}/g, '\n\n')
  return value.trim()
}

function normalizeAgentMarkdownText(content = '') {
  return normalizeAgentReadableLongText(sanitizeAgentMessageDisplayContent(content))
    .replace(/\s+(#{2,3})\s+/g, '\n\n$1 ')
    .replace(/\s+(#{1})\s+/g, '\n\n$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeAgentReadableLongText(content = '') {
  const source = String(content || '').trim()
  if (!source || source.includes('\n')) return source
  return source
    .replace(/\s+(项目事实|引用资料|模型推断|建议|风险|取舍|确认点)[：:]\s*/g, '\n\n$1：')
    .replace(/\s+(方案\s*[A-Z一二三四五六][「『])/g, '\n\n$1')
}

function isMarkdownTableDivider(line = '') {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''))
}

function splitMarkdownTableRow(line = '') {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseMarkdownTableBlock(lines = [], startIndex = 0) {
  const headerLine = lines[startIndex]
  const dividerLine = lines[startIndex + 1]
  if (!/\|/.test(String(headerLine || '')) || !isMarkdownTableDivider(dividerLine)) return null
  const headers = splitMarkdownTableRow(headerLine)
  if (headers.length < 2 || headers.some((cell) => !cell)) return null
  const rows = []
  let index = startIndex + 2
  while (index < lines.length && /\|/.test(String(lines[index] || '').trim())) {
    const row = splitMarkdownTableRow(lines[index])
    if (row.length < 2) break
    while (row.length < headers.length) row.push('')
    rows.push(row.slice(0, headers.length))
    index += 1
  }
  return rows.length ? { table: { headers, rows }, nextIndex: index } : null
}

function markdownBlocksPlainText(blocks = []) {
  return blocks.map((block) => {
    if (block?.type === 'page-layout-section') {
      const title = String(block.title || '').trim()
      const body = block.kind === 'wireframe'
        ? String(block.text || '').trim()
        : markdownBlocksPlainText(block.blocks || [])
      return [title ? `## ${title}` : '', body].filter(Boolean).join('\n')
    }
    if (block?.type === 'ul') return block.items.map((item) => `- ${item}`).join('\n')
    if (block?.type === 'pre') return block.text || ''
    if (block?.type === 'code') return `\`\`\`${block.language || ''}\n${block.text || ''}\n\`\`\``
    if (block?.type === 'table') {
      const headers = block.table?.headers || []
      const rows = block.table?.rows || []
      const divider = headers.map(() => '---')
      return [headers, divider, ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n')
    }
    const prefix = block?.type === 'h1' ? '# ' : block?.type === 'h2' ? '## ' : block?.type === 'h3' ? '### ' : ''
    return `${prefix}${block?.text || ''}`.trim()
  }).filter(Boolean).join('\n\n')
}

function markdownHeadingCardTitle(block = {}) {
  const text = String(block?.text || '').trim()
  if (!text) return '文本'
  if (/结构树|信息架构树|页面结构树|产品结构树/.test(text)) return '结构树'
  if (/框架层|产品框架|页面框架|业务框架|功能框架/.test(text)) return '框架层'
  if (/页面骨架|线框|低保真|布局|输出框架|wireframe/i.test(text)) return '页面骨架'
  if (markdownHeadingLooksLikePageTitle(text)) return '页面骨架'
  return displayCardTitle(text.replace(/^[一二三四五六七八九十]+[、.．]\s*/, ''))
}

function markdownHeadingLooksLikePageTitle(text = '') {
  const value = String(text || '').trim().replace(/^[一二三四五六七八九十]+[、.．]\s*/, '')
  if (!value || /建议|风险|待确认|结论|说明|摘要|背景/.test(value)) return false
  return /(购物车页|订单确认页|订单页|确认页|结算页|支付页|商品详情页|商品列表页|首页|个人中心页|我的页面|登录页|注册页|页面|页)$/.test(value)
}

function layoutSignalScore(text = '') {
  const value = String(text || '')
  const layoutSignals = [
    /顶部|顶栏|导航|门店|营业状态|定位|搜索/,
    /左侧|右侧|分栏|分类导航|分类栏|侧栏|列表|卡片|内容区|滚动|商品/,
    /底部|Tab|标签栏|结算|按钮|操作栏|工具栏/,
    /浮层|悬浮|购物车|弹窗|遮罩|抽屉/,
    /空状态|加载|失败|异常|无数据|未选|非营业|暂停接单/,
    /选择|确认|提交|下单|支付|编辑|删除|重新定位|手动搜索/
  ]
  return layoutSignals.filter((pattern) => pattern.test(value)).length
}

function textLooksLikeWireframeBoxes(text = '') {
  const value = String(text || '')
  return /(┌|┐|└|┘|╭|╮|╰|╯)/.test(value) ||
    (/[│|].{2,}[│|]/.test(value) && /[─━-]{4,}/.test(value))
}

function textLooksLikePageLayoutWireframe(text = '') {
  const value = String(text || '')
  if (!textLooksLikeWireframeBoxes(value)) return false
  const hasContainerCorners = /(┌|╭).*(┐|╮)/s.test(value) && /(└|╰).*(┘|╯)/s.test(value)
  const hasPageRegions = /顶部|顶栏|导航|Header|主体|内容区|滚动|scroll|底部|Tab|操作栏|悬浮|弹窗|遮罩|固定区/.test(value)
  const hasRegionSeparators = (value.match(/├|┬|┴|┼/g) || []).length >= 1
  const hasFlowArrows = /-->|<--|-{3,}>|<-{3,}|=>/.test(value)
  return hasContainerCorners && hasPageRegions && hasRegionSeparators && !hasFlowArrows
}

function markdownBlocksHaveLayoutEvidence(blocks = [], title = '') {
  // 只因为标题叫“购物车页/订单页/页面”还不够，必须有布局证据才升级为页面骨架。
  // 这样普通 PRD 正文保持无框展示，页面骨架/框架层才进入带框线框图。
  const text = [title, markdownBlocksPlainText(blocks)].filter(Boolean).join('\n')
  if (textLooksLikeWireframeBoxes(text) || treeTextLooksLikePageLayout(text)) return true
  if (textLooksLikeImplicitPageLayoutArtifact(text, title)) return true
  const score = layoutSignalScore(text)
  if (/页面骨架|页面框架|页面总框架|输出框架|线框|低保真|布局/.test(text) && score >= 1) return true
  return score >= 3
}

function textLooksLikeImplicitPageLayoutArtifact(text = '', title = '') {
  const value = String(text || '')
  const titleText = String(title || '')
  const hasExplicitLayoutSection = /关键页面与页面布局线框图|页面布局线框图|页面布局线框|页面线框图|页面布局图|ASCII\s*页面线框|ASCII\s*Wireframe/i.test(`${titleText}\n${value}`)
  if (!hasExplicitLayoutSection) return false
  const hasPageList = /(^|\n)\s*(?:#{1,3}\s*)?\d+[.、]\s*[^。\n]*(首页|门店|菜单|商品|购物车|订单|支付|结算|弹窗|详情|页面|页)/.test(value)
  const hasWireframe = textLooksLikeWireframeBoxes(value) || /[|│].*(顶部|主体|底部|导航|按钮|输入框|图片|卡片|弹窗|列表|滚动)/.test(value)
  return hasPageList && hasWireframe && layoutSignalScore(value) >= 3
}

function markdownBlocksLookLikePageFramework(blocks = [], title = '') {
  const validBlocks = Array.isArray(blocks) ? blocks : []
  const headings = validBlocks.filter((block) => ['h1', 'h2', 'h3'].includes(block?.type) && markdownHeadingLooksLikePageTitle(block.text))
  const hasPageTitle = headings.length >= 1 || markdownHeadingLooksLikePageTitle(title)
  const listCount = validBlocks.filter((block) => block?.type === 'ul' && Array.isArray(block.items) && block.items.length >= 2).length
  const genericHeadings = validBlocks.filter((block) => ['h1', 'h2', 'h3'].includes(block?.type) && /建议|风险|待确认|结论/.test(String(block.text || '')))
  return hasPageTitle && listCount >= 1 && genericHeadings.length === 0 && markdownBlocksHaveLayoutEvidence(blocks, title)
}

function markdownBlocksToFrameText(blocks = [], title = '文本') {
  const sourceText = markdownBlocksPlainText(blocks)
  // 模型已经给出纯文本线框时优先原样保留；只有树状页面布局才走兜底线框转换。
  if (textLooksLikeWireframeBoxes(sourceText) && textLooksLikePageLayoutWireframe(sourceText)) return sourceText
  if (treeTextLooksLikePageLayout(sourceText) || (/页面骨架|页面框架|页面总框架|输出框架|线框|低保真/.test(String(title || '')) && markdownBlocksHaveLayoutEvidence(blocks, title))) return pageLayoutTreeToWireframeText(sourceText, title)
  const lines = []
  const cleanHeading = (value = '') => String(value || '').trim().replace(/^[一二三四五六七八九十]+[、.．]\s*/, '')
  ;(Array.isArray(blocks) ? blocks : []).forEach((block) => {
    if (['h1', 'h2', 'h3'].includes(block?.type)) {
      const heading = cleanHeading(block.text)
      if (heading) {
        if (lines.length) lines.push('')
        lines.push(heading)
      }
      return
    }
    if (block?.type === 'ul') {
      const items = Array.isArray(block.items) ? block.items.map((item) => String(item || '').trim()).filter(Boolean) : []
      items.forEach((item, index) => {
        lines.push(`${index === items.length - 1 ? '└─' : '├─'} ${item}`)
      })
      return
    }
    if (block?.type === 'code' || block?.type === 'pre') {
      const text = String(block.text || '').trim()
      if (text) lines.push(text)
      return
    }
    const text = String(block?.text || '').trim()
    if (text) lines.push(text)
  })
  if (!lines.length && sourceText) return sourceText
  const titleText = displayCardTitle(title)
  return lines.length ? lines.join('\n') : titleText
}

function treeTextLooksLikePageLayout(text = '') {
  const value = String(text || '')
  if (!/(├|└|│|─)/.test(value)) return false
  const score = layoutSignalScore(value)
  if (/页面骨架|页面框架|页面总框架|输出框架|线框|低保真|布局/.test(value)) return score >= 1
  return score >= 3
}

function pageLayoutTreeToWireframeText(text = '', title = '页面骨架') {
  const value = String(text || '').trim()
  if (!value) return ''
  const cleanLine = (line = '') => String(line || '')
    .replace(/[│├└─]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lines = value.split(/\r?\n/).map(cleanLine).filter((line) =>
    line && !/^(页面骨架|页面框架|页面总框架|输出框架|布局图|线框图)$/.test(line)
  )
  const pick = (patterns, fallback) => {
    const found = lines.find((line) => patterns.some((pattern) => pattern.test(line)))
    return found || fallback
  }
  const top = pick([/顶部|顶栏|导航|门店|营业状态/], '顶部导航 / 门店状态')
  const left = pick([/左侧|分类导航|侧栏/], '左侧分类导航')
  const right = pick([/右侧|商品列表|商品卡片|内容区|滚动/], '右侧商品列表 / 商品卡片')
  const floating = pick([/浮层|悬浮|购物车|合计|去结算/], '购物车浮层 / 合计 / 去结算')
  const state = pick([/空状态|加载失败|未选门店|非营业|异常/], '空状态 / 加载失败 / 非营业提示')
  const titleText = displayCardTitle(title)
  const hasSideBySideLayout = /左侧|右侧|分栏|分类导航|分类栏|侧栏/.test(value)
  const renderSideBySideWireframe = () => [
    '页面线框兜底：顶部固定导航 + 主体内容区 + 底部固定操作',
    `${titleText}：顶部导航 + 左右分栏主体 + 购物车浮层 + 异常状态`,
    '',
    '┌────────────────────────────┐',
    `│ ${top}`,
    '├──────────┬─────────────────┤',
    `│ ${left}`,
    `│          │ ${right}`,
    '├──────────┴─────────────────┤',
    `│ ${floating}`,
    '├────────────────────────────┤',
    `│ ${state}`,
    '└────────────────────────────┘'
  ].join('\n')
  const renderStackedWireframe = () => {
    const modules = lines
      .filter((line) => !/^[一二三四五六七八九十]+[、.．]/.test(line))
      .slice(0, 7)
    const visibleModules = modules.length ? modules : ['顶部导航 / 搜索', '核心内容列表', '主要操作区', '异常与空状态']
    return [
      '页面线框兜底：顶部固定导航 + 主体内容区 + 底部固定操作',
      `${titleText}：按页面从上到下组织信息区、操作区和状态区`,
      '',
      '┌────────────────────────────┐',
      ...visibleModules.map((line, index) => [
        `│ ${line}`,
        index === visibleModules.length - 1 ? '' : '├────────────────────────────┤'
      ]).flat().filter(Boolean),
      '└────────────────────────────┘'
    ].join('\n')
  }
  if (hasSideBySideLayout) return renderSideBySideWireframe()
  return renderStackedWireframe()
}

function framedMarkdownBlocks(blocks = [], title = '文本') {
  const text = markdownBlocksToFrameText(blocks, title)
  return text ? [{ type: 'pre', text }] : blocks
}

function markdownBlocksShouldUseFrame(blocks = [], title = '') {
  const text = markdownBlocksPlainText(blocks)
  const titleText = String(title || '').trim()
  if (isAdvancedUxMarkdownReportTitle(titleText)) return false
  const explicitTreeOrFrameworkTitle = /结构树|信息架构树|页面结构树|产品结构树|框架层|页面框架|产品框架/.test(titleText)
  const explicitPageSkeletonTitle = /页面骨架|线框|低保真/.test(titleText)
  return explicitTreeOrFrameworkTitle ||
    textLooksLikeWireframeBoxes(text) ||
    treeTextLooksLikePageLayout(text) ||
    (explicitPageSkeletonTitle && markdownBlocksHaveLayoutEvidence(blocks, titleText)) ||
    markdownBlocksLookLikePageFramework(blocks, titleText) ||
    /^\s*[|｜].+[|｜]\s*$/m.test(text)
}

function isAdvancedUxMarkdownReportTitle(titleText = '') {
  return /高级\s*UX\s*需求分析|高级UX需求分析|原始需求分析|设计问题定义|用户与场景|整体交互链路|三套设计方案|异常流补充|推荐方案建议|需求理解|需求拆解|风险假设|流程与信息架构|机会与方案|优先级与分期|交付与验收/.test(String(titleText || '').trim())
}

function markdownBlocksShouldUsePageLayoutArtifact(blocks = [], title = '') {
  const text = markdownBlocksPlainText(blocks)
  const titleText = String(title || '').trim()
  if (isAdvancedUxMarkdownReportTitle(titleText)) return false
  if (/结构树|信息架构树|页面结构树|产品结构树/.test(titleText)) return false
  return (isPageLayoutArtifactKind(titleText) || textLooksLikeImplicitPageLayoutArtifact(text, titleText)) && markdownBlocksHaveLayoutEvidence(blocks, titleText)
}

function pageLayoutParagraphsToWireframeText(text = '', title = '页面骨架') {
  const source = String(text || '').trim()
  if (!source) return ''
  const normalizedLines = source
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
  const joined = normalizedLines.join('\n')
  const pageChunks = []
  const pagePattern = /(?:^|\n)\s*(\d+)[.、]\s*([^\n]+)([\s\S]*?)(?=\n\s*\d+[.、]\s*[^\n]+|$)/g
  let match
  while ((match = pagePattern.exec(joined))) {
    const heading = `${match[1]}. ${String(match[2] || '').trim()}`
    const body = String(match[3] || '').trim()
    pageChunks.push({ heading, body })
  }
  const pages = pageChunks.length
    ? pageChunks
    : normalizedLines.slice(0, 6).map((line, index) => ({ heading: `${index + 1}. ${line}`, body: '' }))
  const visiblePages = pages.slice(0, 6)
  const pageRows = visiblePages.map((page) => {
    const goal = (page.body.match(/页面目标[:：]\s*([^\n]+)/) || [])[1] || ''
    const content = (page.body.match(/核心内容[:：]\s*([^\n]+)/) || [])[1] || ''
    const state = (page.body.match(/(?:关键状态|交互建议|关键能力)[:：]\s*([^\n]+)/) || [])[1] || ''
    const detail = [goal, content, state].map((item) => String(item || '').trim()).filter(Boolean).join('；')
    return `│ ${page.heading}${detail ? `：${detail}` : ''}`
  })
  return [
    '页面线框兜底：顶部固定导航 + 主体内容区 + 底部固定操作',
    `${displayCardTitle(title || '页面骨架')}：页面顺序 + 布局位置 + 关键交互`,
    '┌────────────────────────────────────────────────────────┐',
    '│ 页面框架总览：顶部入口 / 主体内容 / 底部操作 / 弹窗状态       │',
    '├────────────────────────────────────────────────────────┤',
    ...pageRows,
    '├────────────────────────────────────────────────────────┤',
    '│ 交互区：按钮、输入框、图片、卡片、滚动、弹窗、异常状态         │',
    '├────────────────────────────────────────────────────────┤',
    '│ 交付区：前端负责布局交互状态；后端负责接口字段错误码数据       │',
    '└────────────────────────────────────────────────────────┘'
  ].join('\n')
}

function pageLayoutArtifactWireframeText(text = '', title = '页面骨架') {
  const body = String(text || '').trim()
  if (!body) return ''
  if (textLooksLikeWireframeBoxes(body) && textLooksLikePageLayoutWireframe(body)) return body
  if (treeTextLooksLikePageLayout(body)) return pageLayoutTreeToWireframeText(body, title)
  return pageLayoutParagraphsToWireframeText(body, title)
}

function pageLayoutArtifactSectionKind(title = '', body = '') {
  const text = `${title}\n${body}`
  if (/ASCII|页面线框|线框图|框架图|wireframe/i.test(text) || textLooksLikePageLayoutWireframe(body)) return 'wireframe'
  if (/模型推荐|推荐方案|布局建议|方案/i.test(title)) return 'recommendation'
  if (/模块交互|交互明细|交互说明|控件/i.test(title)) return 'interaction'
  if (/前后端|交付|联调|接口/i.test(title)) return 'handoff'
  return 'text'
}

function pageLayoutArtifactStructuredBlocks(text = '', title = '页面骨架') {
  const body = String(text || '').trim()
  if (!body) return []
  const sectionPattern = /(^|\n)##\s+([^\n]+)\n([\s\S]*?)(?=\n##\s+[^\n]+\n|$)/g
  const sections = []
  let match
  while ((match = sectionPattern.exec(body))) {
    const sectionTitle = String(match[2] || '').trim()
    const sectionBody = String(match[3] || '').trim()
    if (!sectionTitle && !sectionBody) continue
    const kind = pageLayoutArtifactSectionKind(sectionTitle, sectionBody)
    sections.push({
      type: 'page-layout-section',
      title: sectionTitle || '页面内容',
      kind,
      text: kind === 'wireframe' ? sectionBody : '',
      blocks: kind === 'wireframe' ? [] : agentMarkdownRenderableBlocks(sectionBody)
    })
  }
  if (sections.length) return sections
  const kind = pageLayoutArtifactSectionKind(title, body)
  return [{
    type: 'page-layout-section',
    title: kind === 'wireframe' ? 'ASCII 页面线框图' : displayCardTitle(title || '页面骨架'),
    kind,
    text: kind === 'wireframe' ? body : '',
    blocks: kind === 'wireframe' ? [] : agentMarkdownRenderableBlocks(body)
  }]
}

function pageLayoutArtifactSegment(title = '页面骨架', text = '') {
  const body = String(text || '').trim()
  if (!body) return null
  const wireframeText = pageLayoutArtifactWireframeText(body, title)
  return {
    type: 'page-layout-artifact',
    title: displayCardTitle(title || '页面骨架'),
    blocks: pageLayoutArtifactStructuredBlocks(wireframeText || body, title)
  }
}

function normalizePageLayoutArtifactMarkers(content = '') {
  return String(content || '')
    .replace(/(^|\n)\s*\.\.\.\s*page-layout-artifact/g, '$1:::page-layout-artifact')
    .replace(/(^|\n)\s*…\s*page-layout-artifact/g, '$1:::page-layout-artifact')
}

function agentMarkdownContentCards(blocks = []) {
  const segments = []
  let markdownBlocks = []
  let markdownTitle = '文本'
  const flushMarkdown = () => {
    if (markdownBlocks.length) {
      const shouldUseFrame = markdownBlocksShouldUseFrame(markdownBlocks, markdownTitle)
      const isPageLayoutArtifact = shouldUseFrame && markdownBlocksShouldUsePageLayoutArtifact(markdownBlocks, markdownTitle)
      const frameText = shouldUseFrame ? markdownBlocksToFrameText(markdownBlocks, markdownTitle) : ''
      segments.push({
        type: isPageLayoutArtifact ? 'page-layout-artifact' : shouldUseFrame ? 'frame' : 'markdown',
        title: markdownTitle,
        blocks: isPageLayoutArtifact
          ? [{ type: 'pre', text: frameText }]
          : shouldUseFrame
            ? (frameText ? [{ type: 'pre', text: frameText }] : markdownBlocks)
            : markdownBlocks
      })
    }
    markdownBlocks = []
  }
  ;(Array.isArray(blocks) ? blocks : []).forEach((block) => {
    if (block?.type === 'table') {
      flushMarkdown()
      segments.push({ type: 'table', table: block.table })
      return
    }
    if (block?.type === 'code' && isPlainTextAgentCodeLanguage(block.language)) {
      markdownBlocks.push({ type: 'p', text: block.text || '' })
      return
    }
    if (block?.type === 'code') {
      flushMarkdown()
      segments.push({ type: 'code', text: block.text || '', language: block.language || 'code' })
      return
    }
    if (block?.type === 'h1') {
      flushMarkdown()
      markdownTitle = markdownHeadingCardTitle(block)
      return
    }
    if (block?.type === 'h2') {
      flushMarkdown()
      markdownTitle = markdownHeadingCardTitle(block)
      return
    }
    if (block?.type === 'h3' && markdownTitle === '文本') {
      markdownTitle = markdownHeadingCardTitle(block)
    }
    const hasContent = Array.isArray(block?.items)
      ? block.items.map((item) => String(item || '').trim()).filter(Boolean).length > 0
      : String(block?.text || '').trim().length > 0
    if (hasContent) markdownBlocks.push(block)
  })
  flushMarkdown()
  return segments
}

function titledMarkdownSegment(title = '文本', content = '') {
  const blocks = agentMarkdownRenderableBlocks(content)
  return blocks.length ? [{ type: 'markdown', title: displayCardTitle(title), blocks }] : []
}

function isAdvancedUxMarkdownReportMessage(message = {}) {
  const meta = messageMeta(message)
  if (
    meta.action === 'advanced-ux-markdown-report' ||
    String(meta.artifactType || '').trim() === 'requirements-markdown'
  ) {
    const hasMarkdown = Boolean(String(meta.markdown || '').trim())
    const reportStatus = String(meta.reportStatus || meta.status || '').trim()
    const isFailedReport = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
    return hasMarkdown || isFailedReport
  }
  return false
}

function isAdvancedUxPageInteractionDocumentMessage(message = {}) {
  return messageMeta(message).action === 'advanced-ux-page-interaction-document'
}

const ADVANCED_UX_GENERIC_FAILURE_REASON = '模型调用未生成可导入的高级 UX Markdown。请重新生成。'

function isAdvancedUxInternalRuntimeNoise(text = '') {
  return /codex_core_plugins|plugin catalog|401 Unauthorized|find_thread_path_by_id_str|\.codex\/\.tmp\/plugins|thread in cwd|WARN\s|DEBUG\s|INFO\s|startup warning|failed to load plugin/i.test(String(text || ''))
}

function sanitizeAdvancedUxFailureReason(reason = '') {
  const text = String(reason || '').trim()
  if (!text) return ''
  if (isAdvancedUxInternalRuntimeNoise(text)) return ADVANCED_UX_GENERIC_FAILURE_REASON
  return text
}

function advancedUxMarkdownReportSegments(message = {}) {
  const meta = messageMeta(message)
  const hasMarkdown = Boolean(String(meta.markdown || '').trim())
  const fileName = String(meta.fileName || '高级 UX 需求分析.md').trim()
  const reportStatus = String(meta.reportStatus || meta.status || '').trim()
  const isFailedReport = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
  const issueText = sanitizeAdvancedUxFailureReason(meta.importError || message.content || '')
  const drawioArtifacts = Array.isArray(meta.drawioArtifacts)
    ? meta.drawioArtifacts.filter((artifact) => artifact?.content)
    : []
  const lowFiWireframeArtifacts = Array.isArray(meta.lowFiWireframeArtifacts)
      ? meta.lowFiWireframeArtifacts.filter((artifact) => artifact?.imageDataUrl || artifact?.imageUrl)
      : []
  const text = [
    hasMarkdown
      ? (isFailedReport
      ? `高级 UX Markdown 文件已生成，但未通过质量门禁：${fileName}`
      : `高级 UX Markdown 文件已生成：${fileName}`)
      : `未生成可导入的高级 UX Markdown 文件：${fileName}`,
    isFailedReport && issueText ? `门禁原因：${issueText}` : '',
    isFailedReport ? '暂未导入需求分析画布，请修复或重新生成后再导入。' : '',
    !isFailedReport && drawioArtifacts.length
      ? `Draw.io 文件已生成：${drawioArtifacts.map((artifact) => artifact.fileName || artifact.label || 'Draw.io 文件').join('、')}`
      : '',
    !isFailedReport && lowFiWireframeArtifacts.length
      ? `低保真线框图已生成：${lowFiWireframeArtifacts.map((artifact) => artifact.fileName || artifact.pageName || '低保真线框图').join('、')}`
      : '',
    !isFailedReport ? '已自动导入需求分析画布，可从文件产物或节点详情查看。' : ''
  ].filter(Boolean).join('\n\n')
  const segments = [{
    markdown: hasMarkdown ? String(meta.markdown || '').trim() : '',
    type: 'advanced-ux-file',
    title: 'Markdown 文件',
    fileName,
    summary: text
  }]
  drawioArtifacts.forEach((artifact) => {
    segments.push({
      type: 'advanced-ux-drawio-file',
      fileName: artifact.fileName || 'diagram.drawio',
      content: String(artifact.content || '').trim(),
      summary: `${artifact.label || 'Draw.io 文件'}已生成，可下载后用 diagrams.net 打开。`
    })
  })
  lowFiWireframeArtifacts.forEach((artifact) => {
    segments.push({
      type: 'advanced-ux-lowfi-image',
      fileName: artifact.fileName || `${artifact.pageId || '页面'}-低保真线框图.png`,
      pageId: artifact.pageId || '',
      pageName: artifact.pageName || '',
      status: artifact.status || 'generated',
      imageDataUrl: artifact.imageDataUrl,
      imageUrl: artifact.imageUrl,
      provider: artifact.provider || '',
      model: artifact.model || '',
      validation: artifact.validation || null,
      summary: `${artifact.pageId || ''} ${artifact.pageName || '页面'}低保真线框图已生成。`.trim()
    })
  })
  return segments
}

function advancedUxPageInteractionDocumentSegments(message = {}) {
  const meta = messageMeta(message)
  const fileName = String(meta.fileName || '页面交互框架与说明.md').trim()
  return [{
    markdown: String(meta.markdown || '').trim(),
    type: 'advanced-ux-file',
    title: '页面交互文档',
    fileName,
    summary: `页面交互文档已生成：${fileName}\n\n已导入交互低保画布，可从页面节点详情查看对应页面框架、交互规则和异常状态。`
  }]
}

function tableSegmentIsRenderable(segment = {}) {
  const headers = Array.isArray(segment?.table?.headers) ? segment.table.headers.filter((item) => String(item || '').trim()) : []
  const rows = Array.isArray(segment?.table?.rows) ? segment.table.rows : []
  return headers.length >= 2 && rows.length >= 1 && rows.some((row) =>
    Array.isArray(row) &&
    row.slice(0, headers.length).some((cell) => String(cell || '').trim())
  )
}

function segmentIsRenderable(segment = {}) {
  if (segment?.type === 'table') return tableSegmentIsRenderable(segment)
  if (segment?.type === 'code') return Boolean(String(segment?.text || '').trim())
  if (segment?.type === 'advanced-ux-file') return Boolean(String(segment?.fileName || segment?.markdown || segment?.summary || '').trim())
  if (segment?.type === 'advanced-ux-lowfi-image') return Boolean(String(segment?.imageDataUrl || segment?.imageUrl || '').trim())
  if (segment?.type === 'page-layout-artifact') return Array.isArray(segment?.blocks) && segment.blocks.some((block) => {
    if (Array.isArray(block?.items)) return block.items.some((item) => String(item || '').trim())
    return Boolean(String(block?.text || '').trim())
  })
  if (segment?.type === 'frame') return Array.isArray(segment?.blocks) && segment.blocks.some((block) => {
    if (Array.isArray(block?.items)) return block.items.some((item) => String(item || '').trim())
    return Boolean(String(block?.text || '').trim())
  })
  if (segment?.type === 'markdown') {
    return Array.isArray(segment?.blocks) && segment.blocks.some((block) => {
      if (Array.isArray(block?.items)) return block.items.some((item) => String(item || '').trim())
      if (block?.type === 'table') return tableSegmentIsRenderable(block)
      if (block?.type === 'code') return Boolean(String(block?.text || '').trim())
      return Boolean(String(block?.text || '').trim())
    })
  }
  return false
}

function hasRenderableAgentSegments(segments = []) {
  return Array.isArray(segments) && segments.some((segment) => segmentIsRenderable(segment))
}

function structuredContentSegments(structured = null) {
  if (!structured) return []
  const segments = []
  const introLines = []
  if (structured.title) introLines.push(`# ${structured.title}`)
  if (structured.summary) introLines.push(structured.summary)
  if (introLines.length) segments.push(...titledMarkdownSegment('文本', introLines.join('\n\n')))
  ;(Array.isArray(structured.sections) ? structured.sections : []).forEach((section) => {
    const sectionTitle = displayCardTitle(section?.title || '文本')
    const sectionLines = []
    if (shouldShowStructuredSectionTitle(section)) sectionLines.push(`## ${sectionTitle}`)
    if (section?.summary) sectionLines.push(String(section.summary).trim())
    if (Array.isArray(section?.items) && section.items.length) {
      sectionLines.push(...section.items.map((item) => `- ${item}`))
    }
    if (sectionLines.length) segments.push(...titledMarkdownSegment(sectionTitle, sectionLines.join('\n\n')))
    if (section?.frameText) {
      if (isPageLayoutArtifactKind(section.frameKind || sectionTitle)) {
        const artifactSegment = pageLayoutArtifactSegment(section.frameKind || sectionTitle, section.frameText)
        if (artifactSegment) segments.push(artifactSegment)
      } else {
        segments.push({
          type: 'frame',
          title: section.frameKind || sectionTitle,
          blocks: [{ type: 'pre', text: String(section.frameText || '').trim() }]
        })
      }
    }
    if (section?.markdown) {
      agentMarkdownContentCards(agentMarkdownRenderableBlocks(section.markdown)).forEach((segment) => {
        segments.push(['markdown', 'frame'].includes(segment.type) ? { ...segment, title: sectionTitle } : segment)
      })
    }
    if (section?.code) {
      segments.push({ type: 'code', language: section.codeLanguage || section.title || 'code', text: section.code })
    }
  })
  return segments
}

function structuredDisplayBlocks(message = {}) {
  const meta = messageMeta(message)
  const candidates = [
    meta.displayBlocks,
    meta.display_blocks,
    meta.modelDisplayBlocks,
    message?.displayBlocks,
    message?.display_blocks
  ]
  const parsed = extractStructuredAgentJson(message?.content)
  if (parsed) {
    candidates.push(parsed.displayBlocks, parsed.display_blocks)
  }
  return candidates.find((blocks) => Array.isArray(blocks)) || []
}

function displayBlockSegments(blocks = []) {
  // displayBlocks 是增强层，不替代原文；这里必须先做形状校验，非法块不能吞掉 rawContent。
  // 普通 markdown 继续走无框正文；页面布局成果统一转为 page-layout-artifact，结构树保留 frame。
  return (Array.isArray(blocks) ? blocks : []).flatMap((block) => {
    if (!isPlainRecord(block)) return []
    const type = String(block.type || block.kind || '').trim().toLowerCase()
    const title = displayCardTitle(block.title || block.name || type || '文本')
    const content = block.content ?? block.text ?? block.value ?? block.tree ?? block.framework ?? block.markdown ?? ''
    if (type === 'table' || block.table) {
      const table = block.table || block
      return tableSegmentIsRenderable({ type: 'table', table }) ? [{ type: 'table', table }] : []
    }
    if (/^(code|html|vue|json|css|javascript|typescript|js|ts)$/.test(type) || block.code) {
      const code = String(block.code ?? content ?? '').trim()
      return code ? [{ type: 'code', language: block.language || type || title || 'code', text: code }] : []
    }
    if (/^(tree|structure|structure_tree|framework|wireframe|page_skeleton|page_frame|layout|flowchart)$/.test(type) || structuredAgentFrameKind(type, title, content)) {
      const frameKind = structuredAgentFrameKind(type, title, content) || title
      const text = structuredAgentFrameText(content, frameKind)
      if (isPageLayoutArtifactKind(frameKind)) {
        const artifactSegment = pageLayoutArtifactSegment(frameKind, text)
        return artifactSegment ? [artifactSegment] : []
      }
      return text ? [{ type: 'frame', title: frameKind, blocks: [{ type: 'pre', text }] }] : []
    }
    const markdownText = String(content || '').trim()
    if (!markdownText) return []
    return agentMarkdownContentCards(agentMarkdownRenderableBlocks(markdownText))
  })
}

function pageLayoutArtifactSegments(content = '') {
  const text = normalizePageLayoutArtifactMarkers(content)
  if (!/:::\s*page-layout-artifact/.test(text)) return { text, segments: [] }
  const segments = []
  const remaining = []
  const pattern = /(^|\n):::\s*page-layout-artifact(?:\s+title=["']?([^"'\n]+)["']?)?\s*\n([\s\S]*?)\n:::/g
  let lastIndex = 0
  let match
  while ((match = pattern.exec(text))) {
    remaining.push(text.slice(lastIndex, match.index))
    const title = String(match[2] || '页面骨架').trim()
    const body = String(match[3] || '').trim()
    const artifactSegment = pageLayoutArtifactSegment(title || '页面骨架', body)
    if (artifactSegment) segments.push(artifactSegment)
    lastIndex = pattern.lastIndex
  }
  remaining.push(text.slice(lastIndex))
  if (segments.length) {
    return {
      text: '',
      segments
    }
  }
  return {
    text: remaining.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    segments
  }
}

function messagePageLayoutArtifact(message = {}) {
  if (messageRole(message) !== 'assistant') return null
  if (shouldSuppressActiveNodePageLayoutArtifactInAgent()) return null
  const metaArtifact = message?.meta?.pageLayoutArtifact
  if (metaArtifact && typeof metaArtifact === 'object' && !Array.isArray(metaArtifact)) return metaArtifact
  const activeNodeArtifact = props.activeNode?.pageLayoutArtifact
  return activeNodeArtifact && typeof activeNodeArtifact === 'object' && !Array.isArray(activeNodeArtifact)
    ? activeNodeArtifact
    : null
}

function pageLayoutArtifactMetaSegments(message = {}) {
  const artifact = messagePageLayoutArtifact(message)
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return []
  const body = [
    artifact.modelDecision ? `## 模型推荐方案\n${artifact.modelDecision}` : '',
    artifact.asciiWireframe ? `## ASCII 页面线框图\n${artifact.asciiWireframe}` : '',
    artifact.interactionDetails ? `## 模块交互明细\n${artifact.interactionDetails}` : '',
    Array.isArray(artifact.sections) && artifact.sections.length
      ? [
          '## 结构化明细',
          ...artifact.sections.map((section) => {
            const title = String(section?.title || '').trim()
            const items = Array.isArray(section?.items) ? section.items.map((item) => `- ${item}`).join('\n') : ''
            return [title ? `### ${title}` : '', items].filter(Boolean).join('\n')
          })
        ].join('\n')
      : ''
  ].filter(Boolean).join('\n\n')
  const segment = pageLayoutArtifactSegment(artifact.title || '页面骨架', body)
  return segment ? [segment] : []
}

function mergeRawFirstOverlaySegments(rawSegments = [], overlaySegments = [], rawText = '') {
  rawSegments = hasRenderableAgentSegments(rawSegments)
    ? rawSegments
    : titledMarkdownSegment('文本', rawText)
  if (!hasRenderableAgentSegments(overlaySegments)) return rawSegments
  return [...rawSegments, ...overlaySegments]
}

function looseHtmlAgentCodeSegments(content = '') {
  const text = normalizeAgentMarkdownText(content)
  if (!text || /(^|\n)```[\w+-]*/.test(text)) return []
  const lines = text.split(/\r?\n/)
  const looseHtmlStartPattern = new RegExp('^\\s*(?:<!doctype\\s+html\\b|<html\\b|<head\\b|<body\\b|<main\\b|<section\\b|<article\\b|<div\\b|<template\\b|<style\\b|<script\\b|<!--)', 'i')
  const startIndex = lines.findIndex((line) =>
    looseHtmlStartPattern.test(line)
  )
  if (startIndex < 0) return []
  const code = lines.slice(startIndex).join('\n').trim()
  if (!looseHtmlCodeLooksRenderable(code)) return []
  const intro = lines.slice(0, startIndex).join('\n').trim()
  return [
    ...titledMarkdownSegment('文本', intro),
    { type: 'code', language: 'html', text: code }
  ]
}

function looseHtmlCodeLooksRenderable(code = '') {
  const text = String(code || '').trim()
  if (!text) return false
  const htmlCommentPattern = new RegExp('<!--[\\s\\S]*-->')
  if (!/<[a-z][\w:-]*(?:\s[^>]*)?>/i.test(text) && !/<!doctype\s+html\b/i.test(text) && !htmlCommentPattern.test(text)) return false
  if (/<\/[a-z][\w:-]*>/i.test(text)) return true
  const htmlLikeLines = text.split(/\r?\n/).filter((line) => /^\s*<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i.test(line))
  return htmlLikeLines.length >= 3
}

function messageContentSegments(message = {}) {
  if (messageRole(message) !== 'assistant') return []
  if (isAdvancedUxMarkdownReportMessage(message)) return advancedUxMarkdownReportSegments(message)
  if (isAdvancedUxPageInteractionDocumentMessage(message)) return advancedUxPageInteractionDocumentSegments(message)
  const metaArtifactSegments = pageLayoutArtifactMetaSegments(message)
  const firstArtifactResult = pageLayoutArtifactSegments(rawFirstAgentMessageText(message))
  const fallbackArtifactResult = firstArtifactResult.segments.length
    ? firstArtifactResult
    : pageLayoutArtifactSegments(messageContent(message))
  const artifactResult = fallbackArtifactResult.segments.length ? fallbackArtifactResult : firstArtifactResult
  const text = artifactResult.text || messageContent(message)
  const rawText = text
  const overlaySegments = displayBlockSegments(structuredDisplayBlocks(message))
  if (metaArtifactSegments.length) {
    return [
      ...metaArtifactSegments,
      ...titledMarkdownSegment('说明', text),
      ...overlaySegments
    ]
  }
  const structured = messageStructuredContent(message)
  if (structured) {
    const rawSegments = structuredContentSegments(structured)
    return mergeRawFirstOverlaySegments(rawSegments, [...artifactResult.segments, ...overlaySegments], rawText)
  }
  const artifactAndOverlaySegments = [...artifactResult.segments, ...overlaySegments]
  if (!text && hasRenderableAgentSegments(artifactAndOverlaySegments)) return artifactAndOverlaySegments
  if (!text) return []
  const looseHtmlSegments = looseHtmlAgentCodeSegments(text)
  if (hasRenderableAgentSegments(looseHtmlSegments)) return mergeRawFirstOverlaySegments(looseHtmlSegments, artifactAndOverlaySegments, rawText)
  const blocks = agentMarkdownRenderableBlocks(text)
  const rawSegments = agentMarkdownContentCards(blocks).map((segment) =>
    segment.type === 'markdown' ? { ...segment, title: segment.title || '文本' } : segment
  )
  return mergeRawFirstOverlaySegments(rawSegments, artifactAndOverlaySegments, rawText)
}

function agentMarkdownRenderableBlocks(content = '', options = {}) {
  const parsedBlocks = markdownAgentMessageContent(content, options)
  if (parsedBlocks?.length) return parsedBlocks
  const text = normalizeAgentMarkdownText(content)
  return text ? [{ type: 'p', text }] : []
}

function markdownAgentMessageContent(content = '', options = {}) {
  const text = normalizeAgentMarkdownText(content)
  if (!/(^|\n)#{1,3}\s+\S/.test(text) && !/(^|\n)\s*(?:[-*]\s+\S|\d+[）)]\s*\S|·\s*\S|方案\s*[A-Z一二三四五六]|(?:项目事实|引用资料|模型推断|建议|风险|取舍|确认点)[：:])/.test(text) && !/(^|\n)```[\w+-]*/.test(text) && !/(^|\n)\s*\|.+\|\s*\n\s*\|?\s*:?-{3,}/.test(text)) return null
  const blocks = []
  const lines = text.split(/\r?\n/)
  let paragraph = []
  let listItems = []
  let codeLines = []
  let codeLanguage = ''
  let inCode = false
  const flushParagraph = () => {
    const value = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (value) blocks.push({ type: 'p', text: value })
    paragraph = []
  }
  const flushList = () => {
    if (listItems.length) blocks.push({ type: 'ul', items: listItems })
    listItems = []
  }
  const flushCode = () => {
    const value = codeLines.join('\n').trim()
    if (value) {
      if (isPlainTextAgentCodeLanguage(codeLanguage)) {
        if (options.preservePlainTextCode) {
          blocks.push({ type: 'pre', text: value })
          codeLines = []
          codeLanguage = ''
          return
        }
        blocks.push({ type: 'p', text: value })
        codeLines = []
        codeLanguage = ''
        return
      }
      blocks.push({ type: 'code', text: value, language: codeLanguageLabel(codeLanguage) })
    }
    codeLines = []
    codeLanguage = ''
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const raw = String(line || '')
    const codeFence = raw.trim().match(/^```([\w+-]*)/)
    if (codeFence) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        flushParagraph()
        flushList()
        codeLanguage = codeFence[1] || ''
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(raw)
      continue
    }
    const tableBlock = parseMarkdownTableBlock(lines, lineIndex)
    if (tableBlock) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'table', table: tableBlock.table })
      lineIndex = tableBlock.nextIndex - 1
      continue
    }
    const heading = raw.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: `h${heading[1].length}`, text: heading[2].trim() })
      continue
    }
    const schemeSection = raw.match(/^\s*(方案\s*[A-Z一二三四五六])\s*[「『]?([^」』：:]+)?[」』]?[：:]\s*(.*)$/)
    if (schemeSection) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h3', text: [schemeSection[1], schemeSection[2]].map((item) => String(item || '').trim()).filter(Boolean).join('｜') })
      if (String(schemeSection[3] || '').trim()) paragraph.push(schemeSection[3].trim())
      continue
    }
    const labeledSection = raw.match(/^\s*(项目事实|引用资料|模型推断|建议|风险|取舍|确认点)[：:]\s*(.+)$/)
    if (labeledSection) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h3', text: labeledSection[1].trim() })
      if (String(labeledSection[2] || '').trim()) paragraph.push(labeledSection[2].trim())
      continue
    }
    const numberedSection = raw.match(/^\s*(\d+)[）)]\s*(.+)$/)
    if (numberedSection) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h3', text: `${numberedSection[1]}）${numberedSection[2].trim()}` })
      continue
    }
    const list = raw.match(/^\s*[-*]\s+(.+)$/)
    if (list) {
      flushParagraph()
      listItems.push(list[1].trim())
      continue
    }
    const dotList = raw.match(/^\s*·\s*(.+)$/)
    if (dotList) {
      flushParagraph()
      listItems.push(dotList[1].trim())
      continue
    }
    if (!raw.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    paragraph.push(raw.trim())
  }
  if (inCode) flushCode()
  flushParagraph()
  flushList()
  return blocks.length ? blocks : null
}

function messageStructuredContent(message = {}) {
  if (messageRole(message) !== 'assistant') return null
  if (isLocalSkillRoutingNotice(message)) return null
  if (markdownAgentMessageContent(message?.content)) return null
  if (expandedProposalMessageContent(message)) return null
  if (compactWorkflowJsonMarkdownContent(message?.content)) return null
  const structured = formatStructuredAgentMessageContent(message?.content)
  if (primaryStructuredAgentMarkdownContent(structured)) return null
  const hasStructuredContent = Boolean(
    structured?.title ||
    structured?.summary ||
    (Array.isArray(structured?.sections) && structured.sections.some((section) =>
      section?.summary ||
      section?.frameText ||
      section?.code ||
      section?.markdown ||
      (Array.isArray(section?.items) && section.items.length)
    ))
  )
  if (!hasStructuredContent) return null
  return structured
}

function normalizeRawAgentMessageText(content = '') {
  const source = String(content || '').trim()
  if (!source) return ''
  const parsed = extractStructuredAgentJson(source)
  if (!parsed) return source
  const displayKeys = ['displayContent', 'reply', 'content', 'markdown', 'text', 'answer', 'message']
  for (const key of displayKeys) {
    const value = parsed[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2)
  }
  return source
}

function rawFirstAgentMessageText(message = {}) {
  const meta = messageMeta(message)
  const parsed = extractStructuredAgentJson(message?.content)
  const rawContent = String(
    meta.rawContent ??
    meta.raw_content ??
    message?.rawContent ??
    message?.raw_content ??
    parsed?.rawContent ??
    parsed?.raw_content ??
    ''
  ).trim()
  const parsedContent = String(meta.modelParsedContent || meta.parsedContent || '').trim()
  return sanitizeAgentMessageDisplayContent(normalizeRawAgentMessageText(rawContent) || normalizeRawAgentMessageText(parsedContent))
}

function messageContent(message) {
  if (isLocalSkillRoutingNotice(message)) return ''
  const rawText = rawFirstAgentMessageText(message)
  return sanitizeAgentMessageDisplayContent(expandedProposalMessageContent(message) || rawText || compactWorkflowJsonMarkdownContent(message?.content) || primaryStructuredAgentMarkdownContent(formatStructuredAgentMessageContent(message?.content)) || structuredAgentPlainText(formatStructuredAgentMessageContent(message?.content)) || normalizeRawAgentMessageText(message?.content) || String(message?.content ?? ''))
}

function isLegacyPlaceholderAgentMessage(message = {}) {
  const content = messageContent(message)
  return messageRole(message) === 'assistant' && (
    isLocalSkillRoutingNotice(message) ||
    isWorkflowAnalysisLegacyPlaceholder(message) ||
    /补充信息已接收/.test(content) ||
    /已把[\s\S]*写入当前小画板上下文/.test(content) ||
    /^我们只讨论「[\s\S]+?」/.test(content) ||
    /^我们先回答[\s\S]+?。/.test(content)
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
  if (messageMeta(message).hideStatus) return []
  if (isMessageBusy(message)) return []
  const items = []
  const status = messageStatus(message)
  if (status === 'success') return []
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
  const knowledgeCount = !messageEvidencePack(message) ? messageKnowledgeItems(message).length : 0
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

function handlePrimaryAction() {
  if (props.sending) {
    emit('stop-generating')
    return
  }
  if (canSubmitComposer()) emit('send')
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
  scrollElementToBottom(el, behavior)
  scrollParentContainersToBottom(el, behavior)
  scrollWindowToBottom(behavior)
  requestAnimationFrame(() => {
    scrollElementToBottom(chatListRef.value, behavior)
    scrollParentContainersToBottom(chatListRef.value, behavior)
    scrollWindowToBottom(behavior)
  })
  showScrollBottom.value = false
}

function scrollElementToBottom(el, behavior = 'smooth') {
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior })
}

function scrollParentContainersToBottom(el, behavior = 'smooth') {
  if (!el || typeof window === 'undefined') return
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent)
    const canScroll = /(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflow}`)
    if (canScroll && parent.scrollHeight > parent.clientHeight) {
      scrollElementToBottom(parent, behavior)
    }
    parent = parent.parentElement
  }
}

function scrollDocumentToBottom(behavior = 'smooth') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const scrollingElement = document.scrollingElement || document.documentElement
  const top = Math.max(
    scrollingElement?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0,
    document.body?.scrollHeight || 0
  )
  window.scrollTo({ top, behavior })
  if (scrollingElement?.scrollTo) scrollingElement.scrollTo({ top, behavior })
}

function scrollWindowToBottom(behavior = 'smooth') {
  scrollDocumentToBottom(behavior)
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
  () => activeTracePhrases.value.join('\n'),
  () => restartTraceTypewriter(),
  { immediate: true }
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
  if (copiedMessageTimer) clearTimeout(copiedMessageTimer)
  stopTraceTypewriter()
})

defineExpose({ focusComposer, scrollAgentChatToBottom })
</script>
