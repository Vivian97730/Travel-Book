import { describe, expect, it, vi } from "vitest";
import { ApiHomeRepository } from "./apiHomeRepository";

const validHome = {
  title: "2027 過年東歐遊",
  subtitle: "維也納・哈修塔特・布達佩斯",
  dateLabel: "02/05 (五) - 02/15 (一)",
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

  it("saves one normalized fact batch with version and retry identity", async () => {
    const savedHome = { ...validHome, version: 2 };
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(savedHome));
    const repository = new ApiHomeRepository("https://api.example", "private-token", fetcher);

    await expect(repository.saveTravelFacts(validHome.facts, 1)).resolves.toEqual(savedHome);
    const [, init] = fetcher.mock.calls[0];
    expect(fetcher).toHaveBeenCalledWith("https://api.example/v1/home/facts", expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({
        authorization: "Bearer private-token",
        "idempotency-key": expect.any(String),
      }),
    }));
    expect(JSON.parse(String(init?.body))).toEqual({ expectedVersion: 1, facts: validHome.facts });
  });

  it("preserves the stable version-conflict error when saving", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      error: {
        code: "VERSION_CONFLICT",
        message: "資料已由其他裝置更新，請重新載入。",
        requestId: crypto.randomUUID(),
        details: {},
      },
    }, { status: 409 }));
    const repository = new ApiHomeRepository("https://api.example", "private-token", fetcher);

    await expect(repository.saveTravelFacts(validHome.facts, 1)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });
});
