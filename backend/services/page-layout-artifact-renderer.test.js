import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildInteractionSpecArtifactFromPageLayoutArtifact,
  buildPageLayoutArtifactFromSpec,
  parsePageLayoutArtifactFromText,
  renderPageLayoutArtifactFromSpec,
  renderPageLayoutArtifactFromText
} from './page-layout-artifact-renderer.js'

test('builds structured page layout artifact object for canvas nodes', () => {
  const artifact = buildPageLayoutArtifactFromSpec({
    projectName: 'Podcastor.ai',
    pages: [
      {
        page: '登录页 Sign In',
        pageType: '认证与账号入口页面',
        layoutType: '左右分栏价值展示 + 右侧认证表单',
        topFixed: ['Podcastor.ai Logo', '返回原创作入口'],
        scrollModules: ['左侧创作价值与案例预览', 'Google 登录', 'Discord 登录', '邮箱登录表单'],
        bottomFixed: ['继续当前任务按钮'],
        overlays: ['OAuth 授权窗口', '账号合并提示'],
        interactions: ['Google 登录成功后回到原创作上下文'],
        frontendTasks: ['渲染左右分栏和移动端单列表单'],
        backendTasks: ['保存 redirect_uri/source/draft_id 回跳上下文']
      }
    ]
  })

  assert.equal(artifact.title, '页面骨架')
  assert.match(artifact.modelDecision, /登录页 Sign In/)
  assert.match(artifact.modelDecision, /认证与账号入口页面/)
  assert.match(artifact.asciiWireframe, /登录页 Sign In/)
  assert.match(artifact.asciiWireframe, /Google 登录/)
  assert.match(artifact.interactionDetails, /Google 登录成功后回到原创作上下文/)
  assert.deepEqual(artifact.frontendHandoff, ['渲染左右分栏和移动端单列表单'])
  assert.deepEqual(artifact.backendHandoff, ['保存 redirect_uri/source/draft_id 回跳上下文'])
  assert.match(artifact.rawText, /:::page-layout-artifact title="页面骨架"/)
  assert.equal(artifact.diagramData.projectName, 'Podcastor.ai')
  assert.equal(artifact.version, 'page-layout-artifact/v2')
  assert.deepEqual(artifact.sourcePriority, ['screenshot', 'source', 'knowledge', 'agent', 'fallback'])
  assert.equal(artifact.layout.version, 'page-layout-structured/v2')
  assert.deepEqual(artifact.layout.viewport, { width: 1440, height: 900, unit: 'px', variant: 'desktop' })
  assert.ok(artifact.layout.regions.some((region) => region.id === 'top-fixed' && region.type === 'fixed-header'))
  assert.ok(artifact.layout.regions.some((region) => region.id === 'scroll-body' && region.type === 'scroll-body'))
  assert.ok(artifact.layout.regions.some((region) => region.id === 'bottom-fixed' && region.type === 'fixed-footer'))
  assert.ok(artifact.layout.states.some((state) => state.id === 'loading'))
  assert.ok(artifact.evidenceRefs.some((ref) => ref.id === 'layout-spec'))
})

test('does not build page layout artifact object from empty model layout spec', () => {
  assert.equal(buildPageLayoutArtifactFromSpec({ pages: [] }), null)
  assert.equal(buildPageLayoutArtifactFromSpec(null), null)
})

