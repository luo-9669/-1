<template>
  <section v-if="materialsTab === 'knowledge'" class="knowledge-hub-layout">
    <section class="knowledge-hub-main">
      <div class="module-command-bar knowledge-command-bar">
        <div class="module-command-tabs knowledge-primary-tabs">
          <BaseTabs
            :model-value="knowledgeHubSection"
            :items="knowledgeHubSectionItems"
            label="知识库视图"
            @change="$emit('update-knowledge-hub-section', $event)"
          />
        </div>
        <div class="module-command-actions actions">
          <BaseButton type="button" @click="$emit('open-material-tool', 'website-import')">网站导入</BaseButton>
          <BaseButton type="button" @click="$emit('open-material-tool', 'project-package-import')">项目包导入</BaseButton>
          <BaseButton type="button" @click="$emit('open-material-tool', 'project-package-import')">交互蓝图包导入</BaseButton>
          <BaseButton type="button" @click="$emit('open-material-tool', 'retrieval-test')">召回测试</BaseButton>
          <BaseButton type="button" @click="$emit('open-material-tool', 'parse-jobs')">解析任务</BaseButton>
          <BaseButton type="button" @click="$emit('toggle-material-batch-mode')">
            {{ materialBatchMode ? '退出管理' : '批量管理' }}
          </BaseButton>
          <BaseButton variant="primary" type="button" @click="$emit('open-material-create')">导入文件</BaseButton>
        </div>
      </div>
      <input
        class="hidden-file-input"
        type="file"
        multiple
        accept=".pdf,.docx,.md,.txt,.xlsx,.csv,.json"
        @change="$emit('import-material-files', $event)"
      />
      <Notice :result="currentMaterialStatus" floating />
      <section v-if="knowledgeHubSection === 'entries'" class="knowledge-entries-shell">
        <template v-if="currentKnowledgeHub.entries.items.length">
          <BaseDataTable class="requirements-table-panel knowledge-entry-table-panel" table-class="requirements-table knowledge-entry-table" min-width="1080px">
            <thead>
              <tr>
                <th>知识条目</th>
                <th>知识类型</th>
                <th>角色</th>
                <th>可信状态</th>
                <th>证据</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in paginatedKnowledgeEntryRows" :key="entry.id">
                <td>
                  <button type="button" class="requirements-file-link knowledge-entry-file-link" @click="$emit('open-knowledge-entry-detail', entry)">
                    <strong>{{ entry.title }}</strong>
                    <span>{{ entry.summary || entry.meta || '暂无摘要' }}</span>
                  </button>
                </td>
                <td><span class="requirements-source-badge">{{ entry.category || entry.sourceType || '知识' }}</span></td>
                <td>{{ entry.roleLabel || '全部角色' }}</td>
                <td><span class="requirements-status-pill">{{ entry.verification?.status || 'unverified' }}</span></td>
                <td>{{ entry.evidence?.length || 0 }} 条</td>
                <td>
                  <div class="requirements-row-actions">
                    <button type="button" @click="$emit('open-knowledge-entry-detail', entry)">查看</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </BaseDataTable>
          <footer v-if="knowledgeEntryPagination.totalPages > 1" class="knowledge-entry-pagination">
            <span>{{ knowledgeEntryPagination.start }}-{{ knowledgeEntryPagination.end }} / {{ knowledgeEntryPagination.total }} 条</span>
            <div>
              <BaseButton type="button" :disabled="knowledgeEntryPage <= 1" @click="setKnowledgeEntryPage(knowledgeEntryPage - 1)">上一页</BaseButton>
              <strong>{{ knowledgeEntryPage }} / {{ knowledgeEntryPagination.totalPages }}</strong>
              <BaseButton type="button" :disabled="knowledgeEntryPage >= knowledgeEntryPagination.totalPages" @click="setKnowledgeEntryPage(knowledgeEntryPage + 1)">下一页</BaseButton>
            </div>
          </footer>
        </template>
        <section v-else class="panel materials-empty">
          <h3>暂无知识条目</h3>
          <p>导入文件、网站或项目包后，普通知识材料会先展示在这里；生成蓝图后再进入框架全览、流程图和交互 Demo。</p>
        </section>
      </section>

      <section v-if="knowledgeHubSection === 'structure'" class="knowledge-canvas-shell">
        <div v-if="currentKnowledgeBlueprintWorkbench.nodes.length" class="knowledge-framework-workspace">
          <div ref="knowledgeFrameworkViewportRef" class="knowledge-framework-map-viewport">
            <div ref="knowledgeFrameworkMapRef" class="knowledge-framework-map" :style="{ transform: `scale(${knowledgeCanvasZoom})` }">
              <svg
                class="knowledge-framework-connectors"
                :width="knowledgeFrameworkConnectorSize.width"
                :height="knowledgeFrameworkConnectorSize.height"
                :viewBox="`0 0 ${knowledgeFrameworkConnectorSize.width} ${knowledgeFrameworkConnectorSize.height}`"
                aria-hidden="true"
              >
                <path
                  v-for="connector in knowledgeFrameworkConnectorPaths"
                  :key="connector.id"
                  class="knowledge-framework-connector"
                  :d="knowledgeFrameworkConnectorPathD(connector)"
                />
              </svg>
              <div class="knowledge-framework-root-node" data-framework-node-id="__root">
                <span>项目</span>
                <strong>{{ knowledgeFrameworkRootTitle }}</strong>
                <small>{{ currentKnowledgeHub.overview.blueprintTitle || '项目框架' }}</small>
              </div>
              <div class="knowledge-framework-branches">
                <section
                  v-for="branch in knowledgeFrameworkBranches"
                  :key="branch.id"
                  class="knowledge-framework-branch"
                >
                  <button
                    type="button"
                    class="knowledge-framework-branch-node"
                    :class="{ active: selectedKnowledgeNode?.id === branch.id }"
                    :data-framework-node-id="branch.id"
                    @click="$emit('select-knowledge-structure-node', branch.id)"
                  >
                    <i v-if="branch.children?.length" @click.stop="$emit('toggle-knowledge-node', branch.id)">{{ knowledgeExpandedNodeIds[branch.id] ? '−' : '+' }}</i>
                    <i v-else></i>
                    <span>{{ blueprintNodeKindLabel(branch.kind) }}</span>
                    <strong>{{ branch.title }}</strong>
                    <small v-if="branch.meta">{{ branch.meta }}</small>
                  </button>
                  <div class="knowledge-framework-child-columns">
                    <div
                      v-for="column in knowledgeFrameworkBranchColumns(branch)"
                      :key="`${branch.id}-depth-${column.depth}`"
                      class="knowledge-framework-child-column"
                    >
                      <button
                        v-for="node in column.nodes"
                        :key="node.id"
                        type="button"
                        class="knowledge-framework-leaf-node"
                        :class="{ active: selectedKnowledgeNode?.id === node.id, collapsed: node.collapsed }"
                        :data-framework-node-id="node.id"
                        :style="{ '--depth': column.depth }"
                        @click="$emit('select-knowledge-structure-node', node.id)"
                      >
                        <i v-if="node.children?.length" @click.stop="$emit('toggle-knowledge-node', node.id)">{{ knowledgeExpandedNodeIds[node.id] ? '−' : '+' }}</i>
                        <i v-else></i>
                        <span>{{ blueprintNodeKindLabel(node.kind) }}</span>
                        <strong>{{ node.title }}</strong>
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
        <section v-else class="panel materials-empty">
          <h3>暂无项目蓝图</h3>
          <p>先通过网站导入或蓝图导入生成项目蓝图，框架全览会自动使用 XMind 形式展示。</p>
        </section>
      </section>

      <section v-if="knowledgeHubSection === 'flow'" class="knowledge-canvas-shell">
        <div
          v-if="knowledgePrototypePages.length"
          class="knowledge-flow-canvas-shell knowledge-flow-layout workflow-canvas-shell"
          tabindex="0"
          @keydown="handleKnowledgeCanvasKeydown"
        >
          <aside class="knowledge-flow-structure-panel knowledge-flow-tree-panel">
            <div>
              <strong>层级</strong>
              <span>{{ knowledgeFlowStructureNodes.length }} 项 · {{ knowledgePrototypeFlowTree.flows?.length || 0 }} 条流程</span>
            </div>
            <button
              v-for="node in knowledgeFlowStructureNodes"
              :key="node.id"
              type="button"
              class="knowledge-flow-structure-item knowledge-flow-tree-item"
              :class="{
                active: isKnowledgeFlowStructureNodeCurrent(node),
                'is-related-flow': isKnowledgeFlowStructureNodeRelated(node)
              }"
              :style="{ '--depth': node.visualDepth || 0 }"
              @click="selectKnowledgeFlowStructureNode(node)"
            >
              <i v-if="node.children?.length" @click.stop="toggleKnowledgeFlowStructureNode(node)">{{ isKnowledgeFlowTreeNodeExpanded(node) ? '−' : '+' }}</i>
              <i v-else></i>
              <strong>{{ node.title }}</strong>
            </button>
            <template v-if="!knowledgeFlowStructureNodes.length">
              <button
                v-for="flow in knowledgePrototypeFlowTree.flows"
                :key="`fallback-${flow.id}`"
                type="button"
                class="knowledge-flow-tree-item knowledge-flow-fallback-item"
                :class="{ active: selectedKnowledgeFlow?.id === flow.id }"
                @click="$emit('select-knowledge-flow', flow.id)"
              >
                <strong>{{ flow.title }}</strong>
              </button>
            </template>
          </aside>
          <section class="knowledge-flow-canvas-viewport workflow-canvas-viewport" :class="`is-${knowledgeFlowMode}-mode`">
            <div class="knowledge-flow-mode-switch" role="tablist" aria-label="流程显示模式">
              <button
                type="button"
                :class="{ active: knowledgeFlowMode === 'canvas' }"
                @click="setKnowledgeFlowMode('canvas')"
              >画布模式</button>
              <button
                type="button"
                :class="{ active: knowledgeFlowMode === 'workflow' }"
                @click="setKnowledgeFlowMode('workflow')"
              >工作流模式</button>
            </div>
            <div class="knowledge-flow-canvas-scrollarea workflow-canvas-scrollarea" @wheel="handleKnowledgeCanvasWheel">
              <div
                class="knowledge-flow-canvas-surface workflow-canvas-surface"
                :style="{ transform: `scale(${knowledgeCanvasZoom})` }"
              >
                <svg
                  class="workflow-canvas-edges"
                  :width="KNOWLEDGE_WORKFLOW_CANVAS_WIDTH"
                  :height="KNOWLEDGE_WORKFLOW_CANVAS_HEIGHT"
                  aria-hidden="true"
                >
                  <path
                    v-for="edge in knowledgeWorkflowCanvasEdges"
                    :key="edge.id"
                    :d="knowledgeWorkflowEdgePath(edge)"
                    :class="{ 'active-flow': edge.active }"
                  />
                </svg>
                <article
                  v-for="node in knowledgeWorkflowCanvasNodes"
                  :key="node.id"
                  :data-node-id="node.id"
                  class="canvas-node-card knowledge-flow-node-card knowledge-prototype-card"
                  :class="{
                    active: node.page?.id && selectedKnowledgePrototypeScreen?.id === node.page.id,
                    'workflow-selected': knowledgeFlowMode === 'workflow' && selectedKnowledgeWorkflowNodeId === node.id,
                    'knowledge-workflow-draft-card': node.kind === 'draft',
                    [`is-${node.direction}`]: node.kind === 'draft' && node.direction,
                    'is-dragging': knowledgeWorkflowDragState?.nodeId === node.id
                  }"
                  :style="getKnowledgeWorkflowNodeStyle(node)"
                  @click="handleKnowledgeWorkflowNodeClick(node)"
                  @pointerdown="startKnowledgeWorkflowNodeDrag($event, node)"
                >
                  <div class="knowledge-workflow-node-media prototype-screen knowledge-screenshot-stage">
                    <div v-if="knowledgeWorkflowNodeImageUrl(node)" class="prototype-screen-viewport">
                      <div class="prototype-image-frame" :style="getPrototypeViewportStyle(node.page || {})">
                        <img class="knowledge-screenshot-image" :src="knowledgeWorkflowNodeImageUrl(node)" :alt="node.title" />
                        <span
                          v-for="hotspot in node.kind === 'page' && knowledgeWorkflowNodeImageUrl(node) === node.page?.screenshotUrl ? node.page.actions : []"
                          :key="`${node.id}-${hotspot.id || hotspot.label}`"
                          class="prototype-hotspot-frame"
                          :style="getKnowledgeHotspotStyle(hotspot.rect)"
                          :title="`${hotspot.label} → ${hotspot.targetScreenId || '详情'}`"
                        ></span>
                      </div>
                      <button
                        v-if="node.kind === 'page'"
                        type="button"
                        class="prototype-screen-zoom"
                        :aria-label="`放大查看 ${node.title}`"
                        @click.stop="openKnowledgeFlowImagePreview({ ...node.page, title: node.title, screenshotUrl: knowledgeWorkflowNodeImageUrl(node) })"
                      >
                        放大
                      </button>
                    </div>
                    <div v-else class="knowledge-workflow-node-placeholder">
                      <span>{{ node.kind === 'draft' ? directionLabel(node.direction) : '截图' }}</span>
                      <strong>{{ node.kind === 'draft' ? '新流程节点' : '暂无页面截图' }}</strong>
                    </div>
                    <label
                      class="knowledge-workflow-upload-control"
                      @click.stop
                      @pointerdown.stop
                    >
                      上传图片
                      <input
                        type="file"
                        accept="image/*"
                        @change="handleKnowledgeWorkflowImageUpload(node, $event)"
                      />
                    </label>
                  </div>
                  <div class="knowledge-workflow-node-body">
                    <input
                      v-if="knowledgeFlowMode === 'workflow'"
                      class="knowledge-workflow-title-input"
                      type="text"
                      :value="node.title"
                      aria-label="编辑画布名称"
                      @input.stop="updateKnowledgeWorkflowNodeTitle(node, $event.target.value)"
                      @click.stop
                      @pointerdown.stop
                    />
                    <strong v-else>{{ node.title }}</strong>
                    <p>{{ node.summary || '暂无页面说明' }}</p>
                    <small v-if="node.kind === 'draft'">{{ node.anchorTitle }}</small>
                    <small v-else>{{ node.page.flowActionLabel || node.page.primaryAction || (node.index < knowledgeFlowCanvasPages.length - 1 ? '进入下一页面' : '流程末端') }}</small>
                    <small v-if="knowledgeFlowMode === 'workflow'" class="knowledge-workflow-drag-hint">可拖动</small>
                    <template v-if="node.kind === 'page' && knowledgePrototypeUploadStatus(node.page?.id).status">
                      <small
                        class="knowledge-prototype-upload-status"
                        :data-status="knowledgePrototypeUploadStatus(node.page?.id).status"
                        aria-live="polite"
                      >
                        {{ knowledgePrototypeUploadStatus(node.page?.id).status === 'loading'
                          ? '上传中'
                          : knowledgePrototypeUploadStatus(node.page?.id).status === 'failed'
                            ? `上传失败：${knowledgePrototypeUploadStatus(node.page?.id).message || '请重新上传'}`
                            : knowledgePrototypeUploadStatus(node.page?.id).message || '上传完成' }}
                      </small>
                    </template>
                  </div>
                  <div class="knowledge-workflow-node-actions">
                    <button v-if="node.kind === 'page'" type="button" @click.stop="$emit('open-knowledge-node-detail', node.page.nodeId)">查看节点详情</button>
                    <button
                      v-if="knowledgeFlowMode === 'workflow'"
                      type="button"
                      class="knowledge-workflow-delete-button"
                      @click.stop="deleteKnowledgeWorkflowNode(node)"
                    >删除</button>
                  </div>
                  <div
                    v-if="knowledgeFlowMode === 'workflow' && selectedKnowledgeWorkflowNodeId === node.id"
                    class="knowledge-workflow-add-handles"
                    aria-label="添加流程节点"
                    @click.stop
                  >
                    <button type="button" class="knowledge-workflow-add-button is-top" aria-label="向上添加流程节点" @click="addKnowledgeWorkflowDraftNode(node, 'top')">+</button>
                    <button type="button" class="knowledge-workflow-add-button is-right" aria-label="向右添加流程节点" @click="addKnowledgeWorkflowDraftNode(node, 'right')">+</button>
                    <button type="button" class="knowledge-workflow-add-button is-bottom" aria-label="向下添加流程节点" @click="addKnowledgeWorkflowDraftNode(node, 'bottom')">+</button>
                    <button type="button" class="knowledge-workflow-add-button is-left" aria-label="向左添加流程节点" @click="addKnowledgeWorkflowDraftNode(node, 'left')">+</button>
                  </div>
                </article>
              </div>
            </div>
            <div class="knowledge-flow-canvas-controls workflow-canvas-zoom-controls">
              <BaseButton type="button" aria-label="缩小画布" @click="$emit('adjust-knowledge-canvas-zoom', -0.1)">−</BaseButton>
              <strong>{{ Math.round(knowledgeCanvasZoom * 100) }}%</strong>
              <BaseButton type="button" aria-label="放大画布" @click="$emit('adjust-knowledge-canvas-zoom', 0.1)">+</BaseButton>
              <BaseButton type="button" @click="$emit('update-knowledge-canvas-zoom', 0.86)">适应</BaseButton>
              <BaseButton type="button" @click="$emit('update-knowledge-canvas-zoom', 1)">100%</BaseButton>
            </div>
          </section>
        </div>
        <section v-else class="panel materials-empty">
          <h3>暂无流程图</h3>
          <p>导入包含页面和交互路径的项目蓝图后，会按原型产品模式展示页面卡片和跳转关系。</p>
        </section>
      </section>

      <section v-if="knowledgeHubSection === 'prototype'" class="knowledge-canvas-shell">
        <div v-if="currentKnowledgePrototypeDemo.screens.length" class="knowledge-prototype-player">
          <aside class="knowledge-flow-demo">
            <div>
              <p class="eyebrow">交互 Demo</p>
              <h4>{{ selectedKnowledgePrototypeScreen?.title || '选择页面' }}</h4>
              <span>{{ selectedKnowledgePrototypeScreen?.summary || '点击左侧流程卡片或下方热点预览页面跳转。' }}</span>
            </div>
            <div class="prototype-demo-stage">
              <div
                v-if="selectedKnowledgePrototypeScreen?.screenshotUrl"
                class="prototype-image-frame"
                :style="getPrototypeViewportStyle(selectedKnowledgePrototypeScreen)"
              >
                <img
                  :src="selectedKnowledgePrototypeScreen.screenshotUrl"
                  :alt="selectedKnowledgePrototypeScreen.title"
                />
                <button
                  v-for="hotspot in selectedKnowledgePrototypeScreen?.hotspots || []"
                  :key="hotspot.id"
                  type="button"
                  class="prototype-hotspot-frame prototype-hotspot-button"
                  :style="getKnowledgeHotspotStyle(hotspot.rect)"
                  :title="`${hotspot.label} → ${hotspot.targetScreenId || '节点详情'}`"
                  @click="$emit('trigger-knowledge-prototype-hotspot', hotspot)"
                ></button>
              </div>
              <div v-else class="prototype-demo-wireframe">
                <header>{{ selectedKnowledgePrototypeScreen?.title || '页面原型' }}</header>
                <span
                  v-for="component in (selectedKnowledgePrototypeScreen?.components || []).slice(0, 6)"
                  :key="`${selectedKnowledgePrototypeScreen?.id}-${component.id}`"
                >
                  {{ component.label || component.type }}
                </span>
              </div>
            </div>
            <div class="prototype-demo-actions">
              <BaseButton type="button" :disabled="!selectedKnowledgePrototypePage" @click="$emit('open-knowledge-node-detail', selectedKnowledgePrototypePage.nodeId)">展开详情</BaseButton>
              <a
                v-if="selectedKnowledgePrototypeScreenLiveUrl"
                class="action-link"
                :href="selectedKnowledgePrototypeScreenLiveUrl"
                target="_blank"
                rel="noreferrer"
              >打开真实预览</a>
              <BaseButton type="button" @click="$emit('open-material-tool', 'parse-jobs')">后台截图资产</BaseButton>
              <BaseButton type="button" @click="$emit('switch-to-factory-from-knowledge-demo')">读取前端代码</BaseButton>
            </div>
            <div v-if="selectedKnowledgePrototypeHotspot" class="prototype-demo-feedback">
              <strong>{{ selectedKnowledgePrototypeHotspot.label || '最近操作' }}</strong>
              <span>{{ selectedKnowledgePrototypeHotspot.type || selectedKnowledgePrototypeHotspot.event || 'click' }}</span>
              <p>{{ selectedKnowledgePrototypeHotspot.feedback || selectedKnowledgePrototypeHotspot.result || selectedKnowledgePrototypeHotspot.value || selectedKnowledgePrototypeHotspot.resolvedTargetTitle || '已记录当前热区操作。' }}</p>
            </div>
            <div v-if="knowledgePrototypeClickPath.length" class="prototype-click-path">
              <strong>点击链路</strong>
              <ol>
                <li v-for="step in knowledgePrototypeClickPath" :key="step.id">
                  <span>{{ step.fromTitle }}</span>
                  <b>{{ step.label }}</b>
                  <span>{{ step.toTitle }}</span>
                </li>
              </ol>
            </div>
            <ul>
              <li v-for="transition in currentKnowledgePrototypeDemo.transitions.slice(0, 5)" :key="transition.id">
                {{ transition.from }} / {{ transition.label }} → {{ transition.to }}
              </li>
            </ul>
          </aside>
          <section class="prototype-screen-list">
            <button
              v-for="screen in currentKnowledgePrototypeDemo.screens"
              :key="screen.id"
              type="button"
              :class="{ active: selectedKnowledgePrototypeScreen?.id === screen.id }"
              @click="$emit('select-knowledge-prototype-screen', screen.id)"
            >
              <strong>{{ screen.title }}</strong>
              <span>{{ screen.hotspots?.length || 0 }} 个点击热区</span>
            </button>
          </section>
        </div>
        <section v-else class="panel materials-empty">
          <h3>暂无交互 Demo</h3>
          <p>从网站导入 URL 后，后端会采集页面截图并生成可点击热区；前端只负责播放和评审。</p>
        </section>
      </section>

      <section v-if="knowledgeHubSection === 'markdown'" class="knowledge-markdown-shell">
        <div class="knowledge-canvas-toolbar knowledge-markdown-toolbar">
          <BaseSecondaryTabs
            v-if="markdownSectionTabs.length > 1"
            v-model="activeMarkdownSection"
            class="knowledge-markdown-secondary-tabs"
            :items="markdownSectionTabItems"
            label="Markdown 章节"
          />
          <BaseButton type="button" :disabled="!currentKnowledgeMarkdown" @click="$emit('download-markdown', 'blueprint')">下载 Markdown</BaseButton>
        </div>
        <pre v-if="currentKnowledgeMarkdown" class="knowledge-markdown-view">{{ selectedMarkdownContent }}</pre>
        <section v-else class="panel materials-empty">
          <h3>暂无 Markdown 蓝图</h3>
          <p>导入项目网站或项目蓝图后，这里会展示可复制和交付的完整蓝图文档。</p>
        </section>
      </section>
    </section>
    <div
      v-if="knowledgeFlowImagePreview"
      class="knowledge-flow-image-preview-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="`${knowledgeFlowImagePreview.title} 放大预览`"
      @click.self="closeKnowledgeFlowImagePreview"
    >
      <section>
        <header>
          <div>
            <strong>{{ knowledgeFlowImagePreview.title }}</strong>
            <span>{{ knowledgeFlowImagePreview.actions?.length || 0 }} 个点击热区</span>
          </div>
          <button type="button" @click="closeKnowledgeFlowImagePreview">关闭</button>
        </header>
        <div class="knowledge-flow-image-preview-stage">
          <img :src="knowledgeFlowImagePreview.screenshotUrl" :alt="knowledgeFlowImagePreview.title" />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Notice from '../../components/Notice.vue'
