import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Settings } from 'lucide-react'
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

const DAY_NAMES = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

export const ScheduleTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    addLog,
    clearLogs,
    setIsBottomPanelOpen
  } = usePAssistantContext()

  // 投放时段优化相关状态
  const [scheduleAccountIds, setScheduleAccountIds] = usePersistedState<string>(
    'p-assistant-schedule-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [timeType, setTimeType] = useState<'unlimited' | 'custom'>('unlimited')
  const [weekSchedule, setWeekSchedule] = useState<boolean[][]>(
    Array(7)
      .fill(null)
      .map(() => Array(48).fill(true))
  )
  const [scheduleFilterEnabled, setScheduleFilterEnabled] = useState(false)
  const [scheduleFilter, setScheduleFilter] = useState<AdOptimizeFilter>({
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

  // 拖拽相关状态
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: number; slot: number } | null>(null)
  const [dragTargetState, setDragTargetState] = useState<boolean | null>(null)

  // ─── 拖拽处理函数 ──────────────────────────────────────

  const handleMouseDown = (day: number, slot: number): void => {
    setIsDragging(true)
    const startPos = { day, slot }
    setDragStart(startPos)
    setDragEnd(startPos)
    const currentState = weekSchedule[day][slot]
    setDragTargetState(!currentState)
    setWeekSchedule((prev) =>
      prev.map((d, dIdx) =>
        dIdx === day ? d.map((s, sIdx) => (sIdx === slot ? !s : s)) : d
      )
    )
  }

  const handleMouseMove = (day: number, slot: number): void => {
    if (!isDragging || !dragStart || dragTargetState === null) return

    setDragEnd({ day, slot })

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

    setWeekSchedule((prev) =>
      prev.map((d, dIdx) => {
        if (dIdx >= startDay && dIdx <= endDay) {
          return d.map((s, sIdx) => {
            if (dIdx === startDay && dIdx === endDay) {
              return sIdx >= startSlot && sIdx <= endSlot ? dragTargetState : s
            } else if (dIdx === startDay) {
              return sIdx >= startSlot ? dragTargetState : s
            } else if (dIdx === endDay) {
              return sIdx <= endSlot ? dragTargetState : s
            } else {
              return dragTargetState
            }
          })
        }
        return d
      })
    )
  }

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

  // ─── 提交处理 ──────────────────────────────────────────

  const handleScheduleOptimize = async (): Promise<void> => {
    clearLogs()
    setIsBottomPanelOpen(true)

    if (!selectedConfigId) {
      addLog('请选择Cookie配置', 'error')
      return
    }

    const accountIdList = parseAccountIds(scheduleAccountIds)
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

    setLoading(true)
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
          ...scheduleFilter,
          filter_enabled: scheduleFilterEnabled
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
          `调整完成！成功: ${total_success} 个项目, 失败: ${total_error} 个项目`,
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
      const errorMessage = err instanceof Error ? err.message : '调整失败'
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
              <Settings className="w-4 h-4 text-primary" />
            </div>
            投放时段优化
          </CardTitle>
          <CardDescription>根据筛选条件批量优化项目投放时段</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 账户列表 */}
          <div className="space-y-2">
            <Label htmlFor="scheduleAccountIds" className="text-base font-semibold">
              账户列表（一行一个） *
            </Label>
            <Textarea
              id="scheduleAccountIds"
              placeholder="请输入账户ID，每行一个"
              value={scheduleAccountIds}
              onChange={(e) => setScheduleAccountIds(e.target.value)}
              disabled={loading}
              className="min-h-[100px] resize-y"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">每行填写一个账户ID</p>
          </div>

          {/* 筛选条件 */}
          <div className="p-4 space-y-4 rounded-md border bg-muted/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Label className="text-base font-semibold">筛选条件</Label>
                <p className="text-sm text-muted-foreground">
                  启用后仅对满足条件的项目调整投放时段
                </p>
              </div>
              <RadioGroup
                value={scheduleFilterEnabled ? 'yes' : 'no'}
                onValueChange={(value) => setScheduleFilterEnabled(value === 'yes')}
                disabled={loading}
                className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-1 sm:w-[180px]"
              >
                <div
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 ${
                    scheduleFilterEnabled ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  <RadioGroupItem value="yes" id="schedule-filter-yes" />
                  <Label htmlFor="schedule-filter-yes" className="cursor-pointer text-sm">
                    启用
                  </Label>
                </div>
                <div
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 ${
                    !scheduleFilterEnabled ? 'bg-muted text-foreground' : ''
                  }`}
                >
                  <RadioGroupItem value="no" id="schedule-filter-no" />
                  <Label htmlFor="schedule-filter-no" className="cursor-pointer text-sm">
                    禁用
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {scheduleFilterEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 overflow-hidden border-t pt-4"
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* 消耗 */}
                  <div className="space-y-3 rounded-lg border bg-background p-3">
                    <Label>消耗</Label>
                    <RadioGroup
                      value={scheduleFilter.spend_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setScheduleFilter((prev) => ({ ...prev, spend_operator: value }))
                      }
                      disabled={loading}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="gte" id="schedule-spend-gte" />
                        <Label htmlFor="schedule-spend-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="lte" id="schedule-spend-lte" />
                        <Label htmlFor="schedule-spend-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="请输入消耗金额"
                      value={scheduleFilter.spend_value || ''}
                      onChange={(e) =>
                        setScheduleFilter((prev) => ({
                          ...prev,
                          spend_value: e.target.value ? parseFloat(e.target.value) : 0
                        }))
                      }
                      disabled={loading}
                    />
                  </div>

                  {/* 转化数 */}
                  <div className="space-y-3 rounded-lg border bg-background p-3">
                    <Label>转化数</Label>
                    <RadioGroup
                      value={scheduleFilter.conversion_num_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setScheduleFilter((prev) => ({
                          ...prev,
                          conversion_num_operator: value
                        }))
                      }
                      disabled={loading}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="gte" id="schedule-num-gte" />
                        <Label htmlFor="schedule-num-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="lte" id="schedule-num-lte" />
                        <Label htmlFor="schedule-num-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="请输入转化数"
                      value={scheduleFilter.conversion_num_value || ''}
                      onChange={(e) =>
                        setScheduleFilter((prev) => ({
                          ...prev,
                          conversion_num_value: e.target.value
                            ? parseInt(e.target.value)
                            : 0
                        }))
                      }
                      disabled={loading}
                    />
                  </div>

                  {/* 转化成本 */}
                  <div className="space-y-3 rounded-lg border bg-background p-3">
                    <Label>转化成本</Label>
                    <RadioGroup
                      value={scheduleFilter.conversion_cost_operator}
                      onValueChange={(value: 'gte' | 'lte') =>
                        setScheduleFilter((prev) => ({
                          ...prev,
                          conversion_cost_operator: value
                        }))
                      }
                      disabled={loading}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="gte" id="schedule-cost-gte" />
                        <Label htmlFor="schedule-cost-gte" className="text-xs cursor-pointer">
                          大于等于
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="lte" id="schedule-cost-lte" />
                        <Label htmlFor="schedule-cost-lte" className="text-xs cursor-pointer">
                          小于等于
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      type="number"
                      placeholder="请输入转化成本"
                      value={scheduleFilter.conversion_cost_value || ''}
                      onChange={(e) =>
                        setScheduleFilter((prev) => ({
                          ...prev,
                          conversion_cost_value: e.target.value
                            ? parseFloat(e.target.value)
                            : 0
                        }))
                      }
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.8fr)]">
                  {/* 投放模式 */}
                  <div className="space-y-3 rounded-lg border bg-background p-3">
                    <Label>投放模式</Label>
                    <RadioGroup
                      value={scheduleFilter.delivery_mode}
                      onValueChange={(value: 'all' | 'manual' | 'auto') =>
                        setScheduleFilter((prev) => ({ ...prev, delivery_mode: value }))
                      }
                      disabled={loading}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                    >
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="all" id="schedule-mode-all" />
                        <Label htmlFor="schedule-mode-all" className="cursor-pointer">
                          全部
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="manual" id="schedule-mode-manual" />
                        <Label htmlFor="schedule-mode-manual" className="cursor-pointer">
                          手动投放
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value="auto" id="schedule-mode-auto" />
                        <Label htmlFor="schedule-mode-auto" className="cursor-pointer">
                          自动投放
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* 关键字 */}
                  <div className="space-y-3 rounded-lg border bg-background p-3">
                    <Label>关键字</Label>
                    <Input
                      placeholder="按项目名称关键字筛选"
                      value={scheduleFilter.keyword || ''}
                      onChange={(e) =>
                        setScheduleFilter((prev) => ({ ...prev, keyword: e.target.value }))
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* 投放时段设置 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">投放时段设置</Label>
              <RadioGroup
                value={timeType}
                onValueChange={(value: 'unlimited' | 'custom') => setTimeType(value)}
                disabled={loading}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unlimited" id="schedule-unlimited" />
                  <Label htmlFor="schedule-unlimited" className="cursor-pointer">
                    不限
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="schedule-custom" />
                  <Label htmlFor="schedule-custom" className="cursor-pointer">
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
                onMouseLeave={() => {
                  setIsDragging(false)
                  setDragStart(null)
                  setDragEnd(null)
                  setDragTargetState(null)
                }}
                onMouseUp={() => {
                  setIsDragging(false)
                  setDragStart(null)
                  setDragEnd(null)
                  setDragTargetState(null)
                }}
              >
                {/* 时间表头 */}
                <div className="flex mb-2">
                  <div className="flex-shrink-0 w-16"></div>
                  <div className="flex flex-1">
                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="flex-1 text-xs text-center text-muted-foreground"
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 每天的时间段 */}
                {DAY_NAMES.map((dayName, dayIndex) => (
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
                <p className="mt-2 text-xs text-muted-foreground">
                  提示：点击或拖动选择时间段
                </p>
              </motion.div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <Button
              onClick={handleScheduleOptimize}
              disabled={
                loading ||
                !selectedConfigId ||
                !scheduleAccountIds.trim() ||
                (timeType === 'custom' &&
                  !weekSchedule.some((day) => day.some((slot) => slot)))
              }
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              确认批量调整
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
