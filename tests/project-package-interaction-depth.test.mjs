import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProjectPackageKnowledgeImport } from '../backend/services/project-package-import-service.js'
import { exportBlueprintMarkdown } from '../frontend/src/services/projectBlueprint.js'
import { enrichBlueprintWithPrototypeDemo } from '../frontend/src/services/prototypeDemo.js'

test('project package import preserves second-level prototype click details in blueprint and markdown', () => {
  const payload = {
    projectId: 'project-depth',
    fileName: 'depth-package.zip',
    files: [
      {
        path: 'depth-package/blueprint.json',
        content: JSON.stringify({
          project: { name: 'Depth App', purpose: 'Record nested interactions' },
          entryTree: {
            root: {
              id: 'app',
              label: 'Depth App',
              children: [
                {
                  id: 'studio',
                  label: 'Studio',
                  route: '/studio',
                  children: [
                    { id: 'studio-default', label: 'Studio default tab', route: '/studio' }
                  ]
                }
              ]
            }
          }
        })
      },
      {
        path: 'depth-package/prototype-demo.json',
        content: JSON.stringify({
          screens: [
            {
              id: 'studio',
              title: 'Studio Initial',
              route: '/studio',
              image: 'screenshots/studio.png',
              hotspots: [
                {
                  id: 'studio-generate-tab',
                  label: 'Generate Script',
                  rect: { x: 0.52, y: 0.25, w: 0.12, h: 0.05 },
                  action: {
                    type: 'selectTab',
                    value: 'generate-script',
                    guard: 'login'
                  }
                }
              ]
            }
          ]
        })
      },
      {
        path: 'depth-package/screenshots/studio.png',
        content: 'data:image/png;base64,studio'
      }
    ]
  }

  const result = buildProjectPackageKnowledgeImport(payload)
  const studioNode = result.blueprint.framework.children.find((node) => node.id === 'studio')
  const clickDetails = studioNode.children.find((node) => node.id === 'studio-click-details')
  const nestedStudioNode = studioNode.children.find((node) => node.id === 'studio-default')
  const generateAction = clickDetails.children.find((node) => node.id === 'studio-generate-tab')

  assert.equal(generateAction.title, 'Generate Script')
  assert.match(generateAction.meta, /类型：selectTab/)
  assert.match(generateAction.meta, /守卫：login/)
  assert.equal(nestedStudioNode.children.some((node) => node.title === '点击细节'), false)
  assert.equal(result.blueprint.demoScreens[0].actions[0].type, 'selectTab')
  assert.equal(result.blueprint.demoScreens[0].actions[0].value, 'generate-script')
  assert.equal(result.blueprint.demoScreens[0].actions[0].guard, 'login')

  const markdown = exportBlueprintMarkdown(result.blueprint)
  assert.match(markdown, /### Studio Initial/)
  assert.match(markdown, /Generate Script/)
  assert.match(markdown, /类型：selectTab/)
  assert.match(markdown, /守卫：login/)
  assert.match(markdown, /坐标：x=52%, y=25%, w=12%, h=5%/)
})

test('knowledge display can enrich an existing blueprint from its prototype demo asset without re-importing', () => {
  const enriched = enrichBlueprintWithPrototypeDemo(
    {
      framework: {
        id: 'app',
        title: 'Depth App',
        children: [
          {
            id: 'studio',
            title: 'Studio',
            route: '/studio',
            children: [
              { id: 'studio-notes', title: 'Notes', children: [] },
              { id: 'studio-default', title: 'Studio default tab', route: '/studio', children: [] }
            ]
          }
        ]
      },
      demoScreens: [
        {
          id: 'studio',
          title: 'Studio Initial',
          route: '/studio',
          actions: [
            { id: 'studio-next', label: 'Next', rect: { x: 860, y: 590, width: 50, height: 50 } }
          ]
        }
      ]
    },
    {
      type: 'prototype-demo',
      prototypeDemo: {
        screens: [
          {
            id: 'studio',
            title: 'Studio Initial',
            route: '/studio',
            hotspots: [
              {
                id: 'studio-next',
                label: 'Next',
                rect: { x: 86, y: 59, width: 5, height: 5 },
                action: { type: 'guardedAction', guard: 'login', name: 'create-project' }
              }
            ]
          }
        ]
      }
    }
  )

  const clickDetails = enriched.framework.children[0].children.find((node) => node.id === 'studio-click-details')
  const unrelatedChild = enriched.framework.children[0].children.find((node) => node.id === 'studio-notes')
  const nestedRouteChild = enriched.framework.children[0].children.find((node) => node.id === 'studio-default')
  assert.equal(clickDetails.children[0].id, 'studio-next')
  assert.match(clickDetails.children[0].meta, /类型：guardedAction/)
  assert.equal(unrelatedChild.children.some((node) => node.title === '点击细节'), false)
  assert.equal(nestedRouteChild.children.some((node) => node.title === '点击细节'), false)
  assert.equal(enriched.demoScreens[0].actions[0].guard, 'login')
  assert.equal(enriched.demoScreens[0].actions[0].name, 'create-project')
  assert.deepEqual(enriched.demoScreens[0].actions[0].rect, { x: 86, y: 59, width: 5, height: 5 })
  assert.match(exportBlueprintMarkdown(enriched), /Next -> create-project/)
})

test('project package import accepts standard interaction blueprint packages and deposits interaction knowledge', () => {
  const payload = {
    projectId: 'project-standard-blueprint',
    fileName: 'interaction-blueprint.zip',
    files: [
      {
        path: 'interaction-blueprint/interaction-blueprint.json',
        content: JSON.stringify({
          appName: 'ClipForge',
          metadata: { version: '1.0.0' },
          pages: [
            {
              id: 'home',
              title: 'AI Video Home',
              route: '/',
              screenshot: 'screens/home.png',
              hotspots: [
                {
                  id: 'home-create',
                  label: 'Create video',
                  rect: { x: 0.6, y: 0.72, width: 0.18, height: 0.07 },
                  action: { type: 'click', targetPageId: 'studio', result: '进入生成工作台' }
                }
              ]
            },
            {
              id: 'studio',
              title: 'Video Studio',
              route: '/studio',
              screenshot: 'screens/studio.png',
              hotspots: [
                {
                  id: 'studio-prompt',
                  label: 'Prompt input',
                  rect: { x: 18, y: 40, width: 54, height: 16 },
                  action: { type: 'input', field: 'prompt', value: '产品介绍视频', result: '更新生成按钮可用状态' }
                }
              ]
            }
          ],
          flows: [
            {
              id: 'create-video',
              name: '创建视频',
              steps: [
                { pageId: 'home', action: '点击 Create video', result: '进入生成工作台' },
                { pageId: 'studio', action: '输入 prompt', result: '可以提交生成' }
              ]
            }
          ],
          states: [
            { pageId: 'studio', state: 'loading', trigger: '提交生成', display: '任务进度条' }
          ],
          apiCalls: [
            { pageId: 'studio', method: 'POST', url: '/api/videos', trigger: 'Generate', responseSummary: '返回 taskId' }
          ]
        })
      },
      { path: 'interaction-blueprint/screens/home.png', content: 'data:image/png;base64,home' },
      { path: 'interaction-blueprint/screens/studio.png', content: 'data:image/png;base64,studio' }
    ]
  }

  const result = buildProjectPackageKnowledgeImport(payload)

  assert.equal(result.summary.hasBlueprint, true)
  assert.equal(result.summary.hasPrototypeDemo, true)
  assert.equal(result.blueprint.profile.productName, 'ClipForge')
  assert.equal(result.prototypeDemo.screens[0].screenshotUrl, 'data:image/png;base64,home')
  assert.equal(result.prototypeDemo.screens[0].hotspots[0].targetScreenId, 'studio')
  assert.equal(result.prototypeDemo.screens[1].hotspots[0].type, 'input')
  assert.ok(result.items.some((item) =>
    item.category === 'interaction-blueprint' &&
    /Create video/.test(item.content) &&
    /POST \/api\/videos/.test(item.content) &&
    /loading/.test(item.content)
  ))
})

test('project package import expands array entryTree id children into a framework root', () => {
  const result = buildProjectPackageKnowledgeImport({
    projectId: 'project-jogg-shape',
    fileName: 'jogg-workflow-knowledge-import.zip',
    files: [
      {
        path: 'jogg-workflow-knowledge-import/blueprint.json',
        content: JSON.stringify({
          project: { name: 'Jogg / PodcastorAI', packagePurpose: '流程通知识库导入包' },
          entryTree: [
            { id: 'home', title: 'Home', path: '/', children: ['video-podcast'] },
            { id: 'video-podcast', title: 'Video Podcast Home Alias', path: '/video-podcast' },
            { id: 'tools', title: 'Tools', path: '/tools', children: ['tool-ai-video-podcast-generator'] },
            { id: 'tool-ai-video-podcast-generator', title: 'AI Video Podcast Generator', path: '/tools/ai-video-podcast-generator' }
          ],
          flowGraph: {
            nodes: [
              { id: 'home', label: 'Home', type: 'page', route: '/' },
              { id: 'tool-ai-video-podcast-generator', label: 'AI Video Podcast Generator', type: 'page', route: '/tools/ai-video-podcast-generator' }
            ],
            edges: [{ from: 'home', to: 'tool-ai-video-podcast-generator', label: 'Explore tools' }]
          }
        })
      },
      {
        path: 'jogg-workflow-knowledge-import/prototype-demo.json',
        content: JSON.stringify({
          screens: [
            { id: 'home', title: 'Home', screenshotUrl: 'screenshots/home.png', hotspots: [] },
            { id: 'tool-ai-video-podcast-generator', title: 'AI Video Podcast Generator', screenshotUrl: 'screenshots/tool-ai-video-podcast-generator.png', hotspots: [] }
          ]
        })
      },
      { path: 'jogg-workflow-knowledge-import/screenshots/home.png', content: 'data:image/png;base64,home' },
      { path: 'jogg-workflow-knowledge-import/screenshots/tool-ai-video-podcast-generator.png', content: 'data:image/png;base64,tool' }
    ]
  })

  assert.equal(result.blueprint.framework.id, 'project-framework')
  assert.equal(result.blueprint.framework.children.length, 2)
  assert.equal(result.blueprint.framework.children[0].id, 'home')
  assert.equal(result.blueprint.framework.children[0].children[0].id, 'video-podcast')
  assert.equal(result.blueprint.framework.children[1].children[0].id, 'tool-ai-video-podcast-generator')
  assert.equal(result.prototypeDemo.screens[0].screenshotUrl, 'data:image/png;base64,home')
})

test('project package import keeps a complete source tree index beyond preview limits', () => {
  const files = [
    { path: 'jogg/package.json', content: '{"dependencies":{"nuxt":"latest"}}' },
    ...Array.from({ length: 18 }, (_, index) => ({
      path: `jogg/app/pages/page-${index + 1}/index.vue`,
      content: `<template><main>Page ${index + 1}</main></template>`
    })),
    ...Array.from({ length: 24 }, (_, index) => ({
      path: `jogg/app/components/Component${index + 1}.vue`,
      content: `<script setup>defineProps({ label: String })</script>`
    }))
  ]

  const result = buildProjectPackageKnowledgeImport({
    projectId: 'project-source-tree',
    fileName: 'jogg-frontend-source-export.zip',
    files
  })
  const sourceTree = result.items.find((item) => item.category === 'source-tree')

  assert.ok(sourceTree)
  assert.match(sourceTree.content, /完整文件数：43/)
  assert.match(sourceTree.content, /app\/pages\/page-18\/index.vue/)
  assert.match(sourceTree.content, /app\/components\/Component24.vue/)
  assert.equal(sourceTree.parsed.fileCount, 43)
})
