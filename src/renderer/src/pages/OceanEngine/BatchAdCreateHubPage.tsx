import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  Filter,
  Loader2,
  Megaphone,
  Pause,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input
} from '../../components/ui'
import {
  oceanEngineBatchAdService,
  type BatchCreateJobDetailResponse,
  type BatchCreateJobListItem,
  type OceanEngineBatchCreateAdsRequest
} from '../../services/ocean-engine.service'
import { BatchAdCreateWorkbench } from './BatchAdCreateWorkbench'
import { CreateResultCard } from './components/CreateResultCard'
import {
  batchCreateStatusBadgeClass,
  formatBatchCreateJobStatusZh,
  formatScheduledAtDisplay,
  isScheduledPending,
  parseShanghaiNaiveMs
} from './batch-ad-create-schedule'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const
const DEFAULT_PAGE_SIZE = 20
const POLL_ACTIVE_MS = 4000
const POLL_IDLE_MS = 15000
const POLL_SCHEDULED_SOON_MS = 8000
const SCHEDULED_SOON_MS = 5 * 60 * 1000

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'scheduled', label: '定时待执行' },
  { value: 'queued', label: '排队中' },
  { value: 'pending', label: '待执行（全部）' },
  { value: 'running', label: '执行中' },
  { value: 'success', label: '成功' },
  { value: 'partial', label: '部分成功' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' }
]

