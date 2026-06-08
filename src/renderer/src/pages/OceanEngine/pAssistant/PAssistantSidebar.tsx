import React from 'react'
import { cn } from '../../../lib/utils'
import {
  P_ASSISTANT_FEATURES,
  P_ASSISTANT_FEATURE_GROUPS,
  type PAssistantFeature,
  type PAssistantTabKey
} from '../pAssistantFeatures'

interface PAssistantSidebarProps {
  activeTab: PAssistantTabKey
  onSelect: (key: PAssistantTabKey) => void
}

/** 按分组归类功能列表 */
const groupedFeatures = P_ASSISTANT_FEATURE_GROUPS.filter((g) => g.key !== 'all').map((group) => ({
  ...group,
  features: P_ASSISTANT_FEATURES.filter((f) => f.group === group.key)
}))

export const PAssistantSidebar: React.FC<PAssistantSidebarProps> = ({ activeTab, onSelect }) => {
  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col border-r border-border/70 bg-sidebar/60">
      {/* 标题 */}
      <div className="flex-shrink-0 border-b border-border/70 px-4 py-3">
        <p className="text-sm font-semibold text-sidebar-foreground">批量助手</p>
        <p className="mt-0.5 text-xs text-muted-foreground">选择操作</p>
      </div>

      {/* 功能列表 */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {groupedFeatures.map((group) => (
          <div key={group.key} className="mb-3">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.features.map((feature) => (
                <SidebarItem
                  key={feature.key}
                  feature={feature}
                  isActive={activeTab === feature.key}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ─── 单个菜单项 ──────────────────────────────────────

function SidebarItem({
  feature,
  isActive,
  onSelect
}: {
  feature: PAssistantFeature
  isActive: boolean
  onSelect: (key: PAssistantTabKey) => void
}) {
  const Icon = feature.icon

  return (
    <button
      type="button"
      onClick={() => onSelect(feature.key)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
        feature.danger && !isActive && 'text-destructive/70 hover:text-destructive'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0',
          isActive
            ? 'text-primary'
            : feature.danger
              ? 'text-destructive/60'
              : 'text-muted-foreground'
        )}
      />
      <span className="truncate">{feature.shortLabel || feature.label}</span>
    </button>
  )
}
