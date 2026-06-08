import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, XCircle, Settings, X } from 'lucide-react'
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
import { rtaService } from '../../services/tencent-ads.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const RTAPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [accountIds, setAccountIds] = useState<string>('')
  const [dimensionType, setDimensionType] = useState<'adgroup' | 'account'>('adgroup')
  const [rtaId, setRtaId] = useState<string>('10079')
  const [strategyId, setStrategyId] = useState<string>('42000')
  const [rtaTargetId, setRtaTargetId] = useState<string>('42000')
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)

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
    setLogs((prev) => {
      const newLogs = [...prev, { message, type, timestamp: new Date() }]
      // 保持最多显示20行日志
      return newLogs.length > 20 ? newLogs.slice(-20) : newLogs
    })
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

    if (!accountIds.trim()) {
      setError('请输入账号列表')
      return
    }

    // 验证账号ID格式（每行一个）
    const accountIdList = accountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个账号ID')
      return
    }

    // 根据维度类型验证不同的字段
    if (dimensionType === 'adgroup') {
      if (!rtaId.trim()) {
        setError('请填写RTA ID')
        return
      }

      if (!strategyId.trim()) {
        setError('请填写策略ID')
        return
      }
    } else {
      // 账户维度
      if (!rtaTargetId.trim()) {
        setError('请填写RTA策略')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      if (dimensionType === 'adgroup') {
        addLog(
          `开始批量修改RTA ${accountIdList.length} 个账号（在投广告维度）... (RTA ID: ${rtaId}, 策略ID: ${strategyId})`,
          'info'
        )
      } else {
        addLog(
          `开始批量修改RTA ${accountIdList.length} 个账号（账户维度）... (RTA策略: ${rtaTargetId})`,
          'info'
        )
      }
      addLog('正在并发处理所有账号，请稍候...', 'info')

      // 调用后端API进行批量修改（后端会并发处理）
      const payload = {
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        dimension_type: dimensionType,
        ...(dimensionType === 'adgroup'
          ? {
              rta_id: rtaId.trim(),
              strategy_id: strategyId.trim()
            }
          : {
              rta_target_id: rtaTargetId.trim()
            })
      }

      const response = await rtaService.batchModifyRTA(payload)

      if (response.code !== 0) {
        throw new Error(response.error || '操作失败')
      }

      if (response.data) {
        const { total_success, total_error, total_processed_adgroups, account_results } =
          response.data

        if (dimensionType === 'adgroup') {
          addLog(
            `共处理 ${accountIdList.length} 个账号，找到 ${total_processed_adgroups} 个广告组`,
            'info'
          )
        } else {
          addLog(`共处理 ${accountIdList.length} 个账号`, 'info')
        }

        // 显示每个账号的处理结果
        account_results.forEach((accountResult: any) => {
          const { account_id, adgroups_processed, success_count, error_count, errors } =
            accountResult

          if (dimensionType === 'adgroup') {
            if (adgroups_processed > 0) {
              addLog(`📋 账号 ${account_id} 找到 ${adgroups_processed} 个广告组`, 'info')

              // 显示处理结果
              if (success_count > 0) {
                addLog(
                  `✅ 账号 ${account_id} 处理完成 (成功: ${success_count}, 失败: ${error_count})`,
                  'success'
                )
              } else {
                addLog(
                  `❌ 账号 ${account_id} 处理失败 (成功: ${success_count}, 失败: ${error_count})`,
                  'error'
                )
              }

              // 显示错误信息
              if (errors && errors.length > 0) {
                errors.forEach((err: string) => {
                  addLog(`  ⚠️ ${err}`, 'error')
                })
              }
            } else {
              addLog(`⚠️ 账号 ${account_id} 没有找到可操作的广告组`, 'info')
            }
          } else {
            // 账户维度
            if (success_count > 0) {
              addLog(`✅ 账号 ${account_id} RTA策略更新成功`, 'success')
            } else {
              addLog(`❌ 账号 ${account_id} RTA策略更新失败`, 'error')
            }

            // 显示错误信息
            if (errors && errors.length > 0) {
              errors.forEach((err: string) => {
                addLog(`  ⚠️ ${err}`, 'error')
              })
            }
          }
        })

        // 最终统计
        addLog(
          `🎉 批量修改RTA完成! 成功: ${total_success}, 失败: ${total_error}`,
          total_success > 0 ? 'success' : 'error'
        )
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Settings className="w-5 h-5" />
            修改RTA
          </CardTitle>
          <CardDescription>批量修改账号的RTA设置，支持多个账号批量操作</CardDescription>
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

          {/* 账号列表 */}
          <div className="grid gap-2">
            <Label htmlFor="accountIds" className="text-base font-semibold">
              账号列表 (一行一个) *
            </Label>
            <Textarea
              id="accountIds"
              placeholder="请输入账号ID，每行一个&#10;例如：&#10;67365568&#10;67365569&#10;67365570"
              value={accountIds}
              onChange={(e) => setAccountIds(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[120px] resize-y font-mono"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              每行填写一个账号ID，支持多个账号批量操作
            </p>
          </div>

          {/* RTA修改类型维度 */}
          <div className="grid gap-2">
            <Label className="text-base font-semibold">RTA修改类型维度 *</Label>
            <RadioGroup
              value={dimensionType}
              onValueChange={(value) => setDimensionType(value as 'adgroup' | 'account')}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="adgroup" id="dimension-adgroup" />
                <Label htmlFor="dimension-adgroup" className="cursor-pointer font-normal">
                  在投广告维度
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="account" id="dimension-account" />
                <Label htmlFor="dimension-account" className="cursor-pointer font-normal">
                  账户维度
                </Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              选择修改维度：在投广告维度将修改账号下所有广告组的RTA设置，账户维度将直接修改账号级别的RTA策略
            </p>
          </div>

          {/* 在投广告维度的输入框 */}
          {dimensionType === 'adgroup' && (
            <>
              {/* RTA ID */}
              <div className="grid gap-2">
                <Label htmlFor="rtaId" className="text-base font-semibold">
                  RTA ID *
                </Label>
                <Input
                  id="rtaId"
                  type="text"
                  placeholder="10079"
                  value={rtaId}
                  onChange={(e) => setRtaId(e.target.value)}
                  disabled={isSubmitting}
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground">请输入RTA ID，默认为10079</p>
              </div>

              {/* 策略ID */}
              <div className="grid gap-2">
                <Label htmlFor="strategyId" className="text-base font-semibold">
                  策略ID *
                </Label>
                <Input
                  id="strategyId"
                  type="text"
                  placeholder="42000"
                  value={strategyId}
                  onChange={(e) => setStrategyId(e.target.value)}
                  disabled={isSubmitting}
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground">请输入策略ID，默认为42000</p>
              </div>
            </>
          )}

          {/* 账户维度的输入框 */}
          {dimensionType === 'account' && (
            <div className="grid gap-2">
              <Label htmlFor="rtaTargetId" className="text-base font-semibold">
                RTA策略 *
              </Label>
              <Input
                id="rtaTargetId"
                type="text"
                placeholder="42000"
                value={rtaTargetId}
                onChange={(e) => setRtaTargetId(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">请输入RTA策略，默认为42000</p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-4 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end items-center pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !selectedConfigId ||
                !accountIds.trim() ||
                (dimensionType === 'adgroup' && (!rtaId.trim() || !strategyId.trim())) ||
                (dimensionType === 'account' && !rtaTargetId.trim())
              }
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Settings className="mr-2 w-4 h-4" />
                  确认修改
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
                <Settings className="w-6 h-6" />
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
                        查看RTA修改操作的执行过程和结果
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {logs.length > 0 && !isSubmitting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearLogs}
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
