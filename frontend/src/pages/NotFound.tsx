import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const NotFound = () => {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center">
        <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="font-display text-6xl font-bold mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-6">{t('notFound.title')}</p>
        <Button asChild className="gradient-primary-bg border-0">
          <Link to="/">{t('notFound.back')}</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
