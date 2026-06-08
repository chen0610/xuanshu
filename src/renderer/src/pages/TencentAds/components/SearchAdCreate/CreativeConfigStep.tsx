import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label,
  Input,
  Textarea,
  Button,
  Switch
} from '../../../../components/ui'
import { Image, Trash2, Video } from 'lucide-react'
import type { SearchAdFormData } from '../../SearchAdCreatePage'
import { searchAdCreateService } from '../../../../services/tencent-ads.service'
import { MediaPickerModal } from './MediaPickerModal'

// 将 http URL 转换为 https，以符合 CSP 策略
const convertToHttps = (url: string): string => {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

interface CreativeConfigStepProps {
  formData: SearchAdFormData
  onUpdate: (updates: Partial<SearchAdFormData>) => void
  onValidate: (valid: boolean) => void
}

export const CreativeConfigStep: React.FC<CreativeConfigStepProps> = ({
  formData,
  onUpdate,
  onValidate
}) => {
  const [brandImages, setBrandImages] = useState<
    Array<{ brand_name: string; brand_image_id: string }>
  >([])
  const [loadingBrandImages, setLoadingBrandImages] = useState(false)
  const [showMediaPickerStep1, setShowMediaPickerStep1] = useState(false) // 第一步：横屏视频
  const [showMediaPickerStep2, setShowMediaPickerStep2] = useState(false) // 第二步：所有素材
  const [titlePool, setTitlePool] = useState<string[]>([])
  const [loadingTitlePool, setLoadingTitlePool] = useState(false)
  // 使用本地状态保存用户输入的原始文本，允许换行
  const [titlesText, setTitlesText] = useState(formData.titles.join('\n'))
  const [descriptionsText, setDescriptionsText] = useState(formData.descriptions.join('\n'))

  // 当 formData 从外部更新时，同步本地状态
  useEffect(() => {
    setTitlesText(formData.titles.join('\n'))
  }, [formData.titles])

  useEffect(() => {
    setDescriptionsText(formData.descriptions.join('\n'))
  }, [formData.descriptions])

  // 加载标题包
  useEffect(() => {
    const loadTitlePool = async (): Promise<void> => {
      try {
        setLoadingTitlePool(true)
        const response = await searchAdCreateService.getTitlePool()
        if (response.code === 0 && response.data?.title_pool) {
          setTitlePool(response.data.title_pool)
        }
      } catch (error) {
        console.error('Failed to load title pool:', error)
      } finally {
        setLoadingTitlePool(false)
      }
    }

    loadTitlePool()
  }, [])

  // 加载品牌形象列表
  useEffect(() => {
    const loadBrandImages = async (): Promise<void> => {
      if (!formData.advertiserId || !formData.cookieConfigId) return

      try {
        setLoadingBrandImages(true)
        // 获取第一个账户ID
        const accountIds = formData.advertiserId
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)

        if (accountIds.length === 0) return

        const firstAccountId = parseInt(accountIds[0], 10)
        if (isNaN(firstAccountId)) return

        const response = await searchAdCreateService.getBrandImages({
          advertiser_id: firstAccountId,
          selected_cookie_id: formData.cookieConfigId
        })

        if (response.code === 0 && response.data?.list) {
          setBrandImages(response.data.list)
          // 如果还没有选择品牌形象，默认选中第一个
          if (!formData.brandImageId && response.data.list.length > 0) {
            onUpdate({
              brandImageId: response.data.list[0].brand_image_id,
              brandName: response.data.list[0].brand_name
            })
          }
        }
      } catch (error) {
        console.error('Failed to load brand images:', error)
      } finally {
        setLoadingBrandImages(false)
      }
    }

    loadBrandImages()
  }, [formData.advertiserId, formData.cookieConfigId])

  // 当自动挑选标题开关或账户ID变化时，重新分配标题
  useEffect(() => {
    if (!formData.autoSelectTitles || !formData.advertiserId) {
      // 如果关闭了自动挑选，清空accountTitles
      if (!formData.autoSelectTitles && Object.keys(formData.accountTitles).length > 0) {
        onUpdate({ accountTitles: {} })
      }
      return
    }

    // 如果标题包为空，清空accountTitles并返回
    if (titlePool.length === 0) {
      console.warn('标题包为空，无法分配标题')
      if (Object.keys(formData.accountTitles).length > 0) {
        onUpdate({ accountTitles: {} })
      }
      return
    }

    // 解析账户ID列表
    const accountIds = formData.advertiserId
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id))

    if (accountIds.length === 0) {
      if (Object.keys(formData.accountTitles).length > 0) {
        onUpdate({ accountTitles: {} })
      }
      return
    }

    // 为每个账户随机选择3个不重复的标题
    const accountTitles: Record<string, string[]> = {}

    accountIds.forEach((accountId) => {
      // 如果标题包数量少于3个，使用所有标题
      if (titlePool.length <= 3) {
        accountTitles[accountId.toString()] = [...titlePool]
      } else {
        // 随机选择3个不重复的标题
        const shuffled = [...titlePool].sort(() => Math.random() - 0.5)
        accountTitles[accountId.toString()] = shuffled.slice(0, 3)
      }

      // 确保每个账户至少有一个标题
      if (accountTitles[accountId.toString()].length === 0) {
        console.error(`账户 ${accountId} 分配到的标题列表为空`)
      }
    })

    // 验证所有账户都有标题
    const allHaveTitles = Object.values(accountTitles).every((titles) => titles.length > 0)
    if (!allHaveTitles) {
      console.error('部分账户的标题列表为空:', accountTitles)
    }

    onUpdate({ accountTitles })
  }, [formData.autoSelectTitles, formData.advertiserId, titlePool])

  // 处理标题输入：只更新本地状态，允许换行
  const handleTitlesChange = (value: string): void => {
    setTitlesText(value)
  }

  // 处理标题失去焦点：将多行文本按行分割，过滤空行，限制每行30字，最多20行
  const handleTitlesBlur = (): void => {
    const lines = titlesText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.substring(0, 30)) // 限制每行最多30字
      .slice(0, 20) // 最多20行
    onUpdate({ titles: lines })
    // 更新本地状态为处理后的结果
    setTitlesText(lines.join('\n'))
  }

  // 处理描述输入：只更新本地状态，允许换行
  const handleDescriptionsChange = (value: string): void => {
    setDescriptionsText(value)
  }

  // 处理描述失去焦点：将多行文本按行分割，过滤空行，限制每行80字，最多20行
  const handleDescriptionsBlur = (): void => {
    const lines = descriptionsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.substring(0, 80)) // 限制每行最多80字
      .slice(0, 20) // 最多20行
    onUpdate({ descriptions: lines })
    // 更新本地状态为处理后的结果
    setDescriptionsText(lines.join('\n'))
  }

  React.useEffect(() => {
    // 如果启用自动挑选标题，检查accountTitles是否有数据
    const titlesValid = formData.autoSelectTitles
      ? Object.keys(formData.accountTitles).length > 0 &&
        Object.values(formData.accountTitles).every((titles) => titles.length > 0)
      : formData.titles.length > 0

    // 第一步至少有一个横屏视频素材
    const materialsValid = formData.step1Materials.length > 0

    const valid =
      formData.adgroupName !== '' &&
      formData.creativeName !== '' &&
      titlesValid &&
      formData.brandImageId !== null &&
      materialsValid
    onValidate(valid)
  }, [
    formData.adgroupName,
    formData.creativeName,
    formData.titles,
    formData.autoSelectTitles,
    formData.accountTitles,
    formData.brandImageId,
    formData.step1Materials,
    onValidate
  ])

  // 第一步素材确认：横屏视频
  const handleStep1MediaConfirm = (
    selectedMedia: Array<{
      media_id: string
      media_description: string
      base_media_url: string
      key_frame_image_url: string
      cover_image_id: string
      video_width?: number
      video_height?: number
    }>
  ): void => {
    // 合并新选择的素材与已有的素材，去重
    const existingMediaIds = new Set(formData.step1Materials.map((m) => m.media_id))
    const newMaterials = selectedMedia.filter((m) => !existingMediaIds.has(m.media_id))
    onUpdate({
      step1Materials: [...formData.step1Materials, ...newMaterials]
    })
  }

  // 第二步素材确认：所有素材
  const handleStep2MediaConfirm = (
    selectedMedia: Array<{
      media_id: string
      media_description: string
      base_media_url: string
      key_frame_image_url: string
      cover_image_id: string
      video_width?: number
      video_height?: number
    }>
  ): void => {
    // 合并新选择的素材与已有的素材，去重
    const existingMediaIds = new Set(formData.step2Materials.map((m) => m.media_id))
    const newMaterials = selectedMedia.filter((m) => !existingMediaIds.has(m.media_id))
    onUpdate({
      step2Materials: [...formData.step2Materials, ...newMaterials]
    })
  }

  // 移除第一步素材
  const handleRemoveStep1Media = (mediaId: string): void => {
    onUpdate({
      step1Materials: formData.step1Materials.filter((m) => m.media_id !== mediaId)
    })
  }

  // 移除第二步素材
  const handleRemoveStep2Media = (mediaId: string): void => {
    onUpdate({
      step2Materials: formData.step2Materials.filter((m) => m.media_id !== mediaId)
    })
  }

  // 计算合并后的素材列表（用于显示和验证）
  const mergedMaterials = useMemo(() => {
    return [...formData.step1Materials, ...formData.step2Materials]
  }, [formData.step1Materials, formData.step2Materials])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex gap-3 items-center">
            <Image className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>广告创意配置</CardTitle>
              <CardDescription>配置广告创意内容和落地页</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 广告名称 */}
          <div className="space-y-2">
            <Label htmlFor="adgroupName">广告名称 *</Label>
            <Input
              id="adgroupName"
              placeholder="输入广告名称"
              value={formData.adgroupName}
              onChange={(e) => onUpdate({ adgroupName: e.target.value })}
            />
          </div>

          {/* 创意名称 */}
          <div className="space-y-2">
            <Label htmlFor="creativeName">创意名称 *</Label>
            <Input
              id="creativeName"
              placeholder="输入创意名称"
              value={formData.creativeName}
              onChange={(e) => onUpdate({ creativeName: e.target.value })}
            />
          </div>

          {/* 标题配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between items-center">
              <Label>
                标题 (
                {formData.autoSelectTitles
                  ? Object.values(formData.accountTitles).reduce(
                      (sum, titles) => sum + titles.length,
                      0
                    )
                  : formData.titles.length}
                ) *
              </Label>
              <span className="text-sm text-muted-foreground">每行一个标题，每行最多30字</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Switch
                id="autoSelectTitles"
                checked={formData.autoSelectTitles}
                onCheckedChange={(checked) => {
                  onUpdate({ autoSelectTitles: checked })
                  if (!checked) {
                    // 关闭时清空accountTitles
                    onUpdate({ accountTitles: {} })
                  }
                }}
              />
              <Label htmlFor="autoSelectTitles" className="cursor-pointer">
                自动挑选标题（分账户分配，每个账户随机选择3个不重复标题）
              </Label>
            </div>
            {formData.autoSelectTitles ? (
              <div className="space-y-2">
                {loadingTitlePool ? (
                  <div className="text-sm text-muted-foreground">加载标题包中...</div>
                ) : titlePool.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    标题包为空，请联系管理员添加标题
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.advertiserId && (
                      <>
                        {formData.advertiserId
                          .split('\n')
                          .map((line) => line.trim())
                          .filter((line) => line.length > 0)
                          .map((accountIdStr, index) => {
                            const accountId = parseInt(accountIdStr, 10)
                            if (isNaN(accountId)) return null
                            const accountTitles = formData.accountTitles[accountId.toString()] || []
                            return (
                              <div key={accountId} className="p-3 border rounded-md bg-muted/30">
                                <div className="text-sm font-medium mb-2">账户 {accountId}:</div>
                                <div className="space-y-1">
                                  {accountTitles.length > 0 ? (
                                    accountTitles.map((title, idx) => (
                                      <div key={idx} className="text-sm text-muted-foreground">
                                        {idx + 1}. {title}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-muted-foreground">等待分配...</div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Textarea
                placeholder="输入标题，每行一个标题（每行最多30字）"
                value={titlesText}
                onChange={(e) => handleTitlesChange(e.target.value)}
                onBlur={handleTitlesBlur}
                rows={6}
                className="resize-none"
              />
            )}
          </div>

          {/* 描述配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between items-center">
              <Label>描述 ({formData.descriptions.length})</Label>
              <span className="text-sm text-muted-foreground">每行一个描述，每行最多80字</span>
            </div>
            <Textarea
              placeholder="输入描述，每行一个描述（每行最多80字）"
              value={descriptionsText}
              onChange={(e) => handleDescriptionsChange(e.target.value)}
              onBlur={handleDescriptionsBlur}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* 品牌形象配置 */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="brandImageId">品牌形象 *</Label>
            {loadingBrandImages ? (
              <div className="text-sm text-muted-foreground">加载中...</div>
            ) : (
              <select
                id="brandImageId"
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={formData.brandImageId || ''}
                onChange={(e) => onUpdate({ brandImageId: e.target.value })}
              >
                {brandImages.length === 0 ? (
                  <option value="">请先选择账户</option>
                ) : (
                  brandImages.map((brand) => (
                    <option key={brand.brand_image_id} value={brand.brand_image_id}>
                      {brand.brand_name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* 创意素材 - 两步选择 */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between items-center">
              <Label>创意素材 (共 {mergedMaterials.length} 个)</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="materialsPerBatch" className="text-sm whitespace-nowrap">
                    每批素材数:
                  </Label>
                  <Input
                    id="materialsPerBatch"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.materialsPerBatch || 6}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (!isNaN(value) && value >= 1 && value <= 20) {
                        onUpdate({ materialsPerBatch: value })
                      } else if (e.target.value === '') {
                        // 允许清空，但保持默认值6
                        onUpdate({ materialsPerBatch: 6 })
                      }
                    }}
                    onBlur={(e) => {
                      // 失去焦点时，如果值无效，恢复为默认值6
                      const value = parseInt(e.target.value, 10)
                      if (isNaN(value) || value < 1 || value > 20) {
                        onUpdate({ materialsPerBatch: 6 })
                      }
                    }}
                    className="w-20"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMediaPickerStep1(true)}
                  disabled={!formData.advertiserId || !formData.cookieConfigId}
                >
                  <Video className="mr-2 w-4 h-4" />
                  第一步：添加横屏视频 ({formData.step1Materials.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMediaPickerStep2(true)}
                  disabled={
                    !formData.advertiserId ||
                    !formData.cookieConfigId ||
                    formData.step1Materials.length === 0
                  }
                >
                  <Video className="mr-2 w-4 h-4" />
                  第二步：添加素材 ({formData.step2Materials.length})
                </Button>
              </div>
            </div>

            {/* 第一步素材：横屏视频 */}
            {formData.step1Materials.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  第一步：横屏视频素材（必须至少1个，将放在第一位）
                </div>
                <div className="grid grid-cols-8 gap-4">
                  {formData.step1Materials.map((media) => (
                    <div
                      key={media.media_id}
                      className="relative rounded-lg border overflow-hidden bg-blue-50/30 border-blue-200"
                    >
                      <div className="aspect-[9/16] bg-gray-100 relative">
                        <img
                          src={convertToHttps(media.key_frame_image_url)}
                          alt={media.media_description}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3E图片加载失败%3C/text%3E%3C/svg%3E'
                          }}
                        />
                        <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                          第一步
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => handleRemoveStep1Media(media.media_id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="p-2">
                        <p
                          className="text-xs text-gray-700 truncate"
                          title={media.media_description}
                        >
                          {media.media_description}
                        </p>
                        {media.video_width && media.video_height && (
                          <p className="text-xs text-gray-500 mt-1">
                            {media.video_width}×{media.video_height}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 第二步素材：所有素材 */}
            {formData.step2Materials.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  第二步：其他素材（横屏+竖屏）
                </div>
                <div className="grid grid-cols-8 gap-4">
                  {formData.step2Materials.map((media) => (
                    <div
                      key={media.media_id}
                      className="relative rounded-lg border overflow-hidden bg-muted/30"
                    >
                      <div className="aspect-[9/16] bg-gray-100 relative">
                        <img
                          src={convertToHttps(media.key_frame_image_url)}
                          alt={media.media_description}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3E图片加载失败%3C/text%3E%3C/svg%3E'
                          }}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => handleRemoveStep2Media(media.media_id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="p-2">
                        <p
                          className="text-xs text-gray-700 truncate"
                          title={media.media_description}
                        >
                          {media.media_description}
                        </p>
                        {media.video_width && media.video_height && (
                          <p className="text-xs text-gray-500 mt-1">
                            {media.video_width}×{media.video_height}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mergedMaterials.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                <div>请先添加第一步的横屏视频素材（至少1个）</div>
                <div className="mt-2 text-xs">然后可以添加第二步的其他素材</div>
              </div>
            )}

            {/* 素材分配提示 */}
            {mergedMaterials.length > formData.materialsPerBatch && (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                <div className="font-medium mb-1">
                  提示：素材数量超过每批素材数（当前设置：{formData.materialsPerBatch}个）
                </div>
                <div className="text-xs">
                  系统将自动分批创建，每批最多{formData.materialsPerBatch}
                  个素材。第一步的横屏视频素材将放在每批的第一位。
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 第一步：横屏视频选择器 */}
      <MediaPickerModal
        open={showMediaPickerStep1}
        onOpenChange={setShowMediaPickerStep1}
        advertiserId={
          formData.advertiserId ? parseInt(formData.advertiserId.split('\n')[0].trim(), 10) : null
        }
        cookieConfigId={formData.cookieConfigId}
        selectedMediaIds={useMemo(
          () => formData.step1Materials.map((m) => m.media_id),
          [formData.step1Materials]
        )}
        siteSet={formData.siteSet.length > 0 ? formData.siteSet : undefined}
        promotedObjectType={formData.productType ? parseInt(formData.productType, 10) : undefined}
        onlyLandscapeVideo={true}
        onConfirm={handleStep1MediaConfirm}
      />

      {/* 第二步：所有素材选择器 */}
      <MediaPickerModal
        open={showMediaPickerStep2}
        onOpenChange={setShowMediaPickerStep2}
        advertiserId={
          formData.advertiserId ? parseInt(formData.advertiserId.split('\n')[0].trim(), 10) : null
        }
        cookieConfigId={formData.cookieConfigId}
        selectedMediaIds={useMemo(
          () => [...formData.step1Materials, ...formData.step2Materials].map((m) => m.media_id),
          [formData.step1Materials, formData.step2Materials]
        )}
        siteSet={formData.siteSet.length > 0 ? formData.siteSet : undefined}
        promotedObjectType={formData.productType ? parseInt(formData.productType, 10) : undefined}
        onlyLandscapeVideo={false}
        onConfirm={handleStep2MediaConfirm}
      />
    </>
  )
}
