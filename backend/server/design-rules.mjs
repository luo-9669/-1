export const DEFAULT_DESIGN_RULES = {
  source: 'design.md',
  colors: {
    ink: '#222529',
    secondary: '#4c535c',
    muted: '#7f8792',
    disabled: '#9da3ac',
    canvas: '#ffffff',
    shell: '#f6f7f9',
    softSurface: '#f7f8fa',
    border: '#e8eaec',
    primary: '#222529',
    accentCyan: '#69e1f5',
    accentBlue: '#2578ff',
    accentOrange: '#ff7a1a'
  },
  layout: {
    topbarHeight: 72,
    sidebarWidth: 72,
    templateCard: { width: 214, height: 324 },
    spacing: [8, 12, 16, 20, 24, 32, 48, 72]
  },
  radius: { small: 6, base: 8, medium: 12, large: 16, pill: 999 },
  components: {
    primaryButton: { height: 32, radius: 8, background: '#222529', color: '#ffffff' },
    segmentedControl: { height: 36, radius: 99, background: '#f1f2f4', activeBackground: '#ffffff' },
    sceneChip: { height: 46, width: 185, radius: 999, border: '#f6f7f9' },
    promptComposer: { minHeight: 156, radius: 12, shadow: '0 24px 72px rgba(34, 37, 41, 0.08)' }
  }
}

export function resolveDesignRules(rules = {}) {
  return {
    ...DEFAULT_DESIGN_RULES,
    ...rules,
    colors: { ...DEFAULT_DESIGN_RULES.colors, ...(rules.colors || {}) },
    layout: { ...DEFAULT_DESIGN_RULES.layout, ...(rules.layout || {}) },
    radius: { ...DEFAULT_DESIGN_RULES.radius, ...(rules.radius || {}) },
    components: { ...DEFAULT_DESIGN_RULES.components, ...(rules.components || {}) }
  }
}
