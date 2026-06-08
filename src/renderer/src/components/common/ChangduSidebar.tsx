import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Upload,
  Clapperboard,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Clock,
  Film,
  Link2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'

interface SidebarItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** 为 true 时仅 role 为 admin 的用户可见 */
  adminOnly?: boolean
}

const sidebarItems: SidebarItem[] = [
  {
    path: '/changdu/batch-upload',
    label: '批量上传',
    icon: Upload,
    adminOnly: true
  },
  {
    path: '/changdu/short-drama-list',
    label: '常读漫剧列表(实时)',
    icon: Clapperboard
  },
  {
    path: '/changdu/promotion-list',
    label: '推广链接列表',
    icon: Link2
  },
  {
    path: '/changdu/manju-list',
    label: '漫剧列表',
    icon: Film
  },
  {
    path: '/changdu/scheduled-tasks',
    label: '定时任务',
    icon: Clock
  }
]

interface ChangduSidebarProps {
  className?: string
  isCollapsed: boolean
  onToggle: () => void
}

export const ChangduSidebar: React.FC<ChangduSidebarProps> = ({
  className,
  isCollapsed,
  onToggle
}) => {
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const visibleItems = sidebarItems.filter((item) => !item.adminOnly || isAdmin)

  const isActive = (path: string): boolean =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] flex-col border-r border-border/70 bg-sidebar/90 backdrop-blur transition-all duration-300',
        isCollapsed ? 'w-[76px]' : 'w-[272px]',
        className
      )}
    >
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
                  常读助手
                </p>
                <p className="mt-1 text-xs text-muted-foreground">上传、内容与任务协同</p>
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex w-full items-center justify-center"
              >
                <BookOpen className="h-6 w-6 text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        {!isCollapsed && (
          <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Changdu
          </p>
        )}
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <div
                key={item.path}
                className={cn('relative group', isCollapsed && 'flex justify-center')}
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
                    <Icon className="h-5 w-5 flex-shrink-0" />
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
                    {!isCollapsed && active && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                  </motion.div>
                </Link>
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-border/70 bg-popover px-3 py-1.5 text-sm text-popover-foreground opacity-0 shadow-md transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                    {item.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

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
