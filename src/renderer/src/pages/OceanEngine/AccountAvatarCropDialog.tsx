import React, { useState, useCallback } from 'react'
import 'react-easy-crop/react-easy-crop.css'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button
} from '../../components/ui'
import { Loader2 } from 'lucide-react'
import { cropToSquarePngBlob } from './accountAvatarCrop'

/** 小于 1 才能缩小图片，使整图能落入裁剪框（与 Cropper 的 minZoom 一致） */
const ZOOM_MIN = 0.1
const ZOOM_MAX = 4

type AccountAvatarCropDialogProps = {
  open: boolean
  imageSrc: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (pngBlob: Blob) => void | Promise<void>
}

export const AccountAvatarCropDialog: React.FC<AccountAvatarCropDialogProps> = ({
  open,
  imageSrc,
  onOpenChange,
  onConfirm
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async (): Promise<void> => {
    if (!imageSrc || !croppedAreaPixels) return
    setBusy(true)
    try {
      const blob = await cropToSquarePngBlob(imageSrc, croppedAreaPixels, 300)
      await Promise.resolve(onConfirm(blob))
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
  }, [open, imageSrc])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>裁剪头像</DialogTitle>
          <DialogDescription>
            拖拽移动；滚轮或下方滑块缩放（可缩小到 10% 以把整图纳入方框）。框内区域导出为 300×300 PNG。
          </DialogDescription>
        </DialogHeader>
        {imageSrc && (
          <div
            className="relative mx-auto w-full max-w-[360px] rounded-md border bg-black/80 overflow-hidden"
            style={{ height: 320 }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              objectFit="contain"
              minZoom={ZOOM_MIN}
              maxZoom={ZOOM_MAX}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        )}
        <div className="space-y-2">
          <label className="block text-sm text-muted-foreground">
            缩放（可小于 100% 以把整图缩进裁剪框）
          </label>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.02}
            value={Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
            disabled={!imageSrc}
          />
          <p className="text-xs text-muted-foreground">
            原先为 1:1 时，请向左拖动缩小；若仍对不齐，可滚轮继续微调。
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={!imageSrc || !croppedAreaPixels || busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                处理中…
              </>
            ) : (
              '确认裁剪（300×300）'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
