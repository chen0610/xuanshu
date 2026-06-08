import { ipcMain, shell } from 'electron'
import {
  videoDownloadManager,
  type VideoDownloadBatchState,
  type VideoDownloadProxyConfig,
  type VideoDownloadTaskInput
} from './video-download-manager'

export function registerVideoDownloadIpc(): void {
  ipcMain.removeHandler('video-download:start')
  ipcMain.removeHandler('video-download:append')
  ipcMain.removeHandler('video-download:clear-completed')
  ipcMain.removeHandler('video-download:pause')
  ipcMain.removeHandler('video-download:resume')
  ipcMain.removeHandler('video-download:cancel')
  ipcMain.removeHandler('video-download:retry-failed')
  ipcMain.removeHandler('video-download:get-state')
  ipcMain.removeHandler('video-download:open-folder')

  ipcMain.handle(
    'video-download:start',
    async (
      _,
      payload: {
        saveDir: string
        tasks: VideoDownloadTaskInput[]
        concurrency?: number
        proxyConfig?: VideoDownloadProxyConfig
      }
    ) => videoDownloadManager.startBatch(payload)
  )

  ipcMain.handle(
    'video-download:append',
    async (_, payload: { tasks: VideoDownloadTaskInput[] }) => videoDownloadManager.appendTasks(payload)
  )

  ipcMain.handle('video-download:clear-completed', async () => videoDownloadManager.clearCompleted())

  ipcMain.handle('video-download:pause', async () => videoDownloadManager.pause())

  ipcMain.handle('video-download:resume', async () => videoDownloadManager.resume())

  ipcMain.handle('video-download:cancel', async () => videoDownloadManager.cancel())

  ipcMain.handle(
    'video-download:retry-failed',
    async (_, payload: { tasks: VideoDownloadTaskInput[] }) =>
      videoDownloadManager.retryFailed(payload)
  )

  ipcMain.handle(
    'video-download:get-state',
    async (): Promise<VideoDownloadBatchState | null> => videoDownloadManager.getState()
  )

  ipcMain.handle('video-download:open-folder', async () => {
    const state = videoDownloadManager.getState()
    if (!state?.saveDir) {
      return { ok: false, error: '没有可打开的目录' }
    }
    const result = await shell.openPath(state.saveDir)
    if (result) {
      return { ok: false, error: result }
    }
    return { ok: true }
  })
}
