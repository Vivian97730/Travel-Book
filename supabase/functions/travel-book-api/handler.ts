import type { AccessVerifyResponse, ApiErrorCode } from "../../../packages/contracts/src/index.ts";

export interface AccessStore {
  verify(token: string): Promise<AccessVerifyResponse | null>;
}

export interface HandlerDependencies {
  accessStore: AccessStore;
  allowedOrigins: ReadonlySet<string>;
  log(entry: Record<string, unknown>): void;
}

const corsRequestHeaders = "authorization, content-type, idempotency-key, x-request-id";
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && requestIdPattern.test(supplied) ? supplied : crypto.randomUUID();
}

function corsHeaders(origin: string | null, allowedOrigins: ReadonlySet<string>): HeadersInit {
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": corsRequestHeaders,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json; charset=utf-8" },
  });
}

function apiError(code: ApiErrorCode, message: string, requestId: string, status: number, headers: HeadersInit): Response {
  return json({ error: { code, message, requestId, details: {} } }, status, headers);
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

export async function handleRequest(request: Request, dependencies: HandlerDependencies): Promise<Response> {
  const url = new URL(request.url);
  const requestId = requestIdFor(request);
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin, dependencies.allowedOrigins);
  let response: Response;

  if (origin && !dependencies.allowedOrigins.has(origin)) {
    response = apiError("ACCESS_DENIED", "不允許此網站呼叫服務。", requestId, 403, {});
  } else if (request.method === "OPTIONS") {
    response = new Response(null, { status: 204, headers });
  } else if (request.method === "GET" && url.pathname.endsWith("/health")) {
    response = json({ service: "travel-book-api", status: "ok" }, 200, headers);
  } else if (request.method === "POST" && url.pathname.endsWith("/v1/access/verify")) {
    const token = bearerToken(request);
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      response = verified
        ? json(verified, 200, headers)
        : apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers);
    } catch {
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else {
    response = apiError("RESOURCE_NOT_FOUND", "找不到指定的介面。", requestId, 404, headers);
  }

  dependencies.log({ requestId, method: request.method, path: url.pathname, status: response.status });
  return response;
}
