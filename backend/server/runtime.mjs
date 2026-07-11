export function isImportedByTestRunner(argv = process.argv) {
  return /(^|[/\\])tests([/\\]|$)/.test(String(argv[1] || ''))
}

export function isTestRuntime(env = process.env, argv = process.argv) {
  return env.NODE_ENV === 'test' || env.npm_lifecycle_event === 'test' || isImportedByTestRunner(argv)
}
