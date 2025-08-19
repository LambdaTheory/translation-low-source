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
    title: 'Free Nepali to English Translation Online | Accurate & Fast',
    
    // 优化后的描述 - 强调免费、快速、准确，加入CTA
    description: 'Translate Nepali to English instantly with our free online translator. Fast, accurate, and easy to use – ideal for text, phrases, and everyday communication. Try it now for free.',
    
    // 优化关键词 - 覆盖热门搜索词
    keywords: [
      'nepali to english translation',
      'translate nepali to english', 
      'nepali english translator',
      'free nepali translation',
      'nepali to english converter',
      'नेपाली to english',
      'nepali language translator',
      'instant nepali translation'
    ],
    
    openGraph: {
      // 优化 OG 标题
      title: 'Free Nepali to English Translation Online | Accurate & Fast',
      
      // 优化 OG 描述
      description: 'Translate Nepali to English instantly with our free online translator. Fast, accurate, and easy to use – ideal for text, phrases, and everyday communication. Try it now for free.',
      
      url: `https://loretrans.com/${locale}/nepali-to-english`,
      siteName: 'LoReTrans',
      locale: 'en_US',
      type: 'website',
      
      // 添加图片优化
      images: [
        {
          url: `https://loretrans.com/og-nepali-english.jpg`,
          width: 1200,
          height: 630,
          alt: 'Nepali to English Translation Tool'
        }
      ]
    },
    
    twitter: {
      card: 'summary_large_image',
      title: 'Free Nepali to English Translation Online | Accurate & Fast',
      description: 'Translate Nepali to English instantly with our free online translator. Fast, accurate, and easy to use. Try it now for free.',
    },
    
    alternates: {
      canonical: `https://loretrans.com/${locale}/nepali-to-english`,
      
      // 添加语言替代版本
      languages: {
        'en': `https://loretrans.com/en/nepali-to-english`,
        'ne': `https://loretrans.com/ne/nepali-to-english`,
      }
    }
  }
}

// 优化后的 FAQ 数据
const nepaliToEnglishFAQs = [
  {
    question: "Is the Nepali to English translation free?",
    answer: "Yes, our Nepali to English translation service is completely free with no hidden costs. Short Nepali texts translate instantly, while longer documents use our queue system for registered users. You can translate up to 5,000 characters of Nepali text to English at no charge. No signup required for basic translations."
  },
  {
    question: "Can I use it for long texts?", 
    answer: "Absolutely! You can translate up to 5,000 characters of Nepali text to English at once. For Nepali texts over 1,000 characters, you'll need to sign in for queue processing. Shorter Nepali to English translations are processed instantly, making it ideal for quick phrase translations and everyday communication."
  },
  {
    question: "How accurate is the Nepali to English translation?",
    answer: "Our AI-powered Nepali-English translator provides high-accuracy translations using advanced NLLB (No Language Left Behind) technology. The translation quality from नेपाली to English is excellent for most content types, including business documents, academic texts, and casual conversations. While very reliable, we recommend human review for critical legal or medical documents."
  },
  {
    question: "Can I translate English text back to Nepali using this tool?",
    answer: "Yes! Our translator supports bidirectional translation between Nepali and English. You can easily switch between Nepali-to-English and English-to-Nepali translation using the swap button. This makes it perfect for Nepali language learners and English speakers who need to communicate in नेपाली."
  }
]

export default function NepaliToEnglishPage({ params }: Props) {
  const { locale } = params
  
  // 结构化数据
  const webPageStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Free Nepali to English Translation Online",
    "description": "Translate Nepali to English instantly with our free online translator. Fast, accurate, and easy to use.",
    "url": `https://loretrans.com/${locale}/nepali-to-english`,
    "inLanguage": "en",
    "isPartOf": {
      "@type": "WebSite",
      "name": "LoReTrans",
      "url": "https://loretrans.com"
    }
  }

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is the Nepali to English translation free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, our Nepali to English translation service is completely free with no hidden costs. You can translate up to 5,000 characters of Nepali text to English at no charge."
        }
      },
      {
        "@type": "Question", 
        "name": "Can I use it for long texts?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can translate up to 5,000 characters of Nepali text to English at once. For texts over 1,000 characters, you'll need to sign in for queue processing."
        }
      },
      {
        "@type": "Question",
        "name": "How accurate is the Nepali to English translation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our AI-powered Nepali-English translator provides high-accuracy translations using advanced NLLB technology. The translation quality is excellent for most content types."
        }
      },
      {
        "@type": "Question",
        "name": "Can I translate English text back to Nepali using this tool?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Our translator supports bidirectional translation between Nepali and English. You can easily switch between Nepali-to-English and English-to-Nepali translation using the swap button."
        }
      }
    ]
  }

  const translationServiceStructuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Nepali to English Translation",
    "provider": {
      "@type": "Organization",
      "name": "LoReTrans",
      "url": "https://loretrans.com"
    },
    "description": "Professional AI-powered translation from Nepali to English",
    "serviceType": "Translation Service",
    "areaServed": "Worldwide",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  }

  return (
    <>
      {/* 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageStructuredData, null, 2)
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
          __html: JSON.stringify(translationServiceStructuredData, null, 2)
        }}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* 优化后的 H1 标题 */}
        <h1 className="text-3xl font-bold text-center mb-8">
          Free Nepali to English Translation Online
        </h1>
        
        {/* 优化后的副标题 */}
        <div className="text-center mb-8">
          <h2 className="text-xl text-gray-600 mb-4">
            How to Translate Nepali to English Instantly
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Translate Nepali (नेपाली) to English instantly with our free online translator. 
            Fast, accurate, and easy to use – perfect for text, phrases, and everyday communication.
          </p>
        </div>

        <EnhancedTextTranslator 
          defaultSourceLang="ne"
          defaultTargetLang="en"
        />

        {/* FAQ 部分 */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="max-w-4xl mx-auto space-y-6">
            {nepaliToEnglishFAQs.map((faq, index) => (
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
            Why Choose Our Nepali English Translator?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">100% Free Online Tool</h3>
              <p className="text-gray-600">
                Our Nepali to English translation service is completely free. 
                No hidden costs, no subscription required. Translate nepali to english instantly.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Fast & Accurate Results</h3>
              <p className="text-gray-600">
                Get instant Nepali English translation with high accuracy. 
                Perfect for business, education, and personal use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
