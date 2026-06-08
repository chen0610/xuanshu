import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Circle,
  Loader2,
  Save,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button, Progress } from '../../components/ui'
import { configService } from '../../services/config.service'
import { searchAdCreateService } from '../../services/tencent-ads.service'
import { CookieConfigStep } from './components/SearchAdCreate/CookieConfigStep'
import { AccountConfigStep } from './components/SearchAdCreate/AccountConfigStep'
import { CampaignConfigStep } from './components/SearchAdCreate/CampaignConfigStep'
import { PlacementConfigStep } from './components/SearchAdCreate/PlacementConfigStep'
import { TargetingConfigStep } from './components/SearchAdCreate/TargetingConfigStep'
import { ScheduleBidConfigStep } from './components/SearchAdCreate/ScheduleBidConfigStep'
import { KeywordConfigStep } from './components/SearchAdCreate/KeywordConfigStep'
import { CreativeConfigStep } from './components/SearchAdCreate/CreativeConfigStep'
import { cn } from '../../lib/utils'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

// 步骤配置
const STEPS = [
  { id: 1, title: 'Cookie配置', key: 'cookie' },
  { id: 2, title: '广告账户配置', key: 'account' },
  { id: 3, title: '推广计划配置', key: 'campaign' },
  { id: 4, title: '广告版位配置', key: 'placement' },
  { id: 5, title: '定向配置', key: 'targeting' },
  { id: 6, title: '排期与出价配置', key: 'scheduleBid' },
  { id: 7, title: '关键词配置', key: 'keyword' },
  { id: 8, title: '广告创意配置', key: 'creative' }
]

// 表单数据接口
export interface SearchAdFormData {
  // Cookie配置
  cookieConfigId: number | null

  // 广告账户配置
  advertiserId: string | null

  // 推广计划配置
  campaignCreateType: 'new' | 'existing' // 创建类型：新建或已有
  campaignName: string
  campaignType: string
  marketingGoal: string
  productType: string
  dailyBudget: number | null
  totalBudget: number | null
  speedMode: string
  selectedCampaigns: Record<string, string> // 已有推广计划选择：accountId -> campaignId

  // 广告版位配置
  siteSet: number[]
  autoSitesetSwitch: boolean

  // 定向配置
  geographicLocation: string
  gender: string
  age: string[]
  customAudience: string
  installedUsers: string
  filterConvertedUsers: string

  // 排期与出价配置
  beginDate: string
  endDate: string | null
  timeSet: string
  costType: string
  bidMode: string
  costPrice: number | null
  optimizationGoal: string
  selectedConversions: Record<string, string> // accountId -> conversionId

  // 关键词配置
  keywords: Array<{
    keyword: string
    matchType: string
    bidPrice: number
  }>

  // 广告创意配置
  adgroupName: string
  creativeName: string
  titles: string[]
  descriptions: string[]
  autoSelectTitles: boolean // 是否自动挑选标题
  accountTitles: Record<string, string[]> // 每个账户的标题映射：accountId -> titles[]
  brandImageId: string | null
  brandName: string | null
  materialsPerBatch: number // 每批素材数量（1-20）
  // 两步素材选择
  step1Materials: Array<{
    media_id: string
    media_description: string
    base_media_url: string
    key_frame_image_url: string
    cover_image_id: string
    video_width?: number
    video_height?: number
  }> // 第一步：横屏视频素材
  step2Materials: Array<{
    media_id: string
    media_description: string
    base_media_url: string
    key_frame_image_url: string
    cover_image_id: string
    video_width?: number
    video_height?: number
  }> // 第二步：所有素材（横屏+竖屏）
  // 保留旧字段以兼容，但不再使用
  creativeMaterials: Array<{
    media_id: string
    media_description: string
    base_media_url: string
    key_frame_image_url: string
    cover_image_id: string
  }>
  productId: string | null
  productName: string | null
}

