import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeRequirementDocumentsWithGeneration } from './document-parser.js'

test('none skill exposes readable AI understanding summary outside canvas nodes', async () => {
  const provider = {
    name: 'openai-compatible',
    async generate() {
      return {
        provider: 'openai-compatible',
        model: 'gpt-test',
        usage: {},
        content: JSON.stringify({
          intent: 'media-broll-panel',
          mode: 'free-canvas',
          canvasTitle: 'Media Broll 素材面板',
          canvasType: 'mixed-board',
          layoutRule: 'top-down',
          summary: '素材分层和 Broll 使用闭环。',
          readableSummary: {
            oneSentence: '这份需求是在设计 Media 素材面板。',
            userGoal: '统一管理自有素材、公共图库和 AI 生成素材。',
            coreModules: ['My Media', 'Stock', 'AI Generate'],
            recommendedFlow: ['打开 Media', '选择素材来源', '添加到工程'],
            questions: ['公共图库来源是否只支持 Pexels/Pixabay？']
          },
          groups: [
            {
              groupId: 'media-tabs',
              groupName: '素材分层',
              groupDesc: '按来源拆分',
              nodes: [
                {
                  nodeId: 'my-media',
                  nodeType: 'module',
                  nodeName: 'My Media',
                  summary: '管理自有素材。',
                  highlights: ['上传', '搜索'],
                  sections: [{ title: '能力', items: ['本地上传'] }]
                }
              ]
            }
          ],
          edges: [],
          qualityReport: { passed: true, checks: [] }
        })
      }
    }
  }

  const analysis = await analyzeRequirementDocumentsWithGeneration({
    skillSelectionMode: 'manual',
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab。'
  }, {
    agentProvider: provider,
    model: 'gpt-test'
  })

  assert.equal(analysis.aiSummary.title, 'AI 理解')
  assert.match(analysis.aiSummary.summary, /Media 素材面板/)
  assert.deepEqual(analysis.aiSummary.coreModules, ['My Media', 'Stock', 'AI Generate'])
  assert.equal(analysis.canvas.nodes[0].title, 'My Media')
  assert.notEqual(analysis.canvas.nodes[0].id, 'ai-understanding')
  assert.deepEqual(analysis.canvas.orderedTabs[0], { key: 'my-media', label: 'My Media' })
})

test('none skill still exposes fallback AI summary when model omits readableSummary', async () => {
  const provider = {
    name: 'openai-compatible',
    async generate() {
      return {
        provider: 'openai-compatible',
        model: 'gpt-test',
        usage: {},
        content: JSON.stringify({
          intent: 'media-broll-panel',
          mode: 'free-canvas',
          canvasTitle: 'Media Broll 素材面板',
          canvasType: 'mixed-board',
          layoutRule: 'top-down',
          summary: '素材分层和 Broll 使用闭环。',
          groups: [
            {
              groupId: 'media-tabs',
              groupName: '素材分层',
              groupDesc: '按来源拆分',
              nodes: [
                {
                  nodeId: 'stock',
                  nodeType: 'module',
                  nodeName: 'Stock',
                  summary: '搜索公共图库素材。',
                  highlights: ['图库', '筛选'],
                  sections: [{ title: '能力', items: ['关键词搜索'] }]
                }
              ]
            }
          ],
          edges: [],
          qualityReport: { passed: true, checks: [] }
        })
      }
    }
  }

  const analysis = await analyzeRequirementDocumentsWithGeneration({
    skillSelectionMode: 'manual',
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab。'
  }, {
    agentProvider: provider,
    model: 'gpt-test'
  })

  assert.equal(analysis.aiSummary.title, 'AI 理解')
  assert.match(analysis.aiSummary.items.join('\n'), /核心模块/)
  assert.equal(analysis.canvas.nodes[0].title, 'Stock')
  assert.notEqual(analysis.canvas.nodes[0].id, 'ai-understanding')
})

test('none skill document analysis forwards model deltas while generating canvas', async () => {
  const deltas = []
  const provider = {
    name: 'openai-compatible',
    async generate() {
      throw new Error('generate should not be used when deltas are requested')
    },
    async *stream() {
      yield { type: 'delta', content: '{"intent":"media-broll-panel",' }
      yield { type: 'delta', content: '"mode":"free-canvas"}' }
      yield {
        type: 'final',
        provider: 'openai-compatible',
        model: 'gpt-test',
        usage: {},
        content: JSON.stringify({
          intent: 'media-broll-panel',
          mode: 'free-canvas',
          canvasTitle: 'Media Broll 素材面板',
          canvasType: 'mixed-board',
          layoutRule: 'top-down',
          summary: '素材分层和 Broll 使用闭环。',
          groups: [
            {
              groupId: 'media-tabs',
              groupName: '素材分层',
              groupDesc: '按来源拆分',
              nodes: [
                {
                  nodeId: 'ai-generate',
                  nodeType: 'module',
                  nodeName: 'AI Generate',
                  summary: '管理 AI 生成素材。',
                  highlights: ['提示词', '重新生成'],
                  sections: [{ title: '能力', items: ['生成历史'] }]
                }
              ]
            }
          ],
          edges: [],
          qualityReport: { passed: true, checks: [] }
        })
      }
    }
  }

  const analysis = await analyzeRequirementDocumentsWithGeneration({
    skillSelectionMode: 'manual',
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab。'
  }, {
    agentProvider: provider,
    model: 'gpt-test',
    onModelDelta: (delta) => deltas.push(delta)
  })

  assert.equal(analysis.generation.status, 'generated')
  assert.deepEqual(deltas, ['{"intent":"media-broll-panel",', '"mode":"free-canvas"}'])
  assert.equal(analysis.canvas.nodes[0].title, 'AI Generate')
})
