import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Notification } from 'electron'
import log from 'electron-log'

/** 定期轮询间隔：6 小时 */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

// 配置日志
log.transports.file.level = 'info'
autoUpdater.logger = log

// 静默下载，退出时自动安装
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

export interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

export interface UpdateProgressInfo {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdateEventMeta {
  manual?: boolean
  silent?: boolean
}

export interface UpdaterCallbacks {
  onStateChange?: () => void
}

let mainWindowRef: BrowserWindow | null = null
let callbacks: UpdaterCallbacks = {}
let periodicTimer: NodeJS.Timeout | null = null
let isManualCheck = false
/** 已下载完成、待安装的更新（仅 update-downloaded 后赋值） */
let pendingUpdateInfo: UpdateInfo | null = null
/** 已发现但尚未下载完成的版本信息 */
let downloadingUpdateInfo: UpdateInfo | null = null
/** 静默下载是否已发送「开始下载」通知，避免重复 */
let silentDownloadNotified = false

function clearUpdateState(): void {
  pendingUpdateInfo = null
  downloadingUpdateInfo = null
  silentDownloadNotified = false
}

function notifyStateChange(): void {
  callbacks.onStateChange?.()
}

function showNativeNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({ title, body })
  if (onClick) {
    notification.on('click', onClick)
  }
  notification.show()
}

function sendToRenderer(channel: string, payload?: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload)
  }
}

function resetManualCheckFlag(): void {
  isManualCheck = false
}

/**
 * 初始化自动更新模块
 */
export function initUpdater(mainWindow: BrowserWindow, updaterCallbacks?: UpdaterCallbacks): void {
  mainWindowRef = mainWindow
  callbacks = updaterCallbacks ?? {}

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    downloadingUpdateInfo = null
    silentDownloadNotified = false
    sendToRenderer('update-checking', { manual: isManualCheck })
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info)
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseNotes: info.releaseNotes as string,
      releaseDate: info.releaseDate
    }
    downloadingUpdateInfo = updateInfo

    sendToRenderer('update-available', {
      ...updateInfo,
      silent: !isManualCheck
    })

    notifyStateChange()
  })

  autoUpdater.on('update-not-available', () => {
    log.info('Update not available')
    downloadingUpdateInfo = null
    sendToRenderer('update-not-available', { manual: isManualCheck })
    resetManualCheckFlag()
    notifyStateChange()
  })

  autoUpdater.on('download-progress', (progressInfo) => {
    const progress: UpdateProgressInfo = {
      percent: progressInfo.percent,
      bytesPerSecond: progressInfo.bytesPerSecond,
      transferred: progressInfo.transferred,
      total: progressInfo.total
    }
    log.info(`Download progress: ${progress.percent.toFixed(2)}%`)
    sendToRenderer('update-download-progress', progress)

    if (
      !isManualCheck &&
      !silentDownloadNotified &&
      downloadingUpdateInfo &&
      progressInfo.transferred > 0
    ) {
      silentDownloadNotified = true
      showNativeNotification(
        '正在下载更新',
        `v${downloadingUpdateInfo.version} 正在后台下载，完成后将在退出时自动安装`
      )
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info)
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseNotes: info.releaseNotes as string,
      releaseDate: info.releaseDate
    }
    pendingUpdateInfo = updateInfo
    downloadingUpdateInfo = null

    const silent = !isManualCheck
    sendToRenderer('update-downloaded', { ...updateInfo, silent })

    if (silent) {
      showNativeNotification(
        '更新已就绪',
        `v${info.version} 已下载完成，退出应用时将自动安装。点击查看详情。`,
        () => {
          if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            if (mainWindowRef.isMinimized()) mainWindowRef.restore()
            mainWindowRef.show()
            mainWindowRef.focus()
          }
          sendToRenderer('update-show-dialog')
        }
      )
    }

    resetManualCheckFlag()
    notifyStateChange()
  })

  autoUpdater.on('error', (error) => {
    log.error('Update error:', error)
    clearUpdateState()
    sendToRenderer('update-error', {
      message: error.message || 'Unknown error occurred',
      manual: isManualCheck
    })
    resetManualCheckFlag()
    notifyStateChange()
  })

  log.info('Updater initialized (silent download enabled)')
}

/**
 * 检查更新
 * @param manual 是否为用户手动触发（手动触发会弹出更新对话框）
 */
export async function checkForUpdates(manual = false): Promise<void> {
  isManualCheck = manual
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    log.error('Failed to check for updates:', error)
    clearUpdateState()
    resetManualCheckFlag()
    notifyStateChange()
    throw error
  }
}

/**
 * 下载更新（手动触发时使用，静默模式下 autoDownload 已自动下载）
 */
export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    log.error('Failed to download update:', error)
    throw error
  }
}

/**
 * 安装更新并重启应用
 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true)
}

/**
 * 启动定期更新检查
 */
export function startPeriodicUpdateCheck(): void {
  stopPeriodicUpdateCheck()
  periodicTimer = setInterval(() => {
    checkForUpdates(false).catch((err) => log.error('Periodic update check failed:', err))
  }, UPDATE_CHECK_INTERVAL_MS)
  log.info(`Periodic update check started (every ${UPDATE_CHECK_INTERVAL_MS / 3600000}h)`)
}

/**
 * 停止定期更新检查
 */
export function stopPeriodicUpdateCheck(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}

/**
 * 获取待安装的更新信息
 */
export function getPendingUpdateInfo(): UpdateInfo | null {
  return pendingUpdateInfo
}

/**
 * 更新托盘提示文本
 */
export function getTrayTooltip(baseTooltip: string): string {
  if (pendingUpdateInfo) {
    return `${baseTooltip} · v${pendingUpdateInfo.version} 待安装`
  }
  return baseTooltip
}
