import React, { useMemo } from 'react'
import { ChevronRight, CopyPlus, Layers3, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea
} from '../../../components/ui'
import type {
  OceanEngineAdTemplateDetail,
  OceanEngineAdTemplateSummary,
  OceanEngineCustomAdTemplate
} from '../../../services/ocean-engine.service'
import type { AwemeOption } from './QuickConfigCard'

export const CUSTOM_TEMPLATE_CODE = '__custom__'

type ChoiceOption = {
  label: string
  value: string
  description?: string
}

type FieldType = 'text' | 'number' | 'textarea' | 'choice'

type FieldPath =
  | 'project.name'
  | 'project.budget'
  | 'project.landingType'
  | 'project.marketingGoal'
  | 'project.microPromotionType'
  | 'project.pricing'
  | 'project.bidType'
  | 'project.deepBidType'
  | 'project.roiGoal'
  | 'project.productPlatformId'
  | 'project.productId'
  | 'project.externalAction'
  | 'project.deepExternalAction'
  | 'project.inventoryCatalog'
  | 'project.gender'
  | 'project.hideIfConverted'
  | 'unit.name'
  | 'unit.source'
  | 'unit.awemeId'
  | 'unit.playletUrl'
  | 'unit.dramaName'
  | 'unit.materialsPerUnit'

type CustomTemplateField = {
  path: FieldPath
  label: string
  description?: string
  type: FieldType
  placeholder?: string
  min?: number
  max?: number
  step?: number
  options?: ChoiceOption[]
}

type CustomTemplateSection = {
  key: string
  title: string
  description: string
  fields: CustomTemplateField[]
}

export interface CustomTemplateFormState {
  project: {
    name: string
    budget: string
    landingType: string
    marketingGoal: string
    microPromotionType: string
    pricing: string
    bidType: string
    deepBidType: string
    roiGoal: string
    productPlatformId: string
    productId: string
    externalAction: string
    deepExternalAction: string
    inventoryCatalog: string
    gender: string
    hideIfConverted: string
  }
  unit: {
    name: string
    source: string
    awemeId: string
    playletUrl: string
    dramaName: string
    materialsPerUnit: string
  }
}

const PROJECT_SECTIONS: CustomTemplateSection[] = [
  {
    key: 'project-basic',
    title: '项目配置',
    description: '保留原生创建项目的组织方式，把高频字段放在第一屏。',
    fields: [
      {
        path: 'project.name',
        label: '项目名称',
        type: 'text',
        placeholder: '输入项目名称'
      },
      {
        path: 'project.budget',
        label: '日预算',
        description: '对应 delivery_setting.budget',
        type: 'number',
        min: 100,
        step: 1,
        placeholder: '300'
      },
      {
        path: 'project.productPlatformId',
        label: '商品平台 ID',
        type: 'text',
        placeholder: '2054178541160228'
      },
      {
        path: 'project.productId',
        label: '商品 ID',
        type: 'text',
        placeholder: '支持自动查询或手动覆盖'
      },
      {
        path: 'project.landingType',
        label: '落地页类型',
        type: 'choice',
        options: [
          { label: '小程序 / 微游戏', value: 'MICRO_GAME' },
          { label: '橙子建站', value: 'LINK' }
        ]
      },
      {
        path: 'project.microPromotionType',
        label: '推广载体',
        type: 'choice',
        options: [
          { label: '抖音号', value: 'AWEME' },
          { label: '广告组件', value: 'MICRO_APP' }
        ]
      }
    ]
  },
  {
    key: 'project-strategy',
    title: '出价与优化',
    description: '把投放目标、出价方式和 ROI 放在同一个决策区里。',
    fields: [
      {
        path: 'project.externalAction',
        label: '优化目标',
        type: 'choice',
        options: [
          { label: '激活', value: 'AD_CONVERT_TYPE_ACTIVE' },
          { label: '付费', value: 'AD_CONVERT_TYPE_PAY' }
        ]
      },
      {
        path: 'project.deepExternalAction',
        label: '深度目标',
        description: '可选项会随优化目标联动变化',
        type: 'choice',
        options: [
          { label: 'ROI', value: 'AD_CONVERT_TYPE_LT_ROI' },
          { label: '付费 ROI', value: 'AD_CONVERT_TYPE_PURCHASE_ROI' }
        ]
      },
      {
        path: 'project.pricing',
        label: '计费方式',
        type: 'choice',
        options: [
          { label: 'OCPM', value: 'PRICING_OCPM' },
          { label: 'CPC', value: 'PRICING_CPC' }
        ]
      },
      {
        path: 'project.bidType',
        label: '出价模式',
        type: 'choice',
        options: [
          { label: '手动出价', value: 'CUSTOM' },
          { label: '自动出价', value: 'NO_BID' }
        ]
      },
      {
        path: 'project.deepBidType',
        label: '深度出价',
        description: '可选项会随深度目标联动变化',
        type: 'choice',
        options: [
          { label: 'ROI 系数', value: 'ROI_COEFFICIENT' },
          { label: '自动托管', value: 'DEFAULT' }
        ]
      },
      {
        path: 'project.roiGoal',
        label: 'ROI 系数',
        description: '对应 delivery_setting.roi_goal',
        type: 'number',
        min: 0,
        step: 0.1,
        placeholder: '0.9'
      }
    ]
  },
  {
    key: 'project-audience',
    title: '定向默认项',
    description: '第一版先开放最常用的默认定向参数，其余继续继承模板。',
    fields: [
      {
        path: 'project.inventoryCatalog',
        label: '流量范围',
        type: 'choice',
        options: [
          { label: '通投智能', value: 'UNIVERSAL_SMART' },
          { label: '优选流量', value: 'PREFERRED' }
        ]
      },
      {
        path: 'project.gender',
        label: '性别',
        type: 'choice',
        options: [
          { label: '不限', value: 'NONE' },
          { label: '男', value: 'GENDER_MALE' },
          { label: '女', value: 'GENDER_FEMALE' }
        ]
      },
      {
        path: 'project.hideIfConverted',
        label: '转化用户排除',
        type: 'choice',
        options: [
          { label: '不排除', value: 'NO_EXCLUDE' },
          { label: '排除已转化', value: 'EXCLUDE_CONVERTED' }
        ]
      }
    ]
  }
]

