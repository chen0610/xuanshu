import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, XCircle, Target, FileText, X, FileStack } from 'lucide-react'
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
  RadioGroupItem,
  Checkbox,
  Switch
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { conversionAttributionService } from '../../services/tencent-ads.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

type AppType = 'ANDROID' | 'IOS'
type ConversionType = '激活' | '次留' | '七留' | '每留'
type ConversionMode = 'APP' | 'WEB'
type WebConversionType = 'WECHAT_MINI_PROGRAM'
type WebOptimizationGoal = 105 | 10824 // 105-注册, 10824-首日首次付费
type DeepOptimizationGoal = 7 | 8 // 7-首日付费roi, 8-首日变现ROI

interface MarketingLinkItem {
  conversionLinkId: number
  conversionLinkDesc: string
  landingPageAccessZh?: { mustPageTypes?: string[] }
  mustReportIndex?: number[]
}

/** 营销链路选择器：请求并展示营销链路列表，支持单选 */
const MarketingLinkSelector: React.FC<{
  accountId: string | undefined
  selectedConfigId: number | null
  appType: string
  optimizationGoal: number
  deepOptimizationGoal?: number
  selectedItem: MarketingLinkItem | null
  onSelect: (item: MarketingLinkItem | null) => void
  list: MarketingLinkItem[]
  setList: (list: MarketingLinkItem[]) => void
  loading: boolean
  setLoading: (v: boolean) => void
}> = ({
  accountId,
  selectedConfigId,
  appType,
  optimizationGoal,
  deepOptimizationGoal,
  selectedItem,
  onSelect,
  list,
  setList,
  loading,
  setLoading
}) => {
  const fetchList = React.useCallback(async () => {
    if (!accountId || !selectedConfigId) return
    setLoading(true)
    setList([])
    onSelect(null as MarketingLinkItem | null)
    try {
      const res = await conversionAttributionService.getConversionLinkTemplates({
        account_id: accountId,
        selected_cookie_id: selectedConfigId,
        app_type: appType,
        optimization_goal: optimizationGoal,
        deep_optimization_goal: deepOptimizationGoal
      })
      if (res.code === 0 && res.data) {
        setList(res.data)
      }
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [
    accountId,
    selectedConfigId,
    appType,
    optimizationGoal,
    deepOptimizationGoal,
    onSelect,
    setList,
    setLoading
  ])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const formatDesc = (desc: string): string => {
    return desc.replace(/【/g, '\n• ').replace(/】/g, '').replace(/^-/g, '• ').trim()
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex gap-2 items-center p-4 rounded-lg border bg-muted/30 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>加载营销链路中...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="p-4 rounded-lg border bg-muted/30 text-muted-foreground text-sm">
          暂无营销链路数据
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {list.map((item) => (
            <motion.div
              key={item.conversionLinkId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedItem?.conversionLinkId === item.conversionLinkId
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
              onClick={() =>
                onSelect(selectedItem?.conversionLinkId === item.conversionLinkId ? null : item)
              }
            >
              <div className="flex gap-3 items-start">
                <div
                  className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    selectedItem?.conversionLinkId === item.conversionLinkId
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {selectedItem?.conversionLinkId === item.conversionLinkId && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {formatDesc(item.conversionLinkDesc)}
                  </div>
                  {item.landingPageAccessZh?.mustPageTypes?.length ? (
                    <div className="mt-2 flex gap-1 flex-wrap items-center text-xs text-muted-foreground">
                      <FileStack className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.landingPageAccessZh.mustPageTypes.join('、')}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export const ConversionAttributionPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [accountIds, setAccountIds] = useState<string>('')
  const [conversionMode, setConversionMode] = useState<ConversionMode>('APP')
  const [conversionName, setConversionName] = useState<string>('')
  const [trackingUrl, setTrackingUrl] = useState<string>('')
  const [appType, setAppType] = useState<AppType | ''>('')
  const [appId, setAppId] = useState<string>('')
  const [webConversionType, setWebConversionType] =
    useState<WebConversionType>('WECHAT_MINI_PROGRAM')
  const [webOptimizationGoal, setWebOptimizationGoal] = useState<WebOptimizationGoal>(105)
  const [miniProgramAppId, setMiniProgramAppId] = useState<string>('')
  const [conversionTypes, setConversionTypes] = useState<ConversionType[]>([])
  const [grantEnabled, setGrantEnabled] = useState<boolean>(false)
  const [deepOptimizationGoal, setDeepOptimizationGoal] = useState<DeepOptimizationGoal>(8)
  const [marketingLinkEnabled, setMarketingLinkEnabled] = useState(false)
  const [selectedMarketingLink, setSelectedMarketingLink] = useState<MarketingLinkItem | null>(null)
  const [marketingLinkList, setMarketingLinkList] = useState<MarketingLinkItem[]>([])
  const [marketingLinkLoading, setMarketingLinkLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false) // 日志面板是否展开

  const conversionTypeOptions: ConversionType[] = ['激活', '次留', '七留', '每留']

  useEffect(() => {
    loadConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听应用类型变化，自动填充应用ID
  useEffect(() => {
    if (conversionMode !== 'APP') {
      return
    }
    if (appType === 'ANDROID') {
      setAppId('1112180411')
    } else if (appType === 'IOS') {
      setAppId('6451407032')
    } else {
      setAppId('')
    }
  }, [appType, conversionMode])

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

  const handleConversionTypeChange = (type: ConversionType, checked: boolean): void => {
    if (checked) {
      setConversionTypes([...conversionTypes, type])
    } else {
      setConversionTypes(conversionTypes.filter((t) => t !== type))
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  // 处理转化名称：以-分割，取最后一项，判断是否等于激活/次留/七留/每留，如果是则替换
  const processConversionName = (name: string, conversionType: ConversionType): string => {
    const parts = name.split('-')
    if (parts.length === 0) return name

    const lastPart = parts[parts.length - 1]
    const validTypes: ConversionType[] = ['激活', '次留', '七留', '每留']

    if (validTypes.includes(lastPart as ConversionType)) {
      // 替换最后一项
      parts[parts.length - 1] = conversionType
      return parts.join('-')
    }

    // 如果最后一项不是有效类型，直接追加
    return `${name}-${conversionType}`
  }

  // 根据应用类型和新建类型获取请求参数
  const getRequestParams = (
    appType: AppType,
    conversionType: ConversionType,
    conversionName: string,
    trackingUrl: string,
    appId: string
  ): Record<string, any> => {
    const baseParams: any = {
      appType,
      accessType: 'API',
      claimType: 4,
      appId,
      name: conversionName,
      feedbackUrl: trackingUrl,
      url: '',
      bySetIdHrefValue: false,
      feedbackId: '',
      conversionLinkId: appType === 'ANDROID' ? 632 : 633,
      customReportIndex: [2, 3, 4, 5],
      inspectionFreeSwitch: false
    }

    switch (conversionType) {
      case '激活':
        baseParams.optimizationGoal = 104
        break
      case '次留':
        baseParams.optimizationGoal = 104
        baseParams.deepOptimizationGoal = 106
        baseParams.deepOptimizationGoalType = 0
        break
      case '七留':
        baseParams.optimizationGoal = 104
        baseParams.deepOptimizationGoal = 10607
        baseParams.deepOptimizationGoalType = 0
        break
      case '每留':
        baseParams.optimizationGoal = 10600
        baseParams.deepRoiOptimizationGoal = 22
        baseParams.deepOptimizationGoalType = 0
        baseParams.forwardLinkAssist = 104
        break
    }

    return baseParams
  }

  const handleSubmit = async (): Promise<void> => {
    // 验证必填字段
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    if (!accountIds.trim()) {
      setError('请输入账户列表')
      return
    }

    if (!conversionName.trim()) {
      setError('请输入转化名称')
      return
    }

    if (!trackingUrl.trim()) {
      setError('请输入监测链接')
      return
    }

    if (conversionMode === 'APP') {
      if (!appType) {
        setError('请选择应用类型')
        return
      }

      if (!appId.trim()) {
        setError('请输入应用ID')
        return
      }

      if (conversionTypes.length === 0) {
        setError('请至少选择一个新建类型')
        return
      }
    } else {
      if (webConversionType === 'WECHAT_MINI_PROGRAM' && !miniProgramAppId.trim()) {
        setError('请输入微信小程序AppId')
        return
      }
    }

    // 解析账户ID列表（每行一个）
    const accountIdList = accountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个账户ID')
      return
    }

    // 检查转化名称和监测链接的行数是否一致
    const conversionNameLines = conversionName
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const trackingUrlLines = trackingUrl
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (conversionNameLines.length !== trackingUrlLines.length) {
      setError(
        `转化名称有 ${conversionNameLines.length} 行，监测链接有 ${trackingUrlLines.length} 行，行数不一致`
      )
      return
    }

    if (conversionNameLines.length === 0) {
      setError('转化名称和监测链接不能为空')
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true) // 自动展开日志面板

    try {
      // 构建批量请求的 items 数组
      const items: Array<{
        conversion_name: string
        tracking_url: string
        conversion_type: ConversionType | '网页转化'
      }> = []

      // 为每一行转化名称和每个新建类型创建请求项
      for (let i = 0; i < conversionNameLines.length; i++) {
        const originalName = conversionNameLines[i]
        const url = trackingUrlLines[i]
        if (conversionMode === 'APP') {
          for (const conversionType of conversionTypes) {
            items.push({
              conversion_name: originalName,
              tracking_url: url,
              conversion_type: conversionType
            })
          }
        } else {
          items.push({
            conversion_name: originalName,
            tracking_url: url,
            conversion_type: '网页转化'
          })
        }
      }

      const totalItems = items.length * accountIdList.length
      addLog(
        `开始批量创建转化归因，账户数 ${accountIdList.length}，共 ${conversionNameLines.length} 行转化名称，${conversionTypes.length} 个新建类型，预计创建 ${totalItems} 个配置`,
        'info'
      )
      addLog(`账户ID列表: ${accountIdList.join('、')}`, 'info')
      if (conversionMode === 'APP') {
        addLog(`应用类型: ${appType}, 应用ID: ${appId.trim()}`, 'info')
        addLog(`新建类型: ${conversionTypes.join('、')}`, 'info')
      } else {
        addLog(`网页转化类型: 小程序，AppId: ${miniProgramAppId.trim()}`, 'info')
        addLog(
          `优化目标: ${webOptimizationGoal === 10824 ? '首日首次付费' : '注册'}${
            webOptimizationGoal === 105
              ? `，深度优化目标: ${deepOptimizationGoal === 7 ? '首日付费roi' : '首日变现ROI'}`
              : ''
          }${
            marketingLinkEnabled && selectedMarketingLink
              ? `，营销链路ID: ${selectedMarketingLink.conversionLinkId}`
              : ''
          }`,
          'info'
        )
      }
      addLog(`后端将并发处理所有请求...`, 'info')
      addLog(`是否授权: ${grantEnabled ? '是' : '否'}`, 'info')
      if (grantEnabled) {
        addLog('授权方式: 同主体下所有账户', 'info')
      }

      // 调用批量创建接口
      const response = await conversionAttributionService.batchCreateConversionAttribution({
        account_ids: accountIdList,
        items,
        conversion_mode: conversionMode,
        app_type: conversionMode === 'APP' && appType ? appType : undefined,
        app_id: conversionMode === 'APP' ? appId.trim() : undefined,
        web_app_type: conversionMode === 'WEB' ? 'WECHAT_MINI_PROGRAM' : undefined,
        web_app_id: conversionMode === 'WEB' ? miniProgramAppId.trim() : undefined,
        web_optimization_goal: conversionMode === 'WEB' ? webOptimizationGoal : undefined,
        web_deep_roi_optimization_goal:
          conversionMode === 'WEB' && webOptimizationGoal === 105 ? deepOptimizationGoal : undefined,
        web_conversion_link_id:
          conversionMode === 'WEB' && marketingLinkEnabled && selectedMarketingLink
            ? selectedMarketingLink.conversionLinkId
            : undefined,
        web_custom_report_index:
          conversionMode === 'WEB' &&
          marketingLinkEnabled &&
          selectedMarketingLink?.mustReportIndex?.length
            ? selectedMarketingLink.mustReportIndex
            : undefined,
        selected_cookie_id: selectedConfigId,
        grant_enabled: grantEnabled,
        grant_mode: grantEnabled ? 'ALL' : undefined
      })

      if (response.code === 0 && response.data) {
        const { results, success_count, error_count } = response.data

        // 处理每个结果并记录日志
        const errors: string[] = []

        const perRowCount = conversionMode === 'APP' ? conversionTypes.length : 1
        const resultsByAccount = new Map<string, typeof results>()
        results.forEach((result) => {
          const accountId = result.account_id || '未知账号'
          if (!resultsByAccount.has(accountId)) {
            resultsByAccount.set(accountId, [])
          }
          resultsByAccount.get(accountId)!.push(result)
        })

        resultsByAccount.forEach((accountResults, accountId) => {
          addLog(`账号 ${accountId} 处理结果：`, 'info')
          let lastRowIndex = -1

          for (let i = 0; i < accountResults.length; i++) {
            const result = accountResults[i]
            const rowIndex = Math.floor(i / perRowCount)
            const originalName = conversionNameLines[rowIndex]

            if (rowIndex !== lastRowIndex) {
              lastRowIndex = rowIndex
              addLog(`处理第 ${rowIndex + 1} 行: 《${originalName}》`, 'info')
            }

            if (result.success) {
              addLog(
                `  ✓ ${result.conversion_type} 类型创建成功${result.conversion_spec_id ? ` (ID: ${result.conversion_spec_id})` : ''}`,
                'success'
              )

              if (result.grant_warning) {
                addLog(`  ⚠ 授权失败: ${result.grant_warning}`, 'error')
              } else if (grantEnabled && result.conversion_spec_id) {
                addLog('  ✓ 已授权同主体下所有账户', 'success')
              }
            } else {
              const errorMsg = result.error || '创建失败'
              errors.push(
                `账号 ${accountId} 第 ${rowIndex + 1} 行《${originalName}》- ${result.conversion_type}: ${errorMsg}`
              )
              addLog(`  ✗ ${result.conversion_type} 类型创建失败: ${errorMsg}`, 'error')
            }
          }
        })

        // 显示最终结果
        addLog(
          `批量创建完成！成功: ${success_count}, 失败: ${error_count}`,
          error_count === 0 ? 'success' : 'info'
        )

        if (error_count === 0) {
          setError('')
        } else {
          const errorMsg = `创建完成：成功 ${success_count} 个，失败 ${error_count} 个\n\n错误详情：\n${errors.join('\n')}`
          setError(errorMsg)
        }
      } else {
        const errorMsg = response.error || response.msg || '批量创建失败'
        setError(errorMsg)
        addLog(`错误: ${errorMsg}`, 'error')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = (): void => {
    setAccountIds('')
    setConversionMode('APP')
    setConversionName('')
    setTrackingUrl('')
    setAppType('')
    setAppId('')
    setWebConversionType('WECHAT_MINI_PROGRAM')
    setMiniProgramAppId('')
    setConversionTypes([])
    setGrantEnabled(true)
    setDeepOptimizationGoal(8)
    setMarketingLinkEnabled(false)
    setSelectedMarketingLink(null)
    setMarketingLinkList([])
    setError('')
    clearLogs()
    setIsLogPanelOpen(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Target className="w-5 h-5" />
            转化归因
          </CardTitle>
          <CardDescription>批量创建转化归因配置</CardDescription>
          <p className="mt-2 text-sm text-destructive">△ 备用cookie可用数量越多，创建速度越快</p>
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

          {/* 转化类型 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">转化类型 *</Label>
            <RadioGroup
              value={conversionMode}
              onValueChange={(value) => setConversionMode(value as ConversionMode)}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="APP" id="conversion-app" />
                <Label htmlFor="conversion-app" className="font-normal cursor-pointer">
                  应用转化
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="WEB" id="conversion-web" />
                <Label htmlFor="conversion-web" className="font-normal cursor-pointer">
                  网页转化
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 账户输入框 */}
          <div className="grid gap-2">
            <Label htmlFor="accountIds" className="text-base font-semibold">
              账户列表 *
            </Label>
            <Textarea
              id="accountIds"
              placeholder="请输入账户ID（每行一个）"
              value={accountIds}
              onChange={(e) => setAccountIds(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[80px] resize-y font-mono"
              rows={3}
            />
          </div>

          {/* 转化名称和监测链接并排显示 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 转化名称文本框 */}
            <div className="grid gap-2">
              <Label htmlFor="conversionName" className="text-base font-semibold">
                转化名称 *
              </Label>
              <Textarea
                id="conversionName"
                placeholder="请输入转化名称（一行一个）"
                value={conversionName}
                onChange={(e) => setConversionName(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[100px] resize-y font-mono"
                rows={4}
              />
            </div>

            {/* 监测链接文本框 */}
            <div className="grid gap-2">
              <Label htmlFor="trackingUrl" className="text-base font-semibold">
                监测链接 *
              </Label>
              <Textarea
                id="trackingUrl"
                placeholder="请输入监测链接（一行一个）"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[100px] resize-y font-mono"
                rows={4}
              />
            </div>
          </div>

          {conversionMode === 'APP' ? (
            <>
              {/* 应用类型单选框 */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">应用类型 *</Label>
                <RadioGroup
                  value={appType || undefined}
                  onValueChange={(value) => setAppType(value as AppType)}
                  disabled={isSubmitting}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ANDROID" id="android" />
                    <Label htmlFor="android" className="font-normal cursor-pointer">
                      ANDROID
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="IOS" id="ios" />
                    <Label htmlFor="ios" className="font-normal cursor-pointer">
                      IOS
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 应用ID输入框 */}
              <div className="grid gap-2">
                <Label htmlFor="appId" className="text-base font-semibold">
                  应用ID *
                </Label>
                <Input
                  id="appId"
                  placeholder="请输入应用ID"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>
            </>
          ) : (
            <>
              {/* 网页转化类型 */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">转化类型 *</Label>
                <RadioGroup
                  value={webConversionType}
                  onValueChange={(value) => setWebConversionType(value as WebConversionType)}
                  disabled={isSubmitting}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="WECHAT_MINI_PROGRAM" id="web-mini" />
                    <Label htmlFor="web-mini" className="font-normal cursor-pointer">
                      小程序
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {webConversionType === 'WECHAT_MINI_PROGRAM' && (
                <div className="grid gap-2">
                  <Label htmlFor="miniProgramAppId" className="text-base font-semibold">
                    微信小程序AppId *
                  </Label>
                  <Input
                    id="miniProgramAppId"
                    placeholder="请输入微信小程序AppId"
                    value={miniProgramAppId}
                    onChange={(e) => setMiniProgramAppId(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-base font-semibold">优化目标</Label>
                <RadioGroup
                  value={String(webOptimizationGoal)}
                  onValueChange={(v) => setWebOptimizationGoal(Number(v) as WebOptimizationGoal)}
                  disabled={isSubmitting}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="105" id="web-goal-register" />
                    <Label htmlFor="web-goal-register" className="font-normal cursor-pointer">
                      注册
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="10824" id="web-goal-first-paid" />
                    <Label htmlFor="web-goal-first-paid" className="font-normal cursor-pointer">
                      首日首次付费
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {webOptimizationGoal === 105 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">深度优化目标</Label>
                  <RadioGroup
                    value={String(deepOptimizationGoal)}
                    onValueChange={(v) => setDeepOptimizationGoal(Number(v) as DeepOptimizationGoal)}
                    disabled={isSubmitting}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="8" id="web-deep-roi" />
                      <Label htmlFor="web-deep-roi" className="font-normal cursor-pointer">
                        首日变现ROI
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="7" id="web-deep-paid-roi" />
                      <Label htmlFor="web-deep-paid-roi" className="font-normal cursor-pointer">
                        首日付费roi
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-base font-semibold">营销链路</Label>
                  <Switch
                    checked={marketingLinkEnabled}
                    onCheckedChange={setMarketingLinkEnabled}
                    disabled={
                      isSubmitting ||
                      !selectedConfigId ||
                      !accountIds.trim() ||
                      !conversionName.trim() ||
                      !trackingUrl.trim() ||
                      !miniProgramAppId.trim()
                    }
                  />
                </div>
                {marketingLinkEnabled && (
                  <MarketingLinkSelector
                    accountId={
                      accountIds
                        .split('\n')
                        .map((id) => id.trim())
                        .filter(Boolean)[0]
                    }
                    selectedConfigId={selectedConfigId}
                    appType="WECHAT_MINI_PROGRAM"
                    optimizationGoal={webOptimizationGoal}
                    deepOptimizationGoal={webOptimizationGoal === 105 ? deepOptimizationGoal : undefined}
                    selectedItem={selectedMarketingLink}
                    onSelect={setSelectedMarketingLink}
                    list={marketingLinkList}
                    setList={setMarketingLinkList}
                    loading={marketingLinkLoading}
                    setLoading={setMarketingLinkLoading}
                  />
                )}
              </div>
            </>
          )}

          {conversionMode === 'APP' && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">新建类型 *</Label>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {conversionTypeOptions.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={conversionTypes.includes(type)}
                      onCheckedChange={(checked) =>
                        handleConversionTypeChange(type, checked === true)
                      }
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={type} className="font-normal cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
              {conversionTypes.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  已选择: {conversionTypes.join('、')}
                </p>
              )}
            </div>
          )}

          {/* 是否授权 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">是否授权</Label>
            <RadioGroup
              value={grantEnabled ? 'yes' : 'no'}
              onValueChange={(value) => setGrantEnabled(value === 'yes')}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="grant-enabled-yes" />
                <Label htmlFor="grant-enabled-yes" className="font-normal cursor-pointer">
                  是
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="grant-enabled-no" />
                <Label htmlFor="grant-enabled-no" className="font-normal cursor-pointer">
                  否
                </Label>
              </div>
            </RadioGroup>
          </div>

          {grantEnabled && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">授权方式</Label>
              <RadioGroup value="ALL" disabled={isSubmitting} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ALL" id="grant-mode-all" />
                  <Label htmlFor="grant-mode-all" className="font-normal cursor-pointer">
                    同主体下所有账户
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-4 text-sm whitespace-pre-wrap rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
              {error}
            </div>
          )}

          {/* 批量创建按钮 */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              重置
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !selectedConfigId ||
                !accountIds.trim() ||
                !conversionName.trim() ||
                !trackingUrl.trim() ||
                (conversionMode === 'APP'
                  ? !appType || !appId.trim() || conversionTypes.length === 0
                  : !miniProgramAppId.trim())
              }
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Target className="mr-2 w-4 h-4" />
                  批量创建
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
