import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { oceanEngineOAuthService } from '../services/ocean-engine-oauth.service'

/**
 * 巨量引擎 OAuth 授权回调页面
 *
 * 巨量引擎授权完成后 → 后端 /auth-redirect 中转 → 本页面
 * 本页面调用后端 /callback 完成 token 入库，然后：
 *   - 弹窗模式：postMessage 通知父窗口并关闭
 *   - 普通模式：跳回 /config
 */
export const OceanEngineOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('正在处理授权...')
  const [advertisers, setAdvertisers] = useState<string[]>([])

  useEffect(() => {
    const run = async () => {
      const isPopup = window.opener && window.opener !== window

      try {
        const authCode = searchParams.get('auth_code')
        const state = searchParams.get('state')

        if (!authCode || !state) {
          throw new Error('缺少授权参数（auth_code / state）')
        }

        setMessage('正在绑定广告主账户...')
        const resp = await oceanEngineOAuthService.handleCallback(authCode, state)

        oceanEngineOAuthService.clearAuthState()

        const names = resp.advertisers.map((a) => a.advertiser_name || a.advertiser_id)
        setAdvertisers(names)
        setStatus('success')
        setMessage(resp.message)

        if (isPopup) {
          // 弹窗：通知父窗口
          try {
            window.opener.postMessage(
              { type: 'ocean_engine_oauth_result', success: true, message: resp.message },
              window.location.origin
            )
            sessionStorage.setItem('ocean_engine_oauth_success', 'true')
            setTimeout(() => window.close(), 1800)
          } catch {
            setTimeout(() => navigate('/config'), 2000)
          }
        } else {
          setTimeout(() => navigate('/config'), 2500)
        }
      } catch (err: any) {
        console.error('[OE OAuth] 回调处理失败:', err)
        const msg = err?.response?.data?.detail || err?.message || '授权失败，请重试'
        setStatus('error')
        setMessage(msg)

        if (isPopup) {
          try {
            window.opener.postMessage(
              { type: 'ocean_engine_oauth_result', success: false, message: msg },
              window.location.origin
            )
            setTimeout(() => window.close(), 2500)
          } catch {
            setTimeout(() => navigate('/config'), 3000)
          }
        } else {
          setTimeout(() => navigate('/config'), 3500)
        }
      }
    }

    run()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        <div className="rounded-2xl border bg-card p-8 shadow-xl">
          <div className="flex flex-col items-center space-y-6">
            {/* 状态图标 */}
            {status === 'processing' && (
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary" />
            )}
            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-rose-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">
                {status === 'processing' && '处理中...'}
                {status === 'success' && '授权成功'}
                {status === 'error' && '授权失败'}
              </h2>
              <p className="text-muted-foreground text-sm">{message}</p>
            </div>

            {/* 成功时展示广告主列表 */}
            {status === 'success' && advertisers.length > 0 && (
              <div className="w-full rounded-xl border bg-muted/30 divide-y">
                {advertisers.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-foreground truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}

            {status === 'error' && (
              <button
                onClick={() => navigate('/config')}
                className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors text-sm"
              >
                返回配置页
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OceanEngineOAuthCallback
