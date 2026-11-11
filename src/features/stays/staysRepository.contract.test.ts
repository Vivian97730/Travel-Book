import { describe, expect, it } from "vitest";
import { parseStayInput, parseStaysResponse, parseUpdateStayRequest, type StayInput } from "@travel-book/contracts";
import { FakeStaysRepository } from "./fakeStaysRepository";

const input: StayInput = {
  name: "測試住宿", city: "維也納", address: "示意地址",
  startDate: "2027-02-05", endDate: "2027-02-08",
  checkin: "15:00", checkout: "11:00", photo: null,
};

describe("stays contract", () => {
  it("validates versioned reads and mutation versions", async () => {
    const repository = new FakeStaysRepository();
    const stay = await repository.createStay(input);
    expect(parseStaysResponse({ schemaVersion: 1, stays: [stay] }).ok).toBe(true);
    expect(parseStaysResponse({ schemaVersion: 2, stays: [stay] }).ok).toBe(false);
    expect(parseStaysResponse({ schemaVersion: 1, stays: [stay, stay] }).ok).toBe(false);
    expect(parseStaysResponse({ schemaVersion: 1, stays: [{ ...stay, version: 0 }] }).ok).toBe(false);
    expect(parseUpdateStayRequest({ ...input, expectedVersion: 1 }).ok).toBe(true);
    expect(parseUpdateStayRequest({ ...input, expectedVersion: 0 }).ok).toBe(false);
  });
  it("validates dates, times and photo provenance", () => {
    expect(parseStayInput(input).ok).toBe(true);
    expect(parseStayInput({ ...input, photo: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }).ok).toBe(true);
    expect(parseStayInput({ ...input, photo: { id: "../other-trip/photo" } }).ok).toBe(false);
    for (const invalid of [
      { endDate: input.startDate }, { startDate: "2027-02-30" },
      { checkin: "24:00" }, { name: "" }, { photo: { photoUri: "https://example.com" } },
    ]) expect(parseStayInput({ ...input, ...invalid }).ok).toBe(false);
  });

  it("sorts, preserves copies, rejects stale writes and isolates repositories", async () => {
    const repository = new FakeStaysRepository();
    const first = await repository.createStay(input);
    const later = await repository.createStay({ ...input, startDate: "2027-02-08", endDate: "2027-02-10" });
    first.name = "不應寫入";
    expect((await repository.getStays())[0].name).toBe(input.name);
    const updated = await repository.updateStay(later.id, { ...input, startDate: "2027-02-04" }, 1);
    expect(updated.version).toBe(2);
    expect((await repository.getStays())[0].id).toBe(later.id);
    await expect(repository.deleteStay(later.id, 1)).rejects.toThrow("VERSION_CONFLICT");
    await expect(new FakeStaysRepository().updateStay(first.id, input, 1)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await repository.deleteStay(later.id, 2);
    expect(await repository.getStays()).toHaveLength(1);
  });
});
