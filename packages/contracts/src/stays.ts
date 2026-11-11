import { isRecord, type ParseResult, type ValidationIssue } from "./validation.ts";

export interface StayPhoto {
  id: string;
}

export function isStayPhoto(photo: unknown): photo is StayPhoto {
  return isRecord(photo) && typeof photo.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photo.id)
    && Object.keys(photo).length === 1;
}

export interface StayInput {
  name: string;
  city: string;
  address: string;
  startDate: string;
  endDate: string;
  checkin: string;
  checkout: string;
  photo: StayPhoto | null;
}

export interface Stay extends StayInput {
  id: string;
  version: number;
  placeId: string | null;
}

export function parseStayInput(input: unknown): ParseResult<StayInput> {
  if (!isRecord(input)) return { ok: false, issues: [{ path: "stay", message: "住宿格式不正確。" }] };
  const issues: ValidationIssue[] = [];
  for (const [field, max] of [["name", 80], ["city", 40], ["address", 160]] as const) {
    if (typeof input[field] !== "string" || !input[field].trim() || input[field].length > max) {
      issues.push({ path: field, message: "必填文字格式不正確。" });
    }
  }
  const date = (value: unknown): value is string => typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
  for (const field of ["startDate", "endDate"] as const) {
    if (!date(input[field])) issues.push({ path: field, message: "日期格式不正確。" });
  }
  if (date(input.startDate) && date(input.endDate) && input.endDate <= input.startDate) {
    issues.push({ path: "endDate", message: "退房日期必須晚於入住日期。" });
  }
  for (const field of ["checkin", "checkout"] as const) {
    if (typeof input[field] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input[field])) {
      issues.push({ path: field, message: "時間格式不正確。" });
    }
  }
  if (input.photo !== null) {
    const photo = input.photo;
    if (!isStayPhoto(photo)) {
      issues.push({ path: "photo", message: "照片來源格式不正確。" });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: input as unknown as StayInput };
}

export interface StaysResponse {
  schemaVersion: 1;
  stays: Stay[];
}

export interface UpdateStayRequest extends StayInput {
  expectedVersion: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUpdateStayRequest(input: unknown): ParseResult<UpdateStayRequest> {
  const parsed = parseStayInput(input);
  if (!parsed.ok) return parsed;
  if (!isRecord(input) || !Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) {
    return { ok: false, issues: [{ path: "expectedVersion", message: "預期版本必須是正整數。" }] };
  }
  return { ok: true, value: input as unknown as UpdateStayRequest };
}

export function parseStaysResponse(input: unknown): ParseResult<StaysResponse> {
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.stays)) {
    return { ok: false, issues: [{ path: "stays", message: "住宿回應格式不正確。" }] };
  }
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  input.stays.forEach((stay: unknown, index: number) => {
    const parsed = parseStayInput(stay);
    if (!parsed.ok) issues.push(...parsed.issues.map((issue) => ({ ...issue, path: `stays[${index}].${issue.path}` })));
    if (!isRecord(stay) || typeof stay.id !== "string" || !uuidPattern.test(stay.id)
      || ids.has(stay.id) || !Number.isSafeInteger(stay.version) || Number(stay.version) < 1
      || !(stay.placeId === null || (typeof stay.placeId === "string" && uuidPattern.test(stay.placeId)))) {
      issues.push({ path: `stays[${index}]`, message: "住宿識別或版本格式不正確。" });
    }
    if (isRecord(stay) && typeof stay.id === "string") ids.add(stay.id);
  });
  return issues.length ? { ok: false, issues } : { ok: true, value: input as unknown as StaysResponse };
}
