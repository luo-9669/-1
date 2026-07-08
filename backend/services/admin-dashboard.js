import { workspaceSnapshot } from './workspace-store.js'

const OWNERSHIP = {
  frontend: [
    '页面布局和交互状态',
    '用户输入、上传入口和错误恢复展示',
    '通过 frontend/src/services/api.js 调用后端并渲染结果'
  ],
  backend: [
    '数据模型、持久化和业务规则',
    '文件解析、网页采集、页面生成和质量门禁',
    'Agent 调用、统一错误格式和恢复建议'
  ],
  admin: [
    '内部数据查看、诊断和安全操作',
    '工作区导出、运行状态检查和接口调试',
    '面向开发/运营，不替代用户前台'
  ]
}

const ENDPOINTS = [
  { method: 'GET', path: '/api/workspace', owner: 'backend', purpose: '读取完整工作区快照' },
  { method: 'GET', path: '/api/workspace/materials', owner: 'backend', purpose: '按项目和类型读取资料' },
  { method: 'POST', path: '/api/workspace/materials', owner: 'backend', purpose: '创建资料' },
  { method: 'GET', path: '/api/workspace/generated-knowledge', owner: 'backend', purpose: '读取用户确认沉淀知识' },
  { method: 'POST', path: '/api/workspace/generated-knowledge', owner: 'backend', purpose: '创建用户确认沉淀知识' },
  { method: 'DELETE', path: '/api/workspace/materials/:id', owner: 'backend', purpose: '删除资料' },
  { method: 'GET', path: '/api/workspace/restored-pages/:id/preview', owner: 'backend', purpose: '读取工程开发页面预览' },
  { method: 'GET', path: '/api/workspace/restored-pages/:id/source', owner: 'backend', purpose: '读取工程开发源码' },
  { method: 'GET', path: '/api/admin/summary', owner: 'admin', purpose: '读取后台摘要和诊断信息' },
  { method: 'GET', path: '/api/admin/export', owner: 'admin', purpose: '导出工作区快照' }
]

function count(items) {
  return Array.isArray(items) ? items.length : 0
}

function latest(items = []) {
  return [...items]
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, 8)
}

function manageableSkills(skills = []) {
  return Array.isArray(skills) ? skills.filter((skill) => skill?.source !== 'system') : []
}

export function buildAdminSummary(store, options = {}) {
  const snapshot = workspaceSnapshot(store)
  const userSkills = manageableSkills(store.skills)
  const apiPort = Number(options.apiPort || process.env.PORT || 5299)
  const frontendPort = Number(options.frontendPort || 5288)
  const storageFile = options.storageFile || store.filePath || ''

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      projects: count(snapshot.projects),
      materials: count(snapshot.materials),
      generatedKnowledge: count(snapshot.generatedKnowledge),
      parseJobs: count(snapshot.parseJobs),
      assets: count(snapshot.assets),
      restoredPages: count(snapshot.restoredPages),
      workflowRuns: count(snapshot.workflowRuns),
      skillRuns: count(snapshot.skillRuns),
      skills: count(userSkills),
      settings: count(snapshot.settings)
    },
    health: {
      api: {
        status: 'ok',
        port: apiPort,
        baseUrl: `http://localhost:${apiPort}`,
        adminUrl: `http://localhost:${apiPort}/admin`
      },
      frontend: {
        status: 'separate',
        port: frontendPort,
        baseUrl: `http://localhost:${frontendPort}`
      },
      storage: {
        status: storageFile ? 'file-backed' : 'memory',
        filePath: storageFile
      }
    },
    ownership: OWNERSHIP,
    endpoints: ENDPOINTS,
    recent: {
      projects: latest(snapshot.projects),
      materials: latest(snapshot.materials),
      generatedKnowledge: latest(snapshot.generatedKnowledge),
      parseJobs: latest(snapshot.parseJobs),
      assets: latest(snapshot.assets),
      restoredPages: latest(snapshot.restoredPages),
      workflowRuns: latest(snapshot.workflowRuns),
      skills: latest(userSkills),
      settings: latest(snapshot.settings)
    },
    recommendations: [
      'API 保持 JSON 契约，后台管理台通过 /api/admin/* 和 /api/workspace/* 读取数据。',
      '前台只负责产品体验，后端负责数据和业务规则，后台负责内部诊断和安全操作。',
      '危险操作必须经过二次确认，并优先调用后端服务层而不是直接改存储文件。'
    ]
  }
}

export function buildAdminExport(store) {
  return {
    generatedAt: new Date().toISOString(),
    format: 'flow-workspace-admin-export.v1',
    workspace: workspaceSnapshot(store)
  }
}