const FILTER_SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function getStatusFilterLabel(value: string): string {
  return STATUS_FILTER_OPTIONS.find((opt) => opt.value === value)?.label ?? value
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

/** 部分成功 / 失败任务可发起「失败重试」入队 */
function canRetryBatchCreateJobStatus(status: string): boolean {
  return status === 'partial' || status === 'failed'
}

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatProgress(ok: number | null | undefined, total: number | null | undefined): string {
  if (total == null) return '—'
  const okVal = ok ?? 0
  return `${okVal}/${total}`
}

function isPendingLikeProgress(row: BatchCreateJobListItem): boolean {
  return (
    row.status === 'pending' ||
    row.status === 'running' ||
    (row.status === 'cancelled' &&
      (row.success_project_count ?? 0) === 0 &&
      (row.total_project_count ?? 0) > 0)
  )
}

function buildPaginationPages(currentPage: number, totalPages: number): (number | '...')[] {
  const total = Math.max(1, totalPages)
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (currentPage <= 4) {
    for (let i = 2; i <= 5; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  } else if (currentPage >= total - 3) {
    pages.push('...')
    for (let i = total - 4; i <= total; i++) pages.push(i)
  } else {
    pages.push('...')
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  }

  return pages
}

const BatchJobConfigSnapshot: React.FC<{ payload: OceanEngineBatchCreateAdsRequest }> = ({
  payload
}) => {
  const advertiserIds = payload.advertiser_ids ?? []
  const orgAdvertiserIds = payload.org_advertiser_ids ?? []
  const projectName = typeof payload.project?.name === 'string' ? payload.project.name : ''
  const dramaName = payload.draft_drama_name?.trim()
  const customPromotionGroups = payload.promotions_by_advertiser
    ? Object.keys(payload.promotions_by_advertiser).length
    : 0

  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">配置快照</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            入队时保存的任务配置，可用于确认本任务包含的账户。
          </p>
        </div>
        <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {advertiserIds.length} 个账户
        </span>
      </div>

      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <div className="mb-1 font-medium text-foreground">投放账户 ID</div>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border/50 bg-background/70 p-2">
            {advertiserIds.length ? (
              advertiserIds.map((id) => (
                <span
                  key={id}
                  className="rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 font-mono text-foreground"
                >
                  {id}
                </span>
              ))
            ) : (
              <span>未记录</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 font-medium text-foreground">纵横组织 ID</div>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border/50 bg-background/70 p-2">
            {orgAdvertiserIds.length ? (
              orgAdvertiserIds.map((id) => (
                <span
                  key={id}
                  className="rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 font-mono text-foreground"
                >
                  {id}
                </span>
              ))
            ) : (
              <span>未记录</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-background/70 p-2">
          <div className="mb-1">项目名称</div>
          <div className="line-clamp-2 font-medium text-foreground">{projectName || '未记录'}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/70 p-2">
          <div className="mb-1">漫剧名称</div>
          <div className="line-clamp-2 font-medium text-foreground">{dramaName || '未记录'}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/70 p-2">
          <div className="mb-1">默认单元</div>
          <div className="font-medium text-foreground">{payload.promotions?.length ?? 0} 个</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/70 p-2">
          <div className="mb-1">账户自定义单元</div>
          <div className="font-medium text-foreground">{customPromotionGroups} 组</div>
        </div>
      </div>
    </div>
  )
}

export const BatchAdCreateHubPage: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE)
  const [items, setItems] = useState<BatchCreateJobListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<BatchCreateJobDetailResponse | null>(null)
  const [reusePayload, setReusePayload] = useState<OceanEngineBatchCreateAdsRequest | null>(null)
  const [reuseJobId, setReuseJobId] = useState<number | null>(null)
  const [resubmitJobId, setResubmitJobId] = useState<number | null>(null)
  const [workbenchMountKey, setWorkbenchMountKey] = useState(0)
  const [copyingJobId, setCopyingJobId] = useState<number | null>(null)
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null)
  const [cancellingJobId, setCancellingJobId] = useState<number | null>(null)
  const [jumpToPage, setJumpToPage] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [advertiserIdInput, setAdvertiserIdInput] = useState('')
  const [advertiserIdFilter, setAdvertiserIdFilter] = useState('')
  const [creatorOptions, setCreatorOptions] = useState<
    { user_id: number; user_name?: string | null }[]
  >([])

  const hasActiveFilters = Boolean(
    statusFilter || userFilter || keywordFilter || advertiserIdFilter
  )

  const loadList = useCallback(
    async (
      p: number,
      size: number,
      status: string,
      filterUserId: string,
      keyword: string,
      advertiserId: string
    ) => {
      setLoading(true)
      try {
        const parsedUserId = filterUserId.trim() === '' ? undefined : parseInt(filterUserId, 10)
        const res = await oceanEngineBatchAdService.listBatchCreateJobs({
          page: p,
          page_size: size,
          status: status || undefined,
          user_id:
            isAdmin && parsedUserId != null && !Number.isNaN(parsedUserId)
              ? parsedUserId
              : undefined,
          keyword: keyword.trim() || undefined,
          advertiser_id: advertiserId.trim() || undefined
        })
        setItems(res.items)
        setTotal(res.meta.total)
        setTotalPages(res.meta.total_pages)
        setPage(res.meta.page)
      } catch (e) {
        toast.error(getApiErrorMessage(e, '加载任务列表失败'))
      } finally {
        setLoading(false)
      }
    },
    [isAdmin]
  )

  const hasActiveJobs = useMemo(
    () => items.some((r) => r.status === 'pending' || r.status === 'running'),
    [items]
  )

  const hasScheduledSoonJobs = useMemo(
    () =>
      items.some((r) => {
        if (!isScheduledPending(r.status, r.scheduled_at)) return false
        const t = parseShanghaiNaiveMs(r.scheduled_at)
        return t - Date.now() <= SCHEDULED_SOON_MS
      }),
    [items]
  )

  const resetFilters = (): void => {
    setStatusFilter('')
    setUserFilter('')
    setKeywordInput('')
    setKeywordFilter('')
    setAdvertiserIdInput('')
    setAdvertiserIdFilter('')
    setPage(1)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeywordFilter(keywordInput.trim())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [keywordInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdvertiserIdFilter(advertiserIdInput.trim())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [advertiserIdInput])

  useEffect(() => {
    if (!isAdmin) return
    void oceanEngineBatchAdService
      .listBatchCreateJobCreators()
      .then(setCreatorOptions)
      .catch(() => {
        /* 非管理员或加载失败时忽略 */
      })
  }, [isAdmin])

  useEffect(() => {
    void loadList(1, pageSize, statusFilter, userFilter, keywordFilter, advertiserIdFilter)
  }, [statusFilter, userFilter, keywordFilter, advertiserIdFilter])

  useEffect(() => {
    const h = searchParams.get('highlight')
    const c = searchParams.get('create')
    if (h) {
      const n = parseInt(h, 10)
      if (!Number.isNaN(n)) {
        setHighlightId(n)
        const next = new URLSearchParams(searchParams)
        next.delete('highlight')
        setSearchParams(next, { replace: true })
      }
    }
    if (c === '1') {
      setReusePayload(null)
      setReuseJobId(null)
      setWorkbenchMountKey((k) => k + 1)
      setCreateOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('create')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (highlightId == null) return undefined
    const t = window.setTimeout(() => setHighlightId(null), 10000)
    return () => window.clearTimeout(t)
  }, [highlightId])

  useEffect(() => {
    const intervalMs = hasActiveJobs
      ? POLL_ACTIVE_MS
      : hasScheduledSoonJobs
        ? POLL_SCHEDULED_SOON_MS
        : POLL_IDLE_MS
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void loadList(page, pageSize, statusFilter, userFilter, keywordFilter, advertiserIdFilter)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [
    hasActiveJobs,
    hasScheduledSoonJobs,
    loadList,
    page,
    pageSize,
    statusFilter,
    userFilter,
    keywordFilter,
    advertiserIdFilter
  ])

  const openDetail = async (jobId: number): Promise<void> => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const d = await oceanEngineBatchAdService.getBatchCreateJob(jobId)
      setDetail(d)
    } catch (e) {
      toast.error(getApiErrorMessage(e, '加载详情失败'))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const onManualEnqueued = (jobId: number): void => {
    setCreateOpen(false)
    setReusePayload(null)
    setReuseJobId(null)
    setResubmitJobId(null)
    setHighlightId(jobId)
    setPage(1)
    void loadList(1, pageSize, statusFilter, userFilter, keywordFilter, advertiserIdFilter)
  }

  const retryFailedAccounts = async (jobId: number): Promise<void> => {
    setRetryingJobId(jobId)
    try {
      const { job_id } = await oceanEngineBatchAdService.retryFailedBatchCreateJob(jobId)
      toast.success(`任务 #${job_id} 已重新入队，正在重试失败的项目或广告单元（同一任务记录）`)
      setHighlightId(job_id)
      void loadList(page, pageSize, statusFilter, userFilter, keywordFilter, advertiserIdFilter)
    } catch (e) {
      toast.error(getApiErrorMessage(e, '重试失败'))
    } finally {
      setRetryingJobId(null)
    }
  }

  const cancelPendingJob = async (jobId: number): Promise<void> => {
    setCancellingJobId(jobId)
    try {
      const res = await oceanEngineBatchAdService.cancelBatchCreateJob(jobId)
      toast.success(res.message || '任务已暂停')
      setHighlightId(jobId)
      void loadList(page, pageSize, statusFilter, userFilter, keywordFilter, advertiserIdFilter)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '暂停任务失败')
    } finally {
      setCancellingJobId(null)
    }
  }

  const openNewCreateDialog = (): void => {
    setReusePayload(null)
    setReuseJobId(null)
    setResubmitJobId(null)
    setCreateOpen(true)
  }

  const copyJobIntoNew = async (jobId: number): Promise<void> => {
    setCopyingJobId(jobId)
    try {
      const d = await oceanEngineBatchAdService.getBatchCreateJob(jobId)
      if (!d.payload) {
        toast.error('该任务没有可复用的配置快照')
        return
      }
      setReusePayload(d.payload)
      setReuseJobId(jobId)
      setResubmitJobId(null)
      setWorkbenchMountKey((k) => k + 1)
      setCreateOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载任务配置失败')
    } finally {
      setCopyingJobId(null)
    }
  }

  const effectiveTotalPages = Math.max(1, totalPages)

  const goToPage = (targetPage: number): void => {
    const p = Math.min(Math.max(1, targetPage), effectiveTotalPages)
    if (p === page) return
    void loadList(p, pageSize, statusFilter, userFilter, keywordFilter, advertiserIdFilter)
  }

  const handleJumpToPage = (): void => {
    const n = parseInt(jumpToPage, 10)
    if (Number.isNaN(n)) return
    goToPage(n)
    setJumpToPage('')
  }

  const editCancelledJob = async (jobId: number): Promise<void> => {
    setCopyingJobId(jobId)
    try {
      const d = await oceanEngineBatchAdService.getBatchCreateJob(jobId)
      if (d.status !== 'cancelled') {
        toast.error('仅已暂停的任务可编辑后重新提交')
        return
      }
      if (!d.payload) {
        toast.error('该任务没有可编辑的配置快照')
        return
      }
      setReusePayload(d.payload)
      setReuseJobId(jobId)
      setResubmitJobId(jobId)
      setWorkbenchMountKey((k) => k + 1)
      setCreateOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载任务配置失败')
    } finally {
      setCopyingJobId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 滚动列表时固定在内容区右上角，不随长列表上移消失 */}
      <div
        className={cn(
          'sticky top-0 z-30 flex flex-wrap items-center justify-end gap-2',
          '-mx-3 px-3 py-2 sm:-mx-0 sm:px-0 sm:pb-3',
          'border-b border-border/50 bg-background/95 backdrop-blur-md'
        )}
      >
        <Button
          type="button"
          onClick={() =>
            void loadList(
              page,
              pageSize,
              statusFilter,
              userFilter,
              keywordFilter,
              advertiserIdFilter
            )
          }
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
        <Button type="button" onClick={openNewCreateDialog}>
          <Plus className="w-4 h-4 mr-1" />
          批量新建
        </Button>
      </div>

      <motion.section
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)] sm:p-8"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_58%)]" />
        <div className="relative flex flex-col gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              手动批量创建 · 任务队列
            </div>
            <div className="flex gap-3 items-start">
              <div className="p-3 rounded-2xl border border-border/70 bg-background/70">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">广告批量创建</h1>
                <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                  「批量新建」会打开 5 步配置面板（准备 → 账户 → 项目 → 素材 →
                  提交），提交后进入任务队列。 列表会定时刷新。
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <CardDescription className="space-y-1">
            <span>
              仅包含手动入队任务（异步 Worker 执行）。共 {total} 条
              {hasActiveJobs ? ' · 有进行中任务，刷新较快' : ''}。
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              筛选
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="batch-job-keyword" className="text-xs text-muted-foreground">
                  项目名称
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="batch-job-keyword"
                    value={keywordInput}
                    onChange={(e) => {
                      setKeywordInput(e.target.value)
                      setPage(1)
                    }}
                    placeholder="搜索摘要中的项目名称…"
                    className="h-9 pl-9 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="batch-job-advertiser-id" className="text-xs text-muted-foreground">
                  账户 ID
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="batch-job-advertiser-id"
                    value={advertiserIdInput}
                    onChange={(e) => {
                      setAdvertiserIdInput(e.target.value.replace(/\D/g, ''))
                      setPage(1)
                    }}
                    placeholder="精确匹配账户 ID…"
                    className="h-9 pl-9 text-sm"
                    disabled={loading}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[22rem] lg:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="batch-job-status" className="text-xs text-muted-foreground">
                    状态
                  </label>
                  <select
                    id="batch-job-status"
                    className={FILTER_SELECT_CLASS}
                    value={statusFilter}
                    disabled={loading}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setPage(1)
                    }}
                  >
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isAdmin ? (
                  <div className="space-y-1.5">
                    <label htmlFor="batch-job-user" className="text-xs text-muted-foreground">
                      创建用户
                    </label>
                    <select
                      id="batch-job-user"
                      className={FILTER_SELECT_CLASS}
                      value={userFilter}
                      disabled={loading}
                      onChange={(e) => {
                        setUserFilter(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="">全部用户</option>
                      {creatorOptions.map((opt) => (
                        <option key={opt.user_id} value={String(opt.user_id)}>
                          {opt.user_name ?? '用户'}({opt.user_id})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="hidden lg:block" aria-hidden />
                )}
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={loading}
                  onClick={resetFilters}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  清空
                </Button>
              ) : null}
            </div>
            {hasActiveFilters ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
                <span className="text-xs text-muted-foreground">当前：</span>
                {keywordFilter ? (
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs">
                    关键词「{keywordFilter}」
                  </span>
                ) : null}
                {advertiserIdFilter ? (
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs">
                    账户 ID「{advertiserIdFilter}」
                  </span>
                ) : null}
                {statusFilter ? (
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs">
                    {getStatusFilterLabel(statusFilter)}
                  </span>
                ) : null}
                {isAdmin && userFilter ? (
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs">
                    用户 #{userFilter}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {loading && items.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              加载中…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {hasActiveFilters ? '暂无符合筛选条件的任务。' : '暂无任务，点击上方新建。'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="p-3 text-left font-medium">任务信息</th>
                    <th className="w-[7rem] p-3 text-left font-medium whitespace-nowrap">状态</th>
                    <th className="w-[9rem] p-3 text-left font-medium whitespace-nowrap">进度</th>
                    <th className="w-[14rem] p-3 text-left font-medium whitespace-nowrap">时间</th>
                    <th className="sticky right-0 z-10 w-[8.5rem] border-l border-border/40 bg-muted p-3 text-right font-medium whitespace-nowrap shadow-[-16px_0_22px_-18px_rgba(15,23,42,0.75)] before:pointer-events-none before:absolute before:inset-y-0 before:left-[-12px] before:w-3 before:bg-gradient-to-l before:from-muted before:to-transparent">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'group border-b transition-colors last:border-0 hover:bg-muted/25',
                        highlightId === row.id &&
                          'bg-primary/10 ring-1 ring-primary/30 hover:bg-primary/10'
                      )}
                    >
                      <td className="min-w-0 p-3 align-top">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-mono text-foreground">#{row.id}</span>
                            <span className="text-border">·</span>
                            <span title={`${row.user_name ?? '用户'}(${row.user_id})`}>
                              {row.user_name ?? '用户'}({row.user_id})
                            </span>
                          </div>

                          <div className="space-y-1">
                            {row.first_project_name ? (
                              <div
                                className="line-clamp-2 max-w-[34rem] text-sm font-medium leading-6 text-foreground"
                                title={row.first_project_name}
                              >
                                {row.first_project_name}
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-muted-foreground">
                                未记录项目名称
                              </div>
                            )}
                            <div
                              className="line-clamp-2 max-w-[34rem] text-xs leading-5 text-muted-foreground"
                              title={row.summary ?? undefined}
                            >
                              {row.summary ?? '暂无摘要'}
                            </div>
                          </div>

                          {row.error_message && (
                            <div
                              className="line-clamp-2 max-w-[34rem] rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs leading-5 text-destructive"
                              title={row.error_message}
                            >
                              {row.error_message}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 align-top whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap',
                            batchCreateStatusBadgeClass(row.status, row.scheduled_at)
                          )}
                        >
                          {formatBatchCreateJobStatusZh(row.status, row.scheduled_at)}
                        </span>
                      </td>
                      <td className="p-3 align-top text-xs tabular-nums whitespace-nowrap">
                        <div className="space-y-1.5 text-muted-foreground">
                          <div
                            className="flex items-center justify-between gap-3"
                            title={
                              isPendingLikeProgress(row)
                                ? '预计/已完成项目数（未执行完时为预计）'
                                : undefined
                            }
                          >
                            <span>项目</span>
                            <span className="font-medium text-foreground">
                              {formatProgress(row.success_project_count, row.total_project_count)}
                            </span>
                          </div>
                          <div
                            className="flex items-center justify-between gap-3"
                            title={
                              isPendingLikeProgress(row)
                                ? '预计/已完成单元数（未执行完时为预计）'
                                : undefined
                            }
                          >
                            <span>单元</span>
                            <span className="font-medium text-foreground">
                              {formatProgress(
                                row.success_promotion_count,
                                row.total_promotion_count
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>尝试</span>
                            <span className="font-medium text-foreground">
                              {row.attempt_count}/{row.max_attempts}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 align-top text-xs whitespace-nowrap">
                        <div className="space-y-1.5 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="w-8 shrink-0">创建</span>
                            <span className="text-foreground">{formatDt(row.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-8 shrink-0">计划</span>
                            <span className="text-foreground">
                              {formatScheduledAtDisplay(row.scheduled_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-8 shrink-0">完成</span>
                            <span className="text-foreground">{formatDt(row.finished_at)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="sticky right-0 z-10 w-[8.5rem] border-l border-border/40 bg-card p-3 align-top shadow-[-16px_0_22px_-18px_rgba(15,23,42,0.75)] transition-colors group-hover:bg-muted/25 before:pointer-events-none before:absolute before:inset-y-0 before:left-[-12px] before:w-3 before:bg-gradient-to-l before:from-card before:to-transparent group-hover:before:from-muted/25">
                        <div className="flex flex-nowrap justify-end gap-1 whitespace-nowrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0"
                            title="查看详情"
                            aria-label={`查看任务 #${row.id} 详情`}
                            onClick={() => void openDetail(row.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0"
                            title="复制配置"
                            aria-label={`复制任务 #${row.id} 配置`}
                            disabled={copyingJobId === row.id}
                            onClick={() => void copyJobIntoNew(row.id)}
                          >
                            {copyingJobId === row.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          {row.status === 'cancelled' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 border-blue-300 text-blue-700 hover:bg-blue-100/60 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30"
                              title="编辑并重新提交"
                              aria-label={`编辑任务 #${row.id} 并重新提交`}
                              disabled={copyingJobId === row.id}
                              onClick={() => void editCancelledJob(row.id)}
                            >
                              {copyingJobId === row.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Edit3 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {row.status === 'pending' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 border-slate-300 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900/40"
                              title="暂停任务"
                              aria-label={`暂停任务 #${row.id}`}
                              disabled={cancellingJobId === row.id}
                              onClick={() => void cancelPendingJob(row.id)}
                            >
                              {cancellingJobId === row.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Pause className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {canRetryBatchCreateJobStatus(row.status) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 border-amber-300 text-amber-800 hover:bg-amber-100/60 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
                              title="重试失败项"
                              aria-label={`重试任务 #${row.id} 失败项`}
                              disabled={retryingJobId === row.id}
                              onClick={() => void retryFailedAccounts(row.id)}
                            >
                              {retryingJobId === row.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-muted-foreground">
                共 {total} 条 · 第 {page} / {effectiveTotalPages} 页
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={page <= 1 || loading}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {buildPaginationPages(page, effectiveTotalPages).map((p, index) =>
                  p === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-xs text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={p}
                      type="button"
                      variant={page === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 min-w-8 px-2 text-xs"
                      disabled={loading}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </Button>
                  )
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={page >= effectiveTotalPages || loading}
                  onClick={() => goToPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>每页</span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={pageSize}
                    disabled={loading}
                    onChange={(e) => {
                      const next = Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                      setPageSize(next)
                      setPage(1)
                      void loadList(
                        1,
                        next,
                        statusFilter,
                        userFilter,
                        keywordFilter,
                        advertiserIdFilter
                      )
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} 条
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">跳转</span>
                  <Input
                    type="number"
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
                    placeholder="页码"
                    className="h-8 w-16 text-xs"
                    min={1}
                    max={effectiveTotalPages}
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={loading}
                    onClick={handleJumpToPage}
                  >
                    跳转
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setReusePayload(null)
            setReuseJobId(null)
            setResubmitJobId(null)
          }
        }}
      >
        <DialogContent
          forceMount
          className={cn(
            'max-w-[min(1200px,96vw)] w-full max-h-[92vh] flex flex-col gap-4 overflow-hidden',
            'top-[50%] translate-y-[-50%]'
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 pr-10 text-left sm:text-left">
            <DialogTitle>
              {resubmitJobId != null
                ? `编辑暂停任务 #${resubmitJobId} · 重新提交`
                : reuseJobId != null
                  ? `复制任务 #${reuseJobId} · 自定义编辑`
                  : '批量新建'}
            </DialogTitle>
            <DialogDescription>
              {resubmitJobId != null
                ? '已将暂停任务配置带入编辑表单，提交后会更新当前任务并重新进入队列。'
                : reuseJobId != null
                  ? '已将历史任务配置带入编辑表单，可调整组织、Cookie、项目、单元与素材后提交。'
                  : '按步骤完成配置，提交后进入任务队列。'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pt-0">
            <BatchAdCreateWorkbench
              key={workbenchMountKey}
              embedMode
              onManualJobEnqueued={onManualEnqueued}
              reuseBatchRequest={reusePayload}
              reuseSourceJobId={reuseJobId}
              resubmitTargetJobId={resubmitJobId}
              onReuseDraftClear={() => {
                setReusePayload(null)
                setReuseJobId(null)
                setResubmitJobId(null)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[min(900px,92vw)] max-h-[88vh] flex flex-col gap-4 overflow-hidden">
          <DialogHeader className="shrink-0 pr-10 text-left sm:text-left">
            <DialogTitle>任务详情 {detail ? `#${detail.id}` : ''}</DialogTitle>
            <DialogDescription>
              {detail && (
                <>
                  状态{' '}
                  <strong>
                    {formatBatchCreateJobStatusZh(detail.status, detail.scheduled_at)}
                  </strong>
                  {detail.scheduled_at && (
                    <> · 计划执行 {formatScheduledAtDisplay(detail.scheduled_at)}</>
                  )}
                  {detail.error_message && ` · ${detail.error_message}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {detail?.payload ? <BatchJobConfigSnapshot payload={detail.payload} /> : null}
                {detail?.result?.account_results?.length ? (
                  <div className="mt-4">
                    <CreateResultCard results={detail.result.account_results} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-6">
                    {detail?.status === 'pending' || detail?.status === 'running'
                      ? isScheduledPending(detail.status, detail.scheduled_at)
                        ? '任务已预约，到计划时间后由调度进程执行。'
                        : '任务尚未执行完成，请稍后刷新列表。'
                      : '暂无账户级结果。'}
                  </p>
                )}
                {detail && canRetryBatchCreateJobStatus(detail.status) && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      点击下方「重试」将在同一任务上重新入队：项目创建失败的账户会整账户重跑；项目已成功但广告单元失败的账户会使用已创建的
                      project_id 仅重跑失败单元，结果合并到本任务。
                    </p>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        title="同一任务重试失败的项目或广告单元，结果合并到本条"
                        disabled={retryingJobId === detail.id}
                        onClick={() => void retryFailedAccounts(detail.id)}
                      >
                        {retryingJobId === detail.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 mr-2" />
                        )}
                        重试
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
