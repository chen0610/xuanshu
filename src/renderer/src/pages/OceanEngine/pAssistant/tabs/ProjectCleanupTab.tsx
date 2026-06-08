import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  clearPersistedPreviewState,
  useProjectCleanupPreviewWatch
} from '../useProjectCleanupPreviewWatch'
import {
  createProjectCleanupMetricCondition,
  serializeProjectCleanupMetricConditions,
  type ProjectCleanupMetricCondition
} from '../projectCleanupMetrics'
import {
  pAssistantServiceExtended,
  type ProjectCleanupFilter,
  type ProjectCleanupDeleteResponse,
  type ProjectCleanupPreviewResponse
} from '../../../../services/ocean-engine.service'
import {
  buildProjectCleanupConfigFingerprint,
  getTodayDateString
} from '../projectCleanup/projectCleanupConfig'
import { CLEANUP_MAX_ACCOUNT_COUNT } from '../shared/cleanupOrgConfig'
import { ProjectCleanupScopeSection } from '../projectCleanup/ProjectCleanupScopeSection'
import { ProjectCleanupFilterSection } from '../projectCleanup/ProjectCleanupFilterSection'
import { ProjectCleanupPreviewPanel } from '../projectCleanup/ProjectCleanupPreviewPanel'

const PREVIEW_CONFIG_FINGERPRINT_KEY = 'p-assistant-project-cleanup-preview-config-fingerprint'
const PREVIEW_PAYLOAD_SNAPSHOT_KEY = 'p-assistant-project-cleanup-preview-payload'

interface ProjectCleanupJobPayload {
  ebp_id: string
  account_ids: string[]
  selected_cookie_id: number
  filter: ProjectCleanupFilter
  duration_hours: number
}

