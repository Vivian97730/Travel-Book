import { describe, expect, it, vi } from "vitest";
import { ApiHomeRepository } from "./apiHomeRepository";

const validHome = {
  title: "2027 過年東歐遊",
  subtitle: "維也納・哈修塔特・布達佩斯",
  dateLabel: "2027／02／05－02／15",
  durationLabel: "11 天 10 夜",
  travelerCount: 4,
  version: 1,
  flights: [{
    direction: "去程" as const,
    duration: "19 小時 05 分",
    legs: [
      { airport: "TPE", city: "桃園", time: "00:20" },
      { airport: "VIE", city: "維也納", time: "12:25" },
    ],
  }],
  facts: [{
    id: "50000000-0000-4000-8000-000000000001",
    icon: "globe" as const,
    title: "和台灣的時差",
    content: "冬季慢 7 小時",
    sortOrder: 0,
  }],
};

describe("API HomeRepository", () => {
  it("requests the formal home endpoint with private access", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(validHome));
    const repository = new ApiHomeRepository("https://api.example", "private-token", fetcher);

    await expect(repository.getTripHome()).resolves.toEqual(validHome);
    expect(fetcher).toHaveBeenCalledWith("https://api.example/v1/home", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer private-token" }),
    }));
  });

  it("rejects invalid success payloads", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      title: "incomplete",
    }));
    const repository = new ApiHomeRepository("https://api.example", "private-token", fetcher);

    await expect(repository.getTripHome()).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_UNAVAILABLE" });
  });

  it("preserves the stable access-denied error", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      error: {
        code: "ACCESS_DENIED",
        message: "私人連結無效或已撤銷。",
        requestId: crypto.randomUUID(),
        details: {},
      },
    }, { status: 401 }));
    const repository = new ApiHomeRepository("https://api.example", "private-token", fetcher);

    await expect(repository.getTripHome()).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
});
