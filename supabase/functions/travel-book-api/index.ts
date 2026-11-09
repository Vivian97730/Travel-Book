import { handleRequest } from "./handler.ts";
import { SupabaseAccessStore } from "./adapters/postgres/accessStore.ts";
import { SupabaseHomeStore } from "./adapters/postgres/homeStore.ts";
import { SupabaseItineraryStore } from "./adapters/postgres/itineraryStore.ts";
import { readRuntimeConfig } from "./runtimeConfig.ts";
import { SupabaseStaysStore } from "./adapters/postgres/staysStore.ts";

const config = readRuntimeConfig((name) => Deno.env.get(name));
const dependencies = {
  staysStore: new SupabaseStaysStore(config.supabaseUrl, config.secretKey),
  accessStore: new SupabaseAccessStore(config.supabaseUrl, config.secretKey),
  homeStore: new SupabaseHomeStore(config.supabaseUrl, config.secretKey),
  itineraryStore: new SupabaseItineraryStore(config.supabaseUrl, config.secretKey),
  allowedOrigins: config.allowedOrigins,
  log: (entry: Record<string, unknown>) => console.info(JSON.stringify(entry)),
};

Deno.serve((request) => handleRequest(request, dependencies));
