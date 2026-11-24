import { isRecord, parsePlaceSearchCandidates, type PlaceSearchCandidate, type PlaceSearchRequest } from "../../../../../packages/contracts/src/index.ts";

export class PlaceSearchBusy extends Error {}
export class PlaceSearchFailure extends Error {
  constructor(readonly phase: "provider" | "cache", readonly status?: number) { super("PLACE_SEARCH_UNAVAILABLE"); }
}
export interface PlaceSearchCache {
  claim(tripId: string, key: string, lease: string): Promise<{ status: "cached"; candidates: PlaceSearchCandidate[] } | { status: "claimed" | "busy" }>;
  finish(tripId: string, key: string, lease: string, candidates: PlaceSearchCandidate[] | null): Promise<void>;
}

export type PlaceSearchProvider = "nominatim" | "photon";
export function readPlaceSearchProvider(value: string | undefined): PlaceSearchProvider {
  if (!value || value === "nominatim") return "nominatim";
  if (value === "photon") return "photon";
  throw new Error("PLACE_SEARCH_CONFIGURATION_INVALID");
}

function providerRows(body: unknown, provider: PlaceSearchProvider): unknown[] {
  if (provider === "nominatim") {
    if (!Array.isArray(body) || body.length > 5) throw new Error("PLACE_SEARCH_INVALID_RESPONSE");
    return body;
  }
  if (!isRecord(body) || !Array.isArray(body.features) || body.features.length > 5) throw new Error("PLACE_SEARCH_INVALID_RESPONSE");
  return body.features.map((feature) => {
    if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)
      || feature.geometry.type !== "Point" || !Array.isArray(feature.geometry.coordinates)
      || feature.geometry.coordinates.length !== 2
      || !feature.geometry.coordinates.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
    const p = feature.properties;
    const osmType = p.osm_type === "N" ? "node" : p.osm_type === "W" ? "way" : p.osm_type === "R" ? "relation" : null;
    const address = [...new Set([p.housenumber, p.street, p.postcode, p.city, p.district, p.state, p.country]
      .filter((v): v is string => typeof v === "string" && Boolean(v.trim())))].join(", ");
    return { name: p.name, display_name: address || p.name, osm_type: osmType, osm_id: p.osm_id,
      lat: String(feature.geometry.coordinates[1]), lon: String(feature.geometry.coordinates[0]) };
  });
}

export class PlaceSearchService {
  private readonly endpoint: string;
  constructor(private readonly cache: PlaceSearchCache, endpoint: string | undefined = undefined,
    private readonly fetcher: typeof fetch = fetch, private readonly provider: PlaceSearchProvider = "nominatim") {
    this.endpoint = endpoint ?? (provider === "photon" ? "https://photon.komoot.io/api/" : "https://nominatim.openstreetmap.org/search");
    const url = new URL(this.endpoint);
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
      url.search = new URLSearchParams(this.provider === "photon"
        ? { q: query, limit: "5", lang: "en" }
        : { q: query, format: "jsonv2", limit: "5", "accept-language": "zh-TW,en" }).toString();
      const fetcher = this.fetcher;
      const response = await fetcher(url, {
        headers: { "User-Agent": "TravelBook/1.0 (https://github.com/Vivian97730/Travel-Book)", Accept: "application/json" },
        signal: AbortSignal.timeout(8000), redirect: "error",
      });
      if (response.status === 429) throw new PlaceSearchBusy();
      if (!response.ok) throw new PlaceSearchFailure("provider", response.status);
      const body = providerRows(await response.json(), this.provider);
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
