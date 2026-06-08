import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label,
  Textarea
} from '../../../../components/ui'
import { Building2 } from 'lucide-react'

interface AccountConfigStepProps {
  configId: number | null
  advertiserId: string | null
  onSelect: (advertiserId: string) => void
}

export const AccountConfigStep: React.FC<AccountConfigStepProps> = ({
  configId,
  advertiserId,
  onSelect
}) => {
  const handleChange = (value: string): void => {
    onSelect(value)
  }

  // 解析输入的账户ID，过滤空行和空白字符
  const parseAccountIds = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  const accountIds = advertiserId ? parseAccountIds(advertiserId) : []
  const accountCount = accountIds.length

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3 items-center">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>广告账户配置</CardTitle>
            <CardDescription>输入广告账户ID，一行一个</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configId ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>请先完成Cookie配置</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>广告账户ID *</Label>
              <Textarea
                placeholder="请输入广告账户ID，一行一个&#10;例如：&#10;72715865&#10;72715866&#10;72715867"
                value={advertiserId || ''}
                onChange={(e) => handleChange(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                每行输入一个广告账户ID，系统会自动过滤空行
              </p>
            </div>
            {accountCount > 0 && (
              <div className="p-3 rounded-md bg-muted">
                <p className="text-sm">
                  <span className="font-medium">已输入 {accountCount} 个账户ID:</span>
                </p>
                <div className="mt-2 space-y-1">
                  {accountIds.map((id, index) => (
                    <div key={index} className="text-sm font-mono text-muted-foreground">
                      • {id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
