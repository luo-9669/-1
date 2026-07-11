import assert from 'node:assert/strict'
import test from 'node:test'

import { createWorkspaceStore } from '../services/workspace-store.js'
import { workspaceRoutes } from './workspace.js'

function setCookieValue(response = {}) {
  const raw = response.headers?.['Set-Cookie'] || ''
  return String(raw).split(';')[0]
}

test('auth routes register an account, create an owned project, and hide password hashes', async () => {
  const store = createWorkspaceStore({ users: [], projects: [] })
  const routes = workspaceRoutes(store, {
    auth: { secureCookie: false, sessionIdFactory: () => 'session-register' }
  })

  const result = await routes['POST /api/auth/register']({
    name: '林一',
    email: 'lin@example.com',
    password: 'secret123'
  })

  assert.equal(result.statusCode, 201)
  assert.equal(result.authenticated, true)
  assert.equal(result.user.email, 'lin@example.com')
  assert.equal(result.user.passwordHash, undefined)
  assert.match(result.headers['Set-Cookie'], /liuchengtong_session=session-register/)
  assert.match(result.headers['Set-Cookie'], /HttpOnly/)
  assert.equal(store.currentUserId, result.user.id)
  assert.equal(store.projects[0].ownerUserId, result.user.id)

  const snapshot = await routes['GET /api/workspace']({})
  const registeredUser = snapshot.users.find((user) => user.email === 'lin@example.com')
  assert.ok(registeredUser)
  assert.equal(registeredUser.passwordHash, undefined)
})

test('auth routes log in with a password and resolve the current session user', async () => {
  const store = createWorkspaceStore({ users: [], projects: [] })
  const routes = workspaceRoutes(store, {
    auth: {
      secureCookie: false,
      sessionIdFactory: (() => {
        const ids = ['session-register', 'session-login']
        return () => ids.shift() || 'session-next'
      })()
    }
  })

  await routes['POST /api/auth/register']({
    name: '林一',
    email: 'lin@example.com',
    password: 'secret123'
  })

  const failed = await routes['POST /api/auth/login']({
    email: 'lin@example.com',
    password: 'bad-password'
  })
  assert.equal(failed.statusCode, 401)
  assert.equal(failed.authenticated, false)

  const login = await routes['POST /api/auth/login']({
    email: 'LIN@example.com',
    password: 'secret123'
  })
  assert.equal(login.statusCode, 200)
  assert.equal(login.authenticated, true)
  assert.equal(login.user.email, 'lin@example.com')
  assert.match(login.headers['Set-Cookie'], /liuchengtong_session=session-login/)

  const me = await routes['GET /api/auth/me']({}, {
    headers: { cookie: setCookieValue(login) }
  })
  assert.equal(me.authenticated, true)
  assert.equal(me.user.email, 'lin@example.com')
  assert.equal(me.user.passwordHash, undefined)
})

test('auth routes clear the session on logout', async () => {
  const store = createWorkspaceStore({ users: [], projects: [] })
  const routes = workspaceRoutes(store, {
    auth: { secureCookie: false, sessionIdFactory: () => 'session-register' }
  })

  const registered = await routes['POST /api/auth/register']({
    name: '林一',
    email: 'lin@example.com',
    password: 'secret123'
  })
  const cookie = setCookieValue(registered)

  const beforeLogout = await routes['GET /api/auth/me']({}, { headers: { cookie } })
  assert.equal(beforeLogout.authenticated, true)

  const logout = await routes['POST /api/auth/logout']({}, { headers: { cookie } })
  assert.equal(logout.authenticated, false)
  assert.match(logout.headers['Set-Cookie'], /Max-Age=0/)

  const afterLogout = await routes['GET /api/auth/me']({}, { headers: { cookie } })
  assert.equal(afterLogout.authenticated, false)
  assert.equal(afterLogout.user, null)
})
