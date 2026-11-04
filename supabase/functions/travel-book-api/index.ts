import { handleRequest } from "./handler.ts";
import { SupabaseAccessStore } from "./adapters/postgres/accessStore.ts";
import { readRuntimeConfig } from "./runtimeConfig.ts";

const config = readRuntimeConfig((name) => Deno.env.get(name));
const dependencies = {
  accessStore: new SupabaseAccessStore(config.supabaseUrl, config.secretKey),
  allowedOrigins: config.allowedOrigins,
  log: (entry: Record<string, unknown>) => console.info(JSON.stringify(entry)),
};

Deno.serve((request) => handleRequest(request, dependencies));
