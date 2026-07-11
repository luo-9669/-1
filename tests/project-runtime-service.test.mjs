import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createProjectRuntimeService } from '../backend/services/project-runtime-service.js'

test('project runtime service writes uploaded files and starts the dev server on an allocated port', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'project-runtime-test-'))
  const commands = []
  const spawned = []
  const service = createProjectRuntimeService({
    rootDir,
    allocatePort: async () => 4317,
    idFactory: () => 'runtime-test',
    runCommand: async (command, args, options) => {
      commands.push({ command, args, cwd: options.cwd })
    },
    spawnCommand: (command, args, options) => {
      spawned.push({ command, args, cwd: options.cwd })
      return {
        pid: 12345,
        stdout: { on() {} },
        stderr: { on() {} },
        on() {},
        kill() {}
      }
    },
    waitForUrl: async () => true
  })

  try {
    const runtime = await service.start({
      projectId: 'project-demo',
      fileName: 'demo.zip',
      files: [
        { path: 'package.json', content: JSON.stringify({ scripts: { dev: 'vite --host 0.0.0.0' }, dependencies: { vite: '^5.0.0' } }) },
        { path: 'src/App.vue', content: '<template><button>Next</button></template>' },
        { path: 'public/logo.png', content: 'data:image/png;base64,aGVsbG8=' },
        { path: '../secret.txt', content: 'nope' },
        { path: '.env', content: 'TOKEN=secret' }
      ]
    })

    assert.equal(runtime.id, 'runtime-test')
    assert.equal(runtime.projectId, 'project-demo')
    assert.equal(runtime.url, 'http://127.0.0.1:4317')
    assert.equal(runtime.status, 'running')
    assert.equal(runtime.packageManager, 'npm')
    assert.deepEqual(commands[0].args.slice(0, 2), ['install', '--silent'])
    assert.equal(commands[0].cwd, runtime.workDir)
    assert.deepEqual(spawned[0].args, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4317'])
    assert.equal(await readFile(join(runtime.workDir, 'src/App.vue'), 'utf8'), '<template><button>Next</button></template>')
    assert.equal(await readFile(join(runtime.workDir, 'public/logo.png'), 'utf8'), 'hello')
    await assert.rejects(readFile(join(runtime.workDir, 'secret.txt'), 'utf8'))
    await assert.rejects(readFile(join(runtime.workDir, '.env'), 'utf8'))
  } finally {
    await service.stop('runtime-test')
    await rm(rootDir, { recursive: true, force: true })
  }
})

test('project runtime service rejects packages without a runnable package script', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'project-runtime-test-'))
  const service = createProjectRuntimeService({
    rootDir,
    runCommand: async () => {},
    spawnCommand: () => ({ stdout: { on() {} }, stderr: { on() {} }, on() {}, kill() {} })
  })

  try {
    await assert.rejects(
      service.start({
        projectId: 'project-demo',
        fileName: 'broken.zip',
        files: [{ path: 'package.json', content: JSON.stringify({ scripts: { lint: 'eslint .' } }) }]
      }),
      /没有找到可运行的 package script/
    )
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test('project runtime service prefers local preview script when dev references a missing env file', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'project-runtime-test-'))
  const spawned = []
  const service = createProjectRuntimeService({
    rootDir,
    allocatePort: async () => 4318,
    idFactory: () => 'runtime-local-env',
    runCommand: async () => {},
    spawnCommand: (command, args) => {
      spawned.push({ command, args })
      return {
        stdout: { on() {} },
        stderr: { on() {} },
        on() {},
        kill() {}
      }
    },
    waitForUrl: async () => true
  })

  try {
    const runtime = await service.start({
      projectId: 'project-jogg',
      fileName: 'jogg.zip',
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            scripts: {
              dev: 'nuxt dev --dotenv .env.development',
              'dev:local': 'nuxt dev --dotenv .env.example --host 127.0.0.1 --port 3000'
            }
          })
        },
        { path: '.env.example', content: 'VITE_ENV=dev' },
        { path: 'app/app.vue', content: '<template>Jogg</template>' }
      ]
    })

    assert.equal(runtime.script, 'dev:local')
    assert.deepEqual(spawned[0].args, ['run', 'dev:local', '--', '--host', '127.0.0.1', '--port', '4318'])
  } finally {
    await service.stop('runtime-local-env')
    await rm(rootDir, { recursive: true, force: true })
  }
})