import { BaseButton, BaseDataTable, BaseSecondaryTabs, BaseTabs } from '../../components/base'
import { buildMarkdownSectionTabs } from '../../services/knowledgeHub'

const KNOWLEDGE_WORKFLOW_CANVAS_WIDTH = 24000
const KNOWLEDGE_WORKFLOW_CANVAS_HEIGHT = 32000
const KNOWLEDGE_WORKFLOW_NODE_WIDTH = 320
const KNOWLEDGE_WORKFLOW_NODE_HEIGHT = 334
const KNOWLEDGE_WORKFLOW_NODE_GAP_X = 520
const KNOWLEDGE_WORKFLOW_NODE_GAP_Y = 460
const KNOWLEDGE_WORKFLOW_COLUMNS = 3
const KNOWLEDGE_WORKFLOW_ORIGIN_X = 80
const KNOWLEDGE_WORKFLOW_ORIGIN_Y = 128
const KNOWLEDGE_ENTRY_PAGE_SIZE = 20

const props = defineProps({
  materialsTab: { type: String, default: 'knowledge' },
  projectName: { type: String, default: '' },
  currentKnowledgeHub: { type: Object, required: true },
  knowledgeGovernanceSummary: { type: Object, default: () => ({
    completionRate: 0,
    missingSlots: [],
    layers: {}
  }) },
  currentKnowledgeHubSection: { type: Object, required: true },
  currentKnowledgeBlueprintWorkbench: { type: Object, required: true },
  currentMaterialStatus: { type: Object, default: null },
  knowledgeHubSection: { type: String, default: 'structure' },
  materialBatchMode: { type: Boolean, default: false },
  knowledgeCanvasZoom: { type: Number, default: 1 },
  knowledgeExpandedNodeIds: { type: Object, default: () => ({}) },
  visibleKnowledgeStructureNodes: { type: Array, default: () => [] },
  selectedKnowledgeNode: { type: Object, default: null },
  selectedKnowledgeNodeVisualContext: { type: Object, default: null },
  selectedKnowledgeNodeAiContext: { type: String, default: '' },
  knowledgePrototypeFlowTree: { type: Object, default: () => ({ roots: [], flows: [], selectedFlow: null }) },
  selectedKnowledgeFlow: { type: Object, default: null },
  knowledgePrototypePages: { type: Array, default: () => [] },
  selectedKnowledgePrototypeScreen: { type: Object, default: null },
  selectedKnowledgePrototypePage: { type: Object, default: null },
  selectedKnowledgePrototypeHotspot: { type: Object, default: null },
  knowledgePrototypeClickPath: { type: Array, default: () => [] },
  currentKnowledgePrototypeDemo: { type: Object, required: true },
  knowledgePrototypeUploadStates: { type: Object, default: () => ({}) },
  currentKnowledgeMarkdown: { type: String, default: '' },
  blueprintNodeKindLabel: { type: Function, required: true }
})

