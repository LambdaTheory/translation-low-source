'use client';

import { useTranslations } from 'next-intl';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Check, Globe } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { switchLocale, detectLocaleFromPath, type Locale } from '@/lib/navigation';

const locales = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export default function LocaleSwitcher() {
  const t = useTranslations('debug');

  const router = useRouter();
  const pathname = usePathname();
  const [isChanging, setIsChanging] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>('en');
  
  // 更新当前语言检测
  useEffect(() => {
    const { locale } = detectLocaleFromPath(pathname);
    if (locale && locale !== currentLocale) {
      setCurrentLocale(locale);
    }
  }, [pathname, currentLocale]);

  const handleLocaleChange = useCallback(async (newLocale: Locale) => {
    if (isChanging || currentLocale === newLocale) {
      console.log(t('skipping_locale_change'), { isChanging, currentLocale, newLocale });
      return;
    }
    
    setIsChanging(true);
    try {
      const newPath = switchLocale(pathname, currentLocale, newLocale);
      
      // 确保新路径包含正确的locale前缀
      const finalPath = newPath.startsWith(`/${newLocale}`) ? newPath : `/${newLocale}${newPath}`;
      
      console.log(t('switching_locale'), { 
        currentLocale, 
        newLocale, 
        pathname, 
        newPath,
        finalPath 
      });
      
      // 使用replace而不是push，避免历史记录堆积
      router.replace(finalPath);
      
      // 延迟重置状态，确保路由切换完成
      setTimeout(() => {
        setIsChanging(false);
      }, 1000);
    } catch (error) {
      console.error('Error changing locale:', error);
      setIsChanging(false);
    }
  }, [isChanging, currentLocale, pathname, router]);

  const currentLocaleInfo = useMemo(() => {
    return locales.find(l => l.code === currentLocale) || locales[0];
  }, [currentLocale]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="h-9 px-3 gap-2"
          disabled={isChanging}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline-flex">
            {currentLocaleInfo.name}
          </span>
          <span className="sm:hidden">
            {currentLocaleInfo.flag}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map(({ code, name, flag }) => (
          <DropdownMenuItem
            key={code}
            disabled={isChanging}
            onClick={() => handleLocaleChange(code as Locale)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span>{flag}</span>
              <span>{name}</span>
            </div>
            {currentLocale === code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
