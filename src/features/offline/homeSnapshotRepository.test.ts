import { describe, expect, it } from "vitest";
import { initialTripHome } from "../home/data";
import { MemoryHomeSnapshotRepository } from "./memoryHomeSnapshotRepository";
import {
  createHomeSnapshot,
  deleteHomeSnapshotForToken,
  getHomeSnapshotForToken,
  hashAccessToken,
  HOME_SNAPSHOT_MAX_AGE_MS,
  parseHomeSnapshot,
} from "./homeSnapshotRepository";

const access = {
  trip: {
    id: "10000000-0000-4000-8000-000000000001",
    title: "2027 過年東歐遊",
    startDate: "2027-02-05",
    endDate: "2027-02-15",
    displayTimezone: "Asia/Taipei",
  },
  resourceVersions: { home: 1 },
};

describe("home snapshot metadata", () => {
  it("stores versioned shared data with sync, expiry, and token hash metadata", async () => {
    const tokenHash = await hashAccessToken("private-token");
    const now = new Date("2026-11-08T00:00:00.000Z");
    const snapshot = createHomeSnapshot({ tokenHash, access, home: initialTripHome, now });

    expect(snapshot).toMatchObject({
      snapshotVersion: 1,
      tokenHash,
      syncedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + HOME_SNAPSHOT_MAX_AGE_MS).toISOString(),
      access,
      home: initialTripHome,
    });
    expect(JSON.stringify(snapshot)).not.toContain("private-token");
    expect(JSON.stringify(snapshot)).not.toMatch(/latitude|longitude|weather/i);
  });

  it("rejects snapshots for another token or malformed shared data", async () => {
    const tokenHash = await hashAccessToken("private-token");
    const snapshot = createHomeSnapshot({ tokenHash, access, home: initialTripHome });

    expect(parseHomeSnapshot(snapshot, await hashAccessToken("another-token"))).toBeNull();
    expect(parseHomeSnapshot({ ...snapshot, home: { title: "incomplete" } }, tokenHash)).toBeNull();
    expect(parseHomeSnapshot({ ...snapshot, expiresAt: snapshot.syncedAt }, tokenHash)).toBeNull();
  });

  it("loads and clears only the snapshot identified by a revoked token", async () => {
    const repository = new MemoryHomeSnapshotRepository();
    const firstHash = await hashAccessToken("first-token");
    const secondHash = await hashAccessToken("second-token");
    await repository.put(createHomeSnapshot({ tokenHash: firstHash, access, home: initialTripHome }));
    await repository.put(createHomeSnapshot({ tokenHash: secondHash, access, home: initialTripHome }));

    await expect(getHomeSnapshotForToken(repository, "first-token")).resolves.not.toBeNull();
    await deleteHomeSnapshotForToken(repository, "first-token");
    await expect(getHomeSnapshotForToken(repository, "first-token")).resolves.toBeNull();
    await expect(getHomeSnapshotForToken(repository, "second-token")).resolves.not.toBeNull();
  });
});
