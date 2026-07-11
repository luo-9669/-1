import test from 'node:test'
import assert from 'node:assert/strict'

import { analyzeRequirementDocuments } from '../backend/services/document-parser.js'
import { buildTotalDesignFlow } from '../backend/services/total-design-flow.js'

test('Video Podcast homepage shortcut pages do not fall back to tea ordering wireframes', () => {
  const baseAnalysis = analyzeRequirementDocuments({
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
          '填写文本、上传文件、粘贴链接，或选择 host、storytelling、duration、language。',
          '点击 Next 后沿用 checkOpenGuestLoginDialog，再进入 Studio。'
        ].join('\n')
      }
    ]
  })

  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
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
            {
              id: 'home-video-podcast',
              sliceId: 'home-prompt-shortcuts',
              title: '首页 Video Podcast',
              summary: '在主输入区附近新增快捷提示词展示。'
            },
            {
              id: 'video-podcast-alias',
              sliceId: 'home-prompt-shortcuts',
              title: 'Video Podcast 首页别名',
              summary: '保持 /video-podcast 与首页同样的提示词体验。'
            }
          ]
        }
      }
    }
  })

  const nodes = flow.stageCanvases['interaction-lofi'].nodes
  const homepageNodes = nodes
    .filter((node) => /Video Podcast|首页/.test(node.title || ''))
  const homepageWireframes = homepageNodes
    .map((node) => node.pageLayoutArtifact?.asciiWireframe || '')
    .join('\n\n')

  assert.equal(homepageNodes.length, 1)
  assert.match(homepageWireframes, /PodcastStep1|Generate Script|Upload Script|Upload Audio|快捷提示词/)
  assert.doesNotMatch(homepageWireframes, /门店选择|自提\/外卖|优惠券|热销商品|限时秒杀|点餐/)
})

test('Video Podcast prompt fallback slice is folded into homepage interaction details', () => {
  const baseAnalysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '我想在首页增加几个快捷输入提示词的功能，并且需要提示词配置与降级。',
    documents: [
      {
        name: '项目知识库：Jogg 首页 Video Podcast 创建入口',
        text: [
          '首页入口来自 / 或 /video-podcast，页面为 video-podcast/index.vue。',
          '左侧是 AppNavRail，首页主体是 PodcastStep1 输入面板。',
          '快捷提示词 Chips 位于 Topic/input composer 内部，点击后写入或追加到输入框。',
          '当远端提示词配置失败时使用本地默认 Chips 兜底，不能覆盖用户已输入内容。'
        ].join('\n')
      }
    ]
  })

  const flow = buildTotalDesignFlow({
    ...baseAnalysis,
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'home-prompt-shortcuts', title: '首页快捷提示词', goal: '在首页输入框内展示快捷提示词 Chips。' },
            { id: 'prompt-config-fallback', title: '提示词配置与降级', goal: '配置提示词来源、换一批、失败兜底和不可用状态。' }
          ],
          pages: [
            {
              id: 'home-video-podcast',
              sliceId: 'home-prompt-shortcuts',
              title: '首页 Video Podcast',
              summary: '在 PodcastStep1 输入区内展示快捷提示词。',
              interactionHotspots: [
                { target: 'Topic/input composer', operation: '输入 topic、script 或 URL。' },
                { target: '快捷提示词 Chips', operation: '点击后写入或追加到输入框，不覆盖用户已输入内容。' }
              ]
            }
          ]
        }
      }
    }
  })

  const nodes = flow.stageCanvases['interaction-lofi'].nodes
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].title, '首页 Video Podcast')
  assert.equal(nodes[0].sliceId, 'home-prompt-shortcuts')
  assert.deepEqual(nodes[0].relatedSliceIds, ['prompt-config-fallback'])
  assert.doesNotMatch(nodes.map((node) => node.title).join('\n'), /提示词配置与降级/)

  const interactionText = JSON.stringify(nodes[0].interactionSpecArtifact)
  assert.match(interactionText, /快捷提示词 Chips/)
  assert.match(interactionText, /换一批|默认 Chips|兜底|不覆盖用户已输入内容/)
})

