import apiClient from './api'
import type {
  OceanEngineAuthUrlResponse,
  OceanEngineTokenListResponse,
  OceanEngineCallbackResponse,
  OceanEngineRefreshResponse,
  OceanEngineAppAccessTokenResponse,
  OceanEngineAuthorizedAccountListResponse
} from '../types/ocean-engine-oauth.types'

const BASE = '/api/v1/ocean-engine-oauth'
const STATE_KEY = 'ocean_engine_oauth_state'
const AUTH_SUCCESS_KEY = 'ocean_engine_oauth_success'

export const oceanEngineOAuthService = {
  async getAppAccessToken(appCode?: string): Promise<OceanEngineAppAccessTokenResponse> {
    const { data } = await apiClient.get<OceanEngineAppAccessTokenResponse>(`${BASE}/app-access-token`, {
      params: appCode ? { app_code: appCode } : undefined
    })
    return data
  },

  async getAuthUrl(appCode?: string): Promise<OceanEngineAuthUrlResponse> {
    const { data } = await apiClient.get<OceanEngineAuthUrlResponse>(`${BASE}/auth-url`, {
      params: appCode ? { app_code: appCode } : undefined
    })
    return data
  },

  async handleCallback(authCode: string, state: string): Promise<OceanEngineCallbackResponse> {
    const { data } = await apiClient.get<OceanEngineCallbackResponse>(`${BASE}/callback`, {
      params: { auth_code: authCode, state }
    })
    return data
  },

  async getTokens(activeOnly = true): Promise<OceanEngineTokenListResponse> {
    const { data } = await apiClient.get<OceanEngineTokenListResponse>(`${BASE}/tokens`, {
      params: { active_only: activeOnly }
    })
    return data
  },

  async getAuthorizedAccounts(activeOnly = true): Promise<OceanEngineAuthorizedAccountListResponse> {
    const { data } = await apiClient.get<OceanEngineAuthorizedAccountListResponse>(`${BASE}/accounts`, {
      params: { active_only: activeOnly }
    })
    return data
  },

  async revokeToken(advertiserId: string, appCode?: string): Promise<void> {
    await apiClient.delete(`${BASE}/tokens/${advertiserId}`, {
      params: appCode ? { app_code: appCode } : undefined
    })
  },

  async refreshToken(advertiserId: string, appCode?: string): Promise<OceanEngineRefreshResponse> {
    const { data } = await apiClient.post<OceanEngineRefreshResponse>(
      `${BASE}/tokens/${advertiserId}/refresh`,
      undefined,
      {
        params: appCode ? { app_code: appCode } : undefined
      }
    )
    return data
  },

  saveAuthState(state: string): void {
    sessionStorage.setItem(STATE_KEY, state)
  },

  verifyCallbackState(state: string): boolean {
    const saved = sessionStorage.getItem(STATE_KEY)
    return saved === state
  },

  clearAuthState(): void {
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(AUTH_SUCCESS_KEY)
  },

  async startAuthFlow(appCode?: string): Promise<{ success: boolean; message?: string }> {
    const { auth_url, state } = await this.getAuthUrl(appCode)
    this.saveAuthState(state)

    const isElectron = !!(window as any).api
    if (isElectron) {
      return this._electronFlow(auth_url)
    }
    return this._popupFlow(auth_url)
  },

  async _electronFlow(url: string): Promise<{ success: boolean; message?: string }> {
    const api = (window as any).api

    if (api?.openOceanEngineAuthWindow) {
      const result = await api.openOceanEngineAuthWindow(url)

      if (result?.success && result.auth_code && result.state) {
        const resp = await this.handleCallback(result.auth_code, result.state)
        this.clearAuthState()
        return { success: true, message: resp.message }
      }

      throw new Error(result?.error || '授权失败，请重试')
    }

    throw new Error('未找到 Electron 授权窗口接口，请重启应用')
  },

  async _popupFlow(url: string): Promise<{ success: boolean; message?: string }> {
    const w = 700,
      h = 750
    const left = (screen.width - w) / 2
    const top = (screen.height - h) / 2
    const features = `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    const popup = window.open(url, 'oe_oauth', features)

    if (!popup) {
      window.location.href = url
      return { success: true }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          cleanup()
          reject(new Error('授权超时，请重试'))
        },
        5 * 60 * 1000
      )

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'ocean_engine_oauth_result') {
          cleanup()
          event.data.success
            ? resolve({ success: true, message: event.data.message })
            : reject(new Error(event.data.message || '授权失败'))
        }
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          cleanup()
          const ok = sessionStorage.getItem(AUTH_SUCCESS_KEY)
          if (ok === 'true') {
            sessionStorage.removeItem(AUTH_SUCCESS_KEY)
            resolve({ success: true })
          } else {
            reject(new Error('授权窗口已关闭'))
          }
        }
      }, 500)

      const cleanup = () => {
        clearTimeout(timer)
        clearInterval(checkClosed)
        window.removeEventListener('message', onMessage)
        if (!popup.closed) popup.close()
      }

      window.addEventListener('message', onMessage)
    })
  }
}
