import type { PAssistantJobDetailResponse } from '../../../services/ocean-engine.service'

export type PAssistantRetryMode = 'all' | 'failed_only'

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

export const HIGH_RISK_P_ASSISTANT_JOB_TYPES = new Set([
  'ad_cleanup_delete',
  'project_cleanup_delete',
  'material_cleanup',
  'empty_project_cleanup',
  'clear_materials',
  'project_boost',
  'batch_modify_bids'
])

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
    label: '已停止',
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

export function getPAssistantJobTypeText(jobType: string): string {
  const map: Record<string, string> = {
    rta_bind: 'RTA策略绑定',
    rta_check: 'RTA绑定检查',
    remark_modify: '批量修改备注',
    tag_modify: '批量修改标签',
    clear_materials: '清空账户素材',
    asset_share: '资产共享',
    material_share: '素材共享',
    batch_modify_bids: '深度出价修改',
    project_boost: '项目起量',
    project_budget_modify: '项目预算修改',
    account_bidding_budget_modify: '账户预算修改',
    project_roi_modify: '项目ROI修改',
    account_name_modify: '账户名称修改',
    project_toggle: '项目启停',
    unit_schedule_batch: '单元预约投放',
    ad_cleanup_preview: '广告清理预览',
    ad_cleanup_delete: '广告清理',
    project_cleanup_preview: '项目清理预览',
    project_cleanup_delete: '项目清理',
    material_cleanup: '在投素材清理',
    empty_project_cleanup: '空项目清理',
    account_avatar_batch: '账户头像设置'
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

export function getCreatorLabel(job: PAssistantJobDetailResponse): string {
  const displayName = job.creator_name || job.creator_username || `用户 #${job.user_id}`
  if (job.creator_username && job.creator_name) {
    return `${displayName}（${job.creator_username}）`
  }
  return displayName
}

export function getJobRunningMinutes(
  job: Pick<PAssistantJobDetailResponse, 'status' | 'started_at'>
): number | null {
  if (job.status !== 'running' || !job.started_at) return null
  const startedAtMs = new Date(job.started_at).getTime()
  if (!Number.isFinite(startedAtMs)) return null
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 60000))
}

export function isJobPossiblyStuck(
  job: Pick<PAssistantJobDetailResponse, 'status' | 'started_at'>
): boolean {
  const runningMinutes = getJobRunningMinutes(job)
  return runningMinutes !== null && runningMinutes >= STALE_RUNNING_JOB_THRESHOLD_MINUTES
}

export function getRecoverActionLabel(jobType: string): string {
  return HIGH_RISK_P_ASSISTANT_JOB_TYPES.has(jobType) ? '标记失败' : '重新入队'
}

export function canRetryJob(status: string): boolean {
  return status === 'partial' || status === 'failed' || status === 'cancelled'
}

export function getActiveStepIndex(job: PAssistantJobDetailResponse): number {
  if (['success', 'partial', 'failed', 'cancelled'].includes(job.status)) {
    return JOB_STEP_ORDER.length - 1
  }
  const step = job.current_step || 'pending'
  if (step === 'running') return 2
  const idx = JOB_STEP_ORDER.findIndex((s) => s.key === step)
  return idx >= 0 ? idx : 1
}

export function countJobsByBucket(jobs: PAssistantJobDetailResponse[]) {
  return {
    pending: jobs.filter((j) => j.status === 'pending').length,
    running: jobs.filter((j) => j.status === 'running').length,
    attention: jobs.filter((j) => j.status === 'failed' || j.status === 'partial').length,
    cancelled: jobs.filter((j) => j.status === 'cancelled').length,
    active: jobs.filter((j) => j.status === 'pending' || j.status === 'running').length
  }
}

export function matchesStatusFilter(
  job: PAssistantJobDetailResponse,
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
  jobs: PAssistantJobDetailResponse[],
  statusFilter: JobStatusFilter,
  searchQuery: string
): PAssistantJobDetailResponse[] {
  let list = jobs
  if (statusFilter !== 'all') {
    list = list.filter((j) => matchesStatusFilter(j, statusFilter))
  }
  const q = searchQuery.trim().toLowerCase()
  if (!q) return list
  return list.filter((j) => {
    const typeText = getPAssistantJobTypeText(j.job_type).toLowerCase()
    return String(j.id).includes(q) || typeText.includes(q)
  })
}

export function jobStatusToApiParam(
  filter: JobStatusFilter
): 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled' | undefined {
  if (filter === 'all' || filter === 'active' || filter === 'attention') return undefined
  return filter
}

/** 顶栏 Tab：全部 | 进行中 | 失败 | 已停止 */
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
  errors?: string[]
  error?: string
}

export function extractAccountResults(
  result: Record<string, unknown> | null | undefined
): AccountResultItem[] {
  if (!result) return []
  const data = (result.data as Record<string, unknown>) || result
  for (const key of ['account_results', 'results', 'details', 'items']) {
    const value = data[key]
    if (Array.isArray(value)) return value as AccountResultItem[]
  }
  return []
}
