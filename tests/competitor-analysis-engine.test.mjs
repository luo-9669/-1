import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import { createCompetitorAnalysisEngineService } from '../backend/services/competitor-analysis-engine-service.js'

const pythonAppDir = new URL('../backend/services/competitor-analysis-engine/python/竞品监控系统/', import.meta.url)
const pythonReporterUrl = new URL('../backend/services/competitor-analysis-engine/python/竞品监控系统/reporter.py', import.meta.url)

test('daily python report preserves complete search snippets and all entries', async () => {
  const reporterSource = await readFile(pythonReporterUrl, 'utf8')

  assert.doesNotMatch(reporterSource, /entry\.snippet\[:100\]/)
  assert.doesNotMatch(reporterSource, /result\.entries\[:5\]/)
  assert.doesNotMatch(reporterSource, /等共 \{len\(result\.entries\)\} 条结果/)
  assert.match(reporterSource, /for entry in result\.entries:/)
  assert.match(reporterSource, /md_lines\.append\(f"  > \{entry\.snippet\}"\)/)
})

test('daily and weekly runs use selected competitors instead of python defaults', async () => {
  const capturedConfigs = []
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      assert.ok(env.COMPETITORS_CONFIG, 'python run should receive a selected competitor config file')
      const config = JSON.parse(await readFile(env.COMPETITORS_CONFIG, 'utf8'))
      capturedConfigs.push({ args, config })
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), `# ${args[1]} result`)
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  await service.run({
    projectId: 'competitor-analysis-selected-competitor-regression',
    kind: 'daily',
    competitorNames: ['稿定设计'],
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.art/creation'
  })
  await service.run({
    projectId: 'competitor-analysis-selected-competitor-regression',
    kind: 'weekly',
    competitorNames: ['Heygen'],
    productName: 'Heygen',
    productUrl: 'https://www.heygen.com/'
  })

  assert.equal(capturedConfigs.length, 2)
  assert.deepEqual(capturedConfigs.map((item) => item.args[1]), ['daily', 'weekly'])
  assert.deepEqual(capturedConfigs[0].config.competitors.map((item) => item.name), ['稿定设计'])
  assert.deepEqual(capturedConfigs[1].config.competitors.map((item) => item.name), ['Heygen'])
  assert.equal(capturedConfigs[0].config.competitors[0].url, 'https://www.gaoding.art/creation')
  assert.equal(capturedConfigs[1].config.competitors[0].url, 'https://www.heygen.com/')
  assert.doesNotMatch(JSON.stringify(capturedConfigs), /创客贴|Higgsfield AI|Riverside/)
})

