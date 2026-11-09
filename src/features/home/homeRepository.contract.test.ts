import { describe, expect, it } from "vitest";
import { BrowserHomeRepository, type HomeStorage } from "./browserHomeRepository";
import { initialTripHome } from "./data";
import { FakeHomeRepository } from "./fakeHomeRepository";
import { ApiHomeRepository } from "./apiHomeRepository";
import type { HomeRepository } from "./homeRepository";

function createMemoryStorage(): HomeStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function homeReadRepositoryContract(name: string, createRepository: () => Pick<HomeRepository, "getTripHome">) {
  describe(`${name} HomeRepository read contract`, () => {
    it("returns isolated home data", async () => {
      const repository = createRepository();
      const first = await repository.getTripHome();
      first.facts[0].title = "被呼叫端修改";

      const second = await repository.getTripHome();
      expect(second.facts[0].title).toBe(initialTripHome.facts[0].title);
    });
  });
}

function homeWriteRepositoryContract(name: string, createRepository: () => HomeRepository) {
  describe(`${name} HomeRepository write contract`, () => {
    it("normalizes facts and advances the resource version", async () => {
      const repository = createRepository();
      const current = await repository.getTripHome();
      const saved = await repository.saveTravelFacts([
        { id: "new-1", icon: "info", title: "  第一張  ", content: "  內容一  ", sortOrder: 99 },
        { id: "new-2", icon: "water", title: "第二張", content: "內容二", sortOrder: 99 },
      ], current.version);

      expect(saved.version).toBe(current.version + 1);
      expect(saved.facts).toEqual([
        { id: "new-1", icon: "info", title: "第一張", content: "內容一", sortOrder: 0 },
        { id: "new-2", icon: "water", title: "第二張", content: "內容二", sortOrder: 1 },
      ]);
    });

    it("rejects a stale expected version without overwriting data", async () => {
      const repository = createRepository();
      const before = await repository.getTripHome();

      await expect(repository.saveTravelFacts(before.facts, before.version + 1))
        .rejects.toThrow("VERSION_CONFLICT");
      await expect(repository.getTripHome()).resolves.toEqual(before);
    });
  });
}

homeReadRepositoryContract("Fake", () => new FakeHomeRepository(initialTripHome));
homeReadRepositoryContract("Browser", () => new BrowserHomeRepository(createMemoryStorage()));
homeReadRepositoryContract("API", () => new ApiHomeRepository(
  "https://api.example",
  "private-token",
  async () => Response.json(structuredClone(initialTripHome)),
));
homeWriteRepositoryContract("Fake", () => new FakeHomeRepository(initialTripHome));
homeWriteRepositoryContract("Browser", () => new BrowserHomeRepository(createMemoryStorage()));
