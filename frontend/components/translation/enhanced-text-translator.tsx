'use client'

import React from 'react'
import { FormattedTranslatorWidget } from './formatted-translator-widget'

interface EnhancedTextTranslatorProps {
  className?: string
  defaultSourceLang?: string
  defaultTargetLang?: string
}

export function EnhancedTextTranslator({ 
  className,
  defaultSourceLang = 'ht',
  defaultTargetLang = 'en'
}: EnhancedTextTranslatorProps) {
  return (
    <FormattedTranslatorWidget
      className={className}
      defaultSourceLang={defaultSourceLang}
      defaultTargetLang={defaultTargetLang}
      placeholder="Type your text here. Use # for headers, **bold**, *italic*, and - for lists to preserve formatting..."
    />
  )
}