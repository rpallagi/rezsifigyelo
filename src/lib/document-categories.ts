export const DOCUMENT_CATEGORIES = [
  { value: "adasveteli", label: "Adásvételi szerződés" },
  { value: "bejegyzo_hatarozat", label: "Tulajdoni lap / Bejegyző határozat" },
  { value: "szmsz", label: "SZMSZ" },
  { value: "alapito_okirat", label: "Társasházi alapító okirat" },
  { value: "energetikai", label: "Energetikai tanúsítvány" },
  { value: "biztositas", label: "Biztosítási kötvény" },
  { value: "szerzodes", label: "Szerződés" },
  { value: "atadas_atvetel", label: "Átadás-átvétel" },
  { value: "marketing", label: "Marketing" },
  { value: "egyeb", label: "Egyéb" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

export function documentCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
