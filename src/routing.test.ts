import { describe, expect, it } from "vitest";
import { hashForRoute, routeFromHash } from "./routing";

describe("GitHub Pages hash routing", () => {
  it("reads canonical slash-prefixed hashes", () => {
    expect(routeFromHash("#/home")).toBe("home");
    expect(routeFromHash("#/itinerary")).toBe("itinerary");
  });

  it("keeps existing hash links compatible", () => {
    expect(routeFromHash("#stays")).toBe("stays");
  });

  it("falls back to the default itinerary route", () => {
    expect(routeFromHash("")).toBe("itinerary");
    expect(routeFromHash("#/unknown")).toBe("itinerary");
  });

  it("generates canonical hashes", () => {
    expect(hashForRoute("expenses")).toBe("#/expenses");
  });
});
