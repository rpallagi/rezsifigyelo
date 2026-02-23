/**
 * API client for Rezsi Követés Flask backend.
 * All endpoints are prefixed with /api.
 * Vite dev server proxies /api/* to Flask on port 5003.
 */

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Multipart upload (no Content-Type header - browser sets boundary) */
async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============ Auth ============

export const tenantLogin = (email: string, password: string) =>
  request<TenantLoginResponse>('/tenant/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const tenantRegister = (email: string, password: string, name?: string) =>
  request<{ success: boolean; message: string }>('/tenant/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });

export const tenantSelectProperty = (property_id: number) =>
  request<{ success: boolean; property: TenantProperty }>('/tenant/select-property', {
    method: 'POST',
    body: JSON.stringify({ property_id }),
  });

export const tenantLogout = () =>
  request<{ success: boolean }>('/tenant/logout', { method: 'POST' });

export const tenantSession = () =>
  request<TenantSessionResponse>('/tenant/session');

export const adminLogin = (username: string, password: string) =>
  request<{ success: boolean }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const adminLogout = () =>
  request<{ success: boolean }>('/admin/logout', { method: 'POST' });

export const adminSession = () =>
  request<{ logged_in: boolean; username?: string }>('/admin/session');

// ============ Tenant ============

export const getProperties = () =>
  request<{ properties: PropertyItem[] }>('/properties');

export const getTenantDashboard = () =>
  request<TenantDashboardData>('/tenant/dashboard');

export const submitReading = (data: FormData) =>
  fetch(`${BASE}/tenant/reading`, {
    method: 'POST',
    credentials: 'include',
    body: data, // multipart for photo
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json()).error || 'Hiba');
    return res.json();
  });

export const getTenantHistory = (type?: string) =>
  request<{ readings: ReadingItem[] }>(`/tenant/history${type && type !== 'all' ? `?type=${type}` : ''}`);

export const getTenantChartData = (type: string, limit = 24) =>
  request<ChartData>(`/tenant/chart-data?type=${type}&limit=${limit}`);

export const getTenantProfile = () =>
  request<TenantProperty>('/tenant/profile');

export const getTenantCommonFees = () =>
  request<{ fees: TenantCommonFee[] }>('/tenant/common-fees');

// ============ Admin ============

export const getAdminDashboard = () =>
  request<AdminDashboardData>('/admin/dashboard');

export const getAdminProperties = () =>
  request<{ properties: AdminProperty[]; tariff_groups: TariffGroupItem[] }>('/admin/properties');

