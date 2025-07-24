import { createSupabaseBrowserClient, createSupabaseServerClient } from '../supabase'
import type { Database } from '../supabase'
import { userService } from './user'
import { creditService } from './credits'

export type User = Database['public']['Tables']['users']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']

export interface AuthUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  credits: number
  role: 'admin' | 'pro_user' | 'free_user' | 'guest'
  profile?: UserProfile
}

export interface SignUpData {
  email: string
  password: string
  name?: string
}

export interface SignInData {
  email: string
  password: string
  rememberMe?: boolean
}

export interface AuthError {
  message: string
  code?: string
}

export interface AuthResponse<T = any> {
  data: T | null
  error: AuthError | null
}

class AuthService {
  private supabase: ReturnType<typeof createSupabaseBrowserClient> | null
  private isConfigured: boolean

  constructor() {
    // 只在浏览器环境中初始化 Supabase 客户端
    this.supabase = typeof window !== 'undefined' ? createSupabaseBrowserClient() : null
    this.isConfigured = this.checkSupabaseConfig()
  }

  private checkSupabaseConfig(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!url || !key) {
      console.warn('[AuthService] Missing Supabase environment variables. Please check your .env.local file.')
      return false
    }
    
    if (url.includes('placeholder') || url.includes('your_supabase') || 
        key === 'placeholder-anon-key' || key.includes('your_supabase')) {
      console.warn('[AuthService] Supabase environment variables contain placeholder values. Please update your .env.local file with actual Supabase credentials.')
      return false
    }
    
