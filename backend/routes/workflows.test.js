import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { workflowRoutes } from './workflows.js'
import { createWorkspaceWorkflowRun } from '../models/workspace.js'
import { createWorkspaceStore } from '../services/workspace-store.js'

function createVisualCanvasRun(id = 'run-image-provider-settings', nodeId = 'ui-home') {
  return createWorkspaceWorkflowRun({
    id,
    title: '总流程',
    workflowId: 'total-design-flow',
    steps: [{ id: nodeId, title: '首页 UI视觉' }],
    currentStepId: nodeId,
    documentAnalysis: {
      canvas: {
        nodes: [{
          id: nodeId,
          stageId: 'ui-visual',
          title: '首页与选店 UI视觉',
          summary: '茶饮点单首页视觉。',
          targetGenerator: 'gpt-image-2',
          generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
          visualPreview: {
            imagePrompt: '为茶饮点单首页生成移动端高保真图。',
            imageStatus: 'pending',
            figmaReady: true
          }
        }],
        edges: [],
        orderedTabs: [{ key: nodeId, label: '首页与选店 UI视觉' }]
      },
      totalDesignFlow: {
        mode: 'total-design-flow',
        stages: [{ id: 'ui-visual', name: 'UI视觉' }],
        stageCanvases: {
          'ui-visual': {
            nodes: [{
              id: nodeId,
              stageId: 'ui-visual',
              title: '首页与选店 UI视觉',
              summary: '茶饮点单首页视觉。',
              targetGenerator: 'gpt-image-2',
              generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
              visualPreview: {
                imagePrompt: '为茶饮点单首页生成移动端高保真图。',
                imageStatus: 'pending',
                figmaReady: true
              }
            }],
            edges: [],
            orderedTabs: [{ key: nodeId, label: '首页与选店 UI视觉' }]
          }
        }
      }
    }
  })
}

test('workflow agent routes pass model timeout into non-stream replies', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-timeout',
    title: 'UX 确认',
    workflowId: 'ux-design-confirmation-skill',
    steps: [{ id: 'requirement-clarification', title: '需求澄清' }],
    currentStepId: 'requirement-clarification',
    agentSessions: {}
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    settings: [
      {
        key: 'workflowModelProvider',
        value: {
          enabled: true,
          provider: 'codex-cli',
          defaultModel: 'gpt-5.5',
          timeoutMs: 10,
          fallback: 'deterministic'
        }
      }
    ]
  })
  const routes = workflowRoutes(store, {
    agentProvider: {
      name: 'slow-provider',
      generate() {
        return new Promise(() => {})
      }
    },
    fallback: 'deterministic'
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/messages']({
    id: 'run-timeout',
    stepId: 'requirement-clarification',
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '卖绿茶的商城主要是线下转线上'
    }
  })

  assert.equal(result.assistantMessage.role, 'assistant')
  assert.equal(result.provider, 'deterministic')
  assert.equal(result.error.code, 'LLM_PROVIDER_TIMEOUT')
  assert.equal(result.run.agentSessions['requirement-clarification'].at(-1).role, 'assistant')
})

test('workflow agent routes use the longer configured timeout for chat replies', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-timeout-cap',
    title: 'UX 确认',
    workflowId: 'ux-design-confirmation-skill',
    steps: [{ id: 'requirement-clarification', title: '需求澄清' }],
    currentStepId: 'requirement-clarification',
    agentSessions: {}
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    settings: [
      {
        key: 'workflowModelProvider',
        value: {
          enabled: true,
          provider: 'codex-cli',
          defaultModel: 'gpt-5.5',
          timeoutMs: 20,
          fallback: 'deterministic'
        }
      }
    ]
  })
  const routes = workflowRoutes(store, {
    messageTimeoutMs: 10,
    agentProvider: {
      name: 'slow-provider',
      generate() {
        return new Promise(() => {})
      }
    },
    fallback: 'deterministic'
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/messages']({
    id: 'run-timeout-cap',
    stepId: 'requirement-clarification',
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '继续补充绿茶商城'
    }
  })

  assert.equal(result.provider, 'deterministic')
  assert.equal(result.error.code, 'LLM_PROVIDER_TIMEOUT')
  assert.equal(result.error.timeoutMs, 20)
})

