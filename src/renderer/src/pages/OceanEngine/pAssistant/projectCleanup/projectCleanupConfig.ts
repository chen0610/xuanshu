import { serializeProjectCleanupMetricConditions, type ProjectCleanupMetricCondition } from '../projectCleanupMetrics'
import type { ProjectCleanupFilter } from '../../../../services/ocean-engine.service'

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

export interface ProjectCleanupConfigSnapshot {
  rootEbpId: string
  ebpId: string
  accountScope: 'all' | 'partial'
  accountIds: string
  filter: Pick<ProjectCleanupFilter, 'start_date' | 'end_date' | 'project_status'>
  filterEnabled: boolean
  metricConditions: ProjectCleanupMetricCondition[]
  durationHours: string
}

export function buildProjectCleanupConfigFingerprint(snapshot: ProjectCleanupConfigSnapshot): string {
  return JSON.stringify({
    rootEbpId: snapshot.rootEbpId.trim(),
    ebpId: snapshot.ebpId.trim(),
    accountScope: snapshot.accountScope,
    accountIds: snapshot.accountIds.trim(),
    startDate: snapshot.filter.start_date,
    endDate: snapshot.filter.end_date,
    projectStatus: snapshot.filter.project_status,
    filterEnabled: snapshot.filterEnabled,
    metricConditions: snapshot.filterEnabled
      ? serializeProjectCleanupMetricConditions(snapshot.metricConditions)
      : [],
    durationHours: snapshot.durationHours.trim()
  })
}
