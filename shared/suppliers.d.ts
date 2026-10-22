export type SupplierStatus = 'pending_payment' | 'active' | 'expired' | 'suspended';
export interface SupplierCategory { id: string; name: string; icon: string; styles: string[] }
export declare const SUPPLIER_CATEGORIES: SupplierCategory[];
export declare const SUPPLIER_PRICE_RANGES: { id: string; name: string }[];
export declare const SUPPLIER_STATUSES: SupplierStatus[];
export declare const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string>;
export declare function supplierCategoryName(id?: string): string;
export declare const CATEGORY_IDS: string[];
export declare const ALL_STYLES: string[];
