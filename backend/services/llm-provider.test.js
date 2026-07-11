import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAgentProviderFromEnv,
  createAgentProviderFromModelSettings,
  createCodexCliAgentProvider,
  createImageProviderFromModelSettings,
  createOpenAICompatibleImageProvider,
  createOpenAICompatibleAgentProvider,
  normalizeAgentModelText,
  normalizeModelProviderError
} from './llm-provider.js'

test('openai compatible responses request forwards max output token limit', async () => {
  let capturedBody = null
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'http://model.local/v1',
    defaultModel: 'gpt-test',
    apiSurface: 'responses',
    fetchImpl: async (_url, init = {}) => {
      capturedBody = JSON.parse(init.body)
      return new Response(JSON.stringify({ output_text: '{"ok":true}', usage: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  await provider.generate({
    systemPrompt: 'json only',
    userPrompt: 'hello',
    maxOutputTokens: 1200
  })

  assert.equal(capturedBody.max_output_tokens, 1200)
})

test('openai compatible chat request forwards max token limit', async () => {
  let capturedBody = null
  const provider = createOpenAICompatibleAgentProvider({
    apiKey: 'test-key',
    baseUrl: 'http://model.local/v1',
    defaultModel: 'gpt-test',
    apiSurface: 'chat.completions',
    fetchImpl: async (_url, init = {}) => {
      capturedBody = JSON.parse(init.body)
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: {}
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  await provider.generate({
    systemPrompt: 'json only',
    userPrompt: 'hello',
    maxOutputTokens: 1200
  })

  assert.equal(capturedBody.max_tokens, 1200)
})

test('openai compatible image provider calls images generation endpoint and returns data url', async () => {
  let capturedUrl = ''
  let capturedBody = null
  const provider = createOpenAICompatibleImageProvider({
    apiKey: 'test-key',
    baseUrl: 'http://model.local/v1',
    defaultModel: 'gpt-image-2',
    fetchImpl: async (url, init = {}) => {
      capturedUrl = url
      capturedBody = JSON.parse(init.body)
      return new Response(JSON.stringify({
        data: [{ b64_json: 'ZmFrZS1wbmc=', revised_prompt: 'refined tea app prompt' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  const result = await provider.generate({
    prompt: '为茶饮首页生成高保真图',
    targetGenerator: 'gpt-image-2'
  })

  assert.equal(capturedUrl, 'http://model.local/v1/images/generations')
  assert.equal(capturedBody.model, 'gpt-image-2')
  assert.equal(capturedBody.prompt, '为茶饮首页生成高保真图')
  assert.equal(capturedBody.response_format, 'b64_json')
  assert.equal(result.imageDataUrl, 'data:image/png;base64,ZmFrZS1wbmc=')
  assert.equal(result.revisedPrompt, 'refined tea app prompt')
  assert.equal(result.provider, 'openai-compatible-image')
  assert.equal(result.model, 'gpt-image-2')
})

test('openai compatible image provider maps workflow target image size into generation size', async () => {
  const capturedBodies = []
  const provider = createOpenAICompatibleImageProvider({
    apiKey: 'test-key',
    baseUrl: 'http://model.local/v1',
    defaultModel: 'gpt-image-2',
    fetchImpl: async (url, init = {}) => {
      capturedBodies.push(JSON.parse(init.body))
      return new Response(JSON.stringify({
        data: [{ b64_json: 'ZmFrZS1wbmc=' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  await provider.generate({
    prompt: '生成 App 高保真图',
    targetGenerator: 'gpt-image-2',
    aspectRatio: '375:812',
    targetImageSize: { width: 375 }
  })

  await provider.generate({
    prompt: '生成 Web 高保真图',
    targetGenerator: 'gpt-image-2',
    aspectRatio: '1920:1080',
    targetImageSize: { width: 1920 }
  })

  assert.equal(capturedBodies[0].size, '752x1632')
  assert.equal(capturedBodies[1].size, '1920x1088')
})

test('openai compatible image provider sends reference images through edits endpoint', async () => {
  let capturedUrl = ''
  let capturedBody = null
  const provider = createOpenAICompatibleImageProvider({
    apiKey: 'test-key',
    baseUrl: 'http://model.local/v1',
    defaultModel: 'gpt-image-2',
    fetchImpl: async (url, init = {}) => {
      capturedUrl = url
      capturedBody = init.body
      return new Response(JSON.stringify({
        data: [{ b64_json: 'cmVmZXJlbmNlLWltYWdl' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  const result = await provider.generate({
    prompt: '沿用知识库截图生成首页 UI',
    targetGenerator: 'gpt-image-2',
    referenceImages: [
      {
        title: '知识库首页截图',
        imageDataUrl: 'data:image/png;base64,a25vd2xlZGdlLXJlZmVyZW5jZQ=='
      }
    ]
  })

  assert.equal(capturedUrl, 'http://model.local/v1/images/edits')
  assert.ok(capturedBody instanceof FormData)
  const entries = Array.from(capturedBody.entries())
  assert.equal(entries.find(([key]) => key === 'model')?.[1], 'gpt-image-2')
  assert.equal(entries.find(([key]) => key === 'prompt')?.[1], '沿用知识库截图生成首页 UI')
  assert.ok(entries.some(([key, value]) => key === 'image[]' && value?.name === 'reference-1.png'))
  assert.equal(result.imageDataUrl, 'data:image/png;base64,cmVmZXJlbmNlLWltYWdl')
})

test('openai compatible image provider reports empty 404 responses as api surface mismatch', async () => {
  const provider = createOpenAICompatibleImageProvider({
    apiKey: 'test-key',
    baseUrl: 'http://model.local/v1',
    defaultModel: 'gpt-image-2',
    fetchImpl: async () => new Response('', { status: 404 })
  })

  await assert.rejects(
    () => provider.generate({
      prompt: '为茶饮首页生成高保真图',
      targetGenerator: 'gpt-image-2'
    }),
    (error) => {
      assert.equal(error.code, 'LLM_API_SURFACE_MISMATCH')
      assert.equal(error.status, 404)
      assert.match(error.message, /接口不匹配/)
      return true
    }
  )
})

test('model settings factory creates image provider from current Codex proxy config', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'codex-image-provider-'))
  const codexConfigPath = join(tempDir, 'config.toml')
  const codexAuthPath = join(tempDir, 'auth.json')
  await writeFile(codexConfigPath, [
    'model_provider = "newapi"',
    '',
    '[model_providers.newapi]',
    'name = "NewAPI"',
    'base_url = "http://127.0.0.1:15721/v1"',
    'wire_api = "responses"',
    'requires_openai_auth = true',
    ''
  ].join('\n'))
  await writeFile(codexAuthPath, JSON.stringify({ OPENAI_API_KEY: 'PROXY_MANAGED' }))

  let capturedUrl = ''
  let capturedAuthorization = ''
  let capturedBody = null
  try {
    const provider = createImageProviderFromModelSettings({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      imageModel: 'gpt-image-2',
      codexConfigPath,
      codexAuthPath,
      ccSwitchDbPath: join(tempDir, 'missing-cc-switch.db')
    }, async (url, init = {}) => {
      capturedUrl = url
      capturedAuthorization = init.headers?.Authorization || ''
      capturedBody = JSON.parse(init.body)
      return new Response(JSON.stringify({
        data: [{ b64_json: 'Y29kZXgtaW1hZ2Uy' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    assert.ok(provider)
    const result = await provider.generate({
      prompt: '生成移动端高保真图',
      targetGenerator: 'gpt-image-2'
    })

    assert.equal(capturedUrl, 'http://127.0.0.1:15721/v1/images/generations')
    assert.equal(capturedAuthorization, 'Bearer PROXY_MANAGED')
    assert.equal(capturedBody.model, 'gpt-image-2')
    assert.equal(result.imageDataUrl, 'data:image/png;base64,Y29kZXgtaW1hZ2Uy')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('model settings factory uses current CC Switch Codex upstream for image generation', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'codex-ccswitch-image-provider-'))
  const codexConfigPath = join(tempDir, 'config.toml')
  const codexAuthPath = join(tempDir, 'auth.json')
  await writeFile(codexConfigPath, [
    'model_provider = "newapi"',
    '',
    '[model_providers.newapi]',
    'name = "NewAPI"',
    'base_url = "http://127.0.0.1:15721/v1"',
    'wire_api = "responses"',
    'requires_openai_auth = true',
    ''
  ].join('\n'))
  await writeFile(codexAuthPath, JSON.stringify({ OPENAI_API_KEY: 'PROXY_MANAGED' }))

  let capturedUrl = ''
  let capturedAuthorization = ''
  try {
    const provider = createImageProviderFromModelSettings({
      enabled: true,
      provider: 'codex-cli',
      defaultModel: 'gpt-5.5',
      imageModel: 'gpt-image-2',
      codexConfigPath,
      codexAuthPath,
      ccSwitchCodexSettings: {
        auth: { OPENAI_API_KEY: 'UPSTREAM_MANAGED' },
        config: [
          'model_provider = "newapi"',
          '',
          '[model_providers.newapi]',
          'name = "NewAPI"',
          'base_url = "https://model-upstream.local/v1"',
          'wire_api = "responses"',
          'requires_openai_auth = true',
          ''
        ].join('\n')
      }
    }, async (url, init = {}) => {
      capturedUrl = url
      capturedAuthorization = init.headers?.Authorization || ''
      return new Response(JSON.stringify({
        data: [{ b64_json: 'Y2Nzd2l0Y2gtdXBzdHJlYW0=' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    assert.ok(provider)
    const result = await provider.generate({
      prompt: '生成移动端高保真图',
      targetGenerator: 'gpt-image-2'
    })

    assert.equal(capturedUrl, 'https://model-upstream.local/v1/images/generations')
    assert.equal(capturedAuthorization, 'Bearer UPSTREAM_MANAGED')
    assert.equal(result.imageDataUrl, 'data:image/png;base64,Y2Nzd2l0Y2gtdXBzdHJlYW0=')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('model settings factory uses current CC Switch Codex upstream for agent generation', async () => {
  let capturedUrl = ''
  let capturedAuthorization = ''
  let capturedBody = null
  const provider = createAgentProviderFromModelSettings({
    enabled: true,
    provider: 'codex-proxy',
    defaultModel: 'gpt-5.5',
    ccSwitchCodexSettings: {
      auth: { OPENAI_API_KEY: 'UPSTREAM_MANAGED' },
      config: [
        'model = "gpt-5.5"',
        'model_provider = "newapi"',
        '',
        '[model_providers.newapi]',
        'name = "NewAPI"',
        'base_url = "https://model-upstream.local/v1"',
        'wire_api = "responses"',
        'requires_openai_auth = true',
        ''
      ].join('\n')
    }
  }, async (url, init = {}) => {
    capturedUrl = url
    capturedAuthorization = init.headers?.Authorization || ''
    capturedBody = JSON.parse(init.body)
    return new Response(JSON.stringify({
      output_text: '{"ok":true,"message":"pong"}',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })

  assert.equal(provider.name, 'openai-compatible')
  const result = await provider.generate({
    systemPrompt: '只输出 JSON',
    userPrompt: 'ping'
  })

  assert.equal(capturedUrl, 'https://model-upstream.local/v1/responses')
  assert.equal(capturedAuthorization, 'Bearer UPSTREAM_MANAGED')
  assert.equal(capturedBody.model, 'gpt-5.5')
  assert.equal(result.content, '{"ok":true,"message":"pong"}')
  assert.equal(result.provider, 'openai-compatible')
})

test('env provider auto prefers explicit OpenAI-compatible key before Codex proxy', () => {
  const provider = createAgentProviderFromEnv({
    WORKFLOW_AGENT_PROVIDER: 'auto',
    OPENAI_API_KEY: 'env-key',
    OPENAI_BASE_URL: 'https://env-model.local/v1',
    OPENAI_DEFAULT_MODEL: 'gpt-env',
    OPENAI_API_SURFACE: 'responses'
  }, async () => new Response('{}', { status: 200 }))

  assert.equal(provider.name, 'openai-compatible')
})

test('env provider can use Codex proxy when OPENAI_API_KEY is not directly configured', async () => {
  let capturedUrl = ''
  let capturedAuthorization = ''
  const provider = createAgentProviderFromEnv({
    WORKFLOW_AGENT_PROVIDER: 'codex-proxy',
    OPENAI_DEFAULT_MODEL: 'gpt-5.5',
    CODEX_CONFIG_TEXT: [
      'model_provider = "newapi"',
      '',
      '[model_providers.newapi]',
      'base_url = "https://codex-linked.local/v1"',
      'wire_api = "responses"',
      'requires_openai_auth = true',
      ''
    ].join('\n'),
    CODEX_AUTH_JSON: JSON.stringify({ OPENAI_API_KEY: 'CODEX_LINKED_KEY' })
  }, async (url, init = {}) => {
    capturedUrl = url
    capturedAuthorization = init.headers?.Authorization || ''
    return new Response(JSON.stringify({ output_text: '{"ok":true}', usage: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })

  assert.equal(provider.name, 'openai-compatible')
  const result = await provider.generate({
    systemPrompt: '只输出 JSON',
    userPrompt: 'ping'
  })

  assert.equal(capturedUrl, 'https://codex-linked.local/v1/responses')
  assert.equal(capturedAuthorization, 'Bearer CODEX_LINKED_KEY')
  assert.equal(result.content, '{"ok":true}')
})

test('model provider classifies codex-client-only model errors explicitly', () => {
  const error = normalizeModelProviderError(new Error('请使用 Codex 客户端'), {
    provider: 'openai-compatible',
    model: 'gpt-5.5',
    apiSurface: 'chat.completions',
    status: 403,
    response: { error: { message: '请使用 Codex 客户端' } }
  })

  assert.equal(error.code, 'LLM_CODEX_CLIENT_REQUIRED')
  assert.match(error.message, /Codex 客户端/)
  assert.deepEqual(error.recoveryActions, ['切换为后端可调用模型', '改用 Codex 客户端代理通道'])
})

test('codex cli provider runs codex exec and parses final agent message', async () => {
  let capturedCommand = ''
  let capturedArgs = []
  let capturedStdin = ''
  const provider = createCodexCliAgentProvider({
    codexBin: 'codex-test',
    cwd: '/tmp/workflow-project',
    spawnImpl: (command, args) => {
      capturedCommand = command
      capturedArgs = args
      return {
        stdin: {
          write(chunk) {
            capturedStdin += chunk
          },
          end() {}
        },
        stdout: {
          setEncoding() {},
          on(event, handler) {
            if (event === 'data') {
              handler(`${JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' })}\n`)
              handler(`${JSON.stringify({
                type: 'item.completed',
                item: {
                  type: 'agent_message',
                  text: JSON.stringify({
                    content: '模型分析完成',
                    proposal: { nodes: [{ id: 'node-1', title: '节点' }] }
                  })
                }
              })}\n`)
              handler(`${JSON.stringify({
                type: 'turn.completed',
                usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
              })}\n`)
            }
          }
        },
        stderr: {
          setEncoding() {},
          on() {}
        },
        on(event, handler) {
          if (event === 'close') handler(0)
        },
        kill() {}
      }
    }
  })

  const result = await provider.generate({
    systemPrompt: '只输出 JSON',
    userPrompt: '生成画布',
    model: 'gpt-5.5'
  })

  assert.equal(capturedCommand, 'codex-test')
  assert.deepEqual(capturedArgs.slice(0, 4), ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox'])
  assert.ok(capturedArgs.includes('--json'))
  assert.ok(capturedArgs.includes('--output-schema') === false)
  assert.match(capturedStdin, /只输出 JSON/)
  assert.match(capturedStdin, /生成画布/)
  assert.equal(result.content, '模型分析完成')
  assert.deepEqual(result.proposal, { nodes: [{ id: 'node-1', title: '节点' }] })
  assert.equal(result.provider, 'codex-cli')
  assert.equal(result.model, 'gpt-5.5')
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 })
})

test('codex cli provider prompt forbids tools and skill loading for product generation', async () => {
  let capturedStdin = ''
  const provider = createCodexCliAgentProvider({
    codexBin: 'codex-test',
    cwd: '/tmp/workflow-project',
    spawnImpl: () => ({
      stdin: {
        write(chunk) {
          capturedStdin += chunk
        },
        end() {}
      },
      stdout: {
        setEncoding() {},
        on(event, handler) {
          if (event === 'data') {
            handler(`${JSON.stringify({
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: '{"ok":true}'
              }
            })}\n`)
          }
        }
      },
      stderr: {
        setEncoding() {},
        on() {}
      },
      on(event, handler) {
        if (event === 'close') handler(0)
      },
      kill() {}
    })
  })

  await provider.generate({
    systemPrompt: '只输出 JSON',
    userPrompt: '生成画布'
  })

  assert.match(capturedStdin, /不要读取文件/)
  assert.match(capturedStdin, /不要调用工具/)
  assert.match(capturedStdin, /不要加载或执行 skills/)
  assert.match(capturedStdin, /只把 System 和 User 当作普通模型上下文/)
})

test('agent text normalization preserves plain json responses', () => {
  const json = '{"ok":true,"message":"pong","capability":"workflow-analysis"}'
  const normalized = normalizeAgentModelText(json)

  assert.equal(normalized.content, json)
  assert.equal(normalized.proposal, null)
})

test('codex cli provider repeats json-only contract after user prompt', async () => {
  let capturedStdin = ''
  const provider = createCodexCliAgentProvider({
    codexBin: 'codex-test',
    cwd: '/tmp/workflow-project',
    spawnImpl: () => ({
      stdin: {
        write(chunk) {
          capturedStdin += chunk
        },
        end() {}
      },
      stdout: {
        setEncoding() {},
        on(event, handler) {
          if (event === 'data') {
            handler(`${JSON.stringify({
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: '{"ok":true}'
              }
            })}\n`)
          }
        }
      },
      stderr: {
        setEncoding() {},
        on() {}
      },
      on(event, handler) {
        if (event === 'close') handler(0)
      },
      kill() {}
    })
  })

  await provider.generate({
    systemPrompt: '返回 {"ok":true,"message":"pong"}。',
    userPrompt: 'ping'
  })

  const userIndex = capturedStdin.indexOf('【User】')
  const finalJsonContractIndex = capturedStdin.lastIndexOf('最终只输出可被 JSON.parse 解析的 JSON')
  assert.ok(userIndex >= 0)
  assert.ok(finalJsonContractIndex > userIndex)
})

test('codex cli provider uses markdown prompt contract for assistant replies', async () => {
  let capturedStdin = ''
  const provider = createCodexCliAgentProvider({
    codexBin: 'codex-test',
    cwd: '/tmp/workflow-project',
    spawnImpl: () => ({
      stdin: {
        write(chunk) {
          capturedStdin += chunk
        },
        end() {}
      },
      stdout: {
        setEncoding() {},
        on(event, handler) {
          if (event === 'data') {
            handler(`${JSON.stringify({
              type: 'item.completed',
              item: {
                type: 'agent_message',
                text: '# 茶饮小程序产品方案'
              }
            })}\n`)
          }
        }
      },
      stderr: {
        setEncoding() {},
        on() {}
      },
      on(event, handler) {
        if (event === 'close') handler(0)
      },
      kill() {}
    })
  })

  await provider.generate({
    systemPrompt: '用中文 Markdown 直接回复用户，必须包含大标题和小标题。不要输出 JSON。',
    userPrompt: '做一个茶饮小程序。',
    responseFormat: 'markdown'
  })

  assert.match(capturedStdin, /只输出中文 Markdown 正文/)
  assert.match(capturedStdin, /不要输出 JSON/)
  assert.doesNotMatch(capturedStdin, /最终只输出可被 JSON\.parse 解析的 JSON/)
})

test('codex cli provider does not expose startup warnings as interrupted generation content', async () => {
  const provider = createCodexCliAgentProvider({
    codexBin: 'codex-test',
    cwd: '/tmp/workflow-project',
    spawnImpl: () => ({
      stdin: {
        write() {},
        end() {}
      },
      stdout: {
        setEncoding() {},
        on() {}
      },
      stderr: {
        setEncoding() {},
        on(event, handler) {
          if (event === 'data') {
            handler('2026-07-11T07:00:48Z  WARN codex_core_plugins::remote: remote plugin catalog 401 Unauthorized\n')
          }
        }
      },
      on(event, handler) {
        if (event === 'close') handler(null, 'SIGTERM')
      },
      kill() {}
    })
  })

  await assert.rejects(
    () => provider.generate({
      systemPrompt: '只输出 Markdown',
      userPrompt: '生成高级 UX 文档'
    }),
    (error) => {
      assert.match(error.message, /Codex CLI 调用被中断：SIGTERM/)
      assert.doesNotMatch(error.message, /plugin catalog|Unauthorized|WARN/)
      return true
    }
  )
})

test('codex cli provider forwards image data url as codex exec image attachment', async () => {
  let capturedArgs = []
  let capturedStdin = ''
  let capturedImagePath = ''
  let capturedImageBytes = []
  const provider = createCodexCliAgentProvider({
    codexBin: 'codex-test',
    cwd: '/tmp/workflow-project',
    spawnImpl: (_command, args) => {
      capturedArgs = args
      const imageFlagIndex = capturedArgs.indexOf('--image')
      capturedImagePath = capturedArgs[imageFlagIndex + 1] || ''
      capturedImageBytes = capturedImagePath ? [...readFileSync(capturedImagePath)] : []
      return {
        stdin: {
          write(chunk) {
            capturedStdin += chunk
          },
          end() {}
        },
        stdout: {
          setEncoding() {},
          on(event, handler) {
            if (event === 'data') {
              handler(`${JSON.stringify({
                type: 'item.completed',
                item: {
                  type: 'agent_message',
                  text: '{"ok":true}'
                }
              })}\n`)
            }
          }
        },
        stderr: {
          setEncoding() {},
          on() {}
        },
        on(event, handler) {
          if (event === 'close') handler(0)
        },
        kill() {}
      }
    }
  })

  await provider.generate({
    systemPrompt: '只输出 JSON',
    userPrompt: '根据截图生成 HTML',
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgo='
  })

  const imageFlagIndex = capturedArgs.indexOf('--image')
  assert.ok(imageFlagIndex >= 0)
  assert.equal(capturedArgs[imageFlagIndex + 1], capturedImagePath)
  assert.match(capturedImagePath, /codex-image-input-.*\/input\.png$/)
  assert.deepEqual(capturedImageBytes, [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(existsSync(capturedImagePath), false)
  assert.doesNotMatch(capturedStdin, /iVBORw0KGgo=/)
})

test('model settings factory creates codex cli provider without api key', () => {
  const provider = createAgentProviderFromModelSettings({
    provider: 'codex-cli',
    enabled: true,
    defaultModel: 'gpt-5.5'
  })

  assert.equal(provider.name, 'codex-cli')
})
