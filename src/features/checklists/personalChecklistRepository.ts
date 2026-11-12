export type PersonalChecklistKind = "luggage" | "todos";

export interface PersonalChecklistItem {
  id: number;
  title: string;
  isDone: boolean;
}

export type PersonalChecklistPatch = Partial<Pick<PersonalChecklistItem, "title" | "isDone">>;

export interface PersonalChecklistRepository {
  getItems(kind: PersonalChecklistKind): Promise<PersonalChecklistItem[]>;
  addItem(kind: PersonalChecklistKind, title: string): Promise<PersonalChecklistItem>;
  updateItem(kind: PersonalChecklistKind, id: number, patch: PersonalChecklistPatch): Promise<PersonalChecklistItem>;
  deleteItem(kind: PersonalChecklistKind, id: number): Promise<void>;
}

export function normalizePersonalChecklistTitle(input: string): string {
  const title = input.trim();
  if (!title || [...title].length > 200) throw new Error("清單名稱須為 1 至 200 字元。");
  return title;
}