test('newly added competitor names and urls are passed into python competitor config', async () => {
  const capturedConfigs = []
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      assert.ok(env.COMPETITORS_CONFIG, 'python run should receive selected project competitors')
      const config = JSON.parse(await readFile(env.COMPETITORS_CONFIG, 'utf8'))
      capturedConfigs.push({ mode: args[1], config })
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), `# ${args[1]} result`)
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.json`), JSON.stringify({
        competitor: '新增竞品',
        feature: '目标功能',
        evidence_status: 'not_found',
        evidence_quality: 'none',
        evidence_count: 0
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  await service.run({
    projectId: 'competitor-analysis-new-project-competitor-regression',
    kind: 'daily',
    competitorNames: ['新增竞品'],
    productUrls: ['https://new.example.com'],
    productName: '新增竞品',
    productUrl: 'https://new.example.com'
  })
  await service.run({
    projectId: 'competitor-analysis-new-project-competitor-regression',
    kind: 'flow',
    competitorNames: ['新增竞品'],
    competitor: '新增竞品',
    competitorName: '新增竞品',
    productUrls: ['https://new.example.com'],
    productUrl: 'https://new.example.com',
    feature: '目标功能'
  })

  assert.equal(capturedConfigs.length, 2)
  assert.deepEqual(capturedConfigs.map((item) => item.mode), ['daily', 'flow'])
  for (const item of capturedConfigs) {
    assert.deepEqual(item.config.competitors.map((competitor) => competitor.name), ['新增竞品'])
    assert.equal(item.config.competitors[0].url, 'https://new.example.com')
    assert.deepEqual(item.config.competitors[0].keywords, ['新增竞品 新功能', '新增竞品 更新', '新增竞品 AI', '新增竞品 changelog'])
  }
  assert.doesNotMatch(JSON.stringify(capturedConfigs), /创客贴|稿定设计|HeyGen|Higgsfield AI|Riverside/)
})

test('analysis records preserve multiple competitor urls for combined monitor records', async () => {
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async () => ({ code: 0, stdout: '', stderr: '' })
  })

  const created = await service.createRecord({
    projectId: 'competitor-analysis-product-urls-regression',
    kind: 'weekly',
    competitorIds: ['gaoding-id', 'heygen-id'],
    competitorNames: ['稿定设计', 'Heygen'],
    productUrls: ['https://www.gaoding.art/creation', 'https://www.heygen.com/'],
    productUrl: 'https://www.gaoding.art/creation',
    productName: '稿定设计、Heygen'
  })
  const listed = await service.listRecords({
    projectId: 'competitor-analysis-product-urls-regression'
  })

  assert.equal(created.ok, true)
  assert.deepEqual(created.record.productUrls, ['https://www.gaoding.art/creation', 'https://www.heygen.com/'])
  assert.deepEqual(listed.records[0].productUrls, ['https://www.gaoding.art/creation', 'https://www.heygen.com/'])
})

test('daily and weekly reports persist structured feature events from python evidence', async () => {
  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-11T08:00:00.000Z'),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), `# ${args[1]} result`)
      if (args[1] === 'daily') {
        await writeFile(join(env.OUTPUT_DIR, 'daily.json'), JSON.stringify({
          results: [{
            competitor: '稿定设计',
            scan_date: '2026-07-11',
            has_new_features: true,
            new_features: ['生成视频'],
            summary: '发现稿定设计上线生成视频能力。',
            entries: [{
              title: '稿定设计视频制作功能',
              url: 'https://www.gaoding.com/features/41',
              snippet: '稿定设计支持视频制作、剪辑和模板。',
              published_date: '2026-07-11'
            }]
          }]
        }))
      } else {
        await writeFile(join(env.OUTPUT_DIR, 'weekly.json'), JSON.stringify({
          changes: [{
            competitor: 'Heygen',
            category: '功能更新',
            summary: 'Heygen 上线 Avatar IV 新功能',
            details: '可用于生成更自然的 AI Avatar 视频。',
            impact: '高',
            source_urls: ['https://www.heygen.com/changelog/avatar-iv'],
            discovered_at: '2026-07-11T00:00:00.000Z'
          }]
        }))
      }
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const daily = await service.run({
    projectId: 'competitor-analysis-feature-events-regression',
    kind: 'daily',
    competitorNames: ['稿定设计'],
    productUrl: 'https://www.gaoding.art/creation'
  })
  const weekly = await service.run({
    projectId: 'competitor-analysis-feature-events-regression',
    kind: 'weekly',
    competitorNames: ['Heygen'],
    productUrl: 'https://www.heygen.com/'
  })
  const listed = await service.listRecords({
    projectId: 'competitor-analysis-feature-events-regression'
  })

  assert.equal(daily.featureEvents.length, 1)
  assert.equal(daily.featureEvents[0].competitorName, '稿定设计')
  assert.equal(daily.featureEvents[0].featureName, '生成视频')
  assert.deepEqual(daily.featureEvents[0].sourceUrls, ['https://www.gaoding.com/features/41'])
  assert.equal(weekly.featureEvents.length, 1)
  assert.equal(weekly.featureEvents[0].competitorName, 'Heygen')
  assert.match(weekly.featureEvents[0].featureName, /Avatar IV/)
  assert.deepEqual(weekly.featureEvents[0].sourceUrls, ['https://www.heygen.com/changelog/avatar-iv'])
  assert.ok(listed.records.some((record) => record.featureEvents?.length === 1))
})

