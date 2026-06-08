export interface OceanEngineApp {
  id: number
  app_code: string
  app_id: string
  redirect_uri: string
  remark?: string | null
  status: string
  weight: number
  is_active: boolean
  created_at: string
  updated_at?: string | null
}

export interface OceanEngineAppListResponse {
  items: OceanEngineApp[]
  total: number
}

export interface OceanEngineAppCreateRequest {
  app_code: string
  app_id: string
  app_secret: string
  redirect_uri: string
  remark?: string
  status?: string
  weight?: number
  is_active?: boolean
}

export interface OceanEngineAppUpdateRequest {
  app_id?: string
  app_secret?: string
  redirect_uri?: string
  remark?: string
  status?: string
  weight?: number
  is_active?: boolean
}
