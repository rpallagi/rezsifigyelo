import { useEffect, useState, useRef } from "react";
import { Megaphone, Upload, Trash2, ExternalLink, Image as ImageIcon } from "lucide-react";
import {
  getPropertyMarketing, savePropertyMarketing, uploadMarketingPhoto, deleteDocument,
  type MarketingData, type DocumentItem,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

interface Props {
  propertyId: number;
}

const PropertyMarketing = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    listing_title: "",
    listing_description: "",
    listing_url: "",
  });

  const load = () => {
    setLoading(true);
    getPropertyMarketing(propertyId)
      .then((mData) => {
        setData(mData);
        setForm({
          listing_title: mData.marketing.listing_title || "",
          listing_description: mData.marketing.listing_description || "",
          listing_url: mData.marketing.listing_url || "",
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await savePropertyMarketing(propertyId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMarketingPhoto(propertyId, file);
      load();
    } catch (err: any) {
      alert(err.message || t('common.error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (id: number) => {
    try {
      await deleteDocument(id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const photos = data?.photos || [];

  return (
    <div className="space-y-6">
      {/* Listing text editor */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-semibold">{t('marketing.title')}</h3>
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('marketing.listingTitle')}</label>
          <Input
            value={form.listing_title}
            onChange={(e) => setForm(f => ({...f, listing_title: e.target.value}))}
            placeholder={t('marketing.listingTitle')}
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('marketing.listingDesc')}</label>
          <Textarea
            value={form.listing_description}
            onChange={(e) => setForm(f => ({...f, listing_description: e.target.value}))}
            rows={8}
            placeholder={t('marketing.listingPlaceholder')}
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('marketing.listingUrl')}</label>
          <div className="flex gap-2">
            <Input
              value={form.listing_url}
              onChange={(e) => setForm(f => ({...f, listing_url: e.target.value}))}
              placeholder="https://ingatlan.com/..."
            />
            {form.listing_url && (
              <a href={form.listing_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gradient-primary-bg border-0">
            {saving ? t('common.saving') : t('marketing.save')}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">✓ {t('marketing.saved')}</span>
          )}
        </div>
      </div>

      {/* Photo gallery */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">{t('marketing.photos')}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "..." : t('marketing.uploadPhoto')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {photos.length === 0 ? (
          <div className="py-8 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('marketing.noPhotos')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
                <img
                  src={`/uploads/docs/${photo.stored_filename}`}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeleteConfirm(photo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-white text-xs truncate">{photo.filename}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('docs.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDeletePhoto(deleteConfirm)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropertyMarketing;
