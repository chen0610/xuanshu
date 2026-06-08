import React from 'react'
import { Loader2, RefreshCw, Wand2 } from 'lucide-react'
import { Button, Input, Label, Textarea, RadioGroup, RadioGroupItem } from '../../../components/ui'

export type QuickConfigSection = 'campaign' | 'project' | 'unit' | 'materialHint'
export type VideoMaterialDistributionMode = 'full' | 'average'
export type ProjectMode = 'new' | 'existing' | 'web'

export interface AwemeOption {
  awemeId: string
  awemeName: string
  authType?: string | null
  authStatus?: string | null
}

interface QuickConfigCardProps {
  templateType: string
  dramaName: string
  onDramaNameChange: (value: string) => void
  promoAwemeId: string
  onPromoAwemeIdChange: (value: string) => void
  promoPlayletUrl: string
  onPromoPlayletUrlChange: (value: string) => void
  roiCoeff: string
  onRoiCoeffChange: (value: string) => void
  supportsRoiGoal?: boolean
  cpaBid?: string
  onCpaBidChange?: (value: string) => void
  supportsCpaBid?: boolean
  committedVideosCount: number
  materialsPerUnit: number
  onOpenVideoSelector: () => void
  projName: string
  onProjNameChange: (value: string) => void
  projBudget: string
  onProjBudgetChange: (value: string) => void
  projProductPlatformId: string
  onProjProductPlatformIdChange: (value: string) => void
  /** 可选：来自 v3.0/dpa/ebp/library/list，用于商品库下拉 */
  productPlatformLibraries?: { product_platform_id: string; name: string }[]
  productPlatformLibrariesLoading?: boolean
  showMissingProductPlatformOption?: boolean
  projProductId: string
  onProjProductIdChange: (value: string) => void
  productSearching: boolean
  promoName: string
  onPromoNameChange: (value: string) => void
  onMaterialsPerUnitChange: (value: string) => void
  /** 新建项目 / 已有项目 / 网页新建 */
  projectMode: ProjectMode
  onProjectModeChange: (mode: ProjectMode) => void
  /** 选择「已有项目」时显示：拉取列表、勾选等 */
  existingProjectBlock?: React.ReactNode
  /** 选择「网页新建」时显示：打开网页、采集数据包等 */
  webProjectBlock?: React.ReactNode
  sections?: QuickConfigSection[]
  awemeOptions?: AwemeOption[]
  awemeLoading?: boolean
  awemeSourceAdvertiserId?: string
  onRefreshAwemeOptions?: () => void
  /** 默认 true；若为 false，不在「投放快捷配置」中渲染漫剧名称（由页面其他区域填写） */
  showDramaNameInCampaign?: boolean
  hidePlayletPromotionFields?: boolean
  namePlaceholderTemplate?: string
}

const DEFAULT_SECTIONS: QuickConfigSection[] = ['campaign', 'project', 'unit', 'materialHint']

