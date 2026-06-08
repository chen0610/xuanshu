import { create } from 'zustand'
import type { ColorScheme } from '../config/themes'
import { themes, getThemeById, defaultColorScheme } from '../config/themes'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  colorScheme: ColorScheme
  setTheme: (theme: Theme) => void
  setColorScheme: (colorScheme: ColorScheme) => void
  toggleTheme: () => void
}

const THEME_STORAGE_KEY = 'app-theme'
const COLOR_SCHEME_STORAGE_KEY = 'app-color-scheme'

const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  return stored || 'light'
}

const getStoredColorScheme = (): ColorScheme => {
  if (typeof window === 'undefined') return defaultColorScheme
  const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) as ColorScheme | null
  if (stored && themes.some((t) => t.id === stored)) {
    return stored
  }
  return defaultColorScheme
}

const applyTheme = (theme: Theme, colorScheme: ColorScheme) => {
  if (typeof window === 'undefined') return
  const root = document.documentElement

  // 应用亮色/暗色模式
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // 应用配色方案
  const themeConfig = getThemeById(colorScheme)
  if (themeConfig) {
    const colors = theme === 'dark' ? themeConfig.dark : themeConfig.light
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }

  localStorage.setItem(THEME_STORAGE_KEY, theme)
  localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme)
}

// 初始化主题
const initialTheme = getStoredTheme()
const initialColorScheme = getStoredColorScheme()
applyTheme(initialTheme, initialColorScheme)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  colorScheme: initialColorScheme,
  setTheme: (theme: Theme) => {
    const currentColorScheme = get().colorScheme
    applyTheme(theme, currentColorScheme)
    set({ theme })
  },
  setColorScheme: (colorScheme: ColorScheme) => {
    const currentTheme = get().theme
    applyTheme(currentTheme, colorScheme)
    set({ colorScheme })
  },
  toggleTheme: () => {
    const current = get().theme
    const newTheme = current === 'dark' ? 'light' : 'dark'
    const currentColorScheme = get().colorScheme
    applyTheme(newTheme, currentColorScheme)
    set({ theme: newTheme })
  }
}))
