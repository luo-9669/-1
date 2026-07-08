<template>
  <div class="app-shell" :class="{ 'analysis-focus': isWorkflowAnalysisFocus, 'sidebar-hidden': isSidebarHidden }">
    <template v-if="!isSidebarHidden">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">流</div>
        <div>
          <h1>流程通</h1>
          <p>AI 项目生产工作台</p>
        </div>
      </div>

      <nav class="nav-list">
        <button
          v-for="item in navItems"
          :key="item.key"
          :class="{ active: isNavItemActive(item.key) }"
          type="button"
          @click="switchView(item.key)"
        >
          <span class="nav-icon"><NavIcon :name="item.icon" /></span>
          {{ item.label }}
        </button>
      </nav>

      <div
        class="account-dock"
        :class="{ open: accountDockOpen }"
        @mouseenter="accountDockOpen = true"
        @mouseleave="accountDockOpen = false"
        @focusin="accountDockOpen = true"
        @focusout="accountDockOpen = false"
      >
        <button class="account-trigger" type="button" aria-haspopup="true" :aria-expanded="accountDockOpen">
          <span class="account-avatar">流</span>
          <span>{{ displayProjectName(currentProject) }}</span>
          <i>›</i>
        </button>
        <div class="account-hover-bridge" aria-hidden="true"></div>
        <section class="account-project-popover">
          <div class="account-profile-row">
            <span class="account-avatar large">{{ currentUser.avatar || '流' }}</span>
            <div>
              <strong>{{ currentUser.name }}</strong>
              <span>{{ currentUser.email || currentUser.id }}</span>
            </div>
          </div>
          <div class="account-project-stats">
            <div><strong>{{ currentKnowledge.length }}</strong><span>知识</span></div>
            <div><strong>{{ currentRequirements.length }}</strong><span>需求</span></div>
            <div><strong>{{ currentAssets.length }}</strong><span>资产</span></div>
          </div>
          <div class="account-project-list">
            <article
              v-for="project in accountProjects.slice(0, 5)"
              :key="project.id"
              class="account-project-item"
              :class="{ active: project.id === state.currentProjectId }"
            >
              <div>
                <strong>{{ displayProjectName(project) }}</strong>
                <span>{{ project.domain || '未设置领域' }}</span>
              </div>
              <button
                class="account-project-switch"
                type="button"
                :disabled="project.id === state.currentProjectId || Boolean(switchingProjectId)"
                @click.stop="selectProject(project.id)"
              >
                {{ switchingProjectId === project.id ? '正在切换...' : project.id === state.currentProjectId ? '当前项目' : '切换项目' }}
              </button>
            </article>
          </div>
          <div class="account-action-grid">
            <button type="button" @click="openProjectCreateFromPicker">新建项目</button>
            <button type="button" @click="switchView('settings')">系统设置</button>
            <button type="button">个人设置</button>
            <button type="button">退出登录</button>
          </div>
        </section>
      </div>

    </aside>
    </template>

    <main class="main" :class="{ 'edge-to-edge': isEdgeToEdgeView }">

      <div v-if="showProjectPicker" class="modal-backdrop" @click.self="closeProjectPicker">
        <section class="project-create-modal project-picker-modal" role="dialog" aria-modal="true" aria-label="选择项目">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Project</p>
              <h3>选择项目</h3>
            </div>
            <button type="button" aria-label="关闭选择项目" @click="closeProjectPicker">关闭</button>
          </div>
          <div class="project-picker-list">
            <button
              v-if="activeView === 'workflow' && workflowRoute === 'entry' && workflowForm.demandScope === 'non-project'"
              type="button"
              :class="{ active: !workflowReferenceProjectId }"
              @click="selectNoReferenceProject"
            >
              <strong>不参考项目</strong>
              <span>仅按当前输入和上传文档分析，不带入项目知识库。</span>
            </button>
            <button
              v-for="project in accountProjects"
              :key="project.id"
              type="button"
              :class="{ active: project.id === (activeView === 'workflow' && workflowRoute === 'entry' && workflowForm.demandScope === 'non-project' ? workflowReferenceProjectId : state.currentProjectId) }"
              @click="selectProject(project.id)"
            >
              <strong>{{ displayProjectName(project) }}</strong>
              <span>{{ project.domain || '未设置领域' }}</span>
            </button>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeProjectPicker">取消</button>
            <button class="primary" type="button" @click="openProjectCreateFromPicker">新建项目</button>
          </div>
        </section>
      </div>

      <div v-if="showProjectForm" class="modal-backdrop" @click.self="closeProjectModal">
        <section class="project-create-modal" role="dialog" aria-modal="true" aria-label="新建项目">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Project</p>
              <h3>新建项目</h3>
            </div>
            <button type="button" aria-label="关闭新建项目" @click="closeProjectModal">关闭</button>
          </div>
          <div class="project-create-panel">
            <input v-model="projectForm.name" placeholder="项目名称" />
            <input v-model="projectForm.domain" placeholder="业务领域" />
            <input v-model="projectForm.targetUsers" placeholder="目标用户" />
            <textarea v-model="projectForm.description" placeholder="项目说明"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeProjectModal">取消</button>
            <button class="primary" type="button" @click="addProject">创建并切换</button>
          </div>
        </section>
      </div>

      <div v-if="showMaterialEditor" class="modal-backdrop" @click.self="closeMaterialEditor">
        <section class="project-create-modal material-editor-modal" role="dialog" aria-modal="true" aria-label="资料编辑">
          <div class="modal-head">
            <div>
              <p class="eyebrow">{{ currentMaterialMeta.title }}</p>
              <h3>{{ materialEditor.mode === 'create' ? `新建${currentMaterialMeta.title}` : '资料详情' }}</h3>
            </div>
            <button type="button" aria-label="关闭资料编辑" @click="closeMaterialEditor">关闭</button>
          </div>
          <div v-if="selectedWebsiteMaterial" class="website-detail-panel">
            <section class="website-detail-summary">
              <div>
                <span>来源 URL</span>
                <strong>{{ selectedWebsiteMaterial.sourceUrl }}</strong>
              </div>
              <div>
                <span>页面类型</span>
                <strong>{{ selectedWebsiteMaterial.pageType || selectedWebsiteParsed.pageType }}</strong>
              </div>
              <div>
                <span>知识片段</span>
                <strong>{{ selectedWebsiteParsed.chunks?.length || 0 }} 段</strong>
              </div>
              <div>
                <span>置信度</span>
                <strong>{{ Math.round((selectedWebsiteMaterial.confidence || selectedWebsiteParsed.confidence || 0) * 100) }}%</strong>
              </div>
            </section>

            <section class="website-detail-section">
              <div class="section-title-row">
                <strong>概览</strong>
                <span>来自网页原文和 meta 信息</span>
              </div>
              <h4>{{ selectedWebsiteParsed.title || selectedWebsiteMaterial.title }}</h4>
              <p>{{ selectedWebsiteParsed.description || selectedWebsiteMaterial.summary || selectedWebsiteMaterial.content }}</p>
              <div class="scope-chip-row">
                <span v-for="feature in selectedWebsiteParsed.signals?.features || []" :key="feature">{{ feature }}</span>
              </div>
            </section>

            <details class="website-detail-section governance-detail">
              <summary>
                <strong>治理信息</strong>
                <span>Owner、可信状态和适用角色决定这条知识能否进入正式交付上下文</span>
              </summary>
              <div class="knowledge-governance-grid">
                <div>
                  <span>Owner</span>
                  <strong>{{ selectedWebsiteMaterial.owner || '知识库管理员' }}</strong>
                </div>
                <div>
                  <span>可信状态</span>
                  <strong>{{ selectedWebsiteMaterial.verification?.status || 'unverified' }}</strong>
                </div>
                <div>
                  <span>过期时间</span>
                  <strong>{{ selectedWebsiteMaterial.expiresAt || '未设置' }}</strong>
                </div>
                <div>
                  <span>适用角色</span>
                  <strong>{{ roleScopeLabels(selectedWebsiteMaterial.roleScopes).join(' / ') || '通用' }}</strong>
                </div>
              </div>
              <div class="scope-chip-row">
                <span v-for="tag in selectedWebsiteMaterial.tags || []" :key="tag">{{ tag }}</span>
              </div>
            </details>

            <section class="website-detail-section">
              <div class="section-title-row">
                <strong>页面结构</strong>
                <span>{{ selectedWebsiteParsed.links?.length || 0 }} 个链接 · {{ selectedWebsiteParsed.ctas?.length || 0 }} 个 CTA</span>
              </div>
              <div class="website-outline">
                <span v-for="heading in selectedWebsiteParsed.headings || []" :key="`${heading.level}-${heading.text}`">
                  H{{ heading.level }} · {{ heading.text }}
                </span>
              </div>
              <div class="website-link-grid">
                <a v-for="link in selectedWebsiteParsed.links || []" :key="`${link.href}-${link.label}`" :href="link.href" target="_blank" rel="noreferrer">
                  {{ link.label || '未命名链接' }}
                  <small>{{ link.href }}</small>
                </a>
              </div>
            </section>

            <section class="website-detail-section">
              <div class="section-title-row">
                <strong>知识片段</strong>
                <span>这些内容会作为项目事实参与后续 Skill 检索</span>
              </div>
              <div class="chunk-list">
                <article v-for="chunk in selectedKnowledgeChunks" :key="chunk.id">
                  <strong>{{ chunk.heading }}</strong>
                  <p>{{ chunk.text }}</p>
                  <div class="scope-chip-row">
                    <span v-for="role in roleScopeLabels(chunk.roleScopes)" :key="role">{{ role }}</span>
                  </div>
                </article>
              </div>
            </section>

            <section class="website-detail-section">
              <div class="section-title-row">
                <strong>关系图谱</strong>
                <span>来源页面、CTA 和页面链接会成为后续需求/设计/开发的引用关系</span>
              </div>
              <div class="relation-list">
                <a
                  v-for="relation in selectedWebsiteMaterial.relations || []"
                  :key="`${relation.type}-${relation.target}`"
                  :href="relation.target"
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{{ relation.label || relation.type }}</strong>
                  <span>{{ relation.type }} · {{ relation.target }}</span>
                </a>
              </div>
            </section>

            <section class="website-detail-section">
              <div class="section-title-row">
                <strong>产品线索</strong>
                <span>事实抽取，后续可转需求或竞品记录</span>
              </div>
              <div class="signal-grid">
                <div>
                  <strong>定价/套餐</strong>
                  <p v-for="line in selectedWebsiteParsed.signals?.pricing || []" :key="line">{{ line }}</p>
                  <p v-if="!selectedWebsiteParsed.signals?.pricing?.length">暂无</p>
                </div>
                <div>
                  <strong>FAQ/帮助</strong>
                  <p v-for="line in selectedWebsiteParsed.signals?.faq || []" :key="line">{{ line }}</p>
                  <p v-if="!selectedWebsiteParsed.signals?.faq?.length">暂无</p>
                </div>
              </div>
            </section>

            <section class="website-detail-section">
              <div class="section-title-row">
                <strong>引用证据</strong>
                <span>{{ selectedWebsiteParsed.capturedAt || selectedWebsiteMaterial.evidence?.[0]?.capturedAt }}</span>
              </div>
              <pre class="code-block">{{ selectedWebsiteParsed.evidenceText || selectedWebsiteMaterial.evidence?.[0]?.text }}</pre>
            </section>
          </div>

          <div v-else class="project-create-panel">
            <input v-model="materialEditor.title" :placeholder="materialsTab === 'competitors' ? '竞品名称' : '标题'" />
            <input v-model="materialEditor.meta" :placeholder="materialsTab === 'competitors' ? '竞品网址' : '类型 / 版本 / 来源'" />
            <input v-model="materialEditor.status" placeholder="状态，例如 待解析 / 已生成 / 已保存" />
            <textarea v-model="materialEditor.notes" placeholder="备注或监控重点"></textarea>
            <textarea v-model="materialEditor.content" placeholder="内容详情，支持后续沉淀 AI 解析结果"></textarea>
          </div>
          <div class="modal-actions">
            <button v-if="materialEditor.mode === 'edit'" type="button" class="danger" @click="deleteMaterialItem">删除</button>
            <button v-if="materialEditor.mode === 'edit'" type="button" @click="openKnowledgeDeposit(materialEditor.rawItem || materialEditor)">沉淀到知识库</button>
            <button type="button" @click="closeMaterialEditor">取消</button>
            <button v-if="!selectedWebsiteMaterial" class="primary" type="button" @click="saveMaterialItem">保存</button>
          </div>
        </section>
      </div>
      <div v-if="showKnowledgeDepositModal" class="modal-backdrop" @click.self="closeKnowledgeDeposit">
        <section class="project-create-modal knowledge-deposit-modal" role="dialog" aria-modal="true" aria-label="沉淀到知识库">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Knowledge Deposit</p>
              <h3>沉淀到知识库</h3>
            </div>
            <button type="button" aria-label="关闭沉淀到知识库" @click="closeKnowledgeDeposit">关闭</button>
          </div>
          <div class="knowledge-deposit-source">
            <span>来源</span>
            <strong>{{ knowledgeDepositSource?.title || '手动知识' }}</strong>
            <small>{{ knowledgeDepositSource?.sourceType || knowledgeDepositSource?.type || materialsTab }}</small>
          </div>
          <label>
            标题
            <input v-model="knowledgeDepositForm.title" placeholder="沉淀后的知识标题" />
          </label>
          <label>
            内容摘要
            <textarea v-model="knowledgeDepositForm.content" placeholder="保留可被设计方案、开发和 AI 检索复用的结论"></textarea>
          </label>
          <div>
            <strong>沉淀类型</strong>
            <div class="knowledge-deposit-type-grid">
              <button
                v-for="type in knowledgeDepositTypes"
                :key="type.key"
                type="button"
                :class="{ active: knowledgeDepositForm.depositType === type.key }"
                @click="knowledgeDepositForm.depositType = type.key"
              >
                {{ type.label }}
              </button>
            </div>
          </div>
          <label>
            绑定蓝图节点
            <select v-model="knowledgeDepositForm.blueprintNodeId">
              <option value="">不绑定蓝图节点</option>
              <option v-for="node in currentKnowledgeHub.blueprint.nodes" :key="node.id" :value="node.id">
                {{ node.type }} · {{ node.title }}
              </option>
            </select>
          </label>
          <div>
            <strong>适用角色</strong>
            <div class="knowledge-deposit-role-grid">
              <label v-for="role in knowledgeRoleTabs.filter((item) => item.key !== 'all')" :key="role.key">
                <input v-model="knowledgeDepositForm.roleScopes" type="checkbox" :value="role.key" />
                {{ role.label }}
              </label>
            </div>
          </div>
          <label>
            备注
            <textarea v-model="knowledgeDepositForm.notes" placeholder="例如：来自需求评审、竞品对比或设计方案结论"></textarea>
          </label>
          <div class="modal-actions">
            <button type="button" @click="closeKnowledgeDeposit">取消</button>
            <button class="primary" type="button" @click="submitKnowledgeDeposit">保存知识</button>
          </div>
        </section>
      </div>
      <div v-if="showRequirementConvertModal" class="modal-backdrop" @click.self="closeWorkflowRequirementConvertModal">
        <section class="project-create-modal requirement-convert-modal" role="dialog" aria-modal="true" aria-label="转需求文档">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Requirement</p>
              <h3>转需求文档</h3>
            </div>
            <button type="button" aria-label="关闭转需求文档" @click="closeWorkflowRequirementConvertModal">关闭</button>
          </div>
          <div class="knowledge-deposit-source">
            <span>来源蓝图</span>
            <strong>{{ activeProjectBlueprint?.title || '需求分析画布' }}</strong>
            <small>选择要写入需求文档的一级 Tab</small>
          </div>
          <div>
            <strong>转入位置</strong>
            <div class="requirement-convert-option-grid">
              <button
                v-for="option in requirementConvertSourceOptions"
                :key="option.key"
                type="button"
                :class="{ active: requirementConvertForm.source === option.key }"
                @click="requirementConvertForm.source = option.key"
              >
                <strong>{{ option.label }}</strong>
                <span>{{ option.description }}</span>
              </button>
            </div>
          </div>
          <label>
            需求文件名
            <input v-model="requirementConvertForm.title" placeholder="例如：娱乐小程序 设计需求" />
          </label>
          <label>
            备注
            <textarea v-model="requirementConvertForm.notes" placeholder="补充这次转入的确认背景或使用范围"></textarea>
          </label>
          <div class="modal-actions">
            <button type="button" @click="closeWorkflowRequirementConvertModal">取消</button>
            <button class="primary" type="button" @click="submitWorkflowRequirementConvert">确认转入</button>
          </div>
        </section>
      </div>
      <div v-if="showCaptureAuthModal" class="modal-backdrop" @click.self="closeCaptureAuthModal">
        <section class="project-create-modal capture-auth-modal" role="dialog" aria-modal="true" aria-label="采集方式设置">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Capture</p>
              <h3>{{ captureAuthModalTitle }}</h3>
            </div>
            <button type="button" aria-label="关闭采集设置" @click="closeCaptureAuthModal">关闭</button>
          </div>

          <div v-if="captureAuthModalMode === 'remote-browser'" class="capture-auth-body">
            <p>在隔离浏览器里完成登录或授权，成功后使用这个会话采集目标网页。</p>
            <button class="primary" type="button" :disabled="browserSessionStatus.status === 'loading'" @click="createBrowserSession">
              <span v-if="browserSessionStatus.status === 'loading'" class="button-spinner"></span>
              {{ captureForm.sessionId ? '重新打开授权浏览器' : '打开授权浏览器' }}
            </button>
            <span v-if="captureForm.sessionId" class="composer-session-note">当前会话：{{ captureForm.sessionId }}</span>
            <div v-if="captureForm.sessionId" class="embedded-browser-panel">
              <div class="embedded-browser-toolbar">
                <button type="button" :disabled="browserPreviewStatus.status === 'loading'" @click="runBrowserSessionAction({ type: 'back' })">后退</button>
                <button type="button" :disabled="browserPreviewStatus.status === 'loading'" @click="runBrowserSessionAction({ type: 'forward' })">前进</button>
                <input
                  v-model="browserPreview.url"
                  aria-label="授权浏览器地址"
                  placeholder="https://example.com/login"
                  @keydown.enter.prevent="navigateBrowserSession"
                />
                <button type="button" :disabled="browserPreviewStatus.status === 'loading'" @click="navigateBrowserSession">跳转</button>
                <button type="button" :disabled="browserPreviewStatus.status === 'loading'" @click="runBrowserSessionAction({ type: 'reload' })">刷新</button>
                <label class="embedded-browser-toggle">
                  <input v-model="browserPreview.autoRefresh" type="checkbox" />
                  自动刷新
                </label>
              </div>
              <button class="embedded-browser-screen" type="button" @click="clickBrowserPreview" @wheel.prevent="scrollBrowserPreview">
                <img v-if="browserPreview.screenshot" :src="browserPreview.screenshot" alt="授权浏览器画面" />
                <span v-else>点击刷新画面后在这里完成登录</span>
              </button>
              <div class="embedded-browser-input">
                <input
                  v-model="browserPreview.inputText"
                  aria-label="向授权浏览器输入文本"
                  placeholder="输入账号、密码或验证码后点输入"
                  @keydown.enter.prevent="typeIntoBrowserSession"
                />
                <button type="button" :disabled="browserPreviewStatus.status === 'loading'" @click="typeIntoBrowserSession">输入</button>
                <button type="button" :disabled="browserPreviewStatus.status === 'loading'" @click="runBrowserSessionAction({ type: 'press', key: 'Enter' })">Enter</button>
              </div>
            </div>
          </div>

          <div v-else-if="captureAuthModalMode === 'cookie-session'" class="capture-auth-body">
            <p>粘贴 Cookie 或 storageState，只用于当前目标域名和本次项目采集。</p>
            <textarea
              v-model="captureForm.cookieText"
              class="composer-cookie-input"
              placeholder="粘贴 Cookie 或 Session JSON，仅用于当前项目和目标域名"
              aria-label="Cookie 或 Session"
            ></textarea>
          </div>

          <div v-else-if="captureAuthModalMode === 'snapshot-package'" class="capture-auth-body">
            <p>上传浏览器插件或内部工具导出的网页快照包，系统会解析为统一的采集结果。</p>
            <label class="composer-upload-chip">
              上传网页快照包
              <input type="file" accept=".zip,application/zip" @change="importWebsnapFile" />
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeCaptureAuthModal">取消</button>
            <button class="primary" type="button" @click="confirmCaptureAuthModal">确认使用</button>
          </div>
        </section>
      </div>

      <div v-if="showCaptureFlowInfoModal" class="modal-backdrop" @click.self="closeCaptureFlowInfo">
        <section class="project-create-modal capture-flow-info-modal" role="dialog" aria-modal="true" aria-label="采集流程说明">
          <div class="modal-head">
            <div>
              <p class="eyebrow">{{ selectedCaptureFlowInfo.badge }}</p>
              <h3>{{ selectedCaptureFlowInfo.label }}</h3>
            </div>
            <button type="button" aria-label="关闭采集流程说明" @click="closeCaptureFlowInfo">关闭</button>
          </div>
          <div class="capture-flow-info-body">
            <p>{{ selectedCaptureFlowInfo.scenario }}</p>
            <dl>
              <div>
                <dt>前端负责</dt>
                <dd>{{ selectedCaptureFlowInfo.frontendOwner }}</dd>
              </div>
              <div>
                <dt>后端负责</dt>
                <dd>{{ selectedCaptureFlowInfo.backendOwner }}</dd>
              </div>
              <div>
                <dt>数据交接</dt>
                <dd>{{ selectedCaptureFlowInfo.handoff }}</dd>
              </div>
            </dl>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeCaptureFlowInfo">知道了</button>
            <button class="primary" type="button" @click="goRecoveryFlow(selectedCaptureFlowInfo.id)">使用这个方式</button>
          </div>
        </section>
      </div>

      <div v-if="showSnapshotAssetsModal" class="modal-backdrop" @click.self="showSnapshotAssetsModal = false">
        <section class="project-create-modal snapshot-assets-modal" role="dialog" aria-modal="true" aria-label="快照记录">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Capture Assets</p>
              <h3>快照记录</h3>
            </div>
            <button type="button" aria-label="关闭快照记录" @click="showSnapshotAssetsModal = false">关闭</button>
          </div>
          <section class="snapshot-assets-section">
            <div class="panel-head">
              <div>
                <h3>网页快照</h3>
                <p>URL 采集和上传的网页快照会沉淀为项目资产，后续用于线框、高保真和代码生成。</p>
              </div>
            </div>
            <div v-if="currentSnapshotAssets.length" class="restored-page-grid">
              <article
                v-for="asset in currentSnapshotAssets"
                :key="asset.id"
                class="restored-page-card"
                role="button"
                tabindex="0"
                @click="openSnapshotAsset(asset.id)"
                @keydown.enter.prevent="openSnapshotAsset(asset.id)"
              >
                <div class="restored-page-cover">
                  <img v-if="asset.designSource?.coverImage" :src="asset.designSource.coverImage" :alt="asset.title" />
                  <div v-else class="snapshot-cover-empty">暂无截图</div>
                </div>
                <div>
                  <strong>{{ asset.title }}</strong>
                  <span>{{ asset.meta }}</span>
                  <small>{{ asset.sourceUrl || '未记录来源' }}</small>
                </div>
              </article>
            </div>
            <div v-else class="materials-empty">
              <strong>暂无快照记录</strong>
              <p>输入 URL 采集网页，或上传网页快照包后会自动保存到这里。</p>
            </div>
          </section>
        </section>
      </div>

      <div v-if="showFactoryTaskCenter" class="modal-backdrop" @click.self="showFactoryTaskCenter = false">
        <section class="project-create-modal factory-task-modal" role="dialog" aria-modal="true" aria-label="生成任务中心">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Factory Tasks</p>
              <h3>生成任务中心</h3>
            </div>
            <button type="button" aria-label="关闭生成任务中心" @click="showFactoryTaskCenter = false">关闭</button>
          </div>
          <div v-if="factoryTaskRecords.length" class="factory-task-list">
            <article v-for="task in factoryTaskRecords" :key="task.id" :class="['factory-task-card', `status-${task.status}`]">
              <div>
                <small>{{ task.typeLabel }} · {{ task.statusLabel }}</small>
                <strong>{{ task.title }}</strong>
                <span>{{ task.sourceUrl || task.message || '等待后端返回执行结果' }}</span>
              </div>
              <dl>
                <div>
                  <dt>任务 ID</dt>
                  <dd>{{ task.taskId || task.id }}</dd>
                </div>
                <div>
                  <dt>耗时</dt>
                  <dd>{{ task.durationLabel }}</dd>
                </div>
                <div>
                  <dt>预计</dt>
                  <dd>{{ task.estimatedLabel }}</dd>
                </div>
              </dl>
              <p v-if="task.failureReason" class="factory-task-failure">失败原因：{{ task.failureReason }}</p>
              <div class="factory-task-actions">
                <button type="button" :disabled="task.status === 'running'" @click="retryFactoryTask(task)">重新执行</button>
              </div>
            </article>
          </div>
          <div v-else class="materials-empty">
            <strong>暂无生成任务</strong>
            <p>采集网页、生成高保真 HTML 或转 Vue 代码后，会在这里看到任务状态。</p>
          </div>
        </section>
      </div>

      <div v-if="showMaterialToolModal" class="modal-backdrop" @click.self="closeMaterialTool">
        <section class="project-create-modal material-tool-modal" role="dialog" aria-modal="true" aria-label="资料库工具">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Knowledge Tools</p>
              <h3>{{ materialToolTitle }}</h3>
            </div>
            <button type="button" aria-label="关闭资料库工具" @click="closeMaterialTool">关闭</button>
          </div>

          <section v-if="materialToolModalMode === 'website-import'" class="panel website-import-panel">
            <div>
              <strong>从项目网站导入</strong>
              <span>解析产品定位、页面结构、功能线索、定价或帮助文档，并保留来源 URL。</span>
            </div>
            <input v-model="websiteImportForm.url" placeholder="https://example.com" />
            <select v-model="websiteImportForm.importType" aria-label="网站类型">
              <option value="project-website">项目官网</option>
              <option value="competitor">竞品网站</option>
              <option value="help-center">帮助中心</option>
              <option value="docs">文档站</option>
            </select>
            <select v-model="websiteImportForm.scope" aria-label="解析范围">
              <option value="single">单页</option>
              <option value="sitemap">站点地图</option>
              <option value="same-domain">同域浅层</option>
            </select>
            <button type="button" @click="submitWebsiteImportAndClose">导入</button>
          </section>

          <section v-if="materialToolModalMode === 'retrieval-test'" class="panel knowledge-retrieval-panel">
            <div>
              <strong>召回测试</strong>
              <span>模拟 AI Agent 提问，检查知识库能命中哪些片段和命中证据。</span>
            </div>
            <input v-model="knowledgeRetrievalForm.query" placeholder="例如：Pro 套餐包含什么协作能力？" />
            <select v-model="knowledgeRetrievalForm.roleScope" aria-label="召回角色">
              <option v-for="role in knowledgeRoleTabs" :key="role.key" :value="role.key">{{ role.label }}</option>
            </select>
            <button type="button" @click="runKnowledgeRetrievalTest">测试召回</button>
            <div v-if="knowledgeRetrievalResults.length" class="retrieval-result-list">
              <article v-for="result in knowledgeRetrievalResults" :key="`${result.materialId}-${result.chunk?.id || result.title}`">
                <div>
                  <strong>{{ result.title }}</strong>
                  <span>Score {{ result.score }} · {{ roleScopeLabels(result.roleScopes).join(' / ') }}</span>
                </div>
                <p>{{ result.snippet }}</p>
                <small>命中证据：{{ result.evidence?.[0]?.url || result.sourceUrl || '暂无来源' }}</small>
              </article>
            </div>
          </section>

          <section v-if="materialToolModalMode === 'parse-jobs'" class="panel parse-job-panel">
            <div>
              <strong>解析任务中心</strong>
              <span>查看网站、文档和知识导入任务的执行状态。</span>
            </div>
            <button type="button" @click="refreshParseJobs">刷新任务</button>
            <div v-if="knowledgeParseJobs.length" class="parse-job-list">
              <article v-for="job in knowledgeParseJobs" :key="job.id">
                <strong>{{ job.action || 'parse' }} · {{ job.status }}</strong>
                <span>{{ job.sourceUrl || job.sourceType || '暂无来源' }}</span>
                <small>{{ job.materialCount || 0 }} 条资料 · {{ job.durationMs || 0 }}ms</small>
              </article>
            </div>
          </section>
        </section>
      </div>

      <div v-if="showKnowledgeNodeDetailModal" class="modal-backdrop" @click.self="closeKnowledgeNodeDetail">
        <section class="project-create-modal knowledge-node-modal" role="dialog" aria-modal="true" aria-label="蓝图节点详情">
          <div class="modal-head">
            <div>
              <p class="eyebrow">{{ blueprintNodeKindLabel(selectedKnowledgeNode?.kind || selectedKnowledgeNode?.type) }}</p>
              <h3>{{ selectedKnowledgeNodeDetail.title || selectedKnowledgeNode?.title || '节点详情' }}</h3>
            </div>
            <button type="button" aria-label="关闭蓝图节点详情" @click="closeKnowledgeNodeDetail">关闭</button>
          </div>
          <div class="knowledge-node-detail-grid">
            <section>
              <strong>目标</strong>
              <p>{{ selectedKnowledgeNodeDetail.goal || selectedKnowledgeNode?.summary || selectedKnowledgeNode?.meta || '暂无目标说明。' }}</p>
            </section>
            <section>
              <strong>输入输出</strong>
              <span v-for="item in selectedKnowledgeNodeInputsOutputs" :key="item">{{ item }}</span>
              <span v-if="!selectedKnowledgeNodeInputsOutputs.length">暂无明确输入输出。</span>
            </section>
            <section>
              <strong>流程步骤</strong>
              <ol>
                <li v-for="item in selectedKnowledgeNodeDetail.flowSteps" :key="item">{{ item }}</li>
              </ol>
              <span v-if="!selectedKnowledgeNodeDetail.flowSteps?.length">暂无流程步骤。</span>
            </section>
            <section>
              <strong>异常状态</strong>
              <span v-for="item in selectedKnowledgeNodeDetail.exceptionStates" :key="item">{{ item }}</span>
              <span v-if="!selectedKnowledgeNodeDetail.exceptionStates?.length">暂无异常状态。</span>
            </section>
            <section>
              <strong>关联页面</strong>
              <span v-for="item in selectedKnowledgeNodeDetail.relatedPages" :key="item">{{ item }}</span>
              <span v-if="!selectedKnowledgeNodeDetail.relatedPages?.length">暂无关联页面。</span>
            </section>
            <section>
              <strong>关联知识</strong>
              <button v-for="item in selectedKnowledgeNodeDetail.relatedKnowledge" :key="item.id" type="button" @click="openBlueprintRelatedKnowledge(item)">
                {{ item.title }}
              </button>
              <span v-if="!selectedKnowledgeNodeDetail.relatedKnowledge?.length">暂无关联知识。</span>
            </section>
            <section>
              <strong>来源证据</strong>
              <span v-for="item in selectedKnowledgeNodeDetail.evidence" :key="JSON.stringify(item)">{{ item.title || item.url || item.text || item }}</span>
              <span v-if="!selectedKnowledgeNodeDetail.evidence?.length">暂无证据片段。</span>
            </section>
            <section>
              <strong>截图定位</strong>
              <div class="knowledge-screenshot-region-box">
                <span>{{ selectedKnowledgeNodeVisualContext?.screen?.title || selectedKnowledgeNode?.title || '未绑定页面' }}</span>
                <small v-if="selectedKnowledgeNodeVisualContext?.rect">红框区域：x={{ selectedKnowledgeNodeVisualContext.rect.x }}%, y={{ selectedKnowledgeNodeVisualContext.rect.y }}%</small>
                <small v-else>{{ selectedKnowledgeNodeVisualContext?.screenshotUrl ? '已绑定页面截图，可在交互 Demo 中定位。' : '暂无截图热区，等待后端采集或原型资产导入。' }}</small>
              </div>
            </section>
            <section class="knowledge-ai-context">
              <strong>AI 识别上下文</strong>
              <pre v-if="selectedKnowledgeNodeAiContext">{{ selectedKnowledgeNodeAiContext }}</pre>
              <span v-else>暂无可解释上下文。</span>
            </section>
          </div>
        </section>
      </div>

      <section v-if="isFactoryView && state.currentFactoryRoute === 'home'" class="view-panel factory-view">

      <div v-if="showGeneratedPageFullPreview" class="preview-modal" role="dialog" aria-modal="true" aria-label="1:1 页面预览">
        <header>
          <div>
            <strong>1:1 页面预览</strong>
            <span>来自网页工厂生成结果</span>
          </div>
          <button type="button" @click="showGeneratedPageFullPreview = false">关闭</button>
        </header>
        <iframe title="1:1 页面预览" :srcdoc="state.generatedPageHtml"></iframe>
      </div>

      <div v-if="showBlueprintDemoFullPreview" class="preview-modal" role="dialog" aria-modal="true" aria-label="蓝图 Demo 预览">
        <header>
          <div>
            <strong>1:1 Demo 预览</strong>
            <span>来自项目蓝图生成结果</span>
          </div>
          <button type="button" @click="showBlueprintDemoFullPreview = false">关闭</button>
        </header>
        <iframe title="蓝图 Demo 预览" :srcdoc="blueprintDemoHtml"></iframe>
      </div>
        <section class="capture-entry-panel">
          <div class="agent-copy">
            <h3>{{ factoryHeroCopy.titleBefore }}<span>{{ factoryHeroCopy.highlight }}</span>{{ factoryHeroCopy.titleAfter }}</h3>
            <p>{{ factoryHeroCopy.subtitle }}</p>
          </div>

          <TabBar v-model="factoryHomeTab" :tabs="factoryHomeTabs" />

          <div v-if="factoryHomeTab === 'image-code'" class="agent-composer image-code-composer image-restore-composer">
            <div class="image-restore-dropzone">
              <label class="image-prompt-upload image-restore-upload-tile" aria-label="上传设计图">
                <img v-if="imageCodeForm.imageDataUrl" :src="imageCodeForm.imageDataUrl" alt="上传的设计图" />
                <span v-else>＋</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleImageCodeFile" />
              </label>
              <textarea v-model="imageCodeForm.prompt" placeholder="上传截图、设计稿或参考图，系统会先识别页面布局、视觉层级和组件结构，再生成静态 HTML。"></textarea>
            </div>
            <div class="image-restore-footer">
              <div class="composer-chip-menu">
                <button
                  class="composer-chip-trigger"
                  type="button"
                  aria-haspopup="listbox"
                  :aria-expanded="showImageTargetMenu"
                  @click="showImageTargetMenu = !showImageTargetMenu"
                >
                  {{ imageCodeTargetLabel }}
                  <span>⌄</span>
                </button>
                <div v-if="showImageTargetMenu" class="composer-floating-menu" role="listbox" aria-label="生成目标">
                  <button
                    v-for="option in imageCodeTargetOptions"
                    :key="option.value"
                    type="button"
                    role="option"
                    :aria-selected="imageCodeForm.target === option.value"
                    :class="{ active: imageCodeForm.target === option.value }"
                    @click="selectImageCodeTarget(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <div class="image-restore-actions">
                <button class="primary" type="button" :disabled="imageCodeStatus.status === 'loading' || !imageCodeForm.imageDataUrl" @click="generateFromImage">
                  <span v-if="imageCodeStatus.status === 'loading'" class="button-spinner"></span>
                  {{ imageCodeStatus.status === 'loading' ? '生成中' : '生成页面代码' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="factoryHomeTab === 'style-transfer'" class="agent-composer style-transfer-composer">
            <textarea v-model="styleForm.notes" placeholder="描述想转换成什么风格，例如更像 Notion、Linear、Apple 官网，或保留布局只换视觉语言。"></textarea>
            <select class="composer-chip-select" v-model="styleForm.stylePreset" aria-label="风格预设">
              <option value="clean">清爽工具型</option>
              <option value="editorial">内容编辑型</option>
              <option value="commerce">商业转化型</option>
              <option value="dark">暗色沉浸型</option>
            </select>
            <div class="composer-actions">
              <button class="primary" type="button" :disabled="styleStatus.status === 'loading'" @click="transformStyle">
                <span v-if="styleStatus.status === 'loading'" class="button-spinner"></span>
                {{ styleStatus.status === 'loading' ? '转换中' : '执行风格转换' }}
              </button>
            </div>
          </div>


          <div v-if="factoryHomeTab === 'url-code'" class="agent-composer">
            <textarea v-model="captureForm.url" placeholder="粘贴网页地址，例如 https://www.gaoding.art/creation" @keydown.enter.exact.prevent="startCapture"></textarea>
            <select class="composer-chip-select" v-model="captureForm.scope" aria-label="采集范围">
              <option value="single">单页面</option>
              <option value="site">整站入口</option>
            </select>
            <div class="composer-chip-menu capture-method-menu">
              <button
                class="composer-chip-trigger"
                type="button"
                aria-haspopup="listbox"
                :aria-expanded="showCaptureMethodMenu"
                @click="showCaptureMethodMenu = !showCaptureMethodMenu"
              >
                {{ captureMethodLabel }}
                <span>⌄</span>
              </button>
              <div v-if="showCaptureMethodMenu" class="composer-floating-menu" role="listbox" aria-label="采集方式">
                <button
                  v-for="option in captureMethodOptions"
                  :key="option.id"
                  type="button"
                  role="option"
                  :aria-selected="selectedCaptureRecoveryFlowId === option.id"
                  :class="{ active: selectedCaptureRecoveryFlowId === option.id }"
                  @click="selectCaptureMethod(option.id)"
                >
                  {{ option.shortLabel }}
                </button>
              </div>
            </div>
            <div class="composer-actions">
              <a
                class="primary action-link"
                :class="{ disabled: captureAction.disabled }"
                :href="captureDetailHref"
                target="_blank"
                rel="noopener noreferrer"
                :aria-disabled="captureAction.disabled"
                @click="startCapture"
              >
                <span v-if="captureAction.loading" class="button-spinner"></span>
                {{ captureAction.loading ? '采集中' : '采集网页' }}
              </a>
            </div>
            <section v-if="selectedCaptureRecoveryFlowId === 'remote-browser'" class="capture-browser-auth-panel" aria-label="授权浏览器手动登录">
              <div>
                <strong>授权浏览器</strong>
                <span>打开隔离浏览器后，请在下方预览里自行完成登录、验证码或扫码，再开始采集。</span>
              </div>
              <button type="button" :disabled="browserSessionStatus.status === 'loading'" @click="openManualBrowserAuthorization">
                <span v-if="browserSessionStatus.status === 'loading'" class="button-spinner"></span>
                {{ captureForm.sessionId ? '重新打开授权浏览器' : '打开授权浏览器' }}
              </button>
              <button class="primary" type="button" :disabled="captureAction.loading || !captureForm.sessionId" @click="captureAfterManualBrowserLogin">
                <span v-if="captureAction.loading" class="button-spinner"></span>
                {{ captureAction.loading ? '采集中' : '我已登录，开始采集' }}
              </button>
              <small>{{ browserSessionStatus.message || '登录态只用于当前项目和当前采集任务。' }}</small>
            </section>
          </div>
        </section>

        <section class="restored-assets-section">
          <div class="panel-head">
            <div>
              <h3>还原资产</h3>
            </div>
          </div>
          <div v-if="currentRestoredPages.length" class="restored-page-grid">
            <a
              v-for="page in currentRestoredPages"
              :key="page.id"
              class="restored-page-card"
              :href="previewTaskUrl(page.id)"
              target="_blank"
              rel="noopener noreferrer"
              @click.prevent="openRestoredPageStandalone(page.id)"
            >
              <div class="restored-page-cover">
                <img v-if="page.coverImage" :src="page.coverImage" :alt="page.title" />
                <iframe v-else :src="restoredPagePreviewFrameSrc(page)" title="还原页面封面" tabindex="-1"></iframe>
                <div class="restored-card-action">
                  <span>查看详情</span>
                </div>
              </div>
              <div>
                <strong>{{ page.title }}</strong>
                <small>{{ formatRestoredPageTime(page) }}</small>
                <div class="restored-page-tags" aria-label="资产标签">
                  <span v-for="tag in restoredPageTags(page)" :key="tag">{{ tag }}</span>
                </div>
              </div>
            </a>
          </div>
          <div v-else class="materials-empty">
            <strong>暂无还原资产</strong>
            <p>先在 URL 转代码里输入 URL，采集网页后再生成高保真 HTML 页面。</p>
            <button class="primary" type="button" :disabled="captureAction.loading" @click="handleRestoredEmptyCaptureAction">
              <span v-if="captureAction.loading" class="button-spinner"></span>
              {{ captureAction.loading ? '采集中' : '去采集网页' }}
            </button>
          </div>
        </section>

      </section>

      <section v-if="isFactoryView && state.currentFactoryRoute === 'capture-detail'" class="factory-detail-view">
        <header class="factory-detail-header">
          <button class="icon-button" type="button" aria-label="返回网页工厂" @click="openFactoryHome('url-code')">←</button>
          <div>
            <strong>采集结果</strong>
            <span>{{ state.captureResult?.title || captureForm.url }}</span>
          </div>
          <StatusBadge :status="captureStatus.status" />
        </header>

        <main class="factory-detail-main">
          <section class="panel capture-results-panel">
            <div class="panel-head">
              <div>
                <h3>采集结果</h3>
                <p>网页采集结果单独进入二级页处理，确认结构、样式和交互信息无误后再生成高保真 HTML。</p>
                <StatusBadge :status="captureResultPanelStatus" />
              </div>
            </div>
            <div class="metric-grid">
              <Metric label="页面" :value="captureSummary.pages" />
              <Metric label="组件" :value="captureSummary.components" />
              <Metric label="图片" :value="captureSummary.assets" />
              <Metric label="DOM节点" :value="captureSummary.layoutNodes" />
            </div>
            <details class="capture-diagnostic-detail">
              <summary>采集诊断</summary>
              <div v-if="state.captureResult" class="diagnostic">
                <span>方式：{{ state.captureResult.raw?.transport || '未知' }}</span>
                <span>快照：{{ state.captureResult.raw?.snapshotPackage || state.captureResult.raw?.captureKind || '内部网页快照' }}</span>
                <span>授权：{{ state.captureResult.raw?.authMode || 'public' }}</span>
                <span>截图：{{ state.captureResult.raw?.screenshotCaptured ? '已采集' : '未采集' }}</span>
                <span>SingleFile：{{ state.captureResult.raw?.singleFileCaptured ? '已采集' : '未采集' }}</span>
                <span>DOMSnapshot：{{ state.captureResult.raw?.domSnapshotCaptured ? '已采集' : '未采集' }}</span>
                <span>DOM：{{ state.captureResult.raw?.layoutNodeCount || captureSummary.layoutNodes }} 个节点</span>
                <span v-if="state.captureResult.raw?.source === 'web-snapshot-import'">解析包：{{ state.captureResult.raw?.pageCount || 1 }} 页</span>
              </div>
            </details>
            <section
              v-if="captureRelayTemplateId || captureRelayDiagnostics.length || captureRelayActions.length"
              class="capture-relay-diagnostics"
            >
              <div class="capture-relay-head">
                <span class="eyebrow">Relay</span>
                <strong>{{ captureRelayTemplateId || '未命中模板' }}</strong>
              </div>
              <ul v-if="captureRelayDiagnostics.length" class="capture-relay-diagnostic-list">
                <li v-for="diagnostic in captureRelayDiagnostics" :key="`${diagnostic.code}-${diagnostic.message}`">
                  <strong>{{ diagnostic.code }}</strong>
                  <span>{{ diagnostic.message }}</span>
                </li>
              </ul>
              <ul v-if="captureRelayActions.length" class="capture-relay-action-list">
                <li v-for="action in captureRelayActions" :key="action">{{ action }}</li>
              </ul>
            </section>
            <div v-if="state.captureResult && !captureReadiness.canRestore" class="capture-readiness-warning">
                <strong>采集不足或目标站返回错误页，暂不能生成高保真 HTML</strong>
              <p>{{ captureReadiness.reason }}</p>
              <div>
                <span v-for="action in captureReadiness.actions" :key="action">{{ action }}</span>
              </div>
            </div>
            <div v-else-if="captureAction.loading" class="capture-loading-state">
              <span class="loading-spinner-large"></span>
              <strong>正在生成网页快照</strong>
              <p>系统正在读取目标页面 DOM、截图、组件样本和交互节点，完成后会在这里展示快照结果。</p>
              <div class="capture-loading-meta">
                <span>{{ captureLoadingView.estimatedLabel }}</span>
                <span>{{ captureLoadingView.elapsedLabel }}</span>
              </div>
              <div class="capture-loading-copy" aria-live="polite">
                <span class="typewriter-text">{{ captureLoadingView.typedCopy }}</span>
              </div>
              <div class="capture-loading-steps" aria-label="网页快照执行步骤">
                <div
                  v-for="step in captureLoadingView.steps"
                  :key="step.id"
                  :class="['capture-loading-step', { active: step.id === captureLoadingView.currentStep.id }]"
                >
                  <i></i>
                  <div>
                    <b>{{ step.title }}</b>
                    <span>{{ step.detail }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="captureStatus.status === 'blocked' && !state.captureResult" class="capture-failure-recovery">
              <strong>采集被阻断，可以换一种方式继续</strong>
              <p>{{ captureStatus.message || '目标网页当前需要登录态、Cookie 或远程浏览器环境后才能继续采集。' }}</p>
              <div class="capture-failure-actions">
                <button
                  v-for="flow in captureRecoveryFlows"
                  :key="`capture-blocked-${flow.id}`"
                  type="button"
                  @click="goRecoveryFlow(flow.id)"
                >
                  <small>{{ flow.badge }}</small>
                  <span>{{ flow.label }}</span>
                </button>
              </div>
              <button type="button" @click="openFactoryHome('url-code')">返回采集页修改 URL</button>
            </div>
            <div v-else-if="captureStatus.status === 'failed' && !state.captureResult" class="capture-failure-recovery">
              <strong>采集失败，可以换一种方式继续</strong>
              <p>{{ captureStatus.message || '目标网页暂时无法直接采集。可以使用远程浏览器、Cookie、网页快照包或截图转代码继续。' }}</p>
              <div class="capture-failure-actions">
                <button
                  v-for="flow in captureRecoveryFlows"
                  :key="`capture-failed-${flow.id}`"
                  type="button"
                  @click="goRecoveryFlow(flow.id)"
                >
                  <small>{{ flow.badge }}</small>
                  <span>{{ flow.label }}</span>
                </button>
              </div>
              <button type="button" @click="openFactoryHome('url-code')">返回采集页修改 URL</button>
            </div>
            <div v-else-if="!state.captureResult" class="capture-empty-actions">
              <div>
                <strong>当前还没有采集结果</strong>
                <p>可以直接开始采集当前 URL，也可以返回修改 URL 或更换授权方式。</p>
              </div>
              <div class="actions">
                <button class="primary" type="button" :disabled="captureAction.disabled" @click="runCaptureTask()">
                  <span v-if="captureAction.loading" class="button-spinner"></span>
                  {{ captureAction.loading ? '采集中' : '开始采集' }}
                </button>
                <button type="button" @click="openFactoryHome('url-code')">返回采集页修改 URL</button>
                <button type="button" @click="openCaptureAuthModal(selectedCaptureRecoveryFlowId)">更换采集方式</button>
              </div>
            </div>
            <div v-if="state.captureResult" class="restore-workflow">
              <div>
                <strong>下一步</strong>
                <span>点击生成后会回到网页工厂，并在“还原资产”里生成一张高保真 HTML 页面卡片。</span>
                <p v-if="pageGenerationStatus.status !== 'idle'" :class="['restore-generation-status', pageGenerationStatus.status]">
                  <span v-if="pageGenerationStatus.status === 'loading'" class="button-spinner"></span>
                  {{ pageGenerationStatus.status === 'loading' ? '正在根据采集结果生成页面...' : pageGenerationStatus.message }}
                </p>
                <div v-if="pageGenerationStatus.status === 'failed'" class="restore-generation-recovery">
                  <strong>没有生成正式 HTML</strong>
                  <p>当前采集结果被质量门禁拦截。可以换一种采集方式重新拿到更完整的 DOM、登录态或页面资源。</p>
                  <div class="restore-generation-recovery-actions">
                    <button type="button" @click="generatePageFromCapture({ openPreview: false })">
                      <small>Retry</small>
                      <span>重新生成 HTML</span>
                    </button>
                    <button
                      v-for="flow in captureRecoveryFlows"
                      :key="`generation-recovery-${flow.id}`"
                      type="button"
                      @click="goRecoveryFlow(flow.id)"
                    >
                      <small>{{ flow.badge }}</small>
                      <span>{{ flow.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            <div class="actions">
                <button
                  class="primary"
                  type="button"
                  :disabled="pageGenerationStatus.status === 'loading' || !captureReadiness.canRestore"
                  @click="generatePageFromCapture({ openPreview: false })"
                >
                  <span v-if="pageGenerationStatus.status === 'loading'" class="button-spinner"></span>
                  {{ pageGenerationStatus.status === 'loading' ? '生成中' : '生成高保真 HTML' }}
                </button>
                <button type="button" :disabled="!state.generatedPageHtml" @click="downloadGeneratedHtml">下载 HTML</button>
                <button type="button" :disabled="!selectedRestoredPage" @click="convertRestoredPageToVue">转 Vue 代码</button>
              </div>
            </div>
            <details class="raw-capture-detail">
              <summary>查看采集数据</summary>
              <pre class="code-block">{{ captureJson }}</pre>
            </details>
          </section>
        </main>
      </section>

      <section v-if="isFactoryView && state.currentFactoryRoute === 'standalone-preview'" class="standalone-preview-view">
        <iframe
          :key="standalonePreviewKey"
          class="standalone-preview-frame"
          title="静态 HTML 还原结果"
          sandbox="allow-forms allow-scripts allow-top-navigation-by-user-activation"
          :srcdoc="standalonePreviewHtml"
        ></iframe>
      </section>

      <section v-if="isFactoryView && state.currentFactoryRoute === 'restored-detail'" class="factory-detail-view">
        <header class="factory-detail-header">
          <button class="icon-button" type="button" aria-label="返回还原资产" @click="openFactoryHome('url-code')">←</button>
          <div class="factory-detail-actions actions">
            <button type="button" @click="openRestoredPreviewInNewTab">新标签打开</button>
            <button type="button" @click="showRestoredSource = !showRestoredSource">{{ showRestoredSource ? '隐藏源码' : '查看源码' }}</button>
            <button type="button" @click="copySelectedRestoredFile">复制 HTML</button>
            <button type="button" @click="downloadGeneratedHtml">下载 HTML</button>
            <button v-if="!selectedRestoredPageHasVue" class="primary" type="button" :disabled="generationStatus.status === 'loading'" @click="convertRestoredPageToVue">
              <span v-if="generationStatus.status === 'loading'" class="button-spinner"></span>
              {{ generationStatus.status === 'loading' ? '转换中' : '转 Vue 代码' }}
            </button>
            <button v-else class="primary" type="button" @click="downloadReactZip">下载 Vue 源码</button>
          </div>
        </header>

        <main class="factory-detail-main restored-detail-main">
          <section class="restored-preview-shell">
            <div class="restored-preview-toolbar">
              <div class="segmented-control compact">
                <button
                  v-for="mode in restoredPreviewModes"
                  :key="mode.value"
                  type="button"
                  :class="{ active: restoredPreview.mode === mode.value }"
                  @click="restoredPreview.mode = mode.value"
                >
                  {{ mode.label }}
                </button>
              </div>
              <div class="segmented-control compact">
                <button
                  v-for="device in restoredPreviewDevices"
                  :key="device.value"
                  type="button"
                  :class="{ active: restoredPreview.device === device.value }"
                  @click="restoredPreview.device = device.value"
                >
                  {{ device.label }}
                </button>
              </div>
              <div class="zoom-control">
                <button type="button" aria-label="缩小预览" @click="adjustRestoredZoom(-0.1)">−</button>
                <strong>{{ Math.round(restoredPreview.zoom * 100) }}%</strong>
                <button type="button" aria-label="放大预览" @click="adjustRestoredZoom(0.1)">＋</button>
                <button type="button" @click="restoredPreview.zoom = restoredPreviewFitZoom">适应</button>
                <button type="button" @click="restoredPreview.zoom = 1">100%</button>
              </div>
            </div>
            <section class="restored-compare-stage" aria-label="HTML 还原与原网页截图对照">
              <article class="compare-result-pane html-code-pane">
                <header>
                  <div>
                    <strong>html</strong>
                  </div>
                  <div class="code-pane-actions">
                    <button class="code-preview-button" type="button" aria-label="预览 HTML" title="预览" @click="openRestoredPreviewInNewTab">
                      <span class="preview-play-icon">▶</span>
                      <span>预览</span>
                    </button>
                    <button class="icon-button subtle" type="button" aria-label="复制 HTML" title="复制 HTML" @click="copySelectedRestoredFile">⧉</button>
                    <button class="icon-button subtle" type="button" aria-label="新标签打开" title="新标签打开" @click="openRestoredPreviewInNewTab">↪</button>
                  </div>
                </header>
                <pre class="restored-code-block"><code>{{ selectedRestoredFileContent }}</code></pre>
              </article>
              <article class="compare-result-pane original-snapshot-pane">
                <header>
                  <div>
                    <small class="compare-pane-label">右侧 · 原始截图</small>
                    <strong>原网页截图</strong>
                  </div>
                  <span>{{ selectedRestoredPage?.sourceUrl || '用于对照还原程度' }}</span>
                </header>
                <div class="original-snapshot-frame">
                  <img v-if="selectedRestoredPage?.coverImage" :src="selectedRestoredPage.coverImage" :alt="`${selectedRestoredPage.title} 原网页截图`" />
                  <div v-else class="snapshot-cover-empty">暂无原始截图</div>
                </div>
              </article>
            </section>
            <details class="restored-preview-advanced">
              <summary>高级预览模式</summary>
              <iframe title="还原页面详情" sandbox="allow-forms" :srcdoc="selectedRestoredPreviewHtml"></iframe>
            </details>
            <div class="restored-source-actions">
              <button type="button" @click="showRestoredSource = !showRestoredSource">{{ showRestoredSource ? '隐藏源码' : '查看源码' }}</button>
              <button type="button" @click="copySelectedRestoredFile">复制 HTML</button>
              <button type="button" @click="downloadGeneratedHtml">下载 HTML</button>
            </div>
          </section>
          <section v-if="showRestoredSource" class="panel restored-source-panel">
            <div class="panel-head">
              <div>
                <h3>源码</h3>
                <p>{{ selectedRestoredPageHasVue ? '已转换为 Vue/Vite 源码，可查看文件或下载源码包。' : '当前为 HTML 1:1 还原结果，确认后可再转 Vue 代码。' }}</p>
              </div>
            <button type="button" :disabled="!selectedRestoredFileContent" @click="copySelectedRestoredFile">{{ selectedRestoredPageHasVue ? '复制当前文件' : '复制 HTML' }}</button>
            </div>
            <div class="file-tree">
              <button
                v-for="file in selectedRestoredFiles"
                :key="file.path"
                :class="{ active: selectedReactFile === file.path }"
                type="button"
                @click="selectedReactFile = file.path"
              >
                {{ file.path }}
              </button>
            </div>
            <pre class="code-block tall">{{ selectedRestoredFileContent }}</pre>
          </section>
        </main>
      </section>

      <section v-if="activeView === 'projects'" class="view-panel projects-view">
        <section v-if="!selectedProjectDetail" class="materials-toolbar">
          <div>
            <h3>项目</h3>
            <p>创建和切换项目，项目内资料、流程、资产和 Skill 会按当前项目隔离。</p>
          </div>
          <button class="primary" type="button" @click="showProjectForm = true">新建项目</button>
        </section>
        <section v-if="!selectedProjectDetail" class="project-grid">
          <button
            v-for="project in projectDisplayList"
            :key="project.id"
            type="button"
            class="project-card"
            :class="{ active: project.id === state.currentProjectId }"
            @click="openProjectDetail(project.id)"
          >
            <strong>{{ displayProjectName(project) }}</strong>
            <span>{{ project.domain || '未设置领域' }}</span>
            <p>{{ project.description || '暂无项目说明' }}</p>
          </button>
        </section>
        <section v-else class="project-detail-view">
          <div class="materials-toolbar">
            <div>
              <h3>{{ displayProjectName(selectedProjectDetail) }}</h3>
              <p>{{ selectedProjectDetail.domain || '未设置领域' }}</p>
            </div>
            <div class="actions">
              <button type="button" @click="selectedProjectDetailId = ''">返回列表</button>
              <button type="button" :disabled="!selectedProjectBlueprintAsset && !selectedProjectPreviewUrl" @click="openSelectedProjectDemo">打开代码/网页预览</button>
              <button class="primary" type="button" @click="selectProject(selectedProjectDetail.id)">设为当前项目</button>
            </div>
          </div>
          <section class="panel project-detail-panel">
            <div>
              <strong>项目说明</strong>
              <p>{{ selectedProjectDetail.description || '暂无项目说明' }}</p>
            </div>
            <div>
              <strong>目标用户</strong>
              <p>{{ selectedProjectDetail.targetUsers || '未设置目标用户' }}</p>
            </div>
            <div>
              <strong>创建时间</strong>
              <p>{{ selectedProjectDetail.createdAt ? new Date(selectedProjectDetail.createdAt).toLocaleString() : '暂无' }}</p>
            </div>
          </section>
          <section class="project-stat-grid">
            <div v-for="item in selectedProjectStats" :key="item.label">
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </div>
          </section>
          <section v-if="selectedProjectBlueprintAsset?.blueprint" class="panel project-blueprint-summary">
            <div class="panel-head">
              <div>
                <h3>项目蓝图概览</h3>
                <p>{{ selectedProjectBlueprintAsset.blueprint.profile.positioning }}</p>
              </div>
              <button type="button" @click="openSelectedProjectDemo">打开 Demo</button>
            </div>
            <div class="blueprint-profile-grid">
              <div>
                <span>目标人群</span>
                <strong>{{ selectedProjectBlueprintAsset.blueprint.profile.targetUsers }}</strong>
              </div>
              <div>
                <span>核心目标</span>
                <strong>{{ selectedProjectBlueprintAsset.blueprint.profile.primaryGoal }}</strong>
              </div>
              <div>
                <span>主要场景</span>
                <strong>{{ selectedProjectBlueprintAsset.blueprint.profile.coreScenarios.join(' / ') }}</strong>
              </div>
            </div>
          </section>
        </section>
      </section>

      <section v-if="activeView === 'materials'" class="view-panel">
        <section v-if="materialsTab === 'requirements'" class="requirements-workspace">
          <div class="materials-toolbar">
            <div>
              <h3>需求文档</h3>
              <p>统一查看用户上传、模糊拆解和产品确认后的设计需求，后续可沉淀为知识。</p>
            </div>
            <div class="materials-toolbar-actions">
              <input
                ref="materialFileInput"
                class="hidden-file-input"
                type="file"
                multiple
                accept=".pdf,.docx,.md,.txt,.xlsx,.csv,.json"
                @change="importMaterialFiles"
              />
              <button type="button" @click="toggleMaterialBatchMode">
                {{ materialBatchMode ? '退出管理' : '批量管理' }}
              </button>
              <button class="primary" type="button" @click="openMaterialCreate">上传需求文件</button>
            </div>
          </div>
          <div class="requirements-source-tabs" role="tablist" aria-label="需求来源">
            <button
              v-for="tab in requirementSourceTabs"
              :key="tab.key"
              type="button"
              :class="{ active: requirementSourceTab === tab.key }"
              @click="requirementSourceTab = tab.key"
            >
              <strong>{{ tab.label }}</strong>
              <span>{{ requirementSourceTabCount(tab.key) }}</span>
            </button>
          </div>
          <section v-if="filteredRequirementDocumentRows.length" class="requirements-table-panel">
            <table class="requirements-table">
              <thead>
                <tr>
                  <th v-if="materialBatchMode">选择</th>
                  <th>需求文件</th>
                  <th>需求来源</th>
                  <th>状态</th>
                  <th>知识状态</th>
                  <th>上传时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredRequirementDocumentRows"
                  :key="row.id"
                  :class="{ selected: currentSelectedMaterialIds.includes(row.id) }"
                >
                  <td v-if="materialBatchMode">
                    <input
                      type="checkbox"
                      :checked="currentSelectedMaterialIds.includes(row.id)"
                      @change="toggleMaterialSelection(row.id)"
                    />
                  </td>
                  <td>
                    <button type="button" class="requirements-file-link" @click="openMaterialDetail(row.raw)">
                      <strong>{{ row.title }}</strong>
                      <span>{{ row.meta }}</span>
                    </button>
                  </td>
                  <td><span class="requirements-source-badge">{{ row.sourceLabel }}</span></td>
                  <td><span class="requirements-status-pill">{{ row.statusLabel }}</span></td>
                  <td><span class="requirements-knowledge-pill" :class="{ done: row.knowledgeStatus === 'converted' }">{{ row.knowledgeStatusLabel }}</span></td>
                  <td>{{ row.uploadedAtLabel }}</td>
                  <td>
                    <div class="requirements-row-actions">
                      <button type="button" @click="openMaterialDetail(row.raw)">查看</button>
                      <button type="button" @click="openRequirementKnowledgeDeposit(row.raw)">沉淀到知识库</button>
                      <button
                        type="button"
                        :disabled="row.knowledgeStatus === 'converted'"
                        @click="markRequirementAsKnowledge(row.raw)"
                      >
                        已转知识
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
          <section v-else class="panel materials-empty">
            <h3>{{ currentMaterialMeta.title }}</h3>
            <p>{{ currentMaterialMeta.empty }}</p>
            <button class="primary" type="button" @click="openMaterialCreate">上传需求文件</button>
          </section>
        </section>
        <section v-if="materialsTab === 'knowledge'" class="knowledge-hub-layout">
          <section class="knowledge-hub-main">
            <div class="knowledge-hub-head">
              <div>
                <p class="eyebrow">知识库：{{ displayProjectName(currentProject) }}</p>
                <h3>{{ currentKnowledgeHub.overview.blueprintTitle }}</h3>
                <p>{{ currentKnowledgeHubSection.description }}</p>
              </div>
              <div class="actions">
                <button type="button" @click="openMaterialTool('website-import')">网站导入</button>
                <button type="button" @click="openMaterialTool('retrieval-test')">召回测试</button>
                <button type="button" @click="openMaterialTool('parse-jobs')">解析任务</button>
                <button type="button" @click="toggleMaterialBatchMode">
                  {{ materialBatchMode ? '退出管理' : '批量管理' }}
                </button>
                <button class="primary" type="button" @click="openMaterialCreate">导入文件</button>
              </div>
            </div>
            <div class="knowledge-primary-tabs" role="tablist" aria-label="知识库视图">
              <button
                v-for="section in currentKnowledgeHub.sections"
                :key="section.key"
                type="button"
                :class="{ active: knowledgeHubSection === section.key }"
                @click="knowledgeHubSection = section.key"
              >
                <strong>{{ section.label }}</strong>
                <span>{{ section.description }}</span>
              </button>
            </div>
            <input
              ref="materialFileInput"
              class="hidden-file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.md,.txt,.xlsx,.csv,.json"
              @change="importMaterialFiles"
            />
            <Notice :result="currentMaterialStatus" floating />
            <section v-if="knowledgeHubSection === 'structure'" class="knowledge-canvas-shell">
              <div class="knowledge-canvas-toolbar">
                <div>
                  <strong>结构树</strong>
                  <span>{{ currentKnowledgeBlueprintWorkbench.nodes.length }} 个节点 · {{ currentKnowledgeHub.overview.knowledgeCount }} 条知识</span>
                </div>
                <div class="zoom-control">
                  <button type="button" aria-label="缩小结构树" @click="adjustKnowledgeCanvasZoom(-0.1)">−</button>
                  <strong>{{ Math.round(knowledgeCanvasZoom * 100) }}%</strong>
                  <button type="button" aria-label="放大结构树" @click="adjustKnowledgeCanvasZoom(0.1)">＋</button>
                  <button type="button" @click="knowledgeCanvasZoom = 0.86">适应</button>
                  <button type="button" @click="knowledgeCanvasZoom = 1">100%</button>
                  <button type="button" @click="expandAllKnowledgeNodes">全部展开</button>
                  <button type="button" @click="collapseKnowledgeNodes">收起</button>
                </div>
              </div>
              <div v-if="currentKnowledgeBlueprintWorkbench.nodes.length" class="knowledge-structure-workspace">
                <div class="knowledge-xmind-viewport">
                  <div class="knowledge-xmind-canvas" :style="{ transform: `scale(${knowledgeCanvasZoom})` }">
                    <button
                      v-for="node in visibleKnowledgeStructureNodes"
                      :key="node.id"
                      type="button"
                      class="knowledge-xmind-node"
                      :class="{ active: selectedKnowledgeNode?.id === node.id, collapsed: node.collapsed }"
                      :style="{ '--depth': node.depth }"
                      @click="selectKnowledgeStructureNode(node.id)"
                    >
                      <i v-if="node.children?.length" @click.stop="toggleKnowledgeNode(node.id)">{{ knowledgeExpandedNodeIds[node.id] ? '−' : '+' }}</i>
                      <i v-else></i>
                      <span>{{ blueprintNodeKindLabel(node.kind) }}</span>
                      <strong>{{ node.title }}</strong>
                      <small>{{ node.meta || node.detail?.goal || '点击查看详情' }}</small>
                    </button>
                  </div>
                </div>
                <aside class="knowledge-structure-inspector">
                  <div>
                    <p class="eyebrow">截图定位</p>
                    <h4>{{ selectedKnowledgeNodeVisualContext?.screen?.title || '暂无截图页面' }}</h4>
                    <span>{{ selectedKnowledgeNodeVisualContext?.screen?.url || '导入 URL 后会显示真实页面截图，并用红框标出当前节点区域。' }}</span>
                  </div>
                  <div class="knowledge-screenshot-stage">
                    <img
                      v-if="selectedKnowledgeNodeVisualContext?.screenshotUrl"
                      :src="selectedKnowledgeNodeVisualContext.screenshotUrl"
                      :alt="selectedKnowledgeNodeVisualContext?.screen?.title || selectedKnowledgeNode?.title"
                    />
                    <div v-else class="knowledge-screenshot-empty">暂无页面截图</div>
                    <span
                      v-if="selectedKnowledgeNodeVisualContext?.screenshotUrl"
                      class="knowledge-screenshot-region-box"
                      :style="{
                        left: `${selectedKnowledgeNodeVisualContext.rect.x}%`,
                        top: `${selectedKnowledgeNodeVisualContext.rect.y}%`,
                        width: `${selectedKnowledgeNodeVisualContext.rect.width}%`,
                        height: `${selectedKnowledgeNodeVisualContext.rect.height}%`
                      }"
                    ></span>
                  </div>
                  <div class="knowledge-visual-meta">
                    <span>来源：{{ selectedKnowledgeNodeVisualContext?.source || '待解析' }}</span>
                    <span>匹配：{{ selectedKnowledgeNodeVisualContext?.confidence || 'low' }}</span>
                    <span>截图资产：{{ selectedKnowledgeNodeVisualContext?.screenshotAssetId || '暂无' }}</span>
                  </div>
                  <button class="secondary" type="button" @click="openKnowledgeNodeDetail(selectedKnowledgeNode?.id)">展开节点详情</button>
                  <details class="knowledge-ai-context" open>
                    <summary>AI 识别上下文</summary>
                    <pre>{{ selectedKnowledgeNodeAiContext }}</pre>
                  </details>
                </aside>
              </div>
              <section v-else class="panel materials-empty">
                <h3>暂无项目蓝图</h3>
                <p>先通过网站导入或蓝图导入生成项目蓝图，结构树会自动使用 XMind 形式展示。</p>
              </section>
            </section>

            <section v-if="knowledgeHubSection === 'flow'" class="knowledge-canvas-shell">
              <div class="knowledge-canvas-toolbar">
                <div>
                  <strong>流程图</strong>
                  <span>用页面原型卡片串联用户路径、页面跳转和交互状态。</span>
                </div>
                <div class="zoom-control">
                  <button type="button" aria-label="缩小流程图" @click="adjustKnowledgeCanvasZoom(-0.1)">−</button>
                  <strong>{{ Math.round(knowledgeCanvasZoom * 100) }}%</strong>
                  <button type="button" aria-label="放大流程图" @click="adjustKnowledgeCanvasZoom(0.1)">＋</button>
                  <button type="button" @click="knowledgeCanvasZoom = 0.86">适应</button>
                  <button type="button" @click="knowledgeCanvasZoom = 1">100%</button>
                </div>
              </div>
              <div v-if="knowledgePrototypePages.length" class="knowledge-flow-viewport">
                <div class="knowledge-flow-board" :style="{ transform: `scale(${knowledgeCanvasZoom})` }">
                  <article
                    v-for="(page, index) in knowledgePrototypePages"
                    :key="page.id"
                    class="knowledge-prototype-card"
                    :class="{ active: selectedKnowledgePrototypeScreen?.id === page.id }"
                    @click="selectKnowledgePrototypeScreen(page.id)"
                  >
                    <div class="prototype-screen">
                      <img v-if="page.screenshotUrl" :src="page.screenshotUrl" :alt="page.title" />
                      <div v-else class="prototype-screen-wireframe">
                        <header>{{ page.title }}</header>
                        <section>
                          <span v-for="component in page.components.slice(0, 5)" :key="`${page.id}-${component.label || component.type}`">
                            {{ component.label || component.type }}
                          </span>
                          <span v-if="!page.components.length">页面截图 / 原型占位</span>
                        </section>
                        <footer>{{ page.primaryAction || '查看详情' }}</footer>
                      </div>
                    </div>
                    <div>
                      <strong>{{ page.title }}</strong>
                      <p>{{ page.summary || '暂无页面说明' }}</p>
                      <small>{{ page.actions.length ? page.actions.map((action) => `${action.label} → ${action.targetScreenId || '详情'}`).join(' / ') : '流程末端' }}</small>
                    </div>
                    <button type="button" @click.stop="openKnowledgeNodeDetail(page.nodeId)">查看节点详情</button>
                    <i v-if="index < knowledgePrototypePages.length - 1">→</i>
                  </article>
                </div>
              </div>
              <section v-else class="panel materials-empty">
                <h3>暂无流程图</h3>
                <p>导入包含页面和交互路径的项目蓝图后，会按原型产品模式展示页面卡片和跳转关系。</p>
              </section>
            </section>

            <section v-if="knowledgeHubSection === 'prototype'" class="knowledge-canvas-shell">
              <div class="knowledge-canvas-toolbar">
                <div>
                  <strong>交互 Demo</strong>
                  <span>后端按 URL 采集每个页面截图，沉淀热点路径，前端按墨刀式原型播放。</span>
                </div>
                <div class="zoom-control">
                  <button type="button" @click="openMaterialTool('parse-jobs')">后台截图资产</button>
                  <button type="button" @click="switchToFactoryFromKnowledgeDemo">读取前端代码</button>
                </div>
              </div>
              <div v-if="currentKnowledgePrototypeDemo.screens.length" class="knowledge-prototype-player">
                <aside class="knowledge-flow-demo">
                  <div>
                    <p class="eyebrow">交互 Demo</p>
                    <h4>{{ selectedKnowledgePrototypeScreen?.title || '选择页面' }}</h4>
                    <span>{{ selectedKnowledgePrototypeScreen?.summary || '点击左侧流程卡片或下方热点预览页面跳转。' }}</span>
                  </div>
                  <div class="prototype-demo-stage">
                    <img
                      v-if="selectedKnowledgePrototypeScreen?.screenshotUrl"
                      :src="selectedKnowledgePrototypeScreen.screenshotUrl"
                      :alt="selectedKnowledgePrototypeScreen.title"
                    />
                    <div v-else class="prototype-demo-wireframe">
                      <header>{{ selectedKnowledgePrototypeScreen?.title || '页面原型' }}</header>
                      <span
                        v-for="component in (selectedKnowledgePrototypeScreen?.components || []).slice(0, 6)"
                        :key="`${selectedKnowledgePrototypeScreen?.id}-${component.id}`"
                      >
                        {{ component.label || component.type }}
                      </span>
                    </div>
                    <button
                      v-for="hotspot in selectedKnowledgePrototypeScreen?.hotspots || []"
                      :key="hotspot.id"
                      type="button"
                      class="prototype-hotspot"
                      :style="{ left: `${hotspot.rect.x}%`, top: `${hotspot.rect.y}%`, width: `${hotspot.rect.width}%`, height: `${hotspot.rect.height}%` }"
                      :title="`${hotspot.label} → ${hotspot.targetScreenId || '节点详情'}`"
                      @click="triggerKnowledgePrototypeHotspot(hotspot)"
                    >
                      {{ hotspot.label }}
                    </button>
                  </div>
                  <div class="prototype-demo-actions">
                    <button type="button" :disabled="!selectedKnowledgePrototypePage" @click="openKnowledgeNodeDetail(selectedKnowledgePrototypePage.nodeId)">展开详情</button>
                    <button type="button" @click="openMaterialTool('parse-jobs')">后台截图资产</button>
                    <button type="button" @click="switchToFactoryFromKnowledgeDemo">读取前端代码</button>
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
                    @click="selectKnowledgePrototypeScreen(screen.id)"
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
              <div class="knowledge-canvas-toolbar">
                <div>
                  <strong>Markdown</strong>
                  <span>完整蓝图文档，包含产品结构、流程、状态、规则、设计决策和验收标准。</span>
                </div>
                <button type="button" :disabled="!currentKnowledgeMarkdown" @click="downloadMarkdown('blueprint')">下载 Markdown</button>
              </div>
              <pre v-if="currentKnowledgeMarkdown" class="knowledge-markdown-view">{{ currentKnowledgeMarkdown }}</pre>
              <section v-else class="panel materials-empty">
                <h3>暂无 Markdown 蓝图</h3>
                <p>导入项目网站或项目蓝图后，这里会展示可复制和交付的完整蓝图文档。</p>
              </section>
            </section>

          </section>
        </section>
        <template v-else-if="materialsTab !== 'requirements'">
        <section v-if="currentMaterialItems.length" class="materials-grid">
          <button
            v-for="item in currentMaterialItems"
            :key="item.id"
            type="button"
            class="material-card"
            :class="{ selected: currentSelectedMaterialIds.includes(item.id), managing: materialBatchMode }"
            :title="materialCardHint(item)"
            @click="openMaterialDetail(item)"
          >
            <label v-if="materialBatchMode" class="material-select" @click.stop>
              <input
                type="checkbox"
                :checked="currentSelectedMaterialIds.includes(item.id)"
                @change="toggleMaterialSelection(item.id)"
              />
              <span>选择</span>
            </label>
            <strong>{{ item.title }}</strong>
            <span>{{ item.meta || item.notes || '暂无描述' }}</span>
            <small>{{ item.status || '已保存' }}</small>
            <em @click.stop="materialsTab === 'requirements' ? openRequirementKnowledgeDeposit(item) : materialsTab === 'competitors' ? openCompetitorKnowledgeDeposit(item) : openKnowledgeCardDeposit(item)">沉淀到知识库</em>
          </button>
        </section>
        <section v-else class="panel materials-empty">
          <h3>{{ currentMaterialMeta.title }}</h3>
          <p>{{ currentMaterialMeta.empty }}</p>
          <button class="primary" type="button" @click="openMaterialCreate">新建{{ currentMaterialMeta.title }}</button>
        </section>
        </template>
        <section v-if="materialBatchMode" class="batch-action-bar">
          <label>
            <input
              type="checkbox"
              :checked="allCurrentMaterialsSelected"
              @change="toggleSelectAllMaterials"
            />
            全选（{{ currentSelectedMaterialIds.length }}）
          </label>
          <div>
            <button type="button" disabled>移动</button>
            <button type="button" disabled>下载</button>
            <button class="danger" type="button" :disabled="!currentSelectedMaterialIds.length" @click="deleteSelectedMaterials">删除</button>
          </div>
          <button type="button" aria-label="退出批量管理" @click="exitMaterialBatchMode">×</button>
        </section>
      </section>

      <section v-if="activeView === 'diagnosis'" class="view-panel diagnosis-view">
        <section class="panel diagnosis-hero">
          <div class="panel-head">
            <div>
              <h3>项目诊断</h3>
              <p>先输入需求，系统会用默认通用 Skill 判断清晰度、读取当前资料，并推荐下一步流程。</p>
            </div>
            <StatusBadge :status="skillWorkbenchStatus.status" />
          </div>
          <textarea
            v-model="workbenchForm.input"
            placeholder="例如：现在 Skill 工作台全部堆在一个页面，用户不知道怎么从需求进入完整流程"
          ></textarea>
          <div class="form-grid">
            <label>
              使用 Skill
              <select v-model="workbenchForm.selectedSkillId">
                <option v-for="skill in availableSkills" :key="skill.id" :value="skill.id">
                  {{ skill.source === 'system' ? '系统 · ' : '我的 · ' }}{{ skill.name }}
                </option>
              </select>
            </label>
            <label>
              执行模式
              <select v-model="workbenchForm.mode">
                <option value="diagnose">先诊断</option>
                <option value="execute">直接执行所选 Skill</option>
              </select>
            </label>
          </div>
          <div class="actions">
            <button class="primary" type="button" @click="runWorkbenchSkill">执行诊断</button>
            <button type="button" @click="openSkillCenterForCreation">新建我的 Skill</button>
          </div>
          <Notice :result="skillWorkbenchStatus" />
        </section>

        <section class="panel">
          <ListHeader title="推荐流程" :count="recommendedWorkflows.length" />
          <div class="recommendation-grid">
            <button
              v-for="workflow in recommendedWorkflows"
              :key="workflow.id"
              class="recommendation-card"
              type="button"
              @click="startRecommendedWorkflow(workflow.id)"
            >
              <strong>{{ workflow.name }}</strong>
              <span>{{ workflow.description }}</span>
              <small>开始流程</small>
            </button>
          </div>
        </section>

        <section class="panel">
          <ListHeader title="最近活动" :count="recentActivities.length" />
          <DataList :items="recentActivities" empty="暂无最近活动" />
        </section>
      </section>

      <section v-if="activeView === 'workflow' && workflowRoute === 'entry'" class="view-panel workflow-view workflow-entry-view">
        <section class="workflow-entry-panel">
          <div class="capture-entry-panel workflow-capture-entry">
            <div class="agent-copy">
              <h3>今天要分析哪份<span>需求文档</span>？</h3>
              <p>把 PRD、调研记录或新增需求拖进输入框，点击分析文档后进入画布工作区。</p>
            </div>
            <TabBar v-model="workflowForm.demandScope" :tabs="workflowScopeTabs" />
            <div class="agent-composer workflow-doc-composer">
              <textarea v-model="workflowForm.input" placeholder="描述本次分析目标，或直接上传需求文档。"></textarea>
              <div class="workflow-upload-row in-composer">
                <label class="workflow-upload-chip">
                  上传需求文档
                  <input ref="workflowFileInput" type="file" multiple accept=".pdf,.docx,.md,.txt,.xlsx" @change="importWorkflowRequirementFiles" />
                </label>
                <button
                  v-if="workflowForm.documents.length"
                  class="workflow-clear-upload"
                  type="button"
                  @click="clearWorkflowRequirementFiles"
                >
                  清除上传文件
                </button>
                <span v-if="workflowForm.documents.length">{{ workflowForm.documents.length }} 个文档已加入分析</span>
                <span v-else>支持 PDF / DOCX / MD / TXT / XLSX</span>
              </div>
              <div v-if="workflowForm.documents.length" class="workflow-doc-list">
                <article class="workflow-analysis-panel">
                  <div class="workflow-analysis-head">
                    <strong>{{ workflowDocumentAnalysis.stageLabel }}</strong>
                    <span>{{ workflowDocumentAnalysis.readyCount }} 已读取 · {{ workflowDocumentAnalysis.pendingCount }} 待解析 · {{ workflowDocumentAnalysis.failedCount }} 失败</span>
                  </div>
                  <div class="workflow-analysis-items">
                    <section v-for="doc in workflowDocumentAnalysis.items" :key="doc.id" :class="`analysis-${doc.normalizedStatus}`">
                      <b>{{ doc.name }}</b>
                      <span>{{ doc.progressLabel }}</span>
                      <small v-if="doc.summary">{{ doc.summary }}</small>
                      <em>{{ doc.nextStep }}</em>
                    </section>
                  </div>
                </article>
              </div>
              <div class="workflow-context-row">
                <button class="project-context-chip composer-project-chip" type="button" @click="showProjectPicker = true">
                  {{ workflowForm.demandScope === 'project' ? '绑定项目' : '参考项目' }}：{{ workflowForm.demandScope === 'project' ? displayProjectName(currentProject) : (workflowReferenceProject ? displayProjectName(workflowReferenceProject) : '不参考项目') }}
                </button>
                <select class="composer-chip-select" v-model="workflowForm.selectedWorkflowId" aria-label="流程 Skill">
                  <option value="auto">智能推荐 Skill</option>
                  <option v-for="workflow in builtinWorkflows" :key="workflow.id" :value="workflow.id">
                    {{ workflow.name }}
                  </option>
                </select>
              </div>
              <div class="composer-actions workflow-doc-actions">
                <button class="primary" type="button" @click="analyzeWorkflowDocuments">分析文档</button>
              </div>
            </div>
          </div>
        </section>
        <section class="workflow-records-section">
          <div class="panel-head">
            <div>
              <h3>分析记录</h3>
            </div>
          </div>
          <div v-if="workflowAnalysisRecords.length" class="workflow-record-grid">
            <a
              v-for="record in workflowAnalysisRecords"
              :key="record.id"
              class="workflow-record-card"
              :href="workflowAnalysisDeepLink(record.id)"
              @click.prevent="openWorkflowAnalysisRecord(record.id)"
            >
              <div class="workflow-record-cover">
                <span
                  class="workflow-record-scope-tag"
                  :data-scope="record.demandScope === 'non-project' ? 'non-project' : 'project'"
                >
                  {{ record.demandScope === 'non-project' ? '非项目需求' : '项目需求' }}
                </span>
                <strong>{{ record.projectBlueprint?.profile?.productName || record.projectBlueprint?.title || record.workflowName }}</strong>
                <span>{{ workflowRecordSummary(record).parsed }} 个文档 · {{ workflowRecordSummary(record).nodeCount }} 个节点 · 质量分 {{ workflowRecordSummary(record).qualityScore ?? '待检' }}</span>
                <div class="workflow-record-path">
                  <i v-for="tab in workflowRecordSummary(record).tabPreview" :key="`${record.id}-${tab.key}`">{{ tab.label }}</i>
                </div>
                <div class="restored-card-action">
                  <span>查看详情</span>
                </div>
              </div>
              <div>
                <strong>{{ record.projectBlueprint?.title || '需求分析画布' }}</strong>
                <small>{{ new Date(record.updatedAt || record.createdAt).toLocaleString() }}</small>
              </div>
            </a>
          </div>
          <div v-else class="materials-empty">
            <strong>暂无分析记录</strong>
            <p>上传或输入需求文档后点击分析文档，生成的画布会保存在这里。</p>
          </div>
        </section>
      </section>

      <WorkflowCanvasPage
        v-if="activeView === 'workflow' && workflowRoute === 'canvas'"
        :title="activeProjectBlueprint?.title || '需求分析画布'"
        :parsed-count="workflowAnalysisResult?.summary?.parsed || 0"
        :canvas="workflowCanvas"
        :nodes="workflowCanvasNodes"
        :edges="workflowCanvasEdges"
        :routing="workflowSkillRouting"
        :generation="workflowGenerationMeta"
        :version-meta="workflowAnalysisVersionMeta"
        :version-history="workflowAnalysisVersionHistory"
        :quality-gate="workflowAnalysisQualityGate"
        :knowledge-status="workflowKnowledgeStatus"
        :active-node="activeCanvasNode"
        :fullscreen-node="fullscreenCanvasNode"
        :fullscreen-edit-node-id="workflowFullscreenEditNodeId"
        :zoom="workflowCanvasZoom"
        @back="returnToWorkflowEntry"
        @zoom="adjustWorkflowCanvasZoom"
        @convert-requirement="openWorkflowRequirementConvertModal"
        @focus-node="selectWorkflowCanvasNode"
        @open-agent="openWorkflowAgentForNode"
        @fullscreen="openWorkflowCanvasFullscreen($event)"
        @close-fullscreen="closeWorkflowCanvasFullscreen"
        @edit-node="saveWorkflowCanvasNodeEdit"
        @rollback-version="rollbackWorkflowAnalysisVersion"
        @persist-knowledge="importWorkflowAnalysisToKnowledge"
        @open-knowledge="openWorkflowKnowledgeBase"
        @quick-action="runWorkflowNodeQuickAction"
      />

      <section v-if="false" class="panel project-blueprint-panel">
          <div class="panel-head">
            <div>
              <h3>{{ activeProjectBlueprint.title }}</h3>
              <p>基于当前项目、上传资料和知识库推断生成，可继续用流程卡片校准。</p>
            </div>
            <span class="confidence-pill">{{ activeProjectBlueprint.confidence === 'high' ? '高置信' : activeProjectBlueprint.confidence === 'medium' ? '中置信' : '低置信' }}</span>
          </div>
          <TabBar v-model="workflowBlueprintTab" :tabs="blueprintTabs" />

          <section class="blueprint-workbench">
            <div class="blueprint-workbench-head">
              <div>
                <strong>蓝图工作台</strong>
                <span>产品结构、用户路径、页面清单、交互状态、业务规则、设计决策和验收标准。</span>
              </div>
              <div class="blueprint-workbench-actions">
                <div class="segmented-control">
                  <button type="button" :class="{ active: blueprintWorkbenchViewMode === 'frame' }" @click="blueprintWorkbenchViewMode = 'frame'">框架图</button>
                  <button type="button" :class="{ active: blueprintWorkbenchViewMode === 'tree' }" @click="blueprintWorkbenchViewMode = 'tree'">结构树</button>
                  <button type="button" :class="{ active: blueprintWorkbenchViewMode === 'relation' }" @click="blueprintWorkbenchViewMode = 'relation'">关系图</button>
                </div>
                <button type="button" @click="handleBlueprintWorkbenchExpandAll">全部展开</button>
                <button type="button" @click="handleBlueprintWorkbenchCollapse">收起</button>
                <button type="button" @click="importActiveBlueprintToKnowledge">沉淀到知识库</button>
              </div>
            </div>
            <div class="blueprint-workbench-body">
              <aside class="blueprint-structure-tree">
                <div class="blueprint-side-head">
                  <strong>结构树</strong>
                  <span>{{ blueprintWorkbench.nodes.length }} 个节点</span>
                </div>
                <button
                  v-for="node in visibleBlueprintWorkbenchNodes"
                  :key="node.id"
                  type="button"
                  class="blueprint-tree-row"
                  :class="{ active: selectedBlueprintWorkbenchNode?.id === node.id, collapsed: node.collapsed }"
                  :style="{ '--depth': node.depth }"
                  @click="handleBlueprintWorkbenchNodeSelect(node.id)"
                >
                  <i v-if="node.children?.length" @click.stop="handleBlueprintWorkbenchNodeToggle(node.id)">{{ expandedBlueprintNodeIds[node.id] ? '−' : '+' }}</i>
                  <i v-else></i>
                  <strong>{{ node.title }}</strong>
                  <small>{{ blueprintNodeKindLabel(node.kind) }}</small>
                </button>
              </aside>
              <main v-if="blueprintWorkbenchViewMode === 'frame'" class="blueprint-frame-canvas">
                <article
                  v-for="node in visibleBlueprintWorkbenchNodes"
                  :key="`frame-${node.id}`"
                  class="blueprint-frame-node"
                  :class="{ active: selectedBlueprintWorkbenchNode?.id === node.id, collapsed: node.collapsed }"
                  :style="{ '--depth': node.depth }"
                  @click="handleBlueprintWorkbenchNodeSelect(node.id)"
                >
                  <div>
                    <span>{{ blueprintNodeKindLabel(node.kind) }}</span>
                    <strong>{{ node.title }}</strong>
                  </div>
                  <p>{{ node.meta || node.detail?.goal || '点击查看节点详情、流程步骤、异常状态和来源证据。' }}</p>
                  <button v-if="node.children?.length" type="button" @click.stop="handleBlueprintWorkbenchNodeToggle(node.id)">
                    {{ expandedBlueprintNodeIds[node.id] ? '收起' : '展开' }}
                  </button>
                </article>
              </main>
              <main v-else-if="blueprintWorkbenchViewMode === 'relation'" class="blueprint-relation-graph">
                <div class="blueprint-relation-chain">
                  <button
                    v-for="node in blueprintRelationPrimaryNodes"
                    :key="node.id"
                    type="button"
                    :class="{ active: selectedBlueprintWorkbenchNode?.id === node.id }"
                    @click="handleBlueprintWorkbenchNodeSelect(node.id)"
                  >
                    <span>{{ blueprintNodeKindLabel(node.type) }}</span>
                    <strong>{{ node.label }}</strong>
                  </button>
                </div>
                <div class="blueprint-relation-links">
                  <button
                    v-for="edge in activeBlueprintWorkbench.relationGraph.edges"
                    :key="`${edge.from}-${edge.to}-${edge.fromType}-${edge.toType}`"
                    type="button"
                    @click="handleBlueprintWorkbenchNodeSelect(edge.to)"
                  >
                    {{ getBlueprintRelationLabel(edge.from) }} → {{ getBlueprintRelationLabel(edge.to) }}
                  </button>
                </div>
              </main>
              <main v-else class="blueprint-frame-canvas blueprint-list-canvas">
                <article
                  v-for="node in blueprintWorkbench.nodes"
                  :key="`list-${node.id}`"
                  class="blueprint-frame-node"
                  :class="{ active: selectedBlueprintWorkbenchNode?.id === node.id }"
                  @click="handleBlueprintWorkbenchNodeSelect(node.id)"
                >
                  <div>
                    <span>{{ blueprintNodeKindLabel(node.kind) }}</span>
                    <strong>{{ node.title }}</strong>
                  </div>
                  <p>{{ node.detail?.goal || node.meta || '等待补充节点说明。' }}</p>
                </article>
              </main>
              <aside class="blueprint-node-detail">
                <div class="blueprint-detail-head">
                  <span>{{ blueprintNodeKindLabel(selectedBlueprintWorkbenchNode?.kind) }}</span>
                  <h4>节点详情</h4>
                  <strong>{{ selectedBlueprintNodeDetail.title || '请选择节点' }}</strong>
                </div>
                <section>
                  <b>目标</b>
                  <p>{{ selectedBlueprintNodeDetail.goal || '选择结构节点后展示详情。' }}</p>
                </section>
                <section>
                  <b>输入输出</b>
                  <span v-for="item in selectedBlueprintWorkbenchNodeDetailInputsOutputs" :key="item">{{ item }}</span>
                  <span v-if="!selectedBlueprintWorkbenchNodeDetailInputsOutputs.length">暂无明确输入输出。</span>
                </section>
                <section>
                  <b>流程步骤</b>
                  <ol>
                    <li v-for="item in selectedBlueprintNodeDetail.flowSteps" :key="item">{{ item }}</li>
                  </ol>
                </section>
                <section>
                  <b>关联页面</b>
                  <span v-for="item in selectedBlueprintNodeDetail.relatedPages" :key="item">{{ item }}</span>
                  <span v-if="!selectedBlueprintNodeDetail.relatedPages.length">暂无直接页面关联。</span>
                </section>
                <section>
                  <b>异常状态</b>
                  <span v-for="item in selectedBlueprintNodeDetail.exceptionStates" :key="item">{{ item }}</span>
                  <span v-if="!selectedBlueprintNodeDetail.exceptionStates.length">暂无异常状态。</span>
                </section>
                <section>
                  <b>关联知识</b>
                  <button v-for="item in selectedBlueprintNodeDetail.relatedKnowledge" :key="item.id" type="button" @click="openBlueprintRelatedKnowledge(item)">
                    {{ item.title }}
                  </button>
                  <span v-if="!selectedBlueprintNodeDetail.relatedKnowledge.length">暂无关联知识。</span>
                </section>
                <section>
                  <b>来源证据</b>
                  <span v-for="item in selectedBlueprintNodeDetail.evidence" :key="item">{{ item }}</span>
                  <span v-if="!selectedBlueprintNodeDetail.evidence.length">暂无证据片段。</span>
                </section>
              </aside>
            </div>
          </section>

          <section v-if="workflowBlueprintTab === 'profile'" class="blueprint-profile-grid">
            <div>
              <span>产品名称</span>
              <strong>{{ activeProjectBlueprint.profile.productName }}</strong>
            </div>
            <div>
              <span>产品定位</span>
              <strong>{{ activeProjectBlueprint.profile.positioning }}</strong>
            </div>
            <div>
              <span>目标人群</span>
              <strong>{{ activeProjectBlueprint.profile.targetUsers }}</strong>
            </div>
            <div>
              <span>核心目标</span>
              <strong>{{ activeProjectBlueprint.profile.primaryGoal }}</strong>
            </div>
            <div>
              <span>当前阶段</span>
              <strong>{{ activeProjectBlueprint.profile.stage }}</strong>
            </div>
            <div>
              <span>主要场景</span>
              <strong>{{ activeProjectBlueprint.profile.coreScenarios.join(' / ') }}</strong>
            </div>
          </section>

          <section v-if="workflowBlueprintTab === 'framework'" class="mindmap-panel">
            <BlueprintTree :node="activeProjectBlueprint.framework" />
          </section>

          <section v-if="workflowBlueprintTab === 'outline'" class="outline-diff-grid">
            <div>
              <strong>原大纲</strong>
              <span v-for="item in activeProjectBlueprint.outlineDiff.original" :key="item">{{ item }}</span>
            </div>
            <div>
              <strong>新增</strong>
              <span v-for="item in activeProjectBlueprint.outlineDiff.added" :key="item">新增：{{ item }}</span>
            </div>
            <div>
              <strong>修改</strong>
              <span v-for="item in activeProjectBlueprint.outlineDiff.changed" :key="item">修改：{{ item }}</span>
            </div>
            <div>
              <strong>待确认</strong>
              <span v-for="item in activeProjectBlueprint.outlineDiff.pending" :key="item">待确认：{{ item }}</span>
            </div>
          </section>

          <section v-if="workflowBlueprintTab === 'flow'" class="mindmap-panel">
            <BlueprintTree :node="activeProjectBlueprint.interactionTree" />
          </section>

          <section v-if="workflowBlueprintTab === 'spec'" class="interaction-spec-panel">
            <article v-for="page in activeProjectBlueprint.interactionSpec?.pageSpecs || []" :key="page.screenId" class="interaction-spec-card">
              <div class="interaction-spec-head">
                <div>
                  <span>页面说明</span>
                  <h4>{{ page.pageName }}</h4>
                </div>
                <strong>{{ page.screenId }}</strong>
              </div>
              <p>{{ page.layout }}</p>
              <div class="interaction-spec-grid">
                <section>
                  <b>页面状态矩阵</b>
                  <span v-for="state in page.states" :key="`${page.screenId}-${state.name}`">
                    {{ state.name }}：{{ state.trigger }} → {{ state.next }}
                  </span>
                </section>
                <section>
                  <b>手势 / 事件</b>
                  <span v-for="event in page.events" :key="`${page.screenId}-${event.gesture}-${event.target}`">
                    {{ event.gesture }} {{ event.target }}：{{ event.effect }}
                  </span>
                </section>
                <section>
                  <b>跳转 / 返回</b>
                  <span>进入：{{ page.navigation.entry }}</span>
                  <span>下一步：{{ page.navigation.next }}</span>
                  <span>返回：{{ page.navigation.back }}</span>
                </section>
                <section>
                  <b>异常与恢复</b>
                  <span v-for="item in page.exceptions" :key="`${page.screenId}-${item.trigger}`">
                    {{ item.trigger }}：{{ item.recovery }}
                  </span>
                </section>
              </div>
            </article>
            <section class="interaction-spec-checks">
              <b>验收检查</b>
              <span v-for="item in activeProjectBlueprint.interactionSpec?.acceptanceChecks || []" :key="item">{{ item }}</span>
            </section>
          </section>

          <section v-if="workflowBlueprintTab === 'skillV2'" class="interaction-skill-panel">
            <article class="interaction-skill-hero">
              <div>
                <span>交互规则</span>
                <h3>{{ activeProjectBlueprint.interactionSkillV2?.title }}</h3>
                <p>把需求拆解、页面组、方案组、Wireframe Plan、质量修复和可交互 Demo 串成完整产出链。</p>
              </div>
              <strong>质量分 {{ activeProjectBlueprint.interactionSkillV2?.qualityReport?.score }}</strong>
            </article>

            <section class="skill-input-strategy">
              <h4>输入与上传策略</h4>
              <div>
                <span v-for="item in interactionSkillInputEntries" :key="item.key">
                  <b>{{ item.key }}</b>
                  {{ item.value }}
                </span>
              </div>
            </section>

            <section class="skill-stage-list">
              <article v-for="stage in activeProjectBlueprint.interactionSkillV2?.agentStages || []" :key="stage.id">
                <strong>{{ stage.name }}</strong>
                <small>{{ stage.id }} · {{ stage.output }}</small>
                <div>
                  <em v-for="status in stage.statusFlow" :key="`${stage.id}-${status}`">{{ status }}</em>
                </div>
              </article>
            </section>

            <section class="skill-group-grid">
              <article>
                <h4>需求组</h4>
                <div v-for="group in activeProjectBlueprint.interactionSkillV2?.requirementGroups || []" :key="group.id">
                  <strong>{{ group.title }} · {{ group.priority }}</strong>
                  <span v-for="point in group.reviewPoints" :key="`${group.id}-${point}`">{{ point }}</span>
                </div>
              </article>
              <article>
                <h4>页面组 / 方案组</h4>
                <div v-for="group in activeProjectBlueprint.interactionSkillV2?.pageGroups || []" :key="group.id">
                  <strong>{{ group.title }} · {{ group.priority }}</strong>
                  <span>{{ group.goal }}</span>
                  <span>方案：{{ group.selectedSolutionId }}</span>
                </div>
              </article>
            </section>

            <section class="skill-wireframe-plan">
              <div class="skill-section-head">
                <h4>Wireframe Plan JSON</h4>
                <span>{{ activeProjectBlueprint.interactionSkillV2?.wireframePlan?.pages?.length || 0 }} 个页面 · {{ activeProjectBlueprint.interactionSkillV2?.wireframePlan?.actions?.length || 0 }} 个跳转</span>
              </div>
              <div class="wireframe-plan-page-grid">
                <article v-for="page in activeProjectBlueprint.interactionSkillV2?.wireframePlan?.pages || []" :key="page.id">
                  <strong>{{ page.title }}</strong>
                  <small>{{ page.route }} · {{ page.priority }}</small>
                  <div>
                    <em v-for="item in page.components" :key="item.id">{{ item.label }} · {{ item.type }}</em>
                  </div>
                </article>
              </div>
            </section>

            <section class="skill-quality-grid">
              <article>
                <h4>质量检查</h4>
                <span v-for="check in activeProjectBlueprint.interactionSkillV2?.qualityReport?.checks || []" :key="check.id" :class="{ passed: check.passed }">
                  {{ check.label }}：{{ check.passed ? '通过' : '待修复' }}
                </span>
              </article>
              <article>
                <h4>自动修复建议</h4>
                <span v-for="item in activeProjectBlueprint.interactionSkillV2?.qualityReport?.repairItems || []" :key="item.id">
                  {{ item.reason }} → {{ item.action }}
                </span>
              </article>
            </section>

            <section class="skill-scenario-matrix">
              <h4>Demo 场景矩阵</h4>
              <article v-for="scenario in activeProjectBlueprint.interactionSkillV2?.demoScenarioMatrix || []" :key="scenario.id">
                <strong>{{ scenario.label }}</strong>
                <span>触发：{{ scenario.trigger }}</span>
                <span>恢复：{{ scenario.recovery }}</span>
              </article>
            </section>
          </section>

          <section v-if="workflowBlueprintTab === 'skillV3'" class="interaction-skill-panel interaction-skill-v3">
            <article class="interaction-skill-hero">
              <div>
                <span>Demo 规则</span>
                <h3>{{ activeProjectBlueprint.interactionSkillV3?.title }}</h3>
                <p>{{ activeProjectBlueprint.interactionSkillV3?.goal }}</p>
              </div>
              <strong>QA {{ activeProjectBlueprint.interactionSkillV3?.qaProtocol?.score }}</strong>
            </article>

            <section class="skill-execution-order">
              <span v-for="item in activeProjectBlueprint.interactionSkillV3?.executionOrder || []" :key="item">{{ item }}</span>
            </section>

            <section class="skill-v3-grid">
              <article>
                <div class="skill-section-head">
                  <h4>State Machine</h4>
                  <span>{{ activeProjectBlueprint.interactionSkillV3?.stateMachines?.length || 0 }} 个页面</span>
                </div>
                <div v-for="machine in activeProjectBlueprint.interactionSkillV3?.stateMachines || []" :key="machine.pageId" class="state-machine-card">
                  <strong>{{ machine.pageId }}</strong>
                  <small>{{ machine.initialState }} · {{ machine.states.length }} states</small>
                  <span v-for="transition in machine.transitions.slice(0, 4)" :key="`${machine.pageId}-${transition.event}`">
                    {{ transition.event }}：{{ transition.from }} → {{ transition.to }}
                  </span>
                </div>
              </article>

              <article>
                <div class="skill-section-head">
                  <h4>UI Node Tree</h4>
                  <span>控件位置 + 状态</span>
                </div>
                <div v-for="page in activeProjectBlueprint.interactionSkillV3?.uiNodeTree || []" :key="page.pageId" class="ui-node-card">
                  <strong>{{ page.title }}</strong>
                  <span>{{ page.layout }}</span>
                  <div>
                    <em v-for="node in page.nodes" :key="node.id">{{ node.label }} · {{ node.control }}</em>
                  </div>
                </div>
              </article>
            </section>

            <section class="skill-v3-grid">
              <article>
                <div class="skill-section-head">
                  <h4>Review Workbench</h4>
                  <span>{{ activeProjectBlueprint.interactionSkillV3?.reviewWorkbench?.layout }}</span>
                </div>
                <div v-for="panel in activeProjectBlueprint.interactionSkillV3?.reviewWorkbench?.panels || []" :key="panel.id" class="workbench-panel-card">
                  <strong>{{ panel.title }}</strong>
                  <span>{{ panel.placement }} · {{ panel.action }}</span>
                </div>
              </article>

              <article>
                <div class="skill-section-head">
                  <h4>QA Protocol</h4>
                  <span>门禁 + 修复循环</span>
                </div>
                <span
                  v-for="gate in activeProjectBlueprint.interactionSkillV3?.qaProtocol?.gates || []"
                  :key="gate.id"
                  class="qa-gate"
                  :class="{ passed: gate.passed }"
                >
                  {{ gate.label }}：{{ gate.passed ? '通过' : '待修复' }}
                </span>
                <div class="repair-loop-list">
                  <em v-for="step in activeProjectBlueprint.interactionSkillV3?.qaProtocol?.repairLoop || []" :key="step.step">
                    {{ step.step }}. {{ step.action }}
                  </em>
                </div>
              </article>
            </section>

            <section class="skill-wireframe-plan">
              <div class="skill-section-head">
                <h4>Demo Schema</h4>
                <span>{{ activeProjectBlueprint.interactionSkillV3?.demoSchema?.styleVariants?.join(' / ') }} · {{ activeProjectBlueprint.interactionSkillV3?.demoSchema?.interactionModes?.join(' / ') }}</span>
              </div>
              <div class="wireframe-plan-page-grid">
                <article v-for="page in activeProjectBlueprint.interactionSkillV3?.demoSchema?.pages || []" :key="page.id">
                  <strong>{{ page.title }}</strong>
                  <small>{{ page.route }} · {{ page.defaultScenarioId }}</small>
                  <span>{{ page.layout }}</span>
                </article>
              </div>
            </section>
          </section>

          <section v-if="workflowBlueprintTab === 'opportunity'" class="opportunity-panel">
            <article class="interaction-skill-hero">
              <div>
                <span>Opportunity Validation</span>
                <h3>{{ activeProjectBlueprint.opportunityValidation?.title }}</h3>
                <p>基于 Persona、JTBD、Journey Map、Service Blueprint、RICE/Kano 和三轮评审，判断下一步该做什么。</p>
              </div>
              <strong>{{ activeProjectBlueprint.opportunityValidation?.topOpportunities?.length || 0 }} 个机会点</strong>
            </article>

            <section class="opportunity-top-grid">
              <article v-for="item in activeProjectBlueprint.opportunityValidation?.topOpportunities || []" :key="item.id">
                <div>
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.priority }} · weight {{ item.weight }} · {{ item.surfaceDecision.recommended }}</span>
                </div>
                <p>{{ item.surfaceDecision.reason }}</p>
                <div class="opportunity-score-row">
                  <em>RICE {{ item.rice.score }}</em>
                  <em>{{ item.kano }}</em>
                  <em>{{ item.pyramidLevel }}</em>
                </div>
              </article>
            </section>

            <section class="opportunity-grid">
              <article>
                <div class="skill-section-head">
                  <h4>路径证据</h4>
                  <span>{{ activeProjectBlueprint.opportunityValidation?.journeyMaps?.length || 0 }} 条路径</span>
                </div>
                <div v-for="journey in activeProjectBlueprint.opportunityValidation?.journeyMaps || []" :key="journey.journeyId" class="state-machine-card">
                  <strong>{{ journey.scenario }}</strong>
                  <small>{{ journey.start }} → {{ journey.end }}</small>
                  <span v-for="point in journey.touchpoints" :key="`${journey.journeyId}-${point.step}`">
                    {{ point.touchpoint }}：{{ point.painPoint || point.opportunityHint }}
                  </span>
                </div>
              </article>
              <article>
                <div class="skill-section-head">
                  <h4>痛点证据</h4>
                  <span>{{ activeProjectBlueprint.opportunityValidation?.painPointEvidenceMatrix?.length || 0 }} 个痛点</span>
                </div>
                <div v-for="pain in activeProjectBlueprint.opportunityValidation?.painPointEvidenceMatrix || []" :key="pain.id" class="state-machine-card">
                  <strong>{{ pain.title }} · {{ pain.severity }}</strong>
                  <span>{{ pain.observedIssue }}</span>
                  <small>{{ pain.userImpact }}</small>
                </div>
              </article>
            </section>

            <section class="opportunity-grid">
              <article>
                <div class="skill-section-head">
                  <h4>三轮评审</h4>
                  <span>UX / Product / Execution</span>
                </div>
                <div v-for="round in Object.values(activeProjectBlueprint.opportunityValidation?.threeRoundReview || {})" :key="round.title" class="workbench-panel-card">
                  <strong>{{ round.title }}</strong>
                  <span v-for="patch in round.items" :key="`${round.title}-${patch.action}`">{{ patch.action }}：{{ patch.reason }}</span>
                </div>
              </article>
              <article>
                <div class="skill-section-head">
                  <h4>迭代计划</h4>
                  <span>按优先级执行</span>
                </div>
                <div v-for="plan in activeProjectBlueprint.opportunityValidation?.finalIterationPlan || []" :key="plan.id" class="workbench-panel-card">
                  <strong>{{ plan.title }} · {{ plan.priority }}</strong>
                  <span>{{ plan.target }}</span>
                  <span>{{ plan.deliverables.join(' / ') }}</span>
                </div>
              </article>
            </section>
          </section>

          <section v-if="workflowBlueprintTab === 'demo'" class="demo-board">
            <div class="demo-screen-list">
              <button
                v-for="screen in activeProjectBlueprint.demoScreens"
                :key="screen.id"
                type="button"
                :class="{ active: activeDemoScreen?.id === screen.id }"
                @click="activeDemoScreenId = screen.id"
              >
                {{ screen.title }}
              </button>
            </div>
            <article v-if="activeDemoScreen" class="demo-screen-card">
              <div>
                <span>Low-fi Demo</span>
                <h3>{{ activeDemoScreen.title }}</h3>
                <p>{{ activeDemoScreen.description }}</p>
              </div>
              <div v-if="activeDemoScreen.wireframe" class="wireframe-canvas">
                <strong>{{ activeDemoScreen.wireframe.layout }}</strong>
                <div class="wireframe-section-grid">
                  <section v-for="section in activeDemoScreen.wireframe.sections" :key="section.name">
                    <b>{{ section.name }}</b>
                    <p>{{ section.detail }}</p>
                  </section>
                </div>
                <div class="wireframe-component-grid">
                  <span v-for="component in activeDemoScreen.wireframe.components" :key="`${activeDemoScreen.id}-${component.type}-${component.label}`">
                    {{ component.label }} · {{ component.type }}
                  </span>
                </div>
              </div>
              <div class="demo-actions">
                <button
                  v-for="action in activeDemoScreen.actions"
                  :key="`${activeDemoScreen.id}-${action.label}`"
                  type="button"
                  @click="activeDemoScreenId = action.to"
                >
                  {{ action.label }} → {{ action.to }}
                </button>
              </div>
            </article>
            <section class="demo-preview-panel">
              <div class="demo-generator-controls">
                <label>
                  参考风格网站
                  <input v-model="blueprintDemoForm.referenceUrl" placeholder="例如：https://www.gaoding.art/creation" />
                </label>
                <label>
                  Demo 风格
                  <select v-model="blueprintDemoForm.styleVariant">
                    <option v-for="item in demoStyleOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
                  </select>
                </label>
                <label>
                  交互方式
                  <select v-model="blueprintDemoForm.interactionMode">
                    <option v-for="item in demoInteractionOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
                  </select>
                </label>
              </div>
              <div class="result-toolbar">
                <div>
                  <strong>1:1 Demo 预览</strong>
                  <span>参考网页工厂的生成方式，把项目蓝图转成可点击 HTML 页面。当前版本：v{{ blueprintDemoRevision }}</span>
                </div>
                <div class="actions">
                  <button class="primary" type="button" @click="generateBlueprintDemoPreview">生成 1:1 Demo</button>
                  <button type="button" @click="refreshBlueprintDemoPreview">不满意，刷新一版</button>
                  <button type="button" :disabled="!blueprintDemoHtml" @click="openBlueprintDemoPreview">打开 1:1 Demo</button>
                  <button type="button" :disabled="!blueprintDemoHtml" @click="downloadBlueprintDemoHtml">下载 HTML</button>
                </div>
              </div>
              <iframe v-if="blueprintDemoHtml" class="preview-frame" title="项目蓝图 Demo 预览" :srcdoc="blueprintDemoHtml"></iframe>
              <div v-else class="empty-demo-preview">
                <strong>Demo 尚未生成</strong>
                <span>点击“生成 1:1 Demo”后，这里会展示可点击页面。</span>
              </div>
            </section>
          </section>

          <section v-if="workflowBlueprintTab === 'review'" class="review-checklist">
            <label v-for="item in activeProjectBlueprint.reviewChecklist" :key="item">
              <input type="checkbox" />
              <span>{{ item }}</span>
            </label>
          </section>
        </section>

        <section v-if="false" class="workflow-shell workflow-workbench-shell">
          <aside class="workflow-steps">
            <button
              v-for="step in workflowWorkbenchView.steps"
              :key="step.id"
              :class="{ active: step.isCurrent, completed: step.status === 'completed' || step.status === 'accepted', locked: step.status === 'locked' }"
              type="button"
              @click="selectWorkflowStep(step.id)"
            >
              <strong>{{ step.title }}</strong>
              <span>{{ step.statusLabel }}</span>
              <small v-if="step.lockReason">{{ step.lockReason }}</small>
            </button>
          </aside>

          <section v-if="activeWorkflowStep" class="workflow-card-stack">
            <article class="workflow-card workflow-workbench-card active">
              <div class="workflow-card-head">
                <div>
                  <small>{{ workflowWorkbenchView.title }}</small>
                  <h3>{{ activeWorkflowStep.title }}</h3>
                  <p>{{ workflowWorkbenchView.current.taskHint }}</p>
                </div>
                <button class="primary" type="button" @click="openWorkflowAgent">打开 Agent</button>
              </div>

              <div class="workflow-card-body">
                <section class="workflow-task-panel">
                  <div>
                    <strong>当前任务</strong>
                    <span>{{ activeWorkflowStep.goal }}</span>
                  </div>
                  <div class="workflow-task-actions">
                    <button
                      v-for="action in workflowWorkbenchView.current.secondaryActions"
                      :key="action.id"
                      type="button"
                      :disabled="action.disabled"
                      @click="runWorkflowWorkbenchAction(action.id)"
                    >
                      {{ action.label }}
                    </button>
                  </div>
                </section>

                <div v-if="!workflowGate.ok" class="validation-box">
                  <strong>建议通过右侧 Agent 补齐信息</strong>
                  <span>待校准：{{ workflowGate.missing.join('、') }}。也可以直接让 Agent 使用默认假设生成。</span>
                </div>

                <section class="workflow-output-card">
                  <div class="panel-head">
                    <div>
                      <h3>当前产出摘要</h3>
                      <p>完整一问一答、追问和历史记录在右侧 Agent 抽屉里。</p>
                    </div>
                    <span>{{ activeWorkflowVersions.length }} 个版本</span>
                  </div>
                  <pre v-if="workflowStepOutput" class="workflow-output-preview">{{ workflowStepOutput }}</pre>
                  <div v-else class="agent-empty-inline">
                    <strong>尚未生成草稿</strong>
                    <span>点击“打开 Agent”，通过一问一答补充信息并生成。</span>
                  </div>
                </section>

                <div class="actions">
                  <button class="primary" type="button" @click="openWorkflowAgent">在 Agent 中继续</button>
                  <button type="button" :disabled="!workflowStepOutput.trim()" @click="runWorkflowWorkbenchAction('accept-next')">采纳并进入下一步</button>
                </div>
              </div>
            </article>
          </section>
        </section>

        <WorkflowAgentDrawer
          v-if="activeView === 'workflow' && workflowAgentOpen && workflowAgentSession"
          ref="workflowAgentDrawerRef"
          :session="workflowAgentSession"
          :canvas-tabs="workflowCanvas.orderedTabs"
          :active-node="workflowAgentNode"
          :active-node-id="workflowAgentNodeId"
          :model="workflowAgentModel"
          :quick-replies="workflowAgentQuickReplies"
          :history-open="workflowAgentHistoryOpen"
          :references="workflowAgentReferences"
          :input="workflowAgentInput"
          :editing-message="workflowAgentEditingMessage"
          :retry-message="workflowAgentRetryMessage"
          :upload-open="workflowAgentUploadOpen"
          :width="workflowAgentDrawerWidth"
          :sending="workflowAgentSending"
          @close="workflowAgentOpen = false"
          @update-node="selectWorkflowCanvasNode"
          @update-model="workflowAgentModel = $event"
          @quick-reply="useWorkflowAgentQuickReply"
          @toggle-history="toggleWorkflowAgentHistory"
          @close-history="workflowAgentHistoryOpen = false"
          @select-history="workflowStepOutput = $event"
          @import-files="importWorkflowAgentFiles"
          @remove-reference="removeWorkflowAgentReference"
          @copy-message="copyWorkflowAgentMessage"
          @retry-message="retryWorkflowAgentMessage"
          @recovery-action="recoverWorkflowAgentMessage"
          @edit-message="editWorkflowAgentMessage"
          @cancel-edit="cancelWorkflowAgentEdit"
          @cancel-retry="cancelWorkflowAgentRetry"
          @confirm-message="openWorkflowAgentConfirmPreview"
          @update-input="workflowAgentInput = $event"
          @toggle-upload-menu="toggleWorkflowAgentUploadMenu"
          @close-upload-menu="workflowAgentUploadOpen = false"
          @add-cloud-doc="addFeishuReferencePlaceholder"
          @start-resize="startWorkflowAgentResize"
          @stop-generating="stopWorkflowAgentGeneration"
          @send="sendWorkflowAgentMessage"
        />

        <div v-if="workflowAgentConfirmPreview.open" class="modal-backdrop" @click.self="closeWorkflowAgentConfirmPreview">
          <section class="agent-confirm-preview" role="dialog" aria-modal="true" aria-label="确认写入画布">
            <div class="modal-head">
              <div>
                <p class="eyebrow">Agent Confirm</p>
                <h3>即将写入当前画布</h3>
              </div>
              <button type="button" aria-label="编辑当前画布节点" @click="openWorkflowAgentConfirmPreviewEditor">编辑</button>
            </div>
            <div class="agent-confirm-preview-scroll">
              <p>确认写入后，后端会合并这条 Agent 回复，并对后续刷新节点重新生成。</p>
              <div class="agent-confirm-target">
                <span>目标节点</span>
                <strong>{{ workflowAgentConfirmPreview.nodeTitle }}</strong>
              </div>
              <div class="agent-confirm-target">
                <span>将写入</span>
                <strong>{{ workflowAgentConfirmPreview.summary }}</strong>
              </div>
              <div class="agent-confirm-target">
                <span>刷新范围</span>
                <strong>{{ workflowAgentConfirmPreview.refreshScopeLabel }}</strong>
              </div>
              <div v-if="workflowAgentConfirmPreview.actionIntent" class="agent-confirm-target">
                <span>动作意图</span>
                <strong>{{ workflowAgentConfirmPreview.actionIntent }}</strong>
              </div>
              <div v-if="workflowAgentConfirmPreview.writeableItems.length || workflowAgentConfirmPreview.acceptanceCriteria.length" class="agent-confirm-evidence">
                <span>写入条目</span>
                <div v-if="workflowAgentConfirmPreview.writeableItems.length" class="agent-confirm-rationale">
                  <strong v-for="item in workflowAgentConfirmPreview.writeableItems" :key="item">{{ item }}</strong>
                </div>
                <div v-if="workflowAgentConfirmPreview.acceptanceCriteria.length" class="agent-confirm-rationale">
                  <span>验收标准</span>
                  <strong v-for="item in workflowAgentConfirmPreview.acceptanceCriteria" :key="item">验收标准：{{ item }}</strong>
                </div>
              </div>
              <pre>{{ workflowAgentConfirmPreview.content }}</pre>
              <div v-if="workflowAgentConfirmPreview.rationale.length || workflowAgentConfirmPreview.contextSources.length" class="agent-confirm-evidence">
                <span>提案依据</span>
                <div v-if="workflowAgentConfirmPreview.rationale.length" class="agent-confirm-rationale">
                  <strong v-for="item in workflowAgentConfirmPreview.rationale" :key="item">{{ item }}</strong>
                </div>
                <div v-if="workflowAgentConfirmPreview.contextSources.length" class="agent-confirm-sources">
                  <span>上下文来源</span>
                  <article
                    v-for="(item, index) in workflowAgentConfirmPreview.contextSources"
                    :key="workflowAgentConfirmPreviewSourceKey(item, index)"
                  >
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.snippet || item.matchReason }}</small>
                  </article>
                </div>
              </div>
              <div class="agent-confirm-downstream">
                <span>后续刷新</span>
                <div v-if="workflowAgentConfirmPreviewDownstream.length">
                  <strong v-for="(node, index) in workflowAgentConfirmPreviewDownstream" :key="workflowAgentConfirmPreviewNodeKey(node, index)">
                    {{ node.title }}
                    <small v-if="node.reason">影响原因：{{ node.reason }}</small>
                  </strong>
                </div>
                <div v-else>
                  <strong>无后续节点，仅刷新当前节点</strong>
                </div>
              </div>
            </div>
            <div class="agent-confirm-preview-footer">
              <div class="modal-actions">
                <button type="button" @click="closeWorkflowAgentConfirmPreview">取消</button>
                <button class="primary" type="button" :disabled="workflowAgentSending" @click="submitWorkflowAgentConfirmPreview">确认写入</button>
              </div>
            </div>
          </section>
        </div>

        <section v-if="false" class="panel final-conclusion-panel">
          <div class="panel-head">
            <div>
              <h3>最终结论</h3>
              <p>{{ activeWorkflowRun.finalConclusion.summary }}</p>
            </div>
          </div>
          <pre class="code-block">{{ activeWorkflowRun.finalConclusion.recommendedPlan }}</pre>
          <div class="final-grid">
            <div>
              <strong>关键决策</strong>
              <span v-for="item in activeWorkflowRun.finalConclusion.keyDecisions" :key="item">{{ item }}</span>
            </div>
            <div>
              <strong>下一步任务</strong>
              <span v-for="item in activeWorkflowRun.finalConclusion.nextTasks" :key="item">{{ item }}</span>
            </div>
          </div>
        </section>

        <section v-if="false" class="panel empty-workflow-panel">
          <h3>还没有运行中的流程</h3>
          <p>可以从项目诊断页选择推荐流程，也可以直接在这里选择 Skill 开始。</p>
        </section>

      <section v-if="activeView === 'assets'" class="view-panel assets-view">
        <section class="panel asset-list-panel">
          <ListHeader title="资产库" :count="currentAssets.length" />
          <div class="asset-list">
            <button
              v-for="asset in currentAssets"
              :key="asset.id"
              :class="{ active: selectedAsset?.id === asset.id }"
              type="button"
              @click="selectedAssetId = asset.id"
            >
              <strong>{{ asset.title }}</strong>
              <span>{{ asset.meta }} · {{ asset.status }}</span>
            </button>
          </div>
        </section>

        <section class="panel asset-detail-panel">
          <template v-if="selectedAsset">
            <div class="panel-head">
              <div>
                <h3>{{ selectedAsset.title }}</h3>
                <p>{{ selectedAsset.meta }} · {{ selectedAsset.status }}</p>
              </div>
              <div v-if="selectedAsset.blueprint" class="actions">
                <button type="button" @click="importBlueprintAssetToKnowledge(selectedAsset)">导入知识库</button>
              </div>
            </div>
            <section v-if="selectedAsset.blueprint" class="blueprint-profile-grid asset-blueprint-preview">
              <div>
                <span>产品定位</span>
                <strong>{{ selectedAsset.blueprint.profile.positioning }}</strong>
              </div>
              <div>
                <span>交互路径</span>
                <strong>{{ selectedAsset.blueprint.interactionTree.title }}</strong>
              </div>
              <div>
                <span>Demo 页面</span>
                <strong>{{ selectedAsset.blueprint.demoScreens.length }} 个页面</strong>
              </div>
            </section>
            <section v-if="selectedAsset.designSource" class="snapshot-asset-preview">
              <div class="snapshot-cover">
                <img v-if="selectedAsset.designSource.coverImage" :src="selectedAsset.designSource.coverImage" :alt="selectedAsset.title" />
                <div v-else class="snapshot-cover-empty">暂无截图</div>
              </div>
              <div class="snapshot-asset-facts">
                <div>
                  <span>来源</span>
                  <strong>{{ selectedAsset.designSource.origin === 'package' ? '网页快照包' : 'URL 网页快照' }}</strong>
                </div>
                <div>
                  <span>DOM 节点</span>
                  <strong>{{ selectedAsset.designSource.summary.layoutNodes }}</strong>
                </div>
                <div>
                  <span>组件样本</span>
                  <strong>{{ selectedAsset.designSource.summary.components }}</strong>
                </div>
                <div>
                  <span>图片资源</span>
                  <strong>{{ selectedAsset.designSource.summary.assets }}</strong>
                </div>
                <div>
                  <span>授权方式</span>
                  <strong>{{ selectedAsset.designSource.rawRef.authMode }}</strong>
                </div>
                <div>
                  <span>快照类型</span>
                  <strong>{{ selectedAsset.designSource.rawRef.captureKind }}</strong>
                </div>
              </div>
              <div class="actions">
                <button type="button" @click="switchView('factory')">回到网页工厂</button>
                <button class="primary" type="button" @click="factoryHomeTab = 'url-code'; switchView('factory')">查看还原资产</button>
              </div>
            </section>
            <pre class="code-block tall">{{ selectedAsset.content }}</pre>
            <div class="asset-meta-grid">
              <div>
                <strong>版本</strong>
                <span>{{ selectedAsset.versions?.length || 1 }}</span>
              </div>
              <div>
                <strong>运行链路</strong>
                <span>{{ selectedAsset.hiddenRunRecords?.length || 0 }} 条</span>
              </div>
            </div>
            <details class="run-record-details">
              <summary>查看运行链路</summary>
              <DataList :items="selectedAsset.hiddenRunRecords || []" empty="暂无运行链路" />
            </details>
          </template>
          <template v-else>
            <h3>暂无资产</h3>
            <p>完成诊断或流程后，结果会保存到这里。</p>
          </template>
        </section>
      </section>

      <section v-if="activeView === 'skillCenter'" class="view-panel skill-center-view">
        <section class="panel skill-library-panel">
          <div class="panel-head">
            <div>
              <h3>Skill 中心</h3>
              <p>系统 Skill 可复制为我的 Skill；自定义 Skill 支持表单模式和 Markdown 高级模式。</p>
            </div>
            <button class="primary" type="button" @click="startCreateSkill">新建我的 Skill</button>
          </div>
          <div class="skill-list">
            <button
              v-for="skill in availableSkills"
              :key="skill.id"
              :class="{ active: skillEditor.activeId === skill.id }"
              type="button"
              @click="editSkill(skill)"
            >
              <strong>{{ skill.name }}</strong>
              <span>{{ skill.category }} · {{ skill.source === 'system' ? '系统' : skill.status === 'pending-review' ? '待审核' : '我的' }}</span>
            </button>
          </div>
        </section>

        <section class="panel skill-editor-panel">
          <div class="panel-head">
            <div>
              <h3>Skill 编辑器</h3>
              <p>初级用户用表单，高级用户可切换 Markdown。</p>
            </div>
            <div class="actions">
              <button type="button" @click="skillEditor.mode = skillEditor.mode === 'form' ? 'markdown' : 'form'">
                {{ skillEditor.mode === 'form' ? '切到 Markdown' : '切到表单' }}
              </button>
              <button class="primary" type="button" @click="saveSkillDraft">保存 Skill</button>
            </div>
          </div>

          <div v-if="skillEditor.draft && skillEditor.mode === 'form'" class="skill-editor-grid">
            <label>名称<input v-model="skillEditor.draft.name" /></label>
            <label>分类<select v-model="skillEditor.draft.category">
              <option value="需求理解">需求理解</option>
              <option value="用户研究">用户研究</option>
              <option value="产品方案">产品方案</option>
              <option value="交互设计">交互设计</option>
              <option value="交付验证">交付验证</option>
              <option value="自定义">自定义</option>
            </select></label>
            <label>可见范围<select v-model="skillEditor.draft.visibility">
              <option value="project">当前项目</option>
              <option value="global">所有项目</option>
            </select></label>
            <label class="wide">描述<textarea v-model="skillEditor.draft.description"></textarea></label>
            <label>适用场景<textarea v-model="skillEditor.draft.applicableScenariosText"></textarea></label>
            <label>需要输入<textarea v-model="skillEditor.draft.requiredInputsText"></textarea></label>
            <label>知识库检索范围<textarea v-model="skillEditor.draft.knowledgeScopesText"></textarea></label>
            <label>工作步骤<textarea v-model="skillEditor.draft.stepsText"></textarea></label>
            <label>追问规则<textarea v-model="skillEditor.draft.followUpRulesText"></textarea></label>
            <label class="wide">输出格式<textarea v-model="skillEditor.draft.outputFormat"></textarea></label>
            <label class="wide">验收标准<textarea v-model="skillEditor.draft.qualityChecksText"></textarea></label>
            <section class="skill-builder-section wide">
              <div class="section-title-row">
                <strong>运行表单字段</strong>
                <button type="button" @click="addSkillInputField">添加字段</button>
              </div>
              <div v-for="field in skillEditor.draft.inputFields" :key="field.id" class="skill-field-row">
                <input v-model="field.label" placeholder="字段名" />
                <select v-model="field.type">
                  <option value="text">单行文本</option>
                  <option value="textarea">多行文本</option>
                  <option value="single-select">单选</option>
                  <option value="multi-select">多选</option>
                  <option value="number">数字</option>
                  <option value="boolean">开关</option>
                </select>
                <label class="inline-check"><input v-model="field.required" type="checkbox" /> 必填</label>
                <input v-model="field.placeholder" placeholder="占位提示" />
                <textarea
                  v-if="field.type === 'single-select' || field.type === 'multi-select'"
                  :value="fieldOptionsText(field)"
                  placeholder="选项，一行一个"
                  @input="updateFieldOptions(field, $event.target.value)"
                ></textarea>
                <button type="button" @click="removeSkillInputField(field.id)">删除</button>
              </div>
            </section>
            <section class="skill-builder-section wide">
              <strong>知识库范围</strong>
              <select v-model="skillEditor.draft.knowledgeScopeConfig.mode">
                <option value="current-project">当前项目</option>
                <option value="selected-projects">指定项目</option>
                <option value="selected-items">指定知识条目</option>
                <option value="all-projects">全部项目</option>
              </select>
              <div class="scope-chip-row">
                <label v-for="type in ['knowledge', 'requirements', 'competitors', 'assets']" :key="type">
                  <input
                    type="checkbox"
                    :checked="skillEditor.draft.knowledgeScopeConfig.sourceTypes.includes(type)"
                    @change="toggleScopeType(type)"
                  />
                  {{ type }}
                </label>
              </div>
              <select
                v-if="skillEditor.draft.knowledgeScopeConfig.mode === 'selected-projects'"
                v-model="skillEditor.draft.knowledgeScopeConfig.projectIds"
                multiple
              >
                <option v-for="project in state.projects" :key="project.id" :value="project.id">
                  {{ displayProjectName(project) }}
                </option>
              </select>
            </section>
          </div>

          <textarea
            v-if="skillEditor.draft && skillEditor.mode === 'markdown'"
            v-model="skillEditor.markdown"
            class="markdown-editor"
          ></textarea>

          <div class="skill-import-box">
            <strong>外部 Skill 导入</strong>
            <input v-model="skillImportForm.url" placeholder="GitHub 或网页链接，只会导入为待审核草稿" />
            <textarea v-model="skillImportForm.raw" placeholder="也可以粘贴 Markdown Skill 内容"></textarea>
            <button type="button" @click="importSkillDraft">导入为草稿</button>
          </div>

          <div v-if="skillEditor.draft" class="validation-box">
            <strong>{{ skillValidation.ok ? '结构检查通过' : '结构需要补齐' }}</strong>
            <span v-if="skillValidation.missing.length">缺失：{{ skillValidation.missing.join('、') }}</span>
            <span v-for="warning in skillValidation.warnings" :key="warning">{{ warning }}</span>
          </div>
        </section>
      </section>

      <section v-if="activeView === 'settings'" class="view-panel">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>API 配置</h3>
              <p>这些地址会保存在浏览器本地。未配置时页面显示待接入，不阻断产品流程。</p>
            </div>
          </div>
          <div class="settings-grid">
            <label v-for="item in apiFields" :key="item.key">
              {{ item.label }}
              <input v-model="state.apiConfig[item.key]" :placeholder="item.placeholder" />
            </label>
          </div>
          <div class="actions">
            <button class="primary" type="button" @click="persistState">保存配置</button>
            <button type="button" @click="resetApiConfig">恢复本地默认接口</button>
            <button type="button" @click="testApiConfig">测试主服务</button>
          </div>
          <Notice :result="settingsStatus" />
        </section>
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>后端模型配置</h3>
              <p>模型 key 只提交给后端保存，前端只显示脱敏状态。</p>
            </div>
            <span>{{ modelSettingsStatus.hasApiKey ? `已保存 ${modelSettingsStatus.apiKeyMasked}` : '未保存 key' }}</span>
          </div>
          <div class="settings-grid">
            <label>
              供应商
              <select v-model="modelSettingsForm.provider">
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="deterministic">Deterministic</option>
              </select>
            </label>
            <label>
              Base URL
              <input v-model="modelSettingsForm.baseUrl" placeholder="https://api.openai.com/v1" />
            </label>
            <label>
              默认模型
              <input v-model="modelSettingsForm.defaultModel" placeholder="gpt-5.5" />
            </label>
            <label>
              API Surface
              <select v-model="modelSettingsForm.apiSurface">
                <option value="responses">responses</option>
                <option value="chat.completions">chat.completions</option>
              </select>
            </label>
            <label>
              API Key
              <input v-model="modelSettingsForm.apiKey" type="password" placeholder="留空表示保留后端已保存 key" autocomplete="off" />
            </label>
            <label>
              超时 ms
              <input v-model="modelSettingsForm.timeoutMs" type="number" min="1000" step="1000" />
            </label>
          </div>
          <div class="actions">
            <label class="inline-check">
              <input v-model="modelSettingsForm.enabled" type="checkbox" />
              启用后端模型
            </label>
            <button type="button" @click="loadModelSettings">读取后端配置</button>
            <button class="primary" type="button" @click="saveBackendModelSettings">保存到后端</button>
            <button type="button" @click="testBackendModelSettings">测试模型</button>
            <button type="button" @click="runBackendModelSampleAnalysis">测试登录注册弹窗</button>
          </div>
          <div v-if="modelSettingsTestResult" class="validation-box">
            <strong>模型连通：{{ modelSettingsTestResult.status === 'success' ? '通过' : '失败' }}</strong>
            <span>{{ modelSettingsTestResult.provider }} · {{ modelSettingsTestResult.model }}</span>
            <span>Tokens：{{ modelSettingsTestTotalTokens }}</span>
            <span v-if="modelSettingsTestResult.validation && !modelSettingsTestResult.validation.ok">{{ modelSettingsTestResult.validation.error }}</span>
          </div>
          <div v-if="modelSettingsSampleResult" class="validation-box">
            <strong>样例分析：{{ modelSettingsSampleResult.analysis?.displaySkillName || '智能推荐 Skill' }}</strong>
            <span>意图：{{ modelSettingsSampleResult.analysis?.detectedIntent || 'auth-modal' }}</span>
            <span>画布节点：{{ modelSettingsSampleResult.analysis?.canvas?.nodes?.length || 0 }}</span>
            <span>生成状态：{{ modelSettingsSampleResult.analysis?.generation?.status || 'generated' }}</span>
          </div>
        </section>
        <section class="panel model-call-log-panel">
          <div class="panel-head">
            <div>
              <h3>模型调用日志</h3>
              <p>查看最近模型调用、fallback 原因、token 用量和耗时，用于排查输出质量。</p>
            </div>
            <button type="button" @click="loadModelCallLogs">刷新日志</button>
          </div>
          <div class="model-call-log-filters">
            <label>
              状态
              <select v-model="modelCallLogFilters.status" @change="loadModelCallLogs">
                <option value="">全部状态</option>
                <option value="success">success</option>
                <option value="fallback">fallback</option>
                <option value="error">error</option>
              </select>
            </label>
            <label>
              Skill
              <input v-model="modelCallLogFilters.skillId" placeholder="auth-page-generation" @keydown.enter="loadModelCallLogs" />
            </label>
            <label>
              项目
              <input v-model="modelCallLogFilters.projectId" placeholder="project-id" @keydown.enter="loadModelCallLogs" />
            </label>
            <label>
              需求范围
              <select v-model="modelCallLogFilters.demandScope" @change="loadModelCallLogs">
                <option value="">全部范围</option>
                <option value="project">project</option>
                <option value="non-project">non-project</option>
              </select>
            </label>
          </div>
          <div v-if="modelCallLogs.length" class="model-call-log-list">
            <article v-for="log in modelCallLogs" :key="log.id">
              <div>
                <strong>{{ log.skillId || log.resolvedSkillId || 'unknown-skill' }}</strong>
                <span>{{ log.provider || 'provider' }} · {{ log.model || 'model' }} · {{ log.status }}</span>
              </div>
              <div class="model-call-log-metrics">
                <span>tokens {{ log.usage?.totalTokens || 0 }}</span>
                <span>{{ log.durationMs || 0 }}ms</span>
                <span>{{ log.demandScope || 'scope' }}</span>
                <span>{{ log.projectId || 'no-project' }}</span>
                <span>{{ log.detectedIntent || 'intent' }}</span>
                <span>{{ log.createdAt || '暂无时间' }}</span>
              </div>
              <small v-if="log.routingReason">routingReason：{{ log.routingReason }}</small>
              <small v-if="log.fallbackReason">fallbackReason：{{ log.fallbackReason }}</small>
            </article>
          </div>
          <div v-else class="materials-empty">
            <strong>暂无模型调用日志</strong>
            <p>启用后端模型并执行一次分析后，这里会展示调用状态、token 和 fallback 原因。</p>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>Skill 编排策略</h3>
              <p>由后端决定 Skill 的 prompt、输出 Schema、质量检查和兜底 Skill，前端只维护配置。</p>
            </div>
            <span>{{ skillOrchestrationForm.enabled ? '后端编排中' : '未启用' }}</span>
          </div>
          <div class="settings-grid">
            <label>
              Skill ID
              <input v-model="skillOrchestrationForm.skillId" placeholder="auth-page-generation" />
            </label>
            <label>
              输出 Schema
              <input v-model="skillOrchestrationForm.outputSchema" placeholder="auth-page" />
            </label>
            <label>
              兜底 Skill
              <input v-model="skillOrchestrationForm.fallbackSkillId" placeholder="demand-four-step" />
            </label>
            <label class="wide">
              Prompt Template
              <textarea v-model="skillOrchestrationForm.promptTemplate" placeholder="输入后端用于覆盖该 Skill 的提示词"></textarea>
            </label>
            <label class="wide">
              质量检查 qualityChecks
              <textarea v-model="skillOrchestrationForm.qualityChecksText" placeholder="每行一个质量检查项"></textarea>
            </label>
          </div>
          <div class="actions">
            <label class="inline-check">
              <input v-model="skillOrchestrationForm.enabled" type="checkbox" />
              启用后端 Skill 编排
            </label>
            <button type="button" @click="loadSkillOrchestrationSettings">读取编排配置</button>
            <button class="primary" type="button" @click="saveBackendSkillOrchestrationSettings">保存编排策略</button>
          </div>
        </section>
      </section>
    </main>

    <div v-if="projectSwitchOverlayMessage" class="project-switch-overlay" role="status" aria-live="polite">
      <div class="project-switch-spinner" aria-hidden="true"></div>
      <strong>{{ projectSwitchOverlayMessage }}</strong>
      <span>请稍候，正在同步项目数据...</span>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { api, defaultApiConfig, isConfigured } from './services/api'
import { loadState, saveState } from './services/storage'
import { createVueViteFiles, downloadZip } from './services/zip'
import { parseWebsnapFile } from './services/websnap'
import { getSidebarNavItems } from './services/navigation'
import {
  SNAPSHOT_AUTH_MODES,
  buildSnapshotCaptureRequest,
  normalizeSnapshotAuthMode,
  snapshotAuthModeMeta,
  snapshotCaptureStatusMessage
} from './services/snapshotCapture'
import {
  designSourceFromCaptureResult,
  upsertDesignSource
} from './services/designSources'
import {
  blueprintKnowledgeItems,
  buildBlueprintDemoHtml,
  buildProjectBlueprint,
  deleteMaterialItemsById,
  exportBlueprintMarkdown,
  toggleAllMaterialIds
} from './services/projectBlueprint'
import { buildDocumentAnalysisView } from './services/documentAnalysis'
import { extractDocumentText, importLocalDocuments } from './services/documentImport'
import {
  captureRestoreReadiness,
  captureActionState,
  captureLoadingExperience,
  normalizeFactoryWorkspace,
  restoredPagePreviewSummary,
  restoredPagePreviewHtml,
  restoredPagesForProject
} from './services/factoryWorkspace'
import { buildVisualVerificationReport, createBaselinePassedComparison } from './services/visualVerification'
import { designPalette, designRules } from './designRules'
import {
  availableProjectSkills,
  createProject,
  createUser,
  normalizeWorkspaceState,
  reconcileProjectSelection,
  stripEphemeralWorkspaceState,
  scopeItems
} from './services/projectWorkspace'
import {
  buildSkillExecutionContext,
  createSystemSkills,
  markdownToSkill,
  normalizeSkill,
  skillToMarkdown,
  validateSkill
} from './services/skills'
import {
  applyCandidateOption,
  canAdvanceStep,
  canEnterNextStep,
  createWorkflowRun,
  ensureFinalConclusion,
  exportWorkflowRunMarkdown,
  getBuiltinWorkflows,
  getCurrentStep
} from './services/workflows'
import {
  buildWorkflowAgentSession,
  buildWorkflowArtifactStages,
  buildWorkflowWorkbenchView,
  defaultWorkflowStepInputs
} from './services/workflowWorkbench'
import {
  buildBlueprintWorkbench,
  visibleBlueprintFrameNodes
} from './services/blueprintWorkbench'
import { buildKnowledgeHubView, relatedKnowledgeForBlueprintNode } from './services/knowledgeHub'
import { buildPrototypeDemoAsset, selectPrototypeDemoScreen } from './services/prototypeDemo'
import { KNOWLEDGE_DEPOSIT_TYPES, buildKnowledgeDepositPayload } from './services/knowledgeDeposit'
import WorkflowAgentDrawer from './components/workflow/WorkflowAgentDrawer.vue'
import WorkflowCanvasPage from './components/workflow/WorkflowCanvasPage.vue'

const initialPalette = designPalette
const NOTICE_AUTO_HIDE_MS = {
  success: 3000,
  info: 4000
}
let noticeAutoHideTimer = null
function wait(ms = 0) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
const PENDING_CAPTURE_TASK_KEY = 'liuchengtong-pending-capture-task'
const APP_PAGE_ROUTES = {
  requirements: '/projects/:projectId/requirements',
  materials: '/projects/:projectId/knowledge',
  workflow: '/projects/:projectId/design',
  factory: '/projects/:projectId/factory',
  assets: '/projects/:projectId/assets',
  skillCenter: '/projects/:projectId/skills',
  competitors: '/projects/:projectId/competitors',
  settings: '/projects/:projectId/settings'
}

const saved = loadState()
const bootState = saved || {
  currentUserId: 'user-local-default',
  users: [{ id: 'user-local-default', name: '流程通用户', email: 'local@liuchengtong.test', avatar: '流', role: 'owner' }],
  currentProjectId: 'project-flow',
  projects: [{ id: 'project-flow', ownerUserId: 'user-local-default', name: '流程通默认项目' }],
  apiConfig: defaultApiConfig(),
  palette: initialPalette,
  componentLibrary: {
    source: designRules.source,
    components: [
      { name: 'PrimaryButton', type: 'button', style: designRules.components.primaryButton },
      { name: 'SegmentedControl', type: 'control', style: designRules.components.segmentedControl },
      { name: 'SceneChip', type: 'chip', style: designRules.components.sceneChip },
      { name: 'PromptComposer', type: 'composer', style: designRules.components.promptComposer },
      { name: 'TemplateCard', type: 'card', style: designRules.layout.templateCard }
    ]
  },
  captureResult: null,
  generatedPageHtml: '',
  reactFiles: [],
  vueFiles: createVueViteFiles({ title: '流程通 UX 预览', palette: initialPalette }),
  knowledge: [],
  requirements: [],
  competitors: [],
  skills: createSystemSkills(),
  skillRuns: [],
  assets: [],
  designSources: [],
  restoredPages: [],
  factoryTasks: [],
  workflowRuns: [],
  currentFactoryRoute: 'home',
  selectedRestoredPageId: '',
  activeWorkflowRun: null,
  generationHistory: []
}

function sanitizeLegacyNames(value) {
  const legacyAscii = ['hao', 'dazi'].join('')
  const legacyPackage = `${legacyAscii}-websnap`
  const legacyChinese = '\u597d\u642d\u5b50'
  if (Array.isArray(value)) return value.map(sanitizeLegacyNames)
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      value[key] = sanitizeLegacyNames(value[key])
    })
    return value
  }
  if (typeof value !== 'string') return value
  return value
    .replaceAll(legacyPackage, 'web-snapshot-import')
    .replaceAll(legacyAscii, 'web-snapshot')
    .replaceAll(legacyChinese, '网页解析')
}

sanitizeLegacyNames(bootState)
Object.assign(bootState, normalizeWorkspaceState(bootState))
Object.assign(bootState, normalizeFactoryWorkspace(bootState))
Object.assign(bootState, stripEphemeralWorkspaceState(bootState))

if (!Array.isArray(bootState.skills) || !bootState.skills.length) {
  bootState.skills = createSystemSkills()
}
if (!Array.isArray(bootState.users) || !bootState.users.length) {
  bootState.users = [createUser({ id: bootState.currentUserId || 'user-local-default' })]
}
if (!bootState.currentUserId) {
  bootState.currentUserId = bootState.users[0].id
}
if (!bootState.skills.some((skill) => skill.id === 'default-general-design-skill')) {
  bootState.skills.unshift(createSystemSkills()[0])
}
if (!Array.isArray(bootState.skillRuns)) bootState.skillRuns = []
if (!Array.isArray(bootState.assets)) bootState.assets = []
if (!Array.isArray(bootState.designSources)) bootState.designSources = []
if (!Array.isArray(bootState.workflowRuns)) bootState.workflowRuns = []
if (!Array.isArray(bootState.factoryTasks)) bootState.factoryTasks = []
if (!('activeWorkflowRun' in bootState)) bootState.activeWorkflowRun = null

if (!bootState.localApiDefaultsApplied) {
  bootState.apiConfig = defaultApiConfig()
  bootState.localApiDefaultsApplied = true
}
bootState.apiConfig = defaultApiConfig()
if (!bootState.captureResult) {
  bootState.reactFiles = []
}
const state = reactive(bootState)
const currentLocationHash = ref(typeof window === 'undefined' ? '' : window.location.hash || '')

watch(state, () => saveState(state), { deep: true })

onMounted(() => {
  refreshCurrentLocationHash()
  restoreAppRouteFromUrl()
  restoreWorkflowDeepLinkFromCurrentHashSoon()
  void hydrateWorkspaceFromBackend()
  void loadModelSettings()
  void loadModelCallLogs()
  void loadSkillOrchestrationSettings()
  window.addEventListener('hashchange', restoreAppRouteFromUrl)
  window.addEventListener('keydown', handleWorkflowAgentGlobalKeydown)
  window.addEventListener('message', handleStaticHtmlPreviewMessage)
})

onUnmounted(() => {
  stopCaptureLoadingTimer()
  stopBrowserPreviewPolling()
  window.removeEventListener('hashchange', restoreAppRouteFromUrl)
  window.removeEventListener('keydown', handleWorkflowAgentGlobalKeydown)
  window.removeEventListener('message', handleStaticHtmlPreviewMessage)
  stopWorkflowAnalysisDeepLinkPolling()
})

function handleStaticHtmlPreviewMessage(event) {
  const type = event?.data?.type || ''
  if (!type.startsWith('image-html-')) return
  if (type === 'image-html-retry') {
    openFactoryHome('image-code')
    if (imageCodeForm.imageDataUrl && imageCodeStatus.value.status !== 'loading') {
      void generateFromImage()
    }
    return
  }
  if (type === 'image-html-reupload') {
    openFactoryHome('image-code')
    return
  }
  if (type === 'image-html-open-settings') {
    switchView('settings')
    void loadModelCallLogs()
  }
}

function handleWorkflowAgentGlobalKeydown(event) {
  if (event.key !== 'Escape') return
  if (workflowAgentConfirmPreview.open) closeWorkflowAgentConfirmPreview()
}

function initialActiveViewFromHash() {
  if (typeof window === 'undefined') return 'materials'
  const hash = window.location.hash || ''
  const projectRoute = parseProjectScopedHash(hash)
  if (projectRoute?.route?.startsWith('/factory') || projectRoute?.route?.startsWith('/assets/')) return 'factory'
  if (projectRoute?.route?.startsWith('/workflow') || projectRoute?.route === '/design') return 'workflow'
  if (projectRoute?.route === '/assets') return 'assets'
  if (projectRoute?.route === '/skills') return 'skillCenter'
  if (projectRoute?.route === '/settings') return 'settings'
  if (hash.startsWith('#/factory')) return 'factory'
  if (hash.startsWith('#/workflow') || hash === '#/design') return 'workflow'
  if (hash === '#/assets') return 'assets'
  if (hash === '#/skills') return 'skillCenter'
  if (hash === '#/settings') return 'settings'
  return 'materials'
}

function refreshCurrentLocationHash() {
  if (typeof window === 'undefined') return
  currentLocationHash.value = window.location.hash || ''
}

const activeView = ref(initialActiveViewFromHash())
const factoryHomeTab = ref('image-code')
const materialsTab = ref('requirements')
const selectedReactFile = ref(state.reactFiles[0]?.path || '')
const selectedAssetId = ref(state.assets[0]?.id || '')
const materialFileInput = ref(null)
const showRestoredSource = ref(false)
const restoredPreview = reactive({
  mode: 'compare',
  device: 'desktop',
  zoom: 0.42
})
const standalonePreviewHtml = ref(buildStaticHtmlLoadingPage('还原资产详情', '正在读取已生成的 HTML 结果...', {
  taskId: state.selectedRestoredPageId || '',
  stepIndex: 2
}))
const standalonePreviewKey = ref(0)
const restoredPreviewModes = [
  { value: 'html', label: 'HTML 结果' },
  { value: 'compare', label: '对照' }
]
const restoredPreviewDevices = [
  { value: 'desktop', label: '1440' },
  { value: 'tablet', label: '1024' },
  { value: 'mobile', label: '390' }
]

const captureForm = reactive({
  url: 'https://www.gaoding.art/creation',
  scope: 'single',
  authMode: 'public',
  sessionId: '',
  cookieText: ''
})
const modelSettingsForm = reactive({
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-5.5',
  apiSurface: 'responses',
  apiKey: '',
  timeoutMs: 20000,
  fallback: 'deterministic',
  enabled: false
})
const modelSettingsStatus = reactive({
  hasApiKey: false,
  apiKeyMasked: ''
})
const modelSettingsTestResult = ref(null)
const modelSettingsSampleResult = ref(null)
const skillOrchestrationForm = reactive({
  enabled: true,
  skillId: 'auth-page-generation',
  promptTemplate: '你是资深产品和前后端架构助手。根据用户输入生成登录注册页面方案，必须包含功能说明、接口契约、前后端分工、HTML 预览和质量检查。',
  outputSchema: 'auth-page',
  fallbackSkillId: 'interaction-design-workflow',
  qualityChecksText: 'frontend-backend-handoff\napi-contract\nhtml-preview\nerror-states'
})
const imageCodeForm = reactive({
  fileName: '',
  prompt: '',
  imageDataUrl: '',
  target: 'html'
})
const showImageTargetMenu = ref(false)
const showCaptureMethodMenu = ref(false)
const imageCodeTargetOptions = [
  { value: 'html', label: '静态 HTML' },
  { value: 'vue', label: 'Vue 代码' }
]
const selectedCaptureRecoveryFlowId = ref('snapshot-package')
const showCaptureAuthModal = ref(false)
const captureAuthModalMode = ref('snapshot-package')
const showCaptureFlowInfoModal = ref(false)
const captureFlowInfoId = ref('snapshot-package')
const showSnapshotAssetsModal = ref(false)
const showFactoryTaskCenter = ref(false)
const normalizedCaptureAuthMode = computed(() => normalizeSnapshotAuthMode(captureForm.authMode))
const selectedSnapshotAuthMode = computed(() => snapshotAuthModeMeta(captureForm.authMode))
const captureAuthModalTitle = computed(() => {
  const labels = {
    'remote-browser': '远程浏览器授权',
    'cookie-session': 'Cookie / 登录态',
    'snapshot-package': '上传网页快照包'
  }
  return labels[captureAuthModalMode.value] || '采集方式设置'
})

function applyProjectSelection(patch = {}) {
  const reconciled = reconcileProjectSelection({
    ...state,
    selectedAssetId: selectedAssetId.value
  }, patch)
  state.currentProjectId = reconciled.currentProjectId
  state.selectedRestoredPageId = reconciled.selectedRestoredPageId
  state.activeWorkflowRun = reconciled.activeWorkflowRun
  selectedAssetId.value = reconciled.selectedAssetId
}
const generationForm = reactive({ target: 'vue-vite', fidelity: 'one-to-one', notes: '' })
const styleForm = reactive({ stylePreset: 'clean', notes: '' })
const competitorForm = reactive({ name: '', url: '', notes: '' })
const projectForm = reactive({
  name: '',
  description: '',
  domain: '',
  targetUsers: ''
})
const showProjectForm = ref(false)
const showProjectPicker = ref(false)
const accountDockOpen = ref(false)
const switchingProjectId = ref('')
const projectSwitchOverlayMessage = ref('')
const workflowReferenceProjectId = ref('')
const selectedProjectDetailId = ref('')
const pmForm = reactive({ skill: 'PRD 生成', answer: '' })
const uxForm = reactive({ skill: '信息架构设计', answer: '' })
const workbenchForm = reactive({
  input: '',
  selectedSkillId: 'default-general-design-skill',
  mode: 'diagnose'
})
const skillEditor = reactive({
  activeId: '',
  mode: 'form',
  draft: null,
  markdown: ''
})
const workflowForm = reactive({
  selectedWorkflowId: 'auto',
  demandScope: 'project',
  input: '',
  documents: []
})
const workflowBlueprintTab = ref('profile')
const blueprintWorkbenchViewMode = ref('frame')
const selectedBlueprintWorkbenchNodeId = ref('')
const expandedBlueprintNodeIds = reactive({})
const activeDemoScreenId = ref('')
const skillImportForm = reactive({ url: '', raw: '' })
const websiteImportForm = reactive({
  url: '',
  importType: 'project-website',
  scope: 'single'
})
const knowledgeRetrievalForm = reactive({
  query: '',
  roleScope: 'all'
})
const knowledgeRetrievalResults = ref([])
const knowledgeParseJobs = ref([])
const knowledgeHubSection = ref('structure')
const knowledgeCanvasZoom = ref(0.86)
const showKnowledgeNodeDetailModal = ref(false)
const selectedKnowledgeNodeId = ref('')
const selectedKnowledgePrototypeScreenId = ref('')
const knowledgeExpandedNodeIds = reactive({})
const showKnowledgeDepositModal = ref(false)
const showRequirementConvertModal = ref(false)
const knowledgeDepositSource = ref(null)
const knowledgeDepositTypes = KNOWLEDGE_DEPOSIT_TYPES
const knowledgeDepositSourceTypes = {
  requirements: { sourceType: 'requirements', label: '需求文档' },
  competitors: { sourceType: 'competitors', label: '竞品监控' },
  knowledge: { sourceType: 'knowledge', label: '知识库' }
}
const knowledgeDepositForm = reactive({
  title: '',
  content: '',
  depositType: 'knowledge-card',
  blueprintNodeId: '',
  roleScopes: ['product', 'ux', 'development', 'ai-retrieval'],
  notes: ''
})
const requirementConvertSourceOptions = [
  { key: 'product', label: '产品需求', description: '用户上传或产品侧提供的原始需求。' },
  { key: 'fuzzy', label: '模糊需求', description: '从设计方案 Skill 转来的初步拆解。' },
  { key: 'design', label: '设计需求', description: '与产品确认后可进入设计/开发的需求。' }
]
const requirementConvertForm = reactive({
  source: 'design',
  title: '',
  notes: ''
})
const knowledgeRoleTabs = [
  { key: 'all', label: '全部知识', description: '完整项目资料' },
  { key: 'product', label: '产品视图', description: '定位、需求、竞品、指标' },
  { key: 'ux', label: 'UX 视图', description: '流程、页面、文案、结构' },
  { key: 'development', label: '开发视图', description: '接口、规则、组件、验收' },
  { key: 'ai-retrieval', label: 'AI 检索', description: '分段、证据、召回上下文' }
]
const selectedKnowledgeRole = ref('all')
const selectedMaterialIds = reactive({
  knowledge: [],
  requirements: [],
  competitors: []
})
const requirementSourceTabs = [
  { key: 'all', label: '全部' },
  { key: 'product', label: '产品需求' },
  { key: 'fuzzy', label: '模糊需求' },
  { key: 'design', label: '设计需求' }
]
const requirementSourceTab = ref('all')
const materialBatchMode = ref(false)
watch(materialsTab, (tab, previousTab) => {
  materialBatchMode.value = false
  if (previousTab && selectedMaterialIds[previousTab]) selectedMaterialIds[previousTab].splice(0)
})
const knowledgeSearch = ref('')
const pmResult = ref('等待选择 skill 并生成产品需求。')
const uxResult = ref('等待选择 skill 并生成交互方案。')
const skillWorkbenchResult = ref('等待输入需求并执行 Skill。')
const workflowStepDraft = reactive({})
const workflowStepOutput = ref('')
const workflowStepChallenge = ref('')
const workflowFileInput = ref(null)
const workflowAgentOpen = ref(false)
const workflowAgentInput = ref('')
const workflowAgentHistoryOpen = ref(false)
const workflowAgentUploadOpen = ref(false)
const workflowAgentDrawerWidth = ref(680)
const workflowAgentSending = ref(false)
const workflowAgentRequestToken = ref('')
const workflowAgentPendingMessageId = ref('')
const workflowAgentPendingScopeId = ref('')
const workflowAgentStreamController = ref(null)
const workflowAgentDrawerRef = ref(null)
const workflowAgentActiveDraft = ref('')
const workflowAgentActiveDraftMeta = ref({})
const workflowAgentEditingMessageId = ref('')
const workflowAgentRetryMessageId = ref('')
const workflowAgentRetryTargetMessageId = ref('')
const workflowAgentConfirmPreview = reactive({
  open: false,
  messageId: '',
  proposalId: '',
  content: '',
  summary: '',
  refreshScopeLabel: '',
  nodeId: '',
  nodeTitle: '',
  actionIntent: '',
  writeableItems: [],
  acceptanceCriteria: [],
  rationale: [],
  contextSources: [],
  downstream: []
})
const workflowAgentConfirmPreviewDownstream = computed(() => {
  if (!Array.isArray(workflowAgentConfirmPreview.downstream)) return []
  return workflowAgentConfirmPreview.downstream.filter((node) => node && typeof node === 'object' && !Array.isArray(node))
})
const workflowAnalysisResult = ref(null)
const workflowCanvasLoading = ref(false)
const workflowCanvasRefreshingNodeId = ref('')
const workflowRoute = ref('entry')
let workflowAnalysisDeepLinkTimer = null
let workflowAnalysisProgressSaveTimer = null
const WORKFLOW_ANALYSIS_POLL_MAX_ATTEMPTS = 45
const WORKFLOW_ANALYSIS_POLL_MAX_FAILED_LOADS = 3
const workflowAgentStaleProposalErrorCodes = ['AGENT_PROPOSAL_NOT_FOUND', 'AGENT_PROPOSAL_NOT_PENDING', 'AGENT_PROPOSAL_STALE']
const workflowCanvasZoom = ref(0.82)
const workflowFullscreenNodeId = ref('')
const workflowFullscreenEditNodeId = ref('')
const workflowAgentNodeId = ref('')
const blueprintDemoHtml = ref('')
const blueprintDemoRevision = ref(1)
const blueprintDemoForm = reactive({
  referenceUrl: 'https://www.gaoding.art/creation',
  styleVariant: 'studio',
  interactionMode: 'wizard'
})
const showGeneratedPageFullPreview = ref(false)
const showBlueprintDemoFullPreview = ref(false)
const materialEditor = reactive({
  mode: 'create',
  type: 'knowledge',
  id: '',
  title: '',
  meta: '',
  status: '',
  notes: '',
  content: '',
  rawItem: null
})
const showMaterialEditor = ref(false)
const showMaterialToolModal = ref(false)
const materialToolModalMode = ref('website-import')
const materialToolTitle = computed(() => {
  const labels = {
    'website-import': '网站导入',
    'retrieval-test': '召回测试',
    'parse-jobs': '解析任务'
  }
  return labels[materialToolModalMode.value] || '资料库工具'
})

const captureStatus = refStatus()
const imageCodeStatus = refStatus()
const browserSessionStatus = refStatus()
const browserPreviewStatus = refStatus()
const browserPreview = reactive({
  screenshot: '',
  url: '',
  title: '',
  inputText: '',
  autoRefresh: true
})
const captureLoadingSeconds = ref(0)
const captureTiming = reactive({ estimatedSeconds: 75, durationMs: 0 })
let captureLoadingTimer = null
let browserPreviewTimer = null
const pageGenerationStatus = refStatus()
const generationStatus = refStatus()
const styleStatus = refStatus()
const knowledgeStatus = refStatus()
const workflowKnowledgeStatus = reactive({ status: '', message: '', count: 0 })
const suppressNextKnowledgeOpen = ref(false)
const requirementStatus = refStatus()
const competitorStatus = refStatus()
const pmStatus = refStatus()
const uxStatus = refStatus()
const skillWorkbenchStatus = refStatus()
const settingsStatus = refStatus()
const modelCallLogs = ref([])
const modelCallLogFilters = reactive({
  status: '',
  skillId: '',
  projectId: '',
  demandScope: ''
})

watch(() => captureStatus.value.status, (status) => {
  if (status === 'loading') {
    startCaptureLoadingTimer()
  } else {
    stopCaptureLoadingTimer()
  }
})

watch(() => browserPreview.autoRefresh, (enabled) => {
  if (enabled) startBrowserPreviewPolling()
  else stopBrowserPreviewPolling()
})

watch([activeView, normalizedCaptureAuthMode], ([view, authMode]) => {
  if (view !== 'factory' || authMode !== 'browser') {
    stopBrowserPreviewPolling()
  } else if (captureForm.sessionId && browserPreview.autoRefresh) {
    startBrowserPreviewPolling()
  }
})

const navItems = getSidebarNavItems()
const isFactoryView = computed(() =>
  activeView.value === 'factory' ||
  (typeof window !== 'undefined' && isFactoryHash(currentLocationHash.value))
)
const isSidebarHidden = computed(() => {
  const routeHash = currentLocationHash.value
  const projectRoute = parseProjectScopedHash(routeHash)
  const isStandalonePreviewRoute = Boolean(projectRoute?.route?.match(/^\/assets\/[^/?#]+\/preview/))
  if (projectRoute?.route === '/design') return false
  return isFactoryView.value &&
    (state.currentFactoryRoute === 'capture-detail' ||
    state.currentFactoryRoute === 'standalone-preview' ||
    routeHash === '#/factory/capture' ||
    isStandalonePreviewRoute ||
    projectRoute?.route === '/factory/capture')
})
const isEdgeToEdgeView = computed(() => activeView.value === 'workflow' || isFactoryView.value)

const factoryHomeTabs = [
  { key: 'image-code', label: '图片转代码' },
  { key: 'url-code', label: 'URL转代码' },
  { key: 'style-transfer', label: '风格转换' }
]
const workflowScopeTabs = [
  { key: 'project', label: '项目需求' },
  { key: 'non-project', label: '非项目需求' }
]
const isWorkflowAnalysisFocus = computed(() => activeView.value === 'workflow' && workflowRoute.value === 'canvas')
const factoryHeroContent = {
  'image-code': {
    titleBefore: '今天你想要',
    highlight: '还原',
    titleAfter: '哪张设计图？',
    subtitle: '上传设计稿、截图或参考图，平台会识别页面布局、视觉层级和组件结构，再生成可预览的静态页面代码。'
  },
  'url-code': {
    titleBefore: '今天你想要',
    highlight: '解析',
    titleAfter: '哪个网页？',
    subtitle: '输入目标网址，平台会在后台采集网页快照，再用于高保真 HTML、代码和设计稿生成。'
  },
  'style-transfer': {
    titleBefore: '今天你想要',
    highlight: '转换',
    titleAfter: '成什么风格？',
    subtitle: '描述目标风格，平台会基于当前还原资产调整视觉语言、组件质感和页面氛围。'
  }
}
const captureRecoveryFlows = [
  {
    id: 'remote-browser',
    label: '使用远程浏览器登录后再采集',
    badge: '推荐方案',
    scenario: '适合登录态、风控页、需要人工完成验证码或授权的网页。',
    frontendOwner: '前端负责打开授权浏览器、展示预览画面、传递 sessionId。',
    backendOwner: '后端负责创建隔离浏览器会话、注入登录态、后端接管采集编排。',
    handoff: '交接数据：projectId、url、sessionId，返回 captureResult、qualityGate、restoredPage。',
    action: '打开授权浏览器'
  },
  {
    id: 'cookie-session',
    label: '提供 Cookie / 登录态',
    badge: '低成本接入',
    scenario: '适合高级用户已有 Cookie、storageState 或企业内部登录态。',
    frontendOwner: '前端负责收集 Cookie 或登录态输入，并提示敏感信息使用范围。',
    backendOwner: '后端负责校验登录态、加密存储临时凭据，并带登录态执行采集。',
    handoff: '交接数据：projectId、url、cookieText，失败时返回 COOKIE_EXPIRED 或 DOMAIN_MISMATCH。',
    action: '粘贴登录态'
  },
  {
    id: 'snapshot-package',
    label: '上传网页快照包',
    badge: '离线兜底',
    scenario: '适合平台无法访问、内网站点、插件已导出的完整网页包。',
    frontendOwner: '前端负责上传 websnap 包、展示解析进度和导入结果。',
    backendOwner: '后端负责解析快照结构、抽取页面资产，并沉淀到项目资产库。',
    handoff: '交接数据：zip 文件，返回标准 captureResult、截图、资源清单和还原资产。',
    action: '上传快照包'
  },
  {
    id: 'image-to-code',
    label: '上传截图走“图片转代码”',
    badge: '视觉兜底',
    scenario: '适合只有截图或设计图，没有真实 DOM 和网页资源的场景。',
    frontendOwner: '前端负责切换到图片转代码入口，提交截图和补充描述。',
    backendOwner: '后端负责调用视觉模型识别布局、组件和样式，生成可交付代码。',
    handoff: '交接数据：图片、prompt、输出格式，返回静态 HTML、Vue 文件和视觉验证报告。',
    action: '上传截图'
  }
]
const captureMethodOptions = [
  { id: 'remote-browser', shortLabel: '授权浏览器' },
  { id: 'snapshot-package', shortLabel: '网页快照包' }
]
const snapshotAuthModes = SNAPSHOT_AUTH_MODES

const materialsTabs = [
  { key: 'knowledge', label: '知识库' },
  { key: 'requirements', label: '需求文档' },
  { key: 'competitors', label: '竞品监控' }
]

const pmSkills = ['PRD 生成', 'MVP 拆解', '竞品分析', '用户故事', '功能优化', '业务流程梳理', 'B 端后台规划', 'C 端功能规划']
const uxSkills = ['信息架构设计', '后台管理系统设计', '表单流程设计', '数据看板设计', 'SaaS 工作台设计', '移动端交互设计', '复杂流程简化', '高保真界面生成']

const apiFields = [
  { key: 'apiBaseUrl', label: '主 API 服务', placeholder: 'https://api.example.com' },
  { key: 'aiBaseUrl', label: 'AI 生成服务', placeholder: 'https://ai.example.com' },
  { key: 'captureBaseUrl', label: '网页快照服务', placeholder: 'https://snapshot.example.com' },
  { key: 'knowledgeBaseUrl', label: '知识库服务', placeholder: 'https://knowledge.example.com' },
  { key: 'searchBaseUrl', label: '联网搜索服务', placeholder: 'https://search.example.com' },
  { key: 'competitorBaseUrl', label: '竞品监控服务', placeholder: 'https://competitor.example.com' }
]

const currentTitle = computed(() => navItems.find((item) => item.key === activeView.value)?.label || '流程通')
const factoryHeroCopy = computed(() => factoryHeroContent[factoryHomeTab.value] || factoryHeroContent['image-code'])
const imageCodeTargetLabel = computed(() =>
  imageCodeTargetOptions.find((option) => option.value === imageCodeForm.target)?.label || imageCodeTargetOptions[0].label
)
const captureMethodLabel = computed(() =>
  captureMethodOptions.find((option) => option.id === selectedCaptureRecoveryFlowId.value)?.shortLabel || '采集方式'
)
const selectedCaptureRecoveryFlow = computed(() =>
  captureRecoveryFlows.find((flow) => flow.id === selectedCaptureRecoveryFlowId.value) || captureRecoveryFlows[0]
)
const selectedCaptureFlowInfo = computed(() =>
  captureRecoveryFlows.find((flow) => flow.id === captureFlowInfoId.value) || selectedCaptureRecoveryFlow.value
)
const configuredCount = computed(() => Object.values(state.apiConfig).filter(isConfigured).length)
const captureSummary = computed(() => {
  const result = state.captureResult
  return {
    pages: result?.pages?.length || 0,
    components: result?.components?.length || 0,
    assets: result?.assets?.length || 0,
    apis: result?.apiCalls?.length || 0,
    layoutNodes: result?.layoutNodes?.length || 0
  }
})
const captureReadiness = computed(() => captureRestoreReadiness(state.captureResult || {}))
const captureResultPanelStatus = computed(() => {
  if (captureStatus.value.status === 'loading') return 'loading'
  if (captureStatus.value.status === 'blocked') return 'blocked'
  if (captureStatus.value.status === 'failed' && !state.captureResult) return 'failed'
  if (!state.captureResult) return 'idle'
  if (state.captureResult?.status === 'blocked') return 'blocked'
  return captureReadiness.value.canRestore ? 'success' : 'unconfigured'
})
const captureRelayDiagnostics = computed(() => state.captureResult?.diagnostics || [])
const captureRelayActions = computed(() => state.captureResult?.recoveryActions || [])
const captureRelayTemplateId = computed(() => state.captureResult?.templateId || '')
const captureJson = computed(() => JSON.stringify(state.captureResult || {
  status: 'pending',
  message: '暂无快照结果。配置网页快照服务后会展示真实返回数据。',
  designSource: designRules.source,
  expectedShape: ['pages', 'components', 'assets', 'apiCalls', 'designTokens']
}, null, 2))
const componentLibraryJson = computed(() => JSON.stringify({
  designSource: designRules.source,
  rules: designRules,
  componentLibrary: state.componentLibrary
}, null, 2))
const selectedReactContent = computed(() => state.reactFiles.find((file) => file.path === selectedReactFile.value)?.content || '')
const hasGeneratedCode = computed(() => Boolean(state.captureResult && state.reactFiles?.length && selectedReactContent.value))
const currentSnapshotAssets = computed(() =>
  scopeItems(state.assets, state.currentProjectId).filter((asset) => asset.type === 'web-snapshot')
)
const currentRestoredPages = computed(() => restoredPagesForProject(state.restoredPages, state.currentProjectId))
const selectedRestoredPage = computed(() =>
  currentRestoredPages.value.find((page) => page.id === state.selectedRestoredPageId) || null
)
const currentCaptureRestoredPage = computed(() => {
  const url = state.captureResult?.url || state.captureResult?.pages?.[0]?.url || ''
  if (!url) return null
  return currentRestoredPages.value.find((page) => page.sourceUrl === url) || null
})
const selectedRestoredFiles = computed(() =>
  selectedRestoredPage.value
    ? [
        ...(selectedRestoredPage.value.html ? [{ path: 'index.html', content: selectedRestoredPage.value.html }] : []),
        ...(selectedRestoredPage.value.files || []).filter((file) => !(file.path === 'index.html' && selectedRestoredPage.value.html))
      ]
    : state.generatedPageHtml
      ? [{ path: 'index.html', content: state.generatedPageHtml }]
      : state.reactFiles
)
const selectedRestoredPageHasVue = computed(() =>
  selectedRestoredFiles.value.some((file) => /^src\/App\.vue$/.test(file.path || ''))
)
const selectedRestoredFileContent = computed(() =>
  selectedRestoredFiles.value.find((file) => file.path === selectedReactFile.value)?.content
  || selectedRestoredFiles.value[0]?.content
  || ''
)
const selectedRestoredPreviewSource = computed(() => ({
  ...(selectedRestoredPage.value || {
    title: '还原页面详情',
    sourceUrl: '',
    coverImage: ''
  }),
  html: selectedRestoredPage.value?.html || state.generatedPageHtml,
  files: selectedRestoredFiles.value
}))
const selectedRestoredPreviewHtml = computed(() =>
  restoredPagePreviewHtml(selectedRestoredPreviewSource.value, {
    ...restoredPreview,
    loading: pageGenerationStatus.value.status === 'loading' && !(
      selectedRestoredFiles.value.find((file) => file.path === 'index.html')?.content
      || selectedRestoredPage.value?.html
      || state.generatedPageHtml
    ),
    loadingView: captureLoadingView.value
  })
)
const selectedRestoredStaticHtml = computed(() => {
  const htmlFile = selectedRestoredFiles.value.find((file) => file.path === 'index.html')?.content
  return selectedRestoredPage.value?.html || htmlFile || state.generatedPageHtml || selectedRestoredPreviewHtml.value
})
const selectedRestoredPreviewSummary = computed(() =>
  restoredPagePreviewSummary(selectedRestoredPreviewSource.value)
)
const selectedVisualVerification = computed(() => selectedRestoredPage.value?.visualVerification || null)
const factoryTaskTypeLabels = {
  capture: '采集网页',
  generate: '生成高保真 HTML',
  regenerate: '重新生成 HTML',
  vue: '转 Vue 代码',
  'html-generation': '生成高保真 HTML',
  'vue-conversion': '转 Vue 代码',
  'image-to-code': '图片转代码'
}
const factoryTaskStatusLabels = {
  queued: '排队中',
  running: '执行中',
  success: '已完成',
  failed: '失败',
  blocked: '已阻断'
}
const factoryTaskRecords = computed(() =>
  scopeItems(state.factoryTasks || [], state.currentProjectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .map((task) => ({
      ...task,
      typeLabel: factoryTaskTypeLabels[task.type] || '网页工厂任务',
      statusLabel: factoryTaskStatusLabels[task.status] || task.status || '未知',
      durationLabel: factoryTaskDurationLabel(task),
      estimatedLabel: task.estimatedSeconds ? `约 ${task.estimatedSeconds}s` : '按后端返回'
    }))
)
const restoredPreviewFitZoom = computed(() => {
  if (restoredPreview.mode === 'compare') return 0.42
  if (restoredPreview.mode === 'html') return 0.72
  if (restoredPreview.device === 'mobile') return 1
  if (restoredPreview.device === 'tablet') return 0.84
  return 0.72
})
const captureAction = computed(() => captureActionState(captureStatus.value.status))
const captureLoadingView = computed(() => captureLoadingExperience(captureLoadingSeconds.value, captureTiming))
const captureDetailHref = computed(() => {
  if (typeof window === 'undefined') return `#${projectScopedRoute('/factory/capture')}`
  return `${window.location.href.split('#')[0]}#${projectScopedRoute('/factory/capture')}`
})

function snapshotCapturePayload() {
  return buildSnapshotCaptureRequest({
    projectId: state.currentProjectId,
    ...captureForm
  })
}

function persistPendingCaptureTask() {
  if (typeof localStorage === 'undefined') return
  const payload = {
    id: `capture-${Date.now()}`,
    createdAt: new Date().toISOString(),
    projectId: state.currentProjectId,
    form: {
      url: captureForm.url,
      scope: captureForm.scope,
      authMode: captureForm.authMode,
      sessionId: captureForm.sessionId,
      cookieText: captureForm.cookieText
    }
  }
  localStorage.setItem(PENDING_CAPTURE_TASK_KEY, JSON.stringify(payload))
}

function consumePendingCaptureTask() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(PENDING_CAPTURE_TASK_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_CAPTURE_TASK_KEY)
    return JSON.parse(raw)
  } catch (error) {
    localStorage.removeItem(PENDING_CAPTURE_TASK_KEY)
    return null
  }
}

function applyPendingCaptureTask(task) {
  if (!task?.form) return false
  if (task.projectId) state.currentProjectId = task.projectId
  Object.assign(captureForm, {
    url: task.form.url || captureForm.url,
    scope: task.form.scope || captureForm.scope,
    authMode: task.form.authMode || captureForm.authMode,
    sessionId: task.form.sessionId || '',
    cookieText: task.form.cookieText || ''
  })
  if (task.form.authMode === 'browser') selectedCaptureRecoveryFlowId.value = 'remote-browser'
  else if (task.form.authMode === 'cookie') selectedCaptureRecoveryFlowId.value = 'cookie-session'
  else selectedCaptureRecoveryFlowId.value = 'snapshot-package'
  return true
}

function resumePendingCaptureTask() {
  const task = consumePendingCaptureTask()
  if (!applyPendingCaptureTask(task)) return false
  void runCaptureTask()
  return true
}

function openFactoryHome(tab = factoryHomeTab.value || 'image-code') {
  state.currentFactoryRoute = 'home'
  state.selectedRestoredPageId = ''
  factoryHomeTab.value = tab
  if (typeof window !== 'undefined' && isFactoryHash(window.location.hash)) {
    const baseUrl = appRouteUrl(APP_PAGE_ROUTES.factory)
    window.history.replaceState({}, '', baseUrl)
  }
}

function openCaptureDetail() {
  state.currentFactoryRoute = 'capture-detail'
  state.selectedRestoredPageId = ''
}

function selectCaptureRecoveryFlow(flowId) {
  selectedCaptureRecoveryFlowId.value = flowId
  if (flowId !== 'image-to-code') openCaptureAuthModal(flowId)
}

function selectCaptureMethod(flowId) {
  selectedCaptureRecoveryFlowId.value = flowId
  showCaptureMethodMenu.value = false
  if (flowId === 'remote-browser') {
    captureForm.authMode = 'browser'
    selectedCaptureRecoveryFlowId.value = 'remote-browser'
    return
  }
  if (flowId === 'snapshot-package') {
    captureForm.authMode = 'public'
    selectedCaptureRecoveryFlowId.value = 'snapshot-package'
  }
}

function openCaptureAuthModal(flowId = selectedCaptureRecoveryFlowId.value) {
  selectedCaptureRecoveryFlowId.value = flowId
  captureAuthModalMode.value = flowId
  showCaptureAuthModal.value = true
}

function closeCaptureAuthModal() {
  showCaptureAuthModal.value = false
}

function openCaptureFlowInfo(flowId = selectedCaptureRecoveryFlowId.value) {
  captureFlowInfoId.value = flowId
  showCaptureFlowInfoModal.value = true
}

function closeCaptureFlowInfo() {
  showCaptureFlowInfoModal.value = false
}

function confirmCaptureAuthModal() {
  if (captureAuthModalMode.value === 'remote-browser') {
    captureForm.authMode = 'browser'
  } else if (captureAuthModalMode.value === 'cookie-session') {
    captureForm.authMode = 'cookie'
  } else if (captureAuthModalMode.value === 'snapshot-package') {
    captureForm.authMode = 'public'
  }
  closeCaptureAuthModal()
}

function goRecoveryFlow(flowId) {
  activeView.value = 'factory'
  state.currentFactoryRoute = 'home'
  selectedCaptureRecoveryFlowId.value = flowId
  syncRouteToView('factory')
  if (flowId === 'remote-browser') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'browser'
    openCaptureAuthModal(flowId)
    return
  }
  if (flowId === 'cookie-session') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'cookie'
    openCaptureAuthModal(flowId)
    return
  }
  if (flowId === 'snapshot-package') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'public'
    openCaptureAuthModal(flowId)
    return
  }
  if (flowId === 'image-to-code') {
    factoryHomeTab.value = 'image-code'
  }
}

function appRouteUrl(route = '') {
  return projectScopedUrl(route)
}

function restoredPageDetailHref(pageId) {
  return projectScopedUrl(`/assets/${encodeURIComponent(pageId)}/preview`)
}

function routeProjectId(projectId = state.currentProjectId) {
  return encodeURIComponent(projectId || 'project-flow')
}

function projectScopedRoute(route = '', projectId = state.currentProjectId) {
  const source = String(route || '')
  const normalized = source.startsWith('/') ? source : `/${source}`
  if (normalized.startsWith('/projects/')) return normalized.replace(':projectId', routeProjectId(projectId))
  return `/projects/${routeProjectId(projectId)}${normalized}`
}

function projectScopedUrl(route = '', projectId = state.currentProjectId) {
  return `${window.location.pathname}${window.location.search}#${projectScopedRoute(route, projectId)}`
}

function removeProjectRouteQueryParam(name = '') {
  if (typeof window === 'undefined' || !name) return
  const projectRoute = parseProjectScopedHash(window.location.hash)
  if (!projectRoute?.route?.includes('?')) return
  const [pathname, query = ''] = projectRoute.route.split('?')
  const params = new URLSearchParams(query)
  if (!params.has(name)) return
  params.delete(name)
  const nextRoute = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
  window.history.replaceState(null, '', projectScopedUrl(nextRoute, projectRoute.projectId))
  refreshCurrentLocationHash()
}

function currentProjectRouteForView() {
  const projectRoute = typeof window === 'undefined' ? null : parseProjectScopedHash(window.location.hash)
  if (projectRoute?.route && projectRoute.route !== '/') return projectRoute.route
  return APP_PAGE_ROUTES[activeView.value] || APP_PAGE_ROUTES.requirements
}

function replaceCurrentProjectRouteProjectId(projectId) {
  if (typeof window === 'undefined' || !projectId) return
  window.history.replaceState(null, '', projectScopedUrl(currentProjectRouteForView(), projectId))
  refreshCurrentLocationHash()
}

function parseProjectScopedHash(hash = window.location.hash || '') {
  const match = String(hash || '').match(/^#\/projects\/([^/?#]+)(\/[^#]*)?/)
  if (!match) return null
  return {
    projectId: decodeURIComponent(match[1]),
    route: match[2] || '/'
  }
}

function applyProjectIdFromRoute(projectId = '') {
  if (!projectId || state.currentProjectId === projectId) return
  state.currentProjectId = projectId
}

function isFactoryHash(hash = window.location.hash || '') {
  if (String(hash || '').startsWith('#/factory')) return true
  const projectRoute = parseProjectScopedHash(hash)
  return Boolean(projectRoute?.route?.startsWith('/factory') || projectRoute?.route?.startsWith('/assets/'))
}

function apiResourceUrl(path = '') {
  const source = String(path || '')
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source
  const baseUrl = String(state.apiConfig.apiBaseUrl || '').replace(/\/$/, '')
  if (!baseUrl) return source
  return `${baseUrl}/${source.replace(/^\//, '')}`
}

function restoredPagePreviewFrameSrc(page = {}) {
  const framePath = page.frameUrl || (page.id ? `/api/workspace/restored-pages/${encodeURIComponent(page.id)}/frame` : '')
  return apiResourceUrl(framePath)
}

function syncRouteToView(key, mode = 'push') {
  if (typeof window === 'undefined') return
  const route = APP_PAGE_ROUTES[key]
  if (!route || window.location.hash === `#${projectScopedRoute(route)}`) return
  if (mode === 'replace') {
    window.history.replaceState(null, '', projectScopedUrl(route))
  } else {
    window.history.pushState(null, '', projectScopedUrl(route))
  }
  refreshCurrentLocationHash()
}

function applyRouteState(key, options = {}) {
  if (key !== 'workflow' && isWorkflowAnalysisRouteActive()) {
    ensureWorkflowDeepLinkRouteState()
    return
  }
  if (key === 'requirements') {
    materialsTab.value = 'requirements'
    activeView.value = 'materials'
  } else if (key === 'materials') {
    materialsTab.value = 'knowledge'
    activeView.value = 'materials'
  } else if (key === 'competitors') {
    materialsTab.value = 'competitors'
    activeView.value = 'materials'
  } else {
    activeView.value = key
    if (key === 'workflow') {
      workflowRoute.value = 'entry'
      workflowAgentOpen.value = false
      workflowFullscreenNodeId.value = ''
      stopWorkflowAnalysisDeepLinkPolling()
    }
    if (key === 'factory') {
      openFactoryHome(options.factoryTab || 'image-code')
    }
  }
}

function switchView(key) {
  applyRouteState(key)
  syncRouteToView(key)
}

function openSnapshotAsset(assetId) {
  if (!assetId) return
  selectedAssetId.value = assetId
  showSnapshotAssetsModal.value = false
  applyRouteState('assets')
  syncRouteToView('assets')
}

function openSkillCenterForCreation() {
  applyRouteState('skillCenter')
  syncRouteToView('skillCenter')
  startCreateSkill()
}

function restoreAppRouteFromUrl() {
  refreshCurrentLocationHash()
  const hash = window.location.hash || ''
  if (currentWorkflowAnalysisDeepLinkRunId(hash)) {
    ensureWorkflowDeepLinkRouteState()
    return restoreWorkflowAnalysisFromUrl(parseProjectScopedHash(hash))
  }
  const projectRoute = parseProjectScopedHash(hash)
  if (projectRoute && restoreProjectScopedRoute(projectRoute)) return true
  if (hash === '#/workflow') {
    applyRouteState('workflow')
    return true
  }
  if (restoreFactoryRouteFromUrl() || restoreWorkflowRouteFromUrl()) return true
  switch (hash) {
    case '#/requirements':
      applyRouteState('requirements')
      return true
    case '#/knowledge':
      applyRouteState('materials')
      return true
    case '#/design':
      applyRouteState('workflow')
      return true
    case '#/factory':
      applyRouteState('factory')
      return true
    case '#/assets':
      applyRouteState('assets')
      return true
    case '#/skills':
      applyRouteState('skillCenter')
      return true
    case '#/competitors':
      applyRouteState('competitors')
      return true
    case '#/settings':
      applyRouteState('settings')
      return true
    case '':
    case '#/':
      applyRouteState('requirements')
      syncRouteToView('requirements', 'replace')
      return true
    default:
      return false
  }
}

function restoreProjectScopedRoute(projectRoute) {
  applyProjectIdFromRoute(projectRoute.projectId)
  const route = projectRoute.route || '/'
  if (route.startsWith('/workflow')) return restoreWorkflowRouteFromUrl(projectRoute)
  if (route === '/requirements') {
    applyRouteState('requirements')
    return true
  }
  if (route === '/knowledge') {
    applyRouteState('materials')
    return true
  }
  if (route === '/design') {
    applyRouteState('workflow')
    return true
  }
  if (route === '/factory') {
    applyRouteState('factory')
    return true
  }
  if (route === '/assets') {
    applyRouteState('assets')
    return true
  }
  if (route === '/skills') {
    applyRouteState('skillCenter')
    return true
  }
  if (route === '/competitors') {
    applyRouteState('competitors')
    return true
  }
  if (route === '/settings') {
    applyRouteState('settings')
    return true
  }
  return restoreFactoryRouteFromUrl(projectRoute) || restoreWorkflowRouteFromUrl(projectRoute)
}

function isNavItemActive(key) {
  if (key === 'factory') return isFactoryView.value
  if (key === 'requirements') return activeView.value === 'materials' && materialsTab.value === 'requirements'
  if (key === 'materials') return activeView.value === 'materials' && materialsTab.value === 'knowledge'
  if (key === 'competitors') return activeView.value === 'materials' && materialsTab.value === 'competitors'
  return activeView.value === key
}

function ensureIndexHtmlFile(files = [], html = '') {
  const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : []
  if (!html) return normalizedFiles
  const hasIndex = normalizedFiles.some((file) => file.path === 'index.html' && file.content)
  return hasIndex
    ? normalizedFiles.map((file) => file.path === 'index.html' ? { ...file, content: file.content || html } : file)
    : [{ path: 'index.html', content: html }, ...normalizedFiles]
}

function restoredPageTags(page = {}) {
  const tags = Array.isArray(page.tags) ? page.tags.filter(Boolean) : []
  if (!tags.includes('图片转代码')) tags.unshift('图片转代码')
  const format = String(page.codeFormat || '').toLowerCase()
  const hasVue = format === 'vue' || page.files?.some((file) => /^src\/App\.vue$/.test(file.path || ''))
  const hasHtml = Boolean(page.html || page.files?.some((file) => file.path === 'index.html' && file.content))
  if (hasHtml && !tags.includes('html')) tags.push('html')
  if (hasVue && !tags.includes('vue')) tags.push('vue')
  return [...new Set(tags)].slice(0, 4)
}

function formatRestoredPageTime(page = {}) {
  const rawTime = page.updatedAt || page.createdAt || page.captureResult?.raw?.capturedAt || ''
  if (!rawTime) return '生成时间未记录'
  const date = new Date(rawTime)
  if (Number.isNaN(date.getTime())) return String(rawTime)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeHtmlAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

async function openRestoredPageDetail(pageId, options = {}) {
  state.selectedRestoredPageId = pageId
  if (options.syncRoute !== false) state.currentFactoryRoute = 'restored-detail'
  const [detailResult, previewResult, sourceResult] = await Promise.all([
    api.workspace.getRestoredPage(state.apiConfig, pageId),
    api.workspace.previewRestoredPage(state.apiConfig, pageId),
    api.workspace.sourceRestoredPage(state.apiConfig, pageId)
  ])
  const backendPage = detailResult.ok && detailResult.data?.restoredPage ? detailResult.data.restoredPage : null
  const preview = previewResult.ok && previewResult.data ? previewResult.data : null
  const source = sourceResult.ok && sourceResult.data ? sourceResult.data : null
  if (backendPage || preview || source) {
    const currentPage = state.restoredPages.find((item) => item.id === pageId) || {}
    const files = source?.files?.length ? source.files : backendPage?.files || currentPage.files || []
    const html = preview?.html || backendPage?.html || currentPage.html || ''
    const nextPage = {
      ...currentPage,
      ...(backendPage || {}),
      projectId: backendPage?.projectId || currentPage.projectId || state.currentProjectId,
      html,
      files: ensureIndexHtmlFile(files, preview?.html || backendPage?.html || currentPage.html || '')
    }
    const normalizedDetail = normalizeFactoryWorkspace({ restoredPages: [nextPage] })
    const normalizedPage = normalizedDetail.restoredPages[0] || nextPage
    state.restoredPages = [
      normalizedPage,
      ...state.restoredPages.filter((item) => item.id !== pageId)
    ]
    if (normalizedPage.html && normalizedPage.html !== html) {
      void api.workspace.createRestoredPage(state.apiConfig, normalizedPage)
    }
    selectedReactFile.value = normalizedPage.html ? 'index.html' : files[0]?.path || selectedReactFile.value
  } else {
    const page = state.restoredPages.find((item) => item.id === pageId)
    selectedReactFile.value = page?.html ? 'index.html' : page?.files?.[0]?.path || selectedReactFile.value
  }
  showRestoredSource.value = false
  restoredPreview.mode = 'compare'
  restoredPreview.device = 'desktop'
  restoredPreview.zoom = restoredPreviewFitZoom.value
}

async function openRestoredPageStandalone(pageId) {
  if (!pageId) return
  persistRestoredPageSelection(pageId)
  const previewWindow = window.open(restoredPageDetailHref(pageId), '_blank')
  writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlLoadingPage('还原资产详情', '正在读取已生成的 HTML 结果...', {
    taskId: pageId,
    stepIndex: 2
  }))
  await openRestoredPageDetail(pageId, { syncRoute: false })
  const page = state.restoredPages.find((item) => item.id === pageId) || selectedRestoredPage.value || { id: pageId, title: '静态 HTML 还原结果', coverImage: '' }
  const resultHtml = buildRestoredPageResultShell(page, pageId)
  writeStaticHtmlPreviewWindow(previewWindow, resultHtml)
}

async function loadStandalonePreviewRoute(pageId) {
  if (!pageId) return
  const projectRoute = parseProjectScopedHash(window.location.hash)
  const shouldAutoConvert = new URLSearchParams(String(projectRoute?.route || '').split('?')[1] || '').get('action') === 'convert-vue'
  standalonePreviewHtml.value = buildStaticHtmlLoadingPage('还原资产详情', '正在读取已生成的 HTML 结果...', {
    taskId: pageId,
    stepIndex: 2
  })
  standalonePreviewKey.value += 1
  await openRestoredPageDetail(pageId, { syncRoute: false })
  const page = state.restoredPages.find((item) => item.id === pageId) || selectedRestoredPage.value || { id: pageId, title: '静态 HTML 还原结果', coverImage: '' }
  standalonePreviewHtml.value = buildRestoredPageResultShell(page, pageId)
  standalonePreviewKey.value += 1
  if (shouldAutoConvert) {
    removeProjectRouteQueryParam('action')
    state.currentFactoryRoute = 'restored-detail'
    await convertRestoredPageToVue()
  }
}

function buildRestoredPageResultShell(page = {}, pageId = '') {
  const html = page.html
    || page.files?.find((file) => file.path === 'index.html' && file.content)?.content
    || restoredPagePreviewHtml(page || { title: '还原资产详情' })
  return buildStaticHtmlResultShell(html, page.title, {
    thumbnail: page.coverImage,
    taskId: page.id || pageId,
    assetId: page.id || pageId,
    homeUrl: projectScopedRoute('/factory', page.projectId || state.currentProjectId),
    convertUrl: projectScopedUrl(`/assets/${encodeURIComponent(page.id || pageId)}/preview?action=convert-vue`, page.projectId || state.currentProjectId)
  })
}

function persistRestoredPageSelection(pageId) {
  if (pageId) state.selectedRestoredPageId = pageId
}

function openRestoredPageDetailInNewTab(pageId) {
  const url = restoredPageDetailHref(pageId)
  persistRestoredPageSelection(pageId)
  const win = window.open(url, '_blank')
  if (!win) {
    void openRestoredPageDetail(pageId)
  }
}

function writeStaticHtmlPreviewWindow(previewWindow, html) {
  if (!previewWindow || previewWindow.closed) return false
  previewWindow.document.open()
  previewWindow.document.write(html)
  previewWindow.document.close()
  return true
}

function closeStaticHtmlPreviewWindow(previewWindow) {
  if (!previewWindow || previewWindow.closed) return false
  previewWindow.close()
  return true
}

function previewTaskUrl(taskId = '') {
  const safeTaskId = encodeURIComponent(taskId || `image-html-${Date.now()}`)
  return projectScopedUrl(`/assets/${safeTaskId}/preview`)
}

function updateStaticHtmlPreviewUrl(previewWindow, taskId = '') {
  if (!previewWindow || previewWindow.closed || !taskId) return false
  try {
    previewWindow.history.replaceState(null, '', taskId.startsWith('/')
      ? `#${taskId}`
      : previewTaskUrl(taskId))
    return true
  } catch {
    return false
  }
}

function buildStaticHtmlLoadingPage(title = '页面生成中', message = '正在根据上传图片生成静态 HTML 页面。', options = {}) {
  return buildStaticHtmlStatusPage(title, message, { ...options, heading: options.heading || '页面生成中', tone: 'loading' })
}

function buildStaticHtmlStatusPage(title = '页面生成中', message = '正在根据上传图片生成静态 HTML 页面。', options = {}) {
  const heading = options.heading || title || '页面生成中'
  const tone = options.tone || 'loading'
  const taskId = options.taskId || ''
  const activeStep = Math.min(2, Math.max(0, Number(options.stepIndex || 0)))
  const steps = ['识别截图', '生成骨架', '补齐样式', '后端验收']
  const progress = Math.min(92, Math.max(12, Math.round(((activeStep + 1) / steps.length) * 76)))
  const scriptCloseTag = '</scr' + 'ipt>'
  const interactive = Boolean(options.interactive)
  const codeLines = [
    '<!doctype html>',
    '<main class="generated-page">',
    '  <section class="hero-card">',
    '    <h1>正在还原上传页面</h1>',
    '    <button>生成可检索 HTML</button>',
    '  </section>',
    '</main>',
    '<style> .generated-page { display: grid; } </style>'
  ]
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; background: #f6f7f9; color: #222529; display: grid; place-items: center; padding: 28px; }
    .generation-shell { width: min(${interactive ? '1180px' : '760px'}, calc(100vw - 56px)); display: grid; grid-template-columns: ${interactive ? 'minmax(0, 1.08fr) minmax(340px, .72fr)' : '1fr'}; gap: 18px; align-items: stretch; }
    .code-rain, .jump-game { min-height: 420px; border: 1px solid ${tone === 'failed' ? '#f0b6b6' : '#20252b'}; border-radius: 16px; padding: 0; overflow: hidden; background: #101318; color: #d8f7df; box-shadow: 0 28px 84px rgba(34,37,41,.18); }
    .code-rain header { min-height: 64px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,.08); color: #9fb0b0; font-size: 12px; }
    .code-title { display: grid; gap: 4px; min-width: 0; }
    .code-title strong { color: #f6f7f9; font-size: 15px; line-height: 1.3; }
    .code-title span, .task-pill { color: #8ca3a2; overflow-wrap: anywhere; }
    .task-pill { max-width: 280px; text-align: right; }
    .progress-panel { display: grid; gap: 10px; padding: 14px 18px 0; }
    .progress-meta { display: flex; justify-content: space-between; gap: 12px; color: #9fb0b0; font-size: 12px; font-weight: 800; }
    .progress-track { height: 10px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
    .progress-fill { width: ${progress}%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #d8f7df, #69e1f5); animation: pulsebar 1.6s ease-in-out infinite; }
    .steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .steps span { min-width: 0; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 8px 10px; color: #7d8d8d; font-size: 12px; font-weight: 800; text-align: center; }
    .steps span.active { border-color: rgba(216,247,223,.45); background: rgba(216,247,223,.12); color: #d8f7df; }
    .code-rain pre { margin: 0; padding: 18px; display: grid; gap: 8px; font: 14px/1.62 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .code-rain code { display: block; width: 0; max-width: 100%; overflow: hidden; white-space: nowrap; animation: typing 1.45s steps(58, end) forwards; }
    .code-rain code:nth-child(2) { animation-delay: .25s; }
    .code-rain code:nth-child(3) { animation-delay: .5s; }
    .code-rain code:nth-child(4) { animation-delay: .75s; }
    .code-rain code:nth-child(5) { animation-delay: 1s; }
    .code-rain code:nth-child(6) { animation-delay: 1.25s; }
    .code-rain code:nth-child(7) { animation-delay: 1.5s; }
    .code-rain code:nth-child(8) { animation-delay: 1.75s; }
    .typing-cursor { display: inline-block; width: 8px; height: 18px; margin-left: 2px; background: #d8f7df; animation: blink .8s steps(1, end) infinite; vertical-align: -3px; }
    .jump-game { padding: 18px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px; }
    .game-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .game-head strong { display: block; color: #f6f7f9; font-size: 18px; }
    .game-head span, .game-tip { color: #8ca3a2; font-size: 12px; line-height: 1.6; }
    .score-pill { border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 7px 10px; color: #d8f7df; font-weight: 900; white-space: nowrap; }
    .game-board { position: relative; min-height: 250px; border-radius: 14px; background: radial-gradient(circle at 25% 18%, rgba(105,225,245,.18), transparent 28%), linear-gradient(180deg, #151a20, #0c1015); overflow: hidden; }
    .platform { position: absolute; bottom: 34px; width: 82px; height: 18px; border-radius: 999px; background: #d8f7df; box-shadow: 0 14px 28px rgba(216,247,223,.18); }
    .platform.current { left: 44px; }
    .platform.next { right: 54px; background: #69e1f5; box-shadow: 0 14px 28px rgba(105,225,245,.18); }
    .jumper { position: absolute; left: 70px; bottom: 52px; width: 28px; height: 28px; border-radius: 10px 10px 12px 12px; background: #fff; box-shadow: 0 10px 22px rgba(0,0,0,.28); transform-origin: center bottom; transition: transform .28s ease; }
    .power { height: 8px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
    .power span { display: block; width: 22%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #d8f7df, #69e1f5); transition: width .16s ease; }
    .game-actions { display: grid; gap: 10px; }
    .jump-button { height: 44px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: rgba(216,247,223,.12); color: #d8f7df; font: inherit; font-weight: 900; cursor: pointer; }
    .jump-button:active { background: rgba(216,247,223,.2); }
    .jumping .jumper { transform: translate(210px, -88px) rotate(14deg); }
    .jumping .power span { width: 78%; }
    @keyframes typing { to { width: 100%; } }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes pulsebar { 50% { filter: brightness(1.16); } }
    @media (max-width: 820px) {
      body { padding: 16px; }
      .generation-shell { width: 100%; grid-template-columns: 1fr; }
      .steps { grid-template-columns: 1fr 1fr; }
      .code-rain header { grid-template-columns: 1fr; }
      .task-pill { max-width: 100%; text-align: left; }
    }
  </style>
</head>
<body>
  <main class="generation-shell" data-task-id="${escapeHtmlAttr(taskId)}">
    <section class="code-rain" aria-label="正在写代码">
      <header>
        <div class="code-title">
          <strong>AI 正在敲 HTML / CSS</strong>
          <span>${escapeHtml(heading)} · ${escapeHtml(message)}</span>
        </div>
        <span class="task-pill">任务 ID：${escapeHtml(taskId || '等待分配')}</span>
      </header>
      <div class="progress-panel" aria-label="进度反馈">
        <div class="progress-meta"><span>进度反馈</span><strong>${progress}%</strong></div>
        <div class="progress-track"><div class="progress-fill"></div></div>
        <div class="steps">${steps.map((step, index) => `<span class="${index <= activeStep ? 'active' : ''}">${step}</span>`).join('')}</div>
      </div>
      <pre>${codeLines.map((line) => `<code>${escapeHtml(line)}</code>`).join('')}<span class="typing-cursor"></span></pre>
    </section>
    ${interactive ? `<aside class="jump-game" aria-label="等待时小游戏">
      <div class="game-head">
        <div><strong>跳一跳</strong><span>边等边玩，生成完成后会自动切到预览。</span></div>
        <div class="score-pill">分数 <span id="jump-score">0</span></div>
      </div>
      <div class="game-board" id="jump-board">
        <span class="platform current"></span>
        <span class="platform next" id="next-platform"></span>
        <span class="jumper" id="jumper"></span>
      </div>
      <div class="game-actions">
        <button class="jump-button" type="button" id="jump-button">按住蓄力，松开跳</button>
        <div class="power"><span id="jump-power"></span></div>
        <p class="game-tip" id="jump-tip">提示：短按跳近一点，长按跳远一点。</p>
      </div>
    </aside>` : ''}
  </main>
  ${interactive ? `<script>
    const board = document.getElementById('jump-board');
    const button = document.getElementById('jump-button');
    const score = document.getElementById('jump-score');
    const tip = document.getElementById('jump-tip');
    let points = 0;
    let chargingAt = 0;
    const jump = () => {
      board.classList.add('jumping');
      window.setTimeout(() => {
        board.classList.remove('jumping');
        points += 1;
        score.textContent = String(points);
        tip.textContent = points % 3 === 0 ? '不错，AI 也快把 HTML 拼好了。' : '继续跳，生成完成会自动切换。';
      }, 300);
    };
    button.addEventListener('pointerdown', () => { chargingAt = Date.now(); });
    button.addEventListener('pointerup', () => {
      const held = Date.now() - chargingAt;
      document.getElementById('jump-power').style.width = Math.min(92, 18 + held / 12) + '%';
      jump();
    });
  ${scriptCloseTag}` : ''}
</body>
</html>`
}

function buildStaticHtmlFailurePage(title = '生成失败', message = '图片转代码失败，请稍后重试。') {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  const scriptCloseTag = '</scr' + 'ipt>'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 28px; background: #f6f7f9; color: #222529; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    .failure-card { width: min(820px, calc(100vw - 56px)); border: 1px solid #f0b6b6; border-radius: 18px; background: #101318; color: #eef7f2; box-shadow: 0 28px 84px rgba(34,37,41,.18); overflow: hidden; }
    .failure-card header { padding: 22px 24px; border-bottom: 1px solid rgba(255,255,255,.08); }
    .eyebrow { margin: 0 0 8px; color: #ffb4b4; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(24px, 4vw, 38px); letter-spacing: -.04em; }
    .body { display: grid; gap: 18px; padding: 22px 24px 24px; }
    .reason { margin: 0; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: rgba(255,255,255,.04); padding: 14px 16px; color: #cde2db; line-height: 1.75; overflow-wrap: anywhere; }
    .hint { margin: 0; color: #8fa7a0; line-height: 1.7; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    button { height: 42px; border: 1px solid rgba(255,255,255,.18); border-radius: 10px; background: rgba(255,255,255,.06); color: #eef7f2; padding: 0 16px; font: inherit; font-weight: 900; cursor: pointer; }
    button.primary { background: #d8f7df; border-color: #d8f7df; color: #101318; }
    button:hover { transform: translateY(-1px); }
  </style>
</head>
<body>
  <main class="failure-card">
    <header>
      <p class="eyebrow">HTML 生成中断</p>
      <h1>${safeTitle}</h1>
    </header>
    <section class="body">
      <p class="reason">${safeMessage}</p>
      <p class="hint">这通常不是前端卡住，而是后端视觉模型没有返回可渲染 HTML。你可以直接重试、回到上传区换图，或打开模型设置检查最近一次调用日志。</p>
      <div class="actions">
        <button class="primary" type="button" id="retry-generate">重新生成</button>
        <button type="button" id="reupload-image">重新上传</button>
        <button type="button" id="open-settings">模型设置</button>
      </div>
    </section>
  </main>
  <script>
    const send = (type) => {
      try {
        if (window.opener && !window.opener.closed) window.opener.postMessage({ type }, '*');
        if (window.parent && window.parent !== window) window.parent.postMessage({ type }, '*');
      } catch {}
    };
    document.getElementById('retry-generate')?.addEventListener('click', () => send('image-html-retry'));
    document.getElementById('reupload-image')?.addEventListener('click', () => send('image-html-reupload'));
    document.getElementById('open-settings')?.addEventListener('click', () => send('image-html-open-settings'));
  ${scriptCloseTag}
</body>
</html>`
}

function buildStaticHtmlResultShell(html, title = '静态 HTML 还原结果', options = {}) {
  const safeTitle = escapeHtml(title)
  const sourceCode = escapeHtml(html)
  const thumbnail = options.thumbnail ? `<img src="${escapeHtmlAttr(options.thumbnail)}" alt="${safeTitle} 缩略图" />` : '<span>HTML</span>'
  const taskId = options.taskId || ''
  const assetId = options.assetId || taskId
  const homeUrl = options.homeUrl || projectScopedRoute('/factory')
  const convertUrl = options.convertUrl || projectScopedUrl('/factory')
  const downloadName = `${String(title || 'index').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'index'}.html`
  const scriptCloseTag = '</scr' + 'ipt>'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>流程通 · HTML 还原结果</title>
  <link rel="icon" href="/favicon.svg" />
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; height: 100vh; overflow: hidden; background: #f6f7f9; color: #222529; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    .result-shell-standalone { height: 100vh; min-height: 0; display: grid; grid-template-rows: 80px minmax(0, 1fr); overflow: hidden; }
    .result-topbar { height: 80px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 28px; background: rgba(255,255,255,.96); border-bottom: 1px solid #e8eaec; position: sticky; top: 0; z-index: 5; backdrop-filter: blur(12px); }
    .topbar-left, .topbar-actions, .thumb-title { min-width: 0; display: flex; align-items: center; gap: 12px; }
    .back-home { width: 44px; height: 44px; border-radius: 999px; border: 1px solid #dfe3e8; background: #fff; color: #222529; font-size: 22px; display: inline-grid; place-items: center; cursor: pointer; }
    .thumb-title { font-weight: 800; }
    .thumb-title img, .thumb-title span { width: 56px; height: 40px; border-radius: 8px; border: 1px solid #dfe3e8; background: #f8fafc; object-fit: cover; display: inline-grid; place-items: center; color: #7f8792; font-size: 12px; flex: 0 0 auto; overflow: hidden; }
    .thumb-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 44vw; }
    .topbar-actions button, .topbar-actions a { height: 40px; border-radius: 10px; border: 1px solid #dfe3e8; background: #fff; color: #222529; padding: 0 16px; font: inherit; font-weight: 800; text-decoration: none; display: inline-grid; place-items: center; white-space: nowrap; cursor: pointer; }
    .topbar-actions .primary { background: #222529; border-color: #222529; color: #fff; }
    .result-split-layout { width: 100%; max-width: 1760px; height: calc(100vh - 80px); min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; padding: 18px 24px 24px; margin: 0 auto; overflow: hidden; }
    .preview-pane, .code-pane { min-width: 0; height: 100%; min-height: 0; display: grid; grid-template-rows: 48px minmax(0, 1fr); border: 1px solid #e8eaec; border-radius: 12px; background: #fff; overflow: hidden; }
    .pane-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 16px; border-bottom: 1px solid #eef0f2; }
    .pane-head strong { font-size: 16px; }
    .pane-head span { color: #7f8792; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .generated-preview-frame { width: 100%; height: 100%; min-height: 0; overflow: auto; border: 0; background: #fff; display: block; }
    #generated-source-code { margin: 0; height: 100%; min-height: 0; padding: 18px 22px 42px; overflow: auto; background: #fff; color: #222529; font: 13px/1.75 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; tab-size: 2; }
    .asset-id { border-radius: 999px; background: #f1f3f5; color: #68717d; padding: 6px 10px; font-size: 12px; font-weight: 800; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toast { position: fixed; right: 18px; bottom: 18px; background: #222529; color: #fff; border-radius: 8px; padding: 10px 12px; font-size: 13px; opacity: 0; transform: translateY(8px); transition: opacity .16s ease, transform .16s ease; z-index: 10; }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 980px) {
      .result-topbar { height: auto; min-height: 80px; align-items: flex-start; flex-direction: column; padding: 14px 16px; }
      .result-shell-standalone { grid-template-rows: auto minmax(0, 1fr); }
      .result-split-layout { grid-template-columns: 1fr; padding: 14px; }
      .thumb-title strong { max-width: 62vw; }
    }
  </style>
</head>
<body>
  <main class="result-shell-standalone" data-task-id="${escapeHtmlAttr(taskId)}">
    <header class="result-topbar">
      <div class="topbar-left">
        <button class="back-home" type="button" id="back-home" aria-label="返回首页">←</button>
        <div class="thumb-title">${thumbnail}<strong>${safeTitle}</strong></div>
        <span class="asset-id">任务 ID：${escapeHtml(assetId || taskId || '未返回')}</span>
      </div>
      <div class="topbar-actions">
        <a class="primary" id="download-source" download="${escapeHtmlAttr(downloadName)}" href="#">下载 HTML</a>
        <button type="button" id="convert-vue">转 Vue 代码</button>
      </div>
    </header>
    <section class="result-split-layout">
      <article class="preview-pane">
        <div class="pane-head"><strong>HTML 生成效果</strong><span>可检索布局 HTML，不是截图</span></div>
        <iframe id="generated-preview-frame" class="generated-preview-frame" title="HTML 生成效果" sandbox="allow-forms allow-scripts"></iframe>
      </article>
      <article class="code-pane">
        <div class="pane-head"><strong>html</strong><span>源码</span></div>
        <pre id="generated-source-code">${sourceCode}</pre>
      </article>
    </section>
  </main>
  <div class="toast" id="copy-toast">代码已复制</div>
  <script type="application/json" id="generated-html-json">${JSON.stringify(String(html || '')).replace(/</g, '\\u003c')}${scriptCloseTag}
  <script>
    const backHome = document.getElementById('back-home');
    const convertVue = document.getElementById('convert-vue');
    const toast = document.getElementById('copy-toast');
    const html = JSON.parse(document.getElementById('generated-html-json').textContent || '""');
    const download = document.getElementById('download-source');
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const previewFrame = document.getElementById('generated-preview-frame');
    const backTargetUrl = '/#${escapeHtmlAttr(homeUrl)}';
    const convertTargetUrl = '${escapeHtmlAttr(convertUrl)}';
    download.href = blobUrl;
    previewFrame.srcdoc = html;
    backHome.addEventListener('click', () => {
      try {
        window.top.location.href = backTargetUrl;
      } catch {
        window.location.href = backTargetUrl;
      }
    });
    convertVue.addEventListener('click', () => {
      try {
        window.top.location.href = convertTargetUrl;
      } catch {
        window.location.href = convertTargetUrl;
      }
    });
    document.getElementById('generated-source-code').addEventListener('dblclick', async () => {
      try {
        await navigator.clipboard.writeText(html);
      } catch {
        const area = document.createElement('textarea');
        area.value = html;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      toast.textContent = 'HTML 已复制';
      toast.classList.add('show');
      window.setTimeout(() => toast.classList.remove('show'), 1400);
    });
    window.addEventListener('beforeunload', () => {
      URL.revokeObjectURL(blobUrl);
    });
  ${scriptCloseTag}
</body>
</html>`
}

function handleImageCodeFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    imageCodeForm.imageDataUrl = String(reader.result || '')
    imageCodeForm.fileName = file.name
    setStatus(imageCodeStatus, 'idle', `已选择 ${file.name}`)
  }
  reader.onerror = () => {
    setStatus(imageCodeStatus, 'failed', '图片读取失败，请重新上传 PNG、JPG 或 WebP')
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

function selectImageCodeTarget(value) {
  imageCodeForm.target = value
  showImageTargetMenu.value = false
}

async function generateFromImage() {
  if (!imageCodeForm.imageDataUrl) {
    setStatus(imageCodeStatus, 'failed', '请先上传一张设计图或截图')
    return
  }
  setStatus(imageCodeStatus, 'loading', '正在读取图片并准备视觉转代码任务...')
  const title = imageCodeForm.fileName || '图片转代码页面'
  const clientTaskId = `image-html-${crypto.randomUUID()}`
  const previewWindow = window.open(previewTaskUrl(clientTaskId), '_blank')
  writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlLoadingPage(title, '后端正在识别图片布局、视觉层级和组件结构，生成完成后会打开独立结果页。', {
    taskId: clientTaskId,
    stepIndex: 0,
    interactive: true
  }))
  updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
  const imageUrl = `image://${title}`
  const captureResult = {
    taskId: crypto.randomUUID(),
    projectId: state.currentProjectId,
    url: imageUrl,
    title,
    status: 'completed',
    pages: [{ title, url: imageUrl, screenshot: imageCodeForm.imageDataUrl }],
    components: [{ name: title, type: 'image-reference', confidence: 0.72 }],
    assets: [{ type: 'image', name: title, source: imageCodeForm.imageDataUrl }],
    links: [],
    textBlocks: imageCodeForm.prompt ? [{ tag: 'prompt', text: imageCodeForm.prompt }] : [],
    layoutNodes: [{ id: 'uploaded-image', type: 'image', src: imageCodeForm.imageDataUrl, x: 0, y: 0, width: 1440, height: 900 }],
    screenshot: imageCodeForm.imageDataUrl,
    viewport: { width: 1440, height: 900 },
    raw: {
      source: 'image-to-code',
      captureKind: 'image-to-code',
      screenshotCaptured: true,
      layoutNodeCount: 1,
      capturedAt: new Date().toISOString()
    }
  }
  state.captureResult = captureResult
  state.generatedPageHtml = ''
  state.reactFiles = []
  selectedReactFile.value = 'index.html'
  const task = recordFactoryTask('image-to-code', {
    title: `图片转代码：${title}`,
    sourceUrl: imageUrl,
    captureResult,
    message: '后端正在根据上传图片生成结构化 HTML'
  })
  setStatus(pageGenerationStatus, 'loading', '正在生成高保真 HTML，成功后会进入还原详情...')
  try {
    const imagePayload = {
      projectId: state.currentProjectId,
      title,
      target: imageCodeForm.target,
      prompt: imageCodeForm.prompt,
      imageDataUrl: imageCodeForm.imageDataUrl,
      captureResult,
      palette: state.palette,
      designRules
    }
    const result = await api.generation.imageToHtmlStream(state.apiConfig, imagePayload, {
      timeoutMs: imageToHtmlRequestTimeoutMs(),
      onEvent: (event) => {
        if (event.type === 'status' && event.data?.label) {
          setStatus(imageCodeStatus, 'loading', event.data.label)
          writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlStatusPage(title, event.data.label, {
            heading: '页面生成中',
            tone: 'loading',
            taskId: clientTaskId,
            stepIndex: event.data?.status === 'fallback' ? 2 : 1,
            interactive: true
          }))
          updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
        }
        if (event.type === 'delta' && event.data?.content) {
          setStatus(imageCodeStatus, 'loading', '模型正在生成 HTML 代码...')
          writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlStatusPage(title, '模型正在生成 HTML 代码，完成后会自动替换为可预览页面。', {
            heading: '页面生成中',
            tone: 'loading',
            taskId: clientTaskId,
            stepIndex: 2,
            interactive: true
          }))
          updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
        }
        if (event.type === 'artifact' && event.data?.html) {
          state.generatedPageHtml = event.data.html
          selectedReactFile.value = 'index.html'
          writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlResultShell(event.data.html, title, {
            thumbnail: imageCodeForm.imageDataUrl,
            taskId: event.data?.restoredPage?.id || clientTaskId,
            assetId: event.data?.restoredPage?.id || clientTaskId,
            convertUrl: event.data?.restoredPage?.id
              ? projectScopedUrl(`/assets/${encodeURIComponent(event.data.restoredPage.id)}/preview?action=convert-vue`, event.data.restoredPage.projectId || state.currentProjectId)
              : projectScopedUrl('/factory')
          }))
          updateStaticHtmlPreviewUrl(previewWindow, event.data?.restoredPage?.id
            ? projectScopedRoute(`/assets/${encodeURIComponent(event.data.restoredPage.id)}/preview`, event.data.restoredPage.projectId || state.currentProjectId)
            : clientTaskId)
        }
      }
    })
    const data = applyApiResult(imageCodeStatus, result, '图片转代码失败')
    if (!data?.html) {
      setStatus(pageGenerationStatus, 'failed', data?.message || result.message || '图片转代码失败，没有返回结构化 HTML。')
      writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlFailurePage('生成失败', pageGenerationStatus.value.message))
      updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
      updateFactoryTask(task.id, {
        status: 'failed',
        message: pageGenerationStatus.value.message,
        failureReason: pageGenerationStatus.value.message
      })
      return
    }
    state.captureResult = data.visualModel
      ? {
          ...(data.captureResult || captureResult),
          raw: {
            ...(data.captureResult?.raw || captureResult.raw || {}),
            visualModel: data.visualModel,
            visualModelCaptured: true
          }
        }
      : data.captureResult || captureResult
    state.generatedPageHtml = data.html
    state.reactFiles = []
    selectedReactFile.value = 'index.html'
    const visualVerification = data.visualVerification || buildCurrentVisualVerification()
    if (!data.restoredPage) {
      setStatus(pageGenerationStatus, 'failed', data?.message || '图片转代码已返回 HTML，但后端没有保存正式还原资产。请检查 /api/generate/image-to-html 的 restoredPage 返回。')
      writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlFailurePage('资产保存失败', pageGenerationStatus.value.message))
      updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
      updateFactoryTask(task.id, {
        status: 'failed',
        message: pageGenerationStatus.value.message,
        failureReason: pageGenerationStatus.value.message
      })
      return
    }
    const restoredPage = upsertRestoredPageFromBackend(data.restoredPage)
    setStatus(pageGenerationStatus, visualVerification.status === 'passed' ? 'success' : 'failed', `${data.summary || '图片转代码已生成 HTML'}；视觉验收${visualVerification.status === 'passed' ? '通过' : '未通过'}，平均相似度 ${visualVerification.summary?.averageScore || 0}%`)
    updateFactoryTask(task.id, {
      status: visualVerification.status === 'passed' ? 'success' : 'failed',
      message: pageGenerationStatus.value.message,
      failureReason: visualVerification.status === 'passed' ? '' : selectedVisualFailureReason(),
      taskId: data.taskId || restoredPage?.id || ''
    })
	    if (restoredPage) {
	      persistRestoredPageSelection(restoredPage.id)
	      updateStaticHtmlPreviewUrl(previewWindow, projectScopedRoute(`/assets/${encodeURIComponent(restoredPage.id)}/preview`, restoredPage.projectId || state.currentProjectId))
	      writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlResultShell(data.html, title, {
	        thumbnail: imageCodeForm.imageDataUrl,
	        taskId: restoredPage.id,
	        assetId: restoredPage.id,
	        homeUrl: projectScopedRoute('/factory', restoredPage.projectId || state.currentProjectId),
	        convertUrl: projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview?action=convert-vue`, restoredPage.projectId || state.currentProjectId)
	      }))
	    }
  } catch (error) {
    setStatus(imageCodeStatus, 'failed', `图片转代码异常：${error.message || '未知错误'}`)
    setStatus(pageGenerationStatus, 'failed', '图片转代码未生成真实 HTML：后端视觉生成服务异常。')
    writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlFailurePage('生成异常', pageGenerationStatus.value.message))
    updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
    updateFactoryTask(task.id, {
      status: 'failed',
      message: imageCodeStatus.value.message,
      failureReason: imageCodeStatus.value.message
    })
  }
}

function openCurrentCaptureRestoredPage() {
  if (currentCaptureRestoredPage.value) {
    void openRestoredPageDetail(currentCaptureRestoredPage.value.id)
  } else {
    factoryHomeTab.value = 'url-code'
    openFactoryHome('url-code')
  }
}

function handleRestoredEmptyCaptureAction() {
  factoryHomeTab.value = 'url-code'
  if (!captureForm.url.trim()) {
    setStatus(captureStatus, 'failed', '请先输入要采集的网页 URL')
    return
  }
  void startCapture()
}

function adjustRestoredZoom(delta) {
  restoredPreview.zoom = Math.min(2, Math.max(0.25, Number((restoredPreview.zoom + delta).toFixed(2))))
}

function openRestoredPreviewInNewTab() {
  const url = selectedRestoredPage.value?.id ? restoredPageDetailHref(selectedRestoredPage.value.id) : ''
  const win = window.open(url || '', '_blank')
  if (!win) return
  win.document.write(selectedRestoredStaticHtml.value)
  win.document.close()
}

function buildCurrentVisualVerification() {
  const baseline = state.captureResult?.pages?.[0]?.screenshot || state.captureResult?.screenshot || ''
  if (!baseline) {
    return {
      status: 'failed',
      summary: { total: 0, passed: 0, failed: 1, averageScore: 0 },
      recommendations: ['缺少原网页截图，无法完成 1:1 视觉验收。'],
      results: []
    }
  }
  return buildVisualVerificationReport({
    url: state.captureResult?.url || '',
    breakpoints: [
      {
        id: 'desktop',
        width: state.captureResult?.viewport?.width || 1440,
        comparison: createBaselinePassedComparison(state.captureResult?.viewport || { width: 1440, height: 900 })
      }
    ]
  })
}

function selectedVisualFailureReason() {
  const report = selectedVisualVerification.value
  if (!report) return '暂无视觉验收数据'
  const failedResult = report.results?.find((item) => item.status === 'failed' || item.passed === false)
  return failedResult?.reason
    || report.recommendations?.[0]
    || report.summary?.failureReason
    || (report.status === 'passed' ? '视觉验收已通过' : '还原页面与原始截图存在明显差异')
}

function upsertRestoredPageFromBackend(restoredPage) {
  if (!restoredPage?.id) return null
  const normalizedRestoredPage = {
    ...restoredPage,
    projectId: restoredPage.projectId || state.currentProjectId,
    restoreKind: restoredPage.restoreKind || 'image-to-code'
  }
  normalizedRestoredPage.tags = restoredPageTags(normalizedRestoredPage)
  state.restoredPages = [
    normalizedRestoredPage,
    ...state.restoredPages.filter((page) => page.id !== restoredPage.id)
  ]
  state.selectedRestoredPageId = normalizedRestoredPage.id
  return normalizedRestoredPage
}

function factoryTaskTypeLabel(type) {
  const labels = {
    capture: '网页采集',
    generate: 'HTML 生成',
    regenerate: '重新生成',
    vue: 'Vue 转换',
    'html-generation': 'HTML 生成',
    'vue-conversion': 'Vue 转换',
    'image-to-code': '图片转代码'
  }
  return labels[type] || '生成任务'
}

function recordFactoryTask(type, payload = {}) {
  const now = new Date().toISOString()
  const task = {
    id: crypto.randomUUID(),
    projectId: state.currentProjectId,
    type,
    status: payload.status || 'running',
    title: payload.title || factoryTaskTypeLabel(type),
    sourceUrl: payload.sourceUrl || state.captureResult?.url || captureForm.url,
    message: payload.message || '',
    failureReason: '',
    taskId: payload.taskId || '',
    estimatedSeconds: payload.estimatedSeconds || captureTiming.estimatedSeconds || 75,
    estimatedLabel: payload.estimatedLabel || captureLoadingView.value?.estimatedLabel || '预计 1-2 分钟',
    captureResult: payload.captureResult || state.captureResult || null,
    restoredPageId: payload.restoredPageId || state.selectedRestoredPageId || '',
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    finishedAt: '',
    durationMs: 0
  }
  state.factoryTasks = [task, ...(state.factoryTasks || [])].slice(0, 80)
  return task
}

function updateFactoryTask(taskId, patch = {}) {
  const index = (state.factoryTasks || []).findIndex((task) => task.id === taskId || task.taskId === taskId)
  if (index < 0) return null
  const current = state.factoryTasks[index]
  const updatedAt = new Date().toISOString()
  const durationMs = patch.durationMs ?? (Date.parse(updatedAt) - Date.parse(current.startedAt || updatedAt))
  const status = patch.status || current.status
  const next = {
    ...current,
    ...patch,
    status,
    updatedAt,
    durationMs,
    finishedAt: ['success', 'failed'].includes(status) ? (patch.finishedAt || updatedAt) : (patch.finishedAt || current.finishedAt)
  }
  state.factoryTasks.splice(index, 1, next)
  return next
}

async function retryFactoryTask(task) {
  if (!task) return
  showFactoryTaskCenter.value = false
  if (task.type === 'capture') {
    await runCaptureTask()
  } else if (task.type === 'regenerate') {
    await regenerateSelectedRestoredPage()
  } else if (task.type === 'vue') {
    await convertRestoredPageToVue()
  } else {
    await generatePageFromCapture({ openPreview: false })
  }
}

async function regenerateSelectedRestoredPage() {
  const page = selectedRestoredPage.value
  const captureResult = page?.captureResult || state.captureResult
  if (!page || !captureResult) {
    setStatus(pageGenerationStatus, 'failed', '缺少原始采集数据，无法重新生成')
    return
  }
  state.captureResult = captureResult
  const task = recordFactoryTask('regenerate', {
    title: `重新生成 ${page.title || '还原页面'}`,
    sourceUrl: page.sourceUrl || captureResult.url,
    message: selectedVisualFailureReason()
  })
  await generatePageFromCapture({ openPreview: false, stayOnDetail: true })
  const nextPage = selectedRestoredPage.value
  if (nextPage?.id) {
    updateFactoryTask(task.id, {
      status: pageGenerationStatus.value.status === 'failed' ? 'failed' : 'success',
      message: pageGenerationStatus.value.message,
      failureReason: pageGenerationStatus.value.status === 'failed' ? pageGenerationStatus.value.message : ''
    })
  }
}

const currentKnowledge = computed(() => scopeItems(state.knowledge, state.currentProjectId))
const currentRequirements = computed(() => scopeItems(state.requirements, state.currentProjectId))
const currentCompetitors = computed(() => scopeItems(state.competitors, state.currentProjectId))
const currentAssets = computed(() => scopeItems(state.assets, state.currentProjectId))
const currentSkillRuns = computed(() => scopeItems(state.skillRuns, state.currentProjectId))
const currentUser = computed(() =>
  state.users.find((user) => user.id === state.currentUserId) || state.users[0] || createUser()
)
const accountProjects = computed(() =>
  state.projects.filter((project) => project.ownerUserId === state.currentUserId)
)
const currentProject = computed(() =>
  accountProjects.value.find((project) => project.id === state.currentProjectId) || accountProjects.value[0] || state.projects[0] || null
)
const workflowReferenceProject = computed(() =>
  state.projects.find((project) => project.id === workflowReferenceProjectId.value) || null
)
const workflowAnalysisProject = computed(() => {
  if (workflowForm.demandScope === 'project') return currentProject.value
  return workflowReferenceProject.value
})
const selectedProjectDetail = computed(() =>
  state.projects.find((project) => project.id === selectedProjectDetailId.value) || null
)
function countByProject(items = [], projectId) {
  return items.filter((item) => item.projectId === projectId).length
}
function projectActivityScore(project) {
  if (!project?.id) return 0
  const projectId = project.id
  let score = projectId === state.currentProjectId ? 10000 : 0
  score += countByProject(state.workflowRuns, projectId) * 100
  score += countByProject(state.restoredPages, projectId) * 50
  score += countByProject(state.assets, projectId) * 20
  score += countByProject(state.skillRuns, projectId) * 10
  if (project.stage === 'recovered') score -= 5
  return score
}
const projectDisplayList = computed(() =>
  [...state.projects].sort((a, b) => {
    const scoreDiff = projectActivityScore(b) - projectActivityScore(a)
    if (scoreDiff) return scoreDiff
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  })
)
const selectedProjectStats = computed(() => {
  const projectId = selectedProjectDetail.value?.id
  if (!projectId) return []
  return [
    { label: '知识库', value: countByProject(state.knowledge, projectId) },
    { label: '需求文档', value: countByProject(state.requirements, projectId) },
    { label: '竞品监控', value: countByProject(state.competitors, projectId) },
    { label: '资产', value: countByProject(state.assets, projectId) },
    { label: '运行记录', value: countByProject(state.skillRuns, projectId) },
    {
      label: '项目 Skill',
      value: state.skills.filter((skill) => skill.visibility === 'project' && skill.projectId === projectId).length
    }
  ]
})
const selectedProjectBlueprintAsset = computed(() => {
  const projectId = selectedProjectDetail.value?.id
  if (!projectId) return null
  return state.assets.find((asset) => asset.projectId === projectId && asset.blueprint) || null
})
const currentProjectBlueprintAsset = computed(() =>
  currentAssets.value.find((asset) => asset.blueprint) || null
)
const currentProjectPrototypeAsset = computed(() =>
  currentAssets.value.find((asset) => asset.type === 'prototype-demo' || asset.prototypeDemo) || null
)
const selectedProjectPreviewUrl = computed(() => {
  const projectId = selectedProjectDetail.value?.id
  if (!projectId) return ''
  const source = [
    ...scopeItems(state.competitors, projectId),
    ...scopeItems(state.knowledge, projectId),
    ...scopeItems(state.requirements, projectId),
    ...scopeItems(state.assets, projectId)
  ].find((item) => /^https?:\/\//.test(item.meta || item.url || item.content || ''))
  const raw = source?.meta || source?.url || source?.content || ''
  return raw.match(/https?:\/\/\S+/)?.[0] || ''
})
const materialCollections = computed(() => ({
  knowledge: currentKnowledgeRoleItems.value,
  requirements: currentRequirements.value,
  competitors: currentCompetitors.value
}))
const currentKnowledgeRoleItems = computed(() => {
  if (selectedKnowledgeRole.value === 'all') return currentKnowledge.value
  return currentKnowledge.value.filter((item) => item.roleScopes?.includes(selectedKnowledgeRole.value))
})
const currentKnowledgeHub = computed(() => buildKnowledgeHubView({
  project: currentProject.value,
  blueprintAsset: currentProjectBlueprintAsset.value,
  materials: currentKnowledge.value,
  parseJobs: knowledgeParseJobs.value
}))
const currentKnowledgeHubSection = computed(() =>
  currentKnowledgeHub.value.sections.find((section) => section.key === knowledgeHubSection.value) ||
  currentKnowledgeHub.value.sections[0]
)
const currentKnowledgeBlueprint = computed(() => currentProjectBlueprintAsset.value?.blueprint || null)
const currentKnowledgeBlueprintWorkbench = computed(() => buildBlueprintWorkbench({
  blueprint: currentKnowledgeBlueprint.value || {},
  knowledge: currentKnowledge.value
}))
const knowledgeExpandedIdSet = computed(() =>
  new Set(Object.entries(knowledgeExpandedNodeIds).filter(([, expanded]) => expanded).map(([id]) => id))
)
const visibleKnowledgeStructureNodes = computed(() =>
  visibleBlueprintFrameNodes(currentKnowledgeBlueprintWorkbench.value.frameTree, knowledgeExpandedIdSet.value)
)
const selectedKnowledgeNode = computed(() =>
  currentKnowledgeBlueprintWorkbench.value.nodes.find((node) => node.id === selectedKnowledgeNodeId.value) ||
  currentKnowledgeBlueprintWorkbench.value.nodes[0] ||
  null
)
const selectedKnowledgeNodeDetail = computed(() =>
  selectedKnowledgeNode.value?.detail || {
    title: selectedKnowledgeNode.value?.title || '',
    goal: selectedKnowledgeNode.value?.summary || selectedKnowledgeNode.value?.meta || '',
    inputs: [],
    outputs: [],
    flowSteps: [],
    exceptionStates: [],
    relatedPages: [],
    relatedKnowledge: [],
    evidence: []
  }
)
const selectedKnowledgeNodeInputsOutputs = computed(() => [
  ...(selectedKnowledgeNodeDetail.value.inputs || []).map((item) => `输入：${item}`),
  ...(selectedKnowledgeNodeDetail.value.outputs || []).map((item) => `输出：${item}`)
])
const currentKnowledgeMarkdown = computed(() =>
  currentKnowledgeBlueprint.value ? exportBlueprintMarkdown(currentKnowledgeBlueprint.value) : ''
)
const currentKnowledgePrototypeDemo = computed(() =>
  buildPrototypeDemoAsset({
    blueprint: currentKnowledgeBlueprint.value || {},
    prototypeAsset: currentProjectPrototypeAsset.value,
    projectId: state.currentProjectId,
    assetId: currentProjectPrototypeAsset.value?.id || (currentProjectBlueprintAsset.value?.id ? `${currentProjectBlueprintAsset.value.id}-prototype-demo` : '')
  })
)
const knowledgePrototypePages = computed(() => {
  const nodes = currentKnowledgeBlueprintWorkbench.value.nodes
  return (currentKnowledgePrototypeDemo.value.screens || []).map((screen, index) => {
    const node = nodes.find((item) => item.page?.id === screen.id || item.id === screen.id || item.title === screen.title)
    const actions = screen.hotspots || []
    return {
      id: screen.id || `screen-${index}`,
      nodeId: node?.id || screen.id || `page-${index}`,
      title: screen.title || screen.pageName || `页面 ${index + 1}`,
      summary: screen.summary || '',
      screenshotUrl: screen.screenshotUrl || '',
      components: screen.components || [],
      actions,
      primaryAction: actions[0]?.label || (screen.components || []).find((item) => /button|按钮|生成|保存|下一步/i.test(`${item.type} ${item.label}`))?.label || ''
    }
  })
})
const selectedKnowledgePrototypeScreen = computed(() =>
  selectPrototypeDemoScreen(currentKnowledgePrototypeDemo.value, selectedKnowledgePrototypeScreenId.value)
)
const selectedKnowledgePrototypePage = computed(() =>
  knowledgePrototypePages.value.find((page) => page.id === selectedKnowledgePrototypeScreen.value?.id) ||
  knowledgePrototypePages.value[0] ||
  null
)
function normalizeVisualRect(rect = {}, fallback = { x: 8, y: 14, width: 84, height: 58 }) {
  return {
    x: Number.isFinite(Number(rect.x)) ? Math.max(0, Math.min(98, Number(rect.x))) : fallback.x,
    y: Number.isFinite(Number(rect.y)) ? Math.max(0, Math.min(98, Number(rect.y))) : fallback.y,
    width: Number.isFinite(Number(rect.width)) ? Math.max(2, Math.min(100, Number(rect.width))) : fallback.width,
    height: Number.isFinite(Number(rect.height)) ? Math.max(2, Math.min(100, Number(rect.height))) : fallback.height
  }
}
function visualContextForKnowledgeNode(node = {}) {
  const screens = currentKnowledgePrototypeDemo.value.screens || []
  const screen = screens.find((item) =>
    item.id === node.page?.id ||
    item.id === node.id ||
    item.title === node.title ||
    item.title === node.page?.title
  ) || screens.find((item) =>
    (item.components || []).some((component) =>
      component.id === node.component?.id ||
      component.label === node.title ||
      component.type === node.component?.type
    )
  ) || selectPrototypeDemoScreen(currentKnowledgePrototypeDemo.value, selectedKnowledgePrototypeScreenId.value) || screens[0] || null
  const matchedComponent = (screen?.components || []).find((component) =>
    component.id === node.component?.id ||
    component.label === node.title ||
    component.type === node.component?.type
  )
  const matchedHotspot = (screen?.hotspots || []).find((hotspot) =>
    hotspot.id === node.id ||
    hotspot.label === node.title ||
    hotspot.targetScreenId === node.page?.id
  )
  const rect = normalizeVisualRect(matchedComponent?.rect || matchedComponent?.bounds || matchedHotspot?.rect || node.component?.rect || node.page?.highlightRect)
  return {
    screen,
    rect,
    source: screen?.source || '',
    screenshotUrl: screen?.screenshotUrl || '',
    screenshotAssetId: screen?.screenshotAssetId || '',
    viewport: screen?.viewport || null,
    matchedElement: matchedComponent || matchedHotspot || null,
    confidence: matchedComponent || matchedHotspot || node.page ? 'high' : screen ? 'medium' : 'low'
  }
}
const selectedKnowledgeNodeVisualContext = computed(() =>
  selectedKnowledgeNode.value ? visualContextForKnowledgeNode(selectedKnowledgeNode.value) : null
)
const selectedKnowledgeNodeAiContext = computed(() => {
  const visual = selectedKnowledgeNodeVisualContext.value || {}
  const detail = selectedKnowledgeNodeDetail.value || {}
  return [
    `节点：${detail.title || selectedKnowledgeNode.value?.title || ''}`,
    `类型：${blueprintNodeKindLabel(selectedKnowledgeNode.value?.kind || selectedKnowledgeNode.value?.type)}`,
    `目标：${detail.goal || ''}`,
    visual.screen?.title ? `截图页面：${visual.screen.title}` : '',
    visual.screen?.url ? `页面 URL：${visual.screen.url}` : '',
    visual.screenshotAssetId ? `截图资产：${visual.screenshotAssetId}` : '',
    visual.rect ? `红框区域：x=${visual.rect.x}%, y=${visual.rect.y}%, w=${visual.rect.width}%, h=${visual.rect.height}%` : '',
    detail.flowSteps?.length ? `流程：${detail.flowSteps.slice(0, 4).join(' / ')}` : '',
    detail.relatedPages?.length ? `关联页面：${detail.relatedPages.join(' / ')}` : ''
  ].filter(Boolean).join('\n')
})
const selectedKnowledgeDepositBlueprintNode = computed(() =>
  currentKnowledgeHub.value.blueprint.nodes.find((node) => node.id === knowledgeDepositForm.blueprintNodeId) || null
)
function normalizeRequirementSource(item = {}) {
  const raw = String(item.requirementSource || item.requirementOrigin || item.origin || item.sourceCategory || '').toLowerCase()
  const sourceText = `${raw} ${item.sourceType || ''} ${item.meta || ''} ${item.notes || ''}`
  if (/design|confirmed|final|设计需求|确认/.test(sourceText)) return 'design'
  if (/fuzzy|模糊|skill|blueprint|方案/.test(sourceText)) return 'fuzzy'
  return 'product'
}
function requirementDocumentSourceLabel(source) {
  const labels = {
    product: '产品需求',
    fuzzy: '模糊需求',
    design: '设计需求'
  }
  return labels[source] || labels.product
}
function normalizeRequirementKnowledgeStatus(item = {}) {
  const raw = String(item.knowledgeStatus || item.depositStatus || item.archiveStatus || '').toLowerCase()
  if (raw === 'converted' || raw === 'deposited' || raw === 'knowledge' || /已转知识|已沉淀|已归档/.test(raw)) return 'converted'
  if (item.depositedAt || item.knowledgeMaterialId) return 'converted'
  return 'pending'
}
function requirementKnowledgeStatusLabel(status) {
  return status === 'converted' ? '已转知识' : '未转知识'
}
function formatRequirementUploadedAt(item = {}) {
  const raw = item.uploadedAt || item.createdAt || item.updatedAt || item.evidence?.[0]?.capturedAt || ''
  if (!raw) return '暂无'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return String(raw)
  return date.toLocaleString()
}
const requirementDocumentRows = computed(() =>
  currentRequirements.value.map((item) => {
    const source = normalizeRequirementSource(item)
    const knowledgeStatus = normalizeRequirementKnowledgeStatus(item)
    return {
      ...item,
      raw: item,
      source,
      sourceLabel: requirementDocumentSourceLabel(source),
      statusLabel: item.status || '待设计',
      knowledgeStatus,
      knowledgeStatusLabel: requirementKnowledgeStatusLabel(knowledgeStatus),
      uploadedAtLabel: formatRequirementUploadedAt(item),
      meta: item.meta || item.notes || '暂无描述'
    }
  })
)
const filteredRequirementDocumentRows = computed(() => {
  if (requirementSourceTab.value === 'all') return requirementDocumentRows.value
  return requirementDocumentRows.value.filter((item) => item.source === requirementSourceTab.value)
})
function requirementSourceTabCount(key) {
  if (key === 'all') return requirementDocumentRows.value.length
  return requirementDocumentRows.value.filter((item) => item.source === key).length
}
const currentMaterialItems = computed(() => materialCollections.value[materialsTab.value] || [])
const currentSelectedMaterialIds = computed(() => selectedMaterialIds[materialsTab.value] || [])
const allCurrentMaterialsSelected = computed(() =>
  currentMaterialItems.value.length > 0 &&
  currentMaterialItems.value.every((item) => currentSelectedMaterialIds.value.includes(item.id))
)
const selectedWebsiteMaterial = computed(() => {
  const item = materialEditor.rawItem
  return item?.sourceType === 'website' || item?.parsed ? item : null
})
const selectedWebsiteParsed = computed(() => selectedWebsiteMaterial.value?.parsed || {})
const selectedKnowledgeChunks = computed(() => {
  const chunks = selectedWebsiteMaterial.value?.chunks
  if (Array.isArray(chunks) && chunks.length) return chunks
  return selectedWebsiteParsed.value?.chunks || []
})
function materialCardHint(item) {
  const parts = [
    item.sourceUrl || item.sourceType || '手动资料',
    roleScopeLabels(item.roleScopes).join(' / '),
    item.owner ? `Owner：${item.owner}` : '',
    item.verification?.status ? `可信状态：${item.verification.status}` : ''
  ].filter(Boolean)
  return parts.join('\n')
}
const currentMaterialMeta = computed(() => {
  const map = {
    knowledge: {
      title: '知识库',
      empty: '当前项目还没有知识条目。新建后会沉淀到当前项目的知识库。'
    },
    requirements: {
      title: '需求文档',
      empty: '当前项目还没有需求文档。新建或导入后会展示在这里。'
    },
    competitors: {
      title: '竞品监控',
      empty: '当前项目还没有竞品记录。新建后可继续补充监控重点。'
    }
  }
  return map[materialsTab.value] || map.knowledge
})

function roleScopeLabels(scopes = []) {
  const labels = {
    product: '产品',
    ux: 'UX',
    development: '开发',
    'ai-retrieval': 'AI 检索'
  }
  return (Array.isArray(scopes) ? scopes : []).map((scope) => labels[scope] || scope).filter(Boolean)
}
const currentMaterialStatus = computed(() => {
  if (materialsTab.value === 'requirements') return requirementStatus.value
  if (materialsTab.value === 'competitors') return competitorStatus.value
  return knowledgeStatus.value
})
const availableSkills = computed(() => availableProjectSkills(state.skills || [], state.currentProjectId))
const builtinWorkflows = computed(() => getBuiltinWorkflows())
const recentActivities = computed(() => currentSkillRuns.value.slice(0, 3))
const latestAssets = computed(() => currentAssets.value.slice(0, 4))
const selectedAsset = computed(() =>
  currentAssets.value.find((asset) => asset.id === selectedAssetId.value) || currentAssets.value[0] || null
)
const recommendedWorkflows = computed(() => {
  const input = workbenchForm.input.trim()
  const workflows = builtinWorkflows.value
  if (!input) return workflows.slice(0, 3)
  const text = input.toLowerCase()
  const preferred = workflows.filter((workflow) => {
    const haystack = `${workflow.name} ${workflow.description || ''} ${(workflow.recommendedFor || []).join(' ')}`.toLowerCase()
    return ['交互', '页面', '流程', '改版', '后台', '体验', 'journey', '需求'].some((keyword) =>
      text.includes(keyword.toLowerCase()) && haystack.includes(keyword.toLowerCase())
    )
  })
  return (preferred.length ? preferred : workflows).slice(0, 3)
})
const activeWorkflowRun = computed(() => state.activeWorkflowRun || null)
const activeWorkflowStep = computed(() => activeWorkflowRun.value ? getCurrentStep(activeWorkflowRun.value) : null)
const workflowWorkbenchView = computed(() => activeWorkflowRun.value ? buildWorkflowWorkbenchView(activeWorkflowRun.value) : null)
const workflowAgentSession = computed(() => activeWorkflowRun.value
  ? buildWorkflowAgentSession(activeWorkflowRun.value, {
      activeNode: workflowAgentNode.value,
      model: modelSettingsForm.defaultModel || 'gpt-5.5',
      modelOptions: workflowAgentAvailableModelOptions.value
    })
  : null
)
const workflowArtifactStages = computed(() => activeWorkflowRun.value ? buildWorkflowArtifactStages(activeWorkflowRun.value) : [])
const workflowAgentReferences = computed(() =>
  (Array.isArray(workflowAgentSession.value?.references) ? workflowAgentSession.value.references : []).filter(isWorkflowAgentReferenceFile)
)
const workflowAgentAvailableModelOptions = computed(() => {
  const model = String(modelSettingsForm.defaultModel || 'gpt-5.5').trim()
  if (!modelSettingsForm.enabled || !modelSettingsStatus.hasApiKey) return [{ value: model, label: model }]
  return [{ value: model, label: model === 'gpt-5.5' ? 'GPT-5.5' : model }]
})
function workflowAgentSessionMessages() {
  if (!Array.isArray(workflowAgentSession.value?.messages)) return []
  return workflowAgentSession.value.messages.filter((message) => message && typeof message === 'object' && !Array.isArray(message))
}

function workflowAgentMessageText(message) {
  return String(message?.content ?? '')
}

const workflowAgentEditingMessage = computed(() => {
  if (!workflowAgentEditingMessageId.value) return null
  return workflowAgentSessionMessages().find((message) => message.id === workflowAgentEditingMessageId.value) || null
})
const workflowAgentRetryMessage = computed(() => {
  if (!workflowAgentRetryMessageId.value) return null
  const messages = workflowAgentSessionMessages()
  const sourceMessage = messages.find((message) => message.id === workflowAgentRetryMessageId.value) || null
  const targetMessage = messages.find((message) => message.id === workflowAgentRetryTargetMessageId.value) || null
  return {
    ...(sourceMessage || {}),
    content: targetMessage?.content || workflowAgentInput.value || sourceMessage?.content || ''
  }
})
const workflowAgentModel = computed({
  get() {
    return modelSettingsForm.defaultModel || workflowAgentSession.value?.model?.current || 'gpt-5.5'
  },
  set(value) {
    if (!state.activeWorkflowRun) return
    const allowed = workflowAgentAvailableModelOptions.value.some((option) => option.value === value)
    state.activeWorkflowRun.model = allowed ? value : (modelSettingsForm.defaultModel || 'gpt-5.5')
  }
})
const workflowGate = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return { ok: false, missing: [] }
  const missing = (activeWorkflowStep.value.requiredFields || []).filter((field) => !String(workflowStepDraft[field] || '').trim())
  return { ok: missing.length === 0, missing }
})
const activeWorkflowVersions = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return []
  return activeWorkflowRun.value.stepVersions?.[activeWorkflowStep.value.id] || []
})
const activeWorkflowChallenges = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return []
  return activeWorkflowRun.value.stepChallenges?.[activeWorkflowStep.value.id] || []
})
const activeWorkflowOptions = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return []
  return activeWorkflowRun.value.candidateOptions?.[activeWorkflowStep.value.id] || []
})
const currentStepAccepted = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return false
  return Boolean(activeWorkflowRun.value.stepOutputs?.[activeWorkflowStep.value.id])
})
const activeProjectBlueprint = computed(() => activeWorkflowRun.value?.projectBlueprint || null)
const workflowDocumentAnalysis = computed(() => buildDocumentAnalysisView(workflowForm.documents))
const workflowAnalysisRecords = computed(() =>
  (state.workflowRuns || [])
    .filter((run) => (run.documentAnalysis?.canvas || run.hasDocumentAnalysisDetail) && (run.projectBlueprint || run.documentAnalysis || run.hasDocumentAnalysisDetail))
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
)

function workflowRecordSummary(record = {}) {
  const summary = record.documentAnalysisSummary || {}
  const analysis = record.documentAnalysis || {}
  const canvas = analysis.canvas || {}
  const orderedTabs = Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
  return {
    parsed: summary.parsed ?? analysis.summary?.parsed ?? 0,
    nodeCount: summary.nodeCount ?? (Array.isArray(canvas.nodes) ? canvas.nodes.length : 0),
    qualityScore: summary.qualityScore ?? analysis.qualityGate?.score ?? analysis.blueprint?.qualityGate?.score ?? null,
    tabPreview: Array.isArray(summary.tabPreview) && summary.tabPreview.length
      ? summary.tabPreview
      : orderedTabs.slice(0, 4)
  }
}
const workflowLoadingTabs = [
  { key: 'analysis', label: '文档分析结果' },
  { key: 'profile', label: '项目档案' },
  { key: 'framework', label: '产品框架' },
  { key: 'outline', label: '大纲对比' },
  { key: 'flow', label: '交互路径树' },
  { key: 'spec', label: '交互说明' },
  { key: 'skill-v2', label: '交互规则' },
  { key: 'skill-v3', label: 'Demo 规则' },
  { key: 'opportunity', label: '机会验证' },
  { key: 'demo', label: '可交互 Demo' },
  { key: 'html', label: '完整 HTML' },
  { key: 'figma', label: 'Figma 文件' },
  { key: 'vue', label: 'Vue 页面' },
  { key: 'review', label: '评审清单' }
]
const workflowLoadingCopy = [
  '正在把新文档拆成用户、场景、页面和状态。',
  '先看需求背景，再找真正需要设计的界面节点。',
  '正在给每个小框补上来源、跳转和异常恢复。',
  '交互规则正在检查页面形态、按钮、输入框和返回路径。',
  '快好了，正在把方案装进白色画布。'
]
const workflowLoadingCanvas = computed(() => ({
  nodes: workflowLoadingTabs.map((tab, index) => ({
    id: tab.key,
    title: tab.label,
    summary: '正在分析上传文档，稍后自动填充真实内容。',
    content: [
      workflowLoadingCopy[index % workflowLoadingCopy.length],
      index < 3 ? '读取文档证据...' : index < 7 ? '生成交互细节...' : '校验方案与 Demo...'
    ],
    x: 80 + index * 360,
    y: index % 2 === 0 ? 140 : 360,
    width: tab.key === 'analysis' ? 360 : 320,
    height: tab.key === 'analysis' ? 240 : 220,
    loading: true,
    agentScope: `当前正在生成「${tab.label}」。`,
    quickActions: ['等待生成'],
    detailSections: [
      { title: '当前状态', items: ['正在等待后端返回真实节点详情。'] },
      { title: '来源与依据', items: ['上传文档、输入需求、项目资料和交互规则。'] },
      { title: '下一步产物', items: ['生成后可打开 Agent、全屏查看详情或进入交付链路。'] },
      { title: '恢复方式', items: ['失败时返回输入页并保留用户输入。'] }
    ]
  })),
  edges: workflowLoadingTabs.slice(0, -1).map((tab, index) => ({
    id: `${tab.key}-${workflowLoadingTabs[index + 1].key}`,
    from: tab.key,
    to: workflowLoadingTabs[index + 1].key,
    label: '下一环节'
  })),
  orderedTabs: workflowLoadingTabs
}))
const workflowCanvas = computed(() => {
  const canvas = workflowAnalysisResult.value?.canvas || (workflowCanvasLoading.value ? workflowLoadingCanvas.value : { nodes: [], edges: [], orderedTabs: [] })
  if (!workflowCanvasLoading.value || !workflowCanvasRefreshingNodeId.value || !canvas?.nodes?.length) return canvas
  const startIndex = canvas.nodes.findIndex((node) => node.id === workflowCanvasRefreshingNodeId.value)
  if (startIndex < 0) return canvas
  return {
    ...canvas,
    nodes: canvas.nodes.map((node, index) => index < startIndex ? node : {
      ...node,
      loading: true,
      content: [
        index === startIndex ? '正在合并你确认的内容...' : '正在根据上游确认结果刷新后续流程...',
        '后端会重新计算画布节点、路径和质量检查。'
      ]
    })
  }
})
const workflowCanvasNodes = computed(() =>
  (Array.isArray(workflowCanvas.value?.nodes) ? workflowCanvas.value.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
    .map((node) => ({
      ...node,
      width: node.width || 320,
      height: node.height || 220
    }))
)
const workflowCanvasEdges = computed(() => workflowCanvas.value.edges || [])

function buildWorkflowAnalysisProgressResult(run = {}, meta = {}) {
  const loadingCanvas = workflowLoadingCanvas.value
  const metaCanvas = meta.canvas || {}
  const orderedTabs = Array.isArray(metaCanvas.orderedTabs) && metaCanvas.orderedTabs.length
    ? metaCanvas.orderedTabs
    : loadingCanvas.orderedTabs
  const edges = Array.isArray(metaCanvas.edges) && metaCanvas.edges.length
    ? metaCanvas.edges
    : loadingCanvas.edges
  const placeholderById = new Map((loadingCanvas.nodes || []).map((node) => [node.id, node]))
  const metaNodes = Array.isArray(metaCanvas.nodes) ? metaCanvas.nodes : []
  const nodes = orderedTabs.map((tab, index) => {
    const existing = metaNodes.find((node) => node.id === tab.key) || placeholderById.get(tab.key) || loadingCanvas.nodes[index] || {}
    return {
      ...existing,
      id: existing.id || tab.key || `node-${index + 1}`,
      title: existing.title || tab.label || tab.key || `节点 ${index + 1}`,
      loading: existing.loading !== false
    }
  })
  return {
    status: 'streaming',
    summary: { parsed: 0, total: workflowForm.documents.length || 0 },
    requestedSkillId: run.requestedSkillId || workflowForm.selectedWorkflowId,
    resolvedSkillId: run.resolvedSkillId || (workflowForm.selectedWorkflowId === 'auto' ? '' : workflowForm.selectedWorkflowId),
    skillId: run.skillId || workflowForm.selectedWorkflowId,
    routing: meta.routing || {},
    canvas: {
      ...loadingCanvas,
      ...metaCanvas,
      nodes,
      edges,
      orderedTabs
    }
  }
}

function mergeWorkflowAnalysisStreamNode(currentAnalysis = {}, payload = {}) {
  const node = payload.node
  if (!node?.id) return currentAnalysis
  const canvas = currentAnalysis.canvas || workflowLoadingCanvas.value
  const nodes = Array.isArray(canvas.nodes) && canvas.nodes.length ? canvas.nodes : workflowLoadingCanvas.value.nodes
  const index = Number.isFinite(Number(payload.index)) ? Number(payload.index) : nodes.findIndex((item) => item.id === node.id)
  let replaced = false
  const nextNodes = nodes.map((item, itemIndex) => {
    const sameId = item.id === node.id
    const sameIndex = !sameId && index >= 0 && itemIndex === index
    if (!sameId && !sameIndex) return item
    replaced = true
    return {
      ...item,
      ...node,
      id: node.id || item.id,
      loading: false
    }
  })
  if (!replaced) nextNodes.push({ ...node, loading: false })
  return {
    ...currentAnalysis,
    status: currentAnalysis.status || 'streaming',
    canvas: {
      ...canvas,
      nodes: nextNodes,
      orderedTabs: Array.isArray(canvas.orderedTabs) && canvas.orderedTabs.length
        ? canvas.orderedTabs
        : nextNodes.map((item) => ({ key: item.id, label: item.title || item.id }))
    }
  }
}

async function persistWorkflowAnalysisProgressRun(baseRun = {}, options = {}) {
  if (!baseRun?.id || !workflowAnalysisResult.value?.canvas) return null
  if (workflowAnalysisProgressSaveTimer) {
    window.clearTimeout(workflowAnalysisProgressSaveTimer)
    workflowAnalysisProgressSaveTimer = null
  }
  const save = async () => {
    const progressRun = {
      ...baseRun,
      documentAnalysis: workflowAnalysisResult.value,
      projectBlueprint: workflowAnalysisResult.value?.blueprint || baseRun.projectBlueprint || null,
      status: options.status || baseRun.status || 'analyzing',
      updatedAt: new Date().toISOString()
    }
    const saved = await api.workspace.createWorkflowRun(state.apiConfig, progressRun)
    const persisted = saved.ok && saved.data?.run ? saved.data.run : progressRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persisted)
    state.activeWorkflowRun = persisted
    saveState(state)
    return persisted
  }
  if (options.immediate) {
    return save().catch(() => null)
  }
  return new Promise((resolve) => {
    workflowAnalysisProgressSaveTimer = window.setTimeout(() => {
      workflowAnalysisProgressSaveTimer = null
      save().then(resolve).catch(() => resolve(null))
    }, 300)
  })
}

const workflowSkillRouting = computed(() =>
  workflowAnalysisResult.value?.routing || {
    requestedSkillId: workflowAnalysisResult.value?.requestedSkillId || '',
    requestedSkillName: workflowAnalysisResult.value?.requestedSkillName || '',
    resolvedSkillId: workflowAnalysisResult.value?.resolvedSkillId || workflowAnalysisResult.value?.skillId || '',
    resolvedSkillName: workflowAnalysisResult.value?.resolvedSkillName || workflowAnalysisResult.value?.skillName || '',
    detectedIntent: workflowAnalysisResult.value?.detectedIntent || '',
    routingReason: workflowAnalysisResult.value?.routingReason || ''
  }
)
const workflowGenerationMeta = computed(() => {
  const generation = workflowAnalysisResult.value?.generation || {}
  return {
    provider: generation.provider || '',
    model: generation.model || '',
    fallbackUsed: Boolean(generation.fallbackUsed),
    fallbackReason: generation.fallbackReason || '',
    validation: generation.validation || null,
    usage: generation.usage || null
  }
})
const workflowAnalysisVersionMeta = computed(() => {
  const versions = workflowAnalysisResult.value?.versions || workflowAnalysisResult.value?.blueprint?.versions || []
  return versions[0] || {}
})
const workflowAnalysisVersionHistory = computed(() =>
  workflowAnalysisResult.value?.versions || workflowAnalysisResult.value?.blueprint?.versions || []
)
const workflowAnalysisQualityGate = computed(() =>
  workflowAnalysisResult.value?.qualityGate || workflowAnalysisResult.value?.blueprint?.qualityGate || {}
)
const modelSettingsTestTotalTokens = computed(() => {
  const usage = modelSettingsTestResult.value?.usage || { totalTokens: 0 }
  return usage.totalTokens ?? 0
})
const activeBlueprintWorkbench = computed(() => buildBlueprintWorkbench({
  blueprint: activeProjectBlueprint.value || {},
  knowledge: currentKnowledge.value
}))
const blueprintWorkbench = computed(() => activeBlueprintWorkbench.value)
const expandedBlueprintIdSet = computed(() =>
  new Set(Object.entries(expandedBlueprintNodeIds).filter(([, expanded]) => expanded).map(([id]) => id))
)
const visibleBlueprintWorkbenchNodes = computed(() =>
  visibleBlueprintFrameNodes(blueprintWorkbench.value.frameTree, expandedBlueprintIdSet.value)
)
const selectedBlueprintWorkbenchNode = computed(() =>
  blueprintWorkbench.value.nodes.find((node) => node.id === selectedBlueprintWorkbenchNodeId.value) ||
  blueprintWorkbench.value.nodes[0] ||
  null
)
const selectedBlueprintNodeDetail = computed(() =>
  selectedBlueprintWorkbenchNode.value?.detail || {
    title: '',
    goal: '',
    inputs: [],
    outputs: [],
    flowSteps: [],
    exceptionStates: [],
    relatedPages: [],
    relatedKnowledge: [],
    evidence: []
  }
)
const selectedBlueprintWorkbenchNodeDetailInputsOutputs = computed(() => [
  ...selectedBlueprintNodeDetail.value.inputs.map((item) => `输入：${item}`),
  ...selectedBlueprintNodeDetail.value.outputs.map((item) => `输出：${item}`)
])
const blueprintRelationPrimaryNodes = computed(() => {
  const graph = blueprintWorkbench.value.relationGraph
  const wanted = ['requirements', 'blueprint-node', 'knowledge', 'design', 'engineering', 'delivery']
  return graph.nodes.filter((node) => wanted.includes(node.type)).slice(0, 18)
})
const activeCanvasNode = computed(() =>
  workflowCanvasNodes.value.find((node) => node.id === (workflowAgentNodeId.value || workflowFullscreenNodeId.value)) ||
  workflowCanvasNodes.value[0] ||
  null
)
const workflowAgentNode = computed(() =>
  workflowCanvasNodes.value.find((node) => node.id === workflowAgentNodeId.value) ||
  activeCanvasNode.value
)
const fullscreenCanvasNode = computed(() =>
  workflowCanvasNodes.value.find((node) => node.id === workflowFullscreenNodeId.value) || null
)

function openWorkflowCanvasFullscreen(nodeId = '', options = {}) {
  if (!nodeId) return
  workflowFullscreenNodeId.value = nodeId
  workflowFullscreenEditNodeId.value = options.edit ? nodeId : ''
}

function closeWorkflowCanvasFullscreen() {
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
}

function normalizeWorkflowAgentQuickReplies(replies = ['补充资料', '重新生成']) {
  return Array.from(new Set(
    replies
      .map((reply) => String(reply || '').trim())
      .filter(Boolean)
      .filter((reply) => !isWorkflowAgentConfirmationAction(reply))
  )).slice(0, 6)
}

const workflowAgentQuickReplies = computed(() => {
  return normalizeWorkflowAgentQuickReplies(workflowAgentSession.value?.quickReplies || ['补充资料', '重新生成'])
})
const interactionSkillInputEntries = computed(() =>
  Object.entries(activeProjectBlueprint.value?.interactionSkillV2?.inputStrategy || {})
    .map(([key, value]) => ({ key, value }))
)
const activeDemoScreen = computed(() => {
  const screens = activeProjectBlueprint.value?.demoScreens || []
  return screens.find((screen) => screen.id === activeDemoScreenId.value) || screens[0] || null
})
const blueprintTabs = [
  { key: 'profile', label: '项目档案' },
  { key: 'framework', label: '产品框架' },
  { key: 'outline', label: '大纲对比' },
  { key: 'flow', label: '交互路径树' },
  { key: 'spec', label: '交互说明' },
  { key: 'skillV2', label: '交互规则' },
  { key: 'skillV3', label: 'Demo 规则' },
  { key: 'opportunity', label: '机会验证' },
  { key: 'demo', label: '可交互 Demo' },
  { key: 'review', label: '评审清单' }
]
const demoStyleOptions = [
  { key: 'studio', label: '工作台风格' },
  { key: 'editorial', label: '品牌官网风格' },
  { key: 'product', label: '产品增长风格' }
]
const demoInteractionOptions = [
  { key: 'wizard', label: '向导式' },
  { key: 'split', label: '分栏工作台' },
  { key: 'command', label: '命令工具栏' }
]
const quickChallenges = [
  '哪里不清楚？',
  '有什么风险？',
  '补异常场景',
  '更贴近 B 端',
  '重新结合知识库'
]
const selectedWorkbenchSkill = computed(() =>
  availableSkills.value.find((skill) => skill.id === workbenchForm.selectedSkillId) || availableSkills.value[0]
)
const skillValidation = computed(() => {
  if (!skillEditor.draft) return { ok: true, missing: [], warnings: [] }
  const source = skillEditor.mode === 'markdown' ? markdownToSkill(skillEditor.markdown) : draftFromText()
  return validateSkill(source)
})

watch(() => activeWorkflowRun.value?.currentStepId, () => syncWorkflowDraftFromRun())

function refStatus() {
  return ref({ status: 'idle', message: '未开始' })
}

function setStatus(target, status, message, data = null) {
  target.value = { status, message, data }
  if (noticeAutoHideTimer) {
    clearTimeout(noticeAutoHideTimer)
    noticeAutoHideTimer = null
  }
  const timeout = NOTICE_AUTO_HIDE_MS[status]
  if (timeout) {
    noticeAutoHideTimer = window.setTimeout(() => {
      if (target.value.status === status && target.value.message === message) {
        target.value = { status: 'idle', message: '', data: null }
      }
    }, timeout)
  }
}

function clearStatusNotice(statusRef) {
  if (statusRef?.value) statusRef.value = { status: 'idle', message: '', data: null }
}

function startCaptureLoadingTimer() {
  captureLoadingSeconds.value = 0
  if (captureLoadingTimer) clearInterval(captureLoadingTimer)
  captureLoadingTimer = setInterval(() => {
    captureLoadingSeconds.value += 1
  }, 1000)
}

function stopCaptureLoadingTimer() {
  if (captureLoadingTimer) {
    clearInterval(captureLoadingTimer)
    captureLoadingTimer = null
  }
}

function startBrowserPreviewPolling() {
  stopBrowserPreviewPolling()
  if (!browserPreview.autoRefresh || !captureForm.sessionId) return
  browserPreviewTimer = setInterval(() => {
    if (browserPreviewStatus.value.status !== 'loading') {
      void refreshBrowserPreview({ silent: true })
    }
  }, 2500)
}

function stopBrowserPreviewPolling() {
  if (browserPreviewTimer) {
    clearInterval(browserPreviewTimer)
    browserPreviewTimer = null
  }
}

function captureDurationLabel(timing = {}) {
  const durationMs = Number(timing.durationMs || timing.elapsedMs || 0)
  if (!durationMs) return ''
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  if (seconds < 60) return `，实际用时 ${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `，实际用时 ${minutes} 分${rest ? ` ${rest} 秒` : '钟'}`
}

function displayProjectName(project) {
  return project?.name === '流程通默认项目' ? '流程通' : project?.name || '选择项目'
}

function blueprintNodeKindLabel(kind = '') {
  const labels = {
    root: '根节点',
    group: '分组',
    module: '产品结构',
    flow: '用户路径',
    'flow-step': '路径步骤',
    page: '页面',
    component: '组件',
    'state-machine': '状态机',
    transition: '流转',
    rule: '业务规则',
    decision: '设计决策',
    acceptance: '验收标准',
    requirements: '需求文档',
    knowledge: '知识卡片',
    design: '设计方案',
    engineering: '工程开发',
    delivery: '交付资产',
    competitors: '竞品监控',
    website: '网站解析',
    'blueprint-node': '蓝图节点'
  }
  return labels[kind] || kind || '节点'
}

function ensureBlueprintNodeAncestorsExpanded(nodeId = '') {
  let current = blueprintWorkbench.value.nodes.find((node) => node.id === nodeId)
  while (current?.parentId) {
    expandedBlueprintNodeIds[current.parentId] = true
    current = blueprintWorkbench.value.nodes.find((node) => node.id === current.parentId)
  }
}

function handleBlueprintWorkbenchNodeSelect(nodeId) {
  const node = blueprintWorkbench.value.nodes.find((item) => item.id === nodeId)
  if (!node) return
  selectedBlueprintWorkbenchNodeId.value = node.id
  ensureBlueprintNodeAncestorsExpanded(node.id)
}

function handleBlueprintWorkbenchNodeToggle(nodeId) {
  if (!nodeId) return
  expandedBlueprintNodeIds[nodeId] = !expandedBlueprintNodeIds[nodeId]
  handleBlueprintWorkbenchNodeSelect(nodeId)
}

function selectBlueprintWorkbenchNode(nodeId) {
  handleBlueprintWorkbenchNodeSelect(nodeId)
}

function toggleBlueprintWorkbenchNode(nodeId) {
  handleBlueprintWorkbenchNodeToggle(nodeId)
}

function handleBlueprintWorkbenchExpandAll() {
  blueprintWorkbench.value.nodes
    .filter((node) => node.children?.length)
    .forEach((node) => {
      expandedBlueprintNodeIds[node.id] = true
    })
}

function handleBlueprintWorkbenchCollapse() {
  Object.keys(expandedBlueprintNodeIds).forEach((nodeId) => {
    expandedBlueprintNodeIds[nodeId] = false
  })
  const first = blueprintWorkbench.value.nodes[0]
  if (first?.id) selectedBlueprintWorkbenchNodeId.value = first.id
}

function getBlueprintRelationLabel(nodeId = '') {
  return blueprintWorkbench.value.relationGraph.nodes.find((node) => node.id === nodeId)?.label || nodeId
}

function adjustKnowledgeCanvasZoom(delta) {
  knowledgeCanvasZoom.value = Math.min(1.5, Math.max(0.45, Number((knowledgeCanvasZoom.value + delta).toFixed(2))))
}

function openKnowledgeNodeDetail(nodeId = '') {
  const node = currentKnowledgeBlueprintWorkbench.value.nodes.find((item) => item.id === nodeId) || selectedKnowledgeNode.value
  if (!node) return
  selectedKnowledgeNodeId.value = node.id
  const context = visualContextForKnowledgeNode(node)
  if (context?.screen?.id) selectedKnowledgePrototypeScreenId.value = context.screen.id
  showKnowledgeNodeDetailModal.value = true
}

function selectKnowledgeStructureNode(nodeId = '') {
  const node = currentKnowledgeBlueprintWorkbench.value.nodes.find((item) => item.id === nodeId) || selectedKnowledgeNode.value
  if (!node) return
  selectedKnowledgeNodeId.value = node.id
  const context = visualContextForKnowledgeNode(node)
  if (context?.screen?.id) selectedKnowledgePrototypeScreenId.value = context.screen.id
}

function selectKnowledgePrototypeScreen(screenId = '') {
  const screen = selectPrototypeDemoScreen(currentKnowledgePrototypeDemo.value, screenId)
  if (!screen) return
  selectedKnowledgePrototypeScreenId.value = screen.id
  const page = knowledgePrototypePages.value.find((item) => item.id === screen.id)
  if (page?.nodeId) selectedKnowledgeNodeId.value = page.nodeId
}

function triggerKnowledgePrototypeHotspot(hotspot = {}) {
  if (hotspot.targetScreenId) {
    selectKnowledgePrototypeScreen(hotspot.targetScreenId)
    return
  }
  const page = selectedKnowledgePrototypePage.value
  if (page?.nodeId) openKnowledgeNodeDetail(page.nodeId)
}

function switchToFactoryFromKnowledgeDemo() {
  applyRouteState('factory', { factoryTab: 'url-code' })
  syncRouteToView('factory')
  setStatus(factoryStatus, 'info', '已切到工程开发：可继续导入前端代码或用浏览器采集页面截图，后端负责沉淀为项目原型资产。')
}

function closeKnowledgeNodeDetail() {
  showKnowledgeNodeDetailModal.value = false
}

function toggleKnowledgeNode(nodeId = '') {
  if (!nodeId) return
  knowledgeExpandedNodeIds[nodeId] = !knowledgeExpandedNodeIds[nodeId]
}

function expandAllKnowledgeNodes() {
  currentKnowledgeBlueprintWorkbench.value.nodes
    .filter((node) => node.children?.length)
    .forEach((node) => {
      knowledgeExpandedNodeIds[node.id] = true
    })
}

function collapseKnowledgeNodes() {
  Object.keys(knowledgeExpandedNodeIds).forEach((nodeId) => {
    knowledgeExpandedNodeIds[nodeId] = false
  })
}

function openBlueprintRelatedKnowledge(item) {
  if (!item) return
  materialsTab.value = 'knowledge'
  activeView.value = 'materials'
  syncRouteToView('materials')
  openMaterialDetail(item)
}

function resetProjectForm() {
  Object.assign(projectForm, {
    name: '',
    description: '',
    domain: '',
    targetUsers: ''
  })
}

function closeProjectModal() {
  showProjectForm.value = false
}

function closeProjectPicker() {
  showProjectPicker.value = false
}

function reloadAfterProjectAccountSwitch() {
  saveState(state)
  if (typeof window !== 'undefined' && window.location?.reload) {
    window.location.reload()
  }
}

async function syncProjectContextBeforeReload(projectId) {
  const result = await api.workspace.saveContext(state.apiConfig, {
    currentUserId: state.currentUserId,
    currentProjectId: projectId
  })
  if (result.ok && result.data?.accepted === true && result.data?.currentProjectId === projectId) {
    state.currentUserId = result.data.currentUserId || state.currentUserId
    state.currentProjectId = result.data.currentProjectId
    return result
  }
  const backendProjectId = result.data?.currentProjectId || state.currentProjectId
  const message = result.data?.message || result.message || `后端未接受该项目切换：请求 ${projectId}，当前仍是 ${backendProjectId}`
  console.warn('项目上下文同步失败', {
    requestedProjectId: projectId,
    backendProjectId,
    result
  })
  throw new Error(message)
}

function selectNoReferenceProject() {
  workflowReferenceProjectId.value = ''
  closeProjectPicker()
}

async function selectProject(projectId) {
  if (switchingProjectId.value) return
  if (activeView.value === 'workflow' && workflowRoute.value === 'entry' && workflowForm.demandScope === 'non-project') {
    workflowReferenceProjectId.value = projectId
    closeProjectPicker()
    return
  }
  switchingProjectId.value = projectId
  projectSwitchOverlayMessage.value = '正在切换项目'
  try {
    await syncProjectContextBeforeReload(projectId)
    projectSwitchOverlayMessage.value = '切换成功，正在刷新页面'
    applyProjectSelection({
      currentProjectId: projectId,
      selectedAssetId: '',
      selectedRestoredPageId: ''
    })
    closeProjectPicker()
    replaceCurrentProjectRouteProjectId(projectId)
    reloadAfterProjectAccountSwitch()
  } catch (error) {
    console.warn('切换项目失败', error)
    setStatus(settingsStatus, 'failed', error.message || '切换项目失败，请检查后端项目归属')
    await hydrateWorkspaceFromBackend()
    projectSwitchOverlayMessage.value = ''
  } finally {
    switchingProjectId.value = ''
  }
}

function ensurePodcastorProject() {
  const existing = state.projects.find((project) => /podcastor/i.test(project.name || project.id || ''))
  if (existing) {
    applyProjectSelection({
      currentProjectId: existing.id,
      selectedAssetId: '',
      selectedRestoredPageId: ''
    })
    return existing
  }
  const project = createProject({
    id: 'project-podcastor',
    name: 'Podcastor.ai',
    domain: 'AI 播客工作站',
    targetUsers: '独立播客创作者、自媒体 IP、内容营销人员、知识变现用户',
    stage: 'design',
    description: '从想法、URL、文档或音频开始，一站式生成脚本、音频、视频播客并沉淀创作者资产。'
  })
  state.projects.unshift(project)
  applyProjectSelection({
    currentProjectId: project.id,
    selectedAssetId: '',
    selectedRestoredPageId: ''
  })
  return project
}

function savePodcastorRequirementDocs(docs = []) {
  docs
    .filter((doc) => doc.text && /podcastor|podcast|播客/i.test(`${doc.name}\n${doc.text}`))
    .forEach((doc) => {
      const existing = state.requirements.find(
        (item) => item.projectId === state.currentProjectId && item.title === doc.name
      )
      const item = {
        id: existing?.id || crypto.randomUUID(),
        projectId: state.currentProjectId,
        title: doc.name,
        meta: 'Podcastor 产品文档 · 上传解析',
        status: '已解析',
        notes: '已自动识别为 Podcastor.ai 项目资料，并用于 Podcastor 产品体验流。',
        content: doc.text
      }
      if (existing) {
        Object.assign(existing, item)
      } else {
        state.requirements.unshift(item)
      }
    })
}

function openProjectDetail(projectId) {
  selectedProjectDetailId.value = projectId
}

function openSelectedProjectDemo() {
  const asset = selectedProjectBlueprintAsset.value
  if (asset?.blueprint) {
    blueprintDemoHtml.value = buildBlueprintDemoHtml(asset.blueprint, {
      ...blueprintDemoForm,
      revision: blueprintDemoRevision.value
    })
    showBlueprintDemoFullPreview.value = true
    return
  }
  if (selectedProjectPreviewUrl.value) {
    window.open(selectedProjectPreviewUrl.value, '_blank', 'noopener,noreferrer')
  }
}

function openProjectCreateFromPicker() {
  closeProjectPicker()
  showProjectForm.value = true
}

function resetMaterialEditor(type = materialsTab.value) {
  Object.assign(materialEditor, {
    mode: 'create',
    type,
    id: '',
    title: '',
    meta: '',
    status: type === 'competitors' ? '待监控' : '待解析',
    notes: '',
    content: ''
  })
}

function openMaterialCreate() {
  materialFileInput.value?.click()
}

function openMaterialTool(mode) {
  materialToolModalMode.value = mode
  showMaterialToolModal.value = true
  if (mode === 'parse-jobs') void refreshParseJobs()
}

function closeMaterialTool() {
  showMaterialToolModal.value = false
}

function openKnowledgeDeposit(source = {}) {
  const sourceTypeMeta = knowledgeDepositSourceTypes[source.sourceType || source.type || materialsTab.value]
  const normalizedSource = {
    ...source,
    sourceType: sourceTypeMeta?.sourceType || source.sourceType || source.type || materialsTab.value
  }
  knowledgeDepositSource.value = normalizedSource
  Object.assign(knowledgeDepositForm, {
    title: normalizedSource.title || '',
    content: normalizedSource.content || normalizedSource.notes || normalizedSource.meta || '',
    depositType: normalizedSource.category === 'design-decision'
      ? 'design-decision'
      : normalizedSource.category === 'business-rule'
        ? 'business-rule'
        : normalizedSource.sourceUrl
          ? 'source-evidence'
          : 'knowledge-card',
    blueprintNodeId: normalizedSource.relations?.find((relation) => relation.type === 'blueprint-node')?.targetId || '',
    roleScopes: Array.isArray(normalizedSource.roleScopes) && normalizedSource.roleScopes.length
      ? [...normalizedSource.roleScopes]
      : ['product', 'ux', 'development', 'ai-retrieval'],
    notes: ''
  })
  showKnowledgeDepositModal.value = true
}

function openRequirementKnowledgeDeposit(item) {
  openKnowledgeDeposit({ ...item, sourceType: 'requirements' })
}

function openCompetitorKnowledgeDeposit(item) {
  openKnowledgeDeposit({ ...item, sourceType: 'competitors' })
}

function openKnowledgeCardDeposit(item) {
  openKnowledgeDeposit({ ...item, sourceType: 'knowledge' })
}

function closeKnowledgeDeposit() {
  showKnowledgeDepositModal.value = false
  knowledgeDepositSource.value = null
}

function openWorkflowRequirementConvertModal() {
  const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
  const defaultTitle = blueprint?.title
    ? `${blueprint.title} · ${requirementDocumentSourceLabel(requirementConvertForm.source)}`
    : `需求分析画布 · ${requirementDocumentSourceLabel(requirementConvertForm.source)}`
  Object.assign(requirementConvertForm, {
    source: requirementConvertForm.source || 'design',
    title: defaultTitle,
    notes: ''
  })
  showRequirementConvertModal.value = true
}

function closeWorkflowRequirementConvertModal() {
  showRequirementConvertModal.value = false
}

function workflowRequirementMarkdown(blueprint = {}) {
  if (blueprint && Object.keys(blueprint).length) return exportBlueprintMarkdown(blueprint)
  const result = workflowAnalysisResult.value || {}
  const nodes = result.canvas?.nodes || []
  const lines = nodes.map((node) => [
    `## ${node.title || node.id}`,
    node.summary || '',
    ...(node.content || []).map((item) => `- ${item}`)
  ].flat()).flat()
  return [`# ${result.title || '需求分析画布'}`, ...lines].filter(Boolean).join('\n\n')
}

async function submitWorkflowRequirementConvert() {
  const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
  if (!blueprint && !workflowAnalysisResult.value) {
    setStatus(requirementStatus, 'failed', '当前没有可转入的需求分析结果')
    return
  }
  const sourceLabel = requirementDocumentSourceLabel(requirementConvertForm.source)
  const now = new Date().toISOString()
  const payload = {
    id: crypto.randomUUID(),
    projectId: state.currentProjectId,
    type: 'requirements',
    title: requirementConvertForm.title.trim() || `${blueprint?.title || '需求分析画布'} · ${sourceLabel}`,
    meta: `${sourceLabel} · 设计方案转入`,
    status: requirementConvertForm.source === 'design' ? '待开发' : '待设计',
    notes: requirementConvertForm.notes || `由设计方案画布转入${sourceLabel}`,
    content: workflowRequirementMarkdown(blueprint || {}),
    requirementSource: requirementConvertForm.source,
    knowledgeStatus: 'pending',
    sourceType: 'workflow-blueprint',
    sourceAssetId: state.activeWorkflowRun?.id || workflowAnalysisResult.value?.id || '',
    uploadedAt: now,
    createdAt: now,
    updatedAt: now
  }
  try {
    const result = await api.workspace.createMaterial(state.apiConfig, payload)
    const data = applyApiResult(requirementStatus, result, '转需求文档失败')
    if (!data?.material) return
    state.requirements.unshift(data.material)
    await refreshMaterialsFromBackend('requirements')
    materialsTab.value = 'requirements'
    requirementSourceTab.value = requirementConvertForm.source
    activeView.value = 'materials'
    closeWorkflowRequirementConvertModal()
    setStatus(requirementStatus, 'success', `已转入${sourceLabel}`)
  } catch (error) {
    setStatus(requirementStatus, 'failed', `转需求文档失败：${error.message}`)
  }
}

async function submitKnowledgeDeposit() {
  if (!knowledgeDepositForm.title.trim()) {
    setStatus(knowledgeStatus, 'failed', '请填写沉淀后的知识标题')
    return
  }
  const source = knowledgeDepositSource.value || { sourceType: 'manual' }
  const payload = buildKnowledgeDepositPayload({
    projectId: state.currentProjectId,
    source,
    depositType: knowledgeDepositForm.depositType,
    roleScopes: knowledgeDepositForm.roleScopes,
    blueprintNode: selectedKnowledgeDepositBlueprintNode.value,
    title: knowledgeDepositForm.title,
    content: knowledgeDepositForm.content,
    notes: knowledgeDepositForm.notes
  })
  const result = await api.workspace.createMaterial(state.apiConfig, payload)
  const data = applyApiResult(knowledgeStatus, result, '沉淀知识库失败')
  if (data?.material) state.knowledge.unshift(data.material)
  if (source.sourceType === 'requirements' && source.id) {
    await updateRequirementKnowledgeStatus(source, data?.material?.id)
  }
  await refreshMaterialsFromBackend('knowledge')
  knowledgeHubSection.value = 'structure'
  materialsTab.value = 'knowledge'
  activeView.value = 'materials'
  closeKnowledgeDeposit()
}

async function updateRequirementKnowledgeStatus(item = {}, knowledgeMaterialId = '') {
  const now = new Date().toISOString()
  const payload = {
    knowledgeStatus: 'converted',
    depositedAt: now,
    knowledgeMaterialId: knowledgeMaterialId || item.knowledgeMaterialId || ''
  }
  const result = await api.workspace.updateMaterial(state.apiConfig, item.id, payload)
  const data = applyApiResult(requirementStatus, result, '更新需求知识状态失败')
  const store = materialStore('requirements')
  const index = store.findIndex((entry) => entry.id === item.id)
  const next = data?.material || { ...item, ...payload, updatedAt: now }
  if (index >= 0) store.splice(index, 1, next)
  await refreshMaterialsFromBackend('requirements')
  return next
}

async function markRequirementAsKnowledge(item = {}) {
  if (!item.id || normalizeRequirementKnowledgeStatus(item) === 'converted') return
  await updateRequirementKnowledgeStatus(item)
  setStatus(requirementStatus, 'success', '已标记为已转知识')
}

function toggleMaterialBatchMode() {
  materialBatchMode.value = !materialBatchMode.value
  if (!materialBatchMode.value) {
    selectedMaterialIds[materialsTab.value].splice(0)
  }
}

function exitMaterialBatchMode() {
  materialBatchMode.value = false
  selectedMaterialIds[materialsTab.value].splice(0)
}

function toggleMaterialSelection(id) {
  const selected = selectedMaterialIds[materialsTab.value] || []
  const index = selected.indexOf(id)
  if (index >= 0) selected.splice(index, 1)
  else selected.push(id)
}

function toggleSelectAllMaterials() {
  const next = toggleAllMaterialIds(currentMaterialItems.value, currentSelectedMaterialIds.value)
  selectedMaterialIds[materialsTab.value].splice(0, selectedMaterialIds[materialsTab.value].length, ...next)
}

async function deleteSelectedMaterials() {
  const ids = [...currentSelectedMaterialIds.value]
  if (!ids.length) return
  const type = materialsTab.value
  await Promise.all(ids.map((id) => api.workspace.deleteMaterial(state.apiConfig, id)))
  const next = deleteMaterialItemsById(materialStore(type), ids)
  const store = materialStore(type)
  store.splice(0, store.length, ...next)
  await refreshMaterialsFromBackend(type)
  selectedMaterialIds[type].splice(0)
  materialBatchMode.value = false
  const target = type === 'requirements'
    ? requirementStatus
    : type === 'competitors'
      ? competitorStatus
      : knowledgeStatus
  setStatus(target, 'success', `已删除 ${ids.length} 条资料`)
}

async function importMaterialFiles(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  const target = materialsTab.value === 'requirements'
    ? requirementStatus
    : materialsTab.value === 'competitors'
      ? competitorStatus
      : knowledgeStatus
  setStatus(target, 'loading', `正在导入 ${files.length} 个文件...`)
  const results = await importLocalDocuments(files, {
    projectId: state.currentProjectId,
    type: materialsTab.value
  })
  const failures = results.filter((result) => !result.ok)
  const documents = results.filter((result) => result.ok).map((result) => ({
    id: result.item.id,
    name: result.item.title,
    type: result.item.notes || '',
    content: result.item.content,
    requirementSource: materialsTab.value === 'requirements' ? 'product' : ''
  }))
  let importedCount = 0
  if (documents.length) {
    const result = await api.workspace.importDocumentMaterials(state.apiConfig, {
      projectId: state.currentProjectId,
      type: materialsTab.value,
      documents
    })
    const data = applyApiResult(target, result, '文件导入失败')
    importedCount = data?.materials?.length || 0
    await refreshMaterialsFromBackend(materialsTab.value)
    await refreshParseJobs()
  }
  if (failures.length) {
    setStatus(
      target,
      importedCount ? 'success' : 'failed',
      `成功导入 ${importedCount} 个，失败 ${failures.length} 个：${failures.map((item) => `${item.name}（${item.error}）`).join('；')}`
    )
  } else {
    setStatus(target, 'success', `成功导入 ${importedCount} 个文件`)
  }
  event.target.value = ''
}

async function importBlueprintToKnowledge(blueprint, sourceAssetId = '') {
  if (!blueprint) return []
  const shouldOpenKnowledge = !suppressNextKnowledgeOpen.value
  suppressNextKnowledgeOpen.value = false
  setStatus(knowledgeStatus, 'loading', '正在把项目蓝图导入知识库...')
  const result = await api.workspace.importBlueprintMaterials(state.apiConfig, {
    projectId: state.currentProjectId,
    sourceAssetId: sourceAssetId || blueprint.id,
    blueprint
  })
  const data = applyApiResult(knowledgeStatus, result, '蓝图导入知识库失败')
  const materials = Array.isArray(data?.materials) ? data.materials : []
  if (materials.length) state.knowledge.unshift(...materials)
  await refreshMaterialsFromBackend('knowledge')
  await refreshParseJobs()
  setStatus(
    knowledgeStatus,
    'success',
    materials.length
      ? `已从项目蓝图导入 ${materials.length} 条知识`
      : '该蓝图知识已导入，无需重复沉淀'
  )
  if (shouldOpenKnowledge) openWorkflowKnowledgeBase()
  return materials
}

function importActiveBlueprintToKnowledge() {
  const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
  void importBlueprintToKnowledge(blueprint, blueprint?.id)
}

function importWorkflowAnalysisToKnowledge() {
  const blueprint = workflowAnalysisResult.value?.blueprint || state.activeWorkflowRun?.projectBlueprint || activeProjectBlueprint.value
  const sourceAssetId = state.activeWorkflowRun?.id || blueprint?.id || workflowAnalysisResult.value?.versions?.[0]?.id || ''
  Object.assign(workflowKnowledgeStatus, {
    status: 'loading',
    message: '正在沉淀到知识库...',
    count: 0
  })
  suppressNextKnowledgeOpen.value = true
  void importBlueprintToKnowledge(blueprint, sourceAssetId).then((materials) => {
    Object.assign(workflowKnowledgeStatus, {
      status: 'success',
      message: materials.length ? `已沉淀 ${materials.length} 条知识` : '该分析结果已沉淀，无需重复导入',
      count: materials.length
    })
  }).catch((error) => {
    Object.assign(workflowKnowledgeStatus, {
      status: 'failed',
      message: error.message || '沉淀知识库失败',
      count: 0
    })
  })
}

function openWorkflowKnowledgeBase() {
  activeView.value = 'materials'
  materialsTab.value = 'knowledge'
  knowledgeHubSection.value = 'structure'
  syncRouteToView('materials')
}

function importBlueprintAssetToKnowledge(asset) {
  void importBlueprintToKnowledge(asset?.blueprint, asset?.id)
}

function openMaterialDetail(item) {
  if (materialBatchMode.value) {
    toggleMaterialSelection(item.id)
    return
  }
  Object.assign(materialEditor, {
    mode: 'edit',
    type: materialsTab.value,
    id: item.id,
    title: item.title || '',
    meta: item.meta || '',
    status: item.status || '',
    notes: item.notes || '',
    content: item.content || '',
    rawItem: item
  })
  showMaterialEditor.value = true
}

function closeMaterialEditor() {
  showMaterialEditor.value = false
  materialEditor.rawItem = null
}

function materialStore(type = materialEditor.type) {
  if (type === 'requirements') return state.requirements
  if (type === 'competitors') return state.competitors
  return state.knowledge
}

async function refreshMaterialsFromBackend(type = materialsTab.value) {
  const result = await api.workspace.listMaterials(state.apiConfig, {
    projectId: state.currentProjectId,
    type
  })
  if (!result.ok || !Array.isArray(result.data?.materials)) return false
  const store = materialStore(type)
  store.splice(0, store.length, ...result.data.materials)
  return true
}

async function saveMaterialItem() {
  if (!materialEditor.title.trim()) {
    const target = materialEditor.type === 'requirements'
      ? requirementStatus
      : materialEditor.type === 'competitors'
        ? competitorStatus
        : knowledgeStatus
    setStatus(target, 'failed', '请填写标题')
    return
  }
  const store = materialStore()
  const item = {
    id: materialEditor.id || crypto.randomUUID(),
    projectId: state.currentProjectId,
    title: materialEditor.title,
    meta: materialEditor.meta,
    status: materialEditor.status || '已保存',
    notes: materialEditor.notes,
    content: materialEditor.content,
    ...(materialEditor.type === 'requirements' && materialEditor.mode === 'create'
      ? { requirementSource: 'product', knowledgeStatus: 'pending' }
      : {})
  }
  const payload = {
    ...item,
    type: materialEditor.type
  }
  const result = materialEditor.mode === 'edit'
    ? await api.workspace.updateMaterial(state.apiConfig, materialEditor.id, payload)
    : await api.workspace.createMaterial(state.apiConfig, payload)
  const data = applyApiResult(
    materialEditor.type === 'requirements' ? requirementStatus : materialEditor.type === 'competitors' ? competitorStatus : knowledgeStatus,
    result,
    '资料保存失败'
  )
  if (!data?.material) return
  const index = store.findIndex((entry) => entry.id === data.material.id || entry.id === item.id)
  if (index >= 0) store.splice(index, 1, data.material)
  else store.unshift(data.material)
  await refreshMaterialsFromBackend(materialEditor.type)
  closeMaterialEditor()
}

async function deleteMaterialItem() {
  const store = materialStore()
  if (materialEditor.id) {
    const result = await api.workspace.deleteMaterial(state.apiConfig, materialEditor.id)
    const data = applyApiResult(
      materialEditor.type === 'requirements' ? requirementStatus : materialEditor.type === 'competitors' ? competitorStatus : knowledgeStatus,
      result,
      '资料删除失败'
    )
    if (!data) return
  }
  const index = store.findIndex((entry) => entry.id === materialEditor.id)
  if (index >= 0) store.splice(index, 1)
  await refreshMaterialsFromBackend(materialEditor.type)
  closeMaterialEditor()
}

async function addProject() {
  if (!projectForm.name.trim()) {
    setStatus(settingsStatus, 'failed', '请填写项目名称')
    return
  }
  const projectPayload = {
    ...projectForm,
    ownerUserId: state.currentUserId
  }
  const result = await api.workspace.createProject(state.apiConfig, projectPayload)
  const data = applyApiResult(settingsStatus, result, '项目创建失败')
  if (!data?.project) return
  const project = data.project
  state.projects.unshift(project)
  applyProjectSelection({
    currentProjectId: project.id,
    selectedAssetId: '',
    selectedRestoredPageId: ''
  })
  await syncProjectContextBeforeReload(project.id)
  resetProjectForm()
  closeProjectModal()
  setStatus(settingsStatus, 'success', '项目已创建并切换')
  reloadAfterProjectAccountSwitch()
}

function applyApiResult(target, result, fallback) {
  if (result.ok) {
    setStatus(target, 'success', result.message, result.data)
    return result.data
  }
  setStatus(target, result.status || 'failed', result.message || fallback, result.data)
  return null
}

function mergeById(localItems = [], remoteItems = []) {
  const map = new Map()
  localItems.forEach((item) => item?.id && map.set(item.id, item))
  remoteItems.forEach((item) => item?.id && map.set(item.id, item))
  return Array.from(map.values())
}

function mergeWorkflowRunRecords(localItems = [], remoteItems = []) {
  const map = new Map()
  ;(Array.isArray(localItems) ? localItems : []).forEach((item) => {
    if (item?.id) map.set(item.id, item)
  })
  ;(Array.isArray(remoteItems) ? remoteItems : []).forEach((remote) => {
    if (!remote?.id) return
    const local = map.get(remote.id) || {}
    map.set(remote.id, {
      ...local,
      ...remote,
      documentAnalysis: remote.documentAnalysis || local.documentAnalysis,
      projectBlueprint: remote.projectBlueprint || local.projectBlueprint,
      agentSessions: remote.agentSessions || local.agentSessions,
      referenceFiles: remote.referenceFiles || local.referenceFiles
    })
  })
  return Array.from(map.values())
}

function upsertWorkflowRunRecord(records = [], run = {}) {
  if (!run?.id) return Array.isArray(records) ? records : []
  const next = [run, ...(Array.isArray(records) ? records.filter((item) => item?.id !== run.id) : [])]
  return next.slice(0, 30)
}

function workflowAnalysisDeepLink(runId) {
  const baseUrl = window.location.href.split('#')[0]
  return `${baseUrl}#${projectScopedRoute(`/workflow/analysis/${encodeURIComponent(runId)}`, workflowProjectIdForRun(runId))}`
}

function openWorkflowAnalysisTab(runId) {
  const url = workflowAnalysisDeepLink(runId)
  const opened = window.open(url, '_blank')
  if (opened) opened.opener = null
  if (!opened) {
    window.location.hash = projectScopedRoute(`/workflow/analysis/${encodeURIComponent(runId)}`, workflowProjectIdForRun(runId))
    restoreWorkflowRouteFromUrl()
  }
}

function syncWorkflowAnalysisRoute(runId, mode = 'push') {
  if (typeof window === 'undefined' || !runId) return
  const route = `#${projectScopedRoute(`/workflow/analysis/${encodeURIComponent(runId)}`, workflowProjectIdForRun(runId))}`
  if (window.location.hash === route) return
  const nextUrl = `${window.location.pathname}${window.location.search}${route}`
  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl)
  } else {
    window.history.pushState(null, '', nextUrl)
  }
  refreshCurrentLocationHash()
}

function workflowProjectIdForRun(runId) {
  const run = (state.workflowRuns || []).find((item) => item.id === runId)
  return run?.projectId || state.currentProjectId
}

function currentWorkflowAnalysisDeepLinkRunId(hash = window.location.hash || '') {
  const projectRoute = parseProjectScopedHash(hash)
  const match = projectRoute?.route
    ? projectRoute.route.match(/^\/workflow\/analysis\/([^/?#]+)/)
    : String(hash || '').match(/^#\/workflow\/analysis\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function isWorkflowAnalysisRouteActive(hash = window.location.hash || '') {
  return Boolean(currentWorkflowAnalysisDeepLinkRunId(hash))
}

function restoreWorkflowDeepLinkFromCurrentHashSoon() {
  if (typeof window === 'undefined') return
  const runId = currentWorkflowAnalysisDeepLinkRunId()
  if (!runId) return
  window.setTimeout(() => {
    if (currentWorkflowAnalysisDeepLinkRunId() !== runId) return
    ensureWorkflowDeepLinkRouteState()
    restoreWorkflowAnalysisFromUrl(parseProjectScopedHash(window.location.hash))
  }, 0)
}

function ensureWorkflowDeepLinkRouteState() {
  if (typeof window === 'undefined') return false
  const runId = currentWorkflowAnalysisDeepLinkRunId()
  if (!runId) return false
  const projectRoute = parseProjectScopedHash(window.location.hash)
  if (projectRoute?.projectId) applyProjectIdFromRoute(projectRoute.projectId)
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  workflowCanvasLoading.value = !workflowAnalysisResult.value
  workflowAgentNodeId.value = workflowAgentNodeId.value || 'analysis'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  return true
}

function stopWorkflowAnalysisDeepLinkPolling() {
  if (workflowAnalysisDeepLinkTimer) {
    window.clearInterval(workflowAnalysisDeepLinkTimer)
    workflowAnalysisDeepLinkTimer = null
  }
}

function startWorkflowAnalysisDeepLinkPolling(runId) {
  stopWorkflowAnalysisDeepLinkPolling()
  let attempts = 0
  let failedLoads = 0
  workflowAnalysisDeepLinkTimer = window.setInterval(async () => {
    attempts += 1
    const result = await api.workspace.load(state.apiConfig)
    if (!result.ok || !result.data) {
      failedLoads += 1
      if (failedLoads >= WORKFLOW_ANALYSIS_POLL_MAX_FAILED_LOADS) {
        failWorkflowAnalysisDeepLink(runId, result.message || result.error || '无法获取分析结果，请检查后端服务是否正常。')
      }
      return
    }
    failedLoads = 0
    state.workflowRuns = mergeById(state.workflowRuns, result.data.workflowRuns || [])
    const run = (state.workflowRuns || []).find((item) => item.id === runId)
    if (!run) {
      if (attempts >= WORKFLOW_ANALYSIS_POLL_MAX_ATTEMPTS) {
        failWorkflowAnalysisDeepLink(runId, '后端分析超时：一直没有找到对应的分析记录，请返回分析页后重试。')
      }
      return
    }
    if (run.documentAnalysis?.canvas || run.hasDocumentAnalysisDetail || run.documentAnalysisSummary?.hasCanvas || run.status !== 'analyzing') {
      stopWorkflowAnalysisDeepLinkPolling()
      await loadWorkflowRunDetail(runId, { fallbackRun: run })
      return
    }
    if (attempts >= WORKFLOW_ANALYSIS_POLL_MAX_ATTEMPTS) {
      failWorkflowAnalysisDeepLink(runId, '后端分析超时：分析任务长时间没有返回结果，请稍后重试或检查模型配置。')
    }
  }, 2000)
}

async function loadWorkflowRunDetail(runId, options = {}) {
  const fallbackRun = options.fallbackRun || (state.workflowRuns || []).find((item) => item.id === runId) || null
  try {
    const result = await api.workspace.getWorkflowRun(state.apiConfig, runId)
    if (result.ok && result.data?.run) {
      const run = result.data.run
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, run)
      if (run.documentAnalysis?.canvas) {
        openWorkflowCanvasRun(run)
        return true
      }
      if (run.status === 'analyzing') {
        state.activeWorkflowRun = run
        workflowCanvasLoading.value = true
        return false
      }
    }
    if (fallbackRun?.documentAnalysis?.canvas) {
      openWorkflowCanvasRun(fallbackRun)
      return true
    }
    if (fallbackRun?.status === 'analyzing') {
      state.activeWorkflowRun = fallbackRun
      workflowCanvasLoading.value = true
      return false
    }
    failWorkflowAnalysisDeepLink(runId, result.message || '没有获取到完整分析画布，请返回分析页后重试。')
    return false
  } catch (error) {
    if (fallbackRun?.documentAnalysis?.canvas) {
      openWorkflowCanvasRun(fallbackRun)
      return true
    }
    failWorkflowAnalysisDeepLink(runId, error.message || '获取完整分析画布失败，请检查后端服务。')
    return false
  }
}

function failWorkflowAnalysisDeepLink(runId, message = '无法获取分析结果，请检查后端服务。') {
  stopWorkflowAnalysisDeepLinkPolling()
  const failureAnalysis = buildWorkflowAnalysisFailureResult(message)
  const currentRun = (state.workflowRuns || []).find((item) => item.id === runId) || state.activeWorkflowRun || {}
  const failedRun = {
    ...currentRun,
    id: currentRun.id || runId,
    workflowName: currentRun.workflowName || '需求分析画布',
    documentAnalysis: failureAnalysis,
    status: 'failed',
    updatedAt: new Date().toISOString()
  }
  state.activeWorkflowRun = failedRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, failedRun)
  workflowCanvasLoading.value = false
  workflowAnalysisResult.value = failureAnalysis
  workflowAgentNodeId.value = 'analysis'
  workflowFullscreenNodeId.value = ''
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  setStatus(skillWorkbenchStatus, 'failed', message)
}

function restoreWorkflowRouteFromUrl(projectRoute = null) {
  const route = projectRoute?.route || ''
  if (projectRoute?.projectId) applyProjectIdFromRoute(projectRoute.projectId)
  if (window.location.hash === '#/workflow' || route === '/workflow' || route === '/design') {
    activeView.value = 'workflow'
    workflowRoute.value = 'entry'
    workflowAgentOpen.value = false
    workflowFullscreenNodeId.value = ''
    stopWorkflowAnalysisDeepLinkPolling()
    return true
  }
  return restoreWorkflowAnalysisFromUrl(projectRoute)
}

function restoreFactoryRouteFromUrl(projectRoute = null) {
  const route = projectRoute?.route || ''
  if (projectRoute?.projectId) applyProjectIdFromRoute(projectRoute.projectId)
  if (window.location.hash === '#/factory/capture' || route === '/factory/capture') {
    activeView.value = 'factory'
    factoryHomeTab.value = 'url-code'
    openCaptureDetail()
    resumePendingCaptureTask()
    return true
  }
  const match = route
    ? route.match(/^\/(?:factory\/restored|assets)\/([^/?#]+)(?:\/preview)?/)
    : window.location.hash.match(/^#\/factory\/restored\/([^/?#]+)/)
  const pageId = match?.[1] ? decodeURIComponent(match[1]) : ''
  if (!pageId) return false
  activeView.value = 'factory'
  state.currentFactoryRoute = 'standalone-preview'
  state.selectedRestoredPageId = pageId
  void loadStandalonePreviewRoute(pageId)
  return true
}

function restoreWorkflowAnalysisFromUrl(projectRoute = parseProjectScopedHash(window.location.hash)) {
  if (projectRoute?.projectId) applyProjectIdFromRoute(projectRoute.projectId)
  const runId = currentWorkflowAnalysisDeepLinkRunId()
  if (!runId) return false
  ensureWorkflowDeepLinkRouteState()
  const run = (state.workflowRuns || []).find((item) => item.id === runId)
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  workflowCanvasLoading.value = true
  workflowAnalysisResult.value = run?.documentAnalysis?.canvas ? run.documentAnalysis : null
  workflowAgentNodeId.value = 'analysis'
  workflowFullscreenNodeId.value = ''
  void loadWorkflowRunDetail(runId, { fallbackRun: run }).then((loaded) => {
    if (currentWorkflowAnalysisDeepLinkRunId() !== runId) return
    if (!loaded && (!run || run.status === 'analyzing')) startWorkflowAnalysisDeepLinkPolling(runId)
  })
  return true
}

function returnToWorkflowEntry() {
  stopWorkflowAnalysisDeepLinkPolling()
  workflowRoute.value = 'entry'
  workflowAgentOpen.value = false
  workflowFullscreenNodeId.value = ''
  activeView.value = 'workflow'
  const projectRoute = parseProjectScopedHash(window.location.hash)
  if (window.location.hash.startsWith('#/workflow/analysis/') || projectRoute?.route?.startsWith('/workflow/analysis/')) {
    window.history.replaceState(null, '', projectScopedUrl(APP_PAGE_ROUTES.workflow))
  }
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  })
}

async function hydrateWorkspaceFromBackend() {
  const result = await api.workspace.load(state.apiConfig)
  if (!result.ok || !result.data) return
  const workflowDeepLinkRunId = currentWorkflowAnalysisDeepLinkRunId()
  const routeProjectId = parseProjectScopedHash(window.location.hash)?.projectId
  const backendUsers = result.data.users || []
  const backendProjects = result.data.projects || []
  const remoteMaterials = Array.isArray(result.data.materials) ? result.data.materials : []
  const remoteRestoredPages = Array.isArray(result.data.restoredPages) ? result.data.restoredPages : []
  const next = reconcileProjectSelection(normalizeWorkspaceState({
    ...state,
    currentUserId: result.data.currentUserId || state.currentUserId,
    currentProjectId: routeProjectId || result.data.currentProjectId || state.currentProjectId,
    users: backendUsers.length ? backendUsers : state.users,
    selectedAssetId: selectedAssetId.value,
    projects: backendProjects,
    assets: result.data.assets || [],
    skillRuns: result.data.skillRuns || [],
    knowledge: remoteMaterials.filter((item) => item.type === 'knowledge'),
    requirements: remoteMaterials.filter((item) => item.type === 'requirements'),
    competitors: remoteMaterials.filter((item) => item.type === 'competitors'),
    skills: result.data.skills || [],
    restoredPages: mergeById(state.restoredPages, remoteRestoredPages),
    workflowRuns: mergeWorkflowRunRecords(state.workflowRuns, result.data.workflowRuns || []),
    activeWorkflowRun: state.activeWorkflowRun || null
  }))
  state.currentUserId = next.currentUserId
  state.users = next.users
  state.projects = next.projects
  state.assets = next.assets
  state.skillRuns = next.skillRuns
  state.knowledge = next.knowledge
  state.requirements = next.requirements
  state.competitors = next.competitors
  state.skills = next.skills
  state.restoredPages = next.restoredPages
  state.workflowRuns = next.workflowRuns
  applyProjectSelection({
    currentProjectId: next.currentProjectId,
    activeWorkflowRun: next.activeWorkflowRun,
    selectedAssetId: next.selectedAssetId,
    selectedRestoredPageId: next.selectedRestoredPageId
  })
  if (workflowDeepLinkRunId) {
    restoreWorkflowAnalysisFromUrl(parseProjectScopedHash(window.location.hash))
    restoreWorkflowDeepLinkFromCurrentHashSoon()
    return
  }
  restoreWorkflowAnalysisFromUrl()
}

async function persistWorkspaceRun(runRecord) {
  const result = await api.workspace.createRun(state.apiConfig, runRecord)
  if (!result.ok || !result.data?.run) {
    throw new Error(result.message || '后端运行记录保存失败')
  }
  return result.data.run
}

async function persistWorkspaceAsset(asset) {
  const result = await api.workspace.createAsset(state.apiConfig, asset)
  if (!result.ok || !result.data?.asset) {
    throw new Error(result.message || '后端资产保存失败')
  }
  return result.data.asset
}

async function persistWorkspaceSkill(skill) {
  const isBackendSkill = /^skill-/.test(String(skill.id || ''))
  const result = isBackendSkill
    ? await api.workspace.updateSkill(state.apiConfig, skill.id, skill)
    : await api.workspace.saveSkill(state.apiConfig, {
        ...skill,
        id: ''
      })
  if (!result.ok || !result.data?.skill) {
    throw new Error(result.message || '后端 Skill 保存失败')
  }
  return result.data.skill
}

function factoryTaskDurationLabel(task = {}) {
  const durationMs = Number(task.durationMs || 0)
  if (durationMs > 0) return captureDurationLabel({ durationMs })
  if (task.startedAt && task.finishedAt) {
    return captureDurationLabel({ durationMs: new Date(task.finishedAt) - new Date(task.startedAt) })
  }
  if (task.startedAt && task.status === 'running') {
    return `${Math.max(1, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 1000))}s`
  }
  return '未开始'
}

function applyCaptureResult(capture, sourceLabel = '采集') {
  state.captureResult = capture
  state.generatedPageHtml = ''
  state.reactFiles = []
  selectedReactFile.value = ''
  state.selectedRestoredPageId = ''
  const designSource = designSourceFromCaptureResult(capture, {
    projectId: state.currentProjectId,
    origin: capture.raw?.source === 'web-snapshot-import' ? 'package' : 'url'
  })
  state.designSources = upsertDesignSource(state.designSources || [], designSource)
  const asset = {
    id: designSource.id,
    projectId: state.currentProjectId,
    type: 'web-snapshot',
    origin: designSource.origin,
    sourceUrl: designSource.sourceUrl,
    title: designSource.title,
    meta: `${designSource.origin === 'package' ? '网页快照包' : 'URL 网页快照'} · ${designSource.summary.layoutNodes} 个节点`,
    status: designSource.status,
    content: JSON.stringify(designSource, null, 2),
    designSource,
    createdAt: designSource.createdAt,
    versions: [{ at: designSource.createdAt, label: '初始快照' }],
    hiddenRunRecords: [
      {
        title: '网页快照生成',
        detail: `${sourceLabel}：${designSource.summary.layoutNodes} 个 DOM 节点、${designSource.summary.components} 个组件样本`,
        at: designSource.createdAt
      }
    ]
  }
  state.assets = upsertDesignSource(state.assets || [], asset)
  selectedAssetId.value = asset.id
  if (capture.designTokens) {
    state.palette = {
      ...state.palette,
      primary: capture.designTokens.primary || state.palette.primary,
      background: capture.designTokens.background || state.palette.background,
      surface: capture.designTokens.surface || state.palette.surface,
      text: capture.designTokens.text || state.palette.text,
      border: capture.designTokens.border || state.palette.border
    }
  }
  if (capture.websnap?.componentLibrary) {
    state.componentLibrary = capture.websnap.componentLibrary
  }
  const nodeCount = capture.raw?.layoutNodeCount || capture.layoutNodes?.length || 0
  const componentCount = capture.components?.length || 0
  Object.assign(captureTiming, {
    estimatedSeconds: capture.timing?.estimatedSeconds || captureTiming.estimatedSeconds,
    durationMs: capture.timing?.durationMs || capture.raw?.durationMs || captureTiming.durationMs
  })
  const isBlocked = capture.status === 'blocked'
  const captureSummary = capture.pages?.[0]?.summary || '目标网页暂时无法直接采集。'
  setStatus(
    captureStatus,
    isBlocked ? 'blocked' : 'success',
    isBlocked
      ? captureSummary
      : `${sourceLabel}完成：${nodeCount} 个 DOM 节点、${componentCount} 个组件样本${captureDurationLabel(capture.timing || capture.raw)}`,
    capture
  )
  const readiness = captureRestoreReadiness(capture)
  setStatus(
    pageGenerationStatus,
    'idle',
    readiness.canRestore ? `${sourceLabel}完成，可继续生成高保真 HTML` : `采集完成，但暂不能生成高保真 HTML：${readiness.reason}`
  )
  openCaptureDetail()
}

async function createBrowserSession() {
  if (!captureForm.url.trim()) {
    setStatus(browserSessionStatus, 'failed', '请先输入需要登录或采集的网页地址')
    return
  }
  setStatus(browserSessionStatus, 'loading', '正在打开授权浏览器...')
  const result = await api.capture.createBrowserSession(state.apiConfig, {
    projectId: state.currentProjectId,
    url: captureForm.url
  })
  const data = applyApiResult(browserSessionStatus, result, '授权浏览器打开失败')
  if (!data) return
  captureForm.sessionId = data.sessionId
  browserPreview.url = data.currentUrl || data.loginUrl || captureForm.url
  setStatus(
    browserSessionStatus,
    'success',
    '授权浏览器已创建。请在下方预览面板完成登录，登录后点击采集网页。',
    data
  )
  await refreshBrowserPreview()
  startBrowserPreviewPolling()
}

async function refreshBrowserPreview(options = {}) {
  if (!captureForm.sessionId) return
  if (!options.silent) setStatus(browserPreviewStatus, 'loading', '正在刷新授权浏览器画面...')
  const result = await api.capture.previewBrowserSession(state.apiConfig, {
    sessionId: captureForm.sessionId
  })
  const data = options.silent
    ? (result.ok ? result.data : null)
    : applyApiResult(browserPreviewStatus, result, '授权浏览器画面获取失败')
  if (!data) return
  browserPreview.screenshot = data.screenshot || ''
  browserPreview.url = data.url || browserPreview.url
  browserPreview.title = data.title || ''
}

async function runBrowserSessionAction(action = {}) {
  if (!captureForm.sessionId) {
    setStatus(browserPreviewStatus, 'failed', '请先打开授权浏览器')
    return
  }
  setStatus(browserPreviewStatus, 'loading', '正在操作授权浏览器...')
  const result = await api.capture.browserSessionAction(state.apiConfig, {
    sessionId: captureForm.sessionId,
    ...action
  })
  const data = applyApiResult(browserPreviewStatus, result, '授权浏览器操作失败')
  if (!data) return
  browserPreview.url = data.url || browserPreview.url
  await refreshBrowserPreview()
  return data
}

function navigateBrowserSession() {
  if (!browserPreview.url.trim()) return
  void runBrowserSessionAction({ type: 'navigate', url: browserPreview.url.trim() })
}

function typeIntoBrowserSession() {
  if (!browserPreview.inputText) return
  const text = browserPreview.inputText
  browserPreview.inputText = ''
  void runBrowserSessionAction({ type: 'type', text })
}

async function openManualBrowserAuthorization() {
  if (!captureForm.url.trim()) {
    setStatus(browserSessionStatus, 'failed', '请先输入需要登录或采集的网页地址')
    return
  }
  captureForm.authMode = 'browser'
  selectedCaptureRecoveryFlowId.value = 'remote-browser'
  await createBrowserSession()
}

async function captureAfterManualBrowserLogin() {
  captureForm.authMode = 'browser'
  selectedCaptureRecoveryFlowId.value = 'remote-browser'
  if (!captureForm.sessionId) {
    setStatus(browserSessionStatus, 'failed', '请先打开授权浏览器并完成登录')
    return
  }
  await runCaptureTask()
}

function clickBrowserPreview(event) {
  if (!browserPreview.screenshot) return
  const rect = event.currentTarget.getBoundingClientRect()
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 1440)
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 900)
  void runBrowserSessionAction({ type: 'click', x, y })
}

function scrollBrowserPreview(event) {
  if (!browserPreview.screenshot) return
  void runBrowserSessionAction({
    type: 'scroll',
    deltaX: Math.round(event.deltaX || 0),
    deltaY: Math.round(event.deltaY || 0)
  })
}

async function runCaptureTask() {
  if (captureAction.value.disabled) return
  openCaptureDetail()
  if (normalizedCaptureAuthMode.value === 'browser' && !captureForm.sessionId) {
    setStatus(captureStatus, 'failed', '请先打开授权浏览器并完成登录')
    return
  }
  const task = recordFactoryTask('capture', {
    title: '采集网页快照',
    sourceUrl: captureForm.url,
    message: snapshotCaptureStatusMessage(captureForm.authMode),
    estimatedLabel: captureLoadingView.value?.estimatedLabel
  })
  state.captureResult = null
  state.generatedPageHtml = ''
  state.reactFiles = []
  selectedReactFile.value = ''
  captureLoadingSeconds.value = 0
  Object.assign(captureTiming, { estimatedSeconds: 75, durationMs: 0 })
  setStatus(captureStatus, 'loading', snapshotCaptureStatusMessage(captureForm.authMode))
  try {
    const result = await api.capture.start(state.apiConfig, snapshotCapturePayload())
    const data = applyApiResult(captureStatus, result, '网页快照生成失败')
    if (data) {
      applyCaptureResult(data, '网页快照')
      const taskStatus = data.status === 'blocked' ? 'blocked' : 'success'
      updateFactoryTask(task.id, {
        status: taskStatus,
        message: data.pages?.[0]?.summary || (data.status === 'blocked' ? '目标网页暂时无法直接采集。' : '网页快照采集完成'),
        taskId: data.taskId || data.id || ''
      })
      if (data.status === 'blocked') {
        setStatus(captureStatus, 'blocked', data.pages?.[0]?.summary || '目标网页暂时无法直接采集。', data)
      } else if (data.status === 'partial') {
        setStatus(captureStatus, 'success', `${data.pages?.[0]?.summary || '已返回部分采集数据'}，仍可继续生成页面。`, data)
      }
    } else {
      updateFactoryTask(task.id, {
        status: 'failed',
        message: captureStatus.value.message,
        failureReason: captureStatus.value.message || '网页快照生成失败'
      })
    }
  } catch (error) {
    const message = error?.message || '网页快照生成失败，请稍后重试或上传网页快照包。'
    setStatus(captureStatus, 'failed', message)
    updateFactoryTask(task.id, {
      status: 'failed',
      message,
      failureReason: message
    })
  } finally {
    captureLoadingSeconds.value = Math.max(captureLoadingSeconds.value, 0)
  }
}

async function startCapture() {
  if (captureAction.value.disabled) return
  persistPendingCaptureTask()
}

async function parseAndGenerateFromUrl() {
  state.captureResult = null
  state.generatedPageHtml = ''
  state.reactFiles = []
  selectedReactFile.value = ''
  openCaptureDetail()
  setStatus(captureStatus, 'loading', snapshotCaptureStatusMessage(captureForm.authMode))
  setStatus(pageGenerationStatus, 'loading', '等待网页解析结果...')
  setStatus(generationStatus, 'loading', '等待页面生成后创建 Vue/Vite 代码包...')
  const result = await api.capture.start(state.apiConfig, snapshotCapturePayload())
  const data = applyApiResult(captureStatus, result, '网页快照生成失败')
  if (!data) return
  applyCaptureResult(data, '网页快照')
  if (data.status === 'partial' || !(data.raw?.layoutNodeCount || data.layoutNodes?.length)) {
    setStatus(pageGenerationStatus, 'failed', data.pages?.[0]?.summary || '目标网页没有拿到可还原 DOM 节点，无法生成高保真 HTML。')
    return
  }
  await generatePageFromCapture({ openPreview: false })
}

async function importWebsnapFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  setStatus(captureStatus, 'loading', '正在解析网页快照包...')
  try {
    const capture = await parseWebsnapFile(file)
    applyCaptureResult(capture, '网页快照包导入')
  } catch (error) {
    setStatus(captureStatus, 'failed', `网页快照包解析失败：${error.message}`)
  }
  event.target.value = ''
}

async function generatePageFromCapture(options = {}) {
  if (!state.captureResult) {
    setStatus(pageGenerationStatus, 'failed', '请先生成网页快照')
    return
  }
  const task = recordFactoryTask('generate', {
    title: options.taskTitle || '生成高保真 HTML',
    sourceUrl: state.captureResult?.url || state.captureResult?.pages?.[0]?.url || captureForm.url,
    message: '后端正在根据采集结果生成页面'
  })
  const shouldOpenPreview = options.openPreview !== false
  const previewWindow = shouldOpenPreview ? window.open(previewTaskUrl(task.id), '_blank') : null
  if (previewWindow) {
    writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlLoadingPage('页面生成中', '流程通正在根据网页快照生成完整页面，生成完成后会自动展示在这里。', {
      taskId: task.id,
      stepIndex: 0
    }))
    updateStaticHtmlPreviewUrl(previewWindow, task.id)
  }
  try {
    setStatus(pageGenerationStatus, 'loading', '正在根据采集结果生成页面...')
    const generatePayload = {
      projectId: state.currentProjectId,
      captureResult: state.captureResult,
      palette: state.palette,
      componentLibrary: state.componentLibrary,
      designRules,
      restoreMode: 'dom'
    }
    const result = await api.capture.generatePageStream(state.apiConfig, generatePayload, {
      timeoutMs: workflowAnalysisRequestTimeoutMs(),
      onEvent: (event) => {
        if (event.type === 'status' && event.data?.label) {
          setStatus(pageGenerationStatus, 'loading', event.data.label)
        }
        if (event.type === 'artifact' && event.data?.html) {
          state.generatedPageHtml = event.data.html
          state.reactFiles = []
          selectedReactFile.value = 'index.html'
          if (previewWindow && !previewWindow.closed) {
            writeStaticHtmlPreviewWindow(previewWindow, event.data.html)
            updateStaticHtmlPreviewUrl(previewWindow, task.id)
          }
        }
      }
    })
    const data = applyApiResult(pageGenerationStatus, result, '页面生成失败')
    if (data?.qualityGate && data.qualityGate.status === 'blocked') {
      const diagnosticReport = data.diagnosticReport || {}
      const reason = diagnosticReport.reasons?.[0] || data.message || '采集质量门禁未通过，不能生成正式还原资产。'
      setStatus(pageGenerationStatus, 'failed', `采集质量门禁未通过：${reason}`, {
        qualityGate: data.qualityGate,
        diagnosticReport
      })
      updateFactoryTask(task.id, {
        status: 'failed',
        message: pageGenerationStatus.value.message,
        failureReason: reason
      })
      if (previewWindow && !previewWindow.closed) {
        writeStaticHtmlPreviewWindow(previewWindow, `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>采集质量诊断</title><style>body{margin:0;font-family:"PingFang SC","Microsoft YaHei",Arial,sans-serif;background:#fff;color:#222529;display:grid;place-items:center;min-height:100vh}.box{width:min(680px,calc(100vw - 40px));border:1px solid #f0b429;border-radius:12px;background:#fffaf0;padding:28px;line-height:1.8}strong{display:block;font-size:24px;margin-bottom:10px}p{margin:0;color:#7a4d00}</style></head><body><main class="box"><strong>采集质量门禁未通过</strong><p>${reason}</p></main></body></html>`)
        updateStaticHtmlPreviewUrl(previewWindow, task.id)
      }
      return
    }
    if (data?.html) {
      state.generatedPageHtml = data.html
      state.reactFiles = []
      selectedReactFile.value = 'index.html'
      const visualVerification = data.visualVerification || buildCurrentVisualVerification()
      if (!data.restoredPage) {
        const reason = data?.message || '后端已返回 HTML，但没有返回已持久化的还原资产。请检查 /api/capture/generate-page 的 persistRestoredPage 配置。'
        setStatus(pageGenerationStatus, 'failed', reason)
        updateFactoryTask(task.id, {
          status: 'failed',
          message: pageGenerationStatus.value.message,
          failureReason: reason
        })
        if (previewWindow && !previewWindow.closed) {
          writeStaticHtmlPreviewWindow(previewWindow, `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>资产保存失败</title><style>body{margin:0;font-family:"PingFang SC","Microsoft YaHei",Arial,sans-serif;background:#fff;color:#222529;display:grid;place-items:center;min-height:100vh}.box{width:min(680px,calc(100vw - 40px));border:1px solid #ef4444;border-radius:12px;background:#fff7f7;padding:28px;line-height:1.8}strong{display:block;font-size:24px;margin-bottom:10px}p{margin:0;color:#7f1d1d}</style></head><body><main class="box"><strong>资产保存失败</strong><p>${reason}</p></main></body></html>`)
          updateStaticHtmlPreviewUrl(previewWindow, task.id)
        }
        return
      }
      const restoredPage = upsertRestoredPageFromBackend(data.restoredPage)
      setStatus(pageGenerationStatus, visualVerification.status === 'passed' ? 'success' : 'failed', `${data.summary || '页面生成成功'}；视觉验收${visualVerification.status === 'passed' ? '通过' : '未通过'}，平均相似度 ${visualVerification.summary?.averageScore || 0}%`)
      updateFactoryTask(task.id, {
        status: visualVerification.status === 'passed' ? 'success' : 'failed',
        message: pageGenerationStatus.value.message,
        failureReason: visualVerification.status === 'passed' ? '' : selectedVisualFailureReason(),
        taskId: data.taskId || restoredPage?.id || ''
      })
	      if (previewWindow && !previewWindow.closed) {
	        updateStaticHtmlPreviewUrl(previewWindow, projectScopedRoute(`/assets/${encodeURIComponent(restoredPage.id)}/preview`, restoredPage.projectId || state.currentProjectId))
	        writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlResultShell(data.html, restoredPage.title || '静态 HTML 还原结果', {
	          thumbnail: restoredPage.coverImage,
	          taskId: restoredPage.id,
	          assetId: restoredPage.id,
	          homeUrl: projectScopedRoute('/factory', restoredPage.projectId || state.currentProjectId),
	          convertUrl: projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview?action=convert-vue`, restoredPage.projectId || state.currentProjectId)
	        }))
	      } else if (shouldOpenPreview) {
        setStatus(pageGenerationStatus, visualVerification.status === 'passed' ? 'success' : 'failed', `${data.summary || '页面生成成功'}；浏览器拦截了新页面，可点击“打开完整页面”；视觉验收${visualVerification.status === 'passed' ? '通过' : '未通过'}，平均相似度 ${visualVerification.summary?.averageScore || 0}%`)
      }
      if (options.stayOnDetail !== true && restoredPage) {
        await openRestoredPageDetail(restoredPage.id)
      }
      return
    }
    if (pageGenerationStatus.value.status === 'loading') {
      setStatus(pageGenerationStatus, 'failed', data?.message || result.message || '页面生成失败，没有返回 HTML')
    }
    updateFactoryTask(task.id, {
      status: 'failed',
      message: pageGenerationStatus.value.message,
      failureReason: pageGenerationStatus.value.message || '页面生成失败，没有返回 HTML'
    })
  } catch (error) {
    setStatus(pageGenerationStatus, 'failed', `页面生成异常：${error.message || '未知错误'}`)
    updateFactoryTask(task.id, {
      status: 'failed',
      message: pageGenerationStatus.value.message,
      failureReason: error.message || '页面生成异常'
    })
  }
}

function generatedPageBlobUrl(html = state.generatedPageHtml) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  return URL.createObjectURL(blob)
}

function openGeneratedPage() {
  if (!state.generatedPageHtml) return
  showGeneratedPageFullPreview.value = true
}

function downloadGeneratedHtml() {
  const html = selectedRestoredStaticHtml.value || state.generatedPageHtml
  if (!html) return
  const link = document.createElement('a')
  link.href = generatedPageBlobUrl(html)
  link.download = 'generated-page.html'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function generateCodeFromCapture(options = {}) {
  if (!state.captureResult) {
    setStatus(generationStatus, 'failed', '请先生成网页快照')
    return
  }
  await generateReactCode()
}

async function convertRestoredPageToVue() {
  const page = selectedRestoredPage.value
  if (!page) {
    setStatus(generationStatus, 'failed', '请先生成或选择一个 HTML 还原页面')
    return
  }
  const task = recordFactoryTask('vue', {
    title: `转换 ${page.title || '还原页面'} 为 Vue`,
    sourceUrl: page.sourceUrl || '',
    restoredPageId: page.id,
    message: '正在把静态 HTML 拆成 Vue/Vite 源码'
  })
  setStatus(generationStatus, 'loading', '正在将 HTML 还原页转换为 Vue/Vite 源码...')
  const result = await api.generation.vueVite(state.apiConfig, {
    projectId: state.currentProjectId,
    captureResult: page.captureResult || state.captureResult || {
      title: page.title,
      url: page.sourceUrl,
      pages: [{ title: page.title, url: page.sourceUrl, screenshot: page.coverImage }]
    },
    html: page.html || state.generatedPageHtml,
    designRules,
    ...generationForm
  })
  const data = applyApiResult(generationStatus, result, 'Vue/Vite 代码生成失败')
  const files = data?.files || []
  if (!files.length) {
    setStatus(generationStatus, 'failed', data?.message || result.message || 'Vue/Vite 代码生成失败，没有返回源码文件')
    updateFactoryTask(task.id, {
      status: 'failed',
      message: generationStatus.value.message,
      failureReason: generationStatus.value.message || 'Vue/Vite 代码生成失败'
    })
    return
  }
  const nextPage = {
    ...page,
    codeFormat: 'vue',
    files,
    updatedAt: new Date().toISOString()
  }
  const saveResult = await api.workspace.createRestoredPage(state.apiConfig, nextPage)
  const saveData = applyApiResult(generationStatus, saveResult, 'Vue/Vite 源码保存失败')
  if (!saveData?.restoredPage) {
    updateFactoryTask(task.id, {
      status: 'failed',
      message: generationStatus.value.message,
      failureReason: generationStatus.value.message || 'Vue/Vite 源码保存失败'
    })
    return
  }
  const persistedPage = saveData.restoredPage
  const index = state.restoredPages.findIndex((item) => item.id === page.id)
  if (index >= 0) state.restoredPages.splice(index, 1, persistedPage)
  else state.restoredPages.unshift(persistedPage)
  state.reactFiles = files
  selectedReactFile.value = files[0]?.path || ''
  state.selectedRestoredPageId = persistedPage.id
  showRestoredSource.value = false
  setStatus(generationStatus, 'success', '已转换为 Vue/Vite 源码，可查看或下载')
  updateFactoryTask(task.id, {
    status: 'success',
    message: generationStatus.value.message,
    taskId: data?.taskId || persistedPage.id
  })
}

async function generateReactCode(options = {}) {
  if (!options.silent) setStatus(generationStatus, 'loading', '正在请求 Vue 代码生成服务...')
  const result = await api.generation.vueVite(state.apiConfig, {
    projectId: state.currentProjectId,
    captureResult: state.captureResult,
    designRules,
    ...generationForm
  })
  const data = applyApiResult(generationStatus, result, 'Vue/Vite 代码生成失败')
  if (data?.files) {
    state.reactFiles = data.files
    selectedReactFile.value = data.files[0]?.path || ''
    return
  }
  state.reactFiles = []
  selectedReactFile.value = ''
}

async function copySelectedReactFile() {
  if (!selectedReactContent.value) {
    setStatus(generationStatus, 'failed', '请先生成代码并选择文件')
    return
  }
  try {
    await navigator.clipboard.writeText(selectedReactContent.value)
    setStatus(generationStatus, 'success', `已复制 ${selectedReactFile.value || '当前文件'} 的代码`)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = selectedReactContent.value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
    setStatus(generationStatus, 'success', `已复制 ${selectedReactFile.value || '当前文件'} 的代码`)
  }
}

async function copySelectedRestoredFile() {
  if (!selectedRestoredFileContent.value) {
    setStatus(generationStatus, 'failed', '请先选择源码文件')
    return
  }
  try {
    await navigator.clipboard.writeText(selectedRestoredFileContent.value)
    setStatus(generationStatus, 'success', `已复制 ${selectedReactFile.value || '当前文件'} 的代码`)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = selectedRestoredFileContent.value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
    setStatus(generationStatus, 'success', `已复制 ${selectedReactFile.value || '当前文件'} 的代码`)
  }
}

async function regenerateReactCode() {
  setStatus(generationStatus, 'loading', '正在请求重新生成接口...')
  const result = await api.generation.regenerate(state.apiConfig, 'latest', {
    projectId: state.currentProjectId,
    notes: generationForm.notes,
    previousFiles: state.reactFiles
  })
  const data = applyApiResult(generationStatus, result, '重新生成失败')
  if (data?.files) state.reactFiles = data.files
}

async function transformStyle() {
  setStatus(styleStatus, 'loading', '正在请求风格转换服务...')
  const result = await api.style.transform(state.apiConfig, {
    projectId: state.currentProjectId,
    files: state.reactFiles,
    palette: state.palette,
    componentLibrary: state.componentLibrary,
    designRules,
    ...styleForm
  })
  const data = applyApiResult(styleStatus, result, '风格转换失败')
  if (data?.files) state.reactFiles = data.files
}

async function readJsonFile(event, type) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const json = JSON.parse(await file.text())
    if (type === 'palette') state.palette = { ...state.palette, ...json }
    if (type === 'components') state.componentLibrary = json
    setStatus(styleStatus, 'success', `${file.name} 已导入`)
  } catch (error) {
    setStatus(styleStatus, 'failed', `JSON 解析失败：${error.message}`)
  }
  event.target.value = ''
}

async function importKnowledgeFiles(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  setStatus(knowledgeStatus, 'loading', `正在导入 ${files.length} 个知识文件...`)
  const results = await importLocalDocuments(files, {
    projectId: state.currentProjectId,
    type: 'knowledge'
  })
  const documents = results.filter((result) => result.ok).map((result) => ({
    id: result.item.id,
    name: result.item.title,
    type: result.item.notes || '',
    content: result.item.content
  }))
  const failures = results.filter((result) => !result.ok)
  let importedCount = 0
  if (documents.length) {
    const result = await api.workspace.importDocumentMaterials(state.apiConfig, {
      projectId: state.currentProjectId,
      type: 'knowledge',
      documents
    })
    const data = applyApiResult(knowledgeStatus, result, '知识文件导入失败')
    if (!data?.materials) {
      event.target.value = ''
      return
    }
    importedCount = data.materials.length
    await refreshMaterialsFromBackend('knowledge')
    await refreshParseJobs()
  }
  if (failures.length) {
    setStatus(knowledgeStatus, importedCount ? 'success' : 'failed', `成功导入 ${importedCount} 个，失败 ${failures.length} 个`)
  } else {
    setStatus(knowledgeStatus, 'success', `成功导入 ${importedCount} 个知识文件`)
  }
  event.target.value = ''
}

async function knowledgeFromCode() {
  setStatus(knowledgeStatus, 'loading', '正在请求根据代码生成知识库...')
  const result = await api.knowledge.fromCode(state.apiConfig, {
    projectId: state.currentProjectId,
    files: state.reactFiles
  })
  const data = applyApiResult(knowledgeStatus, result, '生成知识库失败')
  if (data?.items) {
    state.knowledge.unshift(...data.items.map((item) => ({ ...item, projectId: item.projectId || state.currentProjectId })))
  }
}

async function searchKnowledgeOnline() {
  setStatus(knowledgeStatus, 'loading', '正在请求联网搜索服务...')
  const result = await api.knowledge.searchWeb(state.apiConfig, {
    projectId: state.currentProjectId,
    query: knowledgeSearch.value
  })
  const data = applyApiResult(knowledgeStatus, result, '联网搜索失败')
  if (data?.items) {
    state.knowledge.unshift(...data.items.map((item) => ({ ...item, projectId: item.projectId || state.currentProjectId })))
  }
}

async function importKnowledgeFromWebsite() {
  const url = websiteImportForm.url.trim()
  if (!url) {
    setStatus(knowledgeStatus, 'failed', '请先输入网站 URL')
    return
  }
  setStatus(knowledgeStatus, 'loading', '正在解析网站并生成知识条目...')
  const result = await api.workspace.importWebsiteMaterials(state.apiConfig, {
    projectId: state.currentProjectId,
    ...websiteImportForm,
    generateBlueprint: true,
    url
  })
  const data = applyApiResult(knowledgeStatus, result, '网站知识导入失败')
  if (data?.materials) {
    state.knowledge.unshift(...data.materials)
    if (data?.blueprintMaterials?.length) state.knowledge.unshift(...data.blueprintMaterials)
    if (data?.blueprintAsset) {
      const existingAssetIndex = state.assets.findIndex((asset) => asset.id === data.blueprintAsset.id)
      if (existingAssetIndex >= 0) state.assets.splice(existingAssetIndex, 1, data.blueprintAsset)
      else state.assets.unshift(data.blueprintAsset)
      selectedAssetId.value = data.blueprintAsset.id
    }
    if (data?.prototypeAsset) {
      const existingPrototypeIndex = state.assets.findIndex((asset) => asset.id === data.prototypeAsset.id)
      if (existingPrototypeIndex >= 0) state.assets.splice(existingPrototypeIndex, 1, data.prototypeAsset)
      else state.assets.unshift(data.prototypeAsset)
    }
    await refreshMaterialsFromBackend('knowledge')
    await refreshParseJobs()
    const parseJob = data?.parseJob
    const blueprintCopy = data?.blueprintAsset ? '，已生成项目蓝图' : ''
    const prototypeCopy = data?.prototypeAsset ? '、交互 Demo' : ''
    setStatus(
      knowledgeStatus,
      'success',
      `已导入 ${data.materials.length} 条网站知识${data?.blueprintMaterials?.length ? `、${data.blueprintMaterials.length} 条蓝图知识` : ''}${blueprintCopy}${prototypeCopy}：${data.summary?.importType || '网站页面'}${parseJob ? `，解析任务 ${parseJob.status}` : ''}`
    )
  }
}

async function submitWebsiteImportAndClose() {
  if (!websiteImportForm.url.trim()) {
    setStatus(knowledgeStatus, 'failed', '请先输入网站 URL')
    return
  }
  closeMaterialTool()
  await importKnowledgeFromWebsite()
}

async function refreshParseJobs() {
  const result = await api.workspace.listParseJobs(state.apiConfig, {
    projectId: state.currentProjectId
  })
  if (result.ok && Array.isArray(result.data?.jobs)) {
    knowledgeParseJobs.value = result.data.jobs
  }
}

async function runKnowledgeRetrievalTest() {
  const query = knowledgeRetrievalForm.query.trim()
  if (!query) {
    setStatus(knowledgeStatus, 'failed', '请输入召回测试问题')
    return
  }
  setStatus(knowledgeStatus, 'loading', '正在测试知识库召回...')
  const result = await api.workspace.searchMaterials(state.apiConfig, {
    projectId: state.currentProjectId,
    type: 'knowledge',
    query,
    roleScope: knowledgeRetrievalForm.roleScope === 'all' ? '' : knowledgeRetrievalForm.roleScope,
    limit: 6
  })
  const data = applyApiResult(knowledgeStatus, result, '知识库召回测试失败')
  if (Array.isArray(data?.results)) {
    knowledgeRetrievalResults.value = data.results
    setStatus(knowledgeStatus, data.results.length ? 'success' : 'failed', data.results.length ? `命中 ${data.results.length} 条知识片段` : '未命中相关知识片段')
  }
}

function importRequirementFiles(event) {
  const files = Array.from(event.target.files || [])
  files.forEach((file) => {
    state.requirements.unshift({
      id: crypto.randomUUID(),
      projectId: state.currentProjectId,
      title: file.name,
      meta: `${file.name.split('.').pop()?.toUpperCase()} · v1.0`,
      status: '待解析'
    })
  })
  setStatus(requirementStatus, 'success', `已上传 ${files.length} 个需求文档，AI 解析待接入`)
  event.target.value = ''
}

async function generateRequirementFromDocs() {
  setStatus(requirementStatus, 'loading', '正在请求 PRD 生成服务...')
  const result = await api.requirements.generatePrd(state.apiConfig, {
    projectId: state.currentProjectId,
    requirements: currentRequirements.value,
    knowledge: currentKnowledge.value
  })
  const data = applyApiResult(requirementStatus, result, 'PRD 生成失败')
  if (data?.document) state.requirements.unshift({ ...data.document, projectId: data.document.projectId || state.currentProjectId })
}

function addCompetitor() {
  if (!competitorForm.name || !competitorForm.url) {
    setStatus(competitorStatus, 'failed', '请填写竞品名称和网址')
    return
  }
  state.competitors.unshift({
    id: crypto.randomUUID(),
    projectId: state.currentProjectId,
    title: competitorForm.name,
    meta: competitorForm.url,
    status: '待监控',
    notes: competitorForm.notes
  })
  setStatus(competitorStatus, 'success', '竞品已添加')
}

async function checkCompetitor() {
  const competitor = currentCompetitors.value[0]
  if (!competitor) {
    setStatus(competitorStatus, 'failed', '请先添加竞品')
    return
  }
  setStatus(competitorStatus, 'loading', '正在请求竞品监控服务...')
  const result = await api.competitors.check(state.apiConfig, competitor.id, competitor)
  const data = applyApiResult(competitorStatus, result, '竞品监控失败')
  if (data?.record) state.competitors.unshift({ ...data.record, projectId: data.record.projectId || state.currentProjectId })
}

async function askPmQuestion() {
  setStatus(pmStatus, 'loading', '正在请求 PM Skill 提问...')
  const result = await api.pm.question(state.apiConfig, buildSkillPayload(pmForm.skill, pmForm.answer))
  const data = applyApiResult(pmStatus, result, 'PM 提问失败')
  pmResult.value = data?.question || '接口未配置：后续会根据选择的 PM Skill、知识库、历史需求和竞品记录生成追问。'
}

async function generatePmPrd() {
  setStatus(pmStatus, 'loading', '正在请求 PM PRD 生成...')
  const result = await api.pm.generatePrd(state.apiConfig, buildSkillPayload(pmForm.skill, pmForm.answer))
  const data = applyApiResult(pmStatus, result, 'PM PRD 生成失败')
  pmResult.value = data?.content || `# ${pmForm.skill}\n\n接口未配置，当前仅保留 PRD 输出槽位。\n\n## 待接入\n- 知识库检索\n- 历史需求模板\n- AI 产品需求生成\n`
  if (data?.content) {
    state.requirements.unshift({ id: crypto.randomUUID(), projectId: state.currentProjectId, title: `${pmForm.skill} PRD`, meta: 'AI 生成 · v1.0', status: '已生成' })
  }
}

async function askUxQuestion() {
  setStatus(uxStatus, 'loading', '正在请求 UX Skill 提问...')
  const result = await api.ux.question(state.apiConfig, buildSkillPayload(uxForm.skill, uxForm.answer))
  const data = applyApiResult(uxStatus, result, 'UX 提问失败')
  uxResult.value = data?.question || '接口未配置：后续会根据 UX Skill 精准追问用户、目标、路径、约束和参考代码。'
}

async function generateUxOptions() {
  setStatus(uxStatus, 'loading', '正在请求 3 个 UX 方案...')
  const result = await api.ux.generateOptions(state.apiConfig, buildSkillPayload(uxForm.skill, uxForm.answer))
  const data = applyApiResult(uxStatus, result, 'UX 方案生成失败')
  uxResult.value = data?.content || `# ${uxForm.skill}\n\n接口未配置，当前保留三方案输出槽位。\n\n## 方案 A\n偏效率，强调任务流。\n\n## 方案 B\n偏信息组织，强调可扩展结构。\n\n## 方案 C\n偏视觉表达，强调高保真预览。\n`
  if (!data) {
    state.vueFiles = createVueViteFiles({ title: `${uxForm.skill} Vue 预览`, palette: state.palette })
  }
}

function buildSkillPayload(skill, answer) {
  return {
    projectId: state.currentProjectId,
    skill,
    answer,
    knowledge: currentKnowledge.value,
    requirements: currentRequirements.value,
    competitors: currentCompetitors.value,
    files: state.reactFiles,
    palette: state.palette
  }
}

function textDraft(skill) {
  const normalized = normalizeSkill({
    ...skill,
    visibility: skill.visibility || (skill.source === 'system' ? 'global' : 'project'),
    projectId: skill.projectId || state.currentProjectId
  })
  return {
    ...normalized,
    inputFields: [...(normalized.inputFields || [])],
    knowledgeScopeConfig: {
      mode: normalized.knowledgeScopeConfig?.mode || 'current-project',
      projectIds: [...(normalized.knowledgeScopeConfig?.projectIds || [])],
      itemIds: [...(normalized.knowledgeScopeConfig?.itemIds || [])],
      sourceTypes: [...(normalized.knowledgeScopeConfig?.sourceTypes || ['knowledge', 'requirements', 'competitors', 'assets'])]
    },
    applicableScenariosText: (normalized.applicableScenarios || []).join('\n'),
    requiredInputsText: (normalized.requiredInputs || []).join('\n'),
    knowledgeScopesText: (normalized.knowledgeScopes || []).join('\n'),
    stepsText: (normalized.steps || []).join('\n'),
    followUpRulesText: (normalized.followUpRules || []).join('\n'),
    qualityChecksText: (normalized.qualityChecks || []).join('\n')
  }
}

function draftFromText() {
  const draft = skillEditor.draft
  return {
    ...draft,
    source: draft.source === 'system' ? 'user' : draft.source,
    id: draft.source === 'system' ? crypto.randomUUID() : draft.id,
    status: draft.status === 'pending-review' ? 'active' : draft.status,
    visibility: draft.visibility || 'project',
    projectId: (draft.visibility || 'project') === 'project' ? (draft.projectId || state.currentProjectId) : '',
    inputFields: draft.inputFields || [],
    knowledgeScopeConfig: draft.knowledgeScopeConfig,
    applicableScenarios: draft.applicableScenariosText,
    requiredInputs: draft.requiredInputsText,
    knowledgeScopes: draft.knowledgeScopesText,
    steps: draft.stepsText,
    followUpRules: draft.followUpRulesText,
    qualityChecks: draft.qualityChecksText
  }
}

function startCreateSkill() {
  const base = {
    id: crypto.randomUUID(),
    name: '我的新 Skill',
    description: '',
    category: '自定义',
    source: 'user',
    visibility: 'project',
    projectId: state.currentProjectId,
    status: 'active',
    inputFields: [
      {
        id: crypto.randomUUID(),
        label: '原始需求',
        type: 'textarea',
        required: true,
        placeholder: '描述你希望 AI 处理的需求或设计任务',
        helpText: '',
        options: [],
        defaultValue: ''
      }
    ],
    knowledgeScopeConfig: {
      mode: 'current-project',
      projectIds: [],
      itemIds: [],
      sourceTypes: ['knowledge', 'requirements', 'competitors', 'assets']
    },
    applicableScenarios: [],
    requiredInputs: [],
    knowledgeScopes: [],
    steps: [],
    followUpRules: [],
    outputFormat: '',
    qualityChecks: []
  }
  skillEditor.activeId = base.id
  skillEditor.draft = textDraft(base)
  skillEditor.markdown = skillToMarkdown(base)
}

function addSkillInputField() {
  if (!skillEditor.draft) return
  skillEditor.draft.inputFields ||= []
  skillEditor.draft.inputFields.push({
    id: crypto.randomUUID(),
    label: '新字段',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    options: [],
    defaultValue: ''
  })
}

function removeSkillInputField(fieldId) {
  if (!skillEditor.draft) return
  skillEditor.draft.inputFields = (skillEditor.draft.inputFields || []).filter((field) => field.id !== fieldId)
}

function fieldOptionsText(field) {
  return (field.options || []).join('\n')
}

function updateFieldOptions(field, value) {
  field.options = value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
}

function toggleScopeType(type) {
  if (!skillEditor.draft) return
  skillEditor.draft.knowledgeScopeConfig ||= {
    mode: 'current-project',
    projectIds: [],
    itemIds: [],
    sourceTypes: []
  }
  const selected = new Set(skillEditor.draft.knowledgeScopeConfig.sourceTypes || [])
  if (selected.has(type)) selected.delete(type)
  else selected.add(type)
  skillEditor.draft.knowledgeScopeConfig.sourceTypes = [...selected]
}

function editSkill(skill) {
  const editable = skill.source === 'system' ? { ...skill, id: crypto.randomUUID(), name: `${skill.name} 副本`, source: 'user' } : skill
  skillEditor.activeId = skill.id
  skillEditor.draft = textDraft(editable)
  skillEditor.markdown = skillToMarkdown(editable)
}

async function importSkillDraft() {
  if (!skillImportForm.url && !skillImportForm.raw.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请粘贴链接或 Markdown 内容')
    return
  }
  const markdownSkill = skillImportForm.raw.trim() ? markdownToSkill(skillImportForm.raw) : null
  const result = await api.skills.importDraft(state.apiConfig, {
    url: skillImportForm.url,
    name: markdownSkill?.name,
    raw: skillImportForm.raw
  })
  const data = applyApiResult(skillWorkbenchStatus, result, '外部导入服务未配置，已保存为本地待审核草稿')
  const draft = {
    ...(markdownSkill || {
      id: crypto.randomUUID(),
      name: '外部导入 Skill 草稿',
      description: '从外部链接导入的待审核 Skill。',
      category: '自定义',
      applicableScenarios: ['待审核后补充'],
      requiredInputs: ['待审核后补充'],
      knowledgeScopes: ['待审核后补充'],
      steps: ['待审核后补充'],
      outputFormat: '待审核后补充',
      qualityChecks: ['不得执行外部代码']
    }),
    id: data?.draft?.id || crypto.randomUUID(),
    source: 'user',
    visibility: 'project',
    projectId: state.currentProjectId,
    status: 'pending-review',
    sourceUrl: skillImportForm.url
  }
  state.skills.unshift(draft)
  editSkill(draft)
  setStatus(skillWorkbenchStatus, 'success', '已导入为待审核草稿，保存前请检查内容和风险')
}

async function saveSkillDraft() {
  if (!skillEditor.draft) return
  const source = skillEditor.mode === 'markdown' ? markdownToSkill(skillEditor.markdown) : draftFromText()
  const visibility = source.visibility || skillEditor.draft.visibility || 'project'
  const skill = normalizeSkill({
    ...source,
    id: source.id || skillEditor.draft.id || crypto.randomUUID(),
    source: 'user',
    status: 'active',
    visibility,
    projectId: visibility === 'global' ? '' : (source.projectId || state.currentProjectId)
  })
  const validation = validateSkill(skill)
  if (!validation.ok) {
    setStatus(skillWorkbenchStatus, 'failed', `Skill 缺失字段：${validation.missing.join('、')}`)
    return
  }
  try {
    setStatus(skillWorkbenchStatus, 'loading', '正在同步 Skill 到后端')
    const persistedSkill = normalizeSkill(await persistWorkspaceSkill(skill))
    const existingIndex = state.skills.findIndex((item) => item.id === persistedSkill.id || item.id === skill.id)
    if (existingIndex >= 0) state.skills.splice(existingIndex, 1, persistedSkill)
    else state.skills.unshift(persistedSkill)
    workbenchForm.selectedSkillId = persistedSkill.id
    skillEditor.activeId = persistedSkill.id
    skillEditor.draft = textDraft(persistedSkill)
    skillEditor.markdown = skillToMarkdown(persistedSkill)
    setStatus(skillWorkbenchStatus, 'success', `Skill 已保存，后端 ID：${persistedSkill.id}`)
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', `Skill 保存失败：${error.message || '后端未返回有效结果'}`)
  }
}

function syncWorkflowDraftFromRun() {
  Object.keys(workflowStepDraft).forEach((key) => delete workflowStepDraft[key])
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) {
    workflowStepOutput.value = ''
    workflowStepChallenge.value = ''
    return
  }
  Object.assign(workflowStepDraft, activeWorkflowRun.value.stepInputs[activeWorkflowStep.value.id] || {})
  workflowStepOutput.value =
    activeWorkflowRun.value.stepDraftOutputs?.[activeWorkflowStep.value.id] ||
    activeWorkflowRun.value.stepOutputs?.[activeWorkflowStep.value.id] ||
    ''
  workflowStepChallenge.value = ''
}

function persistWorkflowStepInput() {
  if (!state.activeWorkflowRun || !activeWorkflowStep.value) return
  state.activeWorkflowRun.stepInputs[activeWorkflowStep.value.id] = { ...workflowStepDraft }
}

function currentWorkflowDocuments() {
  return workflowForm.documents.map((doc) => ({
    name: doc.name,
    status: doc.status,
    text: doc.text || ''
  }))
}

function attachProjectBlueprint() {
  if (!state.activeWorkflowRun) return null
  const blueprint = buildProjectBlueprint({
    project: currentProject.value || {},
    input: workflowForm.input || state.activeWorkflowRun.input || '',
    documents: currentWorkflowDocuments()
  })
  state.activeWorkflowRun.projectBlueprint = blueprint
  if (!activeDemoScreenId.value && blueprint.demoScreens?.length) {
    activeDemoScreenId.value = blueprint.demoScreens[0].id
  }
  blueprintDemoHtml.value = buildBlueprintDemoHtml(blueprint, {
    ...blueprintDemoForm,
    revision: blueprintDemoRevision.value
  })
  return blueprint
}

async function importWorkflowRequirementFiles(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  setStatus(skillWorkbenchStatus, 'loading', '正在读取需求文档...')
  const localDocs = []
  for (const file of files) {
    try {
      const text = await extractDocumentText(file)
      localDocs.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || file.name.split('.').pop()?.toUpperCase() || 'FILE',
        status: text ? '已读取' : '待后端解析',
        text
      })
    } catch (error) {
      localDocs.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'FILE',
        status: '读取失败',
        text: `文件 ${file.name} 读取失败：${error.message}`
      })
    }
  }
  let docs = localDocs
  const uploadResult = await api.uploads.documents(state.apiConfig, {
    projectId: state.currentProjectId,
    documents: localDocs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      content: doc.text
    }))
  })
  if (uploadResult.ok && Array.isArray(uploadResult.data?.documents)) {
    docs = uploadResult.data.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      status: doc.status === 'parsed' ? '已读取' : '读取失败',
      text: doc.text || doc.reason || '',
      recoveryActions: doc.recoveryActions || []
    }))
  }
  workflowForm.documents.push(...docs)
  const readableText = docs
    .filter((doc) => doc.status === '已读取' && doc.text)
    .map((doc) => `【上传文档：${doc.name}】\n${doc.text}`)
    .join('\n\n')
  if (readableText) {
    workflowForm.input = workflowForm.input.trim()
      ? `${workflowForm.input.trim()}\n\n${readableText}`
      : readableText
  }
  const isPodcastor = docs.some((doc) => /podcastor(?:\.ai)?/i.test(`${doc.name}\n${doc.text}`))
  if (isPodcastor) {
    ensurePodcastorProject()
    savePodcastorRequirementDocs(docs)
    workflowForm.selectedWorkflowId = 'podcastor-product-flow'
  }
  const failedCount = docs.filter((doc) => doc.status !== '已读取').length
  const message = isPodcastor
    ? `已识别 Podcastor.ai 文档，已切换项目并进入 Podcastor 产品体验流`
    : failedCount
      ? `已加入 ${docs.length} 个文档，其中 ${failedCount} 个需要后端深度解析`
      : `已读取 ${docs.length} 个文档，请点击“分析文档”生成初步架构`
  setStatus(
    skillWorkbenchStatus,
    'success',
    message
  )
  event.target.value = ''
}

function clearWorkflowRequirementFiles() {
  workflowForm.documents = []
  workflowForm.input = workflowForm.input
    .split(/\n{2,}/)
    .filter((block) => !/^【上传文档：/.test(block.trim()))
    .join('\n\n')
    .trim()
  state.activeWorkflowRun = null
  workflowAnalysisResult.value = null
  workflowRoute.value = 'entry'
  workflowAgentNodeId.value = ''
  workflowFullscreenNodeId.value = ''
  activeDemoScreenId.value = ''
  workflowBlueprintTab.value = 'profile'
  Object.keys(workflowStepDraft).forEach((key) => delete workflowStepDraft[key])
  workflowStepOutput.value = ''
  workflowStepChallenge.value = ''
  blueprintDemoHtml.value = ''
  blueprintDemoRevision.value = 1
  showBlueprintDemoFullPreview.value = false
  if (workflowFileInput.value) workflowFileInput.value.value = ''
  setStatus(skillWorkbenchStatus, 'success', '已清除上传文件，项目蓝图和下方分析资料已清空')
}

function buildWorkflowAnalysisFailureResult(message = '文档分析失败，请检查后端服务') {
  const detail = message || '后端没有返回可用的 blueprint，画布已停留在失败恢复态。'
  return {
    summary: { parsed: 0, failed: workflowForm.documents.length || 1 },
    status: 'failed',
    canvas: {
      nodes: [
        {
          id: 'analysis',
          title: '分析失败',
          summary: detail,
          content: [
            '后端没有返回可用的需求分析结果，当前输入和上传文档已保留。',
            '可以点击“重新分析文档”再试一次，或返回分析页调整输入后重新提交。'
          ],
          x: 120,
          y: 160,
          width: 420,
          height: 260,
          loading: false,
          agentScope: '文档分析失败恢复',
          quickActions: ['重新分析文档', '返回分析页调整输入'],
          detailSections: [
            { title: '失败原因', items: [detail] },
            { title: '恢复动作', items: ['重新分析文档', '返回分析页调整输入'] }
          ]
        }
      ],
      edges: [],
      orderedTabs: [{ key: 'analysis', label: '分析失败' }]
    },
    qualityGate: {
      score: 0,
      checks: [
        {
          id: 'analysis-result',
          label: '后端分析结果',
          passed: false,
          severity: 'blocking',
          detail,
          repairSuggestion: '重新分析文档或返回分析页调整输入。'
        }
      ]
    }
  }
}

function workflowAnalysisRequestTimeoutMs() {
  const modelTimeoutMs = Number(modelSettingsForm.timeoutMs) || 60000
  return Math.max(90000, modelTimeoutMs + 30000)
}

function imageToHtmlRequestTimeoutMs() {
  const modelTimeoutMs = Number(modelSettingsForm.timeoutMs) || 60000
  return Math.max(300000, modelTimeoutMs + 120000)
}

function workflowAgentRequestTimeoutMs() {
  const modelTimeoutMs = Number(modelSettingsForm.timeoutMs) || 60000
  return Math.max(90000, modelTimeoutMs + 30000)
}

function workflowAgentFailedMessage(result = {}) {
  if (result?.data?.error?.message) return result.data.error.message
  if (result?.data?.message) return result.data.message
  return result?.message || result?.error || '后端响应缺少 assistantMessage'
}

function isWorkflowAgentNetworkFailure(result = {}) {
  const message = workflowAgentFailedMessage(result)
  return /Failed to fetch|NetworkError|Load failed|网络请求失败/i.test(String(message || ''))
}

function workflowAgentFailureView(result = {}) {
  const message = workflowAgentFailedMessage(result) || '后端响应缺少 assistantMessage'
  if (isWorkflowAgentNetworkFailure(result)) {
    return {
      content: '前端没有连到后端 API 服务，请确认前后端启动正常后重试。',
      message,
      code: 'AGENT_API_UNREACHABLE',
      recoveryActions: ['重试', '确认 `npm run dev:all` 正在运行', '检查 5288/5299 端口']
    }
  }
  return {
    content: '后端没有返回 Agent 结果，请检查模型配置或稍后重试。',
    message,
    code: result?.status || result?.data?.error?.code || 'AGENT_RESPONSE_MISSING',
    recoveryActions: result?.data?.error?.recoveryActions || ['重试', '检查模型配置']
  }
}

async function analyzeWorkflowDocuments() {
  if (!workflowForm.documents.length && !workflowForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先上传需求文档或输入原始需求')
    return
  }
  const pendingWorkflow = builtinWorkflows.value.find((item) => item.id === workflowForm.selectedWorkflowId) ||
    builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0]
  const pendingRun = {
    ...createWorkflowRun(pendingWorkflow, workflowForm.input || '需求文档分析'),
    projectId: workflowAnalysisProject.value?.id || '',
    demandScope: workflowForm.demandScope,
    requestedSkillId: workflowForm.selectedWorkflowId,
    resolvedSkillId: workflowForm.selectedWorkflowId === 'auto' ? '' : workflowForm.selectedWorkflowId,
    skillId: workflowForm.selectedWorkflowId,
    displaySkillName: workflowForm.selectedWorkflowId === 'auto' ? '智能推荐 Skill' : pendingWorkflow?.name,
    routingReason: '',
    detectedIntent: '',
    projectBlueprint: null,
    documentAnalysis: null,
    status: 'analyzing',
    model: modelSettingsForm.defaultModel || 'gpt-5.5',
    agentSessions: {},
    referenceFiles: {},
    updatedAt: new Date().toISOString()
  }
  pendingRun.referenceFiles[pendingRun.currentStepId] = workflowForm.documents || []
  const pendingRunResult = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
  const persistedPendingRun = pendingRunResult.ok && pendingRunResult.data?.run ? pendingRunResult.data.run : pendingRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedPendingRun)
  state.activeWorkflowRun = persistedPendingRun
  workflowAnalysisResult.value = buildWorkflowAnalysisProgressResult(persistedPendingRun)
  saveState(state)
  openWorkflowAnalysisTab(persistedPendingRun.id)
  setStatus(skillWorkbenchStatus, 'loading', '已在新标签页打开分析画布，原始输入会保留在当前页。后端正在生成初步架构和交互路径树...')
  const analysisPayload = {
    demandScope: workflowForm.demandScope,
    skillSelectionMode: workflowForm.selectedWorkflowId === 'auto' ? 'auto' : 'manual',
    skillId: workflowForm.selectedWorkflowId,
    projectId: workflowAnalysisProject.value?.id || '',
    project: workflowAnalysisProject.value || {},
    input: workflowForm.input,
    documents: workflowForm.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      content: doc.status === '已读取' ? (doc.text || '') : '',
      reason: doc.status !== '已读取' ? (doc.text || doc.reason || '') : ''
    }))
  }
  const result = await api.uploads.analyzeDocumentsStream(state.apiConfig, analysisPayload, {
    timeoutMs: workflowAnalysisRequestTimeoutMs(),
    onEvent: (event) => {
      if (event.type === 'status' && event.data?.label) {
        setStatus(skillWorkbenchStatus, 'loading', event.data.label)
      }
      if (event.type === 'artifact' && event.data?.type === 'workflow-canvas-meta') {
        workflowAnalysisResult.value = buildWorkflowAnalysisProgressResult(persistedPendingRun, event.data)
        void persistWorkflowAnalysisProgressRun(persistedPendingRun, { immediate: true })
        setStatus(skillWorkbenchStatus, 'loading', `后端已返回画布骨架，准备生成 ${event.data?.total || 0} 个节点...`)
      } else if (event.type === 'artifact' && event.data?.type === 'workflow-node') {
        workflowAnalysisResult.value = mergeWorkflowAnalysisStreamNode(workflowAnalysisResult.value || buildWorkflowAnalysisProgressResult(persistedPendingRun), {
          node: event.data.node,
          index: event.data.index,
          total: event.data.total
        })
        void persistWorkflowAnalysisProgressRun(persistedPendingRun)
        setStatus(skillWorkbenchStatus, 'loading', `正在生成画布节点 ${Number(event.data.index || 0) + 1}/${event.data.total || '?'}`)
      } else if (event.type === 'artifact') {
        setStatus(skillWorkbenchStatus, 'loading', '后端已生成部分分析结果，正在保存画布...')
      }
    }
  })
  if (!result.ok || !result.data?.blueprint) {
    if (workflowAnalysisProgressSaveTimer) {
      window.clearTimeout(workflowAnalysisProgressSaveTimer)
      workflowAnalysisProgressSaveTimer = null
    }
    const failureMessage = result.message || result.error || '文档分析失败，请检查后端服务'
    const failureAnalysis = buildWorkflowAnalysisFailureResult(failureMessage)
    const failedRun = {
      ...persistedPendingRun,
      documentAnalysis: failureAnalysis,
      status: 'failed',
      updatedAt: new Date().toISOString()
    }
    const savedFailedRun = await api.workspace.createWorkflowRun(state.apiConfig, failedRun)
    const persistedFailedRun = savedFailedRun.ok && savedFailedRun.data?.run ? savedFailedRun.data.run : failedRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedFailedRun)
    state.activeWorkflowRun = persistedFailedRun
    setStatus(skillWorkbenchStatus, 'failed', failureMessage)
    return
  }
  if (workflowAnalysisProgressSaveTimer) {
    window.clearTimeout(workflowAnalysisProgressSaveTimer)
    workflowAnalysisProgressSaveTimer = null
  }
  const resolvedWorkflowId = result.data.routing?.resolvedSkillId || result.data.resolvedSkillId || workflowForm.selectedWorkflowId
  const workflow = builtinWorkflows.value.find((item) => item.id === resolvedWorkflowId) ||
    builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0]
  const nextRun = {
    ...persistedPendingRun,
    workflowId: workflow.id,
    workflowName: workflow.name,
    assetType: workflow.assetType,
    input: workflowForm.input || result.data.blueprint.title,
    projectId: workflowAnalysisProject.value?.id || '',
    demandScope: workflowForm.demandScope,
    requestedSkillId: result.data.routing?.requestedSkillId || result.data.requestedSkillId || workflowForm.selectedWorkflowId,
    resolvedSkillId: resolvedWorkflowId,
    displaySkillName: result.data.routing?.displaySkillName || result.data.displaySkillName,
    routingReason: result.data.routing?.routingReason || result.data.routingReason || '',
    detectedIntent: result.data.routing?.detectedIntent || result.data.detectedIntent || '',
    skillId: resolvedWorkflowId,
    projectBlueprint: result.data.blueprint,
    documentAnalysis: result.data,
    status: 'running',
    updatedAt: new Date().toISOString(),
    model: modelSettingsForm.defaultModel || 'gpt-5.5',
    agentSessions: persistedPendingRun.agentSessions || {},
    referenceFiles: persistedPendingRun.referenceFiles || {}
  }
  nextRun.referenceFiles[nextRun.currentStepId] = result.data.documents || []
  const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, nextRun)
  const persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
  state.activeWorkflowRun = persistedRun
  workflowAnalysisResult.value = result.data
  void loadModelCallLogs()
  setStatus(skillWorkbenchStatus, 'success', '已生成初步架构、交互路径树和跳转计划')
}

async function autoAnalyzeWorkflowInput() {
  await startWorkflowRun({ auto: true })
  if (!state.activeWorkflowRun || !activeWorkflowStep.value) return
  autofillWorkflowStepFromText(workflowForm.input)
  persistWorkflowStepInput()
  attachProjectBlueprint()
  const result = await api.workspace.generateWorkflowStep(state.apiConfig, state.activeWorkflowRun.id, {
    stepInputs: { ...workflowStepDraft }
  })
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '自动生成当前步骤失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  setStatus(skillWorkbenchStatus, 'success', '文档已自动解析，并生成项目蓝图和当前步骤草稿')
}

function autofillWorkflowStepFromText(text) {
  if (!activeWorkflowStep.value) return
  const summary = summarizeWorkflowText(text)
  const lowerText = text.toLowerCase()
  activeWorkflowStep.value.requiredFields.forEach((field) => {
    if (workflowStepDraft[field]) return
    workflowStepDraft[field] = inferWorkflowFieldValue(field, text, lowerText, summary)
  })
}

function summarizeWorkflowText(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^【上传文档/.test(line))
    .slice(0, 6)
    .join('；')
    .slice(0, 220)
}

function inferWorkflowFieldValue(field, text, lowerText, summary) {
  const fieldName = String(field)
  if (/podcastor|podcast|播客/.test(lowerText)) {
    if (/目标创作者|目标用户|主要用户|主用户|用户/.test(fieldName)) {
      return '独立播客创作者、自媒体 IP、内容营销人员、轻量知识变现用户'
    }
    if (/核心痛点|核心问题|痛点/.test(fieldName)) {
      return '出镜门槛高、脚本/配音/视频制作割裂、缺少灵感和一键同款、多端分发成本高'
    }
    if (/产品定位|定位/.test(fieldName)) {
      return '零门槛的 AI 播客工作站'
    }
    if (/一期范围|MVP|首版|范围/.test(fieldName)) {
      return '脚本生成、音频播客生成、视频播客生成、图片+波纹图播客、作品存储、核心资产库'
    }
    if (/成功|验收|标准/.test(fieldName)) {
      return '用户能从文本、URL、文档或音频开始，在同一工作流内生成脚本、音频、视频播客并保存作品'
    }
    if (/首页入口/.test(fieldName)) return 'Turn Your Ideas Into Podcasts 首屏创作模块'
    if (/输入方式/.test(fieldName)) return '文本提示词、URL 链接、上传 PDF/PPT/DOCX、上传音频'
    if (/核心编辑器/.test(fieldName)) return '左侧播客主持人选择，右侧脚本预览、编辑和生成操作'
    if (/关键操作/.test(fieldName)) return '预览音频、下载脚本、复制脚本、替换音色、角色对调、增加停顿、生成视频播客'
    if (/资产类型/.test(fieldName)) return '脚本&灵感库、音色&音频资产库、播客主播库、作品库、背景和波纹图'
    if (/分发渠道/.test(fieldName)) return 'YouTube，后续 Spotify、Apple Podcast、TikTok/Instagram Reels 短切片'
    if (/一期范围/.test(fieldName)) return '脚本生成、音频播客生成、视频播客生成、图片+波纹图播客、作品存储、核心资产库'
  }
  if (/用户|对象|角色/.test(fieldName)) {
    if (/后台|管理|运营|审核|审批|admin/.test(lowerText)) return '后台运营/审核人员'
    if (/产品经理|pm/.test(lowerText)) return '产品经理'
    if (/创作者|主播|podcast|播客/.test(lowerText)) return '播客创作者/内容运营'
    return '目标用户待确认'
  }
  if (/目标|原始目标|业务目标/.test(fieldName)) {
    return summary || '基于上传文档完成需求拆解和流程分析'
  }
  if (/成功|验收|标准/.test(fieldName)) {
    return '输出可采纳的需求拆解、关键流程、页面结构和验收标准'
  }
  if (/Epic/i.test(fieldName)) return '核心体验优化'
  if (/核心功能|功能/.test(fieldName)) return '围绕上传文档中的核心需求完成主流程闭环'
  if (/推荐方向|方向/.test(fieldName)) return '先完成 MVP 主流程，再补充异常状态和质量校验'
  if (/疑点|风险/.test(fieldName)) return '需求边界、目标用户、成功指标和异常场景需要进一步确认'
  if (/场景/.test(fieldName)) return '用户基于文档内容完成主要任务的核心场景'
  if (/页面|组件/.test(fieldName)) return '围绕主流程拆解关键页面、表单、状态和操作组件'
  return summary || '根据上传文档自动提取'
}

async function startWorkflowRun(options = {}) {
  const workflow = builtinWorkflows.value.find((item) => item.id === workflowForm.selectedWorkflowId)
  if (!workflow) {
    setStatus(skillWorkbenchStatus, 'failed', '请选择有效流程')
    return
  }
  if (!workflowForm.input.trim()) {
    workflowForm.input = `${displayProjectName(currentProject.value)} 项目：请基于当前项目资料生成项目蓝图、交互路径和可交互 Demo。`
  }
  const result = await api.workspace.createWorkflowRun(state.apiConfig, {
    projectId: state.currentProjectId,
    workflowId: workflow.id,
    input: workflowForm.input
  })
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '流程运行创建失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  autofillWorkflowStepFromText(workflowForm.input)
  persistWorkflowStepInput()
  attachProjectBlueprint()
  syncWorkflowDraftFromRun()
  if (!options.auto) setStatus(skillWorkbenchStatus, 'success', `已开始：${workflow.name}`)
}

async function generateProjectBlueprint() {
  if (!state.activeWorkflowRun) {
    await startWorkflowRun({ auto: true })
  } else {
    persistWorkflowStepInput()
    if (!workflowForm.input.trim()) workflowForm.input = state.activeWorkflowRun.input || `${displayProjectName(currentProject.value)} 项目`
  }
  if (!state.activeWorkflowRun || !activeWorkflowStep.value) return
  autofillWorkflowStepFromText(workflowForm.input)
  persistWorkflowStepInput()
  attachProjectBlueprint()
  const result = await api.workspace.generateWorkflowStep(state.apiConfig, state.activeWorkflowRun.id, {
    stepInputs: { ...workflowStepDraft }
  })
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '项目蓝图生成失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  setStatus(skillWorkbenchStatus, 'success', '已生成项目蓝图、交互路径树和低保真 Demo')
}

function startRecommendedWorkflow(workflowId) {
  workflowForm.selectedWorkflowId = workflowId
  workflowForm.input = workbenchForm.input || workflowForm.input
  if (!workflowForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先输入原始需求')
    return
  }
  void startWorkflowRun()
  activeView.value = 'workflow'
  syncRouteToView('workflow')
}

function selectWorkflowStep(stepId) {
  if (!state.activeWorkflowRun) return
  const step = state.activeWorkflowRun.steps.find((item) => item.id === stepId)
  if (!step) return
  if (step.status === 'locked') {
    const workbenchStep = workflowWorkbenchView.value?.steps.find((item) => item.id === stepId)
    setStatus(skillWorkbenchStatus, 'failed', workbenchStep?.lockReason || '请先确认前置步骤')
    return
  }
  persistWorkflowStepInput()
  state.activeWorkflowRun.currentStepId = stepId
  syncWorkflowDraftFromRun()
}

function fillWorkflowStepWithDefaults(mode = 'example') {
  if (!state.activeWorkflowRun || !activeWorkflowStep.value) return
  Object.assign(workflowStepDraft, defaultWorkflowStepInputs(state.activeWorkflowRun, activeWorkflowStep.value, mode))
  persistWorkflowStepInput()
  setStatus(skillWorkbenchStatus, 'success', mode === 'skip' ? '已使用默认假设补齐当前步骤' : '已填入示例内容，可以直接生成草稿')
}

function viewWorkflowEvidence() {
  const docs = workflowForm.documents.map((doc) => doc.name).filter(Boolean)
  const evidence = docs.length ? `当前依据：${docs.join('、')}` : '当前暂无上传文档，将基于项目名称、输入内容和默认假设生成。'
  setStatus(skillWorkbenchStatus, 'success', evidence)
}

function canvasNodeById(nodeId) {
  return workflowCanvasNodes.value.find((node) => node.id === nodeId) || null
}

function canvasNodeCenter(nodeId) {
  const node = canvasNodeById(nodeId)
  if (!node) return { x: 0, y: 0 }
  return {
    x: node.x + node.width,
    y: node.y + node.height / 2
  }
}

function focusCanvasNode(nodeId) {
  workflowAgentNodeId.value = nodeId
}

function selectWorkflowCanvasNode(nodeId) {
  if (!nodeId) return
  workflowAgentNodeId.value = nodeId
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  workflowAgentUploadOpen.value = false
  workflowAgentHistoryOpen.value = false
  workflowAgentInput.value = ''
  clearWorkflowAgentDraftState()
}

function clearWorkflowAgentDraftState() {
  workflowAgentEditingMessageId.value = ''
  workflowAgentRetryMessageId.value = ''
  workflowAgentRetryTargetMessageId.value = ''
}

function restoreWorkflowAgentDraftState(draftMeta = {}) {
  workflowAgentEditingMessageId.value = draftMeta.editOfMessageId || ''
  workflowAgentRetryMessageId.value = draftMeta.retryOfMessageId || ''
  workflowAgentRetryTargetMessageId.value = draftMeta.retryTargetMessageId || ''
}

function clearWorkflowAgentActiveDraft() {
  workflowAgentActiveDraft.value = ''
  workflowAgentActiveDraftMeta.value = {}
}

function restoreWorkflowAgentActiveDraft() {
  if (!workflowAgentInput.value) workflowAgentInput.value = workflowAgentActiveDraft.value
  restoreWorkflowAgentDraftState(workflowAgentActiveDraftMeta.value)
  clearWorkflowAgentActiveDraft()
}

function isWorkflowAgentConfirmationAction(content = '') {
  // 核心确认意图：确认此环节|确认结构|确认框架|下一步|进入下一步
  return /确认此环节|确认结构|确认框架|确认路径|确认说明|确认文档|确认需求|确认档案|确认诊断|确认任务流|确认交接|确认 Demo|最终确认|下一步|进入下一步/.test(String(content || ''))
}

function isWorkflowAgentReanalysisAction(content = '') {
  return /重新分析|重新分析文档|重跑分析|重新解析|重新生成分析/.test(String(content || ''))
}

const WORKFLOW_CANVAS_ACTION_EXPECTED_SECTIONS = ['结论', '依据与假设', '缺口与风险', '可写入画布内容', '后续画布影响']

function workflowCanvasActionIntent(action = '') {
  const normalized = String(action || '').replace(/\s+/g, '')
  if (/目标用户|用户人群|人群/.test(normalized)) return 'target-user-enrichment'
  if (/调整定位|定位|页面定位|产品定位/.test(normalized)) return 'positioning-adjustment'
  if (/验收标准|补验收|验收|测试口径|通过条件|失败条件/.test(normalized)) return 'acceptance-criteria-enrichment'
  if (/接口契约|补接口|接口字段|接口|API|错误码|Mock|前后端/.test(normalized)) return 'api-contract-enrichment'
  if (/异常状态|补异常|错误态|空状态|加载态|失败态|权限态|恢复入口|状态/.test(normalized)) return 'exception-state-enrichment'
  if (/埋点指标|补埋点|埋点|指标|转化|事件|数据观察|漏斗/.test(normalized)) return 'analytics-enrichment'
  if (/补充资料|补充细节|补充信息|补资料|资料/.test(normalized)) return 'supplement-detail'
  if (/重新分析|重新解析|重跑分析|重新生成分析/.test(normalized)) return 'reanalysis'
  return 'canvas-action-advice'
}

function workflowCanvasActionTemplate(actionIntent = '') {
  const templates = {
    'target-user-enrichment': '补齐目标用户分层、进入场景、用户任务、顾虑点和可验收成功标准。',
    'positioning-adjustment': '重新校准页面/弹窗定位、核心价值、不包含范围和上下游依赖。',
    'acceptance-criteria-enrichment': '补齐成功路径、失败态、测试口径、通过条件和可验收标准。',
    'api-contract-enrichment': '补齐接口端点、请求字段、返回字段、错误码、Mock 数据和前后端接管边界。',
    'exception-state-enrichment': '补齐加载、空、错、权限、超时等异常状态、触发条件、提示反馈和恢复入口。',
    'analytics-enrichment': '补齐事件名、触发时机、事件属性、转化指标、漏斗影响和隐私边界。',
    'supplement-detail': '补齐当前节点缺口、依据、边界、异常状态和可写入画布的结构化内容。',
    reanalysis: '重新分析当前节点结论，指出原结论问题、修正结论和后续节点影响。'
  }
  return templates[actionIntent] || '根据当前按钮动作输出可确认、可写入画布的结构化建议。'
}

function normalizeWorkflowCanvasAction(action, nodeId = '') {
  const actionLabel = String(action || '补充资料').trim() || '补充资料'
  const actionIntent = workflowCanvasActionIntent(actionLabel)
  return {
    action: actionLabel,
    actionLabel,
    actionIntent,
    actionTemplate: workflowCanvasActionTemplate(actionIntent),
    expectedSections: [...WORKFLOW_CANVAS_ACTION_EXPECTED_SECTIONS],
    nodeId
  }
}

function sendWorkflowAgentCanvasAction(action, nodeId = '') {
  if (nodeId) selectWorkflowCanvasNode(nodeId)
  openWorkflowAgent()
  const targetNodeId = nodeId || workflowAgentScopeId()
  const canvasAction = normalizeWorkflowCanvasAction(action, targetNodeId)
  const userMessage = `请处理画布动作：${canvasAction.actionLabel}`
  void sendWorkflowAgentMessage(userMessage, {
    ignoreDraftState: true,
    nodeId: targetNodeId,
    action: 'canvas-action-advice',
    canvasAction: {
      action: canvasAction.action,
      actionLabel: canvasAction.actionLabel,
      actionIntent: canvasAction.actionIntent,
      actionTemplate: canvasAction.actionTemplate,
      expectedSections: canvasAction.expectedSections,
      nodeId: targetNodeId
    }
  })
}

function isWorkflowAgentCanvasAdviceQuickReply(content = '') {
  const normalized = String(content || '').trim()
  if (!normalized) return false
  const activeNode = workflowAgentNode.value || {}
  const nodeActions = [
    ...(Array.isArray(activeNode.quickActions) ? activeNode.quickActions : []),
    ...(Array.isArray(activeNode.agentInteraction?.quickReplies) ? activeNode.agentInteraction.quickReplies : []),
    ...(Array.isArray(activeNode.agentInteraction?.suggestedQuestions) ? activeNode.agentInteraction.suggestedQuestions : [])
  ].map((item) => String(item || '').trim()).filter(Boolean)
  if (nodeActions.includes(normalized)) return true
  if (/使用示例|生成本步草稿|无疑问|跳过|进入下一步|采纳|确认|重试|换模型|检查配置/.test(normalized)) return false
  return /^(补|检查|调整|拆|生成)(跳转|返回|异常|状态|断点|定位|目标用户|接口|页面|流程|边界|细节|资料|模块|优先级|低保真|框架|结构)/.test(normalized)
}

function runWorkflowNodeQuickAction(payload) {
  const action = typeof payload === 'string' ? payload : payload?.action
  const nodeId = typeof payload === 'string' ? '' : payload?.nodeId
  if (payload?.type === 'agent-supplement') {
    if (nodeId) selectWorkflowCanvasNode(nodeId)
    void applyWorkflowAgentSupplement(payload)
    return
  }
  if (payload?.type === 'repair-action') {
    if (nodeId) selectWorkflowCanvasNode(nodeId)
    void repairWorkflowAnalysis(payload)
    return
  }
  if (isWorkflowAgentReanalysisAction(action)) {
    if (nodeId) selectWorkflowCanvasNode(nodeId)
    void repairWorkflowAnalysis({
      type: 'reanalysis',
      nodeId: nodeId || workflowAgentScopeId(),
      action: `重新分析当前节点并输出分析结论：${action || '重新分析'}`,
      checkId: 'node-reanalysis'
    })
    return
  }
  if (isWorkflowAgentConfirmationAction(action)) {
    if (nodeId) selectWorkflowCanvasNode(nodeId)
    void applyWorkflowAgentSupplement({
      type: 'agent-supplement',
      nodeId: nodeId || workflowAgentScopeId(),
      action
    })
    return
  }
  sendWorkflowAgentCanvasAction(action, nodeId)
}

async function applyWorkflowAgentSupplement(payload = {}) {
  if (!workflowAnalysisResult.value) {
    setStatus(skillWorkbenchStatus, 'failed', '当前没有可补充的分析结果')
    return false
  }
  const targetNodeId = workflowAgentResolvedNodeId(payload.nodeId)
  if (targetNodeId) selectWorkflowCanvasNode(targetNodeId)
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId
  setStatus(skillWorkbenchStatus, 'loading', '后端正在合并 Agent 补充并刷新画布...')
  try {
    const result = await api.workspace.repairAnalysis(state.apiConfig, {
      type: 'agent-supplement',
      checkId: payload.checkId || '',
      action: payload.action || '',
      confirmedContent: payload.confirmedContent || '',
      nodeId: targetNodeId,
      analysis: workflowAnalysisResult.value
    })
    const data = applyApiResult(skillWorkbenchStatus, result, '后端刷新画布失败')
    if (!data?.analysis) return false
    workflowAnalysisResult.value = data.analysis
    if (state.activeWorkflowRun) {
      const nextRun = {
        ...state.activeWorkflowRun,
        documentAnalysis: data.analysis,
        projectBlueprint: data.analysis.blueprint || state.activeWorkflowRun.projectBlueprint,
        updatedAt: new Date().toISOString()
      }
      state.activeWorkflowRun = nextRun
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    }
    workflowAgentNodeId.value = data.analysis.canvas?.nodes?.[0]?.id || 'analysis'
    workflowFullscreenNodeId.value = ''
    workflowFullscreenEditNodeId.value = ''
    setStatus(skillWorkbenchStatus, 'success', '已把确认补充写入画布并刷新后续节点')
    return true
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `画布补充失败：${error.message}` : '画布补充失败')
    return false
  } finally {
    workflowCanvasLoading.value = false
    workflowCanvasRefreshingNodeId.value = ''
  }
}

async function repairWorkflowAnalysis(payload = {}) {
  if (!workflowAnalysisResult.value) {
    setStatus(skillWorkbenchStatus, 'failed', '当前没有可修复的分析结果')
    return
  }
  const targetNodeId = workflowAgentResolvedNodeId(payload.nodeId)
  if (targetNodeId) selectWorkflowCanvasNode(targetNodeId)
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId
  setStatus(skillWorkbenchStatus, 'loading', payload.type === 'reanalysis' ? '后端正在重新分析当前节点...' : '后端正在根据质量检查修复分析结果...')
  try {
    const result = await api.workspace.repairAnalysis(state.apiConfig, {
      type: payload.type || '',
      checkId: payload.checkId || '',
      action: payload.action || '',
      nodeId: targetNodeId,
      analysis: workflowAnalysisResult.value
    })
    const data = applyApiResult(skillWorkbenchStatus, result, '后端修复分析结果失败')
    if (!data?.analysis) return
    workflowAnalysisResult.value = data.analysis
    if (state.activeWorkflowRun) {
      const nextRun = {
        ...state.activeWorkflowRun,
        documentAnalysis: data.analysis,
        projectBlueprint: data.analysis.blueprint || state.activeWorkflowRun.projectBlueprint,
        updatedAt: new Date().toISOString()
      }
      state.activeWorkflowRun = nextRun
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    }
    workflowAgentNodeId.value = data.analysis.canvas?.nodes?.[0]?.id || 'analysis'
    workflowFullscreenNodeId.value = ''
    workflowFullscreenEditNodeId.value = ''
    setStatus(skillWorkbenchStatus, 'success', payload.type === 'reanalysis'
      ? '已重新分析当前节点并刷新画布'
      : `已完成后端修复：${data.repair?.checkId || payload.checkId || '质量检查'}`)
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `后端修复分析结果失败：${error.message}` : '后端修复分析结果失败')
  } finally {
    workflowCanvasLoading.value = false
    workflowCanvasRefreshingNodeId.value = ''
  }
}

async function saveWorkflowCanvasNodeEdit(payload = {}) {
  if (!workflowAnalysisResult.value || !state.activeWorkflowRun?.id) {
    setStatus(skillWorkbenchStatus, 'failed', '当前没有可保存的分析画布')
    return
  }
  const targetNodeId = workflowAgentResolvedNodeId(payload.nodeId)
  if (!targetNodeId) {
    setStatus(skillWorkbenchStatus, 'failed', '没有找到要编辑的画布节点')
    return
  }
  selectWorkflowCanvasNode(targetNodeId)
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId
  setStatus(skillWorkbenchStatus, 'loading', '后端正在保存当前节点并刷新后续画布...')
  try {
    const result = await api.workflows.editWorkflowCanvasNode(state.apiConfig, state.activeWorkflowRun.id, targetNodeId, {
      nodeId: targetNodeId,
      editedSummary: payload.editedSummary || '',
      editedContentText: payload.editedContentText || '',
      editedDetailText: payload.editedDetailText || '',
      originalNode: payload.originalNode || null,
      analysis: workflowAnalysisResult.value
    }, {
      timeoutMs: workflowAgentRequestTimeoutMs()
    })
    const data = applyApiResult(skillWorkbenchStatus, result, '保存画布节点失败')
    if (!data?.analysis) return
    workflowAnalysisResult.value = data.analysis
    const nextRun = {
      ...(state.activeWorkflowRun || {}),
      ...(data.run || {}),
      documentAnalysis: data.analysis,
      projectBlueprint: data.analysis.blueprint || data.run?.projectBlueprint || state.activeWorkflowRun.projectBlueprint,
      updatedAt: data.run?.updatedAt || new Date().toISOString()
    }
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    workflowAgentNodeId.value = targetNodeId
    workflowFullscreenNodeId.value = targetNodeId
    workflowFullscreenEditNodeId.value = ''
    setStatus(skillWorkbenchStatus, 'success', '已保存当前节点并刷新后续画布')
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `保存画布节点失败：${error.message}` : '保存画布节点失败')
  } finally {
    workflowCanvasLoading.value = false
    workflowCanvasRefreshingNodeId.value = ''
  }
}

function openWorkflowCanvasRun(run) {
  if (!run?.documentAnalysis?.canvas) return
  workflowCanvasLoading.value = false
  if (run.projectId && run.projectId !== state.currentProjectId) {
    applyProjectSelection({
      currentProjectId: run.projectId,
      activeWorkflowRun: run,
      selectedAssetId: '',
      selectedRestoredPageId: ''
    })
  } else {
    state.activeWorkflowRun = run
  }
  workflowAnalysisResult.value = run.documentAnalysis
  workflowAgentNodeId.value = run.documentAnalysis.canvas?.nodes?.[0]?.id || 'analysis'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  activeDemoScreenId.value = run.projectBlueprint?.demoScreens?.[0]?.id || ''
  workflowBlueprintTab.value = 'framework'
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  if (currentWorkflowAnalysisDeepLinkRunId() === run.id) syncWorkflowAnalysisRoute(run.id, 'replace')
  syncWorkflowDraftFromRun()
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  })
}

async function openWorkflowAnalysisRecord(runId) {
  const run = (state.workflowRuns || []).find((item) => item.id === runId)
  syncWorkflowAnalysisRoute(runId)
  if (run?.documentAnalysis?.canvas) {
    openWorkflowCanvasRun(run)
    return
  }
  if (!runId) return
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  workflowCanvasLoading.value = true
  workflowAnalysisResult.value = null
  workflowAgentNodeId.value = 'analysis'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  const loaded = await loadWorkflowRunDetail(runId, { fallbackRun: run })
  if (!loaded) {
    workflowCanvasLoading.value = false
    workflowRoute.value = 'entry'
    setStatus(skillWorkbenchStatus, 'failed', '没有获取到完整分析画布，请稍后重试或检查后端运行记录。')
  }
}

function adjustWorkflowCanvasZoom(delta) {
  workflowCanvasZoom.value = Math.min(1.4, Math.max(0.5, workflowCanvasZoom.value + delta))
}

function rollbackWorkflowAnalysisVersion(version) {
  if (!version?.snapshot || !workflowAnalysisResult.value) return
  const currentVersions = workflowAnalysisVersionHistory.value || []
  const nextAnalysis = {
    ...workflowAnalysisResult.value,
    blueprint: version.snapshot.blueprint || workflowAnalysisResult.value.blueprint,
    canvas: version.snapshot.canvas || workflowAnalysisResult.value.canvas,
    routing: version.snapshot.routing || workflowAnalysisResult.value.routing,
    generation: version.snapshot.generation || workflowAnalysisResult.value.generation,
    versions: [version, ...currentVersions.filter((item) => item.id !== version.id)]
  }
  if (nextAnalysis.blueprint) {
    nextAnalysis.blueprint = {
      ...nextAnalysis.blueprint,
      versions: nextAnalysis.versions,
      qualityGate: nextAnalysis.qualityGate || workflowAnalysisQualityGate.value
    }
  }
  workflowAnalysisResult.value = nextAnalysis
  if (state.activeWorkflowRun) {
    const nextRun = {
      ...state.activeWorkflowRun,
      documentAnalysis: nextAnalysis,
      projectBlueprint: nextAnalysis.blueprint || state.activeWorkflowRun.projectBlueprint,
      updatedAt: new Date().toISOString()
    }
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
  }
  workflowAgentNodeId.value = nextAnalysis.canvas?.nodes?.[0]?.id || 'analysis'
  workflowFullscreenNodeId.value = ''
  setStatus(skillWorkbenchStatus, 'success', `已回滚到 ${version.label || version.id}`)
}

function ensureActiveWorkflowRunForAgent() {
  if (state.activeWorkflowRun) return state.activeWorkflowRun
  if (!workflowAnalysisResult.value?.canvas) return null
  const existingRun = (state.workflowRuns || []).find((run) =>
    run?.documentAnalysis?.canvas === workflowAnalysisResult.value.canvas ||
    (run?.documentAnalysis?.canvas?.nodes?.length && run.documentAnalysis.canvas.nodes === workflowAnalysisResult.value.canvas.nodes)
  )
  if (existingRun) {
    state.activeWorkflowRun = existingRun
    return existingRun
  }
  const fallbackRun = {
    id: workflowAnalysisResult.value.runId || workflowAnalysisResult.value.id || `local-analysis-${Date.now()}`,
    workflowId: workflowAnalysisResult.value.workflowId || 'document-analysis',
    workflowName: workflowAnalysisResult.value.blueprint?.title || workflowAnalysisResult.value.title || '需求分析画布',
    assetType: '页面蓝图',
    input: workflowAnalysisResult.value.summary?.input || '',
    currentStepId: workflowAgentNodeId.value || workflowAnalysisResult.value.canvas?.nodes?.[0]?.id || 'analysis',
    steps: (workflowAnalysisResult.value.canvas?.nodes || []).map((node, index) => ({
      id: node.id || `node-${index + 1}`,
      title: node.title || `环节 ${index + 1}`,
      goal: node.agentScope || node.summary || '',
      requiredFields: [],
      outputTitle: node.title || `环节 ${index + 1}`,
      status: index === 0 ? 'active' : 'available'
    })),
    stepInputs: {},
    stepOutputs: {},
    stepDraftOutputs: {},
    stepChallenges: {},
    stepVersions: {},
    candidateOptions: {},
    agentSessions: {},
    referenceFiles: {},
    agentQuickReplies: {},
    finalConclusion: null,
    projectId: state.currentProjectId,
    status: workflowAnalysisResult.value.status || 'analyzed',
    documentAnalysis: workflowAnalysisResult.value,
    projectBlueprint: workflowAnalysisResult.value.blueprint || null,
    createdAt: workflowAnalysisResult.value.createdAt || new Date().toISOString(),
    updatedAt: workflowAnalysisResult.value.updatedAt || new Date().toISOString()
  }
  state.activeWorkflowRun = fallbackRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, fallbackRun)
  return fallbackRun
}

function openWorkflowAgentForNode(nodeId) {
  workflowAgentNodeId.value = nodeId || workflowCanvasNodes.value[0]?.id || ''
  openWorkflowAgent()
}

function workflowAgentScopeId() {
  return workflowAgentNodeId.value || workflowAgentNode.value?.id || activeWorkflowStep.value?.id || ''
}

function workflowAgentResolvedNodeId(candidateId = '') {
  if (candidateId && canvasNodeById(candidateId)) return candidateId
  const scopeId = workflowAgentScopeId()
  if (scopeId && canvasNodeById(scopeId)) return scopeId
  return workflowCanvasNodes.value[0]?.id || ''
}

function workflowCanvasDownstreamNodes(nodeId) {
  const nodes = (Array.isArray(workflowCanvasNodes.value) ? workflowCanvasNodes.value : []).filter((node) => node && typeof node === 'object' && !Array.isArray(node))
  if (!nodes.length) return []
  const index = nodes.findIndex((node) => node.id === nodeId)
  if (index < 0) return nodes
  return nodes.slice(index)
}

function workflowAgentRequestContext(options = {}) {
  const explicitNode = options.nodeId ? canvasNodeById(options.nodeId) : null
  const node = explicitNode || workflowAgentNode.value
  return {
    currentStepId: activeWorkflowStep.value?.id || '',
    activeNode: node
      ? {
          id: node.id,
          title: node.title,
          summary: node.summary,
          content: node.content || [],
          agentScope: node.agentScope || '',
          agentInteraction: node.agentInteraction || null
        }
      : null,
    blueprintTab: workflowBlueprintTab.value,
    parsedDocuments: workflowAnalysisResult.value?.summary?.parsed || 0,
    knowledgeRetrievalError: options.knowledgeRetrievalError || '',
    canvasAction: options.canvasAction || null
  }
}

function ensureWorkflowAgentSession(scopeId = workflowAgentScopeId()) {
  if (!state.activeWorkflowRun || !scopeId) return []
  state.activeWorkflowRun.agentSessions ||= {}
  state.activeWorkflowRun.agentSessions[scopeId] ||= []
  return state.activeWorkflowRun.agentSessions[scopeId]
}

function ensureWorkflowReferenceFiles(scopeId = workflowAgentScopeId()) {
  if (!state.activeWorkflowRun || !scopeId) return []
  state.activeWorkflowRun.referenceFiles ||= {}
  state.activeWorkflowRun.referenceFiles[scopeId] ||= []
  return state.activeWorkflowRun.referenceFiles[scopeId]
}

function isWorkflowAgentReferenceFile(file) {
  return Boolean(file && typeof file === 'object' && !Array.isArray(file))
}

function workflowAgentReferencePayload(scopeId = workflowAgentScopeId()) {
  return ensureWorkflowReferenceFiles(scopeId).filter(isWorkflowAgentReferenceFile)
}

function appendWorkflowAgentMessage(role, content, options = {}) {
  const session = ensureWorkflowAgentSession(options.scopeId)
  if (!session) return
  const message = {
    id: options.id || crypto.randomUUID(),
    role,
    content,
    createdAt: options.createdAt || new Date().toISOString(),
    ...(options.meta ? { meta: options.meta } : {})
  }
  session.push(message)
  return message.id
}

function replaceWorkflowAgentMessage(messageId, nextMessage, scopeId = workflowAgentScopeId()) {
  const session = ensureWorkflowAgentSession(scopeId)
  const index = session.findIndex((message) => message.id === messageId)
  if (index < 0) return
  session[index] = {
    ...session[index],
    ...nextMessage,
    id: nextMessage.id || messageId,
    createdAt: nextMessage.createdAt || session[index].createdAt
  }
}

function workflowAgentMessageById(messageId, scopeId = workflowAgentScopeId()) {
  return ensureWorkflowAgentSession(scopeId).find((message) => message.id === messageId) || null
}

function isWorkflowAgentStructuredStreamContent(content = '') {
  const value = String(content || '').trim()
  if (!value) return false
  if (/^```(?:json)?\s*\{/i.test(value)) return true
  if (/^[{\[]/.test(value) && /"(content|proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact|nodeId)"\s*:/.test(value)) return true
  return /"(proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact)"\s*:/.test(value)
}

function workflowAgentStreamDisplayContent(content = '') {
  const value = String(content || '').trim()
  if (!value) return workflowAgentStatusLabel('generating')
  return value
}

function mergeWorkflowAgentStreamedAssistantMessage(assistantMessage = {}, streamedContent = '') {
  const normalized = normalizeWorkflowAgentAssistantMessage(assistantMessage)
  const finalContent = workflowAgentMessageText(normalized)
  const visibleContent = String(streamedContent || '').trim()
  if (!visibleContent || visibleContent.length <= finalContent.length) return normalized
  return {
    ...normalized,
    content: visibleContent,
    meta: {
      ...(normalized.meta || {}),
      streamedContentPreserved: true
    }
  }
}

function scrollWorkflowAgentToBottomTick() {
  nextTick(() => workflowAgentDrawerRef.value?.scrollAgentChatToBottom?.('auto'))
}

async function typeWorkflowAgentAssistantMessage(messageId, assistantMessage, options = {}) {
  const fullContent = workflowAgentMessageText(assistantMessage)
  const requestToken = options.requestToken || ''
  const meta = {
    ...(assistantMessage.meta || {}),
    status: 'generating',
    statusLabel: workflowAgentStatusLabel('generating')
  }
  if (!fullContent) {
    replaceWorkflowAgentMessage(messageId, {
      ...assistantMessage,
      meta: {
        ...(assistantMessage.meta || {}),
        status: assistantMessage.meta?.status || 'success',
        statusLabel: assistantMessage.meta?.statusLabel || workflowAgentStatusLabel('success')
      }
    }, options.scopeId)
    scrollWorkflowAgentToBottomTick()
    return
  }
  const step = options.step ?? 4
  for (let index = Math.min(step, fullContent.length); index < fullContent.length; index += step) {
    if (requestToken && workflowAgentRequestToken.value !== requestToken) return
    replaceWorkflowAgentMessage(messageId, {
      ...assistantMessage,
      content: fullContent.slice(0, index),
      meta
    }, options.scopeId)
    scrollWorkflowAgentToBottomTick()
    await wait(options.delayMs ?? 12)
  }
  if (requestToken && workflowAgentRequestToken.value !== requestToken) return
  replaceWorkflowAgentMessage(messageId, {
    ...assistantMessage,
    content: fullContent,
    meta: {
      ...(assistantMessage.meta || {}),
      status: assistantMessage.meta?.status || 'success',
      statusLabel: assistantMessage.meta?.statusLabel || workflowAgentStatusLabel('success')
    }
  }, options.scopeId)
  scrollWorkflowAgentToBottomTick()
}

function removeWorkflowAgentMessage(messageId) {
  const session = ensureWorkflowAgentSession()
  const index = session.findIndex((message) => message.id === messageId)
  if (index >= 0) session.splice(index, 1)
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

async function importWorkflowAgentFiles(event) {
  const files = Array.from(event.target.files || [])
  try {
    if (!files.length || !state.activeWorkflowRun) return
    const references = ensureWorkflowReferenceFiles()
    const uploadedReferences = []
    setStatus(skillWorkbenchStatus, 'loading', '正在加入 Agent 参考文件...')
    for (const file of files) {
      try {
        const isImage = /^image\//.test(file.type)
        const text = isImage ? '' : await extractDocumentText(file)
        const preview = isImage ? await readFileAsDataUrl(file) : ''
        const reference = {
          id: crypto.randomUUID(),
          name: file.name,
          kind: isImage ? 'image' : 'document',
          type: file.type || file.name.split('.').pop()?.toUpperCase() || 'FILE',
          status: text || isImage ? 'ready' : 'pending',
          text,
          preview
        }
        references.push(reference)
        uploadedReferences.push(reference)
      } catch (error) {
        const errorMessage = error.message || '文件读取失败'
        const reference = {
          id: crypto.randomUUID(),
          name: file.name,
          kind: /^image\//.test(file.type) ? 'image' : 'document',
          type: file.type || 'FILE',
          status: 'failed',
          text: `读取失败：${errorMessage}`,
          errorMessage
        }
        references.push(reference)
        uploadedReferences.push(reference)
      }
    }
    workflowAgentUploadOpen.value = false
    const readyCount = uploadedReferences.filter((file) => file.status === 'ready').length
    const failedCount = uploadedReferences.filter((file) => file.status === 'failed').length
    const pendingCount = uploadedReferences.filter((file) => file.status === 'pending').length
    const uploadSummary = [
      readyCount ? `${readyCount} 个已读取` : '',
      pendingCount ? `${pendingCount} 个待后端解析` : '',
      failedCount ? `${failedCount} 个读取失败` : ''
    ].filter(Boolean).join('，')
    try {
      await persistWorkflowAgentMessage({
        role: 'user',
        content: `已上传 ${files.length} 个参考文件：${uploadSummary || '暂无可用文件'}。请在当前步骤中使用可读取内容。`
      })
    } catch (error) {
      const uploadedReferenceIds = new Set(uploadedReferences.map((file) => file.id))
      references.splice(0, references.length, ...references.filter((file) => !uploadedReferenceIds.has(file.id)))
      setStatus(skillWorkbenchStatus, 'failed', error.message ? `Agent 参考文件同步失败：${error.message}` : 'Agent 参考文件同步失败，已回滚本次上传')
      return
    }
    if (failedCount === files.length) {
      setStatus(skillWorkbenchStatus, 'failed', `全部 ${failedCount} 个 Agent 参考文件读取失败，请删除后重传或换格式`)
    } else if (failedCount) {
      setStatus(skillWorkbenchStatus, 'failed', `已加入 ${readyCount + pendingCount} 个 Agent 参考文件，部分文件读取失败：${failedCount} 个`)
    } else if (pendingCount) {
      setStatus(skillWorkbenchStatus, 'success', `已加入 ${readyCount} 个 Agent 参考文件，${pendingCount} 个待后端解析`)
    } else {
      setStatus(skillWorkbenchStatus, 'success', `已加入 ${readyCount} 个 Agent 参考文件`)
    }
  } finally {
    if (event?.target) event.target.value = ''
  }
}

async function removeWorkflowAgentReference(fileId) {
  const references = ensureWorkflowReferenceFiles()
  const index = references.findIndex((file) => file.id === fileId)
  if (index < 0) return
  const [removed] = references.splice(index, 1)
  try {
    await persistWorkflowAgentMessage({
      role: 'user',
      content: `已移除参考文件：${removed.name}`
    })
  } catch (error) {
    references.splice(index, 0, removed)
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `删除参考文件失败：${error.message}` : '删除参考文件失败，已恢复到列表')
  }
}

async function retrieveWorkflowKnowledge(query = '', scopeId = '') {
  const trimmed = String(query || '').trim()
  if (!trimmed) return { items: [], error: null }
  const roleScopes = ['product', 'ux', 'development', 'ai-retrieval']
  const roleScope = roleScopes.includes(scopeId) ? scopeId : 'ai-retrieval'
  const result = await api.workspace.searchMaterials(state.apiConfig, {
    projectId: state.currentProjectId,
    type: 'knowledge',
    query: trimmed,
    roleScope,
    limit: 6
  })
  if (result.ok && Array.isArray(result.data?.results)) {
    return { items: result.data.results, error: null }
  }
  return { items: [], error: result.message || '知识检索失败' }
}

function workflowAgentStatusLabel(status = '') {
  const labels = {
    pending: '准备发送',
    retrieving: '检索知识',
    generating: '生成回复',
    'merging-canvas': '合并画布',
    success: '已完成',
    failed: '发送失败',
    cancelled: '已停止'
  }
  return labels[status] || status || ''
}

function normalizeWorkflowAgentAssistantMessage(message, fallbackMeta = {}) {
  if (!message || message.role !== 'assistant') return message
  return {
    ...message,
    meta: {
      ...fallbackMeta,
      ...(message.meta || {}),
      status: message.meta?.status || 'success',
      statusLabel: message.meta?.statusLabel || workflowAgentStatusLabel('success')
    }
  }
}

async function persistWorkflowAgentMessage(message, options = {}) {
  const scopeId = options.scopeId || workflowAgentScopeId()
  if (!state.activeWorkflowRun || !scopeId) return
  const retrievedKnowledge = Array.isArray(options.retrievedKnowledge)
    ? options.retrievedKnowledge
    : (await retrieveWorkflowKnowledge(workflowAgentMessageText(message), scopeId)).items
  const result = await api.workflows.appendMessage(
    state.apiConfig,
    state.activeWorkflowRun.id,
    scopeId,
    {
      model: workflowAgentModel.value,
      message,
      clientMessageId: message.clientMessageId,
      retryOfMessageId: message.retryOfMessageId,
      editOfMessageId: message.editOfMessageId,
      action: message.action,
      retrievedKnowledge,
      references: workflowAgentReferencePayload(scopeId),
      context: workflowAgentRequestContext({
        nodeId: options.nodeId || scopeId,
        knowledgeRetrievalError: options.knowledgeRetrievalError,
        canvasAction: options.canvasAction
      })
    }
  )
  applyWorkflowAgentPersistedResult(result, scopeId)
  return result
}

function applyWorkflowAgentPersistedResult(result, scopeId = workflowAgentScopeId()) {
  if (result?.ok && result.data?.run) {
    state.activeWorkflowRun = result.data.run
    if (result.data?.quickReplies?.length) {
      state.activeWorkflowRun.agentQuickReplies ||= {}
      state.activeWorkflowRun.agentQuickReplies[scopeId] = result.data.quickReplies
    }
  }
}

async function persistWorkflowAgentMessageStream(message, options = {}) {
  const scopeId = options.scopeId || workflowAgentScopeId()
  if (!state.activeWorkflowRun || !scopeId) return
  let streamedContent = ''
  const streamEventState = options.streamEventState
  const retrievedKnowledge = Array.isArray(options.retrievedKnowledge)
    ? options.retrievedKnowledge
    : (await retrieveWorkflowKnowledge(workflowAgentMessageText(message), scopeId)).items
  const result = await api.workflows.appendMessageStream(
    state.apiConfig,
    state.activeWorkflowRun.id,
    scopeId,
    {
      model: workflowAgentModel.value,
      message,
      clientMessageId: message.clientMessageId,
      retryOfMessageId: message.retryOfMessageId,
      editOfMessageId: message.editOfMessageId,
      action: message.action,
      retrievedKnowledge,
      references: workflowAgentReferencePayload(scopeId),
      context: workflowAgentRequestContext({
        nodeId: options.nodeId || scopeId,
        knowledgeRetrievalError: options.knowledgeRetrievalError,
        canvasAction: options.canvasAction
      })
    },
    {
      onEvent: (event) => {
        if (options.requestToken && workflowAgentRequestToken.value !== options.requestToken) return
        if (streamEventState?.failed && event.type !== 'done') return
        if (event.type === 'status' && options.pendingMessageId) {
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            content: event.data?.label || workflowAgentStatusLabel(event.data?.status || 'generating'),
            meta: {
              ...(message.meta || {}),
              status: event.data?.status || 'generating',
              statusLabel: event.data?.label || workflowAgentStatusLabel(event.data?.status || 'generating'),
              clientMessageId: message.clientMessageId,
              retryOfMessageId: message.retryOfMessageId,
              editOfMessageId: message.editOfMessageId,
              action: message.action,
              retrievedKnowledge,
              knowledgeRetrievalError: options.knowledgeRetrievalError
            }
          }, scopeId)
        }
        if (event.type === 'delta' && options.pendingMessageId) {
          streamedContent += event.data?.content || event.data?.text || ''
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            role: 'assistant',
            content: workflowAgentStreamDisplayContent(streamedContent),
            meta: {
              ...(message.meta || {}),
              status: 'generating',
              statusLabel: workflowAgentStatusLabel('generating'),
              clientMessageId: message.clientMessageId,
              retryOfMessageId: message.retryOfMessageId,
              editOfMessageId: message.editOfMessageId,
              action: message.action,
              retrievedKnowledge,
              knowledgeRetrievalError: options.knowledgeRetrievalError
            }
          }, scopeId)
        }
        if (event.type === 'message' && event.data?.assistantMessage && options.pendingMessageId) {
          const assistantMessage = mergeWorkflowAgentStreamedAssistantMessage(event.data.assistantMessage, streamedContent)
          replaceWorkflowAgentMessage(options.pendingMessageId, normalizeWorkflowAgentAssistantMessage(assistantMessage, {
            clientMessageId: message.clientMessageId,
            retryOfMessageId: message.retryOfMessageId,
            editOfMessageId: message.editOfMessageId,
            action: message.action,
            retrievedKnowledge,
            knowledgeRetrievalError: options.knowledgeRetrievalError
          }), scopeId)
        }
        if (event.type === 'error' && options.pendingMessageId) {
          if (streamEventState) streamEventState.failed = true
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            role: 'assistant',
            content: event.data?.message || 'Agent 流式生成失败',
            meta: {
              ...(message.meta || {}),
              status: 'failed',
              statusLabel: workflowAgentStatusLabel('failed'),
              clientMessageId: message.clientMessageId,
              retryOfMessageId: message.retryOfMessageId,
              editOfMessageId: message.editOfMessageId,
              action: message.action,
              retrievedKnowledge,
              knowledgeRetrievalError: options.knowledgeRetrievalError,
              error: {
                message: event.data?.message || 'Agent 流式生成失败',
                code: event.data?.code || 'AGENT_STREAM_FAILED',
                ...(event.data || {})
              }
            }
          }, scopeId)
        }
        if (event.type === 'done') {
          applyWorkflowAgentPersistedResult({ ok: true, data: event.data }, scopeId)
        }
      },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    }
  )
  applyWorkflowAgentPersistedResult(result, scopeId)
  return result
}

function openWorkflowAgent() {
  const run = ensureActiveWorkflowRunForAgent()
  if (!run) {
    setStatus(skillWorkbenchStatus, 'failed', '当前没有可对话的分析画布，请先生成或打开一条页面蓝图。')
    return
  }
  workflowAgentNodeId.value = workflowAgentNodeId.value || workflowCanvasNodes.value?.[0]?.id || 'analysis'
  workflowAgentOpen.value = true
}

function toggleWorkflowAgentHistory() {
  workflowAgentHistoryOpen.value = !workflowAgentHistoryOpen.value
  if (workflowAgentHistoryOpen.value) workflowAgentUploadOpen.value = false
}

function toggleWorkflowAgentUploadMenu() {
  workflowAgentUploadOpen.value = !workflowAgentUploadOpen.value
  if (workflowAgentUploadOpen.value) workflowAgentHistoryOpen.value = false
}

function startWorkflowAgentResize(event) {
  event?.preventDefault?.()
  const startX = event?.clientX || 0
  const startWidth = workflowAgentDrawerWidth.value
  const minWidth = 420
  const maxWidth = Math.max(minWidth, window.innerWidth - 220)

  const move = (moveEvent) => {
    const delta = startX - moveEvent.clientX
    workflowAgentDrawerWidth.value = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}

async function addFeishuReferencePlaceholder() {
  const references = ensureWorkflowReferenceFiles()
  const reference = {
    id: crypto.randomUUID(),
    name: '飞书云文档引用',
    kind: 'cloud-doc',
    status: 'pending',
    text: '待接入飞书开放平台授权后读取正文。'
  }
  references.push(reference)
  const referenceId = reference.id
  workflowAgentUploadOpen.value = false
  try {
    await persistWorkflowAgentMessage({
      role: 'user',
      content: `已添加云文档引用：${reference.name}。请在后续生成时等待后端解析或提示需要授权。`
    })
    setStatus(skillWorkbenchStatus, 'success', '已添加飞书云文档占位引用')
  } catch (error) {
    references.splice(0, references.length, ...references.filter((file) => file.id !== referenceId))
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `添加飞书云文档失败：${error.message}` : '添加飞书云文档失败，已回滚引用')
  }
}

async function runWorkflowArtifactAction(stageId, options = {}) {
  if (!state.activeWorkflowRun) await startWorkflowRun({ auto: true })
  if (!state.activeWorkflowRun) return
  state.activeWorkflowRun.demoArtifacts ||= {}
  const shouldAppendMessage = !options.silent
  if (stageId === 'blueprint') {
    attachProjectBlueprint()
    if (shouldAppendMessage) appendWorkflowAgentMessage('assistant', '已生成详细蓝图，包含项目档案、交互路径树、页面细节、异常状态和评审清单。')
    setStatus(skillWorkbenchStatus, 'success', '已生成详细蓝图')
  } else if (stageId === 'lofi') {
    const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
    state.activeWorkflowRun.demoArtifacts.lowFi = {
      createdAt: new Date().toISOString(),
      screens: blueprint?.demoScreens || []
    }
    if (shouldAppendMessage) appendWorkflowAgentMessage('assistant', '已生成低保真线框：每个页面包含布局、控件、主操作和跳转说明。')
    setStatus(skillWorkbenchStatus, 'success', '已生成低保真')
  } else if (stageId === 'html-demo') {
    generateBlueprintDemoPreview()
    state.activeWorkflowRun.demoArtifacts.html = blueprintDemoHtml.value
    if (shouldAppendMessage) appendWorkflowAgentMessage('assistant', '已生成可交互 HTML Demo，可在蓝图 Demo 区打开预览或继续刷新版本。')
    setStatus(skillWorkbenchStatus, 'success', '已生成可交互 HTML Demo')
  } else if (stageId === 'vue-export') {
    if (!blueprintDemoHtml.value) generateBlueprintDemoPreview()
    state.activeWorkflowRun.demoArtifacts.vueZipReady = true
    state.activeWorkflowRun.demoArtifacts.html = blueprintDemoHtml.value
    if (shouldAppendMessage) appendWorkflowAgentMessage('assistant', 'Vue 工程导出已准备好。已按前端工程文件结构生成下载包。')
    await downloadBlueprintVueZip()
  }
}

async function sendWorkflowAgentMessage(text = workflowAgentInput.value, options = {}) {
  const content = String(text || '').trim()
  const targetScopeId = options.nodeId || workflowAgentScopeId()
  if (!content || !state.activeWorkflowRun || workflowAgentSending.value || !targetScopeId) return
  const requestToken = crypto.randomUUID()
  const clientMessageId = options.clientMessageId || crypto.randomUUID()
  const editOfMessageId = options.editOfMessageId || (options.ignoreDraftState ? '' : workflowAgentEditingMessageId.value) || ''
  const retryOfMessageId = options.retryOfMessageId || (options.ignoreDraftState ? '' : workflowAgentRetryMessageId.value) || ''
  const messageAction = options.action || (editOfMessageId ? 'edit-resend' : retryOfMessageId ? 'retry' : 'send')
  const effectiveMessageAction = messageAction
  workflowAgentRequestToken.value = requestToken
  workflowAgentStreamController.value?.abort?.()
  workflowAgentStreamController.value = new AbortController()
  workflowAgentHistoryOpen.value = false
  workflowAgentUploadOpen.value = false
  closeWorkflowAgentConfirmPreview()
  workflowAgentSending.value = true
  workflowAgentActiveDraft.value = content
  workflowAgentActiveDraftMeta.value = {
    editOfMessageId,
    retryOfMessageId,
    retryTargetMessageId: workflowAgentRetryTargetMessageId.value
  }
  workflowAgentInput.value = ''
  clearWorkflowAgentDraftState()
  const userMessageId = appendWorkflowAgentMessage('user', content, {
    scopeId: targetScopeId,
    id: options.userMessageId || clientMessageId,
    meta: {
      clientMessageId,
      retryOfMessageId,
      editOfMessageId,
      action: effectiveMessageAction
    }
  })
  const pendingMessageId = appendWorkflowAgentMessage('assistant', '正在生成 Agent 回复...', {
    scopeId: targetScopeId,
    meta: {
      status: 'pending',
      statusLabel: workflowAgentStatusLabel('pending'),
      clientMessageId,
      retryOfMessageId,
      editOfMessageId,
      action: effectiveMessageAction
    }
  })
  workflowAgentPendingMessageId.value = pendingMessageId
  workflowAgentPendingScopeId.value = targetScopeId
  try {
    replaceWorkflowAgentMessage(pendingMessageId, {
      content: '正在检索项目知识与当前节点上下文...',
      meta: {
        status: 'retrieving',
        statusLabel: workflowAgentStatusLabel('retrieving'),
        clientMessageId,
        retryOfMessageId,
        editOfMessageId,
        action: messageAction
      }
    }, targetScopeId)
    const knowledgeResult = await retrieveWorkflowKnowledge(content, targetScopeId)
    const retrievedKnowledge = knowledgeResult.items
    if (workflowAgentRequestToken.value !== requestToken) return
    replaceWorkflowAgentMessage(pendingMessageId, {
      content: knowledgeResult.error
        ? '知识检索失败，正在基于当前画布生成回复...'
        : retrievedKnowledge.length
        ? `已检索到 ${retrievedKnowledge.length} 条项目知识，正在生成回复...`
        : '未命中项目知识，正在基于当前画布生成回复...',
      meta: {
        status: 'generating',
        statusLabel: workflowAgentStatusLabel('generating'),
        clientMessageId,
        retryOfMessageId,
        editOfMessageId,
        action: messageAction,
        retrievedKnowledge,
        knowledgeRetrievalError: knowledgeResult.error
      }
    }, targetScopeId)
    const streamEventState = { failed: false }
    const pendingStreamOptions = {
      scopeId: targetScopeId,
      retrievedKnowledge,
      knowledgeRetrievalError: knowledgeResult.error,
      canvasAction: options.canvasAction || null,
      pendingMessageId,
      requestToken,
      streamEventState,
      signal: workflowAgentStreamController.value.signal,
      timeoutMs: workflowAgentRequestTimeoutMs()
    }
    const persisted = await persistWorkflowAgentMessageStream({
      role: 'user',
      content,
      clientMessageId,
      retryOfMessageId,
      editOfMessageId,
      action: messageAction
    }, pendingStreamOptions)
    if (workflowAgentRequestToken.value !== requestToken) return
    const backendCancelled = Boolean(persisted?.data?.cancelled)
    if (backendCancelled) {
      replaceWorkflowAgentMessage(pendingMessageId, {
        role: 'assistant',
        content: '已停止生成。本次回复没有写入会话，可以点击重试重新发送。',
        meta: {
          status: 'cancelled',
          statusLabel: workflowAgentStatusLabel('cancelled'),
          clientMessageId,
          retryOfMessageId,
          editOfMessageId,
          action: messageAction
        }
      })
      restoreWorkflowAgentActiveDraft()
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      return
    }
    const backendHandled = Boolean(persisted?.ok && persisted.data?.assistantMessage)
    if (streamEventState.failed && !backendHandled) {
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      clearWorkflowAgentActiveDraft()
      return
    }
    if (backendHandled) {
      const currentPendingMessage = workflowAgentMessageById(pendingMessageId, targetScopeId)
      const streamedReplyContent = streamEventState.failed ? '' : workflowAgentMessageText(currentPendingMessage)
      const assistantMessage = normalizeWorkflowAgentAssistantMessage(mergeWorkflowAgentStreamedAssistantMessage(persisted.data.assistantMessage, streamedReplyContent), {
        clientMessageId,
        retryOfMessageId,
        editOfMessageId,
        action: messageAction,
        retrievedKnowledge,
        knowledgeRetrievalError: knowledgeResult.error
      })
      await typeWorkflowAgentAssistantMessage(pendingMessageId, assistantMessage, { requestToken, scopeId: targetScopeId })
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      clearWorkflowAgentActiveDraft()
      return
    } else {
      const failureView = workflowAgentFailureView(persisted)
      replaceWorkflowAgentMessage(pendingMessageId, {
        role: 'assistant',
        content: failureView.content,
        meta: {
          status: 'failed',
          statusLabel: workflowAgentStatusLabel('failed'),
          clientMessageId,
          retryOfMessageId,
          editOfMessageId,
          action: messageAction,
          retrievedKnowledge,
          knowledgeRetrievalError: knowledgeResult.error,
          error: {
            message: failureView.message,
            code: failureView.code,
            recoveryActions: failureView.recoveryActions
          }
        }
      }, targetScopeId)
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      clearWorkflowAgentActiveDraft()
      return
    }

  } catch (error) {
    if (workflowAgentRequestToken.value !== requestToken) return
    replaceWorkflowAgentMessage(pendingMessageId, {
      role: 'assistant',
      content: '发送失败，请检查后端服务或稍后重试。',
      meta: {
        status: 'failed',
        statusLabel: workflowAgentStatusLabel('failed'),
        clientMessageId,
        retryOfMessageId,
        editOfMessageId,
        action: effectiveMessageAction,
        error: {
          message: error.message || 'Agent 消息发送失败'
        }
      }
    }, targetScopeId)
    clearWorkflowAgentActiveDraft()
    workflowAgentPendingMessageId.value = ''
    workflowAgentPendingScopeId.value = ''
  } finally {
    void userMessageId
    if (workflowAgentRequestToken.value === requestToken) {
      workflowAgentSending.value = false
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      workflowAgentStreamController.value = null
      workflowAgentDrawerRef.value?.focusComposer?.()
    }
  }
}

function useWorkflowAgentQuickReply(reply) {
  const content = String(reply || '').trim()
  if (!content) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可发送的快捷回复')
    return
  }
  if (workflowAgentSending.value) {
    setStatus(skillWorkbenchStatus, 'failed', 'Agent 正在生成回复，请等待当前结果返回后再发送。')
    return
  }
  if (isWorkflowAgentCanvasAdviceQuickReply(content)) {
    sendWorkflowAgentCanvasAction(content, workflowAgentScopeId())
    return
  }
  void sendWorkflowAgentMessage(content, { ignoreDraftState: true })
}

async function copyWorkflowAgentMessage(message) {
  const text = workflowAgentMessageText(message).trim()
  if (!text) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可复制的消息内容')
    return
  }
  try {
    await copyTextToClipboard(text)
    setStatus(skillWorkbenchStatus, 'success', '已复制消息')
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', error.message || '复制失败')
  }
}

async function copyTextToClipboard(text = '') {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    const copied = document.execCommand('copy')
    if (!copied) throw new Error('复制命令未被浏览器接受')
  } finally {
    document.body.removeChild(textarea)
  }
}

function retryWorkflowAgentConfirmCanvas(message) {
  const confirmedContent = (message?.meta?.confirmedContent || workflowAgentMessageText(message)).trim()
  const proposalId = message?.meta?.proposalId || ''
  if (!confirmedContent) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可重新写入画布的确认内容')
    return
  }
  if (!proposalId) {
    setStatus(skillWorkbenchStatus, 'failed', '这条失败消息没有可重试的后端提案')
    return
  }
  void confirmWorkflowAgentMessage({
    id: message?.id || '',
    content: confirmedContent,
    nodeId: message?.meta?.nodeId,
    meta: {
      proposalId
    }
  })
}

function retryInvalidWorkflowAgentPatch(message) {
  const session = ensureWorkflowAgentSession()
  const index = session.findIndex((item) => item.id === message?.id)
  const previousUser = [...session.slice(0, Math.max(index, 0))].reverse().find((item) => item.role === 'user')
  const content = (workflowAgentMessageText(previousUser) || message?.meta?.confirmedContent || workflowAgentMessageText(message)).trim()
  if (!content) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可重新生成的消息内容')
    return
  }
  closeWorkflowAgentConfirmPreview()
  workflowAgentRetryMessageId.value = message?.id || ''
  workflowAgentRetryTargetMessageId.value = previousUser?.id || ''
  workflowAgentEditingMessageId.value = ''
  workflowAgentInput.value = content
  workflowAgentDrawerRef.value?.focusComposer?.()
  setStatus(skillWorkbenchStatus, 'success', '已放回输入框，确认后重新生成建议')
}

function retryWorkflowAgentMessage(message) {
  if (message?.meta?.action === 'confirm-canvas') {
    if (message?.meta?.error?.code === 'AGENT_MODEL_PATCH_INVALID' ||
      workflowAgentStaleProposalErrorCodes.includes(message?.meta?.error?.code)) {
      retryInvalidWorkflowAgentPatch(message)
      return
    }
    const confirmedContent = (message?.meta?.confirmedContent || workflowAgentMessageText(message)).trim()
    const proposalId = message?.meta?.proposalId || ''
    if (!confirmedContent) {
      setStatus(skillWorkbenchStatus, 'failed', '没有可重新写入画布的确认内容')
      return
    }
    if (!proposalId) {
      setStatus(skillWorkbenchStatus, 'failed', '这条失败消息没有可重试的后端提案')
      return
    }
    void confirmWorkflowAgentMessage({
      id: message?.id || '',
      content: confirmedContent,
      nodeId: message?.meta?.nodeId,
      meta: {
        proposalId
      }
    })
    return
  }
  const session = ensureWorkflowAgentSession()
  const index = session.findIndex((item) => item.id === message?.id)
  const previousUser = [...session.slice(0, Math.max(index, 0))].reverse().find((item) => item.role === 'user')
  const content = (workflowAgentMessageText(previousUser) || workflowAgentMessageText(message)).trim()
  if (!content) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可重新生成的消息内容')
    return
  }
  closeWorkflowAgentConfirmPreview()
  workflowAgentRetryMessageId.value = message?.id || ''
  workflowAgentRetryTargetMessageId.value = previousUser?.id || ''
  workflowAgentEditingMessageId.value = ''
  workflowAgentInput.value = content
  workflowAgentDrawerRef.value?.focusComposer?.()
  setStatus(skillWorkbenchStatus, 'success', '已放回输入框，确认后重新生成')
}

function recoverWorkflowAgentMessage(message, action = '') {
  if (action === '重试保存') {
    void retrySaveWorkflowAgentConfirmedCanvas(message)
    return
  }
  if (action === '重试确认') {
    const confirmedContent = (message?.meta?.confirmedContent || workflowAgentMessageText(message)).trim()
    const proposalId = message?.meta?.proposalId || ''
    if (!confirmedContent) {
      setStatus(skillWorkbenchStatus, 'failed', '没有可重新写入画布的确认内容')
      return
    }
    if (!proposalId) {
      setStatus(skillWorkbenchStatus, 'failed', '这条失败消息没有可重试的后端提案')
      return
    }
    void confirmWorkflowAgentMessage({
      id: message?.id || '',
      content: confirmedContent,
      nodeId: message?.meta?.nodeId,
      meta: { proposalId }
    })
    return
  }
  if (action === '重新生成建议') {
    retryInvalidWorkflowAgentPatch(message)
    return
  }
  retryWorkflowAgentMessage(message)
}

function applyWorkflowAgentConfirmedCanvasResult(data = {}, targetNodeId = '') {
  if (!data?.analysis) throw new Error('后端没有返回完整画布')
  workflowAnalysisResult.value = data.analysis
  if (data.run) {
    state.activeWorkflowRun = data.run
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, data.run)
  } else if (state.activeWorkflowRun) {
    const nextRun = {
      ...state.activeWorkflowRun,
      documentAnalysis: data.analysis,
      projectBlueprint: data.analysis.blueprint || state.activeWorkflowRun.projectBlueprint,
      updatedAt: new Date().toISOString()
    }
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
  }
  workflowAgentNodeId.value = targetNodeId || data.analysis.canvas?.nodes?.[0]?.id || 'analysis'
  workflowFullscreenNodeId.value = ''
}

async function retrySaveWorkflowAgentConfirmedCanvas(message) {
  const proposalId = message?.meta?.proposalId || ''
  const targetNodeId = workflowAgentResolvedNodeId(message?.meta?.nodeId || message?.nodeId)
  const pendingResult = {
    run: message?.meta?.error?.run,
    analysis: message?.meta?.error?.analysis,
    appliedPatch: message?.meta?.error?.appliedPatch || message?.meta?.appliedPatch || null
  }
  if (!proposalId) {
    setStatus(skillWorkbenchStatus, 'failed', '这条失败消息没有可重试保存的后端提案')
    return
  }
  if (!pendingResult.run || !pendingResult.analysis) {
    setStatus(skillWorkbenchStatus, 'failed', '缺少可重试保存的画布结果，请重新生成建议')
    return
  }
  workflowAgentSending.value = true
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId
  setStatus(skillWorkbenchStatus, 'loading', '正在重试保存已生成的画布结果...')
  try {
    const result = await api.workflows.saveConfirmedProposal(state.apiConfig, pendingResult.run.id || state.activeWorkflowRun?.id || '', proposalId, pendingResult, {
      timeoutMs: 30000
    })
    if (!result.ok) {
      const resultError = new Error(result?.data?.error?.message || result?.data?.message || result.message || '重试保存失败')
      resultError.code = result?.data?.error?.code || result?.data?.code || result.status || ''
      resultError.recoveryActions = result?.data?.error?.recoveryActions || ['重试保存', '重新生成建议']
      throw resultError
    }
    const data = applyApiResult(skillWorkbenchStatus, result, '重试保存失败')
    applyWorkflowAgentConfirmedCanvasResult(data, targetNodeId)
    replaceWorkflowAgentMessage(message.id, {
      role: 'assistant',
      content: workflowAgentConfirmSuccessContent(data.appliedPatch),
      meta: {
        status: 'success',
        statusLabel: workflowAgentStatusLabel('success'),
        action: 'confirm-canvas',
        proposalId,
        nodeId: targetNodeId,
        appliedPatch: data.appliedPatch || null,
        changedNodeIds: data.appliedPatch?.changedNodeIds || [],
        refreshReason: data.appliedPatch?.reason || '',
        saveIdempotent: Boolean(data.idempotent)
      }
    })
    clearWorkflowAgentActiveDraft()
    setStatus(skillWorkbenchStatus, 'success', '已保存画布并刷新后续节点')
  } catch (error) {
    const recoveryActions = workflowAgentConfirmRecoveryActions(error)
    const failureContent = workflowAgentConfirmFailureContent(error)
    replaceWorkflowAgentMessage(message.id, {
      role: 'assistant',
      content: failureContent,
      meta: {
        ...(message?.meta || {}),
        status: 'failed',
        statusLabel: workflowAgentStatusLabel('failed'),
        action: 'confirm-canvas',
        proposalId,
        nodeId: targetNodeId,
        error: {
          ...(message?.meta?.error || {}),
          message: error.message || failureContent,
          code: error?.code || message?.meta?.error?.code || 'AGENT_CONFIRM_PERSIST_FAILED',
          recoveryActions: [...recoveryActions]
        }
      }
    })
    setStatus(skillWorkbenchStatus, 'failed', failureContent)
  } finally {
    workflowAgentSending.value = false
    workflowCanvasLoading.value = false
    workflowCanvasRefreshingNodeId.value = ''
    workflowAgentDrawerRef.value?.focusComposer?.()
  }
}

function editWorkflowAgentMessage(message) {
  const content = workflowAgentMessageText(message).trim()
  if (!content) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可编辑重发的消息内容')
    return
  }
  closeWorkflowAgentConfirmPreview()
  workflowAgentEditingMessageId.value = message?.id || ''
  workflowAgentRetryMessageId.value = ''
  workflowAgentRetryTargetMessageId.value = ''
  workflowAgentInput.value = content
  workflowAgentDrawerRef.value?.focusComposer?.()
  setStatus(skillWorkbenchStatus, 'success', '已放回输入框，可编辑后重新发送')
}

function cancelWorkflowAgentEdit() {
  clearWorkflowAgentDraftState()
  workflowAgentInput.value = ''
  workflowAgentDrawerRef.value?.focusComposer?.()
}

function workflowAgentConfirmPreviewSourceKey(item = {}, index = 0) {
  return `${item.type || 'source'}-${item.title || item.snippet || index}-${index}`
}

function cancelWorkflowAgentRetry() {
  clearWorkflowAgentDraftState()
  workflowAgentInput.value = ''
  workflowAgentDrawerRef.value?.focusComposer?.()
}

function openWorkflowAgentConfirmPreview(message) {
  const confirmedContent = workflowAgentMessageText(message).trim()
  if (!confirmedContent) return
  const proposalId = message?.meta?.proposalId || ''
  if (!proposalId) {
    setStatus(skillWorkbenchStatus, 'failed', '这条 Agent 回复没有可写入画布的提案')
    return
  }
  const nodeId = workflowAgentResolvedNodeId(message?.meta?.nodeId)
  const node = canvasNodeById(nodeId) || workflowAgentNode.value || workflowCanvasNodes.value[0] || null
  const downstream = workflowCanvasDownstreamNodes(node?.id || nodeId)
  const proposalSummary = message?.meta?.proposalSummary && typeof message.meta.proposalSummary === 'object' && !Array.isArray(message.meta.proposalSummary)
    ? message.meta.proposalSummary
    : {}
  const writeableContent = proposalSummary.writeableContent && typeof proposalSummary.writeableContent === 'object' && !Array.isArray(proposalSummary.writeableContent)
    ? proposalSummary.writeableContent
    : {}
  const downstreamImpact = Array.isArray(proposalSummary.downstreamImpact)
    ? proposalSummary.downstreamImpact.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    : []
  clearWorkflowAgentDraftState()
  workflowAgentInput.value = ''
  workflowAgentConfirmPreview.open = true
  workflowAgentConfirmPreview.messageId = message.id || ''
  workflowAgentConfirmPreview.proposalId = proposalId
  workflowAgentConfirmPreview.content = confirmedContent
  workflowAgentConfirmPreview.nodeId = node?.id || nodeId
  workflowAgentConfirmPreview.nodeTitle = node?.title || '当前画布'
  workflowAgentConfirmPreview.summary = `将写入「${workflowAgentConfirmPreview.nodeTitle}」`
  workflowAgentConfirmPreview.refreshScopeLabel = downstream.length
    ? `后续刷新 ${downstream.length} 个节点`
    : '仅刷新当前节点'
  workflowAgentConfirmPreview.actionIntent = String(proposalSummary.actionIntent || '').trim()
  workflowAgentConfirmPreview.writeableItems = Array.isArray(writeableContent.items)
    ? writeableContent.items.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : []
  workflowAgentConfirmPreview.acceptanceCriteria = Array.isArray(writeableContent.acceptanceCriteria)
    ? writeableContent.acceptanceCriteria.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : []
  workflowAgentConfirmPreview.rationale = Array.isArray(proposalSummary.rationale)
    ? proposalSummary.rationale.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : []
  workflowAgentConfirmPreview.contextSources = Array.isArray(proposalSummary.contextSources)
    ? proposalSummary.contextSources
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          type: item.type || item.sourceType || 'context',
          title: item.title || item.sourceTitle || '上下文',
          snippet: item.snippet || item.content || '',
          matchReason: item.matchReason || item.reason || ''
        }))
        .slice(0, 6)
    : []
  workflowAgentConfirmPreview.downstream = downstream.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => {
    const impact = downstreamImpact.find((impactItem) => (impactItem.nodeId || impactItem.id) === item.id)
    return {
      id: item.id,
      title: item.title || item.id,
      reason: impact?.reason || ''
    }
  })
}

function closeWorkflowAgentConfirmPreview() {
  workflowAgentConfirmPreview.open = false
  workflowAgentConfirmPreview.messageId = ''
  workflowAgentConfirmPreview.proposalId = ''
  workflowAgentConfirmPreview.content = ''
  workflowAgentConfirmPreview.summary = ''
  workflowAgentConfirmPreview.refreshScopeLabel = ''
  workflowAgentConfirmPreview.nodeId = ''
  workflowAgentConfirmPreview.nodeTitle = ''
  workflowAgentConfirmPreview.actionIntent = ''
  workflowAgentConfirmPreview.writeableItems = []
  workflowAgentConfirmPreview.acceptanceCriteria = []
  workflowAgentConfirmPreview.rationale = []
  workflowAgentConfirmPreview.contextSources = []
  workflowAgentConfirmPreview.downstream = []
}

function openWorkflowAgentConfirmPreviewEditor() {
  const targetNodeId = workflowAgentResolvedNodeId(workflowAgentConfirmPreview.nodeId)
  if (!targetNodeId) {
    setStatus(skillWorkbenchStatus, 'failed', '没有找到可编辑的画布节点')
    return
  }
  workflowAgentNodeId.value = targetNodeId
  workflowFullscreenNodeId.value = targetNodeId
  workflowFullscreenEditNodeId.value = targetNodeId
  closeWorkflowAgentConfirmPreview()
}

function workflowAgentConfirmSuccessContent(appliedPatch = {}) {
  const changedNodeIds = Array.isArray(appliedPatch?.changedNodeIds)
    ? appliedPatch.changedNodeIds.filter(Boolean)
    : []
  const lines = ['已写入画布并刷新后续节点。']
  if (changedNodeIds.length) lines.push(`刷新节点：${changedNodeIds.join('、')}`)
  if (appliedPatch?.reason) lines.push(`刷新原因：${appliedPatch.reason}`)
  return lines.join('\n')
}

function workflowAgentConfirmPreviewNodeKey(node = {}, index = 0) {
  return node.id || node.title || `confirm-downstream-${index}`
}

function submitWorkflowAgentConfirmPreview() {
  if (workflowAgentSending.value) return
  confirmWorkflowAgentMessage({
    id: workflowAgentConfirmPreview.messageId,
    meta: {
      proposalId: workflowAgentConfirmPreview.proposalId
    },
    content: workflowAgentConfirmPreview.content,
    nodeId: workflowAgentConfirmPreview.nodeId
  })
  closeWorkflowAgentConfirmPreview()
}

function workflowAgentConfirmFailureContent(error = {}) {
  const errorCode = error?.code || error?.data?.error?.code || error?.data?.code || ''
  const isInvalidModelPatch = errorCode === 'AGENT_MODEL_PATCH_INVALID'
  const isStaleProposal = workflowAgentStaleProposalErrorCodes.includes(errorCode)
  const isPersistFailure = errorCode === 'AGENT_CONFIRM_PERSIST_FAILED'
  const isTimeout = errorCode === 'TIMEOUT' ||
    errorCode === 'AGENT_CONFIRM_TIMEOUT' ||
    error?.timeout ||
    error?.timedOut ||
    /timeout|超时/i.test(String(error?.message || ''))
  if (isInvalidModelPatch) return '模型返回内容不可写入画布，请重试确认或重新生成建议。'
  if (isStaleProposal) return '这条提案已失效或已处理，请重新生成建议后再写入画布。'
  if (isPersistFailure) return '画布已生成但保存失败，请重试保存或重新生成建议。'
  if (isTimeout) return '确认入画布超时，请稍后重试或重新生成建议。'
  return error?.message ? `确认入画布失败：${error.message}` : '确认入画布失败，请重试。'
}

function workflowAgentConfirmRecoveryActions(error = {}) {
  if (Array.isArray(error?.recoveryActions) && error.recoveryActions.length) return error.recoveryActions
  const errorCode = error?.code || error?.data?.error?.code || error?.data?.code || ''
  const isInvalidModelPatch = errorCode === 'AGENT_MODEL_PATCH_INVALID'
  const isStaleProposal = workflowAgentStaleProposalErrorCodes.includes(errorCode)
  const isPersistFailure = errorCode === 'AGENT_CONFIRM_PERSIST_FAILED'
  const isTimeout = errorCode === 'TIMEOUT' ||
    errorCode === 'AGENT_CONFIRM_TIMEOUT' ||
    error?.timeout ||
    error?.timedOut ||
    /timeout|超时/i.test(String(error?.message || ''))
  if (isPersistFailure) return ['重试保存', '重新生成建议']
  return isInvalidModelPatch || isStaleProposal || isTimeout
    ? ['重试确认', '重新生成建议']
    : ['重试确认']
}

async function confirmWorkflowAgentMessage(message) {
  const proposalId = message?.meta?.proposalId || ''
  const confirmedContent = workflowAgentMessageText(message).trim()
  if (!proposalId) {
    setStatus(skillWorkbenchStatus, 'failed', '这条 Agent 回复没有可确认的后端提案')
    return
  }
  if (!confirmedContent) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可写入画布的确认内容')
    return
  }
  if (!state.activeWorkflowRun) return
  const targetNodeId = workflowAgentResolvedNodeId(message?.nodeId || message?.meta?.nodeId)
  const targetScopeId = targetNodeId || workflowAgentScopeId()
  const requestToken = crypto.randomUUID()
  const clientMessageId = crypto.randomUUID()
  workflowAgentRequestToken.value = requestToken
  workflowAgentStreamController.value?.abort?.()
  workflowAgentStreamController.value = new AbortController()
  workflowAgentSending.value = true
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId
  const pendingMessageId = appendWorkflowAgentMessage('assistant', '正在写入画布并刷新后续节点...', {
    scopeId: targetScopeId,
    meta: {
      status: 'merging-canvas',
      statusLabel: workflowAgentStatusLabel('merging-canvas'),
      action: 'confirm-canvas',
      proposalId,
      confirmedContent,
      nodeId: targetNodeId,
      clientMessageId
    }
  })
  workflowAgentPendingMessageId.value = pendingMessageId
  workflowAgentPendingScopeId.value = targetScopeId
  const confirmStreamEventState = { failed: false }
  setStatus(skillWorkbenchStatus, 'loading', '后端正在根据 Agent 提案重建当前和后续画布...')
  try {
    const result = await api.workflows.confirmProposalStream(state.apiConfig, state.activeWorkflowRun.id, proposalId, {
      nodeId: targetNodeId,
      conversationId: targetScopeId,
      confirmMode: 'merge-current-and-downstream'
    }, {
      timeoutMs: workflowAgentRequestTimeoutMs(),
      signal: workflowAgentStreamController.value.signal,
      onEvent: (event) => {
        if (workflowAgentRequestToken.value !== requestToken) return
        if (confirmStreamEventState.failed && event.type !== 'done') return
        if (event.type === 'status' && pendingMessageId) {
          replaceWorkflowAgentMessage(pendingMessageId, {
            role: 'assistant',
            content: event.data?.label || '正在写入画布并刷新后续节点...',
            meta: {
              status: event.data?.status || 'merging-canvas',
              statusLabel: event.data?.label || workflowAgentStatusLabel('merging-canvas'),
              progressStep: event.data?.step,
              action: 'confirm-canvas',
              proposalId,
              confirmedContent,
              nodeId: targetNodeId,
              clientMessageId
            }
          }, targetScopeId)
        }
        if (event.type === 'error' && pendingMessageId) {
          confirmStreamEventState.failed = true
          const failureContent = workflowAgentConfirmFailureContent(event.data)
          const recoveryActions = workflowAgentConfirmRecoveryActions(event.data)
          replaceWorkflowAgentMessage(pendingMessageId, {
            role: 'assistant',
            content: failureContent,
            meta: {
              status: 'failed',
              statusLabel: workflowAgentStatusLabel('failed'),
              action: 'confirm-canvas',
              proposalId,
              confirmedContent,
              nodeId: targetNodeId,
              clientMessageId,
              error: {
                message: event.data?.message || failureContent,
                code: event.data?.code || 'AGENT_CONFIRM_CANVAS_FAILED',
                recoveryActions: [...recoveryActions],
                run: event.data?.run || null,
                analysis: event.data?.analysis || null,
                appliedPatch: event.data?.appliedPatch || null
              }
            }
          }, targetScopeId)
          setStatus(skillWorkbenchStatus, 'failed', failureContent)
        }
      }
    })
    if (workflowAgentRequestToken.value !== requestToken) return
    if (confirmStreamEventState.failed) return
    if (!result.ok) {
      const resultError = new Error(result?.data?.error?.message || result?.data?.message || result.message || '确认入画布失败')
      resultError.code = result?.data?.error?.code || result?.data?.code || result.status || ''
      resultError.recoveryActions = result?.data?.error?.recoveryActions || []
      throw resultError
    }
    const data = applyApiResult(skillWorkbenchStatus, result, '确认入画布失败')
    applyWorkflowAgentConfirmedCanvasResult(data, targetNodeId)
    const confirmSuccessContent = workflowAgentConfirmSuccessContent(data.appliedPatch)
    replaceWorkflowAgentMessage(pendingMessageId, {
      role: 'assistant',
      content: confirmSuccessContent,
      meta: {
        status: 'success',
        statusLabel: workflowAgentStatusLabel('success'),
        action: 'confirm-canvas',
        proposalId,
        confirmedContent,
        nodeId: targetNodeId,
        clientMessageId,
        appliedPatch: data.appliedPatch || null,
        changedNodeIds: data.appliedPatch?.changedNodeIds || [],
        refreshReason: data.appliedPatch?.reason || ''
      }
    }, targetScopeId)
    clearWorkflowAgentActiveDraft()
    setStatus(skillWorkbenchStatus, 'success', '已写入画布并刷新后续节点')
  } catch (error) {
    if (workflowAgentRequestToken.value !== requestToken) return
    const errorCode = error?.code || error?.data?.error?.code || error?.data?.code || ''
    const recoveryActions = workflowAgentConfirmRecoveryActions(error)
    const failureContent = workflowAgentConfirmFailureContent(error)
    replaceWorkflowAgentMessage(pendingMessageId, {
      role: 'assistant',
      content: failureContent,
      meta: {
        status: 'failed',
        statusLabel: workflowAgentStatusLabel('failed'),
        action: 'confirm-canvas',
        proposalId,
        confirmedContent,
        nodeId: targetNodeId,
        clientMessageId,
        error: {
          message: error.message || failureContent,
          code: errorCode || 'AGENT_CONFIRM_CANVAS_FAILED',
          recoveryActions: [...recoveryActions],
          run: error?.run || error?.data?.error?.run || null,
          analysis: error?.analysis || error?.data?.error?.analysis || null,
          appliedPatch: error?.appliedPatch || error?.data?.error?.appliedPatch || null
        }
      }
    }, targetScopeId)
    setStatus(skillWorkbenchStatus, 'failed', failureContent)
  } finally {
    if (workflowAgentRequestToken.value === requestToken) {
      workflowAgentSending.value = false
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      workflowCanvasLoading.value = false
      workflowCanvasRefreshingNodeId.value = ''
      workflowAgentStreamController.value = null
      workflowAgentDrawerRef.value?.focusComposer?.()
    }
  }
}

async function stopWorkflowAgentGeneration() {
  if (!workflowAgentPendingMessageId.value) {
    workflowAgentStreamController.value?.abort?.()
    workflowAgentStreamController.value = null
    workflowAgentRequestToken.value = ''
    workflowAgentSending.value = false
    workflowAgentPendingScopeId.value = ''
    restoreWorkflowAgentActiveDraft()
    workflowAgentDrawerRef.value?.focusComposer?.()
    return
  }
  const pendingScopeId = workflowAgentPendingScopeId.value || workflowAgentScopeId()
  const pendingMessage = workflowAgentPendingMessageId.value
    ? ensureWorkflowAgentSession(pendingScopeId).find((message) => message.id === workflowAgentPendingMessageId.value)
    : null
  const pendingMeta = pendingMessage?.meta || {}
  const clientMessageId = pendingMeta.clientMessageId || ''
  workflowAgentStreamController.value?.abort?.()
  workflowAgentStreamController.value = null
  if (workflowAgentPendingMessageId.value) {
    replaceWorkflowAgentMessage(workflowAgentPendingMessageId.value, {
      role: 'assistant',
      content: '已停止生成。本次迟到回复不会写入当前会话，可以点击重试重新发送。',
      meta: {
        status: 'cancelled',
        statusLabel: workflowAgentStatusLabel('cancelled'),
        clientMessageId,
        retryOfMessageId: pendingMeta.retryOfMessageId,
        editOfMessageId: pendingMeta.editOfMessageId,
        action: pendingMeta.action || 'cancel',
        confirmedContent: pendingMeta.confirmedContent,
        nodeId: pendingMeta.nodeId
      }
    }, pendingScopeId)
  }
  workflowAgentRequestToken.value = ''
  workflowAgentSending.value = false
  restoreWorkflowAgentActiveDraft()
  let cancelFailed = false
  try {
    await api.workflows.cancelMessage(state.apiConfig, state.activeWorkflowRun?.id || '', {
      stepId: pendingScopeId,
      clientMessageId
    })
  } catch (error) {
    cancelFailed = true
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `取消请求未完成：${error.message}` : '取消请求未完成，但本地已停止展示')
  }
  workflowAgentPendingMessageId.value = ''
  workflowAgentPendingScopeId.value = ''
  if (!cancelFailed) setStatus(skillWorkbenchStatus, 'success', '已停止生成，迟到回复不会写入当前会话')
  workflowAgentDrawerRef.value?.focusComposer?.()
}

async function runWorkflowWorkbenchAction(actionId) {
  if (!state.activeWorkflowRun) return
  if (actionId === 'generate') {
    await generateWorkflowStepOutput()
  } else if (actionId === 'accept-next') {
    await acceptWorkflowStep()
    await confirmWorkflowStep()
  } else if (actionId === 'next') {
    await confirmWorkflowStep()
  } else if (actionId === 'use-example') {
    fillWorkflowStepWithDefaults('example')
  } else if (actionId === 'skip-defaults') {
    fillWorkflowStepWithDefaults('skip')
    await generateWorkflowStepOutput()
  } else if (actionId === 'view-evidence') {
    viewWorkflowEvidence()
  } else if (actionId === 'regenerate') {
    if (!workflowStepChallenge.value.trim()) {
      workflowStepChallenge.value = '请在保留当前结论的基础上，补充状态、异常、前端文件和后端文件拆分。'
    }
    await regenerateWorkflowStepOutput()
  }
}

async function generateWorkflowStepOutput() {
  if (!state.activeWorkflowRun) return
  persistWorkflowStepInput()
  autofillWorkflowStepFromText(workflowForm.input || state.activeWorkflowRun.input)
  persistWorkflowStepInput()
  const result = await api.workspace.generateWorkflowStep(state.apiConfig, state.activeWorkflowRun.id, {
    stepInputs: { ...workflowStepDraft }
  })
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '当前步骤生成失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  const gate = canAdvanceStep(state.activeWorkflowRun)
  setStatus(skillWorkbenchStatus, 'success', gate.ok
    ? `${activeWorkflowStep.value.title} 已生成，可质疑、编辑或采纳`
    : `${activeWorkflowStep.value.title} 已基于 AI 推断生成，缺失项可继续校准：${gate.missing.join('、')}`)
}

async function saveProjectBlueprintAsset() {
  const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
  if (!blueprint) return
  const content = exportBlueprintMarkdown(blueprint)
  const runId = crypto.randomUUID()
  const asset = {
    id: crypto.randomUUID(),
    projectId: state.currentProjectId,
    title: blueprint.title,
    meta: '项目蓝图 · 交互路径 · Demo',
    status: '已生成',
    workflowId: state.activeWorkflowRun?.workflowId || 'project-blueprint',
    skillId: 'project-blueprint',
    runId,
    blueprint,
    versions: [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), content }],
    hiddenRunRecords: [{
      id: runId,
      projectId: state.currentProjectId,
      title: `${blueprint.title} 生成记录`,
      meta: `项目蓝图 · ${new Date().toLocaleString()}`,
      status: '已完成',
      content
    }],
    content
  }
  const persistedRun = await persistWorkspaceRun(asset.hiddenRunRecords[0])
  const persistedAsset = await persistWorkspaceAsset({
    ...asset,
    runId: persistedRun.id,
    hiddenRunRecords: [persistedRun]
  })
  state.assets.unshift(persistedAsset)
  selectedAssetId.value = persistedAsset.id
  state.skillRuns.unshift(persistedRun)
  setStatus(skillWorkbenchStatus, 'success', '项目蓝图已保存到当前项目资产库')
}

function generateBlueprintDemoPreview() {
  const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
  if (!blueprint) return
  blueprintDemoHtml.value = buildBlueprintDemoHtml(blueprint, {
    ...blueprintDemoForm,
    revision: blueprintDemoRevision.value
  })
  setStatus(skillWorkbenchStatus, 'success', '已生成项目蓝图 1:1 Demo')
}

function refreshBlueprintDemoPreview() {
  blueprintDemoRevision.value += 1
  generateBlueprintDemoPreview()
}

function openBlueprintDemoPreview() {
  if (!blueprintDemoHtml.value) generateBlueprintDemoPreview()
  if (!blueprintDemoHtml.value) return
  showBlueprintDemoFullPreview.value = true
}

function downloadBlueprintDemoHtml() {
  if (!blueprintDemoHtml.value) generateBlueprintDemoPreview()
  if (!blueprintDemoHtml.value) return
  const blob = new Blob([blueprintDemoHtml.value], { type: 'text/html;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'project-blueprint-demo.html'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function downloadBlueprintVueZip() {
  if (!blueprintDemoHtml.value) generateBlueprintDemoPreview()
  const blueprint = activeProjectBlueprint.value || attachProjectBlueprint()
  const files = createVueViteFiles({
    title: `${blueprint?.profile?.productName || displayProjectName(currentProject.value)} 交互 Demo`,
    palette: state.palette
  }).map((file) => {
    if (file.path === 'src/App.vue') {
      return {
        ...file,
        content: `<template>\n  <iframe class="demo-frame" title="交互 Demo" :srcdoc="html"></iframe>\n</template>\n\n${'<script setup>'}\nconst html = ${JSON.stringify(blueprintDemoHtml.value || '<main>暂无 Demo</main>')}\n${'<\\/script>'}\n`
      }
    }
    if (file.path === 'src/styles.css') {
      return {
        ...file,
        content: ':root { font-family: \"PingFang SC\", \"Microsoft YaHei\", Arial, sans-serif; color: #222529; background: #fff; }\\nbody { margin: 0; }\\n.demo-frame { width: 100vw; height: 100vh; border: 0; display: block; background: #fff; }\\n'
      }
    }
    return file
  })
  state.activeWorkflowRun.demoArtifacts ||= {}
  state.activeWorkflowRun.demoArtifacts.vueFiles = files
  state.activeWorkflowRun.demoArtifacts.vueZipReady = true
  await downloadZip('project-blueprint-vue-demo', files)
  setStatus(skillWorkbenchStatus, 'success', '已导出 Vue/Vite 代码包')
}

function appendQuickChallenge(text) {
  workflowStepChallenge.value = workflowStepChallenge.value
    ? `${workflowStepChallenge.value}\n${text}`
    : text
}

async function regenerateWorkflowStepOutput() {
  if (!state.activeWorkflowRun) return
  persistWorkflowStepInput()
  const challenge = workflowStepChallenge.value.trim()
  if (!challenge) {
    setStatus(skillWorkbenchStatus, 'failed', '请先写下质疑或修改意见')
    return
  }
  const result = await api.workspace.regenerateWorkflowStep(state.apiConfig, state.activeWorkflowRun.id, {
    challenge,
    stepInputs: { ...workflowStepDraft }
  })
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '重新生成失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  workflowStepChallenge.value = ''
  setStatus(skillWorkbenchStatus, 'success', `${activeWorkflowStep.value.title} 已根据质疑重新生成`)
}

function chooseWorkflowOption(optionId) {
  if (!state.activeWorkflowRun) return
  state.activeWorkflowRun = applyCandidateOption(state.activeWorkflowRun, optionId)
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  setStatus(skillWorkbenchStatus, 'success', '已选择候选方案，可以继续编辑或采纳')
}

async function acceptWorkflowStep() {
  if (!state.activeWorkflowRun || !workflowStepOutput.value.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先生成或填写当前步骤输出')
    return
  }
  persistWorkflowStepInput()
  const result = await api.workspace.acceptWorkflowStep(state.apiConfig, state.activeWorkflowRun.id, {
    output: workflowStepOutput.value
  })
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '采纳当前步骤失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  syncWorkflowDraftFromRun()
  setStatus(skillWorkbenchStatus, 'success', `${activeWorkflowStep.value.title} 已采纳，可以进入下一步`)
}

async function confirmWorkflowStep() {
  if (!state.activeWorkflowRun) return
  const gate = canEnterNextStep(state.activeWorkflowRun)
  if (!gate.ok) {
    setStatus(skillWorkbenchStatus, 'failed', gate.reason)
    return
  }
  const result = await api.workspace.completeWorkflowStep(state.apiConfig, state.activeWorkflowRun.id)
  if (!result.ok || !result.data?.run) {
    setStatus(skillWorkbenchStatus, 'failed', result.message || '进入下一步失败，请检查后端服务')
    return
  }
  state.activeWorkflowRun = result.data.run
  syncWorkflowDraftFromRun()
  const completed = state.activeWorkflowRun.status === 'completed'
  setStatus(skillWorkbenchStatus, 'success', completed ? '完整流程已完成，可以保存资产' : '已进入下一步')
}

async function saveWorkflowAsset() {
  if (!state.activeWorkflowRun) return
  if (state.activeWorkflowRun.status === 'completed') {
    state.activeWorkflowRun = ensureFinalConclusion(state.activeWorkflowRun)
  }
  const content = exportWorkflowRunMarkdown(state.activeWorkflowRun)
  const runId = crypto.randomUUID()
  const asset = {
    id: crypto.randomUUID(),
    projectId: state.currentProjectId,
    title: state.activeWorkflowRun.workflowName,
    meta: state.activeWorkflowRun.assetType,
    status: state.activeWorkflowRun.status === 'completed' ? '已完成' : '草稿',
    workflowId: state.activeWorkflowRun.workflowId,
    skillId: state.activeWorkflowRun.workflowId,
    runId,
    finalConclusion: state.activeWorkflowRun.finalConclusion || null,
    versions: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content
      }
    ],
    hiddenRunRecords: [
      {
        id: runId,
        projectId: state.currentProjectId,
        title: `${state.activeWorkflowRun.workflowName} 运行记录`,
        meta: `${state.activeWorkflowRun.assetType} · ${new Date().toLocaleString()}`,
        status: state.activeWorkflowRun.status === 'completed' ? '已完成' : '草稿',
        finalConclusion: state.activeWorkflowRun.finalConclusion || null,
        content
      }
    ],
    content
  }
  const persistedRun = await persistWorkspaceRun(asset.hiddenRunRecords[0])
  const persistedAsset = await persistWorkspaceAsset({
    ...asset,
    runId: persistedRun.id,
    hiddenRunRecords: [persistedRun]
  })
  state.assets.unshift(persistedAsset)
  selectedAssetId.value = persistedAsset.id
  state.skillRuns.unshift(persistedRun)
  state.activeWorkflowRun.lastSavedAssetId = persistedAsset.id
  setStatus(skillWorkbenchStatus, 'success', '完整流程资产已保存')
}

function downloadWorkflowMarkdown() {
  if (!state.activeWorkflowRun) return
  const content = exportWorkflowRunMarkdown(state.activeWorkflowRun)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${state.activeWorkflowRun.workflowId}.md`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function runWorkbenchSkill() {
  if (!workbenchForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先输入需求或任务')
    return
  }

  const skill = selectedWorkbenchSkill.value
  const context = buildSkillExecutionContext(state, skill, workbenchForm.input)
  setStatus(skillWorkbenchStatus, 'loading', '正在执行 Skill...')

  const endpoint = workbenchForm.mode === 'diagnose' ? api.skills.diagnose : api.skills.execute
  const result = await endpoint(state.apiConfig, context)
  const data = applyApiResult(skillWorkbenchStatus, result, 'Skill 执行失败')
  if (!data?.run && !data?.diagnosis) return
  const runResult = data?.run || {
    id: crypto.randomUUID(),
    title: `${skill.name} 诊断结果`,
    assetType: 'Skill 诊断',
    content: JSON.stringify(data.diagnosis, null, 2)
  }

  if (data?.diagnosis && !data?.run) {
    runResult.diagnosis = data.diagnosis
  }

  skillWorkbenchResult.value = runResult.content || ''
  const runRecord = {
    id: runResult.id || crypto.randomUUID(),
    projectId: state.currentProjectId,
    title: runResult.title || `${skill.name} 执行结果`,
    meta: `${skill.name} · ${new Date().toLocaleString()}`,
    status: '已完成',
    content: skillWorkbenchResult.value
  }
  const asset = {
    id: crypto.randomUUID(),
    projectId: state.currentProjectId,
    title: runRecord.title,
    meta: runResult.assetType || skill.name,
    status: '已保存',
    skillId: skill.id,
    runId: runRecord.id,
    versions: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content: skillWorkbenchResult.value
      }
    ],
    hiddenRunRecords: [runRecord],
    content: skillWorkbenchResult.value
  }
  try {
    const persistedRun = await persistWorkspaceRun(runRecord)
    const persistedAsset = await persistWorkspaceAsset({
      ...asset,
      runId: persistedRun.id,
      hiddenRunRecords: [persistedRun]
    })
    state.skillRuns.unshift(persistedRun)
    state.assets.unshift(persistedAsset)
    selectedAssetId.value = persistedAsset.id
    setStatus(skillWorkbenchStatus, 'success', 'Skill 执行完成，结果已保存')
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', `Skill 结果保存失败：${error.message || '后端未返回有效结果'}`)
  }
}

async function downloadReactZip(name = 'vue-vite-site') {
  const files = selectedRestoredPage.value?.files?.length ? selectedRestoredPage.value.files : state.reactFiles
  await downloadZip(name, files)
}

async function downloadVueZip() {
  const result = await api.ux.generateVue(state.apiConfig, buildSkillPayload(uxForm.skill, uxForm.answer))
  const data = applyApiResult(uxStatus, result, 'Vue 预览生成接口未完成')
  if (data?.files) state.vueFiles = data.files
  await downloadZip('vue-vite-ux-preview', state.vueFiles)
}

function downloadMarkdown(type) {
  const content = type === 'pm' ? pmResult.value : '# 产品需求文档\n\n当前 PRD 生成接口待接入。'
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${type}-document.md`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function testApiConfig() {
  setStatus(settingsStatus, 'loading', '正在测试主服务 /api/health ...')
  const result = await api.settings.test(state.apiConfig.apiBaseUrl)
  applyApiResult(settingsStatus, result, '主 API 测试失败')
}

function applyModelSettingsView(modelSettings = {}) {
  Object.assign(modelSettingsForm, {
    provider: modelSettings.provider || 'openai-compatible',
    baseUrl: modelSettings.baseUrl || 'https://api.openai.com/v1',
    defaultModel: modelSettings.defaultModel || 'gpt-5.5',
    apiSurface: modelSettings.apiSurface || 'responses',
    apiKey: '',
    timeoutMs: modelSettings.timeoutMs || 20000,
    fallback: modelSettings.fallback || 'deterministic',
    enabled: Boolean(modelSettings.enabled || (modelSettings.provider === 'openai-compatible' && modelSettings.hasApiKey))
  })
  Object.assign(modelSettingsStatus, {
    hasApiKey: Boolean(modelSettings.hasApiKey),
    apiKeyMasked: modelSettings.apiKeyMasked || ''
  })
}

async function loadModelSettings() {
  const result = await api.workspace.getModelSettings(state.apiConfig)
  if (!result.ok) return
  applyModelSettingsView(result.data?.modelSettings || {})
}

async function loadModelCallLogs() {
  const result = await api.workspace.listModelCallLogs(state.apiConfig, {
    limit: 20,
    status: modelCallLogFilters.status,
    skillId: modelCallLogFilters.skillId,
    projectId: modelCallLogFilters.projectId,
    demandScope: modelCallLogFilters.demandScope
  })
  if (!result.ok) return
  modelCallLogs.value = Array.isArray(result.data?.logs) ? result.data.logs : []
}

async function saveBackendModelSettings() {
  setStatus(settingsStatus, 'loading', '正在保存后端模型配置...')
  const shouldEnableBackendModel = Boolean(
    modelSettingsForm.enabled ||
    String(modelSettingsForm.apiKey || '').trim() ||
    modelSettingsStatus.hasApiKey
  )
  const payload = {
    provider: modelSettingsForm.provider,
    baseUrl: modelSettingsForm.baseUrl,
    defaultModel: modelSettingsForm.defaultModel,
    apiSurface: modelSettingsForm.apiSurface,
    apiKey: modelSettingsForm.apiKey || '__KEEP__',
    timeoutMs: Number(modelSettingsForm.timeoutMs) || 20000,
    fallback: modelSettingsForm.fallback,
    enabled: shouldEnableBackendModel
  }
  const result = await api.workspace.saveModelSettings(state.apiConfig, payload)
  const data = applyApiResult(settingsStatus, result, '后端模型配置保存失败')
  if (data?.modelSettings) {
    applyModelSettingsView(data.modelSettings)
    setStatus(settingsStatus, 'success', data.modelSettings.hasApiKey ? '后端模型配置已保存，key 已脱敏。' : '后端模型配置已保存，尚未保存 key。')
  }
}

async function testBackendModelSettings() {
  setStatus(settingsStatus, 'loading', '正在测试后端模型连通...')
  const shouldEnableBackendModel = Boolean(
    modelSettingsForm.enabled ||
    String(modelSettingsForm.apiKey || '').trim() ||
    modelSettingsStatus.hasApiKey
  )
  const result = await api.workspace.testModelSettings(state.apiConfig, {
    modelSettings: {
      provider: modelSettingsForm.provider,
      baseUrl: modelSettingsForm.baseUrl,
      defaultModel: modelSettingsForm.defaultModel,
      apiSurface: modelSettingsForm.apiSurface,
      apiKey: modelSettingsForm.apiKey || '__KEEP__',
      timeoutMs: Number(modelSettingsForm.timeoutMs) || 20000,
      fallback: modelSettingsForm.fallback,
      enabled: shouldEnableBackendModel
    },
    input: 'ping'
  })
  const data = applyApiResult(settingsStatus, result, '模型连通测试失败')
  if (!data) return
  modelSettingsTestResult.value = data
  setStatus(
    settingsStatus,
    data.status === 'success' ? 'success' : 'failed',
    data.status === 'success'
      ? `模型连通成功：${data.provider} / ${data.model}，tokens ${data.usage?.totalTokens ?? 0}`
      : `模型连通失败：${data.validation?.error || '请检查 key、baseUrl 和模型名'}`
  )
  void loadModelCallLogs()
}

async function runBackendModelSampleAnalysis() {
  setStatus(settingsStatus, 'loading', '正在用登录注册弹窗样例验证模型分析链路...')
  const result = await api.workspace.runModelSampleAnalysis(state.apiConfig, {
    input: '做一个登录注册弹窗',
    modelSettings: {
      provider: modelSettingsForm.provider,
      baseUrl: modelSettingsForm.baseUrl,
      defaultModel: modelSettingsForm.defaultModel,
      apiSurface: modelSettingsForm.apiSurface,
      apiKey: modelSettingsForm.apiKey || '__KEEP__',
      timeoutMs: Number(modelSettingsForm.timeoutMs) || 20000,
      fallback: modelSettingsForm.fallback,
      enabled: modelSettingsForm.enabled
    }
  })
  const data = applyApiResult(settingsStatus, result, '登录注册弹窗样例分析失败')
  if (!data?.analysis) return
  modelSettingsSampleResult.value = data
  setStatus(
    settingsStatus,
    'success',
    `样例分析完成：${data.analysis.displaySkillName || '智能推荐 Skill'} / ${data.analysis.detectedIntent || 'auth-modal'}`
  )
  void loadModelCallLogs()
}

function applySkillOrchestrationSettingsView(settings = {}) {
  const skillId = skillOrchestrationForm.skillId || 'auth-page-generation'
  const override = settings.skillOverrides?.[skillId] || settings.skillOverrides?.['auth-page-generation'] || {}
  Object.assign(skillOrchestrationForm, {
    enabled: settings.enabled !== undefined ? Boolean(settings.enabled) : true,
    skillId: override.id || skillId,
    promptTemplate: override.promptTemplate || skillOrchestrationForm.promptTemplate,
    outputSchema: override.outputSchema || skillOrchestrationForm.outputSchema,
    fallbackSkillId: override.fallbackSkillId || skillOrchestrationForm.fallbackSkillId,
    qualityChecksText: Array.isArray(override.qualityChecks) ? override.qualityChecks.join('\n') : skillOrchestrationForm.qualityChecksText
  })
}

async function loadSkillOrchestrationSettings() {
  const result = await api.workspace.getSkillOrchestrationSettings(state.apiConfig)
  if (!result.ok) return
  applySkillOrchestrationSettingsView(result.data?.skillOrchestrationSettings || {})
}

async function saveBackendSkillOrchestrationSettings() {
  setStatus(settingsStatus, 'loading', '正在保存后端 Skill 编排策略...')
  const skillId = skillOrchestrationForm.skillId || 'auth-page-generation'
  const result = await api.workspace.saveSkillOrchestrationSettings(state.apiConfig, {
    enabled: skillOrchestrationForm.enabled,
    skillOverrides: {
      [skillId]: {
        promptTemplate: skillOrchestrationForm.promptTemplate,
        outputSchema: skillOrchestrationForm.outputSchema,
        fallbackSkillId: skillOrchestrationForm.fallbackSkillId,
        qualityChecks: skillOrchestrationForm.qualityChecksText.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
      }
    }
  })
  const data = applyApiResult(settingsStatus, result, '后端 Skill 编排策略保存失败')
  if (data?.skillOrchestrationSettings) {
    applySkillOrchestrationSettingsView(data.skillOrchestrationSettings)
    setStatus(settingsStatus, 'success', '后端 Skill 编排策略已保存。')
  }
}

function persistState() {
  saveState(state)
  setStatus(settingsStatus, 'success', '配置已保存到本地浏览器')
}

function resetApiConfig() {
  state.apiConfig = defaultApiConfig()
  saveState(state)
  setStatus(settingsStatus, 'success', '已恢复默认同源 API：当前 5288 服务内置 /api 接口')
}

function showApiHint(type) {
  const hints = {
    capture: 'POST /api/capture/start，GET /api/capture/tasks/:taskId/result'
  }
  setStatus(captureStatus, 'idle', hints[type] || '接口说明待补充')
}

const TabBar = defineComponent({
  props: { modelValue: String, tabs: Array },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: 'tabbar' }, props.tabs.map((tab) =>
      h('button', {
        class: { active: props.modelValue === tab.key },
        type: 'button',
        onClick: () => emit('update:modelValue', tab.key)
      }, tab.label)
    ))
  }
})

const BlueprintTree = defineComponent({
  name: 'BlueprintTree',
  props: { node: Object },
  setup(props) {
    return () => h('div', { class: 'blueprint-tree-node' }, [
      h('div', { class: 'blueprint-tree-label' }, props.node?.title || ''),
      props.node?.ui
        ? h('div', { class: 'blueprint-ui-detail' }, [
          h('span', `布局：${props.node.ui.layout || '待确认'}`),
          ...(props.node.ui.components || []).map((component) =>
            h('small', { key: `${component.type}-${component.label}` }, `${component.label} · ${component.type}${component.detail ? ` · ${component.detail}` : ''}`)
          ),
          props.node.ui.feedback ? h('em', `反馈：${props.node.ui.feedback}`) : null
        ])
        : null,
      props.node?.children?.length
        ? h('div', { class: 'blueprint-tree-children' }, props.node.children.map((child) =>
          h(BlueprintTree, { node: child, key: child.title })
        ))
        : null
    ])
  }
})

const StatusBadge = defineComponent({
  props: { status: String },
  setup(props) {
    const labels = { idle: '未开始', loading: '请求中', success: '成功', failed: '失败', blocked: '已阻断', unconfigured: '需补充' }
    return () => h('span', { class: ['badge', props.status] }, labels[props.status] || props.status)
  }
})

const Notice = defineComponent({
  props: { result: Object, floating: Boolean },
  setup(props) {
    return () => {
      const source = props.result.value || props.result || {}
      const status = source.status || 'idle'
      const message = source.message || ''
      if (!message || status === 'idle') return null
      return h('div', { class: ['notice', status, props.floating ? 'floating' : ''] }, [
        h('span', message),
        status === 'failed'
          ? h('button', {
            type: 'button',
            'aria-label': '关闭提示',
            onClick: () => clearStatusNotice(props.result)
          }, '关闭')
          : null
      ])
    }
  }
})

const Metric = defineComponent({
  props: { label: String, value: [String, Number] },
  setup(props) {
    return () => h('div', { class: 'metric' }, [h('strong', props.value), h('span', props.label)])
  }
})

const iconPaths = {
  'file-text': [
    ['path', { d: 'M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z' }],
    ['path', { d: 'M14 3.5V8h4' }],
    ['path', { d: 'M8 12h8' }],
    ['path', { d: 'M8 16h6' }]
  ],
  folder: [
    ['path', { d: 'M3.5 6.5h5l1.4 1.8h10.6v9.2a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z' }],
    ['path', { d: 'M3.5 10h17' }]
  ],
  scan: [
    ['path', { d: 'M5 8V5h3' }],
    ['path', { d: 'M16 5h3v3' }],
    ['path', { d: 'M19 16v3h-3' }],
    ['path', { d: 'M8 19H5v-3' }],
    ['path', { d: 'M8 12h8' }],
    ['path', { d: 'M12 8v8' }]
  ],
  route: [
    ['circle', { cx: '6', cy: '7', r: '2.2' }],
    ['circle', { cx: '18', cy: '17', r: '2.2' }],
    ['path', { d: 'M8.2 7h4.3a3.5 3.5 0 0 1 0 7H11a3 3 0 0 0 0 6h4.8' }]
  ],
  archive: [
    ['path', { d: 'M4 7h16v12H4z' }],
    ['path', { d: 'M3 5h18v2H3z' }],
    ['path', { d: 'M9 11h6' }]
  ],
  spark: [
    ['path', { d: 'M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9L12 3Z' }],
    ['path', { d: 'M18 15l.7 2.2L21 18l-2.3.8L18 21l-.7-2.2L15 18l2.3-.8L18 15Z' }]
  ],
  radar: [
    ['circle', { cx: '12', cy: '12', r: '8' }],
    ['path', { d: 'M12 12l5.2-5.2' }],
    ['path', { d: 'M12 4v2.5' }],
    ['path', { d: 'M20 12h-2.5' }],
    ['circle', { cx: '12', cy: '12', r: '2' }]
  ],
  layout: [
    ['rect', { x: '4', y: '5', width: '16', height: '14', rx: '2' }],
    ['path', { d: 'M4 10h16' }],
    ['path', { d: 'M10 10v9' }]
  ],
  database: [
    ['ellipse', { cx: '12', cy: '6', rx: '7', ry: '3' }],
    ['path', { d: 'M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6' }],
    ['path', { d: 'M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5' }]
  ],
  'book-open': [
    ['path', { d: 'M4 5.5c2.7 0 5 .6 8 2.3v11.5c-3-1.7-5.3-2.3-8-2.3V5.5Z' }],
    ['path', { d: 'M20 5.5c-2.7 0-5 .6-8 2.3v11.5c3-1.7 5.3-2.3 8-2.3V5.5Z' }],
    ['path', { d: 'M12 7.8v11.5' }]
  ],
  settings: [
    ['circle', { cx: '12', cy: '12', r: '3' }],
    ['path', { d: 'M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7.4 7.4 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7.4 7.4 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z' }]
  ]
}

const NavIcon = defineComponent({
  props: { name: String },
  setup(props) {
    return () => h('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    }, (iconPaths[props.name] || iconPaths.folder).map(([tag, attrs]) => h(tag, attrs)))
  }
})

const ListHeader = defineComponent({
  props: { title: String, count: Number },
  setup(props) {
    return () => h('div', { class: 'list-head' }, [h('h3', props.title), h('span', `${props.count} 条`)])
  }
})

const DataList = defineComponent({
  props: { items: Array, empty: String },
  setup(props) {
    return () => props.items.length
      ? h('div', { class: 'data-list' }, props.items.map((item) =>
        h('article', { key: item.id }, [
          h('div', [h('strong', item.title), h('p', item.meta || item.notes || '')]),
          h('span', item.status || '已保存')
        ])
      ))
      : h('div', { class: 'empty' }, props.empty)
  }
})

const SkillWorkspace = defineComponent({
  props: {
    title: String,
    subtitle: String,
    skills: Array,
    selected: String,
    answer: String,
    status: Object,
    resultTitle: String,
    result: String
  },
  emits: ['update:selected', 'update:answer', 'ask', 'generate', 'download'],
  setup(props, { emit }) {
    return () => h('div', { class: 'two-column' }, [
      h('section', { class: 'panel' }, [
        h('div', { class: 'panel-head' }, [
          h('div', [h('h3', props.title), h('p', props.subtitle)]),
          h(StatusBadge, { status: props.status.value?.status || props.status.status })
        ]),
        h('div', { class: 'skill-grid' }, props.skills.map((skill) =>
          h('button', {
            class: { active: props.selected === skill },
            type: 'button',
            onClick: () => emit('update:selected', skill)
          }, skill)
        )),
        h('textarea', {
          value: props.answer,
          placeholder: '回答 AI 的追问，或先写下项目背景、目标用户、页面约束、参考资料等。',
          onInput: (event) => emit('update:answer', event.target.value)
        }),
        h('div', { class: 'actions' }, [
          h('button', { type: 'button', onClick: () => emit('ask') }, '生成追问'),
          h('button', { class: 'primary', type: 'button', onClick: () => emit('generate') }, '生成结果'),
          h('button', { type: 'button', onClick: () => emit('download') }, '下载')
        ]),
        h(Notice, { result: props.status })
      ]),
      h('section', { class: 'panel' }, [
        h('div', { class: 'panel-head' }, [h('div', [h('h3', props.resultTitle), h('p', '结果会引用知识库、需求文档、竞品记录和项目代码。')])]),
        h('pre', { class: 'code-block tall' }, props.result)
      ])
    ])
  }
})
</script>
