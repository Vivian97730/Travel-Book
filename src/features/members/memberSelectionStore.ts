import { parseApiError, parseTripMembers, type TripMember } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";

export function memberStorageKey(tripId: string) { return `travel-book.member.v1:${tripId}`; }
export function restoreMember(tripId: string, members: TripMember[], storage: Pick<Storage, "getItem">): TripMember | null {
  try {
    const id = storage.getItem(memberStorageKey(tripId));
    return members.find((member) => member.tripId === tripId && member.id === id) ?? null;
  } catch { return null; }
}
export async function getMembers(baseUrl: string, token: string, tripId: string): Promise<TripMember[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/members`, {
    headers: { authorization: `Bearer ${token}` }, cache: "no-store",
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const parsed = parseApiError(payload);
    if (parsed.ok) throw new ApiClientError(parsed.value.error.code, parsed.value.error.message, parsed.value.error.requestId);
    throw new Error("MEMBERS_UNAVAILABLE");
  }
  const members = parseTripMembers(payload);
  if (!members || members.some((member) => member.tripId !== tripId)) throw new Error("INVALID_MEMBERS");
  return members;
}
