/**
 * Translation history service for storing and retrieving user translations
 */

import { FormattedText } from '../formatting/text-formatter'

export interface TranslationHistoryItem {
  id: string
  userId?: string
  sessionId: string
  sourceText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  hasFormatting: boolean
  formattingData?: FormattedText
  createdAt: Date
  type: 'text' | 'document'
  characterCount: number
  creditsUsed: number
  fileName?: string
  fileSize?: number
}

export interface TranslationHistoryFilter {
  type?: 'text' | 'document'
  sourceLanguage?: string
  targetLanguage?: string
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

export class TranslationHistoryService {
  private storageKey = 'loretrans_translation_history'
  private maxLocalItems = 50 // Maximum items to store locally

  /**
   * Save a translation to history
   */
  async saveTranslation(item: Omit<TranslationHistoryItem, 'id' | 'createdAt'>): Promise<string> {
    const translationItem: TranslationHistoryItem = {
      ...item,
      id: this.generateId(),
      createdAt: new Date()
    }

    // Save to local storage for guest users or as backup
    this.saveToLocalStorage(translationItem)

    // If user is logged in, also save to backend
    if (item.userId) {
      try {
        await this.saveToBackend(translationItem)
      } catch (error) {
        console.warn('Failed to save translation to backend:', error)
        // Continue with local storage only
      }
    }

    return translationItem.id
  }

  /**
   * Get translation history with optional filtering
   */
  async getHistory(
    userId?: string,
    filter?: TranslationHistoryFilter
  ): Promise<TranslationHistoryItem[]> {
    let items: TranslationHistoryItem[] = []

    // Get from backend if user is logged in
    if (userId) {
      try {
        items = await this.getFromBackend(userId, filter)
      } catch (error) {
        console.warn('Failed to get history from backend:', error)
        // Fall back to local storage
        items = this.getFromLocalStorage()
      }
    } else {
      // Guest user - get from local storage only
      items = this.getFromLocalStorage()
    }

    // Apply filters
    if (filter) {
      items = this.applyFilters(items, filter)
    }

    // Sort by creation date (newest first)
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get a specific translation by ID
   */
  async getTranslation(id: string, userId?: string): Promise<TranslationHistoryItem | null> {
    // Try backend first if user is logged in
    if (userId) {
      try {
        const backendItem = await this.getFromBackendById(id, userId)
        if (backendItem) return backendItem
      } catch (error) {
        console.warn('Failed to get translation from backend:', error)
      }
    }

    // Fall back to local storage
    const localItems = this.getFromLocalStorage()
    return localItems.find(item => item.id === id) || null
  }

  /**
   * Delete a translation from history
   */
  async deleteTranslation(id: string, userId?: string): Promise<boolean> {
    let success = false

    // Delete from backend if user is logged in
    if (userId) {
      try {
        success = await this.deleteFromBackend(id, userId)
      } catch (error) {
        console.warn('Failed to delete from backend:', error)
      }
    }

    // Always delete from local storage
    this.deleteFromLocalStorage(id)
    return success
  }

  /**
   * Clear all translation history
   */
  async clearHistory(userId?: string): Promise<boolean> {
    let success = false

    // Clear from backend if user is logged in
    if (userId) {
      try {
        success = await this.clearFromBackend(userId)
      } catch (error) {
        console.warn('Failed to clear backend history:', error)
      }
    }

    // Always clear local storage
    this.clearLocalStorage()
    return success
  }

  /**
   * Export history as JSON
   */
  async exportHistory(userId?: string): Promise<string> {
    const history = await this.getHistory(userId)
    return JSON.stringify(history, null, 2)
  }

  /**
   * Get translation statistics
   */
  async getStatistics(userId?: string): Promise<{
    totalTranslations: number
    textTranslations: number
    documentTranslations: number
    totalCharacters: number
    totalCreditsUsed: number
    languagePairs: Record<string, number>
    recentActivity: { date: string; count: number }[]
  }> {
    const history = await this.getHistory(userId)
    
    const stats = {
      totalTranslations: history.length,
      textTranslations: history.filter(item => item.type === 'text').length,
      documentTranslations: history.filter(item => item.type === 'document').length,
      totalCharacters: history.reduce((sum, item) => sum + item.characterCount, 0),
      totalCreditsUsed: history.reduce((sum, item) => sum + item.creditsUsed, 0),
      languagePairs: {} as Record<string, number>,
      recentActivity: [] as { date: string; count: number }[]
    }

    // Calculate language pair statistics
    history.forEach(item => {
      const pair = `${item.sourceLanguage}-${item.targetLanguage}`
      stats.languagePairs[pair] = (stats.languagePairs[pair] || 0) + 1
    })

    // Calculate recent activity (last 7 days)
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const count = history.filter(item => 
        item.createdAt.toISOString().split('T')[0] === dateStr
      ).length
      
      stats.recentActivity.push({ date: dateStr, count })
    }

    return stats
  }