// 生成当前时间格式（YYYY-MM-DD HH:mm）
const getCurrentTimeString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const DEFAULT_FORM_DATA: SearchAdFormData = {
  cookieConfigId: null,
  advertiserId: null,
  campaignCreateType: 'new',
  campaignName: '',
  campaignType: '1',
  marketingGoal: '1',
  productType: '19',
  dailyBudget: null,
  totalBudget: null,
  speedMode: '1',
  selectedCampaigns: {},
  siteSet: [],
  autoSitesetSwitch: false,
  geographicLocation: 'unlimited',
  gender: 'unlimited',
  age: [],
  customAudience: 'unlimited',
  installedUsers: 'unlimited',
  filterConvertedUsers: 'application',
  beginDate: new Date().toISOString().split('T')[0],
  endDate: null,
  timeSet:
    '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  costType: '1',
  bidMode: '101',
  costPrice: null,
  optimizationGoal: '104',
  selectedConversions: {},
  keywords: [],
  adgroupName: `搜索广告-${getCurrentTimeString()}`,
  creativeName: `动态创意-搜索广告-创意-${getCurrentTimeString()}`,
  titles: [],
  descriptions: ['看短剧领红包！看短剧就能赚钱，一元就能提现！'],
  autoSelectTitles: true, // 默认选中自动挑选标题
  accountTitles: {},
  brandImageId: null,
  brandName: null,
  materialsPerBatch: 6, // 默认每批6个素材
  step1Materials: [],
  step2Materials: [],
  creativeMaterials: [],
  productId: null,
  productName: null
}