const UNIT_SECTIONS: CustomTemplateSection[] = [
  {
    key: 'unit-basic',
    title: '单元配置',
    description: '参考原生创建单元页，把名称、投放身份和素材入口集中在一起。',
    fields: [
      {
        path: 'unit.name',
        label: '单元名称',
        type: 'text',
        placeholder: '输入广告单元名称'
      },
      {
        path: 'unit.source',
        label: '来源标记',
        type: 'text',
        placeholder: '番茄'
      },
      {
        path: 'unit.awemeId',
        label: '投放身份（抖音号）',
        type: 'textarea',
        placeholder: '63279742087'
      },
      {
        path: 'unit.playletUrl',
        label: '短剧推广链接',
        type: 'textarea',
        placeholder: 'aweme://playlet?...'
      },
      {
        path: 'unit.dramaName',
        label: '产品名称',
        type: 'text',
        placeholder: '输入产品名称，最多 20 字'
      },
      {
        path: 'unit.materialsPerUnit',
        label: '每单元素材数',
        description: '超出后按批量规则自动拆单元',
        type: 'number',
        min: 1,
        max: 30,
        step: 1,
        placeholder: '10'
      }
    ]
  }
]

function parseOptionalInt(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function parseOptionalFloat(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseFloat(trimmed)
  return Number.isNaN(parsed) ? undefined : parsed
}

const DEEP_GOAL_OPTIONS_BY_EXTERNAL_ACTION: Record<string, ChoiceOption[]> = {
  AD_CONVERT_TYPE_ACTIVE: [
    { label: 'ROI', value: 'AD_CONVERT_TYPE_LT_ROI' },
    { label: '留存天数', value: 'AD_CONVERT_TYPE_RETENTION_DAYS' }
  ],
  AD_CONVERT_TYPE_PAY: [
    { label: '付费 ROI', value: 'AD_CONVERT_TYPE_PURCHASE_ROI' },
    { label: 'ROI', value: 'AD_CONVERT_TYPE_LT_ROI' }
  ]
}

const DEEP_BID_OPTIONS_BY_DEEP_GOAL: Record<string, ChoiceOption[]> = {
  AD_CONVERT_TYPE_LT_ROI: [
    { label: 'ROI 系数', value: 'ROI_COEFFICIENT' },
    { label: '自动托管', value: 'DEFAULT' }
  ],
  AD_CONVERT_TYPE_PURCHASE_ROI: [
    { label: 'ROI 系数', value: 'ROI_COEFFICIENT' },
    { label: '自动托管', value: 'DEFAULT' }
  ],
  AD_CONVERT_TYPE_RETENTION_DAYS: [{ label: '自动托管', value: 'DEFAULT' }]
}

function readNested(
  source: Record<string, any> | undefined,
  path: string[],
  fallback = ''
): string {
  let current: any = source
  for (const key of path) {
    if (current == null || typeof current !== 'object') return fallback
    current = current[key]
  }
  if (current == null) return fallback
  return String(current)
}

function setNested(target: Record<string, any>, path: string[], value: unknown): void {
  let current: Record<string, any> = target
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    const next = current[key]
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      current[key] = {}
    }
    current = current[key] as Record<string, any>
  }
  current[path[path.length - 1]] = value
}

