import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberChecklistRepository } from "./memberChecklistRepository";
import { CoreSnapshots } from "../offline/coreSnapshots";
import { writeChecklist } from "../checklists/checklistSource";

const mother = "22222222-2222-4222-8222-222222222222";
const father = "33333333-3333-4333-8333-333333333333";
const item = { id: "44444444-4444-4444-8444-444444444444", version: 3, title: "護照", isDone: true, sortOrder: 0 };
const data = { schemaVersion: 1 as const, version: 5, items: [item] };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function snapshots() {
  vi.spyOn(CoreSnapshots.prototype, "put").mockResolvedValue(undefined);
  vi.spyOn(CoreSnapshots.prototype, "deleteResource").mockResolvedValue(undefined);
}
describe("member checklist isolation and recovery", () => {
  it("scopes requests and caches by trip, member and kind; sends optimistic versions and retry keys", async () => {
    snapshots();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(data)));
    vi.stubGlobal("fetch", fetcher);
    const repository = new MemberChecklistRepository("https://api.test", "synthetic", "hash", "trip-a", mother, () => true);
    await repository.forKind("luggage").getSharedChecklist();
    const key = crypto.randomUUID();
    await writeChecklist({ kind: "luggage", repository }, { action: "toggle", item }, key, [item]);
    const [url, init] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toContain(`/members/${mother}/checklists/luggage/${item.id}`);
    expect(JSON.parse(init.body as string)).toEqual({ isDone: false, expectedVersion: 3 });
    expect(init.headers).toMatchObject({ "idempotency-key": key, authorization: "Bearer synthetic" });
    expect(CoreSnapshots.prototype.put).toHaveBeenCalledWith("hash", `personal:trip-a:${mother}:luggage`, data);
    await repository.stop();
    expect(CoreSnapshots.prototype.deleteResource).toHaveBeenCalledWith("hash", `personal:trip-a:${mother}:luggage`);
    await expect(repository.forKind("luggage").getSharedChecklist()).rejects.toThrow("MEMBER_CHANGED");
    const next = new MemberChecklistRepository("https://api.test", "synthetic", "hash", "trip-a", father, () => true);
    await next.forKind("todos").getSharedChecklist();
    expect(CoreSnapshots.prototype.put).toHaveBeenLastCalledWith("hash", `personal:trip-a:${father}:todos`, data);
  });
  it("keeps API failures from replacing a saved list with an empty snapshot", async () => {
    snapshots();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(data))).mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const repository = new MemberChecklistRepository("https://api.test", "synthetic", "hash", "trip-a", mother, () => true);
    await repository.forKind("luggage").getSharedChecklist();
    await expect(repository.forKind("luggage").getSharedChecklist()).rejects.toThrow();
    expect(CoreSnapshots.prototype.put).toHaveBeenCalledTimes(1);
  });
  it("preserves private snapshots when the app unmounts after a temporary verification error", async () => {
    snapshots();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data))));
    const repository = new MemberChecklistRepository("https://api.test", "synthetic", "hash", "trip-a", mother, () => true);
    await repository.forKind("luggage").getSharedChecklist();
    await repository.stopSaving();
    expect(CoreSnapshots.prototype.deleteResource).not.toHaveBeenCalled();
    await expect(repository.forKind("luggage").getSharedChecklist()).rejects.toThrow("MEMBER_CHANGED");
    await repository.stop();
    expect(CoreSnapshots.prototype.deleteResource).toHaveBeenCalledTimes(2);
  });
  it("reads only the selected member snapshot offline and refuses writes", async () => {
    snapshots();
    const get = vi.spyOn(CoreSnapshots.prototype, "get").mockResolvedValue({ tokenHash: "hash", resource: "test", snapshotVersion: 1,
      data, syncedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+10000).toISOString() });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const repository = new MemberChecklistRepository("https://api.test", "synthetic", "hash", "trip-a", mother, () => false);
    expect(await repository.forKind("todos").getSharedChecklist()).toEqual(data);
    expect(get).toHaveBeenCalledWith("hash", `personal:trip-a:${mother}:todos`);
    await repository.readSnapshotInfo("todos");
    expect(get).toHaveBeenLastCalledWith("hash", `personal:trip-a:${mother}:todos`);
    await expect(repository.forKind("todos").mutateSharedChecklist({ action: "create", input: { title: "test" } }, crypto.randomUUID())).rejects.toThrow("READ_ONLY");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not retain an old member response that finishes after switching", async () => {
    snapshots();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((done) => { resolve = done; }));
    const repository = new MemberChecklistRepository("https://api.test", "synthetic", "hash", "trip-a", mother, () => true);
    const pending = repository.forKind("luggage").getSharedChecklist();
    await repository.stop();
    resolve(new Response(JSON.stringify(data)));
    await pending;
    expect(CoreSnapshots.prototype.put).not.toHaveBeenCalled();
  });
});
