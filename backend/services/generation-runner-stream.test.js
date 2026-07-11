import assert from 'node:assert/strict'
import test from 'node:test'
import { runSkillGeneration } from './generation-runner.js'

function validSmartCanvasOutput() {
  return {
    intent: 'media-broll-panel',
    mode: 'free-canvas',
    canvasTitle: 'Media Broll 素材面板',
    canvasType: 'module-board',
    layoutRule: 'top-down',
    summary: '素材分层和 Broll 使用闭环。',
    groups: [
      {
        groupId: 'media-tabs',
        groupName: '素材分层',
        groupDesc: '按素材来源拆分 Tab',
        nodes: [
          {
            nodeId: 'my-media',
            nodeType: 'module',
            nodeName: 'My Media',
            summary: '管理用户自有素材。',
            highlights: ['上传', '检索'],
            sections: [{ title: '能力', items: ['本地上传'] }]
          }
        ]
      }
    ],
    edges: [],
    qualityReport: { passed: true, checks: [] }
  }
}

test('runSkillGeneration streams model deltas before returning final none canvas', async () => {
  const deltas = []
  const provider = {
    name: 'openai-compatible',
    async *stream() {
      yield { type: 'delta', content: '{"intent":"media' }
      yield { type: 'delta', content: '-broll-panel",' }
      yield {
        type: 'final',
        content: JSON.stringify(validSmartCanvasOutput()),
        usage: {},
        provider: 'openai-compatible',
        model: 'gpt-test'
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab。',
    agentProvider: provider,
    onModelDelta: (delta) => deltas.push(delta)
  })

  assert.equal(result.status, 'generated')
  assert.deepEqual(deltas, ['{"intent":"media', '-broll-panel",'])
  assert.equal(result.model, 'gpt-test')
})

test('runSkillGeneration forwards provider status events before model deltas', async () => {
  const events = []
  const provider = {
    name: 'openai-compatible',
    async *stream() {
      yield { type: 'status', label: '模型通道已建立' }
      yield { type: 'delta', content: '{"intent":"media-broll-panel",' }
      yield { type: 'status', label: '模型正在整理输出' }
      yield {
        type: 'final',
        content: JSON.stringify(validSmartCanvasOutput()),
        usage: {},
        provider: 'openai-compatible',
        model: 'gpt-test'
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab。',
    agentProvider: provider,
    onModelEvent: (event) => events.push(event)
  })

  assert.equal(result.status, 'generated')
  assert.deepEqual(events.map((event) => event.type), ['status', 'delta', 'status'])
  assert.equal(events[0].label, '模型通道已建立')
  assert.equal(events[1].content, '{"intent":"media-broll-panel",')
})
