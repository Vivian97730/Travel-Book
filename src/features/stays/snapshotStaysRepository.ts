import type { AccessVerifyResponse, Stay, StayInput } from "@travel-book/contracts";
import { hashAccessToken } from "../offline/homeSnapshotRepository";
import type { StaysRepository } from "./staysRepository";
import { createStaysSnapshot, type StaysSnapshots } from "./staysSnapshot";

export class SnapshotStaysRepository implements StaysRepository {
  private readonly tokenHash: Promise<string>;
  private active = true;
  private pending: Promise<unknown> = Promise.resolve();
  lastSyncedAt: string | null = null;

  constructor(
    private readonly source: Required<Omit<StaysRepository, "lastSyncedAt">>,
    private readonly snapshots: StaysSnapshots,
    token: string,
    private readonly access: AccessVerifyResponse,
    private readonly online: () => boolean,
  ) {
    this.tokenHash = hashAccessToken(token);
  }

  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async refresh() {
    const stays = await this.source.getStays();
    const snapshot = createStaysSnapshot(await this.tokenHash, this.access, stays);
    this.lastSyncedAt = snapshot.syncedAt;
    if (this.active) await this.snapshots.put(snapshot).catch(() => undefined);
    return stays;
  }

  getStays() {
    return this.queue(async () => {
      if (this.online()) return this.refresh();
      const snapshot = await this.snapshots.get(await this.tokenHash);
      if (snapshot?.access.trip.id !== this.access.trip.id) throw new Error("OFFLINE_SNAPSHOT_UNAVAILABLE");
      this.lastSyncedAt = snapshot.syncedAt;
      return snapshot.stays;
    });
  }

  stopSaving() {
    this.active = false;
    return this.pending;
  }

  private requireOnline() {
    if (!this.active || !this.online()) throw new Error("OFFLINE_READ_ONLY");
  }

  private mutate<T>(operation: () => Promise<T>, update: (stays: Stay[], result: T) => Stay[]): Promise<T> {
    return this.queue(async () => {
      this.requireOnline();
      const result = await operation();
      // Apply the authoritative mutation result without another GET.
      const hash = await this.tokenHash;
      const previous = await this.snapshots.get(hash).catch(() => null);
      if (previous && this.active) {
        const snapshot = createStaysSnapshot(hash, this.access, update(previous.stays, result));
        this.lastSyncedAt = snapshot.syncedAt;
        await this.snapshots.put(snapshot).catch(async () => {
          this.lastSyncedAt = null;
          await this.snapshots.delete(hash).catch(() => undefined);
        });
      } else {
        this.lastSyncedAt = null;
        await this.snapshots.delete(hash).catch(() => undefined);
      }
      return result;
    });
  }

  createStay(input: StayInput) {
    return this.mutate(() => this.source.createStay(input), (stays, saved) => [...stays.filter((stay) => stay.id !== saved.id), saved]);
  }

  updateStay(id: string, input: StayInput, version: number) {
    return this.mutate(() => this.source.updateStay(id, input, version), (stays, saved) => stays.map((stay) => stay.id === id ? saved : stay));
  }

  deleteStay(id: string, version: number) {
    return this.mutate(() => this.source.deleteStay(id, version), (stays) => stays.filter((stay) => stay.id !== id));
  }

  async uploadPhoto(file: Blob) {
    this.requireOnline();
    return this.source.uploadPhoto(file);
  }

  async readPhoto(id: string) {
    this.requireOnline();
    return this.source.readPhoto(id);
  }

  async removePhoto(id: string) {
    this.requireOnline();
    return this.source.removePhoto(id);
  }
}
