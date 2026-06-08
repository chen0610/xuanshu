import { app, safeStorage } from 'electron'
import type { BrowserWindow, WebContents } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export type LoginPlatform = 'ocean' | 'tencent' | 'changdu'

export interface LoginCredentials {
  email: string
  password: string
}

export interface OpenLoginWindowOptions {
  email?: string
  password?: string
  remember?: boolean
  /** 配置账号 ID，用于按账号分别保存浏览器登录助手凭据 */
  configId?: number
  /** 仅保存/清除本机凭据，不打开浏览器窗口 */
  persistOnly?: boolean
}

interface StoredCredentialFile {
  email?: string
  passwordEnc?: string
}

const CREDENTIALS_DIR = 'login-credentials'

/**
 * 巨量登录页自动填表（在页面上下文执行）
 * opencli 实测：默认即「邮箱登录」+ email/password 输入框；顶部仅有「扫码登录更安全」文案，非扫码面板。
 * 策略：有输入框则直接填写并点击「登录」；无滑块时可由现有 Cookie 采集逻辑自动完成。
 */
const OCEAN_AUTOFILL_SCRIPT = `
(async function() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const emailVal = __EMAIL__;
  const passwordVal = __PASSWORD__;
  if (window.__xuanshuOceanLoginDone) return true;

  const setNativeValue = (el, value) => {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const dismissOverlays = () => {
    document.querySelectorAll('span, button').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (t !== '×' && t !== '✕' && t !== 'X') return;
      const panel = el.closest('div');
      const panelText = panel?.textContent || '';
      if (
        panelText.includes('账号风险提示') ||
        panelText.includes('请选择登录时遇到的问题') ||
        panelText.includes('请阅读并勾选协议')
      ) {
        el.click();
      }
    });
  };

  const getSdk = () => document.querySelector('#account-sdk');

  const findCredentialInputs = (sdk) => {
    if (!sdk) return { emailInput: null, pwdInput: null };
    return {
      emailInput:
        sdk.querySelector('input[name=email]') || sdk.querySelector('input[type=email]'),
      pwdInput:
        sdk.querySelector('input[name=password]') || sdk.querySelector('input[type=password]')
    };
  };

  /** 仅当没有账密输入框时，点一次「邮箱登录」（不点手机登录/扫码） */
  const ensureEmailTab = (sdk) => {
    const { emailInput, pwdInput } = findCredentialInputs(sdk);
    if (emailInput && pwdInput) return { emailInput, pwdInput };

    const emailTab = Array.from(sdk.querySelectorAll('div, span')).find(
      (el) => (el.textContent || '').trim() === '邮箱登录'
    );
    if (emailTab && typeof emailTab.click === 'function') {
      emailTab.click();
    }
    return findCredentialInputs(sdk);
  };

  const tryCheckAgreement = (sdk) => {
    const agreeSpan = Array.from(sdk.querySelectorAll('span')).find((el) =>
      (el.textContent || '').includes('我已阅读')
    );
    if (!agreeSpan) return;
    let node = agreeSpan.parentElement;
    for (let i = 0; i < 5 && node; i++) {
      if ((node.textContent || '').includes('其他方式')) break;
      const svg = node.querySelector('svg');
      if (svg) {
        const clickTarget = svg.closest('div') || svg;
        if (typeof clickTarget.click === 'function') {
          clickTarget.click();
          return;
        }
      }
      node = node.parentElement;
    }
  };

  const clickLoginButton = (sdk) => {
    const buttons = Array.from(sdk.querySelectorAll('button'));
    const loginBtn = buttons.find((el) => {
      const text = (el.textContent || '').trim();
      if (text !== '登录') return false;
      if (el.disabled) return false;
      const title = (el.getAttribute('title') || '').trim();
      if (title && /不能为空|请输入/.test(title)) return false;
      return true;
    });
    if (loginBtn && typeof loginBtn.click === 'function') {
      loginBtn.click();
      return true;
    }
    return false;
  };

  dismissOverlays();

  for (let i = 0; i < 35; i++) {
    const sdk = getSdk();
    if (!sdk) {
      await sleep(350);
      continue;
    }

    const { emailInput, pwdInput } = ensureEmailTab(sdk);
    if (emailInput && pwdInput) {
      setNativeValue(emailInput, emailVal);
      setNativeValue(pwdInput, passwordVal);
      await sleep(300);
      tryCheckAgreement(sdk);
      await sleep(200);
      if (emailInput.value === emailVal && pwdInput.value.length > 0) {
        window.__xuanshuOceanLoginDone = true;
        clickLoginButton(sdk);
        return true;
      }
    }

    await sleep(350);
  }
  return false;
})();
`