const knowledgeHubSectionItems = computed(() =>
  (props.currentKnowledgeHub.sections || []).map((section) => ({
    value: section.key,
    label: section.label
  }))
)
const activeMarkdownSection = ref('all')
const knowledgeEntryPage = ref(1)
const markdownSectionTabs = computed(() => buildMarkdownSectionTabs(props.currentKnowledgeMarkdown))
const markdownSectionTabItems = computed(() =>
  markdownSectionTabs.value.map((section) => ({
    value: section.value,
    label: section.label
  }))
)
const selectedMarkdownContent = computed(() =>
  markdownSectionTabs.value.find((section) => section.value === activeMarkdownSection.value)?.content
    || markdownSectionTabs.value[0]?.content
    || ''
)
const selectedKnowledgePrototypeScreenLiveUrl = computed(() =>
  props.selectedKnowledgePrototypeScreen?.url
    || props.selectedKnowledgePrototypeScreen?.sourceUrl
    || props.selectedKnowledgePrototypeScreen?.targetUrl
    || props.selectedKnowledgePrototypePage?.url
    || ''
)
const knowledgeFlowImagePreview = ref(null)
const knowledgeFlowMode = ref('canvas')
const selectedKnowledgeFlowStructureNodeId = ref('')
const selectedKnowledgeWorkflowNodeId = ref('')
const knowledgeWorkflowDraftNodes = ref([])
const knowledgeWorkflowNodeOverrides = ref({})
const knowledgeWorkflowDeletedNodeIds = ref(new Set())
const knowledgeWorkflowDragState = ref(null)
const expandedKnowledgeFlowStructureNodeIds = ref(new Set())
const knowledgeFrameworkViewportRef = ref(null)
const knowledgeFrameworkMapRef = ref(null)
const knowledgeFrameworkConnectorPaths = ref([])
const knowledgeFrameworkConnectorSize = ref({ width: 1, height: 1 })
let knowledgeFrameworkResizeObserver = null
let knowledgeFrameworkConnectorFrame = 0
const knowledgeEntryItems = computed(() => props.currentKnowledgeHub.entries?.items || [])
const knowledgeEntryPagination = computed(() => {
  const total = knowledgeEntryItems.value.length
  const totalPages = Math.max(1, Math.ceil(total / KNOWLEDGE_ENTRY_PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, knowledgeEntryPage.value), totalPages)
  const startIndex = (currentPage - 1) * KNOWLEDGE_ENTRY_PAGE_SIZE
  const endIndex = Math.min(total, startIndex + KNOWLEDGE_ENTRY_PAGE_SIZE)
  return {
    total,
    totalPages,
    startIndex,
    endIndex,
    start: total ? startIndex + 1 : 0,
    end: endIndex
  }
})
const paginatedKnowledgeEntryRows = computed(() =>
  knowledgeEntryItems.value.slice(
    knowledgeEntryPagination.value.startIndex,
    knowledgeEntryPagination.value.endIndex
  )
)
const knowledgeFrameworkRootTitle = computed(() =>
  props.projectName || props.currentKnowledgeHub.overview?.projectName || props.currentKnowledgeHub.blueprint?.title || '当前项目'
)
const knowledgeFrameworkBranches = computed(() => {
  const roots = valueList(props.currentKnowledgeBlueprintWorkbench.frameTree?.children || [])
  const visibleNodes = props.visibleKnowledgeStructureNodes || []
  return roots.map((branch, index) => {
    const startIndex = visibleNodes.findIndex((node) => node.id === branch.id)
    const nextRootIndex = startIndex >= 0
      ? visibleNodes.findIndex((node, nodeIndex) => nodeIndex > startIndex && Number(node.depth || 0) === 0)
      : -1
    const visibleBranchNodes = startIndex >= 0
      ? visibleNodes.slice(startIndex, nextRootIndex >= 0 ? nextRootIndex : visibleNodes.length)
      : [branch]
    return {
      ...branch,
      mapIndex: index,
      childNodes: visibleBranchNodes.slice(1)
    }
  })
})
const knowledgeFrameworkConnectorLinks = computed(() => {
  const links = []
  knowledgeFrameworkBranches.value.forEach((branch) => {
    if (!branch?.id) return
    links.push({
      id: `framework-root-${branch.id}`,
      fromId: '__root',
      toId: branch.id
    })
    const depthStack = new Map([[0, branch]])
    ;(branch.childNodes || []).forEach((node) => {
      if (!node?.id) return
      const depth = Math.max(1, Number(node.depth || 1))
      const parent = depthStack.get(depth - 1) || branch
      if (parent?.id && parent.id !== node.id) {
        links.push({
          id: `framework-${parent.id}-${node.id}`,
          fromId: parent.id,
          toId: node.id
        })
      }
      depthStack.set(depth, node)
      Array.from(depthStack.keys())
        .filter((key) => key > depth)
        .forEach((key) => depthStack.delete(key))
    })
  })
  return links
})
function knowledgeFrameworkBranchColumns(branch = {}) {
  // Contract: every deeper framework depth opens a new column to the right, not an indented row in the same column.
  const columns = new Map()
  ;(branch.childNodes || []).forEach((node) => {
    const depth = Math.max(1, Number(node.depth || 1))
    if (!columns.has(depth)) columns.set(depth, [])
    columns.get(depth).push(node)
  })
  return Array.from(columns.entries()).map(([depth, nodes]) => ({ depth, nodes }))
}
const rawKnowledgeFlowStructureNodes = computed(() => {
  const sourceFlowRoots = props.knowledgePrototypeFlowTree.roots || []
  return sourceFlowRoots.length ? sourceFlowRoots : (props.visibleKnowledgeStructureNodes || [])
})
const knowledgeFlowRootStructureTree = computed(() =>
  normalizeKnowledgeFlowRootStructureNodes(rawKnowledgeFlowStructureNodes.value)
)
const knowledgeFlowStructureNodes = computed(() =>
  flattenExpandedKnowledgeFlowTreeNodes(knowledgeFlowRootStructureTree.value)
)
const selectedKnowledgeFlowStructureNode = computed(() =>
  findKnowledgeFlowStructureNodeById(knowledgeFlowRootStructureTree.value, selectedKnowledgeFlowStructureNodeId.value)
)
const knowledgeFlowCanvasPages = computed(() => {
  const selectedNode = selectedKnowledgeFlowStructureNode.value
  const selectedScreenIds = collectKnowledgeFlowNodeScreenIds(selectedNode)
  const selectedFlowIds = collectKnowledgeFlowNodeFlowIds(selectedNode)
  const flows = props.knowledgePrototypeFlowTree.flows || []
  const matchedFlow = selectedNode ? findKnowledgeFlowForStructureNode(selectedNode) : null
  if (matchedFlow?.id) selectedFlowIds.add(normalizeMatchValue(matchedFlow.id))
  flows
    .filter((flow) => selectedFlowIds.has(normalizeMatchValue(flow.id)))
    .forEach((flow) => {
      ;(flow.screenIds || []).forEach((screenId) => selectedScreenIds.add(normalizeMatchValue(screenId)))
      ;(flow.steps || []).forEach((step) => {
        selectedScreenIds.add(normalizeMatchValue(step.from))
        selectedScreenIds.add(normalizeMatchValue(step.to))
      })
    })
  if (!selectedScreenIds.size && props.selectedKnowledgeFlow?.id) {
    ;(props.selectedKnowledgeFlow.screenIds || []).forEach((screenId) => selectedScreenIds.add(normalizeMatchValue(screenId)))
    ;(props.selectedKnowledgeFlow.steps || []).forEach((step) => {
      selectedScreenIds.add(normalizeMatchValue(step.from))
      selectedScreenIds.add(normalizeMatchValue(step.to))
    })
  }
  const filteredPages = selectedScreenIds.size
    ? props.knowledgePrototypePages.filter((page) => knowledgeFlowPageMatchesScreenIds(page, selectedScreenIds))
    : []
  return filteredPages.length ? filteredPages : props.knowledgePrototypePages
})
const knowledgeWorkflowCanvasNodes = computed(() => {
  const pageNodes = knowledgeFlowCanvasPages.value
    .filter((page) => page.id && !knowledgeWorkflowDeletedNodeIds.value.has(page.id))
    .map((page, index) => {
      const override = knowledgeWorkflowNodeOverrides.value[page.id] || {}
      const autoLayoutPosition = getKnowledgeWorkflowAutoLayoutPosition(index)
      return {
        id: page.id,
        kind: 'page',
        page,
        index,
        x: override.isManualPosition && Number.isFinite(Number(override.x)) ? Number(override.x) : autoLayoutPosition.x,
        y: override.isManualPosition && Number.isFinite(Number(override.y)) ? Number(override.y) : autoLayoutPosition.y,
        width: KNOWLEDGE_WORKFLOW_NODE_WIDTH,
        height: KNOWLEDGE_WORKFLOW_NODE_HEIGHT,
        title: override.title || page.title,
        summary: page.summary || '暂无页面说明',
        imageUrl: override.imageUrl || page.screenshotUrl || ''
      }
    })
  const draftNodes = knowledgeWorkflowDraftNodes.value
    .filter((node) => node.id && !knowledgeWorkflowDeletedNodeIds.value.has(node.id))
    .map((node) => {
      const override = knowledgeWorkflowNodeOverrides.value[node.id] || {}
      return {
        ...node,
        x: Number.isFinite(Number(override.x)) ? Number(override.x) : node.x,
        y: Number.isFinite(Number(override.y)) ? Number(override.y) : node.y,
        title: override.title || node.title,
        imageUrl: override.imageUrl || node.imageUrl || ''
      }
    })
  return [
    ...pageNodes,
    ...draftNodes
  ]
})
const knowledgeWorkflowNodeMap = computed(() =>
  new Map(knowledgeWorkflowCanvasNodes.value.map((node) => [node.id, node]))
)
const knowledgeWorkflowCanvasEdges = computed(() => {
  const visiblePageNodes = knowledgeWorkflowCanvasNodes.value.filter((node) => node.kind === 'page')
  const pageEdges = visiblePageNodes.slice(0, -1).map((node, index) => ({
    id: `knowledge-flow-edge-${node.id}-${visiblePageNodes[index + 1]?.id}`,
    from: node.id,
    to: visiblePageNodes[index + 1]?.id,
    active: props.selectedKnowledgePrototypeScreen?.id === node.id || props.selectedKnowledgePrototypeScreen?.id === visiblePageNodes[index + 1]?.id
  })).filter((edge) => edge.from && edge.to)
  const draftEdges = knowledgeWorkflowCanvasNodes.value.filter((node) => node.kind === 'draft').map((node) => ({
    id: `knowledge-flow-draft-edge-${node.anchorId}-${node.id}`,
    from: node.anchorId,
    to: node.id,
    direction: node.direction,
    active: selectedKnowledgeWorkflowNodeId.value === node.id || selectedKnowledgeWorkflowNodeId.value === node.anchorId
  })).filter((edge) => knowledgeWorkflowNodeMap.value.has(edge.from) && knowledgeWorkflowNodeMap.value.has(edge.to))
  return [...pageEdges, ...draftEdges]
})
function knowledgePrototypeUploadStatus(pageId = '') {
  return props.knowledgePrototypeUploadStates?.[pageId] || { status: '', message: '' }
}
function clampPercent(value, fallback = 0) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(0, Math.min(100, numericValue))
}
function getKnowledgeHotspotStyle(rect = {}) {
  const left = clampPercent(rect.x)
  const top = clampPercent(rect.y)
  const width = Math.max(0, Math.min(clampPercent(rect.width, 8), 100 - left))
  const height = Math.max(0, Math.min(clampPercent(rect.height, 8), 100 - top))
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`
  }
}
function getPrototypeViewportStyle(screen = {}) {
  const viewport = screen.viewport || screen.meta?.viewport || screen.screenshot?.viewport || {}
  const width = Number(viewport.width || screen.width || screen.screenshotWidth)
  const height = Number(viewport.height || screen.height || screen.screenshotHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {}
  }
  return {
    '--prototype-aspect-ratio': `${width} / ${height}`
  }
}
function flowPathLabel(flow = {}) {
  const path = (flow.hierarchy || []).slice(0, -1).filter(Boolean)
  return path.length ? path.join(' / ') : flow.source || 'project'
}
function normalizeMatchValue(value = '') {
  return String(value || '').trim().toLowerCase()
}
function valueList(input = []) {
  return Array.isArray(input) ? input : [input]
}
function getKnowledgeWorkflowAutoLayoutPosition(index = 0) {
  const row = Math.floor(index / KNOWLEDGE_WORKFLOW_COLUMNS)
  const column = index % KNOWLEDGE_WORKFLOW_COLUMNS
  return {
    x: KNOWLEDGE_WORKFLOW_ORIGIN_X + column * KNOWLEDGE_WORKFLOW_NODE_GAP_X,
    y: KNOWLEDGE_WORKFLOW_ORIGIN_Y + row * KNOWLEDGE_WORKFLOW_NODE_GAP_Y
  }
}
function normalizeKnowledgeFlowRootStructureNodes(nodes = [], depth = 0) {
  return valueList(nodes).map((node, index) => {
    const title = String(node.title || node.name || `未命名页面 ${index + 1}`).trim()
    const id = node.id || `knowledge-flow-level-${depth}-${index}-${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-')}`
    return {
      ...node,
      id,
      title,
      depth,
      visualDepth: Math.min(3, Math.max(0, depth)),
      kind: node.kind || 'flow-hierarchy',
      children: normalizeKnowledgeFlowRootStructureNodes(node.children || [], depth + 1)
    }
  })
}
function isKnowledgeFlowTreeNodeExpanded(node = {}) {
  return expandedKnowledgeFlowStructureNodeIds.value.has(node.id)
}
function toggleKnowledgeFlowStructureNode(node = {}) {
  if (!node.id || !node.children?.length) return
  const nextExpandedIds = new Set(expandedKnowledgeFlowStructureNodeIds.value)
  if (nextExpandedIds.has(node.id)) nextExpandedIds.delete(node.id)
  else nextExpandedIds.add(node.id)
  expandedKnowledgeFlowStructureNodeIds.value = nextExpandedIds
}
function flattenExpandedKnowledgeFlowTreeNodes(nodes = [], depth = 0) {
  return valueList(nodes).flatMap((node) => {
    const current = {
      ...node,
      depth,
      visualDepth: Math.min(3, Math.max(0, depth)),
      children: valueList(node.children)
    }
    if (!current.children.length || !isKnowledgeFlowTreeNodeExpanded(current)) return [current]
    return [
      current,
      ...flattenExpandedKnowledgeFlowTreeNodes(current.children, depth + 1)
    ]
  })
}
function findKnowledgeFlowStructureNodeById(nodes = [], nodeId = '') {
  if (!nodeId) return null
  for (const node of valueList(nodes)) {
    if (node.id === nodeId) return node
    const childMatch = findKnowledgeFlowStructureNodeById(node.children || [], nodeId)
    if (childMatch) return childMatch
  }
  return null
}
function collectKnowledgeFlowNodeScreenIds(node = {}, bucket = new Set()) {
  if (!node) return bucket
  ;[
    node.id,
    node.pageId,
    node.page?.id,
    ...(node.screenIds || []),
    ...valueList(node.detail?.relatedPages).flatMap((page) => (
      typeof page === 'string' ? [page] : [page?.id, page?.title, page?.url]
    ))
  ].forEach((value) => {
    const normalizedValue = normalizeMatchValue(value)
    if (normalizedValue) bucket.add(normalizedValue)
  })
  valueList(node.children).forEach((child) => collectKnowledgeFlowNodeScreenIds(child, bucket))
  return bucket
}
function collectKnowledgeFlowNodeFlowIds(node = {}, bucket = new Set()) {
  if (!node) return bucket
  ;(node.flowIds || []).forEach((flowId) => {
    const normalizedValue = normalizeMatchValue(flowId)
    if (normalizedValue) bucket.add(normalizedValue)
  })
  valueList(node.children).forEach((child) => collectKnowledgeFlowNodeFlowIds(child, bucket))
  return bucket
}
function knowledgeFlowPageMatchesScreenIds(page = {}, screenIds = new Set()) {
  return [
    page.id,
    page.nodeId,
    page.screenId,
    page.route,
    page.url,
    page.title
  ].map(normalizeMatchValue).filter(Boolean).some((value) => screenIds.has(value))
}
function flowMatchesStructureNode(flow = {}, node = {}) {
  const nodeValues = [
    node.id,
    node.title,
    node.meta,
    node.page?.id,
    node.page?.title,
    node.pageId,
    node.route,
    node.url,
    ...valueList(node.detail?.relatedPages).flatMap((page) => (
      typeof page === 'string' ? [page] : [page?.id, page?.title, page?.url]
    ))
  ].map(normalizeMatchValue).filter(Boolean)
  const flowValues = [
    flow.id,
    flow.title,
    flowPathLabel(flow),
    ...(flow.hierarchy || []),
    ...(flow.screenIds || []),
    ...(flow.steps || []).flatMap((step) => [step.from, step.to, step.fromTitle, step.toTitle, step.actionLabel])
  ].map(normalizeMatchValue).filter(Boolean)
  if (!nodeValues.length || !flowValues.length) return false
  if (nodeValues.some((value) => flowValues.includes(value))) return true
  const titleValue = normalizeMatchValue(node.title)
  return titleValue.length > 1 && flowValues.some((value) => value.includes(titleValue))
}
function findKnowledgeFlowForStructureNode(node = {}) {
  const flows = props.knowledgePrototypeFlowTree.flows || []
  if (!flows.length) return null
  if (node.flowIds?.length) {
    return flows.find((flow) => flow.id === node.flowIds[0]) || null
  }
  const nodeScreenIds = new Set([
    node.id,
    node.page?.id,
    node.pageId
  ].map(normalizeMatchValue).filter(Boolean))
  return flows.find((flow) => (flow.screenIds || []).some((screenId) => nodeScreenIds.has(normalizeMatchValue(screenId))))
    || flows.find((flow) => flowMatchesStructureNode(flow, node))
    || null
}
function isKnowledgeFlowStructureNodeCurrent(node = {}) {
  return Boolean(node.id && selectedKnowledgeFlowStructureNodeId.value === node.id)
}
function isKnowledgeFlowStructureNodeRelated(node = {}) {
  if (isKnowledgeFlowStructureNodeCurrent(node)) return false
  if (node.flowIds?.includes(props.selectedKnowledgeFlow?.id)) return true
  const matchedFlow = findKnowledgeFlowForStructureNode(node)
  return Boolean(matchedFlow && props.selectedKnowledgeFlow?.id === matchedFlow.id)
}
function selectKnowledgeFlowStructureNode(node = {}) {
  if (node.id) selectedKnowledgeFlowStructureNodeId.value = node.id
  if (node.children?.length) toggleKnowledgeFlowStructureNode(node)
  if (node.id && !node.flowIds?.length) emit('select-knowledge-structure-node', node.id)
  const matchedFlow = findKnowledgeFlowForStructureNode(node)
  if (matchedFlow?.id) emit('select-knowledge-flow', matchedFlow.id)
}
function setKnowledgeFlowMode(mode = 'canvas') {
  knowledgeFlowMode.value = mode === 'workflow' ? 'workflow' : 'canvas'
  if (knowledgeFlowMode.value === 'workflow' && !selectedKnowledgeWorkflowNodeId.value) {
    selectedKnowledgeWorkflowNodeId.value = props.selectedKnowledgePrototypeScreen?.id || props.knowledgePrototypePages[0]?.id || ''
  }
}
function directionLabel(direction = '') {
  return {
    top: '上方',
    right: '右侧',
    bottom: '下方',
    left: '左侧'
  }[direction] || '旁侧'
}
function selectKnowledgeWorkflowNode(nodeId = '') {
  selectedKnowledgeWorkflowNodeId.value = nodeId
}
function handleKnowledgeWorkflowNodeClick(node = {}) {
  if (node.kind === 'page' && node.page?.id) {
    emit('select-knowledge-prototype-screen', node.page.id)
  }
  if (knowledgeFlowMode.value === 'workflow') selectKnowledgeWorkflowNode(node.id)
}
function addKnowledgeWorkflowDraftNode(anchor = {}, direction = 'right') {
  const anchorNode = knowledgeWorkflowNodeMap.value.get(anchor.id) || anchor
  const anchorTitle = anchorNode.title || anchorNode.page?.title || anchorNode.anchorTitle || '当前流程节点'
  const offset = {
    top: { x: 0, y: -KNOWLEDGE_WORKFLOW_NODE_GAP_Y },
    right: { x: KNOWLEDGE_WORKFLOW_NODE_GAP_X, y: 0 },
    bottom: { x: 0, y: KNOWLEDGE_WORKFLOW_NODE_GAP_Y },
    left: { x: -KNOWLEDGE_WORKFLOW_NODE_GAP_X, y: 0 }
  }[direction] || { x: KNOWLEDGE_WORKFLOW_NODE_GAP_X, y: 0 }
  const sameAnchorCount = knowledgeWorkflowDraftNodes.value.filter((node) => node.anchorId === anchorNode.id && node.direction === direction).length
  const id = `knowledge-workflow-draft-${Date.now()}-${knowledgeWorkflowDraftNodes.value.length + 1}`
  knowledgeWorkflowDraftNodes.value.push({
    id,
    kind: 'draft',
    direction,
    anchorId: anchorNode.id || '',
    anchorTitle,
    x: Math.max(40, Math.min(KNOWLEDGE_WORKFLOW_CANVAS_WIDTH - KNOWLEDGE_WORKFLOW_NODE_WIDTH - 40, Number(anchorNode.x || 0) + offset.x + sameAnchorCount * 36)),
    y: Math.max(40, Math.min(KNOWLEDGE_WORKFLOW_CANVAS_HEIGHT - KNOWLEDGE_WORKFLOW_NODE_HEIGHT - 40, Number(anchorNode.y || 0) + offset.y + sameAnchorCount * 36)),
    width: KNOWLEDGE_WORKFLOW_NODE_WIDTH,
    height: KNOWLEDGE_WORKFLOW_NODE_HEIGHT,
    title: `${directionLabel(direction)}流程节点`,
    imageUrl: '',
    summary: `从「${anchorTitle}」${directionLabel(direction)}添加，可继续补充页面、动作和节点说明。`
  })
  selectedKnowledgeWorkflowNodeId.value = id
}
function updateKnowledgeWorkflowNodeOverride(nodeId = '', patch = {}) {
  if (!nodeId) return
  knowledgeWorkflowNodeOverrides.value = {
    ...knowledgeWorkflowNodeOverrides.value,
    [nodeId]: {
      ...(knowledgeWorkflowNodeOverrides.value[nodeId] || {}),
      ...patch
    }
  }
}
function updateKnowledgeWorkflowNodeTitle(node = {}, title = '') {
  const nextTitle = String(title || '').trimStart()
  updateKnowledgeWorkflowNodeOverride(node.id, {
    title: nextTitle || (node.kind === 'draft' ? '新流程节点' : node.page?.title || '未命名页面')
  })
}
function knowledgeWorkflowNodeImageUrl(node = {}) {
  return node.imageUrl || node.page?.screenshotUrl || ''
}
function handleKnowledgeWorkflowImageUpload(node = {}, event) {
  const file = event?.target?.files?.[0]
  if (!file || !file.type?.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result || '')
    if (node.kind === 'page' && node.page?.id) {
      emit('upload-knowledge-prototype-screenshot', node.page, { dataUrl, fileName: file.name || '' })
      if (event?.target) event.target.value = ''
      return
    }
    updateKnowledgeWorkflowNodeOverride(node.id, { imageUrl: dataUrl })
    if (node.kind === 'draft' && node.id) {
      emit('upload-knowledge-prototype-screenshot', { id: node.id, title: node.title || '新流程节点', actions: [], summary: node.summary || '' }, { dataUrl, fileName: file.name || '' })
    }
    if (event?.target) event.target.value = ''
  }
  reader.readAsDataURL(file)
}
function moveKnowledgeWorkflowNode(nodeId = '', nextX = 0, nextY = 0) {
  if (!nodeId) return
  const x = Math.max(40, Math.min(KNOWLEDGE_WORKFLOW_CANVAS_WIDTH - KNOWLEDGE_WORKFLOW_NODE_WIDTH - 40, Number(nextX || 0)))
  const y = Math.max(40, Math.min(KNOWLEDGE_WORKFLOW_CANVAS_HEIGHT - KNOWLEDGE_WORKFLOW_NODE_HEIGHT - 40, Number(nextY || 0)))
  updateKnowledgeWorkflowNodeOverride(nodeId, { x, y, isManualPosition: true })
  knowledgeWorkflowDraftNodes.value = knowledgeWorkflowDraftNodes.value.map((node) => (
    node.id === nodeId ? { ...node, x, y } : node
  ))
}
function collectKnowledgeWorkflowDraftDescendants(anchorId = '', bucket = new Set()) {
  knowledgeWorkflowDraftNodes.value
    .filter((node) => node.anchorId === anchorId)
    .forEach((node) => {
      if (bucket.has(node.id)) return
      bucket.add(node.id)
      collectKnowledgeWorkflowDraftDescendants(node.id, bucket)
    })
  return bucket
}
function deleteKnowledgeWorkflowNode(node = {}) {
  if (!node.id) return
  const nextDeletedNodeIds = new Set(knowledgeWorkflowDeletedNodeIds.value)
  nextDeletedNodeIds.add(node.id)
  collectKnowledgeWorkflowDraftDescendants(node.id, nextDeletedNodeIds)
  knowledgeWorkflowDeletedNodeIds.value = nextDeletedNodeIds
  knowledgeWorkflowDraftNodes.value = knowledgeWorkflowDraftNodes.value.filter((draftNode) => !nextDeletedNodeIds.has(draftNode.id))
  if (nextDeletedNodeIds.has(selectedKnowledgeWorkflowNodeId.value)) {
    selectedKnowledgeWorkflowNodeId.value = ''
  }
}
function isKnowledgeWorkflowDragBlocked(target) {
  return Boolean(target?.closest?.('button, input, label, textarea, select, a'))
}
function startKnowledgeWorkflowNodeDrag(event, node = {}) {
  if (knowledgeFlowMode.value !== 'workflow' || event.button !== 0 || isKnowledgeWorkflowDragBlocked(event.target)) return
  event.preventDefault()
  selectKnowledgeWorkflowNode(node.id)
  knowledgeWorkflowDragState.value = {
    nodeId: node.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: Number(node.x || 0),
    startY: Number(node.y || 0)
  }
  window.addEventListener('pointermove', handleKnowledgeWorkflowNodeDrag)
  window.addEventListener('pointerup', stopKnowledgeWorkflowNodeDrag, { once: true })
}
function handleKnowledgeWorkflowNodeDrag(event) {
  const state = knowledgeWorkflowDragState.value
  if (!state?.nodeId) return
  const zoom = Math.max(0.2, Number(props.knowledgeCanvasZoom || 1))
  const nextX = state.startX + (event.clientX - state.startClientX) / zoom
  const nextY = state.startY + (event.clientY - state.startClientY) / zoom
  moveKnowledgeWorkflowNode(state.nodeId, nextX, nextY)
}
function stopKnowledgeWorkflowNodeDrag() {
  window.removeEventListener('pointermove', handleKnowledgeWorkflowNodeDrag)
  knowledgeWorkflowDragState.value = null
}
function getKnowledgeWorkflowNodeStyle(node = {}) {
  return {
    left: `${Number(node.x || 0)}px`,
    top: `${Number(node.y || 0)}px`,
    width: `${Number(node.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH)}px`,
    minHeight: `${Number(node.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT)}px`
  }
}
function knowledgeWorkflowEdgePath(edge = {}) {
  const fromNode = knowledgeWorkflowNodeMap.value.get(edge.from)
  const toNode = knowledgeWorkflowNodeMap.value.get(edge.to)
  if (!fromNode || !toNode) return ''
  if (edge.direction === 'left') {
    const fromX = Number(fromNode.x || 0)
    const fromY = Number(fromNode.y || 0) + Number(fromNode.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT) / 2
    const toX = Number(toNode.x || 0) + Number(toNode.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH)
    const toY = Number(toNode.y || 0) + Number(toNode.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT) / 2
    const midX = fromX + (toX - fromX) / 2
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
  }
  if (edge.direction === 'top') {
    const fromX = Number(fromNode.x || 0) + Number(fromNode.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH) / 2
    const fromY = Number(fromNode.y || 0)
    const toX = Number(toNode.x || 0) + Number(toNode.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH) / 2
    const toY = Number(toNode.y || 0) + Number(toNode.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT)
    const midY = fromY + (toY - fromY) / 2
    return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`
  }
  const fromX = Number(fromNode.x || 0) + Number(fromNode.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH)
  const fromY = Number(fromNode.y || 0) + Number(fromNode.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT) / 2
  const toX = Number(toNode.x || 0)
  const toY = Number(toNode.y || 0) + Number(toNode.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT) / 2
  const midX = fromX + (toX - fromX) / 2
  if (Math.abs(toX - fromX) >= Math.abs(toY - fromY)) {
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
  }
  const fromCenterX = Number(fromNode.x || 0) + Number(fromNode.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH) / 2
  const toCenterX = Number(toNode.x || 0) + Number(toNode.width || KNOWLEDGE_WORKFLOW_NODE_WIDTH) / 2
  const fromBottomY = Number(fromNode.y || 0) + Number(fromNode.height || KNOWLEDGE_WORKFLOW_NODE_HEIGHT)
  const toTopY = Number(toNode.y || 0)
  const midY = fromBottomY + (toTopY - fromBottomY) / 2
  return `M ${fromCenterX} ${fromBottomY} C ${fromCenterX} ${midY}, ${toCenterX} ${midY}, ${toCenterX} ${toTopY}`
}
function handleKnowledgeCanvasWheel(event) {
  if (!event.ctrlKey && !event.metaKey && !event.deltaZ) return
  event.preventDefault()
  const rawDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  const zoomDelta = Math.max(-0.18, Math.min(0.18, -rawDelta / 500))
  if (!zoomDelta) return
  emit('adjust-knowledge-canvas-zoom', zoomDelta)
}
function handleKnowledgeCanvasKeydown(event) {
  if (!event.ctrlKey && !event.metaKey) return
  if (event.key === '=' || event.key === '+') {
    event.preventDefault()
    emit('adjust-knowledge-canvas-zoom', 0.1)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    emit('adjust-knowledge-canvas-zoom', -0.1)
  } else if (event.key === '0') {
    event.preventDefault()
    emit('update-knowledge-canvas-zoom', 1)
  }
}
function scheduleKnowledgeFrameworkConnectorUpdate() {
  if (knowledgeFrameworkConnectorFrame) cancelAnimationFrame(knowledgeFrameworkConnectorFrame)
  knowledgeFrameworkConnectorFrame = requestAnimationFrame(() => {
    knowledgeFrameworkConnectorFrame = 0
    updateKnowledgeFrameworkConnectors()
  })
}
// Contract: framework overview connectors use measured node edges, because fixed CSS lines drift across zoom and expanded depth columns.
function updateKnowledgeFrameworkConnectors() {
  const mapElement = knowledgeFrameworkMapRef.value
  if (!mapElement || props.knowledgeHubSection !== 'structure') {
    knowledgeFrameworkConnectorPaths.value = []
    return
  }
  const zoom = Number(props.knowledgeCanvasZoom) || 1
  const mapRect = mapElement.getBoundingClientRect()
  const nodeElements = new Map(
    Array.from(mapElement.querySelectorAll('[data-framework-node-id]')).map((element) => [
      element.dataset.frameworkNodeId,
      element
    ])
  )
  const nodeRects = new Map()
  nodeElements.forEach((element, id) => {
    const rect = element.getBoundingClientRect()
    nodeRects.set(id, {
      left: (rect.left - mapRect.left) / zoom,
      right: (rect.right - mapRect.left) / zoom,
      top: (rect.top - mapRect.top) / zoom,
      height: rect.height / zoom
    })
  })
  knowledgeFrameworkConnectorSize.value = {
    width: Math.max(1, Math.ceil(mapElement.scrollWidth)),
    height: Math.max(1, Math.ceil(mapElement.scrollHeight))
  }
  knowledgeFrameworkConnectorPaths.value = knowledgeFrameworkConnectorLinks.value
    .map((link) => {
      const fromRect = nodeRects.get(link.fromId)
      const toRect = nodeRects.get(link.toId)
      if (!fromRect || !toRect) return null
      return {
        ...link,
        fromX: fromRect.right,
        fromY: fromRect.top + fromRect.height / 2,
        toX: toRect.left,
        toY: toRect.top + toRect.height / 2
      }
    })
    .filter(Boolean)
}
function knowledgeFrameworkConnectorPathD(connector) {
  const middleX = connector.fromX + Math.max(24, (connector.toX - connector.fromX) / 2)
  return `M ${connector.fromX} ${connector.fromY} C ${middleX} ${connector.fromY}, ${middleX} ${connector.toY}, ${connector.toX} ${connector.toY}`
}
function openKnowledgeFlowImagePreview(page = {}) {
  if (!page?.screenshotUrl) return
  knowledgeFlowImagePreview.value = page
}
function closeKnowledgeFlowImagePreview() {
  knowledgeFlowImagePreview.value = null
}
function setKnowledgeEntryPage(page = 1) {
  const totalPages = knowledgeEntryPagination.value.totalPages
  knowledgeEntryPage.value = Math.min(Math.max(1, Number(page) || 1), totalPages)
}

watch(markdownSectionTabs, (tabs) => {
  if (!tabs.some((section) => section.value === activeMarkdownSection.value)) {
    activeMarkdownSection.value = tabs[0]?.value || 'all'
  }
})

watch(knowledgeEntryItems, () => {
  setKnowledgeEntryPage(knowledgeEntryPage.value)
})

watch(
  () => [
    props.knowledgeHubSection,
    props.knowledgeCanvasZoom,
    props.visibleKnowledgeStructureNodes.length,
    knowledgeFrameworkBranches.value.length,
    knowledgeFrameworkConnectorLinks.value.length
  ],
  () => nextTick(scheduleKnowledgeFrameworkConnectorUpdate),
  { flush: 'post' }
)

onMounted(() => {
  nextTick(() => {
    if (knowledgeFrameworkMapRef.value && typeof ResizeObserver !== 'undefined') {
      knowledgeFrameworkResizeObserver = new ResizeObserver(scheduleKnowledgeFrameworkConnectorUpdate)
      knowledgeFrameworkResizeObserver.observe(knowledgeFrameworkMapRef.value)
    }
    knowledgeFrameworkViewportRef.value?.addEventListener('scroll', scheduleKnowledgeFrameworkConnectorUpdate, { passive: true })
    scheduleKnowledgeFrameworkConnectorUpdate()
  })
})

onBeforeUnmount(() => {
  stopKnowledgeWorkflowNodeDrag()
  knowledgeFrameworkViewportRef.value?.removeEventListener('scroll', scheduleKnowledgeFrameworkConnectorUpdate)
  knowledgeFrameworkResizeObserver?.disconnect()
  if (knowledgeFrameworkConnectorFrame) cancelAnimationFrame(knowledgeFrameworkConnectorFrame)
})

const emit = defineEmits([
  'open-material-tool',
  'toggle-material-batch-mode',
  'open-material-create',
  'update-knowledge-hub-section',
  'import-material-files',
  'adjust-knowledge-canvas-zoom',
  'update-knowledge-canvas-zoom',
  'expand-all-knowledge-nodes',
  'collapse-knowledge-nodes',
  'select-knowledge-structure-node',
  'toggle-knowledge-node',
  'open-knowledge-node-detail',
  'select-knowledge-flow',
  'select-knowledge-prototype-screen',
  'upload-knowledge-prototype-screenshot',
  'switch-to-factory-from-knowledge-demo',
  'trigger-knowledge-prototype-hotspot',
  'open-knowledge-entry-detail',
  'download-markdown'
])
</script>
