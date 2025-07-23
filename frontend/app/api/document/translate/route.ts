import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, type NextRequestWithUser } from '@/lib/api-utils'
import { createServerCreditService } from '@/lib/services/credits'

// 动态导入 Supabase 客户端
const createSupabaseAdminClient = () => {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}


// 增强的文档翻译配置
const ENHANCED_DOC_CONFIG = {
  MAX_CHUNK_SIZE: 300,        // 统一使用300字符分块
  MAX_RETRIES: 5,             // 每个块最多重试5次（增加重试次数）
  RETRY_DELAY: 2000,          // 重试延迟2秒（增加延迟）
  CHUNK_DELAY: 1000,          // 块间延迟1秒（增加延迟避免限流）
  REQUEST_TIMEOUT: 45000,     // 请求超时45秒（增加超时时间）
  CONCURRENT_CHUNKS: 1        // 顺序处理，避免限流
};

// 清理过期的缓存项
function cleanupExpiredCache() {
  const documentCache = (global as any).documentCache || new Map()
  const now = new Date()
  
  for (const [key, value] of documentCache.entries()) {
    if (value.expiresAt && now > new Date(value.expiresAt)) {
      documentCache.delete(key)
      console.log(`[Cache Cleanup] 删除过期文档: ${key}`)
    }
  }
}

interface TranslationOptions {
  priority?: 'normal' | 'high'
  preserveFormatting?: boolean
}

interface TranslationRequest {
  fileId: string
  sourceLanguage: string
  targetLanguage: string
  options?: {
    priority?: 'normal' | 'high'
    preserveFormatting?: boolean
  }
}

