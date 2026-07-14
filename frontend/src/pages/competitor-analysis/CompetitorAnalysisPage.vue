<template>
  <section class="competitor-analysis-page">
    <div class="competitor-analysis-toolbar">
      <div class="competitor-analysis-tab-stack">
        <BaseTabs
          v-model="activePrimaryTab"
          class="competitor-analysis-primary-tabs"
          :items="primaryTabs"
          label="竞品分析一级分类"
          @change="setActivePrimaryTab"
        />
        <div v-if="activePrimaryTab === 'monitor'" class="competitor-analysis-secondary-tabs">
          <BaseSecondaryTabs
            v-model="activeKind"
            :items="monitorTabs"
            label="竞品监控二级分类"
            @change="setActiveKind"
          />
        </div>
      </div>
      <div class="competitor-analysis-actions">
        <BaseButton type="button" @click="openCreateDialog">
          <template #icon><Plus class="competitor-analysis-button-icon" aria-hidden="true" /></template>
          新增竞品
        </BaseButton>
        <BaseButton variant="primary" type="button" @click="openAnalysisDialog">
          <template #icon><Play class="competitor-analysis-button-icon" aria-hidden="true" /></template>
          开始分析
        </BaseButton>
      </div>
    </div>

    <section class="competitor-analysis-filter-bar" aria-label="竞品分析筛选">
      <div class="competitor-analysis-filter-left">
        <ElSelect v-model="listFilters.competitor" class="competitor-analysis-filter-field competitor-analysis-filter-select" popper-class="competitor-analysis-filter-popper" aria-label="筛选竞品">
          <ElOption label="竞品" value="all" />
          <ElOption v-for="item in competitorFilterOptions" :key="`filter-competitor-${item}`" :label="item" :value="item" />
        </ElSelect>
        <ElSelect v-model="listFilters.status" class="competitor-analysis-filter-field competitor-analysis-filter-select" popper-class="competitor-analysis-filter-popper" aria-label="筛选状态">
          <ElOption v-for="item in statusFilterOptions" :key="`filter-status-${item.value}`" :label="item.label.replace('状态：', '')" :value="item.value" />
        </ElSelect>
      </div>
      <div class="competitor-analysis-filter-right">
        <ElInput
          v-model="listFilters.query"
          class="competitor-analysis-filter-search"
          placeholder="搜索报告、竞品、功能或目标"
          clearable
          @keyup.enter="noop"
        >
          <template #prefix>
            <Search class="competitor-analysis-search-icon" aria-hidden="true" />
          </template>
        </ElInput>
      </div>
    </section>

    <section v-if="activeKind === 'competitors'" class="competitor-analysis-competitor-table-section">
      <BaseDataTable v-if="filteredCompetitors.length" class="competitor-analysis-table-wrap" table-class="competitor-analysis-table">
        <thead>
          <tr>
            <th>竞品名称</th>
            <th>官网地址</th>
            <th>来源</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="competitor in filteredCompetitors" :key="competitor.id">
            <td>
              <strong>{{ competitor.name || '未命名竞品' }}</strong>
              <small>{{ competitor.notes || '暂无备注' }}</small>
            </td>
            <td>
              <a v-if="competitor.websiteUrl" :href="competitor.websiteUrl" target="_blank" rel="noreferrer">{{ competitor.websiteUrl }}</a>
              <span v-else>未填写官网</span>
            </td>
            <td>{{ competitorSourceLabel(competitor) }}</td>
            <td>{{ formatTime(competitor.updatedAt || competitor.createdAt) }}</td>
            <td>
              <div class="competitor-analysis-row-actions">
                <BaseButton type="button" class="competitor-analysis-inline-button" @click.stop="openEditCompetitorDialog(competitor)">编辑</BaseButton>
                <BaseButton type="button" class="competitor-analysis-delete-button" @click.stop="deleteCompetitor(competitor)">删除</BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </BaseDataTable>

      <section v-else class="competitor-analysis-empty competitor-analysis-list-empty">
        <FileText class="competitor-analysis-empty-icon" aria-hidden="true" />
        <h4>暂无竞品</h4>
        <p>{{ hasActiveListFilters ? '调整搜索或筛选条件后再查看。' : '点击右上角新增竞品，创建后会在这里展示。' }}</p>
      </section>
    </section>

    <section v-else class="competitor-analysis-list-card">
      <BaseDataTable v-if="filteredRecords.length || hasRunningTasks" class="competitor-analysis-table-wrap" table-class="competitor-analysis-table">
        <thead>
          <tr>
            <th>报告名称</th>
            <th>分析竞品</th>
            <th>功能展示</th>
            <th>状态</th>
            <th>生成时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.id" @click="openRecord(record)">
            <td>
              <strong>{{ record.title || getKindLabel(record.kind) }}</strong>
              <small>{{ getKindLabel(record.kind) }}</small>
            </td>
            <td>{{ recordCompetitorNames(record) }}</td>
            <td>{{ recordFeatureLabel(record) }}</td>
            <td>
              <BaseTag :variant="statusVariant(record.status)">
                {{ record.statusLabel || statusLabel(record.status) }}
              </BaseTag>
            </td>
            <td>{{ formatTime(record.createdAt) }}</td>
            <td>
              <div class="competitor-analysis-row-actions">
                <BaseButton type="button" class="competitor-analysis-inline-button" @click.stop="openRecord(record)">查看</BaseButton>
                <BaseButton type="button" class="competitor-analysis-delete-button" @click.stop="deleteRecord(record)">删除</BaseButton>
              </div>
            </td>
          </tr>
          <tr v-if="hasRunningTasks && !filteredRecords.length">
            <td colspan="6">
              <strong>正在创建分析记录</strong>
              <small>任务已提交，记录会先进入当前列表，后端分析完成后自动更新状态。</small>
            </td>
          </tr>
        </tbody>
      </BaseDataTable>

      <section v-else class="competitor-analysis-empty competitor-analysis-list-empty">
        <FileText class="competitor-analysis-empty-icon" aria-hidden="true" />
        <h4>{{ emptyListTitle }}</h4>
        <p>{{ emptyListMessage }}</p>
      </section>
    </section>

    <div v-if="selectedRecord" class="competitor-analysis-dialog-backdrop competitor-analysis-detail-backdrop" role="presentation" @click.self="closeRecord">
      <section class="competitor-analysis-dialog competitor-analysis-report-dialog" role="dialog" aria-modal="true" aria-label="分析报告详情">
        <header>
          <h3>{{ selectedRecord.title || '分析报告' }}</h3>
          <button type="button" aria-label="关闭弹窗" @click="closeRecord">×</button>
        </header>
      <section class="competitor-analysis-detail-card">
        <section v-if="selectedFeatureEvents.length" class="competitor-analysis-feature-events">
          <h4>新功能事件</h4>
          <BaseDataTable class="competitor-analysis-feature-event-table" table-class="competitor-analysis-table">
            <thead>
              <tr>
                <th>竞品</th>
                <th>功能</th>
                <th>发现时间</th>
                <th>来源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in selectedFeatureEvents" :key="featureEventKey(event)">
                <td>{{ featureEventCompetitorName(event) }}</td>
                <td>{{ featureEventName(event) }}</td>
                <td>{{ formatTime(event.discoveredAt) }}</td>
                <td>{{ featureEventSourceText(event) }}</td>
                <td>
                  <BaseButton type="button" class="competitor-analysis-inline-button" @click.stop="deepAnalyzeFeatureEvent(event)">
                    深度分析
                  </BaseButton>
                </td>
              </tr>
            </tbody>
          </BaseDataTable>
        </section>

        <section v-if="selectedRecord?.kind === 'flow' && hasSelectedInteractionArtifacts" class="competitor-analysis-artifact-panel">
          <article v-if="selectedInteractionArtifacts.documentMarkdown" class="competitor-analysis-artifact-card">
            <div>
              <h4>页面交互框架与说明</h4>
            </div>
            <section class="competitor-analysis-markdown">
              <template v-for="(block, index) in enhancedMarkdownBlocksFor(selectedInteractionArtifacts.documentMarkdown)" :key="markdownBlockKey(block, index)">
                <h1 v-if="block.type === 'heading' && block.level === 1">{{ block.text }}</h1>
                <h2 v-else-if="block.type === 'heading' && block.level === 2">{{ block.text }}</h2>
                <h3 v-else-if="block.type === 'heading'">{{ block.text }}</h3>
                <section v-else-if="block.type === 'flow-table'" class="competitor-analysis-flow-timeline" aria-label="页面流转">
                  <article v-for="(step, stepIndex) in flowRowsForBlock(block)" :key="`${step.id || 'flow'}-${stepIndex}`">
                    <div class="competitor-analysis-flow-main">
                      <span class="competitor-analysis-flow-id">{{ step.id || `S${stepIndex + 1}` }}</span>
                      <strong>{{ step.from || '未标注起点' }}</strong>
                      <span aria-hidden="true">→</span>
                      <strong>{{ step.to || '未标注终点' }}</strong>
                    </div>
                    <dl>
                      <div v-if="step.action">
                        <dt>触发</dt>
                        <dd>{{ step.action }}</dd>
                      </div>
                      <div v-if="step.condition">
                        <dt>条件</dt>
                        <dd>{{ step.condition }}</dd>
                      </div>
                      <div v-if="step.confidence">
                        <dt>证据</dt>
                        <dd>{{ step.confidence }}</dd>
                      </div>
                    </dl>
                  </article>
                </section>
                <section v-else-if="block.type === 'state-machine-table'" class="competitor-analysis-state-board" aria-label="状态机">
                  <article v-for="(transition, transitionIndex) in stateRowsForBlock(block)" :key="`${transition.id || 'state'}-${transitionIndex}`">
                    <div class="competitor-analysis-state-main">
                      <strong>{{ transition.from || '未标注当前状态' }}</strong>
                      <span aria-hidden="true">→</span>
                      <strong>{{ transition.to || '未标注目标状态' }}</strong>
                    </div>
                    <p v-if="transition.condition">{{ transition.condition }}</p>
                    <div class="competitor-analysis-state-tags">
                      <span v-if="transition.id">{{ transition.id }}</span>
                      <span v-if="transition.reversible">可逆：{{ transition.reversible }}</span>
                      <span v-if="transition.evidence">证据：{{ transition.evidence }}</span>
                    </div>
                  </article>
                </section>
                <section v-else-if="block.type === 'page-overview-table'" class="competitor-analysis-page-card-grid" aria-label="页面框架">
                  <article v-for="(page, pageIndex) in pageRowsForBlock(block)" :key="`${page.id || page.name || 'page'}-${pageIndex}`">
                    <header>
                      <span>{{ page.id || `P${pageIndex + 1}` }}</span>
                      <strong>{{ page.name || '未命名页面' }}</strong>
                    </header>
                    <dl>
                      <div v-if="page.type">
                        <dt>类型</dt>
                        <dd>{{ page.type }}</dd>
                      </div>
                      <div v-if="page.purpose">
                        <dt>目的</dt>
                        <dd>{{ page.purpose }}</dd>
                      </div>
                      <div v-if="page.mainArea">
                        <dt>主要区域</dt>
                        <dd>{{ page.mainArea }}</dd>
                      </div>
                      <div v-if="page.primaryAction">
                        <dt>关键操作</dt>
                        <dd>{{ page.primaryAction }}</dd>
                      </div>
                      <div v-if="page.evidence">
                        <dt>证据</dt>
                        <dd>{{ page.evidence }}</dd>
                      </div>
                    </dl>
                  </article>
                </section>
                <section v-else-if="block.type === 'architecture-map'" class="competitor-analysis-architecture-map" aria-label="信息架构">
                  <article v-for="(item, itemIndex) in architectureItemsForBlock(block)" :key="`${item.title || 'architecture'}-${itemIndex}`">
                    <strong>{{ item.title }}</strong>
                    <p v-if="item.detail">{{ item.detail }}</p>
                  </article>
                </section>
                <ul v-else-if="block.type === 'list' && !block.ordered">
                  <li v-for="item in block.items" :key="item">{{ item }}</li>
                </ul>
                <ol v-else-if="block.type === 'list'">
                  <li v-for="item in block.items" :key="item">{{ item }}</li>
                </ol>
                <table v-else-if="block.type === 'table'" class="competitor-analysis-md-table">
                  <thead>
                    <tr>
                      <th v-for="cell in block.headers" :key="cell">{{ cell }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
                      <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">{{ cell }}</td>
                    </tr>
                  </tbody>
                </table>
                <blockquote v-else-if="block.type === 'quote'">{{ block.text }}</blockquote>
                <pre v-else-if="block.type === 'code'" class="competitor-analysis-md-code"><code>{{ block.text }}</code></pre>
                <p v-else>{{ block.text }}</p>
              </template>
            </section>
          </article>

          <div v-if="hasSelectedDiagramArtifacts" class="competitor-analysis-artifact-grid">
            <article v-if="diagramAssetAvailable(selectedInteractionArtifacts.mainFlowFile)" class="competitor-analysis-artifact-card">
              <div>
                <h4>{{ diagramFileLabel('主流程图') }}</h4>
              </div>
              <div class="competitor-analysis-diagram-preview">
                <img v-if="artifactDiagramPreviewUrl(selectedInteractionArtifacts.mainFlowFile)" :src="artifactDiagramPreviewUrl(selectedInteractionArtifacts.mainFlowFile)" :alt="diagramAssetLabel(selectedInteractionArtifacts.mainFlowFile, '主流程图')" />
                <a :href="artifactDiagramFileUrl(selectedInteractionArtifacts.mainFlowFile)" :download="artifactDiagramDownloadName(selectedInteractionArtifacts.mainFlowFile, '主流程图')">下载源文件</a>
              </div>
            </article>

            <article v-if="diagramAssetAvailable(selectedInteractionArtifacts.stateDiagramFile)" class="competitor-analysis-artifact-card">
              <div>
                <h4>{{ diagramFileLabel('状态图') }}</h4>
              </div>
              <div class="competitor-analysis-diagram-preview">
                <img v-if="artifactDiagramPreviewUrl(selectedInteractionArtifacts.stateDiagramFile)" :src="artifactDiagramPreviewUrl(selectedInteractionArtifacts.stateDiagramFile)" :alt="diagramAssetLabel(selectedInteractionArtifacts.stateDiagramFile, '状态图')" />
                <a :href="artifactDiagramFileUrl(selectedInteractionArtifacts.stateDiagramFile)" :download="artifactDiagramDownloadName(selectedInteractionArtifacts.stateDiagramFile, '状态图')">下载源文件</a>
              </div>
            </article>
          </div>

          <article v-if="selectedInteractionArtifacts.lowFiWireframeImages.length" class="competitor-analysis-artifact-card">
            <div>
              <h4>低保真线框图</h4>
            </div>
            <div class="competitor-analysis-wireframe-list">
              <figure v-for="item in selectedInteractionArtifacts.lowFiWireframeImages" :key="artifactImageKey(item)">
                <img :src="artifactImageUrl(item)" :alt="artifactImageLabel(item)" />
                <figcaption>{{ artifactImageLabel(item) }}</figcaption>
              </figure>
            </div>
          </article>

          <article v-if="selectedInteractionArtifacts.stateMatrix.length || selectedInteractionArtifacts.transitions.length" class="competitor-analysis-artifact-card">
            <div>
              <h4>状态机明细</h4>
            </div>
            <div class="competitor-analysis-state-list">
              <p v-for="item in selectedInteractionArtifacts.stateMatrix" :key="artifactStateKey(item)">
                <strong>{{ artifactStateTitle(item) }}</strong>
                <span>{{ artifactStateDetail(item) }}</span>
              </p>
              <p v-for="item in selectedInteractionArtifacts.transitions" :key="artifactStateKey(item)">
                <strong>{{ artifactStateTitle(item) }}</strong>
                <span>{{ artifactStateDetail(item) }}</span>
              </p>
            </div>
          </article>
        </section>
        <section v-else-if="selectedRecord?.kind === 'framework' && selectedFrameworkRows.length" class="competitor-analysis-framework-explorer" aria-label="完整框架结构化清单">
          <header class="competitor-analysis-framework-explorer-header">
            <div>
              <h4>结构化清单</h4>
              <p>已将完整框架报告整理为可筛选阅读的清单；长链接收起为“查看链接”，完整字段可展开查看。</p>
            </div>
            <span>{{ selectedFrameworkRows.length }} 条</span>
          </header>
          <BaseDataTable class="competitor-analysis-framework-table" table-class="competitor-analysis-table" min-width="1080px">
            <thead>
              <tr>
                <th>编号</th>
                <th>类型</th>
                <th>名称</th>
                <th>所属层级</th>
                <th>入口路径</th>
                <th>前置条件</th>
                <th>完整内容</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in selectedFrameworkRows" :key="row.id">
                <td><strong>{{ row.code }}</strong></td>
                <td>{{ row.typeLabel }}</td>
                <td>
                  <strong>{{ row.name }}</strong>
                  <small v-if="row.context">{{ row.context }}</small>
                </td>
                <td>{{ row.level || '未标注' }}</td>
                <td>
                  <a v-if="row.entryUrl" :href="row.entryUrl" target="_blank" rel="noreferrer">查看链接</a>
                  <span v-else>{{ row.entry || '未标注' }}</span>
                </td>
                <td>{{ row.prerequisite || '未标注' }}</td>
                <td>
                  <details class="competitor-analysis-framework-row-detail">
                    <summary>展开行</summary>
                    <dl>
                      <div v-for="detail in row.details" :key="detail.key">
                        <dt>{{ detail.label }}</dt>
                        <dd>{{ detail.value }}</dd>
                      </div>
                    </dl>
                  </details>
                </td>
              </tr>
            </tbody>
          </BaseDataTable>
        </section>
        <section v-else-if="selectedDetailMarkdown" class="competitor-analysis-markdown">
          <template v-for="(block, index) in enhancedMarkdownBlocksFor(selectedDetailMarkdown)" :key="markdownBlockKey(block, index)">
            <h1 v-if="block.type === 'heading' && block.level === 1">{{ block.text }}</h1>
            <h2 v-else-if="block.type === 'heading' && block.level === 2">{{ block.text }}</h2>
            <h3 v-else-if="block.type === 'heading'">{{ block.text }}</h3>
            <section v-else-if="block.type === 'flow-table'" class="competitor-analysis-flow-timeline" aria-label="页面流转">
              <article v-for="(step, stepIndex) in flowRowsForBlock(block)" :key="`${step.id || 'flow'}-${stepIndex}`">
                <div class="competitor-analysis-flow-main">
                  <span class="competitor-analysis-flow-id">{{ step.id || `S${stepIndex + 1}` }}</span>
                  <strong>{{ step.from || '未标注起点' }}</strong>
                  <span aria-hidden="true">→</span>
                  <strong>{{ step.to || '未标注终点' }}</strong>
                </div>
                <dl>
                  <div v-if="step.action">
                    <dt>触发</dt>
                    <dd>{{ step.action }}</dd>
                  </div>
                  <div v-if="step.condition">
                    <dt>条件</dt>
                    <dd>{{ step.condition }}</dd>
                  </div>
                  <div v-if="step.confidence">
                    <dt>证据</dt>
                    <dd>{{ step.confidence }}</dd>
                  </div>
                </dl>
              </article>
            </section>
            <section v-else-if="block.type === 'state-machine-table'" class="competitor-analysis-state-board" aria-label="状态机">
              <article v-for="(transition, transitionIndex) in stateRowsForBlock(block)" :key="`${transition.id || 'state'}-${transitionIndex}`">
                <div class="competitor-analysis-state-main">
                  <strong>{{ transition.from || '未标注当前状态' }}</strong>
                  <span aria-hidden="true">→</span>
                  <strong>{{ transition.to || '未标注目标状态' }}</strong>
                </div>
                <p v-if="transition.condition">{{ transition.condition }}</p>
                <div class="competitor-analysis-state-tags">
                  <span v-if="transition.id">{{ transition.id }}</span>
                  <span v-if="transition.reversible">可逆：{{ transition.reversible }}</span>
                  <span v-if="transition.evidence">证据：{{ transition.evidence }}</span>
                </div>
              </article>
            </section>
            <section v-else-if="block.type === 'page-overview-table'" class="competitor-analysis-page-card-grid" aria-label="页面框架">
              <article v-for="(page, pageIndex) in pageRowsForBlock(block)" :key="`${page.id || page.name || 'page'}-${pageIndex}`">
                <header>
                  <span>{{ page.id || `P${pageIndex + 1}` }}</span>
                  <strong>{{ page.name || '未命名页面' }}</strong>
                </header>
                <dl>
                  <div v-if="page.type">
                    <dt>类型</dt>
                    <dd>{{ page.type }}</dd>
                  </div>
                  <div v-if="page.purpose">
                    <dt>目的</dt>
                    <dd>{{ page.purpose }}</dd>
                  </div>
                  <div v-if="page.mainArea">
                    <dt>主要区域</dt>
                    <dd>{{ page.mainArea }}</dd>
                  </div>
                  <div v-if="page.primaryAction">
                    <dt>关键操作</dt>
                    <dd>{{ page.primaryAction }}</dd>
                  </div>
                  <div v-if="page.evidence">
                    <dt>证据</dt>
                    <dd>{{ page.evidence }}</dd>
                  </div>
                </dl>
              </article>
            </section>
            <section v-else-if="block.type === 'architecture-map'" class="competitor-analysis-architecture-map" aria-label="信息架构">
              <article v-for="(item, itemIndex) in architectureItemsForBlock(block)" :key="`${item.title || 'architecture'}-${itemIndex}`">
                <strong>{{ item.title }}</strong>
                <p v-if="item.detail">{{ item.detail }}</p>
              </article>
            </section>
            <ul v-else-if="block.type === 'list' && !block.ordered">
              <li v-for="item in block.items" :key="item">{{ item }}</li>
            </ul>
            <ol v-else-if="block.type === 'list'">
              <li v-for="item in block.items" :key="item">{{ item }}</li>
            </ol>
            <table v-else-if="block.type === 'table'" class="competitor-analysis-md-table">
              <thead>
                <tr>
                  <th v-for="cell in block.headers" :key="cell">{{ cell }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
                  <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
            <blockquote v-else-if="block.type === 'quote'">{{ block.text }}</blockquote>
            <pre v-else-if="block.type === 'code'" class="competitor-analysis-md-code"><code>{{ block.text }}</code></pre>
            <p v-else>{{ block.text }}</p>
          </template>
        </section>
        <section v-else class="competitor-analysis-empty">
          <FileText class="competitor-analysis-empty-icon" aria-hidden="true" />
          <h4>{{ selectedRecord.status === 'running' ? '报告生成中' : '报告暂未生成' }}</h4>
          <p>{{ selectedRecord.status === 'running' ? '稍等片刻，分析完成后会自动写回这条记录。' : '可以回到列表重新发起分析。' }}</p>
        </section>
      </section>
        <footer class="competitor-analysis-detail-actions">
          <BaseButton type="button" :disabled="!selectedReportCopyText" @click="copySelectedReport">复制报告</BaseButton>
          <BaseButton type="button" :disabled="!selectedReportCopyText" @click="downloadSelectedReport">下载报告</BaseButton>
          <BaseButton
            v-if="selectedSourceRecord"
            type="button"
            @click="openSourceRecord"
          >查看来源报告</BaseButton>
          <ElSelect
            v-if="selectedFeatureEvents.length > 1"
            v-model="selectedFeatureEventId"
            class="competitor-analysis-detail-event-select"
            popper-class="competitor-analysis-filter-popper"
            placeholder="选择新功能"
          >
            <ElOption
              v-for="event in selectedFeatureEvents"
              :key="featureEventKey(event)"
              :label="featureEventOptionLabel(event)"
              :value="featureEventKey(event)"
            />
          </ElSelect>
          <BaseButton
            v-if="selectedFeatureEvents.length"
            variant="primary"
            type="button"
            :disabled="!selectedFeatureEventForAction"
            @click="deepAnalyzeFeatureEvent(selectedFeatureEventForAction)"
          >深度分析</BaseButton>
          <BaseButton
            v-if="canQuickAnalyzeSelectedRecord"
            variant="primary"
            type="button"
            :disabled="!selectedReportCopyText"
            @click="quickAnalyzeSelectedReport"
          >快速分析</BaseButton>
        </footer>
      </section>
    </div>

    <div v-if="showAnalysisDialog" class="competitor-analysis-dialog-backdrop" role="presentation" @click.self="closeAnalysisDialog">
      <section class="competitor-analysis-dialog" role="dialog" aria-modal="true" aria-label="开始分析">
        <header>
          <h3>开始分析</h3>
          <button type="button" aria-label="关闭弹窗" @click="closeAnalysisDialog">×</button>
        </header>

        <div class="competitor-analysis-dialog-body">
          <section class="competitor-analysis-dialog-section">
            <h4>选择分析类型</h4>
            <ElSelect
              v-model="analysisForm.kind"
              class="competitor-analysis-dialog-select"
              popper-class="competitor-analysis-filter-popper"
              aria-label="选择分析类型"
              @change="setDialogKind"
            >
              <ElOption v-for="item in analysisTabs" :key="`dialog-kind-${item.value}`" :label="item.label" :value="item.value" />
            </ElSelect>
          </section>

          <section class="competitor-analysis-dialog-section">
            <h4>选择分析竞品</h4>
            <ElSelect
              v-if="analysisCompetitorOptions.length"
              v-model="analysisForm.competitorIds"
              class="competitor-analysis-dialog-select competitor-analysis-dialog-select-wide"
              popper-class="competitor-analysis-filter-popper competitor-analysis-competitor-popper"
              aria-label="选择分析竞品"
              multiple
              collapse-tags
              collapse-tags-tooltip
              filterable
              placeholder="选择竞品"
              @change="handleAnalysisCompetitorChange"
            >
              <ElOption label="全部" value="__all__" />
              <ElOption
                v-for="item in analysisCompetitorOptions"
                :key="`analysis-competitor-${item.id}`"
                :label="analysisCompetitorOptionLabel(item)"
                :value="item.id"
              >
                <div class="competitor-analysis-option">
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.websiteUrl || '未填写官网' }}</small>
                </div>
              </ElOption>
            </ElSelect>
            <p v-else class="competitor-analysis-help">还没有竞品，先新增一个竞品后再开始分析。</p>
          </section>

          <template v-if="analysisRequiresScopeFields">
            <section class="competitor-analysis-dialog-section">
              <div class="competitor-analysis-feature-picker">
                <div>
                  <h4>选择要分析的功能</h4>
                  <p>只展示已确认的竞品主功能链路；用户只需要点选，不需要输入目标词。</p>
                </div>
                <ElSelect
                  v-if="competitorFeatureMapOptions.length"
                  v-model="analysisForm.selectedFeatureId"
                  class="competitor-analysis-dialog-select competitor-analysis-dialog-select-wide"
                  popper-class="competitor-analysis-filter-popper competitor-analysis-feature-popper"
                  aria-label="选择要分析的功能"
                  filterable
                  placeholder="选择竞品主功能链路"
                  @change="handleCompetitorFeatureSelect"
                >
                  <ElOption
                    v-for="item in competitorFeatureMapOptions"
                    :key="item.id"
                    :label="item.name"
                    :value="item.id"
                  >
                    <div class="competitor-analysis-option">
                      <strong>{{ item.name }}</strong>
                      <small>{{ item.sourceLabel }} · {{ item.confidenceLabel }}</small>
                    </div>
                  </ElOption>
                </ElSelect>
                <p v-else class="competitor-analysis-help">暂未发现可点选主功能链路。可以先生成「完整框架」，或上传竞品截图作为参考。</p>
              </div>
            </section>

            <section class="competitor-analysis-dialog-section">
              <div class="competitor-analysis-screenshot-reference">
                <div>
                  <h4>上传截图参考（可选）</h4>
                  <p>截图只作为参考，用来理解要找的功能入口；最终结论仍按公开页面、导航、URL、监控记录等证据分级。</p>
                </div>
                <label class="competitor-analysis-upload-tile">
                  <input type="file" accept="image/*" multiple @change="handleReferenceScreenshotUpload" />
                  <span>上传参考截图</span>
                </label>
                <div v-if="analysisForm.referenceScreenshots.length" class="competitor-analysis-reference-list">
                  <figure v-for="item in analysisForm.referenceScreenshots" :key="item.id">
                    <img :src="item.imageDataUrl" :alt="item.name || '参考截图'" />
                    <figcaption>
                      <span>{{ item.name || '参考截图' }}</span>
                      <button type="button" @click="removeReferenceScreenshot(item.id)">移除</button>
                    </figcaption>
                  </figure>
                </div>
              </div>
            </section>
          </template>
        </div>

        <p v-if="analysisDialogMessage" class="competitor-analysis-dialog-message" :class="{ failed: statusTone === 'failed' }">
          {{ analysisDialogMessage }}
        </p>

        <footer>
          <BaseButton type="button" @click="closeAnalysisDialog">取消</BaseButton>
          <button
            class="ui-button ui-button--primary"
            type="button"
            :disabled="submittingAnalysis"
            @click.stop.prevent="handleConfirmAnalysis"
          >
            <span v-if="submittingAnalysis" class="ui-button__spinner" aria-hidden="true"></span>
            确定
          </button>
        </footer>
      </section>
    </div>

    <div v-if="showCreateDialog" class="competitor-analysis-dialog-backdrop" role="presentation" @click.self="closeCreateDialog">
      <section class="competitor-analysis-dialog competitor-analysis-create-dialog" role="dialog" aria-modal="true" :aria-label="editingCompetitorId ? '编辑竞品' : '新增竞品'">
        <header>
          <h3>{{ editingCompetitorId ? '编辑竞品' : '新增竞品' }}</h3>
          <button type="button" aria-label="关闭弹窗" @click="closeCreateDialog">×</button>
        </header>

        <div class="competitor-analysis-dialog-body">
          <label class="competitor-analysis-field">
            竞品名称
            <input class="ui-input" :value="createForm.name" placeholder="例如：HeyGen" @input="createForm.name = $event.target.value" />
          </label>
          <label class="competitor-analysis-field">
            官网地址
            <input class="ui-input" :value="createForm.websiteUrl" placeholder="https://www.heygen.com" @input="createForm.websiteUrl = $event.target.value" />
          </label>
        </div>

        <footer>
          <BaseButton type="button" @click="closeCreateDialog">取消</BaseButton>
          <BaseButton variant="primary" type="button" :disabled="creatingCompetitor" :loading="creatingCompetitor" @click="handleSaveCompetitor">
            保存
          </BaseButton>
        </footer>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElInput, ElOption, ElSelect } from 'element-plus'
