import { expect, it, vi } from "vitest";
import type { AccessVerifyResponse, Stay } from "@travel-book/contracts";
import { SnapshotStaysRepository } from "./snapshotStaysRepository";
import { createStaysSnapshot, parseStaysSnapshot, type StaysSnapshot } from "./staysSnapshot";

const access: AccessVerifyResponse = {
  trip: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "測試旅程",
    startDate: "2027-02-05",
    endDate: "2027-02-15",
    displayTimezone: "Europe/Vienna",
  },
  resourceVersions: { stays: 1 },
};
const stay: Stay = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "測試住宿", city: "維也納", address: "測試地址", startDate: "2027-02-06",
  endDate: "2027-02-08", checkin: "15:00", checkout: "11:00",
  photo: null, placeId: null, version: 1,
};

it("shares the latest saved collection across reads and offline reloads", async () => {
  const updated = { ...stay, name: "新住宿名稱", version: 2 };
  const source = {
    getStays: vi.fn().mockResolvedValueOnce([stay]).mockResolvedValue([updated]),
    createStay: vi.fn(),
    updateStay: vi.fn().mockResolvedValue(updated),
    deleteStay: vi.fn(),
    uploadPhoto: vi.fn(),
    readPhoto: vi.fn(),
  };
  const values = new Map<string, StaysSnapshot>();
  const snapshots = {
    get: async (hash: string) => values.get(hash) ?? null,
    put: async (snapshot: StaysSnapshot) => { values.set(snapshot.tokenHash, snapshot); },
    delete: async (hash: string) => { values.delete(hash); },
  };
  let online = true;
  const repository = new SnapshotStaysRepository(source, snapshots, "test-token", access, () => online);
  expect(await repository.getStays()).toEqual([stay]);
  await repository.updateStay(stay.id, updated, stay.version);
  online = false;
  const reopened = new SnapshotStaysRepository(source, snapshots, "test-token", access, () => online);
  expect(await reopened.getStays()).toEqual([updated]);
  expect(reopened.lastSyncedAt).not.toBeNull();
  await expect(reopened.deleteStay(stay.id, 2)).rejects.toThrow("OFFLINE_READ_ONLY");
  await expect(reopened.readPhoto(stay.id)).rejects.toThrow("OFFLINE_READ_ONLY");
  const other = new SnapshotStaysRepository(source, snapshots, "other-token", access, () => online);
  await expect(other.getStays()).rejects.toThrow("OFFLINE_SNAPSHOT_UNAVAILABLE");
  expect(source.getStays).toHaveBeenCalledTimes(2);
  online = true;
  expect(await reopened.getStays()).toEqual([updated]);
  expect(source.getStays).toHaveBeenCalledTimes(3);
});

it("rejects malformed and expired cached data", () => {
  const now = Date.now();
  const hash = "a".repeat(64);
  const snapshot = createStaysSnapshot(hash, access, [stay], now);
  expect(parseStaysSnapshot(snapshot, hash, now)).toEqual(snapshot);
  expect(parseStaysSnapshot({ ...snapshot, stays: [{ ...stay, name: "" }] }, hash, now)).toBeNull();
  expect(parseStaysSnapshot(snapshot, hash, Date.parse(snapshot.expiresAt))).toBeNull();
});
