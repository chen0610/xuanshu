import React from 'react'
import { CheckCircle, History, Search, Sparkles } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input
} from '../../components/ui'
import {
  P_ASSISTANT_FEATURE_GROUPS,
  type PAssistantFeature,
  type PAssistantFeatureGroup,
  type PAssistantTabKey
} from './pAssistantFeatures'

interface PAssistantFeatureWorkbenchProps {
  activeTab: PAssistantTabKey
  activeFeature?: PAssistantFeature
  activeJobId: number | null
  isJobCenterOpen: boolean
  isExpanded: boolean
  search: string
  selectedGroup: PAssistantFeatureGroup | 'all'
  recentFeatures: PAssistantFeature[]
  visibleFeatures: PAssistantFeature[]
  onSelectFeature: (featureKey: PAssistantTabKey) => void
  onOpenJobCenter: () => void
  onToggleExpanded: () => void
  onSearchChange: (value: string) => void
  onGroupChange: (value: PAssistantFeatureGroup | 'all') => void
  onResetFilters: () => void
}

export const PAssistantFeatureWorkbench: React.FC<PAssistantFeatureWorkbenchProps> = ({
  activeTab,
  activeFeature,
  activeJobId,
  isJobCenterOpen,
  isExpanded,
  search,
  selectedGroup,
  recentFeatures,
  visibleFeatures,
  onSelectFeature,
  onOpenJobCenter,
  onToggleExpanded,
  onSearchChange,
  onGroupChange,
  onResetFilters
}) => {
  const ActiveFeatureIcon = activeFeature?.icon

  const renderFeatureButton = (feature: PAssistantFeature, compact = false): React.ReactNode => {
    const Icon = feature.icon
    const isActive = activeTab === feature.key

    if (compact) {
      return (
        <Button
          key={feature.key}
          type="button"
          variant={isActive ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelectFeature(feature.key)}
          className="justify-start gap-2"
        >
          <Icon className="w-4 h-4" />
          {feature.shortLabel || feature.label}
        </Button>
      )
    }

    return (
      <button
        key={feature.key}
        type="button"
        onClick={() => onSelectFeature(feature.key)}
        className={`group rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
          isActive
            ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
            : 'border-border bg-card/70 hover:border-primary/40 hover:bg-accent/40'
        }`}
      >
        <div className="flex gap-3 items-start">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
              feature.danger ? 'bg-destructive/10' : 'bg-primary/10'
            }`}
          >
            <Icon className={`w-5 h-5 ${feature.danger ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 items-center">
              <span className="font-semibold truncate">{feature.label}</span>
              {isActive && <CheckCircle className="flex-shrink-0 w-4 h-4 text-primary" />}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
            {feature.badges && feature.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {feature.badges.map((badge) => (
                  <span
                    key={badge}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      feature.danger && badge.includes('风险')
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <Card className="mb-4 overflow-hidden border bg-gradient-to-br from-card via-card to-muted/20">
      <CardHeader className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              操作工作台
            </CardTitle>
            <CardDescription className="mt-1">
              当前操作优先展示，完整入口按需展开，减少对主体表单的遮挡。
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* <Button
              type="button"
              size="sm"
              variant={isJobCenterOpen ? 'default' : 'outline'}
              onClick={onOpenJobCenter}
              className="justify-start gap-2 shadow-sm"
            >
              <History className="w-4 h-4" />
              任务记录
              {activeJobId ? (
                <span className="ml-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                  #{activeJobId}
                </span>
              ) : null}
            </Button> */}
            {activeFeature && ActiveFeatureIcon && (
              <div className="rounded-lg border bg-background/70 px-3 py-2 text-sm lg:min-w-[220px]">
                <div className="text-xs text-muted-foreground">当前操作</div>
                <div className="mt-1 flex items-center gap-2 font-semibold">
                  <ActiveFeatureIcon className="w-4 h-4 text-primary" />
                  {activeFeature.label}
                </div>
              </div>
            )}
            <Button
              type="button"
              variant={isExpanded ? 'secondary' : 'default'}
              size="sm"
              onClick={onToggleExpanded}
              className="justify-start gap-2"
            >
              <Search className="w-4 h-4" />
              {isExpanded ? '收起入口' : '展开分类'}
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-5 border-t pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索操作：预算、素材、头像、ROI、清理..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {P_ASSISTANT_FEATURE_GROUPS.map((group) => (
              <Button
                key={group.key}
                type="button"
                variant={selectedGroup === group.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => onGroupChange(group.key)}
              >
                {group.label}
              </Button>
            ))}
          </div>

          {recentFeatures.length > 0 && !search.trim() && selectedGroup === 'all' && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">最近使用</div>
              <div className="flex flex-wrap gap-2">
                {recentFeatures.map((feature) => renderFeatureButton(feature, true))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="text-sm font-medium text-muted-foreground">
                {search.trim() ? '搜索结果' : '功能入口'} · {visibleFeatures.length} 个
              </div>
              {(search || selectedGroup !== 'all') && (
                <Button type="button" variant="ghost" size="sm" onClick={onResetFilters}>
                  重置筛选
                </Button>
              )}
            </div>
            {visibleFeatures.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleFeatures.map((feature) => renderFeatureButton(feature))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground">
                没有匹配的批量操作，请尝试其他关键词。
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
