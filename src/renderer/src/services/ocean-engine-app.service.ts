import apiClient from './api'
import type {
  OceanEngineApp,
  OceanEngineAppCreateRequest,
  OceanEngineAppListResponse,
  OceanEngineAppUpdateRequest
} from '../types/ocean-engine-app.types'

const BASE = '/api/v1/ocean-engine-apps'

export const oceanEngineAppService = {
  async listApps(activeOnly = false): Promise<OceanEngineAppListResponse> {
    const { data } = await apiClient.get<OceanEngineAppListResponse>(BASE, {
      params: { active_only: activeOnly }
    })
    return data
  },

  async createApp(payload: OceanEngineAppCreateRequest): Promise<OceanEngineApp> {
    const { data } = await apiClient.post<OceanEngineApp>(BASE, payload)
    return data
  },

  async updateApp(appCode: string, payload: OceanEngineAppUpdateRequest): Promise<OceanEngineApp> {
    const { data } = await apiClient.put<OceanEngineApp>(`${BASE}/${appCode}`, payload)
    return data
  },

  async deleteApp(appCode: string): Promise<void> {
    await apiClient.delete(`${BASE}/${appCode}`)
  }
}
