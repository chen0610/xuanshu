import React, { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Tag } from 'lucide-react'
import { Button, Label } from '../../../../components/ui'
import { AccountIdsInput } from '../../AccountIdsInput'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { PAssistantResultPanel } from '../../PAssistantResultPanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  pAssistantServiceExtended,
  type PATagInfo,
  type TagModifyResponse
} from '../../../../services/ocean-engine.service'

export const TagTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [tagAccountIds, setTagAccountIds] = usePersistedState<string>(
    'p-assistant-tag-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [availableTags, setAvailableTags] = useState<PATagInfo[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagEditMode, setTagEditMode] = useState<'add' | 'delete'>('add')
  const [tagResults, setTagResults] = useState<TagModifyResponse | null>(null)
  const [loadingTags, setLoadingTags] = useState(false)

  const loadTags = async (): Promise<void> => {
    if (!selectedConfigId) return

    setLoadingTags(true)
    try {
      const result = await pAssistantServiceExtended.getTagList(selectedConfigId)
      if (result.code === 0 && result.data?.tags) {
        const tagsWithStringIds = result.data.tags.map((tag) => ({
          ...tag,
          id: String(tag.id)
        }))
        setAvailableTags(tagsWithStringIds)
        addLog(`成功加载 ${tagsWithStringIds.length} 个标签`, 'success')
      } else {
        addLog(`加载标签失败: ${result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败'
      addLog(`加载标签失败: ${errorMessage}`, 'error')
    } finally {
      setLoadingTags(false)
    }
  }

  useEffect(() => {
    if (selectedConfigId) {
      loadTags()
    }
  }, [selectedConfigId])

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const handleModifyTags = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个配置')
      return
    }

    if (!tagAccountIds.trim()) {
      setError('请输入账户ID列表')
      return
    }

    if (selectedTagIds.length === 0) {
      setError('请至少选择一个标签')
      return
    }

    const accountIdList = parseAccountIds(tagAccountIds)
    if (accountIdList.length === 0) {
      setError('请至少输入一个账户ID')
      return
    }

    // 删除模式：二次确认
    if (tagEditMode === 'delete') {
      const selectedTags = availableTags.filter((tag) => selectedTagIds.includes(tag.id))
      const confirmMessage = `⚠️ 警告：删除标签操作不可逆！\n\n此操作将从所有指定账户中删除选中的 ${selectedTags.length} 个标签：\n${selectedTags.map((tag) => tag.value).join(', ')}\n\n删除后无法恢复，请谨慎操作。\n\n确定要继续吗？`

      if (!window.confirm(confirmMessage)) {
        return
      }
    }

    setLoading(true)
    setError('')
    setTagResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      `开始${tagEditMode === 'add' ? '新增' : '删除'}标签，共 ${accountIdList.length} 个账户`,
      'info'
    )

    try {
      const selectedTags = availableTags.filter((tag) => selectedTagIds.includes(tag.id))
      const result = await runPAssistantJob<TagModifyResponse>('tag_modify', {
        account_ids: accountIdList,
        tag_ids: selectedTags.map((tag) => String(tag.id)),
        tag_values: selectedTags.map((tag) => tag.value),
        edit_mode: tagEditMode,
        selected_cookie_id: selectedConfigId
      })

      setTagResults(result)

      if (result.code === 0 && result.data) {
        const { total_success, total_error, results } = result.data
        addLog(
          `标签${tagEditMode === 'add' ? '新增' : '删除'}完成：成功 ${total_success} 个，失败 ${total_error} 个`,
          total_error === 0 ? 'success' : 'error'
        )

        results.forEach((r) => {
          if (r.success) {
            addLog(
              `账户 ${r.account_id}: 标签${tagEditMode === 'add' ? '新增' : '删除'}成功`,
              'success'
            )
          } else {
            addLog(
              `账户 ${r.account_id}: 标签${tagEditMode === 'add' ? '新增' : '删除'}失败 - ${r.error || '未知错误'}`,
              'error'
            )
          }
        })
      } else {
        addLog(`标签修改失败: ${result.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '修改失败'
      setError(errorMessage)
      addLog(`标签修改失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="批量修改标签"
      description="批量为账户新增或删除标签"
      icon={<Tag />}
    >
      <AccountIdsInput
        value={tagAccountIds}
        onChange={setTagAccountIds}
        placeholder="请输入需要修改标签的账户ID，每行一个..."
      />
      <div>
        <Label htmlFor="tag-edit-mode">编辑方式</Label>
        <select
          id="tag-edit-mode"
          className="px-3 py-2 mt-2 w-full rounded-md border bg-background"
          value={tagEditMode}
          onChange={(e) => setTagEditMode(e.target.value as 'add' | 'delete')}
        >
          <option value="add">新增</option>
          <option value="delete">删除</option>
        </select>
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label>标签列表</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTags}
            disabled={loadingTags || !selectedConfigId}
          >
            {loadingTags ? (
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
          {loadingTags ? (
            <div className="flex gap-2 justify-center items-center p-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : availableTags.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无标签，请先刷新标签列表
            </div>
          ) : (
            <>
              {/* 全选和统计 */}
              <div className="flex justify-between items-center p-3 border-b bg-muted/50">
                <label className="flex gap-2 items-center p-1 rounded transition-colors cursor-pointer hover:bg-accent/50">
                  <input
                    type="checkbox"
                    checked={
                      availableTags.length > 0 &&
                      selectedTagIds.length === availableTags.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTagIds(availableTags.map((tag) => tag.id))
                      } else {
                        setSelectedTagIds([])
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                  <span className="text-sm font-medium">全选 ({availableTags.length})</span>
                </label>
                <span className="text-sm text-muted-foreground">
                  已选: {selectedTagIds.length}
                </span>
              </div>

              {/* 标签列表 */}
              <div className="overflow-y-auto p-3 max-h-60">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 lg:grid-cols-4">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id)
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
                              setSelectedTagIds([...selectedTagIds, tag.id])
                            } else {
                              setSelectedTagIds(
                                selectedTagIds.filter((id) => id !== tag.id)
                              )
                            }
                          }}
                          className="flex-shrink-0 w-4 h-4 rounded border-gray-300 cursor-pointer text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        />
                        <span
                          className={`flex-1 text-sm truncate ${
                            isSelected ? 'font-medium text-primary' : 'text-foreground'
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
      <Button
        onClick={handleModifyTags}
        disabled={
          loading ||
          !selectedConfigId ||
          !tagAccountIds.trim() ||
          selectedTagIds.length === 0
        }
        className="w-full"
        variant={tagEditMode === 'delete' ? 'destructive' : 'default'}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            {tagEditMode === 'delete' ? '删除中...' : '修改中...'}
          </>
        ) : (
          <>
            <Tag className="mr-2 w-4 h-4" />
            {tagEditMode === 'delete' ? '确认删除标签' : '确认修改标签'}
          </>
        )}
      </Button>

      {/* 标签修改结果 */}
      {tagResults && tagResults.data && (
        <PAssistantResultPanel
          title="修改结果"
          totalSuccess={tagResults.data.total_success}
          totalError={tagResults.data.total_error}
          results={tagResults.data.results}
          copyToClipboard={copyToClipboard}
          renderSuccessMessage={() =>
            tagEditMode === 'add' ? '标签新增成功' : '标签删除成功'
          }
        />
      )}
    </PAssistantFeaturePanel>
  )
}
