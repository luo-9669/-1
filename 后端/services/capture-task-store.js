import { randomUUID } from 'node:crypto'

function isoTime(now) {
  return new Date(now()).toISOString()
}

function normalizeSourceType(payload = {}) {
  if (payload.sourceType) return payload.sourceType
  if (payload.captureKind === 'web-snapshot-import') return 'snapshot-package'
  if (payload.captureKind === 'image-to-code') return 'image'
  if (payload.url) return 'url'
  return 'unknown'
}

function publicTask(task = {}) {
  return {
    taskId: task.taskId,
    projectId: task.projectId,
    sourceType: task.sourceType,
    url: task.url,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    result: task.result,
    error: task.error
  }
}

export function createCaptureTaskStore(options = {}) {
  const uuid = options.uuid || randomUUID
  const now = options.now || Date.now
  const tasks = new Map()
  const order = []

  function createTask(payload = {}) {
    const taskId = uuid()
    const timestamp = isoTime(now)
    const task = {
      taskId,
      projectId: payload.projectId || 'default',
      sourceType: normalizeSourceType(payload),
      url: payload.url || '',
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      result: null,
      error: null,
      payload: { ...payload }
    }
    tasks.set(taskId, task)
    order.push(taskId)
    return publicTask(task)
  }

  function updateTask(taskId, patch = {}) {
    const current = tasks.get(taskId)
    if (!current) return null
    const next = {
      ...current,
      ...patch,
      updatedAt: isoTime(now)
    }
    tasks.set(taskId, next)
    return publicTask(next)
  }

  function getTask(taskId = '') {
    const task = tasks.get(taskId)
    return task ? publicTask(task) : null
  }

  function result(taskId = '') {
    const task = getTask(taskId)
    if (!task) {
      const error = new Error(`Capture task not found: ${taskId}`)
      error.code = 'CAPTURE_TASK_NOT_FOUND'
      throw error
    }
    return task
  }

  function latestResult() {
    const latestId = order[order.length - 1]
    return latestId ? result(latestId) : null
  }

  async function runTask(payload = {}, runner) {
    if (!runner || typeof runner.makeCaptureResult !== 'function') {
      throw new Error('Capture runner is not configured')
    }
    const task = createTask(payload)
    updateTask(task.taskId, { status: 'capturing' })
    try {
      const captureResult = await runner.makeCaptureResult({
        ...payload,
        taskId: task.taskId
      })
      const resultPayload = {
        ...captureResult,
        taskId: task.taskId,
        projectId: task.projectId
      }
      const completed = updateTask(task.taskId, {
        status: 'success',
        result: resultPayload,
        error: null
      })
      return completed.result
    } catch (error) {
      updateTask(task.taskId, {
        status: 'failed',
        result: null,
        error: {
          message: error.message || '采集任务失败',
          code: error.code || 'CAPTURE_TASK_FAILED'
        }
      })
      throw error
    }
  }

  return {
    createTask,
    updateTask,
    getTask,
    result,
    latestResult,
    runTask
  }
}