test('daily reports ignore historical feature evidence instead of presenting it as today', async () => {
  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-11T08:00:00.000Z'),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), '# daily result\n\n## 🆕 发现新功能\n\n- 旧功能')
      await writeFile(join(env.OUTPUT_DIR, 'daily.json'), JSON.stringify({
        results: [{
          competitor: '稿定设计',
          scan_date: '2026-07-11',
          has_new_features: true,
          new_features: ['2025 年旧功能'],
          summary: '发现历史页面。',
          entries: [{
            title: '稿定 AI 旧功能发布',
            url: 'https://www.gaoding.com/old-feature',
            snippet: '2025 年发布的旧功能。',
            published_date: '2025-09-22'
          }]
        }, {
          competitor: 'Heygen',
          scan_date: '2026-07-10',
          has_new_features: true,
          new_features: ['昨天旧功能'],
          entries: [{
            title: 'Heygen yesterday release',
            url: 'https://www.heygen.com/blog/yesterday',
            published_date: '2026-07-10'
          }]
        }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-daily-today-only-regression',
    kind: 'daily',
    competitorNames: ['稿定设计', 'Heygen'],
    productUrls: ['https://www.gaoding.art/creation', 'https://www.heygen.com/']
  })

  assert.equal(response.ok, true)
  assert.deepEqual(response.featureEvents, [])
  assert.match(response.markdown, /今日未发现明确的新功能/)
  assert.doesNotMatch(response.markdown, /旧功能/)
  assert.doesNotMatch(response.markdown, /发现新功能：2 个竞品/)
})

test('weekly reports ignore changes outside the current monitoring period', async () => {
  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-11T08:00:00.000Z'),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), '# weekly result\n\n旧功能')
      await writeFile(join(env.OUTPUT_DIR, 'weekly.json'), JSON.stringify({
        report_date: '2026-07-11',
        period_start: '2026-07-04',
        period_end: '2026-07-11',
        changes: [{
          competitor: '稿定设计',
          category: '功能更新',
          summary: '2025 旧功能发布',
          details: '历史发布信息。',
          source_urls: ['https://www.gaoding.com/old'],
          discovered_at: '2025-09-22T00:00:00.000Z'
        }, {
          competitor: 'Heygen',
          category: '功能更新',
          summary: '上周旧功能发布',
          details: '不在本周周期。',
          source_urls: ['https://www.heygen.com/old'],
          discovered_at: '2026-07-03T23:59:59.000Z'
        }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-weekly-period-regression',
    kind: 'weekly',
    competitorNames: ['稿定设计', 'Heygen'],
    productUrls: ['https://www.gaoding.art/creation', 'https://www.heygen.com/']
  })

  assert.equal(response.ok, true)
  assert.deepEqual(response.featureEvents, [])
  assert.match(response.markdown, /本周未发现明确的竞品变更/)
  assert.doesNotMatch(response.markdown, /旧功能/)
})

test('createRecord preserves monitor feature events for later deep analysis', async () => {
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async () => ({ code: 0, stdout: '', stderr: '' })
  })

  const created = await service.createRecord({
    projectId: 'competitor-analysis-created-feature-event-regression',
    kind: 'weekly',
    competitorNames: ['稿定设计'],
    featureEvents: [{
      competitorName: '稿定设计',
      featureName: '生成视频',
      discoveredAt: '2026-07-11T00:00:00.000Z',
      sourceUrls: ['https://www.gaoding.com/features/41'],
      evidenceStatus: 'reported',
      rawEvidence: '周报标记稿定设计上线生成视频。'
    }]
  })
  const listed = await service.listRecords({
    projectId: 'competitor-analysis-created-feature-event-regression'
  })

  assert.equal(created.record.featureEvents.length, 1)
  assert.equal(created.record.featureEvents[0].featureName, '生成视频')
  assert.equal(listed.records[0].featureEvents[0].rawEvidence, '周报标记稿定设计上线生成视频。')
})

test('deep flow records preserve monitor evidence for backend model grounding', async () => {
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), '# flow result')
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: '稿定设计',
        feature: '生成视频',
        evidence_status: 'exact',
        evidence_reason: '监控报告来源已确认。',
        steps: [{ step_number: 1, description: '打开生成视频入口' }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const created = await service.createRecord({
    projectId: 'competitor-analysis-flow-evidence-regression',
    kind: 'flow',
    competitorNames: ['稿定设计'],
    competitorName: '稿定设计',
    productUrl: 'https://www.gaoding.art/creation',
    feature: '生成视频',
    sourceFeatureEvent: {
      competitorName: '稿定设计',
      featureName: '生成视频',
      discoveredAt: '2026-07-11',
      sourceUrls: ['https://www.gaoding.com/features/video'],
      evidenceStatus: 'official_verified',
      rawEvidence: '官网当天发布生成视频入口。'
    },
    monitorEvidence: {
      recordId: 'daily-record-1',
      kind: 'daily',
      title: '每日扫描结果',
      markdown: '# 今日证据\n\n官网当天发布生成视频入口。'
    }
  })
  const response = await service.run({
    ...created.record,
    recordId: created.record.id
  })
  const listed = await service.listRecords({
    projectId: 'competitor-analysis-flow-evidence-regression'
  })

  assert.equal(response.ok, true)
  assert.equal(listed.records[0].sourceFeatureEvent.featureName, '生成视频')
  assert.equal(listed.records[0].sourceFeatureEvent.evidenceStatus, 'official_verified')
  assert.match(listed.records[0].monitorEvidence.markdown, /官网当天发布生成视频入口/)
})

test('flow runs pass the selected competitor config to python', async () => {
  let capturedConfig = null
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      assert.equal(args[1], 'flow')
      assert.ok(env.COMPETITORS_CONFIG, 'flow run should receive selected competitor config')
      capturedConfig = JSON.parse(await readFile(env.COMPETITORS_CONFIG, 'utf8'))
      await writeFile(join(env.OUTPUT_DIR, '交互流程_稿定设计_AI_Avatar.md'), '# flow result')
      await writeFile(join(env.OUTPUT_DIR, 'flow_稿定设计_AI_Avatar.json'), JSON.stringify({
        competitor: '稿定设计',
        feature: 'AI Avatar',
        flow_description: '找到明确证据。',
        steps: [{ step_number: 1, description: '打开目标功能入口' }],
        evidence_status: 'exact',
        evidence_reason: '发现公开证据。',
        similar_features: []
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-flow-config-regression',
    kind: 'flow',
    competitorNames: ['稿定设计'],
    competitor: '稿定设计',
    competitorName: '稿定设计',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.art/creation',
    feature: 'AI Avatar'
  })

  assert.equal(response.ok, true)
  assert.equal(response.interactionArtifacts.evidenceStatus, 'exact')
  assert.deepEqual(capturedConfig.competitors.map((item) => item.name), ['稿定设计'])
  assert.equal(capturedConfig.competitors[0].url, 'https://www.gaoding.art/creation')
  assert.doesNotMatch(JSON.stringify(capturedConfig), /创客贴|Higgsfield AI|Riverside/)
})

test('flow python failures are not reported as generated reports', async () => {
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async () => ({ code: 1, stdout: '', stderr: 'boom' })
  })

  const response = await service.run({
    projectId: 'competitor-analysis-flow-failure-regression',
    kind: 'flow',
    competitor: '稿定设计',
    competitorName: '稿定设计',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.art/creation',
    feature: 'AI Avatar'
  })

  assert.equal(response.ok, false)
  assert.equal(response.statusLabel, '未完成')
  assert.match(response.summary, /boom|无法完成|检查/)
  assert.notEqual(response.interactionArtifacts?.evidenceStatus, 'exact')
})