export const SearchAdCreatePage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [formData, setFormData] = useState<SearchAdFormData>(DEFAULT_FORM_DATA)
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !formData.cookieConfigId) {
        setFormData((prev) => ({ ...prev, cookieConfigId: tencentConfigs[0].id }))
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  const updateFormData = (updates: Partial<SearchAdFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const markStepComplete = useCallback((stepId: number) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]))
  }, [])

  const markStepIncomplete = useCallback((stepId: number) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev)
      newSet.delete(stepId)
      return newSet
    })
  }, [])

  // 使用 useCallback 稳定 onValidate 函数引用，避免无限循环
  const handleStep3Validate = useCallback(
    (valid: boolean) => {
      if (valid) markStepComplete(3)
      else markStepIncomplete(3)
    },
    [markStepComplete, markStepIncomplete]
  )

  const handleStep5Validate = useCallback(() => {
    markStepComplete(5)
  }, [markStepComplete])

  const handleStep6Validate = useCallback(
    (valid: boolean) => {
      if (valid) markStepComplete(6)
      else markStepIncomplete(6)
    },
    [markStepComplete, markStepIncomplete]
  )

  const handleStep8Validate = useCallback(
    (valid: boolean) => {
      if (valid) markStepComplete(8)
      else markStepIncomplete(8)
    },
    [markStepComplete, markStepIncomplete]
  )

  const validateStep = (stepId: number): boolean => {
    switch (stepId) {
      case 1:
        return formData.cookieConfigId !== null
      case 2:
        if (!formData.advertiserId) return false
        // 验证至少有一个有效的账户ID（过滤空行后）
        const accountIds = formData.advertiserId
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
        return accountIds.length > 0
      case 3:
        if (formData.campaignCreateType === 'new') {
          return formData.campaignName !== ''
        } else {
          // 已有推广计划：每个账户都要选择推广计划
          const accountIds = formData.advertiserId
            ? formData.advertiserId
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            : []
          return (
            accountIds.length > 0 &&
            accountIds.every((accountId) => formData.selectedCampaigns[accountId])
          )
        }
      case 4:
        return formData.siteSet.length > 0
      case 5:
        return true // 定向配置有默认值
      case 6:
        return formData.beginDate !== '' && formData.costPrice !== null && formData.costPrice > 0
      case 7:
        return formData.keywords.length > 0
      case 8:
        // 如果启用自动挑选标题，检查accountTitles是否有数据；否则检查手动输入的titles
        const titlesValid = formData.autoSelectTitles
          ? Object.keys(formData.accountTitles).length > 0 &&
            Object.values(formData.accountTitles).every((titles) => titles.length > 0)
          : formData.titles.length > 0
        return (
          formData.adgroupName !== '' &&
          formData.creativeName !== '' &&
          titlesValid &&
          formData.brandImageId !== null
        )
      default:
        return false
    }
  }

  const handleStepChange = (stepId: number) => {
    if (stepId < currentStep || completedSteps.has(stepId) || stepId === currentStep + 1) {
      setCurrentStep(stepId)
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      markStepComplete(currentStep)
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(8)) {
      return
    }

    // 解析账户ID列表
    const accountIds = formData.advertiserId
      ? formData.advertiserId
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id))
      : []

    if (accountIds.length === 0) {
      alert('请至少输入一个有效的账户ID')
      return
    }

    setIsSubmitting(true)

    try {
      // 构建账户配置列表
      const accountConfigs = accountIds.map((advertiserId) => {
        const accountConfig: any = {
          advertiser_id: advertiserId
        }

        // 根据创建类型设置推广计划
        if (formData.campaignCreateType === 'existing') {
          const campaignId = formData.selectedCampaigns[advertiserId.toString()]
          if (!campaignId) {
            throw new Error(`账户 ${advertiserId} 未选择推广计划`)
          }
          accountConfig.campaign_id = parseInt(campaignId)
        }

        // 设置转化目标
        const conversionId = formData.selectedConversions[advertiserId.toString()]
        if (conversionId) {
          accountConfig.conversion_id = parseInt(conversionId)
        }

        return accountConfig
      })

      // 素材分配逻辑：根据用户设置的每批素材数量进行分批，第一步素材必须放在第一个
      const step1Materials = formData.step1Materials || []
      const step2Materials = formData.step2Materials || []
      const materialsPerBatch = Math.max(1, Math.min(20, formData.materialsPerBatch || 6)) // 确保在1-20范围内

      if (step1Materials.length === 0) {
        alert('请至少添加一个第一步的横屏视频素材')
        setIsSubmitting(false)
        return
      }

      // 合并素材：第一步素材 + 第二步素材
      const allMaterials = [...step1Materials, ...step2Materials]

      // 将素材分批，每批最多materialsPerBatch个，第一步素材必须放在每批的第一个
      const materialBatches: Array<typeof step1Materials> = []

      if (allMaterials.length <= materialsPerBatch) {
        // 如果总数不超过每批数量，只创建一批
        materialBatches.push(allMaterials)
      } else {
        // 如果超过每批数量，分批创建
        // 每批都包含第一步的所有素材（放在前面）+ 第二步的部分素材
        const step1Count = step1Materials.length
        const remainingSlots = materialsPerBatch - step1Count

        if (remainingSlots <= 0) {
          alert(`第一步的素材数量不能超过每批素材数量（当前设置：${materialsPerBatch}个）`)
          setIsSubmitting(false)
          return
        }

        // 将第二步素材分批
        for (let i = 0; i < step2Materials.length; i += remainingSlots) {
          const batch = [
            ...step1Materials, // 第一步素材放在前面
            ...step2Materials.slice(i, i + remainingSlots) // 第二步素材
          ]
          materialBatches.push(batch)
        }
      }

      // 将所有账户和批次展开为多个账户配置，每个账户的每个批次作为一个独立的账户配置
      // 这样后端可以为每个账户的每个批次创建一个广告，并充分利用多Cookie并发
      const expandedAccountConfigs: any[] = []
      const expandedMaterialBatches: Array<{
        accountId: number
        batchIndex: number
        materials: any[]
      }> = []

      for (const accountConfig of accountConfigs) {
        for (let batchIndex = 0; batchIndex < materialBatches.length; batchIndex++) {
          const materials = materialBatches[batchIndex]
          // 为每个批次创建一个账户配置
          expandedAccountConfigs.push({
            advertiser_id: accountConfig.advertiser_id,
            campaign_id: accountConfig.campaign_id,
            conversion_id: accountConfig.conversion_id,
            batch_index: batchIndex, // 批次索引，用于生成广告名称
            materials: materials // 该批次的素材
          })
          expandedMaterialBatches.push({
            accountId: accountConfig.advertiser_id,
            batchIndex,
            materials
          })
        }
      }

      // 构建单个批量请求，包含所有账户和批次
      // 后端会为每个账户配置创建一个广告，并充分利用多Cookie并发
      const request = {
        account_configs: expandedAccountConfigs.map((config) => ({
          advertiser_id: config.advertiser_id,
          campaign_id: config.campaign_id,
          conversion_id: config.conversion_id
        })),
        selected_cookie_id: formData.cookieConfigId!,
        campaign_create_type: formData.campaignCreateType,
        campaign_name: formData.campaignCreateType === 'new' ? formData.campaignName : undefined,
        campaign_type: formData.campaignType,
        marketing_goal: formData.marketingGoal,
        product_type: formData.productType,
        daily_budget: formData.dailyBudget ? Math.round(formData.dailyBudget * 100) : undefined,
        total_budget: formData.totalBudget ? Math.round(formData.totalBudget * 100) : undefined,
        speed_mode: formData.speedMode,
        adgroup_name: formData.adgroupName, // 基础广告名称，后端会根据批次索引添加后缀
        site_set: formData.siteSet,
        auto_siteset_switch: formData.autoSitesetSwitch ? 1 : 0,
        begin_date: formData.beginDate,
        end_date: formData.endDate || null,
        time_set: formData.timeSet,
        cost_type: formData.costType,
        bid_mode: formData.bidMode,
        cost_price: Math.round((formData.costPrice || 0) * 100), // 转换为分
        optimization_goal: formData.optimizationGoal,
        geographic_location: formData.geographicLocation,
        gender: formData.gender,
        age: formData.age,
        custom_audience: formData.customAudience,
        installed_users: formData.installedUsers,
        filter_converted_users: formData.filterConvertedUsers,
        keywords: formData.keywords.map((k) => ({
          keyword: k.keyword,
          match_type: k.matchType,
          bid_price: Math.round(k.bidPrice * 100) // 转换为分
        })),
        creative_name: formData.creativeName, // 基础创意名称，后端会根据批次索引添加后缀
        titles: formData.autoSelectTitles ? [] : formData.titles, // 如果启用自动挑选，传空数组
        account_titles: formData.autoSelectTitles ? formData.accountTitles : undefined, // 如果启用自动挑选，传递分账户标题
        descriptions: formData.descriptions,
        brand_image_id: formData.brandImageId!,
        brand_name: formData.brandName,
        // 为每个账户配置传递对应的素材批次
        // 使用 account_materials 字段，格式：{ account_id: { batch_index: materials[] } }
        account_materials: expandedAccountConfigs.reduce(
          (acc, config) => {
            const accountIdStr = config.advertiser_id.toString()
            if (!acc[accountIdStr]) {
              acc[accountIdStr] = {}
            }
            acc[accountIdStr][config.batch_index] = config.materials.map((m: any) => ({
              media_id: m.media_id,
              media_description: m.media_description,
              base_media_url: m.base_media_url,
              key_frame_image_url: m.key_frame_image_url,
              cover_image_id: m.cover_image_id
            }))
            return acc
          },
          {} as Record<string, Record<number, any[]>>
        ),
        product_id: formData.productId,
        product_name: formData.productName
      }

      // 只发送一次请求，让后端处理所有并发
      const response = await searchAdCreateService.batchCreateSearchAd(request)

      if (response.code === 0 && response.data) {
        const { total_success, total_error, account_results } = response.data

        let message = `批量创建完成！\n成功: ${total_success} 个账户，失败: ${total_error} 个账户\n\n`

        if (total_success > 0) {
          message += '成功账户：\n'
          account_results
            .filter((r: any) => r.success)
            .forEach((r: any) => {
              message += `  账户 ${r.account_id}: 创建成功\n`
            })
        }

        if (total_error > 0) {
          message += '\n失败账户：\n'
          account_results
            .filter((r: any) => !r.success)
            .forEach((r: any) => {
              message += `  账户 ${r.account_id}: ${r.error || '未知错误'}\n`
            })
        }

        alert(message)
      } else {
        alert('批量创建失败: ' + (response.error || response.msg || '未知错误'))
      }
    } catch (error: any) {
      console.error('批量创建失败:', error)
      alert('批量创建失败: ' + (error.message || '未知错误'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const progress = (completedSteps.size / STEPS.length) * 100

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <CookieConfigStep
            configs={configs}
            selectedConfigId={formData.cookieConfigId}
            onSelect={(id) => {
              updateFormData({ cookieConfigId: id })
              if (id) markStepComplete(1)
              else markStepIncomplete(1)
            }}
          />
        )
      case 2:
        return (
          <AccountConfigStep
            configId={formData.cookieConfigId}
            advertiserId={formData.advertiserId}
            onSelect={(id) => {
              updateFormData({ advertiserId: id })
              if (id) markStepComplete(2)
              else markStepIncomplete(2)
            }}
          />
        )
      case 3:
        return (
          <CampaignConfigStep
            formData={formData}
            cookieConfigId={formData.cookieConfigId}
            advertiserId={formData.advertiserId}
            onUpdate={updateFormData}
            onValidate={handleStep3Validate}
          />
        )
      case 4:
        return (
          <PlacementConfigStep
            siteSet={formData.siteSet}
            autoSitesetSwitch={formData.autoSitesetSwitch}
            onUpdate={(updates) => {
              updateFormData(updates)
              if (updates.siteSet && updates.siteSet.length > 0) markStepComplete(4)
              else markStepIncomplete(4)
            }}
          />
        )
      case 5:
        return (
          <TargetingConfigStep
            formData={formData}
            onUpdate={updateFormData}
            onValidate={handleStep5Validate}
          />
        )
      case 6:
        return (
          <ScheduleBidConfigStep
            formData={formData}
            cookieConfigId={formData.cookieConfigId}
            advertiserId={formData.advertiserId}
            onUpdate={updateFormData}
            onValidate={handleStep6Validate}
          />
        )
      case 7:
        return (
          <KeywordConfigStep
            keywords={formData.keywords}
            onUpdate={(keywords) => {
              updateFormData({ keywords })
              if (keywords.length > 0) markStepComplete(7)
              else markStepIncomplete(7)
            }}
          />
        )
      case 8:
        return (
          <CreativeConfigStep
            formData={formData}
            onUpdate={updateFormData}
            onValidate={handleStep8Validate}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* 左侧步骤导航 */}
      <div className="w-64 border-r bg-card flex-shrink-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-2">创建搜索广告</h2>
            <p className="text-sm text-muted-foreground">按步骤完成配置</p>
          </div>

          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">完成进度</span>
              <span className="font-medium">
                {completedSteps.size}/{STEPS.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* 步骤列表 */}
          <div className="space-y-2">
            {STEPS.map((step, index) => {
              const isActive = currentStep === step.id
              const isCompleted = completedSteps.has(step.id)
              const isAccessible = step.id <= currentStep || isCompleted

              return (
                <motion.button
                  key={step.id}
                  onClick={() => handleStepChange(step.id)}
                  disabled={!isAccessible}
                  className={cn(
                    'flex gap-3 items-center w-full p-3 rounded-lg text-left transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-muted hover:bg-muted/80'
                        : isAccessible
                          ? 'hover:bg-accent'
                          : 'opacity-50 cursor-not-allowed'
                  )}
                  whileHover={isAccessible ? { scale: 1.02 } : {}}
                  whileTap={isAccessible ? { scale: 0.98 } : {}}
                >
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Circle className={cn('w-5 h-5', isActive && 'fill-current')} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-xs opacity-70">步骤 {step.id}</div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 右侧内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部操作栏 */}
        <div className="border-b bg-card px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{STEPS[currentStep - 1]?.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              步骤 {currentStep} / {STEPS.length}
            </p>
          </div>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrev}>
                <ChevronLeft className="mr-2 w-4 h-4" />
                上一步
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={!validateStep(currentStep)}>
                下一步
                <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || !validateStep(8)}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 w-4 h-4" />
                    提交创建
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