export function createCustomTemplateFormState(
  baseDetail: OceanEngineAdTemplateDetail | null
): CustomTemplateFormState {
  const projectTemplate = (baseDetail?.project_template ?? {}) as Record<string, any>
  const unitTemplate = (baseDetail?.unit_template ?? {}) as Record<string, any>

  return {
    project: {
      name: readNested(projectTemplate, ['name']),
      budget: readNested(projectTemplate, ['delivery_setting', 'budget'], '300'),
      landingType: readNested(projectTemplate, ['landing_type'], 'MICRO_GAME'),
      marketingGoal: readNested(projectTemplate, ['marketing_goal'], 'VIDEO_AND_IMAGE'),
      microPromotionType: readNested(projectTemplate, ['micro_promotion_type'], 'AWEME'),
      pricing: readNested(projectTemplate, ['delivery_setting', 'pricing'], 'PRICING_OCPM'),
      bidType: readNested(projectTemplate, ['delivery_setting', 'bid_type'], 'CUSTOM'),
      deepBidType: readNested(
        projectTemplate,
        ['delivery_setting', 'deep_bid_type'],
        'ROI_COEFFICIENT'
      ),
      roiGoal: readNested(projectTemplate, ['delivery_setting', 'roi_goal'], '0.9'),
      productPlatformId: readNested(projectTemplate, ['related_product', 'product_platform_id']),
      productId: readNested(projectTemplate, ['related_product', 'product_id']),
      externalAction: readNested(
        projectTemplate,
        ['optimize_goal', 'external_action'],
        'AD_CONVERT_TYPE_ACTIVE'
      ),
      deepExternalAction: readNested(
        projectTemplate,
        ['optimize_goal', 'deep_external_action'],
        'AD_CONVERT_TYPE_LT_ROI'
      ),
      inventoryCatalog: readNested(
        projectTemplate,
        ['delivery_range', 'inventory_catalog'],
        'UNIVERSAL_SMART'
      ),
      gender: readNested(projectTemplate, ['audience', 'gender'], 'NONE'),
      hideIfConverted: readNested(projectTemplate, ['audience', 'hide_if_converted'], 'NO_EXCLUDE')
    },
    unit: {
      name: readNested(unitTemplate, ['name']),
      source: readNested(unitTemplate, ['source'], '番茄'),
      awemeId: readNested(unitTemplate, ['native_setting', 'aweme_id'], '63279742087'),
      playletUrl: readNested(unitTemplate, ['promotion_materials', 'playlet_series_url_list', '0']),
      dramaName: readNested(unitTemplate, ['promotion_materials', 'product_info', 'titles', '0']),
      materialsPerUnit: String(baseDetail?.rules.materials_per_unit_default ?? 10)
    }
  }
}

