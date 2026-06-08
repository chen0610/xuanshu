import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, RefreshCw, Search, X } from 'lucide-react'
import {
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger
} from '../../../components/ui'
import {
  pAssistantServiceExtended,
  type PAssistantJobDetailResponse,
  type PAssistantJobEventResponse,
  type PAssistantJobListMeta
} from '../../../services/ocean-engine.service'
import { JobDetailPane } from './JobDetailPane'
import { JobRow, JobRowSkeleton, type JobRowActionHandlers, type JobRowBusyState } from './JobRow'
import {
  countJobsByBucket,
  filterJobsLocally,
  getRecoverActionLabel,
  jobStatusToApiParam,
  PAGE_SIZE,
  tabToStatusFilter,
  type JobListTab,
  type JobStatusFilter,
  type PAssistantRetryMode
} from './jobUi'

export const PAssistantJobPanel: React.FC<{
  refreshToken: number
  focusJobId: number | null
  onClose?: () => void
  onActiveCountChange?: (count: number) => void
  /** 嵌入模式：隐藏顶部标题区，紧凑布局 */
  embedded?: boolean
}> = ({ refreshToken, focusJobId, onClose, onActiveCountChange, embedded = false }) => {
  const [jobs, setJobs] = useState<PAssistantJobDetailResponse[]>([])
  const [selectedJob, setSelectedJob] = useState<PAssistantJobDetailResponse | null>(null)
  const [events, setEvents] = useState<PAssistantJobEventResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [listTab, setListTab] = useState<JobListTab>('all')
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [pageMeta, setPageMeta] = useState<PAssistantJobListMeta>({
    total: 0,
    page: 1,
    page_size: PAGE_SIZE,
    total_pages: 0,
    has_next: false,
    has_prev: false
  })
  const [cancellingJobId, setCancellingJobId] = useState<number | null>(null)
  const [resumingJobId, setResumingJobId] = useState<number | null>(null)
  const [recoveringJobId, setRecoveringJobId] = useState<number | null>(null)
  const [retryingJob, setRetryingJob] = useState<{ id: number; mode: PAssistantRetryMode } | null>(
    null
  )

  const kpi = useMemo(() => countJobsByBucket(jobs), [jobs])

  const displayedJobs = useMemo(
    () => filterJobsLocally(jobs, statusFilter, searchQuery),
    [jobs, statusFilter, searchQuery]
  )

  const hasRunningJobs = useMemo(
    () => jobs.some((job) => job.status === 'pending' || job.status === 'running'),
    [jobs]
  )

  useEffect(() => {
    onActiveCountChange?.(kpi.active)
  }, [kpi.active, onActiveCountChange])

  const loadJobDetail = useCallback(async (jobId: number): Promise<void> => {
    setDetailLoading(true)
    try {
      const [job, eventResponse] = await Promise.all([
        pAssistantServiceExtended.getJob(jobId),
        pAssistantServiceExtended.listJobEvents(jobId, { limit: 120 })
      ])
      setSelectedJob(job)
      setEvents([...eventResponse.items].reverse())
      setError('')
    } catch (err) {
      console.error('Failed to load p-assistant job detail:', err)
      setError('加载任务详情失败，请稍后重试')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadJobs = useCallback(
    async ({
      preferredJobId,
      targetPage = page,
      filter = statusFilter
    }: {
      preferredJobId?: number | null
      targetPage?: number
      filter?: JobStatusFilter
    } = {}): Promise<void> => {
      setLoading(true)
      try {
        const apiStatus = jobStatusToApiParam(filter)
        const response = await pAssistantServiceExtended.listJobs({
          page: targetPage,
          page_size: PAGE_SIZE,
          ...(apiStatus ? { job_status: apiStatus } : {})
        })
        setJobs(response.items)
        setPage(response.meta.page)
        setPageMeta(response.meta)
        setError('')

        const targetJobId = preferredJobId ?? selectedJob?.id ?? response.items[0]?.id
        const hasTargetOnPage = targetJobId
          ? response.items.some((item) => item.id === targetJobId)
          : false
        const detailJobId = hasTargetOnPage ? targetJobId : response.items[0]?.id
        if (detailJobId) {
          await loadJobDetail(detailJobId)
        } else {
          setSelectedJob(null)
          setEvents([])
        }
      } catch (err) {
        console.error('Failed to load p-assistant jobs:', err)
        setError('加载任务记录失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    },
    [loadJobDetail, page, selectedJob?.id, statusFilter]
  )

  const applyFilter = useCallback(
    (filter: JobStatusFilter, tab?: JobListTab) => {
      setStatusFilter(filter)
      if (tab !== undefined) setListTab(tab)
      setPage(1)
      void loadJobs({ targetPage: 1, filter, preferredJobId: selectedJob?.id })
    },
    [loadJobs, selectedJob?.id]
  )

  const handleCancelJob = async (job: PAssistantJobDetailResponse): Promise<void> => {
    const label = job.status === 'pending' ? '暂停' : '停止'
    const confirmed = window.confirm(`确认${label}任务 #${job.id}？${label}后可重新运行。`)
    if (!confirmed) return

    setCancellingJobId(job.id)
    try {
      await pAssistantServiceExtended.cancelJob(job.id)
      await loadJobs({ preferredJobId: job.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}任务失败`)
    } finally {
      setCancellingJobId(null)
    }
  }

  const handleResumeJob = async (job: PAssistantJobDetailResponse): Promise<void> => {
    const confirmed = window.confirm(
      `确认重新运行任务 #${job.id}？该任务会恢复为排队中等待 Worker 执行。`
    )
    if (!confirmed) return

    setResumingJobId(job.id)
    try {
      await pAssistantServiceExtended.resumeJob(job.id)
      await loadJobs({ preferredJobId: job.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新运行任务失败')
    } finally {
      setResumingJobId(null)
    }
  }

  const handleRecoverJob = async (job: PAssistantJobDetailResponse): Promise<void> => {
    const actionText = getRecoverActionLabel(job.job_type)
    const confirmed = window.confirm(
      `确认将任务 #${job.id}${actionText}？请先确认该任务确实疑似卡住。`
    )
    if (!confirmed) return

    setRecoveringJobId(job.id)
    try {
      await pAssistantServiceExtended.recoverJob(job.id)
      await loadJobs({ preferredJobId: job.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : '人工恢复任务失败')
    } finally {
      setRecoveringJobId(null)
    }
  }

  const handleRetryJob = async (
    job: PAssistantJobDetailResponse,
    mode: PAssistantRetryMode
  ): Promise<void> => {
    const modeText = mode === 'failed_only' ? '失败项' : '整单'
    const confirmed = window.confirm(`确认为任务 #${job.id} 创建${modeText}重试任务？`)
    if (!confirmed) return

    setRetryingJob({ id: job.id, mode })
    try {
      const response = await pAssistantServiceExtended.retryJob(job.id, mode)
      setPage(1)
      await loadJobs({ targetPage: 1, preferredJobId: response.job_id })
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建重试任务失败')
    } finally {
      setRetryingJob(null)
    }
  }

  const rowHandlers: JobRowActionHandlers = {
    onSelect: (jobId) => void loadJobDetail(jobId),
    onCancel: (job) => void handleCancelJob(job),
    onResume: (job) => void handleResumeJob(job),
    onRecover: (job) => void handleRecoverJob(job),
    onRetry: (job, mode) => void handleRetryJob(job, mode)
  }

  const rowBusy: JobRowBusyState = {
    cancellingJobId,
    resumingJobId,
    recoveringJobId,
    retryingJob
  }

  useEffect(() => {
    void loadJobs({ preferredJobId: focusJobId, targetPage: 1 })
  }, [refreshToken, focusJobId])

  useEffect(() => {
    if (!hasRunningJobs && selectedJob?.status !== 'pending' && selectedJob?.status !== 'running') {
      return undefined
    }
    const timer = window.setInterval(() => {
      void loadJobs({ preferredJobId: selectedJob?.id ?? focusJobId })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [hasRunningJobs, selectedJob?.id, selectedJob?.status, focusJobId, loadJobs])

  const emptyMessage =
    jobs.length === 0 && !loading
      ? '暂无异步任务。提交批量助手操作后会出现在这里。'
      : displayedJobs.length === 0 && !loading
        ? '当前筛选条件下暂无任务。'
        : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-3 border-b border-border/70 bg-muted/15 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-primary" />
              异步任务记录
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              查看巨量批量助手任务状态、进度和事件日志
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadJobs({ preferredJobId: selectedJob?.id })}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              刷新
            </Button>
            {onClose ? (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="mr-1 h-4 w-4" />
                关闭
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'pending' as const, label: '排队', count: kpi.pending },
            { key: 'running' as const, label: '执行中', count: kpi.running },
            { key: 'attention' as const, label: '需关注', count: kpi.attention },
            { key: 'cancelled' as const, label: '已停止', count: kpi.cancelled }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => applyFilter(item.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                statusFilter === item.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/70 bg-background hover:bg-accent/50'
              }`}
            >
              {item.label}
              <span className="ml-1.5 font-semibold tabular-nums">{item.count}</span>
            </button>
          ))}
        </div>

        <Tabs
          value={listTab}
          onValueChange={(value) => {
            const tab = value as JobListTab
            applyFilter(tabToStatusFilter(tab), tab)
          }}
        >
          <TabsList className="h-9 w-full justify-start">
            <TabsTrigger value="all" className="text-xs">
              全部
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs">
              进行中
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs">
              失败
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">
              已停止
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索任务类型或 #ID"
            className="h-9 pl-9 text-sm"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        <div className="flex min-h-0 flex-col border-b border-border/70 lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {loading && jobs.length === 0 ? (
              <>
                <JobRowSkeleton />
                <JobRowSkeleton />
                <JobRowSkeleton />
              </>
            ) : null}

            {emptyMessage ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : null}

            {displayedJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                isSelected={selectedJob?.id === job.id}
                busy={rowBusy}
                handlers={rowHandlers}
              />
            ))}
          </div>

          {pageMeta.total > 0 ? (
            <div className="shrink-0 flex flex-col gap-2 border-t border-border/70 bg-muted/10 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                共 {pageMeta.total} 条 · 第 {pageMeta.page} / {pageMeta.total_pages || 1} 页
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || !pageMeta.has_prev}
                  onClick={() => void loadJobs({ targetPage: Math.max(1, page - 1) })}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || !pageMeta.has_next}
                  onClick={() => void loadJobs({ targetPage: page + 1 })}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 overflow-hidden bg-background/50">
          <JobDetailPane
            job={selectedJob}
            events={events}
            detailLoading={detailLoading}
            busy={rowBusy}
            handlers={rowHandlers}
          />
        </div>
      </div>
    </div>
  )
}