import { FileText, Play, Plus, Search } from 'lucide-vue-next'
import { BaseButton, BaseDataTable, BaseSecondaryTabs, BaseTabs, BaseTag } from '../../components/base'
import { api } from '../../services/api'

const props = defineProps({
  apiConfig: { type: Object, required: true },
  projectId: { type: String, default: '' }
})

const analysisTabs = [
  { value: 'daily', label: '每日生成' },
  { value: 'weekly', label: '周报生成' },
  { value: 'flow', label: '交互流程' },
  { value: 'framework', label: '完整框架' }
  // 注意：gap（机会点分析）不从对话框手动触发，仅通过报告详情页「快速分析」按钮触发
]

const primaryTabs = [
  { value: 'monitor', label: '竞品监控' },
  { value: 'gap', label: '机会点分析' }
]

const monitorTabs = [
  { value: 'competitors', label: '竞品表' },
  { value: 'daily', label: '每日生成' },
  { value: 'weekly', label: '周报生成' },
  { value: 'flow', label: '交互流程' },
  { value: 'framework', label: '完整框架' }
]

const statusFilterOptions = [
  { value: 'all', label: '状态：全部' },
  { value: 'running', label: '分析中' },
  { value: 'succeeded', label: '已生成' },
  { value: 'failed', label: '未完成' },
  { value: 'pending', label: '待分析' }
]

