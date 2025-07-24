'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Copy, 
  Volume2, 
  ArrowUpDown, 
  Loader2, 
  AlertTriangle, 
  Coins,
  Download,
  History,
  FileText,
  Wand2,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn, copyToClipboard, getCharacterCount } from '@/lib/utils'
import { APP_CONFIG } from '@/config/app.config'
import { useAuth } from '@/lib/hooks/useAuth'
import { useGlobalCredits } from '@/lib/contexts/credits-context'
import { createServerCreditService } from '@/lib/services/credits'
import { useGuestLimit } from '@/components/guest-limit-guard'
import { ConditionalRender } from '@/components/auth/auth-guard'
import { CreditEstimate, FreeQuotaProgress } from '@/components/credits/credit-balance'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/hooks/use-toast'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { detectLocaleFromPath } from '@/lib/navigation'
import { BidirectionalNavigation } from '@/components/bidirectional-navigation'

// Formatting utilities
import { 
  parseTextFormatting, 
  reconstructFormattedText, 
  extractTranslatableContent,
  convertToBasicHTML
} from '@/lib/formatting/text-formatter'
import { downloadDOCX, downloadPDF } from '@/lib/formatting/document-export'
import { 
  translationHistoryService, 
  TranslationHistoryItem 
} from '@/lib/services/translation-history'
import { TranslationHistory } from './history/translation-history'

interface TranslationState {
  sourceText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  isLoading: boolean
  error: string | null
  hasFormatting: boolean
  preserveFormatting: boolean
}

interface FormattedTranslatorWidgetProps {
  defaultSourceLang?: string
  defaultTargetLang?: string
  placeholder?: string
  className?: string
}

