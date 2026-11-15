import type { SharedChecklistMutation, SharedChecklistResponse } from "@travel-book/contracts";

export interface SharedChecklistRepository {
  getSharedChecklist(): Promise<SharedChecklistResponse>;
  mutateSharedChecklist(mutation: SharedChecklistMutation, idempotencyKey: string): Promise<SharedChecklistResponse>;
}
