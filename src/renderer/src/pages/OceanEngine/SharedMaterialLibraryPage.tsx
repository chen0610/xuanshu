import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { FolderTree, Loader2, Pencil, Search, Send, Trash2, Upload, Users } from 'lucide-react'
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress
} from '../../components/ui'
import { cn } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { oceanEngineOAuthService } from '../../services/ocean-engine-oauth.service'
import {
  sharedMaterialLibraryService,
  type SharedAssetDetail,
  type SharedAssetItem,
  type SharedFolderTreeRow
} from '../../services/shared-material-library.service'
import type { OceanEngineOAuthToken } from '../../types/ocean-engine-oauth.types'
import { toast } from 'sonner'
import { userService } from '../../services/user.service'
import type { User } from '../../types/user.types'

const ASSET_UPLOAD_INPUT_ID = 'shared-material-library-asset-upload'
const ASSET_UPLOAD_FOLDER_INPUT_ID = 'shared-material-library-asset-upload-folder'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mpeg', '.mpg', '.3gp', '.avi', '.m4v'])

function getFileLowerExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return VIDEO_EXTENSIONS.has(getFileLowerExtension(file.name))
}

function getDisplayPath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return rel && rel.length > 0 ? rel : file.name
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** 上传时间展示为 Y-m-d H:i:s（本地时区） */
function formatUploadedAt(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

/** apiClient 拦截器 reject 的是 ApiError 普通对象，不是 AxiosError，需优先解析 message/detail。 */
function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const msg = o.message ?? o.detail
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: string; message?: string } | undefined
    const fromApi = data?.message ?? data?.detail
    if (typeof fromApi === 'string' && fromApi.trim()) return fromApi.trim()
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return '上传失败（原因未知）'
}

const SHARED_UPLOAD_MAX_FILES = 500
/** 批量上传连山时的最大并行路数（避免占满带宽与后端内存） */
const SHARED_UPLOAD_CONCURRENCY = 5

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const