test('workflow agent routes pass zero timeout through to provider context', async () => {
  let receivedTimeoutMs = null
  const run = createWorkspaceWorkflowRun({
    id: 'run-zero-timeout',
    title: 'UX 确认',
    workflowId: 'ux-design-confirmation-skill',
    steps: [{ id: 'requirement-clarification', title: '需求澄清' }],
    currentStepId: 'requirement-clarification',
    agentSessions: {}
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    settings: [
      {
        key: 'workflowModelProvider',
        value: {
          enabled: true,
          provider: 'codex-cli',
          defaultModel: 'gpt-5.5',
          timeoutMs: 20,
          fallback: 'deterministic'
        }
      }
    ]
  })
  const routes = workflowRoutes(store, {
    agentProvider: {
      name: 'capture-timeout-provider',
      async generate(context = {}) {
        receivedTimeoutMs = context.timeoutMs
        return {
          provider: 'capture-timeout-provider',
          model: context.model,
          content: '已收到需求，会继续生成下一步建议。'
        }
      }
    },
    fallback: 'deterministic'
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/messages']({
    id: 'run-zero-timeout',
    stepId: 'requirement-clarification',
    timeoutMs: 0,
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '继续补充绿茶商城'
    }
  })

  assert.equal(result.provider, 'capture-timeout-provider')
  assert.equal(receivedTimeoutMs, 0)
})

