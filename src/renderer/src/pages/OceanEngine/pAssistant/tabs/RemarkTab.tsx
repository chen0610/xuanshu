import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Tag } from 'lucide-react'
import { Button, Input, Label, Textarea } from '../../../../components/ui'
import { AccountIdsInput } from '../../AccountIdsInput'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { PAssistantResultPanel } from '../../PAssistantResultPanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { deserializeBoolean, persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  pAssistantService,
  type RemarkModifyResponse
} from '../../../../services/ocean-engine.service'
import { toast } from 'sonner'

const parseRemarkLines = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

export const RemarkTab: React.FC = () => {
  const {
    selectedConfigId,
    selectedOrgEbpId,
    loading,
    setLoading,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  const [remarkAccountIds, setRemarkAccountIds] = usePersistedState<string>(
    'p-assistant-remark-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [remark, setRemark] = usePersistedState<string>('p-assistant-remark', '', {
    shouldPersist: persistNonEmptyString
  })
  const [enableIncrement, setEnableIncrement] = usePersistedState<boolean>(
    'p-assistant-enable-increment',
    false,
    { deserialize: deserializeBoolean }
  )
  const [enableDate, setEnableDate] = usePersistedState<boolean>('p-assistant-enable-date', false, {
    deserialize: deserializeBoolean
  })
  const [remarkMode, setRemarkMode] = usePersistedState<'normal' | 'append' | 'pair'>(
    'p-assistant-remark-mode',
    'normal',
    {
      deserialize: (raw) =>
        raw === 'append' ? 'append' : raw === 'pair' ? 'pair' : 'normal'
    }
  )
  const [remarkPairRemarks, setRemarkPairRemarks] = usePersistedState<string>(
    'p-assistant-remark-pair-remarks',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [remarkKeyword, setRemarkKeyword] = usePersistedState<string>(
    'p-assistant-remark-keyword',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [remarkAppendDimension, setRemarkAppendDimension] = usePersistedState<'all' | 'account'>(
    'p-assistant-remark-append-dimension',
    'all',
    { deserialize: (raw) => (raw === 'account' ? 'account' : 'all') }
  )
  const [remarkAppendAccountIds, setRemarkAppendAccountIds] = usePersistedState<string>(
    'p-assistant-remark-append-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [remarkResults, setRemarkResults] = useState<RemarkModifyResponse | null>(null)

  const remarkPairAccountCount = useMemo(
    () => parseAccountIds(remarkAccountIds).length,
    [remarkAccountIds]
  )
  const remarkPairRemarkCount = useMemo(
    () => parseRemarkLines(remarkPairRemarks).length,
    [remarkPairRemarks]
  )
  const remarkPairCountMismatch =
    remarkMode === 'pair' &&
    remarkPairAccountCount > 0 &&
    remarkPairRemarkCount > 0 &&
    remarkPairAccountCount !== remarkPairRemarkCount

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const handleModifyRemark = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个配置')
      return
    }

    let accountIdList: string[] = []
    let remarkList: string[] | undefined

    if (remarkMode === 'pair') {
      accountIdList = parseAccountIds(remarkAccountIds)
      remarkList = parseRemarkLines(remarkPairRemarks)
      if (accountIdList.length === 0) {
        setError('请输入账户ID列表')
        return
      }
      if (remarkList.length === 0) {
        setError('请输入备注列表')
        return
      }
      if (accountIdList.length !== remarkList.length) {
        const mismatchMessage = `账户列表和备注数量必须一致：当前账户 ${accountIdList.length} 个，备注 ${remarkList.length} 个`
        setError(mismatchMessage)
        toast.error('左右数量不一致', { description: mismatchMessage })
        return
      }
    } else if (!remark.trim()) {
      setError('请输入备注名称')
      return
    }

    if (remarkMode === 'append') {
      if (remarkAppendDimension === 'account') {
        if (!selectedOrgEbpId.trim()) {
          setError('请选择组织节点')
          return
        }
        if (!remarkAppendAccountIds.trim()) {
          setError('请输入账户ID列表')
          return
        }
        accountIdList = parseAccountIds(remarkAppendAccountIds)
        if (accountIdList.length === 0) {
          setError('请至少输入一个账户ID')
          return
        }
      } else {
        if (!remarkKeyword.trim()) {
          setError('请输入备注关键字')
          return
        }

        setLoading(true)
        setError('')
        clearLogs()
        setIsBottomPanelOpen(true)
        addLog(`开始搜索账户，关键字: "${remarkKeyword}"`, 'info')

        try {
          const searchResult = await pAssistantService.searchAccountsByRemark({
            remark_keyword: remarkKeyword.trim(),
            selected_cookie_id: selectedConfigId
          })

          if (searchResult.code === 0 && searchResult.data?.accounts) {
            accountIdList = searchResult.data.accounts.map((account) => account.advertiser_id)
            addLog(`搜索完成，找到 ${accountIdList.length} 个匹配账户`, 'success')
          } else {
            addLog(`搜索失败: ${searchResult.error || '未知错误'}`, 'error')
            setLoading(false)
            return
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '搜索失败'
          setError(errorMessage)
          addLog(`搜索失败: ${errorMessage}`, 'error')
          setLoading(false)
          return
        }
      }
    } else if (remarkMode === 'normal') {
      if (!remarkAccountIds.trim()) {
        setError('请输入账户ID列表')
        return
      }

      accountIdList = parseAccountIds(remarkAccountIds)
      if (accountIdList.length === 0) {
        setError('请至少输入一个账户ID')
        return
      }
    }

    if (accountIdList.length === 0) {
      setError('未找到任何账户')
      setLoading(false)
      return
    }

    setError('')
    setRemarkResults(null)
    if (remarkMode !== 'append') {
      clearLogs()
      setIsBottomPanelOpen(true)
    }
    setLoading(true)
    const modeLabel =
      remarkMode === 'append'
        ? `（追加模式-${remarkAppendDimension === 'account' ? '指定账户' : '全账户'}）`
        : remarkMode === 'pair'
          ? '（一对一模式）'
          : '（常规模式）'
    addLog(`开始批量修改备注${modeLabel}，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const result = await runPAssistantJob<RemarkModifyResponse>('remark_modify', {
        account_ids: accountIdList,
        remark: remarkMode === 'pair' ? undefined : remark.trim(),
        remarks: remarkMode === 'pair' ? remarkList : undefined,
        enable_increment: remarkMode === 'pair' ? false : enableIncrement,
        enable_date: remarkMode === 'pair' ? false : enableDate,
        append_to_existing: remarkMode === 'append',
        append_dimension: remarkMode === 'append' ? remarkAppendDimension : undefined,
        remark_keyword:
          remarkMode === 'append' && remarkAppendDimension === 'all'
            ? remarkKeyword.trim()
            : undefined,
        ebp_id:
          remarkMode === 'append' && remarkAppendDimension === 'account'
            ? selectedOrgEbpId.trim()
            : undefined,
        selected_cookie_id: selectedConfigId
      })

      setRemarkResults(result)

      if (result.code === 0 && result.data) {
        const { total_success, total_error, results } = result.data
        addLog(
          `备注修改完成：成功 ${total_success} 个，失败 ${total_error} 个`,
          total_error === 0 ? 'success' : 'error'
        )

        results.forEach((r) => {
          if (!r.success) {
            addLog(`账户 ${r.account_id}: 备注修改失败 - ${r.error || '未知错误'}`, 'error')
          }
        })
      } else {
        addLog(`备注修改失败: ${result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '修改失败'
      setError(errorMessage)
      addLog(`备注修改失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="批量修改备注"
      description="批量为账户修改备注名称，支持自增编号和日期后缀"
      icon={<Tag />}
    >
      <div>
        <Label className="text-base font-semibold">修改模式</Label>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="remark-mode"
              value="normal"
              checked={remarkMode === 'normal'}
              onChange={(e) =>
                setRemarkMode(e.target.value as 'normal' | 'append' | 'pair')
              }
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <Label className="cursor-pointer">常规模式</Label>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="remark-mode"
              value="append"
              checked={remarkMode === 'append'}
              onChange={(e) =>
                setRemarkMode(e.target.value as 'normal' | 'append' | 'pair')
              }
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <Label className="cursor-pointer">追加模式</Label>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="remark-mode"
              value="pair"
              checked={remarkMode === 'pair'}
              onChange={(e) =>
                setRemarkMode(e.target.value as 'normal' | 'append' | 'pair')
              }
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <Label className="cursor-pointer">一对一修改</Label>
          </label>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          常规模式：统一修改备注；追加模式：搜索指定关键字的账户并追加备注；一对一修改：账户与备注逐行对应
        </p>
      </div>
      {remarkMode === 'append' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div>
            <Label className="text-base font-semibold">修改维度</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="remark-append-dimension"
                  value="all"
                  checked={remarkAppendDimension === 'all'}
                  onChange={(e) => setRemarkAppendDimension(e.target.value as 'all' | 'account')}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <Label className="cursor-pointer">全账户</Label>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="remark-append-dimension"
                  value="account"
                  checked={remarkAppendDimension === 'account'}
                  onChange={(e) => setRemarkAppendDimension(e.target.value as 'all' | 'account')}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <Label className="cursor-pointer">指定账户</Label>
              </label>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              全账户：按备注关键字搜索账户；指定账户：按当前选中组织节点查询指定账户原备注后追加
            </p>
          </div>
          {remarkAppendDimension === 'all' ? (
            <div>
              <Label htmlFor="remark-keyword">账户关键字 *</Label>
              <Input
                id="remark-keyword"
                className="mt-2"
                placeholder="请输入账户关键字，用于搜索匹配的账户"
                value={remarkKeyword}
                onChange={(e) => setRemarkKeyword(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="remark-append-account-ids">账户列表 *</Label>
              <Textarea
                id="remark-append-account-ids"
                placeholder="请输入需要追加备注的账户ID，每行一个..."
                value={remarkAppendAccountIds}
                onChange={(e) => setRemarkAppendAccountIds(e.target.value)}
                disabled={loading}
                className="mt-2 min-h-[160px] resize-y font-mono"
                rows={7}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                将使用当前选中的组织节点 ID 查询账户原备注
              </p>
            </div>
          )}
        </motion.div>
      )}
      {remarkMode === 'normal' && (
        <AccountIdsInput
          value={remarkAccountIds}
          onChange={setRemarkAccountIds}
          placeholder="请输入需要修改备注的账户ID，每行一个..."
        />
      )}
      {remarkMode === 'pair' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="remark-pair-account-ids" className="text-base font-semibold">
              账户列表（一行一个） *
            </Label>
            <Textarea
              id="remark-pair-account-ids"
              placeholder="请输入账户ID，每行一个..."
              value={remarkAccountIds}
              onChange={(e) => setRemarkAccountIds(e.target.value)}
              disabled={loading}
              className="min-h-[180px] resize-y font-mono"
              rows={8}
            />
            <p
              className={`text-sm ${
                remarkPairCountMismatch
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              已输入 {remarkPairAccountCount} 个账户
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remark-pair-remarks" className="text-base font-semibold">
              备注信息（一行一个） *
            </Label>
            <Textarea
              id="remark-pair-remarks"
              placeholder="请输入备注，每行一个，需与左侧账户逐行对应..."
              value={remarkPairRemarks}
              onChange={(e) => setRemarkPairRemarks(e.target.value)}
              disabled={loading}
              className="min-h-[180px] resize-y"
              rows={8}
            />
            <p
              className={`text-sm ${
                remarkPairCountMismatch
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              已输入 {remarkPairRemarkCount} 个备注
            </p>
          </div>
        </div>
      )}
      {remarkPairCountMismatch && (
        <div className="p-3 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
          账户与备注数量不一致：当前账户 {remarkPairAccountCount} 个，备注{' '}
          {remarkPairRemarkCount} 个，请保持左右两列行数一致后再提交
        </div>
      )}
      {remarkMode !== 'pair' && (
        <div>
          <Label htmlFor="remark">
            {remarkMode === 'append' ? '追加备注名称 *' : '备注名称 *'}
          </Label>
          <Input
            id="remark"
            className="mt-2"
            placeholder="请输入备注名称，例如：测试账户"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
        </div>
      )}
      {remarkMode !== 'pair' && (
        <>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enable-increment"
              checked={enableIncrement}
              onChange={(e) => setEnableIncrement(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="enable-increment" className="cursor-pointer">
              自增编号
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enable-date"
              checked={enableDate}
              onChange={(e) => setEnableDate(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="enable-date" className="cursor-pointer">
              添加日期
            </Label>
          </div>
        </>
      )}
      <div className="p-3 space-y-1 text-sm rounded-lg bg-muted/50">
        <div className="mb-2 font-semibold">示例：</div>
        {remarkMode === 'pair' ? (
          <>
            <div>• 账户 123456 → 备注「测试账户A」</div>
            <div>• 账户 789012 → 备注「测试账户B」</div>
            <div>• 左右两列按行一一对应，数量必须一致</div>
          </>
        ) : (
          <>
            <div>• 基础备注: &quot;测试账户&quot;</div>
            <div>• 追加模式: 输入关键字&quot;测试&quot;，自动搜索匹配账户并追加备注</div>
            <div>• 自增编号: &quot;测试账户-1&quot;, &quot;测试账户-2&quot;, ...</div>
            <div>• 添加日期: &quot;测试账户-2025/11/11&quot;</div>
            <div>• 两者都选: &quot;测试账户-1-2025/11/11&quot;</div>
            <div>• 全部功能: &quot;原有备注测试账户-1-2025/11/11&quot;</div>
          </>
        )}
      </div>
      <Button
        onClick={handleModifyRemark}
        disabled={
          loading ||
          !selectedConfigId ||
          (remarkMode === 'normal' && !remarkAccountIds.trim()) ||
          (remarkMode === 'pair' &&
            (!remarkAccountIds.trim() || !remarkPairRemarks.trim())) ||
          (remarkMode !== 'pair' && !remark.trim()) ||
          (remarkMode === 'append' &&
            remarkAppendDimension === 'all' &&
            !remarkKeyword.trim()) ||
          (remarkMode === 'append' &&
            remarkAppendDimension === 'account' &&
            (!remarkAppendAccountIds.trim() || !selectedOrgEbpId.trim()))
        }
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            修改中...
          </>
        ) : (
          <>
            <Tag className="mr-2 w-4 h-4" />
            {remarkMode === 'append'
              ? '搜索并修改备注'
              : remarkMode === 'pair'
                ? '确认一对一修改备注'
                : '确认修改备注'}
          </>
        )}
      </Button>

      {/* 备注修改结果 */}
      {remarkResults && remarkResults.data && (
        <PAssistantResultPanel
          title="修改结果"
          totalSuccess={remarkResults.data.total_success}
          totalError={remarkResults.data.total_error}
          results={remarkResults.data.results}
          copyToClipboard={copyToClipboard}
          renderSuccessMessage={(result) => <>→ &quot;{result.final_remark}&quot;</>}
        />
      )}
    </PAssistantFeaturePanel>
  )
}