const COMPETITOR_ANALYSIS_CACHE_PREFIX = 'liuchengtong:competitor-analysis:records:'

function routeProjectIdFromLocation() {
  if (typeof window === 'undefined') return ''
  const match = String(window.location.hash || '').match(/^#\/projects\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

const activeKind = ref('competitors')
const activePrimaryTab = ref('monitor')
const selectedRecordId = ref('')
const selectedFeatureEventId = ref('')
const analysisRecords = ref([])
const competitors = ref([])
const submittingAnalysis = ref(false)
const runningRecordIds = ref(new Set())
const creatingCompetitor = ref(false)
const editingCompetitorId = ref('')
const showAnalysisDialog = ref(false)
const showCreateDialog = ref(false)
const statusMessage = ref('')
const statusTone = ref('info')
const analysisResult = ref({})
const analysisDialogMessage = ref('')

const listFilters = reactive({
  query: '',
  competitor: 'all',
  status: 'all'
})

const analysisForm = reactive({
  kind: 'daily',
  competitorIds: [],
  goal: '',
  competitorName: '',
  feature: '',
  selectedFeatureId: '',
  selectedFeature: null,
  referenceScreenshots: [],
  productUrl: '',
  productName: ''
})

const createForm = reactive({
  name: '',
  websiteUrl: ''
})

const effectiveProjectId = computed(() => props.projectId || routeProjectIdFromLocation() || 'default')
const cacheKey = computed(() => `${COMPETITOR_ANALYSIS_CACHE_PREFIX}${effectiveProjectId.value}`)
const filteredRecords = computed(() => analysisRecords.value.filter(recordMatchesFilters))
const filteredCompetitors = computed(() => competitors.value.filter(competitorMatchesFilters))
const hasRunningTasks = computed(() => runningRecordIds.value.size > 0)
const competitorFilterOptions = computed(() => {
  const names = new Set()
  for (const competitor of competitors.value) {
    if (competitor?.name) names.add(competitor.name)
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})
const hasActiveListFilters = computed(() => Boolean(
  listFilters.query.trim() ||
  listFilters.competitor !== 'all' ||
  listFilters.status !== 'all'
))
const emptyListTitle = computed(() => hasActiveListFilters.value ? '没有匹配的分析记录' : '竞品分析列表还没有记录')
const emptyListMessage = computed(() => hasActiveListFilters.value ? '调整搜索或筛选条件后再查看。' : '点击右上角开始分析，选择竞品和类型后会在这里生成记录。')
const selectedBaseRecord = computed(() => analysisRecords.value.find((record) => record.id === selectedRecordId.value) || null)
const selectedRecord = computed(() => selectedBaseRecord.value)
const allCompetitorsSelected = computed(() =>
  Boolean(analysisCompetitorOptions.value.length) &&
  analysisCompetitorOptions.value.every((item) => analysisForm.competitorIds.includes(item.id))
)
const analysisCompetitorOptions = computed(() => {
  const byKey = new Map()
  for (const competitor of competitors.value) addAnalysisCompetitorOption(byKey, competitor)
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})
const analysisRequiresScopeFields = computed(() => analysisForm.kind === 'flow')
const competitorFeatureMapOptions = computed(() => buildCompetitorFeatureMapOptions())
const selectedDetailMarkdown = computed(() => detailMarkdownForRecord(selectedRecord.value))
const selectedFrameworkRows = computed(() => selectedRecord.value?.kind === 'framework' ? frameworkRowsForMarkdown(selectedDetailMarkdown.value) : [])
const selectedFeatureEvents = computed(() => selectedRecord.value?.featureEvents || [])
const selectedInteractionArtifacts = computed(() => interactionArtifactsForRecord(selectedRecord.value))
const selectedSourceRecord = computed(() => {
  const sourceRecordId = String(selectedRecord.value?.sourceRecordId || '').trim()
  if (!sourceRecordId) return null
  return analysisRecords.value.find((record) => record.id === sourceRecordId) || null
})
const canQuickAnalyzeSelectedRecord = computed(() =>
  isAnalysisKind(selectedRecord.value?.kind) &&
  selectedRecord.value?.kind !== 'gap'
)
const selectedFeatureEventForAction = computed(() => {
  const events = selectedFeatureEvents.value
  return events.find((event) => featureEventKey(event) === selectedFeatureEventId.value) || events.at(0) || null
})
const selectedReportCopyText = computed(() => {
  const parts = [
    selectedDetailMarkdown.value,
    selectedInteractionArtifacts.value.documentMarkdown
  ]
  return parts.find((item) => String(item || '').trim()) || ''
})
const hasSelectedDiagramArtifacts = computed(() => Boolean(
  diagramAssetAvailable(selectedInteractionArtifacts.value.mainFlowFile) ||
  diagramAssetAvailable(selectedInteractionArtifacts.value.stateDiagramFile)
))
const hasSelectedInteractionArtifacts = computed(() => Boolean(
  selectedInteractionArtifacts.value.documentMarkdown ||
  hasSelectedDiagramArtifacts.value ||
  selectedInteractionArtifacts.value.lowFiWireframeImages.length ||
  selectedInteractionArtifacts.value.stateMatrix.length ||
  selectedInteractionArtifacts.value.transitions.length
))

function isAnalysisKind(kind = '') {
  return ['daily', 'weekly', 'flow', 'framework', 'gap'].includes(kind)
}

function currentDialogAnalysisKind() {
  if (isAnalysisKind(activeKind.value)) return activeKind.value
  if (isAnalysisKind(analysisForm.kind)) return analysisForm.kind
  return 'daily'
}

function getKindLabel(kind = '') {
  if (kind === 'gap') return '机会点分析'
  return analysisTabs.find((item) => item.value === kind)?.label || '每日生成'
}

function setActiveKind(kind = 'daily') {
  activeKind.value = kind
  activePrimaryTab.value = kind === 'gap' ? 'gap' : 'monitor'
  if (isAnalysisKind(kind)) {
    analysisForm.kind = kind
  }
  fillDialogDefaults()
  void refreshActiveKindData(kind)
}

function setActivePrimaryTab(tab = 'monitor') {
  activePrimaryTab.value = tab
  if (tab === 'gap') {
    setActiveKind('gap')
    return
  }
  if (activeKind.value === 'gap') {
    setActiveKind('competitors')
    return
  }
  void refreshActiveKindData(activeKind.value)
}

async function refreshActiveKindData(kind = activeKind.value) {
  if (kind === 'competitors') {
    await loadCompetitors()
    return
  }
  await loadRecords()
}

function statusLabel(status = '') {
  if (status === 'running') return '分析中'
  if (status === 'succeeded') return '已生成'
  if (status === 'failed') return '未完成'
  return '待分析'
}

function statusVariant(status = '') {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'error'
  return 'info'
}

function formatTime(value = '') {
  if (!value) return '暂未生成'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function recordCompetitorNames(record = {}) {
  const names = Array.isArray(record.competitorNames) ? record.competitorNames.filter(Boolean) : []
  if (!names.length && record.competitorName) names.push(record.competitorName)
  if (!names.length && record.productName) names.push(record.productName)
  return names.length ? names.join('、') : '未选择竞品'
}

function recordFeatureLabel(record = {}) {
  const label = String(record.feature || record.featureName || record.functionName || '').trim()
  if (label) return label
  const event = Array.isArray(record.featureEvents) ? record.featureEvents.find((item) => featureEventName(item)) : null
  if (event) return featureEventName(event)
  if (['daily', 'weekly'].includes(record.kind)) return '全部功能'
  return '未填写'
}

function recordSearchText(record = {}) {
  const featureEventText = (Array.isArray(record.featureEvents) ? record.featureEvents : [])
    .map((event) => [
      featureEventCompetitorName(event),
      featureEventName(event),
      featureEventSourceText(event)
    ].filter(Boolean).join(' '))
    .join(' ')
  return [
    record.title,
    getKindLabel(record.kind),
    recordCompetitorNames(record),
    recordFeatureLabel(record),
    record.goal,
    record.statusLabel || statusLabel(record.status),
    record.summary,
    featureEventText
  ].filter(Boolean).join(' ').toLowerCase()
}

function recordCompetitorNameList(record = {}) {
  const names = Array.isArray(record.competitorNames) ? record.competitorNames.filter(Boolean) : []
  if (!names.length && record.competitorName) names.push(record.competitorName)
  if (!names.length && record.productName) names.push(record.productName)
  return names
}

function featureEventName(event = {}) {
  return String(event.featureName || event.feature || event.name || '').trim()
}

function featureEventCompetitorName(event = {}) {
  return String(event.competitorName || event.competitor || '').trim()
}

function featureEventSourceText(event = {}) {
  const urls = Array.isArray(event.sourceUrls) ? event.sourceUrls.filter(Boolean) : []
  if (urls.length) return urls.slice(0, 2).join('、')
  return event.rawEvidence || '监控报告'
}

function featureEventKey(event = {}) {
  return event.id || `${featureEventCompetitorName(event)}-${featureEventName(event)}-${event.discoveredAt || ''}`
}

function featureEventOptionLabel(event = {}) {
  const competitorName = featureEventCompetitorName(event)
  const featureName = featureEventName(event)
  return [competitorName, featureName].filter(Boolean).join(' - ') || '未命名功能'
}

function normalizeFeatureOptionName(value = '') {
  return String(value || '')
    .replace(/^[#*\-\d.\s]+/, '')
    .replace(/[：:]\s*$/, '')
    .trim()
}

const ACTIONABLE_FEATURE_RECORD_KINDS = new Set(['flow', 'framework'])
const PRIMARY_FEATURE_NAME_PATTERN = /(入口|中心|工作台|平台|模板|创作|灵感|主图|场景图|详情页|营销素材|证件照|形象照|商品|素材|编辑器|生成|去除|移除|改色|打光|特效|抠图|扩图|换背景|海报|视频|图片|设计|AI|智能)/i
const NON_PRIMARY_FEATURE_NAME_PATTERN = /(今日未发现|本周未发现|未发现明确|暂未发现|没有匹配|全部功能|新功能扫描报告|竞品监控周报|本周概览|当前状态|建议处理|检索识别状态|说明)/i

function isPrimaryCompetitorFeatureCandidate(name = '', source = 'record') {
  const text = normalizeFeatureOptionName(name)
  if (!text || text.length < 2 || text.length > 36) return false
  if (NON_PRIMARY_FEATURE_NAME_PATTERN.test(text)) return false
  if (source === 'event' || source === 'screenshot') return true
  return PRIMARY_FEATURE_NAME_PATTERN.test(text)
}

function isDuplicateCompetitorFeatureName(name = '', record = {}) {
  const text = normalizeFeatureOptionName(name)
  if (!text) return false
  return recordCompetitorNameList(record).some((item) => normalizeFeatureOptionName(item) === text)
}

function recordHasPrimaryFeature(record = {}) {
  const recordFeature = recordFeatureLabel(record)
  return Boolean(
    ACTIONABLE_FEATURE_RECORD_KINDS.has(record.kind) &&
    recordFeature &&
    !['全部功能', '未填写'].includes(recordFeature) &&
    !isDuplicateCompetitorFeatureName(recordFeature, record) &&
    isPrimaryCompetitorFeatureCandidate(recordFeature, record.kind === 'framework' ? 'framework' : 'record')
  )
}

function recordHasActionableAnalysisValue(record = {}) {
  if (record.kind !== 'flow') return true
  if (recordHasPrimaryFeature(record)) return true
  return (record.featureEvents || []).some((event) => isPrimaryCompetitorFeatureCandidate(featureEventName(event), 'event'))
}

function featureOptionId(name = '', source = '') {
  return `feature-${String(source || 'record')}-${String(name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')}`
}

function makeFeatureOption(name = '', source = 'record', meta = {}) {
  const normalizedName = normalizeFeatureOptionName(name)
  if (!isPrimaryCompetitorFeatureCandidate(normalizedName, source)) return null
  const sourceLabels = {
    event: '监控发现',
    record: '历史分析',
    framework: '完整框架',
    screenshot: '截图参考'
  }
  const confidenceLabels = {
    confirmed: '确认功能',
    inferred: '推断功能',
    reference: '参考识别',
    partial: '部分证据'
  }
  return {
    id: meta.id || featureOptionId(normalizedName, source),
    name: normalizedName,
    source,
    sourceLabel: sourceLabels[source] || '系统发现',
    confidence: meta.confidence || (source === 'screenshot' ? 'reference' : 'partial'),
    confidenceLabel: confidenceLabels[meta.confidence] || confidenceLabels[source === 'screenshot' ? 'reference' : 'partial'],
    competitorName: meta.competitorName || '',
    evidence: meta.evidence || ''
  }
}

function addFeatureMapOption(map = new Map(), option = null) {
  if (!option?.name) return
  const key = option.name.toLowerCase()
  if (map.has(key)) return
  map.set(key, option)
}

function recordMatchesSelectedCompetitors(record = {}, selectedNames = []) {
  if (!selectedNames.length) return false
  const names = recordCompetitorNameList(record)
  if (!names.length) return false
  return names.some((name) => selectedNames.includes(name))
}

function buildCompetitorFeatureMapOptions() {
  if (!analysisRequiresScopeFields.value) return []
  const selectedNames = selectedCompetitors().map(competitorDisplayName).filter(Boolean)
  const options = new Map()
  if (analysisForm.referenceScreenshots.length) {
    addFeatureMapOption(options, makeFeatureOption('截图中的功能入口', 'screenshot', {
      id: 'screenshot-reference-entry',
      confidence: 'reference',
      evidence: analysisForm.referenceScreenshots.map((item) => item.name).filter(Boolean).join('、')
    }))
  }
  for (const record of analysisRecords.value) {
    if (!recordMatchesSelectedCompetitors(record, selectedNames)) continue
    const recordFeature = recordFeatureLabel(record)
    if (recordHasPrimaryFeature(record)) {
      addFeatureMapOption(options, makeFeatureOption(recordFeature, record.kind === 'framework' ? 'framework' : 'record', {
        confidence: record.kind === 'framework' ? 'inferred' : 'partial',
        competitorName: recordCompetitorNames(record)
      }))
    }
    for (const event of record.featureEvents || []) {
      addFeatureMapOption(options, makeFeatureOption(featureEventName(event), 'event', {
        id: featureOptionId(featureEventName(event), featureEventKey(event)),
        confidence: 'confirmed',
        competitorName: featureEventCompetitorName(event),
        evidence: featureEventSourceText(event)
      }))
    }
  }
  return [...options.values()].slice(0, 16)
}

function selectCompetitorFeature(option = {}) {
  if (!option?.id) return
  analysisForm.selectedFeatureId = option.id
  analysisForm.selectedFeature = {
    id: option.id,
    name: option.name,
    source: option.source,
    confidence: option.confidence,
    competitorName: option.competitorName || '',
    evidence: option.evidence || ''
  }
  analysisForm.feature = option.name
  analysisForm.goal = `验证竞品是否存在「${option.name}」，并输出入口路径、交互流程、证据分级和待补采清单。`
}

function handleCompetitorFeatureSelect(featureId = '') {
  const option = competitorFeatureMapOptions.value.find((item) => item.id === featureId)
  if (option) selectCompetitorFeature(option)
}

function ensureSelectedFeatureStillAvailable(options = {}) {
  if (!analysisRequiresScopeFields.value) return
  const featureOptions = competitorFeatureMapOptions.value
  const preferred = options.preferScreenshot
    ? featureOptions.find((item) => item.source === 'screenshot')
    : null
  if (preferred) {
    selectCompetitorFeature(preferred)
    return
  }
  if (analysisForm.selectedFeatureId && featureOptions.some((item) => item.id === analysisForm.selectedFeatureId)) return
  const first = featureOptions[0]
  if (first) {
    selectCompetitorFeature(first)
    return
  }
  analysisForm.selectedFeatureId = ''
  analysisForm.selectedFeature = null
  analysisForm.feature = ''
  analysisForm.goal = ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('截图读取失败'))
    reader.readAsDataURL(file)
  })
}

async function handleReferenceScreenshotUpload(event) {
  const files = Array.from(event?.target?.files || []).filter((file) => file?.type?.startsWith('image/'))
  event.target.value = ''
  if (!files.length) return
  const existing = [...analysisForm.referenceScreenshots]
  for (const file of files.slice(0, 4)) {
    const imageDataUrl = await readFileAsDataUrl(file)
    existing.push({
      id: `reference-screenshot-${Date.now()}-${existing.length}`,
      name: file.name || '参考截图',
      mimeType: file.type || 'image/png',
      size: file.size || 0,
      imageDataUrl
    })
  }
  analysisForm.referenceScreenshots = existing.slice(0, 4)
  ensureSelectedFeatureStillAvailable({ preferScreenshot: true })
}

function removeReferenceScreenshot(id = '') {
  analysisForm.referenceScreenshots = analysisForm.referenceScreenshots.filter((item) => item.id !== id)
  ensureSelectedFeatureStillAvailable()
}

function competitorForFeatureEvent(event = {}) {
  const name = featureEventCompetitorName(event)
  return competitors.value.find((item) => item.name === name) ||
    competitors.value.find((item) => `${item.name || ''} ${item.websiteUrl || ''}`.includes(name)) ||
    null
}

function productUrlForFeatureEvent(event = {}, record = {}) {
  const competitor = competitorForFeatureEvent(event)
  if (competitor?.websiteUrl) return competitor.websiteUrl
  const name = featureEventCompetitorName(event)
  const names = recordCompetitorNameList(record)
  const index = names.findIndex((item) => item === name)
  if (index >= 0 && Array.isArray(record.productUrls) && record.productUrls[index]) return record.productUrls[index]
  return record.productUrl || ''
}

function recordMatchesFilters(record = {}) {
  const query = listFilters.query.trim().toLowerCase()
  if (query && !recordSearchText(record).includes(query)) return false
  if (record.kind !== activeKind.value) return false
  if (!recordHasActionableAnalysisValue(record)) return false
  if (listFilters.status !== 'all' && (record.status || 'pending') !== listFilters.status) return false
  if (listFilters.competitor !== 'all' && !recordCompetitorNameList(record).includes(listFilters.competitor)) return false
  return true
}

function competitorSearchText(competitor = {}) {
  return [
    competitor.name,
    competitor.websiteUrl,
    competitor.notes,
    competitorSourceLabel(competitor)
  ].filter(Boolean).join(' ').toLowerCase()
}

function competitorMatchesFilters(competitor = {}) {
  const query = listFilters.query.trim().toLowerCase()
  if (query && !competitorSearchText(competitor).includes(query)) return false
  if (listFilters.competitor !== 'all' && competitor.name !== listFilters.competitor) return false
  return true
}

function competitorSourceLabel(competitor = {}) {
  return Array.isArray(competitor.tags) && competitor.tags.includes('python-default') ? '默认竞品' : '手动新增'
}

function noop() {}

function safeReportFileNamePart(value = '') {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || '竞品分析报告'
}

function selectedReportFileName(record = selectedRecord.value) {
  const competitorNames = recordCompetitorNameList(record).join('、')
  const title = [getKindLabel(record?.kind), competitorNames, record?.feature || record?.title]
    .filter(Boolean)
    .join('-')
  return `${safeReportFileNamePart(title)}.md`
}

function quickAnalyzeSelectedReport() {
  const content = String(selectedReportCopyText.value || '').trim()
  const record = selectedRecord.value
  if (!content || !record || !isAnalysisKind(record.kind)) return
  if (record.kind === 'gap') return
  const draftId = localAnalysisRecordId(0)
  // 调用后端API，kind='gap'，传递源报告内容
  const draft = {
    id: draftId,
    projectId: effectiveProjectId.value,
    kind: 'gap',
    competitorIds: record.competitorIds || [],
    competitorNames: recordCompetitorNameList(record),
    competitorName: record.competitorName || recordCompetitorNameList(record)[0] || '',
    productUrl: record.productUrl || '',
    productUrls: record.productUrls || [],
    productName: record.productName || '',
    feature: record.feature || '',
    goal: `基于「${record.title || getKindLabel(record.kind)}」生成机会点分析`,
    sourceContent: content,
    sourceRecordId: record.id || '',
    sourceKind: record.kind || '',
    sourceTitle: record.title || getKindLabel(record.kind)
  }
  const created = mergeRecord({
    ...draft,
    status: 'running',
    statusLabel: '分析中',
    title: `机会点分析：${record.title || getKindLabel(record.kind)}`,
    summary: '正在基于源报告生成机会点分析...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  markRecordRunning(created.id)
  closeRecord()
  setActiveKind('gap')
  void runGapAnalysis(created, draft)
}

async function runGapAnalysis(runningRecord = {}, draft = {}) {
  markRecordRunning(runningRecord.id)
  statusTone.value = 'info'
  statusMessage.value = '正在生成机会点分析...'
  try {
    const createResult = await api.competitorAnalysis.createRecord(props.apiConfig, draft)
    const createdRecord = createResult.ok
      ? {
        ...runningRecord,
        ...createResult.data.record,
        status: 'running',
        statusLabel: '分析中',
        summary: createResult.data.record?.summary || runningRecord.summary,
        sourceContent: draft.sourceContent,
        sourceRecordId: draft.sourceRecordId,
        sourceKind: draft.sourceKind,
        sourceTitle: draft.sourceTitle
      }
      : runningRecord
    mergeRecord(createdRecord)
    const result = await api.competitorAnalysis.run(props.apiConfig, requestBodyForRecord(createdRecord))
    if (!result.ok) {
      mergeRecord({
        ...createdRecord,
        status: 'failed',
        statusLabel: '未完成',
        summary: result.message || '机会点分析暂时无法完成，请稍后重试。',
        markdown: result.data?.markdown || '机会点分析暂时无法完成，请稍后重试。',
        updatedAt: new Date().toISOString()
      })
      statusTone.value = 'failed'
      statusMessage.value = result.message || '机会点分析暂时无法完成。'
      return
    }
    mergeRecord({
      ...createdRecord,
      status: result.data?.ok ? 'succeeded' : 'failed',
      statusLabel: result.data?.statusLabel || (result.data?.ok ? '已生成' : '未完成'),
      title: result.data?.title || createdRecord.title,
      summary: result.data?.summary || '机会点分析已生成。',
      markdown: result.data?.markdown || '',
      updatedAt: new Date().toISOString()
    })
    statusTone.value = result.data?.ok ? 'info' : 'failed'
    statusMessage.value = result.data?.summary || '机会点分析已生成。'
  } catch (error) {
    mergeRecord({
      ...runningRecord,
      status: 'failed',
      statusLabel: '未完成',
      summary: error?.message || '机会点分析暂时无法完成，请稍后重试。',
      markdown: error?.message || '机会点分析暂时无法完成，请稍后重试。',
      updatedAt: new Date().toISOString()
    })
    statusTone.value = 'failed'
    statusMessage.value = error?.message || '机会点分析暂时无法完成。'
  } finally {
    clearRecordRunning(runningRecord.id)
    void loadRecords()
  }
}

async function copySelectedReport() {
  const text = selectedReportCopyText.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    statusTone.value = 'info'
    statusMessage.value = '已复制报告。'
  } catch (error) {
    statusTone.value = 'failed'
    statusMessage.value = '复制失败，请手动选择报告内容。'
  }
}

function downloadSelectedReport() {
  const text = selectedReportCopyText.value
  if (!text || typeof document === 'undefined') return
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = selectedReportFileName()
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function openSourceRecord() {
  if (!selectedSourceRecord.value?.id) return
  selectedRecordId.value = selectedSourceRecord.value.id
}

function persistCachedAnalysis(records = analysisRecords.value) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(cacheKey.value, JSON.stringify({
    savedAt: new Date().toISOString(),
    records
  }))
}

function loadCachedAnalysis() {
  if (typeof localStorage === 'undefined') return
  try {
    const savedText = localStorage.getItem(cacheKey.value)
    if (!savedText) return
    const saved = JSON.parse(savedText)
    if (Array.isArray(saved?.records)) analysisRecords.value = saved.records
  } catch {
    localStorage.removeItem(cacheKey.value)
  }
}

function normalizeFeatureEvents(events = []) {
  if (!Array.isArray(events)) return []
  return events
    .filter((event) => event && typeof event === 'object')
    .map((event) => ({
      id: event.id || '',
      competitorName: event.competitorName || event.competitor || '',
      featureName: event.featureName || event.feature || event.name || '',
      discoveredAt: event.discoveredAt || event.discovered_at || '',
      sourceUrls: Array.isArray(event.sourceUrls) ? event.sourceUrls : Array.isArray(event.source_urls) ? event.source_urls : [],
      sourceEntries: Array.isArray(event.sourceEntries) ? event.sourceEntries : Array.isArray(event.source_entries) ? event.source_entries : [],
      evidenceStatus: event.evidenceStatus || event.evidence_status || '',
      rawEvidence: event.rawEvidence || event.raw_evidence || event.summary || ''
    }))
    .filter((event) => event.competitorName && event.featureName)
}

function normalizeRecord(record = {}) {
  return {
    id: record.id || `local-${Date.now()}`,
    projectId: record.projectId || effectiveProjectId.value,
    kind: ['daily', 'weekly', 'flow', 'framework', 'gap'].includes(record.kind) ? record.kind : 'daily',
    title: record.title || `${getKindLabel(record.kind)}：${recordCompetitorNames(record)}`,
    status: record.status || 'pending',
    statusLabel: record.statusLabel || statusLabel(record.status),
    competitorIds: Array.isArray(record.competitorIds) ? record.competitorIds : [],
    competitorNames: Array.isArray(record.competitorNames) ? record.competitorNames : [],
    competitorName: record.competitorName || '',
    productUrl: record.productUrl || '',
    productUrls: Array.isArray(record.productUrls) ? record.productUrls : [],
    productName: record.productName || '',
    feature: record.feature || '',
    goal: record.goal || '',
    selectedFeature: record.selectedFeature || record.selected_feature || null,
    referenceScreenshots: Array.isArray(record.referenceScreenshots) ? record.referenceScreenshots : Array.isArray(record.reference_screenshots) ? record.reference_screenshots : [],
    summary: record.summary || '',
    markdown: record.markdown || '',
    interactionArtifacts: interactionArtifactsForRecord(record),
    featureEvents: normalizeFeatureEvents(record.featureEvents || record.feature_events),
    sourceFeatureEvent: normalizeFeatureEvents([record.sourceFeatureEvent || record.source_feature_event]).at(0) || null,
    monitorEvidence: record.monitorEvidence || record.monitor_evidence || null,
    sourceContent: record.sourceContent || '',
    sourceRecordId: record.sourceRecordId || '',
    sourceKind: record.sourceKind || '',
    sourceTitle: record.sourceTitle || '',
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString()
  }
}

function mergeRecord(record = {}) {
  const nextRecord = normalizeRecord(record)
  const index = analysisRecords.value.findIndex((item) => item.id === nextRecord.id)
  if (index >= 0) analysisRecords.value.splice(index, 1, { ...analysisRecords.value[index], ...nextRecord })
  else analysisRecords.value.unshift(nextRecord)
  persistCachedAnalysis()
  return nextRecord
}

function mergeBackendRecordsWithLocalRunning(records = []) {
  const backendRecords = records.map((record) => {
    const localRecord = analysisRecords.value.find((item) => item.id === record.id)
    if (!localRecord || !runningRecordIds.value.has(record.id)) return record
    return normalizeRecord({
      ...localRecord,
      ...record,
      status: record.status === 'pending' && localRecord.status === 'running' ? 'running' : record.status,
      statusLabel: record.status === 'pending' && localRecord.status === 'running' ? '分析中' : record.statusLabel,
      sourceContent: localRecord.sourceContent || record.sourceContent,
      sourceRecordId: record.sourceRecordId || localRecord.sourceRecordId,
      sourceKind: record.sourceKind || localRecord.sourceKind,
      sourceTitle: record.sourceTitle || localRecord.sourceTitle
    })
  })
  const backendIds = new Set(backendRecords.map((record) => record.id))
  const localRunningRecords = analysisRecords.value.filter((record) =>
    runningRecordIds.value.has(record.id) &&
    record.projectId === effectiveProjectId.value &&
    !backendIds.has(record.id)
  )
  return [...localRunningRecords, ...backendRecords]
}

async function loadCompetitors() {
  const requestProjectId = effectiveProjectId.value
  const result = await api.competitors.list(props.apiConfig, requestProjectId)
  if (requestProjectId !== effectiveProjectId.value) return
  if (result.ok && Array.isArray(result.data)) {
    competitors.value = result.data
  }
}

async function loadRecords() {
  const requestProjectId = effectiveProjectId.value
  const result = await api.competitorAnalysis.listRecords(props.apiConfig, {
    projectId: requestProjectId
  })
  if (requestProjectId !== effectiveProjectId.value) return
  if (result.ok && Array.isArray(result.data?.records)) {
    analysisRecords.value = mergeBackendRecordsWithLocalRunning(result.data.records.map(normalizeRecord))
    persistCachedAnalysis()
    ensureSelectedFeatureStillAvailable()
  }
}

async function loadLatestAnalysis() {
  if (analysisRecords.value.length) return
  const result = await api.competitorAnalysis.latest(props.apiConfig, {
    projectId: effectiveProjectId.value,
    kind: activeKind.value
  })
  if (!result.ok || !result.data?.markdown) return
  analysisResult.value = result.data
  if (['daily', 'weekly', 'flow', 'framework', 'gap'].includes(result.data.kind)) {
    mergeRecord({
      id: `restored-${result.data.kind}`,
      projectId: effectiveProjectId.value,
      kind: result.data.kind,
      title: result.data.title || `${getKindLabel(result.data.kind)}结果`,
      status: result.data.ok ? 'succeeded' : 'failed',
      statusLabel: result.data.statusLabel || '已恢复',
      competitorNames: [],
      summary: result.data.summary || '',
      markdown: result.data.markdown,
      createdAt: result.data.savedAt || new Date().toISOString(),
      updatedAt: result.data.savedAt || new Date().toISOString()
    })
  }
}

function openRecord(record = {}) {
  selectedRecordId.value = record.id
}

function closeRecord() {
  selectedRecordId.value = ''
}

async function deleteRecord(record = {}) {
  if (!record?.id) return
  const previousRecords = [...analysisRecords.value]
  analysisRecords.value = analysisRecords.value.filter((item) => item.id !== record.id)
  if (selectedRecordId.value === record.id) closeRecord()
  persistCachedAnalysis()

  const result = await api.competitorAnalysis.deleteRecord(props.apiConfig, {
    projectId: effectiveProjectId.value || record.projectId || 'default',
    recordId: record.id
  })
  if (!result.ok && result.status !== 'unconfigured') {
    analysisRecords.value = previousRecords
    persistCachedAnalysis()
    statusTone.value = 'failed'
    statusMessage.value = result.message || '删除失败，请稍后重试。'
    return
  }
  statusTone.value = 'info'
  statusMessage.value = '已删除分析记录。'
}

async function openAnalysisDialog() {
  analysisDialogMessage.value = ''
  analysisForm.kind = currentDialogAnalysisKind()
  await Promise.all([loadCompetitors(), loadRecords()])
  if (!analysisForm.competitorIds.length && analysisCompetitorOptions.value.length) {
    const defaultCompetitor = analysisCompetitorOptions.value[0]
    analysisForm.competitorIds = defaultCompetitor?.id ? [defaultCompetitor.id] : []
  }
  analysisForm.competitorIds = analysisForm.competitorIds.filter((id) => analysisCompetitorOptions.value.some((item) => item.id === id))
  fillDialogDefaults()
  ensureSelectedFeatureStillAvailable()
  showAnalysisDialog.value = true
}

function closeAnalysisDialog() {
  showAnalysisDialog.value = false
  analysisDialogMessage.value = ''
}

function openCreateDialog() {
  editingCompetitorId.value = ''
  createForm.name = ''
  createForm.websiteUrl = ''
  showCreateDialog.value = true
}

function closeCreateDialog() {
  showCreateDialog.value = false
  editingCompetitorId.value = ''
}

function openEditCompetitorDialog(competitor = {}) {
  editingCompetitorId.value = competitor.id || ''
  createForm.name = competitor.name || ''
  createForm.websiteUrl = competitor.websiteUrl || ''
  showCreateDialog.value = true
}

function competitorOptionId(name = '', websiteUrl = '') {
  const source = `${name || 'competitor'}-${websiteUrl || ''}`.trim()
  return `competitor-option-${source.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')}`
}

function competitorOptionIdsForItem(item = {}) {
  return [
    String(item.id || '').trim(),
    competitorOptionId(item.name || item.competitorName || item.productName || '', item.websiteUrl || item.productUrl || '')
  ].filter(Boolean)
}

function addAnalysisCompetitorOption(map = new Map(), item = {}) {
  const name = String(item.name || item.competitorName || item.productName || '').trim()
  if (!name) return
  const websiteUrl = String(item.websiteUrl || item.productUrl || '').trim()
  const id = String(item.id || competitorOptionId(name, websiteUrl)).trim()
  const key = `${name.toLowerCase()}::${websiteUrl.toLowerCase()}`
  const existing = map.get(key)
  map.set(key, {
    id: existing?.id || id,
    name,
    websiteUrl: existing?.websiteUrl || websiteUrl,
    source: item.id ? 'competitor' : 'record'
  })
}

function analysisCompetitorOptionLabel(item = {}) {
  return item.websiteUrl ? `${item.name}（${item.websiteUrl}）` : item.name
}

function pruneDeletedCompetitorReferences(competitor = {}, deletedOptionIds = competitorOptionIdsForItem(competitor)) {
  if (listFilters.competitor === competitor.name) listFilters.competitor = 'all'
  analysisForm.competitorIds = analysisForm.competitorIds.filter((id) => !deletedOptionIds.includes(id))
  fillDialogDefaults()
  ensureSelectedFeatureStillAvailable()
}

function handleAnalysisCompetitorChange(value = []) {
  analysisDialogMessage.value = ''
  const selectedIds = Array.isArray(value) ? value : []
  const realIds = analysisCompetitorOptions.value.map((item) => item.id)
  if (selectedIds.includes('__all__')) {
    analysisForm.competitorIds = allCompetitorsSelected.value ? [] : realIds
  } else {
    analysisForm.competitorIds = selectedIds.filter((id) => realIds.includes(id))
  }
  fillDialogDefaults()
  ensureSelectedFeatureStillAvailable()
}

function selectedCompetitors() {
  return analysisCompetitorOptions.value.filter((item) => analysisForm.competitorIds.includes(item.id))
}

function competitorDisplayName(item = {}) {
  return item.name || analysisForm.competitorName || analysisForm.productName || '未命名竞品'
}

function competitorWebsiteUrl(item = {}) {
  return item.websiteUrl || analysisForm.productUrl || ''
}

function recordsForSelectedCompetitors() {
  const selected = selectedCompetitors()
  if (['daily', 'weekly'].includes(analysisForm.kind)) {
    const names = selected.map(competitorDisplayName)
    const urls = selected.map(competitorWebsiteUrl)
    return [{
      projectId: effectiveProjectId.value,
      kind: analysisForm.kind,
      competitorIds: selected.map((item) => item.id).filter(Boolean),
      competitorNames: selected.map(competitorDisplayName),
      productUrls: selected.map(competitorWebsiteUrl),
      feature: '',
      goal: '',
      competitorName: selected.map(competitorDisplayName).join('、'),
      productUrl: urls[0] || '',
      productName: names.join('、')
    }]
  }
  return selected.map((item) => {
    const name = competitorDisplayName(item)
    const websiteUrl = competitorWebsiteUrl(item)
    return {
      projectId: effectiveProjectId.value,
      kind: analysisForm.kind,
      competitorIds: [item.id],
      competitorNames: [name],
      productUrls: [websiteUrl],
      feature: analysisRequiresScopeFields.value ? analysisForm.feature?.trim() || '' : '',
      goal: analysisRequiresScopeFields.value ? analysisForm.goal?.trim() || '' : '',
      selectedFeature: analysisRequiresScopeFields.value ? analysisForm.selectedFeature : null,
      referenceScreenshots: analysisRequiresScopeFields.value ? analysisForm.referenceScreenshots : [],
      competitorName: name,
      productUrl: websiteUrl,
      productName: name
    }
  })
}

function setDialogKind(kind = 'daily') {
  analysisDialogMessage.value = ''
  setActiveKind(kind)
  ensureSelectedFeatureStillAvailable()
}

function fillDialogDefaults() {
  const selected = selectedCompetitors()
  const first = selected[0] || {}
  const firstName = first.name || analysisForm.competitorName || analysisForm.productName || ''
  const firstUrl = first.websiteUrl || analysisForm.productUrl || ''
  analysisForm.competitorName = firstName
  analysisForm.productUrl = firstUrl
  analysisForm.productName = firstName
}

function requestBodyForRecord(record = {}) {
  const names = Array.isArray(record.competitorNames) ? record.competitorNames.filter(Boolean) : []
  const firstId = Array.isArray(record.competitorIds) ? record.competitorIds[0] : ''
  const savedCompetitor = competitors.value.find((item) => item.id === firstId) || {}
  const body = {
    projectId: effectiveProjectId.value,
    recordId: record.id,
    kind: record.kind,
    competitorIds: record.competitorIds,
    competitorNames: names,
    competitor: record.competitorName || names[0] || '',
    feature: record.feature || '',
    productUrls: record.productUrls,
    productUrl: record.productUrl || savedCompetitor.websiteUrl || '',
    productName: record.productName || names[0] || '',
    goal: record.goal || '',
    selectedFeature: record.selectedFeature || null,
    referenceScreenshots: record.referenceScreenshots || [],
    sourceFeatureEvent: record.sourceFeatureEvent,
    monitorEvidence: record.monitorEvidence
  }
  if (record.kind === 'gap') {
    body.sourceContent = record.sourceContent || record.markdown || ''
    body.sourceRecordId = record.sourceRecordId || ''
    body.sourceKind = record.sourceKind || ''
    body.sourceTitle = record.sourceTitle || ''
  }
  return body
}

function localAnalysisRecordId(index = 0) {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`
  return `competitor-analysis-client-${randomPart}`
}

function markRecordRunning(id = '') {
  if (!id) return
  runningRecordIds.value = new Set([...runningRecordIds.value, id])
}

function clearRecordRunning(id = '') {
  if (!id) return
  const next = new Set(runningRecordIds.value)
  next.delete(id)
  runningRecordIds.value = next
}

function analysisDialogValidationMessage() {
  if (!analysisForm.kind) return '请选择分析类型。'
  if (!analysisForm.competitorIds.length || !selectedCompetitors().length) return '请选择至少一个竞品。'
  if (analysisRequiresScopeFields.value && !analysisForm.feature?.trim()) return '请选择一个已发现功能；如果暂未发现，可以先生成完整框架或上传截图参考。'
  return ''
}

async function handleConfirmAnalysis() {
  const kind = currentDialogAnalysisKind()
  analysisForm.kind = kind
  ensureSelectedFeatureStillAvailable()
  const validationMessage = analysisDialogValidationMessage()
  if (validationMessage) {
    statusTone.value = 'failed'
    analysisDialogMessage.value = validationMessage
    return
  }
  submittingAnalysis.value = true
  statusTone.value = 'info'
  statusMessage.value = '正在创建分析记录...'
  analysisDialogMessage.value = ''
  try {
    const drafts = recordsForSelectedCompetitors().map((draft, index) => ({
      ...draft,
      id: draft.id || localAnalysisRecordId(index),
      status: 'running',
      statusLabel: '分析中',
      summary: '分析任务已创建，正在调用竞品分析引擎。',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    if (!drafts.length) {
      statusTone.value = 'failed'
      analysisDialogMessage.value = '请选择至少一个竞品。'
      return
    }
    closeAnalysisDialog()
    setActiveKind(kind)
    const createdRecords = drafts.map((draft) => mergeRecord(draft))
    await nextTick()
    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index]
      const createResult = await api.competitorAnalysis.createRecord(props.apiConfig, draft)
      createdRecords[index] = mergeRecord(createResult.ok ? {
        ...draft,
        ...createResult.data.record,
        status: 'running',
        statusLabel: '分析中',
        summary: createResult.data.record?.summary || draft.summary
      } : draft)
    }
    const firstRecord = createdRecords[0] || {}
    if (Array.isArray(firstRecord.competitorIds) && firstRecord.competitorIds.length) {
      analysisForm.competitorIds = [...firstRecord.competitorIds]
    }
    const runTasks = createdRecords.map((record) => runAnalysisForRecord(record))
    statusMessage.value = `已提交 ${createdRecords.length} 个分析任务，后台会陆续更新结果。`
    void Promise.allSettled(runTasks).then(() => loadRecords())
  } catch (error) {
    statusTone.value = 'failed'
    statusMessage.value = error?.message || '分析记录创建失败，请稍后重试。'
  } finally {
    submittingAnalysis.value = false
  }
}

async function runAnalysisForRecord(record = {}) {
  const runningRecord = mergeRecord({
    ...record,
    status: 'running',
    statusLabel: '分析中',
    updatedAt: new Date().toISOString()
  })
  markRecordRunning(runningRecord.id)
  statusMessage.value = '正在调用竞品分析引擎...'
  try {
    const result = await api.competitorAnalysis.run(props.apiConfig, requestBodyForRecord(runningRecord))
    if (!result.ok) {
      const failed = mergeRecord({
        ...runningRecord,
        status: 'failed',
        statusLabel: '未完成',
        summary: result.message || '竞品分析暂时无法完成，请稍后重试。',
        markdown: result.data?.markdown || '竞品分析暂时无法完成，请稍后重试。',
        updatedAt: new Date().toISOString()
      })
      statusTone.value = 'failed'
      statusMessage.value = failed.summary
      return
    }
    const completed = mergeRecord({
      ...runningRecord,
      status: result.data?.ok ? 'succeeded' : 'failed',
      statusLabel: result.data?.statusLabel || (result.data?.ok ? '已生成' : '未完成'),
      title: result.data?.title || runningRecord.title,
      summary: result.data?.summary || '分析已返回。',
      markdown: result.data?.markdown || '',
      interactionArtifacts: result.data?.interactionArtifacts || runningRecord.interactionArtifacts,
      featureEvents: result.data?.featureEvents || runningRecord.featureEvents,
      updatedAt: new Date().toISOString()
    })
    statusTone.value = completed.status === 'succeeded' ? 'info' : 'failed'
    statusMessage.value = completed.summary || '分析已返回。'
  } catch (error) {
    const failed = mergeRecord({
      ...runningRecord,
      status: 'failed',
      statusLabel: '未完成',
      summary: error?.message || '竞品分析暂时无法完成，请稍后重试。',
      markdown: error?.message || '竞品分析暂时无法完成，请稍后重试。',
      updatedAt: new Date().toISOString()
    })
    statusTone.value = 'failed'
    statusMessage.value = failed.summary
  } finally {
    clearRecordRunning(runningRecord.id)
  }
}

async function deepAnalyzeFeatureEvent(event = {}) {
  const featureName = featureEventName(event)
  const competitorName = featureEventCompetitorName(event)
  if (!featureName || !competitorName) return
  statusTone.value = 'info'
  statusMessage.value = '正在创建新功能深度分析记录...'
  try {
    if (!competitors.value.length) await loadCompetitors()
    const sourceRecord = selectedRecord.value || {}
    const competitor = competitorForFeatureEvent(event) || {}
    const productUrl = productUrlForFeatureEvent(event, sourceRecord)
    const draft = {
      projectId: effectiveProjectId.value,
      kind: 'flow',
      competitorIds: competitor.id ? [competitor.id] : [],
      competitorNames: [competitorName],
      competitorName,
      productName: competitorName,
      productUrl,
      productUrls: productUrl ? [productUrl] : [],
      feature: featureEventName(event),
      goal: `基于监控报告发现的新功能「${featureName}」，抓取完整交互流程。`,
      sourceFeatureEvent: event,
      monitorEvidence: {
        recordId: sourceRecord.id || '',
        kind: sourceRecord.kind || '',
        title: sourceRecord.title || '',
        summary: sourceRecord.summary || '',
        markdown: sourceRecord.markdown || ''
      }
    }
    const createResult = await api.competitorAnalysis.createRecord(props.apiConfig, draft)
    const created = mergeRecord(createResult.ok ? createResult.data.record : draft)
    setActiveKind('flow')
    closeRecord()
    selectedRecordId.value = created.id
    void Promise.allSettled([runAnalysisForRecord(created)]).then(() => loadRecords())
    statusMessage.value = '已提交深度分析任务，后台会自动更新结果。'
  } catch (error) {
    statusTone.value = 'failed'
    statusMessage.value = error?.message || '深度分析创建失败，请稍后重试。'
  }
}

async function handleCreateCompetitor() {
  return handleSaveCompetitor()
}

async function handleSaveCompetitor() {
  const name = createForm.name.trim()
  const websiteUrl = createForm.websiteUrl.trim()
  if (!name || !websiteUrl) {
    statusTone.value = 'failed'
    statusMessage.value = '请填写竞品名称和官网地址。'
    return
  }
  creatingCompetitor.value = true
  try {
    const payload = {
      projectId: effectiveProjectId.value,
      name,
      websiteUrl
    }
    const result = editingCompetitorId.value
      ? await api.competitors.update(props.apiConfig, editingCompetitorId.value, payload)
      : await api.competitors.create(props.apiConfig, payload)
    if (!result.ok) {
      statusTone.value = 'failed'
      statusMessage.value = result.message || `${editingCompetitorId.value ? '编辑' : '新增'}竞品失败，请检查官网地址。`
      return
    }
    competitors.value = [result.data, ...competitors.value.filter((item) => item.id !== result.data.id)]
    analysisForm.competitorIds = [result.data.id]
    fillDialogDefaults()
    statusTone.value = 'info'
    statusMessage.value = `${editingCompetitorId.value ? '已更新' : '已新增'}竞品：${result.data.name}`
    closeCreateDialog()
  } finally {
    creatingCompetitor.value = false
  }
}

async function deleteCompetitor(competitor = {}) {
  if (!competitor?.id || creatingCompetitor.value) return
  const previousCompetitors = [...competitors.value]
  const previousSelectedCompetitorIds = [...analysisForm.competitorIds]
  const previousFilterCompetitor = listFilters.competitor
  const deletedOptionIds = competitorOptionIdsForItem(competitor)
  competitors.value = competitors.value.filter((item) => item.id !== competitor.id)
  if (listFilters.competitor === competitor.name) listFilters.competitor = 'all'
  analysisForm.competitorIds = analysisForm.competitorIds.filter((id) => !deletedOptionIds.includes(id))
  pruneDeletedCompetitorReferences(competitor, deletedOptionIds)
  const result = await api.competitors.delete(props.apiConfig, competitor.id, {
    projectId: effectiveProjectId.value || competitor.projectId || 'default'
  })
  if (!result.ok) {
    competitors.value = previousCompetitors
    analysisForm.competitorIds = previousSelectedCompetitorIds
    listFilters.competitor = previousFilterCompetitor
    fillDialogDefaults()
    statusTone.value = 'failed'
    statusMessage.value = result.message || '删除竞品失败，请稍后重试。'
    return
  }
  await refreshPageData()
  pruneDeletedCompetitorReferences(competitor, deletedOptionIds)
  statusTone.value = 'info'
  statusMessage.value = `已删除竞品：${competitor.name || '未命名竞品'}`
}

function detailMarkdownForRecord(record = {}) {
  return String(record?.markdown || '').trim()
}

function cleanMarkdownText(value = '') {
  return String(value || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function splitMarkdownTableRow(line = '') {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cleanMarkdownText(cell))
}

function isMarkdownTableSeparator(line = '') {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''))
}

function isMarkdownFence(line = '') {
  return /^```\s*(\S+)?\s*$/.test(String(line || '').trim())
}

function markdownBlocksFor(markdown = '') {
  const lines = String(markdown || '').split(/\r?\n/)
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] || ''
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }

    const fence = trimmed.match(/^```\s*(\S+)?\s*$/)
    if (fence) {
      const language = cleanMarkdownText(fence[1] || '')
      const codeLines = []
      index += 1
      while (index < lines.length && !isMarkdownFence(lines[index])) {
        codeLines.push(lines[index] || '')
        index += 1
      }
      if (index < lines.length && isMarkdownFence(lines[index])) {
        index += 1
      }
      blocks.push({ type: 'code', language, text: codeLines.join('\n').trim() })
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: cleanMarkdownText(heading[2]) })
      index += 1
      continue
    }

    if (trimmed.includes('|') && isMarkdownTableSeparator(lines[index + 1] || '')) {
      const headers = splitMarkdownTableRow(trimmed)
      index += 2
      const rows = []
      while (index < lines.length && lines[index]?.trim()?.includes('|')) {
        rows.push(splitMarkdownTableRow(lines[index]).slice(0, headers.length))
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items = []
      while (index < lines.length) {
        const itemLine = lines[index]?.trim() || ''
        const match = ordered ? itemLine.match(/^\d+\.\s+(.+)$/) : itemLine.match(/^[-*]\s+(.+)$/)
        if (!match) break
        items.push(cleanMarkdownText(match[1]))
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      blocks.push({ type: 'quote', text: cleanMarkdownText(trimmed.replace(/^>\s?/, '')) })
      index += 1
      continue
    }

    const paragraph = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = lines[index]?.trim() || ''
      if (!next || isMarkdownFence(next) || /^#{1,4}\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next) || /^>\s?/.test(next) || (next.includes('|') && isMarkdownTableSeparator(lines[index + 1] || ''))) break
      paragraph.push(next)
      index += 1
    }
    blocks.push({ type: 'paragraph', text: cleanMarkdownText(paragraph.join(' ')) })
  }
  return blocks
}

function normalizeMarkdownHeader(value = '') {
  return cleanMarkdownText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function headingContextText(headings = []) {
  return headings.filter(Boolean).join(' / ')
}

function markdownHeaderMatches(header = '', aliases = []) {
  const normalizedHeader = normalizeMarkdownHeader(header)
  return aliases.some((alias) => {
    const normalizedAlias = normalizeMarkdownHeader(alias)
    return normalizedHeader === normalizedAlias ||
      normalizedHeader.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedHeader)
  })
}

function markdownHeadingMatches(headingContext = '', aliases = []) {
  const normalizedContext = normalizeMarkdownHeader(headingContext)
  return aliases.some((alias) => normalizedContext.includes(normalizeMarkdownHeader(alias)))
}

function markdownHeaderIndex(headers = [], aliases = []) {
  return headers.findIndex((header) => markdownHeaderMatches(header, aliases))
}

function markdownHasHeader(headers = [], aliases = []) {
  return markdownHeaderIndex(headers, aliases) >= 0
}

function classifyMarkdownTableBlock(block = {}, headingContext = '') {
  const headers = block.headers || []
  if (
    markdownHasHeader(headers, ['S编号', '步骤编号', '编号']) &&
    markdownHasHeader(headers, ['起点', '起始页面', '源页面']) &&
    markdownHasHeader(headers, ['终点', '目标页面', '去向'])
  ) {
    return 'flow-table'
  }
  if (
    markdownHasHeader(headers, ['当前状态', '当前状态ST编号', '起始状态', '起始状态ST编号']) &&
    markdownHasHeader(headers, ['目标状态', '目标状态ST编号']) &&
    markdownHasHeader(headers, ['转换条件', '触发条件', '条件'])
  ) {
    return 'state-machine-table'
  }
  if (
    markdownHasHeader(headers, ['P编号', '页面编号', '编号']) &&
    markdownHasHeader(headers, ['页面名称', '页面弹窗名称', '页面/弹窗名称', '名称']) &&
    (markdownHasHeader(headers, ['目的', '页面目的', '定位']) || markdownHeadingMatches(headingContext, ['页面总览', '页面框架']))
  ) {
    return 'page-overview-table'
  }
  if (markdownHeadingMatches(headingContext, ['信息架构']) && headers.length) {
    return 'architecture-map'
  }
  return 'table'
}

function enhancedMarkdownBlocksFor(markdown = '') {
  const blocks = markdownBlocksFor(markdown)
  const headingStack = []
  return blocks.map((block) => {
    if (block.type === 'heading') {
      headingStack[block.level - 1] = block.text
      headingStack.length = block.level
      return block
    }
    const headingContext = headingContextText(headingStack)
    if (block.type === 'table') {
      return {
        ...block,
        type: classifyMarkdownTableBlock(block, headingContext),
        headingContext
      }
    }
    if (
      markdownHeadingMatches(headingContext, ['信息架构']) &&
      ['list', 'code'].includes(block.type)
    ) {
      return {
        ...block,
        type: 'architecture-map',
        headingContext
      }
    }
    return { ...block, headingContext }
  })
}

function markdownCell(block = {}, row = [], aliases = []) {
  const index = markdownHeaderIndex(block.headers || [], aliases)
  if (index < 0) return ''
  return cleanMarkdownText(row[index] || '')
}

function flowRowsForBlock(block = {}) {
  return (block.rows || []).map((row) => ({
    id: markdownCell(block, row, ['S编号', '步骤编号', '编号']),
    from: markdownCell(block, row, ['起点', '起始页面', '源页面']),
    to: markdownCell(block, row, ['终点', '目标页面', '去向']),
    action: markdownCell(block, row, ['触发操作', '触发动作', '操作']),
    condition: markdownCell(block, row, ['前置条件', '条件']),
    confidence: markdownCell(block, row, ['证据置信度', '置信度', '证据'])
  }))
}

function stateRowsForBlock(block = {}) {
  return (block.rows || []).map((row) => ({
    id: markdownCell(block, row, ['TR编号', 'S编号', '编号']),
    from: markdownCell(block, row, ['当前状态', '当前状态ST编号', '起始状态', '起始状态ST编号']),
    to: markdownCell(block, row, ['目标状态', '目标状态ST编号']),
    condition: markdownCell(block, row, ['转换条件', '触发条件', '条件']),
    reversible: markdownCell(block, row, ['可逆']),
    evidence: markdownCell(block, row, ['证据', '置信度', '证据置信度'])
  }))
}

function pageRowsForBlock(block = {}) {
  return (block.rows || []).map((row) => ({
    id: markdownCell(block, row, ['P编号', '页面编号', '编号']),
    name: markdownCell(block, row, ['页面名称', '页面弹窗名称', '页面/弹窗名称', '名称']),
    type: markdownCell(block, row, ['类型', '页面类型']),
    purpose: markdownCell(block, row, ['目的', '页面目的', '页面定位', '定位']),
    mainArea: markdownCell(block, row, ['主要区域', '核心区域', '页面框架', '框架']),
    primaryAction: markdownCell(block, row, ['关键操作', '主操作', '核心操作']),
    evidence: markdownCell(block, row, ['证据置信度', '置信度', '证据'])
  }))
}

function architectureItemsForBlock(block = {}) {
  if (block.type === 'architecture-map' && Array.isArray(block.rows) && block.rows.length) {
    return block.rows.map((row) => {
      const cells = row.map(cleanMarkdownText).filter(Boolean)
      return {
        title: cells[0] || '未命名模块',
        detail: cells.slice(1).map((cell, index) => {
          const header = block.headers?.[index + 1] || ''
          return header ? `${header}：${cell}` : cell
        }).join('；')
      }
    })
  }
  if (Array.isArray(block.items) && block.items.length) {
    return block.items.map((item) => ({ title: cleanMarkdownText(item), detail: '' }))
  }
  return String(block.text || '')
    .split(/\n+/)
    .map((line) => cleanMarkdownText(line))
    .filter(Boolean)
    .map((line) => ({ title: line, detail: '' }))
}

function firstUrlInText(value = '') {
  return String(value || '').match(/https?:\/\/[^\s，；、)）|]+/)?.[0] || ''
}

function frameworkRowTypeForBlock(block = {}) {
  const headers = block.headers || []
  const headingContext = block.headingContext || ''
  if (markdownHasHeader(headers, ['模块编号']) || markdownHasHeader(headers, ['功能模块'])) return '功能模块'
  if (markdownHasHeader(headers, ['页面编号', 'P编号']) || markdownHasHeader(headers, ['页面名称'])) return '页面清单'
  if (markdownHasHeader(headers, ['异常场景'])) return '异常流程'
  if (markdownHasHeader(headers, ['决策内容', '决策'])) return '决策点'
  if (markdownHasHeader(headers, ['起始状态', '当前状态']) || markdownHasHeader(headers, ['目标状态'])) return '状态流'
  if (markdownHasHeader(headers, ['源功能']) || markdownHasHeader(headers, ['目标功能']) || markdownHasHeader(headers, ['关联类型'])) return '跨功能关联'
  if (markdownHeadingMatches(headingContext, ['信息架构'])) return '信息架构'
  return '框架条目'
}

function frameworkRowNameForBlock(block = {}, row = [], fallback = '') {
  const direct = markdownCell(block, row, [
    '功能模块',
    '页面名称',
    '页面弹窗名称',
    '名称',
    '决策内容',
    '异常场景',
    '源功能',
    '目标功能',
    '实体'
  ])
  if (direct) return direct
  return row
    .map(cleanMarkdownText)
    .find((cell) => cell && !/^https?:\/\//.test(cell) && !/^[-—]+$/.test(cell)) || fallback
}

function frameworkRowFromMarkdownTable(block = {}, row = [], rowIndex = 0, globalIndex = 0) {
  const headers = block.headers || []
  const cells = row.map(cleanMarkdownText)
  const meaningfulCells = cells.filter((cell) => cell && !/^[-—]+$/.test(cell))
  if (!meaningfulCells.length) return null
  const joined = meaningfulCells.join(' ')
  if (/LLM\s*不可用|待分析/.test(joined) && meaningfulCells.length <= 3) return null

  const code = markdownCell(block, row, ['模块编号', '页面编号', 'P编号', '编号', '序号', 'TR编号', 'S编号']) || `R${globalIndex + 1}`
  const entry = markdownCell(block, row, ['入口路径', 'URL', '链接', '目标地址', '功能入口', '入口'])
  const entryUrl = firstUrlInText(entry || joined)
  const typeLabel = frameworkRowTypeForBlock(block)
  const context = block.headingContext || ''
  const details = headers
    .map((header, index) => ({
      key: `${globalIndex}-${index}-${header}`,
      label: header || `字段 ${index + 1}`,
      value: cells[index] || ''
    }))
    .filter((item) => item.value)

  return {
    id: `${typeLabel}-${code}-${rowIndex}-${globalIndex}`,
    code,
    typeLabel,
    name: frameworkRowNameForBlock(block, row, `条目 ${globalIndex + 1}`),
    level: markdownCell(block, row, ['所属层级', '层级', '页面类型', '类型', '复杂度']),
    entry,
    entryUrl,
    prerequisite: markdownCell(block, row, ['前置条件', '条件', '触发条件', '决策依据']),
    context,
    details: details.length ? details : [{ key: `${globalIndex}-raw`, label: '原始内容', value: joined }]
  }
}

function frameworkRowsForMarkdown(markdown = '') {
  const rows = []
  for (const block of enhancedMarkdownBlocksFor(markdown)) {
    if (!Array.isArray(block.rows) || !block.rows.length) continue
    for (const [rowIndex, row] of block.rows.entries()) {
      const item = frameworkRowFromMarkdownTable(block, row, rowIndex, rows.length)
      if (item) rows.push(item)
    }
  }
  return rows.slice(0, 300)
}

function markdownBlockKey(block = {}, index = 0) {
  return `${block.type || 'block'}-${index}-${block.text || block.headers?.join('-') || ''}`
}

function interactionArtifactsForRecord(record = {}) {
  const artifacts = record?.interactionArtifacts || {}
  const pageDoc = record?.pageInteractionDocument || artifacts.pageInteractionDocument || {}
  const documentMarkdown = artifacts.documentMarkdown || pageDoc.markdown || record?.flowMarkdown || detailMarkdownForRecord(record)
  if (/LLM\s*不可用|搜索结果原始信息/.test(`${record?.markdown || ''}\n${documentMarkdown || ''}`)) {
    return {
      documentMarkdown,
      mainFlowFile: '',
      stateDiagramFile: '',
      lowFiWireframeImages: [],
      stateMatrix: [],
      transitions: [],
      evidenceStatus: artifacts.evidenceStatus || artifacts.evidence_status || 'not_found',
      evidenceQuality: artifacts.evidenceQuality || artifacts.evidence_quality || '',
      evidenceCount: artifacts.evidenceCount || artifacts.evidence_count || 0,
      evidenceReason: artifacts.evidenceReason || artifacts.evidence_reason || '未生成阶段二规范产物。',
      similarFeatures: []
    }
  }
  return {
    documentMarkdown,
    mainFlowFile: artifacts.mainFlowFile || artifacts.mainFlowDiagram || artifactByBuiltKey(artifacts, 'mainFlow') || artifactByBuiltKey(pageDoc, 'mainFlow') || '',
    stateDiagramFile: artifacts.stateDiagramFile || artifacts.stateDiagram || artifactByBuiltKey(artifacts, 'stateDiagram') || artifactByBuiltKey(pageDoc, 'stateDiagram') || '',
    lowFiWireframeImages: normalizeArtifactList(artifacts.lowFiWireframeImages || artifacts.wireframeImages || pageDoc.lowFiWireframeImages),
    stateMatrix: normalizeArtifactList(artifacts.stateMatrix || pageDoc.stateMatrix),
    transitions: normalizeArtifactList(artifacts.transitions || artifacts.stateTransitions || pageDoc.transitions),
    evidenceStatus: artifacts.evidenceStatus || artifacts.evidence_status || '',
    evidenceQuality: artifacts.evidenceQuality || artifacts.evidence_quality || '',
    evidenceCount: artifacts.evidenceCount || artifacts.evidence_count || 0,
    evidenceReason: artifacts.evidenceReason || artifacts.evidence_reason || ''
  }
}

function diagramFileLabel(name = '') {
  return `${String.fromCharCode(68, 114, 97, 119)}.io ${name}`
}

function artifactByBuiltKey(value = {}, prefix = '') {
  const suffix = String.fromCharCode(68, 114, 97, 119) + 'io'
  return value?.[`${prefix}${suffix}`]
}

function normalizeArtifactList(value = []) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function artifactBlockText(value = '') {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    return String(value.content || value.markdown || value.xml || value.code || value.fileName || value.name || value.status || '').trim()
  }
  return String(value).trim()
}

function diagramAssetAvailable(value = '') {
  return Boolean(artifactDiagramPreviewUrl(value) || artifactBlockText(value))
}

function diagramAssetLabel(value = '', fallback = '流程图') {
  if (value && typeof value === 'object') return value.title || value.name || value.label || fallback
  return fallback
}

function diagramAssetBody(value = '') {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') return String(value.content || value.xml || value.code || '').trim()
  return String(value).trim()
}

function decodeDiagramValue(value = '') {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function diagramLabelsFromBody(value = '') {
  return [...String(value || '').matchAll(/value="([^"]+)"/g)]
    .map((match) => decodeDiagramValue(match[1]).trim())
    .filter(Boolean)
    .slice(0, 8)
}

function svgText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDiagramSvgUrl(title = '', labels = []) {
  const items = labels.length ? labels : [title || '流程图']
  const width = Math.max(720, items.length * 160 + 80)
  const nodes = items.map((label, index) => {
    const x = 40 + index * 160
    const edge = index ? `<path d="M${x - 32} 126 H${x - 8}" stroke="#667085" stroke-width="2" fill="none"/><path d="M${x - 8} 126 l-8 -5 v10 z" fill="#667085"/>` : ''
    return `${edge}<rect x="${x}" y="92" width="124" height="68" rx="12" fill="#ffffff" stroke="#d0d5dd"/><text x="${x + 62}" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1f2329">${svgText(label).slice(0, 28)}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="220" viewBox="0 0 ${width} 220"><rect width="${width}" height="220" fill="#f8fafc"/><text x="40" y="44" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#1f2329">${svgText(title || '流程图')}</text>${nodes}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function artifactDiagramPreviewUrl(value = '') {
  if (typeof value === 'string' && value.startsWith('data:image/')) return value
  if (value && typeof value === 'object' && value.previewUrl) return value.previewUrl
  const body = diagramAssetBody(value)
  if (!body) return ''
  return buildDiagramSvgUrl(diagramAssetLabel(value), diagramLabelsFromBody(body))
}

function artifactDiagramFileUrl(value = '') {
  const body = diagramAssetBody(value)
  if (!body) return artifactDiagramPreviewUrl(value)
  return `data:text/xml;charset=utf-8,${encodeURIComponent(body)}`
}

function artifactDiagramDownloadName(value = '', fallback = '流程图') {
  if (value && typeof value === 'object' && value.fileName) return value.fileName
  const suffix = String.fromCharCode(100, 114, 97, 119, 105, 111)
  return `${diagramAssetLabel(value, fallback)}.${suffix}`
}

function artifactImageUrl(item = {}) {
  if (typeof item === 'string') return item
  return item.url || item.path || item.image || ''
}

function artifactImageLabel(item = {}) {
  if (typeof item === 'string') return '低保真线框图'
  return item.title || item.name || item.label || '低保真线框图'
}

function artifactImageKey(item = {}) {
  return `${artifactImageLabel(item)}-${artifactImageUrl(item)}`
}

function artifactStateTitle(item = {}) {
  if (typeof item === 'string') return item
  return item.state || item.label || item.event || item.from || item.id || '状态'
}

function artifactStateDetail(item = {}) {
  if (typeof item === 'string') return item
  const parts = [
    item.trigger || item.event ? `触发：${item.trigger || item.event}` : '',
    item.from || item.to ? `流转：${item.from || '当前'} -> ${item.to || '目标'}` : '',
    item.feedback ? `反馈：${item.feedback}` : '',
    item.recovery ? `恢复：${item.recovery}` : '',
    item.description || item.detail || item.note || ''
  ].filter(Boolean)
  return parts.join('；') || '已记录'
}

function artifactStateKey(item = {}) {
  return `${artifactStateTitle(item)}-${artifactStateDetail(item)}`
}

async function refreshPageData() {
  loadCachedAnalysis()
  await Promise.all([loadCompetitors(), loadRecords()])
  // Current project records are authoritative. Do not auto-hydrate global temp reports into an empty list.
}

onMounted(() => {
  void refreshPageData()
})

watch(() => activeKind.value, (kind) => {
  void refreshActiveKindData(kind)
}, { immediate: true })

watch(selectedFeatureEvents, (events) => {
  if (!events.length) {
    selectedFeatureEventId.value = ''
    return
  }
  const currentExists = events.some((event) => featureEventKey(event) === selectedFeatureEventId.value)
  if (!currentExists) selectedFeatureEventId.value = featureEventKey(events.at(0))
}, { immediate: true })

watch(() => props.projectId, () => {
  selectedRecordId.value = ''
  selectedFeatureEventId.value = ''
  analysisRecords.value = []
  competitors.value = []
  statusMessage.value = ''
  statusTone.value = 'info'
  analysisForm.competitorIds = []
  void refreshPageData()
})
</script>

<style scoped>
.competitor-analysis-page {
  display: grid;
  gap: 20px;
  padding: 0;
  --el-color-primary: var(--color-primary);
  --el-color-primary-dark-2: var(--color-primary-active);
  --el-color-primary-light-3: var(--color-n6);
  --el-color-primary-light-5: var(--color-n5);
  --el-color-primary-light-7: var(--color-n3);
  --el-color-primary-light-8: var(--color-n2);
  --el-color-primary-light-9: var(--color-n1);
  --el-border-radius-base: var(--radius-small);
}

.competitor-analysis-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
}

.competitor-analysis-tab-stack {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.competitor-analysis-actions,
.competitor-analysis-dialog footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.competitor-analysis-primary-tabs {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 44px;
  min-width: 0;
}

.competitor-analysis-secondary-tabs {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow-x: auto;
}

.competitor-analysis-primary-tabs :deep(.ui-tab) {
  min-height: 44px;
  padding-bottom: 8px;
  color: var(--color-n4);
  font-size: 28px;
  font-weight: 800;
  line-height: 36px;
  letter-spacing: 0;
}

.competitor-analysis-secondary-tabs :deep(.ui-secondary-tabs) {
  width: max-content;
}

.competitor-analysis-primary-tabs :deep(.ui-tab:hover),
.competitor-analysis-primary-tabs :deep(.ui-tab.is-active) {
  color: var(--color-primary);
}

.competitor-analysis-primary-tabs :deep(.ui-tab.is-active::after) {
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
}

.competitor-analysis-button-icon {
  width: 16px;
  height: 16px;
}

.competitor-analysis-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.competitor-analysis-filter-left,
.competitor-analysis-filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.competitor-analysis-filter-left {
  flex: 1 1 auto;
}

.competitor-analysis-filter-right {
  flex: 0 0 auto;
}

.competitor-analysis-filter-search {
  width: 240px;
  --el-color-primary: var(--color-primary);
  --el-input-focus-border-color: var(--color-primary);
  --el-input-hover-border-color: var(--color-n3);
  --el-input-text-color: var(--color-n7);
  --el-input-placeholder-color: var(--color-n4);
  --el-input-border-radius: var(--radius-small);
  --el-border-radius-base: var(--radius-small);
}

.competitor-analysis-filter-search :deep(.el-input__wrapper) {
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-small);
  box-shadow: 0 0 0 1px var(--color-n2) inset;
}

.competitor-analysis-filter-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-primary) inset, 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.competitor-analysis-search-icon {
  width: 18px;
  height: 18px;
  color: var(--color-n5);
}

.competitor-analysis-filter-search :deep(.el-input__inner) {
  color: var(--color-n7);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.competitor-analysis-filter-field {
  flex: 0 0 auto;
  width: 136px;
  min-width: 0;
  --el-color-primary: var(--color-primary);
  --el-select-input-focus-border-color: var(--color-primary);
  --el-fill-color-blank: var(--color-n0);
  --el-text-color-regular: var(--color-n7);
  --el-text-color-placeholder: var(--color-n4);
  --el-border-radius-base: var(--radius-small);
}

.competitor-analysis-filter-select :deep(.el-select__wrapper) {
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-small);
  box-shadow: 0 0 0 1px var(--color-n2) inset;
}

.competitor-analysis-filter-select :deep(.el-select__wrapper.is-hovering:not(.is-focused)) {
  box-shadow: 0 0 0 1px var(--color-n3) inset;
}

.competitor-analysis-filter-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--color-primary) inset, 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.competitor-analysis-filter-select :deep(.el-select__placeholder),
.competitor-analysis-filter-select :deep(.el-select__selected-item) {
  color: var(--color-n7);
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

:global(.competitor-analysis-filter-popper) {
  overflow: hidden;
  border: 1px solid var(--color-n2);
  border-radius: var(--radius-middle);
  background: var(--color-n0);
  box-shadow: var(--shadow-popover);
  --el-color-primary: var(--color-primary);
  --el-border-radius-base: var(--radius-small);
  --el-bg-color-overlay: var(--color-n0);
  --el-border-color-light: var(--color-n2);
  --el-text-color-regular: var(--color-n7);
}

:global(.competitor-analysis-filter-popper .el-select-dropdown__item) {
  color: var(--color-n7);
  font-size: 14px;
  font-weight: 500;
}

:global(.competitor-analysis-filter-popper .el-select-dropdown__item.is-selected) {
  background: var(--color-n1);
  color: var(--color-primary);
  font-weight: 700;
}

:global(.competitor-analysis-filter-popper .el-select-dropdown__item.is-hovering),
:global(.competitor-analysis-filter-popper .el-select-dropdown__item:hover) {
  background: var(--color-n1);
  color: var(--color-primary);
}

:global(.competitor-analysis-filter-popper .el-popper__arrow::before) {
  border-color: var(--color-n2);
  background: var(--color-n0);
}

.competitor-analysis-list-card,
.competitor-analysis-detail-card {
  display: grid;
  gap: 16px;
  min-height: 520px;
}

.competitor-analysis-table-wrap {
  min-height: 0;
}

.competitor-analysis-table tr {
  cursor: pointer;
}

.competitor-analysis-table td strong {
  display: block;
  color: #1f2329;
  font-size: 16px;
}

.competitor-analysis-table td small {
  display: block;
  margin-top: 6px;
  color: #98a2b3;
}

.competitor-analysis-table td {
  overflow-wrap: anywhere;
}

.competitor-analysis-inline-button {
  min-height: 36px;
  padding: 0 14px;
}

.competitor-analysis-feature-events {
  display: grid;
  gap: 12px;
}

.competitor-analysis-feature-events h4 {
  margin: 0;
  color: var(--color-n9);
  font-size: 16px;
  font-weight: 700;
}

.competitor-analysis-feature-event-table {
  min-height: 0;
}

.competitor-analysis-detail-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
}

