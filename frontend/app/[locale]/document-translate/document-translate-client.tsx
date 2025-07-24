'use client'

import { DocumentTranslator } from '@/components/document-translator'
import { TranslationNavButtons } from '@/components/translation-nav-buttons'
import { GuestLimitGuard } from '@/components/guest-limit-guard'
import { useTranslations } from 'next-intl'

interface DocumentTranslateClientProps {
  locale: string
}

export function DocumentTranslateClient({ locale }: DocumentTranslateClientProps) {
  const t = useTranslations('DocumentTranslatePage')

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="container mx-auto px-4 mb-8">
        <div className="max-w-4xl mx-auto">
          <TranslationNavButtons currentPage="document" locale={locale} />
        </div>
      </div>

      {/* Document Translator */}
      <GuestLimitGuard showStatus={false}>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <DocumentTranslator />
          </div>
        </div>
      </GuestLimitGuard>
    </div>
  )
}