test('flow fallback search results do not fabricate stage-two diagrams or wireframes', async () => {
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), [
        '# 交互流程分析：HeyGen - AI Avatar',
        '',
        '## 流程概述',
        '',
        '（LLM 不可用，以下为搜索结果原始信息）'
      ].join('\n'))
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: 'HeyGen',
        feature: 'AI Avatar',
        evidence_status: 'exact',
        evidence_reason: '搜索结果包含 AI Avatar。',
        steps: [
          { step_number: 1, description: '进入功能入口' },
          { step_number: 2, description: '配置AI Avatar' },
          { step_number: 3, description: '预览确认' },
          { step_number: 4, description: '导出或完成' }
        ]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-no-fake-stage-two-artifacts',
    kind: 'flow',
    competitor: 'HeyGen',
    competitorName: 'HeyGen',
    productName: 'HeyGen',
    productUrl: 'https://www.heygen.com/',
    feature: 'AI Avatar'
  })

  assert.equal(response.ok, true)
  assert.equal(response.interactionArtifacts.evidenceStatus, 'exact')
  assert.equal(response.interactionArtifacts.mainFlowFile, '')
  assert.equal(response.interactionArtifacts.stateDiagramFile, '')
  assert.deepEqual(response.interactionArtifacts.lowFiWireframeImages, [])
  assert.deepEqual(response.interactionArtifacts.stateMatrix, [])
  assert.deepEqual(response.interactionArtifacts.transitions, [])
})

