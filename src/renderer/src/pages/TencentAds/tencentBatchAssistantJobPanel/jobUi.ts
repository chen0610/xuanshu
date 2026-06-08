import type {
  TencentBatchAssistantJobItem,
  TencentBatchAssistantJobStatus
} from '../../../services/tencent-ads.service'

export type TencentRetryMode = 'all' | 'failed_only'

export type JobStatusFilter =
  | 'all'
  | 'active'
  | 'attention'
  | 'pending'
  | 'running'
  | 'failed'
  | 'partial'
  | 'cancelled'

export const PAGE_SIZE = 8
export const STALE_RUNNING_JOB_THRESHOLD_MINUTES = 30

export const HIGH_RISK_TENCENT_JOB_TYPES = new Set(['account_ad_clear'])

export const JOB_STATUS_META: Record<
  string,
  { label: string; className: string; dotClassName: string }
> = {
  pending: {
    label: '排队中',
    className: 'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dotClassName: 'bg-slate-400'
  },
  running: {
    label: '执行中',
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300',
    dotClassName: 'bg-blue-500'
  },
  success: {
    label: '成功',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    dotClassName: 'bg-emerald-500'
  },
  partial: {
    label: '部分成功',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dotClassName: 'bg-amber-500'
  },
  failed: {
    label: '失败',
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
    dotClassName: 'bg-destructive'
  },
  cancelled: {
    label: '已取消',
    className: 'border-muted bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground'
  }
}

export const JOB_STEP_ORDER = [
  { key: 'pending', label: '排队' },
  { key: 'validating', label: '校验' },
  { key: 'executing', label: '执行' },
  { key: 'summarizing', label: '汇总' },
  { key: 'done', label: '完成' }
] as const

export function getJobStatusMeta(status: string) {
  return (
    JOB_STATUS_META[status] || {
      label: status,
      className: 'border-border bg-muted text-muted-foreground',
      dotClassName: 'bg-muted-foreground'
    }
  )
}

export function getTencentJobTypeLabel(jobType: string): string {
  const map: Record<string, string> = {
    auto_acquisition: '一键起量',
    account_remark: '修改备注标签',
    account_ad_clear: '账户广告清空',
    rta_modify: '修改 RTA',
    schedule_management: '修改投放时间',
    material_extraction: '有量素材提取',
    conversion_attribution: '转化归因',
    batch_modify_bids: '广告出价修改 · 最大转化量',
    normal_bid_modify: '广告出价修改 · 常规出价',
    smart_target_modify: '广告出价修改 · 智投目标'
  }
  return map[jobType] || jobType
}

export function formatJobTime(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return '-'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms)) return '-'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  return `${day} 天前`
}

export function getCreatorLabel(job: TencentBatchAssistantJobItem): string {
  const displayName = job.creator_name || job.creator_username || `用户 #${job.user_id}`
  if (job.creator_username && job.creator_name) {
    return `${displayName}（${job.creator_username}）`
  }
  return displayName
}

export function getJobRunningMinutes(
  job: Pick<TencentBatchAssistantJobItem, 'status' | 'started_at'>
): number | null {
  if (job.status !== 'running' || !job.started_at) return null
  const startedAtMs = new Date(job.started_at).getTime()
  if (!Number.isFinite(startedAtMs)) return null
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 60000))
}

export function isJobPossiblyStuck(
  job: Pick<TencentBatchAssistantJobItem, 'status' | 'started_at'>
): boolean {
  const runningMinutes = getJobRunningMinutes(job)
  return runningMinutes !== null && runningMinutes >= STALE_RUNNING_JOB_THRESHOLD_MINUTES
}

export function getRecoverActionLabel(jobType: string): string {
  return HIGH_RISK_TENCENT_JOB_TYPES.has(jobType) ? '标记失败' : '重新入队'
}

export function canRetryJob(status: string): boolean {
  return status === 'partial' || status === 'failed' || status === 'cancelled'
}

export function getActiveStepIndex(job: TencentBatchAssistantJobItem): number {
  if (['success', 'partial', 'failed', 'cancelled'].includes(job.status)) {
    return JOB_STEP_ORDER.length - 1
  }
  const step = job.current_step || 'pending'
  if (step === 'running') return 2
  const idx = JOB_STEP_ORDER.findIndex((s) => s.key === step)
  return idx >= 0 ? idx : 1
}

export function countJobsByBucket(jobs: TencentBatchAssistantJobItem[]) {
  return {
    pending: jobs.filter((j) => j.status === 'pending').length,
    running: jobs.filter((j) => j.status === 'running').length,
    attention: jobs.filter((j) => j.status === 'failed' || j.status === 'partial').length,
    cancelled: jobs.filter((j) => j.status === 'cancelled').length,
    active: jobs.filter((j) => j.status === 'pending' || j.status === 'running').length
  }
}

