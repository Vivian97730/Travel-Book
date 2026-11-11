import type { ExpensesResponse } from "@travel-book/contracts";
import type { ExpensesRepository } from "./expensesRepository";

export class FakeExpensesRepository implements ExpensesRepository {
  private readonly fixture: ExpensesResponse;

  constructor(fixture: ExpensesResponse) {
    this.fixture = structuredClone(fixture);
  }

  async getExpenses(): Promise<ExpensesResponse> {
    return structuredClone(this.fixture);
  }
}
