import React, { useEffect, useState } from 'react'
import { Copy, Loader2, RefreshCw, Search } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { usePAssistantContext } from '../PAssistantContext'
import {
  pAssistantServiceExtended,
  type AccountAssetInfo,
  type AssetShareResponse
} from '../../../../services/ocean-engine.service'

const DEFAULT_ASSET_PAGE_SIZE = 100

const getAssetTypeName = (appType?: number): string => {
  if (appType === 2) return 'IOS应用'
  if (appType === 1) return 'And应用'
  return '-'
}

export const AssetShareTab: React.FC = () => {
  const {
    selectedConfigId,
    selectedOrgEbpId,
    selectedOrgName,
    setError,
    addLog,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  const [assetIdKeyword, setAssetIdKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [assets, setAssets] = useState<AccountAssetInfo[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_ASSET_PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [shareDialogAsset, setShareDialogAsset] = useState<AccountAssetInfo | null>(null)
  const [shareAccountText, setShareAccountText] = useState('')
  const [sharingAsset, setSharingAsset] = useState(false)

  const loadAssets = async (nextPage = 1, keyword = appliedKeyword): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const currentGroupId = selectedOrgEbpId.trim()
    if (!currentGroupId) {
      setError('请先在顶部选择组织')
      return
    }

    const currentPage = Math.max(nextPage, 1)
    const currentPageSize = DEFAULT_ASSET_PAGE_SIZE
    const currentKeyword = keyword.trim()

    setLoadingAssets(true)
    setError('')

    try {
      const result = await pAssistantServiceExtended.getAccountAssets({
        selected_cookie_id: selectedConfigId,
        group_id: currentGroupId,
        owner_account_id: '',
        keyword: currentKeyword,
        page: currentPage,
        page_size: currentPageSize
      })

      if (result.code !== 0 || !result.data) {
        throw new Error(result.error || result.msg || '加载资产列表失败')
      }

      const nextTotal = result.data.total_count ?? result.data.assets.length
      const nextPageSize = result.data.page_size ?? currentPageSize
      const nextTotalPages = Math.max(
        result.data.total_pages ?? Math.ceil(nextTotal / nextPageSize),
        1
      )

      setAssets(result.data.assets)
      setPage(result.data.page ?? currentPage)
      setPageSize(nextPageSize)
      setTotal(nextTotal)
      setTotalPages(nextTotalPages)
      setAppliedKeyword(currentKeyword)
      addLog(`成功加载 ${result.data.assets.length} 条资产记录`, 'success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载资产列表失败'
      setAssets([])
      setTotal(0)
      setTotalPages(1)
      setError(errorMessage)
      addLog(`加载资产列表失败: ${errorMessage}`, 'error')
    } finally {
      setLoadingAssets(false)
    }
  }

  const handleSearch = (): void => {
    void loadAssets(1, assetIdKeyword)
  }

  const openShareDialog = (asset: AccountAssetInfo): void => {
    setShareDialogAsset(asset)
    setShareAccountText('')
    setError('')
  }

  const handleShareSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    if (!selectedOrgEbpId) {
      setError('请先在顶部选择组织')
      return
    }

    if (!shareDialogAsset?.assets_id) {
      setError('请选择要共享的资产')
      return
    }

    const accountIds = parseAccountIds(shareAccountText)
    if (accountIds.length === 0) {
      setError('请输入待共享账户ID')
      return
    }

    setSharingAsset(true)
    setIsBottomPanelOpen(true)
    setError('')
    addLog(`开始共享资产 ${shareDialogAsset.assets_id}，目标账户 ${accountIds.length} 个`, 'info')

    try {
      const runWorkerJob = runPAssistantJob as <T extends { code?: number; error?: string; msg?: string }>(
        jobType: string,
        payload: Record<string, unknown>,
        options?: { onCreated?: (jobId: number) => void }
      ) => Promise<T>
      const result = await runWorkerJob<AssetShareResponse>(
        'asset_share',
        {
          selected_cookie_id: selectedConfigId,
          group_id: selectedOrgEbpId,
          asset_id: shareDialogAsset.assets_id,
          account_ids: accountIds
        },
        {
          onCreated: () => {
            setShareDialogAsset(null)
            setShareAccountText('')
          }
        }
      )

      if (result.code !== 0) {
        throw new Error(result.error || result.msg || '资产共享失败')
      }

      const totalSuccess = result.data?.total_success ?? 0
      const totalError = result.data?.total_error ?? 0
      addLog(
        `资产共享完成：成功 ${totalSuccess}，失败 ${totalError}`,
        totalError === 0 ? 'success' : 'info'
      )

      const failedList = result.data?.results?.filter((item) => !item.success) ?? []
      failedList.slice(0, 20).forEach((item) => {
        addLog(`账户 ${item.account_id}: ${item.error || '共享失败'}`, 'error')
      })
      if (failedList.length > 20) {
        addLog(`还有 ${failedList.length - 20} 个失败账户未显示`, 'info')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '资产共享失败'
      setError(errorMessage)
      addLog(`资产共享失败: ${errorMessage}`, 'error')
    } finally {
      setSharingAsset(false)
    }
  }

  useEffect(() => {
    setAssets([])
    setPage(1)
    setTotal(0)
    setTotalPages(1)
    setAppliedKeyword('')
  }, [selectedConfigId, selectedOrgEbpId])

  return (
    <PAssistantFeaturePanel
      title="资产共享（升级版）"
      description="请求组织下的事件资产列表，支持分页查询与资产 ID 搜索"
      icon={<Copy />}
    >
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label>当前组织</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {selectedOrgEbpId ? (
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{selectedOrgName || '未命名组织'}</div>
                  <div className="font-mono text-xs text-muted-foreground">{selectedOrgEbpId}</div>
                </div>
              ) : (
                <span className="text-muted-foreground">请先在顶部选择组织</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-share-asset-id">资产ID搜索</Label>
            <Input
              id="asset-share-asset-id"
              placeholder="请输入资产ID"
              value={assetIdKeyword}
              onChange={(event) => setAssetIdKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch()
              }}
              disabled={loadingAssets}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loadingAssets || !selectedConfigId || !selectedOrgEbpId}>
              {loadingAssets ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              查询
            </Button>
            <Button
              variant="outline"
              onClick={() => void loadAssets(page, appliedKeyword)}
              disabled={loadingAssets || !selectedConfigId || !selectedOrgEbpId}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-background">
          {loadingAssets ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在加载资产列表...</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              暂无资产数据，请先在顶部选择组织后查询
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="min-w-[280px] px-3 py-2 text-left font-medium">事件资产 / 资产ID</th>
                      <th className="min-w-[100px] px-3 py-2 text-left font-medium">资产类型</th>
                      <th className="min-w-[280px] px-3 py-2 text-left font-medium">所属账户</th>
                      <th className="min-w-[160px] px-3 py-2 text-left font-medium">创建时间</th>
                      <th className="sticky right-0 w-[96px] bg-muted/50 px-3 py-2 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.assets_id} className="border-t hover:bg-accent/50">
                        <td className="px-3 py-2">
                          <div className="font-medium">{asset.asset_name || '-'}</div>
                          <div className="font-mono text-xs text-muted-foreground">{asset.assets_id || '-'}</div>
                        </td>
                        <td className="px-3 py-2">{getAssetTypeName(asset.app_type)}</td>
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs">{asset.account_info?.id || '-'}</div>
                          <div className="text-muted-foreground">{asset.account_info?.name || '-'}</div>
                        </td>
                        <td className="px-3 py-2">{asset.create_time || '-'}</td>
                        <td className="sticky right-0 bg-background px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => openShareDialog(asset)}>
                            共享
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
                <span>
                  共 {total} 条，每页 {pageSize} 条，第 {page} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingAssets || page <= 1}
                    onClick={() => void loadAssets(page - 1, appliedKeyword)}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingAssets || page >= totalPages}
                    onClick={() => void loadAssets(page + 1, appliedKeyword)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!shareDialogAsset} onOpenChange={(open) => !open && setShareDialogAsset(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>共享事件资产</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{shareDialogAsset?.asset_name || '-'}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {shareDialogAsset?.assets_id || '-'}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-share-account-ids">待共享账户ID（一行一个）*</Label>
              <Textarea
                id="asset-share-account-ids"
                placeholder="请输入账户ID，每行一个"
                value={shareAccountText}
                onChange={(event) => setShareAccountText(event.target.value)}
                disabled={sharingAsset}
                className="min-h-[180px] resize-y font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                已输入 {parseAccountIds(shareAccountText).length} 个账户，每 100 个账户自动拆分一批并使用多 Cookie 并发请求
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogAsset(null)} disabled={sharingAsset}>
              取消
            </Button>
            <Button onClick={() => void handleShareSubmit()} disabled={sharingAsset}>
              {sharingAsset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认共享
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PAssistantFeaturePanel>
  )
}
