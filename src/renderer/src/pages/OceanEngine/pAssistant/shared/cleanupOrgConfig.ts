export interface OrgNodeSelection {
  id: string
  name: string
}

export interface RootOrganizationOption {
  rootId: string
  rootName?: string
  companyName?: string
  roleName?: string
  tagName?: string
}

export const DURATION_PRESET_HOURS = ['12', '24', '48', '72'] as const
export const DURATION_NO_LIMIT = '0'

export function isCustomDurationHours(durationHours: string): boolean {
  return (
    durationHours !== DURATION_NO_LIMIT &&
    !DURATION_PRESET_HOURS.includes(durationHours as (typeof DURATION_PRESET_HOURS)[number])
  )
}

export const getTodayDateString = (): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function flattenOrgTreeNodes(node: unknown, level = 0): OrgNodeSelection[] {
  if (!node || typeof node !== 'object') return []
  const record = node as Record<string, unknown>
  const nodeId = String(record.id || record.ebp_id || '').trim()
  const nodeName = String(record.name || record.ebp_name || record.group_name || nodeId).trim()
  const current = nodeId ? [{ id: nodeId, name: `${'　'.repeat(level)}${nodeName || nodeId}` }] : []
  const children = Array.isArray(record.children) ? record.children : []
  return [...current, ...children.flatMap((child) => flattenOrgTreeNodes(child, level + 1))]
}

export function resolveRootEbpId(roots: RootOrganizationOption[], preferred?: string): string {
  const trimmed = preferred?.trim()
  if (trimmed && roots.some((item) => item.rootId === trimmed)) {
    return trimmed
  }
  return roots[0]?.rootId || ''
}

export function formatRootOrganizationLabel(root: RootOrganizationOption): string {
  const name = root.rootName || root.companyName || root.rootId
  return `${name}（${root.rootId}）`
}

/** 清理任务指定账户数量上限（暂时隐藏「全部账户」模式） */
export const CLEANUP_MAX_ACCOUNT_COUNT = 500

export function enforceMaxAccountIdsText(
  text: string,
  maxCount = CLEANUP_MAX_ACCOUNT_COUNT
): string {
  const lines = text.split('\n')
  let count = 0
  const result: string[] = []
  for (const line of lines) {
    if (line.trim().length > 0) {
      count += 1
      if (count > maxCount) continue
    }
    result.push(line)
  }
  return result.join('\n')
}
