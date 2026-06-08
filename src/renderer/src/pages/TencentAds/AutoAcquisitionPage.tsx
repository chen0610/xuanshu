import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, XCircle, FileText, X, Rocket } from 'lucide-react'
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
import { autoAcquisitionService } from '../../services/tencent-ads.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const AutoAcquisitionPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [adAccountIds, setAdAccountIds] = useState<string>('')
  const [operationType, setOperationType] = useState<string>('enable') // 操作类型，默认开启
  const [launchAmount, setLaunchAmount] = useState<string>('') // 起量金额
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false) // 日志面板是否展开

  useEffect(() => {
    loadConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleSubmit = async (): Promise<void> => {
    // 验证必填字段
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    if (!adAccountIds.trim()) {
      setError('请输入广告账户列表')
      return
    }

    // 验证广告账户ID格式（每行一个）
    const accountIdList = adAccountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个广告账户ID')
      return
    }

    // 如果是开启操作，验证起量金额（必填，范围200-100000）
    if (operationType === 'enable') {
      if (!launchAmount || launchAmount.trim() === '') {
        setError('开启一键起量时，起量金额为必填项')
        return
      }
      const amount = parseFloat(launchAmount)
      if (isNaN(amount) || amount < 200) {
        setError('起量金额最低为200元')
        return
      }
      if (amount > 100000) {
        setError('起量金额最高为100000元')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true) // 自动展开日志面板

    try {
      const operationText = operationType === 'enable' ? '开启' : '关闭'
      addLog(`开始批量${operationText}一键起量，账户数: ${accountIdList.length}`, 'info')

      if (operationType === 'enable') {
        addLog(`起量金额: ${launchAmount}元`, 'info')
      }

      // 调用后端API进行批量操作
      const payload = {
        account_ids: accountIdList,
        operation_type: operationType as 'enable' | 'disable',
        selected_cookie_id: selectedConfigId,
        launch_amount: operationType === 'enable' ? parseFloat(launchAmount) : undefined
      }

      addLog('正在获取广告组列表...', 'info')
      const response = await autoAcquisitionService.batchAutoAcquisition(payload)

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '批量操作失败')
      }

      if (response.data) {
        const { total_success, total_error, task_ids, account_results } = response.data
        addLog(
          `${operationText}一键起量完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        if (task_ids && task_ids.length > 0) {
          addLog(`任务ID: ${task_ids.join(', ')}`, 'info')
        }

        // 显示账户级别的结果
        account_results?.forEach((result) => {
          if (result.success_count > 0) {
            addLog(`账户 ${result.account_id}: 成功 ${result.success_count} 个`, 'success')
          }
          if (result.error_count > 0) {
            result.errors.forEach((err) => {
              addLog(`账户 ${result.account_id}: ${err}`, 'error')
            })
          }
        })
      }

      // 不调用resetForm()，保留数据和日志供用户查看
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = (): void => {
    setAdAccountIds('')
    setLaunchAmount('')
    setOperationType('enable')
    setError('')
    clearLogs()
    setIsLogPanelOpen(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Rocket className="w-5 h-5" />
            一键起量管理
          </CardTitle>
          <CardDescription>批量开启或关闭广告组的一键起量功能</CardDescription>
          <p className="mt-2 text-sm text-destructive">△ 备用cookie可用数量越多，操作速度越快</p>
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
              onValueChange={setOperationType}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="enable" id="enable" />
                <Label htmlFor="enable" className="font-normal cursor-pointer">
                  开启一键起量
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="disable" id="disable" />
                <Label htmlFor="disable" className="font-normal cursor-pointer">
                  关闭一键起量
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 起量金额（仅开启时显示） */}
          {operationType === 'enable' && (
            <div className="grid gap-2">
              <Label htmlFor="launchAmount" className="text-base font-semibold">
                起量金额 (元) *
              </Label>
              <Input
                id="launchAmount"
                type="number"
                step="0.01"
                min="200"
                max="100000"
                placeholder="请输入开启一键起量时的预算金额（200-100000元）"
                value={launchAmount}
                onChange={(e) => setLaunchAmount(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">
                起量金额范围：200-100000元。注：广告选择自动出价后，不支持一键起量
              </p>
            </div>
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
              disabled={
                isSubmitting ||
                !selectedConfigId ||
                !adAccountIds.trim() ||
                (operationType === 'enable' &&
                  (!launchAmount ||
                    launchAmount.trim() === '' ||
                    parseFloat(launchAmount) < 200 ||
                    parseFloat(launchAmount) > 100000))
              }
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  {operationType === 'enable' ? '开启中...' : '关闭中...'}
                </>
              ) : (
                <>
                  <Rocket className="mr-2 w-4 h-4" />
                  {operationType === 'enable' ? '批量开启起量' : '批量关闭起量'}
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
                            resetForm()
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
