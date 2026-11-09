import { describe, expect, it, vi } from "vitest";
import { ApiStaysRepository } from "./apiStaysRepository";
import { SupabaseStaysStore } from "../../../supabase/functions/travel-book-api/adapters/postgres/staysStore";

describe("stays read adapters", () => {
  it("maps only known Postgres mutation errors and passes the complete transaction metadata", async () => {
    const fetcher = vi.fn(async () => Response.json({ message: "VERSION_CONFLICT" }, { status: 400 }));
    const store = new SupabaseStaysStore("https://db.example/", "test-key", fetcher);
    await expect(store.mutateStay("trip", "delete", "stay", null, 2, "key")).rejects.toMatchObject({ code: "VERSION_CONFLICT", message: "STAYS_STORE_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledWith("https://db.example/rest/v1/rpc/mutate_trip_stay", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ p_trip_id: "trip", p_action: "delete", p_id: "stay", p_input: null, p_expected_version: 2, p_idempotency_key: "key" }),
    }));
    await expect(new SupabaseStaysStore("", "", async () => Response.json({ message: "private detail" }, { status: 500 })).mutateStay("trip", "delete", "stay", null, 2, "key")).rejects.toMatchObject({ code: undefined, message: "STAYS_STORE_UNAVAILABLE" });
  });
  it("reuses mutation keys after ambiguous failures and uses a new key after success", async () => {
    const input = { name: "測試住宿", city: "維也納", address: "測試地址", startDate: "2027-02-05", endDate: "2027-02-08", checkin: "15:00", checkout: "11:00", photo: null };
    const saved = { ...input, id: "60000000-0000-4000-8000-000000000001", version: 1, placeId: null };
    const fetcher = vi.fn<(...args: [string, RequestInit?]) => Promise<Response>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementation(async () => Response.json({ schemaVersion: 1, stays: [saved] }));
    const repository = new ApiStaysRepository("", "test-token", fetcher);
    await expect(repository.createStay(input)).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_UNAVAILABLE" });
    expect(await repository.createStay(input)).toEqual(saved);
    await repository.createStay(input);
    const keys = fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get("idempotency-key"));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("sends resource versions and maps write conflicts without changing input", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: { code: "VERSION_CONFLICT", message: "衝突", requestId: "test", details: {} } }, { status: 409 }));
    const repository = new ApiStaysRepository("", "test-token", fetcher);
    await expect(repository.deleteStay("60000000-0000-4000-8000-000000000001", 2)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/v1/stays/60000000"), expect.objectContaining({ method: "DELETE", body: '{"expectedVersion":2}' }));
  });
  it("uses authenticated API and validates responses", async () => {
    const fetcher = vi.fn(async () => Response.json({ schemaVersion: 1, stays: [] }));
    expect(await new ApiStaysRepository("https://api.example/", "test-token", fetcher).getStays()).toEqual([]);
    expect(fetcher).toHaveBeenCalledWith("https://api.example/v1/stays", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer test-token" }),
    }));
    await expect(new ApiStaysRepository("", "", async () => Response.json({ stays: [] })).getStays()).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_UNAVAILABLE" });
    await expect(new ApiStaysRepository("", "", async () => { throw new Error("network"); }).getStays()).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_UNAVAILABLE" });
    await expect(new ApiStaysRepository("", "", async () => Response.json({ error: { code: "ACCESS_DENIED", message: "失效", requestId: "test", details: {} } }, { status: 401 })).getStays()).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("scopes private RPC and rejects malformed database payloads", async () => {
    const fetcher = vi.fn(async () => Response.json({ schemaVersion: 1, stays: [] }));
    expect(await new SupabaseStaysStore("https://db.example", "test-key", fetcher).getStays("trip")).toEqual({ schemaVersion: 1, stays: [] });
    expect(fetcher).toHaveBeenCalledWith("https://db.example/rest/v1/rpc/get_trip_stays", expect.objectContaining({ body: JSON.stringify({ p_trip_id: "trip" }) }));
    await expect(new SupabaseStaysStore("", "", async () => Response.json({})).getStays("trip")).rejects.toThrow("STAYS_STORE_INVALID_RESPONSE");
    await expect(new SupabaseStaysStore("", "", async () => new Response("", { status: 500 })).getStays("trip")).rejects.toThrow("STAYS_STORE_UNAVAILABLE");
  });
});
