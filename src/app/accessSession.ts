import { hashForRoute, parseAppHash } from "./routing";

const ACCESS_TOKEN_KEY = "travel-book.private-access.v1";

export interface AccessTokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CookieAccess {
  read(): string;
  write(value: string): void;
  path: string;
}

const COOKIE_NAME = "travel-book-access-v1";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
const validToken = (value: string | null): value is string =>
  value !== null && /^[A-Za-z0-9._~-]+$/.test(value);

export function createAccessTokenStore(storage: () => StorageLike, cookie: CookieAccess): AccessTokenStore {
  const readCookie = () => {
    try {
      const value = cookie.read().split(";").map((part) => part.trim())
        .find((part) => part.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1) ?? null;
      return validToken(value) ? value : null;
    } catch { return null; }
  };
  const writeCookie = (value: string, maxAge: number) => {
    try {
      cookie.write(`${COOKIE_NAME}=${value}; Path=${cookie.path}; Max-Age=${maxAge}; Secure; SameSite=Strict`);
    } catch { /* A blocked cookie must not prevent an otherwise usable session. */ }
  };
  return {
    get: () => {
      try {
        const value = storage().getItem(ACCESS_TOKEN_KEY);
        if (validToken(value)) return value;
      } catch { /* Fall back to the installation cookie when storage is blocked. */ }
      return readCookie();
    },
    set: (token) => {
      if (!validToken(token)) return;
      try { storage().setItem(ACCESS_TOKEN_KEY, token); } catch { /* Keep the in-memory session. */ }
      writeCookie(token, COOKIE_MAX_AGE);
    },
    clear: () => {
      try { storage().removeItem(ACCESS_TOKEN_KEY); } catch { /* Still clear the cookie. */ }
      writeCookie("", 0);
    },
  };
}

export function captureAccessToken(input: {
  hash: string;
  pathname: string;
  search: string;
  replaceUrl(url: string): void;
}): string | null {
  const parsed = parseAppHash(input.hash);
  if (parsed.kind !== "access") return null;

  input.replaceUrl(`${input.pathname}${input.search}${hashForRoute("itinerary")}`);
  return parsed.token;
}
