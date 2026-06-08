import React from 'react'
import { AlertTriangle, FileText, Loader2, Square, Trash2 } from 'lucide-react'
import { Button } from '../../../../components/ui'
import type { ProjectCleanupPreviewResponse } from '../../../../services/ocean-engine.service'
import { ProjectCleanupStepSection } from './ProjectCleanupStepSection'

interface ProjectCleanupPreviewPanelProps {
  previewData: ProjectCleanupPreviewResponse['data'] | null
  isPreviewStale: boolean
  isPreviewing: boolean
  isDeleting: boolean
  canPreview: boolean
  canDelete: boolean
  onPreview: () => void
  onStopPreview: () => void
  onDelete: () => void
}

export const ProjectCleanupPreviewPanel: React.FC<ProjectCleanupPreviewPanelProps> = ({
  previewData,
  isPreviewStale,
  isPreviewing,
  isDeleting,
  canPreview,
  canDelete,
  onPreview,
  onStopPreview,
  onDelete
}) => {
  const hasPreview = previewData != null
  const eligibleCount = previewData?.eligible_count ?? 0

  return (
    <ProjectCleanupStepSection
      step={3}
      title="预览与执行"
      description="先预览待清理项目并确认数量，再提交删除任务。"
      className={hasPreview && !isPreviewStale && eligibleCount > 0 ? 'border-destructive/30' : undefined}
    >
      <div className="space-y-4">
        {isPreviewing && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>正在扫描项目，详细进度请查看底部日志面板…</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onStopPreview}>
              <Square className="mr-1 h-4 w-4" />
              停止预览
            </Button>
          </div>
        )}

        {hasPreview && !isPreviewing && (
          <div className="space-y-3">
            {isPreviewStale && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>筛选配置已变更，预览结果可能已过期，请重新预览后再执行删除。</span>
              </div>
            )}

            <div className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-3">
              <div className="text-center sm:text-left">
                <div className="text-xs text-muted-foreground">扫描项目</div>
                <div className="text-lg font-semibold">{previewData.total}</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-xs text-muted-foreground">待清理</div>
                <div className="text-lg font-semibold text-orange-600">{eligibleCount}</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-xs text-muted-foreground">预览展示</div>
                <div className="text-lg font-semibold">
                  前 {Math.min(previewData.projects.length, 20)} 条
                </div>
              </div>
            </div>

            {previewData.projects.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-md border bg-background">
                {previewData.projects.slice(0, 20).map((project) => (
                  <div
                    key={`${project.advertiser_id}-${project.project_id}`}
                    className="border-b px-3 py-2 text-sm last:border-b-0"
                  >
                    <div className="truncate font-medium">
                      {project.project_name || project.project_id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      账户 {project.advertiser_id} · 项目 {project.project_id} · 创建时间{' '}
                      {project.create_time}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                没有符合筛选条件的项目
              </div>
            )}
          </div>
        )}

        {!hasPreview && !isPreviewing && (
          <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            配置完成后点击「预览待清理项目」，系统将扫描并展示符合条件的项目。
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {!isPreviewing && (
            <>
              {hasPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPreview}
                  disabled={!canPreview || isDeleting}
                  className="sm:min-w-[140px]"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  重新预览
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onPreview}
                  disabled={!canPreview || isDeleting}
                  className="w-full sm:w-auto sm:min-w-[180px]"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  预览待清理项目
                </Button>
              )}
              {hasPreview && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={!canDelete || isDeleting}
                  className="w-full sm:w-auto sm:min-w-[180px]"
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {eligibleCount > 0
                    ? `确认删除 ${eligibleCount} 个项目`
                    : '提交项目清理任务'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </ProjectCleanupStepSection>
  )
}
