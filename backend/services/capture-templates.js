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