.competitor-analysis-detail-event-select {
  width: min(280px, 100%);
  --el-border-radius-base: var(--radius-small);
  --el-input-border-radius: var(--radius-small);
}

.competitor-analysis-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.competitor-analysis-delete-button {
  min-height: 36px;
  padding: 0 14px;
  border-color: rgba(245, 63, 63, 0.32);
  background: var(--color-n0);
  color: var(--color-error);
}

.competitor-analysis-delete-button:hover {
  border-color: var(--color-error);
  background: rgba(245, 63, 63, 0.08);
  color: var(--color-error);
}

.competitor-analysis-empty {
  display: grid;
  place-items: center;
  align-content: center;
  min-height: 360px;
  gap: 8px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}

.competitor-analysis-list-empty {
  min-height: 440px;
}

.competitor-analysis-empty h4,
.competitor-analysis-dialog h3,
.competitor-analysis-dialog h4 {
  margin: 0;
  color: #1f2329;
}

.competitor-analysis-empty p {
  margin: 0;
}

.competitor-analysis-empty-icon {
  width: 28px;
  height: 28px;
  color: #98a2b3;
}

.competitor-analysis-markdown {
  min-height: 0;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  background: transparent;
  color: #344054;
  font: 16px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.competitor-analysis-markdown h1,
.competitor-analysis-markdown h2,
.competitor-analysis-markdown h3,
.competitor-analysis-markdown p,
.competitor-analysis-markdown ul,
.competitor-analysis-markdown ol,
.competitor-analysis-markdown blockquote {
  margin: 0;
}

.competitor-analysis-markdown h1 {
  color: #1f2329;
  font-size: 28px;
  line-height: 1.35;
}

.competitor-analysis-markdown h2 {
  margin-top: 24px;
  color: #1f2329;
  font-size: 22px;
  line-height: 1.4;
}

.competitor-analysis-markdown h3 {
  margin-top: 20px;
  color: #1f2329;
  font-size: 18px;
  line-height: 1.45;
}

.competitor-analysis-markdown p,
.competitor-analysis-markdown li,
.competitor-analysis-markdown blockquote {
  color: #344054;
}

.competitor-analysis-markdown p + p,
.competitor-analysis-markdown p + table,
.competitor-analysis-markdown table + p,
.competitor-analysis-markdown ul + p,
.competitor-analysis-markdown ol + p,
.competitor-analysis-markdown blockquote + p {
  margin-top: 16px;
}

.competitor-analysis-markdown ul,
.competitor-analysis-markdown ol {
  display: grid;
  gap: 8px;
  padding-left: 24px;
}

.competitor-analysis-markdown blockquote {
  padding-left: 16px;
  border-left: 4px solid #d0d5dd;
  color: #667085;
}

.competitor-analysis-md-code {
  max-height: 360px;
  margin: 16px 0 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #f8f9fb;
  color: #344054;
  font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
}

.competitor-analysis-md-code code {
  font: inherit;
}

.competitor-analysis-md-table {
  width: 100%;
  margin-top: 16px;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  overflow: hidden;
  font-size: 14px;
}

.competitor-analysis-md-table th,
.competitor-analysis-md-table td {
  padding: 12px 16px;
  border-right: 1px solid #eef0f3;
  border-bottom: 1px solid #eef0f3;
  text-align: left;
  vertical-align: top;
}

.competitor-analysis-md-table th {
  background: #f8f9fb;
  color: #1f2329;
  font-weight: 800;
}

.competitor-analysis-md-table th:last-child,
.competitor-analysis-md-table td:last-child {
  border-right: 0;
}

.competitor-analysis-md-table tbody tr:last-child td {
  border-bottom: 0;
}

.competitor-analysis-framework-explorer {
  display: grid;
  gap: 16px;
  padding-bottom: 24px;
}

.competitor-analysis-framework-explorer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.competitor-analysis-framework-explorer-header h4,
.competitor-analysis-framework-explorer-header p {
  margin: 0;
}

.competitor-analysis-framework-explorer-header h4 {
  color: #1f2329;
  font-size: 18px;
  font-weight: 900;
  line-height: 28px;
}

.competitor-analysis-framework-explorer-header p {
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.competitor-analysis-framework-explorer-header span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #475467;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.competitor-analysis-framework-table td strong,
.competitor-analysis-framework-table td small {
  display: block;
}

.competitor-analysis-framework-table td small {
  margin-top: 4px;
  color: #98a2b3;
  font-size: 12px;
  line-height: 16px;
}

.competitor-analysis-framework-table a {
  color: #1f2329;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.competitor-analysis-framework-row-detail summary {
  color: #1f2329;
  font-weight: 800;
  cursor: pointer;
}

.competitor-analysis-framework-row-detail dl {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 8px;
  background: #f8f9fb;
}

.competitor-analysis-framework-row-detail dl div {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 8px;
}

.competitor-analysis-framework-row-detail dt,
.competitor-analysis-framework-row-detail dd {
  margin: 0;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
}

.competitor-analysis-framework-row-detail dt {
  color: #667085;
  font-weight: 800;
}

.competitor-analysis-framework-row-detail dd {
  color: #344054;
  overflow-wrap: anywhere;
}

.competitor-analysis-flow-timeline,
.competitor-analysis-state-board,
.competitor-analysis-page-card-grid,
.competitor-analysis-architecture-map {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.competitor-analysis-flow-timeline article,
.competitor-analysis-state-board article,
.competitor-analysis-page-card-grid article,
.competitor-analysis-architecture-map article {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
}

.competitor-analysis-flow-main,
.competitor-analysis-state-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #1f2329;
}

.competitor-analysis-flow-id,
.competitor-analysis-state-tags span,
.competitor-analysis-page-card-grid header span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #475467;
  font-size: 12px;
  font-weight: 800;
}

.competitor-analysis-flow-timeline dl,
.competitor-analysis-page-card-grid dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.competitor-analysis-flow-timeline dl div,
.competitor-analysis-page-card-grid dl div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
}

