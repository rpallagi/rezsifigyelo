import { useState, useRef } from "react";
import { Camera, Upload, AlertCircle } from "lucide-react";
import {
  editProperty, uploadPropertyAvatar, getAdminProperties,
  type AdminProperty, type TariffGroupItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useEffect } from "react";

interface Props {
  property: AdminProperty & { avatar_filename: string | null };
  tariffGroups: TariffGroupItem[];
  onSaved: () => void;
}

const PropertyBasicInfo = ({ property, onSaved }: Props) => {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tariffGroups, setTariffGroups] = useState<TariffGroupItem[]>([]);

  const [form, setForm] = useState({
    name: property.name,
    property_type: property.property_type,
    address: property.address || "",
    contact_name: property.contact_name || "",
    contact_phone: property.contact_phone || "",
    contact_email: property.contact_email || "",
    monthly_rent: property.monthly_rent != null ? String(property.monthly_rent) : "",
    purchase_price: property.purchase_price != null ? String(property.purchase_price) : "",
    tariff_group_id: String(property.tariff_group_id),
    notes: property.notes || "",
  });

  useEffect(() => {
    getAdminProperties().then((data) => setTariffGroups(data.tariff_groups));
  }, []);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  /**
   * Resize image to max 800x800px and compress to max 500KB
   * @returns Resized image as Blob or null if error
   */
  const resizeImage = async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Check file size first
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        alert(t('propDetail.avatarTooLarge') || 'Avatar túl nagy (max 5MB)');
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if larger than 800px
          const maxSize = 800;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
          }

          // Compress iteratively until under 500KB
          let quality = 0.85;
          let blob: Blob | null = null;

          const tryQuality = () => {
            canvas.toBlob(
              (b) => {
                if (!b) {
                  resolve(null);
                  return;
                }

                // If under 500KB or quality very low, use this
                if (b.size <= 500 * 1024 || quality <= 0.3) {
                  resolve(b);
                  return;
                }

                // Try lower quality
                quality -= 0.1;
                tryQuality();
              },
              'image/jpeg',
              quality
            );
          };

          tryQuality();
        };
        img.onerror = () => {
          alert(t('propDetail.avatarError') || 'Hiba a kép feldolgozása közben');
          resolve(null);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        alert(t('propDetail.avatarReadError') || 'Hiba a fájl olvasása közben');
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        property_type: form.property_type,
        address: form.address || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        tariff_group_id: form.tariff_group_id ? Number(form.tariff_group_id) : null,
        notes: form.notes || null,
      };
      await editProperty(property.id, payload);
      onSaved();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      // Resize image before upload
      const resizedBlob = await resizeImage(file);
      if (!resizedBlob) {
        setUploadingAvatar(false);
        return;
      }

      // Convert Blob back to File for upload
      const resizedFile = new File([resizedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      await uploadPropertyAvatar(property.id, resizedFile);
      onSaved();
    } catch (err: any) {
      alert(err.message || t('common.error'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar upload */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
            onClick={() => fileRef.current?.click()}
          >
            {property.avatar_filename ? (
              <img src={`/uploads/${property.avatar_filename}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? "..." : (property.avatar_filename ? t('propDetail.changeAvatar') : t('propDetail.avatarUpload'))}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG · max 5MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
      </div>

      {/* Edit form */}
      <div className="glass-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.name')} *</label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.type')}</label>
            <Select value={form.property_type} onValueChange={(v) => set("property_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lakas">{t('common.lakas')}</SelectItem>
                <SelectItem value="uzlet">{t('common.uzlet')}</SelectItem>
                <SelectItem value="egyeb">{t('common.egyeb')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('props.address')}</label>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.contactName')}</label>
            <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.phone')}</label>
            <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.email')}</label>
            <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.monthlyRent')} (Ft/hó)</label>
            <Input type="number" value={form.monthly_rent} onChange={(e) => set("monthly_rent", e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.purchasePrice')} (Ft)</label>
            <Input type="number" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('props.tariffGroup')}</label>
            <Select value={form.tariff_group_id} onValueChange={(v) => set("tariff_group_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tariffGroups.map((tg) => (
                  <SelectItem key={tg.id} value={String(tg.id)}>{tg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('props.notes')}</label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving || !form.name} className="gradient-primary-bg border-0">
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PropertyBasicInfo;
