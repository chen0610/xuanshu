import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import type { SidebarConfig, SidebarGroup, SidebarItem } from '../../config/sidebar'
import type { User } from '../../types/user.types'

interface BaseSidebarProps {
  config: SidebarConfig
  isCollapsed: boolean
  onToggle: () => void
  className?: string
}

/** 根据 visible 函数过滤菜单项 */
function filterItems(items: SidebarItem[], user: User | null): SidebarItem[] {
  return items.filter((item) => !item.visible || item.visible(user))
}

/** 过滤分组：移除不可见的菜单项，跳过空分组 */
function filterGroups(groups: SidebarGroup[], user: User | null): SidebarGroup[] {
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items, user) }))
    .filter((group) => group.items.length > 0)
}

export const BaseSidebar: React.FC<BaseSidebarProps> = ({
  config,
  isCollapsed,
  onToggle,
  className
}) => {
  const location = useLocation()
  const { user } = useAuth()
  const visibleGroups = filterGroups(config.groups, user ?? null)

  const Icon = config.icon

  const isActive = (path: string): boolean => {
    // 根路径精确匹配，子路径前缀匹配
    const basePath = config.groups[0]?.items[0]?.path
    if (path === basePath) return location.pathname === path
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] flex-col border-r border-border/70 bg-sidebar/90 backdrop-blur transition-all duration-300',
        isCollapsed ? 'w-[76px]' : 'w-[272px]',
        className
      )}
    >
      {/* 头部标题 */}
      <div className="flex-shrink-0 border-b border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="title"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                  {config.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{config.subtitle}</p>
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex w-full items-center justify-center"
              >
                <Icon className="h-6 w-6 text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        {!isCollapsed && (
          <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {config.sectionLabel}
          </p>
        )}
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {/* 分组标题（展开时显示，概览组只有一项时不显示标题） */}
              {!isCollapsed && !(group.items.length === 1 && visibleGroups.indexOf(group) === 0) && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const ItemIcon = item.icon
                  const active = isActive(item.path)

                  return (
                    <div
                      key={item.path}
                      className={cn('group relative', isCollapsed && 'flex justify-center')}
                    >
                      <Link to={item.path} className="block">
                        <motion.div
                          className={cn(
                            'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                            isCollapsed ? 'w-12 justify-center px-0' : '',
                            active
                              ? 'border border-sidebar-border bg-accent text-sidebar-foreground'
                              : 'text-muted-foreground hover:bg-accent/60 hover:text-sidebar-foreground'
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {active && !isCollapsed && (
                            <span className="absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 bg-primary" />
                          )}
                          <ItemIcon className="h-5 w-5 flex-shrink-0" />
                          <AnimatePresence>
                            {!isCollapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="flex-1 overflow-hidden whitespace-nowrap text-sm font-medium"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {!isCollapsed && active && (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                        </motion.div>
                      </Link>
                      {/* 折叠态 tooltip */}
                      {isCollapsed && (
                        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-border/70 bg-popover px-3 py-1.5 text-sm text-popover-foreground opacity-0 shadow-md transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                          {item.label}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* 底部折叠按钮 */}
      <div className="flex-shrink-0 border-t border-border/70 bg-sidebar/95 p-3">
        <motion.button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-sidebar-foreground',
            isCollapsed ? 'justify-center' : ''
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">收起导航</span>
            </>
          )}
        </motion.button>
      </div>
    </aside>
  )
}
