import React from 'react'
import { Label, Textarea } from '../../../../components/ui'
import { parseAccountIds } from '../../pAssistantUtils'
import {
  CLEANUP_MAX_ACCOUNT_COUNT,
  enforceMaxAccountIdsText
} from '../shared/cleanupOrgConfig'
import { ProjectCleanupStepSection } from './ProjectCleanupStepSection'

interface ProjectCleanupScopeSectionProps {
  selectedOrgName: string
  selectedOrgEbpId: string
  accountIds: string
  onAccountIdsChange: (value: string) => void
  disabled: boolean
}

export const ProjectCleanupScopeSection: React.FC<ProjectCleanupScopeSectionProps> = ({
  selectedOrgName,
  selectedOrgEbpId,
  accountIds,
  onAccountIdsChange,
  disabled
}) => {
  const accountCount = parseAccountIds(accountIds).length
  const selectedOrgLabel = selectedOrgEbpId
    ? `${selectedOrgName || selectedOrgEbpId}（${selectedOrgEbpId}）`
    : '请先在页面顶部选择组织节点'

  return (
    <ProjectCleanupStepSection
      step={1}
      title="清理范围"
      description="沿用页面顶部当前组织节点，再输入指定账户列表。"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>当前组织节点 *</Label>
          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {selectedOrgLabel}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-assistant-project-cleanup-account-ids">指定账户列表（一行一个）*</Label>
          <Textarea
            id="p-assistant-project-cleanup-account-ids"
            placeholder="请输入需要清理项目的账户ID，每行一个..."
            value={accountIds}
            onChange={(e) => onAccountIdsChange(enforceMaxAccountIdsText(e.target.value))}
            disabled={disabled}
            className="min-h-[100px] resize-y font-mono text-sm"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            已输入 {accountCount} / {CLEANUP_MAX_ACCOUNT_COUNT} 个账户
            {accountCount >= CLEANUP_MAX_ACCOUNT_COUNT && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">（已达上限）</span>
            )}
          </p>
        </div>
      </div>
    </ProjectCleanupStepSection>
  )
}
