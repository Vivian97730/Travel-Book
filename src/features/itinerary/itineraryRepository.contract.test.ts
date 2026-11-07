import { describe, expect, it } from "vitest";
import { FakeItineraryRepository } from "./fakeItineraryRepository";
import type { ItineraryRepository } from "./itineraryRepository";
import { sampleTripDays } from "./sampleTripDays";

function itineraryRepositoryContract(name: string, createRepository: () => ItineraryRepository) {
  describe(`${name} ItineraryRepository contract`, () => {
    it("returns the requested day without sharing mutable state", async () => {
      const repository = createRepository();
      const first = await repository.getDay("2027-02-06");
      first.items[0].title = "被呼叫端修改";

      const second = await repository.getDay("2027-02-06");
      expect(second).toEqual(sampleTripDays[1]);
    });

    it("reports a missing trip day through the repository seam", async () => {
      const repository = createRepository();

      await expect(repository.getDay("2027-02-20")).rejects.toThrow("RESOURCE_NOT_FOUND");
    });

    it("saves one ordered item batch and preserves places for retained items", async () => {
      const repository = createRepository();
      const saved = await repository.saveDayItems("2027-02-06", [
        {
          id: "20000000-0000-4000-8000-000000000003",
          title: "中央咖啡館早午餐",
          note: "已完成訂位",
          category: "food",
          sortOrder: 0,
        },
        {
          id: "20000000-0000-4000-8000-000000000005",
          title: "晚間音樂會",
          note: "提前三十分鐘入場",
          category: "sight",
          sortOrder: 1,
        },
      ], 1);

      expect(saved).toMatchObject({
        version: 2,
        items: [
          { title: "中央咖啡館早午餐", sortOrder: 0, place: { name: "Cafe Central" } },
          { title: "晚間音樂會", sortOrder: 1, place: null },
        ],
      });
      await expect(repository.getDay("2027-02-06")).resolves.toEqual(saved);
    });
  });
}

itineraryRepositoryContract("Fake", () => new FakeItineraryRepository(sampleTripDays));
