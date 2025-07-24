'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useGlobalCredits } from '@/lib/contexts/credits-context'
import { AuthGuard, ConditionalRender } from '@/components/auth/auth-guard'
import { UserMenu } from '@/components/auth/user-menu'
import { CreditBalance, CreditEstimate, FreeQuotaProgress } from '@/components/credits/credit-balance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'

/**
 * 身份验证和积分系统测试页面
 * 用于验证MVP功能是否正常工作
 */
export default function TestAuthComponent() {
  const { user, signOut, loading } = useAuth()
  const { credits, hasEnoughCredits, estimateCredits } = useGlobalCredits()
  const [testText, setTestText] = useState('')

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">身份验证和积分系统测试</h1>
      
      <div className="grid gap-6">
        {/* 用户状态测试 */}
        <Card>
          <CardHeader>
            <CardTitle>用户状态</CardTitle>
            <CardDescription>测试用户登录状态和信息显示</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">加载中...</p>
              </div>
            )}
            
            <ConditionalRender when="authenticated">
              <div className="space-y-2">
                <p><strong>用户ID:</strong> {user?.id}</p>
                <p><strong>邮箱:</strong> {user?.email}</p>
                <p><strong>姓名:</strong> {user?.name}</p>
                <p><strong>邮箱验证:</strong> {user?.emailVerified ? '已验证' : '未验证'}</p>
                <p><strong>积分余额:</strong> {user?.credits || 0}</p>
                <Button onClick={handleSignOut} variant="outline">
                  退出登录
                </Button>
              </div>
            </ConditionalRender>
            
            <ConditionalRender when="unauthenticated">
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">您尚未登录</p>
                <div className="space-x-2">
                  <Button asChild>
                    <a href="/auth/signin">登录</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/auth/signup">注册</a>
                  </Button>
                </div>
              </div>
            </ConditionalRender>
          </CardContent>
        </Card>

        {/* 用户菜单测试 */}
        <Card>
          <CardHeader>
            <CardTitle>用户菜单组件</CardTitle>
            <CardDescription>测试用户头像下拉菜单</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <UserMenu />
            </div>
          </CardContent>
        </Card>

        {/* 积分系统测试 */}
        <Card>
          <CardHeader>
            <CardTitle>积分系统</CardTitle>
            <CardDescription>测试积分余额显示和计算</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConditionalRender when="authenticated">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">积分余额组件</h4>
                  <CreditBalance />
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">积分计算测试</h4>
                  <Textarea
                    placeholder="输入文本测试积分计算..."
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    className="mb-2"
                  />
                  <div className="space-y-2">
                    <p><strong>字符数:</strong> {testText.length}</p>
                    <CreditEstimate textLength={testText.length} />
                    <p><strong>是否有足够积分:</strong> {hasEnoughCredits(estimateCredits(testText.length)) ? '是' : '否'}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">免费额度进度条</h4>
                  <FreeQuotaProgress currentLength={testText.length} />
                </div>
              </div>
            </ConditionalRender>
            
            <ConditionalRender when="unauthenticated">
              <p className="text-muted-foreground">请先登录以测试积分功能</p>
            </ConditionalRender>
          </CardContent>
        </Card>

        {/* 权限控制测试 */}
        <Card>
          <CardHeader>
            <CardTitle>权限控制</CardTitle>
            <CardDescription>测试AuthGuard组件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">需要登录的内容</h4>
              <AuthGuard requireAuth fallback={<p className="text-muted-foreground">需要登录才能查看此内容</p>}>
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <p className="text-green-800">🎉 您已登录，可以看到这个内容！</p>
                </div>
              </AuthGuard>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">需要积分的内容</h4>
              <AuthGuard 
                requireCredits={100} 
                fallback={<p className="text-muted-foreground">需要100积分才能查看此内容</p>}
              >
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-blue-800">💎 您有足够积分，可以看到这个高级内容！</p>
                </div>
              </AuthGuard>
            </div>
          </CardContent>
        </Card>

        {/* 支付测试 */}
        <Card>
          <CardHeader>
            <CardTitle>支付系统</CardTitle>
            <CardDescription>测试积分购买流程</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button asChild>
                <a href="/pricing">查看定价页面</a>
              </Button>
              
              <ConditionalRender when="authenticated">
                <Button asChild variant="outline">
                  <a href="/credits/purchase">直接购买积分</a>
                </Button>
              </ConditionalRender>
            </div>
          </CardContent>
        </Card>

        {/* 翻译功能测试 */}
        <Card>
          <CardHeader>
            <CardTitle>翻译功能</CardTitle>
            <CardDescription>测试集成积分系统的翻译功能</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/">前往翻译页面</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 