export const addProperty = (data: Record<string, any>) =>
  request<{ success: boolean; id: number }>('/admin/properties', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const editProperty = (id: number, data: Record<string, any>) =>
  request<{ success: boolean }>(`/admin/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteProperty = (id: number) =>
  request<{ success: boolean }>(`/admin/properties/${id}`, { method: 'DELETE' });

export const getAdminReadings = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<{ readings: ReadingItem[] }>(`/admin/readings${qs}`);
};

export const getAdminPayments = (propertyId?: number) =>
  request<{ payments: PaymentItem[] }>(`/admin/payments${propertyId ? `?property_id=${propertyId}` : ''}`);

export const addPayment = (data: Record<string, any>) =>
  request<{ success: boolean }>('/admin/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const editPayment = (id: number, data: Record<string, any>) =>
  request<{ success: boolean }>(`/admin/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deletePayment = (id: number) =>
  request<{ success: boolean }>(`/admin/payments/${id}`, { method: 'DELETE' });

export const getAdminMaintenance = () =>
  request<{ logs: MaintenanceItem[] }>('/admin/maintenance');

export const addMaintenance = (data: Record<string, any>) =>
  request<{ success: boolean }>('/admin/maintenance', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const editMaintenance = (id: number, data: Record<string, any>) =>
  request<{ success: boolean }>(`/admin/maintenance/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteMaintenance = (id: number) =>
  request<{ success: boolean }>(`/admin/maintenance/${id}`, { method: 'DELETE' });

export const getAdminTodos = () =>
  request<{ todos: TodoItem[] }>('/admin/todos');

export const addTodo = (data: Record<string, any>) =>
  request<{ success: boolean }>('/admin/todos', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const editTodo = (id: number, data: Record<string, any>) =>
  request<{ success: boolean }>(`/admin/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const toggleTodo = (id: number) =>
  request<{ success: boolean }>(`/admin/todos/${id}/toggle`, { method: 'POST' });

export const deleteTodo = (id: number) =>
  request<{ success: boolean }>(`/admin/todos/${id}`, { method: 'DELETE' });

export const getAdminTariffs = () =>
  request<{ tariff_groups: TariffGroupDetail[] }>('/admin/tariffs');

export const addTariff = (data: Record<string, any>) =>
  request<{ success: boolean }>('/admin/tariffs', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const editTariff = (id: number, data: Record<string, any>) =>
  request<{ success: boolean }>(`/admin/tariffs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteTariff = (id: number) =>
  request<{ success: boolean }>(`/admin/tariffs/${id}`, { method: 'DELETE' });

export const getAdminROI = () =>
  request<{ properties: ROIProperty[] }>('/admin/roi');

export const getSystemInfo = () =>
  request<SystemInfo>('/admin/system');

export const systemPull = () =>
  request<{ success: boolean; output: string }>('/admin/system/pull', { method: 'POST' });

export const systemRebuild = () =>
  request<{ success: boolean }>('/admin/system/rebuild', { method: 'POST' });

export const changeAdminPassword = (current_password: string, new_password: string) =>
  request<{ success: boolean }>('/admin/settings/password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });

export const getHealth = () =>
  request<{ status: string; version: string; database: string }>('/health');

// ============ Types ============

export interface PropertyItem {
  id: number;
  name: string;
  property_type: string;
}

export interface TenantProperty {
  id: number;
  name: string;
  property_type: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  monthly_rent: number | null;
}

export interface TenantDashboardData {
  property: TenantProperty;
  last_villany: ReadingSummary | null;
  last_viz: ReadingSummary | null;
  last_gaz: ReadingSummary | null;
  has_gas: boolean;
  common_fees: TenantCommonFee[];
  tariffs: {
    villany: TariffInfo | null;
    viz: TariffInfo | null;
    csatorna: TariffInfo | null;
    gaz: TariffInfo | null;
  };
  monthly_total: number;
  sparklines: {
    villany: number[];
    viz: number[];
    gaz: number[];
  };
}

export interface TenantCommonFee {
  id: number;
  monthly_amount: number;
  bank_account: string | null;
  recipient: string | null;
  payment_memo: string | null;
  frequency: string;
  payment_day: number | null;
  notes: string | null;
}

export interface ReadingSummary {
  value: number;
  consumption: number | null;
  cost_huf: number | null;
  reading_date: string;
}

export interface TariffInfo {
  rate_huf: number;
  unit: string;
}

export interface ReadingItem {
  id: number;
  property_id: number;
  property_name?: string;
  utility_type: string;
  value: number;
  prev_value: number | null;
  consumption: number | null;
  cost_huf: number | null;
  photo_filename: string | null;
  reading_date: string;
  notes: string | null;
}

export interface ChartData {
  labels: string[];
  values: number[];
  consumption: number[];
  costs: number[];
}

export interface AdminDashboardData {
  total_properties: number;
  total_readings: number;
  total_payments: number;
  pending_todos: number;
  properties: AdminProperty[];
  recent_readings: ReadingItem[];
}

export interface AdminProperty {
  id: number;
  name: string;
  property_type: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  notes: string | null;
  purchase_price: number | null;
  monthly_rent: number | null;
  tariff_group_id: number;
  tariff_group_name?: string;
  last_villany?: ReadingSummary | null;
  last_viz?: ReadingSummary | null;
}

export interface PaymentItem {
  id: number;
  property_id: number;
  property_name: string;
  amount_huf: number;
  payment_date: string;
  payment_method: string | null;
  period_from: string | null;
  period_to: string | null;
  notes: string | null;
}

export interface MaintenanceItem {
  id: number;
  property_id: number | null;
  property_name: string | null;
  description: string;
  category: string | null;
  cost_huf: number | null;
  performed_by: string | null;
  performed_date: string | null;
}

export interface TodoItem {
  id: number;
  property_id: number | null;
  property_name: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
}

export interface TariffGroupItem {
  id: number;
  name: string;
  description: string | null;
}

export interface TariffGroupDetail extends TariffGroupItem {
  tariffs: {
    id: number;
    utility_type: string;
    rate_huf: number;
    unit: string;
    valid_from: string;
  }[];
}

export interface ROIProperty {
  id: number;
  name: string;
  property_type: string;
  purchase_price: number;
  monthly_rent: number;
  total_maintenance: number;
  total_rent_collected: number;
  annual_yield: number;
  breakeven_months: number;
  breakeven_date: string;
  monthly_payments: number[];
  progress_pct: number;
}

export interface SystemInfo {
  version: string;
  branch: string;
  commit_hash: string;
  commit_message: string;
  commit_date: string;
  has_update: boolean;
  behind: number;
  new_commits: string[];
}

export interface TenantLoginResponse {
  success: boolean;
  tenant: { id: number; email: string; name: string | null; phone: string | null };
  property?: TenantProperty;
  properties?: PropertyItem[];
  needs_property_select: boolean;
}

export interface TenantSessionResponse {
  logged_in: boolean;
  tenant?: { id: number; email: string; name: string | null; phone: string | null };
  property?: TenantProperty;
  needs_property_select?: boolean;
  properties?: PropertyItem[];
}

// ============ Property Detail Types ============

export interface PropertyDetailData {
  property: AdminProperty & { avatar_filename: string | null };
  stats: {
    total_readings: number;
    total_payments: number;
    total_maintenance: number;
    total_documents: number;
    current_tenant: { name: string | null; email: string } | null;
  };
}

export interface PropertyReadingsData {
  readings: ReadingItem[];
  trends: {
    villany: { current: number; previous: number; change_pct: number } | null;
    viz: { current: number; previous: number; change_pct: number } | null;
    gaz: { current: number; previous: number; change_pct: number } | null;
  };
  sparklines: {
    villany: number[];
    viz: number[];
    gaz: number[];
  };
}

export interface DocumentItem {
  id: number;
  property_id: number;
  filename: string;
  stored_filename: string;
  category: string;
  notes: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export interface MarketingData {
  marketing: {
    id: number | null;
    listing_title: string | null;
    listing_description: string | null;
    listing_url: string | null;
  };
  photos: DocumentItem[];
}

// ============ Property Detail API ============

export const getPropertyDetail = (id: number) =>
  request<PropertyDetailData>(`/admin/properties/${id}/detail`);

export const uploadPropertyAvatar = (id: number, file: File) => {
  const fd = new FormData();
  fd.append('avatar', file);
  return requestMultipart<{ success: boolean; avatar_filename: string }>(`/admin/properties/${id}/avatar`, fd);
};

export const getPropertyReadings = (id: number) =>
  request<PropertyReadingsData>(`/admin/properties/${id}/readings`);

export const getPropertyPayments = (id: number) =>
  request<{ payments: PaymentItem[] }>(`/admin/properties/${id}/payments`);

export const getPropertyMaintenance = (id: number) =>
  request<{ maintenance: MaintenanceItem[] }>(`/admin/properties/${id}/maintenance`);

export const adminSubmitReading = (data: FormData) =>
  requestMultipart<{ success: boolean; reading_id: number; consumption: number | null; cost_huf: number | null }>(
    '/admin/readings', data
  );

export const getPropertyDocuments = (id: number) =>
  request<{ documents: DocumentItem[] }>(`/admin/properties/${id}/documents`);

export const uploadPropertyDocument = (id: number, file: File, category: string, notes?: string) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('category', category);
  if (notes) fd.append('notes', notes);
  return requestMultipart<{ success: boolean; document: DocumentItem }>(`/admin/properties/${id}/documents`, fd);
};

export const deleteDocument = (id: number) =>
  request<{ success: boolean }>(`/admin/documents/${id}`, { method: 'DELETE' });

export const getPropertyMarketing = (id: number) =>
  request<MarketingData>(`/admin/properties/${id}/marketing`);

export const savePropertyMarketing = (id: number, data: { listing_title?: string; listing_description?: string; listing_url?: string }) =>
  request<{ success: boolean }>(`/admin/properties/${id}/marketing`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const uploadMarketingPhoto = (id: number, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return requestMultipart<{ success: boolean; document: DocumentItem }>(`/admin/properties/${id}/marketing/photos`, fd);
};

// ============ New Types ============

// Property Tax
export interface PropertyTaxItem {
  id: number;
  property_id: number;
  year: number;
  bank_account: string | null;
  recipient: string | null;
  annual_amount: number;
  installment_amount: number | null;
  payment_memo: string | null;
  deadline_autumn: string | null;
  deadline_spring: string | null;
  autumn_paid: boolean;
  autumn_paid_date: string | null;
  spring_paid: boolean;
  spring_paid_date: string | null;
  document_id: number | null;
  include_in_roi: boolean;
  notes: string | null;
}

// Common Fee
export interface CommonFeeItem {
  id: number;
  property_id: number;
  bank_account: string | null;
  recipient: string | null;
  monthly_amount: number;
  payment_memo: string | null;
  frequency: string;
  payment_day: number | null;
  include_in_roi: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
  payments: CommonFeePaymentItem[];
}

export interface CommonFeePaymentItem {
  id: number;
  period_date: string;
  paid: boolean;
  paid_date: string | null;
  amount: number | null;
}

// Rental Tax Config
export interface RentalTaxConfigItem {
  id: number;
  property_id: number;
  tax_mode: string;
  is_vat_registered: boolean;
  vat_rate: number | null;
  notes: string | null;
}

// Meter Info
export interface MeterInfoItem {
  id: number;
  property_id: number;
  utility_type: string;
  serial_number: string | null;
  location: string | null;
  notes: string | null;
}

// Chat
export interface ChatMessageItem {
  id: number;
  sender_type: string;
  sender_id?: number;
  message: string;
  is_read: boolean;
  created_at: string | null;
}

// Move-in/out workflow
export interface WorkflowStep {
  id: number;
  step: string;
  status: string;
  data: string | null;
  completed_at: string | null;
}

// Tenant History
export interface TenantHistoryItem {
  id: number;
  tenant_name: string | null;
  tenant_email: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  deposit_amount: number | null;
  deposit_returned: number | null;
  deposit_deductions: number | null;
  deposit_notes: string | null;
  total_payments: number | null;
}

// Enhanced ROI
export interface ROIPropertyEnhanced {
  id: number;
  name: string;
  property_type: string;
  purchase_price: number;
  monthly_rent: number;
  annual_yield: number;
  total_rent_collected: number;
  progress_pct: number;
  breakeven_months: number;
  breakeven_date: string;
  cost_breakdown: {
    maintenance: number;
    property_tax: number;
    common_fees: number;
    rental_income_tax: number;
  };
  total_costs: number;
  tax_mode: string | null;
  monthly_payments: { month: number; amount: number }[];
}

// Reminder
export interface ReminderItem {
  property_name: string;
  type: string;
  deadline: string;
  amount: number;
  bank_account: string | null;
  payment_memo: string | null;
}

// ============ AI Endpoints ============

export const aiExtractTaxPdf = (file: File) => {
  const fd = new FormData(); fd.append('file', file);
  return requestMultipart<{ success: boolean; extracted: any }>('/admin/ai/extract-tax-pdf', fd);
};
export const aiExtractFeePdf = (file: File) => {
  const fd = new FormData(); fd.append('file', file);
  return requestMultipart<{ success: boolean; extracted: any }>('/admin/ai/extract-fee-pdf', fd);
};
export const ocrMeterReading = (photo: File) => {
  const fd = new FormData(); fd.append('photo', photo);
  return requestMultipart<{ success: boolean; value: number | null; confidence: string }>('/ai/ocr-reading', fd);
};

/** OCR meter reading from photo — multi-provider (Claude/Tesseract/OpenAI/Google) */
export const ocrMeterPhoto = (photo: File, role: 'admin' | 'tenant' = 'admin') => {
  const fd = new FormData();
  fd.append('photo', photo);
  const endpoint = role === 'tenant' ? '/tenant/ocr/meter' : '/admin/ocr/meter';
  return requestMultipart<{ value: number | null; confidence: string; raw_text: string; error?: string }>(endpoint, fd);
};

// ============ AI Chat ============

export const aiChat = async (message: string, topic: string, history: { role: string; content: string }[] = []) => {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, topic, history }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'AI hiba');
  return res.json() as Promise<{ success: boolean; reply: string; model: string; usage: { input_tokens: number; output_tokens: number } }>;
};

// ============ Property Tax ============

export const getPropertyTaxes = (propId: number) =>
  request<{ taxes: PropertyTaxItem[] }>(`/admin/properties/${propId}/taxes`);
export const addPropertyTax = (propId: number, data: any) =>
  request<{ success: boolean; id: number }>(`/admin/properties/${propId}/taxes`, { method: 'POST', body: JSON.stringify(data) });
export const editPropertyTax = (taxId: number, data: any) =>
  request<{ success: boolean }>(`/admin/taxes/${taxId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePropertyTax = (taxId: number) =>
  request<{ success: boolean }>(`/admin/taxes/${taxId}`, { method: 'DELETE' });
export const markTaxPaid = (taxId: number, installment: string) =>
  request<{ success: boolean }>(`/admin/taxes/${taxId}/mark-paid`, { method: 'POST', body: JSON.stringify({ installment }) });

// ============ Common Fees ============

export const getPropertyCommonFees = (propId: number) =>
  request<{ fees: CommonFeeItem[] }>(`/admin/properties/${propId}/common-fees`);
export const addCommonFee = (propId: number, data: any) =>
  request<{ success: boolean; id: number }>(`/admin/properties/${propId}/common-fees`, { method: 'POST', body: JSON.stringify(data) });
export const editCommonFee = (feeId: number, data: any) =>
  request<{ success: boolean }>(`/admin/common-fees/${feeId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCommonFee = (feeId: number) =>
  request<{ success: boolean }>(`/admin/common-fees/${feeId}`, { method: 'DELETE' });
export const markCommonFeePaid = (feeId: number, periodDate: string) =>
  request<{ success: boolean }>(`/admin/common-fees/${feeId}/mark-paid`, { method: 'POST', body: JSON.stringify({ period_date: periodDate }) });

// ============ Rental Tax ============

export const getRentalTaxConfig = (propId: number) =>
  request<{ config: RentalTaxConfigItem | null }>(`/admin/properties/${propId}/rental-tax`);
export const saveRentalTaxConfig = (propId: number, data: any) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/rental-tax`, { method: 'PUT', body: JSON.stringify(data) });

// ============ Meter Info ============

export const getPropertyMeters = (propId: number) =>
  request<{ meters: MeterInfoItem[] }>(`/admin/properties/${propId}/meters`);
export const addMeter = (propId: number, data: any) =>
  request<{ success: boolean; id: number }>(`/admin/properties/${propId}/meters`, { method: 'POST', body: JSON.stringify(data) });
export const editMeter = (meterId: number, data: any) =>
  request<{ success: boolean }>(`/admin/meters/${meterId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMeter = (meterId: number) =>
  request<{ success: boolean }>(`/admin/meters/${meterId}`, { method: 'DELETE' });

// ============ Chat - Admin ============

export const getAdminChat = (propId: number) =>
  request<{ messages: ChatMessageItem[]; has_more: boolean }>(`/admin/properties/${propId}/chat`);
export const sendAdminChat = (propId: number, message: string) =>
  request<{ success: boolean; id: number }>(`/admin/properties/${propId}/chat`, { method: 'POST', body: JSON.stringify({ message }) });
export const getAdminChatUnread = () =>
  request<{ unread: Record<string, number> }>('/admin/chat/unread');
export const markAdminChatRead = (propId: number) =>
  request<{ success: boolean }>(`/admin/chat/mark-read/${propId}`, { method: 'POST' });

// ============ Chat - Tenant ============

export const getTenantChat = () =>
  request<{ messages: ChatMessageItem[] }>('/tenant/chat');
export const sendTenantChat = (message: string) =>
  request<{ success: boolean; id: number }>('/tenant/chat', { method: 'POST', body: JSON.stringify({ message }) });
export const getTenantChatUnread = () =>
  request<{ count: number }>('/tenant/chat/unread');

// ============ Reminders ============

export const getTaxReminders = () =>
  request<{ reminders: ReminderItem[] }>('/admin/tax-reminders');
export const getCommonFeeReminders = () =>
  request<{ reminders: ReminderItem[] }>('/admin/common-fee-reminders');

// ============ Move-in Workflow ============

export const startMoveIn = (propId: number, tenantId?: number) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/move-in/start`, { method: 'POST', body: JSON.stringify({ tenant_id: tenantId }) });
export const getMoveInStatus = (propId: number) =>
  request<{ steps: WorkflowStep[] }>(`/admin/properties/${propId}/move-in/status`);
export const saveMoveInStep = (propId: number, step: string, data: any) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/move-in/${step}`, { method: 'POST', body: JSON.stringify({ data }) });
export const completeMoveIn = (propId: number, data: any) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/move-in/complete`, { method: 'POST', body: JSON.stringify(data) });

// ============ Move-out Workflow ============

export const startMoveOut = (propId: number) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/move-out/start`, { method: 'POST' });
export const getMoveOutStatus = (propId: number) =>
  request<{ steps: WorkflowStep[] }>(`/admin/properties/${propId}/move-out/status`);
export const saveMoveOutStep = (propId: number, step: string, data: any) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/move-out/${step}`, { method: 'POST', body: JSON.stringify({ data }) });
export const completeMoveOut = (propId: number, data: any) =>
  request<{ success: boolean }>(`/admin/properties/${propId}/move-out/complete`, { method: 'POST', body: JSON.stringify(data) });

// ============ Tenant History (Admin) ============

export const getPropertyTenantHistory = (propId: number) =>
  request<{ history: TenantHistoryItem[] }>(`/admin/properties/${propId}/tenant-history`);

// ============ Enhanced ROI ============

export const getAdminROIEnhanced = () =>
  request<{ properties: ROIPropertyEnhanced[] }>('/admin/roi-enhanced');

// ============ Smart Meter Types ============

export interface SmartMeterDeviceItem {
  id: number;
  property_id: number;
  utility_type: string;
  device_id: string;
  source: string;
  name: string | null;
  ttn_app_id: string | null;
  mqtt_topic: string | null;
  value_field: string;
  multiplier: number;
  offset: number;
  device_unit: string | null;
  is_active: boolean;
  min_interval_minutes: number;
  last_seen_at: string | null;
  last_raw_value: number | null;
  last_error: string | null;
  meter_info_id: number | null;
  created_at: string | null;
}

export interface SmartMeterLogItem {
  id: number;
  device_id: string;
  source: string;
  parsed_value: number | null;
  final_value: number | null;
  status: string;
  error_message: string | null;
  reading_id: number | null;
  received_at: string;
}

// ============ Smart Meter API ============

export const getPropertySmartMeters = (propId: number) =>
  request<{ devices: SmartMeterDeviceItem[] }>(`/admin/properties/${propId}/smart-meters`);
export const addSmartMeter = (propId: number, data: any) =>
  request<{ success: boolean; id: number }>(`/admin/properties/${propId}/smart-meters`, {
    method: 'POST', body: JSON.stringify(data),
  });
export const editSmartMeter = (deviceDbId: number, data: any) =>
  request<{ success: boolean }>(`/admin/smart-meters/${deviceDbId}`, {
    method: 'PUT', body: JSON.stringify(data),
  });
export const deleteSmartMeter = (deviceDbId: number) =>
  request<{ success: boolean }>(`/admin/smart-meters/${deviceDbId}`, { method: 'DELETE' });
export const getSmartMeterLogs = (deviceDbId: number) =>
  request<{ logs: SmartMeterLogItem[] }>(`/admin/smart-meters/${deviceDbId}/logs`);
export const testSmartMeter = (deviceDbId: number, payload: any) =>
  request<{ success: boolean; parsed_value?: number; final_value?: number; error?: string }>(
    `/admin/smart-meters/${deviceDbId}/test`, { method: 'POST', body: JSON.stringify({ payload }) });
export const getSmartMeterStatus = () =>
  request<{ devices: SmartMeterDeviceItem[]; mqtt_connected: boolean; mqtt_enabled: boolean; ttn_enabled: boolean }>(
    '/admin/smart-meters/status');

// ============ WiFi Networks ============

export interface WifiNetworkItem {
  id: number;
  property_id: number;
  ssid: string;
  password: string | null;
  security_type: string;
  location: string | null;
  is_primary: boolean;
  notes: string | null;
}

// ============ Broadcast Chat ============

export const broadcastChat = (property_ids: number[], message: string) =>
  request<{ success: boolean; count: number }>('/admin/chat/broadcast', {
    method: 'POST',
    body: JSON.stringify({ property_ids, message }),
  });

// ============ Email Settings ============

export const getEmailSettings = () =>
  request<{ enabled: boolean; admin_email: string; smtp_configured: boolean }>('/admin/settings/email');

export const saveEmailSettings = (data: { enabled?: boolean; admin_email?: string }) =>
  request<{ success: boolean }>('/admin/settings/email', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const testEmail = () =>
  request<{ success: boolean }>('/admin/settings/email/test', { method: 'POST' });

// ============ Home Assistant / Tailscale Settings ============

export interface HomeAssistantSettings {
  ha_name: string;
  ha_location: string;
  ha_local_username: string;
  ha_local_password: string;
  ha_base_url: string;
  ha_token: string;
  tailscale_api_token: string;
  tailscale_tailnet: string;
  scope?: 'global' | 'property';
  property_id?: number | null;
}

export interface HomeAssistantEntityItem {
  entity_id: string;
  friendly_name: string;
  unit: string;
  state: string;
  utility_type: 'villany' | 'viz' | 'gaz';
  numeric: boolean;
}

export interface TailscaleDeviceItem {
  id: string;
  name: string;
  hostname: string;
  online: boolean;
  status_reason?: string;
  last_seen?: string;
  ip: string;
  ha_url: string;
  likely_home_assistant: boolean;
}

const homeAssistantScopeQuery = (propertyId?: number) =>
  propertyId ? `?property_id=${propertyId}` : '';

export const getHomeAssistantSettings = (propertyId?: number) =>
  request<HomeAssistantSettings>(`/admin/settings/home-assistant${homeAssistantScopeQuery(propertyId)}`);

export const saveHomeAssistantSettings = (data: Partial<HomeAssistantSettings>, propertyId?: number) =>
  request<{ success: boolean }>(`/admin/settings/home-assistant${homeAssistantScopeQuery(propertyId)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const testHomeAssistantConnection = (propertyId?: number) =>
  request<{ success: boolean; sensor_count: number; total_entities: number }>(`/admin/settings/home-assistant/test${homeAssistantScopeQuery(propertyId)}`, {
    method: 'POST',
  });

export const getHomeAssistantEntities = (propertyId?: number) =>
  request<{ entities: HomeAssistantEntityItem[]; count: number }>(`/admin/settings/home-assistant/entities${homeAssistantScopeQuery(propertyId)}`);

export const getTailscaleDevices = () =>
  request<{ devices: TailscaleDeviceItem[]; count: number }>('/admin/settings/home-assistant/tailscale/devices');

export const importHomeAssistantMeters = (
  propId: number,
  entities: Array<{ entity_id: string; utility_type?: 'villany' | 'viz' | 'gaz'; name?: string }>
) =>
  request<{
    success: boolean;
    created: Array<{ id: number; device_id: string; entity_id: string; utility_type: string }>;
    verify: Array<{ entity_id: string; device_id: string; ok: boolean; reason?: string; reading_id?: number }>;
  }>(`/admin/properties/${propId}/smart-meters/import-home-assistant`, {
    method: 'POST',
    body: JSON.stringify({ entities }),
  });

export const backfillHomeAssistantMonthly = (
  propId: number,
  data?: { months_back?: number; until_data_start?: boolean; device_ids?: number[] }
) =>
  request<{
    success: boolean;
    months_back: number;
    created: number;
    skipped: number;
    devices: Array<{ device_id: string; entity_id: string; utility_type: string; created: number; skipped: number }>;
    skipped_devices: Array<{ device_id: string; reason: string }>;
    errors: Array<{ device_id: string; entity_id: string; reading_date: string; error: string }>;
  }>(`/admin/properties/${propId}/smart-meters/backfill-home-assistant`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });

// ============ WiFi Networks ============

export const getPropertyWifi = (propId: number) =>
  request<{ networks: WifiNetworkItem[] }>(`/admin/properties/${propId}/wifi`);
export const addWifi = (propId: number, data: any) =>
  request<{ success: boolean; id: number }>(`/admin/properties/${propId}/wifi`, { method: 'POST', body: JSON.stringify(data) });
export const editWifi = (wifiId: number, data: any) =>
  request<{ success: boolean }>(`/admin/wifi/${wifiId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteWifi = (wifiId: number) =>
  request<{ success: boolean }>(`/admin/wifi/${wifiId}`, { method: 'DELETE' });
