import { storedDate, getBusinessTimezone } from '../timezone';
import { expensePresetRange } from "../expenses/expenseUtils";

export function blankTransactionFilters(now = new Date()) {
  return {
    preset: "all",
    q: "",
    start: "",
    end: "",
    sale_channel: "all",
    payment_type: "all",
    payment_method: "",
    direction: "all",
    ...expensePresetRange("all", now),
  };
}

export function transactionPageFromPath(pathname) {
  const saleEdit = pathname.match(/^\/sales\/(\d+)\/edit$/);
  if (saleEdit) return { kind: "edit", tab: "sales", id: Number(saleEdit[1]) };
  const saleDetail = pathname.match(/^\/sales\/(\d+)$/);
  if (saleDetail)
    return { kind: "detail", tab: "sales", id: Number(saleDetail[1]) };
  const edit = pathname.match(
    /^\/transactions\/(payments|supplier-payments)\/(\d+)\/edit$/,
  );
  if (edit) return { kind: "edit", tab: edit[1], id: Number(edit[2]) };
  return { kind: "list", tab: null, id: null };
}

export function transactionPath(tab, filters, limit, offset) {
  const params = new URLSearchParams({
    status: "completed",
    with_total: "true",
    limit: String(limit),
    offset: String(offset),
  });
  if(filters.sort&&filters.sort!=='newest')params.set('sort',filters.sort);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  if (tab === "sales") {
    if (filters.sale_channel && filters.sale_channel !== "all")
      params.set("sale_channel", filters.sale_channel);
    if (filters.payment_type !== "all")
      params.set("payment_type", filters.payment_type);
    if (filters.payment_method)
      params.set("payment_method", filters.payment_method);
    return `/sales?${params}`;
  }
  if (tab === "payments") {
    if (filters.direction !== "all") params.set("direction", filters.direction);
    if (filters.payment_method)
      params.set("payment_method", filters.payment_method);
    return `/customer-payments?${params}`;
  }
  if (tab === "supplierPayments") {
    if (filters.direction !== "all") params.set("direction", filters.direction);
    if (filters.payment_method)
      params.set("payment_method", filters.payment_method);
    return `/supplier-payments?${params}`;
  }
  throw new Error(`Unsupported transaction type: ${tab}`);
}

export function transactionAmount(tab, row) {
  if (tab === "sales") return Number(row.total || 0);
  if (tab === "payments" || tab === "supplierPayments")
    return Number(row.amount || 0);
  return 0;
}

export function transactionSummary(tab, rows = []) {
  return rows.reduce(
    (summary, row) => {
      summary.total += transactionAmount(tab, row);
      if (tab === "sales") {
        summary.paid += Number(row.paid_amount || 0);
        summary.credit += Number(row.credit_amount || 0);
      }
      if (tab === "payments" || tab === "supplierPayments")
        summary[
          ["shop_to_customer", "shop_to_supplier"].includes(row.direction)
            ? "outgoing"
            : "incoming"
        ] += Number(row.amount || 0);
      return summary;
    },
    { total: 0, paid: 0, credit: 0, incoming: 0, outgoing: 0 },
  );
}

export function salesReferenceDate(value, withTime = false) {
  if (!value) return 'Not available';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : storedDate(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { ...(!/^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: getBusinessTimezone() } : {}), day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
