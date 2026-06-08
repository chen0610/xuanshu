import { ReactNode, useState, useEffect } from 'react'
import { TencentAdsSidebar } from '../components/common/TencentAdsSidebar'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface TencentAdsLayoutProps {
  children: ReactNode
}

const STORAGE_KEY = 'tencent-ads-sidebar-collapsed'

export const TencentAdsLayout = ({ children }: TencentAdsLayoutProps): React.JSX.Element => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    // 从 localStorage 读取用户偏好
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    // 保存用户偏好到 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="relative flex min-h-screen theme-tencent">
      <TencentAdsSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      <main
        className={cn(
          'flex-1 overflow-auto transition-all duration-300',
          isCollapsed ? 'ml-[76px]' : 'ml-[272px]'
        )}
      >
        <motion.div
          className="p-6 lg:p-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
