import { useEffect, useState } from "react";
import { TrendingUp, Building2, Banknote, Wrench, CalendarClock, Percent } from "lucide-react";
import { getAdminROI, type ROIProperty } from "@/lib/api";
import { formatHuf, formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const AdminROI = () => {
  const [properties, setProperties] = useState<ROIProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminROI()
      .then((data) => setProperties(data.properties))
      .finally(() => setLoading(false));
  }, []);

  const typeBadge = (type: string) => {
    if (type === "lakas")
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">Lakás</Badge>;
    if (type === "uzlet")
      return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">Üzlet</Badge>;
    return <Badge variant="outline" className="text-xs">Egyéb</Badge>;
  };

  const yieldColor = (y: number) => {
    if (y >= 8) return "text-green-600";
    if (y >= 5) return "text-amber-600";
    return "text-red-500";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">ROI Kalkulátor</h1>
        <p className="text-muted-foreground text-sm mt-1">Befektetés megtérülése ingatlanonként</p>
      </div>

      {properties.length === 0 ? (
        <div className="glass-card p-12 text-center animate-in-delay-1">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Nincs ingatlan vételárral és bérleti díjjal. Add meg ezeket az ingatlan szerkesztésénél.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in-delay-1">
          {properties.map((p) => (
            <div key={p.id} className="glass-card-hover p-5 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm">{p.name}</h3>
                  {typeBadge(p.property_type)}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Vételár</p>
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(p.purchase_price)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Havi bérleti díj</p>
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(p.monthly_rent)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Összes karbantartás</p>
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(p.total_maintenance)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Éves hozam</p>
                    <p className={`font-display font-bold text-sm ${yieldColor(p.annual_yield)}`}>
                      {formatNumber(p.annual_yield, 2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Break-even */}
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Megtérülés</p>
                      <p className="font-display font-bold text-sm">
                        {p.breakeven_months} hónap
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                          ({formatNumber(p.breakeven_months / 12, 1)} év)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Break-even dátum</p>
                    <p className="font-display font-bold text-sm">{formatDate(p.breakeven_date)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminROI;
