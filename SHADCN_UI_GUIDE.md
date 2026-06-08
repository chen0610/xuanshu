# shadcn/ui 集成指南

本项目已成功集成 shadcn/ui 组件库，提供了一套现代化、可定制的 UI 组件系统。

## 技术栈概览

### 核心框架

- **React 19.1.1** + **TypeScript 5.9.2** - 现代化的前端框架
- **Electron 38.1.2** + **Electron Vite 2.3.0** - 桌面应用构建
- **Vite 5.4.0** - 快速的构建工具

### UI 层

- **shadcn/ui** - 基于 Radix UI 的可定制化组件库
- **Tailwind CSS 3.4.1** - 原子化 CSS 框架
- **Lucide React** - 图标库（shadcn/ui 官方推荐）
- **class-variance-authority** - 类型安全的组件变体管理
- **clsx** + **tailwind-merge** - 类名工具

### 状态与数据

- **Zustand 5.0.8** - 轻量级状态管理
- **TanStack Query 5.90.9** - 服务端状态管理
- **Axios 1.13.2** - HTTP 客户端

### 路由与动画

- **React Router DOM 7.9.6** - 客户端路由
- **Framer Motion 12.23.24** - 动画库

## 已安装的组件

项目中已包含以下 shadcn/ui 组件：

- **Button** - 按钮组件，支持多种变体（default, destructive, outline, secondary, ghost, link）
- **Input** - 输入框组件
- **Card** - 卡片组件（包含 CardHeader, CardTitle, CardDescription, CardContent, CardFooter）
- **Label** - 标签组件
- **Dialog** - 对话框组件

## 使用方法

### 1. 导入组件

所有 UI 组件都可以从 `@/components/common` 导入：

```typescript
import { Button, Input, Card, Label } from '@/components/common'
```

或者直接从 UI 目录导入：

```typescript
import { Button } from '@/components/ui/button'
```

### 2. 使用示例

#### Button 组件

```typescript
<Button variant="default" size="default">
  点击我
</Button>

<Button variant="outline" size="sm">
  小按钮
</Button>

<Button variant="destructive">
  危险操作
</Button>
```

#### Card 组件

```typescript
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文本</CardDescription>
  </CardHeader>
  <CardContent>
    <p>卡片内容</p>
  </CardContent>
  <CardFooter>
    <Button>操作</Button>
  </CardFooter>
</Card>
```

#### Input 组件

```typescript
<div className="space-y-2">
  <Label htmlFor="email">邮箱</Label>
  <Input
    id="email"
    type="email"
    placeholder="user@example.com"
  />
</div>
```

## 主题定制

### 颜色系统

项目使用 CSS 变量进行主题管理，支持明暗两种模式。主题颜色定义在 `src/renderer/src/styles/globals.css` 中。

主要颜色变量：

- `--background` - 背景色
- `--foreground` - 前景色（文本）
- `--primary` - 主色调
- `--secondary` - 次要色
- `--accent` - 强调色
- `--muted` - 柔和色
- `--destructive` - 危险/错误色

### 修改主题

要自定义主题颜色，请编辑 `globals.css` 中的 CSS 变量值：

```css
:root {
  --primary: 221.2 83.2% 53.3%; /* HSL 格式 */
  /* 其他颜色... */
}
```

### Tailwind 配置

Tailwind 配置文件 (`tailwind.config.js`) 已配置为使用 shadcn/ui 的标准主题系统。

## 添加新组件

要添加更多 shadcn/ui 组件：

1. 访问 [shadcn/ui 文档](https://ui.shadcn.com/docs/components/)
2. 选择需要的组件
3. 手动创建组件文件到 `src/renderer/src/components/ui/`
4. 在 `components/common/index.ts` 中导出（可选）

## 路径别名

项目配置了两个路径别名：

- `@/*` - 指向 `src/renderer/src/*`
- `@renderer/*` - 指向 `src/renderer/src/*`

推荐在 shadcn/ui 组件中使用 `@/` 别名，在其他地方可以继续使用 `@renderer/`。

## 与后端集成

### API 通信

前端通过 Axios + TanStack Query 与 FastAPI 后端通信：

```typescript
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/services/user.service'

function UserList() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getUsers
  })

  // 使用数据...
}
```

### 类型安全

TypeScript 类型定义位于 `src/renderer/src/types/` 目录，与后端 Pydantic 模型对应。

### 认证

认证状态通过 Zustand store 管理（`src/renderer/src/stores/auth.store.ts`），JWT token 自动附加到所有 API 请求。

## 开发命令

```bash
# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build

# 打包（Windows）
npm run build:win
```

## 最佳实践

1. **组件导入**：统一从 `@/components/common` 导入公共组件
2. **样式管理**：优先使用 Tailwind 类名，避免内联样式
3. **类型安全**：充分利用 TypeScript 类型系统
4. **代码复用**：创建可复用的组件和工具函数
5. **性能优化**：合理使用 React.memo、useMemo、useCallback

## 常见问题

### Q: 如何切换明暗主题？

A: 在根元素添加 `dark` 类即可切换到暗色模式：

```typescript
document.documentElement.classList.add('dark')
```

### Q: 如何自定义组件样式？

A: shadcn/ui 组件支持通过 `className` prop 添加自定义样式：

```typescript
<Button className="custom-class">按钮</Button>
```

### Q: 如何添加更多 Radix UI 组件？

A: 安装对应的 Radix UI 包，然后创建组件文件：

```bash
npm install @radix-ui/react-tooltip
```

## 相关资源

- [shadcn/ui 文档](https://ui.shadcn.com/)
- [Radix UI 文档](https://www.radix-ui.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