function credentialsDir(): string {
  const dir = join(app.getPath('userData'), CREDENTIALS_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function credentialsFilePath(platform: LoginPlatform, configId?: number): string | null {
  if (configId == null || configId <= 0) return null
  return join(credentialsDir(), `${platform}-${configId}.json`)
}

function encrypt(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  return Buffer.from(value, 'utf-8').toString('base64')
}

function decrypt(encoded: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  }
  return Buffer.from(encoded, 'base64').toString('utf-8')
}

export function supportsLoginAutofill(platform: LoginPlatform): boolean {
  return platform === 'ocean'
}

export function isPlatformLoginUrl(platform: LoginPlatform, url: string): boolean {
  if (!url || !url.startsWith('http')) return false
  try {
    const host = new URL(url).hostname
    if (platform === 'ocean') {
      return host.includes('oceanengine.com') && url.includes('/login')
    }
    if (platform === 'tencent') {
      return host.includes('e.qq.com') || host.includes('qq.com')
    }
    if (platform === 'changdu') {
      return host.includes('changdupingtai.com')
    }
  } catch {
    return false
  }
  return false
}

export function loadStoredLoginCredentials(
  platform: LoginPlatform,
  configId?: number
): LoginCredentials | null {
  try {
    const filePath = credentialsFilePath(platform, configId)
    if (!filePath || !existsSync(filePath)) return null
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredCredentialFile
    if (!raw.email || !raw.passwordEnc) return null
    return {
      email: raw.email,
      password: decrypt(raw.passwordEnc)
    }
  } catch (error) {
    console.error(`[login-credentials] 读取 ${platform} 凭据失败:`, error)
    return null
  }
}

export function saveStoredLoginCredentials(
  platform: LoginPlatform,
  credentials: LoginCredentials,
  configId?: number
): void {
  const filePath = credentialsFilePath(platform, configId)
  if (!filePath) return
  const payload: StoredCredentialFile = {
    email: credentials.email,
    passwordEnc: encrypt(credentials.password)
  }
  writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
}

export function clearStoredLoginCredentials(platform: LoginPlatform, configId?: number): void {
  const filePath = credentialsFilePath(platform, configId)
  if (filePath && existsSync(filePath)) {
    writeFileSync(filePath, '{}', 'utf-8')
  }
}

export function resolveLoginCredentials(
  platform: LoginPlatform,
  options?: OpenLoginWindowOptions
): LoginCredentials | null {
  const email = options?.email?.trim()
  const password = options?.password ?? ''
  if (email && password) {
    return { email, password }
  }
  return loadStoredLoginCredentials(platform, options?.configId)
}

export async function persistLoginCredentialsIfRequested(
  platform: LoginPlatform,
  options?: OpenLoginWindowOptions
): Promise<void> {
  if (!options?.remember) return
  const email = options.email?.trim()
  const password = options.password ?? ''
  if (email && password && options.configId) {
    saveStoredLoginCredentials(platform, { email, password }, options.configId)
  }
}

async function autofillOceanLogin(
  contents: WebContents,
  credentials: LoginCredentials
): Promise<boolean> {
  const script = OCEAN_AUTOFILL_SCRIPT.replace('__EMAIL__', JSON.stringify(credentials.email)).replace(
    '__PASSWORD__',
    JSON.stringify(credentials.password)
  )
  try {
    return Boolean(await contents.executeJavaScript(script))
  } catch (error) {
    console.error('[login-credentials] 巨量自动填表脚本执行失败:', error)
    return false
  }
}

export async function autofillPlatformLogin(
  contents: WebContents,
  platform: LoginPlatform,
  credentials: LoginCredentials
): Promise<boolean> {
  if (!supportsLoginAutofill(platform)) return false
  if (contents.isDestroyed()) return false
  try {
    if (platform === 'ocean') {
      return await autofillOceanLogin(contents, credentials)
    }
  } catch (error) {
    console.error(`[login-credentials] ${platform} 自动填表失败:`, error)
  }
  return false
}

/** 登录页加载后轮询填表，直至成功或超时 */
export function attachLoginAutofill(
  loginWindow: BrowserWindow,
  platform: LoginPlatform,
  credentials: LoginCredentials | null
): void {
  if (!credentials?.email || !credentials?.password) return
  if (!supportsLoginAutofill(platform)) return

  let stopped = false
  let attempt = 0
  let inFlight = false
  const maxAttempts = 25
  let timer: ReturnType<typeof setInterval> | null = null

  const stop = (): void => {
    stopped = true
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const runAttempt = (): void => {
    if (stopped || inFlight || loginWindow.isDestroyed()) return
    if (!isPlatformLoginUrl(platform, loginWindow.webContents.getURL())) return

    attempt += 1
    inFlight = true
    void autofillPlatformLogin(loginWindow.webContents, platform, credentials).then((ok) => {
      inFlight = false
      if (ok) {
        console.log(`[login-credentials] ${platform} 自动填表成功（第 ${attempt} 次）`)
        stop()
      } else if (attempt >= maxAttempts) {
        console.warn(`[login-credentials] ${platform} 自动填表超时（已尝试 ${attempt} 次）`)
        stop()
      }
    })
  }

  loginWindow.webContents.on('did-finish-load', () => {
    setTimeout(runAttempt, 1000)
  })
  loginWindow.webContents.on('did-navigate', (_event, url) => {
    if (isPlatformLoginUrl(platform, url)) {
      setTimeout(runAttempt, 800)
    }
  })

  timer = setInterval(runAttempt, 1200)
  loginWindow.on('closed', stop)
}
