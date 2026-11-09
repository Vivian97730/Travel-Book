import { describe, expect, it, vi } from "vitest";
import { MemoryHomeSnapshotRepository } from "../offline/memoryHomeSnapshotRepository";
import { hashAccessToken } from "../offline/homeSnapshotRepository";
import { initialTripHome } from "./data";
import type { HomeRepository } from "./homeRepository";
import { SnapshotHomeRepository } from "./snapshotHomeRepository";

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

describe("snapshot-backed HomeRepository", () => {
  it("saves a successful API read and reopens it as an isolated offline value", async () => {
    let online = true;
    const api: HomeRepository = {
      getTripHome: vi.fn(async () => structuredClone(initialTripHome)),
      saveTravelFacts: vi.fn(),
    };
    const snapshots = new MemoryHomeSnapshotRepository();
    const repository = new SnapshotHomeRepository(
      api,
      snapshots,
      "private-token",
      access,
      () => online,
    );

    await expect(repository.getTripHome()).resolves.toEqual(initialTripHome);
    const saved = await snapshots.get(await hashAccessToken("private-token"));
    expect(saved).toMatchObject({ access, home: initialTripHome });

    online = false;
    const offline = await repository.getTripHome();
    offline.facts[0].title = "被呼叫端修改";
    await expect(repository.getTripHome()).resolves.toEqual(initialTripHome);
    expect(api.getTripHome).toHaveBeenCalledTimes(1);
  });

  it("is read-only offline and never creates a pending write", async () => {
    const api: HomeRepository = {
      getTripHome: vi.fn(),
      saveTravelFacts: vi.fn(),
    };
    const repository = new SnapshotHomeRepository(
      api,
      new MemoryHomeSnapshotRepository(),
      "private-token",
      access,
      () => false,
    );

    await expect(repository.saveTravelFacts(initialTripHome.facts, initialTripHome.version))
      .rejects.toThrow("OFFLINE_READ_ONLY");
    expect(api.saveTravelFacts).not.toHaveBeenCalled();
  });

  it("updates the snapshot after a successful online save", async () => {
    const updated = { ...structuredClone(initialTripHome), version: initialTripHome.version + 1 };
    const api: HomeRepository = {
      getTripHome: vi.fn(),
      saveTravelFacts: vi.fn(async () => updated),
    };
    const snapshots = new MemoryHomeSnapshotRepository();
    const repository = new SnapshotHomeRepository(
      api,
      snapshots,
      "private-token",
      access,
      () => true,
    );

    await expect(repository.saveTravelFacts(updated.facts, initialTripHome.version)).resolves.toEqual(updated);
    await expect(snapshots.get(await hashAccessToken("private-token")))
      .resolves.toMatchObject({ home: updated });
  });
});
