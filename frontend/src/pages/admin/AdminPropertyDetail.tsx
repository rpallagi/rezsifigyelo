import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Zap, Droplets, CreditCard, Wrench, FileText, Megaphone,
  Landmark, Building, MessageCircle, Radio,
} from "lucide-react";
import { getPropertyDetail, type PropertyDetailData } from "@/lib/api";
import { formatHuf, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";

import PropertyBasicInfo from "./property-tabs/PropertyBasicInfo";
import PropertyReadings from "./property-tabs/PropertyReadings";
import PropertyPayments from "./property-tabs/PropertyPayments";
import PropertyMaintenance from "./property-tabs/PropertyMaintenance";
import PropertyDocuments from "./property-tabs/PropertyDocuments";
import PropertyMarketing from "./property-tabs/PropertyMarketing";
import PropertyTax from "./property-tabs/PropertyTax";
import PropertyCommonFees from "./property-tabs/PropertyCommonFees";
import PropertyChat from "./property-tabs/PropertyChat";
import PropertySmartMeters from "./property-tabs/PropertySmartMeters";

const tabs = [
  { key: "basic", icon: Building2, labelKey: "propDetail.tabs.basic" },
  { key: "readings", icon: Zap, labelKey: "propDetail.tabs.readings" },
  { key: "payments", icon: CreditCard, labelKey: "propDetail.tabs.payments" },
  { key: "maintenance", icon: Wrench, labelKey: "propDetail.tabs.maintenance" },
  { key: "documents", icon: FileText, labelKey: "propDetail.tabs.documents" },
  { key: "marketing", icon: Megaphone, labelKey: "propDetail.tabs.marketing" },
  { key: "tax", icon: Landmark, labelKey: "propDetail.tabs.tax" },
  { key: "fees", icon: Building, labelKey: "propDetail.tabs.fees" },
  { key: "chat", icon: MessageCircle, labelKey: "propDetail.tabs.chat" },
  { key: "smart-meters", icon: Radio, labelKey: "propDetail.tabs.smartMeters" },
];

const AdminPropertyDetail = () => {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PropertyDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTab = searchParams.get("tab") || "basic";

  const propertyId = Number(id);

  const load = () => {
    if (!propertyId) return;
    setLoading(true);
    getPropertyDetail(propertyId)
      .then(setData)
      .catch(() => navigate("/admin/properties"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const typeBadge = (type: string) => {
    if (type === "lakas")
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 text-xs">{t('common.lakas')}</Badge>;
    if (type === "uzlet")
      return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-xs">{t('common.uzlet')}</Badge>;
    return <Badge variant="outline" className="text-xs">{t('common.egyeb')}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const { property, stats } = data;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="animate-in">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/admin/properties")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('propDetail.backToList')}
        </Button>

        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0 overflow-hidden">
            {property.avatar_filename ? (
              <img
                src={`/uploads/${property.avatar_filename}`}
                alt={property.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-8 w-8 text-accent-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-2xl font-bold">{property.name}</h1>
              {typeBadge(property.property_type)}
            </div>
            {property.address && (
              <p className="text-muted-foreground text-sm">{property.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in-delay-1">
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('propDetail.totalReadings')}</p>
          <p className="font-display font-bold text-lg">{stats.total_readings}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('propDetail.totalPayments')}</p>
          <p className="font-display font-bold text-lg format-hu">{formatHuf(stats.total_payments)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('propDetail.totalMaintenance')}</p>
          <p className="font-display font-bold text-lg format-hu">{formatHuf(stats.total_maintenance)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('propDetail.totalDocuments')}</p>
          <p className="font-display font-bold text-lg">{stats.total_documents}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setTab} className="animate-in-delay-2">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <PropertyBasicInfo property={property} tariffGroups={[]} onSaved={load} />
        </TabsContent>
        <TabsContent value="readings" className="mt-4">
          <PropertyReadings propertyId={propertyId} propertyName={property.name} tariffGroupId={property.tariff_group_id} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PropertyPayments propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <PropertyMaintenance propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <PropertyDocuments propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="marketing" className="mt-4">
          <PropertyMarketing propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <PropertyTax propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="fees" className="mt-4">
          <PropertyCommonFees propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <PropertyChat propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="smart-meters" className="mt-4">
          <PropertySmartMeters propertyId={propertyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPropertyDetail;
