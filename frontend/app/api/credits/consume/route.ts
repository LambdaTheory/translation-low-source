import { NextRequest, NextResponse } from 'next/server'
import { createServerCreditService } from '@/lib/services/credits'
import { withApiAuth, type NextRequestWithUser } from '@/lib/api-utils'

interface ConsumeCreditsRequest {
  amount: number
  reason: string
  metadata?: {
    characterCount?: number
    sourceLanguage?: string
    targetLanguage?: string
    translationLength?: number
    endpoint?: string
    [key: string]: any
  }
}

async function consumeHandler(req: NextRequestWithUser) {
  try {
    const { user } = req.userContext

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: ConsumeCreditsRequest = await req.json()
    const { amount, reason, metadata = {} } = body

    // 验证输入
    if (amount === 0) {
      return NextResponse.json(
        { error: 'Credit amount cannot be zero' },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      )
    }

    const creditService = createServerCreditService()
    
    // 直接从用户表获取积分余额（与前端保持一致）
    const { createSupabaseServerClient } = await import('@/lib/supabase')
    const supabase = createSupabaseServerClient()
    
    console.log(`[Credits Debug] Querying user credits for user ID: ${user.id}`)
    
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', user.id)
      .single()
    
    console.log(`[Credits Debug] Supabase query result:`, {
      userData,
      userError,
      hasData: !!userData,
      hasError: !!userError
    })
    
    // 如果用户记录不存在，创建一个默认记录
    if (userError && userError.code === 'PGRST116') {
      console.log(`[Credits Debug] User record not found, creating default record`)
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          credits: 500, // 默认积分
          created_at: new Date().toISOString()
        })
        .select('credits')
        .single()
      
      if (createError) {
        console.error(`[Credits Debug] Failed to create user record:`, createError)
        return NextResponse.json(
          { 
            error: 'Failed to create user record',
            details: createError.message
          },
          { status: 500 }
        )
      }
      
      userData = newUser
      userError = null
    }
    
    if (userError) {
      console.error(`[Credits Debug] Failed to get user credits:`, userError)
      return NextResponse.json(
        { 
          error: 'Failed to get user credits',
          details: userError.message,
          code: userError.code
        },
        { status: 500 }
      )
    }
    
    const currentCredits = userData?.credits || 0
    
    console.log(`[Credits Debug] User ${user.id} credit operation:`, {
      userId: user.id,
      userEmail: user.email,
      requestedAmount: amount,
      currentCredits,
      isRefund: amount < 0,
      sufficient: amount < 0 || currentCredits >= amount,
      reason,
      timestamp: new Date().toISOString()
    })
    
    // 如果是扣除积分（正数），检查余额是否足够
    if (amount > 0 && currentCredits < amount) {
      console.log(`[Credits Debug] Insufficient credits for user ${user.id}: ${currentCredits} < ${amount}`)
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          required: amount,
          available: currentCredits,
          userId: user.id
        },
        { status: 402 }
      )
    }

    // 计算新余额（扣除用正数，退还用负数）
    const newBalance = currentCredits - amount
    
    // 确保退还后的余额不会变成负数（虽然这种情况很少见）
    if (newBalance < 0 && amount < 0) {
      console.warn(`[Credits Debug] Refund would result in negative balance, adjusting`, {
        currentCredits,
        refundAmount: Math.abs(amount),
        newBalance
      })
      // 不允许余额变成负数，将余额设为当前值（不进行退还）
      return NextResponse.json(
        { 
          error: 'Invalid refund amount',
          details: 'Refund amount exceeds deducted amount',
          available: currentCredits
        },
        { status: 400 }
      )
    }
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', user.id)
    
    if (updateError) {
      console.error(`[Credits Debug] Failed to update user credits:`, updateError)
      return NextResponse.json(
        { 
          error: 'Failed to update credits',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // 记录交易
    const transactionType = amount > 0 ? 'consume' : 'refund'
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        type: transactionType,
        amount: -amount, // 数据库中存储：消费为负数，退还为正数
        balance: newBalance,
        description: reason,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          user_agent: req.headers.get('user-agent') || 'unknown',
          operation_type: amount > 0 ? 'deduction' : 'refund'
        }
      })
    
    if (transactionError) {
      console.warn(`[Credits Debug] Failed to record transaction:`, transactionError)
      // 不影响主流程，只是记录警告
    }

    const operationType = amount > 0 ? 'consumed' : 'refunded'
    console.log(`[Credits] User ${user.id} ${operationType} ${Math.abs(amount)} credits for ${reason}. Balance: ${currentCredits} -> ${newBalance}`)

    return NextResponse.json({
      success: true,
      amount: Math.abs(amount),
      operation: operationType,
      reason,
      previous_balance: currentCredits,
      new_balance: newBalance,
      metadata
    })

  } catch (error) {
    console.error('Credit consumption error:', error)
    return NextResponse.json(
      { error: 'Failed to consume credits' },
      { status: 500 }
    )
  }
}

export const POST = withApiAuth(consumeHandler, ['free_user', 'pro_user', 'admin'])

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
