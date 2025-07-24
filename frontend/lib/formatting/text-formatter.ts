/**
 * Text formatting utilities for preserving structure during translation
 */

export interface FormattedTextBlock {
  type: 'header' | 'paragraph' | 'bold' | 'italic' | 'list' | 'blank_line'
  level?: number // For headers (1-6)
  content: string
  originalLine: string
  preserveFormatting: boolean
}

export interface FormattedText {
  blocks: FormattedTextBlock[]
  originalText: string
  hasFormatting: boolean
}

/**
 * Parse text and detect formatting patterns
 */
export function parseTextFormatting(text: string): FormattedText {
  const lines = text.split('\n')
  const blocks: FormattedTextBlock[] = []
  let hasFormatting = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip completely empty lines but preserve them
    if (trimmedLine === '') {
      blocks.push({
        type: 'blank_line',
        content: '',
        originalLine: line,
        preserveFormatting: true
      })
      continue
    }

    // Detect headers (# ## ### or similar patterns)
    const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      hasFormatting = true
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        content: headerMatch[2],
        originalLine: line,
        preserveFormatting: true
      })
      continue
    }

    // Detect bold text (**text** or __text__)
    const boldMatch = trimmedLine.match(/^\*\*(.+)\*\*$|^__(.+)__$/)
    if (boldMatch) {
      hasFormatting = true
      blocks.push({
        type: 'bold',
        content: boldMatch[1] || boldMatch[2],
        originalLine: line,
        preserveFormatting: true
      })
      continue
    }

    // Detect italic text (*text* or _text_)
    const italicMatch = trimmedLine.match(/^\*(.+)\*$|^_(.+)_$/)
    if (italicMatch) {
      hasFormatting = true
      blocks.push({
        type: 'italic',
        content: italicMatch[1] || italicMatch[2],
        originalLine: line,
        preserveFormatting: true
      })
      continue
    }

    // Detect list items (- * +)
    const listMatch = trimmedLine.match(/^[-\*\+]\s+(.+)$/)
    if (listMatch) {
      hasFormatting = true
      blocks.push({
        type: 'list',
        content: listMatch[1],
        originalLine: line,
        preserveFormatting: true
      })
      continue
    }

    // Regular paragraph
    blocks.push({
      type: 'paragraph',
      content: trimmedLine,
      originalLine: line,
      preserveFormatting: false
    })
  }

  return {
    blocks,
    originalText: text,
    hasFormatting
  }
}

/**
 * Reconstruct formatted text from translated blocks
 */
export function reconstructFormattedText(
  originalFormatted: FormattedText,
  translatedBlocks: string[]
): string {
  if (!originalFormatted.hasFormatting) {
    // If no formatting detected, return simple joined text
    return translatedBlocks.join('\n')
  }

  const result: string[] = []
  
  for (let i = 0; i < originalFormatted.blocks.length; i++) {
    const block = originalFormatted.blocks[i]
    const translatedContent = translatedBlocks[i] || block.content

    switch (block.type) {
      case 'header':
        const headerPrefix = '#'.repeat(block.level || 1)
        result.push(`${headerPrefix} ${translatedContent}`)
        break
        
      case 'bold':
        result.push(`**${translatedContent}**`)
        break
        
      case 'italic':
        result.push(`*${translatedContent}*`)
        break
        
      case 'list':
        result.push(`- ${translatedContent}`)
        break
        
      case 'blank_line':
        result.push('')
        break
        
      case 'paragraph':
      default:
        result.push(translatedContent)
        break
    }
  }

  return result.join('\n')
}

/**
 * Extract translatable content from formatted text
 */
export function extractTranslatableContent(formatted: FormattedText): string[] {
  return formatted.blocks
    .filter(block => block.content.trim() !== '')
    .map(block => block.content)
}

/**
 * Simple markdown-like formatting detection for basic HTML conversion
 */
export function convertToBasicHTML(text: string): string {
  const formatted = parseTextFormatting(text)
  
  if (!formatted.hasFormatting) {
    return text.replace(/\n/g, '<br>')
  }

  const htmlParts: string[] = []
  
  for (const block of formatted.blocks) {
    switch (block.type) {
      case 'header':
        const level = Math.min(block.level || 1, 6)
        htmlParts.push(`<h${level}>${block.content}</h${level}>`)
        break
        
      case 'bold':
        htmlParts.push(`<strong>${block.content}</strong>`)
        break
        
      case 'italic':
        htmlParts.push(`<em>${block.content}</em>`)
        break
        
      case 'list':
        htmlParts.push(`<li>${block.content}</li>`)
        break
        
      case 'blank_line':
        htmlParts.push('<br>')
        break
        
      case 'paragraph':
      default:
        htmlParts.push(`<p>${block.content}</p>`)
        break
    }
  }

  return htmlParts.join('\n')
}

/**
 * Convert HTML back to markdown-like formatting
 */
export function convertFromBasicHTML(html: string): string {
  let text = html
  
  // Convert headers
  text = text.replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (_, level, content) => {
    return '#'.repeat(parseInt(level)) + ' ' + content
  })
  
  // Convert bold
  text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**')
  text = text.replace(/<b>(.*?)<\/b>/g, '**$1**')
  
  // Convert italic
  text = text.replace(/<em>(.*?)<\/em>/g, '*$1*')
  text = text.replace(/<i>(.*?)<\/i>/g, '*$1*')
  
  // Convert paragraphs
  text = text.replace(/<p>(.*?)<\/p>/g, '$1')
  
  // Convert line breaks
  text = text.replace(/<br\s*\/?>/g, '\n')
  
  // Convert list items
  text = text.replace(/<li>(.*?)<\/li>/g, '- $1')
  
  return text.trim()
}