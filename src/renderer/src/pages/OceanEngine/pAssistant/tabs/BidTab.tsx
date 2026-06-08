import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Loader2, TrendingUp, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea
} from '../../../../components/ui'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  batchBidModifyService,
  type BatchModifyBidsResponse
} from '../../../../services/ocean-engine.service'

export const BidTab: React.FC = () => {
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

  // 出价修改相关状态
  const [bidAccountIds, setBidAccountIds] = usePersistedState<string>(
    'p-assistant-bid-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [isRangeBid, setIsRangeBid] = useState<string>('no')
  const [deepBid, setDeepBid] = useState<string>('')
  const [minBid, setMinBid] = useState<string>('')
  const [maxBid, setMaxBid] = useState<string>('')
  const [bidResults, setBidResults] = useState<any>(null)

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const handleModifyBids = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个配置')
      return
    }

    if (!bidAccountIds.trim()) {
      setError('请输入投放账户ID')
      return
    }

    const accountIdList = bidAccountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个投放账户ID')
      return
    }

    // 验证出价参数
    if (isRangeBid === 'yes') {
      if (!minBid || !maxBid) {
        setError('请输入最小出价和最大出价')
        return
      }
      const min = parseFloat(minBid)
      const max = parseFloat(maxBid)
      if (isNaN(min) || isNaN(max) || min >= max) {
        setError('最小出价必须小于最大出价')
        return
      }
    } else {
      if (!deepBid) {
        setError('请输入深度出价')
        return
      }
      const bid = parseFloat(deepBid)
      if (isNaN(bid) || bid <= 0) {
        setError('请输入有效的深度出价')
        return
      }
    }

    setLoading(true)
    setError('')
    setBidResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog('开始批量操作...', 'info')
    addLog(`目标账户数: ${accountIdList.length}`, 'info')

    try {
      // Step 1: 获取项目列表
      const projectsResponse = await batchBidModifyService.getAdProjects({
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId
      })

      if (projectsResponse.code !== 0) {
        throw new Error(projectsResponse.error || projectsResponse.msg || '获取项目列表失败')
      }

      if (projectsResponse.data) {
        addLog(
          `找到项目: 手动 ${projectsResponse.data.manual_count}, 自动 ${projectsResponse.data.auto_count}`,
          'info'
        )
      }

      // Step 2: 批量修改出价
      const modifyPayload: {
        account_ids: string[]
        enable_range_bid: 'yes' | 'no'
        selected_cookie_id: number
        deep_bid_value?: number
        deep_bid_min_value?: number
        deep_bid_max_value?: number
      } = {
        account_ids: accountIdList,
        enable_range_bid: isRangeBid as 'yes' | 'no',
        selected_cookie_id: selectedConfigId
      }

      if (isRangeBid === 'no') {
        modifyPayload.deep_bid_value = parseFloat(deepBid)
      } else {
        modifyPayload.deep_bid_min_value = parseFloat(minBid)
        modifyPayload.deep_bid_max_value = parseFloat(maxBid)
      }

      const modifyResponse = await runPAssistantJob<BatchModifyBidsResponse>(
        'batch_modify_bids',
        modifyPayload as unknown as Record<string, unknown>
      )

      if (modifyResponse.code !== 0) {
        throw new Error(modifyResponse.error || modifyResponse.msg || '批量修改失败')
      }

      if (modifyResponse.data) {
        const { total_success, total_error } = modifyResponse.data
        addLog(`修改完成! 成功: ${total_success}, 失败: ${total_error}`, 'success')

        if (modifyResponse.data.account_results) {
          modifyResponse.data.account_results.forEach((result) => {
            if (result.errors && result.errors.length > 0) {
              addLog(`账户 ${result.account_id}: ${result.errors.join('; ')}`, 'error')
            }
          })
        }
      }

      setBidResults(modifyResponse)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className="border-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            批量修改深度出价
          </CardTitle>
          <CardDescription>批量修改广告项目的深度出价</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 账户列表 */}
          <div className="grid gap-2">
            <Label htmlFor="bid-account-ids" className="text-base font-semibold">
              账户列表（一行一个） *
            </Label>
            <Textarea
              id="bid-account-ids"
              placeholder="请输入需要修改出价的账户ID，每行一个..."
              value={bidAccountIds}
              onChange={(e) => setBidAccountIds(e.target.value)}
              disabled={loading}
              className="min-h-[120px] resize-y font-mono text-sm"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              已输入 {parseAccountIds(bidAccountIds).length} 个账户
            </p>
          </div>

          {/* 是否区间出价 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">是否区间出价 *</Label>
            <RadioGroup
              value={isRangeBid}
              onValueChange={setIsRangeBid}
              disabled={loading}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="bid_range_no" />
                <Label htmlFor="bid_range_no" className="font-normal cursor-pointer">
                  否
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="bid_range_yes" />
                <Label htmlFor="bid_range_yes" className="font-normal cursor-pointer">
                  是
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 深度出价输入 */}
          {isRangeBid === 'no' ? (
            <div className="grid gap-2">
              <Label htmlFor="bid_deepBid" className="text-base font-semibold">
                深度出价 *
              </Label>
              <Input
                id="bid_deepBid"
                type="number"
                step="0.01"
                min="0"
                placeholder="请输入深度出价"
                value={deepBid}
                onChange={(e) => setDeepBid(e.target.value)}
                disabled={loading}
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">请输入有效的出价值（单位：元）</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <Label className="text-base font-semibold">深度出价区间 *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bid_minBid" className="text-sm font-normal">
                    最小值
                  </Label>
                  <Input
                    id="bid_minBid"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="最小出价"
                    value={minBid}
                    onChange={(e) => setMinBid(e.target.value)}
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bid_maxBid" className="text-sm font-normal">
                    最大值
                  </Label>
                  <Input
                    id="bid_maxBid"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="最大出价"
                    value={maxBid}
                    onChange={(e) => setMaxBid(e.target.value)}
                    disabled={loading}
                    className="h-11"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                最小值必须小于最大值，系统将在该区间内自动调整出价
              </p>
            </div>
          )}

          {/* 确定修改按钮 */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleModifyBids}
              disabled={
                loading ||
                !selectedConfigId ||
                !bidAccountIds.trim() ||
                (isRangeBid === 'no' ? !deepBid : !minBid || !maxBid)
              }
              size="lg"
              className="min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  修改中...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 w-4 h-4" />
                  确定修改
                </>
              )}
            </Button>
          </div>

          {/* 出价修改结果 */}
          {bidResults && bidResults.data && bidResults.data.account_results && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 mt-4 rounded-lg border bg-muted/50"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">修改结果</h4>
                <div className="flex gap-2 items-center">
                  <div className="flex gap-2 text-sm">
                    <span className="text-green-600">
                      成功: {bidResults.data.total_success || 0}
                    </span>
                    <span className="text-red-600">
                      失败: {bidResults.data.total_error || 0}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(bidResults.data.total_success || 0) > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const successIds = bidResults.data.account_results
                            .filter((result) => (result.success_count || 0) > 0)
                            .map((result) => result.account_id)
                            .join('\n')
                          copyToClipboard(successIds)
                        }}
                        className="text-xs"
                      >
                        复制成功ID
                      </Button>
                    )}
                    {(bidResults.data.total_error || 0) > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const failedIds = bidResults.data.account_results
                            .filter((result) => (result.error_count || 0) > 0)
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
                {bidResults.data.account_results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      (result.error_count || 0) === 0
                        ? 'bg-green-50 dark:bg-green-950/20'
                        : 'bg-red-50 dark:bg-red-950/20'
                    }`}
                  >
                    <span className="font-mono">{result.account_id}</span>
                    <div className="flex gap-2 items-center">
                      {(result.error_count || 0) === 0 ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">
                            修改成功 ({result.success_count || 0} 个项目)
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-red-600">
                            修改失败 ({result.error_count || 0} 个错误):{' '}
                            {result.errors && result.errors.length > 0
                              ? result.errors.join('; ')
                              : '未知错误'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
