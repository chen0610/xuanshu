import React, { useState } from 'react'
import { feishuService } from '../services/feishu.service'

interface FeishuBindButtonProps {
  /**
   * 按钮文本
   */
  text?: string
  /**
   * 按钮样式类名
   */
  className?: string
  /**
   * 按钮大小
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * 按钮变体
   */
  variant?: 'primary' | 'outline' | 'ghost'
  /**
   * 点击前的回调
   */
  onBeforeBind?: () => void
  /**
   * 绑定失败的回调
   */
  onError?: (error: Error) => void
}

/**
 * 飞书绑定按钮组件
 * 点击后启动飞书授权流程
 */
export const FeishuBindButton: React.FC<FeishuBindButtonProps> = ({
  text = '绑定飞书',
  className = '',
  size = 'md',
  variant = 'primary',
  onBeforeBind,
  onError
}) => {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)

      // 调用前置回调
      if (onBeforeBind) {
        onBeforeBind()
      }

      // 启动授权流程
      await feishuService.startAuthFlow()
      // 注意：这里会重定向，所以后续代码不会执行
    } catch (error: any) {
      console.error('绑定飞书失败:', error)
      setLoading(false)

      // 调用错误回调
      if (onError) {
        onError(error)
      }
    }
  }

  // 尺寸样式
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  // 变体样式
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-primary text-primary hover:bg-primary/10',
    ghost: 'text-primary hover:bg-primary/10'
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
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
          启动中...
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 mr-2"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
          {text}
        </>
      )}
    </button>
  )
}

export default FeishuBindButton