export function buildCustomTemplatePayload(
  form: CustomTemplateFormState,
  baseDetail: OceanEngineAdTemplateDetail | null
): {
  project: Record<string, unknown>
  promotion: Record<string, unknown>
  materialsPerUnit: number
  dramaName: string
  awemeId: string
  playletUrl: string
} {
  const project = structuredClone((baseDetail?.project_template ?? {}) as Record<string, unknown>)
  const promotion = structuredClone((baseDetail?.unit_template ?? {}) as Record<string, unknown>)

  setNested(project as Record<string, any>, ['name'], form.project.name.trim())
  const budget = parseOptionalInt(form.project.budget)
  if (budget !== undefined) {
    setNested(project as Record<string, any>, ['delivery_setting', 'budget'], budget)
  }
  setNested(project as Record<string, any>, ['landing_type'], form.project.landingType)
  setNested(project as Record<string, any>, ['marketing_goal'], form.project.marketingGoal)
  setNested(
    project as Record<string, any>,
    ['micro_promotion_type'],
    form.project.microPromotionType
  )
  setNested(project as Record<string, any>, ['delivery_setting', 'pricing'], form.project.pricing)
  setNested(project as Record<string, any>, ['delivery_setting', 'bid_type'], form.project.bidType)
  setNested(
    project as Record<string, any>,
    ['delivery_setting', 'deep_bid_type'],
    form.project.deepBidType
  )
  const roiGoal = parseOptionalFloat(form.project.roiGoal)
  if (roiGoal !== undefined) {
    setNested(project as Record<string, any>, ['delivery_setting', 'roi_goal'], roiGoal)
  }
  setNested(
    project as Record<string, any>,
    ['related_product', 'product_platform_id'],
    form.project.productPlatformId.trim()
  )
  setNested(
    project as Record<string, any>,
    ['related_product', 'product_id'],
    form.project.productId.trim()
  )
  setNested(
    project as Record<string, any>,
    ['optimize_goal', 'external_action'],
    form.project.externalAction
  )
  setNested(
    project as Record<string, any>,
    ['optimize_goal', 'deep_external_action'],
    form.project.deepExternalAction
  )
  setNested(
    project as Record<string, any>,
    ['delivery_range', 'inventory_catalog'],
    form.project.inventoryCatalog
  )
  setNested(project as Record<string, any>, ['audience', 'gender'], form.project.gender)
  setNested(
    project as Record<string, any>,
    ['audience', 'hide_if_converted'],
    form.project.hideIfConverted
  )

  setNested(promotion as Record<string, any>, ['name'], form.unit.name.trim())
  setNested(promotion as Record<string, any>, ['source'], form.unit.source.trim())
  setNested(
    promotion as Record<string, any>,
    ['native_setting', 'aweme_id'],
    form.unit.awemeId.trim()
  )
  setNested(
    promotion as Record<string, any>,
    ['promotion_materials', 'playlet_series_url_list'],
    [form.unit.playletUrl.trim()]
  )
  setNested(
    promotion as Record<string, any>,
    ['promotion_materials', 'product_info', 'titles'],
    [form.unit.dramaName.trim()]
  )

  return {
    project,
    promotion,
    materialsPerUnit: Number.parseInt(form.unit.materialsPerUnit, 10) || 10,
    dramaName: form.unit.dramaName.trim(),
    awemeId: form.unit.awemeId.trim(),
    playletUrl: form.unit.playletUrl.trim()
  }
}

function getFieldValue(form: CustomTemplateFormState, path: FieldPath): string {
  const [scope, key] = path.split('.') as ['project' | 'unit', string]
  return String(form[scope][key as keyof (typeof form)[typeof scope]] ?? '')
}

interface CustomTemplateConfiguratorProps {
  templateOptions: OceanEngineAdTemplateSummary[]
  baseTemplateCode: string
  onBaseTemplateCodeChange: (value: string) => void
  baseTemplateDetail: OceanEngineAdTemplateDetail | null
  value: CustomTemplateFormState
  onChange: (value: CustomTemplateFormState) => void
  productSearching: boolean
  committedVideosCount: number
  onOpenVideoSelector: () => void
  sectionScope?: 'all' | 'project' | 'unit' | 'preview'
  projectConfigMode?: 'openapi' | 'web'
  hidePlayletPromotionFields?: boolean
  hideProductNameField?: boolean
  awemeOptions?: AwemeOption[]
  awemeLoading?: boolean
  awemeSourceAdvertiserId?: string
  onRefreshAwemeOptions?: () => void
  selectedCustomTemplate?: OceanEngineCustomAdTemplate | null
  onSelectCustomTemplate?: (template: OceanEngineCustomAdTemplate) => void
  onCreateNewCustomTemplate?: () => void
  customTemplateOptions?: OceanEngineCustomAdTemplate[]
  onSaveCustomTemplate?: (mode: 'create' | 'update') => void
  onDeleteCustomTemplate?: () => void
  onValidateCustomTemplate?: () => void
  customTemplateSaving?: boolean
  customTemplateValidating?: boolean
  validationErrors?: { field: string; message: string; code: string }[]
  productPlatformLibraries?: { product_platform_id: string; name: string }[]
  productPlatformLibrariesLoading?: boolean
  showMissingProductPlatformOption?: boolean
}

