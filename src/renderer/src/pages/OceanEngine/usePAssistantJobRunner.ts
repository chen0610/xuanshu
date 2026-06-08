import { useCallback, useState } from 'react'
import {
  pAssistantServiceExtended,
  type PAssistantJobDetailResponse
} from '../../services/ocean-engine.service'

export interface PAssistantLogEntry {
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: Date
}

interface UsePAssistantJobRunnerOptions {
  addLog: (message: string, type?: PAssistantLogEntry['type']) => void
  onJobCreated?: (jobId: number) => void
  onJobTerminal?: () => void
}

interface UsePAssistantJobRunnerResult {
  activePAssistantJobId: number | null
  setActivePAssistantJobId: React.Dispatch<React.SetStateAction<number | null>>
  runPAssistantJob: <T extends { code?: number; error?: string; msg?: string }>(
    jobType: string,
    payload: Record<string, unknown>,
    options?: { onCreated?: (jobId: number) => void }
  ) => Promise<T>
}

const COMPLETED_JOB_STATUSES = new Set(['success', 'partial'])
const FAILED_JOB_STATUSES = new Set(['failed', 'cancelled'])

export function usePAssistantJobRunner({
  addLog,
  onJobCreated,
  onJobTerminal
}: UsePAssistantJobRunnerOptions): UsePAssistantJobRunnerResult {
  const [activePAssistantJobId, setActivePAssistantJobId] = useState<number | null>(null)

  const runPAssistantJob = useCallback(
    async <T extends { code?: number; error?: string; msg?: string }>(
      jobType: string,
      payload: Record<string, unknown>,
      options?: { onCreated?: (jobId: number) => void }
    ): Promise<T> => {
      const created = await pAssistantServiceExtended.createJob({ job_type: jobType, payload })
      setActivePAssistantJobId(created.job_id)
      onJobCreated?.(created.job_id)
      options?.onCreated?.(created.job_id)
      addLog(`任务 #${created.job_id} 已提交到 Worker，可从右下角任务记录查看执行状态`, 'info')

      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000))
        const job: PAssistantJobDetailResponse = await pAssistantServiceExtended.getJob(
          created.job_id
        )
        setActivePAssistantJobId(job.id)

        if (COMPLETED_JOB_STATUSES.has(job.status)) {
          if (!job.result) {
            throw new Error('任务已完成但缺少结果')
          }
          addLog(`任务 #${job.id} 执行完成`, job.status === 'partial' ? 'error' : 'success')
          onJobTerminal?.()
          return job.result as T
        }

        if (FAILED_JOB_STATUSES.has(job.status)) {
          onJobTerminal?.()
          throw new Error(job.error_message || job.result?.error || '任务执行失败')
        }
      }
    },
    [addLog, onJobCreated, onJobTerminal]
  )

  return {
    activePAssistantJobId,
    setActivePAssistantJobId,
    runPAssistantJob
  }
}
