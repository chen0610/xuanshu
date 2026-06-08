// API 通用类型定义

export interface ApiError {
  detail?: string
  message?: string
  error?: string
  details?: Record<string, unknown>
  status_code?: number
}

export interface HealthResponse {
  status: string
  timestamp: string
  version: string
}

export interface PaginationParams {
  page?: number
  page_size?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
