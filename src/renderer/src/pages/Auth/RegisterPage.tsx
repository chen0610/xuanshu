import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'

export const RegisterPage = () => {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [usernamePlaceholder, setUsernamePlaceholder] = useState('请输入用户名（3-50个字符）')
  const [passwordPlaceholder, setPasswordPlaceholder] = useState('至少6个字符')
  const [confirmPasswordPlaceholder, setConfirmPasswordPlaceholder] = useState('请再次输入密码')
  const [namePlaceholder, setNamePlaceholder] = useState('请输入姓名')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    clearError()

    // 验证必填字段
    if (!username || !password || !name.trim()) {
      setFormError('请填写所有必填字段')
      return
    }

    // 验证用户名长度
    if (username.length < 3) {
      setFormError('用户名长度至少为3个字符')
      return
    }

    if (username.length > 50) {
      setFormError('用户名长度不能超过50个字符')
      return
    }

    // 验证用户名格式（只允许小写字母和数字）
    const usernameRegex = /^[a-z0-9]+$/
    if (!usernameRegex.test(username)) {
      setFormError('用户名只能包含小写字母和数字')
      return
    }

    // 验证密码长度
    if (password.length < 6) {
      setFormError('密码长度至少为6个字符')
      return
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      setFormError('两次输入的密码不一致')
      return
    }

    try {
      await register({
        username,
        password,
        name: name.trim()
      })

      // 显示成功提示
      setShowSuccess(true)

      // 延迟跳转到登录页
      setTimeout(() => {
        navigate('/auth/login', {
          state: { message: '注册成功，请登录' }
        })
      }, 1500)
    } catch (err: any) {
      setFormError(err.detail || err.message || '注册失败')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">注册账户</CardTitle>
          <CardDescription>填写以下信息创建新账户</CardDescription>
        </CardHeader>

        <CardContent>
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      注册成功！
                    </p>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                      正在跳转到登录页面...
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(error || formError) && !showSuccess && (
            <motion.div
              className="mb-6 p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error || formError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                用户名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={usernamePlaceholder}
                autoComplete="username"
                required
                disabled={isLoading || showSuccess}
                className="input-light-placeholder"
                onFocus={() => setUsernamePlaceholder('')}
                onBlur={() => setUsernamePlaceholder('请输入用户名（3-50个字符）')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                密码 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordPlaceholder}
                  autoComplete="new-password"
                  required
                  disabled={isLoading || showSuccess}
                  className="pr-10 input-light-placeholder"
                  onFocus={() => setPasswordPlaceholder('')}
                  onBlur={() => setPasswordPlaceholder('至少6个字符')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  disabled={isLoading || showSuccess}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                确认密码 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={confirmPasswordPlaceholder}
                  autoComplete="new-password"
                  required
                  disabled={isLoading || showSuccess}
                  className="pr-10 input-light-placeholder"
                  onFocus={() => setConfirmPasswordPlaceholder('')}
                  onBlur={() => setConfirmPasswordPlaceholder('请再次输入密码')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  disabled={isLoading || showSuccess}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                姓名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePlaceholder}
                autoComplete="name"
                required
                disabled={isLoading || showSuccess}
                className="input-light-placeholder"
                onFocus={() => setNamePlaceholder('')}
                onBlur={() => setNamePlaceholder('请输入姓名')}
              />
            </div>

            <Button type="submit" className="w-full mt-6" disabled={isLoading || showSuccess}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {showSuccess ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  注册成功
                </>
              ) : isLoading ? (
                '注册中...'
              ) : (
                '注册'
              )}
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
              已有账户？{' '}
              <Link to="/auth/login" className="text-primary hover:underline">
                立即登录
              </Link>
            </p>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
