import { useEffect, useRef, useState, type ReactNode } from "react";
import { parseTripMembers, type TripMember } from "@travel-book/contracts";
import { CoreSnapshots } from "../offline/coreSnapshots";
import { hashAccessToken } from "../offline/homeSnapshotRepository";
import { MemberChecklistRepository } from "./memberChecklistRepository";
import { getMembers, memberStorageKey, restoreMember } from "./memberSelectionStore";

function MemberAvatar({ role }: { role: TripMember["roleKey"] }) {
  return <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="12" r="6" fill="currentColor" opacity=".18" />
    <path d="M5 29c0-7 5-10 11-10s11 3 11 10" fill="currentColor" opacity=".22" />
    <circle cx="16" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
    {role === "mother" ? <path d="M10 10c-2 5-3 8-2 10m14-10c2 5 3 8 2 10" stroke="currentColor" strokeWidth="2" />
      : role === "father" ? <path d="M10 12h5m2 0h5m-7 0h2" stroke="currentColor" strokeWidth="2" />
      : <path d="m11 7 4-3 2 3 4-1" stroke="currentColor" strokeWidth="2" />}
  </svg>;
}
export function MemberSession({ tripId, token, baseUrl, online, children }: {
  tripId: string; token: string; baseUrl: string; online: boolean;
  children(member: TripMember, repository: MemberChecklistRepository, switchMember: () => void): ReactNode;
}) {
  const choosing = useRef(false);
  const switching = useRef<Promise<void>>(Promise.resolve());
  const [members, setMembers] = useState<TripMember[] | null>(null);
  const [selection, setSelection] = useState<{ member: TripMember; repository: MemberChecklistRepository } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    let active = true;
    setMembers(null);
    setError("");
    void (async () => {
      const hash = await hashAccessToken(token);
      const snapshots = new CoreSnapshots();
      let roster: TripMember[] | null;
      if (online) {
        roster = await getMembers(baseUrl, token, tripId);
        await snapshots.put(hash, `members:${tripId}`, roster).catch(() => undefined);
      } else {
        const entry = await snapshots.get(hash, `members:${tripId}`);
        roster = entry && Date.parse(entry.expiresAt) > Date.now() ? parseTripMembers(entry.data) : null;
        if (!roster || roster.some((member) => member.tripId !== tripId)) throw new Error("OFFLINE_MEMBERS_UNAVAILABLE");
      }
      if (!active) return;
      setMembers(roster);
      let member: TripMember | null = null;
      try { member = restoreMember(tripId, roster, localStorage); } catch { /* Selection works without storage. */ }
      setSelection((previous) => {
        if (member && previous?.member.id === member.id) return previous;
        void previous?.repository.stop().catch(() => undefined);
        return member ? { member, repository: new MemberChecklistRepository(baseUrl, token, hash, tripId, member.id) } : null;
      });
    })().catch(() => { if (active) setError(online ? "目前無法確認成員，請重試。已保存的清單不會被清空。" : "尚無可用的離線角色資料，請連線後再試。"); });
    return () => { active = false; };
  }, [tripId, token, baseUrl, online, attempt]);

  useEffect(() => {
    const repository = selection?.repository;
    return () => { void repository?.stopSaving().catch(() => undefined); };
  }, [selection?.repository]);

  useEffect(() => {
    if (!online || !members || !selection) return;
    void Promise.allSettled([selection.repository.forKind("luggage").getSharedChecklist(), selection.repository.forKind("todos").getSharedChecklist()]);
  }, [members, online, selection]);

  async function choose(member: TripMember) {
    if (!online || choosing.current) return;
    choosing.current = true;
    try { localStorage.setItem(memberStorageKey(tripId), member.id); }
    catch { setStorageNotice("此瀏覽器無法保存角色，下次開啟時需重新選擇。"); }
    await switching.current;
    const hash = await hashAccessToken(token);
    const repository = new MemberChecklistRepository(baseUrl, token, hash, tripId, member.id);
    setSelection({ member, repository });
    choosing.current = false;

  }
  function switchMember() {
    if (!online) return;
    const previous = selection;
    setSelection(null); // Unmount every private list before another member can render.
    switching.current = previous?.repository.stop().catch(() => undefined) ?? Promise.resolve();
    try { localStorage.removeItem(memberStorageKey(tripId)); } catch { /* Session still switches. */ }
  }
  if (members && selection) return <>{storageNotice && <p role="status">{storageNotice}</p>}{children(selection.member, selection.repository, switchMember)}</>;
  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">旅</span><span>Travel Book</span></div></header>
    <main className="screen"><section className="card section-card">
      <h1>請問你是哪位成員？</h1>
      {!members && !error && <p role="status">正在確認旅程成員…</p>}
      {error && <><p role="alert">{error}</p><button className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>重試</button></>}
      {members && <div className="member-options">{members.map((member) => <button className="secondary-button member-option" key={member.id}
        disabled={!online} onClick={() => void choose(member)}><span className="avatar" aria-hidden="true"><MemberAvatar role={member.roleKey} /></span>{member.displayName}</button>)}</div>}
      {!online && <p>切換角色需連線確認，清單維持離線唯讀。</p>}
    </section></main></div>;
}
