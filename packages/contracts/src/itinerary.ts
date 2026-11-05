import { isRecord, type ParseResult, type ValidationIssue } from "./validation.ts";

export const itineraryCategories = ["food", "stay", "transit", "sight", "shopping"] as const;
export type ItineraryCategory = (typeof itineraryCategories)[number];

export interface ItineraryPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ItineraryItem {
  id: string;
  title: string;
  note: string;
  category: ItineraryCategory;
  sortOrder: number;
  place: ItineraryPlace | null;
}

export interface TripDay {
  date: string;
  weekday: string;
  city: string;
  summary: string;
  version: number;
  items: ItineraryItem[];
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function requireText(value: unknown, path: string, label: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !value.trim()) issues.push({ path, message: `${label}不得為空。` });
}

function validateCoordinate(
  value: unknown,
  path: string,
  label: string,
  minimum: number,
  maximum: number,
  issues: ValidationIssue[],
): void {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    issues.push({ path, message: `${label}必須介於 ${minimum} 與 ${maximum} 之間。` });
  }
}

function validatePlace(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value === null) return;
  if (!isRecord(value)) {
    issues.push({ path, message: "地點格式不正確。" });
    return;
  }
  requireText(value.id, `${path}.id`, "地點 ID", issues);
  requireText(value.name, `${path}.name`, "地點名稱", issues);
  validateCoordinate(value.latitude, `${path}.latitude`, "緯度", -90, 90, issues);
  validateCoordinate(value.longitude, `${path}.longitude`, "經度", -180, 180, issues);
}

function validateItem(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "行程項目格式不正確。" });
    return;
  }
  requireText(value.id, `${path}.id`, "行程項目 ID", issues);
  requireText(value.title, `${path}.title`, "行程名稱", issues);
  requireText(value.note, `${path}.note`, "行程內容", issues);
  if (typeof value.category !== "string" || !itineraryCategories.includes(value.category as ItineraryCategory)) {
    issues.push({ path: `${path}.category`, message: "行程分類不支援。" });
  }
  if (!Number.isInteger(value.sortOrder) || (value.sortOrder as number) < 0) {
    issues.push({ path: `${path}.sortOrder`, message: "排序必須是非負整數。" });
  }
  validatePlace(value.place, `${path}.place`, issues);
}

export function parseTripDay(input: unknown): ParseResult<TripDay> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "day", message: "日程資料格式不正確。" }] };
  }

  const issues: ValidationIssue[] = [];
  if (typeof input.date !== "string" || !datePattern.test(input.date)) {
    issues.push({ path: "date", message: "日程日期格式不正確。" });
  }
  requireText(input.weekday, "weekday", "星期", issues);
  requireText(input.city, "city", "城市", issues);
  requireText(input.summary, "summary", "日程摘要", issues);
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    issues.push({ path: "version", message: "版本必須是正整數。" });
  }
  if (!Array.isArray(input.items)) {
    issues.push({ path: "items", message: "行程項目必須是陣列。" });
  } else {
    input.items.forEach((item, index) => validateItem(item, `items[${index}]`, issues));
  }

  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: input as unknown as TripDay };
}
