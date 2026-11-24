import { isRecord, type ParseResult } from "./validation.ts";

export interface PlaceSearchCandidate {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  mapUrl: string;
}
export interface PlaceSearchRequest { query: string; city: string }

export function parsePlaceSearchRequest(input: unknown): ParseResult<PlaceSearchRequest> {
  if (!isRecord(input) || typeof input.query !== "string" || input.query.trim().length < 2 || input.query.trim().length > 120
    || typeof input.city !== "string" || !input.city.trim() || input.city.trim().length > 80) {
    return { ok: false, issues: [{ path: "query", message: "請輸入 2 至 120 字的地點名稱與 80 字以內的城市。" }] };
  }
  return { ok: true, value: { query: input.query.trim(), city: input.city.trim() } };
}

export function parsePlaceSearchCandidates(input: unknown): ParseResult<PlaceSearchCandidate[]> {
  if (!Array.isArray(input) || input.length > 5 || input.some((v) => !isRecord(v)
    || typeof v.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id)
    || typeof v.name !== "string" || !v.name.trim() || v.name.length > 160
    || typeof v.address !== "string" || v.address.length > 1000
    || typeof v.latitude !== "number" || !Number.isFinite(v.latitude) || Math.abs(v.latitude) > 90
    || typeof v.longitude !== "number" || !Number.isFinite(v.longitude) || Math.abs(v.longitude) > 180
    || typeof v.mapUrl !== "string" || !/^https:\/\/www\.openstreetmap\.org\/(?:(node|way|relation)\/\d+|\?mlat=-?\d+(?:\.\d+)?&mlon=-?\d+(?:\.\d+)?)$/.test(v.mapUrl))) {
    return { ok: false, issues: [{ path: "places", message: "地點搜尋結果格式不正確。" }] };
  }
  return { ok: true, value: input as PlaceSearchCandidate[] };
}
