import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createWorkspaceWorkflowRun } from '../models/workspace.js'
import { analyzeRequirementDocuments } from '../services/document-parser.js'
import { buildTotalDesignFlow } from '../services/total-design-flow.js'
import { createWorkspaceStore, listMaterials, listParseJobs, modelSettingsView, saveModelSettings, upsertWorkflowRun } from '../services/workspace-store.js'
import { workspaceRoutes } from './workspace.js'

test('workspace route exports markdown as a direct PDF download', async () => {
  const store = createWorkspaceStore({ projects: [], workflowRuns: [], materials: [] })
  const routes = workspaceRoutes(store, {
    renderMarkdownPdf: async (payload) => {
      assert.match(payload.markdown, /需求理解/)
      assert.equal(payload.fileName, '高级UX需求分析.pdf')
      return Buffer.from('%PDF-1.4\n%stub\n')
    }
  })

  const result = await routes['POST /api/workspace/markdown-pdf']({
    fileName: '高级UX需求分析.md',
    markdown: '# 需求理解\n\n正文'
  })

  assert.equal(result.contentType, 'application/pdf')
  assert.match(result.headers['Content-Disposition'], /filename\*=UTF-8''/)
  assert.ok(Buffer.isBuffer(result.body))
  assert.match(result.body.toString('utf8'), /^%PDF/)
})

test('workspace storage status exposes deploy diagnostics without secrets', async () => {
  const previousUrl = process.env.COZE_SUPABASE_URL
  const previousAnonKey = process.env.COZE_SUPABASE_ANON_KEY
  process.env.COZE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COZE_SUPABASE_ANON_KEY = 'secret-anon-key'
  try {
    const store = createWorkspaceStore({ projects: [] }, { filePath: '/tmp/workspace.local.json' })
    const routes = workspaceRoutes(store)
    const result = await routes['GET /api/workspace/storage-status']({})

    assert.equal(result.ok, true)
    assert.equal(result.database.available, true)
    assert.equal(result.database.env.COZE_SUPABASE_URL, true)
    assert.equal(result.database.env.COZE_SUPABASE_ANON_KEY, true)
    assert.equal(result.database.supabaseHost, 'example.supabase.co')
    assert.equal(result.file.enabled, true)
    assert.equal(result.file.path, '/tmp/workspace.local.json')
    assert.equal(JSON.stringify(result).includes('secret-anon-key'), false)
  } finally {
    if (previousUrl === undefined) delete process.env.COZE_SUPABASE_URL
    else process.env.COZE_SUPABASE_URL = previousUrl
    if (previousAnonKey === undefined) delete process.env.COZE_SUPABASE_ANON_KEY
    else process.env.COZE_SUPABASE_ANON_KEY = previousAnonKey
  }
})

test('workspace model settings do not keep codex exec surface after switching to openai-compatible', async () => {
  const store = createWorkspaceStore({ settings: [] })
  await saveModelSettings(store, {
    provider: 'codex-cli',
    apiSurface: 'codex.exec',
    defaultModel: 'gpt-5.5',
    enabled: true
  })

  const view = await saveModelSettings(store, {
    provider: 'openai-compatible',
    apiKey: 'sk-test',
    baseUrl: 'https://ai.example.com',
    defaultModel: 'gpt-5.5',
    apiSurface: '',
    timeoutMs: 600000,
    enabled: true
  })

  assert.equal(view.provider, 'openai-compatible')
  assert.equal(view.apiSurface, 'responses')
  assert.equal(modelSettingsView(store).apiSurface, 'responses')
})

test('workspace store preserves advanced UX markdown artifacts beyond the generic string limit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'workflow-store-'))
  const filePath = join(directory, 'workspace.json')
  const longAdvancedMarkdown = `# 高级 UX\n\n${'原始需求分析。'.repeat(22000)}`
  const longPageInteractionMarkdown = `# 页面交互框架与说明\n\n${'页面框架表格、交互规则表格、异常状态表格。'.repeat(12000)}`
  const store = createWorkspaceStore({ workflowRuns: [] }, { filePath })
  try {
    await upsertWorkflowRun(store, {
      id: 'advanced-ux-long-markdown-run',
      workflowId: 'advanced-ux-requirement-analysis',
      workflowName: '高级 UX 需求分析',
      assetType: '高级 UX 需求分析',
      input: '做一个快速把PPT转视频的web工具',
      status: 'analyzed',
      documentAnalysis: {
        status: 'analyzed',
        advancedUxReport: {
          status: 'imported',
          fileName: '高级UX需求分析.md',
          markdown: longAdvancedMarkdown,
          pageInteractionDocument: {
            status: 'generated',
            fileName: 'PPT快速转视频Web工具-页面交互框架与说明.md',
            markdown: longPageInteractionMarkdown
          }
        },
        totalDesignFlow: {
          advancedUxReport: {
            status: 'imported',
            fileName: '高级UX需求分析.md',
            markdown: longAdvancedMarkdown,
            pageInteractionDocument: {
              status: 'generated',
              fileName: 'PPT快速转视频Web工具-页面交互框架与说明.md',
              markdown: longPageInteractionMarkdown
            }
          },
          pageInteractionDocumentArtifact: {
            status: 'generated',
            fileName: 'PPT快速转视频Web工具-页面交互框架与说明.md',
            markdown: longPageInteractionMarkdown
          },
          stageCanvases: {}
        }
      },
      agentSessions: {
        'requirement-dissection': [
          {
            id: 'advanced-ux-long-markdown-run-advanced-ux-markdown-report',
            role: 'assistant',
            content: '高级 UX Markdown 文件已生成',
            meta: {
              action: 'advanced-ux-markdown-report',
              fileName: '高级UX需求分析.md',
              markdown: longAdvancedMarkdown,
              pageInteractionDocument: {
                fileName: 'PPT快速转视频Web工具-页面交互框架与说明.md',
                markdown: longPageInteractionMarkdown
              }
            }
          }
        ]
      }
    })
    const persisted = JSON.parse(await readFile(filePath, 'utf8'))
    const run = persisted.workflowRuns.find((item) => item.id === 'advanced-ux-long-markdown-run')

    assert.equal(run.documentAnalysis.advancedUxReport.markdown, longAdvancedMarkdown)
    assert.equal(run.documentAnalysis.advancedUxReport.pageInteractionDocument.markdown, longPageInteractionMarkdown)
    assert.equal(run.documentAnalysis.totalDesignFlow.pageInteractionDocumentArtifact.markdown, longPageInteractionMarkdown)
    assert.equal(run.agentSessions['requirement-dissection'][0].meta.markdown, longAdvancedMarkdown)
    assert.equal(run.agentSessions['requirement-dissection'][0].meta.pageInteractionDocument.markdown, longPageInteractionMarkdown)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('workspace store allows failed advanced UX runs to be overwritten by a fresh generating retry', async () => {
  const store = createWorkspaceStore({ workflowRuns: [] })
  await upsertWorkflowRun(store, {
    id: 'advanced-ux-retry-run',
    workflowId: 'advanced-ux-requirement-analysis',
    workflowName: '高级 UX 需求分析',
    assetType: '高级 UX 需求分析',
    input: '做一个AI生成视频拥有爆款复刻功能的web工具',
    status: 'analyzed',
    documentAnalysis: {
      status: 'failed',
      advancedUxReport: {
        status: 'failed',
        fileName: '高级UX需求分析-旧.md',
        markdown: '',
        importError: 'Codex CLI 调用被中断：SIGTERM'
      },
      canvas: { nodes: [] }
    }
  })

  await upsertWorkflowRun(store, {
    id: 'advanced-ux-retry-run',
    workflowId: 'advanced-ux-requirement-analysis',
    workflowName: '高级 UX 需求分析',
    assetType: '高级 UX 需求分析',
    input: '做一个AI生成视频拥有爆款复刻功能的web工具',
    status: 'analyzing',
    documentAnalysis: {
      status: 'streaming',
      advancedUxReport: {
        status: 'generating',
        fileName: '高级UX需求分析-新.md',
        markdown: '',
        sections: []
      },
      canvas: { nodes: [{ id: 'ux-requirement-understanding', artifactStatus: 'generating' }] }
    }
  })

  assert.equal(store.workflowRuns[0].status, 'analyzed')
  assert.equal(store.workflowRuns[0].documentAnalysis.status, 'streaming')
  assert.equal(store.workflowRuns[0].documentAnalysis.advancedUxReport.status, 'generating')
  assert.equal(store.workflowRuns[0].documentAnalysis.advancedUxReport.fileName, '高级UX需求分析-新.md')
})

test('workspace route hydrates legacy total-flow run details with stage canvases', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-legacy-total-flow',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    input: '做一个茶饮点单小程序',
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个茶饮点单小程序',
      canvas: {
        nodes: [{
          id: 'home-shop',
          title: '首页与选店',
          summary: '选择门店后进入点单。',
          detailSections: [
            { title: '页面目标', items: ['让用户选择附近门店'] },
            { title: '用户点击动作', items: ['点击门店卡片进入菜单'] }
          ]
        }],
        edges: [],
        orderedTabs: [{ key: 'home-shop', label: '首页与选店' }]
      }
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-legacy-total-flow' })
  const totalFlow = result.run.documentAnalysis.totalDesignFlow

  assert.ok(totalFlow)
  assert.deepEqual(totalFlow.stages.map((stage) => stage.id), [
    'requirement-dissection',
    'interaction-lofi',
    'ui-visual',
    'html-output',
    'vue-output',
    'acceptance-deposit'
  ])
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.length > 0)
  assert.ok(totalFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.detailLayout === 'interaction-page-split'))
  assert.equal(totalFlow.stageCanvases['interaction-lofi'].nodes[0].title, '首页与选店')
  const contract = totalFlow.stageCanvases['interaction-lofi'].nodes[0].pageLayoutArtifact?.screenContract
  assert.ok(contract, 'interaction lofi page artifact should include a screen contract')
  assert.ok(contract.screenPurpose?.primaryJob, 'screen contract should describe the page task')
  assert.ok(Array.isArray(contract.designInvariants?.mustSee), 'screen contract should include must-see information')
  assert.ok(Array.isArray(contract.freedomBudget?.imageModelCanChange), 'screen contract should expose image model freedom')
  assert.ok(Array.isArray(contract.evaluationRubric?.fail), 'screen contract should include failure checks')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes[0].title, '首页与选店')
})

test('workspace route rehydrates legacy total-flow interaction nodes without page layout artifacts', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const legacyTotalFlow = {
    ...totalFlow,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'interaction-lofi': {
        ...totalFlow.stageCanvases['interaction-lofi'],
        nodes: totalFlow.stageCanvases['interaction-lofi'].nodes.map((node) => {
          const { pageLayoutArtifact, ...rest } = node
          return rest
        })
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-legacy-wireframe-hydration',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-legacy-wireframe-hydration' })
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes

  assert.ok(nodes.every((node) => node.pageLayoutArtifact?.asciiWireframe))
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.pageLayoutArtifact?.asciiWireframe))
})

test('workspace route rehydrates legacy total-flow interaction nodes without slice ids', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const legacyTotalFlow = {
    ...totalFlow,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'interaction-lofi': {
        ...totalFlow.stageCanvases['interaction-lofi'],
        nodes: totalFlow.stageCanvases['interaction-lofi'].nodes.map((node) => {
          const { sliceId, ...rest } = node
          return rest
        })
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-legacy-slice-hydration',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-legacy-slice-hydration' })
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes

  assert.ok(nodes.every((node) => node.sliceId))
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes.every((node) => node.sliceId))
})

