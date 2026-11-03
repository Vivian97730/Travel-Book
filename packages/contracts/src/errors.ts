import { isRecord, type ParseResult } from "./validation";

export const apiErrorCodes = [
  "ACCESS_DENIED",
  "RESOURCE_NOT_FOUND",
  "VERSION_CONFLICT",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "EXTERNAL_SERVICE_UNAVAILABLE",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
}

export function parseApiError(input: unknown): ParseResult<ApiErrorResponse> {
  if (!isRecord(input) || !isRecord(input.error)) {
    return { ok: false, issues: [{ path: "error", message: "錯誤格式不正確。" }] };
  }

  const { code, message, requestId, details } = input.error;
  if (typeof code !== "string" || !apiErrorCodes.includes(code as ApiErrorCode)) {
    return { ok: false, issues: [{ path: "error.code", message: "不支援的錯誤代碼。" }] };
  }

  const issues = [
    typeof message === "string" && message.trim() ? null : { path: "error.message", message: "錯誤訊息不得為空。" },
    typeof requestId === "string" && requestId.trim() ? null : { path: "error.requestId", message: "Request ID 不得為空。" },
    isRecord(details) ? null : { path: "error.details", message: "錯誤詳細資料格式不正確。" },
  ].filter((issue): issue is { path: string; message: string } => issue !== null);

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    value: {
      error: {
        code: code as ApiErrorCode,
        message: message as string,
        requestId: requestId as string,
        details: details as Record<string, unknown>,
      },
    },
  };
}
