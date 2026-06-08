import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label
} from '../../../../components/ui'
import { Cookie } from 'lucide-react'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface CookieConfigStepProps {
  configs: Config[]
  selectedConfigId: number | null
  onSelect: (configId: number | null) => void
}

export const CookieConfigStep: React.FC<CookieConfigStepProps> = ({
  configs,
  selectedConfigId,
  onSelect
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3 items-center">
          <Cookie className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>Cookie配置</CardTitle>
            <CardDescription>选择用于创建广告的账号Cookie配置</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {configs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>暂无可用配置</p>
            <p className="text-sm mt-2">请先在配置中心添加腾讯账号Cookie</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>选择Cookie配置 *</Label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={selectedConfigId || ''}
              onChange={(e) => onSelect(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">请选择Cookie配置</option>
              {configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.cookie_name} {config.realname && `(${config.realname})`}
                </option>
              ))}
            </select>
            {selectedConfigId && (
              <p className="text-sm text-muted-foreground mt-2">已选择配置ID: {selectedConfigId}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
