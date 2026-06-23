export const designRules = {
  source: 'design.md',
  product: '稿定创作页风格的流程通工作台',
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
    accentOrange: '#ff7a1a',
    success: '#18a058',
    warning: '#f5a524',
    danger: '#d92d20'
  },
  typography: {
    family: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", Arial, sans-serif',
    base: '14px',
    lineHeight: '21px',
    sectionTitle: '22px',
    hero: '38px'
  },
  layout: {
    topbarHeight: 72,
    sidebarWidth: 72,
    sectionPadding: '20px 24px',
    templateCard: { width: 214, height: 324 },
    spacing: [8, 12, 16, 20, 24, 32, 48, 72]
  },
  radius: {
    small: 6,
    base: 8,
    medium: 12,
    large: 16,
    pill: 999
  },
  components: {
    primaryButton: {
      height: 32,
      radius: 8,
      background: '#222529',
      color: '#ffffff'
    },
    segmentedControl: {
      height: 36,
      radius: 99,
      background: '#f1f2f4',
      activeBackground: '#ffffff'
    },
    sceneChip: {
      height: 46,
      width: 185,
      radius: 999,
      border: '#f6f7f9'
    },
    promptComposer: {
      minHeight: 156,
      radius: 12,
      shadow: '0 24px 72px rgba(34, 37, 41, 0.08)'
    }
  }
}

export const designPalette = {
  primary: designRules.colors.primary,
  success: designRules.colors.success,
  warning: designRules.colors.warning,
  danger: designRules.colors.danger,
  background: designRules.colors.canvas,
  surface: designRules.colors.canvas,
  text: designRules.colors.ink,
  mutedText: designRules.colors.muted,
  border: designRules.colors.border,
  accent: designRules.colors.accentCyan
}