    return true
  }

  private isReady(): boolean {
    return !!(this.supabase && this.isConfigured)
  }

  /**
   * 用户注册
   */
  async signUp({ email, password, name }: SignUpData): Promise<AuthResponse<AuthUser>> {
    if (!this.isReady()) {
      return {
        data: null,
        error: {
          message: '身份验证服务暂未配置。请检查 .env.local 文件中的 Supabase 配置项是否正确填写。',
        },
      }
    }

    try {
      // 1. 使用 Supabase Auth 注册用户
      const { data: authData, error: authError } = await this.supabase!.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || null,
          },
        },
      })

      if (authError) {
        return {
          data: null,
          error: {
            message: this.getErrorMessage(authError.message),
            code: authError.message,
          },
        }
      }

      if (!authData.user) {
        return {
          data: null,
          error: {
            message: '注册失败，请重试',
          },
        }
      }

      // 2. 检查数据库表是否存在
      try {
        await this.createUserRecord(authData.user.id, email, name)
      } catch (dbError: any) {
        if (dbError?.code === '42P01') {
          // 数据库表不存在的特殊处理
          console.warn('Database tables not set up, but user auth created successfully')
          return {
            data: {
              id: authData.user.id,
              email: authData.user.email || email,
              name: name || 'User',
              emailVerified: false,
              credits: 500,
              role: 'free_user',
            },
            error: null,
          }
        }
        throw dbError
      }

      // 3. 获取完整用户信息
      console.log('Attempting to fetch user data for userId:', authData.user.id)
      const userData = await this.getUserData(authData.user.id)
      
      if (!userData) {
        console.warn('Failed to fetch user data, but auth was successful')
        // 返回基本用户信息作为后备
        const fallbackUser = {
          id: authData.user.id,
          email: authData.user.email || email,
          name: name || 'User',
          emailVerified: authData.user.email_confirmed || false,
          credits: 500,
          role: 'free_user' as const,
        }
        console.log('🔄 使用后备用户数据:', fallbackUser)
        return {
          data: fallbackUser,
          error: null,
        }
      }

      console.log('🎉 注册成功！用户数据:', { id: userData.id, email: userData.email, credits: userData.credits })
      return {
        data: userData,
        error: null,
      }
    } catch (error) {
      console.error('Sign up error:', error)
      return {
        data: null,
        error: {
          message: '注册过程中发生错误，请重试',
        },
      }
    }
  }

  /**
   * 用户登录
   */
  async signIn({ email, password, rememberMe }: SignInData): Promise<AuthResponse<AuthUser>> {
    if (!this.isReady()) {
      return {
        data: null,
        error: {
          message: '身份验证服务暂未配置。请检查 .env.local 文件中的 Supabase 配置项是否正确填写。',
        },
      }
    }

    try {
      const { data: authData, error: authError } = await this.supabase!.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        return {
          data: null,
          error: {
            message: this.getErrorMessage(authError.message),
            code: authError.message,
          },
        }
      }

      if (!authData.user) {
        return {
          data: null,
          error: {
            message: '登录失败，请检查邮箱和密码',
          },
        }
      }

      // 获取完整用户信息
      const userData = await this.getUserData(authData.user.id)

      // 处理"记住我"功能（通过Session持久化）
      if (rememberMe) {
        await this.supabase!.auth.updateUser({
          data: { remember_me: true },
        })
      }

      return {
        data: userData,
        error: null,
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return {
        data: null,
        error: {
          message: '登录过程中发生错误，请重试',
        },
      }
    }
  }

  /**
   * 用户登出
   */
  async signOut(): Promise<AuthResponse<void>> {
    if (!this.isReady()) {
      return {
        data: null,
        error: {
          message: '身份验证服务暂未配置。请检查 .env.local 文件中的 Supabase 配置项是否正确填写。',
        },
      }
    }

    try {
      const { error } = await this.supabase!.auth.signOut()

      if (error) {
        return {
          data: null,
          error: {
            message: '登出失败，请重试',
            code: error.message,
          },
        }
      }

      return {
        data: null,
        error: null,
      }
    } catch (error) {
      console.error('Sign out error:', error)
      return {
        data: null,
        error: {
          message: '登出过程中发生错误',
        },
      }
    }
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    if (!this.isReady()) {
      return null
    }

    try {
      const { data: { user } } = await this.supabase!.auth.getUser()
      
      if (!user) {
        return null
      }

      return await this.getUserData(user.id, user.email)
    } catch (error) {
      console.error('Get current user error:', error)
      return null
    }
  }

  /**
   * 获取当前会话
   */
  async getSession() {
    if (!this.isReady()) {
      return null
    }

    try {
      const { data: { session } } = await this.supabase!.auth.getSession()
      return session
    } catch (error) {
      console.error('Get session error:', error)
      return null
    }
  }

  /**
   * 刷新会话
   */
  async refreshSession() {
    if (!this.isReady()) {
      return null
    }

    try {
      const { data, error } = await this.supabase!.auth.refreshSession()
      
      if (error) {
        console.error('Refresh session error:', error)
        return null
      }

      return data.session
    } catch (error) {
      console.error('Refresh session error:', error)
      return null
    }
  }

  /**
   * 监听身份验证状态变化
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (!this.isReady()) {
      return { data: { subscription: { unsubscribe: () => {} } } }
    }

    let currentUserId: string | null = null

    return this.supabase!.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log('Auth state changed:', event, session?.user?.email)

      // 防止重复处理相同的用户
      const newUserId = session?.user?.id
      if (newUserId && newUserId === currentUserId && event !== 'SIGNED_OUT') {
        console.log('跳过重复的认证状态变化')
        return
      }

      currentUserId = newUserId || null

      if (session?.user) {
        console.log('Attempting to fetch user data for userId:', session.user.id)
        
        // 添加延迟，确保触发器有时间执行
        if (event === 'SIGNED_UP') {
          console.log('新用户注册，等待触发器执行...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        const userData = await this.getUserData(session.user.id, session.user.email)
        
        if (userData) {
          callback(userData)
          
          // 主动触发积分刷新
          setTimeout(() => {
            if (typeof window !== 'undefined' && window.__CREDITS_REFRESH__) {
              console.log('[Auth] 触发积分刷新')
              window.__CREDITS_REFRESH__()
            }
          }, 1000)
        } else {
          // 如果获取用户数据失败，但认证成功，使用基本信息
          console.warn('Failed to fetch user data, but auth was successful')
          const fallbackUser = {
            id: session.user.id,
            email: session.user.email || 'unknown@example.com',
            name: 'User',
            emailVerified: session.user.email_confirmed || false,
            credits: 500,
            role: 'free_user' as const,
          }
          console.log('🔄 使用后备用户数据:', fallbackUser)
          callback(fallbackUser)
        }
      } else {
        currentUserId = null
        callback(null)
      }
    })
  }

  /**
   * 创建用户记录和资料（使用服务角色绕过RLS）
   */
  private async createUserRecord(userId: string, email: string, name?: string) {
    try {
      // 1. 首先检查用户是否已存在
      const existingUser = await userService.getUserById(userId)
      
      if (existingUser) {
        console.log('用户记录已存在:', { userId, email })
        return
      }

      // 2. 调用API端点来创建用户记录（使用服务角色）
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email,
          name: name || '',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create user record')
      }

      const result = await response.json()
      console.log('用户记录创建成功:', result)
    } catch (error) {
      console.error('Create user record error:', error)
      // 不抛出错误，因为用户认证已经成功
      console.warn('用户记录创建失败，但认证成功')
    }
  }

  /**
   * 获取完整用户数据（使用API端点获取，绕过RLS限制）
   */
  private async getUserData(userId: string, userEmail?: string): Promise<AuthUser | null> {
    if (!this.isReady()) {
      return null
    }

    try {
      // 首先尝试使用API端点获取用户数据（使用服务角色权限）
      // 添加重试机制，因为触发器可能需要时间创建数据
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const response = await fetch('/api/auth/get-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success && result.user) {
              console.log('✅ 成功通过API获取用户数据:', { userId, email: result.user.email, credits: result.user.credits })
              return result.user
            }
          } else if (response.status === 404) {
            console.log(`⏳ API路由未找到，重试 ${retryCount + 1}/${maxRetries}...`)
            retryCount++
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒后重试
              continue
            }
          } else {
            console.error('❌ API获取用户数据失败:', response.status, response.statusText)
            break
          }
        } catch (fetchError) {
          console.error('❌ API请求异常:', fetchError)
          retryCount++
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          break
        }
      }

      // 如果API失败，尝试直接查询（可能受RLS限制）
      console.warn('API获取用户数据失败，尝试直接查询')
      
      const { data: userData, error: userError } = await this.supabase!
        .from('users')
        .select('id, email, email_verified, credits, role')
        .eq('id', userId)
        .maybeSingle()

      if (userError) {
        console.error('Failed to fetch user data:', userError)
        return null
      }

      if (!userData) {
        console.error('No user data found for userId:', userId)
        
        // 如果直接查询也没有数据，可能是触发器还没执行完
        // 尝试手动创建用户记录
        console.log('🔄 尝试手动创建用户记录...', { 
  userId, 
  email: userEmail, 
  actualEmail: userEmail || 'MISSING_EMAIL',
  sessionEmail: 'from_session'
})
        try {
          const createResponse = await fetch('/api/auth/create-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userId,
              email: userEmail || 'unknown@example.com', // 使用实际邮箱
              name: 'User'
            }),
          })
          
          if (createResponse.ok) {
            const createResult = await createResponse.json()
            if (createResult.success) {
              console.log('✅ 手动创建用户记录成功')
              // 再次尝试获取用户数据
              const retryResponse = await fetch('/api/auth/get-user', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
              })
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json()
                if (retryResult.success && retryResult.user) {
                  return retryResult.user
                }
              }
            }
          }
        } catch (createError) {
          console.error('手动创建用户记录失败:', createError)
        }
        
        return null
      }

      // 尝试获取用户资料，如果失败则使用默认值
      let profile = null
      try {
        profile = await userService.getUserProfile(userId)
      } catch (profileError) {
        console.warn('Failed to fetch user profile, using defaults:', profileError)
      }

      return {
        id: userData.id,
        email: userData.email,
        name: profile?.name || 'User',
        emailVerified: userData.email_verified,
        credits: userData.credits,
        role: userData.role as 'admin' | 'pro_user' | 'free_user' | 'guest',
        profile: profile ? {
          ...profile,
          language: profile.language || 'en',
          timezone: profile.timezone || 'UTC',
        } : {
          id: '',
          user_id: userId,
          name: 'User',
          avatar_url: null,
          language: 'en',
          timezone: 'UTC',
          notification_preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Get user data error:', error);
      return null;
    }
  }

  /**
   * 获取用户友好的错误信息
   */
  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'User already registered': '该邮箱已被注册',
      'Invalid login credentials': '邮箱或密码错误',
      'Email not confirmed': '请先验证您的邮箱',
      'Password should be at least 6 characters': '密码至少需要6位字符',
      'Invalid email': '邮箱格式不正确',
      'Signup requires a valid password': '请输入有效密码',
      'Email rate limit exceeded': '邮件发送频率过高，请稍后重试',
    }

    return errorMessages[errorCode] || '操作失败，请重试'
  }
}

// 导出单例实例
export const authService = new AuthService()

// 服务器端验证函数
export async function verifyServerAuth(userId?: string) {
  if (!userId) {
    return null
  }

  try {
    const supabase = createSupabaseServerClient()
    
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        user_profiles (*)
      `)
      .eq('id', userId)
      .single()

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      credits: user.credits,
      role: user.role as 'admin' | 'pro_user' | 'free_user' | 'guest',
      profile: user.user_profiles?.[0] || undefined,
    } as AuthUser
  } catch (error) {
    console.error('Server auth verification error:', error)
    return null
  }
} 