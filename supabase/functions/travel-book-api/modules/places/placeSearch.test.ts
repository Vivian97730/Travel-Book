import { describe, expect, it, vi } from "vitest";
import { PlaceSearchBusy, PlaceSearchService, readPlaceSearchProvider, type PlaceSearchCache } from "./placeSearch";

const candidate = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Stephansdom", address: "Wien, Austria", latitude: 48.208, longitude: 16.373, mapUrl: "https://www.openstreetmap.org/way/123" };
function setup() {
  const cache: PlaceSearchCache = { claim: vi.fn(async () => ({ status: "claimed" })), finish: vi.fn(async () => {}) };
  const fetcher = vi.fn<typeof fetch>(async () => Response.json([{ name: "Stephansdom", display_name: "Wien, Austria", lat: "48.208", lon: "16.373", osm_type: "way", osm_id: 123 }]));
  return { cache, fetcher, service: new PlaceSearchService(cache, undefined, fetcher) };
}

describe("trip-scoped place search", () => {
  it("uses cached results without an upstream call, including cached empty results", async () => {
    const { cache, fetcher, service } = setup();
    vi.mocked(cache.claim).mockResolvedValueOnce({ status: "cached", candidates: [candidate] }).mockResolvedValueOnce({ status: "cached", candidates: [] });
    await expect(service.search("trip-a", { query: "Stephansdom", city: "Wien" })).resolves.toEqual([candidate]);
    await expect(service.search("trip-a", { query: "Missing", city: "Wien" })).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(cache.finish).not.toHaveBeenCalled();
  });
  it("normalizes search keys, identifies the app, and passes only query and city upstream", async () => {
    const { service, cache, fetcher } = setup();
    const result = await service.search("private-trip", { query: "  Stephansdom  ", city: "Wien" });
    expect(result).toMatchObject([{ name: "Stephansdom", latitude: 48.208, longitude: 16.373 }]);
    expect(cache.claim).toHaveBeenCalledWith("private-trip", "stephansdom, wien", expect.any(String));
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).not.toContain("private-trip");
    expect(new URL(String(url)).searchParams.get("q")).toBe("Stephansdom, Wien");
    expect(init).toMatchObject({ headers: { "User-Agent": expect.stringContaining("TravelBook/"), Accept: "application/json" }, redirect: "error" });
    expect(cache.finish).toHaveBeenCalledWith("private-trip", "stephansdom, wien", expect.any(String), result);
  });
  it("never calls the provider without the global lease", async () => {
    const { service, cache, fetcher } = setup();
    vi.mocked(cache.claim).mockResolvedValue({ status: "busy" });
    await expect(service.search("trip", { query: "Church", city: "Wien" })).rejects.toBeInstanceOf(PlaceSearchBusy);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["network", "invalid", "limited"])("releases the lease without caching on %s failure", async (failure) => {
    const { service, cache, fetcher } = setup();
    if (failure === "network") fetcher.mockRejectedValueOnce(new Error("secret upstream detail"));
    else fetcher.mockResolvedValueOnce(failure === "limited" ? new Response(null, { status: 429 }) : Response.json([{ name: "Bad", display_name: "Bad", lat: "91", lon: "0", osm_type: "way", osm_id: 123 }]));
    await expect(service.search("trip", { query: "Church", city: "Wien" })).rejects.toThrow();
    expect(cache.finish).toHaveBeenCalledWith("trip", "church, wien", expect.any(String), null);
  });
  it("rejects insecure or credential-bearing provider configuration", () => {
    const { cache } = setup();
    for (const url of ["http://example.test/search", "https://user:secret@example.test/search", "https://example.test/search?key=secret"]) {
      expect(() => new PlaceSearchService(cache, url)).toThrow("PLACE_SEARCH_CONFIGURATION_INVALID");
    }
  });
});

it("converts Photon GeoJSON lon/lat and OSM object types into verified candidates", async () => {
  const cache: PlaceSearchCache={claim:vi.fn(async()=>({status:"claimed"})),finish:vi.fn(async()=>{})};
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({features:[
    {properties:{name:"Berlin",city:"Berlin",country:"Germany",osm_type:"N",osm_id:123},geometry:{type:"Point",coordinates:[13.4,52.5]}},
    {properties:{name:"Square",street:"Public street",housenumber:"1",city:"Berlin",osm_type:"W",osm_id:124},geometry:{type:"Point",coordinates:[13.41,52.51]}},
    {properties:{name:"District",city:"Berlin",osm_type:"R",osm_id:125},geometry:{type:"Point",coordinates:[13.42,52.52]}},
  ]}));
  const service=new PlaceSearchService(cache,undefined,fetcher,"photon");
  const results=await service.search("trip",{query:"Public square",city:"Berlin"});
  expect(results).toMatchObject([
    {name:"Berlin",latitude:52.5,longitude:13.4,address:"Berlin, Germany",mapUrl:"https://www.openstreetmap.org/node/123"},
    {name:"Square",mapUrl:"https://www.openstreetmap.org/way/124"},
    {name:"District",mapUrl:"https://www.openstreetmap.org/relation/125"},
  ]);
  const url=new URL(String(fetcher.mock.calls[0][0]));expect(url.origin).toBe("https://photon.komoot.io");expect(url.searchParams.get("q")).toBe("Public square, Berlin");expect(url.searchParams.get("format")).toBeNull();
});
it.each([
  {features:[{properties:{name:"Invalid",osm_type:"N",osm_id:123},geometry:{type:"Point",coordinates:[181,52]}}]},
  {features:[{properties:{name:"Invalid",osm_type:"N",osm_id:123},geometry:{type:"LineString",coordinates:[13,52]}}]},
  {features:[{properties:{name:"Invalid",osm_type:"N",osm_id:123},geometry:{type:"Point",coordinates:[null,null]}}]},
  {error:"invalid"},
])("rejects malformed Photon results and does not cache failures",async(body)=>{
  const cache: PlaceSearchCache={claim:vi.fn(async()=>({status:"claimed"})),finish:vi.fn(async()=>{})};
  const service=new PlaceSearchService(cache,undefined,async()=>Response.json(body),"photon");
  await expect(service.search("trip",{query:"Square",city:"Berlin"})).rejects.toMatchObject({phase:"provider"});
  expect(cache.finish).toHaveBeenCalledWith("trip","square, berlin",expect.any(String),null);
});

it("requires an explicit supported provider and keeps Nominatim as the unchanged default",()=>{
  expect(readPlaceSearchProvider(undefined)).toBe("nominatim");expect(readPlaceSearchProvider("photon")).toBe("photon");expect(()=>readPlaceSearchProvider("unapproved")).toThrow("PLACE_SEARCH_CONFIGURATION_INVALID");
});
