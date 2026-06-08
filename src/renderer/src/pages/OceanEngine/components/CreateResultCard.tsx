import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui'
import type { OceanEngineBatchCreateAdsAccountResult } from '../../../services/ocean-engine.service'

interface CreateResultCardProps {
  results: OceanEngineBatchCreateAdsAccountResult[]
}

export const CreateResultCard: React.FC<CreateResultCardProps> = ({ results }) => {
  if (results.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>执行结果</CardTitle>
        <CardDescription>
          每个账户独立执行两步：创建项目、再创建广告单元。项目失败时会跳过广告单元创建。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">广告主 ID</th>
                <th className="text-left p-3 font-medium">状态</th>
                <th className="text-left p-3 font-medium">项目结果</th>
                <th className="text-left p-3 font-medium">广告单元结果</th>
                <th className="text-left p-3 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => {
                const projectId =
                  item.project.data &&
                  !Array.isArray(item.project.data) &&
                  typeof item.project.data === 'object'
                    ? (item.project.data as Record<string, unknown>).project_id
                    : undefined

                return (
                  <tr key={item.advertiser_id} className="border-b last:border-0 align-top">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">
                      {item.advertiser_id}
                    </td>
                    <td className="p-3">
                      {item.success ? (
                        <span className="inline-flex gap-1 items-center text-green-600">
                          <CheckCircle className="w-4 h-4 shrink-0" /> 成功
                        </span>
                      ) : (
                        <span className="inline-flex gap-1 items-center text-destructive">
                          <XCircle className="w-4 h-4 shrink-0" /> 失败
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="font-mono">code {item.project.code ?? '-'}</div>
                      {projectId !== undefined && (
                        <div className="font-mono text-green-600 mt-0.5">
                          project_id: {String(projectId)}
                        </div>
                      )}
                      <div className="text-muted-foreground mt-1 max-w-[12rem] break-words">
                        {item.project.message ?? ''}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {item.promotions.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <div className="space-y-1">
                          {item.promotions.map((promotion, idx) => (
                            <div
                              key={`${item.advertiser_id}-${idx}`}
                              className="rounded bg-muted/40 px-2 py-1"
                            >
                              <div className="font-mono">
                                #{idx + 1} code {promotion.code ?? '-'}
                              </div>
                              <div className="text-muted-foreground break-words">
                                {promotion.message ?? ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 max-w-md text-xs break-words">{item.message ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">查看完整 JSON</summary>
          <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-auto max-h-72">
            {JSON.stringify(results, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}
