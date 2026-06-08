import React from 'react'
import { CheckCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Button, Input, Label } from '../../../components/ui'
import type { VideoMaterialDistributionMode } from './QuickConfigCard'
import type {
  VideoMaterialFetchMode,
  VideoMaterialItem,
  VideoMaterialPageInfo
} from '../../../services/ocean-engine.service'

export type VideoMaterialPageSize = 100 | 300 | 500

const VIDEO_MATERIAL_PAGE_SIZE_OPTIONS: VideoMaterialPageSize[] = [100, 300, 500]

export interface VideoSelectorCardProps {
  open: boolean
  onToggle: () => void
  mode: VideoMaterialFetchMode
  onModeChange: (value: VideoMaterialFetchMode) => void
  cookieReady: boolean
  oauthReady: boolean
  advertiserId: string
  onAdvertiserIdChange: (value: string) => void
  startDate: string
  onStartDateChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
  loading: boolean
  onFetch: (page?: number) => void
  materialsPerUnit: number
  distributionMode: VideoMaterialDistributionMode
  materialKeywords: string
  onMaterialKeywordsChange: (value: string) => void
  items: VideoMaterialItem[]
  selectedIds: Set<string>
  onToggleItem: (item: VideoMaterialItem) => void
  onTogglePage: (items: VideoMaterialItem[], shouldSelect: boolean) => void
  onClearSelected: () => void
  committedCount: number
  pageInfo: VideoMaterialPageInfo | null
  page: number
  pageSize: VideoMaterialPageSize
  onPageSizeChange: (value: VideoMaterialPageSize) => void
}

function computeVideoCoverId(posterUrl: string): string {
  const withoutProtocol = posterUrl.replace(/^https?:\/\//, '')
  const withoutParams = withoutProtocol.split('?')[0]
  const parts = withoutParams.split('/')
  const second = parts[1] ?? ''
  const thirdRaw = parts[2] ?? ''
  const third = thirdRaw.split('~')[0]
  return `${second}/${third}`
}

export const VideoSelectorCard: React.FC<VideoSelectorCardProps> = ({
  open,
  onToggle,
  mode,
  onModeChange,
  cookieReady,
  oauthReady,
  advertiserId,
  onAdvertiserIdChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  loading,
  onFetch,
  materialsPerUnit,
  distributionMode,
  materialKeywords,
  onMaterialKeywordsChange,
  items,
  selectedIds,
  onToggleItem,
  onTogglePage,
  onClearSelected,
  committedCount,
  pageInfo,
  page,
  pageSize,
  onPageSizeChange
}) => {
  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id))

  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2">
          选择视频素材
          {selectedIds.size > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              已勾选 {selectedIds.size}
            </span>
          )}
          {committedCount > 0 && (
            <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
              已确认 {committedCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">素材拉取模式</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  mode === 'cookie'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => onModeChange('cookie')}
              >
                Cookie 模式（默认）
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs hidden transition-colors ${
                  mode === 'api' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => onModeChange('api')}
              >
                Open API 模式
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {mode === 'cookie'
                ? cookieReady
                  ? '使用基础配置中选中的 Cookie 账号请求巨量素材中心，关键字会传给素材中心搜索。'
                  : '请先在基础配置中选择 Cookie 账号。'
                : oauthReady
                  ? '使用 OAuth 授权组织账户调用 Open API 素材接口。'
                  : '请先在基础配置中选择 OAuth 授权组织账户。'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-0 space-y-1">
              <Label className="text-xs">查询广告主 ID(不填则取广告主账户ID第一行)</Label>
              <Input
                value={advertiserId}
                onChange={(e) => onAdvertiserIdChange(e.target.value)}
                placeholder="输入广告主 ID"
                className="text-sm"
              />
            </div>
            <div className="space-y-1 shrink-0">
              <Label className="text-xs">创建时间起</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="text-xs w-36"
              />
            </div>
            <div className="space-y-1 shrink-0">
              <Label className="text-xs">创建时间止</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="text-xs w-36"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onFetch(1)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  加载中…
                </>
              ) : (
                '拉取视频'
              )}
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">素材关键字</Label>
            <Input
              value={materialKeywords}
              onChange={(e) => onMaterialKeywordsChange(e.target.value)}
              placeholder="多个关键字用 | 分隔，例如：剧名|别名"
              className="text-sm"
            />
          </div>

          {items.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  当前页 {items.length} 个素材，每页 {pageSize} 个，点击卡片即选用；提交时
                  {distributionMode === 'full'
                    ? `每个账户都使用全部已选素材，并按每 ${materialsPerUnit} 个视频创建一个广告单元`
                    : `先将已选素材平均分给账户，每个账户再按每 ${materialsPerUnit} 个视频创建广告单元`}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="video-material-page-size"
                      className="whitespace-nowrap text-xs text-muted-foreground"
                    >
                      每页
                    </Label>
                    <select
                      id="video-material-page-size"
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={pageSize}
                      disabled={loading}
                      onChange={(e) => {
                        const nextPageSize = Number(e.target.value) as VideoMaterialPageSize
                        onPageSizeChange(nextPageSize)
                      }}
                    >
                      {VIDEO_MATERIAL_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} 条
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTogglePage(items, !allPageSelected)}
                  >
                    {allPageSelected ? '取消本页' : '全选本页'}
                  </Button>
                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      onClick={onClearSelected}
                    >
                      清空已选
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {items.map((item) => {
                  const checked = selectedIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      className={`rounded-lg border overflow-hidden cursor-pointer transition-colors ${
                        checked ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                      }`}
                      onClick={() => onToggleItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onToggleItem(item)
                        }
                      }}
                    >
                      <div className="aspect-[9/16] bg-muted relative">
                        <img
                          src={item.poster_url}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {checked && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1 text-xs">
                        <div className="font-medium truncate" title={item.filename}>
                          {item.filename}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {item.width} × {item.height} · {String(item.material_id)}
                        </div>
                        <div className="text-muted-foreground font-mono truncate" title={item.id}>
                          video_id：{item.id}
                        </div>
                        <div
                          className="text-muted-foreground font-mono truncate"
                          title={computeVideoCoverId(item.poster_url)}
                        >
                          cover：{computeVideoCoverId(item.poster_url)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {pageInfo && pageInfo.total_page > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    共 {pageInfo.total_number} 个，第 {page}/{pageInfo.total_page} 页
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loading}
                      onClick={() => onFetch(page - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= pageInfo.total_page || loading}
                      onClick={() => onFetch(page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
              当前没有可展示的视频素材。你可以调整广告主、时间范围，或修改素材关键字后重试。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
