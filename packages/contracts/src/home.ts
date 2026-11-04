import { isRecord, type ParseResult, type ValidationIssue } from "./validation.ts";

export const factIcons = ["globe", "exchange", "plug", "water", "info"] as const;
export type FactIcon = (typeof factIcons)[number];

export interface TravelFact {
  id: string;
  icon: FactIcon;
  title: string;
  content: string;
  sortOrder: number;
}

export interface FlightLeg {
  airport: string;
  city: string;
  time: string;
  dayOffset?: number;
}

export interface FlightSummary {
  direction: "去程" | "回程";
  duration: string;
  legs: FlightLeg[];
}

export interface TripHome {
  title: string;
  subtitle: string;
  dateLabel: string;
  durationLabel: string;
  travelerCount: number;
  version: number;
  flights: FlightSummary[];
  facts: TravelFact[];
}

function requireText(value: unknown, path: string, label: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !value.trim()) issues.push({ path, message: `${label}不得為空。` });
}

function validateLeg(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "航段格式不正確。" });
    return;
  }
  requireText(value.airport, `${path}.airport`, "機場代碼", issues);
  requireText(value.city, `${path}.city`, "城市", issues);
  requireText(value.time, `${path}.time`, "顯示時間", issues);
  if (value.dayOffset !== undefined && (!Number.isInteger(value.dayOffset) || (value.dayOffset as number) < 0)) {
    issues.push({ path: `${path}.dayOffset`, message: "跨日天數必須是非負整數。" });
  }
}

function validateFlight(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "航班格式不正確。" });
    return;
  }
  if (value.direction !== "去程" && value.direction !== "回程") {
    issues.push({ path: `${path}.direction`, message: "航班方向必須是去程或回程。" });
  }
  requireText(value.duration, `${path}.duration`, "總旅行時間", issues);
  if (!Array.isArray(value.legs) || value.legs.length < 2) {
    issues.push({ path: `${path}.legs`, message: "航班至少需要兩個航段節點。" });
  } else {
    value.legs.forEach((leg, index) => validateLeg(leg, `${path}.legs[${index}]`, issues));
  }
}

function validateFact(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "小知識格式不正確。" });
    return;
  }
  requireText(value.id, `${path}.id`, "小知識 ID", issues);
  if (typeof value.icon !== "string" || !factIcons.includes(value.icon as FactIcon)) {
    issues.push({ path: `${path}.icon`, message: "小知識圖示不支援。" });
  }
  requireText(value.title, `${path}.title`, "小知識標題", issues);
  requireText(value.content, `${path}.content`, "小知識內容", issues);
  if (!Number.isInteger(value.sortOrder) || (value.sortOrder as number) < 0) {
    issues.push({ path: `${path}.sortOrder`, message: "排序必須是非負整數。" });
  }
}

export function parseTripHome(input: unknown): ParseResult<TripHome> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "home", message: "首頁資料格式不正確。" }] };
  }

  const issues: ValidationIssue[] = [];
  requireText(input.title, "title", "旅程標題", issues);
  requireText(input.subtitle, "subtitle", "旅程副標", issues);
  requireText(input.dateLabel, "dateLabel", "旅程日期", issues);
  requireText(input.durationLabel, "durationLabel", "旅程天數", issues);
  if (!Number.isInteger(input.travelerCount) || (input.travelerCount as number) < 1) {
    issues.push({ path: "travelerCount", message: "同行者人數必須是正整數。" });
  }
  if (!Number.isInteger(input.version) || (input.version as number) < 0) {
    issues.push({ path: "version", message: "版本必須是非負整數。" });
  }
  if (!Array.isArray(input.flights)) {
    issues.push({ path: "flights", message: "航班資料必須是陣列。" });
  } else {
    input.flights.forEach((flight, index) => validateFlight(flight, `flights[${index}]`, issues));
  }
  if (!Array.isArray(input.facts)) {
    issues.push({ path: "facts", message: "小知識必須是陣列。" });
  } else {
    input.facts.forEach((fact, index) => validateFact(fact, `facts[${index}]`, issues));
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, value: input as unknown as TripHome };
}
