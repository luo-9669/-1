import {
  generateDiagramBundle,
  generateDiagramBundleWithProvider
} from '../services/diagram-generator.js'

export function diagramRoutes(options = {}) {
  const generate = options.generateDiagramBundle || (options.provider
    ? (payload) => generateDiagramBundleWithProvider(payload, { provider: options.provider })
    : generateDiagramBundle)
  return {
    'POST /api/diagrams/generate': async (payload = {}) => generate(payload)
  }
}