export function FormattedTranslatorWidget({ 
  defaultSourceLang = 'ht',
  defaultTargetLang = 'en',
  placeholder = 'Type your text here...',
  className
}: FormattedTranslatorWidgetProps) {
  const { user } = useAuth()
  const { credits, hasEnoughCredits, estimateCredits, updateCredits } = useGlobalCredits()
  const { limitStatus, recordTranslation, canTranslate, isLimitReached } = useGuestLimit()
  const router = useRouter()
  const pathname = usePathname()
  const { locale } = detectLocaleFromPath(pathname)
  const t = useTranslations('TranslatorWidget')
  
  const [state, setState] = useState<TranslationState>({
    sourceText: '',
    translatedText: '',
    sourceLanguage: defaultSourceLang,
    targetLanguage: defaultTargetLang,
    isLoading: false,
    error: null,
    hasFormatting: false,
    preserveFormatting: true
  })

  const [showHistory, setShowHistory] = useState(false)
  const [showFormattingPreview, setShowFormattingPreview] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  const maxLength = APP_CONFIG.nllb.maxLength
  const characterCount = getCharacterCount(state.sourceText)
  const isOverMaxLimit = characterCount > maxLength
  
  // Check for formatting when source text changes
  useEffect(() => {
    const formatted = parseTextFormatting(state.sourceText)
    setState(prev => ({
      ...prev,
      hasFormatting: formatted.hasFormatting
    }))
  }, [state.sourceText])

  // 积分消耗计算
  const estimatedCredits = estimateCredits(characterCount)
  const canAfford = hasEnoughCredits(estimatedCredits)
  const needsCredits = estimatedCredits > 0

  // 🔥 轮询翻译任务状态
  const pollTranslationStatus = useCallback(async (jobId: string) => {
    console.log('[Translation Poll] 开始轮询任务状态:', jobId)
    
    if (!jobId || jobId === 'undefined') {
      console.error('[Translation Poll] 无效的jobId:', jobId)
      setState(prev => ({
        ...prev,
        error: '任务ID无效，请重新翻译',
        isLoading: false,
      }))
      return
    }
    
    let attempts = 0
    const maxAttempts = 60 // 最多轮询5分钟
    const startTime = Date.now()
    
    const poll = async () => {
      try {
        attempts++
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
        console.log(`[Translation Poll] 轮询尝试 ${attempts}/${maxAttempts}, 已用时: ${elapsedSeconds}秒`)
        
        const response = await fetch(`/api/translate/status?jobId=${encodeURIComponent(jobId)}`)
        const statusData = await response.json()
        
        if (!response.ok) {
          console.error('[Translation Poll] 状态查询失败:', statusData)
          throw new Error(statusData.error || '查询状态失败')
        }
        
        console.log('[Translation Poll] 任务状态:', {
          status: statusData.status,
          progress: statusData.progress,
          currentChunk: statusData.currentChunk,
          totalChunks: statusData.totalChunks
        })
        
        // 🔥 关键修复：确保进度正确显示
        if (statusData.progress !== undefined && statusData.progress >= 0) {
          const progressText = statusData.status === 'processing' 
            ? `翻译进度: ${statusData.progress}% (${statusData.currentChunk || 0}/${statusData.totalChunks || 0} 块)`
            : statusData.status === 'pending'
            ? '翻译任务已创建，等待处理...'
            : `处理中... ${statusData.progress}%`
            
          setState(prev => ({
            ...prev,
            translatedText: progressText,
          }))
        }
        
        if (statusData.status === 'completed' && statusData.result) {
          // 🔥 关键修复：翻译完成后正确显示结果
          console.log('[Translation Poll] 翻译完成！结果长度:', statusData.result.length)
          
          // Handle formatted translation result
          let finalTranslatedText = statusData.result
          if (state.preserveFormatting && state.hasFormatting) {
            const originalFormatted = parseTextFormatting(state.sourceText)
            const translatedBlocks = statusData.result.split('\n')
            finalTranslatedText = reconstructFormattedText(originalFormatted, translatedBlocks)
          }
          
          setState(prev => ({
            ...prev,
            translatedText: finalTranslatedText,
            isLoading: false,
          }))
          
          // Save to translation history
          await saveToHistory(state.sourceText, finalTranslatedText)
          
          toast({
            title: '翻译完成',
            description: `长文本翻译已完成，共处理 ${statusData.totalChunks || 0} 个文本块，用时 ${elapsedSeconds} 秒`,
          })
          
          return // 停止轮询
        } else if (statusData.status === 'failed') {
          // 翻译失败
          console.error('[Translation Poll] 翻译失败:', statusData.error)
          throw new Error(statusData.error || '翻译失败')
        } else if (statusData.status === 'processing' || statusData.status === 'pending') {
          // 继续轮询
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000) // 2秒后再次轮询
          } else {
            throw new Error(`翻译超时（${Math.floor(maxAttempts * 2 / 60)}分钟），请重试`)
          }
        }
        
      } catch (error) {
        console.error('[Translation Poll] 轮询失败:', error)
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : '查询翻译状态失败',
          isLoading: false,
        }))
      }
    }
    
    // 立即开始第一次轮询
    poll()
  }, [state.sourceText, state.preserveFormatting, state.hasFormatting])

  const saveToHistory = async (sourceText: string, translatedText: string) => {
    try {
      const formatted = parseTextFormatting(sourceText)
      await translationHistoryService.saveTranslation({
        userId: user?.id,
        sessionId,
        sourceText,
        translatedText,
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
        hasFormatting: formatted.hasFormatting,
        formattingData: formatted,
        type: 'text',
        characterCount,
        creditsUsed: estimatedCredits
      })
    } catch (error) {
      console.warn('Failed to save translation to history:', error)
    }
  }

  const handleTranslate = useCallback(async () => {
    if (!state.sourceText.trim() || isOverMaxLimit) return

    // 优先检查字符数限制 - 超过300字符且未登录，直接跳转登录
    if (needsCredits && !user) {
      router.push(`/${locale}/auth/signin?redirect=` + encodeURIComponent(window.location.pathname))
      return
    }

    // 检查未登录用户翻译次数限制
    if (!user && !canTranslate) {
      toast({
        title: t('errors.limit_reached_title'),
        description: t('errors.limit_reached_description'),
        variant: "destructive",
      })
      router.push(`/${locale}/auth/signup?redirect=` + encodeURIComponent(window.location.pathname))
      return
    }

    if (needsCredits && !canAfford) {
      toast({
        title: t('credits.insufficient_balance', { required: estimatedCredits, current: credits }),
        description: t('credits.recharge_now'),
        variant: "destructive",
      })
      router.push('/pricing')
      return
    }

    // 记录未登录用户翻译次数
    if (!user) {
      const recorded = recordTranslation()
      if (!recorded) {
        toast({
          title: t('errors.daily_limit_title'),
          description: t('errors.daily_limit_description'),
          variant: "destructive",
        })
        return
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // 处理格式化文本
      let textToTranslate = state.sourceText
      let originalFormatted = null
      
      if (state.preserveFormatting && state.hasFormatting) {
        originalFormatted = parseTextFormatting(state.sourceText)
        const translatableContent = extractTranslatableContent(originalFormatted)
        textToTranslate = translatableContent.join('\n')
      }

      // 字符数检查逻辑
      const FREE_LIMIT = 1000 // 更新为1000字符免费
      const isOverLimit = characterCount > FREE_LIMIT
      
      // 如果超过免费限制且未登录，提示登录
      if (isOverLimit && !user) {
        setState(prev => ({ ...prev, isLoading: false }))
        toast({
          title: t('errors.login_required_title', { defaultValue: 'Login Required' }),
          description: t('errors.login_required_description', { 
            defaultValue: `Text over ${FREE_LIMIT} characters requires login. Please sign in to continue.`,
            limit: FREE_LIMIT 
          }),
          variant: "destructive"
        })
        
        // 延迟跳转到登录页面
        setTimeout(() => {
          window.location.href = '/auth/signin'
        }, 2000)
        
        return
      }
      
      // 选择API端点：300字符以下使用公共API，超过且已登录使用认证API
      const shouldUsePublicAPI = characterCount <= FREE_LIMIT
      const endpoint = shouldUsePublicAPI ? '/api/translate/public' : '/api/translate'
      
      // 准备请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // 如果使用认证API，添加认证头
      if (!shouldUsePublicAPI && user) {
        try {
          const { createSupabaseBrowserClient } = await import('@/lib/supabase')
          const supabase = createSupabaseBrowserClient()
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        } catch (error) {
          console.warn('Failed to get auth token:', error)
        }
      }

      const requestBody = shouldUsePublicAPI 
        ? {
            text: textToTranslate,
            sourceLang: state.sourceLanguage,
            targetLang: state.targetLanguage,
          }
        : {
            text: textToTranslate,
            sourceLanguage: state.sourceLanguage,
            targetLanguage: state.targetLanguage,
          }

      // 计算所需积分（仅对需要认证的翻译）
      let creditsRequired = 0;
      if (!shouldUsePublicAPI && user) {
        const creditService = createServerCreditService();
        const calculation = creditService.calculateCreditsRequired(characterCount);
        creditsRequired = calculation.credits_required;
        
        // 检查积分是否足够
        if (creditsRequired > 0 && credits < creditsRequired) {
          setState(prev => ({ ...prev, isLoading: false }));
          toast({
            title: '积分不足',
            description: `需要 ${creditsRequired} 积分，当前余额 ${credits} 积分。请前往充值页面购买积分。`,
            variant: "destructive",
          });
          return;
        }
        
        // 立即更新积分显示（预扣除）
        if (creditsRequired > 0) {
          const newCredits = Math.max(0, credits - creditsRequired);
          updateCredits(newCredits);
          console.log(`[Text Translation] 立即预扣除积分显示: ${creditsRequired}, 剩余显示: ${newCredits}`);
          
          // 显示积分扣除提示
          toast({
            title: '积分已扣除',
            description: `本次翻译消耗 ${creditsRequired} 积分，剩余 ${newCredits} 积分`,
            duration: 3000,
          });
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        // 特殊处理积分不足的情况
        if (response.status === 402 && data.code === 'INSUFFICIENT_CREDITS') {
          setState(prev => ({ ...prev, isLoading: false }));
          toast({
            title: '积分不足',
            description: `需要 ${data.required} 积分，当前余额 ${data.available} 积分。请前往充值页面购买积分。`,
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(data.error?.message || data.error || 'Translation failed');
      }

      // 🔥 处理长文本翻译的异步响应
      if (data.jobId || data.taskId) {
        console.log('[Long Text Translation] 检测到异步翻译任务:', data.jobId || data.taskId)
        
        // 显示进度提示
        setState(prev => ({
          ...prev,
          translatedText: '正在处理长文本翻译，请稍候...',
          isLoading: true,
        }))
        
        // 开始轮询任务状态
        pollTranslationStatus(data.jobId || data.taskId)
        return
      }
      
      // 处理不同API的响应格式
      let translatedText = ''
      if (shouldUsePublicAPI) {
        // 公共API响应格式: { success: true, translatedText: "..." }
        translatedText = data.translatedText
      } else {
        // 认证API响应格式: { translatedText: "..." }
        translatedText = data.translatedText
      }

      // Apply formatting reconstruction if needed
      if (state.preserveFormatting && state.hasFormatting && originalFormatted) {
        const translatedBlocks = translatedText.split('\n')
        translatedText = reconstructFormattedText(originalFormatted, translatedBlocks)
      }

      setState(prev => ({
        ...prev,
        translatedText: translatedText,
        isLoading: false,
      }))

      // Save to translation history
      await saveToHistory(state.sourceText, translatedText)

      // 显示积分消耗提示（仅对认证API且实际消耗积分时）
      if (!shouldUsePublicAPI && needsCredits) {
        toast({
          title: t('success.translation_complete'),
          description: t('success.credits_consumed', { credits: estimatedCredits }),
        })
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Translation failed',
        isLoading: false,
      }))
    }
  }, [state.sourceText, state.sourceLanguage, state.targetLanguage, state.preserveFormatting, state.hasFormatting, isOverMaxLimit, needsCredits, user, canAfford, estimatedCredits, credits, router, pollTranslationStatus, saveToHistory])

  const handleSwapLanguages = useCallback(() => {
    setState(prev => ({
      ...prev,
      sourceLanguage: prev.targetLanguage,
      targetLanguage: prev.sourceLanguage,
      sourceText: prev.translatedText,
      translatedText: prev.sourceText,
    }))
  }, [])

  const handleCopy = useCallback(async (text: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      toast({
        title: 'Text copied',
        description: 'Text has been copied to clipboard.'
      })
    }
  }, [])

  const handleSpeak = useCallback(async (text: string, language: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language,
        }),
      })

      const data = await response.json()
      
      if (response.ok && data.data.audioUrl) {
        const audio = new Audio(data.data.audioUrl)
        audio.play()
      }
    } catch (error) {
      console.error('TTS failed:', error)
    }
  }, [])

  const handleDownloadDOCX = useCallback(async () => {
    if (!state.translatedText) return
    
    try {
      await downloadDOCX(state.translatedText, {
        filename: `translation_${Date.now()}`,
        title: `Translation: ${state.sourceLanguage} → ${state.targetLanguage}`,
        author: user?.email || 'LoreTrans User'
      })
      toast({
        title: 'Download started',
        description: 'Your DOCX file is being downloaded.'
      })
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Could not generate DOCX file. Please try again.',
        variant: 'destructive'
      })
    }
  }, [state.translatedText, state.sourceLanguage, state.targetLanguage, user])

  const handleDownloadPDF = useCallback(async () => {
    if (!state.translatedText) return
    
    try {
      downloadPDF(state.translatedText, {
        filename: `translation_${Date.now()}`,
        title: `Translation: ${state.sourceLanguage} → ${state.targetLanguage}`,
        author: user?.email || 'LoreTrans User'
      })
      toast({
        title: 'Download started',
        description: 'Your PDF file is being downloaded.'
      })
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Could not generate PDF file. Please try again.',
        variant: 'destructive'
      })
    }
  }, [state.translatedText, state.sourceLanguage, state.targetLanguage, user])

  const handleSelectFromHistory = useCallback((item: TranslationHistoryItem) => {
    setState(prev => ({
      ...prev,
      sourceText: item.sourceText,
      translatedText: item.translatedText,
      sourceLanguage: item.sourceLanguage,
      targetLanguage: item.targetLanguage,
      hasFormatting: item.hasFormatting
    }))
    setShowHistory(false)
    toast({
      title: 'Translation loaded',
      description: 'Translation has been loaded from history.'
    })
  }, [])

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      <Tabs defaultValue="translator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="translator">Translator</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="translator">
          <div className="rounded-lg border bg-card text-card-foreground shadow-lg">
            <div className="p-6">
              {/* Language Selectors */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="source-language" className="text-sm font-medium">
                    From
                  </Label>
                  <Select
                    value={state.sourceLanguage}
                    onValueChange={(value) => setState(prev => ({ ...prev, sourceLanguage: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        <div className="flex items-center gap-2">
                          <span>English</span>
                          <span className="text-muted-foreground text-xs">(English)</span>
                        </div>
                      </SelectItem>
                      {APP_CONFIG.languages.supported
                        .filter(lang => lang.available)
                        .map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <div className="flex items-center gap-2">
                            <span>{lang.name}</span>
                            <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSwapLanguages}
                  disabled={state.isLoading}
                  className="mt-6"
                  title="Switch languages"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>

                <div className="flex-1">
                  <Label htmlFor="target-language" className="text-sm font-medium">
                    To
                  </Label>
                  <Select
                    value={state.targetLanguage}
                    onValueChange={(value) => setState(prev => ({ ...prev, targetLanguage: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        <div className="flex items-center gap-2">
                          <span>English</span>
                          <span className="text-muted-foreground text-xs">(English)</span>
                        </div>
                      </SelectItem>
                      {APP_CONFIG.languages.supported
                        .filter(lang => lang.available)
                        .map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <div className="flex items-center gap-2">
                            <span>{lang.name}</span>
                            <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Formatting Options */}
              {state.hasFormatting && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">Formatting Detected</span>
                    <Badge variant="outline" className="text-purple-700">
                      Headers, Bold, Lists
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={state.preserveFormatting}
                        onChange={(e) => setState(prev => ({ ...prev, preserveFormatting: e.target.checked }))}
                        className="rounded"
                      />
                      Preserve formatting in translation
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFormattingPreview(!showFormattingPreview)}
                    >
                      {showFormattingPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showFormattingPreview ? 'Hide' : 'Show'} Preview
                    </Button>
                  </div>
                  {showFormattingPreview && (
                    <div className="mt-3 p-3 bg-white rounded border text-sm">
                      <div className="font-medium mb-2">Formatted Preview:</div>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: convertToBasicHTML(state.sourceText) }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Translation Interface */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Source Text */}
                <div className="space-y-2">
                  <Label htmlFor="source-text">Enter text to translate</Label>
                  <div className="relative">
                    <Textarea
                      id="source-text"
                      placeholder={placeholder}
                      className="min-h-[120px] resize-y"
                      value={state.sourceText}
                      onChange={(e) => setState(prev => ({ ...prev, sourceText: e.target.value }))}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      {state.sourceText && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSpeak(state.sourceText, state.sourceLanguage)}
                          className="h-8 w-8"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span className={cn(isOverMaxLimit && 'text-destructive')}>
                      {characterCount}/{maxLength} characters
                    </span>
                    <CreditEstimate textLength={characterCount} />
                  </div>
                  
                  {/* 免费额度进度条 */}
                  <FreeQuotaProgress currentLength={characterCount} />
                  
                  {/* 积分不足警告 */}
                  {needsCredits && !canAfford && (
                    <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {t('credits.insufficient_balance', { required: estimatedCredits, current: credits })}
                        <Button variant="link" className="p-0 h-auto ml-1" onClick={() => router.push('/pricing')}>
                          {t('credits.recharge_now')}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* 未登录用户提示 - 超过300字符时显示 */}
                  <ConditionalRender when="unauthenticated">
                    {needsCredits && (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <Coins className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                          <div className="font-medium mb-2">
                            超过300字符需要登录账户
                          </div>
                          <div className="text-sm mb-3">
                            免费用户可翻译300字符以内文本，登录后可翻译更长文本
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => router.push(`/${locale}/auth/signin?redirect=` + encodeURIComponent(window.location.pathname))}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              立即登录
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => router.push(`/${locale}/auth/signup?redirect=` + encodeURIComponent(window.location.pathname))}
                              className="border-orange-300 text-orange-700 hover:bg-orange-100"
                            >
                              注册账户
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </ConditionalRender>
                </div>

                {/* Translation Result */}
                <div className="space-y-2">
                  <Label>Translation</Label>
                  <div className="relative">
                    <Textarea
                      className="min-h-[120px] resize-y bg-muted/50"
                      value={state.translatedText}
                      readOnly
                      placeholder="Translation will appear here..."
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      {state.translatedText && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(state.translatedText)}
                            className="h-8 w-8"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSpeak(state.translatedText, state.targetLanguage)}
                            className="h-8 w-8"
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Download buttons */}
                  {state.translatedText && !state.isLoading && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadDOCX}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-4 w-4" />
                        Download DOC
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {state.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{state.error}</p>
                </div>
              )}

              {/* Translate Button */}
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={handleTranslate}
                  disabled={!state.sourceText.trim() || isOverMaxLimit || state.isLoading || (needsCredits && !canAfford)}
                  size="lg"
                  className="min-w-[140px]"
                >
                  {state.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('buttons.translating')}
                    </>
                  ) : needsCredits && !user ? (
                    <>
                      <Coins className="mr-2 h-4 w-4" />
                      登录后翻译
                    </>
                  ) : needsCredits ? (
                    <>
                      <Coins className="mr-2 h-4 w-4" />
                      {t('buttons.translate_with_credits', { credits: estimatedCredits })}
                    </>
                  ) : (
                    t('buttons.free_translate')
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Examples */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">Try these formatting examples:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { text: '# Welcome\n\nThis is a **bold** heading with *italic* text.\n\n- List item 1\n- List item 2', lang: 'en', label: 'Formatted English' },
                { text: '## 欢迎\n\n这是一个**粗体**标题和*斜体*文本。\n\n- 列表项 1\n- 列表项 2', lang: 'zh', label: 'Formatted Chinese' },
                { text: 'Bonjou, kijan ou ye?', lang: 'ht', label: 'Creole greeting' },
              ].map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      sourceText: example.text,
                      sourceLanguage: example.lang,
                    }))
                  }}
                  className="text-xs"
                >
                  {example.label}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="history">
          <TranslationHistory 
            onSelectTranslation={handleSelectFromHistory}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}