test('workspace route keeps advanced UX markdown generation alive while backend may still be running', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const run = createWorkspaceWorkflowRun({
    id: 'run-stale-advanced-ux',
    projectId: 'project-shoes',
    title: '卖鞋小程序',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    input: '我要做一个卖鞋子的小程序',
    status: 'analyzing',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    documentAnalysis: {
      ...analysis,
      status: 'streaming',
      totalDesignFlow: buildTotalDesignFlow(analysis)
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-shoes', name: '鞋履项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-stale-advanced-ux' })
  const totalFlow = result.run.documentAnalysis.totalDesignFlow
  const nodes = totalFlow.stageCanvases['requirement-dissection'].nodes

  assert.equal(result.run.status, 'analyzing')
  assert.equal(result.run.documentAnalysis.status, 'streaming')
  assert.equal(totalFlow.advancedUxReport.status, 'generating')
  assert.ok(nodes.every((node) => node.artifactStatus === 'generating'))
  assert.ok(nodes.every((node) => node.summary.includes('高级 UX 分析')))
  assert.equal(store.workflowRuns[0].status, 'analyzing')
})

test('workspace route hydrates historical failed advanced UX runs into ten failed canvas nodes', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const failureReason = '高级 UX Markdown 未符合输出规范：缺少六顶思考帽评审'
  const run = createWorkspaceWorkflowRun({
    id: 'run-historical-failed-advanced-ux',
    projectId: 'project-shoes',
    title: '卖鞋小程序',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    input: '我要做一个卖鞋子的小程序',
    status: 'failed',
    documentAnalysis: {
      ...analysis,
      status: 'failed',
      advancedUxReport: {
        status: 'failed',
        fileName: '高级UX需求分析-20260710-1200.md',
        markdown: '',
        importError: failureReason
      },
      canvas: {
        nodes: [{
          id: 'advanced-ux-markdown-report',
          title: '高级 UX Markdown 生成失败',
          summary: failureReason,
          artifactStatus: 'failed'
        }]
      }
    },
    agentSessions: {
      'requirement-dissection': [{
        id: 'failed-report',
        role: 'assistant',
        content: failureReason,
        meta: {
          action: 'advanced-ux-markdown-report',
          reportStatus: 'failed',
          markdown: '',
          importError: failureReason
        }
      }]
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-shoes', name: '鞋履项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-historical-failed-advanced-ux' })
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['requirement-dissection'].nodes

  assert.equal(result.run.documentAnalysis.totalDesignFlow.advancedUxReport.status, 'failed')
  assert.equal(result.run.documentAnalysis.totalDesignFlow.advancedUxReport.importError, failureReason)
  assert.equal(nodes.length, 10)
  assert.ok(nodes.every((node) => node.artifactStatus === 'failed'))
  assert.ok(nodes.every((node) => node.summary === '未生成可导入内容'))
  assert.ok(nodes.every((node) => node.detailSections?.some((section) =>
    section.title === '失败原因' && section.items?.includes(failureReason)
  )))
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['requirement-dissection'].nodes.length, 10)
})

test('workspace route sanitizes internal runtime warnings in historical advanced UX failures', async () => {
  const dirtyReason = [
    'WARN codex_core_plugins: failed to load plugin catalog',
    '401 Unauthorized',
    'find_thread_path_by_id_str failed under .codex/.tmp/plugins'
  ].join('\n')
  const run = createWorkspaceWorkflowRun({
    id: 'run-dirty-failed-advanced-ux',
    projectId: 'project-shoes',
    title: '卖鞋小程序',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    input: '我要做一个卖鞋子的小程序',
    status: 'failed',
    documentAnalysis: {
      status: 'failed',
      advancedUxReport: {
        status: 'failed',
        fileName: '高级UX需求分析-20260710-1200.md',
        markdown: '',
        importError: dirtyReason
      },
      totalDesignFlow: {
        mode: 'total-design-flow',
        type: 'total-design-flow',
        advancedUxReport: {
          status: 'failed',
          fileName: '高级UX需求分析-20260710-1200.md',
          markdown: '',
          importError: dirtyReason
        },
        requirementDissectionArtifact: {
          pageCoverageMatrix: [{ pageName: '历史污染页', participationReason: dirtyReason }]
        },
        pages: [{ id: 'dirty-page', title: '历史污染页', summary: dirtyReason }],
        stagePages: {
          'interaction-lofi': [{ id: 'dirty-page', title: '历史污染页', summary: dirtyReason }]
        },
        stageCanvases: {
          'requirement-dissection': {
            nodes: [
              'ux-original-requirement-analysis',
              'ux-design-problem-definition',
              'ux-user-scenario',
              'ux-interaction-chain',
              'ux-three-design-solutions',
              'ux-exception-flow',
              'ux-recommendation-decision'
            ].map((id) => ({
              id,
              requirementPipelineTabId: id,
              title: id,
              summary: '未生成可导入内容',
              artifactStatus: 'failed',
              detailSections: [{ title: '失败原因', items: [dirtyReason] }]
            }))
          },
          'interaction-lofi': {
            nodes: [{
              id: 'dirty-page',
              title: '历史污染页',
              summary: dirtyReason,
              detailSections: [{ title: '页面目标', items: [dirtyReason] }]
            }]
          }
        }
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          id: 'entry',
          role: 'user',
          content: '我要做一个卖鞋子的小程序',
          meta: { action: 'workflow-entry-input' }
        },
        {
          id: 'dirty-plain-failure',
          role: 'assistant',
          content: dirtyReason,
          meta: { action: 'workflow-analysis-result', status: 'success' }
        },
        {
          id: 'failed-report',
          role: 'assistant',
          content: `未生成可导入的高级 UX Markdown 文件：高级UX需求分析-20260710-1200.md\n\n门禁原因：${dirtyReason}`,
          meta: {
            action: 'advanced-ux-markdown-report',
            status: 'failed',
            reportStatus: 'failed',
            importError: dirtyReason,
            markdown: ''
          }
        }
      ]
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-shoes', name: '鞋履项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-dirty-failed-advanced-ux' })
  const report = result.run.documentAnalysis.totalDesignFlow.advancedUxReport
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['requirement-dissection'].nodes
  const sessions = result.run.agentSessions['requirement-dissection']
  const serialized = JSON.stringify(result.run.documentAnalysis.totalDesignFlow)

  assert.equal(report.importError, '模型调用未生成可导入的高级 UX Markdown。请重新生成。')
  assert.equal(result.run.documentAnalysis.advancedUxReport.importError, report.importError)
  assert.equal(nodes.length, 10)
  assert.ok(nodes.every((node) => node.detailSections?.some((section) =>
    section.title === '失败原因' && section.items?.includes(report.importError)
  )))
  assert.equal(result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'], undefined)
  assert.equal(result.run.documentAnalysis.totalDesignFlow.pages, undefined)
  assert.ok(sessions.every((message) => message.id !== 'dirty-plain-failure'))
  assert.equal(sessions.find((message) => message.id === 'failed-report')?.meta?.importError, report.importError)
  assert.doesNotMatch(serialized, /codex_core_plugins|plugin catalog|401 Unauthorized|find_thread_path_by_id_str|\.codex\/\.tmp\/plugins/)
  assert.doesNotMatch(JSON.stringify(result.run.agentSessions), /codex_core_plugins|plugin catalog|401 Unauthorized|find_thread_path_by_id_str|\.codex\/\.tmp\/plugins/)
})

test('workspace route suppresses advanced UX interaction fallback nodes until page document is generated', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我要做一个卖鞋子的小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const run = createWorkspaceWorkflowRun({
    id: 'run-advanced-ux-pending-page-doc',
    projectId: 'project-shoes',
    title: '卖鞋小程序',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    input: '我要做一个卖鞋子的小程序',
    status: 'analyzed',
    documentAnalysis: {
      ...analysis,
      status: 'analyzed',
      advancedUxReport: {
        status: 'imported',
        fileName: '高级UX需求分析-20260710-1200.md',
        markdown: '# 高级 UX 需求分析\n\n## 需求理解\n\n已生成。',
        sections: []
      },
      totalDesignFlow: {
        ...totalFlow,
        currentStage: 'interaction-lofi',
        advancedUxReport: {
          status: 'imported',
          fileName: '高级UX需求分析-20260710-1200.md',
          markdown: '# 高级 UX 需求分析\n\n## 需求理解\n\n已生成。',
          sections: []
        },
        stageStatuses: {
          ...(totalFlow.stageStatuses || {}),
          'interaction-lofi': { status: 'generating', pendingSummary: true }
        },
        stageCanvases: {
          ...(totalFlow.stageCanvases || {}),
          'interaction-lofi': {
            title: '交互低保',
            nodes: [{
              id: 'legacy-doc-analysis',
              stageId: 'interaction-lofi',
              title: '文档分析结果',
              summary: '旧总流程兜底节点',
              contentStatus: 'model-pending',
              contentSource: 'model-pending',
              pageLayoutArtifact: { rawText: '旧总流程兜底内容' }
            }],
            edges: [],
            orderedTabs: [{ key: 'legacy-doc-analysis', label: '文档分析结果' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-shoes', name: '鞋履项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-advanced-ux-pending-page-doc' })
  const totalFlowResult = result.run.documentAnalysis.totalDesignFlow
  const canvas = totalFlowResult.stageCanvases['interaction-lofi']

  assert.equal(canvas.canvasType, 'advanced-ux-stage-generating')
  assert.equal(canvas.nodes.length, 1)
  assert.equal(canvas.nodes[0].artifactStatus, 'generating')
  assert.match(canvas.nodes[0].summary, /页面交互框架与说明 Markdown/)
  assert.notEqual(canvas.nodes[0].title, '文档分析结果')
  assert.equal(totalFlowResult.stageRuntime['interaction-lofi'].state, 'generating')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].canvasType, 'advanced-ux-stage-generating')
})

test('workspace route imports existing advanced UX page interaction markdown into interaction lofi canvas', async () => {
  const pageInteractionMarkdown = [
    '# 线索跟进Web工具-页面交互框架与说明',
    '',
    '## 1. 文档概述',
    '| 核心假设 | 依据 | 风险 | 验证方式 | 置信度 |',
    '|---|---|---|---|---|',
    '| 销售需要从线索池进入跟进 | 用户需求 | 入口不清晰 | 原型评审 | 中 |',
    '',
    '## 2. 页面总览',
    '| 编号 | 页面名称 | 类型 | 所属模块 | 入口来源 | 核心职责 | 对应步骤 | 角色权限 | 数据来源 | 权限规则 | 路由路径 | analyzed |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    '| P01 | 线索列表页 | 核心页面 | 线索管理 | 首页导航 | 浏览与筛选线索 | S1-S2 | 销售/主管 | 线索接口 | 仅看授权线索 | /leads | true |',
    '',
    '## 3. 页面流转总览',
    '| 源页面 | 源页面名称 | 目标页面 | 目标页面名称 | 触发操作 | 前置条件 | 流转类型 | 触发角色 | 跳转方式 | 备注 |',
    '|---|---|---|---|---|---|---|---|---|---|',
    '| P01 | 线索列表页 | P01 | 线索列表页 | 点击筛选 | 已登录 | 主流程 | 销售 | 页内刷新 | 更新列表 |',
    '| P01 | 线索列表页 | P01 | 线索列表页 | 接口失败重试 | 网络异常 | 异常流 | 销售 | 留在当前页 | 保留筛选条件 |',
    '',
    '```text',
    'P01 线索列表页',
    '├─ 点击筛选 -> P01 列表刷新',
    '└─ 接口失败 -> P01 错误态 -> 重试',
    '```',
    '',
    '## 8. 逐页交互说明',
    '### P01 线索列表页',
    '#### 页面定位',
    '销售查看、筛选并进入线索跟进。',
    '',
    '#### 页面框架表格',
    '| 区域编号 | 区域名称 | 区域类型 | 位置 | 布局 | 内容摘要 | 关键元素 | 交互 | 响应式 | 优先级 | 状态变体 | 状态说明 | 组件引用 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    '| A1 | 顶部筛选区 | filter | 顶部固定 | 横向 | 关键词和状态筛选 | 搜索框、状态下拉 | 输入/选择后筛选 | 移动端折叠 | P0 | 默认/加载 | 固定不随列表滚动 | FilterBar |',
    '| A2 | 线索列表区 | list | 主体滚动 | 列表 | 展示线索卡片 | 卡片、跟进按钮 | 点击进入跟进 | 移动端单列 | P0 | 加载/空/错误 | 主体可滚动 | LeadList |',
    '',
    '#### 文本布局图',
    '```text',
    '┌────────────────────┐',
    '│ A1 顶部筛选区       │',
    '├────────────────────┤',
    '│ A2 线索列表区       │',
    '│  线索卡片 / 跟进按钮 │',
    '└────────────────────┘',
    '```',
    '',
    '#### 交互规则表格',
    '| 编号 | 用户操作 | 系统反馈 | 关联状态/弹窗 | 备注 |',
    '|---|---|---|---|---|',
    '| IR1 | 输入关键词 | 列表按关键词刷新 | ST2 | 防抖请求 |',
    '| IR2 | 选择状态 | 列表按状态过滤 | ST2 | 保留关键词 |',
    '| IR3 | 点击跟进 | 打开跟进详情 | P02 | 权限不足时提示 |',
    '| IR4 | 下拉刷新 | 重新拉取线索 | ST1 | 展示刷新状态 |',
    '| IR5 | 点击重试 | 重新请求列表 | ST3 | 错误态可见 |',
    '',
    '#### 异常状态表格',
    '| 编号 | 状态 | 表现 | 处理方式 |',
    '|---|---|---|---|',
    '| E1 | 加载中 | 骨架屏 | 等待接口返回 |',
    '| E2 | 空状态 | 展示无结果 | 提供重置筛选 |',
    '| E3 | 错误态 | 错误提示 | 提供重试 |',
    '| E4 | 无权限 | 权限提示 | 联系管理员 |',
    '| E5 | 业务异常 | 线索被回收 | 刷新列表 |',
    '',
    '## 10. 交互规则表（自有产品）',
    '| 规则编号 | 页面编号 | 区域编号 | 触发元素 | 触发动作 | 前置条件 | 交互行为 | 成功反馈 | 失败反馈 | 边界情况 | 关联接口 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    '| IR001 | P01 | A1 | 搜索框 | 输入 | 已登录 | 防抖查询线索 | 列表刷新 | 展示错误态 | 空输入恢复全量 | GET /leads |',
    '| IR002 | P01 | A2 | 跟进按钮 | 点击 | 有权限 | 打开跟进详情 | 进入详情 | 权限不足提示 | 线索已回收时刷新 | GET /leads/:id |'
  ].join('\n')
  const run = createWorkspaceWorkflowRun({
    id: 'run-advanced-ux-existing-page-doc-import',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    status: 'analyzed',
    input: '做一个给企业销售团队使用的线索跟进 Web 工具',
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个给企业销售团队使用的线索跟进 Web 工具',
      advancedUxReport: {
        status: 'imported',
        fileName: '高级UX需求分析.md',
        markdown: '# 高级 UX 需求分析\n\n## 原始需求分析\n已生成。',
        pageInteractionDocument: {
          status: 'generated',
          artifactType: 'page-interaction-markdown',
          fileName: '线索跟进Web工具-页面交互框架与说明.md',
          markdown: pageInteractionMarkdown
        }
      },
      totalDesignFlow: {
        currentStage: 'interaction-lofi',
        stages: [
          { id: 'requirement-dissection', name: '需求分析' },
          { id: 'interaction-lofi', name: '交互低保' }
        ],
        advancedUxReport: {
          status: 'imported',
          fileName: '高级UX需求分析.md',
          markdown: '# 高级 UX 需求分析\n\n## 原始需求分析\n已生成。',
          pageInteractionDocument: {
            status: 'generated',
            artifactType: 'page-interaction-markdown',
            fileName: '线索跟进Web工具-页面交互框架与说明.md',
            markdown: pageInteractionMarkdown
          }
        },
        stageCanvases: {
          'interaction-lofi': {
            title: '交互低保',
            nodes: [{
              id: 'legacy-doc-analysis',
              stageId: 'interaction-lofi',
              title: '文档分析结果',
              summary: '旧占位',
              contentStatus: 'model-pending',
              contentSource: 'model-pending'
            }],
            edges: [],
            orderedTabs: [{ key: 'legacy-doc-analysis', label: '文档分析结果' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({ workflowRuns: [run], projects: [], materials: [] })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: run.id })
  const canvas = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi']
  const node = canvas.nodes[0]

  assert.equal(canvas.canvasType, 'interaction-lofi-page-canvas')
  assert.equal(node.title, '线索列表页')
  assert.equal(node.pageLayoutArtifact.pageMeta.correspondingSteps, 'S1-S2')
  assert.equal(node.pageLayoutArtifact.pageMeta.analyzed, true)
  assert.equal(node.pageLayoutArtifact.pageMeta.roleAccess, '销售/主管')
  assert.match(node.pageLayoutArtifact.asciiWireframe, /A1 顶部筛选区/)
  assert.ok(node.pageLayoutArtifact.layout.regions.some((region) => region['区域'] === 'A1 顶部筛选区'))
  assert.ok(node.pageLayoutArtifact.layout.regions.some((region) => region.stateDescription === '固定不随列表滚动' && region.componentReference === 'FilterBar'))
  assert.ok(node.interactionSpecArtifact.interactionRows.some((row) => row.id === 'IR1' && row.target === '输入关键词' && row.relatedStateOrModal === 'ST2'))
  assert.ok(node.interactionSpecArtifact.stateMatrix.some((state) => state.id === 'E1' && state.state === '加载中'))
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].canvasType, 'interaction-lofi-page-canvas')
})

test('workspace route preserves advanced UX failed interaction canvas when page document gate fails', async () => {
  const failureMessage = '页面交互文档未符合输出规范：推荐决策卡片缺少字段：推荐方案'
  const analysis = analyzeRequirementDocuments({
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个AI生成视频拥有爆款复刻功能的web工具',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const staleGeneratingCanvas = {
    title: '交互低保',
    summary: '正在生成页面交互框架与说明 Markdown',
    canvasType: 'advanced-ux-stage-generating',
    layoutRule: 'single-loading',
    nodes: [{
      id: 'advanced-ux-interaction-lofi-generating',
      stageId: 'interaction-lofi',
      title: '交互低保',
      summary: '正在生成页面交互框架与说明 Markdown',
      loading: true,
      artifactStatus: 'generating'
    }],
    edges: [],
    orderedTabs: [{ key: 'advanced-ux-interaction-lofi-generating', label: '交互低保' }]
  }
  const failedDocument = {
    status: 'failed',
    artifactType: 'page-interaction-markdown',
    fileName: 'AI视频爆款复刻-页面交互框架与说明.md',
    markdown: '',
    importError: failureMessage
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-advanced-ux-failed-page-doc',
    projectId: 'project-video',
    title: 'AI 视频爆款复刻',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    input: '做一个AI生成视频拥有爆款复刻功能的web工具',
    status: 'analyzed',
    documentAnalysis: {
      ...analysis,
      status: 'analyzed',
      advancedUxReport: {
        status: 'imported',
        fileName: '高级UX需求分析.md',
        markdown: '# 高级 UX 需求分析\n\n## 原始需求分析\n\n已生成。',
        pageInteractionDocument: failedDocument
      },
      totalDesignFlow: {
        ...totalFlow,
        currentStage: 'interaction-lofi',
        advancedUxReport: {
          status: 'imported',
          fileName: '高级UX需求分析.md',
          markdown: '# 高级 UX 需求分析\n\n## 原始需求分析\n\n已生成。',
          pageInteractionDocument: failedDocument
        },
        pageInteractionDocumentArtifact: failedDocument,
        stageStatuses: {
          ...(totalFlow.stageStatuses || {}),
          'interaction-lofi': { status: 'failed', pendingSummary: true }
        },
        stageCanvases: {
          ...(totalFlow.stageCanvases || {}),
          'interaction-lofi': staleGeneratingCanvas
        }
      }
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-video', name: 'AI 视频项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-advanced-ux-failed-page-doc' })
  const totalFlowResult = result.run.documentAnalysis.totalDesignFlow
  const canvas = totalFlowResult.stageCanvases['interaction-lofi']

  assert.equal(canvas.canvasType, 'advanced-ux-stage-failed')
  assert.equal(canvas.nodes[0].artifactStatus, 'failed')
  assert.equal(canvas.nodes[0].loading, false)
  assert.match(canvas.nodes[0].failureReason, /推荐决策卡片/)
  assert.equal(totalFlowResult.advancedUxReport.pageInteractionDocument.status, 'failed')
  assert.equal(totalFlowResult.stageRuntime['interaction-lofi'].state, 'failed')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].canvasType, 'advanced-ux-stage-failed')
})

test('workspace route rehydrates failed advanced UX UI visual placeholder from interaction pages', async () => {
  const stages = [
    { id: 'requirement-dissection', name: '需求分析' },
    { id: 'interaction-lofi', name: '交互低保' },
    { id: 'ui-visual', name: 'UI视觉' }
  ]
  const run = createWorkspaceWorkflowRun({
    id: 'run-advanced-ux-failed-ui-visual',
    projectId: 'project-video',
    title: 'AI 视频爆款复刻',
    workflowId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    input: '做一个AI生成视频拥有爆款复刻功能的web工具',
    status: 'analyzed',
    documentAnalysis: {
      status: 'analyzed',
      input: '做一个AI生成视频拥有爆款复刻功能的web工具',
      advancedUxReport: {
        status: 'imported',
        fileName: '高级UX需求分析.md',
        markdown: '# 高级 UX 需求分析',
        pageInteractionDocument: {
          status: 'generated',
          fileName: 'AI视频爆款复刻Web工具-页面交互框架与说明.md',
          markdown: '# 页面交互框架与说明'
        }
      },
      totalDesignFlow: {
        currentStage: 'ui-visual',
        contentStatus: 'waiting-model',
        contentStatusLabel: '模型增强中',
        stages,
        advancedUxReport: {
          status: 'imported',
          fileName: '高级UX需求分析.md',
          markdown: '# 高级 UX 需求分析',
          pageInteractionDocument: {
            status: 'generated',
            fileName: 'AI视频爆款复刻Web工具-页面交互框架与说明.md',
            markdown: '# 页面交互框架与说明'
          }
        },
        stageStatuses: {
          'requirement-dissection': { status: 'completed' },
          'interaction-lofi': { status: 'completed' },
          'ui-visual': { status: 'failed' }
        },
        stageConfirmations: {
          'requirement-dissection': { stageId: 'requirement-dissection', nextStageId: 'interaction-lofi' },
          'interaction-lofi': { stageId: 'interaction-lofi', nextStageId: 'ui-visual' }
        },
        stageCanvases: {
          'interaction-lofi': {
            nodes: [{
              id: 'advanced-ux-page-p01',
              stageId: 'interaction-lofi',
              title: '复刻首页',
              artifactStatus: 'generated',
              pageLayoutArtifact: {
                asciiWireframe: 'A1 顶部导航区 | A2 导入主操作区',
                version: 'advanced-ux-page-interaction/v1'
              },
              interactionSpecArtifact: {
                version: 'advanced-ux-page-interaction/v1',
                interactionRows: [{ target: '点击开始解析' }]
              }
            }, {
              id: 'advanced-ux-page-p02',
              stageId: 'interaction-lofi',
              title: '任务进度页',
              artifactStatus: 'generated',
              pageLayoutArtifact: {
                asciiWireframe: 'A1 顶部状态区 | A2 任务进度条',
                version: 'advanced-ux-page-interaction/v1'
              },
              interactionSpecArtifact: {
                version: 'advanced-ux-page-interaction/v1',
                interactionRows: [{ target: '查看任务详情' }]
              }
            }],
            edges: [],
            orderedTabs: []
          },
          'ui-visual': {
            title: 'UI视觉',
            summary: 'UI视觉生成失败',
            canvasType: 'advanced-ux-stage-failed',
            layoutRule: 'single-failed',
            status: 'failed',
            nodes: [{
              id: 'advanced-ux-ui-visual-failed',
              stageId: 'ui-visual',
              title: 'UI视觉',
              summary: 'UI视觉生成失败',
              loading: false,
              artifactStatus: 'failed',
              status: 'failed'
            }],
            edges: [],
            orderedTabs: [{ key: 'advanced-ux-ui-visual-failed', label: 'UI视觉' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-video', name: 'AI 视频项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-advanced-ux-failed-ui-visual' })
  const totalFlow = result.run.documentAnalysis.totalDesignFlow
  const canvas = totalFlow.stageCanvases['ui-visual']

  assert.equal(totalFlow.stageRuntime['ui-visual'].state, 'available')
  assert.notEqual(totalFlow.contentStatus, 'failed')
  assert.equal(canvas.canvasType, 'ui-visual-page-canvas')
  assert.equal(canvas.status, 'pending')
  assert.equal(canvas.nodes.length, 2)
  assert.deepEqual(canvas.nodes.map((node) => node.title), ['复刻首页 UI视觉', '任务进度页 UI视觉'])
  assert.deepEqual(canvas.orderedTabs.map((tab) => tab.label), ['复刻首页 UI视觉', '任务进度页 UI视觉'])
  assert.ok(canvas.nodes.every((node) => node.artifactStatus !== 'failed'))
  assert.ok(canvas.nodes.every((node) => node.visualPreview?.sourceStageId === undefined || node.sourceStageId === 'interaction-lofi'))
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes.length, 2)
})

test('workspace route normalizes failed UI visual image artifacts that were persisted as generated', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-ui-visual-failed-image-generated-shell',
    workflowId: 'total-design-flow',
    workflowName: '高级 UX 需求分析',
    assetType: '高级 UX 需求分析',
    status: 'analyzed',
    documentAnalysis: {
      status: 'analyzed',
      totalDesignFlow: {
        mode: 'total-design-flow',
        type: 'total-design-flow',
        skillId: 'total-design-flow',
        currentStage: 'ui-visual',
        stages: [
          { id: 'requirement-dissection', name: '需求分析' },
          { id: 'interaction-lofi', name: '交互低保' },
          { id: 'ui-visual', name: 'UI视觉' }
        ],
        stageStatuses: {
          'requirement-dissection': { status: 'completed' },
          'interaction-lofi': { status: 'completed' },
          'ui-visual': { status: 'completed' }
        },
        stageConfirmations: {
          'requirement-dissection': { stageId: 'requirement-dissection', nextStageId: 'interaction-lofi' },
          'interaction-lofi': { stageId: 'interaction-lofi', nextStageId: 'ui-visual' }
        },
        stageCanvases: {
          'interaction-lofi': {
            canvasType: 'interaction-lofi-page-canvas',
            nodes: [{
              id: 'advanced-ux-page-p01',
              stageId: 'interaction-lofi',
              title: '复刻首页',
              artifactStatus: 'generated',
              pageLayoutArtifact: {
                version: 'advanced-ux-page-interaction/v1',
                asciiWireframe: 'A1 顶部导航区 | A2 导入主操作区'
              },
              interactionSpecArtifact: {
                version: 'advanced-ux-page-interaction/v1',
                interactionRows: [{ target: '点击开始解析' }]
              }
            }],
            edges: [],
            orderedTabs: [{ key: 'advanced-ux-page-p01', label: '复刻首页' }]
          },
          'ui-visual': {
            canvasType: 'ui-visual-page-canvas',
            nodes: [{
              id: 'ui-failed-p1',
              stageId: 'ui-visual',
              sourceNodeId: 'advanced-ux-page-p01',
              sourcePageId: 'advanced-ux-page-p01',
              title: '复刻首页 UI视觉',
              artifactStatus: 'generated',
              targetGenerator: 'gpt-image-2',
              generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2', status: 'generated' }],
              visualPreview: {
                imageStatus: 'failed',
                configurationMessage: 'unable to get local issuer certificate'
              },
              artifact: {
                kind: 'visual',
                imageStatus: 'failed',
                configurationMessage: 'unable to get local issuer certificate'
              },
              contentStatusLabel: '已生成'
            }],
            edges: [],
            orderedTabs: [{ key: 'ui-failed-p1', label: '复刻首页 UI视觉' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({ workflowRuns: [run] })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-ui-visual-failed-image-generated-shell' })
  const node = result.run.documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]

  assert.equal(node.artifactStatus, 'failed')
  assert.equal(node.generationActions[0].status, 'failed')
  assert.equal(node.contentStatusLabel, '生成失败')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0].artifactStatus, 'failed')
})

test('workspace route preserves empty project id for non-project workflow runs', async () => {
  const modelRun = createWorkspaceWorkflowRun({
    id: 'run-non-project-model',
    demandScope: 'non-project',
    projectId: '',
    originProjectId: 'project-tea'
  })
  assert.equal(modelRun.projectId, '')
  assert.equal(modelRun.originProjectId, 'project-tea')

  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['POST /api/workspace/workflow-runs']({
    id: 'run-non-project-pre-research',
    title: '登录体验预研',
    workflowId: 'total-design-flow',
    demandScope: 'non-project',
    projectId: '',
    originProjectId: 'project-tea',
    documentAnalysis: {
      status: 'analyzed',
      input: '分析登录体验问题',
      canvas: {
        nodes: [{ id: 'analysis', title: '分析结果', content: ['非项目预研'] }],
        edges: [],
        orderedTabs: [{ key: 'analysis', label: '分析结果' }]
      }
    }
  })

  assert.equal(result.run.demandScope, 'non-project')
  assert.equal(result.run.projectId, '')
  assert.equal(result.run.originProjectId, 'project-tea')
  assert.equal(store.workflowRuns[0].projectId, '')
})

test('workspace route rehydrates legacy rule-only prompt slices into homepage interaction details', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加几个快捷输入提示词的功能，并且需要提示词配置与降级。',
    documents: [{
      name: '框选功能：首页 PodcastStep1',
      sourceType: 'selected-knowledge-scope',
      content: [
        'Video Podcast 首页使用左侧 AppNavRail。',
        'PodcastStep1 内有 Generate Script / Upload Script / Upload Audio tabs。',
        'Topic/input composer placeholder 是 Enter a topic, script, or link。',
        '快捷提示词 Chips 应位于输入框内部，并保留 Try Sample 和 Generate podcast。'
      ].join('\n')
    }]
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const staleRuleNode = {
    id: 'prompt-config-fallback-page',
    title: '提示词配置与降级',
    summary: '配置提示词来源、换一批、失败兜底和不可用状态。',
    sliceId: 'prompt-shortcut-data-contract',
    sourceSliceId: 'prompt-shortcut-data-contract',
    relatedSliceIds: [],
    detailLayout: 'interaction-page-split',
    content: ['提示词来源配置', '远端失败兜底', '字段与开关规则'],
    interactionSpecArtifact: {
      interactionRows: []
    }
  }
  const legacyTotalFlow = {
    ...totalFlow,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'interaction-lofi': {
        ...totalFlow.stageCanvases['interaction-lofi'],
        nodes: [
          ...totalFlow.stageCanvases['interaction-lofi'].nodes,
          staleRuleNode
        ],
        orderedTabs: [
          ...totalFlow.stageCanvases['interaction-lofi'].orderedTabs,
          { key: staleRuleNode.id, label: staleRuleNode.title }
        ]
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-legacy-rule-only-prompt-slice',
    projectId: 'project-podcast',
    title: '首页快捷提示词',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-podcast', name: 'Podcast 项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: run.id })
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes
  const interactionText = JSON.stringify(nodes[0].interactionSpecArtifact || {})

  assert.equal(nodes.length, 1)
  assert.doesNotMatch(nodes.map((node) => node.title).join('\n'), /提示词配置与降级/)
  assert.ok(nodes[0].relatedSliceIds.includes('prompt-shortcut-data-contract'))
  assert.match(interactionText, /提示词配置与降级/)
  assert.match(interactionText, /快捷提示词 Chips|换一批|默认 Chips|不覆盖用户已输入内容/)
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes.length, 1)
})

test('workspace route hydration preserves generated UI visual artifacts', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const expectedHydratedNodeId = totalFlow.stageCanvases['ui-visual'].nodes[0].id
  const generatedVisualNode = {
    ...totalFlow.stageCanvases['ui-visual'].nodes[0],
    artifactStatus: 'generated',
    artifact: {
      kind: 'visual',
      imageStatus: 'generated',
      imageUrl: '/api/workspace/generated-images/run-ui-p1.png',
      localImagePath: '/tmp/run-ui-p1.png'
    },
    visualPreview: {
      ...(totalFlow.stageCanvases['ui-visual'].nodes[0].visualPreview || {}),
      imageStatus: 'generated',
      imageUrl: '/api/workspace/generated-images/run-ui-p1.png',
      localImagePath: '/tmp/run-ui-p1.png'
    },
    generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2', status: 'generated' }]
  }
  const legacyTotalFlow = {
    ...totalFlow,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'interaction-lofi': {
        ...totalFlow.stageCanvases['interaction-lofi'],
        nodes: totalFlow.stageCanvases['interaction-lofi'].nodes.map((node) => {
          const { pageLayoutArtifact, ...rest } = node
          return rest
        })
      },
      'ui-visual': {
        ...totalFlow.stageCanvases['ui-visual'],
        nodes: [
          generatedVisualNode,
          ...totalFlow.stageCanvases['ui-visual'].nodes.slice(1)
        ]
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-preserve-generated-visual-hydration',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-preserve-generated-visual-hydration' })
  const node = result.run.documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]

  assert.equal(node.artifactStatus, 'generated')
  assert.equal(node.visualPreview.imageStatus, 'generated')
  assert.equal(node.visualPreview.imageUrl, '/api/workspace/generated-images/run-ui-p1.png')
  assert.equal(node.artifact.imageUrl, '/api/workspace/generated-images/run-ui-p1.png')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0].visualPreview.imageUrl, '/api/workspace/generated-images/run-ui-p1.png')
})

test('workspace route hydration preserves generated UI visual artifacts when node ids change', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const expectedHydratedNodeId = totalFlow.stageCanvases['ui-visual'].nodes[0].id
  const generatedVisualNode = {
    ...totalFlow.stageCanvases['ui-visual'].nodes[0],
    id: 'ui-old-home-node',
    artifactStatus: 'generated',
    artifact: {
      kind: 'visual',
      imageStatus: 'generated',
      imageUrl: '/api/workspace/generated-images/run-ui-old-home.png',
      localImagePath: '/tmp/run-ui-old-home.png'
    },
    visualPreview: {
      ...(totalFlow.stageCanvases['ui-visual'].nodes[0].visualPreview || {}),
      imageStatus: 'generated',
      imageUrl: '/api/workspace/generated-images/run-ui-old-home.png',
      localImagePath: '/tmp/run-ui-old-home.png'
    },
    generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2', status: 'generated' }]
  }
  const staleTotalFlow = {
    ...totalFlow,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'interaction-lofi': {
        ...totalFlow.stageCanvases['interaction-lofi'],
        nodes: totalFlow.stageCanvases['interaction-lofi'].nodes.map((node) => {
          const { pageLayoutArtifact, ...rest } = node
          return rest
        })
      },
      'ui-visual': {
        ...totalFlow.stageCanvases['ui-visual'],
        nodes: [
          generatedVisualNode,
          ...totalFlow.stageCanvases['ui-visual'].nodes.slice(1)
        ],
        orderedTabs: [
          { key: 'ui-old-home-node', label: generatedVisualNode.title },
          ...totalFlow.stageCanvases['ui-visual'].orderedTabs.slice(1)
        ]
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-preserve-generated-visual-renamed-node',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: staleTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-preserve-generated-visual-renamed-node' })
  const node = result.run.documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]

  assert.equal(node.id, expectedHydratedNodeId)
  assert.equal(node.sourcePageId, generatedVisualNode.sourcePageId)
  assert.equal(node.artifactStatus, 'generated')
  assert.equal(node.visualPreview.imageStatus, 'generated')
  assert.equal(node.visualPreview.imageUrl, '/api/workspace/generated-images/run-ui-old-home.png')
  assert.equal(node.artifact.imageUrl, '/api/workspace/generated-images/run-ui-old-home.png')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0].visualPreview.imageUrl, '/api/workspace/generated-images/run-ui-old-home.png')
})

test('workspace route hydration restores generated UI visual image files after stale rebuilds', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'workflow-generated-image-recovery-'))
  try {
    const analysis = analyzeRequirementDocuments({
      skillId: 'auto',
      skillSelectionMode: 'auto',
      demandScope: 'project',
      input: '做一个茶饮点单小程序',
      documents: []
    })
    const totalFlow = buildTotalDesignFlow(analysis)
    const targetNode = totalFlow.stageCanvases['ui-visual'].nodes[0]
    const fileName = `run-recover-generated-visual-${targetNode.id}-2000000000000-abcd1234.png`
    await writeFile(join(tempDir, fileName), 'recovered-image')
    const legacyTotalFlow = {
      ...totalFlow,
      stageCanvases: {
        ...totalFlow.stageCanvases,
        'interaction-lofi': {
          ...totalFlow.stageCanvases['interaction-lofi'],
          nodes: totalFlow.stageCanvases['interaction-lofi'].nodes.map((node) => {
            const { pageLayoutArtifact, ...rest } = node
            return rest
          })
        }
      }
    }
    const run = createWorkspaceWorkflowRun({
      id: 'run-recover-generated-visual',
      projectId: 'project-tea',
      title: '做一个茶饮点单小程序',
      workflowId: 'total-design-flow',
      documentAnalysis: {
        ...analysis,
        totalDesignFlow: legacyTotalFlow
      }
    })
    const store = createWorkspaceStore({
      projects: [{ id: 'project-tea', name: '茶饮项目' }],
      workflowRuns: [run],
      materials: []
    })
    const routes = workspaceRoutes(store, { generatedImageDir: tempDir })

    const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-recover-generated-visual' })
    const node = result.run.documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]

    assert.equal(node.artifactStatus, 'generated')
    assert.equal(node.visualPreview.imageStatus, 'generated')
    assert.equal(node.visualPreview.imageUrl, `/api/workspace/generated-images/${fileName}`)
    assert.equal(node.artifact.imageUrl, `/api/workspace/generated-images/${fileName}`)
    assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0].visualPreview.imageUrl, `/api/workspace/generated-images/${fileName}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('workspace route rehydrates legacy total-flow runs without requirement dissection artifact', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const legacyRequirementCanvas = {
    ...totalFlow.stageCanvases['requirement-dissection'],
    agentNode: {
      ...totalFlow.stageCanvases['requirement-dissection'].agentNode,
      requirementDissectionArtifact: undefined
    },
    nodes: [
      { id: 'requirement-source', stageId: 'requirement-dissection', title: '原始需求', summary: '旧版需求来源卡' },
      { id: 'requirement-intent', stageId: 'requirement-dissection', title: '主意图判断', summary: '旧版意图判断卡' },
      { id: 'requirement-risk', stageId: 'requirement-dissection', title: '分析风险', summary: '旧版风险卡' }
    ]
  }
  const { requirementDissectionArtifact, ...legacyTotalFlowRest } = totalFlow
  const legacyTotalFlow = {
    ...legacyTotalFlowRest,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'requirement-dissection': legacyRequirementCanvas
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-legacy-requirement-artifact-hydration',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-legacy-requirement-artifact-hydration' })
  const hydratedFlow = result.run.documentAnalysis.totalDesignFlow
  const requirementNodes = hydratedFlow.stageCanvases['requirement-dissection'].nodes

  assert.ok(hydratedFlow.requirementDissectionArtifact, 'detail hydration should restore the requirement dissection artifact')
  assert.ok(hydratedFlow.stageCanvases['requirement-dissection'].agentNode.requirementDissectionArtifact, 'requirement agent should carry the restored artifact')
  assert.ok(requirementNodes.some((node) => node.id === 'design-opportunity' && node.detailBlocks?.some((block) => block.sourceRef === 'competitiveAnalysis')), 'hydrated requirement canvas should include competitive analysis in design opportunity')
  assert.ok(requirementNodes.some((node) => node.id === 'feature-page-decomposition' && node.detailBlocks?.some((block) => block.sourceRef === 'designRequirementMap')), 'hydrated requirement canvas should include page design requirements')
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.requirementDissectionArtifact, 'hydrated artifact should persist back to workspace storage')
})

test('workspace route rehydrates sparse requirement dissection details in historical total-flow runs', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个播客生成 App，需要首页输入、脚本编辑、音频预览、视频生成和作品库',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const sparseArtifact = {
    ...totalFlow.requirementDissectionArtifact,
    userScenarios: {
      primaryUsers: [],
      coreScenarios: ['用户生成播客内容。'],
      jobsToBeDone: []
    },
    designRequirementMap: {
      ...totalFlow.requirementDissectionArtifact.designRequirementMap,
      pages: totalFlow.requirementDissectionArtifact.designRequirementMap.pages.map((page) => ({
        pageId: page.pageId,
        pageName: page.pageName,
        goal: page.goal
      }))
    }
  }
  const legacyTotalFlow = {
    ...totalFlow,
    requirementDissectionArtifact: sparseArtifact,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'requirement-dissection': {
        ...totalFlow.stageCanvases['requirement-dissection'],
        agentNode: {
          ...totalFlow.stageCanvases['requirement-dissection'].agentNode,
          requirementDissectionArtifact: sparseArtifact
        },
        nodes: totalFlow.stageCanvases['requirement-dissection'].nodes.map((node) =>
          node.id === 'requirement-user-scenarios'
            ? {
                ...node,
                requirementDissectionArtifact: sparseArtifact,
                content: ['核心场景：用户生成播客内容。'],
                sections: [
                  { title: '目标用户', items: [] },
                  { title: '核心场景', items: ['用户生成播客内容。'] },
                  { title: 'JTBD', items: [] }
                ]
              }
            : node
        )
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-sparse-requirement-detail-hydration',
    projectId: 'project-podcast',
    title: '播客生成 App',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-podcast', name: '播客项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-sparse-requirement-detail-hydration' })
  const hydratedArtifact = result.run.documentAnalysis.totalDesignFlow.requirementDissectionArtifact
  const userNode = result.run.documentAnalysis.totalDesignFlow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'requirement-understanding')

  assert.ok(hydratedArtifact.userScenarios.primaryUsers.length >= 2, 'historical sparse details should regain target user analysis')
  assert.ok(hydratedArtifact.userScenarios.jobsToBeDone.length >= 3, 'historical sparse details should regain JTBD analysis')
  assert.ok(hydratedArtifact.designRequirementMap.pages.every((page) => page.primaryAction && page.states?.length && page.dataDependencies?.length), 'page requirements should regain action, state, and data detail')
  assert.doesNotMatch(userNode.content.join('\n'), /用户生成播客内容。$/)
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.requirementDissectionArtifact.userScenarios.primaryUsers.length >= 2, 'rehydrated detail should persist back to workspace storage')
})

test('workspace route rehydrates loose model requirement fields in historical total-flow runs', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'non-project',
    input: '做一个会员点单小程序，需要首页、菜单、订单和会员权益',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const looseArtifact = {
    ...totalFlow.requirementDissectionArtifact,
    productAnalysisPipeline: {
      version: 'legacy-product-analysis-pipeline/v0',
      tabs: [
        { id: 'requirement-understanding', title: '需求理解', detailBlocks: [{ sourceRef: 'productDefinition' }] },
        { id: 'requirement-decomposition', title: '需求拆解', detailBlocks: [{ sourceRef: 'designRequirementMap' }] },
        { id: 'requirement-completeness', title: '需求完整性', detailBlocks: [{ sourceRef: 'userJourneyMap' }] },
        { id: 'risk-assumption', title: '风险假设', detailBlocks: [{ sourceRef: 'riskAssessment' }] },
        { id: 'flow-info-architecture', title: '流程与信息架构', detailBlocks: [{ sourceRef: 'dataFlowGraph' }] },
        { id: 'design-opportunity-priority', title: '设计机会与优先级', detailBlocks: [{ sourceRef: 'designOpportunityMatrix' }] },
        { id: 'acceptance-summary', title: '验收汇总', detailBlocks: [{ sourceRef: 'acceptanceBasis' }] }
      ]
    },
    navigationStructure: ['发现首页', '浏览菜单', '提交订单'],
    pageHierarchyTree: '发现首页\n  浏览菜单\n  提交订单',
    userJourneyMap: ['发现首页 -> 浏览菜单 -> 提交订单'],
    dataFlowGraph: '发现首页 -> 浏览菜单 -> 提交订单',
    stateMachineMap: [{ pageName: '提交订单', states: ['待提交', '提交中', '提交成功'] }],
    featureJumpGraph: [{ from: '浏览菜单', to: '提交订单', action: '加入购物车' }],
    designOpportunityMatrix: [{ title: '快速复购入口', expectedValue: '减少重复点单成本', priority: 'P1' }],
    priorityRoadmap: [{ phase: 'MVP', deliverables: ['首页入口', '菜单浏览', '订单提交'] }],
    acceptanceBasis: ['用户可以从首页进入菜单并提交订单']
  }
  const legacyTotalFlow = {
    ...totalFlow,
    requirementDissectionArtifact: looseArtifact,
    modelOnlyRequirementDissectionArtifact: looseArtifact,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'requirement-dissection': {
        ...totalFlow.stageCanvases['requirement-dissection'],
        agentNode: {
          ...totalFlow.stageCanvases['requirement-dissection'].agentNode,
          requirementDissectionArtifact: looseArtifact,
          modelOnlyRequirementDissectionArtifact: looseArtifact
        },
        nodes: [
          ...looseArtifact.productAnalysisPipeline.tabs.map((tab, index) => ({
            id: tab.id,
            stageId: 'requirement-dissection',
            title: tab.title,
            summary: '旧版模型节点',
            content: ['模型未返回该字段'],
            requirementPipelineTabId: tab.id,
            detailBlocks: tab.detailBlocks,
            modelOnlyRequirementDissectionArtifact: looseArtifact,
            x: 80 + index * 40,
            y: 140
          })),
          {
            id: 'flow-architecture',
            stageId: 'requirement-dissection',
            title: '流程与架构',
            summary: '旧版同名空节点',
            content: ['模型未返回该字段'],
            requirementPipelineTabId: 'flow-architecture',
            detailBlocks: [{ sourceRef: 'dataFlowGraph' }],
            modelOnlyRequirementDissectionArtifact: looseArtifact,
            x: 80,
            y: 460
          }
        ]
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-loose-requirement-detail-hydration',
    projectId: '',
    demandScope: 'non-project',
    title: '会员点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-loose-requirement-detail-hydration' })
  const hydratedFlow = result.run.documentAnalysis.totalDesignFlow
  const hydratedArtifact = hydratedFlow.modelOnlyRequirementDissectionArtifact
  const requirementNodes = hydratedFlow.stageCanvases['requirement-dissection'].nodes

  assert.deepEqual(requirementNodes.map((node) => node.id), [
    'requirement-understanding',
    'gap-confirmation',
    'user-journey-analysis',
    'feature-page-decomposition',
    'business-rules-stateflow',
    'flow-architecture',
    'design-opportunity',
    'priority-roadmap',
    'acceptance-standards'
  ])
  assert.deepEqual(hydratedArtifact.dataFlowGraph.edges[0], {
    id: 'data-edge-1',
    from: '发现首页',
    to: '浏览菜单',
    label: '模型返回数据流'
  })
  assert.equal(hydratedArtifact.navigationStructure.navigationItems[0].label, '发现首页')
  assert.equal(hydratedArtifact.pageHierarchyTree.nodes[1].label, '浏览菜单')
  assert.deepEqual(hydratedArtifact.acceptanceBasis.functional, ['用户可以从首页进入菜单并提交订单'])
  assert.doesNotMatch(requirementNodes.find((node) => node.id === 'flow-architecture').content.join('\n'), /模型未返回该字段/)
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.modelOnlyRequirementDissectionArtifact.dataFlowGraph.edges[0].from, '发现首页')
  assert.equal(store.workflowRuns[0].demandScope, 'non-project')
})

test('workspace route rehydrates requirement competitive references without evidence actions', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '想针对 AI 播客产品首页进行改版，有更好的方案吗',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const sparseCompetitive = {
    ...totalFlow.requirementDissectionArtifact.competitiveAnalysis,
    evidenceStatus: undefined,
    evidenceNotice: undefined,
    nextActions: undefined,
    researchSearchDirections: undefined,
    comparisonDimensions: undefined
  }
  const sparseArtifact = {
    ...totalFlow.requirementDissectionArtifact,
    competitiveAnalysis: sparseCompetitive
  }
  const legacyTotalFlow = {
    ...totalFlow,
    requirementDissectionArtifact: sparseArtifact,
    stageCanvases: {
      ...totalFlow.stageCanvases,
      'requirement-dissection': {
        ...totalFlow.stageCanvases['requirement-dissection'],
        agentNode: {
          ...totalFlow.stageCanvases['requirement-dissection'].agentNode,
          requirementDissectionArtifact: sparseArtifact
        }
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-sparse-competitive-reference-hydration',
    projectId: 'project-podcast',
    title: 'AI 播客首页改版',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: legacyTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-podcast', name: '播客项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-sparse-competitive-reference-hydration' })
  const competitive = result.run.documentAnalysis.totalDesignFlow.requirementDissectionArtifact.competitiveAnalysis
  const competitiveNode = result.run.documentAnalysis.totalDesignFlow.stageCanvases['requirement-dissection'].nodes.find((node) => node.id === 'design-opportunity')

  assert.equal(competitive.evidenceStatus, 'needs-user-or-search-evidence')
  assert.ok(competitive.nextActions.includes('让 Agent 找 3 个竞品'))
  assert.ok(competitive.researchSearchDirections.some((item) => /podcast|播客|homepage|首页/i.test(item)))
  assert.ok(competitiveNode.detailBlocks.some((block) => block.sourceRef === 'competitiveAnalysis'))
  assert.ok(competitiveNode.quickActions.includes('让 Agent 找 3 个竞品'))
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.requirementDissectionArtifact.competitiveAnalysis.nextActions.length, 'rehydrated competitive actions should persist back to storage')
})

test('workspace route rehydrates stale total-flow page layout artifacts and short tea model pages', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '做一个茶饮点单小程序',
    documents: []
  })
  const staleAnalysis = {
    ...analysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'tea-main', title: '茶饮点单主流程', goal: '完成用户点单闭环。' },
            { id: 'tea-merchant', title: '商家订单处理', goal: '让门店处理用户订单。' }
          ],
          pages: [
            { id: 'menu-home', sliceId: 'tea-main', title: '点单首页', summary: '浏览菜单并加购。' },
            { id: 'product-detail', sliceId: 'tea-main', title: '商品详情', summary: '选择规格和加料。' },
            { id: 'order-confirm', sliceId: 'tea-main', title: '订单确认', summary: '确认商品和优惠。' },
            { id: 'order-detail', sliceId: 'tea-main', title: '订单详情', summary: '查看取餐码和状态。' },
            { id: 'merchant-board', sliceId: 'tea-merchant', title: '商家订单台', summary: '商家处理订单。' }
          ]
        }
      }
    }
  }
  const staleTotalFlow = {
    ...buildTotalDesignFlow(staleAnalysis),
    pages: staleAnalysis.generation.output.totalDesignFlow.pages,
    stageCanvases: {
      'interaction-lofi': {
        nodes: staleAnalysis.generation.output.totalDesignFlow.pages.map((page) => ({
          id: page.id,
          sliceId: page.sliceId,
          title: page.title,
          detailLayout: 'interaction-page-split',
          pageLayoutArtifact: {
            asciiWireframe: '② 点餐菜单页（左右分栏特殊框架）\n左右分栏主体',
            rawText: ':::page-layout-artifact title="页面骨架"\n② 点餐菜单页（左右分栏特殊框架）\n:::'
          }
        }))
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-stale-page-layout-hydration',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      ...staleAnalysis,
      totalDesignFlow: staleTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-stale-page-layout-hydration' })
  const totalFlow = result.run.documentAnalysis.totalDesignFlow
  const nodes = totalFlow.stageCanvases['interaction-lofi'].nodes
  const productNode = nodes.find((node) => node.title === '商品详情' || node.title === '商品定制')

  assert.ok(totalFlow.pages.length > 5)
  assert.ok(totalFlow.pages.some((page) => page.title === '购物车与结算'))
  assert.match(productNode.pageLayoutArtifact.asciiWireframe, /商品详情页/)
  assert.match(productNode.pageLayoutArtifact.asciiWireframe, /规格选择/)
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.pages.length > 5)
})

test('workspace route rehydrates stale Podcast homepage wireframes that contain mall layout', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documents: [
      {
        name: '项目知识库：Jogg 首页 Video Podcast 创建入口',
        text: [
          '首页入口来自 / 或 /video-podcast，页面为 video-podcast/index.vue。',
          '用户在 PodcastStep1 选择 Generate Script、Upload Script、Upload Audio。',
          '点击 Next 后沿用 checkOpenGuestLoginDialog，再进入 Studio。'
        ].join('\n')
      }
    ]
  })
  const staleAnalysis = {
    ...analysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'home-prompt-shortcuts', title: '首页快捷提示词展示', goal: '让用户在首页快速选择常见输入提示词。' }
          ],
          pages: [
            { id: 'home-video-podcast', sliceId: 'home-prompt-shortcuts', title: '首页 Video Podcast', summary: '在主输入区附近新增快捷提示词展示。' },
            { id: 'video-podcast-alias', sliceId: 'home-prompt-shortcuts', title: 'Video Podcast 首页别名', summary: '保持 /video-podcast 与首页同样的提示词体验。' }
          ]
        }
      }
    }
  }
  const builtFlow = buildTotalDesignFlow(staleAnalysis)
  const staleTotalFlow = {
    ...builtFlow,
    stageCanvases: {
      ...builtFlow.stageCanvases,
      'interaction-lofi': {
        ...builtFlow.stageCanvases['interaction-lofi'],
        nodes: builtFlow.stageCanvases['interaction-lofi'].nodes.map((node) => ({
          ...node,
          pageLayoutArtifact: {
            ...(node.pageLayoutArtifact || {}),
            asciiWireframe: '首页 页面框架\n门店选择  搜索框  自提/外卖  消息\nBanner轮播\n热销商品\n限时秒杀\n优惠券弹窗',
            rawText: ':::page-layout-artifact title="页面骨架"\n门店选择 / 自提/外卖 / 优惠券 / 点餐\n:::'
          }
        }))
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-stale-podcast-homepage-hydration',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documentAnalysis: {
      ...staleAnalysis,
      totalDesignFlow: staleTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-stale-podcast-homepage-hydration' })
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes
  const homepageWireframes = nodes
    .filter((node) => /Video Podcast|首页/.test(node.title || ''))
    .map((node) => node.pageLayoutArtifact?.asciiWireframe || '')
    .join('\n\n')

  assert.match(homepageWireframes, /PodcastStep1|Generate Script|Upload Script|Upload Audio|快捷提示词/)
  assert.match(homepageWireframes, /左侧 (AppNavRail|全局导航|Sidebar)/)
  assert.match(homepageWireframes, /输入框内部|placeholder|Chips 内嵌|Generate podcast/)
  assert.doesNotMatch(homepageWireframes, /门店选择|自提\/外卖|优惠券|热销商品|限时秒杀|点餐/)
  assert.doesNotMatch(homepageWireframes, /顶部固定区：Logo \/ Home \/ Projects|顶部导航：Logo \/ Home/)
  assert.doesNotMatch(
    store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes[0].pageLayoutArtifact.asciiWireframe,
    /门店选择|自提\/外卖|优惠券|热销商品|限时秒杀|点餐/
  )
})

test('workspace route rehydrates duplicate Podcast homepage alias pages into one canvas node', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documents: [
      {
        name: '项目知识库：Jogg 首页 Video Podcast 创建入口',
        text: [
          '首页入口来自 / 或 /video-podcast，页面为 video-podcast/index.vue。',
          '用户在 PodcastStep1 选择 Generate Script、Upload Script、Upload Audio。',
          '点击 Next 后沿用 checkOpenGuestLoginDialog，再进入 Studio。'
        ].join('\n')
      }
    ]
  })
  const staleAnalysis = {
    ...analysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'home-prompt-shortcuts', title: '首页快捷提示词展示', goal: '让用户在首页快速选择常见输入提示词。' }
          ],
          pages: [
            { id: 'home-video-podcast', sliceId: 'home-prompt-shortcuts', title: '首页 Video Podcast', summary: '在主输入区附近新增快捷提示词展示。' },
            { id: 'video-podcast-alias', sliceId: 'home-prompt-shortcuts', title: 'Video Podcast 首页别名', summary: '保持 /video-podcast 与首页同样的提示词体验。' },
            { id: 'studio-initial', sliceId: 'auth-submit-integration', title: 'Studio 初始页', summary: '提交成功后继续进入现有 Studio 项目流程。' }
          ]
        }
      }
    }
  }
  const staleTotalFlow = buildTotalDesignFlow(staleAnalysis)
  const run = createWorkspaceWorkflowRun({
    id: 'run-duplicate-podcast-homepage-hydration',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documentAnalysis: {
      ...staleAnalysis,
      totalDesignFlow: staleTotalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-duplicate-podcast-homepage-hydration' })
  const nodes = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes
  const homepageNodes = nodes.filter((node) => /Video Podcast|首页/.test(node.title || ''))

  assert.equal(homepageNodes.length, 1)
  assert.equal(result.run.documentAnalysis.totalDesignFlow.pages.filter((page) => /Video Podcast|首页/.test(page.title || '')).length, 1)
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes.filter((node) => /Video Podcast|首页/.test(node.title || '')).length, 1)
})

test('workspace hydration preserves confirmed stage progress and imported interaction canvas', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documents: [{
      name: '框选功能：Jogg 产品结构',
      sourceType: 'selected-knowledge-scope',
      selectedKnowledgeScope: true,
      text: '截图页面：Home / AI Podcast Generator\n功能流程：Home / Tools / Studio / Voice\n页面热区：Topic/input composer / Generate podcast / Login\n需求：在首页输入区展示快捷提示词。'
    }]
  })
  const totalFlow = {
    ...buildTotalDesignFlow(analysis),
    currentStage: 'interaction-lofi',
    pages: [
      { id: 'home-video-podcast', title: '首页 Video Podcast', summary: '首页提示词。' },
      { id: 'video-podcast-alias', title: 'Video Podcast 首页别名', summary: '同一首页别名。' }
    ],
    stageConfirmations: {
      'requirement-dissection': {
        stageId: 'requirement-dissection',
        nextStageId: 'interaction-lofi',
        summary: '需求分析确认：可以推进到交互低保，覆盖首页、登录弹窗和 Studio 初始页。'
      }
    }
  }
  totalFlow.stageCanvases = {
    ...(totalFlow.stageCanvases || {}),
    'interaction-lofi': {
      nodes: [
        { id: 'home-video-podcast', stageId: 'interaction-lofi', title: '首页 Video Podcast', stageContextSummary: '需求分析确认', pageLayoutArtifact: { asciiWireframe: 'HOME' } },
        { id: 'login-modal', stageId: 'interaction-lofi', title: '登录弹窗', stageContextSummary: '需求分析确认', pageLayoutArtifact: { asciiWireframe: 'LOGIN' } },
        { id: 'studio-initial', stageId: 'interaction-lofi', title: 'Studio 初始页', stageContextSummary: '需求分析确认', pageLayoutArtifact: { asciiWireframe: 'STUDIO' } }
      ],
      edges: [],
      orderedTabs: [
        { key: 'home-video-podcast', label: '首页 Video Podcast' },
        { key: 'login-modal', label: '登录弹窗' },
        { key: 'studio-initial', label: 'Studio 初始页' }
      ]
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-confirmed-stage-hydration',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documentAnalysis: {
      ...analysis,
      totalDesignFlow: totalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-confirmed-stage-hydration' })
  const nextFlow = result.run.documentAnalysis.totalDesignFlow
  const nodes = nextFlow.stageCanvases['interaction-lofi'].nodes

  assert.equal(nextFlow.currentStage, 'interaction-lofi')
  assert.ok(nextFlow.stageConfirmations['requirement-dissection'])
  assert.deepEqual(nodes.map((node) => node.title), ['首页 Video Podcast', '登录弹窗', 'Studio 初始页'])
  assert.ok(nodes.every((node) => node.stageContextSummary))
})

test('workspace hydration writes best agent page layout artifact into interaction lofi canvas', async () => {
  const agentArtifact = [
    '已经确认，进入下一阶段：',
    ':::page-layout-artifact title="页面骨架"',
    '## 模型推荐方案',
    '页面类型：首页 Video Podcast 创建入口',
    '推荐布局：顶部操作区 + 主体滚动区 + 输入卡片/提示词区域 + 主操作按钮',
    '推荐原因：当前证据显示首页已有 Topic/input composer 和 Generate podcast，快捷提示词应围绕输入区增强首句启动效率。',
    '',
    '## ASCII 页面线框图',
    '┌────────────────────────────────────┐',
    '│ 顶部固定区：Logo / Home / Projects / Tools / Voice / Pricing / Login │',
    '├────────────────────────────────────┤',
    '│ 主体滚动区                           │',
    '│        标题：AI Video Podcast       │',
    '│        副标题：输入主题或素材开始生成  │',
    '│ ┌──────────────────────────────┐   │',
    '│ │ Topic/input composer          │   │',
    '│ │ 输入框：用户输入主题/脚本/链接    │   │',
    '│ │ [快捷提示词1] [快捷提示词2]      │   │',
    '│ │ [快捷提示词3] [更多/换一批]      │   │',
    '│ │                [Generate podcast] │',
    '│ └──────────────────────────────┘   │',
    '│ 次级内容区：公开模板 / 工具入口 / 示例内容 │',
    '├────────────────────────────────────┤',
    '│ 底部状态区：加载提示 / 错误提示 / 登录引导浮层按需出现 │',
    '└────────────────────────────────────┘',
    '',
    '## 模块交互明细',
    '- 快捷提示词默认展示在输入框下方、Generate podcast 附近。',
    '- 点击提示词：将提示词文案填入 Topic/input composer。',
    '- 点击「换一批」：刷新快捷提示词列表。',
    '- 输入框手动编辑后：保留用户输入，降低提示词选择优先级。',
    '- Generate podcast：输入不为空时提交生成。',
    '- 权限状态：未登录时弹出登录引导浮层。',
    '',
    '## 前后端交付',
    '- 前端：渲染 Chips、换一批、输入态和登录引导浮层。',
    '- 后端：返回推荐提示词列表、生成状态和登录态。',
    ':::'
  ].join('\n')
  const totalFlow = {
    mode: 'total-design-flow',
    currentStage: 'interaction-lofi',
    stages: [
      { id: 'requirement-dissection', name: '需求分析' },
      { id: 'interaction-lofi', name: '交互低保' }
    ],
    stageConfirmations: {
      'requirement-dissection': {
        stageId: 'requirement-dissection',
        nextStageId: 'interaction-lofi',
        summary: '需求分析确认：进入交互低保。'
      }
    },
    stageCanvases: {
      'interaction-lofi': {
        nodes: [
          {
            id: 'home-video-podcast',
            stageId: 'interaction-lofi',
            title: '首页 Video Podcast',
            stageContextSummary: '需求分析确认',
            detailLayout: 'interaction-page-split',
            pageLayoutArtifact: { asciiWireframe: 'HOME GENERIC' },
            interactionSpecArtifact: { pageName: '首页 Video Podcast', interactionRows: [] }
          },
          {
            id: 'login-modal',
            stageId: 'interaction-lofi',
            title: '登录弹窗',
            stageContextSummary: '需求分析确认',
            detailLayout: 'interaction-page-split',
            pageLayoutArtifact: { asciiWireframe: 'LOGIN' }
          }
        ],
        edges: [],
        orderedTabs: [
          { key: 'home-video-podcast', label: '首页 Video Podcast' },
          { key: 'login-modal', label: '登录弹窗' }
        ]
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-agent-artifact-import',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    agentSessions: {
      'requirement-dissection': [
        { role: 'assistant', content: '最新总结：可以进入下一阶段，但这里没有完整骨架。', meta: { action: 'stage-confirm-next' } },
        { role: 'assistant', content: agentArtifact, meta: { action: 'stage-confirm-next' } }
      ]
    },
    documentAnalysis: {
      input: '我想在首页增加几个快捷输入提示词的功能',
      totalDesignFlow: totalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-agent-artifact-import' })
  const homeNode = result.run.documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes
    .find((node) => node.id === 'home-video-podcast')
  const targets = homeNode.interactionSpecArtifact.interactionRows.map((row) => row.target)
  const findRegion = (id) => homeNode.pageLayoutArtifact.layout.regions.find((region) => region.id === id)

  assert.match(homeNode.pageLayoutArtifact.rawText, /:::page-layout-artifact title="页面骨架"/)
  assert.equal(homeNode.pageLayoutArtifact.version, 'page-layout-artifact/v2')
  assert.deepEqual(homeNode.pageLayoutArtifact.sourcePriority, ['screenshot', 'source', 'knowledge', 'agent', 'fallback'])
  assert.ok(homeNode.pageLayoutArtifact.evidenceRefs.some((ref) => /navigation\.md/.test(ref.id)))
  assert.ok(homeNode.pageLayoutArtifact.evidenceRefs.some((ref) => /HomeLayout_V2/.test(ref.id)))
  assert.ok(homeNode.pageLayoutArtifact.conflicts.some((conflict) =>
    conflict.field === 'navigation.desktop' &&
    /agent:top-nav/.test(conflict.sources.join(' ')) &&
    conflict.decision === 'left-app-nav'
  ))
  assert.equal(homeNode.pageLayoutArtifact.layout.version, 'page-layout-structured/v2')
  assert.deepEqual(homeNode.pageLayoutArtifact.layout.viewport, { width: 1440, height: 900, unit: 'px', variant: 'desktop' })
  assert.equal(findRegion('left-app-nav')?.type, 'sidebar')
  assert.equal(findRegion('left-app-nav')?.bounds?.width, 72)
  assert.equal(findRegion('main-content')?.parentId, 'app-shell')
  assert.equal(findRegion('topic-composer')?.type, 'composer')
  assert.equal(findRegion('topic-composer')?.parentId, 'main-content')
  assert.equal(findRegion('composer-placeholder')?.parentId, 'topic-composer')
  assert.equal(findRegion('composer-placeholder')?.containment, 'inside')
  assert.equal(findRegion('composer-chips')?.parentId, 'topic-composer')
  assert.equal(findRegion('composer-chips')?.containment, 'inside')
  assert.equal(findRegion('composer-generate')?.parentId, 'topic-composer')
  assert.equal(findRegion('composer-generate')?.containment, 'inside')
  assert.ok(homeNode.pageLayoutArtifact.layout.constraints.some((constraint) => constraint.subject === 'composer-chips' && constraint.relation === 'inside'))
  assert.ok(homeNode.pageLayoutArtifact.layout.states.some((state) => state.id === 'login-required'))
  assert.ok(homeNode.pageLayoutArtifact.layout.states.some((state) => state.id === 'paid-limit'))
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /左侧 (AppNavRail|全局导航|Sidebar)/)
  assert.doesNotMatch(homeNode.pageLayoutArtifact.asciiWireframe, /顶部固定区：Logo \/ Home \/ Projects/)
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /Topic\/input composer/)
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /输入框内部|placeholder|Chips 内嵌/)
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /Chips 内嵌/)
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /更多\/换一批/)
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /Generate podcast/)
  assert.ok(targets.includes('快捷提示词 Chips'))
  assert.ok(targets.includes('换一批'))
  assert.ok(targets.includes('Topic/input composer'))
  assert.ok(targets.includes('Generate podcast'))
  assert.ok(targets.includes('登录引导浮层'))
  assert.ok(homeNode.interactionSpecArtifact.interactionRows.some((row) => row.target === '快捷提示词 Chips' && row.targetRegionId === 'composer-chips'))
  assert.ok(homeNode.interactionSpecArtifact.interactionRows.some((row) => row.target === '换一批' && row.targetRegionId === 'composer-more'))
  assert.ok(homeNode.interactionSpecArtifact.interactionRows.some((row) => row.target === 'Topic/input composer' && row.targetRegionId === 'topic-composer'))
  assert.ok(homeNode.interactionSpecArtifact.interactionRows.some((row) => row.target === 'Generate podcast' && row.targetRegionId === 'composer-generate'))
  assert.ok(homeNode.interactionSpecArtifact.interactionRows.some((row) => row.target === '登录引导浮层' && row.targetRegionId === 'login-dialog'))
  assert.match(
    store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['interaction-lofi'].nodes[0].pageLayoutArtifact.asciiWireframe,
    /Topic\/input composer/
  )
})

test('workspace hydration advances current stage to a confirmed next stage', async () => {
  const totalFlow = {
    mode: 'total-design-flow',
    currentStage: 'requirement-dissection',
    stages: [
      { id: 'requirement-dissection', name: '需求分析' },
      { id: 'interaction-lofi', name: '交互低保' }
    ],
    stageConfirmations: {
      'requirement-dissection': {
        stageId: 'requirement-dissection',
        nextStageId: 'interaction-lofi',
        summary: '需求分析确认：进入交互低保。'
      }
    },
    stageCanvases: {
      'interaction-lofi': {
        nodes: [{
          id: 'home-video-podcast',
          stageId: 'interaction-lofi',
          title: '首页 Video Podcast',
          stageContextSummary: '需求分析确认',
          pageLayoutArtifact: { asciiWireframe: 'HOME' }
        }],
        edges: [],
        orderedTabs: [{ key: 'home-video-podcast', label: '首页 Video Podcast' }]
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-confirmed-current-stage-hydration',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documentAnalysis: {
      input: '我想在首页增加几个快捷输入提示词的功能',
      totalDesignFlow: totalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-confirmed-current-stage-hydration' })

  assert.equal(result.run.documentAnalysis.totalDesignFlow.currentStage, 'interaction-lofi')
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.currentStage, 'interaction-lofi')
})

test('workspace hydration keeps scaffold-only future stages locked in stage runtime', async () => {
  const totalFlow = {
    mode: 'total-design-flow',
    currentStage: 'interaction-lofi',
    stages: [
      { id: 'requirement-dissection', name: '需求分析' },
      { id: 'interaction-lofi', name: '交互低保' },
      { id: 'ui-visual', name: 'UI视觉' },
      { id: 'html-output', name: 'HTML' },
      { id: 'vue-output', name: 'Vue' },
      { id: 'acceptance-deposit', name: '验收沉淀' }
    ],
    stageConfirmations: {
      'requirement-dissection': {
        stageId: 'requirement-dissection',
        nextStageId: 'interaction-lofi',
        summary: '需求分析确认：进入交互低保。'
      }
    },
    stageCanvases: {
      'requirement-dissection': {
        nodes: [{ id: 'requirement-source', stageId: 'requirement-dissection', title: '产品判断', contentStatus: 'model-generated' }],
        edges: [],
        orderedTabs: []
      },
      'interaction-lofi': {
        nodes: [{
          id: 'home-video-podcast',
          stageId: 'interaction-lofi',
          title: '首页 Video Podcast',
          stageContextSummary: '需求分析确认',
          contentStatus: 'model-generated',
          pageLayoutArtifact: {
            asciiWireframe: 'Topic/input composer\n[快捷提示词1]\n[Generate podcast]',
            screenContract: { version: 'screen-contract/v1' }
          }
        }],
        edges: [],
        orderedTabs: [{ key: 'home-video-podcast', label: '首页 Video Podcast' }]
      },
      'ui-visual': {
        nodes: [{
          id: 'ui-home-video-podcast',
          stageId: 'ui-visual',
          title: '首页 Video Podcast UI视觉',
          contentStatus: 'model-generated',
          artifactStatus: 'pending',
          visualPreview: { imageStatus: 'pending' }
        }],
        edges: [],
        orderedTabs: []
      },
      'html-output': {
        nodes: [{
          id: 'html-home-video-podcast',
          stageId: 'html-output',
          title: '首页 Video Podcast HTML',
          contentStatus: 'model-generated',
          artifactStatus: 'pending',
          codePreview: { code: '', previewTitle: 'HTML 运行预览' }
        }],
        edges: [],
        orderedTabs: []
      },
      'vue-output': {
        nodes: [{
          id: 'vue-app',
          stageId: 'vue-output',
          title: 'Vue 页面',
          contentStatus: 'model-generated',
          artifactStatus: 'pending',
          codePreview: { code: '', previewTitle: 'Vue 运行预览' }
        }],
        edges: [],
        orderedTabs: []
      },
      'acceptance-deposit': {
        nodes: [{ id: 'acceptance-checklist', stageId: 'acceptance-deposit', title: '验收清单', contentStatus: 'model-generated' }],
        edges: [],
        orderedTabs: []
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-stage-runtime-scaffold-lock',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documentAnalysis: {
      input: '我想在首页增加几个快捷输入提示词的功能',
      totalDesignFlow: totalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-stage-runtime-scaffold-lock' })
  const runtime = result.run.documentAnalysis.totalDesignFlow.stageRuntime

  assert.equal(runtime['requirement-dissection'].canOpen, true)
  assert.equal(runtime['interaction-lofi'].canOpen, true)
  assert.equal(runtime['interaction-lofi'].state, 'generated')
  assert.equal(runtime['interaction-lofi'].scaffoldOnly, false)
  assert.equal(runtime['ui-visual'].canOpen, false)
  assert.equal(runtime['ui-visual'].state, 'locked')
  assert.equal(runtime['html-output'].canOpen, false)
  assert.equal(runtime['html-output'].scaffoldOnly, true)
  assert.equal(runtime['vue-output'].canOpen, false)
  assert.equal(runtime['vue-output'].scaffoldOnly, true)
  assert.equal(runtime['acceptance-deposit'].canOpen, false)
  assert.equal(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageRuntime['ui-visual'].canOpen, false)
})

test('workspace hydration carries interaction lofi artifacts into downstream stage scaffolds', async () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documents: [
      {
        name: '项目知识库：Jogg 首页 Video Podcast 创建入口',
        text: [
          '项目名称：Jogg。',
          '首页入口来自 / 或 /video-podcast，页面为 video-podcast/index.vue。',
          '桌面端使用左侧 AppNavRail。',
          '用户在 PodcastStep1 选择 Generate Script、Upload Script、Upload Audio。',
          'Topic/input composer 内部包含 placeholder、快捷提示词 Chips、更多/换一批和 Generate podcast。',
          '点击 Next 后沿用 checkOpenGuestLoginDialog，再进入 Studio。'
        ].join('\n')
      }
    ]
  })
  const builtFlow = buildTotalDesignFlow(analysis)
  const totalFlow = {
    ...builtFlow,
    currentStage: 'ui-visual',
    stageConfirmations: {
      ...(builtFlow.stageConfirmations || {}),
      'interaction-lofi': {
        stageId: 'interaction-lofi',
        nextStageId: 'ui-visual',
        summary: '交互低保确认：快捷提示词必须位于 Topic/input composer 内部。'
      }
    },
    stageCanvases: {
      ...builtFlow.stageCanvases,
      'interaction-lofi': {
        ...builtFlow.stageCanvases['interaction-lofi'],
        nodes: builtFlow.stageCanvases['interaction-lofi'].nodes.map((node) => ({
          ...node,
          sliceId: node.sliceId || 'home-prompt-shortcuts'
        }))
      },
      'ui-visual': {
        ...builtFlow.stageCanvases['ui-visual'],
        nodes: builtFlow.stageCanvases['ui-visual'].nodes.map((node) => {
          const {
            sourcePageLayoutArtifact,
            sourceInteractionSpecArtifact,
            upstreamEvidenceRefs,
            upstreamLayoutRegions,
            upstreamPageLayoutVersion,
            upstreamInteractionSpecVersion,
            ...rest
          } = node
          return {
            ...rest,
            visualBrief: { pageTitle: node.visualBrief?.pageTitle || node.title, componentChecklist: ['导航与页面标题'] },
            visualPreview: { imageStatus: 'pending' }
          }
        })
      },
      'html-output': {
        ...builtFlow.stageCanvases['html-output'],
        nodes: builtFlow.stageCanvases['html-output'].nodes.map((node) => {
          const {
            sourcePageLayoutArtifact,
            sourceInteractionSpecArtifact,
            upstreamEvidenceRefs,
            upstreamLayoutRegions,
            upstreamPageLayoutVersion,
            upstreamInteractionSpecVersion,
            ...rest
          } = node
          return node.htmlOutputKind === 'total-interactive'
            ? rest
            : {
                ...rest,
                engineeringPlan: { inputArtifacts: ['通用交互低保'] },
                codePreview: { code: '', previewTitle: 'HTML 运行预览' }
              }
        })
      },
      'vue-output': {
        ...builtFlow.stageCanvases['vue-output'],
        nodes: builtFlow.stageCanvases['vue-output'].nodes.map((node) => {
          const { upstreamPageContracts, ...rest } = node
          return {
            ...rest,
            engineeringPlan: { inputArtifacts: ['HTML Demo'] },
            codePreview: { code: '', previewTitle: 'Vue 运行预览' }
          }
        })
      }
    }
  }
  const run = createWorkspaceWorkflowRun({
    id: 'run-downstream-artifact-carryover',
    projectId: 'project-jogg',
    title: '首页快捷提示词展示',
    workflowId: 'total-design-flow',
    input: '我想在首页增加几个快捷输入提示词的功能',
    documentAnalysis: {
      ...analysis,
      input: '我想在首页增加几个快捷输入提示词的功能',
      totalDesignFlow: totalFlow
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['GET /api/workspace/workflow-runs/:id']({ id: 'run-downstream-artifact-carryover' })
  const nextFlow = result.run.documentAnalysis.totalDesignFlow
  const visualNode = nextFlow.stageCanvases['ui-visual'].nodes[0]
  const htmlNode = nextFlow.stageCanvases['html-output'].nodes[0]
  const vueNode = nextFlow.stageCanvases['vue-output'].nodes[0]

  assert.equal(visualNode.sourcePageLayoutArtifact.version, 'page-layout-artifact/v2')
  assert.equal(visualNode.sourceInteractionSpecArtifact.version, 'page-interaction-spec/v1')
  assert.ok(visualNode.upstreamEvidenceRefs.includes('knowledge/navigation.md'))
  assert.ok(visualNode.upstreamEvidenceRefs.includes('source/HomeLayout_V2.vue'))
  assert.ok(visualNode.upstreamLayoutRegions.some((region) => region.id === 'composer-chips'))
  assert.ok(visualNode.visualBrief.componentChecklist.some((item) => /快捷提示词 Chips/.test(item)))
  assert.match(visualNode.visualPreview.imagePrompt, /Topic\/input composer/)
  assert.match(visualNode.visualPreview.imagePrompt, /composer-chips|快捷提示词/)
  assert.equal(htmlNode.sourcePageLayoutArtifact.version, 'page-layout-artifact/v2')
  assert.ok(htmlNode.engineeringPlan.inputArtifacts.some((item) => /Topic\/input composer|快捷提示词/.test(item)))
  assert.ok(vueNode.upstreamPageContracts.some((item) =>
    item.layoutVersion === 'page-layout-artifact/v2' &&
    item.regions.includes('composer-chips')
  ))
  assert.ok(store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0].sourcePageLayoutArtifact)
})

test('workspace route deposits total-flow acceptance node into knowledge materials', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-acceptance-deposit',
    projectId: 'project-tea',
    title: '做一个茶饮点单小程序',
    workflowId: 'total-design-flow',
    documentAnalysis: {
      input: '做一个茶饮点单小程序',
      totalDesignFlow: {
        mode: 'total-design-flow',
        stageCanvases: {
          'acceptance-deposit': {
            nodes: [{
              id: 'acceptance-summary',
              stageId: 'acceptance-deposit',
              title: '茶饮点单验收沉淀',
              detailLayout: 'acceptance-deposit',
              acceptanceChecklist: ['首页能完成选店和取餐方式选择', '支付成功后生成订单并通知取餐'],
              riskItems: ['库存和门店营业状态需要实时同步', '优惠券叠加规则容易造成金额不一致'],
              knowledgeDeposits: ['门店、菜单、优惠、订单状态可作为茶饮点单基础知识', '后续新增入口必须复用取餐方式和订单状态规则']
            }],
            edges: [],
            orderedTabs: [{ key: 'acceptance-summary', label: '茶饮点单验收沉淀' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [run],
    materials: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['POST /api/workspace/workflow-runs/:id/import-acceptance-knowledge']({
    id: 'run-acceptance-deposit',
    projectId: 'project-tea'
  })

  assert.equal(result.materials.length, 1)
  assert.equal(result.materials[0].type, 'knowledge')
  assert.equal(result.materials[0].projectId, 'project-tea')
  assert.equal(result.materials[0].category, 'acceptance-deposit')
  assert.match(result.materials[0].content, /首页能完成选店/)
  assert.match(result.materials[0].content, /库存和门店营业状态/)
  assert.match(result.materials[0].content, /后续新增入口必须复用/)
  assert.equal(store.materials.length, 1)
  assert.equal(result.parseJob.status, 'succeeded')
})

test('workspace route imports project package analysis into knowledge materials', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-codebase', name: '外部项目分析' }],
    materials: [],
    parseJobs: []
  })
  const routes = workspaceRoutes(store)

  const result = await routes['POST /api/workspace/materials/import-project-package']({
    projectId: 'project-codebase',
    fileName: 'crm-dashboard.zip',
    fileSize: 2048,
    scopes: ['routes', 'components', 'tokens', 'services', 'docs'],
    outputs: ['knowledge', 'structure', 'markdown'],
    files: [
      { path: 'package.json', content: '{"dependencies":{"vue":"^3.5.0","vite":"^5.0.0"}}' },
      { path: 'src/pages/CustomerList.vue', content: '<template><BaseButton>新增客户</BaseButton></template>' },
      { path: 'src/components/base/BaseButton.vue', content: 'defineProps({ variant: String, loading: Boolean })' },
      { path: 'src/services/customer.js', content: 'export function listCustomers(){ return request("/api/customers") }' },
      { path: 'src/styles/base.css', content: ':root { --color-primary: #222529; --space-md: 16px; }' },
      { path: 'README.md', content: '# CRM Dashboard\n\n客户管理后台。' }
    ]
  })

  assert.equal(result.summary.projectId, 'project-codebase')
  assert.equal(result.summary.sourceType, 'project-package')
  assert.equal(result.parseJob.status, 'succeeded')
  assert.ok(result.materials.length >= 5)
  assert.ok(result.materials.every((item) => item.projectId === 'project-codebase'))
  assert.ok(result.materials.every((item) => item.type === 'knowledge'))
  assert.ok(result.materials.some((item) => item.category === 'codebase-overview' && /Vue 3/.test(item.content)))
  assert.ok(result.materials.some((item) => item.category === 'component-spec' && /BaseButton/.test(item.title)))
  assert.ok(result.materials.some((item) => item.category === 'markdown-blueprint' && /# 项目包蓝图：crm-dashboard/.test(item.content)))

  const savedMaterials = listMaterials(store, { projectId: 'project-codebase', type: 'knowledge' })
  const jobs = listParseJobs(store, { projectId: 'project-codebase' })
  assert.equal(savedMaterials.length, result.materials.length)
  assert.equal(jobs[0].action, 'project-package-import')
  assert.equal(jobs[0].materialCount, result.materials.length)
})

test('workspace route restores material display content from chunks', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-knowledge', name: '知识项目' }],
    materials: [{
      id: 'material-chunk-only',
      projectId: 'project-knowledge',
      type: 'knowledge',
      category: 'markdown-blueprint',
      title: '知识条目 Markdown 汇总',
      content: '',
      notes: '只在 chunks 中保存正文',
      chunks: [{
        id: 'material-chunk-only-full',
        heading: '知识正文',
        text: '# 知识正文\n\n这里是从 chunks 恢复的完整 Markdown。'
      }]
    }]
  })
  const routes = workspaceRoutes(store)

  const listResult = await routes['GET /api/workspace/materials']({
    projectId: 'project-knowledge',
    type: 'knowledge'
  })
  const detailResult = await routes['GET /api/workspace/materials/:id']({ id: 'material-chunk-only' })
  const updatedResult = await routes['PATCH /api/workspace/materials/:id']({
    id: 'material-chunk-only',
    title: '知识条目 Markdown 汇总',
    type: 'knowledge',
    projectId: 'project-knowledge',
    content: ''
  })

  assert.match(listResult.materials[0].content, /# 知识正文/)
  assert.match(detailResult.material.content, /从 chunks 恢复的完整 Markdown/)
  assert.match(updatedResult.material.content, /从 chunks 恢复的完整 Markdown/)
  assert.match(store.materials[0].content, /从 chunks 恢复的完整 Markdown/)
})

test('workspace route starts and stops a project runtime preview', async () => {
  const calls = []
  const store = createWorkspaceStore({
    projects: [{ id: 'project-runtime', name: '可运行外部项目' }],
    parseJobs: []
  })
  const routes = workspaceRoutes(store, {
    projectRuntimeService: {
      start: async (payload) => {
        calls.push(['start', payload.fileName, payload.files.length])
        return {
          id: 'runtime-1',
          projectId: payload.projectId,
          url: 'http://127.0.0.1:4317',
          status: 'running',
          logs: ['npm install', 'npm run dev']
        }
      },
      stop: async (id) => {
        calls.push(['stop', id])
        return { id, status: 'stopped' }
      }
    }
  })

  const started = await routes['POST /api/workspace/project-runtime/start']({
    projectId: 'project-runtime',
    fileName: 'demo.zip',
    files: [
      { path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
      { path: 'src/App.vue', content: '<template />' }
    ]
  })
  const stopped = await routes['POST /api/workspace/project-runtime/stop']({ runtimeId: 'runtime-1' })

  assert.equal(started.runtime.url, 'http://127.0.0.1:4317')
  assert.equal(started.parseJob.action, 'project-runtime-start')
  assert.equal(started.parseJob.status, 'succeeded')
  assert.equal(stopped.runtime.status, 'stopped')
  assert.deepEqual(calls, [
    ['start', 'demo.zip', 2],
    ['stop', 'runtime-1']
  ])
})

test('workspace snapshot preserves prototype demo screenshots for preview playback', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-prototype-preview-'))
  try {
    const store = createWorkspaceStore({
      projects: [{ id: 'project-demo', name: 'Demo' }],
      assets: []
    })
    const routes = workspaceRoutes(store, { materialPreviewDir: join(dir, 'material-previews') })
    await routes['POST /api/workspace/assets']({
      id: 'asset-demo-prototype',
      projectId: 'project-demo',
      type: 'prototype-demo',
      title: 'Demo Prototype',
      prototypeDemo: {
        screens: [{
          id: 'home',
          title: 'Home',
          screenshotUrl: 'data:image/png;base64,aG9tZQ==',
          hotspots: []
        }]
      }
    })

    const snapshot = await routes['GET /api/workspace']()
    const asset = snapshot.assets.find((item) => item.id === 'asset-demo-prototype')

    assert.match(asset.prototypeDemo.screens[0].screenshotUrl, /^\/api\/workspace\/material-previews\/asset-demo-prototype-home-/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('workspace route persists uploaded prototype demo screenshots as durable attachment URLs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-prototype-screenshots-'))
  const filePath = join(dir, 'workspace.local.json')
  const previewDir = join(dir, 'material-previews')

  try {
    const store = createWorkspaceStore({
      projects: [{ id: 'project-demo', name: 'Demo' }],
      assets: []
    }, { filePath })
    const routes = workspaceRoutes(store, { materialPreviewDir: previewDir })

    const saved = await routes['POST /api/workspace/assets']({
      id: 'asset-demo-prototype',
      projectId: 'project-demo',
      type: 'prototype-demo',
      title: 'Demo Prototype',
      prototypeDemo: {
        screens: [{
          id: 'home',
          title: 'Home',
          screenshotUrl: 'data:image/png;base64,aG9tZQ==',
          hotspots: []
        }],
        screenshotAssets: [{
          id: 'home-manual-screenshot',
          screenId: 'home',
          screenshotUrl: 'data:image/png;base64,aG9tZQ==',
          storage: 'local-upload'
        }]
      }
    })

    const screenshotUrl = saved.asset.prototypeDemo.screens[0].screenshotUrl
    assert.match(screenshotUrl, /^\/api\/workspace\/material-previews\/asset-demo-prototype-home-/)
    assert.equal(saved.asset.prototypeDemo.screenshotAssets[0].screenshotUrl, screenshotUrl)
    assert.equal(saved.asset.prototypeDemo.screenshotAssets[0].storage, 'workspace-database')

    const snapshot = await routes['GET /api/workspace']()
    assert.equal(snapshot.assets[0].prototypeDemo.screens[0].screenshotUrl, screenshotUrl)

    const fileName = decodeURIComponent(screenshotUrl.split('/').pop())
    await rm(previewDir, { recursive: true, force: true })
    const previewFile = await routes['GET /api/workspace/material-previews/:fileName']({ fileName })
    assert.equal(previewFile.contentType, 'image/png')
    assert.deepEqual(previewFile.body, Buffer.from('home'))

    const persisted = JSON.parse(await readFile(filePath, 'utf8'))
    assert.equal(persisted.assets[0].prototypeDemo.screens[0].screenshotUrl, screenshotUrl)
    assert.match(persisted.assets[0].prototypeDemo.screens[0].storageDataUrl, /^data:image\/png;base64,/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('workspace store persistence keeps durable prototype screenshot URLs and removes inline data URLs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-prototype-persistence-'))
  const filePath = join(dir, 'workspace.local.json')

  try {
    const durableUrl = '/api/workspace/material-previews/asset-demo-home-abc123.png'
    const store = createWorkspaceStore({
      projects: [{ id: 'project-demo', name: 'Demo' }],
      assets: [{
        id: 'asset-demo-prototype',
        projectId: 'project-demo',
        type: 'prototype-demo',
        title: 'Demo Prototype',
        prototypeDemo: {
          screens: [
            { id: 'home', title: 'Home', screenshotUrl: durableUrl, hotspots: [] },
            { id: 'pricing', title: 'Pricing', screenshotUrl: 'data:image/png;base64,cHJpY2luZw==', hotspots: [] }
          ]
        }
      }]
    }, { filePath })

    await store.persist()

    const persisted = JSON.parse(await readFile(filePath, 'utf8'))
    const screens = persisted.assets[0].prototypeDemo.screens
    assert.equal(screens[0].screenshotUrl, durableUrl)
    assert.equal(screens[1].screenshotUrl, '')
    assert.doesNotMatch(JSON.stringify(persisted), /data:image\/png;base64/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('workspace route deletes project assets so stale blueprints cannot be rehydrated', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-demo', name: 'Demo' }],
    assets: []
  })
  const routes = workspaceRoutes(store)
  await routes['POST /api/workspace/assets']({
    id: 'asset-stale-blueprint',
    projectId: 'project-demo',
    type: 'blueprint',
    title: 'Stale Blueprint',
    blueprint: { title: 'Stale Blueprint' }
  })

  const deleted = await routes['DELETE /api/workspace/assets/:id']({ id: 'asset-stale-blueprint' })
  const snapshot = await routes['GET /api/workspace']()

  assert.deepEqual(deleted, { id: 'asset-stale-blueprint', deleted: true })
  assert.equal(snapshot.assets.some((item) => item.id === 'asset-stale-blueprint'), false)
})

test('workspace route imports project package blueprint and prototype demo assets', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-jogg', name: 'Jogg' }],
    assets: [],
    materials: [],
    parseJobs: []
  })
  const routes = workspaceRoutes(store)
  const blueprint = {
    title: 'Jogg Interaction Blueprint',
    profile: { productName: 'Jogg', primaryGoal: '生成 AI Video Podcast' },
    framework: {
      title: 'Jogg 产品结构',
      children: [
        { title: 'Home', children: [{ title: 'Video Podcast 创建入口' }] },
        { title: 'Studio', children: [{ title: '编辑与渲染' }] }
      ]
    },
    pages: [
      {
        id: 'home-video-podcast',
        title: '首页 Video Podcast',
        actions: [{ label: 'Next', targetScreenId: 'studio-initial' }]
      },
      { id: 'studio-initial', title: 'Studio 初始页', actions: [] }
    ],
    flows: [
      { id: 'home-to-studio', title: '首页创建到 Studio', steps: ['填写内容', '登录检查', '创建任务', '进入 Studio'] }
    ]
  }
  const prototypeDemo = {
    source: 'jogg-local-export',
    screens: [
      {
        id: 'home-video-podcast',
        title: '首页 Video Podcast',
        screenshotUrl: 'screenshots/01-home-video-podcast.png',
        hotspots: [{
          id: 'home-next',
          label: 'Next',
          targetScreenId: 'studio-initial',
          rect: { x: 86, y: 62, width: 6, height: 6 }
        }]
      },
      {
        id: 'studio-initial',
        title: 'Studio 初始页',
        screenshotUrl: 'screenshots/03-studio-initial.png',
        hotspots: []
      }
    ],
    transitions: [{ id: 'home-to-studio', from: 'home-video-podcast', to: 'studio-initial', label: 'Next' }]
  }

  const result = await routes['POST /api/workspace/materials/import-project-package']({
    projectId: 'project-jogg',
    fileName: 'jogg-knowledge-export.zip',
    outputs: ['knowledge', 'structure', 'prototype', 'markdown'],
    files: [
      { path: 'blueprint.json', content: JSON.stringify(blueprint) },
      { path: 'prototype-demo.json', content: JSON.stringify(prototypeDemo) },
      { path: 'screenshots/01-home-video-podcast.png', content: 'data:image/png;base64,aG9tZQ==' },
      { path: 'screenshots/03-studio-initial.png', content: 'data:image/png;base64,c3R1ZGlv' },
      { path: 'materials/user-flows.md', content: '# User Flows\n\n首页进入 Studio。' }
    ]
  })

  assert.equal(result.blueprintAsset.projectId, 'project-jogg')
  assert.equal(result.blueprintAsset.type, 'blueprint')
  assert.equal(result.blueprintAsset.blueprint.title, 'Jogg Interaction Blueprint')
  assert.equal(result.prototypeAsset.projectId, 'project-jogg')
  assert.equal(result.prototypeAsset.type, 'prototype-demo')
  assert.equal(result.prototypeAsset.prototypeDemo.screens.length, 2)
  assert.match(result.prototypeAsset.prototypeDemo.screens[0].screenshotUrl, /^\/api\/workspace\/material-previews\/asset-/)
  assert.equal(result.prototypeAsset.prototypeDemo.screens[0].hotspots[0].targetScreenId, 'studio-initial')
  assert.ok(store.assets.some((asset) => asset.id === result.blueprintAsset.id && asset.blueprint))
  assert.ok(store.assets.some((asset) => asset.id === result.prototypeAsset.id && asset.prototypeDemo))
  assert.equal(result.parseJob.materialCount, result.materials.length + 2)
})

test('workspace route stores imported project package prototype screenshots as durable files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-package-prototype-images-'))
  const filePath = join(dir, 'workspace.local.json')
  const previewDir = join(dir, 'material-previews')

  try {
    const store = createWorkspaceStore({
      projects: [{ id: 'project-jogg', name: 'Jogg' }],
      assets: [],
      materials: [],
      parseJobs: []
    }, { filePath })
    const routes = workspaceRoutes(store, { materialPreviewDir: previewDir })

    const result = await routes['POST /api/workspace/materials/import-project-package']({
      projectId: 'project-jogg',
      fileName: 'jogg-workflow-knowledge-import.zip',
      files: [
        {
          path: 'blueprint.json',
          content: JSON.stringify({
            project: { name: 'Jogg / PodcastorAI' },
            entryTree: [
              { id: 'home', title: 'Home', path: '/', children: ['tool-ai-video-podcast-generator'] },
              { id: 'tool-ai-video-podcast-generator', title: 'AI Video Podcast Generator', path: '/tools/ai-video-podcast-generator' }
            ]
          })
        },
        {
          path: 'prototype-demo.json',
          content: JSON.stringify({
            screens: [
              { id: 'home', title: 'Home', screenshotUrl: 'screenshots/home.png', hotspots: [] },
              { id: 'tool-ai-video-podcast-generator', title: 'AI Video Podcast Generator', screenshotUrl: 'screenshots/tool-ai-video-podcast-generator.png', hotspots: [] }
            ]
          })
        },
        { path: 'screenshots/home.png', content: 'data:image/png;base64,aG9tZQ==' },
        { path: 'screenshots/tool-ai-video-podcast-generator.png', content: 'data:image/png;base64,dG9vbA==' }
      ]
    })

    const screens = result.prototypeAsset.prototypeDemo.screens
    assert.equal(screens.length, 2)
    assert.match(screens[0].screenshotUrl, /^\/api\/workspace\/material-previews\/asset-/)
    assert.match(screens[1].screenshotUrl, /^\/api\/workspace\/material-previews\/asset-/)
    assert.doesNotMatch(screens[0].screenshotUrl, /^data:image\//)

    const fileName = decodeURIComponent(screens[0].screenshotUrl.split('/').pop())
    const image = await routes['GET /api/workspace/material-previews/:fileName']({ fileName })
    assert.equal(image.contentType, 'image/png')
    assert.deepEqual(image.body, Buffer.from('home'))

    const persisted = JSON.parse(await readFile(filePath, 'utf8'))
    assert.equal(persisted.assets[0].prototypeDemo.screens.length, 2)
    assert.doesNotMatch(JSON.stringify(persisted.assets[0].prototypeDemo.screens), /data:image\/png/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('workspace route normalizes lightweight workflow project package schema', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-podcastor', name: 'Podcastor AI Web' }],
    materials: [],
    assets: [],
    parseJobs: []
  })
  const routes = workspaceRoutes(store)
  const blueprint = {
    schemaVersion: 'workflow-project-package/v1',
    project: {
      id: 'podcastor-ai-web',
      name: 'Podcastor AI Web'
    },
    entryTree: {
      root: {
        id: 'app',
        label: 'Podcastor Web App',
        children: [
          {
            id: 'home',
            label: 'Home / Video Podcast',
            route: '/',
            materials: ['materials/navigation.md'],
            screenshots: ['screenshots/01-home-video-podcast.png'],
            children: [{ id: 'home-next', label: 'Next', action: 'createPodcastVideoTask' }]
          }
        ]
      }
    },
    flowGraph: {
      nodes: [
        { id: 'n-home', label: 'Open Home', type: 'page', route: '/' },
        { id: 'n-studio', label: 'Enter Studio', type: 'page', route: '/studio' }
      ],
      edges: [{ from: 'n-home', to: 'n-studio', label: 'task created' }]
    }
  }
  const prototypeDemo = {
    screens: [{
      id: 'home',
      title: 'Home / Video Podcast',
      route: '/',
      image: 'screenshots/01-home-video-podcast.png',
      hotspots: [{
        id: 'home-next',
        label: 'Next',
        rect: { x: 0.8, y: 0.6, w: 0.1, h: 0.08 },
        action: { type: 'guardedNavigate', targetScreen: 'studio' }
      }]
    }, {
      id: 'studio',
      title: 'Studio',
      route: '/studio',
      image: 'screenshots/03-studio-initial.png',
      hotspots: []
    }]
  }

  const result = await routes['POST /api/workspace/materials/import-project-package']({
    projectId: 'project-podcastor',
    fileName: 'workflow-project-package.zip',
    files: [
      { path: 'workflow-project-package/blueprint.json', content: JSON.stringify(blueprint) },
      { path: 'workflow-project-package/prototype-demo.json', content: JSON.stringify(prototypeDemo) },
      { path: 'workflow-project-package/screenshots/01-home-video-podcast.png', content: 'data:image/png;base64,aG9tZQ==' },
      { path: 'workflow-project-package/screenshots/03-studio-initial.png', content: 'data:image/png;base64,c3R1ZGlv' },
      { path: 'workflow-project-package/materials/navigation.md', content: '# Navigation' }
    ]
  })

  assert.equal(result.blueprintAsset.blueprint.profile.productName, 'Podcastor AI Web')
  assert.equal(result.blueprintAsset.blueprint.framework.title, 'Podcastor Web App')
  assert.equal(result.blueprintAsset.blueprint.framework.children[0].title, 'Home / Video Podcast')
  assert.equal(result.blueprintAsset.blueprint.interactionTree.children[0].title, 'Open Home')
  assert.equal(result.blueprintAsset.blueprint.demoScreens.length, 2)
  assert.equal(result.blueprintAsset.blueprint.demoScreens[0].screenshotUrl, 'data:image/png;base64,aG9tZQ==')
  assert.match(result.prototypeAsset.prototypeDemo.screens[0].screenshotUrl, /^\/api\/workspace\/material-previews\/asset-/)
  assert.equal(result.prototypeAsset.prototypeDemo.screens[0].hotspots[0].targetScreenId, 'studio')
})

test('workspace store does not let stale analyzing workflow run overwrite analyzed result', async () => {
  const analyzedRun = createWorkspaceWorkflowRun({
    id: 'run-stale-overwrite',
    projectId: 'project-tea',
    workflowId: 'total-design-flow',
    status: 'analyzed',
    documentAnalysis: {
      status: 'analyzed',
      generation: {
        rawContent: '# 茶饮小程序方案\n\n## 产品定位\n完整模型回复。'
      },
      canvas: {
        nodes: [{ id: 'analysis', title: '分析结果' }],
        edges: [],
        orderedTabs: [{ key: 'analysis', label: '分析结果' }]
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          role: 'assistant',
          content: '# 茶饮小程序方案\n\n## 产品定位\n完整模型回复。',
          meta: { source: 'model' }
        }
      ]
    },
    referenceFiles: {
      analysis: [{ id: 'doc-1', name: '需求文档.md' }]
    }
  })
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [analyzedRun],
    materials: []
  })

  const persisted = await upsertWorkflowRun(store, {
    id: 'run-stale-overwrite',
    projectId: 'project-tea',
    workflowId: 'total-design-flow',
    status: 'analyzing',
    documentAnalysis: {
      status: 'analyzing',
      canvas: {
        nodes: [{ id: 'model-generating', title: '模型分析中', loading: true }],
        edges: [],
        orderedTabs: [{ key: 'model-generating', label: '模型分析中' }]
      }
    },
    agentSessions: {},
    referenceFiles: {}
  })

  assert.equal(persisted.status, 'analyzed')
  assert.equal(store.workflowRuns[0].status, 'analyzed')
  assert.match(store.workflowRuns[0].documentAnalysis.generation.rawContent, /完整模型回复/)
  assert.equal(store.workflowRuns[0].documentAnalysis.canvas.nodes[0].id, 'analysis')
  assert.equal(store.workflowRuns[0].agentSessions['requirement-dissection'][0].meta.source, 'model')
  assert.equal(store.workflowRuns[0].referenceFiles.analysis[0].name, '需求文档.md')
})

test('workspace store normalizes analyzing run with persisted model reply and canvas to analyzed', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [],
    materials: []
  })

  const persisted = await upsertWorkflowRun(store, {
    id: 'run-complete-but-analyzing',
    projectId: 'project-tea',
    workflowId: 'total-design-flow',
    status: 'analyzing',
    documentAnalysis: {
      status: 'streaming',
      canvas: {
        nodes: [{ id: 'analysis', title: '茶饮点单小程序产品方案' }],
        edges: [],
        orderedTabs: [{ key: 'analysis', label: '方案' }]
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          role: 'assistant',
          content: '# 茶饮点单小程序产品方案\n\n## 产品定位\n完整模型回复。',
          meta: { source: 'model', transient: false }
        }
      ]
    }
  })

  assert.equal(persisted.status, 'analyzed')
  assert.equal(store.workflowRuns[0].status, 'analyzed')
})

test('workspace store normalizes analyzing run with completed canvas even before markdown reply persists', async () => {
  const store = createWorkspaceStore({
    projects: [{ id: 'project-tea', name: '茶饮项目' }],
    workflowRuns: [],
    materials: []
  })

  const persisted = await upsertWorkflowRun(store, {
    id: 'run-completed-canvas-no-reply',
    projectId: 'project-tea',
    workflowId: 'total-design-flow',
    status: 'analyzing',
    documentAnalysis: {
      status: 'failed',
      canvas: {
        nodes: [{ id: 'analysis', title: '茶饮点单小程序产品方案', loading: false }],
        edges: [],
        orderedTabs: [{ key: 'analysis', label: '方案' }]
      }
    },
    agentSessions: {
      'requirement-dissection': [
        {
          role: 'assistant',
          content: '正在连接模型...',
          meta: { source: 'model', transient: true, status: 'generating' }
        }
      ]
    }
  })

  assert.equal(persisted.status, 'analyzed')
  assert.equal(store.workflowRuns[0].status, 'analyzed')
})

test('workspace store persists restored page html while compacting preview and workflow detail fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-store-compact-'))
  const filePath = join(dir, 'workspace.local.json')
  const largeImage = `data:image/png;base64,${'x'.repeat(1000)}`
  const largeHtml = `<html>${'h'.repeat(1000)}</html>`
  const largeAnalysis = 'analysis-detail'.repeat(3000)

  try {
    const store = createWorkspaceStore({
      projects: [{ id: 'project-heavy', name: '重数据项目' }],
      materials: [{
        id: 'material-heavy',
        projectId: 'project-heavy',
        type: 'requirements',
        title: '大预览资料',
        content: '可检索正文',
        preview: largeImage
      }],
      restoredPages: [{
        id: 'restored-heavy',
        projectId: 'project-heavy',
        html: largeHtml,
        coverImage: largeImage,
        files: [{ path: 'index.html', content: largeHtml }],
        captureResult: { screenshot: largeImage }
      }],
      workflowRuns: [createWorkspaceWorkflowRun({
        id: 'run-heavy',
        projectId: 'project-heavy',
        status: 'analyzed',
        input: '大体积流程',
        documentAnalysis: {
          status: 'analyzed',
          rawContent: largeAnalysis,
          blueprint: {
            title: '重复蓝图',
            raw: largeAnalysis,
            profile: { productName: '重数据项目', sourceSummary: largeAnalysis }
          },
          canvas: { nodes: [{ id: 'analysis', title: '分析结果' }], edges: [], orderedTabs: [] },
          versions: [{
            id: 'version-heavy',
            snapshot: { rawContent: largeAnalysis }
          }]
        },
        referenceFiles: {
          analysis: [{ id: 'doc-heavy', name: '需求.md', text: largeAnalysis }]
        }
      })],
      settings: [{
        id: 'setting-heavy',
        group: 'model',
        value: { screenshot: largeImage, notes: largeAnalysis }
      }]
    }, { filePath })

    await store.persist()
    const persisted = await readFile(filePath, 'utf8')

    assert.doesNotMatch(persisted, new RegExp('x'.repeat(1000)))
    assert.doesNotMatch(persisted, /analysis-detailanalysis-detail/)
    const parsed = JSON.parse(persisted)
    assert.equal(parsed.restoredPages[0].html, largeHtml)
    assert.equal(parsed.restoredPages[0].files[0].content, largeHtml)
    assert.equal(parsed.restoredPages[0].coverImage, '')
    assert.equal(parsed.restoredPages[0].visualVerification, null)
    assert.equal(parsed.materials[0].preview, '')
    assert.equal(parsed.workflowRuns[0].documentAnalysis.rawContent, '')
    assert.equal(parsed.workflowRuns[0].documentAnalysis.blueprint.title, '重复蓝图')
    assert.equal(parsed.workflowRuns[0].documentAnalysis.blueprint.raw, undefined)
    assert.deepEqual(parsed.workflowRuns[0].documentAnalysis.versions, [])
    assert.equal(parsed.workflowRuns[0].documentAnalysis.canvas.nodes[0].id, 'analysis')
    assert.equal(parsed.workflowRuns[0].referenceFiles.analysis[0].text, '')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('workspace document import stores Word preview as a durable attachment URL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-material-preview-'))
  const filePath = join(dir, 'workspace.local.json')
  const previewDir = join(dir, 'material-previews')
  const docxBytes = Buffer.from('fake-docx-with-image-bytes')
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBytes.toString('base64')}`

  try {
    const store = createWorkspaceStore({
      projects: [{ id: 'project-doc-preview', name: '文档预览项目' }],
      materials: []
    }, { filePath })
    const routes = workspaceRoutes(store, { materialPreviewDir: previewDir })

    const imported = await routes['POST /api/workspace/materials/import-documents']({
      projectId: 'project-doc-preview',
      type: 'requirements',
      documents: [{
        id: 'doc-with-image',
        name: '带图需求.docx',
        type: 'docx',
        content: '正文可解析',
        preview: {
          format: 'docx',
          fileName: '带图需求.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dataUrl
        }
      }]
    })

    const material = imported.materials[0]
    assert.equal(material.preview.format, 'docx')
    assert.match(material.preview.url, /^\/api\/workspace\/material-previews\/material-/)
    assert.equal(material.preview.dataUrl, '')

    const overview = await routes['GET /api/workspace']()
    assert.equal(overview.materials[0].preview.url, material.preview.url)
    assert.equal(overview.materials[0].preview.dataUrl, '')

    const detail = await routes['GET /api/workspace/materials/:id']({ id: material.id })
    assert.equal(detail.material.preview.url, material.preview.url)

    const fileName = decodeURIComponent(material.preview.url.split('/').pop())
    await rm(previewDir, { recursive: true, force: true })
    const previewFile = await routes['GET /api/workspace/material-previews/:fileName']({ fileName })
    assert.equal(previewFile.contentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    assert.deepEqual(previewFile.body, docxBytes)

    const persisted = JSON.parse(await readFile(filePath, 'utf8'))
    assert.equal(persisted.materials[0].preview.url, material.preview.url)
    assert.equal(persisted.materials[0].preview.dataUrl, '')
    assert.match(persisted.materials[0].preview.storageDataUrl, /^data:application\/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
