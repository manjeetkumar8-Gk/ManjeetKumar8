import Dexie, { type Table } from "dexie";

export interface LocalUser {
  id: number;
  shop_id: number | null;
  username: string;
  name?: string;
  email?: string;
  role_name?: string;
  token?: string;
  password?: string;
}

export interface LocalCompany {
  id: number;
  shop_id: number;
  company_name: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  remarks?: string;
  status?: string;
  created_at?: string;
}

export interface LocalProduct {
  id: number;
  shop_id: number;
  company_id: number;
  company_name?: string;
  product_name: string;
  pack_size?: string | number | null;
  size_unit?: string | null;
  stock_unit?: string | null;
  product_code?: string | null;
  unit?: string | null;
  status?: string;
  created_at?: string;
}

export interface LocalCustomer {
  id: number;
  shop_id: number;
  customer_name: string;
  phone?: string;
  address?: string;
  remarks?: string;
  status?: string;
  created_at?: string;
}

export interface LocalWarehouse {
  id: number;
  shop_id: number;
  warehouse_name: string;
  address?: string;
  status?: string;
  created_at?: string;
}

export interface LocalVehicle {
  id: number;
  shop_id: number;
  vehicle_number: string;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_contact?: string | null;
  status?: string;
  created_at?: string;
}

export interface LocalStockRecord {
  id: number;
  shop_id: number;
  stock_date: string;
  product_id: number;
  company_id?: number;
  customer_id?: number | null;
  warehouse_id?: number | null;
  vehicle_id?: number | null;
  type: "IN" | "OUT";
  quantity: number;
  unit?: string | null;
  voucher_number?: string | null;
  challan_number?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_contact?: string | null;
  remarks?: string | null;
  product_name?: string;
  company_name?: string;
  customer_name?: string;
  warehouse_name?: string;
  created_at?: string;
}

export interface SyncQueueItem {
  id?: number;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  payload: any;
  created_at: string;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  error?: string;
}

export class SyncoraDatabase extends Dexie {
  users!: Table<LocalUser, number>;
  companies!: Table<LocalCompany, number>;
  products!: Table<LocalProduct, number>;
  customers!: Table<LocalCustomer, number>;
  warehouses!: Table<LocalWarehouse, number>;
  vehicles!: Table<LocalVehicle, number>;
  stock_records!: Table<LocalStockRecord, number>;
  sync_queue!: Table<SyncQueueItem, number>;

  constructor() {
    super("SyncoraOfflineDB");

    this.version(1).stores({
      users: "++id, username, email, shop_id",
      companies: "++id, shop_id, company_name, status",
      products: "++id, shop_id, company_id, product_name, status",
      customers: "++id, shop_id, customer_name, status",
      warehouses: "++id, shop_id, warehouse_name, status",
      vehicles: "++id, shop_id, vehicle_number, status",
      stock_records: "++id, shop_id, type, product_id, company_id, stock_date",
      sync_queue: "++id, status, created_at, entity",
    });
  }
}

export const offlineDb = new SyncoraDatabase();