.competitor-analysis-flow-timeline dt,
.competitor-analysis-page-card-grid dt {
  color: #667085;
  font-size: 13px;
  font-weight: 800;
}

.competitor-analysis-flow-timeline dd,
.competitor-analysis-page-card-grid dd {
  margin: 0;
  color: #344054;
}

.competitor-analysis-state-main span {
  color: #98a2b3;
}

.competitor-analysis-state-board p,
.competitor-analysis-architecture-map p {
  margin: 0;
  color: #475467;
}

.competitor-analysis-state-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.competitor-analysis-page-card-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.competitor-analysis-page-card-grid header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.competitor-analysis-page-card-grid header strong,
.competitor-analysis-architecture-map strong {
  color: #1f2329;
}

.competitor-analysis-architecture-map {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.competitor-analysis-artifact-panel,
.competitor-analysis-artifact-card {
  display: grid;
  gap: 16px;
}

.competitor-analysis-artifact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.competitor-analysis-artifact-card {
  padding: 0;
  border-radius: 0;
  background: transparent;
}

.competitor-analysis-artifact-card h4,
.competitor-analysis-artifact-card p {
  margin: 0;
}

.competitor-analysis-artifact-card h4 {
  color: #1f2329;
  font-size: 16px;
}

.competitor-analysis-artifact-card p {
  margin-top: 4px;
  color: #667085;
}

.competitor-analysis-artifact-code {
  max-height: 320px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #f8f9fb;
  color: #344054;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
}

.competitor-analysis-diagram-preview {
  display: grid;
  gap: 10px;
}

.competitor-analysis-diagram-preview img {
  width: 100%;
  min-height: 180px;
  object-fit: contain;
  border: 0;
  border-radius: 0;
  background: #f8f9fb;
}

.competitor-analysis-diagram-preview a {
  justify-self: start;
  color: #1f2329;
  font-weight: 700;
  text-decoration: none;
}

.competitor-analysis-diagram-preview a:hover {
  text-decoration: underline;
}

.competitor-analysis-wireframe-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.competitor-analysis-wireframe-list figure {
  display: grid;
  gap: 8px;
  margin: 0;
}

.competitor-analysis-wireframe-list img {
  width: 100%;
  min-height: 180px;
  object-fit: contain;
  border: 0;
  border-radius: 0;
  background: #f8f9fb;
}

.competitor-analysis-wireframe-list figcaption {
  color: #667085;
  font-weight: 700;
}

.competitor-analysis-state-list {
  display: grid;
  gap: 8px;
}

.competitor-analysis-state-list p {
  display: grid;
  gap: 4px;
  padding: 0 0 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.competitor-analysis-state-list strong {
  color: #1f2329;
}

.competitor-analysis-state-list span {
  color: #475467;
}

.competitor-analysis-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 42%);
}

