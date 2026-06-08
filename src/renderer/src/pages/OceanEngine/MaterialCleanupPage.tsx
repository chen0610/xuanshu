import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Scissors, X, FileText, XCircle, CheckCircle } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Label,
  Textarea,
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
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

export const MaterialCleanupPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [accountIds, setAccountIds] = useState('')
  const [operationType, setOperationType] = useState<'pause' | 'delete'>('pause')
  const [cleanupDirection, setCleanupDirection] = useState<
    'low_efficiency_carry' | 'specified_creative_ids'
  >('low_efficiency_carry')

  const getCleanupDirectionLabel = (
    direction: 'low_efficiency_carry' | 'specified_creative_ids'
  ): string => {
    switch (direction) {
      case 'low_efficiency_carry':
        return '低质/低效/搬运素材'
      case 'specified_creative_ids':
        return '指定创意ID'
      default:
        return direction
    }
  }
  const [creativeIdsText, setCreativeIdsText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  // 自动滚动到最新日志
  useEffect(() => {
    if (logContainerRef.current && logs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

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

  const handleCleanup = async (): Promise<void> => {
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

    if (accountIdList.length > 100) {
      addLog('账户数量不能超过100个', 'error')
      return
    }

    const creativeIdList =
      cleanupDirection === 'specified_creative_ids'
        ? creativeIdsText
            .split('\n')
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : []

    if (cleanupDirection === 'specified_creative_ids' && creativeIdList.length === 0) {
      addLog('请填写至少一个创意ID', 'error')
      return
    }

    setIsSubmitting(true)
    addLog(
      `执行规则：${getCleanupDirectionLabel(cleanupDirection)}；该方向会额外命中 material_label = 10 的低质素材`,
      'info'
    )

    // 使用SSE接收实时日志
    const token = localStorage.getItem('access_token')
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090'
    const url = `${baseURL}/api/v1/ocean-engine/material-cleanup/stream`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId,
          operation_type: operationType,
          cleanup_direction: cleanupDirection,
          ...(cleanupDirection === 'specified_creative_ids' ? { creative_ids: creativeIdList } : {})
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      let buffer = ''
      const pendingLogs: Array<{ message: string; type: 'info' | 'success' | 'error' }> = []
      let updateTimer: number | null = null

      // 批量更新日志的函数
      const flushLogs = (): void => {
        if (pendingLogs.length > 0) {
          const logsToAdd = [...pendingLogs]
          pendingLogs.length = 0

          // 批量添加日志
          setLogs((prev) => [
            ...prev,
            ...logsToAdd.map((log) => ({
              message: log.message,
              type: log.type,
              timestamp: new Date()
            }))
          ])
        }
        updateTimer = null
      }

      // 添加日志到缓冲区
      const addLogToBuffer = (
        message: string,
        type: 'info' | 'success' | 'error' = 'info'
      ): void => {
        pendingLogs.push({ message, type })

        // 如果还没有定时器，设置一个（每200ms批量更新一次）
        if (updateTimer === null) {
          updateTimer = window.setTimeout(flushLogs, 200)
        }
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // 读取完成，刷新剩余的日志
          flushLogs()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一个不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'done') {
                // 处理完成，先刷新待处理的日志
                flushLogs()
                setIsSubmitting(false)
                break
              } else if (data.message) {
                // 添加到缓冲区而不是立即更新
                addLogToBuffer(data.message, data.type as 'info' | 'success' | 'error')
              }
            } catch (e) {
              console.error('解析SSE消息失败:', e, line)
            }
          }
        }
      }

      // 清理定时器
      if (updateTimer !== null) {
        clearTimeout(updateTimer)
        flushLogs()
      }

      // 确保设置完成状态
      setIsSubmitting(false)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '清理失败'
      addLog(`失败: ${errorMessage}`, 'error')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Scissors className="w-5 h-5" />
            在投素材清理
          </CardTitle>
          <CardDescription>
            批量清理账户中的在投素材
          </CardDescription>
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

          {/* 操作类型 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">操作类型 *</Label>
            <RadioGroup
              value={operationType}
              onValueChange={(value: 'pause' | 'delete') => setOperationType(value)}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pause" id="pause" />
                <Label htmlFor="pause" className="font-normal cursor-pointer">
                  暂停
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete" />
                <Label htmlFor="delete" className="font-normal cursor-pointer">
                  删除
                </Label>
              </div>
            </RadioGroup>
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
            <p className="text-sm text-muted-foreground">每行填写一个账户ID，最多100个账户</p>
          </div>

          {/* 清理方向 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">清理方向 *</Label>
            <RadioGroup
              value={cleanupDirection}
              onValueChange={(value: 'low_efficiency_carry' | 'specified_creative_ids') =>
                setCleanupDirection(value)
              }
              disabled={isSubmitting}
              className="flex flex-col gap-3 sm:flex-row sm:gap-8"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low_efficiency_carry" id="dir-low" />
                <Label htmlFor="dir-low" className="font-normal cursor-pointer">
                  低质/低效/搬运素材
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specified_creative_ids" id="dir-ids" />
                <Label htmlFor="dir-ids" className="font-normal cursor-pointer">
                  指定创意ID
                </Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              「低质/低效/搬运」按素材标签筛选，会额外命中 `material_label = 10` 的低质素材；「指定创意ID」仅处理与接口 material_id 一致的素材
            </p>
          </div>

          {cleanupDirection === 'specified_creative_ids' && (
            <div className="space-y-2">
              <Label htmlFor="creativeIds" className="text-base font-semibold">
                创意ID列表 *
              </Label>
              <Textarea
                id="creativeIds"
                placeholder="请输入创意ID（material_id），每行一个"
                value={creativeIdsText}
                onChange={(e) => setCreativeIdsText(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[100px] resize-y"
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                与巨量接口返回的 material_id 一致；暂停时仍会要求素材为在投状态
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <Button
              onClick={handleCleanup}
              disabled={isSubmitting || !selectedConfigId}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              开始清理
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
                        查看清理操作的执行过程和结果
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
                  <div
                    ref={logContainerRef}
                    className="rounded-lg border bg-muted/30 max-h-[500px] overflow-y-auto"
                  >
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
