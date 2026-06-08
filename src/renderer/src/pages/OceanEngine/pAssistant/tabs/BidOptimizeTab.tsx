import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, TrendingUp } from 'lucide-react'
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
  adOptimizeService,
  type AdOptimizeFilter
} from '../../../../services/ocean-engine.service'

export const BidOptimizeTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    addLog,
    clearLogs,
    setIsBottomPanelOpen
  } = usePAssistantContext()

  // 出价修改相关状态
  const [optimizeBidAccountIds, setOptimizeBidAccountIds] = usePersistedState<string>(
    'p-assistant-optimize-bid-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [bidValue, setBidValue] = useState('')
  const [bidFilterEnabled, setBidFilterEnabled] = useState(false)
  const [bidFilter, setBidFilter] = useState<AdOptimizeFilter>({
    filter_enabled: false,
    spend_value: 0,
    spend_operator: 'gte',
    conversion_num_value: 0,
    conversion_num_operator: 'gte',
    conversion_cost_value: 0,
    conversion_cost_operator: 'gte',
    delivery_mode: 'all',
    keyword: ''
  })

  const handleBidOptimize = async (): Promise<void> => {
    clearLogs()
    setIsBottomPanelOpen(true)

    if (!selectedConfigId) {
      addLog('请选择Cookie配置', 'error')
      return
    }

    const accountIdList = parseAccountIds(optimizeBidAccountIds)
    if (accountIdList.length === 0) {
      addLog('请填写账户ID列表', 'error')
      return
    }

    const bid = parseFloat(bidValue)
    if (isNaN(bid) || bid <= 0) {
      addLog('请填写有效的出价值', 'error')
      return
    }

    setLoading(true)
    addLog('开始批量修改出价...', 'info')

    try {
      const response = await adOptimizeService.optimizeBid({
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        filter: {
          ...bidFilter,
          filter_enabled: bidFilterEnabled
        },
        bid_value: bid
      })

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '批量修改失败')
      }

      if (response.data) {
        const { total_success, total_error, account_results } = response.data
        addLog(
          `修改完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        account_results?.forEach((result) => {
          if (result.error_count > 0) {
            result.errors.forEach((err) => {
              addLog(`账户 ${result.account_id}: ${err}`, 'error')
            })
          }
        })
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改失败'
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
            出价修改
          </CardTitle>
          <CardDescription>根据筛选条件批量优化广告出价</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 账户列表 */}
          <div className="space-y-2">
            <Label htmlFor="optimizeBidAccountIds" className="text-base font-semibold">
              账户列表（一行一个） *
            </Label>
            <Textarea
              id="optimizeBidAccountIds"
              placeholder="请输入账户ID，每行一个"
              value={optimizeBidAccountIds}
              onChange={(e) => setOptimizeBidAccountIds(e.target.value)}
              disabled={loading}
              className="min-h-[100px] resize-y"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">每行填写一个账户ID</p>
          </div>

          {/* 筛选条件 */}
          <div className="p-4 space-y-4 rounded-md border">
            <div className="flex gap-4 items-center">
              <Label className="text-base font-semibold">筛选条件</Label>
              <RadioGroup
                value={bidFilterEnabled ? 'yes' : 'no'}
                onValueChange={(value) => setBidFilterEnabled(value === 'yes')}
                disabled={loading}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="bid-filter-yes" />
                  <Label htmlFor="bid-filter-yes" className="cursor-pointer">
                    启用
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="bid-filter-no" />
                  <Label htmlFor="bid-filter-no" className="cursor-pointer">
                    禁用
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {bidFilterEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
              >
                {/* 消耗 */}
                <div className="space-y-2">
                  <Label>消耗</Label>
                  <div className="flex gap-2">
                    <RadioGroup
                      value={bidFilter.spend_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setBidFilter((prev) => ({ ...prev, spend_operator: value }))
                      }
                      disabled={loading}
                      className="flex gap-2"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="gte" id="bid-spend-gte" />
                        <Label htmlFor="bid-spend-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="lte" id="bid-spend-lte" />
                        <Label htmlFor="bid-spend-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="消耗金额"
                      value={bidFilter.spend_value || ''}
                      onChange={(e) =>
                        setBidFilter((prev) => ({
                          ...prev,
                          spend_value: e.target.value ? parseFloat(e.target.value) : 0
                        }))
                      }
                      disabled={loading}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 转化数 */}
                <div className="space-y-2">
                  <Label>转化数</Label>
                  <div className="flex gap-2">
                    <RadioGroup
                      value={bidFilter.conversion_num_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setBidFilter((prev) => ({
                          ...prev,
                          conversion_num_operator: value
                        }))
                      }
                      disabled={loading}
                      className="flex gap-2"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="gte" id="bid-num-gte" />
                        <Label htmlFor="bid-num-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="lte" id="bid-num-lte" />
                        <Label htmlFor="bid-num-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="转化数"
                      value={bidFilter.conversion_num_value || ''}
                      onChange={(e) =>
                        setBidFilter((prev) => ({
                          ...prev,
                          conversion_num_value: e.target.value
                            ? parseInt(e.target.value)
                            : 0
                        }))
                      }
                      disabled={loading}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 转化成本 */}
                <div className="space-y-2">
                  <Label>转化成本</Label>
                  <div className="flex gap-2">
                    <RadioGroup
                      value={bidFilter.conversion_cost_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setBidFilter((prev) => ({
                          ...prev,
                          conversion_cost_operator: value
                        }))
                      }
                      disabled={loading}
                      className="flex gap-2"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="gte" id="bid-cost-gte" />
                        <Label htmlFor="bid-cost-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="lte" id="bid-cost-lte" />
                        <Label htmlFor="bid-cost-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="转化成本"
                      value={bidFilter.conversion_cost_value || ''}
                      onChange={(e) =>
                        setBidFilter((prev) => ({
                          ...prev,
                          conversion_cost_value: e.target.value
                            ? parseFloat(e.target.value)
                            : 0
                        }))
                      }
                      disabled={loading}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 关键字 */}
                <div className="space-y-2">
                  <Label>关键字</Label>
                  <Input
                    placeholder="输入关键字"
                    value={bidFilter.keyword || ''}
                    onChange={(e) =>
                      setBidFilter((prev) => ({ ...prev, keyword: e.target.value }))
                    }
                    disabled={loading}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* 出价值设置 */}
          <div className="space-y-2">
            <Label htmlFor="bidValue" className="text-base font-semibold">
              出价值 *
            </Label>
            <Input
              id="bidValue"
              type="number"
              placeholder="请输入新出价"
              value={bidValue}
              onChange={(e) => setBidValue(e.target.value)}
              disabled={loading}
              step="0.01"
              min="0"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <Button
              onClick={handleBidOptimize}
              disabled={
                loading ||
                !selectedConfigId ||
                !optimizeBidAccountIds.trim() ||
                !bidValue.trim()
              }
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              确认修改出价
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
