import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateDiagram } from './diagrams.js'

test('generateDiagram posts to the diagram generation endpoint', async () => {
  const calls = []
  const result = await generateDiagram({
    apiConfig: { apiBaseUrl: 'http://localhost:5174' },
    payload: {
      businessType: 'tea_shop_mini_program',
      description: '茶饮点单小程序'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return {
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        async json() {
          return { data: { projectName: '茶饮小程序' }, ascii: {}, mermaid: {}, warnings: [], handoff: {} }
        }
      }
    }
  })

  assert.equal(result.ok, true)
  assert.equal(calls[0].url, 'http://localhost:5174/api/diagrams/generate')
  assert.equal(JSON.parse(calls[0].options.body).businessType, 'tea_shop_mini_program')
})

test('DiagramWorkbenchPage exposes detailed handoff sections in the visible tabs', () => {
  const source = readFileSync(new URL('../pages/diagrams/DiagramWorkbenchPage.vue', import.meta.url), 'utf8')

  assert.match(source, /ASCII 结构层/)
  assert.match(source, /ASCII 框架层/)
  assert.match(source, /模型推荐方案/)
  assert.match(source, /推荐方案/)
  assert.match(source, /推荐布局/)
  assert.match(source, /推荐原因/)
  assert.match(source, /卡片结构/)
  assert.match(source, /纯文本线框/)
  assert.match(source, /页面状态/)
  assert.match(source, /前端负责/)
  assert.match(source, /后端提供/)
  assert.match(source, /数据依赖/)
  assert.match(source, /视觉规范/)
  assert.match(source, /异常处理/)
  assert.match(source, /请求参数/)
  assert.match(source, /响应字段/)
})
