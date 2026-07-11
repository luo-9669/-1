import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generateDiagramBundle,
  generateDiagramBundleWithProvider,
  renderAscii,
  validateDiagramData
} from './diagram-generator.js'

test('generateDiagramBundle returns structured data with ascii, mermaid, warnings, and handoff', () => {
  const result = generateDiagramBundle({
    businessType: 'tea_shop_mini_program',
    description: '做一个茶饮点单小程序：首页、点餐、购物车、订单、我的，支持规格选择、优惠券、支付、取餐码。'
  })

  assert.equal(result.data.projectName, '茶饮小程序')
  assert.deepEqual(result.data.structureTree.tabs.map((tab) => tab.name), ['首页', '点餐', '购物车', '订单', '我的'])
  assert.ok(result.data.pageFrames.find((frame) => frame.page === '点餐').layoutHints.includes('左右分栏'))
  assert.ok(result.data.apiData.find((item) => item.page === '首页' && item.method === 'GET' && item.endpoint === '/stores/nearby'))
  assert.ok(result.data.layoutBlueprints.find((item) => item.page === '首页').regions[0].slots.some((slot) => slot.type === 'input'))
  assert.ok(result.data.visualSpecs.find((item) => item.page === '首页').components.some((item) => item.name === '搜索框'))
  assert.ok(result.data.flowTransitions.some((item) => item.from === '首页' && item.to === '点餐'))
  assert.ok(result.data.interactionSpecs.find((item) => item.page === '点餐').interactions.some((item) => item.trigger.includes('点击商品')))
  const orderDecision = result.data.layoutDecisions.find((item) => item.page === '点餐')
  assert.equal(orderDecision.layoutType, '左右分栏 + 右侧卡片流 + 底部悬浮购物车栏')
  assert.ok(orderDecision.reasons.some((item) => item.includes('分类较多')))
  assert.ok(orderDecision.modules.some((item) => item.name === '商品卡片' && item.cardPattern === '左图右文商品卡'))
  assert.match(result.ascii.layoutDecisions, /模型推荐方案/)
  assert.match(result.ascii.layoutDecisions, /推荐布局：左右分栏 \+ 右侧卡片流 \+ 底部悬浮购物车栏/)
  assert.match(result.ascii.layoutDecisions, /商品卡片：左图右文商品卡/)
  assert.match(result.ascii.frames, /推荐布局：左右分栏 \+ 右侧卡片流 \+ 底部悬浮购物车栏/)
  assert.match(result.ascii.frames, /左：商品图/)
  assert.match(result.ascii.frames, /右上：商品名 \/ 标签 \/ 月售/)
  assert.match(result.ascii.frames, /右下：价格 \/ 加购 \/ 收藏/)
  const homeApi = result.data.apiData.find((item) => item.page === '首页' && item.endpoint === '/stores/nearby')
  assert.ok(homeApi.requestParams.some((item) => item.includes('latitude')))
  assert.ok(homeApi.responseFields.some((item) => item.includes('businessStatus')))
  assert.ok(homeApi.errorCodes.some((item) => item.includes('STORE_OUT_OF_RANGE')))
  assert.match(homeApi.frontendUsage, /顶部/)
  assert.match(homeApi.backendLogic, /定位/)
  const homeSearchSlot = result.data.layoutBlueprints
    .find((item) => item.page === '首页')
    .regions.flatMap((region) => region.slots)
    .find((slot) => slot.name === '搜索框')
  assert.match(homeSearchSlot.dataDependency, /\/search\/suggestions/)
  assert.match(homeSearchSlot.state, /默认/)
  assert.match(homeSearchSlot.frontendOwner, /前端/)
  assert.match(homeSearchSlot.backendOwner, /后端/)
  const homeVisual = result.data.visualSpecs.find((item) => item.page === '首页')
  assert.ok(homeVisual.spacing.some((item) => item.includes('顶部导航')))
  assert.ok(homeVisual.accessibility.some((item) => item.includes('点击热区')))
  const productInteraction = result.data.interactionSpecs
    .find((item) => item.page === '点餐')
    .interactions.find((item) => item.trigger.includes('点击商品'))
  assert.match(productInteraction.relatedApi, /\/cart\/items/)
  assert.ok(productInteraction.edgeCases.some((item) => item.includes('售罄')))
  assert.match(result.ascii.structure, /茶饮小程序/)
  assert.match(result.ascii.frames, /顶部固定导航/)
  assert.match(result.ascii.frames, /页面总框架：顶部选店导航 \+ 首页滚动推荐区 \+ 底部Tab/)
  assert.match(result.ascii.frames, /┌/)
  assert.match(result.ascii.frames, /【滚动内容容器 scroll-view】/)
  assert.match(result.ascii.frames, /模块1：Banner通栏轮播区/)
  assert.match(result.ascii.frames, /图片 \+ 标题 \+ 副标题/)
  assert.match(result.ascii.frames, /跳转按钮 \/ 活动角标/)
  assert.match(result.ascii.frames, /图标\+文字/)
  assert.match(result.ascii.frames, /左图右文商品卡/)
  assert.match(result.ascii.frames, /价格\/划线价/)
  assert.match(result.ascii.frames, /点赞\/收藏/)
  assert.match(result.ascii.frames, /瀑布流\/两列网格/)
  assert.match(result.ascii.frames, /点餐菜单页（左右分栏特殊框架）/)
  assert.match(result.ascii.frames, /左右分栏主体/)
  assert.match(result.ascii.frames, /商品图 \+ 商品名 \+ 月售/)
  assert.match(result.ascii.frames, /价格 \+ 加购按钮/)
  assert.match(result.ascii.frames, /弹窗附加框架/)
  assert.match(result.ascii.frames, /底部Tab导航/)
  assert.match(result.ascii.frames, /规格弹窗容器/)
  assert.match(result.ascii.frames, /甜度\/冰度\/杯型\/加料选择区/)
  assert.match(result.ascii.frames, /卡片头部 可选区/)
  assert.match(result.ascii.frames, /卡片主体内容区/)
  assert.match(result.ascii.frames, /卡片底部 可选区/)
  assert.match(result.ascii.frames, /交互手势说明/)
  assert.match(result.ascii.frames, /下拉手势 → 触发接口刷新/)
  assert.match(result.ascii.frames, /内容区域纵向滚动/)
  assert.match(result.ascii.frames, /横向滑动/)
  assert.match(result.ascii.structure, /接口归属：/)
  assert.match(result.ascii.structure, /数据来源：/)
  assert.match(result.mermaid.structure, /graph TD/)
  assert.match(result.mermaid.frames, /subgraph/)
  assert.ok(result.handoff.frontend.some((item) => item.includes('Mermaid')))
  assert.ok(result.handoff.backend.some((item) => item.includes('JSON Schema')))
  assert.ok(result.warnings.every((warning) => warning.severity && warning.message))
})