async function translateHandler(req: NextRequestWithUser) {
  try {
    const { user, role } = req.userContext

    if (!user) {
      return NextResponse.json({
        error: '需要登录账户',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    const body: TranslationRequest = await req.json()
    const { fileId, sourceLanguage, targetLanguage, options = {} } = body

    if (!fileId || !sourceLanguage || !targetLanguage) {
      return NextResponse.json({
        error: '缺少必要参数',
        code: 'MISSING_PARAMETERS'
      }, { status: 400 })
    }

    // 获取文档数据 - 从内存缓存中获取
    console.log('[Translation Debug] 开始获取文档:', {
      fileId,
      sourceLanguage,
      targetLanguage,
      timestamp: new Date().toISOString()
    })
    
    // 从内存缓存中获取文档数据
    const documentCache = (global as any).documentCache || new Map()
    const documentData = documentCache.get(fileId)
    
    console.log('[Translation Debug] 缓存查询结果:', {
      hasDocument: !!documentData,
      cacheSize: documentCache.size,
      fileId: fileId
    })
    
    if (!documentData) {
      console.log('[Translation Debug] 文档未在缓存中找到:', {
        fileId: fileId,
        availableKeys: Array.from(documentCache.keys()).slice(0, 5)
      })
      return NextResponse.json({
        error: '文档不存在或已过期',
        code: 'DOCUMENT_NOT_FOUND',
        details: '文档可能已过期，请重新上传文件'
      }, { status: 404 })
    }
    
    // 检查文档是否过期
    if (documentData.expiresAt && new Date() > new Date(documentData.expiresAt)) {
      console.log('[Translation Debug] 文档已过期:', {
        fileId: fileId,
        expiresAt: documentData.expiresAt,
        currentTime: new Date().toISOString()
      })
      documentCache.delete(fileId)
      return NextResponse.json({
        error: '文档已过期，请重新上传文件',
        code: 'DOCUMENT_EXPIRED'
      }, { status: 404 })
    }
    
    // 验证文档所有权
    if (documentData.userId !== user.id) {
      console.log('[Translation Debug] 文档所有权验证失败:', {
        documentUserId: documentData.userId,
        currentUserId: user.id
      })
      return NextResponse.json({
        error: '无权访问此文档',
        code: 'ACCESS_DENIED'
      }, { status: 403 })
    }

    console.log('[Translation Debug] 文档数据获取成功:', {
      hasText: !!documentData.text,
      characterCount: documentData.characterCount,
      fileName: documentData.metadata?.originalFileName
    })

    const { text, characterCount, metadata } = documentData

    // 计算所需积分
    const creditService = createServerCreditService()
    const calculation = creditService.calculateCreditsRequired(characterCount)

    // 获取用户积分
    let userCredits = 0
    try {
      const supabase = createSupabaseAdminClient()
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (userError) {
        if (userError.code === 'PGRST116') {
          // 用户记录不存在，创建新记录
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ 
              id: user.id, 
              email: user.email,
              credits: 3000 
            }])
            .select('credits')
            .single()
          
          if (!createError && newUser) {
            userCredits = newUser.credits
          }
        } else {
          console.error('[Translation] 查询用户积分失败:', userError)
        }
      } else if (userData) {
        userCredits = userData.credits
      }
    } catch (error) {
      console.error('[Translation] 积分查询异常:', error)
    }

    // 检查积分是否足够并进行预扣除
    if (calculation.credits_required > 0) {
      if (userCredits < calculation.credits_required) {
        return NextResponse.json({
          error: `积分不足，需要 ${calculation.credits_required} 积分，当前余额 ${userCredits} 积分`,
          code: 'INSUFFICIENT_CREDITS',
          required: calculation.credits_required,
          available: userCredits
        }, { status: 402 })
      }

      // 预扣除积分
      try {
        const creditResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/credits/consume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('authorization') || '',
          },
          body: JSON.stringify({
            amount: calculation.credits_required,
            reason: `文档翻译：${characterCount}字符，${sourceLanguage}->${targetLanguage}`,
            metadata: {
              characterCount: characterCount,
              sourceLanguage: sourceLanguage,
              targetLanguage: targetLanguage,
              translationType: 'document',
              fileId: fileId,
              endpoint: '/api/document/translate'
            }
          })
        });

        const creditResult = await creditResponse.json();

        if (!creditResponse.ok) {
          console.error('文档翻译积分预扣失败:', creditResult);
          return NextResponse.json({
            error: '积分扣除失败，请稍后重试',
            code: 'CREDIT_DEDUCTION_FAILED'
          }, { status: 500 });
        }

        console.log(`✅ 文档翻译积分预扣成功: ${calculation.credits_required}积分，剩余: ${creditResult.new_balance}积分`);
      } catch (creditError) {
        console.error('文档翻译积分预扣异常:', creditError);
        return NextResponse.json({
          error: '积分服务不可用，请稍后重试',
          code: 'CREDIT_SERVICE_ERROR'
        }, { status: 503 });
      }
    }

    // 执行翻译
    let translationResult
    try {
      translationResult = await performTranslation(text, sourceLanguage, targetLanguage, fileId)
      
      if (!translationResult.success) {
        // 翻译失败，退还积分
        if (calculation.credits_required > 0) {
          try {
            console.log(`🔄 文档翻译失败，尝试退还积分: ${calculation.credits_required}`);
            const refundResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/credits/consume`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('authorization') || '',
              },
              body: JSON.stringify({
                amount: -calculation.credits_required, // 负数表示退还
                reason: `文档翻译失败退款：${characterCount}字符，${sourceLanguage}->${targetLanguage}`,
                metadata: {
                  characterCount: characterCount,
                  sourceLanguage: sourceLanguage,
                  targetLanguage: targetLanguage,
                  translationType: 'document',
                  fileId: fileId,
                  endpoint: '/api/document/translate',
                  isRefund: true,
                  originalError: 'error' in translationResult ? translationResult.error : '翻译失败'
                }
              })
            });
            
            if (refundResponse.ok) {
              console.log(`✅ 文档翻译积分退还成功: ${calculation.credits_required}积分`);
            } else {
              console.error('文档翻译积分退还失败:', await refundResponse.text());
            }
          } catch (refundError) {
            console.error('文档翻译积分退还异常:', refundError);
          }
        }
        
        return NextResponse.json({
          error: 'error' in translationResult ? translationResult.error : '翻译失败',
          code: 'TRANSLATION_FAILED',
          creditsRefunded: calculation.credits_required
        }, { status: 500 })
      }
    } catch (error) {
      console.error('[Translation] 执行翻译异常:', error)
      
      // 翻译异常，退还积分
      if (calculation.credits_required > 0) {
        try {
          console.log(`🔄 文档翻译异常，尝试退还积分: ${calculation.credits_required}`);
          const refundResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/credits/consume`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('authorization') || '',
            },
            body: JSON.stringify({
              amount: -calculation.credits_required, // 负数表示退还
              reason: `文档翻译异常退款：${characterCount}字符，${sourceLanguage}->${targetLanguage}`,
              metadata: {
                characterCount: characterCount,
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                translationType: 'document',
                fileId: fileId,
                endpoint: '/api/document/translate',
                isRefund: true,
                originalError: error instanceof Error ? error.message : '翻译异常'
              }
            })
          });
          
          if (refundResponse.ok) {
            console.log(`✅ 文档翻译积分退还成功: ${calculation.credits_required}积分`);
          } else {
            console.error('文档翻译积分退还失败:', await refundResponse.text());
          }
        } catch (refundError) {
          console.error('文档翻译积分退还异常:', refundError);
        }
      }
      
      return NextResponse.json({
        error: '翻译处理异常',
        code: 'TRANSLATION_EXCEPTION',
        creditsRefunded: calculation.credits_required
      }, { status: 500 })
    }

    // 检查是否是异步任务
    if ('jobId' in translationResult && translationResult.jobId) {
      // 异步任务 - 返回任务信息，积分已预扣除
      return NextResponse.json({
        success: true,
        message: 'message' in translationResult ? translationResult.message : '异步任务已创建',
        jobId: translationResult.jobId,
        totalChunks: 'totalChunks' in translationResult ? translationResult.totalChunks : 0,
        estimatedTime: 'estimatedTime' in translationResult ? translationResult.estimatedTime : 0,
        creditsDeducted: calculation.credits_required,
        isAsync: true
      })
    }

    // 同步任务 - 返回结果，积分已预扣除
    const translatedText = 'translatedText' in translationResult ? translationResult.translatedText : ''
    return NextResponse.json({
      success: true,
      translatedText: translatedText,
      originalLength: characterCount,
      translatedLength: translatedText.length,
      creditsUsed: calculation.credits_required,
      isAsync: false
    })

  } catch (error) {
    console.error('[Translation] 处理错误:', error)
    return NextResponse.json({
      error: '翻译处理失败',
      code: 'PROCESSING_ERROR'
    }, { status: 500 })
  }
}

