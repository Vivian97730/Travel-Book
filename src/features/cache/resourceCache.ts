export const TEXT_FRESH_MS = 5 * 60_000;
const PHOTO_BUDGET = 20 * 1024 * 1024;
const PHOTO_MAX = 2 * 1024 * 1024;
export interface CacheEntry { data: unknown; syncedAt: number }
export interface CacheStorage {
  get(key: string): Promise<CacheEntry | undefined>;
  put(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

/** One instance per API origin and token hash. Never stores credentials or HTTP responses. */
export class ResourceCache {
  private active = true;
  private owners = 0;
  private attempts = new Map<string, number>();
  private storageQueue: Promise<unknown> = Promise.resolve();
  private known = new Set<string>();
  private entries = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<unknown>>();
  private mutations = new Map<string, Promise<void>>();
  private generations = new Map<string, number>();
  private writes = new Set<Promise<unknown>>();
  private photoKnown = new Set<string>();
  private photos = new Map<string, Blob>();
  private photoBytes = 0;
  private listeners = new Set<() => void>();
  revision = 0;
  notice = "";
  constructor(private storage?: CacheStorage, private now = Date.now,
    private denied: () => void = () => {}, private online = () => typeof navigator === "undefined" || navigator.onLine !== false) {}
  attach() {
    this.owners++;
    return () => { this.owners--; queueMicrotask(() => { if (!this.owners) void this.stop(); }); };
  }
  private store(operation: () => Promise<unknown>) {
    const result = this.storageQueue.catch(() => undefined).then(operation);
    this.storageQueue = result;
    return result;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.revision++; this.listeners.forEach((listener) => listener()); }
  private async persist(key: string, entry: CacheEntry) {
    if (!this.active || !this.storage) return;
    const write = this.store(() => this.active ? this.storage!.put(key, entry) : Promise.resolve()).catch(() => undefined);
    this.writes.add(write);
    await write;
    this.writes.delete(write);
  }
  private checkError(error: unknown) {
    if (this.active && typeof error === "object" && error && "code" in error && error.code === "ACCESS_DENIED") {
      void this.stop();
      this.denied();
    }
  }
  async read<T>(key: string, load: () => Promise<T>, decode: (data: unknown) => T | null): Promise<T> {
    if (!this.active) throw new Error("CACHE_STOPPED");
    this.known.add(key);
    await this.mutations.get(key);
    if (!this.online()) return load();
    const generation = this.generations.get(key) ?? 0;
    // A late disk read must not resurrect data invalidated during a mutation.
    let entry = this.entries.get(key);
    if (!entry && this.storage) {
      entry = await this.storage.get(key).catch(() => undefined);
      if (!this.active) throw new Error("CACHE_STOPPED");
      if (generation !== (this.generations.get(key) ?? 0)) return this.read(key, load, decode);
      if (entry && !this.entries.has(key)) this.entries.set(key, entry);
      entry = this.entries.get(key);
    }
    const data = entry ? decode(entry.data) : null;
    const age = entry ? this.now() - entry.syncedAt : Infinity;
    if (data !== null && age >= 0 && age < 7 * 86400_000) {
      if (age >= TEXT_FRESH_MS && this.now() - (this.attempts.get(key) ?? -Infinity) >= 30_000) void this.fetch(key, load, true).catch(() => undefined);
      return structuredClone(data);
    }
    return structuredClone(await this.fetch(key, load, false));
  }
  private fetch<T>(key: string, load: () => Promise<T>, background: boolean): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const generation = this.generations.get(key) ?? 0;
    this.attempts.set(key, this.now());
    const operation = (async () => {
      const data = await load();
      if (this.active && generation === (this.generations.get(key) ?? 0)) {
        const previous = this.entries.get(key)?.data;
        const entry = { data: structuredClone(data), syncedAt: this.now() };
        this.entries.set(key, entry);
        await this.persist(key, entry);
        if (background && (JSON.stringify(previous) !== JSON.stringify(data) || this.notice.includes("背景更新失敗"))) {
          this.notice = "資料已更新。";
          this.notify();
        }
      }
      if (generation !== (this.generations.get(key) ?? 0)) {
        await this.mutations.get(key);
        const current = this.entries.get(key);
        if (!current) throw new Error("CACHE_SUPERSEDED");
        return current.data as T;
      }
      return data;
    })().catch((error: unknown) => {
      this.checkError(error);
      if (background && this.active) {
        this.notice = "背景更新失敗，目前顯示上次資料；可按重新整理再試。";
        this.notify();
      }
      throw error;
    }).finally(() => { if (this.pending.get(key) === operation) this.pending.delete(key); });
    this.pending.set(key, operation);
    return operation;
  }
  async set<T>(key: string, data: T) {
    this.known.add(key);
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    this.pending.delete(key);
    if (!this.active) return;
    const entry = { data: structuredClone(data), syncedAt: this.now() };
    this.entries.set(key, entry);
    await this.persist(key, entry);
  }
  async invalidate(key: string) {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    this.pending.delete(key);
    this.entries.delete(key);
    this.attempts.delete(key);
    if (this.storage) await this.store(() => this.storage!.delete(key)).catch(() => undefined);
  }
  async authorize<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.active) throw new Error("CACHE_STOPPED");
    try { return await operation(); }
    catch (error) { this.checkError(error); throw error; }
  }
  async mutate<T>(key: string, operation: () => Promise<T>, update: (data: T) => Promise<void>) {
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => { finish = resolve; });
    this.mutations.set(key, waiting);
    try {
      // Fence off older GETs before sending a write, including failed/uncertain writes.
      await this.invalidate(key);
      const result = await operation();
      await update(result);
      return result;
    } catch (error) { this.checkError(error); throw error; }
    finally { if (this.mutations.get(key) === waiting) this.mutations.delete(key); finish(); }
  }
  async refresh() {
    const keys = [...this.known];
    await Promise.all(keys.map((key) => this.invalidate(key)));
    this.notice = "";
    this.notify();
  }
  async photo(id: string, load: () => Promise<Blob>): Promise<Blob> {
    if (!this.active) throw new Error("CACHE_STOPPED");
    this.photoKnown.add(id);
    const cached = this.photos.get(id);
    if (cached) { this.photos.delete(id); this.photos.set(id, cached); return cached; }
    const key = `photo:${id}`;
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<Blob>;
    const generation = this.generations.get(key) ?? 0;
    const operation = load().then((blob) => {
      if (this.active && generation === (this.generations.get(key) ?? 0)
        && blob.type === "image/jpeg" && blob.size > 0 && blob.size <= PHOTO_MAX) {
        while (this.photoBytes + blob.size > PHOTO_BUDGET && this.photos.size) this.forgetPhoto(this.photos.keys().next().value!);
        this.photos.set(id, blob); this.photoBytes += blob.size;
      }
      return blob;
    }).catch((error: unknown) => { this.checkError(error); throw error; })
      .finally(() => { if (this.pending.get(key) === operation) this.pending.delete(key); });
    this.pending.set(key, operation);
    return operation;
  }
  forgetPhoto(id: string) {
    this.photoKnown.delete(id);
    this.photoBytes -= this.photos.get(id)?.size ?? 0;
    this.photos.delete(id);
    const key = `photo:${id}`;
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    this.pending.delete(key);
  }
  retainPhotos(ids: Set<string>) { for (const id of this.photoKnown) if (!ids.has(id)) this.forgetPhoto(id); }
  async stop() {
    this.active = false;
    this.entries.clear(); this.photos.clear(); this.photoKnown.clear(); this.photoBytes = 0; this.pending.clear();
    await Promise.allSettled([...this.writes, this.storageQueue]);
  }
}
