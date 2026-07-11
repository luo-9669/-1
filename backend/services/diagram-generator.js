const BUSINESS_PRESETS = {
  podcast_ai_auth: {
    projectName: 'AI 播客工作站',
    tabs: [
      {
        name: '登录页 Sign In',
        children: ['注册页 Sign Up', '忘记密码页 Forgot Password'],
        modals: ['OAuth 授权窗口', '错误提示 Toast'],
        topFixed: ['产品 Logo', '返回原创作入口', '语言/帮助入口'],
        scrollModules: ['左侧创作价值与案例预览', 'Google 登录', 'Discord 登录', '邮箱登录表单', '免费试用次数与 credits 提示', '服务条款与隐私政策'],
        bottomFixed: ['继续当前任务主按钮', '切换注册入口'],
        overlays: ['OAuth 授权窗口', '登录错误提示', '账号合并提示'],
        layoutHints: ['桌面左右分栏', '移动端单列表单优先', '保留 redirect_uri/source/draft_id 回跳上下文'],
        states: ['未登录', 'OAuth pending', 'loading', 'disabled', 'error', 'rate limit', '账号待合并'],
        dataSources: ['认证服务', 'OAuth 配置服务', '用户资产服务', '套餐权限服务', '临时创作上下文服务'],
        apiOwnership: ['GET /auth/providers 后端返回 Google/Discord/邮箱开关', 'POST /auth/email/login 后端校验邮箱密码', 'GET /me 后端返回账号、credits、套餐和最近项目', 'POST /auth/redirect-context 后端保存 redirect_uri/source/draft_id'],
        frontendTasks: ['渲染左右分栏或移动端单列表单', '维护 Google/Discord/邮箱登录 loading、disabled、error 和 rate limit 状态', '登录成功后按 redirect_uri/source/draft_id 回到原创作流程'],
        backendTasks: ['提供 OAuth 配置、邮箱登录、会话建立和账号合并策略', '初始化 workspace、免费次数、credits、套餐等级、资产库和最近项目', '校验 AppSumo/LTD 与第三方 API 消耗权限边界']
      },
      {
        name: '注册页 Sign Up',
        children: ['登录页 Sign In'],
        modals: ['邮箱验证码提示', '账号已存在绑定提示'],
        topFixed: ['产品 Logo', '返回登录', '权益说明入口'],
        scrollModules: ['免费试用权益说明', 'Google 注册', 'Discord 注册', '邮箱注册表单', '密码强度校验', '首次创作权益确认'],
        bottomFixed: ['创建账号按钮', '已有账号登录入口'],
        overlays: ['账号绑定提示', '注册失败提示'],
        layoutHints: ['与登录页一致', '突出免费试用和首次创作权益', '移动端优先展示注册动作'],
        states: ['输入为空', '邮箱格式错误', '密码弱', '注册中', '注册成功', '邮箱已存在'],
        dataSources: ['认证服务', '邮件服务', '用户资产服务', '套餐权限服务'],
        apiOwnership: ['POST /auth/email/register 后端创建账号', 'POST /auth/account/link 后端处理同邮箱绑定', 'POST /workspace/init 后端初始化用户空间'],
        frontendTasks: ['渲染注册字段、密码强度、条款确认和错误提示', '支持 OAuth 注册与邮箱注册互切', '注册后继续原始创作上下文'],
        backendTasks: ['创建账号、加密密码、发送验证邮件、初始化 credits 和免费次数', '处理同邮箱 OAuth/邮箱账号绑定策略']
      },
      {
        name: '忘记密码页 Forgot Password',
        children: ['重置密码页 Reset Password'],
        modals: ['邮件发送成功提示'],
        topFixed: ['返回登录', '页面标题'],
        scrollModules: ['邮箱输入框', '发送重置邮件按钮', '安全说明', '返回登录入口'],
        bottomFixed: ['发送邮件按钮'],
        overlays: ['发送成功 Toast', 'rate limit 提示'],
        layoutHints: ['轻量单列表单', '减少营销干扰', '突出邮箱输入和发送结果'],
        states: ['默认', '邮箱为空', '邮箱格式错误', '发送中', '发送成功', 'rate limit'],
        dataSources: ['认证服务', '邮件服务'],
        apiOwnership: ['POST /auth/password/forgot 后端发送重置邮件'],
        frontendTasks: ['渲染邮箱输入、字段校验、发送状态和返回登录', '保护用户隐私，不暴露邮箱是否存在'],
        backendTasks: ['生成重置 token、发送邮件、限制发送频率和统一响应']
      },
      {
        name: '重置密码页 Reset Password',
        children: ['登录页 Sign In'],
        modals: ['token 失效提示'],
        topFixed: ['返回登录', '页面标题'],
        scrollModules: ['新密码输入', '确认密码输入', 'token 有效性提示', '提交重置按钮'],
        bottomFixed: ['确认重置按钮'],
        overlays: ['重置成功提示', 'token 失效弹窗'],
        layoutHints: ['单列表单', '校验 token 有效性', '重置成功后引导登录或自动登录'],
        states: ['校验 token 中', 'token 有效', 'token 失效', '密码不一致', '提交中', '重置成功'],
        dataSources: ['认证服务', '邮件 token 服务'],
        apiOwnership: ['GET /auth/password/reset-token 后端校验 token', 'POST /auth/password/reset 后端更新密码'],
        frontendTasks: ['渲染 token 校验态、新密码表单和成功/失败反馈', '避免 token 失效时继续提交'],
        backendTasks: ['校验 token、更新密码哈希、吊销旧 token、刷新会话策略']
      },
      {
        name: 'OAuth 回调处理中页',
        children: ['主编辑器', 'Project', 'Pricing Checkout'],
        modals: ['授权失败提示'],
        topFixed: ['产品 Logo'],
        scrollModules: ['居中加载态', '授权来源说明', '失败重试入口'],
        bottomFixed: ['取消并返回登录'],
        overlays: ['授权失败弹窗'],
        layoutHints: ['居中加载态', '短文案说明正在连接 Google/Discord', '失败后可回到原登录方式'],
        states: ['OAuth pending', '授权成功', '授权失败', '账号冲突', '会话写入失败'],
        dataSources: ['Google OAuth', 'Discord OAuth', '认证服务', '回跳上下文服务'],
        apiOwnership: ['GET /auth/oauth/callback 后端处理 code/state', 'POST /auth/session 后端写入会话', 'GET /auth/redirect-context 后端读取回跳上下文'],
        frontendTasks: ['展示处理中状态、失败恢复和取消入口', '成功后按 source/redirect_uri/draft_id 回跳'],
        backendTasks: ['校验 OAuth state、防 CSRF、交换 token、创建或绑定账号、恢复回跳上下文']
      },
      {
        name: '登录拦截弹窗 Auth Modal',
        children: ['原始触发页面'],
        modals: ['登录拦截弹窗 Auth Modal'],
        topFixed: ['弹窗标题', '关闭按钮'],
        scrollModules: ['触发原因说明', 'Google 登录', 'Discord 登录', '邮箱登录折叠区', '登录后权益说明', '保留输入/文件提示'],
        bottomFixed: ['继续当前任务按钮', '稍后再说'],
        overlays: ['Auth Modal', 'OAuth 授权窗口', '升级提示'],
        layoutHints: ['首页创作入口、工具页、下载、分享、保存、升级能力触发', '不强制整页跳转', '必须保留上传文件和输入内容'],
        states: ['未登录拦截', '登录中', '登录成功回填', '关闭弹窗', '上传内容暂存', '会话过期'],
        dataSources: ['认证服务', '临时草稿服务', '文件暂存服务', '计费权限服务'],
        apiOwnership: ['POST /auth/modal-context 后端保存 source/draft_id/upload_id', 'POST /auth/oauth/start 后端创建 OAuth state', 'GET /billing/entitlements 后端返回 credits/套餐/AppSumo 权限'],
        frontendTasks: ['在创作入口、工具页、下载、分享、保存、升级触发时打开弹窗', '登录前暂存 prompt、文档、音频和页面来源', '登录成功后关闭弹窗并继续原动作'],
        backendTasks: ['保存临时上下文、恢复上传文件引用、初始化权益并返回权限边界', '限制 AppSumo/LTD 用户的第三方 API 消耗能力']
      }
    ],
    globalCapabilities: ['Google OAuth', 'Discord OAuth', '邮箱密码登录', '忘记/重置密码', '会话管理', 'redirect_uri/source/draft_id 回跳', 'workspace 初始化', 'credits/免费次数', '套餐权限', 'AppSumo/LTD 权限隔离']
  },
  podcast_ai_workspace: {
    projectName: 'AI 播客工作站',
    tabs: [
      {
        name: '首页',
        children: ['核心编辑页'],
        modals: ['案例大窗口', '登录弹窗', '上传解析弹窗'],
        topFixed: ['顶部导航：Logo', '社媒入口', '更新消息', '账号入口'],
        scrollModules: ['核心工作模块', '播客创作工具横滑列表', '灵感案例瀑布流/卡片网格'],
        bottomFixed: ['左侧 Sidebar 固定'],
        overlays: ['案例大窗口', '登录弹窗'],
        layoutHints: ['顶部导航固定', '核心工作模块首屏重点', '滚动内容区', '左侧 Sidebar 固定'],
        states: ['未登录', '输入为空', 'URL格式错误', '文档解析中', '案例为空', '工具加载失败'],
        dataSources: ['用户服务', '播客草稿服务', '工具配置服务', '灵感案例服务'],
        apiOwnership: ['GET /me 后端返回账号与会员状态', 'POST /podcasts/drafts 后端创建播客草稿', 'GET /tools 后端返回创作工具列表', 'GET /inspirations 后端返回灵感案例'],
        frontendTasks: ['渲染顶部导航、核心输入模块和滚动内容区', '维护 Tab、输入、上传、横滑、hover 和弹窗交互', '处理登录、上传失败、案例空状态'],
        backendTasks: ['提供用户状态、工具配置、案例列表和草稿创建接口', '校验 URL、文件格式、会员权限和代币状态', '返回统一错误码和跳转参数']
      },
      {
        name: '核心编辑页',
        children: ['生成结果页'],
        modals: ['音色选择弹窗', '生成进度弹窗', '升级弹窗'],
        topFixed: ['项目名', '保存状态', '下载', '生成按钮'],
        scrollModules: ['左侧主持人区', '右侧脚本预览&编辑区', '顶部操作', '底部操作'],
        bottomFixed: ['底部生成栏'],
        overlays: ['音色选择弹窗', '生成进度弹窗', '升级弹窗'],
        layoutHints: ['顶部操作固定', '左右分栏', '脚本编辑区滚动', '底部生成栏固定'],
        states: ['草稿保存中', '脚本生成中', '音频预览中', '代币不足', '生成失败', '脚本为空'],
        dataSources: ['项目服务', '主持人服务', '脚本服务', '音色服务', '视频生成服务', '计费服务'],
        apiOwnership: ['GET /projects/:id 后端返回项目与脚本', 'GET /hosts 后端返回主持人库', 'PATCH /scripts/:id 后端保存脚本编辑', 'POST /projects/:id/generate 后端创建视频生成任务'],
        frontendTasks: ['实现顶部操作、左右分栏、主持人卡片、脚本编辑器和底部生成栏', '处理 hover 预览、角色对调、增加停顿、替换音色和生成视频', '展示自动保存、代币消耗、生成进度和错误提示'],
        backendTasks: ['返回项目、主持人、脚本、音色和代币余额', '保存脚本结构化编辑结果', '校验生成权限并创建异步生成任务']
      },
      {
        name: '项目页',
        children: ['项目详情', '重新编辑'],
        modals: ['删除确认弹窗', '重命名弹窗'],
        topFixed: ['项目类型 Tab', '搜索与筛选'],
        scrollModules: ['Recent Creation', 'Video', 'Audio', 'Script', '项目卡片列表'],
        bottomFixed: ['左侧 Sidebar 固定'],
        overlays: ['删除确认弹窗', '重命名弹窗'],
        layoutHints: ['项目列表滚动', '卡片操作菜单', '预览类型差异'],
        states: ['列表加载中', '项目为空', '下载失败', '删除确认', '重命名失败'],
        dataSources: ['项目服务', '文件服务', '分享服务'],
        apiOwnership: ['GET /projects 后端返回项目列表', 'PATCH /projects/:id 后端重命名项目', 'DELETE /projects/:id 后端删除项目'],
        frontendTasks: ['渲染项目 Tab、卡片列表、预览和操作菜单', '处理下载、分享、重新编辑、删除和重命名'],
        backendTasks: ['提供项目列表、文件下载地址、分享链接和删除权限校验']
      }
    ],
    globalCapabilities: ['登录', '上传解析', '草稿自动保存', '音频预览', '视频生成', '代币计费', '空状态', '失败重试']
  },
  tea_shop_mini_program: {
    projectName: '茶饮小程序',
    tabs: [
      {
        name: '首页',
        children: ['拼团详情', '秒杀详情'],
        modals: ['门店弹窗', '消息弹窗', '活动弹窗'],
        topFixed: ['门店选择', '搜索框', '自提/外卖', '消息'],
        scrollModules: ['Banner轮播', '快捷入口', '分类标签', '热销商品', '限时秒杀'],
        bottomFixed: ['底部Tab'],
        overlays: ['门店弹窗', '活动弹窗'],
        layoutHints: ['顶部固定', '主体滚动', '底部Tab固定']
      },
      {
        name: '点餐',
        children: ['商品详情大图'],
        modals: ['规格选择弹窗'],
        topFixed: ['门店信息', '搜索入口'],
        scrollModules: ['左侧分类', '右侧商品列表', '商品卡片', '加购控件'],
        bottomFixed: ['购物车悬浮栏', '去结算按钮'],
        overlays: ['规格选择弹窗'],
        layoutHints: ['左右分栏', '底部购物车固定', '规格弹窗顶层']
      },
      {
        name: '购物车',
        children: ['结算页'],
        modals: ['优惠券弹窗'],
        topFixed: ['页面标题', '门店提示'],
        scrollModules: ['商品清单', '优惠券入口', '金额明细', '备注与餐具'],
        bottomFixed: ['合计金额', '提交订单按钮'],
        overlays: ['优惠券弹窗'],
        layoutHints: ['上下分区', '结算栏固定']
      },
      {
        name: '订单',
        children: ['订单详情'],
        modals: ['取餐码弹窗', '退款弹窗'],
        topFixed: ['订单状态筛选'],
        scrollModules: ['订单卡片', '制作状态', '支付状态', '售后入口'],
        bottomFixed: ['客服入口'],
        overlays: ['取餐码弹窗', '退款弹窗'],
        layoutHints: ['状态驱动', '弹窗顶层']
      },
      {
        name: '我的',
        children: ['储值', '积分商城', '签到', '卡包', '地址', '反馈', '关于门店'],
        modals: ['登录弹窗'],
        topFixed: ['用户信息', '会员等级'],
        scrollModules: ['会员资产', '营销入口', '工具入口', '服务入口'],
        bottomFixed: ['底部Tab'],
        overlays: ['登录弹窗'],
        layoutHints: ['账户信息优先', '功能宫格']
      }
    ],
    globalCapabilities: ['登录', '定位', '支付', '空状态', '加载态', '失败重试']
  }
}

