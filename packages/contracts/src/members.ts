import { checklistItemIdPattern } from "./sharedChecklist.ts";
import { isRecord } from "./validation.ts";

export const memberRoles = ["father", "mother", "brother", "self"] as const;
export interface TripMember {
  id: string;
  tripId: string;
  roleKey: typeof memberRoles[number];
  displayName: string;
}
export function parseTripMembers(input: unknown): TripMember[] | null {
  if (!Array.isArray(input)) return null;
  const members: TripMember[] = [];
  for (const member of input) {
    if (!isRecord(member) || typeof member.id !== "string" || !checklistItemIdPattern.test(member.id)
      || typeof member.tripId !== "string" || !checklistItemIdPattern.test(member.tripId)
      || !memberRoles.some((role) => role === member.roleKey)
      || typeof member.displayName !== "string" || !member.displayName.trim()) return null;
    const roleKey = memberRoles.find((role) => role === member.roleKey);
    if (!roleKey) return null;
    members.push({ id: member.id, tripId: member.tripId, roleKey, displayName: member.displayName });
  }
  return new Set(members.map((member) => member.id)).size === members.length ? members : null;
}
