import { Palette, Check } from 'lucide-react'
import { Button } from './index'
import { useThemeStore } from '../../stores/theme.store'
import { themes } from '../../config/themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { motion } from 'framer-motion'

export const ThemeSelector = () => {
  const { colorScheme, setColorScheme } = useThemeStore()
  const currentTheme = themes.find((t) => t.id === colorScheme)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="overflow-hidden relative"
          aria-label="选择配色方案"
          title={`当前配色: ${currentTheme?.name || '未知'}`}
        >
          <Palette className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-3 w-72 rounded-xl" sideOffset={8}>
        <DropdownMenuLabel className="p-2 font-normal mb-2">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">配色方案</p>
            <p className="text-xs leading-none text-muted-foreground">
              当前: {currentTheme?.name || '未知'}
            </p>
          </div>
        </DropdownMenuLabel>

        {/* 配色方案列表 - 直接显示，无需嵌套，滚动支持 */}
        <div className="grid grid-cols-1 gap-1 max-h-[420px] overflow-y-auto pr-1 scrollbar-hide">
          {themes.map((themeOption) => {
            const isSelected = colorScheme === themeOption.id
            return (
              <DropdownMenuItem
                key={themeOption.id}
                onClick={() => setColorScheme(themeOption.id)}
                className={`rounded-lg cursor-pointer focus:bg-accent p-2 transition-colors ${
                  isSelected ? 'bg-accent/50 border border-primary/20' : 'hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">{themeOption.name}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {themeOption.description}
                    </span>
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="flex-shrink-0 ml-2"
                    >
                      <Check className="w-4 h-4 text-primary" />
                    </motion.div>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