test('renders model PageLayoutSpec with detailed legacy ASCII wireframe', () => {
  const artifact = renderPageLayoutArtifactFromSpec({
    projectName: '茶饮小程序',
    pages: [
      {
        page: '点餐',
        layoutType: 'left-right-menu',
        topFixed: ['门店', '搜索', '自提/外卖切换'],
        scrollModules: ['左侧分类', '右侧商品列表', '商品卡片'],
        bottomFixed: ['购物车悬浮栏', '去结算按钮'],
        overlays: ['规格选择弹窗'],
        interactions: ['分类点击切换', '加购弹规格选择', '右侧商品列表纵向滚动']
      }
    ]
  })

  assert.match(artifact, /:::page-layout-artifact title="页面骨架"/)
  assert.match(artifact, /## ASCII 页面线框图/)
  assert.match(artifact, /点餐菜单页（左右分栏特殊框架）/)
  assert.match(artifact, /左图右文商品卡/)
  assert.match(artifact, /价格 \+ 加购按钮/)
  assert.match(artifact, /规格弹窗容器/)
  assert.match(artifact, /## 模块交互明细/)
  assert.match(artifact, /分类点击切换/)
  assert.match(artifact, /## 前后端交付/)
  assert.match(artifact, /前端：/)
  assert.match(artifact, /后端：/)
})

test('renders tea menu and product detail as different wireframe layouts', () => {
  const menuArtifact = buildPageLayoutArtifactFromSpec({
    projectName: '茶饮小程序',
    pages: [
      {
        page: '点单首页',
        layoutType: '左右分栏菜单 + 悬浮购物车',
        scrollModules: ['左侧分类', '右侧商品列表', '商品卡片'],
        bottomFixed: ['悬浮购物车', '去结算按钮'],
        overlays: ['规格选择弹窗']
      }
    ]
  })
  const detailArtifact = buildPageLayoutArtifactFromSpec({
    projectName: '茶饮小程序',
    pages: [
      {
        page: '商品详情',
        layoutType: '商品大图 + 规格定制表单 + 底部加购',
        scrollModules: ['商品大图', '规格选择', '糖冰温度', '加料列表', '数量步进器'],
        bottomFixed: ['加入购物车', '立即结算'],
        overlays: ['会员价说明弹窗']
      }
    ]
  })

  assert.notEqual(menuArtifact.asciiWireframe, detailArtifact.asciiWireframe)
  assert.match(menuArtifact.asciiWireframe, /左右分栏主体/)
  assert.match(menuArtifact.asciiWireframe, /左固定/)
  assert.match(detailArtifact.asciiWireframe, /商品详情页/)
  assert.match(detailArtifact.asciiWireframe, /商品大图/)
  assert.match(detailArtifact.asciiWireframe, /规格选择/)
  assert.match(detailArtifact.asciiWireframe, /甜度/)
  assert.match(detailArtifact.asciiWireframe, /加入购物车/)
  assert.doesNotMatch(detailArtifact.asciiWireframe, /点餐菜单页（左右分栏特殊框架）/)
})

test('extracts PageLayoutSpec JSON from model text and renders artifact', () => {
  const text = [
    '下面是结构化方案：',
    '```json',
    JSON.stringify({
      pageLayoutSpec: {
        projectName: '茶饮小程序',
        pages: [
          {
            page: '我的',
            layoutType: 'member-dashboard-grid',
            topFixed: ['用户信息', '会员等级'],
            scrollModules: ['会员资产', '营销入口', '工具入口'],
            bottomFixed: ['底部Tab'],
            overlays: ['登录弹窗'],
            interactions: ['点击会员资产进入明细', '点击宫格跳转功能页']
          }
        ]
      }
    }, null, 2),
    '```'
  ].join('\n')

  const artifact = renderPageLayoutArtifactFromText(text)

  assert.match(artifact, /我的 页面框架/)
  assert.match(artifact, /顶部渐变会员大区块/)
  assert.match(artifact, /头像昵称 \| 会员等级卡片/)
  assert.match(artifact, /余额 \| 积分 \| 优惠券三栏网格/)
  assert.match(artifact, /点击会员资产进入明细/)
})

test('parses explicit page-layout-artifact blocks into canvas artifacts and interaction rows', () => {
  const text = [
    'Agent 确认如下：',
    ':::page-layout-artifact title="页面骨架"',
    '## 模型推荐方案',
    '页面类型：首页 Video Podcast 创建入口',
    '推荐布局：顶部操作区 + 主体滚动区 + 输入卡片/提示词区域 + 主操作按钮',
    '推荐原因：快捷提示词应围绕输入区增强首句启动效率。',
    '',
    '## ASCII 页面线框图',
    '┌────────────────────────────────────┐',
    '│ 顶部固定区：Logo / Home / Projects / Tools / Voice / Pricing / Login │',
    '├────────────────────────────────────┤',
    '│ 主体滚动区                           │',
    '│        标题：AI Video Podcast       │',
    '│ ┌──────────────────────────────┐   │',
    '│ │ Topic/input composer          │   │',
    '│ │ [快捷提示词1] [快捷提示词2]      │   │',
    '│ │ [快捷提示词3] [更多/换一批]      │   │',
    '│ │                [Generate podcast] │',
    '│ └──────────────────────────────┘   │',
    '└────────────────────────────────────┘',
    '',
    '## 模块交互明细',
    '- 快捷提示词默认展示在输入框下方、Generate podcast 附近。',
    '- 点击提示词：将提示词文案填入 Topic/input composer。',
    '- 点击「换一批」：刷新快捷提示词列表。',
    '- Generate podcast：校验 Topic/input composer 输入不为空时提交生成。',
    '- 权限状态：未登录时弹出登录引导浮层。',
    '',
    '## 前后端交付',
    '- 前端：渲染 Chips、换一批和输入态。',
    '- 后端：返回推荐提示词列表和登录态。',
    ':::'
  ].join('\n')

  const artifact = parsePageLayoutArtifactFromText(text)
  const interactionSpec = buildInteractionSpecArtifactFromPageLayoutArtifact(artifact, { pageName: '首页 Video Podcast' })

  assert.equal(artifact.title, '页面骨架')
  assert.match(artifact.modelDecision, /首页 Video Podcast/)
  assert.match(artifact.asciiWireframe, /Topic\/input composer/)
  assert.match(artifact.asciiWireframe, /快捷提示词1/)
  assert.match(artifact.asciiWireframe, /更多\/换一批/)
  assert.match(artifact.asciiWireframe, /Generate podcast/)
  assert.deepEqual(artifact.frontendHandoff, ['渲染 Chips、换一批和输入态。'])
  assert.deepEqual(artifact.backendHandoff, ['返回推荐提示词列表和登录态。'])
  assert.ok(interactionSpec.interactionRows.some((row) => row.target === '快捷提示词 Chips' && /填入 Topic\/input composer/.test(row.result)))
  assert.ok(interactionSpec.interactionRows.some((row) => row.target === '换一批'))
  assert.ok(interactionSpec.interactionRows.some((row) => row.target === 'Generate podcast'))
  assert.ok(interactionSpec.stateMatrix.some((state) => /权限/.test(state.state)))
})
