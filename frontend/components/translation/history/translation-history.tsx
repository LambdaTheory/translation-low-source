'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  History, 
  Download, 
  FileText, 
  Languages, 
  Clock, 
  Trash2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from '@/lib/hooks/use-toast'
import { 
  TranslationHistoryItem, 
  TranslationHistoryFilter,
  translationHistoryService 
} from '@/lib/services/translation-history'
import { downloadDOCX, downloadPDF } from '@/lib/formatting/document-export'
import { copyToClipboard } from '@/lib/utils'

interface TranslationHistoryProps {
  className?: string
  onSelectTranslation?: (item: TranslationHistoryItem) => void
}

export function TranslationHistory({ className, onSelectTranslation }: TranslationHistoryProps) {
  const { user } = useAuth()
  const [history, setHistory] = useState<TranslationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TranslationHistoryFilter>({})
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'all' | 'text' | 'document'>('all')

  // Load history on component mount
  useEffect(() => {
    loadHistory()
  }, [user, filter])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const items = await translationHistoryService.getHistory(user?.id, filter)
      setHistory(items)
    } catch (error) {
      console.error('Failed to load translation history:', error)
      toast({
        title: 'Error loading history',
        description: 'Could not load your translation history. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTranslation = async (id: string) => {
    try {
      await translationHistoryService.deleteTranslation(id, user?.id)
      setHistory(prev => prev.filter(item => item.id !== id))
      toast({
        title: 'Translation deleted',
        description: 'The translation has been removed from your history.'
      })
    } catch (error) {
      toast({
        title: 'Error deleting translation',
        description: 'Could not delete the translation. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleClearHistory = async () => {
    try {
      await translationHistoryService.clearHistory(user?.id)
      setHistory([])
      toast({
        title: 'History cleared',
        description: 'All translations have been removed from your history.'
      })
    } catch (error) {
      toast({
        title: 'Error clearing history',
        description: 'Could not clear your history. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleDownloadDOCX = async (item: TranslationHistoryItem) => {
    try {
      await downloadDOCX(item.translatedText, {
        filename: `translation_${item.id}`,
        title: `Translation: ${item.sourceLanguage} → ${item.targetLanguage}`,
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
  }

  const handleDownloadPDF = async (item: TranslationHistoryItem) => {
    try {
      downloadPDF(item.translatedText, {
        filename: `translation_${item.id}`,
        title: `Translation: ${item.sourceLanguage} → ${item.targetLanguage}`,
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
  }

  const handleCopyText = async (text: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      toast({
        title: 'Text copied',
        description: 'Translation has been copied to clipboard.'
      })
    }
  }

  const filteredHistory = history.filter(item => 
    selectedType === 'all' || item.type === selectedType
  )

  const getLanguageName = (code: string) => {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'zh': 'Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'it': 'Italian',
      'tr': 'Turkish',
      'pl': 'Polish',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'sk': 'Slovak',
      'bg': 'Bulgarian',
      'hr': 'Croatian',
      'sl': 'Slovenian',
      'et': 'Estonian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'mt': 'Maltese',
      'ga': 'Irish'
    }
    return languageNames[code] || code.toUpperCase()
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Translation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading history...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Translation History
        </CardTitle>
        <CardDescription>
          View and manage your past translations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter Controls */}
        <div className="flex items-center gap-4 mb-6">
          <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All translations</SelectItem>
              <SelectItem value="text">Text translations</SelectItem>
              <SelectItem value="document">Document translations</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex-1" />
          
          {history.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearHistory}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No translations yet</h3>
            <p className="text-gray-600">
              {selectedType === 'all' 
                ? 'Your translation history will appear here after you complete your first translation.'
                : `No ${selectedType} translations found. Try changing the filter or start a new translation.`
              }
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {filteredHistory.map((item) => (
                <Card key={item.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {item.type === 'text' ? (
                            <FileText className="h-4 w-4 text-blue-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-green-600" />
                          )}
                          <Badge variant={item.type === 'text' ? 'default' : 'secondary'}>
                            {item.type === 'text' ? 'Text' : 'Document'}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Languages className="h-3 w-3" />
                            {getLanguageName(item.sourceLanguage)} → {getLanguageName(item.targetLanguage)}
                          </Badge>
                          {item.hasFormatting && (
                            <Badge variant="outline" className="text-purple-600">
                              Formatted
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {format(item.createdAt, 'MMM d, yyyy HH:mm')}
                          <span className="ml-4">
                            {item.characterCount.toLocaleString()} characters
                          </span>
                          {item.creditsUsed > 0 && (
                            <span className="ml-4">
                              {item.creditsUsed} credits used
                            </span>
                          )}
                        </div>

                        {item.fileName && (
                          <div className="text-sm text-gray-600 mb-2">
                            File: {item.fileName}
                            {item.fileSize && (
                              <span className="ml-2">
                                ({(item.fileSize / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-sm">
                          <div className="mb-1">
                            <strong>Source:</strong> {item.sourceText.substring(0, 100)}
                            {item.sourceText.length > 100 && '...'}
                          </div>
                          <div>
                            <strong>Translation:</strong> {item.translatedText.substring(0, 100)}
                            {item.translatedText.length > 100 && '...'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedItem(
                            expandedItem === item.id ? null : item.id
                          )}
                        >
                          {expandedItem === item.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyText(item.translatedText)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadDOCX(item)}
                        >
                          <Download className="h-4 w-4" />
                          DOC
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(item)}
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTranslation(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedItem === item.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Original Text</h4>
                            <ScrollArea className="h-32 p-3 bg-gray-50 rounded text-sm">
                              {item.sourceText}
                            </ScrollArea>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Translation</h4>
                            <ScrollArea className="h-32 p-3 bg-blue-50 rounded text-sm">
                              {item.translatedText}
                            </ScrollArea>
                          </div>
                        </div>
                        
                        {onSelectTranslation && (
                          <div className="mt-4 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSelectTranslation(item)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View in Translator
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}