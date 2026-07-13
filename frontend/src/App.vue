<template>
  <section v-if="!authState.checked" class="auth-page auth-page-loading" aria-label="账号状态加载">
    <div class="auth-brand">
      <span class="auth-brand-mark">流</span>
      <h1>流程通</h1>
    </div>
    <p class="auth-loading-text">正在确认账号状态</p>
  </section>

  <section v-else-if="!authState.authenticated" class="auth-page" aria-label="账号登录">
    <div class="auth-brand">
      <span class="auth-brand-mark">流</span>
      <h1>流程通</h1>
    </div>
    <form class="auth-panel" @submit.prevent="submitAuthForm">
      <div class="auth-field">
        <span>邮箱</span>
        <input v-model.trim="authState.email" :autocomplete="authState.mode === 'register' ? 'off' : 'email'" inputmode="email" placeholder="输入邮箱地址" />
      </div>
      <div class="auth-field">
        <span class="auth-field-row">
          <span>密码</span>
          <button type="button" @click="showPasswordResetHint">忘记密码?</button>
        </span>
        <span class="auth-password-wrap">
          <input v-model="authState.password" :autocomplete="authState.mode === 'register' ? 'new-password' : 'current-password'" :type="authState.passwordVisible ? 'text' : 'password'" placeholder="至少 6 位" />
          <button type="button" :aria-label="authState.passwordVisible ? '隐藏密码' : '显示密码'" :aria-pressed="authState.passwordVisible" @click="authState.passwordVisible = !authState.passwordVisible">
            <EyeOff v-if="authState.passwordVisible" :size="24" aria-hidden="true" />
            <Eye v-else :size="24" aria-hidden="true" />
          </button>
        </span>
      </div>
      <p v-if="authState.message" class="auth-message" :class="{ failed: authState.status === 'failed' }">{{ authState.message }}</p>
      <div class="auth-actions">
        <button class="auth-primary" type="submit" :disabled="authState.loading">
          {{ authState.loading ? '处理中' : authState.mode === 'register' ? '注册' : '登录' }}
          <ArrowRight :size="24" aria-hidden="true" />
        </button>
      </div>
      <p class="auth-agreement">继续即代表同意 <a href="#" @click.prevent>服务条款</a> 与 <a href="#" @click.prevent>隐私政策</a></p>
    </form>
    <div class="auth-switch">
      <span>{{ authState.mode === 'register' ? '已有账号?' : '没有账号?' }}</span>
      <button type="button" :disabled="authState.loading" @click="toggleAuthMode">
        {{ authState.mode === 'register' ? '去登录' : '去注册' }}
      </button>
    </div>
  </section>

  <div v-else class="app-shell" :class="{ 'analysis-focus': isWorkflowAnalysisFocus, 'sidebar-hidden': isSidebarHidden }">
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
            <button type="button" @click="logoutAccount">退出登录</button>
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
              v-for="project in accountProjects"
              :key="project.id"
              type="button"
              :class="{ active: project.id === state.currentProjectId }"
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
      <div v-if="projectAssetDeleteConfirm.open" class="modal-backdrop" @click.self="cancelProjectAssetDelete">
        <section class="project-create-modal project-asset-delete-modal" role="alertdialog" aria-modal="true" aria-label="删除确认">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Delete Confirmation</p>
              <h3>{{ projectAssetDeleteConfirm.title }}</h3>
            </div>
            <button type="button" aria-label="关闭删除确认" @click="cancelProjectAssetDelete">关闭</button>
          </div>
          <div class="project-asset-delete-body">
            <strong>{{ projectAssetDeleteConfirm.itemName }}</strong>
            <p>{{ projectAssetDeleteConfirm.message }}</p>
          </div>
          <div class="modal-actions">
            <button type="button" @click="cancelProjectAssetDelete">取消</button>
            <button class="danger" type="button" @click="acceptProjectAssetDelete">确认删除</button>
          </div>
        </section>
      </div>

      <div v-if="showMaterialEditor" class="modal-backdrop" @click.self="closeMaterialEditor">
        <section class="project-create-modal material-editor-modal" role="dialog" aria-modal="true" aria-label="资料编辑">
          <div class="modal-head">
            <div>
              <h3>{{ materialEditor.mode === 'create' ? `新建${currentMaterialMeta.title}` : materialEditor.title }}</h3>
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

          <div v-else-if="materialEditor.mode === 'create'" class="project-create-panel">
            <input v-model="materialEditor.title" placeholder="标题" />
            <input v-model="materialEditor.meta" placeholder="类型 / 版本 / 来源" />
            <input v-model="materialEditor.status" placeholder="状态，例如 待解析 / 已生成 / 已保存" />
            <textarea v-model="materialEditor.notes" placeholder="备注或监控重点"></textarea>
            <textarea v-model="materialEditor.content" placeholder="内容详情，支持后续沉淀 AI 解析结果"></textarea>
          </div>
          <div v-else class="project-create-panel material-editor-compact-panel">
            <div
              v-if="materialEditor.preview?.format === 'docx'"
              class="material-document-preview-shell"
            >
              <div ref="materialDocumentPreviewRef" class="material-document-preview"></div>
              <p v-if="materialDocumentPreviewStatus" class="material-document-preview-status">{{ materialDocumentPreviewStatus }}</p>
            </div>
            <section v-else-if="/\\.docx$/i.test(materialEditor.title)" class="material-document-preview-shell material-document-preview-empty">
              <strong>需要重新上传原 Word 文件</strong>
              <p>这条资料是旧上传记录，系统当时只保存了解析文本，没有保存 Word 原文件，所以无法还原图片、表格和版式。重新上传后会自动启用 Word 原版预览。</p>
            </section>
            <textarea v-else v-model="materialEditor.content" class="material-document-content-editor" placeholder="内容"></textarea>
          </div>
          <div class="modal-actions">
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
          <section v-if="requirementConvertForm.source === 'design'" class="design-requirement-preview">
            <div>
              <strong>设计需求模板</strong>
              <span>{{ designRequirementDraft.sections.filter((section) => section.status !== '待补充').length }}/{{ designRequirementDraft.sections.length }} 项已识别 · {{ designRequirementDraft.knowledgeRefs.length }} 条知识引用</span>
            </div>
            <div class="design-requirement-section-grid">
              <article
                v-for="section in designRequirementDraft.sections"
                :key="section.key"
                :class="{ pending: section.status === '待补充' }"
              >
                <strong>{{ section.title }}</strong>
                <span>{{ section.status }}</span>
              </article>
            </div>
          </section>
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
      <div v-if="showWorkflowSkillTransferModal" class="modal-backdrop" @click.self="closeWorkflowSkillTransferModal">
        <section class="project-create-modal requirement-convert-modal" role="dialog" aria-modal="true" aria-label="转其它 Skill 分析">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Skill</p>
              <h3>转其它 Skill 分析</h3>
            </div>
            <button type="button" aria-label="关闭转其它 Skill 分析" @click="closeWorkflowSkillTransferModal">关闭</button>
          </div>
          <div class="knowledge-deposit-source">
            <span>来源画布</span>
            <strong>{{ activeProjectBlueprint?.title || activeWorkflowRun?.input || '当前需求分析画布' }}</strong>
            <small>会把当前画布节点、模型摘要和上下文带入新分析页。</small>
          </div>
          <label>
            选择 Skill
            <BaseDropdown
              v-model="workflowSkillTransferForm.selectedSkillId"
              :items="workflowSkillTransferOptions"
              :label="workflowSkillTransferSelectedLabel"
            />
          </label>
          <label>
            补充说明
            <textarea v-model="workflowSkillTransferForm.notes" placeholder="可选：说明希望新 Skill 重点分析什么"></textarea>
          </label>
          <div class="modal-actions">
            <button type="button" @click="closeWorkflowSkillTransferModal">取消</button>
            <button class="primary" type="button" @click="confirmWorkflowCanvasSkillTransfer">确认转分析</button>
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
              <div class="embedded-browser-input">
                <button type="button" :disabled="browserStateStatus.status === 'loading'" @click="saveBrowserSessionState">
                  <span v-if="browserStateStatus.status === 'loading'" class="button-spinner"></span>
                  保存登录态
                </button>
                <span>{{ browserStateStatus.message || '保存后下次可直接复用当前项目和域名的登录态。' }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="captureAuthModalMode === 'saved-state'" class="capture-auth-body">
            <p>复用已经保存的 Playwright storage state。系统只按项目和目标域名读取本地文件，不把 Cookie 内容返回前端。</p>
            <div class="embedded-browser-input">
              <input
                v-model="captureForm.storageStateKey"
                aria-label="保存登录态 Key"
                placeholder="留空时自动使用当前项目和目标域名"
              />
              <button type="button" :disabled="browserStateStatus.status === 'loading'" @click="loadBrowserSessionStates">刷新</button>
            </div>
            <div v-if="browserSavedStates.length" class="capture-auth-state-list">
              <button
                v-for="item in browserSavedStates"
                :key="item.stateKey"
                type="button"
                @click="captureForm.storageStateKey = item.stateKey"
              >
                {{ item.siteHost || item.stateKey }} · {{ item.savedAt || '已保存' }}
              </button>
            </div>
            <span v-else class="composer-session-note">还没有保存的登录态。先使用授权浏览器完成登录并保存。</span>
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

          <section v-if="materialToolModalMode === 'project-package-import'" class="panel project-package-import-panel">
            <div class="project-package-intro">
              <strong>项目包导入</strong>
              <span>上传其它前端项目源码包或交互蓝图包；交互蓝图包可包含 interaction-blueprint.json、prototype-demo.json 和 screenshots/，结果写入当前项目知识库。</span>
            </div>
            <label class="project-package-dropzone">
              <input type="file" accept=".zip,.tar.gz" @change="selectProjectPackageFile" />
              <strong>{{ projectPackageImportForm.fileName || '拖拽或选择项目 zip / tar.gz' }}</strong>
              <span>源码包可静态分析，也可在本地可信环境启动后采集真实页面；交互蓝图包会读取 interaction-blueprint.json、截图、热区和页面跳转。默认忽略 node_modules、dist、build、.git 和环境密钥文件。</span>
            </label>
            <div v-if="projectRuntimePreview.url || projectRuntimePreview.message" class="project-runtime-preview-status" :data-status="projectRuntimePreview.status">
              <strong>{{ projectRuntimePreview.url || projectRuntimePreview.message }}</strong>
              <span>{{ projectRuntimePreview.message || '外部项目预览已启动，可继续采集真实页面链路。' }}</span>
            </div>
            <div class="project-package-options">
              <strong>分析范围</strong>
              <label v-for="scope in projectPackageImportScopes" :key="scope.key">
                <input v-model="projectPackageImportForm.scopes" type="checkbox" :value="scope.key" />
                <span>{{ scope.label }}</span>
              </label>
            </div>
            <div class="project-package-options">
              <strong>输出内容</strong>
              <label v-for="output in projectPackageImportOutputs" :key="output.key">
                <input v-model="projectPackageImportForm.outputs" type="checkbox" :value="output.key" />
                <span>{{ output.label }}</span>
              </label>
            </div>
            <ol class="project-package-step-list" aria-label="项目包解析流程">
              <li v-for="step in projectPackageImportSteps" :key="step">{{ step }}</li>
            </ol>
            <div class="project-package-actions">
              <button type="button" @click="submitProjectPackageImportAndClose">开始分析</button>
              <button type="button" @click="startProjectPackageRuntimeAndImport">运行并采集真实链路</button>
              <button v-if="projectRuntimePreview.runtimeId" type="button" @click="stopProjectRuntimePreview">停止预览</button>
              <button type="button" @click="openMaterialTool('parse-jobs')">查看解析任务</button>
            </div>
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
              <strong>待补知识</strong>
              <div v-if="selectedKnowledgeNodeMissingSlots.length" class="knowledge-missing-slot-list">
                <article v-for="item in selectedKnowledgeNodeMissingSlots" :key="item.slot">
                  <div>
                    <strong>{{ item.slot }}</strong>
                    <span>{{ item.hint }}</span>
                  </div>
                  <BaseButton variant="primary" type="button" @click="openKnowledgeManualCompletion(item)">补全</BaseButton>
                </article>
              </div>
              <span v-else>暂无待补知识。</span>
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
            <details class="knowledge-ai-context">
              <summary>AI 识别上下文</summary>
              <pre v-if="selectedKnowledgeNodeAiContext">{{ selectedKnowledgeNodeAiContext }}</pre>
              <span v-else>暂无可解释上下文。</span>
            </details>
          </div>
        </section>
      </div>

      <FactoryPage v-if="isFactoryView">
      <FactoryHomePanel
        :is-factory-home="isFactoryView && state.currentFactoryRoute === 'home'"
        :show-generated-page-full-preview="showGeneratedPageFullPreview"
        :show-blueprint-demo-full-preview="showBlueprintDemoFullPreview"
        :generated-page-html="state.generatedPageHtml"
        :blueprint-demo-html="blueprintDemoHtml"
        :factory-hero-copy="factoryHeroCopy"
        :factory-home-tab="factoryHomeTab"
        :factory-home-tabs="factoryHomeTabs"
        :image-code-form="imageCodeForm"
        :image-code-status="imageCodeStatus"
        :show-image-target-menu="showImageTargetMenu"
        :image-code-target-label="imageCodeTargetLabel"
        :image-code-target-options="imageCodeTargetOptions"
        :style-form="styleForm"
        :style-status="styleStatus"
        :capture-form="captureForm"
        :show-capture-method-menu="showCaptureMethodMenu"
        :capture-method-label="captureMethodLabel"
        :capture-method-options="captureMethodOptions"
        :selected-capture-recovery-flow-id="selectedCaptureRecoveryFlowId"
        :capture-action="captureAction"
        :capture-detail-href="captureDetailHref"
        :browser-session-status="browserSessionStatus"
        :current-restored-pages="currentRestoredPages"
        :preview-task-url="previewTaskUrl"
        :restored-page-preview-frame-src="restoredPagePreviewFrameSrc"
        :format-restored-page-time="formatRestoredPageTime"
        :restored-page-tags="restoredPageTags"
        @close-generated-page-full-preview="showGeneratedPageFullPreview = false"
        @close-blueprint-demo-full-preview="showBlueprintDemoFullPreview = false"
        @update-factory-home-tab="factoryHomeTab = $event"
        @handle-image-code-file="handleImageCodeFile"
        @toggle-image-target-menu="showImageTargetMenu = !showImageTargetMenu"
        @select-image-code-target="selectImageCodeTarget"
        @generate-from-image="generateFromImage"
        @transform-style="transformStyle"
        @start-capture="startCapture"
        @toggle-capture-method-menu="showCaptureMethodMenu = !showCaptureMethodMenu"
        @select-capture-method="selectCaptureMethod"
        @open-manual-browser-authorization="openManualBrowserAuthorization"
        @capture-after-manual-browser-login="captureAfterManualBrowserLogin"
        @open-restored-page-standalone="openRestoredPageStandalone"
        @restored-page-frame-load="handleRestoredPageFrameLoad"
        @delete-restored-page="deleteRestoredPageAsset"
        @handle-restored-empty-capture-action="handleRestoredEmptyCaptureAction"
      />

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
          allow="clipboard-write"
          sandbox="allow-forms allow-scripts allow-same-origin allow-clipboard-write allow-top-navigation-by-user-activation"
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
              <article class="compare-result-pane html-preview-pane">
                <header>
                  <div>
                    <strong>HTML 生成效果</strong>
                    <span v-if="selectedRestoredVerificationFailed" class="verification-failed-label">视觉验收未通过</span>
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
                <div v-if="selectedRestoredVerificationFailed" class="restored-failed-preview">
                  <strong>这次生成结果没有通过验收</strong>
                  <p>{{ selectedRestoredFailureReason }}</p>
                  <button type="button" @click="generateFromImage()">重新生成</button>
                </div>
                <iframe
                  v-else
                  class="restored-html-result-frame"
                  title="HTML 生成效果"
                  sandbox="allow-forms allow-scripts"
                  :srcdoc="selectedRestoredPreviewHtml"
                ></iframe>
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
      </FactoryPage>

      <ProjectsPage
        v-if="activeView === 'projects'"
        :project-display-list="projectDisplayList"
        :current-project-id="state.currentProjectId"
        :selected-project-detail="selectedProjectDetail"
        :selected-project-stats="selectedProjectStats"
        :selected-project-blueprint-asset="selectedProjectBlueprintAsset"
        :selected-project-preview-url="selectedProjectPreviewUrl"
        :display-project-name="displayProjectName"
        @create-project="showProjectForm = true"
        @open-project-detail="openProjectDetail"
        @close-project-detail="selectedProjectDetailId = ''"
        @open-selected-project-demo="openSelectedProjectDemo"
        @select-project="selectProject"
      />

      <KnowledgePage v-else-if="activeView === 'materials'">
      <section v-if="activeView === 'materials'" class="view-panel">
        <RequirementDocumentsPanel
          v-if="materialsTab === 'requirements'"
          :materials-tab="materialsTab"
          :material-batch-mode="materialBatchMode"
          :requirement-source-tabs="requirementSourceTabs"
          :requirement-source-tab="requirementSourceTab"
          :filtered-requirement-document-rows="filteredRequirementDocumentRows"
          :current-selected-material-ids="currentSelectedMaterialIds"
          :current-material-meta="currentMaterialMeta"
          @import-material-files="(event) => importMaterialFiles(event, 'requirements')"
          @toggle-material-batch-mode="toggleMaterialBatchMode"
          @open-material-create="openMaterialCreate"
          @update-requirement-source-tab="requirementSourceTab = $event"
          @toggle-material-selection="toggleMaterialSelection"
          @open-material-detail="openMaterialDetail"
          @open-requirement-knowledge-deposit="openRequirementKnowledgeDeposit"
          @delete-requirement-document="deleteRequirementDocument"
        />
        <KnowledgeHubPanel
          v-if="materialsTab === 'knowledge'"
          :materials-tab="materialsTab"
          :project-name="displayProjectName(currentProject)"
          :current-knowledge-hub="currentKnowledgeHub"
          :knowledge-governance-summary="currentKnowledgeGovernanceSummary"
          :current-knowledge-hub-section="currentKnowledgeHubSection"
          :current-knowledge-blueprint-workbench="currentKnowledgeBlueprintWorkbench"
          :current-material-status="currentMaterialStatus"
          :knowledge-hub-section="knowledgeHubSection"
          :material-batch-mode="materialBatchMode"
          :knowledge-canvas-zoom="knowledgeCanvasZoom"
          :knowledge-expanded-node-ids="knowledgeExpandedNodeIds"
          :visible-knowledge-structure-nodes="visibleKnowledgeStructureNodes"
          :selected-knowledge-node="selectedKnowledgeNode"
          :selected-knowledge-node-visual-context="selectedKnowledgeNodeVisualContext"
          :selected-knowledge-node-ai-context="selectedKnowledgeNodeAiContext"
          :knowledge-prototype-flow-tree="knowledgePrototypeFlowTree"
          :selected-knowledge-flow="selectedKnowledgeFlow"
          :knowledge-prototype-pages="knowledgePrototypePages"
          :selected-knowledge-prototype-screen="selectedKnowledgePrototypeScreen"
          :selected-knowledge-prototype-page="selectedKnowledgePrototypePage"
          :selected-knowledge-prototype-hotspot="lastKnowledgePrototypeHotspot"
          :knowledge-prototype-click-path="knowledgePrototypeClickPath"
          :current-knowledge-prototype-demo="currentKnowledgePrototypeDemo"
          :knowledge-prototype-upload-states="knowledgePrototypeUploadStates"
          :current-knowledge-markdown="currentKnowledgeMarkdown"
          :blueprint-node-kind-label="blueprintNodeKindLabel"
          @open-material-tool="openMaterialTool"
          @open-manual-completion="openKnowledgeManualCompletion"
          @toggle-material-batch-mode="toggleMaterialBatchMode"
          @open-material-create="openMaterialCreate"
          @update-knowledge-hub-section="knowledgeHubSection = $event"
          @import-material-files="(event) => importMaterialFiles(event, 'knowledge')"
          @adjust-knowledge-canvas-zoom="adjustKnowledgeCanvasZoom"
          @update-knowledge-canvas-zoom="knowledgeCanvasZoom = $event"
          @expand-all-knowledge-nodes="expandAllKnowledgeNodes"
          @collapse-knowledge-nodes="collapseKnowledgeNodes"
          @select-knowledge-structure-node="selectKnowledgeStructureNode"
          @toggle-knowledge-node="toggleKnowledgeNode"
          @open-knowledge-node-detail="openKnowledgeNodeDetail"
          @select-knowledge-flow="selectKnowledgeFlow"
          @select-knowledge-prototype-screen="selectKnowledgePrototypeScreen"
          @upload-knowledge-prototype-screenshot="uploadKnowledgePrototypeScreenshot"
          @switch-to-factory-from-knowledge-demo="switchToFactoryFromKnowledgeDemo"
          @trigger-knowledge-prototype-hotspot="triggerKnowledgePrototypeHotspot"
          @open-knowledge-entry-detail="openKnowledgeEntryDetail"
          @download-markdown="downloadMarkdown"
        />
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
            <em @click.stop="materialsTab === 'requirements' ? openRequirementKnowledgeDeposit(item) : openKnowledgeCardDeposit(item)">沉淀到知识库</em>
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
      </KnowledgePage>

      <DiagnosisPage
        v-if="activeView === 'diagnosis'"
        :workbench-form="workbenchForm"
        :available-skills="availableSkills"
        :skill-workbench-status="skillWorkbenchStatus"
        :recommended-workflows="recommendedWorkflows"
        :recent-activities="recentActivities"
        @run-workbench-skill="runWorkbenchSkill"
        @open-skill-center-for-creation="openSkillCenterForCreation"
        @start-recommended-workflow="startRecommendedWorkflow"
      />

      <section v-if="activeView === 'workflow' && workflowRoute === 'entry'" class="view-panel workflow-view workflow-entry-view">
        <section class="workflow-entry-panel">
          <div class="capture-entry-panel workflow-capture-entry">
            <div class="agent-copy">
              <h3>{{ workflowEntryCopy.title }}<span>{{ workflowEntryCopy.highlight }}</span>？</h3>
              <p>{{ workflowEntryCopy.subtitle }}</p>
            </div>
            <div class="tabbar">
              <BaseSegmentedTabs
                v-model="workflowForm.demandScope"
                :items="workflowScopeTabItems"
                label="需求类型"
              />
            </div>
            <form class="agent-composer workflow-doc-composer" @submit.prevent="handleWorkflowPrimaryAction">
              <textarea
                ref="workflowEntryTextareaRef"
                v-model="workflowForm.input"
                placeholder="描述本次分析目标，或直接上传需求文档。"
                @keydown.enter.exact.prevent="handleWorkflowPrimaryAction"
              ></textarea>
              <input
                ref="workflowFileInput"
                class="hidden-file-input"
                type="file"
                multiple
                :accept="workflowUploadAccept"
                @change="importWorkflowRequirementFiles"
              />
              <div class="workflow-composer-toolbar">
                <div class="workflow-upload-menu-wrap">
                  <button class="workflow-upload-plus" type="button" aria-label="上传素材" title="上传素材" @click="triggerWorkflowFileUpload()">
                    <Plus class="ui-icon workflow-plus-icon" aria-hidden="true" :stroke-width="2.2" />
                  </button>
                  <div class="workflow-upload-popover" role="menu" aria-label="上传素材类型">
                    <button type="button" role="menuitem" @click="triggerWorkflowFileUpload('all')">
                      <Upload class="ui-icon" aria-hidden="true" :stroke-width="2" />
                      <span>上传文件</span>
                    </button>
                    <button type="button" role="menuitem" @click="triggerWorkflowFileUpload('image')">
                      <Image class="ui-icon" aria-hidden="true" :stroke-width="2" />
                      <span>上传图片</span>
                    </button>
                    <button type="button" role="menuitem" @click="triggerWorkflowFileUpload('word')">
                      <FileText class="ui-icon" aria-hidden="true" :stroke-width="2" />
                      <span>上传 Word</span>
                    </button>
                    <button type="button" role="menuitem" @click="triggerWorkflowFileUpload('pdf')">
                      <FileText class="ui-icon" aria-hidden="true" :stroke-width="2" />
                      <span>上传 PDF</span>
                    </button>
                  </div>
                </div>
                <BaseDropdown
                  v-if="shouldShowWorkflowSkillSelector"
                  v-model="workflowForm.selectedWorkflowId"
                  class="composer-chip-select workflow-skill-dropdown"
                  :label="workflowSelectedSkillLabel"
                  :items="workflowSkillOptions"
                  aria-label="流程 Skill"
                />
                <button class="primary" type="submit">{{ workflowPrimaryActionLabel }}</button>
              </div>
            </form>
            <div class="workflow-example-row" aria-label="需求示例">
              <button
                v-for="example in workflowPromptExamples"
                :key="example.value"
                type="button"
                @click="fillWorkflowPromptExample(example.value)"
              >
                {{ example.label }}
              </button>
            </div>
          </div>
        </section>
        <section class="workflow-records-section">
          <div class="panel-head">
            <div>
              <h3>分析记录</h3>
            </div>
          </div>
          <div class="workflow-record-scope-tabs">
            <BaseSecondaryTabs
              v-model="workflowRecordScopeTab"
              :items="workflowRecordScopeTabItems"
              label="分析记录类型"
            />
          </div>
          <div v-if="workflowAnalysisRecords.length" class="workflow-record-grid">
            <a
              v-for="record in workflowAnalysisRecords"
              :key="record.id"
              class="workflow-record-card"
              :href="workflowAnalysisDeepLink(record.id)"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div class="workflow-record-cover">
                <span
                  class="workflow-record-scope-tag"
                  :data-scope="record.demandScope === 'non-project' ? 'non-project' : 'project'"
                >
                  {{ record.demandScope === 'non-project' ? '非项目需求' : '项目需求' }}
                </span>
                <strong>{{ workflowRecordSkillLabel(record) }}</strong>
                <span>{{ workflowRecordSummary(record).parsed }} 个文档 · {{ workflowRecordSummary(record).nodeCount }} 个节点 · 质量分 {{ workflowRecordSummary(record).qualityScore ?? '待检' }}</span>
                <div class="workflow-record-path">
                  <i v-for="tab in workflowRecordSummary(record).tabPreview" :key="`${record.id}-${tab.key}`">{{ tab.label }}</i>
                </div>
                <button
                  class="workflow-record-delete"
                  type="button"
                  aria-label="删除分析记录"
                  title="删除分析记录"
                  @click.stop.prevent="deleteWorkflowAnalysisRecord(record)"
                >
                  <Trash2 aria-hidden="true" />
                </button>
                <div class="restored-card-action">
                  <span>查看详情</span>
                </div>
              </div>
              <div>
                <strong>{{ workflowRecordInputTitle(record) }}</strong>
                <small>{{ new Date(record.updatedAt || record.createdAt).toLocaleString() }}</small>
              </div>
            </a>
          </div>
          <div v-else class="materials-empty">
            <strong>暂无分析记录</strong>
            <p>{{ workflowRecordEmptyCopy }}</p>
          </div>
        </section>
      </section>

      <WorkflowCanvasPage
        v-if="activeView === 'workflow' && workflowRoute === 'canvas'"
        :title="activeProjectBlueprint?.title || '需求分析画布'"
        :parsed-count="workflowAnalysisResult?.summary?.parsed || 0"
        :skill-label="workflowCanvasSkillLabel"
        :total-flow="workflowStageTotalDesignFlow"
        :canvas="workflowCanvas"
        :nodes="workflowCurrentCanvasNodes"
        :edges="workflowCanvasEdges"
        :routing="workflowSkillRouting"
        :ai-summary="workflowAnalysisResult?.aiSummary || null"
        :generation="workflowGenerationMeta"
        :version-meta="workflowAnalysisVersionMeta"
        :version-history="workflowAnalysisVersionHistory"
        :quality-gate="workflowAnalysisQualityGate"
        :knowledge-status="workflowKnowledgeStatus"
        :stage-statuses="workflowStageStatusMap"
        :active-node="activeCanvasNode"
        :fullscreen-node="fullscreenCanvasNode"
        :fullscreen-edit-node-id="workflowFullscreenEditNodeId"
        :zoom="workflowCanvasZoom"
        @back="returnToWorkflowEntry"
        @zoom="adjustWorkflowCanvasZoom"
        @convert-requirement="openWorkflowRequirementConvertModal"
        @transfer-other-skill="transferWorkflowCanvasToOtherSkillAnalysis"
        @update-stage="selectWorkflowStage"
        @update-slice="selectWorkflowSlice"
        @regenerate-stage="regenerateWorkflowStage"
        @focus-node="selectWorkflowCanvasNode"
        @open-agent="handleWorkflowCanvasNodeAction"
        @close-fullscreen="closeWorkflowCanvasFullscreen"
        @edit-node="saveWorkflowCanvasNodeEdit"
        @rollback-version="rollbackWorkflowAnalysisVersion"
        @persist-knowledge="importWorkflowAnalysisToKnowledge"
        @open-knowledge="openWorkflowKnowledgeBase"
        @quick-action="runWorkflowNodeQuickAction"
      >
        <template #agent-workbench>
          <div class="workflow-stage-agent-workbench-anchor" aria-hidden="true"></div>
        </template>
      </WorkflowCanvasPage>

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
                  <input v-model="blueprintDemoForm.referenceUrl" placeholder="例如：https://example.com/creation" />
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
          v-if="workflowAgentShellVisible"
          ref="workflowAgentDrawerRef"
          :embedded="workflowAgentDisplayMode === 'inline'"
          :display-mode="workflowAgentDisplayMode"
          :can-inline="false"
          :can-large-modes="false"
          :session="workflowAgentSession"
          :canvas-tabs="workflowAgentCanvasTabs"
          :active-node="workflowAgentNode"
          :active-node-id="workflowAgentNodeId"
          :model="workflowAgentModel"
          :web-search-enabled="workflowAgentWebSearchEnabled"
          :quick-replies="workflowAgentQuickReplies"
          :history-open="workflowAgentHistoryOpen"
          :references="workflowAgentReferences"
          :composer-reference="workflowAgentComposerReference"
          :input="workflowAgentInput"
          :editing-message="workflowAgentEditingMessage"
          :retry-message="workflowAgentRetryMessage"
          :width="workflowAgentDrawerWidth"
          :inline-width="workflowAgentInlineWidth"
          :inline-top="workflowAgentInlineTop"
          :inline-resizing="workflowAgentInlineResizing"
          :sending="workflowAgentSending"
          @close="setWorkflowAgentDisplayMode('hidden')"
          @change-display-mode="setWorkflowAgentDisplayMode"
          @update-node="selectWorkflowCanvasNode"
          @update-model="workflowAgentModel = $event"
          @toggle-web-search="toggleWorkflowAgentWebSearch"
          @quick-reply="useWorkflowAgentQuickReply"
          @toggle-history="toggleWorkflowAgentHistory"
          @close-history="workflowAgentHistoryOpen = false"
          @select-history="workflowStepOutput = $event"
          @import-files="importWorkflowAgentFiles"
          @remove-reference="removeWorkflowAgentReference"
          @clear-composer-reference="clearWorkflowAgentComposerReference"
          @copy-message="copyWorkflowAgentMessage"
          @retry-message="retryWorkflowAgentMessage"
          @recovery-action="recoverWorkflowAgentMessage"
          @edit-message="editWorkflowAgentMessage"
          @cancel-edit="cancelWorkflowAgentEdit"
          @cancel-retry="cancelWorkflowAgentRetry"
          @confirm-message="openWorkflowAgentConfirmPreview"
          @update-input="workflowAgentInput = $event"
          @start-resize="startWorkflowAgentResize"
          @start-inline-resize="startWorkflowAgentInlineResize"
          @stop-generating="stopWorkflowAgentGeneration"
          @send="sendWorkflowAgentMessage"
        />

        <div v-if="workflowAgentConfirmPreview.open" class="modal-backdrop agent-confirm-backdrop" @click.self="closeWorkflowAgentConfirmPreview">
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

      <AssetsPage
        v-if="activeView === 'assets'"
        :current-assets="currentAssets"
        :selected-asset="selectedAsset"
        @update:selected-asset-id="selectedAssetId = $event"
        @import-blueprint-asset-to-knowledge="importBlueprintAssetToKnowledge"
        @open-factory="switchView('factory')"
        @open-restored-assets="factoryHomeTab = 'url-code'; switchView('factory')"
      />

      <SkillCenterPage
        v-if="activeView === 'skillCenter'"
        :available-skills="availableSkills"
        :skill-editor="skillEditor"
        :skill-import-form="skillImportForm"
        :skill-validation="skillValidation"
        :projects="state.projects"
        :display-project-name="displayProjectName"
        :field-options-text="fieldOptionsText"
        @start-create-skill="startCreateSkill"
        @edit-skill="editSkill"
        @toggle-skill-editor-mode="skillEditor.mode = skillEditor.mode === 'form' ? 'markdown' : 'form'"
        @save-skill-draft="saveSkillDraft"
        @add-skill-input-field="addSkillInputField"
        @remove-skill-input-field="removeSkillInputField"
        @update-field-options="updateFieldOptions"
        @toggle-scope-type="toggleScopeType"
        @import-skill-draft="importSkillDraft"
      />

      <CompetitorAnalysisPage
        v-if="activeView === 'competitorAnalysis'"
        :api-config="state.apiConfig"
        :project-id="state.currentProjectId"
        @quick-analyze-report="handleCompetitorReportQuickAnalyze"
      />

      <!-- settings compatibility anchors: 后端模型配置 modelSettingsStatus.hasApiKey -->
      <SettingsPage
        v-if="activeView === 'settings'"
        :api-config="state.apiConfig"
        :api-fields="apiFields"
        :settings-status="settingsStatus"
        :model-settings-form="modelSettingsForm"
        :model-settings-status="modelSettingsStatus"
        :model-settings-test-result="modelSettingsTestResult"
        :model-settings-test-total-tokens="modelSettingsTestTotalTokens"
        :model-settings-sample-result="modelSettingsSampleResult"
        :model-call-logs="modelCallLogs"
        :model-call-log-filters="modelCallLogFilters"
        :skill-orchestration-form="skillOrchestrationForm"
        @persist="persistState"
        @reset-api-config="resetApiConfig"
        @test-api-config="testApiConfig"
        @load-model-settings="loadModelSettings"
        @save-backend-model-settings="saveBackendModelSettings"
        @test-backend-model-settings="testBackendModelSettings"
        @run-backend-model-sample-analysis="runBackendModelSampleAnalysis"
        @load-model-call-logs="loadModelCallLogs"
        @load-skill-orchestration-settings="loadSkillOrchestrationSettings"
        @save-backend-skill-orchestration-settings="saveBackendSkillOrchestrationSettings"
      />
    </main>

    <div v-if="projectSwitchOverlayMessage" class="project-switch-overlay" role="status" aria-live="polite">
      <div class="project-switch-spinner" aria-hidden="true"></div>
      <strong>{{ projectSwitchOverlayMessage }}</strong>
      <span>请稍候，正在同步项目数据...</span>
    </div>

    <div
      v-if="globalUploadNotice.message"
      :class="['global-upload-notice', `is-${globalUploadNotice.status}`]"
      role="status"
      aria-live="polite"
    >
      <span v-if="globalUploadNotice.status === 'loading'" class="global-upload-notice-spinner" aria-hidden="true"></span>
      <span v-else class="global-upload-notice-icon" aria-hidden="true">{{ globalUploadNotice.status === 'success' ? '✓' : '!' }}</span>
      <span>{{ globalUploadNotice.message }}</span>
      <button v-if="globalUploadNotice.status !== 'loading'" type="button" aria-label="关闭上传提示" @click="hideGlobalUploadNotice">×</button>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { renderAsync as renderDocxAsync } from 'docx-preview'
import JSZip from 'jszip'
import { ArrowRight, Eye, EyeOff, FileText, Image, Plus, Trash2, Upload } from 'lucide-vue-next'
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
  DEFAULT_PROJECT_ID,
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
  buildWorkflowStageConfirmationSummary,
  buildWorkflowAgentSession,
  buildWorkflowArtifactStages,
  buildWorkflowWorkbenchView,
  defaultWorkflowStepInputs,
  isWorkflowChatOnlyStageScope,
  normalizeRequirementDissectionQuickReplies,
  normalizeWorkflowAgentReplyContent
} from './services/workflowWorkbench'
import {
  buildBlueprintWorkbench,
  visibleBlueprintFrameNodes
} from './services/blueprintWorkbench'
import { buildKnowledgeHubView, buildKnowledgeMaterialsMarkdown, relatedKnowledgeForBlueprintNode } from './services/knowledgeHub'
import {
  buildProjectKnowledgeContextDocuments,
  buildProjectVisualContext,
  selectProjectBlueprintAsset,
  selectProjectPrototypeDemoAsset
} from './services/projectKnowledgeContext'
import {
  buildPrototypeFlowTree,
  buildPrototypeDemoAsset,
  enrichPrototypeDemoHotspots,
  enrichPrototypeFlowScreenshots,
  enrichBlueprintWithPrototypeDemo,
  resolvePrototypeHotspotTarget,
  selectBestPrototypeDemoAsset,
  selectCompletePrototypeFlowAsset,
  selectPrototypeDemoScreen
} from './services/prototypeDemo'
import { KNOWLEDGE_DEPOSIT_TYPES, buildKnowledgeDepositPayload } from './services/knowledgeDeposit'
import {
  DESIGN_REQUIREMENT_TEMPLATE,
  buildDesignRequirementDocument,
  buildKnowledgeGovernanceSummary
} from './services/designRequirement'
import AssetsPage from './pages/assets/AssetsPage.vue'
import CompetitorAnalysisPage from './pages/competitor-analysis/CompetitorAnalysisPage.vue'
import DiagnosisPage from './pages/diagnosis/DiagnosisPage.vue'
import FactoryHomePanel from './pages/factory/FactoryHomePanel.vue'
import FactoryPage from './pages/factory/FactoryPage.vue'
import KnowledgeHubPanel from './pages/knowledge/KnowledgeHubPanel.vue'
import KnowledgePage from './pages/knowledge/KnowledgePage.vue'
import RequirementDocumentsPanel from './pages/knowledge/RequirementDocumentsPanel.vue'
import ProjectsPage from './pages/projects/ProjectsPage.vue'
import SettingsPage from './pages/settings/SettingsPage.vue'
import SkillCenterPage from './pages/skill-center/SkillCenterPage.vue'
import WorkflowCanvasPage from './pages/workflow/WorkflowPage.vue'
import { BaseButton, BaseCapsuleSelect, BaseDropdown, BaseSecondaryTabs, BaseSegmentedTabs } from './components/base'
import { WorkflowAgentDrawer } from './features/workflow'

const WORKFLOW_TOTAL_FLOW_STAGE_ORDER = [
  'requirement-dissection',
  'interaction-lofi',
  'ui-visual',
  'html-output',
  'vue-output',
  'acceptance-deposit'
]
const WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID = 'requirement-dissection'
const WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES = [
  { id: 'requirement-dissection', name: '需求分析' },
  { id: 'interaction-lofi', name: '交互低保' },
  { id: 'ui-visual', name: 'UI视觉' },
  { id: 'html-output', name: 'HTML' },
  { id: 'vue-output', name: 'Vue' },
  { id: 'acceptance-deposit', name: '验收沉淀' }
]
const WORKFLOW_DEPRECATED_TOTAL_FLOW_STAGE_IDS = new Set(['wireframe-preview', 'requirement-slicing', 'gap-confirmation'])
const WORKFLOW_DEPRECATED_TOTAL_FLOW_STAGE_NAMES = new Set(['低保预览', '小需求切片', '缺口确认'])
import {
  APP_PAGE_ROUTES as APP_ROUTE_REGISTRY,
  initialActiveViewFromHash as resolveInitialActiveViewFromHash,
  initialMaterialsTabFromHash as resolveInitialMaterialsTabFromHash,
  parseProjectScopedHash as parseAppProjectScopedHash,
  projectScopedRoute as buildProjectScopedRoute,
  routeProjectId as encodeAppRouteProjectId
} from './app/routes'

function createClientId(prefix = '') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return prefix ? `${prefix}-${id}` : id
}

const initialPalette = designPalette
const NOTICE_AUTO_HIDE_MS = {
  success: 3000,
  info: 4000
}
const GLOBAL_UPLOAD_NOTICE_AUTO_HIDE_MS = {
  success: 6000,
  info: 6000
}
let noticeAutoHideTimer = null
let globalUploadNoticeTimer = null
function wait(ms = 0) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
const PENDING_CAPTURE_TASK_KEY = 'liuchengtong-pending-capture-task'
const STANDALONE_PREVIEW_ASSET_RETRY_DELAYS_MS = [300, 700, 1200, 2000, 3000]
const TEMPORARY_IMAGE_HTML_PREVIEW_POLL_INTERVAL_MS = 15 * 1000
const FACTORY_RESTORED_PAGES_SYNC_MIN_INTERVAL_MS = 2000
const APP_PAGE_ROUTES = {
  ...APP_ROUTE_REGISTRY,
  requirements: '/projects/:projectId/requirements',
  materials: '/projects/:projectId/knowledge',
  workflow: '/projects/:projectId/design',
  factory: '/projects/:projectId/factory',
  assets: '/projects/:projectId/assets',
  skillCenter: '/projects/:projectId/skills',
  competitorAnalysis: '/projects/:projectId/competitor-analysis',
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
const systemSkills = createSystemSkills()
const bootSystemSkills = systemSkills.map((systemSkill) => {
  const existing = (bootState.skills || []).find((skill) => skill.id === systemSkill.id)
  return existing ? { ...systemSkill, ...existing, source: 'system' } : systemSkill
})
bootState.skills = bootSystemSkills
if (!Array.isArray(bootState.users) || !bootState.users.length) {
  bootState.users = [createUser({ id: bootState.currentUserId || 'user-local-default' })]
}
if (!bootState.currentUserId) {
  bootState.currentUserId = bootState.users[0].id
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
const authState = reactive({
  checked: false,
  authenticated: false,
  mode: 'login',
  name: '',
  email: '',
  password: '',
  passwordVisible: false,
  loading: false,
  status: 'idle',
  message: ''
})
const currentLocationHash = ref(typeof window === 'undefined' ? '' : window.location.hash || '')
let workspaceStateSaveTimer = null
let factoryRestoredPagesSyncInFlight = false
let lastFactoryRestoredPagesSyncAt = 0

function scheduleWorkspaceStateSave() {
  if (typeof window === 'undefined') {
    saveState(state)
    return
  }
  if (workspaceStateSaveTimer) window.clearTimeout(workspaceStateSaveTimer)
  workspaceStateSaveTimer = window.setTimeout(() => {
    workspaceStateSaveTimer = null
    saveState(state)
  }, 600)
}

function flushWorkspaceStateSave() {
  if (typeof window !== 'undefined' && workspaceStateSaveTimer) {
    window.clearTimeout(workspaceStateSaveTimer)
    workspaceStateSaveTimer = null
  }
  saveState(state)
}

watch(state, () => scheduleWorkspaceStateSave(), { deep: true, flush: 'post' })

function refreshFactoryRestoredPagesFromBackend() {
  if (typeof window === 'undefined') return
  if (typeof document !== 'undefined' && document.hidden) return
  if (!isFactoryHash()) return
  const now = Date.now()
  if (factoryRestoredPagesSyncInFlight || now - lastFactoryRestoredPagesSyncAt < FACTORY_RESTORED_PAGES_SYNC_MIN_INTERVAL_MS) return
  factoryRestoredPagesSyncInFlight = true
  lastFactoryRestoredPagesSyncAt = now
  hydrateWorkspaceFromBackend().finally(() => {
    factoryRestoredPagesSyncInFlight = false
  })
}

onMounted(() => {
  startWorkflowAnalysisBroadcastChannel()
  refreshCurrentLocationHash()
  restoreAppRouteFromUrl()
  refreshFactoryRestoredPagesFromBackend()
  restoreWorkflowDeepLinkFromCurrentHashSoon()
  void bootstrapAuth()
  window.addEventListener('hashchange', restoreAppRouteFromUrl)
  window.addEventListener('hashchange', refreshFactoryRestoredPagesFromBackend)
  window.addEventListener('focus', refreshFactoryRestoredPagesFromBackend)
  document.addEventListener('visibilitychange', refreshFactoryRestoredPagesFromBackend)
  window.addEventListener('keydown', handleWorkflowAgentGlobalKeydown)
  window.addEventListener('message', handleStaticHtmlPreviewMessage)
  window.addEventListener('resize', updateWorkflowAgentInlineTop)
  nextTick(updateWorkflowAgentInlineTop)
})

onUnmounted(() => {
  flushWorkspaceStateSave()
  stopCaptureLoadingTimer()
  stopBrowserPreviewPolling()
  window.removeEventListener('hashchange', restoreAppRouteFromUrl)
  window.removeEventListener('hashchange', refreshFactoryRestoredPagesFromBackend)
  window.removeEventListener('focus', refreshFactoryRestoredPagesFromBackend)
  document.removeEventListener('visibilitychange', refreshFactoryRestoredPagesFromBackend)
  window.removeEventListener('keydown', handleWorkflowAgentGlobalKeydown)
  window.removeEventListener('message', handleStaticHtmlPreviewMessage)
  window.removeEventListener('resize', updateWorkflowAgentInlineTop)
  stopWorkflowAnalysisDeepLinkPolling()
  stopWorkflowAnalysisBroadcastChannel()
})

function handleStaticHtmlPreviewMessage(event) {
  const type = event?.data?.type || ''
  if (!type.startsWith('image-html-')) return
  const isStandalonePreviewRoute = state.currentFactoryRoute === 'standalone-preview'
  const previewWindow = isStandalonePreviewRoute ? null : event?.source
  if (type === 'image-html-retry') {
    const assetId = event?.data?.assetId || state.selectedRestoredPageId
    if (!imageCodeForm.imageDataUrl && assetId) {
      seedImageCodeFormFromRestoredPage(state.restoredPages.find((item) => item.id === assetId) || selectedRestoredPage.value)
    }
    if (imageCodeForm.imageDataUrl) {
      void generateFromImage({ previewWindow, reusePreviewWindow: !isStandalonePreviewRoute, standalone: isStandalonePreviewRoute })
    }
    return
  }
  if (type === 'image-html-advanced') {
    const assetId = event?.data?.assetId || state.selectedRestoredPageId
    if (!imageCodeForm.imageDataUrl && assetId) {
      seedImageCodeFormFromRestoredPage(state.restoredPages.find((item) => item.id === assetId) || selectedRestoredPage.value)
    }
    if (imageCodeForm.imageDataUrl) {
      void generateFromImage({ previewWindow, reusePreviewWindow: !isStandalonePreviewRoute, standalone: isStandalonePreviewRoute })
    }
    return
  }
  if (type === 'image-html-reupload') {
    openFactoryHome('image-code')
    return
  }
  if (type === 'image-html-copy-source') {
    void copyStaticHtmlPreviewSource(event?.data?.html)
    return
  }
  if (type === 'image-html-open-settings') {
    switchView('settings')
    void loadModelCallLogs()
  }
}

async function copyStaticHtmlPreviewSource(html = '') {
  const source = String(html || '')
  if (!source) return
  try {
    await navigator.clipboard.writeText(source)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = source
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  setStatus(pageGenerationStatus, 'success', 'HTML 已复制')
}

function handleWorkflowAgentGlobalKeydown(event) {
  if (event.key !== 'Escape') return
  if (workflowAgentConfirmPreview.open) closeWorkflowAgentConfirmPreview()
}

function initialActiveViewFromHash() {
  if (typeof window === 'undefined') return 'materials'
  const hash = window.location.hash || ''
  return resolveInitialActiveViewFromHash(hash)
  /*
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
  */
}

function initialMaterialsTabFromHash() {
  if (typeof window === 'undefined') return 'requirements'
  return resolveInitialMaterialsTabFromHash(window.location.hash || '')
}

function refreshCurrentLocationHash() {
  if (typeof window === 'undefined') return
  currentLocationHash.value = window.location.hash || ''
}

const activeView = ref(initialActiveViewFromHash())
const factoryHomeTab = ref('image-code')
const materialsTab = ref(initialMaterialsTabFromHash())
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
let standalonePreviewLoadToken = 0
const restoredPreviewModes = [
  { value: 'html', label: 'HTML 结果' },
  { value: 'compare', label: '对照' }
]
const restoredPreviewDevices = [
  { value: 'desktop', label: '1440' },
  { value: 'tablet', label: '1024' },
  { value: 'mobile', label: '390' }
]
const APP_FAVICON_HREF = '/favicon.svg?v=liuchengtong-flow-preview'

const captureForm = reactive({
  url: 'https://example.com/creation',
  scope: 'single',
  authMode: 'public',
  sessionId: '',
  cookieText: '',
  storageStateKey: ''
})
const modelSettingsForm = reactive({
  provider: 'codex-cli',
  baseUrl: '',
  defaultModel: 'gpt-5.5',
  apiSurface: 'codex.exec',
  apiKey: '',
  timeoutMs: 600000,
  fallback: 'deterministic',
  enabled: true
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

function resetProjectAssetDeleteConfirm() {
  Object.assign(projectAssetDeleteConfirm, {
    open: false,
    title: '确认删除',
    itemName: '',
    message: '删除后将从当前项目移除，无法在前端直接恢复。'
  })
}

function finishProjectAssetDeleteConfirm(confirmed) {
  const resolve = projectAssetDeleteResolve
  projectAssetDeleteResolve = null
  resetProjectAssetDeleteConfirm()
  resolve?.(Boolean(confirmed))
}

function cancelProjectAssetDelete() {
  finishProjectAssetDeleteConfirm(false)
}

function acceptProjectAssetDelete() {
  finishProjectAssetDeleteConfirm(true)
}

function confirmProjectAssetDelete(options = {}) {
  if (typeof window === 'undefined') return Promise.resolve(true)
  if (projectAssetDeleteResolve) finishProjectAssetDeleteConfirm(false)
  Object.assign(projectAssetDeleteConfirm, {
    open: true,
    title: options.title || '确认删除',
    itemName: options.itemName || '当前项目资产',
    message: options.message || '删除后将从当前项目移除，无法在前端直接恢复。'
  })
  return new Promise((resolve) => {
    projectAssetDeleteResolve = resolve
  })
}

const generationForm = reactive({ target: 'vue-vite', fidelity: 'one-to-one', notes: '' })
const styleForm = reactive({ stylePreset: 'clean', notes: '' })
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
const projectAssetDeleteConfirm = reactive({
  open: false,
  title: '确认删除',
  itemName: '',
  message: '删除后将从当前项目移除，无法在前端直接恢复。'
})
let projectAssetDeleteResolve = null
const globalUploadNotice = reactive({
  status: 'idle',
  message: ''
})
const selectedProjectDetailId = ref('')
const pmForm = reactive({ skill: 'PRD 生成', answer: '' })
const uxForm = reactive({ skill: '信息架构设计', answer: '' })
const workbenchForm = reactive({
  input: '',
  selectedSkillId: 'advanced-ux-requirement-analysis',
  mode: 'diagnose'
})
const skillEditor = reactive({
  activeId: '',
  mode: 'form',
  draft: null,
  markdown: ''
})
const workflowForm = reactive({
  selectedWorkflowId: 'advanced-ux-requirement-analysis',
  demandScope: 'project',
  input: '',
  documents: []
})
const workflowRecordScopeTab = ref('project')
const workflowUploadAccept = ref('image/*,.pdf,.doc,.docx,.md,.txt,.xlsx')
const workflowUploadAcceptMap = {
  all: 'image/*,.pdf,.doc,.docx,.md,.txt,.xlsx',
  image: 'image/*',
  word: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: '.pdf,application/pdf'
}
const workflowPromptExamplePresets = {
  default: [
    { label: '茶饮小程序', value: '做一个茶饮点单小程序：用户可以选择门店、浏览饮品、加料加冰糖、加入购物车、下单支付，并查看取餐码和订单状态。' },
    { label: '会员积分商城', value: '做一个会员积分商城：用户可以查看积分余额、兑换优惠券和实物礼品，支持兑换记录、过期提醒、库存不足和售后说明。' },
    { label: '门店点单系统', value: '做一个门店点单系统：店员可以快速下单、改杯型加料、选择堂食或外带，后厨能看到制作队列和异常订单。' },
    { label: '后台管理', value: '做一个茶饮品牌后台：管理员可以管理门店、商品、库存、优惠券、订单和会员数据，并查看经营分析。' }
  ]
}
const workflowPromptExamples = computed(() =>
  workflowPromptExamplePresets[workflowForm.selectedWorkflowId] || workflowPromptExamplePresets.default
)
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
const projectPackageImportScopes = [
  { key: 'routes', label: '页面与路由' },
  { key: 'components', label: '组件库' },
  { key: 'tokens', label: '样式 Token' },
  { key: 'services', label: 'API / services' },
  { key: 'docs', label: 'README / docs' }
]
const projectPackageImportOutputs = [
  { key: 'knowledge', label: '写入知识库' },
  { key: 'structure', label: '生成结构树' },
  { key: 'markdown', label: '生成 Markdown 蓝图' },
  { key: 'flow', label: '尝试生成流程图' },
  { key: 'prototype', label: '生成交互 Demo' }
]
const projectPackageImportSteps = [
  '上传项目包',
  '静态扫描目录和依赖',
  '识别页面、组件、路由、样式和原型资产',
  '生成结构化知识块',
  '写入知识库并生成结构树、流程图、交互 Demo 和 Markdown 蓝图'
]
const projectPackageImportForm = reactive({
  fileName: '',
  fileSize: 0,
  files: [],
  scopes: ['routes', 'components', 'tokens', 'services', 'docs'],
  outputs: ['knowledge', 'structure', 'markdown', 'prototype']
})
const projectRuntimePreview = reactive({
  runtimeId: '',
  url: '',
  status: 'idle',
  message: '',
  logs: []
})
const knowledgeRetrievalForm = reactive({
  query: '',
  roleScope: 'all'
})
const knowledgeRetrievalResults = ref([])
const knowledgeParseJobs = ref([])
const knowledgeHubSection = ref('entries')
const knowledgeCanvasZoom = ref(0.86)
const showKnowledgeNodeDetailModal = ref(false)
const selectedKnowledgeNodeId = ref('')
const selectedKnowledgePrototypeScreenId = ref('')
const selectedKnowledgeFlowId = ref('')
const lastKnowledgePrototypeHotspot = ref(null)
const knowledgePrototypeClickPath = ref([])
const knowledgeExpandedNodeIds = reactive({})
const knowledgePrototypeUploadStates = reactive({})
const showKnowledgeDepositModal = ref(false)
const showRequirementConvertModal = ref(false)
const showWorkflowSkillTransferModal = ref(false)
const workflowSkillTransferForm = reactive({
  selectedSkillId: 'advanced-ux-requirement-analysis',
  notes: ''
})
const knowledgeDepositSource = ref(null)
const knowledgeDepositTypes = KNOWLEDGE_DEPOSIT_TYPES
const knowledgeDepositSourceTypes = {
  requirements: { sourceType: 'requirements', label: '需求文档' },
  competitors: { sourceType: 'competitors', label: '竞品分析' },
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
const workflowEntryTextareaRef = ref(null)
const workflowFileInput = ref(null)
const workflowAgentOpen = ref(false)
const workflowAgentDisplayMode = ref('hidden')
const workflowAgentInlineWidth = ref('100vw')
const workflowAgentInlineTop = ref('112px')
const workflowAgentInlineResizing = ref(false)
const workflowAgentInput = ref('')
const workflowAgentWebSearchEnabled = ref(true)
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
const workflowCanvasRefreshingLayoutLabel = ref('')
const currentWorkflowAnalysisRequestId = ref('')
const workflowAnalysisStreamController = ref(null)
const workflowStageStatusMap = ref({})
const workflowStageAutoGenerationTimer = ref(null)
let workflowHtmlStagePollTimer = null
let workflowHtmlStageJobRunId = ''
const workflowRoute = ref('entry')
const workflowActiveStageId = ref('')
const workflowActiveStageTouchedByUser = ref(false)
let workflowAnalysisDeepLinkTimer = null
let workflowAnalysisProgressSaveTimer = null
let workflowAnalysisBroadcastChannel = null
const workflowAnalysisResumeRunIds = new Set()
const ADVANCED_UX_STALE_GENERATING_RESUME_MS = 90000
const WORKFLOW_ANALYSIS_POLL_MAX_FAILED_LOADS = 3
const workflowAgentStaleProposalErrorCodes = ['AGENT_PROPOSAL_NOT_FOUND', 'AGENT_PROPOSAL_NOT_PENDING', 'AGENT_PROPOSAL_STALE']
const workflowCanvasZoom = ref(0.82)
const workflowFullscreenNodeId = ref('')
const workflowFullscreenEditNodeId = ref('')
const workflowFullscreenNodeOverride = ref(null)
const workflowAgentNodeId = ref('')
const workflowAgentComposerReference = ref(null)
const blueprintDemoHtml = ref('')
const blueprintDemoRevision = ref(1)
const blueprintDemoForm = reactive({
  referenceUrl: 'https://example.com/creation',
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
  preview: null,
  rawItem: null
})
const showMaterialEditor = ref(false)
const materialDocumentPreviewRef = ref(null)
const materialDocumentPreviewStatus = ref('')
const showMaterialToolModal = ref(false)
const materialToolModalMode = ref('website-import')
const materialToolTitle = computed(() => {
  const labels = {
    'website-import': '网站导入',
    'project-package-import': '项目包导入',
    'retrieval-test': '召回测试',
    'parse-jobs': '解析任务'
  }
  return labels[materialToolModalMode.value] || '资料库工具'
})

function materialDisplayContent(item = {}) {
  const directContent = String(item?.content || item?.markdown || item?.text || item?.rawText || '').trim()
  if (directContent) return directContent
  if (!Array.isArray(item?.chunks)) return ''
  return item.chunks
    .map((chunk) => String(chunk?.text || chunk?.content || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

const captureStatus = refStatus()
const imageCodeStatus = refStatus()
const browserSessionStatus = refStatus()
const browserPreviewStatus = refStatus()
const browserStateStatus = refStatus()
const browserSavedStates = ref([])
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
const workflowScopeTabItems = workflowScopeTabs.map((tab) => ({
  value: tab.key,
  label: tab.label
}))
const workflowRecordScopeTabItems = workflowScopeTabItems
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
    id: 'saved-state',
    label: '使用保存的登录态自动采集',
    badge: '推荐复用',
    scenario: '适合已通过验证码、扫码或二次验证的网站，后续按项目和域名复用登录态。',
    frontendOwner: '前端负责选择登录态 key 并提示敏感信息不回传前端。',
    backendOwner: '后端负责读取本地 storage_state 文件，并注入 Playwright 采集上下文。',
    handoff: '交接数据：projectId、url、storageStateKey，返回 captureResult、qualityGate、restoredPage。',
    action: '复用登录态'
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
  { id: 'saved-state', shortLabel: '保存登录态' },
  { id: 'snapshot-package', shortLabel: '网页快照包' }
]
const snapshotAuthModes = SNAPSHOT_AUTH_MODES

const materialsTabs = [
  { key: 'knowledge', label: '知识库' },
  { key: 'requirements', label: '需求文档' }
]

const pmSkills = ['PRD 生成', 'MVP 拆解', '竞品分析', '用户故事', '功能优化', '业务流程梳理', 'B 端后台规划', 'C 端功能规划']
const uxSkills = ['信息架构设计', '后台管理系统设计', '表单流程设计', '数据看板设计', 'SaaS 工作台设计', '移动端交互设计', '复杂流程简化', '高保真界面生成']

const apiFields = [
  { key: 'apiBaseUrl', label: '主 API 服务', placeholder: 'https://api.example.com' },
  { key: 'aiBaseUrl', label: 'AI 生成服务', placeholder: 'https://ai.example.com' },
  { key: 'captureBaseUrl', label: '网页快照服务', placeholder: 'https://snapshot.example.com' },
  { key: 'knowledgeBaseUrl', label: '知识库服务', placeholder: 'https://knowledge.example.com' },
  { key: 'searchBaseUrl', label: '联网搜索服务', placeholder: 'https://search.example.com' },
  { key: 'competitorBaseUrl', label: '竞品服务', placeholder: 'https://competitor.example.com' }
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
  if (captureStatus.value.status === 'failed' && !state.captureResult) return 'failed'
  if (!state.captureResult) return 'idle'
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
  (!selectedRestoredPageHasVue.value && selectedRestoredPage.value?.html
    ? selectedRestoredPage.value.html
    : '')
  ||
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
const selectedRestoredVerificationFailed = computed(() => selectedVisualVerification.value?.status === 'failed')
const selectedRestoredFailureReason = computed(() =>
  selectedVisualVerification.value?.recommendations?.[0]
  || selectedVisualVerification.value?.results?.find((item) => item?.comparison?.error)?.comparison?.error
  || '后端视觉验收未通过，请重新生成。'
)
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
  failed: '失败'
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
      cookieText: captureForm.cookieText,
      storageStateKey: captureForm.storageStateKey
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
    cookieText: task.form.cookieText || '',
    storageStateKey: task.form.storageStateKey || ''
  })
  if (task.form.authMode === 'browser') selectedCaptureRecoveryFlowId.value = 'remote-browser'
  else if (task.form.authMode === 'saved-state') selectedCaptureRecoveryFlowId.value = 'saved-state'
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
  if (flowId === 'saved-state') {
    captureForm.authMode = 'saved-state'
    selectedCaptureRecoveryFlowId.value = 'saved-state'
    void loadBrowserSessionStates()
    return
  }
  if (flowId === 'cookie-session') {
    captureForm.authMode = 'cookie'
    selectedCaptureRecoveryFlowId.value = 'cookie-session'
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
  if (flowId === 'saved-state') void loadBrowserSessionStates()
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
  } else if (captureAuthModalMode.value === 'saved-state') {
    captureForm.authMode = 'saved-state'
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
  if (flowId === 'saved-state') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'saved-state'
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
  return encodeAppRouteProjectId(projectId)
}

function projectScopedRoute(route = '', projectId = state.currentProjectId) {
  return buildProjectScopedRoute(route, projectId)
  /*
  const source = String(route || '')
  const normalized = source.startsWith('/') ? source : `/${source}`
  if (normalized.startsWith('/projects/')) return normalized.replace(':projectId', routeProjectId(projectId))
  return `/projects/${routeProjectId(projectId)}${normalized}`
  */
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
  return parseAppProjectScopedHash(hash)
  /*
  const match = String(hash || '').match(/^#\/projects\/([^/?#]+)(\/[^#]*)?/)
  if (!match) return null
  return {
    projectId: decodeURIComponent(match[1]),
    route: match[2] || '/'
  }
  */
}

function accountProjectIdFromRoute(projectId = '', projects = state.projects, currentUserId = state.currentUserId) {
  const routeProjectId = String(projectId || '').trim()
  if (!routeProjectId) return ''
  const project = (projects || []).find((item) => item?.id === routeProjectId)
  if (!project) return ''
  if (project.ownerUserId && project.ownerUserId !== currentUserId) return ''
  return project.id
}

function applyProjectIdFromRoute(projectId = '') {
  const accountProjectId = accountProjectIdFromRoute(projectId)
  if (!accountProjectId || state.currentProjectId === accountProjectId) return
  state.currentProjectId = accountProjectId
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
  if (!route) return
  const targetHash = `#${projectScopedRoute(route)}`
  if (window.location.hash !== targetHash) {
    if (mode === 'replace') {
      window.history.replaceState(null, '', projectScopedUrl(route))
    } else {
      window.history.pushState(null, '', projectScopedUrl(route))
    }
  }
  refreshCurrentLocationHash()
  restoreAppRouteFromUrl()
}

function applyRouteState(key, options = {}) {
  if (key === 'workflow' && isWorkflowAnalysisRouteActive()) {
    ensureWorkflowDeepLinkRouteState()
    return
  }
  if (isWorkflowAnalysisRouteActive()) {
    ensureWorkflowDeepLinkRouteState()
    return
  }
  if (key === 'requirements') {
    materialsTab.value = 'requirements'
    activeView.value = 'materials'
  } else if (key === 'materials') {
    materialsTab.value = 'knowledge'
    activeView.value = 'materials'
  } else {
    activeView.value = key
    if (key === 'workflow') {
      workflowRoute.value = 'entry'
      setWorkflowAgentDisplayMode('hidden')
      workflowFullscreenNodeId.value = ''
      stopWorkflowAnalysisDeepLinkPolling()
    }
    if (key === 'factory') {
      openFactoryHome(options.factoryTab || 'image-code')
    }
  }
}

async function handleCompetitorReportQuickAnalyze(payload = {}) {
  const content = String(payload.content || '').trim()
  if (!content) return
  if (payload.kind === 'gap') return
  activeView.value = 'workflow'
  syncRouteToView('workflow')
  if (!state.activeWorkflowRun) {
    await startWorkflowRun({ auto: true })
  }
  if (!state.activeWorkflowRun) return
  const targetScopeId = workflowAgentScopeId() || state.activeWorkflowRun.currentStepId || ''
  if (!targetScopeId) return
  const references = ensureWorkflowReferenceFiles(targetScopeId)
  const reference = {
    id: createClientId('competitor-report'),
    name: String(payload.fileName || payload.title || '竞品分析报告.md').trim(),
    kind: 'document',
    type: 'text/markdown',
    status: 'ready',
    text: content,
    preview: content.slice(0, 240)
  }
  references.push(reference)
  workflowAgentNodeId.value = targetScopeId
  showWorkflowAgentSidebar()
  await nextTick()
  await sendWorkflowAgentMessage('分析这个文档', {
    nodeId: targetScopeId,
    attachmentIds: [reference.id],
    action: 'competitor-report-quick-analysis',
    ignoreDraftState: true
  })
}

function switchView(key) {
  applyRouteState(key)
  syncRouteToView(key)
  const syncedProjectRoute = parseProjectScopedHash(window.location.hash)
  if (syncedProjectRoute) restoreProjectScopedRoute(syncedProjectRoute)
  accountDockOpen.value = false
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      const main = document.querySelector('.main')
      main?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' })
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
  }
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
    case '#/diagrams':
      applyRouteState('workflow')
      syncRouteToView('workflow', 'replace')
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
  if (route === '/diagrams') {
    applyRouteState('workflow')
    syncRouteToView('workflow', 'replace')
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
  if (route === '/competitor-analysis') {
    applyRouteState('competitorAnalysis')
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
      ...state.restoredPages.filter((item) => item.id !== normalizedPage.id && !restoredPageMatchesPreviewId(item, pageId))
    ]
    if (normalizedPage.html && normalizedPage.html !== html) {
      void api.workspace.createRestoredPage(state.apiConfig, normalizedPage)
    }
    state.selectedRestoredPageId = normalizedPage.id || pageId
    selectedReactFile.value = normalizedPage.html ? 'index.html' : files[0]?.path || selectedReactFile.value
    showRestoredSource.value = false
    restoredPreview.mode = 'compare'
    restoredPreview.device = 'desktop'
    restoredPreview.zoom = restoredPreviewFitZoom.value
    return normalizedPage
  } else {
    const page = state.restoredPages.find((item) => restoredPageMatchesPreviewId(item, pageId))
    selectedReactFile.value = page?.html ? 'index.html' : page?.files?.[0]?.path || selectedReactFile.value
    if (page?.id) state.selectedRestoredPageId = page.id
    showRestoredSource.value = false
    restoredPreview.mode = 'compare'
    restoredPreview.device = 'desktop'
    restoredPreview.zoom = restoredPreviewFitZoom.value
    return page || null
  }
}

async function openRestoredPageStandalone(pageId) {
  if (!pageId) return
  applyAppFavicon()
  persistRestoredPageSelection(pageId)
  const previewWindow = window.open(restoredPageDetailHref(pageId), '_blank')
  if (!previewWindow) {
    window.location.href = restoredPageDetailHref(pageId)
  }
}

async function deleteRestoredPageAsset(page = {}) {
  if (!page.id) return
  const confirmed = await confirmProjectAssetDelete({
    title: '删除还原资产',
    itemName: page.title || '未命名还原资产',
    message: '删除后会从当前项目的还原资产列表移除，相关预览和源码入口也会同步关闭。'
  })
  if (!confirmed) return
  const result = await api.workspace.deleteRestoredPage(state.apiConfig, page.id)
  const data = applyApiResult(pageGenerationStatus, result, '还原资产删除失败')
  if (!data) return
  state.restoredPages = state.restoredPages.filter((item) => item.id !== page.id)
  if (state.selectedRestoredPageId === page.id) {
    state.selectedRestoredPageId = ''
    if (state.currentFactoryRoute === 'restored-detail') state.currentFactoryRoute = 'home'
  }
  setStatus(pageGenerationStatus, 'success', '已删除还原资产')
}

function handleRestoredPageFrameLoad(page = {}, event = null) {
  if (!page?.id) return
  let frameText = ''
  try {
    frameText = event?.target?.contentDocument?.body?.textContent || ''
  } catch {
    return
  }
  if (!/还原页面不存在|RESTORED_PAGE_NOT_FOUND/i.test(frameText)) return
  state.restoredPages = state.restoredPages.filter((item) => item.id !== page.id)
  if (state.selectedRestoredPageId === page.id) state.selectedRestoredPageId = ''
  refreshFactoryRestoredPagesFromBackend()
}

function restoredPageHasPreviewArtifact(page = {}) {
  return Boolean(
    page?.html ||
    page?.files?.some((file) =>
      (file?.path === 'index.html' || file?.path === 'src/pageData.js') &&
      String(file?.content || '').trim()
    )
  )
}

function restoredPageMatchesPreviewId(page = {}, pageId = '') {
  return Boolean(
    pageId &&
    (page.id === pageId || page.clientTaskId === pageId || page.captureResult?.taskId === pageId)
  )
}

function isTemporaryImageHtmlPreviewId(pageId = '') {
  return String(pageId || '').startsWith('image-html-')
}

async function waitForStandaloneRestoredPage(pageId, options = {}) {
  let page = null
  const isTemporaryPreview = isTemporaryImageHtmlPreviewId(pageId)
  const activeToken = options.activeToken || standalonePreviewLoadToken
  for (let attempt = 0; ; attempt += 1) {
    if (activeToken !== standalonePreviewLoadToken) return null
    const loadedPage = await openRestoredPageDetail(pageId, { syncRoute: false })
    if (activeToken !== standalonePreviewLoadToken) return null
    page = loadedPage || state.restoredPages.find((item) => restoredPageMatchesPreviewId(item, pageId)) || selectedRestoredPage.value || null
    if (restoredPageHasPreviewArtifact(page)) return page
    const retryDelay = isTemporaryPreview
      ? TEMPORARY_IMAGE_HTML_PREVIEW_POLL_INTERVAL_MS
      : STANDALONE_PREVIEW_ASSET_RETRY_DELAYS_MS[attempt]
    if (!retryDelay) break
    if (!isTemporaryPreview || attempt === 0) {
      if (activeToken !== standalonePreviewLoadToken) return null
      standalonePreviewHtml.value = buildStaticHtmlLoadingPage('还原资产详情', '正在等待后端保存 HTML 结果...', {
        taskId: pageId,
        stepIndex: Math.min(3, attempt + 2)
      })
      standalonePreviewKey.value += 1
    }
    await wait(retryDelay)
  }
  if (activeToken !== standalonePreviewLoadToken) return null
  return page || state.restoredPages.find((item) => restoredPageMatchesPreviewId(item, pageId)) || selectedRestoredPage.value || { id: pageId, title: '静态 HTML 还原结果', coverImage: '' }
}

async function loadStandalonePreviewRoute(pageId) {
  if (!pageId) return
  applyAppFavicon()
  const projectRoute = parseProjectScopedHash(window.location.hash)
  const routeAction = new URLSearchParams(String(projectRoute?.route || '').split('?')[1] || '').get('action') || ''
  const shouldAutoConvert = routeAction === 'convert-vue'
  const shouldRegenerate = routeAction === 'regenerate' || routeAction === 'advanced-generate'
  standalonePreviewLoadToken += 1
  const activeToken = standalonePreviewLoadToken
  standalonePreviewHtml.value = buildStaticHtmlLoadingPage('还原资产详情', '正在读取已生成的 HTML 结果...', {
    taskId: pageId,
    stepIndex: 2
  })
  standalonePreviewKey.value += 1
  const page = await waitForStandaloneRestoredPage(pageId, { activeToken })
  if (activeToken !== standalonePreviewLoadToken) return
  if (!page) return
  if (page.id && page.id !== pageId) {
    persistRestoredPageSelection(page.id)
    window.history.replaceState(null, '', projectScopedUrl(`/assets/${encodeURIComponent(page.id)}/preview`, page.projectId || state.currentProjectId))
    refreshCurrentLocationHash()
  }
  if (shouldRegenerate) {
    removeProjectRouteQueryParam('action')
    if (seedImageCodeFormFromRestoredPage(page)) {
      await generateFromImage({ standalone: true })
    } else {
      standalonePreviewHtml.value = buildStaticHtmlFailurePage('无法重新生成', '当前资产缺少原始截图，无法重新发起图片转 HTML。请回到首页重新上传图片。')
      standalonePreviewKey.value += 1
    }
    return
  }
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
    visualVerification: page.visualVerification,
    homeUrl: projectScopedRoute('/factory', page.projectId || state.currentProjectId),
    retryUrl: projectScopedUrl(`/assets/${encodeURIComponent(page.id || pageId)}/preview?action=regenerate`, page.projectId || state.currentProjectId),
    convertUrl: projectScopedUrl(`/assets/${encodeURIComponent(page.id || pageId)}/preview?action=convert-vue`, page.projectId || state.currentProjectId)
  })
}

function seedImageCodeFormFromRestoredPage(page = {}) {
  const image = page.coverImage
    || page.captureResult?.screenshot
    || page.captureResult?.pages?.find((item) => item?.screenshot)?.screenshot
    || page.captureResult?.assets?.find((item) => item?.type === 'image' && item?.source)?.source
    || ''
  if (!image) return false
  imageCodeForm.imageDataUrl = image
  imageCodeForm.fileName = page.title || '图片转代码页面'
  imageCodeForm.target = 'static-html'
  imageCodeForm.prompt = page.captureResult?.textBlocks?.find((item) => item?.tag === 'prompt' && item?.text)?.text
    || imageCodeForm.prompt
    || ''
  return true
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

function applyAppFavicon(href = APP_FAVICON_HREF) {
  if (typeof document === 'undefined') return false
  const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]']
  let iconLink = selectors
    .map((selector) => document.querySelector(selector))
    .find(Boolean)
  if (!iconLink) {
    iconLink = document.createElement('link')
    iconLink.rel = 'icon'
    document.head.appendChild(iconLink)
  }
  iconLink.type = 'image/svg+xml'
  iconLink.href = href
  return true
}

function staticHtmlFaviconMarkup() {
  return `<link rel="icon" type="image/svg+xml" href="${APP_FAVICON_HREF}" />`
}

function closeStaticHtmlPreviewWindow(previewWindow) {
  if (!previewWindow || previewWindow.closed) return false
  previewWindow.close()
  return true
}

function writeStandalonePreviewHtml(html = '') {
  standalonePreviewHtml.value = html
  standalonePreviewKey.value += 1
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

function replaceStaticHtmlPreviewRoute(previewWindow, route = '', options = {}) {
  if (!previewWindow || previewWindow.closed || !route) return false
  try {
    const targetUrl = projectScopedUrl(route)
    const forceReload = options.forceReload !== false
    // document.write tabs need a reload after replace so Vue owns the final restored-asset route.
    previewWindow.location.replace(targetUrl)
    if (forceReload) {
      previewWindow.setTimeout(() => {
        try {
          if (!previewWindow.closed) previewWindow.location.reload()
        } catch {}
      }, 0)
    }
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
  const safeTitle = escapeHtml(title)
  const streamedSource = String(options.sourceCode || '')
  const hasStreamedSource = Boolean(streamedSource.trim())
  const sourceCode = escapeHtml(streamedSource)
  const activeStep = Math.min(2, Math.max(0, Number(options.stepIndex || 0)))
  const steps = ['识别截图', '生成骨架', '补齐样式', '后端验收']
  const progress = Math.min(92, Math.max(12, Math.round(((activeStep + 1) / steps.length) * 76)))
  const statusTone = tone === 'failed' ? '#ef4444' : '#165dff'
  const scriptCloseTag = '</scr' + 'ipt>'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${staticHtmlFaviconMarkup()}
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; height: 100vh; overflow: hidden; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; background: #f6f7f9; color: #222529; }
    .result-shell-standalone { height: 100vh; min-height: 0; display: grid; grid-template-rows: 80px minmax(0, 1fr); overflow: hidden; }
    .result-topbar { width: 100%; min-width: 0; height: 80px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 28px; background: rgba(255,255,255,.96); border-bottom: 1px solid #e8eaec; position: sticky; top: 0; z-index: 5; backdrop-filter: blur(12px); overflow: hidden; }
    .topbar-left, .topbar-actions, .thumb-title { min-width: 0; display: flex; align-items: center; gap: 12px; }
    .topbar-left { flex: 1 1 auto; overflow: hidden; }
    .topbar-actions { flex: 0 1 auto; justify-content: flex-end; overflow: hidden; }
    .back-home { width: 44px; height: 44px; border-radius: 999px; border: 1px solid #dfe3e8; background: #fff; color: #222529; font-size: 22px; display: inline-grid; place-items: center; cursor: pointer; }
    .thumb-title { font-weight: 800; }
    .thumb-title span { width: 56px; height: 40px; border-radius: 8px; border: 1px solid #dfe3e8; background: #f8fafc; display: inline-grid; place-items: center; color: #7f8792; font-size: 12px; flex: 0 0 auto; overflow: hidden; }
    .thumb-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 44vw; }
    .asset-id { border-radius: 999px; background: #f1f3f5; color: #68717d; padding: 6px 10px; font-size: 12px; font-weight: 800; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .generation-state { flex: 1 1 160px; min-width: 0; max-width: min(42vw, 620px); border-radius: 999px; background: #eef6ff; color: ${statusTone}; padding: 8px 12px; font-size: 12px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-actions button { flex: 0 0 auto; height: 40px; border-radius: 10px; border: 1px solid #dfe3e8; background: #fff; color: #222529; padding: 0 16px; font: inherit; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; cursor: pointer; }
    .topbar-actions .primary { background: #222529; border-color: #222529; color: #fff; }
    .action-icon { width: 16px; height: 16px; flex: 0 0 auto; }
    .result-tabbed-layout { width: 100%; max-width: 1760px; height: calc(100vh - 80px); min-height: 0; padding: 18px 24px 24px; margin: 0 auto; overflow: hidden; display: grid; }
    .result-content-card { min-width: 0; min-height: 0; height: 100%; display: grid; grid-template-rows: 58px minmax(0, 1fr); border: 1px solid #e0e5eb; border-radius: 12px; background: #fff; overflow: hidden; }
    .result-card-head { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 16px 0 20px; border-bottom: 1px solid #eef0f2; }
    .result-card-title { min-width: 0; display: grid; gap: 2px; }
    .result-card-title strong { font-size: 18px; color: #222529; }
    .result-card-title span { color: #7f8792; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-tabs { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid #dbe1e8; border-radius: 10px; background: #f5f7fa; }
    .result-tab { min-width: 86px; height: 36px; border: 0; border-radius: 7px; background: transparent; color: #68717d; padding: 0 12px; font: inherit; font-size: 14px; font-weight: 900; cursor: pointer; white-space: nowrap; }
    .result-tab.active { background: #222529; color: #fff; box-shadow: 0 6px 14px rgba(15, 23, 42, .16); }
    .result-panel { min-width: 0; min-height: 0; overflow: hidden; }
    .result-panel[hidden] { display: none !important; }
    .render-panel.is-active, .source-panel.is-active { display: grid; grid-template-rows: minmax(0, 1fr); }
    .preview-waiting { min-height: 0; display: grid; place-content: center; gap: 18px; padding: 32px; text-align: center; background: #fff; }
    .preview-waiting h2 { margin: 0; font-size: 24px; line-height: 1.3; color: #222529; }
    .preview-waiting p { max-width: 560px; margin: 0 auto; color: #68717d; line-height: 1.7; overflow-wrap: anywhere; }
    .progress-meta { display: flex; justify-content: space-between; gap: 12px; color: #68717d; font-size: 12px; font-weight: 800; }
    .progress-track { height: 10px; border-radius: 999px; background: #eef0f2; overflow: hidden; }
    .progress-fill { width: ${progress}%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #165dff, #69e1f5); }
    .steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .steps span { min-width: 0; border: 1px solid #e1e5ea; border-radius: 8px; padding: 8px 10px; color: #7f8792; font-size: 12px; font-weight: 800; text-align: center; }
    .steps span.active { border-color: #b7d6ff; background: #eef6ff; color: #165dff; }
    .typing-code { margin: 0; min-height: 0; padding: 18px 20px 36px; overflow: auto; background: #101318; color: #d8f7df; font: 13px/1.75 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .typing-code code { display: block; min-height: 22px; opacity: .9; }
    .typing-cursor { display: inline-block; width: 8px; height: 17px; margin-left: 2px; background: #d8f7df; animation: blink .8s steps(1, end) infinite; vertical-align: -3px; box-shadow: 0 0 12px rgba(216,247,223,.4); }
    @keyframes blink { 50% { opacity: 0; } }
    @media (max-width: 980px) {
      .result-topbar { height: auto; min-height: 80px; align-items: flex-start; flex-direction: column; padding: 14px 16px; }
      .topbar-left, .topbar-actions { width: 100%; justify-content: flex-start; }
      .generation-state { max-width: 100%; }
      .result-shell-standalone { grid-template-rows: auto minmax(0, 1fr); }
      .result-tabbed-layout { padding: 14px; }
      .result-card-head { height: auto; min-height: 58px; align-items: flex-start; flex-direction: column; padding: 12px 14px; }
      .result-tabs { width: 100%; }
      .result-tab { flex: 1 1 0; min-width: 0; }
      .steps { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main class="result-shell-standalone" data-task-id="${escapeHtmlAttr(taskId)}" data-loading="true">
    <header class="result-topbar">
      <div class="topbar-left">
        <button class="back-home" type="button" id="back-home" aria-label="返回首页">←</button>
        <div class="thumb-title"><span>HTML</span><strong>${safeTitle}</strong></div>
        <span class="asset-id">任务 ID：${escapeHtml(taskId || '等待分配')}</span>
      </div>
      <div class="topbar-actions">
        <span class="generation-state">${escapeHtml(heading)} · ${escapeHtml(message)}</span>
        <button type="button" id="retry-generate">重新生成</button>
        <button type="button" disabled>转 Vue 代码</button>
        <button class="primary" type="button" disabled>下载 HTML</button>
      </div>
    </header>
    <section class="result-tabbed-layout">
      <article class="result-content-card" data-task-id="${escapeHtmlAttr(taskId)}">
        <div class="result-card-head">
          <div class="result-card-title"><strong>HTML 渲染</strong><span>生成完成后自动展示</span></div>
          <div class="result-tabs" role="tablist" aria-label="HTML 预览切换">
            <button class="result-tab active" type="button" role="tab" aria-selected="true" data-result-tab="render">HTML 渲染</button>
            <button class="result-tab" type="button" role="tab" aria-selected="false" data-result-tab="source">源码展示</button>
          </div>
        </div>
        <section class="result-panel render-panel is-active" data-result-panel="render">
          <div class="preview-waiting">
            <h2>${escapeHtml(heading)}</h2>
            <p>${escapeHtml(message)}</p>
            <div class="progress-meta"><span>图片转 HTML</span><strong>${progress}%</strong></div>
            <div class="progress-track"><div class="progress-fill"></div></div>
            <div class="steps">${steps.map((step, index) => `<span class="${index <= activeStep ? 'active' : ''}">${step}</span>`).join('')}</div>
          </div>
        </section>
        <section class="result-panel source-panel" data-result-panel="source" hidden>
          <pre class="typing-code${hasStreamedSource ? ' has-streamed-source' : ''}" id="typing-code" aria-live="polite">${hasStreamedSource ? `${sourceCode}<span class="typing-cursor"></span>` : ''}</pre>
        </section>
      </article>
    </section>
  </main>
  <script>
    document.getElementById('back-home')?.addEventListener('click', () => {
      try { window.top.location.replace('/#${projectScopedRoute('/factory')}'); } catch { window.location.replace('/#${projectScopedRoute('/factory')}'); }
    });
    function setResultTab(tabName = 'render') {
      const nextTab = tabName === 'source' ? 'source' : 'render';
      document.querySelectorAll('[data-result-tab]').forEach((tab) => {
        const active = tab.dataset.resultTab === nextTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-result-panel]').forEach((panel) => {
        const active = panel.dataset.resultPanel === nextTab;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    }
    document.querySelectorAll('[data-result-tab]').forEach((tab) => {
      tab.addEventListener('click', () => setResultTab(tab.dataset.resultTab));
    });
    setResultTab('render');
    const send = (type, detail = {}) => {
      try {
        if (window.opener && !window.opener.closed) window.opener.postMessage({ type, ...detail }, '*');
        if (window.parent && window.parent !== window) window.parent.postMessage({ type, ...detail }, '*');
      } catch {}
    };
    document.getElementById('retry-generate')?.addEventListener('click', () => send('image-html-retry', { mode: 'enhanced' }));
    const codeTarget = document.getElementById('typing-code');
    const cursor = '<span class="typing-cursor"></span>';
    const hasStreamedSource = ${hasStreamedSource ? 'true' : 'false'};
    const lines = [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head>',
      '  <meta charset="UTF-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '  <title>${escapeHtml(title)}</title>',
      '  <style>',
      '    * { box-sizing: border-box; }',
      '    body { margin: 0; min-height: 100vh; }',
      '    .page { display: grid; align-content: start; }',
      '    .hero, .card, .nav { position: relative; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <main class="page">',
      '    <!-- 正在根据上传截图生成真实 HTML -->',
      '  </main>',
      '</body>',
      '</html>'
    ];
    let index = 0;
    const appendLine = () => {
      if (!codeTarget) return;
      if (hasStreamedSource) {
        codeTarget.scrollTop = codeTarget.scrollHeight;
        return;
      }
      const previous = codeTarget.querySelector('code.active');
      if (previous) {
        previous.classList.remove('active');
        previous.innerHTML = previous.innerHTML.replace(cursor, '');
      }
      const code = document.createElement('code');
      code.className = 'active';
      code.textContent = lines[index % lines.length];
      index += 1;
      codeTarget.appendChild(code);
      code.insertAdjacentHTML('beforeend', cursor);
      while (codeTarget.children.length > 38) codeTarget.removeChild(codeTarget.firstElementChild);
      codeTarget.scrollTop = codeTarget.scrollHeight;
      window.setTimeout(appendLine, 220 + Math.floor(Math.random() * 280));
    };
    appendLine();
  ${scriptCloseTag}
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
  ${staticHtmlFaviconMarkup()}
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

function formatCssSource(css = '') {
  const source = String(css || '').trim()
  if (!source) return ''
  let level = 0
  return source
    .replace(/\s*{\s*/g, ' {\n')
    .replace(/\s*}\s*/g, '\n}\n')
    .replace(/;\s*/g, ';\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('}')) level = Math.max(0, level - 1)
      const formatted = `${'  '.repeat(level)}${line}`
      if (line.endsWith('{')) level += 1
      return formatted
    })
    .join('\n')
}

function formatStaticHtmlSource(html = '') {
  const source = String(html || '').trim()
  if (!source) return ''
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const expanded = source
    .replace(/>\s*</g, '>\n<')
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, css, close) => `${open}\n${formatCssSource(css)}\n${close}`)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, open, js, close) => `${open}\n${String(js || '').trim()}\n${close}`)
  let level = 0
  return expanded
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isClosing = /^<\//.test(line)
      const openMatch = line.match(/^<([a-zA-Z][\w:-]*)\b[^>]*>$/)
      const tagName = openMatch?.[1]?.toLowerCase() || ''
      const isDoctype = /^<!doctype/i.test(line)
      const isSelfClosing = /\/>$/.test(line) || voidTags.has(tagName)
      const isInlineClosed = openMatch && new RegExp(`</${tagName}>`, 'i').test(line)
      if (isClosing) level = Math.max(0, level - 1)
      const formatted = `${'  '.repeat(level)}${line}`
      if (!isDoctype && openMatch && !isClosing && !isSelfClosing && !isInlineClosed) level += 1
      return formatted
    })
    .join('\n')
}

function buildStaticHtmlResultShell(html, title = '静态 HTML 还原结果', options = {}) {
  const safeTitle = escapeHtml(title)
  const formattedSource = formatStaticHtmlSource(html)
  const sourceCode = escapeHtml(formattedSource)
  const thumbnail = options.thumbnail ? `<img src="${escapeHtmlAttr(options.thumbnail)}" alt="${safeTitle} 缩略图" />` : '<span>HTML</span>'
  const taskId = options.taskId || ''
  const assetId = options.assetId || taskId
  const homeUrl = options.homeUrl || projectScopedRoute('/factory')
  const retryUrl = options.retryUrl || (assetId
    ? projectScopedUrl(`/assets/${encodeURIComponent(assetId)}/preview?action=regenerate`)
    : projectScopedUrl('/factory'))
  const convertUrl = options.convertUrl || projectScopedUrl('/factory')
  const visualVerification = options.visualVerification || null
  const verificationStatus = visualVerification?.status || 'unknown'
  const verificationScore = Number(visualVerification?.summary?.averageScore || 0)
  // Quality audit remains backend-owned metadata; this shell keeps it out of the visible preview chrome.
  const qualityAudit = visualVerification?.qualityAudit || null
  const qualityAuditMetadata = qualityAudit
    ? {
        viewports: qualityAudit.viewports || [],
        issues: qualityAudit.issues || [],
        warnings: qualityAudit.warnings || [],
        recommendations: qualityAudit.recommendations || []
      }
    : null
  const verificationReason = visualVerification?.recommendations?.[0]
    || visualVerification?.results?.find((item) => item?.comparison?.error)?.comparison?.error
    || (verificationStatus === 'failed' ? '生成结果和原截图差异过大。' : '')
  const verificationBanner = verificationStatus === 'failed'
    ? `<div class="verification-banner" role="status"><strong>视觉验收未通过，仅供排查预览</strong><span>相似度 ${escapeHtml(String(verificationScore))}%${verificationReason ? ` · ${escapeHtml(verificationReason)}` : ''}</span></div>`
    : ''
  const previewPanelClass = `result-panel preview-panel is-active${verificationBanner ? ' has-verification-banner' : ''}`
  const downloadName = `${String(title || 'index').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'index'}.html`
  const scriptCloseTag = '</scr' + 'ipt>'
  const icon = (name) => `<svg class="action-icon" data-lucide="${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${{
    'refresh-cw': '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    sparkles: '<path d="M9.94 14.5 8.5 18.06 7.06 14.5 3.5 13.06 7.06 11.62 8.5 8.06 9.94 11.62 13.5 13.06 9.94 14.5Z"/><path d="M18 8.5 17.24 10.26 15.5 11 17.24 11.74 18 13.5 18.76 11.74 20.5 11 18.76 10.26 18 8.5Z"/><path d="M16 2 14.74 5.26 11.5 6.5 14.74 7.74 16 11 17.26 7.74 20.5 6.5 17.26 5.26 16 2Z"/>',
    'code-2': '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'
  }[name] || ''}</svg>`
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>流程通 · HTML 还原结果</title>
  ${staticHtmlFaviconMarkup()}
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; height: 100vh; overflow: hidden; background: #f6f7f9; color: #222529; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    .result-shell-standalone { height: 100vh; min-height: 0; display: grid; grid-template-rows: 80px minmax(0, 1fr); overflow: hidden; }
    .result-topbar { width: 100%; min-width: 0; height: 80px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 28px; background: rgba(255,255,255,.96); border-bottom: 1px solid #e8eaec; position: sticky; top: 0; z-index: 5; backdrop-filter: blur(12px); overflow: hidden; }
    .topbar-left, .topbar-actions, .thumb-title { min-width: 0; display: flex; align-items: center; gap: 12px; }
    .topbar-left { flex: 1 1 auto; overflow: hidden; }
    .topbar-actions { flex: 0 1 auto; justify-content: flex-end; overflow: hidden; }
    .back-home { width: 44px; height: 44px; border-radius: 999px; border: 1px solid #dfe3e8; background: #fff; color: #222529; font-size: 22px; display: inline-grid; place-items: center; cursor: pointer; }
    .thumb-title { font-weight: 800; }
    .thumb-title img, .thumb-title span { width: 56px; height: 40px; border-radius: 8px; border: 1px solid #dfe3e8; background: #f8fafc; object-fit: cover; display: inline-grid; place-items: center; color: #7f8792; font-size: 12px; flex: 0 0 auto; overflow: hidden; }
    .thumb-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 44vw; }
    .topbar-actions button, .topbar-actions a { flex: 0 0 auto; height: 40px; border-radius: 10px; border: 1px solid #dfe3e8; background: #fff; color: #222529; padding: 0 16px; font: inherit; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; cursor: pointer; }
    .topbar-actions .primary { background: #222529; border-color: #222529; color: #fff; }
    .action-icon { width: 16px; height: 16px; flex: 0 0 auto; }
    .result-tabbed-layout { width: 100%; max-width: 1760px; height: calc(100vh - 80px); min-height: 0; padding: 18px 24px 24px; margin: 0 auto; overflow: hidden; display: grid; }
    .result-content-card { min-width: 0; min-height: 0; height: 100%; display: grid; grid-template-rows: 58px minmax(0, 1fr); border: 1px solid #e0e5eb; border-radius: 12px; background: #fff; overflow: hidden; }
    .result-card-head { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 16px 0 20px; border-bottom: 1px solid #eef0f2; }
    .result-card-title { min-width: 0; display: grid; gap: 2px; }
    .result-card-title strong { font-size: 18px; color: #222529; }
    .result-card-title span { color: #7f8792; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-tabs { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid #dbe1e8; border-radius: 10px; background: #f5f7fa; }
    .result-tab { min-width: 86px; height: 36px; border: 0; border-radius: 7px; background: transparent; color: #68717d; padding: 0 12px; font: inherit; font-size: 14px; font-weight: 900; cursor: pointer; white-space: nowrap; }
    .result-tab.active { background: #222529; color: #fff; box-shadow: 0 6px 14px rgba(15, 23, 42, .16); }
    .result-panel { min-width: 0; min-height: 0; overflow: hidden; }
    .result-panel[hidden] { display: none !important; }
    .preview-panel.is-active { display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .preview-panel.has-verification-banner.is-active { grid-template-rows: auto auto minmax(0, 1fr); }
    .source-panel.is-active { display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .preview-toolbar, .source-toolbar { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #eef0f2; background: #fff; }
    .preview-size-group { display: inline-flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid #dbe1e8; border-radius: 10px; background: #f5f7fa; }
    .preview-size-button { min-width: 72px; height: 32px; border: 0; border-radius: 7px; background: transparent; color: #68717d; padding: 0 10px; font: inherit; font-size: 13px; font-weight: 900; cursor: pointer; white-space: nowrap; }
    .preview-size-button.active { background: #222529; color: #fff; box-shadow: 0 6px 14px rgba(15, 23, 42, .14); }
    .preview-toolbar-label, .source-toolbar-label { min-width: 0; color: #68717d; font-size: 12px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Size switching only changes width; keep this height chain intact so the iframe never falls back to its small default height. */
    .preview-stage { min-width: 0; min-height: 0; height: 100%; overflow: auto; background: #f6f7f9; padding: 16px; display: grid; justify-items: center; align-items: stretch; }
    .preview-frame-wrap { width: 100%; max-width: 100%; min-height: 100%; height: 100%; overflow: auto; background: #fff; box-shadow: 0 1px 0 rgba(20,28,40,.04), 0 18px 48px rgba(20,28,40,.08); }
    .verification-banner { display: grid; gap: 4px; padding: 10px 16px; border-bottom: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; font-size: 12px; line-height: 1.5; }
    .verification-banner strong { font-size: 13px; }
    .verification-banner span { overflow-wrap: anywhere; }
    .generated-preview-frame { width: 100%; height: 100%; min-height: 100%; overflow: auto; border: 0; background: #fff; display: block; }
    .copy-source-button { flex: 0 0 auto; height: 32px; border-radius: 8px; border: 1px solid #dfe3e8; background: #fff; color: #222529; padding: 0 12px; font: inherit; font-size: 13px; font-weight: 900; cursor: pointer; }
    .source-project-layout { min-width: 0; min-height: 0; display: grid; grid-template-columns: 220px minmax(0, 1fr); overflow: hidden; background: #101318; }
    .source-file-tree { min-width: 0; min-height: 0; padding: 14px 12px; border-right: 1px solid #242932; background: #0d1117; color: #9ca3af; }
    .source-file-tree strong { display: block; margin: 0 0 10px; color: #d1d5db; font-size: 12px; }
    .source-file { width: 100%; height: 34px; border: 0; border-radius: 7px; background: transparent; color: #9ca3af; padding: 0 10px; font: inherit; font-size: 13px; font-weight: 800; text-align: left; cursor: default; }
    .source-file.active { background: #1f2937; color: #f9fafb; }
    .source-file-editor { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr); overflow: hidden; }
    .generated-source-code { margin: 0; height: 100%; min-height: 0; padding: 18px 22px 42px; overflow: auto; background: #101318; color: #e5e7eb; font: 13px/1.75 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; tab-size: 2; }
    .generated-source-code code { display: block; min-width: max-content; }
    .asset-id { border-radius: 999px; background: #f1f3f5; color: #68717d; padding: 6px 10px; font-size: 12px; font-weight: 800; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toast { position: fixed; right: 18px; bottom: 18px; background: #222529; color: #fff; border-radius: 8px; padding: 10px 12px; font-size: 13px; opacity: 0; transform: translateY(8px); transition: opacity .16s ease, transform .16s ease; z-index: 10; }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 980px) {
      .result-topbar { height: auto; min-height: 80px; align-items: flex-start; flex-direction: column; padding: 14px 16px; }
      .topbar-left, .topbar-actions { width: 100%; justify-content: flex-start; }
      .result-shell-standalone { grid-template-rows: auto minmax(0, 1fr); }
      .result-tabbed-layout { padding: 14px; }
      .result-card-head { height: auto; min-height: 58px; align-items: flex-start; flex-direction: column; padding: 12px 14px; }
      .result-tabs { width: 100%; }
      .result-tab { flex: 1 1 0; min-width: 0; }
      .thumb-title strong { max-width: 62vw; }
      .preview-toolbar, .source-toolbar { align-items: flex-start; flex-direction: column; }
      .preview-size-group { width: 100%; }
      .preview-size-button { flex: 1 1 0; min-width: 0; }
      .source-project-layout { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
      .source-file-tree { border-right: 0; border-bottom: 1px solid #242932; }
    }
  </style>
</head>
<body>
  <main class="result-shell-standalone" data-task-id="${escapeHtmlAttr(taskId)}" data-verification-status="${escapeHtmlAttr(verificationStatus)}">
    <header class="result-topbar">
      <div class="topbar-left">
        <button class="back-home" type="button" id="back-home" aria-label="返回首页">←</button>
        <div class="thumb-title">${thumbnail}<strong>${safeTitle}</strong></div>
        <span class="asset-id">任务 ID：${escapeHtml(assetId || taskId || '未返回')}</span>
      </div>
      <div class="topbar-actions">
        <button type="button" id="retry-generate">${icon('refresh-cw')}重新生成</button>
        <button type="button" id="convert-vue">${icon('code-2')}转 Vue 代码</button>
        <a class="primary" id="download-source" download="${escapeHtmlAttr(downloadName)}" href="#">${icon('download')}下载 HTML</a>
      </div>
    </header>
    <section class="result-tabbed-layout">
      <article class="result-content-card" data-quality-audit="${qualityAuditMetadata ? 'available' : 'none'}">
        <div class="result-card-head">
          <div class="result-card-title"><strong>HTML 渲染</strong><span>可检索布局 HTML，不是截图</span></div>
          <div class="result-tabs" role="tablist" aria-label="HTML 预览切换">
            <button class="result-tab active" type="button" role="tab" aria-selected="true" data-result-tab="render">HTML 渲染</button>
            <button class="result-tab" type="button" role="tab" aria-selected="false" data-result-tab="source">源码展示</button>
          </div>
        </div>
        <section class="${previewPanelClass}" data-result-panel="render">
        ${verificationBanner}
        <div class="preview-toolbar">
          <span class="preview-toolbar-label">预览尺寸</span>
          <div class="preview-size-group" role="group" aria-label="预览尺寸">
            <button class="preview-size-button" type="button" data-preview-size="390">390</button>
            <button class="preview-size-button" type="button" data-preview-size="768">768</button>
            <button class="preview-size-button" type="button" data-preview-size="1440">1440</button>
            <button class="preview-size-button" type="button" data-preview-size="1920">1920</button>
          </div>
        </div>
        <div class="preview-stage">
          <div class="preview-frame-wrap" id="preview-frame-wrap">
            <iframe id="generated-preview-frame" class="generated-preview-frame" title="HTML 生成效果" sandbox="allow-forms allow-scripts"></iframe>
          </div>
        </div>
        </section>
        <section class="result-panel source-panel" data-result-panel="source" hidden>
        <div class="source-toolbar">
          <span class="source-toolbar-label">HTML 源码</span>
          <button class="copy-source-button" type="button" id="copy-source-code">复制代码</button>
        </div>
        <div class="source-project-layout" aria-label="源码文件">
          <aside class="source-file-tree">
            <strong>文件</strong>
            <button class="source-file active" type="button" aria-current="true">index.html</button>
          </aside>
          <div class="source-file-editor">
            <pre id="generated-source-code" class="generated-source-code"><code>${sourceCode}</code></pre>
          </div>
        </div>
        </section>
      </article>
    </section>
  </main>
  <div class="toast" id="copy-toast">代码已复制</div>
  <script type="application/json" id="generated-html-json">${JSON.stringify(String(html || '')).replace(/</g, '\\u003c')}${scriptCloseTag}
  <script type="application/json" id="copy-source-json">${JSON.stringify(String(formattedSource || '')).replace(/</g, '\\u003c')}${scriptCloseTag}
  <script>
    const backHome = document.getElementById('back-home');
    const convertVue = document.getElementById('convert-vue');
    const retryGenerate = document.getElementById('retry-generate');
    const toast = document.getElementById('copy-toast');
    const html = JSON.parse(document.getElementById('generated-html-json').textContent || '""');
    const sourceHtml = JSON.parse(document.getElementById('copy-source-json').textContent || '""');
    const download = document.getElementById('download-source');
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const previewFrame = document.getElementById('generated-preview-frame');
    const previewFrameWrap = document.getElementById('preview-frame-wrap');
    const copySourceCode = document.getElementById('copy-source-code');
    const backTargetUrl = '/#${escapeHtmlAttr(homeUrl)}';
    const retryTargetUrl = '${escapeHtmlAttr(retryUrl)}';
    const convertTargetUrl = '${escapeHtmlAttr(convertUrl)}';
    function setResultTab(tabName = 'render') {
      const nextTab = tabName === 'source' ? 'source' : 'render';
      document.querySelectorAll('[data-result-tab]').forEach((tab) => {
        const active = tab.dataset.resultTab === nextTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-result-panel]').forEach((panel) => {
        const active = panel.dataset.resultPanel === nextTab;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    }
    document.querySelectorAll('[data-result-tab]').forEach((tab) => {
      tab.addEventListener('click', () => setResultTab(tab.dataset.resultTab));
    });
    setResultTab('render');
    function previewHtmlForFrame(rawHtml = '') {
      const source = String(rawHtml || '');
      if (!source || source.includes('generated-preview-fit-style')) return source;
      const style = '<style id="generated-preview-fit-style">html,body{min-height:100vh !important;height:auto !important;}body{margin:0 !important;overflow-x:auto !important;}body>*:first-child,.app,.page,.container,.wrapper,main{min-height:100vh !important;height:auto !important;max-height:none !important;}[style*="height:"]{max-height:none !important;}</style>';
      return /<\\/head>/i.test(source)
        ? source.replace(/<\\/head>/i, style + '</head>')
        : style + source;
    }
    if (download) {
      download.href = blobUrl;
    }
    if (previewFrame) previewFrame.srcdoc = previewHtmlForFrame(html);
    function setPreviewSize(width = 1440) {
      const nextWidth = Number(width) || 1440;
      document.querySelectorAll('[data-preview-size]').forEach((button) => {
        const active = Number(button.dataset.previewSize) === nextWidth;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (!previewFrame || !previewFrameWrap) return;
      previewFrame.style.width = nextWidth + 'px';
      previewFrameWrap.style.width = nextWidth + 'px';
    }
    document.querySelectorAll('[data-preview-size]').forEach((button) => {
      button.addEventListener('click', () => setPreviewSize(button.dataset.previewSize));
    });
    setPreviewSize(1440);
    backHome.addEventListener('click', () => {
      try {
        window.top.location.replace(backTargetUrl);
      } catch {
        window.location.replace(backTargetUrl);
      }
    });
    convertVue.addEventListener('click', () => {
      try {
        window.top.location.href = convertTargetUrl;
      } catch {
        window.location.href = convertTargetUrl;
      }
    });
    function navigateTop(url = '') {
      if (!url) return;
      try {
        window.top.location.href = url;
      } catch {
        window.location.href = url;
      }
    }
    function sendOrNavigate(type, detail = {}, fallbackUrl = '') {
      let posted = false;
      try {
        if (fallbackUrl && window.parent && window.parent !== window && !window.opener) {
          navigateTop(fallbackUrl);
          return;
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type, assetId: '${escapeHtmlAttr(assetId)}', ...detail }, '*');
          posted = true;
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type, assetId: '${escapeHtmlAttr(assetId)}', ...detail }, '*');
          posted = true;
        }
      } catch {}
      if (!posted && fallbackUrl) {
        navigateTop(fallbackUrl);
      }
    }
    retryGenerate.addEventListener('click', () => sendOrNavigate('image-html-retry', { mode: 'enhanced' }, retryTargetUrl));
    copySourceCode?.addEventListener('click', async () => {
      sendOrNavigate('image-html-copy-source', { html: sourceHtml });
      try {
        await navigator.clipboard.writeText(sourceHtml);
      } catch {
        const area = document.createElement('textarea');
        area.value = sourceHtml;
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

function imageAdvancedMarkdownRules() {
  return [
    '# 图片转 HTML 增强生成规范',
    '',
    '## 基础框架',
    '- 默认使用当前项目 MD 设计规范。',
    '- 不动基础页面框架、信息层级、左右分栏、顶部工具栏和生成结果结构。',
    '- 只在现有框架上增强视觉质感、图片素材、图标体系和微交互。',
    '',
    '## 高级视觉',
    '- 将低质或占位图片替换为更高级、更贴合业务语义的图片素材。',
    '- 图片优先选择 PNG 格式素材，尤其是 Logo、图形元素、透明底装饰、产品贴片和头像遮罩；只有照片质感更合适时才使用 JPG/WebP。',
    '- Logo 必须寻找更好看的 PNG 或透明底 PNG 替代，不能用模糊截图裁切、低清位图、emoji 或随手画的 SVG 假冒品牌标识。',
    '- 图片必须服务于页面内容，不使用纯氛围、过度裁切或不可辨识图片。',
    '- 自动识别图片品类：食品/餐饮/美食用食物图片，化妆品/美妆/护肤用产品静物图，人物/头像/卡通区域用对应人像或插画。',
    '- 每个图片位先判断素材类型：纯人物用于头像、数字人、讲师、用户形象；纯元素用于 Logo、icon、产品、徽章、装饰贴片；组合场景用于 hero、课程封面、活动卡片和氛围封面。',
    '- 图片和文字必须分层，避免标题、按钮、标签、时间角标被头像、商品图、卡通图或色块遮挡。',
    '- 保持原截图的布局比例和主要内容位置。',
    '',
    '## 可用页面规范',
    '- 生成结果必须像真实可用的 Web 页面或移动 App 页面，不是只追求截图相似的静态海报。',
    '- 使用 header、main、section、footer、nav、aside、button、form 等语义结构组织页面。',
    '- 按钮、导航、标签、输入框、筛选器、卡片入口要有明确 hover 和 focus 状态。',
    '- 图片必须有 alt；表单项必须有 label 或 aria-label；点击区域和文本层级符合常见 Web/App 页面规范。',
    '',
    '## 基础组件密度与交互规范',
    '- 搜索框、输入框、按钮、筛选器、分页、标签和侧边栏严格参考饿了么 / Element Plus 中后台基础组件框架还原，保持克制、紧凑、可扫描的信息密度。',
    '- 按钮最大高度 40px；小按钮 28px-32px，默认按钮 32px-36px，主要按钮和带图标按钮也不能超过 40px；不要做成 48px 以上的营销大按钮。',
    '- 搜索框和输入框高度不超过 40px，默认 32px-36px；placeholder、前后缀图标、清除按钮和 loading 状态要齐全，focus 时只强化边框或轻量阴影。',
    '- 不要出现浏览器默认虚框：input、textarea、select、搜索框、按钮和 tab 可写 outline: none，但必须用 :focus-visible 自定义 1px-2px 边框、轻量 box-shadow 或背景态替代，保证键盘可见焦点。',
    '- 下拉框必须参考 Element Plus 交互：触发器 32px-36px、箭头 12px 或 16px、菜单浮层 4px/8px 圆角、选项 32px-36px；下拉 hover、selected、disabled、focus-visible 和键盘高亮状态都要完整。',
    '- 同一工具栏里的输入框和按钮必须同高，使用 8px / 12px gap 对齐；按钮文字不换行，图标使用 12px / 16px / 20px / 24px 阶梯并与文字垂直居中。',
    '- 侧边栏按中后台适配规则：桌面展开宽度 200px-240px，折叠宽度 56px-64px；菜单项高度 40px-48px，图标与菜单文字同轴对齐，窄屏可折叠或转抽屉。',
    '- 基础组件必须覆盖 hover、focus、active、disabled、loading、clearable 等交互状态，不只画静态外观。',
    '',
    '## 响应式与自适应布局',
    '- 同时检查 390px、768px、1440px 三档视口，使用媒体查询、clamp、容器宽度和流式间距。',
    '- 桌面 Web / SaaS / 后台必须先做 1920px 宽屏布局，再向下适配 1440px / 768px / 390px；不要先做 1440px 内容岛再居中放到 1920px。',
    '- 1920px 预览要利用宽屏展开内容：后台/工具页可增加列数、拉开主内容、扩展表格/卡片/素材网格、保留侧边栏和工具栏节奏；不要出现 1440 内容岛居中或中间窄岛。',
    '- 官网/落地页即使有 max-width，也要用 full-width band、背景层、分栏或内容延展处理 1920px，不能让中间区域孤立悬在大空白里。',
    '- Web/桌面按 1920px 逻辑宽度设计，移动端按 375px 逻辑宽度设计；页面高度随内容自然增长，高度自适应，不要固定高度去凑截图比例。',
    '- 图片区域可以固定比例容器，但图片本身不要拉伸变形；必须使用 object-fit: contain 或 object-fit: cover 并配合 aspect-ratio、max-width、max-height 保持原始比例。',
    '- 优先使用 flex、grid、minmax、max-width、min-width: 0、aspect-ratio、object-fit、gap 等稳定布局能力。',
    '- 固定宽度内容要有 max-width 和 overflow 兜底；卡片、表格、工具栏、图片区域在窄屏下自然换行或堆叠。',
    '- 首屏不能因视口变化出现文字压扁、按钮挤出、图片遮挡、卡片重叠或横向不可控溢出。',
    '- Tab、分类栏、胶囊筛选和横向菜单超出容器时必须横向滚动，不要换行或挤压文字；右侧使用渐隐遮罩 / fade mask 暗示还有内容，滚动条可隐藏但交互必须可用。',
    '- 390px / H5 移动端如果出现侧边栏、视频入口或大量顶部按钮，参考饿了么 H5 和大厂 H5 页面：移动端顶部按钮要隐藏或收纳，重操作收纳到“更多”按钮、底部导航、悬浮入口或抽屉菜单。',
    '- 侧边栏视频在 H5 中不要把桌面侧边栏硬塞成九宫格或大面积空白；主操作最多保留 1 个主按钮，其余入口用横向 chip、底部 tab、浮动工具按钮或抽屉二级菜单承接。',
    '- 避免夸张错落排版：标题、头像、tab、表单、按钮和卡片必须沿 4px 网格、同轴或基线对齐，不要为了像截图而制造随机错位、漂浮、过大的上下落差。',
    '',
    '## 4px 基础网格与圆角梯度',
    '- 页面采用 4px 基础网格：margin、padding、gap、组件高度、图标容器、头像尺寸和分割线间距优先使用 4px 倍数。',
    '- 间距按 4px 倍数递进：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px；不要出现 7px、13px、19px 这类随意间距。',
    '- 字号以 14px 正文为基准，采用 4px 递进组织层级：12px 辅助/标签、14px 默认正文、16px 主正文、18px 子标题、20px 卡片标题、24px 模块标题、28px 页面标题。',
    '- 行高也按 4px 网格贴合：12px 对 16px、14px 对 20px、16px 对 22px 或 24px、20px 对 28px、24px 对 32px、28px 对 38px。',
    '- 圆角梯度使用固定 token：2px 用于细小描边/表格单元，4px 用于标签和小控件，6px 用于输入框和按钮，8px 用于卡片和面板；普通卡片不要超过 8px。',
    '- 12px / 16px 圆角只用于大图、hero 封面、人物/商品图片容器或截图原图明确的大圆角模块，不能全页面滥用大圆角。',
    '',
    '## 字号、密度与比例归一化规范',
    '- 不直接照搬截图像素尺寸；先判断截图是否来自浏览器缩放、Retina 高分屏、长图裁切或非标准缩放，再归一化到真实产品页面密度。',
    '- 桌面 Web / SaaS / 后台以 1440px 作为主要桌面验收基准，1920px 作为宽屏验收基准；1920px 下只增加留白、列数或内容宽度，不把整页字体、图标、图片线性放大。',
    '- 内容容器按页面类型设置 max-width：官网/落地页常用 1200px-1440px，表单页常用 720px-960px，后台可满宽但保持合理信息密度。',
    '- 使用字体 token 或 CSS 变量管理字号：辅助文字 12px-13px，后台/SaaS 正文以 14px 为主，普通官网正文以 16px 为主，卡片标题 16px-20px，页面标题 24px-32px，Hero 标题用 clamp() 限制在合理区间。',
    '- 可读文字不得小于 12px；不要使用负字距；不要用 vw 线性放大正文；标题可用 clamp()，正文保持稳定字号和行高。',
    '- 按组件语义联动尺寸：小按钮 32px、常规按钮 36px-40px、强主按钮或移动端按钮 44px-48px；图标按 16px-24px 规格匹配按钮、导航、功能入口，不随截图比例盲目等比缩放。',
    '- 图片不跟字体等比例缩放，图片必须按容器比例和内容语义适配：头像使用 32px / 40px / 48px / 64px 等规格，商品图和封面图使用 aspect-ratio、object-fit、max-width、max-height 保持稳定。',
    '- 不能用 transform: scale 或整页 zoom 解决页面过大/过小问题；应通过容器、字号 token、组件规格、媒体查询和图片容器比例修正。',
    '',
    '## 文字可读性与换行规则',
    '- 按钮文字、导航项、标签、角标、价格、状态 pill 等短文本不换行，并在 CSS 中使用 white-space: nowrap。',
    '- 短标签不拆行，短按钮、tab 项、筛选 chip、下拉选项和导航项也不能被拆行或单字换行；空间不足时优先横向滚动、收纳、ellipsis 或缩短文案。',
    '- 标题、描述、卡片正文允许自然换行，但要设置合理 line-height、max-width，并用 line-clamp 或 ellipsis 处理超长标题。',
    '- 不使用过小字号或负字距；中文、英文、数字混排要可读，长单词或 URL 要有 overflow-wrap 兜底。',
    '- 任何文字都不能被图片、图标、装饰、遮罩或 fixed/sticky 元素遮挡。',
    '',
    '## 图标体系',
    '- 先从一批精致图标库中选择同一风格：Lucide、Heroicons、Tabler Icons、Remix Icon、Phosphor Icons；整页只能使用一个主图标库风格。',
    '- 图标统一使用当前项目正在使用的图标库和 lucide 图标语义；若截图图标更适合其他精致图标库，也必须保持线性/面性/圆角/粗细一致。',
    '- 静态 HTML 中可用 data-lucide、内联 lucide 风格 SVG 或等价线性图标。',
    '- 图标必须等比例放大缩小，保持 viewBox 和 stroke-width 视觉一致，禁止拉伸、压扁、旋转凑形或把图片当图标硬裁。',
    '- 图标大小只使用 12px / 16px / 20px / 24px 阶梯：12px 用于极小辅助态，16px 用于正文、按钮和菜单，20px 用于导航和功能入口，24px 用于顶部入口或大按钮。',
    '- 图标大小要和旁边文字大小接近，图标视觉高度不超过相邻文字高度；正文/菜单图标约等于文字字号或大 1-2px，按钮图标通常 16px-20px，顶部导航/功能入口通常 20px-24px。',
    '- 图标和文字要用 inline-flex / gap / align-items:center 对齐，不能出现图标过小、漂浮、和文字基线错位。',
    '- 不引入 Element Plus 图标或其他风格冲突的图标集。',
    '',
    '## 生成前自检',
    '- 自检 390px、768px、1440px 三档：导航、按钮文字、标签、卡片标题、图片、表单和底部区域都不能错位或遮挡。',
    '- 自检 1920px 宽屏：页面只能更舒展，不能整体变巨大；正文、按钮、图标、图片尺寸仍符合产品密度。',
    '- 比例归一化自检：确认没有直接照搬截图像素、没有使用整页 transform: scale、没有让 Retina/缩放截图导致字体和图片异常放大。',
    '- 自检语义结构：header、main、section、footer 是否完整，交互控件是否有 hover / focus，图片是否有 alt，表单是否有 label。',
    '- 灰度测试 / grayscale 自检：把页面色彩去饱和后，标题、正文、按钮、标签、状态、图表和价格仍要黑白可读；选中、警告、成功、禁用等状态不能只靠颜色作为唯一信息。',
    '- 自检生成 HTML 是单文件可运行、响应式、自适应、可读、可点击的页面。'
  ].join('\n')
}

async function generateFromImage(options = {}) {
  if (!imageCodeForm.imageDataUrl) {
    setStatus(imageCodeStatus, 'failed', '请先上传一张设计图或截图')
    return
  }
  applyAppFavicon()
  const enhancedGeneration = true
  const standalonePreview = Boolean(options.standalone)
  setStatus(imageCodeStatus, 'loading', '正在按 MD 规范生成页面代码...')
  const title = imageCodeForm.fileName || '图片转代码页面'
  const clientTaskId = `image-html-${createClientId()}`
  const reusePreviewWindow = !standalonePreview && Boolean(options.reusePreviewWindow && options.previewWindow && !options.previewWindow.closed)
  const previewWindow = standalonePreview ? null : (reusePreviewWindow ? options.previewWindow : window.open(previewTaskUrl(clientTaskId), '_blank'))
  const renderStaticHtmlPreview = (html) => standalonePreview
    ? writeStandalonePreviewHtml(html)
    : writeStaticHtmlPreviewWindow(previewWindow, html)
  const initialGenerationMessage = '后端正在保留基础框架，并按 MD 规范增强图片、图标和视觉细节。'
  const imageUrl = `image://${title}`
  const captureResult = {
    taskId: createClientId(),
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
  renderStaticHtmlPreview(buildStaticHtmlLoadingPage(title, initialGenerationMessage, {
    taskId: clientTaskId,
    stepIndex: 0
  }))
  if (!standalonePreview && !reusePreviewWindow) updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
  const task = recordFactoryTask('image-to-code', {
    title: `图片转代码：${title}`,
    sourceUrl: imageUrl,
    captureResult,
    message: '后端正在根据上传图片生成结构化 HTML'
  })
  let streamedHtmlSource = ''
  let previewRenderedGeneratedHtml = false
  setStatus(pageGenerationStatus, 'loading', '正在生成高保真 HTML，成功后会进入还原详情...')
  try {
    // Normal image-to-HTML generation is the enhanced path; legacy advanced actions route here.
    const imagePayload = {
      projectId: state.currentProjectId,
      clientTaskId,
      title,
      target: imageCodeForm.target,
      prompt: imageCodeForm.prompt,
      imageDataUrl: imageCodeForm.imageDataUrl,
      generationMode: 'advanced',
      markdownRules: imageAdvancedMarkdownRules(),
      keepBaseFramework: enhancedGeneration,
      imageUpgrade: 'replace-with-premium-contextual-images',
      iconSystem: 'lucide-current-project-icons',
      captureResult,
      palette: state.palette,
      designRules
    }
    const result = await api.generation.imageToHtmlStream(state.apiConfig, imagePayload, {
      timeoutMs: imageToHtmlRequestTimeoutMs(),
      onEvent: (event) => {
        if (event.type === 'status' && event.data?.label) {
          const eventStatus = event.data?.status || 'generating'
          if (eventStatus === 'failed' && previewRenderedGeneratedHtml) {
            setStatus(imageCodeStatus, 'failed', event.data.label)
            return
          }
          setStatus(imageCodeStatus, eventStatus === 'failed' ? 'failed' : 'loading', event.data.label)
          renderStaticHtmlPreview(buildStaticHtmlStatusPage(title, event.data.label, {
            heading: eventStatus === 'failed' ? '生成失败' : '页面生成中',
            tone: eventStatus === 'failed' ? 'failed' : 'loading',
            taskId: clientTaskId,
            sourceCode: streamedHtmlSource,
            stepIndex: event.data?.status === 'fallback' ? 2 : 1
          }))
          if (!standalonePreview && !reusePreviewWindow) updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
        }
        if (event.type === 'delta' && event.data?.content) {
          streamedHtmlSource += event.data.content
          setStatus(imageCodeStatus, 'loading', '模型正在生成 HTML 代码...')
          renderStaticHtmlPreview(buildStaticHtmlStatusPage(title, '模型正在生成 HTML 代码，完成后会自动替换为可预览页面。', {
            heading: '页面生成中',
            tone: 'loading',
            taskId: clientTaskId,
            sourceCode: streamedHtmlSource,
            stepIndex: 2
          }))
          if (!standalonePreview && !reusePreviewWindow) updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
        }
        if (event.type === 'artifact' && event.data?.html) {
          state.generatedPageHtml = event.data.html
          previewRenderedGeneratedHtml = true
          selectedReactFile.value = 'index.html'
          renderStaticHtmlPreview(buildStaticHtmlResultShell(event.data.html, title, {
            thumbnail: imageCodeForm.imageDataUrl,
            taskId: event.data?.restoredPage?.id || clientTaskId,
            assetId: event.data?.restoredPage?.id || clientTaskId,
            visualVerification: event.data?.visualVerification,
            retryUrl: event.data?.restoredPage?.id
              ? projectScopedUrl(`/assets/${encodeURIComponent(event.data.restoredPage.id)}/preview?action=regenerate`, event.data.restoredPage.projectId || state.currentProjectId)
              : projectScopedUrl('/factory'),
            convertUrl: event.data?.restoredPage?.id
              ? projectScopedUrl(`/assets/${encodeURIComponent(event.data.restoredPage.id)}/preview?action=convert-vue`, event.data.restoredPage.projectId || state.currentProjectId)
              : projectScopedUrl('/factory')
          }))
          if (!standalonePreview && !reusePreviewWindow) {
            updateStaticHtmlPreviewUrl(previewWindow, event.data?.restoredPage?.id
              ? projectScopedRoute(`/assets/${encodeURIComponent(event.data.restoredPage.id)}/preview`, event.data.restoredPage.projectId || state.currentProjectId)
              : clientTaskId)
          }
        }
      }
    })
    const data = applyApiResult(imageCodeStatus, result, '图片转代码失败')
    if (!data?.html) {
      setStatus(pageGenerationStatus, 'failed', data?.message || result.message || '图片转代码失败，没有返回结构化 HTML。')
      renderStaticHtmlPreview(buildStaticHtmlFailurePage('生成失败', pageGenerationStatus.value.message))
      if (!standalonePreview && !reusePreviewWindow) updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
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
      renderStaticHtmlPreview(buildStaticHtmlFailurePage('资产保存失败', pageGenerationStatus.value.message))
      if (!standalonePreview && !reusePreviewWindow) updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
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
    if (restoredPage) persistRestoredPageSelection(restoredPage.id)
    if (standalonePreview && restoredPage) {
      window.history.replaceState(null, '', projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview`, restoredPage.projectId || state.currentProjectId))
      refreshCurrentLocationHash()
      renderStaticHtmlPreview(buildStaticHtmlResultShell(data.html, title, {
        thumbnail: imageCodeForm.imageDataUrl,
        taskId: restoredPage.id,
        assetId: restoredPage.id,
        visualVerification,
        retryUrl: projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview?action=regenerate`, restoredPage.projectId || state.currentProjectId),
        convertUrl: projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview?action=convert-vue`, restoredPage.projectId || state.currentProjectId)
      }))
    } else if (!reusePreviewWindow && restoredPage) {
      replaceStaticHtmlPreviewRoute(previewWindow, projectScopedRoute(`/assets/${encodeURIComponent(restoredPage.id)}/preview`, restoredPage.projectId || state.currentProjectId))
    }
    if (reusePreviewWindow && restoredPage) {
      renderStaticHtmlPreview(buildStaticHtmlResultShell(data.html, title, {
        thumbnail: imageCodeForm.imageDataUrl,
        taskId: restoredPage.id,
        assetId: restoredPage.id,
        visualVerification,
        retryUrl: projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview?action=regenerate`, restoredPage.projectId || state.currentProjectId),
        convertUrl: projectScopedUrl(`/assets/${encodeURIComponent(restoredPage.id)}/preview?action=convert-vue`, restoredPage.projectId || state.currentProjectId)
      }))
    }
  } catch (error) {
    const failureMessage = imageToHtmlExceptionMessage(error)
    setStatus(imageCodeStatus, 'failed', `图片转代码异常：${error.message || '未知错误'}`)
    setStatus(pageGenerationStatus, 'failed', failureMessage)
    renderStaticHtmlPreview(buildStaticHtmlFailurePage('生成异常', failureMessage))
    if (!standalonePreview && !reusePreviewWindow) updateStaticHtmlPreviewUrl(previewWindow, clientTaskId)
    updateFactoryTask(task.id, {
      status: 'failed',
      message: imageCodeStatus.value.message,
      failureReason: imageCodeStatus.value.message
    })
  }
}

function imageToHtmlExceptionMessage(error = {}) {
  const message = String(error?.message || error || '未知错误').trim()
  if (/network error|failed to fetch|networkerror|load failed/i.test(message)) {
    return [
      '图片转代码未生成真实 HTML：浏览器到后端的生成连接中断，或后端到模型 provider 的响应体读取失败。',
      `原始错误：${message}`,
      '当前图片转 HTML 请求不是前端等待超时；临时预览页会持续等待后端保存结果，但模型/provider 网络断开仍需要重新生成或切换模型配置。'
    ].join('\n')
  }
  return [
    '图片转代码未生成真实 HTML：后端视觉生成服务异常。',
    `原始错误：${message}`
  ].join('\n')
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
    id: createClientId(),
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
function workflowKnowledgeContextText(item = {}) {
  return [
    item.title ? `标题：${item.title}` : '',
    item.meta ? `类型：${item.meta}` : '',
    item.notes ? `备注：${item.notes}` : '',
    item.content ? `内容：${item.content}` : '',
    item.summary ? `摘要：${item.summary}` : ''
  ].filter(Boolean).join('\n').slice(0, 1800)
}

function workflowKnowledgeSearchTerms(query = '') {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 24)
}

function rankWorkflowKnowledgeItems(query = '', items = [], activeScope = null) {
  const terms = workflowKnowledgeSearchTerms(query)
  const scopeTerms = [
    activeScope?.nodeId,
    activeScope?.nodeTitle,
    activeScope?.screenId,
    activeScope?.screenTitle,
    activeScope?.flowId,
    activeScope?.flowTitle
  ].map((term) => String(term || '').toLowerCase()).filter(Boolean)
  const scoreItem = (item = {}) => {
    const text = workflowKnowledgeContextText(item).toLowerCase()
    const categoryBoost = /interaction|prototype|blueprint|交互|原型|流程|热区/.test(`${item.category || ''} ${item.title || ''}`) ? 6 : 0
    const termScore = terms.reduce((score, term) => score + (text.includes(term) ? 2 : 0), 0)
    const relationText = JSON.stringify({
      id: item.id,
      title: item.title,
      category: item.category,
      blueprintNodeId: item.blueprintNodeId,
      relations: item.relations,
      sourceMaterialId: item.sourceMaterialId
    }).toLowerCase()
    const scopeScore = scopeTerms.reduce((score, term) => score + (relationText.includes(term) || text.includes(term) ? 8 : 0), 0)
    const freshness = new Date(item.updatedAt || item.createdAt || 0).getTime() || 0
    return { item, score: categoryBoost + termScore + scopeScore, freshness }
  }
  return [...items]
    .map(scoreItem)
    .sort((a, b) => b.score - a.score || b.freshness - a.freshness)
    .map(({ item }) => item)
}

function workflowActiveKnowledgeScope() {
  const node = selectedKnowledgeNode.value || null
  const nodeDetail = selectedKnowledgeNodeDetail.value || {}
  const page = selectedKnowledgePrototypePage.value || null
  const screen = selectedKnowledgePrototypeScreen.value || null
  const flow = selectedKnowledgeFlow.value || null
  if (!node && !page && !screen && !flow) return null
  return {
    nodeId: node?.id || page?.nodeId || '',
    nodeTitle: nodeDetail.title || node?.title || page?.title || screen?.title || '',
    screenId: screen?.id || page?.id || '',
    screenTitle: screen?.title || page?.title || '',
    flowId: flow?.id || '',
    flowTitle: flow?.title || flow?.name || ''
  }
}

function workflowSelectedKnowledgeScopeDocuments(query = '', projectId = state.currentProjectId) {
  const scope = workflowActiveKnowledgeScope()
  if (!scope || projectId !== state.currentProjectId) return []
  const node = selectedKnowledgeNode.value || {}
  const detail = selectedKnowledgeNodeDetail.value || {}
  const page = selectedKnowledgePrototypePage.value || {}
  const screen = selectedKnowledgePrototypeScreen.value || {}
  const flow = selectedKnowledgeFlow.value || {}
  const visual = selectedKnowledgeNodeVisualContext.value || {}
  const content = [
    '当前框选功能范围优先于项目全局知识；本次需求只能围绕该功能及上下游依赖分析。',
    selectedKnowledgeNodeAiContext.value,
    detail.goal ? `功能目标：${detail.goal}` : '',
    detail.flowSteps?.length ? `功能流程：${detail.flowSteps.slice(0, 8).join(' / ')}` : '',
    detail.relatedPages?.length ? `关联页面：${detail.relatedPages.join(' / ')}` : '',
    page.title ? `原型页面：${page.title}` : '',
    page.primaryAction ? `页面主动作：${page.primaryAction}` : '',
    page.components?.length ? `页面组件：${page.components.map((item) => item.label || item.name || item.type).filter(Boolean).slice(0, 12).join(' / ')}` : '',
    page.actions?.length ? `页面热区：${page.actions.map((item) => item.label || item.action || item.targetScreenId).filter(Boolean).slice(0, 12).join(' / ')}` : '',
    flow.title || flow.name ? `当前流程：${flow.title || flow.name}` : '',
    flow.steps?.length ? `流程步骤：${flow.steps.slice(0, 8).map((step) => [step.title, step.actionLabel, step.from, step.to].filter(Boolean).join(' -> ')).join(' / ')}` : '',
    screen.title ? `截图页面：${screen.title}` : '',
    visual.screenshotUrl ? `截图：${visual.screenshotUrl}` : '',
    query ? `用户需求：${query}` : ''
  ].filter(Boolean).join('\n').slice(0, 2400)
  if (!content.trim()) return []
  return [{
    id: `selected-knowledge-scope-${scope.nodeId || scope.screenId || scope.flowId || 'current'}`,
    name: `框选功能：${scope.nodeTitle || scope.screenTitle || scope.flowTitle || '当前功能'}`,
    type: 'knowledge',
    sourceType: 'selected-knowledge-scope',
    content,
    text: content,
    status: '已读取',
    knowledgeMaterialId: node.id || page.id || screen.id || flow.id || '',
    selectedKnowledgeScope: scope
  }]
}

function workflowKnowledgeContextDocuments(limit = 8, query = '', projectId = state.currentProjectId) {
  const project = state.projects.find((item) => item.id === projectId) ||
    (projectId === state.currentProjectId ? currentProject.value : null) ||
    {}
  const projectContextDocuments = buildProjectKnowledgeContextDocuments({
    project,
    assets: scopeItems(state.assets, projectId),
    materials: scopeItems(state.knowledge, projectId),
    query,
    limit: Math.min(4, limit)
  })
  const materialLimit = Math.max(0, limit - projectContextDocuments.length)
  const materialDocuments = rankWorkflowKnowledgeItems(query, scopeItems(state.knowledge, projectId), workflowActiveKnowledgeScope())
    .filter((item) => item?.type === 'knowledge' && workflowKnowledgeContextText(item))
    .slice(0, materialLimit)
    .map((item, index) => ({
      id: `project-knowledge-${item.id || index + 1}`,
      name: `项目知识库：${item.title || `知识 ${index + 1}`}`,
      type: 'knowledge',
      sourceType: 'project-knowledge',
      content: workflowKnowledgeContextText(item),
      text: workflowKnowledgeContextText(item),
      status: '已读取',
      knowledgeMaterialId: item.id || ''
    }))
  return [...projectContextDocuments, ...materialDocuments].slice(0, limit)
}

const currentUser = computed(() =>
  state.users.find((user) => user.id === state.currentUserId) || state.users[0] || createUser()
)
const accountProjects = computed(() =>
  state.projects.filter((project) => project.ownerUserId === state.currentUserId)
)
const currentProject = computed(() =>
  accountProjects.value.find((project) => project.id === state.currentProjectId) || accountProjects.value[0] || state.projects[0] || null
)
const shouldShowWorkflowProjectSelector = computed(() => workflowForm.demandScope === 'project')
const workflowProjectContextLabel = computed(() => '项目')
const workflowProjectContextValue = computed(() => {
  return workflowAnalysisProject.value ? displayProjectName(workflowAnalysisProject.value) : '未绑定项目'
})
const workflowAnalysisProject = computed(() => {
  if (workflowForm.demandScope === 'project') return currentProject.value
  return null
})
function workflowProjectForRun(run = state.activeWorkflowRun || {}) {
  const runScope = run.demandScope || workflowForm.demandScope
  if (runScope !== 'project') return null
  const runProjectId = run.projectId || run.originProjectId || ''
  if (!runProjectId) return null
  return state.projects.find((project) => project.id === runProjectId) ||
    (runProjectId === state.currentProjectId ? currentProject.value : null) ||
    (run.documentAnalysis?.project?.id === runProjectId ? run.documentAnalysis.project : null) ||
    (run.project?.id === runProjectId ? run.project : null) ||
    null
}
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
  score += state.workflowRuns.filter((run) => run?.demandScope !== 'non-project' && run?.projectId === projectId).length * 100
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
    { label: '竞品分析', value: countByProject(state.competitors, projectId) },
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
  selectProjectBlueprintAsset(currentAssets.value, currentProject.value)
)
const currentProjectPrototypeAsset = computed(() =>
  selectProjectPrototypeDemoAsset(currentAssets.value, currentProject.value, currentProjectBlueprintAsset.value, 'prototype') ||
  selectBestPrototypeDemoAsset(currentAssets.value)
)
const currentProjectFlowPrototypeAsset = computed(() =>
  selectProjectPrototypeDemoAsset(currentAssets.value, currentProject.value, currentProjectBlueprintAsset.value, 'flow') ||
  selectCompletePrototypeFlowAsset(currentAssets.value)
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
const currentKnowledgeGovernanceSummary = computed(() =>
  buildKnowledgeGovernanceSummary(currentKnowledge.value)
)
const currentKnowledgeHubSection = computed(() =>
  currentKnowledgeHub.value.sections.find((section) => section.key === knowledgeHubSection.value) ||
  currentKnowledgeHub.value.sections[0]
)
const currentKnowledgeBlueprint = computed(() => currentProjectBlueprintAsset.value?.blueprint || null)
const currentKnowledgeDisplayBlueprint = computed(() =>
  enrichBlueprintWithPrototypeDemo(currentKnowledgeBlueprint.value || {}, currentProjectPrototypeAsset.value)
)
const latestKnowledgeMarkdownMaterial = computed(() =>
  currentKnowledge.value
    .filter((item) => item?.category === 'markdown-blueprint' && item.content)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null
)
const currentKnowledgeBlueprintWorkbench = computed(() => buildBlueprintWorkbench({
  blueprint: currentKnowledgeDisplayBlueprint.value || {},
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
const selectedKnowledgeNodeMissingSlots = computed(() =>
  (currentKnowledgeGovernanceSummary.value.missingSlots || []).slice(0, 5).map((slot) => ({
    slot,
    hint: knowledgeManualCompletionHint(slot)
  }))
)
const currentKnowledgeMarkdown = computed(() =>
  currentKnowledgeBlueprint.value
    ? exportBlueprintMarkdown(currentKnowledgeDisplayBlueprint.value)
    : latestKnowledgeMarkdownMaterial.value?.content || buildKnowledgeMaterialsMarkdown({
        projectName: displayProjectName(currentProject.value),
        materials: currentKnowledge.value
      })
)
const designRequirementBlueprintSource = computed(() =>
  activeProjectBlueprint.value || currentKnowledgeBlueprint.value || workflowAnalysisResult.value?.projectBlueprint || {}
)
const designRequirementDraft = computed(() =>
  buildDesignRequirementDocument({
    projectId: state.currentProjectId,
    blueprint: designRequirementBlueprintSource.value,
    knowledge: currentKnowledge.value,
    title: requirementConvertForm.title || `${designRequirementBlueprintSource.value?.title || '需求分析画布'} · 设计需求`,
    notes: requirementConvertForm.notes
  })
)
const baseKnowledgePrototypeDemo = computed(() =>
  buildPrototypeDemoAsset({
    blueprint: currentKnowledgeDisplayBlueprint.value || {},
    prototypeAsset: currentProjectPrototypeAsset.value,
    projectId: state.currentProjectId,
    assetId: currentProjectPrototypeAsset.value?.id || (currentProjectBlueprintAsset.value?.id ? `${currentProjectBlueprintAsset.value.id}-prototype-demo` : '')
  })
)
const baseKnowledgeFlowDemo = computed(() =>
  buildPrototypeDemoAsset({
    blueprint: currentKnowledgeDisplayBlueprint.value || {},
    prototypeAsset: currentProjectFlowPrototypeAsset.value || currentProjectPrototypeAsset.value,
    projectId: state.currentProjectId,
    assetId: currentProjectFlowPrototypeAsset.value?.id || currentProjectPrototypeAsset.value?.id || (currentProjectBlueprintAsset.value?.id ? `${currentProjectBlueprintAsset.value.id}-prototype-demo` : '')
  })
)
const currentKnowledgePrototypeDemo = computed(() =>
  enrichPrototypeDemoHotspots(baseKnowledgePrototypeDemo.value, [baseKnowledgeFlowDemo.value])
)
const currentKnowledgeFlowDemo = computed(() =>
  enrichPrototypeFlowScreenshots(baseKnowledgeFlowDemo.value, [currentKnowledgePrototypeDemo.value])
)
const knowledgePrototypeFlowTree = computed(() =>
  buildPrototypeFlowTree(currentKnowledgeFlowDemo.value)
)
const selectedKnowledgeFlow = computed(() =>
  knowledgePrototypeFlowTree.value.flows.find((flow) => flow.id === selectedKnowledgeFlowId.value) ||
  knowledgePrototypeFlowTree.value.selectedFlow ||
  null
)
const knowledgePrototypePages = computed(() => {
  const nodes = currentKnowledgeBlueprintWorkbench.value.nodes
  const flowSteps = (knowledgePrototypeFlowTree.value.flows || []).flatMap((flow) => flow.steps || [])
  const sourceScreens = currentKnowledgeFlowDemo.value.screens || []
  return sourceScreens.map((screen, index) => {
    const node = nodes.find((item) => item.page?.id === screen.id || item.id === screen.id || item.title === screen.title)
    const actions = screen.hotspots || []
    const step = flowSteps.find((item) => item.from === screen.id || item.to === screen.id)
    return {
      id: screen.id || `screen-${index}`,
      nodeId: node?.id || screen.id || `page-${index}`,
      title: screen.title || screen.pageName || `页面 ${index + 1}`,
      summary: screen.summary || '',
      screenshotUrl: screen.screenshotUrl || '',
      visualRect: normalizeVisualRect(actions[0]?.rect || screen.highlightRect || screen.rect, { x: 8, y: 12, width: 84, height: 64 }),
      components: screen.components || [],
      actions,
      flowActionLabel: step?.actionLabel || '',
      primaryAction: step?.actionLabel || actions[0]?.label || (screen.components || []).find((item) => /button|按钮|生成|保存|下一步/i.test(`${item.type} ${item.label}`))?.label || ''
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
  const rawRect = matchedComponent?.rect || matchedComponent?.bounds || matchedHotspot?.rect || node.component?.rect || node.page?.highlightRect
  const rect = rawRect ? normalizeVisualRect(rawRect) : null
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
      title: '竞品分析',
      empty: '当前项目还没有竞品记录。新建后可在竞品分析中发起分析。'
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
const workflowSkillOptions = computed(() => [
  { value: 'advanced-ux-requirement-analysis', label: '高级 UX 需求分析' }
])
const shouldShowWorkflowSkillSelector = computed(() => true)
const workflowInternalSkillOptions = computed(() => [
  { value: 'advanced-ux-requirement-analysis', label: '高级 UX 需求分析' }
])
const workflowSelectedSkillLabel = computed(() =>
  workflowSkillOptions.value.find((item) => item.value === workflowForm.selectedWorkflowId)?.label || '不选择 Skill'
)
const workflowSkillTransferOptions = computed(() =>
  workflowInternalSkillOptions.value
)
const workflowSkillTransferSelectedLabel = computed(() =>
  workflowSkillTransferOptions.value.find((item) => item.value === workflowSkillTransferForm.selectedSkillId)?.label || '高级 UX 需求分析'
)
const isUxConfirmationSkillSelected = computed(() => workflowForm.selectedWorkflowId === 'ux-design-confirmation-skill')
const isDialogueSkillSelected = computed(() => workflowForm.selectedWorkflowId === 'dialogue-skill')
const isInteractionDesignWorkflowSelected = computed(() => workflowForm.selectedWorkflowId === 'interaction-design-workflow')
function isTotalFlowLikeWorkflowId(workflowId = '') {
  return ['total-design-flow', 'advanced-ux-requirement-analysis'].includes(String(workflowId || '').trim())
}
const isTotalDesignFlowSelected = computed(() => workflowForm.selectedWorkflowId === 'total-design-flow')
const isAdvancedUxRequirementAnalysisSelected = computed(() => workflowForm.selectedWorkflowId === 'advanced-ux-requirement-analysis')
const workflowEntryCopy = computed(() => {
  if (isTotalDesignFlowSelected.value) {
    return {
      title: '今天要推进哪个',
      highlight: '设计方案',
      subtitle: '默认使用总流程：先做需求分析，再进入交互低保、UI视觉、HTML/Vue 和验收沉淀。'
    }
  }
  if (isAdvancedUxRequirementAnalysisSelected.value) {
    return {
      title: '今天要深挖哪个',
      highlight: 'UX 需求',
      subtitle: '复用总流程 6 阶段，但第一阶段按最新高级 UX 7 步完成原始需求分析、设计问题定义、用户与场景、整体交互链路、三套设计方案、异常流补充和推荐方案建议。'
    }
  }
  if (isUxConfirmationSkillSelected.value) {
    return {
      title: '今天要确认哪个',
      highlight: '设计方案',
      subtitle: '先让 Agent 和你逐步确认需求、竞品、策略和 UX 流程，确认后再转低保真画布。'
    }
  }
  if (isDialogueSkillSelected.value) {
    return {
      title: '今天要聊清楚哪个',
      highlight: '设计方案',
      subtitle: '先只打开 Agent 做纯模型对话分析，不先生成画布；聊清楚后再转页面串联画布。'
    }
  }
  if (isInteractionDesignWorkflowSelected.value) {
    return {
      title: '今天要生成哪个',
      highlight: '交互方案',
      subtitle: '直接根据输入生成页面级画布，每个画布节点对应一个页面和它的状态、操作、跳转关系。'
    }
  }
  return {
    title: '今天要分析哪份',
    highlight: '需求文档',
    subtitle: '把 PRD、调研记录或新增需求拖进输入框，点击分析文档后进入画布工作区。'
  }
})
const workflowPrimaryActionLabel = computed(() => '立即分析')
const workflowEmptyRecordCopy = computed(() => {
  if (isTotalDesignFlowSelected.value) return '输入需求后点击立即分析，系统会先需求分析并拆成小需求切片。'
  if (isUxConfirmationSkillSelected.value) return '输入需求后点击开始确认，Agent 会先逐步确认，不会直接生成固定画布。'
  if (isDialogueSkillSelected.value) return '输入需求后点击开始对话，Agent 会先持续对话，确认后再生成方案画布。'
  if (isInteractionDesignWorkflowSelected.value) return '输入需求后点击生成页面画布，系统会直接按页面拆分画布节点。'
  return '上传或输入需求文档后点击分析文档，生成的画布会保存在这里。'
})
const workflowRecordEmptyCopy = computed(() =>
  workflowRecordScopeTab.value === 'non-project'
    ? '非项目预研、资料分析和待立项判断会保存在这里，不进入当前项目知识库。'
    : workflowEmptyRecordCopy.value
)
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
      scopeId: workflowAgentScopeId(),
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
const visibleWorkflowAgentMessages = computed(() =>
  (Array.isArray(workflowAgentSession.value?.messages) ? workflowAgentSession.value.messages : [])
    .filter((message) => message && typeof message === 'object' && !Array.isArray(message))
    .filter((message) => String(message.content ?? '').trim())
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

function formatDialogueSkillFieldValue(value) {
  if (Array.isArray(value)) return value.join('、')
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}：${formatDialogueSkillFieldValue(item)}`).join('；')
  return String(value ?? '')
}

function dialogueSkillPageObjectToContent(page = {}, index = 0) {
  if (typeof page === 'string') {
    const title = page.trim() || `页面 ${index + 1}`
    return {
      title,
      content: [
        `## 页面：${title}`,
        `页面目标：${title} 的职责与用户任务`,
        '核心模块：信息、动作、反馈、状态',
        '主动作：完成当前页面的主要用户任务',
        '次动作：返回、筛选、查看详情或继续下一步',
        '状态与异常：空状态、加载中、失败重试、无权限或数据异常',
        '数据与接口：读取页面基础数据，提交关键用户操作',
        '验收点：页面目标清晰、主动作可达、异常状态完整'
      ].join('\n')
    }
  }
  if (!page || typeof page !== 'object') return null
  const title = String(page['页面'] || page.page || page.title || page.name || `页面 ${index + 1}`).trim()
  const lines = Object.entries(page)
    .filter(([key]) => !['页面', 'page', 'title', 'name'].includes(key))
    .map(([key, value]) => `${key}：${formatDialogueSkillFieldValue(value)}`)
    .filter(Boolean)
  return {
    title,
    content: [`## 页面：${title}`, ...lines].join('\n')
  }
}

function extractDialogueSkillJsonCanvasPages(content = '') {
  const text = String(content || '').trim()
  if (!text) return []
  let parsed = null
  if (/^[{\[]/.test(text)) {
    try {
      parsed = JSON.parse(text)
    } catch {}
  }
  if (parsed && typeof parsed === 'object') {
    const canvasPages = Array.isArray(parsed)
      ? parsed
      : parsed['页面串联画布内容'] || parsed.pages || parsed.pageCanvas || parsed.canvas || []
    if (Array.isArray(canvasPages) && canvasPages.length) {
      return canvasPages.map(dialogueSkillPageObjectToContent).filter(Boolean)
    }
    const routePages = !Array.isArray(parsed)
      ? parsed['主路径顺序'] || parsed.mainPath || parsed.path || parsed.flow || []
      : []
    if (Array.isArray(routePages) && routePages.length) {
      return routePages.map(dialogueSkillPageObjectToContent).filter(Boolean)
    }
  }
  const routeMatch = text.match(/["“]?主路径顺序["”]?\s*[:：]\s*\[([^\]]+)/)
  if (routeMatch) {
    const routePages = Array.from(routeMatch[1].matchAll(/["“]([^"”]+)["”]/g)).map((match) => match[1]).filter(Boolean)
    if (routePages.length) return routePages.map(dialogueSkillPageObjectToContent).filter(Boolean)
  }
  return []
}

function normalizeDialogueSkillReplyText(content = '') {
  const text = String(content || '').trim()
  if (!text || !/^[{\[]/.test(text)) return content
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const jsonPages = extractDialogueSkillJsonCanvasPages(text)
      if (jsonPages.length) return jsonPages.map((page) => page.content).join('\n\n')
      const canvasPages = parsed['页面串联画布内容'] || parsed.pages || parsed.pageCanvas || parsed.canvas || ''
      if (canvasPages) {
        if (Array.isArray(canvasPages)) {
          return canvasPages.map(dialogueSkillPageObjectToContent).filter(Boolean).map((page) => page.content).join('\n\n')
        }
        if (typeof canvasPages === 'object') return JSON.stringify(canvasPages, null, 2)
        return String(canvasPages)
      }
      return String(parsed.reply || parsed.content || parsed.message || parsed.answer || content)
    }
  } catch {}
  return content
}

function workflowAgentMessageText(message) {
  const content = String(message?.content ?? '')
  if (message?.role === 'assistant' && state.activeWorkflowRun?.skillId === 'dialogue-skill') {
    return normalizeWorkflowAgentReplyContent(normalizeDialogueSkillReplyText(content))
  }
  return message?.role === 'assistant' ? normalizeWorkflowAgentReplyContent(content) : content
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

function toggleWorkflowAgentWebSearch() {
  workflowAgentWebSearchEnabled.value = !workflowAgentWebSearchEnabled.value
}

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

function isDialogueSkillRecord(run = {}) {
  return run?.skillId === 'dialogue-skill' || run?.requestedSkillId === 'dialogue-skill' || run?.workflowId === 'dialogue-skill'
}

function workflowRecordBelongsToSelectedScope(run = {}) {
  if (workflowRecordScopeTab.value === 'non-project') return run?.demandScope === 'non-project'
  const runProjectId = run?.projectId || run?.originProjectId || ''
  return run?.demandScope !== 'non-project' && runProjectId === state.currentProjectId
}

const workflowAnalysisRecords = computed(() =>
  (state.workflowRuns || [])
    .filter((run) => workflowRecordBelongsToSelectedScope(run) && (isDialogueSkillRecord(run) || ((run.documentAnalysis?.canvas || run.hasDocumentAnalysisDetail) && (run.projectBlueprint || run.documentAnalysis || run.hasDocumentAnalysisDetail))))
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
)

function workflowRecordSummary(record = {}) {
  const summary = record.documentAnalysisSummary || {}
  const analysis = record.documentAnalysis || {}
  const canvas = analysis.canvas || {}
  const orderedTabs = Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
  const dialogueMessages = Array.isArray(record.agentSessions?.['dialogue-agent'])
    ? record.agentSessions['dialogue-agent']
    : []
  if (isDialogueSkillRecord(record) && !orderedTabs.length) {
    return {
      parsed: 0,
      nodeCount: dialogueMessages.filter((message) => ['user', 'assistant'].includes(message?.role)).length,
      qualityScore: null,
      tabPreview: [{ key: 'dialogue-agent', label: '对话记录' }]
    }
  }
  return {
    parsed: summary.parsed ?? analysis.summary?.parsed ?? 0,
    nodeCount: summary.nodeCount ?? (Array.isArray(canvas.nodes) ? canvas.nodes.length : 0),
    qualityScore: summary.qualityScore ?? analysis.qualityGate?.score ?? analysis.blueprint?.qualityGate?.score ?? null,
    tabPreview: Array.isArray(summary.tabPreview) && summary.tabPreview.length
      ? summary.tabPreview
      : orderedTabs.slice(0, 4)
  }
}

function workflowRecordSkillLabel(record = {}) {
  return record.displaySkillName ||
    record.documentAnalysis?.routing?.displaySkillName ||
    record.documentAnalysis?.displaySkillName ||
    record.resolvedSkillName ||
    record.workflowName ||
    '未选择 Skill'
}

function workflowRecordInputTitle(record = {}) {
  const inputLine = String(record.input || record.documentAnalysis?.input || '').trim().split('\n').find(Boolean)
  return inputLine || record.projectBlueprint?.title || '需求分析画布'
}

async function deleteWorkflowAnalysisRecord(record = {}) {
  if (!record?.id) return
  const confirmed = await confirmProjectAssetDelete({
    title: '删除分析记录',
    itemName: workflowRecordInputTitle(record),
    message: '删除后会从当前项目的设计方案/分析记录列表移除；如果正在查看这条记录，画布会返回入口页。'
  })
  if (!confirmed) return
  const result = await api.workspace.deleteWorkflowRun(state.apiConfig, record.id)
  const data = applyApiResult(skillWorkbenchStatus, result, '分析记录删除失败')
  if (!data) return
  state.workflowRuns = state.workflowRuns.filter((run) => run?.id !== record.id)
  if (state.activeWorkflowRun?.id === record.id) {
    state.activeWorkflowRun = null
    workflowAnalysisResult.value = null
    workflowCanvasLoading.value = false
    workflowAgentNodeId.value = ''
    workflowFullscreenNodeId.value = ''
    workflowFullscreenEditNodeId.value = ''
    returnToWorkflowEntry()
  }
  saveState(state)
  setStatus(skillWorkbenchStatus, 'success', '已删除分析记录')
}

function workflowCanvasTransferContext() {
  const run = state.activeWorkflowRun || {}
  const analysis = workflowAnalysisResult.value || run.documentAnalysis || {}
  const title = activeProjectBlueprint.value?.title || analysis.blueprint?.title || run.input || '当前需求分析画布'
  const aiSummary = analysis.aiSummary || {}
  const nodes = workflowCanvasNodes.value || []
  const nodeLines = nodes
    .filter((node) => node && !node.loading)
    .map((node, index) => {
      const content = [
        node.summary,
        ...(Array.isArray(node.content) ? node.content : []),
        ...(Array.isArray(node.detailSections)
          ? node.detailSections.flatMap((section) => [
              section?.title ? `【${section.title}】` : '',
              ...(Array.isArray(section?.items) ? section.items : [])
            ])
          : [])
      ].map((item) => String(item || '').trim()).filter(Boolean)
      return [
        `${index + 1}. ${node.title || node.id}`,
        ...content.map((item) => `- ${item}`)
      ].join('\n')
    })
  return [
    '上一份 Skill 画布完整内容如下，请把它作为新分析的输入材料。',
    '',
    `原分析记录 ID：${run.id || analysis.analysisRunId || analysis.requestId || '未知'}`,
    `原画布标题：${title}`,
    `原 Skill：${workflowCanvasSkillLabel.value || '未选择 Skill'}`,
    run.input ? `原始输入：${run.input}` : '',
    run.routingReason ? `原路由原因：${run.routingReason}` : '',
    '',
    aiSummary.summary ? `模型返回摘要：${aiSummary.summary}` : '',
    Array.isArray(aiSummary.items) && aiSummary.items.length ? `模型返回条目：${aiSummary.items.join('；')}` : '',
    Array.isArray(aiSummary.recommendedFlow) && aiSummary.recommendedFlow.length ? `推荐流程：${aiSummary.recommendedFlow.join(' -> ')}` : '',
    '',
    '当前画布节点完整内容：',
    nodeLines.join('\n\n') || '暂无可用节点，请根据原始输入重新分析。',
    '',
    '请不要沿用上一份 Skill 的输出限制；请按照本次用户选择的新 Skill 重新分析，并输出对应的新画布。'
  ].filter((line) => line !== '').join('\n')
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
    summary: '正在提交需求，收到后端响应后会切换为真实分析进度。',
    content: [
      workflowLoadingCopy[index % workflowLoadingCopy.length],
      index < 3 ? '准备输入内容...' : index < 7 ? '等待后端接收...' : '等待模型任务开始...'
    ],
    x: 80 + index * 360,
    y: index % 2 === 0 ? 140 : 360,
    width: tab.key === 'analysis' ? 360 : 320,
    height: tab.key === 'analysis' ? 240 : 220,
    loading: true,
    agentScope: `当前正在生成「${tab.label}」。`,
    quickActions: ['等待生成'],
    detailSections: [
      { title: '当前状态', items: ['正在提交需求并等待后端返回真实节点详情。'] },
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
const workflowCurrentStageId = computed(() => {
  const validStageIds = workflowStageIdsFromTotalFlow(workflowTotalDesignFlow.value)
  const backendCurrentStageId = normalizeWorkflowStageId(workflowTotalDesignFlow.value?.currentStage || '')
  if (!workflowActiveStageTouchedByUser.value && validStageIds.includes(backendCurrentStageId)) return backendCurrentStageId
  if (validStageIds.includes(workflowActiveStageId.value)) return workflowActiveStageId.value
  if (validStageIds.includes(backendCurrentStageId)) return backendCurrentStageId
  return validStageIds[0] || ''
})
const workflowUsesStageAgentScope = computed(() =>
  activeView.value === 'workflow' &&
  workflowRoute.value === 'canvas' &&
  isWorkflowAgentStageSessionScopeId(workflowCurrentStageId.value)
)
const workflowUsesEmbeddedAgent = computed(() => false)
const workflowAgentCanUseLargeModes = computed(() => false)
const workflowCanUseInlineAgent = computed(() => false)
const workflowAgentShellVisible = computed(() =>
  activeView.value === 'workflow' &&
  workflowAgentSession.value &&
  workflowAgentDisplayMode.value !== 'hidden'
)
const workflowCanMoveToNextStage = computed(() => {
  const stageIds = workflowStageIdsFromTotalFlow(workflowTotalDesignFlow.value)
  const index = stageIds.indexOf(workflowCurrentStageId.value)
  return index >= 0 && index < stageIds.length - 1
})
const workflowStageCanvas = computed(() =>
  workflowTotalDesignFlow.value?.stageCanvases?.[workflowCurrentStageId.value] || null
)
const workflowStagePlaceholderCanvas = computed(() => {
  return workflowStagePlaceholderCanvasForStage(workflowCurrentStageId.value)
})
function workflowIsAdvancedUxTotalFlow(totalFlow = null) {
  const analysis = workflowAnalysisResult.value || {}
  const run = state.activeWorkflowRun || {}
  const identifiers = [
    run.workflowId,
    run.skillId,
    run.requestedSkillId,
    run.resolvedSkillId,
    analysis.skillId,
    analysis.requestedSkillId,
    analysis.resolvedSkillId,
    totalFlow?.skillId,
    totalFlow?.requestedSkillId,
    totalFlow?.resolvedSkillId
  ].map((value) => String(value || '').trim())
  if (identifiers.includes('advanced-ux-requirement-analysis')) return true
  return Boolean(
    analysis.advancedUxReport?.markdown ||
    totalFlow?.advancedUxReport?.markdown ||
    /高级\s*UX\s*需求分析/i.test(`${run.workflowName || ''} ${run.assetType || ''} ${analysis.displaySkillName || ''}`)
  )
}
function workflowAdvancedUxPageInteractionDocument(totalFlow = null) {
  const analysis = workflowAnalysisResult.value || {}
  return [
    totalFlow?.advancedUxReport?.pageInteractionDocument,
    totalFlow?.pageInteractionDocumentArtifact,
    totalFlow?.advancedUxReport?.pageInteractionDocumentArtifact,
    analysis.advancedUxReport?.pageInteractionDocument,
    analysis.pageInteractionDocumentArtifact
  ].find((document) => String(document?.markdown || '').trim()) || null
}
function workflowAdvancedUxPageInteractionDocumentFailure(totalFlow = null) {
  const analysis = workflowAnalysisResult.value || {}
  return [
    totalFlow?.advancedUxReport?.pageInteractionDocument,
    totalFlow?.pageInteractionDocumentArtifact,
    totalFlow?.advancedUxReport?.pageInteractionDocumentArtifact,
    analysis.advancedUxReport?.pageInteractionDocument,
    analysis.pageInteractionDocumentArtifact
  ].find((document) =>
    ['failed', 'quality_failed', 'import_failed'].includes(String(document?.status || '').trim()) ||
    String(document?.importError || '').trim()
  ) || null
}
function shouldUseAdvancedUxPendingStageCanvas(stageId = '', totalFlow = null) {
  stageId = normalizeWorkflowStageId(stageId)
  if (stageId !== 'interaction-lofi') return false
  if (!workflowIsAdvancedUxTotalFlow(totalFlow)) return false
  if (workflowAdvancedUxPageInteractionDocument(totalFlow)) return false
  if (workflowAdvancedUxPageInteractionDocumentFailure(totalFlow)) return false
  const runtimeState = String(totalFlow?.stageRuntime?.[stageId]?.state || '').trim()
  const stageStatus = String(workflowStageStatusMap.value?.[stageId]?.status || totalFlow?.stageStatuses?.[stageId]?.status || '').trim()
  if (runtimeState === 'paused' || stageStatus === 'paused') return false
  return runtimeState === 'generating' || stageStatus === 'generating'
}
function shouldResumeAdvancedUxPendingStageGeneration(stageId = '', totalFlow = null) {
  stageId = normalizeWorkflowStageId(stageId)
  totalFlow = totalFlow || workflowAnalysisResult.value?.totalDesignFlow || null
  if (workflowAnalysisStreamController.value) return false
  if (workflowCanvasLoading.value) return false
  if (!shouldUseAdvancedUxPendingStageCanvas(stageId, totalFlow)) return false
  const stageStatus = String(workflowStageStatusMap.value?.[stageId]?.status || totalFlow?.stageStatuses?.[stageId]?.status || '').trim()
  return stageStatus === 'generating' && !workflowAdvancedUxPageInteractionDocument(totalFlow)
}
function workflowAdvancedUxPendingStageCanvasForStage(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  const stage = (Array.isArray(workflowTotalDesignFlow.value?.stages) ? workflowTotalDesignFlow.value.stages : [])
    .find((item) => item?.id === normalizedStageId) || {}
  const stageName = stage.name || (normalizedStageId === 'interaction-lofi' ? '交互低保' : '当前阶段')
  const summary = normalizedStageId === 'interaction-lofi'
    ? '正在生成页面交互框架与说明 Markdown'
    : `正在生成「${stageName}」阶段产物`
  const nodeId = `advanced-ux-${normalizedStageId || 'stage'}-generating`
  return {
    title: stageName,
    summary,
    canvasType: 'advanced-ux-stage-generating',
    layoutRule: 'single-loading',
    nodes: [{
      id: nodeId,
      stageId: normalizedStageId,
      title: stageName,
      summary,
      content: [
        summary,
        '完成后会自动替换为该阶段的真实产物。'
      ],
      x: 120,
      y: 140,
      width: 360,
      height: 220,
      loading: true,
      artifactStatus: 'generating',
      contentStatus: 'model-pending',
      contentSource: 'model-pending',
      quickActions: ['等待生成']
    }],
    edges: [],
    orderedTabs: [{ key: nodeId, label: stageName }]
  }
}
function workflowStagePlaceholderCanvasForStage(stageId = '') {
  const totalFlow = workflowTotalDesignFlow.value
  if (!totalFlow || !stageId) return null
  const stage = (Array.isArray(totalFlow.stages) ? totalFlow.stages : []).find((item) => item?.id === stageId) || {}
  const stageName = stage.name || '当前阶段'
  return {
    nodes: [{
      id: `${stageId}-loading`,
      stageId,
      title: stageName,
      summary: `正在生成「${stageName}」阶段画布，完成后会自动替换为该阶段的真实节点。`,
      agentWorkbench: isWorkflowAgentWorkbenchStageId(stageId),
      x: 96,
      y: 132,
      width: 360,
      height: 220,
      loading: true,
      content: [
        `正在生成「${stageName}」...`,
        '阶段完成后可点击顶部已加载步骤回看。',
        '点击暂停会暂停当前阶段及后续阶段。'
      ],
      agentScope: `查看「${stageName}」阶段生成状态。`,
      quickActions: ['等待生成'],
      detailSections: [
        { title: '当前状态', items: [`${stageName} 阶段正在等待大模型返回画布节点。`] },
        { title: '下一步', items: ['返回后会展示该阶段独立的小需求、画布节点和详情内容。'] }
      ]
    }],
    edges: [],
    orderedTabs: [{ key: `${stageId}-loading`, label: stageName }]
  }
}

function workflowStagePausedCanvasForStage(stageId = '', existingCanvas = null) {
  stageId = normalizeWorkflowStageId(stageId)
  const totalFlow = workflowTotalDesignFlow.value
  const stage = (Array.isArray(totalFlow?.stages) ? totalFlow.stages : []).find((item) => item?.id === stageId) || {}
  const stageName = stage.name || (stageId === 'interaction-lofi' ? '交互低保' : '当前阶段')
  const summary = `${stageName}已停止生成`
  const pausedContent = [
    summary,
    '本次生成已停止，迟到回复不会写入当前会话。',
    '可点击重新生成该阶段，或回到上一阶段点击“下一步”重新输出。'
  ]
  const pauseNode = (node = {}, index = 0) => ({
    ...node,
    id: node.id || `${stageId || 'stage'}-paused-${index + 1}`,
    stageId: node.stageId || stageId,
    title: node.title || stageName,
    summary,
    content: pausedContent,
    loading: false,
    contentLoading: false,
    refreshing: false,
    artifactStatus: 'paused',
    contentStatus: 'paused',
    contentSource: 'user-stopped',
    quickActions: ['重新生成该阶段']
  })
  const existingNodes = Array.isArray(existingCanvas?.nodes) ? existingCanvas.nodes : []
  const nodes = existingNodes.length
    ? existingNodes.map((node, index) => pauseNode(node, index))
    : [pauseNode({
        id: `${stageId || 'stage'}-paused`,
        x: 120,
        y: 140,
        width: 360,
        height: 220
      })]
  return {
    ...(existingCanvas || {}),
    title: stageName,
    summary,
    canvasType: existingCanvas?.canvasType === 'advanced-ux-stage-generating'
      ? 'advanced-ux-stage-paused'
      : (existingCanvas?.canvasType || 'workflow-stage-paused'),
    layoutRule: existingCanvas?.layoutRule || 'single-paused',
    status: 'paused',
    nodes,
    edges: Array.isArray(existingCanvas?.edges) ? existingCanvas.edges : [],
    orderedTabs: Array.isArray(existingCanvas?.orderedTabs) && existingCanvas.orderedTabs.length
      ? existingCanvas.orderedTabs
      : [{ key: nodes[0]?.id || `${stageId}-paused`, label: stageName }]
  }
}
const workflowCanvas = computed(() => {
  const canvas = workflowUnifiedTotalFlowCanvas(workflowTotalDesignFlow.value) ||
    workflowAnalysisResult.value?.canvas ||
    (workflowCanvasLoading.value ? workflowLoadingCanvas.value : { nodes: [], edges: [], orderedTabs: [] })
  const displayCanvas = canvas
  return {
    ...displayCanvas,
    nodes: workflowCanvasRefreshingNodes(displayCanvas.nodes)
  }
})
const workflowTotalDesignFlow = computed(() => workflowAnalysisResult.value?.totalDesignFlow || null)

function workflowCanvasRefreshingNodes(nodes = []) {
  if (!workflowCanvasLoading.value || !workflowCanvasRefreshingNodeId.value || !Array.isArray(nodes) || !nodes.length) return nodes
  const startIndex = nodes.findIndex((node) => node.id === workflowCanvasRefreshingNodeId.value)
  if (startIndex < 0) return nodes
  const layoutLabel = workflowCanvasRefreshingLayoutLabel.value
  return nodes.map((node, index) => index !== startIndex ? node : {
    ...node,
    loading: true,
    contentLoading: true,
    refreshing: true,
    content: [
      layoutLabel ? `正在应用「${layoutLabel}」并刷新当前页面...` : '正在合并你确认的内容...',
      '后端会重新计算画布节点、路径和质量检查。'
    ]
  })
}
// The UI renders one total-flow canvas; per-stage canvases remain source artifacts only.
function workflowUnifiedTotalFlowCanvas(totalFlow = null) {
  const normalizedTotalFlow = normalizeWorkflowTotalFlowMeta(totalFlow)
  if (!normalizedTotalFlow) return null
  const stageIds = workflowStageIdsFromTotalFlow(normalizedTotalFlow)
  const stageNodesById = new Map()
  const sourceNodeIdMap = new Map()
  const usedNodeIds = new Set()
  const unifiedNodes = []
  const unifiedEdges = []
  const orderedTabs = []

  stageIds.forEach((stageId, stageIndex) => {
    const stage = normalizedTotalFlow.stages.find((item) => item.id === stageId) || {}
    const sourceCanvas = shouldUseAdvancedUxPendingStageCanvas(stageId, normalizedTotalFlow)
      ? workflowAdvancedUxPendingStageCanvasForStage(stageId)
      : normalizedTotalFlow.stageCanvases?.[stageId] || (isWorkflowAgentWorkbenchStageId(stageId) ? workflowStagePlaceholderCanvasForStage(stageId) : null)
    const stageCanvas = isWorkflowAgentWorkbenchStageId(stageId)
      ? workflowAgentWorkbenchStageCanvas(stageId, sourceCanvas)
      : sourceCanvas
    const sourceNodes = Array.isArray(stageCanvas?.nodes) && stageCanvas.nodes.length
      ? stageCanvas.nodes
      : [{
        id: `${stageId}-placeholder`,
        stageId,
        title: stage.name || '当前阶段',
        summary: `${stage.name || '当前阶段'}正在等待生成结果。`,
        content: ['该阶段完成后会出现在同一张总流程画布中。'],
        loading: true
      }]
    const stageOffsetX = 96
    const stageOffsetY = 120 + stageIndex * 320
    const stageNodes = sourceNodes.map((node, nodeIndex) => {
      const sourceNodeId = String(node?.id || `${stageId}-${nodeIndex + 1}`).trim()
      const nodeId = usedNodeIds.has(sourceNodeId) ? `${stageId}-${sourceNodeId}` : sourceNodeId
      usedNodeIds.add(nodeId)
      sourceNodeIdMap.set(`${stageId}:${sourceNodeId}`, nodeId)
      const nextNode = {
        ...node,
        id: nodeId,
        stageId: node.stageId || stageId,
        groupName: node.groupName || stage.name || node.groupName,
        x: Number.isFinite(Number(node.x)) ? Number(node.x) + stageOffsetX : 96 + nodeIndex * 380,
        y: Number.isFinite(Number(node.y)) ? Number(node.y) + stageOffsetY : stageOffsetY,
        width: node.width || 340,
        height: node.height || 220
      }
      unifiedNodes.push(nextNode)
      orderedTabs.push({ key: nodeId, label: nextNode.title || stage.name || nodeId })
      return nextNode
    })
    stageNodesById.set(stageId, stageNodes)
    ;(Array.isArray(stageCanvas?.edges) ? stageCanvas.edges : []).forEach((edge, edgeIndex) => {
      const from = sourceNodeIdMap.get(`${stageId}:${edge.from}`) || edge.from
      const to = sourceNodeIdMap.get(`${stageId}:${edge.to}`) || edge.to
      unifiedEdges.push({
        ...edge,
        id: edge.id || `${stageId}-edge-${edgeIndex + 1}`,
        from,
        to
      })
    })
  })

  stageIds.slice(0, -1).forEach((stageId, index) => {
    const fromNode = stageNodesById.get(stageId)?.at(-1)
    const toNode = stageNodesById.get(stageIds[index + 1])?.[0]
    if (!fromNode?.id || !toNode?.id) return
    unifiedEdges.push({
      id: `${stageId}-to-${stageIds[index + 1]}`,
      from: fromNode.id,
      to: toNode.id,
      label: '下一阶段'
    })
  })

  return {
    ...normalizedTotalFlow,
    mode: 'total-flow-unified-canvas',
    nodes: uniqueWorkflowCanvasNodes(unifiedNodes),
    edges: unifiedEdges,
    orderedTabs
  }
}
const workflowStageTotalDesignFlow = computed(() => {
  const totalFlow = workflowTotalDesignFlow.value
  if (!totalFlow) return null
  const normalizedTotalFlow = normalizeWorkflowTotalFlowMeta(totalFlow)
  if (!normalizedTotalFlow) return null
  const stageId = workflowCurrentStageId.value
  const sourceStageCanvas = shouldUseAdvancedUxPendingStageCanvas(stageId, normalizedTotalFlow)
    ? workflowAdvancedUxPendingStageCanvasForStage(stageId)
    : normalizedTotalFlow.stageCanvases?.[stageId] || workflowStagePlaceholderCanvas.value
  const stageCanvasForTotalFlow = isWorkflowAgentWorkbenchStageId(stageId)
    ? workflowAgentWorkbenchStageCanvas(stageId, sourceStageCanvas)
    : sourceStageCanvas
  const refreshedStageCanvasForTotalFlow = stageCanvasForTotalFlow
    ? {
        ...stageCanvasForTotalFlow,
        nodes: workflowCanvasRefreshingNodes(stageCanvasForTotalFlow.nodes)
      }
    : stageCanvasForTotalFlow
  const stageSlices = normalizedTotalFlow.stageSlices?.[workflowCurrentStageId.value] || normalizedTotalFlow.requirementSlices || []
  const stagePages = normalizedTotalFlow.stagePages?.[workflowCurrentStageId.value] || normalizedTotalFlow.pages || []
  const persistedSliceId = normalizedTotalFlow.activeSliceId
  return {
    ...normalizedTotalFlow,
    currentStage: stageId,
    stageCanvases: {
      ...normalizedTotalFlow.stageCanvases,
      [stageId]: refreshedStageCanvasForTotalFlow
    },
    requirementSlices: stageSlices,
    activeSliceId: stageSlices.some((slice) => slice.id === persistedSliceId) ? persistedSliceId : stageSlices[0]?.id || '',
    pages: stagePages,
    edges: workflowStageCanvas.value?.edges || normalizedTotalFlow.edges || []
  }
})
const workflowCanvasNodes = computed(() =>
  uniqueWorkflowCanvasNodes(Array.isArray(workflowCanvas.value?.nodes) ? workflowCanvas.value.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
    .map((node) => ({
      ...node,
      width: node.width || 320,
      height: node.height || 220
    }))
)
const workflowCurrentCanvasNodes = computed(() => {
  const stageNodes = workflowStageTotalDesignFlow.value?.stageCanvases?.[workflowCurrentStageId.value]?.nodes
  const nodes = Array.isArray(stageNodes) && stageNodes.length ? stageNodes : workflowCanvasNodes.value
  return workflowCanvasRefreshingNodes(uniqueWorkflowCanvasNodes(nodes))
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
    .map((node) => ({
      ...node,
      width: node.width || 320,
      height: node.height || 220
    }))
})
const workflowAgentCanvasTabs = computed(() =>
  workflowCurrentCanvasNodes.value
    .filter((node) => node?.id)
    .map((node) => ({
      key: node.id,
      id: node.id,
      label: node.title || node.id,
      title: node.title || node.id
    }))
)
const workflowCanvasEdges = computed(() => workflowCanvas.value.edges || [])

function uniqueWorkflowCanvasNodes(nodes = []) {
  const seen = new Set()
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node) && node.id)
    .filter((node) => {
      if (seen.has(node.id)) return false
      seen.add(node.id)
      return true
    })
}

const ADVANCED_UX_FAILED_ANALYSIS_TABS = [
  { id: 'ux-original-requirement-analysis', title: '原始需求分析' },
  { id: 'ux-design-problem-definition', title: '设计问题定义' },
  { id: 'ux-user-scenario', title: '用户与场景' },
  { id: 'ux-interaction-chain', title: '整体交互链路' },
  { id: 'ux-three-design-solutions', title: '三套设计方案' },
  { id: 'ux-exception-flow', title: '异常流补充' },
  { id: 'ux-recommendation-decision', title: '推荐方案建议' }
]

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

function workflowAdvancedUxFailedReportMessage(run = {}) {
  const sessions = Object.values(run?.agentSessions || {})
  return sessions.flatMap((session) => Array.isArray(session) ? session : []).find((message) => {
    const meta = message?.meta || {}
    const statusText = [meta.status, meta.reportStatus, message?.status].map((item) => String(item || '').trim()).join(' ')
    return message?.role === 'assistant' &&
      meta.action === 'advanced-ux-markdown-report' &&
      /failed|quality_failed|import_failed/i.test(statusText)
  }) || null
}

function workflowAdvancedUxFailureReason(run = {}) {
  const analysis = run?.documentAnalysis || {}
  const report = workflowAdvancedUxReportCandidateFromAnalysis(analysis) || {}
  const reportStatus = String(report.status || report.reportStatus || '').trim()
  const reportFailed = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
  if (reportFailed) {
    const issueText = Array.isArray(report.qualityIssues)
      ? report.qualityIssues.map((issue) => typeof issue === 'string' ? issue : issue?.message || issue?.title || '').filter(Boolean).join('；')
      : ''
    return sanitizeAdvancedUxFailureReason(report.importError || issueText || '高级 UX Markdown 未通过输出规范。')
  }
  const failedMessage = workflowAdvancedUxFailedReportMessage(run)
  if (failedMessage) return sanitizeAdvancedUxFailureReason(failedMessage.content || failedMessage.meta?.importError || '高级 UX Markdown 未生成成功。')
  if (isAdvancedUxWorkflowRun(run) && String(run.status || '').trim() === 'failed') {
    return sanitizeAdvancedUxFailureReason(run.error || run.message || '高级 UX Markdown 未生成成功。')
  }
  return ''
}

function workflowAdvancedUxHasReviewableMarkdownFailure(run = {}) {
  const analysis = run?.documentAnalysis || {}
  const report = workflowAdvancedUxReportCandidateFromAnalysis(analysis) || {}
  const hasMarkdown = Boolean(String(report.markdown || '').trim())
  const hasReportSections = Array.isArray(report.sections) && report.sections.length > 0
  const stageNodes = analysis.totalDesignFlow?.stageCanvases?.['requirement-dissection']?.nodes || []
  const hasParsedNodeDetails = Array.isArray(stageNodes) && stageNodes.some((node) =>
    Array.isArray(node?.detailBlocks) && node.detailBlocks.length > 0
  )
  return hasMarkdown || hasReportSections || hasParsedNodeDetails
}

function buildAdvancedUxFailedAnalysisResult(run = {}) {
  if (!isAdvancedUxWorkflowRun(run)) return null
  if (workflowAdvancedUxHasReviewableMarkdownFailure(run)) return null
  const failureReason = workflowAdvancedUxFailureReason(run)
  if (!failureReason) return null
  const fileName = workflowAdvancedUxReportCandidateFromAnalysis(run?.documentAnalysis || {})?.fileName || '高级 UX 需求分析.md'
  const nodes = ADVANCED_UX_FAILED_ANALYSIS_TABS.map((tab, index) => ({
    id: tab.id,
    requirementPipelineTabId: tab.id,
    title: tab.title,
    summary: '未生成可导入内容',
    content: [
      `高级 UX Markdown 未生成或未通过门禁：${fileName}`,
      '该节点暂无可展示章节内容，请查看 Agent 文件卡中的门禁失败原因。'
    ],
    detailSections: [
      { title: '当前状态', items: ['未导入需求分析画布。'] },
      { title: '失败原因', items: [failureReason] }
    ],
    detailBlocks: [],
    sections: [],
    markdown: '',
    x: 80 + index * 320,
    y: 120,
    width: 320,
    height: 220,
    loading: false,
    artifactStatus: 'failed',
    generationPlaceholderStatus: 'failed',
    contentStatus: 'failed',
    contentSource: 'backend-status',
    quickActions: ['重新分析']
  }))
  const failedCanvas = {
    title: '高级 UX 需求分析',
    summary: failureReason,
    canvasType: 'advanced-ux-requirement-analysis-failed',
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-to-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一节点'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
  const failedReport = {
    ...(workflowAdvancedUxReportCandidateFromAnalysis(run?.documentAnalysis || {}) || {}),
    status: 'failed',
    fileName,
    importError: failureReason,
    markdown: workflowAdvancedUxReportCandidateFromAnalysis(run?.documentAnalysis || {})?.markdown || ''
  }
  return {
    status: 'failed',
    requestedSkillId: run.requestedSkillId || 'advanced-ux-requirement-analysis',
    resolvedSkillId: run.resolvedSkillId || run.skillId || 'advanced-ux-requirement-analysis',
    skillId: run.skillId || 'advanced-ux-requirement-analysis',
    input: run.input || '',
    advancedUxReport: failedReport,
    totalDesignFlow: {
      mode: 'total-design-flow',
      type: 'total-design-flow',
      skillId: 'advanced-ux-requirement-analysis',
      currentStage: 'requirement-dissection',
      advancedUxReport: failedReport,
      stages: [
        { id: 'requirement-dissection', name: '需求分析' },
        { id: 'interaction-lofi', name: '交互低保' },
        { id: 'ui-visual', name: 'UI视觉' },
        { id: 'html-output', name: 'HTML' },
        { id: 'vue-output', name: 'Vue' },
        { id: 'acceptance-deposit', name: '验收沉淀' }
      ],
      stageCanvases: {
        'requirement-dissection': {
          ...failedCanvas,
          stageId: 'requirement-dissection',
          nodes,
          edges: failedCanvas.edges,
          orderedTabs: failedCanvas.orderedTabs
        }
      },
      stageStatuses: {
        'requirement-dissection': {
          status: 'failed',
          label: '生成失败',
          message: failureReason
        }
      }
    },
    canvas: failedCanvas
  }
}

function buildWorkflowAnalysisProgressResult(run = {}, meta = {}) {
  const loadingCanvas = workflowLoadingCanvas.value
  const metaCanvas = meta.canvas || {}
  const metaNodes = uniqueWorkflowCanvasNodes(metaCanvas.nodes)
  const isBackendProgressCanvas = Boolean(metaNodes.length || Array.isArray(metaCanvas.orderedTabs))
  const orderedTabs = Array.isArray(metaCanvas.orderedTabs) && metaCanvas.orderedTabs.length
    ? metaCanvas.orderedTabs
    : (isBackendProgressCanvas ? metaNodes.map((node) => ({ key: node.id, label: node.title || node.id })) : loadingCanvas.orderedTabs)
  const edges = Array.isArray(metaCanvas.edges) && metaCanvas.edges.length
    ? metaCanvas.edges
    : (isBackendProgressCanvas ? [] : loadingCanvas.edges)
  const placeholderById = new Map((loadingCanvas.nodes || []).map((node) => [node.id, node]))
  const nodes = orderedTabs.map((tab, index) => {
    const fallbackByIndex = loadingCanvas.nodes[index] || {}
    const existing = metaNodes.find((node) => node.id === tab.key) ||
      (!isBackendProgressCanvas ? placeholderById.get(tab.key) : null) ||
      (fallbackByIndex.id === tab.key ? fallbackByIndex : {})
    return {
      ...existing,
      id: existing.id || tab.key || `node-${index + 1}`,
      title: existing.title || tab.label || tab.key || `节点 ${index + 1}`,
      summary: existing.summary || metaCanvas.summary || '正在等待后端返回实时输出。',
      content: Array.isArray(existing.content) && existing.content.length
        ? existing.content
        : [
            '正在解析输入和上传文档...',
            '正在连接后端模型服务...',
            '模型开始输出后会在这里实时显示片段。'
          ],
      loading: existing.loading !== false
    }
  })
  const normalizedNodes = uniqueWorkflowCanvasNodes(nodes.length ? nodes : metaNodes)
  return {
    status: 'streaming',
    summary: { parsed: 0, total: workflowForm.documents.length || 0 },
    requestedSkillId: run.requestedSkillId || workflowForm.selectedWorkflowId,
    resolvedSkillId: run.resolvedSkillId || (workflowForm.selectedWorkflowId === 'auto' ? '' : workflowForm.selectedWorkflowId),
    skillId: run.skillId || workflowForm.selectedWorkflowId,
    routing: meta.routing || {},
    input: meta.input || run.input || workflowForm.input || '',
    totalDesignFlow: normalizeWorkflowTotalFlowMeta(meta.totalDesignFlow || meta.totalFlowMeta) || run.documentAnalysis?.totalDesignFlow || null,
    canvas: {
      ...loadingCanvas,
      ...metaCanvas,
      nodes: normalizedNodes,
      edges,
      orderedTabs
    }
  }
}

function mergeWorkflowAnalysisStreamNode(currentAnalysis = {}, payload = {}) {
  const node = payload.node
  if (!node?.id) return currentAnalysis
  const canvas = currentAnalysis.canvas || workflowLoadingCanvas.value
  const nodes = uniqueWorkflowCanvasNodes(Array.isArray(canvas.nodes) && canvas.nodes.length ? canvas.nodes : workflowLoadingCanvas.value.nodes)
  const index = Number.isFinite(Number(payload.index)) ? Number(payload.index) : nodes.findIndex((item) => item.id === node.id)
  let replaced = false
  const nextNodes = nodes.map((item, itemIndex) => {
    const sameId = item.id === node.id
    const sameIndex = !sameId && node.id !== 'model-generating' && index >= 0 && itemIndex === index
    if (!sameId && !sameIndex) return item
    replaced = true
    return {
      ...item,
      ...node,
      id: node.id || item.id,
      loading: node.loading === false ? false : Boolean(node.loading ?? item.loading)
    }
  })
  if (!replaced) nextNodes.push({ ...node, loading: node.loading === false ? false : Boolean(node.loading) })
  const normalizedNodes = uniqueWorkflowCanvasNodes(nextNodes)
  return {
    ...currentAnalysis,
    status: currentAnalysis.status || 'streaming',
    totalDesignFlow: currentAnalysis.totalDesignFlow || null,
    canvas: {
      ...canvas,
      nodes: normalizedNodes,
      orderedTabs: Array.isArray(canvas.orderedTabs) && canvas.orderedTabs.length
        ? canvas.orderedTabs
        : normalizedNodes.map((item) => ({ key: item.id, label: item.title || item.id }))
    }
  }
}

function mergeWorkflowAnalysisModelDelta(currentAnalysis = {}, payload = {}) {
  const text = String(payload.text || payload.delta || '').trim()
  if (!text) return currentAnalysis
  const nodeId = payload.nodeId || 'model-generating'
  const canvas = currentAnalysis.canvas || workflowLoadingCanvas.value
  const nodes = uniqueWorkflowCanvasNodes(Array.isArray(canvas.nodes) && canvas.nodes.length ? canvas.nodes : workflowLoadingCanvas.value.nodes)
  const preview = text.length > 1200 ? `...${text.slice(-1200)}` : text
  let replaced = false
  const nextNodes = nodes.map((item) => {
    if (item.id !== nodeId) return item
    replaced = true
    return {
      ...item,
      title: item.title || '模型分析中',
      summary: '模型正在输出内容，完成后会自动整理成画布节点。',
      content: preview.split(/\n+/).filter(Boolean).slice(-8),
      loading: true
    }
  })
  if (!replaced) {
    nextNodes.push({
      id: nodeId,
      title: '模型分析中',
      summary: '模型正在输出内容，完成后会自动整理成画布节点。',
      content: preview.split(/\n+/).filter(Boolean).slice(-8),
      x: 80,
      y: 140,
      width: 420,
      height: 260,
      loading: true
    })
  }
  return {
    ...currentAnalysis,
    status: 'streaming',
    canvas: {
      ...canvas,
      nodes: uniqueWorkflowCanvasNodes(nextNodes),
      orderedTabs: Array.isArray(canvas.orderedTabs) && canvas.orderedTabs.length
        ? canvas.orderedTabs
        : uniqueWorkflowCanvasNodes(nextNodes).map((item) => ({ key: item.id, label: item.title || item.id }))
    }
  }
}

function workflowStageIdsFromTotalFlow(totalFlow = null) {
  const stages = Array.isArray(totalFlow?.stages) ? totalFlow.stages : []
  return normalizeWorkflowTotalFlowStages(Array.isArray(stages) && stages.length ? stages : WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES).map((stage) => stage?.id).filter(Boolean)
}

function inferWorkflowTotalFlowFromAnalysis(analysis = {}) {
  if (!analysis || typeof analysis !== 'object') return null
  const hasTotalFlowSignal =
    isTotalFlowLikeWorkflowId(analysis.skillId) ||
    isTotalFlowLikeWorkflowId(analysis.requestedSkillId) ||
    isTotalFlowLikeWorkflowId(analysis.resolvedSkillId) ||
    isTotalFlowLikeWorkflowId(analysis.routing?.skillId) ||
    analysis.routing?.displaySkillName === '总流程' ||
    analysis.routing?.displaySkillName === '高级 UX 需求分析' ||
    analysis.displaySkillName === '高级 UX 需求分析' ||
    analysis.displaySkillName === '总流程'
  if (!hasTotalFlowSignal) return null
  return {
    mode: 'total-design-flow',
    type: 'total-design-flow',
    currentStage: WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES[0]?.id || '',
    stages: WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES,
    requirementSlices: [],
    pages: [],
    stageCanvases: {},
    stageStatuses: {}
  }
}

function normalizeWorkflowAnalysisForDisplay(analysis = null) {
  if (!analysis || typeof analysis !== 'object') return analysis
  return {
    ...analysis,
    totalDesignFlow: normalizeWorkflowTotalFlowMeta(analysis.totalDesignFlow || inferWorkflowTotalFlowFromAnalysis(analysis))
  }
}

function buildWorkflowStageStatuses(totalFlow = null, fallbackStatus = 'waiting') {
  return Object.fromEntries(workflowStageIdsFromTotalFlow(totalFlow).map((stageId) => [
    stageId,
    {
      status: fallbackStatus,
      updatedAt: ''
    }
  ]))
}

function workflowStageCanvasHasGeneratedContent(stageCanvas = null, stageId = '') {
  const nodes = Array.isArray(stageCanvas?.nodes) ? stageCanvas.nodes : []
  if (!nodes.length) return false
  if (stageId === 'html-output') {
    return nodes.every((node) => Boolean(node?.codePreview?.code || node?.artifact?.code || node?.artifact?.html || node?.artifact?.source || node?.code))
  }
  return nodes.some((node) => {
    const nodeId = String(node?.id || '').trim()
    const contentStatus = String(node?.contentStatus || '').trim()
    const contentSource = String(node?.contentSource || '').trim()
    if (!node || node.loading === true) return false
    if (nodeId === `${stageId}-loading` || nodeId === 'model-generating') return false
    if (contentStatus === 'model-pending' || contentStatus === 'waiting-model' || contentSource === 'model-pending') return false
    if (stageId === 'interaction-lofi') {
      return Boolean(node?.pageLayoutArtifact?.asciiWireframe || node?.pageLayoutArtifact?.rawText)
    }
    if (stageId === 'ui-visual') {
      return node?.artifactStatus === 'generated' ||
        node?.visualPreview?.imageStatus === 'generated' ||
        Boolean(node?.visualPreview?.imageUrl || node?.visualPreview?.imageDataUrl || node?.artifact?.imageUrl || node?.artifact?.imageDataUrl)
    }
    if (['html-output', 'vue-output'].includes(stageId)) {
      return Boolean(node?.codePreview?.code || node?.artifact?.code || node?.artifact?.html || node?.artifact?.source || node?.code)
    }
    if (stageId === 'acceptance-deposit') {
      return Boolean(workflowTotalDesignFlow.value?.stageConfirmations?.['vue-output']) && Boolean(node?.summary || node?.content?.length || node?.detailSections?.length)
    }
    return Boolean(node?.summary || node?.content?.length || node?.detailSections?.length)
  })
}

function workflowStageCanvasHasRenderedContent(stageCanvas = null, stageId = '') {
  const nodes = Array.isArray(stageCanvas?.nodes) ? stageCanvas.nodes : []
  if (!nodes.length) return false
  if (isManualArtifactStageId(stageId)) return true
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

function isManualArtifactStageId(stageId = '') {
  return ['ui-visual', 'html-output', 'vue-output'].includes(normalizeWorkflowStageId(stageId))
}

function inferredWorkflowStageStatuses(totalFlow = null, fallbackStatus = 'waiting') {
  const stageCanvases = totalFlow?.stageCanvases || {}
  return Object.fromEntries(workflowStageIdsFromTotalFlow(totalFlow).map((stageId) => [
    stageId,
    {
      status: workflowStageCanvasHasGeneratedContent(stageCanvases?.[stageId], stageId) ? 'completed' : fallbackStatus,
      updatedAt: ''
    }
  ]))
}

function createWorkflowEntryUserMessage(input = '', meta = {}) {
  const content = String(input || '').trim()
  if (!content) return null
  return {
    id: meta.id || `${meta.runId || 'workflow'}-entry-user`,
    role: 'user',
    content,
    createdAt: meta.createdAt || new Date().toISOString(),
    meta: {
      action: 'workflow-entry-input',
      source: 'workflow-entry',
      clientMessageId: meta.clientMessageId || `${meta.runId || 'workflow'}-entry-user`
    }
  }
}

function parseWorkflowCompactJsonContent(content = '') {
  const text = String(content || '').trim()
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  if (!cleaned.startsWith('{')) return null
  try {
    const parsed = JSON.parse(cleaned)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function workflowReplyPagesForDisplay(pages = []) {
  if (!Array.isArray(pages)) return []
  const seen = new Set()
  return pages
    .map((page, index) => ({
      ...page,
      title: String(page?.title || page?.name || page?.pageName || page?.id || `页面 ${index + 1}`).trim(),
      summary: String(page?.summary || page?.description || page?.route || page?.goal || '').trim()
    }))
    .filter((page) => {
      if (!page.title) return false
      const key = `${page.title}|${page.summary}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function workflowRequirementArtifactSummaryLines(totalFlow = {}) {
  const artifact = totalFlow?.requirementDissectionArtifact || {}
  const evidence = artifact.evidenceAndAssumptions || {}
  const pageCoverage = artifact.pageCoverageMatrix || artifact.designRequirementMap?.pageCoverageMatrix || []
  const decisions = Array.isArray(artifact.decisionPointMatrix) ? artifact.decisionPointMatrix : []
  const exceptions = Array.isArray(artifact.exceptionRecoveryMatrix) ? artifact.exceptionRecoveryMatrix : []
  const hierarchy = artifact.pageHierarchyTree || {}
  const dataFlow = artifact.dataFlowGraph || {}
  const stateMachine = artifact.stateMachineMap || {}
  const openQuestions = Array.isArray(artifact.openQuestions) ? artifact.openQuestions : []
  const lines = []
  if (evidence.demandScope || evidence.knowledgePolicy || Array.isArray(evidence.evidenceSources)) {
    lines.push('', '## 证据与假设')
    if (evidence.demandScope) lines.push(`- 当前模式：${evidence.demandScope === 'project' ? '项目需求' : '非项目需求'}`)
    if (Array.isArray(evidence.evidenceSources) && evidence.evidenceSources.length) lines.push(`- 证据来源：${evidence.evidenceSources.slice(0, 4).join('、')}`)
    if (evidence.knowledgePolicy) lines.push(`- 知识规则：${evidence.knowledgePolicy}`)
    if (Array.isArray(evidence.assumptions) && evidence.assumptions.length) lines.push(`- 关键假设：${evidence.assumptions.slice(0, 2).join('；')}`)
  }
  if (Array.isArray(pageCoverage) && pageCoverage.length) {
    const pendingCount = pageCoverage.filter((row) => Array.isArray(row?.openQuestions) && row.openQuestions.length).length
    lines.push('', '## 页面覆盖摘要')
    lines.push(`- 已识别参与页面：${pageCoverage.length} 个`)
    if (pendingCount) lines.push(`- 待确认页面：${pendingCount} 个`)
    pageCoverage.slice(0, 8).forEach((row) => {
      const name = String(row?.pageName || row?.title || '').trim()
      const entry = String(row?.entryFrom || '').trim()
      const exit = String(row?.exitTo || '').trim()
      if (name) lines.push(`- ${name}${entry || exit ? `：${entry || '入口待确认'} -> ${exit || '出口待确认'}` : ''}`)
    })
  }
  if (decisions.length || exceptions.length) {
    lines.push('', '## 决策与异常')
    if (decisions.length) lines.push(`- 决策点：${decisions.length} 个，影响分支页面和后续生成。`)
    if (exceptions.length) lines.push(`- 异常恢复：${exceptions.length} 类，影响失败态、空态、权限态和重试入口。`)
  }
  const hasGraphEntries =
    hierarchy.leafPageCount ||
    Array.isArray(hierarchy.nodes) ||
    (Array.isArray(pageCoverage) && pageCoverage.length) ||
    decisions.length ||
    exceptions.length ||
    (Array.isArray(dataFlow.edges) && dataFlow.edges.length) ||
    (Array.isArray(stateMachine.globalStates) && stateMachine.globalStates.length)
  if (hasGraphEntries) {
    lines.push('', '## 图表入口')
    if (hierarchy.leafPageCount || Array.isArray(hierarchy.nodes)) lines.push('- 页面层级：查看页面树和叶子页面覆盖。')
    if (Array.isArray(pageCoverage) && pageCoverage.length) lines.push('- 页面覆盖矩阵：核对每个页面的入口、出口、主操作和状态。')
    if (decisions.length) lines.push('- 决策点矩阵：核对会影响页面分支的选择。')
    if (exceptions.length) lines.push('- 异常与恢复：核对失败态、空态、权限态和重试路径。')
    if ((Array.isArray(dataFlow.edges) && dataFlow.edges.length) || (Array.isArray(stateMachine.globalStates) && stateMachine.globalStates.length)) lines.push('- 数据流与状态机：核对数据读写、阶段流转和按钮状态。')
  }
  const pageGapCount = Array.isArray(pageCoverage)
    ? pageCoverage.filter((row) => Array.isArray(row?.openQuestions) && row.openQuestions.length).length
    : 0
  const followUpQuestions = [
    ...openQuestions.map((item) => (typeof item === 'string' ? item : item?.question || item?.title || item?.summary || '')).filter(Boolean),
    ...(evidence.openEvidenceQuestions || [])
  ].filter(Boolean)
  if (pageGapCount || followUpQuestions.length) {
    lines.push('', '## 缺口追问')
    lines.push(`- 页面是否遗漏：${pageGapCount ? `${pageGapCount} 个页面仍有待确认项，需要优先核对入口、出口或状态。` : '当前页面覆盖未标记阻塞缺口，后续仍可继续补证据。'}`)
    if (followUpQuestions.length) lines.push(`- 可后续补充：${followUpQuestions.slice(0, 3).join('；')}`)
  }
  return lines
}

function workflowCompactJsonReplyText(generation = {}) {
  const rawText = [
    generation.rawContent,
    generation.content,
    generation.text,
    generation.message,
    generation.raw?.content,
    generation.raw?.text
  ].map((item) => String(item || '').trim()).find(Boolean)
  const parsed = parseWorkflowCompactJsonContent(rawText)
  if (!parsed) return ''
  const readableSummary = parsed.readableSummary && typeof parsed.readableSummary === 'object'
    ? parsed.readableSummary
    : {}
  const title = String(parsed.canvasTitle || parsed.title || '需求分析结果').trim()
  const lines = [`# ${title}`]
  const oneSentence = String(readableSummary.oneSentence || parsed.summary || '').trim()
  const userGoal = String(readableSummary.userGoal || '').trim()
  if (oneSentence) lines.push('', oneSentence)
  if (userGoal && userGoal !== oneSentence) lines.push('', `用户目标：${userGoal}`)
  const modules = Array.isArray(readableSummary.coreModules)
    ? readableSummary.coreModules.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (modules.length) lines.push('', '## 核心模块', ...modules.slice(0, 5).map((item) => `- ${item}`))
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
  lines.push(...workflowRequirementArtifactSummaryLines(parsed.totalDesignFlow || {}))
  if (pages.length) {
    lines.push('', '## 页面与流程')
    workflowReplyPagesForDisplay(parsed.totalDesignFlow?.pages).forEach((page) => {
      const pageTitle = page.title
      const pageSummary = page.summary
      if (pageTitle || pageSummary) lines.push(`- ${[pageTitle, pageSummary].filter(Boolean).join('：')}`)
    })
  }
  const questions = Array.isArray(readableSummary.questions)
    ? readableSummary.questions.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (questions.length) lines.push('', '## 待确认问题', ...questions.slice(0, 4).map((item) => `- ${item}`))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function workflowPageDetailItems(page = {}, sectionName = '') {
  return (Array.isArray(page.detailSections) ? page.detailSections : [])
    .filter((section) => String(section?.title || '').includes(sectionName))
    .flatMap((section) => Array.isArray(section?.items) ? section.items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function workflowPageLayoutType(page = {}, index = 0) {
  const text = [
    page.title,
    page.summary,
    ...workflowPageDetailItems(page, '核心模块'),
    ...workflowPageDetailItems(page, '用户点击动作')
  ].join(' ')
  if (/菜单|商品|分类|点餐|购物车/.test(text)) return '左右分栏 + 右侧卡片流 + 底部固定操作栏'
  if (/首页|推荐|发现|内容|社区/.test(text)) return '信息流 / 卡片流'
  if (/结算|确认|支付|订单/.test(text)) return '信息确认流 + 底部固定提交栏'
  if (/表单|登录|注册|填写|编辑/.test(text)) return '表单流'
  return index === 0 ? '顶部导航 + 主体滚动区 + 底部操作区' : '卡片流 / 信息分组'
}

function workflowPageLayoutArtifactText(analysis = {}) {
  const totalFlow = normalizeWorkflowTotalFlowMeta(analysis.totalDesignFlow) || null
  const pages = Array.isArray(totalFlow?.pages) ? totalFlow.pages : []
  if (!pages.length) return ''
  const visiblePages = workflowReplyPagesForDisplay(totalFlow?.pages)
  const firstPage = visiblePages[0] || {}
  const firstLayout = workflowPageLayoutType(firstPage, 0)
  const pageLines = visiblePages.map((page, index) => {
    const title = String(page?.title || page?.name || `页面 ${index + 1}`).trim()
    const layout = workflowPageLayoutType(page, index)
    const goal = workflowPageDetailItems(page, '页面目标')[0] || page.summary || '承接当前页面任务'
    return `│ ${index + 1}. ${title}｜${layout}｜${goal}`.slice(0, 72)
  })
  const moduleLines = visiblePages.flatMap((page, index) => {
    const title = String(page?.title || `页面 ${index + 1}`).trim()
    const modules = workflowPageDetailItems(page, '核心模块').slice(0, 3)
    const actions = workflowPageDetailItems(page, '用户点击动作').slice(0, 2)
    const states = workflowPageDetailItems(page, '状态').slice(0, 2)
    return [
      `- ${title}：${modules.length ? modules.join(' / ') : '顶部导航、核心内容区、主操作区、状态反馈区'}`,
      `  交互：${actions.length ? actions.join('；') : '点击主按钮、返回上一步、处理异常提示'}`,
      `  状态：${states.length ? states.join('；') : '加载、空状态、失败、权限'}`
    ]
  })
  return [
    ':::page-layout-artifact title="页面骨架"',
    '## 模型推荐方案',
    `页面类型：总流程页面骨架`,
    `推荐布局：${firstLayout}`,
    '推荐原因：当前输出包含多个页面节点，需要先用页面骨架卡片把页面顺序、布局类型、交互位置和前后端分工讲清楚，再进入具体 UI/代码生成。',
    '',
    '## ASCII 页面线框图',
    '┌────────────────────────────────────────────────────────┐',
    '│ 总流程页面骨架：页面顺序 + 推荐布局 + 页面目标             │',
    '├────────────────────────────────────────────────────────┤',
    ...pageLines,
    '├────────────────────────────────────────────────────────┤',
    '│ 交互说明区：按钮 / 输入框 / 图片 / 卡片 / 滚动 / 弹窗       │',
    '├────────────────────────────────────────────────────────┤',
    '│ 前后端交付区：前端接管布局状态，后端提供接口字段和错误码     │',
    '└────────────────────────────────────────────────────────┘',
    '',
    '## 模块交互明细',
    ...moduleLines,
    '',
    '## 前后端交付',
    '- 前端：按页面骨架实现顶部固定区、主体滚动区、底部固定操作区、卡片/列表/表单组件、弹窗和空/错/加载/权限状态。',
    '- 后端：提供页面所需接口数据、分页、价格/库存/会员/优惠/点赞等业务字段、错误码和降级策略。',
    '- 联调：每个页面至少对齐请求参数、响应字段、主操作成功反馈、失败恢复入口和验收点。',
    ':::'
  ].join('\n')
}

function workflowModelReplyText(analysis = {}) {
  const generation = analysis?.generation || {}
  const compactReply = workflowCompactJsonReplyText(generation)
  const layoutArtifact = workflowPageLayoutArtifactText(analysis)
  if (layoutArtifact) return layoutArtifact
  const sourceReply = compactReply || [
    generation.rawContent,
    generation.content,
    generation.text,
    generation.message,
    generation.raw?.content,
    generation.raw?.text
  ].map((item) => String(item || '').trim()).find(Boolean) || workflowAnalysisFallbackReplyText(analysis)
  return sourceReply
}

function workflowAdvancedUxReportCandidateFromAnalysis(analysis = {}) {
  const report = analysis?.advancedUxReport || analysis?.totalDesignFlow?.advancedUxReport || null
  return report || null
}

function workflowAdvancedUxReportFromAnalysis(analysis = {}) {
  const report = workflowAdvancedUxReportCandidateFromAnalysis(analysis)
  return report?.markdown ? report : null
}

function advancedUxMarkdownGeneratingStatusText(run = {}) {
  const report = workflowAdvancedUxReportCandidateFromAnalysis(run?.documentAnalysis || {}) || {}
  const fileName = report.fileName || '高级 UX 需求分析.md'
  const repairState = report.repairState || {}
  const issueCount = Number(repairState.remainingIssueCount || (Array.isArray(repairState.issues) ? repairState.issues.length : 0))
  const reportStatus = String(report.status || repairState.status || '').trim()
  if (reportStatus === 'checking') return `后台正在检查高级 UX Markdown 输出规范：${fileName}。生成完成后会自动导入画布；刷新页面不会丢失任务。`
  if (reportStatus === 'rechecking') return `后台正在重新校验高级 UX Markdown 补齐结果：${fileName}。生成完成后会自动导入画布；刷新页面不会丢失任务。`
  if (reportStatus === 'repairing') {
    return `发现 ${issueCount || '若干'} 项缺失，第 1 次补齐中... ${fileName} 生成完成后会自动导入画布；刷新页面不会丢失任务。`
  }
  if (reportStatus === 'retrying') {
    return `仍有 ${issueCount || '若干'} 项缺失，第 2 次补齐中... ${fileName} 生成完成后会自动导入画布；刷新页面不会丢失任务。`
  }
  return `后台正在生成高级 UX Markdown：${fileName}。模型尚未返回完整文档，生成完成后会自动导入画布；刷新页面不会丢失任务。`
}

function workflowAdvancedUxGeneratingTraceItems(run = {}) {
  const report = workflowAdvancedUxReportCandidateFromAnalysis(run?.documentAnalysis || {}) || {}
  const fileName = report.fileName || '高级 UX 需求分析.md'
  const reportStatus = String(report.status || report.repairState?.status || '').trim()
  const markdownStatus = /checking/.test(reportStatus)
    ? '正在检查 Markdown 输出规范。'
    : /repairing/.test(reportStatus)
      ? advancedUxMarkdownGeneratingStatusText(run)
      : /retrying/.test(reportStatus)
        ? advancedUxMarkdownGeneratingStatusText(run)
        : /rechecking/.test(reportStatus)
          ? '正在重新校验补齐结果。'
          : `后台正在生成高级 UX Markdown：${fileName}。模型尚未返回完整文档。`
  return [
    workflowAgentTraceFromProgress('intent', '需求识别', 'done', '已接收高级 UX 需求分析输入。'),
    workflowAgentTraceFromProgress('plan', 'Markdown 生成', 'running', markdownStatus),
    workflowAgentTraceFromProgress('answer', '画布导入', 'queued', '生成完成后会自动导入需求分析画布。'),
    workflowAgentTraceFromProgress('evidence', '任务恢复', 'done', '刷新页面不会丢失任务，后端会继续等待结果。')
  ]
}

function workflowAdvancedUxMarkdownReportDisplayText(report = {}) {
  const fileName = report.fileName || '高级 UX 需求分析.md'
  const reportStatus = String(report.status || report.reportStatus || '').trim()
  const isFailedReport = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
  const hasMarkdown = Boolean(String(report.markdown || '').trim())
  const issueText = sanitizeAdvancedUxFailureReason(report.importError || '')
  const drawioArtifacts = Array.isArray(report.drawioArtifacts)
    ? report.drawioArtifacts.filter((artifact) => artifact?.content)
    : []
  const lowFiWireframeArtifacts = Array.isArray(report.lowFiWireframeArtifacts)
    ? report.lowFiWireframeArtifacts.filter((artifact) => artifact?.imageDataUrl || artifact?.imageUrl)
    : []
  return [
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
}

function workflowAdvancedUxPageInteractionDocumentDisplayText(document = {}) {
  const fileName = document.fileName || '页面交互框架与说明.md'
  return [
    `页面交互文档已生成：${fileName}`,
    '已导入交互低保画布，可从页面节点详情查看对应页面框架、交互规则和异常状态。'
  ].join('\n\n')
}

function workflowAnalysisFallbackReplyText(analysis = {}) {
  if (!hasWorkflowAnalysisResultData(analysis)) return ''
  const totalFlow = normalizeWorkflowTotalFlowMeta(analysis.totalDesignFlow) || null
  const canvas = analysis.canvas || {}
  const title = String(
    analysis.title ||
    canvas.title ||
    canvas.canvasTitle ||
    totalFlow?.title ||
    '需求分析结果'
  ).trim()
  const summary = [
    analysis.readableSummary?.oneSentence,
    analysis.summary?.oneSentence,
    analysis.summary?.text,
    analysis.summary?.input,
    analysis.summary,
    canvas.summary,
    totalFlow?.readableSummary?.oneSentence
  ].map((item) => typeof item === 'string' ? item.trim() : '').find(Boolean)
  const slices = Array.isArray(totalFlow?.requirementSlices) ? totalFlow.requirementSlices : []
  const pages = Array.isArray(totalFlow?.pages) ? totalFlow.pages : []
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : []
  const lines = [`# ${title}`]
  if (summary) lines.push('', summary)
  lines.push(...workflowRequirementArtifactSummaryLines(totalFlow || {}))
  if (slices.length) {
    lines.push('', '## 需求切片')
    slices.slice(0, 4).forEach((slice) => {
      const sliceTitle = String(slice?.title || slice?.name || slice?.id || '').trim()
      const sliceGoal = String(slice?.goal || slice?.summary || slice?.sourceExcerpt || '').trim()
      if (sliceTitle || sliceGoal) lines.push(`- ${[sliceTitle, sliceGoal].filter(Boolean).join('：')}`)
    })
  }
  if (pages.length) {
    lines.push('', '## 页面与流程')
    pages.slice(0, 8).forEach((page) => {
      const pageTitle = String(page?.title || page?.name || page?.id || '').trim()
      const pageSummary = String(page?.summary || page?.route || '').trim()
      if (pageTitle || pageSummary) lines.push(`- ${[pageTitle, pageSummary].filter(Boolean).join('：')}`)
    })
  }
  if (!slices.length && !pages.length && nodes.length) {
    lines.push('', '## 画布节点')
    nodes.slice(0, 6).forEach((node) => {
      const nodeTitle = String(node?.title || node?.nodeName || node?.id || '').trim()
      const nodeSummary = String(node?.summary || '').trim()
      if (nodeTitle || nodeSummary) lines.push(`- ${[nodeTitle, nodeSummary].filter(Boolean).join('：')}`)
    })
  }
  lines.push('', '## 下一步建议', '- 在当前阶段继续补充关键信息，确认后进入下一阶段。')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function hasWorkflowAnalysisResultData(analysis = null) {
  return Boolean(analysis?.blueprint || analysis?.canvas || analysis?.totalDesignFlow)
}

function createWorkflowAnalysisAssistantMessage(analysis = {}, meta = {}) {
  const advancedUxReport = workflowAdvancedUxReportFromAnalysis(analysis)
  if (advancedUxReport) {
    return {
      id: meta.id || `${meta.runId || analysis?.analysisRunId || 'workflow'}-analysis-assistant`,
      role: 'assistant',
      content: workflowAdvancedUxMarkdownReportDisplayText(advancedUxReport),
      createdAt: meta.createdAt || advancedUxReport.generatedAt || new Date().toISOString(),
      meta: {
        action: 'advanced-ux-markdown-report',
        hideStatus: true,
        source: 'model',
        transient: false,
        status: 'success',
        statusLabel: workflowAgentStatusLabel('success'),
        typewriterDone: true,
        fileName: advancedUxReport.fileName || '',
        artifactType: advancedUxReport.artifactType || 'requirements-markdown',
        markdown: advancedUxReport.markdown || '',
        ...(Array.isArray(advancedUxReport.drawioArtifacts) && advancedUxReport.drawioArtifacts.length
          ? { drawioArtifacts: advancedUxReport.drawioArtifacts }
          : {}),
        ...(Array.isArray(advancedUxReport.lowFiWireframeArtifacts) && advancedUxReport.lowFiWireframeArtifacts.length
          ? { lowFiWireframeArtifacts: advancedUxReport.lowFiWireframeArtifacts }
          : {}),
        clientMessageId: meta.clientMessageId || `${meta.runId || analysis?.analysisRunId || 'workflow'}-analysis-assistant`
      }
    }
  }
  const advancedUxReportCandidate = workflowAdvancedUxReportCandidateFromAnalysis(analysis)
  const advancedUxReportStatus = String(advancedUxReportCandidate?.status || advancedUxReportCandidate?.reportStatus || '').trim()
  if (advancedUxReportCandidate && ['failed', 'quality_failed', 'import_failed'].includes(advancedUxReportStatus)) {
    return {
      id: meta.id || `${meta.runId || analysis?.analysisRunId || 'workflow'}-analysis-assistant`,
      role: 'assistant',
      content: workflowAdvancedUxMarkdownReportDisplayText(advancedUxReportCandidate),
      createdAt: meta.createdAt || advancedUxReportCandidate.generatedAt || new Date().toISOString(),
      meta: {
        action: 'advanced-ux-markdown-report',
        hideStatus: true,
        source: 'model',
        transient: false,
        status: 'failed',
        reportStatus: advancedUxReportStatus,
        statusLabel: '生成失败',
        typewriterDone: true,
        fileName: advancedUxReportCandidate.fileName || '',
        artifactType: advancedUxReportCandidate.artifactType || 'requirements-markdown',
        markdown: advancedUxReportCandidate.markdown || '',
        importError: sanitizeAdvancedUxFailureReason(advancedUxReportCandidate.importError || ''),
        qualityIssues: Array.isArray(advancedUxReportCandidate.qualityIssues) ? advancedUxReportCandidate.qualityIssues : [],
        clientMessageId: meta.clientMessageId || `${meta.runId || analysis?.analysisRunId || 'workflow'}-analysis-assistant`
      }
    }
  }
  const modelReply = workflowModelReplyText(analysis)
  if (!modelReply) return null
  return {
    id: meta.id || `${meta.runId || analysis?.analysisRunId || 'workflow'}-analysis-assistant`,
    role: 'assistant',
    content: modelReply,
    createdAt: meta.createdAt || new Date().toISOString(),
    meta: {
      action: 'workflow-analysis-result',
      hideStatus: true,
      source: 'model',
      transient: false,
      status: 'success',
      statusLabel: workflowAgentStatusLabel('success'),
      typewriterDone: true,
      clientMessageId: meta.clientMessageId || `${meta.runId || analysis?.analysisRunId || 'workflow'}-analysis-assistant`
    }
  }
}

function createWorkflowAnalysisLoadingAssistantMessage(run = {}, meta = {}) {
  const isAdvancedUxGenerating = isAdvancedUxMarkdownGeneratingRun(run)
  return {
    id: meta.id || `${run.id || 'workflow'}-analysis-assistant`,
    role: 'assistant',
    content: meta.content || (isAdvancedUxGenerating ? advancedUxMarkdownGeneratingStatusText(run) : ''),
    createdAt: meta.createdAt || new Date().toISOString(),
    trace: isAdvancedUxGenerating ? workflowAdvancedUxGeneratingTraceItems(run) : workflowAgentPendingTraceItems(),
    meta: {
      action: 'workflow-analysis-result',
      source: 'model',
      transient: true,
      status: 'generating',
      statusLabel: isAdvancedUxGenerating ? '生成高级 UX Markdown' : '生成回复',
      clientMessageId: meta.clientMessageId || `${run.id || 'workflow'}-analysis-assistant`
    }
  }
}

function isAdvancedUxReportAssistantMessage(message = {}) {
  return message?.role === 'assistant' && message?.meta?.action === 'advanced-ux-markdown-report'
}

function isAdvancedUxPageInteractionDocumentAssistantMessage(message = {}) {
  return message?.role === 'assistant' && message?.meta?.action === 'advanced-ux-page-interaction-document'
}

function isFailedAdvancedUxReportMessage(message = {}) {
  const meta = message?.meta || {}
  const reportStatus = String(meta.reportStatus || meta.status || '').trim()
  return message?.role === 'assistant' &&
    meta.action === 'advanced-ux-markdown-report' &&
    ['failed', 'quality_failed', 'import_failed'].includes(reportStatus) &&
    !String(meta.markdown || '').trim()
}

function workflowAgentMessageMergeKey(message = {}) {
  const meta = message?.meta || {}
  if (meta.action === 'advanced-ux-markdown-report') {
    if (isFailedAdvancedUxReportMessage(message)) return 'advanced-ux-markdown-report:failed'
    const fileName = String(meta.fileName || '').trim()
    if (fileName) return `advanced-ux-markdown-report:${fileName}`
  }
  if (meta.action === 'advanced-ux-page-interaction-document') {
    const fileName = String(meta.fileName || '').trim()
    if (fileName) return `advanced-ux-page-interaction-document:${fileName}`
  }
  return meta.clientMessageId || message?.id || ''
}

function mergeWorkflowAgentSessionMessages(existing = [], additions = []) {
  const merged = Array.isArray(existing) ? [...existing] : []
  additions.filter(Boolean).forEach((message) => {
    const key = workflowAgentMessageMergeKey(message)
    if (key) {
      const index = merged.findIndex((item) => workflowAgentMessageMergeKey(item) === key)
      if (index >= 0) {
        merged[index] = {
          ...merged[index],
          ...message,
          id: merged[index].id || message.id,
          createdAt: merged[index].createdAt || message.createdAt,
          content: message.content || merged[index].content,
          meta: {
            ...(merged[index].meta || {}),
            ...(message.meta || {})
          }
        }
        return
      }
    }
    merged.push(message)
  })
  return merged
}

function ensureWorkflowEntryMessageSession({ run = {}, input = '', sessions = null } = {}) {
  const baseSessions = sessions || run.agentSessions || {}
  const entryInput = input || run.input
  return {
    ...baseSessions,
    [WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID]: mergeWorkflowAgentSessionMessages(
      baseSessions[WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID],
      [createWorkflowEntryUserMessage(entryInput, { runId: run.id })]
    )
  }
}

function ensureWorkflowPendingAnalysisMessageSession({ run = {}, input = '', sessions = null } = {}) {
  return ensureWorkflowEntryMessageSession({
    run,
    input,
    sessions: sessions || run.agentSessions || {}
  })
}

function ensureWorkflowImmediateAssistantMessageSession({ run = {}, input = '', sessions = null } = {}) {
  const baseSessions = ensureWorkflowEntryMessageSession({
    run,
    input,
    sessions: sessions || run.agentSessions || {}
  })
  return {
    ...baseSessions,
    [WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID]: mergeWorkflowAgentSessionMessages(
      baseSessions[WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID],
      [createWorkflowAnalysisLoadingAssistantMessage(run)]
    )
  }
}

function workflowAnalysisStreamAssistantMessage(runId = '', payload = {}, meta = {}) {
  const text = workflowAgentStreamDisplayContent(payload.text || payload.delta || '')
  if (!String(text || '').trim()) return null
  return {
    id: `${runId || 'workflow'}-analysis-assistant`,
    role: 'assistant',
    content: text,
    createdAt: meta.createdAt || new Date().toISOString(),
    meta: {
      action: meta.action || payload.action || 'workflow-analysis-result',
      hideStatus: true,
      source: 'model',
      transient: false,
      status: meta.status || 'success',
      statusLabel: meta.statusLabel || workflowAgentStatusLabel(meta.status || 'success'),
      typewriterDone: meta.typewriterDone === false ? false : true,
      fileName: meta.fileName || payload.fileName || '',
      artifactType: meta.artifactType || payload.artifactType || '',
      markdown: meta.markdown || payload.markdown || '',
      ...(meta.pageInteractionDocument || payload.pageInteractionDocument
        ? { pageInteractionDocument: meta.pageInteractionDocument || payload.pageInteractionDocument }
        : {}),
      ...(Array.isArray(meta.drawioArtifacts || payload.drawioArtifacts) && (meta.drawioArtifacts || payload.drawioArtifacts).length
        ? { drawioArtifacts: meta.drawioArtifacts || payload.drawioArtifacts }
        : {}),
      ...(Array.isArray(meta.lowFiWireframeArtifacts || payload.lowFiWireframeArtifacts) && (meta.lowFiWireframeArtifacts || payload.lowFiWireframeArtifacts).length
        ? { lowFiWireframeArtifacts: meta.lowFiWireframeArtifacts || payload.lowFiWireframeArtifacts }
        : {}),
      clientMessageId: `${runId || 'workflow'}-analysis-assistant`
    }
  }
}

function workflowAgentSessionWithoutDuplicateAdvancedUxReports(session = []) {
  const seenAdvancedUxReportKeys = new Set()
  return [...(Array.isArray(session) ? session : [])].reverse().filter((message) => {
    if (!isAdvancedUxReportAssistantMessage(message)) return true
    const key = workflowAgentMessageMergeKey(message)
    if (!key) return true
    if (seenAdvancedUxReportKeys.has(key)) return false
    seenAdvancedUxReportKeys.add(key)
    return true
  }).reverse()
}

function shouldDropInterruptedAnalysisPlaceholder(message = {}, hasAdvancedUxReport = false) {
  if (!hasAdvancedUxReport || message?.role !== 'assistant') return false
  if (isAdvancedUxReportAssistantMessage(message)) return false
  const meta = message?.meta || {}
  const text = `${message?.content || ''} ${meta.error?.message || ''}`
  return meta.error?.code === 'AGENT_STREAM_INTERRUPTED' ||
    meta.interrupted === true ||
    /生成中断|未收到完成事件|未返回完成事件|上一次生成没有返回完成事件/.test(text)
}

function workflowRunHasAdvancedUxMarkdownReport(run = {}) {
  return Boolean(
    run?.documentAnalysis?.advancedUxReport?.markdown ||
    run?.documentAnalysis?.totalDesignFlow?.advancedUxReport?.markdown
  )
}

function finalizeWorkflowAnalysisAgentSessions(run = {}) {
  if (!run?.id || !workflowRunHasModelAssistantReply(run)) return run.agentSessions || {}
  const hasAdvancedUxReport = workflowRunHasAdvancedUxMarkdownReport(run)
  return Object.fromEntries(Object.entries(run.agentSessions || {}).map(([scopeId, session]) => {
    const normalizedSession = (Array.isArray(session) ? session : [])
      .filter((message) => !shouldDropInterruptedAnalysisPlaceholder(message, hasAdvancedUxReport))
      .map((message) => {
      if (
        message?.role !== 'assistant' ||
        !['workflow-analysis-result', 'advanced-ux-markdown-report'].includes(message?.meta?.action) ||
        message?.meta?.transient ||
        !String(message?.content || '').trim()
      ) {
        return message
      }
      return {
        ...message,
        trace: workflowAgentTraceWithoutStaleInterruption(message.trace, message.meta),
        meta: {
          ...workflowAgentSuccessMetaWithoutStaleInterruption(message.meta),
          status: 'success',
          statusLabel: workflowAgentStatusLabel('success'),
          typewriterDone: true
        }
      }
    })
    return [
      scopeId,
      workflowAgentSessionWithoutDuplicateAdvancedUxReports(normalizedSession)
    ]
  }))
}

function isWorkflowAgentBusyStatus(status = '') {
  return ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(String(status || '').trim())
}

function workflowAgentSuccessMetaWithoutStaleInterruption(meta = {}) {
  const nextMeta = { ...(meta || {}) }
  const errorCode = String(nextMeta.error?.code || '')
  if (errorCode === 'AGENT_STREAM_INTERRUPTED') {
    delete nextMeta.error
    nextMeta.interrupted = false
    nextMeta.placeholderOnly = false
    nextMeta.optimistic = false
  }
  return nextMeta
}

function workflowAgentTraceWithoutStaleInterruption(trace = [], meta = {}) {
  if (!Array.isArray(trace)) return trace
  const errorCode = String(meta?.error?.code || '')
  if (errorCode !== 'AGENT_STREAM_INTERRUPTED' && meta?.interrupted !== true) return trace
  return trace.map((item) => {
    if (!item || typeof item !== 'object') return item
    const text = `${item.text || ''} ${item.summary || ''}`
    if (String(item.status || '') !== 'failed' || !/生成中断|中断|未收到完成事件|未返回完成事件/.test(text)) return item
    return {
      ...item,
      status: 'done',
      text: item.text ? '已恢复为完整回复。' : item.text,
      summary: item.summary ? '已恢复为完整回复。' : item.summary
    }
  })
}

function workflowAgentInterruptedContent(message = {}) {
  const content = workflowAgentMessageText(message).trim()
  if (content) return content
  return '生成中断：上一次请求没有返回完成事件，可能是页面刷新、网络中断或后端重启。请点击重试重新发送。'
}

function recoverInterruptedWorkflowAgentSessions(run = {}) {
  const sessions = run?.agentSessions || {}
  const activePendingMessageId = state.activeWorkflowRun?.id === run?.id ? workflowAgentPendingMessageId.value : ''
  let changed = false
  const nextSessions = Object.fromEntries(Object.entries(sessions).map(([scopeId, session]) => [
    scopeId,
    (Array.isArray(session) ? session : []).map((message) => {
      const status = message?.meta?.status || ''
      if (
        message?.role !== 'assistant' ||
        !isWorkflowAgentBusyStatus(status) ||
        (activePendingMessageId && message?.id === activePendingMessageId)
      ) {
        return message
      }
      changed = true
      const trace = mergeWorkflowAgentTrace(
        workflowAgentMessageTrace(message),
        workflowAgentTraceFromProgress('answer', '回答/提案', 'failed', '生成中断，未收到完成事件。')
      )
      return {
        ...message,
        content: workflowAgentInterruptedContent(message),
        trace,
        meta: {
          ...(message.meta || {}),
          status: 'failed',
          statusLabel: workflowAgentStatusLabel('failed'),
          placeholderOnly: false,
          optimistic: false,
          interrupted: true,
          error: {
            ...(message.meta?.error || {}),
            code: message.meta?.error?.code || 'AGENT_STREAM_INTERRUPTED',
            message: message.meta?.error?.message || '上一次生成没有返回完成事件，已标记为中断。'
          }
        }
      }
    })
  ]))
  return changed ? { ...run, agentSessions: nextSessions } : run
}

function upsertWorkflowAnalysisStreamAssistantMessage(runId = '', payload = {}, options = {}) {
  const targetRun = state.activeWorkflowRun?.id === runId
    ? state.activeWorkflowRun
    : (state.workflowRuns || []).find((run) => run?.id === runId)
  if (!targetRun?.id) return null
  const scopeId = options.scopeId || WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID
  const sessions = ensureWorkflowEntryMessageSession({
    run: targetRun,
    input: targetRun.input || workflowForm.input,
    sessions: targetRun.agentSessions || {}
  })
  const message = workflowAnalysisStreamAssistantMessage(targetRun.id, payload, options)
  if (!message) return targetRun
  const nextRun = {
    ...targetRun,
    agentSessions: {
      ...sessions,
      [scopeId]: mergeWorkflowAgentSessionMessages(
        sessions[scopeId],
        [message]
      )
    },
    updatedAt: new Date().toISOString()
  }
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
  if (state.activeWorkflowRun?.id === targetRun.id || currentWorkflowAnalysisDeepLinkRunId() === targetRun.id) {
    state.activeWorkflowRun = nextRun
  }
  return nextRun
}

function upsertAdvancedUxMarkdownReportAssistantMessage(runId = '', report = {}) {
  const markdown = String(report.markdown || '').trim()
  const fileName = report.fileName || '高级 UX 需求分析.md'
  const reportStatus = String(report.status || '').trim()
  const isFailedReport = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
  if (!markdown && !isFailedReport) return null
  const displayText = workflowAdvancedUxMarkdownReportDisplayText({ ...report, fileName })
  const drawioArtifacts = Array.isArray(report.drawioArtifacts)
    ? report.drawioArtifacts.filter((artifact) => artifact?.content)
    : []
  const lowFiWireframeArtifacts = Array.isArray(report.lowFiWireframeArtifacts)
    ? report.lowFiWireframeArtifacts.filter((artifact) => artifact?.imageDataUrl || artifact?.imageUrl)
    : []
  return upsertWorkflowAnalysisStreamAssistantMessage(runId, {
    text: displayText,
    delta: displayText,
    action: 'advanced-ux-markdown-report',
    fileName,
    artifactType: report.artifactType || 'requirements-markdown',
    markdown,
    ...(drawioArtifacts.length ? { drawioArtifacts } : {}),
    ...(lowFiWireframeArtifacts.length ? { lowFiWireframeArtifacts } : {})
  }, {
    action: 'advanced-ux-markdown-report',
    fileName,
    artifactType: report.artifactType || 'requirements-markdown',
    markdown,
    reportStatus,
    importError: sanitizeAdvancedUxFailureReason(report.importError || ''),
    qualityIssues: Array.isArray(report.qualityIssues) ? report.qualityIssues : [],
    ...(drawioArtifacts.length ? { drawioArtifacts } : {}),
    ...(lowFiWireframeArtifacts.length ? { lowFiWireframeArtifacts } : {}),
    status: isFailedReport ? 'failed' : 'success',
    statusLabel: isFailedReport ? '未通过门禁' : workflowAgentStatusLabel('success'),
    typewriterDone: true
  })
}

function upsertAdvancedUxPageInteractionDocumentAssistantMessage(runId = '', document = {}) {
  const markdown = String(document.markdown || '').trim()
  if (!markdown) return null
  const fileName = document.fileName || '页面交互框架与说明.md'
  const displayText = workflowAdvancedUxPageInteractionDocumentDisplayText({ ...document, fileName })
  return upsertWorkflowAnalysisStreamAssistantMessage(runId, {
    text: displayText,
    delta: displayText,
    action: 'advanced-ux-page-interaction-document',
    fileName,
    artifactType: document.artifactType || 'page-interaction-markdown',
    markdown
  }, {
    scopeId: 'interaction-lofi',
    action: 'advanced-ux-page-interaction-document',
    fileName,
    artifactType: document.artifactType || 'page-interaction-markdown',
    markdown,
    status: 'success',
    statusLabel: workflowAgentStatusLabel('success'),
    typewriterDone: true
  })
}

function ensureWorkflowAnalysisAssistantMessageSession({ run = {}, analysis = null } = {}) {
  const baseSessions = ensureWorkflowEntryMessageSession({
    run,
    input: run.input,
    sessions: run.agentSessions || {}
  })
  const advancedUxReport = workflowAdvancedUxReportFromAnalysis(analysis || run.documentAnalysis || {})
  const pageInteractionDocument = advancedUxReport?.pageInteractionDocument?.markdown
    ? advancedUxReport.pageInteractionDocument
    : null
  return {
    ...baseSessions,
    [WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID]: mergeWorkflowAgentSessionMessages(
      baseSessions[WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID],
      [createWorkflowAnalysisAssistantMessage(analysis || run.documentAnalysis || {}, { runId: run.id })]
    ),
    ...(pageInteractionDocument
      ? {
          'interaction-lofi': mergeWorkflowAgentSessionMessages(
            baseSessions['interaction-lofi'],
            [{
              id: `${run.id || 'workflow'}-page-interaction-document-assistant`,
              role: 'assistant',
              content: workflowAdvancedUxPageInteractionDocumentDisplayText(pageInteractionDocument),
              createdAt: pageInteractionDocument.generatedAt || new Date().toISOString(),
              meta: {
                action: 'advanced-ux-page-interaction-document',
                hideStatus: true,
                source: 'model',
                transient: false,
                status: 'success',
                statusLabel: workflowAgentStatusLabel('success'),
                typewriterDone: true,
                fileName: pageInteractionDocument.fileName || '页面交互框架与说明.md',
                artifactType: pageInteractionDocument.artifactType || 'page-interaction-markdown',
                markdown: pageInteractionDocument.markdown || '',
                clientMessageId: `${run.id || 'workflow'}-page-interaction-document-assistant`
              }
            }]
          )
        }
      : {})
  }
}

function persistedWorkflowStageStatuses(totalFlow = null, options = {}) {
  const stageStatuses = normalizeWorkflowStageScopedMap(totalFlow?.stageStatuses || {})
  if (options.keepGenerating) return stageStatuses
  return Object.fromEntries(Object.entries(stageStatuses).map(([stageId, stageStatus]) => {
    const status = String(stageStatus?.status || '').trim()
    if (status !== 'generating') return [stageId, stageStatus]
    return [stageId, {
      ...stageStatus,
      status: workflowStageCanvasHasGeneratedContent(totalFlow?.stageCanvases?.[stageId], stageId) ? 'completed' : 'waiting'
    }]
  }))
}

function finalWorkflowStageStatuses(totalFlow = null) {
  return {
    ...inferredWorkflowStageStatuses(totalFlow, 'waiting'),
    ...persistedWorkflowStageStatuses(totalFlow)
  }
}

function isWorkflowAgentWorkbenchStageId(stageId = '') {
  return ['requirement-dissection', 'interaction-lofi', 'ui-visual']
    .includes(String(stageId || '').trim())
}

function isWorkflowAgentStageSessionScopeId(stageId = '') {
  return ['requirement-dissection', 'interaction-lofi', 'ui-visual', 'html-output', 'vue-output']
    .includes(String(stageId || '').trim())
}

function workflowAgentWorkbenchStageCanvas(stageId = '', sourceCanvas = null) {
  const normalizedStageId = String(stageId || '').trim()
  const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
  const stageName = stages.find((stage) => stage.id === normalizedStageId)?.name || '当前阶段'
  const sourceNodes = Array.isArray(sourceCanvas?.nodes) ? sourceCanvas.nodes : []
  const sourceAgentNode = sourceCanvas?.agentNode ||
    sourceNodes.find((node) => node?.agentWorkbench === true || node?.detailLayout === 'stage-agent-workbench') ||
    sourceNodes[0] ||
    null
  const agentNode = {
    ...(sourceAgentNode || {}),
    id: sourceAgentNode?.id || `${normalizedStageId || 'stage'}-agent`,
    stageId: normalizedStageId,
    title: sourceAgentNode?.title || stageName,
    summary: sourceAgentNode?.summary || `在「${stageName}」阶段继续用 Agent 对话确认信息，确认后再进入下一阶段。`,
    content: Array.isArray(sourceAgentNode?.content) && sourceAgentNode.content.length
      ? sourceAgentNode.content
      : [`围绕「${stageName}」补充需求、约束和待确认问题。`],
    agentWorkbench: true,
    detailLayout: 'stage-agent-workbench',
    agentScope: sourceAgentNode?.agentScope || `确认「${stageName}」阶段信息。`,
    quickActions: Array.isArray(sourceAgentNode?.quickActions) && sourceAgentNode.quickActions.length
      ? sourceAgentNode.quickActions
      : [],
    detailSections: Array.isArray(sourceAgentNode?.detailSections) && sourceAgentNode.detailSections.length
      ? sourceAgentNode.detailSections
      : [{ title: '待确认问题', items: ['还有不清楚的信息时，可以直接在下方输入补充或提问。'] }]
  }
  const stageDetailNodes = sourceNodes.length
    ? sourceNodes.map((node) => ({
      ...node,
      stageId: node.stageId || normalizedStageId,
      agentWorkbench: true,
      detailLayout: node.detailLayout || 'stage-agent-workbench'
    }))
    : []
  const nodes = uniqueWorkflowCanvasNodes(normalizedStageId === WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID
    ? stageDetailNodes
    : [
        agentNode,
        ...stageDetailNodes.filter((node) => node.id !== agentNode.id)
      ])
  return {
    ...(sourceCanvas || {}),
    mode: 'stage-agent-workbench',
    agentWorkbench: true,
    agentNode,
    nodes,
    edges: [],
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title || stageName }))
  }
}

function normalizeWorkflowTotalFlowMeta(meta = null) {
  if (!meta) return null
  const stages = normalizeWorkflowTotalFlowStages(meta.stages)
  return {
    ...meta,
    stages,
    currentStage: stages.some((stage) => stage.id === meta.currentStage) ? meta.currentStage : stages[0]?.id || '',
    stageCanvases: normalizeWorkflowStageCanvasMap(meta.stageCanvases),
    stageSlices: normalizeWorkflowStageScopedMap(meta.stageSlices),
    stagePages: normalizeWorkflowStageScopedMap(meta.stagePages),
    stageStatuses: normalizeWorkflowStageScopedMap(meta.stageStatuses),
    stageRuntime: normalizeWorkflowStageScopedMap(meta.stageRuntime)
  }
}

function isWorkflowDeprecatedTotalFlowStageId(stageId = '') {
  const normalizedStageId = String(stageId || '').trim()
  return WORKFLOW_DEPRECATED_TOTAL_FLOW_STAGE_IDS.has(normalizedStageId)
}

function normalizeWorkflowStageId(stageId = '') {
  const normalizedStageId = String(stageId || '').trim()
  if (isWorkflowDeprecatedTotalFlowStageId(normalizedStageId)) return ''
  if (normalizedStageId === 'html-vue') return 'html-output'
  return normalizedStageId
}

function workflowStageDisplayName(stage = {}) {
  const stageId = normalizeWorkflowStageId(stage?.id)
  const stageName = String(stage?.name || '').trim()
  if (stageId === WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID || stageName === '需求解剖') return '需求分析'
  return stageName
}

function normalizeWorkflowTotalFlowStages(stages = []) {
  const orderMap = new Map(WORKFLOW_TOTAL_FLOW_STAGE_ORDER.map((stageId, index) => [stageId, index]))
  const normalizedStages = (Array.isArray(stages) && stages.length ? stages : WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES)
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
      name: workflowStageDisplayName(stage)
    }))
    .filter((stage) =>
      !WORKFLOW_DEPRECATED_TOTAL_FLOW_STAGE_IDS.has(stage.id) &&
      !WORKFLOW_DEPRECATED_TOTAL_FLOW_STAGE_NAMES.has(stage.name)
    )
    .sort((stageA, stageB) =>
      (orderMap.get(stageA.id) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(stageB.id) ?? Number.MAX_SAFE_INTEGER)
    )
  const seen = new Set()
  return normalizedStages.filter((stage) => {
    if (seen.has(stage.id)) return false
    seen.add(stage.id)
    return true
  }).concat(
    WORKFLOW_TOTAL_FLOW_DEFAULT_STAGES.filter((stage) => !seen.has(stage.id))
  ).sort((stageA, stageB) =>
    (orderMap.get(stageA.id) ?? Number.MAX_SAFE_INTEGER) -
    (orderMap.get(stageB.id) ?? Number.MAX_SAFE_INTEGER)
  )
}

function normalizeWorkflowStageCanvasMap(stageCanvases = {}) {
  const canvasMap = stageCanvases && typeof stageCanvases === 'object' ? stageCanvases : {}
  const normalized = {}
  for (const [stageId, canvas] of Object.entries(canvasMap)) {
    const normalizedStageId = String(stageId || '').trim()
    if (isWorkflowDeprecatedTotalFlowStageId(normalizedStageId)) continue
    if (normalizedStageId === 'html-vue') {
      normalized['html-output'] = normalized['html-output'] || canvas
      normalized['vue-output'] = normalized['vue-output'] || canvas
      continue
    }
    normalized[normalizedStageId] = canvas
  }
  return normalized
}

function normalizeWorkflowStageScopedMap(value = {}) {
  const scopedMap = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const normalized = {}
  for (const [stageId, stageValue] of Object.entries(scopedMap)) {
    const normalizedStageId = String(stageId || '').trim()
    if (isWorkflowDeprecatedTotalFlowStageId(normalizedStageId)) continue
    if (normalizedStageId === 'html-vue') {
      normalized['html-output'] = normalized['html-output'] || stageValue
      normalized['vue-output'] = normalized['vue-output'] || stageValue
      continue
    }
    normalized[normalizedStageId] = stageValue
  }
  return normalized
}

function cloneWorkflowAnalysisSnapshot(value) {
  if (!value || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {}
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function buildWorkflowStageVersion(analysis = {}, meta = {}) {
  const stageId = String(meta.stageId || '').trim()
  const stageName = meta.stageName || stageId || '总流程阶段'
  const type = meta.type || 'stage-change'
  const createdAt = meta.createdAt || new Date().toISOString()
  return {
    id: meta.id || createClientId(`workflow-${type}-${stageId || 'flow'}`),
    type,
    source: type,
    label: meta.label || `${stageName} 版本`,
    summary: meta.summary || `${stageName} 已更新`,
    stageId,
    stageName,
    createdAt,
    qualityScore: analysis.qualityGate?.score ?? analysis.blueprint?.qualityGate?.score ?? null,
    snapshot: cloneWorkflowAnalysisSnapshot({
      blueprint: analysis.blueprint || null,
      canvas: analysis.canvas || null,
      routing: analysis.routing || null,
      generation: analysis.generation || null,
      totalDesignFlow: analysis.totalDesignFlow || null,
      qualityGate: analysis.qualityGate || analysis.blueprint?.qualityGate || null
    }),
    diff: meta.diff || null
  }
}

function buildWorkflowStageDiff(analysis = {}, stageId = '') {
  const normalizedStageId = String(stageId || '').trim()
  const totalFlow = analysis?.totalDesignFlow || {}
  const stageCanvas = totalFlow.stageCanvases?.[normalizedStageId] || {}
  const stageNodes = Array.isArray(stageCanvas.nodes) ? stageCanvas.nodes : []
  const stageNodeTitles = stageNodes
    .map((node) => node?.title || node?.label || node?.id || '')
    .map((title) => String(title).trim())
    .filter(Boolean)
    .slice(0, 12)
  return {
    stageId: normalizedStageId,
    stageNodeCount: stageNodes.length,
    stageNodeTitles,
    changedBlueprintFields: ['totalDesignFlow.stageCanvases'],
    nodeDelta: 0,
    edgeDelta: 0,
    qualityDelta: 0
  }
}

function appendWorkflowAnalysisVersion(analysis = {}, meta = {}) {
  const currentVersions = Array.isArray(analysis.versions)
    ? analysis.versions
    : (Array.isArray(analysis.blueprint?.versions) ? analysis.blueprint.versions : [])
  const nextVersion = buildWorkflowStageVersion(analysis, meta)
  const versions = [nextVersion, ...currentVersions.filter((version) => version?.id !== nextVersion.id)].slice(0, 12)
  const nextAnalysis = {
    ...analysis,
    versions
  }
  if (nextAnalysis.blueprint) {
    nextAnalysis.blueprint = {
      ...nextAnalysis.blueprint,
      versions
    }
  }
  return nextAnalysis
}

function appendWorkflowStageConfirmationVersion(analysis = {}, meta = {}) {
  return appendWorkflowAnalysisVersion(analysis, {
    type: 'stage-confirmation',
    ...meta
  })
}

function appendWorkflowStageRegenerateVersion(analysis = {}, meta = {}) {
  return appendWorkflowAnalysisVersion(analysis, {
    type: 'stage-regenerate',
    ...meta
  })
}

function mergeWorkflowStageStatus(stageId, status, extra = {}) {
  if (!stageId) return
  workflowStageStatusMap.value = {
    ...workflowStageStatusMap.value,
    [stageId]: {
      ...(workflowStageStatusMap.value[stageId] || {}),
      ...extra,
      status,
      updatedAt: extra.updatedAt || new Date().toISOString()
    }
  }
}

function applyWorkflowStageStatusesToAnalysis(stageStatuses = workflowStageStatusMap.value) {
  if (!workflowAnalysisResult.value?.totalDesignFlow) return
  workflowAnalysisResult.value = {
    ...workflowAnalysisResult.value,
    totalDesignFlow: {
      ...workflowAnalysisResult.value.totalDesignFlow,
      stageStatuses: {
        ...(workflowAnalysisResult.value.totalDesignFlow.stageStatuses || {}),
        ...(stageStatuses || {})
      }
    }
  }
}

function workflowVisualArtifactImage(node = {}) {
  return String(node?.visualPreview?.imageUrl || node?.visualPreview?.imageDataUrl || node?.artifact?.imageUrl || node?.artifact?.imageDataUrl || '').trim()
}

function workflowHasGeneratedVisualArtifact(node = {}) {
  return Boolean(workflowVisualArtifactImage(node) || node?.artifactStatus === 'generated')
}

function normalizeWorkflowVisualNodeTitle(value = '') {
  return String(value || '')
    .replace(/UI视觉|高保真图|视觉稿/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function workflowVisualNodeIdentityKeys(node = {}) {
  return [
    node?.sourcePageId ? `sourcePageId:${node.sourcePageId}` : '',
    node?.pageId ? `pageId:${node.pageId}` : '',
    node?.route ? `route:${node.route}` : '',
    normalizeWorkflowVisualNodeTitle(node?.title) ? `title:${normalizeWorkflowVisualNodeTitle(node.title)}` : ''
  ].filter(Boolean)
}

function workflowGenerationNodeTitleKey(value = '') {
  return String(value || '')
    .replace(/UI视觉|高保真图|视觉稿|HTML|Vue|页面代码|代码/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function workflowGenerationNodeIdentityKeys(node = {}) {
  const rawId = String(node?.id || '').trim()
  const strippedIds = [
    rawId.replace(/^ui-/, ''),
    rawId.replace(/^html-page-/, ''),
    rawId.replace(/^vue-page-/, ''),
    rawId.replace(/^html-/, ''),
    rawId.replace(/^vue-/, '')
  ].filter((item) => item && item !== rawId)
  return [
    node?.sourcePageId ? `sourcePageId:${node.sourcePageId}` : '',
    node?.pageId ? `pageId:${node.pageId}` : '',
    node?.sourceNodeId ? `sourceNodeId:${node.sourceNodeId}` : '',
    node?.route ? `route:${node.route}` : '',
    ...strippedIds.map((id) => `id:${id}`),
    workflowGenerationNodeTitleKey(node?.title) ? `title:${workflowGenerationNodeTitleKey(node.title)}` : ''
  ].filter(Boolean)
}

function workflowStageNodesForId(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  const stageCanvas = workflowTotalDesignFlow.value?.stageCanvases?.[normalizedStageId] ||
    workflowAnalysisResult.value?.totalDesignFlow?.stageCanvases?.[normalizedStageId] ||
    state.activeWorkflowRun?.documentAnalysis?.totalDesignFlow?.stageCanvases?.[normalizedStageId] ||
    null
  return Array.isArray(stageCanvas?.nodes) ? stageCanvas.nodes : []
}

function findWorkflowGenerationTargetNode(sourceNode = {}, targetStageId = '') {
  const targetNodes = workflowStageNodesForId(targetStageId)
  if (!targetNodes.length) return null
  const sourceKeys = new Set(workflowGenerationNodeIdentityKeys(sourceNode))
  const sameIdentity = (node = {}) => workflowGenerationNodeIdentityKeys(node).some((key) => sourceKeys.has(key))
  return targetNodes.find((node) => sameIdentity(node)) ||
    targetNodes.find((node) => {
      const target = String(node?.targetGenerator || node?.codePreview?.codeLanguage || '').trim().toLowerCase()
      return targetStageId === 'html-output' ? target === 'html' : target === 'vue'
    }) ||
    null
}

function preserveGeneratedWorkflowVisualArtifactsInCanvas(currentCanvas = {}, incomingCanvas = {}) {
  if (!Array.isArray(currentCanvas?.nodes) || !Array.isArray(incomingCanvas?.nodes)) return incomingCanvas
  const preservedById = new Map()
  const preservedByIdentity = new Map()
  const duplicateIdentityKeys = new Set()
  const preservedFields = (node = {}) => ({
    artifactStatus: node.artifactStatus,
    artifact: node.artifact,
    visualPreview: node.visualPreview,
    generationActions: node.generationActions,
    targetGenerator: node.targetGenerator,
    contentStatusLabel: node.contentStatusLabel
  })
  currentCanvas.nodes.forEach((node) => {
    if (!node?.id || !workflowHasGeneratedVisualArtifact(node)) return
    const preserved = preservedFields(node)
    preservedById.set(node.id, preserved)
    workflowVisualNodeIdentityKeys(node).forEach((key) => {
      if (preservedByIdentity.has(key)) {
        duplicateIdentityKeys.add(key)
        return
      }
      preservedByIdentity.set(key, preserved)
    })
  })
  if (!preservedById.size && !preservedByIdentity.size) return incomingCanvas
  const preservedForNode = (node = {}) => {
    if (preservedById.has(node?.id)) return preservedById.get(node.id)
    for (const key of workflowVisualNodeIdentityKeys(node)) {
      if (duplicateIdentityKeys.has(key)) continue
      if (preservedByIdentity.has(key)) return preservedByIdentity.get(key)
    }
    return null
  }
  return {
    ...incomingCanvas,
    nodes: incomingCanvas.nodes.map((node) => {
      if (workflowHasGeneratedVisualArtifact(node)) return node
      const preserved = preservedForNode(node)
      if (!preserved) return node
      return {
        ...node,
        ...Object.fromEntries(Object.entries(preserved).filter(([, value]) => value !== undefined)),
        artifactStatus: preserved.artifactStatus || node.artifactStatus
      }
    })
  }
}

function mergeWorkflowStageCanvasEvent(currentAnalysis = {}, payload = {}) {
  const stageId = normalizeWorkflowStageId(payload.stageId || payload.stage?.id)
  if (!stageId) return currentAnalysis
  const currentTotalFlow = currentAnalysis.totalDesignFlow || null
  const incomingTotalFlow = normalizeWorkflowTotalFlowMeta(payload.totalDesignFlow || payload.totalFlowMeta) || currentTotalFlow || {}
  const incomingStageCanvases = incomingTotalFlow.stageCanvases?.['ui-visual']
    ? {
        ...(incomingTotalFlow.stageCanvases || {}),
        'ui-visual': preserveGeneratedWorkflowVisualArtifactsInCanvas(
          currentTotalFlow?.stageCanvases?.['ui-visual'],
          incomingTotalFlow.stageCanvases?.['ui-visual']
        )
      }
    : incomingTotalFlow.stageCanvases || {}
  const incomingStageCanvas = payload.stageCanvas || incomingStageCanvases?.[stageId] || currentTotalFlow?.stageCanvases?.[stageId] || { nodes: [], edges: [], orderedTabs: [] }
  const mergedStageCanvas = stageId === 'ui-visual'
    ? preserveGeneratedWorkflowVisualArtifactsInCanvas(currentTotalFlow?.stageCanvases?.['ui-visual'], incomingStageCanvas)
    : incomingStageCanvas
  const nextTotalFlow = normalizeWorkflowTotalFlowMeta({
    ...currentTotalFlow,
    ...incomingTotalFlow,
    currentStage: workflowActiveStageTouchedByUser.value
      ? (workflowActiveStageId.value || currentTotalFlow?.currentStage || incomingTotalFlow.currentStage || stageId || '')
      : (currentTotalFlow?.currentStage || incomingTotalFlow.currentStage || stageId || ''),
    stageCanvases: {
      ...(currentTotalFlow?.stageCanvases || {}),
      ...incomingStageCanvases,
      [stageId]: mergedStageCanvas
    },
    stageStatuses: {
      ...(currentTotalFlow?.stageStatuses || {}),
      ...(incomingTotalFlow.stageStatuses || {}),
      [stageId]: {
        status: payload.status || 'generating',
        updatedAt: payload.regeneratedAt || new Date().toISOString(),
        regenerate: Boolean(payload.regenerate)
      }
    }
  })
  const status = payload.status || 'generating'
  if (incomingTotalFlow.stageStatuses && Object.keys(incomingTotalFlow.stageStatuses).length) {
    workflowStageStatusMap.value = {
      ...workflowStageStatusMap.value,
      ...incomingTotalFlow.stageStatuses
    }
  } else {
    mergeWorkflowStageStatus(stageId, status, {
      index: payload.index,
      total: payload.total,
      regenerate: Boolean(payload.regenerate),
      updatedAt: payload.regeneratedAt || ''
    })
  }
  if (!workflowActiveStageId.value) workflowActiveStageId.value = stageId
  return {
    ...currentAnalysis,
    status: status === 'completed' ? (currentAnalysis.status || 'streaming') : 'streaming',
    totalDesignFlow: nextTotalFlow
  }
}

function mergeWorkflowAnalysisStreamError(currentAnalysis = {}, error = {}) {
  const message = error.message || '模型调用失败，请检查模型配置后重试。'
  const recoveryActions = Array.isArray(error.recoveryActions) && error.recoveryActions.length
    ? error.recoveryActions
    : ['检查模型配置', '重新分析文档']
  const nodeId = 'model-generating'
  const canvas = currentAnalysis.canvas || workflowLoadingCanvas.value
  const nodes = uniqueWorkflowCanvasNodes(Array.isArray(canvas.nodes) && canvas.nodes.length ? canvas.nodes : workflowLoadingCanvas.value.nodes)
  let replaced = false
  const nextNodes = nodes.map((item) => {
    if (item.id !== nodeId && item.id !== 'analysis') return item
    replaced = true
    return {
      ...item,
      id: nodeId,
      title: '模型调用失败',
      summary: message,
      content: [
        message,
        ...recoveryActions.map((action) => `恢复动作：${action}`)
      ],
      loading: false,
      quickActions: recoveryActions,
      detailSections: [
        { title: '失败原因', items: [message] },
        { title: '恢复动作', items: recoveryActions }
      ]
    }
  })
  if (!replaced) {
    nextNodes.unshift({
      id: nodeId,
      title: '模型调用失败',
      summary: message,
      content: [message],
      x: 80,
      y: 140,
      width: 420,
      height: 260,
      loading: false,
      quickActions: recoveryActions,
      detailSections: [
        { title: '失败原因', items: [message] },
        { title: '恢复动作', items: recoveryActions }
      ]
    })
  }
  return {
    ...currentAnalysis,
    status: 'failed',
    canvas: {
      ...canvas,
      nodes: uniqueWorkflowCanvasNodes(nextNodes),
      orderedTabs: [{ key: nodeId, label: '模型失败' }]
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

async function persistWorkflowAnalysisBackgroundRun(baseRun = {}, analysis = null, options = {}) {
  if (!baseRun?.id || !analysis?.canvas) return null
  const existingRun = state.activeWorkflowRun?.id === baseRun.id
    ? state.activeWorkflowRun
    : (state.workflowRuns || []).find((run) => run?.id === baseRun.id)
  if (existingRun?.status === 'analyzed' && options.status !== 'analyzed') return existingRun
  const progressRun = {
    ...baseRun,
    documentAnalysis: analysis,
    projectBlueprint: analysis?.blueprint || baseRun.projectBlueprint || null,
    agentSessions: baseRun.agentSessions || {},
    referenceFiles: baseRun.referenceFiles || {},
    status: options.status || baseRun.status || 'analyzing',
    updatedAt: new Date().toISOString()
  }
  try {
    const saved = await api.workspace.createWorkflowRun(state.apiConfig, progressRun)
    const persisted = saved.ok && saved.data?.run ? saved.data.run : progressRun
    if (existingRun?.status === 'analyzed' && persisted.status !== 'analyzed') return existingRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persisted)
    saveState(state)
    return persisted
  } catch (error) {
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, progressRun)
    saveState(state)
    return progressRun
  }
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
const workflowCanvasSkillLabel = computed(() =>
  activeWorkflowRun.value?.displaySkillName ||
  workflowAnalysisResult.value?.routing?.displaySkillName ||
  workflowAnalysisResult.value?.displaySkillName ||
  workflowSkillRouting.value.resolvedSkillName ||
  workflowSkillRouting.value.requestedSkillName ||
  activeWorkflowRun.value?.workflowName ||
  '未选择 Skill'
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
  workflowCurrentCanvasNodes.value.find((node) => node.id === (workflowAgentNodeId.value || workflowFullscreenNodeId.value)) ||
  workflowCurrentCanvasNodes.value[0] ||
  null
)
const workflowAgentNode = computed(() =>
  canvasNodeById(workflowAgentNodeId.value) ||
  activeCanvasNode.value
)
const fullscreenCanvasNode = computed(() =>
  canvasNodeById(workflowFullscreenNodeId.value) ||
  (workflowFullscreenNodeOverride.value?.id === workflowFullscreenNodeId.value ? workflowFullscreenNodeOverride.value : null)
)

function workflowCanvasResolvableNodeId(candidateId = '') {
  if (candidateId && canvasNodeById(candidateId)) return candidateId
  if (activeCanvasNode.value?.id && canvasNodeById(activeCanvasNode.value.id)) return activeCanvasNode.value.id
  return workflowCurrentCanvasNodes.value[0]?.id || ''
}

function openWorkflowCanvasFullscreen(nodeId = '', options = {}) {
  const candidateNode = nodeId && typeof nodeId === 'object' && !Array.isArray(nodeId) ? nodeId : null
  const candidateNodeId = candidateNode?.id || String(nodeId || '')
  const resolvedNode = candidateNodeId ? canvasNodeById(candidateNodeId) : null
  const targetNodeId = resolvedNode?.id || candidateNode?.id || workflowCanvasResolvableNodeId(candidateNodeId)
  if (!targetNodeId) return
  // 画布全屏是当前主视图；先收起 Agent，避免右侧对话遮挡全屏详情。
  setWorkflowAgentDisplayMode('hidden')
  workflowFullscreenNodeOverride.value = resolvedNode ? null : (candidateNode?.id === targetNodeId ? candidateNode : null)
  workflowFullscreenNodeId.value = targetNodeId
  workflowFullscreenEditNodeId.value = options.edit ? targetNodeId : ''
}

function handleWorkflowCanvasNodeAction(payload = '') {
  if (payload?.action === 'open-detail') {
    openWorkflowCanvasFullscreen(payload.node || payload.nodeId)
    return
  }
  openWorkflowAgentForNode(payload)
}

function closeWorkflowCanvasFullscreen() {
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  workflowFullscreenNodeOverride.value = null
}

function normalizeWorkflowAgentQuickReplies(replies = []) {
  return Array.from(new Set(
    replies
      .map((reply) => String(reply || '').trim())
      .filter(Boolean)
      .filter((reply) => !isPassiveWorkflowAgentQuickReply(reply))
      .filter((reply) => !isWorkflowAgentConfirmationAction(reply))
  )).slice(0, 6)
}

function isPassiveWorkflowAgentQuickReply(reply = '') {
  return /^(等待生成|正在生成|生成中|生成完成后查看|完成后查看|阶段完成后查看)$/.test(String(reply || '').trim())
}

const workflowAgentQuickReplies = computed(() => {
  return normalizeWorkflowAgentQuickReplies(workflowAgentSession.value?.quickReplies || [])
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

watch(
  () => [workflowUsesEmbeddedAgent.value, workflowCurrentStageId.value, workflowStageCanvas.value?.agentNode?.id],
  ([usesEmbeddedAgent, stageId]) => {
    if (!usesEmbeddedAgent) return
    setWorkflowAgentDisplayMode('inline')
    workflowCanvasZoom.value = Math.max(workflowCanvasZoom.value, 1.12)
    const stageCanvas = workflowStageCanvas.value || workflowStagePlaceholderCanvas.value
    const targetNodeId = stageCanvas?.agentNode?.id || stageCanvas?.nodes?.[0]?.id || `${stageId}-agent`
    if (targetNodeId) workflowAgentNodeId.value = targetNodeId
  },
  { immediate: true }
)

function advancedUxPendingStageGenerationWatchKey() {
  const totalFlow = workflowAnalysisResult.value?.totalDesignFlow || null
  return [
    workflowCurrentStageId.value,
    totalFlow?.currentStage || '',
    totalFlow?.stageStatuses?.['interaction-lofi']?.status || '',
    totalFlow?.stageRuntime?.['interaction-lofi']?.state || '',
    workflowAdvancedUxPageInteractionDocument(totalFlow)?.fileName || '',
    workflowAdvancedUxPageInteractionDocument(totalFlow)?.markdown ? 'has-page-doc' : 'missing-page-doc'
  ].join('|')
}

watch(
  advancedUxPendingStageGenerationWatchKey,
  () => {
    if (shouldResumeAdvancedUxPendingStageGeneration(workflowCurrentStageId.value)) {
      scheduleWorkflowStageAutoGeneration(workflowCurrentStageId.value)
    }
  },
  { immediate: true }
)

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

function hideGlobalUploadNotice() {
  if (globalUploadNoticeTimer) {
    clearTimeout(globalUploadNoticeTimer)
    globalUploadNoticeTimer = null
  }
  globalUploadNotice.status = 'idle'
  globalUploadNotice.message = ''
}

function showGlobalUploadNotice(status, message) {
  if (globalUploadNoticeTimer) {
    clearTimeout(globalUploadNoticeTimer)
    globalUploadNoticeTimer = null
  }
  globalUploadNotice.status = status
  globalUploadNotice.message = message || (status === 'loading' ? '正在上传文件...' : status === 'success' ? '文件上传完成' : '文件上传失败')
  const timeout = GLOBAL_UPLOAD_NOTICE_AUTO_HIDE_MS[status]
  if (timeout) {
    globalUploadNoticeTimer = window.setTimeout(() => {
      if (globalUploadNotice.status === status && globalUploadNotice.message === message) {
        hideGlobalUploadNotice()
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
    competitors: '竞品分析',
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
  knowledgeCanvasZoom.value = Math.min(2.2, Math.max(0.25, Number((knowledgeCanvasZoom.value + delta).toFixed(2))))
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

function selectKnowledgeFlow(flowId = '') {
  const flow = knowledgePrototypeFlowTree.value.flows.find((item) => item.id === flowId) || knowledgePrototypeFlowTree.value.selectedFlow
  if (!flow) return
  selectedKnowledgeFlowId.value = flow.id
  const firstScreenId = flow.screenIds?.[0]
  if (firstScreenId) {
    const page = knowledgePrototypePages.value.find((item) => item.id === firstScreenId)
    selectedKnowledgePrototypeScreenId.value = firstScreenId
    if (page?.nodeId) selectedKnowledgeNodeId.value = page.nodeId
  }
}

function selectKnowledgePrototypeScreen(screenId = '') {
  const screen = selectPrototypeDemoScreen(currentKnowledgePrototypeDemo.value, screenId)
  if (!screen) return
  selectedKnowledgePrototypeScreenId.value = screen.id
  const page = knowledgePrototypePages.value.find((item) => item.id === screen.id)
  if (page?.nodeId) selectedKnowledgeNodeId.value = page.nodeId
}

function readPrototypeScreenshotAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function setKnowledgePrototypeUploadState(pageId = '', status = '', message = '') {
  if (!pageId) return
  if (!status) {
    delete knowledgePrototypeUploadStates[pageId]
    return
  }
  knowledgePrototypeUploadStates[pageId] = { status, message }
}

async function uploadKnowledgePrototypeScreenshot(page = {}, source = {}) {
  const input = source?.target
  const providedDataUrl = typeof source?.dataUrl === 'string' ? source.dataUrl : ''
  const providedFileName = source?.fileName || ''
  const file = input?.files?.[0]
  if (!file && !providedDataUrl) return
  if (file && !/^image\//.test(file.type || '')) {
    setKnowledgePrototypeUploadState(page.id, 'failed', '请上传 PNG、JPG、WebP 等图片文件')
    setStatus(knowledgeStatus, 'failed', '请上传 PNG、JPG、WebP 等图片文件')
    if (input) input.value = ''
    return
  }
  const fileName = file?.name || providedFileName || ''
  setKnowledgePrototypeUploadState(page.id, 'loading', fileName ? `正在上传 ${fileName}` : '正在上传截图')
  try {
    const dataUrl = providedDataUrl || await readPrototypeScreenshotAsDataUrl(file)
    await upsertKnowledgePrototypeScreenshot(page, dataUrl, fileName)
    selectedKnowledgePrototypeScreenId.value = page.id || selectedKnowledgePrototypeScreenId.value
    setKnowledgePrototypeUploadState(page.id, 'success', '上传完成')
    setStatus(knowledgeStatus, 'success', `已填充 ${page.title || '流程页面'} 截图`)
  } catch (error) {
    setKnowledgePrototypeUploadState(page.id, 'failed', error.message || '请重新上传')
    setStatus(knowledgeStatus, 'failed', `截图读取失败：${error.message || '请重新上传'}`)
  } finally {
    if (input) input.value = ''
  }
}

function upsertLocalWorkspaceAsset(asset = {}) {
  if (!asset?.id) return
  const index = state.assets.findIndex((item) => item.id === asset.id)
  if (index >= 0) state.assets.splice(index, 1, asset)
  else state.assets.unshift(asset)
  saveState(state)
}

async function persistKnowledgePrototypeAsset(asset = {}) {
  upsertLocalWorkspaceAsset(asset)
  const savedAsset = await persistWorkspaceAsset(asset)
  const index = state.assets.findIndex((item) => item.id === savedAsset.id)
  if (index >= 0) state.assets.splice(index, 1, savedAsset)
  else state.assets.unshift(savedAsset)
  saveState(state)
  return savedAsset
}

async function upsertKnowledgePrototypeScreenshot(page = {}, screenshotUrl = '', fileName = '') {
  if (!page.id || !screenshotUrl) return
  const sourcePrototypeAsset = currentProjectFlowPrototypeAsset.value || currentProjectPrototypeAsset.value
  const demoAsset = buildPrototypeDemoAsset({
    blueprint: currentKnowledgeBlueprint.value || {},
    prototypeAsset: sourcePrototypeAsset,
    projectId: state.currentProjectId,
    assetId: sourcePrototypeAsset?.id || (currentProjectBlueprintAsset.value?.id ? `${currentProjectBlueprintAsset.value.id}-prototype-demo` : '')
  })
  const now = new Date().toISOString()
  const hasExistingScreen = (demoAsset.screens || []).some((screen) => screen.id === page.id)
  const nextScreens = (demoAsset.screens || []).map((screen) =>
    screen.id === page.id
      ? {
          ...screen,
          screenshotUrl,
          screenshotAssetId: `${screen.id}-manual-screenshot`,
          screenshotStorage: 'local-upload',
          updatedAt: now
        }
      : screen
  )
  if (!hasExistingScreen) {
    nextScreens.push({
      ...page,
      id: page.id,
      title: page.title || '未命名页面',
      screenshotUrl,
      screenshotAssetId: `${page.id}-manual-screenshot`,
      screenshotStorage: 'local-upload',
      updatedAt: now
    })
  }
  const nextAsset = {
    ...(sourcePrototypeAsset || {}),
    id: demoAsset.id,
    type: 'prototype-demo',
    projectId: state.currentProjectId,
    title: demoAsset.title || `${displayProjectName(currentProject.value)} 交互 Demo`,
    meta: '流程图截图 · 本地上传',
    status: '已更新',
    updatedAt: now,
    prototypeDemo: {
      ...demoAsset,
      screens: nextScreens,
      screenshotAssets: [
        ...(demoAsset.screenshotAssets || []).filter((asset) => asset.screenId !== page.id),
        {
          id: `${page.id}-manual-screenshot`,
          screenId: page.id,
          fileName,
          screenshotUrl,
          storage: 'local-upload',
          uploadedAt: now
        }
      ]
    }
  }
  await persistKnowledgePrototypeAsset(nextAsset)
}

function triggerKnowledgePrototypeHotspot(hotspot = {}) {
  const fromScreen = selectedKnowledgePrototypeScreen.value || {}
  const targetScreenId = resolvePrototypeHotspotTarget(currentKnowledgePrototypeDemo.value, hotspot, fromScreen.id)
  const targetScreen = targetScreenId
    ? (currentKnowledgePrototypeDemo.value.screens || []).find((screen) => screen.id === targetScreenId)
    : null
  lastKnowledgePrototypeHotspot.value = {
    ...hotspot,
    screenId: fromScreen.id || '',
    screenTitle: fromScreen.title || '',
    resolvedTargetScreenId: targetScreenId,
    resolvedTargetTitle: targetScreen?.title || '',
    triggeredAt: new Date().toISOString()
  }
  knowledgePrototypeClickPath.value = [
    ...knowledgePrototypeClickPath.value.slice(-7),
    {
      id: `${Date.now()}-${hotspot.id || hotspot.label || 'hotspot'}`,
      from: fromScreen.id || '',
      fromTitle: fromScreen.title || '当前页面',
      label: hotspot.label || hotspot.name || '点击热区',
      event: hotspot.type || hotspot.event || 'click',
      to: targetScreenId || '',
      toTitle: targetScreen?.title || hotspot.targetUrl || hotspot.targetScreenId || '当前状态',
      feedback: hotspot.feedback || hotspot.result || hotspot.value || ''
    }
  ]
  if (targetScreenId) {
    selectKnowledgePrototypeScreen(targetScreenId)
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

async function selectProject(projectId) {
  if (switchingProjectId.value) return
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
        id: existing?.id || createClientId(),
        projectId: state.currentProjectId,
        title: doc.name,
        meta: 'Podcastor 产品文档 · 上传解析',
        status: '已解析',
        notes: '已自动识别为 Podcastor.ai 项目资料，并用于 AI 播客产品体验流。',
        content: doc.text
      }
      if (existing) {
        Object.assign(existing, item)
      } else {
        state.requirements.unshift(item)
      }
    })
}

function isJoggBrollRequirementContext(text = '') {
  return /jogg/i.test(text) &&
    /(b-?roll|broll|高级编辑器|media\s*模块|my\s*media|stock|pexels|pixabay|ai\s*generate)/i.test(text)
}

function shouldUsePodcastorProductFlow(docs = []) {
  const text = docs.map((doc) => `${doc.name || ''}\n${doc.text || ''}`).join('\n')
  if (isJoggBrollRequirementContext(text)) return false
  return /podcastor(?:\.ai)?/i.test(text)
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

function knowledgeManualCompletionHint(slot = '') {
  const hints = {
    背景目标: '补充业务目标、项目边界和成功标准。',
    适用场景: '补充适用/不适用场景，减少交付误判。',
    用户角色: '补充目标用户、角色权限和使用前提。',
    业务流程: '补充主流程、分支流程和跳转关系。',
    '页面/功能清单': '补充页面、模块、操作和优先级。',
    权限规则: '补充角色权限、数据范围和操作限制。',
    异常场景: '补充失败、空状态、超时、撤销和恢复规则。',
    数据字段: '补充字段、校验、默认值和来源。',
    前后端边界: '补充前端负责、后端负责和接口契约。',
    验收标准: '补充可测试的验收口径和通过条件。'
  }
  return hints[slot] || '补充该项后，设计需求文档才能进入可交付状态。'
}

function openKnowledgeManualCompletion(task = {}) {
  const slot = task.slot || task.title || ''
  openKnowledgeDeposit({
    title: slot ? `${slot}人工补全` : '人工补全',
    content: task.hint || knowledgeManualCompletionHint(slot),
    category: 'knowledge-card',
    sourceType: 'knowledge',
    manualComplements: slot ? [{ slot, status: 'pending' }] : [],
    knowledgeSlots: slot ? [slot] : [],
    relations: selectedKnowledgeNode.value?.id
      ? [{ type: 'blueprint-node', targetId: selectedKnowledgeNode.value.id }]
      : []
  })
}

function openRequirementKnowledgeDeposit(item) {
  openKnowledgeDeposit({ ...item, sourceType: 'requirements' })
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
  const basePayload = requirementConvertForm.source === 'design'
    ? buildDesignRequirementDocument({
        projectId: state.currentProjectId,
        blueprint: blueprint || designRequirementBlueprintSource.value || {},
        knowledge: currentKnowledge.value,
        title: requirementConvertForm.title.trim() || `${blueprint?.title || '需求分析画布'} · ${sourceLabel}`,
        notes: requirementConvertForm.notes || `由设计方案画布转入${sourceLabel}`
      })
    : {
        id: createClientId(),
        projectId: state.currentProjectId,
        type: 'requirements',
        title: requirementConvertForm.title.trim() || `${blueprint?.title || '需求分析画布'} · ${sourceLabel}`,
        meta: `${sourceLabel} · 设计方案转入`,
        status: '待设计',
        notes: requirementConvertForm.notes || `由设计方案画布转入${sourceLabel}`,
        content: workflowRequirementMarkdown(blueprint || {}),
        sourceType: 'workflow-blueprint'
      }
  const payload = {
    ...basePayload,
    requirementSource: requirementConvertForm.source,
    knowledgeStatus: 'pending',
    sourceAssetId: state.activeWorkflowRun?.id || workflowAnalysisResult.value?.id || '',
    uploadedAt: basePayload.uploadedAt || now,
    createdAt: basePayload.createdAt || now,
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

async function deleteRequirementDocument(item = {}) {
  if (!item.id) return
  const confirmed = await confirmProjectAssetDelete({
    title: '删除需求文档',
    itemName: item.title || '未命名需求文档',
    message: '删除后会从当前项目的需求文档列表移除，已沉淀到知识库的独立知识不会自动删除。'
  })
  if (!confirmed) return
  const result = await api.workspace.deleteMaterial(state.apiConfig, item.id)
  const data = applyApiResult(requirementStatus, result, '需求文档删除失败')
  if (!data) return
  const store = materialStore('requirements')
  const next = deleteMaterialItemsById(store, [item.id])
  store.splice(0, store.length, ...next)
  await refreshMaterialsFromBackend('requirements')
  setStatus(requirementStatus, 'success', '已删除需求文档')
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
  const confirmed = await confirmProjectAssetDelete({
    title: '批量删除资料',
    itemName: `${ids.length} 条${currentMaterialMeta.value?.title || '资料'}`,
    message: '删除后这些资料会从当前项目资产库移除，请确认已不再需要。'
  })
  if (!confirmed) return
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

async function importMaterialFiles(event, explicitType = '') {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  // Contract: freeze the entry type so requirement uploads cannot drift into knowledge during async import.
  const importType = explicitType || materialsTab.value
  const target = importType === 'requirements'
    ? requirementStatus
    : importType === 'competitors'
      ? competitorStatus
      : knowledgeStatus
  setStatus(target, 'loading', `正在导入 ${files.length} 个文件...`)
  showGlobalUploadNotice('loading', `正在上传 ${files.length} 个文件...`)
  try {
    const results = await importLocalDocuments(files, {
      projectId: state.currentProjectId,
      type: importType
    })
    const failures = results.filter((result) => !result.ok)
    const documents = results.filter((result) => result.ok).map((result) => ({
      id: result.item.id,
      name: result.item.title,
      type: result.item.notes || '',
      content: result.item.content,
      preview: result.item.preview,
      requirementSource: importType === 'requirements' ? 'product' : ''
    }))
    let importedCount = 0
    let backendImportMessage = ''
    if (documents.length) {
      const result = await api.workspace.importDocumentMaterials(state.apiConfig, {
        projectId: state.currentProjectId,
        type: importType,
        documents
      })
      const data = applyApiResult(target, result, '文件导入失败')
      if (!data) {
        const message = result.message || '文件上传失败，后端没有返回可用结果'
        showGlobalUploadNotice('failed', message)
        return
      }
      importedCount = data?.materials?.length || 0
      backendImportMessage = data?.parseJob?.summary || data?.summary?.message || ''
      await refreshMaterialsFromBackend(importType)
      await refreshParseJobs()
    }
    if (failures.length) {
      const message = importedCount
        ? `${backendImportMessage || `成功导入 ${importedCount} 个`}，失败 ${failures.length} 个：${failures.map((item) => item.name).join('、')}`
        : `上传失败：${failures.map((item) => `${item.name}（${item.error}）`).join('；')}`
      setStatus(target, importedCount ? 'success' : 'failed', message)
      if (importedCount) showGlobalUploadNotice('success', message)
      else showGlobalUploadNotice('failed', message)
    } else if (importedCount) {
      const message = backendImportMessage || `成功导入 ${importedCount} 个文件`
      setStatus(target, 'success', message)
      showGlobalUploadNotice('success', message)
    } else {
      const message = '上传失败：没有解析到可导入的文件内容'
      setStatus(target, 'failed', message)
      showGlobalUploadNotice('failed', message)
    }
  } catch (error) {
    const message = `上传失败：${error.message || '未知错误'}`
    setStatus(target, 'failed', message)
    showGlobalUploadNotice('failed', message)
  } finally {
    event.target.value = ''
  }
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

async function importWorkflowAnalysisToKnowledge() {
  const blueprint = workflowAnalysisResult.value?.blueprint || state.activeWorkflowRun?.projectBlueprint || activeProjectBlueprint.value
  const sourceAssetId = state.activeWorkflowRun?.id || blueprint?.id || workflowAnalysisResult.value?.versions?.[0]?.id || ''
  const acceptanceNodes = workflowAnalysisResult.value?.totalDesignFlow?.stageCanvases?.['acceptance-deposit']?.nodes ||
    state.activeWorkflowRun?.documentAnalysis?.totalDesignFlow?.stageCanvases?.['acceptance-deposit']?.nodes ||
    []
  Object.assign(workflowKnowledgeStatus, {
    status: 'loading',
    message: '正在沉淀到知识库...',
    count: 0
  })
  suppressNextKnowledgeOpen.value = true
  try {
    if (state.activeWorkflowRun?.id && acceptanceNodes.length) {
      const result = await api.workspace.importWorkflowAcceptanceKnowledge(state.apiConfig, state.activeWorkflowRun.id, {
        projectId: state.currentProjectId,
        sourceAssetId
      })
      const data = applyApiResult(workflowKnowledgeStatus, result, '验收沉淀导入知识库失败')
      const materials = Array.isArray(data?.materials) ? data.materials : []
      if (materials.length) state.knowledge.unshift(...materials)
      await refreshMaterialsFromBackend('knowledge')
      await refreshParseJobs()
      Object.assign(workflowKnowledgeStatus, {
        status: 'success',
        message: materials.length ? `已沉淀 ${materials.length} 条验收知识` : '该验收沉淀已导入，无需重复沉淀',
        count: materials.length
      })
      openWorkflowKnowledgeBase()
      return
    }
    const materials = await importBlueprintToKnowledge(blueprint, sourceAssetId)
    Object.assign(workflowKnowledgeStatus, {
      status: 'success',
      message: materials.length ? `已沉淀 ${materials.length} 条知识` : '该分析结果已沉淀，无需重复导入',
      count: materials.length
    })
  } catch (error) {
    Object.assign(workflowKnowledgeStatus, {
      status: 'failed',
      message: error.message || '沉淀知识库失败',
      count: 0
    })
  }
}

function openWorkflowKnowledgeBase() {
  activeView.value = 'materials'
  materialsTab.value = 'knowledge'
  knowledgeHubSection.value = 'entries'
  syncRouteToView('materials')
}

function importBlueprintAssetToKnowledge(asset) {
  void importBlueprintToKnowledge(asset?.blueprint, asset?.id)
}

async function openMaterialDetail(item) {
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
    content: materialDisplayContent(item),
    preview: item.preview || null,
    rawItem: item
  })
  showMaterialEditor.value = true
  if (!item?.id) return
  const result = await api.workspace.getMaterial(state.apiConfig, item.id)
  if (!result.ok || !result.data?.material || materialEditor.id !== item.id || !showMaterialEditor.value) return
  const detail = result.data.material
  Object.assign(materialEditor, {
    title: detail.title || materialEditor.title,
    meta: detail.meta || materialEditor.meta,
    status: detail.status || materialEditor.status,
    notes: detail.notes || materialEditor.notes,
    content: materialDisplayContent(detail) || materialEditor.content,
    preview: detail.preview || materialEditor.preview,
    rawItem: detail
  })
}

function openKnowledgeEntryDetail(entry) {
  openMaterialDetail(entry)
}

function closeMaterialEditor() {
  showMaterialEditor.value = false
  materialDocumentPreviewStatus.value = ''
  materialEditor.rawItem = null
}

function dataUrlToArrayBuffer(dataUrl = '') {
  const base64 = String(dataUrl).split(',')[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function materialPreviewUrl(url = '') {
  const raw = String(url || '')
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const baseUrl = state.apiConfig.apiBaseUrl || window.location.origin
  return `${baseUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`
}

async function materialPreviewArrayBuffer(preview = {}) {
  if (preview.dataUrl) return dataUrlToArrayBuffer(preview.dataUrl)
  const url = materialPreviewUrl(preview.url)
  if (!url) throw new Error('缺少 Word 原文件预览地址')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`预览文件读取失败：${response.status}`)
  return response.arrayBuffer()
}

async function renderMaterialDocumentPreview() {
  const target = materialDocumentPreviewRef.value
  if (!showMaterialEditor.value || !target || materialEditor.preview?.format !== 'docx') return
  target.innerHTML = ''
  materialDocumentPreviewStatus.value = '正在渲染 Word 文档...'
  try {
    await renderDocxAsync(await materialPreviewArrayBuffer(materialEditor.preview), target, null, {
      className: 'material-docx-preview',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      renderHeaders: true,
      renderFooters: true
    })
    materialDocumentPreviewStatus.value = ''
  } catch (error) {
    materialDocumentPreviewStatus.value = `Word 预览失败，已保留解析文本：${error.message || '未知错误'}`
  }
}

watch(
  () => [showMaterialEditor.value, materialEditor.preview?.dataUrl, materialEditor.preview?.url, materialEditor.preview?.format],
  async () => {
    await nextTick()
    await renderMaterialDocumentPreview()
  }
)

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
    id: materialEditor.id || createClientId(),
    projectId: state.currentProjectId,
    title: materialEditor.title,
    meta: materialEditor.meta,
    status: materialEditor.status || '已保存',
    notes: materialEditor.notes,
    content: materialEditor.content,
    preview: materialEditor.preview,
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
    const confirmed = await confirmProjectAssetDelete({
      title: `删除${currentMaterialMeta.value?.title || '资料'}`,
      itemName: materialEditor.title || '未命名资料',
      message: '删除后会从当前项目资产库移除，无法在前端直接恢复。'
    })
    if (!confirmed) return
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

function applyAuthenticatedUser(authData = {}) {
  const user = authData.user
  if (!user?.id) return
  state.users = state.users.some((item) => item.id === user.id)
    ? state.users.map((item) => item.id === user.id ? { ...item, ...user } : item)
    : [user, ...state.users]
  state.currentUserId = authData.currentUserId || user.id
  if (authData.currentProjectId) state.currentProjectId = authData.currentProjectId
}

async function loadAuthenticatedWorkspace() {
  await hydrateWorkspaceFromBackend()
  await loadModelSettings()
  await loadModelCallLogs()
  await loadSkillOrchestrationSettings()
}

async function bootstrapAuth() {
  authState.checked = false
  authState.message = ''
  const result = await api.auth.me(state.apiConfig)
  const data = result.data || {}
  if (result.ok && data.authenticated) {
    applyAuthenticatedUser(data)
    authState.authenticated = true
    authState.checked = true
    await loadAuthenticatedWorkspace()
    return
  }
  authState.authenticated = false
  authState.checked = true
  authState.status = result.ok ? 'idle' : 'failed'
  authState.message = result.ok ? '' : (result.message || '请先登录账号')
}

function toggleAuthMode() {
  authState.mode = authState.mode === 'register' ? 'login' : 'register'
  authState.status = 'idle'
  authState.message = ''
  authState.email = ''
  authState.password = ''
  authState.name = ''
  authState.passwordVisible = false
}

function showPasswordResetHint() {
  authState.status = 'failed'
  authState.message = '当前本地版本暂未接入邮箱找回密码，请联系管理员重置。'
}

async function submitAuthForm() {
  if (!authState.email.trim()) {
    authState.status = 'failed'
    authState.message = '请填写邮箱'
    return
  }
  if (!authState.password) {
    authState.status = 'failed'
    authState.message = '请填写密码'
    return
  }
  authState.loading = true
  authState.status = 'loading'
  authState.message = ''
  const payload = {
    name: '',
    email: authState.email,
    password: authState.password
  }
  const result = authState.mode === 'register'
    ? await api.auth.register(state.apiConfig, payload)
    : await api.auth.login(state.apiConfig, payload)
  const data = result.data || {}
  if (result.ok && data.authenticated) {
    applyAuthenticatedUser(data)
    authState.authenticated = true
    authState.checked = true
    authState.status = 'success'
    authState.message = ''
    authState.password = ''
    await loadAuthenticatedWorkspace()
  } else {
    authState.status = 'failed'
    authState.message = result.message || data.message || '账号操作失败'
  }
  authState.loading = false
}

async function logoutAccount() {
  authState.loading = true
  await api.auth.logout(state.apiConfig)
  authState.authenticated = false
  authState.checked = true
  authState.loading = false
  authState.status = 'idle'
  authState.message = ''
  authState.password = ''
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
  return `${baseUrl}#${workflowAnalysisRouteForRun(runId)}`
}

function openWorkflowAnalysisTab(runId) {
  const url = workflowAnalysisDeepLink(runId)
  const opened = window.open(url, '_blank')
  if (opened) opened.opener = null
  if (!opened) {
    window.location.hash = workflowAnalysisRouteForRun(runId)
    restoreWorkflowRouteFromUrl()
  }
}

function syncWorkflowAnalysisRoute(runId, mode = 'push') {
  if (typeof window === 'undefined' || !runId) return
  const route = `#${workflowAnalysisRouteForRun(runId)}`
  if (window.location.hash === route) return
  const nextUrl = `${window.location.pathname}${window.location.search}${route}`
  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl)
  } else {
    window.history.pushState(null, '', nextUrl)
  }
  refreshCurrentLocationHash()
}

function workflowAnalysisRouteForRun(runId) {
  const route = `/workflow/analysis/${encodeURIComponent(runId)}`
  const projectId = workflowProjectIdForRun(runId)
  return projectId ? projectScopedRoute(route, projectId) : route
}

function workflowProjectIdForRun(runId) {
  const run = (state.workflowRuns || []).find((item) => item.id === runId)
  if (run?.demandScope === 'non-project') return ''
  const runProjectId = run?.projectId || ''
  if (runProjectId === DEFAULT_PROJECT_ID || runProjectId === '') return state.currentProjectId
  return runProjectId || state.currentProjectId
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

function isWorkflowAnalysisPlaceholder(analysis = {}) {
  const nodes = Array.isArray(analysis?.canvas?.nodes) ? analysis.canvas.nodes : []
  if (!nodes.length) return true
  return nodes.every((node) => node?.loading === true || node?.id === 'model-generating')
}

function workflowAnalysisHasGeneratingArtifacts(analysis = {}) {
  const canvasNodes = Array.isArray(analysis?.canvas?.nodes) ? analysis.canvas.nodes : []
  const stageNodes = Object.values(analysis?.totalDesignFlow?.stageCanvases || {})
    .flatMap((stageCanvas) => Array.isArray(stageCanvas?.nodes) ? stageCanvas.nodes : [])
  return [...canvasNodes, ...stageNodes].some((node) =>
    node?.loading === true ||
    node?.refreshing === true ||
    node?.contentLoading === true ||
    node?.artifactStatus === 'generating' ||
    node?.id === 'model-generating'
  )
}

function workflowDisplayAnalysisForAnalyzingRun(run = {}) {
  const displayAnalysis = normalizeWorkflowAnalysisForDisplay(run?.documentAnalysis)
  if (displayAnalysis?.canvas && (isWorkflowAnalysisPlaceholder(displayAnalysis) || workflowAnalysisHasGeneratingArtifacts(displayAnalysis))) {
    return displayAnalysis
  }
  const failedAdvancedUxAnalysis = buildAdvancedUxFailedAnalysisResult(run)
  if (failedAdvancedUxAnalysis) return failedAdvancedUxAnalysis
  return buildWorkflowAnalysisProgressResult({ ...run, documentAnalysis: null }, { input: run?.input || '' })
}

function openAdvancedUxFailedWorkflowRun(run = {}) {
  const failedAdvancedUxAnalysis = buildAdvancedUxFailedAnalysisResult(run)
  if (!failedAdvancedUxAnalysis) return false
  const failedRun = {
    ...run,
    documentAnalysis: failedAdvancedUxAnalysis,
    status: 'failed',
    agentSessions: ensureWorkflowAnalysisAssistantMessageSession({
      run,
      analysis: failedAdvancedUxAnalysis
    })
  }
  state.activeWorkflowRun = failedRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, failedRun)
  workflowAnalysisResult.value = failedAdvancedUxAnalysis
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(failedAdvancedUxAnalysis)
  workflowCanvasLoading.value = false
  workflowFullscreenNodeId.value = ''
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  syncWorkflowActiveStageFromAnalysis(failedAdvancedUxAnalysis)
  setStatus(skillWorkbenchStatus, 'failed', workflowAdvancedUxFailureReason(run) || '高级 UX Markdown 生成失败。')
  return true
}

function isWorkflowRunAnalysisFinal(run = {}) {
  if (!run?.documentAnalysis?.canvas) return false
  if (run.status === 'analyzing') return false
  return !isWorkflowAnalysisPlaceholder(run.documentAnalysis)
}

function workflowRunHasModelAssistantReply(run = {}) {
  const session = Array.isArray(run?.agentSessions?.[WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID])
    ? run.agentSessions[WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID]
    : []
  return session.some((message) =>
    message?.role === 'assistant' &&
    message?.meta?.source === 'model' &&
    !message?.meta?.transient &&
    String(message?.content || '').trim()
  )
}

function isAdvancedUxWorkflowRun(run = {}) {
  const identifiers = [
    run.workflowId,
    run.skillId,
    run.requestedSkillId,
    run.resolvedSkillId
  ].map((item) => String(item || '').trim())
  if (identifiers.includes('advanced-ux-requirement-analysis')) return true
  return /高级\s*UX\s*需求分析/i.test(`${run.workflowName || ''} ${run.assetType || ''} ${run.displaySkillName || ''}`)
}

function isAdvancedUxMarkdownGeneratingRun(run = {}) {
  if (!isAdvancedUxWorkflowRun(run)) return false
  const analysis = run.documentAnalysis || {}
  const report = workflowAdvancedUxReportCandidateFromAnalysis(analysis) || {}
  if (String(report.markdown || '').trim()) return false
  const statusText = [
    report.status,
    analysis.status,
    run.status
  ].map((item) => String(item || '').trim()).join(' ')
  return /generating|streaming|analyzing|checking|repairing|rechecking|retrying/i.test(statusText) || workflowAnalysisHasGeneratingArtifacts(analysis || {})
}

function advancedUxGeneratingStartedAt(run = {}) {
  const analysis = run.documentAnalysis || {}
  const report = workflowAdvancedUxReportCandidateFromAnalysis(analysis) || {}
  return [
    report.startedAt,
    report.generatedAt,
    report.createdAt,
    analysis.createdAt,
    run.createdAt
  ].map((item) => Date.parse(item || '')).find((timestamp) => Number.isFinite(timestamp)) || NaN
}

function isStaleAdvancedUxGeneratingRun(run = {}) {
  if (!isAdvancedUxMarkdownGeneratingRun(run)) return false
  const startedAt = advancedUxGeneratingStartedAt(run)
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt > ADVANCED_UX_STALE_GENERATING_RESUME_MS
}

function isInterruptedAdvancedUxRun(run = {}) {
  if (!run?.id || (run.status !== 'analyzing' && run.status !== 'analyzed')) return false
  if (!isAdvancedUxWorkflowRun(run)) return false
  if (workflowRunHasModelAssistantReply(run)) return false
  if (isStaleAdvancedUxGeneratingRun(run)) return true
  const analysis = run.documentAnalysis || null
  const hasGeneratingCanvas = workflowAnalysisHasGeneratingArtifacts(analysis || {})
  const advancedUxReport = workflowAdvancedUxReportFromAnalysis(analysis || {})
  if (advancedUxReport?.markdown) return false
  return Boolean(
    String(run.input || '').trim() &&
    (!hasWorkflowAnalysisResultData(analysis) || isWorkflowAnalysisPlaceholder(analysis || {}) || hasGeneratingCanvas)
  )
}

function shouldResumeWorkflowAnalysisRun(run = null) {
  if (!run?.id) return false
  if (workflowAnalysisResumeRunIds.has(run.id)) return false
  if (isInterruptedAdvancedUxRun(run)) return true
  if (run.status !== 'analyzing') return false
  if (workflowRunHasModelAssistantReply(run)) return false
  if (hasWorkflowAnalysisResultData(run.documentAnalysis) && !isWorkflowAnalysisPlaceholder(run.documentAnalysis)) return false
  return Boolean(String(run.input || '').trim())
}

function isWorkflowAnalysisRecoverableStreamResult(result = {}) {
  if (result?.ok) return false
  const message = String(result?.message || result?.error || result?.data?.message || result?.data?.error?.message || '')
  const code = String(result?.data?.code || result?.data?.error?.code || '')
  if (result?.status === 'interrupted' || result?.data?.interrupted || code === 'SSE_DONE_MISSING') return true
  return /network error|failed to fetch|networkerror|load failed|流式请求未收到完成事件|SSE_DONE_MISSING/i.test(`${message} ${code}`)
}

function keepWorkflowAnalysisWaitingForBackend(baseRun = {}, analysis = null, message = '') {
  if (!baseRun?.id) return null
  const displayAnalysis = analysis?.canvas
    ? analysis
    : workflowDisplayAnalysisForAnalyzingRun({ ...baseRun, documentAnalysis: analysis || baseRun.documentAnalysis || null })
  const waitingRun = {
    ...baseRun,
    documentAnalysis: displayAnalysis,
    status: 'analyzing',
    updatedAt: new Date().toISOString()
  }
  state.activeWorkflowRun = waitingRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, waitingRun)
  workflowAnalysisResult.value = displayAnalysis
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(displayAnalysis)
  workflowCanvasLoading.value = true
  syncWorkflowActiveStageFromAnalysis(displayAnalysis)
  saveState(state)
  setStatus(
    skillWorkbenchStatus,
    'loading',
    message
      ? `连接已恢复为后台等待：${message}。后端仍可能在生成，完成后会自动展示结果。`
      : '后台仍在生成分析结果，完成后会自动展示。'
  )
  void persistWorkflowAnalysisBackgroundRun(waitingRun, displayAnalysis, { immediate: true, status: 'analyzing' })
  startWorkflowAnalysisDeepLinkPolling(waitingRun.id)
  return waitingRun
}

function workflowDefaultAgentNodeIdForAnalysis(analysis = null) {
  const totalFlow = normalizeWorkflowTotalFlowMeta(analysis?.totalDesignFlow || inferWorkflowTotalFlowFromAnalysis(analysis || {}))
  const stageId = normalizeWorkflowStageId(totalFlow?.currentStage || workflowActiveStageId.value || WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID)
  if (stageId && isWorkflowAgentWorkbenchStageId(stageId)) return stageId
  return analysis?.canvas?.nodes?.[0]?.id || WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID
}

function workflowAnalysisBroadcastSupported() {
  return typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function'
}

function startWorkflowAnalysisBroadcastChannel() {
  if (!workflowAnalysisBroadcastSupported() || workflowAnalysisBroadcastChannel) return
  workflowAnalysisBroadcastChannel = new window.BroadcastChannel('workflow-analysis-stream')
  workflowAnalysisBroadcastChannel.onmessage = (event) => {
    const message = event.data || {}
    if (message.type !== 'workflow-analysis-stream-event') return
    const runId = currentWorkflowAnalysisDeepLinkRunId()
    if (!runId || message.runId !== runId) return
    applyWorkflowAnalysisStreamEvent(message.event)
  }
}

function stopWorkflowAnalysisBroadcastChannel() {
  workflowAnalysisBroadcastChannel?.close?.()
  workflowAnalysisBroadcastChannel = null
}

function broadcastWorkflowAnalysisStreamEvent(runId, event) {
  if (!runId || !workflowAnalysisBroadcastChannel) return
  workflowAnalysisBroadcastChannel.postMessage({
    type: 'workflow-analysis-stream-event',
    runId,
    event
  })
}

function applyWorkflowAnalysisStreamEvent(event = {}) {
  if (event.type === 'status' && event.data?.label) {
    setStatus(skillWorkbenchStatus, 'loading', event.data.label)
    return
  }
  if (event.type !== 'artifact') return
  if (!shouldRevealWorkflowAnalysisIntermediateArtifact(event.data)) {
    workflowCanvasLoading.value = true
    setStatus(skillWorkbenchStatus, 'loading', '模型仍在生成结构化画布，完成后会一次性展示最终结果...')
    return
  }
  if (event.data?.type === 'workflow-canvas-meta') {
    workflowAnalysisResult.value = buildWorkflowAnalysisProgressResult(state.activeWorkflowRun || {}, event.data)
    workflowStageStatusMap.value = {
      ...buildWorkflowStageStatuses(workflowAnalysisResult.value?.totalDesignFlow, 'waiting'),
      ...workflowStageStatusMap.value
    }
    syncWorkflowActiveStageFromAnalysis(workflowAnalysisResult.value)
    workflowCanvasLoading.value = true
    setStatus(skillWorkbenchStatus, 'loading', `后端已返回画布骨架，准备生成 ${event.data?.total || 0} 个节点...`)
    return
  }
  if (event.data?.type === 'workflow-stage-canvas') {
    workflowAnalysisResult.value = mergeWorkflowStageCanvasEvent(
      workflowAnalysisResult.value || buildWorkflowAnalysisProgressResult(state.activeWorkflowRun || {}),
      event.data
    )
    workflowCanvasLoading.value = event.data.status !== 'completed'
    setStatus(skillWorkbenchStatus, event.data.status === 'completed' ? 'success' : 'loading', event.data.status === 'completed' ? '阶段画布已生成' : '正在生成阶段画布...')
    return
  }
  if (event.data?.type === 'workflow-node') {
    workflowAnalysisResult.value = mergeWorkflowAnalysisStreamNode(workflowAnalysisResult.value || buildWorkflowAnalysisProgressResult(state.activeWorkflowRun || {}), {
      node: event.data.node,
      index: event.data.index,
      total: event.data.total
    })
    workflowCanvasLoading.value = true
    return
  }
  if (event.data?.type === 'workflow-model-delta') {
    workflowAnalysisResult.value = mergeWorkflowAnalysisModelDelta(
      workflowAnalysisResult.value || buildWorkflowAnalysisProgressResult(state.activeWorkflowRun || {}),
      event.data
    )
    workflowAgentNodeId.value = event.data.nodeId || 'model-generating'
    workflowCanvasLoading.value = true
    return
  }
  if (event.data?.type === 'workflow-analysis' && event.data?.canvas) {
    workflowAnalysisResult.value = {
      ...(workflowAnalysisResult.value || {}),
      status: 'analyzed',
      aiSummary: event.data.aiSummary || workflowAnalysisResult.value?.aiSummary || null,
      blueprint: event.data.blueprint || workflowAnalysisResult.value?.blueprint || null,
      generation: event.data.generation || workflowAnalysisResult.value?.generation || null,
      canvas: event.data.canvas,
      totalDesignFlow: normalizeWorkflowTotalFlowMeta(event.data.totalDesignFlow || event.data.totalFlowMeta) || workflowAnalysisResult.value?.totalDesignFlow || null,
      routing: event.data.routing || workflowAnalysisResult.value?.routing || {}
    }
    workflowStageStatusMap.value = finalWorkflowStageStatuses(workflowAnalysisResult.value?.totalDesignFlow)
    workflowCanvasLoading.value = false
    workflowAgentNodeId.value = event.data.canvas?.nodes?.[0]?.id || workflowAgentNodeId.value || 'analysis'
    setStatus(skillWorkbenchStatus, 'success', '模型已生成画布，正在后台保存结果...')
  }
}

function shouldRevealWorkflowAnalysisIntermediateArtifact(data = {}) {
  const type = String(data?.type || '').trim()
  return !['workflow-node', 'workflow-model-delta'].includes(type)
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
  workflowAgentNodeId.value = workflowAgentNodeId.value || workflowDefaultAgentNodeIdForAnalysis(workflowAnalysisResult.value)
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  return true
}

function workflowRunProjectIdForCurrentRoute(run = {}) {
  const runProjectId = run?.projectId || ''
  if (!runProjectId || runProjectId === DEFAULT_PROJECT_ID) return state.currentProjectId
  return runProjectId
}

function stopWorkflowAnalysisDeepLinkPolling() {
  if (workflowAnalysisDeepLinkTimer) {
    window.clearInterval(workflowAnalysisDeepLinkTimer)
    workflowAnalysisDeepLinkTimer = null
  }
}

function startWorkflowAnalysisDeepLinkPolling(runId) {
  stopWorkflowAnalysisDeepLinkPolling()
  let failedLoads = 0
  workflowAnalysisDeepLinkTimer = window.setInterval(async () => {
    const result = await api.workspace.getWorkflowRun(state.apiConfig, runId)
    if (!result.ok || !result.data?.run) {
      failedLoads += 1
      setStatus(skillWorkbenchStatus, 'loading', `后台仍在执行分析，正在等待后端结果。已尝试恢复 ${failedLoads} 次。`)
      return
    }
    failedLoads = 0
    const run = result.data.run
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, run)
    if (isInterruptedAdvancedUxRun(run) && !workflowAnalysisResumeRunIds.has(run.id)) {
      stopWorkflowAnalysisDeepLinkPolling()
      await resumeWorkflowAnalysisRun(run)
      return
    }
    if (openAdvancedUxFailedWorkflowRun(run)) {
      stopWorkflowAnalysisDeepLinkPolling()
      return
    }
    if (isWorkflowRunAnalysisFinal(run)) {
      stopWorkflowAnalysisDeepLinkPolling()
      openWorkflowCanvasRun(run)
      return
    }
    if (hasWorkflowAnalysisResultData(run.documentAnalysis) && !isWorkflowAnalysisPlaceholder(run.documentAnalysis) && run.status !== 'analyzing') {
      stopWorkflowAnalysisDeepLinkPolling()
      openWorkflowCanvasRun({
        ...run,
        status: 'analyzed',
        documentAnalysis: {
          ...(run.documentAnalysis || {}),
          status: run.documentAnalysis?.status === 'failed' ? 'analyzed' : (run.documentAnalysis?.status || 'analyzed')
        },
        agentSessions: ensureWorkflowAnalysisAssistantMessageSession({
          run,
          analysis: run.documentAnalysis
        })
      })
      return
    }
    if (run.status === 'analyzing') {
      state.activeWorkflowRun = run
      workflowAnalysisResult.value = workflowDisplayAnalysisForAnalyzingRun(run)
      workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(workflowAnalysisResult.value || run.documentAnalysis)
      workflowCanvasLoading.value = true
      syncWorkflowActiveStageFromAnalysis(workflowAnalysisResult.value || run.documentAnalysis)
      setStatus(
        skillWorkbenchStatus,
        'loading',
        isAdvancedUxMarkdownGeneratingRun(run) ? advancedUxMarkdownGeneratingStatusText(run) : '后台正在执行分析，完成后会自动展示结果。'
      )
      return
    }
    setStatus(skillWorkbenchStatus, 'loading', '后台正在执行分析，完成后会自动展示结果。')
  }, 2000)
}

function keepWorkflowAnalysisDeepLinkWaiting(runId, fallbackRun = null, message = '后台正在执行分析，完成后会自动展示结果。') {
  const waitingRun = fallbackRun?.id
    ? fallbackRun
    : {
        id: runId,
        workflowName: '需求分析画布',
        input: '',
        status: 'analyzing',
        documentAnalysis: null,
        agentSessions: {},
        referenceFiles: {}
      }
  state.activeWorkflowRun = waitingRun
  workflowAnalysisResult.value = workflowDisplayAnalysisForAnalyzingRun(waitingRun)
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(workflowAnalysisResult.value || waitingRun.documentAnalysis)
  workflowCanvasLoading.value = true
  setStatus(skillWorkbenchStatus, 'loading', message)
  startWorkflowAnalysisDeepLinkPolling(runId)
  return false
}

async function loadWorkflowRunDetail(runId, options = {}) {
  const fallbackRun = options.fallbackRun || (state.workflowRuns || []).find((item) => item.id === runId) || null
  const fallbackHasCanvasDetail = Boolean(fallbackRun?.hasDocumentAnalysisDetail || fallbackRun?.documentAnalysisSummary?.hasCanvas)
  try {
    const result = await api.workspace.getWorkflowRun(state.apiConfig, runId)
    if (result.ok && result.data?.run) {
      const run = result.data.run
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, run)
      if (isDialogueSkillRecord(run)) {
        openDialogueSkillRecord(run)
        return true
      }
      if (openAdvancedUxFailedWorkflowRun(run)) return true
      if (isWorkflowRunAnalysisFinal(run)) {
        openWorkflowCanvasRun(run)
        return true
      }
      if (shouldResumeWorkflowAnalysisRun(run)) return resumeWorkflowAnalysisRun(run)
      if (run.status === 'analyzing') {
      state.activeWorkflowRun = run
      workflowAnalysisResult.value = workflowDisplayAnalysisForAnalyzingRun(run)
      workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(workflowAnalysisResult.value || run.documentAnalysis)
      workflowCanvasLoading.value = true
      setStatus(
        skillWorkbenchStatus,
        'loading',
        isAdvancedUxMarkdownGeneratingRun(run) ? advancedUxMarkdownGeneratingStatusText(run) : '后台正在执行分析，完成后会自动展示结果。'
      )
      startWorkflowAnalysisDeepLinkPolling(runId)
      return false
    }
      if (hasWorkflowAnalysisResultData(run.documentAnalysis) && !isWorkflowAnalysisPlaceholder(run.documentAnalysis)) {
        openWorkflowCanvasRun({
          ...run,
          status: 'analyzed',
          documentAnalysis: {
            ...(run.documentAnalysis || {}),
            status: run.documentAnalysis?.status === 'failed' ? 'analyzed' : (run.documentAnalysis?.status || 'analyzed')
          },
          agentSessions: ensureWorkflowAnalysisAssistantMessageSession({
            run,
            analysis: run.documentAnalysis
          })
        })
        return true
      }
    }
    if (isDialogueSkillRecord(fallbackRun)) {
      openDialogueSkillRecord(fallbackRun)
      return true
    }
    if (openAdvancedUxFailedWorkflowRun(fallbackRun)) return true
    if (isWorkflowRunAnalysisFinal(fallbackRun)) {
      openWorkflowCanvasRun(fallbackRun)
      return true
    }
    if (shouldResumeWorkflowAnalysisRun(fallbackRun)) return resumeWorkflowAnalysisRun(fallbackRun)
    if (fallbackRun?.status === 'analyzing') {
      state.activeWorkflowRun = fallbackRun
      workflowAnalysisResult.value = workflowDisplayAnalysisForAnalyzingRun(fallbackRun)
      workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(workflowAnalysisResult.value || fallbackRun.documentAnalysis)
      workflowCanvasLoading.value = true
      setStatus(
        skillWorkbenchStatus,
        'loading',
        isAdvancedUxMarkdownGeneratingRun(fallbackRun) ? advancedUxMarkdownGeneratingStatusText(fallbackRun) : '后台正在执行分析，完成后会自动展示结果。'
      )
      startWorkflowAnalysisDeepLinkPolling(runId)
      return false
    }
    if (hasWorkflowAnalysisResultData(fallbackRun?.documentAnalysis) && !isWorkflowAnalysisPlaceholder(fallbackRun.documentAnalysis)) {
      openWorkflowCanvasRun({
        ...fallbackRun,
        status: 'analyzed',
        documentAnalysis: {
          ...(fallbackRun.documentAnalysis || {}),
          status: fallbackRun.documentAnalysis?.status === 'failed' ? 'analyzed' : (fallbackRun.documentAnalysis?.status || 'analyzed')
        },
        agentSessions: ensureWorkflowAnalysisAssistantMessageSession({
          run: fallbackRun,
          analysis: fallbackRun.documentAnalysis
        })
      })
      return true
    }
    if (fallbackHasCanvasDetail) {
      return keepWorkflowAnalysisDeepLinkWaiting(runId, fallbackRun)
    }
    return keepWorkflowAnalysisDeepLinkWaiting(runId, fallbackRun, '后台正在执行分析，完成后会自动展示结果。')
  } catch (error) {
    if (isDialogueSkillRecord(fallbackRun)) {
      openDialogueSkillRecord(fallbackRun)
      return true
    }
    if (isWorkflowRunAnalysisFinal(fallbackRun)) {
      openWorkflowCanvasRun(fallbackRun)
      return true
    }
    if (fallbackHasCanvasDetail) {
      return keepWorkflowAnalysisDeepLinkWaiting(runId, fallbackRun)
    }
    return keepWorkflowAnalysisDeepLinkWaiting(runId, fallbackRun, '后台正在执行分析，完成后会自动展示结果。')
  }
}

async function resumeWorkflowAnalysisRun(run = {}) {
  const baseRun = {
    ...run,
    agentSessions: ensureWorkflowImmediateAssistantMessageSession({
      run,
      input: run.input,
      sessions: run.agentSessions || {}
    }),
    referenceFiles: run.referenceFiles || {}
  }
  workflowAnalysisResumeRunIds.add(baseRun.id)
  state.activeWorkflowRun = baseRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, baseRun)
  workflowCanvasLoading.value = true
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(baseRun.documentAnalysis)
  let backgroundAnalysisResult = buildWorkflowAnalysisProgressResult(baseRun, { input: baseRun.input })
  workflowAnalysisResult.value = backgroundAnalysisResult
  syncWorkflowActiveStageFromAnalysis(workflowAnalysisResult.value)
  setStatus(skillWorkbenchStatus, 'loading', '正在恢复分析任务，并把上一页输入发送给后端模型...')
  await persistWorkflowAnalysisBackgroundRun(baseRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })

  let workingRun = baseRun
  const isViewingAnalysisRun = () => currentWorkflowAnalysisDeepLinkRunId() === baseRun.id
  const projectForRun = (state.projects || []).find((project) => project.id === baseRun.projectId) || workflowAnalysisProject.value || {}
  const documents = Object.values(baseRun.referenceFiles || {}).flat()
    .filter((file) => file && typeof file === 'object' && !Array.isArray(file))
  const analysisPayload = {
    requestId: baseRun.clientRequestId || createClientId(),
    analysisRunId: baseRun.id,
    demandScope: baseRun.demandScope || workflowForm.demandScope,
    skillSelectionMode: isTotalFlowLikeWorkflowId(baseRun.skillId) || isTotalFlowLikeWorkflowId(baseRun.requestedSkillId) ? 'auto' : 'manual',
    skillId: baseRun.skillId || baseRun.requestedSkillId || 'total-design-flow',
    requestedSkillId: baseRun.requestedSkillId || baseRun.skillId || 'total-design-flow',
    projectId: baseRun.projectId || '',
    project: projectForRun,
    input: baseRun.input,
    documents,
    webSearchEnabled: workflowAgentWebSearchEnabled.value,
    timeoutMs: 0,
    generationTimeoutMs: 0
  }
  const streamController = new AbortController()
  workflowAnalysisStreamController.value?.abort?.()
  workflowAnalysisStreamController.value = streamController
  let keepResumeGuard = false
  try {
    const result = await api.uploads.analyzeDocumentsStream(state.apiConfig, analysisPayload, {
      timeoutMs: workflowAnalysisRequestTimeoutMs(),
      signal: streamController.signal,
      onEvent: (event) => {
        broadcastWorkflowAnalysisStreamEvent(baseRun.id, event)
        if (event.type === 'status' && event.data?.label && isViewingAnalysisRun()) {
          setStatus(skillWorkbenchStatus, 'loading', event.data.label)
        }
        if (event.type === 'artifact' && !shouldRevealWorkflowAnalysisIntermediateArtifact(event.data)) {
          void persistWorkflowAnalysisBackgroundRun(workingRun, backgroundAnalysisResult)
          if (isViewingAnalysisRun()) {
            setStatus(skillWorkbenchStatus, 'loading', '模型仍在生成结构化画布，完成后会一次性展示最终结果...')
          }
          return
        }
        if (event.type === 'artifact' && event.data?.type === 'workflow-canvas-meta') {
          backgroundAnalysisResult = buildWorkflowAnalysisProgressResult(workingRun, event.data)
          if (isViewingAnalysisRun()) workflowAnalysisResult.value = backgroundAnalysisResult
          void persistWorkflowAnalysisBackgroundRun(workingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
        } else if (event.type === 'artifact' && event.data?.type === 'workflow-stage-canvas') {
          backgroundAnalysisResult = mergeWorkflowStageCanvasEvent(
            backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(workingRun),
            event.data
          )
          if (isViewingAnalysisRun()) workflowAnalysisResult.value = backgroundAnalysisResult
          void persistWorkflowAnalysisBackgroundRun(workingRun, backgroundAnalysisResult)
        } else if (event.type === 'artifact' && event.data?.type === 'workflow-analysis' && event.data?.canvas) {
          backgroundAnalysisResult = {
            ...(backgroundAnalysisResult || {}),
            status: 'analyzed',
            aiSummary: event.data.aiSummary || backgroundAnalysisResult?.aiSummary || null,
            blueprint: event.data.blueprint || backgroundAnalysisResult?.blueprint || null,
            generation: event.data.generation || backgroundAnalysisResult?.generation || null,
            canvas: event.data.canvas,
            totalDesignFlow: normalizeWorkflowTotalFlowMeta(event.data.totalDesignFlow || event.data.totalFlowMeta) || backgroundAnalysisResult?.totalDesignFlow || null,
            routing: event.data.routing || backgroundAnalysisResult?.routing || {}
          }
          if (isViewingAnalysisRun()) workflowAnalysisResult.value = backgroundAnalysisResult
          void persistWorkflowAnalysisBackgroundRun(workingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzed' })
        }
      }
    })
    if (workflowAnalysisStreamController.value === streamController) workflowAnalysisStreamController.value = null
    if (result.status === 'cancelled') return false
    if (!result.ok || !hasWorkflowAnalysisResultData(result.data)) {
      if (isWorkflowAnalysisRecoverableStreamResult(result)) {
        keepResumeGuard = true
        keepWorkflowAnalysisWaitingForBackend(baseRun, backgroundAnalysisResult, result.message || result.error || '流式连接中断')
        return false
      }
      failWorkflowAnalysisDeepLink(baseRun.id, result.message || result.error || '恢复分析失败，请检查后端服务。')
      return false
    }
    const nextRun = {
      ...workingRun,
      workflowId: result.data.routing?.resolvedSkillId || baseRun.workflowId || baseRun.skillId || 'total-design-flow',
      workflowName: baseRun.workflowName || '总流程',
      assetType: baseRun.assetType || '设计方案总流程',
      projectBlueprint: result.data.blueprint || null,
      documentAnalysis: result.data,
      status: 'analyzed',
      updatedAt: new Date().toISOString(),
      agentSessions: workingRun.agentSessions || {},
      referenceFiles: workingRun.referenceFiles || {}
    }
    if (!workflowRunHasModelAssistantReply(nextRun)) {
      const report = result.data?.advancedUxReport || null
      const streamedAnalysisRun = report?.markdown
        ? upsertAdvancedUxMarkdownReportAssistantMessage(baseRun.id, result.data.advancedUxReport) || nextRun
        : upsertWorkflowAnalysisStreamAssistantMessage(baseRun.id, {
            text: workflowModelReplyText(result.data),
            delta: workflowModelReplyText(result.data)
          }, { status: 'success', statusLabel: workflowAgentStatusLabel('success') }) || nextRun
      nextRun.agentSessions = streamedAnalysisRun.agentSessions || nextRun.agentSessions
      if (!report?.markdown) {
        nextRun.agentSessions = ensureWorkflowAnalysisAssistantMessageSession({
          run: nextRun,
          analysis: result.data
        })
      }
    }
    const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, nextRun)
    const savedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
    state.activeWorkflowRun = savedRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, savedRun)
    workflowAnalysisResult.value = normalizeWorkflowAnalysisForDisplay(savedRun.documentAnalysis)
    workflowStageStatusMap.value = finalWorkflowStageStatuses(workflowAnalysisResult.value?.totalDesignFlow)
    syncWorkflowActiveStageFromAnalysis(workflowAnalysisResult.value)
    workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(workflowAnalysisResult.value)
    workflowCanvasLoading.value = false
    saveState(state)
    setStatus(skillWorkbenchStatus, 'success', '已恢复并完成分析')
    return true
  } catch (error) {
    if (workflowAnalysisStreamController.value === streamController) workflowAnalysisStreamController.value = null
    if (isWorkflowAnalysisRecoverableStreamResult({ status: 'failed', message: error.message })) {
      keepResumeGuard = true
      keepWorkflowAnalysisWaitingForBackend(baseRun, backgroundAnalysisResult, error.message || '流式连接中断')
      return false
    }
    failWorkflowAnalysisDeepLink(baseRun.id, error.message || '恢复分析失败，请检查后端服务。')
    return false
  } finally {
    if (!keepResumeGuard) workflowAnalysisResumeRunIds.delete(baseRun.id)
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
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(failureAnalysis)
  workflowFullscreenNodeId.value = ''
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  setStatus(skillWorkbenchStatus, 'failed', message)
  void persistFailedWorkflowAnalysisRun(failedRun)
}

async function persistFailedWorkflowAnalysisRun(failedRun = {}) {
  if (!failedRun?.id) return null
  try {
    const result = await api.workspace.createWorkflowRun(state.apiConfig, failedRun)
    const persisted = result.ok && result.data?.run ? result.data.run : failedRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persisted)
    if (state.activeWorkflowRun?.id === persisted.id) state.activeWorkflowRun = persisted
    saveState(state)
    return persisted
  } catch (error) {
    void error
    return null
  }
}

function restoreWorkflowRouteFromUrl(projectRoute = null) {
  const route = projectRoute?.route || ''
  if (projectRoute?.projectId) applyProjectIdFromRoute(projectRoute.projectId)
  if (window.location.hash === '#/workflow' || route === '/workflow' || route === '/design') {
    activeView.value = 'workflow'
    workflowRoute.value = 'entry'
    setWorkflowAgentDisplayMode('hidden')
    workflowFullscreenNodeId.value = ''
    workflowCanvasLoading.value = false
    stopWorkflowAnalysisDeepLinkPolling()
    return true
  }
  return restoreWorkflowAnalysisFromUrl(projectRoute)
}

function workflowCanvasRestoreCandidateRun() {
  const routeRunId = currentWorkflowAnalysisDeepLinkRunId()
  const candidates = [
    state.activeWorkflowRun,
    ...(Array.isArray(state.workflowRuns) ? state.workflowRuns : [])
  ].filter((run, index, list) => {
    if (!run?.id) return false
    if (routeRunId && run.id !== routeRunId) return false
    return list.findIndex((item) => item?.id === run.id) === index &&
      run.status !== 'analyzing' &&
      (isWorkflowRunAnalysisFinal(run) || run.hasDocumentAnalysisDetail || run.documentAnalysisSummary?.hasCanvas)
  })
  return candidates
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null
}

function restoreActiveWorkflowCanvasIfAvailable() {
  const activeRun = workflowCanvasRestoreCandidateRun() || state.activeWorkflowRun || null
  const displayAnalysis = normalizeWorkflowAnalysisForDisplay(activeRun?.documentAnalysis)
  if (!activeRun || !isWorkflowRunAnalysisFinal(activeRun) || !displayAnalysis?.canvas) return false
  stopWorkflowAnalysisDeepLinkPolling()
  workflowCanvasLoading.value = false
  workflowAnalysisResult.value = displayAnalysis
  workflowStageStatusMap.value = finalWorkflowStageStatuses(displayAnalysis.totalDesignFlow)
  syncWorkflowActiveStageFromAnalysis(displayAnalysis)
  workflowAgentNodeId.value = displayAnalysis.totalDesignFlow?.stageCanvases?.[workflowActiveStageId.value]?.nodes?.[0]?.id ||
    displayAnalysis.canvas?.nodes?.[0]?.id ||
    'analysis'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  return true
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
  const displayAnalysis = run?.status === 'analyzing'
    ? workflowDisplayAnalysisForAnalyzingRun(run)
    : normalizeWorkflowAnalysisForDisplay(run?.documentAnalysis)
  workflowAnalysisResult.value = displayAnalysis?.canvas ? displayAnalysis : null
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(displayAnalysis || run?.documentAnalysis)
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
  setWorkflowAgentDisplayMode('hidden')
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
  const hydratedProjectRoute = parseProjectScopedHash(window.location.hash)
  const backendUsers = result.data.users || []
  const backendProjects = result.data.projects || []
  const routeProjectId = accountProjectIdFromRoute(
    hydratedProjectRoute?.projectId,
    backendProjects,
    result.data.currentUserId || state.currentUserId
  )
  const remoteMaterials = Array.isArray(result.data.materials) ? result.data.materials : []
  const remoteRestoredPages = Array.isArray(result.data.restoredPages) ? result.data.restoredPages : []
  const normalizedFactoryWorkspace = normalizeFactoryWorkspace({
    restoredPages: remoteRestoredPages
  }, { previousRestoredPages: state.restoredPages })
  const remoteWorkflowRuns = Array.isArray(result.data.workflowRuns) ? result.data.workflowRuns : []
  const activeWorkflowRun = state.activeWorkflowRun && remoteWorkflowRuns.some((run) => run?.id === state.activeWorkflowRun?.id)
    ? state.activeWorkflowRun
    : null
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
    restoredPages: normalizedFactoryWorkspace.restoredPages,
    workflowRuns: remoteWorkflowRuns,
    activeWorkflowRun
  }, { includeDefaultProject: false }))
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
  const deepLinkWorkflowRun = workflowDeepLinkRunId
    ? (next.workflowRuns || []).find((item) => item?.id === workflowDeepLinkRunId)
    : null
  applyProjectSelection({
    currentProjectId: next.currentProjectId,
    activeWorkflowRun: deepLinkWorkflowRun || next.activeWorkflowRun,
    selectedAssetId: next.selectedAssetId,
    selectedRestoredPageId: next.selectedRestoredPageId
  })
  if (workflowDeepLinkRunId) {
    if (deepLinkWorkflowRun) {
      state.activeWorkflowRun = deepLinkWorkflowRun
      const displayAnalysis = normalizeWorkflowAnalysisForDisplay(deepLinkWorkflowRun.documentAnalysis)
      if (displayAnalysis?.canvas) {
        workflowAnalysisResult.value = displayAnalysis
      }
    }
    restoreWorkflowAnalysisFromUrl(parseProjectScopedHash(window.location.hash))
    restoreWorkflowDeepLinkFromCurrentHashSoon()
    return
  }
  if (hydratedProjectRoute?.route === '/workflow' || hydratedProjectRoute?.route === '/design') return
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
  setStatus(captureStatus, 'success', `${sourceLabel}完成：${nodeCount} 个 DOM 节点、${componentCount} 个组件样本${captureDurationLabel(capture.timing || capture.raw)}`)
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

async function saveBrowserSessionState() {
  if (!captureForm.sessionId) {
    setStatus(browserStateStatus, 'failed', '请先打开授权浏览器并完成登录')
    return
  }
  setStatus(browserStateStatus, 'loading', '正在保存登录态...')
  const result = await api.capture.saveBrowserSessionState(state.apiConfig, {
    projectId: state.currentProjectId,
    sessionId: captureForm.sessionId,
    url: browserPreview.url || captureForm.url,
    stateKey: captureForm.storageStateKey
  })
  const data = applyApiResult(browserStateStatus, result, '登录态保存失败')
  if (!data) return
  captureForm.storageStateKey = data.stateKey
  captureForm.authMode = 'saved-state'
  selectedCaptureRecoveryFlowId.value = 'saved-state'
  setStatus(browserStateStatus, 'success', `登录态已保存：${data.siteHost || data.stateKey}`, data)
  await loadBrowserSessionStates({ silent: true })
}

async function loadBrowserSessionStates(options = {}) {
  if (!options.silent) setStatus(browserStateStatus, 'loading', '正在读取已保存登录态...')
  const result = await api.capture.listBrowserSessionStates(state.apiConfig, {
    projectId: state.currentProjectId
  })
  const data = options.silent
    ? (result.ok ? result.data : null)
    : applyApiResult(browserStateStatus, result, '已保存登录态读取失败')
  if (!data) return
  browserSavedStates.value = Array.isArray(data.states) ? data.states : []
  if (!captureForm.storageStateKey && browserSavedStates.value.length) {
    captureForm.storageStateKey = browserSavedStates.value[0].stateKey || ''
  }
  if (!options.silent) {
    setStatus(browserStateStatus, 'success', browserSavedStates.value.length ? `已找到 ${browserSavedStates.value.length} 个保存登录态` : '还没有保存的登录态')
  }
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
      updateFactoryTask(task.id, {
        status: 'success',
        message: data.pages?.[0]?.summary || '网页快照采集完成',
        taskId: data.taskId || data.id || ''
      })
      if (data.status === 'partial') {
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
	        replaceStaticHtmlPreviewRoute(previewWindow, projectScopedRoute(`/assets/${encodeURIComponent(restoredPage.id)}/preview`, restoredPage.projectId || state.currentProjectId))
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
  await applyWebsiteImportResultToWorkspace(data, '网站知识')
}

async function applyWebsiteImportResultToWorkspace(data, sourceLabel = '网站知识') {
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
      `已导入 ${data.materials.length} 条${sourceLabel}${data?.blueprintMaterials?.length ? `、${data.blueprintMaterials.length} 条蓝图知识` : ''}${blueprintCopy}${prototypeCopy}：${data.summary?.importType || '网站页面'}${parseJob ? `，解析任务 ${parseJob.status}` : ''}`
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

const PROJECT_PACKAGE_TEXT_FILE_PATTERN = /\.(json|md|mdx|vue|jsx|tsx|js|ts|css|scss|less|sass|html|ya?ml|webmanifest|svg)$/i
const PROJECT_PACKAGE_IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif|ico)$/i
const PROJECT_PACKAGE_IGNORED_PATTERN = /(^|\/)(node_modules|dist|build|\.git|coverage)\//
const PROJECT_PACKAGE_MAX_FILES = 4000
const PROJECT_PACKAGE_MAX_FILE_BYTES = 180000
const PROJECT_PACKAGE_MAX_IMAGE_BYTES = 1600000

function isProjectPackageEnvExample(path = '') {
  return /(^|\/)\.env\.example$/i.test(path || '')
}

function projectPackageImageMimeType(path = '', bytes = null) {
  if (bytes?.[0] === 0x89 && bytes?.[1] === 0x50 && bytes?.[2] === 0x4e && bytes?.[3] === 0x47) return 'image/png'
  if (bytes?.[0] === 0xff && bytes?.[1] === 0xd8 && bytes?.[2] === 0xff) return 'image/jpeg'
  if (bytes?.[0] === 0x47 && bytes?.[1] === 0x49 && bytes?.[2] === 0x46) return 'image/gif'
  if (
    bytes?.[0] === 0x52 &&
    bytes?.[1] === 0x49 &&
    bytes?.[2] === 0x46 &&
    bytes?.[3] === 0x46 &&
    bytes?.[8] === 0x57 &&
    bytes?.[9] === 0x45 &&
    bytes?.[10] === 0x42 &&
    bytes?.[11] === 0x50
  ) return 'image/webp'
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.webp$/i.test(path)) return 'image/webp'
  if (/\.gif$/i.test(path)) return 'image/gif'
  if (/\.ico$/i.test(path)) return 'image/x-icon'
  return 'application/octet-stream'
}

async function projectPackageFilesFromZip(file) {
  if (!/\.zip$/i.test(file.name || '')) return []
  const zip = await JSZip.loadAsync(file)
  const entries = Object.values(zip.files)
    .filter((entry) =>
      !entry.dir &&
      (
        PROJECT_PACKAGE_TEXT_FILE_PATTERN.test(entry.name || '') ||
        PROJECT_PACKAGE_IMAGE_FILE_PATTERN.test(entry.name || '') ||
        isProjectPackageEnvExample(entry.name || '')
      ) &&
      !PROJECT_PACKAGE_IGNORED_PATTERN.test(entry.name || '') &&
      (!/(^|\/)\.env/.test(entry.name || '') || isProjectPackageEnvExample(entry.name || ''))
    )
    .slice(0, PROJECT_PACKAGE_MAX_FILES)
  const files = []
  for (const entry of entries) {
    const isImage = PROJECT_PACKAGE_IMAGE_FILE_PATTERN.test(entry.name || '')
    if (isImage && Number(entry._data?.uncompressedSize || 0) > PROJECT_PACKAGE_MAX_IMAGE_BYTES) continue
    const content = isImage
      ? await (async () => {
          const bytes = await entry.async('uint8array')
          const mimeType = projectPackageImageMimeType(entry.name, bytes)
          const base64 = await entry.async('base64')
          return `data:${mimeType};base64,${base64}`
        })()
      : await entry.async('string')
    files.push({
      path: entry.name,
      content: isImage ? content : content.slice(0, PROJECT_PACKAGE_MAX_FILE_BYTES)
    })
  }
  return files
}

async function selectProjectPackageFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  projectPackageImportForm.fileName = file.name
  projectPackageImportForm.fileSize = file.size
  projectPackageImportForm.files = []
  if (!/\.zip$/i.test(file.name || '')) {
    setStatus(knowledgeStatus, 'failed', '当前仅支持读取 zip 项目包，tar.gz 会先创建待解析任务')
    return
  }
  try {
    setStatus(knowledgeStatus, 'loading', '正在读取项目包文件清单...')
    projectPackageImportForm.files = await projectPackageFilesFromZip(file)
    setStatus(knowledgeStatus, 'success', `已读取 ${projectPackageImportForm.files.length} 个可分析文本文件`)
  } catch (error) {
    projectPackageImportForm.files = []
    setStatus(knowledgeStatus, 'failed', `项目包读取失败：${error.message || '请重新选择 zip 文件'}`)
  }
}

function upsertWorkspaceAssetFromImport(asset) {
  if (!asset?.id) return null
  const existingAssetIndex = state.assets.findIndex((item) => item.id === asset.id)
  if (existingAssetIndex >= 0) state.assets.splice(existingAssetIndex, 1, asset)
  else state.assets.unshift(asset)
  return asset
}

async function submitProjectPackageImportAndClose() {
  if (!projectPackageImportForm.fileName) {
    setStatus(knowledgeStatus, 'failed', '请先选择项目包文件')
    return
  }
  closeMaterialTool()
  setStatus(knowledgeStatus, 'loading', '项目包解析中：正在创建静态分析任务...')
  const result = await api.knowledge.fromProjectPackage(state.apiConfig, {
    projectId: state.currentProjectId,
    fileName: projectPackageImportForm.fileName,
    fileSize: projectPackageImportForm.fileSize,
    files: projectPackageImportForm.files,
    scopes: projectPackageImportForm.scopes,
    outputs: projectPackageImportForm.outputs
  })
  const data = applyApiResult(knowledgeStatus, result, '项目包导入失败')
  if (data?.materials?.length) {
    state.knowledge.unshift(...data.materials)
    if (data?.blueprintAsset) {
      upsertWorkspaceAssetFromImport(data.blueprintAsset)
      selectedAssetId.value = data.blueprintAsset.id
    }
    if (data?.prototypeAsset) upsertWorkspaceAssetFromImport(data.prototypeAsset)
    knowledgeHubSection.value = data?.prototypeAsset ? 'prototype' : data?.blueprintAsset ? 'structure' : 'entries'
    await refreshMaterialsFromBackend('knowledge')
    await refreshParseJobs()
    setStatus(
      knowledgeStatus,
      'success',
      `已从项目包导入 ${data.materials.length} 条知识${data?.blueprintAsset ? '，已生成结构树/流程图' : ''}${data?.prototypeAsset ? '，已生成交互 Demo' : ''}`
    )
  }
}

async function startProjectPackageRuntimeAndImport() {
  if (!projectPackageImportForm.fileName) {
    setStatus(knowledgeStatus, 'failed', '请先选择项目包文件')
    return
  }
  if (!projectPackageImportForm.files.length) {
    setStatus(knowledgeStatus, 'failed', '项目包里没有可运行文件，请选择包含 package.json 的 zip')
    return
  }
  closeMaterialTool()
  projectRuntimePreview.status = 'starting'
  projectRuntimePreview.message = '正在安装依赖并启动外部项目预览...'
  setStatus(knowledgeStatus, 'loading', projectRuntimePreview.message)
  const startResult = await api.workspace.startProjectRuntime(state.apiConfig, {
    projectId: state.currentProjectId,
    fileName: projectPackageImportForm.fileName,
    files: projectPackageImportForm.files
  })
  const started = applyApiResult(knowledgeStatus, startResult, '项目预览启动失败')
  const runtime = started?.runtime
  if (!runtime?.url) {
    projectRuntimePreview.status = 'failed'
    projectRuntimePreview.message = '项目预览启动失败，未返回可采集 URL'
    return
  }

  projectRuntimePreview.runtimeId = runtime.id || ''
  projectRuntimePreview.url = runtime.url
  projectRuntimePreview.status = runtime.status || 'running'
  projectRuntimePreview.logs = runtime.logs || []
  projectRuntimePreview.message = `已启动预览：${runtime.url}，正在采集真实页面链路...`
  websiteImportForm.url = runtime.url
  setStatus(knowledgeStatus, 'loading', projectRuntimePreview.message)

  const importResult = await api.workspace.importWebsiteMaterials(state.apiConfig, {
    projectId: state.currentProjectId,
    importType: 'project-runtime',
    scope: 'same-domain',
    generateBlueprint: true,
    url: runtime.url
  })
  const imported = applyApiResult(knowledgeStatus, importResult, '项目运行预览采集失败')
  await applyWebsiteImportResultToWorkspace(imported, '运行项目知识')
  if (imported?.prototypeAsset) {
    knowledgeHubSection.value = 'prototype'
  }
}

async function stopProjectRuntimePreview() {
  if (!projectRuntimePreview.runtimeId) return
  const result = await api.workspace.stopProjectRuntime(state.apiConfig, {
    runtimeId: projectRuntimePreview.runtimeId
  })
  const data = applyApiResult(knowledgeStatus, result, '停止项目预览失败')
  if (data?.runtime) {
    projectRuntimePreview.runtimeId = ''
    projectRuntimePreview.status = data.runtime.status || 'stopped'
    projectRuntimePreview.message = '外部项目预览已停止'
  }
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
      id: createClientId(),
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
    state.requirements.unshift({ id: createClientId(), projectId: state.currentProjectId, title: `${pmForm.skill} PRD`, meta: 'AI 生成 · v1.0', status: '已生成' })
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
    id: draft.source === 'system' ? createClientId() : draft.id,
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
    id: createClientId(),
    name: '我的新 Skill',
    description: '',
    category: '自定义',
    source: 'user',
    visibility: 'project',
    projectId: state.currentProjectId,
    status: 'active',
    inputFields: [
      {
        id: createClientId(),
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
    id: createClientId(),
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
  const editable = skill.source === 'system' ? { ...skill, id: createClientId(), name: `${skill.name} 副本`, source: 'user' } : skill
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
      id: createClientId(),
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
    id: data?.draft?.id || createClientId(),
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
    id: source.id || skillEditor.draft.id || createClientId(),
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
  setStatus(skillWorkbenchStatus, 'loading', '正在读取需求素材...')
  clearWorkflowUploadedDocumentsForNewBatch()
  const localDocs = []
  for (const file of files) {
    try {
      const isImage = /^image\//.test(file.type)
      const text = isImage ? '' : await extractDocumentText(file)
      localDocs.push({
        id: createClientId(),
        name: file.name,
        type: file.type || file.name.split('.').pop()?.toUpperCase() || 'FILE',
        status: isImage ? '待视觉解析' : text ? '已读取' : '待后端解析',
        text: isImage ? `图片素材已上传：${file.name}。请在需求分析中作为视觉参考素材，关注图片内容、风格、主体和可生成页面/视频/海报方向。` : text,
        kind: isImage ? 'image' : 'document'
      })
    } catch (error) {
      localDocs.push({
        id: createClientId(),
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
    documents: localDocs
      .filter((doc) => doc.kind !== 'image')
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        content: doc.text
      }))
  })
  if (uploadResult.ok && Array.isArray(uploadResult.data?.documents)) {
    const parsedDocs = uploadResult.data.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      status: doc.status === 'parsed' ? '已读取' : '读取失败',
      text: doc.text || doc.reason || '',
      recoveryActions: doc.recoveryActions || []
    }))
    docs = [
      ...localDocs.filter((doc) => doc.kind === 'image'),
      ...parsedDocs
    ]
  }
  workflowForm.documents = docs
  const readableText = docs
    .filter((doc) => doc.status === '已读取' && doc.text)
    .map((doc) => `【上传文档：${doc.name}】\n${doc.text}`)
    .join('\n\n')
  if (readableText) {
    workflowForm.input = workflowForm.input.trim()
      ? `${workflowForm.input.trim()}\n\n${readableText}`
      : readableText
  }
  const isPodcastor = shouldUsePodcastorProductFlow(docs)
  const canAutoSwitchPodcastorSkill = workflowForm.selectedWorkflowId === 'auto'
  if (isPodcastor && canAutoSwitchPodcastorSkill) {
    ensurePodcastorProject()
    savePodcastorRequirementDocs(docs)
    workflowForm.selectedWorkflowId = 'podcastor-product-flow'
  }
  const failedCount = docs.filter((doc) => doc.status !== '已读取').length
  const message = isPodcastor && canAutoSwitchPodcastorSkill
    ? `已识别 Podcastor.ai 文档，已切换项目并进入 AI 播客产品体验流`
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

function fillWorkflowPromptExample(value = '') {
  workflowForm.input = String(value || '').trim()
}

function removeWorkflowUploadedDocumentBlocks(input = '') {
  return String(input || '')
    .split(/\n{2,}/)
    .filter((block) => !/^【上传文档：/.test(block.trim()))
    .join('\n\n')
    .trim()
}

function clearWorkflowUploadedDocumentsForNewBatch() {
  workflowForm.documents = []
  workflowForm.input = removeWorkflowUploadedDocumentBlocks(workflowForm.input)
}

function workflowEntryPayloadSnapshot() {
  return {
    input: String(workflowForm.input || '').trim(),
    documents: Array.isArray(workflowForm.documents)
      ? workflowForm.documents.map((doc) => ({ ...doc }))
      : []
  }
}

function workflowDefaultPrompt() {
  return workflowPromptExamples.value[0]?.value || workflowPromptExamplePresets.default[0]?.value || '做一个茶饮点单小程序'
}

function clearWorkflowEntryDocumentsAfterRun(snapshot = {}) {
  const snapshotDocuments = Array.isArray(snapshot.documents) ? snapshot.documents : []
  if (!snapshotDocuments.length) return
  const sameDocumentBatch = workflowForm.documents.length === snapshotDocuments.length &&
    workflowForm.documents.every((doc, index) => doc?.id && doc.id === snapshotDocuments[index]?.id)
  if (!sameDocumentBatch) return
  workflowForm.documents = []
  workflowForm.input = removeWorkflowUploadedDocumentBlocks(workflowForm.input)
}

function clearWorkflowRequirementFiles() {
  clearWorkflowUploadedDocumentsForNewBatch()
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
  return 0
}

function imageToHtmlRequestTimeoutMs() {
  return 0
}

function workflowAgentRequestTimeoutMs() {
  return 0
}

function workflowAgentProviderErrorDetail(result = {}) {
  return result?.data?.error ||
    result?.data?.data?.error ||
    result?.error ||
    {}
}

function workflowAgentFailedMessage(result = {}) {
  const providerError = workflowAgentProviderErrorDetail(result)
  if (providerError?.message) return providerError.message
  if (result?.data?.message) return result.data.message
  return result?.message || result?.error || '后端没有返回 Agent 结果，后端响应缺少 assistantMessage'
}

function isWorkflowAgentNetworkFailure(result = {}) {
  const message = workflowAgentFailedMessage(result)
  return /Failed to fetch|NetworkError|Load failed|网络请求失败/i.test(String(message || ''))
}

function workflowAgentFailureView(result = {}) {
  const message = workflowAgentFailedMessage(result) || '后端没有返回 Agent 结果，后端响应缺少 assistantMessage'
  const providerError = workflowAgentProviderErrorDetail(result)
  const code = providerError?.code || result?.status || 'AGENT_RESPONSE_MISSING'
  if (isWorkflowAgentNetworkFailure(result)) {
    return {
      content: '生成失败，请重试。',
      message,
      code: 'AGENT_API_UNREACHABLE',
      recoveryActions: ['重试']
    }
  }
  if (code === 'LLM_PROVIDER_UNCONFIGURED') {
    return {
      content: '生成失败，请重试。',
      message,
      code,
      recoveryActions: ['重试']
    }
  }
  if (code === 'LLM_MODEL_NOT_FOUND') {
    return {
      content: '生成失败，请重试。',
      message,
      code,
      recoveryActions: ['重试']
    }
  }
  if (code === 'LLM_API_SURFACE_MISMATCH') {
    return {
      content: '生成失败，请重试。',
      message,
      code,
      recoveryActions: ['重试']
    }
  }
  return {
    content: '生成失败，请重试。',
    message,
    code,
    recoveryActions: ['重试']
  }
}

function handleWorkflowPrimaryAction() {
  if (isTotalDesignFlowSelected.value) {
    void analyzeWorkflowDocuments()
    return
  }
  if (isDialogueSkillSelected.value) {
    void startDialogueSkillAgent()
    return
  }
  if (isUxConfirmationSkillSelected.value) {
    void startUxDesignConfirmationAgent()
    return
  }
  if (isInteractionDesignWorkflowSelected.value) {
    void analyzeWorkflowDocuments()
    return
  }
  void analyzeWorkflowDocuments()
}

function dialogueSkillInitialMessage(input = '') {
  const hasProject = workflowForm.demandScope === 'project' && Boolean(workflowAnalysisProject.value?.id)
  return [
    '已进入对话 Skill。',
    '',
    '这里按普通对话模式工作：你输入什么，就把完整句子交给后端模型回答，不在前端拆分步骤。',
    '',
    `原始输入：${String(input || '').trim() || '暂无，建议先补充一句你想做的方案。'}`,
    `知识库：${hasProject ? '已绑定项目，后续可按需读取项目知识。' : '未绑定项目，不会默认检索项目知识库。'}`,
    '',
    '你可以一直继续对话；当你觉得可以落图时，再点“生成方案画布”。'
  ].join('\n')
}

function dialogueSkillRawPrompt(input = '') {
  return String(input || '').trim()
}

function dialogueSkillCanvasGenerationPrompt() {
  return [
    '请基于目前完整对话，直接输出“页面串联画布内容”。',
    '',
    '请不要再追问，除非完全无法判断页面范围。请按下面格式输出，每个页面一段，内容要由你根据对话直接生成：',
    '',
    '## 页面：页面名称',
    '页面目标：',
    '核心模块：',
    '主动作：',
    '次动作：',
    '状态与异常：',
    '数据与接口：',
    '验收点：',
    '',
    '至少输出 4 个页面或关键业务状态，并说明页面之间的主路径顺序。'
  ].join('\n')
}

function dialogueSkillTransferSummary(run = state.activeWorkflowRun) {
  const messages = Array.isArray(run?.agentSessions?.['dialogue-agent'])
    ? run.agentSessions['dialogue-agent']
    : workflowAgentSessionMessages()
  const dialogueLines = messages
    .filter((message) => ['user', 'assistant'].includes(message?.role))
    .map((message) => {
      const roleLabel = message.role === 'user' ? '用户' : 'Agent'
      const text = workflowAgentMessageText(message)
      return `${roleLabel}：${String(text || '').trim()}`
    })
    .filter((line) => line.replace(/^用户：|^Agent：/, '').trim())
    .slice(-12)
  return [
    '来自对话 Skill 的已确认上下文：',
    '',
    `原始输入：${String(run?.input || workflowForm.input || '').trim() || '暂无原始输入'}`,
    '',
    ...dialogueLines,
    '',
    '请从以上对话继续，不要让用户重复输入；先进入 UX 设计确认 Skill 的「需求澄清」阶段。'
  ].join('\n')
}

async function startDialogueSkillAgent() {
  if (!workflowForm.documents.length && !workflowForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先输入设计需求或上传资料')
    return
  }
  const workflowEntrySnapshot = workflowEntryPayloadSnapshot()
  const pendingWorkflow = builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0] ||
    {
      id: 'dialogue-skill',
      name: '对话 Skill',
      assetType: '对话方案',
      steps: []
    }
  const analysisRequestId = createClientId()
  const now = new Date().toISOString()
  const pendingRun = {
    ...createWorkflowRun(pendingWorkflow, workflowEntrySnapshot.input || '对话方案'),
    id: `dialogue-skill-${analysisRequestId}`,
    clientRequestId: analysisRequestId,
    workflowId: 'dialogue-skill',
    workflowName: '对话 Skill',
    assetType: '对话方案',
    input: workflowEntrySnapshot.input || '对话方案',
    projectId: workflowAnalysisProject.value?.id || '',
    demandScope: workflowForm.demandScope,
    requestedSkillId: 'dialogue-skill',
    resolvedSkillId: 'dialogue-skill',
    skillId: 'dialogue-skill',
    displaySkillName: '对话 Skill',
    routingReason: '对话 Skill 先只打开 Agent 对话，确认完成后再生成页面串联画布。',
    detectedIntent: 'interaction-design',
    currentStepId: 'dialogue-agent',
    steps: [
      {
        id: 'dialogue-agent',
        title: '纯模型对话',
        goal: '先通过自然对话分析需求，不预先生成画布。',
        requiredFields: [],
        outputTitle: '对话分析',
        status: 'active'
      }
    ],
    documentAnalysis: null,
    projectBlueprint: null,
    status: 'chatting',
    model: modelSettingsForm.defaultModel || 'gpt-5.5',
    agentSessions: {
      'dialogue-agent': [
        {
          id: `${analysisRequestId}-assistant-intro`,
          role: 'assistant',
          content: dialogueSkillInitialMessage(workflowEntrySnapshot.input),
          createdAt: now,
          meta: {
            status: 'success',
            statusLabel: workflowAgentStatusLabel('success'),
            action: 'dialogue-skill-start'
          }
        }
      ]
    },
    referenceFiles: {
      'dialogue-agent': workflowEntrySnapshot.documents
    },
    agentQuickReplies: {
      'dialogue-agent': ['生成方案画布', '转 UX 设计确认']
    },
    updatedAt: now
  }
  const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
  const persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : pendingRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
  state.activeWorkflowRun = persistedRun
  workflowAnalysisResult.value = null
  workflowCanvasLoading.value = false
  workflowRoute.value = 'canvas'
  workflowAgentNodeId.value = 'dialogue-agent'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  showWorkflowAgentSidebar()
  clearWorkflowEntryDocumentsAfterRun(workflowEntrySnapshot)
  saveState(state)
  setStatus(skillWorkbenchStatus, 'success', '已进入对话 Skill，先通过 Agent 纯对话分析。')
  await nextTick()
  await sendWorkflowAgentMessage(dialogueSkillRawPrompt(workflowEntrySnapshot.input), {
    nodeId: 'dialogue-agent',
    action: 'dialogue-skill-initial-analysis',
    ignoreDraftState: true
  })
}

function dialogueSkillAssistantCanvasText(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === 'assistant')
    .map((message) => ({
      action: message?.meta?.action || '',
      content: String(message?.meta?.typewriterFullContent || workflowAgentMessageText(message)).trim()
    }))
    .filter((message) =>
      message.content &&
      (message.action === 'dialogue-skill-canvas-content' ||
        /##\s*页面[:：]|页面目标[:：][\s\S]*核心模块[:：][\s\S]*验收点[:：]/.test(message.content))
    )
    .map((message) => message.content)
    .filter(Boolean)
    .reverse()
    .find(Boolean) || ''
}

function extractDialogueSkillPageContent(modelText = '', fallbackInput = '') {
  const source = String(modelText || '').trim()
  const fallbackTitle = String(fallbackInput || workflowForm.input || '').trim().split('\n').find(Boolean) || '对话生成方案'
  const jsonPages = extractDialogueSkillJsonCanvasPages(source)
  if (jsonPages.length) return jsonPages
  if (!source) {
    return [
      {
        title: '方案总览',
        content: `模型暂未返回可拆分页面内容。请先点击“生成方案画布”，让 Agent 输出页面串联画布内容后再生成画布。\n\n原始需求：${fallbackTitle}`
      }
    ]
  }
  const blocks = source
    .split(/(?=^#{1,3}\s*页面[:：]|^页面[:：])/m)
    .map((block) => block.trim())
    .filter(Boolean)
  const pageBlocks = blocks.length > 1 ? blocks : source.split(/\n(?=\d+[.、]\s*[^：:\n]{2,24}[：:]?)/).map((block) => block.trim()).filter(Boolean)
  return pageBlocks.slice(0, 9).map((block, index) => {
    const firstLine = block.split('\n').map((line) => line.trim()).find(Boolean) || `页面 ${index + 1}`
    const title = firstLine
      .replace(/^#{1,3}\s*/, '')
      .replace(/^页面[:：]\s*/, '')
      .replace(/^\d+[.、]\s*/, '')
      .replace(/[:：]\s*$/, '')
      .trim()
      .slice(0, 24) || `页面 ${index + 1}`
    return {
      title,
      content: block
    }
  })
}

function createDialogueSkillPageCanvas(messages = [], input = '') {
  const modelCanvasText = dialogueSkillAssistantCanvasText(messages)
  const pages = extractDialogueSkillPageContent(modelCanvasText, input)
  const title = String(input || workflowForm.input || '').trim().split('\n').find(Boolean) || '对话生成方案'
  const nodes = pages.map((page, index) => {
    const name = page.title
    const nodeId = `dialogue-page-${index + 1}`
    const pureContent = page.content
    return {
      id: nodeId,
      mode: 'dialogue-page',
      title: name,
      summary: index === 0 ? `基于对话整理「${title}」的整体定位。` : `承接上一步，拆解「${name}」的页面职责和状态。`,
      pureContent: pureContent,
      content: [
        `页面目标：${name} 的职责与用户任务`,
        '核心模块：信息、动作、反馈、状态',
        '接口边界：读取、提交、异常兜底',
        '验收点：可交付检查项'
      ],
      x: 120 + index * 410,
      y: index % 2 === 0 ? 160 : 500,
      width: 340,
      height: 230,
      groupName: '页面串联',
      agentScope: `围绕「${name}」继续补充页面内容、状态和接口边界。`,
      quickActions: ['补充细节', '重新生成'],
      detailSections: [
        { title: '模型内容', items: [pureContent] },
        { title: '来源', items: [`来自对话 Skill 的模型回复，原始需求：${title}`] }
      ]
    }
  })
  return {
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title })),
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一页'
    }))
  }
}

async function createDialogueSkillPageCanvasFromChat(options = {}) {
  let activeRun = state.activeWorkflowRun
  let messages = Array.isArray(activeRun?.agentSessions?.['dialogue-agent'])
    ? activeRun.agentSessions['dialogue-agent']
    : workflowAgentSessionMessages()
  if (!dialogueSkillAssistantCanvasText(messages)) {
    workflowRoute.value = 'canvas'
    workflowCanvasLoading.value = true
    workflowAgentNodeId.value = 'dialogue-agent'
    setStatus(skillWorkbenchStatus, 'loading', '正在根据对话生成页面串联画布...')
    await sendWorkflowAgentMessage(dialogueSkillCanvasGenerationPrompt(), {
      nodeId: 'dialogue-agent',
      action: 'dialogue-skill-canvas-content',
      ignoreDraftState: true
    })
    if (options.requireCanvasText) {
      activeRun = state.activeWorkflowRun
      messages = Array.isArray(activeRun?.agentSessions?.['dialogue-agent'])
        ? activeRun.agentSessions['dialogue-agent']
        : workflowAgentSessionMessages()
      if (!dialogueSkillAssistantCanvasText(messages)) {
        workflowCanvasLoading.value = false
        setStatus(skillWorkbenchStatus, 'failed', '模型还没有返回可入画布的页面内容，请稍后再试。')
        return
      }
    } else {
      workflowCanvasLoading.value = false
      return
    }
  }
  const canvas = createDialogueSkillPageCanvas(messages, activeRun?.input || workflowForm.input)
  const now = new Date().toISOString()
  const sourceRun = activeRun || {}
  const analysisRequestId = createClientId()
  const analysis = {
    status: 'analyzed',
    summary: { parsed: workflowForm.documents.length || 0, total: workflowForm.documents.length || 0 },
    requestedSkillId: 'dialogue-skill',
    resolvedSkillId: 'dialogue-skill',
    displaySkillName: '对话 Skill',
    routing: {
      requestedSkillId: 'dialogue-skill',
      requestedSkillName: '对话 Skill',
      resolvedSkillId: 'dialogue-skill',
      resolvedSkillName: '对话 Skill',
      displaySkillName: '对话 Skill',
      detectedIntent: 'interaction-design',
      routingReason: '对话完成后生成页面串联画布。'
    },
    aiSummary: {
      title: '对话生成方案',
      summary: '已把对话结论整理成页面串联画布。',
      recommendedFlow: canvas.orderedTabs.map((tab) => tab.label)
    },
    canvas,
    qualityGate: {
      score: 86,
      checks: [
        { id: 'dialogue-first', label: '先对话后画布', passed: true, severity: 'info', detail: '画布由对话完成动作生成。' },
        { id: 'page-node-canvas', label: '页面节点串联', passed: true, severity: 'info', detail: '每个页面作为一个节点并建立连线。' }
      ]
    }
  }
  const nextRun = {
    ...createWorkflowRun({
      id: 'dialogue-skill',
      name: '对话 Skill',
      assetType: '页面串联画布',
      steps: []
    }, sourceRun.input || workflowForm.input || '对话生成页面画布'),
    id: `dialogue-canvas-${analysisRequestId}`,
    clientRequestId: analysisRequestId,
    workflowId: 'dialogue-skill',
    workflowName: '对话 Skill',
    assetType: '页面串联画布',
    input: sourceRun.input || workflowForm.input || '对话生成页面画布',
    projectId: sourceRun.projectId || workflowAnalysisProject.value?.id || '',
    demandScope: sourceRun.demandScope || workflowForm.demandScope,
    requestedSkillId: 'dialogue-skill',
    resolvedSkillId: 'dialogue-skill',
    skillId: 'dialogue-skill',
    displaySkillName: '对话 Skill',
    routingReason: '由对话 Skill 的完整对话内容新建页面串联画布。',
    detectedIntent: 'interaction-design',
    sourceDialogueRunId: sourceRun.id || '',
    sourceWorkflowRunId: sourceRun.id || '',
    sourceSkillId: sourceRun.skillId || 'dialogue-skill',
    transferSource: {
      type: 'dialogue-skill-to-canvas',
      sourceWorkflowRunId: sourceRun.id || '',
      sourceSkillId: sourceRun.skillId || 'dialogue-skill',
      sourceSkillName: sourceRun.displaySkillName || '对话 Skill',
      targetSkillId: 'dialogue-skill',
      targetSkillName: '对话 Skill 页面串联画布'
    },
    status: 'analyzed',
    documentAnalysis: analysis,
    projectBlueprint: null,
    currentStepId: canvas.nodes[0]?.id || 'dialogue-page-1',
    steps: canvas.nodes.map((node, index) => ({
      id: node.id,
      title: node.title,
      goal: node.summary,
      requiredFields: [],
      outputTitle: `${node.title}详情`,
      status: index === 0 ? 'active' : 'pending'
    })),
    agentQuickReplies: {
      'dialogue-agent': ['生成方案画布', '转 UX 设计确认']
    },
    agentSessions: {
      'dialogue-agent': messages
    },
    referenceFiles: {
      'dialogue-agent': sourceRun.referenceFiles?.['dialogue-agent'] || workflowForm.documents || []
    },
    updatedAt: now
  }
  let persistedRun = nextRun
  try {
    const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, nextRun)
    persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
  } catch (error) {
    void error
  }
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
  state.activeWorkflowRun = persistedRun
  workflowAnalysisResult.value = analysis
  workflowRoute.value = 'canvas'
  workflowAgentNodeId.value = canvas.nodes[0]?.id || 'dialogue-page-1'
  workflowFullscreenNodeId.value = workflowAgentNodeId.value
  workflowFullscreenEditNodeId.value = ''
  showWorkflowAgentSidebar()
  saveState(state)
  workflowCanvasLoading.value = false
  openWorkflowAnalysisTab(persistedRun.id)
  setStatus(skillWorkbenchStatus, 'success', '已新建页面串联画布流程，并在新页面打开。')
}

function createUxConfirmationCanvas(input = '', options = {}) {
  const title = String(input || '').trim().split('\n').find(Boolean) || '待确认设计需求'
  const normalizedSourceContext = String(options.sourceContext || '').trim()
  return {
    orderedTabs: [
      { key: 'requirement-clarification', label: '需求澄清' }
    ],
    nodes: [
      {
        id: 'requirement-clarification',
        mode: 'agent-confirmation',
        stageId: 'requirement-clarification',
        title: '需求澄清',
        summary: 'Agent 会先确认目标用户、业务目标、核心任务、约束边界和信息缺口。',
        content: [
          `原始需求：${title}`,
          '当前不会直接生成画布；先通过 Agent 逐步确认。',
          '确认充分后，可继续进入竞品分析、设计策略、UX 流程确认或转低保真画布。'
        ],
        x: 120,
        y: 180,
        width: 420,
        height: 260,
        quickActions: ['下一步', '调整本阶段', '转低保真画布'],
        agentScope: '围绕需求澄清阶段确认目标、用户、场景、边界和信息缺口。',
        agentInteraction: {
          goal: '先确认需求，不急着生成画布。',
          confirmationRule: '请区分已确认事实、AI 推断、待确认问题，并给出下一步建议。',
          suggestedQuestions: [
            '这个需求的目标用户是谁？',
            '本次最重要的业务目标是什么？',
            '哪些内容属于本期不做？'
          ],
          quickReplies: ['下一步', '调整本阶段', '转低保真画布']
        },
        confirmation: {
          stageName: '需求澄清',
          stageGoal: '先把需求边界讲清楚，再决定是否进入竞品分析、设计策略或低保真画布。',
          sourceContext: normalizedSourceContext,
          currentUnderstanding: [
            `原始需求：${title}`,
            '当前处于需求澄清阶段，Agent 只做理解、提问和推进建议。'
          ],
          confirmedFacts: [
            workflowForm.documents.length ? `已上传 ${workflowForm.documents.length} 份资料。` : '暂无上传资料。',
            workflowForm.demandScope === 'project' && workflowAnalysisProject.value?.id
              ? `已绑定项目：${workflowAnalysisProject.value.name || workflowAnalysisProject.value.id}`
              : '未绑定项目，不默认检索项目知识库。'
          ],
          aiAssumptions: [
            '需要先确认目标用户、业务目标、核心任务和本期边界。',
            '信息充分前不直接生成完整低保真画布。'
          ],
          openQuestions: [
            '目标用户是谁？',
            '本次最重要的业务目标是什么？',
            '哪些场景或功能本期明确不做？'
          ],
          nextSuggestions: [
            '补充关键信息后点击“下一步”进入竞品分析或设计策略。',
            '如果需求已经足够明确，可以点击“转低保真画布”。'
          ]
        },
        detailSections: [
          ...(normalizedSourceContext ? [{ title: '对话上下文', items: [normalizedSourceContext] }] : []),
          { title: '阶段目标', items: ['确认目标用户、业务目标、核心任务、约束边界和信息缺口。'] },
          { title: '输出要求', items: ['当前理解', '已确认事实', 'AI 推断', '待确认问题', '下一步建议'] },
          { title: '下一步', items: ['确认后进入竞品分析或设计策略；信息足够时可直接转低保真画布。'] }
        ]
      }
    ],
    edges: []
  }
}

function uxConfirmationInitialMessage(input = '') {
  const hasProject = workflowForm.demandScope === 'project' && Boolean(workflowAnalysisProject.value?.id)
  return [
    '已进入 UX 设计确认模式。',
    '',
    '我不会先直接生成固定画布，会先按阶段和你确认：需求澄清、竞品分析、设计策略、UX 流程确认、低保真画布、转需求文档。',
    '',
    '当前阶段：需求澄清',
    `原始输入：${String(input || '').trim() || '暂无，建议先补充一句需求目标。'}`,
    `知识库：${hasProject ? '已绑定项目，后续会按需读取项目知识和竞品资料。' : '未绑定项目，不会默认检索项目知识库。'}`,
    '',
    '你可以直接补充信息，也可以点“下一步”。如果你认为信息已经足够，可以点“转低保真画布”。'
  ].join('\n')
}

function uxConfirmationInitialAnalysisPrompt(input = '') {
  return [
    '请基于我在设计方案页面输入的内容，先做 UX 设计确认 Skill 的第一阶段「需求澄清」分析。',
    '',
    `原始输入：${String(input || '').trim() || '暂无明确输入'}`,
    '',
    '请不要直接生成完整画布，也不要跳到低保真。请输出：',
    '1. 当前理解',
    '2. 已确认事实',
    '3. AI 推断',
    '4. 待确认问题（最多 3 个）',
    '5. 下一步建议',
    '',
    '如果信息不足，请明确缺口；如果信息足够，请说明可以进入竞品分析、设计策略或转低保真画布。'
  ].join('\n')
}

async function transferDialogueSkillToUxConfirmation() {
  const sourceRun = state.activeWorkflowRun
  if (!sourceRun || sourceRun.skillId !== 'dialogue-skill') {
    setStatus(skillWorkbenchStatus, 'failed', '当前不在对话 Skill，无法转入 UX 设计确认。')
    return
  }
  const transferInput = dialogueSkillTransferSummary(sourceRun)
  const pendingWorkflow = builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0] ||
    {
      id: 'ux-design-confirmation-skill',
      name: 'UX 设计确认 Skill',
      assetType: 'UX 设计确认',
      steps: []
    }
  const analysisRequestId = createClientId()
  const canvas = createUxConfirmationCanvas(transferInput, { sourceContext: transferInput })
  const now = new Date().toISOString()
  const analysis = {
    status: 'confirming',
    summary: { parsed: workflowForm.documents.length || 0, total: workflowForm.documents.length || 0 },
    requestedSkillId: 'ux-design-confirmation-skill',
    resolvedSkillId: 'ux-design-confirmation-skill',
    displaySkillName: 'UX 设计确认 Skill',
    routing: {
      requestedSkillId: 'ux-design-confirmation-skill',
      requestedSkillName: 'UX 设计确认 Skill',
      resolvedSkillId: 'ux-design-confirmation-skill',
      resolvedSkillName: 'UX 设计确认 Skill',
      displaySkillName: 'UX 设计确认 Skill',
      detectedIntent: 'interaction-design',
      routingReason: '由对话 Skill 的已确认上下文转入 UX 设计确认。'
    },
    aiSummary: {
      title: 'UX 设计确认',
      summary: '已从对话 Skill 带入上下文，继续按阶段确认。',
      items: ['需求澄清', '竞品分析', '设计策略', 'UX 流程确认', '低保真画布']
    },
    canvas,
    qualityGate: {
      score: 0,
      checks: [
        { id: 'dialogue-transfer', label: '对话上下文带入', passed: true, severity: 'info', detail: '已从对话 Skill 转入 UX 设计确认。' },
        { id: 'progressive-confirmation', label: '阶段确认', passed: true, severity: 'info', detail: '当前处于 Agent 确认模式，尚未生成最终画布。' }
      ]
    }
  }
  const pendingRun = {
    ...createWorkflowRun(pendingWorkflow, transferInput || 'UX 设计确认'),
    id: `ux-confirmation-${analysisRequestId}`,
    clientRequestId: analysisRequestId,
    workflowId: 'ux-design-confirmation-skill',
    workflowName: 'UX 设计确认 Skill',
    assetType: 'UX 设计确认',
    input: transferInput,
    projectId: sourceRun.projectId || workflowAnalysisProject.value?.id || '',
    demandScope: sourceRun.demandScope || workflowForm.demandScope,
    requestedSkillId: 'ux-design-confirmation-skill',
    resolvedSkillId: 'ux-design-confirmation-skill',
    skillId: 'ux-design-confirmation-skill',
    displaySkillName: 'UX 设计确认 Skill',
    routingReason: analysis.routing.routingReason,
    detectedIntent: 'interaction-design',
    sourceDialogueRunId: sourceRun.id,
    currentStepId: 'requirement-clarification',
    steps: [
      {
        id: 'requirement-clarification',
        title: '需求澄清',
        goal: '基于对话上下文确认目标用户、业务目标、核心任务、约束边界和信息缺口。',
        requiredFields: [],
        outputTitle: '需求澄清确认卡',
        status: 'active'
      }
    ],
    documentAnalysis: analysis,
    projectBlueprint: null,
    status: 'confirming',
    model: modelSettingsForm.defaultModel || sourceRun.model || 'gpt-5.5',
    agentSessions: {
      'requirement-clarification': [
        {
          id: `${analysisRequestId}-assistant-intro`,
          role: 'assistant',
          content: [
            '已从对话 Skill 转入 UX 设计确认。',
            '',
            '我会沿用刚才的对话结论，不会让你重新输入。当前阶段：需求澄清。',
            '',
            '下一步会先确认：目标用户、业务目标、核心任务、范围边界和信息缺口。'
          ].join('\n'),
          createdAt: now,
          meta: {
            status: 'success',
            statusLabel: workflowAgentStatusLabel('success'),
            action: 'ux-confirmation-transfer-start',
            sourceDialogueRunId: sourceRun.id
          }
        }
      ]
    },
    referenceFiles: {
      'requirement-clarification': sourceRun.referenceFiles?.['dialogue-agent'] || workflowForm.documents || []
    },
    agentQuickReplies: {
      'requirement-clarification': ['下一步', '调整本阶段', '转低保真画布']
    },
    updatedAt: now
  }
  const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
  const persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : pendingRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
  saveState(state)
  openWorkflowAnalysisTab(persistedRun.id)
  setStatus(skillWorkbenchStatus, 'success', '已新开页面转入 UX 设计确认。')
  const transferMessageResult = await api.workflows.appendMessage(
    state.apiConfig,
    persistedRun.id,
    'requirement-clarification',
    {
      model: workflowAgentModel.value,
      message: {
        role: 'user',
        content: uxConfirmationInitialAnalysisPrompt(transferInput),
        action: 'ux-confirmation-transfer-analysis'
      },
      action: 'ux-confirmation-transfer-analysis',
      retrievedKnowledge: [],
      references: pendingRun.referenceFiles['requirement-clarification'] || [],
      context: {
        mode: 'ux-confirmation-transfer',
        nodeId: 'requirement-clarification',
        sourceDialogueRunId: sourceRun.id
      }
    }
  ).catch(() => null)
  if (transferMessageResult?.ok && transferMessageResult.data?.run) {
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, transferMessageResult.data.run)
    saveState(state)
  }
}

function transferWorkflowCanvasToOtherSkillAnalysis() {
  workflowSkillTransferForm.selectedSkillId = 'advanced-ux-requirement-analysis'
  workflowSkillTransferForm.notes = ''
  showWorkflowSkillTransferModal.value = true
}

function closeWorkflowSkillTransferModal() {
  showWorkflowSkillTransferModal.value = false
}

async function confirmWorkflowCanvasSkillTransfer() {
  const transferInput = workflowCanvasTransferContext()
  if (!String(transferInput || '').trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '当前画布没有可转分析的内容')
    return
  }
  const sourceRun = state.activeWorkflowRun || {}
  const targetSkillId = workflowSkillTransferForm.selectedSkillId || 'auto'
  const targetSkillLabel = workflowSkillTransferSelectedLabel.value
  const transferInputWithNotes = [
    transferInput,
    workflowSkillTransferForm.notes ? `补充说明：${workflowSkillTransferForm.notes}` : ''
  ].filter(Boolean).join('\n\n')
  const pendingWorkflow = builtinWorkflows.value.find((item) => item.id === targetSkillId) ||
    builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0]
  const analysisRequestId = createClientId()
  const isNoSkillSelection = targetSkillId === 'none'
  const transferProjectId = (sourceRun.demandScope || workflowForm.demandScope) === 'project'
    ? (workflowAnalysisProject.value?.id || sourceRun.projectId || '')
    : ''
  const pendingRun = {
    ...createWorkflowRun(pendingWorkflow, transferInputWithNotes || '转其它 Skill 分析'),
    clientRequestId: analysisRequestId,
    projectId: transferProjectId,
    demandScope: sourceRun.demandScope || workflowForm.demandScope,
    requestedSkillId: targetSkillId,
    resolvedSkillId: targetSkillId === 'auto' ? '' : targetSkillId,
    skillId: targetSkillId,
    displaySkillName: isNoSkillSelection ? '不选择 Skill' : targetSkillLabel,
    routingReason: '',
    detectedIntent: '',
    sourceWorkflowRunId: sourceRun.id || '',
    sourceSkillId: sourceRun.skillId || workflowSkillRouting.value.resolvedSkillId || '',
    transferSource: {
      type: 'workflow-canvas-transfer',
      sourceWorkflowRunId: sourceRun.id || '',
      sourceSkillId: sourceRun.skillId || workflowSkillRouting.value.resolvedSkillId || '',
      sourceSkillName: workflowCanvasSkillLabel.value || '',
      targetSkillId,
      targetSkillName: targetSkillLabel
    },
    projectBlueprint: null,
    documentAnalysis: null,
    status: 'analyzing',
    model: modelSettingsForm.defaultModel || 'gpt-5.5',
    agentSessions: {},
    referenceFiles: {},
    updatedAt: new Date().toISOString()
  }
  pendingRun.referenceFiles[pendingRun.currentStepId] = []
  try {
    showWorkflowSkillTransferModal.value = false
    setStatus(skillWorkbenchStatus, 'loading', `正在新建分析记录，并转给${targetSkillLabel}重新分析...`)
    const pendingRunResult = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
    let persistedPendingRun = pendingRunResult.ok && pendingRunResult.data?.run ? pendingRunResult.data.run : pendingRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedPendingRun)
    saveState(state)
    openWorkflowAnalysisTab(persistedPendingRun.id)
    let backgroundAnalysisResult = buildWorkflowAnalysisProgressResult(persistedPendingRun)
    void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
    const selectedKnowledgeScopeDocuments = workflowSelectedKnowledgeScopeDocuments(transferInputWithNotes, pendingRun.projectId)
    const knowledgeContextDocuments = workflowKnowledgeContextDocuments(8, transferInputWithNotes, pendingRun.projectId)
    const analysisPayload = {
      requestId: analysisRequestId,
      analysisRunId: persistedPendingRun.id,
      demandScope: pendingRun.demandScope,
      skillSelectionMode: targetSkillId === 'auto' ? 'auto' : 'manual',
      skillId: targetSkillId,
      requestedSkillId: targetSkillId,
      projectId: pendingRun.projectId,
      project: state.projects.find((project) => project.id === pendingRun.projectId) || workflowAnalysisProject.value || {},
      input: transferInputWithNotes,
      documents: pendingRun.demandScope === 'project' ? [...selectedKnowledgeScopeDocuments, ...knowledgeContextDocuments] : [],
      webSearchEnabled: workflowAgentWebSearchEnabled.value,
      timeoutMs: 0,
      generationTimeoutMs: 0
    }
    const streamController = new AbortController()
    const result = await api.uploads.analyzeDocumentsStream(state.apiConfig, analysisPayload, {
      timeoutMs: workflowAnalysisRequestTimeoutMs(),
      signal: streamController.signal,
      onEvent: (event) => {
        broadcastWorkflowAnalysisStreamEvent(persistedPendingRun.id, event)
        if (event.type === 'status' && event.data?.label) {
          setStatus(skillWorkbenchStatus, 'loading', event.data.label)
        }
        if (event.type === 'artifact' && !shouldRevealWorkflowAnalysisIntermediateArtifact(event.data)) {
          void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult)
          setStatus(skillWorkbenchStatus, 'loading', '模型仍在生成结构化画布，完成后会一次性展示最终结果...')
          return
        }
        if (event.type === 'artifact' && event.data?.type === 'workflow-canvas-meta') {
          backgroundAnalysisResult = buildWorkflowAnalysisProgressResult(persistedPendingRun, event.data)
          void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
        } else if (event.type === 'artifact' && event.data?.type === 'workflow-stage-canvas') {
          backgroundAnalysisResult = mergeWorkflowStageCanvasEvent(
            backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun),
            event.data
          )
          void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult)
        } else if (event.type === 'artifact' && event.data?.type === 'workflow-analysis') {
          if (event.data?.canvas) {
            backgroundAnalysisResult = {
              ...(backgroundAnalysisResult || {}),
              status: 'analyzed',
              aiSummary: event.data.aiSummary || backgroundAnalysisResult?.aiSummary || null,
              blueprint: event.data.blueprint || backgroundAnalysisResult?.blueprint || null,
              generation: event.data.generation || backgroundAnalysisResult?.generation || null,
              canvas: event.data.canvas,
              totalDesignFlow: normalizeWorkflowTotalFlowMeta(event.data.totalDesignFlow || event.data.totalFlowMeta) || backgroundAnalysisResult?.totalDesignFlow || null,
              routing: event.data.routing || backgroundAnalysisResult?.routing || {}
            }
            void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzed' })
          }
        } else if (event.type === 'error') {
          backgroundAnalysisResult = mergeWorkflowAnalysisStreamError(
            backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun),
            event.data || {}
          )
          void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'failed' })
          setStatus(skillWorkbenchStatus, 'failed', event.data?.message || '模型调用失败')
        }
      }
    })
    if (result.status === 'cancelled') {
      return
    }
    if (!result.ok || !hasWorkflowAnalysisResultData(result.data)) {
      const failureMessage = result.message || result.error || '转 Skill 分析失败，请检查后端服务'
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
      saveState(state)
      setStatus(skillWorkbenchStatus, 'failed', failureMessage)
      return
    }
    const resolvedWorkflowId = result.data.routing?.resolvedSkillId || result.data.resolvedSkillId || targetSkillId
    const workflow = builtinWorkflows.value.find((item) => item.id === resolvedWorkflowId) ||
      builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
      builtinWorkflows.value[0]
    const nextRun = {
      ...persistedPendingRun,
      clientRequestId: analysisRequestId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      assetType: workflow.assetType,
      input: transferInputWithNotes || result.data.blueprint?.title || result.data.canvas?.title || pendingRun.input,
      projectId: pendingRun.projectId,
      demandScope: pendingRun.demandScope,
      requestedSkillId: result.data.routing?.requestedSkillId || result.data.requestedSkillId || targetSkillId,
      resolvedSkillId: resolvedWorkflowId,
      displaySkillName: result.data.routing?.displaySkillName || result.data.displaySkillName || targetSkillLabel,
      routingReason: result.data.routing?.routingReason || result.data.routingReason || '',
      detectedIntent: result.data.routing?.detectedIntent || result.data.detectedIntent || '',
      skillId: resolvedWorkflowId,
      sourceWorkflowRunId: pendingRun.sourceWorkflowRunId,
      sourceSkillId: pendingRun.sourceSkillId,
      transferSource: pendingRun.transferSource,
      projectBlueprint: result.data.blueprint || null,
      documentAnalysis: result.data,
      status: 'analyzed',
      updatedAt: new Date().toISOString(),
      model: modelSettingsForm.defaultModel || 'gpt-5.5',
      agentSessions: persistedPendingRun.agentSessions || {},
      referenceFiles: persistedPendingRun.referenceFiles || {}
    }
    nextRun.referenceFiles[nextRun.currentStepId] = result.data.documents || []
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    saveState(state)
    setStatus(skillWorkbenchStatus, 'success', `已新建分析记录，并按${targetSkillLabel}生成画布`)
    api.workspace.createWorkflowRun(state.apiConfig, nextRun).then((savedRunResult) => {
      const persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
      saveState(state)
    }).catch(() => {})
  } catch (error) {
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `转 Skill 分析失败：${error.message}` : '转 Skill 分析失败')
  }
}

async function startUxDesignConfirmationAgent() {
  if (!workflowForm.documents.length && !workflowForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先输入设计需求或上传资料')
    return
  }
  const workflowEntrySnapshot = workflowEntryPayloadSnapshot()
  const pendingWorkflow = builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0] ||
    {
      id: 'ux-design-confirmation-skill',
      name: 'UX 设计确认 Skill',
      assetType: 'UX 设计确认',
      steps: []
  }
  const analysisRequestId = createClientId()
  const canvas = createUxConfirmationCanvas(workflowEntrySnapshot.input)
  const now = new Date().toISOString()
  const analysis = {
    status: 'confirming',
    summary: { parsed: workflowEntrySnapshot.documents.length || 0, total: workflowEntrySnapshot.documents.length || 0 },
    requestedSkillId: 'ux-design-confirmation-skill',
    resolvedSkillId: 'ux-design-confirmation-skill',
    displaySkillName: 'UX 设计确认 Skill',
    routing: {
      requestedSkillId: 'ux-design-confirmation-skill',
      requestedSkillName: 'UX 设计确认 Skill',
      resolvedSkillId: 'ux-design-confirmation-skill',
      resolvedSkillName: 'UX 设计确认 Skill',
      displaySkillName: 'UX 设计确认 Skill',
      detectedIntent: 'interaction-design',
      routingReason: 'UX 设计确认 Skill 先通过 Agent 阶段确认，再由用户决定是否转低保真画布。'
    },
    aiSummary: {
      title: 'UX 设计确认',
      summary: '先确认，再转画布。',
      items: ['需求澄清', '竞品分析', '设计策略', 'UX 流程确认', '低保真画布']
    },
    canvas,
    qualityGate: {
      score: 0,
      checks: [
        { id: 'progressive-confirmation', label: '阶段确认', passed: true, severity: 'info', detail: '当前处于 Agent 确认模式，尚未生成最终画布。' }
      ]
    }
  }
  const pendingRun = {
    ...createWorkflowRun(pendingWorkflow, workflowEntrySnapshot.input || 'UX 设计确认'),
    id: `ux-confirmation-${analysisRequestId}`,
    clientRequestId: analysisRequestId,
    workflowId: 'ux-design-confirmation-skill',
    workflowName: 'UX 设计确认 Skill',
    assetType: 'UX 设计确认',
    input: workflowEntrySnapshot.input || 'UX 设计确认',
    projectId: workflowAnalysisProject.value?.id || '',
    demandScope: workflowForm.demandScope,
    requestedSkillId: 'ux-design-confirmation-skill',
    resolvedSkillId: 'ux-design-confirmation-skill',
    skillId: 'ux-design-confirmation-skill',
    displaySkillName: 'UX 设计确认 Skill',
    routingReason: analysis.routing.routingReason,
    detectedIntent: 'interaction-design',
    currentStepId: 'requirement-clarification',
    steps: [
      {
        id: 'requirement-clarification',
        title: '需求澄清',
        goal: '确认目标用户、业务目标、核心任务、约束边界和信息缺口。',
        requiredFields: [],
        outputTitle: '需求澄清确认卡',
        status: 'active'
      }
    ],
    documentAnalysis: analysis,
    projectBlueprint: null,
    status: 'confirming',
    model: modelSettingsForm.defaultModel || 'gpt-5.5',
    agentSessions: {
      'requirement-clarification': [
        {
          id: `${analysisRequestId}-assistant-intro`,
          role: 'assistant',
          content: uxConfirmationInitialMessage(workflowEntrySnapshot.input),
          createdAt: now,
          meta: {
            status: 'success',
            statusLabel: workflowAgentStatusLabel('success'),
            action: 'ux-confirmation-start'
          }
        }
      ]
    },
    referenceFiles: {
      'requirement-clarification': workflowEntrySnapshot.documents
    },
    agentQuickReplies: {
      'requirement-clarification': ['下一步', '调整本阶段', '转低保真画布']
    },
    updatedAt: now
  }
  const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
  const persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : pendingRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
  state.activeWorkflowRun = persistedRun
  workflowAnalysisResult.value = analysis
  workflowCanvasLoading.value = false
  workflowRoute.value = 'canvas'
  workflowAgentNodeId.value = 'requirement-clarification'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  showWorkflowAgentInline()
  clearWorkflowEntryDocumentsAfterRun(workflowEntrySnapshot)
  saveState(state)
  setStatus(skillWorkbenchStatus, 'success', '已进入 UX 设计确认模式，先通过 Agent 确认需求。')
  const initialAnalysisPrompt = uxConfirmationInitialAnalysisPrompt(workflowEntrySnapshot.input)
  await nextTick()
  await sendWorkflowAgentMessage(initialAnalysisPrompt, {
    nodeId: 'requirement-clarification',
    action: 'ux-confirmation-initial-analysis',
    ignoreDraftState: true
  })
}

async function analyzeWorkflowDocuments() {
  if (!workflowForm.documents.length && !workflowForm.input.trim()) {
    const fallbackInput = workflowDefaultPrompt()
    workflowForm.input = fallbackInput
    setStatus(skillWorkbenchStatus, 'info', '已使用默认示例需求开始分析')
  }
  const workflowEntrySnapshot = workflowEntryPayloadSnapshot()
  const isTotalDesignFlowRun = isTotalFlowLikeWorkflowId(workflowForm.selectedWorkflowId)
  const pendingWorkflow = isTotalDesignFlowRun
    ? {
        id: workflowForm.selectedWorkflowId,
        name: workflowSelectedSkillLabel.value,
        assetType: workflowForm.selectedWorkflowId === 'advanced-ux-requirement-analysis' ? '高级 UX 需求分析' : '设计方案总流程',
        steps: []
      }
    : builtinWorkflows.value.find((item) => item.id === workflowForm.selectedWorkflowId) ||
    builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0]
  const isNoSkillSelection = workflowForm.selectedWorkflowId === 'none'
  const analysisSkillId = isTotalFlowLikeWorkflowId(workflowForm.selectedWorkflowId) ? workflowForm.selectedWorkflowId : workflowForm.selectedWorkflowId
  const analysisSkillSelectionMode = isTotalFlowLikeWorkflowId(workflowForm.selectedWorkflowId) || analysisSkillId === 'auto' ? 'auto' : 'manual'
  const analysisRequestId = createClientId()
  const analysisProjectId = workflowForm.demandScope === 'project'
    ? (workflowAnalysisProject.value?.id || state.currentProjectId || '')
    : ''
  const pendingRun = {
    ...createWorkflowRun(pendingWorkflow, workflowEntrySnapshot.input || '需求文档分析'),
    clientRequestId: analysisRequestId,
    input: workflowEntrySnapshot.input || '需求文档分析',
    projectId: analysisProjectId,
    demandScope: workflowForm.demandScope,
    requestedSkillId: workflowForm.selectedWorkflowId,
    resolvedSkillId: analysisSkillSelectionMode === 'auto' ? '' : analysisSkillId,
    skillId: workflowForm.selectedWorkflowId,
    displaySkillName: isNoSkillSelection
      ? '不选择 Skill'
      : isTotalFlowLikeWorkflowId(workflowForm.selectedWorkflowId) ? workflowSelectedSkillLabel.value : analysisSkillId === 'auto' ? '智能推荐 Skill' : workflowSelectedSkillLabel.value,
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
  pendingRun.agentSessions = ensureWorkflowImmediateAssistantMessageSession({
    input: workflowEntrySnapshot.input,
    run: pendingRun
  })
  pendingRun.referenceFiles[pendingRun.currentStepId] = workflowEntrySnapshot.documents
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, pendingRun)
  saveState(state)
  openWorkflowAnalysisTab(pendingRun.id)
  setStatus(
    skillWorkbenchStatus,
    'loading',
    isNoSkillSelection
      ? '已在新标签页打开自由画布，后端正在请求模型生成画布节点...'
      : '已在新标签页打开分析画布，后端正在生成初步架构和交互路径树...'
  )
  let persistedPendingRun = pendingRun
  try {
    const pendingRunResult = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
    persistedPendingRun = pendingRunResult.ok && pendingRunResult.data?.run ? pendingRunResult.data.run : pendingRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedPendingRun)
    saveState(state)
  } catch (error) {
    void error
  }
  const selectedKnowledgeScopeDocuments = workflowSelectedKnowledgeScopeDocuments(workflowEntrySnapshot.input, persistedPendingRun.projectId)
  const knowledgeContextDocuments = workflowKnowledgeContextDocuments(8, workflowEntrySnapshot.input, persistedPendingRun.projectId)
  const analysisPayload = {
    requestId: analysisRequestId,
    analysisRunId: persistedPendingRun.id,
    demandScope: persistedPendingRun.demandScope,
    skillSelectionMode: analysisSkillSelectionMode,
    skillId: analysisSkillId,
    requestedSkillId: workflowForm.selectedWorkflowId,
    projectId: persistedPendingRun.projectId,
    project: state.projects.find((project) => project.id === persistedPendingRun.projectId) || workflowAnalysisProject.value || {},
    input: workflowEntrySnapshot.input,
    webSearchEnabled: workflowAgentWebSearchEnabled.value,
    documents: [
      ...workflowEntrySnapshot.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        content: doc.status === '已读取' || doc.status === '待视觉解析' ? (doc.text || '') : '',
        reason: doc.status !== '已读取' ? (doc.text || doc.reason || '') : ''
      })),
      ...(persistedPendingRun.demandScope === 'project' ? selectedKnowledgeScopeDocuments : []),
      ...(persistedPendingRun.demandScope === 'project' ? knowledgeContextDocuments : [])
    ],
    timeoutMs: 0,
    generationTimeoutMs: 0
  }
  let backgroundAnalysisResult = buildWorkflowAnalysisProgressResult(persistedPendingRun)
  void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
  const isViewingAnalysisRun = () => currentWorkflowAnalysisDeepLinkRunId() === persistedPendingRun.id
  const applyViewedAnalysisResult = (analysis) => {
    if (!isViewingAnalysisRun()) return
    workflowAnalysisResult.value = analysis
    syncWorkflowActiveStageFromAnalysis(workflowAnalysisResult.value)
  }
  workflowAnalysisStreamController.value?.abort?.()
  const streamController = new AbortController()
  workflowAnalysisStreamController.value = streamController
  const result = await api.uploads.analyzeDocumentsStream(state.apiConfig, analysisPayload, {
    timeoutMs: workflowAnalysisRequestTimeoutMs(),
    signal: streamController.signal,
    onEvent: (event) => {
      broadcastWorkflowAnalysisStreamEvent(persistedPendingRun.id, event)
      if (event.type === 'status' && event.data?.label) {
        if (event.data?.phase === 'advanced-ux-markdown' && isAdvancedUxWorkflowRun(persistedPendingRun)) {
          const currentAnalysis = backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun)
          const currentReport = workflowAdvancedUxReportCandidateFromAnalysis(currentAnalysis) || {}
          const nextReport = {
            ...currentReport,
            status: event.data.status || currentReport.status || 'generating',
            ...(event.data.repairState ? { repairState: event.data.repairState } : {})
          }
          backgroundAnalysisResult = {
            ...currentAnalysis,
            advancedUxReport: nextReport,
            totalDesignFlow: currentAnalysis.totalDesignFlow
              ? {
                  ...currentAnalysis.totalDesignFlow,
                  advancedUxReport: {
                    ...(currentAnalysis.totalDesignFlow.advancedUxReport || {}),
                    ...nextReport
                  }
                }
              : currentAnalysis.totalDesignFlow || null
          }
          applyViewedAnalysisResult(backgroundAnalysisResult)
          void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { status: 'analyzing' })
        }
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'loading', event.data.label)
      }
      if (event.type === 'artifact' && !shouldRevealWorkflowAnalysisIntermediateArtifact(event.data)) {
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult)
        if (isViewingAnalysisRun()) {
          setStatus(skillWorkbenchStatus, 'loading', '模型仍在生成结构化画布，完成后会一次性展示最终结果...')
        }
        return
      }
      if (event.type === 'artifact' && event.data?.type === 'workflow-canvas-meta') {
        backgroundAnalysisResult = buildWorkflowAnalysisProgressResult(persistedPendingRun, event.data)
        applyViewedAnalysisResult(backgroundAnalysisResult)
        if (isViewingAnalysisRun()) {
          workflowStageStatusMap.value = {
            ...buildWorkflowStageStatuses(workflowAnalysisResult.value?.totalDesignFlow, 'waiting'),
            ...workflowStageStatusMap.value
          }
        }
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'loading', `后端已返回画布骨架，准备生成 ${event.data?.total || 0} 个节点...`)
      } else if (event.type === 'artifact' && event.data?.type === 'advanced-ux-markdown-report') {
        backgroundAnalysisResult = {
          ...(backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun)),
          advancedUxReport: event.data,
          generation: {
            status: 'generated',
            content: event.data.markdown || '',
            rawContent: event.data.markdown || ''
          }
        }
        upsertAdvancedUxMarkdownReportAssistantMessage(persistedPendingRun.id, event.data)
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'success', '高级 UX Markdown 已生成')
      } else if (event.type === 'artifact' && event.data?.type === 'advanced-ux-page-interaction-document') {
        const currentReport = backgroundAnalysisResult?.advancedUxReport || {}
        const nextReport = {
          ...currentReport,
          pageInteractionDocument: event.data
        }
        backgroundAnalysisResult = {
          ...(backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun)),
          advancedUxReport: nextReport,
          totalDesignFlow: backgroundAnalysisResult?.totalDesignFlow
            ? {
                ...backgroundAnalysisResult.totalDesignFlow,
                advancedUxReport: {
                  ...(backgroundAnalysisResult.totalDesignFlow.advancedUxReport || {}),
                  pageInteractionDocument: event.data
                },
                pageInteractionDocumentArtifact: event.data
              }
            : backgroundAnalysisResult?.totalDesignFlow || null
        }
        upsertAdvancedUxPageInteractionDocumentAssistantMessage(persistedPendingRun.id, event.data)
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'success', '页面交互文档已生成')
      } else if (event.type === 'artifact' && event.data?.type === 'advanced-ux-drawio-artifacts') {
        const drawioArtifacts = Array.isArray(event.data?.artifacts)
          ? event.data.artifacts.filter((artifact) => artifact?.content)
          : []
        const currentReport = backgroundAnalysisResult?.advancedUxReport || {}
        const nextReport = {
          ...currentReport,
          drawioArtifacts
        }
        backgroundAnalysisResult = {
          ...(backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun)),
          advancedUxReport: nextReport,
          totalDesignFlow: backgroundAnalysisResult?.totalDesignFlow
            ? {
                ...backgroundAnalysisResult.totalDesignFlow,
                advancedUxReport: {
                  ...(backgroundAnalysisResult.totalDesignFlow.advancedUxReport || {}),
                  drawioArtifacts
                },
                drawioArtifacts
              }
            : backgroundAnalysisResult?.totalDesignFlow || null
        }
        upsertAdvancedUxMarkdownReportAssistantMessage(persistedPendingRun.id, nextReport)
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'success', 'Draw.io 文件已生成')
      } else if (event.type === 'artifact' && event.data?.type === 'advanced-ux-lowfi-wireframe-artifacts') {
        const lowFiWireframeArtifacts = Array.isArray(event.data?.artifacts)
          ? event.data.artifacts.filter((artifact) => artifact?.imageDataUrl || artifact?.imageUrl)
          : []
        const currentReport = backgroundAnalysisResult?.advancedUxReport || {}
        const nextReport = {
          ...currentReport,
          lowFiWireframeArtifacts
        }
        backgroundAnalysisResult = {
          ...(backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun)),
          advancedUxReport: nextReport,
          totalDesignFlow: backgroundAnalysisResult?.totalDesignFlow
            ? {
                ...backgroundAnalysisResult.totalDesignFlow,
                advancedUxReport: {
                  ...(backgroundAnalysisResult.totalDesignFlow.advancedUxReport || {}),
                  lowFiWireframeArtifacts
                },
                lowFiWireframeArtifacts
              }
            : backgroundAnalysisResult?.totalDesignFlow || null
        }
        upsertAdvancedUxMarkdownReportAssistantMessage(persistedPendingRun.id, nextReport)
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzing' })
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'success', '低保真线框图已生成')
      } else if (event.type === 'artifact' && event.data?.type === 'workflow-stage-canvas') {
        backgroundAnalysisResult = mergeWorkflowStageCanvasEvent(
          backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun),
          event.data
        )
        applyViewedAnalysisResult(backgroundAnalysisResult)
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult)
        if (isViewingAnalysisRun()) {
          const stageLabel = event.data.stage?.name || event.data.stageId || '阶段'
          setStatus(skillWorkbenchStatus, event.data.status === 'completed' ? 'success' : 'loading', event.data.status === 'completed' ? `${stageLabel} 已生成` : `正在生成 ${stageLabel}...`)
        }
      } else if (event.type === 'artifact' && event.data?.type === 'workflow-analysis') {
        if (event.data?.canvas) {
          backgroundAnalysisResult = {
            ...(backgroundAnalysisResult || {}),
            status: 'analyzed',
            aiSummary: event.data.aiSummary || backgroundAnalysisResult?.aiSummary || null,
            blueprint: event.data.blueprint || backgroundAnalysisResult?.blueprint || null,
            generation: event.data.generation || backgroundAnalysisResult?.generation || null,
            advancedUxReport: event.data.advancedUxReport || backgroundAnalysisResult?.advancedUxReport || null,
            canvas: event.data.canvas,
            totalDesignFlow: normalizeWorkflowTotalFlowMeta(event.data.totalDesignFlow || event.data.totalFlowMeta) || backgroundAnalysisResult?.totalDesignFlow || null,
            routing: event.data.routing || backgroundAnalysisResult?.routing || {}
          }
          applyViewedAnalysisResult(backgroundAnalysisResult)
          void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'analyzed' })
          if (isViewingAnalysisRun()) {
            workflowStageStatusMap.value = {
              ...workflowStageStatusMap.value,
              ...buildWorkflowStageStatuses(workflowAnalysisResult.value?.totalDesignFlow, 'waiting')
            }
            workflowCanvasLoading.value = false
            setStatus(skillWorkbenchStatus, 'success', '模型已生成画布，正在后台保存结果...')
          }
        }
      } else if (event.type === 'error') {
        backgroundAnalysisResult = mergeWorkflowAnalysisStreamError(
          backgroundAnalysisResult || buildWorkflowAnalysisProgressResult(persistedPendingRun),
          event.data || {}
        )
        void persistWorkflowAnalysisBackgroundRun(persistedPendingRun, backgroundAnalysisResult, { immediate: true, status: 'failed' })
        if (isViewingAnalysisRun()) {
          workflowAnalysisResult.value = backgroundAnalysisResult
          workflowAgentNodeId.value = 'model-generating'
          setStatus(skillWorkbenchStatus, 'failed', event.data?.message || '模型调用失败')
        }
      } else if (event.type === 'artifact') {
        if (isViewingAnalysisRun()) setStatus(skillWorkbenchStatus, 'loading', '后端已生成部分分析结果，正在保存画布...')
      }
    }
  })
  if (workflowAnalysisStreamController.value === streamController) {
    workflowAnalysisStreamController.value = null
  }
  if (result.status === 'cancelled') {
    if (isViewingAnalysisRun()) workflowCanvasLoading.value = false
    return
  }
  if (!result.ok || !hasWorkflowAnalysisResultData(result.data)) {
    if (isWorkflowAnalysisRecoverableStreamResult(result)) {
      if (workflowAnalysisProgressSaveTimer) {
        window.clearTimeout(workflowAnalysisProgressSaveTimer)
        workflowAnalysisProgressSaveTimer = null
      }
      keepWorkflowAnalysisWaitingForBackend(persistedPendingRun, backgroundAnalysisResult, result.message || result.error || '流式连接中断')
      return
    }
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
    saveState(state)
    if (isViewingAnalysisRun()) {
      state.activeWorkflowRun = persistedFailedRun
      setStatus(skillWorkbenchStatus, 'failed', failureMessage)
    }
    return
  }
  if (workflowAnalysisProgressSaveTimer) {
    window.clearTimeout(workflowAnalysisProgressSaveTimer)
    workflowAnalysisProgressSaveTimer = null
  }
  const resolvedWorkflowId = isTotalDesignFlowRun
    ? workflowForm.selectedWorkflowId
    : result.data.routing?.resolvedSkillId || result.data.resolvedSkillId || workflowForm.selectedWorkflowId
  const workflow = builtinWorkflows.value.find((item) => item.id === resolvedWorkflowId) ||
    builtinWorkflows.value.find((item) => item.id === 'interaction-design-workflow') ||
    builtinWorkflows.value[0]
  const nextRun = {
    ...persistedPendingRun,
    clientRequestId: analysisRequestId,
    workflowId: isTotalDesignFlowRun ? workflowForm.selectedWorkflowId : workflow.id,
    workflowName: isTotalDesignFlowRun ? workflowSelectedSkillLabel.value : workflow.name,
    assetType: isTotalDesignFlowRun ? (workflowForm.selectedWorkflowId === 'advanced-ux-requirement-analysis' ? '高级 UX 需求分析' : '设计方案总流程') : workflow.assetType,
    input: workflowEntrySnapshot.input || result.data.blueprint?.title || result.data.canvas?.title || '需求文档分析',
    projectId: persistedPendingRun.projectId,
    demandScope: persistedPendingRun.demandScope,
    requestedSkillId: result.data.routing?.requestedSkillId || result.data.requestedSkillId || workflowForm.selectedWorkflowId,
    resolvedSkillId: resolvedWorkflowId,
    displaySkillName: isTotalDesignFlowRun
      ? workflowSelectedSkillLabel.value
      : result.data.routing?.displaySkillName || result.data.displaySkillName,
    routingReason: result.data.routing?.routingReason || result.data.routingReason || '',
    detectedIntent: result.data.routing?.detectedIntent || result.data.detectedIntent || '',
    skillId: isTotalDesignFlowRun ? workflowForm.selectedWorkflowId : resolvedWorkflowId,
    projectBlueprint: result.data.blueprint || null,
    documentAnalysis: result.data,
    status: 'analyzed',
    updatedAt: new Date().toISOString(),
    model: modelSettingsForm.defaultModel || 'gpt-5.5',
    agentSessions: persistedPendingRun.agentSessions || {},
    referenceFiles: persistedPendingRun.referenceFiles || {}
  }
  if (!workflowRunHasModelAssistantReply(nextRun)) {
    const report = result.data?.advancedUxReport || null
    const streamedAnalysisRun = report?.markdown
      ? upsertAdvancedUxMarkdownReportAssistantMessage(persistedPendingRun.id, report) || persistedPendingRun
      : upsertWorkflowAnalysisStreamAssistantMessage(persistedPendingRun.id, {
          text: workflowModelReplyText(result.data),
          delta: workflowModelReplyText(result.data)
        }, { status: 'success', statusLabel: workflowAgentStatusLabel('success') }) || persistedPendingRun
    nextRun.agentSessions = streamedAnalysisRun.agentSessions || nextRun.agentSessions
    if (!report?.markdown) {
      nextRun.agentSessions = ensureWorkflowAnalysisAssistantMessageSession({
        run: nextRun,
        analysis: result.data
      })
    }
  }
  nextRun.referenceFiles[nextRun.currentStepId] = result.data.documents || []
  if (isViewingAnalysisRun()) {
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
      workflowAnalysisResult.value = result.data
      syncWorkflowActiveStageFromAnalysis(result.data)
      workflowStageStatusMap.value = finalWorkflowStageStatuses(result.data?.totalDesignFlow)
      workflowCanvasLoading.value = false
    saveState(state)
    void loadModelCallLogs()
    setStatus(skillWorkbenchStatus, 'success', '已生成初步架构、交互路径树和跳转计划')
  }
  const savedRunResult = await api.workspace.createWorkflowRun(state.apiConfig, nextRun)
  let persistedRun = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
  persistedRun = mergeWorkflowAgentLocalSessionIntoRun(persistedRun, WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID)
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persistedRun)
  if (isViewingAnalysisRun()) state.activeWorkflowRun = persistedRun
  saveState(state)
  clearWorkflowEntryDocumentsAfterRun(workflowEntrySnapshot)
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
  return workflowStageCanvasNodeById(nodeId) ||
    workflowCurrentCanvasNodes.value.find((node) => node.id === nodeId) ||
    workflowCanvasNodes.value.find((node) => node.id === nodeId) ||
    null
}

function workflowStageCanvasNodeById(nodeId = '') {
  if (!nodeId) return null
  const stageCanvases = workflowStageTotalDesignFlow.value?.stageCanvases ||
    workflowTotalDesignFlow.value?.stageCanvases ||
    {}
  for (const canvas of Object.values(stageCanvases)) {
    const found = Array.isArray(canvas?.nodes)
      ? canvas?.nodes.find((node) => node?.id === nodeId)
      : null
    if (found) return found
  }
  return null
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

function persistWorkflowAnalysisResultToActiveRun() {
  if (state.activeWorkflowRun) {
    const nextRun = {
      ...state.activeWorkflowRun,
      documentAnalysis: workflowAnalysisResult.value,
      updatedAt: new Date().toISOString()
    }
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    saveState(state)
    api.workspace.createWorkflowRun(state.apiConfig, nextRun).then((savedRunResult) => {
      const persisted = savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persisted)
      state.activeWorkflowRun = persisted
      saveState(state)
    }).catch(() => {})
  }
}

function persistWorkflowCurrentStage(stageId) {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return
  workflowAnalysisResult.value = {
    ...workflowAnalysisResult.value,
    totalDesignFlow: {
      ...(workflowAnalysisResult.value.totalDesignFlow || {}),
      currentStage: stageId
    }
  }
  persistWorkflowAnalysisResultToActiveRun()
}

function selectWorkflowStage(stageId, options = {}) {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId || (options.skipGuard !== true && !canSelectWorkflowStage(stageId))) return
  if (workflowActiveStageId.value === stageId) {
    if (stageId !== WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID) setWorkflowAgentDisplayMode('hidden')
    return
  }
  workflowActiveStageTouchedByUser.value = true
  workflowActiveStageId.value = stageId
  if (stageId !== WORKFLOW_TOTAL_FLOW_ENTRY_STAGE_ID) setWorkflowAgentDisplayMode('hidden')
  persistWorkflowCurrentStage(stageId)
  workflowAgentNodeId.value = ''
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  workflowCanvasRefreshingNodeId.value = ''
}

function selectWorkflowStageAndRefresh(stageId = '', options = {}) {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId || !canSelectWorkflowStage(stageId)) return
  selectWorkflowStage(stageId)
  scheduleWorkflowStageAutoGeneration(stageId, { force: options.force === true })
}

function canAdvanceToConfirmedNextStage(stageId = '', previousStageId = '') {
  stageId = normalizeWorkflowStageId(stageId)
  previousStageId = normalizeWorkflowStageId(previousStageId)
  if (!stageId || !previousStageId) return false
  const stageIds = workflowStageIdsFromTotalFlow(workflowTotalDesignFlow.value)
  const targetIndex = stageIds.indexOf(stageId)
  const previousIndex = stageIds.indexOf(previousStageId)
  if (targetIndex < 0 || previousIndex < 0 || targetIndex !== previousIndex + 1) return false
  return Boolean(workflowStageConfirmation(previousStageId))
}

function selectWorkflowStageForPendingGeneration(stageId = '', options = {}) {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId || (!canSelectWorkflowStage(stageId) && !canAdvanceToConfirmedNextStage(stageId, options.confirmedPreviousStageId))) return false
  selectWorkflowStage(stageId, { skipGuard: true })
  mergeWorkflowStageStatus(stageId, 'generating', { pendingSummary: true })
  applyWorkflowStageStatusesToAnalysis()
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = workflowStageRefreshNodeId(stageId)
  setStatus(skillWorkbenchStatus, 'loading', '正在总结当前阶段并准备下一阶段画布...')
  return true
}

function workflowStageRefreshNodeId(stageId = workflowCurrentStageId.value) {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  const stageCanvas = workflowAnalysisResult.value?.totalDesignFlow?.stageCanvases?.[normalizedStageId] || null
  const sourceCanvas = isWorkflowAgentWorkbenchStageId(normalizedStageId)
    ? workflowAgentWorkbenchStageCanvas(normalizedStageId, stageCanvas || workflowStagePlaceholderCanvasForStage(normalizedStageId))
    : stageCanvas
  return sourceCanvas?.agentNode?.id ||
    (Array.isArray(sourceCanvas?.nodes) ? sourceCanvas.nodes[0]?.id : '') ||
    `${normalizedStageId}-loading`
}

function shouldAutoGenerateWorkflowStage(stageId = '') {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return false
  if (isManualArtifactStageId(stageId)) return false
  if (!canAutoGenerateWorkflowStage(stageId)) return false
  const currentStatus = workflowStageStatusMap.value?.[stageId]?.status || ''
  if (currentStatus === 'generating' && !shouldResumeAdvancedUxPendingStageGeneration(stageId)) return false
  if (currentStatus === 'paused') return false
  const stageCanvas = workflowAnalysisResult.value.totalDesignFlow.stageCanvases?.[stageId]
  if (!stageCanvas || !Array.isArray(stageCanvas.nodes) || !stageCanvas.nodes.length) return true
  return stageCanvas.nodes.every((node) =>
    node.loading === true ||
    node.id === `${stageId}-loading` ||
    node.contentStatus === 'model-pending'
  )
}

function workflowHtmlNodeHasGeneratedCode(node = {}) {
  return String(node?.artifactStatus || '').trim() === 'generated' &&
    Boolean(node?.codePreview?.code || node?.artifact?.html || node?.artifact?.code || node?.code)
}

function workflowHtmlStageNeedsGeneration(totalFlow = workflowTotalDesignFlow.value) {
  const htmlCanvas = totalFlow?.stageCanvases?.['html-output'] || null
  const nodes = Array.isArray(htmlCanvas?.nodes) ? htmlCanvas.nodes : []
  if (!nodes.length) return false
  return nodes.some((node) => !workflowHtmlNodeHasGeneratedCode(node))
}

function workflowHtmlStageIsGenerating(totalFlow = workflowTotalDesignFlow.value) {
  const status = String(workflowStageStatusMap.value?.['html-output']?.status || totalFlow?.stageStatuses?.['html-output']?.status || '').trim()
  const htmlCanvas = totalFlow?.stageCanvases?.['html-output'] || null
  const nodes = Array.isArray(htmlCanvas?.nodes) ? htmlCanvas.nodes : []
  return status === 'generating' || nodes.some((node) => String(node?.artifactStatus || '').trim() === 'generating')
}

function stopWorkflowHtmlStagePolling() {
  if (workflowHtmlStagePollTimer) {
    window.clearTimeout(workflowHtmlStagePollTimer)
    workflowHtmlStagePollTimer = null
  }
  workflowHtmlStageJobRunId = ''
}

function scheduleWorkflowHtmlStagePolling(runId = state.activeWorkflowRun?.id || '') {
  if (!runId) return
  if (workflowHtmlStagePollTimer) window.clearTimeout(workflowHtmlStagePollTimer)
  workflowHtmlStagePollTimer = window.setTimeout(() => {
    workflowHtmlStagePollTimer = null
    void pollWorkflowHtmlStageRun(runId)
  }, 15000)
}

function applyWorkflowHtmlStageRun(run = {}) {
  if (!run?.documentAnalysis?.totalDesignFlow) return
  state.activeWorkflowRun = {
    ...(state.activeWorkflowRun || {}),
    ...run
  }
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
  workflowAnalysisResult.value = normalizeWorkflowAnalysisForDisplay(run.documentAnalysis)
  syncWorkflowActiveStageFromAnalysis(workflowAnalysisResult.value)
  const totalFlow = workflowAnalysisResult.value?.totalDesignFlow || null
  const htmlStatus = totalFlow?.stageStatuses?.['html-output'] || {}
  if (htmlStatus.status) {
    workflowStageStatusMap.value = {
      ...workflowStageStatusMap.value,
      'html-output': htmlStatus
    }
  }
  if (workflowCurrentStageId.value === 'html-output') {
    workflowCanvasLoading.value = workflowHtmlStageIsGenerating(totalFlow)
    workflowCanvasRefreshingNodeId.value = workflowCanvasLoading.value
      ? (htmlStatus.currentNodeId || workflowStageRefreshNodeId('html-output'))
      : ''
  }
  saveState(state)
}

async function pollWorkflowHtmlStageRun(runId = state.activeWorkflowRun?.id || '') {
  if (!runId) return
  try {
    const result = await api.workspace.getWorkflowRun(state.apiConfig, runId)
    const run = result.ok && result.data?.run ? result.data.run : null
    if (!run) return
    applyWorkflowHtmlStageRun(run)
    const totalFlow = workflowAnalysisResult.value?.totalDesignFlow || null
    if (workflowHtmlStageIsGenerating(totalFlow) || workflowHtmlStageNeedsGeneration(totalFlow)) {
      setStatus(skillWorkbenchStatus, 'loading', workflowHtmlStageStatusText(totalFlow))
      scheduleWorkflowHtmlStagePolling(runId)
    } else {
      stopWorkflowHtmlStagePolling()
      workflowCanvasLoading.value = false
      workflowCanvasRefreshingNodeId.value = ''
      setStatus(skillWorkbenchStatus, 'success', 'HTML 阶段已生成并回填画布')
    }
  } catch (error) {
    void error
    scheduleWorkflowHtmlStagePolling(runId)
  }
}

function workflowHtmlStageStatusText(totalFlow = workflowTotalDesignFlow.value) {
  const status = totalFlow?.stageStatuses?.['html-output'] || workflowStageStatusMap.value?.['html-output'] || {}
  const generatedCount = Number(status.generatedCount || 0)
  const totalCount = Number(status.totalCount || totalFlow?.stageCanvases?.['html-output']?.nodes?.length || 0)
  const currentTitle = status.currentNodeTitle || ''
  if (totalCount > 0) {
    return currentTitle
      ? `后台正在生成 HTML：${generatedCount}/${totalCount}，当前 ${currentTitle}`
      : `后台正在生成 HTML：${generatedCount}/${totalCount}`
  }
  return '后台正在生成 HTML，完成后会自动回填画布。'
}

async function ensureWorkflowHtmlStageGeneration(options = {}) {
  const run = state.activeWorkflowRun || {}
  if (!run.id || workflowCurrentStageId.value !== 'html-output') return false
  const totalFlow = workflowAnalysisResult.value?.totalDesignFlow || null
  if (!workflowHtmlStageNeedsGeneration(totalFlow) && !workflowHtmlStageIsGenerating(totalFlow)) {
    stopWorkflowHtmlStagePolling()
    return false
  }
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = workflowStageRefreshNodeId('html-output')
  mergeWorkflowStageStatus('html-output', 'generating', workflowStageStatusMap.value?.['html-output'] || {})
  applyWorkflowStageStatusesToAnalysis()
  setStatus(skillWorkbenchStatus, 'loading', workflowHtmlStageStatusText(totalFlow))
  scheduleWorkflowHtmlStagePolling(run.id)
  if (workflowHtmlStageJobRunId === run.id && options.force !== true) return true
  workflowHtmlStageJobRunId = run.id
  try {
    const result = await api.workflows.generateHtmlStageArtifacts(state.apiConfig, run.id, {
      force: options.force === true,
      timeoutMs: 0
    }, {
      timeoutMs: workflowAgentRequestTimeoutMs()
    })
    const data = applyApiResult(skillWorkbenchStatus, result, '启动 HTML 阶段生成失败')
    if (data?.run) applyWorkflowHtmlStageRun(data.run)
    scheduleWorkflowHtmlStagePolling(run.id)
    return true
  } catch (error) {
    workflowHtmlStageJobRunId = ''
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `HTML 阶段生成启动失败：${error.message}` : 'HTML 阶段生成启动失败')
    scheduleWorkflowHtmlStagePolling(run.id)
    return false
  }
}

function workflowStageConfirmation(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  return normalizedStageId
    ? workflowAnalysisResult.value?.totalDesignFlow?.stageConfirmations?.[normalizedStageId] || null
    : null
}

const workflowRequirementDissectionConfirmed = computed(() =>
  Boolean(workflowStageConfirmation('requirement-dissection'))
)

function workflowStageIndexById(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  return workflowStageIdsFromTotalFlow(workflowTotalDesignFlow.value).indexOf(normalizedStageId)
}

function workflowStageRuntime(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  const runtime = normalizedStageId ? workflowTotalDesignFlow.value?.stageRuntime?.[normalizedStageId] : null
  return runtime && typeof runtime === 'object' ? runtime : null
}

function canSelectWorkflowStage(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  if (!normalizedStageId || normalizedStageId === 'requirement-dissection') return true
  const targetIndex = workflowStageIndexById(normalizedStageId)
  if (targetIndex < 0) return false
  const stageIds = workflowStageIdsFromTotalFlow(workflowTotalDesignFlow.value)
  const currentIndex = workflowStageIndexById(workflowCurrentStageId.value)
  if (currentIndex >= 0 && targetIndex <= currentIndex) return true
  const targetStatus = workflowStageStatusMap.value?.[normalizedStageId]?.status || workflowTotalDesignFlow.value?.stageStatuses?.[normalizedStageId]?.status || ''
  if (['generating', 'paused'].includes(targetStatus)) return true
  if (workflowStageCanvasHasRenderedContent(workflowTotalDesignFlow.value?.stageCanvases?.[normalizedStageId], normalizedStageId)) return true
  if (workflowStageConfirmation(normalizedStageId)) return true
  const previousStageId = stageIds[targetIndex - 1]
  if (previousStageId && workflowStageConfirmation(previousStageId)) return true
  const runtime = workflowStageRuntime(normalizedStageId)
  if (runtime && typeof runtime.canOpen === 'boolean') return runtime.canOpen === true
  return false
}

function canAutoGenerateWorkflowStage(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  if (!normalizedStageId || normalizedStageId === 'requirement-dissection') return true
  const targetIndex = workflowStageIndexById(normalizedStageId)
  if (targetIndex < 0) return false
  const stageIds = workflowStageIdsFromTotalFlow(workflowTotalDesignFlow.value)
  const previousStageId = stageIds[targetIndex - 1]
  return Boolean(previousStageId && workflowStageConfirmation(previousStageId))
}

function scheduleWorkflowStageAutoGeneration(stageId = workflowCurrentStageId.value) {
  const options = arguments[1] || {}
  stageId = normalizeWorkflowStageId(stageId)
  const force = options.force === true
  if (workflowStageAutoGenerationTimer.value) {
    window.clearTimeout(workflowStageAutoGenerationTimer.value)
    workflowStageAutoGenerationTimer.value = null
  }
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return
  workflowStageAutoGenerationTimer.value = window.setTimeout(() => {
    workflowStageAutoGenerationTimer.value = null
    if (isManualArtifactStageId(stageId)) return
    if (force) {
      const currentStatus = workflowStageStatusMap.value?.[stageId]?.status || ''
      if (currentStatus === 'generating') return
      void regenerateWorkflowStage(stageId)
      return
    }
    if (!shouldAutoGenerateWorkflowStage(stageId)) return
    void regenerateWorkflowStage(stageId)
  }, 80)
}

function persistWorkflowActiveSlice(sliceId) {
  if (!sliceId || !workflowAnalysisResult.value?.totalDesignFlow) return
  workflowAnalysisResult.value = {
    ...workflowAnalysisResult.value,
    totalDesignFlow: {
      ...(workflowAnalysisResult.value.totalDesignFlow || {}),
      activeSliceId: sliceId
    }
  }
  persistWorkflowAnalysisResultToActiveRun()
}

function selectWorkflowSlice(sliceId) {
  if (!sliceId) return
  persistWorkflowActiveSlice(sliceId)
}

function syncWorkflowActiveStageFromAnalysis(analysis = null) {
  const totalFlow = analysis?.totalDesignFlow || null
  if (!workflowActiveStageTouchedByUser.value) {
    workflowActiveStageId.value = firstOpenWorkflowStageId(totalFlow)
  }
  if (totalFlow?.stageStatuses) {
    workflowStageStatusMap.value = {
      ...inferredWorkflowStageStatuses(totalFlow, 'waiting'),
      ...persistedWorkflowStageStatuses(totalFlow),
      ...persistedWorkflowStageStatuses({ ...totalFlow, stageStatuses: workflowStageStatusMap.value }, { keepGenerating: workflowCanvasLoading.value })
    }
  }
}

function firstOpenWorkflowStageId(totalFlow = null) {
  const stages = normalizeWorkflowTotalFlowStages(totalFlow?.stages || [])
  if (!stages.length) return ''
  return normalizeWorkflowStageId(totalFlow?.currentStage || stages[0]?.id || '')
}

function pauseWorkflowStage(stageId) {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId) return
  workflowAnalysisStreamController.value?.abort?.()
  workflowAnalysisStreamController.value = null
  const stageIds = workflowStageIdsFromTotalFlow(workflowAnalysisResult.value?.totalDesignFlow)
  const startIndex = Math.max(0, stageIds.indexOf(stageId))
  const nextStatuses = { ...workflowStageStatusMap.value }
  stageIds.slice(startIndex).forEach((id) => {
    nextStatuses[id] = {
      ...(nextStatuses[id] || {}),
      status: 'paused',
      updatedAt: new Date().toISOString()
    }
  })
  workflowStageStatusMap.value = nextStatuses
  if (workflowAnalysisResult.value?.totalDesignFlow) {
    const currentStageCanvases = workflowAnalysisResult.value.totalDesignFlow.stageCanvases || {}
    const nextStageCanvases = { ...currentStageCanvases }
    stageIds.slice(startIndex).forEach((id) => {
      const existingCanvas = currentStageCanvases[id] || workflowStagePlaceholderCanvasForStage(id)
      if (workflowStageCanvasHasGeneratedContent(existingCanvas, id)) return
      nextStageCanvases[id] = workflowStagePausedCanvasForStage(id, existingCanvas)
    })
    workflowAnalysisResult.value = {
      ...workflowAnalysisResult.value,
      totalDesignFlow: {
        ...workflowAnalysisResult.value.totalDesignFlow,
        stageCanvases: nextStageCanvases
      }
    }
  }
  applyWorkflowStageStatusesToAnalysis(nextStatuses)
  workflowCanvasLoading.value = false
  workflowCanvasRefreshingNodeId.value = ''
  workflowCanvasRefreshingLayoutLabel.value = ''
  void persistWorkflowAnalysisProgressRun(state.activeWorkflowRun || {}, { immediate: true, status: state.activeWorkflowRun?.status || 'paused' })
  setStatus(skillWorkbenchStatus, 'info', '已暂停当前阶段及后续阶段生成')
}

function stopActiveWorkflowStageGenerationIfNeeded() {
  const stageId = normalizeWorkflowStageId(workflowCurrentStageId.value)
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return false
  const stageStatus = String(workflowStageStatusMap.value?.[stageId]?.status || workflowAnalysisResult.value.totalDesignFlow.stageStatuses?.[stageId]?.status || '').trim()
  const stageRuntimeState = String(workflowAnalysisResult.value.totalDesignFlow.stageRuntime?.[stageId]?.state || '').trim()
  const stageCanvas = workflowAnalysisResult.value.totalDesignFlow.stageCanvases?.[stageId] || null
  const hasPendingStageNode = Array.isArray(stageCanvas?.nodes) && stageCanvas.nodes.some((node) =>
    node?.loading === true ||
    node?.contentLoading === true ||
    node?.contentStatus === 'model-pending' ||
    node?.contentSource === 'model-pending' ||
    node?.artifactStatus === 'generating'
  )
  const shouldStopStage = Boolean(
    workflowAnalysisStreamController.value ||
    workflowCanvasLoading.value ||
    stageStatus === 'generating' ||
    stageRuntimeState === 'generating' ||
    hasPendingStageNode
  )
  if (!shouldStopStage) return false
  pauseWorkflowStage(stageId)
  return true
}

async function regenerateWorkflowStage(stageId) {
  stageId = normalizeWorkflowStageId(stageId)
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return
  mergeWorkflowStageStatus(stageId, 'generating', { regenerate: true })
  applyWorkflowStageStatusesToAnalysis()
  selectWorkflowStage(stageId)
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = workflowStageRefreshNodeId(stageId)
  setStatus(skillWorkbenchStatus, 'loading', '正在重新生成该阶段...')
  const run = state.activeWorkflowRun || {}
  const runProject = workflowProjectForRun(run)
  const runProjectId = runProject?.id || run.projectId || run.originProjectId || ''
  const stageInput = run.input || workflowForm.input || workflowAnalysisResult.value.input || ''
  const workflowSkillId = run.skillId || run.requestedSkillId || run.workflowId || 'auto'
  const stageKnowledgeDocuments = run.demandScope === 'project'
    ? [
        ...workflowSelectedKnowledgeScopeDocuments(stageInput, runProjectId),
        ...workflowKnowledgeContextDocuments(8, stageInput, runProjectId)
      ]
    : []
  const controller = new AbortController()
  workflowAnalysisStreamController.value?.abort?.()
  workflowAnalysisStreamController.value = controller
  const payload = {
    requestId: createClientId(),
    analysisRunId: run.id || workflowAnalysisResult.value.analysisRunId || '',
    stageId,
    regenerateStageId: stageId,
    skillSelectionMode: 'auto',
    skillId: workflowSkillId === 'total-design-flow' ? 'auto' : workflowSkillId,
    requestedSkillId: workflowSkillId === 'auto' ? 'total-design-flow' : workflowSkillId,
    demandScope: run.demandScope || workflowForm.demandScope,
    projectId: runProjectId,
    project: runProject || {},
    input: stageInput,
    documents: [
      ...(run.referenceFiles?.[run.currentStepId] || []),
      ...stageKnowledgeDocuments
    ],
    currentTotalDesignFlow: workflowAnalysisResult.value.totalDesignFlow,
    webSearchEnabled: workflowAgentWebSearchEnabled.value,
    timeoutMs: 0,
    generationTimeoutMs: 0
  }
  const result = await api.uploads.analyzeStageStream(state.apiConfig, payload, {
    timeoutMs: workflowAnalysisRequestTimeoutMs(),
    signal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'status' && event.data?.label) {
        setStatus(skillWorkbenchStatus, 'loading', event.data.label)
      }
      if (event.type === 'artifact' && event.data?.type === 'workflow-stage-canvas') {
        workflowAnalysisResult.value = mergeWorkflowStageCanvasEvent(
          workflowAnalysisResult.value || buildWorkflowAnalysisProgressResult(run),
          event.data
        )
        applyWorkflowStageStatusesToAnalysis()
        if (event.data.status === 'completed') {
          setStatus(skillWorkbenchStatus, 'success', `${event.data.stage?.name || '阶段'} 已重新生成`)
        }
      }
      if (event.type === 'artifact' && event.data?.type === 'advanced-ux-page-interaction-document') {
        const currentReport = workflowAnalysisResult.value?.advancedUxReport || workflowAnalysisResult.value?.totalDesignFlow?.advancedUxReport || {}
        const nextReport = {
          ...currentReport,
          pageInteractionDocument: event.data
        }
        workflowAnalysisResult.value = {
          ...(workflowAnalysisResult.value || buildWorkflowAnalysisProgressResult(run)),
          advancedUxReport: nextReport,
          totalDesignFlow: workflowAnalysisResult.value?.totalDesignFlow
            ? {
                ...workflowAnalysisResult.value.totalDesignFlow,
                advancedUxReport: {
                  ...(workflowAnalysisResult.value.totalDesignFlow.advancedUxReport || {}),
                  pageInteractionDocument: event.data
                },
                pageInteractionDocumentArtifact: event.data
              }
            : workflowAnalysisResult.value?.totalDesignFlow || null
        }
        upsertAdvancedUxPageInteractionDocumentAssistantMessage(run.id, event.data)
      }
      if (event.type === 'error') {
        mergeWorkflowStageStatus(stageId, 'failed')
        setStatus(skillWorkbenchStatus, 'failed', event.data?.message || '阶段重新生成失败')
      }
    }
  })
  if (!result.ok) {
    mergeWorkflowStageStatus(stageId, result.status === 'cancelled' ? 'paused' : 'failed')
    applyWorkflowStageStatusesToAnalysis()
    if (workflowAnalysisStreamController.value === controller) workflowAnalysisStreamController.value = null
    workflowCanvasLoading.value = false
    workflowCanvasRefreshingNodeId.value = ''
    if (result.status !== 'cancelled') setStatus(skillWorkbenchStatus, 'failed', result.message || '阶段重新生成失败')
    return
  }
  if (workflowAnalysisStreamController.value === controller) {
    workflowAnalysisStreamController.value = null
  }
  if (result.data?.totalDesignFlow || result.data?.totalFlowMeta) {
    const returnedTotalDesignFlow = normalizeWorkflowTotalFlowMeta(result.data.totalDesignFlow || result.data.totalFlowMeta)
    workflowAnalysisResult.value = {
      ...(workflowAnalysisResult.value || {}),
      ...result.data,
      totalDesignFlow: returnedTotalDesignFlow || workflowAnalysisResult.value?.totalDesignFlow || null
    }
    if (result.data.advancedUxReport || returnedTotalDesignFlow?.advancedUxReport) {
      upsertAdvancedUxMarkdownReportAssistantMessage(run.id, result.data.advancedUxReport || returnedTotalDesignFlow?.advancedUxReport)
    }
  }
  const regeneratedStage = workflowAnalysisResult.value?.totalDesignFlow?.stages?.find((stage) => stage.id === stageId) || {}
  workflowAnalysisResult.value = appendWorkflowStageRegenerateVersion(workflowAnalysisResult.value || {}, {
    stageId,
    stageName: regeneratedStage.name || stageId,
    label: `重新生成 ${regeneratedStage.name || stageId}`,
    summary: `${regeneratedStage.name || stageId} 已重新生成并保存版本`,
    diff: buildWorkflowStageDiff(workflowAnalysisResult.value, stageId)
  })
  applyWorkflowStageStatusesToAnalysis()
  void persistWorkflowAnalysisProgressRun(run, { immediate: true })
  workflowCanvasLoading.value = false
  workflowCanvasRefreshingNodeId.value = ''
}

function selectWorkflowCanvasNode(nodeId) {
  if (!nodeId) return
  const keepFullscreenNode = workflowFullscreenNodeId.value === nodeId
  workflowAgentNodeId.value = nodeId
  if (!keepFullscreenNode) workflowFullscreenNodeId.value = ''
  if (!keepFullscreenNode) workflowFullscreenEditNodeId.value = ''
  if (!keepFullscreenNode) workflowFullscreenNodeOverride.value = null
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
  return /确认此环节|确认结构|确认框架|确认路径|确认说明|确认文档|确认需求|确认档案|确认诊断|确认任务流|确认交接|确认 Demo|最终确认|下一步|进入下一步|入画布/.test(String(content || ''))
}

function isWorkflowStageAdvanceInput(content = '') {
  return /入画布|进入下一步|进入下一阶段|下一步|下一阶段|确认进入|确认并进入|确认当前阶段/.test(String(content || '').trim())
}

function workflowStageAdvanceUserMessage(content = '') {
  const normalized = String(content || '').trim()
  return isWorkflowStageAdvanceInput(normalized) || isWorkflowLowFiStageAdvanceAction(normalized)
    ? '进入下一阶段'
    : normalized
}

function appendWorkflowStageAdvanceUserMessage({
  content = '',
  currentStageId = '',
  nextStageId = '',
  scopeIds = [],
  clientMessageId = createClientId()
} = {}) {
  const displayContent = workflowStageAdvanceUserMessage(content)
  const uniqueScopeIds = Array.from(new Set(
    scopeIds
      .map((scopeId) => normalizeWorkflowStageId(scopeId))
      .filter(Boolean)
  ))
  uniqueScopeIds.forEach((scopeId, index) => {
    appendWorkflowAgentMessage('user', displayContent, {
      scopeId,
      id: index === 0 ? clientMessageId : `${clientMessageId}-${scopeId}`,
      meta: {
        action: 'stage-confirm-next',
        clientMessageId,
        sourceScopeId: currentStageId,
        stageId: currentStageId,
        nextStageId
      }
    })
  })
  return clientMessageId
}

function isWorkflowLowFiStageAdvanceAction(content = '') {
  // 需求分析阶段的“进入交互低保”（兼容旧文案“输出页面框架”）是确认并进入下一阶段，不是普通画布建议。
  return /进入交互低保|输出页面框架|页面框架|转低保真|生成低保真|低保真画布|低保真线框|进入低保/.test(String(content || '').trim())
}

function nextWorkflowStageId(stageId = workflowCurrentStageId.value) {
  const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
  const index = stages.findIndex((stage) => stage.id === normalizeWorkflowStageId(stageId))
  return index >= 0 ? (stages[index + 1]?.id || '') : ''
}

function confirmWorkflowStageFromAgentInput(content = '', scopeId = workflowAgentScopeId()) {
  const stageId = normalizeWorkflowStageId(scopeId || workflowCurrentStageId.value)
  if (!isWorkflowAgentWorkbenchStageId(stageId)) return false
  const confirmedNextStageId = recordWorkflowStageConfirmation({
    stageId,
    nextStageId: nextWorkflowStageId(stageId),
    nodeId: scopeId,
    action: content,
    summary: workflowChatOnlyStageSummaryForScope(scopeId)
  })
  if (confirmedNextStageId) selectWorkflowStageAndRefresh(confirmedNextStageId, { force: true })
  appendWorkflowAgentMessage('user', workflowStageAdvanceUserMessage(content), {
    scopeId,
    meta: {
      action: 'stage-confirm-next',
      clientMessageId: createClientId()
    }
  })
  appendWorkflowAgentMessage('assistant', confirmedNextStageId
    ? `已确认当前阶段，进入「${workflowStageNameById(confirmedNextStageId)}」。`
    : '已确认当前阶段。', {
    scopeId,
    meta: {
      hideStatus: true,
      action: 'stage-confirm-next',
      clientMessageId: createClientId()
    }
  })
  workflowAgentInput.value = ''
  saveState(state)
  return true
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
  if (/竞品|对标|参考对象|截图链接|知识库选择参考|找3个竞品|找三个竞品|找竞品/.test(normalized)) return 'competitor-reference-enrichment'
  if (/给布局方案|布局方案/.test(normalized)) return 'page-layout-plan'
  if (/补交互细节|交互细节/.test(normalized)) return 'interaction-detail-enrichment'
  if (/补充资料|补充细节|补充信息|补资料|资料/.test(normalized)) return 'supplement-detail'
  if (/重生成本页|重新分析|重新解析|重跑分析|重新生成分析/.test(normalized)) return 'reanalysis'
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
    'competitor-reference-enrichment': '围绕当前项目和需求分析节点补齐竞品参考证据：先区分真实证据、行业假设和待检索方向；没有链接/截图/知识库证据时，不要编造竞品事实，只输出可检索方向、候选维度和下一步采集动作。',
    'page-layout-plan': '基于当前页面节点生成 3 套可选择的框架布局方案，每套说明结构、首屏区域、关键模块位置、适用场景、风险取舍和写入影响。',
    'interaction-detail-enrichment': '补齐当前页面的点击、滑动、输入、长按、弹窗、状态反馈、异常兜底和跳转流程。',
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
  setWorkflowAgentComposerReference(workflowAgentContextReferenceForNode(targetNodeId, canvasAction))
  if (!workflowAgentInput.value.trim()) {
    workflowAgentInput.value = canvasAction.actionLabel
  }
  nextTick(() => workflowAgentDrawerRef.value?.focusComposer?.())
}

function isWorkflowAgentLayoutAlternativeRequest(content = '') {
  const normalized = String(content || '').replace(/\s+/g, '')
  return /还有其他方案|还有别的方案|还有更多方案|其他方案|别的方案|更多方案|换一批|再来(?:一批|几个|三套|3套)|重新给.*方案|不满意.*方案/.test(normalized)
}

function isWorkflowAgentCanvasUpdateRequest(content = '') {
  const normalized = String(content || '').replace(/\s+/g, '')
  if (!normalized) return false
  if (/^(下一步|无疑问|跳过|确认|采纳|应用到画布)$/.test(normalized)) return false
  return /^(更新|优化|调整|修改|重写|重做|重生成|重新生成|补充|细化)(当前)?(方案|节点|页面|本页|布局|交互|内容|框架|说明)/.test(normalized) ||
    /(方案|节点|页面|本页|布局|交互|框架|说明).*(更新|优化|调整|修改|重生成|重新生成|细化|补充)/.test(normalized)
}

function isWorkflowAgentLayoutPlanInputScope(scopeId = '') {
  if (normalizeWorkflowStageId(workflowCurrentStageId.value) !== 'interaction-lofi') return false
  const node = canvasNodeById(scopeId) || workflowAgentNode.value || {}
  return Boolean(node?.pageLayoutArtifact || node?.pageLayoutSpec || node?.layoutPlan || node?.structuredLayoutPlan)
}

function hasRecentWorkflowAgentLayoutOptions(scopeId = '') {
  const session = ensureWorkflowAgentSession(scopeId)
  for (const message of [...session].reverse()) {
    if (message?.role !== 'assistant') continue
    if (['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status)) continue
    return workflowAgentLayoutOptionsFromMessage(message).length >= 3
  }
  return false
}

function workflowAgentStageSummaryCandidateScore(message = {}, index = 0) {
  const text = workflowAgentMessageText(message)
  if (!text.trim() || ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status)) return -1
  let score = index / 1000
  if (/:::\s*page-layout-artifact/.test(text)) score += 50
  if (message?.meta?.action === 'stage-confirm-next') score += 20
  if (/Topic\/input composer|快捷提示词|Generate podcast/.test(text)) score += 30
  if (/##\s*ASCII 页面线框图/.test(text)) score += 10
  if (/##\s*模块交互明细/.test(text)) score += 10
  return score
}

function workflowAgentStageSummaryFromSendResult(result = {}, scopeId = workflowAgentScopeId()) {
  const candidates = []
  if (result?.assistantMessage) {
    candidates.push({
      message: result.assistantMessage,
      index: 100000
    })
  }
  const session = ensureWorkflowAgentSession(scopeId)
  session.forEach((message, index) => {
    if (message?.role !== 'assistant') return
    candidates.push({ message, index })
  })
  candidates.sort((a, b) =>
    workflowAgentStageSummaryCandidateScore(b.message, b.index) -
    workflowAgentStageSummaryCandidateScore(a.message, a.index)
  )
  const best = candidates.find((candidate) => workflowAgentStageSummaryCandidateScore(candidate.message, candidate.index) >= 0)
  return normalizeWorkflowStageSummaryText(workflowAgentMessageText(best?.message))
}

function normalizeWorkflowStageSummaryText(value = '') {
  return normalizeWorkflowAgentReplyContent(String(value || ''))
    .replace(/\\r\\n|\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isStageProgressionPayload(payload = {}) {
  return ['stage-agent-confirm-next', 'stage-canvas-confirm-next'].includes(payload?.mode) ||
    payload?.canvasAction?.actionIntent === 'stage-agent-confirm-next' ||
    payload?.canvasAction?.actionIntent === 'stage-canvas-confirm-next'
}

function workflowIsAdvancedUxActiveRun() {
  return isAdvancedUxWorkflowRun(state.activeWorkflowRun || {}) ||
    workflowForm.selectedWorkflowId === 'advanced-ux-requirement-analysis' ||
    Boolean(workflowAdvancedUxReportFromAnalysis(workflowAnalysisResult.value || {}))
}

function advancedUxStageConfirmationSummary(stageId = '') {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  const report = workflowAnalysisResult.value?.advancedUxReport ||
    workflowAnalysisResult.value?.totalDesignFlow?.advancedUxReport ||
    state.activeWorkflowRun?.documentAnalysis?.advancedUxReport ||
    state.activeWorkflowRun?.documentAnalysis?.totalDesignFlow?.advancedUxReport ||
    null
  if (normalizedStageId === 'requirement-dissection' && report?.markdown) {
    return `高级 UX 需求分析 Markdown 已生成并导入画布：${report.fileName || '高级 UX 需求分析.md'}`
  }
  const pageInteractionDocument = report?.pageInteractionDocument ||
    workflowAnalysisResult.value?.totalDesignFlow?.pageInteractionDocumentArtifact ||
    workflowAnalysisResult.value?.pageInteractionDocumentArtifact ||
    null
  if (normalizedStageId === 'interaction-lofi' && pageInteractionDocument?.markdown) {
    return `页面交互框架与说明 Markdown 已生成并导入交互低保画布：${pageInteractionDocument.fileName || '页面交互框架与说明.md'}`
  }
  return `${workflowStageNameById(normalizedStageId)}已确认，继续进入下一阶段。`
}

async function confirmAdvancedUxStageWithoutGenericAgentSummary({
  payload = {},
  action = '',
  currentStageId = '',
  nextStageId = '',
  targetScopeId = '',
  confirmedNextStageId = ''
} = {}) {
  const summary = advancedUxStageConfirmationSummary(currentStageId)
  const stageAdvanceClientMessageId = appendWorkflowStageAdvanceUserMessage({
    content: action,
    currentStageId,
    nextStageId: confirmedNextStageId || nextStageId,
    scopeIds: [currentStageId, confirmedNextStageId || nextStageId]
  })
  appendWorkflowAgentMessage('assistant', `已确认「${workflowStageNameById(currentStageId)}」，正在生成「${workflowStageNameById(nextStageId)}」。`, {
    scopeId: currentStageId,
    meta: {
      hideStatus: true,
      action: 'advanced-ux-stage-confirm-next',
      source: 'system',
      status: 'success',
      statusLabel: workflowAgentStatusLabel('success'),
      clientMessageId: stageAdvanceClientMessageId,
      stageId: currentStageId,
      nextStageId
    }
  })
  recordWorkflowStageConfirmation({
    ...payload,
    nodeId: targetScopeId,
    stageId: currentStageId,
    nextStageId,
    summary
  })
  setStatus(skillWorkbenchStatus, 'loading', `正在生成「${workflowStageNameById(confirmedNextStageId)}」...`)
  await regenerateWorkflowStage(confirmedNextStageId)
}

async function confirmWorkflowStageWithAgentSummary(payload = {}) {
  const action = String(payload.action || '').trim()
  const currentStageId = normalizeWorkflowStageId(payload.stageId || workflowCurrentStageId.value)
  const nextStageId = normalizeWorkflowStageId(payload.nextStageId || nextWorkflowStageId(currentStageId))
  const targetScopeId = isStageProgressionPayload(payload)
    ? currentStageId
    : (payload.nodeId || workflowAgentScopeId())
  if (!currentStageId || !nextStageId || !action) return
  if (targetScopeId && canvasNodeById(targetScopeId)) selectWorkflowCanvasNode(targetScopeId)
  const confirmedNextStageId = recordWorkflowStageConfirmation({
    ...payload,
    nodeId: targetScopeId,
    stageId: currentStageId,
    nextStageId
  })
  if (!selectWorkflowStageForPendingGeneration(confirmedNextStageId, { confirmedPreviousStageId: currentStageId })) return
  if (workflowIsAdvancedUxActiveRun()) {
    await confirmAdvancedUxStageWithoutGenericAgentSummary({
      payload,
      action,
      currentStageId,
      nextStageId,
      targetScopeId,
      confirmedNextStageId
    })
    return
  }
  const stageAdvanceClientMessageId = appendWorkflowStageAdvanceUserMessage({
    content: action,
    currentStageId,
    nextStageId,
    scopeIds: confirmedNextStageId !== targetScopeId ? [confirmedNextStageId] : []
  })
  const result = await sendWorkflowAgentMessage(workflowStageAdvanceUserMessage(action), {
    ignoreDraftState: true,
    clientMessageId: stageAdvanceClientMessageId,
    nodeId: targetScopeId,
    skipStageAdvanceInputHandling: true,
    action: 'stage-confirm-next',
    canvasAction: {
      action,
      actionLabel: '确认并进入下一阶段',
      actionIntent: payload.mode || 'stage-agent-confirm-next',
      nodeId: targetScopeId,
      stageId: currentStageId,
      nextStageId
    }
  })
  const summary = workflowAgentStageSummaryFromSendResult(result, targetScopeId)
  if (!summary) {
    mergeWorkflowStageStatus(confirmedNextStageId, 'failed')
    applyWorkflowStageStatusesToAnalysis()
    workflowCanvasLoading.value = false
    workflowCanvasRefreshingNodeId.value = ''
    setStatus(skillWorkbenchStatus, 'failed', '没有拿到当前阶段总结，暂不生成下一阶段画布。')
    return
  }
  recordWorkflowStageConfirmation({
    ...payload,
    nodeId: targetScopeId,
    stageId: currentStageId,
    nextStageId,
    summary
  })
  setStatus(skillWorkbenchStatus, 'loading', '已完成当前阶段总结，正在生成下一阶段画布...')
  await regenerateWorkflowStage(confirmedNextStageId)
}

function isWorkflowAgentCanvasAdviceQuickReply(content = '') {
  const normalized = String(content || '').trim()
  if (!normalized) return false
  if (/^(下一步|调整本阶段)$/.test(normalized)) return false
  if (/转低保真画布/.test(normalized)) return true
  if (/^(给布局方案|补交互细节|重生成本页)$/.test(normalized)) return true
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
  if (isWorkflowLowFiStageAdvanceAction(action) && isWorkflowAgentWorkbenchStageId(workflowCurrentStageId.value)) {
    const currentStageId = workflowCurrentStageId.value
    const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
    const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
    const nextStage = stages[currentIndex + 1] || null
    const targetNodeId = nodeId || workflowAgentScopeId()
    void confirmWorkflowStageWithAgentSummary({
      nodeId: targetNodeId,
      action,
      stageId: currentStageId,
      nextStageId: nextStage?.id || '',
      mode: 'stage-agent-confirm-next'
    })
    return
  }
  if (['stage-agent-workbench', 'stage-agent-confirm-next', 'stage-canvas-confirm-next'].includes(payload?.mode)) {
    const targetNodeId = nodeId || workflowAgentScopeId()
    if (payload.mode === 'stage-canvas-confirm-next') {
      void confirmWorkflowStageWithAgentSummary(payload)
      return
    }
    if (payload.mode === 'stage-agent-confirm-next') {
      void confirmWorkflowStageWithAgentSummary(payload)
      return
    }
    if (targetNodeId) selectWorkflowCanvasNode(targetNodeId)
    void sendWorkflowAgentMessage(action, {
      ignoreDraftState: true,
      nodeId: targetNodeId,
      action: 'stage-agent-message',
      canvasAction: {
        action: action || '',
        actionLabel: '阶段 Agent 对话',
        actionIntent: payload.mode,
        nodeId: targetNodeId,
        stageId: payload.stageId || '',
        nextStageId: payload.nextStageId || ''
      }
    })
    return
  }
  if (payload?.generationAction) {
    runWorkflowGenerationAction(payload)
    return
  }
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
    sendWorkflowAgentCanvasAction(action || '重新分析', nodeId || workflowAgentScopeId())
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

function normalizeRequirementDissectionRunQuickReplies(run = {}) {
  const quickReplies = run?.agentQuickReplies || {}
  const normalizedEntries = Object.entries(quickReplies).map(([scopeId, replies]) => {
    if (!['requirement-dissection', 'requirement-dissection-agent'].includes(scopeId)) return [scopeId, replies]
    return [scopeId, normalizeRequirementDissectionQuickReplies(replies, 6)]
  })
  return {
    ...run,
    agentQuickReplies: Object.fromEntries(normalizedEntries)
  }
}

function recordWorkflowStageConfirmation(payload = {}) {
  const stageId = normalizeWorkflowStageId(payload.stageId || workflowCurrentStageId.value || workflowActiveStageId.value)
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return ''
  const currentAnalysis = workflowAnalysisResult.value
  const currentTotalFlow = currentAnalysis.totalDesignFlow || {}
  const confirmedNextStageId = normalizeWorkflowStageId(payload.nextStageId || '')
  const stage = (Array.isArray(currentTotalFlow.stages) ? currentTotalFlow.stages : [])
    .find((item) => item?.id === stageId) || {}
  const nextStage = (Array.isArray(currentTotalFlow.stages) ? currentTotalFlow.stages : [])
    .find((item) => item?.id === confirmedNextStageId) || {}
  const rawSummary = payload.summary || (
    isWorkflowChatOnlyStageScope(payload.nodeId || workflowAgentScopeId())
      ? workflowChatOnlyStageSummaryForScope(payload.nodeId || workflowAgentScopeId())
      : String(payload.action || '').slice(0, 1200)
  )
  const confirmation = {
    stageId,
    stageName: stage.name || payload.stageName || stageId,
    nextStageId: confirmedNextStageId,
    nextStageName: nextStage.name || payload.nextStageName || '',
    nodeId: payload.nodeId || '',
    summary: normalizeWorkflowStageSummaryText(rawSummary),
    confirmedAt: new Date().toISOString()
  }
  const nextAnalysis = appendWorkflowStageConfirmationVersion({
    ...currentAnalysis,
    totalDesignFlow: {
      ...currentTotalFlow,
      currentStage: confirmedNextStageId || stageId,
      stageConfirmations: {
        ...(currentTotalFlow.stageConfirmations || {}),
        [stageId]: confirmation
      }
    }
  }, {
    stageId,
    stageName: confirmation.stageName,
    label: `确认 ${confirmation.stageName}`,
    summary: confirmation.summary || `${confirmation.stageName} 已确认`
  })
  workflowAnalysisResult.value = nextAnalysis
  if (state.activeWorkflowRun) {
    const nextRun = normalizeRequirementDissectionRunQuickReplies({
      ...state.activeWorkflowRun,
      documentAnalysis: nextAnalysis,
      updatedAt: confirmation.confirmedAt
    })
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    saveState(state)
    api.workspace.createWorkflowRun(state.apiConfig, nextRun).then((savedRunResult) => {
      const persisted = normalizeRequirementDissectionRunQuickReplies(
        savedRunResult.ok && savedRunResult.data?.run ? savedRunResult.data.run : nextRun
      )
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, persisted)
      state.activeWorkflowRun = persisted
      saveState(state)
    }).catch(() => {})
  }
  return confirmedNextStageId
}

function patchWorkflowCanvasNodeArtifactStatus(nodeId = '', patch = {}) {
  if (!nodeId || !workflowAnalysisResult.value) return false
  // Generation results update the same canvas node across root canvas and
  // totalDesignFlow.stageCanvases; otherwise UI visual/detail views drift apart.
  const updateNode = (node = {}) => {
    if (node?.id !== nodeId) return node
    const incomingAction = patch.generationAction && typeof patch.generationAction === 'object'
      ? patch.generationAction
      : null
    const generationActions = Array.isArray(node.generationActions)
      ? node.generationActions.map((action) => {
          const actionId = action?.id || action?.label || action
          const incomingId = incomingAction?.id || incomingAction?.label
          if (!incomingAction || actionId !== incomingId) return action
          return {
            ...(typeof action === 'object' ? action : { label: String(action || '') }),
            ...incomingAction
          }
        })
      : node.generationActions
    return {
      ...node,
      ...patch,
      generationActions,
      visualPreview: patch.visualPreview && typeof patch.visualPreview === 'object'
        ? { ...(node.visualPreview && typeof node.visualPreview === 'object' ? node.visualPreview : {}), ...patch.visualPreview }
        : patch.visualPreview ?? node.visualPreview,
      contentStatusLabel: patch.contentStatusLabel || node.contentStatusLabel
    }
  }
  const patchCanvas = (canvas = {}) => {
    if (!Array.isArray(canvas.nodes)) return canvas
    return {
      ...canvas,
      nodes: canvas.nodes.map(updateNode)
    }
  }
  const currentAnalysis = workflowAnalysisResult.value
  const currentTotalFlow = currentAnalysis.totalDesignFlow || null
  const nextStageCanvases = currentTotalFlow?.stageCanvases
    ? Object.fromEntries(Object.entries(currentTotalFlow.stageCanvases).map(([stageId, canvas]) => [stageId, patchCanvas(canvas)]))
    : undefined
  const nextAnalysis = {
    ...currentAnalysis,
    canvas: patchCanvas(currentAnalysis.canvas || {}),
    totalDesignFlow: currentTotalFlow
      ? {
          ...currentTotalFlow,
          stageCanvases: nextStageCanvases
        }
      : currentTotalFlow
  }
  workflowAnalysisResult.value = nextAnalysis
  if (state.activeWorkflowRun) {
    const nextRun = {
      ...state.activeWorkflowRun,
      documentAnalysis: nextAnalysis,
      updatedAt: new Date().toISOString()
    }
    state.activeWorkflowRun = nextRun
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
  }
  return true
}

function workflowVisualPreviewImage(node = {}) {
  const preview = node?.visualPreview && typeof node.visualPreview === 'object' ? node.visualPreview : {}
  return String(preview.imageDataUrl || preview.imageUrl || node?.artifact?.imageDataUrl || node?.artifact?.imageUrl || '').trim()
}

function workflowVisualAspectRatioLabel(node = {}) {
  const preview = node?.visualPreview && typeof node.visualPreview === 'object' ? node.visualPreview : {}
  const brief = node?.visualBrief && typeof node.visualBrief === 'object' ? node.visualBrief : {}
  const artifact = node?.artifact && typeof node.artifact === 'object' ? node.artifact : {}
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

function workflowCodeArtifactLanguage(node = {}) {
  const preview = node?.codePreview && typeof node.codePreview === 'object' ? node.codePreview : {}
  const artifact = node?.artifact && typeof node.artifact === 'object' ? node.artifact : {}
  const candidates = [
    preview.codeLanguage,
    preview.language,
    artifact.kind,
    artifact.language,
    node?.targetGenerator,
    node?.stageId
  ]
  for (const candidate of candidates) {
    const value = String(candidate || '').trim().toLowerCase()
    if (/vue/.test(value)) return 'vue'
    if (/html/.test(value)) return 'html'
  }
  return ''
}

function isWorkflowPlaceholderCodeArtifact(code = '') {
  const source = String(code || '').trim()
  if (!source) return false
  return /根据交互低保与 UI 视觉生成 HTML 页面|根据交互低保与 UI 视觉生成 Vue 页面/.test(source)
}

function isWorkflowRunnableCodeArtifact(code = '', language = '') {
  const source = String(code || '').trim()
  if (!source || isWorkflowPlaceholderCodeArtifact(source)) return false
  const normalizedLanguage = String(language || '').trim().toLowerCase()
  const hasHtmlShell = /<!doctype\s+html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<article[\s>]|<div[\s>]/i.test(source)
  const hasVueShell = /<template[\s>]|<script\s+setup[\s>]|export\s+default\s*\{/i.test(source)
  const isUpstreamSpecText = /Screen Contract|页面契约|asciiWireframe|ASCII\s*框架|上一阶段交互低保|交互低保\s*ASCII/i.test(source)
  if (isUpstreamSpecText && !hasHtmlShell && !hasVueShell) return false
  if (normalizedLanguage === 'vue') return /<template[\s>]/i.test(source) || hasVueShell
  if (normalizedLanguage === 'html') return hasHtmlShell
  return hasHtmlShell || hasVueShell || !isUpstreamSpecText
}

function workflowCodeGenerationLanguage(node = {}, generationAction = {}, payload = {}) {
  const candidates = [
    generationAction?.targetGenerator,
    payload?.targetGenerator,
    node?.targetGenerator,
    node?.stageId,
    generationAction?.label,
    payload?.action
  ]
  for (const candidate of candidates) {
    const value = String(candidate || '').trim().toLowerCase()
    if (/vue/.test(value)) return 'vue'
    if (/html/.test(value)) return 'html'
  }
  return ''
}

function workflowCodeArtifactSource(node = {}) {
  const preview = node?.codePreview && typeof node.codePreview === 'object' ? node.codePreview : {}
  const artifact = node?.artifact && typeof node.artifact === 'object' ? node.artifact : {}
  const previewFiles = Array.isArray(preview.files) ? preview.files : []
  const artifactFiles = Array.isArray(artifact.files) ? artifact.files : []
  const language = workflowCodeArtifactLanguage(node)
  const fileByLanguage = (files = [], expectedLanguage = '') => files.find((file) => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) return false
    const content = String(file.content || '').trim()
    if (!content) return false
    const fileHint = [
      file.language,
      file.kind,
      file.type,
      file.filePath,
      file.path,
      file.name
    ].map((item) => String(item || '').toLowerCase()).join(' ')
    if (expectedLanguage === 'vue') return /vue/.test(fileHint) || /<template[\s>]/i.test(content)
    if (expectedLanguage === 'html') return /html/.test(fileHint) || /<!doctype\s+html|<html[\s>]/i.test(content)
    return true
  })
  const primaryArtifactFile = fileByLanguage(artifactFiles, language) || fileByLanguage(artifactFiles, '')
  const primaryPreviewFile = fileByLanguage(previewFiles, language) || fileByLanguage(previewFiles, '')
  const orderedCandidates = language === 'html'
    ? [
        artifact.html,
        artifact.code,
        primaryArtifactFile?.content,
        preview.html,
        primaryPreviewFile?.content,
        preview.code
      ]
    : language === 'vue'
      ? [
          artifact.vue,
          artifact.code,
          primaryArtifactFile?.content,
          preview.vue,
          primaryPreviewFile?.content,
          preview.code
        ]
      : [
          artifact.html,
          artifact.vue,
          artifact.code,
          primaryArtifactFile?.content,
          preview.html,
          preview.vue,
          primaryPreviewFile?.content,
          preview.code
        ]
  for (const candidate of orderedCandidates) {
    const source = String(candidate || '').trim()
    if (isWorkflowRunnableCodeArtifact(source, language)) return source
  }
  return ''
}

function workflowCodeArtifactFileName(node = {}) {
  const preview = node?.codePreview && typeof node.codePreview === 'object' ? node.codePreview : {}
  const language = workflowCodeArtifactLanguage(node)
  const filePath = String(preview.filePath || '').trim()
  if (filePath) return filePath.split('/').filter(Boolean).at(-1) || filePath
  if (language === 'vue') return 'App.vue'
  return 'index.html'
}

function workflowCodeArtifactSignature(node = {}) {
  const source = workflowCodeArtifactSource(node)
  if (!source) return ''
  return [
    workflowCodeArtifactLanguage(node),
    source.length,
    source.slice(0, 80),
    source.slice(-80)
  ].join(':')
}

function workflowVisualTargetPreset(node = {}) {
  const text = [
    node?.title,
    node?.summary,
    node?.visualBrief?.pageTitle,
    node?.visualBrief?.goal,
    node?.visualPreview?.imagePrompt,
    state.activeWorkflowRun?.input,
    state.activeWorkflowRun?.workflowName
  ].map((item) => String(item || '')).join(' ')
  if (/web|网页|后台|管理端|PC|桌面|dashboard|admin/i.test(text) && !/小程序|移动端|手机|app|mobile/i.test(text)) {
    return { width: 1920, surface: 'web' }
  }
  return { width: 375, surface: 'app' }
}

function workflowVisualGenerationContext(node = {}) {
  const targetPreset = workflowVisualTargetPreset(node)
  const targetAspectRatio = workflowVisualAspectRatioLabel(node)
  if (!workflowAgentAllowsProjectKnowledge()) {
    return { targetAspectRatio, targetImageSize: { width: targetPreset.width }, projectVisualContext: null }
  }
  const nodeTitle = normalizeWorkflowVisualNodeTitle(node?.title || node?.visualBrief?.pageTitle || '')
  const projectId = workflowAgentKnowledgeProjectId()
  const project = state.projects.find((item) => item.id === projectId) ||
    workflowProjectForRun(state.activeWorkflowRun || {}) ||
    {}
  const projectVisualContext = buildProjectVisualContext({
    project,
    assets: scopeItems(state.assets, projectId),
    materials: scopeItems(state.knowledge, projectId),
    nodeTitle
  })
  return {
    targetAspectRatio,
    targetImageSize: { width: targetPreset.width },
    projectVisualContext
  }
}

function appendWorkflowGeneratedCodeAgentMessage(node = {}, generationAction = {}, options = {}) {
  const source = workflowCodeArtifactSource(node)
  if (!node?.id || !source) return ''
  const language = workflowCodeArtifactLanguage(node) || workflowCodeGenerationLanguage(node, generationAction) || 'html'
  const label = language === 'vue' ? 'Vue 代码' : 'HTML 代码'
  const scopeId = options.scopeId || node.id
  removeWorkflowAgentBusyMessages(scopeId)
  return appendWorkflowAgentMessage('assistant', `已生成「${node.title || '当前页面'}」${label}。\n\n\`\`\`${language}\n${source}\n\`\`\``, {
    scopeId,
    meta: {
      nodeId: node.id,
      action: 'generated-code',
      hideStatus: true,
      generatedCodeSignature: workflowCodeArtifactSignature(node),
      generatedCodeLanguage: language,
      generatedCodeFileName: workflowCodeArtifactFileName(node),
      generationAction: generationAction?.label || generationAction?.id || ''
    }
  })
}

function ensureWorkflowAgentCodeArtifactMessage(nodeId = '', options = {}) {
  const node = canvasNodeById(nodeId)
  if (!node?.id || !workflowCodeArtifactSource(node)) return ''
  const scopeId = options.scopeId || node.id
  const signature = workflowCodeArtifactSignature(node)
  const session = ensureWorkflowAgentSession(scopeId)
  const hasCodeArtifact = session.some((message) =>
    message?.role === 'assistant' &&
    message?.meta?.action === 'generated-code' &&
    message?.meta?.generatedCodeSignature === signature
  )
  if (hasCodeArtifact) return ''
  return appendWorkflowGeneratedCodeAgentMessage(node, {}, { scopeId })
}

function workflowVisualArtifactMessagePayload(node = {}, generationAction = {}) {
  const imageUrl = workflowVisualPreviewImage(node)
  if (!node?.id || !imageUrl) return null
  return {
    title: node.title || '高保真图',
    imageUrl,
    provider: node.visualPreview?.provider || node.visualPreview?.model || node.artifact?.provider || node.artifact?.model || '',
    aspectRatio: workflowVisualAspectRatioLabel(node),
    prompt: node.visualPreview?.imagePrompt || '',
    fileName: `${node.title || 'visual-image'}.png`,
    generationAction: generationAction?.label || generationAction?.id || ''
  }
}

function appendWorkflowVisualArtifactAgentMessage(node = {}, generationAction = {}, options = {}) {
  const visualArtifact = workflowVisualArtifactMessagePayload(node, generationAction)
  if (!node?.id || !visualArtifact) return ''
  const scopeId = options.scopeId || node.id
  removeWorkflowAgentBusyMessages(scopeId)
  return appendWorkflowAgentMessage('assistant', `已生成「${node.title || '当前页面'}」高保真图。`, {
    scopeId,
    meta: {
      nodeId: node.id,
      action: 'visual-artifact-generated',
      hideStatus: true,
      visualArtifact
    }
  })
}

function ensureWorkflowAgentVisualArtifactMessage(nodeId = '', options = {}) {
  const node = canvasNodeById(nodeId)
  const visualArtifact = workflowVisualArtifactMessagePayload(node)
  if (!node?.id || !visualArtifact) return ''
  const scopeId = options.scopeId || node.id
  const session = ensureWorkflowAgentSession(scopeId)
  const hasVisualArtifact = session.some((message) =>
    message?.role === 'assistant' &&
    message?.meta?.action === 'visual-artifact-generated' &&
    String(message?.meta?.visualArtifact?.imageUrl || message?.meta?.visualArtifact?.imageDataUrl || '').trim() === visualArtifact.imageUrl
  )
  if (hasVisualArtifact) return ''
  const emptyIndex = session.findIndex((message) =>
    message?.role === 'assistant' &&
    message?.meta?.action === 'visual-artifact-generated' &&
    !String(message?.meta?.visualArtifact?.imageUrl || message?.meta?.visualArtifact?.imageDataUrl || '').trim()
  )
  if (emptyIndex >= 0) {
    const nextSession = [...session]
    const previous = nextSession[emptyIndex]
    nextSession[emptyIndex] = {
      ...previous,
      content: previous.content || `已生成「${node.title || '当前页面'}」高保真图。`,
      meta: {
        ...(previous.meta || {}),
        hideStatus: true,
        visualArtifact: {
          ...(previous.meta?.visualArtifact || {}),
          ...visualArtifact
        }
      }
    }
    syncWorkflowAgentSessionChange(scopeId, nextSession)
    if (state.activeWorkflowRun) {
      saveState(state)
      api.workspace.createWorkflowRun(state.apiConfig, state.activeWorkflowRun).catch(() => {})
    }
    return nextSession[emptyIndex].id || ''
  }
  const messageId = appendWorkflowVisualArtifactAgentMessage(node, {}, { scopeId })
  if (messageId && state.activeWorkflowRun) {
    saveState(state)
    api.workspace.createWorkflowRun(state.apiConfig, state.activeWorkflowRun).catch(() => {})
  }
  return messageId
}

// Agent artifact cards must use the hydrated canvas node when the API result
// node has not yet reflected persisted image URLs from workspace storage.
function workflowAgentGeneratedArtifactNode(data = {}, nodeId = '') {
  const returnedNode = data.node && typeof data.node === 'object' && !Array.isArray(data.node) ? data.node : null
  const currentNode = canvasNodeById(nodeId)
  if (workflowCodeArtifactSource(returnedNode)) return returnedNode
  if (workflowCodeArtifactSource(currentNode)) return currentNode
  if (workflowVisualPreviewImage(currentNode) && !workflowVisualPreviewImage(returnedNode)) return currentNode
  return returnedNode || currentNode || {}
}

function workflowGenerationAgentScopeId(nodeId = '') {
  const fallbackScopeId = nodeId || workflowAgentScopeId()
  if (workflowUsesStageAgentScope.value) {
    return workflowCurrentStageId.value || fallbackScopeId
  }
  return fallbackScopeId
}

function workflowGeneratedArtifactFailed(node = {}) {
  const preview = node?.visualPreview && typeof node.visualPreview === 'object' ? node.visualPreview : {}
  const artifact = node?.artifact && typeof node.artifact === 'object' ? node.artifact : {}
  return String(node?.artifactStatus || '').trim() === 'failed' ||
    String(preview.imageStatus || '').trim() === 'failed' ||
    String(artifact.imageStatus || '').trim() === 'failed'
}

function workflowGeneratedArtifactFailureMessage(node = {}) {
  const preview = node?.visualPreview && typeof node.visualPreview === 'object' ? node.visualPreview : {}
  const artifact = node?.artifact && typeof node.artifact === 'object' ? node.artifact : {}
  return String(
    preview.failureMessage ||
    preview.configurationMessage ||
    artifact.failureMessage ||
    artifact.configurationMessage ||
    artifact.error ||
    '图片生成失败，可重新生成。'
  ).trim()
}

async function runWorkflowGenerationAction(payload = {}) {
  const nodeId = payload.nodeId || workflowAgentScopeId()
  const generationAction = {
    ...(payload.generationAction || {}),
    status: 'generating'
  }
  if (nodeId) selectWorkflowCanvasNode(nodeId)
  openWorkflowAgent()
  const agentScopeId = workflowGenerationAgentScopeId(nodeId)
  const visualGenerationSourceNode = canvasNodeById(nodeId) || {}
  const visualGenerationContext = workflowVisualGenerationContext(visualGenerationSourceNode)
  const codeGenerationLanguage = workflowCodeGenerationLanguage(visualGenerationSourceNode, generationAction, payload)
  const isCodeGeneration = Boolean(codeGenerationLanguage)
  const generationLabel = generationAction.label || payload.action || (isCodeGeneration ? '生成页面代码' : '生成高保真图')
  const generationTargetTitle = canvasNodeById(nodeId)?.title || nodeId || '当前页面'
  removeWorkflowAgentBusyMessages(agentScopeId)
  appendWorkflowAgentMessage('user', `${generationLabel}：${generationTargetTitle}`, {
    scopeId: agentScopeId,
    meta: {
      action: isCodeGeneration ? 'code-artifact-generation-request' : 'visual-artifact-generation-request',
      clientMessageId: createClientId()
    }
  })
  appendWorkflowAgentMessage('assistant', isCodeGeneration
    ? `正在生成${codeGenerationLanguage === 'vue' ? ' Vue 代码' : ' HTML 代码'}，完成后会把代码回填到画布。`
    : '正在生成高保真图，完成后会把图片回填到画布。', {
    scopeId: agentScopeId,
    trace: workflowAgentPendingTraceItems(),
    meta: {
      status: 'generating',
      statusLabel: workflowAgentStatusLabel('generating'),
      action: isCodeGeneration ? 'code-artifact-generation' : 'visual-artifact-generation',
      placeholderOnly: true,
      ...(isCodeGeneration ? {} : {
        visualArtifact: {
          title: visualGenerationSourceNode.title || '高保真图',
          status: 'generating',
          aspectRatio: visualGenerationContext.targetAspectRatio || '',
          targetImageSize: visualGenerationContext.targetImageSize,
          generationAction: generationLabel
        }
      })
    }
  })
  scrollWorkflowAgentToBottomTick()
  workflowCanvasRefreshingNodeId.value = nodeId
  patchWorkflowCanvasNodeArtifactStatus(nodeId, {
    artifactStatus: 'generating',
    ...(isCodeGeneration ? {} : {
      visualPreview: {
        imageStatus: 'generating'
      }
    }),
    generationAction: {
      ...generationAction,
      status: 'generating'
    },
    contentStatusLabel: '生成中'
  })
  const targetLabel = generationAction.targetGenerator || payload.targetGenerator || '生成器'
  setStatus(skillWorkbenchStatus, 'loading', `正在准备${generationLabel || '生成'}，目标：${targetLabel}`)
  try {
    const run = ensureActiveWorkflowRunForAgent()
    if (!run?.id) throw new Error('当前没有可保存的工作流运行')
    const result = await api.workflows.generateCanvasNodeArtifact(state.apiConfig, run.id, nodeId, {
      nodeId,
      generationAction,
      targetGenerator: generationAction.targetGenerator || payload.targetGenerator || '',
      projectVisualContext: visualGenerationContext.projectVisualContext,
      targetAspectRatio: visualGenerationContext.targetAspectRatio,
      targetImageSize: visualGenerationContext.targetImageSize,
      analysis: workflowAnalysisResult.value
    }, {
      timeoutMs: workflowAgentRequestTimeoutMs()
    })
    const data = applyApiResult(skillWorkbenchStatus, result, '生成产物失败')
    if (!data?.analysis) throw new Error('后端没有返回可回填的生成结果')
    workflowAnalysisResult.value = data.analysis
    if (state.activeWorkflowRun) {
      const localAgentSessions = state.activeWorkflowRun.agentSessions || {}
      const nextRun = {
        ...state.activeWorkflowRun,
        ...(data.run || {}),
        agentSessions: localAgentSessions,
        documentAnalysis: data.analysis,
        projectBlueprint: data.analysis.blueprint || data.run?.projectBlueprint || state.activeWorkflowRun.projectBlueprint,
        updatedAt: data.run?.updatedAt || new Date().toISOString()
      }
      state.activeWorkflowRun = nextRun
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, nextRun)
    }
    workflowAgentNodeId.value = nodeId
    const generatedNode = workflowAgentGeneratedArtifactNode(data, nodeId)
    if (workflowGeneratedArtifactFailed(generatedNode)) {
      throw new Error(workflowGeneratedArtifactFailureMessage(generatedNode))
    }
    patchWorkflowCanvasNodeArtifactStatus(nodeId, {
      artifactStatus: 'generated',
      generationAction: {
        ...generationAction,
        status: 'generated'
      },
      contentStatusLabel: '已生成'
    })
    if (workflowCodeArtifactSource(generatedNode)) {
      appendWorkflowGeneratedCodeAgentMessage(generatedNode, generationAction, { scopeId: agentScopeId })
    } else {
      appendWorkflowVisualArtifactAgentMessage(generatedNode, generationAction, { scopeId: agentScopeId })
    }
    if (state.activeWorkflowRun) {
      saveState(state)
      api.workspace.createWorkflowRun(state.apiConfig, state.activeWorkflowRun).catch(() => {})
    }
    scrollWorkflowAgentToBottomTick()
    workflowCanvasRefreshingNodeId.value = ''
    setStatus(skillWorkbenchStatus, 'success', `${generationLabel || '生成'}已完成并回填画布`)
  } catch (error) {
    patchWorkflowCanvasNodeArtifactStatus(nodeId, {
      artifactStatus: 'failed',
      ...(isCodeGeneration ? {} : {
        visualPreview: {
          imageStatus: 'failed',
          failureMessage: error.message || '图片生成失败，可重新生成。'
        }
      }),
      generationAction: {
        ...generationAction,
        status: 'failed'
      },
      contentStatusLabel: '生成失败'
    })
    removeWorkflowAgentBusyMessages(agentScopeId)
    appendWorkflowAgentMessage('assistant', error.message
      ? `${isCodeGeneration ? '页面代码' : '高保真图'}生成失败：${error.message}`
      : `${isCodeGeneration ? '页面代码' : '高保真图'}生成失败，可重新生成。`, {
      scopeId: agentScopeId,
      meta: {
        status: 'failed',
        statusLabel: workflowAgentStatusLabel('failed'),
        action: isCodeGeneration ? 'code-artifact-generation' : 'visual-artifact-generation',
        error: {
          message: error.message || `${isCodeGeneration ? '页面代码' : '图片'}生成失败，可重新生成。`
        }
      }
    })
    scrollWorkflowAgentToBottomTick()
    setStatus(skillWorkbenchStatus, 'failed', error.message ? `${generationLabel}失败：${error.message}` : `${generationLabel}失败`)
  } finally {
    workflowCanvasRefreshingNodeId.value = ''
  }
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

async function applyWorkflowAgentStageSupplement(payload = {}) {
  const stageId = normalizeWorkflowStageId(payload.stageId || workflowCurrentStageId.value || workflowActiveStageId.value)
  const confirmedContent = String(payload.confirmedContent || '').trim()
  if (!stageId || !workflowAnalysisResult.value?.totalDesignFlow) return false
  if (!confirmedContent) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可应用到当前阶段画布的 Agent 内容')
    return true
  }
  const targetNodeId = workflowAgentResolvedNodeId(payload.nodeId) || workflowStageRefreshNodeId(stageId)
  if (targetNodeId) selectWorkflowCanvasNode(targetNodeId)
  recordWorkflowStageConfirmation({
    stageId,
    nodeId: targetNodeId,
    action: payload.action || '应用到画布',
    summary: confirmedContent
  })
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId || workflowStageRefreshNodeId(stageId)
  setStatus(skillWorkbenchStatus, 'loading', '正在把 Agent 内容应用到当前阶段画布...')
  await regenerateWorkflowStage(stageId)
  return true
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
  const recoveredRun = recoverInterruptedWorkflowAgentSessions(run)
  if (isDialogueSkillRecord(recoveredRun) && !isWorkflowRunAnalysisFinal(recoveredRun)) {
    openDialogueSkillRecord(recoveredRun)
    return
  }
  if (!isWorkflowRunAnalysisFinal(recoveredRun)) {
    state.activeWorkflowRun = recoveredRun
    workflowActiveStageTouchedByUser.value = false
    const displayAnalysis = normalizeWorkflowAnalysisForDisplay(recoveredRun?.documentAnalysis)
    workflowAnalysisResult.value = displayAnalysis?.canvas ? displayAnalysis : workflowAnalysisResult.value
    workflowCanvasLoading.value = true
    startWorkflowAnalysisDeepLinkPolling(recoveredRun?.id)
    return
  }
  workflowCanvasLoading.value = false
  const analysisSessions = ensureWorkflowAnalysisAssistantMessageSession({
    run: recoveredRun,
    analysis: recoveredRun.documentAnalysis
  })
  const finalizedRun = {
    ...recoveredRun,
    agentSessions: recoverInterruptedWorkflowAgentSessions({
      ...recoveredRun,
      agentSessions: finalizeWorkflowAnalysisAgentSessions({
        ...recoveredRun,
        agentSessions: analysisSessions
      })
    }).agentSessions
  }
  const runProject = workflowProjectForRun(finalizedRun)
  const runProjectId = runProject?.id || ''
  if (runProjectId && runProjectId !== state.currentProjectId) {
    applyProjectSelection({
      currentProjectId: runProjectId,
      activeWorkflowRun: finalizedRun,
      selectedAssetId: '',
      selectedRestoredPageId: ''
    })
  } else {
    state.activeWorkflowRun = finalizedRun
  }
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, finalizedRun)
  workflowActiveStageTouchedByUser.value = false
  const displayAnalysis = normalizeWorkflowAnalysisForDisplay(finalizedRun.documentAnalysis)
  workflowAnalysisResult.value = displayAnalysis
  workflowStageStatusMap.value = finalWorkflowStageStatuses(displayAnalysis.totalDesignFlow)
  syncWorkflowActiveStageFromAnalysis(displayAnalysis)
  workflowAgentNodeId.value = displayAnalysis.totalDesignFlow?.stageCanvases?.[workflowActiveStageId.value]?.nodes?.[0]?.id ||
    displayAnalysis.canvas?.nodes?.[0]?.id ||
    'analysis'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  activeDemoScreenId.value = finalizedRun.projectBlueprint?.demoScreens?.[0]?.id || ''
  workflowBlueprintTab.value = 'framework'
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  if (currentWorkflowAnalysisDeepLinkRunId() === finalizedRun.id) syncWorkflowAnalysisRoute(finalizedRun.id, 'replace')
  syncWorkflowDraftFromRun()
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  })
}

function openDialogueSkillRecord(run = {}) {
  stopWorkflowAnalysisDeepLinkPolling()
  const runProjectId = workflowProjectIdForRun(run.id)
  if (runProjectId && runProjectId !== state.currentProjectId) {
    applyProjectSelection({
      currentProjectId: runProjectId,
      activeWorkflowRun: run,
      selectedAssetId: '',
      selectedRestoredPageId: ''
    })
  } else {
    state.activeWorkflowRun = run
  }
  workflowActiveStageId.value = ''
  workflowActiveStageTouchedByUser.value = false
  const displayAnalysis = normalizeWorkflowAnalysisForDisplay(run.documentAnalysis)
  workflowAnalysisResult.value = displayAnalysis?.canvas ? displayAnalysis : null
  workflowCanvasLoading.value = false
  workflowAgentNodeId.value = 'dialogue-agent'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  showWorkflowAgentSidebar()
  if (run.id && currentWorkflowAnalysisDeepLinkRunId() === run.id) syncWorkflowAnalysisRoute(run.id, 'replace')
  syncWorkflowDraftFromRun()
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  })
}

function prepareWorkflowAnalysisRecordLoading(runId, fallbackRun = null) {
  activeView.value = 'workflow'
  workflowRoute.value = 'canvas'
  workflowCanvasLoading.value = true
  const displayAnalysis = normalizeWorkflowAnalysisForDisplay(fallbackRun?.documentAnalysis)
  workflowAnalysisResult.value = displayAnalysis?.canvas ? displayAnalysis : null
  workflowAgentNodeId.value = workflowDefaultAgentNodeIdForAnalysis(displayAnalysis || fallbackRun?.documentAnalysis) || 'analysis'
  workflowFullscreenNodeId.value = ''
  workflowFullscreenEditNodeId.value = ''
  setStatus(skillWorkbenchStatus, 'loading', '正在打开分析记录...')
}

async function openWorkflowAnalysisRecord(runId) {
  if (!runId) return
  const run = (state.workflowRuns || []).find((item) => item.id === runId)
  prepareWorkflowAnalysisRecordLoading(runId, run)
  syncWorkflowAnalysisRoute(runId)
  if (isDialogueSkillRecord(run)) {
    openDialogueSkillRecord(run)
    return
  }
  if (isWorkflowRunAnalysisFinal(run)) {
    const loaded = await loadWorkflowRunDetail(runId, { fallbackRun: run })
    if (!loaded) openWorkflowCanvasRun(run)
    return
  }
  const loaded = await loadWorkflowRunDetail(runId, { fallbackRun: run })
  if (!loaded && isWorkflowAnalysisRouteActive()) {
    ensureWorkflowDeepLinkRouteState()
    startWorkflowAnalysisDeepLinkPolling(runId)
    setStatus(skillWorkbenchStatus, 'loading', '正在读取完整分析画布...')
    return
  }
  if (!loaded) {
    workflowCanvasLoading.value = false
    workflowRoute.value = 'entry'
    setStatus(skillWorkbenchStatus, 'failed', '没有获取到完整分析画布，请稍后重试或检查后端运行记录。')
  }
}

function adjustWorkflowCanvasZoom(delta) {
  workflowCanvasZoom.value = Math.min(2.2, Math.max(0.25, workflowCanvasZoom.value + delta))
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
    totalDesignFlow: normalizeWorkflowTotalFlowMeta(version.snapshot.totalDesignFlow) || workflowAnalysisResult.value.totalDesignFlow,
    qualityGate: version.snapshot.qualityGate || workflowAnalysisResult.value.qualityGate,
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
  workflowAgentNodeId.value = nextAnalysis.totalDesignFlow?.stageCanvases?.[workflowCurrentStageId.value]?.nodes?.[0]?.id ||
    nextAnalysis.canvas?.nodes?.[0]?.id ||
    'analysis'
  workflowFullscreenNodeId.value = ''
  setStatus(skillWorkbenchStatus, 'success', `已回滚到 ${version.label || version.id}`)
}

function ensureActiveWorkflowRunForAgent() {
  if (state.activeWorkflowRun) return state.activeWorkflowRun
  const analysis = workflowAnalysisResult.value
  if (!analysis) return null
  const agentCanvas = analysis.canvas || workflowCanvas.value || { nodes: [], edges: [], orderedTabs: [] }
  const agentCanvasNodes = (Array.isArray(workflowCurrentCanvasNodes.value) && workflowCurrentCanvasNodes.value.length)
    ? workflowCurrentCanvasNodes.value
    : Array.isArray(agentCanvas.nodes) ? agentCanvas.nodes : []
  if (!agentCanvasNodes.length) return null
  const existingRun = (state.workflowRuns || []).find((run) =>
    run?.documentAnalysis === analysis ||
    (analysis.canvas && run?.documentAnalysis?.canvas === analysis.canvas) ||
    (analysis.canvas && run?.documentAnalysis?.canvas?.nodes?.length && run.documentAnalysis.canvas.nodes === analysis.canvas.nodes)
  )
  if (existingRun) {
    state.activeWorkflowRun = existingRun
    return existingRun
  }
  const documentAnalysis = analysis.canvas ? analysis : {
    ...analysis,
    canvas: {
      ...agentCanvas,
      nodes: agentCanvasNodes
    }
  }
  const fallbackRun = {
    id: analysis.runId || analysis.id || `local-analysis-${Date.now()}`,
    workflowId: analysis.workflowId || 'document-analysis',
    workflowName: analysis.blueprint?.title || analysis.title || '需求分析画布',
    assetType: '页面蓝图',
    input: analysis.summary?.input || '',
    currentStepId: workflowAgentNodeId.value || agentCanvasNodes[0]?.id || 'analysis',
    steps: agentCanvasNodes.map((node, index) => ({
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
    status: analysis.status || 'analyzed',
    documentAnalysis,
    projectBlueprint: analysis.blueprint || null,
    createdAt: analysis.createdAt || new Date().toISOString(),
    updatedAt: analysis.updatedAt || new Date().toISOString()
  }
  state.activeWorkflowRun = fallbackRun
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, fallbackRun)
  return fallbackRun
}

function openWorkflowAgentForNode(nodeId) {
  const targetNodeId = workflowCanvasResolvableNodeId(nodeId)
  workflowAgentNodeId.value = targetNodeId
  const artifactScopeId = workflowGenerationAgentScopeId(targetNodeId)
  ensureWorkflowAgentCodeArtifactMessage(targetNodeId, { scopeId: artifactScopeId })
  ensureWorkflowAgentVisualArtifactMessage(targetNodeId, { scopeId: artifactScopeId })
  openWorkflowAgent()
}

function workflowAgentScopeId() {
  if (workflowUsesStageAgentScope.value) {
    return workflowCurrentStageId.value
  }
  return workflowAgentNodeId.value || workflowAgentNode.value?.id || activeWorkflowStep.value?.id || ''
}

function workflowAgentResolvedNodeId(candidateId = '') {
  if (candidateId && canvasNodeById(candidateId)) return candidateId
  const scopeId = workflowAgentScopeId()
  if (scopeId && canvasNodeById(scopeId)) return scopeId
  return workflowCurrentCanvasNodes.value[0]?.id || ''
}

function workflowAgentIsChatOnlyScope(scopeId = workflowAgentScopeId()) {
  return isWorkflowChatOnlyStageScope(scopeId)
}

function workflowStageNameById(stageId = workflowCurrentStageId.value) {
  const normalizedStageId = normalizeWorkflowStageId(stageId)
  if (!normalizedStageId) return '当前阶段'
  const stages = Array.isArray(workflowTotalDesignFlow.value?.stages) ? workflowTotalDesignFlow.value.stages : []
  const stage = stages.find((item) => item?.id === normalizedStageId)
  return workflowStageDisplayName(stage || { id: normalizedStageId, name: normalizedStageId }) || normalizedStageId
}

function workflowChatOnlyStageSummaryForScope(scopeId = workflowAgentScopeId()) {
  const messages = Array.isArray(state.activeWorkflowRun?.agentSessions?.[scopeId])
    ? state.activeWorkflowRun.agentSessions[scopeId]
    : []
  return buildWorkflowStageConfirmationSummary({
    messages,
    fallback: `${workflowStageNameById(scopeId)}已确认，继续进入下一阶段`
  })
}

function workflowAdvancedUxReportContext(run = state.activeWorkflowRun || {}) {
  const report = run?.documentAnalysis?.advancedUxReport ||
    run?.documentAnalysis?.totalDesignFlow?.advancedUxReport ||
    workflowAnalysisResult.value?.advancedUxReport ||
    workflowAnalysisResult.value?.totalDesignFlow?.advancedUxReport ||
    null
  const markdown = String(report?.markdown || '').trim()
  if (!markdown) return null
  return {
    status: report.status || 'generated',
    fileName: report.fileName || '高级 UX 需求分析.md',
    artifactType: report.artifactType || 'requirements-markdown',
    markdown
  }
}

function workflowCanvasDownstreamNodes(nodeId) {
  const nodes = (Array.isArray(workflowCurrentCanvasNodes.value) ? workflowCurrentCanvasNodes.value : []).filter((node) => node && typeof node === 'object' && !Array.isArray(node))
  if (!nodes.length) return []
  const index = nodes.findIndex((node) => node.id === nodeId)
  if (index < 0) return nodes
  return nodes.slice(index)
}

function workflowAgentRequestContext(options = {}) {
  const explicitNode = options.nodeId ? canvasNodeById(options.nodeId) : null
  const node = explicitNode || workflowAgentNode.value
  const runProject = workflowProjectForRun(state.activeWorkflowRun || {})
  return {
    projectId: workflowAgentKnowledgeProjectId(),
    project: runProject || {},
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
    canvasAction: options.canvasAction || null,
    advancedUxReport: workflowAdvancedUxReportContext(state.activeWorkflowRun || {})
  }
}

function workflowAgentContextReferenceForNode(nodeId = '', canvasAction = null) {
  const node = canvasNodeById(nodeId) || workflowAgentNode.value || null
  if (!node) return null
  const summarySource = [
    node.summary,
    node.description,
    node.goal,
    Array.isArray(node.content) ? node.content.find((item) => String(item || '').trim()) : ''
  ].map((item) => String(item || '').replace(/\s+/g, ' ').trim()).find(Boolean)
  const actionLabel = String(canvasAction?.actionLabel || canvasAction?.action || '').trim()
  return {
    type: 'canvas-node',
    nodeId: node.id || nodeId,
    stageId: node.stageId || workflowCurrentStageId.value || '',
    action: actionLabel,
    canvasAction: canvasAction || null,
    kindLabel: '正在引用画布节点',
    ariaLabel: '当前消息引用的画布节点',
    title: node.title || node.name || node.id || '当前节点',
    summary: summarySource || actionLabel
  }
}

function setWorkflowAgentComposerReference(reference = null) {
  workflowAgentComposerReference.value = reference
}

function clearWorkflowAgentComposerReference() {
  workflowAgentComposerReference.value = null
}

function workflowAgentAllowsProjectKnowledge() {
  const runScope = state.activeWorkflowRun?.demandScope || workflowForm.demandScope
  return runScope === 'project'
}

function workflowAgentKnowledgeProjectId() {
  if (!workflowAgentAllowsProjectKnowledge()) return ''
  return state.activeWorkflowRun?.projectId || ''
}

function workflowAgentKnowledgeQuery(query = '', scopeId = '') {
  const node = canvasNodeById(scopeId) || workflowAgentNode.value || {}
  return [
    query,
    workflowStageNameById(scopeId),
    node.title,
    node.summary,
    ...(Array.isArray(node.content) ? node.content : [])
  ].map((item) => String(item || '').trim()).filter(Boolean).join('\n')
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

function workflowAgentMessageAttachmentFromReference(file = {}) {
  if (!isWorkflowAgentReferenceFile(file)) return null
  return {
    id: String(file.id || createClientId()),
    name: String(file.name || file.title || '参考文件'),
    kind: String(file.kind || 'document'),
    type: String(file.type || ''),
    status: String(file.status || 'pending'),
    preview: String(file.preview || ''),
    errorMessage: String(file.errorMessage || '')
  }
}

function workflowAgentPendingMessageAttachments(scopeId = workflowAgentScopeId(), attachmentIds = null) {
  const idSet = Array.isArray(attachmentIds) && attachmentIds.length
    ? new Set(attachmentIds.map((id) => String(id)))
    : null
  return workflowAgentReferencePayload(scopeId)
    .filter((file) => !idSet || idSet.has(String(file.id || '')))
    .map(workflowAgentMessageAttachmentFromReference)
    .filter(isWorkflowAgentReferenceFile)
}

function clearWorkflowAgentSentReferences(scopeId = workflowAgentScopeId(), attachments = []) {
  if (!attachments.length) return
  const sentIds = new Set(attachments.map((file) => String(file.id || '')).filter(Boolean))
  if (!sentIds.size) return
  const references = ensureWorkflowReferenceFiles(scopeId)
  references.splice(0, references.length, ...references.filter((file) => !sentIds.has(String(file.id || ''))))
}

function syncWorkflowAgentSessionChange(scopeId = workflowAgentScopeId(), nextSession = null) {
  if (!state.activeWorkflowRun || !scopeId) return
  const session = Array.isArray(nextSession) ? nextSession : [...(state.activeWorkflowRun.agentSessions?.[scopeId] || [])]
  state.activeWorkflowRun = {
    ...state.activeWorkflowRun,
    agentSessions: {
      ...(state.activeWorkflowRun.agentSessions || {}),
      [scopeId]: session
    },
    updatedAt: new Date().toISOString()
  }
  state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
}

function appendWorkflowAgentMessage(role, content, options = {}) {
  const scopeId = options.scopeId || workflowAgentScopeId()
  const session = ensureWorkflowAgentSession(scopeId)
  if (!session) return
  const message = {
    id: options.id || createClientId(),
    role,
    content,
    createdAt: options.createdAt || new Date().toISOString(),
    ...(Array.isArray(options.trace) ? { trace: options.trace } : {}),
    ...(options.meta ? { meta: options.meta } : {})
  }
  const nextSession = [...session, message]
  syncWorkflowAgentSessionChange(scopeId, nextSession)
  return message.id
}

function replaceWorkflowAgentMessage(messageId, nextMessage, scopeId = workflowAgentScopeId()) {
  const session = ensureWorkflowAgentSession(scopeId)
  const index = session.findIndex((message) => message.id === messageId)
  if (index < 0) return false
  const nextSession = [...session]
  nextSession[index] = {
    ...nextSession[index],
    ...nextMessage,
    id: messageId,
    createdAt: nextMessage.createdAt || nextSession[index].createdAt
  }
  syncWorkflowAgentSessionChange(scopeId, nextSession)
  return true
}

function replaceOrAppendWorkflowAgentMessage(messageId, nextMessage, scopeId = workflowAgentScopeId()) {
  if (replaceWorkflowAgentMessage(messageId, nextMessage, scopeId)) return messageId
  return appendWorkflowAgentMessage(nextMessage.role || 'assistant', workflowAgentMessageText(nextMessage), {
    scopeId,
    id: nextMessage.id || messageId || undefined,
    createdAt: nextMessage.createdAt,
    trace: nextMessage.trace,
    meta: nextMessage.meta
  })
}

function removeWorkflowAgentBusyMessages(scopeId = workflowAgentScopeId()) {
  const session = ensureWorkflowAgentSession(scopeId)
  const nextSession = session.filter((message) =>
    !(message?.role === 'assistant' && ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status))
  )
  if (nextSession.length !== session.length) syncWorkflowAgentSessionChange(scopeId, nextSession)
}

function workflowAgentMessageById(messageId, scopeId = workflowAgentScopeId()) {
  return ensureWorkflowAgentSession(scopeId).find((message) => message.id === messageId) || null
}

function isWorkflowAgentStructuredStreamContent(content = '') {
  const value = String(content || '').trim()
  if (!value) return false
  if (/^```(?:json)?\s*\{/i.test(value)) return true
  if (/^[{\[]/.test(value) && /"(content|message|answer|reply|title|summary|proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact|nodeId)"\s*:/.test(value)) return true
  return /"(proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact)"\s*:/.test(value)
}

const workflowAgentStreamKeyLabels = {
  title: '标题',
  summary: '摘要',
  content: '正文',
  message: '正文',
  answer: '回答',
  reply: '回复',
  intent: '意图',
  detectedIntent: '识别意图',
  detected_intent: '识别意图',
  routingReason: '路由原因',
  routing_reason: '路由原因',
  outputPurpose: '输出用途',
  output_purpose: '输出用途',
  conclusion: '结论',
  evidence: '关键依据',
  keyEvidence: '关键依据',
  key_evidence: '关键依据',
  sections: '分析章节',
  section: '分析章节',
  qualityReport: '质量报告',
  quality_report: '质量报告',
  missingInformation: '缺失信息',
  missing_information: '缺失信息',
  checks: '检查项',
  proposal: '建议方案',
  structuredProposal: '结构化方案',
  agentProposal: 'Agent 提案',
  writeableContent: '可写入内容',
  downstreamImpact: '后续影响',
  canvasContent: '画布内容',
  demandSummary: '需求摘要',
  businessGoal: '业务目标',
  coreLoop: '核心闭环',
  openQuestions: '待确认问题',
  pendingQuestions: '待确认问题',
  recommendations: '建议',
  nextStep: '下一步'
}

function workflowAgentStreamKeyLabel(key = '') {
  const normalized = String(key || '').trim()
  if (workflowAgentStreamKeyLabels[normalized]) return workflowAgentStreamKeyLabels[normalized]
  return normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readWorkflowAgentJsonStringValueAt(text = '', startIndex = 0) {
  let result = ''
  let escaping = false
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]
    if (escaping) {
      if (char === 'n') result += '\n'
      else if (char === 'r') result += '\r'
      else if (char === 't') result += '\t'
      else result += char
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === '"') return result
    result += char
  }
  return result
}

function workflowAgentPartialStructuredStreamText(content = '') {
  const value = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  if (!value) return ''
  const lines = []
  const seen = new Set()
  const fieldPattern = /"([^"]+)"\s*:\s*"/g
  let match
  while ((match = fieldPattern.exec(value))) {
    const key = match[1]
    if (!key || seen.has(key)) continue
    const text = readWorkflowAgentJsonStringValueAt(value, match.index + match[0].length).trim()
    if (!text) continue
    seen.add(key)
    if (['content', 'message', 'answer', 'reply'].includes(key)) {
      lines.push(text)
    } else if (['title'].includes(key)) {
      lines.push(`# ${text}`)
    } else if (['summary'].includes(key)) {
      lines.push(`## ${workflowAgentStreamKeyLabel(key)}\n${text}`)
    } else {
      lines.push(`## ${workflowAgentStreamKeyLabel(key)}\n${text}`)
    }
  }
  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function sanitizeWorkflowAgentModelLeakText(content = '') {
  let value = String(content || '').trim()
  if (!value) return ''
  value = value
    .replace(/^我会先按会话规则加载必要的 [`'"]?using-superpowers[`'"]? skill，然后直接产出你要求的 JSON。[ \t\n]*/i, '')
    .replace(/^我会先按会话规则加载必要的 [`'"]?using-superpowers[`'"]? skill，然后[^\n。]*。[ \t\n]*/i, '')
    .replace(/^Using [^\n]+ skill[^\n]*\n+/i, '')
  return value.trim()
}

function workflowAgentStreamDisplayContent(content = '') {
  const value = String(content || '').trim()
  if (!value) return ''
  if (isWorkflowAgentStructuredStreamContent(value)) {
    try {
      const parsed = JSON.parse(value.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, ''))
      const text = workflowAgentPartialStructuredStreamText(JSON.stringify(parsed))
      if (text) return sanitizeWorkflowAgentModelLeakText(text)
    } catch {
      return sanitizeWorkflowAgentModelLeakText(workflowAgentPartialStructuredStreamText(value) || value)
    }
  }
  return sanitizeWorkflowAgentModelLeakText(value)
}

function normalizeWorkflowAgentTraceItem(item = {}) {
  const key = String(item.key || '').trim()
  if (!key) return null
  const label = String(item.label || key).trim()
  const status = String(item.status || 'running').trim()
  const text = String(item.text || item.summary || '').trim()
  return {
    key,
    label,
    status,
    text,
    summary: String(item.summary || text || '').trim()
  }
}

function mergeWorkflowAgentTrace(currentTrace = [], patch = {}) {
  const current = Array.isArray(currentTrace)
    ? currentTrace.map(normalizeWorkflowAgentTraceItem).filter(Boolean)
    : []
  const nextItem = normalizeWorkflowAgentTraceItem(patch)
  if (!nextItem) return current
  const index = current.findIndex((item) => item.key === nextItem.key)
  if (index >= 0) {
    current[index] = {
      ...current[index],
      ...nextItem,
      text: nextItem.text || current[index].text,
      summary: nextItem.summary || current[index].summary
    }
    return current
  }
  return [...current, nextItem]
}

function workflowAgentTraceFromProgress(key, label, status, text = '') {
  return { key, label, status, text, summary: text }
}

function workflowAgentMessageTrace(message = {}) {
  return Array.isArray(message?.trace) ? message.trace : []
}

function scrollWorkflowAgentToBottomTick() {
  nextTick(() => workflowAgentDrawerRef.value?.scrollAgentChatToBottom?.('auto'))
}

async function typeWorkflowAgentAssistantMessage(messageId, assistantMessage, options = {}) {
  const fullContent = workflowAgentMessageText(assistantMessage)
  const requestToken = options.requestToken || ''
  const skipTypewriter = options.skipTypewriter || assistantMessage.meta?.action === 'dialogue-skill-canvas-content' || fullContent.length > 1200
  if (assistantMessage.meta?.streamedContentPreserved) {
    replaceOrAppendWorkflowAgentMessage(messageId, {
      ...assistantMessage,
      content: fullContent,
      meta: {
        ...(assistantMessage.meta || {}),
        status: assistantMessage.meta?.status || 'success',
        statusLabel: assistantMessage.meta?.statusLabel || workflowAgentStatusLabel('success'),
        typewriterFullContent: fullContent,
        typewriterDone: true
      }
    }, options.scopeId)
    scrollWorkflowAgentToBottomTick()
    return
  }
  const meta = {
    ...(assistantMessage.meta || {}),
    status: skipTypewriter ? (assistantMessage.meta?.status || 'success') : 'generating',
    statusLabel: skipTypewriter ? (assistantMessage.meta?.statusLabel || workflowAgentStatusLabel('success')) : workflowAgentStatusLabel('generating'),
    typewriterFullContent: fullContent,
    typewriterDone: skipTypewriter
  }
  if (skipTypewriter) {
    replaceOrAppendWorkflowAgentMessage(messageId, {
      ...assistantMessage,
      content: fullContent,
      meta
    }, options.scopeId)
    scrollWorkflowAgentToBottomTick()
    return
  }
  if (!fullContent) {
    replaceOrAppendWorkflowAgentMessage(messageId, {
      ...assistantMessage,
      meta: {
        ...(assistantMessage.meta || {}),
        status: assistantMessage.meta?.status || 'success',
        statusLabel: assistantMessage.meta?.statusLabel || workflowAgentStatusLabel('success'),
        typewriterFullContent: fullContent,
        typewriterDone: true
      }
    }, options.scopeId)
    scrollWorkflowAgentToBottomTick()
    return
  }
  const step = options.step ?? 18
  for (let index = Math.min(step, fullContent.length); index < fullContent.length; index += step) {
    if (requestToken && workflowAgentRequestToken.value !== requestToken) return
    replaceOrAppendWorkflowAgentMessage(messageId, {
      ...assistantMessage,
      content: fullContent.slice(0, index),
      meta
    }, options.scopeId)
    scrollWorkflowAgentToBottomTick()
    await wait(options.delayMs ?? 3)
  }
  if (requestToken && workflowAgentRequestToken.value !== requestToken) return
  replaceOrAppendWorkflowAgentMessage(messageId, {
    ...assistantMessage,
    content: fullContent,
    meta: {
      ...(assistantMessage.meta || {}),
      status: assistantMessage.meta?.status || 'success',
      statusLabel: assistantMessage.meta?.statusLabel || workflowAgentStatusLabel('success'),
      typewriterFullContent: fullContent,
      typewriterDone: true
    }
  }, options.scopeId)
  scrollWorkflowAgentToBottomTick()
}

function removeWorkflowAgentMessage(messageId) {
  const session = ensureWorkflowAgentSession()
  const index = session.findIndex((message) => message.id === messageId)
  if (index >= 0) session.splice(index, 1)
}

function readWorkflowReferenceFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function triggerWorkflowFileUpload(type = 'all') {
  workflowUploadAccept.value = workflowUploadAcceptMap[type] || workflowUploadAcceptMap.all
  if (workflowFileInput.value) workflowFileInput.value.value = ''
  requestAnimationFrame(() => workflowFileInput.value?.click?.())
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
        const preview = isImage ? await readWorkflowReferenceFileAsDataUrl(file) : ''
        const reference = {
          id: createClientId(),
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
          id: createClientId(),
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
    const shouldAutoSendUploadedImages = uploadedReferences.some((file) => file.kind === 'image' && file.status === 'ready')
    if (failedCount === files.length) {
      setStatus(skillWorkbenchStatus, 'failed', `全部 ${failedCount} 个 Agent 参考文件读取失败，请删除后重传或换格式`)
    } else if (failedCount) {
      setStatus(skillWorkbenchStatus, 'failed', `已加入 ${readyCount + pendingCount} 个 Agent 参考文件，部分文件读取失败：${failedCount} 个`)
    } else if (pendingCount) {
      setStatus(skillWorkbenchStatus, 'success', `已加入 ${readyCount} 个 Agent 参考文件，${pendingCount} 个待后端解析`)
    } else {
      setStatus(skillWorkbenchStatus, 'success', `已加入 ${readyCount} 个 Agent 参考文件`)
    }
    if (shouldAutoSendUploadedImages) {
      void sendWorkflowAgentMessage(workflowAgentInput.value || '请参考我上传的图片继续分析。', {
        skipEmptyContentForAttachments: true,
        attachmentIds: uploadedReferences.map((file) => file.id)
      })
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
  const projectId = workflowAgentKnowledgeProjectId()
  if (!trimmed || !workflowAgentAllowsProjectKnowledge() || !projectId) return { items: [], error: null, skipped: !projectId || !workflowAgentAllowsProjectKnowledge() }
  const queryText = workflowAgentKnowledgeQuery(trimmed, scopeId)
  const localContextItems = [
    ...workflowSelectedKnowledgeScopeDocuments(queryText, projectId),
    ...workflowKnowledgeContextDocuments(4, queryText, projectId)
  ].map((doc) => ({
    materialId: doc.knowledgeMaterialId || doc.id || '',
    title: doc.name || doc.title || '项目知识库上下文',
    category: doc.sourceType || 'project-knowledge-context',
    sourceType: doc.sourceType || 'project-knowledge-context',
    score: 100,
    snippet: String(doc.content || doc.text || '').slice(0, 1600),
    chunk: { heading: doc.name || doc.title || '', text: String(doc.content || doc.text || '').slice(0, 1600) },
    evidence: [],
    verification: { status: 'verified' },
    knowledgeSource: 'project-context'
  }))
  const roleScopes = ['product', 'ux', 'development', 'ai-retrieval']
  const roleScope = roleScopes.includes(scopeId) ? scopeId : 'ai-retrieval'
  const result = await api.workspace.searchMaterials(state.apiConfig, {
    projectId,
    type: 'knowledge',
    query: queryText,
    roleScope,
    limit: 6
  })
  if (result.ok && Array.isArray(result.data?.results)) {
    const seen = new Set(localContextItems.map((item) => `${item.sourceType}:${item.materialId}:${item.title}`))
    const backendItems = result.data.results.filter((item) => {
      const key = `${item.sourceType}:${item.materialId || item.id || ''}:${item.title || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return { items: [...localContextItems, ...backendItems].slice(0, 10), error: null, skipped: false }
  }
  return { items: localContextItems, error: result.message || '知识检索失败', skipped: false }
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

function workflowAgentPendingAssistantContent() {
  return ''
}

function workflowAgentPendingTraceItems() {
  return [
    workflowAgentTraceFromProgress('intent', '需求识别', 'running', '正在识别问题类型...'),
    workflowAgentTraceFromProgress('plan', '任务规划', 'queued', '等待规划任务...'),
    workflowAgentTraceFromProgress('answer', '回答/提案', 'queued', '等待生成回复...'),
    workflowAgentTraceFromProgress('evidence', '引用依据', 'queued', '等待整理依据...')
  ]
}

function normalizeWorkflowAgentAssistantMessage(message, fallbackMeta = {}) {
  if (!message || message.role !== 'assistant') return message
  const content = workflowAgentMessageText(message)
  const mergedMeta = {
    ...fallbackMeta,
    ...(message.meta || {}),
    status: message.meta?.status || 'success',
    statusLabel: message.meta?.statusLabel || workflowAgentStatusLabel('success')
  }
  const isSuccessfulReply = String(mergedMeta.status || '') === 'success' && String(content || '').trim()
  const normalizedMeta = isSuccessfulReply
    ? workflowAgentSuccessMetaWithoutStaleInterruption(mergedMeta)
    : mergedMeta
  return {
    ...message,
    content,
    trace: isSuccessfulReply
      ? workflowAgentTraceWithoutStaleInterruption(message.trace, mergedMeta)
      : message.trace,
    meta: normalizedMeta
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
      webSearchEnabled: workflowAgentWebSearchEnabled.value,
      message,
      clientMessageId: message.clientMessageId,
      retryOfMessageId: message.retryOfMessageId,
      editOfMessageId: message.editOfMessageId,
      action: message.action,
      retrievedKnowledge,
      references: Array.isArray(options.references) ? options.references : workflowAgentReferencePayload(scopeId),
      context: workflowAgentRequestContext({
        nodeId: options.nodeId || scopeId,
        knowledgeRetrievalError: options.knowledgeRetrievalError,
        canvasAction: options.canvasAction,
        webSearchEnabled: workflowAgentWebSearchEnabled.value
      })
    }
  )
  applyWorkflowAgentPersistedResult(result, scopeId)
  return result
}

async function persistWorkflowAgentPendingSession(scopeId = workflowAgentScopeId()) {
  if (!state.activeWorkflowRun?.id || !scopeId) return null
  const pendingRun = {
    ...state.activeWorkflowRun,
    updatedAt: new Date().toISOString()
  }
  const result = await api.workspace.createWorkflowRun(state.apiConfig, pendingRun)
  if (result?.ok && result.data?.run) {
    const persisted = result.data.run
    state.activeWorkflowRun = mergeWorkflowAgentLocalSessionIntoRun(persisted, scopeId)
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
    saveState(state)
  }
  return result
}

function mergeWorkflowAgentLocalSessionIntoRun(incomingRun = null, scopeId = workflowAgentScopeId()) {
  const localRun = state.activeWorkflowRun
  if (!incomingRun || !localRun || !scopeId) return incomingRun
  const localSession = Array.isArray(localRun.agentSessions?.[scopeId]) ? localRun.agentSessions[scopeId] : []
  if (!localSession.length) return incomingRun
  const incomingSessions = {
    ...(incomingRun.agentSessions || {})
  }
  const incomingSession = Array.isArray(incomingSessions[scopeId]) ? incomingSessions[scopeId] : []
  const workflowAgentMessageMergeKey = (message = {}) => [
    message?.role || '',
    message?.meta?.clientMessageId || message?.clientMessageId || '',
    message?.meta?.action || message?.action || ''
  ].join(':')
  const localByMergeKey = new Map(localSession
    .map((localMessage) => [workflowAgentMessageMergeKey(localMessage), localMessage])
    .filter(([key]) => /:[^:]+:/.test(key)))
  const incomingByMergeKey = new Map(incomingSession
    .map((incomingMessage) => [workflowAgentMessageMergeKey(incomingMessage), incomingMessage])
    .filter(([key]) => /:[^:]+:/.test(key)))
  function localPendingMessageIsCoveredByIncomingReply(localMessage = {}, sourceSession = []) {
    if (localMessage?.role !== 'assistant') return false
    if (!['pending', 'retrieving', 'generating', 'merging-canvas'].includes(localMessage?.meta?.status)) return false
    const requestId = localMessage?.meta?.clientMessageId || localMessage?.clientMessageId || ''
    if (!requestId) return false
    return sourceSession.some((incomingMessage) =>
      incomingMessage?.role === 'assistant' &&
      (incomingMessage?.meta?.clientMessageId || incomingMessage?.clientMessageId || '') === requestId &&
      !['pending', 'retrieving', 'generating', 'merging-canvas'].includes(incomingMessage?.meta?.status) &&
      workflowAgentMessageText(incomingMessage).trim()
    )
  }
  function localLegacyApplyToCanvasText(content = '') {
    return String(content || '').trim() === '应用到画布'
  }
  function localLegacyApplyToCanvasPendingAssistant(message = {}) {
    const action = String(message?.meta?.action || message?.action || '')
    return message?.role === 'assistant' &&
      ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status) &&
      message?.meta?.optimistic === true &&
      (message?.meta?.placeholderOnly === true || !workflowAgentMessageText(message).trim()) &&
      ['', 'send', 'stage-agent-message', 'canvas-action-advice'].includes(action)
  }
  function localMessageIsLegacyApplyToCanvasPendingPair(sourceSession = [], index = 0) {
    const message = sourceSession[index] || {}
    const previousMessage = sourceSession[index - 1] || {}
    const nextMessage = sourceSession[index + 1] || {}
    if (
      message?.role === 'user' &&
      localLegacyApplyToCanvasText(workflowAgentMessageText(message)) &&
      localLegacyApplyToCanvasPendingAssistant(nextMessage)
    ) return true
    return localLegacyApplyToCanvasPendingAssistant(message) &&
      localLegacyApplyToCanvasText(workflowAgentMessageText(previousMessage))
  }
  const localPendingMessages = localSession.filter((message, index) => {
    if (localMessageIsLegacyApplyToCanvasPendingPair(localSession, index)) return false
    return message?.meta?.optimistic === true ||
      message?.role === 'user' ||
      (message?.role === 'assistant' && ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status))
  })
  const seenKeys = new Set()
  const mergedSession = incomingSession.map((incomingMessage) => {
    const mergeKey = workflowAgentMessageMergeKey(incomingMessage)
    const localMessage = localByMergeKey.get(mergeKey)
    if (mergeKey && seenKeys.has(mergeKey)) return null
    if (mergeKey) seenKeys.add(mergeKey)
    if (!localMessage) return incomingMessage
    if (localPendingMessageIsCoveredByIncomingReply(localMessage, incomingSession)) return incomingMessage
    const incomingContent = workflowAgentMessageText(incomingMessage)
    const localContent = workflowAgentMessageText(localMessage)
    const mergedMessage = {
      ...incomingMessage,
      ...localMessage,
      content: incomingContent || localContent,
      trace: Array.isArray(incomingMessage.trace) && incomingMessage.trace.length ? incomingMessage.trace : localMessage.trace,
      meta: {
        ...(incomingMessage.meta || {}),
        ...(localMessage.meta || {}),
        status: incomingMessage.meta?.status || localMessage.meta?.status,
        statusLabel: incomingMessage.meta?.statusLabel || localMessage.meta?.statusLabel,
        typewriterFullContent: incomingMessage.meta?.typewriterFullContent || localMessage.meta?.typewriterFullContent,
        typewriterDone: incomingMessage.meta?.typewriterDone ?? localMessage.meta?.typewriterDone,
        optimistic: false
      },
      id: localMessage.id || incomingMessage.id,
      createdAt: localMessage.createdAt || incomingMessage.createdAt
    }
    return normalizeWorkflowAgentAssistantMessage(mergedMessage)
  }).filter(Boolean)
  const seenIds = new Set(mergedSession.map((message) => message?.id || message?.clientMessageId || message?.meta?.clientMessageId).filter(Boolean))
  localPendingMessages.forEach((localMessage) => {
    const mergeKey = workflowAgentMessageMergeKey(localMessage)
    if (mergeKey && seenKeys.has(mergeKey)) return
    if (localPendingMessageIsCoveredByIncomingReply(localMessage, incomingSession)) return
    const incomingMessage = incomingByMergeKey.get(mergeKey)
    if (localMessage && incomingMessage) return
    const localId = localMessage?.id || localMessage?.clientMessageId || localMessage?.meta?.clientMessageId || ''
    if (localId && seenIds.has(localId)) return
    mergedSession.push(localMessage)
    if (localId) seenIds.add(localId)
    if (mergeKey) seenKeys.add(mergeKey)
  })
  incomingSessions[scopeId] = mergedSession
  return {
    ...incomingRun,
    agentSessions: incomingSessions
  }
}

function applyWorkflowAgentPersistedResult(result, scopeId = workflowAgentScopeId()) {
  if (result?.ok && result.data?.run) {
    state.activeWorkflowRun = mergeWorkflowAgentLocalSessionIntoRun(result.data.run, scopeId)
    if (result.data?.quickReplies?.length) {
      state.activeWorkflowRun.agentQuickReplies ||= {}
      state.activeWorkflowRun.agentQuickReplies[scopeId] = result.data.quickReplies
    }
    state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
    saveState(state)
  }
}

function workflowAgentStreamFailureContent(fallbackMessage = '') {
  return '生成失败，请重试。'
}

function completedWorkflowAgentAssistantFromRun(run = {}, scopeId = '', clientMessageId = '') {
  const session = Array.isArray(run?.agentSessions?.[scopeId]) ? run.agentSessions[scopeId] : []
  const requestId = String(clientMessageId || '').trim()
  if (!requestId) return null
  const message = session
    .slice()
    .reverse()
    .find((item) => {
      const itemRequestId = item?.meta?.clientMessageId || item?.clientMessageId || ''
      const status = String(item?.meta?.status || '').trim()
      return item?.role === 'assistant' &&
        itemRequestId === requestId &&
        !isWorkflowAgentBusyStatus(status) &&
        workflowAgentMessageText(item).trim()
    })
  return message ? normalizeWorkflowAgentAssistantMessage(message, { clientMessageId: requestId }) : null
}

async function recoverWorkflowAgentStreamAssistantFromBackend(runId = '', scopeId = '', clientMessageId = '', options = {}) {
  const attempts = Number(options.attempts || 8)
  const delayMs = Number(options.delayMs || 1500)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(delayMs)
    const result = await api.workspace.getWorkflowRun(state.apiConfig, runId)
    if (!result?.ok || !result.data?.run) continue
    const run = result.data.run
    const assistantMessage = completedWorkflowAgentAssistantFromRun(run, scopeId, clientMessageId)
    if (assistantMessage) return { run, assistantMessage }
  }
  return null
}

async function persistWorkflowAgentMessageStream(message, options = {}) {
  const scopeId = options.scopeId || workflowAgentScopeId()
  if (!state.activeWorkflowRun || !scopeId) return
  let streamedContent = ''
  const streamEventState = options.streamEventState
  const fallbackTrace = [
    workflowAgentTraceFromProgress('intent', '需求识别', 'running', '正在识别问题类型...'),
    workflowAgentTraceFromProgress('plan', '任务规划', 'running', '正在规划画布上下文和提案路径...'),
    workflowAgentTraceFromProgress('answer', '回答/提案', 'queued', '等待生成回复...'),
    workflowAgentTraceFromProgress('evidence', '引用依据', 'queued', '等待整理依据...')
  ]
  const retrievedKnowledge = Array.isArray(options.retrievedKnowledge)
    ? options.retrievedKnowledge
    : (await retrieveWorkflowKnowledge(workflowAgentMessageText(message), scopeId)).items
  const requestReferences = Array.isArray(options.references) ? options.references : workflowAgentReferencePayload(scopeId)
  if (options.pendingMessageId) {
    const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
    replaceWorkflowAgentMessage(options.pendingMessageId, {
      content: workflowAgentMessageText(currentMessage),
      trace: [
        workflowAgentTraceFromProgress('intent', '需求识别', 'done', '已接收用户问题。'),
        workflowAgentTraceFromProgress('plan', '任务规划', retrievedKnowledge.length ? 'done' : 'running', retrievedKnowledge.length ? '已整理上下文和引用资料。' : '正在整理画布上下文...'),
        workflowAgentTraceFromProgress('answer', '回答/提案', 'running', '正在连接后端并请求模型...'),
        workflowAgentTraceFromProgress('evidence', '引用依据', retrievedKnowledge.length ? 'done' : 'queued', retrievedKnowledge.length ? `已引用 ${retrievedKnowledge.length} 条项目知识。` : '等待整理依据...')
      ],
      meta: {
        ...(currentMessage?.meta || message.meta || {}),
        status: 'generating',
        statusLabel: workflowAgentStatusLabel('generating'),
        placeholderOnly: !workflowAgentMessageText(currentMessage)
      }
    }, scopeId)
  }
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
      references: requestReferences,
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
        if (event.type === 'trace' && options.pendingMessageId) {
          const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            trace: mergeWorkflowAgentTrace(workflowAgentMessageTrace(currentMessage).length ? workflowAgentMessageTrace(currentMessage) : fallbackTrace, event.data || {}),
            meta: {
              ...(currentMessage?.meta || message.meta || {}),
              status: ['failed'].includes(event.data?.status) ? 'failed' : (currentMessage?.meta?.status || 'generating'),
              statusLabel: event.data?.label || currentMessage?.meta?.statusLabel || workflowAgentStatusLabel('generating')
            }
          }, scopeId)
        }
        if (event.type === 'status' && options.pendingMessageId) {
          const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            content: workflowAgentMessageText(currentMessage),
            trace: workflowAgentMessageTrace(currentMessage),
            meta: {
              ...(currentMessage?.meta || message.meta || {}),
              status: event.data?.status || 'generating',
              statusLabel: event.data?.label || workflowAgentStatusLabel(event.data?.status || 'generating'),
              clientMessageId: message.clientMessageId,
              retryOfMessageId: message.retryOfMessageId,
              editOfMessageId: message.editOfMessageId,
              action: message.action,
              retrievedKnowledge,
              knowledgeRetrievalError: options.knowledgeRetrievalError,
              placeholderOnly: !workflowAgentMessageText(currentMessage)
            }
          }, scopeId)
        }
        if (event.type === 'delta' && options.pendingMessageId) {
          const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
          const deltaContent = event.data?.content || event.data?.text || ''
          if (!event.data?.preview) streamedContent += deltaContent
          const visibleStreamContent = workflowAgentStreamDisplayContent(streamedContent)
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            content: visibleStreamContent || workflowAgentMessageText(currentMessage),
            trace: workflowAgentMessageTrace(currentMessage),
            meta: {
              ...(currentMessage?.meta || message.meta || {}),
              status: 'generating',
              statusLabel: workflowAgentStatusLabel('generating'),
              clientMessageId: message.clientMessageId,
              retryOfMessageId: message.retryOfMessageId,
              editOfMessageId: message.editOfMessageId,
              action: message.action,
              retrievedKnowledge,
              knowledgeRetrievalError: options.knowledgeRetrievalError,
              optimistic: false,
              placeholderOnly: !visibleStreamContent && !workflowAgentMessageText(currentMessage)
            }
          }, scopeId)
        }
        if (event.type === 'message' && event.data?.assistantMessage && options.pendingMessageId) {
          const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
          const assistantMessage = event.data.assistantMessage
          assistantMessage.trace = Array.isArray(assistantMessage.trace) && assistantMessage.trace.length
            ? assistantMessage.trace
            : workflowAgentMessageTrace(currentMessage)
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
          const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
          if (streamEventState) streamEventState.failed = true
          if (streamEventState) streamEventState.errorCode = event.data?.code || 'AGENT_STREAM_FAILED'
          const failureContent = workflowAgentStreamFailureContent(event.data?.message || 'Agent 流式生成失败')
          const failedTrace = mergeWorkflowAgentTrace(
            workflowAgentMessageTrace(currentMessage).length ? workflowAgentMessageTrace(currentMessage) : fallbackTrace,
            workflowAgentTraceFromProgress('answer', '回答/提案', 'failed', event.data?.message || '模型生成失败')
          )
          replaceWorkflowAgentMessage(options.pendingMessageId, {
            role: 'assistant',
            content: failureContent,
            trace: failedTrace,
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
          if (!streamEventState?.failed && !event.data?.error) {
            applyWorkflowAgentPersistedResult({ ok: true, data: event.data }, scopeId)
          }
        }
      },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    }
  )
  if (!result?.ok && options.pendingMessageId && result?.status !== 'cancelled') {
    const currentMessage = workflowAgentMessageById(options.pendingMessageId, scopeId)
    const failureMessage = result?.message || 'Agent 请求失败'
    const failedTrace = mergeWorkflowAgentTrace(
      workflowAgentMessageTrace(currentMessage).length ? workflowAgentMessageTrace(currentMessage) : fallbackTrace,
      workflowAgentTraceFromProgress('answer', '回答/提案', 'failed', failureMessage)
    )
    replaceWorkflowAgentMessage(options.pendingMessageId, {
      role: 'assistant',
      content: workflowAgentStreamFailureContent(failureMessage),
      trace: failedTrace,
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
          message: failureMessage,
          code: result?.data?.error?.code || result?.status || 'AGENT_REQUEST_FAILED',
          ...(result?.data?.error || {})
        }
      }
    }, scopeId)
    if (streamEventState) streamEventState.failed = true
    return result
  }
  applyWorkflowAgentPersistedResult(result, scopeId)
  return result
}

function setWorkflowAgentDisplayMode(mode = 'sidebar') {
  const normalizedMode = ['inline', 'sidebar', 'fullscreen', 'hidden'].includes(mode) ? mode : 'sidebar'
  if (['inline', 'fullscreen'].includes(normalizedMode) && !workflowAgentCanUseLargeModes.value) {
    workflowAgentDisplayMode.value = 'sidebar'
  } else {
    workflowAgentDisplayMode.value = normalizedMode === 'inline' && !workflowCanUseInlineAgent.value ? 'sidebar' : normalizedMode
  }
  workflowAgentOpen.value = workflowAgentDisplayMode.value !== 'hidden'
  if (workflowAgentDisplayMode.value !== 'hidden') {
    nextTick(() => {
      updateWorkflowAgentInlineTop()
      workflowAgentDrawerRef.value?.focusComposer?.()
    })
  }
}

function updateWorkflowAgentInlineTop() {
  if (typeof window === 'undefined') return
  const topbar = document.querySelector('.workflow-canvas-topbar')
  const rect = topbar?.getBoundingClientRect?.()
  if (!rect) return
  workflowAgentInlineTop.value = `${Math.ceil(rect.bottom)}px`
}

watch(
  () => [workflowAgentDisplayMode.value, workflowCurrentStageId.value, workflowStageTotalDesignFlow.value?.activeSliceId || ''],
  async () => {
    await nextTick()
    updateWorkflowAgentInlineTop()
  }
)

watch(
  () => workflowAgentCanUseLargeModes.value,
  (canUseLargeModes) => {
    if (!canUseLargeModes && ['inline', 'fullscreen'].includes(workflowAgentDisplayMode.value)) {
      setWorkflowAgentDisplayMode('sidebar')
    }
  }
)

function workflowDefaultAgentDisplayMode() {
  return 'sidebar'
}

function showWorkflowAgentInline() {
  setWorkflowAgentDisplayMode('sidebar')
}

function showWorkflowAgentSidebar() {
  setWorkflowAgentDisplayMode('sidebar')
}

function showWorkflowAgentFullscreen() {
  setWorkflowAgentDisplayMode('fullscreen')
}

function openWorkflowAgent() {
  const run = ensureActiveWorkflowRunForAgent()
  if (!run) {
    setStatus(skillWorkbenchStatus, 'failed', '当前没有可对话的分析画布，请先生成或打开一条页面蓝图。')
    return
  }
  workflowAgentNodeId.value = workflowAgentNodeId.value || workflowCurrentCanvasNodes.value?.[0]?.id || 'analysis'
  if (workflowDefaultAgentDisplayMode() === 'inline') {
    showWorkflowAgentInline()
    nextTick(() => workflowAgentDrawerRef.value?.focusComposer?.())
    return
  }
  showWorkflowAgentSidebar()
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

function startWorkflowAgentInlineResize(event) {
  event?.preventDefault?.()
  workflowAgentInlineResizing.value = true
  const startX = event?.clientX || 0
  const drawerElement = workflowAgentDrawerRef.value?.$el || null
  const startWidth = drawerElement?.getBoundingClientRect?.().width || window.innerWidth
  const minWidth = Math.min(760, window.innerWidth)
  const maxWidth = window.innerWidth

  const move = (moveEvent) => {
    const delta = startX - moveEvent.clientX
    workflowAgentInlineWidth.value = `${Math.min(maxWidth, Math.max(minWidth, startWidth + delta))}px`
  }
  const stop = () => {
    workflowAgentInlineResizing.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}

async function addFeishuReferencePlaceholder() {
  const references = ensureWorkflowReferenceFiles()
  const reference = {
    id: createClientId(),
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
  let content = String(text || '').trim()
  const pendingComposerReference = options.contextReference || workflowAgentComposerReference.value || null
  const pendingComposerCanvasAction = options.canvasAction || pendingComposerReference?.canvasAction || null
  const contextNodeId = options.nodeId || pendingComposerReference?.nodeId || workflowAgentResolvedNodeId()
  const isStageProgressionMessage = options.action === 'stage-confirm-next' ||
    ['stage-agent-confirm-next', 'stage-canvas-confirm-next'].includes(pendingComposerCanvasAction?.actionIntent)
  const targetScopeId = isStageProgressionMessage
    ? (options.nodeId || workflowAgentScopeId())
    : workflowUsesStageAgentScope.value
      ? workflowCurrentStageId.value
      : (options.nodeId || pendingComposerReference?.nodeId || workflowAgentScopeId())
  const pendingAttachments = workflowAgentPendingMessageAttachments(targetScopeId, options.attachmentIds)
  if (!content && options.skipEmptyContentForAttachments && pendingAttachments.length) {
    content = '请参考我上传的图片继续分析。'
  }
  if (!content || !state.activeWorkflowRun || workflowAgentSending.value || !targetScopeId) return
  if (!options.skipStageAdvanceInputHandling && isWorkflowAgentWorkbenchStageId(workflowCurrentStageId.value) && (isWorkflowStageAdvanceInput(content) || isWorkflowLowFiStageAdvanceAction(content))) {
    const currentStageId = workflowCurrentStageId.value
    const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
    const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
    const nextStage = stages[currentIndex + 1] || null
    workflowAgentInput.value = ''
    void confirmWorkflowStageWithAgentSummary({
      nodeId: targetScopeId,
      action: content,
      stageId: currentStageId,
      nextStageId: nextStage?.id || '',
      mode: 'stage-agent-confirm-next'
    })
    return
  }
  if (!options.skipStageAdvanceInputHandling && isWorkflowStageAdvanceInput(content) && confirmWorkflowStageFromAgentInput(content, targetScopeId)) return
  if (!options.skipStageAdvanceInputHandling && isWorkflowStageAdvanceInput(content) && workflowCanMoveToNextStage.value) {
    const currentStageId = workflowCurrentStageId.value
    const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
    const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
    const nextStage = stages[currentIndex + 1] || null
    workflowAgentInput.value = ''
    void confirmWorkflowStageWithAgentSummary({
      nodeId: currentStageId,
      action: content,
      stageId: currentStageId,
      nextStageId: nextStage?.id || '',
      mode: 'stage-agent-confirm-next'
    })
    return
  }
  if (!options.canvasAction && !options.skipLayoutAlternativeInputHandling && isWorkflowAgentLayoutAlternativeRequest(content) && isWorkflowAgentLayoutPlanInputScope(contextNodeId) && hasRecentWorkflowAgentLayoutOptions(targetScopeId)) {
    workflowAgentInput.value = ''
    sendWorkflowAgentCanvasAction('给布局方案', contextNodeId)
    return
  }
  if (!pendingComposerCanvasAction && isWorkflowAgentCanvasUpdateRequest(content) && canvasNodeById(contextNodeId)) {
    workflowAgentInput.value = ''
    sendWorkflowAgentCanvasAction(content, contextNodeId)
    return
  }
  const requestToken = createClientId()
  const clientMessageId = options.clientMessageId || createClientId()
  const editOfMessageId = options.editOfMessageId || (options.ignoreDraftState ? '' : workflowAgentEditingMessageId.value) || ''
  const retryOfMessageId = options.retryOfMessageId || (options.ignoreDraftState ? '' : workflowAgentRetryMessageId.value) || ''
  const messageAction = options.action || (pendingComposerCanvasAction?.actionIntent === 'reanalysis' ? 'reanalysis' : pendingComposerCanvasAction ? 'canvas-action-advice' : editOfMessageId ? 'edit-resend' : retryOfMessageId ? 'retry' : 'send')
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
  removeWorkflowAgentBusyMessages(targetScopeId)
  const contextReference = pendingComposerReference || (pendingComposerCanvasAction
    ? workflowAgentContextReferenceForNode(contextNodeId, pendingComposerCanvasAction)
    : null)
  const pendingAttachmentIds = new Set(pendingAttachments.map((file) => String(file.id || '')).filter(Boolean))
  const pendingReferencePayload = workflowAgentReferencePayload(targetScopeId)
    .filter((file) => !pendingAttachmentIds.size || pendingAttachmentIds.has(String(file.id || '')))
  const userMessageMeta = {
    clientMessageId,
    retryOfMessageId,
    editOfMessageId,
    action: effectiveMessageAction,
    optimistic: true,
    ...(contextReference ? { contextReference } : {}),
    ...(pendingAttachments.length ? { attachments: pendingAttachments } : {})
  }
  const userMessageId = appendWorkflowAgentMessage('user', content, {
    scopeId: targetScopeId,
    id: options.userMessageId || clientMessageId,
    meta: userMessageMeta
  })
  clearWorkflowAgentComposerReference()
  clearWorkflowAgentSentReferences(targetScopeId, pendingAttachments)
  const pendingMessageId = appendWorkflowAgentMessage('assistant', workflowAgentPendingAssistantContent(), {
    scopeId: targetScopeId,
    trace: workflowAgentPendingTraceItems(),
    meta: {
      status: 'pending',
      statusLabel: workflowAgentStatusLabel('pending'),
      clientMessageId,
      retryOfMessageId,
      editOfMessageId,
      action: effectiveMessageAction,
      optimistic: true,
      placeholderOnly: true
    }
  })
  workflowAgentPendingMessageId.value = pendingMessageId
  workflowAgentPendingScopeId.value = targetScopeId
  scrollWorkflowAgentToBottomTick()
  try {
    await persistWorkflowAgentPendingSession(targetScopeId)
    if (workflowAgentRequestToken.value !== requestToken) return
    const knowledgePendingLabel = workflowAgentKnowledgeProjectId()
      ? '正在检索项目知识与当前节点上下文...'
      : '正在读取当前节点上下文...'
      replaceWorkflowAgentMessage(pendingMessageId, {
        content: workflowAgentMessageText(workflowAgentMessageById(pendingMessageId, targetScopeId)),
        trace: mergeWorkflowAgentTrace(workflowAgentMessageTrace(workflowAgentMessageById(pendingMessageId, targetScopeId)), workflowAgentTraceFromProgress('plan', '任务规划', 'running', knowledgePendingLabel)),
        meta: {
          status: 'retrieving',
          statusLabel: workflowAgentStatusLabel('retrieving'),
          clientMessageId,
          retryOfMessageId,
          editOfMessageId,
          action: messageAction,
          optimistic: true,
          placeholderOnly: true
        }
      }, targetScopeId)
    const knowledgeResult = await retrieveWorkflowKnowledge(content, contextNodeId || targetScopeId)
    const retrievedKnowledge = knowledgeResult.items
    if (workflowAgentRequestToken.value !== requestToken) return
    replaceWorkflowAgentMessage(pendingMessageId, {
      content: workflowAgentMessageText(workflowAgentMessageById(pendingMessageId, targetScopeId)),
      trace: mergeWorkflowAgentTrace(workflowAgentMessageTrace(workflowAgentMessageById(pendingMessageId, targetScopeId)), workflowAgentTraceFromProgress('answer', '回答/提案', 'running', '正在生成可决策回复...')),
      meta: {
        status: 'generating',
        statusLabel: workflowAgentStatusLabel('generating'),
        clientMessageId,
        retryOfMessageId,
        editOfMessageId,
        action: messageAction,
        retrievedKnowledge,
        knowledgeRetrievalError: knowledgeResult.error,
        optimistic: true,
        placeholderOnly: true
      }
    }, targetScopeId)
    const streamEventState = { failed: false }
    const pendingStreamOptions = {
      scopeId: targetScopeId,
      nodeId: contextNodeId || targetScopeId,
      retrievedKnowledge,
      knowledgeRetrievalError: knowledgeResult.error,
      canvasAction: pendingComposerCanvasAction || null,
      pendingMessageId,
      requestToken,
      streamEventState,
      signal: workflowAgentStreamController.value.signal,
      timeoutMs: workflowAgentRequestTimeoutMs(),
      references: pendingReferencePayload
    }
    const persisted = await persistWorkflowAgentMessageStream({
      role: 'user',
      content,
      clientMessageId,
      retryOfMessageId,
      editOfMessageId,
      action: messageAction,
      meta: userMessageMeta
    }, pendingStreamOptions)
    if (workflowAgentRequestToken.value !== requestToken) return
    const backendCancelled = Boolean(persisted?.data?.cancelled)
    if (backendCancelled) {
      replaceWorkflowAgentMessage(pendingMessageId, {
        role: 'assistant',
        content: '已停止生成。本次回复没有写入会话，可以点击重试重新发送。',
        trace: workflowAgentMessageTrace(workflowAgentMessageById(pendingMessageId, targetScopeId)),
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
      return { ok: false, cancelled: true }
    }
    const backendHandled = Boolean(persisted?.ok && persisted.data?.assistantMessage)
    const persistedSession = Array.isArray(persisted?.data?.run?.agentSessions?.[targetScopeId])
      ? persisted.data.run.agentSessions[targetScopeId]
      : []
    const persistedAssistantMessage = persistedSession
      .slice()
      .reverse()
      .find((item) => item?.role === 'assistant' && item?.meta?.clientMessageId === clientMessageId)
    const recoveredFromRun = Boolean(!backendHandled && persistedAssistantMessage)
    const shouldRecoverInterruptedStream = !backendHandled &&
      !recoveredFromRun &&
      (!streamEventState.failed || streamEventState.errorCode === 'AGENT_STREAM_INTERRUPTED')
    const recoveredBackendResult = shouldRecoverInterruptedStream
      ? await recoverWorkflowAgentStreamAssistantFromBackend(state.activeWorkflowRun.id, targetScopeId, clientMessageId)
      : null
    const recoveredFromBackend = Boolean(recoveredBackendResult?.assistantMessage)
    if (recoveredBackendResult?.run) {
      applyWorkflowAgentPersistedResult({ ok: true, data: { run: recoveredBackendResult.run } }, targetScopeId)
    }
    if (streamEventState.failed && !backendHandled && !recoveredFromRun && !recoveredFromBackend) {
      const currentPendingMessage = workflowAgentMessageById(pendingMessageId, targetScopeId)
      const failedTrace = mergeWorkflowAgentTrace(
        workflowAgentMessageTrace(currentPendingMessage),
        workflowAgentTraceFromProgress('answer', '回答/提案', 'failed', '模型生成失败，请重试或检查后端模型配置。')
      )
      replaceOrAppendWorkflowAgentMessage(pendingMessageId, {
        role: 'assistant',
        content: workflowAgentStreamFailureContent('模型生成失败，请重试或检查后端模型配置。'),
        trace: failedTrace,
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
            message: '模型生成失败，请重试或检查后端模型配置。',
            code: 'AGENT_STREAM_FAILED'
          }
        }
      }, targetScopeId)
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      clearWorkflowAgentActiveDraft()
      if (state.activeWorkflowRun) {
        state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
        saveState(state)
      }
      return { ok: false, assistantMessage: workflowAgentMessageById(pendingMessageId, targetScopeId) }
    }
    if (backendHandled || recoveredFromRun || recoveredFromBackend) {
      const currentPendingMessage = workflowAgentMessageById(pendingMessageId, targetScopeId)
      const assistantMessage = normalizeWorkflowAgentAssistantMessage(persisted.data?.assistantMessage || persistedAssistantMessage || recoveredBackendResult.assistantMessage, {
        clientMessageId,
        retryOfMessageId,
        editOfMessageId,
        action: messageAction,
        retrievedKnowledge,
        knowledgeRetrievalError: knowledgeResult.error
      })
      assistantMessage.trace = Array.isArray(assistantMessage.trace) && assistantMessage.trace.length
        ? assistantMessage.trace
        : workflowAgentMessageTrace(currentPendingMessage)
      workflowAgentSending.value = false
      workflowAgentStreamController.value = null
      await typeWorkflowAgentAssistantMessage(pendingMessageId, assistantMessage, { requestToken, scopeId: targetScopeId, skipTypewriter: true })
      workflowAgentPendingMessageId.value = ''
      workflowAgentPendingScopeId.value = ''
      clearWorkflowAgentActiveDraft()
      if (state.activeWorkflowRun) {
        state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
        saveState(state)
      }
      return { ok: true, assistantMessage, persisted }
    } else {
      const failureView = workflowAgentFailureView(persisted)
      const failedTrace = mergeWorkflowAgentTrace(
        workflowAgentMessageTrace(workflowAgentMessageById(pendingMessageId, targetScopeId)),
        workflowAgentTraceFromProgress('answer', '回答/提案', 'failed', failureView.message || '模型生成失败')
      )
      replaceWorkflowAgentMessage(pendingMessageId, {
        role: 'assistant',
        content: workflowAgentStreamFailureContent(failureView.message),
        trace: failedTrace,
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
      if (state.activeWorkflowRun) {
        state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
        saveState(state)
      }
      return { ok: false, assistantMessage: workflowAgentMessageById(pendingMessageId, targetScopeId), persisted }
    }

  } catch (error) {
    if (workflowAgentRequestToken.value !== requestToken) return
    replaceWorkflowAgentMessage(pendingMessageId, {
      role: 'assistant',
      content: '发送失败，请检查后端服务或稍后重试。',
      trace: workflowAgentMessageTrace(workflowAgentMessageById(pendingMessageId, targetScopeId)),
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
    if (state.activeWorkflowRun) {
      state.workflowRuns = upsertWorkflowRunRecord(state.workflowRuns, state.activeWorkflowRun)
      saveState(state)
    }
    return { ok: false, assistantMessage: workflowAgentMessageById(pendingMessageId, targetScopeId), error }
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

function workflowAgentLayoutOptionSelection(content = '') {
  const match = String(content || '').match(/选\s*([123])\s*应用到画布/)
  if (!match) return null
  return Number(match[1])
}

function workflowAgentLayoutOptionsFromMessage(message = {}) {
  const writeableContent = message?.meta?.proposalSummary?.writeableContent
  return Array.isArray(writeableContent?.layoutOptions) ? writeableContent.layoutOptions : []
}

function selectedLayoutOptionLabel(option = null) {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return ''
  return [option.label, option.title || option.layoutOptionTitle]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' · ')
}

function selectedWorkflowAgentLayoutOptionFromMessage(message = {}) {
  const metaOption = message?.meta?.selectedLayoutOption
  if (metaOption && typeof metaOption === 'object' && !Array.isArray(metaOption)) {
    const layoutOptionTitle = String(metaOption.title || metaOption.layoutOptionTitle || '').trim()
    return {
      id: String(metaOption.id || '').trim(),
      label: String(metaOption.label || '').trim(),
      title: layoutOptionTitle,
      layoutStyle: String(metaOption.layoutStyle || metaOption.visualTone || metaOption.tone || '').trim(),
      layoutOptionTitle,
      summary: String(metaOption.summary || '').trim()
    }
  }
  return null
}

function confirmWorkflowAgentLayoutOption(content = '', sourceMessage = null) {
  // Contract: option quick replies reuse proposal confirmation so backend can persist selected-option metadata.
  const optionIndex = workflowAgentLayoutOptionSelection(content)
  if (!optionIndex || !sourceMessage?.meta?.proposalId) return false
  const options = workflowAgentLayoutOptionsFromMessage(sourceMessage)
  const selectedOption = options[optionIndex - 1]
  if (!selectedOption?.id) {
    setStatus(skillWorkbenchStatus, 'failed', '没有找到可应用的布局候选')
    return true
  }
  void confirmWorkflowAgentMessage({
    id: sourceMessage.id || '',
    content: `${content}：${selectedOption.title || selectedOption.label || selectedOption.id}`,
    nodeId: sourceMessage?.meta?.nodeId || sourceMessage?.nodeId,
    meta: {
      proposalId: sourceMessage.meta.proposalId,
      selectedLayoutOptionId: selectedOption.id,
      selectedLayoutOptionIndex: optionIndex,
      selectedLayoutOption: {
        id: selectedOption.id || '',
        label: selectedOption.label || '',
        title: selectedOption.title || '',
        layoutOptionTitle: selectedOption.title || '',
        layoutStyle: selectedOption.layoutStyle || selectedOption.visualTone || selectedOption.tone || '',
        summary: selectedOption.summary || ''
      }
    }
  })
  return true
}

function confirmWorkflowAgentApplyToCanvasRecommendation(content = '', sourceMessage = null) {
  const normalizedContent = String(content || '').trim()
  const proposalId = sourceMessage?.meta?.proposalId || ''
  if (normalizedContent !== '应用到画布') return false
  const sourceContent = workflowAgentMessageText(sourceMessage).trim()
  const targetNodeId = sourceMessage?.meta?.nodeId || sourceMessage?.nodeId || workflowAgentScopeId()
  if (!proposalId) {
    if (workflowAnalysisResult.value?.totalDesignFlow) {
      void applyWorkflowAgentStageSupplement({
        type: 'agent-supplement',
        stageId: workflowCurrentStageId.value,
        nodeId: targetNodeId,
        action: normalizedContent,
        confirmedContent: sourceContent
      })
      return true
    }
    void applyWorkflowAgentSupplement({
      type: 'agent-supplement',
      nodeId: targetNodeId,
      action: normalizedContent,
      confirmedContent: sourceContent
    })
    return true
  }
  void confirmWorkflowAgentMessage({
    id: sourceMessage.id || '',
    content: sourceContent,
    nodeId: targetNodeId,
    meta: {
      ...(sourceMessage.meta || {}),
      proposalId
    }
  })
  return true
}

function workflowAgentVisualGenerationQuickAction(content = '', sourceMessage = null) {
  const normalizedContent = String(content || '').trim()
  if (!/生成视觉|生成高保真|重新生成/.test(normalizedContent)) return null
  const targetNodeId = sourceMessage?.meta?.nodeId || sourceMessage?.nodeId || workflowAgentScopeId()
  const node = canvasNodeById(targetNodeId) || workflowAgentNode.value || {}
  const generationActions = Array.isArray(node.generationActions) ? node.generationActions : []
  const generationAction = generationActions[0] || null
  if (!generationAction || node?.stageId !== 'ui-visual') return null
  return {
    nodeId: targetNodeId,
    action: generationAction.label || normalizedContent,
    generationAction,
    targetGenerator: generationAction.targetGenerator || node.targetGenerator || '',
    mode: 'stage-detail-generation'
  }
}

function isWorkflowAgentCodeGenerationQuickReply(content = '') {
  return /生成\s*(HTML|Vue)|重新生成\s*(HTML|Vue)|生成页面代码/.test(String(content || '').trim())
}

function workflowAgentCodeGenerationQuickAction(content = '', sourceMessage = null) {
  const normalizedContent = String(content || '').trim()
  if (!isWorkflowAgentCodeGenerationQuickReply(normalizedContent)) return null
  const targetStageId = /vue/i.test(normalizedContent) ? 'vue-output' : 'html-output'
  const sourceNodeId = sourceMessage?.meta?.nodeId || sourceMessage?.nodeId || workflowAgentNodeId.value || workflowAgentScopeId()
  const sourceNode = canvasNodeById(sourceNodeId) || workflowAgentNode.value || {}
  const targetNode = sourceNode?.stageId === targetStageId
    ? sourceNode
    : findWorkflowGenerationTargetNode(sourceNode, targetStageId)
  const generationActions = Array.isArray(targetNode?.generationActions) ? targetNode.generationActions : []
  const generationAction = generationActions.find((action) => {
    const target = String(action?.targetGenerator || targetNode?.targetGenerator || '').trim().toLowerCase()
    return targetStageId === 'vue-output' ? target === 'vue' : target === 'html'
  }) || generationActions[0] || null
  if (!targetNode?.id || !generationAction) return null
  return {
    nodeId: targetNode.id,
    action: generationAction.label || normalizedContent,
    generationAction,
    targetGenerator: generationAction.targetGenerator || targetNode.targetGenerator || '',
    stageId: targetStageId,
    mode: 'stage-detail-generation'
  }
}

function useWorkflowAgentQuickReply(content, sourceMessage = null) {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可发送的快捷回复')
    return
  }
  if (workflowAgentSending.value) {
    setStatus(skillWorkbenchStatus, 'failed', 'Agent 正在生成回复，请等待当前结果返回后再发送。')
    return
  }
  if (confirmWorkflowAgentLayoutOption(content, sourceMessage)) return
  const visualGenerationPayload = workflowAgentVisualGenerationQuickAction(content, sourceMessage)
  if (visualGenerationPayload) {
    runWorkflowGenerationAction(visualGenerationPayload)
    return
  }
  const codeGenerationPayload = workflowAgentCodeGenerationQuickAction(content, sourceMessage)
  if (codeGenerationPayload) {
    if (codeGenerationPayload.stageId && workflowCurrentStageId.value !== codeGenerationPayload.stageId) {
      selectWorkflowStage(codeGenerationPayload.stageId)
    }
    runWorkflowGenerationAction(codeGenerationPayload)
    return
  }
  if (isWorkflowAgentCodeGenerationQuickReply(normalizedContent)) {
    setStatus(skillWorkbenchStatus, 'failed', '没有找到可生成的 HTML/Vue 画布节点，请先进入对应阶段。')
    return
  }
  if (confirmWorkflowAgentApplyToCanvasRecommendation(content, sourceMessage)) return
  if (/不满意，?重生成\s*3\s*个|按新规则重生成/.test(normalizedContent)) {
    sendWorkflowAgentCanvasAction('给布局方案', workflowAgentScopeId())
    return
  }
  if (isWorkflowChatOnlyStageScope(workflowAgentScopeId()) && content === '总结并进入下一步') {
    const currentStageId = workflowCurrentStageId.value
    const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
    const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
    const nextStage = stages[currentIndex + 1] || null
    const currentStageName = workflowStageNameById(currentStageId)
    runWorkflowNodeQuickAction({
      nodeId: workflowAgentScopeId(),
      action: [
        `请总结「${currentStageName}」阶段目前对话中已经确认的结论，并进入「${nextStage?.name || '下一阶段'}」。`,
        '总结请包含：已确认结论、关键假设、仍需后续关注的问题、下一阶段输入建议。',
        '如果信息仍不足，也请先基于当前上下文给出默认假设和风险说明。'
      ].join('\n'),
      stageId: currentStageId,
      nextStageId: nextStage?.id || '',
      mode: 'stage-agent-confirm-next'
    })
    return
  }
  const uxConfirmationPromptMap = {
    '下一步': '请基于当前已确认内容，判断是否可以进入 UX 设计确认 Skill 的下一阶段；如果可以，请输出下一阶段名称、阶段目标、需要确认的 1-3 个关键点和建议按钮。如果信息不足，请说明缺口并继续停留在当前阶段。',
    '调整本阶段': '请停留在当前 UX 设计确认阶段，重新整理当前阶段结论，明确已确认事实、AI 推断、待确认问题和下一步建议。',
    '转低保真画布': '请把目前已确认的阶段结果转成低保真画布方案，输出页面/业务阶段节点、节点关系、状态异常、数据依赖和验收点。'
  }
  if (state.activeWorkflowRun?.skillId === 'dialogue-skill') {
    if (/转\s*UX\s*设计确认|UX\s*设计确认|转需求确认|进入\s*UX/i.test(normalizedContent)) {
      void transferDialogueSkillToUxConfirmation()
      return
    }
    if (/生成方案画布|生成画布|对话完成|转画布/.test(normalizedContent)) {
      void createDialogueSkillPageCanvasFromChat({ requireCanvasText: true })
      return
    }
    void sendWorkflowAgentMessage(normalizedContent, { ignoreDraftState: true })
    return
  }
  if (state.activeWorkflowRun?.skillId === 'ux-design-confirmation-skill') {
    if (isWorkflowLowFiStageAdvanceAction(normalizedContent)) {
      const currentStageId = workflowCurrentStageId.value
      const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
      const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
      const nextStage = stages[currentIndex + 1] || null
      runWorkflowNodeQuickAction({
        nodeId: workflowAgentScopeId(),
        action: uxConfirmationPromptMap[normalizedContent] || normalizedContent,
        stageId: currentStageId,
        nextStageId: nextStage?.id || '',
        mode: 'stage-agent-confirm-next'
      })
      return
    }
    const mappedContent = uxConfirmationPromptMap[normalizedContent] || normalizedContent
    void sendWorkflowAgentMessage(mappedContent, { ignoreDraftState: true })
    return
  }
  if (isWorkflowLowFiStageAdvanceAction(content) && isWorkflowAgentWorkbenchStageId(workflowCurrentStageId.value)) {
    const currentStageId = workflowCurrentStageId.value
    const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
    const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
    const nextStage = stages[currentIndex + 1] || null
    runWorkflowNodeQuickAction({
      nodeId: workflowAgentScopeId(),
      action: normalizedContent,
      stageId: currentStageId,
      nextStageId: nextStage?.id || '',
      mode: 'stage-agent-confirm-next'
    })
    return
  }
  if (isWorkflowStageAdvanceInput(normalizedContent) && workflowCanMoveToNextStage.value) {
    const currentStageId = workflowCurrentStageId.value
    const stages = normalizeWorkflowTotalFlowStages(workflowTotalDesignFlow.value?.stages || [])
    const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)
    const nextStage = stages[currentIndex + 1] || null
    runWorkflowNodeQuickAction({
      nodeId: currentStageId,
      action: normalizedContent,
      stageId: currentStageId,
      nextStageId: nextStage?.id || '',
      mode: 'stage-agent-confirm-next'
    })
    return
  }
  if (isWorkflowAgentCanvasAdviceQuickReply(content)) {
    sendWorkflowAgentCanvasAction(normalizedContent, workflowAgentScopeId())
    return
  }
  const mappedContent = state.activeWorkflowRun?.skillId === 'ux-design-confirmation-skill'
    ? (uxConfirmationPromptMap[normalizedContent] || normalizedContent)
    : normalizedContent
  void sendWorkflowAgentMessage(mappedContent, { ignoreDraftState: true })
}

async function copyWorkflowAgentMessage(message, onCopied = null) {
  const text = String(messageMeta(message).typewriterFullContent || workflowAgentMessageText(message)).trim()
  if (!text) {
    setStatus(skillWorkbenchStatus, 'failed', '没有可复制的消息内容')
    return
  }
  try {
    await copyTextToClipboard(text)
    onCopied?.()
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

async function retryWorkflowAgentMessage(message) {
  if (workflowAgentSending.value) {
    await stopWorkflowAgentGeneration()
    await nextTick()
  }
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
  clearWorkflowAgentDraftState()
  void sendWorkflowAgentMessage(content, {
    ignoreDraftState: true,
    retryOfMessageId: message?.id || '',
    clientMessageId: createClientId()
  })
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

async function editWorkflowAgentMessage(message) {
  if (workflowAgentSending.value) {
    await stopWorkflowAgentGeneration()
    await nextTick()
  }
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
  if (workflowAgentIsChatOnlyScope(message?.meta?.nodeId || workflowAgentScopeId())) return
  const confirmedContent = workflowAgentMessageText(message).trim()
  if (!confirmedContent) return
  const proposalId = message?.meta?.proposalId || ''
  if (!proposalId) {
    setStatus(skillWorkbenchStatus, 'failed', '这条 Agent 回复没有可写入画布的提案')
    return
  }
  const nodeId = workflowAgentResolvedNodeId(message?.meta?.nodeId)
  const node = canvasNodeById(nodeId) || workflowAgentNode.value || workflowCurrentCanvasNodes.value[0] || null
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
  const layoutLabel = selectedLayoutOptionLabel(appliedPatch?.selectedLayoutOption)
  if (layoutLabel) lines.push(`已应用布局：${layoutLabel}`)
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
  if (workflowAgentIsChatOnlyScope(message?.nodeId || message?.meta?.nodeId || workflowAgentScopeId())) return
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
  const requestToken = createClientId()
  const clientMessageId = createClientId()
  const selectedLayoutOption = selectedWorkflowAgentLayoutOptionFromMessage(message)
  const selectedLayoutLabel = selectedLayoutOptionLabel(message.meta?.selectedLayoutOption)
  workflowAgentRequestToken.value = requestToken
  workflowAgentStreamController.value?.abort?.()
  workflowAgentStreamController.value = new AbortController()
  workflowAgentSending.value = true
  workflowCanvasLoading.value = true
  workflowCanvasRefreshingNodeId.value = targetNodeId
  workflowCanvasRefreshingLayoutLabel.value = selectedLayoutOptionLabel(message.meta?.selectedLayoutOption)
  const pendingMessageId = appendWorkflowAgentMessage('assistant', selectedLayoutLabel ? `正在应用「${selectedLayoutLabel}」并刷新画布...` : '正在写入画布并刷新后续节点...', {
    scopeId: targetScopeId,
    meta: {
      status: 'merging-canvas',
      statusLabel: workflowAgentStatusLabel('merging-canvas'),
      action: 'confirm-canvas',
      proposalId,
      confirmedContent,
      nodeId: targetNodeId,
      selectedLayoutOption: selectedWorkflowAgentLayoutOptionFromMessage(message),
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
      confirmMode: 'merge-current-and-downstream',
      ...(message?.meta?.selectedLayoutOptionId ? { selectedLayoutOptionId: message.meta.selectedLayoutOptionId } : {}),
      ...(message?.meta?.selectedLayoutOptionIndex ? { selectedLayoutOptionIndex: message.meta.selectedLayoutOptionIndex } : {}),
      ...(selectedLayoutOption ? { selectedLayoutOption } : {})
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
              selectedLayoutOption,
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
              selectedLayoutOption,
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
        selectedLayoutOption,
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
        selectedLayoutOption,
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
      workflowCanvasRefreshingLayoutLabel.value = ''
      workflowAgentStreamController.value = null
      workflowAgentDrawerRef.value?.focusComposer?.()
    }
  }
}

async function stopWorkflowAgentGeneration() {
  const stoppedStageGeneration = stopActiveWorkflowStageGenerationIfNeeded()
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
  if (!cancelFailed) {
    setStatus(
      skillWorkbenchStatus,
      'success',
      stoppedStageGeneration
        ? '已停止生成，左侧画布已同步停止'
        : '已停止生成，迟到回复不会写入当前会话'
    )
  }
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
  const runId = createClientId()
  const asset = {
    id: createClientId(),
    projectId: state.currentProjectId,
    title: blueprint.title,
    meta: '项目蓝图 · 交互路径 · Demo',
    status: '已生成',
    workflowId: state.activeWorkflowRun?.workflowId || 'project-blueprint',
    skillId: 'project-blueprint',
    runId,
    blueprint,
    versions: [{ id: createClientId(), createdAt: new Date().toISOString(), content }],
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
  const runId = createClientId()
  const asset = {
    id: createClientId(),
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
        id: createClientId(),
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
    id: createClientId(),
    title: `${skill.name} 诊断结果`,
    assetType: 'Skill 诊断',
    content: JSON.stringify(data.diagnosis, null, 2)
  }

  if (data?.diagnosis && !data?.run) {
    runResult.diagnosis = data.diagnosis
  }

  skillWorkbenchResult.value = runResult.content || ''
  const runRecord = {
    id: runResult.id || createClientId(),
    projectId: state.currentProjectId,
    title: runResult.title || `${skill.name} 执行结果`,
    meta: `${skill.name} · ${new Date().toLocaleString()}`,
    status: '已完成',
    content: skillWorkbenchResult.value
  }
  const asset = {
    id: createClientId(),
    projectId: state.currentProjectId,
    title: runRecord.title,
    meta: runResult.assetType || skill.name,
    status: '已保存',
    skillId: skill.id,
    runId: runRecord.id,
    versions: [
      {
        id: createClientId(),
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
  const provider = modelSettings.provider || 'codex-cli'
  const apiSurface = ['responses', 'chat.completions'].includes(modelSettings.apiSurface)
    ? modelSettings.apiSurface
    : (provider === 'codex-cli' ? 'codex.exec' : 'responses')
  Object.assign(modelSettingsForm, {
    provider,
    baseUrl: modelSettings.baseUrl || '',
    defaultModel: modelSettings.defaultModel || 'gpt-5.5',
    apiSurface,
    apiKey: '',
    timeoutMs: modelSettings.timeoutMs === 0 ? 0 : (modelSettings.timeoutMs || (provider === 'codex-cli' ? 600000 : 20000)),
    fallback: modelSettings.fallback || 'deterministic',
    enabled: Boolean(modelSettings.enabled || provider === 'codex-cli' || (provider === 'openai-compatible' && modelSettings.hasApiKey))
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

function modelSettingsTimeoutValue(defaultMs = 20000) {
  const value = Number(modelSettingsForm.timeoutMs)
  return Number.isFinite(value) && value >= 0 ? value : defaultMs
}

async function saveBackendModelSettings() {
  setStatus(settingsStatus, 'loading', '正在保存后端模型配置...')
  const usesInternalAuth = modelSettingsForm.provider === 'codex-cli'
  const shouldEnableBackendModel = Boolean(
    usesInternalAuth ||
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
    timeoutMs: modelSettingsTimeoutValue(20000),
    fallback: modelSettingsForm.fallback,
    enabled: shouldEnableBackendModel
  }
  const result = await api.workspace.saveModelSettings(state.apiConfig, payload)
  const data = applyApiResult(settingsStatus, result, '后端模型配置保存失败')
  if (data?.modelSettings) {
    applyModelSettingsView(data.modelSettings)
    setStatus(settingsStatus, 'success', data.modelSettings.provider === 'codex-cli' ? '后端模型配置已保存，使用 Codex CLI 内部认证。' : (data.modelSettings.hasApiKey ? '后端模型配置已保存，key 已脱敏。' : '后端模型配置已保存，尚未保存 key。'))
  }
}

async function testBackendModelSettings() {
  setStatus(settingsStatus, 'loading', '正在测试后端模型连通...')
  const usesInternalAuth = modelSettingsForm.provider === 'codex-cli'
  const shouldEnableBackendModel = Boolean(
    usesInternalAuth ||
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
      timeoutMs: modelSettingsTimeoutValue(20000),
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
      timeoutMs: modelSettingsTimeoutValue(20000),
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
  setStatus(settingsStatus, 'success', '已恢复默认同源 API：当前 5588 服务内置 /api 接口')
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
    const labels = { idle: '未开始', loading: '请求中', success: '成功', failed: '失败', unconfigured: '需补充' }
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
  analysis: [
    ['path', { d: 'M4 19h16' }],
    ['path', { d: 'M7 16V9' }],
    ['path', { d: 'M12 16V5' }],
    ['path', { d: 'M17 16v-4' }],
    ['path', { d: 'M6 6l4 3 4-5 4 4' }]
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
