import { describe, expect, it } from "vitest";
import { expenseCurrencies, parseExpenseAmountMinor, parseExpenseInput } from "./expenses.ts";

const expense = {
  date: "2027-02-06",
  title: " 午餐 ",
  category: "食物",
  currency: "TWD",
  amountMinor: 12050,
};

describe("expense input", () => {
  it.each(expenseCurrencies)("accepts positive minor units for %s", (currency) => {
    expect(parseExpenseInput({ ...expense, currency })).toEqual({
      ok: true,
      value: { ...expense, currency, title: "午餐" },
    });
  });

  it.each([0, -1, 1.01, Number.MAX_SAFE_INTEGER + 1, "100"])(
    "rejects invalid minor units %s",
    (amountMinor) => expect(parseExpenseInput({ ...expense, amountMinor }).ok).toBe(false),
  );

  it.each([
    { date: "2027-02-29" },
    { date: "0000-01-01" },
    { title: " " },
    { title: "食".repeat(51) },
    { currency: "USD" },
    { category: "其他" },
  ])("rejects invalid fields %j", (input) => {
    expect(parseExpenseInput({ ...expense, ...input }).ok).toBe(false);
  });

  it.each([
    ["8600", 860000],
    ["12.3", 1230],
    ["0.01", 1],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
    ["90071992547409.92", null],
    ["0.001", null],
    ["1e2", null],
    ["1.00\n", null],
    ["0", null],
    ["-1", null],
  ])("converts decimal input %j to %j without floating-point rounding", (input, expected) => {
    expect(parseExpenseAmountMinor(input)).toBe(expected);
  });
});
