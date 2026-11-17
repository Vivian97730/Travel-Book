import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const source = readFileSync(new URL("./appShellWorker.js", import.meta.url), "utf8");
const scope = "https://example.test/Travel-Book/";
const cachePrefix = "travel-book-formal:/Travel-Book/:";
const cacheName = cachePrefix + "current";
const shell = new URL("index.html", scope).href;

function worker() {
  const listeners = new Map();
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn() };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([cacheName, cachePrefix + "old", "other-cache"]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn();
  const clients = { claim: vi.fn().mockResolvedValue(undefined) };
  runInNewContext(source, {
    URL, Request, cacheName, cachePrefix, caches, fetch, assets: ["index.html"],
    self: { registration: { scope }, clients, addEventListener: (name, handler) => listeners.set(name, handler) },
  });
  return { listeners, cache, caches, fetch, clients };
}

it("uses the active build's shell for both launch URLs without asking the network for newer HTML", async () => {
  const { listeners, cache, fetch } = worker();
  const html = new Response("active build");
  cache.match.mockResolvedValue(html);
  for (const url of [scope, shell]) {
    const respondWith = vi.fn();
    listeners.get("fetch")({
      request: { url, method: "GET", mode: "navigate", headers: new Headers() },
      respondWith,
    });
    await expect(respondWith.mock.calls[0][0]).resolves.toBe(html);
  }
  expect(cache.match).toHaveBeenCalledWith(shell);
  expect(fetch).not.toHaveBeenCalled();
});

it("waits for precaching to succeed before the browser can activate the build", async () => {
  const { listeners, cache, caches, clients } = worker();
  cache.addAll.mockRejectedValue(new Error("asset unavailable"));
  const waitUntil = vi.fn();
  listeners.get("install")({ waitUntil });
  await expect(waitUntil.mock.calls[0][0]).rejects.toThrow("asset unavailable");
  expect(caches.delete).not.toHaveBeenCalled();
  expect(clients.claim).not.toHaveBeenCalled();

  listeners.get("activate")({ waitUntil });
  await waitUntil.mock.calls[1][0];
  expect(caches.delete).toHaveBeenCalledExactlyOnceWith(cachePrefix + "old");
  expect(clients.claim).toHaveBeenCalledOnce();
});
