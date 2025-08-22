'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToastMessages } from '@/lib/hooks/use-toast-messages';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/components/auth/auth-provider';
import { authService } from '@/lib/services/auth';

interface CheckoutButtonProps {
  planId: string;
  planName: string;
  price: number;
  credits: number;
  disabled?: boolean;
  className?: string;
}

export function CheckoutButton({ 
  planId, 
  planName, 
  price, 
  credits, 
  disabled = false,
  className = '' 
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations('Checkout');
  const { showGenericError } = useToastMessages();
  const { user } = useAuth();

  const handleCheckout = async () => {
    // 检查用户是否已登录
    if (!user) {
      setError('Please log in to purchase credits');
      showGenericError('Please log in to purchase credits');
      router.push('/auth/login');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🚀 Starting checkout for plan: ${planId}`);
      console.log(`👤 User: ${user.email}`);
      
      // 获取访问token
      const session = await authService.getSession();
      if (!session?.access_token) {
        throw new Error('Unable to get access token. Please log in again.');
      }

      console.log(t('debug.access_token_obtained'));
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();
      console.log(t('debug.checkout_api_response'), data);

      if (!response.ok) {
        console.error(`❌ Checkout API error: ${response.status}`, data);
        
        // 处理特定的错误类型
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your account permissions.');
        } else {
          throw new Error(data.error || data.details || `HTTP ${response.status}: ${response.statusText}`);
        }
      }

      if (!data.url) {
        console.error('❌ No checkout URL in response:', data);
        throw new Error('No checkout URL returned from server');
      }

      console.log(`✅ Checkout successful, redirecting to: ${data.url}`);
      console.log(`📊 Checkout method: ${data.method || 'unknown'}`);
      
      // 🔧 关键修复：支付前记录当前积分，用于后续验证
      const currentCredits = user.credits || 0;
      console.log(`💰 支付前积分: ${currentCredits}`);
      
      // 保存支付信息到localStorage，用于支付成功后的处理
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingPayment', JSON.stringify({
          planId,
          credits,
          amount: price,
          timestamp: Date.now(),
          currentCredits
        }));
      }
      
      // 重定向到支付页面
      window.location.href = data.url;
      
    } catch (err: any) {
      console.error('❌ Checkout error:', err);
      const errorMessage = err.message || 'Failed to start checkout process';
      setError(errorMessage);
      showGenericError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 如果用户未登录，显示登录提示
  if (!user) {
    return (
      <div className="space-y-3">
        <Button
          onClick={() => router.push('/auth/login')}
          className={`w-full ${className}`}
          size="lg"
          variant="outline"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          {t('loginToBuy', { defaultValue: 'Log in to Buy' })}
        </Button>
        
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          {t('loginRequired', { defaultValue: 'Login required to purchase credits' })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handleCheckout}
        disabled={disabled || isLoading}
        className={`w-full ${className}`}
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('processing', { defaultValue: 'Processing...' })}
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            {t('buyNow', { 
              defaultValue: 'Buy Now - ${price}',
              price: price.toFixed(2)
            })}
          </>
        )}
      </Button>
      
      <div className="text-xs text-center text-gray-500 dark:text-gray-400">
        {t('securePayment', { defaultValue: 'Secure payment powered by Creem' })}
      </div>
    </div>
  );
}
