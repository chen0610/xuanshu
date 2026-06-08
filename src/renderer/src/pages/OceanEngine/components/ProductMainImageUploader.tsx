import React, { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, RotateCcw, UploadCloud, X } from 'lucide-react'
import { Button, Input, Label } from '../../../components/ui'
import { toast } from 'sonner'

const OUTPUT_SIZE = 108
const MIN_ZOOM = 1
const MAX_ZOOM = 3

type ProductMainImageUploaderProps = {
  imageId: string
  previewUrl: string
  uploading: boolean
  disabled?: boolean
  onUpload: (file: File) => Promise<void>
  onClear: () => void
}

type SourceImage = {
  file: File
  url: string
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function loadImage(file: File): Promise<SourceImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      resolve({ file, url, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    image.src = url
  })
}

async function cropToSquarePng(source: SourceImage, zoom: number, offsetX: number, offsetY: number): Promise<File> {
  const image = new Image()
  image.src = source.url
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前环境不支持图片裁剪')

  const baseScale = Math.max(OUTPUT_SIZE / source.width, OUTPUT_SIZE / source.height)
  const scale = baseScale * zoom
  const drawWidth = source.width * scale
  const drawHeight = source.height * scale
  const maxOffsetX = Math.max(0, (drawWidth - OUTPUT_SIZE) / 2)
  const maxOffsetY = Math.max(0, (drawHeight - OUTPUT_SIZE) / 2)
  const safeOffsetX = clamp(offsetX, -maxOffsetX, maxOffsetX)
  const safeOffsetY = clamp(offsetY, -maxOffsetY, maxOffsetY)
  const dx = (OUTPUT_SIZE - drawWidth) / 2 + safeOffsetX
  const dy = (OUTPUT_SIZE - drawHeight) / 2 + safeOffsetY

  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('图片裁剪失败'))
    }, 'image/png')
  })
  return new File([blob], `product-main-${Date.now()}.png`, { type: 'image/png' })
}

export const ProductMainImageUploader: React.FC<ProductMainImageUploaderProps> = ({
  imageId,
  previewUrl,
  uploading,
  disabled = false,
  onUpload,
  onClear
}) => {
  const [source, setSource] = useState<SourceImage | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (source?.url) URL.revokeObjectURL(source.url)
    }
  }, [source])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    try {
      const next = await loadImage(file)
      setSource((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url)
        return next
      })
      setZoom(1)
      setOffsetX(0)
      setOffsetY(0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片读取失败')
    }
  }

  const handleUpload = async (): Promise<void> => {
    if (!source) {
      toast.error('请先选择产品主图')
      return
    }
    try {
      const cropped = await cropToSquarePng(source, zoom, offsetX, offsetY)
      await onUpload(cropped)
      setSource((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url)
        return null
      })
      setZoom(1)
      setOffsetX(0)
      setOffsetY(0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传产品主图失败')
    }
  }

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">产品主图</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            上传会先裁剪为 108×108，并写入 product_info.image_ids；仅使用账户列表第一个广告主上传，其余账户共用同一
            image_id。巨量要求至少 1 张主图，单图场景下上限 10 张。
          </p>
        </div>
        {imageId && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={uploading || disabled}>
            <X className="mr-1 h-4 w-4" />
            清空
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border bg-background shadow-sm">
            {source ? (
              <div className="relative h-[108px] w-[108px] overflow-hidden rounded-xl border bg-black/5">
                <img
                  src={source.url}
                  alt="待裁剪产品主图"
                  className="h-full w-full object-cover"
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                    transformOrigin: 'center'
                  }}
                />
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="产品主图预览" className="h-[108px] w-[108px] rounded-xl object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <ImagePlus className="h-8 w-8" />
                108×108 预览
              </div>
            )}
          </div>
          {imageId && <p className="break-all text-[11px] leading-4 text-muted-foreground">image_id: {imageId}</p>}
        </div>

        <div className="space-y-3">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading || disabled}>
              <ImagePlus className="mr-2 h-4 w-4" />
              选择图片
            </Button>
            <Button type="button" onClick={() => void handleUpload()} disabled={!source || uploading || disabled}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              裁剪并上传
            </Button>
            {source && (
              <Button
                type="button"
                variant="ghost"
                disabled={uploading || disabled}
                onClick={() => {
                  setZoom(1)
                  setOffsetX(0)
                  setOffsetY(0)
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重置裁剪
              </Button>
            )}
          </div>

          {source && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">缩放</Label>
                <Input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.05}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">左右</Label>
                <Input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={offsetX}
                  onChange={(event) => setOffsetX(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">上下</Label>
                <Input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={offsetY}
                  onChange={(event) => setOffsetY(Number(event.target.value))}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