test('validateDiagramData rejects missing page frame sections', () => {
  const validation = validateDiagramData({
    projectName: '测试应用',
    structureTree: {
      root: '测试应用',
      tabs: [{ name: '首页', children: [], modals: [] }],
      globalCapabilities: ['登录']
    },
    pageFrames: [{ page: '首页', topFixed: [], scrollModules: [], bottomFixed: [], overlays: [] }]
  })

  assert.equal(validation.ok, false)
  assert.ok(validation.errors.some((error) => error.includes('pageFrames[0].scrollModules')))
})

test('rendered ascii uses semantic details for varied checkout module names', () => {
  const custom = validateDiagramData({
    projectName: '结算页',
    structureTree: {
      root: '结算页',
      tabs: [{ name: '结算页', children: [], modals: ['优惠券弹窗'] }],
      globalCapabilities: ['登录', '支付', '空状态']
    },
    pageFrames: [{
      page: '结算页',
      topFixed: ['页面标题', '返回'],
      scrollModules: ['优惠券选择', '积分抵扣', '备注输入'],
      bottomFixed: ['合计金额', '提交订单按钮'],
      overlays: ['优惠券弹窗']
    }]
  })

  assert.equal(custom.ok, true)
  const frames = renderAscii(custom.data).frames
  assert.match(frames, /优惠券卡片/)
  assert.match(frames, /满减金额 \/ 使用门槛/)
  assert.match(frames, /积分余额 \/ 抵扣开关/)
  assert.match(frames, /多行输入框 \/ 字数限制/)
  assert.doesNotMatch(frames, /标题 \/ 描述 \/ 主操作按钮/)
})

