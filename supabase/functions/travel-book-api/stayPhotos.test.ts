import { expect, it, vi } from "vitest";
import { readStayPhoto, MAX_STAY_PHOTO_BYTES, SupabaseStayPhotosStore } from "./stayPhotos";

it("rejects non-images, wrong MIME and oversized streams without trusting Content-Length", async () => {
  const request = (body: Uint8Array, type = "image/jpeg") => new Request("https://example.test", { method: "POST", headers: { "content-type": type }, body });
  expect(await readStayPhoto(request(new Uint8Array([255,216,255,217])))).toEqual(new Uint8Array([255,216,255,217]));
  expect(await readStayPhoto(request(new Uint8Array([1,2,3,4])))).toBeNull();
  expect(await readStayPhoto(request(new Uint8Array([255,216,255,217]), "image/svg+xml"))).toBeNull();
  expect(await readStayPhoto(request(new Uint8Array(MAX_STAY_PHOTO_BYTES + 1)))).toBeNull();
});

it("uses private trip-scoped Storage paths and fails closed on upload errors", async () => {
  const fetcher = vi.fn(async () => new Response(null, {status: 200}));
  const store = new SupabaseStayPhotosStore("https://example.test", "test-only-secret", fetcher);
  await store.upload("trip-a", "photo-a", new Uint8Array([255,216,255,217]));
  await store.download("trip-b", "photo-a");
  expect(fetcher.mock.calls[0][0]).toBe("https://example.test/storage/v1/object/stay-photos/trip-a/photo-a.jpg");
  expect(fetcher.mock.calls[1][0]).toBe("https://example.test/storage/v1/object/authenticated/stay-photos/trip-b/photo-a.jpg");
  const failed = new SupabaseStayPhotosStore("https://example.test", "test-only-secret", async () => new Response(null,{status:403}));
  await expect(failed.upload("trip", "photo", new Uint8Array())).rejects.toThrow("STAY_PHOTO_UNAVAILABLE");
});
