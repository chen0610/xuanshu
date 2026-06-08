export interface OceanEngineGatewayHealthItem {
  app_code: string
  endpoint_key: string
  total_calls: number
  success_calls: number
  failed_calls: number
  rate_limited_calls: number
  last_error?: string | null
  last_success_at?: number | null
  last_failure_at?: number | null
  cooldown_until?: number | null
}

export interface OceanEngineGatewayHealthResponse {
  limiter_mode: string
  items: OceanEngineGatewayHealthItem[]
  total: number
}

export interface OceanEngineApiCallLog {
  id: number
  user_id: number
  app_code: string
  source_advertiser_id: string
  target_advertiser_id: string
  endpoint_key: string
  method: string
  http_status?: number | null
  biz_code?: string | null
  biz_message?: string | null
  success: boolean
  is_rate_limited: boolean
  retry_count: number
  latency_ms?: number | null
  error_message?: string | null
  created_at: string
}

export interface OceanEngineApiCallLogListResponse {
  items: OceanEngineApiCallLog[]
  total: number
}
