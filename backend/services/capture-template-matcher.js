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
