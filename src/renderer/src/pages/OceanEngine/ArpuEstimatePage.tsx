import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, TrendingUp, X, FileText, XCircle, CheckCircle, Download } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Label,
  Input
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { arpuEstimateService } from '../../services/ocean-engine.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: Date
  progress?: number
}

interface ArpuResult {
  request_time: string
  boundary_page: number
  requests_count: number
  total_pages: number
  pages_requested: number
  all_ads_count: number
  display_ads_count: number
  group_count: number
  group_stats: Record<string, number>
  arpu_stats: {
    overall_arpu: number
    total_cost: number
    total_manual_ads: number
    total_manual_active_ads: number
    total_auto_ads: number
    total_auto_active_ads: number
    group_details: Array<{
      group_name: string
      arpu: number
      total_cost: number
      total_ads: number
      active_ads: number
      manual_ratio: string
      auto_ratio: string
    }>
  }
  execution_time: {
    total_seconds: number
    binary_search_seconds: number
    concurrent_request_seconds: number
    data_extraction_seconds: number
    data_grouping_seconds: number
  }
}

export const ArpuEstimatePage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [groupIndex, setGroupIndex] = useState(3)
  const [accountName, setAccountName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [result, setResult] = useState<ArpuResult | null>(null)
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

  // 当选择配置时，获取账户信息
  useEffect(() => {
    if (selectedConfigId) {
      loadAccountInfo()
    } else {
      setAccountName('')
    }
  }, [selectedConfigId])

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

  const loadAccountInfo = async (): Promise<void> => {
    if (!selectedConfigId) return

    try {
      const accountInfo = await arpuEstimateService.getAccountInfo({
        selected_cookie_id: selectedConfigId,
        group_index: groupIndex
      })

      if (accountInfo.code === 0 && accountInfo.data?.user?.name) {
        setAccountName(accountInfo.data.user.name)
      } else {
        setAccountName('')
      }
    } catch (err) {
      console.error('Failed to load account info:', err)
      setAccountName('')
    }
  }

  const addLog = (
    message: string,
    type: 'info' | 'success' | 'error' = 'info',
    progress?: number
  ): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date(), progress }])
    setIsLogPanelOpen(true)
  }

  const handleEstimate = async (): Promise<void> => {
    if (!selectedConfigId) {
      addLog('请选择Cookie配置', 'error')
      return
    }

    setLogs([])
    setIsSubmitting(true)
    setIsLogPanelOpen(true)
    setResult(null)

    try {
      const response = await arpuEstimateService.estimateStream({
        selected_cookie_id: selectedConfigId,
        group_index: groupIndex
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
      const pendingLogs: Array<{
        message: string
        type: 'info' | 'success' | 'error'
        progress?: number
      }> = []
      let updateTimer: number | null = null

      const flushLogs = (): void => {
        if (pendingLogs.length > 0) {
          const logsToAdd = [...pendingLogs]
          pendingLogs.length = 0

          setLogs((prev) => [
            ...prev,
            ...logsToAdd.map((log) => ({
              message: log.message,
              type: log.type,
              timestamp: new Date(),
              progress: log.progress
            }))
          ])
        }
        updateTimer = null
      }

      const addLogToBuffer = (
        message: string,
        type: 'info' | 'success' | 'error' = 'info',
        progress?: number
      ): void => {
        pendingLogs.push({ message, type, progress })

        if (updateTimer === null) {
          updateTimer = window.setTimeout(flushLogs, 200)
        }
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          flushLogs()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)

              if (data.type === 'complete') {
                flushLogs()
                setIsSubmitting(false)
                setResult(data.data)
                addLog(data.message || '数据收集完成', 'success', 100)
                break
              } else if (data.type === 'error') {
                flushLogs()
                setIsSubmitting(false)
                addLog(data.message || '未知错误', 'error')
                break
              } else if (data.type === 'progress') {
                addLogToBuffer(data.message || '处理中...', 'info', data.progress)
              }
            } catch (e) {
              console.error('解析SSE消息失败:', e, line)
            }
          }
        }
      }

      if (updateTimer !== null) {
        clearTimeout(updateTimer)
        flushLogs()
      }

      setIsSubmitting(false)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '预估失败'
      addLog(`失败: ${errorMessage}`, 'error')
      setIsSubmitting(false)
    }
  }

  const handleExport = (): void => {
    if (!result || !result.arpu_stats || !result.arpu_stats.group_details) {
      return
    }

    const headers = [
      '主体',
      'ARPU',
      '新建广告总消耗',
      '新建广告数（包含删）',
      '新建在投广告数',
      '新建手动总数/在投',
      '新建自动总数/在投'
    ]

    const summaryRow = [
      '汇总',
      result.arpu_stats.overall_arpu,
      result.arpu_stats.total_cost,
      result.all_ads_count || 0,
      result.arpu_stats.total_manual_active_ads + result.arpu_stats.total_auto_active_ads,
      `${result.arpu_stats.total_manual_ads}/${result.arpu_stats.total_manual_active_ads}`,
      `${result.arpu_stats.total_auto_ads}/${result.arpu_stats.total_auto_active_ads}`
    ]

    const csvContent = [
      headers.join(','),
      summaryRow.map((item) => `"${item}"`).join(','),
      '',
      '',
      ...result.arpu_stats.group_details.map((item) =>
        [
          `"${item.group_name || ''}"`,
          `"${item.arpu || ''}"`,
          `"${item.total_cost || ''}"`,
          `"${item.total_ads || ''}"`,
          `"${item.active_ads || ''}"`,
          `"${item.manual_ratio || ''}"`,
          `"${item.auto_ratio || ''}"`
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `ARPU分组详情_${new Date().toLocaleDateString()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <TrendingUp className="w-5 h-5" />
            ARPU预估
          </CardTitle>
          <CardDescription>收集今天创建的广告数据，按主体分组统计ARPU值</CardDescription>
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

          {/* 分组配置 */}
          <div className="space-y-2">
            <Label htmlFor="groupIndex" className="text-base font-semibold">
              主体名称所在项 *
            </Label>
            <div className="flex gap-4 items-center">
              <Input
                id="groupIndex"
                type="number"
                min={1}
                max={10}
                value={groupIndex}
                onChange={(e) => setGroupIndex(parseInt(e.target.value) || 3)}
                disabled={isSubmitting}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                默认第3项（例如：品牌-账户-<span className="font-semibold text-primary">主体</span>
                -其他）
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <Button
              onClick={handleEstimate}
              disabled={isSubmitting || !selectedConfigId}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              开始收集数据
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结果展示 */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex gap-2 items-center">
                <TrendingUp className="w-5 h-5" />
                收集结果
              </CardTitle>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground">
                  请求时间: {result.request_time}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={!result.arpu_stats?.group_details}
                >
                  <Download className="mr-2 w-4 h-4" />
                  导出ARPU详情
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ARPU统计 */}
            {result.arpu_stats && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200 dark:bg-green-950/20 dark:border-green-800">
                  <h3 className="mb-4 text-lg font-semibold text-green-700 dark:text-green-300">
                    ARPU分析报告
                  </h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-xl font-bold text-primary">
                        {result.arpu_stats.overall_arpu}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">平均ARPU</div>
                    </div>
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-xl font-bold text-primary">
                        {result.arpu_stats.total_cost}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">总消耗</div>
                    </div>
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-xl font-bold">{result.group_count}</div>
                      <div className="mt-1 text-xs text-muted-foreground">分组数量</div>
                    </div>
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-xl font-bold">{result.arpu_stats.total_manual_ads}</div>
                      <div className="mt-1 text-xs text-muted-foreground">手动广告</div>
                    </div>
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-xl font-bold">{result.arpu_stats.total_auto_ads}</div>
                      <div className="mt-1 text-xs text-muted-foreground">自动广告</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-lg font-semibold">
                        {result.arpu_stats.total_manual_active_ads}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">手动未删除</div>
                    </div>
                    <div className="p-3 text-center bg-white rounded-md border dark:bg-gray-800">
                      <div className="text-lg font-semibold">
                        {result.arpu_stats.total_auto_active_ads}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">自动未删除</div>
                    </div>
                  </div>
                </div>

                {/* 分组详情表格 */}
                {result.arpu_stats.group_details && result.arpu_stats.group_details.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-base font-semibold">各分组ARPU详情</h4>
                    <div className="overflow-hidden rounded-md border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-left">主体</th>
                              <th className="px-4 py-3 font-semibold text-center">ARPU</th>
                              <th className="px-4 py-3 font-semibold text-center">
                                新建广告总消耗
                              </th>
                              <th className="px-4 py-3 font-semibold text-center">
                                新建广告数（包含删）
                              </th>
                              <th className="px-4 py-3 font-semibold text-center">
                                新建在投广告数
                              </th>
                              <th className="px-4 py-3 font-semibold text-center">
                                新建手动总数/在投
                              </th>
                              <th className="px-4 py-3 font-semibold text-center">
                                新建自动总数/在投
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.arpu_stats.group_details.map((detail, index) => (
                              <tr
                                key={index}
                                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                              >
                                <td className="px-4 py-2 font-medium">{detail.group_name}</td>
                                <td className="px-4 py-2 font-semibold text-center text-primary">
                                  {detail.arpu}
                                </td>
                                <td className="px-4 py-2 font-semibold text-center text-primary">
                                  {detail.total_cost}
                                </td>
                                <td className="px-4 py-2 font-semibold text-center">
                                  {detail.total_ads}
                                </td>
                                <td className="px-4 py-2 font-semibold text-center">
                                  {detail.active_ads}
                                </td>
                                <td className="px-4 py-2 text-center">{detail.manual_ratio}</td>
                                <td className="px-4 py-2 text-center">{detail.auto_ratio}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 执行时间统计 */}
            {result.execution_time && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="p-3 text-center rounded-md border bg-muted/50">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {result.execution_time.total_seconds}s
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">总耗时</div>
                </div>
                <div className="p-3 text-center rounded-md border bg-muted/50">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {result.execution_time.binary_search_seconds}s
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">二分查找</div>
                </div>
                <div className="p-3 text-center rounded-md border bg-muted/50">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {result.execution_time.concurrent_request_seconds}s
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">并发请求</div>
                </div>
                <div className="p-3 text-center rounded-md border bg-muted/50">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {result.execution_time.data_extraction_seconds}s
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">数据提取</div>
                </div>
                <div className="p-3 text-center rounded-md border bg-muted/50">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {result.execution_time.data_grouping_seconds}s
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">数据分组</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                        查看数据收集的执行过程和结果
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
                                {log.progress !== undefined && (
                                  <span className="text-xs font-semibold text-primary">
                                    [{Math.round(log.progress)}%]
                                  </span>
                                )}
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
