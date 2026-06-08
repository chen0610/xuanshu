import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '../types/api.types'

// API 基础 URL - 根据环境变量或默认值
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090'

// 创建 Axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2分钟超时
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加 JWT Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // 处理认证错误
    if (error.response?.status === 401) {
      // 检查是否是登录请求，如果是登录请求，不执行自动跳转
      const isLoginRequest = error.config?.url?.includes('/auth/login')

      if (!isLoginRequest) {
        // Token 过期或无效，清除本地存储
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')

        // 跳转到登录页
        window.location.href = '/auth/login'
      }
    }

    // 处理其他错误 - 优先提取后端返回的 message 字段
    const responseData = error.response?.data
    const errorMessage =
      (responseData as { message?: string })?.message ||
      (responseData as { detail?: string })?.detail ||
      error.message ||
      '未知错误'

    const apiError: ApiError = {
      ...responseData,
      detail: errorMessage,
      message: errorMessage,
      status_code: error.response?.status
    }

    return Promise.reject(apiError)
  }
)

export default apiClient
export { API_BASE_URL }
