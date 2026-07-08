const SIDEBAR_NAV_ITEMS = [
  { key: 'requirements', label: '需求文档', icon: 'file-text' },
  { key: 'materials', label: '知识库', icon: 'book-open' },
  { key: 'workflow', label: '设计方案', icon: 'route' },
  { key: 'factory', label: '工程开发', icon: 'layout' },
  { key: 'assets', label: '交付资产', icon: 'archive' },
  { key: 'skillCenter', label: '技能中心', icon: 'spark' },
  { key: 'competitors', label: '竞品监控', icon: 'radar' }
]

export function getSidebarNavItems() {
  return SIDEBAR_NAV_ITEMS.map((item) => ({ ...item }))
}
