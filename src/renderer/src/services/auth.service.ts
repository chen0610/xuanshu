import apiClient from './api'
import type {
  ChangePasswordPayload,
  ChangePasswordResponse,
  LoginCredentials,
  User,
  UserCreate
} from '../types/user.types'

export const authService = {
  /**
   * 用户登录
   */
  async login(credentials: LoginCredentials): Promise<{ access_token: string; user: User }> {
    // 使用 OAuth2 Password Flow，使用 form-data
    const formData = new URLSearchParams()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const { data: tokenData } = await apiClient.post('/api/v1/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    // 获取当前用户信息
    localStorage.setItem('access_token', tokenData.access_token)
    const { data: user } = await apiClient.get<User>('/api/v1/users/me')

    return {
      access_token: tokenData.access_token,
      user
    }
  },

  /**
   * 用户注册
   */
  async register(userData: UserCreate): Promise<User> {
    const { data } = await apiClient.post<User>('/api/v1/users/', userData)
    return data
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<User>('/api/v1/users/me')
    return data
  },

  /**
   * 修改当前用户密码
   */
  async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
    const { data } = await apiClient.patch<ChangePasswordResponse>(
      '/api/v1/users/me/password',
      payload
    )
    return data
  },

  /**
   * 登出
   */
  logout(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  },

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token')
  },

  /**
   * 获取存储的 Token
   */
  getToken(): string | null {
    return localStorage.getItem('access_token')
  }
}