test('flow fallback markdown is rewritten by configured codex model when evidence exists', async () => {
  let providerCalled = false
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async (payload = {}) => {
        providerCalled = true
        assert.equal(payload.model, 'gpt-5.5')
        assert.match(payload.userPrompt, /Python提取步骤/)
        assert.match(payload.userPrompt, /HeyGen/)
        return {
          provider: 'codex-cli',
          model: payload.model,
          content: '# 交互流程分析：HeyGen - AI Avatar\n\n## 功能证据校验\n\n基于爬虫证据，已找到 HeyGen AI Avatar 功能。\n\n## 页面交互框架与说明\n\n| 页面 | 证据 |\n|---|---|\n| Avatar 首页 | https://www.heygen.com/avatars |'
        }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), [
        '# 交互流程分析：HeyGen - AI Avatar',
        '',
        '（LLM 不可用，以下为搜索结果原始信息）'
      ].join('\n'))
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: 'HeyGen',
        feature: 'AI Avatar',
        evidence_status: 'exact',
        evidence_reason: '官网 Avatar 页面包含目标功能证据。',
        steps: [
          { step_number: 1, description: '打开 Avatar 页面', ui_element: 'Avatar 入口', expected_result: '展示 Avatar 能力' }
        ],
        source_urls: ['https://www.heygen.com/avatars']
      }))
      return { code: 0, stdout: '', stderr: '未配置 LLM_API_KEY' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-codex-model-fallback',
    kind: 'flow',
    competitor: 'HeyGen',
    competitorName: 'HeyGen',
    productName: 'HeyGen',
    productUrl: 'https://www.heygen.com/',
    feature: 'AI Avatar'
  })

  assert.equal(providerCalled, true)
  assert.equal(response.ok, true)
  assert.match(response.markdown, /页面交互框架与说明/)
  assert.doesNotMatch(response.markdown, /LLM 不可用/)
  assert.equal(response.interactionArtifacts.mainFlowFile, '')
  assert.deepEqual(response.interactionArtifacts.lowFiWireframeImages, [])
})

