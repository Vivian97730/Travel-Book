import { describe, expect, it } from "vitest";
import { newChecklistTitle } from "./newChecklistTitle";

describe("inline checklist title", () => {
  it.each(["", " ", "　", "\t\n "])("rejects an empty or whitespace-only title: %j", (value) => {
    expect(newChecklistTitle(value)).toBeNull();
  });
  it("trims surrounding whitespace while preserving the item text", () => {
    expect(newChecklistTitle("　 護照與 車票  ")).toBe("護照與 車票");
  });
});
