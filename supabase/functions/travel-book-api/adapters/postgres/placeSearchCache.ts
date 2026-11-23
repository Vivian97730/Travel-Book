import { parsePlaceSearchCandidates, isRecord, type PlaceSearchCandidate } from "../../../../../packages/contracts/src/index.ts";
import type { PlaceSearchCache } from "../../modules/places/placeSearch.ts";

export class SupabasePlaceSearchCache implements PlaceSearchCache {
  constructor(private readonly baseUrl: string, private readonly secretKey: string, private readonly fetcher: typeof fetch = fetch) {}
  private async rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const fetcher = this.fetcher;
    const response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: this.secretKey, "content-type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("PLACE_SEARCH_CACHE_UNAVAILABLE");
    return response.json();
  }
  async claim(tripId: string, key: string, lease: string): ReturnType<PlaceSearchCache["claim"]> {
    const result = await this.rpc("claim_place_search", { p_trip_id: tripId, p_key: key, p_lease: lease });
    if (isRecord(result) && result.status === "cached") {
      const parsed = parsePlaceSearchCandidates(result.candidates);
      if (parsed.ok) return { status: "cached" as const, candidates: parsed.value };
    }
    if (isRecord(result) && (result.status === "claimed" || result.status === "busy")) return { status: result.status };
    throw new Error("PLACE_SEARCH_CACHE_INVALID");
  }
  async finish(tripId: string, key: string, lease: string, candidates: PlaceSearchCandidate[] | null): Promise<void> {
    await this.rpc("finish_place_search", { p_trip_id: tripId, p_key: key, p_lease: lease, p_candidates: candidates });
  }
}
