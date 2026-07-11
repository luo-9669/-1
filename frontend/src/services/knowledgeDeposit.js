export const KNOWLEDGE_DEPOSIT_TYPES = [
  { key: 'knowledge-card', label: '知识卡片', category: 'knowledge-card' },
  { key: 'design-decision', label: '设计决策', category: 'design-decision' },
  { key: 'business-rule', label: '业务规则', category: 'business-rule' },
  { key: 'source-evidence', label: '来源证据', category: 'source-evidence' }
]

const DEFAULT_ROLE_SCOPES = ['product', 'ux', 'development', 'ai-retrieval']

function compactText(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => String(part))
    .join('\n')
}

function sourceTypeOf(source = {}) {
  return source.sourceType || source.type || 'manual'
}

function categoryFor(depositType = 'knowledge-card') {
  return KNOWLEDGE_DEPOSIT_TYPES.find((item) => item.key === depositType)?.category || 'knowledge-card'
}

export function buildKnowledgeDepositPayload({
  projectId = '',
  source = {},
  depositType = 'knowledge-card',
  roleScopes = DEFAULT_ROLE_SCOPES,
  blueprintNode = null,
  title = '',
  content = '',
  notes = ''
} = {}) {
  const sourceType = sourceTypeOf(source)
  const sourceText = compactText(source.content, source.notes, source.summary)
  const resolvedTitle = title || source.title || '未命名知识'
  const resolvedContent = content || sourceText || source.meta || resolvedTitle
  const evidence = [
    {
      title: source.title || resolvedTitle,
      text: sourceText || source.meta || resolvedContent,
      url: source.sourceUrl || source.url || '',
      sourceType,
      sourceMaterialId: source.id || ''
    }
  ]
  const relations = []
  if (blueprintNode?.id) {
    relations.push({
      type: 'blueprint-node',
      targetId: blueprintNode.id,
      title: blueprintNode.title || blueprintNode.name || blueprintNode.id,
      nodeType: blueprintNode.type || ''
    })
  }
  if (source.id) {
    relations.push({
      type: 'source-material',
      targetId: source.id,
      title: source.title || source.id,
      sourceType
    })
  }
  return {
    projectId,
    type: 'knowledge',
    title: resolvedTitle,
    meta: KNOWLEDGE_DEPOSIT_TYPES.find((item) => item.key === depositType)?.label || '知识卡片',
    status: '待审核',
    notes,
    content: resolvedContent,
    category: categoryFor(depositType),
    sourceMaterialId: source.id || '',
    sourceType,
    sourceUrl: source.sourceUrl || source.url || '',
    manualComplements: Array.isArray(source.manualComplements) ? [...source.manualComplements] : [],
    knowledgeSlots: Array.isArray(source.knowledgeSlots) ? [...source.knowledgeSlots] : [],
    roleScopes: Array.isArray(roleScopes) && roleScopes.length ? [...roleScopes] : [...DEFAULT_ROLE_SCOPES],
    evidence,
    relations,
    verification: {
      status: 'unverified',
      reason: '由统一沉淀入口创建，待人工确认'
    },
    owner: '知识库管理员'
  }
}