export function matchesStatusFilter(
  job: TencentBatchAssistantJobItem,
  statusFilter: JobStatusFilter
): boolean {
  if (statusFilter === 'all') return true
  if (statusFilter === 'active') {
    return job.status === 'pending' || job.status === 'running'
  }
  if (statusFilter === 'attention') {
    return job.status === 'failed' || job.status === 'partial'
  }
  return job.status === statusFilter
}

export function filterJobsLocally(
  jobs: TencentBatchAssistantJobItem[],
  statusFilter: JobStatusFilter,
  searchQuery: string
): TencentBatchAssistantJobItem[] {
  let list = jobs
  if (statusFilter !== 'all') {
    list = list.filter((j) => matchesStatusFilter(j, statusFilter))
  }
  const q = searchQuery.trim().toLowerCase()
  if (!q) return list
  return list.filter((j) => {
    const typeText = getTencentJobTypeLabel(j.job_type).toLowerCase()
    return String(j.id).includes(q) || typeText.includes(q)
  })
}

export function jobStatusToApiParam(
  filter: JobStatusFilter
): TencentBatchAssistantJobStatus | undefined {
  if (filter === 'all' || filter === 'active' || filter === 'attention') return undefined
  return filter
}

export type JobListTab = 'all' | 'active' | 'failed' | 'cancelled'

export function tabToStatusFilter(tab: JobListTab): JobStatusFilter {
  if (tab === 'active') return 'active'
  if (tab === 'failed') return 'failed'
  if (tab === 'cancelled') return 'cancelled'
  return 'all'
}

export interface AccountResultItem {
  account_id?: string
  advertiser_id?: string
  success?: boolean
  success_count?: number
  error_count?: number
  auto_projects_processed?: number
  manual_projects_processed?: number
  adgroups_processed?: number
  adgroup_count?: number
  errors?: string[]
  error?: string
  message?: string
}

const ACCOUNT_RESULT_ARRAY_KEYS = ['account_results', 'results', 'details', 'items'] as const

function pickAccountResultArray(source: Record<string, unknown>): AccountResultItem[] {
  for (const key of ACCOUNT_RESULT_ARRAY_KEYS) {
    const value = source[key]
    if (Array.isArray(value) && value.length > 0) {
      return value as AccountResultItem[]
    }
  }
  return []
}

export function extractAccountResults(
  result: Record<string, unknown> | null | undefined
): AccountResultItem[] {
  if (!result) return []
  const data = (result.data as Record<string, unknown>) || result
  const fromData = pickAccountResultArray(data)
  if (fromData.length > 0) return fromData
  if (data !== result) {
    return pickAccountResultArray(result)
  }
  return []
}

export function getAccountResultId(item: AccountResultItem, fallback: string | number): string {
  return String(item.account_id ?? item.advertiser_id ?? fallback)
}

export function isAccountResultFailed(item: AccountResultItem): boolean {
  if (item.error_count != null) return (item.error_count ?? 0) > 0
  if (item.success === false) return true
  if (item.success === true) return false
  if (item.error) return true
  return Array.isArray(item.errors) && item.errors.some(Boolean)
}

export function getAccountResultErrors(item: AccountResultItem): string[] {
  const fromArray = Array.isArray(item.errors) ? item.errors.filter(Boolean) : []
  if (fromArray.length > 0) return fromArray
  if (item.error) return [item.error]
  if (item.message && isAccountResultFailed(item)) return [item.message]
  return []
}

export function formatAccountResultSuccessMessage(item: AccountResultItem): string {
  const parts: string[] = []
  if (item.success_count != null && item.success_count > 0) {
    parts.push(`成功 ${item.success_count} 项`)
  }
  if (item.manual_projects_processed != null && item.manual_projects_processed > 0) {
    parts.push(`手动项目 ${item.manual_projects_processed}`)
  }
  if (item.auto_projects_processed != null && item.auto_projects_processed > 0) {
    parts.push(`自动项目 ${item.auto_projects_processed}`)
  }
  if (item.adgroups_processed != null && item.adgroups_processed > 0) {
    parts.push(`广告组 ${item.adgroups_processed}`)
  }
  if (item.adgroup_count != null && item.adgroup_count > 0) {
    parts.push(`营销单元 ${item.adgroup_count}`)
  }
  return parts.length > 0 ? parts.join(' · ') : '执行成功'
}

export function formatAccountResultErrorMessage(item: AccountResultItem): string {
  const errors = getAccountResultErrors(item)
  const prefix =
    item.error_count != null && item.error_count > 0 ? `失败 ${item.error_count} 项: ` : ''
  if (errors.length > 0) return `${prefix}${errors.join('; ')}`
  return item.error || item.message || '执行失败'
}

export type TencentJobListMeta = {
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}
