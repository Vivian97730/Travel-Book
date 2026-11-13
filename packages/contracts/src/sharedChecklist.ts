import { isRecord, type ParseResult } from "./validation.ts";

export const checklistItemIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SharedChecklistPatch {
  title?: string;
  isDone?: boolean;
  sortOrder?: number;
}

export interface SharedChecklistItem extends Required<SharedChecklistPatch> {
  id: string;
  version: number;
}

export interface SharedChecklistResponse {
  schemaVersion: 1;
  version: number;
  items: SharedChecklistItem[];
}

export type SharedChecklistMutation =
  | { action: "create"; input: SharedChecklistPatch & { title: string } }
  | { action: "update"; id: string; input: SharedChecklistPatch; expectedVersion: number }
  | { action: "delete"; id: string; expectedVersion: number };

export function parseSharedChecklistPatch(input: unknown): ParseResult<SharedChecklistPatch> {
  const failure = (): ParseResult<SharedChecklistPatch> => ({
    ok: false, issues: [{ path: "item", message: "清單項目格式不正確。" }],
  });
  if (!isRecord(input)) return failure();

  const patch: SharedChecklistPatch = {};
  if ("title" in input) {
    if (typeof input.title !== "string") return failure();
    const title = input.title.trim();
    if (!title || [...title].length > 200 || title.includes("\u0000")) return failure();
    patch.title = title;
  }
  if ("isDone" in input) {
    if (typeof input.isDone !== "boolean") return failure();
    patch.isDone = input.isDone;
  }
  if ("sortOrder" in input) {
    const order = input.sortOrder;
    if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 0) return failure();
    patch.sortOrder = order;
  }
  return Object.keys(patch).length ? { ok: true, value: patch } : failure();
}

export function parseSharedChecklistResponse(input: unknown): ParseResult<SharedChecklistResponse> {
  const failure = (): ParseResult<SharedChecklistResponse> => ({
    ok: false, issues: [{ path: "items", message: "共享清單回應格式不正確。" }],
  });
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.items)
    || typeof input.version !== "number" || !Number.isSafeInteger(input.version) || input.version < 1) return failure();
  const items: SharedChecklistItem[] = [];
  for (const item of input.items) {
    const parsed = parseSharedChecklistPatch(item);
    if (!isRecord(item) || !parsed.ok || typeof item.id !== "string" || !checklistItemIdPattern.test(item.id)
      || typeof item.version !== "number" || !Number.isSafeInteger(item.version) || item.version < 1) return failure();
    const { title, isDone, sortOrder } = parsed.value;
    if (title === undefined || isDone === undefined || sortOrder === undefined) return failure();
    items.push({ id: item.id, version: item.version, title, isDone, sortOrder });
  }
  return { ok: true, value: { schemaVersion: 1, version: input.version, items } };
}