test('rendered ascii uses Jogg homepage evidence instead of tea homepage frame', () => {
  const custom = validateDiagramData({
    projectName: 'Jogg',
    structureTree: {
      root: 'Jogg',
      tabs: [{ name: '首页', children: [], modals: ['LoginDialog / credits 拦截'] }],
      globalCapabilities: ['登录', 'credits', '素材生成状态']
    },
    pageFrames: [{
      page: '首页',
      topFixed: ['Jogg Logo / Home 当前选中', 'Tools / Studio 导航入口', 'Voice / Projects / 账号状态'],
      scrollModules: [
        'Jogg 首页生成入口',
        'Tools 生成入口',
        'Studio 编辑渲染入口',
        'Media 素材面板：My Media / Stock / AI Generate'
      ],
      bottomFixed: ['无底部固定区：桌面首页由左侧导航承担一级入口'],
      overlays: ['LoginDialog / credits 拦截']
    }],
    layoutDecisions: [{
      page: '首页',
      pageType: 'Jogg 首页',
      layoutType: '左侧全局导航 + 首页任务入口网格 + Tools/Studio/Media 快捷入口',
      reasons: ['来自 Jogg 项目知识。']
    }]
  })

  assert.equal(custom.ok, true)
  const frames = renderAscii(custom.data).frames

  assert.match(frames, /左侧 Sidebar：Home \/ Tools \/ Studio \/ Voice \/ Projects/)
  assert.match(frames, /Media 素材面板：My Media \/ Stock \/ AI Generate/)
  assert.match(frames, /My Media Upload\/Capture\/Search from Space/)
  assert.doesNotMatch(frames, /门店|自提|外卖|点单|购物车|订单/)
  assert.doesNotMatch(frames, /内容类型待确认|建议补/)
})

test('custom content recommendation gets waterfall layout decision and detailed wireframe', () => {
  const result = generateDiagramBundle({
    businessType: 'custom_application',
    description: '做一个灵感案例社区页面，用户浏览作品封面、标题、作者、标签、点赞和收藏，支持下拉刷新、上拉加载、点击卡片进入详情。'
  })

  const decision = result.data.layoutDecisions[0]
  assert.equal(decision.page, '内容推荐页')
  assert.equal(decision.layoutType, '瀑布流双列')
  assert.ok(decision.reasons.some((item) => item.includes('图片封面')))
  assert.ok(decision.modules.some((item) => item.cardPattern === '图上文下内容卡'))
  assert.match(result.ascii.layoutDecisions, /页面类型：内容推荐页/)
  assert.match(result.ascii.layoutDecisions, /推荐布局：瀑布流双列/)
  assert.match(result.ascii.layoutDecisions, /卡片结构：图上文下内容卡/)
  assert.match(result.ascii.frames, /推荐布局：瀑布流双列/)
  assert.match(result.ascii.frames, /图片封面/)
  assert.match(result.ascii.frames, /标题2行/)
  assert.match(result.ascii.frames, /标签\/作者/)
  assert.match(result.ascii.frames, /点赞\/收藏/)
  assert.match(result.ascii.frames, /下拉刷新/)
  assert.match(result.ascii.frames, /上拉加载/)
})

