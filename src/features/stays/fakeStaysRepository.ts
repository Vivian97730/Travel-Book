import { parseStayInput, type Stay, type StayInput } from "@travel-book/contracts";
import type { StaysRepository } from "./staysRepository";

export class FakeStaysRepository implements StaysRepository {
  private readonly stays: Map<string, Stay>;

  constructor(stays: readonly Stay[] = []) {
    this.stays = new Map(stays.map((stay) => [stay.id, structuredClone(stay)]));
  }

  async getStays(): Promise<Stay[]> {
    return structuredClone([...this.stays.values()].sort((a, b) =>
      a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)));
  }

  async createStay(input: StayInput): Promise<Stay> {
    if (!parseStayInput(input).ok) throw new Error("VALIDATION_FAILED");
    const stay: Stay = { ...structuredClone(input), id: crypto.randomUUID(), version: 1, placeId: null };
    this.stays.set(stay.id, stay);
    return structuredClone(stay);
  }

  async updateStay(id: string, input: StayInput, expectedVersion: number): Promise<Stay> {
    const current = this.requireStay(id, expectedVersion);
    if (!parseStayInput(input).ok) throw new Error("VALIDATION_FAILED");
    const stay = { ...current, ...structuredClone(input), version: current.version + 1 };
    this.stays.set(id, stay);
    return structuredClone(stay);
  }

  async deleteStay(id: string, expectedVersion: number): Promise<void> {
    this.requireStay(id, expectedVersion);
    this.stays.delete(id);
  }

  private requireStay(id: string, expectedVersion: number): Stay {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new Error("VALIDATION_FAILED");
    const stay = this.stays.get(id);
    if (!stay) throw new Error("RESOURCE_NOT_FOUND");
    if (stay.version !== expectedVersion) throw new Error("VERSION_CONFLICT");
    return stay;
  }
}
