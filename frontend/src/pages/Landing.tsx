import { Link } from "react-router-dom";
import { Key, BarChart3, Camera, Calculator, TrendingUp, ArrowRight, Zap, Droplets, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-lg">Rezsi Követés</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tenant/login">Bérlő belépés</Link>
            </Button>
            <Button size="sm" className="gradient-primary-bg border-0" asChild>
              <Link to="/admin/login">Bérbeadó</Link>
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
              Közüzemi nyilvántartás, egyszerűen
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5">
              Tartsd kézben a{" "}
              <span className="gradient-text">rezsiköltségeket</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Mérőállás rögzítés, automatikus költségszámítás, bérlői kommunikáció
              és teljes ingatlankezelés — egy helyen, okostelefonról is.
            </p>
          </div>

          {/* Two big entry cards */}
          <div className="animate-in-delay-1 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <Link to="/tenant/login" className="group">
              <div className="glass-card-hover p-8 text-left h-full">
                <div className="w-14 h-14 rounded-2xl gradient-tenant-bg flex items-center justify-center mb-5">
                  <Key className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-3">Bérlő vagyok</h2>
                <p className="text-muted-foreground mb-5 leading-relaxed">
                  Rögzítsd a mérőállásaidat pillanatok alatt.
                  Kövesd a fogyasztásodat és költségeidet valós időben.
                </p>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  Mérőállás rögzítés <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            <Link to="/admin/login" className="group">
              <div className="glass-card-hover p-8 text-left h-full">
                <div className="w-14 h-14 rounded-2xl gradient-admin-bg flex items-center justify-center mb-5">
                  <BarChart3 className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-3">Bérbeadó vagyok</h2>
                <p className="text-muted-foreground mb-5 leading-relaxed">
                  Kezeld az ingatlanportfóliódat, kövesd a bevételeidet,
                  számlákat és optimalizáld a hozamodat egyetlen felületen.
                </p>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  Admin felület <ArrowRight className="h-4 w-4" />
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
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">Minden funkció, amire szükséged van</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Rezsikövetés, ingatlankezelés és pénzügyi nyilvántartás egy helyen.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in-delay-3">
            {[
              {
                icon: Camera,
                title: "Fotós leolvasás",
                description: "Fényképezd le a mérőórádat — a rendszer eltárolja és nyomon követi az állásokat.",
              },
              {
                icon: Calculator,
                title: "Automatikus költségszámítás",
                description: "Azonnal kiszámolja a várható költséget az aktuális tarifák alapján.",
              },
              {
                icon: TrendingUp,
                title: "ROI kalkulátor",
                description: "Számold ki a befektetésed megtérülését és kövesd a break-even pontot.",
              },
              {
                icon: Zap,
                title: "Villany · Víz · Csatorna",
                description: "Minden közüzemi mérő egy helyen, egységes kezelőfelülettel.",
              },
              {
                icon: Receipt,
                title: "Számlázás és fizetés",
                description: "Számlázz.hu integráció, fizetési felszólítások, online fizetés egy kattintással.",
              },
              {
                icon: FileText,
                title: "PDF riportok",
                description: "Fogyasztási kimutatások és összesítők PDF-ben, automatikusan.",
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
            <span>Rezsi Követés © 2025</span>
          </div>
          <p className="text-muted-foreground text-sm">Közüzemi nyilvántartás és ingatlankezelés, egyszerűen.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
