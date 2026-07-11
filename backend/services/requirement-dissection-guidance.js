import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const GUIDANCE_VERSION = 'requirement-dissection-guidance/v1'

const GUIDANCE_SOURCES = {
  methodGuides: [
    {
      path: 'docs/skills/requirement-dissection-guidance/SKILL.md',
      sourceType: 'skill'
    }
  ],
  hardConstraints: [
    {
      path: 'docs/product-contracts/requirement-dissection-function-map.md',
      sourceType: 'product-contract'
    },
    {
      path: 'docs/product-contracts/workflow-agent-chat.md',
      sourceType: 'product-contract'
    },
    {
      path: 'docs/product-contracts/interaction-lofi-canvas.md',
      sourceType: 'product-contract'
    },
    {
      path: 'docs/product-contracts/frontend-backend-handoff.md',
      sourceType: 'product-contract'
    },
    {
      path: 'docs/product-contracts/requirement-slices.md',
      sourceType: 'product-contract'
    }
  ],
  referenceNotes: [
    {
      path: 'docs/superpowers/specs/2026-06-28-total-design-flow-workbench-design.md',
      sourceType: 'spec'
    },
    {
      path: 'docs/superpowers/plans/2026-06-28-total-design-flow-workbench.md',
      sourceType: 'spec'
    }
  ]
}

function cleanGuidanceText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function stripFrontmatter(text = '') {
  return String(text || '').replace(/^---[\s\S]*?---\s*/, '')
}

function titleFromContent(text = '', fallback = '') {
  const heading = stripFrontmatter(text).split(/\r?\n/).find((line) => /^#\s+/.test(line))
  return cleanGuidanceText(heading ? heading.replace(/^#\s+/, '') : fallback)
}

function summaryFromContent(text = '') {
  const body = stripFrontmatter(text)
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line && !/^```/.test(line))
    .filter((line) => !/^(Overview|When to Use|Core Method|Hard Boundaries|Quality Checklist)$/i.test(line))
  return cleanGuidanceText(lines.slice(0, 3).join(' ')).slice(0, 260)
}

function guidanceId(relativePath = '') {
  return relativePath
    .replace(/^docs\//, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function loadGuidanceEntry(source = {}) {
  const absolutePath = path.resolve(repoRoot, source.path)
  if (!existsSync(absolutePath)) return null
  const content = readFileSync(absolutePath, 'utf8')
  return {
    id: guidanceId(source.path),
    title: titleFromContent(content, path.basename(source.path)),
    path: source.path,
    summary: summaryFromContent(content),
    sourceType: source.sourceType,
    absolutePath
  }
}

export function loadRequirementDissectionGuidance() {
  const seen = new Set()
  const loadGroup = (group = []) => group
    .map(loadGuidanceEntry)
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry.absolutePath)) return false
      seen.add(entry.absolutePath)
      delete entry.absolutePath
      return true
    })

  return {
    hardConstraints: loadGroup(GUIDANCE_SOURCES.hardConstraints),
    methodGuides: loadGroup(GUIDANCE_SOURCES.methodGuides),
    referenceNotes: loadGroup(GUIDANCE_SOURCES.referenceNotes)
  }
}

export function buildRequirementDissectionGuidanceArtifact() {
  return {
    version: GUIDANCE_VERSION,
    ...loadRequirementDissectionGuidance()
  }
}
