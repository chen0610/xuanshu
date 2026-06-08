import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Label
} from '../../components/common'
import { Loader2, Eye, EyeOff } from 'lucide-react'

// 账号密码存储的 key
const REMEMBERED_CREDENTIALS_KEY = 'remembered_credentials'

// 保存账号密码的工具函数
const saveCredentials = (username: string, password: string) => {
  try {
    const credentials = {
      username,
      password: btoa(unescape(encodeURIComponent(password))) // 简单的 base64 编码
    }
    localStorage.setItem(REMEMBERED_CREDENTIALS_KEY, JSON.stringify(credentials))
  } catch (error) {
    console.error('保存账号密码失败:', error)
  }
}

// 读取账号密码的工具函数
const loadCredentials = (): { username: string; password: string } | null => {
  try {
    const saved = localStorage.getItem(REMEMBERED_CREDENTIALS_KEY)
    if (saved) {
      const credentials = JSON.parse(saved)
      return {
        username: credentials.username,
        password: decodeURIComponent(escape(atob(credentials.password))) // base64 解码
      }
    }
  } catch (error) {
    console.error('读取账号密码失败:', error)
  }
  return null
}

// 清除保存的账号密码
const clearCredentials = () => {
  localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY)
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const { login, isLoading, error, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const [usernamePlaceholder, setUsernamePlaceholder] = useState('请输入用户名')
  const [passwordPlaceholder, setPasswordPlaceholder] = useState('••••••••')

  // 页面加载时读取保存的账号密码
  useEffect(() => {
    const saved = loadCredentials()
    if (saved) {
      setUsername(saved.username)
      setPassword(saved.password)
      setRememberMe(true)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    clearError()

    if (!username || !password) {
      setFormError('请填写所有字段')
      return
    }

    try {
      await login({ username, password })

      // 根据记住密码选项保存或清除账号密码
      if (rememberMe) {
        saveCredentials(username, password)
      } else {
        clearCredentials()
      }

      navigate('/config')
    } catch (err: any) {
      setFormError(err.detail || '登录失败')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">登录系统</CardTitle>
          <CardDescription>输入您的用户名和密码以访问系统</CardDescription>
        </CardHeader>

        <CardContent>
          {(error || formError) && (
            <motion.div
              className="p-3 mb-6 text-sm rounded-md border bg-destructive/10 border-destructive text-destructive"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error || formError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={usernamePlaceholder}
                autoComplete="username"
                className="input-light-placeholder"
                onFocus={() => setUsernamePlaceholder('')}
                onBlur={() => setUsernamePlaceholder('请输入用户名')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordPlaceholder}
                  autoComplete="current-password"
                  className="pr-10 input-light-placeholder"
                  onFocus={() => setPasswordPlaceholder('')}
                  onBlur={() => setPasswordPlaceholder('••••••••')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex absolute inset-y-0 right-0 items-center pr-3 transition-colors text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border transition-colors cursor-pointer border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm font-normal transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
              >
                记住账号密码
              </Label>
            </div>

            <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>

        <CardFooter>
          <motion.div
            className="w-full text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm text-muted-foreground">
              没有账户？{' '}
              <Link to="/auth/register" className="text-primary hover:underline">
                立即注册
              </Link>
            </p>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
