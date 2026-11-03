import { isRecord, type ParseResult, type ValidationIssue } from "./validation.ts";

export interface AccessTripSummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  displayTimezone: string;
}

export interface AccessVerifyResponse {
  trip: AccessTripSummary;
  resourceVersions: Record<string, number>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseAccessVerifyResponse(input: unknown): ParseResult<AccessVerifyResponse> {
  if (!isRecord(input) || !isRecord(input.trip) || !isRecord(input.resourceVersions)) {
    return { ok: false, issues: [{ path: "", message: "私人存取回應格式不正確。" }] };
  }

  const { id, title, startDate, endDate, displayTimezone } = input.trip;
  const issues: ValidationIssue[] = [];
  if (typeof id !== "string" || !uuidPattern.test(id)) issues.push({ path: "trip.id", message: "旅程 ID 格式不正確。" });
  if (typeof title !== "string" || !title.trim()) issues.push({ path: "trip.title", message: "旅程名稱不得為空。" });
  if (typeof startDate !== "string" || !datePattern.test(startDate)) issues.push({ path: "trip.startDate", message: "開始日期格式不正確。" });
  if (typeof endDate !== "string" || !datePattern.test(endDate)) issues.push({ path: "trip.endDate", message: "結束日期格式不正確。" });
  if (typeof startDate === "string" && typeof endDate === "string" && startDate > endDate) issues.push({ path: "trip.endDate", message: "結束日期不得早於開始日期。" });
  if (typeof displayTimezone !== "string" || !displayTimezone.trim()) issues.push({ path: "trip.displayTimezone", message: "顯示時區不得為空。" });

  const resourceVersions: Record<string, number> = {};
  for (const [resource, version] of Object.entries(input.resourceVersions)) {
    if (!resource.trim() || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
      issues.push({ path: `resourceVersions.${resource}`, message: "資源版本必須是正整數。" });
    } else {
      resourceVersions[resource] = version;
    }
  }

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      trip: {
        id: id as string,
        title: (title as string).trim(),
        startDate: startDate as string,
        endDate: endDate as string,
        displayTimezone: (displayTimezone as string).trim(),
      },
      resourceVersions,
    },
  };
}
