import { describe, expect, it, vi } from "vitest";
import { ResourceCache, TEXT_FRESH_MS, type CacheEntry, type CacheStorage } from "./resourceCache";
const decode = (value: unknown) => typeof value === "string" ? value : null;
function deferred<T>() { let resolve!: (data: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup() {
  let now = 1_000_000;
  let online = true;
  const disk = new Map<string, CacheEntry>();
  const storage: CacheStorage = { get: vi.fn(async (key) => disk.get(key)), put: vi.fn(async (key, data) => { disk.set(key, data); }), delete: vi.fn(async (key) => { disk.delete(key); }) };
  const denied = vi.fn();
  const cache = new ResourceCache(storage, () => now, denied, () => online);
  return { cache, storage, disk, denied, advance: (ms: number) => { now += ms; }, offline: () => { online = false; }, now: () => now };
}
describe("private resource cache", () => {
  it("deduplicates concurrent requests and retains the actual download timestamp across reopening", async () => {
    const { cache, storage, now, advance } = setup();
    const request = deferred<string>(); const load = vi.fn(() => request.promise);
    const a = cache.read("home", load, decode); const b = cache.read("home", load, decode);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1)); request.resolve("saved");
    expect(await Promise.all([a, b])).toEqual(["saved", "saved"]);
    advance(TEXT_FRESH_MS - 1);
    const reopened = new ResourceCache(storage, now);
    expect(await reopened.read("home", load, decode)).toBe("saved"); expect(load).toHaveBeenCalledTimes(1);
  });
  it("returns stale data immediately and publishes one background update", async () => {
    const { cache, advance } = setup(); await cache.set("home", "old"); advance(TEXT_FRESH_MS);
    const request = deferred<string>(); const load = vi.fn(() => request.promise); const listener = vi.fn(); cache.subscribe(listener);
    expect(await cache.read("home", load, decode)).toBe("old"); expect(await cache.read("home", load, decode)).toBe("old");
    request.resolve("new"); await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(await cache.read("home", load, decode)).toBe("new"); expect(load).toHaveBeenCalledTimes(1);
  });
  it("does not notify for unchanged data or retry a background failure in a loop", async () => {
    const { cache, advance } = setup(); await cache.set("home", "old"); advance(TEXT_FRESH_MS);
    const load = vi.fn(async () => { throw new Error("network"); }); const listener = vi.fn(); cache.subscribe(listener);
    expect(await cache.read("home", load, decode)).toBe("old"); await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(await cache.read("home", load, decode)).toBe("old"); expect(load).toHaveBeenCalledTimes(1);
    expect(cache.notice).toContain("背景更新失敗");
  });
  it("writes mutation results without a GET and forces conflict recovery to the server", async () => {
    const { cache } = setup(); await cache.set("home", "old");
    await cache.mutate("home", async () => "saved", (data) => cache.set("home", data));
    const load = vi.fn(async () => "remote"); expect(await cache.read("home", load, decode)).toBe("saved"); expect(load).not.toHaveBeenCalled();
    await expect(cache.mutate("home", async () => { throw { code: "VERSION_CONFLICT" }; }, async () => {})).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await cache.read("home", load, decode)).toBe("remote");
  });
  it("fences a late GET so it cannot replace a saved mutation", async () => {
    const { cache } = setup(); const request = deferred<string>(); const load = vi.fn(() => request.promise);
    const read = cache.read("home", load, decode); await vi.waitFor(() => expect(load).toHaveBeenCalled());
    await cache.mutate("home", async () => "saved", (data) => cache.set("home", data)); request.resolve("old");
    expect(await read).toBe("saved"); expect(await cache.read("home", load, decode)).toBe("saved");
  });
  it("manual refresh bypasses the TTL, while offline reads do not renew cache freshness", async () => {
    const { cache, offline, disk } = setup(); await cache.set("home", "old"); await cache.refresh();
    const load = vi.fn(async () => "new"); expect(await cache.read("home", load, decode)).toBe("new");
    const timestamp = disk.get("home")?.syncedAt; offline(); expect(await cache.read("home", async () => "offline", decode)).toBe("offline");
    expect(disk.get("home")?.syncedAt).toBe(timestamp);
  });
  it("does not serve malformed, expired, or future-dated disk entries", async () => {
    const { cache, disk, now } = setup();
    for (const [key, data, syncedAt] of [["invalid", {}, now()], ["expired", "old", now() - 7 * 86400_000], ["future", "old", now() + 1000]] as const) {
      disk.set(key, { data, syncedAt }); expect(await cache.read(key, async () => "new", decode)).toBe("new");
    }
  });
  it("storage denial does not prevent reads or successful writes", async () => {
    const fail = async () => { throw new Error("quota"); }; const cache = new ResourceCache({ get: fail, put: fail, delete: fail });
    expect(await cache.read("home", async () => "new", decode)).toBe("new");
    await expect(cache.mutate("home", async () => "saved", (data) => cache.set("home", data))).resolves.toBe("saved");
  });
  it("revocation clears photos and memory and prevents late writes", async () => {
    const { cache, storage, denied } = setup(); const request = deferred<string>(); const load = vi.fn(() => request.promise);
    const pending = cache.read("home", load, decode); await vi.waitFor(() => expect(load).toHaveBeenCalled());
    await expect(cache.read("deny", async () => { throw { code: "ACCESS_DENIED" }; }, decode)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(denied).toHaveBeenCalledOnce(); request.resolve("late"); await pending;
    expect(storage.put).not.toHaveBeenCalled(); await expect(cache.photo("id", async () => new Blob())).rejects.toThrow("CACHE_STOPPED");
  });
  it("stops deferred member reads before they can repopulate the old member cache", async () => {
    const { cache, disk } = setup(); const request = deferred<string>(); const load = vi.fn(() => request.promise);
    const pending = cache.read("personal:trip:mother:todos", load, decode); await vi.waitFor(() => expect(load).toHaveBeenCalled());
    await cache.invalidate("personal:trip:mother:todos"); request.resolve("old member");
    await expect(pending).rejects.toThrow("CACHE_SUPERSEDED"); expect(disk.has("personal:trip:mother:todos")).toBe(false);
  });
  it("ignores a late denial from an access scope that has already been replaced", async () => {
    const { cache, denied } = setup(); const request = deferred<Blob>();
    const pending = cache.photo("photo", () => request.promise);
    await cache.stop(); request.reject({ code: "ACCESS_DENIED" });
    await expect(pending).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(denied).not.toHaveBeenCalled();
  });
  it("survives StrictMode effect teardown, but stops once its final owner leaves", async () => {
    const { cache } = setup(); const release = cache.attach(); release(); const finalRelease = cache.attach(); await Promise.resolve();
    expect(await cache.read("home", async () => "new", decode)).toBe("new"); finalRelease(); await Promise.resolve();
    await expect(cache.read("home", async () => "new", decode)).rejects.toThrow("CACHE_STOPPED");
  });
});
describe("bounded private photo memory", () => {
  const jpeg = (size = 1024) => new Blob([new Uint8Array(size)], { type: "image/jpeg" });
  it("deduplicates photo reads without persisting blobs and drops unreferenced photos", async () => {
    const { cache, storage } = setup(); const load = vi.fn(async () => jpeg());
    await Promise.all([cache.photo("photo", load), cache.photo("photo", load)]); await cache.photo("photo", load);
    expect(load).toHaveBeenCalledOnce(); expect(storage.put).not.toHaveBeenCalled();
    cache.retainPhotos(new Set()); await cache.photo("photo", load); expect(load).toHaveBeenCalledTimes(2);
  });
  it("evicts least recently used blobs at 20 MiB and rejects oversized or wrong-type cache entries", async () => {
    const { cache } = setup(); const load = vi.fn(async () => jpeg(2 * 1024 * 1024));
    for (let i = 0; i < 11; i++) await cache.photo(String(i), load);
    await cache.photo("10", load); expect(load).toHaveBeenCalledTimes(11);
    await cache.photo("0", load); expect(load).toHaveBeenCalledTimes(12);
    const invalid = vi.fn(async () => new Blob(["bad"], { type: "text/html" }));
    await cache.photo("invalid", invalid); await cache.photo("invalid", invalid); expect(invalid).toHaveBeenCalledTimes(2);
    const big = vi.fn(async () => jpeg(2 * 1024 * 1024 + 1)); await cache.photo("big", big); await cache.photo("big", big); expect(big).toHaveBeenCalledTimes(2);
  });
  it("does not resurrect photos removed during a download", async () => {
    const { cache } = setup(); const request = deferred<Blob>(); const pending = cache.photo("photo", () => request.promise);
    cache.retainPhotos(new Set()); request.resolve(jpeg()); await pending;
    const load = vi.fn(async () => jpeg()); await cache.photo("photo", load); expect(load).toHaveBeenCalledOnce();
  });
});
