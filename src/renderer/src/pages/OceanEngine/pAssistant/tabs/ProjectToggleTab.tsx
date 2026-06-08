import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, Loader2, Sparkles, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea
} from '../../../../components/ui'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  dataAssistantService,
  type ProjectToggleResponse,
  type TagInfo
} from '../../../../services/ocean-engine.service'

export const ProjectToggleTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  // 项目启停相关状态
  const [projectToggleAction, setProjectToggleAction] = useState<'暂停' | '开启'>('暂停')
  const [projectToggleDimension, setProjectToggleDimension] = usePersistedState<'tag' | 'account'>(
    'p-assistant-project-toggle-dimension',
    'tag',
    {
      deserialize: (raw) => (raw === 'account' ? 'account' : 'tag')
    }
  )
  const [projectToggleKeyword, setProjectToggleKeyword] = useState<string>('')
  const [projectToggleAvailableTags, setProjectToggleAvailableTags] = useState<TagInfo[]>([])
  const [projectToggleSelectedTagIds, setProjectToggleSelectedTagIds] = useState<string[]>([])
  const [projectToggleTagsLoading, setProjectToggleTagsLoading] = useState(false)
  const [projectToggleAccountIds, setProjectToggleAccountIds] = usePersistedState<string>(
    'p-assistant-project-toggle-accounts',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [projectToggleResults, setProjectToggleResults] = useState<ProjectToggleResponse | null>(
    null
  )

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const loadProjectToggleTags = async (): Promise<void> => {
    if (!selectedConfigId) return

    setProjectToggleTagsLoading(true)
    try {
      const result = await dataAssistantService.getAccountTags(selectedConfigId)
      if (result.code === 0 && result.data?.tags) {
        const tagsWithStringIds = result.data.tags.map((tag) => ({
          ...tag,
          id: String(tag.id)
        }))
        setProjectToggleAvailableTags(tagsWithStringIds)
        addLog(`成功加载 ${tagsWithStringIds.length} 个标签`, 'success')
      } else {
        addLog(`加载标签失败: ${result.msg || result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败'
      addLog(`加载标签失败: ${errorMessage}`, 'error')
    } finally {
      setProjectToggleTagsLoading(false)
    }
  }

  // 切换到此 Tab 时自动加载标签
  useEffect(() => {
    if (selectedConfigId) {
      loadProjectToggleTags()
    }
  }, [selectedConfigId])

  const handleProjectToggleSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }
    const accountIdList =
      projectToggleDimension === 'account' ? parseAccountIds(projectToggleAccountIds) : []
    if (projectToggleDimension === 'account' && accountIdList.length === 0) {
      setError('请输入账户ID列表')
      return
    }

    const selectedTags =
      projectToggleDimension === 'tag'
        ? projectToggleAvailableTags.filter((tag) => projectToggleSelectedTagIds.includes(tag.id))
        : []
    const tagText = selectedTags.map((tag) => tag.value).join(', ')
    const keywordValue = projectToggleKeyword.trim()

    setLoading(true)
    setError('')
    setProjectToggleResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      `开始项目启停：操作=${projectToggleAction}，标签=${tagText || '无'}，关键字=${
        keywordValue || '无'
      }`,
      'info'
    )

    try {
      const response = await runPAssistantJob<ProjectToggleResponse>('project_toggle', {
        selected_cookie_id: selectedConfigId,
        action: projectToggleAction === '暂停' ? 'pause' : 'enable',
        dimension: projectToggleDimension,
        tag_ids: projectToggleDimension === 'tag' ? projectToggleSelectedTagIds : undefined,
        account_ids: projectToggleDimension === 'account' ? accountIdList : undefined,
        keyword: keywordValue
      })

      setProjectToggleResults(response)

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '项目启停失败')
      }

      if (response.data) {
        addLog(
          `项目启停完成：成功 ${response.data.total_success}，失败 ${response.data.total_error}`,
          response.data.total_error === 0 ? 'success' : 'info'
        )

        response.data.batch_results.forEach((batch) => {
          if (batch.error) {
            addLog(`批次 ${batch.batch_index}: ${batch.error}`, 'error')
          } else if (batch.error_count > 0) {
            addLog(`批次 ${batch.batch_index}: 失败 ${batch.error_count} 个项目`, 'error')
          }
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '项目启停失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className="border-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            项目启停
          </CardTitle>
          <CardDescription>按标签或指定账户批量暂停或开启项目</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">操作方向 *</Label>
            <RadioGroup
              value={projectToggleAction}
              onValueChange={(value) => setProjectToggleAction(value as '暂停' | '开启')}
              disabled={loading}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="暂停" id="project-toggle-pause" />
                <Label htmlFor="project-toggle-pause" className="cursor-pointer">
                  暂停
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="开启" id="project-toggle-enable" />
                <Label htmlFor="project-toggle-enable" className="cursor-pointer">
                  开启
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold">筛选维度 *</Label>
            <RadioGroup
              value={projectToggleDimension}
              onValueChange={(value) =>
                setProjectToggleDimension(value as 'tag' | 'account')
              }
              disabled={loading}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tag" id="project-toggle-dimension-tag" />
                <Label htmlFor="project-toggle-dimension-tag" className="cursor-pointer">
                  标签维度
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="account" id="project-toggle-dimension-account" />
                <Label
                  htmlFor="project-toggle-dimension-account"
                  className="cursor-pointer"
                >
                  指定账户维度
                </Label>
              </div>
            </RadioGroup>
          </div>

          {projectToggleDimension === 'tag' ? (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>标签筛选（同时满足）</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadProjectToggleTags}
                  disabled={projectToggleTagsLoading || !selectedConfigId}
                >
                  {projectToggleTagsLoading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    '刷新标签'
                  )}
                </Button>
              </div>
              <div className="rounded-md border bg-muted/30">
                {projectToggleTagsLoading ? (
                  <div className="flex gap-2 justify-center items-center p-8 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>加载中...</span>
                  </div>
                ) : projectToggleAvailableTags.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    暂无标签，请先刷新标签列表
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center p-3 border-b bg-muted/50">
                      <label className="flex gap-2 items-center p-1 rounded transition-colors cursor-pointer hover:bg-accent/50">
                        <input
                          type="checkbox"
                          checked={
                            projectToggleAvailableTags.length > 0 &&
                            projectToggleSelectedTagIds.length ===
                              projectToggleAvailableTags.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setProjectToggleSelectedTagIds(
                                projectToggleAvailableTags.map((tag) => tag.id)
                              )
                            } else {
                              setProjectToggleSelectedTagIds([])
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        />
                        <span className="text-sm font-medium">
                          全选 ({projectToggleAvailableTags.length})
                        </span>
                      </label>
                      <span className="text-sm text-muted-foreground">
                        已选: {projectToggleSelectedTagIds.length}
                      </span>
                    </div>

                    <div className="overflow-y-auto p-3 max-h-60">
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                        {projectToggleAvailableTags.map((tag) => {
                          const isSelected = projectToggleSelectedTagIds.includes(tag.id)
                          return (
                            <label
                              key={tag.id}
                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all border ${
                                isSelected
                                  ? 'bg-primary/10 border-primary/30 hover:bg-primary/15'
                                  : 'border-border hover:bg-accent/50 hover:border-primary/20'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProjectToggleSelectedTagIds([
                                      ...projectToggleSelectedTagIds,
                                      tag.id
                                    ])
                                  } else {
                                    setProjectToggleSelectedTagIds(
                                      projectToggleSelectedTagIds.filter(
                                        (id) => id !== tag.id
                                      )
                                    )
                                  }
                                }}
                                className="flex-shrink-0 w-4 h-4 rounded border-gray-300 cursor-pointer text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              />
                              <span
                                className={`flex-1 text-sm truncate ${
                                  isSelected
                                    ? 'font-medium text-primary'
                                    : 'text-foreground'
                                }`}
                                title={tag.value}
                              >
                                {tag.value}
                              </span>
                              {isSelected && (
                                <CheckCircle className="flex-shrink-0 w-4 h-4 text-primary" />
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label
                htmlFor="project-toggle-account-ids"
                className="text-base font-semibold"
              >
                账户列表（一行一个） *
              </Label>
              <Textarea
                id="project-toggle-account-ids"
                placeholder="请输入需要启停的账户ID，每行一个..."
                value={projectToggleAccountIds}
                onChange={(e) => setProjectToggleAccountIds(e.target.value)}
                disabled={loading}
                className="min-h-[100px] resize-y"
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                已输入 {parseAccountIds(projectToggleAccountIds).length} 个账户
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="project-toggle-keyword" className="text-base font-semibold">
              关键字
            </Label>
            <Input
              id="project-toggle-keyword"
              placeholder="请输入关键字"
              value={projectToggleKeyword}
              onChange={(e) => setProjectToggleKeyword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleProjectToggleSubmit}
              disabled={loading || !selectedConfigId}
              size="lg"
              className="min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  操作中...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 w-4 h-4" />
                  确认操作
                </>
              )}
            </Button>
          </div>

          {projectToggleResults && projectToggleResults.data && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 mt-4 rounded-lg border bg-muted/50"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">操作结果</h4>
                <div className="flex gap-2 items-center">
                  <div className="flex gap-2 text-sm">
                    <span className="text-green-600">
                      成功: {projectToggleResults.data.total_success}
                    </span>
                    <span className="text-red-600">
                      失败: {projectToggleResults.data.total_error}
                    </span>
                    <span className="text-muted-foreground">
                      总数: {projectToggleResults.data.total_projects}
                    </span>
                  </div>
                  {projectToggleResults.data.total_error > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const failedIds = projectToggleResults.data!.batch_results
                          .flatMap((batch) => batch.failed_ids || [])
                          .filter((id) => id)
                          .join('\n')
                        if (failedIds) {
                          copyToClipboard(failedIds)
                        }
                      }}
                      className="text-xs"
                    >
                      复制失败项目ID
                    </Button>
                  )}
                </div>
              </div>
              <div className="overflow-y-auto space-y-1 max-h-60">
                {projectToggleResults.data.batch_results.map((batch) => (
                  <div
                    key={batch.batch_index}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      batch.error || batch.error_count > 0
                        ? 'bg-red-50 dark:bg-red-950/20'
                        : 'bg-green-50 dark:bg-green-950/20'
                    }`}
                  >
                    <span className="font-mono">批次 {batch.batch_index}</span>
                    <div className="flex gap-2 items-center">
                      {batch.error || batch.error_count > 0 ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-red-600">
                            {batch.error ? batch.error : `失败 ${batch.error_count} 个项目`}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">
                            成功 {batch.success_count} 个项目
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
