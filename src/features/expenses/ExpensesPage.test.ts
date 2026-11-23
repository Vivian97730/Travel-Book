import { expect, it } from "vitest";
import type { Expense } from "@travel-book/contracts";
import { groupExpenses } from "./ExpensesPage";

it("groups expenses from earliest to latest without changing same-day order or the input", () => {
  const expense = (id: string, date: string): Expense => ({
    id, date, title: id, category: "住宿", currency: "TWD", amountMinor: 100,
    version: 1, rateSnapshotId: null, referenceTwdMinor: 100,
  });
  const input = [expense("late", "2027-02-15"), expense("first", "2027-02-05"),
    expense("middle", "2027-02-10"), expense("second", "2027-02-05")];
  const before = [...input];
  expect(groupExpenses(input).map(([date, items]) => [date, items.map(({ id }) => id)])).toEqual([
    ["2027-02-05", ["first", "second"]], ["2027-02-10", ["middle"]], ["2027-02-15", ["late"]],
  ]);
  expect(input).toEqual(before);
  expect(groupExpenses([])).toEqual([]);
});