  // Private methods

  private generateId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private saveToLocalStorage(item: TranslationHistoryItem): void {
    try {
      const existing = this.getFromLocalStorage()
      existing.unshift(item)
      
      // Limit to maxLocalItems
      if (existing.length > this.maxLocalItems) {
        existing.splice(this.maxLocalItems)
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(existing))
    } catch (error) {
      console.warn('Failed to save to local storage:', error)
    }
  }

  private getFromLocalStorage(): TranslationHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (!stored) return []
      
      const items = JSON.parse(stored)
      // Convert date strings back to Date objects
      return items.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }))
    } catch (error) {
      console.warn('Failed to get from local storage:', error)
      return []
    }
  }

  private deleteFromLocalStorage(id: string): void {
    try {
      const existing = this.getFromLocalStorage()
      const filtered = existing.filter(item => item.id !== id)
      localStorage.setItem(this.storageKey, JSON.stringify(filtered))
    } catch (error) {
      console.warn('Failed to delete from local storage:', error)
    }
  }

  private clearLocalStorage(): void {
    try {
      localStorage.removeItem(this.storageKey)
    } catch (error) {
      console.warn('Failed to clear local storage:', error)
    }
  }

  private async saveToBackend(item: TranslationHistoryItem): Promise<void> {
    const response = await fetch('/api/translation-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(item)
    })

    if (!response.ok) {
      throw new Error('Failed to save to backend')
    }
  }

  private async getFromBackend(
    userId: string, 
    filter?: TranslationHistoryFilter
  ): Promise<TranslationHistoryItem[]> {
    const params = new URLSearchParams()
    if (filter?.type) params.append('type', filter.type)
    if (filter?.sourceLanguage) params.append('sourceLanguage', filter.sourceLanguage)
    if (filter?.targetLanguage) params.append('targetLanguage', filter.targetLanguage)
    if (filter?.dateFrom) params.append('dateFrom', filter.dateFrom.toISOString())
    if (filter?.dateTo) params.append('dateTo', filter.dateTo.toISOString())
    if (filter?.limit) params.append('limit', filter.limit.toString())
    if (filter?.offset) params.append('offset', filter.offset.toString())

    const response = await fetch(`/api/translation-history?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get from backend')
    }

    const data = await response.json()
    return data.items.map((item: any) => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }))
  }

  private async getFromBackendById(id: string, userId: string): Promise<TranslationHistoryItem | null> {
    const response = await fetch(`/api/translation-history/${id}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to get from backend')
    }

    const item = await response.json()
    return {
      ...item,
      createdAt: new Date(item.createdAt)
    }
  }

  private async deleteFromBackend(id: string, userId: string): Promise<boolean> {
    const response = await fetch(`/api/translation-history/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    })

    return response.ok
  }

  private async clearFromBackend(userId: string): Promise<boolean> {
    const response = await fetch('/api/translation-history', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    })

    return response.ok
  }

  private async getAuthToken(): Promise<string> {
    // This would integrate with your existing auth system
    // For now, return empty string
    return ''
  }

  private applyFilters(items: TranslationHistoryItem[], filter: TranslationHistoryFilter): TranslationHistoryItem[] {
    let filtered = items

    if (filter.type) {
      filtered = filtered.filter(item => item.type === filter.type)
    }

    if (filter.sourceLanguage) {
      filtered = filtered.filter(item => item.sourceLanguage === filter.sourceLanguage)
    }

    if (filter.targetLanguage) {
      filtered = filtered.filter(item => item.targetLanguage === filter.targetLanguage)
    }

    if (filter.dateFrom) {
      filtered = filtered.filter(item => item.createdAt >= filter.dateFrom!)
    }

    if (filter.dateTo) {
      filtered = filtered.filter(item => item.createdAt <= filter.dateTo!)
    }

    if (filter.limit && filter.offset !== undefined) {
      filtered = filtered.slice(filter.offset, filter.offset + filter.limit)
    } else if (filter.limit) {
      filtered = filtered.slice(0, filter.limit)
    }

    return filtered
  }
}

// Singleton instance
export const translationHistoryService = new TranslationHistoryService()