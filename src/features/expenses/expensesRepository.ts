import type { ExpenseCurrency, ExpenseMutation, ExpensesResponse } from "@travel-book/contracts";

export interface ExpensesRepository {
  getExpenses(): Promise<ExpensesResponse>;
  getRate(currency: ExpenseCurrency, date: string): Promise<string | null>;
  mutateExpense(mutation: ExpenseMutation, idempotencyKey: string): Promise<ExpensesResponse>;
}
