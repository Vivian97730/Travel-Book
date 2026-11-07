import { describe, expect, it } from "vitest";
import { shouldRenderVerifiedApp } from "./App";

describe("verified app access experience", () => {
  it("keeps an already verified trip mounted while offline and while reconnecting", () => {
    expect(shouldRenderVerifiedApp("offline", true)).toBe(true);
    expect(shouldRenderVerifiedApp("checking", true)).toBe(true);
    expect(shouldRenderVerifiedApp("offline", false)).toBe(false);
    expect(shouldRenderVerifiedApp("denied", true)).toBe(false);
  });
});
