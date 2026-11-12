import { convertExpenseToTwdMinor, expenseCurrencies, type ExpenseCurrency, type ExpenseMutation, type ExpensesResponse } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";
import type { ExpensesRepository } from "./expensesRepository";

export class FakeExpensesRepository implements ExpensesRepository {
  private readonly fixture: ExpensesResponse;
  private readonly receipts = new Map<string, string>();

  constructor(fixture: ExpensesResponse) {
    this.fixture = structuredClone(fixture);
  }

  async getExpenses(): Promise<ExpensesResponse> {
    return structuredClone(this.fixture);
  }

  async getRate(currency: ExpenseCurrency, date: string) {
    return currency === "TWD" ? "1" : this.fixture.rates.find((rate) => rate.baseCurrency === currency && rate.sourceDate <= date)?.rate ?? null;
  }

  async mutateExpense(mutation: ExpenseMutation, key: string) {
    const signature = JSON.stringify(mutation);
    const receipt = this.receipts.get(key);
    if (receipt === signature) return this.getExpenses();
    if (receipt) throw new ApiClientError("VALIDATION_FAILED", "重試識別碼已使用。", key);

    const index = this.fixture.expenses.findIndex((expense) => expense.id === mutation.id);
    const current = this.fixture.expenses[index];
    if (mutation.action !== "create" && !current) throw new ApiClientError("RESOURCE_NOT_FOUND", "找不到指定支出。", key);
    if (current && current.version !== mutation.expectedVersion) throw new ApiClientError("VERSION_CONFLICT", "支出已更新。", key);

    if (mutation.action === "delete") this.fixture.expenses.splice(index, 1);
    else {
      const input = mutation.input;
      const keepRate = current?.currency === input.currency && current.date === input.date;
      const snapshot = this.fixture.rates.find((rate) => rate.baseCurrency === input.currency && rate.sourceDate <= input.date);
      const snapshotRate = keepRate ? current.snapshotRate ?? this.fixture.rates.find((rate) => rate.id === current.rateSnapshotId)?.rate ?? null : snapshot?.rate ?? null;
      const reference = input.currency === "TWD" ? input.amountMinor
        : snapshotRate ? convertExpenseToTwdMinor(input.amountMinor, snapshotRate) : null;
      if (snapshotRate && reference === null) throw new ApiClientError("VALIDATION_FAILED", "台幣換算金額過大。", key);
      const next = {
        ...input, id: current?.id ?? crypto.randomUUID(), version: (current?.version ?? 0) + 1,
        rateSnapshotId: keepRate ? current.rateSnapshotId : snapshot?.id ?? null,
        snapshotRate, referenceTwdMinor: reference,
      };
      if (current) this.fixture.expenses[index] = next;
      else this.fixture.expenses.push(next);
    }
    for (const currency of expenseCurrencies) {
      this.fixture.totalsMinor[currency] = String(this.fixture.expenses.reduce((total, expense) =>
        total + (expense.currency === currency ? BigInt(expense.amountMinor) : 0n), 0n));
    }
    this.receipts.set(key, signature);
    return this.getExpenses();
  }
}
