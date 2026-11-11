import type { Stay, StayInput } from "@travel-book/contracts";

export interface StaysRepository {
  readonly lastSyncedAt?: string | null;
  uploadPhoto?(file: Blob): Promise<{ id: string }>;
  readPhoto?(id: string): Promise<Blob>;
  getStays(): Promise<Stay[]>;
  createStay(input: StayInput): Promise<Stay>;
  updateStay(id: string, input: StayInput, expectedVersion: number): Promise<Stay>;
  deleteStay(id: string, expectedVersion: number): Promise<void>;
}