.competitor-analysis-dialog {
  display: grid;
  gap: 16px;
  width: min(680px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 20px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 64px rgb(15 23 42 / 20%);
}

.competitor-analysis-report-dialog {
  width: min(1180px, 100%);
  height: min(860px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: 24px;
}

.competitor-analysis-create-dialog {
  width: min(520px, 100%);
}

.competitor-analysis-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.competitor-analysis-dialog header button {
  width: 32px;
  height: 32px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
  color: #475467;
  font-size: 20px;
  cursor: pointer;
}

.competitor-analysis-report-dialog .competitor-analysis-detail-card {
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.competitor-analysis-dialog-body,
.competitor-analysis-dialog-section,
.competitor-analysis-field {
  display: grid;
  gap: 12px;
}

.competitor-analysis-dialog-section {
  padding: 0;
  border-radius: 0;
}

.competitor-analysis-field {
  min-width: 0;
}

.competitor-analysis-help {
  margin: 4px 0 0;
  color: #667085;
}

.competitor-analysis-feature-picker,
.competitor-analysis-screenshot-reference {
  display: grid;
  gap: 12px;
}

.competitor-analysis-feature-picker h4,
.competitor-analysis-screenshot-reference h4 {
  margin: 0;
}

.competitor-analysis-feature-picker p,
.competitor-analysis-screenshot-reference p {
  margin: 4px 0 0;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.competitor-analysis-upload-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 40px;
  padding: 0 14px;
  border: 1px dashed #98a2b3;
  border-radius: 10px;
  color: #1f2329;
  font-weight: 700;
  cursor: pointer;
}

.competitor-analysis-upload-tile input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.competitor-analysis-reference-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.competitor-analysis-reference-list figure {
  display: grid;
  gap: 6px;
  margin: 0;
}

.competitor-analysis-reference-list img {
  width: 100%;
  height: 86px;
  object-fit: cover;
  border-radius: 8px;
  background: #f2f4f7;
}

.competitor-analysis-reference-list figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #667085;
  font-size: 12px;
}

.competitor-analysis-reference-list figcaption span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.competitor-analysis-reference-list figcaption button {
  border: 0;
  background: transparent;
  color: #1f2329;
  font-weight: 700;
  cursor: pointer;
}

.competitor-analysis-dialog-select {
  width: 220px;
  --el-color-primary: var(--color-primary);
  --el-select-input-focus-border-color: var(--color-primary);
  --el-border-radius-base: var(--radius-small);
}

.competitor-analysis-dialog-select-wide {
  width: 100%;
}

.competitor-analysis-dialog-select :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: var(--radius-small);
  box-shadow: 0 0 0 1px var(--color-n2) inset;
}

.competitor-analysis-dialog-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--color-primary) inset, 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.competitor-analysis-dialog-message {
  margin: 0;
  color: var(--color-n6);
  font-size: 14px;
  line-height: 20px;
}

