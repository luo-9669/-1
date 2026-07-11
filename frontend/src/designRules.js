export const designRules = {
  source: 'design.md',
  product: 'AI 创作页风格的流程通工作台',
  colors: {
    ink: '#222529',
    primary: '#222529',
    primaryHover: '#1D2129',
    primaryActive: '#111318',
    brandBlue: '#1677FF',
    brandBlueHover: '#0958D9',
    brandBlueActive: '#0040C9',
    aiAccent: '#7B61FF',
    aiAccentHover: '#6346E5',
    secondary: '#4c535c',
    muted: '#7f8792',
    disabled: '#9da3ac',
    canvas: '#ffffff',
    shell: '#f6f7f9',
    softSurface: '#f7f8fa',
    border: '#e8eaec',
    n0: '#FFFFFF',
    n1: '#F7F8FA',
    n2: '#E5E6EB',
    n3: '#C9CDD4',
    n4: '#86909C',
    n5: '#4E5969',
    n6: '#272E3B',
    n7: '#1D2129',
    accentCyan: '#69e1f5',
    accentBlue: '#2578ff',
    accentOrange: '#ff7a1a',
    success: '#00B42A',
    warning: '#FF7D00',
    danger: '#F53F3F',
    info: '#86909C'
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
      height: 44,
      radius: 8,
      background: '#222529',
      color: '#ffffff'
    },
    brandButton: {
      height: 44,
      radius: 8,
      background: '#1677FF',
      color: '#ffffff'
    },
    aiButton: {
      height: 44,
      radius: 8,
      background: '#7B61FF',
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
  brand: designRules.colors.brandBlue,
  aiAccent: designRules.colors.aiAccent,
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
