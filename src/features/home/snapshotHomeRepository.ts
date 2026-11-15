import type { AccessVerifyResponse, TravelFact, TripHome } from "@travel-book/contracts";
import {
  createHomeSnapshot,
  hashAccessToken,
  type HomeSnapshotRepository,
} from "../offline/homeSnapshotRepository";
import type { HomeRepository } from "./homeRepository";

export class SnapshotHomeRepository implements HomeRepository {
  private active = true;
  private readonly writes = new Set<Promise<void>>();
  private tokenHash: Promise<string> | null = null;

  constructor(
    private readonly api: HomeRepository,
    private readonly snapshots: HomeSnapshotRepository,
    private readonly accessToken: string,
    private readonly access: AccessVerifyResponse,
    private readonly isOnline: () => boolean,
  ) {}

  async getTripHome(): Promise<TripHome> {
    if (!this.isOnline()) {
      const snapshot = await this.snapshots.get(await this.getTokenHash());
      if (!snapshot) throw new Error("OFFLINE_SNAPSHOT_UNAVAILABLE");
      return structuredClone(snapshot.home);
    }

    const home = await this.api.getTripHome();
    await this.saveSnapshot(home);
    return home;
  }

  async saveTravelFacts(facts: TravelFact[], expectedVersion: number): Promise<TripHome> {
    if (!this.isOnline()) throw new Error("OFFLINE_READ_ONLY");
    const home = await this.api.saveTravelFacts(facts, expectedVersion);
    await this.saveSnapshot(home);
    return home;
  }

  private async saveSnapshot(home: TripHome): Promise<void> {
    const tokenHash = await this.getTokenHash();
    if (!this.active) return;
    const write = this.snapshots.put(createHomeSnapshot({
      tokenHash,
      access: this.access,
      home,
    })).catch(() => undefined);
    this.writes.add(write);
    await write;
    this.writes.delete(write);
  }

  stopSaving() {
    this.active = false;
    return Promise.allSettled(this.writes);
  }

  private getTokenHash(): Promise<string> {
    this.tokenHash ??= hashAccessToken(this.accessToken);
    return this.tokenHash;
  }
}
