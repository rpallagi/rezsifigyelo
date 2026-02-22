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

// ============ Auth ============

export const tenantLogin = (property_id: number, pin: string) =>
  request<{ success: boolean; property: TenantProperty }>('/tenant/login', {
    method: 'POST',
    body: JSON.stringify({ property_id, pin }),
  });

export const tenantLogout = () =>
  request<{ success: boolean }>('/tenant/logout', { method: 'POST' });

export const tenantSession = () =>
  request<{ logged_in: boolean; property?: TenantProperty }>('/tenant/session');

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

export const getAdminMaintenance = () =>
  request<{ logs: MaintenanceItem[] }>('/admin/maintenance');

export const addMaintenance = (data: Record<string, any>) =>
  request<{ success: boolean }>('/admin/maintenance', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getAdminTodos = () =>
  request<{ todos: TodoItem[] }>('/admin/todos');

export const addTodo = (data: Record<string, any>) =>
  request<{ success: boolean }>('/admin/todos', {
    method: 'POST',
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
  tariffs: {
    villany: TariffInfo | null;
    viz: TariffInfo | null;
    csatorna: TariffInfo | null;
  };
  monthly_total: number;
  sparklines: {
    villany: number[];
    viz: number[];
  };
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
  annual_yield: number;
  breakeven_months: number;
  breakeven_date: string;
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
