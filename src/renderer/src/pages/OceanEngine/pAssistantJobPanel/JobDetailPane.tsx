import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Octagon,
  RefreshCw,
  RotateCcw,
  XCircle
} from 'lucide-react'
import { Button } from '../../../components/ui'
import type {
  PAssistantJobDetailResponse,
  PAssistantJobEventResponse
} from '../../../services/ocean-engine.service'
import {
  canRetryJob,
  extractAccountResults,
  formatJobTime,
  getActiveStepIndex,
  getCreatorLabel,
  getJobRunningMinutes,
  getJobStatusMeta,
  getPAssistantJobTypeText,
  getRecoverActionLabel,
  isJobPossiblyStuck,
  JOB_STEP_ORDER
} from './jobUi'
import type { JobRowActionHandlers, JobRowBusyState } from './JobRow'

interface JobDetailPaneProps {
  job: PAssistantJobDetailResponse | null
  events: PAssistantJobEventResponse[]
  detailLoading: boolean
  busy: JobRowBusyState
  handlers: JobRowActionHandlers
}

export const JobDetailPane: React.FC<JobDetailPaneProps> = ({
  job,
  events,
  detailLoading,
  busy,
  handlers
}) => {
  const [showPayload, setShowPayload] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState(false)

  const accountResults = useMemo(
    () => extractAccountResults(job?.result as Record<string, unknown> | undefined),
    [job?.result]
  )

  const failedAccounts = accountResults.filter((item) => {
    if (item.error_count != null) return (item.error_count ?? 0) > 0
    return item.success === false
  })
  const successAccounts = accountResults.filter((item) => !failedAccounts.includes(item))

  if (!job) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
        <Circle className="mb-3 h-10 w-10 opacity-30" />
        <p>选择左侧任务查看详情</p>
        <p className="mt-1 text-xs">可查看执行阶段、账户结果与事件日志</p>
      </div>
    )
  }

  const meta = getJobStatusMeta(job.status)
  const stepIndex = getActiveStepIndex(job)
  const isStuck = isJobPossiblyStuck(job)
  const recoverLabel = getRecoverActionLabel(job.job_type)
  const isJobBusy =
    busy.cancellingJobId === job.id ||
    busy.resumingJobId === job.id ||
    busy.recoveringJobId === job.id ||
    busy.retryingJob?.id === job.id

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {isStuck ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">任务疑似卡住</div>
                <p className="mt-1 text-xs leading-5">
                  已执行 {getJobRunningMinutes(job)} 分钟，可能因 Worker 中断仍停留在执行中。
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">任务 #{job.id}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${meta.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
              {meta.label}
            </span>
            {detailLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {getPAssistantJobTypeText(job.job_type)} · {formatJobTime(job.created_at)}
          </p>
          {job.parent_job_id ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              来源 #{job.parent_job_id} ·{' '}
              {job.retry_mode === 'failed_only' ? '失败项重试' : '整单重试'}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {getCreatorLabel(job)}
            {job.creator_role ? ` · ${job.creator_role}` : ''}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>执行阶段</span>
            {job.status === 'running' || job.status === 'pending' ? (
              <span className="text-lg font-semibold tabular-nums text-primary">{job.progress}%</span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-1">
            {JOB_STEP_ORDER.map((step, index) => {
              const isDone = index < stepIndex
              const isCurrent = index === stepIndex
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-medium ${
                        isDone
                          ? 'bg-primary text-primary-foreground'
                          : isCurrent
                            ? 'border-2 border-primary bg-primary/10 text-primary'
                            : 'border border-border bg-background text-muted-foreground'
                      }`}
                    >
                      {isDone ? '✓' : index + 1}
                    </div>
                    <span
                      className={`truncate text-[10px] ${isCurrent ? 'font-medium text-primary' : 'text-muted-foreground'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < JOB_STEP_ORDER.length - 1 ? (
                    <div
                      className={`mb-4 h-0.5 flex-1 ${index < stepIndex ? 'bg-primary' : 'bg-border'}`}
                    />
                  ) : null}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['总数', job.total_count],
            ['已处理', job.processed_count ?? 0],
            ['成功', job.success_count],
            ['失败', job.error_count]
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/15 p-3 text-sm">
          <div className="font-medium text-foreground">当前状态</div>
          <p className="mt-1.5 text-muted-foreground leading-relaxed">
            {job.current_message || job.error_message || '-'}
          </p>
        </div>

        {accountResults.length > 0 ? (
          <div className="rounded-lg border border-border/70">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/30"
              onClick={() => setExpandedAccounts((v) => !v)}
            >
              <span>
                账户结果 · 成功 {successAccounts.length} / 失败 {failedAccounts.length}
              </span>
              {expandedAccounts ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {expandedAccounts ? (
              <div className="max-h-40 space-y-1 overflow-y-auto border-t px-2 py-2">
                {[...failedAccounts, ...successAccounts].map((item, idx) => {
                  const id = String(item.account_id || item.advertiser_id || idx)
                  const isFail =
                    item.error_count != null
                      ? (item.error_count ?? 0) > 0
                      : item.success === false
                  return (
                    <div
                      key={`${id}-${idx}`}
                      className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${
                        isFail ? 'bg-destructive/5 text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {isFail ? (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      )}
                      <span className="min-w-0 flex-1 break-all">
                        {id}
                        {item.errors?.[0] ? ` — ${item.errors[0]}` : ''}
                        {item.error ? ` — ${item.error}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : failedAccounts.length > 0 ? (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                {failedAccounts.length} 个账户失败，展开查看详情
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-2 text-sm font-medium">事件日志</div>
          <div className="relative max-h-[220px] space-y-0 overflow-y-auto rounded-lg border border-border/70 bg-muted/10 p-3">
            {events.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">暂无事件</p>
            ) : (
              events.map((event, index) => (
                <EventTimelineItem
                  key={event.id}
                  event={event}
                  isLast={index === events.length - 1}
                />
              ))
            )}
          </div>
        </div>

        {job.payload && Object.keys(job.payload).length > 0 ? (
          <div>
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium"
              onClick={() => setShowPayload((v) => !v)}
            >
              任务参数
              {showPayload ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {showPayload ? (
              <pre className="mt-2 max-h-36 overflow-auto rounded-lg border bg-muted/20 p-2 text-[11px]">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 flex flex-wrap gap-2 border-t border-border/70 bg-muted/10 p-3">
        {job.status === 'pending' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isJobBusy}
            onClick={() => handlers.onCancel(job)}
          >
            {busy.cancellingJobId === job.id ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="mr-1 h-3.5 w-3.5" />
            )}
            暂停
          </Button>
        ) : null}
        {job.status === 'running' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isJobBusy}
            onClick={() => handlers.onCancel(job)}
          >
            {busy.cancellingJobId === job.id ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Octagon className="mr-1 h-3.5 w-3.5" />
            )}
            停止
          </Button>
        ) : null}
        {job.status === 'cancelled' ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isJobBusy}
            onClick={() => handlers.onResume(job)}
          >
            {busy.resumingJobId === job.id ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            重新运行
          </Button>
        ) : null}
        {isStuck ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-500/30 text-amber-700 dark:text-amber-300"
            disabled={isJobBusy}
            onClick={() => handlers.onRecover(job)}
          >
            {busy.recoveringJobId === job.id ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            )}
            {recoverLabel}
          </Button>
        ) : null}
        {canRetryJob(job.status) ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isJobBusy || job.error_count <= 0}
              onClick={() => handlers.onRetry(job, 'failed_only')}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              失败项
            </Button>
            <Button type="button" size="sm" disabled={isJobBusy} onClick={() => handlers.onRetry(job, 'all')}>
              整单重试
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}

const EventTimelineItem: React.FC<{
  event: PAssistantJobEventResponse
  isLast: boolean
}> = ({ event, isLast }) => {
  const isError = event.level === 'error'
  const isWarning = event.level === 'warning'
  return (
    <div className="relative flex gap-3 pb-4">
      {!isLast ? (
        <span className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
      ) : null}
      <div
        className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isError
            ? 'bg-destructive/15 text-destructive'
            : isWarning
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              : 'bg-primary/10 text-primary'
        }`}
      >
        {isError ? (
          <XCircle className="h-3.5 w-3.5" />
        ) : isWarning ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
          <span>{formatJobTime(event.created_at)}</span>
          <span>{event.event_type}</span>
        </div>
        <p
          className={`mt-0.5 text-xs leading-5 ${
            isError ? 'text-destructive' : isWarning ? 'text-amber-700 dark:text-amber-300' : ''
          }`}
        >
          {event.message}
        </p>
      </div>
    </div>
  )
}
