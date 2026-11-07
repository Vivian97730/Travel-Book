import { describe, expect, it, vi } from "vitest";
import { HomeStoreRequestError, SupabaseHomeStore } from "./homeStore";

const tripId = "11111111-1111-4111-8111-111111111111";

const homePayload = {
  title: "2027 過年東歐遊",
  subtitle: "維也納・哈修塔特・布達佩斯",
  startDate: "2027-02-05",
  endDate: "2027-02-15",
  displayTimezone: "Europe/Vienna",
  travelerCount: 4,
  version: 2,
  flights: [],
  facts: [{
    id: "50000000-0000-4000-8000-000000000001",
    icon: "globe",
    title: "和台灣的時差",
    content: "冬季慢 7 小時",
    sortOrder: 0,
  }],
};

describe("Supabase home store", () => {
  it("maps the private RPC payload to the shared TripHome contract", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      title: "2027 過年東歐遊",
      subtitle: "維也納・哈修塔特・布達佩斯",
      startDate: "2027-02-05",
      endDate: "2027-02-15",
      displayTimezone: "Europe/Vienna",
      travelerCount: 4,
      version: 1,
      flights: [{
        id: "40000000-0000-4000-8000-000000000001",
        direction: "去程",
        legs: [
          { airport: "TPE", city: "桃園", time: "00:20" },
          { airport: "VIE", city: "維也納", time: "12:25" },
        ],
        departureAt: "2027-02-04T16:20:00+00:00",
        arrivalAt: "2027-02-05T11:25:00+00:00",
        durationMinutes: 1_145,
      }],
      facts: [{
        id: "50000000-0000-4000-8000-000000000001",
        icon: "globe",
        title: "和台灣的時差",
        content: "冬季慢 7 小時",
        sortOrder: 0,
      }],
    }));
    const store = new SupabaseHomeStore("https://project.supabase.co", "secret-key", fetcher);

    await expect(store.getHome(tripId)).resolves.toMatchObject({
      dateLabel: "2027／02／05－02／15",
      durationLabel: "11 天 10 夜",
      flights: [{ direction: "去程", duration: "19 小時 05 分" }],
      facts: [{ title: "和台灣的時差", sortOrder: 0 }],
    });
    expect(fetcher).toHaveBeenCalledWith("https://project.supabase.co/rest/v1/rpc/get_trip_home", {
      method: "POST",
      headers: { apikey: "secret-key", "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId }),
    });
  });

  it("returns null when the RPC has no trip home", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(null));
    const store = new SupabaseHomeStore("https://project.supabase.co", "secret-key", fetcher);

    await expect(store.getHome(tripId)).resolves.toBeNull();
  });

  it("sends one versioned and idempotent fact batch to the private RPC", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(homePayload));
    const store = new SupabaseHomeStore("https://project.supabase.co", "secret-key", fetcher);
    const facts = homePayload.facts.map((fact) => ({ ...fact, icon: "globe" as const }));

    await expect(store.saveFacts(tripId, facts, 1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
      .resolves.toMatchObject({ version: 2, facts });
    expect(fetcher).toHaveBeenCalledWith("https://project.supabase.co/rest/v1/rpc/save_travel_facts", {
      method: "POST",
      headers: { apikey: "secret-key", "content-type": "application/json" },
      body: JSON.stringify({
        p_trip_id: tripId,
        p_facts: facts,
        p_expected_version: 1,
        p_idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    });
  });

  it("maps the private RPC conflict without exposing its body", async () => {
    const rejected = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(
      { message: "VERSION_CONFLICT", details: "sensitive" },
      { status: 400 },
    ));
    const store = new SupabaseHomeStore("https://project.supabase.co", "secret-key", rejected);

    await expect(store.saveFacts(tripId, [], 1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
      .rejects.toEqual(new HomeStoreRequestError(400, "VERSION_CONFLICT"));
  });

  it("rejects upstream failures and invalid home payloads", async () => {
    const rejected = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => new Response(
      JSON.stringify({ message: "sensitive database details" }),
      { status: 500 },
    ));
    const invalid = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      title: "incomplete",
    }));

    await expect(new SupabaseHomeStore("https://project.supabase.co", "secret", rejected).getHome(tripId))
      .rejects.toEqual(new HomeStoreRequestError(500));
    await expect(new SupabaseHomeStore("https://project.supabase.co", "secret", invalid).getHome(tripId))
      .rejects.toThrow("HOME_STORE_INVALID_RESPONSE");
  });
});