test('generateDiagramBundle renders podcast pages as single plaintext layout frames with embedded interactions', () => {
  const result = generateDiagramBundle({
    businessType: 'custom_application',
    description: 'Podcastor.ai 零门槛 AI 播客工作站：首页支持 Generate Script、Upload Script、Upload Audio，核心编辑页支持主持人选择、脚本编辑、预览音频、下载PDF、生成视频。'
  })

  assert.equal(result.data.projectName, 'Podcastor.ai')
  assert.ok(result.data.pageFrames.some((frame) => frame.page === '首页'))
  assert.ok(result.data.pageFrames.some((frame) => frame.page === '核心编辑页'))
  assert.match(result.ascii.frames, /首页\s+页面框架/)
  assert.match(result.ascii.frames, /左侧 AppNavRail 固定：Logo \/ Home\(active\) \/ Projects \/ Tools/)
  assert.match(result.ascii.frames, /内容区右上状态：Sign up \+50 \/ Log in \/ Upgrade \/ credits/)
  assert.match(result.ascii.frames, /【内容区首屏核心工作模块】/)
  assert.match(result.ascii.frames, /Tab: Generate Script \| Upload Script \| Upload Audio/)
  assert.match(result.ascii.frames, /支持：Prompt 输入 \/ URL 粘贴 \/ 文档上传按钮/)
  assert.match(result.ascii.frames, /主按钮：Generate podcast \/ Next → 进入 Studio 核心编辑页/)
  assert.match(result.ascii.frames, /【滚动内容区 scroll-view】/)
  assert.match(result.ascii.frames, /模块1：播客创作工具横滑列表/)
  assert.match(result.ascii.frames, /卡片：图标 \+ 工具名 \+ 简述 \+ Try按钮/)
  assert.match(result.ascii.frames, /手势：横向滑动/)
  assert.match(result.ascii.frames, /模块2：灵感案例瀑布流\/卡片网格/)
  assert.match(result.ascii.frames, /hover预览 \/ 点击打开大窗口/)
  assert.match(result.ascii.frames, /浮层：LoginDialog \/ Pricing Drawer \/ credits 拦截按需覆盖内容区/)
  assert.match(result.ascii.frames, /播客核心编辑页/)
  assert.match(result.ascii.frames, /顶部：项目名 \/ 保存状态 \/ 下载 \/ 生成按钮/)
  assert.match(result.ascii.frames, /左侧主持人区\s+\|\s+右侧脚本预览&编辑区/)
  assert.match(result.ascii.frames, /Tab分类：Talk Show/)
  assert.match(result.ascii.frames, /主持人卡片：头像\/类型\/hover预览/)
  assert.match(result.ascii.frames, /脚本编辑器/)
  assert.match(result.ascii.frames, /预览音频 \/ 下载PDF \/ 复制脚本/)
  assert.match(result.ascii.frames, /替换音色 \/ 角色对调 \/ 增加停顿/)
  assert.match(result.ascii.frames, /底部生成栏：选择比例 \/ 生成视频 \/ 代币消耗提示/)
  assert.match(result.ascii.frames, /接口：POST \/podcasts\/drafts/)
  assert.match(result.ascii.frames, /接口：PATCH \/scripts\/:id/)
})

test('generateDiagramBundle generic podcast fallback does not leak Podcastor brand', () => {
  const result = generateDiagramBundle({
    businessType: 'custom_application',
    description: 'AI 播客工作站：首页支持 Generate Script、Upload Script、Upload Audio，核心编辑页支持主持人选择、脚本编辑、预览音频、下载PDF、生成视频。'
  })
  const combined = [
    result.data.projectName,
    result.ascii.structure,
    result.ascii.frames,
    result.ascii.layoutDecisions
  ].join('\n')

  assert.equal(result.data.projectName, 'AI 播客工作站')
  assert.doesNotMatch(combined, /Podcastor/i)
})

test('generateDiagramBundle renders Podcastor auth pages with dedicated account entry frames', () => {
  const result = generateDiagramBundle({
    businessType: 'custom_application',
    description: [
      'project: Podcastor.ai 认证页面',
      'page type: 认证与账号入口页面',
      '登录页 Sign In、注册页 Sign Up、忘记密码页 Forgot Password、重置密码页 Reset Password、OAuth 回调处理中页、登录拦截弹窗 Auth Modal',
      '支持 Google、Discord、邮箱方式，登录后回到原始创作上下文，初始化免费次数、credits、套餐权限和最近项目。',
      '需要保存 redirect_uri、source、draft_id 或临时创作上下文，区分 AppSumo/LTD 用户和普通订阅用户。'
    ].join('\n')
  })

  assert.equal(result.data.projectName, 'Podcastor.ai')
  assert.deepEqual(result.data.pageFrames.map((frame) => frame.page), [
    '登录页 Sign In',
    '注册页 Sign Up',
    '忘记密码页 Forgot Password',
    '重置密码页 Reset Password',
    'OAuth 回调处理中页',
    '登录拦截弹窗 Auth Modal'
  ])
  assert.match(result.ascii.layoutDecisions, /认证与账号入口页面/)
  assert.match(result.ascii.layoutDecisions, /认证入口守门页/)
  assert.match(result.ascii.frames, /Podcastor.ai 认证入口总框架/)
  assert.match(result.ascii.frames, /Google 登录 \/ Discord 登录 \/ 邮箱登录/)
  assert.match(result.ascii.frames, /免费试用次数 \/ credits \/ 套餐权益/)
  assert.match(result.ascii.frames, /redirect_uri \/ source \/ draft_id/)
  assert.match(result.ascii.frames, /OAuth 回调处理中页/)
  assert.match(result.ascii.frames, /登录拦截弹窗 Auth Modal/)
  assert.match(result.ascii.frames, /避免上传文件和输入内容丢失/)
})

