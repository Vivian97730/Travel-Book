import type { StayInput } from "@travel-book/contracts";
import type { StaysRepository } from "./staysRepository";

export interface PendingStayPhoto { file: Blob; photo: { id: string } }

// Keep an ambiguous upload/mutation pair stable across retries. Cleanup may only
// discard its ID once the server has fenced it against future attachments.
export async function saveStayPhoto(
  input: StayInput, selected: Blob | null,
  pending: { current: PendingStayPhoto | null },
  repository: StaysRepository | undefined,
  save: (input: StayInput) => Promise<void>,
) {
  if (!selected) return save(input);
  if (!repository?.uploadPhoto) throw new Error("照片服務尚未開放。");
  if (pending.current?.file !== selected) {
    pending.current = { file: selected, photo: await repository.uploadPhoto(selected) };
  }
  const uploaded = pending.current;
  try {
    await save({ ...input, photo: uploaded.photo });
    pending.current = null;
  } catch (error) {
    // A lost response may mean the stay was committed, even if another device
    // has since removed its photo. Preserve the original mutation body/key for
    // those retries; only compensate a definite database rejection.
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if ((code === "VALIDATION_FAILED" || code === "VERSION_CONFLICT" || code === "RESOURCE_NOT_FOUND")
      && await repository.removePhoto?.(uploaded.photo.id).catch(() => false)) pending.current = null;
    throw error;
  }
}
