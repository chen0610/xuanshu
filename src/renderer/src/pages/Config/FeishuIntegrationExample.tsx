import React from 'react'
import { FeishuBindingCard } from '../../components/FeishuBindingCard'

/**
 * 飞书集成示例页面
 *
 * 展示如何在配置页面中使用飞书绑定组件
 * 这个文件可以作为参考,将组件集成到实际的配置页面中
 */
export const FeishuIntegrationExample: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">第三方集成</h1>
        <p className="text-muted-foreground">管理与第三方服务的集成和授权</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 飞书绑定卡片 */}
        <FeishuBindingCard />

        {/* 其他集成可以在这里添加 */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
              <span className="text-white text-lg">?</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold">更多集成</h3>
              <p className="text-sm text-muted-foreground">敬请期待</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">未来我们将支持更多第三方服务集成...</p>
        </div>
      </div>
    </div>
  )
}

export default FeishuIntegrationExample
