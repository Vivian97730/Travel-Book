import { expect, it } from "vitest";
import { parsePlaceSearchCandidates, parsePlaceSearchRequest } from "./places";

it("bounds and trims user-triggered search input", () => {
  expect(parsePlaceSearchRequest({ query: " Church ", city: " Wien ", tripId: "untrusted" })).toEqual({ ok: true, value: { query: "Church", city: "Wien" } });
  for (const input of [{ query: "x", city: "Wien" }, { query: "Church", city: " " }, { query: "x".repeat(121), city: "Wien" }]) expect(parsePlaceSearchRequest(input).ok).toBe(false);
});
it("rejects invalid coordinates, excessive results and unsafe map links", () => {
  const candidate = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Church", address: "Wien", latitude: 48.2, longitude: 16.3, mapUrl: "https://www.openstreetmap.org/way/123" };
  expect(parsePlaceSearchCandidates([candidate]).ok).toBe(true);
  expect(parsePlaceSearchCandidates([]).ok).toBe(true);
  for (const patch of [{ latitude: null }, { longitude: Infinity }, { latitude: 91 }, { mapUrl: "javascript:alert(1)" }, { name: "" }]) expect(parsePlaceSearchCandidates([{ ...candidate, ...patch }]).ok).toBe(false);
  expect(parsePlaceSearchCandidates(Array(6).fill(candidate)).ok).toBe(false);
});
