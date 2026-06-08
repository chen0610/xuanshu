import React from 'react'
import { AlertTriangle, Loader2, MoreHorizontal } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Progress
} from '../../../components/ui'
import type { TencentBatchAssistantJobItem } from '../../../services/tencent-ads.service'
import {
  canRetryJob,
  formatRelativeTime,
  getCreatorLabel,
  getJobStatusMeta,
  getRecoverActionLabel,
  getTencentJobTypeLabel,
  isJobPossiblyStuck,
  type TencentRetryMode
} from './jobUi'

export interface JobRowActionHandlers {
  onSelect: (jobId: number) => void
  onPause: (job: TencentBatchAssistantJobItem) => void
  onResume: (job: TencentBatchAssistantJobItem) => void
  onRecover: (job: TencentBatchAssistantJobItem) => void
  onRetry: (job: TencentBatchAssistantJobItem, mode: TencentRetryMode) => void
}

export interface JobRowBusyState {
  pausingJobId: number | null
  resumingJobId: number | null
  recoveringJobId: number | null
  retryingJob: { id: number; mode: TencentRetryMode } | null
}

interface JobRowProps {
  job: TencentBatchAssistantJobItem
  isSelected: boolean
  busy: JobRowBusyState
  handlers: JobRowActionHandlers
}

export const JobRow: React.FC<JobRowProps> = ({ job, isSelected, busy, handlers }) => {
  const meta = getJobStatusMeta(job.status)
  const isPossiblyStuck = isJobPossiblyStuck(job)
  const recoverLabel = getRecoverActionLabel(job.job_type)
  const isBusy =
    busy.pausingJobId === job.id ||
    busy.resumingJobId === job.id ||
    busy.recoveringJobId === job.id ||
    busy.retryingJob?.id === job.id

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handlers.onSelect(job.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handlers.onSelect(job.id)
        }
      }}
      className={`relative flex cursor-pointer gap-0 rounded-xl border text-left transition-colors ${
        isSelected
          ? 'border-primary/30 bg-primary/8'
          : 'border-border/60 bg-background/80 hover:border-primary/20 hover:bg-accent/40'
      }`}
    >
      <div
        className={`w-1 shrink-0 rounded-l-xl ${isSelected ? 'bg-primary' : 'bg-transparent'}`}
      />
      <div className="min-w-0 flex-1 p-3 pr-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-sm font-semibold">#{job.id}</span>
              <span className="truncate text-sm text-muted-foreground">
                {getTencentJobTypeLabel(job.job_type)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
                {meta.label}
              </span>
              {isPossiblyStuck ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  卡住
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs font-medium tabular-nums text-foreground">
                {job.progress ?? 0}%
              </span>
              <Progress
                value={job.progress ?? 0}
                className={`h-1.5 flex-1 ${job.status === 'running' ? '[&>div]:animate-pulse' : ''}`}
              />
            </div>
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
              成功 {job.success_count ?? 0} · 失败 {job.error_count ?? 0} · 共{' '}
              {job.total_count ?? 0}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/90">
              {formatRelativeTime(job.created_at)} · {getCreatorLabel(job)} ·{' '}
              {job.current_message || '等待更新'}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={isBusy}
                onClick={(e) => e.stopPropagation()}
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => handlers.onSelect(job.id)}>查看详情</DropdownMenuItem>
              <DropdownMenuSeparator />
              {job.status === 'pending' ? (
                <DropdownMenuItem onClick={() => handlers.onPause(job)}>暂停任务</DropdownMenuItem>
              ) : null}
              {job.status === 'cancelled' ? (
                <DropdownMenuItem onClick={() => handlers.onResume(job)}>重新运行</DropdownMenuItem>
              ) : null}
              {isPossiblyStuck ? (
                <DropdownMenuItem onClick={() => handlers.onRecover(job)}>
                  {recoverLabel}
                </DropdownMenuItem>
              ) : null}
              {canRetryJob(job.status) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={job.error_count <= 0}
                    onClick={() => handlers.onRetry(job, 'failed_only')}
                  >
                    重试失败项
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlers.onRetry(job, 'all')}>
                    整单重试
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export const JobRowSkeleton: React.FC = () => (
  <div className="flex gap-0 rounded-xl border border-border/60 bg-muted/20 p-3">
    <div className="mr-3 w-1 shrink-0 rounded-full bg-muted animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
      <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
    </div>
  </div>
)