function normalizeTextList(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : [items])
    .map((item) => String(item || '').trim())
    .filter(Boolean)))
}

function pageDetailDefaults(page = '') {
  const defaults = {
    首页: {
      states: ['未登录', '输入为空', 'URL格式错误', '文档解析中', '案例为空', '工具加载失败'],
      dataSources: ['用户服务', '播客草稿服务', '工具配置服务', '灵感案例服务'],
      apiOwnership: ['GET /me 后端返回账号与会员状态', 'POST /podcasts/drafts 后端创建播客草稿', 'GET /tools 后端返回创作工具列表', 'GET /inspirations 后端返回灵感案例'],
      frontendTasks: ['渲染顶部导航、核心输入模块和滚动内容区', '维护 Tab、输入、上传、横滑、hover 和弹窗交互', '处理登录、上传失败、案例空状态'],
      backendTasks: ['提供用户状态、工具配置、案例列表和草稿创建接口', '校验 URL、文件格式、会员权限和代币状态', '返回统一错误码和跳转参数']
    },
    核心编辑页: {
      states: ['草稿保存中', '脚本生成中', '音频预览中', '代币不足', '生成失败', '脚本为空'],
      dataSources: ['项目服务', '主持人服务', '脚本服务', '音色服务', '视频生成服务', '计费服务'],
      apiOwnership: ['GET /projects/:id 后端返回项目与脚本', 'GET /hosts 后端返回主持人库', 'PATCH /scripts/:id 后端保存脚本编辑', 'POST /projects/:id/generate 后端创建视频生成任务'],
      frontendTasks: ['实现顶部操作、左右分栏、主持人卡片、脚本编辑器和底部生成栏', '处理 hover 预览、角色对调、增加停顿、替换音色和生成视频', '展示自动保存、代币消耗、生成进度和错误提示'],
      backendTasks: ['返回项目、主持人、脚本、音色和代币余额', '保存脚本结构化编辑结果', '校验生成权限并创建异步生成任务']
    },
    项目页: {
      states: ['列表加载中', '项目为空', '下载失败', '删除确认', '重命名失败'],
      dataSources: ['项目服务', '文件服务', '分享服务'],
      apiOwnership: ['GET /projects 后端返回项目列表', 'PATCH /projects/:id 后端重命名项目', 'DELETE /projects/:id 后端删除项目'],
      frontendTasks: ['渲染项目 Tab、卡片列表、预览和操作菜单', '处理下载、分享、重新编辑、删除和重命名'],
      backendTasks: ['提供项目列表、文件下载地址、分享链接和删除权限校验']
    },
    首页: {
      states: ['未定位', '门店休息', '活动已结束', '商品售罄', '网络失败'],
      dataSources: ['门店服务', '营销活动服务', '商品推荐服务', '消息服务'],
      apiOwnership: ['GET /stores/nearby 后端返回门店与营业状态', 'GET /home/banners 后端返回活动位', 'GET /products/hot 后端返回热销商品'],
      frontendTasks: ['渲染顶部定位与搜索', '维护轮播和快捷入口交互', '处理定位失败和空状态'],
      backendTasks: ['聚合门店、活动、商品推荐数据', '返回统一活动状态和跳转参数', '提供缓存与降级数据']
    },
    点餐: {
      states: ['分类加载中', '商品售罄', '规格缺货', '加购失败', '购物车为空'],
      dataSources: ['分类服务', '商品服务', 'SKU库存服务', '购物车服务'],
      apiOwnership: ['GET /categories 后端返回分类树', 'GET /products 后端返回商品与价格', 'POST /cart/items 后端校验 SKU 后加购'],
      frontendTasks: ['实现左右联动滚动', '维护规格选择弹窗状态', '展示购物车数量和金额'],
      backendTasks: ['返回商品、SKU、库存和价格', '校验加料加冰糖规则', '维护购物车服务端状态']
    },
    购物车: {
      states: ['购物车为空', '优惠券不可用', '价格变动', '库存不足', '提交失败'],
      dataSources: ['购物车服务', '优惠券服务', '价格计算服务', '订单服务'],
      apiOwnership: ['GET /cart 后端返回购物车明细', 'POST /cart/price 后端试算金额', 'POST /orders 后端创建订单'],
      frontendTasks: ['展示商品清单和金额明细', '处理优惠券选择', '提交订单并展示错误提示'],
      backendTasks: ['计算优惠和应付金额', '锁定库存并创建订单', '返回库存不足和价格变动错误码']
    },
    订单: {
      states: ['待支付', '制作中', '待取餐', '已完成', '退款中', '退款失败'],
      dataSources: ['订单服务', '支付服务', '取餐码服务', '售后服务'],
      apiOwnership: ['GET /orders 后端返回订单列表', 'GET /orders/:id 后端返回订单详情', 'POST /refunds 后端创建退款申请'],
      frontendTasks: ['按状态展示订单卡片操作', '展示取餐码和退款弹窗', '处理刷新和客服入口'],
      backendTasks: ['同步支付和制作状态', '生成取餐码', '处理退款规则和售后状态']
    },
    我的: {
      states: ['未登录', '会员信息加载中', '权益为空', '地址为空', '退出确认'],
      dataSources: ['用户服务', '会员服务', '积分服务', '地址服务', '客服服务'],
      apiOwnership: ['GET /me 后端返回用户资料', 'GET /member/assets 后端返回会员资产', 'GET /addresses 后端返回地址列表'],
      frontendTasks: ['展示用户信息和会员资产', '组织营销和工具入口', '处理登录授权弹窗'],
      backendTasks: ['维护用户、积分、卡券和地址数据', '返回权限状态', '处理退出登录和客服配置']
    }
  }
  return defaults[page] || {
    states: ['加载中', '空状态', '提交失败', '权限不足'],
    dataSources: ['业务服务', '用户服务', '配置服务'],
    apiOwnership: [`GET /${page || 'page'} 后端返回页面数据`, `POST /${page || 'page'}/actions 后端处理页面操作`],
    frontendTasks: ['渲染页面结构和交互状态', '处理表单校验、复制导出和错误提示'],
    backendTasks: ['提供页面数据、权限判断和统一错误码', '保存用户操作并返回最新状态']
  }
}

function pageLayoutDefaults(page = '') {
  const enrichSlot = (slot = {}) => ({
    state: slot.state || '默认 / 加载中 / 失败 / 禁用',
    dataDependency: slot.dataDependency || '依赖当前页面主接口数据',
    validation: slot.validation || '前端校验展示状态，后端校验业务规则',
    frontendOwner: slot.frontendOwner || '前端负责组件渲染、交互状态和埋点触发',
    backendOwner: slot.backendOwner || '后端提供数据字段、权限状态和错误码',
    ...slot
  })
  const enrichRegions = (regions = []) => regions.map((region) => ({
    ...region,
    slots: (region.slots || []).map(enrichSlot)
  }))
  const layouts = {
    首页: enrichRegions([
      { region: 'topFixed', label: '顶部固定导航', slots: [
        { position: 'left', type: 'button', name: '门店选择', behavior: '点击打开门店选择弹窗', state: '已定位 / 未定位 / 门店休息', dataDependency: 'GET /stores/nearby 返回默认门店、距离和营业状态' },
        { position: 'center', type: 'input', name: '搜索框', behavior: '点击进入搜索或聚焦输入', state: '默认 / 聚焦 / 输入中 / 无结果', dataDependency: 'GET /search/suggestions 返回热词和历史搜索' },
        { position: 'right', type: 'iconButton', name: '消息', behavior: '点击进入消息中心', state: '无未读 / 有未读红点 / 加载失败', dataDependency: 'GET /messages/unread 返回未读数量' },
        { position: 'below', type: 'segmentedControl', name: '自提/外卖切换', behavior: '切换履约方式并刷新门店能力', state: '自提选中 / 外卖选中 / 外卖不可用', dataDependency: 'GET /stores/nearby 的 deliveryModes 字段' }
      ] },
      { region: 'scrollMain', label: '主体滚动内容', slots: [
        { position: 'top', type: 'carousel', name: 'Banner轮播', behavior: '点击跳活动详情', state: '加载骨架 / 正常轮播 / 活动过期隐藏', dataDependency: 'GET /home/banners 返回图片、跳转类型和活动有效期' },
        { position: 'middle', type: 'buttonGrid', name: '快捷入口4宫格', behavior: '进入点餐、优惠券、会员、活动', state: '默认 / 权限受限 / 活动不可用', dataDependency: 'GET /home/quick-actions 返回入口文案、图标和路由参数' },
        { position: 'middle', type: 'tabList', name: '分类标签', behavior: '横向滚动切换推荐类目', state: '默认 / 选中 / 无分类', dataDependency: 'GET /home/recommend-tabs 返回类目与推荐分组' },
        { position: 'bottom', type: 'productCardRow', name: '热销商品卡片', behavior: '点击商品或加购', state: '可售 / 售罄 / 活动价 / 加购中', dataDependency: 'GET /products/hot 返回商品、价格、库存和活动标签' }
      ] },
      { region: 'bottomFixed', label: '底部固定导航', slots: [
        { position: 'full', type: 'tabBar', name: '首页/点餐/购物车/订单/我的', behavior: '切换一级页面', state: '当前选中 / 未选中 / 购物车数量角标', dataDependency: 'GET /cart/summary 返回购物车数量角标' }
      ] }
    ]),
    点餐: enrichRegions([
      { region: 'topFixed', label: '顶部门店与搜索', slots: [
        { position: 'left', type: 'button', name: '门店信息', behavior: '点击切换门店', state: '营业中 / 休息中 / 切换中', dataDependency: 'GET /stores/nearby 的当前门店状态' },
        { position: 'right', type: 'iconButton', name: '搜索', behavior: '打开商品搜索', state: '默认 / 聚焦 / 搜索中', dataDependency: 'GET /search/suggestions 返回搜索建议' }
      ] },
      { region: 'scrollMain', label: '左右分栏点餐区', slots: [
        { position: 'left', type: 'sideNav', name: '分类导航列表', behavior: '点击后右侧滚动到对应分类', state: '默认 / 选中 / 分类为空', dataDependency: 'GET /categories 返回分类树和排序' },
        { position: 'right', type: 'productList', name: '商品列表', behavior: '展示商品卡片、售罄和加购状态', state: '加载中 / 可售 / 售罄 / 下架', dataDependency: 'GET /products 返回商品、SKU、库存和价格' },
        { position: 'cardAction', type: 'button', name: '加购按钮', behavior: '无规格直接加购，多规格打开弹窗', state: '可点击 / 加购中 / 售罄禁用', dataDependency: 'POST /cart/items 校验 SKU 与库存' }
      ] },
      { region: 'bottomFixed', label: '购物车悬浮栏', slots: [
        { position: 'left', type: 'cartSummary', name: '金额和数量', behavior: '点击打开购物车明细', state: '空购物车 / 有商品 / 价格重算中', dataDependency: 'GET /cart/summary 返回件数、总价和优惠预估' },
        { position: 'right', type: 'button', name: '去结算', behavior: '购物车非空时进入结算', state: '禁用 / 可点击 / loading', dataDependency: 'POST /cart/price 返回试算结果' }
      ] },
      { region: 'overlay', label: '规格选择弹窗', slots: [
        { position: 'body', type: 'optionGroup', name: '杯型/加料/温度/甜度', behavior: '必选项完成后允许加入购物车', state: '未选完 / 已选完 / 组合缺货', dataDependency: 'GET /products/:id/skus 返回规格组合和库存' },
        { position: 'bottom', type: 'button', name: '加入购物车', behavior: '提交 SKU 和数量', state: '禁用 / 可提交 / 提交中', dataDependency: 'POST /cart/items 返回购物车最新摘要' }
      ] }
    ])
  }
  return layouts[page] || [
    { region: 'topFixed', label: '顶部区域', slots: [enrichSlot({ position: 'left', type: 'button', name: '返回或标题', behavior: '导航控制' })] },
    { region: 'scrollMain', label: '主体内容', slots: [enrichSlot({ position: 'main', type: 'contentList', name: '业务内容', behavior: '展示核心信息' })] },
    { region: 'bottomFixed', label: '底部操作', slots: [enrichSlot({ position: 'right', type: 'button', name: '主操作按钮', behavior: '提交或进入下一步' })] }
  ]
}

function pageVisualDefaults(page = '') {
  const visuals = {
    首页: {
      styleTone: '清爽、活力、适合茶饮零售',
      hierarchy: ['门店与搜索优先', '活动 Banner 抢占首屏', '热销商品用价格和加购按钮强化转化'],
      components: [
        { name: '搜索框', type: 'input', visual: '浅灰底圆角输入框，左侧搜索图标，占顶部中间主要宽度', stateStyles: ['默认：#F3F4F6 背景', '聚焦：品牌色描边', '输入中：展示清空按钮'], layoutNote: '放在顶部导航中间，占剩余宽度，左右留 12px' },
        { name: '门店选择', type: 'button', visual: '文本按钮带下拉箭头，超长门店名截断', stateStyles: ['已定位：黑色主文本', '未定位：警示色提示', '门店休息：灰色禁用态'], layoutNote: '顶部左侧，宽度随内容但最大 120px' },
        { name: 'Banner轮播', type: 'carousel', visual: '通栏圆角活动图，首屏露出下一模块顶部', stateStyles: ['加载骨架', '正常轮播', '活动过期隐藏'], layoutNote: '滚动区第一屏，16:7 图片比例' },
        { name: '商品卡片', type: 'card', visual: '图片上方、价格和加购按钮在底部，售罄置灰', stateStyles: ['可售', '售罄：图片灰度+按钮禁用', '活动价：价格红色和活动标签'], layoutNote: '横向滚动卡片，固定卡宽避免滚动抖动' }
      ],
      colorTokens: ['brand.primary', 'surface.page', 'surface.card', 'text.primary', 'status.warning'],
      typography: ['页面标题 18px Semibold', '模块标题 16px Semibold', '商品名 14px', '价格 16px Semibold'],
      spacing: ['顶部导航高度 88rpx，左右安全边距 24rpx', '模块上下间距 24rpx', '卡片内边距 20rpx', '底部 Tab 预留 120rpx'],
      accessibility: ['按钮点击热区不小于 44px', '价格和售罄状态不能只靠颜色区分', '图片必须有业务含义 alt/aria-label']
    },
    点餐: {
      styleTone: '高效率、列表清晰、操作聚焦',
      hierarchy: ['分类导航弱化但固定', '商品图片和价格突出', '底部购物车栏始终可见'],
      components: [
        { name: '分类导航', type: 'sideNav', visual: '左侧窄列，当前分类使用品牌色竖条和加粗文本', stateStyles: ['默认', '选中', '加载骨架'], layoutNote: '左侧固定 168rpx，右侧列表滚动' },
        { name: '商品卡片', type: 'card', visual: '横向卡片，左图右文，右下角加购按钮', stateStyles: ['可售', '售罄：蒙层+禁用', '多规格：按钮显示选规格'], layoutNote: '图片 144rpx 方图，右侧文案最多两行' },
        { name: '规格弹窗', type: 'bottomSheet', visual: '底部抽屉，顶部商品摘要，中部规格组，底部固定确认按钮', stateStyles: ['打开', '选择中', '组合缺货', '提交中'], layoutNote: '高度不超过屏幕 78%，内容区独立滚动' },
        { name: '去结算按钮', type: 'button', visual: '底部右侧高对比主按钮，购物车为空时置灰', stateStyles: ['可点击', '禁用', 'loading'], layoutNote: '固定在购物车栏右侧，最小宽度 220rpx' }
      ],
      colorTokens: ['brand.primary', 'surface.sidebar', 'surface.card', 'text.secondary', 'status.disabled'],
      typography: ['分类 13px', '商品名 15px Semibold', '规格说明 12px', '价格 17px Semibold'],
      spacing: ['左侧分类宽度 168rpx', '商品卡片上下间距 20rpx', '底部购物车栏高度 112rpx', '弹窗底部按钮区高度 128rpx'],
      accessibility: ['加购按钮点击热区不小于 44px', '售罄、缺货、禁用状态必须有文字说明', '弹窗打开后焦点停留在规格区域']
    }
  }
  return visuals[page] || {
    styleTone: '清晰、稳定、任务导向',
    hierarchy: ['主操作优先', '关键数据突出', '异常状态明确'],
    components: [
      { name: '主按钮', type: 'button', visual: '品牌色实心按钮，固定在主要操作位', stateStyles: ['默认', '禁用', 'loading'], layoutNote: '底部或表单末尾主操作位' },
      { name: '输入框', type: 'input', visual: '圆角边框输入框，错误时显示红色边框和提示', stateStyles: ['默认', '聚焦', '错误'], layoutNote: '表单左对齐，标签和错误提示保持同列' }
    ],
    colorTokens: ['brand.primary', 'surface.card', 'text.primary', 'status.error'],
    typography: ['标题 18px Semibold', '正文 14px', '辅助说明 12px'],
    spacing: ['页面左右安全边距 24rpx', '区块间距 24rpx', '表单控件高度 80rpx'],
    accessibility: ['交互控件保留清晰焦点态', '错误提示需要文字说明', '禁用态不能只依赖透明度']
  }
}