test('generateDiagramBundleWithProvider uses valid provider JSON before rendering outputs', async () => {
  let capturedContext = null
  const result = await generateDiagramBundleWithProvider({
    businessType: 'custom_application',
    generationMode: 'ai',
    description: '做一个预约服务 App'
  }, {
    provider: {
      async generate(context) {
        capturedContext = context
        return {
          content: JSON.stringify({
            projectName: '预约服务 App',
            businessType: 'service_booking_app',
            structureTree: {
              root: '预约服务 App',
              tabs: [{ name: '预约', children: ['服务详情'], modals: ['时间选择弹窗'] }],
              globalCapabilities: ['登录', '支付', '空状态']
            },
            pageFrames: [{
              page: '预约',
              topFixed: ['城市选择', '搜索'],
              scrollModules: ['服务分类', '服务列表', '技师推荐'],
              bottomFixed: ['预约按钮'],
              overlays: ['时间选择弹窗'],
              layoutHints: ['顶部固定', '主体滚动']
            }],
            apiData: [{
              page: '预约',
              sourceName: '预约服务',
              endpoint: 'GET /booking/services',
              method: 'GET',
              owner: 'backend',
              usedBy: ['服务分类'],
              fields: ['serviceId', 'name'],
              fallback: '展示空状态'
            }],
            layoutBlueprints: [{
              page: '预约',
              regions: [{ region: 'topFixed', slots: [{ position: 'center', type: 'input', name: '搜索服务' }] }]
            }],
            visualSpecs: [{
              page: '预约',
              styleTone: '清爽可信',
              hierarchy: ['搜索优先', '服务卡片突出价格'],
              components: [{ name: '搜索服务', type: 'input', visual: '圆角输入框', stateStyles: ['默认', '聚焦'] }],
              colorTokens: ['brand.primary', 'surface.card'],
              typography: ['标题 18px', '正文 14px']
            }],
            flowTransitions: [{
              from: '预约',
              to: '服务详情',
              trigger: '点击服务卡片',
              precondition: '服务可预约',
              successFeedback: '进入详情页',
              failureFeedback: '提示服务不可用'
            }],
            interactionSpecs: [{
              page: '预约',
              interactions: [{ trigger: '点击预约按钮', rule: '校验时间', feedback: '打开时间选择' }]
            }]
          })
        }
      }
    }
  })

  assert.equal(result.meta.source, 'provider')
  assert.match(capturedContext.systemPrompt, /只输出 JSON/)
  assert.match(capturedContext.userPrompt, /预约服务 App/)
  assert.equal(result.data.projectName, '预约服务 App')
  assert.match(result.ascii.frames, /服务分类/)
  assert.match(result.mermaid.structure, /预约服务 App/)
})

test('generateDiagramBundleWithProvider falls back when provider JSON is invalid', async () => {
  const result = await generateDiagramBundleWithProvider({
    businessType: 'tea_shop_mini_program',
    generationMode: 'ai',
    description: '茶饮点单小程序'
  }, {
    provider: {
      async generate() {
        return {
          content: JSON.stringify({
            projectName: '坏数据',
            structureTree: { root: '坏数据', tabs: [], globalCapabilities: [] },
            pageFrames: []
          })
        }
      }
    }
  })

  assert.equal(result.meta.source, 'fallback')
  assert.equal(result.data.projectName, '茶饮小程序')
  assert.ok(result.warnings.some((warning) => warning.code === 'DIAGRAM_PROVIDER_FALLBACK'))
})
