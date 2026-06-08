import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  globalShortcut
} from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { readFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initUpdater, checkForUpdates, downloadUpdate, quitAndInstall, startPeriodicUpdateCheck, stopPeriodicUpdateCheck, getPendingUpdateInfo, getTrayTooltip } from './updater'
import { registerLianshanTosMultipartIpc } from './lianshan-tos-ipc'
import { registerVideoDownloadIpc } from './video-download-ipc'
import { videoDownloadManager } from './video-download-manager'
import {
  attachLoginAutofill,
  clearStoredLoginCredentials,
  loadStoredLoginCredentials,
  saveStoredLoginCredentials,
  persistLoginCredentialsIfRequested,
  resolveLoginCredentials,
  type OpenLoginWindowOptions
} from './login-credentials'

// 读取版本号
function getAppVersion(): string {
  try {
    // 优先使用 app.getVersion()（由 electron-builder 设置）
    const appVersion = app.getVersion()
    if (appVersion && appVersion !== '0.0.0') {
      return appVersion
    }
  } catch (error) {
    console.error('Failed to get version from app:', error)
  }

  try {
    // 如果 app.getVersion() 不可用，尝试从 package.json 读取
    const packagePath = join(__dirname, '../../package.json')
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
      return packageJson.version || '1.0.0'
    }
  } catch (error) {
    console.error('Failed to read version from package.json:', error)
  }

  return '1.0.0'
}

const APP_VERSION = getAppVersion()
const APP_NAME = '玄枢'

// 平台配置
interface PlatformConfig {
  name: string
  loginUrl: string
  cookieDomain: string
  requiredCookies: string[] // 必须包含的Cookie
  optionalCookies?: string[] // 可选Cookie，如果存在则包含
  successUrlPatterns?: string[] // 登录成功后URL匹配模式数组，到达任一URL后即可获取Cookie
}

const PLATFORM_CONFIG: Record<'ocean' | 'tencent' | 'changdu', PlatformConfig> = {
  ocean: {
    name: '巨量引擎',
    loginUrl: 'https://business.oceanengine.com/login?appKey=51',
    cookieDomain: '.oceanengine.com',
    requiredCookies: ['sessionid', 'csrftoken'], // 必须有sessionid
    optionalCookies: [],
    successUrlPatterns: [
      'https://business.oceanengine.com/site/',
      'https://business.oceanengine.com/version-select'
    ] // 登录成功后URL匹配模式数组
  },
  tencent: {
    name: '腾讯广告',
    loginUrl:
      'https://sso.e.qq.com/login/hub?sso_redirect_uri=https%3A%2F%2Fad.qq.com%2F&service_tag=10',
    cookieDomain: '.qq.com',
    requiredCookies: ['gdt_token', 'gdt_protect'],
    optionalCookies: [],
    successUrlPatterns: [
      'https://ad.qq.com/cm/',
      'https://ad.qq.com/',
      'https://e.qq.com/',
      'https://ad.qq.com/athena/',
      'https://ad.qq.com/horizon/'
    ] // 登录成功后可能的URL模式数组
  },
  changdu: {
    name: '常读平台',
    loginUrl: 'https://www.changdupingtai.com/page/home',
    cookieDomain: '.changdupingtai.com',
    requiredCookies: ['sessionid', 'passport_csrf_token'],
    optionalCookies: [],
    successUrlPatterns: ['https://www.changdupingtai.com/']
  }
}

// 登录窗口结果类型
interface LoginWindowResult {
  success: boolean
  cookies?: string
  error?: string
}

// 飞书授权窗口结果类型
interface FeishuAuthResult {
  success: boolean
  message?: string
  code?: string
  state?: string
  error?: string
}

interface OceanEngineProjectCreateCaptureResult {
  success: boolean
  params?: unknown
  url?: string
  error?: string
}

interface OceanEngineProjectCreateWindowOptions {
  advertiserId: string
  cookie: string
}

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIndex = part.indexOf('=')
      if (eqIndex < 0) return null
      const name = part.slice(0, eqIndex).trim()
      const value = part.slice(eqIndex + 1).trim()
      return name ? { name, value } : null
    })
    .filter((item): item is { name: string; value: string } => item != null)
}

function extractUrlSearchParams(url: string): Record<string, string | string[]> {
  const parsed = new URL(url)
  const params: Record<string, string | string[]> = {}
  parsed.searchParams.forEach((value, key) => {
    const current = params[key]
    if (Array.isArray(current)) {
      current.push(value)
    } else if (current != null) {
      params[key] = [current, value]
    } else {
      params[key] = value
    }
  })
  return params
}

function parseRequestBodyText(raw: string): unknown {
  const text = raw.trim()
  if (!text) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    const params = new URLSearchParams(text)
    if ([...params.keys()].length === 0) return { _raw: raw }
    const result: Record<string, string | string[]> = {}
    params.forEach((value, key) => {
      const current = result[key]
      if (Array.isArray(current)) {
        current.push(value)
      } else if (current != null) {
        result[key] = [current, value]
      } else {
        result[key] = value
      }
    })
    return result
  }
}

function extractPostRequestParams(details: Electron.OnBeforeRequestListenerDetails): unknown {
  const chunks = details.uploadData
    ?.map((item) => item.bytes)
    .filter((bytes): bytes is Buffer => Buffer.isBuffer(bytes))

  if (!chunks || chunks.length === 0) {
    return extractUrlSearchParams(details.url)
  }

  return parseRequestBodyText(Buffer.concat(chunks).toString('utf8'))
}

async function openOceanEngineProjectCreateWindow(
  options: OceanEngineProjectCreateWindowOptions
): Promise<OceanEngineProjectCreateCaptureResult> {
  const advertiserId = options.advertiserId.trim()
  if (!advertiserId) return { success: false, error: '缺少广告主账户 ID' }
  if (!options.cookie.trim()) return { success: false, error: '缺少 Cookie' }

  const sessionId = `ocean-project-create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const targetUrl = `https://ad.oceanengine.com/superior/create-project?aadvid=${encodeURIComponent(advertiserId)}`

  return new Promise((resolve) => {
    const projectWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      title: '巨量引擎网页新建项目',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        partition: sessionId
      },
      parent: mainWindow || undefined,
      modal: false,
      autoHideMenuBar: true
    })

    let resolved = false
    const finish = async (result: OceanEngineProjectCreateCaptureResult): Promise<void> => {
      if (resolved) return
      resolved = true
      try {
        if (!projectWindow.isDestroyed()) projectWindow.close()
      } catch (error) {
        console.error('[巨量项目网页新建] 关闭窗口失败:', error)
      }
      try {
        await projectWindow.webContents.session.clearStorageData({
          storages: ['cookies', 'localstorage', 'cachestorage']
        })
      } catch (error) {
        console.error('[巨量项目网页新建] 清理会话失败:', error)
      }
      resolve(result)
    }

    projectWindow.webContents.setWindowOpenHandler((details) => {
      if (details.url.startsWith('http')) {
        projectWindow.loadURL(details.url)
      }
      return { action: 'deny' }
    })

    projectWindow.webContents.session.webRequest.onBeforeRequest(
      { urls: ['*://*/*'] },
      (details, callback) => {
        callback({ cancel: false })
        if (details.url.includes('/v2/project/create') && details.method === 'POST') {
          console.log('[巨量项目网页新建] 捕获项目创建 POST 请求:', details.url)
          void finish({
            success: true,
            url: details.url,
            params: extractPostRequestParams(details)
          })
        }
      }
    )

    projectWindow.on('closed', () => {
      void finish({ success: false, error: '用户关闭了网页新建窗口' })
    })

    const bootstrap = async (): Promise<void> => {
      try {
        const cookies = parseCookieHeader(options.cookie)
        for (const cookie of cookies) {
          await projectWindow.webContents.session.cookies.set({
            url: 'https://ad.oceanengine.com',
            domain: '.oceanengine.com',
            path: '/',
            name: cookie.name,
            value: cookie.value
          })
        }
        await projectWindow.loadURL(targetUrl)
      } catch (error) {
        await finish({
          success: false,
          error: error instanceof Error ? error.message : '打开网页新建窗口失败'
        })
      }
    }

    void bootstrap()
  })
}

