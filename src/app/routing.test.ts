import { describe, expect, it } from "vitest";
import { hashForRoute, parseAppHash } from "./routing";

describe("app hash routing", () => {
  it("routes the five formal pages and defaults to itinerary", () => {
    expect(parseAppHash("#/home")).toEqual({ kind: "route", route: "home" });
    expect(parseAppHash("#/expenses")).toEqual({ kind: "route", route: "expenses" });
    expect(parseAppHash("#/unknown")).toEqual({ kind: "route", route: "itinerary" });
    expect(parseAppHash("")).toEqual({ kind: "route", route: "itinerary" });
    expect(hashForRoute("stays")).toBe("#/stays");
  });

  it("recognizes a private access fragment without decoding it into a normal route", () => {
    expect(parseAppHash("#/access/a.b_c-123")).toEqual({ kind: "access", token: "a.b_c-123" });
  });
});
