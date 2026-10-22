import { smartApiRequest } from "../offline/offlineApi";
import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportPdfFile, exportCsvFile } from "../utils/exportReport";

type ReportType =
  | "CURRENT_STOCK"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "STOCK_LEDGER"
  | "SUMMARY"
  | "LOW_STOCK"
  | "COMPANY"
  | "CUSTOMER"
  | "PRODUCT_MOVEMENT"
  | "VOUCHER"
  | "ALL";

type PeriodType = "TODAY" | "MONTH" | "YEAR" | "CUSTOM";
type SummaryPeriod = "DAY" | "MONTH" | "YEAR";

type StockRecord = {
  id: number;
  stock_date: string;
  quantity: number | string;
  product_id?: number;
  company_id?: number;
  customer_id?: number;
  product_name?: string;
  company_name?: string;
  customer_name?: string | null;
  voucher_number?: string | null;
  challan_number?: string | null;
  vehicle_number?: string | null;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_contact?: string | null;
  unit?: string | null;
  remarks?: string | null;
};

type Transaction = StockRecord & {
  direction: "IN" | "OUT";
};

type DisplayRow = {
  date: string;
  type: string;
  voucher: string;
  company: string;
  product: string;
  customer: string;
  quantity: number;
  unit: string;
  balance: number | string;
  vehicle: string;
  driver: string;
  contact: string;
  details: string;
};

