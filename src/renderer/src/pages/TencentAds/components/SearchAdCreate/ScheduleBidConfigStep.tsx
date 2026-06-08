import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label,
  Input
} from '../../../../components/ui'
import {
  Calendar,
  DollarSign,
  Info,
  ChevronUp,
  ChevronDown,
  Clock,
  Target,
  TrendingUp,
  Wallet,
  Search,
  Loader2
} from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { SearchAdFormData } from '../../SearchAdCreatePage'
import { searchAdCreateService } from '../../../../services/tencent-ads.service'

interface ScheduleBidConfigStepProps {
  formData: SearchAdFormData
  cookieConfigId: number | null
  advertiserId: string | null
  onUpdate: (updates: Partial<SearchAdFormData>) => void
  onValidate: (valid: boolean) => void
}

interface ConversionGoal {
  conversion_id: number
  conversion_name: string
}

export const ScheduleBidConfigStep: React.FC<ScheduleBidConfigStepProps> = ({
  formData,
  cookieConfigId,
  advertiserId,
  onUpdate,
  onValidate
}) => {
  const [showBidEstimation, setShowBidEstimation] = useState(true)
  const [conversionsByAccount, setConversionsByAccount] = useState<
    Record<string, ConversionGoal[]>
  >({})
  const [loadingConversions, setLoadingConversions] = useState<Record<string, boolean>>({})
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({})

  // 解析账户ID列表
  const accountIds = advertiserId
    ? advertiserId
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((id) => parseInt(id))
        .filter((id) => !isNaN(id))
    : []

  // 加载转化目标
  const loadConversions = async (accountId: number, searchName?: string) => {
    if (!cookieConfigId) return

    const accountIdStr = accountId.toString()
    setLoadingConversions((prev) => ({ ...prev, [accountIdStr]: true }))

    try {
      const response = await searchAdCreateService.getConversionGoals({
        advertiser_id: accountId,
        selected_cookie_id: cookieConfigId,
        product_type: parseInt(formData.productType),
        site_set: formData.siteSet,
        campaign_type: 1,
        search_name: searchName
      })

      if (response.code === 0 && response.data?.list) {
        setConversionsByAccount((prev) => ({
          ...prev,
          [accountIdStr]: response.data!.list
        }))
      }
    } catch (error) {
      console.error('Failed to load conversions:', error)
    } finally {
      setLoadingConversions((prev) => ({ ...prev, [accountIdStr]: false }))
    }
  }

  // 搜索转化目标
  const handleSearch = (accountId: number) => {
    const searchName = searchTerms[accountId.toString()]
    loadConversions(accountId, searchName)
  }

  React.useEffect(() => {
    const valid = formData.beginDate !== '' && formData.costPrice !== null && formData.costPrice > 0
    onValidate(valid)
  }, [formData.beginDate, formData.costPrice, onValidate])

  // Helpers
  const isLongTerm = !formData.endDate
  const timeMode = formData.timeSet === '' ? 'all' : 'custom'

  // Common button styles
  const btnBase =
    'flex-1 px-4 py-2.5 text-sm transition-all duration-200 border first:rounded-l-md last:rounded-r-md border-r-0 last:border-r focus:outline-none focus:ring-2 focus:ring-primary/20 focus:z-10'
  const btnActive = 'bg-primary/5 border-primary text-primary font-medium z-10'
  const btnInactive =
    'bg-background border-input text-muted-foreground hover:bg-muted/50 hover:text-foreground'

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="border-b bg-slate-50/50 pb-4">
        <div className="flex gap-3 items-center">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">排期与出价</CardTitle>
            <CardDescription>配置广告的投放时间和出价策略</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 p-6">
        {/* Section 1: Schedule */}
        <div className="space-y-6">
          <div className="grid grid-cols-[120px_1fr] gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mt-2.5">
              <Clock className="w-4 h-4 text-slate-400" />
              投放日期
            </div>
            <div className="space-y-4">
              <div className="flex w-fit shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => onUpdate({ endDate: null })}
                  className={cn(btnBase, isLongTerm ? btnActive : btnInactive)}
                >
                  长期投放
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.endDate) {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      onUpdate({ endDate: tomorrow.toISOString().split('T')[0] })
                    }
                  }}
                  className={cn(btnBase, !isLongTerm ? btnActive : btnInactive)}
                >
                  指定开始及结束日期
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg w-fit transition-all hover:border-slate-200">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-medium ml-1">开始日期</label>
                  <Input
                    type="date"
                    value={formData.beginDate}
                    onChange={(e) => onUpdate({ beginDate: e.target.value })}
                    className="w-40 border-0 bg-white shadow-sm ring-1 ring-slate-200 focus-visible:ring-primary h-9"
                  />
                </div>

                {!isLongTerm && (
                  <>
                    <div className="w-4 h-px bg-slate-300 mt-5" />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 font-medium ml-1">结束日期</label>
                      <Input
                        type="date"
                        value={formData.endDate || ''}
                        onChange={(e) => onUpdate({ endDate: e.target.value })}
                        className="w-40 border-0 bg-white shadow-sm ring-1 ring-slate-200 focus-visible:ring-primary h-9"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mt-2.5">
              <Clock className="w-4 h-4 text-slate-400" />
              投放时间
            </div>
            <div className="space-y-3">
              <div className="flex w-fit shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => onUpdate({ timeSet: '' })}
                  className={cn(btnBase, timeMode === 'all' ? btnActive : btnInactive)}
                >
                  全天
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ timeSet: 'custom' })}
                  className={cn(btnBase, timeMode === 'custom' ? btnActive : btnInactive)}
                >
                  指定开始时间和结束时间
                </button>
                <button
                  type="button"
                  className={cn(btnBase, 'opacity-50 cursor-not-allowed hover:bg-background')}
                  disabled
                >
                  指定多个时段
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="firstDayTime"
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary transition-colors cursor-pointer"
                />
                <label
                  htmlFor="firstDayTime"
                  className="text-sm text-slate-600 cursor-pointer select-none"
                >
                  指定首日开始时间
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Section 2: Bidding */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 p-3 bg-blue-50/50 text-blue-700 rounded-md border border-blue-100/50">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">广告创建成功后，可于广告管理列表对各关键词单独设置出价</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mt-2.5">
              <Target className="w-4 h-4 text-slate-400" />
              出价方式
            </div>
            <div className="flex gap-3">
              {['oCPC', 'CPC'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdate({ bidMode: mode })}
                  className={cn(
                    'w-32 py-2.5 rounded-md border text-sm font-medium transition-all shadow-sm',
                    formData.bidMode === mode ||
                      (mode === 'oCPC' && formData.bidMode === '101') ||
                      (mode === 'CPC' && formData.bidMode === '102')
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-input bg-white hover:bg-slate-50 hover:text-slate-900 text-slate-600'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* 转化目标 - 按账户分开 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Target className="w-4 h-4 text-slate-400" />
              转化目标
              <Info className="w-3 h-3 text-slate-400 cursor-help" />
            </div>

            {accountIds.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground bg-slate-50 rounded-lg border border-slate-100">
                <p>请先完成广告账户配置</p>
              </div>
            ) : (
              <div className="space-y-4">
                {accountIds.map((accountId) => {
                  const accountIdStr = accountId.toString()
                  const isLoading = loadingConversions[accountIdStr]
                  const conversions = conversionsByAccount[accountIdStr] || []

                  return (
                    <div
                      key={accountId}
                      className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm"
                    >
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-slate-700">
                          账户 {accountId}
                        </Label>

                        {/* 搜索框 */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              placeholder="输入转化名称搜索"
                              value={searchTerms[accountIdStr] || ''}
                              onChange={(e) =>
                                setSearchTerms((prev) => ({
                                  ...prev,
                                  [accountIdStr]: e.target.value
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSearch(accountId)
                                }
                              }}
                              className="pr-10"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSearch(accountId)}
                            disabled={isLoading}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                搜索中
                              </>
                            ) : (
                              '搜索'
                            )}
                          </button>
                        </div>

                        {/* 转化目标下拉 */}
                        <select
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                          value={formData.selectedConversions[accountIdStr] || ''}
                          onChange={(e) => {
                            onUpdate({
                              selectedConversions: {
                                ...formData.selectedConversions,
                                [accountIdStr]: e.target.value
                              }
                            })
                          }}
                        >
                          <option value="">请选择转化目标</option>
                          {conversions.map((conversion) => (
                            <option
                              key={conversion.conversion_id}
                              value={conversion.conversion_id.toString()}
                            >
                              {conversion.conversion_name}
                            </option>
                          ))}
                        </select>

                        {conversions.length === 0 && !isLoading && (
                          <p className="text-xs text-slate-500">请输入关键词搜索转化目标</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mt-2.5">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              出价场景
            </div>
            <div className="space-y-4">
              <div className="flex w-fit shadow-sm rounded-md">
                <button
                  type="button"
                  className={cn(
                    btnBase,
                    'rounded-l-md bg-white border-input hover:bg-slate-50 text-slate-500'
                  )}
                >
                  最大转化量投放
                </button>
                <button
                  type="button"
                  className={cn(
                    btnBase,
                    'rounded-r-md bg-primary/5 border-primary text-primary font-medium z-10'
                  )}
                >
                  常规投放
                </button>
              </div>

              <div className="flex items-center gap-8 p-3 bg-slate-50/50 rounded-lg border border-slate-100 w-fit">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="radio"
                      name="deliveryType"
                      className="peer sr-only"
                      defaultChecked
                    />
                    <div className="w-4 h-4 rounded-full border border-slate-300 peer-checked:border-primary peer-checked:border-4 transition-all" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">
                    放量投放
                  </span>
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group text-slate-400">
                  <div className="relative flex items-center">
                    <input type="radio" name="deliveryType" className="peer sr-only" disabled />
                    <div className="w-4 h-4 rounded-full border border-slate-200 bg-slate-50" />
                  </div>
                  <span className="text-sm">稳定投放</span>
                  <Info className="w-3.5 h-3.5" />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mt-2.5">
              <DollarSign className="w-4 h-4 text-slate-400" />
              出价
            </div>
            <div className="max-w-xl space-y-4">
              <div className="relative group">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costPrice || ''}
                  onChange={(e) =>
                    onUpdate({ costPrice: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  className="pr-20 font-medium text-lg h-11 border-slate-200 focus-visible:ring-primary shadow-sm transition-all"
                  placeholder="0.00"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <span className="h-4 w-px bg-slate-200"></span>
                  <span className="text-sm text-slate-500 font-medium">元/激活</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="grid grid-cols-[120px_1fr] gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mt-2.5">
              <Wallet className="w-4 h-4 text-slate-400" />
              广告日预算
            </div>
            <div className="space-y-4">
              <div className="flex w-fit shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => onUpdate({ dailyBudget: null })}
                  className={cn(btnBase, !formData.dailyBudget ? btnActive : btnInactive)}
                >
                  不限
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.dailyBudget) {
                      onUpdate({ dailyBudget: 1000 })
                    }
                  }}
                  className={cn(btnBase, formData.dailyBudget ? btnActive : btnInactive)}
                >
                  指定日预算
                </button>
              </div>
              {formData.dailyBudget && (
                <div className="flex items-center gap-2 max-w-xs animate-in slide-in-from-left-2 duration-200">
                  <div className="relative w-full">
                    <Input
                      type="number"
                      value={formData.dailyBudget}
                      onChange={(e) => onUpdate({ dailyBudget: parseFloat(e.target.value) || 0 })}
                      className="pr-16"
                      placeholder="输入日预算"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                      <span className="h-4 w-px bg-slate-200"></span>
                      <span className="text-sm text-slate-500">元/天</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
