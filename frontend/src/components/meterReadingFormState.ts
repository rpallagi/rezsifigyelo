// Shared types and initial state for MeterReadingFormContent
export interface MeterReadingFormState {
  value: string;
  readingDate: string;
  photo: File | null;
  photoPreview: string | null;
  notes: string;
  ocrLoading: boolean;
  ocrResult: { value: number | null; confidence: string } | null;
}

export const initialMeterReadingFormState = (): MeterReadingFormState => ({
  value: "",
  readingDate: new Date().toISOString().split("T")[0],
  photo: null,
  photoPreview: null,
  notes: "",
  ocrLoading: false,
  ocrResult: null,
});
