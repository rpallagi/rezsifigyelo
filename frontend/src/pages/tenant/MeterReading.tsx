import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Droplets, ChevronRight, Check, Camera, CalendarDays, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTenantDashboard, submitReading, type TenantDashboardData } from "@/lib/api";
import { formatHuf, formatNumber } from "@/lib/format";

const meterTypes = [
  { id: 'villany' as const, label: 'Villany', Icon: Zap, color: 'hsl(45, 93%, 47%)', unit: 'kWh', desc: 'Villanymero aktualis allasa' },
  { id: 'viz' as const, label: 'Viz', Icon: Droplets, color: 'hsl(199, 89%, 48%)', unit: 'm\u00B3', desc: 'Vizmero aktualis allasa' },
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
      alert(e.message || 'Hiba tortent');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-5 animate-in">
          <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="h-7 w-7 text-success" strokeWidth={3} />
          </div>
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 animate-in-delay-1">Sikeresen rogzitve!</h2>
        <p className="text-muted-foreground text-sm animate-in-delay-2">A meroallas mentesre kerult.</p>
        <p className="text-muted-foreground text-xs mt-1 animate-in-delay-2">Atiranyitas a fooldallra...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">Meroallas rogzites</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {step === 0 && "Valaszd ki a mero tipusat"}
          {step === 1 && "Add meg az aktualis merollast"}
          {step === 2 && "Ellenorizd es mentsd"}
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Step 0: Select type */}
      {step === 0 && (
        <div className="space-y-3 animate-in">
          {meterTypes.map((type) => {
            const lastValue = type.id === 'villany'
              ? dashData?.last_villany?.value
              : dashData?.last_viz?.value;
            const lastDate = type.id === 'villany'
              ? dashData?.last_villany?.reading_date
              : dashData?.last_viz?.reading_date;

            return (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type); setStep(1); }}
                className="glass-card-hover w-full p-5 flex items-center gap-4 text-left"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${type.color}15` }}
                >
                  <type.Icon className="h-7 w-7" style={{ color: type.color }} />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-base">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                  {lastValue != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Elozo: <span className="font-medium text-foreground">{formatNumber(lastValue)} {type.unit}</span>
                      {lastDate && <span className="ml-1 opacity-60">({lastDate})</span>}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Step 1: Enter value */}
      {step === 1 && selectedType && (
        <div className="animate-in space-y-5">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${selectedType.color}15` }}>
                <selectedType.Icon className="h-5 w-5" style={{ color: selectedType.color }} />
              </div>
              <div>
                <p className="font-display font-semibold">{selectedType.label} meroallas</p>
                <p className="text-xs text-muted-foreground">Elozo: {formatNumber(prevValue)} {selectedType.unit}</p>
              </div>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={`pl. ${formatNumber(prevValue + 100)}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="text-3xl font-display font-bold h-16 text-center border-2 focus:border-primary"
              autoFocus
            />
          </div>

          {currentValue > 0 && (
            <div className="glass-card p-5 animate-in space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Fogyasztas</span>
                <span className="font-mono font-semibold text-base">{formatNumber(consumption)} {selectedType.unit}</span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Becsult koltseg</span>
                <span className="font-display font-bold text-xl text-primary format-hu">{formatHuf(estimatedCost)}</span>
              </div>
              {csatornaCost > 0 && (
                <>
                  <div className="h-px bg-border/50" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">+ Csatorna</span>
                    <span className="font-display font-semibold text-sm format-hu">{formatHuf(csatornaCost)}</span>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Osszes</span>
                    <span className="font-display font-bold text-lg format-hu">{formatHuf(estimatedCost + csatornaCost)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm text-muted-foreground">Datum</label>
              </div>
              <Input type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm text-muted-foreground">Foto a merorarol</label>
              </div>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                className="file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              {photo && <p className="text-xs text-success mt-2">Foto kivalasztva: {photo.name}</p>}
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm text-muted-foreground">Megjegyzes (opcionalis)</label>
              </div>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Megjegyzes..." />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12" onClick={() => { setStep(0); setValue(""); }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Vissza
            </Button>
            <Button className="flex-1 h-12 gradient-primary-bg border-0 font-semibold" disabled={currentValue <= prevValue} onClick={() => setStep(2)}>
              Tovabb <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && selectedType && (
        <div className="animate-in space-y-5">
          <div className="glass-card p-6">
            <h3 className="font-display font-bold text-lg mb-4">Osszegzes</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Mero tipusa</span>
                <span className="font-medium flex items-center gap-2">
                  <selectedType.Icon className="h-4 w-4" style={{ color: selectedType.color }} />
                  {selectedType.label}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Uj meroallas</span>
                <span className="font-mono font-semibold">{formatNumber(currentValue)} {selectedType.unit}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Fogyasztas</span>
                <span className="font-mono font-semibold">{formatNumber(consumption)} {selectedType.unit}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Datum</span>
                <span className="font-medium">{readingDate}</span>
              </div>
              {photo && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Foto</span>
                  <span className="text-success font-medium">Csatolva</span>
                </div>
              )}
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between py-1">
                <span className="font-medium">Becsult koltseg</span>
                <span className="font-display font-bold text-lg text-primary format-hu">{formatHuf(estimatedCost + csatornaCost)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Vissza
            </Button>
            <Button className="flex-1 h-12 gradient-primary-bg border-0 font-semibold" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Mentes..." : "Rogzites"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeterReading;
