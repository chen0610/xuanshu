import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label,
  Input,
  Button
} from '../../../../components/ui'
import { Target, Tag, Heart, FileText, ShoppingBag, UserPlus, Loader2 } from 'lucide-react'
import type { SearchAdFormData } from '../../SearchAdCreatePage'
import { searchAdCreateService } from '../../../../services/tencent-ads.service'

interface CampaignConfigStepProps {
  formData: SearchAdFormData
  cookieConfigId: number | null
  advertiserId: string | null
  onUpdate: (updates: Partial<SearchAdFormData>) => void
  onValidate: (valid: boolean) => void
}

interface Campaign {
  account_id: number
  campaign_id: number
  campaign_name: string
}

// 营销目的选项
export const MARKETING_GOALS = [
  { value: '6', label: '品牌宣传', icon: Tag, color: 'text-blue-600' },
  { value: '2', label: '加粉互动', icon: Heart, color: 'text-pink-600' },
  { value: '3', label: '线索留资', icon: FileText, color: 'text-green-600' },
  { value: '4', label: '商品销售', icon: ShoppingBag, color: 'text-orange-600' },
  { value: '1', label: '用户增长', icon: UserPlus, color: 'text-purple-600' }
]

export const DEFAULT_MARKETING_GOAL = '1'

interface Product {
  product_id: string
  pname: string
}

