import React, { useCallback, useState } from 'react'
import { Loader2, Scissors } from 'lucide-react'
import { Button, Label, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { MaterialCleanupResponse } from '../../../../services/ocean-engine.service'

export const MaterialCleanupTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [materialCleanupAccountIds, setMaterialCleanupAccountIds] = usePersistedState(
    'p-assistant-material-cleanup-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [materialCleanupOperationType, setMaterialCleanupOperationType] = useState<
    'pause' | 'delete'
  >('delete')
  const [materialCleanupDirection, setMaterialCleanupDirection] = useState<
    'low_efficiency_carry_rejected' | 'low_efficiency_carry' | 'specified_creative_ids'
  >('low_efficiency_carry_rejected')
  const [materialCleanupCreativeIds, setMaterialCleanupCreativeIds] = useState('')

  const getMaterialCleanupDirectionLabel = useCallback(
    (direction: 'low_efficiency_carry_rejected' | 'low_efficiency_carry' | 'specified_creative_ids') => {
      switch (direction) {
        case 'low_efficiency_carry_rejected':
          return '低质/低效/搬运/审核不通过素材'
        case 'low_efficiency_carry':
          return '低质/低效/搬运素材'
        case 'specified_creative_ids':
          return '指定创意ID'
        default:
          return direction
      }
    },
    []
  )

  const handleMaterialCleanup = async (): Promise<void> => {
    if (!selectedConfigId) { setError('请选择Cookie配置'); return }

    const accountIdList = parseAccountIds(materialCleanupAccountIds)
    if (accountIdList.length === 0) { setError('请填写账户ID列表'); return }
    if (accountIdList.length > 100) { setError('账户数量不能超过100个'); return }

    const creativeIdList =
      materialCleanupDirection === 'specified_creative_ids'
        ? parseAccountIds(materialCleanupCreativeIds)
        : []
    if (materialCleanupDirection === 'specified_creative_ids' && creativeIdList.length === 0) {
      setError('请填写至少一个创意ID')
      return
    }

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`提交在投素材清理队列任务，共 ${accountIdList.length} 个账户`, 'info')
    addLog(
      `执行规则：${getMaterialCleanupDirectionLabel(materialCleanupDirection)}；前两个方向额外命中 material_label = 10 的低质素材`,
      'info'
    )

    try {
      const response = await runPAssistantJob<MaterialCleanupResponse>('material_cleanup', {
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        operation_type: materialCleanupOperationType,
        cleanup_direction: materialCleanupDirection,
        ...(materialCleanupDirection === 'specified_creative_ids'
          ? { creative_ids: creativeIdList }
          : {})
      })
      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '在投素材清理失败')
      }
      addLog('在投素材清理任务执行完成', 'success')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '在投素材清理失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="在投素材清理"
      description="提交队列任务，清理低质/低效在投素材、审核不通过素材或指定创意素材。"
      icon={<Scissors />}
    >
      <div className="grid gap-2">
        <Label
          htmlFor="p-assistant-material-cleanup-account-ids"
          className="text-base font-semibold"
        >
          账户列表（一行一个）*
        </Label>
        <Textarea
          id="p-assistant-material-cleanup-account-ids"
          placeholder="请输入需要清理素材的账户ID，每行一个，最多100个..."
          value={materialCleanupAccountIds}
          onChange={(e) => setMaterialCleanupAccountIds(e.target.value)}
          disabled={loading}
          className="min-h-[120px] resize-y font-mono text-sm"
          rows={5}
        />
        <p className="text-sm text-muted-foreground">
          已输入 {parseAccountIds(materialCleanupAccountIds).length} 个账户
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>操作类型</Label>
          <select
            className="px-3 py-2 w-full rounded-md border bg-background"
            value={materialCleanupOperationType}
            onChange={(e) =>
              setMaterialCleanupOperationType(e.target.value as 'pause' | 'delete')
            }
            disabled={materialCleanupDirection === 'low_efficiency_carry_rejected'}
          >
            {materialCleanupDirection !== 'low_efficiency_carry_rejected' && (
              <option value="pause">暂停素材</option>
            )}
            <option value="delete">删除素材</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>清理方向</Label>
          <select
            className="px-3 py-2 w-full rounded-md border bg-background"
            value={materialCleanupDirection}
            onChange={(e) => {
              const nextDirection = e.target.value as
                | 'low_efficiency_carry_rejected'
                | 'low_efficiency_carry'
                | 'specified_creative_ids'
              setMaterialCleanupDirection(nextDirection)
              if (nextDirection === 'low_efficiency_carry_rejected') {
                setMaterialCleanupOperationType('delete')
              }
            }}
          >
            <option value="low_efficiency_carry_rejected">
              低质/低效/搬运/审核不通过素材
            </option>
            <option value="low_efficiency_carry">低质/低效/搬运素材</option>
            <option value="specified_creative_ids">指定创意ID</option>
          </select>
        </div>
      </div>
      {materialCleanupDirection === 'specified_creative_ids' && (
        <div>
          <Label>创意ID列表（一行一个）*</Label>
          <Textarea
            className="mt-2 min-h-[120px] font-mono text-sm"
            placeholder="请输入需要清理的创意ID，每行一个..."
            value={materialCleanupCreativeIds}
            onChange={(e) => setMaterialCleanupCreativeIds(e.target.value)}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            已输入 {parseAccountIds(materialCleanupCreativeIds).length} 个创意ID
          </p>
        </div>
      )}
      <Button
        onClick={handleMaterialCleanup}
        disabled={loading || !selectedConfigId || !materialCleanupAccountIds.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            清理中...
          </>
        ) : (
          <>
            <Scissors className="mr-2 w-4 h-4" />
            提交在投素材清理任务
          </>
        )}
      </Button>
    </PAssistantFeaturePanel>
  )
}
