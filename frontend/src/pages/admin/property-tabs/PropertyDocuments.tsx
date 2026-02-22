import { useEffect, useState, useRef } from "react";
import { FileText, Upload, Trash2, Download, File, Image as ImageIcon } from "lucide-react";
import {
  getPropertyDocuments, uploadPropertyDocument, deleteDocument,
  type DocumentItem,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

interface Props {
  propertyId: number;
}

const PropertyDocuments = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [uploadCategory, setUploadCategory] = useState("egyeb");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    getPropertyDocuments(propertyId)
      .then((data) => setDocuments(data.documents))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadPropertyDocument(propertyId, file, uploadCategory);
      load();
    } catch (err: any) {
      alert(err.message || t('common.error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDocument(id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  const catLabel = (cat: string) => {
    const map: Record<string, string> = {
      atadas_atvetel: t('docs.atadas'),
      szerzodes: t('docs.szerzodes'),
      marketing: t('docs.marketingCat'),
      egyeb: t('docs.egyeb'),
    };
    return map[cat] || cat;
  };

  const catColor = (cat: string) => {
    if (cat === 'atadas_atvetel') return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400';
    if (cat === 'szerzodes') return 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400';
    if (cat === 'marketing') return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400';
    return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950 dark:text-gray-400';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const isImage = (mime: string | null) => mime?.startsWith('image/') || false;

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('docs.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="atadas_atvetel">{t('docs.atadas')}</SelectItem>
              <SelectItem value="szerzodes">{t('docs.szerzodes')}</SelectItem>
              <SelectItem value="marketing">{t('docs.marketingCat')}</SelectItem>
              <SelectItem value="egyeb">{t('docs.egyeb')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "..." : t('docs.uploadFile')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('docs.noFiles')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="glass-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                {isImage(doc.mime_type) ? (
                  <ImageIcon className="h-4 w-4 text-accent-foreground" />
                ) : (
                  <File className="h-4 w-4 text-accent-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-xs ${catColor(doc.category)}`}>
                    {catLabel(doc.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <a
                  href={`/uploads/docs/${doc.stored_filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(doc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('docs.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropertyDocuments;
