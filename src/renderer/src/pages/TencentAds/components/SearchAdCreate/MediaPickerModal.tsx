import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
  Textarea
} from '../../../../components/ui'
import { Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { searchAdCreateService } from '../../../../services/tencent-ads.service'

interface MediaItem {
  media_id: string
  media_description: string
  base_media_url: string
  key_frame_image_url: string
  cover_image_id: string
  video_width?: number
  video_height?: number
  media_duration_second?: number
  teg_resource_id?: string
}

interface MediaPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  advertiserId: number | null
  cookieConfigId: number | null
  selectedMediaIds: string[]
  siteSet?: number[]
  creativeTemplateIds?: number[]
  promotedObjectType?: number
  onlyLandscapeVideo?: boolean // 是否只显示横屏视频
  onConfirm: (
    selectedMedia: Array<{
      media_id: string
      media_description: string
      base_media_url: string
      key_frame_image_url: string
      cover_image_id: string
      video_width?: number
      video_height?: number
    }>
  ) => void
}

// 将 http URL 转换为 https，以符合 CSP 策略
const convertToHttps = (url: string): string => {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  open,
  onOpenChange,
  advertiserId,
  cookieConfigId,
  selectedMediaIds,
  siteSet = [136, 118, 115],
  creativeTemplateIds = [2083],
  promotedObjectType = 19,
  onlyLandscapeVideo = false,
  onConfirm
}) => {
  const [mediaList, setMediaList] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 缓存所有已选中素材的完整信息
  const selectedMediaCacheRef = useRef<Map<string, MediaItem>>(new Map())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalNum, setTotalNum] = useState(0)
  const [invalidMediaIds, setInvalidMediaIds] = useState<Set<string>>(new Set())
  const [checkingMediaIds, setCheckingMediaIds] = useState<Set<string>>(new Set())
  const [taccToken, setTaccToken] = useState<string | null>(null)
  const taccTokenRef = useRef<string | null>(null)
  const [keyword, setKeyword] = useState<string>('')
  const keywordRef = useRef<string>('')
  const pageSize = 16
  const prevOpenRef = useRef(false)
  const selectedMediaIdsRef = useRef(selectedMediaIds)
  const isInitialLoadRef = useRef(false)
  const loadMediaListRef = useRef<((page: number) => Promise<void>) | null>(null)
  // 缓存上一次的搜索结果
  const cacheRef = useRef<{
    mediaList: MediaItem[]
    totalNum: number
    currentPage: number
    keyword: string
    invalidMediaIds: Set<string>
  } | null>(null)
  // 存储所有搜索结果（用于多关键字查询）
  const allSearchResultsRef = useRef<MediaItem[]>([])
  const [isMultiKeywordSearch, setIsMultiKeywordSearch] = useState(false)
  // 分页缓存：按查询关键字存储每页数据
  // Map<keyword, Map<page, { mediaList, invalidMediaIds }>>
  const pageCacheRef = useRef<
    Map<
      string,
      Map<
        number,
        {
          mediaList: MediaItem[]
          invalidMediaIds: Set<string>
        }
      >
    >
  >(new Map())
  // 存储每个查询条件的总数
  const totalNumCacheRef = useRef<Map<string, number>>(new Map())

  // 同步最新的 selectedMediaIds 到 ref
  useEffect(() => {
    selectedMediaIdsRef.current = selectedMediaIds
  }, [selectedMediaIds])

  // 批量检查素材是否符合版位要求
  const batchValidateMediaPlacement = useCallback(
    async (mediaList: MediaItem[], token?: string) => {
      const tokenToUse = token || taccTokenRef.current
      if (!advertiserId || !cookieConfigId || !tokenToUse) {
        return
      }

      // 过滤出需要验证的素材（必须有base_media_url和teg_resource_id）
      const mediaToValidate = mediaList.filter(
        (media) => media.base_media_url && media.teg_resource_id
      )

      if (mediaToValidate.length === 0) {
        return
      }

      // 标记所有素材为检查中
      const mediaIdsToCheck = new Set(mediaToValidate.map((m) => m.media_id))
      setCheckingMediaIds((prev) => new Set([...prev, ...mediaIdsToCheck]))

      try {
        // 批量验证
        const response = await searchAdCreateService.batchValidateMediaPlacement({
          uid: advertiserId,
          selected_cookie_id: cookieConfigId,
          media_list: mediaToValidate.map((media) => ({
            media_id: media.media_id,
            url: media.base_media_url,
            svp_vid: media.teg_resource_id
          })),
          site_set: siteSet,
          creative_template_ids: creativeTemplateIds,
          promoted_object_type: promotedObjectType,
          tacc_token: tokenToUse
        })

        // 根据验证结果更新无效素材标记
        if (response.code === 0 && response.data) {
          const invalidIds = new Set<string>()
          Object.entries(response.data).forEach(([mediaId, validResult]) => {
            if (validResult !== 1) {
              invalidIds.add(mediaId)
            }
          })
          setInvalidMediaIds((prev) => {
            const newSet = new Set(prev)
            invalidIds.forEach((id) => newSet.add(id))
            return newSet
          })
        }
      } catch (error) {
        console.error('Failed to batch validate media placement:', error)
        // 验证失败时，为了安全起见，标记所有素材为无效
        const invalidIds = new Set(mediaToValidate.map((m) => m.media_id))
        setInvalidMediaIds((prev) => {
          const newSet = new Set(prev)
          invalidIds.forEach((id) => newSet.add(id))
          return newSet
        })
      } finally {
        // 清除检查中标记
        setCheckingMediaIds((prev) => {
          const newSet = new Set(prev)
          mediaIdsToCheck.forEach((id) => newSet.delete(id))
          return newSet
        })
      }
    },
    [advertiserId, cookieConfigId, siteSet, creativeTemplateIds, promotedObjectType]
  )

  // 解析关键字：按行分割，每行一个关键字
  const parseKeywords = useCallback((keywordStr: string): string[] => {
    if (!keywordStr.trim()) return []
    return keywordStr
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
  }, [])

  // 获取TACC Token
  const loadTaccToken = useCallback(async (): Promise<string | null> => {
    if (!advertiserId || !cookieConfigId) return null

    // 如果已有Token，直接返回
    if (taccTokenRef.current) return taccTokenRef.current

    try {
      const response = await searchAdCreateService.getTaccToken({
        advertiser_id: advertiserId,
        selected_cookie_id: cookieConfigId
      })

      if (response.code === 0 && response.data) {
        taccTokenRef.current = response.data
        setTaccToken(response.data)
        return response.data
      } else {
        console.error('Failed to load TACC token:', response.error)
        return null
      }
    } catch (error) {
      console.error('Failed to load TACC token:', error)
      return null
    }
  }, [advertiserId, cookieConfigId])

  const loadMediaList = useCallback(
    async (page: number) => {
      if (!advertiserId || !cookieConfigId) return

      const keywordStr = keywordRef.current.trim()
      const keywords = parseKeywords(keywordStr)

      // 检查缓存：单关键字查询时检查该页是否已缓存
      if (keywords.length === 1) {
        const cacheKey = keywordStr || '__empty__'
        const pageCache = pageCacheRef.current.get(cacheKey)
        if (pageCache && pageCache.has(page)) {
          // 使用缓存数据
          const cachedData = pageCache.get(page)!
          setMediaList(cachedData.mediaList)
          setTotalNum(totalNumCacheRef.current.get(cacheKey) || 0)

          // 更新选中素材缓存：如果当前页有已选中的素材，更新缓存
          cachedData.mediaList.forEach((item: MediaItem) => {
            if (selectedMediaIdsRef.current.includes(item.media_id)) {
              selectedMediaCacheRef.current.set(item.media_id, item)
            }
          })

          // 合并当前页的无效标记和全局无效标记
          const mergedInvalidIds = new Set(invalidMediaIds)
          cachedData.invalidMediaIds.forEach((id) => {
            mergedInvalidIds.add(id)
          })
          setInvalidMediaIds(mergedInvalidIds)
          setCurrentPage(page)

          // 更新缓存引用
          cacheRef.current = {
            mediaList: cachedData.mediaList,
            totalNum: totalNumCacheRef.current.get(cacheKey) || 0,
            currentPage: page,
            keyword: keywordStr,
            invalidMediaIds: new Set(cachedData.invalidMediaIds)
          }
          return
        }
      }

      try {
        setLoading(true)

        // 先获取TACC Token（如果还没有）
        const token = await loadTaccToken()
        if (!token) {
          console.error('Failed to get TACC token')
          setMediaList([])
          return
        }

        // 多关键字查询：使用后端并发多cookie查询
        if (keywords.length > 1) {
          setIsMultiKeywordSearch(true)

          // 检查多关键字查询的缓存
          const cacheKey = keywordStr
          if (allSearchResultsRef.current.length > 0 && cacheRef.current?.keyword === cacheKey) {
            // 使用缓存的所有结果
            const startIndex = (page - 1) * pageSize
            const endIndex = startIndex + pageSize
            const paginatedList = allSearchResultsRef.current.slice(startIndex, endIndex)
            setMediaList(paginatedList)
            setTotalNum(allSearchResultsRef.current.length)
            setCurrentPage(page)

            // 更新选中素材缓存：从完整结果列表中查找已选中的素材并缓存
            allSearchResultsRef.current.forEach((item: MediaItem) => {
              if (selectedMediaIdsRef.current.includes(item.media_id)) {
                selectedMediaCacheRef.current.set(item.media_id, item)
              }
            })

            setLoading(false)
            return
          }

          allSearchResultsRef.current = []

          // 发送keywords数组给后端，后端会并发多cookie查询
          const response = await searchAdCreateService.getMediaList({
            advertiser_id: advertiserId,
            selected_cookie_id: cookieConfigId,
            offset: 0,
            limit: 100, // 后端每个关键字最多100条，会合并去重
            keywords: keywords
          })

          if (response.code === 0 && response.data?.list) {
            let list = response.data.list

            // 如果只显示横屏视频，过滤出横屏视频（width > height）
            if (onlyLandscapeVideo) {
              list = list.filter((item: MediaItem) => {
                if (!item.video_width || !item.video_height) return false
                return item.video_width > item.video_height
              })
            }

            allSearchResultsRef.current = list

            // 前端分页显示
            const startIndex = (page - 1) * pageSize
            const endIndex = startIndex + pageSize
            const paginatedList = list.slice(startIndex, endIndex)

            setMediaList(paginatedList)
            const total = response.data.range?.total_num || list.length
            setTotalNum(total)

            // 更新选中素材缓存：从完整结果列表中查找已选中的素材并缓存
            list.forEach((item: MediaItem) => {
              if (selectedMediaIdsRef.current.includes(item.media_id)) {
                selectedMediaCacheRef.current.set(item.media_id, item)
              }
            })

            // 重置当前页的无效素材标记
            setInvalidMediaIds((prev) => {
              const newSet = new Set(prev)
              paginatedList.forEach((item: MediaItem) => {
                newSet.delete(item.media_id)
              })
              return newSet
            })

            // 更新缓存
            const currentInvalidIds = cacheRef.current?.invalidMediaIds || new Set<string>()
            cacheRef.current = {
              mediaList: paginatedList,
              totalNum: total,
              currentPage: page,
              keyword: keywordStr,
              invalidMediaIds: new Set(currentInvalidIds)
            }

            // 批量检查素材是否符合版位要求
            batchValidateMediaPlacement(paginatedList, token)
          } else {
            console.error('Failed to load media list:', response.error)
            setMediaList([])
          }
        } else {
          // 单关键字查询：使用原有逻辑
          setIsMultiKeywordSearch(false)
          allSearchResultsRef.current = []

          const offset = (page - 1) * pageSize

          const response = await searchAdCreateService.getMediaList({
            advertiser_id: advertiserId,
            selected_cookie_id: cookieConfigId,
            offset,
            limit: pageSize,
            keyword: keywordStr || undefined
          })

          if (response.code === 0 && response.data?.list) {
            let list = response.data.list

            // 如果只显示横屏视频，过滤出横屏视频（width > height）
            if (onlyLandscapeVideo) {
              list = list.filter((item: MediaItem) => {
                if (!item.video_width || !item.video_height) return false
                return item.video_width > item.video_height
              })
            }

            setMediaList(list)
            const total = response.data.range?.total_num || 0
            setTotalNum(total)

            // 更新选中素材缓存：如果当前页有已选中的素材，更新缓存
            list.forEach((item: MediaItem) => {
              if (selectedMediaIdsRef.current.includes(item.media_id)) {
                selectedMediaCacheRef.current.set(item.media_id, item)
              }
            })

            // 重置当前页的无效素材标记（保留其他页的标记）
            const currentInvalidIds = new Set<string>()
            list.forEach((item: MediaItem) => {
              // 从全局无效标记中恢复（如果存在）
              if (invalidMediaIds.has(item.media_id)) {
                currentInvalidIds.add(item.media_id)
              }
            })
            setInvalidMediaIds((prev) => {
              const newSet = new Set(prev)
              list.forEach((item: MediaItem) => {
                newSet.delete(item.media_id)
              })
              currentInvalidIds.forEach((id) => {
                newSet.add(id)
              })
              return newSet
            })

            // 缓存当前页数据
            const cacheKey = keywordStr || '__empty__'
            if (!pageCacheRef.current.has(cacheKey)) {
              pageCacheRef.current.set(cacheKey, new Map())
            }
            const pageCache = pageCacheRef.current.get(cacheKey)!
            pageCache.set(page, {
              mediaList: list,
              invalidMediaIds: new Set(currentInvalidIds)
            })
            totalNumCacheRef.current.set(cacheKey, total)

            // 更新缓存引用
            cacheRef.current = {
              mediaList: list,
              totalNum: total,
              currentPage: page,
              keyword: keywordStr,
              invalidMediaIds: new Set(currentInvalidIds)
            }

            // 批量检查素材是否符合版位要求（使用已获取的Token）
            batchValidateMediaPlacement(list, token).then(() => {
              // 更新缓存中的无效素材标记
              if (cacheRef.current) {
                const currentInvalidIds = invalidMediaIds
                cacheRef.current.invalidMediaIds = new Set(currentInvalidIds)
              }
              // 更新分页缓存中的无效标记
              const cacheKey = keywordStr || '__empty__'
              const pageCache = pageCacheRef.current.get(cacheKey)
              if (pageCache && pageCache.has(page)) {
                const cachedData = pageCache.get(page)!
                cachedData.invalidMediaIds = new Set(invalidMediaIds)
              }
            })
          } else {
            console.error('Failed to load media list:', response.error)
            setMediaList([])
          }
        }
      } catch (error) {
        console.error('Failed to load media list:', error)
        setMediaList([])
      } finally {
        setLoading(false)
      }
    },
    [
      advertiserId,
      cookieConfigId,
      pageSize,
      batchValidateMediaPlacement,
      loadTaccToken,
      onlyLandscapeVideo,
      parseKeywords
    ]
  )

  // 同步 loadMediaList 到 ref
  useEffect(() => {
    loadMediaListRef.current = loadMediaList
  }, [loadMediaList])

  // 同步 keyword 到 ref
  useEffect(() => {
    keywordRef.current = keyword
  }, [keyword])

  // 只在对话框从关闭变为打开时恢复缓存或初始化
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const initialSelectedIds = new Set(selectedMediaIdsRef.current)
      setSelectedIds(initialSelectedIds)
      // 初始化选中素材缓存（如果有已加载的素材，会在这里缓存）
      selectedMediaCacheRef.current.clear()

      // 如果有缓存，恢复缓存数据
      if (cacheRef.current) {
        setMediaList(cacheRef.current.mediaList)
        setTotalNum(cacheRef.current.totalNum)
        setCurrentPage(cacheRef.current.currentPage)
        setKeyword(cacheRef.current.keyword)
        keywordRef.current = cacheRef.current.keyword
        setInvalidMediaIds(new Set(cacheRef.current.invalidMediaIds))
        // 根据关键字判断是否为多关键字查询
        const keywords = parseKeywords(cacheRef.current.keyword)
        setIsMultiKeywordSearch(keywords.length > 1)

        // 从已加载的素材列表中更新缓存
        cacheRef.current.mediaList.forEach((item) => {
          if (initialSelectedIds.has(item.media_id)) {
            selectedMediaCacheRef.current.set(item.media_id, item)
          }
        })
      } else {
        // 没有缓存时，初始化并加载第一页
        setCurrentPage(1)
        setKeyword('')
        keywordRef.current = ''
        setIsMultiKeywordSearch(false)
        allSearchResultsRef.current = []
        if (loadMediaListRef.current) {
          loadMediaListRef.current(1)
        }
      }
    } else if (!open && prevOpenRef.current) {
      // 对话框关闭时，重置多关键字搜索状态
      setIsMultiKeywordSearch(false)
      allSearchResultsRef.current = []
    }
    prevOpenRef.current = open
  }, [open, parseKeywords])

  // 处理关键字输入变化
  const handleKeywordChange = (value: string): void => {
    setKeyword(value)
    keywordRef.current = value
  }

  // 处理搜索按钮点击
  const handleSearch = (): void => {
    const keywordStr = keywordRef.current.trim()
    const keywords = parseKeywords(keywordStr)

    // 清除当前查询条件的缓存
    if (keywords.length === 1) {
      const cacheKey = keywordStr || '__empty__'
      pageCacheRef.current.delete(cacheKey)
      totalNumCacheRef.current.delete(cacheKey)
    } else {
      // 多关键字查询：清除所有结果缓存
      allSearchResultsRef.current = []
    }

    setCurrentPage(1)
    if (loadMediaListRef.current) {
      loadMediaListRef.current(1)
    }
  }

  // 处理快捷键搜索：Ctrl+Enter 或 Cmd+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSearch()
    }
  }

  // 处理粘贴事件：将空格替换为换行，并去除空白行
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')

    // 将空格（包括多个连续空格）替换为换行
    let processedText = pastedText.replace(/[\s]+/g, '\n')

    // 去除空白行（包括只有空白字符的行）
    processedText = processedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')

    // 更新文本框的值
    handleKeywordChange(processedText)
  }

  const handlePageChange = (page: number): void => {
    setCurrentPage(page)
    // 如果是多关键字查询，直接从前端分页数据中获取（已缓存）
    if (isMultiKeywordSearch && allSearchResultsRef.current.length > 0) {
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedList = allSearchResultsRef.current.slice(startIndex, endIndex)
      setMediaList(paginatedList)

      // 更新选中素材缓存：确保当前页的选中素材被缓存
      paginatedList.forEach((item: MediaItem) => {
        if (selectedIds.has(item.media_id)) {
          selectedMediaCacheRef.current.set(item.media_id, item)
        }
      })

      // 更新缓存引用
      if (cacheRef.current) {
        cacheRef.current.mediaList = paginatedList
        cacheRef.current.currentPage = page
      }
    } else {
      // 单关键字查询，loadMediaList 会检查缓存
      if (loadMediaListRef.current) {
        loadMediaListRef.current(page)
      }
    }
  }

  const handleToggleSelect = (mediaId: string): void => {
    // 如果素材不符合版位要求，不允许选择
    if (invalidMediaIds.has(mediaId)) {
      return
    }

    const newSelectedIds = new Set(selectedIds)
    if (newSelectedIds.has(mediaId)) {
      // 取消选中：从选中ID集合和缓存中移除
      newSelectedIds.delete(mediaId)
      selectedMediaCacheRef.current.delete(mediaId)
    } else {
      // 选中：添加到选中ID集合，并从当前页素材列表中找到完整信息并缓存
      newSelectedIds.add(mediaId)
      const mediaItem = mediaList.find((item) => item.media_id === mediaId)
      if (mediaItem) {
        selectedMediaCacheRef.current.set(mediaId, mediaItem)
      }
    }
    setSelectedIds(newSelectedIds)
  }

  // 获取当前页面可选的素材ID列表（排除无效的）
  const getSelectableMediaIds = useCallback((): string[] => {
    return mediaList
      .filter((item) => !invalidMediaIds.has(item.media_id))
      .map((item) => item.media_id)
  }, [mediaList, invalidMediaIds])

  // 判断当前页面是否全部选中
  const isAllSelected = useCallback((): boolean => {
    const selectableIds = getSelectableMediaIds()
    if (selectableIds.length === 0) return false
    return selectableIds.every((id) => selectedIds.has(id))
  }, [getSelectableMediaIds, selectedIds])

  // 全选当前页面的可选素材
  const handleSelectAll = (): void => {
    const selectableIds = getSelectableMediaIds()
    const newSelectedIds = new Set(selectedIds)
    selectableIds.forEach((id) => {
      newSelectedIds.add(id)
      // 从当前页素材列表中找到完整信息并缓存
      const mediaItem = mediaList.find((item) => item.media_id === id)
      if (mediaItem) {
        selectedMediaCacheRef.current.set(id, mediaItem)
      }
    })
    setSelectedIds(newSelectedIds)
  }

  // 取消全选当前页面的素材
  const handleDeselectAll = (): void => {
    const selectableIds = getSelectableMediaIds()
    const newSelectedIds = new Set(selectedIds)
    selectableIds.forEach((id) => {
      newSelectedIds.delete(id)
      // 从缓存中移除
      selectedMediaCacheRef.current.delete(id)
    })
    setSelectedIds(newSelectedIds)
  }

  const handleConfirm = (): void => {
    // 从缓存中获取所有选中素材的完整信息
    const selectedMedia = Array.from(selectedIds)
      .map((mediaId) => selectedMediaCacheRef.current.get(mediaId))
      .filter((item): item is MediaItem => item !== undefined)
      .map((item) => ({
        media_id: item.media_id,
        media_description: item.media_description,
        base_media_url: item.base_media_url,
        key_frame_image_url: item.key_frame_image_url,
        cover_image_id: item.cover_image_id,
        video_width: item.video_width,
        video_height: item.video_height
      }))

    onConfirm(selectedMedia)
    onOpenChange(false)
  }

  const totalPages = Math.ceil(totalNum / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {onlyLandscapeVideo ? '第一步：选择横屏视频素材' : '第二步：选择素材（横屏/竖屏）'}
          </DialogTitle>
        </DialogHeader>

        {/* 关键字搜索框 */}
        <div className="px-6 pb-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="keyword-search" className="whitespace-nowrap">
                关键字搜索：
              </Label>
              <Button onClick={handleSearch} disabled={loading} size="sm">
                <Search className="w-4 h-4 mr-1" />
                搜索
              </Button>
            </div>
            <Textarea
              id="keyword-search"
              placeholder={`每行输入一个关键字，支持多关键字并发查询
例如：
关键字1
关键字2
关键字3`}
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={4}
              className="resize-none"
            />
            {isMultiKeywordSearch && (
              <div className="text-xs text-muted-foreground">
                多关键字查询模式：已并发查询 {parseKeywords(keyword).length}{' '}
                个关键字，结果已合并去重
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : mediaList.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              暂无素材
            </div>
          ) : (
            <>
              {/* 全选/取消全选按钮 */}
              <div className="px-6 pb-4 flex items-center justify-between border-b">
                <div className="text-sm text-muted-foreground">
                  当前页面可选素材：{getSelectableMediaIds().length} 个
                </div>
                <div className="flex items-center gap-2">
                  {isAllSelected() ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      disabled={getSelectableMediaIds().length === 0}
                    >
                      取消全选
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={getSelectableMediaIds().length === 0}
                    >
                      全选
                    </Button>
                  )}
                </div>
              </div>
              <div className="px-6 pt-4">
                <div className="grid grid-cols-8 gap-4">
                  {mediaList.map((item) => {
                    const isSelected = selectedIds.has(item.media_id)
                    const isInvalid = invalidMediaIds.has(item.media_id)
                    const isChecking = checkingMediaIds.has(item.media_id)
                    return (
                      <div
                        key={item.media_id}
                        className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                          isInvalid
                            ? 'border-red-300 bg-red-50/50 cursor-not-allowed opacity-60'
                            : isSelected
                              ? 'border-primary shadow-lg cursor-pointer'
                              : 'border-transparent hover:border-gray-300 cursor-pointer'
                        }`}
                        onClick={() => handleToggleSelect(item.media_id)}
                        title={isInvalid ? '不符合版位要求' : item.media_description}
                      >
                        <div className="aspect-[9/16] bg-gray-100 relative">
                          <img
                            src={convertToHttps(item.key_frame_image_url)}
                            alt={item.media_description}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3E图片加载失败%3C/text%3E%3C/svg%3E'
                            }}
                          />
                          {item.media_duration_second && (
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                              {Math.floor(item.media_duration_second / 60)}:
                              {String(item.media_duration_second % 60).padStart(2, '0')}
                            </div>
                          )}
                          {isChecking && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            </div>
                          )}
                          {!isChecking && isInvalid && (
                            <div
                              className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                              title="不符合版位要求"
                            >
                              <svg
                                className="w-4 h-4 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </div>
                          )}
                          {!isChecking && !isInvalid && isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7"></path>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p
                            className="text-xs text-gray-700 truncate"
                            title={item.media_description}
                          >
                            {item.media_description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">ID:{item.media_id}</p>
                          {item.video_width && item.video_height && (
                            <p className="text-xs text-gray-500 mt-1">
                              {item.video_width}×{item.video_height}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              共 {totalNum} 个素材，已选择 {selectedIds.size} 个
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!hasPrevPage || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一页
              </Button>
              <span className="text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage || loading}
              >
                下一页
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>确定（已选择 {selectedIds.size} 个）</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
