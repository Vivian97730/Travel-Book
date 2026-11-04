import { describe, expect, it, vi } from "vitest";
import { AccessStoreRequestError, SupabaseAccessStore } from "./accessStore";

describe("Supabase access store", () => {
  it("maps the private RPC result without returning database rows directly", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json([{
      trip_id: "11111111-1111-4111-8111-111111111111",
      trip_title: "2027 奧地利・匈牙利之旅",
      start_date: "2027-02-05",
      end_date: "2027-02-15",
      display_timezone: "Europe/Vienna",
      resource_versions: { itinerary: 1 },
    }]));
    const store = new SupabaseAccessStore("https://project.supabase.co", "secret-key", fetcher);

    await expect(store.verify("private-token")).resolves.toEqual({
      trip: {
        id: "11111111-1111-4111-8111-111111111111",
        title: "2027 奧地利・匈牙利之旅",
        startDate: "2027-02-05",
        endDate: "2027-02-15",
        displayTimezone: "Europe/Vienna",
      },
      resourceVersions: { itinerary: 1 },
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/rest/v1/rpc/verify_trip_access");
    expect(init?.headers).toMatchObject({ apikey: "secret-key" });
    expect(init?.headers).not.toHaveProperty("authorization");
  });

  it("returns null for an unknown or revoked token", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json([]));
    const store = new SupabaseAccessStore("https://project.supabase.co", "secret-key", fetcher);
    await expect(store.verify("revoked-token")).resolves.toBeNull();
  });

  it("reports only the upstream status when PostgREST rejects a request", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => new Response(
      JSON.stringify({ message: "sensitive database details" }),
      { status: 401 },
    ));
    const store = new SupabaseAccessStore("https://project.supabase.co", "secret-key", fetcher);

    await expect(store.verify("private-token")).rejects.toEqual(new AccessStoreRequestError(401));
  });
});
