import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Label
} from '../../../../components/ui'
import { Search } from 'lucide-react'

interface Keyword {
  keyword: string
  matchType: string
  bidPrice: number
}

interface KeywordConfigStepProps {
  keywords: Keyword[]
  onUpdate: (keywords: Keyword[]) => void
}

const DEFAULT_KEYWORDS = `可以看短剧的免费影视软件
恢复观看短剧`

export const KeywordConfigStep: React.FC<KeywordConfigStepProps> = ({ keywords, onUpdate }) => {
  const [keywordText, setKeywordText] = useState(DEFAULT_KEYWORDS)

  useEffect(() => {
    // 初始化时将默认关键词转换为keywords数组
    if (keywords.length === 0) {
      const lines = DEFAULT_KEYWORDS.split('\n').filter((line) => line.trim())
      const initialKeywords = lines.map((line) => ({
        keyword: line.trim(),
        matchType: 'WIDE_MATCH',
        bidPrice: 0
      }))
      onUpdate(initialKeywords)
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setKeywordText(text)

    // 将文本按行分割并转换为keywords数组
    const lines = text.split('\n').filter((line) => line.trim())
    const newKeywords = lines.map((line) => ({
      keyword: line.trim(),
      matchType: 'WIDE_MATCH',
      bidPrice: 0
    }))
    onUpdate(newKeywords)
  }

  // 计算有效行数（非空行）
  const lineCount = keywordText.split('\n').filter((line) => line.trim()).length

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3 items-center">
          <Search className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>关键词配置</CardTitle>
            <CardDescription>手动填写关键词，一行一个</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>关键词列表</Label>
            <span className="text-sm text-muted-foreground">共 {lineCount} 行</span>
          </div>
          <textarea
            className="w-full min-h-[200px] px-3 py-2 border rounded-md bg-background resize-y"
            placeholder="请输入关键词，一行一个"
            value={keywordText}
            onChange={handleTextChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}
