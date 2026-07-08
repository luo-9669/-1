### Task 1: Add The Declarative Template Library, URL Analyzer, And Template Matcher

**Files:**
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-templates.js`
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-url-analyzer.js`
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-template-matcher.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: raw capture request shape `{ url: string, authMode?: 'public' | 'browser' | 'cookie' }`.
- Produces: `analyzeCaptureUrl(input): CaptureUrlAnalysis`, `matchCaptureTemplate(input): { templateId, template, matchReason }`, `CAPTURE_TEMPLATES`.

- [ ] **Step 1: Write the failing tests for analyzer and matcher**

Append this test block near the existing backend capture tests in `tests/workflows.test.mjs`:

```js
test('analyzes capture URLs and matches phase-one relay templates', async () => {
  const { analyzeCaptureUrl } = await import('../backend/services/capture-url-analyzer.js')
  const { matchCaptureTemplate } = await import('../backend/services/capture-template-matcher.js')

  const dashboard = analyzeCaptureUrl({
    url: 'https://example.com/dashboard/home',
    authMode: 'public'
  })
  assert.equal(dashboard.normalizedUrl, 'https://example.com/dashboard/home')
  assert.equal(dashboard.hostname, 'example.com')
  assert.equal(dashboard.traits.pageClass, 'saas-dashboard')
  assert.equal(dashboard.authHints.requiresAuth, true)
  assert.equal(dashboard.authHints.preferredAuthMode, 'browser')

  const login = analyzeCaptureUrl({
    url: 'https://example.com/login?next=%2Fapp',
    authMode: 'public'
  })
  assert.equal(login.traits.pageClass, 'login-page')

  const matched = matchCaptureTemplate({
    analysis: dashboard,
    authMode: 'browser'
  })
  assert.equal(matched.templateId, 'generic-saas-dashboard')
  assert.equal(matched.template.navigation.waitUntil, 'networkidle')
  assert.match(matched.matchReason, /saas-dashboard/)
})
```

- [ ] **Step 2: Run the tests and confirm the new imports fail**

Run:

```bash
npm test
```

Expected: FAIL with a module-not-found error for `../backend/services/capture-url-analyzer.js` or `../backend/services/capture-template-matcher.js`.

- [ ] **Step 3: Implement the template library, analyzer, and matcher**

Create `backend/services/capture-templates.js` with the phase-one template registry:

```js
export const CAPTURE_TEMPLATES = [
  {
    id: 'generic-public-page',
    name: 'Generic Public Page',
    pageClasses: ['public-page'],
    match: { authModes: ['public', 'browser', 'cookie'] },
    preconditions: { loginRequired: false, preferAuthMode: 'public' },
    navigation: { waitUntil: 'networkidle', timeoutMs: 15000, extraWaitMs: 1200 },
    pageStrategy: {
      scrollMode: 'full-page',
      maxScrollSteps: 4,
      includeIframes: false,
      captureAboveTheFoldFirst: true
    },
    artifacts: { screenshot: true, singleFile: true, domSnapshot: true, networkLogs: false },
    fallbacks: {
      onLoginDetected: 'switch-to-browser-auth',
      onDomEmpty: 'retry-with-scroll',
      onBotDetected: 'manual-review'
    }
  },
  {
    id: 'generic-login-page',
    name: 'Generic Login Page',
    pageClasses: ['login-page'],
    match: { authModes: ['public', 'browser', 'cookie'] },
    preconditions: { loginRequired: true, preferAuthMode: 'browser' },
    navigation: { waitUntil: 'domcontentloaded', timeoutMs: 15000, extraWaitMs: 800 },
    pageStrategy: {
      scrollMode: 'viewport-only',
      maxScrollSteps: 1,
      includeIframes: false,
      captureAboveTheFoldFirst: true
    },
    artifacts: { screenshot: true, singleFile: true, domSnapshot: true, networkLogs: false },
    fallbacks: {
      onLoginDetected: 'switch-to-browser-auth',
      onDomEmpty: 'switch-to-browser-auth',
      onBotDetected: 'manual-review'
    }
  },
  {
    id: 'generic-saas-dashboard',
    name: 'Generic SaaS Dashboard',
    pageClasses: ['saas-dashboard'],
    match: { authModes: ['public', 'browser', 'cookie'] },
    preconditions: { loginRequired: true, preferAuthMode: 'browser' },
    navigation: { waitUntil: 'networkidle', timeoutMs: 20000, extraWaitMs: 3000 },
    pageStrategy: {
      scrollMode: 'full-page',
      maxScrollSteps: 8,
      includeIframes: false,
      captureAboveTheFoldFirst: true
    },
    artifacts: { screenshot: true, singleFile: true, domSnapshot: true, networkLogs: true },
    fallbacks: {
      onLoginDetected: 'switch-to-browser-auth',
      onDomEmpty: 'retry-with-scroll',
      onBotDetected: 'manual-review'
    }
  }
]
```

Create `backend/services/capture-url-analyzer.js`:

```js
function normalizeAuthMode(authMode = 'public') {
  return ['public', 'browser', 'cookie'].includes(authMode) ? authMode : 'public'
}

function inferPageClass(pathname = '', search = '') {
  const value = `${pathname}${search}`.toLowerCase()
  if (/(login|signin|signup|auth|oauth|passport)/.test(value)) return 'login-page'
  if (/\/(app|dashboard|admin|workspace|console)(\/|$)/.test(value)) return 'saas-dashboard'
  return 'public-page'
}

export function analyzeCaptureUrl(input = {}) {
  const parsed = new URL(String(input.url || '').trim())
  const pageClass = inferPageClass(parsed.pathname, parsed.search)
  const requiresAuth = pageClass !== 'public-page'
  return {
    normalizedUrl: parsed.href,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    query: parsed.search,
    authMode: normalizeAuthMode(input.authMode),
    traits: {
      pageClass,
      loginSignals: pageClass === 'login-page' ? ['auth-path'] : [],
      dynamicSignals: pageClass === 'saas-dashboard' ? ['app-shell-route'] : []
    },
    authHints: {
      requiresAuth,
      preferredAuthMode: requiresAuth ? 'browser' : 'public'
    }
  }
}
```

Create `backend/services/capture-template-matcher.js`:

```js
import { CAPTURE_TEMPLATES } from './capture-templates.js'

export function matchCaptureTemplate(input = {}) {
  const analysis = input.analysis || {}
  const pageClass = analysis.traits?.pageClass || 'public-page'
  const authMode = input.authMode || analysis.authMode || 'public'
  const template = CAPTURE_TEMPLATES.find((candidate) =>
    candidate.pageClasses.includes(pageClass)
      && candidate.match.authModes.includes(authMode)
  ) || CAPTURE_TEMPLATES[0]

  return {
    templateId: template.id,
    template,
    matchReason: `matched ${template.id} from ${pageClass} using ${authMode}`
  }
}
```

- [ ] **Step 4: Run the tests and confirm the analyzer/matcher behavior passes**

Run:

```bash
npm test
```

Expected: PASS for `analyzes capture URLs and matches phase-one relay templates`.

- [ ] **Step 5: Commit the template-analysis layer**

Run:

```bash
git add tests/workflows.test.mjs backend/services/capture-templates.js backend/services/capture-url-analyzer.js backend/services/capture-template-matcher.js
git commit -m "feat: add capture URL analyzer and template matcher"
```

Expected: a commit containing the new template registry and analyzer/matcher services.

