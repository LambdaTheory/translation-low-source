'use client'

import { useGlobalCredits } from '@/lib/contexts/credits-context'
import { ConditionalRender } from '@/components/auth/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Coins, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

interface CreditBalanceProps {
  className?: string
  showPurchaseButton?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * 积分余额显示组件
 * 显示用户当前积分余额，支持快速充值
 */
export function CreditBalance({ 
  className, 
  showPurchaseButton = true,
  size = 'md' 
}: CreditBalanceProps) {
  const { credits, refreshCredits } = useGlobalCredits()
  const router = useRouter()
  const t = useTranslations('TranslatorWidget.credits')
  // 调试：监听积分变化
  useEffect(() => {
    console.log('[CreditBalance] 积分状态更新:', credits);
  }, [credits]);

  const handlePurchaseClick = () => {
    router.push('/pricing')
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <ConditionalRender when="authenticated">
      <div className={cn('flex items-center gap-2', className)}>
        {/* 积分余额显示 */}
        <Badge 
          variant={credits > 0 ? 'default' : 'secondary'}
          className={cn(
            'flex items-center gap-1.5 font-medium',
            sizeClasses[size],
            credits <= 0 && 'text-muted-foreground'
          )}
        >
          <Coins className={iconSizes[size]} />
          <span>{credits.toLocaleString()}</span>
          <span className="text-xs opacity-75">{t('balance')}</span>
        </Badge>

        {/* 快速充值按钮 */}
        {showPurchaseButton && (
          <Button
            size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
            variant="outline"
            onClick={handlePurchaseClick}
            className="flex items-center gap-1"
          >
            <Plus className={iconSizes[size]} />
            <span className="hidden sm:inline">{t('recharge')}</span>
          </Button>
        )}
      </div>
    </ConditionalRender>
  )
}

/**
 * 积分消耗预估组件
 * 显示操作预计消耗的积分数量
 */
interface CreditEstimateProps {
  textLength: number
  className?: string
}

export function CreditEstimate({ textLength, className }: CreditEstimateProps) {
  const { estimateCredits, hasEnoughCredits } = useGlobalCredits()
  const t = useTranslations('TranslatorWidget.credits')
  const estimatedCost = estimateCredits(textLength)
  const canAfford = hasEnoughCredits(estimatedCost)

  if (estimatedCost === 0) {
    return (
      <div className={cn('text-sm text-green-600', className)}>
        <span className="flex items-center gap-1">
          <Coins className="h-3 w-3" />
          {t('free_translation')}
        </span>
      </div>
    )
  }

  return (
    <ConditionalRender when="authenticated">
      <div className={cn(
        'text-sm flex items-center gap-1',
        canAfford ? 'text-blue-600' : 'text-red-600',
        className
      )}>
        <Coins className="h-3 w-3" />
        <span>{t('estimated_cost', { credits: estimatedCost })}</span>
        {!canAfford && (
          <span className="text-red-500 font-medium">{t('insufficient_credits')}</span>
        )}
      </div>
    </ConditionalRender>
  )
}

/**
 * 免费额度进度条组件
 * 显示500字符免费额度的使用情况
 */
interface FreeQuotaProgressProps {
  currentLength?: number
  className?: string
}

export function FreeQuotaProgress({ currentLength, className }: FreeQuotaProgressProps) {
  const t = useTranslations('TranslatorWidget.credits')
  const freeLimit = 5000 // 更新为5000字符免费
  
  // Add null safety for currentLength
  const safeCurrentLength = currentLength ?? 0
  const progress = Math.min((safeCurrentLength / freeLimit) * 100, 100)
  const isOverLimit = safeCurrentLength > freeLimit

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t('free_quota_usage')}</span>
        <span>
          {safeCurrentLength.toLocaleString()} / {freeLimit.toLocaleString()} {t('characters')}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            isOverLimit ? 'bg-red-500' : progress > 80 ? 'bg-yellow-500' : 'bg-green-500'
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      
      {isOverLimit && (
        <p className="text-xs text-red-600">
          {t('over_limit', { excess: (safeCurrentLength - freeLimit).toLocaleString() })}
        </p>
      )}
    </div>
  )
}
