import { describe, expect, it, vi } from "vitest";
import { ApiItineraryRepository } from "./apiItineraryRepository";

const validDay = {
  date: "2027-02-06",
  weekday: "六",
  city: "維也納",
  summary: "今天步調舒緩，景點集中在市中心。",
  version: 1,
  items: [],
};

describe("API ItineraryRepository", () => {
  it("requests the selected date with private access and returns TripDay", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(validDay));
    const repository = new ApiItineraryRepository("https://api.example", "private-token", fetcher);

    await expect(repository.getDay("2027-02-06")).resolves.toEqual(validDay);
    expect(fetcher).toHaveBeenCalledWith("https://api.example/v1/days/2027-02-06", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer private-token" }),
    }));
  });

  it("rejects invalid success payloads instead of leaking them into the page", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ date: "invalid" }));
    const repository = new ApiItineraryRepository("https://api.example", "private-token", fetcher);

    await expect(repository.getDay("2027-02-06")).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_UNAVAILABLE" });
  });

  it("preserves the stable API error code for a missing day", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      error: { code: "RESOURCE_NOT_FOUND", message: "找不到指定日期的行程。", requestId: crypto.randomUUID(), details: {} },
    }, { status: 404 }));
    const repository = new ApiItineraryRepository("https://api.example", "private-token", fetcher);

    await expect(repository.getDay("2027-02-20")).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
