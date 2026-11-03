import { isRecord, type ParseResult, type ValidationIssue } from "./validation";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

export interface MutationMetadata {
  expectedVersion: number;
  idempotencyKey: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseMutationMetadata(input: unknown): ParseResult<MutationMetadata> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "mutation", message: "寫入請求格式不正確。" }] };
  }

  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(input.expectedVersion) || (input.expectedVersion as number) < 0) {
    issues.push({ path: "expectedVersion", message: "預期版本必須是非負整數。" });
  }
  if (typeof input.idempotencyKey !== "string" || !UUID_PATTERN.test(input.idempotencyKey)) {
    issues.push({ path: "idempotencyKey", message: "Idempotency Key 必須是 UUID。" });
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, value: input as unknown as MutationMetadata };
}
