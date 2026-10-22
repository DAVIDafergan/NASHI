// API client for the supplier directory, paid supplier signup and the events agent (admin).
const API_URL: string = (import.meta as any).env?.VITE_API_URL || 'https://nashi-production.up.railway.app/api';

export interface Supplier {
  id: string;
  businessName: string; contactName: string; phone: string; whatsapp?: string; email: string;
  website?: string; instagram?: string; facebook?: string;
  nationwide: boolean; regions: string[]; cities: string[]; servedRegions?: string[];
  categories: string[]; styles: string[]; description: string; priceRange?: string; priceNote?: string;
  logo?: string; gallery: string[]; createdAt?: string;
  // own / admin views
  status?: 'pending_payment' | 'active' | 'expired' | 'suspended'; statusNote?: string; listed?: boolean;
  subscription?: { provider: string; currentPeriodEnd: string | null; lastPaymentAt: string | null; cancelAtPeriodEnd: boolean };
  payments?: { at: string; amount?: number; provider: string; note?: string }[];
  views?: number;
}

export interface SupplierMeta {
  categories: { id: string; name: string; icon: string; styles: string[] }[];
  priceRanges: { id: string; name: string }[];
  monthlyPrice: number | null;
  currency: string;
  provider: { id: string; label: string };
}

export type Checkout = { kind: 'manual'; instructions: string[]; contactPhone?: string | null } | { kind: 'redirect'; url: string; reference?: string };

const auth = () => {
  const t = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
const supplierHeaders = (token: string) => ({ 'Content-Type': 'application/json', 'X-Supplier-Token': token });

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_URL}${path}`, init); }
  catch { throw new Error('אין חיבור לשרת. בדקו את החיבור ונסו שוב.'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(json.error || 'הפעולה נכשלה'); e.status = res.status; throw e; }
  return json as T;
}

export const suppliersApi = {
  meta: () => call<SupplierMeta>('/suppliers/meta'),
  signup: (body: any) => call<{ supplier: Supplier; token: string }>('/suppliers/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  requestLink: (email: string) => call<{ success: boolean }>('/suppliers/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }),
  me: (token: string) => call<{ supplier: Supplier }>('/suppliers/me', { headers: supplierHeaders(token) }),
  updateMe: (token: string, body: any) => call<{ supplier: Supplier }>('/suppliers/me', { method: 'PUT', headers: supplierHeaders(token), body: JSON.stringify(body) }),
  checkout: (token: string) => call<{ provider: { id: string; label: string }; monthlyPrice: number | null; checkout: Checkout }>('/suppliers/me/checkout', { method: 'POST', headers: supplierHeaders(token) }),
  cancel: (token: string) => call<{ ok: boolean; note?: string; supplier: Supplier }>('/suppliers/me/cancel', { method: 'POST', headers: supplierHeaders(token) }),

  // culture managers
  directory: (params: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== 'all')).toString();
    return call<{ suppliers: Supplier[]; total: number }>(`/suppliers${q ? `?${q}` : ''}`, { headers: auth() });
  },
  get: (id: string) => call<{ supplier: Supplier }>(`/suppliers/${id}`, { headers: auth() }),

  // admin
  adminList: (status = '') => call<{ suppliers: Supplier[]; provider: string; monthlyPrice: number | null }>(`/admin/suppliers${status ? `?status=${status}` : ''}`, { headers: auth() }),
  markPaid: (id: string, months = 1, note = '') => call<{ supplier: Supplier }>(`/admin/suppliers/${id}/mark-paid`, { method: 'POST', headers: auth(), body: JSON.stringify({ months, note }) }),
  suspend: (id: string, note = '') => call<{ supplier: Supplier }>(`/admin/suppliers/${id}/suspend`, { method: 'POST', headers: auth(), body: JSON.stringify({ note }) }),
  activate: (id: string) => call<{ supplier: Supplier }>(`/admin/suppliers/${id}/activate`, { method: 'POST', headers: auth() }),
  sendLink: (id: string) => call<{ sent: boolean; link: string }>(`/admin/suppliers/${id}/send-link`, { method: 'POST', headers: auth() }),
  remove: (id: string) => call<{ success: boolean }>(`/admin/suppliers/${id}`, { method: 'DELETE', headers: auth() }),
};

export interface ImportRun {
  _id: string; trigger: string; status: 'running' | 'done' | 'failed'; startedAt: string; finishedAt?: string;
  counts: { discovered: number; created: number; updated: number; unchanged: number; skipped: number; hidden: number; failed: number };
  sources: { id: string; name: string; discovered: number; created: number; updated: number; skipped: number; failed: number; error?: string }[];
  skipped: { source: string; sourceId: string; title: string; url: string; reason: string }[];
  errorMessages: string[];
}
export interface ImporterStatus {
  enabled: boolean; intervalHours: number; running: boolean; nextAt: string | null;
  runs: ImportRun[]; totals: { visible: number; hidden: number; blocked: number };
  sources: { id: string; name: string; status: 'active' | 'discovery' | 'todo' | 'skip'; note: string }[];
}

export const importerApi = {
  status: () => call<ImporterStatus>('/admin/importer/status', { headers: auth() }),
  run: () => call<{ started: boolean }>('/admin/importer/run', { method: 'POST', headers: auth() }),
  events: (status: 'all' | 'visible' | 'hidden' = 'all') => call<any[]>(`/admin/importer/events?status=${status}`, { headers: auth() }),
  setHidden: (id: string, hide: boolean) => call<{ hidden: boolean }>(`/admin/importer/events/${id}/${hide ? 'hide' : 'unhide'}`, { method: 'POST', headers: auth() }),
  remove: (id: string) => call<{ success: boolean }>(`/admin/importer/events/${id}`, { method: 'DELETE', headers: auth() }),
};

/** Who counts as a culture manager on the site (mirrors server/auth.js). */
export const isCultureManager = (u: any) => !!u && (u.isAdmin === true || u.role === 'regionAdmin');
