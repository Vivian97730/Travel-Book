import { describe, expect, it, vi } from "vitest";
import { ItineraryStoreRequestError, SupabaseItineraryStore } from "./itineraryStore";

const tripId = "11111111-1111-4111-8111-111111111111";

describe("Supabase itinerary store", () => {
  it("maps the private RPC payload to the shared TripDay contract", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      date: "2027-02-06",
      weekday: "六",
      city: "維也納",
      summary: "今天步調舒緩，景點集中在市中心。",
      version: 1,
      items: [{
        id: "20000000-0000-4000-8000-000000000001",
        title: "搭地鐵前往美泉宮",
        note: "從住宿地點出發，約 25 分鐘",
        category: "transit",
        sortOrder: 0,
        place: null,
      }],
    }));
    const store = new SupabaseItineraryStore("https://project.supabase.co", "secret-key", fetcher);

    await expect(store.getDay(tripId, "2027-02-06")).resolves.toMatchObject({
      date: "2027-02-06",
      items: [{ title: "搭地鐵前往美泉宮", place: null }],
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/rest/v1/rpc/get_trip_day");
    expect(init).toMatchObject({
      method: "POST",
      headers: { apikey: "secret-key", "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId, p_date: "2027-02-06" }),
    });
  });

  it("returns null when the RPC has no trip day", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(null));
    const store = new SupabaseItineraryStore("https://project.supabase.co", "secret-key", fetcher);

    await expect(store.getDay(tripId, "2027-02-20")).resolves.toBeNull();
  });

  it("reports only the upstream status for rejected or invalid responses", async () => {
    const rejected = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => new Response(
      JSON.stringify({ message: "sensitive database details" }),
      { status: 500 },
    ));
    const invalid = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ date: "invalid" }));

    await expect(new SupabaseItineraryStore("https://project.supabase.co", "secret", rejected).getDay(tripId, "2027-02-06"))
      .rejects.toEqual(new ItineraryStoreRequestError(500));
    await expect(new SupabaseItineraryStore("https://project.supabase.co", "secret", invalid).getDay(tripId, "2027-02-06"))
      .rejects.toThrow("ITINERARY_STORE_INVALID_RESPONSE");
  });

  it("saves one complete item batch through the private transaction RPC", async () => {
    const savedDay = {
      date: "2027-02-06",
      weekday: "六",
      city: "維也納",
      summary: "今天步調舒緩，景點集中在市中心。",
      version: 2,
      items: [],
    };
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(savedDay));
    const store = new SupabaseItineraryStore("https://project.supabase.co", "secret-key", fetcher);
    const items = [{
      id: "20000000-0000-4000-8000-000000000001",
      title: "中央咖啡館午餐",
      note: "預留一小時",
      category: "food" as const,
      sortOrder: 0,
    }];

    await expect(store.saveDayItems(
      tripId,
      "2027-02-06",
      items,
      1,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    )).resolves.toEqual(savedDay);
    expect(fetcher).toHaveBeenCalledWith("https://project.supabase.co/rest/v1/rpc/save_trip_day_items", {
      method: "POST",
      headers: { apikey: "secret-key", "content-type": "application/json" },
      body: JSON.stringify({
        p_trip_id: tripId,
        p_date: "2027-02-06",
        p_items: items,
        p_expected_version: 1,
        p_idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    });
  });
});