export const SharedMaterialLibraryPage: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [folders, setFolders] = useState<SharedFolderTreeRow[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)

  const [assets, setAssets] = useState<SharedAssetItem[]>([])
  const [assetsTotal, setAssetsTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20)
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetUploading, setAssetUploading] = useState(false)
  const [assetUploadProgress, setAssetUploadProgress] = useState(0)
  const [assetUploadFileName, setAssetUploadFileName] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<number | null>(null)
  const [createName, setCreateName] = useState('')

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [aclOpen, setAclOpen] = useState(false)
  const [aclFolderId, setAclFolderId] = useState<number | null>(null)
  const [aclText, setAclText] = useState('')
  const [aclUserSearchDraft, setAclUserSearchDraft] = useState('')
  const [aclUserSearchDebounced, setAclUserSearchDebounced] = useState('')
  const [aclUserHits, setAclUserHits] = useState<User[]>([])
  const [aclUserSearchLoading, setAclUserSearchLoading] = useState(false)

  const [pushOpen, setPushOpen] = useState(false)
  const [pushAssets, setPushAssets] = useState<SharedAssetItem[]>([])
  const [pushBatchProgress, setPushBatchProgress] = useState<{ done: number; total: number } | null>(null)
  const [tokens, setTokens] = useState<OceanEngineOAuthToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set())
  const [advertiserId, setAdvertiserId] = useState('')
  const [accountType, setAccountType] = useState('ADVERTISER')
  const [isAigc, setIsAigc] = useState(false)
  const [pushSubmitting, setPushSubmitting] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set())
  /** 跨页批量推送时，当前列表只有一页数据，需缓存各页勾选行的完整条目 */
  const selectedAssetByIdRef = useRef<Map<number, SharedAssetItem>>(new Map())
  const [assetSearchDraft, setAssetSearchDraft] = useState('')
  const [assetSearchQuery, setAssetSearchQuery] = useState('')

  const refreshFolders = useCallback(async (): Promise<void> => {
    setFoldersLoading(true)
    try {
      const res = await sharedMaterialLibraryService.listFolders()
      setFolders(res.folders ?? [])
    } catch {
      toast.error('加载文件夹失败')
    } finally {
      setFoldersLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshFolders()
  }, [refreshFolders])

  useEffect(() => {
    if (folders.length === 0) {
      setSelectedFolderId(null)
      return
    }
    const exists = selectedFolderId != null && folders.some((f) => f.id === selectedFolderId)
    if (!exists) {
      setSelectedFolderId(folders[0]?.id ?? null)
    }
  }, [folders, selectedFolderId])

  useEffect(() => {
    setAssetSearchDraft('')
    setAssetSearchQuery('')
    setSelectedAssetIds(new Set())
    selectedAssetByIdRef.current.clear()
    setPage(1)
  }, [selectedFolderId])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  const loadAssets = useCallback(async (): Promise<void> => {
    if (selectedFolderId == null) {
      setAssets([])
      setAssetsTotal(0)
      return
    }
    setAssetsLoading(true)
    try {
      const res = await sharedMaterialLibraryService.listAssets({
        folder_id: selectedFolderId,
        page,
        page_size: pageSize,
        ...(assetSearchQuery.trim() ? { q: assetSearchQuery.trim() } : {})
      })
      setAssets(res.items ?? [])
      setAssetsTotal(res.total ?? 0)
    } catch {
      toast.error('加载素材列表失败')
    } finally {
      setAssetsLoading(false)
    }
  }, [selectedFolderId, page, assetSearchQuery, pageSize])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  useEffect(() => {
    const meta = selectedAssetByIdRef.current
    for (const a of assets) {
      if (selectedAssetIds.has(a.id)) meta.set(a.id, a)
    }
  }, [assets, selectedAssetIds])

  const uniqueOrgTokens = useMemo(() => {
    const grouped = new Map<string, OceanEngineOAuthToken[]>()
    for (const token of tokens) {
      const existing = grouped.get(token.advertiser_id)
      if (existing) existing.push(token)
      else grouped.set(token.advertiser_id, [token])
    }
    return Array.from(grouped.values()).map((group) => {
      const primary = group[0]
      const appCodes = Array.from(new Set(group.map((item) => item.app_code))).sort()
      return {
        advertiser_id: primary.advertiser_id,
        advertiser_name: primary.advertiser_name || primary.advertiser_id,
        appCodes
      }
    })
  }, [tokens])

  const orgForUpload = Array.from(selectedOrgIds)[0] ?? ''

  const allOnPageSelected =
    assets.length > 0 && assets.every((a) => selectedAssetIds.has(a.id))
  const someOnPageSelected = assets.some((a) => selectedAssetIds.has(a.id))

  const toggleSelectAllOnPage = (): void => {
    const meta = selectedAssetByIdRef.current
    if (allOnPageSelected) {
      setSelectedAssetIds((prev) => {
        const next = new Set(prev)
        assets.forEach((a) => {
          next.delete(a.id)
          meta.delete(a.id)
        })
        return next
      })
    } else {
      setSelectedAssetIds((prev) => {
        const next = new Set(prev)
        assets.forEach((a) => {
          next.add(a.id)
          meta.set(a.id, a)
        })
        return next
      })
    }
  }

  const toggleAssetRowSelected = (id: number, row: SharedAssetItem): void => {
    const meta = selectedAssetByIdRef.current
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        meta.delete(id)
      } else {
        next.add(id)
        meta.set(id, row)
      }
      return next
    })
  }

  const applyAssetSearch = (): void => {
    setPage(1)
    setAssetSearchQuery(assetSearchDraft.trim())
  }

  const clearAssetSearch = (): void => {
    setAssetSearchDraft('')
    setAssetSearchQuery('')
    setPage(1)
  }

  const loadTokensForPush = (): void => {
    setLoadingTokens(true)
    void oceanEngineOAuthService
      .getTokens(true)
      .then((res) => setTokens(res.items ?? []))
      .catch(() => toast.error('加载已授权组织账户失败'))
      .finally(() => setLoadingTokens(false))
  }

  const openPushDialog = (asset: SharedAssetItem): void => {
    setPushAssets([asset])
    setPushBatchProgress(null)
    setPushOpen(true)
    loadTokensForPush()
  }

  const openBulkPushDialog = async (): Promise<void> => {
    if (selectedAssetIds.size === 0) {
      toast.error('请先勾选要推送的素材')
      return
    }
    const ids = Array.from(selectedAssetIds)
    const meta = selectedAssetByIdRef.current
    const resolved = new Map<number, SharedAssetItem>()
    const missingIds: number[] = []
    for (const id of ids) {
      const cached = meta.get(id) ?? assets.find((a) => a.id === id)
      if (cached) {
        resolved.set(id, cached)
        meta.set(id, cached)
      } else {
        missingIds.push(id)
      }
    }
    if (missingIds.length > 0) {
      const results = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const detail = await sharedMaterialLibraryService.getAsset(id)
            return { id, detail }
          } catch {
            return { id, detail: null as SharedAssetDetail | null }
          }
        })
      )
      for (const { id, detail } of results) {
        if (detail) {
          resolved.set(id, detail)
          meta.set(id, detail)
        }
      }
      const failedFetch = results.filter((r) => r.detail == null).map((r) => r.id)
      if (failedFetch.length > 0) {
        toast.error(`有 ${failedFetch.length} 条已选素材无法加载详情，已跳过`, {
          description: `ID：${failedFetch.slice(0, 12).join(', ')}${failedFetch.length > 12 ? '…' : ''}`,
          duration: 10000
        })
      }
    }
    const picked = ids.map((id) => resolved.get(id)).filter((row): row is SharedAssetItem => row != null)
    if (picked.length === 0) {
      toast.error('没有可推送的素材', { description: '请重新勾选或刷新列表后重试。' })
      return
    }
    setPushAssets(picked)
    setPushBatchProgress(null)
    setPushOpen(true)
    loadTokensForPush()
  }

  const toggleOrg = (orgId: string): void => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev)
      if (next.has(orgId)) next.delete(orgId)
      else next.add(orgId)
      return next
    })
  }

  const submitPush = async (): Promise<void> => {
    const targets = pushAssets
    if (targets.length === 0) return
    const orgId = orgForUpload.trim()
    const advId = advertiserId.trim()
    if (!orgId) {
      toast.error('请至少选择一个授权来源组织账户')
      return
    }
    if (!advId) {
      toast.error('请填写目标广告主 ID')
      return
    }
    setPushSubmitting(true)
    setPushBatchProgress({ done: 0, total: targets.length })
    const body = {
      org_advertiser_id: orgId,
      advertiser_id: advId,
      account_type: accountType,
      is_aigc: isAigc ? true : undefined
    }
    const okIds: number[] = []
    const failures: { name: string; reason: string }[] = []
    try {
      if (targets.length > 1) {
        setPushBatchProgress({ done: 0, total: targets.length })
        try {
          const batchRes = await sharedMaterialLibraryService.enqueueOceanAsyncBatch({
            asset_ids: targets.map((a) => a.id),
            ...body
          })
          setPushBatchProgress({ done: targets.length, total: targets.length })
          const byId = new Map(targets.map((a) => [a.id, a] as const))
          for (const it of batchRes.items) {
            if (it.code === 0 && it.ocean_task_id != null) {
              okIds.push(it.asset_id)
            } else {
              const a = byId.get(it.asset_id)
              failures.push({
                name: a?.display_name ?? `素材 #${it.asset_id}`,
                reason: (it.message ?? `code=${it.code}`) || '创建失败'
              })
            }
          }
        } catch (err) {
          for (const asset of targets) {
            failures.push({ name: asset.display_name, reason: extractApiErrorMessage(err) })
          }
        }
      } else {
        const asset = targets[0]
        setPushBatchProgress({ done: 0, total: 1 })
        try {
          const res = await sharedMaterialLibraryService.enqueueOceanAsync(asset.id, body)
          if (res.code === 0 && res.ocean_task_id != null) {
            okIds.push(asset.id)
          } else {
            failures.push({
              name: asset.display_name,
              reason: res.message ?? `code=${res.code}`
            })
          }
        } catch (err) {
          failures.push({ name: asset.display_name, reason: extractApiErrorMessage(err) })
        }
        setPushBatchProgress({ done: 1, total: 1 })
      }

      if (okIds.length > 0) {
        const meta = selectedAssetByIdRef.current
        okIds.forEach((id) => meta.delete(id))
        setSelectedAssetIds((prev) => {
          const next = new Set(prev)
          okIds.forEach((id) => next.delete(id))
          return next
        })
      }
      if (failures.length === 0) {
        toast.success(
          targets.length === 1 ? '已创建巨量异步上传任务' : `已为 ${okIds.length} 个素材创建巨量异步任务`
        )
      } else if (okIds.length === 0) {
        const desc = failures.map((f) => `「${f.name}」：${f.reason}`).join('\n')
        toast.error('推送均未成功', { description: desc, duration: 12000 })
      } else {
        const desc =
          failures.length <= 8
            ? failures.map((f) => `「${f.name}」：${f.reason}`).join('\n')
            : `${failures
                .slice(0, 8)
                .map((f) => `「${f.name}」：${f.reason}`)
                .join('\n')}\n… 另有 ${failures.length - 8} 条失败`
        toast.warning(`成功 ${okIds.length} 个，失败 ${failures.length} 个`, {
          description: desc,
          duration: 14000
        })
      }
      setPushOpen(false)
      setPushAssets([])
    } finally {
      setPushSubmitting(false)
      setPushBatchProgress(null)
    }
  }

  const openCreate = (parentId: number | null): void => {
    setCreateParentId(parentId)
    setCreateName('')
    setCreateOpen(true)
  }

  const submitCreate = async (): Promise<void> => {
    const name = createName.trim()
    if (!name) {
      toast.error('请输入文件夹名称')
      return
    }
    try {
      const row = await sharedMaterialLibraryService.createFolder({
        parent_id: createParentId,
        name
      })
      toast.success('已创建文件夹')
      setCreateOpen(false)
      await refreshFolders()
      setSelectedFolderId(row.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  const openRename = (f: SharedFolderTreeRow): void => {
    setRenameFolderId(f.id)
    setRenameValue(f.name)
    setRenameOpen(true)
  }

  const submitRename = async (): Promise<void> => {
    if (renameFolderId == null) return
    const name = renameValue.trim()
    if (!name) {
      toast.error('请输入名称')
      return
    }
    try {
      await sharedMaterialLibraryService.updateFolder(renameFolderId, { name })
      toast.success('已更新')
      setRenameOpen(false)
      await refreshFolders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败')
    }
  }

  const confirmDeleteFolder = async (f: SharedFolderTreeRow): Promise<void> => {
    if (!window.confirm(`确定删除文件夹「${f.name}」？（须为空且无子文件夹）`)) return
    try {
      await sharedMaterialLibraryService.deleteFolder(f.id)
      toast.success('已删除')
      if (selectedFolderId === f.id) setSelectedFolderId(null)
      await refreshFolders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const openAcl = async (folderId: number): Promise<void> => {
    setAclFolderId(folderId)
    try {
      const acl = await sharedMaterialLibraryService.getFolderAcl(folderId)
      setAclText((acl.user_ids ?? []).join(', '))
      setAclOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载 ACL 失败')
    }
  }

  const submitAcl = async (): Promise<void> => {
    if (aclFolderId == null) return
    const parts = aclText.split(/[,，\s]+/).filter(Boolean)
    const user_ids = parts.map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n))
    try {
      await sharedMaterialLibraryService.putFolderAcl(aclFolderId, user_ids)
      toast.success('已保存可见用户（空为全员可见）')
      setAclOpen(false)
      await refreshFolders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => setAclUserSearchDebounced(aclUserSearchDraft), 280)
    return () => window.clearTimeout(t)
  }, [aclUserSearchDraft])

  useEffect(() => {
    if (!aclOpen) {
      setAclUserSearchDraft('')
      setAclUserSearchDebounced('')
      setAclUserHits([])
      setAclUserSearchLoading(false)
      return undefined
    }
    const q = aclUserSearchDebounced.trim()
    if (q.length === 0) {
      setAclUserHits([])
      return undefined
    }
    let cancelled = false
    setAclUserSearchLoading(true)
    void (async () => {
      try {
        const res = await userService.getUsers({ page: 1, page_size: 30, search: q })
        if (!cancelled) setAclUserHits(res.items ?? [])
      } catch {
        if (!cancelled) {
          setAclUserHits([])
          toast.error('搜索用户失败')
        }
      } finally {
        if (!cancelled) setAclUserSearchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aclOpen, aclUserSearchDebounced])

  const addAclUserFromPick = useCallback((u: User): void => {
    const parts = aclText.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
    const ids = new Set(parts.map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n)))
    if (ids.has(u.id)) {
      toast.message('该用户已在列表中')
      return
    }
    ids.add(u.id)
    setAclText([...ids].sort((a, b) => a - b).join(', '))
  }, [aclText])

  const uploadSelectedAssetFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    if (files.length > SHARED_UPLOAD_MAX_FILES) {
      toast.error('一次选择的文件过多', {
        description: `请最多选择 ${SHARED_UPLOAD_MAX_FILES} 个视频，当前 ${files.length} 个。`,
        duration: 8000
      })
      return
    }
    const folderId = selectedFolderId
    if (folderId == null) {
      toast.error('请先选择左侧文件夹')
      return
    }
    if (files.length > 1) {
      toast.info('批量上传', {
        description: `将并行上传 ${files.length} 个文件（最多 ${SHARED_UPLOAD_CONCURRENCY} 路同时进行）。若已开启连山直传，文件将直接 PUT 到 TOS（请为桶配置 CORS 允许本应用来源）。`,
        duration: 7000
      })
    }

    setAssetUploading(true)
    const failures: { name: string; reason: string }[] = []
    let okNew = 0
    let okReused = 0
    let lastSingleOk: SharedAssetDetail | null = null
    let lastSingleFileName = ''

    try {
      const progresses = new Array<number>(files.length).fill(0)
      const syncUploadUi = (): void => {
        const overall =
          files.length === 0 ? 0 : Math.round(progresses.reduce((a, b) => a + b, 0) / files.length)
        setAssetUploadProgress(overall)
        if (files.length > 1) {
          const done = progresses.filter((p) => p >= 100).length
          setAssetUploadFileName(
            `当前 ${SHARED_UPLOAD_CONCURRENCY} 并发 · 已处理 ${done}/${files.length}`
          )
        }
      }

      const uploadAtIndex = async (i: number): Promise<void> => {
        const file = files[i]
        const label = getDisplayPath(file)
        if (files.length === 1) {
          setAssetUploadFileName(label)
        }
        syncUploadUi()
        try {
          const uploaded = await sharedMaterialLibraryService.uploadAssetAuto(
            { folder_id: folderId, file, display_name: label },
            {
              onUploadProgress: (pct) => {
                progresses[i] = pct
                syncUploadUi()
              }
            }
          )
          if (uploaded.reused_existing_tos) okReused += 1
          else okNew += 1
          if (files.length === 1) {
            lastSingleOk = uploaded
            lastSingleFileName = label
          }
        } catch (err) {
          failures.push({ name: label, reason: extractApiErrorMessage(err) })
        } finally {
          progresses[i] = 100
          syncUploadUi()
        }
      }

      let nextIndex = 0
      const worker = async (): Promise<void> => {
        while (true) {
          const i = nextIndex++
          if (i >= files.length) break
          await uploadAtIndex(i)
        }
      }
      const nWorkers = Math.min(SHARED_UPLOAD_CONCURRENCY, files.length)
      await Promise.all(Array.from({ length: nWorkers }, () => worker()))

      setPage(1)
      setAssetsLoading(true)
      try {
        const res = await sharedMaterialLibraryService.listAssets({
          folder_id: folderId,
          page: 1,
          page_size: pageSize,
          ...(assetSearchQuery.trim() ? { q: assetSearchQuery.trim() } : {})
        })
        setAssets(res.items ?? [])
        setAssetsTotal(res.total ?? 0)
      } catch {
        toast.error('刷新列表失败', { description: '素材可能已写入，请点击「刷新列表」重试。', duration: 8000 })
      } finally {
        setAssetsLoading(false)
      }
      await refreshFolders()

      const okTotal = okNew + okReused
      if (files.length === 1 && okTotal === 1 && lastSingleOk) {
        if (lastSingleOk.reused_existing_tos) {
          toast.success(`「${lastSingleFileName}」已加入当前文件夹`)
          toast.info('与库内已有素材内容相同，已引用已有连山对象，未重复上传云端存储', { duration: 8000 })
        } else {
          toast.success(`「${lastSingleFileName}」上传成功`)
        }
      } else if (okTotal > 0) {
        const lines: string[] = []
        if (okNew > 0) lines.push(`新上传连山：${okNew} 个`)
        if (okReused > 0) lines.push(`引用已有（未占连山存储）：${okReused} 个`)
        toast.success(`本批已完成 ${okTotal}/${files.length} 个文件`, {
          description: lines.join('；'),
          duration: 8000
        })
      }

      if (files.length === 1 && failures.length === 1) {
        const f = failures[0]
        toast.error(`「${f.name}」未能上传`, {
          description: f.reason,
          duration: 10000
        })
      } else if (failures.length > 0) {
        const desc =
          failures.length <= 5
            ? failures.map((x) => `「${x.name}」：${x.reason}`).join('\n')
            : `${failures
                .slice(0, 5)
                .map((x) => `「${x.name}」：${x.reason}`)
                .join('\n')}\n… 另有 ${failures.length - 5} 个失败，请分批重试。`
        toast.error(
          failures.length === files.length
            ? '本批文件均未上传成功'
            : `本批 ${failures.length}/${files.length} 个文件失败`,
          { description: desc, duration: failures.length <= 3 ? 12000 : 16000 }
        )
      }
    } finally {
      setAssetUploading(false)
      setAssetUploadProgress(0)
      setAssetUploadFileName('')
    }
  }

  const onAssetFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await uploadSelectedAssetFiles(files)
  }

  const onAssetFolderChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const raw = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (raw.length === 0) return
    const videos = raw.filter(isVideoFile)
    const skipped = raw.length - videos.length
    if (videos.length === 0) {
      toast.error('所选目录下没有符合格式的视频', {
        description: '支持 mp4 / mpeg / mpg / 3gp / avi / m4v',
        duration: 8000
      })
      return
    }
    if (skipped > 0) {
      toast.message(`已跳过 ${skipped} 个非视频文件`)
    }
    await uploadSelectedAssetFiles(videos)
  }

  const totalPages = Math.max(1, Math.ceil(assetsTotal / pageSize))

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">共享媒体素材库</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            素材先写入连山 TOS 并入库；推送到巨量请在行内选择授权组织与广告主
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-5 w-5" />
              文件夹
            </CardTitle>
            <CardDescription>点击选择；管理员可维护结构与 ACL。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => openCreate(null)}>
                  新建根文件夹
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedFolderId == null}
                  onClick={() => openCreate(selectedFolderId)}
                >
                  在当前下新建
                </Button>
              </div>
            )}
            {foldersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : folders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isAdmin ? '暂无文件夹，请先创建根文件夹。' : '暂无可见文件夹，请联系管理员。'}
              </p>
            ) : (
              <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-2">
                {folders.map((f) => (
                  <li
                    key={f.id}
                    className={cn(
                      'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
                      selectedFolderId === f.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/80'
                    )}
                    style={{ paddingLeft: 8 + f.depth * 14 }}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-medium"
                      onClick={() => {
                        setSelectedFolderId(f.id)
                        setPage(1)
                      }}
                    >
                      {f.name}
                    </button>
                    {isAdmin && (
                      <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="重命名"
                          onClick={() => openRename(f)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="可见用户"
                          onClick={() => void openAcl(f.id)}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="删除"
                          onClick={() => void confirmDeleteFolder(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">素材</CardTitle>
              <CardDescription>
                {selectedFolderId == null
                  ? '请选择左侧文件夹'
                  : `共 ${assetsTotal} 条 · 第 ${page} / ${totalPages} 页 · 上传支持多选或选文件夹（含子目录）、依次处理 · 可勾选批量推送巨量`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={ASSET_UPLOAD_INPUT_ID}
                type="file"
                multiple
                className="sr-only"
                aria-label="选择要上传到共享素材库的视频（可多选）"
                tabIndex={-1}
                accept=".mp4,.mpeg,.mpg,.3gp,.avi,.m4v,video/*"
                disabled={selectedFolderId == null || assetUploading}
                onChange={(e) => void onAssetFileChange(e)}
              />
              {/* webkitdirectory：Chromium 选目录后 FileList 含子目录下全部文件 */}
              <input
                id={ASSET_UPLOAD_FOLDER_INPUT_ID}
                type="file"
                multiple
                className="sr-only"
                aria-label="选择视频所在文件夹（含子文件夹）上传到共享素材库"
                tabIndex={-1}
                disabled={selectedFolderId == null || assetUploading}
                onChange={(e) => void onAssetFolderChange(e)}
                {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
              {selectedFolderId == null || assetUploading ? (
                <span
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    (selectedFolderId == null || assetUploading) && 'pointer-events-none cursor-not-allowed opacity-50'
                  )}
                >
                  {assetUploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      上传中…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-4 w-4" />
                      上传视频
                    </>
                  )}
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <label
                    htmlFor={ASSET_UPLOAD_INPUT_ID}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer')}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    上传视频（可多选）
                  </label>
                  <label
                    htmlFor={ASSET_UPLOAD_FOLDER_INPUT_ID}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}
                  >
                    选择文件夹
                  </label>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadAssets()}
                disabled={assetsLoading || assetUploading}
              >
                刷新列表
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={selectedFolderId == null || selectedAssetIds.size === 0 || assetUploading}
                onClick={() => void openBulkPushDialog()}
              >
                <Send className="mr-1.5 h-4 w-4" />
                批量推送巨量（{selectedAssetIds.size}）
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedFolderId != null && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <Label htmlFor="sm-asset-search" className="text-xs text-muted-foreground">
                    关键词搜索（素材名称）
                  </Label>
                  <Input
                    id="sm-asset-search"
                    value={assetSearchDraft}
                    onChange={(e) => setAssetSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyAssetSearch()
                      }
                    }}
                    placeholder="输入关键词后搜索或回车"
                    disabled={assetUploading}
                  />
                </div>
                <Button type="button" size="sm" disabled={assetUploading} onClick={() => applyAssetSearch()}>
                  <Search className="mr-1.5 h-4 w-4" />
                  搜索
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={assetUploading || (!assetSearchQuery && !assetSearchDraft)}
                  onClick={() => clearAssetSearch()}
                >
                  清除
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={assets.length === 0 || assetUploading}
                  onClick={() => toggleSelectAllOnPage()}
                >
                  {allOnPageSelected ? '取消全选本页' : '全选本页'}
                </Button>
              </div>
            )}
            {assetUploading && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium" title={assetUploadFileName}>
                    正在上传：{assetUploadFileName || '…'}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{assetUploadProgress}%</span>
                </div>
                <Progress value={assetUploadProgress} className="mt-3 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  客户端 → 服务端 → 连山 TOS，大文件可能需数分钟；进度为发送到服务器的字节比例。
                </p>
              </div>
            )}
            {assetsLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : selectedFolderId == null ? null : assets.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {assetSearchQuery.trim() ? '当前关键词下无匹配素材' : '该文件夹下暂无素材'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border/60 bg-muted/40">
                    <tr>
                      <th className="w-10 px-2 py-2">
                        <Checkbox
                          checked={
                            allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false
                          }
                          onCheckedChange={() => toggleSelectAllOnPage()}
                          aria-label="全选本页"
                        />
                      </th>
                      <th className="px-3 py-2 font-medium">素材名称</th>
                      <th className="px-3 py-2 font-medium">大小</th>
                      <th className="px-3 py-2 font-medium">上传时间</th>
                      <th className="px-3 py-2 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="border-b border-border/40 last:border-0">
                        <td className="px-2 py-2 align-middle">
                          <Checkbox
                            checked={selectedAssetIds.has(a.id)}
                            onCheckedChange={() => toggleAssetRowSelected(a.id, a)}
                            aria-label={`选择 ${a.display_name}`}
                          />
                        </td>
                        <td className="max-w-[320px] truncate px-3 py-2 font-medium" title={a.display_name}>
                          {a.display_name}
                        </td>
                        <td className="px-3 py-2">{formatBytes(a.file_size)}</td>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">
                          {formatUploadedAt(a.created_at)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button type="button" variant="secondary" size="sm" onClick={() => openPushDialog(a)}>
                            <Send className="mr-1 h-3.5 w-3.5" />
                            推送巨量
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedFolderId != null && assetsTotal > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sm-asset-page-size" className="whitespace-nowrap text-xs text-muted-foreground">
                    每页
                  </Label>
                  <select
                    id="sm-asset-page-size"
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={pageSize}
                    disabled={assetUploading}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (PAGE_SIZE_OPTIONS.includes(v as (typeof PAGE_SIZE_OPTIONS)[number])) {
                        setPageSize(v as (typeof PAGE_SIZE_OPTIONS)[number])
                      }
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} 条
                      </option>
                    ))}
                  </select>
                </div>
                {assetsTotal > pageSize && (
                  <>
                    <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      上一页
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      第 {page} / {totalPages} 页
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              {createParentId == null ? '在根目录下创建。' : `在已选文件夹（ID ${createParentId}）下创建子文件夹。`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="sm-create-name">名称</Label>
            <Input id="sm-create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="文件夹名称" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitCreate()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名文件夹</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="sm-rename">新名称</Label>
            <Input id="sm-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitRename()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aclOpen} onOpenChange={setAclOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>文件夹可见用户</DialogTitle>
            <DialogDescription>
              填写用户数字 ID，逗号或空格分隔；或通过下方按用户名、姓名搜索后点击添加。留空并保存表示不限制（全员可见）。子文件夹继承父级限制。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sm-acl-user-search">搜索用户（用户名 / 姓名）</Label>
              <Input
                id="sm-acl-user-search"
                value={aclUserSearchDraft}
                onChange={(e) => setAclUserSearchDraft(e.target.value)}
                placeholder="输入关键字，约 0.3 秒后自动搜索"
                autoComplete="off"
              />
              <ul className="max-h-44 overflow-y-auto rounded-md border border-border/60 text-sm">
                {aclUserSearchLoading && (
                  <li className="text-muted-foreground flex items-center gap-2 px-3 py-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    搜索中…
                  </li>
                )}
                {!aclUserSearchLoading &&
                  aclUserSearchDebounced.trim().length === 0 && (
                    <li className="text-muted-foreground px-3 py-2">输入至少 1 个字符以搜索</li>
                  )}
                {!aclUserSearchLoading &&
                  aclUserSearchDebounced.trim().length > 0 &&
                  aclUserHits.length === 0 && (
                    <li className="text-muted-foreground px-3 py-2">无匹配用户</li>
                  )}
                {!aclUserSearchLoading &&
                  aclUserHits.map((u) => {
                    const title = (u.name && u.name.trim()) || u.username
                    return (
                      <li key={u.id} className="border-b border-border/40 last:border-0">
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addAclUserFromPick(u)}
                        >
                          <span className="font-medium">{title}</span>
                          <span className="text-muted-foreground text-xs">
                            @{u.username} · ID {u.id}
                            {u.email ? ` · ${u.email}` : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sm-acl">用户 ID 列表</Label>
              <Input id="sm-acl" value={aclText} onChange={(e) => setAclText(e.target.value)} placeholder="例如：1, 2, 5" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAclOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitAcl()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pushOpen}
        onOpenChange={(open) => {
          setPushOpen(open)
          if (!open) {
            setPushAssets([])
            setPushBatchProgress(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>推送到巨量（异步）</DialogTitle>
            <DialogDescription>
              {pushAssets.length <= 1
                ? pushAssets[0]
                  ? `素材：${pushAssets[0].display_name}。将使用库内已保存的连山 video_url 创建上传任务。`
                  : ''
                : `已选 ${pushAssets.length} 个素材，将在服务端以多路并发、按多应用授权轮询为每个素材创建巨量异步上传任务。`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto py-2">
            <div className="space-y-2">
              <Label>授权来源组织账户（org_advertiser_id）</Label>
              {loadingTokens ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载授权…
                </div>
              ) : uniqueOrgTokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无已授权组织，请先在 OpenAPI App 中完成授权。</p>
              ) : (
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
                  {uniqueOrgTokens.map((item) => (
                    <li key={item.advertiser_id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={selectedOrgIds.has(item.advertiser_id)}
                        onCheckedChange={() => toggleOrg(item.advertiser_id)}
                      />
                      <div>
                        <div className="font-medium">{item.advertiser_name}</div>
                        <div className="text-xs text-muted-foreground">ID: {item.advertiser_id}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sm-push-adv">目标广告主 ID（advertiser_id）</Label>
              <Input
                id="sm-push-adv"
                value={advertiserId}
                onChange={(e) => setAdvertiserId(e.target.value)}
                placeholder="广告主 ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sm-push-acct">account_type</Label>
              <Input id="sm-push-acct" value={accountType} onChange={(e) => setAccountType(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sm-push-aigc" checked={isAigc} onCheckedChange={(c) => setIsAigc(c === true)} />
              <Label htmlFor="sm-push-aigc" className="text-sm font-normal">
                标记为 AIGC 素材
              </Label>
            </div>
            {pushBatchProgress && pushSubmitting && (
              <p className="text-xs text-muted-foreground">
                正在提交 {pushBatchProgress.done + 1} / {pushBatchProgress.total}…
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPushOpen(false)} disabled={pushSubmitting}>
              取消
            </Button>
            <Button type="button" disabled={pushSubmitting || pushAssets.length === 0} onClick={() => void submitPush()}>
              {pushSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {pushAssets.length > 1 ? '批量提交中…' : '提交中…'}
                </>
              ) : pushAssets.length > 1 ? (
                `批量推送（${pushAssets.length}）`
              ) : (
                '创建异步任务'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
