import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, FileText, Loader2, Settings, XCircle } from 'lucide-react'
import { Button, Input, Label } from '../../../../components/ui'
import { AccountIdsInput } from '../../AccountIdsInput'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { PAssistantResultPanel } from '../../PAssistantResultPanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { RTABindResponse, RTACheckResponse } from '../../../../services/ocean-engine.service'

export const RtaTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [rtaAccountIds, setRtaAccountIds] = usePersistedState<string>(
    'p-assistant-rta-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [rtaId, setRtaId] = usePersistedState<string>('p-assistant-rta-id', '34475', {
    shouldPersist: persistNonEmptyString
  })
  const [rtaBindResults, setRtaBindResults] = useState<RTABindResponse | null>(null)
  const [rtaCheckResults, setRtaCheckResults] = useState<RTACheckResponse | null>(null)

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const handleBindRTA = async (): Promise<void> => {
    if (!selectedConfigId) { setError('请选择一个配置'); return }
    const accountIdList = parseAccountIds(rtaAccountIds)
    if (accountIdList.length === 0) { setError('请至少输入一个账户ID'); return }
    if (!rtaId.trim()) { setError('请输入RTA策略ID'); return }

    setLoading(true)
    setError('')
    setRtaBindResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`开始批量绑定RTA策略 ${rtaId}，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const result = await runPAssistantJob<RTABindResponse>('rta_bind', {
        account_ids: accountIdList,
        rta_id: parseInt(rtaId),
        selected_cookie_id: selectedConfigId
      })
      setRtaBindResults(result)
      if (result.code === 0 && result.data) {
        addLog(
          `RTA绑定完成：成功 ${result.data.total_success} 个，失败 ${result.data.total_error} 个`,
          result.data.total_error === 0 ? 'success' : 'error'
        )
        result.data.results.forEach((r) => {
          if (r.success) addLog(`账户 ${r.account_id}: ${r.message || '绑定成功'}`, 'success')
          else addLog(`账户 ${r.account_id}: ${r.error || '绑定失败'}`, 'error')
        })
      } else {
        addLog(`RTA绑定失败: ${result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '绑定失败'
      setError(msg)
      addLog(`RTA绑定失败: ${msg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckRTA = async (): Promise<void> => {
    if (!selectedConfigId) { setError('请选择一个配置'); return }
    const accountIdList = parseAccountIds(rtaAccountIds)
    if (accountIdList.length === 0) { setError('请至少输入一个账户ID'); return }

    setLoading(true)
    setError('')
    setRtaCheckResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`开始批量检查RTA状态，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const result = await runPAssistantJob<RTACheckResponse>('rta_check', {
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId
      })
      setRtaCheckResults(result)
      if (result.code === 0 && result.data) {
        addLog(`RTA检查完成：已绑定 ${result.data.total_bound} 个，未绑定 ${result.data.total_unbound} 个`, 'success')
        result.data.results.forEach((r) => {
          if (r.is_bound) addLog(`账户 ${r.account_id}: 已绑定 [${r.rta_id || '未知'}]`, 'success')
          else addLog(`账户 ${r.account_id}: 未绑定${r.error ? ` - ${r.error}` : ''}`, 'error')
        })
      } else {
        addLog(`RTA检查失败: ${result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '检查失败'
      setError(msg)
      addLog(`RTA检查失败: ${msg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="RTA策略绑定"
      description="批量为账户绑定RTA策略"
      icon={<Settings />}
    >
      <AccountIdsInput
        value={rtaAccountIds}
        onChange={setRtaAccountIds}
        placeholder="请输入需要绑定RTA策略的账户ID，每行一个..."
      />
      <div>
        <Label htmlFor="rta-id">RTA策略ID</Label>
        <Input
          id="rta-id"
          className="mt-2"
          placeholder="请输入RTA策略ID，例如：34475"
          value={rtaId}
          onChange={(e) => setRtaId(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleBindRTA}
          disabled={loading || !selectedConfigId || !rtaAccountIds.trim() || !rtaId.trim()}
          className="flex-1"
        >
          {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Settings className="mr-2 w-4 h-4" />}
          {loading ? '绑定中...' : '批量绑定RTA'}
        </Button>
        <Button
          onClick={handleCheckRTA}
          disabled={loading || !selectedConfigId || !rtaAccountIds.trim()}
          variant="outline"
          className="flex-1"
        >
          {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <FileText className="mr-2 w-4 h-4" />}
          {loading ? '检查中...' : '批量检查RTA'}
        </Button>
      </div>

      {/* RTA绑定结果 */}
      {rtaBindResults?.data && (
        <PAssistantResultPanel
          title="绑定结果"
          totalSuccess={rtaBindResults.data.total_success}
          totalError={rtaBindResults.data.total_error}
          results={rtaBindResults.data.results}
          copyToClipboard={copyToClipboard}
          renderSuccessMessage={(result) => result.message}
        />
      )}

      {/* RTA检查结果 */}
      {rtaCheckResults?.data && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 mt-4 rounded-lg border bg-muted/50"
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">检查结果</h4>
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 text-sm">
                <span className="text-green-600">已绑定: {rtaCheckResults.data.total_bound}</span>
                <span className="text-red-600">未绑定: {rtaCheckResults.data.total_unbound}</span>
              </div>
              <div className="flex gap-1">
                {rtaCheckResults.data.total_bound > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ids = rtaCheckResults.data!.results
                        .filter((r) => r.is_bound)
                        .map((r) => r.account_id)
                        .join('\n')
                      copyToClipboard(ids)
                    }}
                    className="text-xs"
                  >
                    复制已绑定ID
                  </Button>
                )}
                {rtaCheckResults.data.total_unbound > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ids = rtaCheckResults.data!.results
                        .filter((r) => !r.is_bound)
                        .map((r) => r.account_id)
                        .join('\n')
                      copyToClipboard(ids)
                    }}
                    className="text-xs"
                  >
                    复制未绑定ID
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-y-auto space-y-1 max-h-60">
            {rtaCheckResults.data.results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded text-sm ${
                  result.is_bound ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
                }`}
              >
                <span className="font-mono">{result.account_id}</span>
                <div className="flex gap-2 items-center">
                  {result.is_bound ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">已绑定 [{result.rta_id || '未知'}]</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-600">未绑定{result.error ? ` - ${result.error}` : ''}</span>
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
