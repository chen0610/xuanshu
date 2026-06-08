import React from 'react'
import { FolderX, Loader2 } from 'lucide-react'
import { Button, Label, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { EmptyProjectCleanupResponse } from '../../../../services/ocean-engine.service'

export const EmptyProjectCleanupTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [emptyProjectCleanupAccountIds, setEmptyProjectCleanupAccountIds] = usePersistedState(
    'p-assistant-empty-project-cleanup-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )

  const handleEmptyProjectCleanup = async (): Promise<void> => {
    if (!selectedConfigId) { setError('请选择Cookie配置'); return }

    const accountIdList = parseAccountIds(emptyProjectCleanupAccountIds).filter((id) =>
      /^\d+$/.test(id)
    )
    if (accountIdList.length === 0) { setError('请输入至少一个账户ID'); return }

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`提交空项目清理队列任务，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const response = await runPAssistantJob<EmptyProjectCleanupResponse>(
        'empty_project_cleanup',
        {
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId
        }
      )
      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '空项目清理失败')
      }

      if (response.data) {
        const { results, summary } = response.data
        results.forEach((result) => {
          if (result.success) {
            addLog(
              `账户 ${result.account_id}: 识别 ${result.project_count} 个空项目，已删除 ${result.deleted_count} 个${result.error ? `（${result.error}）` : ''}`,
              result.deleted_count > 0 ? 'success' : 'info'
            )
          } else {
            addLog(`账户 ${result.account_id}: 处理失败 - ${result.error || '未知错误'}`, 'error')
          }
        })
        addLog(
          `清理完成：${summary.total_accounts} 个账户，识别 ${summary.total_project_count} 个空项目，删除 ${summary.total_deleted_count} 个`,
          'success'
        )
      } else {
        addLog('空项目清理任务执行完成', 'success')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '空项目清理失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="空项目清理"
      description="扫描账户项目与广告，识别无未删除广告的空项目并同步删除（支持多Cookie并发）。"
      icon={<FolderX />}
    >
      <div className="grid gap-2">
        <Label
          htmlFor="p-assistant-empty-project-cleanup-account-ids"
          className="text-base font-semibold"
        >
          账户列表（一行一个）*
        </Label>
        <Textarea
          id="p-assistant-empty-project-cleanup-account-ids"
          placeholder="请输入需要清理空项目的账户ID，每行一个..."
          value={emptyProjectCleanupAccountIds}
          onChange={(e) => setEmptyProjectCleanupAccountIds(e.target.value)}
          disabled={loading}
          className="min-h-[120px] resize-y font-mono text-sm"
          rows={5}
        />
        <p className="text-sm text-muted-foreground">
          已输入 {parseAccountIds(emptyProjectCleanupAccountIds).length} 个账户
        </p>
      </div>
      <Button
        onClick={handleEmptyProjectCleanup}
        disabled={loading || !selectedConfigId || !emptyProjectCleanupAccountIds.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            清理中...
          </>
        ) : (
          <>
            <FolderX className="mr-2 w-4 h-4" />
            提交空项目清理任务
          </>
        )}
      </Button>
    </PAssistantFeaturePanel>
  )
}