test('AI creation business blocks become frontend user pages across lofi visual and html stages', () => {
  const flow = buildTotalDesignFlow({
    id: 'ai-creation-flow',
    input: '我想做一个 web AI工具，用户可以在首页快速开始生成图片和视频，并查看作品、模板和我的额度。',
    blueprint: {
      title: 'web AI工具',
      profile: { productName: 'web AI工具' }
    },
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'ai-video-mvp', title: 'AI影像生成MVP', goal: '完成图片/视频生成主链路。' },
            { id: 'cost-risk', title: '成本与风控验证', goal: '控制额度、队列、敏感内容和失败重试。' },
            { id: 'commercial-explore', title: '商业化探索', goal: '验证订阅、额度和模板复用。' }
          ],
          pages: [
            { id: 'ai-video-mvp-frame', title: 'AI影像生成MVP框架', summary: '生成工作台、作品库和模板中心的总框架。' },
            { id: 'cost-risk-frame', title: '成本与风控验证框架', summary: '额度、风控和队列验证。' },
            { id: 'commercial-frame', title: '商业化探索框架', summary: '订阅、额度和商业化验证。' }
          ],
          stageCanvases: {
            'interaction-lofi': {
              nodes: [
                { id: 'model-ai-video-mvp', title: 'AI影像生成MVP框架', summary: '模型误把小需求作为低保页面。' },
                { id: 'model-cost-risk', title: '成本与风控验证框架', summary: '模型误把验证方向作为低保页面。' }
              ]
            },
            'ui-visual': {
              nodes: [
                { id: 'ui-model-ai-video-mvp', title: 'AI影像生成MVP框架 UI视觉', summary: '错误的业务大块视觉节点。' }
              ]
            },
            'html-output': {
              nodes: [
                { id: 'html-model-commercial', title: '商业化探索框架 HTML', summary: '错误的业务大块 HTML 节点。' }
              ]
            }
          }
        }
      }
    }
  })

  const badBlockPattern = /AI影像生成MVP框架|成本与风控验证框架|商业化探索框架/
  const lofiNodes = flow.stageCanvases['interaction-lofi'].nodes
  const visualNodes = flow.stageCanvases['ui-visual'].nodes
  const htmlNodes = flow.stageCanvases['html-output'].nodes
  const lofiTitles = lofiNodes.map((node) => node.title)
  const visualTitles = visualNodes.map((node) => node.title)
  const htmlTitles = htmlNodes.map((node) => node.title)

  assert.deepEqual(lofiTitles.slice(0, 6), ['首页', '生成工作台', '结果详情', '作品库', '模板中心', '任务队列'])
  assert.ok(lofiTitles.includes('我的'))
  assert.doesNotMatch([...lofiTitles, ...visualTitles, ...htmlTitles].join('\n'), badBlockPattern)
  assert.ok(visualTitles.some((title) => title === '首页 UI视觉'))
  assert.ok(htmlTitles.some((title) => title === '首页 HTML'))
  assert.ok(htmlTitles.some((title) => title === '总交互 HTML 预览'))

  const homeNode = lofiNodes.find((node) => node.title === '首页')
  assert.ok(homeNode?.pageLayoutArtifact?.asciiWireframe)
  assert.match(homeNode.pageLayoutArtifact.asciiWireframe, /首页/)
  assert.doesNotMatch(homeNode.pageLayoutArtifact.asciiWireframe, /###\s*2\./)
  assert.ok(homeNode.relatedSliceIds?.includes('ai-video-mvp'))
  assert.ok(homeNode.relatedSliceIds?.includes('commercial-explore'))
})

test('page layout artifact keeps only the current page from a multi-page model spec', () => {
  const flow = buildTotalDesignFlow({
    id: 'multi-page-layout-spec-flow',
    input: '做一个 AI 图片生成工具，需要首页、生成工作台和我的页面。',
    blueprint: {
      title: 'AI 图片生成工具',
      profile: { productName: 'AI 图片生成工具' }
    },
    generation: {
      status: 'generated',
      provider: 'unit-test-model',
      model: 'test-model',
      fallbackUsed: false,
      validation: { ok: true },
      output: {
        totalDesignFlow: {
          requirementSlices: [
            { id: 'main-flow', title: '生成主流程', goal: '完成用户前端生成链路。' }
          ],
          pages: [
            {
              id: 'generation-workbench',
              title: '生成工作台',
              summary: '用户输入提示词并发起生成。',
              pageLayoutSpec: {
                projectName: 'AI 图片生成工具',
                pages: [
                  { page: '首页', pageType: '入口页', layoutType: 'hero-input', modules: ['快捷开始', '最近作品'] },
                  { page: '生成工作台', pageType: '操作页', layoutType: 'form-workbench', modules: ['Prompt 输入', '素材上传', '生成按钮'] },
                  { page: '我的', pageType: '个人中心', layoutType: 'settings-list', modules: ['额度', '订阅'] }
                ]
              }
            }
          ]
        }
      }
    }
  })

  const workbenchNode = flow.stageCanvases['interaction-lofi'].nodes.find((node) => node.title === '生成工作台')
  const artifactText = workbenchNode?.pageLayoutArtifact?.asciiWireframe || ''

  assert.ok(workbenchNode?.pageLayoutArtifact)
  assert.match(artifactText, /生成工作台/)
  assert.match(artifactText, /Prompt 输入|素材上传|生成按钮/)
  assert.doesNotMatch(artifactText, /###\s*1\.\s*首页|最近作品|###\s*3\.\s*我的|订阅/)
})
