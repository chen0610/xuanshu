import apiClient from './api'
import type {
  OceanEngineApiCallLogListResponse,
  OceanEngineGatewayHealthResponse
} from '../types/ocean-engine-gateway.types'

const BASE = '/api/v1/ocean-engine-gateway'

export const oceanEngineGatewayService = {
  async getHealth(): Promise<OceanEngineGatewayHealthResponse> {
    const { data } = await apiClient.get<OceanEngineGatewayHealthResponse>(`${BASE}/health`)
    return data
  },

  async getLogs(params?: {
    page?: number
    page_size?: number
    endpoint_key?: string
    app_code?: string
    success?: boolean
  }): Promise<OceanEngineApiCallLogListResponse> {
    const { data } = await apiClient.get<OceanEngineApiCallLogListResponse>(`${BASE}/logs`, {
      params
    })
    return data
  }
}
