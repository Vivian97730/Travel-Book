import { describe, expect, it, vi } from "vitest";
import { parseApiError } from "../../../packages/contracts/src/errors";
import { handleRequest, type HandlerDependencies } from "./handler";

const verifiedAccess = {
  trip: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "2027 奧地利・匈牙利之旅",
    startDate: "2027-02-05",
    endDate: "2027-02-15",
    displayTimezone: "Europe/Vienna",
  },
  resourceVersions: { itinerary: 1 },
};

function dependencies(verify = vi.fn(async () => verifiedAccess)): HandlerDependencies {
  return {
    accessStore: { verify },
    itineraryStore: {
      getDay: vi.fn(async () => ({
        date: "2027-02-06",
        weekday: "六",
        city: "維也納",
        summary: "今天步調舒緩，景點集中在市中心。",
        version: 1,
        items: [],
      })),
      saveDayItems: vi.fn(async (_tripId, date) => ({
        date,
        weekday: "六",
        city: "維也納",
        summary: "今天步調舒緩，景點集中在市中心。",
        version: 2,
        items: [],
      })),
    },
    allowedOrigins: new Set(["https://vivian97730.github.io", "http://localhost:5173"]),
    log: vi.fn(),
  };
}

describe("travel-book-api handler", () => {
  it("reports health without exposing configuration", async () => {
    const response = await handleRequest(new Request("http://localhost/health"), dependencies());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ service: "travel-book-api", status: "ok" });
  });

  it("verifies a valid private token and returns the trip scope", async () => {
    const deps = dependencies();
    const response = await handleRequest(new Request("http://localhost/v1/access/verify", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-private-token",
        origin: "https://vivian97730.github.io",
        "x-request-id": "request-123",
      },
    }), deps);

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://vivian97730.github.io");
    await expect(response.json()).resolves.toEqual(verifiedAccess);
    expect(deps.accessStore.verify).toHaveBeenCalledWith("valid-private-token");
  });

  it("returns one trip day after verifying private access", async () => {
    const deps = dependencies();
    const response = await handleRequest(new Request("http://localhost/v1/days/2027-02-06", {
      headers: { authorization: "Bearer valid-private-token" },
    }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ date: "2027-02-06", city: "維也納" });
    expect(deps.accessStore.verify).toHaveBeenCalledWith("valid-private-token");
    expect(deps.itineraryStore.getDay).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "2027-02-06",
    );
  });

  it("saves one complete itinerary batch after verifying private access", async () => {
    const deps = dependencies();
    const idempotencyKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const items = [{
      id: "20000000-0000-4000-8000-000000000001",
      title: "中央咖啡館午餐",
      note: "預留一小時",
      category: "food",
      sortOrder: 0,
    }];
    const response = await handleRequest(new Request("http://localhost/v1/days/2027-02-06", {
      method: "PUT",
      headers: {
        authorization: "Bearer valid-private-token",
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ expectedVersion: 1, items }),
    }), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ date: "2027-02-06", version: 2 });
    expect(deps.accessStore.verify).toHaveBeenCalledWith("valid-private-token");
    expect(deps.itineraryStore.saveDayItems).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "2027-02-06",
      items,
      1,
      idempotencyKey,
    );
  });

  it("returns a stable conflict when another device already saved the expected version", async () => {
    const deps = dependencies();
    vi.mocked(deps.itineraryStore.saveDayItems).mockRejectedValue(Object.assign(
      new Error("ITINERARY_STORE_UNAVAILABLE"),
      { status: 400, code: "VERSION_CONFLICT" },
    ));
    const response = await handleRequest(new Request("http://localhost/v1/days/2027-02-06", {
      method: "PUT",
      headers: {
        authorization: "Bearer valid-private-token",
        "content-type": "application/json",
        "idempotency-key": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      body: JSON.stringify({ expectedVersion: 1, items: [] }),
    }), deps);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(parseApiError(body)).toMatchObject({
      ok: true,
      value: {
        error: {
          code: "VERSION_CONFLICT",
          message: "資料已由其他裝置更新，請重新載入。",
          details: {},
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("ITINERARY_STORE_UNAVAILABLE");
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ status: 409, upstreamStatus: 400 }));
  });

  it("does not query itinerary storage when private access is denied", async () => {
    const deps = dependencies(vi.fn(async () => null));
    const response = await handleRequest(new Request("http://localhost/v1/days/2027-02-06", {
      headers: { authorization: "Bearer invalid-private-token" },
    }), deps);

    expect(response.status).toBe(401);
    expect(deps.itineraryStore.getDay).not.toHaveBeenCalled();
  });

  it("returns the stable missing-resource error when a trip day does not exist", async () => {
    const deps = dependencies();
    vi.mocked(deps.itineraryStore.getDay).mockResolvedValue(null);
    const response = await handleRequest(new Request("http://localhost/v1/days/2027-02-20", {
      headers: { authorization: "Bearer valid-private-token" },
    }), deps);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "RESOURCE_NOT_FOUND" } });
  });

  it.each([
    ["missing", undefined],
    ["invalid", "Bearer invalid-private-token"],
    ["revoked", "Bearer revoked-private-token"],
  ])("rejects %s private access without revealing why", async (_label, authorization) => {
    const deps = dependencies(vi.fn(async () => null));
    const headers = authorization ? { authorization } : undefined;
    const response = await handleRequest(new Request("http://localhost/v1/access/verify", { method: "POST", headers }), deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(parseApiError(body)).toMatchObject({
      ok: true,
      value: { error: { code: "ACCESS_DENIED", details: {} } },
    });
  });

  it("handles an allowed browser preflight and rejects an unknown origin", async () => {
    const deps = dependencies();
    const allowed = await handleRequest(new Request("http://localhost/v1/access/verify", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:5173" },
    }), deps);
    const rejected = await handleRequest(new Request("http://localhost/v1/access/verify", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }), deps);

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-headers")).toContain("authorization");
    expect(rejected.status).toBe(403);
  });

  it("logs request metadata without logging the private token", async () => {
    const deps = dependencies();
    await handleRequest(new Request("http://localhost/v1/access/verify", {
      method: "POST",
      headers: {
        authorization: "Bearer never-log-this-token",
        "x-request-id": "never-log-this-token",
      },
    }), deps);

    expect(deps.log).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(deps.log).mock.calls)).not.toContain("never-log-this-token");
  });

  it("maps an access store failure to a stable unavailable response", async () => {
    const error = Object.assign(new Error("database details"), { status: 401 });
    const deps = dependencies(vi.fn(async () => { throw error; }));
    const response = await handleRequest(new Request("http://localhost/v1/access/verify", {
      method: "POST",
      headers: { authorization: "Bearer private-token" },
    }), deps);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(parseApiError(body)).toMatchObject({
      ok: true,
      value: { error: { code: "EXTERNAL_SERVICE_UNAVAILABLE", details: {} } },
    });
    expect(JSON.stringify(body)).not.toContain("database details");
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ upstreamStatus: 401 }));
  });

  it("returns the shared stable error contract for unknown routes", async () => {
    const response = await handleRequest(new Request("http://localhost/unknown"), dependencies());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(parseApiError(body)).toMatchObject({ ok: true, value: { error: { code: "RESOURCE_NOT_FOUND" } } });
  });
});
