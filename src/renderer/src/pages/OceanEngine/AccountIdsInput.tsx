import React from 'react'
import { Label, Textarea } from '../../components/ui'
import { parseAccountIds } from './pAssistantUtils'

interface AccountIdsInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export const AccountIdsInput: React.FC<AccountIdsInputProps> = ({
  value,
  onChange,
  placeholder = '在此输入或粘贴账户ID列表，每行一个...',
  disabled = false
}) => (
  <div>
    <Label>账户列表（一行一个）*</Label>
    <Textarea
      className="mt-2 min-h-[120px] font-mono text-sm"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDownCapture={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation()
        }
      }}
      disabled={disabled}
    />
    <p className="mt-1 text-sm text-muted-foreground">
      已输入 {parseAccountIds(value).length} 个账户
    </p>
  </div>
)
