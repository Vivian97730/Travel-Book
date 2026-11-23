import { expect, it, vi } from "vitest";
import { SupabasePlaceSearchCache } from "./placeSearchCache";

it.each([200,204])("accepts an empty HTTP %i response from a void completion RPC", async (status) => {
  const fetcher=vi.fn<typeof fetch>(async()=>new Response(null,{status}));
  const cache=new SupabasePlaceSearchCache("https://project.test","synthetic",fetcher);
  await expect(cache.finish("trip","church, wien","lease",[])).resolves.toBeUndefined();
});
it("preserves only safe cache HTTP diagnostics", async () => {
  const cache=new SupabasePlaceSearchCache("https://project.test","synthetic",async()=>new Response("private detail",{status:503}));
  await expect(cache.claim("trip","church, wien","lease")).rejects.toMatchObject({phase:"cache",status:503,message:"PLACE_SEARCH_UNAVAILABLE"});
});
