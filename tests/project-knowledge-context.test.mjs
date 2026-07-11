import assert from 'node:assert/strict'
import test from 'node:test'

import { createProject } from '../frontend/src/services/projectWorkspace.js'
import {
  buildProjectKnowledgeContextDocuments,
  selectProjectBlueprintAsset
} from '../frontend/src/services/projectKnowledgeContext.js'

test('project knowledge context prefers current project blueprint over stale project assets', () => {
  const project = createProject({
    id: 'project-jogg',
    name: 'jogg- podcast',
    domain: 'AI video podcast tools'
  })
  const stalePodcastor = {
    id: 'asset-podcastor',
    type: 'project-blueprint',
    title: 'Podcastor.ai 项目蓝图',
    updatedAt: '2026-07-05T05:54:28.994Z',
    blueprint: {
      title: 'Podcastor.ai 项目蓝图',
      profile: { productName: 'Podcastor.ai' },
      framework: { title: 'Podcastor.ai', children: [{ title: '首页创作入口' }] },
      demoScreens: [{ id: 'home', title: '首页创作入口' }]
    }
  }
  const joggBlueprint = {
    id: 'asset-jogg',
    type: 'blueprint',
    title: 'Jogg 交互流程蓝图',
    updatedAt: '2026-07-04T07:58:38.440Z',
    blueprint: {
      title: 'Jogg 交互流程蓝图',
      profile: { productName: 'Jogg' },
      framework: { title: 'Jogg', children: [{ title: 'AI Video Podcast Generator' }] },
      demoScreens: [{ id: 'tool-ai-video-podcast-generator', title: 'AI Video Podcast Generator' }]
    }
  }

  const selected = selectProjectBlueprintAsset([stalePodcastor, joggBlueprint], project)

  assert.equal(selected.id, 'asset-jogg')
})

test('project knowledge context documents include knowledge hub tabs for workflow grounding', () => {
  const project = createProject({
    id: 'project-jogg',
    name: 'jogg- podcast',
    domain: 'AI video podcast tools'
  })
  const blueprintAsset = {
    id: 'asset-jogg-blueprint',
    projectId: project.id,
    type: 'blueprint',
    title: 'Jogg 交互流程蓝图',
    blueprint: {
      title: 'Jogg 交互流程蓝图',
      profile: { productName: 'Jogg', positioning: 'AI video podcast generator' },
      framework: { title: 'Jogg', children: [{ title: 'AI Video Podcast Generator' }] },
      interactionTree: {
        title: 'Jogg 主流程',
        children: [{ title: 'Try Sample 后填充脚本', children: [{ title: 'Generate 进入登录门槛' }] }]
      },
      demoScreens: [{ id: 'generator', title: 'AI Video Podcast Generator', description: '输入脚本并生成视频播客' }]
    }
  }
  const prototypeAsset = {
    id: 'asset-jogg-prototype',
    projectId: project.id,
    type: 'prototype-demo',
    title: 'Jogg 实测完整点击链路 Demo',
    sourceAssetId: blueprintAsset.id,
    prototypeDemo: {
      screens: [
        {
          id: 'generator',
          title: 'AI Video Podcast Generator · 初始输入',
          screenshotUrl: '/workspace/jogg/generator.png',
          hotspots: [
            { id: 'try-sample', label: 'Try Sample', targetScreenId: 'sample-filled' }
          ]
        },
        {
          id: 'sample-filled',
          title: 'AI Video Podcast Generator · 样例已填充',
          screenshotUrl: '/workspace/jogg/sample.png',
          hotspots: [
            { id: 'generate', label: 'Generate', targetScreenId: 'login-gate' }
          ]
        }
      ],
      transitions: [{ from: 'generator', to: 'sample-filled', label: 'Try Sample' }]
    }
  }

  const documents = buildProjectKnowledgeContextDocuments({
    project,
    assets: [blueprintAsset, prototypeAsset],
    materials: [],
    query: '生成 Jogg 项目首页'
  })
  const sourceTypes = documents.map((item) => item.sourceType)
  const combined = documents.map((item) => item.content).join('\n')

  assert.ok(sourceTypes.includes('project-knowledge-framework'))
  assert.ok(sourceTypes.includes('project-knowledge-flow'))
  assert.ok(sourceTypes.includes('project-knowledge-prototype'))
  assert.ok(sourceTypes.includes('project-knowledge-markdown'))
  assert.match(combined, /AI Video Podcast Generator/)
  assert.match(combined, /Try Sample/)
  assert.match(combined, /\/workspace\/jogg\/generator\.png/)
})
