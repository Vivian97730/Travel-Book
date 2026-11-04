import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiClientError } from "./apiClient";

const verifiedTrip = {
  trip: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "2027 奧地利・匈牙利之旅",
    startDate: "2027-02-05",
    endDate: "2027-02-15",
    displayTimezone: "Europe/Vienna",
  },
  resourceVersions: { itinerary: 1 },
};

describe("API client", () => {
  it("verifies a private token through the configured Edge Function URL", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(verifiedTrip));
    const client = new ApiClient("https://project.supabase.co/functions/v1/travel-book-api/", fetcher);

    await expect(client.verifyAccess("private-token")).resolves.toEqual(verifiedTrip);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toBe("https://project.supabase.co/functions/v1/travel-book-api/v1/access/verify");
    expect(headers.get("authorization")).toBe("Bearer private-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("maps the stable API error without exposing the token", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      error: {
        code: "ACCESS_DENIED",
        message: "私人連結無效或已撤銷。",
        requestId: "request-123",
        details: {},
      },
    }, { status: 401 }));
    const client = new ApiClient("https://project.supabase.co/functions/v1/travel-book-api", fetcher);

    const error = await client.verifyAccess("revoked-private-token").catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: "ACCESS_DENIED", requestId: "request-123" });
    expect(JSON.stringify(error)).not.toContain("revoked-private-token");
  });

  it("calls the fetch implementation without binding it to the API client", async () => {
    const fetcher = vi.fn(async function (this: unknown) {
      expect(this).toBeUndefined();
      return Response.json(verifiedTrip);
    });
    const client = new ApiClient("https://project.supabase.co/functions/v1/travel-book-api", fetcher);

    await expect(client.verifyAccess("private-token")).resolves.toEqual(verifiedTrip);
  });
});