function pageInteractionDefaults(page = '') {
  const interactions = {
    首页: [
      { trigger: '点击门店选择', rule: '打开门店弹窗，若定位失败优先展示手动搜索', feedback: '选中门店后刷新首页和点餐数据', affectedComponents: ['顶部门店按钮', '首页活动区', '点餐商品列表'], relatedApi: 'GET /stores/nearby', edgeCases: ['定位权限拒绝', '附近无门店', '门店休息'] },
      { trigger: '点击搜索框', rule: '进入搜索态或搜索页', feedback: '展示历史搜索和热门商品', affectedComponents: ['搜索框', '搜索建议列表'], relatedApi: 'GET /search/suggestions', edgeCases: ['无历史搜索', '关键词为空', '搜索接口失败'] },
      { trigger: '点击 Banner', rule: '按活动配置跳转详情或优惠券', feedback: '活动不可用时提示已结束', affectedComponents: ['Banner轮播', '活动详情页'], relatedApi: 'GET /home/banners', edgeCases: ['活动过期', '跳转参数缺失', '未登录领券'] }
    ],
    点餐: [
      { trigger: '点击商品加购', rule: '无规格商品直接加购，多规格商品打开规格弹窗', feedback: '购物车数量和金额即时更新', affectedComponents: ['商品卡片', '规格弹窗', '购物车悬浮栏'], relatedApi: 'POST /cart/items', edgeCases: ['商品售罄', '规格组合缺货', '加购接口超时'] },
      { trigger: '点击分类导航', rule: '右侧商品列表滚动到对应分类', feedback: '左侧当前分类高亮', affectedComponents: ['分类导航', '商品列表'], relatedApi: 'GET /categories + GET /products', edgeCases: ['分类为空', '滚动锚点丢失'] },
      { trigger: '点击去结算', rule: '购物车非空且门店营业', feedback: '进入购物车/结算，失败时提示库存或营业状态', affectedComponents: ['购物车悬浮栏', '去结算按钮'], relatedApi: 'POST /cart/price', edgeCases: ['购物车为空', '价格变动', '门店打烊'] }
    ]
  }
  return interactions[page] || [
    { trigger: '点击主按钮', rule: '校验必填信息和权限状态', feedback: '成功进入下一步，失败展示错误提示', affectedComponents: ['主按钮', '错误提示'], relatedApi: `POST /${page || 'page'}/actions`, edgeCases: ['权限不足', '网络失败', '重复提交'] },
    { trigger: '输入内容', rule: '实时校验格式和长度', feedback: '错误时展示字段级提示', affectedComponents: ['输入框', '字段错误提示'], relatedApi: '前端本地校验 + 后端提交校验', edgeCases: ['超长输入', '非法字符', '必填为空'] }
  ]
}

function layoutDecisionForFrame(frame = {}, payload = {}) {
  const page = frame.page || '页面'
  const frameText = [
    page,
    ...(frame.topFixed || []),
    ...(frame.scrollModules || []),
    ...(frame.bottomFixed || []),
    ...(frame.layoutHints || [])
  ].join(' ')
  const text = [
    payload.description,
    frameText
  ].join(' ')

  if (/认证|账号入口|登录|注册|OAuth|Discord|Google|Auth Modal|忘记密码|重置密码/.test(text)) {
    return {
      page,
      pageType: '认证与账号入口页面',
      layoutType: /弹窗|Modal/.test(frameText) ? '登录拦截弹窗 + 原流程回填' : (/OAuth|回调/.test(frameText) ? '居中处理中状态页' : '左右分栏价值展示 + 右侧认证表单'),
      reasons: [
        '认证入口守门页是播客创作闭环的入口，不应被当作独立登录表单',
        '用户可能从首页创作入口、工具页、Pricing、下载、分享或保存动作进入，需要保留原始上下文',
        'Google、Discord、邮箱、credits、免费次数、套餐和 AppSumo/LTD 权限需要在登录成功后统一初始化'
      ],
      modules: [
        { name: '认证方式区', layout: '纵向按钮组 + 次级邮箱表单', cardPattern: '品牌 OAuth 按钮 + 表单字段', components: ['Google 登录', 'Discord 登录', '邮箱', '密码', '错误提示'], interactions: ['点击 OAuth 进入授权', '邮箱提交后建立会话', '失败后保留当前输入'] },
        { name: '创作上下文承接区', layout: '隐藏上下文 + 可见提示', cardPattern: '权益说明/来源提示', components: ['source', 'redirect_uri', 'draft_id', 'upload_id', '免费试用次数', 'credits'], interactions: ['登录成功后回到原始创作上下文', '上传文件和输入内容不可丢失'] },
        { name: '权限初始化区', layout: '登录成功后台初始化', cardPattern: '账号资产状态', components: ['workspace', '套餐等级', '最近项目', 'AppSumo/LTD 标记', '第三方 API 权限'], interactions: ['初始化完成后继续主编辑器/工具流程/checkout'] }
      ]
    }
  }

  if (/瀑布流|灵感|案例|作品|社区|封面|点赞|收藏/.test(text)) {
    return {
      page,
      pageType: '内容推荐页',
      layoutType: '瀑布流双列',
      reasons: ['内容以图片封面吸引点击，适合图上文下展示', '卡片高度可能不一致，瀑布流比等高网格更自然', '点赞、收藏、作者和标签适合放在卡片底部形成扫读信息'],
      modules: [
        { name: '筛选区', layout: '横向 Tab + Chip', cardPattern: '横向筛选条', components: ['分类Tab', '标签Chip', '当前选中态'], interactions: ['横向滑动', '点击切换内容分组'] },
        { name: '内容卡片', layout: '双列瀑布流', cardPattern: '图上文下内容卡', components: ['图片封面', '标题2行', '标签/作者', '点赞/收藏'], interactions: ['下拉刷新', '上拉加载', '点击卡片进详情', '点击点赞切换状态'] }
      ]
    }
  }

  if (/点餐|左侧分类|右侧商品|商品列表|购物车悬浮/.test(text)) {
    return {
      page,
      pageType: '商品浏览/点餐页',
      layoutType: '左右分栏 + 右侧卡片流 + 底部悬浮购物车栏',
      reasons: ['分类较多，左侧固定分类栏能降低切换成本', '商品需要展示图片、名称、价格、标签和加购按钮', '点餐过程中需要持续看到购物车金额和去结算入口'],
      modules: [
        { name: '左侧分类栏', layout: '固定宽度纵向列表', cardPattern: '图标+文字分类项', components: ['分类图标', '分类名', '数量角标', '选中高亮'], interactions: ['点击分类 → 右侧滚动到对应分组', '右侧滚动 → 左侧分类自动高亮'] },
        { name: '商品卡片', layout: '右侧滚动列表', cardPattern: '左图右文商品卡', components: ['左：商品图', '右上：商品名 / 标签 / 月售', '右下：价格 / 加购 / 收藏'], interactions: ['点击商品进入详情', '点击加购，无规格直接加购，有规格打开弹窗'] },
        { name: '底部购物车栏', layout: '底部 fixed', cardPattern: '状态+主按钮操作栏', components: ['购物车图标+数量', '合计金额', '去结算按钮'], interactions: ['点击购物车打开明细', '点击去结算校验库存和价格'] }
      ]
    }
  }

  if (/工作台|编辑|脚本|主持人|音色|生成视频|左右分栏/.test(text)) {
    return {
      page,
      pageType: '编辑工作台',
      layoutType: '顶部操作区 + 左右分栏主体 + 底部生成栏',
      reasons: ['左侧承载资源选择，右侧承载主要编辑任务', '顶部保留保存、下载、生成等全局操作', '底部固定生成栏能持续展示比例、消耗和主按钮'],
      modules: [
        { name: '左侧资源区', layout: '固定侧栏', cardPattern: '头像/封面资源卡', components: ['分类Tab', '资源卡片', 'hover预览'], interactions: ['点击切换资源', 'hover预览', '选择后应用到编辑区'] },
        { name: '右侧编辑区', layout: '可滚动编辑面板', cardPattern: '结构化编辑器', components: ['角色名', '段落文本', '停顿/语气标记', '顶部/底部工具条'], interactions: ['编辑文本', '复制/下载', '替换音色', '增加停顿'] },
        { name: '底部生成栏', layout: '底部 fixed', cardPattern: '参数+主按钮操作栏', components: ['比例选择', '生成按钮', '代币消耗提示'], interactions: ['点击生成前校验代币和必填信息'] }
      ]
    }
  }

  if (/结算|支付|订单确认|提交/.test(text)) {
    return {
      page,
      pageType: '结算/提交页',
      layoutType: '信息确认流 + 商品清单 + 底部固定支付栏',
      reasons: ['用户需要先确认履约、商品、优惠和备注，再执行最终提交', '支付金额和支付按钮需要固定在底部减少迷失', '异常重点是价格变动、库存不足和支付失败'],
      modules: [
        { name: '确认信息区', layout: '纵向表单/列表项', cardPattern: '信息确认卡', components: ['履约方式', '地址/门店', '预计时间'], interactions: ['切换履约方式', '选择地址或门店'] },
        { name: '商品清单', layout: '纵向列表', cardPattern: '左图右文商品行', components: ['商品图', '名称/规格', '价格/数量'], interactions: ['展开更多', '修改规格或数量'] },
        { name: '支付栏', layout: '底部 fixed', cardPattern: '金额+主按钮操作栏', components: ['待支付金额', '支付按钮'], interactions: ['点击支付校验库存、价格和权限'] }
      ]
    }
  }

  return {
    page,
    pageType: '通用任务页',
    layoutType: '顶部固定区 + 主体滚动区 + 底部操作区',
    reasons: ['顶部放置导航和关键入口', '主体内容按任务模块纵向组织', '底部保留主操作，便于提交或进入下一步'],
    modules: [
      { name: '主体模块', layout: '纵向卡片流', cardPattern: '标题+内容+操作卡', components: ['标题', '说明', '状态', '主按钮'], interactions: ['点击进入详情', '失败重试'] }
    ]
  }
}

function layoutDecisionDefaults(pageFrames = [], payload = {}) {
  return pageFrames.map((frame) => layoutDecisionForFrame(frame, payload))
}

