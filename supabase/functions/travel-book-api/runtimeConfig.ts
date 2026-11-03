type GetEnv = (name: string) => string | undefined;

export interface RuntimeConfig {
  supabaseUrl: string;
  secretKey: string;
  allowedOrigins: Set<string>;
}

function readSecretKey(getEnv: GetEnv): string | undefined {
  const secretKeys = getEnv("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {
      return undefined;
    }
  }
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function readRuntimeConfig(getEnv: GetEnv): RuntimeConfig {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const secretKey = readSecretKey(getEnv);
  if (!supabaseUrl || !secretKey) throw new Error("EDGE_FUNCTION_CONFIGURATION_MISSING");

  const configuredOrigins = getEnv("ALLOWED_ORIGINS")?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : [
    "https://vivian97730.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  return { supabaseUrl, secretKey, allowedOrigins };
}
