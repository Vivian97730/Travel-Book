import { ExpenseMutationError } from "./adapters/postgres/expensesStore.ts";
import { isRateRequestCurrency, isRateRequestDate } from "./modules/rates/ratesService.ts";
import { readStayPhoto, stayPhotoIdPattern, type StayPhotosStore } from "./stayPhotos.ts";
import {
  isRecord,
  parseExpenseInput,
  parseMutationMetadata,
  type ExpenseMutation,
  parseSaveTravelFactsRequest,
  parseSaveTripDayRequest,
  type AccessVerifyResponse,
  type ApiErrorCode,
  type ExpensesResponse,
  type ExpenseCurrency,
  type ExchangeRateResponse,
  type SaveTripDayItem,
  type SaveTravelFact,
  type TripDay,
  type TripHome,
  type StaysResponse,
  type StayInput,
  parseStayInput,
  parseUpdateStayRequest,
} from "../../../packages/contracts/src/index.ts";

export interface AccessStore {
  verify(token: string): Promise<AccessVerifyResponse | null>;
}

export interface ItineraryStore {
  getDay(tripId: string, date: string): Promise<TripDay | null>;
  saveDayItems(
    tripId: string,
    date: string,
    items: readonly SaveTripDayItem[],
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<TripDay>;
}

export interface HomeStore {
  getHome(tripId: string): Promise<TripHome | null>;
  saveFacts(
    tripId: string,
    facts: readonly SaveTravelFact[],
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<TripHome>;
}

export interface HandlerDependencies {
  ratesService: { getRate(currency: ExpenseCurrency, date: string): Promise<ExchangeRateResponse> };
  expensesStore: {
    getExpenses(tripId: string): Promise<ExpensesResponse | null>;
    mutateExpense(tripId: string, mutation: ExpenseMutation, key: string, snapshotId: string | null): Promise<ExpensesResponse>;
  };
  stayPhotosStore?: StayPhotosStore;
  staysStore: {
    getStays(tripId: string): Promise<StaysResponse | null>;
    mutateStay(tripId: string, action: "create" | "update" | "delete", id: string | null, input: StayInput | null, expectedVersion: number, idempotencyKey: string): Promise<StaysResponse>;
  };
  accessStore: AccessStore;
  homeStore: HomeStore;
  itineraryStore: ItineraryStore;
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

function safeUpstreamStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = error.status;
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : undefined;
}

function safeItineraryStoreCode(error: unknown): "RESOURCE_NOT_FOUND" | "VERSION_CONFLICT" | "VALIDATION_FAILED" | undefined {
  if (
    typeof error !== "object"
    || error === null
    || !("code" in error)
    || !("message" in error)
    || error.message !== "ITINERARY_STORE_UNAVAILABLE"
  ) return undefined;
  return error.code === "RESOURCE_NOT_FOUND" || error.code === "VERSION_CONFLICT" || error.code === "VALIDATION_FAILED"
    ? error.code
    : undefined;
}

function safeHomeStoreCode(error: unknown): "RESOURCE_NOT_FOUND" | "VERSION_CONFLICT" | "VALIDATION_FAILED" | undefined {
  if (
    typeof error !== "object"
    || error === null
    || !("code" in error)
    || !("message" in error)
    || error.message !== "HOME_STORE_UNAVAILABLE"
  ) return undefined;
  return error.code === "RESOURCE_NOT_FOUND" || error.code === "VERSION_CONFLICT" || error.code === "VALIDATION_FAILED"
    ? error.code
    : undefined;
}

export async function handleRequest(request: Request, dependencies: HandlerDependencies): Promise<Response> {
  const url = new URL(request.url);
  const requestId = requestIdFor(request);
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin, dependencies.allowedOrigins);
  let response: Response;
  let upstreamStatus: number | undefined;

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
    } catch (error) {
      upstreamStatus = safeUpstreamStatus(error);
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else if ((request.method === "POST" && url.pathname.endsWith("/v1/stay-photos"))
    || (request.method === "GET" && /\/v1\/stay-photos\/[^/]+$/.test(url.pathname))) {
    try {
      const token = bearerToken(request);
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers);
      } else if (!dependencies.stayPhotosStore) {
        response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "照片服務暫時無法使用。", requestId, 503, headers);
      } else if (request.method === "POST") {
        const bytes = await readStayPhoto(request);
        if (!bytes) response = apiError("VALIDATION_FAILED", "請使用 2 MB 以內的 JPEG 圖片。", requestId, 422, headers);
        else {
          const id = crypto.randomUUID();
          await dependencies.stayPhotosStore.upload(verified.trip.id, id, bytes);
          response = json({ id }, 201, { ...headers, "cache-control": "no-store" });
        }
      } else {
        const id = url.pathname.split("/").pop()!;
        if (!stayPhotoIdPattern.test(id)) response = apiError("RESOURCE_NOT_FOUND", "找不到照片。", requestId, 404, headers);
        else {
          const photo = await dependencies.stayPhotosStore.download(verified.trip.id, id);
          response = photo.ok
            ? new Response(photo.body, { status: 200, headers: { ...headers, "content-type": "image/jpeg",
              "cache-control": "no-store", "x-content-type-options": "nosniff" } })
            : apiError("RESOURCE_NOT_FOUND", "找不到照片。", requestId, 404, headers);
        }
      }
    } catch {
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "照片服務暫時無法使用。", requestId, 503, headers);
    }
  } else if ((request.method === "POST" && url.pathname.endsWith("/v1/stays"))
    || ((request.method === "PATCH" || request.method === "DELETE") && /\/v1\/stays\/[^/]+$/.test(url.pathname))) {
    try {
      const token = bearerToken(request);
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers);
      } else {
        const action = request.method === "POST" ? "create" : request.method === "PATCH" ? "update" : "delete";
        const id = action === "create" ? null : url.pathname.split("/").pop()!;
        const body: unknown = await request.json().catch(() => null);
        const parsed = action === "update" ? parseUpdateStayRequest(body) : parseStayInput(body);
        const version = action === "create" ? 0 : typeof body === "object" && body !== null && "expectedVersion" in body ? body.expectedVersion : null;
        const metadata = parseMutationMetadata({ expectedVersion: version, idempotencyKey: request.headers.get("idempotency-key") });
        const validId = id === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (!metadata.ok || !validId || (action !== "delete" && !parsed.ok) || (action !== "create" && (!Number.isSafeInteger(version) || Number(version) < 1))) {
          response = apiError("VALIDATION_FAILED", "住宿保存資料格式不正確。", requestId, 422, headers);
        } else {
          const input: StayInput | null = action === "delete" || !parsed.ok ? null : {
            name: parsed.value.name, city: parsed.value.city, address: parsed.value.address,
            startDate: parsed.value.startDate, endDate: parsed.value.endDate,
            checkin: parsed.value.checkin, checkout: parsed.value.checkout, photo: parsed.value.photo,
          };
          const result = await dependencies.staysStore.mutateStay(verified.trip.id, action, id, input, metadata.value.expectedVersion, metadata.value.idempotencyKey);
          response = json(result, action === "create" ? 201 : 200, headers);
        }
      }
    } catch (error) {
      const code = typeof error === "object" && error !== null && "message" in error
        && error.message === "STAYS_STORE_UNAVAILABLE" && "code" in error ? error.code : null;
      response = code === "VERSION_CONFLICT"
        ? apiError(code, "資料已由其他裝置更新，請重新載入。", requestId, 409, headers)
        : code === "RESOURCE_NOT_FOUND"
          ? apiError(code, "找不到指定住宿。", requestId, 404, headers)
          : code === "VALIDATION_FAILED"
            ? apiError(code, "住宿保存資料格式不正確。", requestId, 422, headers)
            : apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else if (request.method === "GET" && url.pathname.endsWith("/v1/rates")) {
    const token = bearerToken(request);
    const privateHeaders = { ...headers, "cache-control": "no-store" };
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      const currency = url.searchParams.get("currency") ?? "";
      const date = url.searchParams.get("date") ?? "";
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, privateHeaders);
      } else if (!isRateRequestCurrency(currency) || !isRateRequestDate(date)) {
        response = apiError("VALIDATION_FAILED", "請提供有效的幣別與支出日期。", requestId, 422, privateHeaders);
      } else {
        response = json(await dependencies.ratesService.getRate(currency, date), 200, privateHeaders);
      }
    } catch {
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, privateHeaders);
    }
  } else if ((request.method === "POST" && url.pathname.endsWith("/v1/expenses"))
    || ((request.method === "PATCH" || request.method === "DELETE") && /\/v1\/expenses\/[^/]+$/.test(url.pathname))) {
    const privateHeaders = { ...headers, "cache-control": "no-store" };
    try {
      const token = bearerToken(request);
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, privateHeaders);
      } else {
        const id = request.method === "POST" ? null : url.pathname.split("/").pop()!;
        const body: unknown = await request.json().catch(() => null);
        const metadata = parseMutationMetadata({
          expectedVersion: id === null ? 0 : isRecord(body) ? body.expectedVersion : null,
          idempotencyKey: request.headers.get("idempotency-key"),
        });
        const parsed = request.method === "DELETE" ? null : parseExpenseInput(body);
        if (!metadata.ok || (id !== null && (!requestIdPattern.test(id) || !Number.isSafeInteger(metadata.value.expectedVersion) || metadata.value.expectedVersion < 1))
          || parsed?.ok === false) {
          response = apiError("VALIDATION_FAILED", "支出保存資料格式不正確。", requestId, 422, privateHeaders);
        } else {
          const { expectedVersion, idempotencyKey } = metadata.value;
          const mutation: ExpenseMutation = parsed === null
            ? { action: "delete", id: id!, input: null, expectedVersion }
            : id === null
              ? { action: "create", id, input: parsed.value, expectedVersion: 0 }
              : { action: "update", id, input: parsed.value, expectedVersion };
          const input = mutation.input;
          const rate = input && input.currency !== "TWD"
            ? await dependencies.ratesService.getRate(input.currency, input.date).catch(() => null)
            : null;
          const result = await dependencies.expensesStore.mutateExpense(verified.trip.id, mutation, idempotencyKey, rate?.snapshot?.id ?? null);
          response = json(result, id === null ? 201 : 200, privateHeaders);
        }
      }
    } catch (error) {
      const code = error instanceof ExpenseMutationError ? error.code : null;
      response = code === "VERSION_CONFLICT"
        ? apiError(code, "資料已由其他裝置更新，請重新載入。", requestId, 409, privateHeaders)
        : code === "RESOURCE_NOT_FOUND" ? apiError(code, "找不到指定支出。", requestId, 404, privateHeaders)
          : code === "VALIDATION_FAILED" ? apiError(code, "支出保存資料格式不正確。", requestId, 422, privateHeaders)
            : apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, privateHeaders);
    }
  } else if (request.method === "GET" && url.pathname.endsWith("/v1/expenses")) {
    const token = bearerToken(request);
    const privateHeaders = { ...headers, "cache-control": "no-store" };
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, privateHeaders);
      } else {
        const expenses = await dependencies.expensesStore.getExpenses(verified.trip.id);
        response = expenses
          ? json(expenses, 200, privateHeaders)
          : apiError("RESOURCE_NOT_FOUND", "找不到旅程支出資料。", requestId, 404, privateHeaders);
      }
    } catch {
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, privateHeaders);
    }
  } else if (request.method === "GET" && url.pathname.endsWith("/v1/stays")) {
    const token = bearerToken(request);
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      const stays = verified ? await dependencies.staysStore.getStays(verified.trip.id) : null;
      response = !verified
        ? apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers)
        : stays
          ? json(stays, 200, headers)
          : apiError("RESOURCE_NOT_FOUND", "找不到住宿資料。", requestId, 404, headers);
    } catch {
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else if (request.method === "GET" && url.pathname.endsWith("/v1/home")) {
    const token = bearerToken(request);
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      const home = verified ? await dependencies.homeStore.getHome(verified.trip.id) : null;
      response = !verified
        ? apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers)
        : home
          ? json(home, 200, headers)
          : apiError("RESOURCE_NOT_FOUND", "找不到旅程首頁資料。", requestId, 404, headers);
    } catch (error) {
      upstreamStatus = safeUpstreamStatus(error);
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else if (request.method === "PUT" && url.pathname.endsWith("/v1/home/facts")) {
    const token = bearerToken(request);
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers);
      } else {
        const body: unknown = await request.json().catch(() => null);
        const parsed = parseSaveTravelFactsRequest(body);
        const metadata = parseMutationMetadata({
          expectedVersion: parsed.ok ? parsed.value.expectedVersion : null,
          idempotencyKey: request.headers.get("idempotency-key"),
        });
        if (!parsed.ok || !metadata.ok) {
          response = apiError("VALIDATION_FAILED", "小知識保存資料格式不正確。", requestId, 422, headers);
        } else {
          const saved = await dependencies.homeStore.saveFacts(
            verified.trip.id,
            parsed.value.facts,
            parsed.value.expectedVersion,
            metadata.value.idempotencyKey,
          );
          response = json(saved, 200, headers);
        }
      }
    } catch (error) {
      upstreamStatus = safeUpstreamStatus(error);
      const storeCode = safeHomeStoreCode(error);
      response = storeCode === "VERSION_CONFLICT"
        ? apiError("VERSION_CONFLICT", "資料已由其他裝置更新，請重新載入。", requestId, 409, headers)
        : storeCode === "RESOURCE_NOT_FOUND"
          ? apiError("RESOURCE_NOT_FOUND", "找不到旅程首頁資料。", requestId, 404, headers)
          : storeCode === "VALIDATION_FAILED"
            ? apiError("VALIDATION_FAILED", "小知識保存資料格式不正確。", requestId, 422, headers)
            : apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else if (request.method === "GET" && /\/v1\/days\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
    const token = bearerToken(request);
    const date = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      const day = verified ? await dependencies.itineraryStore.getDay(verified.trip.id, date) : null;
      response = !verified
        ? apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers)
        : day
          ? json(day, 200, headers)
          : apiError("RESOURCE_NOT_FOUND", "找不到指定日期的行程。", requestId, 404, headers);
    } catch (error) {
      upstreamStatus = safeUpstreamStatus(error);
      response = apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else if (request.method === "PUT" && /\/v1\/days\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
    const token = bearerToken(request);
    const date = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    try {
      const verified = token ? await dependencies.accessStore.verify(token) : null;
      if (!verified) {
        response = apiError("ACCESS_DENIED", "私人連結無效或已撤銷。", requestId, 401, headers);
      } else {
        const body: unknown = await request.json().catch(() => null);
        const parsed = parseSaveTripDayRequest(body);
        const metadata = parseMutationMetadata({
          expectedVersion: parsed.ok ? parsed.value.expectedVersion : null,
          idempotencyKey: request.headers.get("idempotency-key"),
        });
        if (!parsed.ok || !metadata.ok) {
          response = apiError("VALIDATION_FAILED", "行程保存資料格式不正確。", requestId, 422, headers);
        } else {
          const saved = await dependencies.itineraryStore.saveDayItems(
            verified.trip.id,
            date,
            parsed.value.items,
            parsed.value.expectedVersion,
            metadata.value.idempotencyKey,
          );
          response = json(saved, 200, headers);
        }
      }
    } catch (error) {
      upstreamStatus = safeUpstreamStatus(error);
      const storeCode = safeItineraryStoreCode(error);
      response = storeCode === "VERSION_CONFLICT"
        ? apiError("VERSION_CONFLICT", "資料已由其他裝置更新，請重新載入。", requestId, 409, headers)
        : storeCode === "RESOURCE_NOT_FOUND"
          ? apiError("RESOURCE_NOT_FOUND", "找不到指定日期的行程。", requestId, 404, headers)
          : storeCode === "VALIDATION_FAILED"
            ? apiError("VALIDATION_FAILED", "行程保存資料格式不正確。", requestId, 422, headers)
            : apiError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用，請稍後再試。", requestId, 503, headers);
    }
  } else {
    response = apiError("RESOURCE_NOT_FOUND", "找不到指定的介面。", requestId, 404, headers);
  }

  dependencies.log({
    requestId,
    method: request.method,
    path: url.pathname,
    status: response.status,
    ...(upstreamStatus ? { upstreamStatus } : {}),
  });
  return response;
}