test('flow evidence_quality none rejects unsafe model output and returns no-evidence report', async () => {
  let providerCalled = false
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async () => {
        providerCalled = true
        return { content: '# 不应该生成' }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), '# 交互流程分析\n\n（LLM 不可用，以下为搜索结果原始信息）')
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: '稿定设计',
        feature: 'AI Avatar',
        evidence_quality: 'none',
        evidence_count: 0,
        evidence_status: 'not_found',
        evidence_reason: '未找到目标功能公开证据。',
        sources: [],
        raw_data: '',
        structured_data: {}
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-flow-no-evidence-gate',
    kind: 'flow',
    competitor: '稿定设计',
    competitorName: '稿定设计',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.art/creation',
    feature: 'AI Avatar'
  })

  assert.equal(providerCalled, true)
  assert.equal(response.ok, true)
  assert.match(response.markdown, /未找到|待补采/)
  assert.doesNotMatch(response.markdown, /不应该生成/)
  assert.equal(response.interactionArtifacts.evidenceStatus, 'not_found')
  assert.equal(response.interactionArtifacts.evidenceQuality, 'none')
  assert.equal(response.interactionArtifacts.evidenceCount, 0)
  assert.equal(response.interactionArtifacts.mainFlowFile, '')
  assert.deepEqual(response.interactionArtifacts.lowFiWireframeImages, [])
})

test('flow evidence_quality partial calls backend model with insufficiency instructions', async () => {
  let providerCalled = false
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async (payload = {}) => {
        providerCalled = true
        assert.match(payload.userPrompt, /证据质量：partial/)
        assert.match(payload.userPrompt, /证据不足|缺失|待补采/)
        assert.match(payload.userPrompt, /相似功能线索/)
        return {
          provider: 'codex-cli',
          model: payload.model,
          content: '# 交互流程分析：稿定设计 - AI Avatar\n\n## 功能证据校验\n\n当前仅有相似功能线索，目标功能待补采。\n\n## 缺口与补采\n\n- 待补采：公开页面未确认 AI Avatar。'
        }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), '# 交互流程分析\n\n未找到明确目标功能，仅有相似线索。')
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: '稿定设计',
        feature: 'AI Avatar',
        evidence_quality: 'partial',
        evidence_count: 1,
        evidence_status: 'similar',
        evidence_reason: '仅发现相似 AI 功能。',
        sources: [{ title: 'AI 设计工具', url: 'https://www.gaoding.com/ai', type: 'similar' }],
        similar_features: [{ name: 'AI 设计工具', url: 'https://www.gaoding.com/ai', description: 'AI 图片生成。' }],
        raw_data: 'AI 设计工具: AI 图片生成。',
        structured_data: { similar_features: [{ name: 'AI 设计工具' }] }
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-flow-partial-evidence-gate',
    kind: 'flow',
    competitor: '稿定设计',
    competitorName: '稿定设计',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.art/creation',
    feature: 'AI Avatar'
  })

  assert.equal(providerCalled, true)
  assert.equal(response.ok, true)
  assert.match(response.markdown, /待补采/)
  assert.equal(response.interactionArtifacts.evidenceStatus, 'similar')
  assert.equal(response.interactionArtifacts.evidenceQuality, 'partial')
  assert.equal(response.interactionArtifacts.evidenceCount, 1)
  assert.deepEqual(response.interactionArtifacts.lowFiWireframeImages, [])
})

test('framework evidence_quality none does not call backend model or show fabricated framework report', async () => {
  let providerCalled = false
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async () => {
        providerCalled = true
        return { content: '# 不应该生成完整框架' }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# 完整框架\n\n核心页面、关键任务链路、信息架构。')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '空站点',
        product_url: 'https://empty.example.com',
        evidence_quality: 'none',
        evidence_count: 0,
        sources: [],
        raw_data: '',
        structured_data: {},
        page_evidence: [],
        crawler_features: [],
        sitemap_navigation: []
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-framework-no-evidence-gate',
    kind: 'framework',
    productName: '空站点',
    productUrl: 'https://empty.example.com'
  })

  assert.equal(providerCalled, false)
  assert.equal(response.ok, true)
  assert.match(response.markdown, /未找到|待补采|证据质量：none/)
  assert.doesNotMatch(response.markdown, /核心页面、关键任务链路、信息架构/)
})

