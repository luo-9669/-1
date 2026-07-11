function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderAdminConsoleHtml({
  title = '流程通后端管理台',
  apiBasePath = '/api'
} = {}) {
  const safeTitle = escapeHtml(title)
  const apiBase = String(apiBasePath || '/api').replace(/\/$/, '')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --el-color-primary: #409eff;
      --el-color-success: #67c23a;
      --el-color-warning: #e6a23c;
      --el-color-danger: #f56c6c;
      --el-text: #303133;
      --el-regular: #606266;
      --el-secondary: #909399;
      --el-border: #dcdfe6;
      --el-bg: #f5f7fa;
      --el-card: #ffffff;
      --el-menu: #263445;
      --el-menu-active: #409eff;
    }
    body {
      margin: 0;
      min-width: 1180px;
      font-family: Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
      color: var(--el-text);
      background: var(--el-bg);
    }
    button, input, select, textarea { font: inherit; }
    button {
      height: 32px;
      border: 1px solid var(--el-border);
      border-radius: 4px;
      background: #fff;
      color: var(--el-text);
      padding: 0 12px;
      cursor: pointer;
    }
    button.primary { border-color: var(--el-color-primary); background: var(--el-color-primary); color: #fff; }
    button.success { border-color: var(--el-color-success); background: var(--el-color-success); color: #fff; }
    button.danger { border-color: var(--el-color-danger); color: var(--el-color-danger); }
    button:disabled { cursor: not-allowed; opacity: 0.5; }
    button.text { border-color: transparent; background: transparent; color: var(--el-color-primary); }
    input, select, textarea {
      border: 1px solid var(--el-border);
      border-radius: 4px;
      background: #fff;
      color: var(--el-text);
      padding: 8px 10px;
    }
    textarea { min-height: 104px; resize: vertical; }
    .admin-layout { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; }
    .admin-aside {
      background: var(--el-menu);
      color: #d5dce8;
      padding: 16px 0;
    }
    .admin-logo {
      height: 56px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .admin-logo-mark {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--el-color-primary);
      color: #fff;
      font-weight: 700;
    }
    .admin-logo strong { display: block; color: #fff; }
    .admin-logo span { display: block; margin-top: 2px; color: #9ca9bd; font-size: 12px; }
    .admin-menu { display: grid; padding: 14px 8px; gap: 4px; }
    .admin-menu button {
      height: 42px;
      width: 100%;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: #d5dce8;
      text-align: left;
      padding: 0 14px;
    }
    .admin-menu button.active { background: #1f2d3d; color: #fff; box-shadow: inset 3px 0 0 var(--el-menu-active); }
    .admin-main { min-width: 0; }
    .admin-topbar {
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 20px;
      background: #fff;
      border-bottom: 1px solid #ebeef5;
    }
    .breadcrumb { color: var(--el-secondary); font-size: 13px; }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .admin-content { padding: 18px 20px 32px; }
    .page-title {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
    }
    .page-title h1 { margin: 0; font-size: 22px; }
    .page-title p { margin: 6px 0 0; color: var(--el-secondary); }
    .el-card {
      background: var(--el-card);
      border: 1px solid #ebeef5;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .metric-grid { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .metric-card { padding: 16px; }
    .metric-card span { color: var(--el-secondary); font-size: 13px; }
    .metric-card strong { display: block; margin-top: 8px; font-size: 26px; }
    .module-card { padding: 16px; }
    .module-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .search-input { width: 240px; }
    .analysis-form { display: grid; gap: 12px; }
    .analysis-form label { display: grid; gap: 6px; color: var(--el-regular); font-size: 13px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td {
      border-top: 1px solid #ebeef5;
      padding: 12px 10px;
      text-align: left;
      vertical-align: middle;
      font-size: 13px;
    }
    th { color: var(--el-secondary); background: #fafafa; font-weight: 600; }
    td { color: var(--el-regular); }
    .check-cell { width: 42px; text-align: center; }
    .check-cell input { width: 16px; height: 16px; padding: 0; vertical-align: middle; }
    .name-cell strong { display: block; color: var(--el-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .name-cell small { display: block; margin-top: 4px; color: var(--el-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      height: 24px;
      border-radius: 4px;
      padding: 0 8px;
      background: #ecf5ff;
      color: var(--el-color-primary);
      font-size: 12px;
    }
    .tag.success { background: #f0f9eb; color: var(--el-color-success); }
    .tag.warning { background: #fdf6ec; color: var(--el-color-warning); }
    .tag.danger { background: #fef0f0; color: var(--el-color-danger); }
    .tag.info { background: #f4f4f5; color: #909399; }
    .row-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 12px;
      color: var(--el-secondary);
      font-size: 13px;
    }
    .empty-state { padding: 42px; text-align: center; color: var(--el-secondary); }
    .two-col { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 14px; }
    .diagnostic-grid, .ownership-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .mini-card { padding: 14px; }
    .mini-card h3 { margin: 0 0 10px; font-size: 15px; }
    .mini-card p, .mini-card li { color: var(--el-regular); line-height: 1.7; }
    .mini-card ul { margin: 0; padding-left: 18px; }
    pre {
      margin: 0;
      max-height: 420px;
      overflow: auto;
      border-radius: 6px;
      padding: 14px;
      background: #1f2d3d;
      color: #d5dce8;
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .admin-drawer-backdrop, .admin-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 30;
      background: rgba(0,0,0,0.32);
      display: none;
    }
    .admin-drawer-backdrop.open, .admin-dialog-backdrop.open { display: block; }
    .admin-drawer {
      position: absolute;
      top: 0;
      right: 0;
      width: 520px;
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: #fff;
      box-shadow: -8px 0 28px rgba(0,0,0,0.16);
    }
    .drawer-head, .drawer-foot {
      padding: 16px 18px;
      border-bottom: 1px solid #ebeef5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .drawer-foot { border-top: 1px solid #ebeef5; border-bottom: 0; justify-content: flex-end; }
    .drawer-body { padding: 18px; overflow: auto; }
    .form-grid { display: grid; gap: 12px; }
    .form-grid label { display: grid; gap: 6px; color: var(--el-regular); font-size: 13px; }
    .admin-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      width: 420px;
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.18);
      padding: 18px;
    }
    .admin-dialog h3 { margin: 0 0 10px; }
    .admin-dialog p { color: var(--el-regular); line-height: 1.7; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="admin-layout">
    <aside class="admin-aside">
      <div class="admin-logo">
        <div class="admin-logo-mark">流</div>
        <div><strong>${safeTitle}</strong><span>Element Plus Admin 风格</span></div>
      </div>
      <nav class="admin-menu" id="adminMenu">
        <button class="active" type="button" data-view="requirements">需求文档</button>
        <button type="button" data-view="materials">知识库</button>
        <button type="button" data-view="workflowRuns">设计方案</button>
        <button type="button" data-view="restoredPages">工程开发</button>
        <button type="button" data-view="assets">交付资产</button>
        <button type="button" data-view="skills">技能中心</button>
        <button type="button" data-view="competitors">竞品表</button>
        <button type="button" data-view="competitorAnalysis">竞品分析</button>
        <button type="button" data-view="dashboard">控制台</button>
        <button type="button" data-view="projects">项目管理</button>
        <button type="button" data-view="generatedKnowledge">沉淀知识</button>
        <button type="button" data-view="parseJobs">解析任务</button>
        <button type="button" data-view="settings">系统配置</button>
        <button type="button" data-view="diagnostics">系统诊断</button>
        <button type="button" data-view="apiDebug">API 调试</button>
      </nav>
    </aside>
    <main class="admin-main">
      <header class="admin-topbar">
        <div>
          <div class="breadcrumb">后台 / <span id="breadcrumbText">控制台</span></div>
        </div>
        <div class="top-actions">
          <span class="tag info" id="statusText">等待加载</span>
          <button type="button" id="exportBtn">导出 Workspace</button>
          <button class="primary" type="button" id="refreshBtn">刷新</button>
        </div>
      </header>
      <section class="admin-content" id="appRoot"></section>
    </main>
  </div>

  <div class="admin-drawer-backdrop" id="drawerBackdrop">
    <section class="admin-drawer">
      <div class="drawer-head">
        <div><strong id="drawerTitle">详情</strong><div class="breadcrumb" id="drawerSubtitle"></div></div>
        <button type="button" id="drawerCloseBtn">关闭</button>
      </div>
      <div class="drawer-body" id="drawerBody"></div>
      <div class="drawer-foot" id="drawerFoot"></div>
    </section>
  </div>

  <div class="admin-dialog-backdrop" id="dialogBackdrop">
    <section class="admin-dialog">
      <h3>删除确认</h3>
      <p id="dialogText">确认删除这条记录？</p>
      <div class="dialog-actions">
        <button type="button" id="dialogCancelBtn">取消</button>
        <button class="danger" type="button" id="dialogConfirmBtn">确认删除</button>
      </div>
    </section>
  </div>

  <script>
    const apiBase = '${apiBase}';
    const modules = {
      requirements: {
        title: '需求文档',
        desc: '对应前台“需求文档”，管理当前 workspace 中的需求资料和文档解析结果。',
        collection: 'materials',
        defaultValues: { type: 'requirements', status: '待解析' },
        filter(record) { return record.type === 'requirements'; },
        searchable: ['title', 'type', 'status', 'content'],
        fields: [
          ['title', '需求标题', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['type', '资料类型', 'select', ['requirements']],
          ['status', '状态', 'input'],
          ['meta', '来源/版本', 'input'],
          ['notes', '备注', 'textarea'],
          ['content', '内容', 'textarea']
        ]
      },
      projects: {
        title: '项目管理',
        desc: '管理项目空间，支持新增、编辑、查看详情和删除。',
        collection: 'projects',
        searchable: ['name', 'domain', 'targetUsers', 'description'],
        fields: [
          ['name', '项目名称', 'input'],
          ['domain', '业务领域', 'input'],
          ['targetUsers', '目标用户', 'input'],
          ['description', '项目说明', 'textarea']
        ]
      },
      materials: {
        title: '知识库',
        desc: '对应前台“知识库”，管理可进入项目知识检索和沉淀流程的资料。',
        collection: 'materials',
        defaultValues: { type: 'knowledge', status: '待解析' },
        filter(record) { return record.type !== 'requirements' && record.type !== 'competitors'; },
        searchable: ['title', 'type', 'status', 'content'],
        fields: [
          ['title', '知识标题', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['type', '资料类型', 'select', ['knowledge', 'blueprint']],
          ['status', '状态', 'input'],
          ['meta', '来源/版本', 'input'],
          ['notes', '备注', 'textarea'],
          ['content', '内容', 'textarea']
        ]
      },
      generatedKnowledge: {
        title: '沉淀知识',
        desc: '管理用户生成后确认沉淀的项目知识，作为 AI 检索首选事实源。',
        collection: 'generatedKnowledge',
        searchable: ['title', 'summary', 'content', 'sourceSkillId', 'sourceRunId'],
        fields: [
          ['title', '知识标题', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['sourceRunId', '来源运行 ID', 'input'],
          ['sourceSkillId', '来源 Skill ID', 'input'],
          ['verifiedStatus', '可信状态', 'select', ['verified', 'unverified', 'rejected']],
          ['summary', '摘要', 'textarea'],
          ['content', '内容', 'textarea']
        ]
      },
      parseJobs: {
        title: '解析任务',
        desc: '查看网站、蓝图和文档导入的后端解析任务，支持复核、编辑和删除。',
        collection: 'parseJobs',
        searchable: ['sourceType', 'sourceUrl', 'sourceAssetId', 'action', 'status', 'summary', 'error'],
        readonlyCreate: true,
        fields: [
          ['projectId', '项目 ID', 'input'],
          ['sourceType', '来源类型', 'select', ['website', 'blueprint', 'document', 'unknown']],
          ['sourceUrl', '来源 URL', 'input'],
          ['sourceAssetId', '来源资产 ID', 'input'],
          ['action', '动作', 'input'],
          ['status', '状态', 'select', ['pending', 'running', 'succeeded', 'failed', 'reviewed']],
          ['materialCount', '资料数量', 'input'],
          ['durationMs', '耗时 ms', 'input'],
          ['summary', '摘要', 'textarea'],
          ['error', '错误信息', 'textarea']
        ]
      },
      assets: {
        title: '交付资产',
        desc: '对应前台“交付资产”，管理设计方案输出、交付文件和沉淀记录。',
        collection: 'assets',
        searchable: ['title', 'type', 'status', 'content'],
        fields: [
          ['title', '资产标题', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['type', '资产类型', 'input'],
          ['status', '状态', 'input'],
          ['meta', '说明', 'input'],
          ['content', '内容', 'textarea']
        ]
      },
      restoredPages: {
        title: '工程开发',
        desc: '对应前台“工程开发”，查看生成的还原页面、预览和源码入口。',
        collection: 'restoredPages',
        searchable: ['title', 'sourceUrl', 'codeFormat'],
        fields: [
          ['title', '页面标题', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['codeFormat', '代码格式', 'select', ['html', 'vue']],
          ['sourceUrl', '来源 URL', 'input'],
          ['html', 'HTML', 'textarea']
        ]
      },
      workflowRuns: {
        title: '设计方案',
        desc: '对应前台“设计方案”，查看方案生成链路、运行状态和画布记录。',
        collection: 'workflowRuns',
        searchable: ['workflowName', 'status', 'projectId'],
        fields: [
          ['workflowName', '流程名称', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['workflowId', '流程 ID', 'input'],
          ['status', '状态', 'input']
        ]
      },
      skills: {
        title: '技能中心',
        desc: '对应前台“技能中心”，管理系统 Skill、自定义 Skill、审核状态和项目可见范围。',
        collection: 'skills',
        searchable: ['name', 'category', 'source', 'status', 'description'],
        fields: [
          ['name', 'Skill 名称', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['category', '分类', 'input'],
          ['source', '来源', 'select', ['system', 'custom', 'imported']],
          ['visibility', '可见范围', 'select', ['global', 'project']],
          ['status', '状态', 'select', ['draft', 'pending-review', 'active', 'disabled']],
          ['description', '说明', 'textarea'],
          ['content', 'Skill 内容', 'textarea']
        ]
      },
      competitors: {
        title: '竞品表',
        desc: '对应前台“竞品分析”的“竞品表”，管理竞品对象和分析入口数据。',
        collection: 'competitors',
        searchable: ['name', 'websiteUrl', 'summary', 'status'],
        fields: [
          ['name', '竞品名称', 'input'],
          ['projectId', '项目 ID', 'input'],
          ['websiteUrl', '官网地址', 'input'],
          ['status', '状态', 'input'],
          ['summary', '摘要', 'textarea']
        ]
      },
      competitorAnalysis: {
        title: '竞品分析',
        desc: '后台直接调用新版竞品分析引擎，用于验证扫描、周报、交互流程和完整框架报告。',
        virtual: true
      },
      settings: {
        title: '系统配置',
        desc: '管理 API 地址、功能开关和运行配置；敏感值应由后端环境变量接管。',
        collection: 'settings',
        searchable: ['key', 'group', 'status', 'description'],
        fields: [
          ['key', '配置键', 'input'],
          ['value', '配置值', 'input'],
          ['group', '分组', 'select', ['api', 'capture', 'ai', 'knowledge', 'general']],
          ['status', '状态', 'select', ['active', 'disabled']],
          ['description', '说明', 'textarea']
        ]
      }
    };
    let workspace = { projects: [], materials: [], parseJobs: [], assets: [], restoredPages: [], workflowRuns: [], skillRuns: [], skills: [], competitors: [], settings: [] };
    let adminSummary = null;
    let currentView = 'requirements';
    let pageState = {};
    let drawerState = { mode: 'detail', moduleKey: '', record: null };
    let pendingDelete = null;

    const $ = (id) => document.getElementById(id);
    const asArray = (value) => Array.isArray(value) ? value : [];
    const escapeHtml = (value = '') => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
    const labelFor = (record = {}) => record.name || record.title || record.workflowName || record.action || record.sourceType || record.id || '未命名';
    const moduleState = (key) => {
      pageState[key] ||= { keyword: '', page: 1, pageSize: 8 };
      return pageState[key];
    };

    async function requestJson(path, options = {}) {
      const response = await fetch(apiBase + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '请求失败：' + response.status);
      return data;
    }

    function setStatus(message, type = 'info') {
      const status = $('statusText');
      status.textContent = message;
      status.className = 'tag ' + type;
    }

    async function loadAll() {
      setStatus('加载中');
      const [nextWorkspace, summary] = await Promise.all([
        requestJson('/workspace'),
        requestJson('/admin/summary')
      ]);
      workspace = nextWorkspace;
      adminSummary = summary;
      render();
      setStatus('已同步 ' + new Date().toLocaleTimeString(), 'success');
    }

    function switchView(view) {
      currentView = view;
      document.querySelectorAll('[data-view]').forEach((button) => {
        button.classList.toggle('active', button.dataset.view === view);
      });
      render();
    }

    function render() {
      $('breadcrumbText').textContent = modules[currentView]?.title || (currentView === 'dashboard' ? '控制台' : currentView === 'diagnostics' ? '系统诊断' : 'API 调试');
      if (currentView === 'dashboard') renderDashboard();
      else if (currentView === 'diagnostics') renderDiagnostics();
      else if (currentView === 'apiDebug') renderApiDebug();
      else if (currentView === 'competitorAnalysis') renderCompetitorAnalysis();
      else renderModule(currentView);
    }

    function renderDashboard() {
      const counts = adminSummary?.counts || {};
      const metrics = [
        ['项目数', counts.projects || 0],
        ['资料', counts.materials || 0],
        ['解析任务', counts.parseJobs || 0],
        ['资产', counts.assets || 0],
        ['还原页面', counts.restoredPages || 0],
        ['工作流运行', counts.workflowRuns || 0],
        ['Skill', counts.skills || 0],
        ['系统配置', counts.settings || 0]
      ];
      $('appRoot').innerHTML = \`
        <div class="page-title">
          <div><h1>Element Plus Admin 控制台</h1><p>Workspace 数据分模块管理项目、资料、资产、工程页面和工作流运行。</p></div>
          <button class="primary" type="button" onclick="openCreate('projects')">新建项目</button>
        </div>
        <section class="metric-grid">\${metrics.map(([label, value]) => \`<article class="el-card metric-card"><span>\${label}</span><strong>\${value}</strong></article>\`).join('')}</section>
        <section class="two-col">
          <div class="el-card module-card">
            <div class="module-toolbar"><strong>最近数据</strong><button type="button" onclick="switchView('materials')">查看资料</button></div>
            \${renderSimpleRecent()}
          </div>
          <div class="el-card module-card">
            <strong>后台职责</strong>
            <div class="mini-card"><p>后台只做内部数据查看、诊断和安全操作；前台继续服务真实用户流程；后端保持 JSON API 契约。</p></div>
          </div>
        </section>\`;
    }

    function renderSimpleRecent() {
      const items = [
        ...asArray(workspace.projects).slice(0, 3),
        ...asArray(workspace.materials).slice(0, 3),
        ...asArray(workspace.parseJobs).slice(0, 3),
        ...asArray(workspace.workflowRuns).slice(0, 3),
        ...asArray(workspace.skills).slice(0, 2)
      ];
      if (!items.length) return '<div class="empty-state">暂无数据</div>';
      return '<table><thead><tr><th>名称</th><th>状态</th><th>更新时间</th></tr></thead><tbody>' + items.map((item) =>
        \`<tr><td class="name-cell"><strong>\${escapeHtml(labelFor(item))}</strong><small>\${escapeHtml(item.id || '')}</small></td><td><span class="tag">\${escapeHtml(item.status || item.stage || '未标记')}</span></td><td>\${escapeHtml(item.updatedAt || item.createdAt || '')}</td></tr>\`
      ).join('') + '</tbody></table>';
    }

    function recordsFor(moduleKey) {
      const config = modules[moduleKey];
      const state = moduleState(moduleKey);
      const keyword = state.keyword.trim().toLowerCase();
      return asArray(workspace[config.collection]).filter((record) => {
        if (typeof config.filter === 'function' && !config.filter(record)) return false;
        if (!keyword) return true;
        return config.searchable.some((key) => String(record[key] || '').toLowerCase().includes(keyword));
      });
    }

    function renderModule(moduleKey) {
      const config = modules[moduleKey];
      const state = moduleState(moduleKey);
      const records = recordsFor(moduleKey);
      const total = records.length;
      const start = (state.page - 1) * state.pageSize;
      const pageItems = records.slice(start, start + state.pageSize);
      const selected = selectedIds(moduleKey);
      const currentPageIds = pageItems.map((item) => item.id).filter(Boolean);
      const allCurrentSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selected.includes(id));
      $('appRoot').innerHTML = \`
        <div class="page-title">
          <div><h1>\${config.title}</h1><p>\${config.desc}</p></div>
          \${config.readonlyCreate ? '' : \`<button class="primary" type="button" onclick="openCreate('\${moduleKey}')">新增</button>\`}
        </div>
        <section class="el-card module-card">
          <div class="module-toolbar">
            <div class="toolbar-left">
              <input class="search-input" placeholder="搜索" value="\${escapeHtml(state.keyword)}" oninput="updateSearch('\${moduleKey}', this.value)" />
              <button type="button" onclick="resetSearch('\${moduleKey}')">重置</button>
            </div>
            <div class="toolbar-right">
              <span>共 \${total} 条，已选 \${selected.length} 条</span>
              <button type="button" onclick="togglePageSelection('\${moduleKey}')" \${currentPageIds.length ? '' : 'disabled'}>\${allCurrentSelected ? '取消本页' : '本页全选'}</button>
              <button class="danger" type="button" onclick="confirmBatchDelete('\${moduleKey}')" \${selected.length ? '' : 'disabled'}>批量删除</button>
              <button type="button" onclick="loadAll()">刷新</button>
            </div>
          </div>
          \${renderTable(moduleKey, pageItems)}
          <div class="pagination"><span>分页 \${state.page} / \${Math.max(1, Math.ceil(total / state.pageSize))}</span><button type="button" onclick="prevPage('\${moduleKey}')">上一页</button><button type="button" onclick="nextPage('\${moduleKey}')">下一页</button></div>
        </section>\`;
    }

    function renderTable(moduleKey, items) {
      if (!items.length) return '<div class="empty-state">暂无数据</div>';
      const selected = selectedIds(moduleKey);
      const statusHeader = moduleKey === 'projects' ? '业务领域' : '状态';
      return '<table><thead><tr><th class="check-cell">选择</th><th style="width:32%">名称</th><th>' + statusHeader + '</th><th>归属/类型</th><th>更新时间</th><th style="width:210px;text-align:right">操作</th></tr></thead><tbody>' +
        items.map((item) => \`<tr>
          <td class="check-cell"><input type="checkbox" aria-label="选择 \${escapeHtml(labelFor(item))}" \${selected.includes(item.id) ? 'checked' : ''} onchange="toggleSelection('\${moduleKey}','\${item.id}', this.checked)" /></td>
          <td class="name-cell"><strong>\${escapeHtml(labelFor(item))}</strong><small>\${escapeHtml(item.id || '')}</small></td>
          <td>\${moduleKey === 'projects' ? escapeHtml(item.domain || '未设置领域') : \`<span class="tag \${tagClass(item.status || item.codeFormat)}">\${escapeHtml(item.status || item.codeFormat || '未标记')}</span>\`}</td>
          <td>\${escapeHtml([item.projectId, item.type || item.sourceType || item.domain || item.workflowId].filter(Boolean).join(' / ') || '全局')}</td>
          <td>\${escapeHtml(item.updatedAt || item.createdAt || '')}</td>
          <td><div class="row-actions"><button class="text" type="button" onclick="openDetail('\${moduleKey}','\${item.id}')">详情</button><button class="text" type="button" onclick="openEdit('\${moduleKey}','\${item.id}')">编辑</button><button class="danger" type="button" onclick="confirmDelete('\${moduleKey}','\${item.id}')">删除</button></div></td>
        </tr>\`).join('') +
        '</tbody></table>';
    }

    function tagClass(value = '') {
      if (/成功|保存|design|html|vue|running|succeeded|reviewed/.test(value)) return 'success';
      if (/失败|error|failed/.test(value)) return 'danger';
      if (/草稿|discovery|pending/.test(value)) return 'warning';
      return 'info';
    }

    function renderDiagnostics() {
      const health = adminSummary?.health || {};
      const ownership = adminSummary?.ownership || {};
      $('appRoot').innerHTML = \`
        <div class="page-title"><div><h1>系统诊断</h1><p>查看 API、存储、前台和职责边界。</p></div></div>
        <section class="diagnostic-grid">
          <article class="el-card mini-card"><h3>API 服务</h3><span class="tag success">\${escapeHtml(health.api?.status || 'unknown')}</span><p>\${escapeHtml(health.api?.baseUrl || '')}</p></article>
          <article class="el-card mini-card"><h3>前台工作台</h3><span class="tag info">\${escapeHtml(health.frontend?.status || 'unknown')}</span><p>\${escapeHtml(health.frontend?.baseUrl || '')}</p></article>
          <article class="el-card mini-card"><h3>本地存储</h3><span class="tag warning">\${escapeHtml(health.storage?.status || 'unknown')}</span><p>\${escapeHtml(health.storage?.filePath || 'memory')}</p></article>
        </section>
        <h2 style="margin:18px 0 10px;font-size:16px">前后端分工</h2>
        <section class="ownership-grid" style="margin-top:14px">
          \${['frontend','backend','admin'].map((key) => \`<article class="el-card mini-card"><h3>\${key}</h3><ul>\${asArray(ownership[key]).map((item) => \`<li>\${escapeHtml(item)}</li>\`).join('')}</ul></article>\`).join('')}
        </section>
        <section class="el-card module-card" style="margin-top:14px"><strong>启动命令</strong><pre>npm run api:restart\\nnpm run dev\\nnpm run dev:all</pre></section>\`;
    }

    function renderApiDebug() {
      $('appRoot').innerHTML = \`
        <div class="page-title"><div><h1>API 调试</h1><p>选择接口后发送请求，响应会显示在右侧结果区。</p></div></div>
        <section class="two-col">
          <div class="el-card module-card">
            <div class="form-grid">
              <label>接口<select id="debugEndpoint"><option value="/workspace">GET /api/workspace</option><option value="/admin/summary">GET /api/admin/summary</option><option value="/admin/export">GET /api/admin/export</option><option value="/workspace/materials">GET /api/workspace/materials</option><option value="/health">GET /api/health</option></select></label>
              <button class="primary" type="button" onclick="runDebugRequest()">发送请求</button>
            </div>
          </div>
          <pre id="debugOutput">等待请求</pre>
        </section>\`;
    }

    function renderCompetitorAnalysis() {
      $('appRoot').innerHTML = \`
        <div class="page-title">
          <div><h1>竞品分析</h1><p>对应前台“竞品分析”入口，后台用于直接验证后端分析引擎是否可用。</p></div>
        </div>
        <section class="two-col">
          <div class="el-card module-card">
            <div class="analysis-form">
              <label>分析类型
                <select id="analysisKind">
                  <option value="daily">每日扫描</option>
                  <option value="weekly">周报生成</option>
                  <option value="flow" selected>交互流程</option>
                  <option value="framework">完整框架</option>
                </select>
              </label>
              <label>竞品名称<input id="analysisCompetitor" value="HeyGen" /></label>
              <label>功能名称<input id="analysisFeature" value="AI Avatar" /></label>
              <label>产品地址<input id="analysisProductUrl" value="https://www.heygen.com" /></label>
              <label>产品名称<input id="analysisProductName" value="HeyGen" /></label>
              <button class="primary" type="button" id="runCompetitorAnalysisBtn" onclick="runCompetitorAnalysis()">开始分析</button>
            </div>
          </div>
          <pre id="competitorAnalysisOutput">等待分析</pre>
        </section>\`;
    }

    async function runCompetitorAnalysis() {
      const output = $('competitorAnalysisOutput');
      const button = $('runCompetitorAnalysisBtn');
      output.textContent = '正在调用竞品分析引擎...';
      button.disabled = true;
      try {
        const data = await requestJson('/competitor-analysis/run', {
          method: 'POST',
          body: JSON.stringify({
            kind: $('analysisKind').value,
            competitor: $('analysisCompetitor').value,
            feature: $('analysisFeature').value,
            productUrl: $('analysisProductUrl').value,
            productName: $('analysisProductName').value
          })
        });
        output.textContent = data.markdown || JSON.stringify(data, null, 2);
        setStatus(data.ok ? '竞品分析完成' : '竞品分析未完成', data.ok ? 'success' : 'warning');
      } catch (error) {
        output.textContent = error.message;
        setStatus('竞品分析失败', 'danger');
      } finally {
        button.disabled = false;
      }
    }

    function updateSearch(moduleKey, value) {
      const state = moduleState(moduleKey);
      state.keyword = value;
      state.page = 1;
      renderModule(moduleKey);
    }
    function resetSearch(moduleKey) { moduleState(moduleKey).keyword = ''; moduleState(moduleKey).page = 1; renderModule(moduleKey); }
    function prevPage(moduleKey) { const state = moduleState(moduleKey); state.page = Math.max(1, state.page - 1); renderModule(moduleKey); }
    function nextPage(moduleKey) {
      const state = moduleState(moduleKey);
      const max = Math.max(1, Math.ceil(recordsFor(moduleKey).length / state.pageSize));
      state.page = Math.min(max, state.page + 1);
      renderModule(moduleKey);
    }

    function recordById(moduleKey, id) {
      return asArray(workspace[modules[moduleKey].collection]).find((item) => item.id === id) || null;
    }
    function selectedIds(moduleKey) {
      const state = moduleState(moduleKey);
      state.selectedIds ||= [];
      return state.selectedIds;
    }
    function toggleSelection(moduleKey, id, checked) {
      const selected = selectedIds(moduleKey);
      if (checked && !selected.includes(id)) selected.push(id);
      if (!checked) moduleState(moduleKey).selectedIds = selected.filter((item) => item !== id);
      renderModule(moduleKey);
    }
    function togglePageSelection(moduleKey) {
      const state = moduleState(moduleKey);
      const records = recordsFor(moduleKey);
      const start = (state.page - 1) * state.pageSize;
      const pageIds = records.slice(start, start + state.pageSize).map((item) => item.id).filter(Boolean);
      const selected = selectedIds(moduleKey);
      const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
      state.selectedIds = allSelected
        ? selected.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...selected, ...pageIds]));
      renderModule(moduleKey);
    }

    function openDetail(moduleKey, id) {
      drawerState = { mode: 'detail', moduleKey, record: recordById(moduleKey, id) };
      openDrawer();
    }
    function openEdit(moduleKey, id) {
      drawerState = { mode: 'edit', moduleKey, record: { ...recordById(moduleKey, id) } };
      openDrawer();
    }
    function openCreate(moduleKey) {
      drawerState = { mode: 'create', moduleKey, record: {} };
      openDrawer();
    }

    function openDrawer() {
      const config = modules[drawerState.moduleKey];
      $('drawerTitle').textContent = drawerState.mode === 'create' ? '新增' + config.title : drawerState.mode === 'edit' ? '编辑' + config.title : config.title + '详情';
      $('drawerSubtitle').textContent = config.desc;
      $('drawerBody').innerHTML = drawerState.mode === 'detail' ? renderDetail(drawerState.record) : renderForm(config, drawerState.record);
      $('drawerFoot').innerHTML = drawerState.mode === 'detail'
        ? '<button type="button" onclick="closeDrawer()">关闭</button>'
        : '<button type="button" onclick="closeDrawer()">取消</button><button class="primary" type="button" onclick="submitDrawer()">保存</button>';
      $('drawerBackdrop').classList.add('open');
    }
    function closeDrawer() { $('drawerBackdrop').classList.remove('open'); }

    function renderDetail(record = {}) {
      const jobSummary = record?.sourceType
        ? \`<div class="mini-card"><strong>解析概览</strong><p>sourceType: \${escapeHtml(record.sourceType || '')} · materialCount: \${escapeHtml(record.materialCount ?? 0)} · durationMs: \${escapeHtml(record.durationMs ?? 0)}</p><p>\${escapeHtml(record.sourceUrl || record.sourceAssetId || record.summary || '')}</p></div>\`
        : '';
      return jobSummary + '<pre>' + escapeHtml(JSON.stringify(record || {}, null, 2)) + '</pre>';
    }

    function renderForm(config, record = {}) {
      return '<div class="form-grid">' + config.fields.map(([key, label, type, options = []]) => {
        const value = record[key] ?? config.defaultValues?.[key] ?? '';
        if (type === 'textarea') return \`<label>\${label}<textarea data-field="\${key}">\${escapeHtml(value)}</textarea></label>\`;
        if (type === 'select') return \`<label>\${label}<select data-field="\${key}">\${options.map((option) => \`<option value="\${escapeHtml(option)}" \${option === value ? 'selected' : ''}>\${escapeHtml(option)}</option>\`).join('')}</select></label>\`;
        return \`<label>\${label}<input data-field="\${key}" value="\${escapeHtml(value)}" /></label>\`;
      }).join('') + '</div>';
    }

    async function submitDrawer() {
      const config = modules[drawerState.moduleKey];
      const payload = { ...(config.defaultValues || {}) };
      document.querySelectorAll('[data-field]').forEach((field) => { payload[field.dataset.field] = field.value; });
      if (drawerState.mode === 'edit') {
        await requestJson('/admin/records/' + config.collection + '/' + encodeURIComponent(drawerState.record.id), {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson('/admin/records/' + config.collection, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      closeDrawer();
      await loadAll();
      switchView(drawerState.moduleKey);
    }

    function confirmDelete(moduleKey, id) {
      pendingDelete = { moduleKey, ids: [id] };
      const record = recordById(moduleKey, id);
      $('dialogText').textContent = '确认删除「' + labelFor(record) + '」？删除后会写入后端存储。';
      $('dialogBackdrop').classList.add('open');
    }
    function confirmBatchDelete(moduleKey) {
      const ids = selectedIds(moduleKey);
      if (!ids.length) return;
      pendingDelete = { moduleKey, ids: [...ids] };
      $('dialogText').textContent = '确认批量删除 ' + ids.length + ' 条记录？删除后会写入后端存储。';
      $('dialogBackdrop').classList.add('open');
    }
    function closeDialog() { $('dialogBackdrop').classList.remove('open'); pendingDelete = null; }
    async function deletePending() {
      if (!pendingDelete) return;
      const config = modules[pendingDelete.moduleKey];
      if (pendingDelete.ids.length === 1) {
        await requestJson('/admin/records/' + config.collection + '/' + encodeURIComponent(pendingDelete.ids[0]), { method: 'DELETE' });
      } else {
        await requestJson('/admin/records/' + config.collection + '/batch-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: pendingDelete.ids })
        });
      }
      const moduleKey = pendingDelete.moduleKey;
      moduleState(moduleKey).selectedIds = [];
      closeDialog();
      await loadAll();
      switchView(moduleKey);
    }

    async function runDebugRequest() {
      const output = $('debugOutput');
      output.textContent = '请求中...';
      try {
        const data = await requestJson($('debugEndpoint').value);
        output.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        output.textContent = error.message;
      }
    }

    async function exportWorkspace() {
      const data = await requestJson('/admin/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'flow-workspace-export.json';
      link.click();
      URL.revokeObjectURL(url);
    }

    $('adminMenu').addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (button) switchView(button.dataset.view);
    });
    $('refreshBtn').addEventListener('click', () => void loadAll());
    $('exportBtn').addEventListener('click', () => void exportWorkspace());
    $('drawerCloseBtn').addEventListener('click', closeDrawer);
    $('dialogCancelBtn').addEventListener('click', closeDialog);
    $('dialogConfirmBtn').addEventListener('click', () => void deletePending());

    Object.assign(window, {
      switchView,
      openCreate,
      openDetail,
      openEdit,
      confirmDelete,
      confirmBatchDelete,
      submitDrawer,
      closeDrawer,
      closeDialog,
      runDebugRequest,
      runCompetitorAnalysis,
      updateSearch,
      resetSearch,
      toggleSelection,
      togglePageSelection,
      prevPage,
      nextPage
    });

    void loadAll().catch((error) => {
      setStatus('加载失败：' + error.message, 'danger');
      $('appRoot').innerHTML = '<pre>' + escapeHtml(error.stack || error.message) + '</pre>';
    });
  </script>
</body>
</html>`;
}
