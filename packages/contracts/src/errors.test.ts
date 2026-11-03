import { describe, expect, it } from "vitest";
import { parseApiError } from "./errors";

describe("API error contract", () => {
  it("accepts a stable error response", () => {
    expect(parseApiError({
      error: {
        code: "VERSION_CONFLICT",
        message: "資料已由其他裝置更新，請重新載入。",
        requestId: "req-123",
        details: { currentVersion: 4 },
      },
    })).toEqual({
      ok: true,
      value: {
        error: {
          code: "VERSION_CONFLICT",
          message: "資料已由其他裝置更新，請重新載入。",
          requestId: "req-123",
          details: { currentVersion: 4 },
        },
      },
    });
  });

  it("rejects unknown error codes without trusting their message", () => {
    expect(parseApiError({
      error: {
        code: "DATABASE_STACK_TRACE",
        message: "secret internal details",
        requestId: "req-456",
        details: {},
      },
    })).toEqual({
      ok: false,
      issues: [{ path: "error.code", message: "不支援的錯誤代碼。" }],
    });
  });
});
