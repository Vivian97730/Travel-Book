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
  });
}

itineraryRepositoryContract("Fake", () => new FakeItineraryRepository(sampleTripDays));