export const CampaignConfigStep: React.FC<CampaignConfigStepProps> = ({
  formData,
  cookieConfigId,
  advertiserId,
  onUpdate,
  onValidate
}) => {
  const [loading, setLoading] = useState(false)
  const [campaignsByAccount, setCampaignsByAccount] = useState<Record<string, Campaign[]>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // 解析账户ID列表，使用 useMemo 稳定引用，避免无限循环
  const accountIds = useMemo(() => {
    if (!advertiserId) return []
    return advertiserId
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id))
  }, [advertiserId])

  // 获取第一个账户ID
  const firstAccountId = accountIds.length > 0 ? accountIds[0] : null

  // 加载已有推广计划
  useEffect(() => {
    if (formData.campaignCreateType === 'existing' && accountIds.length > 0 && cookieConfigId) {
      loadCampaigns()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.campaignCreateType, JSON.stringify(accountIds), cookieConfigId])

  // 加载应用ID列表（当营销载体类型改变时）
  useEffect(() => {
    if (
      formData.campaignCreateType === 'new' &&
      firstAccountId &&
      cookieConfigId &&
      formData.productType
    ) {
      loadProducts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.campaignCreateType, firstAccountId, cookieConfigId, formData.productType])

  // 生成默认推广计划名称
  const generateDefaultCampaignName = (): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `推广计划-${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 当切换到新建推广计划模式时，设置默认名称
  useEffect(() => {
    if (formData.campaignCreateType === 'new' && !formData.campaignName) {
      const defaultName = generateDefaultCampaignName()
      onUpdate({ campaignName: defaultName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.campaignCreateType])

  // 验证表单
  useEffect(() => {
    let valid = false
    if (formData.campaignCreateType === 'new') {
      valid = formData.campaignName !== ''
    } else {
      valid =
        accountIds.length > 0 &&
        accountIds.every((accountId) => formData.selectedCampaigns[accountId.toString()])
    }
    onValidate(valid)
  }, [
    formData.campaignCreateType,
    formData.campaignName,
    formData.selectedCampaigns,
    accountIds,
    onValidate
  ])

  const loadCampaigns = async (): Promise<void> => {
    if (!cookieConfigId || accountIds.length === 0) return

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await searchAdCreateService.getCampaigns({
        account_id_list: accountIds,
        selected_cookie_id: cookieConfigId,
        date: today
      })

      if (response.code === 0 && response.data?.campaigns) {
        // 按account_id分组
        const grouped: Record<string, Campaign[]> = {}
        response.data.campaigns.forEach((campaign) => {
          const accountId = campaign.account_id.toString()
          if (!grouped[accountId]) {
            grouped[accountId] = []
          }
          grouped[accountId].push(campaign)
        })
        console.log('分组后的推广计划:', grouped)
        console.log('账户ID列表:', accountIds)
        setCampaignsByAccount(grouped)

        // 自动选中每个账户的第一个推广计划
        const newSelectedCampaigns: Record<string, string> = { ...formData.selectedCampaigns }
        let hasChanges = false

        accountIds.forEach((accountId) => {
          const accountIdStr = accountId.toString()
          // 如果该账户还没有选择推广计划，且该账户有推广计划列表
          if (!newSelectedCampaigns[accountIdStr] && grouped[accountIdStr]?.length > 0) {
            // 选中第一个推广计划
            newSelectedCampaigns[accountIdStr] = grouped[accountIdStr][0].campaign_id.toString()
            hasChanges = true
          }
        })

        // 如果有新的选择，更新表单数据
        if (hasChanges) {
          onUpdate({ selectedCampaigns: newSelectedCampaigns })
        }
      } else {
        console.error('获取推广计划失败:', response)
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCampaignSelect = (accountId: string, campaignId: string): void => {
    onUpdate({
      selectedCampaigns: {
        ...formData.selectedCampaigns,
        [accountId]: campaignId
      }
    })
  }

  const loadProducts = async (): Promise<void> => {
    if (!cookieConfigId || !firstAccountId || !formData.productType) return

    setLoadingProducts(true)
    try {
      const response = await searchAdCreateService.getProductList({
        advertiser_id: firstAccountId,
        selected_cookie_id: cookieConfigId,
        product_type: parseInt(formData.productType)
      })

      if (response.code === 0 && response.data?.list) {
        setProducts(response.data.list)
        // 如果当前没有选择应用ID，且列表不为空，自动选择第一个
        if (!formData.productId && response.data.list.length > 0) {
          onUpdate({
            productId: response.data.list[0].product_id,
            productName: response.data.list[0].pname
          })
        }
      } else {
        console.error('获取应用ID列表失败:', response)
        setProducts([])
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      setProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3 items-center">
          <Target className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>推广计划配置</CardTitle>
            <CardDescription>选择创建类型并配置推广计划</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 创建类型选择 */}
        <div className="space-y-3">
          <Label>创建类型 *</Label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => onUpdate({ campaignCreateType: 'existing' })}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                formData.campaignCreateType === 'existing'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="font-medium">选择已有推广计划</div>
              <div className="text-sm text-muted-foreground mt-1">从已有推广计划中选择</div>
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ campaignCreateType: 'new' })}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                formData.campaignCreateType === 'new'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="font-medium">新建推广计划</div>
              <div className="text-sm text-muted-foreground mt-1">创建新的推广计划</div>
            </button>
          </div>
        </div>

        {/* 已有推广计划 */}
        {formData.campaignCreateType === 'existing' && (
          <div className="space-y-4">
            {accountIds.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>请先完成广告账户配置</p>
              </div>
            ) : (
              <>
                {accountIds.length === 1 ? (
                  // 单个账户，直接显示下拉框
                  <div className="space-y-2">
                    <Label>选择推广计划 *</Label>
                    {loading ? (
                      <div className="flex gap-2 items-center p-4 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>加载推广计划列表中...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={formData.selectedCampaigns[accountIds[0].toString()] || ''}
                          onChange={(e) =>
                            handleCampaignSelect(accountIds[0].toString(), e.target.value)
                          }
                        >
                          <option value="">请选择推广计划</option>
                          {campaignsByAccount[accountIds[0].toString()]?.map((campaign) => (
                            <option
                              key={campaign.campaign_id}
                              value={campaign.campaign_id.toString()}
                            >
                              {campaign.campaign_name}
                            </option>
                          ))}
                        </select>
                        {campaignsByAccount[accountIds[0].toString()]?.length === 0 && (
                          <p className="text-sm text-muted-foreground">该账户暂无推广计划</p>
                        )}
                        {!campaignsByAccount[accountIds[0].toString()] && (
                          <p className="text-sm text-muted-foreground">
                            请点击&ldquo;刷新推广计划列表&rdquo;加载数据
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // 多个账户，显示账户列表和对应的下拉框
                  <div className="space-y-4">
                    {accountIds.map((accountId) => (
                      <div key={accountId} className="space-y-2">
                        <Label>账户 {accountId}</Label>
                        {loading ? (
                          <div className="flex gap-2 items-center p-4 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>加载推广计划列表中...</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <select
                              className="w-full px-3 py-2 border rounded-md bg-background"
                              value={formData.selectedCampaigns[accountId.toString()] || ''}
                              onChange={(e) =>
                                handleCampaignSelect(accountId.toString(), e.target.value)
                              }
                            >
                              <option value="">请选择推广计划</option>
                              {campaignsByAccount[accountId.toString()]?.map((campaign) => (
                                <option
                                  key={campaign.campaign_id}
                                  value={campaign.campaign_id.toString()}
                                >
                                  {campaign.campaign_name}
                                </option>
                              ))}
                            </select>
                            {campaignsByAccount[accountId.toString()]?.length === 0 && (
                              <p className="text-sm text-muted-foreground">该账户暂无推广计划</p>
                            )}
                            {!campaignsByAccount[accountId.toString()] && (
                              <p className="text-sm text-muted-foreground">
                                请点击&ldquo;刷新推广计划列表&rdquo;加载数据
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!loading && (
                  <Button variant="outline" onClick={loadCampaigns} className="w-full">
                    刷新推广计划列表
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* 新建推广计划 */}
        {formData.campaignCreateType === 'new' && (
          <div className="space-y-6">
            {/* 营销目的 */}
            <div className="space-y-3">
              <Label>营销目的 *</Label>
              <div className="grid grid-cols-5 gap-3">
                {MARKETING_GOALS.map((goal) => {
                  const Icon = goal.icon
                  const isSelected = formData.marketingGoal === goal.value
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => onUpdate({ marketingGoal: goal.value })}
                      className={`relative p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-primary-foreground"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-2">
                        <Icon className={`w-8 h-8 ${goal.color}`} />
                        <span className="text-sm font-medium">{goal.label}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 营销载体类型 */}
            <div className="space-y-3">
              <Label>营销载体类型 *</Label>
              <div className="flex gap-3">
                {[
                  { value: '20', label: 'Android 应用' },
                  { value: '19', label: 'IOS 应用' },
                  { value: '21', label: '微信小游戏' }
                ].map((type) => {
                  const isSelected = formData.productType === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        onUpdate({ productType: type.value, productId: null, productName: null })
                        setProducts([])
                      }}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 应用ID */}
            {formData.campaignCreateType === 'new' && (
              <div className="space-y-2">
                <Label>应用ID</Label>
                {!firstAccountId ? (
                  <p className="text-sm text-muted-foreground">请先完成广告账户配置</p>
                ) : (
                  <div className="space-y-2">
                    {loadingProducts ? (
                      <div className="flex gap-2 items-center p-4 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>加载应用列表中...</span>
                      </div>
                    ) : (
                      <select
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={formData.productId || ''}
                        onChange={(e) => onUpdate({ productId: e.target.value || null })}
                      >
                        <option value="">请选择应用</option>
                        {products.map((product) => (
                          <option key={product.product_id} value={product.product_id}>
                            {product.pname}-{product.product_id}
                          </option>
                        ))}
                      </select>
                    )}
                    {!loadingProducts && products.length === 0 && (
                      <p className="text-sm text-muted-foreground">该账户暂无应用，请先添加应用</p>
                    )}
                    {!loadingProducts && products.length === 0 && firstAccountId && (
                      <Button variant="outline" onClick={loadProducts} className="w-full">
                        刷新应用列表
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 计划日预算 */}
            <div className="space-y-3">
              <Label>计划日预算</Label>
              <div className="flex gap-3">
                {[
                  { value: 'unlimited', label: '不限' },
                  { value: 'specified', label: '指定日预算' }
                ].map((option) => {
                  const isUnlimited = formData.dailyBudget === null || formData.dailyBudget === 0
                  const isSelected =
                    (option.value === 'unlimited' && isUnlimited) ||
                    (option.value === 'specified' && !isUnlimited)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          dailyBudget:
                            option.value === 'unlimited' ? null : formData.dailyBudget || 0
                        })
                      }
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {formData.dailyBudget !== null && formData.dailyBudget !== 0 && (
                <Input
                  type="number"
                  placeholder="输入日预算金额（元）"
                  value={formData.dailyBudget || ''}
                  onChange={(e) =>
                    onUpdate({
                      dailyBudget: e.target.value ? parseFloat(e.target.value) : null
                    })
                  }
                  className="mt-2"
                />
              )}
            </div>

            {/* 计划总预算 */}
            <div className="space-y-3">
              <Label>计划总预算</Label>
              <div className="flex gap-3">
                {[
                  { value: 'unlimited', label: '不限' },
                  { value: 'specified', label: '指定总预算' }
                ].map((option) => {
                  const isUnlimited = formData.totalBudget === null || formData.totalBudget === 0
                  const isSelected =
                    (option.value === 'unlimited' && isUnlimited) ||
                    (option.value === 'specified' && !isUnlimited)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          totalBudget:
                            option.value === 'unlimited' ? null : formData.totalBudget || 0
                        })
                      }
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {formData.totalBudget !== null && formData.totalBudget !== 0 && (
                <Input
                  type="number"
                  placeholder="输入总预算金额（元）"
                  value={formData.totalBudget || ''}
                  onChange={(e) =>
                    onUpdate({
                      totalBudget: e.target.value ? parseFloat(e.target.value) : null
                    })
                  }
                  className="mt-2"
                />
              )}
            </div>

            {/* 推广计划名称 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="campaignName">推广计划名称 *</Label>
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <span>{formData.campaignName.length}/60</span>
                </div>
              </div>
              <Input
                id="campaignName"
                placeholder="输入推广计划名称"
                value={formData.campaignName}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 60)
                  onUpdate({ campaignName: value })
                }}
                maxLength={60}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
