import { apiGet, apiPost, apiPatch } from './api';

export const ITEM_TYPES = ['DRUG', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'] as const;
export const TXN_TYPES = ['STOCK_IN', 'DISPENSE', 'ADJUSTMENT', 'RETURN', 'EXPIRY'] as const;

export interface Batch {
  id: string;
  itemId: string;
  supplierId: string | null;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  unitCost: number;
  salePrice: number;
  item?: { name: string; unit: string };
  supplier?: { name: string } | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  sku: string | null;
  lowStockThreshold: number;
  active: boolean;
  batches: Batch[];
  totalStock: number;
  earliestExpiry: string | null;
  status: 'OPTIMAL' | 'LOW' | 'OUT';
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  batchId: string | null;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export interface InventoryAlerts {
  lowStock: { id: string; name: string; totalStock: number; status: string; threshold: number }[];
  expiringBatches: {
    id: string;
    itemName: string;
    batchNumber: string;
    expiryDate: string | null;
    quantity: number;
    expired: boolean;
  }[];
}

export interface InventoryStats {
  itemCount: number;
  stockValue: number;
  lowStockCount: number;
  expiringBatches: number;
  pendingPurchases: number;
  movementsToday: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
  _count?: { purchases: number };
  purchases?: PurchaseOrder[];
}

export interface PurchaseItem {
  id: string;
  itemId: string;
  batchId: string | null;
  quantity: number;
  unitCost: number;
  item?: { id: string; name: string; unit: string; sku: string | null } | null;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  invoiceRef: string | null;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  createdAt: string;
  items: PurchaseItem[];
  supplier?: { id: string; name: string; contact: string | null };
  totalQuantity: number;
  totalValue: number;
}

export const inventoryApi = {
  listItems: (t: string, q?: string) =>
    apiGet<InventoryItem[]>(`/inventory/items${q ? `?q=${encodeURIComponent(q)}` : ''}`, t),
  getItem: (t: string, id: string) => apiGet<InventoryItem>(`/inventory/items/${id}`, t),
  createItem: (
    t: string,
    body: { name: string; type?: string; unit?: string; sku?: string; lowStockThreshold?: number },
  ) => apiPost<InventoryItem>('/inventory/items', body, t),
  updateItem: (t: string, id: string, body: Record<string, unknown>) =>
    apiPatch<InventoryItem>(`/inventory/items/${id}`, body, t),
  listBatches: (t: string, itemId?: string) =>
    apiGet<Batch[]>(`/inventory/batches${itemId ? `?itemId=${itemId}` : ''}`, t),
  stockIn: (
    t: string,
    body: {
      itemId: string;
      supplierId?: string;
      batchNumber: string;
      expiryDate?: string;
      quantity: number;
      unitCost?: number;
      salePrice: number;
    },
  ) => apiPost<Batch>('/inventory/stock-in', body, t),
  adjust: (t: string, body: { batchId: string; delta: number; reason: string }) =>
    apiPost<{ id: string; quantity: number }>('/inventory/adjustments', body, t),
  alerts: (t: string) => apiGet<InventoryAlerts>('/inventory/alerts', t),
  stats: (t: string) => apiGet<InventoryStats>('/inventory/stats', t),
  transactions: (t: string, params: Record<string, string> = {}) =>
    apiGet<InventoryTransaction[]>(`/inventory/transactions${qs(params)}`, t),
};

export const supplierApi = {
  list: (t: string, q?: string) =>
    apiGet<Supplier[]>(`/inventory/suppliers${q ? `?q=${encodeURIComponent(q)}` : ''}`, t),
  get: (t: string, id: string) => apiGet<Supplier>(`/inventory/suppliers/${id}`, t),
  create: (t: string, body: { name: string; contact?: string; address?: string }) =>
    apiPost<Supplier>('/inventory/suppliers', body, t),
  update: (t: string, id: string, body: { name?: string; contact?: string; address?: string; active?: boolean }) =>
    apiPatch<Supplier>(`/inventory/suppliers/${id}`, body, t),
};

export const purchaseApi = {
  list: (t: string, params: Record<string, string> = {}) =>
    apiGet<PurchaseOrder[]>(`/inventory/purchases${qs(params)}`, t),
  get: (t: string, id: string) => apiGet<PurchaseOrder>(`/inventory/purchases/${id}`, t),
  create: (
    t: string,
    body: {
      supplierId: string;
      invoiceRef?: string;
      status?: string;
      items: { itemId: string; quantity: number; unitCost: number }[];
    },
  ) => apiPost<PurchaseOrder>('/inventory/purchases', body, t),
  update: (t: string, id: string, body: Record<string, unknown>) =>
    apiPatch<PurchaseOrder>(`/inventory/purchases/${id}`, body, t),
  cancel: (t: string, id: string, reason: string) =>
    apiPost<PurchaseOrder>(`/inventory/purchases/${id}/cancel`, { reason }, t),
  receive: (
    t: string,
    id: string,
    body: {
      lines: {
        purchaseOrderItemId: string;
        receivedQuantity: number;
        batchNumber: string;
        expiryDate?: string;
        salePrice: number;
      }[];
    },
  ) => apiPost<PurchaseOrder>(`/inventory/purchases/${id}/receive`, body, t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}
