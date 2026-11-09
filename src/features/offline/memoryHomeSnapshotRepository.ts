import { parseHomeSnapshot, type HomeSnapshot, type HomeSnapshotRepository } from "./homeSnapshotRepository";

export class MemoryHomeSnapshotRepository implements HomeSnapshotRepository {
  private readonly values = new Map<string, HomeSnapshot>();

  async get(tokenHash: string): Promise<HomeSnapshot | null> {
    return parseHomeSnapshot(this.values.get(tokenHash), tokenHash);
  }

  async put(snapshot: HomeSnapshot): Promise<void> {
    this.values.set(snapshot.tokenHash, structuredClone(snapshot));
  }

  async delete(tokenHash: string): Promise<void> {
    this.values.delete(tokenHash);
  }
}
