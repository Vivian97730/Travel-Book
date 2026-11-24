import { isRecord, parsePlaceSearchCandidates, type PlaceSearchCandidate, type PlaceSearchRequest } from "../../../../../packages/contracts/src/index.ts";

export class PlaceSearchBusy extends Error {}
export class PlaceSearchFailure extends Error {
  constructor(readonly phase: "provider" | "cache", readonly status?: number) { super("PLACE_SEARCH_UNAVAILABLE"); }
}
export interface PlaceSearchCache {
  claim(tripId: string, key: string, lease: string): Promise<{ status: "cached"; candidates: PlaceSearchCandidate[] } | { status: "claimed" | "busy" }>;
  finish(tripId: string, key: string, lease: string, candidates: PlaceSearchCandidate[] | null): Promise<void>;
}

export class PlaceSearchService {
  constructor(private readonly cache: PlaceSearchCache, private readonly endpoint = "https://nominatim.openstreetmap.org/search", private readonly fetcher: typeof fetch = fetch) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("PLACE_SEARCH_CONFIGURATION_INVALID");
  }

  async search(tripId: string, input: PlaceSearchRequest): Promise<PlaceSearchCandidate[]> {
    const query = `${input.query.trim().replace(/\s+/g, " ")}, ${input.city.trim().replace(/\s+/g, " ")}`;
    const key = query.toLowerCase();
    const lease = crypto.randomUUID();
    const claim = await this.cache.claim(tripId, key, lease);
    if (claim.status === "cached") {
      const parsed = parsePlaceSearchCandidates(claim.candidates);
      if (!parsed.ok) throw new Error("PLACE_SEARCH_CACHE_INVALID");
      return parsed.value;
    }
    if (claim.status === "busy") throw new PlaceSearchBusy();
    let candidates: PlaceSearchCandidate[] | null = null;
    try {
      const url = new URL(this.endpoint);
      url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "5", "accept-language": "zh-TW,en" }).toString();
      const fetcher = this.fetcher;
      const response = await fetcher(url, {
        headers: { "User-Agent": "TravelBook/1.0 (https://github.com/Vivian97730/Travel-Book)", Accept: "application/json" },
        signal: AbortSignal.timeout(8000), redirect: "error",
      });
      if (response.status === 429) throw new PlaceSearchBusy();
      if (!response.ok) throw new PlaceSearchFailure("provider", response.status);
      const body: unknown = await response.json();
      if (!Array.isArray(body) || body.length > 5) throw new Error("PLACE_SEARCH_INVALID_RESPONSE");
      candidates = body.flatMap((row) => {
        if (!isRecord(row) || typeof row.name !== "string" || !row.name.trim() || typeof row.display_name !== "string"
          || typeof row.lat !== "string" || !row.lat.trim() || typeof row.lon !== "string" || !row.lon.trim()
          || !["node", "way", "relation"].includes(String(row.osm_type)) || !/^\d+$/.test(String(row.osm_id))) return [];
        const candidate = { id: crypto.randomUUID(), name: row.name.slice(0, 160), address: row.display_name.slice(0, 1000),
          latitude: Number(row.lat), longitude: Number(row.lon), mapUrl: `https://www.openstreetmap.org/${row.osm_type}/${row.osm_id}` };
        return parsePlaceSearchCandidates([candidate]).ok ? [candidate] : [];
      });
      if (body.length && !candidates.length) { candidates = null; throw new Error("PLACE_SEARCH_INVALID_RESPONSE"); }
      return candidates;
    } catch (error) {
      if (error instanceof PlaceSearchBusy || error instanceof PlaceSearchFailure) throw error;
      throw new PlaceSearchFailure("provider");
    } finally {
      // A durable, application-wide lease serializes providers across Edge isolates.
      // Failed calls are never cached; a cooldown still applies after completion.
      await this.cache.finish(tripId, key, lease, candidates);
    }
  }
}