function apiDataDefaults(page = '') {
  const detailed = {
    首页: {
      '/stores/nearby': {
        sourceName: '门店服务',
        requestParams: ['latitude: number 用户纬度', 'longitude: number 用户经度', 'deliveryMode: pickup|delivery 履约方式'],
        responseFields: ['storeId: string 门店ID', 'storeName: string 门店名称', 'distance: number 距离', 'businessStatus: open|closed 营业状态', 'deliveryModes: string[] 支持履约方式'],
        errorCodes: ['LOCATION_DENIED 定位权限拒绝', 'STORE_OUT_OF_RANGE 附近无可用门店', 'STORE_CLOSED 当前门店休息'],
        cachePolicy: '定位坐标 5 分钟内复用，门店营业状态每次进入首页刷新',
        frontendUsage: '用于顶部门店选择、自提/外卖切换、首页活动和点餐页商品可售判断',
        backendLogic: '后端按定位坐标、配送范围、营业时间和门店状态返回最近可用门店'
      },
      '/home/banners': {
        sourceName: '营销活动服务',
        requestParams: ['storeId: string 当前门店', 'scene: home 首页场景', 'memberLevel?: string 会员等级'],
        responseFields: ['bannerId: string', 'imageUrl: string', 'jumpType: product|coupon|activity', 'jumpPayload: object', 'validUntil: string'],
        errorCodes: ['ACTIVITY_EXPIRED 活动过期', 'BANNER_EMPTY 无活动位'],
        cachePolicy: '首页会话内缓存，手动下拉刷新强制更新',
        frontendUsage: '用于 Banner 轮播、活动跳转和过期隐藏',
        backendLogic: '后端按门店、时间、会员等级过滤可展示活动'
      },
      '/products/hot': {
        sourceName: '商品推荐服务',
        requestParams: ['storeId: string 当前门店', 'categoryId?: string 推荐分类', 'limit: number 返回数量'],
        responseFields: ['productId: string', 'name: string', 'imageUrl: string', 'price: number', 'stockStatus: available|soldOut', 'activityTag?: string'],
        errorCodes: ['PRODUCT_EMPTY 无热销商品', 'STORE_OFFLINE 门店不可售'],
        cachePolicy: '30 秒短缓存，切换门店立即失效',
        frontendUsage: '用于热销商品卡片、价格展示、售罄态和加购入口',
        backendLogic: '后端聚合销量、库存、门店上下架和活动价'
      }
    },
    点餐: {
      '/categories': {
        sourceName: '分类服务',
        requestParams: ['storeId: string 当前门店'],
        responseFields: ['categoryId: string', 'name: string', 'sort: number', 'badge?: string'],
        errorCodes: ['CATEGORY_EMPTY 分类为空'],
        cachePolicy: '切换门店失效，当前门店会话内缓存',
        frontendUsage: '用于左侧分类导航和右侧锚点',
        backendLogic: '后端按门店售卖范围和排序返回分类树'
      },
      '/products': {
        sourceName: '商品服务',
        requestParams: ['storeId: string 当前门店', 'categoryId?: string 分类ID'],
        responseFields: ['productId: string', 'name: string', 'skuType: single|multi', 'price: number', 'stockStatus: string', 'specGroups: array'],
        errorCodes: ['PRODUCT_EMPTY 商品为空', 'SKU_UNAVAILABLE SKU不可售'],
        cachePolicy: '列表 30 秒缓存，库存字段加购前重新校验',
        frontendUsage: '用于商品列表、商品卡片、售罄和多规格入口',
        backendLogic: '后端聚合商品、SKU、库存、价格和上下架状态'
      },
      '/cart/items': {
        sourceName: '购物车服务',
        requestParams: ['skuId: string SKU ID', 'quantity: number 数量', 'specs: object 已选规格'],
        responseFields: ['cartId: string', 'totalQuantity: number', 'totalAmount: number', 'items: array'],
        errorCodes: ['SKU_SOLD_OUT SKU售罄', 'SPEC_REQUIRED 规格未选完', 'CART_UPDATE_FAILED 加购失败'],
        cachePolicy: '不缓存，提交后返回服务端最新购物车摘要',
        frontendUsage: '用于加购按钮、规格弹窗确认和购物车悬浮栏刷新',
        backendLogic: '后端校验 SKU、库存、限购、价格后写入购物车'
      }
    }
  }
  const defaults = pageDetailDefaults(page)
  return defaults.apiOwnership.map((line) => {
    const [method = 'GET', endpoint = `/${page || 'page'}`] = line.split(' ')
    const detail = detailed[page]?.[endpoint] || {}
    return {
      page,
      sourceName: detail.sourceName || defaults.dataSources[0] || '业务服务',
      endpoint,
      method,
      owner: 'backend',
      usedBy: defaults.frontendTasks,
      fields: ['id', 'name', 'status', 'updatedAt'],
      requestParams: detail.requestParams || ['pageContext: string 页面上下文', 'userId?: string 登录用户ID'],
      responseFields: detail.responseFields || ['id: string 主键', 'name: string 展示名称', 'status: string 状态', 'updatedAt: string 更新时间'],
      errorCodes: detail.errorCodes || ['NETWORK_ERROR 网络失败', 'PERMISSION_DENIED 权限不足', 'DATA_EMPTY 数据为空'],
      cachePolicy: detail.cachePolicy || '按页面会话短缓存，关键操作后主动刷新',
      frontendUsage: detail.frontendUsage || defaults.frontendTasks.join('；'),
      backendLogic: detail.backendLogic || defaults.backendTasks.join('；'),
      fallback: defaults.states.includes('空状态') ? '展示空状态' : '保留当前页面并提示重试'
    }
  })
}

function enrichApiDataItem(item = {}) {
  const page = String(item.page || '').trim()
  const method = String(item.method || 'GET').trim().toUpperCase()
  let endpoint = String(item.endpoint || '').trim()
  let resolvedMethod = method
  if (/^(GET|POST|PUT|PATCH|DELETE)\s+\//i.test(endpoint)) {
    const [inlineMethod, inlineEndpoint] = endpoint.split(/\s+/, 2)
    resolvedMethod = inlineMethod.toUpperCase()
    endpoint = inlineEndpoint
  }
  const fallback = apiDataDefaults(page).find((api) => api.endpoint === endpoint && api.method === resolvedMethod)
    || apiDataDefaults(page)[0]
    || {}
  return {
    page,
    sourceName: String(item.sourceName || item.name || fallback.sourceName || '接口数据').trim(),
    endpoint: endpoint || fallback.endpoint || '',
    method: resolvedMethod,
    owner: String(item.owner || fallback.owner || 'backend').trim(),
    usedBy: normalizeTextList(item.usedBy?.length ? item.usedBy : fallback.usedBy),
    fields: normalizeTextList(item.fields?.length ? item.fields : fallback.fields),
    requestParams: normalizeTextList(item.requestParams?.length ? item.requestParams : fallback.requestParams),
    responseFields: normalizeTextList(item.responseFields?.length ? item.responseFields : fallback.responseFields),
    errorCodes: normalizeTextList(item.errorCodes?.length ? item.errorCodes : fallback.errorCodes),
    cachePolicy: String(item.cachePolicy || fallback.cachePolicy || '按页面会话短缓存，关键操作后主动刷新').trim(),
    frontendUsage: String(item.frontendUsage || fallback.frontendUsage || '前端用于页面渲染、交互状态和错误提示').trim(),
    backendLogic: String(item.backendLogic || fallback.backendLogic || '后端负责数据聚合、权限判断和错误码').trim(),
    fallback: String(item.fallback || fallback.fallback || '展示失败提示并允许重试').trim()
  }
}

function flowTransitionDefaults(frames = []) {
  const pages = frames.map((frame) => frame.page || frame.name).filter(Boolean)
  const base = []
  if (pages.includes('首页') && pages.includes('点餐')) {
    base.push({ from: '首页', to: '点餐', trigger: '点击底部 Tab「点餐」或快捷入口', precondition: '已选择门店', successFeedback: '进入点餐页并加载分类商品', failureFeedback: '未定位时打开门店选择' })
  }
  if (pages.includes('点餐') && pages.includes('购物车')) {
    base.push({ from: '点餐', to: '购物车', trigger: '点击底部购物车栏或去结算', precondition: '购物车非空', successFeedback: '展示购物车明细和金额', failureFeedback: '库存不足或购物车为空提示' })
  }
  if (pages.includes('购物车') && pages.includes('订单')) {
    base.push({ from: '购物车', to: '订单', trigger: '提交订单并支付成功', precondition: '价格有效且库存锁定成功', successFeedback: '生成订单并展示取餐码', failureFeedback: '支付失败、价格变动或门店打烊提示' })
  }
  return base.length ? base : [{ from: pages[0] || '当前页', to: '下一页', trigger: '点击主操作按钮', precondition: '信息完整', successFeedback: '进入下一步', failureFeedback: '展示错误提示并保留输入' }]
}

