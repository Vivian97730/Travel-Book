import {
  parseAccessVerifyResponse,
  parseTripHome,
  type AccessVerifyResponse,
  type TripHome,
} from "@travel-book/contracts";

export const HOME_SNAPSHOT_VERSION = 1;
export const HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface HomeSnapshot {
  snapshotVersion: typeof HOME_SNAPSHOT_VERSION;
  tokenHash: string;
  syncedAt: string;
  expiresAt: string;
  access: AccessVerifyResponse;
  home: TripHome;
}

export interface HomeSnapshotRepository {
  get(tokenHash: string): Promise<HomeSnapshot | null>;
  put(snapshot: HomeSnapshot): Promise<void>;
  delete(tokenHash: string): Promise<void>;
}

export function createHomeSnapshot(input: {
  tokenHash: string;
  access: AccessVerifyResponse;
  home: TripHome;
  now?: Date;
}): HomeSnapshot {
  const now = input.now ?? new Date();
  const access = structuredClone(input.access);
  access.resourceVersions.home = input.home.version;
  return {
    snapshotVersion: HOME_SNAPSHOT_VERSION,
    tokenHash: input.tokenHash,
    syncedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + HOME_SNAPSHOT_MAX_AGE_MS).toISOString(),
    access,
    home: structuredClone(input.home),
  };
}

export function parseHomeSnapshot(input: unknown, expectedTokenHash: string): HomeSnapshot | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as Record<string, unknown>;
  if (
    candidate.snapshotVersion !== HOME_SNAPSHOT_VERSION
    || candidate.tokenHash !== expectedTokenHash
    || !/^[0-9a-f]{64}$/.test(expectedTokenHash)
    || typeof candidate.syncedAt !== "string"
    || typeof candidate.expiresAt !== "string"
    || !Number.isFinite(Date.parse(candidate.syncedAt))
    || !Number.isFinite(Date.parse(candidate.expiresAt))
    || Date.parse(candidate.expiresAt) <= Date.parse(candidate.syncedAt)
  ) return null;

  const access = parseAccessVerifyResponse(candidate.access);
  const home = parseTripHome(candidate.home);
  if (!access.ok || !home.ok) return null;

  return {
    snapshotVersion: HOME_SNAPSHOT_VERSION,
    tokenHash: expectedTokenHash,
    syncedAt: candidate.syncedAt,
    expiresAt: candidate.expiresAt,
    access: access.value,
    home: home.value,
  };
}

export async function hashAccessToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getHomeSnapshotForToken(
  repository: HomeSnapshotRepository,
  token: string,
): Promise<HomeSnapshot | null> {
  return repository.get(await hashAccessToken(token));
}

export async function deleteHomeSnapshotForToken(
  repository: HomeSnapshotRepository,
  token: string,
): Promise<void> {
  await repository.delete(await hashAccessToken(token));
}
