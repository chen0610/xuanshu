import apiClient from './api'
import type {
  Config,
  ConfigCreate,
  ConfigUpdate,
  MobileAccessToggleResponse
} from '../types/config.types'

const BASE_PATH = '/api/v1/configs'

/**
 * 配置服务 - 处理配置相关的 API 调用
 */
export const configService = {
  /**
   * 创建配置
   */
  async createConfig(data: ConfigCreate): Promise<Config> {
    const response = await apiClient.post<Config>(BASE_PATH, data)
    return response.data
  },

  /**
   * 获取配置详情
   */
  async getConfig(configId: number): Promise<Config> {
    const response = await apiClient.get<Config>(`${BASE_PATH}/${configId}`)
    return response.data
  },
  /**
  /**
   * 更新配置
   */
  async updateConfig(configId: number, data: ConfigUpdate): Promise<Config> {
    const response = await apiClient.put<Config>(`${BASE_PATH}/${configId}`, data)
    return response.data
  },

  /**
   * 删除配置
   */
  async deleteConfig(configId: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${configId}`)
  },

  /**
   * 获取用户特定source的配置列表
   * @param source 1-巨量, 2-腾讯
   * @param options.forPAssistant 批量助手：仅返回 Cookie 数量大于 8 的巨量配置
   */
  async getConfigsBySource(
    source: number,
    options?: { forPAssistant?: boolean }
  ): Promise<Config[]> {
    const response = await apiClient.get<Config[]>(`${BASE_PATH}/user/source/${source}`, {
      params: options?.forPAssistant ? { for_p_assistant: true } : undefined
    })
    return response.data
  },
  /**
   * 获取用户特定source的全部配置列表
   * @param source 1-巨量, 2-腾讯
   */
  async getConfigsBySourceAll(source: number): Promise<Config[]> {
    const response = await apiClient.get<Config[]>(`${BASE_PATH}/user/source/${source}/all`)
    return response.data
  },

  /**
   * 开启/关闭移动端授权
   */
  async toggleMobileAccess(configId: number, enable: boolean): Promise<MobileAccessToggleResponse> {
    const response = await apiClient.post<MobileAccessToggleResponse>(
      `${BASE_PATH}/${configId}/mobile-access/toggle`,
      { enable }
    )
    return response.data
  }
}