test('gap analysis requires source report content before any runner work', async () => {
  let pythonCalled = false
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async () => {
      pythonCalled = true
      return { code: 0, stdout: '', stderr: '' }
    },
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      generate: async () => ({ content: '# 不应该生成' })
    })
  })

  const response = await service.run({
    projectId: 'competitor-analysis-gap-missing-source-regression',
    kind: 'gap',
    productName: 'HeyGen'
  })

  assert.equal(pythonCalled, false)
  assert.equal(response.ok, false)
  assert.equal(response.kind, 'gap')
  assert.match(response.summary, /源报告内容|已有报告详情页/)
  assert.match(response.markdown, /机会点分析/)
})

test('gap analysis uses backend model from source report and persists source metadata', async () => {
  let pythonCalled = false
  let capturedPrompt = ''
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async () => {
      pythonCalled = true
      return { code: 0, stdout: '', stderr: '' }
    },
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      generate: async (payload = {}) => {
        capturedPrompt = payload.userPrompt
        assert.equal(payload.responseFormat, 'markdown')
        assert.equal(payload.timeoutMs, 0)
        assert.match(payload.systemPrompt, /不得编造/)
        return {
          content: [
            '# 机会点分析结果',
            '',
            '## 差距矩阵',
            '',
            '| 维度 | 我方产品 | 竞品 | 机会 |',
            '|---|---|---|---|',
            '| 爆款复刻 | 待补充 | HeyGen 提供模板化能力 | OP01：增强复刻链路 |',
            '',
            '## 机会点卡片',
            '',
            '- OP01：爆款视频结构拆解，来源：输入报告。'
          ].join('\n')
        }
      }
    })
  })

  const response = await service.run({
    projectId: 'competitor-analysis-gap-model-regression',
    kind: 'gap',
    competitorNames: ['HeyGen'],
    productName: 'HeyGen',
    sourceContent: '# 完整框架结果\n\nHeyGen 提供模板化视频生成与导出链路。',
    sourceRecordId: 'framework-record-1',
    sourceKind: 'framework',
    sourceTitle: '完整框架结果'
  })
  const listed = await service.listRecords({
    projectId: 'competitor-analysis-gap-model-regression'
  })

  assert.equal(pythonCalled, false)
  assert.equal(response.ok, true)
  assert.equal(response.kind, 'gap')
  assert.match(response.markdown, /机会点分析结果/)
  assert.match(capturedPrompt, /源报告内容/)
  assert.match(capturedPrompt, /HeyGen 提供模板化视频生成与导出链路/)
  assert.equal(listed.records[0].kind, 'gap')
  assert.equal(listed.records[0].sourceRecordId, 'framework-record-1')
  assert.equal(listed.records[0].sourceKind, 'framework')
  assert.match(listed.records[0].markdown, /OP01/)
})