export const ProjectCleanupTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob,
    selectedRootEbpId,
    selectedOrgEbpId,
    selectedOrgName
  } = usePAssistantContext()

  const [projectCleanupAccountIds, setProjectCleanupAccountIds] = usePersistedState(
    'p-assistant-project-cleanup-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [projectCleanupFilterEnabled, setProjectCleanupFilterEnabled] = useState(false)
  const [projectCleanupFilter, setProjectCleanupFilter] = useState<ProjectCleanupFilter>({
    filter_enabled: false,
    start_date: getTodayDateString(),
    end_date: getTodayDateString(),
    project_status: 'all',
    account_scope: 'partial',
    account_ids: []
  })
  const [projectCleanupMetricConditions, setProjectCleanupMetricConditions] = useState<
    ProjectCleanupMetricCondition[]
  >([])
  const [projectCleanupDurationHours, setProjectCleanupDurationHours] = useState('24')
  const [previewJobId, setPreviewJobId] = usePersistedState<number | null>(
    'p-assistant-project-cleanup-preview-job-id',
    null,
    {
      serialize: (value) => (value == null ? '' : String(value)),
      deserialize: (raw) => {
        const trimmed = raw.trim()
        if (!trimmed) return null
        const parsed = parseInt(trimmed, 10)
        return Number.isNaN(parsed) ? null : parsed
      },
      shouldPersist: (value) => {
        if (value == null) {
          try {
            localStorage.removeItem('p-assistant-project-cleanup-preview-job-id')
          } catch {
            // ignore
          }
          return false
        }
        return value > 0
      }
    }
  )
  const [projectCleanupPreviewData, setProjectCleanupPreviewData] = usePersistedState<
    ProjectCleanupPreviewResponse['data'] | null
  >('p-assistant-project-cleanup-preview-data', null, {
    serialize: (value) => JSON.stringify(value),
    deserialize: (raw) => {
      try {
        return JSON.parse(raw) as ProjectCleanupPreviewResponse['data']
      } catch {
        return null
      }
    },
    shouldPersist: (value) => {
      if (value == null) {
        try {
          localStorage.removeItem('p-assistant-project-cleanup-preview-data')
        } catch {
          // ignore
        }
        return false
      }
      return true
    }
  })
  const [previewConfigFingerprint, setPreviewConfigFingerprint] = usePersistedState<string>(
    PREVIEW_CONFIG_FINGERPRINT_KEY,
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [previewPayloadSnapshot, setPreviewPayloadSnapshot] = usePersistedState<
    ProjectCleanupJobPayload | null
  >(PREVIEW_PAYLOAD_SNAPSHOT_KEY, null, {
    serialize: (value) => JSON.stringify(value),
    deserialize: (raw) => {
      try {
        return JSON.parse(raw) as ProjectCleanupJobPayload
      } catch {
        return null
      }
    },
    shouldPersist: (value) => {
      if (value == null) {
        try {
          localStorage.removeItem(PREVIEW_PAYLOAD_SNAPSHOT_KEY)
        } catch {
          // ignore
        }
        return false
      }
      return true
    }
  })
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const wasPreviewingRef = useRef(false)

  const { watchPreviewJob, handleStopPreview, stopPreviewWatch, clearPreviewState } =
    useProjectCleanupPreviewWatch({
      addLog,
      setLoading,
      setError,
      setIsBottomPanelOpen,
      previewJobId,
      setPreviewJobId,
      setPreviewData: setProjectCleanupPreviewData,
      setIsPreviewing
    })

  const currentConfigFingerprint = useMemo(
    () =>
      buildProjectCleanupConfigFingerprint({
        rootEbpId: selectedRootEbpId,
        ebpId: selectedOrgEbpId,
        accountScope: 'partial',
        accountIds: projectCleanupAccountIds,
        filter: projectCleanupFilter,
        filterEnabled: projectCleanupFilterEnabled,
        metricConditions: projectCleanupMetricConditions,
        durationHours: projectCleanupDurationHours
      }),
    [
      selectedRootEbpId,
      selectedOrgEbpId,
      projectCleanupAccountIds,
      projectCleanupFilter,
      projectCleanupFilterEnabled,
      projectCleanupMetricConditions,
      projectCleanupDurationHours
    ]
  )

  const isPreviewStale =
    projectCleanupPreviewData != null &&
    (previewConfigFingerprint === '' ||
      previewConfigFingerprint !== currentConfigFingerprint)

  useEffect(() => {
    if (wasPreviewingRef.current && !isPreviewing && projectCleanupPreviewData) {
      setPreviewConfigFingerprint(currentConfigFingerprint)
    }
    wasPreviewingRef.current = isPreviewing
  }, [isPreviewing, projectCleanupPreviewData, currentConfigFingerprint, setPreviewConfigFingerprint])

  const buildProjectCleanupPayload = (): ProjectCleanupJobPayload | null => {
    if (!selectedConfigId) {
      setError('请选择Cookie配置')
      return null
    }

    const ebpId = selectedOrgEbpId.trim()
    if (!ebpId) {
      setError('请选择组织节点')
      return null
    }

    const accountIdList = parseAccountIds(projectCleanupAccountIds).filter((id) => /^\d+$/.test(id))

    if (accountIdList.length === 0) {
      setError('请输入至少一个账户ID')
      return null
    }

    if (accountIdList.length > CLEANUP_MAX_ACCOUNT_COUNT) {
      setError(`账户数量不能超过 ${CLEANUP_MAX_ACCOUNT_COUNT} 个`)
      return null
    }

    const durationHoursNum = parseInt(projectCleanupDurationHours, 10)
    if (Number.isNaN(durationHoursNum) || durationHoursNum < 0) {
      setError('请输入有效的小时数')
      return null
    }

    return {
      ebp_id: ebpId,
      account_ids: accountIdList,
      selected_cookie_id: selectedConfigId,
      filter: {
        filter_enabled: projectCleanupFilterEnabled,
        start_date: projectCleanupFilter.start_date,
        end_date: projectCleanupFilter.end_date,
        project_status: projectCleanupFilter.project_status,
        metric_conditions: projectCleanupFilterEnabled
          ? serializeProjectCleanupMetricConditions(projectCleanupMetricConditions)
          : [],
        account_scope: 'partial',
        account_ids: accountIdList
      },
      duration_hours: durationHoursNum
    }
  }

  const addProjectCleanupMetricCondition = (): void => {
    setProjectCleanupMetricConditions((prev) => [...prev, createProjectCleanupMetricCondition()])
  }

  const updateProjectCleanupMetricCondition = (
    id: string,
    patch: Partial<Omit<ProjectCleanupMetricCondition, 'id'>>
  ): void => {
    setProjectCleanupMetricConditions((prev) =>
      prev.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition))
    )
  }

  const removeProjectCleanupMetricCondition = (id: string): void => {
    setProjectCleanupMetricConditions((prev) => prev.filter((condition) => condition.id !== id))
  }

  const handleClearPreviewState = (): void => {
    clearPreviewState()
    setPreviewConfigFingerprint('')
    setPreviewPayloadSnapshot(null)
    try {
      localStorage.removeItem(PREVIEW_CONFIG_FINGERPRINT_KEY)
      localStorage.removeItem(PREVIEW_PAYLOAD_SNAPSHOT_KEY)
    } catch {
      // ignore
    }
  }

  const handleProjectCleanupPreview = async (): Promise<void> => {
    const payload = buildProjectCleanupPayload()
    if (!payload) return

    stopPreviewWatch()
    setProjectCleanupPreviewData(null)
    clearPersistedPreviewState()
    setPreviewConfigFingerprint('')
    setPreviewPayloadSnapshot(null)
    clearLogs()
    setIsBottomPanelOpen(true)

    try {
      const created = await pAssistantServiceExtended.createJob({
        job_type: 'project_cleanup_preview',
        payload: payload as unknown as Record<string, unknown>
      })
      addLog(`预览任务 #${created.job_id} 已提交到 Worker`, 'info')
      await watchPreviewJob(created.job_id, { skipInitialDelay: true })
      const previewJob = await pAssistantServiceExtended.getJob(created.job_id)
      if (previewJob.status === 'success' && previewJob.payload) {
        setPreviewPayloadSnapshot(previewJob.payload as unknown as ProjectCleanupJobPayload)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '提交预览任务失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    }
  }

  const handleProjectCleanupDelete = async (): Promise<void> => {
    if (
      !previewJobId ||
      !projectCleanupPreviewData ||
      projectCleanupPreviewData.eligible_count === 0
    ) {
      setError('没有符合条件的项目需要清理，请先预览')
      return
    }

    if (isPreviewStale) {
      setError('预览结果已过期，请重新预览后再执行删除')
      return
    }

    const confirmed = window.confirm(
      `警告：此操作将永久删除 ${projectCleanupPreviewData.eligible_count} 个项目！\n\n此操作不可逆，删除的项目将无法恢复。确定要继续吗？`
    )
    if (!confirmed) return

    setIsDeleting(true)
    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      `提交项目清理队列任务，预计清理 ${projectCleanupPreviewData.eligible_count} 个项目`,
      'info'
    )

    try {
      const previewJob = await pAssistantServiceExtended.getJob(previewJobId)
      if (previewJob.job_type !== 'project_cleanup_preview') {
        throw new Error('预览任务类型不正确，请重新预览')
      }
      if (previewJob.status !== 'success') {
        throw new Error('预览任务未成功完成，请重新预览')
      }

      const response = await runPAssistantJob<ProjectCleanupDeleteResponse>('project_cleanup_delete', {
        ...(previewJob.payload as unknown as ProjectCleanupJobPayload),
        preview_job_id: previewJobId
      })
      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '项目清理失败')
      }
      handleClearPreviewState()
      addLog('项目清理任务执行完成', 'success')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '项目清理失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setIsDeleting(false)
      setLoading(false)
    }
  }

  const canPreview =
    !loading && !isPreviewing && !isDeleting && !!selectedConfigId && !!selectedOrgEbpId.trim()

  const canDelete =
    canPreview &&
    !!previewJobId &&
    !!projectCleanupPreviewData &&
    projectCleanupPreviewData.eligible_count > 0 &&
    !isPreviewStale

  return (
    <PAssistantFeaturePanel
      title="项目清理（升级版）"
      description="按步骤配置范围与筛选规则，预览确认后再提交删除任务。"
      icon={<Trash2 />}
      danger
    >
      <ProjectCleanupScopeSection
        selectedOrgName={selectedOrgName}
        selectedOrgEbpId={selectedOrgEbpId}
        accountIds={projectCleanupAccountIds}
        onAccountIdsChange={setProjectCleanupAccountIds}
        disabled={loading || isPreviewing || isDeleting}
      />

      <ProjectCleanupFilterSection
        filter={projectCleanupFilter}
        onFilterChange={(patch) => setProjectCleanupFilter((prev) => ({ ...prev, ...patch }))}
        durationHours={projectCleanupDurationHours}
        onDurationHoursChange={setProjectCleanupDurationHours}
        filterEnabled={projectCleanupFilterEnabled}
        onFilterEnabledChange={setProjectCleanupFilterEnabled}
        metricConditions={projectCleanupMetricConditions}
        onAddMetricCondition={addProjectCleanupMetricCondition}
        onUpdateMetricCondition={updateProjectCleanupMetricCondition}
        onRemoveMetricCondition={removeProjectCleanupMetricCondition}
        onClearMetricConditions={() => setProjectCleanupMetricConditions([])}
      />

      <ProjectCleanupPreviewPanel
        previewData={projectCleanupPreviewData}
        isPreviewStale={isPreviewStale}
        isPreviewing={isPreviewing}
        isDeleting={isDeleting}
        canPreview={canPreview}
        canDelete={canDelete}
        onPreview={() => void handleProjectCleanupPreview()}
        onStopPreview={handleStopPreview}
        onDelete={() => void handleProjectCleanupDelete()}
      />
    </PAssistantFeaturePanel>
  )
}
