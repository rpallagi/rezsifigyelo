import { useI18n, type Locale } from '@/lib/i18n';
import { Globe } from 'lucide-react';

const LanguageToggle = () => {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    const next: Locale = locale === 'hu' ? 'en' : 'hu';
    setLocale(next);
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
        text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={locale === 'hu' ? 'Switch to English' : 'Váltás magyarra'}
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="uppercase">{locale}</span>
    </button>
  );
};

export default LanguageToggle;
