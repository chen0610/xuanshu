import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { feishuService } from '../services/feishu.service'

/**
 * 飞书授权回调页面
 * 处理飞书授权重定向回来的 code 和 state
 */
export const FeishuCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('正在处理授权...')

  useEffect(() => {
    const handleCallback = async () => {
      // 检查是否在弹窗中
      const isPopup = window.opener && window.opener !== window

      try {
        // 1. 获取回调参数
        const code = searchParams.get('code')
        const state = searchParams.get('state')

        if (!code || !state) {
          throw new Error('缺少授权参数')
        }

        // 2. 验证 state (防 CSRF)
        // state 格式可能是: "random_state" 或 "random_state:user_id"
        const stateToVerify = state.includes(':') ? state.split(':')[0] : state
        if (!feishuService.verifyCallbackState(stateToVerify)) {
          throw new Error('授权验证失败，请重试')
        }

        // 3. 调用后端接口完成绑定
        setMessage('正在绑定飞书账号...')
        await feishuService.handleCallback(code, state)

        // 4. 清除保存的 state
        feishuService.clearAuthState()

        // 5. 显示成功信息
        setStatus('success')
        setMessage('绑定成功！')

        if (isPopup) {
          // 弹窗模式: 通知父窗口并关闭
          try {
            // 通知父窗口
            window.opener.postMessage(
              {
                type: 'feishu_auth_result',
                success: true,
                message: '绑定成功'
              },
              window.location.origin
            )

            // 记录成功状态(备用)
            sessionStorage.setItem('feishu_auth_success', 'true')

            // 延迟关闭窗口,让用户看到成功消息
            setTimeout(() => {
              window.close()
            }, 1500)
          } catch (e) {
            console.error('通知父窗口失败:', e)
            // 如果通知失败,跳转到配置页面
            setTimeout(() => {
              navigate('/config')
            }, 2000)
          }
        } else {
          // 普通模式: 跳转到配置页面
          setTimeout(() => {
            navigate('/config')
          }, 2000)
        }
      } catch (error: any) {
        console.error('处理飞书授权回调失败:', error)
        setStatus('error')
        setMessage(error.message || error.detail || '绑定失败，请重试')

        if (isPopup) {
          // 弹窗模式: 通知父窗口错误
          try {
            window.opener.postMessage(
              {
                type: 'feishu_auth_result',
                success: false,
                message: error.message || error.detail || '绑定失败'
              },
              window.location.origin
            )

            setTimeout(() => {
              window.close()
            }, 2000)
          } catch (e) {
            setTimeout(() => {
              navigate('/config')
            }, 3000)
          }
        } else {
          // 普通模式: 跳转回配置页面
          setTimeout(() => {
            navigate('/config')
          }, 3000)
        }
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        <div className="rounded-lg border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center space-y-6">
            {/* 状态图标 */}
            {status === 'processing' && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
            )}

            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-green-600 dark:text-green-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}

            {status === 'error' && (
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-600 dark:text-red-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            )}

            {/* 标题 */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">
                {status === 'processing' && '授权处理中'}
                {status === 'success' && '授权成功'}
                {status === 'error' && '授权失败'}
              </h2>
              <p className="text-muted-foreground">{message}</p>
            </div>

            {/* 操作按钮（仅错误时显示） */}
            {status === 'error' && (
              <button
                onClick={() => navigate('/config')}
                className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                返回配置
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeishuCallback
