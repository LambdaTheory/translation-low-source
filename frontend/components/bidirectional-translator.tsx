'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Copy, Volume2, Loader2, AlertCircle } from 'lucide-react'
import { cn, copyToClipboard, getCharacterCount } from '@/lib/utils'
import { APP_CONFIG } from '../../config/app.config'
import { getTargetLanguageOptions } from '@/lib/language-utils'
import { LanguageSwitch, useLanguageSwitch } from './language-switch'
import { LanguageDetection } from './language-detection'
import { BidirectionalNavigation } from './bidirectional-navigation'
import { Badge } from '@/components/ui/badge'
import { TranslatorWidget } from './translator-widget'

interface BidirectionalTranslatorProps {
  defaultSourceLang?: string
  defaultTargetLang?: string
  placeholder?: string
  showNavigation?: boolean
  showLanguageDetection?: boolean
  enableBidirectionalMode?: boolean
  className?: string
}

export function BidirectionalTranslator({
  defaultSourceLang = 'ht',
  defaultTargetLang = 'en',
  placeholder ={t('translator.type_text_here')},
  showNavigation = true,
  showLanguageDetection = true,
  enableBidirectionalMode = true,
  className
}: BidirectionalTranslatorProps) {
  
  
  const t = useTranslations();
  
  // 使用自定义Hook管理语言切换状态
  const {
    sourceLanguage,
    targetLanguage,
    sourceText,
    targetText,
    switchLanguages,
    resetAll,
    updateSourceText,
    updateTargetText,
    setSourceLanguage,
    setTargetLanguage
  } = useLanguageSwitch(defaultSourceLang, defaultTargetLang)

  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [translationMode, setTranslationMode] = React.useState<'single' | 'bidirectional'>('single')

  // 确保语言状态正确初始化
  React.useEffect(() => {
    console.log('[Language Debug] Component mounted with:', {
      defaultSourceLang,
      defaultTargetLang,
      currentSourceLanguage: sourceLanguage,
      currentTargetLanguage: targetLanguage
    })
    
    // 如果语言状态未正确初始化，手动设置
    if (!sourceLanguage && defaultSourceLang) {
      console.log('[Language Debug] Setting source language to:', defaultSourceLang)
      setSourceLanguage(defaultSourceLang)
    }
    if (!targetLanguage && defaultTargetLang) {
      console.log('[Language Debug] Setting target language to:', defaultTargetLang)
      setTargetLanguage(defaultTargetLang)
    }
  }, [defaultSourceLang, defaultTargetLang, sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage])

  const maxLength = APP_CONFIG.nllb.maxLength
  const characterCount = getCharacterCount(sourceText)
  const isOverLimit = characterCount > maxLength

  // 执行翻译
  const handleTranslate = React.useCallback(async () => {
    if (!sourceText.trim() || isOverLimit) return

    console.log('[Translation Debug] Starting translation with:', {
      sourceLanguage,
      targetLanguage,
      sourceText: sourceText.substring(0, 50) + '...',
      defaultSourceLang,
      defaultTargetLang
    })

    setIsLoading(true)
    setError(null)

    try {
      const requestBody = {
        text: sourceText,
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        mode: enableBidirectionalMode ? translationMode : 'single',
        options: {
          enableCache: true,
          enableFallback: true,
          priority: 'quality' as const
        }
      }

      console.log('[Translation Debug] Request body:', requestBody)

      // 获取认证token
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      try {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase')
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
          console.log('[Translation Debug] Auth token added')
        } else {
          console.warn('No access token available for translation')
        }
      } catch (error) {
        console.error('Failed to get auth token for translation:', error)
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      console.log('[Translation Debug] API response:', JSON.stringify(data, null, 2))
      console.log('[Translation Debug] Response keys:', Object.keys(data || {}))
      console.log('[Translation Debug] Response type:', typeof data)

      if (!response.ok) {
        console.error('[Translation Debug] API error response:', data)
        throw new Error(data.error?.message || data.message || 'Translation failed')
      }

      // 检查不同可能的响应结构
      let translatedText = null
      
      // 情况1: 标准结构 { data: { translatedText: "..." } }
      if (data && data.data && data.data.translatedText) {
        console.log('[Translation Debug] Found standard structure: data.data.translatedText')
        translatedText = data.data.translatedText
      }
      // 情况2: 直接结构 { translatedText: "..." }
      else if (data && data.translatedText) {
        console.log('[Translation Debug] Found direct structure: data.translatedText')
        translatedText = data.translatedText
      }
      // 情况3: 其他可能的字段名
      else if (data && data.translation) {
        console.log('[Translation Debug] Found alternative structure: data.translation')
        translatedText = data.translation
      }
      // 情况4: 嵌套在result中
      else if (data && data.result && data.result.translatedText) {
        console.log('[Translation Debug] Found nested structure: data.result.translatedText')
        translatedText = data.result.translatedText
      }
      else {
        console.error('[Translation Debug] Unknown response structure:', {
          hasData: !!data,
          dataKeys: data ? Object.keys(data) : [],
          dataDataKeys: data?.data ? Object.keys(data.data) : [],
          fullResponse: data
        })
        throw new Error('Invalid response structure from translation service')
      }

      if (translatedText) {
        console.log('[Translation Debug] Successfully extracted translated text:', translatedText.substring(0, 100) + '...')
        updateTargetText(translatedText)
      } else {
        throw new Error('No translated text found in response')
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Translation failed')
    } finally {
      setIsLoading(false)
    }
  }, [sourceText, sourceLanguage, targetLanguage, isOverLimit, translationMode, enableBidirectionalMode, updateTargetText])

  // 处理语言检测结果
  const handleLanguageDetected = React.useCallback((detectedLanguage: string) => {
    setSourceLanguage(detectedLanguage)
  }, [setSourceLanguage])

  // 复制文本
  const handleCopy = React.useCallback(async (text: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      console.log(t('common.copied_to_clipboard'))
    }
  }, [])

  // 语音播放
  const handleSpeak = React.useCallback(async (text: string, language: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language }),
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

  // 获取目标语言选项
  const targetLanguageOptions = getTargetLanguageOptions(sourceLanguage)

  return (
    <div className={cn("w-full max-w-4xl mx-auto space-y-6", className)}>
      <div className="rounded-lg border bg-card text-card-foreground shadow-lg">
        <div className="p-6">
          {/* 语言选择器和切换 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="source-language" className="text-sm font-medium">
                From
              </Label>
              <Select value={sourceLanguage || defaultSourceLang || ''} onValueChange={setSourceLanguage}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("Common.select_language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    <div className="flex items-center gap-2">
                      <span>English</span>
                      <span className="text-muted-foreground text-xs">(English)</span>
                    </div>
                  </SelectItem>
                  {APP_CONFIG.languages.supported
                    .filter((lang) => lang.available)
                    .map((lang) => (
                    <SelectItem key={lang.code} value={lang.code as string}>
                      <div className="flex items-center gap-2">
                        <span>{lang.name}</span>
                        <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 语言切换按钮 */}
            <LanguageSwitch
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              sourceText={sourceText}
              targetText={targetText}
              onSwitch={switchLanguages}
              disabled={isLoading}
              className="mt-6"
              showResetButton
              onReset={resetAll}
            />

            <div className="flex-1">
              <Label htmlFor="target-language" className="text-sm font-medium">
                To
              </Label>
              <Select value={targetLanguage || defaultTargetLang || ''} onValueChange={setTargetLanguage}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("Common.select_language")} />
                </SelectTrigger>
                <SelectContent>
                  {targetLanguageOptions.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code as string}>
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

          {/* 语言检测 */}
          {showLanguageDetection && (
            <div className="mb-4">
              <LanguageDetection
                text={sourceText}
                onLanguageDetected={handleLanguageDetected}
                disabled={isLoading}
              />
            </div>
          )}

          {/* 翻译模式选择 - 已隐藏 */}
          {false && enableBidirectionalMode && (
            <div className="mb-4 flex items-center gap-4" style={{display: 'none'}}>
              <Label className="text-sm font-medium">Translation Mode:</Label>
              <div className="flex gap-2">
                <Button
                  variant={translationMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTranslationMode('single')}
                >
                  Single
                </Button>
                <Button
                  variant={translationMode === 'bidirectional' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTranslationMode('bidirectional')}
                >
                  Bidirectional
                </Button>
              </div>
            </div>
          )}

          {/* 翻译界面 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 源文本输入 */}
            <div className="space-y-2">
              <Label htmlFor="source-text">Enter text to translate</Label>
              <div className="relative">
                <Textarea
                  id="source-text"
                  placeholder={placeholder}
                  className="min-h-[120px] resize-y"
                  value={sourceText}
                  onChange={(e) => updateSourceText(e.target.value)}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {sourceText && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSpeak(sourceText, sourceLanguage)}
                      className="h-8 w-8"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span className={cn(isOverLimit && 'text-destructive')}>
                  {characterCount}/{maxLength} characters
                </span>
              </div>
            </div>

            {/* 翻译结果 */}
            <div className="space-y-2">
              <Label>Translation</Label>
              <div className="relative">
                <Textarea
                  className="min-h-[120px] resize-y bg-muted/50"
                  value={targetText}
                  readOnly
                  placeholder={t("Common.translation_placeholder")}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {targetText && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(targetText)}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSpeak(targetText, targetLanguage)}
                        className="h-8 w-8"
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 错误显示 */}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* 翻译按钮 */}
          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleTranslate}
              disabled={!sourceText.trim() || isOverLimit || isLoading}
              size="lg"
              className="min-w-[140px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                'Translate'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 双向翻译导航 - 放在翻译器下方 */}
      {showNavigation && (
        <BidirectionalNavigation
          currentSourceLang={sourceLanguage}
          currentTargetLang={targetLanguage}
        />
      )}
    </div>
  )
} 