// 弃用
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Sparkles, X, FileText, XCircle, CheckCircle } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Textarea,
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
import { adOptimizeService, type AdOptimizeFilter } from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: Date
}

export const AdOptimizePage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [accountIds, setAccountIds] = useState('')
  const [optimizeType, setOptimizeType] = useState<'schedule' | 'bid'>('schedule')
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [filter, setFilter] = useState<AdOptimizeFilter>({
    filter_enabled: false,
    spend_value: 0,
    spend_operator: 'gte',
    conversion_num_value: 1,
    conversion_num_operator: 'gte',
    conversion_cost_value: 0,
    conversion_cost_operator: 'gte',
    delivery_mode: 'all',
    keyword: ''
  })
  const [timeType, setTimeType] = useState<'unlimited' | 'custom'>('unlimited')
  const [weekSchedule, setWeekSchedule] = useState<boolean[][]>(
    Array(7)
      .fill(null)
      .map(() => Array(48).fill(true))
  )
  const [bidValue, setBidValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)

  // 拖动选择相关状态
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: number; slot: number } | null>(null)
  const [dragTargetState, setDragTargetState] = useState<boolean | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async (): Promise<void> => {
    try {
      const oceanConfigs = await configService.getConfigsBySource(1)
      setConfigs(oceanConfigs)
      if (oceanConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(oceanConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      addLog('加载配置失败', 'error')
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
    setIsLogPanelOpen(true)
  }

  const handleScheduleOptimize = async (): Promise<void> => {
    // 先清空之前的操作日志
    setLogs([])
    setIsLogPanelOpen(true)

    if (!selectedConfigId) {
      addLog('请选择Cookie配置', 'error')
      return
    }

    const accountIdList = accountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      addLog('请填写账户ID列表', 'error')
      return
    }

    if (timeType === 'custom') {
      const hasSelection = weekSchedule.some((day) => day.some((slot) => slot))
      if (!hasSelection) {
        addLog('请选择投放时段', 'error')
        return
      }
    }

    setIsSubmitting(true)
    addLog('开始批量调整投放时段...', 'info')

    try {
      const weekScheduleStr =
        timeType === 'custom'
          ? weekSchedule.map(
              (day) =>
                day
                  .map((selected, index) => (selected ? index.toString() : null))
                  .filter((v) => v !== null) as string[]
            )
          : undefined

      const response = await adOptimizeService.optimizeSchedule({
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        filter: {
          ...filter,
          filter_enabled: filterEnabled
        },
        time_type: timeType,
        week_schedule: weekScheduleStr
      })

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '批量调整失败')
      }

      if (response.data) {
        const { total_success, total_error, account_results } = response.data
        addLog(
          `调整完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        account_results?.forEach((result) => {
          if (result.success_count > 0) {
            addLog(`账户 ${result.account_id}: 成功处理 ${result.success_count} 个项目`, 'success')
          }
          if (result.error_count > 0) {
            result.errors.forEach((err) => {
              addLog(`账户 ${result.account_id}: ${err}`, 'error')
            })
          }
        })
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '调整失败'
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBidOptimize = async (): Promise<void> => {
    // 先清空之前的操作日志
    setLogs([])
    setIsLogPanelOpen(true)

    if (!selectedConfigId) {
      addLog('请选择Cookie配置', 'error')
      return
    }

    const accountIdList = accountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      addLog('请填写账户ID列表', 'error')
      return
    }

    const bid = parseFloat(bidValue)
    if (isNaN(bid) || bid <= 0) {
      addLog('请填写有效的出价值', 'error')
      return
    }

    setIsSubmitting(true)
    addLog('开始批量修改出价...', 'info')

    try {
      const response = await adOptimizeService.optimizeBid({
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        filter: {
          ...filter,
          filter_enabled: filterEnabled
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
          if (result.success_count > 0) {
            addLog(
              `账户 ${result.account_id}: 成功处理 ${result.success_count} 个（手动: ${result.manual_projects_processed}, 自动: ${result.auto_projects_processed}）`,
              'success'
            )
          }
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
      setIsSubmitting(false)
    }
  }

  const toggleTimeSlot = (day: number, slot: number): void => {
    setWeekSchedule((prev) => {
      const newSchedule = prev.map((d, dIdx) =>
        dIdx === day ? d.map((s, sIdx) => (sIdx === slot ? !s : s)) : d
      )
      return newSchedule
    })
  }

  const selectTimeRange = (
    day: number,
    startSlot: number,
    endSlot: number,
    value: boolean
  ): void => {
    setWeekSchedule((prev) => {
      const newSchedule = prev.map((d, dIdx) =>
        dIdx === day ? d.map((s, sIdx) => (sIdx >= startSlot && sIdx <= endSlot ? value : s)) : d
      )
      return newSchedule
    })
  }

  const handleMouseDown = (day: number, slot: number): void => {
    setIsDragging(true)
    const startPos = { day, slot }
    setDragStart(startPos)
    setDragEnd(startPos)
    // 记录目标状态（反转当前状态）
    const currentState = weekSchedule[day][slot]
    setDragTargetState(!currentState)
    // 立即反转起始点
    setWeekSchedule((prev) => {
      const newSchedule = prev.map((d, dIdx) =>
        dIdx === day ? d.map((s, sIdx) => (sIdx === slot ? !s : s)) : d
      )
      return newSchedule
    })
  }

  const handleMouseMove = (day: number, slot: number): void => {
    if (!isDragging || !dragStart || dragTargetState === null) return

    const newEnd = { day, slot }
    setDragEnd(newEnd)

    // 计算范围
    const startDay = Math.min(dragStart.day, day)
    const endDay = Math.max(dragStart.day, day)
    const startSlot =
      dragStart.day === day
        ? Math.min(dragStart.slot, slot)
        : dragStart.day < day
          ? dragStart.slot
          : slot
    const endSlot =
      dragStart.day === day
        ? Math.max(dragStart.slot, slot)
        : dragStart.day < day
          ? slot
          : dragStart.slot

    // 应用选择到范围内
    setWeekSchedule((prev) => {
      const newSchedule = prev.map((d, dIdx) => {
        if (dIdx >= startDay && dIdx <= endDay) {
          return d.map((s, sIdx) => {
            if (dIdx === startDay && dIdx === endDay) {
              // 同一天
              return sIdx >= startSlot && sIdx <= endSlot ? dragTargetState : s
            } else if (dIdx === startDay) {
              // 起始天
              return sIdx >= startSlot ? dragTargetState : s
            } else if (dIdx === endDay) {
              // 结束天
              return sIdx <= endSlot ? dragTargetState : s
            } else {
              // 中间天
              return dragTargetState
            }
          })
        }
        return d
      })
      return newSchedule
    })
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
    setDragTargetState(null)
  }

  // 获取时间段是否在拖动范围内
  const isInDragRange = (day: number, slot: number): boolean => {
    if (!isDragging || !dragStart || !dragEnd) return false

    const startDay = Math.min(dragStart.day, dragEnd.day)
    const endDay = Math.max(dragStart.day, dragEnd.day)
    const startSlot =
      dragStart.day === dragEnd.day
        ? Math.min(dragStart.slot, dragEnd.slot)
        : dragStart.day < dragEnd.day
          ? dragStart.slot
          : dragEnd.slot
    const endSlot =
      dragStart.day === dragEnd.day
        ? Math.max(dragStart.slot, dragEnd.slot)
        : dragStart.day < dragEnd.day
          ? dragEnd.slot
          : dragStart.slot

    if (day < startDay || day > endDay) return false
    if (day === startDay && day === endDay) {
      return slot >= startSlot && slot <= endSlot
    } else if (day === startDay) {
      return slot >= startSlot
    } else if (day === endDay) {
      return slot <= endSlot
    } else {
      return true
    }
  }

  const dayNames = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Sparkles className="w-5 h-5" />
            广告优化
          </CardTitle>
          <CardDescription>根据筛选条件批量优化广告投放时段或出价</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cookie配置选择 */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">选择Cookie配置 *</Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {configs.length === 0 ? (
                <div className="col-span-full p-3 text-center rounded-md border text-muted-foreground">
                  暂无可用配置
                </div>
              ) : (
                configs.map((config) => (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 border rounded-md cursor-pointer transition-all ${
                      selectedConfigId === config.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{config.cookie_name}</div>
                        {config.realname && (
                          <div className="text-xs truncate text-muted-foreground">
                            {config.realname}
                          </div>
                        )}
                      </div>
                      {selectedConfigId === config.id && (
                        <div className="flex justify-center items-center ml-2 w-4 h-4 rounded-full bg-primary">
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* 账户列表 */}
          <div className="space-y-2">
            <Label htmlFor="accountIds" className="text-base font-semibold">
              账户列表 *
            </Label>
            <Textarea
              id="accountIds"
              placeholder="请输入账户ID，每行一个"
              value={accountIds}
              onChange={(e) => setAccountIds(e.target.value)}
              disabled={isSubmitting}
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
                value={filterEnabled ? 'yes' : 'no'}
                onValueChange={(value) => setFilterEnabled(value === 'yes')}
                disabled={isSubmitting}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="filter-yes" />
                  <Label htmlFor="filter-yes" className="cursor-pointer">
                    启用
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="filter-no" />
                  <Label htmlFor="filter-no" className="cursor-pointer">
                    禁用
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {filterEnabled && (
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
                      value={filter.spend_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setFilter((prev) => ({ ...prev, spend_operator: value }))
                      }
                      disabled={isSubmitting}
                      className="flex gap-2"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="gte" id="spend-gte" />
                        <Label htmlFor="spend-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="lte" id="spend-lte" />
                        <Label htmlFor="spend-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="消耗金额"
                      value={filter.spend_value || ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          spend_value: e.target.value ? parseFloat(e.target.value) : undefined
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 转化数 */}
                <div className="space-y-2">
                  <Label>转化数</Label>
                  <div className="flex gap-2">
                    <RadioGroup
                      value={filter.conversion_num_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setFilter((prev) => ({ ...prev, conversion_num_operator: value }))
                      }
                      disabled={isSubmitting}
                      className="flex gap-2"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="gte" id="num-gte" />
                        <Label htmlFor="num-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="lte" id="num-lte" />
                        <Label htmlFor="num-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="转化数"
                      value={filter.conversion_num_value || ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          conversion_num_value: e.target.value
                            ? parseInt(e.target.value)
                            : undefined
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 转化成本 */}
                <div className="space-y-2">
                  <Label>转化成本</Label>
                  <div className="flex gap-2">
                    <RadioGroup
                      value={filter.conversion_cost_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setFilter((prev) => ({ ...prev, conversion_cost_operator: value }))
                      }
                      disabled={isSubmitting}
                      className="flex gap-2"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="gte" id="cost-gte" />
                        <Label htmlFor="cost-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="lte" id="cost-lte" />
                        <Label htmlFor="cost-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="转化成本"
                      value={filter.conversion_cost_value || ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          conversion_cost_value: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 投放模式 */}
                <div className="space-y-2">
                  <Label>投放模式</Label>
                  <RadioGroup
                    value={filter.delivery_mode}
                    onValueChange={(value: 'all' | 'manual' | 'auto') =>
                      setFilter((prev) => ({ ...prev, delivery_mode: value }))
                    }
                    disabled={isSubmitting}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="mode-all" />
                      <Label htmlFor="mode-all" className="cursor-pointer">
                        全部
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="mode-manual" />
                      <Label htmlFor="mode-manual" className="cursor-pointer">
                        手动投放
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto" id="mode-auto" />
                      <Label htmlFor="mode-auto" className="cursor-pointer">
                        自动投放
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 关键字 */}
                <div className="space-y-2">
                  <Label>关键字</Label>
                  <Input
                    placeholder="输入关键字"
                    value={filter.keyword || ''}
                    onChange={(e) => setFilter((prev) => ({ ...prev, keyword: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* 优化方向 */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">优化方向</Label>
            <RadioGroup
              value={optimizeType}
              onValueChange={(value: 'schedule' | 'bid') => setOptimizeType(value)}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="schedule" id="schedule" />
                <Label htmlFor="schedule" className="cursor-pointer">
                  修改投放时段
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bid" id="bid" />
                <Label htmlFor="bid" className="cursor-pointer">
                  修改出价
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 投放时段设置 */}
          {optimizeType === 'schedule' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="text-base font-semibold">投放时段设置</Label>
                <RadioGroup
                  value={timeType}
                  onValueChange={(value: 'unlimited' | 'custom') => setTimeType(value)}
                  disabled={isSubmitting}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unlimited" id="unlimited" />
                    <Label htmlFor="unlimited" className="cursor-pointer">
                      不限
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="cursor-pointer">
                      指定时间段
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {timeType === 'custom' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 rounded-md border"
                  onMouseLeave={handleMouseUp}
                  onMouseUp={handleMouseUp}
                >
                  {/* 时间表头 */}
                  <div className="flex mb-2">
                    <div className="flex-shrink-0 w-16"></div>
                    <div className="flex flex-1">
                      {Array.from({ length: 24 }, (_, i) => (
                        <div key={i} className="flex-1 text-xs text-center text-muted-foreground">
                          {i}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 每天的时间段 */}
                  {dayNames.map((dayName, dayIndex) => (
                    <div key={dayIndex} className="flex items-center mb-1">
                      <div className="flex-shrink-0 w-16 text-sm">{dayName}</div>
                      <div className="flex flex-1">
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div key={hour} className="flex flex-1">
                            {[0, 1].map((half) => {
                              const slotIndex = hour * 2 + half
                              const isSelected = weekSchedule[dayIndex][slotIndex]
                              const inDragRange = isInDragRange(dayIndex, slotIndex)
                              return (
                                <div
                                  key={slotIndex}
                                  className={`flex-1 h-6 border-r border-b cursor-pointer transition-colors select-none ${
                                    isSelected
                                      ? 'bg-primary hover:bg-primary/80'
                                      : inDragRange
                                        ? 'bg-primary/50 hover:bg-primary/60'
                                        : 'bg-background hover:bg-accent'
                                  }`}
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleMouseDown(dayIndex, slotIndex)
                                  }}
                                  onMouseEnter={() => handleMouseMove(dayIndex, slotIndex)}
                                  title={`${dayName} ${hour}:${half === 0 ? '00' : '30'}`}
                                />
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="mt-2 text-xs text-muted-foreground">提示：点击或拖动选择时间段</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* 出价设置 */}
          {optimizeType === 'bid' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <Label htmlFor="bidValue" className="text-base font-semibold">
                出价值 *
              </Label>
              <Input
                id="bidValue"
                type="number"
                placeholder="请输入新出价"
                value={bidValue}
                onChange={(e) => setBidValue(e.target.value)}
                disabled={isSubmitting}
                step="0.01"
                min="0"
              />
            </motion.div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <Button
              onClick={optimizeType === 'schedule' ? handleScheduleOptimize : handleBidOptimize}
              disabled={isSubmitting || !selectedConfigId}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              {optimizeType === 'schedule' ? '确认批量调整' : '确认修改出价'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 浮动操作日志按钮和面板 */}
      {(logs.length > 0 || isSubmitting) && (
        <>
          {/* 浮动按钮 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed right-6 bottom-6 z-50"
          >
            <Button
              onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
              size="lg"
              className="relative p-0 w-14 h-14 rounded-full shadow-lg"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
              {logs.length > 0 && (
                <span className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {logs.length}
                </span>
              )}
            </Button>
          </motion.div>

          {/* 日志面板 */}
          {isLogPanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]"
            >
              <Card className="border-2 shadow-2xl">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">操作日志</CardTitle>
                      <CardDescription className="text-xs">
                        查看批量操作的执行过程和结果
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {logs.length > 0 && !isSubmitting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogs([])
                            setIsLogPanelOpen(false)
                          }}
                          className="h-8 text-xs"
                        >
                          清空
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsLogPanelOpen(false)}
                        className="p-0 w-8 h-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-lg border bg-muted/30 max-h-[500px] overflow-y-auto">
                    <div className="p-3 space-y-2 text-sm">
                      {logs.length === 0 && isSubmitting ? (
                        <div className="flex gap-2 items-center p-4 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在执行操作...</span>
                        </div>
                      ) : (
                        logs.map((log, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-start gap-3 p-3 rounded-md ${
                              log.type === 'error'
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : log.type === 'success'
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                  : 'bg-muted/50 text-muted-foreground border border-border'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {log.type === 'error' ? (
                                <XCircle className="w-4 h-4" />
                              ) : log.type === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Loader2 className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex gap-2 items-center mb-1">
                                <span className="font-mono text-xs opacity-70">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="leading-relaxed break-words">{log.message}</div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