test('python interaction flow serializes normalized evidence quality fields', () => {
  const result = spawnSync('python3', ['-c', `
from models import InteractionFlow
flow = InteractionFlow(competitor='稿定设计', feature='AI Avatar')
flow.evidence_quality = 'none'
flow.evidence_count = 0
flow.sources = []
flow.raw_data = ''
flow.structured_data = {'steps': []}
print(flow.to_dict())
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /'evidence_quality': 'none'/)
  assert.match(result.stdout, /'evidence_count': 0/)
  assert.match(result.stdout, /'structured_data': \{'steps': \[\]\}/)
})

test('python daily and weekly models serialize normalized evidence quality fields', () => {
  const result = spawnSync('python3', ['-c', `
from models import ScanResult, SearchEntry, WeeklyReport, ChangeRecord, ChangeCategory, ImpactLevel
scan = ScanResult(
    competitor='稿定设计',
    scan_date='2026-07-11',
    has_new_features=True,
    entries=[SearchEntry(title='今日上线生成视频', url='https://example.com/today')]
)
scan.evidence_quality = 'full'
scan.evidence_count = 1
scan.sources = [{'title': '今日上线生成视频', 'url': 'https://example.com/today'}]
scan.raw_data = '今日上线生成视频'
scan.structured_data = {'new_features': ['生成视频']}
change = ChangeRecord(
    competitor='HeyGen',
    category=ChangeCategory.FEATURE_UPDATE,
    summary='Avatar 更新',
    details='更新详情',
    impact=ImpactLevel.HIGH,
    source_urls=['https://example.com/avatar']
)
weekly = WeeklyReport(
    report_date='2026-07-11',
    period_start='2026-07-04',
    period_end='2026-07-11',
    changes=[change]
)
weekly.evidence_quality = 'full'
weekly.evidence_count = 1
weekly.sources = [{'title': 'Avatar 更新', 'url': 'https://example.com/avatar'}]
weekly.raw_data = 'Avatar 更新'
weekly.structured_data = {'changes': [change.to_dict()]}
print(scan.to_dict())
print(weekly.to_dict())
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /'evidence_quality': 'full'/)
  assert.match(result.stdout, /'evidence_count': 1/)
  assert.match(result.stdout, /'sources': \[\{'title': '今日上线生成视频'/)
  assert.match(result.stdout, /'structured_data': \{'new_features': \['生成视频'\]\}/)
})

test('python flow evidence treats video creation wording as exact generated-video evidence', () => {
  const result = spawnSync('python3', ['-c', `
from analyzer import _judge_flow_feature_evidence
from models import SearchEntry
entries = [
    SearchEntry(
        title='视频制作_视频在线剪辑制作_视频模板素材下载',
        url='https://www.gaoding.com/features/41',
        snippet='稿定设计提供视频制作、视频在线剪辑制作、视频模板素材下载。',
        content='进入稿定设计后选择视频模板，在线编辑并导出视频。'
    ),
    SearchEntry(
        title='稿定设计怎样将图片做成视频',
        url='https://www.36dianping.com/qa/2381.html',
        snippet='修改后点击生成按钮，生成图片视频，再导出到相册。',
        content=''
    )
]
print(_judge_flow_feature_evidence('稿定设计', '生成视频', entries)['status'])
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'exact')
})

test('python daily scan only marks today-dated entries as new features', () => {
  const result = spawnSync('python3', ['-c', `
from analyzer import scan_for_new_features
from models import SearchEntry
entries = [
    SearchEntry(title='稿定 AI 旧功能发布', url='https://example.com/old', snippet='发布 AI 功能', published_date='2025-09-22'),
    SearchEntry(title='稿定 AI 今日上线', url='https://example.com/today', snippet='今日上线新功能', published_date='2026-07-11')
]
result = scan_for_new_features('稿定设计', entries, today='2026-07-11')
print(result.has_new_features)
print('|'.join(result.new_features))
print(len(result.entries))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /True/)
  assert.match(result.stdout, /稿定 AI 今日上线/)
  assert.doesNotMatch(result.stdout, /旧功能/)
  assert.match(result.stdout.trim().split('\n').at(-1), /^1$/)
})

test('python weekly analysis only keeps entries inside the monitoring period', () => {
  const result = spawnSync('python3', ['-c', `
from analyzer import analyze_changes
from models import SearchEntry
entries = [
    SearchEntry(title='稿定 AI 旧功能发布', url='https://example.com/old', snippet='发布 AI 功能', published_date='2025-09-22'),
    SearchEntry(title='稿定 AI 本周上线', url='https://example.com/week', snippet='本周上线新功能', published_date='2026-07-08')
]
changes = analyze_changes('稿定设计', entries, period_start='2026-07-04', period_end='2026-07-11')
print(len(changes))
for change in changes:
    print(change.summary)
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^1\n/)
  assert.match(result.stdout, /稿定 AI 本周上线/)
  assert.doesNotMatch(result.stdout, /旧功能/)
})
