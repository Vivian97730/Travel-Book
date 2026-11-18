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
  it("captures the fragment without persisting an unverified token and removes it from the URL", () => {
    const storage = memoryStorage();
    const store = createAccessTokenStore(() => storage, { read: () => "", write: () => {}, path: "/Travel-Book/" });
    const replaced: string[] = [];

    const captured = captureAccessToken({
      hash: "#/access/private-token_123",
      pathname: "/Travel-Book/",
      search: "?source=family",
      replaceUrl: (url) => replaced.push(url),
    });

    expect(captured).toBe("private-token_123");
    expect(store.get()).toBeNull();
    expect(replaced).toEqual(["/Travel-Book/?source=family#/itinerary"]);
    expect(replaced[0]).not.toContain("private-token_123");
  });

  it("can clear a revoked token", () => {
    const storage = memoryStorage();
    const store = createAccessTokenStore(() => storage, { read: () => "", write: () => {}, path: "/Travel-Book/" });
    store.set("private-token_123");
    store.clear();
    expect(store.get()).toBeNull();
  });
});

describe("home screen access restoration", () => {
  it("restores from a copied cookie with independent empty localStorage and renews only on save", () => {
    let cookie = "";
    const writes: string[] = [];
    const cookies = { read: () => cookie, write: (value: string) => {
      writes.push(value);
      cookie = value.split(";")[0];
    }, path: "/Travel-Book/" };
    const safariStorage = memoryStorage();
    const safari = createAccessTokenStore(() => safariStorage, cookies);
    safari.set("test-access-token");
    expect(writes[0]).toBe("travel-book-access-v1=test-access-token; Path=/Travel-Book/; Max-Age=15552000; Secure; SameSite=Strict");
    const appStorage = memoryStorage();
    const app = createAccessTokenStore(() => appStorage, cookies);
    expect(app.get()).toBe("test-access-token");
    expect(writes).toHaveLength(1);
    app.set(app.get()!);
    expect(writes).toHaveLength(2);
    expect(createAccessTokenStore(() => appStorage, { ...cookies, read: () => "" }).get()).toBe("test-access-token");
    app.clear();
    expect(app.get()).toBeNull();
    expect(writes[2]).toContain("Max-Age=0");
  });

  it("survives blocked storage and rejects malformed cookie values", () => {
    const blocked = () => { throw new Error("storage blocked"); };
    const writes: string[] = [];
    const store = createAccessTokenStore(blocked, {
      read: () => "other=value; travel-book-access-v1=test-token",
      write: (value) => { writes.push(value); }, path: "/Travel-Book/",
    });
    expect(store.get()).toBe("test-token");
    expect(() => store.set("test-token")).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    expect(writes[1]).toContain("Max-Age=0");
    expect(createAccessTokenStore(blocked, {
      read: () => "travel-book-access-v1=bad%20token", write: () => {}, path: "/",
    }).get()).toBeNull();
    const unavailable = createAccessTokenStore(blocked, { read: blocked, write: blocked, path: "/" });
    expect(unavailable.get()).toBeNull();
    expect(() => unavailable.set("test-token")).not.toThrow();
  });
});