export const QuickConfigCard: React.FC<QuickConfigCardProps> = ({
  templateType,
  dramaName,
  onDramaNameChange,
  promoAwemeId,
  onPromoAwemeIdChange,
  promoPlayletUrl,
  onPromoPlayletUrlChange,
  roiCoeff,
  onRoiCoeffChange,
  supportsRoiGoal = templateType === 'puju',
  cpaBid = '',
  onCpaBidChange,
  supportsCpaBid = false,
  committedVideosCount,
  materialsPerUnit,
  onOpenVideoSelector,
  projName,
  onProjNameChange,
  projBudget,
  onProjBudgetChange,
  projProductPlatformId,
  onProjProductPlatformIdChange,
  productPlatformLibraries = [],
  productPlatformLibrariesLoading = false,
  showMissingProductPlatformOption = false,
  projProductId,
  onProjProductIdChange,
  productSearching,
  promoName,
  onPromoNameChange,
  onMaterialsPerUnitChange,
  projectMode,
  onProjectModeChange,
  existingProjectBlock,
  webProjectBlock,
  sections = DEFAULT_SECTIONS,
  awemeOptions = [],
  awemeLoading = false,
  awemeSourceAdvertiserId = '',
  onRefreshAwemeOptions,
  showDramaNameInCampaign = true,
  hidePlayletPromotionFields = false,
  namePlaceholderTemplate = ''
}) => {
  const enabledSections = new Set(sections)

  return (
    <>
      {enabledSections.has('campaign') && (
        <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">投放快捷配置</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {showDramaNameInCampaign && (
              <div className="space-y-1">
                <Label className="text-xs">漫剧名称</Label>
                <Input
                  value={dramaName}
                  onChange={(e) => onDramaNameChange(e.target.value)}
                  placeholder="输入漫剧名称"
                />
              </div>
            )}
            <div
              className={`space-y-1 ${!showDramaNameInCampaign ? 'md:col-span-2' : ''}`}
            >
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
              <select
                value={promoAwemeId}
                onChange={(e) => onPromoAwemeIdChange(e.target.value)}
                disabled={awemeLoading || awemeOptions.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {awemeOptions.length === 0 ? (
                  <option value={promoAwemeId}>
                    {awemeLoading ? '正在拉取授权抖音号…' : promoAwemeId || '暂无可选授权抖音号'}
                  </option>
                ) : (
                  awemeOptions.map((option) => (
                    <option key={option.awemeId} value={option.awemeId}>
                      {option.awemeName
                        ? `${option.awemeName}（${option.awemeId}）`
                        : option.awemeId}
                    </option>
                  ))
                )}
              </select>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {awemeSourceAdvertiserId
                  ? `使用首个广告账户 ${awemeSourceAdvertiserId} 拉取，默认选择第一条授权关系。`
                  : '填写广告主账户后自动拉取授权抖音号。'}
              </p>
            </div>
            {!hidePlayletPromotionFields && (
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">落地页链接</Label>
                <Textarea
                  className="font-mono text-xs min-h-[60px]"
                  value={promoPlayletUrl}
                  onChange={(e) => onPromoPlayletUrlChange(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {enabledSections.has('project') && (
        <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">项目来源（项目维度）</Label>
            <RadioGroup
              className="grid gap-2 md:grid-cols-3"
              value={projectMode}
              onValueChange={(v) => onProjectModeChange(v as ProjectMode)}
            >
              <label
                htmlFor="pm-new"
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                  projectMode === 'new'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                    : 'hover:bg-background/80'
                }`}
              >
                <RadioGroupItem value="new" id="pm-new" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">新建项目</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    使用下方项目参数创建 project
                  </span>
                </span>
              </label>
              <label
                htmlFor="pm-ex"
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                  projectMode === 'existing'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                    : 'hover:bg-background/80'
                }`}
              >
                <RadioGroupItem value="existing" id="pm-ex" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">已有项目</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    拉取后按广告主勾选，提交时跳过 project/create
                  </span>
                </span>
              </label>
              <label
                htmlFor="pm-web"
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                  projectMode === 'web'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                    : 'hover:bg-background/80'
                }`}
              >
                <RadioGroupItem value="web" id="pm-web" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">网页新建</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    网页创建项目并回填 project_id，广告单元仍使用当前投放模板参数
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
          {projectMode === 'existing' && existingProjectBlock}
          {projectMode === 'web' && webProjectBlock}
        </div>
      )}

      {enabledSections.has('project') && projectMode === 'new' && (
        <div className="grid grid-cols-1 gap-3 p-4 rounded-2xl border bg-muted/30 md:grid-cols-2">
          <p className="text-xs text-muted-foreground md:col-span-2">项目快捷参数</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">项目名称</Label>
              {namePlaceholderTemplate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onProjNameChange(namePlaceholderTemplate)}
                >
                  <Wand2 className="mr-1 h-3.5 w-3.5" />
                  填入初始格式
                </Button>
              )}
            </div>
            <Input
              value={projName}
              onChange={(e) => onProjNameChange(e.target.value)}
              placeholder="输入项目名称"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">日预算</Label>
            <Input
              type="number"
              min={100}
              value={projBudget}
              onChange={(e) => onProjBudgetChange(e.target.value)}
              placeholder="300"
            />
          </div>
          {supportsCpaBid && (
            <div className="space-y-1">
              <Label className="text-xs">出价</Label>
              <Input
                type="number"
                step="0.01"
                min={0.1}
                value={cpaBid}
                onChange={(e) => {
                  const value = e.target.value
                  if (/^\d*(?:\.\d{0,2})?$/.test(value)) {
                    onCpaBidChange?.(value)
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="20"
              />
            </div>
          )}
          {supportsRoiGoal && (
            <div className="space-y-1">
              <Label className="text-xs">ROI 系数</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={roiCoeff}
                onChange={(e) => {
                  const value = e.target.value
                  if (/^\d*(?:\.\d{0,3})?$/.test(value)) {
                    onRoiCoeffChange(value)
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.9"
              />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">商品库（product_platform_id）</Label>
              {productPlatformLibrariesLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <select
              value={projProductPlatformId}
              onChange={(e) => onProjProductPlatformIdChange(e.target.value)}
              disabled={productPlatformLibrariesLoading}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {productPlatformLibrariesLoading
                  ? '正在拉取商品库…'
                  : productPlatformLibraries.length === 0
                    ? '暂无商品库，请先选择 OAuth 组织或确认升级版 EBP 权限'
                    : '请选择商品库'}
              </option>
              {projProductPlatformId &&
                showMissingProductPlatformOption &&
                !productPlatformLibrariesLoading &&
                productPlatformLibraries.length === 0 && (
                  <option value={projProductPlatformId}>
                    当前值（列表中暂无）{projProductPlatformId}
                  </option>
                )}
              {productPlatformLibraries.map((p) => (
                <option key={p.product_platform_id} value={p.product_platform_id}>
                  {p.name}（{p.product_platform_id}）
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-4 text-muted-foreground">
              选择 OAuth 组织后自动拉取升级版商品库列表；与巨量文档 v3.0/dpa/ebp/library/list 一致。
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">商品 ID</Label>
            <div className="relative">
              <Input
                value={projProductId}
                onChange={(e) => onProjProductIdChange(e.target.value)}
                placeholder={productSearching ? '查询中…' : '输入漫剧名称后自动填入'}
                className={productSearching ? 'pr-8' : ''}
              />
              {productSearching && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* {enabledSections.has('materialHint') && (
        <div className="flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-xs">
          <span className="text-muted-foreground">视频素材：</span>
          {committedVideosCount > 0 ? (
            <span className="text-green-600 font-medium">
              已确认 {committedVideosCount} 个，提交时将创建{' '}
              {Math.ceil(committedVideosCount / materialsPerUnit)} 个单元
            </span>
          ) : (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={onOpenVideoSelector}
            >
              暂未选择，点此展开选择器
            </button>
          )}
        </div>
      )} */}

      {enabledSections.has('unit') && (
        <div className="grid grid-cols-1 gap-3 p-4 rounded-2xl border bg-muted/30 md:grid-cols-2">
          <p className="text-xs text-muted-foreground md:col-span-2">单元参数</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">单元名称</Label>
              {namePlaceholderTemplate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onPromoNameChange(namePlaceholderTemplate)}
                >
                  <Wand2 className="mr-1 h-3.5 w-3.5" />
                  填入初始格式
                </Button>
              )}
            </div>
            <Input
              value={promoName}
              onChange={(e) => onPromoNameChange(e.target.value)}
              placeholder="输入广告单元名称"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">每单元素材数</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={materialsPerUnit}
              onChange={(e) => onMaterialsPerUnitChange(e.target.value)}
              placeholder="10"
            />
          </div>
        </div>
      )}
    </>
  )
}
