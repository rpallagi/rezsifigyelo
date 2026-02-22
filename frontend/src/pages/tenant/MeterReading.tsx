import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Droplets, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTenantDashboard, submitReading, type TenantDashboardData } from "@/lib/api";
import { formatHuf } from "@/lib/format";

const meterTypes = [
  { id: 'villany' as const, label: 'Villany', Icon: Zap, color: 'hsl(45, 93%, 47%)', unit: 'kWh' },
  { id: 'viz' as const, label: 'Víz', Icon: Droplets, color: 'hsl(199, 89%, 48%)', unit: 'm³' },
];

const MeterReading = () => {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<typeof meterTypes[0] | null>(null);
  const [value, setValue] = useState("");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dashData, setDashData] = useState<TenantDashboardData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getTenantDashboard().then(setDashData).catch(() => navigate("/tenant/login"));
  }, []);

  const prevValue = selectedType && dashData
    ? (selectedType.id === 'villany' ? dashData.last_villany?.value : dashData.last_viz?.value) || 0
    : 0;

  const currentValue = parseFloat(value) || 0;
  const consumption = currentValue > prevValue ? currentValue - prevValue : 0;

  const rate = selectedType && dashData?.tariffs
    ? (selectedType.id === 'villany'
        ? dashData.tariffs.villany?.rate_huf
        : dashData.tariffs.viz?.rate_huf) || 0
    : 0;

  const estimatedCost = consumption * rate;
  const csatornaRate = dashData?.tariffs?.csatorna?.rate_huf || 0;
  const csatornaCost = selectedType?.id === 'viz' ? consumption * csatornaRate : 0;

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('utility_type', selectedType.id);
      fd.append('value', String(currentValue));
      fd.append('reading_date', readingDate);
      if (notes) fd.append('notes', notes);
      if (photo) fd.append('photo', photo);

      await submitReading(fd);
      setSubmitted(true);
      setTimeout(() => navigate("/tenant"), 2000);
    } catch (e: any) {
      alert(e.message || 'Hiba történt');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4 animate-scale-in">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h2 className="font-display text-xl font-bold mb-2">Sikeresen rögzítve!</h2>
        <p className="text-muted-foreground text-sm">A mérőállás mentésre került.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">Mérőállás rögzítés</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {step === 0 && "Válaszd ki a mérő típusát"}
          {step === 1 && "Add meg az aktuális mérőállást"}
          {step === 2 && "Ellenőrizd és mentsd"}
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Step 0: Select type */}
      {step === 0 && (
        <div className="space-y-3 animate-in">
          {meterTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => { setSelectedType(type); setStep(1); }}
              className="glass-card-hover w-full p-5 flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${type.color}20` }}>
                <type.Icon className="h-6 w-6" style={{ color: type.color }} />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">{type.label}</p>
                <p className="text-sm text-muted-foreground">
                  Előző: {type.id === 'villany'
                    ? (dashData?.last_villany?.value?.toLocaleString('hu-HU') || '—')
                    : (dashData?.last_viz?.value?.toLocaleString('hu-HU') || '—')} {type.unit}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Enter value */}
      {step === 1 && selectedType && (
        <div className="animate-in space-y-6">
          <div className="glass-card p-6">
            <label className="text-sm text-muted-foreground block mb-2">
              {selectedType.label} mérőállás ({selectedType.unit})
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={`pl. ${(prevValue + 100).toLocaleString('hu-HU')}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="text-2xl font-display font-bold h-14 text-center"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Előző állás: {prevValue.toLocaleString('hu-HU')} {selectedType.unit}
            </p>
          </div>

          {currentValue > 0 && (
            <div className="glass-card p-5 animate-in">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Fogyasztás</span>
                <span className="font-mono font-semibold">{consumption.toLocaleString('hu-HU')} {selectedType.unit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Becsült költség</span>
                <span className="font-display font-bold text-lg text-primary format-hu">{formatHuf(estimatedCost)}</span>
              </div>
              {csatornaCost > 0 && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">+ Csatorna</span>
                  <span className="font-display font-semibold text-sm format-hu">{formatHuf(csatornaCost)}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Dátum</label>
              <Input type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Fotó a mérőóráról</label>
              <Input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Megjegyzés (opcionális)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Megjegyzés..." />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setStep(0); setValue(""); }}>Vissza</Button>
            <Button className="flex-1 gradient-primary-bg border-0" disabled={currentValue <= prevValue} onClick={() => setStep(2)}>Tovább</Button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && selectedType && (
        <div className="animate-in space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-display font-bold text-lg">Összegzés</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Mérő típusa</span><span className="font-medium">{selectedType.label}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Új mérőállás</span><span className="font-medium">{currentValue.toLocaleString('hu-HU')} {selectedType.unit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fogyasztás</span><span className="font-medium">{consumption.toLocaleString('hu-HU')} {selectedType.unit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dátum</span><span className="font-medium">{readingDate}</span></div>
              {photo && <div className="flex justify-between"><span className="text-muted-foreground">Foto</span><span className="font-medium">Csatolva</span></div>}
              <hr className="border-border" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Becsült költség</span>
                <span className="font-display font-bold text-primary format-hu">{formatHuf(estimatedCost + csatornaCost)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Vissza</Button>
            <Button className="flex-1 gradient-primary-bg border-0" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Mentés..." : "Rögzítés"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeterReading;
