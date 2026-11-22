import { expect, it, vi } from "vitest";
import { waitForPagesArtifact } from "./wait-for-pages-artifact.mjs";
const config = { apiUrl: "https://api.example.invalid", repository: "fixture/site", runId: "1", artifactId: "7", artifactName: "pages-1-2", token: "synthetic", sleep: vi.fn(async () => {}), attempts: 3 };
it("waits through empty metadata and ignores artifacts from older attempts", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ artifacts: [] }))
    .mockResolvedValueOnce(Response.json({ artifacts: [{ id: 6, name: "pages-1-1" }] }))
    .mockResolvedValueOnce(Response.json({ artifacts: [{ id: 7, name: "pages-1-2", expired: false }] }));
  const sleep = vi.fn(async () => {});
  await waitForPagesArtifact({ ...config, fetcher, sleep });
  expect(fetcher).toHaveBeenCalledTimes(3); expect(sleep).toHaveBeenCalledTimes(2);
});
it("blocks deployment on duplicate, expired, or wrong artifact metadata after bounded retries", async () => {
  for (const artifacts of [[{ id: 7, name: "pages-1-2" }, { id: 8, name: "pages-1-2" }], [{ id: 7, name: "pages-1-2", expired: true }], [{ id: 8, name: "pages-1-2" }]]) {
    const fetcher = vi.fn(async () => Response.json({ artifacts }));
    await expect(waitForPagesArtifact({ ...config, fetcher })).rejects.toThrow("not uniquely visible");
    expect(fetcher).toHaveBeenCalledTimes(3);
  }
});
it("fails without exposing the token when metadata access is denied", async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 403 }));
  await expect(waitForPagesArtifact({ ...config, fetcher })).rejects.toThrow("(403)");
  expect(fetcher).toHaveBeenCalledOnce();
});
