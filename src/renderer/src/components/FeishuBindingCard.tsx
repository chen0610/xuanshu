import React, { useState, useEffect } from 'react'
import { feishuService } from '../services/feishu.service'
import type { FeishuBindingInfo } from '../types/feishu.types'

/**
 * 飞书绑定卡片组件
 * 显示飞书绑定状态，提供绑定/解绑功能
 */
export const FeishuBindingCard: React.FC = () => {
  const [bindingInfo, setBindingInfo] = useState<FeishuBindingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载绑定信息
  const loadBindingInfo = async () => {
    try {
      setLoading(true)
      setError(null)
      const info = await feishuService.getBindingInfo()
      setBindingInfo(info)
    } catch (err: any) {
      console.error('加载飞书绑定信息失败:', err)
      setError(err.message || err.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时加载
  useEffect(() => {
    loadBindingInfo()
  }, [])

  // 开始绑定流程
  const handleBind = async () => {
    try {
      setActionLoading(true)
      setError(null)

      // 启动授权流程
      const result = await feishuService.startAuthFlow()

      if (result.success) {
        // 检测是否是 Electron 环境
        const isElectron = !!(window as any).electron || !!(window as any).api

        if (isElectron && result.message) {
          // Electron 环境: 显示信息提示
          // 使用 alert 提示用户
          // alert(
          //   '授权页面已在浏览器中打开\n\n' +
          //   '请在浏览器中完成授权后，\n' +
          //   '返回此页面并点击“刷新”按钮查看绑定状态'
          // )
          // 重新加载绑定信息(万一用户已经在浏览器中完成了)
          await loadBindingInfo()
        } else {
          // 浏览器环境: 授权成功,重新加载绑定信息
          await loadBindingInfo()
        }
      }
    } catch (err: any) {
      console.error('飞书授权失败:', err)
      setError(err.message || err.detail || '授权失败,请重试')
    } finally {
      setActionLoading(false)
    }
  }

  // 解除绑定
  const handleUnbind = async () => {
    if (!window.confirm('确定要解除飞书绑定吗？')) {
      return
    }

    try {
      setActionLoading(true)
      setError(null)
      await feishuService.unbind()
      // 重新加载绑定信息
      await loadBindingInfo()
    } catch (err: any) {
      console.error('解除绑定失败:', err)
      setError(err.message || err.detail || '解除绑定失败')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 rounded-lg border bg-card">
        <div className="flex justify-center items-center py-8">
          <div className="w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-lg border bg-card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex justify-center items-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold">飞书账号</h3>
            <p className="text-sm text-muted-foreground">
              {bindingInfo?.is_bound ? '已绑定' : '未绑定'}
            </p>
          </div>
        </div>

        {bindingInfo?.is_bound ? (
          <span className="px-3 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full dark:bg-green-900 dark:text-green-200">
            已激活
          </span>
        ) : (
          <span className="px-3 py-1 text-xs font-medium text-gray-800 bg-gray-100 rounded-full dark:bg-gray-800 dark:text-gray-200">
            未绑定
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {bindingInfo?.is_bound && bindingInfo.feishu_user ? (
        <div className="space-y-4">
          {/* 用户信息展示 */}
          <div className="flex items-center p-4 space-x-4 rounded-lg bg-muted/50">
            {bindingInfo.feishu_user.avatar_url && (
              <img
                src={bindingInfo.feishu_user.avatar_url}
                alt="Avatar"
                className="w-12 h-12 rounded-full"
              />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {bindingInfo.feishu_user.name || bindingInfo.feishu_user.en_name || '飞书用户'}
              </p>
              {bindingInfo.feishu_user.email && (
                <p className="text-sm text-muted-foreground">{bindingInfo.feishu_user.email}</p>
              )}
              {bindingInfo.feishu_user.mobile && (
                <p className="text-sm text-muted-foreground">{bindingInfo.feishu_user.mobile}</p>
              )}
            </div>
          </div>

          {/* 绑定时间 */}
          {bindingInfo.bound_at && (
            <div className="text-xs text-muted-foreground">
              绑定时间: {new Date(bindingInfo.bound_at).toLocaleString('zh-CN')}
            </div>
          )}

          {/* 解绑按钮 */}
          <button
            onClick={handleUnbind}
            disabled={actionLoading}
            className="px-4 py-2 w-full rounded-lg border transition-colors border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? '处理中...' : '解除绑定'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            绑定飞书账号后，您可以使用飞书相关功能，如消息推送、日历同步等。
          </p>

          <button
            onClick={handleBind}
            disabled={actionLoading}
            className="flex justify-center items-center px-4 py-2 w-full rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? (
              <>
                <svg
                  className="mr-2 -ml-1 w-4 h-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                等待授权...
              </>
            ) : (
              '绑定飞书账号'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default FeishuBindingCard
