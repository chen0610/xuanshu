import { motion } from 'framer-motion'
import { Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useUpdateStore } from '../stores/update.store'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Progress } from './ui/progress'

export const UpdateDialog = () => {
  const { status, updateInfo, progress, error, isDialogOpen, setDialogOpen } = useUpdateStore()

  const handleInstall = async () => {
    try {
      await window.api.update.installUpdate()
    } catch (err) {
      console.error('Failed to install update:', err)
    }
  }

  const handleClose = () => {
    setDialogOpen(false)
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  const isActiveFlow =
    status === 'checking' ||
    status === 'available' ||
    status === 'downloading' ||
    status === 'downloaded' ||
    status === 'not-available' ||
    status === 'error'

  return (
    <Dialog open={isDialogOpen && isActiveFlow} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'checking' && (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                正在检查更新
              </>
            )}
            {(status === 'available' || status === 'downloading') && (
              <>
                <Download className="h-5 w-5 animate-pulse" />
                {status === 'downloading' ? '正在下载更新' : '发现新版本'}
              </>
            )}
            {status === 'downloaded' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                更新已准备就绪
              </>
            )}
            {status === 'not-available' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                已是最新版本
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                更新失败
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === 'checking' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-8"
            >
              <p className="text-muted-foreground">正在连接更新服务器...</p>
            </motion.div>
          )}

          {(status === 'available' || status === 'downloading') && updateInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div>
                <p className="text-sm font-medium">新版本: v{updateInfo.version}</p>
                {updateInfo.releaseDate && (
                  <p className="text-xs text-muted-foreground">
                    发布时间: {new Date(updateInfo.releaseDate).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>
              {updateInfo.releaseNotes && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium mb-2">更新内容:</p>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}
              {status === 'downloading' && progress ? (
                <div className="space-y-3">
                  <Progress value={progress.percent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.percent.toFixed(1)}%</span>
                    <span>
                      {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                    </span>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    下载速度: {formatSpeed(progress.bytesPerSecond)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">正在准备下载...</p>
              )}
            </motion.div>
          )}

          {status === 'downloaded' && updateInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <p className="text-sm">
                新版本 <span className="font-medium">v{updateInfo.version}</span> 已下载完成。
              </p>
              <p className="text-sm text-muted-foreground">
                退出应用时将自动安装。也可点击「立即安装」立即重启完成更新。
              </p>
            </motion.div>
          )}

          {status === 'not-available' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-8"
            >
              <p className="text-muted-foreground">当前已是最新版本</p>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <div className="rounded-md bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error || '检查更新时发生错误'}</p>
              </div>
              <p className="text-xs text-muted-foreground">请稍后重试或联系技术支持</p>
            </motion.div>
          )}
        </div>

        <DialogFooter>
          {(status === 'available' || status === 'downloading') && (
            <Button variant="outline" onClick={handleClose}>
              后台下载
            </Button>
          )}

          {status === 'downloaded' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                退出时安装
              </Button>
              <Button onClick={handleInstall}>
                <RefreshCw className="h-4 w-4 mr-2" />
                立即安装
              </Button>
            </>
          )}

          {(status === 'not-available' || status === 'error') && (
            <Button onClick={handleClose}>关闭</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
