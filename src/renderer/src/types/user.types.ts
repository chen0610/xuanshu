// 用户类型定义 - 对应 FastAPI 的 Pydantic 模型

export type UserRole = 'admin' | 'user' | 'manager'

export interface User {
  id: number
  username: string
  email?: string
  name?: string
  is_active: boolean
  role: UserRole
  parent_user_id?: number | null
  created_at?: string
}

export interface UserCreate {
  username: string
  password: string
  email?: string
  name?: string
  role?: UserRole
  parent_user_id?: number | null
}

export interface UserUpdate {
  username?: string
  email?: string
  name?: string
  password?: string
  is_active?: boolean
  role?: UserRole
  parent_user_id?: number | null
}

export interface PaginationMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface UserListResponse {
  items: User[]
  meta: PaginationMeta
}

/** 上级用户搜索接口返回项 */
export interface ParentUserCandidate {
  id: number
  username: string
  name?: string | null
  role: UserRole
}

export interface UserListParams {
  page?: number
  page_size?: number
  search?: string
  is_active?: boolean
  /** 按角色筛选，与后端 query `role` 对应 */
  role?: UserRole
  sort_by?: 'id' | 'email' | 'name' | 'role' | 'username'
  sort_order?: 'asc' | 'desc'
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

export interface ChangePasswordResponse {
  message: string
}

// 认证相关
export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthToken {
  access_token: string
  token_type: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}