// 执行翻译的主函数 - 改为异步队列模式
async function performTranslation(text: string, sourceLanguage: string, targetLanguage: string, fileId: string) {
  try {
    console.log(`[Translation] 开始翻译: ${text.length}字符`)
    
    // 智能分块
    const chunks = smartDocumentChunking(text, ENHANCED_DOC_CONFIG.MAX_CHUNK_SIZE)
    console.log(`[Translation] 分块完成: ${chunks.length}个块`)
    
    // 如果块数较少，使用同步处理（避免小文档的复杂性）
    if (chunks.length <= 5) {
      console.log(`[Translation] 小文档同步处理: ${chunks.length}个块`)
      return await performSyncTranslation(chunks, sourceLanguage, targetLanguage)
    }
    
    // 大文档使用异步队列处理
    console.log(`[Translation] 大文档异步处理: ${chunks.length}个块`)
    return await performAsyncTranslation(chunks, sourceLanguage, targetLanguage, fileId)
    
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '翻译失败'
    }
  }
}

// 小文档同步处理
async function performSyncTranslation(chunks: string[], sourceLanguage: string, targetLanguage: string) {
  const translatedChunks: string[] = []
  
  // 顺序处理每个块
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    
    // 添加块间延迟，避免请求过于频繁
    if (i > 0) {
      console.log(`⏳ 块间延迟 ${ENHANCED_DOC_CONFIG.CHUNK_DELAY}ms...`)
      await new Promise(resolve => setTimeout(resolve, ENHANCED_DOC_CONFIG.CHUNK_DELAY))
    }
    
    const chunkResult = await translateChunkWithRetry(chunk, sourceLanguage, targetLanguage)
    if (!chunkResult.success) {
      throw new Error(chunkResult.error || '翻译失败')
    }
    
    translatedChunks.push(chunkResult.translatedText!)
  }
  
  const finalTranslation = translatedChunks.join(' ')
  console.log(`[Translation] 同步翻译完成: ${finalTranslation.length}字符`)
  
  return {
    success: true,
    translatedText: finalTranslation
  }
}