import { API as API_BASE } from "../config/api";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "CURRENT_STOCK", label: "1. Current Stock Report" },
  { value: "STOCK_IN", label: "2. Stock IN Report" },
  { value: "STOCK_OUT", label: "3. Stock OUT Report" },
  { value: "STOCK_LEDGER", label: "4. Stock Ledger Report" },
  { value: "SUMMARY", label: "5. Daily / Monthly / Yearly Summary" },
  { value: "LOW_STOCK", label: "6. Low Stock Report" },
  { value: "COMPANY", label: "7. Company-wise Report" },
  { value: "CUSTOMER", label: "8. Customer-wise Report" },
  { value: "PRODUCT_MOVEMENT", label: "9. Product-wise Movement Report" },
  { value: "VOUCHER", label: "10. Voucher Report" },
  { value: "ALL", label: "11. Complete Transaction Report" },
];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function quantityOf(record: StockRecord) {
  const quantity = Number(record.quantity || 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

function blankRow(overrides: Partial<DisplayRow> = {}): DisplayRow {
  return {
    date: "",
    type: "",
    voucher: "",
    company: "",
    product: "",
    customer: "",
    quantity: 0,
    unit: "",
    balance: "",
    vehicle: "",
    driver: "",
    contact: "",
    details: "",
    ...overrides,
  };
}

function transactionToRow(record: Transaction): DisplayRow {
  return blankRow({
    date: record.stock_date,
    type: record.direction,
    voucher:
      record.direction === "IN"
        ? record.challan_number || ""
        : record.voucher_number || "",
    company: record.company_name || "",
    product: record.product_name || "",
    customer: record.direction === "OUT" ? record.customer_name || "" : "",
    quantity: quantityOf(record),
    unit: record.unit || "",
    vehicle: record.vehicle_number || "",
    driver: record.driver_name || "",
    contact: record.driver_contact || "",
    details: record.remarks || "",
  });
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function Reports() {
  const today = isoDate(new Date());
  const firstDay = `${today.slice(0, 8)}01`;
  

  const [reportType, setReportType] = useState<ReportType>("ALL");
  const [period, setPeriod] = useState<PeriodType>("MONTH");
  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(today);
  const [summaryPeriod, setSummaryPeriod] =
    useState<SummaryPeriod>("DAY");
  const [lowStockLimit, setLowStockLimit] = useState("10");

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const [stockIn, setStockIn] = useState<StockRecord[]>([]);
  const [stockOut, setStockOut] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      setError("No active session found. Please log in again.");
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [inJson, outJson] = await Promise.all([
        smartApiRequest("/stock/in"),
        smartApiRequest("/stock/out"),
      ]);

      // Data retrieved from smart API / offline cache

      if (inJson.success === false || outJson.success === false) {
        throw new Error(
          inJson.message ||
            outJson.message ||
            "Failed to load report data."
        );
      }

      const incoming = Array.isArray(inJson.data)
        ? inJson.data
        : Array.isArray(inJson)
          ? inJson
          : [];

      const outgoing = Array.isArray(outJson.data)
        ? outJson.data
        : Array.isArray(outJson)
          ? outJson
          : [];

      setStockIn(incoming);
      setStockOut(outgoing);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const allTransactions = useMemo<Transaction[]>(() => {
    const incoming = stockIn.map((record) => ({
      ...record,
      direction: "IN" as const,
    }));

    const outgoing = stockOut.map((record) => ({
      ...record,
      direction: "OUT" as const,
    }));

    return [...incoming, ...outgoing].sort(
      (a, b) =>
        String(a.stock_date).localeCompare(String(b.stock_date)) ||
        a.id - b.id
    );
  }, [stockIn, stockOut]);

  const allCompanies = useMemo(
    () =>
      Array.from(
        new Set(
          allTransactions
            .map((record) => record.company_name)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [allTransactions]
  );

  const allProducts = useMemo(
    () =>
      Array.from(
        new Set(
          allTransactions
            .map((record) => record.product_name)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [allTransactions]
  );

  const allCustomers = useMemo(
    () =>
      Array.from(
        new Set(
          stockOut
            .map((record) => record.customer_name)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [stockOut]
  );

  const dateTransactions = useMemo(() => {
    return allTransactions.filter((record) => {
      const date = String(record.stock_date || "").slice(0, 10);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }, [allTransactions, fromDate, toDate]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return dateTransactions.filter((record) => {
      if (reportType === "STOCK_IN" && record.direction !== "IN") {
        return false;
      }

      if (reportType === "STOCK_OUT" && record.direction !== "OUT") {
        return false;
      }

      if (reportType === "CUSTOMER" && record.direction !== "OUT") {
        return false;
      }

      if (reportType === "VOUCHER") {
        const voucher =
          record.direction === "IN"
            ? record.challan_number
            : record.voucher_number;

        if (!voucher) return false;
      }

      if (
        companyFilter &&
        record.company_name !== companyFilter
      ) {
        return false;
      }

      if (
        productFilter &&
        record.product_name !== productFilter
      ) {
        return false;
      }

      if (
        customerFilter &&
        (record.direction !== "OUT" ||
          record.customer_name !== customerFilter)
      ) {
        return false;
      }

      if (!query) return true;

      return [
        record.product_name,
        record.company_name,
        record.customer_name,
        record.vehicle_number,
        record.voucher_number,
        record.challan_number,
        record.driver_name,
        record.driver_contact,
        record.remarks,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
  }, [
    dateTransactions,
    reportType,
    companyFilter,
    productFilter,
    customerFilter,
    search,
  ]);

  // Current balance is estimated from all loaded IN/OUT transactions.
  // This is accurate only if the API returns the complete stock history.
  const stockBalances = useMemo(() => {
    const balances = new Map<
      string,
      {
        product: string;
        company: string;
        unit: string;
        inQty: number;
        outQty: number;
        balance: number;
      }
    >();

    for (const record of allTransactions) {
      const product = record.product_name || "Unknown product";
      const key = `${record.product_id ?? product}|${record.unit || ""}`;

      const item = balances.get(key) || {
        product,
        company: record.company_name || "",
        unit: record.unit || "",
        inQty: 0,
        outQty: 0,
        balance: 0,
      };

      const quantity = quantityOf(record);

      if (record.direction === "IN") {
        item.inQty += quantity;
        item.balance += quantity;
      } else {
        item.outQty += quantity;
        item.balance -= quantity;
      }

      if (record.company_name) item.company = record.company_name;

      balances.set(key, item);
    }

    return Array.from(balances.values()).sort((a, b) =>
      a.product.localeCompare(b.product)
    );
  }, [allTransactions]);

  const totalIn = useMemo(
    () =>
      filteredTransactions
        .filter((record) => record.direction === "IN")
        .reduce((sum, record) => sum + quantityOf(record), 0),
    [filteredTransactions]
  );

  const totalOut = useMemo(
    () =>
      filteredTransactions
        .filter((record) => record.direction === "OUT")
        .reduce((sum, record) => sum + quantityOf(record), 0),
    [filteredTransactions]
  );

  const reportRows = useMemo<DisplayRow[]>(() => {
    const transactionRows = filteredTransactions.map(transactionToRow);

    if (reportType === "CURRENT_STOCK") {
      return stockBalances
        .filter((item) => {
          if (companyFilter && item.company !== companyFilter) return false;
          if (productFilter && item.product !== productFilter) return false;

          const query = search.trim().toLowerCase();
          if (
            query &&
            !`${item.product} ${item.company}`.toLowerCase().includes(query)
          ) {
            return false;
          }

          return true;
        })
        .map((item) =>
          blankRow({
            date: today,
            type: "BALANCE",
            company: item.company,
            product: item.product,
            quantity: item.balance,
            unit: item.unit,
            balance: item.balance,
            details: `Total IN: ${item.inQty}; Total OUT: ${item.outQty}`,
          })
        );
    }

    if (reportType === "LOW_STOCK") {
      const limit = Math.max(0, Number(lowStockLimit) || 0);

      return stockBalances
        .filter((item) => item.balance <= limit)
        .filter((item) => !companyFilter || item.company === companyFilter)
        .filter((item) => !productFilter || item.product === productFilter)
        .filter((item) => {
          const query = search.trim().toLowerCase();
          return (
            !query ||
            `${item.product} ${item.company}`
              .toLowerCase()
              .includes(query)
          );
        })
        .map((item) =>
          blankRow({
            date: today,
            type: "LOW STOCK",
            company: item.company,
            product: item.product,
            quantity: item.balance,
            unit: item.unit,
            balance: item.balance,
            details: `Threshold: ${limit}; IN: ${item.inQty}; OUT: ${item.outQty}`,
          })
        );
    }

    if (reportType === "STOCK_LEDGER") {
      const running = new Map<string, number>();

      return [...filteredTransactions]
        .sort(
          (a, b) =>
            String(a.stock_date).localeCompare(String(b.stock_date)) ||
            a.id - b.id
        )
        .map((record) => {
          const key = `${record.product_id ?? record.product_name ?? "Unknown"}|${record.unit || ""}`;
          const previous = running.get(key) || 0;
          const quantity = quantityOf(record);
          const balance =
            previous + (record.direction === "IN" ? quantity : -quantity);

          running.set(key, balance);

          return {
            ...transactionToRow(record),
            balance,
          };
        });
    }

    if (reportType === "SUMMARY") {
      const groups = new Map<
        string,
        { inQty: number; outQty: number; count: number }
      >();

      for (const record of filteredTransactions) {
        const date = String(record.stock_date || "").slice(0, 10);
        const key =
          summaryPeriod === "YEAR"
            ? date.slice(0, 4)
            : summaryPeriod === "MONTH"
              ? date.slice(0, 7)
              : date;

        const group = groups.get(key) || {
          inQty: 0,
          outQty: 0,
          count: 0,
        };

        if (record.direction === "IN") {
          group.inQty += quantityOf(record);
        } else {
          group.outQty += quantityOf(record);
        }

        group.count += 1;
        groups.set(key, group);
      }

      return Array.from(groups.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, group]) =>
          blankRow({
            date,
            type: "SUMMARY",
            product: `${group.count} transaction(s)`,
            quantity: group.inQty - group.outQty,
            balance: group.inQty - group.outQty,
            details: `IN: ${group.inQty}; OUT: ${group.outQty}; Net: ${group.inQty - group.outQty}`,
          })
        );
    }

    if (reportType === "COMPANY") {
      const groups = new Map<
        string,
        { inQty: number; outQty: number; count: number }
      >();

      for (const record of filteredTransactions) {
        const key = record.company_name || "Unspecified company";
        const group = groups.get(key) || {
          inQty: 0,
          outQty: 0,
          count: 0,
        };

        if (record.direction === "IN") {
          group.inQty += quantityOf(record);
        } else {
          group.outQty += quantityOf(record);
        }

        group.count += 1;
        groups.set(key, group);
      }

      return Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([company, group]) =>
          blankRow({
            type: "COMPANY",
            company,
            quantity: group.inQty - group.outQty,
            balance: group.inQty - group.outQty,
            details: `IN: ${group.inQty}; OUT: ${group.outQty}; Transactions: ${group.count}`,
          })
        );
    }

    if (reportType === "CUSTOMER") {
      const groups = new Map<string, { quantity: number; count: number }>();

      for (const record of filteredTransactions) {
        const customer = record.customer_name || "Unspecified customer";
        const group = groups.get(customer) || { quantity: 0, count: 0 };

        group.quantity += quantityOf(record);
        group.count += 1;
        groups.set(customer, group);
      }

      return Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([customer, group]) =>
          blankRow({
            type: "CUSTOMER",
            customer,
            quantity: group.quantity,
            details: `${group.count} transaction(s)`,
          })
        );
    }

    if (reportType === "PRODUCT_MOVEMENT") {
      const groups = new Map<
        string,
        {
          inQty: number;
          outQty: number;
          count: number;
          unit: string;
          company: string;
        }
      >();

      for (const record of filteredTransactions) {
        const product = record.product_name || "Unknown product";
        const key = `${record.product_id ?? product}|${record.unit || ""}`;

        const group = groups.get(key) || {
          inQty: 0,
          outQty: 0,
          count: 0,
          unit: record.unit || "",
          company: record.company_name || "",
        };

        if (record.direction === "IN") {
          group.inQty += quantityOf(record);
        } else {
          group.outQty += quantityOf(record);
        }

        group.count += 1;
        groups.set(key, group);
      }

      return Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group]) => {
          const product = filteredTransactions.find(
            (record) =>
              `${record.product_id ?? record.product_name ?? "Unknown"}|${record.unit || ""}` === key
          )?.product_name || key.split("|")[0];

          return blankRow({
            type: "PRODUCT",
            product,
            company: group.company,
            quantity: group.inQty - group.outQty,
            unit: group.unit,
            balance: group.inQty - group.outQty,
            details: `IN: ${group.inQty}; OUT: ${group.outQty}; Transactions: ${group.count}`,
          });
        });
    }

    return transactionRows.sort(
      (a, b) =>
        String(b.date).localeCompare(String(a.date)) ||
        b.type.localeCompare(a.type)
    );
  }, [
    reportType,
    filteredTransactions,
    stockBalances,
    companyFilter,
    productFilter,
    search,
    lowStockLimit,
    summaryPeriod,
    today,
  ]);

  const changePeriod = (value: PeriodType) => {
    setPeriod(value);

    const now = new Date();
    const currentDay = isoDate(now);

    if (value === "TODAY") {
      setFromDate(currentDay);
      setToDate(currentDay);
    } else if (value === "MONTH") {
      setFromDate(`${currentDay.slice(0, 8)}01`);
      setToDate(currentDay);
    } else if (value === "YEAR") {
      setFromDate(`${currentDay.slice(0, 4)}-01-01`);
      setToDate(currentDay);
    } else {
      setFromDate("");
      setToDate("");
    }
  };

  const resetFilters = () => {
    setReportType("ALL");
    setPeriod("MONTH");
    setFromDate(firstDay);
    setToDate(today);
    setSummaryPeriod("DAY");
    setLowStockLimit("10");
    setSearch("");
    setCompanyFilter("");
    setProductFilter("");
    setCustomerFilter("");
    setNotice("");
    setError("");
  };

  const exportCsv = async () => {
    if (!reportRows.length) {
      setNotice("No records available to export.");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Voucher / Challan",
      "Company",
      "Product",
      "Customer",
      "Quantity",
      "Unit",
      "Balance",
      "Vehicle",
      "Driver",
      "Driver Contact",
      "Details",
    ];

    const lines = [
      headers.map(escapeCsv).join(","),
      ...reportRows.map((row) =>
        [
          row.date,
          row.type,
          row.voucher,
          row.company,
          row.product,
          row.customer,
          row.quantity,
          row.unit,
          row.balance,
          row.vehicle,
          row.driver,
          row.contact,
          row.details,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];

    const res = await exportCsvFile(
      lines.join("\r\n"),
      `stock-report-${reportType.toLowerCase()}-${today}.csv`,
      `Stock Report - ${reportType}`
    );
    setNotice(res.message);
  };

  const exportPdf = async () => {
    if (!reportRows.length) {
      setNotice("No records available to export.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const selectedLabel =
      REPORT_OPTIONS.find((option) => option.value === reportType)?.label ||
      "Stock Report";

    doc.setFontSize(17);
    doc.text(selectedLabel, 14, 15);
    doc.setFontSize(9);
    doc.text(
      `Period: ${fromDate || "All dates"} to ${toDate || "All dates"}`,
      14,
      22
    );
    doc.text(
      `Rows: ${reportRows.length} | Stock IN: ${totalIn} | Stock OUT: ${totalOut} | Net: ${totalIn - totalOut}`,
      14,
      28
    );

    autoTable(doc, {
      startY: 33,
      head: [[
        "Date",
        "Type",
        "Voucher",
        "Company",
        "Product",
        "Customer",
        "Quantity",
        "Unit",
        "Balance",
        "Vehicle",
        "Driver",
        "Contact",
        "Details",
      ]],
      body: reportRows.map((row) => [
        row.date ? formatDate(row.date) : "—",
        row.type || "—",
        row.voucher || "—",
        row.company || "—",
        row.product || "—",
        row.customer || "—",
        row.quantity,
        row.unit || "—",
        row.balance === "" ? "—" : row.balance,
        row.vehicle || "—",
        row.driver || "—",
        row.contact || "—",
        row.details || "—",
      ]),
      styles: { fontSize: 6.5, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: [31, 78, 121] },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 0,
    });

    const res = await exportPdfFile(
      doc,
      `stock-report-${reportType.toLowerCase()}-${today}.pdf`,
      selectedLabel
    );
    setNotice(res.message);
  };

  const reportLabel =
    REPORT_OPTIONS.find((option) => option.value === reportType)?.label ||
    "Stock Report";

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Inventory movement reports, transaction ledgers, and PDF / Excel exports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            Export Excel / CSV
          </button>

          <button
            type="button"
            onClick={exportPdf}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
          >
            Export PDF
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Matching Transactions
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {filteredTransactions.length.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Total Stock IN
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {totalIn.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Total Stock OUT
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-400">
            {totalOut.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Net Movement
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-700 dark:text-blue-400">
            {(totalIn - totalOut).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
          Report Filters
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Select Report
            <select
              value={reportType}
              onChange={(event) =>
                setReportType(event.target.value as ReportType)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Date Period
            <select
              value={period}
              onChange={(event) =>
                changePeriod(event.target.value as PeriodType)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="TODAY">Today</option>
              <option value="MONTH">This Month</option>
              <option value="YEAR">This Year</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            From Date
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPeriod("CUSTOM");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            To Date
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setToDate(event.target.value);
                setPeriod("CUSTOM");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Company
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Companies</option>
              {allCompanies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Product
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Products</option>
              {allProducts.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Customer
            <select
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Customers</option>
              {allCustomers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, voucher, vehicle..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </label>

          {reportType === "SUMMARY" && (
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Summary Grouping
              <select
                value={summaryPeriod}
                onChange={(event) =>
                  setSummaryPeriod(event.target.value as SummaryPeriod)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="DAY">Daily</option>
                <option value="MONTH">Monthly</option>
                <option value="YEAR">Yearly</option>
              </select>
            </label>
          )}

          {reportType === "LOW_STOCK" && (
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Low Stock Threshold
              <input
                type="number"
                min="0"
                value={lowStockLimit}
                onChange={(event) => setLowStockLimit(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </label>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {reportLabel}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {reportRows.length} report row(s)
              {loading ? " • Loading..." : ""}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {[
                  "Date",
                  "Type",
                  "Voucher / Challan",
                  "Company",
                  "Product",
                  "Customer",
                  "Quantity",
                  "Unit",
                  "Balance",
                  "Vehicle",
                  "Driver",
                  "Driver Contact",
                  "Details",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportRows.map((row, index) => (
                <tr
                  key={`${row.type}-${row.date}-${row.product}-${row.company}-${index}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {row.date ? formatDate(row.date) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.type || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.voucher || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.product || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.customer || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {row.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.unit || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.balance === "" ? "—" : row.balance}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.vehicle || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.driver || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.contact || "—"}
                  </td>
                  <td className="min-w-48 px-4 py-3 text-slate-700 dark:text-slate-200">
                    {row.details || "—"}
                  </td>
                </tr>
              ))}

              {!loading && reportRows.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No records found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Note: Stock levels and ledger movements are computed from recorded stock transactions.
        Verify balances with warehouse records when necessary. Exported CSV files
        are fully compatible with Microsoft Excel and Google Sheets.

      </p>
    </section>
  );
}
