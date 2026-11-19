import { useEffect, useState } from "react";
import type { TripMember } from "@travel-book/contracts";
import { IndexedDbPersonalChecklistRepository } from "../checklists/indexedDbPersonalChecklistRepository";
import type { PersonalChecklistItem, PersonalChecklistKind } from "../checklists/personalChecklistRepository";
import type { MemberChecklistRepository } from "./memberChecklistRepository";

type Legacy = { kind: PersonalChecklistKind; item: PersonalChecklistItem };
const bindingKey = "travel-book.legacy-checklist-import.v1";
export async function legacyImportKey(entry: Legacy, tripId: string, memberId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([tripId, memberId, entry]))));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function importLegacyChecklist(items: Legacy[], member: TripMember,
  repository: Pick<MemberChecklistRepository, "forKind">, storage: Pick<Storage, "getItem" | "setItem">) {
  const target = `${member.tripId}:${member.id}`;
  const previous = storage.getItem(bindingKey);
  if (previous && previous !== target) throw new Error("IMPORT_ALREADY_BOUND");
  // Ownership must survive interruption before sending any item.
  storage.setItem(bindingKey, target);
  for (const entry of items) {
    await repository.forKind(entry.kind).mutateSharedChecklist({ action: "create", input: {
      title: entry.item.title, isDone: entry.item.isDone,
    } }, await legacyImportKey(entry, member.tripId, member.id));
  }
  storage.setItem(bindingKey, `done:${target}`);
}

export function LegacyChecklistImport({ member, repository, online, onImported }: {
  member: TripMember; repository: MemberChecklistRepository; online: boolean; onImported(): void;
}) {
  const [items, setItems] = useState<Legacy[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const target = `${member.tripId}:${member.id}`;
  useEffect(() => {
    let active = true;
    setItems([]);
    void (async () => {
      const binding = localStorage.getItem(bindingKey);
      if (binding && binding !== target) return;
      const legacy = new IndexedDbPersonalChecklistRepository();
      const entries = (await Promise.all((["luggage", "todos"] as const).map(async (kind) =>
        (await legacy.getItems(kind)).map((item) => ({ kind, item }))))).flat();
      if (active) setItems(entries);
    })().catch(() => { if (active) setMessage("無法檢查舊裝置清單；原資料仍保留，請稍後重試。"); });
    return () => { active = false; };
  }, [target]);
  async function importItems() {
    if (!online || busy) return;
    setBusy(true);
    try {
      await importLegacyChecklist(items, member, repository, localStorage);
      setItems([]);
      setMessage("舊清單已匯入；裝置上的原始資料仍保留。");
      onImported();
    } catch { setMessage("尚未完成匯入，請重試；已保存的項目不會重複新增，原始資料仍保留。"); }
    finally { setBusy(false); }
  }
  if (!items.length && !message) return null;
  return <section className="card section-card">
    {!!items.length && <><h2>發現舊裝置清單</h2><p>共有 {items.length} 項。請確認這些行李與待辦屬於「{member.displayName}」，再匯入目前旅程。原始資料會保留。</p>
      <button className="secondary-button" disabled={!online || busy} onClick={() => void importItems()}>{busy ? "匯入中…" : `確認匯入至${member.displayName}`}</button></>}
    {message && <p role="status">{message}</p>}
  </section>;
}