// 全局变量
let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false // 标记是否真的要退出应用
let isUserLoggedIn = false // 标记用户是否已登录
let feishuAuthWindow: BrowserWindow | null = null // 飞书授权窗口
let oceanEngineAuthWindow: BrowserWindow | null = null // 巨量引擎 OAuth 授权窗口

// 创建应用菜单栏
function createApplicationMenu(): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    // 文件菜单
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // 可以添加新建功能
            console.log('新建')
          }
        },
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            // 可以添加打开功能
            console.log('打开')
          }
        },
        { type: 'separator' as const },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // 可以添加保存功能
            console.log('保存')
          }
        },
        { type: 'separator' as const },
        {
          label: '退出',
          ...(process.platform === 'darwin' ? { accelerator: 'Cmd+Q' } : {}),
          click: () => {
            isQuitting = true
            app.quit()
          }
        }
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo'
        },
        {
          label: '重做',
          accelerator: process.platform === 'darwin' ? 'Shift+Cmd+Z' : 'Ctrl+Y',
          role: 'redo'
        },
        { type: 'separator' as const },
        {
          label: '剪切',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: '复制',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: '粘贴',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: '全选',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll'
        }
      ]
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: (_item, focusedWindow) => {
            if (focusedWindow && focusedWindow instanceof BrowserWindow) {
              focusedWindow.reload()
            }
          }
        },
        {
          label: '强制重新加载',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (_item, focusedWindow) => {
            if (focusedWindow && focusedWindow instanceof BrowserWindow) {
              focusedWindow.webContents.reloadIgnoringCache()
            }
          }
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: (_item, focusedWindow) => {
            if (focusedWindow && focusedWindow instanceof BrowserWindow) {
              if (focusedWindow.webContents.isDevToolsOpened()) {
                focusedWindow.webContents.closeDevTools()
              } else {
                focusedWindow.webContents.openDevTools()
              }
            }
          }
        },
        { type: 'separator' as const },
        {
          label: '实际大小',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetZoom'
        },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+Plus',
          role: 'zoomIn'
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomOut'
        },
        { type: 'separator' as const },
        {
          label: '全屏',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: (_item, focusedWindow) => {
            if (focusedWindow && focusedWindow instanceof BrowserWindow) {
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
            }
          }
        }
      ]
    },
    // 窗口菜单（macOS）
    ...(process.platform === 'darwin'
      ? [
          {
            label: '窗口',
            submenu: [
              {
                label: '最小化',
                accelerator: 'Cmd+M',
                role: 'minimize' as const
              },
              {
                label: '关闭',
                accelerator: 'Cmd+W',
                role: 'close' as const
              },
              { type: 'separator' as const },
              {
                label: '前置全部窗口',
                role: 'front' as const
              }
            ]
          }
        ]
      : []),
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            if (mainWindow) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '关于',
                message: APP_NAME,
                detail: `版本: ${APP_VERSION}\n\n广告快捷投放工具`
              })
            }
          }
        },
        {
          label: '检查更新',
          click: async () => {
            try {
              await checkForUpdates(true)
            } catch (error) {
              console.error('检查更新失败:', error)
            }
          }
        },
        { type: 'separator' as const },
        {
          label: '访问官网',
          click: () => {
            shell.openExternal('https://xs.aiboy.cloud')
          }
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: `${APP_NAME} v${APP_VERSION}`,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // 禁用web安全策略以允许跨域请求
    }
  })

  // 更新全局 mainWindow 变量
  mainWindow = window
  videoDownloadManager.setMainWindow(window)

  // 监听窗口关闭事件
  window.on('close', (event) => {
    if (!isQuitting) {
      // 如果用户未登录，直接退出应用
      if (!isUserLoggedIn) {
        isQuitting = true
        app.quit()
        return
      }

      // 如果用户已登录，最小化到托盘
      event.preventDefault()
      window.hide()
      // Windows 和 Linux 上显示通知
      if (process.platform !== 'darwin' && tray) {
        tray.displayBalloon({
          title: '应用已最小化到托盘',
          content: '应用将继续在后台运行，点击托盘图标可以重新打开窗口。',
          icon: icon
        })
      }
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 渲染进程崩溃恢复机制
  let crashCount = 0
  const MAX_CRASH_RECOVERY_ATTEMPTS = 3
  const CRASH_RECOVERY_DELAY = 2000 // 2秒延迟后恢复

  // 监听渲染进程无响应事件
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details)
    if (details.reason === 'crashed' || details.reason === 'killed') {
      crashCount++

      if (crashCount <= MAX_CRASH_RECOVERY_ATTEMPTS) {
        console.log(
          `Attempting to recover from render process gone (${crashCount}/${MAX_CRASH_RECOVERY_ATTEMPTS})...`
        )
        setTimeout(() => {
          if (!window.isDestroyed()) {
            window.reload()
          }
        }, CRASH_RECOVERY_DELAY)
      } else {
        console.error('Max crash recovery attempts reached.')
        dialog.showErrorBox(
          '应用无响应',
          '渲染进程多次无响应，请重启应用。如果问题持续，请联系技术支持。'
        )
      }
    }
  })

  // 监听页面加载完成，重置崩溃计数
  window.webContents.on('did-finish-load', () => {
    // 页面成功加载后重置崩溃计数
    if (crashCount > 0) {
      console.log('Page loaded successfully, resetting crash count')
      crashCount = 0
    }
  })

  // 监听资源加载失败事件（ERR_FILE_NOT_FOUND 等）
  let loadFailureCount = 0
  const MAX_LOAD_FAILURE_RECOVERY_ATTEMPTS = 3
  const LOAD_FAILURE_RECOVERY_DELAY = 2000 // 2秒延迟后恢复

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('Resource load failed:', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })

      // 只处理主框架的加载失败（页面本身）
      if (isMainFrame) {
        loadFailureCount++

        if (loadFailureCount <= MAX_LOAD_FAILURE_RECOVERY_ATTEMPTS) {
          console.log(
            `Attempting to recover from load failure (${loadFailureCount}/${MAX_LOAD_FAILURE_RECOVERY_ATTEMPTS})...`
          )

          // 延迟后重新加载
          setTimeout(() => {
            if (!window.isDestroyed()) {
              // 重新加载页面
              if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
                window.loadURL(process.env['ELECTRON_RENDERER_URL'])
              } else {
                window.loadFile(join(__dirname, '../renderer/index.html'))
              }
            }
          }, LOAD_FAILURE_RECOVERY_DELAY)
        } else {
          console.error('Max load failure recovery attempts reached.')
          dialog.showErrorBox(
            '页面加载失败',
            `页面资源加载失败 (${errorCode}: ${errorDescription})。请重启应用。如果问题持续，请联系技术支持。`
          )
        }
      } else {
        // 非主框架的资源加载失败，记录但不自动恢复
        console.warn('Sub-resource load failed:', validatedURL, errorDescription)
      }
    }
  )

  // 页面成功加载后重置加载失败计数
  window.webContents.on('did-finish-load', () => {
    if (loadFailureCount > 0) {
      console.log('Page loaded successfully, resetting load failure count')
      loadFailureCount = 0
    }
  })

  // 监听未捕获的异常
  window.webContents.on('unresponsive', () => {
    console.warn('Renderer process became unresponsive')
    // 可以在这里添加额外的处理逻辑
  })

  window.webContents.on('responsive', () => {
    console.log('Renderer process became responsive again')
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // 生产环境：验证文件路径并加载
    const htmlPath = join(__dirname, '../renderer/index.html')

    // 验证文件是否存在
    if (!existsSync(htmlPath)) {
      console.error('HTML file not found at:', htmlPath)
      console.error('__dirname:', __dirname)
      console.error('Current working directory:', process.cwd())

      // 尝试备用路径
      const alternativePath = join(process.resourcesPath || __dirname, '../renderer/index.html')
      if (existsSync(alternativePath)) {
        console.log('Using alternative path:', alternativePath)
        window.loadFile(alternativePath)
      } else {
        console.error('Alternative path also not found:', alternativePath)
        dialog.showErrorBox(
          '文件未找到',
          `无法找到应用文件。\n\n预期路径: ${htmlPath}\n备用路径: ${alternativePath}\n\n请重新安装应用。`
        )
      }
    } else {
      console.log('Loading HTML from:', htmlPath)
      window.loadFile(htmlPath)
    }
  }

  return window
}

