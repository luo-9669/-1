<template>
  <section class="workflow-canvas-page">
    <header class="workflow-canvas-topbar">
      <div class="workflow-canvas-head-row">
        <div class="workflow-canvas-title-row">
          <BaseButton class="workflow-back-control" type="button" aria-label="返回分析" @click="$emit('back')">
            <span class="workflow-back-logo">流</span>
            <span class="workflow-back-label">返回分析</span>
          </BaseButton>
          <strong class="workflow-canvas-title" :title="fullCanvasTitle">{{ displayCanvasTitle }}</strong>
          <span>{{ parsedCount }} 个文档已解析 · {{ skillLabel || '未选择 Skill' }}</span>
          <span v-if="knowledgeStatus.status" class="workflow-knowledge-status" :class="knowledgeStatus.status">
            {{ knowledgeStatus.message || '知识库状态已更新' }}
            <BaseButton v-if="knowledgeStatus.status === 'success'" variant="text" type="button" @click="$emit('open-knowledge')">查看知识库</BaseButton>
          </span>
        </div>
        <div class="canvas-toolbar-actions">
          <div ref="versionMenuRef" class="workflow-version-menu">
            <BaseButton type="button" @click="showVersionHistory = !showVersionHistory">版本历史</BaseButton>
            <section v-if="showVersionHistory" class="workflow-version-popover" aria-label="版本历史">
              <section class="workflow-canvas-meta-panel">
                <strong>版本历史</strong>
                <p v-if="!versionHistory.length" class="workflow-version-empty">暂无版本历史</p>
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
                    <div class="workflow-version-rollback-actions">
                      <BaseButton variant="primary" type="button" @click="confirmRollbackVersion">确认回滚</BaseButton>
                      <BaseButton type="button" @click="closeRollbackPreview">取消</BaseButton>
                    </div>
                  </div>
                  <BaseButton type="button" :disabled="!version.snapshot" @click="openRollbackPreview(version)">
                    {{ rollbackPreviewVersionId === version.id ? '正在预览' : '回滚到此版本' }}
                  </BaseButton>
                </article>
              </section>
            </section>
          </div>
          <BaseButton type="button" @click="$emit('open-agent', activeNode?.id || 'analysis')">
            <template #icon><Bot class="ui-icon" aria-hidden="true" :stroke-width="2" /></template>
            Agent
          </BaseButton>
          <BaseButton type="button" @click="$emit('transfer-other-skill')">转其它 Skill 分析</BaseButton>
          <BaseButton variant="primary" type="button" @click="$emit('convert-requirement')">转需求文档</BaseButton>
        </div>
      </div>
      <div class="workflow-canvas-stage-row">
        <nav v-if="totalFlowStages.length" class="workflow-stage-strip" aria-label="总流程阶段">
          <div class="workflow-stage-list">
            <span
              v-for="(stage, stageIndex) in visibleTotalFlowStages"
              :key="stage.id"
              class="workflow-stage-chip"
              :class="{ active: stage.id === activeStageId, locked: !canOpenStage(stage.id) }"
              role="button"
              :tabindex="canOpenStage(stage.id) ? 0 : -1"
              @click="focusStage(stage)"
              @keydown.enter.prevent="focusStage(stage)"
            >
              <button
                type="button"
                class="workflow-stage-main"
                :disabled="!canOpenStage(stage.id)"
                @click.stop="focusStage(stage)"
              >
                <span class="workflow-stage-step-index">{{ stageIndex + 1 }}</span>
                <span>{{ stage.name }}</span>
              </button>
            </span>
          </div>
          <div class="workflow-stage-actions" aria-label="阶段操作">
            <BaseButton
              v-if="canAdvanceWorkflowStage"
              class="workflow-stage-next-button"
              variant="primary"
              type="button"
              @click="confirmStageAndGoNext"
            >
              下一步
            </BaseButton>
          </div>
        </nav>
      </div>
      <section v-if="shouldShowRequirementSlices" class="workflow-total-slice-rail" aria-label="小需求切片">
        <div class="workflow-total-slice-head">
          <strong>小需求</strong>
        </div>
        <button
          v-for="slice in filterableRequirementSlices"
          :key="slice.id"
          type="button"
          class="workflow-total-slice-card"
          :class="{ active: slice.id === resolvedActiveSliceId }"
          @click="selectRequirementSlice(slice.id)"
        >
          <strong>{{ slice.title }}</strong>
        </button>
      </section>
    </header>

    <main class="workflow-canvas-shell" :class="{ 'is-agent-workbench-stage': shouldRenderAgentWorkbench }">
      <aside v-if="shouldRenderCanvasTabs" class="workflow-canvas-tabs">
        <section class="workflow-canvas-tab-list" aria-label="工作流节点导航">
          <BaseTabs v-model="activeCanvasTabId" :items="canvasTabItems" label="工作流节点导航" />
        </section>
      </aside>
      <section class="workflow-canvas-viewport">
        <section v-if="shouldRenderAgentWorkbench" class="workflow-stage-agent-workbench" aria-label="阶段 Agent 确认">
          <slot name="agent-workbench" :stage-id="activeStageId" :stage-label="activeStageLabel" :node="stageAgentNode" :next="confirmStageAndGoNext" />
        </section>
        <div v-if="shouldRenderCanvasBoard" ref="viewportRef" class="workflow-canvas-scrollarea" @wheel="handleCanvasWheel" @click.capture="handleCanvasActionClick">
          <div
            class="workflow-canvas-surface"
            :class="{ 'requirement-dissection-board': isRequirementDissectionStageId(activeStageId) }"
            :style="{ transform: `scale(${zoom})` }"
          >
            <svg class="workflow-canvas-edges" :width="CANVAS_SURFACE_WIDTH" :height="CANVAS_SURFACE_HEIGHT" aria-hidden="true">
              <path
                v-for="edge in drawableEdges"
                :key="edge.id"
                :d="edgePath(edge)"
                :class="{ 'active-flow': isActiveIncomingEdge(edge) }"
              />
            </svg>
            <article
              v-for="node in displayNodes"
              :key="node.id"
              :data-node-id="node.id"
              class="canvas-node-card"
              :class="{ active: activeNode?.id === node.id, spotlight: spotlightNodeId === node.id, 'visual-canvas-node': isVisualGalleryDetail(node), 'preview-code-node': isPreviewCodeDetail(node) }"
              :style="isRequirementDissectionStageId(activeStageId) ? undefined : { left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px`, minHeight: `${node.height}px` }"
              :aria-label="`聚焦画布节点：${node.title || node.id}`"
            >
              <div class="canvas-node-hitbox" @click="$emit('focus-node', node.id)">
                <div class="canvas-node-head">
                  <div>
                    <h3>{{ node.title }}</h3>
                  </div>
                  <div class="canvas-node-actions">
                    <button type="button" data-canvas-action="open-agent" :data-node-id="node.id">Agent</button>
                    <button type="button" data-canvas-action="open-detail" :data-node-id="node.id">全屏</button>
                  </div>
                </div>
                <div class="canvas-node-body">
                  <p v-if="!isNodeActuallyLoading(node) && !hasPageLayoutArtifact(node) && !isVisualGalleryDetail(node) && !isPreviewCodeDetail(node) && canvasNodeSummary(node)">{{ canvasNodeSummary(node) }}</p>
                  <div v-if="isNodeActuallyLoading(node) && !isVisualGalleryDetail(node)" class="canvas-node-loading">
                    <span class="loading-spinner-large"></span>
                    <div class="canvas-node-loading-copy">
                      <b>{{ cleanNodeDisplayCopy(node.content?.[0]) || '正在生成节点数据...' }}</b>
                      <small
                        v-for="item in loadingNodeContent(node).slice(1)"
                        :key="`${node.id}-loading-${item}`"
                      >
                        {{ item }}
                      </small>
                    </div>
                  </div>
                  <div v-if="!isNodeActuallyLoading(node) && hasPageLayoutArtifact(node)" class="canvas-node-wireframe-preview">
                    <pre>{{ pageLayoutArtifact(node).asciiWireframe }}</pre>
                  </div>
                  <section v-else-if="isVisualGalleryDetail(node)" class="visual-canvas-card-preview">
                    <div v-if="visualPreviewImage(node)" class="visual-canvas-card-image" :class="visualCanvasSurfaceClass(node)">
                      <img :src="visualPreviewImage(node)" :alt="`${node.title} 高保真图`" @load="recordVisualImageNaturalRatio(node, $event)" />
                      <span v-if="visualImageAspectRatioLabel(node)" class="visual-image-ratio-badge">{{ visualImageAspectRatioLabel(node) }}</span>
                      <div v-if="isNodeActuallyLoading(node)" class="visual-image-generating-overlay">
                        <span class="loading-spinner-large"></span>
                        <strong>生成中</strong>
                      </div>
                      <div class="visual-image-tools" aria-label="图片操作">
                        <BaseIconButton label="下载至本地" type="button" title="下载至本地" aria-label="下载至本地" @click.stop="downloadVisualImage(node)">
                          <Download class="ui-icon" aria-hidden="true" :stroke-width="2" />
                        </BaseIconButton>
                        <BaseIconButton label="放大预览" type="button" title="放大预览" aria-label="放大预览" @click.stop="openVisualImagePreview(node)">
                          <Maximize2 class="ui-icon" aria-hidden="true" :stroke-width="2" />
                        </BaseIconButton>
                      </div>
                    </div>
                    <div v-else-if="isNodeActuallyLoading(node)" class="visual-canvas-card-placeholder is-generating visual-canvas-card-generating-image-placeholder">
                      <span class="loading-spinner-large"></span>
                      <strong>生图中</strong>
                      <span>{{ visualCanvasPlaceholderDescription(node, 'generating') }}</span>
                    </div>
                    <div v-else-if="visualPreviewNeedsConfiguration(node)" class="visual-canvas-card-placeholder config-required">
                      <strong>待配置图片模型</strong>
                      <span>{{ visualPreview(node).configurationMessage || '配置图片生成模型后可生成高保真图。' }}</span>
                    </div>
                    <div v-else-if="visualPreviewGenerationFailed(node)" class="visual-canvas-card-placeholder generation-failed">
                      <strong>高保真图生成失败</strong>
                      <span>{{ visualPreview(node).failureMessage || node.artifact?.error || '可点击重新生成高保真图。' }}</span>
                    </div>
                    <div v-else class="visual-canvas-card-placeholder">
                      <strong>待生成高保真图</strong>
                      <span>{{ visualCanvasPlaceholderDescription(node, 'pending') }}</span>
                    </div>
                  </section>
                  <section v-else-if="!isNodeActuallyLoading(node) && isPreviewCodeDetail(node)" class="preview-code-card-preview">
                    <div class="preview-code-card-frame">
                      <iframe
                        v-if="previewCodeSrcdoc(node)"
                        :srcdoc="previewCodeSrcdoc(node)"
                        title="HTML 画布渲染预览"
                        sandbox="allow-forms allow-scripts"
                      ></iframe>
                      <div v-else class="preview-code-card-placeholder">
                        <strong>待生成 HTML</strong>
                        <span>{{ codePreview(node).previewSummary || '生成后在这里展示页面效果。' }}</span>
                      </div>
                    </div>
                  </section>
                  <div v-else-if="!isNodeActuallyLoading(node) && isRequirementPipelineCanvasNode(node) && requirementCanvasPreviewTable(node)" class="requirement-canvas-card-table-preview">
                    <table>
                      <thead>
                        <tr>
                          <th v-for="header in requirementPreviewTableHeaders(requirementCanvasPreviewTable(node))" :key="`${node.id}-requirement-preview-header-${header}`">{{ header }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in requirementPreviewTableRows(requirementCanvasPreviewTable(node))" :key="`${node.id}-requirement-preview-row-${row.key}`">
                          <td v-for="cell in row.cells" :key="`${node.id}-requirement-preview-${row.key}-${cell}`">{{ cell }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else-if="!isNodeActuallyLoading(node) && !hasPageLayoutArtifact(node) && !isVisualGalleryDetail(node) && !isPreviewCodeDetail(node) && compactNodeContent(node).length" class="canvas-node-content">
                    <span v-for="item in compactNodeContent(node)" :key="`${node.id}-preview-${item}`">{{ item }}</span>
                  </div>
                </div>
                <div class="canvas-node-footer">
                  <BaseButton
                    v-for="action in visibleNodeQuickActions(node)"
                    :key="action"
                    type="button"
                    :disabled="isNodeQuickActionDisabled(node, action)"
                    @click.stop="runNodeQuickAction(node, action)"
                  >
                    {{ visibleNodeQuickActionLabel(node, action) }}
                  </BaseButton>
                </div>
              </div>
            </article>
          </div>
        </div>
        <div v-if="shouldRenderCanvasBoard" class="workflow-canvas-zoom-controls" aria-label="画布缩放">
          <BaseButton type="button" variant="text" @click="$emit('zoom', -0.1)">
            <template #icon><ZoomOut class="ui-icon" aria-hidden="true" :stroke-width="2" /></template>
            缩小
          </BaseButton>
          <BaseButton type="button" variant="text" @click="$emit('zoom', 0.1)">
            <template #icon><ZoomIn class="ui-icon" aria-hidden="true" :stroke-width="2" /></template>
            放大 {{ Math.round(zoom * 100) }}%
          </BaseButton>
        </div>
      </section>
    </main>
  </section>

  <div v-if="fullscreenNode" class="canvas-fullscreen-modal" @click.self="$emit('close-fullscreen')">
    <section>
      <header>
        <div>
          <h3>{{ fullscreenNode.title }}</h3>
        </div>
        <div class="actions">
          <BaseButton type="button" @click="$emit('open-agent', fullscreenNode.id)">Agent</BaseButton>
          <BaseButton v-if="!isFullscreenEditing(fullscreenNode)" type="button" @click="startFullscreenEdit(fullscreenNode)">编辑</BaseButton>
          <BaseButton v-else type="button" @click="cancelFullscreenEdit">取消编辑</BaseButton>
          <BaseButton v-if="isFullscreenEditing(fullscreenNode)" variant="primary" type="button" :disabled="!canSaveFullscreenEdit" @click="saveFullscreenEdit(fullscreenNode)">保存</BaseButton>
          <BaseButton type="button" @click="$emit('close-fullscreen')">退出全屏</BaseButton>
        </div>
      </header>
      <div class="canvas-fullscreen-content" :class="{ 'has-right-questions': fullscreenRightQuestions(fullscreenNode).length && !isFullscreenEditing(fullscreenNode) }">
        <section class="canvas-detail-overview">
          <article v-if="isNodeActuallyLoading(fullscreenNode)" class="canvas-fullscreen-loading-state">
            <span class="loading-spinner-large"></span>
            <div>
              <strong>{{ fullscreenNode.title }}正在生成</strong>
              <p>{{ loadingNodeDetailSummary(fullscreenNode) }}</p>
            </div>
          </article>
          <article v-if="showModelReturnSummary(fullscreenNode) && !isNodeActuallyLoading(fullscreenNode) && !isStageSpecificDetail(fullscreenNode) && !shouldUseRequirementReportDetail(fullscreenNode) && !shouldUseRequirementPipelineDetail(fullscreenNode)" class="canvas-model-return-summary">
            <header>
              <strong>{{ modelReturnSummaryTitle }}</strong>
              <small>{{ modelReturnSummaryHint }}</small>
            </header>
            <p v-if="aiSummary?.summary">{{ aiSummary.summary }}</p>
            <div class="canvas-model-return-grid">
              <section v-for="section in modelReturnSummarySections" :key="section.title">
                <b>{{ section.title }}</b>
                <span v-for="item in section.items" :key="`${section.title}-${item}`">{{ item }}</span>
              </section>
            </div>
          </article>
          <article v-if="showNodeOwnContentSummary(fullscreenNode) && !isNodeActuallyLoading(fullscreenNode) && !isStageSpecificDetail(fullscreenNode) && !hasPageLayoutArtifact(fullscreenNode) && !shouldUseRequirementReportDetail(fullscreenNode) && !shouldUseRequirementPipelineDetail(fullscreenNode)" class="canvas-node-own-summary">
            <header>
              <strong>模型产出内容</strong>
              <small>只展示大模型针对「{{ fullscreenNode.title }}」生成的结果。</small>
            </header>
            <p v-if="canvasNodeSummary(fullscreenNode)">{{ canvasNodeSummary(fullscreenNode) }}</p>
            <div class="canvas-node-own-list">
              <span v-for="item in nodeOwnSummaryItems(fullscreenNode, 3)" :key="`${fullscreenNode.id}-own-${item}`">
                {{ item }}
              </span>
            </div>
          </article>
          <div v-if="isFullscreenEditing(fullscreenNode)" class="canvas-fullscreen-edit-panel">
            <label>
              <span>摘要</span>
              <BaseTextarea v-model="fullscreenEditSummary" rows="3" />
            </label>
            <label>
              <span>内容条目</span>
              <BaseTextarea v-model="fullscreenEditContentText" rows="8" />
            </label>
            <label>
              <span>详情内容</span>
              <BaseTextarea v-model="fullscreenEditDetailText" rows="6" />
            </label>
          </div>
          <section
            v-if="!isNodeActuallyLoading(fullscreenNode) && shouldUseRequirementPipelineDetail(fullscreenNode)"
            class="requirement-pipeline-detail"
          >
            <article v-if="requirementPipelineFailureMessages(fullscreenNode).length" class="requirement-pipeline-failure-notice">
              <strong>门禁未通过，但已保留模型返回内容</strong>
              <span v-for="message in requirementPipelineFailureMessages(fullscreenNode)" :key="`${fullscreenNode.id}-pipeline-failure-${message}`">
                {{ message }}
              </span>
            </article>
            <div class="requirement-pipeline-document">
              <article v-if="shouldRenderAdvancedUxRequirementMarkdown(fullscreenNode)" class="requirement-advanced-ux-markdown-detail requirement-markdown-report-block">
                <div class="requirement-markdown-message">
                  <RequirementMarkdownBlock
                    v-for="(block, blockIndex) in requirementMarkdownRenderableBlocks(advancedUxRequirementNodeMarkdown(fullscreenNode))"
                    :key="`advanced-ux-markdown-${fullscreenNode.id}-${blockIndex}`"
                    :block="block"
                    :block-index="blockIndex"
                  />
                </div>
              </article>
              <template v-else>
                <section
                  v-for="section in requirementDocumentSections(fullscreenNode)"
                  :key="`${fullscreenNode.id}-pipeline-section-${section.id}`"
                  class="requirement-pipeline-section"
                >
                  <header>
                    <h2>{{ section.indexLabel }}、{{ section.title }}</h2>
                  </header>
                  <div class="requirement-pipeline-section-blocks">
                    <article
                      v-for="(block, blockIndex) in section.blocks"
                      :key="`${fullscreenNode.id}-pipeline-${block.id || block.sourceRef || block.title}`"
                      class="requirement-pipeline-block requirement-document-block"
                      :class="[`layout-${requirementBlockType(block)}`, { 'layout-advanced-ux-table': isAdvancedUxTablePreferredBlock(block, fullscreenNode) }]"
                    >
                    <header>
                      <h3>{{ requirementDocumentBlockHeading(section, block, blockIndex) }}</h3>
                      <small v-if="block.summary">{{ block.summary }}</small>
                    </header>
                    <div v-if="isAdvancedUxTablePreferredBlock(block, fullscreenNode)" class="requirement-document-table-block requirement-detail-table">
                      <article v-if="requirementBlockHeaders(block, fullscreenNode).length" class="head" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <b v-for="header in requirementBlockHeaders(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-advanced-ux-header-${header}`">{{ header }}</b>
                      </article>
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-advanced-ux-row-${row.key}`" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-advanced-ux-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="isRequirementNavigationBlock(block)" class="requirement-navigation-map">
                      <section class="requirement-navigation-entry-groups">
                        <article v-for="group in requirementNavigationVisualGroups(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-nav-group-${group.title}`">
                          <b>{{ group.title }}</b>
                          <span v-for="item in group.items" :key="`${fullscreenNode.id}-${block.id}-${group.title}-${item}`">{{ item }}</span>
                        </article>
                      </section>
                      <div class="requirement-navigation-card-grid">
                        <article v-for="item in requirementNavigationVisualRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-nav-${item.key}`">
                          <i>{{ item.order }}</i>
                          <b>{{ item.label }}</b>
                          <small>targetPageId：{{ item.targetPageId }}</small>
                          <span>activeState：{{ item.activeState }}</span>
                          <span>visibilityRule：{{ item.visibilityRule }}</span>
                          <span>permissionRule：{{ item.permissionRule }}</span>
                        </article>
                      </div>
                    </div>
                    <div v-else-if="isRequirementPageHierarchyBlock(block)" class="requirement-page-hierarchy-map">
                      <article
                        v-for="row in requirementPageHierarchyVisualRows(block, fullscreenNode)"
                        :key="`${fullscreenNode.id}-${block.id}-hierarchy-${row.key}`"
                        :style="{ paddingLeft: `${row.depth * 18}px` }"
                      >
                        <i>L{{ row.level }}</i>
                        <div>
                          <b>{{ row.label }}</b>
                          <small>{{ row.summary }}</small>
                        </div>
                        <span>pageId：{{ row.pageId }}</span>
                        <span>parentId：{{ row.parentId }}</span>
                        <span>pageType：{{ row.pageType }}</span>
                      </article>
                    </div>
                    <ol v-else-if="isRequirementJourneyBlock(block)" class="requirement-journey-map">
                      <li v-for="step in requirementJourneyVisualRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-journey-${step.key}`">
                        <i>{{ step.stepIndex }}</i>
                        <b>{{ step.title }}</b>
                        <span>路径类型：{{ step.pathType }}</span>
                        <span>页面：{{ step.pageName }}</span>
                        <span>用户动作：{{ step.userAction }}</span>
                        <small>目标：{{ step.goal }}</small>
                        <small>流转：{{ step.transition }}</small>
                      </li>
                    </ol>
                    <div v-else-if="isRequirementDataFlowBlock(block)" class="requirement-data-flow-map">
                      <article v-for="row in requirementDataFlowVisualRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-data-flow-${row.key}`">
                        <section>
                          <b>读取</b>
                          <span v-for="item in row.reads" :key="`${row.key}-read-${item}`">{{ item }}</span>
                        </section>
                        <div>
                          <i>{{ row.pageId }}</i>
                          <strong>{{ row.pageName }}</strong>
                          <small v-for="edge in row.edges" :key="`${row.key}-edge-${edge}`">{{ edge }}</small>
                        </div>
                        <section>
                          <b>写入 / 下游</b>
                          <span v-for="item in row.writes" :key="`${row.key}-write-${item}`">{{ item }}</span>
                          <span v-for="item in row.downstream" :key="`${row.key}-downstream-${item}`">{{ item }}</span>
                        </section>
                      </article>
                    </div>
                    <div v-else-if="isRequirementStateMachineBlock(block)" class="requirement-state-machine-map">
                      <article v-for="row in requirementStateMachineVisualRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-state-map-${row.key}`">
                        <header>
                          <b>{{ row.pageName }}</b>
                          <small>{{ row.pageId }}</small>
                        </header>
                        <div class="requirement-state-chip-row">
                          <span v-for="state in row.states" :key="`${row.key}-state-${state}`">{{ state }}</span>
                        </div>
                        <div class="requirement-state-transition-list">
                          <span v-for="transition in row.transitions" :key="`${row.key}-transition-${transition.key}`">
                            {{ transition.from }} -> {{ transition.event }} -> {{ transition.to }}
                          </span>
                        </div>
                      </article>
                    </div>
                    <div v-else-if="isRequirementFeatureJumpBlock(block)" class="requirement-feature-jump-map">
                      <article v-for="edge in requirementFeatureJumpVisualRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-jump-${edge.key}`">
                        <div>
                          <b>{{ edge.from }}</b>
                          <i>{{ edge.action }}</i>
                          <b>{{ edge.to }}</b>
                        </div>
                        <section>
                          <span>fromPageId：{{ edge.fromPageId }}</span>
                          <span>toPageId：{{ edge.toPageId }}</span>
                          <span>condition：{{ edge.condition }}</span>
                          <span>preserveState：{{ edge.preserveState }}</span>
                          <span v-if="edge.note">note：{{ edge.note }}</span>
                        </section>
                      </article>
                    </div>
                    <div v-else-if="isRequirementBusinessRuleBlock(block)" class="requirement-business-rule-list">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-business-rule-${row.key}`">
                        <b>{{ row.cells[0] }}</b>
                        <span v-for="cell in row.cells.slice(1)" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="isRequirementPermissionMatrixBlock(block)" class="requirement-permission-matrix">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-permission-${row.key}`">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="isRequirementBoundaryConditionBlock(block)" class="requirement-boundary-condition-list">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-boundary-${row.key}`">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="isRequirementOpportunityPriorityBlock(block)" class="requirement-opportunity-priority">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-opportunity-${row.key}`">
                        <b>{{ row.cells[0] }}</b>
                        <span v-for="cell in row.cells.slice(1)" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="isRequirementStructuredDetailBlock(block)" class="requirement-structured-detail-list">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-structured-${row.key}`">
                        <b>{{ row.cells[0] }}</b>
                        <span v-for="cell in row.cells.slice(1)" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'tree'" class="requirement-tree-lines">
                      <section v-for="group in requirementBlockGroups(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-tree-${group.title}`">
                        <b>{{ group.title }}</b>
                        <span v-for="item in group.items" :key="`${fullscreenNode.id}-${block.id}-${group.title}-${item}`">{{ item }}</span>
                      </section>
                    </div>
                    <ol v-else-if="requirementBlockType(block) === 'timeline'" class="requirement-timeline">
                      <li v-for="item in requirementBlockItems(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-timeline-${item}`">{{ item }}</li>
                    </ol>
                    <div v-else-if="requirementBlockType(block) === 'graph'" class="requirement-graph-block">
                      <span v-for="item in requirementBlockItems(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-graph-${item}`">{{ item }}</span>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'state-machine'" class="requirement-state-machine">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-state-${row.key}`">
                        <b>{{ row.cells[0] }}</b>
                        <span v-for="cell in row.cells.slice(1)" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'relation-table'" class="requirement-relation-table">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-relation-${row.key}`">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'risk-matrix'" class="requirement-risk-matrix requirement-detail-table">
                      <article v-if="requirementBlockHeaders(block, fullscreenNode).length" class="head" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <b v-for="header in requirementBlockHeaders(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-risk-header-${header}`">{{ header }}</b>
                      </article>
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-risk-${row.key}`" :class="row.tone" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'score-card'" class="requirement-score-card-block">
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-score-${row.key}`">
                        <b>{{ row.cells[0] }}</b>
                        <strong>{{ row.cells[1] }}</strong>
                        <span>{{ row.cells.slice(2).join(' · ') }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'feature-list'" class="requirement-feature-list-block">
                      <article v-for="item in requirementFeatureItems(block)" :key="`${fullscreenNode.id}-${block.id}-feature-${item.key}`">
                        <header>
                          <b>{{ item.title }}</b>
                          <span v-if="item.type">{{ item.type }}</span>
                        </header>
                        <dl v-if="item.asA || item.iWantTo || item.soThat" class="requirement-feature-story">
                          <div v-if="item.asA">
                            <dt>As a</dt>
                            <dd>{{ item.asA }}</dd>
                          </div>
                          <div v-if="item.iWantTo">
                            <dt>I want to</dt>
                            <dd>{{ item.iWantTo }}</dd>
                          </div>
                          <div v-if="item.soThat">
                            <dt>so that</dt>
                            <dd>{{ item.soThat }}</dd>
                          </div>
                        </dl>
                        <p v-else-if="item.userStory">{{ item.userStory }}</p>
                        <small v-if="item.description">{{ item.description }}</small>
                        <dl v-if="requirementFeatureMetaRows(item).length" class="requirement-feature-meta">
                          <div v-for="row in requirementFeatureMetaRows(item)" :key="`${fullscreenNode.id}-${block.id}-${item.key}-${row.label}`">
                            <dt>{{ row.label }}</dt>
                            <dd>{{ row.value }}</dd>
                          </div>
                        </dl>
                        <ul v-if="item.acceptance?.length">
                          <li v-for="acceptance in item.acceptance" :key="`${fullscreenNode.id}-${block.id}-${item.key}-${acceptance}`">{{ acceptance }}</li>
                        </ul>
                      </article>
                      <pre v-if="!requirementFeatureItems(block).length">{{ requirementDocumentBlockPlaintext(block, fullscreenNode) }}</pre>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'flow-wireframe'" class="requirement-flow-wireframe-block">
                      <pre>{{ requirementDocumentBlockPlaintext(block, fullscreenNode) }}</pre>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'checklist'" class="requirement-checklist-block requirement-detail-table">
                      <article v-if="requirementBlockHeaders(block, fullscreenNode).length" class="head" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <b v-for="header in requirementBlockHeaders(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-checklist-header-${header}`">{{ header }}</b>
                      </article>
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-checklist-${row.key}`" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'metric-table'" class="requirement-metric-table-block requirement-detail-table">
                      <article v-if="requirementBlockHeaders(block, fullscreenNode).length" class="head" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <b v-for="header in requirementBlockHeaders(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-metric-header-${header}`">{{ header }}</b>
                      </article>
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-metric-${row.key}`" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="isRequirementDocumentTableBlock(block)" class="requirement-document-table-block requirement-detail-table">
                      <article v-if="requirementBlockHeaders(block, fullscreenNode).length" class="head" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <b v-for="header in requirementBlockHeaders(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-document-header-${header}`">{{ header }}</b>
                      </article>
                      <article v-for="row in requirementBlockRows(block, fullscreenNode)" :key="`${fullscreenNode.id}-${block.id}-document-row-${row.key}`" :style="requirementBlockTableStyle(block, fullscreenNode)">
                        <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${block.id}-document-${row.key}-${cell}`">{{ cell }}</span>
                      </article>
                    </div>
                    <div v-else-if="requirementBlockType(block) === 'markdown'" class="requirement-markdown-report-block">
                      <div class="requirement-markdown-message">
                        <RequirementMarkdownBlock
                          v-for="(markdownBlock, markdownBlockIndex) in requirementMarkdownRenderableBlocks(requirementDocumentBlockPlaintext(block, fullscreenNode))"
                          :key="`${fullscreenNode.id}-${block.id}-markdown-${markdownBlockIndex}`"
                          :block="markdownBlock"
                          :block-index="markdownBlockIndex"
                        />
                      </div>
                    </div>
                    <div v-else class="requirement-document-code-block">
                      <div class="requirement-document-block-label">
                        <span>plaintext</span>
                        <i>复制</i>
                      </div>
                      <pre>{{ requirementDocumentBlockPlaintext(block, fullscreenNode) }}</pre>
                    </div>
                    </article>
                  </div>
                </section>
              </template>
            </div>
            <section v-if="requirementKnowledgeCitationSummary(fullscreenNode)" class="requirement-knowledge-citation">
              <span>{{ requirementKnowledgeCitationSummary(fullscreenNode) }}</span>
              <b class="requirement-knowledge-citation-mark">引用</b>
              <details class="requirement-knowledge-citation-sources">
                <summary>查看引用知识</summary>
                <article v-for="source in requirementKnowledgeCitationSources(fullscreenNode)" :key="`${fullscreenNode.id}-knowledge-citation-${source.key}`">
                  <b>{{ source.title }}</b>
                  <small>{{ source.path || source.sourceType }}</small>
                  <span>{{ source.summary }}</span>
                </article>
              </details>
            </section>
          </section>
          <section
            v-else-if="!isNodeActuallyLoading(fullscreenNode) && shouldUseRequirementSectionDetail(fullscreenNode)"
            class="requirement-section-detail"
            :class="[`layout-${requirementSectionDetail(fullscreenNode).layout}`]"
          >
            <p v-if="requirementSectionDetail(fullscreenNode).summary">{{ requirementSectionDetail(fullscreenNode).summary }}</p>
            <div v-if="requirementSectionDetail(fullscreenNode).layout === 'tree'" class="requirement-tree-lines">
              <section v-for="group in requirementSectionDetail(fullscreenNode).groups" :key="`${fullscreenNode.id}-tree-${group.title}`">
                <b>{{ group.title }}</b>
                <span v-for="item in group.items" :key="`${fullscreenNode.id}-${group.title}-${item}`">{{ item }}</span>
              </section>
            </div>
            <ol v-else-if="requirementSectionDetail(fullscreenNode).layout === 'timeline'" class="requirement-timeline">
              <li v-for="group in requirementSectionDetail(fullscreenNode).groups" :key="`${fullscreenNode.id}-timeline-${group.title}`">
                <b>{{ group.title }}</b>
                <span v-for="item in group.items" :key="`${fullscreenNode.id}-${group.title}-${item}`">{{ item }}</span>
              </li>
            </ol>
            <div v-else-if="requirementSectionDetail(fullscreenNode).layout === 'table'" class="requirement-detail-table">
              <article class="head">
                <b v-for="header in requirementSectionDetail(fullscreenNode).tableHeaders" :key="`${fullscreenNode.id}-table-header-${header}`">{{ header }}</b>
              </article>
              <article v-for="row in requirementSectionDetail(fullscreenNode).rows" :key="`${fullscreenNode.id}-table-row-${row.key}`">
                <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${row.key}-${cell}`">{{ cell }}</span>
              </article>
            </div>
            <div v-else-if="requirementSectionDetail(fullscreenNode).layout === 'risk'" class="requirement-risk-matrix">
              <article class="head">
                <b v-for="header in requirementSectionDetail(fullscreenNode).riskHeaders" :key="`${fullscreenNode.id}-risk-header-${header}`">{{ header }}</b>
              </article>
              <article v-for="row in requirementSectionDetail(fullscreenNode).rows" :key="`${fullscreenNode.id}-risk-row-${row.key}`" :class="row.tone">
                <span v-for="cell in row.cells" :key="`${fullscreenNode.id}-${row.key}-${cell}`">{{ cell }}</span>
              </article>
            </div>
            <div v-else class="requirement-section-detail-grid">
              <article v-for="group in requirementSectionDetail(fullscreenNode).groups" :key="`${fullscreenNode.id}-requirement-detail-${group.title}`">
                <b>{{ group.title }}</b>
                <small v-if="group.meta">{{ group.meta }}</small>
                <span v-for="item in group.items" :key="`${fullscreenNode.id}-${group.title}-${item}`">{{ item }}</span>
              </article>
            </div>
          </section>
          <div v-else-if="isAgentConfirmationNode(fullscreenNode)" class="agent-confirmation-fullscreen">
            <article v-if="agentConfirmationContextText(fullscreenNode)" class="agent-confirmation-context">
              <header>
                <strong>对话上下文</strong>
                <small>来自对话 Skill 的完整输出，作为本阶段分析依据</small>
              </header>
              <pre>{{ agentConfirmationContextText(fullscreenNode) }}</pre>
            </article>
            <section v-if="isRequirementDissectionNode(fullscreenNode) && hasRequirementDissectionArtifact(fullscreenNode) && !hasRequirementPipeline(fullscreenNode)" class="legacy-requirement-dissection-report">
              <header>
                <strong>需求分析报告</strong>
                <small>产品需求转设计需求的结构化依据</small>
              </header>
              <div class="requirement-dissection-report-grid">
                <article class="requirement-dissection-report-panel primary">
                  <b>需求识别与产品判断</b>
                  <strong>{{ requirementProductDefinition(fullscreenNode).oneLine }}</strong>
                  <span>{{ requirementProductDefinition(fullscreenNode).productType }}</span>
                  <p>{{ requirementProductDefinition(fullscreenNode).bottomIntent }}</p>
                </article>
                <article class="requirement-dissection-report-panel">
                  <b>依据与假设</b>
                  <span v-for="item in requirementEvidenceItems(fullscreenNode)" :key="`${fullscreenNode.id}-evidence-${item}`">{{ item }}</span>
                </article>
                <article class="requirement-dissection-report-panel">
                  <b>用户与场景</b>
                  <span v-for="item in requirementUserScenarioItems(fullscreenNode)" :key="`${fullscreenNode.id}-user-scenario-${item}`">{{ item }}</span>
                </article>
                <article class="requirement-dissection-report-panel">
                  <b>范围边界</b>
                  <span v-for="item in requirementScopeItems(fullscreenNode)" :key="`${fullscreenNode.id}-scope-${item}`">{{ item }}</span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>页面覆盖矩阵</b>
                  <span v-for="row in requirementPageCoverageRows(fullscreenNode)" :key="`${fullscreenNode.id}-page-coverage-${row.key}`">
                    {{ row.cells.join('｜') }}
                  </span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>页面需求清单</b>
                  <span v-for="page in requirementPageRequirementItems(fullscreenNode)" :key="`${fullscreenNode.id}-page-requirement-${page}`">{{ page }}</span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>决策点矩阵</b>
                  <span v-for="row in requirementDecisionRows(fullscreenNode)" :key="`${fullscreenNode.id}-decision-${row.key}`">
                    {{ row.cells.join('｜') }}
                  </span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>异常与恢复路径</b>
                  <span v-for="row in requirementExceptionRows(fullscreenNode)" :key="`${fullscreenNode.id}-exception-${row.key}`">
                    {{ row.cells.join('｜') }}
                  </span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>数据与状态流转</b>
                  <span v-for="item in requirementDataStateItems(fullscreenNode)" :key="`${fullscreenNode.id}-data-state-${item}`">{{ item }}</span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>跨页面/跨功能关联</b>
                  <span v-for="row in requirementCrossPageRelationRows(fullscreenNode)" :key="`${fullscreenNode.id}-cross-page-${row.key}`">
                    {{ row.cells.join('｜') }}
                  </span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>交互说明规格</b>
                  <span v-for="row in requirementInteractionSpecRows(fullscreenNode)" :key="`${fullscreenNode.id}-interaction-spec-${row.key}`">
                    {{ row.cells.join('｜') }}
                  </span>
                </article>
                <article class="requirement-dissection-report-panel wide">
                  <b>数据共享机制</b>
                  <span v-for="row in requirementSharingRows(fullscreenNode)" :key="`${fullscreenNode.id}-sharing-${row.key}`">
                    {{ row.cells.join('｜') }}
                  </span>
                </article>
                <article class="requirement-dissection-report-panel">
                  <b>竞品参考</b>
                  <small>{{ requirementCompetitiveMode(fullscreenNode) }}</small>
                  <span v-for="item in requirementCompetitiveItems(fullscreenNode)" :key="`${fullscreenNode.id}-competitive-${item}`">{{ item }}</span>
                </article>
                <article class="requirement-dissection-report-panel">
                  <b>下游生成依据</b>
                  <span v-for="item in requirementDownstreamItems(fullscreenNode)" :key="`${fullscreenNode.id}-downstream-${item}`">{{ item }}</span>
                </article>
              </div>
            </section>
            <section v-if="isRequirementDissectionNode(fullscreenNode) && hasProjectFunctionMap(fullscreenNode)" class="requirement-function-map">
              <header>
                <strong>功能层级地图</strong>
                <small>{{ projectFunctionMap(fullscreenNode).scopeType === 'feature-slice' ? '小需求影响范围' : '新项目全局功能结构' }}</small>
              </header>
              <div class="requirement-function-map-layout">
                <article class="requirement-function-map-panel hierarchy">
                  <b>功能层级地图</b>
                  <div class="requirement-function-tree">
                    <section v-for="module in projectFunctionModules(fullscreenNode)" :key="`${fullscreenNode.id}-module-${module.id || module.name}`">
                      <strong>{{ module.name }}</strong>
                      <small v-if="module.summary">{{ module.summary }}</small>
                      <span v-for="page in module.pages || []" :key="`${module.id || module.name}-${page.pageId || page.pageName}`">{{ page.pageName }}</span>
                    </section>
                  </div>
                </article>
                <article class="requirement-function-map-panel">
                  <b>页面清单</b>
                  <div class="requirement-page-map-list">
                    <span v-for="page in projectFunctionPages(fullscreenNode)" :key="`${fullscreenNode.id}-page-map-${page.pageId || page.pageName}`">
                      {{ page.pageName }}<small>{{ (page.belongsTo || []).join(' / ') || page.entry || page.priority }}</small>
                    </span>
                  </div>
                </article>
                <article class="requirement-function-map-panel wide">
                  <b>用户主路径</b>
                  <div class="requirement-user-path">
                    <span v-for="item in projectFunctionPath(fullscreenNode)" :key="`${fullscreenNode.id}-path-${item}`">{{ item }}</span>
                  </div>
                </article>
              </div>
            </section>
            <div v-if="visibleAgentConfirmationSections(fullscreenNode).length && !shouldUseRequirementReportDetail(fullscreenNode)" class="agent-confirmation-frame">
              <div class="agent-confirmation-grid">
                <article
                  v-for="section in visibleAgentConfirmationSections(fullscreenNode)"
                  :key="`${fullscreenNode.id}-confirmation-${section.title}`"
                  class="agent-confirmation-panel"
                  :class="section.tone"
                >
                  <header>
                    <strong>{{ section.title }}</strong>
                    <small>{{ section.meta }}</small>
                  </header>
                  <ul>
                    <li v-for="item in section.items" :key="`${section.title}-${item}`">{{ item }}</li>
                  </ul>
                </article>
              </div>
            </div>
          </div>
          <div v-if="isPureContentNode(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="canvas-pure-content-frame">
            <pre>{{ pureContentText(fullscreenNode) }}</pre>
          </div>
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
          <div v-if="isInteractionPageDetail(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="interaction-page-detail-split">
            <section v-if="hasPageLayoutArtifact(fullscreenNode)" class="canvas-page-layout-artifact">
              <header>
                <strong>{{ pageLayoutArtifact(fullscreenNode).title || '页面骨架' }}</strong>
                <div class="canvas-page-layout-mode-toggle" aria-label="页面详情切换">
                  <button
                    type="button"
                    :class="{ active: fullscreenPageDetailMode(fullscreenNode) === 'wireframe' }"
                    @click="setFullscreenPageDetailMode(fullscreenNode, 'wireframe')"
                  >
                    框架图
                  </button>
                  <button
                    type="button"
                    :class="{ active: fullscreenPageDetailMode(fullscreenNode) === 'lofi-prototype' }"
                    @click="setFullscreenPageDetailMode(fullscreenNode, 'lofi-prototype')"
                  >
                    低保原型
                  </button>
                  <button
                    v-if="hasInteractionSpecArtifact(fullscreenNode)"
                    type="button"
                    :class="{ active: fullscreenPageDetailMode(fullscreenNode) === 'interaction-spec' }"
                    @click="setFullscreenPageDetailMode(fullscreenNode, 'interaction-spec')"
                  >
                    交互说明
                  </button>
                </div>
              </header>
              <section v-if="fullscreenPageDetailMode(fullscreenNode) === 'wireframe'" class="page-framework-document">
                <header class="page-framework-title">
                  <span>{{ pageFrameworkDocumentNumber(fullscreenNode) }}</span>
                  <div>
                    <strong>{{ pageFrameworkDocumentTitle(fullscreenNode) }}</strong>
                    <small>{{ pageFrameworkDocumentSubtitle(fullscreenNode) }}</small>
                  </div>
                </header>
                <template v-if="isAdvancedUxInteractionPageNode(fullscreenNode)">
                  <article class="page-framework-section primary">
                    <header>
                      <span>1</span>
                      <strong>页面定位</strong>
                    </header>
                    <div class="page-framework-body">
                      <p>{{ advancedUxPagePosition(fullscreenNode) }}</p>
                      <dl v-if="advancedUxPageMetaRows(fullscreenNode).length" class="advanced-ux-page-meta">
                        <template v-for="item in advancedUxPageMetaRows(fullscreenNode)" :key="`${fullscreenNode.id}-page-meta-${item.label}`">
                          <dt>{{ item.label }}</dt>
                          <dd>{{ item.value }}</dd>
                        </template>
                      </dl>
                    </div>
                  </article>
                  <article class="page-framework-section structure">
                    <header>
                      <span>2</span>
                      <strong>页面框架表格</strong>
                    </header>
                    <div class="advanced-ux-page-table">
                      <article class="head">
                        <b>区域</b>
                        <b>内容</b>
                        <b>说明</b>
                        <b>状态说明</b>
                        <b>组件引用</b>
                      </article>
                      <article v-for="row in advancedUxPageFrameworkRows(fullscreenNode)" :key="`${fullscreenNode.id}-frame-row-${row.id}`">
                        <span>{{ row.area }}</span>
                        <span>{{ row.content }}</span>
                        <span>{{ row.description }}</span>
                        <span>{{ row.stateDescription }}</span>
                        <span>{{ row.componentReference }}</span>
                      </article>
                    </div>
                  </article>
                  <article class="page-framework-section structure">
                    <header>
                      <span>3</span>
                      <strong>文本布局图（框架图）</strong>
                    </header>
                    <pre class="canvas-page-layout-panel wireframe-main page-framework-code-block">{{ pageLayoutArtifact(fullscreenNode).asciiWireframe }}</pre>
                  </article>
                  <article class="page-framework-section structure">
                    <header>
                      <span>4</span>
                      <strong>交互规则表格</strong>
                    </header>
                    <div class="advanced-ux-page-table interaction">
                      <article class="head">
                        <b>编号</b>
                        <b>用户操作</b>
                        <b>系统反馈</b>
                        <b>关联状态/弹窗</b>
                        <b>备注</b>
                      </article>
                      <article v-for="row in advancedUxInteractionRuleRows(fullscreenNode)" :key="`${fullscreenNode.id}-wireframe-rule-row-${row.id}`">
                        <span>{{ row.id }}</span>
                        <span>{{ row.userAction }}</span>
                        <span>{{ row.systemFeedback }}</span>
                        <span>{{ row.relatedStateOrModal }}</span>
                        <span>{{ row.remark }}</span>
                      </article>
                    </div>
                  </article>
                  <article class="page-framework-section state">
                    <header>
                      <span>5</span>
                      <strong>异常状态表格</strong>
                    </header>
                    <div class="advanced-ux-page-table state">
                      <article class="head">
                        <b>编号</b>
                        <b>状态</b>
                        <b>表现</b>
                        <b>处理方式</b>
                      </article>
                      <article v-for="row in advancedUxExceptionStateRows(fullscreenNode)" :key="`${fullscreenNode.id}-wireframe-state-row-${row.id}`">
                        <span>{{ row.id }}</span>
                        <span>{{ row.state }}</span>
                        <span>{{ row.display }}</span>
                        <span>{{ row.handling }}</span>
                      </article>
                    </div>
                  </article>
                </template>
                <template v-else>
                  <section class="page-framework-overview">
                    <b>功能概述：</b>
                    <span>{{ pageFrameworkOverview(fullscreenNode) }}</span>
                  </section>
                  <article
                    v-for="section in pageFrameworkDocumentSections(fullscreenNode)"
                    :key="`${fullscreenNode.id}-framework-section-${section.key}`"
                    class="page-framework-section"
                    :class="section.tone"
                  >
                    <header>
                      <span>{{ section.number }}</span>
                      <strong>{{ section.title }}</strong>
                    </header>
                    <div v-if="section.body.length" class="page-framework-body">
                      <p v-for="item in section.body" :key="`${fullscreenNode.id}-${section.key}-${item}`">{{ item }}</p>
                    </div>
                    <pre v-if="section.code" class="canvas-page-layout-panel wireframe-main page-framework-code-block">{{ section.code }}</pre>
                  </article>
                </template>
              </section>
              <section v-else-if="fullscreenPageDetailMode(fullscreenNode) === 'lofi-prototype'" class="page-lofi-prototype-artifact">
                <header>
                  <strong>低保真原型预览</strong>
                  <small>基于同一份 pageLayoutArtifact 渲染页面结构、关键区块和控件占位，不替代后端模型产物。</small>
                </header>
                <figure v-if="pageLowFiWireframeImage(fullscreenNode)" class="page-lofi-generated-image">
                  <img :src="pageLowFiWireframeImage(fullscreenNode)" :alt="pageLowFiWireframeFileName(fullscreenNode)" />
                  <figcaption>
                    <strong>{{ pageLowFiWireframeFileName(fullscreenNode) }}</strong>
                    <span>{{ pageLowFiWireframeArtifact(fullscreenNode).pageId }} {{ pageLowFiWireframeArtifact(fullscreenNode).pageName }}</span>
                  </figcaption>
                </figure>
                <div v-else class="page-lofi-prototype-frame" :class="pageLofiPrototypeTone(fullscreenNode)">
                  <section
                    v-for="section in pageLofiPrototypeSections(fullscreenNode)"
                    :key="`${fullscreenNode.id}-lofi-section-${section.key}`"
                    class="page-lofi-prototype-section"
                    :class="[section.kind, section.weight]"
                  >
                    <header>
                      <b>{{ section.title }}</b>
                      <span>{{ section.kindLabel }}</span>
                    </header>
                    <div class="page-lofi-prototype-items">
                      <article v-for="item in section.items" :key="`${fullscreenNode.id}-${section.key}-${item.key}`" :class="item.kind">
                        <i v-if="item.kind === 'media'"></i>
                        <strong>{{ item.label }}</strong>
                        <small v-if="item.meta">{{ item.meta }}</small>
                      </article>
                    </div>
                  </section>
                </div>
              </section>
              <section v-else-if="fullscreenPageDetailMode(fullscreenNode) === 'interaction-spec' && hasInteractionSpecArtifact(fullscreenNode)" class="page-interaction-spec-artifact">
                <header>
                  <strong>{{ interactionSpecArtifact(fullscreenNode).pageName || fullscreenNode.title }}</strong>
                  <small>按页面快照、控件热区、触发条件、提示文案、反馈、跳转、状态、动效和测试点说明。</small>
                </header>
                <template v-if="isAdvancedUxInteractionPageNode(fullscreenNode)">
                  <section class="page-interaction-spec-extra advanced-ux-page-table-section">
                    <h4>交互规则表格</h4>
                    <div class="advanced-ux-page-table interaction">
                      <article class="head">
                        <b>编号</b>
                        <b>用户操作</b>
                        <b>系统反馈</b>
                        <b>关联状态/弹窗</b>
                        <b>备注</b>
                      </article>
                      <article v-for="row in advancedUxInteractionRuleRows(fullscreenNode)" :key="`${fullscreenNode.id}-rule-row-${row.id}`">
                        <span>{{ row.id }}</span>
                        <span>{{ row.userAction }}</span>
                        <span>{{ row.systemFeedback }}</span>
                        <span>{{ row.relatedStateOrModal }}</span>
                        <span>{{ row.remark }}</span>
                      </article>
                    </div>
                  </section>
                  <section class="page-interaction-spec-extra advanced-ux-page-table-section">
                    <h4>异常状态表格</h4>
                    <div class="advanced-ux-page-table state">
                      <article class="head">
                        <b>编号</b>
                        <b>状态</b>
                        <b>表现</b>
                        <b>处理方式</b>
                      </article>
                      <article v-for="row in advancedUxExceptionStateRows(fullscreenNode)" :key="`${fullscreenNode.id}-state-row-${row.id}`">
                        <span>{{ row.id }}</span>
                        <span>{{ row.state }}</span>
                        <span>{{ row.display }}</span>
                        <span>{{ row.handling }}</span>
                      </article>
                    </div>
                  </section>
                </template>
                <template v-else>
                  <div class="page-interaction-spec-table">
                    <article class="page-interaction-spec-row head">
                      <b>对象</b>
                      <b>手势</b>
                      <b>条件/操作</b>
                      <b>反馈效果</b>
                      <b>状态提示文案</b>
                      <b>跳转/结果</b>
                      <b>状态/测试点</b>
                    </article>
                    <article v-for="row in interactionSpecRows(fullscreenNode)" :key="`${fullscreenNode.id}-interaction-row-${row.id || row.annotationId || row.target}`" class="page-interaction-spec-row">
                      <span>{{ row.target }}</span>
                      <span>{{ row.gesture }}</span>
                      <span>
                        <em v-if="row.enableCondition">启用：{{ row.enableCondition }}</em>
                        <em v-if="row.disableCondition">禁用：{{ row.disableCondition }}</em>
                        <em v-if="row.displayCondition">显示：{{ row.displayCondition }}</em>
                        <em v-if="row.hideCondition">隐藏：{{ row.hideCondition }}</em>
                        <em v-if="row.operation">操作：{{ row.operation }}</em>
                      </span>
                      <span>{{ row.feedback }}</span>
                      <span>{{ row.statePromptCopy }}</span>
                      <span>{{ row.result }}</span>
                      <span>
                        {{ [...(row.states || []), ...(row.testPoints || [])].join('；') }}
                        <em v-if="row.motion">动效：{{ row.motion }}</em>
                      </span>
                    </article>
                  </div>
                  <section v-if="interactionSpecStateMatrix(fullscreenNode).length" class="page-interaction-spec-extra">
                    <h4>状态提示文案</h4>
                    <article v-for="state in interactionSpecStateMatrix(fullscreenNode)" :key="`${fullscreenNode.id}-state-copy-${state.state}`">
                      <b>{{ state.state }}</b>
                      <span>触发：{{ state.trigger }}</span>
                      <span>显示：{{ state.display }}</span>
                      <span>文案：{{ state.promptCopy }}</span>
                      <span>恢复：{{ state.recovery }}</span>
                    </article>
                  </section>
                  <section v-if="interactionSpecFlowPreview(fullscreenNode).length" class="page-interaction-spec-extra page-interaction-flow-preview">
                    <h4>状态与流程闭环</h4>
                    <article v-for="step in interactionSpecFlowPreview(fullscreenNode)" :key="`${fullscreenNode.id}-flow-preview-${step.key}`" class="page-interaction-flow-step">
                      <b>{{ step.from }}</b>
                      <span>{{ step.trigger }}</span>
                      <strong>{{ step.to }}</strong>
                      <em>{{ step.result }}</em>
                    </article>
                  </section>
                  <section v-if="interactionSpecGestureNotes(fullscreenNode).length" class="page-interaction-spec-extra">
                    <h4>交互手势说明</h4>
                    <p v-for="item in interactionSpecGestureNotes(fullscreenNode)" :key="`${fullscreenNode.id}-gesture-note-${item}`">{{ item }}</p>
                  </section>
                </template>
              </section>
            </section>
            <section v-if="!hasPageLayoutArtifact(fullscreenNode)" class="interaction-page-wireframe">
              <header>
                <strong>页面架构图</strong>
                <small>左侧看页面结构、模块和状态层级。</small>
              </header>
              <article
                v-for="section in pageArchitectureSections(fullscreenNode)"
                :key="`${fullscreenNode.id}-architecture-${section.title}`"
                :class="`wireframe-tree-item ${section.type || 'section'}`"
              >
                <b>{{ section.title }}</b>
                <span v-for="item in section.items" :key="`${section.title}-${item}`">{{ item }}</span>
              </article>
            </section>
            <section v-if="!hasPageLayoutArtifact(fullscreenNode)" class="interaction-page-spec">
              <header>
                <strong>交互说明</strong>
                <small>右侧串联点击动作、跳转、状态、数据依赖和验收点。</small>
              </header>
              <div class="interaction-route-summary" aria-label="页面交互摘要">
                <article v-for="item in interactionRouteSummary(fullscreenNode)" :key="`${fullscreenNode.id}-route-summary-${item.label}`">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </article>
              </div>
              <div class="stage-specific-detail-actions">
                <BaseButton type="button" @click="expandAllStageDetailSections(fullscreenNode)">全部展开</BaseButton>
                <BaseButton type="button" @click="collapseAllStageDetailSections(fullscreenNode)">全部收起</BaseButton>
              </div>
              <article
                v-for="section in interactionDetailSections(fullscreenNode)"
                :key="`${fullscreenNode.id}-spec-section-${section.title}`"
                class="interaction-spec-section"
                :class="{ collapsed: !isStageDetailSectionExpanded(fullscreenNode.id, section.title) }"
              >
                <button type="button" @click="toggleStageDetailSection(fullscreenNode.id, section.title)">
                  <b>{{ section.title }}</b>
                  <i>{{ isStageDetailSectionExpanded(fullscreenNode.id, section.title) ? '−' : '+' }}</i>
                </button>
                <span
                  v-for="item in section.items"
                  v-show="isStageDetailSectionExpanded(fullscreenNode.id, section.title)"
                  :key="`${fullscreenNode.id}-${section.title}-${item}`"
                >
                  {{ item }}
                </span>
              </article>
            </section>
          </div>
          <div v-else-if="isVisualGalleryDetail(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="visual-gallery-detail">
            <section class="visual-gallery-preview">
              <header>
                <strong>高保真图片</strong>
                <small>{{ artifactStatusLabel(fullscreenNode) }}</small>
              </header>
              <div v-if="visualPreviewImage(fullscreenNode)" class="visual-image-result" :class="visualCanvasSurfaceClass(fullscreenNode)">
                <img :src="visualPreviewImage(fullscreenNode)" :alt="`${fullscreenNode.title} 高保真图`" @load="recordVisualImageNaturalRatio(fullscreenNode, $event)" />
                <span v-if="visualImageAspectRatioLabel(fullscreenNode)" class="visual-image-ratio-badge">{{ visualImageAspectRatioLabel(fullscreenNode) }}</span>
                <div v-if="isNodeActuallyLoading(fullscreenNode)" class="visual-image-generating-overlay">
                  <span class="loading-spinner-large"></span>
                  <strong>生成中</strong>
                </div>
                <div class="visual-image-tools" aria-label="图片操作">
                  <BaseIconButton label="下载至本地" type="button" title="下载至本地" aria-label="下载至本地" @click="downloadVisualImage(fullscreenNode)">
                    <Download class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  </BaseIconButton>
                  <BaseIconButton label="放大预览" type="button" title="放大预览" aria-label="放大预览" @click="openVisualImagePreview(fullscreenNode)">
                    <Maximize2 class="ui-icon" aria-hidden="true" :stroke-width="2" />
                  </BaseIconButton>
                </div>
                <small>{{ visualPreview(fullscreenNode).provider || visualPreview(fullscreenNode).model || '已生成图片' }}</small>
              </div>
              <div v-else-if="isNodeActuallyLoading(fullscreenNode)" class="visual-image-placeholder is-generating">
                <span>生成中</span>
                <p>{{ visualCanvasPlaceholderDescription(fullscreenNode, 'generating') }}</p>
              </div>
              <div v-else-if="visualPreviewNeedsConfiguration(fullscreenNode)" class="visual-image-config-required">
                <strong>需要配置图片生成模型</strong>
                <p>{{ visualPreview(fullscreenNode).configurationMessage || '图片生成模型未配置，配置后可生成高保真图。' }}</p>
              </div>
              <div v-else class="visual-image-placeholder">
                <span>待生成</span>
                <p>{{ visualCanvasPlaceholderDescription(fullscreenNode, 'pending') }}</p>
              </div>
              <div v-if="generationActions(fullscreenNode).length" class="stage-detail-generation-actions">
                <BaseButton
                  v-for="action in generationActions(fullscreenNode)"
                  :key="action.id || action.label"
                  variant="primary"
                  type="button"
                  :disabled="isNodeActuallyLoading(fullscreenNode)"
                  @click="runFullscreenGenerationAction(fullscreenNode, action)"
                >
                  {{ visualGenerationButtonLabel(fullscreenNode, action) }}
                </BaseButton>
              </div>
            </section>
            <section class="visual-gallery-notes">
              <strong>视觉与 Figma 准备</strong>
              <article
                v-for="section in visualBriefSections(fullscreenNode)"
                :key="`${fullscreenNode.id}-visual-brief-${section.title}`"
                class="visual-brief-section"
              >
                <b>{{ section.title }}</b>
                <span v-for="item in section.items" :key="`${fullscreenNode.id}-${section.title}-${item}`">{{ item }}</span>
              </article>
              <small>{{ visualBrief(fullscreenNode).figmaHandoff?.ready ? '后续可接 Figma 页面生成与编辑。' : '等待视觉信息补齐。' }}</small>
            </section>
            <section class="visual-gallery-page-overview">
              <header>
                <strong>所有页面高保真图</strong>
                <small>展示当前 UI 视觉阶段的全部页面，可逐页生成或查看状态。</small>
              </header>
              <div class="visual-gallery-page-grid">
                <article
                  v-for="pageNode in visualStagePages(fullscreenNode)"
                  :key="`${fullscreenNode.id}-visual-page-${pageNode.id}`"
                  class="visual-gallery-page-card"
                  :class="{ active: pageNode.id === fullscreenNode.id }"
                >
                  <div class="visual-gallery-page-thumb">
                    <img v-if="visualPreviewImage(pageNode)" :src="visualPreviewImage(pageNode)" :alt="`${pageNode.title} 高保真图`" />
                    <span v-else>{{ isNodeActuallyLoading(pageNode) ? '生成中' : visualPreviewNeedsConfiguration(pageNode) ? '待配置' : '待生成' }}</span>
                  </div>
                  <div>
                    <strong>{{ pageNode.title }}</strong>
                    <small>{{ artifactStatusLabel(pageNode) }}</small>
                  </div>
                  <BaseButton
                    v-if="generationActions(pageNode).length"
                    type="button"
                    :disabled="isNodeActuallyLoading(pageNode)"
                    @click="runFullscreenGenerationAction(pageNode, generationActions(pageNode)[0])"
                  >
                    {{ visualGenerationButtonLabel(pageNode, generationActions(pageNode)[0]) }}
                  </BaseButton>
                </article>
              </div>
            </section>
          </div>
          <div v-else-if="isPreviewCodeDetail(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="preview-code-detail">
            <article class="preview-code-result-card">
              <header class="preview-code-result-head">
                <div class="preview-code-result-title">
                  <strong>HTML 渲染</strong>
                  <small>{{ codePreview(fullscreenNode).previewSummary || '可检索布局 HTML，不是截图' }}</small>
                </div>
                <div class="preview-code-tabs" role="tablist" aria-label="HTML 详情切换">
                  <button
                    class="preview-code-tab"
                    :class="{ active: fullscreenCodeDetailTab(fullscreenNode) === 'render' }"
                    type="button"
                    role="tab"
                    :aria-selected="String(fullscreenCodeDetailTab(fullscreenNode) === 'render')"
                    data-preview-code-tab="render"
                    @click="setFullscreenCodeDetailTab(fullscreenNode, 'render')"
                  >
                    HTML 渲染
                  </button>
                  <button
                    class="preview-code-tab"
                    :class="{ active: fullscreenCodeDetailTab(fullscreenNode) === 'source' }"
                    type="button"
                    role="tab"
                    :aria-selected="String(fullscreenCodeDetailTab(fullscreenNode) === 'source')"
                    data-preview-code-tab="source"
                    @click="setFullscreenCodeDetailTab(fullscreenNode, 'source')"
                  >
                    源码展示
                  </button>
                </div>
              </header>
              <section
                v-show="fullscreenCodeDetailTab(fullscreenNode) === 'render'"
                class="preview-code-panel preview-code-render-panel is-active"
                data-preview-code-panel="render"
              >
                <div class="preview-code-toolbar">
                  <span class="preview-code-toolbar-label">预览尺寸</span>
                  <div class="preview-code-size-group" role="group" aria-label="预览尺寸">
                    <button
                      v-for="width in [390, 768, 1440]"
                      :key="`${fullscreenNode.id}-preview-size-${width}`"
                      class="preview-code-size-button"
                      :class="{ active: previewCodeFrameWidth(fullscreenNode) === width }"
                      type="button"
                      :aria-pressed="String(previewCodeFrameWidth(fullscreenNode) === width)"
                      @click="setPreviewCodeFrameWidth(fullscreenNode, width)"
                    >
                      {{ width }}
                    </button>
                  </div>
                </div>
                <div class="preview-code-stage">
                  <div class="preview-code-frame-wrap" :style="{ width: `${previewCodeFrameWidth(fullscreenNode)}px` }">
                    <iframe
                      v-if="previewCodeSrcdoc(fullscreenNode)"
                      class="generated-preview-frame"
                      :style="{ width: `${previewCodeFrameWidth(fullscreenNode)}px` }"
                      :srcdoc="previewCodeSrcdoc(fullscreenNode)"
                      title="HTML 运行预览"
                      sandbox="allow-forms allow-scripts"
                    ></iframe>
                    <div v-else class="preview-code-device">
                      <span>{{ fullscreenNode.title }}</span>
                      <small>生成后在这里预览页面效果。</small>
                    </div>
                  </div>
                </div>
                <div v-if="generationActions(fullscreenNode).length" class="stage-detail-generation-actions">
                  <BaseButton
                    v-for="action in generationActions(fullscreenNode)"
                    :key="action.id || action.label"
                    variant="primary"
                    type="button"
                    @click="runFullscreenGenerationAction(fullscreenNode, action)"
                  >
                    {{ codeGenerationButtonLabel(fullscreenNode, action) }}
                  </BaseButton>
                </div>
              </section>
              <section
                v-show="fullscreenCodeDetailTab(fullscreenNode) === 'source'"
                class="preview-code-panel preview-code-source-panel"
                data-preview-code-panel="source"
              >
                <div class="source-toolbar">
                  <span class="source-toolbar-label">{{ codePreviewSourceTitle(fullscreenNode) }} 源码</span>
                  <small>{{ selectedCodePreviewFile(fullscreenNode).path || codePreview(fullscreenNode).codeLanguage }}</small>
                </div>
                <div class="source-project-layout" aria-label="源码文件">
                  <aside class="source-file-tree">
                    <strong>文件</strong>
                    <button
                      v-for="file in codePreviewFiles(fullscreenNode)"
                      :key="`${fullscreenNode.id}-code-file-${file.path}`"
                      class="source-file"
                      :class="{ active: selectedCodePreviewFile(fullscreenNode).path === file.path }"
                      type="button"
                      :aria-current="selectedCodePreviewFile(fullscreenNode).path === file.path ? 'true' : undefined"
                      @click="selectCodePreviewFile(fullscreenNode, file.path)"
                    >
                      {{ file.path || 'index.html' }}
                    </button>
                  </aside>
                  <div class="source-file-editor">
                    <pre class="generated-source-code"><code>{{ selectedCodePreviewCode(fullscreenNode) }}</code></pre>
                  </div>
                </div>
              </section>
            </article>
            <section class="preview-code-summary">
              <header>
                <strong>工程产物概览</strong>
                <small>{{ previewCodeSummary(fullscreenNode).description }} · {{ engineeringPlan(fullscreenNode).previewTarget }}</small>
              </header>
              <div class="preview-code-meta-grid">
                <article>
                  <b>文件数量</b>
                  <span>{{ previewCodeSummary(fullscreenNode).fileCount }} 个</span>
                </article>
                <article>
                  <b>当前文件</b>
                  <span>{{ previewCodeSummary(fullscreenNode).currentFile }}</span>
                </article>
                <article>
                  <b>生成状态</b>
                  <span>{{ previewCodeSummary(fullscreenNode).status }}</span>
                </article>
                <article>
                  <b>预览来源</b>
                  <span>{{ previewCodeSummary(fullscreenNode).previewSource }}</span>
                </article>
              </div>
              <div class="engineering-plan-sections">
                <article
                  v-for="section in engineeringPlanSections(fullscreenNode)"
                  :key="`${fullscreenNode.id}-engineering-${section.title}`"
                >
                  <b>{{ section.title }}</b>
                  <span v-for="item in section.items" :key="`${fullscreenNode.id}-${section.title}-${item}`">{{ item }}</span>
                </article>
              </div>
            </section>
          </div>
          <div v-else-if="isAcceptanceDepositDetail(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="acceptance-deposit-detail">
            <section class="acceptance-delivery-package">
              <header>
                <strong>交付包摘要</strong>
                <small>把本次总流程产物汇总成可评审、可交付、可沉淀的一份结果。</small>
              </header>
              <p>{{ deliveryPackage(fullscreenNode).summary }}</p>
              <div class="acceptance-delivery-metrics">
                <article v-for="metric in deliveryPackage(fullscreenNode).metrics" :key="`${fullscreenNode.id}-delivery-metric-${metric.label}`">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                  <small>{{ metric.hint }}</small>
                </article>
              </div>
              <div class="acceptance-delivery-artifacts" aria-label="交付物">
                <span v-for="item in deliveryPackage(fullscreenNode).artifacts" :key="`${fullscreenNode.id}-delivery-artifact-${item}`">{{ item }}</span>
              </div>
            </section>
            <section class="acceptance-check-section">
              <header>
                <strong>验收清单</strong>
                <small>用于测试、评审和上线前回归。</small>
              </header>
              <label v-for="item in acceptanceChecklist(fullscreenNode)" :key="`${fullscreenNode.id}-check-${item}`" class="acceptance-check-row">
                <input type="checkbox" />
                <span>{{ item }}</span>
              </label>
            </section>
            <section v-if="ruleAcceptance(fullscreenNode).length" class="acceptance-rule-section">
              <header>
                <strong>业务规则验收</strong>
                <small>继承需求分析里的业务规则矩阵。</small>
              </header>
              <article v-for="item in ruleAcceptance(fullscreenNode)" :key="`${fullscreenNode.id}-rule-acceptance-${item.key}`">
                <b>{{ item.title }}</b>
                <span>{{ item.expected }}</span>
                <small>{{ item.priority }}</small>
              </article>
            </section>
            <section v-if="stateAcceptance(fullscreenNode).length" class="acceptance-state-section">
              <header>
                <strong>状态流验收</strong>
                <small>检查按钮、loading、成功、失败和完成态。</small>
              </header>
              <article v-for="item in stateAcceptance(fullscreenNode)" :key="`${fullscreenNode.id}-state-acceptance-${item.key}`">
                <b>{{ item.title }}</b>
                <span>{{ item.expected }}</span>
              </article>
            </section>
            <section v-if="nonFunctionalAcceptance(fullscreenNode).length" class="acceptance-non-functional-section">
              <header>
                <strong>非功能验收</strong>
                <small>确保产物可读、可恢复、可回归。</small>
              </header>
              <article v-for="item in nonFunctionalAcceptance(fullscreenNode)" :key="`${fullscreenNode.id}-non-functional-${item.key}`">
                <b>{{ item.title }}</b>
                <span>{{ item.expected }}</span>
              </article>
            </section>
            <section class="acceptance-risk-section">
              <header>
                <strong>风险项</strong>
                <small>需要在交付前确认或留痕。</small>
              </header>
              <article v-for="item in riskItems(fullscreenNode)" :key="`${fullscreenNode.id}-risk-${item}`" class="acceptance-risk-card">
                {{ item }}
              </article>
            </section>
            <section class="acceptance-knowledge-section">
              <header>
                <strong>知识库沉淀内容</strong>
                <small>沉淀后会作为下次项目需求分析的上下文。</small>
              </header>
              <article v-for="item in knowledgeDeposits(fullscreenNode)" :key="`${fullscreenNode.id}-deposit-${item}`" class="acceptance-knowledge-card">
                {{ item }}
              </article>
              <BaseButton variant="primary" type="button" @click="$emit('persist-knowledge')">
                沉淀到知识库
              </BaseButton>
            </section>
          </div>
          <div v-if="!isNodeActuallyLoading(fullscreenNode) && !isStageSpecificDetail(fullscreenNode) && !isAgentConfirmationNode(fullscreenNode) && !shouldUseRequirementPipelineDetail(fullscreenNode) && !shouldUseRequirementSectionDetail(fullscreenNode)" v-show="!isFullscreenEditing(fullscreenNode)" class="canvas-detail-tree" :class="{ 'is-hidden-for-pure-content': isPureContentNode(fullscreenNode) }">
            <div v-if="visibleTreeItems(fullscreenNode).some((item) => item.hasChildren)" class="canvas-detail-tree-actions">
              <BaseButton type="button" @click="expandAllTreeItems(fullscreenNode)">全部展开</BaseButton>
              <BaseButton type="button" @click="collapseAllTreeItems(fullscreenNode)">全部收起</BaseButton>
            </div>
            <div v-if="cleanNodeDisplayCopy(fullscreenNode.summary)" class="canvas-tree-node canvas-tree-summary">
              <i></i>
              <span>{{ cleanNodeDisplayCopy(fullscreenNode.summary) }}</span>
            </div>
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
        <aside v-if="fullscreenRightQuestions(fullscreenNode).length && !isFullscreenEditing(fullscreenNode)" class="canvas-detail-right-questions">
          <header>
            <strong>待确认问题</strong>
            <small>放在右侧，方便边看产出边补充</small>
          </header>
          <ul>
            <li v-for="item in fullscreenRightQuestions(fullscreenNode)" :key="`${fullscreenNode.id}-right-question-${item}`">{{ item }}</li>
          </ul>
        </aside>
      </div>
    </section>
  </div>

  <div v-if="visualImagePreview" class="visual-image-preview-modal" @click.self="closeVisualImagePreview">
    <section>
      <header>
        <strong>{{ visualImagePreview.title }}</strong>
        <BaseIconButton label="关闭预览" type="button" title="关闭预览" aria-label="关闭预览" @click="closeVisualImagePreview">
          <X class="ui-icon" aria-hidden="true" :stroke-width="2" />
        </BaseIconButton>
      </header>
      <img :src="visualImagePreview.src" :alt="visualImagePreview.title" />
    </section>
  </div>
  <div v-if="codeCopyToastVisible" class="agent-copy-toast workflow-code-copy-toast" role="status">复制成功</div>
</template>

<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bot, Download, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { BaseButton, BaseIconButton, BaseTabs, BaseTextarea } from '../../../components/base'

// Legacy test anchors:
// <textarea v-model="fullscreenEditSummary"
// <textarea v-model="fullscreenEditContentText"
// <textarea v-model="fullscreenEditDetailText"

const props = defineProps({
  title: { type: String, default: '' },
  parsedCount: { type: Number, default: 0 },
  skillLabel: { type: String, default: '' },
  totalFlow: { type: Object, default: null },
  canvas: { type: Object, default: () => ({ nodes: [], edges: [], orderedTabs: [] }) },
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  activeNode: { type: Object, default: null },
  fullscreenNode: { type: Object, default: null },
  fullscreenEditNodeId: { type: String, default: '' },
  routing: { type: Object, default: () => ({}) },
  aiSummary: { type: Object, default: null },
  generation: { type: Object, default: () => ({}) },
  versionMeta: { type: Object, default: () => ({}) },
  versionHistory: { type: Array, default: () => [] },
  qualityGate: { type: Object, default: () => ({}) },
  knowledgeStatus: { type: Object, default: () => ({}) },
  stageStatuses: { type: Object, default: () => ({}) },
  showStageAgentWorkbench: { type: Boolean, default: false },
  zoom: { type: Number, default: 1 }
})

const emit = defineEmits(['back', 'zoom', 'save', 'convert-requirement', 'transfer-other-skill', 'persist-knowledge', 'open-knowledge', 'update-stage', 'update-slice', 'regenerate-stage', 'focus-node', 'open-agent', 'close-fullscreen', 'edit-node', 'quick-action', 'rollback-version'])

const viewportRef = ref(null)
const versionMenuRef = ref(null)
const spotlightNodeId = ref('')
const expandedTreeItems = ref(new Set())
const rollbackPreviewVersionId = ref('')
const showVersionHistory = ref(false)
const selectedCodePreviewFiles = ref({})
const fullscreenCodeDetailTabs = ref({})
const previewCodeFrameWidths = ref({})
const codeCopyToastVisible = ref(false)
const fullscreenPageDetailModes = ref({})
const visualImagePreview = ref(null)
const visualImageNaturalRatios = ref({})
const fullscreenEditingNodeId = ref('')
const fullscreenEditSummary = ref('')
const fullscreenEditContentText = ref('')
const fullscreenEditDetailText = ref('')
let spotlightTimer = null
let codeCopyToastTimer = null
const CANVAS_SURFACE_WIDTH = 24000
const CANVAS_SURFACE_HEIGHT = 32000
const CANVAS_FOCUS_SAFE_GUTTER = 96
const CANVAS_TITLE_MAX_LENGTH = 16
const DEFAULT_TOTAL_FLOW_STAGES = [
  { id: 'requirement-dissection', name: '需求分析' },
  { id: 'interaction-lofi', name: '交互低保' },
  { id: 'ui-visual', name: 'UI视觉' },
  { id: 'html-output', name: 'HTML' },
  { id: 'vue-output', name: 'Vue' },
  { id: 'acceptance-deposit', name: '验收沉淀' }
]
const TOTAL_FLOW_STAGE_ORDER = [
  'requirement-dissection',
  'interaction-lofi',
  'ui-visual',
  'html-output',
  'vue-output',
  'acceptance-deposit'
]
const DEPRECATED_TOTAL_FLOW_STAGE_IDS = new Set(['wireframe-preview', 'requirement-slicing', 'gap-confirmation'])
const DEPRECATED_TOTAL_FLOW_STAGE_NAMES = new Set(['低保预览', '小需求切片', '缺口确认'])
const AGENT_WORKBENCH_STAGE_IDS = [
  'requirement-dissection',
  'requirement-deconstruction'
]
const AGENT_WORKBENCH_STAGE_NAMES = ['需求分析', '需求解剖']
const fullCanvasTitle = computed(() => String(props.title || '需求分析画布').trim() || '需求分析画布')
const displayCanvasTitle = computed(() =>
  fullCanvasTitle.value.length > CANVAS_TITLE_MAX_LENGTH
    ? fullCanvasTitle.value.slice(0, CANVAS_TITLE_MAX_LENGTH)
    : fullCanvasTitle.value
)
const analysisVersionMeta = computed(() => props.versionMeta || {})
const analysisQualityGate = computed(() => props.qualityGate || {})
const activeStageOverrideId = ref('')
const activeSliceOverrideId = ref('')
const activeCanvasTabId = computed({
  get: () => props.activeNode?.id || '',
  set: (value) => {
    if (value) emit('focus-node', value)
  }
})
const canvasTabItems = computed(() =>
  (shouldRenderAgentWorkbench.value
    ? (props.canvas.orderedTabs || [])
    : activeSliceStageCanvasNodes.value.map((node) => ({ key: node.id, label: node.title || node.id }))
  ).map((tab) => ({
    value: tab.key,
    label: tab.label
  }))
)
const requirementSlices = computed(() => Array.isArray(props.totalFlow?.requirementSlices) ? props.totalFlow.requirementSlices : [])
const activeSliceId = computed(() => activeSliceOverrideId.value || props.totalFlow?.activeSliceId || requirementSlices.value[0]?.id || '')
const resolvedActiveSliceId = computed(() =>
  requirementSlices.value.some((slice) => slice.id === activeSliceId.value)
    ? activeSliceId.value
    : requirementSlices.value[0]?.id || ''
)
const activeSourceSliceId = computed(() => {
  const sourceSliceId = sourceSliceIdForActiveSlice(resolvedActiveSliceId.value)
  if (!filterableRequirementSlices.value.length) return ''
  return filterableRequirementSlices.value.some((slice) => sourceSliceIdForActiveSlice(slice.id) === sourceSliceId)
    ? sourceSliceId
    : sourceSliceIdForActiveSlice(filterableRequirementSlices.value[0]?.id || '')
})
const sliceFilterableStageIds = computed(() => new Set([
  'interaction-lofi',
  'ui-visual',
  'html-output'
]))
const isTotalFlowCanvas = computed(() =>
  props.skillLabel === '总流程' ||
  props.totalFlow?.mode === 'total-design-flow' ||
  props.totalFlow?.type === 'total-design-flow' ||
  Array.isArray(props.totalFlow?.stages) ||
  Array.isArray(props.totalFlow?.requirementSlices)
)
const totalFlowStages = computed(() => {
  const stages = normalizeTotalFlowStages(Array.isArray(props.totalFlow?.stages) ? props.totalFlow.stages : [])
  if (stages.length) return stages
  return isTotalFlowCanvas.value ? DEFAULT_TOTAL_FLOW_STAGES : []
})
const rawActiveStageId = computed(() => activeStageOverrideId.value || props.totalFlow?.currentStage || totalFlowStages.value[0]?.id || '')
const activeStageId = computed(() => normalizeActiveStageId(rawActiveStageId.value))
const activeStageLabel = computed(() =>
  totalFlowStages.value.find((stage) => stage.id === activeStageId.value)?.name || '阶段确认'
)
const isAgentWorkbenchStage = computed(() => isStageAgentWorkbenchId(activeStageId.value, activeStageLabel.value))
const activeStageIndex = computed(() =>
  Math.max(0, totalFlowStages.value.findIndex((stage) => stage.id === activeStageId.value))
)
const visibleTotalFlowStages = computed(() =>
  totalFlowStages.value.filter((stage) => !isHiddenAgentPreparationStage(stage.id))
)
const nextWorkflowStage = computed(() => totalFlowStages.value[activeStageIndex.value + 1] || null)
const canAdvanceWorkflowStage = computed(() => Boolean(props.totalFlow && nextWorkflowStage.value?.id))
const loadedStageIds = computed(() => {
  const ids = new Set()
  Object.entries(props.stageStatuses || {}).forEach(([stageId, status]) => {
    if (['generating', 'paused'].includes(status?.status) || (status?.status === 'completed' && stageCanvasHasRenderedContent(stageId))) {
      ids.add(stageId)
    }
  })
  Object.entries(props.totalFlow?.stageStatuses || {}).forEach(([stageId, status]) => {
    if (['generating', 'paused'].includes(status?.status) || (status?.status === 'completed' && stageCanvasHasRenderedContent(stageId))) {
      ids.add(stageId)
    }
  })
  Object.keys(props.totalFlow?.stageCanvases || {}).forEach((stageId) => {
    if (stageCanvasHasRenderedContent(stageId)) ids.add(stageId)
  })
  return ids
})
const activeStageCanvas = computed(() => props.totalFlow?.stageCanvases?.[activeStageId.value] || null)
const forceAgentWorkbenchForActiveStage = computed(() =>
  isTotalFlowCanvas.value && isAgentWorkbenchStageId(activeStageId.value)
)
const stageCanvasNodeSource = computed(() => {
  const stageCanvas = activeStageCanvas.value
  if ((forceAgentWorkbenchForActiveStage.value || isAgentWorkbenchStage.value) && !stageCanvas) return []
  // Stage canvas nodes are the canonical source for generated artifacts. Props
  // nodes are only a display fallback when the active stage has no stage canvas.
  return Array.isArray(stageCanvas?.nodes) && stageCanvas.nodes.length
    ? stageCanvas.nodes
    : props.nodes
})
const filterableRequirementSlices = computed(() =>
  requirementSlices.value.filter((slice) => {
    const sourceSliceId = sourceSliceIdForActiveSlice(slice?.id || '')
    return Boolean(sourceSliceId) && stageCanvasNodeSource.value.some((node) => nodeMatchesSlice(node, sourceSliceId))
  })
)
const shouldShowRequirementSlices = computed(() =>
  !shouldRenderAgentWorkbench.value &&
  !isRequirementDissectionStageId(activeStageId.value) &&
  filterableRequirementSlices.value.length > 1
)
const activeSliceStageCanvasNodes = computed(() => {
  if (!sliceFilterableStageIds.value.has(activeStageId.value) || !resolvedActiveSliceId.value) return stageCanvasNodeSource.value
  const nodes = stageCanvasNodeSource.value
  // Slice filtering must keep backend pageLayoutArtifact nodes. Only fall back
  // to plain page-derived nodes when the active slice has no stage artifacts.
  const filteredNodes = nodes.filter((node) => nodeMatchesActiveSlice(node))
  if (filteredNodes.length) return filteredNodes
  if (activeStageId.value === 'interaction-lofi') {
    const fallbackNodes = interactionLofiPageFallbackNodes.value
    return fallbackNodes.length ? fallbackNodes : nodes
  }
  return nodes
})
const stageHasAgentWorkbenchNode = computed(() =>
  activeStageCanvas.value?.agentWorkbench === true ||
  activeStageCanvas.value?.mode === 'stage-agent-workbench' ||
  stageCanvasNodeSource.value.some((node) => node?.agentWorkbench === true)
)
const shouldRenderAgentWorkbench = computed(() =>
  props.showStageAgentWorkbench &&
  isRequirementDissectionStageId(activeStageId.value) &&
  (forceAgentWorkbenchForActiveStage.value || isAgentWorkbenchStage.value || stageHasAgentWorkbenchNode.value)
)
const shouldRenderCanvasBoard = computed(() => true)
const shouldRenderCanvasTabs = computed(() => shouldRenderCanvasBoard.value && !shouldRenderAgentWorkbench.value)
const interactionLofiPageFallbackNodes = computed(() => {
  if (activeStageId.value !== 'interaction-lofi') return []
  return pageNodesForActiveSlice.value.map((page, index) => {
    const detail = props.totalFlow?.details?.[page.id] || props.totalFlow?.details?.[page.nodeId] || {}
    const detailSections = Array.isArray(page.detailSections) && page.detailSections.length
      ? page.detailSections
      : Array.isArray(detail.sections) ? detail.sections : []
    return {
      id: page.nodeId || page.id || `interaction-page-${index + 1}`,
      stageId: 'interaction-lofi',
      title: page.title || `页面 ${index + 1}`,
      summary: page.summary || detail.summary || `${page.title || `页面 ${index + 1}`} 的页面级交互节点。`,
      content: [
        page.goal ? `页面目标：${page.goal}` : '',
        page.route ? `跳转到哪个页面：${page.route}` : '',
        page.statusCount ? `状态数量：${page.statusCount}` : ''
      ].filter(Boolean),
      detailSections,
      detailLayout: 'interaction-page-split',
      wireframeTree: page.wireframeTree || detail.wireframeTree || [
        { label: page.title || `页面 ${index + 1}`, type: 'page', children: detailSections.map((section) => section.title).filter(Boolean).slice(0, 6) },
        { label: '主操作区', type: 'action', children: ['主按钮', '返回/取消', '异常提示'] },
        { label: '跳转关系', type: 'route', children: [pageRouteLabel(page)] }
      ],
      interactionSpec: page.interactionSpec || detail.interactionSpec || detailSections.flatMap((section) =>
        (Array.isArray(section.items) ? section.items : []).map((item) => `${section.title}：${item}`)
      ),
      quickActions: ['打开 Agent', '全屏'],
      width: 320,
      height: 220
    }
  })
})
const activeStageAgentNodes = computed(() => {
  const stageCanvas = props.totalFlow?.stageCanvases?.[activeStageId.value]
  if (isAgentWorkbenchStage.value && !stageCanvas) return [buildStageAgentFallbackNode()]
  const stageNodes = Array.isArray(stageCanvas?.nodes) ? stageCanvas.nodes : []
  const matchingNodes = stageNodes.filter((node) =>
    !node?.stageId || node.stageId === activeStageId.value || isStageAgentWorkbenchId(node.stageId, activeStageLabel.value)
  )
  return matchingNodes.length ? matchingNodes : [buildStageAgentFallbackNode()]
})
const activeStageDisplayNodes = computed(() => {
  if (!shouldRenderAgentWorkbench.value) return activeSliceStageCanvasNodes.value
  if (isRequirementDissectionStageId(activeStageId.value) && activeStageAgentNodes.value.length > 1) return activeStageAgentNodes.value
  const agentNode = buildStageAgentNodeByStageId[activeStageId.value]?.() || buildStageAgentAggregateNode(activeStageAgentNodes.value)
  return agentNode ? [agentNode] : []
})
const displayNodes = computed(() => layoutCanvasNodes(activeStageDisplayNodes.value, { compactGrid: isTotalFlowCanvas.value && !shouldRenderAgentWorkbench.value }))
const stageCanvasNodes = computed(() => {
  const nodes = shouldRenderAgentWorkbench.value ? activeStageAgentNodes.value : activeSliceStageCanvasNodes.value
  return layoutCanvasNodes(nodes, { compactGrid: isTotalFlowCanvas.value && !shouldRenderAgentWorkbench.value })
})
const stageAgentNodes = computed(() => {
  const nodes = shouldRenderAgentWorkbench.value ? activeStageAgentNodes.value : stageCanvasNodes.value
  return Array.isArray(nodes) && nodes.length ? nodes : [buildStageAgentFallbackNode()]
})
const buildStageAgentNodeByStageId = {
  'requirement-dissection': buildRequirementDissectionAgentNode
}
const stageAgentAggregateNode = computed(() =>
  activeStageCanvas.value?.agentNode ? normalizeStageAgentNode(activeStageCanvas.value.agentNode) :
  buildStageAgentNodeByStageId[activeStageId.value]?.() || buildStageAgentAggregateNode(stageAgentNodes.value)
)
const stageAgentNode = computed(() =>
  stageAgentAggregateNode.value ||
  stageAgentNodes.value.find((node) => node.stageId === activeStageId.value) ||
  stageAgentNodes.value[0] ||
  buildStageAgentFallbackNode()
)
const stageAgentSummary = computed(() => stageAgentDisplayCopy(stageAgentNode.value?.summary || ''))
const stageAgentSections = computed(() => {
  const node = stageAgentNode.value
  const sections = (Array.isArray(node.detailSections) ? node.detailSections : [])
    .map((section) => ({
      title: String(section?.title || '').trim(),
      items: (Array.isArray(section?.items) ? section.items : [])
        .map((item) => treeItemLabel(item))
        .filter((item) => !isStageAgentSystemPlaceholderItem(item))
        .filter(Boolean)
    }))
    .filter((section) => section.title && section.items.length)
    .filter((section) => !isStageAgentSystemPlaceholderSection(section))
  const contentItems = (Array.isArray(node.content) ? node.content : [])
    .map((item) => treeItemLabel(item))
    .filter((item) => !isStageAgentSystemPlaceholderItem(item))
    .filter(Boolean)
  const pendingSections = sections.filter((section) => /待确认|问题|风险|缺口/.test(section.title))
  const otherSections = sections.filter((section) => !pendingSections.includes(section))
  return [
    ...pendingSections,
    ...(contentItems.length ? [{ title: '阶段内容', items: contentItems }] : []),
    ...otherSections
  ].slice(0, 5)
})
const stageAgentQuickReplies = computed(() => {
  const base = Array.isArray(stageAgentNode.value.quickActions) ? stageAgentNode.value.quickActions : []
  return base
    .map((reply) => String(reply || '').trim())
    .filter(Boolean)
    .slice(0, 5)
})
function stageStatus(stageId = '') {
  return props.stageStatuses?.[stageId]?.status || props.totalFlow?.stageStatuses?.[stageId]?.status || 'waiting'
}

function stageRuntime(stageId = '') {
  const runtime = props.totalFlow?.stageRuntime?.[stageId]
  return runtime && typeof runtime === 'object' ? runtime : null
}

function stageCanvasHasRenderedContent(stageId = '') {
  const stageCanvas = props.totalFlow?.stageCanvases?.[stageId]
  const nodes = Array.isArray(stageCanvas?.nodes) ? stageCanvas.nodes : []
  if (!nodes.length) return false
  return nodes.some((node) => {
    const nodeId = String(node?.id || '').trim()
    const contentStatus = String(node?.contentStatus || '').trim()
    const contentSource = String(node?.contentSource || '').trim()
    if (!node || node.loading === true) return false
    if (nodeId === `${stageId}-loading` || nodeId === 'model-generating') return false
    return contentStatus !== 'model-pending' &&
      contentStatus !== 'waiting-model' &&
      contentSource !== 'model-pending'
  })
}

function isStageAgentSystemPlaceholderSection(section = {}) {
  return /内容状态|系统状态|生成状态/.test(String(section.title || ''))
}

function isStageAgentSystemPlaceholderItem(item = '') {
  return /model-pending|fallback-structure|已先填入当前可用数据|大模型结果返回后会自动增强|模型增强中|等待大模型返回|模型产出来源|模型产出状态|模型产出阶段|基础结构|不是完整大模型分析结论/.test(String(item || ''))
}

function stageAgentDisplayCopy(value = '') {
  return String(value || '')
    .replace(/模型增强中：?/g, '')
    .replace(/大模型结果返回后会自动增强。?/g, '')
    .replace(/已先填入当前可用数据。?/g, '')
    .replace(/模型产出来源：?.*$/gm, '')
    .replace(/模型产出状态：?.*$/gm, '')
    .replace(/模型产出阶段：?.*$/gm, '')
    .replace(/模型产出产品\/需求：?/g, '产品/需求：')
    .replace(/模型产出文档数量：?/g, '文档数量：')
    .replace(/模型产出来源摘要：?/g, '来源摘要：')
    .replace(/模型产出输入来源：?/g, '输入来源：')
    .replace(/模型产出/g, '')
    .replace(/基础结构：?/g, '')
    .replace(/这是系统基础结构，不是完整大模型分析结论。?/g, '')
    .replace(/fallback-structure/g, '')
    .trim()
}

function stageConfirmation(stageId = '') {
  return props.totalFlow?.stageConfirmations?.[stageId] || null
}

function previousStageIdForCanvasStage(stageId = '') {
  const index = totalFlowStages.value.findIndex((stage) => stage.id === stageId)
  if (index <= 0) return ''
  return totalFlowStages.value[index - 1]?.id || ''
}

function isRequirementDissectionStageId(stageId = '') {
  return String(stageId || '').trim() === 'requirement-dissection'
}

function hasRequirementDissectionPageFrameworkConfirmation() {
  const confirmation = stageConfirmation('requirement-dissection')
  if (!confirmation) return false
  const actionText = String(confirmation.action || confirmation.summary || '').trim()
  return /输出页面框架|页面框架|确认|进入/.test(actionText) || Boolean(confirmation.confirmedAt)
}

function formatStageConfirmationTime(value = '') {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const pageNodesForActiveSlice = computed(() => {
  const pages = Array.isArray(props.totalFlow?.pages) ? props.totalFlow.pages : []
  return pages.filter((page) => !activeSourceSliceId.value || page.sliceId === activeSourceSliceId.value)
})

function sourceSliceIdForActiveSlice(sliceId = '') {
  const normalizedSliceId = String(sliceId || '').trim()
  const slice = requirementSlices.value.find((item) => item?.id === normalizedSliceId || item?.sourceSliceId === normalizedSliceId)
  return String(slice?.sourceSliceId || normalizedSliceId).trim()
}

function nodeMatchesSlice(node = {}, sourceSliceId = '') {
  if (!sourceSliceId) return true
  if (node.sliceId === sourceSliceId || node.sourceSliceId === sourceSliceId) return true
  return Array.isArray(node.relatedSliceIds) && node.relatedSliceIds.includes(sourceSliceId)
}

function nodeMatchesActiveSlice(node = {}) {
  const sourceSliceId = activeSourceSliceId.value
  return nodeMatchesSlice(node, sourceSliceId)
}

function pageRouteLabel(page = {}) {
  const detailRoute = (Array.isArray(page.detailSections) ? page.detailSections : [])
    .find((section) => /跳转|下一页|去向/.test(String(section?.title || '')))
    ?.items?.[0]
  const nodeId = resolvePageNodeId(page)
  const node = nodeId ? nodeById.value.get(nodeId) : null
  const specRoute = Array.isArray(node?.interactionSpec)
    ? node.interactionSpec.find((item) => /跳转|下一页|去向/.test(String(item?.field || item?.label || item?.title || item || '')))
    : null
  const rawLabel = detailRoute || specRoute?.value || specRoute?.content || specRoute?.label || specRoute || ''
  const label = String(rawLabel || '').replace(/^跳转(?:关系|到哪个页面)?[：:]\s*/, '').trim()
  return label || '查看页面节点'
}
const canSaveFullscreenEdit = computed(() =>
  Boolean(fullscreenEditingNodeId.value && (
    fullscreenEditSummary.value.trim() ||
    fullscreenEditContentText.value.trim() ||
    fullscreenEditDetailText.value.trim()
  ))
)
const modelReturnSummarySections = computed(() => {
  const sections = [
    { title: '目标', items: aiSummaryItems(props.aiSummary?.userGoal || props.aiSummary?.items || []) },
    { title: '核心模块', items: aiSummaryItems(props.aiSummary?.coreModules || []) },
    { title: '推荐流程', items: aiSummaryItems(props.aiSummary?.recommendedFlow || []).map((item, index) => `${index + 1}. ${item}`) },
    { title: '待确认', items: aiSummaryItems(props.aiSummary?.questions || []) }
  ].filter((section) => section.items.length)
  return sections.length ? sections : [{ title: '模型说明', items: aiSummaryItems(props.aiSummary?.summary || []) }]
})
const modelReturnSummaryTitle = computed(() => '模型返回')
const modelReturnSummaryHint = computed(() => '模型对当前需求的完整理解会先展示在这里。')

function aiSummaryItems(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  const text = String(value || '').trim()
  return text ? [text] : []
}

function normalizeTotalFlowStages(stages = []) {
  const orderMap = new Map(TOTAL_FLOW_STAGE_ORDER.map((stageId, index) => [stageId, index]))
  const normalizedStages = stages
    .filter((stage) => stage?.id && stage?.name)
    .flatMap((stage) => {
      if (stage.id === 'html-vue' || stage.name === 'HTML / Vue') {
        return [
          { ...stage, id: 'html-output', name: 'HTML' },
          { ...stage, id: 'vue-output', name: 'Vue' }
        ]
      }
      return [stage]
    })
    .map((stage) => ({
      ...stage,
      id: String(stage.id || '').trim(),
      name: stage.id === 'requirement-dissection' || stage.name === '需求解剖'
        ? '需求分析'
        : String(stage.name || '').trim()
    }))
    .filter((stage) =>
      !DEPRECATED_TOTAL_FLOW_STAGE_IDS.has(stage.id) &&
      !DEPRECATED_TOTAL_FLOW_STAGE_NAMES.has(stage.name)
    )
    .sort((stageA, stageB) =>
      (orderMap.get(stageA.id) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(stageB.id) ?? Number.MAX_SAFE_INTEGER)
    )
  const seen = new Set()
  const uniqueStages = normalizedStages.filter((stage) => {
    if (seen.has(stage.id)) return false
    seen.add(stage.id)
    return true
  })
  return uniqueStages.concat(
    DEFAULT_TOTAL_FLOW_STAGES.filter((stage) => !seen.has(stage.id))
  ).sort((stageA, stageB) =>
    (orderMap.get(stageA.id) ?? Number.MAX_SAFE_INTEGER) -
    (orderMap.get(stageB.id) ?? Number.MAX_SAFE_INTEGER)
  )
}

function normalizeActiveStageId(stageId = '') {
  const normalizedStageId = String(stageId || '').trim()
  if (totalFlowStages.value.some((stage) => stage.id === normalizedStageId)) return normalizedStageId
  return totalFlowStages.value[0]?.id || ''
}

function isStageAgentWorkbenchId(stageId = '', stageName = '') {
  const normalizedId = String(stageId || '').trim()
  const normalizedName = String(stageName || '').trim()
  return AGENT_WORKBENCH_STAGE_IDS.includes(normalizedId) ||
    AGENT_WORKBENCH_STAGE_NAMES.includes(normalizedName) ||
    /需求分析|需求解剖/.test(normalizedName)
}

function isAgentWorkbenchStageId(stageId = '') {
  const stage = totalFlowStages.value.find((item) => item.id === stageId) || {}
  return isStageAgentWorkbenchId(stageId, stage.name || '')
}

function isHiddenAgentPreparationStage(stageId = '') {
  return DEPRECATED_TOTAL_FLOW_STAGE_IDS.has(String(stageId || '').trim())
}

function buildStageAgentFallbackNode() {
  const stageName = activeStageLabel.value || '当前阶段'
  return {
    id: `${activeStageId.value || 'stage'}-agent`,
    stageId: activeStageId.value,
    title: stageName,
    summary: `在「${stageName}」阶段继续用 Agent 对话确认信息，确认后再进入下一阶段。`,
    content: [
      `围绕「${stageName}」补充需求、约束和待确认问题。`,
      '确认清楚后点击下一步进入后续画布阶段。'
    ],
    agentScope: `确认「${stageName}」阶段信息。`,
    quickActions: [],
    detailSections: [
      { title: '待确认问题', items: ['还有不清楚的信息时，可以直接在下方输入补充或提问。'] },
      { title: '阶段目标', items: [`把「${stageName}」阶段需要确认的信息沉淀为后续画布输入。`] }
    ]
  }
}

function normalizeStageAgentNode(node = {}) {
  if (!node || typeof node !== 'object') return null
  const stageName = activeStageLabel.value || '当前阶段'
  return {
    ...node,
    id: node.id || `${activeStageId.value || 'stage'}-agent`,
    stageId: node.stageId || activeStageId.value,
    title: node.title || stageName,
    summary: node.summary || `在「${stageName}」阶段继续用 Agent 对话确认信息，确认后再进入下一阶段。`,
    content: Array.isArray(node.content) ? node.content : [node.content].filter(Boolean),
    agentScope: node.agentScope || `确认「${stageName}」阶段信息。`,
    quickActions: Array.isArray(node.quickActions) ? node.quickActions : [],
    detailSections: Array.isArray(node.detailSections) ? node.detailSections : [],
    projectFunctionMap: node.projectFunctionMap || props.totalFlow?.projectFunctionMap || null,
    requirementDissectionArtifact: node.requirementDissectionArtifact || props.totalFlow?.requirementDissectionArtifact || null
  }
}

function buildStageAgentAggregateNode(nodes = []) {
  const stageName = activeStageLabel.value || '当前阶段'
  const normalizedNodes = (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node && typeof node === 'object')
  if (!normalizedNodes.length) return buildStageAgentFallbackNode()
  const pendingItems = normalizedNodes.flatMap((node) =>
    (Array.isArray(node.detailSections) ? node.detailSections : [])
      .filter((section) => /待确认|问题|风险|缺口/.test(String(section?.title || '')))
      .flatMap((section) => Array.isArray(section.items) ? section.items : [])
  )
  return {
    id: `${activeStageId.value || 'stage'}-agent-aggregate`,
    stageId: activeStageId.value,
    title: stageName,
    summary: `${stageName} 已汇总 ${normalizedNodes.length} 个分析节点，可继续对话补齐后进入下一阶段。`,
    content: normalizedNodes.map((node) => `${node.title || node.id}：${stageAgentDisplayCopy(node.summary || node.content?.[0] || '')}`).filter(Boolean),
    agentScope: `确认「${stageName}」阶段信息。`,
    quickActions: normalizedNodes.flatMap((node) => Array.isArray(node.quickActions) ? node.quickActions : []).slice(0, 4),
    detailSections: [
      { title: '待确认问题', items: pendingItems.length ? pendingItems : ['暂无阻塞问题，可以继续补充信息或进入下一阶段。'] },
      { title: '阶段节点', items: normalizedNodes.map((node) => `${node.title || node.id}：${stageAgentDisplayCopy(node.summary || '')}`).filter(Boolean) }
    ]
  }
}

function buildRequirementDissectionAgentNode() {
  const stageName = activeStageLabel.value || '需求分析'
  const productName = props.totalFlow?.productName || props.title || '当前需求'
  const firstSlice = requirementSlices.value[0] || {}
  return {
    id: 'requirement-dissection-agent',
    stageId: activeStageId.value,
    title: stageName,
    summary: `先把「${productName}」的原始输入、文档、项目背景和待确认风险拆清楚。`,
    content: [
      `需求/项目：${productName}`,
      `小需求数量：${requirementSlices.value.length || 1}`,
      firstSlice.sourceExcerpt ? `来源片段：${firstSlice.sourceExcerpt}` : ''
    ].filter(Boolean),
    agentScope: '确认需求来源、主意图、事实/推断/风险边界。',
    quickActions: [],
    projectFunctionMap: props.totalFlow?.projectFunctionMap || null,
    requirementDissectionArtifact: props.totalFlow?.requirementDissectionArtifact || null,
    detailSections: [
      { title: '阶段目标', items: ['区分事实、推断和待确认风险', '避免直接跳到页面画布导致主意图误判'] },
      { title: '待确认问题', items: stageAgentNodes.value.flatMap((node) => node.detailSections || []).filter((section) => /待确认|风险|缺口/.test(String(section.title || ''))).flatMap((section) => section.items || []).slice(0, 6) }
    ]
  }
}

function workflowMessageText(message = {}) {
  const raw = message.content ?? message.text ?? message.message ?? ''
  if (Array.isArray(raw)) {
    return raw
      .map((item) => typeof item === 'string' ? item : (item?.text || item?.content || ''))
      .filter(Boolean)
      .join('\n')
  }
  if (raw && typeof raw === 'object') return raw.text || raw.content || JSON.stringify(raw)
  return String(raw || '').trim()
}

function showModelReturnSummary(node = {}) {
  return Boolean(
    node &&
    shouldShowModelReturnSummary() &&
    isModelReturnSummaryNode(node) &&
    !isFullscreenEditing(node) &&
    (props.aiSummary?.summary || modelReturnSummarySections.value.length)
  )
}

function showNodeOwnContentSummary(node = {}) {
  return Boolean(
    node &&
    !isFullscreenEditing(node) &&
    nodeOwnSummaryItems(node).length
  )
}

function nodeOwnSummaryItems(node = {}, limit = 0) {
  const contentItems = (Array.isArray(node.content) ? node.content : [])
    .map((item) => treeItemLabel(item))
    .filter(Boolean)
  const detailItems = (Array.isArray(node.detailSections) ? node.detailSections : [])
    .flatMap((section) => [
      section?.title ? `【${section.title}】` : '',
      ...(Array.isArray(section?.items) ? section.items : [])
    ])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const items = [...contentItems, ...detailItems]
  const visibleItems = filterDuplicateNodeDisplayItems(items, node)
  return Number(limit) > 0 ? visibleItems.slice(0, Number(limit)) : visibleItems
}

function isModelReturnSummaryNode(node = {}) {
  const firstNodeId = props.nodes?.[0]?.id
  return Boolean(
    node?.id &&
    (
      node.id === firstNodeId ||
      ['analysis', 'summary', 'model-generating'].includes(node?.id)
    )
  )
}

function shouldShowModelReturnSummary() {
  return [
    '不选择 Skill',
    '智能推荐 Skill',
    '高级 UX 需求分析'
  ].includes(props.skillLabel)
}

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
  const summary = canvasNodeSummary(node)
  const visibleLabels = filterDuplicateNodeDisplayItems(
    node.content || [],
    node,
    summary ? [summary] : []
  )
  const remainingLabelCounts = visibleLabels.reduce((counts, label) => {
    const key = normalizeNodeDisplayComparison(label)
    counts.set(key, (counts.get(key) || 0) + 1)
    return counts
  }, new Map())
  const visibleItems = (node.content || []).filter((item) => {
    const key = normalizeNodeDisplayComparison(treeItemLabel(item))
    const count = remainingLabelCounts.get(key) || 0
    if (!count) return false
    remainingLabelCounts.set(key, count - 1)
    return true
  })
  return visibleItems.map((item, index, list) => {
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
  const highlights = Array.isArray(node.highlights) ? node.highlights : []
  const content = Array.isArray(node.content) ? node.content : []
  const summary = canvasNodeSummary(node)
  return filterDuplicateNodeDisplayItems(
    (highlights.length ? highlights : content)
    .map((item) => cleanNodeDisplayCopy(treeItemLabel(item)))
      .filter((item) => item && !isFailedGenerationPlaceholderCopy(node, item)),
    node,
    summary ? [summary] : []
  )
    .slice(0, 3)
}

function isFailedGenerationPlaceholderCopy(node = {}, text = '') {
  if (node.artifactStatus !== 'failed') return false
  return /正在生成|等待生成|生成完成后|阶段完成后/.test(String(text || ''))
}

function loadingNodeContent(node = {}) {
  return (Array.isArray(node.content) ? node.content : [])
    .map((item) => cleanNodeDisplayCopy(treeItemLabel(item)))
    .filter(Boolean)
    .slice(0, 5)
}

function loadingNodeDetailSummary(node = {}) {
  return canvasNodeSummary(node) || '后台正在执行，完成后会自动更新画布详情。'
}

function hasNodeContent(node = {}) {
  return Boolean(
    (Array.isArray(node.content) && node.content.some((item) => treeItemLabel(item))) ||
    (Array.isArray(node.highlights) && node.highlights.some((item) => treeItemLabel(item))) ||
    (Array.isArray(node.detailSections) && node.detailSections.some((section) => Array.isArray(section?.items) && section.items.length))
  )
}

function isNodeActuallyLoading(node = {}) {
  if (node.artifactStatus === 'failed') return false
  const owningStageId = nodeWorkflowStageId(node)
  if (owningStageId && stageStatus(owningStageId) === 'completed' && isAdvancedUxGeneratingNode(node)) return false
  return Boolean(
    node.refreshing ||
    isAdvancedUxGeneratingNode(node) ||
    node.artifactStatus === 'generating' ||
    visualPreview(node).imageStatus === 'generating' ||
    ((node.loading || node.contentLoading) && !hasNodeContent(node))
  )
}

function nodeWorkflowStageId(node = {}) {
  const explicitStageId = String(node?.stageId || node?.sourceStageId || '').trim()
  if (explicitStageId) return totalFlowStages.value.some((stage) => stage.id === explicitStageId) ? explicitStageId : ''
  const nodeId = String(node?.id || node?.requirementPipelineTabId || '').trim()
  const targetGenerator = String(node?.targetGenerator || '').trim().toLowerCase()
  if (nodeId.startsWith('ux-') || node?.requirementPipelineTabId) return 'requirement-dissection'
  if (nodeId.startsWith('ui-') || node?.visualPreview || node?.visualBrief) return 'ui-visual'
  if (nodeId.startsWith('html-') || targetGenerator === 'html') return 'html-output'
  if (nodeId.startsWith('vue-') || targetGenerator === 'vue') return 'vue-output'
  if (node?.pageLayoutArtifact) return 'interaction-lofi'
  return activeStageId.value || ''
}

function isAdvancedUxGeneratingNode(node = {}) {
  return Boolean(
    String(node?.id || node?.requirementPipelineTabId || '').startsWith('ux-') &&
    node.artifactStatus === 'generating' &&
    /正在生成高级 UX 分析/.test(String(node.summary || node.content?.[0] || '正在生成高级 UX 分析'))
  )
}

function canvasNodeSummary(node = {}) {
  const summary = cleanNodeDisplayCopy(node.summary || '')
  if (nodeTextDuplicatesTitle(summary, node)) return ''
  return summary
}

function cleanNodeDisplayCopy(value = '') {
  return String(value || '')
    .replace(/模型增强中：?/g, '')
    .replace(/大模型结果返回后会自动增强。?/g, '')
    .replace(/已先填入当前可用数据。?/g, '')
    .replace(/基础结构：?/g, '')
    .replace(/这是系统基础结构，不是完整大模型分析结论。?/g, '')
    .trim()
}

function normalizeNodeDisplayComparison(value = '') {
  return cleanNodeDisplayCopy(value)
    .replace(/^节点\s*\d+\s*[:：]\s*/u, '')
    .replace(/^\d+\s*[:：.、]\s*/u, '')
    .replace(/已生成[。.]?$/u, '')
    .replace(/[【】[\]\s:：。.,，、\-—_]/gu, '')
    .trim()
}

function nodeTextDuplicatesTitle(value = '', node = {}) {
  const text = normalizeNodeDisplayComparison(value)
  const title = normalizeNodeDisplayComparison(node.title || '')
  return Boolean(text && title && text === title)
}

function filterDuplicateNodeDisplayItems(items = [], node = {}, extraCompareValues = []) {
  const seen = new Set(
    extraCompareValues
      .map((item) => normalizeNodeDisplayComparison(item))
      .filter(Boolean)
  )
  return items
    .map((item) => cleanNodeDisplayCopy(treeItemLabel(item)))
    .filter(Boolean)
    .filter((item) => {
      if (nodeTextDuplicatesTitle(item, node)) return false
      const key = normalizeNodeDisplayComparison(item)
      if (!key) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function isCanvasConfirmAction(action = '') {
  return /确认/.test(String(action || ''))
}

function isRequirementStageAdvanceAction(action = '') {
  return /进入交互低保|输出页面框架|页面框架|转低保真|生成低保真|低保真画布|低保真线框|进入低保/.test(String(action || '').trim())
}

const INTERACTION_LOFI_PAGE_TOOL_ACTIONS = ['给布局方案', '补交互细节', '重生成本页']

function isInteractionLofiPageNode(node = {}) {
  return node?.stageId === 'interaction-lofi' &&
    (node?.detailLayout === 'interaction-page-split' || Boolean(node?.pageLayoutArtifact))
}

function visibleNodeQuickActions(node = {}) {
  if (isInteractionLofiPageNode(node)) return [...INTERACTION_LOFI_PAGE_TOOL_ACTIONS]
  const actions = (Array.isArray(node.quickActions) ? node.quickActions : [])
    .map((action) => String(action || '').trim())
    .filter((action) => action && !isCanvasConfirmAction(action))
  if (isRequirementPipelineCanvasNode(node)) {
    const nodeScopedActions = actions.filter((action) => !isRequirementStageAdvanceAction(action))
    const recommendedActions = requirementCanvasRecommendedActions(node)
    return nodeScopedActions.length ? nodeScopedActions.slice(0, 3) : recommendedActions
  }
  if (isVisualGalleryDetail(node) && generationActions(node).length) {
    const hasGenerationAction = actions.some((action) => visualQuickGenerationAction(node, action))
    const fallbackAction = generationActions(node)[0]?.label
    return hasGenerationAction || !fallbackAction ? actions : [...actions, fallbackAction]
  }
  return actions
}

function visualQuickGenerationAction(node = {}, action = '') {
  const label = String(action || '').trim()
  if (!isVisualGalleryDetail(node) || !/生成视觉|生成高保真|重新生成/.test(label)) return null
  return generationActions(node)[0] || null
}

function codeQuickGenerationAction(node = {}, action = '') {
  const label = String(action || '').trim()
  if (!isPreviewCodeDetail(node)) return null
  if (!label || !/生成\s*(HTML|Vue)|生成页面代码|重新生成/.test(label)) return null
  return generationActions(node).find((item) => {
    const target = String(item?.targetGenerator || node.targetGenerator || '').trim().toLowerCase()
    return target === 'html' || target === 'vue'
  }) || null
}

function visibleNodeQuickActionLabel(node = {}, action = '') {
  const visualGenerationAction = visualQuickGenerationAction(node, action)
  if (visualGenerationAction) return visualGenerationButtonLabel(node, visualGenerationAction)
  const codeGenerationAction = codeQuickGenerationAction(node, action)
  if (codeGenerationAction) return codeGenerationButtonLabel(node, codeGenerationAction)
  return action
}

function isNodeQuickActionDisabled(node = {}, action = '') {
  if (visualQuickGenerationAction(node, action) || codeQuickGenerationAction(node, action)) return isNodeActuallyLoading(node)
  return Boolean(node.loading)
}

function runNodeQuickAction(node = {}, action = '') {
  const generationAction = visualQuickGenerationAction(node, action) || codeQuickGenerationAction(node, action)
  if (generationAction) {
    emit('quick-action', {
      nodeId: node.id,
      action,
      generationAction,
      targetGenerator: generationAction.targetGenerator || node.targetGenerator || '',
      mode: 'stage-detail-generation'
    })
    return
  }
  emit('quick-action', { nodeId: node.id, action })
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

function visibleFullscreenDetailSections(node = {}) {
  const hiddenTitles = new Set(['来源与依据', '下一步产物', '待确认问题'])
  return (Array.isArray(node.detailSections) ? node.detailSections : [])
    .filter((section) => !hiddenTitles.has(String(section?.title || '').trim()))
}

function fullscreenRightQuestions(node = {}) {
  if (!node || isPureContentNode(node)) return []
  const confirmationQuestions = isAgentConfirmationNode(node)
    ? agentConfirmationSections(node).find((section) => section.title === '待确认问题')?.items || []
    : []
  const detailQuestions = (Array.isArray(node.detailSections) ? node.detailSections : [])
    .filter((section) => String(section?.title || '').trim() === '待确认问题')
    .flatMap((section) => Array.isArray(section.items) ? section.items : [])
  return [...confirmationQuestions, ...detailQuestions]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function isAgentConfirmationNode(node = {}) {
  return node?.mode === 'agent-confirmation' || node?.agentInteraction?.confirmationRule || node?.confirmation
}

function isRequirementDissectionNode(node = {}) {
  return node?.stageId === 'requirement-dissection' || node?.id === 'requirement-dissection-agent' || /需求分析|需求解剖/.test(String(node?.title || ''))
}

function projectFunctionMap(node = {}) {
  const map = node?.projectFunctionMap && typeof node.projectFunctionMap === 'object'
    ? node.projectFunctionMap
    : props.totalFlow?.projectFunctionMap
  return map && typeof map === 'object' ? map : {}
}

function hasProjectFunctionMap(node = {}) {
  const map = projectFunctionMap(node)
  return Boolean(projectFunctionModules(node).length || projectFunctionPages(node).length || Array.isArray(map.userPath) && map.userPath.length)
}

function projectFunctionModules(node = {}) {
  const modules = projectFunctionMap(node).rootModules
  return (Array.isArray(modules) ? modules : [])
    .map((module) => ({
      ...module,
      id: String(module?.id || module?.name || '').trim(),
      name: String(module?.name || module?.title || '').trim(),
      summary: String(module?.summary || module?.goal || '').trim(),
      pages: (Array.isArray(module?.pages) ? module.pages : [])
        .map((page) => typeof page === 'string'
          ? { pageName: page }
          : {
              pageId: String(page?.pageId || page?.id || '').trim(),
              pageName: String(page?.pageName || page?.title || page?.name || '').trim()
            }
        )
        .filter((page) => page.pageName)
    }))
    .filter((module) => module.name)
}

function projectFunctionPages(node = {}) {
  const pages = projectFunctionMap(node).pageMap
  return (Array.isArray(pages) ? pages : [])
    .map((page) => ({
      ...page,
      pageId: String(page?.pageId || page?.id || '').trim(),
      pageName: String(page?.pageName || page?.title || page?.name || '').trim(),
      belongsTo: Array.isArray(page?.belongsTo) ? page.belongsTo.map((item) => String(item || '').trim()).filter(Boolean) : [],
      entry: String(page?.entry || '').trim(),
      priority: String(page?.priority || '').trim()
    }))
    .filter((page) => page.pageName)
}

function projectFunctionPath(node = {}) {
  const map = projectFunctionMap(node)
  const path = Array.isArray(map.userPath) && map.userPath.length
    ? map.userPath
    : (Array.isArray(map.navigationMap) ? map.navigationMap : []).flatMap((item) => [item.from, item.to])
  return [...new Set(path.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 12)
}

function requirementDissectionArtifact(node = {}) {
  const artifact = node?.modelOnlyRequirementDissectionArtifact && typeof node.modelOnlyRequirementDissectionArtifact === 'object'
    ? node.modelOnlyRequirementDissectionArtifact
    : node?.requirementDissectionArtifact && typeof node.requirementDissectionArtifact === 'object'
    ? node.requirementDissectionArtifact
    : props.totalFlow?.modelOnlyRequirementDissectionArtifact && typeof props.totalFlow.modelOnlyRequirementDissectionArtifact === 'object'
      ? props.totalFlow.modelOnlyRequirementDissectionArtifact
      : props.totalFlow?.requirementDissectionArtifact
  return artifact && typeof artifact === 'object' ? artifact : {}
}

function hasRequirementDissectionArtifact(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  return Boolean(
    artifact.productAnalysisPipeline?.tabs?.length ||
    Object.keys(artifact.advancedUxMarkdownSections || {}).length ||
    artifact.productDefinition ||
    artifact.designRequirementMap ||
    artifact.competitiveAnalysis ||
    artifact.downstreamHints
  )
}

function shouldUseRequirementReportDetail(node = {}) {
  return isRequirementDissectionNode(node) && hasRequirementDissectionArtifact(node)
}

function requirementPipelineTabs(node = {}) {
  const tabs = requirementDissectionArtifact(node).productAnalysisPipeline?.tabs
  return Array.isArray(tabs) ? tabs : []
}

function hasRequirementPipeline(node = {}) {
  return requirementPipelineTabs(node).length > 0
}

function requirementPipelineFallbackTab(legacyKey = '') {
  switch (legacyKey) {
    case 'product':
    case 'evidence':
    case 'users':
      return 'requirement-understanding'
    case 'scope':
    case 'function':
    case 'module-matrix':
    case 'pages':
    case 'interaction-spec-standards':
      return 'feature-page-decomposition'
    case 'hierarchy':
    case 'journey':
      return 'user-journey-analysis'
    case 'coverage':
      return 'feature-page-decomposition'
    case 'decision':
    case 'decision-flow':
    case 'exception':
    case 'business':
      return 'business-rules-stateflow'
    case 'risk':
      return 'gap-confirmation'
    case 'navigation':
    case 'data-state':
    case 'cross-page-relations':
    case 'feature-jump':
    case 'data-sharing':
      return 'flow-architecture'
    case 'competitive':
      return 'design-opportunity'
    case 'downstream':
      return 'priority-roadmap'
    default:
      return 'requirement-understanding'
  }
}

function requirementPipelineTabId(node = {}) {
  const explicit = String(node?.requirementPipelineTabId || '').trim()
  if (explicit) return explicit
  const directId = requirementPipelineTabs(node).some((tab) => tab.id === node?.id) ? node.id : ''
  if (directId) return directId
  return requirementPipelineFallbackTab(requirementSectionKey(node))
}

function requirementPipelineTab(node = {}) {
  const tabs = requirementPipelineTabs(node)
  const tabId = requirementPipelineTabId(node)
  return tabs.find((tab) => tab.id === tabId) || tabs[0] || { title: node.title || '需求分析', summary: node.summary || '', detailBlocks: [] }
}

function shouldUseRequirementPipelineDetail(node = {}) {
  return shouldUseRequirementReportDetail(node) && hasRequirementPipeline(node) && !isAgentConfirmationNode(node)
}

function isAdvancedUxRequirementPipeline(node = {}) {
  return requirementPipelineTabs(node).some((tab) => String(tab?.id || '').startsWith('ux-'))
}

function advancedUxRequirementNodeMarkdown(node = {}) {
  if (!isAdvancedUxRequirementPipeline(node)) return ''
  const directMarkdown = String(node?.markdown || node?.detailMarkdown || '').trim()
  if (directMarkdown) return directMarkdown
  const sectionId = requirementPipelineTabId(node)
  const artifact = requirementDissectionArtifact(node)
  return String(
    artifact.advancedUxMarkdownSections?.[sectionId]?.markdown ||
    artifact.advancedUxMarkdownSections?.[node?.id]?.markdown ||
    requirementPipelineTab(node)?.markdown ||
    ''
  ).trim()
}

function shouldRenderAdvancedUxRequirementMarkdown(node = {}) {
  return shouldUseRequirementPipelineDetail(node) &&
    Boolean(advancedUxRequirementNodeMarkdown(node)) &&
    !hasStructuredRequirementDetailBlocks(node)
}

function hasStructuredRequirementDetailBlocks(node = {}) {
  return requirementDetailBlocks(node).some((block) => requirementBlockType(block) !== 'markdown')
}

function requirementDetailBlocks(node = {}) {
  const blocks = requirementPipelineTab(node).detailBlocks
  return Array.isArray(blocks) ? blocks : []
}

function isRequirementPipelineCanvasNode(node = {}) {
  return shouldUseRequirementPipelineDetail(node) && requirementDetailBlocks(node).length > 0
}

function requirementCanvasRecommendedActions(node = {}) {
  if (!isRequirementPipelineCanvasNode(node)) return []
  return ['补充细节', '列出风险']
}

function requirementCanvasBlockPreview(block = {}, node = {}) {
  const title = String(block?.title || block?.sourceRef || '').trim()
  const summary = cleanNodeDisplayCopy(block?.summary || '')
  if (title && summary && !nodeTextDuplicatesTitle(summary, { title })) return `${title}：${summary}`
  const rows = requirementBlockRows(block, node)
    .map((row) => Array.isArray(row?.cells) ? row.cells : [])
    .map((cells) => cells.map((cell) => cleanNodeDisplayCopy(cell)).filter(Boolean).slice(0, 2).join('｜'))
    .filter(Boolean)
    .slice(0, 2)
  if (title && rows.length) return `${title}：${rows.join('；')}`
  const items = requirementBlockItems(block, node)
    .map((item) => cleanNodeDisplayCopy(item))
    .filter(Boolean)
    .slice(0, 2)
  if (title && items.length) return `${title}：${items.join('；')}`
  return title || summary
}

function requirementCanvasPreviewItems(node = {}) {
  if (!isRequirementPipelineCanvasNode(node)) return []
  const tab = requirementPipelineTab(node)
  const tabSummary = cleanNodeDisplayCopy(tab.summary || node.summary || '')
  const items = [
    tabSummary && !nodeTextDuplicatesTitle(tabSummary, node) ? tabSummary : '',
    ...requirementDetailBlocks(node).map((block) => requirementCanvasBlockPreview(block, node))
  ]
  return filterDuplicateNodeDisplayItems(items, node, [])
    .slice(0, 4)
}

function requirementPreviewTableHeaders(table = {}) {
  return (Array.isArray(table?.headers) && table.headers.length ? table.headers : ['内容'])
    .map((header) => cleanNodeDisplayCopy(header))
    .filter(Boolean)
}

function requirementPreviewTableRows(table = {}) {
  const headers = requirementPreviewTableHeaders(table)
  return (Array.isArray(table?.rows) ? table.rows : [])
    .map((row, index) => {
      const sourceCells = Array.isArray(row?.cells)
        ? row.cells
        : Array.isArray(row)
          ? row
          : [row]
      const cells = sourceCells
        .slice(0, headers.length)
        .map((cell) => cleanNodeDisplayCopy(cell))
      while (cells.length < headers.length) cells.push('')
      return {
        key: row?.key || `preview-row-${index + 1}`,
        cells
      }
    })
    .filter((row) => row.cells.some(Boolean))
}

function requirementMarkdownPreviewTable(markdown = '', maxRows = 3) {
  const tableBlock = requirementMarkdownRenderableBlocks(markdown)
    .find((block) => block?.type === 'table' && Array.isArray(block.table?.rows) && block.table.rows.length)
  if (!tableBlock) return null
  return {
    headers: requirementPreviewTableHeaders(tableBlock.table),
    rows: tableBlock.table.rows.slice(0, maxRows).map((cells, index) => ({
      key: `markdown-row-${index + 1}`,
      cells
    }))
  }
}

function requirementBlockPreviewTable(block = {}, node = {}, maxRows = 3) {
  if (requirementBlockType(block) === 'markdown') {
    return requirementMarkdownPreviewTable(requirementDocumentBlockPlaintext(block, node), maxRows)
  }
  const headers = requirementBlockHeaders(block, node)
  const rows = requirementBlockRows(block, node)
  if (!rows.length) return null
  const normalizedHeaders = headers.length
    ? headers
    : Array.from(
        { length: rows.reduce((count, row) => Math.max(count, Array.isArray(row?.cells) ? row.cells.length : 0), 1) },
        (_, index) => (index === 0 ? '内容' : `字段 ${index + 1}`)
      )
  return {
    headers: normalizedHeaders,
    rows: rows.slice(0, maxRows)
  }
}

function requirementCanvasPreviewTable(node = {}) {
  if (!isRequirementPipelineCanvasNode(node)) return null
  const markdownTable = requirementMarkdownPreviewTable(advancedUxRequirementNodeMarkdown(node), 3)
  if (markdownTable) return markdownTable
  const blockTable = requirementDetailBlocks(node)
    .map((block) => requirementBlockPreviewTable(block, node, 3))
    .find((table) => table && requirementPreviewTableRows(table).length)
  if (blockTable) return blockTable
  const items = requirementCanvasPreviewItems(node)
  if (!items.length) return null
  return {
    headers: ['内容'],
    rows: items.slice(0, 3).map((item, index) => ({
      key: `item-${index + 1}`,
      cells: [item]
    }))
  }
}

function requirementPipelineFailureMessages(node = {}) {
  const failed = ['failed', 'quality_failed', 'import_failed'].includes(String(node?.artifactStatus || node?.status || '').trim())
  if (!failed) return []
  const report = props.totalFlow?.advancedUxReport || {}
  return [
    ...((Array.isArray(node?.detailSections) ? node.detailSections : []).flatMap((section) => Array.isArray(section?.items) ? section.items : [])),
    report.importError,
    ...(Array.isArray(report.qualityIssues) ? report.qualityIssues : [])
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 6)
}

function resolveRequirementSourceRef(sourceRef = '', node = {}) {
  const artifact = requirementDissectionArtifact(node)
  if (/^advancedUxMarkdownSections\./.test(sourceRef)) {
    const sectionId = String(sourceRef || '').split('.').pop()
    return artifact.advancedUxMarkdownSections?.[sectionId] || {}
  }
  switch (sourceRef) {
    case 'productDefinition':
      return artifact.productDefinition || {}
    case 'evidenceAndAssumptions':
      return artifact.evidenceAndAssumptions || {}
    case 'riskAssessment':
      return artifact.riskAssessment || {}
    case 'userScenarios':
      return artifact.userScenarios || {}
    case 'gapConfirmation':
      return artifact.gapConfirmation || {}
    case 'personaScenarioMatrix':
      return artifact.personaScenarioMatrix || []
    case 'scopeBoundary':
      return artifact.scopeBoundary || {}
    case 'functionModuleMatrix':
      return artifact.functionModuleMatrix || []
    case 'designRequirementMap':
      return artifact.designRequirementMap || {}
    case 'pageCoverageMatrix':
      return artifact.pageCoverageMatrix || artifact.designRequirementMap?.pageCoverageMatrix || []
    case 'pageHierarchyTree':
      return artifact.pageHierarchyTree || {}
    case 'userJourneyMap':
      return artifact.userJourneyMap || {}
    case 'decisionPointMatrix':
      return artifact.decisionPointMatrix || []
    case 'exceptionRecoveryMatrix':
      return artifact.exceptionRecoveryMatrix || []
    case 'businessRuleMatrix':
      return artifact.businessRuleMatrix || {}
    case 'permissionMatrix':
      return artifact.permissionMatrix || {}
    case 'boundaryConditionMatrix':
      return artifact.boundaryConditionMatrix || []
    case 'navigationStructure':
      return artifact.navigationStructure || {}
    case 'dataFlowGraph':
      return artifact.dataFlowGraph || {}
    case 'stateMachineMap':
      return artifact.stateMachineMap || {}
    case 'featureJumpGraph':
      return artifact.featureJumpGraph || {}
    case 'dataSharingMechanism':
      return artifact.dataSharingMechanism || {}
    case 'competitiveAnalysis':
      return artifact.competitiveAnalysis || {}
    case 'designOpportunityMatrix':
      return artifact.designOpportunityMatrix || {}
    case 'priorityRoadmap':
      return artifact.priorityRoadmap || {}
    case 'acceptanceBasis':
      return artifact.acceptanceBasis || {}
    case 'pageFrameContracts':
      return artifact.pageFrameContracts || []
    case 'downstreamHints':
      return artifact.downstreamHints || {}
    case 'openQuestions':
      return artifact.openQuestions || []
    default:
      return null
  }
}

function requirementBlockType(block = {}) {
  return String(block?.type || 'list').trim()
}

const REQUIREMENT_DOCUMENT_SECTION_DEFINITIONS = [
  {
    id: 'requirement-understanding',
    number: 1,
    indexLabel: '一',
    title: '需求理解',
    summary: '明确产品定义、用户场景、证据来源和假设边界。',
    sourceRefs: ['productDefinition', 'userScenarios', 'evidenceAndAssumptions', 'riskAssessment']
  },
  {
    id: 'gap-confirmation',
    number: 2,
    indexLabel: '二',
    title: '缺口确认',
    summary: '把会影响页面范围、状态和验收口径的问题前置确认。',
    sourceRefs: ['gapConfirmation', 'openQuestions']
  },
  {
    id: 'user-journey-analysis',
    number: 3,
    indexLabel: '三',
    title: '用户旅程分析',
    summary: '按角色场景、首次路径、复用路径和异常路径串联体验闭环。',
    sourceRefs: ['personaScenarioMatrix', 'userJourneyMap']
  },
  {
    id: 'feature-page-decomposition',
    number: 4,
    indexLabel: '四',
    title: '功能与页面拆解',
    summary: '把功能模块、页面需求、页面层级和覆盖矩阵对齐。',
    sourceRefs: ['functionModuleMatrix', 'designRequirementMap', 'pageHierarchyTree', 'pageCoverageMatrix', 'pageFrameContracts']
  },
  {
    id: 'business-rules-stateflow',
    number: 5,
    indexLabel: '五',
    title: '业务规则与状态流',
    summary: '归并业务规则、状态机、权限矩阵和边界条件。',
    sourceRefs: ['businessRuleMatrix', 'permissionMatrix', 'boundaryConditionMatrix', 'stateMachineMap']
  },
  {
    id: 'flow-architecture',
    number: 6,
    indexLabel: '六',
    title: '流程与架构',
    summary: '吸收顶层导航、信息架构、核心流程、异常流程、数据流和跨功能关联。',
    sourceRefs: ['navigationStructure', 'dataFlowGraph', 'featureJumpGraph', 'exceptionRecoveryMatrix']
  },
  {
    id: 'design-opportunity',
    number: 7,
    indexLabel: '七',
    title: '设计机会',
    summary: '把痛点、机会点、方案选项、设计建议和竞品参考收束成设计空间。',
    sourceRefs: ['designOpportunityMatrix', 'competitiveAnalysis']
  },
  {
    id: 'priority-roadmap',
    number: 8,
    indexLabel: '八',
    title: '优先级与排期',
    summary: '按优先级矩阵、MVP/v1/v2 排期和依赖风险收束落地顺序。',
    sourceRefs: ['priorityRoadmap', 'scopeBoundary']
  },
  {
    id: 'acceptance-standards',
    number: 9,
    indexLabel: '九',
    title: '验收标准',
    summary: '沉淀功能验收、规则验收、状态验收、非功能验收和交付物清单。',
    sourceRefs: ['acceptanceBasis']
  }
]

const ADVANCED_UX_DOCUMENT_SECTION_DEFINITIONS = [
  {
    id: 'ux-requirement-understanding',
    number: 1,
    indexLabel: '一',
    title: '需求理解',
    summary: '提炼核心意图，识别用户、场景、价值、约束和信息缺口。',
    sourceRefs: ['productDefinition', 'userScenarios', 'evidenceAndAssumptions']
  },
  {
    id: 'ux-requirement-decomposition',
    number: 2,
    indexLabel: '二',
    title: '需求拆解',
    summary: 'MECE 拆解功能点，并转成可验收用户故事。',
    sourceRefs: ['functionModuleMatrix', 'designRequirementMap', 'acceptanceBasis']
  },
  {
    id: 'ux-risk-assumption',
    number: 3,
    indexLabel: '三',
    title: '风险假设',
    summary: '显性化隐含假设、体验风险、验证方式和待确认事项。',
    sourceRefs: ['riskAssessment', 'gapConfirmation', 'boundaryConditionMatrix']
  },
  {
    id: 'ux-flow-info-architecture',
    number: 4,
    indexLabel: '四',
    title: '流程与信息架构',
    summary: '梳理用户流程、业务流程、信息实体、关键断点和优化节点。',
    sourceRefs: ['navigationStructure', 'pageHierarchyTree', 'userJourneyMap', 'dataFlowGraph', 'featureJumpGraph', 'exceptionRecoveryMatrix', 'stateMachineMap']
  },
  {
    id: 'ux-opportunity-solution',
    number: 5,
    indexLabel: '五',
    title: '机会与方案',
    summary: '从功能缺口、流程断点和风险假设中提炼机会与方案选项。',
    sourceRefs: ['designOpportunityMatrix', 'competitiveAnalysis']
  },
  {
    id: 'ux-priority-roadmap',
    number: 6,
    indexLabel: '六',
    title: '优先级与分期',
    summary: '按体验价值、业务价值、实施成本和推进难度排序落地。',
    sourceRefs: ['priorityRoadmap', 'scopeBoundary']
  },
  {
    id: 'ux-delivery-acceptance',
    number: 7,
    indexLabel: '七',
    title: '交付与验收',
    summary: '明确交付物、验收依据、测试重点和后续推进条件。',
    sourceRefs: ['acceptanceBasis']
  }
]

function requirementDocumentSectionDefinitions(node = {}) {
  return isAdvancedUxRequirementPipeline(node)
    ? ADVANCED_UX_DOCUMENT_SECTION_DEFINITIONS
    : REQUIREMENT_DOCUMENT_SECTION_DEFINITIONS
}

function requirementDocumentSections(node = {}) {
  const blocks = requirementDetailBlocks(node)
  const isAdvancedUxPipeline = isAdvancedUxRequirementPipeline(node)
  const activeTabId = requirementPipelineTabId(node)
  if (isAdvancedUxPipeline && blocks.length && blocks.every((block) => !block.sourceRef)) {
    const activeTab = requirementPipelineTab(node)
    const activeTabIndex = Math.max(0, requirementPipelineTabs(node).findIndex((tab) => tab.id === activeTabId))
    const definition = {
      id: activeTabId || activeTab.id || 'advanced-ux-section',
      number: activeTabIndex + 1,
      indexLabel: String(activeTabIndex + 1).padStart(2, '0'),
      title: activeTab.title || node.title || '高级 UX 分析',
      summary: activeTab.summary || node.summary || ''
    }
    return [{
      ...definition,
      blocks
    }]
  }
  const consumedIndexes = new Set()
  const sections = requirementDocumentSectionDefinitions(node).map((definition) => {
    const sectionBlocks = blocks.filter((block, index) => {
      if (consumedIndexes.has(index)) return false
      if (definition.sourceRefs.includes(block.sourceRef)) {
        consumedIndexes.add(index)
        return true
      }
      return false
    })
    return {
      ...definition,
      blocks: sectionBlocks
    }
  }).filter((section) => section.blocks.length)
  const remainingBlocks = blocks.filter((block, index) => !consumedIndexes.has(index))
  if (remainingBlocks.length) {
    sections.push({
      id: 'supplement',
      number: sections.length + 1,
      indexLabel: '补充',
      title: '补充分析',
      summary: '未归入固定章节的模型结构化结果，仍按后端 block 原样渲染。',
      blocks: remainingBlocks
    })
  }
  return sections
}

function requirementDocumentBlockHeading(section = {}, block = {}, blockIndex = 0) {
  const sectionNumber = Number.isFinite(Number(section.number)) ? Number(section.number) : blockIndex + 1
  const title = String(block?.title || block?.sourceRef || '结构化结果').trim()
  return `${sectionNumber}.${blockIndex + 1} ${title}`
}

function isRequirementDocumentTableBlock(block = {}) {
  if (['table', 'priority-table', 'matrix', 'risk-matrix', 'relation-table', 'entity-table', 'question-list'].includes(requirementBlockType(block))) return true
  return [
    'navigationStructure',
    'pageHierarchyTree',
    'userJourneyMap',
    'functionModuleMatrix',
    'pageCoverageMatrix',
    'personaScenarioMatrix',
    'gapConfirmation',
    'riskAssessment',
    'businessRuleMatrix',
    'permissionMatrix',
    'boundaryConditionMatrix',
    'designOpportunityMatrix',
    'priorityRoadmap',
    'acceptanceBasis',
    'decisionPointMatrix',
    'exceptionRecoveryMatrix',
    'dataFlowGraph',
    'stateMachineMap',
    'featureJumpGraph',
    'pageFrameContracts',
    'scopeBoundary',
    'dataSharingMechanism',
    'designRequirementMap',
    'competitiveAnalysis',
    'downstreamHints'
  ].includes(block.sourceRef)
}

function isAdvancedUxTablePreferredBlock(block = {}, node = {}) {
  if (!isAdvancedUxRequirementPipeline(node)) return false
  if (requirementBlockType(block) === 'markdown') return false
  return Boolean(requirementBlockPreviewTable(block, node, 1))
}

function isRequirementStructuredDetailBlock(block = {}) {
  return ['summary', 'list', 'acceptance-basis', 'opportunity-matrix'].includes(requirementBlockType(block)) ||
    ['productDefinition', 'userScenarios', 'evidenceAndAssumptions', 'gapConfirmation', 'competitiveAnalysis', 'downstreamHints'].includes(block?.sourceRef)
}

function requirementFeatureItems(block = {}) {
  return Array.isArray(block.items) ? block.items : []
}

function requirementFeatureMetaRows(item = {}) {
  return [
    ['边界条件', item.boundaryCondition],
    ['信息表达', item.informationExpression],
    ['前置依赖', item.prerequisiteDependencies],
    ['被依赖', item.dependentDependencies],
    ['用户价值', item.userValue],
    ['实现复杂度', item.implementationComplexity],
    ['建议优先级', item.suggestedPriority],
    ['置信度', item.confidence]
  ]
    .map(([label, value]) => ({ label, value: String(value || '').trim() }))
    .filter((row) => row.value)
}

function requirementDocumentBlockPlaintext(block = {}, node = {}) {
  const line = (value = '') => String(value || '').trim()
  if (line(block.content)) return line(block.content)
  if (requirementBlockType(block) === 'markdown') {
    const source = resolveRequirementSourceRef(block.sourceRef, node)
    return line(source?.markdown || block.markdown || block.content || block.summary) || 'Markdown 章节待模型补充'
  }
  if (isRequirementNavigationBlock(block)) {
    return [
      ...requirementNavigationVisualGroups(block, node).map((group) => `${group.title}\n${group.items.map((item) => `  - ${item}`).join('\n')}`),
      ...requirementNavigationVisualRows(block, node).map((item) => [
        `[${item.order}] ${item.label}`,
        `  targetPageId: ${item.targetPageId}`,
        `  activeState: ${item.activeState}`,
        `  visibilityRule: ${item.visibilityRule}`,
        `  permissionRule: ${item.permissionRule}`
      ].join('\n'))
    ].filter(Boolean).join('\n\n') || '导航结构待模型补充'
  }
  if (isRequirementPageHierarchyBlock(block)) {
    return requirementPageHierarchyVisualRows(block, node)
      .map((row) => `${'  '.repeat(row.depth)}L${row.level} ${row.label} (${row.pageId})\n${'  '.repeat(row.depth)}  parentId: ${row.parentId} / pageType: ${row.pageType}`)
      .join('\n') || '页面层级待模型补充'
  }
  if (isRequirementJourneyBlock(block)) {
    return requirementJourneyVisualRows(block, node)
      .map((step) => `${step.pathType} #${step.stepIndex}: ${step.title}\n  页面: ${step.pageName}\n  用户动作: ${step.userAction}\n  目标: ${step.goal}\n  流转: ${step.transition}`)
      .join('\n\n') || '用户旅程待模型补充'
  }
  if (isRequirementDataFlowBlock(block)) {
    return requirementDataFlowVisualRows(block, node)
      .map((row) => [
        `${row.pageName} (${row.pageId})`,
        `  读取: ${row.reads.join('、')}`,
        `  写入: ${row.writes.join('、')}`,
        `  下游: ${row.downstream.join('、')}`,
        `  流转: ${row.edges.join('；')}`
      ].join('\n'))
      .join('\n\n') || '数据流待模型补充'
  }
  if (isRequirementStateMachineBlock(block)) {
    return requirementStateMachineVisualRows(block, node)
      .map((row) => [
        `${row.pageName} (${row.pageId})`,
        `  states: ${row.states.join(' -> ')}`,
        ...row.transitions.map((transition) => `  ${transition.from} --${transition.event}--> ${transition.to}`)
      ].join('\n'))
      .join('\n\n') || '状态机待模型补充'
  }
  if (isRequirementFeatureJumpBlock(block)) {
    return requirementFeatureJumpVisualRows(block, node)
      .map((edge) => [
        `${edge.from} --${edge.action}--> ${edge.to}`,
        `  fromPageId: ${edge.fromPageId}`,
        `  toPageId: ${edge.toPageId}`,
        `  condition: ${edge.condition}`,
        `  preserveState: ${edge.preserveState}`,
        edge.note ? `  note: ${edge.note}` : ''
      ].filter(Boolean).join('\n'))
      .join('\n\n') || '跨功能跳转待模型补充'
  }
  return requirementBlockItems(block, node).map((item) => line(item)).filter(Boolean).join('\n') || '待模型补充'
}

function normalizeRequirementMarkdownText(content = '') {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+(#{1,6})\s+/g, '\n\n$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isRequirementMarkdownTableDivider(line = '') {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''))
}

function splitRequirementMarkdownTableRow(line = '') {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseRequirementMarkdownTableBlock(lines = [], startIndex = 0) {
  const headerLine = lines[startIndex]
  const dividerLine = lines[startIndex + 1]
  if (!/\|/.test(String(headerLine || '')) || !isRequirementMarkdownTableDivider(dividerLine)) return null
  const headers = splitRequirementMarkdownTableRow(headerLine)
  if (headers.length < 2 || headers.some((cell) => !cell)) return null
  const rows = []
  let index = startIndex + 2
  while (index < lines.length && /\|/.test(String(lines[index] || '').trim())) {
    const row = splitRequirementMarkdownTableRow(lines[index])
    if (row.length < 2) break
    while (row.length < headers.length) row.push('')
    rows.push(row.slice(0, headers.length))
    index += 1
  }
  return rows.length ? { table: { headers, rows }, nextIndex: index } : null
}

function isPlainTextRequirementCodeLanguage(language = '') {
  const normalized = String(language || '').trim()
  return !normalized || /^(text|txt|plain|plaintext|plain-text|ascii)$/i.test(normalized)
}

function requirementMarkdownRenderableBlocks(content = '') {
  const text = normalizeRequirementMarkdownText(content)
  if (!text) return []
  const blocks = []
  const lines = text.split('\n')
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
      blocks.push({
        type: isPlainTextRequirementCodeLanguage(codeLanguage) ? 'pre' : 'code',
        text: value,
        language: String(codeLanguage || '').trim()
      })
    }
    codeLines = []
    codeLanguage = ''
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = String(lines[lineIndex] || '')
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
    const tableBlock = parseRequirementMarkdownTableBlock(lines, lineIndex)
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
    const list = raw.match(/^\s*(?:[-*]|\d+[.)]|[（(]?\d+[）)]|·)\s+(.+)$/)
    if (list) {
      flushParagraph()
      listItems.push(list[1].trim())
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
  return blocks.length ? blocks : [{ type: 'p', text }]
}

function renderRequirementMarkdownBlock(block = {}) {
  if (block.type === 'h1') return h('h1', String(block.text || ''))
  if (block.type === 'h2') return h('h2', String(block.text || ''))
  if (block.type === 'h3') return h('h3', String(block.text || ''))
  if (block.type === 'h4') return h('h4', String(block.text || ''))
  if (block.type === 'h5') return h('h5', String(block.text || ''))
  if (block.type === 'h6') return h('h6', String(block.text || ''))
  if (block.type === 'pre' || block.type === 'code') return h('pre', { class: 'requirement-markdown-pre' }, String(block.text || ''))
  if (block.type === 'table') {
    const headers = Array.isArray(block.table?.headers) ? block.table.headers : []
    const rows = Array.isArray(block.table?.rows) ? block.table.rows : []
    return h('div', { class: 'requirement-markdown-table-wrap' }, [
      h('table', { class: 'requirement-markdown-table' }, [
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
    return h('ul', items.map((item, itemIndex) =>
      h('li', { key: `item-${itemIndex}` }, String(item || ''))
    ))
  }
  return h('p', String(block.text || ''))
}

const RequirementMarkdownBlock = {
  name: 'RequirementMarkdownBlock',
  props: {
    block: { type: Object, default: () => ({}) },
    blockIndex: { type: Number, default: 0 }
  },
  setup(componentProps) {
    return () => renderRequirementMarkdownBlock(componentProps.block || {})
  }
}

function requirementBlockHeaders(block = {}, node = {}) {
  if (Array.isArray(block.headers)) {
    return block.headers
      .map((header) => typeof header === 'object' && header ? header.label || header.key || '' : header)
      .map((header) => String(header || '').trim())
      .filter(Boolean)
  }
  if (Array.isArray(block.columns)) {
    return block.columns
      .map((column) => typeof column === 'object' && column ? column.label || column.key || '' : column)
      .map((column) => String(column || '').trim())
      .filter(Boolean)
  }
  switch (block.sourceRef) {
    case 'gapConfirmation':
      return ['问题', '影响', '优先级', '建议动作']
    case 'riskAssessment':
      return ['优先级', '风险/假设', '触发路径/影响', '预案/置信度']
    case 'personaScenarioMatrix':
      return ['角色', '场景', '任务', '入口/成功信号']
    case 'navigationStructure':
      return ['导航/入口', '目标页面', '展示规则', '权限/说明']
    case 'pageHierarchyTree':
      return ['层级', '页面/节点', '父级', '页面类型']
    case 'userJourneyMap':
      return ['路径类型', '步骤/页面', '用户动作', '目标/流转']
    case 'dataFlowGraph':
      return ['页面/节点', '读取数据', '写入/下游', '流转关系']
    case 'stateMachineMap':
      return ['页面/范围', '当前状态', '触发事件', '目标状态/表现']
    case 'featureJumpGraph':
      return ['来源', '动作', '目标', '说明']
    case 'functionModuleMatrix':
      return ['层级', '模块', '页面', '入口/用户']
    case 'designRequirementMap':
      return ['页面', '页面目标', '主操作', '状态/数据']
    case 'pageCoverageMatrix':
      return ['页面', '类型', '入口/出口', '主操作/状态']
    case 'decisionPointMatrix':
      return ['决策点', '所在页面', '选项', '影响/策略']
    case 'businessRuleMatrix':
      return ['类型', '规则', '适用范围', '优先级/验收']
    case 'permissionMatrix':
      return ['页面', '操作', '允许角色', '无权限处理']
    case 'boundaryConditionMatrix':
      return ['边界场景', '触发条件', '期望反馈', '恢复路径']
    case 'designOpportunityMatrix':
      return ['机会/方案', '依据/重点', '影响页面/取舍', '价值/优先级']
    case 'priorityRoadmap':
      return ['分组/里程碑', '内容', '规则', '类型']
    case 'acceptanceBasis':
      return ['类型', '验收项', '继承来源', '阶段']
    case 'pageFrameContracts':
      return ['页面', '框架区块', '导航/数据', '状态/跳转']
    case 'scopeBoundary':
      return ['优先级', '内容', '说明', '处理方式']
    case 'dataSharingMechanism':
      return ['资源', '创建/存储', '使用方', '共享方式']
    case 'competitiveAnalysis':
      return ['维度', '内容', '证据状态', '建议动作']
    case 'downstreamHints':
      return ['下游阶段', '生成依据', '用途', '继承方式']
    default:
      return []
  }
}

function requirementBlockColumnCount(block = {}, node = {}) {
  const headerCount = requirementBlockHeaders(block, node).length
  const rowCount = requirementBlockRows(block, node)
    .reduce((count, row) => Math.max(count, Array.isArray(row?.cells) ? row.cells.length : 0), 0)
  return Math.max(headerCount, rowCount, 1)
}

function requirementBlockTableStyle(block = {}, node = {}) {
  const headers = requirementBlockHeaders(block, node)
  const columnCount = requirementBlockColumnCount(block, node)
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const header = String(headers[index] || '').trim()
    if (/^#|编号|层级|优先级|评分|置信度$/.test(header)) return 'minmax(72px, .55fr)'
    return 'minmax(150px, 1fr)'
  }).join(' ')
  return { '--requirement-table-columns': columns }
}

function rowsFromTextItems(items = [], prefix = 'item') {
  return requirementDetailItems(items, '待模型补充', 20).map((item, index) => ({
    key: `${prefix}-${index + 1}`,
    cells: [item]
  }))
}

function requirementGapConfirmationRows(node = {}) {
  const source = requirementDissectionArtifact(node).gapConfirmation || {}
  const questions = Array.isArray(source.questions) ? source.questions : []
  return (questions.length ? questions : [{ question: '暂无强阻塞问题', impact: '后续阶段继续校验', priority: 'P1', suggestedAction: '进入下一阶段时继承状态与异常矩阵' }])
    .map((row, index) => ({
      key: row?.id || `gap-confirmation-${index + 1}`,
      cells: [
        row?.question || `缺口 ${index + 1}`,
        row?.impact || '影响待确认',
        row?.priority || 'P1',
        row?.suggestedAction || '通过 Agent 继续确认'
      ]
    }))
}

function requirementPersonaScenarioRows(node = {}) {
  const rows = requirementDissectionArtifact(node).personaScenarioMatrix || []
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    key: row?.id || `persona-scenario-${index + 1}`,
    cells: [
      row?.persona || '角色待确认',
      row?.scenario || '场景待确认',
      row?.jobToBeDone || '任务待确认',
      [row?.entryPage ? `入口：${row.entryPage}` : '', row?.successSignal ? `成功：${row.successSignal}` : ''].filter(Boolean).join('；') || '成功信号待确认'
    ]
  }))
}

function requirementBusinessRuleRows(node = {}) {
  const rows = requirementDissectionArtifact(node).businessRuleMatrix?.rules || []
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    key: row?.id || `business-rule-${index + 1}`,
    cells: [
      row?.category || '业务规则',
      row?.rule || row?.title || '规则待确认',
      requirementDetailItems(row?.appliesTo, '适用范围待确认', 5).join('、'),
      [row?.priority || 'P1', row?.verification || '验收方式待确认'].filter(Boolean).join('；')
    ]
  }))
}

function requirementPermissionRows(node = {}) {
  const source = requirementDissectionArtifact(node).permissionMatrix || {}
  const rows = Array.isArray(source.operations) ? source.operations : []
  return rows.map((row, index) => ({
    key: row?.id || `permission-${index + 1}`,
    cells: [
      row?.pageName || '页面待确认',
      row?.operation || '操作待确认',
      requirementDetailItems(row?.allowedRoles, '角色待确认', 6).join('、'),
      row?.deniedBehavior || '无权限处理待确认'
    ]
  }))
}

function requirementBoundaryRows(node = {}) {
  const rows = requirementDissectionArtifact(node).boundaryConditionMatrix || []
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    key: row?.id || `boundary-${index + 1}`,
    tone: /失败|异常|权限|支付|上传/.test(`${row?.scenario || ''}${row?.triggerCondition || ''}`) ? 'high' : 'medium',
    cells: [
      row?.scenario || '边界场景待确认',
      row?.triggerCondition || '触发条件待确认',
      row?.expectedBehavior || '期望反馈待确认',
      row?.recoveryPath || '恢复路径待确认'
    ]
  }))
}

function requirementRiskAssessmentRows(node = {}) {
  const source = requirementDissectionArtifact(node).riskAssessment || {}
  const risks = Array.isArray(source.risks) ? source.risks : []
  return risks.map((row, index) => ({
    key: row?.id || `risk-assessment-${index + 1}`,
    tone: row?.priority === 'P0' ? 'high' : 'medium',
    cells: [
      row?.priority || 'P1',
      row?.risk || row?.assumption || '风险待模型返回',
      [row?.triggerPath || '触发路径待确认', row?.userImpact || row?.impact || '影响待确认'].filter(Boolean).join('；'),
      [row?.mitigation || '预案待确认', row?.confidence || '置信度待确认'].filter(Boolean).join('；')
    ]
  }))
}

function requirementOpportunityRows(node = {}) {
  const source = requirementDissectionArtifact(node).designOpportunityMatrix || {}
  const opportunities = Array.isArray(source.opportunities) ? source.opportunities : []
  const options = Array.isArray(source.solutionOptions) ? source.solutionOptions : []
  return [
    ...opportunities.map((row, index) => ({
      key: row?.id || `design-opportunity-${index + 1}`,
      cells: [
        row?.title || '设计机会待确认',
        row?.evidence || '证据待确认',
        requirementDetailItems(row?.affectedPages, '影响页面待确认', 5).join('、'),
        [row?.expectedValue || '价值待确认', row?.priority || 'P1'].filter(Boolean).join('；')
      ]
    })),
    ...options.map((row, index) => ({
      key: row?.id || `solution-option-${index + 1}`,
      cells: [
        row?.title || `方案 ${index + 1}`,
        row?.focus || '方案重点待确认',
        row?.tradeoff || '取舍待确认',
        '可在后续 UI/交互阶段展开'
      ]
    }))
  ]
}

function requirementPriorityRows(node = {}) {
  const source = requirementDissectionArtifact(node).priorityRoadmap || {}
  const quadrants = Array.isArray(source.quadrants) ? source.quadrants : []
  const milestones = Array.isArray(source.milestones) ? source.milestones : []
  return [
    ...quadrants.map((row, index) => ({
      key: row?.id || `priority-quadrant-${index + 1}`,
      cells: [
        row?.title || '优先级待确认',
        requirementDetailItems(row?.items, '内容待确认', 6).join('、'),
        row?.rule || '判断规则待确认',
        '优先级象限'
      ]
    })),
    ...milestones.map((row, index) => ({
      key: row?.id || `priority-milestone-${index + 1}`,
      cells: [
        row?.title || `里程碑 ${index + 1}`,
        requirementDetailItems(row?.deliverables, '交付物待确认', 6).join('、'),
        '阶段性交付',
        '里程碑'
      ]
    }))
  ]
}

function requirementAcceptanceBasisRows(node = {}) {
  const source = requirementDissectionArtifact(node).acceptanceBasis || {}
  return [
    ...requirementDetailItems(source.functional, '功能验收待确认', 8).map((item, index) => ({ key: `acceptance-functional-${index + 1}`, cells: ['功能验收', item, '页面/交互/代码均需覆盖', 'acceptanceBasis'] })),
    ...requirementDetailItems(source.businessRules, '规则验收待确认', 8).map((item, index) => ({ key: `acceptance-rule-${index + 1}`, cells: ['规则验收', item, '继承业务规则矩阵', 'businessRuleMatrix'] })),
    ...requirementDetailItems(source.stateCoverage, '状态验收待确认', 8).map((item, index) => ({ key: `acceptance-state-${index + 1}`, cells: ['状态验收', item, '继承状态机', 'stateMachineMap'] })),
    ...requirementDetailItems(source.nonFunctional, '非功能验收待确认', 8).map((item, index) => ({ key: `acceptance-non-functional-${index + 1}`, cells: ['非功能验收', item, '验收沉淀阶段展开', 'acceptance-deposit'] }))
  ]
}

function requirementBlockRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node)
  if (Array.isArray(block.rows) && !block.sourceRef) {
    const keyedColumns = Array.isArray(block.columns)
      ? block.columns.filter((column) => column && typeof column === 'object' && column.key)
      : []
    return block.rows.map((row, index) => ({
      key: row?.key || row?.id || `${block.id || 'block'}-${index + 1}`,
      cells: keyedColumns.length
        ? keyedColumns.map((column) => row[column.key] ?? row[column.label] ?? '待模型补充')
        : Array.isArray(row?.cells) ? row.cells : requirementDetailItems(row, '待模型补充', 4)
    }))
  }
  switch (block.sourceRef) {
    case 'navigationStructure':
      return [
        ...requirementNavigationVisualRows(block, node).map((row) => ({
          key: row.key,
          cells: [
            row.label,
            row.targetPageId,
            [`activeState：${row.activeState}`, `visibilityRule：${row.visibilityRule}`].join('；'),
            row.permissionRule
          ]
        })),
        ...requirementNavigationVisualGroups(block, node).map((group, index) => ({
          key: `navigation-group-${index + 1}`,
          cells: [
            group.title,
            requirementDetailItems(group.items, '目标页面待确认', 4).join('、'),
            '入口分组',
            '来自导航结构'
          ]
        }))
      ]
    case 'pageHierarchyTree':
      return requirementPageHierarchyVisualRows(block, node).map((row) => ({
        key: row.key,
        cells: [
          `L${row.level}`,
          row.label,
          row.parentId,
          [row.pageType, row.pageId].filter(Boolean).join('；')
        ]
      }))
    case 'userJourneyMap':
      return requirementJourneyVisualRows(block, node).map((row) => ({
        key: row.key,
        cells: [
          row.pathType,
          [`#${row.stepIndex}`, row.pageName || row.title].filter(Boolean).join(' '),
          row.userAction,
          [`目标：${row.goal}`, `流转：${row.transition}`].join('；')
        ]
      }))
    case 'dataFlowGraph':
      return requirementDataFlowVisualRows(block, node).map((row) => ({
        key: row.key,
        cells: [
          `${row.pageName}（${row.pageId}）`,
          row.reads.join('、'),
          [...row.writes, ...row.downstream].join('、'),
          row.edges.join('；')
        ]
      }))
    case 'stateMachineMap':
      return requirementStateMachineVisualRows(block, node).flatMap((row) =>
        row.transitions.map((transition, transitionIndex) => ({
          key: `${row.key}-${transition.key || transitionIndex + 1}`,
          cells: [
            `${row.pageName}（${row.pageId}）`,
            transition.from,
            transition.event,
            transition.to
          ]
        }))
      )
    case 'gapConfirmation':
      return requirementGapConfirmationRows(node)
    case 'riskAssessment':
      return requirementRiskAssessmentRows(node)
    case 'personaScenarioMatrix':
      return requirementPersonaScenarioRows(node)
    case 'pageCoverageMatrix':
      return requirementPageCoverageRows(node)
    case 'decisionPointMatrix':
      return requirementDecisionRows(node)
    case 'exceptionRecoveryMatrix':
      return requirementExceptionRows(node)
    case 'functionModuleMatrix':
      return requirementModuleMatrixRows(node)
    case 'designRequirementMap':
      return requirementPageTableRows(node)
    case 'businessRuleMatrix':
      return requirementBusinessRuleRows(node)
    case 'permissionMatrix':
      return requirementPermissionRows(node)
    case 'boundaryConditionMatrix':
      return requirementBoundaryRows(node)
    case 'designOpportunityMatrix':
      return requirementOpportunityRows(node)
    case 'priorityRoadmap':
      return requirementPriorityRows(node)
    case 'acceptanceBasis':
      return requirementAcceptanceBasisRows(node)
    case 'competitiveAnalysis':
      return [
        { key: 'competitive-evidence', cells: ['证据状态', resolveRequirementSourceRef(block.sourceRef, node)?.evidenceNotice || requirementCompetitiveMode(node), '待补充/待确认', '可让 Agent 找竞品或上传参考'] },
        ...requirementDetailItems(resolveRequirementSourceRef(block.sourceRef, node)?.comparisonDimensions, '对比维度待确认', 4).map((item, index) => ({
          key: `competitive-dimension-${index + 1}`,
          cells: ['对比维度', item, '推断', '用于后续设计机会收敛']
        })),
        ...requirementCompetitiveItems(node).map((item, index) => ({
          key: `competitive-item-${index + 1}`,
          cells: ['参考启发', item, '推断', '不直接照搬']
        }))
      ]
    case 'downstreamHints':
      return [
        { key: 'downstream-interaction', cells: ['交互低保', requirementDetailItems(resolveRequirementSourceRef(block.sourceRef, node)?.interactionLofi, '待补充', 5).join('、'), '页面链路/状态', '继承阶段一结论'] },
        { key: 'downstream-ui', cells: ['UI 视觉', requirementDetailItems(resolveRequirementSourceRef(block.sourceRef, node)?.uiVisual, '待补充', 5).join('、'), '视觉生成依据', '继承页面和场景'] },
        { key: 'downstream-handoff', cells: ['前后端', requirementDetailItems(resolveRequirementSourceRef(block.sourceRef, node)?.frontendBackend, '待补充', 5).join('、'), '接口/验收', '继承数据状态和规则'] }
      ]
    case 'featureJumpGraph':
      return requirementJumpRows(node)
    case 'dataSharingMechanism':
      return requirementSharingRows(node)
    case 'pageFrameContracts':
      return (Array.isArray(source) ? source : []).map((contract, index) => ({
        key: contract?.pageId || `frame-${index + 1}`,
        cells: [
          contract?.pageName || `页面 ${index + 1}`,
          requirementDetailItems(contract?.layoutFrame?.regions?.map((region) => region.name), '框架区块待确认', 3).join('、'),
          [
            `导航：${Array.isArray(contract?.navigationBindings) ? contract.navigationBindings.length : 0}`,
            `数据块：${Array.isArray(contract?.contentHierarchy) ? contract.contentHierarchy.length : 0}`
          ].join('；'),
          [
            `状态：${Array.isArray(contract?.stateVariants) ? contract.stateVariants.length : 0}`,
            `跳转：${Array.isArray(contract?.transitionEdges) ? contract.transitionEdges.length : 0}`
          ].join('；')
        ]
      }))
    case 'scopeBoundary':
      return [
        { key: 'p0', cells: ['P0', requirementDetailItems(source?.p0, '待确认', 6).join('、'), '本期必须承载', '优先进入页面框架'] },
        { key: 'p1', cells: ['P1', requirementDetailItems(source?.p1, '待确认', 6).join('、'), '可增强范围', '不阻塞主路径'] },
        { key: 'out', cells: ['暂不做', requirementDetailItems(source?.outOfScope, '待确认', 6).join('、'), '边界控制', '写入风险或后续版本'] }
      ]
    default:
      return rowsFromTextItems(requirementBlockItems(block, node), block.id || block.sourceRef || 'block')
  }
}

function requirementBlockGroups(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node)
  switch (block.sourceRef) {
    case 'navigationStructure':
      return [
        requirementDetailGroup('全局入口', source?.globalEntries),
        requirementDetailGroup('模块入口', (source?.moduleEntries || []).map((item) => `${item.moduleName}：${requirementDetailItems(item.pages, item.summary || '待模型补充', 8).join('、')}`)),
        requirementDetailGroup('导航绑定', (source?.navigationItems || []).map((item) =>
          `${item.label || item.id}：targetPageId=${item.targetPageId || '待确认'}；activeState=${item.activeState || '待确认'}；visibilityRule=${item.visibilityRule || '待确认'}`
        )),
        requirementDetailGroup('辅助入口', source?.auxiliaryEntries)
      ]
    case 'pageHierarchyTree':
      return [
        requirementDetailGroup('页面层级树', (source?.nodes || []).map((item) => `${item.label}：${(item.children || []).map((child) => {
          const pageMeta = child.pageId || child.level || child.pageType
            ? `（pageId=${child.pageId || child.id || '待确认'}；level=${child.level ?? '待确认'}；pageType=${child.pageType || child.type || '待确认'}）`
            : ''
          return `${child.label}${pageMeta}`
        }).filter(Boolean).join('、') || '待补页面'}`)),
        requirementDetailGroup('叶子页面数量', [source?.leafPageCount ? `${source.leafPageCount}` : '待确认'])
      ]
    default:
      return [requirementDetailGroup(block.title || '详情', requirementBlockItems(block, node))]
  }
}

function requirementBlockItems(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node)
  if (Array.isArray(block.items) && !block.sourceRef) return requirementDetailItems(block.items, '待模型补充', 20)
  switch (block.sourceRef) {
    case 'productDefinition':
      return requirementDetailItems([
        source?.oneLine,
        source?.productType ? `产品类型：${source.productType}` : '',
        source?.surfaceAsk ? `表层诉求：${source.surfaceAsk}` : '',
        source?.bottomIntent ? `底层意图：${source.bottomIntent}` : ''
      ])
    case 'evidenceAndAssumptions':
      return requirementEvidenceItems(node)
    case 'userScenarios':
      return [
        ...requirementDetailItems(source?.primaryUsers, '目标用户待确认', 6).map((item) => `目标用户：${item}`),
        ...requirementDetailItems(source?.coreScenarios, '核心场景待确认', 6).map((item) => `核心场景：${item}`),
        ...requirementDetailItems(source?.designImplications, '设计转译待确认', 6).map((item) => `设计转译：${item}`)
      ]
    case 'userJourneyMap':
      return [
        ...requirementDetailItems(source?.firstTimePath, '首次路径待确认', 10).map((item) => `首次路径：${item}`),
        ...requirementDetailItems(source?.returningPath, '复用路径待确认', 8).map((item) => `复用路径：${item}`),
        ...requirementDetailItems(source?.exceptionPath, '异常路径待确认', 8).map((item) => `异常路径：${item}`)
      ]
    case 'dataFlowGraph':
      return [
        ...(Array.isArray(source?.edges) ? source.edges.map((edge) => `${edge.from || '来源'} -> ${edge.to || '目标'}：${edge.label || '流转'}`) : []),
        ...requirementDataFlowItems(node)
      ]
    case 'competitiveAnalysis':
      return [
        requirementCompetitiveMode(node),
        ...requirementCompetitiveItems(node),
        ...requirementDetailItems(source?.researchSearchDirections, '检索方向待确认', 4).map((item) => `检索方向：${item}`)
      ]
    case 'downstreamHints':
      return requirementDownstreamItems(node)
    case 'openQuestions':
      return requirementDetailItems(source, '暂无待确认问题', 12)
    default:
      return requirementBlockRows(block, node).map((row) => row.cells.join('｜'))
  }
}

function isRequirementNavigationBlock(block = {}) {
  return block?.sourceRef === 'navigationStructure'
}

function isRequirementPageHierarchyBlock(block = {}) {
  return block?.sourceRef === 'pageHierarchyTree'
}

function isRequirementJourneyBlock(block = {}) {
  return block?.sourceRef === 'userJourneyMap'
}

function isRequirementDataFlowBlock(block = {}) {
  return block?.sourceRef === 'dataFlowGraph'
}

function isRequirementStateMachineBlock(block = {}) {
  return block?.sourceRef === 'stateMachineMap'
}

function isRequirementFeatureJumpBlock(block = {}) {
  return block?.sourceRef === 'featureJumpGraph'
}

function isRequirementBusinessRuleBlock(block = {}) {
  return block?.sourceRef === 'businessRuleMatrix'
}

function isRequirementPermissionMatrixBlock(block = {}) {
  return block?.sourceRef === 'permissionMatrix'
}

function isRequirementBoundaryConditionBlock(block = {}) {
  return block?.sourceRef === 'boundaryConditionMatrix'
}

function isRequirementOpportunityPriorityBlock(block = {}) {
  return ['priorityRoadmap', 'acceptanceBasis'].includes(block?.sourceRef)
}

function requirementVisualText(value = '', fallback = '待确认') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function requirementNavigationVisualGroups(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  return [
    requirementDetailGroup('全局入口', source.globalEntries),
    requirementDetailGroup('模块入口', (Array.isArray(source.moduleEntries) ? source.moduleEntries : []).map((item) => {
      const pages = requirementDetailItems(item?.pages, item?.summary || '页面待确认', 6).join('、')
      return `${item?.moduleName || item?.name || '模块待确认'}：${pages}`
    })),
    requirementDetailGroup('辅助入口', source.auxiliaryEntries)
  ].filter((group) => group.items.length)
}

function requirementNavigationVisualRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  const navigationItems = Array.isArray(source.navigationItems) ? source.navigationItems : []
  const treeItems = Array.isArray(source.navigationTree)
    ? source.navigationTree.flatMap((root) => Array.isArray(root?.children)
      ? root.children.flatMap((child) => Array.isArray(child?.children) ? child.children : [child])
      : [])
    : []
  return (navigationItems.length ? navigationItems : treeItems)
    .map((item, index) => {
      const targetPageId = requirementVisualText(item?.targetPageId || item?.pageId || item?.id, 'targetPageId待确认')
      const activeState = requirementVisualText(item?.activeState, 'activeState待确认')
      const visibilityRule = requirementVisualText(item?.visibilityRule, 'visibilityRule待确认')
      return {
        key: item?.id || targetPageId || `navigation-${index + 1}`,
        order: item?.order ? `#${item.order}` : `#${index + 1}`,
        label: requirementVisualText(item?.label || item?.title || item?.targetPageName, '导航项待确认'),
        targetPageId,
        activeState,
        visibilityRule,
        permissionRule: requirementVisualText(item?.permissionRule || item?.permissionHint, 'permissionRule待确认')
      }
    })
}

function requirementPageHierarchyVisualRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  const rows = []
  const walk = (items = [], depth = 0, inheritedParentId = 'requirement-root') => {
    ;(Array.isArray(items) ? items : []).forEach((item, index) => {
      const level = Number.isFinite(Number(item?.level)) ? Number(item.level) : depth + 1
      const pageId = requirementVisualText(item?.pageId || (item?.type === 'page' ? item?.id : ''), item?.type === 'page' ? 'pageId待确认' : '非页面节点')
      const parentId = requirementVisualText(item?.parentId || inheritedParentId, 'parentId待确认')
      const pageType = requirementVisualText(item?.pageType || item?.type, 'pageType待确认')
      const id = requirementVisualText(item?.id || item?.pageId || `${parentId}-${index + 1}`, `hierarchy-${rows.length + 1}`)
      rows.push({
        key: id,
        label: requirementVisualText(item?.label || item?.title || item?.pageName || item?.name, '页面节点待确认'),
        pageId,
        parentId,
        level,
        depth,
        pageType,
        summary: requirementVisualText(item?.summary || item?.priority || '', '层级来源：模型结构化结果')
      })
      walk(item?.children, depth + 1, id)
    })
  }
  walk(source.nodes)
  return rows.length ? rows : [{
    key: 'hierarchy-empty',
    label: source.root || '页面层级待确认',
    pageId: 'pageId待确认',
    parentId: 'requirement-root',
    level: 1,
    depth: 0,
    pageType: 'pageType待确认',
    summary: '等待模型补充页面层级'
  }]
}

function requirementJourneyVisualRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  const pathDefinitions = [
    { key: 'firstTimePath', title: '首次路径' },
    { key: 'returningPath', title: '复用路径' },
    { key: 'exceptionPath', title: '异常路径' }
  ]
  return pathDefinitions.flatMap((definition) => {
    const steps = Array.isArray(source[definition.key]) ? source[definition.key] : []
    return steps.map((step, index) => {
      const nextStep = steps[index + 1]
      const nextTitle = typeof nextStep === 'string'
        ? nextStep
        : nextStep?.title || nextStep?.label || nextStep?.pageName || nextStep?.name || ''
      const title = typeof step === 'string'
        ? step
        : step?.title || step?.label || step?.step || step?.pageName || step?.name
      return {
        key: `${definition.key}-${index + 1}`,
        pathType: definition.title,
        stepIndex: index + 1,
        title: requirementVisualText(title, '路径步骤待确认'),
        pageName: requirementVisualText(typeof step === 'object' ? step?.pageName || step?.page || step?.targetPageName : title, '页面待确认'),
        userAction: requirementVisualText(typeof step === 'object' ? step?.userAction || step?.action || step?.operation : '', '完成当前步骤'),
        goal: requirementVisualText(typeof step === 'object' ? step?.goal || step?.intent || step?.result : '', '完成路径阶段目标'),
        transition: requirementVisualText(typeof step === 'object' ? step?.transition || step?.next || step?.to || step?.outcome : nextTitle, nextTitle ? `进入 ${nextTitle}` : '进入下一步或完成')
      }
    })
  })
}

function requirementDataFlowVisualRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  const pageDataRows = Array.isArray(source.pageData) ? source.pageData : []
  const edges = Array.isArray(source.edges) ? source.edges : []
  if (!pageDataRows.length && edges.length) {
    return edges.map((edge, index) => ({
      key: edge?.id || `data-edge-${index + 1}`,
      pageId: requirementVisualText(edge?.toNodeId || edge?.to, 'pageId待确认'),
      pageName: requirementVisualText(edge?.to, '数据目标待确认'),
      reads: [requirementVisualText(edge?.from, '数据来源待确认')],
      writes: [requirementVisualText(edge?.label, '数据流转待确认')],
      downstream: [requirementVisualText(edge?.to, '下游待确认')],
      edges: [`${requirementVisualText(edge?.from, '来源')} -> ${requirementVisualText(edge?.to, '目标')}`]
    }))
  }
  return pageDataRows.map((row, index) => {
    const reads = requirementDetailItems(row?.reads, '读取数据待确认', 5)
    const writes = requirementDetailItems(row?.writes, '写入数据待确认', 5)
    const downstream = requirementDetailItems(row?.downstreamLabels || row?.downstream, '下游待确认', 5)
    const pageId = requirementVisualText(row?.pageId, `page-${index + 1}`)
    const pageName = requirementVisualText(row?.pageName || row?.title, '页面待确认')
    const relatedEdges = edges
      .filter((edge) => [edge?.from, edge?.to, edge?.fromNodeId, edge?.toNodeId].some((value) => [pageId, pageName].includes(String(value || '').trim())))
      .map((edge) => `${edge?.from || edge?.fromNodeId || '来源'} -> ${edge?.to || edge?.toNodeId || '目标'}：${edge?.label || '流转'}`)
    return {
      key: pageId || `data-flow-${index + 1}`,
      pageId,
      pageName,
      reads,
      writes,
      downstream,
      edges: relatedEdges.length ? relatedEdges : [`${pageName} -> ${downstream.join('、')}`]
    }
  })
}

function requirementStateMachineVisualRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  const globalStates = Array.isArray(source.globalStates) ? source.globalStates : []
  const globalRow = globalStates.length
    ? [{
      key: 'global-state-machine',
      pageId: 'global',
      pageName: '全局状态',
      states: globalStates.map((state) => requirementVisualText(state?.state || state?.label, '状态待确认')),
      transitions: globalStates.map((transition, index) => ({
        key: transition?.id || `global-transition-${index + 1}`,
        from: requirementVisualText(transition?.state || transition?.from, 'from待确认'),
        event: requirementVisualText(transition?.trigger || transition?.event, 'event待确认'),
        to: requirementVisualText(transition?.to || transition?.display || transition?.recovery, 'to待确认')
      }))
    }]
    : []
  const pageRows = (Array.isArray(source.pageStates) ? source.pageStates : []).map((row, index) => {
    const transitions = (Array.isArray(row?.transitions) ? row.transitions : []).map((transition, transitionIndex) => ({
      key: transition?.id || `${row?.pageId || index + 1}-transition-${transitionIndex + 1}`,
      from: requirementVisualText(transition?.from, 'from待确认'),
      event: requirementVisualText(transition?.event || transition?.trigger || transition?.action, 'event待确认'),
      to: requirementVisualText(transition?.to || transition?.target || transition?.toPageId, 'to待确认')
    }))
    return {
      key: row?.pageId || `page-state-${index + 1}`,
      pageId: requirementVisualText(row?.pageId, `page-${index + 1}`),
      pageName: requirementVisualText(row?.pageName || row?.title, '页面状态待确认'),
      states: requirementDetailItems(row?.states, '状态待确认', 8),
      transitions: transitions.length ? transitions : [{
        key: `${row?.pageId || index + 1}-transition-empty`,
        from: '默认',
        event: '触发主操作',
        to: '结果态待确认'
      }]
    }
  })
  return [...globalRow, ...pageRows]
}

