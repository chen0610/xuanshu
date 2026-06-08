import { Moon, Sun } from 'lucide-react'
import { Button } from './index'
import { useThemeStore } from '../../stores/theme.store'
import { motion } from 'framer-motion'

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="overflow-hidden relative"
      aria-label="切换主题"
    >
      <motion.div
        className="flex justify-center items-center"
        initial={false}
        animate={{ rotate: theme === 'dark' ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </motion.div>
      {/* <span className="hidden ml-2 sm:inline">
        {theme === 'dark' ? 'light' : 'dark'}
      </span> */}
    </Button>
  )
}
