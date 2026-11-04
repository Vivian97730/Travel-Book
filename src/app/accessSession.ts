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

export function createAccessTokenStore(storage: StorageLike): AccessTokenStore {
  return {
    get: () => storage.getItem(ACCESS_TOKEN_KEY),
    set: (token) => storage.setItem(ACCESS_TOKEN_KEY, token),
    clear: () => storage.removeItem(ACCESS_TOKEN_KEY),
  };
}

export function captureAccessToken(input: {
  hash: string;
  pathname: string;
  search: string;
  store: AccessTokenStore;
  replaceUrl(url: string): void;
}): string | null {
  const parsed = parseAppHash(input.hash);
  if (parsed.kind !== "access") return null;

  input.store.set(parsed.token);
  input.replaceUrl(`${input.pathname}${input.search}${hashForRoute("itinerary")}`);
  return parsed.token;
}
