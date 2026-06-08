import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  X,
  FileDown,
  Copy,
  Search,
  Eye
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
  Label
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { materialExtractionService } from '../../services/tencent-ads.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface MaterialInfo {
  account_id: string
  adgroup_id?: string
  dynamic_creative_id?: string
  dynamic_creative_name: string
  dayu_cid?: string
  cost: number
  activated_count?: number
  activated_cost?: number
  system_status_cn?: string
  material_package_id?: number
  site_set_cn?: string
  video_ids?: string
  descriptions?: string
  brand_name?: string
  button_text?: string
}

type FilterType = 'consumption_amount' | 'activated_count' | 'activated_cost'

export const MaterialExtractionPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [adAccountIds, setAdAccountIds] = useState<string>('')
  const [filterType, setFilterType] = useState<FilterType>('consumption_amount')
  const [filterValue, setFilterValue] = useState<string>('0')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [materials, setMaterials] = useState<MaterialInfo[]>([])
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false)

  useEffect(() => {
    loadConfigs()
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
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

    // 验证筛选条件的值
    const value = parseFloat(filterValue)
    if (isNaN(value) || value < 0) {
      setError(`请输入有效的${getFilterLabel(filterType)}（大于等于0）`)
      return
    }

    // 验证日期
    if (!startDate || !endDate) {
      setError('请选择日期区间')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('开始日期不能晚于结束日期')
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)
    setMaterials([])

    try {
      addLog(`开始提取有量素材，账户数: ${accountIdList.length}`, 'info')
      addLog(`日期区间: ${startDate} 至 ${endDate}`, 'info')

      // 构建筛选条件日志
      const label = getFilterLabel(filterType)
      const unit =
        filterType === 'consumption_amount' || filterType === 'activated_cost' ? '元' : ''
      addLog(`${label}大于: ${filterValue}${unit}`, 'info')

      // 构建请求payload
      const payload: any = {
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        start_date: startDate,
        end_date: endDate
      }

      // 添加筛选条件
      const filterValueNum = parseFloat(filterValue)
      if (filterType === 'consumption_amount') {
        payload.consumption_amount = filterValueNum
      } else if (filterType === 'activated_count') {
        payload.activated_count = filterValueNum
      } else if (filterType === 'activated_cost') {
        payload.activated_cost = filterValueNum
      }

      addLog('正在获取创意列表...', 'info')
      const response = await materialExtractionService.extractMaterials(payload)

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '提取失败')
      }

      if (response.data && response.data.materials) {
        const extractedMaterials = response.data.materials as MaterialInfo[]
        setMaterials(extractedMaterials)
        addLog(`提取完成！共找到 ${extractedMaterials.length} 个符合条件的创意`, 'success')
        setIsResultsPanelOpen(true)
      } else {
        addLog('未找到符合条件的创意', 'info')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = (): void => {
    if (materials.length === 0) {
      return
    }

    // 构建CSV内容
    const headers = ['账户ID', '创意名称', '大鱼cid', '消耗金额', '激活数', '激活成本']
    const rows = materials.map((item) => [
      item.account_id,
      item.dynamic_creative_name,
      item.dayu_cid || '',
      item.cost.toFixed(2),
      item.activated_count?.toFixed(0) || '0',
      item.activated_cost?.toFixed(2) || '0.00'
    ])

    const csvContent = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n')

    // 创建下载链接
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `有量素材结果_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyDayuCids = (): void => {
    if (materials.length === 0) {
      return
    }

    // 提取所有非空的大鱼cid
    const validCids = materials
      .map((item) => item.dayu_cid)
      .filter((cid) => cid && cid.trim() !== '')
      .map((cid) => cid!.trim())

    if (validCids.length === 0) {
      alert('没有可复制的大鱼cid')
      return
    }

    // 将大鱼cid用换行符连接
    const cidText = validCids.join('\n')

    // 复制到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(cidText)
        .then(() => {
          alert('大鱼cid已复制到剪贴板')
        })
        .catch(() => {
          // 降级处理
          const textArea = document.createElement('textarea')
          textArea.value = cidText
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
          alert('大鱼cid已复制到剪贴板')
        })
    } else {
      // 降级处理
      const textArea = document.createElement('textarea')
      textArea.value = cidText
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('大鱼cid已复制到剪贴板')
    }
  }

  const getFilterLabel = (type: FilterType): string => {
    switch (type) {
      case 'consumption_amount':
        return '消耗金额'
      case 'activated_count':
        return '激活数'
      case 'activated_cost':
        return '激活成本'
      default:
        return ''
    }
  }

  const getFilterPlaceholder = (type: FilterType): string => {
    switch (type) {
      case 'consumption_amount':
        return '请输入消耗金额'
      case 'activated_count':
        return '请输入激活数'
      case 'activated_cost':
        return '请输入激活成本'
      default:
        return ''
    }
  }

  const filteredMaterials = materials.filter(
    (item) =>
      item.dynamic_creative_name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (item.dayu_cid && item.dayu_cid.toLowerCase().includes(searchKeyword.toLowerCase())) ||
      item.account_id.toLowerCase().includes(searchKeyword.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <FileText className="w-5 h-5" />
            有量素材提取
          </CardTitle>
          <CardDescription>根据消耗金额和日期区间提取有量素材，支持批量账户查询</CardDescription>
          <p className="text-destructive text-sm mt-2">△ 备用cookie可用数量越多，提取速度越快</p>
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
              每行填写一个广告账户ID，支持多个账户批量查询
            </p>
          </div>

          {/* 筛选条件 */}
          <div className="grid gap-2">
            <Label className="text-base font-semibold">筛选条件 *</Label>
            <div className="flex gap-2 items-center">
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as FilterType)
                  setFilterValue('0')
                  setError('')
                }}
                disabled={isSubmitting}
                className="h-11 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="consumption_amount">消耗大于 (元)</option>
                <option value="activated_count">APP激活数大于</option>
                {/* <option value="activated_cost">激活成本大于 (元)</option> */}
              </select>
              <Input
                type="number"
                step={
                  filterType === 'consumption_amount' || filterType === 'activated_cost'
                    ? '0.01'
                    : '1'
                }
                min="0"
                placeholder={getFilterPlaceholder(filterType)}
                value={filterValue}
                onChange={(e) => {
                  setFilterValue(e.target.value)
                  setError('')
                }}
                disabled={isSubmitting}
                className="h-11 flex-1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              选择一个筛选条件，只提取满足该条件的创意
            </p>
          </div>

          {/* 日期区间 */}
          <div className="grid gap-2">
            <Label className="text-base font-semibold">消耗日期区间 *</Label>
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
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-between items-center pt-4 border-t">
            {/* 查看结果按钮 */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => {
                  if (materials.length === 0) {
                    alert('暂无提取结果，请先执行提取操作')
                    return
                  }
                  setIsResultsPanelOpen(true)
                }}
                variant="outline"
                size="lg"
                className="min-w-[160px] border-2 border-primary shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15"
              >
                <Eye className="mr-2 w-4 h-4 text-primary" />
                <span className="text-primary font-semibold">查看结果</span>
                {materials.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground font-bold shadow-sm"
                  >
                    {materials.length}
                  </motion.span>
                )}
              </Button>
            </motion.div>

            {/* 开始提取按钮 */}
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !selectedConfigId ||
                !adAccountIds.trim() ||
                !filterValue ||
                parseFloat(filterValue) < 0 ||
                !startDate ||
                !endDate
              }
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  提取中...
                </>
              ) : (
                <>
                  <FileText className="mr-2 w-4 h-4" />
                  开始提取
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
                        查看提取操作的执行过程和结果
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

      {/* 结果面板 */}
      {isResultsPanelOpen && materials.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsResultsPanelOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-card border rounded-lg shadow-2xl w-[90%] max-w-6xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex justify-between items-center p-6 border-b bg-primary text-primary-foreground rounded-t-lg">
              <div>
                <h3 className="text-xl font-bold">有量素材提取结果 ({materials.length}条)</h3>
                <p className="text-sm opacity-90 mt-1">查看详细列表和导出数据</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResultsPanelOpen(false)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* 工具栏 */}
            <div className="flex gap-2 p-4 border-b bg-muted/30">
              <Button onClick={handleExportCSV} size="sm" className="gap-2">
                <FileDown className="w-4 h-4" />
                导出CSV
              </Button>
              <Button onClick={handleCopyDayuCids} size="sm" variant="outline" className="gap-2">
                <Copy className="w-4 h-4" />
                复制大鱼cid
              </Button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索创意名称、大鱼cid或账户ID..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full border-collapse">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-3 text-left text-sm font-semibold border-b">序号</th>
                      <th className="p-3 text-left text-sm font-semibold border-b">账户ID</th>
                      <th className="p-3 text-left text-sm font-semibold border-b">创意名称</th>
                      <th className="p-3 text-left text-sm font-semibold border-b">大鱼cid</th>
                      <th className="p-3 text-left text-sm font-semibold border-b">消耗金额</th>
                      <th className="p-3 text-left text-sm font-semibold border-b">激活数</th>
                      <th className="p-3 text-left text-sm font-semibold border-b">激活成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          没有找到匹配的结果
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 text-sm">{index + 1}</td>
                          <td className="p-3 text-sm font-mono">{item.account_id}</td>
                          <td
                            className="p-3 text-sm max-w-xs truncate"
                            title={item.dynamic_creative_name}
                          >
                            {item.dynamic_creative_name}
                          </td>
                          <td className="p-3 text-sm font-mono">{item.dayu_cid || '-'}</td>
                          <td className="p-3 text-sm">{item.cost.toFixed(2)}</td>
                          <td className="p-3 text-sm">{item.activated_count?.toFixed(0) || '0'}</td>
                          <td className="p-3 text-sm">
                            {item.activated_cost?.toFixed(2) || '0.00'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
