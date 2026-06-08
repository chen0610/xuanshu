import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Button } from '../../../../components/ui'
import { AccountIdsInput } from '../../AccountIdsInput'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { ClearMaterialResponse } from '../../../../services/ocean-engine.service'

export const ClearMaterialTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [clearMaterialAccountIds, setClearMaterialAccountIds] = usePersistedState<string>(
    'p-assistant-clear-material-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [clearMaterialResults, setClearMaterialResults] = useState<ClearMaterialResponse | null>(null)

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const handleClearMaterials = async (): Promise<void> => {
    if (!selectedConfigId) { setError('请选择一个配置'); return }
    if (!clearMaterialAccountIds.trim()) { setError('请输入账户ID列表'); return }

    const accountIdList = parseAccountIds(clearMaterialAccountIds)
    if (accountIdList.length === 0) { setError('请至少输入一个账户ID'); return }

    const confirmMessage = `⚠️ 警告：此操作将永久删除账户中的所有素材！\n\n此操作不可逆，删除的素材将无法恢复。\n建议提前备份重要素材。\n\n确定要继续吗？`
    if (!window.confirm(confirmMessage)) return

    setLoading(true)
    setError('')
    setClearMaterialResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`开始批量清空素材，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const result = await runPAssistantJob<ClearMaterialResponse>('clear_materials', {
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId
      })

      setClearMaterialResults(result)

      if (result.code === 0 && result.data) {
        const { total_success, total_error, total_deleted, unknown_count, results } = result.data
        const deletedMsg =
          unknown_count && unknown_count > 0
            ? `成功 ${total_success} 个，失败 ${total_error} 个（${unknown_count} 个异步任务，删除数量未知）`
            : `成功 ${total_success} 个，失败 ${total_error} 个，共删除 ${total_deleted} 个素材`
        addLog(`清空素材完成：${deletedMsg}`, total_error === 0 ? 'success' : 'error')

        results.forEach((r) => {
          if (r.success) {
            if (r.deleted_count === -1) {
              addLog(`账户 ${r.account_id}: 清空任务已创建（异步处理中，删除数量未知）`, 'success')
            } else {
              addLog(`账户 ${r.account_id}: 清空成功，删除了 ${r.deleted_count} 个素材`, 'success')
            }
          } else {
            addLog(`账户 ${r.account_id}: 清空失败 - ${r.error || '未知错误'}`, 'error')
          }
        })
      } else {
        addLog(`清空素材失败: ${result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '清空失败'
      setError(errorMessage)
      addLog(`清空素材失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="批量清空素材"
      description="⚠️ 此操作将清空账户中的所有素材（近7天），请谨慎操作！"
      icon={<XCircle />}
      danger
    >
      <AccountIdsInput
        value={clearMaterialAccountIds}
        onChange={setClearMaterialAccountIds}
        placeholder="请输入需要清空素材的账户ID，每行一个..."
      />
      <Button
        onClick={handleClearMaterials}
        disabled={loading || !selectedConfigId || !clearMaterialAccountIds.trim()}
        className="w-full"
        variant="destructive"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            清空中...
          </>
        ) : (
          <>
            <XCircle className="mr-2 w-4 h-4" />
            确认清空素材
          </>
        )}
      </Button>

      {/* 清空素材结果 */}
      {clearMaterialResults?.data && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 mt-4 rounded-lg border bg-muted/50"
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">清空结果</h4>
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 text-sm">
                <span className="text-green-600">
                  成功: {clearMaterialResults.data.total_success}
                </span>
                <span className="text-red-600">
                  失败: {clearMaterialResults.data.total_error}
                </span>
                {clearMaterialResults.data.unknown_count &&
                clearMaterialResults.data.unknown_count > 0 ? (
                  <span className="text-yellow-600">
                    异步任务: {clearMaterialResults.data.unknown_count} 个
                  </span>
                ) : (
                  <span className="text-blue-600">
                    已删除: {clearMaterialResults.data.total_deleted} 个素材
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {clearMaterialResults.data.total_success > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const successIds = clearMaterialResults.data.results
                        .filter((result) => result.success)
                        .map((result) => result.account_id)
                        .join('\n')
                      copyToClipboard(successIds)
                    }}
                    className="text-xs"
                  >
                    复制成功ID
                  </Button>
                )}
                {clearMaterialResults.data.total_error > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const failedIds = clearMaterialResults.data.results
                        .filter((result) => !result.success)
                        .map((result) => result.account_id)
                        .join('\n')
                      copyToClipboard(failedIds)
                    }}
                    className="text-xs"
                  >
                    复制失败ID
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-y-auto space-y-1 max-h-60">
            {clearMaterialResults.data.results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded text-sm ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-950/20'
                    : 'bg-red-50 dark:bg-red-950/20'
                }`}
              >
                <span className="font-mono">{result.account_id}</span>
                <div className="flex gap-2 items-center">
                  {result.success ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">
                        {result.deleted_count === -1
                          ? '清空任务已创建（异步处理中）'
                          : `清空成功，删除了 ${result.deleted_count} 个素材`}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-600">{result.error}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </PAssistantFeaturePanel>
  )
}
