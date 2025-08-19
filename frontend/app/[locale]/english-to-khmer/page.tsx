import React from 'react'
import { Metadata } from 'next'
import { EnhancedTextTranslator } from '@/components/translation/enhanced-text-translator'

type Props = {
  params: { locale: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  
  return {
    // 优化后的标题 - 加入动词和使用场景
    title: 'English to Khmer Translator – Instant & Free Online Tool',
    
    // 优化后的描述 - 强调免费、快速、准确，加入CTA
    description: 'Convert English to Khmer (ខ្មែរ) text instantly with our AI-powered translator. 100% free, no signup required. Perfect for business, travel, and learning Cambodian language.',
    
    // 优化关键词 - 覆盖热门搜索词
    keywords: [
      'english to khmer',
      'english khmer translator', 
      'translate english to cambodian',
      'khmer translation online',
      'english to ខ្មែរ',
      'cambodian translator',
      'free khmer translation',
      'english cambodian converter'
    ],
    
    openGraph: {
      // 优化 OG 标题
      title: 'English to Khmer Translator – Instant & Free Online Tool',
      
      // 优化 OG 描述
      description: 'Convert English to Khmer (ខ្មែរ) text instantly with our AI-powered translator. 100% free, no signup required. Perfect for business, travel, and learning.',
      
      url: `https://loretrans.com/${locale}/english-to-khmer`,
      siteName: 'LoReTrans',
      locale: 'en_US',
      type: 'website',
      
      // 添加图片优化
      images: [
        {
          url: `https://loretrans.com/og-english-khmer.jpg`,
          width: 1200,
          height: 630,
          alt: 'English to Khmer Translation Tool'
        }
      ]
    },
    
    twitter: {
      card: 'summary_large_image',
      title: 'English to Khmer Translator – Instant & Free Online Tool',
      description: 'Convert English to Khmer (ខ្មែរ) text instantly. 100% free, no signup required. Perfect for business, travel, and learning.',
    },
    
    alternates: {
      canonical: `https://loretrans.com/${locale}/english-to-khmer`,
      
      // 添加语言替代版本
      languages: {
        'en': `https://loretrans.com/en/english-to-khmer`,
        'km': `https://loretrans.com/km/english-to-khmer`,
      }
    }
  }
}

// 优化后的 FAQ 数据
const englishToKhmerFAQs = [
  {
    question: "Is the English to Khmer translation free?",
    answer: "Yes, our English to Khmer translation service is completely free with no hidden costs. Short English texts translate to Khmer instantly, while longer documents use our queue system for registered users. You can translate up to 5,000 characters of English text to Khmer at no charge. No signup required for basic translations."
  },
  {
    question: "Can I use it for long texts?", 
    answer: "Absolutely! You can translate up to 5,000 characters of English text to Khmer at once. For English texts over 1,000 characters, you'll need to sign in for queue processing. Shorter English to Khmer translations are processed instantly, making it ideal for quick phrase translations to ខ្មែរ and everyday communication."
  },
  {
    question: "How accurate is the English to Khmer translation?",
    answer: "Our AI-powered English to Khmer translator provides high-accuracy translations using advanced NLLB (No Language Left Behind) technology. The translation quality from English to ខ្មែរ is excellent for most content types, including business documents, academic texts, and casual conversations. While very reliable for Khmer translation, we recommend human review for critical legal or medical documents."
  },
  {
    question: "Can I translate Khmer text back to English using this tool?",
    answer: "Yes! Our translator supports bidirectional translation between English and Khmer. You can easily switch between English-to-Khmer and Khmer-to-English translation using the swap button. This makes it perfect for English speakers learning Khmer and those who need to communicate effectively in ខ្មែរ language for business or travel."
  }
]

export default function EnglishToKhmerPage({ params }: Props) {
  const { locale } = params
  
  // 结构化数据 - 使用GSC更容易识别的Schema类型
  const webApplicationStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "English to Khmer Translator - LoReTrans",
    "alternateName": "Free English to Khmer AI Translator",
    "description": "Free AI-powered English to Khmer translation tool with queue processing, translation history, and support for long texts up to 5,000 characters.",
    "url": `https://loretrans.com/${locale}/english-to-khmer`,
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript",
    "softwareVersion": "2.0",
    "datePublished": "2025-01-01",
    "dateModified": "2025-08-19",
    "inLanguage": ["en", "km"],
    "isAccessibleForFree": true,
    "creator": {
      "@type": "Organization",
      "name": "LoReTrans",
      "url": "https://loretrans.com",
      "logo": "https://loretrans.com/logo.png"
    },
    "provider": {
      "@type": "Organization", 
      "name": "LoReTrans",
      "url": "https://loretrans.com"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "validFrom": "2025-01-01"
    },
    "featureList": [
      "AI-powered English to Khmer translation",
      "Support for texts up to 5,000 characters", 
      "Queue processing for long texts",
      "Translation history tracking",
      "Bidirectional English-Khmer translation",
      "Free unlimited usage"
    ]
  }

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is the English to Khmer translation free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, our English to Khmer translation service is completely free with no hidden costs. You can translate up to 5,000 characters at no charge."
        }
      },
      {
        "@type": "Question", 
        "name": "Can I use it for long texts?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can translate up to 5,000 characters of English text to Khmer at once. For texts over 1,000 characters, you'll need to sign in for queue processing."
        }
      },
      {
        "@type": "Question",
        "name": "How accurate is the English to Khmer translation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our AI-powered English to Khmer translator provides high-accuracy translations using advanced NLLB technology, excellent for most content types."
        }
      },
      {
        "@type": "Question",
        "name": "Can I translate Khmer text back to English using this tool?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Our translator supports bidirectional translation between English and Khmer. You can easily switch between English-to-Khmer and Khmer-to-English translation."
        }
      }
    ]
  }

  const howToStructuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Translate English to Khmer Online",
    "description": "Step-by-step guide to translate English text to Khmer using our free online translator",
    "image": "https://loretrans.com/og-english-khmer.jpg",
    "totalTime": "PT1M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Enter English Text",
        "text": "Type or paste your English text into the input box on the left side.",
        "image": "https://loretrans.com/step1-english.jpg"
      },
      {
        "@type": "HowToStep", 
        "position": 2,
        "name": "Select Languages",
        "text": "Ensure 'English' is selected as source language and 'Khmer' as target language.",
        "image": "https://loretrans.com/step2-languages.jpg"
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Click Translate",
        "text": "Click the 'Translate' button to convert your English text to Khmer (ខ្មែរ) instantly.",
        "image": "https://loretrans.com/step3-translate.jpg"
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Get Results",
        "text": "Your Khmer translation will appear in the output box. Copy or download as needed.",
        "image": "https://loretrans.com/step4-results.jpg"
      }
    ]
  }

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `https://loretrans.com/${locale}`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Translation Tools",
        "item": `https://loretrans.com/${locale}/text-translate`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "English to Khmer",
        "item": `https://loretrans.com/${locale}/english-to-khmer`
      }
    ]
  };

  return (
    <>
      {/* 结构化数据 - 确保SSR渲染 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationStructuredData, null, 2)
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData, null, 2)
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToStructuredData, null, 2)
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbStructuredData, null, 2)
        }}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* 优化后的 H1 标题 */}
        <h1 className="text-3xl font-bold text-center mb-8">
          English to Khmer Translator - Free & Instant
        </h1>
        
        {/* 优化后的副标题 */}
        <div className="text-center mb-8">
          <h2 className="text-xl text-gray-600 mb-4">
            Convert English to Cambodian (ខ្មែរ) Language Online
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Translate English to Khmer (ខ្មែរ) instantly with our free AI-powered translator. 
            Perfect for business, travel, education, and learning Cambodian language.
          </p>
        </div>

        <EnhancedTextTranslator 
          defaultSourceLang="en"
          defaultTargetLang="km"
        />

        {/* FAQ 部分 */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="max-w-4xl mx-auto space-y-6">
            {englishToKhmerFAQs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">
                  {faq.question}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 添加关键词优化的内容区块 */}
        <div className="mt-16 bg-gray-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">
            Why Choose Our English to Khmer Translator?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">100% Free Online Tool</h3>
              <p className="text-gray-600">
                Our English to Khmer translation service is completely free. 
                No hidden costs, no subscription required. Translate English to ខ្មែរ instantly.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Fast & Accurate Results</h3>
              <p className="text-gray-600">
                Get instant English to Khmer translation with high accuracy. 
                Perfect for business, education, and personal use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
