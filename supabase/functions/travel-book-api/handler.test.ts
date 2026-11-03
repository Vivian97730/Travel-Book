import { describe, expect, it } from "vitest";
import { parseApiError } from "../../../packages/contracts/src/errors";
import { handleRequest } from "./handler";

describe("travel-book-api handler", () => {
  it("reports a healthy Edge Function without exposing configuration", async () => {
    const response = await handleRequest(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      service: "travel-book-api",
      status: "ok",
    });
  });

  it("returns the shared stable error contract for unknown routes", async () => {
    const response = await handleRequest(new Request("http://localhost/unknown"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(parseApiError(body)).toMatchObject({
      ok: true,
      value: {
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "找不到指定的介面。",
          details: {},
        },
      },
    });
  });
});
