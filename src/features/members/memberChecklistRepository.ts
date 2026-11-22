import type { ResourceCache } from "../cache/resourceCache";
import { cachedChecklist } from "../cache/cachedRepositories";
import { parseSharedChecklistResponse, type SharedChecklistResponse } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";
import { ApiSharedChecklistRepository } from "../checklists/apiSharedChecklistRepository";
import type { PersonalChecklistItem, PersonalChecklistKind, PersonalChecklistRepository } from "../checklists/personalChecklistRepository";
import type { SharedChecklistRepository } from "../checklists/sharedChecklistRepository";
import { CoreSnapshots } from "../offline/coreSnapshots";

// Immutable scope: an in-flight request can never write a different member's cache.
export class MemberChecklistRepository implements PersonalChecklistRepository {
  private active = true;
  private stopping: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private readonly versions = new Map<PersonalChecklistKind, number>();
  private readonly snapshots = new CoreSnapshots();
  private readonly repositories = new Map<PersonalChecklistKind, SharedChecklistRepository>();
  constructor(private readonly base: string, private readonly token: string,
    private readonly tokenHash: string, private readonly tripId: string, private readonly memberId: string,
    private readonly online: () => boolean = () => navigator.onLine, private readonly cache?: ResourceCache) {}
  private resource(kind: PersonalChecklistKind) { return `personal:${this.tripId}:${this.memberId}:${kind}`; }
  readSnapshotInfo(kind: PersonalChecklistKind) {
    return this.snapshots.get(this.tokenHash, this.resource(kind));
  }
  forKind(kind: PersonalChecklistKind): SharedChecklistRepository {
    const existing = this.repositories.get(kind);
    if (existing) return existing;
    const api = new ApiSharedChecklistRepository(this.base, this.token, fetch,
      `/v1/members/${encodeURIComponent(this.memberId)}/checklists/${kind}`);
    const remember = async (data: SharedChecklistResponse) => {
      this.saving = this.saving.catch(() => undefined).then(async () => {
        if (!this.active || data.version < (this.versions.get(kind) ?? 0)) return;
        this.versions.set(kind, data.version);
        await this.snapshots.put(this.tokenHash, this.resource(kind), data).catch(() => undefined);
      });
      await this.saving;
      return data;
    };
    const authorized = async (operation: () => Promise<SharedChecklistResponse>) => {
      try { return await operation(); }
      catch (error) {
        if (error instanceof ApiClientError && error.code === "ACCESS_DENIED") {
          await this.stop().catch(() => undefined);
          await this.snapshots.delete(this.tokenHash).catch(() => undefined);
        }
        throw error;
      }
    };
    const repository: SharedChecklistRepository = {
      getSharedChecklist: async () => {
        if (!this.active) throw new Error("MEMBER_CHANGED");
        if (this.online()) return remember(await authorized(() => api.getSharedChecklist()));
        const entry = await this.snapshots.get(this.tokenHash, this.resource(kind));
        const parsed = parseSharedChecklistResponse(entry?.data);
        if (!parsed.ok || !entry || Date.parse(entry.expiresAt) <= Date.now()) throw new Error("OFFLINE_SNAPSHOT_UNAVAILABLE");
        return parsed.value;
      },
      mutateSharedChecklist: async (mutation, key) => {
        if (!this.active || !this.online()) throw new Error("READ_ONLY");
        return remember(await authorized(() => api.mutateSharedChecklist(mutation, key)));
      },
    };
    const cached = this.cache ? cachedChecklist(repository, this.cache, this.resource(kind)) : repository;
    this.repositories.set(kind, cached);
    return cached;
  }
  stopSaving(): Promise<void> {
    this.active = false;
    this.repositories.clear();
    this.versions.clear();
    return this.saving.catch(() => undefined);
  }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.stopSaving().then(async () => {
      await Promise.all((["luggage", "todos"] as const).map((kind) => this.cache?.invalidate(this.resource(kind))));
      await Promise.all((["luggage", "todos"] as const).map((kind) =>
        this.snapshots.deleteResource(this.tokenHash, this.resource(kind))));
    });
    return this.stopping;
  }
  async getItems(): Promise<PersonalChecklistItem[]> { throw new Error("USE_VERSIONED_REPOSITORY"); }
  async addItem(): Promise<never> { throw new Error("USE_VERSIONED_REPOSITORY"); }
  async updateItem(): Promise<never> { throw new Error("USE_VERSIONED_REPOSITORY"); }
  async deleteItem(): Promise<never> { throw new Error("USE_VERSIONED_REPOSITORY"); }
}
