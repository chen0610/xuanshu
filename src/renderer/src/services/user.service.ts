import apiClient from './api'
import type {
  User,
  UserCreate,
  UserUpdate,
  UserListResponse,
  UserListParams,
  ParentUserCandidate
} from '../types/user.types'

export const userService = {
  /**
   * 获取用户列表（带分页和筛选）
   */
  async getUsers(params?: UserListParams): Promise<UserListResponse> {
    const { data } = await apiClient.get<UserListResponse>('/api/v1/users/', { params })
    return data
  },

  /**
   * 搜索可作为上级的用户（管理员、团队管理员），仅管理员可调用
   */
  async searchParentCandidates(params?: {
    search?: string
    exclude_user_id?: number
    limit?: number
  }): Promise<ParentUserCandidate[]> {
    const { data } = await apiClient.get<ParentUserCandidate[]>('/api/v1/users/parent-candidates', {
      params
    })
    return data
  },

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: number): Promise<User> {
    const { data } = await apiClient.get<User>(`/api/v1/users/${id}`)
    return data
  },

  /**
   * 创建新用户
   */
  async createUser(userData: UserCreate): Promise<User> {
    const { data } = await apiClient.post<User>('/api/v1/users/', userData)
    return data
  },

  /**
   * 更新用户信息
   */
  async updateUser(id: number, userData: UserUpdate): Promise<User> {
    const { data } = await apiClient.patch<User>(`/api/v1/users/${id}`, userData)
    return data
  },

  /**
   * 删除用户
   */
  async deleteUser(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/users/${id}`)
  }
}