// 创建登录窗口
function createLoginWindow(
  platform: 'ocean' | 'tencent' | 'changdu',
  loginOptions?: OpenLoginWindowOptions
): Promise<LoginWindowResult> {
  return new Promise((resolve) => {
    const config = PLATFORM_CONFIG[platform]
    if (!config) {
      resolve({ success: false, error: '不支持的平台' })
      return
    }

    void persistLoginCredentialsIfRequested(platform, loginOptions)
    const autofillCredentials = resolveLoginCredentials(platform, loginOptions)

    // 为每次登录创建唯一的临时session，确保每次都是全新的登录会话
    const sessionId = `login-${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 创建登录窗口
    const loginWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: `${config.name}登录`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        // 使用唯一的临时分区，每次登录都是全新的会话
        partition: sessionId
      },
      // 父窗口设置，使其始终在主窗口之上
      parent: mainWindow || undefined,
      modal: false
    })

    console.log(`[${config.name}] 创建新的登录会话: ${sessionId}`)

    // 检查URL是否匹配任一成功URL模式的辅助函数
    const matchesSuccessUrl = (url: string): boolean => {
      if (!config.successUrlPatterns || config.successUrlPatterns.length === 0) {
        return false
      }
      return config.successUrlPatterns.some((pattern) => url.startsWith(pattern))
    }

    // 声明变量（需要在闭包中使用）
    let cookieCheckInterval: NodeJS.Timeout | null = null
    let isWindowClosed = false
    let hasReachedSuccessUrl = false // 标记是否到达成功URL
    let capturedGTK: string | null = null // 捕获到的g_tk值

    // 拦截新窗口打开，在当前窗口中加载目标URL（特别处理腾讯的跳转）
    loginWindow.webContents.setWindowOpenHandler((details) => {
      console.log(`[${config.name}] 拦截到新窗口打开:`, details.url)

      // 如果是腾讯平台且URL包含 ad.qq.com，在当前窗口中打开
      if (platform === 'tencent' && details.url.includes('ad.qq.com')) {
        console.log(`[${config.name}] 在当前窗口中加载:`, details.url)
        loginWindow.loadURL(details.url)
        return { action: 'deny' } // 阻止打开新窗口
      }

      // 其他情况也在当前窗口加载
      if (details.url.startsWith('http')) {
        loginWindow.loadURL(details.url)
        return { action: 'deny' }
      }

      return { action: 'deny' }
    })

    // 尝试从页面上下文获取 g_tk（腾讯平台兜底）
    const tryGetGTKFromPage = async (): Promise<string | null> => {
      if (loginWindow.isDestroyed()) return null
      try {
        const gtkValue = await loginWindow.webContents.executeJavaScript(`
          (function() {
            try {
              if (window.g_tk) return window.g_tk;
              return localStorage.getItem('g_tk') || sessionStorage.getItem('g_tk') || '';
            } catch (e) {
              return '';
            }
          })()
        `)
        return gtkValue ? String(gtkValue) : null
      } catch (e) {
        console.log(`[${config.name}] Failed to get g_tk from page:`, e)
        return null
      }
    }

    // 关闭窗口并返回结果的辅助函数
    const closeWindowAndResolve = async (cookies: Electron.Cookie[]): Promise<void> => {
      if (isWindowClosed) return // 防止重复调用

      console.log(`[${config.name}] ✅ All required cookies obtained, closing window`)

      // 去重Cookie（同名Cookie只保留一个，优先保留最具体的域名）
      const cookieMap = new Map<string, string>()
      cookies.forEach((cookie) => {
        // 如果Cookie名称已存在，比较域名优先级
        if (cookieMap.has(cookie.name)) {
          // 优先保留更具体的域名（如 ad.qq.com 优先于 .qq.com）
          // 简单策略：后面的覆盖前面的（通常后面的更新）
          cookieMap.set(cookie.name, cookie.value)
        } else {
          cookieMap.set(cookie.name, cookie.value)
        }
      })

      // 格式化Cookie为字符串（常读平台对值进行URL编码以支持中文字符）
      const encodeValue = platform === 'changdu'
      let cookieString = Array.from(cookieMap.entries())
        .map(([name, value]) => `${name}=${encodeValue ? encodeURIComponent(value) : value}`)
        .join('; ')

      // 如果是腾讯平台，确保 g_tk 被补齐
      if (platform === 'tencent') {
        if (!capturedGTK) {
          const gtkFromPage = await tryGetGTKFromPage()
          if (gtkFromPage) {
            capturedGTK = gtkFromPage
            console.log(`[${config.name}] Fallback captured g_tk from page:`, capturedGTK)
          }
        }

        if (capturedGTK) {
          console.log(`[${config.name}] Adding g_tk to cookies:`, capturedGTK)
          cookieString += `; g_tk=${capturedGTK}`
        } else {
          console.warn(`[${config.name}] Warning: g_tk not captured yet`)
        }
      }

      // 停止检测
      if (cookieCheckInterval) {
        clearInterval(cookieCheckInterval)
        cookieCheckInterval = null
      }

      isWindowClosed = true
      loginWindow.close()

      resolve({
        success: true,
        cookies: cookieString
      })
    }

    // 监听网络请求，提取g_tk参数（腾讯平台特有）
    if (platform === 'tencent') {
      loginWindow.webContents.session.webRequest.onBeforeRequest(
        { urls: ['*://*/*'] },
        async (details, callback) => {
          // 检查是否包含 /user/event_tracking
          if (details.url.includes('/user/event_tracking')) {
            console.log(`[${config.name}] Detected event_tracking request:`, details.url)

            try {
              // 从 URL 中提取 g_tk 参数
              const url = new URL(details.url)
              const gtkValue = url.searchParams.get('g_tk')

              if (gtkValue) {
                console.log(`[${config.name}] Captured g_tk:`, gtkValue)
                capturedGTK = gtkValue

                // 捕获到 g_tk 后，立即检查 cookies 并关闭窗口
                try {
                  // 获取所有Cookie
                  const allCookies = await loginWindow.webContents.session.cookies.get({})

                  // 过滤出与平台相关的Cookie
                  const domainKey = config.cookieDomain.replace(/^\./, '')
                  const cookies = allCookies.filter(
                    (cookie) => cookie.domain && cookie.domain.includes(domainKey)
                  )

                  // 检查是否包含所有必需Cookie
                  const hasRequiredCookies = config.requiredCookies.every((required) =>
                    cookies.some((cookie) => cookie.name === required && cookie.value)
                  )

                  if (hasRequiredCookies) {
                    console.log(
                      `[${config.name}] ✅ g_tk captured and required cookies ready, closing immediately`
                    )
                    await closeWindowAndResolve(cookies)
                  } else {
                    console.log(
                      `[${config.name}] g_tk captured but waiting for required cookies...`
                    )
                  }
                } catch (error) {
                  console.error(
                    `[${config.name}] Failed to check cookies after g_tk capture:`,
                    error
                  )
                }
              }
            } catch (error) {
              console.error(`[${config.name}] Failed to parse g_tk:`, error)
            }
          }

          callback({})
        }
      )
    }

    attachLoginAutofill(loginWindow, platform, autofillCredentials)

    // 加载登录页面
    loginWindow.loadURL(config.loginUrl)

    // Cookie检测函数
    const checkCookies = async (): Promise<void> => {
      try {
        // 如果配置了 successUrlPatterns 但还没到达，不检测
        if (
          config.successUrlPatterns &&
          config.successUrlPatterns.length > 0 &&
          !hasReachedSuccessUrl
        ) {
          console.log(`[${config.name}] 等待到达成功URL: ${config.successUrlPatterns.join(' 或 ')}`)
          return
        }

        // 获取所有Cookie（不限制域名）以诊断问题
        const allCookies = await loginWindow.webContents.session.cookies.get({})

        // 过滤出与平台相关的Cookie
        const domainKey = config.cookieDomain.replace(/^\./, '')
        const cookies = allCookies.filter(
          (cookie) => cookie.domain && cookie.domain.includes(domainKey)
        )

        // 调试输出：显示当前所有Cookie
        console.log(
          `[${config.name}] 当前域名 ${config.cookieDomain} 的所有Cookie:`,
          cookies.map((c) => ({ name: c.name, domain: c.domain, httpOnly: c.httpOnly }))
        )

        // 检查每个关键Cookie的状态
        const cookieStatus = config.requiredCookies.map((required) => {
          const found = cookies.find((cookie) => cookie.name === required)
          return {
            name: required,
            type: 'required',
            found: !!found,
            value: found ? `${found.value.substring(0, 20)}...` : 'N/A',
            domain: found?.domain
          }
        })

        // 检查可选Cookie
        if (config.optionalCookies) {
          config.optionalCookies.forEach((optional) => {
            const found = cookies.find((cookie) => cookie.name === optional)
            if (found) {
              cookieStatus.push({
                name: optional,
                type: 'optional',
                found: true,
                value: `${found.value.substring(0, 20)}...`,
                domain: found.domain
              })
            }
          })
        }

        console.log(`[${config.name}] Cookie状态:`, cookieStatus)

        // 检查是否包含所有必需Cookie
        const hasRequiredCookies = config.requiredCookies.every((required) =>
          cookies.some((cookie) => cookie.name === required && cookie.value)
        )

        if (hasRequiredCookies) {
          await closeWindowAndResolve(cookies)
        }
      } catch (error) {
        console.error('Cookie检测错误:', error)
      }
    }

    // 如果没有配置 successUrlPatterns，立即开始轮询；否则等待到达成功URL后再启动
    if (!config.successUrlPatterns || config.successUrlPatterns.length === 0) {
      cookieCheckInterval = setInterval(checkCookies, 2000)
    }

    // 窗口关闭事件
    loginWindow.on('closed', async () => {
      if (cookieCheckInterval) {
        clearInterval(cookieCheckInterval)
        cookieCheckInterval = null
      }

      // 清理临时session数据，确保下次登录时是全新的
      try {
        const session = loginWindow.webContents.session
        await session.clearStorageData({
          storages: ['cookies', 'localstorage', 'cachestorage']
        })
        console.log(`[${config.name}] 已清理登录会话数据: ${sessionId}`)
      } catch (error) {
        console.error(`[${config.name}] 清理session失败:`, error)
      }

      if (!isWindowClosed) {
        // 用户手动关闭窗口
        resolve({
          success: false,
          error: '用户取消登录'
        })
      }
    })

    // 监听URL导航变化（更早触发，不用等页面全部加载完）
    loginWindow.webContents.on('did-navigate', (_event, url) => {
      console.log(`[${config.name}] Navigated to:`, url)

      // 检查是否到达任一成功URL
      if (matchesSuccessUrl(url)) {
        console.log(`[${config.name}] ✅ Reached success URL, starting cookie capture...`)
        hasReachedSuccessUrl = true
        // 立即检测一次，然后启动轮询
        setTimeout(checkCookies, 300) // 更短的延迟
        // 启动轮询检测（如果还未启动）
        if (!cookieCheckInterval) {
          cookieCheckInterval = setInterval(checkCookies, 1500) // 更频繁的检测
        }
      }
    })

    // 也监听页面加载完成（兼容性，防止did-navigate漏提）
    loginWindow.webContents.on('did-finish-load', () => {
      const currentUrl = loginWindow.webContents.getURL()
      console.log(`[${config.name}] Page loaded:`, currentUrl)

      // 如果还没有到达成功URL但现在到了，启动检测
      if (
        config.successUrlPatterns &&
        config.successUrlPatterns.length > 0 &&
        !hasReachedSuccessUrl &&
        matchesSuccessUrl(currentUrl)
      ) {
        console.log(`[${config.name}] ✅ Reached success URL (on load), starting cookie capture...`)
        hasReachedSuccessUrl = true
        setTimeout(checkCookies, 300)
        if (!cookieCheckInterval) {
          cookieCheckInterval = setInterval(checkCookies, 1500)
        }
      } else if (
        (!config.successUrlPatterns || config.successUrlPatterns.length === 0) &&
        !hasReachedSuccessUrl
      ) {
        // 如果没有配置 successUrlPatterns，使用旧逻辑
        setTimeout(checkCookies, 500)
      }
    })
  })
}

// 创建飞书授权窗口
function createFeishuAuthWindow(authUrl: string): Promise<FeishuAuthResult> {
  return new Promise((resolve) => {
    // 如果已经存在授权窗口，先关闭
    if (feishuAuthWindow && !feishuAuthWindow.isDestroyed()) {
      feishuAuthWindow.close()
      feishuAuthWindow = null
    }

    // 创建授权窗口
    feishuAuthWindow = new BrowserWindow({
      width: 600,
      height: 700,
      title: '飞书授权',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        // 使用独立的 partition 来隔离授权会话
        partition: 'feishu-auth'
      },
      parent: mainWindow || undefined,
      modal: false,
      autoHideMenuBar: true
    })

    console.log('[飞书授权] 创建授权窗口:', authUrl)

    let isResolved = false

    // 监听导航事件，捕获回调 URL
    feishuAuthWindow.webContents.on('will-redirect', (_event, url) => {
      console.log('[飞书授权] 检测到重定向:', url)
      handleCallbackUrl(url)
    })

    feishuAuthWindow.webContents.on('did-navigate', (_event, url) => {
      console.log('[飞书授权] 导航到:', url)
      handleCallbackUrl(url)
    })

    // 处理回调 URL
    const handleCallbackUrl = (url: string): void => {
      if (isResolved) return

      try {
        // 检查是否是回调 URL (包含 #/feishu/callback)
        if (url.includes('#/feishu/callback') || url.includes('/feishu/callback')) {
          console.log('[飞书授权] 捕获到回调 URL:', url)

          // 解析 URL 参数
          const urlObj = new URL(url)

          // 尝试从 hash 中获取参数 (HashRouter)
          let code: string | null = null
          let state: string | null = null

          if (url.includes('#')) {
            const hashPart = url.split('#')[1]
            if (hashPart && hashPart.includes('?')) {
              const queryString = hashPart.split('?')[1]
              const params = new URLSearchParams(queryString)
              code = params.get('code')
              state = params.get('state')
            }
          }

          // 如果 hash 中没有，尝试从 query 中获取
          if (!code) {
            code = urlObj.searchParams.get('code')
            state = urlObj.searchParams.get('state')
          }

          if (code && state) {
            console.log('[飞书授权] 成功获取授权码')
            isResolved = true

            // 关闭授权窗口
            if (feishuAuthWindow && !feishuAuthWindow.isDestroyed()) {
              feishuAuthWindow.close()
            }

            resolve({
              success: true,
              code,
              state,
              message: '授权成功'
            })
          } else {
            console.warn('[飞书授权] 回调 URL 缺少必要参数:', { code, state })
          }
        }
      } catch (error) {
        console.error('[飞书授权] 解析回调 URL 失败:', error)
      }
    }

    // 监听窗口关闭
    feishuAuthWindow.on('closed', () => {
      console.log('[飞书授权] 窗口已关闭')
      feishuAuthWindow = null

      if (!isResolved) {
        isResolved = true
        resolve({
          success: false,
          error: '用户取消授权'
        })
      }
    })

    // 加载授权 URL
    feishuAuthWindow.loadURL(authUrl)
  })
}

// 创建巨量引擎 OAuth 授权窗口
// 与 createFeishuAuthWindow 逻辑一致，区别在于捕获的回调路径和参数名
interface OceanEngineAuthResult {
  success: boolean
  message?: string
  auth_code?: string
  state?: string
  error?: string
}

function createOceanEngineAuthWindow(authUrl: string): Promise<OceanEngineAuthResult> {
  return new Promise((resolve) => {
    // 若已有窗口则先关闭
    if (oceanEngineAuthWindow && !oceanEngineAuthWindow.isDestroyed()) {
      oceanEngineAuthWindow.close()
      oceanEngineAuthWindow = null
    }

    oceanEngineAuthWindow = new BrowserWindow({
      width: 700,
      height: 800,
      title: '巨量引擎授权',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        partition: 'ocean-engine-auth' // 独立 session 隔离授权会话
      },
      parent: mainWindow || undefined,
      modal: false,
      autoHideMenuBar: true
    })

    console.log('[巨量授权] 创建授权窗口:', authUrl)

    let isResolved = false

    // 解析回调 URL，提取 auth_code 和 state
    const handleCallbackUrl = (url: string): void => {
      if (isResolved) return

      try {
        // 检测是否是我们的回调路径（兼容 HashRouter 的 # 形式）
        if (
          url.includes('#/ocean-engine-oauth/callback') ||
          url.includes('/ocean-engine-oauth/callback')
        ) {
          console.log('[巨量授权] 捕获到回调 URL:', url)

          let authCode: string | null = null
          let state: string | null = null

          // HashRouter 格式：http://host/#/path?auth_code=...&state=...
          if (url.includes('#')) {
            const hashPart = url.split('#')[1]
            if (hashPart && hashPart.includes('?')) {
              const queryString = hashPart.split('?')[1]
              const params = new URLSearchParams(queryString)
              authCode = params.get('auth_code')
              state = params.get('state')
            }
          }

          // 兜底：从普通 query string 中取
          if (!authCode) {
            const urlObj = new URL(url)
            authCode = urlObj.searchParams.get('auth_code')
            state = urlObj.searchParams.get('state')
          }

          if (authCode && state) {
            console.log('[巨量授权] 成功获取 auth_code')
            isResolved = true

            if (oceanEngineAuthWindow && !oceanEngineAuthWindow.isDestroyed()) {
              oceanEngineAuthWindow.close()
            }

            resolve({ success: true, auth_code: authCode, state, message: '授权成功' })
          } else {
            console.warn('[巨量授权] 回调 URL 缺少必要参数:', { authCode, state })
          }
        }
      } catch (error) {
        console.error('[巨量授权] 解析回调 URL 失败:', error)
      }
    }

    oceanEngineAuthWindow.webContents.on('will-redirect', (_event, url) => {
      console.log('[巨量授权] 将重定向到:', url)
      handleCallbackUrl(url)
    })

    oceanEngineAuthWindow.webContents.on('did-navigate', (_event, url) => {
      console.log('[巨量授权] 导航到:', url)
      handleCallbackUrl(url)
    })

    // 也监听子框架跳转（部分 OAuth 平台在 iframe 中完成跳转）
    oceanEngineAuthWindow.webContents.on('did-navigate-in-page', (_event, url) => {
      handleCallbackUrl(url)
    })

    oceanEngineAuthWindow.on('closed', () => {
      console.log('[巨量授权] 窗口已关闭')
      oceanEngineAuthWindow = null
      if (!isResolved) {
        isResolved = true
        resolve({ success: false, error: '用户取消授权' })
      }
    })

    oceanEngineAuthWindow.loadURL(authUrl)
  })
}

const TRAY_BASE_TOOLTIP = '玄枢 - 广告快捷投放工具'

function refreshTrayMenu(): void {
  if (!tray) return

  tray.setToolTip(getTrayTooltip(TRAY_BASE_TOOLTIP))

  const pendingUpdate = getPendingUpdateInfo()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.hide()
        }
      }
    },
    ...(pendingUpdate
      ? [
          { type: 'separator' as const },
          {
            label: `立即更新 (v${pendingUpdate.version})`,
            click: () => {
              quitAndInstall()
            }
          }
        ]
      : []),
    { type: 'separator' as const },
    {
      label: '检查更新',
      click: async () => {
        try {
          await checkForUpdates(true)
        } catch (error) {
          console.error('检查更新失败:', error)
        }
      }
    },
    { type: 'separator' as const },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

// 创建系统托盘
function createTray(): void {
  // 创建托盘图标
  // icon 是通过 ?asset 导入的资源路径，在不同环境下会自动处理
  let trayIcon: Electron.NativeImage

  try {
    // 尝试使用导入的图标路径
    trayIcon = nativeImage.createFromPath(icon)

    // 如果图标为空，尝试使用资源目录中的图标
    if (trayIcon.isEmpty()) {
      const iconPath = join(__dirname, '../../resources/icon.png')
      trayIcon = nativeImage.createFromPath(iconPath)
    }
  } catch (error) {
    console.error('Failed to load tray icon:', error)
    // 如果都失败了，创建一个空图标（Electron 会使用默认图标）
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)

  refreshTrayMenu()

  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// 单实例锁：确保只能运行一个应用实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 如果获取锁失败，说明已经有实例在运行，退出当前进程
  console.log('应用已经在运行，退出当前实例')
  app.quit()
} else {
  // 监听第二个实例启动事件
  app.on('second-instance', () => {
    // 当用户尝试打开第二个实例时，激活现有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // 设置应用菜单栏
    const menu = createApplicationMenu()
    Menu.setApplicationMenu(menu)
    registerLianshanTosMultipartIpc()
    registerVideoDownloadIpc()

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // 注册全局快捷键以打开/关闭开发者工具（生产环境也启用）
    // F12 打开/关闭开发者工具
    globalShortcut.register('F12', () => {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        if (focusedWindow.webContents.isDevToolsOpened()) {
          focusedWindow.webContents.closeDevTools()
        } else {
          focusedWindow.webContents.openDevTools()
        }
      } else if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools()
        }
      }
    })

    // Ctrl+Shift+I (Windows/Linux) 或 Cmd+Option+I (macOS) 打开/关闭开发者工具
    const devToolsShortcut = process.platform === 'darwin' ? 'Command+Option+I' : 'Control+Shift+I'
    globalShortcut.register(devToolsShortcut, () => {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        if (focusedWindow.webContents.isDevToolsOpened()) {
          focusedWindow.webContents.closeDevTools()
        } else {
          focusedWindow.webContents.openDevTools()
        }
      } else if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools()
        }
      }
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))

    // 打开外部链接
    ipcMain.handle('open-external', async (_, url: string) => {
      try {
        await shell.openExternal(url)
      } catch (error) {
        console.error('Failed to open external URL:', error)
        throw error
      }
    })

    ipcMain.handle(
      'ocean-engine:open-project-create-window',
      async (_, options: OceanEngineProjectCreateWindowOptions) => {
        try {
          return await openOceanEngineProjectCreateWindow(options)
        } catch (error) {
          console.error('Failed to open Ocean Engine project create window:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : '打开巨量网页新建窗口失败'
          }
        }
      }
    )

    mainWindow = createWindow()

    // 创建系统托盘
    createTray()

    let updateCheckTimeout: NodeJS.Timeout | null = null

    // 保存文件并打开文件夹
    ipcMain.handle(
      'save-file-and-open-folder',
      async (_, content: string, defaultFilename: string) => {
        try {
          const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow
          if (!focusedWindow) {
            throw new Error('No window available for save dialog')
          }
          const { filePath, canceled } = await dialog.showSaveDialog(focusedWindow, {
            title: '保存CSV文件',
            defaultPath: defaultFilename,
            filters: [
              { name: 'CSV文件', extensions: ['csv'] },
              { name: '所有文件', extensions: ['*'] }
            ]
          })

          if (canceled || !filePath) {
            return { success: false, canceled: true }
          }

          // 写入文件（添加BOM以支持Excel正确显示中文）
          await writeFile(filePath, '\ufeff' + content, 'utf-8')

          // 打开文件所在文件夹并选中文件
          shell.showItemInFolder(filePath)

          return { success: true, filePath }
        } catch (error) {
          console.error('Failed to save file:', error)
          throw error
        }
      }
    )

    // 选择文件夹
    ipcMain.handle('select-folder', async () => {
      const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow
      if (!focusedWindow) {
        return { canceled: true }
      }
      const { filePaths, canceled } = await dialog.showOpenDialog(focusedWindow, {
        title: '选择视频目录',
        properties: ['openDirectory'],
        defaultPath: 'F:\\测试视频'
      })
      if (canceled || !filePaths?.length) {
        return { canceled: true }
      }
      return { folderPath: filePaths[0], canceled: false }
    })

    // 选择多个视频文件
    ipcMain.handle('select-video-files', async () => {
      const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow
      if (!focusedWindow) {
        return { canceled: true, filePaths: [] }
      }
      const { filePaths, canceled } = await dialog.showOpenDialog(focusedWindow, {
        title: '选择要上传的视频',
        properties: ['openFile', 'multiSelections'],
        defaultPath: 'F:\\测试视频',
        filters: [
          { name: '视频', extensions: ['mp4', 'mpeg', '3gp', 'avi', 'm4v'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      if (canceled || !filePaths?.length) {
        return { canceled: true, filePaths: [] }
      }
      return { canceled: false, filePaths }
    })

    // 初始化自动更新
    if (!is.dev) {
      initUpdater(mainWindow, { onStateChange: refreshTrayMenu })
      // 5秒后检查更新,避免启动时阻塞
      updateCheckTimeout = setTimeout(() => {
        checkForUpdates(false).catch((err) => console.error('Failed to check for updates:', err))
        updateCheckTimeout = null
      }, 5000)
      startPeriodicUpdateCheck()
    }

    // 应用退出时清理资源
    app.on('before-quit', () => {
      if (updateCheckTimeout) {
        clearTimeout(updateCheckTimeout)
        updateCheckTimeout = null
      }
      stopPeriodicUpdateCheck()
    })

    // 注册更新相关的 IPC 处理器
    ipcMain.handle('check-for-updates', async () => {
      try {
        await checkForUpdates(true)
      } catch (error) {
        console.error('Check for updates failed:', error)
        throw error
      }
    })

    ipcMain.handle('download-update', async () => {
      try {
        await downloadUpdate()
      } catch (error) {
        console.error('Download update failed:', error)
        throw error
      }
    })

    ipcMain.handle('install-update', () => {
      quitAndInstall()
    })

    // 添加退出应用的 IPC 处理
    ipcMain.handle('quit-app', () => {
      isQuitting = true
      app.quit()
    })

    // 设置用户登录状态
    ipcMain.handle('set-login-status', (_, loggedIn: boolean) => {
      isUserLoggedIn = loggedIn
    })

    // 打开登录窗口获取Cookie
    ipcMain.handle(
      'get-login-credentials',
      async (
        _,
        platform: 'ocean' | 'tencent' | 'changdu',
        configId?: number
      ) => {
        const stored = loadStoredLoginCredentials(platform, configId)
        if (!stored) {
          return { hasStored: false as const }
        }
        return {
          hasStored: true as const,
          email: stored.email,
          password: stored.password
        }
      }
    )

    ipcMain.handle(
      'save-login-credentials',
      async (
        _,
        platform: 'ocean' | 'tencent' | 'changdu',
        configId: number,
        email: string,
        password: string
      ) => {
        const trimmedEmail = email?.trim()
        if (!configId || !trimmedEmail || !password) {
          return { success: false }
        }
        saveStoredLoginCredentials(platform, { email: trimmedEmail, password }, configId)
        return { success: true }
      }
    )

    ipcMain.handle(
      'clear-login-credentials',
      async (
        _,
        platform: 'ocean' | 'tencent' | 'changdu',
        configId?: number
      ) => {
        clearStoredLoginCredentials(platform, configId)
        return { success: true }
      }
    )

    ipcMain.handle(
      'open-login-window',
      async (_, platform: 'ocean' | 'tencent' | 'changdu', options?: OpenLoginWindowOptions) => {
      try {
        if (options?.persistOnly) {
          if (options.remember && options.email?.trim() && options.password && options.configId) {
            await persistLoginCredentialsIfRequested(platform, options)
          } else if (options.configId) {
            clearStoredLoginCredentials(platform, options.configId)
          }
          return { success: true }
        }
        const result = await createLoginWindow(platform, options)
        return result
      } catch (error) {
        console.error('Failed to open login window:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
    )

    // 同时打开多个登录窗口获取多个Cookie（自动填入模式）
    // 存储活跃的批量登录窗口
    const multiLoginWindows = new Map<string, BrowserWindow>()
    let multiLoginEventSender: Electron.WebContents | null = null // 用于发送自动收集事件的sender

    ipcMain.handle(
      'open-multi-login-windows-auto',
      async (
        event,
        platform: 'ocean' | 'tencent' | 'changdu',
        count: number,
        options?: OpenLoginWindowOptions
      ) => {
        try {
          const config = PLATFORM_CONFIG[platform]
          if (!config) {
            return { success: false, error: '不支持的平台' }
          }

          if (count < 1 || count > 10) {
            return { success: false, error: '窗口数量必须在1-10之间' }
          }

          void persistLoginCredentialsIfRequested(platform, options)
          const autofillCredentials = resolveLoginCredentials(platform, options)

          console.log(`[${config.name}] 批量创建 ${count} 个登录窗口（自动填入模式）`)

          // 保存sender用于后续发送事件
          multiLoginEventSender = event.sender

          // 创建多个窗口
          const windows: Array<{ sessionId: string; index: number }> = []

          for (let i = 0; i < count; i++) {
            const sessionId = `multi-login-${platform}-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`

            // 创建登录窗口 - 使用更大尺寸避免触发响应式布局
            const loginWindow = new BrowserWindow({
              width: 1400,
              height: 900,
              title: `${config.name}登录 - 窗口 ${i + 1}/${count}`,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                partition: sessionId
              },
              parent: mainWindow || undefined,
              modal: false
            })

            // 层叠模式，每个窗口相对于前一个有一定偏移
            const x = 50 + i * 50 // 水平偏移50px
            const y = 30 + i * 40 // 垂直偏移40px
            loginWindow.setPosition(x, y)

            // 存储窗口引用
            multiLoginWindows.set(sessionId, { window: loginWindow, index: i, platform })
            windows.push({ sessionId, index: i })

            // 拦截新窗口打开，在当前窗口中加载目标URL（防止点击"进入"时新开窗口）
            loginWindow.webContents.setWindowOpenHandler((details) => {
              console.log(`[${config.name}] 窗口 ${i + 1} 拦截到新窗口打开:`, details.url)

              // 在当前窗口中加载目标URL
              if (details.url.startsWith('http')) {
                console.log(`[${config.name}] 窗口 ${i + 1} 在当前窗口中加载:`, details.url)
                loginWindow.loadURL(details.url)
                return { action: 'deny' }
              }

              return { action: 'deny' }
            })

            // 标记是否已经收集到Cookie（避免重复收集）
            let hasCollectedCookie = false
            let capturedGTK: string | null = null // 存储捕获的g_tk，供后续使用

            // 监听网络请求，提前提取g_tk并快速获取Cookie（腾讯平台优化）
            if (platform === 'tencent') {
              loginWindow.webContents.session.webRequest.onBeforeRequest(
                { urls: ['*://*/*'] },
                async (details, callback) => {
                  // 检查是否包含 /user/event_tracking（腾讯登录后的特征请求）
                  if (details.url.includes('/user/event_tracking')) {
                    console.log(
                      `[${config.name}] 窗口 ${i + 1} 检测到 event_tracking 请求:`,
                      details.url
                    )

                    try {
                      // 从 URL 中提取 g_tk 参数
                      const url = new URL(details.url)
                      const gtkValue = url.searchParams.get('g_tk')

                      if (gtkValue) {
                        capturedGTK = gtkValue
                        console.log(`[${config.name}] 窗口 ${i + 1} 提前捕获 g_tk:`, gtkValue)

                        // 立即获取Cookie（此时页面还未完全加载，但Cookie已就绪）
                        if (!hasCollectedCookie && !loginWindow.isDestroyed()) {
                          const allCookies = await loginWindow.webContents.session.cookies.get({})
                          const cookies = allCookies.filter(
                            (cookie) => cookie.domain && cookie.domain.includes('qq.com')
                          )

                          // 检查必需Cookie
                          const hasRequiredCookies = config.requiredCookies.every((required) =>
                            cookies.some((cookie) => cookie.name === required && cookie.value)
                          )

                          if (hasRequiredCookies) {
                            console.log(
                              `[${config.name}] 窗口 ${i + 1} ✅ 通过 event_tracking 提前获取Cookie成功`
                            )

                            // 格式化Cookie
                            const cookieMap = new Map<string, string>()
                            cookies.forEach((cookie) => {
                              cookieMap.set(cookie.name, cookie.value)
                            })

                            let cookieString = Array.from(cookieMap.entries())
                              .map(([name, value]) => `${name}=${value}`)
                              .join('; ')

                            cookieString += `; g_tk=${gtkValue}`

                            hasCollectedCookie = true

                            // 发送事件给渲染进程
                            if (multiLoginEventSender && !multiLoginEventSender.isDestroyed()) {
                              multiLoginEventSender.send('multi-login-cookie-collected', {
                                index: i,
                                sessionId,
                                cookies: cookieString,
                                success: true
                              })
                            }

                            // 立即关闭窗口（无需等待页面完全加载）
                            setTimeout(async () => {
                              if (!loginWindow.isDestroyed()) {
                                await loginWindow.webContents.session.clearStorageData({
                                  storages: ['cookies', 'localstorage', 'cachestorage']
                                })
                                loginWindow.close()
                              }
                            }, 100)
                          }
                        }
                      }
                    } catch (error) {
                      console.error(
                        `[${config.name}] 窗口 ${i + 1} 处理 event_tracking 失败:`,
                        error
                      )
                    }
                  }

                  callback({})
                }
              )
            }

            // 检查URL是否匹配成功模式的辅助函数
            const matchesSuccessUrl = (url: string): boolean => {
              if (!config.successUrlPatterns || config.successUrlPatterns.length === 0) {
                return false
              }
              return config.successUrlPatterns.some((pattern) => url.startsWith(pattern))
            }

            // 自动收集Cookie的函数（带重试机制）
            const autoCollectCookie = async (attempt: number = 1): Promise<void> => {
              try {
                if (loginWindow.isDestroyed()) return

                // 如果已经通过 event_tracking 收集过了，跳过
                if (hasCollectedCookie) {
                  console.log(`[${config.name}] 窗口 ${i + 1} 已通过 event_tracking 提前收集，跳过`)
                  return
                }

                console.log(`[${config.name}] 窗口 ${i + 1} 尝试收集Cookie (第${attempt}次)...`)

                // 获取该窗口的cookies
                const allCookies = await loginWindow.webContents.session.cookies.get({})

                console.log(
                  `[${config.name}] 窗口 ${i + 1} 所有Cookie:`,
                  allCookies.map((c) => ({ name: c.name, domain: c.domain }))
                )

                // 过滤出与平台相关的Cookie
                const cookies = allCookies.filter(
                  (cookie) =>
                    cookie.domain &&
                    (cookie.domain.includes(config.cookieDomain.replace('.', '')) ||
                      cookie.domain.includes(config.cookieDomain))
                )

                console.log(
                  `[${config.name}] 窗口 ${i + 1} 过滤后Cookie:`,
                  cookies.map((c) => c.name)
                )

                // 检查是否包含必需Cookie
                const hasRequiredCookies = config.requiredCookies.every((required) =>
                  cookies.some((cookie) => cookie.name === required && cookie.value)
                )

                console.log(
                  `[${config.name}] 窗口 ${i + 1} 必需Cookie检查:`,
                  hasRequiredCookies,
                  '需要:',
                  config.requiredCookies
                )

                if (hasRequiredCookies) {
                  // 格式化Cookie为字符串（常读平台对值进行URL编码以支持中文字符）
                  const encodeValue = platform === 'changdu'
                  const cookieMap = new Map<string, string>()
                  cookies.forEach((cookie) => {
                    cookieMap.set(cookie.name, cookie.value)
                  })

                  let cookieString = Array.from(cookieMap.entries())
                    .map(
                      ([name, value]) =>
                        `${name}=${encodeValue ? encodeURIComponent(value) : value}`
                    )
                    .join('; ')

                  // 使用提前捕获的g_tk，如果没有则尝试从页面获取（腾讯平台）
                  if (platform === 'tencent') {
                    if (capturedGTK) {
                      // 使用event_tracking中提前捕获的g_tk
                      cookieString += `; g_tk=${capturedGTK}`
                      console.log(
                        `[${config.name}] 窗口 ${i + 1} 使用提前捕获的 g_tk:`,
                        capturedGTK
                      )
                    } else {
                      // 备用方案：从页面获取
                      try {
                        const gtkValue = await loginWindow.webContents.executeJavaScript(`
                        (function() {
                          if (window.g_tk) return window.g_tk;
                          return localStorage.getItem('g_tk') || '';
                        })()
                      `)
                        if (gtkValue) {
                          cookieString += `; g_tk=${gtkValue}`
                          console.log(`[${config.name}] 窗口 ${i + 1} 从页面获取 g_tk:`, gtkValue)
                        }
                      } catch (e) {
                        console.log('Failed to get g_tk:', e)
                      }
                    }
                  }

                  console.log(
                    `[${config.name}] 窗口 ${i + 1} 自动收集Cookie成功，g_tk:`,
                    capturedGTK
                  )

                  // 发送事件给渲染进程
                  if (multiLoginEventSender && !multiLoginEventSender.isDestroyed()) {
                    multiLoginEventSender.send('multi-login-cookie-collected', {
                      index: i,
                      sessionId,
                      cookies: cookieString,
                      success: true
                    })
                  }

                  // 关闭窗口
                  await loginWindow.webContents.session.clearStorageData({
                    storages: ['cookies', 'localstorage', 'cachestorage']
                  })
                  loginWindow.close()
                } else if (attempt < 3) {
                  // 如果还没检测到必需Cookie，等待2秒后重试
                  console.log(
                    `[${config.name}] 窗口 ${i + 1} 未检测到必需Cookie，${attempt + 1}秒后重试...`
                  )
                  setTimeout(() => autoCollectCookie(attempt + 1), 2000)
                } else {
                  console.log(`[${config.name}] 窗口 ${i + 1} 重试3次后仍未检测到必需Cookie`)
                }
              } catch (error) {
                console.error(`[${config.name}] 窗口 ${i + 1} 自动收集Cookie失败:`, error)
              }
            }

            // 监听URL导航变化（检测登录成功）
            loginWindow.webContents.on('did-navigate', (_event, url) => {
              console.log(`[${config.name}] 窗口 ${i + 1} 导航到:`, url)
              if (matchesSuccessUrl(url)) {
                console.log(`[${config.name}] 窗口 ${i + 1} 检测到成功URL，自动收集Cookie...`)
                setTimeout(autoCollectCookie, 500)
              }
            })

            // 也监听页面加载完成
            loginWindow.webContents.on('did-finish-load', () => {
              const currentUrl = loginWindow.webContents.getURL()
              if (matchesSuccessUrl(currentUrl)) {
                console.log(
                  `[${config.name}] 窗口 ${i + 1} 加载完成且匹配成功URL，自动收集Cookie...`
                )
                setTimeout(autoCollectCookie, 500)
              }
            })

            // 窗口关闭时清理
            loginWindow.on('closed', () => {
              multiLoginWindows.delete(sessionId)
              // 通知渲染进程该窗口已关闭
              if (multiLoginEventSender && !multiLoginEventSender.isDestroyed()) {
                multiLoginEventSender.send('multi-login-window-closed', {
                  index: i,
                  sessionId
                })
              }
            })

            attachLoginAutofill(loginWindow, platform, autofillCredentials)

            // 加载登录页面
            loginWindow.loadURL(config.loginUrl)
          }

          return {
            success: true,
            message: `已打开 ${count} 个登录窗口，登录成功后将自动填入Cookie`,
            windowIds: windows.map((w) => w.sessionId),
            count
          }
        } catch (error) {
          console.error('Failed to open multi login windows:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    )

    // 收集所有批量登录窗口的Cookie
    ipcMain.handle('collect-multi-login-cookies', async (_, platform: 'ocean' | 'tencent') => {
      try {
        const config = PLATFORM_CONFIG[platform]
        if (!config) {
          return { success: false, error: '不支持的平台' }
        }

        console.log(`[${config.name}] 开始收集批量登录窗口的Cookie`)

        const results: Array<{
          index: number
          sessionId: string
          cookies: string
          success: boolean
          error?: string
        }> = []

        // 遍历所有活跃的批量登录窗口
        for (const [sessionId, loginWindow] of multiLoginWindows) {
          // 只处理当前平台的窗口
          if (!sessionId.startsWith(`multi-login-${platform}`)) {
            continue
          }

          try {
            if (loginWindow.isDestroyed()) {
              continue
            }

            // 获取该窗口的cookies
            const allCookies = await loginWindow.webContents.session.cookies.get({})

            // 过滤出与平台相关的Cookie
            const cookies = allCookies.filter(
              (cookie) =>
                cookie.domain &&
                (cookie.domain.includes(config.cookieDomain.replace('.', '')) ||
                  cookie.domain.includes(config.cookieDomain))
            )

            // 检查是否包含必需Cookie
            const hasRequiredCookies = config.requiredCookies.every((required) =>
              cookies.some((cookie) => cookie.name === required && cookie.value)
            )

            if (hasRequiredCookies) {
              // 格式化Cookie为字符串（常读平台对值进行URL编码以支持中文字符）
              const encodeValue = platform === 'changdu'
              const cookieMap = new Map<string, string>()
              cookies.forEach((cookie) => {
                cookieMap.set(cookie.name, cookie.value)
              })

              let cookieString = Array.from(cookieMap.entries())
                .map(
                  ([name, value]) => `${name}=${encodeValue ? encodeURIComponent(value) : value}`
                )
                .join('; ')

              // 尝试获取g_tk（腾讯平台）
              if (platform === 'tencent') {
                try {
                  const gtkValue = await loginWindow.webContents.executeJavaScript(`
                    (function() {
                      // 尝试从页面中获取g_tk
                      if (window.g_tk) return window.g_tk;
                      // 或者从localStorage
                      return localStorage.getItem('g_tk') || '';
                    })()
                  `)
                  if (gtkValue) {
                    cookieString += `; g_tk=${gtkValue}`
                  }
                } catch (e) {
                  console.log('Failed to get g_tk:', e)
                }
              }

              // 从sessionId提取索引 (格式: multi-login-{platform}-{timestamp}-{index}-{random})
              const indexMatch = sessionId.match(/multi-login-[^-]+-\d+-(\d+)-/)
              const index = indexMatch ? parseInt(indexMatch[1]) : 0

              results.push({
                index,
                sessionId,
                cookies: cookieString,
                success: true
              })

              console.log(`[${config.name}] 窗口 ${index + 1} Cookie收集成功`)
            } else {
              const indexMatch = sessionId.match(/multi-login-[^-]+-\d+-(\d+)-/)
              const index = indexMatch ? parseInt(indexMatch[1]) : 0

              results.push({
                index,
                sessionId,
                cookies: '',
                success: false,
                error: '未找到必需的Cookie'
              })

              console.log(`[${config.name}] 窗口 ${index + 1} 未找到必需Cookie`)
            }

            // 关闭窗口并清理session
            await loginWindow.webContents.session.clearStorageData({
              storages: ['cookies', 'localstorage', 'cachestorage']
            })
            loginWindow.close()
          } catch (error) {
            console.error(`[${config.name}] 收集Cookie失败:`, error)
            const indexMatch = sessionId.match(/multi-login-[^-]+-\d+-(\d+)-/)
            const index = indexMatch ? parseInt(indexMatch[1]) : 0

            results.push({
              index,
              sessionId,
              cookies: '',
              success: false,
              error: error instanceof Error ? error.message : '收集失败'
            })

            if (!loginWindow.isDestroyed()) {
              loginWindow.close()
            }
          }
        }

        // 清理已处理的窗口记录
        for (const sessionId of results.map((r) => r.sessionId)) {
          multiLoginWindows.delete(sessionId)
        }

        // 按索引排序
        results.sort((a, b) => a.index - b.index)

        return {
          success: true,
          cookies: results,
          count: results.length,
          successCount: results.filter((r) => r.success).length
        }
      } catch (error) {
        console.error('Failed to collect multi login cookies:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // 关闭所有批量登录窗口（用户取消时使用）
    ipcMain.handle('close-multi-login-windows', async () => {
      try {
        console.log('关闭所有批量登录窗口')

        for (const [sessionId, loginWindow] of multiLoginWindows) {
          if (!loginWindow.isDestroyed()) {
            await loginWindow.webContents.session.clearStorageData({
              storages: ['cookies', 'localstorage', 'cachestorage']
            })
            loginWindow.close()
          }
        }

        multiLoginWindows.clear()

        return { success: true }
      } catch (error) {
        console.error('Failed to close multi login windows:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // 打开巨量引擎 OAuth 授权窗口
    ipcMain.handle('open-ocean-engine-auth-window', async (_, authUrl: string) => {
      try {
        console.log('[巨量授权] 收到打开授权窗口请求:', authUrl)
        const result = await createOceanEngineAuthWindow(authUrl)
        console.log('[巨量授权] 授权窗口返回结果:', result)
        return result
      } catch (error) {
        console.error('[巨量授权] 打开授权窗口失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // 打开飞书授权窗口
    ipcMain.handle('open-feishu-auth-window', async (_, authUrl: string) => {
      try {
        console.log('[飞书授权] 收到打开授权窗口请求:', authUrl)
        const result = await createFeishuAuthWindow(authUrl)
        console.log('[飞书授权] 授权窗口返回结果:', result)
        return result
      } catch (error) {
        console.error('[飞书授权] 打开授权窗口失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      } else if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
  })
}

// 当所有窗口关闭时，不退出应用（保持后台运行）
// 只有在用户明确选择退出时才会退出
app.on('window-all-closed', () => {
  // 不执行任何操作，保持应用在后台运行
  // 用户可以通过托盘菜单退出应用
})

// 应用退出时注销所有全局快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
