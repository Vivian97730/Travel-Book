import type { Stay, StayInput } from "@travel-book/contracts";

export interface StaysRepository {
  getStays(): Promise<Stay[]>;
  createStay(input: StayInput): Promise<Stay>;
  updateStay(id: string, input: StayInput, expectedVersion: number): Promise<Stay>;
  deleteStay(id: string, expectedVersion: number): Promise<void>;
}
