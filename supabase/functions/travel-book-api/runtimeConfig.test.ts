import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "./runtimeConfig";

describe("Edge Function runtime configuration", () => {
  it("uses the hosted Supabase URL and default secret key without exposing it", () => {
    const values: Record<string, string> = {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: "secret-key" }),
      ALLOWED_ORIGINS: "https://vivian97730.github.io,http://localhost:5173",
    };

    expect(readRuntimeConfig((name) => values[name])).toEqual({
      supabaseUrl: "https://project.supabase.co",
      secretKey: "secret-key",
      allowedOrigins: new Set(["https://vivian97730.github.io", "http://localhost:5173"]),
    });
  });

  it("fails closed when a required hosted secret is unavailable", () => {
    expect(() => readRuntimeConfig(() => undefined)).toThrow("EDGE_FUNCTION_CONFIGURATION_MISSING");
  });
});
