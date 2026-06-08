import React, { useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label,
  Checkbox
} from '../../../../components/ui'
import { Layout } from 'lucide-react'

interface PlacementConfigStepProps {
  siteSet: number[]
  autoSitesetSwitch: boolean
  onUpdate: (updates: { siteSet: number[]; autoSitesetSwitch: boolean }) => void
}

const PLACEMENT_OPTIONS = [
  { id: 115, name: '智能优选', description: '主要基于每一次的投放广告' },
  { id: 136, name: '优选位置', description: '基于优选已合作的外部联盟流量进行广告' },
  { id: 118, name: 'QQ浏览器', description: '基于QQ浏览器及合作伙伴流量投放的视频广告' }
]

const DEFAULT_SITE_SET = PLACEMENT_OPTIONS.map((opt) => opt.id)

export const PlacementConfigStep: React.FC<PlacementConfigStepProps> = ({
  siteSet,
  autoSitesetSwitch,
  onUpdate
}) => {
  // 默认选中所有版位
  useEffect(() => {
    if (siteSet.length === 0) {
      onUpdate({ siteSet: DEFAULT_SITE_SET, autoSitesetSwitch: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlacementToggle = (placementId: number): void => {
    const newSiteSet = siteSet.includes(placementId)
      ? siteSet.filter((id) => id !== placementId)
      : [...siteSet, placementId]
    onUpdate({ siteSet: newSiteSet, autoSitesetSwitch: false })
  }

  const handleSelectAll = (): void => {
    if (siteSet.length === PLACEMENT_OPTIONS.length) {
      onUpdate({ siteSet: [], autoSitesetSwitch: false })
    } else {
      onUpdate({
        siteSet: PLACEMENT_OPTIONS.map((opt) => opt.id),
        autoSitesetSwitch: false
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3 items-center">
          <Layout className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>广告版位配置</CardTitle>
            <CardDescription>选择广告投放的版位</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>选择版位 *</Label>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-sm text-primary hover:underline"
          >
            {siteSet.length === PLACEMENT_OPTIONS.length ? '取消全选' : '全选'}
          </button>
        </div>

        <div className="space-y-3">
          {PLACEMENT_OPTIONS.map((option) => (
            <div
              key={option.id}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                siteSet.includes(option.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
              onClick={() => handlePlacementToggle(option.id)}
            >
              <div className="flex gap-3 items-start">
                <Checkbox
                  checked={siteSet.includes(option.id)}
                  onCheckedChange={() => handlePlacementToggle(option.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{option.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{option.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {siteSet.length > 0 && (
          <div className="p-3 rounded-md bg-muted">
            <p className="text-sm">
              <span className="font-medium">已选择 {siteSet.length} 个版位</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
