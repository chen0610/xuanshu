import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import { clearPersistedPreviewState, useAdCleanupPreviewWatch } from '../useAdCleanupPreviewWatch'
import {
  pAssistantServiceExtended,
  type AdCleanupFilter,
  type AdCleanupDeleteResponse,
  type AdCleanupPreviewResponse
} from '../../../../services/ocean-engine.service'
import { buildAdCleanupConfigFingerprint } from '../adCleanup/adCleanupConfig'
import { AdCleanupScopeSection } from '../adCleanup/AdCleanupScopeSection'
import { AdCleanupFilterSection } from '../adCleanup/AdCleanupFilterSection'
import { AdCleanupPreviewPanel } from '../adCleanup/AdCleanupPreviewPanel'
import { CLEANUP_MAX_ACCOUNT_COUNT, getTodayDateString } from '../shared/cleanupOrgConfig'

const PREVIEW_CONFIG_FINGERPRINT_KEY = 'p-assistant-ad-cleanup-preview-config-fingerprint'
const PREVIEW_PAYLOAD_SNAPSHOT_KEY = 'p-assistant-ad-cleanup-preview-payload'

interface AdCleanupJobPayload {
  ebp_id: string
  account_ids: string[]
  selected_cookie_id: number
  filter: AdCleanupFilter
  duration_hours: number
}