function firstJsonObject(text = '') {
  const source = String(text || '').trim()
  if (!source) return null
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || source
  try {
    return JSON.parse(candidate)
  } catch {}
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizeTab(tab = {}) {
  const defaults = pageDetailDefaults(tab.name)
  return {
    name: String(tab.name || '').trim(),
    children: normalizeTextList(tab.children),
    modals: normalizeTextList(tab.modals),
    dataSources: normalizeTextList(tab.dataSources?.length ? tab.dataSources : defaults.dataSources),
    apiOwnership: normalizeTextList(tab.apiOwnership?.length ? tab.apiOwnership : defaults.apiOwnership)
  }
}

function normalizePageFrame(frame = {}) {
  const defaults = pageDetailDefaults(frame.page)
  return {
    page: String(frame.page || '').trim(),
    projectName: String(frame.projectName || '').trim(),
    topFixed: normalizeTextList(frame.topFixed),
    scrollModules: normalizeTextList(frame.scrollModules),
    bottomFixed: normalizeTextList(frame.bottomFixed),
    overlays: normalizeTextList(frame.overlays),
    layoutHints: normalizeTextList(frame.layoutHints),
    states: normalizeTextList(frame.states?.length ? frame.states : defaults.states),
    dataSources: normalizeTextList(frame.dataSources?.length ? frame.dataSources : defaults.dataSources),
    apiOwnership: normalizeTextList(frame.apiOwnership?.length ? frame.apiOwnership : defaults.apiOwnership),
    frontendTasks: normalizeTextList(frame.frontendTasks?.length ? frame.frontendTasks : defaults.frontendTasks),
    backendTasks: normalizeTextList(frame.backendTasks?.length ? frame.backendTasks : defaults.backendTasks)
  }
}

export function normalizeDiagramData(data = {}) {
  const projectName = String(data.projectName || data.structureTree?.root || '业务应用').trim()
  const pageFrames = (Array.isArray(data.pageFrames) ? data.pageFrames : []).map(normalizePageFrame)
  return {
    projectName,
    businessType: String(data.businessType || 'custom_application').trim(),
    structureTree: {
      root: String(data.structureTree?.root || projectName).trim(),
      tabs: (Array.isArray(data.structureTree?.tabs) ? data.structureTree.tabs : []).map(normalizeTab),
      globalCapabilities: normalizeTextList(data.structureTree?.globalCapabilities)
    },
    pageFrames,
    apiData: Array.isArray(data.apiData) && data.apiData.length
      ? data.apiData.map(enrichApiDataItem)
      : pageFrames.flatMap((frame) => apiDataDefaults(frame.page)),
    layoutBlueprints: Array.isArray(data.layoutBlueprints) && data.layoutBlueprints.length
      ? data.layoutBlueprints
      : pageFrames.map((frame) => ({ page: frame.page, regions: pageLayoutDefaults(frame.page) })),
    visualSpecs: Array.isArray(data.visualSpecs) && data.visualSpecs.length
      ? data.visualSpecs
      : pageFrames.map((frame) => ({ page: frame.page, ...pageVisualDefaults(frame.page) })),
    layoutDecisions: Array.isArray(data.layoutDecisions) && data.layoutDecisions.length
      ? data.layoutDecisions
      : layoutDecisionDefaults(pageFrames, data),
    flowTransitions: Array.isArray(data.flowTransitions) && data.flowTransitions.length
      ? data.flowTransitions
      : flowTransitionDefaults(pageFrames),
    interactionSpecs: Array.isArray(data.interactionSpecs) && data.interactionSpecs.length
      ? data.interactionSpecs
      : pageFrames.map((frame) => ({ page: frame.page, interactions: pageInteractionDefaults(frame.page) }))
  }
}

export function validateDiagramData(data = {}) {
  const errors = []
  const normalized = normalizeDiagramData(data)
  if (!normalized.projectName) errors.push('projectName is required')
  if (!normalized.structureTree.root) errors.push('structureTree.root is required')
  if (!normalized.structureTree.tabs.length) errors.push('structureTree.tabs must contain at least one tab')
  normalized.structureTree.tabs.forEach((tab, index) => {
    if (!tab.name) errors.push(`structureTree.tabs[${index}].name is required`)
  })
  if (!normalized.pageFrames.length) errors.push('pageFrames must contain at least one page frame')
  normalized.pageFrames.forEach((frame, index) => {
    if (!frame.page) errors.push(`pageFrames[${index}].page is required`)
    if (!frame.topFixed.length) errors.push(`pageFrames[${index}].topFixed must contain at least one item`)
    if (!frame.scrollModules.length) errors.push(`pageFrames[${index}].scrollModules must contain at least one item`)
    if (!frame.bottomFixed.length) errors.push(`pageFrames[${index}].bottomFixed must contain at least one item`)
  })
  return { ok: errors.length === 0, errors, data: normalized }
}

function inferPreset(payload = {}) {
  const businessType = String(payload.businessType || '').trim()
  if (BUSINESS_PRESETS[businessType]) return BUSINESS_PRESETS[businessType]
  const description = String(payload.description || '')
  if (/Podcastor|播客|Podcast/i.test(description) && /认证|账号入口|登录|注册|OAuth|Discord|Google|Auth Modal|忘记密码|重置密码/i.test(description)) return BUSINESS_PRESETS.podcast_ai_auth
  if (/Podcastor|播客|Podcast|脚本|音色|主持人/.test(description)) return BUSINESS_PRESETS.podcast_ai_workspace
  if (/茶饮|奶茶|点单|点餐|取餐/.test(description)) return BUSINESS_PRESETS.tea_shop_mini_program
  if (/瀑布流|灵感|案例|作品|社区|封面|点赞|收藏/.test(description)) {
    return {
      projectName: payload.projectName || '内容推荐应用',
      tabs: [
        {
          name: '内容推荐页',
          children: ['内容详情'],
          modals: ['预览弹窗', '分享弹窗'],
          topFixed: ['搜索', '分类入口', '消息'],
          scrollModules: ['筛选区', '灵感案例瀑布流', '内容卡片'],
          bottomFixed: ['底部Tab或发布按钮'],
          overlays: ['预览弹窗'],
          layoutHints: ['顶部固定', '瀑布流双列', '主体滚动', '上拉加载']
        }
      ],
      globalCapabilities: ['登录', '收藏', '点赞', '空状态', '加载态', '失败重试']
    }
  }
  return {
    projectName: payload.projectName || '业务应用',
    tabs: [
      {
        name: '首页',
        children: ['详情页'],
        modals: ['提示弹窗'],
        topFixed: ['导航栏', '搜索入口'],
        scrollModules: ['核心内容', '推荐模块', '列表模块'],
        bottomFixed: ['底部操作区'],
        overlays: ['提示弹窗'],
        layoutHints: ['顶部固定', '主体滚动', '底部固定']
      }
    ],
    globalCapabilities: ['登录', '权限', '加载态', '失败重试', '空状态']
  }
}

function explicitProjectNameFromDescription(description = '') {
  const text = String(description || '')
  const projectLine = text.match(/project\s*[:：]\s*([^\n]+)/i)
  if (projectLine?.[1]) {
    return projectLine[1]
      .replace(/(认证页面|账号入口页面|登录页面|首页|项目|产品)\s*$/i, '')
      .trim()
  }
  const brandMatch = text.match(/\b([A-Z][A-Za-z0-9.-]*(?:\.ai|AI))\b/)
  return brandMatch?.[1]?.trim() || ''
}

function resolvePresetProjectName(payload = {}, preset = {}) {
  return String(payload.projectName || explicitProjectNameFromDescription(payload.description) || preset.projectName || '业务应用').trim()
}

export function buildDiagramData(payload = {}) {
  const preset = inferPreset(payload)
  const projectName = resolvePresetProjectName(payload, preset)
  const tabs = preset.tabs.map(normalizeTab)
  return {
    projectName,
    businessType: payload.businessType || 'custom_application',
    structureTree: {
      root: projectName,
      tabs,
      globalCapabilities: normalizeTextList(preset.globalCapabilities)
    },
    pageFrames: preset.tabs.map((tab) => normalizePageFrame({
      page: tab.name,
      projectName,
      topFixed: tab.topFixed,
      scrollModules: tab.scrollModules,
      bottomFixed: tab.bottomFixed,
      overlays: tab.overlays,
      layoutHints: tab.layoutHints,
      states: tab.states,
      dataSources: tab.dataSources,
      apiOwnership: tab.apiOwnership,
      frontendTasks: tab.frontendTasks,
      backendTasks: tab.backendTasks
    })),
    apiData: preset.tabs.flatMap((tab) => apiDataDefaults(tab.name)),
    layoutBlueprints: preset.tabs.map((tab) => ({ page: tab.name, regions: pageLayoutDefaults(tab.name) })),
    visualSpecs: preset.tabs.map((tab) => ({ page: tab.name, ...pageVisualDefaults(tab.name) })),
    layoutDecisions: layoutDecisionDefaults(preset.tabs.map((tab) => normalizePageFrame({
      page: tab.name,
      projectName,
      topFixed: tab.topFixed,
      scrollModules: tab.scrollModules,
      bottomFixed: tab.bottomFixed,
      overlays: tab.overlays,
      layoutHints: tab.layoutHints
    })), payload),
    flowTransitions: flowTransitionDefaults(preset.tabs),
    interactionSpecs: preset.tabs.map((tab) => ({ page: tab.name, interactions: pageInteractionDefaults(tab.name) }))
  }
}

export function buildDiagramPrompt(payload = {}) {
  return [
    '你是产品架构和前后端协作助手。请把用户需求拆成结构层信息架构和框架层页面布局。',
    '只输出 JSON，不要 Markdown，不要解释。',
    'JSON 字段必须为：projectName, businessType, structureTree, pageFrames, apiData, layoutBlueprints, visualSpecs, layoutDecisions, flowTransitions, interactionSpecs。',
    'structureTree.tabs 每项必须包含 name, children, modals。',
    'pageFrames 每项必须包含 page, topFixed, scrollModules, bottomFixed, overlays, layoutHints。',
    'topFixed、scrollModules、bottomFixed 至少各 1 项。',
    `业务类型：${payload.businessType || 'custom_application'}`,
    `需求描述：${payload.description || ''}`
  ].join('\n')
}

export function buildDiagramModelContext(payload = {}) {
  const systemPrompt = [
    '你是产品架构和前后端协作助手。请把用户需求拆成结构层信息架构和框架层页面布局。',
    '只输出 JSON，不要 Markdown，不要解释。',
    'JSON 字段必须为：projectName, businessType, structureTree, pageFrames。',
    'structureTree 必须包含 root, tabs, globalCapabilities。',
    'structureTree.tabs 每项必须包含 name, children, modals；建议补充 dataSources 和 apiOwnership。',
    'pageFrames 每项必须包含 page, topFixed, scrollModules, bottomFixed, overlays, layoutHints。',
    'pageFrames 每项建议补充 states, dataSources, apiOwnership, frontendTasks, backendTasks。',
    'apiData 是接口数据，不要命名为推荐源；每项包含 page, sourceName, endpoint, method, owner, usedBy, fields, fallback。',
    'layoutBlueprints 描述按钮、输入框、列表、卡片、Tab、弹窗分别放在哪个 region/position。',
    'layoutDecisions 描述模型推荐方案：page, pageType, layoutType, reasons, modules[{name, layout, cardPattern, components, interactions}]。',
    'layoutType 必须从这些布局中选择或组合：瀑布流双列、卡片流、信息流、左右分栏、表单流、结算流、编辑工作台。',
    'visualSpecs 描述视觉层：styleTone, hierarchy, components, colorTokens, typography。',
    'flowTransitions 描述页面跳转：from, to, trigger, precondition, successFeedback, failureFeedback。',
    'interactionSpecs 描述交互说明：page, interactions[{trigger, rule, feedback}]。',
    'topFixed、scrollModules、bottomFixed 至少各 1 项。',
    '输出必须能被 JSON.parse 直接解析。'
  ].join('\n')
  const userPrompt = [
    `业务类型：${payload.businessType || 'custom_application'}`,
    `需求描述：${payload.description || ''}`
  ].join('\n')
  return {
    skillId: 'diagram-generator',
    action: 'generate-structured-diagram',
    prompt: `${systemPrompt}\n\n${userPrompt}`,
    systemPrompt,
    userPrompt,
    input: payload.description || '',
    outputSchema: 'diagram-data-json',
    responseFormat: 'json',
    maxOutputTokens: 3200
  }
}

function treeLines(data = {}) {
  const tree = data.structureTree || {}
  const tabs = tree.tabs || []
  const lines = [tree.root || data.projectName || '应用']
  tabs.forEach((tab, tabIndex) => {
    const tabLast = tabIndex === tabs.length - 1 && !(tree.globalCapabilities || []).length
    lines.push(`${tabLast ? '└─' : '├─'}${tab.name}`)
    const children = [
      ...normalizeTextList(tab.children).map((name) => `子页：${name}`),
      ...normalizeTextList(tab.modals).map((name) => `弹窗：${name}`),
      ...(tab.dataSources?.length ? [`数据来源：${tab.dataSources.join(' / ')}`] : []),
      ...(tab.apiOwnership?.length ? [`接口归属：${tab.apiOwnership.join(' / ')}`] : [])
    ]
    children.forEach((child, childIndex) => {
      lines.push(`${tabLast ? '  ' : '│ '} ${childIndex === children.length - 1 ? '└─' : '├─'}${child}`)
    })
  })
  const capabilities = normalizeTextList(tree.globalCapabilities)
  if (capabilities.length) {
    lines.push('└─公共底层能力')
    capabilities.forEach((name, index) => {
      lines.push(`   ${index === capabilities.length - 1 ? '└─' : '├─'}${name}`)
    })
  }
  return lines
}

function visualLength(value = '') {
  return Array.from(String(value)).reduce((sum, char) => {
    const code = char.charCodeAt(0)
    if (code >= 0x2500 && code <= 0x257f) return sum + 1
    return sum + (code > 255 ? 2 : 1)
  }, 0)
}

function padRight(value = '', width = 0) {
  const size = Math.max(0, width - visualLength(value))
  return `${value}${' '.repeat(size)}`
}

function frameBlock(title, rows) {
  const contentRows = [title, ...rows].map((row) => String(row || ''))
  const width = Math.max(...contentRows.map(visualLength), 16) + 2
  const output = [`┌${'─'.repeat(width)}┐`]
  contentRows.forEach((row, index) => {
    output.push(`│ ${padRight(row, width - 2)} │`)
    if (index === 0) output.push(`├${'─'.repeat(width)}┤`)
  })
  output.push(`└${'─'.repeat(width)}┘`)
  return output.join('\n')
}

function wireLine(text = '', width = 46) {
  return `│ ${padRight(text, width - 2)} │`
}

function wireSep(width = 46) {
  return `├${'─'.repeat(width)}┤`
}

function wireTop(width = 46) {
  return `┌${'─'.repeat(width)}┐`
}

function wireBottom(width = 46) {
  return `└${'─'.repeat(width)}┘`
}

function moduleLabel(name = '', index = 0, page = '') {
  const homeMap = {
    Banner轮播: 'Banner通栏轮播区',
    快捷入口: '4宫格快捷入口区块',
    分类标签: '横向分类标签滑动区',
    热销商品: '热销横向商品卡片',
    限时秒杀: '限时秒杀两列网格'
  }
  const orderMap = {
    订单卡片: '订单卡片列表',
    制作状态: '制作状态提示',
    支付状态: '支付状态提示',
    售后入口: '售后/退款入口'
  }
  const cartMap = {
    商品清单: '商品清单列表',
    优惠券入口: '优惠券选择入口',
    金额明细: '金额明细区',
    备注与餐具: '备注与餐具选择'
  }
  const mineMap = {
    会员资产: '会员资产卡片',
    营销入口: '储值/积分/签到入口',
    工具入口: '地址/反馈/设置入口',
    服务入口: '客服/门店/关于入口'
  }
  const maps = { 首页: homeMap, 购物车: cartMap, 订单: orderMap, 我的: mineMap }
  return `模块${index + 1}：${maps[page]?.[name] || name}`
}

function moduleDetails(name = '', page = '') {
  const text = String(name || '')
  const details = {
    首页: {
      Banner轮播: ['图片 + 标题 + 副标题', '跳转按钮 / 活动角标', '新人券 / 秒杀 / 会员专享'],
      快捷入口: ['4宫格：图标+文字', '点餐 / 优惠券 / 会员 / 活动'],
      分类标签: ['横向Tab：图标+文字 / 选中态', '点击后切换下方推荐商品'],
      热销商品: ['横向卡：左图右文商品卡', '商品名 / 月售 / 价格/划线价', '点赞/收藏 + 加购按钮'],
      限时秒杀: ['瀑布流/两列网格', '商品图 / 倒计时 / 秒杀价', '库存条 / 立即抢购按钮']
    },
    购物车: {
      商品清单: ['左图右文商品行', '商品图 / 名称 / 规格 / 数量加减', '价格/划线价 / 删除按钮'],
      优惠券入口: ['图标+文字入口', '可用张数 / 不可用提示 / 右箭头'],
      金额明细: ['小计 / 优惠 / 配送费 / 实付金额', '价格变动提示 / 重新试算'],
      备注与餐具: ['输入框 / 单选项', '备注文本 / 餐具数量 / 发票入口']
    },
    订单: {
      订单卡片: ['订单状态标签 + 商品缩略图 + 实付金额 + 操作按钮', '取餐码 / 再来一单 / 退款 / 评价'],
      制作状态: ['步骤条：已下单 / 制作中 / 待取餐', '状态文案 + 预计完成时间'],
      支付状态: ['支付金额 / 支付方式 / 倒计时', '去支付 / 取消订单按钮'],
      售后入口: ['客服图标+文字 / 退款入口', '退款状态 / 售后进度 / 联系门店']
    },
    我的: {
      会员资产: ['头像 + 昵称 + 会员等级', '积分 + 卡券 + 余额', '成长值进度条 / 会员权益入口'],
      营销入口: ['宫格：图标+文字', '储值 / 积分商城 / 签到 / 卡包'],
      工具入口: ['列表：图标+文字+右箭头', '地址 / 反馈 / 设置 / 发票'],
      服务入口: ['客服 / 门店 / 关于入口', '客服电话 / 营业时间 / 门店地图']
    }
  }
  const exact = details[page]?.[name]
  if (exact) return exact

  const semanticRules = [
    [/画面比例|当前比例|比例上下文|参数上下文|默认值|默认来源|selectedAspectRatio|targetAspectRatio|actualAspectRatio|比例 Tab/i, ['参数选项：16:9 / 9:16 / 其他可用值', '默认值来源：当前Tab或上游选择', '选中态 / 已修改 / 不可用状态']],
    [/虚线画框|框选|cropBox|裁剪框|上传图片预览|照片上传|已选照片/i, ['上传图片预览画布', '虚线框：拖拽 / 缩放 / 边界限制', '提交字段：cropBox + targetAspectRatio']],
    [/生成中|任务状态|generationTaskId|结果归位|不匹配/i, ['任务状态：排队 / 生成中 / 成功 / 失败', '结果校验：targetAspectRatio vs actualAspectRatio', '不匹配时自动切换到结果对应Tab']],
    [/背景图|多比例素材|assetRatioVariants|素材配置/i, ['背景图预览', '多参数素材映射', '缺失 / 已配置 / 生成中状态']],
    [/入口覆盖范围|入口模式|Speaker Focus|Cartoon|Pet|Generate From Reference|Use your Photo|Photo to Host/i, ['入口类型标签组', '当前入口说明 / 可用参数', '切换入口后保留素材与生成上下文']],
    [/样式增强|选中态|悬停态|禁用态/i, ['按钮状态：默认 / hover / 选中 / disabled', '状态差异：边框 / 背景 / 字重 / 辅助文案', '键盘与移动端点击态']],
    [/\bJogg\b|Home|Tools|Studio|Voice|Projects/i, ['Jogg 导航项 + 当前选中态', '入口说明 / 最近任务 / 状态角标', '点击进入对应工作区']],
    [/Media|My Media|Stock|AI Generate|Pexels|Pixabay|b-?roll/i, ['素材来源 Tab / 素材卡片列表', 'My Media Upload/Capture/Search from Space', 'Stock Pexels/Pixabay / AI Generate Image/Video']],
    [/优惠券|券|领券/, ['优惠券卡片 / 优惠券列表', '满减金额 / 使用门槛 / 有效期', '选择态 / 不可用原因 / 右箭头']],
    [/积分|抵扣/, ['积分余额 / 抵扣开关', '可抵扣金额 / 抵扣规则', '勾选态 / 不足提示']],
    [/备注|输入|留言/, ['多行输入框 / 字数限制', '快捷提示 / 示例标签 / 最近使用', '清空按钮 / 错误提示']],
    [/金额|价格|合计|明细|实付/, ['金额明细列表', '商品小计 / 优惠 / 配送费', '实付金额高亮 / 价格变动提示']],
    [/商品|热销|推荐|列表/, ['左图右文商品卡', '商品图 / 商品名 / 月售', '价格/划线价 / 加购按钮']],
    [/秒杀|活动|瀑布流|两列/, ['瀑布流/两列网格', '商品图 / 倒计时 / 活动价', '库存条 / 立即抢购按钮']],
    [/订单/, ['订单状态标签 + 商品缩略图 + 实付金额 + 操作按钮', '取餐码 / 再来一单 / 退款 / 评价']],
    [/会员|资产|等级/, ['头像 + 昵称 + 会员等级', '积分 + 卡券 + 余额', '成长值进度条 / 会员权益入口']],
    [/储值|签到|卡包|商城/, ['宫格：图标+文字', '储值 / 积分商城 / 签到 / 卡包', '角标：新权益 / 可领取']],
    [/地址|反馈|设置|工具|发票/, ['列表：图标+文字+右箭头', '地址 / 反馈 / 设置 / 发票', '默认地址 / 状态标签']],
    [/客服|门店|关于|服务/, ['客服 / 门店 / 关于入口', '客服电话 / 营业时间 / 门店地图', '图标+文字 / 右箭头']],
    [/分类|标签|Tab/, ['横向Tab：图标+文字 / 选中态', '分类名称 / 数量角标', '点击后切换内容列表']],
    [/Banner|轮播|广告/, ['图片 + 标题 + 副标题', '跳转按钮 / 活动角标', '轮播指示器 / 曝光埋点']],
    [/入口|宫格|快捷/, ['宫格：图标+文字', '主入口 / 营销入口 / 工具入口', '角标 / 红点 / 禁用态']]
  ]
  const matched = semanticRules.find(([pattern]) => pattern.test(text))
  return matched?.[1] || ['内容类型待确认', '建议补：图片/标题/价格/按钮/状态', '空状态 / 加载态 / 失败重试']
}

function moduleLayoutLines(name = '', page = '') {
  const text = `${page} ${name}`
  if (/画面比例|当前比例|比例上下文|参数上下文|默认值|默认来源|selectedAspectRatio|targetAspectRatio|actualAspectRatio|比例 Tab/i.test(text)) {
    return ['布局：横向参数Tab / 单选按钮组', '左：参数标签；右：当前默认值说明', '状态：默认 / 已修改 / 不匹配归位']
  }
  if (/虚线画框|框选|cropBox|裁剪框|上传图片预览|照片上传|已选照片/i.test(text)) {
    return ['布局：图片预览画布 + 覆盖虚线框', '虚线框支持拖拽/缩放，保持目标比例', '底部展示 cropBox 数值和确认按钮']
  }
  if (/生成中|任务状态|generationTaskId|结果归位|不匹配/i.test(text)) {
    return ['布局：任务状态卡片 + 参数对照', '展示 targetAspectRatio / actualAspectRatio', '不匹配时提示并切换到结果对应Tab']
  }
  if (/背景图|多比例素材|assetRatioVariants|素材配置/i.test(text)) {
    return ['布局：背景图预览 + 参数素材列表', '每个参数一行：素材预览 / 状态 / 操作', '缺失时展示生成或上传入口']
  }
  if (/入口覆盖范围|入口模式|Speaker Focus|Cartoon|Pet|Generate From Reference|Use your Photo|Photo to Host/i.test(text)) {
    return ['布局：入口类型标签组 + 当前入口面板', '展示可用参数、素材要求和生成按钮', '切换入口时保留当前素材上下文']
  }
  if (/样式增强|选中态|悬停态|禁用态/i.test(text)) {
    return ['布局：按钮状态对照行', '展示默认/hover/选中/disabled 差异', '移动端点击态与可访问状态同步']
  }
  if (/\bJogg\b|Home|Tools|Studio|Voice|Projects/i.test(text)) {
    return ['布局：左侧导航 + 主区域入口卡片', '入口：标题 / 说明 / 最近状态', '右侧：进入按钮 / 状态角标']
  }
  if (/Media|My Media|Stock|AI Generate|Pexels|Pixabay|b-?roll/i.test(text)) {
    return ['布局：顶部素材来源Tab + 卡片网格', '卡片：预览图 / 来源 / 操作按钮', '状态：上传中 / 检索中 / 生成中 / 失败重试']
  }
  if (/商品|热销|列表/.test(text)) {
    return ['布局：左图右文，右侧上下排布', '左：商品图片；右上：标题/标签', '右下：价格 + 加购/点赞按钮']
  }
  if (/瀑布流|灵感|案例|作品|社区|封面/.test(text)) {
    return ['布局：瀑布流双列，图上文下', '上：图片封面；中：标题2行', '下：标签/作者 + 点赞/收藏']
  }
  if (/Banner|轮播|广告/.test(text)) {
    return ['布局：通栏大图，上叠标题文案', '左下：标题/副标题；右下：按钮']
  }
  if (/地址|反馈|设置|工具|发票|客服|门店|关于|服务/.test(text)) {
    return ['布局：纵向列表单元格', '左：图标+文字；右：状态/箭头']
  }
  if (/分类|标签|Tab/.test(text)) {
    return ['布局：横向滑动Tab', '图标+文字 / 选中下划线 / 数量角标']
  }
  if (/入口|宫格|快捷|营销|储值|签到|卡包/.test(text)) {
    return ['布局：宫格排列', '每格：图标在上，文字在下', '支持红点/角标/禁用态']
  }
  if (/优惠券|券|领券/.test(text)) {
    return ['布局：券卡横向，左金额右规则', '右侧：选择按钮/不可用原因']
  }
  if (/积分|抵扣/.test(text)) {
    return ['布局：左说明右开关', '下方展示可抵扣金额和规则']
  }
  if (/备注|输入|留言/.test(text)) {
    return ['布局：标题在上，多行输入框在下', '右下显示字数，底部快捷标签']
  }
  if (/会员|资产|等级/.test(text)) {
    return ['布局：头像左，昵称/会员等级右', '下方三栏：余额 | 积分 | 优惠券']
  }
  if (/订单/.test(text)) {
    return ['布局：卡片头部状态，主体商品行', '底部：实付金额 + 操作按钮']
  }
  return ['布局：卡片头部 / 主体 / 底部操作', '主体按图片/文字/列表内容自适配']
}

function renderModuleBox(name = '', index = 0, page = '', width = 46) {
  const innerWidth = width - 12
  const lines = [
    wireLine('', width),
    wireLine(`  ┌${'─'.repeat(innerWidth)}┐`, width),
    wireLine(`  │ ${padRight(moduleLabel(name, index, page), innerWidth - 2)} │`, width),
    wireLine(`  │ 【卡片头部 可选区】标题 / 更多 > │`, width),
    wireLine(`  ├${'─'.repeat(innerWidth)}┤`, width),
    wireLine(`  │ 卡片主体内容区                   │`, width)
  ]
  moduleLayoutLines(name, page).forEach((detail) => {
    lines.push(wireLine(`  │   ${padRight(detail, innerWidth - 4)} │`, width))
  })
  moduleDetails(name, page).forEach((detail) => {
    lines.push(wireLine(`  │   ${padRight(detail, innerWidth - 4)} │`, width))
  })
  lines.push(wireLine(`  ├${'─'.repeat(innerWidth)}┤`, width))
  lines.push(wireLine(`  │ 【卡片底部 可选区】按钮/价格/状态 │`, width))
  lines.push(wireLine(`  └${'─'.repeat(innerWidth)}┘`, width))
  return lines
}

function renderLayoutDecisionSummary(decision = {}) {
  const lines = [
    `${decision.page || '页面'} · 模型推荐方案`,
    `页面类型：${decision.pageType || '通用任务页'}`,
    `推荐布局：${decision.layoutType || '顶部固定区 + 主体滚动区 + 底部操作区'}`,
    '推荐原因：',
    ...normalizeTextList(decision.reasons).map((item) => `- ${item}`),
    '模块结构：'
  ]
  ;(decision.modules || []).forEach((module) => {
    lines.push(`- ${module.name}：${module.cardPattern || '内容卡'}`)
    lines.push(`  布局：${module.layout || '模块布局'}`)
    lines.push(`  卡片结构：${module.cardPattern || '内容卡'}`)
    if (module.components?.length) lines.push(`  组件：${module.components.join(' / ')}`)
    if (module.interactions?.length) lines.push(`  交互：${module.interactions.join('；')}`)
  })
  return lines.join('\n')
}

function renderLayoutDecisions(data = {}) {
  return (data.layoutDecisions || []).map(renderLayoutDecisionSummary).join('\n\n')
}

function decisionForPage(data = {}, page = '') {
  return (data.layoutDecisions || []).find((item) => item.page === page) || null
}

function gestureLines(frame = {}) {
  const page = String(frame.page || '')
  const lines = [
    '',
    '交互手势说明',
    '下拉手势 → 触发接口刷新页面数据',
    '内容区域纵向滚动 → 顶部/底部固定区不跟随滚动'
  ]
  if ((frame.scrollModules || []).some((item) => /Banner|轮播|横向|分类|热销/.test(item))) {
    lines.push('横向滑动 → 轮播图/分类Tab/商品卡片横向滚动')
  }
  if (frame.page === '我的') {
    lines.push('单击顶部三栏资产格子 → 校验登录后跳转余额/积分/卡包')
    lines.push('单击功能宫格 → 未登录弹授权弹窗，已登录跳转对应页面')
  }
  if (/点餐|点单|菜单/.test(page)) {
    lines.push('单击左侧分类 → 右侧商品列表滚动到对应锚点')
    lines.push('单击加购按钮 → 无规格直接加购，有规格弹出底部弹窗')
  }
  if (/商品详情|商品定制|规格/.test(page)) {
    lines.push('点击规格项 → 即时更新价格、库存和底部按钮状态')
    lines.push('底部按钮固定 → 滚动查看详情时仍可加入购物车')
  }
  return lines.join('\n')
}

function renderTeaHomeWireframe(frame = {}) {
  const width = 52
  const decision = frame.layoutDecision
  const lines = [
    `${frame.page} 页面框架`,
    '页面总框架：顶部选店导航 + 首页滚动推荐区 + 底部Tab',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('门店选择  搜索框  自提/外卖  消息       顶部固定导航', width),
    wireSep(width),
    wireLine('【滚动内容容器 scroll-view】', width)
  ]
  ;(frame.scrollModules?.length ? frame.scrollModules : ['Banner轮播', '快捷入口', '热销商品', '限时秒杀']).forEach((name, index) => {
    lines.push(...renderModuleBox(name, index, '首页', width))
  })
  lines.push(wireSep(width))
  lines.push(wireLine('底部Tab：首页 / 点单 / 购物车 / 订单 / 我的', width))
  lines.push(wireBottom(width))
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function renderTeaProductDetailWireframe(frame = {}) {
  const width = 54
  const decision = frame.layoutDecision
  const lines = [
    `${frame.page} 商品详情页`,
    '页面总框架：顶部返回栏 + 商品详情滚动区 + 底部固定加购栏',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('返回  商品详情标题  分享/收藏          顶部固定导航', width),
    wireSep(width),
    wireLine('【商品详情 scroll-view】', width),
    wireLine('  ┌────────────────────────────────────────┐', width),
    wireLine('  │ 商品大图/轮播图                         │', width),
    wireLine('  │ 角标：新品 / 热销 / 会员价              │', width),
    wireLine('  └────────────────────────────────────────┘', width),
    wireLine('商品信息：名称 / 标签 / 月售 / 描述 / 价格', width),
    wireSep(width),
    wireLine('【规格选择/定制区】', width),
    wireLine('杯型：中杯 / 大杯 / 超大杯（按钮组）', width),
    wireLine('温度：正常冰 / 少冰 / 去冰 / 热（单选Chip）', width),
    wireLine('甜度：正常糖 / 七分糖 / 五分糖 / 无糖（单选Chip）', width),
    wireLine('加料：珍珠 / 椰果 / 奶盖（复选 + 价格）', width),
    wireLine('数量步进器：-  数量  +', width),
    wireLine('状态：必选未选 / 库存不足 / 会员专属需登录', width),
    wireSep(width),
    wireLine('【底部固定操作栏】', width),
    wireLine('左：合计价格/会员价   右：[加入购物车] [立即结算]', width),
    wireBottom(width)
  ]
  if (frame.overlays?.length) {
    lines.push('')
    lines.push(`# 顶层弹窗/浮层：${frame.overlays.join(' / ')}`)
  }
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function renderTeaCheckoutWireframe(frame = {}) {
  const width = 52
  const decision = frame.layoutDecision
  const lines = [
    `${frame.page} 页面框架`,
    '页面总框架：顶部返回栏 + 结算表单滚动区 + 底部支付栏',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('返回  确认订单/结算                    顶部固定导航', width),
    wireSep(width),
    wireLine('【结算内容 scroll-view】', width)
  ]
  ;(frame.scrollModules?.length ? frame.scrollModules : ['商品清单', '优惠券入口', '金额明细', '备注与餐具']).forEach((name, index) => {
    lines.push(...renderModuleBox(name, index, '购物车', width))
  })
  lines.push(wireSep(width))
  lines.push(wireLine('底部固定：实付金额 + 去支付/提交订单按钮', width))
  lines.push(wireBottom(width))
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function renderMineWireframe(frame = {}) {
  const width = 46
  const lines = [
    `${frame.page} 页面框架`,
    `页面总框架：顶部会员固定区 + 滚动内容区 + 底部Tab`,
    '',
    wireTop(width),
    wireLine('【顶部渐变会员大区块（固定）】', width),
    wireLine('头像昵称 | 会员等级卡片', width),
    wireLine('余额 | 积分 | 优惠券三栏网格', width),
    wireSep(width),
    wireLine('【滚动内容区】', width)
  ]
  ;(frame.scrollModules || []).forEach((name, index) => {
    lines.push(...renderModuleBox(name, index, frame.page, width))
  })
  lines.push(wireSep(width))
  lines.push(wireLine('底部Tab导航', width))
  lines.push(wireBottom(width))
  if (frame.overlays?.length) {
    lines.push('')
    lines.push(`# 顶层弹窗/浮层：${frame.overlays.join(' / ')}`)
  }
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function renderDefaultWireframe(frame = {}) {
  const width = 46
  const decision = frame.layoutDecision
  const lines = [
    `${frame.page} 页面框架`,
    `页面总框架：顶部固定导航 + 滚动内容区 + 底部Tab`,
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine(`${frame.topFixed.join('  ') || '顶部固定导航'}   顶部固定导航（不滚动）`, width),
    wireSep(width),
    wireLine('【滚动内容容器scroll-view】', width)
  ]
  ;(frame.scrollModules || []).forEach((name, index) => {
    lines.push(...renderModuleBox(name, index, frame.page, width))
  })
  if (frame.bottomFixed?.length) {
    lines.push(wireSep(width))
    lines.push(wireLine('底部固定操作区', width))
    lines.push(wireLine(frame.bottomFixed.join('  '), width))
  }
  lines.push(wireBottom(width))
  if (frame.overlays?.length) {
    lines.push('')
    lines.push(`# 顶层弹窗/浮层：${frame.overlays.join(' / ')}`)
  }
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function localFeatureModuleLines(name = '', index = 0, frame = {}, width = 56) {
  const text = `${frame.page || ''} ${name}`
  const lines = [
    wireSep(width),
    wireLine(`区域${index + 1}：${name}`, width)
  ]
  if (/画面比例|当前比例|比例上下文|参数上下文|默认值|默认来源|selectedAspectRatio|targetAspectRatio|actualAspectRatio|比例 Tab|比例按钮/i.test(text)) {
    lines.push(wireLine('控件：16:9 / 9:16 参数按钮组，展示选中态、默认态、禁用态', width))
    lines.push(wireLine('规则：默认读取当前 tab；手动修改后写入 targetAspectRatio', width))
    lines.push(wireLine('反馈：actualAspectRatio 不一致时提示并切换到结果对应 tab', width))
    return lines
  }
  if (/虚线画框|框选|cropBox|裁剪框|上传图片预览|照片上传|已选照片/i.test(text)) {
    lines.push(wireLine('控件：上传图片预览画布 + 目标比例虚线框', width))
    lines.push(wireLine('操作：拖拽/缩放虚线框，实时更新 cropBox 坐标', width))
    lines.push(wireLine('提交：携带 uploadedImageId、cropBox、targetAspectRatio 创建任务', width))
    return lines
  }
  if (/生成中|任务状态|generationTaskId|结果归位|不匹配|状态提示/i.test(text)) {
    lines.push(wireLine('状态：排队 / 生成中 / 成功 / 失败', width))
    lines.push(wireLine('校验：对比 targetAspectRatio 与 actualAspectRatio', width))
    lines.push(wireLine('恢复：失败保留参数、素材与框选上下文供重试', width))
    return lines
  }
  if (/背景图|多比例素材|assetRatioVariants|素材配置|参考图预览/i.test(text)) {
    lines.push(wireLine('区域：背景图预览 + 多比例素材映射列表', width))
    lines.push(wireLine('字段：assetRatioVariants 按 16:9 / 9:16 保存素材引用', width))
    lines.push(wireLine('状态：缺失 / 部分配置 / 已配置 / 生成中', width))
    return lines
  }
  if (/入口覆盖范围|入口模式|Speaker Focus|Cartoon|Pet|Generate From Reference|Use your Photo|Photo to Host|Split Screen|Solo|当前入口内容区|主播生成输入区/i.test(text)) {
    if (/Generate From Reference|参考图/i.test(text)) {
      lines.push(wireLine('入口：Speaker Focus / Cartoon / Pet - Generate From Reference', width))
      lines.push(wireLine('内容：参考图预览、背景图素材和当前比例生成参数', width))
    } else if (/Use your Photo|照片生成/i.test(text)) {
      lines.push(wireLine('入口：Speaker Focus / Cartoon / Pet - Use your Photo', width))
      lines.push(wireLine('内容：照片预览、当前比例参数和生成提交区', width))
    } else if (/AI generate host|主播生成|AI 主播/i.test(text)) {
      lines.push(wireLine('入口：Split Screen / Solo - AI generate host', width))
      lines.push(wireLine('内容：主播描述、比例参数和生成任务状态', width))
    } else if (/Photo to Host|上传|框选/i.test(text)) {
      lines.push(wireLine('入口：Split Screen / Solo - Photo to Host', width))
      lines.push(wireLine('内容：上传预览、虚线框选和 cropBox 提交', width))
    } else {
      lines.push(wireLine('入口：当前已选造人入口，不在本页展开其它入口', width))
      lines.push(wireLine('内容：当前入口的表单、预览和状态反馈', width))
    }
    lines.push(wireLine('规则：切换入口时保留素材、比例参数和任务上下文', width))
    return lines
  }
  if (/样式增强|选中态|悬停态|禁用态/i.test(text)) {
    lines.push(wireLine('样式：默认 / hover / 选中 / disabled 四态对照', width))
    lines.push(wireLine('反馈：边框、背景、字重和辅助文案同步变化', width))
    lines.push(wireLine('适配：移动端点击态与键盘焦点态一致', width))
    return lines
  }
  lines.push(wireLine('控件：当前局部功能的参数选择与提交反馈', width))
  lines.push(wireLine('规则：保留当前上下文，修改后更新提交状态', width))
  lines.push(wireLine('状态：默认 / 已修改 / 生成中 / 失败可重试', width))
  return lines
}

function localFeatureEvidenceLabel(frame = {}) {
  const refs = Array.isArray(frame.evidenceRefs) ? frame.evidenceRefs : []
  const seen = new Set()
  const labels = refs.map((ref) => {
    if (typeof ref === 'string') return ref
    return ref?.title || ref?.name || ref?.summary || ref?.source || ref?.id || ''
  }).filter((label) => {
    if (!label || seen.has(label)) return false
    seen.add(label)
    return true
  })
  return labels.slice(0, 3).join(' / ')
}

function localFeatureImageEvidenceLabel(frame = {}) {
  const refs = Array.isArray(frame.evidenceRefs) ? frame.evidenceRefs : []
  const seen = new Set()
  const labels = refs.map((ref) => {
    if (!ref || typeof ref !== 'object') return ''
    const imageUrl = ref.screenshotUrl || ref.imageUrl || ref.previewUrl || ''
    if (!imageUrl) return ''
    return `${ref.title || ref.name || ref.id || '图片证据'}：${imageUrl}`
  }).filter((label) => {
    if (!label || seen.has(label)) return false
    seen.add(label)
    return true
  })
  return labels.slice(0, 2).join(' / ')
}

function renderLocalFeatureWireframe(frame = {}) {
  const width = 56
  const decision = frame.layoutDecision
  const topFixed = frame.topFixed?.length ? frame.topFixed.join('  ') : '返回/页面标题  参数上下文  当前入口状态'
  const modules = frame.scrollModules?.length ? frame.scrollModules : ['参数选择控件', '主操作提交区', '状态反馈与异常恢复']
  const lines = [
    `${frame.page} 页面框架`,
    '页面总框架：现有功能局部优化，不扩展成完整新项目框架',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine(`${topFixed}  顶部固定`, width),
    wireSep(width),
    wireLine('【局部功能内容区 scroll-view】', width)
  ]
  modules.forEach((name, index) => {
    lines.push(...localFeatureModuleLines(name, index, frame, width))
  })
  if (frame.bottomFixed?.length) {
    lines.push(wireSep(width))
    lines.push(wireLine(`底部固定操作：${frame.bottomFixed.join('  ')}`, width))
  }
  lines.push(wireBottom(width))
  if (frame.overlays?.length) {
    lines.push('')
    lines.push(`# 顶层弹窗/浮层：${frame.overlays.join(' / ')}`)
  }
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function renderOrderMenuWireframe(frame = {}) {
  const width = 52
  const decision = frame.layoutDecision
  const lines = [
    `② 点餐菜单页（左右分栏特殊框架）`,
    '',
    `页面总框架：顶部导航 + 左右分栏主体 + 悬浮购物车栏 + 底部Tab`,
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('门店  搜索  自提/外卖切换              顶部固定导航', width),
    wireSep(width),
    wireLine('左右分栏主体', width),
    wireLine('', width),
    wireLine('  ┌────────────┐  ┌──────────────────────┐', width),
    wireLine('  │ 左固定     │  │ 右滚动商品           │', width),
    wireLine('  │ 分类栏     │  │ 商品列表scroll       │', width),
    wireLine('  │ 图标+文字  │  │ 左图右文商品卡       │', width),
    wireLine('  │ 选中高亮   │  │ 商品图 + 商品名 + 月售 │', width),
    wireLine('  │ (固定宽)   │  │ 价格 + 加购按钮        │', width),
    wireLine('  │            │  │ 左：商品图              │', width),
    wireLine('  │            │  │ 右上：商品名 / 标签 / 月售 │', width),
    wireLine('  │            │  │ 右下：价格 / 加购 / 收藏 │', width),
    wireLine('  │            │  │ 标签/规格/点赞/收藏    │', width),
    wireLine('  └────────────┘  └──────────────────────┘', width),
    wireSep(width),
    wireLine('【悬浮固定购物车操作栏】', width),
    wireLine('[购物车图标+数量]   去结算按钮', width),
    wireSep(width),
    wireLine('底部Tab导航', width),
    wireBottom(width),
    '',
    '# 弹窗附加框架（底部滑出弹窗框架）',
    '',
    wireTop(width),
    wireLine('遮罩层', width),
    wireLine('', width),
    wireLine('  ┌──────────────────────────────────────┐', width),
    wireLine('  │ 规格弹窗容器（底部70%高）            │', width),
    wireLine('  │ 饮品标题大图                         │', width),
    wireLine('  │ 甜度/冰度/杯型/加料选择区            │', width),
    wireLine('  │ 数量加减器                           │', width),
    wireLine('  │ 底部通栏加入购物车按钮               │', width),
    wireLine('  └──────────────────────────────────────┘', width),
    wireBottom(width)
  ]
  if (frame.overlays?.length) {
    lines.push(`弹窗列表：${frame.overlays.join(' / ')}`)
  }
  lines.push(gestureLines(frame))
  return lines.join('\n')
}

function renderMerchantOrderBoardWireframe(frame = {}) {
  const width = 54
  const decision = frame.layoutDecision
  return [
    `${frame.page} 页面框架`,
    '页面总框架：顶部经营状态 + 订单状态筛选 + 订单处理列表',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('营业开关  今日订单/收入  消息提醒        顶部固定', width),
    wireSep(width),
    wireLine('状态筛选Tab：待接单 / 制作中 / 待取餐 / 已完成', width),
    wireLine('搜索/筛选：订单号 / 手机尾号 / 异常订单', width),
    wireSep(width),
    wireLine('【订单列表 scroll-view】', width),
    wireLine('  ┌────────────────────────────────────────┐', width),
    wireLine('  │ 订单卡：状态标签 / 取餐号 / 下单时间    │', width),
    wireLine('  │ 商品摘要：图片缩略图 + 数量 + 备注      │', width),
    wireLine('  │ 操作按钮：接单 / 出杯 / 完成 / 联系用户 │', width),
    wireLine('  └────────────────────────────────────────┘', width),
    wireSep(width),
    wireLine('底部：批量处理 / 打印小票 / 异常上报', width),
    wireBottom(width)
  ].filter(Boolean).join('\n')
}

function renderWaterfallWireframe(frame = {}) {
  const width = 52
  const decision = frame.layoutDecision
  const lines = [
    `${frame.page} 页面框架`,
    '页面总框架：顶部固定导航 + 筛选区 + 瀑布流内容区 + 底部操作区',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '推荐布局：瀑布流双列',
    '',
    wireTop(width),
    wireLine('顶部固定导航：搜索 / 分类 / 消息', width),
    wireSep(width),
    wireLine('筛选区：横向Tab + 分类Chip', width),
    wireLine('手势：横向滑动 / 点击切换', width),
    wireSep(width),
    wireLine('【主体内容区 scroll-view】', width),
    wireLine('', width),
    wireLine('  ┌──────────────┐  ┌──────────────┐', width),
    wireLine('  │ 图片封面      │  │ 图片封面      │', width),
    wireLine('  │ 标题2行       │  │ 标题2行       │', width),
    wireLine('  │ 标签/作者     │  │ 标签/作者     │', width),
    wireLine('  │ 点赞/收藏     │  │ 点赞/收藏     │', width),
    wireLine('  └──────────────┘  └──────────────┘', width),
    wireLine('', width),
    wireLine('卡片内容：图片 / 标题 / 标签 / 作者 / 点赞数', width),
    wireLine('交互：点击卡片进详情 / 点击点赞切换状态', width),
    wireLine('加载：下拉刷新 / 上拉加载', width),
    wireSep(width),
    wireLine(frame.bottomFixed?.join(' / ') || '底部操作：发布 / 返回顶部 / Tab', width),
    wireBottom(width)
  ]
  if (frame.overlays?.length) {
    lines.push('')
    lines.push(`# 顶层弹窗/浮层：${frame.overlays.join(' / ')}`)
  }
  return lines.join('\n')
}

function renderPodcastHomeWireframe(frame = {}) {
  const width = 70
  const decision = frame.layoutDecision
  const frameText = [
    frame.page,
    decision?.layoutType,
    ...(decision?.reasons || []),
    ...(frame.topFixed || []),
    ...(frame.scrollModules || []),
    ...(frame.interactions || [])
  ].join(' ')
  const hasPromptShortcuts = /快捷提示词|Prompt Shortcut|Chips/i.test(frameText)
  return [
    `${frame.page || '首页'} 页面框架`,
    hasPromptShortcuts
      ? '页面总框架：左侧全局导航 + 首屏 PodcastStep1 输入面板 + 快捷提示词按钮组 Chips + 登录拦截弹窗'
      : '页面总框架：顶部导航 + 首屏核心工作模块 + 滚动内容区 + 左侧Sidebar',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('左侧 AppNavRail 固定：Logo / Home(active) / Projects / Tools', width),
    wireLine('左侧 AppNavRail 续：Studio / Voice / 底部 Sign up +50 / Log in', width),
    wireLine('内容区右上状态：Sign up +50 / Log in / Upgrade / credits', width),
    wireSep(width),
    wireLine('【内容区首屏核心工作模块】', width),
    wireLine('Hero：Turn Your Ideas Into Podcasts / AI Video Podcast', width),
    wireLine('Tab: Generate Script | Upload Script | Upload Audio', width),
    wireLine('┌─ Topic/input composer ───────────────────────────────┐', width),
    wireLine('  输入框内部 placeholder：Enter topic / script / URL', width),
    wireLine('  支持：Prompt 输入 / URL 粘贴 / 文档上传按钮', width),
    hasPromptShortcuts ? wireLine('  快捷提示词按钮组 Chips 内嵌：[快捷1] [快捷2] [快捷3] [更多/换一批]', width) : '',
    hasPromptShortcuts ? wireLine('  底部操作：Try Sample              [Generate podcast]', width) : '',
    wireLine('└───────────────────────────────────────────────────────┘', width),
    hasPromptShortcuts ? wireLine('参数栏：host / storytelling / duration / language', width) : '',
    wireLine('参数区：播客人数 1人/2人', width),
    wireLine('主按钮：Generate podcast / Next → 进入 Studio 核心编辑页', width),
    wireLine('接口：POST /podcasts/drafts', width),
    wireSep(width),
    wireLine('【滚动内容区 scroll-view】', width),
    wireLine('模块1：播客创作工具横滑列表', width),
    wireLine('  卡片：图标 + 工具名 + 简述 + Try按钮', width),
    wireLine('  手势：横向滑动', width),
    wireLine('模块2：灵感案例瀑布流/卡片网格', width),
    wireLine('  封面图 / 类型标签 / 创作者 / 创建时间', width),
    wireLine('  hover预览 / 点击打开大窗口', width),
    wireSep(width),
    wireLine('浮层：LoginDialog / Pricing Drawer / credits 拦截按需覆盖内容区', width),
    wireBottom(width)
  ].filter(Boolean).join('\n')
}

function renderPodcastEditorWireframe(frame = {}) {
  const width = 54
  const decision = frame.layoutDecision
  return [
    '播客核心编辑页',
    '页面总框架：顶部操作区 + 左右分栏主体 + 底部生成栏',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('顶部：项目名 / 保存状态 / 下载 / 生成按钮', width),
    wireSep(width),
    wireLine('左侧主持人区 | 右侧脚本预览&编辑区', width),
    wireLine('', width),
    wireLine('  ┌──────────────┐  ┌────────────────────────┐', width),
    wireLine('  │ Tab分类：Talk Show │ │ 脚本编辑器            │', width),
    wireLine('  │ Alternating  │  │ - 角色名                │', width),
    wireLine('  │ Cartoon      │  │ - 台词段落              │', width),
    wireLine('  │ Pet          │  │ - 停顿/语气标记          │', width),
    wireLine('  │ Visual       │  │                        │', width),
    wireLine('  │ 主持人卡片：头像/类型/hover预览 │ │ 顶部操作： │', width),
    wireLine('  │              │  │ 预览音频 / 下载PDF / 复制脚本 │', width),
    wireLine('  │              │  │                        │', width),
    wireLine('  │              │  │ 底部操作：              │', width),
    wireLine('  │              │  │ 替换音色 / 角色对调 / 增加停顿 │', width),
    wireLine('  └──────────────┘  └────────────────────────┘', width),
    wireLine('接口：PATCH /scripts/:id', width),
    wireSep(width),
    wireLine('底部生成栏：选择比例 / 生成视频 / 代币消耗提示', width),
    wireBottom(width)
  ].filter(Boolean).join('\n')
}

function renderJoggHomeWireframe(frame = {}) {
  const width = 58
  const decision = frame.layoutDecision
  const lines = [
    `${frame.page} 页面框架`,
    '页面总框架：左侧全局导航 + 首页生成入口 + Media/Tools/Studio 快捷工作区',
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine('左侧 Sidebar：Home / Tools / Studio / Voice / Projects', width),
    wireSep(width),
    wireLine('顶部状态：Jogg Logo / 当前项目 / credits / 账号', width),
    wireSep(width),
    wireLine('【首页工作区 scroll-view】', width)
  ]
  ;(frame.scrollModules?.length ? frame.scrollModules : ['Jogg 首页生成入口', 'Tools 生成入口', 'Studio 编辑渲染入口', 'Media 素材面板']).forEach((name, index) => {
    lines.push(...renderModuleBox(name, index, frame.page, width))
  })
  lines.push(wireBottom(width))
  if (frame.overlays?.length) {
    lines.push('')
    lines.push(`# 顶层弹窗/浮层：${frame.overlays.join(' / ')}`)
  }
  lines.push(gestureLines(frame))
  return lines.filter(Boolean).join('\n')
}

function renderPodcastAuthWireframe(frame = {}) {
  const width = 58
  const page = String(frame.page || '')
  const projectName = String(frame.projectName || 'AI 播客工作站').trim()
  const decision = frame.layoutDecision
  if (/OAuth|回调/.test(page)) {
    return [
      `${page} 页面框架`,
      '页面总框架：居中 OAuth 处理中状态 + 失败恢复 + 原流程回跳',
      decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
      '',
      wireTop(width),
      wireLine(`${projectName} Logo`, width),
      wireSep(width),
      wireLine('【居中加载态】正在连接 Google / Discord', width),
      wireLine('授权来源：Google OAuth / Discord OAuth', width),
      wireLine('状态：OAuth pending / 授权成功 / 授权失败 / 账号冲突', width),
      wireLine('接口：GET /auth/oauth/callback 处理 code/state', width),
      wireLine('接口：POST /auth/session 写入会话', width),
      wireSep(width),
      wireLine('回跳上下文：redirect_uri / source / draft_id / upload_id', width),
      wireLine('成功：回到主编辑器 / 工具流程 / Pricing checkout', width),
      wireLine('失败：回到原登录方式，并保留原始流程', width),
      wireSep(width),
      wireLine('底部：取消并返回登录', width),
      wireBottom(width)
    ].filter(Boolean).join('\n')
  }
  if (/Auth Modal|登录拦截|弹窗/.test(page)) {
    return [
      `${page} 页面框架`,
      '页面总框架：覆盖在原页面上的登录拦截弹窗，不强制整页跳转',
      decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
      '',
      wireTop(width),
      wireLine('原页面保持：Home / Tools / Pricing / Download / Share / Save', width),
      wireLine('遮罩层：保留用户已输入 prompt、上传文档/音频和触发动作', width),
      wireSep(width),
      wireLine('  ┌────────────────────────────────────────────┐', width),
      wireLine('  │ 登录拦截弹窗 Auth Modal                    │', width),
      wireLine('  │ 标题：登录后继续当前创作                   │', width),
      wireLine('  │ 说明：保存项目 / 使用免费生成次数 / credits │', width),
      wireLine('  │ [Google 登录] [Discord 登录]               │', width),
      wireLine('  │ 邮箱登录折叠区：Email / Password           │', width),
      wireLine('  │ 提示：避免上传文件和输入内容丢失           │', width),
      wireLine('  │ 底部：继续当前任务 / 稍后再说              │', width),
      wireLine('  └────────────────────────────────────────────┘', width),
      wireSep(width),
      wireLine('上下文：source / redirect_uri / draft_id / upload_id', width),
      wireLine('接口：POST /auth/modal-context 暂存上下文', width),
      wireLine('登录成功：关闭弹窗并继续原动作', width),
      wireBottom(width)
    ].filter(Boolean).join('\n')
  }
  if (/忘记密码/.test(page)) {
    return [
      `${page} 页面框架`,
      '页面总框架：轻量单列表单，减少干扰',
      decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
      '',
      wireTop(width),
      wireLine('顶部：返回登录 / 页面标题', width),
      wireSep(width),
      wireLine('邮箱输入框：Email', width),
      wireLine('主按钮：发送重置邮件', width),
      wireLine('状态：默认 / 邮箱格式错误 / 发送中 / 发送成功 / rate limit', width),
      wireLine('隐私：不暴露邮箱是否存在', width),
      wireLine('接口：POST /auth/password/forgot', width),
      wireSep(width),
      wireLine('底部：返回登录', width),
      wireBottom(width)
    ].filter(Boolean).join('\n')
  }
  if (/重置密码/.test(page)) {
    return [
      `${page} 页面框架`,
      '页面总框架：单列表单 + token 有效性校验',
      decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
      '',
      wireTop(width),
      wireLine('顶部：返回登录 / 页面标题', width),
      wireSep(width),
      wireLine('token 校验态：校验中 / 有效 / 失效', width),
      wireLine('新密码输入框 + 确认密码输入框', width),
      wireLine('主按钮：确认重置', width),
      wireLine('状态：密码不一致 / 提交中 / 重置成功 / token 失效', width),
      wireLine('接口：GET /auth/password/reset-token', width),
      wireLine('接口：POST /auth/password/reset', width),
      wireSep(width),
      wireLine('成功：引导登录或自动登录', width),
      wireBottom(width)
    ].filter(Boolean).join('\n')
  }
  const isSignup = /注册|Sign Up/.test(page)
  return [
    `${page} 页面框架`,
    `${projectName} 认证入口总框架：桌面左右分栏，移动端单列且表单优先`,
    decision?.layoutType ? `推荐布局：${decision.layoutType}` : '',
    '',
    wireTop(width),
    wireLine(`顶部：${projectName} Logo / 返回原创作入口 / 帮助`, width),
    wireSep(width),
    wireLine('左右分栏主体', width),
    wireLine('  ┌──────────────────────┐  ┌────────────────────────┐', width),
    wireLine('  │ 左侧价值与案例预览    │  │ 右侧认证表单             │', width),
    wireLine('  │ 视频播客预览          │  │ Google 登录 / Discord 登录 / 邮箱登录 │', width),
    wireLine('  │ 音频波形 / 脚本片段   │  │ 邮箱 / 密码 / 错误提示    │', width),
    wireLine('  │ 主持人预览            │  │ loading / disabled / error │', width),
    wireLine('  │ 登录后可保存项目      │  │ rate limit / OAuth pending │', width),
    wireLine('  └──────────────────────┘  └────────────────────────┘', width),
    wireSep(width),
    wireLine(isSignup ? '权益：免费试用次数 / 首次创作权益 / credits' : '权益：免费试用次数 / credits / 套餐权益', width),
    wireLine('上下文：redirect_uri / source / draft_id / upload_id', width),
    wireLine('登录成功：回到原始创作上下文并初始化 workspace', width),
    wireLine('资产初始化：免费次数 / credits / 套餐等级 / 最近项目', width),
    wireLine('权限边界：AppSumo/LTD 与第三方 API 消耗能力隔离', width),
    wireBottom(width)
  ].filter(Boolean).join('\n')
}

function renderPageWireframe(frame = {}) {
  const page = String(frame.page || '')
  const text = `${page} ${(frame.scrollModules || []).join(' ')} ${frame.layoutDecision?.layoutType || ''}`
  if (/现有功能局部优化|画面比例|selectedAspectRatio|targetAspectRatio|actualAspectRatio|cropBox|虚线画框|参数不匹配/i.test(text)) return renderLocalFeatureWireframe(frame)
  if (/PodcastStep1|Generate Script|Upload Script|Upload Audio|快捷提示词|Video Podcast/i.test(text)) return renderPodcastHomeWireframe(frame)
  if (/Jogg|Tools|Studio|Media|My Media|AI Generate|Voice|Projects/i.test(text)) return renderJoggHomeWireframe(frame)
  if (/登录|注册|忘记密码|重置密码|OAuth|Auth Modal|认证/.test(frame.page || '')) return renderPodcastAuthWireframe(frame)
  if (frame.page === '首页' && /核心工作模块|播客/.test((frame.scrollModules || []).join(' '))) return renderPodcastHomeWireframe(frame)
  if (frame.page === '核心编辑页') return renderPodcastEditorWireframe(frame)
  if (/商品详情|商品定制|规格定制/.test(text)) return renderTeaProductDetailWireframe(frame)
  if (/首页与选店|门店选择|Banner轮播|快捷入口/.test(text) && !/播客|核心工作模块/.test(text)) return renderTeaHomeWireframe(frame)
  if (/点餐|点单|菜单与商品|左右分栏|左侧分类|右侧商品/.test(text)) return renderOrderMenuWireframe(frame)
  if (/商家|订单台|订单看板/.test(text)) return renderMerchantOrderBoardWireframe(frame)
  if (/购物车|结算|订单确认/.test(text)) return renderTeaCheckoutWireframe(frame)
  if (/瀑布流|内容推荐|灵感|案例|作品/.test(text)) return renderWaterfallWireframe(frame)
  if (frame.page === '我的') return renderMineWireframe(frame)
  return renderDefaultWireframe(frame)
}

export function renderAscii(data = {}) {
  const structure = treeLines(data).join('\n')
  const frames = (data.pageFrames || []).map((frame) => renderPageWireframe({
    ...frame,
    layoutDecision: decisionForPage(data, frame.page)
  })).join('\n\n')
  const layoutDecisions = renderLayoutDecisions(data)
  return { structure, layoutDecisions, frames }
}

function mermaidId(prefix, text, index) {
  return `${prefix}${index}_${String(text || '').replace(/[^\w\u4e00-\u9fa5]/g, '').slice(0, 18) || 'node'}`
}

export function renderMermaid(data = {}) {
  const rootId = 'root'
  const structure = ['graph TD', `  ${rootId}[${data.structureTree?.root || data.projectName || '应用'}]`]
  ;(data.structureTree?.tabs || []).forEach((tab, tabIndex) => {
    const tabId = mermaidId('tab', tab.name, tabIndex)
    structure.push(`  ${rootId} --> ${tabId}[${tab.name}]`)
    normalizeTextList(tab.children).forEach((child, childIndex) => {
      structure.push(`  ${tabId} --> ${mermaidId(`${tabId}_child`, child, childIndex)}[子页：${child}]`)
    })
    normalizeTextList(tab.modals).forEach((modal, modalIndex) => {
      structure.push(`  ${tabId} --> ${mermaidId(`${tabId}_modal`, modal, modalIndex)}[弹窗：${modal}]`)
    })
  })
  const globalId = 'globalCapabilities'
  structure.push(`  ${rootId} --> ${globalId}[公共底层能力]`)
  normalizeTextList(data.structureTree?.globalCapabilities).forEach((name, index) => {
    structure.push(`  ${globalId} --> ${mermaidId('cap', name, index)}[${name}]`)
  })

  const frames = ['graph TD']
  ;(data.pageFrames || []).forEach((frame, index) => {
    const pageId = mermaidId('page', frame.page, index)
    frames.push(`  subgraph ${pageId}[${frame.page}页面总框架]`)
    frames.push(`    ${pageId}_top[顶部Fixed：${frame.topFixed.join(' / ') || '无'}]`)
    frames.push(`    ${pageId}_scroll[Scroll主体：${frame.scrollModules.join(' / ') || '无'}]`)
    frames.push(`    ${pageId}_bottom[底部Fixed：${frame.bottomFixed.join(' / ') || '无'}]`)
    frames.push(`    ${pageId}_overlay[Overlays：${frame.overlays.join(' / ') || '无'}]`)
    frames.push(`    ${pageId}_top --> ${pageId}_scroll --> ${pageId}_bottom`)
    frames.push(`    ${pageId}_scroll -. 顶层浮层 .-> ${pageId}_overlay`)
    frames.push('  end')
  })
  return { structure: structure.join('\n'), frames: frames.join('\n') }
}

export function buildQualityWarnings(data = {}) {
  const warnings = []
  ;(data.pageFrames || []).forEach((frame) => {
    if (!frame.topFixed?.length) warnings.push({ severity: 'P1', page: frame.page, message: '页面缺少顶部固定区定义' })
    if (!frame.scrollModules?.length) warnings.push({ severity: 'P0', page: frame.page, message: '页面缺少主体滚动内容' })
    if (!frame.bottomFixed?.length) warnings.push({ severity: 'P2', page: frame.page, message: '页面缺少底部固定区或说明' })
  })
  normalizeTextList(['登录', '支付', '空状态']).forEach((capability) => {
    if (!data.structureTree?.globalCapabilities?.includes(capability)) {
      warnings.push({ severity: 'P1', page: '全局', message: `公共能力缺少${capability}` })
    }
  })
  if (!warnings.length) {
    warnings.push({ severity: 'P2', page: '全局', message: '基础结构完整，建议后续补充接口字段、异常状态和埋点事件' })
  }
  return warnings
}

export function buildHandoff() {
  return {
    product: ['提供业务描述、页面范围、主流程、异常状态和验收标准', '确认结构层和框架层是否覆盖交付范围'],
    ui: ['根据 pageFrames 输出低保真页面骨架', '补齐组件状态、视觉规范和弹窗层级'],
    frontend: ['调用 /api/diagrams/generate', '渲染 JSON 结构树、Mermaid 预览和 ASCII 复制', '实现页面固定区、滚动区、浮层和导出交互'],
    backend: ['维护 JSON Schema、业务模板、AI Prompt 和生成校验器', '提供 ASCII/Mermaid renderer、版本保存和生成记录'],
    testing: ['校验结构层必填节点、框架层固定/滚动区域、复制导出和异常状态提示']
  }
}

export function generateDiagramBundle(payload = {}) {
  const data = buildDiagramData(payload)
  return {
    data,
    ascii: renderAscii(data),
    mermaid: renderMermaid(data),
    warnings: buildQualityWarnings(data),
    handoff: buildHandoff(),
    meta: {
      source: 'template',
      generatedAt: new Date().toISOString()
    }
  }
}

function buildBundleFromData(data, meta = {}) {
  return {
    data,
    ascii: renderAscii(data),
    mermaid: renderMermaid(data),
    warnings: buildQualityWarnings(data),
    handoff: buildHandoff(),
    meta: {
      source: 'provider',
      generatedAt: new Date().toISOString(),
      ...meta
    }
  }
}

export async function generateDiagramBundleWithProvider(payload = {}, options = {}) {
  const provider = options.provider
  if (!provider?.generate || payload.generationMode !== 'ai') {
    return generateDiagramBundle(payload)
  }

  try {
    const reply = await provider.generate(buildDiagramModelContext(payload))
    const parsed = firstJsonObject(reply?.content || reply?.text || reply?.message || '')
    const validation = validateDiagramData(parsed || {})
    if (!validation.ok) {
      const fallback = generateDiagramBundle(payload)
      return {
        ...fallback,
        warnings: [
          {
            severity: 'P1',
            page: '全局',
            code: 'DIAGRAM_PROVIDER_FALLBACK',
            message: `AI 结构化输出未通过校验，已回退模板：${validation.errors.join('；') || '未返回 JSON'}`
          },
          ...fallback.warnings
        ],
        meta: {
          ...fallback.meta,
          source: 'fallback',
          provider: reply?.provider || provider.name || '',
          validationErrors: validation.errors
        }
      }
    }
    return buildBundleFromData(validation.data, {
      source: 'provider',
      provider: reply?.provider || provider.name || '',
      model: reply?.model || ''
    })
  } catch (error) {
    const fallback = generateDiagramBundle(payload)
    return {
      ...fallback,
      warnings: [
        {
          severity: 'P1',
          page: '全局',
          code: 'DIAGRAM_PROVIDER_FALLBACK',
          message: `AI 生成失败，已回退模板：${error.message || '未知错误'}`
        },
        ...fallback.warnings
      ],
      meta: {
        ...fallback.meta,
        source: 'fallback',
        error: error.message || 'provider failed'
      }
    }
  }
}
