import { describe, expect, it } from "vitest";
import { memberStorageKey, restoreMember } from "./memberSelectionStore";
import { legacyImportKey } from "./LegacyChecklistImport";
import { parseTripMembers, type TripMember } from "@travel-book/contracts";
const trip = "11111111-1111-4111-8111-111111111111";
const mother: TripMember = { tripId: trip, id: "22222222-2222-4222-8222-222222222222", roleKey: "mother", displayName: "媽媽" };
describe("trip scoped role selection", () => {
  it("restores a valid member after a new session, but requires selection when absent or deleted", () => {
    const saved = new Map([[memberStorageKey(trip), mother.id]]);
    const storage = { getItem: (key: string) => saved.get(key) ?? null };
    expect(restoreMember(trip, [mother], storage)).toEqual(mother);
    expect(restoreMember(trip, [], storage)).toBeNull();
    saved.clear();
    expect(restoreMember(trip, [mother], storage)).toBeNull();
  });
  it("never reuses a role across trips even if storage is tampered with", () => {
    expect(memberStorageKey(trip)).not.toBe(memberStorageKey(mother.id));
    expect(restoreMember(mother.id, [mother], { getItem: () => mother.id })).toBeNull();
    expect(restoreMember(trip, [mother], { getItem: () => { throw new Error("denied"); } })).toBeNull();
  });
  it("rejects malformed and duplicate roster entries", () => {
    expect(parseTripMembers([mother, mother])).toBeNull();
    expect(parseTripMembers([{ ...mother, id: "媽媽" }])).toBeNull();
  });
  it("retries a partial legacy import with identical keys scoped to the explicit owner", async () => {
    const entry = { kind: "luggage" as const, item: { id: 1, title: "護照", isDone: true } };
    const key = await legacyImportKey(entry, trip, mother.id);
    expect(await legacyImportKey(entry, trip, mother.id)).toBe(key);
    expect(await legacyImportKey(entry, mother.id, trip)).not.toBe(key);
    expect(await legacyImportKey({ ...entry, kind: "todos" }, trip, mother.id)).not.toBe(key);
  });
});
