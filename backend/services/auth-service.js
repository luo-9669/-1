import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

import { createWorkspaceProject, createWorkspaceUser, publicWorkspaceUser } from '../models/workspace.js'

const PASSWORD_PREFIX = 'scrypt'
const PASSWORD_KEY_LENGTH = 64
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14
const SESSION_TOKEN_PREFIX = 'v1'

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase()
}

function validateEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function userAvatar(name = '', email = '') {
  const source = String(name || email || '流').trim()
  return source.slice(0, 1).toUpperCase() || '流'
}

export function hashPassword(password = '', salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, PASSWORD_KEY_LENGTH).toString('hex')
  return `${PASSWORD_PREFIX}:${salt}:${hash}`
}

export function verifyPassword(password = '', storedHash = '') {
  const [prefix, salt, hash] = String(storedHash || '').split(':')
  if (prefix !== PASSWORD_PREFIX || !salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(String(password), salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=')
      if (index <= 0) return cookies
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1))
      return cookies
    }, {})
}

function authError(statusCode, message, code = 'AUTH_FAILED') {
  return {
    statusCode,
    authenticated: false,
    user: null,
    message,
    code
  }
}

function safeEqualString(left = '', right = '') {
  const leftBuffer = Buffer.from(String(left || ''))
  const rightBuffer = Buffer.from(String(right || ''))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function encodeSessionPayload(payload = {}) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeSessionPayload(value = '') {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function signSessionPayload(payload = '', secret = '') {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function signedSessionToken(userId = '', secret = '', now = Date.now()) {
  const payload = encodeSessionPayload({
    userId,
    exp: now + SESSION_TTL_SECONDS * 1000
  })
  const signature = signSessionPayload(payload, secret)
  return `${SESSION_TOKEN_PREFIX}.${payload}.${signature}`
}

function userIdFromSignedSessionToken(token = '', secret = '', now = Date.now()) {
  if (!secret || !String(token || '').startsWith(`${SESSION_TOKEN_PREFIX}.`)) return ''
  const [, payload = '', signature = ''] = String(token || '').split('.')
  if (!payload || !signature) return ''
  const expectedSignature = signSessionPayload(payload, secret)
  if (!safeEqualString(signature, expectedSignature)) return ''
  const data = decodeSessionPayload(payload)
  if (!data?.userId || Number(data.exp || 0) < now) return ''
  return String(data.userId)
}

function bootstrapUserConfig(options = {}) {
  const configured = options.bootstrapUser || {}
  return {
    name: configured.name || process.env.AUTH_BOOTSTRAP_NAME || process.env.ADMIN_NAME || '',
    email: configured.email || process.env.AUTH_BOOTSTRAP_EMAIL || process.env.ADMIN_EMAIL || '',
    password: configured.password || process.env.AUTH_BOOTSTRAP_PASSWORD || process.env.ADMIN_PASSWORD || ''
  }
}

export function createAuthService(store, options = {}) {
  const sessions = options.sessions || new Map()
  const cookieName = options.cookieName || 'liuchengtong_session'
  const secureCookie = Boolean(options.secureCookie)
  const sessionSecret = String(options.sessionSecret || process.env.AUTH_SESSION_SECRET || process.env.SESSION_SECRET || '').trim()
  const sessionIdFactory = options.sessionIdFactory || (() => randomUUID())

  ensureBootstrapUser()

  function cookieForSession(sessionId = '') {
    const secure = secureCookie ? '; Secure' : ''
    return `${cookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  }

  function clearCookie() {
    const secure = secureCookie ? '; Secure' : ''
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  }

  function sessionIdFromRequest(req = {}) {
    return parseCookies(req.headers?.cookie || req.headers?.Cookie || '')[cookieName] || ''
  }

  function findUserByEmail(email = '') {
    const normalized = normalizeEmail(email)
    return store.users.find((user) => normalizeEmail(user.email) === normalized) || null
  }

  function createSession(userId = '') {
    if (sessionSecret) return signedSessionToken(userId, sessionSecret)
    const sessionId = sessionIdFactory()
    sessions.set(sessionId, {
      userId,
      createdAt: new Date().toISOString()
    })
    return sessionId
  }

  function currentUser(req = {}) {
    const sessionId = sessionIdFromRequest(req)
    const signedUserId = userIdFromSignedSessionToken(sessionId, sessionSecret)
    if (signedUserId) return store.users.find((user) => user.id === signedUserId) || null
    const session = sessionId ? sessions.get(sessionId) : null
    if (!session?.userId) return null
    return store.users.find((user) => user.id === session.userId) || null
  }

  function ensureBootstrapUser() {
    const configured = bootstrapUserConfig(options)
    const email = normalizeEmail(configured.email)
    const password = String(configured.password || '')
    if (!validateEmail(email) || password.length < 6) return
    const name = String(configured.name || '').trim() || email.split('@')[0] || '流程通管理员'
    let user = findUserByEmail(email)
    if (!user) {
      user = createWorkspaceUser({
        name,
        email,
        avatar: userAvatar(name, email),
        role: store.users.length ? 'member' : 'owner',
        passwordHash: hashPassword(password)
      })
      store.users.push(user)
    } else if (!verifyPassword(password, user.passwordHash)) {
      user.passwordHash = hashPassword(password)
      user.updatedAt = new Date().toISOString()
    }
    if (!store.projects.some((project) => project.ownerUserId === user.id)) {
      store.projects.unshift(createWorkspaceProject({
        ownerUserId: user.id,
        name: `${name}的默认项目`,
        description: '部署初始化账号自动创建的默认项目。',
        stage: 'design'
      }))
    }
    store.currentUserId = store.currentUserId || user.id
    store.currentProjectId = store.currentProjectId || store.projects.find((project) => project.ownerUserId === user.id)?.id || ''
    void store.persist?.()
  }

  async function register(payload = {}) {
    const email = normalizeEmail(payload.email)
    const password = String(payload.password || '')
    const name = String(payload.name || '').trim() || email.split('@')[0] || '流程通用户'
    if (!validateEmail(email)) return authError(400, '请输入有效邮箱', 'AUTH_INVALID_EMAIL')
    if (password.length < 6) return authError(400, '密码至少需要 6 位', 'AUTH_WEAK_PASSWORD')
    if (findUserByEmail(email)) return authError(409, '该邮箱已注册，请直接登录', 'AUTH_EMAIL_EXISTS')

    const user = createWorkspaceUser({
      name,
      email,
      avatar: userAvatar(name, email),
      role: store.users.length ? 'member' : 'owner',
      passwordHash: hashPassword(password)
    })
    store.users.push(user)

    const project = createWorkspaceProject({
      ownerUserId: user.id,
      name: `${name}的默认项目`,
      description: '账号注册后自动创建的默认项目。',
      stage: 'design'
    })
    store.projects.unshift(project)
    store.currentUserId = user.id
    store.currentProjectId = project.id
    await store.persist?.()

    const sessionId = createSession(user.id)
    return {
      statusCode: 201,
      headers: { 'Set-Cookie': cookieForSession(sessionId) },
      authenticated: true,
      user: publicWorkspaceUser(user),
      currentUserId: user.id,
      currentProjectId: project.id,
      project
    }
  }

  async function login(payload = {}) {
    const email = normalizeEmail(payload.email)
    const user = findUserByEmail(email)
    if (!user || !verifyPassword(payload.password || '', user.passwordHash)) {
      return authError(401, '邮箱或密码不正确', 'AUTH_BAD_CREDENTIALS')
    }
    store.currentUserId = user.id
    const ownedProject = store.projects.find((project) => project.ownerUserId === user.id)
    if (ownedProject) store.currentProjectId = ownedProject.id
    await store.persist?.()

    const sessionId = createSession(user.id)
    return {
      statusCode: 200,
      headers: { 'Set-Cookie': cookieForSession(sessionId) },
      authenticated: true,
      user: publicWorkspaceUser(user),
      currentUserId: user.id,
      currentProjectId: store.currentProjectId
    }
  }

  async function logout(payload = {}, req = {}) {
    const sessionId = sessionIdFromRequest(req)
    if (sessionId) sessions.delete(sessionId)
    return {
      statusCode: 200,
      headers: { 'Set-Cookie': clearCookie() },
      authenticated: false,
      user: null
    }
  }

  async function me(payload = {}, req = {}) {
    const user = currentUser(req)
    if (!user) {
      return {
        statusCode: 200,
        authenticated: false,
        user: null
      }
    }
    store.currentUserId = user.id
    const ownedProject = store.projects.find((project) => project.ownerUserId === user.id)
    if (ownedProject && !store.projects.some((project) => project.id === store.currentProjectId && project.ownerUserId === user.id)) {
      store.currentProjectId = ownedProject.id
    }
    return {
      statusCode: 200,
      authenticated: true,
      user: publicWorkspaceUser(user),
      currentUserId: user.id,
      currentProjectId: store.currentProjectId
    }
  }

  return {
    currentUser,
    routes() {
      return {
        'POST /api/auth/register': register,
        'POST /api/auth/login': login,
        'POST /api/auth/logout': logout,
        'GET /api/auth/me': me
      }
    }
  }
}
