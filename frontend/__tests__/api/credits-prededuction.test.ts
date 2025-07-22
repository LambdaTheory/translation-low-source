import { createMocks } from 'node-mocks-http'
import { POST as translatePOST } from '@/app/api/translate/route'
import { POST as creditsPOST } from '@/app/api/credits/consume/route'

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { credits: 1000 },
          error: null,
        }),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { credits: 1000 },
          error: null,
        }),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })),
  })),
}

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}))

// Mock API auth wrapper
jest.mock('@/lib/api-utils', () => ({
  withApiAuth: (handler: any, requiredRoles?: any) => {
    return async (req: any) => {
      // Add mock user context
      req.userContext = {
        user: { id: 'test-user-id', email: 'test@example.com' },
        role: 'free_user',
      }
      return handler(req)
    }
  },
}))

// Mock credit service
const mockCreditService = {
  calculateCreditsRequired: jest.fn((characterCount: number) => ({
    total_characters: characterCount,
    free_characters: Math.min(characterCount, 5000), // Updated to 5000
    billable_characters: Math.max(0, characterCount - 5000),
    credits_required: Math.ceil(Math.max(0, (characterCount - 5000) * 0.1)),
  })),
}

jest.mock('@/lib/services/credits', () => ({
  createServerCreditService: () => mockCreditService,
}))

// Mock fetch for internal API calls and NLLB service
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Credit Pre-deduction Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    
    // Reset Supabase mock defaults
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { credits: 1000 },
      error: null,
    })
    mockSupabaseClient.from().update().eq.mockResolvedValue({
      data: null,
      error: null,
    })
  })

  describe('Credits Consume API', () => {
    it('should successfully deduct credits', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: 100,
          reason: 'Test credit deduction',
          metadata: {
            characterCount: 6000,
            sourceLanguage: 'en',
            targetLanguage: 'zh',
          },
        },
      })

      const response = await creditsPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.amount).toBe(100)
      expect(data.operation).toBe('consumed')
      expect(data.new_balance).toBe(900) // 1000 - 100
    })

    it('should handle insufficient credits', async () => {
      // Mock user with low credits
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { credits: 50 },
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: 100,
          reason: 'Test insufficient credits',
        },
      })

      const response = await creditsPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.error).toBe('Insufficient credits')
      expect(data.required).toBe(100)
      expect(data.available).toBe(50)
    })

    it('should successfully refund credits', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          amount: -100, // Negative amount for refund
          reason: 'Translation failed refund',
          metadata: {
            isRefund: true,
            originalError: 'Translation service error',
          },
        },
      })

      const response = await creditsPOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.amount).toBe(100)
      expect(data.operation).toBe('refunded')
      expect(data.new_balance).toBe(1100) // 1000 + 100
    })
  })

  describe('Translation API with Credit Pre-deduction', () => {
    it('should not require credits for text under 5000 characters', async () => {
      // Mock successful translation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, new_balance: 1000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'Translated text' }),
        })

      const { req } = createMocks({
        method: 'POST',
        body: {
          text: 'A'.repeat(3000), // 3000 characters, should be free
          sourceLang: 'en',
          targetLang: 'zh',
        },
        headers: {
          authorization: 'Bearer test-token',
        },
      })

      const response = await translatePOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.creditsUsed).toBe(0) // Should be 0 for under 5000 chars
    })

    it('should require credits for text over 5000 characters', async () => {
      // Mock successful credit deduction
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, new_balance: 900 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'Translated text' }),
        })

      const { req } = createMocks({
        method: 'POST',
        body: {
          text: 'A'.repeat(6000), // 6000 characters, should require 100 credits
          sourceLang: 'en',
          targetLang: 'zh',
        },
        headers: {
          authorization: 'Bearer test-token',
        },
      })

      const response = await translatePOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.creditsUsed).toBe(100) // (6000 - 5000) * 0.1 = 100
    })

    it('should return insufficient credits error when user lacks credits', async () => {
      // Mock insufficient credits response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({
          error: 'Insufficient credits',
          required: 100,
          available: 50,
        }),
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          text: 'A'.repeat(6000), // 6000 characters, requires 100 credits
          sourceLang: 'en',
          targetLang: 'zh',
        },
        headers: {
          authorization: 'Bearer test-token',
        },
      })

      const response = await translatePOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.code).toBe('INSUFFICIENT_CREDITS')
      expect(data.required).toBe(100)
      expect(data.available).toBe(50)
    })

    it('should refund credits when translation fails', async () => {
      // Mock successful credit deduction followed by translation failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, new_balance: 900 }),
        })
        .mockRejectedValueOnce(new Error('NLLB service error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, new_balance: 1000 }), // Refund
        })

      const { req } = createMocks({
        method: 'POST',
        body: {
          text: 'A'.repeat(6000), // 6000 characters, requires 100 credits
          sourceLang: 'en',
          targetLang: 'zh',
        },
        headers: {
          authorization: 'Bearer test-token',
        },
      })

      const response = await translatePOST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200) // Should return fallback translation
      expect(data.creditsRefunded).toBe(100)
      expect(data.service).toBe('fallback-enhanced')
    })
  })

  describe('Credit Calculation Logic', () => {
    it('should calculate credits correctly for various text lengths', async () => {
      const testCases = [
        { length: 1000, expected: 0 },   // Under free limit
        { length: 5000, expected: 0 },   // At free limit
        { length: 5001, expected: 1 },   // 1 char over = 0.1 credits, rounded up to 1
        { length: 6000, expected: 100 }, // 1000 chars over = 100 credits
        { length: 8000, expected: 300 }, // 3000 chars over = 300 credits
      ]

      for (const testCase of testCases) {
        const result = mockCreditService.calculateCreditsRequired(testCase.length)
        expect(result.credits_required).toBe(testCase.expected)
      }
    })
  })
})