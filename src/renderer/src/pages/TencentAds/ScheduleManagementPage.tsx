import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, XCircle, FileText, X, Clock } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
  Label,
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { scheduleManagementService } from '../../services/tencent-ads.service'

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

export const ScheduleManagementPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [adAccountIds, setAdAccountIds] = useState<string>('')
  const [operationType, setOperationType] = useState<'date' | 'time'>('date') // 操作类型，默认修改投放日期
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [weekSchedule, setWeekSchedule] = useState<boolean[][]>(
    Array(7)
      .fill(null)
      .map(() => Array(48).fill(true))
  )
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)

  // 拖动选择相关状态
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ day: number; slot: number } | null>(null)
  const [dragTargetState, setDragTargetState] = useState<boolean | null>(null)

  useEffect(() => {
    loadConfigs()
    // 设置默认日期：今天和明年今天
    const today = new Date()
    const nextYear = new Date(today)
    nextYear.setFullYear(today.getFullYear() + 1)

    const formatDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    setStartDate(formatDate(today))
    setEndDate(formatDate(nextYear))
  }, [])

  const loadConfigs = async (): Promise<void> => {
    setLoading(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      setError('加载配置失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
    setIsLogPanelOpen(true)
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleSubmit = async (): Promise<void> => {
    // 验证必填字段
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      addLog('请选择账号配置', 'error')
      return
    }

    if (!adAccountIds.trim()) {
      setError('请输入广告账户列表')
      addLog('请输入广告账户列表', 'error')
      return
    }

    // 验证广告账户ID格式（每行一个）
    const accountIdList = adAccountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个广告账户ID')
      addLog('请输入至少一个广告账户ID', 'error')
      return
    }

    // 根据操作类型验证
    if (operationType === 'date') {
      if (!startDate || !endDate) {
        setError('请选择日期区间')
        addLog('请选择日期区间', 'error')
        return
      }
      if (new Date(startDate) > new Date(endDate)) {
        setError('开始日期不能大于结束日期')
        addLog('开始日期不能大于结束日期', 'error')
        return
      }
    } else if (operationType === 'time') {
      const hasSelection = weekSchedule.some((day) => day.some((slot) => slot))
      if (!hasSelection) {
        setError('请选择投放时段')
        addLog('请选择投放时段', 'error')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      const operationText = operationType === 'date' ? '修改投放日期' : '修改投放时间'
      addLog(`开始批量${operationText}，账户数: ${accountIdList.length}`, 'info')

      if (operationType === 'date') {
        addLog(`日期区间: ${startDate} 至 ${endDate}`, 'info')
      }

      // 将weekSchedule转换为week_schedule格式（每天的时间段索引列表）
      let weekScheduleFormatted: number[][] | undefined
      if (operationType === 'time') {
        weekScheduleFormatted = weekSchedule.map((day) => {
          return day
            .map((selected, index) => (selected ? index : null))
            .filter((v) => v !== null) as number[]
        })
      }

      // 调用后端API进行批量操作
      const payload = {
        account_ids: accountIdList,
        operation_type: operationType,
        selected_cookie_id: selectedConfigId,
        start_date: operationType === 'date' ? startDate : undefined,
        end_date: operationType === 'date' ? endDate : undefined,
        week_schedule: operationType === 'time' ? weekScheduleFormatted : undefined
      }

      addLog('正在获取广告组列表...', 'info')
      const response = await scheduleManagementService.batchScheduleManagement(payload)

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '批量操作失败')
      }

      if (response.data) {
        const { total_success, total_error, task_ids, account_results } = response.data
        addLog(
          `${operationText}操作完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        if (task_ids && task_ids.length > 0) {
          addLog(`任务ID: ${task_ids.join(', ')}`, 'info')
        }

        // 显示账户级别的结果
        account_results?.forEach((result) => {
          if (result.success_count > 0) {
            addLog(
              `账户 ${result.account_id}: 成功处理 ${result.success_count} 个（手动: ${result.manual_projects_processed}）`,
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
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 时间段拖动选择相关函数
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
            <Clock className="w-5 h-5" />
            修改投放时间
          </CardTitle>
          <CardDescription>批量修改广告账户的投放日期或投放时段</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 账号配置选择 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">选择账号配置 *</Label>
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : configs.length === 0 ? (
              <div className="col-span-full p-4 text-center rounded-md border text-muted-foreground">
                暂无可用账户配置，请先在配置中心添加腾讯账号的Cookie配置
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {configs.map((config) => (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedConfigId === config.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-1 gap-3 items-center min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            selectedConfigId === config.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedConfigId === config.id && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{config.cookie_name}</div>
                          {config.realname && (
                            <div className="text-sm truncate text-muted-foreground">
                              {config.realname}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedConfigId === config.id && (
                        <CheckCircle className="flex-shrink-0 ml-2 w-5 h-5 text-primary" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 广告账户列表 */}
          <div className="grid gap-2">
            <Label htmlFor="adAccountIds" className="text-base font-semibold">
              广告账户列表 *
            </Label>
            <Textarea
              id="adAccountIds"
              placeholder="请输入广告账户ID，每行填写一个&#10;例如：&#10;123456789&#10;987654321"
              value={adAccountIds}
              onChange={(e) => setAdAccountIds(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[120px] resize-y font-mono"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              每行填写一个广告账户ID，支持多个账户批量操作
            </p>
          </div>

          {/* 操作类型 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">操作类型 *</Label>
            <RadioGroup
              value={operationType}
              onValueChange={(value: 'date' | 'time') => setOperationType(value)}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="date" />
                <Label htmlFor="date" className="font-normal cursor-pointer">
                  修改投放日期
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="time" id="time" />
                <Label htmlFor="time" className="font-normal cursor-pointer">
                  修改投放时间
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 投放日期设置 */}
          {operationType === 'date' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <Label className="text-base font-semibold">日期区间 *</Label>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Label htmlFor="startDate" className="text-sm text-muted-foreground">
                    开始日期
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>
                <span className="pt-6 text-muted-foreground">至</span>
                <div className="flex-1">
                  <Label htmlFor="endDate" className="text-sm text-muted-foreground">
                    结束日期
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">默认日期区间为今天至明年今天</p>
            </motion.div>
          )}

          {/* 投放时间设置 */}
          {operationType === 'time' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <Label className="text-base font-semibold">投放时段设置 *</Label>
              <div
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
              </div>
            </motion.div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-4 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
              {error}
            </div>
          )}

          {/* 确定操作按钮 */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedConfigId || !adAccountIds.trim()}
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  调整中...
                </>
              ) : (
                <>
                  <Clock className="mr-2 w-4 h-4" />
                  确认调整
                </>
              )}
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
              className="fixed bottom-24 right-6 z-50 w-[500px] max-w-[calc(100vw-3rem)]"
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
                            clearLogs()
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
