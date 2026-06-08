import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label,
  Checkbox
} from '../../../../components/ui'
import { MapPin, HelpCircle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { SearchAdFormData } from '../../SearchAdCreatePage'

interface TargetingConfigStepProps {
  formData: SearchAdFormData
  onUpdate: (updates: Partial<SearchAdFormData>) => void
  onValidate: () => void
}

// 分段按钮组件
const SegmentedButton: React.FC<{
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}> = ({ value, options, onChange, className, disabled = false }) => {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border bg-background p-1',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => !disabled && onChange(option.value)}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-sm transition-colors',
            disabled && 'cursor-not-allowed',
            value === option.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const AGE_RANGES = [
  { value: '18-23', label: '18-23' },
  { value: '24-30', label: '24-30' },
  { value: '31-40', label: '31-40' },
  { value: '41-49', label: '41-49' },
  { value: '50+', label: '50+' }
]

export const TargetingConfigStep: React.FC<TargetingConfigStepProps> = ({
  formData,
  onUpdate,
  onValidate
}) => {
  React.useEffect(() => {
    onValidate()
  }, [onValidate])

  // 暂时禁用编辑
  const isDisabled = true

  const handleAgeToggle = (ageRange: string): void => {
    if (isDisabled) return
    const isCurrentlySelected = formData.age.includes(ageRange)
    const newAge = isCurrentlySelected
      ? formData.age.filter((a) => a !== ageRange)
      : [...formData.age, ageRange]
    onUpdate({ age: newAge })
  }

  const handleAgeUnlimited = (): void => {
    if (isDisabled) return
    onUpdate({ age: [] })
  }

  const isAgeUnlimited = formData.age.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3 items-center">
          <MapPin className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>定向配置</CardTitle>
            <CardDescription>配置广告的定向条件</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 地域 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>地域</Label>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <SegmentedButton
            value={formData.geographicLocation}
            options={[
              { value: 'unlimited', label: '不限' },
              { value: 'administrative', label: '按行政区域划分' },
              { value: 'business', label: '按商圈' }
            ]}
            onChange={(value) => onUpdate({ geographicLocation: value })}
            disabled={isDisabled}
          />
        </div>

        {/* 性别 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>性别</Label>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <SegmentedButton
            value={formData.gender}
            options={[
              { value: 'unlimited', label: '不限' },
              { value: 'male', label: '男' },
              { value: 'female', label: '女' }
            ]}
            onChange={(value) => onUpdate({ gender: value })}
            disabled={isDisabled}
          />
        </div>

        {/* 年龄 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>年龄</Label>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            <div
              className={cn(
                'inline-flex rounded-md border bg-background p-1',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <button
                type="button"
                onClick={handleAgeUnlimited}
                disabled={isDisabled}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-sm transition-colors',
                  isDisabled && 'cursor-not-allowed',
                  isAgeUnlimited
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                不限
              </button>
            </div>
            {!isAgeUnlimited && (
              <div className={cn('flex flex-wrap gap-3 pt-2', isDisabled && 'opacity-50')}>
                {AGE_RANGES.map((range) => (
                  <div key={range.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`age-${range.value}`}
                      checked={formData.age.includes(range.value)}
                      onCheckedChange={() => handleAgeToggle(range.value)}
                      disabled={isDisabled}
                    />
                    <Label
                      htmlFor={`age-${range.value}`}
                      className={cn('cursor-pointer', isDisabled && 'cursor-not-allowed')}
                    >
                      {range.label}
                    </Label>
                  </div>
                ))}
                <button
                  type="button"
                  className={cn(
                    'text-sm text-primary hover:underline',
                    isDisabled && 'cursor-not-allowed opacity-50'
                  )}
                  disabled={isDisabled}
                >
                  更多分段
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 自定义人群 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>自定义人群</Label>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <SegmentedButton
            value={formData.customAudience}
            options={[
              { value: 'unlimited', label: '不限' },
              { value: 'custom', label: '自定义' },
              { value: 'manage', label: '管理自定义人群' }
            ]}
            onChange={(value) => onUpdate({ customAudience: value })}
            disabled={isDisabled}
          />
        </div>

        {/* 已安装用户 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>已安装用户</Label>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <SegmentedButton
            value={formData.installedUsers}
            options={[
              { value: 'unlimited', label: '不限' },
              { value: 'filter', label: '过滤' }
            ]}
            onChange={(value) => onUpdate({ installedUsers: value })}
            disabled={isDisabled}
          />
        </div>

        {/* 过滤已转化用户 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>过滤已转化用户</Label>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <SegmentedButton
            value={formData.filterConvertedUsers}
            options={[
              { value: 'unlimited', label: '不限' },
              { value: 'unit', label: '单元' },
              { value: 'project', label: '项目' },
              { value: 'account', label: '投放账户' },
              { value: 'company', label: '公司账户' },
              { value: 'organization', label: '组织账户' },
              { value: 'application', label: '应用' }
            ]}
            onChange={(value) => onUpdate({ filterConvertedUsers: value })}
            disabled={isDisabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}