.competitor-analysis-dialog-message.failed {
  color: var(--color-error);
}

:global(.competitor-analysis-competitor-popper .el-select-dropdown__item) {
  min-height: 48px;
  height: auto;
  padding: 6px 12px;
}

:global(.competitor-analysis-competitor-popper .competitor-analysis-option),
:global(.competitor-analysis-feature-popper .competitor-analysis-option) {
  display: grid;
  gap: 2px;
  min-width: 0;
}

:global(.competitor-analysis-competitor-popper .competitor-analysis-option strong),
:global(.competitor-analysis-competitor-popper .competitor-analysis-option small),
:global(.competitor-analysis-feature-popper .competitor-analysis-option strong),
:global(.competitor-analysis-feature-popper .competitor-analysis-option small) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.competitor-analysis-competitor-popper .competitor-analysis-option small),
:global(.competitor-analysis-feature-popper .competitor-analysis-option small) {
  color: var(--color-n5);
  font-size: 12px;
  font-weight: 500;
}

:global(.competitor-analysis-feature-popper .el-select-dropdown__item) {
  min-height: 48px;
  height: auto;
  padding: 6px 12px;
}

.competitor-analysis-dialog footer {
  justify-content: flex-end;
}

@media (max-width: 980px) {
  .competitor-analysis-toolbar,
  .competitor-analysis-artifact-grid {
    grid-template-columns: 1fr;
  }

  .competitor-analysis-actions {
    justify-content: flex-end;
  }
}
</style>