export const AdCleanupTab: React.FC = () => {
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

  const [adCleanupAccountIds, setAdCleanupAccountIds] = usePersistedState(
    'p-assistant-ad-cleanup-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [adCleanupFilterEnabled, setAdCleanupFilterEnabled] = useState(false)
  const [adCleanupFilter, setAdCleanupFilter] = useState<AdCleanupFilter>({
    filter_enabled: false,
    start_date: getTodayDateString(),
    end_date: getTodayDateString(),
    spend_value: 0,
    spend_operator: 'lte',
    conversion_num_value: 1,
    conversion_num_operator: 'lte',
    delivery_mode: 'all',
    keyword: '',
    ad_status: 'all',
    account_scope: 'partial',
    account_ids: [],
    tag_ids: []
  })
  const [adCleanupDurationHours, setAdCleanupDurationHours] = useState('24')
  const [previewJobId, setPreviewJobId] = usePersistedState<number | null>(
    'p-assistant-ad-cleanup-preview-job-id',
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
            localStorage.removeItem('p-assistant-ad-cleanup-preview-job-id')
          } catch {
            // ignore
          }
          return false
        }
        return value > 0
      }
    }
  )
  const [adCleanupPreviewData, setAdCleanupPreviewData] = usePersistedState<
    AdCleanupPreviewResponse['data'] | null
  >('p-assistant-ad-cleanup-preview-data', null, {
    serialize: (value) => JSON.stringify(value),
    deserialize: (raw) => {
      try {
        return JSON.parse(raw) as AdCleanupPreviewResponse['data']
      } catch {
        return null
      }
    },
    shouldPersist: (value) => {
      if (value == null) {
        try {
          localStorage.removeItem('p-assistant-ad-cleanup-preview-data')
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
  const [previewPayloadSnapshot, setPreviewPayloadSnapshot] =
    usePersistedState<AdCleanupJobPayload | null>(PREVIEW_PAYLOAD_SNAPSHOT_KEY, null, {
      serialize: (value) => JSON.stringify(value),
      deserialize: (raw) => {
        try {
          return JSON.parse(raw) as AdCleanupJobPayload
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
    useAdCleanupPreviewWatch({
      addLog,
      setLoading,
      setError,
      setIsBottomPanelOpen,
      previewJobId,
      setPreviewJobId,
      setPreviewData: setAdCleanupPreviewData,
      setIsPreviewing
    })

  const currentConfigFingerprint = useMemo(
    () =>
      buildAdCleanupConfigFingerprint({
        rootEbpId: selectedRootEbpId,
        ebpId: selectedOrgEbpId,
        accountScope: 'partial',
        accountIds: adCleanupAccountIds,
        filter: adCleanupFilter,
        filterEnabled: adCleanupFilterEnabled,
        durationHours: adCleanupDurationHours
      }),
    [
      selectedRootEbpId,
      selectedOrgEbpId,
      adCleanupAccountIds,
      adCleanupFilter,
      adCleanupFilterEnabled,
      adCleanupDurationHours
    ]
  )

  const isPreviewStale =
    adCleanupPreviewData != null &&
    (previewConfigFingerprint === '' || previewConfigFingerprint !== currentConfigFingerprint)

  useEffect(() => {
    if (wasPreviewingRef.current && !isPreviewing && adCleanupPreviewData) {
      setPreviewConfigFingerprint(currentConfigFingerprint)
    }
    wasPreviewingRef.current = isPreviewing
  }, [isPreviewing, adCleanupPreviewData, currentConfigFingerprint, setPreviewConfigFingerprint])

  const buildAdCleanupPayload = (): AdCleanupJobPayload | null => {
    if (!selectedConfigId) {
      setError('请选择Cookie配置')
      return null
    }

    const ebpId = selectedOrgEbpId.trim()
    if (!ebpId) {
      setError('请选择组织节点')
      return null
    }

    const accountIdList = parseAccountIds(adCleanupAccountIds).filter((id) => /^\d+$/.test(id))

    if (accountIdList.length === 0) {
      setError('请输入至少一个账户ID')
      return null
    }

    if (accountIdList.length > CLEANUP_MAX_ACCOUNT_COUNT) {
      setError(`账户数量不能超过 ${CLEANUP_MAX_ACCOUNT_COUNT} 个`)
      return null
    }

    const durationHoursNum = parseInt(adCleanupDurationHours, 10)
    if (Number.isNaN(durationHoursNum) || durationHoursNum < 0) {
      setError('请输入有效的小时数')
      return null
    }

    return {
      ebp_id: ebpId,
      account_ids: accountIdList,
      selected_cookie_id: selectedConfigId,
      filter: {
        filter_enabled: adCleanupFilterEnabled,
        start_date: adCleanupFilter.start_date,
        end_date: adCleanupFilter.end_date,
        spend_value:
          adCleanupFilterEnabled && adCleanupFilter.spend_value !== undefined
            ? adCleanupFilter.spend_value
            : undefined,
        spend_operator: adCleanupFilter.spend_operator,
        conversion_num_value:
          adCleanupFilterEnabled && adCleanupFilter.conversion_num_value !== undefined
            ? adCleanupFilter.conversion_num_value
            : undefined,
        conversion_num_operator: adCleanupFilter.conversion_num_operator,
        delivery_mode: adCleanupFilter.delivery_mode,
        keyword:
          adCleanupFilterEnabled && adCleanupFilter.keyword ? adCleanupFilter.keyword : undefined,
        ad_status: adCleanupFilter.ad_status,
        account_scope: 'partial',
        account_ids: accountIdList,
        tag_ids: undefined
      },
      duration_hours: durationHoursNum
    }
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

  const handleAdCleanupPreview = async (): Promise<void> => {
    const payload = buildAdCleanupPayload()
    if (!payload) return

    stopPreviewWatch()
    setAdCleanupPreviewData(null)
    clearPersistedPreviewState()
    setPreviewConfigFingerprint('')
    setPreviewPayloadSnapshot(null)
    clearLogs()
    setIsBottomPanelOpen(true)

    try {
      const created = await pAssistantServiceExtended.createJob({
        job_type: 'ad_cleanup_preview',
        payload: payload as unknown as Record<string, unknown>
      })
      addLog(`预览任务 #${created.job_id} 已提交到 Worker`, 'info')
      await watchPreviewJob(created.job_id, { skipInitialDelay: true })
      const previewJob = await pAssistantServiceExtended.getJob(created.job_id)
      if (previewJob.status === 'success' && previewJob.payload) {
        setPreviewPayloadSnapshot(previewJob.payload as unknown as AdCleanupJobPayload)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '提交预览任务失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    }
  }

  const handleAdCleanupDelete = async (): Promise<void> => {
    if (!previewJobId || !adCleanupPreviewData || adCleanupPreviewData.eligible_count === 0) {
      setError('没有符合条件的广告需要清理，请先预览')
      return
    }

    if (isPreviewStale) {
      setError('预览结果已过期，请重新预览后再执行删除')
      return
    }

    const confirmed = window.confirm(
      `警告：此操作将永久删除 ${adCleanupPreviewData.eligible_count} 个广告！\n\n此操作不可逆，删除的广告将无法恢复。确定要继续吗？`
    )
    if (!confirmed) return

    setIsDeleting(true)
    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`提交广告清理队列任务，预计清理 ${adCleanupPreviewData.eligible_count} 个广告`, 'info')

    try {
      const previewJob = await pAssistantServiceExtended.getJob(previewJobId)
      if (previewJob.job_type !== 'ad_cleanup_preview') {
        throw new Error('预览任务类型不正确，请重新预览')
      }
      if (previewJob.status !== 'success') {
        throw new Error('预览任务未成功完成，请重新预览')
      }

      const response = await runPAssistantJob<AdCleanupDeleteResponse>('ad_cleanup_delete', {
        ...(previewJob.payload as unknown as AdCleanupJobPayload),
        preview_job_id: previewJobId
      })
      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '广告清理失败')
      }
      handleClearPreviewState()
      addLog('广告清理任务执行完成', 'success')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '广告清理失败'
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
    !!adCleanupPreviewData &&
    adCleanupPreviewData.eligible_count > 0 &&
    !isPreviewStale

  return (
    <PAssistantFeaturePanel
      title="广告清理（升级版）"
      description="按步骤配置范围与筛选规则，预览确认后再提交删除任务。"
      icon={<Trash2 />}
      danger
    >
      <AdCleanupScopeSection
        selectedOrgName={selectedOrgName}
        selectedOrgEbpId={selectedOrgEbpId}
        accountIds={adCleanupAccountIds}
        onAccountIdsChange={setAdCleanupAccountIds}
        disabled={loading || isPreviewing || isDeleting}
      />

      <AdCleanupFilterSection
        filter={adCleanupFilter}
        onFilterChange={(patch) => setAdCleanupFilter((prev) => ({ ...prev, ...patch }))}
        durationHours={adCleanupDurationHours}
        onDurationHoursChange={setAdCleanupDurationHours}
        filterEnabled={adCleanupFilterEnabled}
        onFilterEnabledChange={setAdCleanupFilterEnabled}
      />

      <AdCleanupPreviewPanel
        previewData={adCleanupPreviewData}
        isPreviewStale={isPreviewStale}
        isPreviewing={isPreviewing}
        isDeleting={isDeleting}
        canPreview={canPreview}
        canDelete={canDelete}
        onPreview={() => void handleAdCleanupPreview()}
        onStopPreview={handleStopPreview}
        onDelete={() => void handleAdCleanupDelete()}
      />
    </PAssistantFeaturePanel>
  )
}
