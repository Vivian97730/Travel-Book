import type { ExpensesResponse } from "@travel-book/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiExpensesRepository } from "./apiExpensesRepository";
import { FakeExpensesRepository } from "./fakeExpensesRepository";

const payload: ExpensesResponse = {
  schemaVersion: 1,
  expenses: [],
  rates: [],
  totalsMinor: { TWD: "18014398509481982", EUR: "0", HUF: "0" },
};

describe("Expenses Repository", () => {
  it("uses an authorized, non-cached GET and keeps exact totals", async () => {
    const fetcher = vi.fn(async () => Response.json(payload));
    const repository = new ApiExpensesRepository("https://test.invalid/api/", "fixture", fetcher);
    await expect(repository.getExpenses()).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledWith("https://test.invalid/api/v1/expenses", {
      headers: { authorization: "Bearer fixture", "x-request-id": expect.any(String) },
      cache: "no-store",
    });
  });

  it("calls native-style fetch without binding the repository as its receiver", async () => {
    const fetcher = async function (this: unknown) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      return Response.json(payload);
    };
    const repository = new ApiExpensesRepository("https://test.invalid", "fixture", fetcher);
    await expect(repository.getExpenses()).resolves.toEqual(payload);
  });

  it("preserves access errors and rejects invalid response data", async () => {
    const denied = new ApiExpensesRepository("https://test.invalid", "fixture", async () => Response.json({
      error: { code: "ACCESS_DENIED", message: "Denied", requestId: "request", details: {} },
    }, { status: 401 }));
    const invalid = new ApiExpensesRepository("https://test.invalid", "fixture", async () =>
      Response.json({ ...payload, totalsMinor: { ...payload.totalsMinor, HUF: -1 } }));
    await expect(denied.getExpenses()).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(invalid.getExpenses()).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_UNAVAILABLE" });
  });

  it("keeps fake responses independent", async () => {
    const repository = new FakeExpensesRepository(payload);
    const data = await repository.getExpenses();
    data.totalsMinor.TWD = "0";
    await expect(repository.getExpenses()).resolves.toEqual(payload);
  });
});
