import { Link } from "react-router-dom";
import { Key, BarChart3, Camera, Calculator, TrendingUp, ArrowRight, Zap, Droplets, FileText, Receipt, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";

const Landing = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-lg">{t('common.appName')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tenant/login">{t('landing.tenantBtn')}</Link>
            </Button>
            <Button size="sm" className="gradient-primary-bg border-0" asChild>
              <Link to="/admin/login">{t('landing.landlordBtn')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="animate-in max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              {t('landing.tagline')}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5">
              {t('landing.heroTitle1')}{" "}
              <span className="gradient-text">{t('landing.heroTitle2')}</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              {t('landing.heroDesc')}
            </p>
          </div>

          {/* Two big entry cards */}
          <div className="animate-in-delay-1 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <Link to="/tenant/login" className="group">
              <div className="glass-card-hover p-8 text-left h-full">
                <div className="w-14 h-14 rounded-2xl gradient-tenant-bg flex items-center justify-center mb-5">
                  <Key className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-3">{t('landing.tenantCard')}</h2>
                <p className="text-muted-foreground mb-5 leading-relaxed">
                  {t('landing.tenantCardDesc')}
                </p>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  {t('landing.tenantCardLink')} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            <Link to="/admin/login" className="group">
              <div className="glass-card-hover p-8 text-left h-full">
                <div className="w-14 h-14 rounded-2xl gradient-admin-bg flex items-center justify-center mb-5">
                  <BarChart3 className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-3">{t('landing.landlordCard')}</h2>
                <p className="text-muted-foreground mb-5 leading-relaxed">
                  {t('landing.landlordCardDesc')}
                </p>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  {t('landing.landlordCardLink')} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-14 animate-in-delay-2">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">{t('landing.featuresTitle')}</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {t('landing.featuresDesc')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in-delay-3">
            {[
              {
                icon: Camera,
                title: t('landing.feat1'),
                description: t('landing.feat1Desc'),
              },
              {
                icon: Calculator,
                title: t('landing.feat2'),
                description: t('landing.feat2Desc'),
              },
              {
                icon: TrendingUp,
                title: t('landing.feat3'),
                description: t('landing.feat3Desc'),
              },
              {
                icon: Zap,
                title: t('landing.feat4'),
                description: t('landing.feat4Desc'),
              },
              {
                icon: Receipt,
                title: t('landing.feat5'),
                description: t('landing.feat5Desc'),
              },
              {
                icon: Wifi,
                title: t('landing.feat6'),
                description: t('landing.feat6Desc'),
              },
            ].map((feature, i) => (
              <div key={i} className="glass-card-hover p-6">
                <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-4">
        <div className="container max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Zap className="h-4 w-4" />
            <span>{t('common.appName')} &copy; 2025</span>
          </div>
          <p className="text-muted-foreground text-sm">{t('landing.footer')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
