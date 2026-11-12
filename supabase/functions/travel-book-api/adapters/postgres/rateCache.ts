import { isRateSnapshot, isRecord, type ForeignExpenseCurrency } from "../../../../../packages/contracts/src/index.ts";
import type { OfficialRate } from "../../modules/rates/officialRates.ts";
import type { RateCache, RateClaim } from "../../modules/rates/ratesService.ts";

export class SupabaseRateCache implements RateCache {
  constructor(private readonly baseUrl: string, private readonly secretKey: string) {}

  async claim(currency: ForeignExpenseCurrency, date: string, version: number, lease: string): Promise<RateClaim> {
    const result = await this.rpc("claim_exchange_rate", {
      p_currency: currency, p_date: date, p_version: version, p_lease: lease,
    });
    if (isRecord(result) && isRateSnapshot(result.snapshot)) return { snapshot: result.snapshot };
    if (isRecord(result) && typeof result.claimed === "boolean") return { claimed: result.claimed };
    throw new Error("RATE_CACHE_INVALID_RESPONSE");
  }

  async finish(currency: ForeignExpenseCurrency, date: string, version: number, lease: string, rate: OfficialRate | null) {
    const result = await this.rpc("finish_exchange_rate", {
      p_currency: currency, p_date: date, p_version: version, p_lease: lease,
      p_rate: rate?.rate ?? null, p_source: rate?.source ?? null, p_source_date: rate?.sourceDate ?? null,
    });
    if (result === null || isRateSnapshot(result)) return result;
    throw new Error("RATE_CACHE_INVALID_RESPONSE");
  }

  private async rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error("RATE_CACHE_UNAVAILABLE");
    return response.json();
  }
}
