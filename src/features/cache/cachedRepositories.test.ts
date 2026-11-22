import { describe, expect, it, vi } from "vitest";
import type { Stay, StayInput } from "@travel-book/contracts";
import { ResourceCache, TEXT_FRESH_MS } from "./resourceCache";
import { cachedHome, cachedStays, cachedChecklist } from "./cachedRepositories";
import { initialTripHome } from "../home/data";
import { ApiHomeRepository } from "../home/apiHomeRepository";
import { ApiStaysRepository } from "../stays/apiStaysRepository";

const stay: Stay = { id: "22222222-2222-4222-8222-222222222222", name: "測試住宿", city: "維也納", address: "測試地址", startDate: "2027-02-06", endDate: "2027-02-08", checkin: "15:00", checkout: "11:00", photo: { id: "33333333-3333-4333-8333-333333333333" }, placeId: null, version: 1 };
const homeFixture = { ...initialTripHome, facts: initialTripHome.facts.map((fact, index) => ({ ...fact, id: `77777777-7777-4777-8777-77777777777${index}` })) };
const input: StayInput = { ...stay };
describe("cached repository integration", () => {
  it("preserves Bearer-only API reads and caches parsed home mutations without another GET", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => Response.json({ ...homeFixture, version: init?.method === "PUT" ? 2 : 1 }));
    const api = new ApiHomeRepository("https://test.invalid", "synthetic", fetcher);
    const repository = cachedHome(api, new ResourceCache());
    await Promise.all([repository.getTripHome(), repository.getTripHome()]);
    await repository.saveTravelFacts(homeFixture.facts, 1);
    expect((await repository.getTripHome()).version).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { authorization: "Bearer synthetic" }, cache: "no-store" });
  });
  it("never shares text or photo memory between access scopes", async () => {
    const first = cachedHome({ getTripHome: async () => initialTripHome, saveTravelFacts: vi.fn() }, new ResourceCache());
    const denied = vi.fn(async () => { throw { code: "ACCESS_DENIED" }; });
    const second = cachedHome({ getTripHome: denied, saveTravelFacts: vi.fn() }, new ResourceCache());
    await first.getTripHome(); await expect(second.getTripHome()).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    const photo = new Blob(["jpeg"], { type: "image/jpeg" }); const load = vi.fn(async () => photo);
    await new ResourceCache().photo("same-id", load); await new ResourceCache().photo("same-id", load); expect(load).toHaveBeenCalledTimes(2);
  });
  it("keeps photo HTTP no-store and drops a deleted photo from the private memory cache", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/v1/stays")) return Response.json({ schemaVersion: 1, stays: [stay] });
      if (init?.method === "DELETE") return Response.json({ removed: true });
      return new Response("jpeg", { headers: { "content-type": "image/jpeg" } });
    });
    const repository = cachedStays(new ApiStaysRepository("https://test.invalid", "synthetic", fetcher), new ResourceCache());
    await repository.getStays(); await repository.readPhoto!(stay.photo!.id); await repository.readPhoto!(stay.photo!.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ cache: "no-store", headers: { authorization: "Bearer synthetic" } });
    await repository.removePhoto!(stay.photo!.id); await repository.readPhoto!(stay.photo!.id); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("propagates photo access denial and stops the private cache", async () => {
    const denied = vi.fn();
    const cache = new ResourceCache(undefined, Date.now, denied);
    const api = new ApiStaysRepository("https://test.invalid", "synthetic", async () => Response.json({
      error: { code: "ACCESS_DENIED", message: "Denied", requestId: "synthetic", details: {} },
    }, { status: 401 }));
    const repository = cachedStays(api, cache);
    await expect(repository.readPhoto!(stay.photo!.id)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(denied).toHaveBeenCalledOnce();
    await expect(cache.photo("other", async () => new Blob())).rejects.toThrow("CACHE_STOPPED");
  });
  it("updates a full stays collection from mutation results and evicts replaced photos", async () => {
    const updated = { ...stay, name: "新名稱", version: 2, photo: null };
    const source = { getStays: vi.fn(async () => [stay]), createStay: vi.fn(async () => stay), updateStay: vi.fn(async () => updated), deleteStay: vi.fn(async () => {}), readPhoto: vi.fn(async () => new Blob(["jpeg"], { type: "image/jpeg" })) };
    const repository = cachedStays(source, new ResourceCache());
    await repository.getStays(); await repository.readPhoto!(stay.photo!.id);
    await repository.updateStay(stay.id, input, 1); expect(await repository.getStays()).toEqual([updated]);
    await repository.readPhoto!(stay.photo!.id); expect(source.readPhoto).toHaveBeenCalledTimes(2);
    await repository.deleteStay(stay.id, 2); expect(await repository.getStays()).toEqual([]); expect(source.getStays).toHaveBeenCalledOnce();
    await repository.createStay(input); expect(await repository.getStays()).toEqual([stay]); expect(source.getStays).toHaveBeenCalledOnce();
  });
  it("isolates checklist kinds and members, including background freshness", async () => {
    let now = 1000; const cache = new ResourceCache(undefined, () => now); const list = { schemaVersion: 1 as const, version: 1, items: [] };
    const a = { getSharedChecklist: vi.fn(async () => list), mutateSharedChecklist: vi.fn(async () => ({ ...list, version: 2 })) };
    const b = { getSharedChecklist: vi.fn(async () => list), mutateSharedChecklist: vi.fn() };
    const mother = cachedChecklist(a, cache, "personal:trip:mother:todos");
    const father = cachedChecklist(b, cache, "personal:trip:father:todos");
    await mother.getSharedChecklist(); await father.getSharedChecklist(); expect(b.getSharedChecklist).toHaveBeenCalledOnce();
    await mother.mutateSharedChecklist({ action: "create", input: { title: "雨傘" } }, "synthetic-key");
    expect((await mother.getSharedChecklist()).version).toBe(2); expect((await father.getSharedChecklist()).version).toBe(1);
    now += TEXT_FRESH_MS; await mother.getSharedChecklist(); await vi.waitFor(() => expect(a.getSharedChecklist).toHaveBeenCalledTimes(2));
  });
});