// 大文档异步处理
async function performAsyncTranslation(chunks: string[], sourceLanguage: string, targetLanguage: string, fileId: string) {
  // 创建翻译任务ID
  const jobId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 创建任务对象
  const job = {
    id: jobId,
    type: 'document',
    fileId: fileId,
    text: chunks.join(' '),
    chunks: chunks,
    sourceLanguage,
    targetLanguage,
    status: 'pending' as const,
    progress: 0,
    result: null as string | null,
    error: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  // 获取或创建翻译队列
  if (!(global as any).translationQueue) {
    (global as any).translationQueue = new Map()
  }
  const translationQueue = (global as any).translationQueue
  
  // 保存任务到队列
  translationQueue.set(jobId, job)
  console.log(`[Translation] 创建异步翻译任务: ${jobId}, 块数: ${chunks.length}`)
  
  // 异步开始处理
  setTimeout(() => {
    processDocumentTranslationJob(jobId).catch(error => {
      console.error(`[Translation] 文档翻译任务失败: ${jobId}`, error)
      const job = translationQueue.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = error.message
        job.updatedAt = new Date()
        translationQueue.set(jobId, job)
      }
    })
  }, 100)
  
  return {
    success: true,
    jobId: jobId,
    message: '大文档翻译任务已创建，正在后台处理',
    totalChunks: chunks.length,
    estimatedTime: Math.ceil(chunks.length * 2) // 预估时间（秒）
  }
}

/**
 * 智能文档分块
 */
/**
 * 统一的智能文本分块函数
 * 优先级: 段落边界 > 句子边界 > 逗号边界 > 词汇边界
 */
function smartDocumentChunking(text, maxChunkSize = 300) {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  console.log(`📝 智能分块: ${text.length}字符 -> ${maxChunkSize}字符/块`);
  
  const chunks = [];
  
  // 策略1: 按段落分割（双换行）
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph.trim());
    } else {
      // 策略2: 按句子分割
      const sentences = paragraph.split(/[.!?。！？]\s+/);
      let currentChunk = '';
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;
        
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
        
        if (potentialChunk.length <= maxChunkSize) {
          currentChunk = potentialChunk;
        } else {
          // 保存当前块
          if (currentChunk) {
            chunks.push(currentChunk + (currentChunk.endsWith('.') ? '' : '.'));
          }
          
          // 处理超长句子
          if (sentence.length > maxChunkSize) {
            const subChunks = forceChunkBySentence(sentence, maxChunkSize);
            chunks.push(...subChunks);
            currentChunk = '';
          } else {
            currentChunk = sentence;
          }
        }
      }
      
      // 添加最后一个块
      if (currentChunk) {
        chunks.push(currentChunk + (currentChunk.endsWith('.') ? '' : '.'));
      }
    }
  }
  
  const finalChunks = chunks.filter(chunk => chunk.trim().length > 0);
  console.log(`✅ 分块完成: ${finalChunks.length}个块`);
  
  return finalChunks;
}



/**
 * 强制分块处理超长句子
 */
