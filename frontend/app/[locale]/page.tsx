import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { TranslationOptions } from '@/components/translation-options'
import { LanguageGrid } from '@/components/language-grid'
import { FeatureSection } from '@/components/feature-section'
import { FAQ } from '@/components/faq'
import { HeroImage } from '@/components/hero-image'


export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'HomePage' });
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: [
      'AI translator',
      'low-resource languages',
      'free translation',
      'Creole translator',
      'Lao translator',
      'Swahili translator',
      'Burmese translator',
      'NLLB translation',
      'document translation',
      'text translation'
    ],
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: `https://loretrans.com/${locale}`,
      type: 'website',
      images: ['/images/og-image.png'],
      siteName: 'LoReTrans',
      locale: locale === 'en' ? 'en_US' : locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
      images: ['/images/og-image.png'],
      creator: '@LoReTransApp',
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'en': '/en',
        'es': '/es',
        'fr': '/fr',
      },
    },
  };
}

export default async function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  console.log(`[Page] Rendering for locale: ${locale}`);
  const t = await getTranslations({ locale, namespace: 'HomePage' });
  return (
    <>
      {/* 结构化数据 - SSR优化 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Root",
          "description": "root page on LoReTrans translation platform.",
          "url": "https://loretrans.com/en/root",
          "inLanguage": "en",
          "isPartOf": {
                    "@type": "WebSite",
                    "name": "LoReTrans",
                    "url": "https://loretrans.com"
          },
          "provider": {
                    "@type": "Organization",
                    "name": "LoReTrans",
                    "url": "https://loretrans.com"
          }
}, null, 2)
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
                    {
                              "@type": "ListItem",
                              "position": 1,
                              "name": "Home",
                              "item": "https://loretrans.com/en"
                    },
                    {
                              "@type": "ListItem",
                              "position": 2,
                              "name": "Root",
                              "item": "https://loretrans.com/en/root"
                    }
          ]
}, null, 2)
        }}
      />
      

          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Structured Data */}
      
      
      
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Text Content */}
              <div className="text-center lg:text-left">
                {/* Value Proposition Badge */}
                <div className="inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mb-6">
                  <span className="mr-2">🌍</span>
                  {t('hero.badge')}
                </div>
                
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                  {t('hero.title_part1')}
                  <span className="text-blue-600">{t('hero.title_highlight')}</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600 sm:text-xl">
                  {t('hero.description')}
                </p>

                {/* Differentiation Comparison */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 text-xs">✗</span>
                    </div>
                    <div>
                      <div className="font-medium text-red-800">{t('hero.comparison.google.title')}</div>
                      <div className="text-red-600">{t('hero.comparison.google.description')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-xs">✓</span>
                    </div>
                    <div>
                      <div className="font-medium text-green-800">{t('hero.comparison.loretrans.title')}</div>
                      <div className="text-green-600">{t('hero.comparison.loretrans.description')}</div>
                    </div>
                  </div>
                </div>

                {/* Key Features */}
                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex h-2 w-2 rounded-full bg-green-500"></div>
                    <span>{t('hero.features.free')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex h-2 w-2 rounded-full bg-blue-500"></div>
                    <span>{t('hero.features.ai_powered')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex h-2 w-2 rounded-full bg-purple-500"></div>
                    <span>{t('hero.features.document_support')}</span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <a
                    href={`/${locale}/text-translate`}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <span className="mr-2">📝</span>
                    {t('hero.buttons.text_translation')}
                  </a>
                  <a
                    href={`/${locale}/document-translate`}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <span className="mr-2">📄</span>
                    {t('hero.buttons.document_translation')}
                  </a>
                </div>

                {/* Social Proof */}
                <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★★★★★</span>
                    <span>{t('hero.social_proof.rating')}</span>
                  </div>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <span>{t('hero.social_proof.users')}</span>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <span>{t('hero.social_proof.accuracy')}</span>
                </div>
              </div>

              {/* Hero Illustration */}
              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  <HeroImage
                    src="/images/hero-illustration.svg"
                    alt="AI Translation Platform Illustration"
                    className="w-full max-w-md h-auto"
                  />
                  {/* Floating Language Cards */}
                  <div className="absolute -top-4 -left-4 bg-white rounded-lg shadow-lg p-3 border">
                    <div className="text-xs font-medium text-gray-600">{t('hero.floating_cards.creole.language')}</div>
                    <div className="text-sm text-gray-800">{t('hero.floating_cards.creole.text')}</div>
                  </div>
                  <div className="absolute -bottom-4 -right-4 bg-white rounded-lg shadow-lg p-3 border">
                    <div className="text-xs font-medium text-gray-600">{t('hero.floating_cards.english.language')}</div>
                    <div className="text-sm text-gray-800">{t('hero.floating_cards.english.text')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Translation Options - 移到HERO下面 */}
      <TranslationOptions />

      {/* Supported Languages */}
      <section className="relative py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {t('languages.title')}
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                {t('languages.description')}
              </p>
            </div>
            <LanguageGrid />
          </div>
        </div>
      </section>

      {/* Features - 保留这个作为唯一的Why Choose LoReTrans */}
      <FeatureSection />

      {/* FAQ */}
      <FAQ />

      {/* CTA Section */}
      <section className="relative py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            {t('cta.title')}
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            {t('cta.description')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={`/${locale}/text-translate`}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-base font-medium text-primary hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
            >
              {t('cta.try_now')}
            </a>
            <a
              href={`/${locale}/document-translate`}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border-2 border-white px-6 py-3 text-base font-medium text-white hover:bg-white hover:text-primary focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
            >
              {t('cta.translate_documents')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
    </>
  )
}