export const CustomTemplateConfigurator: React.FC<CustomTemplateConfiguratorProps> = ({
  templateOptions,
  baseTemplateCode,
  onBaseTemplateCodeChange,
  baseTemplateDetail,
  value,
  onChange,
  productSearching,
  committedVideosCount,
  onOpenVideoSelector,
  sectionScope = 'all',
  projectConfigMode = 'openapi',
  hidePlayletPromotionFields = false,
  hideProductNameField = false,
  awemeOptions = [],
  awemeLoading = false,
  awemeSourceAdvertiserId = '',
  onRefreshAwemeOptions,
  selectedCustomTemplate = null,
  onSelectCustomTemplate,
  onCreateNewCustomTemplate,
  customTemplateOptions = [],
  onSaveCustomTemplate,
  onDeleteCustomTemplate,
  onValidateCustomTemplate,
  customTemplateSaving = false,
  customTemplateValidating = false,
  validationErrors = [],
  productPlatformLibraries,
  productPlatformLibrariesLoading = false,
  showMissingProductPlatformOption = false
}) => {
  const preview = useMemo(
    () => buildCustomTemplatePayload(value, baseTemplateDetail),
    [baseTemplateDetail, value]
  )
  const [previewTab, setPreviewTab] = React.useState<'project' | 'unit'>('project')
  const usesWebProjectConfig = projectConfigMode === 'web'

  React.useEffect(() => {
    if (usesWebProjectConfig && previewTab === 'project') {
      setPreviewTab('unit')
    }
  }, [previewTab, usesWebProjectConfig])

  const availableDeepGoalOptions =
    DEEP_GOAL_OPTIONS_BY_EXTERNAL_ACTION[value.project.externalAction] ??
    DEEP_GOAL_OPTIONS_BY_EXTERNAL_ACTION.AD_CONVERT_TYPE_ACTIVE
  const availableDeepBidOptions =
    DEEP_BID_OPTIONS_BY_DEEP_GOAL[value.project.deepExternalAction] ??
    DEEP_BID_OPTIONS_BY_DEEP_GOAL.AD_CONVERT_TYPE_LT_ROI

  React.useEffect(() => {
    if (!availableDeepGoalOptions.some((item) => item.value === value.project.deepExternalAction)) {
      const fallback = availableDeepGoalOptions[0]?.value
      if (!fallback) return
      onChange({
        ...value,
        project: {
          ...value.project,
          deepExternalAction: fallback
        }
      })
      return
    }
    if (!availableDeepBidOptions.some((item) => item.value === value.project.deepBidType)) {
      const fallback = availableDeepBidOptions[0]?.value
      if (!fallback) return
      onChange({
        ...value,
        project: {
          ...value.project,
          deepBidType: fallback
        }
      })
    }
  }, [
    availableDeepBidOptions,
    availableDeepGoalOptions,
    onChange,
    value,
    value.project.deepBidType,
    value.project.deepExternalAction
  ])

  const updateField = (path: FieldPath, nextValue: string): void => {
    const [scope, key] = path.split('.') as ['project' | 'unit', string]
    onChange({
      ...value,
      [scope]: {
        ...value[scope],
        [key]: nextValue
      }
    })
  }

  const renderField = (field: CustomTemplateField): React.ReactNode => {
    const currentValue = getFieldValue(value, field.path)
    const dynamicOptions =
      field.path === 'project.deepExternalAction'
        ? availableDeepGoalOptions
        : field.path === 'project.deepBidType'
          ? availableDeepBidOptions
          : field.options

    if (field.type === 'choice' && dynamicOptions) {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {dynamicOptions.map((option) => {
            const active = currentValue === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField(field.path, option.value)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/50'
                    : 'border-border/70 bg-background hover:border-primary/40 hover:bg-accent/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{option.label}</span>
                  {active && <ChevronRight className="h-4 w-4 text-primary" />}
                </div>
                {option.description && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )
    }

    if (field.path === 'project.productPlatformId' && productPlatformLibraries !== undefined) {
      const libs = productPlatformLibraries
      return (
        <div className="space-y-1">
          <div className="relative">
            <select
              value={currentValue}
              onChange={(event) => updateField(field.path, event.target.value)}
              disabled={productPlatformLibrariesLoading}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {productPlatformLibrariesLoading
                  ? '正在拉取商品库…'
                  : libs.length === 0
                    ? '暂无商品库，请先选择 OAuth 组织'
                    : '请选择商品库'}
              </option>
              {currentValue &&
                showMissingProductPlatformOption &&
                !productPlatformLibrariesLoading &&
                libs.length === 0 && (
                  <option value={currentValue}>当前值（列表中暂无）{currentValue}</option>
                )}
              {libs.map((p) => (
                <option key={p.product_platform_id} value={p.product_platform_id}>
                  {p.name}（{p.product_platform_id}）
                </option>
              ))}
            </select>
            {productPlatformLibrariesLoading && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            来自巨量 v3.0/dpa/ebp/library/list，选择后用于查询商品与项目关联商品。
          </p>
        </div>
      )
    }

    if (field.path === 'unit.awemeId') {
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">投放身份（抖音号）</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefreshAwemeOptions}
              disabled={awemeLoading || !onRefreshAwemeOptions}
              className="h-6 px-2 text-[11px]"
            >
              {awemeLoading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              刷新
            </Button>
          </div>
          <div className="relative">
            <select
              value={currentValue}
              onChange={(event) => updateField(field.path, event.target.value)}
              disabled={awemeLoading || awemeOptions.length === 0}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {awemeOptions.length === 0 ? (
                <option value={currentValue}>
                  {awemeLoading ? '正在拉取授权抖音号…' : currentValue || '暂无可选授权抖音号'}
                </option>
              ) : (
                awemeOptions.map((option) => (
                  <option key={option.awemeId} value={option.awemeId}>
                    {option.awemeName ? `${option.awemeName}（${option.awemeId}）` : option.awemeId}
                  </option>
                ))
              )}
            </select>
            {awemeLoading && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {awemeSourceAdvertiserId
              ? `使用首个广告账户 ${awemeSourceAdvertiserId} 拉取，默认选择第一条授权关系。`
              : '填写广告主账户后自动拉取授权抖音号。'}
          </p>
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={currentValue}
          onChange={(event) => updateField(field.path, event.target.value)}
          placeholder={field.placeholder}
          className="min-h-[84px] text-sm"
        />
      )
    }

    return (
      <Input
        type={field.type === 'number' ? 'number' : 'text'}
        value={currentValue}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(event) => updateField(field.path, event.target.value)}
        placeholder={field.placeholder}
        className={field.path === 'project.productId' && productSearching ? 'pr-8' : ''}
      />
    )
  }

  const allSections = useMemo(() => {
    const hiddenUnitFieldPaths = new Set<FieldPath>([
      ...(hidePlayletPromotionFields ? (['unit.playletUrl', 'unit.source'] as FieldPath[]) : []),
      ...(hideProductNameField ? (['unit.dramaName'] as FieldPath[]) : [])
    ])
    const unitSections = hiddenUnitFieldPaths.size > 0
      ? UNIT_SECTIONS.map((section) => ({
          ...section,
          fields: section.fields.filter((field) => !hiddenUnitFieldPaths.has(field.path))
        }))
      : UNIT_SECTIONS
    if (sectionScope === 'project') return usesWebProjectConfig ? [] : PROJECT_SECTIONS
    if (sectionScope === 'unit') return unitSections
    if (sectionScope === 'preview') return []
    return usesWebProjectConfig ? unitSections : [...PROJECT_SECTIONS, ...unitSections]
  }, [hidePlayletPromotionFields, hideProductNameField, sectionScope, usesWebProjectConfig])
  const showBaseTemplateSelector = sectionScope === 'all' || sectionScope === 'project'
  const showPreview = sectionScope === 'all' || sectionScope === 'preview'

  return (
    <div></div>
    // <div className="space-y-5">
    //   {showBaseTemplateSelector && (
    //     <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(14,165,233,0.02))]">
    //       <CardHeader className="gap-3">
    //         <div className="flex items-center gap-3">
    //           <div className="rounded-2xl border border-primary/20 bg-background/80 p-3">
    //             <Sparkles className="h-5 w-5 text-primary" />
    //           </div>
    //           <div>
    //             <CardTitle className="text-base">自定义模板工作区</CardTitle>
    //             <CardDescription>
    //               {usesWebProjectConfig
    //                 ? '项目使用网页新建数据包创建；自定义模板负责组织 promotion/create 广告单元参数。'
    //                 : '保存完整 project/create 与 promotion/create 参数；可从系统模板初始化，也可加载“我的模板”后继续编辑。'}
    //             </CardDescription>
    //           </div>
    //         </div>
    //       </CardHeader>
    //       <CardContent className="space-y-4">
    //         {customTemplateOptions.length > 0 && (
    //           <div className="space-y-2">
    //             <Label>我的模板</Label>
    //             <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    //               {customTemplateOptions.map((item) => {
    //                 const active = selectedCustomTemplate?.id === item.id
    //                 return (
    //                   <button
    //                     key={item.id}
    //                     type="button"
    //                     onClick={() => onSelectCustomTemplate?.(item)}
    //                     className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
    //                       active
    //                         ? 'border-primary bg-background ring-1 ring-primary/60'
    //                         : 'border-border/70 bg-background/80 hover:border-primary/30 hover:bg-background'
    //                     }`}
    //                   >
    //                     <div className="text-sm font-medium">{item.name}</div>
    //                     <div className="mt-2 flex flex-wrap gap-1.5">
    //                       {(item.tags.length > 0 ? item.tags : ['自定义']).map((tag) => (
    //                         <span
    //                           key={tag}
    //                           className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
    //                         >
    //                           {tag}
    //                         </span>
    //                       ))}
    //                     </div>
    //                   </button>
    //                 )
    //               })}
    //             </div>
    //           </div>
    //         )}
    //         <div className="flex flex-wrap items-center gap-2">
    //           <Button type="button" size="sm" variant="outline" onClick={onCreateNewCustomTemplate}>
    //             新建临时模板
    //           </Button>
    //           <Button
    //             type="button"
    //             size="sm"
    //             variant="outline"
    //             onClick={() => onSaveCustomTemplate?.('create')}
    //             disabled={customTemplateSaving}
    //           >
    //             {customTemplateSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
    //             保存为模板
    //           </Button>
    //           {selectedCustomTemplate && (
    //             <>
    //               <Button
    //                 type="button"
    //                 size="sm"
    //                 variant="outline"
    //                 onClick={() => onSaveCustomTemplate?.('update')}
    //                 disabled={customTemplateSaving}
    //               >
    //                 更新模板
    //               </Button>
    //               <Button
    //                 type="button"
    //                 size="sm"
    //                 variant="outline"
    //                 onClick={onDeleteCustomTemplate}
    //                 disabled={customTemplateSaving}
    //               >
    //                 删除模板
    //               </Button>
    //             </>
    //           )}
    //           <Button
    //             type="button"
    //             size="sm"
    //             variant="outline"
    //             onClick={onValidateCustomTemplate}
    //             disabled={customTemplateValidating}
    //           >
    //             {customTemplateValidating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
    //             校验参数
    //           </Button>
    //         </div>
    //         {validationErrors.length > 0 && (
    //           <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
    //             <div className="font-medium text-destructive">参数校验未通过</div>
    //             <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
    //               {validationErrors.slice(0, 8).map((error) => (
    //                 <li key={`${error.field}-${error.code}-${error.message}`}>
    //                   <span className="font-mono text-xs">{error.field}</span>：{error.message}
    //                 </li>
    //               ))}
    //             </ul>
    //           </div>
    //         )}
    //         {usesWebProjectConfig && (
    //           <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
    //             当前自定义模板采用网页新建项目模式：项目参数来自“项目配置 → 网页新建”捕获的数据包，保存模板时保留基础项目骨架仅用于兼容校验；实际批量创建项目以网页数据包为准。
    //           </div>
    //         )}
    //         <div className="space-y-2">
    //           <Label>从系统模板初始化</Label>
    //           <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    //             {templateOptions.map((item) => {
    //               const active = baseTemplateCode === item.meta.code
    //               return (
    //                 <button
    //                   key={item.meta.code}
    //                   type="button"
    //                   onClick={() => onBaseTemplateCodeChange(item.meta.code)}
    //                   className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
    //                     active
    //                       ? 'border-primary bg-background ring-1 ring-primary/60'
    //                       : 'border-border/70 bg-background/80 hover:border-primary/30 hover:bg-background'
    //                   }`}
    //                 >
    //                   <div className="flex items-center justify-between gap-3">
    //                     <div className="flex items-center gap-2">
    //                       <Layers3 className="h-4 w-4 text-primary" />
    //                       <span className="text-sm font-medium">{item.meta.label}</span>
    //                     </div>
    //                     {active && <CopyPlus className="h-4 w-4 text-primary" />}
    //                   </div>
    //                   <div className="mt-2 flex flex-wrap gap-1.5">
    //                     {item.meta.tags.map((tag) => (
    //                       <span
    //                         key={tag}
    //                         className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
    //                       >
    //                         {tag}
    //                       </span>
    //                     ))}
    //                   </div>
    //                 </button>
    //               )
    //             })}
    //           </div>
    //         </div>

    //         <div className="rounded-2xl border border-dashed border-primary/30 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
    //           当前编辑参数来自{' '}
    //           <span className="font-medium text-foreground">
    //             {selectedCustomTemplate?.name ?? baseTemplateDetail?.meta.label ?? '空白模板'}
    //           </span>{' '}
    //           ，保存后会作为用户私有模板直接调用，不依赖系统模板继承。
    //         </div>
    //       </CardContent>
    //     </Card>
    //   )}

    //   {allSections.map((section) => (
    //     <Card key={section.key} className="border-border/70 bg-card/95">
    //       <CardHeader>
    //         <CardTitle className="text-base">{section.title}</CardTitle>
    //         <CardDescription>{section.description}</CardDescription>
    //       </CardHeader>
    //       <CardContent>
    //         <div className="grid gap-4 md:grid-cols-2">
    //           {section.fields.map((field) => (
    //             <div
    //               key={field.path}
    //               className={
    //                 field.type === 'textarea' || field.type === 'choice'
    //                   ? 'md:col-span-2 space-y-2'
    //                   : 'space-y-2'
    //               }
    //             >
    //               <div className="space-y-1">
    //                 <Label>{field.label}</Label>
    //                 {field.description && (
    //                   <p className="text-xs leading-5 text-muted-foreground">
    //                     {field.description}
    //                     {(field.path === 'project.deepExternalAction' ||
    //                       field.path === 'project.deepBidType') && (
    //                       <span className="ml-1 text-primary/80">（由当前配置自动约束）</span>
    //                     )}
    //                   </p>
    //                 )}
    //               </div>
    //               {renderField(field)}
    //             </div>
    //           ))}
    //         </div>
    //       </CardContent>
    //     </Card>
    //   ))}

    //   {showPreview && (
    //     <Card className="border-border/70 bg-card/95">
    //       <CardHeader className="flex flex-row items-center justify-between gap-4">
    //         <div>
    //           <CardTitle className="text-base">素材与预览</CardTitle>
    //           <CardDescription>
    //             批量能力继续保留在工作台里，自定义模板只负责把参数组织得更像原生创建页。
    //           </CardDescription>
    //         </div>
    //         <Button type="button" variant="outline" onClick={onOpenVideoSelector}>
    //           打开视频素材选择器
    //         </Button>
    //       </CardHeader>
    //       <CardContent className="space-y-4">
    //         <div className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
    //           已确认视频素材{' '}
    //           <span className="font-semibold text-foreground">{committedVideosCount}</span> 个，
    //           将按{' '}
    //           <span className="font-semibold text-foreground">
    //             {value.unit.materialsPerUnit || '10'}
    //           </span>{' '}
    //           个/单元自动拆分。
    //         </div>

    //         <Tabs
    //           value={previewTab}
    //           onValueChange={(next) => setPreviewTab(next as 'project' | 'unit')}
    //         >
    //           <TabsList className={`grid w-full ${usesWebProjectConfig ? 'grid-cols-1' : 'grid-cols-2'}`}>
    //             {!usesWebProjectConfig && <TabsTrigger value="project">项目 JSON 预览</TabsTrigger>}
    //             <TabsTrigger value="unit">单元 JSON 预览</TabsTrigger>
    //           </TabsList>
    //           {!usesWebProjectConfig && (
    //             <TabsContent value="project">
    //               <Textarea
    //                 readOnly
    //                 value={JSON.stringify(preview.project, null, 2)}
    //                 className="min-h-[320px] font-mono text-xs"
    //               />
    //             </TabsContent>
    //           )}
    //           <TabsContent value="unit">
    //             <Textarea
    //               readOnly
    //               value={JSON.stringify(preview.promotion, null, 2)}
    //               className="min-h-[320px] font-mono text-xs"
    //             />
    //           </TabsContent>
    //         </Tabs>
    //       </CardContent>
    //     </Card>
    //   )}
    // </div>
  )
}
