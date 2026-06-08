import { useCallback, useEffect, useRef } from 'react'
import {
  pAssistantServiceExtended,
  type ProjectCleanupPreviewResponse
} from '../../../services/ocean-engine.service'
import type { PAssistantLogEntry } from '../usePAssistantJobRunner'

const PREVIEW_JOB_ID_KEY = 'p-assistant-project-cleanup-preview-job-id'
const PREVIEW_DATA_KEY = 'p-assistant-project-cleanup-preview-data'

function mapJobEventLevel(level?: string): PAssistantLogEntry['type'] {
  if (level === 'error') return 'error'
  if (level === 'success') return 'success'
  return 'info'
}

export function extractPreviewErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback
  if (err && typeof err === 'object') {
    const e = err as { message?: string; detail?: string }
    if (typeof e.message === 'string' && e.message) return e.message
    if (typeof e.detail === 'string' && e.detail) return e.detail
  }
  return fallback
}

export function readPersistedPreviewJobId(): number | null {
  try {
    const raw = localStorage.getItem(PREVIEW_JOB_ID_KEY)
    if (!raw?.trim()) return null
    const parsed = parseInt(raw, 10)
    return Number.isNaN(parsed) ? null : parsed
  } catch {
    return null
  }
}

export function readPersistedPreviewData(): ProjectCleanupPreviewResponse['data'] | null {
  try {
    const raw = localStorage.getItem(PREVIEW_DATA_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProjectCleanupPreviewResponse['data']
  } catch {
    return null
  }
}

export function persistPreviewJobId(jobId: number | null): void {
  try {
    if (jobId == null) {
      localStorage.removeItem(PREVIEW_JOB_ID_KEY)
      return
    }
    localStorage.setItem(PREVIEW_JOB_ID_KEY, String(jobId))
  } catch {
    // ignore
  }
}

export function persistPreviewData(data: ProjectCleanupPreviewResponse['data'] | null): void {
  try {
    if (data == null) {
      localStorage.removeItem(PREVIEW_DATA_KEY)
      return
    }
    localStorage.setItem(PREVIEW_DATA_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function clearPersistedPreviewState(): void {
  persistPreviewJobId(null)
  persistPreviewData(null)
}

interface UseProjectCleanupPreviewWatchOptions {
  addLog: (message: string, type?: PAssistantLogEntry['type']) => void
  setLoading: (loading: boolean) => void
  setError: (message: string) => void
  setIsBottomPanelOpen: (open: boolean) => void
  previewJobId: number | null
  setPreviewJobId: (jobId: number | null) => void
  setPreviewData: (data: ProjectCleanupPreviewResponse['data'] | null) => void
  setIsPreviewing: (previewing: boolean) => void
}

interface WatchPreviewOptions {
  skipInitialDelay?: boolean
  resume?: boolean
}

export function useProjectCleanupPreviewWatch({
  addLog,
  setLoading,
  setError,
  setIsBottomPanelOpen,
  previewJobId,
  setPreviewJobId,
  setPreviewData,
  setIsPreviewing
}: UseProjectCleanupPreviewWatchOptions) {
  const previewPollingRef = useRef(true)
  const activePreviewJobIdRef = useRef<number | null>(null)
  const previewWatchTokenRef = useRef(0)

  const stopPreviewWatch = useCallback(() => {
    previewWatchTokenRef.current += 1
    previewPollingRef.current = false
    activePreviewJobIdRef.current = null
  }, [])

  const applyPreviewResult = useCallback(
    (jobId: number, resultData: ProjectCleanupPreviewResponse['data']) => {
      setPreviewData(resultData)
      setPreviewJobId(jobId)
      persistPreviewJobId(jobId)
      persistPreviewData(resultData)
    },
    [setPreviewData, setPreviewJobId]
  )

  const clearPreviewState = useCallback(() => {
    setPreviewData(null)
    setPreviewJobId(null)
    clearPersistedPreviewState()
  }, [setPreviewData, setPreviewJobId])

  const extractPreviewResultData = useCallback(
    (job: { result?: Record<string, unknown> | null }): ProjectCleanupPreviewResponse['data'] | null => {
      const raw = job.result
      if (!raw || typeof raw !== 'object') return null
      if (raw.data && typeof raw.data === 'object') {
        return raw.data as ProjectCleanupPreviewResponse['data']
      }
      if (typeof raw.total === 'number' && typeof raw.eligible_count === 'number') {
        return raw as ProjectCleanupPreviewResponse['data']
      }
      return null
    },
    []
  )

  const finishPreviewWatch = useCallback(
    (token: number) => {
      if (previewWatchTokenRef.current !== token) {
        // 被 stopPreviewWatch / 新预览 supersede 时也要释放 UI 锁
        setIsPreviewing(false)
        setLoading(false)
        return
      }
      activePreviewJobIdRef.current = null
      setIsPreviewing(false)
      setLoading(false)
    },
    [setIsPreviewing, setLoading]
  )

  const isPreviewJobStillCurrent = useCallback((jobId: number): boolean => {
    return readPersistedPreviewJobId() === jobId
  }, [])

  const syncPreviewJobOnce = useCallback(
    async (
      jobId: number,
      options: { resume?: boolean } = {}
    ): Promise<'done' | 'active' | 'terminal'> => {
      const job = await pAssistantServiceExtended.getJob(jobId)

      if (job.status === 'success') {
        const resultData = extractPreviewResultData(job)
        if (!resultData) {
          throw new Error('预览完成但缺少结果')
        }
        if (!isPreviewJobStillCurrent(jobId)) {
          return 'terminal'
        }
        applyPreviewResult(jobId, resultData)
        if (options.resume) {
          addLog(
            `预览已完成：共扫描 ${resultData.total} 个项目，符合清理条件 ${resultData.eligible_count} 个`,
            'success'
          )
        }
        return 'done'
      }

      if (job.status === 'cancelled') {
        clearPreviewState()
        if (options.resume) {
          addLog('预览已停止', 'info')
        }
        return 'terminal'
      }

      if (job.status === 'failed') {
        clearPreviewState()
        throw new Error(job.error_message || String(job.result?.error || '') || '预览失败')
      }

      return 'active'
    },
    [addLog, applyPreviewResult, clearPreviewState, extractPreviewResultData, isPreviewJobStillCurrent]
  )

  const watchPreviewJob = useCallback(
    async (jobId: number, options: WatchPreviewOptions = {}) => {
      const token = previewWatchTokenRef.current + 1
      previewWatchTokenRef.current = token
      previewPollingRef.current = true
      activePreviewJobIdRef.current = jobId
      setPreviewJobId(jobId)
      persistPreviewJobId(jobId)
      setIsPreviewing(true)
      setLoading(true)
      setError('')

      if (options.resume) {
        setIsBottomPanelOpen(true)
        addLog(`恢复同步预览任务 #${jobId}…`, 'info')
      }

      let lastEventId = 0
      let pollErrorCount = 0
      let skipDelay = options.skipInitialDelay ?? false

      try {
        while (previewPollingRef.current && previewWatchTokenRef.current === token) {
          if (!skipDelay) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000))
          }
          skipDelay = false

          if (!previewPollingRef.current || previewWatchTokenRef.current !== token) {
            break
          }

          try {
            const [job, eventsRes] = await Promise.all([
              pAssistantServiceExtended.getJob(jobId),
              pAssistantServiceExtended.listJobEvents(jobId, {
                after_id: lastEventId > 0 ? lastEventId : undefined,
                limit: 200
              })
            ])
            pollErrorCount = 0

            for (const event of eventsRes.items) {
              lastEventId = Math.max(lastEventId, event.id)
              addLog(event.message, mapJobEventLevel(event.level))
            }

            if (job.status === 'success') {
              const resultData = extractPreviewResultData(job)
              if (!resultData) {
                throw new Error('预览完成但缺少结果')
              }
              if (!isPreviewJobStillCurrent(jobId)) {
                break
              }
              applyPreviewResult(jobId, resultData)
              addLog(
                `预览完成：共扫描 ${resultData.total} 个项目，符合清理条件 ${resultData.eligible_count} 个`,
                'success'
              )
              break
            }

            if (job.status === 'cancelled') {
              clearPreviewState()
              addLog('预览已停止', 'info')
              break
            }

            if (job.status === 'failed') {
              clearPreviewState()
              throw new Error(job.error_message || job.result?.error || '预览失败')
            }
          } catch (pollErr: unknown) {
            pollErrorCount += 1
            const pollMessage = extractPreviewErrorMessage(pollErr, '轮询预览状态失败')
            if (pollErrorCount >= 5) {
              throw new Error(pollMessage)
            }
            addLog(`轮询暂时失败（${pollErrorCount}/5）：${pollMessage}，将继续重试…`, 'error')
          }
        }
      } catch (err: unknown) {
        const errorMessage = extractPreviewErrorMessage(err, '项目清理预览失败')
        setError(errorMessage)
        addLog(`失败: ${errorMessage}`, 'error')
        if (activePreviewJobIdRef.current) {
          addLog(
            `预览任务 #${activePreviewJobIdRef.current} 可能仍在后台运行，可在右下角任务记录查看进度`,
            'info'
          )
        }
      } finally {
        finishPreviewWatch(token)
      }
    },
    [
      addLog,
      applyPreviewResult,
      clearPreviewState,
      extractPreviewResultData,
      finishPreviewWatch,
      setError,
      setIsBottomPanelOpen,
      setIsPreviewing,
      setLoading,
      setPreviewJobId,
      isPreviewJobStillCurrent
    ]
  )

  const handleStopPreview = useCallback((): void => {
    const jobId = activePreviewJobIdRef.current ?? previewJobId
    stopPreviewWatch()
    setIsPreviewing(false)
    setLoading(false)
    clearPreviewState()

    if (!jobId) {
      addLog('预览已停止', 'info')
      return
    }

    void pAssistantServiceExtended
      .cancelJob(jobId)
      .then(() => addLog('预览已停止', 'info'))
      .catch((err: unknown) => {
        addLog(extractPreviewErrorMessage(err, '停止预览失败'), 'error')
      })
  }, [addLog, clearPreviewState, previewJobId, setIsPreviewing, setLoading, stopPreviewWatch])

  useEffect(() => {
    const storedJobId = readPersistedPreviewJobId()
    if (!storedJobId) return

    setLoading(false)
    setIsPreviewing(false)

    const storedData = readPersistedPreviewData()
    if (storedData) {
      setPreviewData(storedData)
    }
    setPreviewJobId(storedJobId)

    let cancelled = false

    void (async () => {
      try {
        const syncState = await syncPreviewJobOnce(storedJobId, { resume: true })
        if (cancelled) return

        if (syncState === 'done' || syncState === 'terminal') {
          setIsPreviewing(false)
          setLoading(false)
          return
        }

        await watchPreviewJob(storedJobId, { skipInitialDelay: true, resume: true })
      } catch (err: unknown) {
        if (cancelled) return
        const errorMessage = extractPreviewErrorMessage(err, '恢复预览状态失败')
        setError(errorMessage)
        addLog(`失败: ${errorMessage}`, 'error')
        setIsPreviewing(false)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      stopPreviewWatch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    watchPreviewJob,
    handleStopPreview,
    stopPreviewWatch,
    clearPreviewState
  }
}