test('workflow html stage route runs as a workflow artifact job and does not create restored pages', async () => {
  let capturedContext = null
  const run = createWorkspaceWorkflowRun({
    id: 'route-html-stage-run',
    title: 'AI 视频爆款复刻 HTML',
    workflowId: 'total-design-flow',
    projectId: 'project-video',
    demandScope: 'project',
    steps: [],
    currentStepId: 'html-output',
    documentAnalysis: {
      canvas: { nodes: [], edges: [] },
      totalDesignFlow: {
        currentStage: 'html-output',
        stageCanvases: {
          'html-output': {
            nodes: [
              {
                id: 'html-home',
                stageId: 'html-output',
                title: '复刻首页 HTML',
                summary: '上传参考视频并生成拆解任务。',
                targetGenerator: 'html',
                artifactStatus: 'pending',
                generationActions: [{ id: 'generate-html', label: '生成 HTML', targetGenerator: 'html' }]
              }
            ],
            edges: []
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    restoredPages: [],
    materials: [
      {
        id: 'html-reference-md',
        projectId: 'project-video',
        type: 'knowledge',
        title: '项目 HTML 参考规范.md',
        category: 'HTML 生成规范',
        content: '# 项目 HTML 参考规范\n\n必须保留项目资产引用，不要创建网页工程资产。'
      }
    ]
  })
  const routes = workflowRoutes(store, {
    agentProvider: {
      name: 'route-html-provider',
      async generate(context) {
        capturedContext = context
        return {
          html: '<!doctype html><html><body><main>复刻首页 HTML</main></body></html>',
          provider: 'route-html-provider',
          model: context.model
        }
      }
    }
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/stages/html-output/generate']({
    id: 'route-html-stage-run',
    awaitCompletion: true,
    timeoutMs: 0
  })

  const htmlNode = result.analysis.totalDesignFlow.stageCanvases['html-output'].nodes[0]
  assert.equal(htmlNode.artifactStatus, 'generated')
  assert.match(htmlNode.codePreview.code, /<!doctype html>/)
  assert.equal(result.status.status, 'completed')
  assert.equal(store.restoredPages.length, 0)
  assert.match(capturedContext.userPrompt, /项目 HTML 参考规范/)
  assert.match(capturedContext.userPrompt, /不要创建网页工程资产/)
})

test('workflow agent routes fall back safely when workspace settings are missing', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-missing-settings',
    title: 'UX 确认',
    workflowId: 'ux-design-confirmation-skill',
    steps: [{ id: 'requirement-clarification', title: '需求澄清' }],
    currentStepId: 'requirement-clarification',
    agentSessions: {}
  })
  const routes = workflowRoutes({
    runs: [run]
  }, {
    agentProvider: {
      name: 'deterministic-test-provider',
      async generate() {
        return {
          provider: 'deterministic-test-provider',
          model: 'gpt-5.5',
          content: '已收到需求，会继续生成下一步建议。'
        }
      }
    }
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/messages']({
    id: 'run-missing-settings',
    stepId: 'requirement-clarification',
    model: 'gpt-5.5',
    message: {
      role: 'user',
      content: '继续补充这个需求'
    }
  })

  assert.equal(result.assistantMessage.role, 'assistant')
  assert.equal(result.run.agentSessions['requirement-clarification'].length, 2)
  assert.equal(result.provider, 'deterministic-test-provider')
})

test('workflow agent model call logging tolerates null active node context', async () => {
  const run = createWorkspaceWorkflowRun({
    id: 'run-null-active-node',
    title: '总流程',
    workflowId: 'total-design-flow',
    skillId: 'total-design-flow',
    steps: [],
    currentStepId: '',
    agentSessions: {
      'requirement-dissection': []
    }
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    modelCallLogs: []
  })
  const routes = workflowRoutes(store, {
    agentProvider: {
      name: 'deterministic-test-provider',
      async generate() {
        return {
          provider: 'deterministic-test-provider',
          model: 'gpt-5.5',
          content: '这是模型针对需求解剖阶段返回的完整回复。'
        }
      }
    }
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/messages']({
    id: 'run-null-active-node',
    stepId: '',
    model: 'gpt-5.5',
    context: {
      activeNode: null,
      canvasAction: null
    },
    message: {
      role: 'user',
      content: '继续分析茶饮点单小程序'
    }
  })

  assert.equal(result.assistantMessage.role, 'assistant')
  assert.equal(result.assistantMessage.content, '这是模型针对需求解剖阶段返回的完整回复。')
  assert.equal(store.modelCallLogs.length, 1)
  assert.equal(store.modelCallLogs[0].nodeId, '')
})

test('workflow artifact route uses workspace model settings as image provider', async () => {
  let capturedUrl = ''
  let capturedBody = null
  const run = createWorkspaceWorkflowRun({
    id: 'run-image-provider-settings',
    title: '总流程',
    workflowId: 'total-design-flow',
    steps: [{ id: 'ui-home', title: '首页 UI视觉' }],
    currentStepId: 'ui-home',
    documentAnalysis: {
      canvas: {
        nodes: [{
          id: 'ui-home',
          stageId: 'ui-visual',
          title: '首页与选店 UI视觉',
          summary: '茶饮点单首页视觉。',
          targetGenerator: 'gpt-image-2',
          generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
          visualPreview: {
            imagePrompt: '为茶饮点单首页生成移动端高保真图。',
            imageStatus: 'pending',
            figmaReady: true
          }
        }],
        edges: [],
        orderedTabs: [{ key: 'ui-home', label: '首页与选店 UI视觉' }]
      },
      totalDesignFlow: {
        mode: 'total-design-flow',
        stages: [{ id: 'ui-visual', name: 'UI视觉' }],
        stageCanvases: {
          'ui-visual': {
            nodes: [{
              id: 'ui-home',
              stageId: 'ui-visual',
              title: '首页与选店 UI视觉',
              summary: '茶饮点单首页视觉。',
              targetGenerator: 'gpt-image-2',
              generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
              visualPreview: {
                imagePrompt: '为茶饮点单首页生成移动端高保真图。',
                imageStatus: 'pending',
                figmaReady: true
              }
            }],
            edges: [],
            orderedTabs: [{ key: 'ui-home', label: '首页与选店 UI视觉' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    settings: [{
      key: 'workflowModelProvider',
      value: {
        enabled: true,
        provider: 'openai-compatible',
        apiKey: 'test-key',
        baseUrl: 'http://model.local/v1',
        defaultModel: 'gpt-5.5',
        imageModel: 'gpt-image-2',
        apiSurface: 'responses',
        timeoutMs: 20000
      }
    }]
  })
  const routes = workflowRoutes(store, {
    fetchImpl: async (url, init = {}) => {
      capturedUrl = url
      capturedBody = JSON.parse(init.body || '{}')
      return new Response(JSON.stringify({ data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
    id: 'run-image-provider-settings',
    nodeId: 'ui-home',
    generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  })

  const node = result.analysis.canvas.nodes[0]
  assert.equal(capturedUrl, 'http://model.local/v1/images/generations')
  assert.equal(capturedBody.size, '752x1632')
  assert.equal(node.artifactStatus, 'generated')
  assert.equal(node.visualPreview.imageStatus, 'generated')
  assert.equal(node.visualPreview.imageDataUrl, 'data:image/png;base64,ZmFrZS1pbWFnZQ==')
})

test('workflow artifact route passes zero timeout into image provider context', async () => {
  let receivedTimeoutMs = null
  const run = createVisualCanvasRun('run-image-zero-timeout', 'ui-home-zero-timeout')
  const store = createWorkspaceStore({
    workflowRuns: [run]
  })
  const routes = workflowRoutes(store, {
    imageProvider: {
      name: 'capture-image-timeout',
      async generate(context = {}) {
        receivedTimeoutMs = context.timeoutMs
        return {
          provider: 'capture-image-timeout',
          model: context.targetGenerator,
          imageDataUrl: 'data:image/png;base64,emVyby10aW1lb3V0'
        }
      }
    }
  })

  const result = await routes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
    id: 'run-image-zero-timeout',
    nodeId: 'ui-home-zero-timeout',
    timeoutMs: 0,
    generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
    targetGenerator: 'gpt-image-2'
  })

  const node = result.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
  assert.equal(receivedTimeoutMs, 0)
  assert.equal(node.artifactStatus, 'generated')
  assert.equal(node.visualPreview.imageDataUrl, 'data:image/png;base64,emVyby10aW1lb3V0')
})

test('workflow artifact route can use Codex proxy settings for image2 generation', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'workflow-codex-image-provider-'))
  const codexConfigPath = join(tempDir, 'config.toml')
  const codexAuthPath = join(tempDir, 'auth.json')
  await writeFile(codexConfigPath, [
    'model_provider = "newapi"',
    '',
    '[model_providers.newapi]',
    'base_url = "http://127.0.0.1:15721/v1"',
    'wire_api = "responses"',
    'requires_openai_auth = true',
    ''
  ].join('\n'))
  await writeFile(codexAuthPath, JSON.stringify({ OPENAI_API_KEY: 'PROXY_MANAGED' }))

  const run = createWorkspaceWorkflowRun({
    id: 'run-image-provider-codex-proxy',
    title: '总流程',
    workflowId: 'total-design-flow',
    steps: [{ id: 'ui-home-codex', title: '首页 UI视觉' }],
    currentStepId: 'ui-home-codex',
    documentAnalysis: {
      canvas: {
        nodes: [{
          id: 'ui-home-codex',
          stageId: 'ui-visual',
          title: '首页与选店 UI视觉',
          targetGenerator: 'gpt-image-2',
          generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
          visualPreview: {
            imagePrompt: '为茶饮点单首页生成移动端高保真图。',
            imageStatus: 'pending'
          }
        }],
        edges: [],
        orderedTabs: [{ key: 'ui-home-codex', label: '首页与选店 UI视觉' }]
      },
      totalDesignFlow: {
        mode: 'total-design-flow',
        stages: [{ id: 'ui-visual', name: 'UI视觉' }],
        stageCanvases: {
          'ui-visual': {
            nodes: [{
              id: 'ui-home-codex',
              stageId: 'ui-visual',
              title: '首页与选店 UI视觉',
              targetGenerator: 'gpt-image-2',
              generationActions: [{ id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' }],
              visualPreview: {
                imagePrompt: '为茶饮点单首页生成移动端高保真图。',
                imageStatus: 'pending'
              }
            }],
            edges: [],
            orderedTabs: [{ key: 'ui-home-codex', label: '首页与选店 UI视觉' }]
          }
        }
      }
    }
  })
  const store = createWorkspaceStore({
    workflowRuns: [run],
    settings: [{
      key: 'workflowModelProvider',
      value: {
        enabled: true,
        provider: 'codex-cli',
        defaultModel: 'gpt-5.5',
        imageModel: 'gpt-image-2',
        timeoutMs: 600000,
        codexConfigPath,
        codexAuthPath,
        ccSwitchDbPath: join(tempDir, 'missing-cc-switch.db')
      }
    }]
  })
  let capturedUrl = ''
  let capturedAuthorization = ''
  const routes = workflowRoutes(store, {
    fetchImpl: async (url, init = {}) => {
      capturedUrl = url
      capturedAuthorization = init.headers?.Authorization || ''
      return new Response(JSON.stringify({ data: [{ b64_json: 'Y29kZXgtcm91dGUtaW1hZ2U=' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  try {
    const result = await routes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
      id: 'run-image-provider-codex-proxy',
      nodeId: 'ui-home-codex',
      generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
      targetGenerator: 'gpt-image-2'
    })

    const node = result.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
    assert.equal(capturedUrl, 'http://127.0.0.1:15721/v1/images/generations')
    assert.equal(capturedAuthorization, 'Bearer PROXY_MANAGED')
    assert.equal(node.artifactStatus, 'generated')
    assert.equal(node.visualPreview.imageDataUrl, 'data:image/png;base64,Y29kZXgtcm91dGUtaW1hZ2U=')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('workflow artifact route sends knowledge preview screenshots as reference images', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'workflow-reference-preview-'))
  const previewFileName = 'project-home-reference.jpg'
  await writeFile(join(tempDir, previewFileName), 'knowledge-reference-image')
  const run = createVisualCanvasRun('run-image-provider-reference', 'ui-home-reference')
  run.demandScope = 'project'
  run.projectId = 'project-reference'
  const store = createWorkspaceStore({
    workflowRuns: [run],
    settings: [{
      key: 'workflowModelProvider',
      value: {
        enabled: true,
        provider: 'openai-compatible',
        apiKey: 'test-key',
        baseUrl: 'http://model.local/v1',
        imageModel: 'gpt-image-2',
        timeoutMs: 600000
      }
    }]
  })
  let capturedUrl = ''
  let capturedBody = null
  const routes = workflowRoutes(store, {
    materialPreviewDir: tempDir,
    fetchImpl: async (url, init = {}) => {
      capturedUrl = url
      capturedBody = init.body
      return new Response(JSON.stringify({ data: [{ b64_json: 'cm91dGUtcmVmZXJlbmNlLWltYWdl' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  try {
    const result = await routes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
      id: 'run-image-provider-reference',
      nodeId: 'ui-home-reference',
      generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
      targetGenerator: 'gpt-image-2',
      projectVisualContext: {
        source: 'project-knowledge',
        pages: [
          {
            title: '知识库首页截图',
            screenshotUrl: `/api/workspace/material-previews/${previewFileName}`,
            viewport: { width: 1280, height: 720 },
            components: ['左侧导航', '播客生成输入区']
          }
        ],
        notes: ['沿用知识库截图里的黑白紫品牌视觉。']
      }
    })

    const node = result.analysis.canvas.nodes[0]
    const entries = Array.from(capturedBody.entries())
    assert.equal(capturedUrl, 'http://model.local/v1/images/edits')
    assert.ok(capturedBody instanceof FormData)
    assert.ok(entries.some(([key, value]) => key === 'image[]' && value?.name === 'reference-1.jpg'))
    assert.equal(node.artifactStatus, 'generated')
    assert.equal(node.visualPreview.referenceImageCount, 1)
    assert.equal(node.artifact.referenceImages[0].sourceUrl, `/api/workspace/material-previews/${previewFileName}`)
    assert.equal(node.visualPreview.imageDataUrl, 'data:image/png;base64,cm91dGUtcmVmZXJlbmNlLWltYWdl')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('workflow artifact route persists generated visual images to local files', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'workflow-generated-images-'))
  const store = createWorkspaceStore({
    workflowRuns: [createVisualCanvasRun('run-image-file-persist')]
  })
  const routes = workflowRoutes(store, {
    generatedImageDir: tempDir,
    imageProvider: {
      name: 'file-image-provider',
      async generate() {
        return {
          imageDataUrl: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
          provider: 'file-image-provider',
          model: 'gpt-image-2'
        }
      }
    }
  })

  try {
    const result = await routes['POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact']({
      id: 'run-image-file-persist',
      nodeId: 'ui-home',
      generationAction: { id: 'generate-visual', label: '生成高保真图', targetGenerator: 'gpt-image-2' },
      targetGenerator: 'gpt-image-2'
    })

    const node = result.analysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
    assert.equal(node.artifactStatus, 'generated')
    assert.match(node.visualPreview.imageUrl, /^\/api\/workspace\/generated-images\/.+\.png$/)
    assert.match(node.artifact.imageUrl, /^\/api\/workspace\/generated-images\/.+\.png$/)
    assert.match(node.visualPreview.localImagePath, /workflow-generated-images-.+\.png$/)
    assert.equal(await readFile(node.visualPreview.localImagePath, 'utf8'), 'fake-image')

    const persistedNode = store.workflowRuns[0].documentAnalysis.totalDesignFlow.stageCanvases['ui-visual'].nodes[0]
    assert.equal(persistedNode.artifactStatus, 'generated')
    assert.equal(persistedNode.visualPreview.imageUrl, node.visualPreview.imageUrl)
    assert.equal(persistedNode.artifact.imageUrl, node.artifact.imageUrl)

    const imageResponse = await routes['GET /api/workspace/generated-images/:fileName']({
      fileName: node.visualPreview.imageUrl.split('/').pop()
    })
    assert.equal(imageResponse.contentType, 'image/png')
    assert.equal(imageResponse.body.toString('utf8'), 'fake-image')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
