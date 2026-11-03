import { describe, expect, it } from "vitest";
import { captureAccessToken, createAccessTokenStore } from "./accessSession";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("private access session", () => {
  it("stores the fragment token and immediately removes it from the visible URL", () => {
    const storage = memoryStorage();
    const store = createAccessTokenStore(storage);
    const replaced: string[] = [];

    const captured = captureAccessToken({
      hash: "#/access/private-token_123",
      pathname: "/Travel-Book/",
      search: "?source=family",
      store,
      replaceUrl: (url) => replaced.push(url),
    });

    expect(captured).toBe("private-token_123");
    expect(store.get()).toBe("private-token_123");
    expect(replaced).toEqual(["/Travel-Book/?source=family#/itinerary"]);
    expect(replaced[0]).not.toContain("private-token_123");
  });

  it("can clear a revoked token", () => {
    const store = createAccessTokenStore(memoryStorage());
    store.set("private-token_123");
    store.clear();
    expect(store.get()).toBeNull();
  });
});
