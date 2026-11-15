import type { SharedChecklistItem, SharedChecklistMutation } from "@travel-book/contracts";
import type { PersonalChecklistItem, PersonalChecklistKind, PersonalChecklistRepository } from "./personalChecklistRepository";
import type { SharedChecklistRepository } from "./sharedChecklistRepository";

export type ChecklistItem = SharedChecklistItem | PersonalChecklistItem;
export type ChecklistSource =
  | { kind: "essentials"; repository: SharedChecklistRepository }
  | { kind: PersonalChecklistKind; repository: PersonalChecklistRepository };

export type ChecklistOperation =
  | { action: "create"; title: string }
  | { action: "rename"; item: ChecklistItem; title: string }
  | { action: "toggle" | "delete"; item: ChecklistItem };

export async function readChecklist(source: ChecklistSource): Promise<ChecklistItem[]> {
  return source.kind === "essentials"
    ? (await source.repository.getSharedChecklist()).items
    : source.repository.getItems(source.kind);
}

export async function writeChecklist(
  source: ChecklistSource, operation: ChecklistOperation, key: string, items: ChecklistItem[],
): Promise<ChecklistItem[]> {
  if (source.kind === "essentials") {
    let mutation: SharedChecklistMutation;
    if (operation.action === "create") {
      mutation = { action: "create", input: { title: operation.title } };
    } else {
      const { item } = operation;
      if (!("version" in item)) throw new Error("Invalid shared checklist item");
      const target = { id: item.id, expectedVersion: item.version };
      mutation = operation.action === "delete" ? { action: "delete", ...target }
        : { action: "update", ...target, input: operation.action === "rename"
          ? { title: operation.title } : { isDone: !item.isDone } };
    }
    return (await source.repository.mutateSharedChecklist(mutation, key)).items;
  }

  const { kind, repository } = source;
  if (operation.action === "create") return [...items, await repository.addItem(kind, operation.title)];
  const { item } = operation;
  if (typeof item.id !== "number") throw new Error("Invalid personal checklist item");
  if (operation.action === "delete") {
    await repository.deleteItem(kind, item.id);
    return items.filter((entry) => entry.id !== item.id);
  }
  const updated = await repository.updateItem(kind, item.id,
    operation.action === "rename" ? { title: operation.title } : { isDone: !item.isDone });
  return items.map((entry) => entry.id === updated.id ? updated : entry);
}
