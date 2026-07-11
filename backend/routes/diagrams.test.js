import assert from 'node:assert/strict'
import test from 'node:test'

import { diagramRoutes } from './diagrams.js'

test('diagram generate route returns the full diagram bundle', async () => {
  const routes = diagramRoutes()
  const result = await routes['POST /api/diagrams/generate']({
    businessType: 'tea_shop_mini_program',
    description: '茶饮点单小程序'
  })

  assert.equal(result.data.projectName, '茶饮小程序')
  assert.match(result.ascii.structure, /首页/)
  assert.match(result.mermaid.structure, /公共底层能力/)
  assert.ok(Array.isArray(result.warnings))
  assert.ok(result.handoff.frontend.length > 0)
})

test('diagram generate route can use an injected provider for ai mode', async () => {
  let called = false
  const routes = diagramRoutes({
    provider: {
      async generate() {
        called = true
        return {
          content: JSON.stringify({
            projectName: 'AI 项目',
            businessType: 'ai_project',
            structureTree: {
              root: 'AI 项目',
              tabs: [{ name: '首页', children: ['详情'], modals: ['确认弹窗'] }],
              globalCapabilities: ['登录', '支付', '空状态']
            },
            pageFrames: [{
              page: '首页',
              topFixed: ['导航'],
              scrollModules: ['内容流'],
              bottomFixed: ['操作栏'],
              overlays: ['确认弹窗'],
              layoutHints: ['三层框架']
            }]
          })
        }
      }
    }
  })

  const result = await routes['POST /api/diagrams/generate']({
    generationMode: 'ai',
    description: 'AI 生成'
  })

  assert.equal(called, true)
  assert.equal(result.meta.source, 'provider')
  assert.equal(result.data.projectName, 'AI 项目')
})
