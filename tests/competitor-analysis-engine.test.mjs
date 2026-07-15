import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

test('daily weekly and monthly runs use selected competitors instead of python defaults', async () => {
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
  await service.run({
    projectId: 'competitor-analysis-selected-competitor-regression',
    kind: 'monthly',
    competitorNames: ['创客贴'],
    productName: '创客贴',
    productUrl: 'https://www.chuangkit.com/'
  })

  assert.equal(capturedConfigs.length, 3)
  assert.deepEqual(capturedConfigs.map((item) => item.args[1]), ['daily', 'weekly', 'monthly'])
  assert.deepEqual(capturedConfigs[0].config.competitors.map((item) => item.name), ['稿定设计'])
  assert.deepEqual(capturedConfigs[1].config.competitors.map((item) => item.name), ['Heygen'])
  assert.deepEqual(capturedConfigs[2].config.competitors.map((item) => item.name), ['创客贴'])
  assert.equal(capturedConfigs[0].config.competitors[0].url, 'https://www.gaoding.art/creation')
  assert.equal(capturedConfigs[1].config.competitors[0].url, 'https://www.heygen.com/')
  assert.equal(capturedConfigs[2].config.competitors[0].url, 'https://www.chuangkit.com/')
  assert.doesNotMatch(JSON.stringify(capturedConfigs), /Higgsfield AI|Riverside/)
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

test('legacy analysis records stay visible but are marked stale while new records use current version', async () => {
  const projectId = 'competitor-analysis-legacy-version-regression'
  const recordTime = '2026-07-15T08:00:00.000Z'
  await mkdir('backend/storage/competitor-analysis', { recursive: true })
  await writeFile(join('backend/storage/competitor-analysis', `${projectId}.records.json`), JSON.stringify({
    records: [{
      id: 'legacy-framework-record',
      projectId,
      kind: 'framework',
      title: '完整框架：旧版结果',
      status: 'succeeded',
      statusLabel: '已生成',
      competitorNames: ['旧版竞品'],
      productName: '旧版竞品',
      productUrl: 'https://legacy.example.com',
      summary: '旧版规则下生成的完整框架。',
      markdown: '# 旧版完整框架',
      createdAt: recordTime,
      updatedAt: recordTime
    }]
  }, null, 2))

  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async () => ({ code: 0, stdout: '', stderr: '' })
  })
  const created = await service.createRecord({
    projectId,
    kind: 'framework',
    competitorNames: ['新版竞品'],
    productName: '新版竞品',
    productUrl: 'https://current.example.com'
  })
  const listed = await service.listRecords({ projectId })
  const legacyRecord = listed.records.find((record) => record.id === 'legacy-framework-record')
  const currentRecord = listed.records.find((record) => record.id === created.record.id)

  assert.equal(created.record.analysisVersion, '2026-07-15-competitor-analysis-v3')
  assert.equal(created.record.isStaleAnalysis, false)
  assert.ok(legacyRecord)
  assert.equal(legacyRecord.analysisVersion, 'legacy')
  assert.equal(legacyRecord.isStaleAnalysis, true)
  assert.equal(legacyRecord.failureType, 'stale_version')
  assert.match(legacyRecord.staleReason, /已升级|重新分析/)
  assert.ok(currentRecord)
  assert.equal(currentRecord.analysisVersion, '2026-07-15-competitor-analysis-v3')
  assert.equal(currentRecord.isStaleAnalysis, false)
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

test('weekly no-findings reports disclose undated search candidates instead of implying no updates', async () => {
  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-14T08:00:00.000Z'),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), '# weekly result\n\n未发现')
      await writeFile(join(env.OUTPUT_DIR, 'weekly.json'), JSON.stringify({
        report_date: '2026-07-14',
        period_start: '2026-07-07',
        period_end: '2026-07-14',
        changes: [],
        structured_data: {
          search_diagnostics: [{
            competitor: '稿定设计',
            total_candidates: 25,
            dated_candidates: 0,
            reason: '检索到候选结果，但结果未提供发布日期，不能判定为本周更新。',
            sample_entries: Array.from({ length: 6 }, (_, index) => ({
              title: `稿定设计候选 ${index + 1}`,
              url: `https://www.gaoding.com/candidate-${index + 1}`,
              snippet: `候选 ${index + 1} 的公开摘要`
            }))
          }]
        }
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-weekly-search-diagnostics-regression',
    kind: 'weekly',
    competitorNames: ['稿定设计']
  })

  assert.equal(response.ok, true)
  assert.match(response.markdown, /检索识别状态/)
  assert.match(response.markdown, /\| 竞品 \| 候选数 \| 带本周日期候选 \| 识别状态 \|/)
  assert.match(response.markdown, /\| 稿定设计 \| 25 \| 0 \| 检索到候选结果，但结果未提供发布日期，不能判定为本周更新。 \|/)
  assert.match(response.markdown, /不能判定为本周更新/)
  assert.match(response.markdown, /## 候选粗读总览/)
  assert.match(response.markdown, /\| 竞品 \| 候选数 \| 可确认本周更新 \| 疑似功能主题 \| 疑似功能解读 \| 粗略链路框架 \| 粗读结论 \| 建议动作 \|/)
  assert.match(response.markdown, /## 候选明细表/)
  assert.match(response.markdown, /稿定设计候选 1/)
  assert.match(response.markdown, /稿定设计候选 6/)
})

test('monthly no-findings reports use a monthly title and 30-day monitoring period', async () => {
  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-15T08:00:00.000Z'),
    pythonRunner: async (args, env) => {
      assert.equal(args[1], 'monthly')
      await writeFile(join(env.OUTPUT_DIR, `${args[1]}.md`), '# monthly result\n\n未发现')
      await writeFile(join(env.OUTPUT_DIR, 'monthly.json'), JSON.stringify({
        report_date: '2026-07-15',
        period_start: '2026-06-15',
        period_end: '2026-07-15',
        changes: [],
        search_diagnostics: [{
          competitor: '稿定设计',
          total_candidates: 18,
          dated_candidates: 0,
          reason: '检索到候选结果，但结果未提供发布日期，不能判定为本月更新。',
          sample_entries: [{
            title: '稿定设计 AI 创作 2.0：AI设计、智能编辑、协作交付重塑全链路智创',
            url: 'https://www.gaoding.com/release',
            snippet: '推出 AI 设计模型、全新全场景智能编辑器、智能团队协作等能力，覆盖创意生成到全场景应用。'
          }]
        }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-monthly-no-findings-regression',
    kind: 'monthly',
    competitorNames: ['稿定设计'],
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.com/'
  })

  assert.equal(response.ok, true)
  assert.match(response.title, /月报生成结果/)
  assert.match(response.markdown, /# 竞品监控月报/)
  assert.match(response.markdown, /监控周期：2026-06-15 ~ 2026-07-15/)
  assert.match(response.markdown, /本月概览/)
  assert.match(response.markdown, /本月未发现明确的竞品变更/)
  assert.match(response.markdown, /\| 竞品 \| 候选数 \| 带本月日期候选 \| 识别状态 \|/)
  assert.match(response.markdown, /\| 稿定设计 \| 18 \| 0 \| 检索到候选结果，但结果未提供发布日期，不能判定为本月更新。 \|/)
  assert.match(response.markdown, /## 候选粗读总览/)
  assert.match(response.markdown, /\| 竞品 \| 候选数 \| 可确认本月更新 \| 疑似功能主题 \| 疑似功能解读 \| 粗略链路框架 \| 粗读结论 \| 建议动作 \|/)
  assert.match(response.markdown, /\| 稿定设计 \| 18 \| 0 \| AI 设计、智能编辑、协作交付 \| AI 设计模型、智能编辑器、团队协作\/协作交付 \| 创意生成 -> 智能编辑 -> 团队协作 -> 场景交付 \| 候选待确认 \| 补采官方公告或可用发布日期 \|/)
  assert.match(response.markdown, /## 候选明细表/)
  assert.match(response.markdown, /\| 竞品 \| 候选标题 \| 疑似功能主题 \| 候选提到的功能 \| 粗略链路位置 \| 日期 \| 来源 \| 摘要 \|/)
  assert.match(response.markdown, /稿定设计 AI 创作 2\.0/)
  assert.match(response.markdown, /AI 设计、智能编辑、协作交付/)
  assert.match(response.markdown, /AI 设计模型、智能编辑器、团队协作\/协作交付/)
  assert.match(response.markdown, /创意生成 -> 智能编辑 -> 团队协作 -> 场景交付/)
})

test('monthly reports surface confirmed launched features with source backed path analysis entry', async () => {
  const projectId = 'competitor-analysis-monthly-confirmed-feature-regression'
  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-15T08:00:00.000Z'),
    pythonRunner: async (args, env) => {
      assert.equal(args[1], 'monthly')
      await writeFile(join(env.OUTPUT_DIR, 'monthly.md'), '# monthly result\n\n确认上线')
      await writeFile(join(env.OUTPUT_DIR, 'monthly.json'), JSON.stringify({
        report_date: '2026-07-15',
        period_start: '2026-06-15',
        period_end: '2026-07-15',
        changes: [{
          competitor: '稿定设计',
          category: '功能更新',
          summary: '稿定设计上线 AI 设计助手新功能',
          details: '官方公告显示 AI 设计助手支持输入需求、生成视觉方案、进入编辑器继续调整并导出。',
          impact: '高',
          source_urls: ['https://www.gaoding.com/release/ai-design-assistant'],
          source_entries: [{
            title: '稿定设计 AI 设计助手上线',
            url: 'https://www.gaoding.com/release/ai-design-assistant',
            snippet: '从 AI 设计助手入口输入需求，生成视觉方案后进入编辑器调整并导出。',
            published_date: '2026-07-10',
            source: 'official'
          }],
          discovered_at: '2026-07-10T10:00:00.000Z'
        }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId,
    kind: 'monthly',
    competitorNames: ['稿定设计'],
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.com/'
  })
  const listed = await service.listRecords({ projectId })

  assert.equal(response.ok, true)
  assert.equal(response.featureEvents.length, 1)
  assert.equal(response.featureEvents[0].competitorName, '稿定设计')
  assert.equal(response.featureEvents[0].featureName, 'AI 设计助手')
  assert.deepEqual(response.featureEvents[0].sourceUrls, ['https://www.gaoding.com/release/ai-design-assistant'])
  assert.equal(response.featureEvents[0].sourceEntries[0].publishedDate, '2026-07-10')
  assert.match(response.markdown, /## 本月确认上线功能/)
  assert.match(response.markdown, /AI 设计助手/)
  assert.match(response.markdown, /https:\/\/www\.gaoding\.com\/release\/ai-design-assistant/)
  assert.match(response.markdown, /真实链路操作路径/)
  assert.match(response.markdown, /输入需求 -> 生成视觉方案 -> 编辑器调整 -> 导出/)
  assert.match(response.markdown, /## 本月真实链路框架/)
  assert.match(response.markdown, /\| 节点 \| 页面\/触点 \| 触发操作 \| 证据来源 \| 状态 \|/)
  assert.match(response.markdown, /\| S1 \| AI 设计助手入口 \| 进入功能入口 \| \[来源\]\(https:\/\/www\.gaoding\.com\/release\/ai-design-assistant\) \| 来源线索 \|/)
  assert.match(response.markdown, /\| S2 \| AI 设计助手入口 \| 输入需求 \| \[来源\]\(https:\/\/www\.gaoding\.com\/release\/ai-design-assistant\) \| 来源线索 \|/)
  assert.match(response.markdown, /\| S3 \| 生成结果页\/方案页 \| 生成视觉方案 \| \[来源\]\(https:\/\/www\.gaoding\.com\/release\/ai-design-assistant\) \| 来源线索 \|/)
  assert.match(response.markdown, /\| S4 \| 编辑器 \| 编辑器调整 \| \[来源\]\(https:\/\/www\.gaoding\.com\/release\/ai-design-assistant\) \| 来源线索 \|/)
  assert.match(response.markdown, /\| S5 \| 导出\/交付页 \| 导出 \| \[来源\]\(https:\/\/www\.gaoding\.com\/release\/ai-design-assistant\) \| 来源线索 \|/)
  assert.match(response.markdown, /深度分析/)
  assert.ok(listed.records.some((record) => record.kind === 'monthly' && record.featureEvents?.[0]?.featureName === 'AI 设计助手'))
})

test('python weekly diagnostics keeps enough candidate samples for report review', async () => {
  const mainSource = await readFile(new URL('../backend/services/competitor-analysis-engine/python/竞品监控系统/main.py', import.meta.url), 'utf8')

  assert.match(mainSource, /for entry in entries\[:30\]/)
})

test('python monthly monitor uses 30 days and writes monthly raw data', async () => {
  const mainSource = await readFile(new URL('../backend/services/competitor-analysis-engine/python/竞品监控系统/main.py', import.meta.url), 'utf8')

  assert.match(mainSource, /def run_monthly_monitor\(competitors: List\[Competitor\]\) -> WeeklyReport:/)
  assert.match(mainSource, /return run_periodic_monitor\(competitors,\s*days=config\.MONTHLY_DAYS,\s*report_kind="monthly"/)
  assert.match(mainSource, /monthly_data_\{report\.report_date\}\.json/)
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
  let capturedArgs = null
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      capturedArgs = args
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
  assert.ok(capturedArgs.includes('--url'))
  assert.equal(capturedArgs[capturedArgs.indexOf('--url') + 1], 'https://www.gaoding.art/creation')
  assert.deepEqual(capturedConfig.competitors.map((item) => item.name), ['稿定设计'])
  assert.equal(capturedConfig.competitors[0].url, 'https://www.gaoding.art/creation')
  assert.doesNotMatch(JSON.stringify(capturedConfig), /创客贴|Higgsfield AI|Riverside/)
})

test('python flow analysis crawls the competitor site before search-engine fallback when url is available', () => {
  const result = spawnSync('python3', ['-c', `
import json
import main
from models import Competitor, SearchEntry, InteractionFlow

events = []

def fake_deep_crawl_product(url, product_name=""):
    events.append(["crawl", url, product_name])
    class FakeResult:
        def __init__(self):
            self.pages = {
                "https://example.com/tools/video": type("Page", (), {
                    "url": "https://example.com/tools/video",
                    "title": "AI 视频生成",
                    "content": "上传素材后即可生成视频",
                    "features": [{"name": "AI 视频生成"}],
                })()
            }
            self.sitemap_navigation = [
                {"name": "视频工具", "url": "https://example.com/tools/video", "evidence": "sitemap"}
            ]
    return FakeResult()

def fake_search_competitor(name, keywords, days=365):
    events.append(["search", name, days, len(keywords)])
    return [SearchEntry(
        title="帮助中心 - 视频生成",
        url="https://example.com/help/video",
        snippet="帮助页",
        content="帮助中心描述视频生成流程"
    )]

def fake_enrich_entries_with_content(entries, max_pages=20):
    events.append(["enrich", len(entries), max_pages])
    return entries

def fake_extract_interaction_flow(competitor_name, feature, entries):
    events.append(["extract", competitor_name, feature, len(entries), entries[0].url if entries else ""])
    flow = InteractionFlow(competitor=competitor_name, feature=feature)
    flow.evidence_status = "exact"
    flow.evidence_quality = "full"
    flow.evidence_count = len(entries)
    flow.source_urls = [entry.url for entry in entries]
    flow.structured_data = {"steps": []}
    return flow

main.site_crawler.deep_crawl_product = fake_deep_crawl_product
main.scraper.search_competitor = fake_search_competitor
main.scraper.enrich_entries_with_content = fake_enrich_entries_with_content
main.analyzer.extract_interaction_flow = fake_extract_interaction_flow
main.reporter.generate_interaction_doc = lambda flow: "/tmp/flow.md"
main.reporter.save_raw_data = lambda data, filename, output_dir: None

competitors = [Competitor(name="Example", url="https://example.com", tier=None, keywords=[])]
main.run_interaction_flow(competitors, "Example", "生成视频")
print(json.dumps(events, ensure_ascii=False))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  const events = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.deepEqual(events[0], ['crawl', 'https://example.com', 'Example'])
  assert.deepEqual(events[1], ['search', 'Example', 365, 5])
  assert.deepEqual(events[2], ['enrich', 2, 20])
  assert.deepEqual(events[3], ['extract', 'Example', '生成视频', 2, 'https://example.com/tools/video'])
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

test('flow composite evidence allows analysis prompt and preserves generated artifacts', async () => {
  let providerCalled = false
  let seenPrompt = ''
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
        seenPrompt = payload.userPrompt
        return {
          provider: 'codex-cli',
          model: payload.model,
          content: '# 交互流程分析：稿定设计 - AI 生视频\n\n## 功能证据校验\n\n组合证据显示其具备 AI 图片生成与视频编辑/模板链路，可继续分析；直接官方声明待补采。\n\n## 页面总览表\n\n| P编号 | 页面名称 | 类型 | 目的 | 证据置信度 |\n| --- | --- | --- | --- | --- |\n| P01 | AI 图片生成页 | page | 生成素材 | 组合证据 |\n\n## 待补采清单\n\n- 补采直接“AI 生视频”官方声明。'
        }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), '# 交互流程分析\n\n组合证据可分析。')
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: '稿定设计',
        feature: 'AI 生视频',
        flow_description: '组合证据可分析。',
        evidence_quality: 'partial',
        evidence_count: 2,
        evidence_status: 'similar',
        evidence_reason: '发现高置信组合证据。',
        sources: [
          { title: 'AI 一键生成图片', url: 'https://www.gaoding.com/ai-image', type: 'composite' },
          { title: '在线视频剪辑与视频模板', url: 'https://www.gaoding.com/video-editor', type: 'composite' }
        ],
        similar_features: [],
        raw_data: 'AI 一键生成图片\\n在线视频剪辑与视频模板',
        structured_data: {
          evidence_mode: 'composite',
          evidence_confidence: 'high',
          analysis_allowed: true,
          capability_signals: ['image_generation', 'video_editing', 'video_template']
        },
        main_flow_file: '主流程图.drawio',
        state_diagram_file: '状态图.drawio',
        low_fi_wireframe_images: ['P01.png']
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-flow-composite-evidence',
    kind: 'flow',
    competitor: '稿定设计',
    competitorName: '稿定设计',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.com',
    feature: 'AI 生视频'
  })

  assert.equal(providerCalled, true)
  assert.match(seenPrompt, /证据质量：partial/)
  assert.match(seenPrompt, /证据模式：composite/)
  assert.match(seenPrompt, /是否允许分析：true/)
  assert.match(seenPrompt, /高置信组合证据/)
  assert.doesNotMatch(seenPrompt, /标题、结论和流程都必须明确标注/)
  assert.equal(response.ok, true)
  assert.match(response.markdown, /组合证据/)
  assert.equal(response.interactionArtifacts.evidenceStatus, 'similar')
  assert.equal(response.interactionArtifacts.evidenceQuality, 'partial')
  assert.equal(response.interactionArtifacts.evidenceCount, 2)
  assert.match(response.interactionArtifacts.mainFlowFile.content, /主流程图/)
  assert.match(response.interactionArtifacts.stateDiagramFile.content, /状态图/)
  assert.deepEqual(response.interactionArtifacts.lowFiWireframeImages, ['P01.png'])
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

test('framework python placeholder report is not marked as a generated framework', async () => {
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: false,
      provider: '',
      defaultModel: '',
      timeoutMs: 0
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), [
        '# 稿定设计完整流程框架文档',
        '',
        '## 一、产品整体信息架构',
        '',
        '| 模块编号 | 功能模块 | 所属层级 | 核心用途 |',
        '|---|---|---|---|',
        '| M001 | AI图片生成 | L1 | 公开页面线索 |',
        '',
        '## 二、完整用户旅程',
        '',
        '```',
        'AI图片生成',
        '├─ 异常流:',
        '│   ├── (LLM 不可用，无法提取异常流)',
        '```',
        '',
        '## 三、关键决策点汇总',
        '',
        '| 序号 | 所在位置 | 决策内容 |',
        '|---|---|---|',
        '| 1 | (待分析) | (LLM 不可用，无法识别决策点) |',
        '',
        '## 五、数据流与状态流转',
        '',
        '状态流转 - (待分析)',
        '',
        '(LLM 不可用) ──[(待分析)]──> (待分析)',
        '',
        '## 六、跨功能关联',
        '',
        '| 序号 | 源功能 | 目标功能 | 关联类型 |',
        '|---|---|---|---|',
        '| 1 | (待分析) | (待分析) | (LLM 不可用，无法分析) |'
      ].join('\n'))
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '稿定设计',
        product_url: 'https://www.gaoding.com',
        evidence_quality: 'full',
        evidence_count: 12,
        page_evidence: [{ title: 'AI图片生成', url: 'https://www.gaoding.com/editor' }],
        crawler_features: [{ name: 'AI图片生成', url: 'https://www.gaoding.com/editor' }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-framework-placeholder-regression',
    kind: 'framework',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.com'
  })

  assert.equal(response.ok, false)
  assert.equal(response.statusLabel, '未完成')
  assert.match(response.summary, /模型|占位|重新运行/)
  assert.doesNotMatch(response.markdown, /LLM 不可用|待分析/)
})

test('framework python runs with interactive crawl limits so blocked sites do not hang the UI', async () => {
  let capturedEnv = null
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: false,
      provider: '',
      defaultModel: '',
      timeoutMs: 0
    }),
    pythonRunner: async (args, env) => {
      capturedEnv = env
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# 创客贴完整框架')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '创客贴',
        product_url: 'https://www.chuangkit.com',
        evidence_quality: 'none',
        evidence_count: 0
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  await service.run({
    projectId: 'competitor-analysis-framework-runtime-limits-regression',
    kind: 'framework',
    productName: '创客贴',
    productUrl: 'https://www.chuangkit.com'
  })

  assert.equal(capturedEnv.MAX_CRAWL_PAGES, '24')
  assert.equal(capturedEnv.MAX_CRAWL_DEPTH, '2')
  assert.equal(capturedEnv.MAX_RETRIES, '1')
  assert.equal(capturedEnv.FETCH_TIMEOUT, '5')
  assert.equal(capturedEnv.REQUEST_DELAY, '0.1')
})

test('stale empty running framework records are recovered as failed records on list', async () => {
  const projectId = 'competitor-analysis-stale-running-regression'
  const staleTime = '2026-07-14T08:00:00.000Z'
  await mkdir('backend/storage/competitor-analysis', { recursive: true })
  await writeFile(join('backend/storage/competitor-analysis', `${projectId}.records.json`), JSON.stringify({
    records: [{
      id: 'stale-framework-record',
      projectId,
      kind: 'framework',
      title: '完整框架：创客贴',
      status: 'running',
      statusLabel: '分析中',
      productName: '创客贴',
      productUrl: 'https://www.chuangkit.com',
      summary: '',
      markdown: '',
      createdAt: staleTime,
      updatedAt: staleTime
    }]
  }, null, 2))

  const service = createCompetitorAnalysisEngineService({
    currentDateProvider: () => new Date('2026-07-14T08:20:01.000Z')
  })
  const result = await service.listRecords({ projectId })

  assert.equal(result.records[0].status, 'failed')
  assert.equal(result.records[0].statusLabel, '未完成')
  assert.match(result.records[0].summary, /运行中断|重新运行/)
  assert.match(result.records[0].markdown, /运行中断|重新运行/)
})

test('framework model receives the complete visible page inventory and strict output contract', async () => {
  let capturedPrompt = ''
  const pageEvidence = Array.from({ length: 95 }, (_, index) => ({
    title: `页面 ${index + 1}`,
    url: `https://example.com/page-${index + 1}`,
    content: `页面 ${index + 1} 的公开功能说明`,
    features: [{ name: `功能 ${index + 1}` }]
  }))
  const sitemapOnlyPages = Array.from({ length: 300 }, (_, index) => ({
    title: `Sitemap 独有页 ${index + 1}`,
    url: `https://example.com/sitemap-only-${index + 1}`
  }))
  const completeReport = [
    '# 示例产品完整流程框架',
    '## 结构化节点树',
    '```text',
    '示例产品 / 产品框架',
    '1. 产品矩阵层',
    '- 示例产品 Web',
    '2. 顶层导航层',
    '- 产品 / 解决方案 / 帮助',
    '3. 创作模式/核心工作台层',
    '- 创建工具',
    '4. 核心能力层',
    '- 模板创建 / 在线编辑',
    '5. 重点场景层',
    '- 内容创建',
    '6. 模板与资产层',
    '- 模板库',
    '7. 协作与商业化层',
    '- 团队协作 / 订阅',
    '8. 核心任务链路',
    '- 进入官网 -> 选择工具 -> 编辑 -> 完成',
    '```',
    '## Markdown 报告版',
    '示例产品是一套围绕公开导航、创建工具和模板资产组织的内容创建平台。',
    '## 零、产品定位与分析边界',
    '示例产品面向公开网站访客，分析范围为本次采集到的页面和导航证据。',
    '## 一、产品整体信息架构',
    '### 1.1 导航结构',
    '公开导航包含产品、解决方案和帮助栏目。',
    '### 1.2 功能模块划分',
    '| 模块 | 目的 | 置信度 |\n|---|---|---|\n| 创建工具 | 完成内容创建 | full |',
    '### 1.3 完整页面清单与站点地图',
    '| 页面 | URL | 层级 | 目的 | 置信度 |\n|---|---|---|---|---|',
    ...pageEvidence.map((page) => `| ${page.title} | ${page.url} | L2 | 公开功能页 | full |`),
    ...sitemapOnlyPages.map((page) => `| ${page.title} | ${page.url} | L2 | 待继续抓取 | partial |`),
    '## 二、用户角色与使用场景',
    '| 角色 | 目标 | 场景 |\n|---|---|---|\n| 内容创建者 | 完成创建任务 | 从官网进入工具 |',
    '## 三、完整用户旅程',
    '### 主路径',
    '进入工具 → 配置内容 → 预览 → 完成。',
    '### 分支路径',
    '选择模板 → 修改模板 → 回到预览。',
    '### 异常路径',
    '生成失败 → 查看原因 → 重试。',
    '## 四、关键决策点',
    '| 决策 | 选项 | 依据 |\n|---|---|---|\n| 创建方式 | 模板/空白 | 任务效率 |',
    '## 五、状态与异常',
    '| 当前状态 | 目标状态 | 条件 |\n|---|---|---|\n| 编辑中 | 已完成 | 提交成功 |',
    '## 六、跨功能关联',
    '| 来源 | 去向 | 关系 |\n|---|---|---|\n| 模板 | 编辑器 | 数据共享 |',
    '## 七、可复用 UX 洞察',
    '保留任务上下文可降低跨页面操作成本。',
    '## 八、证据与待补采',
    '证据来源为页面清单中的公开 URL；登录后页面待补采。'
  ].join('\n\n')
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
        capturedPrompt = payload.userPrompt
        return { content: completeReport }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# Python framework result')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '示例产品',
        product_url: 'https://example.com',
        evidence_quality: 'full',
        evidence_count: pageEvidence.length,
        sources: pageEvidence.map(({ title, url, content }) => ({ title, url, snippet: content })),
        page_evidence: pageEvidence,
        crawler_features: pageEvidence.map((page, index) => ({ name: `功能 ${index + 1}`, url: page.url })),
        sitemap_navigation: [
          ...pageEvidence.map((page, index) => ({ name: `栏目 ${index + 1}`, url: page.url, children: [] })),
          ...sitemapOnlyPages.map((page) => ({ name: page.title, url: page.url, children: [] }))
        ]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-framework-complete-evidence-regression',
    kind: 'framework',
    productName: '示例产品',
    productUrl: 'https://example.com'
  })

  assert.equal(response.ok, true)
  assert.match(capturedPrompt, /完整站点页面清单|完整页面清单/)
  assert.match(capturedPrompt, /=== 完整站点页面清单（报告必须原样包含以下清单，不得省略） ===/)
  assert.match(capturedPrompt, /L1 \| 页面 95 \| https:\/\/example\.com\/page-95/)
  assert.match(capturedPrompt, /L1 \| Sitemap 独有页 300 \| https:\/\/example\.com\/sitemap-only-300/)
  assert.match(capturedPrompt, /报告必须包含"完整站点页面清单"章节[\s\S]*全部内容原样复制到报告中，不得省略、合并或只列部分页面/)
  assert.match(capturedPrompt, /不得只列核心页面/)
  assert.match(capturedPrompt, /结构化节点树/)
  assert.match(capturedPrompt, /Markdown 报告版/)
  assert.match(capturedPrompt, /产品矩阵层/)
  assert.match(capturedPrompt, /核心任务链路/)
  assert.match(capturedPrompt, /主路径/)
  assert.match(capturedPrompt, /分支路径/)
  assert.match(capturedPrompt, /异常路径/)
  assert.match(capturedPrompt, /页面 95/)
  assert.match(capturedPrompt, /https:\/\/example\.com\/page-95/)
  assert.match(capturedPrompt, /https:\/\/example\.com\/sitemap-only-300/)
  assert.ok(capturedPrompt.length < 120000)
})

test('framework partial coverage keeps public page evidence usable instead of globally downgrading report', async () => {
  let capturedPrompt = ''
  const completeReport = [
    '# 示例产品完整流程框架',
    '## 结构化节点树',
    '```text',
    '示例产品 / 产品框架',
    '1. 产品矩阵层',
    '- 示例产品 Web',
    '2. 顶层导航层',
    '- 首页 / 创建',
    '3. 创作模式/核心工作台层',
    '- 创建工具',
    '4. 核心能力层',
    '- 在线编辑',
    '5. 重点场景层',
    '- 内容创建',
    '6. 模板与资产层',
    '- 模板库',
    '7. 协作与商业化层',
    '- 订阅',
    '8. 核心任务链路',
    '- 进入首页 -> 选择创建 -> 编辑 -> 导出',
    '```',
    '## Markdown 报告版',
    '示例产品的公开页面证据可以确认首页和创建入口，未抓取正文的 sitemap 页面单独列为待补采。',
    '## 零、产品定位与分析边界',
    '基于公开 URL、页面标题和导航入口还原产品框架。',
    '## 一、产品整体信息架构',
    '### 完整站点页面清单',
    '| 页面 | URL | 层级 | 目的 | 置信度 |\n|---|---|---|---|---|\n| 首页 | https://example.com | L1 | 公开入口 | full |\n| 创建 | https://example.com/create | L1 | 创建入口 | full |',
    '## 二、用户角色与使用场景',
    '内容创建者从公开入口进入创建工具。',
    '## 三、完整用户旅程',
    '### 主路径',
    '首页 → 创建 → 编辑 → 导出。',
    '### 分支路径',
    '选择模板 → 回到编辑。',
    '### 异常路径',
    '导出失败 → 重试。',
    '## 四、关键决策点',
    '用户在模板创建和空白创建之间选择。',
    '## 五、状态与异常',
    '编辑中 → 导出中 → 成功/失败。',
    '## 六、跨功能关联',
    '模板资产进入编辑器复用。',
    '## 七、可复用 UX 洞察',
    '公开入口应直达核心创建任务。',
    '## 八、证据与待补采',
    '已确认：首页、创建公开 URL；待补采：登录后工作台细节。'
  ].join('\n\n')
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
        capturedPrompt = payload.userPrompt
        return { content: completeReport }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# Python partial framework result')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '示例产品',
        product_url: 'https://example.com',
        evidence_quality: 'partial',
        evidence_count: 3,
        page_evidence: [
          { title: '首页', url: 'https://example.com', content: '公开首页' },
          { title: '创建', url: 'https://example.com/create', content: '公开创建入口' }
        ],
        sitemap_navigation: [
          { name: '首页', url: 'https://example.com', children: [] },
          { name: '创建', url: 'https://example.com/create', children: [] },
          { name: '登录后工作台', url: 'https://example.com/workspace', children: [] }
        ]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  await service.run({
    projectId: 'competitor-analysis-framework-partial-public-evidence',
    kind: 'framework',
    productName: '示例产品',
    productUrl: 'https://example.com'
  })

  assert.match(capturedPrompt, /公开 URL、页面标题、导航入口、页面清单都是可用于确认产品框架的有效公开证据/)
  assert.match(capturedPrompt, /不要把报告标题、产品定位、公开页面清单整体标成“证据不足”/)
  assert.doesNotMatch(capturedPrompt, /evidenceQuality=partial 时可以整理已知线索，但标题、结论和流程都必须明确标注“证据不足\/待补采\/缺失项”/)
})

test('framework quality gate repairs an incomplete model report once', async () => {
  const prompts = []
  const completeReport = [
    '# 示例产品完整流程框架',
    '## 结构化节点树',
    '```text',
    '示例产品 / 产品框架',
    '1. 产品矩阵层',
    '- 示例产品 Web',
    '2. 顶层导航层',
    '- 首页',
    '3. 核心工作台层',
    '- 创建工具',
    '4. 核心能力层',
    '- 模板创建 / 在线编辑',
    '5. 场景层',
    '- 内容创建',
    '6. 模板与资产层',
    '- 模板库',
    '7. 协作与商业化层',
    '- 团队空间',
    '8. 核心任务链路',
    '- 发现入口 -> 进入模板 -> 编辑 -> 导出',
    '```',
    '## Markdown 报告版',
    '示例产品是一套面向内容创建的公开产品平台。',
    '## 零、产品定位与分析边界',
    '示例产品定位和本次公开证据分析边界。',
    '## 一、产品整体信息架构',
    '### 完整页面清单与页面层级关系',
    '| 页面 | URL | 目的 |\n|---|---|---|\n| 首页 | https://example.com | 产品入口 |',
    '## 二、用户角色与使用场景',
    '公开访客在官网了解产品并进入创建工具。',
    '## 三、完整用户旅程',
    '### 主路径',
    '首页 → 创建 → 预览 → 完成。',
    '### 分支路径',
    '选择模板 → 修改 → 返回预览。',
    '### 异常路径',
    '提交失败 → 提示原因 → 重试。',
    '## 四、关键决策点',
    '用户需要在模板创建和空白创建之间选择。',
    '## 五、状态与异常',
    '编辑中 → 生成中 → 已完成或失败。',
    '## 六、跨功能关联',
    '模板数据会传入编辑器并继续复用。',
    '## 七、可复用 UX 洞察',
    '连续保留编辑上下文可减少重复操作。',
    '## 八、证据与待补采',
    '证据来源为官网首页，登录后页面待补采。'
  ].join('\n\n')
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
        prompts.push(payload.userPrompt)
        return { content: prompts.length === 1 ? '# 完整框架\n\n## 核心页面\n\n仅列出首页。' : completeReport }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# Python framework result')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '示例产品',
        product_url: 'https://example.com',
        evidence_quality: 'full',
        evidence_count: 1,
        page_evidence: [{ title: '首页', url: 'https://example.com', content: '首页公开信息' }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-framework-quality-repair-regression',
    kind: 'framework',
    productName: '示例产品',
    productUrl: 'https://example.com'
  })

  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /质量门禁未通过/)
  assert.match(prompts[1], /缺失章节/)
  assert.match(prompts[1], /结构化节点树/)
  assert.match(prompts[1], /Markdown 报告版/)
  assert.match(prompts[1], /产品矩阵层/)
  assert.match(prompts[1], /核心任务链路/)
  assert.ok(prompts[1].length <= 100000)
  assert.match(response.markdown, /结构化节点树/)
  assert.match(response.markdown, /Markdown 报告版/)
  assert.match(response.markdown, /完整页面清单/)
  assert.match(response.markdown, /分支路径/)
  assert.match(response.markdown, /异常路径/)
})

test('framework quality gate rejects empty headings after one repair and keeps evidence report visible', async () => {
  let providerCalls = 0
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({ enabled: true, provider: 'codex-cli', defaultModel: 'gpt-5.5', timeoutMs: 0 }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async () => {
        providerCalls += 1
        return {
          content: '# 空报告\n\n## 产品定位\n\n## 信息架构\n\n## 完整页面清单\n\n## 用户角色\n\n## 用户旅程\n\n### 主路径\n\n### 分支路径\n\n### 异常路径\n\n## 决策点\n\n## 状态流转\n\n## 跨功能关联\n\n## 可复用 UX 洞察\n\n## 待补采'
        }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# Python 证据报告\n\n## 已采集页面\n\n- 首页：https://example.com')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '示例产品',
        product_url: 'https://example.com',
        evidence_quality: 'full',
        evidence_count: 1,
        page_evidence: [{ title: '首页', url: 'https://example.com', content: '公开首页' }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-framework-quality-failed-regression',
    kind: 'framework',
    productName: '示例产品',
    productUrl: 'https://example.com'
  })
  const listed = await service.listRecords({ projectId: 'competitor-analysis-framework-quality-failed-regression' })

  assert.equal(providerCalls, 2)
  assert.equal(response.ok, false)
  assert.equal(response.statusLabel, '质量未通过')
  assert.match(response.summary, /质量门禁未通过/)
  assert.match(response.markdown, /Python 证据报告/)
  assert.equal(response.failureType, 'quality_failed')
  assert.ok(response.qualityIssues.length > 0)
  assert.equal(listed.records[0].failureType, 'quality_failed')
  assert.deepEqual(listed.records[0].qualityIssues, response.qualityIssues)
})

test('framework quality gate treats a repair request exception as quality_failed', async () => {
  let providerCalls = 0
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({ enabled: true, provider: 'codex-cli', defaultModel: 'gpt-5.5', timeoutMs: 0 }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async () => {
        providerCalls += 1
        if (providerCalls === 2) throw new Error('repair timeout')
        return { content: '# 不完整框架\n\n## 核心页面\n\n只有首页。' }
      }
    }),
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'framework.md'), '# Python 证据报告\n\n- 首页：https://example.com')
      await writeFile(join(env.OUTPUT_DIR, 'framework.json'), JSON.stringify({
        product_name: '示例产品',
        product_url: 'https://example.com',
        evidence_quality: 'full',
        evidence_count: 1,
        page_evidence: [{ title: '首页', url: 'https://example.com', content: '公开首页' }],
        sitemap_navigation: [{ name: '创建工具', url: 'https://example.com/create', children: [] }]
      }))
      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const response = await service.run({
    projectId: 'competitor-analysis-framework-repair-exception-regression',
    kind: 'framework',
    productName: '示例产品',
    productUrl: 'https://example.com'
  })

  assert.equal(providerCalls, 2)
  assert.equal(response.ok, false)
  assert.equal(response.failureType, 'quality_failed')
  assert.match(response.summary, /二次修复调用失败|质量门禁未通过/)
})

test('python framework pipeline preserves broad page and sitemap evidence', () => {
  const result = spawnSync('python3', ['-c', `
import json
import config
from analyzer import analyze_product_framework, _build_page_evidence, _build_framework_material, _ensure_framework_modules_from_evidence, _rule_based_information_architecture, _analyze_user_journeys, _normalize_navigation_evidence
from models import ProductFramework, FeatureModule
from site_crawler import CrawlResult, PageData, infer_sitemap_navigation

pages = {
    f'https://example.com/page-{index}': {
        'title': f'页面 {index}',
        'content': f'页面 {index} 的公开功能说明',
        'features': [{'name': f'功能 {index}'}],
    }
    for index in range(95)
}
sitemap = [
    {'name': f'栏目 {index}', 'url': f'https://example.com/nav-{index}', 'children': []}
    for index in range(60)
]
features = [
    {'name': f'功能 {index}', 'url': f'https://example.com/tool-{index}', 'description': '公开工具入口'}
    for index in range(25)
]
evidence = _build_page_evidence(pages)
material = _build_framework_material(pages, [], [], sitemap)
huge_sitemap = [
    {
        'name': ('超长栏目' + str(index)) * 80,
        'url': f'https://example.com/huge-{index}',
        'children': [{'name': ('超长子页' + str(child)) * 40, 'url': f'https://example.com/huge-{index}-{child}'} for child in range(20)],
    }
    for index in range(200)
]
budget_material = _build_framework_material(pages, [], [], huge_sitemap)
framework = ProductFramework(product_name='示例产品', product_url='https://example.com')
framework.feature_modules.append(FeatureModule(module_id='M01', name='已有模块', level='L1', purpose='已有模块'))
_ensure_framework_modules_from_evidence(framework, [], sitemap, pages)
rule_framework = ProductFramework(product_name='规则产品', product_url='https://example.com')
_rule_based_information_architecture(rule_framework, [], features, sitemap, pages)
_analyze_user_journeys(rule_framework, material)
inferred_navigation = infer_sitemap_navigation(
    [f'https://example.com/tools/tool-{index}' for index in range(150)],
    'https://example.com',
)
normalized_navigation = _normalize_navigation_evidence(inferred_navigation)
coverage_framework = analyze_product_framework('覆盖测试', 'https://example.com', {
    'pages': {'https://example.com': {'title': '首页', 'content': '公开首页'}},
    'features': [{'name': '创建工具', 'url': 'https://example.com/create'}],
    'sitemap_navigation': inferred_navigation,
    'sitemap_urls_count': 150,
    'total_pages': 1,
})
crawl = CrawlResult('https://example.com')
for index in range(125):
    url = f'https://example.com/crawl-{index}'
    crawl.pages[url] = PageData(url=url, title=f'爬取页面 {index}')
crawl.sitemap_navigation = sitemap
crawl.sitemap_urls = [f'https://example.com/sitemap-{index}' for index in range(150)]
serialized = crawl.to_dict()
print(json.dumps({
    'max_pages': config.MAX_CRAWL_PAGES,
    'max_depth': config.MAX_CRAWL_DEPTH,
    'evidence_count': len(evidence),
    'has_late_page': '页面 94' in material,
    'has_late_sitemap': '栏目 59' in material,
    'has_merged_sitemap_module': any(item.name == '栏目 59' for item in framework.feature_modules),
    'material_length': len(material),
    'budget_material_length': len(budget_material),
    'budget_has_late_page': '页面 94' in budget_material,
    'rule_navigation_count': len(rule_framework.navigation_tree),
    'rule_journey_count': len(rule_framework.user_journeys),
    'inferred_navigation_nodes': sum(1 + len(item.get('children', [])) for item in inferred_navigation),
    'normalized_navigation_nodes': sum(1 + len(item.get('children', [])) for item in normalized_navigation),
    'coverage_quality': coverage_framework.evidence_quality,
    'coverage_gaps': coverage_framework.structured_data.get('data_gaps', []),
    'serialized_pages': len(serialized['pages']),
    'serialized_sitemap_navigation': len(serialized['sitemap_navigation']),
    'serialized_sitemap_urls': len(serialized['sitemap_urls']),
}))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(result.stdout)
  assert.ok(data.max_pages >= 120)
  assert.ok(data.max_depth >= 4)
  assert.equal(data.evidence_count, 95)
  assert.equal(data.has_late_page, true)
  assert.equal(data.has_late_sitemap, true)
  assert.equal(data.has_merged_sitemap_module, false)
  assert.ok(data.material_length <= 80000)
  assert.ok(data.budget_material_length <= 80000)
  assert.equal(data.budget_has_late_page, true)
  assert.equal(data.rule_navigation_count, 60)
  assert.equal(data.rule_journey_count, 20)
  assert.equal(data.inferred_navigation_nodes, 151)
  assert.equal(data.normalized_navigation_nodes, 151)
  assert.equal(data.coverage_quality, 'partial')
  assert.match(data.coverage_gaps.join('\n'), /Sitemap.*未抓取|站点地图.*待补采/)
  assert.equal(data.serialized_pages, 125)
  assert.equal(data.serialized_sitemap_navigation, 60)
  assert.equal(data.serialized_sitemap_urls, 150)
})

test('python framework report preserves confidence evidence and branch paths', () => {
  const result = spawnSync('python3', ['-c', `
import json
from models import ProductFramework, FeatureModule, UserJourney, UserJourneyStep
from reporter import _render_chapter1_information_architecture, _render_chapter2_user_journeys

framework = ProductFramework(product_name='示例产品', product_url='https://example.com')
module = FeatureModule(module_id='M01', name='视频生成', level='L1', purpose='生成视频')
module.structured_data = {'confidence': 'full', 'data_sources': ['官网导航']}
framework.feature_modules.append(module)
framework.page_evidence.append({'title': '创建页', 'url': 'https://example.com/create', 'content': '创建入口'})
journey = UserJourney(feature_name='视频生成', entry_point='/create', normal_flow=['S1', 'S2'], exception_flows=['生成失败 → 重试'])
journey.structured_data = {
    'journey_id': 'J01',
    'journey_confidence': 'partial',
    'branch_flows': ['选择模板 → 模板编辑 → 回到预览'],
}
step = UserJourneyStep(step_id='S1', description='进入创建页')
step.structured_data = {'confidence': 'full', 'evidence': '官网创建入口'}
journey.steps.append(step)
framework.user_journeys.append(journey)
markdown = []
_render_chapter1_information_architecture(markdown, framework)
_render_chapter2_user_journeys(markdown, framework)
serialized = framework.to_dict()
print(json.dumps({
    'module_structured': serialized['feature_modules'][0].get('structured_data'),
    'journey_structured': serialized['user_journeys'][0].get('structured_data'),
    'step_structured': serialized['user_journeys'][0]['steps'][0].get('structured_data'),
    'markdown': '\\n'.join(markdown),
}))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(result.stdout)
  assert.equal(data.module_structured.confidence, 'full')
  assert.equal(data.journey_structured.journey_confidence, 'partial')
  assert.equal(data.step_structured.evidence, '官网创建入口')
  assert.match(data.markdown, /分支路径/)
  assert.match(data.markdown, /选择模板 → 模板编辑 → 回到预览/)
  assert.match(data.markdown, /完整页面清单/)
  assert.match(data.markdown, /https:\/\/example\.com\/create/)
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

test('gap analysis rejects stale source reports even if source content is present', async () => {
  const projectId = 'competitor-analysis-stale-source-gap-regression'
  const sourceRecordTime = '2026-07-15T08:00:00.000Z'
  await mkdir('backend/storage/competitor-analysis', { recursive: true })
  await writeFile(join('backend/storage/competitor-analysis', `${projectId}.records.json`), JSON.stringify({
    records: [{
      id: 'legacy-source-framework-record',
      projectId,
      kind: 'framework',
      title: '完整框架：旧版来源',
      status: 'succeeded',
      statusLabel: '已生成',
      competitorNames: ['旧版竞品'],
      productName: '旧版竞品',
      productUrl: 'https://legacy.example.com',
      summary: '旧版来源报告',
      markdown: '# 旧版完整框架来源',
      createdAt: sourceRecordTime,
      updatedAt: sourceRecordTime
    }]
  }, null, 2))

  let providerCalls = 0
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({ enabled: true, provider: 'codex-cli', defaultModel: 'gpt-5.5', timeoutMs: 0 }),
    resolveAgentProvider: async () => ({
      name: 'codex-cli',
      generate: async () => {
        providerCalls += 1
        return { content: '# 不应该触发机会点分析' }
      }
    }),
    pythonRunner: async () => ({ code: 0, stdout: '', stderr: '' })
  })

  const created = await service.createRecord({
    projectId,
    kind: 'gap',
    sourceRecordId: 'legacy-source-framework-record',
    sourceKind: 'framework',
    sourceTitle: '完整框架：旧版来源',
    sourceContent: '# 旧版完整框架来源'
  })
  const response = await service.run({
    projectId,
    recordId: created.record.id,
    kind: 'gap',
    sourceRecordId: 'legacy-source-framework-record',
    sourceKind: 'framework',
    sourceTitle: '完整框架：旧版来源',
    sourceContent: '# 旧版完整框架来源'
  })
  const listed = await service.listRecords({ projectId })

  assert.equal(providerCalls, 0)
  assert.equal(response.ok, false)
  assert.match(response.summary, /已升级|重新分析/)
  assert.equal(listed.records.find((record) => record.id === created.record.id)?.status, 'failed')
})

test('gap analysis retrieves current project knowledge before deciding feature parity and chain comparison', async () => {
  let providerPayload = null
  let knowledgeProviderPayload = null
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    projectKnowledgeProvider: async (payload = {}) => {
      knowledgeProviderPayload = payload
      return [
        {
          title: '蝉镜：三产品全景信息',
          snippet: '蝉镜当前支持数字人视频生成、项目管理和素材库，但未覆盖一键爆款复刻链路。',
          sourceType: 'knowledge',
          score: 3,
          materialId: 'knowledge-our-product-1'
        }
      ]
    },
    resolveAgentProvider: async () => ({
      generate: async (payload = {}) => {
        providerPayload = payload
        return {
          content: '# 机会点分析结果\n\n## 双方功能存在性校验表\n\n| 功能 | 我方 | 竞品 | 是否比较链路 |\n|---|---|---|---|\n| 爆款复刻 | 当前项目知识库未覆盖该功能 | 已确认 | 不可直接比较 |'
        }
      }
    })
  })

  const response = await service.run({
    projectId: 'competitor-analysis-gap-project-knowledge-regression',
    kind: 'gap',
    feature: '爆款复刻',
    competitorNames: ['HeyGen'],
    sourceContent: '# 完整框架结果\n\nHeyGen 提供模板化视频生成与导出链路。',
    sourceRecordId: 'framework-record-project-knowledge',
    sourceKind: 'framework',
    sourceTitle: '完整框架结果'
  })

  assert.equal(response.ok, true)
  assert.equal(knowledgeProviderPayload.projectId, 'competitor-analysis-gap-project-knowledge-regression')
  assert.equal(knowledgeProviderPayload.type, 'knowledge')
  assert.match(knowledgeProviderPayload.query, /爆款复刻|HeyGen|完整框架结果/)
  assert.match(providerPayload.userPrompt, /当前项目知识库基线/)
  assert.match(providerPayload.userPrompt, /蝉镜当前支持数字人视频生成/)
  assert.match(providerPayload.userPrompt, /双方功能存在性校验/)
  assert.match(providerPayload.userPrompt, /先判断我方产品\/竞品是否存在该功能/)
  assert.match(providerPayload.userPrompt, /不能比较链路时标注不可比较/)
  assert.deepEqual(providerPayload.retrievedKnowledge, [
    {
      title: '蝉镜：三产品全景信息',
      snippet: '蝉镜当前支持数字人视频生成、项目管理和素材库，但未覆盖一键爆款复刻链路。',
      sourceType: 'knowledge',
      score: 3,
      materialId: 'knowledge-our-product-1'
    }
  ])
  assert.match(response.markdown, /双方功能存在性校验表/)
})

test('gap analysis keeps source metadata when running an existing created record', async () => {
  const service = createCompetitorAnalysisEngineService({
    modelSettingsProvider: async () => ({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      timeoutMs: 0
    }),
    resolveAgentProvider: async () => ({
      generate: async () => ({
        content: '# 机会点分析结果\n\n## 机会点卡片\n\n- OP01：围绕源报告补齐差距。'
      })
    })
  })
  const projectId = 'competitor-analysis-gap-existing-record-regression'
  const created = await service.createRecord({
    id: 'gap-record-1',
    projectId,
    kind: 'gap',
    competitorNames: ['HeyGen'],
    sourceRecordId: 'framework-record-2',
    sourceKind: 'framework',
    sourceTitle: '完整框架报告'
  })

  const response = await service.run({
    projectId,
    recordId: created.record.id,
    kind: 'gap',
    competitorNames: ['HeyGen'],
    sourceContent: '# 完整框架报告\n\n竞品已经覆盖模板化视频生成。',
    sourceRecordId: 'framework-record-2',
    sourceKind: 'framework',
    sourceTitle: '完整框架报告'
  })
  const listed = await service.listRecords({ projectId })

  assert.equal(response.ok, true)
  assert.equal(listed.records[0].id, 'gap-record-1')
  assert.equal(listed.records[0].sourceRecordId, 'framework-record-2')
  assert.equal(listed.records[0].sourceKind, 'framework')
  assert.equal(listed.records[0].sourceTitle, '完整框架报告')
  assert.match(listed.records[0].markdown, /OP01/)
})

test('flow analysis passes selected feature map item and screenshot references to backend model', async () => {
  let capturedPrompt = ''
  let capturedReferences = []
  const service = createCompetitorAnalysisEngineService({
    pythonRunner: async (args, env) => {
      await writeFile(join(env.OUTPUT_DIR, 'flow.md'), '# Python fallback flow')
      await writeFile(join(env.OUTPUT_DIR, 'flow.json'), JSON.stringify({
        competitor: '稿定设计',
        feature: '截图中的功能入口',
        evidence_status: 'similar',
        evidence_quality: 'partial',
        evidence_count: 1,
        evidence_mode: 'screenshot_reference',
        evidence_confidence: 'medium',
        analysis_allowed: true,
        sources: [{ title: '用户上传截图', url: 'reference://screenshot/homepage' }],
        similar_features: [{ name: 'AI 创作入口', description: '来自截图参考' }]
      }))
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
        capturedReferences = payload.references || []
        return {
          content: '# 交互流程分析结果\n\n## 证据校验\n\n- 基于截图参考和公开证据，仍需标注待补采。'
        }
      }
    })
  })

  const response = await service.run({
    projectId: 'competitor-analysis-flow-feature-map-reference-regression',
    kind: 'flow',
    competitorNames: ['稿定设计'],
    competitorName: '稿定设计',
    productName: '稿定设计',
    productUrl: 'https://www.gaoding.com',
    feature: '截图中的功能入口',
    selectedFeature: {
      id: 'screenshot-reference-entry',
      name: '截图中的功能入口',
      source: 'screenshot-reference',
      confidence: 'reference'
    },
    referenceScreenshots: [{
      id: 'screenshot-homepage',
      name: 'homepage.png',
      mimeType: 'image/png',
      imageDataUrl: 'data:image/png;base64,aG9tZXBhZ2U='
    }]
  })

  assert.equal(response.ok, true)
  assert.match(capturedPrompt, /已选择功能：截图中的功能入口/)
  assert.match(capturedPrompt, /截图参考只用于理解目标入口/)
  assert.match(capturedPrompt, /结论仍需按公开证据分级/)
  assert.equal(capturedReferences.length, 1)
  assert.equal(capturedReferences[0].imageDataUrl, 'data:image/png;base64,aG9tZXBhZ2U=')
  assert.equal(capturedReferences[0].name, 'homepage.png')
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

test('python flow evidence normalizes generation aliases into stable feature intents', () => {
  const result = spawnSync('python3', ['-c', `
import json
from analyzer import _normalize_feature_intent

aliases = {
    '生视频': _normalize_feature_intent('生视频'),
    'AI 生成视频': _normalize_feature_intent('AI 生成视频'),
    '文生视频': _normalize_feature_intent('文生视频'),
    '图生视频': _normalize_feature_intent('图生视频'),
    '图片转视频': _normalize_feature_intent('图片转视频'),
    '生图': _normalize_feature_intent('生图'),
    '文生图': _normalize_feature_intent('文生图'),
}
print(json.dumps(aliases, ensure_ascii=False))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  const aliases = JSON.parse(result.stdout)
  assert.equal(aliases['生视频'], 'video_generation')
  assert.equal(aliases['AI 生成视频'], 'video_generation')
  assert.equal(aliases['文生视频'], 'text_to_video')
  assert.equal(aliases['图生视频'], 'image_to_video')
  assert.equal(aliases['图片转视频'], 'image_to_video')
  assert.equal(aliases['生图'], 'image_generation')
  assert.equal(aliases['文生图'], 'text_to_image')
})

test('python flow evidence treats cross-page image generation and video workflow as analyzable composite evidence', () => {
  const result = spawnSync('python3', ['-c', `
import json
from analyzer import _judge_flow_feature_evidence, extract_interaction_flow
from models import SearchEntry

entries = [
    SearchEntry(
        title='AI 一键生成图片',
        url='https://example.com/ai-image',
        snippet='输入文案即可智能生成商品图片。'
    ),
    SearchEntry(
        title='在线视频剪辑与视频模板',
        url='https://example.com/video-editor',
        snippet='选择视频模板，在线剪辑后导出视频。'
    )
]
evidence = _judge_flow_feature_evidence('示例产品', 'AI 生视频', entries)
flow = extract_interaction_flow('示例产品', 'AI 生视频', entries)
print(json.dumps({
    'status': evidence['status'],
    'normalized_feature': evidence['normalized_feature'],
    'evidence_mode': evidence['evidence_mode'],
    'confidence': evidence['confidence'],
    'analysis_allowed': evidence['analysis_allowed'],
    'reason': evidence['reason'],
    'source_count': flow.evidence_count,
    'step_count': len(flow.steps),
    'flow_structured': flow.structured_data,
}, ensure_ascii=False))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(result.stdout)
  assert.equal(data.status, 'similar')
  assert.equal(data.normalized_feature, 'video_generation')
  assert.equal(data.evidence_mode, 'composite')
  assert.equal(data.confidence, 'high')
  assert.equal(data.analysis_allowed, true)
  assert.match(data.reason, /组合证据/)
  assert.ok(data.source_count >= 2)
  assert.ok(data.step_count >= 2)
  assert.equal(data.flow_structured.analysis_allowed, true)
  assert.equal(data.flow_structured.evidence_mode, 'composite')
})

test('python flow evidence does not upgrade a lone video template page to exact video generation', () => {
  const result = spawnSync('python3', ['-c', `
import json
from analyzer import _judge_flow_feature_evidence
from models import SearchEntry

evidence = _judge_flow_feature_evidence('示例产品', '生成视频', [
    SearchEntry(
        title='视频模板素材库',
        url='https://example.com/templates',
        snippet='提供丰富的视频模板素材下载。'
    )
])
print(json.dumps(evidence, ensure_ascii=False, default=str))
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(result.stdout)
  assert.equal(data.status, 'similar')
  assert.notEqual(data.evidence_mode, 'direct')
  assert.equal(data.analysis_allowed, false)
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

test('python weekly monitor saves search diagnostics when candidates have no usable dates', () => {
  const result = spawnSync('python3', ['-c', `
import json
import tempfile
import config
import main
from models import SearchEntry

config.OUTPUT_DIR = tempfile.mkdtemp()
config.WEEKLY_REPORT_DIR = config.OUTPUT_DIR
config.LOG_DIR = config.OUTPUT_DIR
config.LLM_API_KEY = ''

class Competitor:
    name = '稿定设计'
    keywords = ['稿定设计 AI']

def fake_search(name, keywords, days=7):
    return [
        SearchEntry(title='稿定设计 AI 功能介绍', url='https://example.com/ai', snippet='AI 创作能力介绍'),
        SearchEntry(title='稿定设计 更新说明', url='https://example.com/update', snippet='更新内容但无日期')
    ]

def fake_enrich(entries, max_pages=10):
    return entries

main.scraper.search_competitor = fake_search
main.scraper.enrich_entries_with_content = fake_enrich
report = main.run_weekly_monitor([Competitor()])
diagnostics = report.structured_data.get('search_diagnostics', [])
print(len(report.changes))
print(diagnostics[0]['competitor'])
print(diagnostics[0]['total_candidates'])
print(diagnostics[0]['dated_candidates'])
print(diagnostics[0]['sample_entries'][0]['title'])
`], {
    cwd: pythonAppDir,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /\n0\n稿定设计\n2\n0\n稿定设计 AI 功能介绍\n?$/)
  assert.match(result.stdout, /稿定设计/)
  assert.match(result.stdout, /2/)
  assert.match(result.stdout, /0/)
  assert.match(result.stdout, /稿定设计 AI 功能介绍/)
})
