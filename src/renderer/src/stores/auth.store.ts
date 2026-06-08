import { create } from 'zustand'
import type { User, LoginCredentials, UserCreate } from '../types/user.types'
import { authService } from '../services/auth.service'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  register: (userData: UserCreate) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
}

// 从 localStorage 恢复用户信息
const restoreUserFromStorage = (): User | null => {
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      return JSON.parse(userStr) as User
    }
  } catch (error) {
    console.error('Failed to restore user from storage:', error)
  }
  return null
}

export const useAuthStore = create<AuthState>((set) => {
  // 初始化时从 localStorage 恢复用户信息
  const savedUser = restoreUserFromStorage()
  const hasToken = !!authService.getToken()
  const initialAuthState = hasToken && !!savedUser

  // 初始化时通知主进程登录状态
  if (typeof window !== 'undefined' && window.api?.setLoginStatus) {
    window.api.setLoginStatus(initialAuthState)
  }

  return {
    user: savedUser,
    isAuthenticated: initialAuthState,
    isLoading: false,
    error: null,

    login: async (credentials) => {
      set({ isLoading: true, error: null })
      try {
        const { access_token, user } = await authService.login(credentials)
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('user', JSON.stringify(user))
        set({ user, isAuthenticated: true, isLoading: false })
        // 通知主进程用户已登录
        if (window.api?.setLoginStatus) {
          window.api.setLoginStatus(true)
        }
      } catch (error: any) {
        set({ error: error.detail || '登录失败', isLoading: false })
        throw error
      }
    },

    register: async (userData) => {
      set({ isLoading: true, error: null })
      try {
        await authService.register(userData)
        set({ isLoading: false })
      } catch (error: any) {
        set({ error: error.detail || '注册失败', isLoading: false })
        throw error
      }
    },

    logout: () => {
      authService.logout()
      set({ user: null, isAuthenticated: false })
      // 通知主进程用户已登出
      if (window.api?.setLoginStatus) {
        window.api.setLoginStatus(false)
      }
    },

    checkAuth: async () => {
      const token = authService.getToken()

      // 如果没有 token，清除状态
      if (!token) {
        set({ isAuthenticated: false, user: null })
        // 通知主进程用户未登录
        if (window.api?.setLoginStatus) {
          window.api.setLoginStatus(false)
        }
        return
      }

      // 先从 localStorage 恢复用户信息（提供更好的用户体验）
      const savedUser = restoreUserFromStorage()
      if (savedUser) {
        set({ user: savedUser, isAuthenticated: true })
        // 通知主进程用户已登录
        if (window.api?.setLoginStatus) {
          window.api.setLoginStatus(true)
        }
      }

      // 验证 token 是否有效
      set({ isLoading: true })
      try {
        const user = await authService.getCurrentUser()
        // 更新用户信息（可能服务器端有更新）
        localStorage.setItem('user', JSON.stringify(user))
        set({ user, isAuthenticated: true, isLoading: false })
        // 通知主进程用户已登录
        if (window.api?.setLoginStatus) {
          window.api.setLoginStatus(true)
        }
      } catch (error) {
        // Token 无效或过期，清除登录状态
        authService.logout()
        set({ isAuthenticated: false, user: null, isLoading: false })
        // 通知主进程用户未登录
        if (window.api?.setLoginStatus) {
          window.api.setLoginStatus(false)
        }
      }
    },

    clearError: () => set({ error: null })
  }
})
