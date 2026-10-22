import { offlineDb } from "./db";

export async function seedOfflineDbIfEmpty() {
  try {
    const defaultPassword = "szabist100campus";
    const defaultUsers = [
      {
        id: 1,
        shop_id: 1,
        username: "admin",
        name: "Super Administrator",
        email: "admin@syncora.com",
        role_name: "Super Admin",
        token: "offline-superadmin-token-2026",
        password: defaultPassword,
      },
      {
        id: 2,
        shop_id: 1,
        username: "shopadmin",
        name: "Shop Administrator",
        email: "shopadmin@syncora.com",
        role_name: "Shop Admin",
        token: "offline-shopadmin-token-2026",
        password: defaultPassword,
      },
      {
        id: 3,
        shop_id: 1,
        username: "operator",
        name: "Stock Operator",
        email: "operator@syncora.com",
        role_name: "Stock Operator",
        token: "offline-operator-token-2026",
        password: defaultPassword,
      },
      {
        id: 4,
        shop_id: 1,
        username: "viewer",
        name: "Inventory Viewer",
        email: "viewer@syncora.com",
        role_name: "Viewer",
        token: "offline-viewer-token-2026",
        password: defaultPassword,
      },
    ];

    const userCount = await offlineDb.users.count();
    if (userCount === 0) {
      await offlineDb.users.bulkAdd(defaultUsers);
    } else {
      // Ensure default users have passwords populated
      for (const du of defaultUsers) {
        const existing = await offlineDb.users.where("username").equalsIgnoreCase(du.username).first();
        if (existing && !existing.password) {
          await offlineDb.users.update(existing.id, { password: defaultPassword });
        }
      }
    }

    const companyCount = await offlineDb.companies.count();
    if (companyCount === 0) {
      await offlineDb.companies.add({
        id: 1,
        shop_id: 1,
        company_name: "General Supplies Co.",
        contact_person: "Operations Manager",
        phone: "+1 555-0199",
        status: "active",
      });
    }

    const warehouseCount = await offlineDb.warehouses.count();
    if (warehouseCount === 0) {
      await offlineDb.warehouses.add({
        id: 1,
        shop_id: 1,
        warehouse_name: "Central Warehouse",
        address: "Main Storage Facility",
        status: "active",
      });
    }
  } catch (error) {
    console.warn("Could not seed offline database:", error);
  }
}