function requirementFeatureJumpVisualRows(block = {}, node = {}) {
  const source = resolveRequirementSourceRef(block.sourceRef, node) || {}
  const edges = Array.isArray(source.edges) ? source.edges : []
  return edges.map((edge, index) => {
    const fromPageId = requirementVisualText(edge?.fromPageId || edge?.fromNodeId, 'fromPageId待确认')
    const toPageId = requirementVisualText(edge?.toPageId || edge?.toNodeId, 'toPageId待确认')
    const condition = requirementVisualText(edge?.condition || edge?.triggerCondition, 'condition待确认')
    const preserveState = edge?.preserveState === false ? '否' : edge?.preserveState === true ? '是' : 'preserveState待确认'
    return {
      key: edge?.id || `feature-jump-${index + 1}`,
      from: requirementVisualText(edge?.from || edge?.sourcePageName, '来源页面待确认'),
      action: requirementVisualText(edge?.action || edge?.trigger, '触发动作待确认'),
      to: requirementVisualText(edge?.to || edge?.targetPageName, '目标页面待确认'),
      fromPageId,
      toPageId,
      condition,
      preserveState,
      note: String(edge?.note || edge?.impact || '').trim()
    }
  })
}

function requirementTextList(items = [], limit = 8) {
  const source = Array.isArray(items) ? items : [items]
  return source
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      return item.title || item.name || item.pageName || item.goal || item.question || item.summary || item.reason || ''
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function requirementProductDefinition(node = {}) {
  const definition = requirementDissectionArtifact(node).productDefinition || {}
  return {
    oneLine: String(definition.oneLine || definition.summary || '待补充产品一句话定义').trim(),
    productType: String(definition.productType || '产品类型待确认').trim(),
    bottomIntent: String(definition.bottomIntent || definition.primaryGoal || '底层意图待确认').trim()
  }
}

function requirementUserScenarioItems(node = {}) {
  const scenarios = requirementDissectionArtifact(node).userScenarios || {}
  return [
    ...requirementTextList(scenarios.primaryUsers, 3).map((item) => `用户：${item}`),
    ...requirementTextList(scenarios.coreScenarios, 3).map((item) => `场景：${item}`),
    ...requirementTextList(scenarios.jobsToBeDone, 3).map((item) => `任务：${item}`)
  ].slice(0, 8)
}

function requirementEvidenceItems(node = {}) {
  const evidence = requirementDissectionArtifact(node).evidenceAndAssumptions || {}
  return [
    evidence.demandScope ? `模式：${evidence.demandScope === 'project' ? '项目需求' : '非项目需求'}` : '',
    ...requirementTextList(evidence.evidenceSources, 3).map((item) => `来源：${item}`),
    ...requirementTextList(evidence.assumptions, 3).map((item) => `假设：${item}`),
    evidence.knowledgePolicy ? `规则：${evidence.knowledgePolicy}` : ''
  ].filter(Boolean).slice(0, 8)
}

function requirementScopeItems(node = {}) {
  const scope = requirementDissectionArtifact(node).scopeBoundary || {}
  return [
    ...requirementTextList(scope.p0, 4).map((item) => `P0：${item}`),
    ...requirementTextList(scope.p1, 2).map((item) => `P1：${item}`),
    ...requirementTextList(scope.outOfScope, 3).map((item) => `不做：${item}`)
  ].slice(0, 8)
}

function requirementPageRequirementItems(node = {}) {
  const pages = requirementDissectionArtifact(node).designRequirementMap?.pages || []
  return (Array.isArray(pages) ? pages : [])
    .map((page) => `${page.pageName || page.title || '页面'}：${page.goal || page.primaryAction || '页面职责待确认'}`)
    .slice(0, 10)
}

function requirementCompetitiveMode(node = {}) {
  const mode = requirementDissectionArtifact(node).competitiveAnalysis?.referenceMode || ''
  if (mode === 'industry-assumption') return '未提供具体竞品，当前为行业常识假设'
  if (mode === 'user-mentioned-reference') return '基于用户提到的参考对象，仍需补充具体名称或截图'
  return mode || '竞品参考待确认'
}

function requirementCompetitiveItems(node = {}) {
  const competitive = requirementDissectionArtifact(node).competitiveAnalysis || {}
  return [
    ...requirementTextList(competitive.industryBaseline, 4).map((item) => `标配：${item}`),
    ...requirementTextList(competitive.pagePatternInsights, 3).map((item) => `页面：${item}`),
    ...requirementTextList(competitive.implicationsForThisProject?.avoidScope, 3).map((item) => `不照搬：${item}`)
  ].slice(0, 8)
}

function requirementDownstreamItems(node = {}) {
  const hints = requirementDissectionArtifact(node).downstreamHints || {}
  return [
    ...requirementTextList(hints.interactionLofi, 3).map((item) => `交互低保：${item}`),
    ...requirementTextList(hints.uiVisual, 2).map((item) => `UI视觉：${item}`),
    ...requirementTextList(hints.frontendBackend, 3).map((item) => `前后端：${item}`)
  ].slice(0, 8)
}

function requirementDataStateItems(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  const dataFlow = artifact.dataFlowGraph || {}
  const states = artifact.stateMachineMap || {}
  return [
    ...(Array.isArray(dataFlow.edges) ? dataFlow.edges.slice(0, 4).map((edge) => `${edge.from || '来源'} -> ${edge.to || '目标'}：${edge.label || '流转'}`) : []),
    ...(Array.isArray(states.globalStates) ? states.globalStates.slice(0, 4).map((row) => `${row.state || '状态'}：${row.trigger || '触发'} -> ${row.display || '展示'}`) : [])
  ].filter(Boolean).slice(0, 8)
}

function shouldUseRequirementSectionDetail(node = {}) {
  return shouldUseRequirementReportDetail(node) && !hasRequirementPipeline(node) && !isAgentConfirmationNode(node)
}

function requirementReadableItem(item = '') {
  if (typeof item === 'string') return String(item || '').trim()
  if (!item || typeof item !== 'object') return ''
  const title = item.title || item.name || item.pageName || item.question || item.goal || item.summary || ''
  const detail = item.reason || item.impact || item.primaryAction || item.description || item.priority || ''
  if (title && detail && String(title).trim() !== String(detail).trim()) return `${title}：${detail}`
  if (title) return String(title).trim()
  return Object.entries(item)
    .filter(([key, value]) => !/^(id|key|nodeId|pageId|version)$/.test(key) && value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}：${Array.isArray(value) ? value.join('、') : String(value)}`)
    .join('；')
}

function requirementDetailItems(items = [], fallback = '待模型补充', limit = 12) {
  const source = Array.isArray(items) ? items : [items]
  const values = source
    .map((item) => cleanNodeDisplayCopy(requirementReadableItem(item)))
    .filter(Boolean)
    .slice(0, limit)
  return values.length ? values : [fallback]
}

function requirementDetailGroup(title, items = [], meta = '', fallback = '待模型补充', limit = 12) {
  return {
    title,
    meta,
    items: requirementDetailItems(items, fallback, limit)
  }
}

function requirementPageDetailItems(node = {}) {
  const pages = requirementDissectionArtifact(node).designRequirementMap?.pages || []
  return (Array.isArray(pages) ? pages : [])
    .map((page) => {
      if (!page || typeof page !== 'object') return requirementReadableItem(page)
      const name = page.pageName || page.title || '页面'
      const parts = [
        page.goal ? `目标：${page.goal}` : '',
        Array.isArray(page.mustCarry) && page.mustCarry.length ? `必须承载：${page.mustCarry.join('、')}` : '',
        page.primaryAction ? `主操作：${page.primaryAction}` : '',
        Array.isArray(page.states) && page.states.length ? `状态：${page.states.join('、')}` : '',
        Array.isArray(page.dataDependencies) && page.dataDependencies.length ? `数据：${page.dataDependencies.join('、')}` : '',
        Array.isArray(page.acceptanceCriteria) && page.acceptanceCriteria.length ? `验收：${page.acceptanceCriteria.join('、')}` : ''
      ].filter(Boolean)
      return `${name}：${parts.join('；') || '页面职责待模型补充'}`
    })
    .filter(Boolean)
}

function requirementModuleDetailItems(node = {}) {
  return projectFunctionModules(node).map((module) => {
    const pageNames = (module.pages || []).map((page) => page.pageName).filter(Boolean)
    return `${module.name}：${module.summary || '模块职责待模型补充'}${pageNames.length ? `；页面：${pageNames.join('、')}` : ''}`
  })
}

function requirementPageTableRows(node = {}) {
  const pages = requirementDissectionArtifact(node).designRequirementMap?.pages || []
  return (Array.isArray(pages) ? pages : [])
    .map((page, index) => ({
      key: page?.pageId || page?.id || page?.pageName || page?.title || `page-${index + 1}`,
      cells: [
        page?.pageName || page?.title || `页面 ${index + 1}`,
        page?.goal || '目标待模型补充',
        page?.primaryAction || '主操作待模型补充',
        [
          Array.isArray(page?.states) && page.states.length ? `状态：${page.states.join('、')}` : '',
          Array.isArray(page?.dataDependencies) && page.dataDependencies.length ? `数据：${page.dataDependencies.join('、')}` : ''
        ].filter(Boolean).join('；') || '状态/数据待模型补充'
      ]
    }))
}

function requirementPageCoverageRows(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  const rows = artifact.pageCoverageMatrix || artifact.designRequirementMap?.pageCoverageMatrix || []
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      key: row?.id || row?.pageId || row?.pageName || `coverage-${index + 1}`,
      cells: [
        row?.pageName || row?.title || `页面 ${index + 1}`,
        row?.pageType || row?.type || '页面类型待确认',
        `${row?.entryFrom || row?.from || '入口待确认'} -> ${row?.exitTo || row?.to || '出口待确认'}`,
        [
          Array.isArray(row?.primaryActions) && row.primaryActions.length ? `操作：${row.primaryActions.join('、')}` : '',
          Array.isArray(row?.stateCoverage) && row.stateCoverage.length ? `状态：${row.stateCoverage.join('、')}` : ''
        ].filter(Boolean).join('；') || '主操作/状态待确认'
      ]
    }))
}

function requirementRiskRows(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  const questionRows = (Array.isArray(artifact.openQuestions) ? artifact.openQuestions : [])
    .map((item, index) => ({
      key: item?.id || item?.question || `question-${index + 1}`,
      tone: item?.priority === 'must-confirm' ? 'high' : 'medium',
      cells: [
        requirementReadableItem(item) || `待确认问题 ${index + 1}`,
        item?.priority === 'must-confirm' ? '阻塞后续口径' : '可后续追问',
        '通过 Agent 继续补齐',
        item?.priority || '待判断'
      ]
    }))
  const riskRows = (Array.isArray(artifact.risks) ? artifact.risks : [])
    .map((item, index) => ({
      key: item?.id || item?.question || `risk-${index + 1}`,
      tone: 'medium',
      cells: [
        requirementReadableItem(item) || `风险 ${index + 1}`,
        item?.impact || '会影响页面、接口或验收口径',
        '确认后同步到下游生成依据',
        'risk'
      ]
    }))
  return [...questionRows, ...riskRows].length
    ? [...questionRows, ...riskRows]
    : [{
        key: 'empty-risk',
        tone: 'low',
        cells: ['暂无明确风险', '不阻塞', '后续生成时继续观察', 'low']
    }]
}

function requirementModuleMatrixRows(node = {}) {
  const rows = requirementDissectionArtifact(node).functionModuleMatrix || []
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      key: row?.id || `module-matrix-${index + 1}`,
      cells: [
        row?.level || '层级待确认',
        row?.moduleName || '模块待确认',
        row?.pageName || '页面待确认',
        [`入口：${row?.entry || '待确认'}`, `用户：${row?.targetUser || '待确认'}`, row?.priority || ''].filter(Boolean).join('；')
      ]
    }))
}

function requirementDecisionRows(node = {}) {
  const rows = requirementDissectionArtifact(node).decisionPointMatrix || []
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      key: row?.id || `decision-${index + 1}`,
      cells: [
        row?.decisionPoint || '决策点待确认',
        row?.pageName || '页面待确认',
        requirementDetailItems(row?.options, '选项待确认', 6).join(' / '),
        [row?.impact, row?.recommendation].filter(Boolean).join('；') || '影响待模型补充'
      ]
    }))
}

function requirementExceptionRows(node = {}) {
  const rows = requirementDissectionArtifact(node).exceptionRecoveryMatrix || []
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      key: row?.id || `exception-${index + 1}`,
      cells: [
        row?.scenario || '异常场景待确认',
        row?.triggerCondition || '触发条件待确认',
        row?.systemFeedback || '系统反馈待确认',
        row?.recoveryPath || '恢复路径待确认'
      ]
    }))
}

function requirementDataFlowItems(node = {}) {
  const rows = requirementDissectionArtifact(node).dataFlowGraph?.pageData || []
  return (Array.isArray(rows) ? rows : [])
    .map((row) => `${row.pageName || '页面'}｜读取：${requirementDetailItems(row.reads, '读取数据待确认', 4).join('、')}｜写入：${requirementDetailItems(row.writes, '写入数据待确认', 4).join('、')}`)
}

function requirementJumpRows(node = {}) {
  const rows = requirementDissectionArtifact(node).featureJumpGraph?.edges || []
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      key: row?.id || `jump-${index + 1}`,
      cells: [
        row?.from || '来源待确认',
        row?.action || '进入',
        row?.to || '目标待确认',
        row?.note || '说明待补充'
      ]
    }))
}

function requirementSharingRows(node = {}) {
  const rows = requirementDissectionArtifact(node).dataSharingMechanism?.resources || []
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      key: `${row?.resourceType || 'resource'}-${index + 1}`,
      cells: [
        row?.resourceType || '资源待确认',
        [`创建：${row?.createdBy || '待确认'}`, `存储：${row?.storedIn || '待确认'}`].join('；'),
        requirementDetailItems(row?.consumedBy, '使用方待确认', 6).join('、'),
        row?.sharingMode || '共享方式待确认'
      ]
    }))
}

function requirementCrossPageRelationRows(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  const jumpRows = artifact.featureJumpGraph?.edges || []
  return (Array.isArray(jumpRows) ? jumpRows : [])
    .map((row, index) => ({
      key: row?.id || `jump-${index + 1}`,
      cells: [
        '跳转',
        `${row?.from || '来源待确认'} -> ${row?.to || '目标待确认'}`,
        row?.action || '进入',
        row?.note || '说明待补充'
      ]
    }))
}

function requirementInteractionSpecRows(node = {}) {
  const pages = requirementDissectionArtifact(node).designRequirementMap?.pages || []
  return (Array.isArray(pages) ? pages : [])
    .flatMap((page, pageIndex) => {
      const hotspots = Array.isArray(page?.interactionHotspots) ? page.interactionHotspots : []
      if (!hotspots.length) {
        return [{
          key: `${page?.pageId || page?.id || page?.pageName || pageIndex + 1}-empty`,
          cells: [
            page?.pageName || page?.title || `页面 ${pageIndex + 1}`,
            page?.primaryAction || '主操作待确认',
            '触发/反馈待模型补充',
            requirementDetailItems(page?.acceptanceCriteria, '验收点待确认', 3).join('、')
          ]
        }]
      }
      return hotspots.slice(0, 4).map((hotspot, hotspotIndex) => ({
        key: `${page?.pageId || page?.id || page?.pageName || pageIndex + 1}-${hotspot?.target || hotspotIndex + 1}`,
        cells: [
          page?.pageName || page?.title || `页面 ${pageIndex + 1}`,
          hotspot?.target || '交互对象待确认',
          [hotspot?.condition || hotspot?.gesture || '触发条件待确认', hotspot?.operation || '用户动作待确认', hotspot?.feedback || '系统反馈待确认'].join('；'),
          requirementDetailItems(hotspot?.testPoints || page?.acceptanceCriteria, '验收点待确认', 3).join('、')
        ]
      }))
    })
}

function requirementSectionKey(node = {}) {
  const value = `${node?.id || ''} ${node?.title || ''}`
  if (/evidence|依据|假设/.test(value)) return 'evidence'
  if (/source|产品判断|产品定义|需求识别|需求分析|需求解剖/.test(value)) return 'product'
  if (/user-scenarios|目标用户|用户与场景|场景/.test(value)) return 'users'
  if (/intent|scope|范围边界|边界/.test(value)) return 'scope'
  if (/navigation|导航结构|导航/.test(value)) return 'navigation'
  if (/function-module|功能模块划分|模块划分/.test(value)) return 'module-matrix'
  if (/function-map|功能层级|功能地图/.test(value)) return 'function'
  if (/page-hierarchy|页面层级|层级关系/.test(value)) return 'hierarchy'
  if (/journey|path|用户路径|核心用户路径/.test(value)) return 'journey'
  if (/page-coverage|页面覆盖|覆盖矩阵/.test(value)) return 'coverage'
  if (/decision-flow|决策流程/.test(value)) return 'decision-flow'
  if (/decision|决策点/.test(value)) return 'decision'
  if (/exception|异常|恢复路径/.test(value)) return 'exception'
  if (/data-state|数据与状态|数据、资源与状态|状态流转/.test(value)) return 'data-state'
  if (/cross-page-relations|跨页面\/跨功能关联|跨页面|跨功能关联/.test(value)) return 'cross-page-relations'
  if (/interaction-spec-standards|交互说明规格|交互规格|交互说明/.test(value)) return 'interaction-spec-standards'
  if (/feature-jump|功能跳转|跳转关系/.test(value)) return 'feature-jump'
  if (/data-sharing|数据共享|共享机制/.test(value)) return 'data-sharing'
  if (/page-requirements|页面需求|页面清单/.test(value)) return 'pages'
  if (/business|业务规则|状态/.test(value)) return 'business'
  if (/risk|风险|待确认/.test(value)) return 'risk'
  if (/competitive|竞品|参考/.test(value)) return 'competitive'
  if (/downstream|下游|生成依据/.test(value)) return 'downstream'
  return 'overview'
}

function requirementSectionDetail(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  const product = artifact.productDefinition || {}
  const users = artifact.userScenarios || {}
  const scope = artifact.scopeBoundary || {}
  const journey = artifact.userJourneyMap || {}
  const designMap = artifact.designRequirementMap || {}
  const competitive = artifact.competitiveAnalysis || {}
  const downstream = artifact.downstreamHints || {}
  const evidence = artifact.evidenceAndAssumptions || {}
  const navigation = artifact.navigationStructure || {}
  const hierarchy = artifact.pageHierarchyTree || {}
  const dataFlow = artifact.dataFlowGraph || {}
  const stateMachine = artifact.stateMachineMap || {}
  const jumpGraph = artifact.featureJumpGraph || {}
  const sharing = artifact.dataSharingMechanism || {}
  const base = {
    title: node.title || '需求分析详情',
    layout: 'report',
    meta: '按当前卡片主题展开结构化分析',
    summary: cleanNodeDisplayCopy(node.summary || product.oneLine || ''),
    groups: [],
    rows: []
  }
  switch (requirementSectionKey(node)) {
    case 'evidence':
      return {
        ...base,
        title: '依据与假设详情',
        groups: [
          requirementDetailGroup('当前模式', [evidence.demandScope === 'project' ? '项目需求' : '非项目需求']),
          requirementDetailGroup('确认事实', evidence.confirmedFacts),
          requirementDetailGroup('证据来源', evidence.evidenceSources),
          requirementDetailGroup('推导假设', evidence.assumptions),
          requirementDetailGroup('知识使用规则', [evidence.knowledgePolicy]),
          requirementDetailGroup('待补证据', evidence.openEvidenceQuestions)
        ]
      }
    case 'product':
      return {
        ...base,
        title: '需求识别与产品判断详情',
        groups: [
          requirementDetailGroup('产品定义', [product.oneLine, product.productType ? `产品类型：${product.productType}` : '', product.surfaceAsk ? `表层诉求：${product.surfaceAsk}` : '', product.bottomIntent ? `底层意图：${product.bottomIntent}` : '']),
          requirementDetailGroup('来源与输入', [product.productName ? `项目：${product.productName}` : '', product.documentCount ? `文档数量：${product.documentCount}` : '', product.sourceSummary ? `来源摘要：${product.sourceSummary}` : '']),
          requirementDetailGroup('成功信号', product.successSignals)
        ]
      }
    case 'users':
      return {
        ...base,
        title: '目标用户与场景详情',
        groups: [
          requirementDetailGroup('目标用户', users.primaryUsers),
          requirementDetailGroup('核心场景', users.coreScenarios),
          requirementDetailGroup('用户任务', users.jobsToBeDone),
          requirementDetailGroup('设计转译', users.designImplications)
        ]
      }
    case 'scope':
      return {
        ...base,
        title: '范围边界详情',
        groups: [
          requirementDetailGroup('P0 必做', scope.p0),
          requirementDetailGroup('P1 可增强', scope.p1),
          requirementDetailGroup('本期不做', scope.outOfScope),
          requirementDetailGroup('依赖条件', scope.dependencies)
        ]
      }
    case 'navigation':
      return {
        ...base,
        layout: 'tree',
        title: '导航结构详情',
        groups: [
          requirementDetailGroup('全局入口', navigation.globalEntries),
          requirementDetailGroup('模块入口', (navigation.moduleEntries || []).map((item) => `${item.moduleName}：${requirementDetailItems(item.pages, item.summary || '待模型补充', 8).join('、')}`)),
          requirementDetailGroup('辅助入口', navigation.auxiliaryEntries)
        ]
      }
    case 'module-matrix':
      return {
        ...base,
        layout: 'table',
        title: '功能模块划分详情',
        tableHeaders: ['层级', '模块', '页面', '入口/用户'],
        rows: requirementModuleMatrixRows(node)
      }
    case 'function':
      return {
        ...base,
        layout: 'tree',
        title: '功能层级地图详情',
        groups: [
          requirementDetailGroup('一级模块', requirementModuleDetailItems(node)),
          requirementDetailGroup('页面归属', projectFunctionPages(node).map((page) => `${page.pageName}：${(page.belongsTo || []).join(' / ') || page.entry || page.priority || '归属待模型补充'}`)),
          requirementDetailGroup('用户主路径', projectFunctionPath(node))
        ]
      }
    case 'hierarchy':
      return {
        ...base,
        layout: 'tree',
        title: '页面层级关系详情',
        groups: [
          requirementDetailGroup('页面层级树', (hierarchy.nodes || []).map((item) => `${item.label}：${(item.children || []).map((child) => child.label).filter(Boolean).join('、') || '待补页面'}`)),
          requirementDetailGroup('叶子页面数量', [hierarchy.leafPageCount ? `${hierarchy.leafPageCount}` : '待确认'])
        ]
      }
    case 'journey':
      return {
        ...base,
        layout: 'timeline',
        title: '核心用户路径详情',
        groups: [
          requirementDetailGroup('新用户首次路径', journey.firstTimePath),
          requirementDetailGroup('老用户复用路径', journey.returningPath),
          requirementDetailGroup('异常回退路径', journey.exceptionPath)
        ]
      }
    case 'decision':
      return {
        ...base,
        layout: 'table',
        title: '决策点矩阵详情',
        tableHeaders: ['决策点', '所在页面', '选项', '影响/策略'],
        rows: requirementDecisionRows(node)
      }
    case 'decision-flow':
      return {
        ...base,
        layout: 'timeline',
        title: '决策流程图详情',
        groups: [
          requirementDetailGroup('决策分支', (artifact.decisionFlowGraph?.branches || []).map((row) => `${row.from} -> ${row.question} -> ${requirementDetailItems(row.options, '待补选项', 4).join(' / ')}`)),
          requirementDetailGroup('推荐路径', (artifact.decisionFlowGraph?.branches || []).map((row) => `${row.question}：${row.recommendation || '待模型补充'}`))
        ]
      }
    case 'pages':
      return {
        ...base,
        layout: 'table',
        title: '页面需求清单详情',
        tableHeaders: ['页面', '页面目标', '主操作', '状态/数据'],
        rows: requirementPageTableRows(node),
        groups: [
          requirementDetailGroup('页面目标与主操作', requirementPageDetailItems(node)),
          requirementDetailGroup('全局状态', designMap.globalStates),
          requirementDetailGroup('交互重点', designMap.interactionFocus),
          requirementDetailGroup('验收口径', designMap.acceptanceChecklist)
        ]
      }
    case 'coverage':
      return {
        ...base,
        layout: 'table',
        title: '页面覆盖矩阵详情',
        tableHeaders: ['页面', '类型', '入口/出口', '主操作/状态'],
        rows: requirementPageCoverageRows(node),
        groups: [
          requirementDetailGroup('参与页面', requirementPageCoverageRows(node).map((row) => row.cells.join('｜'))),
          requirementDetailGroup('缺口处理', ['逐项核对来源证据、入口出口、主操作和状态覆盖', '缺少证据的页面进入待确认项，不用产物节点替代真实页面'])
        ]
      }
    case 'business':
      return {
        ...base,
        title: '业务规则与状态详情',
        groups: [
          requirementDetailGroup('业务对象', business.dataObjects),
          requirementDetailGroup('状态规则', business.statusRules),
          requirementDetailGroup('权限规则', business.permissionRules)
        ]
      }
    case 'exception':
      return {
        ...base,
        layout: 'table',
        title: '异常与恢复路径详情',
        tableHeaders: ['异常场景', '触发条件', '系统反馈', '恢复路径'],
        rows: requirementExceptionRows(node)
      }
    case 'data-state':
      return {
        ...base,
        title: '数据与状态流转详情',
        groups: [
          requirementDetailGroup('跨阶段数据流', (dataFlow.edges || []).map((edge) => `${edge.from} -> ${edge.to}：${edge.label || '流转'}`)),
          requirementDetailGroup('页面读写', requirementDataFlowItems(node)),
          requirementDetailGroup('全局状态机', (stateMachine.globalStates || []).map((row) => `${row.state}：${row.trigger || '触发'} -> ${row.display || '展示'}`)),
          requirementDetailGroup('页面状态片段', (stateMachine.pageStates || []).map((row) => `${row.pageName}：${requirementDetailItems(row.states, '状态待补充', 6).join('、')}`))
        ]
      }
    case 'cross-page-relations':
      return {
        ...base,
        layout: 'table',
        title: '跨页面/跨功能关联详情',
        tableHeaders: ['类型', '对象/路径', '动作', '说明'],
        rows: requirementCrossPageRelationRows(node),
        groups: [
          requirementDetailGroup('跨功能风险', jumpGraph.crossFunctionRisks)
        ]
      }
    case 'interaction-spec-standards':
      return {
        ...base,
        layout: 'table',
        title: '交互说明规格详情',
        tableHeaders: ['页面', '交互对象', '触发/动作/反馈', '验收点'],
        rows: requirementInteractionSpecRows(node),
        groups: [
          requirementDetailGroup('交互说明字段', ['交互对象', '触发条件', '用户动作', '系统反馈', '状态提示文案', '跳转/结果', '异常处理', '数据依赖', '验收点']),
          requirementDetailGroup('页面级继承', ['页面覆盖矩阵', '关联决策点', '异常与恢复路径', '状态机片段', '数据依赖', '跳转关系'])
        ]
      }
    case 'feature-jump':
      return {
        ...base,
        layout: 'table',
        title: '功能跳转关系详情',
        tableHeaders: ['来源', '动作', '目标', '说明'],
        rows: requirementJumpRows(node),
        groups: [
          requirementDetailGroup('跨功能风险', jumpGraph.crossFunctionRisks)
        ]
      }
    case 'data-sharing':
      return {
        ...base,
        layout: 'table',
        title: '数据共享机制详情',
        tableHeaders: ['资源', '创建/存储', '使用方', '共享方式'],
        rows: requirementSharingRows(node),
        groups: [
          requirementDetailGroup('沉淀规则', [sharing.policy])
        ]
      }
    case 'risk':
      return {
        ...base,
        layout: 'risk',
        title: '风险与待确认详情',
        riskHeaders: ['问题/风险', '影响', '处理方式', '优先级'],
        rows: requirementRiskRows(node),
        groups: [
          requirementDetailGroup('待确认问题', artifact.openQuestions),
          requirementDetailGroup('风险影响', artifact.risks),
          requirementDetailGroup('处理方式', ['影响页面、接口或验收时标记为必确认', '不阻塞主路径时可进入下一阶段并保留追问', '通过 Agent 继续补齐缺口'])
        ]
      }
    case 'competitive':
      return {
        ...base,
        title: '竞品参考详情',
        summary: requirementCompetitiveMode(node),
        groups: [
          requirementDetailGroup('证据状态', [competitive.evidenceNotice || '竞品证据待补充']),
          requirementDetailGroup('参考对象', competitive.referenceProducts?.map((item) => `${item.name || '参考对象'}：${item.reason || '原因待模型补充'}`)),
          requirementDetailGroup('补充竞品入口', competitive.nextActions),
          requirementDetailGroup('建议检索方向', competitive.researchSearchDirections),
          requirementDetailGroup('对比维度', competitive.comparisonDimensions),
          requirementDetailGroup('行业标配', competitive.industryBaseline),
          requirementDetailGroup('页面模式启发', competitive.pagePatternInsights),
          requirementDetailGroup('不建议照搬', competitive.implicationsForThisProject?.avoidScope)
        ]
      }
    case 'downstream':
      return {
        ...base,
        title: '下游生成依据详情',
        groups: [
          requirementDetailGroup('给交互低保', downstream.interactionLofi),
          requirementDetailGroup('给 UI 视觉', downstream.uiVisual),
          requirementDetailGroup('给前后端交付', downstream.frontendBackend)
        ]
      }
    default:
      return {
        ...base,
        groups: [
          requirementDetailGroup('产品判断', [product.oneLine, product.bottomIntent]),
          requirementDetailGroup('页面需求', requirementPageDetailItems(node), '', '页面需求待模型补充', 6),
          requirementDetailGroup('风险与待确认', [...(artifact.openQuestions || []), ...(artifact.risks || [])], '', '暂无待确认项')
        ]
      }
  }
}

function isPureContentNode(node = {}) {
  return node?.mode === 'dialogue-page' || Boolean(node?.pureContent)
}

function pureContentText(node = {}) {
  if (node?.pureContent) return String(node.pureContent)
  const fallback = [
    node.summary,
    ...(Array.isArray(node.content) ? node.content : [])
  ].filter(Boolean)
  return fallback.join('\n')
}

function confirmationItems(node = {}, key, fallback = []) {
  const items = node.confirmation?.[key]
  return (Array.isArray(items) ? items : fallback)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function agentConfirmationContextText(node = {}) {
  return String(node.confirmation?.sourceContext || '').trim()
}

function nodeContentConfirmationSections(node = {}) {
  const items = (Array.isArray(node.content) ? node.content : [])
    .map((item) => treeItemLabel(item))
    .filter(Boolean)
  if (!items.length && !node.summary) return []
  const detailItems = (Array.isArray(node.detailSections) ? node.detailSections : [])
    .flatMap((section) => (Array.isArray(section?.items) ? section.items : []))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return [
    {
      title: '当前理解',
      meta: '来自当前节点最新模型产出',
      tone: 'primary',
      items: [node.summary, ...items].filter(Boolean)
    },
    {
      title: '已确认事实',
      meta: '来自当前画布节点详情',
      tone: 'success',
      items: detailItems.length ? detailItems : confirmationItems(node, 'confirmedFacts', [])
    },
    {
      title: '待确认问题',
      meta: '用于推动下一轮 Agent 对话',
      tone: 'warning',
      items: confirmationItems(node, 'openQuestions', node.agentInteraction?.suggestedQuestions || [])
    }
  ].filter((section) => section.items.length)
}

function agentConfirmationSections(node = {}) {
  const liveSections = nodeContentConfirmationSections(node)
  if (liveSections.length) return liveSections
  return [
    {
      title: '当前理解',
      meta: 'Agent 对需求的阶段性归纳',
      tone: 'primary',
      items: confirmationItems(node, 'currentUnderstanding', [node.summary])
    },
    {
      title: '已确认事实',
      meta: '来自输入、资料或项目选择',
      tone: 'success',
      items: confirmationItems(node, 'confirmedFacts', ['等待用户补充可确认的信息。'])
    },
    {
      title: 'AI 推断',
      meta: '可被用户修正，不作为最终结论',
      tone: 'neutral',
      items: confirmationItems(node, 'aiAssumptions', ['需要先明确目标用户、业务目标和边界。'])
    },
    {
      title: '待确认问题',
      meta: '用于推动下一轮 Agent 对话',
      tone: 'warning',
      items: confirmationItems(node, 'openQuestions', node.agentInteraction?.suggestedQuestions || [])
    },
    {
      title: '下一步建议',
      meta: '确认后再进入画布或后续阶段',
      tone: 'next',
      items: confirmationItems(node, 'nextSuggestions', ['点击下一步继续确认，或转低保真画布。'])
    }
  ].filter((section) => section.items.length)
}

function visibleAgentConfirmationSections(node = {}) {
  return sortAgentConfirmationSections(
    agentConfirmationSections(node)
      .filter((section) => !['当前理解', '已确认事实', '待确认问题'].includes(section.title))
  )
}

function sortAgentConfirmationSections(sections = []) {
  return sections.slice().sort((a, b) => {
    if (isPendingQuestionSection(a)) return -1
    if (isPendingQuestionSection(b)) return 1
    return 0
  })
}

function isPendingQuestionSection(section = {}) {
  return section.title === '待确认问题'
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

function detailSectionItemsExcept(node = {}, titlePattern, excludeMatcher = /内容状态/) {
  const matcher = titlePattern instanceof RegExp ? titlePattern : new RegExp(String(titlePattern || ''), 'i')
  const exclude = excludeMatcher instanceof RegExp ? excludeMatcher : new RegExp(String(excludeMatcher || '$^'), 'i')
  return (Array.isArray(node.detailSections) ? node.detailSections : [])
    .filter((section) => {
      const title = `${section.title || ''} ${section.meta || ''}`
      return matcher.test(title) && !exclude.test(title)
    })
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

function stageDetailSectionKey(nodeId = '', sectionTitle = '') {
  return `${nodeId}:stage-detail:${sectionTitle}`
}

function isStageDetailSectionExpanded(nodeId = '', sectionTitle = '') {
  return !expandedTreeItems.value.has(stageDetailSectionKey(nodeId, sectionTitle))
}

function toggleStageDetailSection(nodeId = '', sectionTitle = '') {
  const key = stageDetailSectionKey(nodeId, sectionTitle)
  const next = new Set(expandedTreeItems.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedTreeItems.value = next
}

function collapseAllStageDetailSections(node = {}) {
  if (!node?.id) return
  const next = new Set(expandedTreeItems.value)
  interactionDetailSections(node).forEach((section) => {
    next.add(stageDetailSectionKey(node.id, section.title))
  })
  expandedTreeItems.value = next
}

function expandAllStageDetailSections(node = {}) {
  if (!node?.id) return
  const next = new Set(expandedTreeItems.value)
  interactionDetailSections(node).forEach((section) => {
    next.delete(stageDetailSectionKey(node.id, section.title))
  })
  expandedTreeItems.value = next
}

function isInteractionPageDetail(node = {}) {
  return isInteractionLofiPageNode(node)
}

function isVisualGalleryDetail(node = {}) {
  return node?.detailLayout === 'visual-gallery'
}

function isPreviewCodeDetail(node = {}) {
  const targetGenerator = String(node?.targetGenerator || '').trim().toLowerCase()
  return node?.detailLayout === 'preview-code-split' ||
    node?.stageId === 'html-output' ||
    node?.stageId === 'vue-output' ||
    targetGenerator === 'html' ||
    targetGenerator === 'vue'
}

function isAcceptanceDepositDetail(node = {}) {
  return node?.detailLayout === 'acceptance-deposit'
}

function isStageSpecificDetail(node = {}) {
  return isInteractionPageDetail(node) || isVisualGalleryDetail(node) || isPreviewCodeDetail(node) || isAcceptanceDepositDetail(node)
}

function wireframeTreeItems(node = {}) {
  return Array.isArray(node.wireframeTree) ? node.wireframeTree.filter((item) => item && typeof item === 'object') : []
}

function pageArchitecture(node = {}) {
  return node.pageArchitecture && typeof node.pageArchitecture === 'object'
    ? node.pageArchitecture
    : null
}

function pageArchitectureSections(node = {}) {
  const architecture = pageArchitecture(node)
  if (architecture) {
    return [
      { title: architecture.title || node.title || '页面', type: 'page', items: [architecture.goal].filter(Boolean) },
      { title: '页面核心模块', type: 'section', items: Array.isArray(architecture.sections) ? architecture.sections : [] },
      { title: '用户点击动作', type: 'action', items: Array.isArray(architecture.primaryActions) ? architecture.primaryActions : [] },
      { title: '状态层', type: 'state', items: Array.isArray(architecture.states) ? architecture.states : [] },
      { title: '跳转关系', type: 'route', items: [architecture.nextPage ? `下一页：${architecture.nextPage}` : ''].filter(Boolean) }
    ].filter((section) => section.items.length)
  }
  return wireframeTreeItems(node).map((item) => ({
    title: item.label || '页面结构',
    type: item.type || 'section',
    items: Array.isArray(item.children) ? item.children : []
  }))
}

function interactionDetails(node = {}) {
  return node.interactionDetails && typeof node.interactionDetails === 'object'
    ? node.interactionDetails
    : null
}

function interactionSpecItems(node = {}) {
  return (Array.isArray(node.interactionSpec) ? node.interactionSpec : detailSectionItems(node, /交互|跳转|状态|验收|接口|数据/))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function interactionSpecFieldName(item = '') {
  const text = String(item || '').trim()
  const match = text.match(/^([^：:]{1,28})[：:]/)
  return match ? match[1].trim() : text
}

function normalizeInteractionSpecItems(items = []) {
  const normalizedItems = items
    .flatMap((item) => String(item || '').split(/[；;]\s*/))
    .map((item) => item.trim())
    .filter(Boolean)
  return Array.from(new Set(normalizedItems))
}

function interactionSpecSectionItems(node = {}, matcher, excludeMatcher = /内容状态/) {
  const detailItems = detailSectionItemsExcept(node, matcher, excludeMatcher)
  const specItems = interactionSpecItems(node)
    .filter((item) => matcher.test(interactionSpecFieldName(item)))
    .map((item) => item.replace(/^[^：:]{2,28}[：:]\s*/, '').trim())
  return normalizeInteractionSpecItems([...detailItems, ...specItems])
}

function interactionRouteSummary(node = {}) {
  const architecture = pageArchitecture(node)
  const details = interactionDetails(node)
  if (architecture || details) {
    return [
      { label: '页面目标', value: architecture?.goal || node.summary || '等待大模型补充页面目标' },
      { label: '主动作', value: details?.clickActions?.[0] || architecture?.primaryActions?.[0] || '等待大模型补充主动作' },
      { label: '下一页面', value: details?.routeTargets?.[0] || architecture?.nextPage || '等待大模型补充跳转关系' },
      { label: '数据依赖', value: details?.dataDependencies?.[0] || '等待大模型补充接口或数据依赖' }
    ]
  }
  const targetItems = interactionSpecSectionItems(node, /页面目标|目标/)
  const actionItems = interactionSpecSectionItems(node, /用户点击动作|点击动作|用户动作|动作/)
  const routeItems = interactionSpecSectionItems(node, /跳转到哪个页面|跳转关系|跳转/)
  const dataItems = interactionSpecSectionItems(node, /前后端接口|接口|数据依赖|数据/)
  return [
    { label: '页面目标', value: targetItems[0] || node.summary || '等待大模型补充页面目标' },
    { label: '主动作', value: actionItems[0] || '等待大模型补充主动作' },
    { label: '下一页面', value: routeItems[0] || '等待大模型补充跳转关系' },
    { label: '数据依赖', value: dataItems[0] || '等待大模型补充接口或数据依赖' }
  ]
}

function interactionSpecSections(node = {}) {
  const sectionConfigs = [
    { title: '页面目标', matcher: /页面目标|目标/ },
    { title: '页面核心模块', matcher: /页面核心模块|核心模块|模块/ },
    { title: '用户点击动作', matcher: /用户点击动作|点击动作|用户动作|动作/ },
    { title: '跳转到哪个页面', matcher: /跳转到哪个页面|跳转关系|跳转/ },
    { title: '加载 / 空状态 / 失败 / 权限等状态', matcher: /加载|空状态|失败|权限|状态覆盖|状态/, excludeMatcher: /内容状态/ },
    { title: '前后端接口或数据依赖', matcher: /前后端接口|接口|数据依赖|数据/ },
    { title: '验收点', matcher: /验收点|验收/ }
  ]
  return sectionConfigs.map((config) => {
    const items = interactionSpecSectionItems(node, config.matcher, config.excludeMatcher || /内容状态/)
    return {
      title: config.title,
      items: items.length ? items.slice(0, 6) : ['等待大模型补充该项说明。']
    }
  })
}

function interactionDetailSections(node = {}) {
  const details = interactionDetails(node)
  if (!details) return interactionSpecSections(node)
  return [
    { title: '页面目标', items: [pageArchitecture(node)?.goal || node.summary].filter(Boolean) },
    { title: '页面核心模块', items: Array.isArray(pageArchitecture(node)?.sections) ? pageArchitecture(node).sections : [] },
    { title: '用户点击动作', items: Array.isArray(details.clickActions) ? details.clickActions : [] },
    { title: '跳转到哪个页面', items: Array.isArray(details.routeTargets) ? details.routeTargets : [] },
    { title: '加载 / 空状态 / 失败 / 权限等状态', items: Array.isArray(details.stateCoverage) ? details.stateCoverage : [] },
    { title: '前后端接口或数据依赖', items: Array.isArray(details.dataDependencies) ? details.dataDependencies : [] },
    { title: '验收点', items: Array.isArray(details.acceptanceCriteria) ? details.acceptanceCriteria : [] }
  ].map((section) => ({
    ...section,
    items: section.items.length ? section.items.slice(0, 6) : ['等待大模型补充该项说明。']
  }))
}

function pageLayoutArtifact(node = {}) {
  // The ASCII wireframe and handoff sections are rendered from this backend/model
  // artifact. Do not reconstruct page business layout in the frontend.
  return node?.pageLayoutArtifact && typeof node.pageLayoutArtifact === 'object'
    ? node.pageLayoutArtifact
    : {}
}

function hasPageLayoutArtifact(node = {}) {
  const artifact = pageLayoutArtifact(node)
  return Boolean(
    String(artifact.modelDecision || '').trim() ||
    String(artifact.asciiWireframe || '').trim() ||
    String(artifact.interactionDetails || '').trim()
  )
}

function isAdvancedUxInteractionPageNode(node = {}) {
  return node?.sourceArtifact?.type === 'advanced-ux-page-interaction-document' ||
    String(node?.pageLayoutArtifact?.version || '').includes('advanced-ux-page-interaction') ||
    String(node?.interactionSpecArtifact?.version || '').includes('advanced-ux-page-interaction')
}

function advancedUxPagePosition(node = {}) {
  const artifact = pageLayoutArtifact(node)
  const layout = artifact.layout && typeof artifact.layout === 'object' ? artifact.layout : {}
  return frameworkText(
    artifact.pagePosition ||
    artifact.positioning ||
    layout.responsibility ||
    node.summary ||
    pageFrameworkOverview(node)
  ) || '页面定位待模型补充。'
}

function advancedUxPageMetaRows(node = {}) {
  const meta = pageLayoutArtifact(node).pageMeta
  if (!meta || typeof meta !== 'object') return []
  return [
    ['对应步骤', meta.correspondingSteps],
    ['分析状态', meta.analyzed === true ? '已分析' : meta.analyzed === false ? '' : meta.analyzed],
    ['角色权限', meta.roleAccess],
    ['入口来源', meta.entrySource],
    ['数据来源', meta.dataSource],
    ['权限规则', meta.permissionRule],
    ['路由路径', meta.routePath]
  ].map(([label, value]) => ({
    label,
    value: frameworkText(value)
  })).filter((item) => item.value)
}

function advancedUxPageFrameworkRows(node = {}) {
  const artifact = pageLayoutArtifact(node)
  const layout = artifact.layout && typeof artifact.layout === 'object' ? artifact.layout : {}
  const rows = [
    ...(Array.isArray(artifact.layoutRegions) ? artifact.layoutRegions : []),
    ...(Array.isArray(artifact.regions) ? artifact.regions : []),
    ...(Array.isArray(layout.regions) ? layout.regions : [])
  ]
  const normalized = rows.map((row, index) => {
    const area = frameworkText(row?.['区域'] || row?.area || row?.region || row?.title || row?.name || row?.label)
    const content = frameworkText(row?.['内容'] || row?.content || row?.items || row?.children || row?.summary)
    const description = frameworkText(row?.['说明'] || row?.description || row?.note || row?.detail)
    const stateDescription = frameworkText(row?.stateDescription || row?.state_description || row?.['状态说明'])
    const componentReference = frameworkText(row?.componentReference || row?.component_reference || row?.['组件引用'])
    if (!area && !content && !description && !stateDescription && !componentReference) return null
    return {
      id: row?.id || `${index + 1}`,
      area,
      content,
      description,
      stateDescription,
      componentReference
    }
  }).filter(Boolean)
  return normalized.length ? normalized : [{
    id: 'empty',
    area: '暂无',
    content: '页面框架表格待模型补充',
    description: '',
    stateDescription: '',
    componentReference: ''
  }]
}

function advancedUxInteractionRuleRows(node = {}) {
  const rows = interactionSpecRows(node).map((row, index) => ({
    id: row.id || row.annotationId || `${index + 1}`,
    userAction: frameworkText(row.userAction || row.target || row.gesture),
    systemFeedback: frameworkText(row.systemFeedback || row.feedback || row.result),
    relatedStateOrModal: frameworkText(row.relatedStateOrModal || row.relatedState || row.relatedModal),
    remark: frameworkText(row.remark || row.notes || row.operation || row.statePromptCopy)
  })).filter((row) => row.userAction || row.systemFeedback || row.relatedStateOrModal || row.remark)
  return rows.length ? rows : [{
    id: 'empty',
    userAction: '暂无',
    systemFeedback: '交互规则表格待模型补充',
    relatedStateOrModal: '',
    remark: ''
  }]
}

function advancedUxExceptionStateRows(node = {}) {
  const rows = interactionSpecStateMatrix(node).map((row, index) => ({
    id: row.id || `${index + 1}`,
    state: frameworkText(row.state),
    display: frameworkText(row.display || row.promptCopy),
    handling: frameworkText(row.handling || row.recovery)
  })).filter((row) => row.state || row.display || row.handling)
  return rows.length ? rows : [{
    id: 'empty',
    state: '暂无',
    display: '异常状态表格待模型补充',
    handling: ''
  }]
}

function pageLowFiWireframeArtifact(node = {}) {
  const artifact = node?.lowFiWireframeArtifact || pageLayoutArtifact(node).lowFiWireframeArtifact || null
  return artifact && typeof artifact === 'object' ? artifact : {}
}

function pageLowFiWireframeImage(node = {}) {
  const artifact = pageLowFiWireframeArtifact(node)
  return String(artifact.imageDataUrl || artifact.imageUrl || '').trim()
}

function pageLowFiWireframeFileName(node = {}) {
  const artifact = pageLowFiWireframeArtifact(node)
  return String(artifact.fileName || artifact.pageName || pageFrameworkDocumentTitle(node) || '低保真线框图').trim()
}

function normalizePageLayoutEvidenceRef(ref = {}, index = 0) {
  if (typeof ref === 'string') {
    const value = ref.trim()
    return value ? { id: value, title: value, source: 'evidence', _index: index } : null
  }
  if (!ref || typeof ref !== 'object') return null
  const title = String(ref.title || ref.name || ref.source || ref.id || '').trim()
  const screenshotUrl = String(ref.screenshotUrl || ref.imageUrl || ref.previewUrl || '').trim()
  const pageUrl = String(ref.pageUrl || ref.url || ref.route || ref.path || '').trim()
  const summary = String(ref.summary || ref.description || ref.text || '').trim()
  if (!title && !screenshotUrl && !pageUrl && !summary) return null
  return {
    ...ref,
    id: String(ref.id || title || pageUrl || screenshotUrl || `evidence-${index}`).trim(),
    title: title || pageUrl || screenshotUrl || `证据 ${index + 1}`,
    source: String(ref.source || ref.type || '').trim(),
    summary,
    screenshotUrl,
    imageUrl: String(ref.imageUrl || ref.screenshotUrl || ref.previewUrl || '').trim(),
    pageUrl,
    _index: index
  }
}

function pageLayoutEvidenceRefs(node = {}) {
  const refs = Array.isArray(pageLayoutArtifact(node).evidenceRefs) ? pageLayoutArtifact(node).evidenceRefs : []
  const seen = new Set()
  return refs.map(normalizePageLayoutEvidenceRef).filter((ref) => {
    if (!ref) return false
    const key = pageLayoutEvidenceKey(ref)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function pageLayoutEvidenceKey(ref = {}) {
  return `${ref.id || ref.title || 'evidence'}-${ref.screenshotUrl || ref.imageUrl || ref.pageUrl || ref._index || 0}`
}

function pageLayoutEvidenceTitle(ref = {}) {
  return String(ref.title || ref.name || ref.id || '证据来源').trim()
}

function pageLayoutEvidenceSummary(ref = {}) {
  return String(ref.summary || '').trim()
}

function pageLayoutEvidenceImage(ref = {}) {
  return String(ref.screenshotUrl || ref.imageUrl || ref.previewUrl || '').trim()
}

function pageLayoutEvidenceUrl(ref = {}) {
  return String(ref.pageUrl || ref.url || ref.route || ref.path || '').trim()
}

function pageLayoutEvidenceKind(ref = {}) {
  const text = `${ref.source || ''} ${ref.type || ''} ${ref.title || ''}`.toLowerCase()
  if (pageLayoutEvidenceImage(ref) || /image|screenshot|截图|图片|prototype/.test(text)) return '图片'
  if (/package|source|源码|代码/.test(text)) return '代码'
  if (/knowledge|知识/.test(text)) return '知识库'
  if (/document|doc|文档/.test(text)) return '文档'
  return '证据'
}

function fullscreenPageDetailMode(node = {}) {
  if (!node?.id) return 'wireframe'
  const mode = fullscreenPageDetailModes.value[node.id] || 'wireframe'
  if (mode === 'interaction-spec' && !hasInteractionSpecArtifact(node)) return 'wireframe'
  return ['wireframe', 'lofi-prototype', 'interaction-spec'].includes(mode) ? mode : 'wireframe'
}

function setFullscreenPageDetailMode(node = {}, mode = 'wireframe') {
  if (!node?.id) return
  const nextMode = mode === 'interaction-spec' && !hasInteractionSpecArtifact(node)
    ? 'wireframe'
    : ['wireframe', 'lofi-prototype', 'interaction-spec'].includes(mode)
      ? mode
      : 'wireframe'
  fullscreenPageDetailModes.value = {
    ...fullscreenPageDetailModes.value,
    [node.id]: nextMode
  }
}

function pageFrameworkDocumentTitle(node = {}) {
  const artifact = pageLayoutArtifact(node)
  return String(artifact.pageName || artifact.title || node.title || '页面框架').trim()
}

function pageFrameworkDocumentNumber(node = {}) {
  const raw = String(node.indexLabel || node.stepLabel || node.stageOrder || node.order || '').trim()
  if (/^\d+(\.\d+)*$/.test(raw)) return raw
  const numeric = Number(node.index ?? node.order)
  if (Number.isFinite(numeric) && numeric >= 0) return `3.${numeric + 1}`
  return '3.x'
}

function pageFrameworkDocumentSubtitle(node = {}) {
  const artifact = pageLayoutArtifact(node)
  const parts = [
    artifact.pageType || artifact.layoutType || artifact.layout?.layoutType || artifact.screenContract?.layoutStrategy?.archetype,
    artifact.version
  ].map((item) => String(item || '').trim()).filter(Boolean)
  return parts.length ? parts.join(' · ') : '页面框架、路径、状态与跳转的结构化说明'
}

function pageFrameworkOverview(node = {}) {
  const artifact = pageLayoutArtifact(node)
  const architecture = pageArchitecture(node)
  const overview = [
    artifact.overview,
    artifact.summary,
    artifact.description,
    artifact.modelDecision,
    architecture?.goal,
    node.summary
  ].map((item) => String(item || '').trim()).find(Boolean)
  if (overview) return overview.replace(/\s+/g, ' ')
  const layoutType = String(artifact.layoutType || artifact.layout?.layoutType || artifact.screenContract?.layoutStrategy?.archetype || '').trim()
  return layoutType
    ? `围绕「${pageFrameworkDocumentTitle(node)}」组织 ${layoutType}，支撑当前页面的主要浏览、判断和操作任务。`
    : `围绕「${pageFrameworkDocumentTitle(node)}」梳理页面入口、内容层级、关键操作、状态反馈和跳转结果。`
}

function frameworkText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function frameworkValueText(value = {}) {
  if (typeof value === 'string') return frameworkText(value)
  if (!value || typeof value !== 'object') return ''
  const lead = frameworkText(value.title || value.name || value.label || value.region || value.id || value.state || value.target || value.from)
  const detail = frameworkText(
    value.summary ||
    value.description ||
    value.note ||
    value.detail ||
    value.content ||
    value.layout ||
    value.type ||
    value.trigger ||
    value.feedback ||
    value.result ||
    value.to ||
    ''
  )
  if (lead && detail && lead !== detail) return `${lead}：${detail}`
  return lead || detail
}

function frameworkList(values = [], limit = 8) {
  const source = Array.isArray(values) ? values : [values]
  const seen = new Set()
  return source
    .flatMap((value) => {
      if (Array.isArray(value)) return value
      return [value]
    })
    .map((value) => frameworkValueText(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
    .slice(0, limit)
}

function normalizeFrameworkDocumentSection(section = {}, index = 0) {
  if (!section || typeof section !== 'object') return null
  const title = frameworkText(section.title || section.name || section.label || section.heading)
  const body = frameworkList([
    ...(Array.isArray(section.body) ? section.body : []),
    ...(Array.isArray(section.items) ? section.items : []),
    ...(Array.isArray(section.steps) ? section.steps : []),
    section.summary,
    section.description,
    section.note
  ], 10)
  const code = String(section.code || section.diagram || section.tree || section.asciiWireframe || '').trim()
  if (!title && !body.length && !code) return null
  return {
    key: String(section.key || section.id || `section-${index + 1}`).trim(),
    number: String(section.number || `3.x.${index + 1}`).trim(),
    title: title || `框架章节 ${index + 1}`,
    tone: String(section.tone || section.kind || '').trim() || frameworkSectionTone(index),
    body,
    code
  }
}

function frameworkSectionTone(index = 0) {
  return ['primary', 'structure', 'journey', 'state', 'relation'][index % 5]
}

function pageFrameworkDocumentSections(node = {}) {
  const artifact = pageLayoutArtifact(node)
  const architecture = pageArchitecture(node)
  const details = interactionDetails(node)
  const asciiWireframe = String(artifact.asciiWireframe || '').trim()
  const explicitSections = [
    ...(Array.isArray(artifact.frameworkSections) ? artifact.frameworkSections : []),
    ...(Array.isArray(artifact.documentSections) ? artifact.documentSections : []),
    ...(Array.isArray(artifact.pageFrameworkSections) ? artifact.pageFrameworkSections : [])
  ].map((section, index) => normalizeFrameworkDocumentSection(section, index)).filter(Boolean)
  if (explicitSections.length) return explicitSections

  const artifactLayout = artifact.layout && typeof artifact.layout === 'object' ? artifact.layout : {}
  const regions = [
    ...(Array.isArray(artifact.layoutRegions) ? artifact.layoutRegions : []),
    ...(Array.isArray(artifact.regions) ? artifact.regions : []),
    ...(Array.isArray(artifact.prototypeSections) ? artifact.prototypeSections : []),
    ...(Array.isArray(artifactLayout.regions) ? artifactLayout.regions : []),
    ...(Array.isArray(architecture?.sections) ? architecture.sections : [])
  ]
  const actions = frameworkList([
    ...(Array.isArray(details?.clickActions) ? details.clickActions : []),
    ...(Array.isArray(artifact.interactions) ? artifact.interactions : []),
    ...(Array.isArray(artifactLayout.interactions) ? artifactLayout.interactions : [])
  ], 8)
  const states = frameworkList([
    ...(Array.isArray(architecture?.states) ? architecture.states : []),
    ...(Array.isArray(details?.stateCoverage) ? details.stateCoverage : []),
    ...(Array.isArray(artifact.states) ? artifact.states : []),
    ...(Array.isArray(artifactLayout.states) ? artifactLayout.states : []),
    ...interactionSpecStateMatrix(node).map((row) => `${row.state}${row.promptCopy ? `：${row.promptCopy}` : ''}`)
  ], 8)
  const routes = frameworkList([
    ...(Array.isArray(details?.routeTargets) ? details.routeTargets : []),
    ...(Array.isArray(artifact.routeTargets) ? artifact.routeTargets : []),
    ...(Array.isArray(artifact.transitions) ? artifact.transitions : []),
    ...interactionSpecFlowPreview(node).map((row) => `${row.from} → ${row.to}${row.trigger ? `（${row.trigger}）` : ''}`)
  ], 8)
  const dataItems = frameworkList([
    ...(Array.isArray(details?.dataDependencies) ? details.dataDependencies : []),
    ...(Array.isArray(artifact.dataDependencies) ? artifact.dataDependencies : []),
    ...(Array.isArray(artifactLayout.dataDependencies) ? artifactLayout.dataDependencies : [])
  ], 6)

  const sections = [
    normalizeFrameworkDocumentSection({
      number: `${pageFrameworkDocumentNumber(node)}.1`,
      title: '主路径',
      tone: 'primary',
      body: actions.length ? actions : ['进入页面后完成核心浏览、判断、操作与反馈闭环。']
    }, 0),
    normalizeFrameworkDocumentSection({
      number: `${pageFrameworkDocumentNumber(node)}.2`,
      title: '页面框架',
      tone: 'structure',
      body: frameworkList([
        artifact.layoutType || artifactLayout.layoutType || artifactLayout.shell || artifact.screenContract?.layoutStrategy?.archetype,
        ...(Array.isArray(artifact.topFixed) ? artifact.topFixed : []),
        ...(Array.isArray(artifact.scrollModules) ? artifact.scrollModules : []),
        ...(Array.isArray(artifact.bottomFixed) ? artifact.bottomFixed : [])
      ], 8),
      code: asciiWireframe
    }, 1),
    normalizeFrameworkDocumentSection({
      number: `${pageFrameworkDocumentNumber(node)}.3`,
      title: '关键区域',
      tone: 'journey',
      body: frameworkList(regions, 10)
    }, 2),
    normalizeFrameworkDocumentSection({
      number: `${pageFrameworkDocumentNumber(node)}.4`,
      title: '状态与异常',
      tone: 'state',
      body: states.length ? states : ['加载、空态、失败、权限、禁用、成功等状态由模型在页面级 artifact 中补充。']
    }, 3),
    normalizeFrameworkDocumentSection({
      number: `${pageFrameworkDocumentNumber(node)}.5`,
      title: '跳转与数据依赖',
      tone: 'relation',
      body: [
        ...routes.map((item) => `跳转：${item}`),
        ...dataItems.map((item) => `数据：${item}`)
      ]
    }, 4)
  ].filter(Boolean)

  return sections.length ? sections : [
    normalizeFrameworkDocumentSection({
      number: `${pageFrameworkDocumentNumber(node)}.1`,
      title: '页面框架',
      tone: 'structure',
      body: ['当前页面框架信息待模型补充。'],
      code: asciiWireframe
    }, 0)
  ].filter(Boolean)
}

function normalizePrototypeItem(item, index = 0, fallbackKind = 'control') {
  if (typeof item === 'string') {
    const label = item.trim()
    if (!label) return null
    return {
      key: `item-${index + 1}`,
      label,
      meta: '',
      kind: /图|图片|封面|banner|image|media/i.test(label) ? 'media' : fallbackKind
    }
  }
  if (!item || typeof item !== 'object') return null
  const label = String(item.label || item.title || item.name || item.text || item.content || item.id || '').trim()
  const meta = String(item.meta || item.summary || item.description || item.note || item.type || '').trim()
  if (!label && !meta) return null
  const text = `${label} ${meta}`
  return {
    key: String(item.key || item.id || `item-${index + 1}`).trim(),
    label: label || meta,
    meta: label ? meta : '',
    kind: String(item.kind || item.role || '').trim() ||
      (/图|图片|封面|banner|image|media/i.test(text) ? 'media' : /按钮|button|提交|保存|搜索|筛选|tab/i.test(text) ? 'action' : fallbackKind)
  }
}

function normalizePrototypeSection(section = {}, index = 0) {
  if (!section || typeof section !== 'object') return null
  const title = String(section.title || section.name || section.label || section.region || section.id || '').trim()
  const rawItems = Array.isArray(section.items)
    ? section.items
    : Array.isArray(section.children)
      ? section.children
      : Array.isArray(section.controls)
        ? section.controls
        : []
  const items = rawItems.map((item, itemIndex) => normalizePrototypeItem(item, itemIndex)).filter(Boolean)
  const summary = String(section.summary || section.description || section.note || '').trim()
  if (summary && !items.length) items.push(normalizePrototypeItem(summary, 0, 'text'))
  if (!title && !items.length) return null
  const kind = String(section.kind || section.type || '').trim() ||
    (/导航|header|nav|tab|顶部/.test(title) ? 'navigation' : /底部|footer|bar/.test(title) ? 'footer' : /弹窗|popup|modal|抽屉/.test(title) ? 'overlay' : /banner|hero|封面/.test(title) ? 'hero' : 'content')
  return {
    key: String(section.key || section.id || `section-${index + 1}`).trim(),
    title: title || `原型区块 ${index + 1}`,
    kind,
    kindLabel: prototypeSectionKindLabel(kind),
    weight: String(section.weight || '').trim() || (items.length >= 5 ? 'dense' : ''),
    items: items.length ? items : [normalizePrototypeItem('区块内容待模型补充', 0, 'text')]
  }
}

function prototypeSectionKindLabel(kind = '') {
  if (/navigation/.test(kind)) return '导航'
  if (/footer/.test(kind)) return '底部'
  if (/overlay/.test(kind)) return '浮层'
  if (/hero/.test(kind)) return '主视觉'
  return '内容'
}

function pageLofiPrototypeSections(node = {}) {
  const artifact = pageLayoutArtifact(node)
  const explicitSections = [
    ...(Array.isArray(artifact.prototypeSections) ? artifact.prototypeSections : []),
    ...(Array.isArray(artifact.layoutRegions) ? artifact.layoutRegions : []),
    ...(Array.isArray(artifact.regions) ? artifact.regions : [])
  ].map((section, index) => normalizePrototypeSection(section, index)).filter(Boolean)
  if (explicitSections.length) return explicitSections

  const asciiWireframe = String(artifact.asciiWireframe || '').trim()
  const lines = asciiWireframe.split('\n')
    .map((line) => line.replace(/[│|┌┐└┘├┤┬┴┼─━═╭╮╰╯]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^#+\s*/.test(line))
  const meaningfulLines = lines
    .filter((line) => !/^\d+$/.test(line))
    .slice(0, 24)

  const sections = []
  const pushSection = (title, kind, items) => {
    const normalized = normalizePrototypeSection({ title, kind, items }, sections.length)
    if (normalized) sections.push(normalized)
  }

  const navLines = meaningfulLines.filter((line) => /导航|顶部|搜索|tab|菜单|分类|返回|筛选|入口/.test(line)).slice(0, 6)
  const mediaLines = meaningfulLines.filter((line) => /图|图片|封面|banner|卡片|列表|商品|内容|表单|输入|按钮/.test(line)).slice(0, 12)
  const footerLines = meaningfulLines.filter((line) => /底部|footer|固定|悬浮|提交|结算|保存|下一步/.test(line)).slice(0, 6)
  pushSection('顶部与入口', 'navigation', navLines.length ? navLines : ['页面标题 / 返回 / 主入口'])
  pushSection('主体内容区', 'content', mediaLines.length ? mediaLines : meaningfulLines.slice(0, 8))
  if (footerLines.length) pushSection('固定与底部操作', 'footer', footerLines)
  if (!sections.length) pushSection(artifact.title || node.title || '页面原型', 'content', ['页面结构待模型补充'])
  return sections
}

function pageLofiPrototypeTone(node = {}) {
  const text = `${node?.title || ''} ${pageLayoutArtifact(node).layoutType || ''} ${pageLayoutArtifact(node).pageType || ''}`.toLowerCase()
  if (/mobile|app|小程序|h5/.test(text)) return 'mobile'
  if (/dashboard|admin|后台|控制台/.test(text)) return 'dashboard'
  return 'web'
}

function interactionSpecArtifact(node = {}) {
  if (node?.interactionSpecArtifact && typeof node.interactionSpecArtifact === 'object') {
    return node.interactionSpecArtifact
  }
  return legacyInteractionSpecArtifact(node)
}

function legacyInteractionSpecArtifact(node = {}) {
  const details = interactionDetails(node)
  const actions = Array.isArray(details?.clickActions) && details.clickActions.length
    ? details.clickActions
    : interactionSpecItems(node)
  const architecture = pageArchitecture(node) || {}
  const sections = Array.isArray(architecture.sections) ? architecture.sections : []
  const routes = Array.isArray(details?.routeTargets) ? details.routeTargets : []
  const states = Array.isArray(details?.stateCoverage) ? details.stateCoverage : []
  const checks = Array.isArray(details?.acceptanceCriteria) ? details.acceptanceCriteria : []
  const rows = actions
    .map((action, index) => {
      const text = String(action || '').trim()
      if (!text) return null
      const field = interactionSpecFieldName(text)
      return {
        id: `legacy-${index + 1}`,
        annotationId: `legacy-${index + 1}`,
        target: sections[index] || (/^[^：:]{1,28}[：:]/.test(text) ? field : ''),
        gesture: /滑|拖/.test(text) ? '滑动/拖拽' : /长按/.test(text) ? '长按' : '单击',
        enableCondition: '页面数据加载完成，控件处于可操作状态。',
        disableCondition: '加载中、权限不足或必填条件缺失时禁用。',
        displayCondition: '当前页面需要该模块支撑主任务时显示。',
        hideCondition: '无数据、无权限或业务开关关闭时隐藏。',
        operation: '触发后给出即时 pressed/loading 反馈。',
        feedback: text.replace(/^[^：:]{1,28}[：:]\s*/, '').trim() || text,
        statePromptCopy: states[0] || '操作已提交，请稍候',
        result: routes[index] || routes[0] || '',
        motion: '基础反馈 120ms 内完成，复杂动效由模型补充 demo、时长和缓动。',
        states,
        testPoints: checks
      }
    })
    .filter((row) => row && (row.target || row.feedback || row.result))
  if (!rows.length) return {}
  return {
    version: 'page-interaction-spec/legacy-normalized',
    pageName: node.title || '',
    snapshotRef: 'pageLayoutArtifact.asciiWireframe',
    interactionRows: rows,
    stateMatrix: states.map((state, index) => ({
      state,
      trigger: index === 0 ? '进入页面或刷新数据' : '当前页面数据/权限/网络变化',
      display: state,
      promptCopy: state,
      recovery: /失败|错误|异常/.test(state) ? '展示重试入口或返回路径。' : '状态变化后保持页面主任务可继续。'
    })),
    gestureNotes: [
      '下拉手势 → 触发接口刷新页面数据',
      '内容区域纵向滚动 → 顶部/底部固定区不跟随滚动'
    ]
  }
}

function normalizeInteractionSpecRow(row = {}) {
  if (!row || typeof row !== 'object') return null
  const states = Array.isArray(row.states) ? row.states.map((item) => String(item || '').trim()).filter(Boolean) : []
  const testPoints = Array.isArray(row.testPoints) ? row.testPoints.map((item) => String(item || '').trim()).filter(Boolean) : []
  return {
    id: String(row.id || row.annotationId || row.target || '').trim(),
    annotationId: String(row.annotationId || '').trim(),
    target: String(row.target || '').trim(),
    gesture: String(row.gesture || '').trim(),
    condition: String(row.condition || '').trim(),
    enableCondition: String(row.enableCondition || row.enabledCondition || row.condition || '').trim(),
    disableCondition: String(row.disableCondition || row.disabledCondition || '').trim(),
    displayCondition: String(row.displayCondition || row.visibleCondition || '').trim(),
    hideCondition: String(row.hideCondition || row.hiddenCondition || '').trim(),
    operation: String(row.operation || row.operationEffect || '').trim(),
    feedback: String(row.feedback || '').trim(),
    statePromptCopy: String(row.statePromptCopy || row.promptCopy || row.toastCopy || row.messageCopy || '').trim(),
    result: String(row.result || '').trim(),
    userAction: String(row.userAction || '').trim(),
    systemFeedback: String(row.systemFeedback || '').trim(),
    remark: String(row.remark || '').trim(),
    notes: String(row.notes || '').trim(),
    relatedStateOrModal: String(row.relatedStateOrModal || row.relatedState || row.relatedModal || '').trim(),
    motion: String(row.motion || row.animation || row.motionNote || '').trim(),
    states,
    testPoints
  }
}

function interactionSpecRows(node = {}) {
  const rows = interactionSpecArtifact(node).interactionRows
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeInteractionSpecRow(row))
    .filter((row) => row && (row.target || row.feedback || row.result))
}

function normalizeInteractionStateRow(row = {}) {
  if (!row || typeof row !== 'object') return null
  return {
    id: String(row.id || '').trim(),
    state: String(row.state || row.name || '').trim(),
    trigger: String(row.trigger || '').trim(),
    display: String(row.display || row.ui || '').trim(),
    promptCopy: String(row.promptCopy || row.copy || row.message || '').trim(),
    recovery: String(row.recovery || row.recover || '').trim(),
    handling: String(row.handling || row.recovery || row.recover || '').trim()
  }
}

function interactionSpecStateMatrix(node = {}) {
  const matrix = interactionSpecArtifact(node).stateMatrix
  return (Array.isArray(matrix) ? matrix : [])
    .map((row) => normalizeInteractionStateRow(row))
    .filter((row) => row && (row.state || row.promptCopy || row.recovery))
}

function interactionSpecGestureNotes(node = {}) {
  const notes = interactionSpecArtifact(node).gestureNotes || interactionSpecArtifact(node).gestureRules
  return (Array.isArray(notes) ? notes : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function normalizeInteractionTransition(row = {}, index = 0) {
  if (!row || typeof row !== 'object') return null
  const from = String(row.from || row.source || row.currentState || row.state || '').trim()
  const trigger = String(row.trigger || row.event || row.action || row.gesture || '').trim()
  const to = String(row.to || row.target || row.nextState || row.resultState || '').trim()
  const result = String(row.result || row.feedback || row.note || row.recovery || '').trim()
  if (!from && !trigger && !to && !result) return null
  return {
    key: String(row.id || `transition-${index + 1}`).trim(),
    from: from || '当前状态',
    trigger: trigger || '触发动作',
    to: to || '下一状态',
    result: result || '完成反馈或进入后续页面'
  }
}

function interactionSpecFlowPreview(node = {}) {
  const artifact = interactionSpecArtifact(node)
  const explicitTransitions = [
    ...(Array.isArray(artifact.transitions) ? artifact.transitions : []),
    ...(Array.isArray(artifact.flowPreview) ? artifact.flowPreview : []),
    ...(Array.isArray(artifact.stateTransitions) ? artifact.stateTransitions : [])
  ].map((row, index) => normalizeInteractionTransition(row, index)).filter(Boolean)
  if (explicitTransitions.length) return explicitTransitions.slice(0, 8)

  const stateRows = interactionSpecStateMatrix(node)
  if (stateRows.length >= 2) {
    return stateRows.slice(0, 8).map((state, index, rows) => {
      const next = rows[index + 1] || rows[index]
      return {
        key: `state-flow-${index + 1}`,
        from: state.state || '当前状态',
        trigger: state.trigger || (index === 0 ? '进入页面' : '状态变化'),
        to: next?.state || state.state || '下一状态',
        result: state.recovery || state.display || state.promptCopy || '保持可恢复的页面反馈'
      }
    })
  }

  return interactionSpecRows(node).slice(0, 8).map((row, index) => ({
    key: row.id || row.annotationId || `row-flow-${index + 1}`,
    from: row.target || '交互对象',
    trigger: row.gesture || row.operation || '用户动作',
    to: row.result || row.statePromptCopy || '结果态',
    result: row.feedback || row.motion || '系统反馈'
  }))
}

function hasInteractionSpecArtifact(node = {}) {
  return interactionSpecRows(node).length > 0
}

function pageLayoutHandoff(node = {}, side = 'frontend') {
  const artifact = pageLayoutArtifact(node)
  const key = side === 'backend' ? 'backendHandoff' : 'frontendHandoff'
  return (Array.isArray(artifact[key]) ? artifact[key] : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function screenContractRows(node = {}) {
  const contract = pageLayoutArtifact(node).screenContract
  if (!contract || typeof contract !== 'object') return []
  const purpose = contract.screenPurpose || {}
  const invariants = contract.designInvariants || {}
  const layout = contract.layoutStrategy || {}
  const freedom = contract.freedomBudget || {}
  const rubric = contract.evaluationRubric || {}
  const rows = [
    {
      label: '页面任务',
      items: [purpose.primaryJob, purpose.businessGoal].filter(Boolean)
    },
    {
      label: '布局策略',
      items: [layout.archetype, layout.density, layout.navigationModel].filter(Boolean)
    },
    {
      label: '必须保留',
      items: [
        ...(Array.isArray(invariants.mustSee) ? invariants.mustSee : []),
        ...(Array.isArray(invariants.mustDo) ? invariants.mustDo : [])
      ].slice(0, 8)
    },
    {
      label: '不可变关系',
      items: (Array.isArray(invariants.mustKeepRelations) ? invariants.mustKeepRelations : []).slice(0, 5)
    },
    {
      label: '可自由发挥',
      items: (Array.isArray(freedom.imageModelCanChange) ? freedom.imageModelCanChange : []).slice(0, 5)
    },
    {
      label: '失败判定',
      items: (Array.isArray(rubric.fail) ? rubric.fail : []).slice(0, 4)
    }
  ]
  return rows
    .map((row) => ({
      ...row,
      items: row.items.map((item) => String(item || '').trim()).filter(Boolean)
    }))
    .filter((row) => row.items.length)
}

function visualPreview(node = {}) {
  // ui-visual cards show generation state from node.visualPreview/artifact.
  // Missing images stay as "待生成/待配置" instead of frontend mock images.
  return node.visualPreview && typeof node.visualPreview === 'object'
    ? node.visualPreview
    : { imagePrompt: '等待生成页面高保真视觉图。', figmaReady: false, componentNotes: [] }
}

function visualPreviewImage(node = {}) {
  const preview = visualPreview(node)
  return String(preview.imageDataUrl || preview.imageUrl || node.artifact?.imageDataUrl || node.artifact?.imageUrl || '').trim()
}

function visualTargetLogicalWidth(node = {}) {
  const preview = visualPreview(node)
  const targetImageSize = preview.targetImageSize && typeof preview.targetImageSize === 'object'
    ? preview.targetImageSize
    : node.artifact?.targetImageSize && typeof node.artifact?.targetImageSize === 'object'
      ? node.artifact.targetImageSize
      : null
  const width = Number(targetImageSize?.width)
  if (Number.isFinite(width) && width > 0) return Math.round(width)
  const text = [
    node.title,
    node.summary,
    preview.imagePrompt,
    node.visualBrief?.pageTitle,
    node.visualBrief?.goal
  ].map((item) => String(item || '')).join(' ')
  if (/web|网页|后台|管理端|PC|桌面|dashboard|admin/i.test(text) && !/小程序|移动端|手机|app|mobile/i.test(text)) return 1920
  return 375
}

function visualCanvasSurfaceClass(node = {}) {
  return visualTargetLogicalWidth(node) >= 1440 ? 'visual-surface-web' : 'visual-surface-app'
}

function greatestCommonDivisor(first = 0, second = 0) {
  let a = Math.abs(Math.round(Number(first) || 0))
  let b = Math.abs(Math.round(Number(second) || 0))
  while (b) {
    const next = a % b
    a = b
    b = next
  }
  return a || 1
}

function normalizedAspectRatioLabel(width = 0, height = 0) {
  const numericWidth = Math.round(Number(width) || 0)
  const numericHeight = Math.round(Number(height) || 0)
  if (!numericWidth || !numericHeight) return ''
  const divisor = greatestCommonDivisor(numericWidth, numericHeight)
  return `${numericWidth / divisor}:${numericHeight / divisor}`
}

function visualImageRatioKey(node = {}) {
  const src = visualPreviewImage(node)
  return `${node.id || node.title || 'visual'}::${src}`
}

function visualImageNaturalRatioLabel(node = {}) {
  return visualImageNaturalRatios.value[visualImageRatioKey(node)] || ''
}

function recordVisualImageNaturalRatio(node = {}, event) {
  const image = event?.target
  const naturalWidth = image?.naturalWidth || 0
  const naturalHeight = image?.naturalHeight || 0
  const ratio = normalizedAspectRatioLabel(naturalWidth, naturalHeight)
  if (!ratio) return
  visualImageNaturalRatios.value = {
    ...visualImageNaturalRatios.value,
    [visualImageRatioKey(node)]: ratio
  }
}

function visualImageAspectRatioLabel(node = {}) {
  const naturalRatio = visualImageNaturalRatioLabel(node)
  if (naturalRatio) return naturalRatio
  const preview = visualPreview(node)
  const brief = node.visualBrief && typeof node.visualBrief === 'object' ? node.visualBrief : {}
  const artifact = node.artifact && typeof node.artifact === 'object' ? node.artifact : {}
  const candidates = [
    preview.aspectRatio,
    preview.targetAspectRatio,
    preview.screenRatio,
    brief.aspectRatio,
    brief.targetAspectRatio,
    artifact.aspectRatio,
    artifact.targetAspectRatio,
    artifact.screenRatio
  ]
  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue
    const normalized = value.replace(/\s+/g, '').replace(/[：:xX]/g, ':')
    if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized)) return normalized
  }
  return ''
}

function visualImageFileName(node = {}) {
  const title = String(node.title || visualBrief(node).pageTitle || 'visual-image')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'visual-image'
  return `${title}.png`
}

async function downloadVisualImage(node = {}) {
  const src = visualPreviewImage(node)
  if (!src || typeof document === 'undefined') return
  const link = document.createElement('a')
  link.download = visualImageFileName(node)
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

function openVisualImagePreview(node = {}) {
  const src = visualPreviewImage(node)
  if (!src) return
  visualImagePreview.value = {
    src,
    title: `${node.title || visualBrief(node).pageTitle || '高保真图'} 预览`
  }
}

function closeVisualImagePreview() {
  visualImagePreview.value = null
}

function visualPreviewNeedsConfiguration(node = {}) {
  return visualPreview(node).imageStatus === 'configuration-required' || node.artifact?.imageStatus === 'configuration-required'
}

function visualPreviewGenerationFailed(node = {}) {
  return visualPreview(node).imageStatus === 'failed' || node.artifact?.imageStatus === 'failed' || node.artifactStatus === 'failed'
}

function visualCanvasPlaceholderDescription(node = {}, status = 'pending') {
  const title = String(node.title || visualBrief(node).pageTitle || '当前页面').replace(/\s*UI视觉\s*$/i, '').trim() || '当前页面'
  if (status === 'generating') {
    return `正在为「${title}」生成高保真图，完成后会回填到画布。`
  }
  return `已继承上一阶段交互低保与页面骨架，等待生成「${title}」高保真图。`
}

function visualBrief(node = {}) {
  if (node.visualBrief && typeof node.visualBrief === 'object') return node.visualBrief
  const preview = visualPreview(node)
  return {
    pageTitle: node.title || '当前页面',
    goal: node.summary || '等待大模型补充视觉目标。',
    layoutFocus: ['等待补充页面布局重点。'],
    componentChecklist: Array.isArray(preview.componentNotes) && preview.componentNotes.length
      ? preview.componentNotes
      : ['等待补充组件清单。'],
    stateShots: ['默认态', '加载态', '空状态', '失败态'],
    imagePrompt: preview.imagePrompt || '等待生成页面高保真视觉图。',
    figmaHandoff: {
      ready: Boolean(preview.figmaReady),
      notes: preview.figmaReady ? ['后续可接 Figma 页面生成与编辑。'] : ['等待视觉信息补齐。']
    }
  }
}

function visualBriefSections(node = {}) {
  const brief = visualBrief(node)
  const figmaNotes = Array.isArray(brief.figmaHandoff?.notes) ? brief.figmaHandoff.notes : []
  return [
    { title: '视觉目标', items: [brief.goal].filter(Boolean) },
    { title: '布局重点', items: Array.isArray(brief.layoutFocus) ? brief.layoutFocus : [] },
    { title: '组件清单', items: Array.isArray(brief.componentChecklist) ? brief.componentChecklist : [] },
    { title: '状态画面', items: Array.isArray(brief.stateShots) ? brief.stateShots : [] },
    { title: 'Figma 交接', items: figmaNotes }
  ].map((section) => ({
    ...section,
    items: section.items.length ? section.items.slice(0, 8) : ['等待大模型补充该项说明。']
  }))
}

function visualStagePages(node = {}) {
  const stageId = node.stageId || activeStageId.value || 'ui-visual'
  const stageNodes = props.totalFlow?.stageCanvases?.[stageId]?.nodes
  const nodes = Array.isArray(stageNodes) && stageNodes.length
    ? stageNodes
    : stageCanvasNodes.value
  return nodes
    .filter((item) => isVisualGalleryDetail(item))
    .map((item) => ({
      ...item,
      width: item.width || 320,
      height: item.height || 220
    }))
}

function codePreview(node = {}) {
  return node.codePreview && typeof node.codePreview === 'object'
    ? node.codePreview
    : { previewTitle: '运行预览', previewSummary: '等待生成可预览代码。', codeLanguage: 'text', code: '' }
}

function codePreviewFiles(node = {}) {
  const preview = codePreview(node)
  const artifactFiles = Array.isArray(node.artifact?.files) ? node.artifact.files : []
  const previewFiles = Array.isArray(preview.files) ? preview.files : []
  const files = artifactFiles.length
    ? artifactFiles
    : previewFiles.map((file) => ({
        ...file,
        content: file.content || (file.path === preview.filePath ? preview.code : '')
      }))
  if (files.length) {
    return files
      .filter((file) => file?.path)
      .map((file) => ({
        path: String(file.path || '').trim(),
        language: file.language || preview.codeLanguage || 'text',
        content: String(file.content || '')
      }))
  }
  return [{
    path: preview.filePath || preview.codeLanguage || '代码',
    language: preview.codeLanguage || 'text',
    content: String(preview.code || '')
  }]
}

function selectedCodePreviewFile(node = {}) {
  const files = codePreviewFiles(node)
  const selectedPath = selectedCodePreviewFiles.value[node.id] || codePreview(node).filePath || files[0]?.path || ''
  return files.find((file) => file.path === selectedPath) || files[0] || { path: '', language: 'text', content: '' }
}

function selectedCodePreviewCode(node = {}) {
  return selectedCodePreviewFile(node).content || codePreview(node).code || ''
}

function fullscreenCodeDetailTab(node = {}) {
  return fullscreenCodeDetailTabs.value[node.id] || 'render'
}

function setFullscreenCodeDetailTab(node = {}, tab = 'render') {
  if (!node.id) return
  fullscreenCodeDetailTabs.value = {
    ...fullscreenCodeDetailTabs.value,
    [node.id]: tab === 'source' ? 'source' : 'render'
  }
}

function previewCodeFrameWidth(node = {}) {
  const width = Number(previewCodeFrameWidths.value[node.id])
  return [390, 768, 1440].includes(width) ? width : 1440
}

function setPreviewCodeFrameWidth(node = {}, width = 1440) {
  if (!node.id) return
  const nextWidth = [390, 768, 1440].includes(Number(width)) ? Number(width) : 1440
  previewCodeFrameWidths.value = {
    ...previewCodeFrameWidths.value,
    [node.id]: nextWidth
  }
}

function compactCodePreview(node = {}) {
  const code = selectedCodePreviewCode(node).trim() || codePreview(node).previewSummary || '等待生成 HTML。'
  return code.length > 720 ? `${code.slice(0, 720).trim()}\n...` : code
}

function canvasCodePreviewSource(node = {}) {
  const code = selectedCodePreviewCode(node)
  return code.trim() ? code : ''
}

function codePreviewSourceTitle(node = {}) {
  const language = String(selectedCodePreviewFile(node).language || codePreview(node).codeLanguage || '').toLowerCase()
  if (language === 'html' || node.stageId === 'html-output') return 'HTML'
  if (language === 'vue' || node.stageId === 'vue-output') return 'Vue'
  return '代码'
}

function codePreviewLanguageLabel(node = {}) {
  const language = String(selectedCodePreviewFile(node).language || codePreview(node).codeLanguage || '').trim().toLowerCase()
  if (language) return language
  const path = String(selectedCodePreviewFile(node).path || '').trim()
  const extension = path.includes('.') ? path.split('.').pop() : ''
  return extension || 'code'
}

function codePreviewFileName(node = {}) {
  const selected = selectedCodePreviewFile(node)
  const rawPath = String(selected.path || codePreview(node).filePath || '').trim()
  const fallbackExt = codePreviewLanguageLabel(node) === 'html' ? 'html' : 'txt'
  const fallbackName = `${node.title || 'code-preview'}.${fallbackExt}`
  return (rawPath.split('/').pop() || fallbackName)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 100) || fallbackName
}

function showCodeCopyToast() {
  codeCopyToastVisible.value = false
  if (codeCopyToastTimer && typeof window !== 'undefined') window.clearTimeout(codeCopyToastTimer)
  nextTick(() => {
    codeCopyToastVisible.value = true
    if (typeof window !== 'undefined') {
      codeCopyToastTimer = window.setTimeout(() => {
        codeCopyToastVisible.value = false
        codeCopyToastTimer = null
      }, 1400)
    }
  })
}

async function copyCodePreview(node = {}) {
  const code = selectedCodePreviewCode(node).trim() || compactCodePreview(node)
  if (!code) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(code)
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.setAttribute('readonly', 'readonly')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    showCodeCopyToast()
  } catch {
    showCodeCopyToast()
  }
}

function downloadCodePreview(node = {}) {
  const code = selectedCodePreviewCode(node).trim() || compactCodePreview(node)
  if (!code || typeof document === 'undefined') return
  const blob = new Blob([code], { type: codePreviewLanguageLabel(node) === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = codePreviewFileName(node)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 30000)
}

function previewCodeSummary(node = {}) {
  const files = codePreviewFiles(node)
  const selectedFile = selectedCodePreviewFile(node)
  const hasPreview = Boolean(previewCodeSrcdoc(node))
  const plan = engineeringPlan(node)
  return {
    fileCount: files.length,
    currentFile: selectedFile.path || '等待生成',
    status: artifactStatusLabel(node),
    previewSource: hasPreview ? (node.artifact?.html ? '生成产物' : '当前代码') : '等待生成',
    description: plan.previewTarget === 'vue' || node.stageId === 'vue-output'
      ? '左侧展示 Vue 运行效果，右侧查看组件、路由、状态和接口代码。'
      : '左侧展示 HTML 运行效果，右侧查看 HTML/CSS/JS 源码。'
  }
}

function engineeringPlan(node = {}) {
  if (node.engineeringPlan && typeof node.engineeringPlan === 'object') return node.engineeringPlan
  const isVue = node.stageId === 'vue-output' || codePreview(node).codeLanguage === 'vue'
  return {
    previewTarget: isVue ? 'vue' : 'html',
    inputArtifacts: ['交互低保', 'UI视觉', '验收点'],
    outputFiles: codePreviewFiles(node).map((file) => file.path).filter(Boolean),
    runtimeStates: ['默认态', '加载态', '空状态', '失败态'],
    dataContracts: isVue ? ['路由参数', '接口请求', '接口返回'] : ['本地状态', 'Mock 数据'],
    acceptanceCriteria: ['预览可运行', '代码已展示', '主路径可点击']
  }
}

function engineeringPlanSections(node = {}) {
  const plan = engineeringPlan(node)
  return [
    { title: '输入产物', items: Array.isArray(plan.inputArtifacts) ? plan.inputArtifacts : [] },
    { title: '输出文件', items: Array.isArray(plan.outputFiles) ? plan.outputFiles : [] },
    { title: '运行状态', items: Array.isArray(plan.runtimeStates) ? plan.runtimeStates : [] },
    { title: '数据契约', items: Array.isArray(plan.dataContracts) ? plan.dataContracts : [] },
    { title: '验收点', items: Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : [] }
  ].map((section) => ({
    ...section,
    items: section.items.length ? section.items.slice(0, 8) : ['等待大模型补充该项说明。']
  }))
}

function previewCodeSrcdoc(node = {}) {
  const preview = codePreview(node)
  const artifactHtml = String(node.artifact?.html || '').trim()
  if (artifactHtml) return withPreviewCodeFitStyle(artifactHtml)
  if (preview.codeLanguage === 'html' && String(preview.code || '').trim()) return withPreviewCodeFitStyle(preview.code)
  const selected = selectedCodePreviewCode(node)
  if (preview.codeLanguage === 'vue' || selectedCodePreviewFile(node).path?.endsWith('.vue')) {
    return vuePreviewSrcdoc(selected || preview.code, node)
  }
  return ''
}

function previewCodeFitStyle() {
  return '<style id="workflow-preview-code-fit-style">html,body{min-height:100vh !important;height:auto !important;}body{margin:0 !important;overflow-x:auto !important;}body>*:first-child,.app,.page,.container,.wrapper,main{min-height:100vh !important;height:auto !important;max-height:none !important;}[style*="height:"]{max-height:none !important;}</style>'
}

function withPreviewCodeFitStyle(html = '') {
  const source = String(html || '')
  if (!source || source.includes('workflow-preview-code-fit-style')) return source
  const style = previewCodeFitStyle()
  return /<\/head>/i.test(source)
    ? source.replace(/<\/head>/i, `${style}</head>`)
    : `${style}${source}`
}

function vuePreviewSrcdoc(source = '', node = {}) {
  const template = String(source || '').match(/<template>([\s\S]*?)<\/template>/i)?.[1]?.trim() || ''
  const normalizedTemplate = template
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/:[\w-]+="[^"]*"/g, '')
    .replace(/@[\w-]+="[^"]*"/g, '')
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, '<span class="vue-placeholder">$1</span>')
  if (!normalizedTemplate) return ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #222529; background: #f6f8fb; }
    .preview-root { min-height: 100vh; padding: 18px; }
    .preview-shell { min-height: calc(100vh - 36px); border: 1px solid #e4e8ef; border-radius: 16px; background: #fff; padding: 18px; box-shadow: 0 18px 42px rgba(34, 37, 41, .08); overflow: auto; }
    .preview-label { display: inline-flex; margin-bottom: 12px; border-radius: 999px; background: #eef6ff; color: #2457a6; padding: 4px 10px; font-size: 12px; font-weight: 800; }
    button, input, textarea, select { font: inherit; }
    button { border: 0; border-radius: 8px; background: #222529; color: #fff; min-height: 36px; padding: 0 12px; }
    .vue-placeholder { color: #6b7280; font-size: .92em; }
  </style>
</head>
<body>
  <main class="preview-root">
    <section class="preview-shell">
      <span class="preview-label">${escapePreviewHtml(node.title || 'Vue 预览')}</span>
      ${normalizedTemplate}
    </section>
  </main>
</body>
</html>`
}

function escapePreviewHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function selectCodePreviewFile(node = {}, filePath = '') {
  if (!node?.id || !filePath) return
  selectedCodePreviewFiles.value = {
    ...selectedCodePreviewFiles.value,
    [node.id]: filePath
  }
}

function generationActions(node = {}) {
  const actions = Array.isArray(node.generationActions) && node.generationActions.length
    ? node.generationActions
    : []
  return actions
    .map((action, index) => {
      if (typeof action === 'string') {
        return { id: `generation-action-${index}`, label: action, description: '', targetGenerator: node.targetGenerator || '' }
      }
      if (!action || typeof action !== 'object' || Array.isArray(action)) return null
      return {
        id: action.id || `generation-action-${index}`,
        label: action.label || action.name || '生成',
        description: action.description || '',
        targetGenerator: action.targetGenerator || node.targetGenerator || '',
        status: action.status || node.artifactStatus || 'pending'
      }
    })
    .filter((action) => action?.label)
}

function artifactStatusLabel(node = {}) {
  const status = String(node.artifactStatus || '').trim()
  if (status === 'generated') return '已生成'
  if (status === 'generating') return '生成中'
  if (status === 'failed') return '生成失败'
  return '待生成'
}

function visualCanvasActionLabel(node = {}, action = {}) {
  if (visualPreviewImage(node) || ['generated', 'failed'].includes(node.artifactStatus)) return '重新生成高保真图'
  return action.label || '生成高保真图'
}

function visualGenerationButtonLabel(node = {}, action = {}) {
  if (isNodeActuallyLoading(node)) return '生成中'
  return visualCanvasActionLabel(node, action)
}

function codeGenerationButtonLabel(node = {}, action = {}) {
  if (isNodeActuallyLoading(node)) return '生成中'
  const target = String(action.targetGenerator || node.targetGenerator || codePreview(node).codeLanguage || '').trim().toLowerCase()
  const isVue = target === 'vue' || node.stageId === 'vue-output'
  const generated = Boolean(selectedCodePreviewCode(node).trim()) || ['generated', 'failed'].includes(node.artifactStatus)
  if (generated) return isVue ? '重新生成 Vue' : '重新生成 HTML'
  return action.label || (isVue ? '生成 Vue' : '生成 HTML')
}

function runCanvasGenerationAction(node = {}, action = {}) {
  if (!node?.id || !action?.label) return
  emit('quick-action', {
    nodeId: node.id,
    action: action.label,
    generationAction: action,
    targetGenerator: action.targetGenerator || node.targetGenerator || '',
    mode: 'stage-detail-generation'
  })
}

function runFullscreenGenerationAction(node = {}, action = {}) {
  if (!node?.id || !action?.label) return
  emit('quick-action', {
    nodeId: node.id,
    action: action.label,
    generationAction: action,
    targetGenerator: action.targetGenerator || node.targetGenerator || '',
    mode: 'stage-detail-generation'
  })
}

function acceptanceChecklist(node = {}) {
  return Array.isArray(node.acceptanceChecklist) ? node.acceptanceChecklist : detailSectionItems(node, /验收/)
}

function normalizeAcceptanceCards(items = [], fallbackItems = [], prefix = 'acceptance') {
  const source = Array.isArray(items) && items.length ? items : fallbackItems
  return (Array.isArray(source) ? source : []).map((item, index) => {
    if (item && typeof item === 'object') {
      return {
        key: item.id || item.key || `${prefix}-${index + 1}`,
        title: String(item.title || item.name || item.rule || item.state || `验收项 ${index + 1}`).trim(),
        expected: String(item.expected || item.verification || item.summary || item.description || '验收方式待确认').trim(),
        priority: String(item.priority || item.sourceRef || '').trim()
      }
    }
    return {
      key: `${prefix}-${index + 1}`,
      title: String(item || `验收项 ${index + 1}`).trim(),
      expected: '验收方式待确认',
      priority: ''
    }
  }).filter((item) => item.title)
}

function ruleAcceptance(node = {}) {
  return normalizeAcceptanceCards(node.ruleAcceptance, detailSectionItems(node, /业务规则/), 'rule-acceptance')
}

function stateAcceptance(node = {}) {
  return normalizeAcceptanceCards(node.stateAcceptance, detailSectionItems(node, /状态流|状态/), 'state-acceptance')
}

function nonFunctionalAcceptance(node = {}) {
  return normalizeAcceptanceCards(node.nonFunctionalAcceptance, detailSectionItems(node, /非功能/), 'non-functional')
}

function riskItems(node = {}) {
  return Array.isArray(node.riskItems) ? node.riskItems : detailSectionItems(node, /风险/)
}

function knowledgeDeposits(node = {}) {
  return Array.isArray(node.knowledgeDeposits) ? node.knowledgeDeposits : detailSectionItems(node, /沉淀|知识/)
}

function deliveryPackage(node = {}) {
  const fallback = {
    summary: node.summary || '本阶段汇总需求、页面、代码、验收与知识沉淀内容。',
    metrics: [
      { label: '验收项', value: String(acceptanceChecklist(node).length), hint: '上线前逐项确认' },
      { label: '风险项', value: String(riskItems(node).length), hint: '交付前需要关闭或留痕' },
      { label: '知识条目', value: String(knowledgeDeposits(node).length), hint: '可沉淀到项目知识库' }
    ],
    artifacts: knowledgeDeposits(node)
  }
  if (!node.deliveryPackage || typeof node.deliveryPackage !== 'object') return fallback
  return {
    ...fallback,
    ...node.deliveryPackage,
    metrics: Array.isArray(node.deliveryPackage.metrics) && node.deliveryPackage.metrics.length ? node.deliveryPackage.metrics : fallback.metrics,
    artifacts: Array.isArray(node.deliveryPackage.artifacts) && node.deliveryPackage.artifacts.length ? node.deliveryPackage.artifacts : fallback.artifacts
  }
}

function requirementKnowledgeCitationSources(node = {}) {
  const artifact = requirementDissectionArtifact(node)
  const context = artifact.knowledgeLoadingContext || {}
  const evidence = artifact.evidenceAndAssumptions || {}
  if (evidence.demandScope !== 'project' && context.mode !== 'project') return []
  const sources = Array.isArray(context.sources) && context.sources.length
    ? context.sources
    : (Array.isArray(evidence.evidenceSources) ? evidence.evidenceSources : [])
      .filter((item) => /项目知识|知识库/.test(String(item || '')))
      .map((item, index) => ({ id: `evidence-knowledge-${index + 1}`, title: item, sourceType: 'project-knowledge', summary: item }))
  return sources.map((source, index) => ({
    key: source?.id || source?.title || `knowledge-citation-${index + 1}`,
    title: String(source?.title || source?.name || `项目知识 ${index + 1}`).trim(),
    sourceType: String(source?.sourceType || 'project-knowledge').trim(),
    path: String(source?.path || source?.url || '').trim(),
    summary: String(source?.summary || source?.snippet || source?.content || '已作为本次需求分析的项目知识引用。').trim()
  })).filter((source) => source.title)
}

function requirementKnowledgeCitationSummary(node = {}) {
  const sources = requirementKnowledgeCitationSources(node)
  if (!sources.length) return ''
  const context = requirementDissectionArtifact(node).knowledgeLoadingContext || {}
  return String(context.summary || `本次需求分析参考了 ${sources.length} 条项目知识。`).trim()
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

function expandAllTreeItems(node = {}) {
  if (!node?.id) return
  const next = new Set(expandedTreeItems.value)
  normalizeTreeItems(node)
    .filter((item) => item.hasChildren)
    .forEach((item) => next.add(`${node.id}:${item.key}`))
  expandedTreeItems.value = next
}

function collapseAllTreeItems(node = {}) {
  if (!node?.id) return
  const next = new Set(expandedTreeItems.value)
  normalizeTreeItems(node).forEach((item) => next.delete(`${node.id}:${item.key}`))
  expandedTreeItems.value = next
}

function focusNode(nodeId) {
  const node = displayNodes.value.find((item) => item.id === nodeId)
  const scrollarea = viewportRef.value
  if (!node || !scrollarea) return
  const nodeLeft = node.x * props.zoom
  const centeredLeft = Math.max(0, nodeLeft - scrollarea.clientWidth / 2 + (node.width * props.zoom) / 2)
  const actionSafeLeft = Math.max(0, nodeLeft - CANVAS_FOCUS_SAFE_GUTTER)
  const targetLeft = Math.min(centeredLeft, actionSafeLeft)
  const targetTop = Math.max(0, node.y * props.zoom - scrollarea.clientHeight / 2 + (node.height * props.zoom) / 2)
  scrollarea.scrollTo({
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
  () => props.totalFlow?.activeSliceId || '',
  (sliceId) => {
    activeSliceOverrideId.value = sliceId
  }
)

watch(
  () => props.totalFlow?.currentStage || '',
  (stageId) => {
    activeStageOverrideId.value = stageId
  }
)

watch(
  () => props.fullscreenNode?.id || '',
  (nodeId) => {
    if (!nodeId) {
      cancelFullscreenEdit()
      return
    }
    if (props.fullscreenEditNodeId && props.fullscreenNode?.id === props.fullscreenEditNodeId) startFullscreenEdit(props.fullscreenNode)
    if (props.fullscreenEditNodeId && props.fullscreenNode?.id === props.fullscreenEditNodeId) return
    if (fullscreenEditingNodeId.value && fullscreenEditingNodeId.value !== nodeId) cancelFullscreenEdit()
  }
)

onMounted(() => {
  document.addEventListener('pointerdown', handleCanvasGlobalPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleCanvasGlobalPointerDown)
  if (codeCopyToastTimer) window.clearTimeout(codeCopyToastTimer)
})

defineExpose({ focusNode })

const nodeById = computed(() =>
  new Map(displayNodes.value.map((node) => [node.id, node]))
)
const nodesByTitle = computed(() =>
  new Map(displayNodes.value.map((node) => [normalizeNodeLookupText(node.title || node.id), node]))
)

const drawableEdges = computed(() =>
  props.edges.filter((edge) => {
    const from = nodeById.value.get(edge.from)
    const to = nodeById.value.get(edge.to)
    if (!from || !to || from.loading || to.loading || !isDrawableNode(from) || !isDrawableNode(to)) return false
    const fromRight = Number(from.x) + Number(from.width)
    const toLeft = Number(to.x)
    const distance = toLeft - fromRight
    return distance > 16 && distance < 760
  })
)

function isDrawableNode(node = {}) {
  return [node.x, node.y, node.width, node.height].every((value) => Number.isFinite(Number(value)))
}

function sourceAnchor(node = {}) {
  return {
    x: Number(node.x) + Number(node.width),
    y: Number(node.y) + Number(node.height) / 2
  }
}

function targetAnchor(node = {}) {
  return {
    x: Number(node.x),
    y: Number(node.y) + Number(node.height) / 2
  }
}

function edgePath(edge) {
  const fromNode = nodeById.value.get(edge.from)
  const to = nodeById.value.get(edge.to)
  if (!fromNode || !to) return ''
  const from = sourceAnchor(fromNode)
  const end = targetAnchor(to)
  const distance = Math.max(32, end.x - from.x)
  const curve = Math.min(96, Math.max(36, distance * 0.32))
  return `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`
}

function isActiveIncomingEdge(edge) {
  return Boolean(props.activeNode?.id && edge.to === props.activeNode.id)
}

function normalizeNodeLookupText(value = '') {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function resolvePageNodeId(page = {}) {
  const directNodeId = page.nodeId || page.id
  if (directNodeId && nodeById.value.has(directNodeId)) return directNodeId
  const titleKey = normalizeNodeLookupText(page.title)
  const titleNode = titleKey ? nodesByTitle.value.get(titleKey) : null
  if (titleNode?.id) return titleNode.id
  const fuzzyNode = displayNodes.value.find((node) => {
    const nodeTitle = normalizeNodeLookupText(node.title || node.id)
    return titleKey && (nodeTitle.includes(titleKey) || titleKey.includes(nodeTitle))
  })
  return fuzzyNode?.id || directNodeId || displayNodes.value[0]?.id || ''
}

function focusPageNode(page = {}) {
  const resolvedNodeId = resolvePageNodeId(page)
  if (!resolvedNodeId) return
  emit('focus-node', resolvedNodeId)
  nextTick(() => focusNode(resolvedNodeId))
}

async function selectRequirementSlice(sliceId = '') {
  if (!sliceId || sliceId === activeSliceId.value) return
  activeSliceOverrideId.value = sliceId
  emit('update-slice', sliceId)
  await nextTick()
  const firstPage = pageNodesForActiveSlice.value[0]
  if (firstPage) {
    focusPageNode(firstPage)
    return
  }
  const firstNode = displayNodes.value[0]?.id
  if (firstNode) emit('focus-node', firstNode)
}

function confirmStageAndGoNext() {
  const nextStage = nextWorkflowStage.value
  if (!nextStage?.id) return
  const stageConfirmPrompt = [
    `请确认「${activeStageLabel.value}」阶段结果，并基于当前阶段产出进入下一阶段「${nextStage?.name || '下一阶段'}」。`,
    stageAgentNode.value?.summary ? `当前阶段摘要：${stageAgentNode.value.summary}` : '',
    stageAgentSections.value.length
      ? `当前阶段要点：${stageAgentSections.value.map((section) => `${section.title}：${section.items.slice(0, 3).join('；')}`).join('｜')}`
      : '',
    '如果仍有关键缺口，请明确缺口；如果可以推进，请给出下一阶段需要关注的输入、产物和风险。'
  ].filter(Boolean).join('\n')
  emit('quick-action', {
    nodeId: activeStageId.value,
    action: stageConfirmPrompt,
    stageId: activeStageId.value,
    nextStageId: nextStage?.id || '',
    mode: 'stage-agent-confirm-next'
  })
}

function handleCanvasWheel(event) {
  if (!event.ctrlKey && !event.metaKey && !event.deltaZ) return
  event.preventDefault()
  const rawDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  const zoomDelta = Math.max(-0.18, Math.min(0.18, -rawDelta / 500))
  if (!zoomDelta) return
  emit('zoom', zoomDelta)
}

function handleCanvasActionClick(event) {
  const actionTarget = event.target?.closest?.('[data-canvas-action][data-node-id]')
  if (!actionTarget || !viewportRef.value?.contains(actionTarget)) return
  const action = actionTarget.dataset?.canvasAction || ''
  const nodeId = actionTarget.dataset?.nodeId || ''
  if (!nodeId) return
  const node = displayNodes.value.find((item) => item?.id === nodeId) || { id: nodeId }
  event.stopPropagation()
  if (action === 'open-agent') emit('open-agent', nodeId)
  if (action === 'open-detail') emit('open-agent', { action: 'open-detail', nodeId, node })
}

function canOpenStage(stageId = '') {
  if (!stageId) return false
  const index = totalFlowStages.value.findIndex((stage) => stage.id === stageId)
  if (index <= 0) return true
  if (stageId === activeStageId.value) return true
  if (index < activeStageIndex.value) return true
  if (['generating', 'paused'].includes(stageStatus(stageId))) return true
  if (loadedStageIds.value.has(stageId)) return true
  if (stageConfirmation(stageId)) return true
  const previousStageId = previousStageIdForCanvasStage(stageId)
  if (previousStageId && stageConfirmation(previousStageId)) return true
  const runtime = stageRuntime(stageId)
  if (runtime && typeof runtime.canOpen === 'boolean') return runtime.canOpen === true
  return false
}

function layoutCanvasNodes(nodes = [], options = {}) {
  const safeNodes = Array.isArray(nodes) ? nodes.filter((node) => node && typeof node === 'object') : []
  const occupied = []
  const compactGrid = Boolean(options.compactGrid)
  return safeNodes.map((node, index) => {
    const visualNode = isVisualGalleryDetail(node)
    const previewCodeNode = isPreviewCodeDetail(node)
    const width = visualNode || previewCodeNode ? Math.max(Number(node.width || 0), 380) : Number(node.width || 320)
    const height = visualNode ? Math.max(Number(node.height || 0), 430) : previewCodeNode ? 292 : Number(node.height || 220)
    const columnGap = visualNode || previewCodeNode ? 440 : 400
    const rowGap = visualNode || previewCodeNode ? 500 : 300
    const fallbackX = compactGrid ? 80 + (index % 4) * columnGap : 80 + (index % 4) * 380
    const fallbackY = compactGrid ? 140 + Math.floor(index / 4) * rowGap : 120 + Math.floor(index / 4) * 280
    let x = compactGrid || !Number.isFinite(Number(node.x)) ? fallbackX : Number(node.x)
    let y = compactGrid || !Number.isFinite(Number(node.y)) ? fallbackY : Number(node.y)
    let guard = 0
    while (occupied.some((rect) => rectanglesOverlap({ x, y, width, height }, rect)) && guard < 24) {
      x += compactGrid ? columnGap : 380
      if (x > 3600) {
        x = 80
        y += compactGrid ? rowGap : 280
      }
      guard += 1
    }
    occupied.push({ x, y, width, height })
    return { ...node, x, y, width, height }
  })
}

function rectanglesOverlap(a, b) {
  const gutter = 24
  return !(
    a.x + a.width + gutter <= b.x ||
    b.x + b.width + gutter <= a.x ||
    a.y + a.height + gutter <= b.y ||
    b.y + b.height + gutter <= a.y
  )
}

function focusStage(stage = {}, options = {}) {
  if (!stage?.id || (!options.force && !canOpenStage(stage.id))) return
  activeStageOverrideId.value = stage.id
  emit('update-stage', stage.id)
  const sourceNodes = displayNodes.value
  const stageNode = sourceNodes.find((node) =>
    normalizeNodeLookupText(node.stageId || node.id || node.title).includes(normalizeNodeLookupText(stage.id)) ||
    normalizeNodeLookupText(node.title || '').includes(normalizeNodeLookupText(stage.name || ''))
  )
  const fallbackNodeId = stageNode?.id || sourceNodes[0]?.id || props.activeNode?.id || ''
  if (!fallbackNodeId) return
  emit('focus-node', fallbackNodeId)
  if (isAgentWorkbenchStageId(stage.id)) return
  nextTick(() => focusNode(fallbackNodeId))
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

function handleCanvasGlobalPointerDown(event) {
  if (!showVersionHistory.value) return
  const menu = versionMenuRef.value
  if (menu && menu.contains(event.target)) return
  showVersionHistory.value = false
}

function confirmRollbackVersion() {
  if (!rollbackPreviewVersion.value?.snapshot) return
  const version = rollbackPreviewVersion.value
  closeRollbackPreview()
  emit('rollback-version', version)
}
</script>
