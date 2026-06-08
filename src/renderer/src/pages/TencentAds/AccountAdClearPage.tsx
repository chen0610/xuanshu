import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Textarea
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { displayPromotionService } from '../../services/tencent-ads.service'
import { toast } from 'sonner'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

type ClearType = 'all' | 'display' | 'smart'

interface ClearResult {
  total_adgroups: number
  task_ids: Array<number | string>
  account_results: Array<{
    account_id: number
    adgroup_count: number
  }>
  clear_type?: ClearType
}

const clearTypeLabels: Record<ClearType, string> = {
  all: '全部',
  display: '展示广告',
  smart: '智能投放'
}

const parseAccountIds = (text: string): string[] => {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\d+$/.test(line))
    )
  )
}

export const AccountAdClearPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [clearType, setClearType] = useState<ClearType>('all')
  const [accountsText, setAccountsText] = useState('')
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [result, setResult] = useState<ClearResult | null>(null)

  const accountIds = useMemo(() => parseAccountIds(accountsText), [accountsText])

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async (): Promise<void> => {
    setLoadingConfigs(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      toast.error('加载账号配置失败')
    } finally {
      setLoadingConfigs(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择账号配置')
      return
    }
    if (accountIds.length === 0) {
      toast.error('请输入账号列表')
      return
    }
    const invalidLines = accountsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^\d+$/.test(line))
    if (invalidLines.length > 0) {
      toast.error(`存在无效账号：${invalidLines[0]}`)
      return
    }
    if (
      !window.confirm(
        `确认清空 ${accountIds.length} 个账号下的${clearTypeLabels[clearType]}营销单元？该操作不可逆。`
      )
    ) {
      return
    }

    setClearing(true)
    setResult(null)
    try {
      const response = await displayPromotionService.clearAccountAds({
        selected_cookie_id: selectedConfigId,
        account_ids: accountIds,
        clear_type: clearType
      })
      if (response.code === 0 && response.data) {
        setResult(response.data)
        toast.success(
          `已提交清空任务，共 ${response.data.total_adgroups} 个${clearTypeLabels[clearType]}营销单元`
        )
      } else {
        toast.error(response.error || '清空失败')
      }
    } catch (err: any) {
      toast.error(err.message || '清空失败')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-destructive/10 p-3">
            <Trash2 className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">账户广告清空</h1>
            <p className="text-sm text-muted-foreground">
              批量查询指定账号下的展示广告/智能投放营销单元，并提交删除异步任务。
            </p>
          </div>
        </div>
      </div>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            高风险操作
          </CardTitle>
          <CardDescription>
            请求会按 100
            个账号一组分页拉取营销单元列表，再按账号分组批量删除。请确认账号列表无误后再执行。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">选择账号配置 *</div>
            {loadingConfigs ? (
              <div className="flex h-20 w-full max-w-sm items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载配置中...
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {configs.map((config) => {
                  const isSelected = selectedConfigId === config.id
                  return (
                    <button
                      key={config.id}
                      type="button"
                      disabled={clearing}
                      onClick={() => setSelectedConfigId(config.id)}
                      className={`flex min-h-[78px] items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isSelected
                          ? 'border-foreground bg-muted/50 text-foreground'
                          : 'border-border bg-background hover:border-foreground/70'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected ? 'border-foreground' : 'border-muted-foreground'
                          }`}
                        >
                          {isSelected && (
                            <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold">
                            {config.cookie_name}
                          </span>
                          {config.realname && (
                            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                              {config.realname}
                            </span>
                          )}
                        </span>
                      </span>
                      {isSelected && (
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">清除类型 *</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(Object.keys(clearTypeLabels) as ClearType[]).map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="account-ad-clear-type"
                    value={type}
                    checked={clearType === type}
                    disabled={clearing}
                    onChange={() => setClearType(type)}
                    className="h-4 w-4 accent-foreground"
                  />
                  <span>{clearTypeLabels[type]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="account-ad-clear-accounts">账号列表（一行一个）</Label>
              <span className="text-xs text-muted-foreground">
                已识别 {accountIds.length} 个账号
              </span>
            </div>
            <Textarea
              id="account-ad-clear-accounts"
              value={accountsText}
              onChange={(event) => setAccountsText(event.target.value)}
              placeholder=""
              disabled={clearing}
              className="min-h-[260px] font-mono"
            />
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={handleClear}
            disabled={clearing || loadingConfigs || !selectedConfigId || accountIds.length === 0}
            className="gap-2"
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            确认清空
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>提交结果</CardTitle>
            <CardDescription>
              共找到 {result.total_adgroups} 个{clearTypeLabels[result.clear_type || clearType]}
              营销单元，生成 {result.task_ids.length} 个删除任务。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              任务 ID：{result.task_ids.length > 0 ? result.task_ids.join('、') : '无'}
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">账号 ID</th>
                    <th className="px-3 py-2 font-medium">单元数量</th>
                  </tr>
                </thead>
                <tbody>
                  {result.account_results.map((item) => (
                    <tr key={item.account_id} className="border-t">
                      <td className="px-3 py-2 font-mono">{item.account_id}</td>
                      <td className="px-3 py-2">{item.adgroup_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
