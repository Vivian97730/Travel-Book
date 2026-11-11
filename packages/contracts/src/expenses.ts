import { isRecord, type ParseResult, type ValidationIssue } from "./validation.ts";

export const expenseCurrencies = ["TWD", "EUR", "HUF"] as const;
export const expenseCategories = ["食物", "交通", "景點", "逛街", "超市", "機票"] as const;
export type ExpenseCurrency = typeof expenseCurrencies[number];
export type ExpenseCategory = typeof expenseCategories[number];

export interface ExpenseInput {
  date: string;
  title: string;
  category: ExpenseCategory;
  currency: ExpenseCurrency;
  amountMinor: number;
}

export interface Expense extends ExpenseInput {
  id: string;
  version: number;
  rateSnapshotId: string | null;
  referenceTwdMinor: number | null;
}

export interface ExchangeRateSnapshot {
  id: string;
  baseCurrency: Exclude<ExpenseCurrency, "TWD">;
  quoteCurrency: "TWD";
  rate: string;
  source: string;
  sourceDate: string;
  fetchedAt: string;
  formulaVersion: number;
}

export function parseExpenseAmountMinor(amount: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  const minor = Number(whole + fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function parseExpenseInput(input: unknown): ParseResult<ExpenseInput> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "expense", message: "支出格式不正確。" }] };
  }

  const { date, category, currency, amountMinor } = input;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const issues: ValidationIssue[] = [];
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || date.startsWith("0000-") || !Number.isFinite(Date.parse(date))
    || new Date(date).toISOString().slice(0, 10) !== date) {
    issues.push({ path: "date", message: "日期格式不正確。" });
  }
  if (!title || [...title].length > 50) issues.push({ path: "title", message: "請輸入 1 至 50 字的名稱。" });
  if (!expenseCategories.some((value) => value === category)) {
    issues.push({ path: "category", message: "支出類別不正確。" });
  }
  if (!expenseCurrencies.some((value) => value === currency)) {
    issues.push({ path: "currency", message: "支出幣別不正確。" });
  }
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    issues.push({ path: "amountMinor", message: "金額必須是最小貨幣單位的正整數。" });
  }

  return issues.length ? { ok: false, issues } : {
    ok: true,
    value: {
      date: date as string,
      title,
      category: category as ExpenseCategory,
      currency: currency as ExpenseCurrency,
      amountMinor: amountMinor as number,
    },
  };
}

export interface ExpensesResponse {
  schemaVersion: 1;
  expenses: Expense[];
  totalsMinor: Record<ExpenseCurrency, string>;
  rates: ExchangeRateSnapshot[];
}

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function isExpense(value: unknown): value is Expense {
  if (!isRecord(value) || !parseExpenseInput(value).ok
    || typeof value.id !== "string" || !uuid.test(value.id)
    || typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 1) return false;

  const { referenceTwdMinor: reference, rateSnapshotId: snapshot } = value;
  if (value.currency === "TWD") return snapshot === null && reference === value.amountMinor;
  return snapshot === null ? reference === null : typeof snapshot === "string" && uuid.test(snapshot)
    && typeof reference === "number" && Number.isSafeInteger(reference) && reference >= 0;
}

function isRateSnapshot(value: unknown): value is ExchangeRateSnapshot {
  return isRecord(value)
    && typeof value.id === "string" && uuid.test(value.id)
    && (value.baseCurrency === "EUR" || value.baseCurrency === "HUF") && value.quoteCurrency === "TWD"
    && typeof value.rate === "string" && /^\d+(?:\.\d+)?$/.test(value.rate) && /[1-9]/.test(value.rate)
    && typeof value.source === "string" && !!value.source.trim()
    && typeof value.sourceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.sourceDate)
    && typeof value.fetchedAt === "string" && Number.isFinite(Date.parse(value.fetchedAt))
    && typeof value.formulaVersion === "number" && Number.isSafeInteger(value.formulaVersion) && value.formulaVersion > 0;
}

export function parseExpensesResponse(value: unknown): ParseResult<ExpensesResponse> {
  if (isRecord(value) && value.schemaVersion === 1
    && Array.isArray(value.expenses) && value.expenses.every(isExpense)
    && new Set(value.expenses.map((expense) => expense.id)).size === value.expenses.length
    && Array.isArray(value.rates) && value.rates.every(isRateSnapshot)
    && new Set(value.rates.map((rate) => rate.baseCurrency)).size === value.rates.length
    && isRecord(value.totalsMinor)) {
    const totals = value.totalsMinor;
    if (expenseCurrencies.every((currency) => typeof totals[currency] === "string" && /^\d+$/.test(totals[currency]))) {
      return { ok: true, value: { schemaVersion: 1, expenses: value.expenses, rates: value.rates,
        totalsMinor: totals as ExpensesResponse["totalsMinor"] } };
    }
  }
  return { ok: false, issues: [{ path: "expenses", message: "支出回應格式不正確。" }] };
}
