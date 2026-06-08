import React, { useEffect, useState } from 'react'
import { ArrowRight, ImagePlus, Loader2, RefreshCw } from 'lucide-react'
import { Button, Label, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  pAssistantServiceExtended,
  type MaterialShareGroupInfo,
  type MaterialShareResponse
} from '../../../../services/ocean-engine.service'

export const MaterialShareTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  const [materialShareGroups, setMaterialShareGroups] = useState<MaterialShareGroupInfo[]>([])
  const [loadingMaterialShareGroups, setLoadingMaterialShareGroups] = useState(false)
  const [selectedMaterialShareGroupId, setSelectedMaterialShareGroupId] = usePersistedState(
    'p-assistant-material-share-group-id',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [materialShareAccountIds, setMaterialShareAccountIds] = usePersistedState(
    'p-assistant-material-share-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [materialShareAssetIds, setMaterialShareAssetIds] = usePersistedState(
    'p-assistant-material-share-asset-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )

  const loadMaterialShareGroups = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    setLoadingMaterialShareGroups(true)
    try {
      const result = await pAssistantServiceExtended.getMaterialShareGroups(selectedConfigId)
      if (result.code === 0 && result.data?.groups) {
        const groups = result.data.groups
        setMaterialShareGroups(groups)
        setSelectedMaterialShareGroupId((prev) => {
          if (prev && groups.some((group) => group.group_id === prev)) return prev
          return groups[0]?.group_id || ''
        })
        addLog(`成功加载 ${groups.length} 个组织`, 'success')
      } else {
        addLog(`加载组织列表失败: ${result.error || result.msg || '未知错误'}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败'
      addLog(`加载组织列表失败: ${errorMessage}`, 'error')
    } finally {
      setLoadingMaterialShareGroups(false)
    }
  }

  useEffect(() => {
    if (
      selectedConfigId &&
      materialShareGroups.length === 0 &&
      !loadingMaterialShareGroups
    ) {
      void loadMaterialShareGroups()
    }
  }, [selectedConfigId])

  const handleMaterialShareSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    if (!selectedMaterialShareGroupId) {
      setError('请选择组织ID')
      return
    }

    const accountIdList = parseAccountIds(materialShareAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入账户ID列表')
      return
    }

    const assetIdList = parseAccountIds(materialShareAssetIds)
    if (assetIdList.length === 0) {
      setError('请输入素材ID列表')
      return
    }

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      `素材共享开始：组织 ${selectedMaterialShareGroupId}，素材 ${assetIdList.length} 个，目标账户 ${accountIdList.length} 个`,
      'info'
    )

    try {
      const result = await runPAssistantJob<MaterialShareResponse>('material_share', {
        selected_cookie_id: selectedConfigId,
        group_id: selectedMaterialShareGroupId,
        asset_ids: assetIdList,
        account_ids: accountIdList
      })

      if (result.code !== 0) {
        throw new Error(result.error || result.msg || '素材共享失败')
      }

      if (result.data) {
        const { total_success, total_error, results } = result.data
        addLog(
          `素材共享完成：成功 ${total_success}，失败 ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )
        if (total_error > 0) {
          const failedList = results.filter((item) => !item.success)
          const maxShow = 20
          failedList.slice(0, maxShow).forEach((item) => {
            addLog(`账户 ${item.account_id}: ${item.error || '素材共享失败'}`, 'error')
          })
          if (failedList.length > maxShow) {
            addLog(`还有 ${failedList.length - maxShow} 个失败账户未显示`, 'info')
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '素材共享失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="素材共享"
      description="按组织将指定素材批量共享给账户"
      icon={<ImagePlus />}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="material-share-group">选择组织ID *</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMaterialShareGroups}
            disabled={loadingMaterialShareGroups || !selectedConfigId}
          >
            {loadingMaterialShareGroups ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 w-4 h-4" />
                刷新组织
              </>
            )}
          </Button>
        </div>
        <select
          id="material-share-group"
          className="px-3 py-2 w-full rounded-md border bg-background"
          value={selectedMaterialShareGroupId}
          onChange={(e) => setSelectedMaterialShareGroupId(e.target.value)}
          disabled={loadingMaterialShareGroups || materialShareGroups.length === 0}
        >
          {materialShareGroups.length === 0 ? (
            <option value="">暂无组织，请刷新</option>
          ) : (
            materialShareGroups.map((group) => (
              <option key={group.group_id} value={group.group_id}>
                {group.group_name}({group.group_id})
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <Label>账户列表（一行一个）*</Label>
        <Textarea
          className="mt-2 min-h-[120px] font-mono text-sm"
          placeholder="请输入需要接收素材的账户ID，每行一个..."
          value={materialShareAccountIds}
          onChange={(e) => setMaterialShareAccountIds(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation()
            }
          }}
          disabled={loading}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          已输入 {parseAccountIds(materialShareAccountIds).length} 个账户
        </p>
      </div>

      <div>
        <Label>素材 ID 列表（一行一个）*</Label>
        <Textarea
          className="mt-2 min-h-[120px] font-mono text-sm"
          placeholder="请输入需要共享的素材ID，每行一个..."
          value={materialShareAssetIds}
          onChange={(e) => setMaterialShareAssetIds(e.target.value)}
          disabled={loading}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          已输入 {parseAccountIds(materialShareAssetIds).length} 个素材
        </p>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleMaterialShareSubmit}
          disabled={
            loading ||
            !selectedConfigId ||
            !selectedMaterialShareGroupId ||
            !materialShareAccountIds.trim() ||
            !materialShareAssetIds.trim()
          }
          size="lg"
          className="min-w-[140px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              推送中...
            </>
          ) : (
            <>
              <ArrowRight className="mr-2 w-4 h-4" />
              开始推送
            </>
          )}
        </Button>
      </div>
    </PAssistantFeaturePanel>
  )
}
