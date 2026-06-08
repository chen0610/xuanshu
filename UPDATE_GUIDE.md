# Electron 自动更新功能使用指南

## 功能概述

应用已集成自动更新功能,支持:

- 应用启动时自动检查更新(仅生产环境)
- 手动检查更新
- 下载进度显示
- 版本信息和更新日志展示
- 一键安装更新

## 配置说明

### 1. 更新服务器配置

更新服务器地址已配置在 `electron-builder.yml`:

```yaml
publish:
  provider: generic
  url: https://update.bodahu.com/agent/
```

### 2. 版本号管理

应用版本号在 `package.json` 中管理:

```json
{
  "version": "1.0.0"
}
```

每次发布新版本时,需要更新此版本号。

## 发布流程

### 1. 准备新版本

1. 更新 `frontend/package.json` 中的 `version` 字段
2. 提交代码变更

### 2. 构建应用

运行构建命令:

```bash
# Windows
cd frontend
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建完成后,在 `frontend/dist` 目录下会生成:

- 安装包文件 (如 `xuanshu-1.0.1-setup.exe`)
- 更新配置文件 (如 `latest.yml`)

### 3. 部署到更新服务器

将以下文件上传到 `https://update.bodahu.com/agent/`:

**Windows:**

- `latest.yml`
- `xuanshu-x.x.x-setup.exe`
- `xuanshu-x.x.x-setup.exe.blockmap`

**macOS:**

- `latest-mac.yml`
- `xuanshu-x.x.x.dmg`
- `xuanshu-x.x.x.dmg.blockmap`

**Linux:**

- `latest-linux.yml`
- `xuanshu-x.x.x.AppImage`

### 4. latest.yml 文件格式

```yaml
version: 1.0.1
files:
  - url: xuanshu-1.0.1-setup.exe
    sha512: [文件 SHA512 哈希值]
    size: 123456789
path: xuanshu-1.0.1-setup.exe
sha512: [文件 SHA512 哈希值]
releaseDate: '2025-11-27T08:00:00.000Z'
```

## 用户使用

### 自动更新(生产环境)

1. 应用启动后 5 秒自动检查更新
2. 如果发现新版本,自动弹出更新对话框
3. 用户可以选择:
   - 立即下载
   - 稍后提醒

4. 下载完成后提示:
   - 立即安装(重启应用)
   - 稍后安装

### 手动检查更新

1. 点击导航栏右上角用户名
2. 在下拉菜单中点击「检查更新」
3. 系统会立即检查更新并显示结果

### 更新对话框说明

- **正在检查更新**: 显示检查进度
- **发现新版本**: 显示版本号、更新日期和更新内容
- **下载进度**: 显示实时下载速度和进度条
- **已是最新版本**: 自动关闭(3秒后)
- **更新失败**: 显示错误信息

## 开发环境测试

### 本地测试配置

开发环境不会自动检查更新。如需测试,可以:

1. 创建 `dev-app-update.yml` 测试配置文件
2. 修改 `updater.ts` 中的配置:

```typescript
autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
```

3. 在本地启动简单的 HTTP 服务器测试更新流程

### 模拟更新场景

1. 构建当前版本应用
2. 修改 `package.json` 版本号为更高版本
3. 再次构建
4. 将新版本文件部署到测试服务器
5. 运行旧版本应用测试更新流程

## 安全说明

### Windows 代码签名

建议对 Windows 安装包进行代码签名,避免 SmartScreen 警告:

```yaml
# electron-builder.yml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${CERTIFICATE_PASSWORD}
```

### macOS 公证

macOS 应用需要公证才能正常分发:

```yaml
# electron-builder.yml
mac:
  notarize: true
```

需要配置 Apple Developer 账号凭证。

## 故障排除

### 更新检查失败

1. 检查网络连接
2. 确认更新服务器 URL 正确
3. 检查服务器 CORS 配置
4. 查看 electron-log 日志文件

### 下载失败

1. 检查服务器文件是否存在
2. 确认文件 SHA512 校验和正确
3. 检查磁盘空间是否充足

### 安装失败

1. 确认用户有管理员权限
2. 关闭杀毒软件重试
3. 检查 Windows SmartScreen 设置

## 日志位置

应用日志保存在:

- **Windows**: `%USERPROFILE%\AppData\Roaming\xuanshu\logs`
- **macOS**: `~/Library/Logs/xuanshu`
- **Linux**: `~/.config/xuanshu/logs`

日志文件名: `main.log`

## API 参考

### 主进程 API

```typescript
// 检查更新
await checkForUpdates()

// 下载更新
await downloadUpdate()

// 安装更新并重启
quitAndInstall()
```

### 渲染进程 API

```typescript
// 检查更新
await window.api.update.checkForUpdates()

// 下载更新
await window.api.update.downloadUpdate()

// 安装更新
await window.api.update.installUpdate()

// 监听事件
window.api.update.onUpdateAvailable((info) => {
  console.log('New version:', info.version)
})
```

## 相关文件

- `frontend/src/main/updater.ts` - 主进程更新逻辑
- `frontend/src/preload/index.ts` - IPC 通信桥接
- `frontend/src/renderer/src/stores/update.store.ts` - 更新状态管理
- `frontend/src/renderer/src/components/UpdateDialog.tsx` - 更新对话框 UI
- `frontend/electron-builder.yml` - 构建和发布配置

## 注意事项

1. ⚠️ 开发环境(dev mode)不会自动检查更新
2. ⚠️ 首次发布时,用户需要手动下载安装包
3. ⚠️ 更新服务器需要支持 HTTPS 和 CORS
4. ⚠️ 版本号必须严格遵循语义化版本规范(Semantic Versioning)
5. ⚠️ 增量更新仅支持相同主版本号之间
