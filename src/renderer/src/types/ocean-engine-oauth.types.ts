export interface OceanEngineAuthUrlResponse {
  auth_url: string
  state: string
  app_code: string
}

export interface OceanEngineOAuthToken {
  id: number
  user_id: number
  advertiser_id: string
  advertiser_name?: string
  app_code: string
  is_active: boolean
  token_expires_at: string
  refresh_token_expires_at: string
  authorized_at: string
  created_at: string
  updated_at?: string
  is_token_expired: boolean
  is_refresh_token_expired: boolean
}

export interface OceanEngineTokenListResponse {
  items: OceanEngineOAuthToken[]
  total: number
}

export interface OceanEngineAuthorizedAccountAccessUser {
  user_id: number
  permission: string
  granted_by_user_id?: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface OceanEngineAuthorizedAccount {
  account_id: number
  advertiser_id: string
  advertiser_name?: string
  app_code: string
  grant_id: number
  grant_owner_user_id: number
  is_active: boolean
  token_expires_at: string
  refresh_token_expires_at: string
  authorized_at: string
  created_at: string
  updated_at?: string
  is_token_expired: boolean
  is_refresh_token_expired: boolean
  access_users: OceanEngineAuthorizedAccountAccessUser[]
}

export interface OceanEngineAuthorizedAccountListResponse {
  items: OceanEngineAuthorizedAccount[]
  total: number
}

export interface OceanEngineCallbackResponse {
  message: string
  app_code: string
  advertisers: Array<{ advertiser_id: string; advertiser_name: string; app_code: string }>
}

export interface OceanEngineRefreshResponse {
  message: string
  advertiser_id: string
  app_code: string
  token_expires_at: string
}

/** 巨量开放平台应用级 APP Access Token（非广告主 OAuth） */
export interface OceanEngineAppAccessTokenResponse {
  app_code: string
  app_id: string
  access_token: string
  expires_in: number
  token_expires_at: string
  request_id?: string
}