function forceChunkBySentence(sentence: string, maxSize: number): string[] {
  const chunks: string[] = []
  
  // 策略3: 按逗号分割
  const parts = sentence.split(/,\s+/)
  let currentChunk = ''
  
  for (const part of parts) {
    const potentialChunk = currentChunk + (currentChunk ? ', ' : '') + part
    
    if (potentialChunk.length <= maxSize) {
      currentChunk = potentialChunk
    } else {
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      
      // 策略4: 按空格分割（词汇边界）
      if (part.length > maxSize) {
        const words = part.split(' ')
        let wordChunk = ''
        
        for (const word of words) {
          const potentialWordChunk = wordChunk + (wordChunk ? ' ' : '') + word
          
          if (potentialWordChunk.length <= maxSize) {
            wordChunk = potentialWordChunk
          } else {
            if (wordChunk) {
              chunks.push(wordChunk)
            }
            wordChunk = word.length > maxSize ? word.substring(0, maxSize) : word
          }
        }
        
        if (wordChunk) {
          chunks.push(wordChunk)
        }
        currentChunk = ''
      } else {
        currentChunk = part
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

/**
 * 处理文档翻译任务（异步）
 */
async function processDocumentTranslationJob(jobId: string) {
  const translationQueue = (global as any).translationQueue
  const job = translationQueue.get(jobId)
  
  if (!job) {
    console.log(`[Translation] 任务不存在: ${jobId}`)
    return
  }
  
  console.log(`[Translation] 开始处理文档翻译任务: ${jobId}`)
  
  try {
    // 设置处理状态
    job.status = 'processing'
    job.progress = 5
    job.updatedAt = new Date()
    translationQueue.set(jobId, job)
    
    const translatedChunks: string[] = []
    const totalChunks = job.chunks.length
    const BATCH_SIZE = 5 // 批次大小
    
    // 分批处理块
    for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
      const batch = job.chunks.slice(i, i + BATCH_SIZE)
      console.log(`[Translation] 处理批次 ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(totalChunks/BATCH_SIZE)}, 块数: ${batch.length}`)
      
      // 更新批次开始进度
      const startProgress = Math.round((i / totalChunks) * 90) + 10
      job.progress = startProgress
      job.updatedAt = new Date()
      translationQueue.set(jobId, job)
      
      // 并行处理当前批次
      const batchPromises = batch.map((chunk, index) => {
        console.log(`[Translation] 翻译块 ${i + index + 1}/${totalChunks}: ${chunk.substring(0, 50)}...`)
        return translateChunkWithRetry(chunk, job.sourceLanguage, job.targetLanguage)
      })
      
      const batchResults = await Promise.all(batchPromises)
      console.log(`[Translation] 批次结果:`, batchResults.map(r => ({ success: r.success, length: r.translatedText?.length || 0 })))
      
      // 检查批次结果
      for (const result of batchResults) {
        if (!result.success) {
          throw new Error(result.error || '翻译失败')
        }
        translatedChunks.push(result.translatedText!)
      }
      
      // 更新进度
      job.progress = Math.round(((i + batch.length) / totalChunks) * 100)
      job.updatedAt = new Date()
      translationQueue.set(jobId, job)
      
      console.log(`[Translation] 进度更新: ${job.progress}% (${i + batch.length}/${totalChunks})`)
      
      // 批次间延迟
      if (i + BATCH_SIZE < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // 合并结果
    job.result = translatedChunks.join(' ')
    job.status = 'completed'
    job.progress = 100
    job.updatedAt = new Date()
    translationQueue.set(jobId, job)
    
    console.log(`[Translation] 文档翻译任务完成: ${jobId}`, {
      totalChunks: translatedChunks.length,
      resultLength: job.result.length,
      resultPreview: job.result.substring(0, 100) + '...'
    })
    
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : '翻译失败'
    job.updatedAt = new Date()
    translationQueue.set(jobId, job)
    
    console.error(`[Translation] 文档翻译任务失败: ${jobId}`, error)
  }
}

/**
 * 带重试机制的文档块翻译函数
 */
async function translateChunkWithRetry(text: string, sourceLanguage: string, targetLanguage: string, retryCount: number = 0): Promise<{success: boolean, translatedText?: string, error?: string}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ENHANCED_DOC_CONFIG.REQUEST_TIMEOUT)
  
  try {
    console.log(`🔄 文档块翻译 (尝试 ${retryCount + 1}/${ENHANCED_DOC_CONFIG.MAX_RETRIES + 1}): ${text.length}字符`)
    
    const nllbServiceUrl = process.env.NLLB_SERVICE_URL || 'https://wane0528-my-nllb-api.hf.space/api/v4/translator'
    
    // 处理自动检测语言
    let actualSourceLanguage = sourceLanguage
    if (sourceLanguage === 'auto') {
      const hasChinese = /[\u4e00-\u9fff]/.test(text)
      const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text)
      const hasKorean = /[\uac00-\ud7af]/.test(text)
      
      if (hasChinese) {
        actualSourceLanguage = 'zh'
      } else if (hasJapanese) {
        actualSourceLanguage = 'ja'
      } else if (hasKorean) {
        actualSourceLanguage = 'ko'
      } else {
        actualSourceLanguage = 'en'
      }
      
      console.log(`[Language Detection] Auto detected: ${actualSourceLanguage} for text: ${text.substring(0, 50)}...`)
    }
    
    // 映射到NLLB语言代码
    const nllbSourceLang = mapToNLLBLanguageCode(actualSourceLanguage)
    const nllbTargetLang = mapToNLLBLanguageCode(targetLanguage)
    
    console.log(`[Language Mapping] ${actualSourceLanguage} -> ${nllbSourceLang}, ${targetLanguage} -> ${nllbTargetLang}`)
    
    const response = await fetch(nllbServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text,
        source: nllbSourceLang,
        target: nllbTargetLang,
        max_length: 1000
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`翻译服务错误: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    if (result.error) {
      throw new Error(result.error)
    }

    const translatedText = result.result || result.translated_text || result.translation || text
    console.log(`✅ 文档块翻译成功: ${translatedText.length}字符`)
    
    return {
      success: true,
      translatedText: translatedText
    }

  } catch (error: any) {
    clearTimeout(timeoutId)
    console.log(`❌ 文档块翻译失败 (尝试 ${retryCount + 1}): ${error.message}`)
    
    // 检查是否需要重试
    if (retryCount < ENHANCED_DOC_CONFIG.MAX_RETRIES) {
      console.log(`⏳ ${ENHANCED_DOC_CONFIG.RETRY_DELAY}ms后重试...`)
      await new Promise(resolve => setTimeout(resolve, ENHANCED_DOC_CONFIG.RETRY_DELAY))
      return translateChunkWithRetry(text, sourceLanguage, targetLanguage, retryCount + 1)
    } else {
      console.log(`💥 重试次数已用完，返回错误`)
      return {
        success: false,
        error: error.message || '翻译失败'
      }
    }
  }
}

// NLLB语言代码映射函数
function mapToNLLBLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    'am': 'amh_Ethi', 'ar': 'arb_Arab', 'en': 'eng_Latn', 'es': 'spa_Latn',
    'fr': 'fra_Latn', 'ha': 'hau_Latn', 'hi': 'hin_Deva', 'ht': 'hat_Latn',
    'ig': 'ibo_Latn', 'km': 'khm_Khmr', 'ky': 'kir_Cyrl', 'lo': 'lao_Laoo',
    'mg': 'plt_Latn', 'mn': 'khk_Cyrl', 'my': 'mya_Mymr', 'ne': 'npi_Deva',
    'ps': 'pbt_Arab', 'pt': 'por_Latn', 'sd': 'snd_Arab', 'si': 'sin_Sinh',
    'sw': 'swh_Latn', 'te': 'tel_Telu', 'tg': 'tgk_Cyrl', 'xh': 'xho_Latn',
    'yo': 'yor_Latn', 'zh': 'zho_Hans', 'zu': 'zul_Latn'
  }
  
  return languageMap[language] || language
}

export const POST = withApiAuth(translateHandler)
