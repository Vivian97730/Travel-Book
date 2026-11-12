import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { ApiClientError } from "../../shared/api/apiClient";
import { readChecklist, writeChecklist, type ChecklistItem, type ChecklistOperation, type ChecklistSource } from "./checklistSource";
import type { PersonalChecklistRepository } from "./personalChecklistRepository";
import type { SharedChecklistRepository } from "./sharedChecklistRepository";

const tabs = [
  ["essentials", "必備清單", "list"],
  ["luggage", "行李清單", "suitcase"],
  ["todos", "待辦清單", "calendar"],
] as const satisfies ReadonlyArray<readonly [ChecklistSource["kind"], string, IconName]>;

type Pending = { operation: ChecklistOperation; key: string };
type Failure = { message: string; recovery?: "retry" | "reload"; denied?: boolean };
type ListState = { kind: "loading" | "error" } | { kind: "ready"; items: ChecklistItem[] };

function writeFailure(error: unknown, shared: boolean): Failure {
  const code = error instanceof ApiClientError ? error.code : null;
  if (code === "VERSION_CONFLICT") return { message: "清單已由其他裝置更新，請重新載入。", recovery: "reload" };
  if (code === "RESOURCE_NOT_FOUND") return { message: "這個項目已不存在，請重新載入。", recovery: "reload" };
  if (code === "ACCESS_DENIED") return { message: "私人連結已失效，請向家人取得新的連結。", denied: true };
  if (code === "VALIDATION_FAILED") return { message: "無法保存這個清單項目，請檢查輸入。" };
  return { message: shared ? "目前無法確認是否已保存，請重試。" : "無法保存到此裝置，請重試。", recovery: "retry" };
}

export function ChecklistsPage({ shared, personal, online }: {
  shared: SharedChecklistRepository;
  personal: PersonalChecklistRepository;
  online: boolean;
}) {
  const [kind, setKind] = useState<ChecklistSource["kind"]>("essentials");
  const source = useMemo<ChecklistSource>(() => kind === "essentials"
    ? { kind, repository: shared } : { kind, repository: personal }, [kind, personal, shared]);
  function selectTab(next: ChecklistSource["kind"]) {
    if (next === kind) return;
    setKind(next);
    requestAnimationFrame(() => document.getElementById(`checklist-tab-${next}`)?.focus());
  }
  return <ChecklistPanel key={kind} source={source} online={online} onTab={selectTab} />;
}

function ChecklistPanel({ source, online, onTab }: {
  source: ChecklistSource;
  online: boolean;
  onTab(kind: ChecklistSource["kind"]): void;
}) {
  const shared = source.kind === "essentials";
  const offline = shared && !online;
  const label = tabs.find(([kind]) => kind === source.kind)?.[1];
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ item: ChecklistItem | null } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (offline) return;
    let active = true;
    setState({ kind: "loading" });
    readChecklist(source).then((items) => {
      if (active) setState({ kind: "ready", items });
    }, (error: unknown) => {
      if (!active) return;
      setState({ kind: "error" });
      setFailure({ message: error instanceof ApiClientError && error.code === "ACCESS_DENIED"
        ? "私人連結已失效，請向家人取得新的連結。"
        : shared ? "目前無法讀取必備清單。" : "目前無法讀取裝置端清單。", recovery: "reload" });
    });
    return () => { active = false; };
  }, [attempt, offline, shared, source]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const items = state.kind === "ready" ? state.items : [];
  const done = items.filter((item) => item.isDone).length;
  const percent = items.length ? Math.round(done / items.length * 100) : 0;
  const canWrite = state.kind === "ready" && !offline && !busy && failure?.recovery !== "reload" && !failure?.denied;
  const canStart = canWrite && !pending;

  function reload() {
    setEditing(null);
    setFailure(null);
    setPending(null);
    setNotice("");
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }

  function closeEditor() {
    if (inFlight.current) return;
    if (pending) reload();
    else {
      setEditing(null);
      if (failure?.recovery !== "reload" && !failure?.denied) setFailure(null);
    }
  }

  async function save(operation: ChecklistOperation, key: string = crypto.randomUUID()) {
    if (!canWrite || inFlight.current || (shared && !navigator.onLine)) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    setNotice("");
    try {
      const updated = await writeChecklist(source, operation, key, items);
      setState({ kind: "ready", items: updated });
      setPending(null);
      setEditing(null);
      if (operation.action !== "toggle") setNotice(operation.action === "delete" ? "已從清單移除"
        : operation.action === "create" ? "清單項目已新增" : "清單項目已更新");
      if (operation.action === "delete") requestAnimationFrame(() => addButton.current?.focus());
    } catch (error) {
      const result = writeFailure(error, shared);
      setFailure(result);
      setPending(result.recovery === "retry" ? { operation, key } : null);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function openEditor(item: ChecklistItem | null) {
    setFailure(null);
    setEditing({ item });
  }

  const recovery = failure?.recovery === "reload"
    ? <button className="secondary-button" type="button" disabled={offline || busy} onClick={reload}>重新載入</button>
    : pending ? <button className="secondary-button" type="button" disabled={!canWrite}
        onClick={() => void save(pending.operation, pending.key)}>重試</button> : null;

  return <main id="main" className="screen">
    <header className="page-heading">
      <div><p className="eyebrow">Checklists</p><h1>清單</h1></div>
      <button ref={addButton} className="primary-button" type="button" aria-label="新增項目"
        aria-disabled={!canStart} onClick={() => { if (canStart) openEditor(null); }}>
        <Icon name="plus" size={18} /><span>新增項目</span>
      </button>
    </header>
    <nav className="list-tabs" aria-label="清單類型">
      {tabs.map(([kind, name, icon]) => <button className="chip-button" type="button" key={kind} id={`checklist-tab-${kind}`}
        aria-pressed={source.kind === kind} disabled={busy} onClick={() => onTab(kind)}>
        <Icon name={icon} size={17} />{name}
      </button>)}
    </nav>
    <section className="card section-card" aria-labelledby="list-title">
      <div className="section-head"><div><h2 id="list-title">{label}</h2>
        <p>{shared ? "修改後會同步給全家" : "你的個人清單，不與其他成員同步"}</p></div>
        <span className="sync-chip">{shared ? "全家同步" : "僅此裝置"}</span>
      </div>
      {offline ? <p className="inline-notice" role="status">離線時無法載入必備清單，行李與待辦仍可操作。</p>
        : state.kind === "loading" ? <p className="inline-notice" role="status">正在讀取清單…</p> : null}
      {!editing && failure && <div className="checklist-recovery"><p role="alert">{failure.message}</p>{recovery}
        {pending && <button className="secondary-button" type="button" disabled={offline || busy} onClick={reload}>重新載入</button>}
      </div>}
      {!offline && state.kind === "ready" && <>
        <div className="progress-wrap" aria-live="polite">
          <div className="progress-track" aria-hidden="true"><div className="progress-bar" style={{ width: `${percent}%` }} /></div>
          <span className="progress-label" aria-label={`已完成 ${done} 項，共 ${items.length} 項`}>{done}／{items.length}</span>
        </div>
        <div className="check-list formal-check-list">
          {items.length ? items.map((item) => <article className={`check-row${item.isDone ? " is-done" : ""}`} key={item.id}>
            <button className={`check-button${item.isDone ? " is-done" : ""}`} type="button" aria-pressed={item.isDone}
              aria-label={`完成狀態：${item.title}`} aria-disabled={!canStart}
              onClick={() => { if (canStart) void save({ action: "toggle", item }); }}>
              {item.isDone && <Icon name="check" size={17} />}
            </button>
            <button className="check-copy checklist-title-button" type="button" aria-label={`編輯${item.title}`}
              aria-disabled={!canStart} onClick={() => { if (canStart) openEditor(item); }}><strong>{item.title}</strong></button>
            <button className="icon-button" type="button" aria-label={`刪除${item.title}`}
              aria-disabled={!canStart} onClick={() => { if (canStart) void save({ action: "delete", item }); }}>
              <Icon name="trash" size={17} />
            </button>
          </article>) : <p className="empty-state">清單目前是空的。</p>}
        </div>
      </>}
    </section>
    {notice && <div className="toast-region" role="status"><div className="toast">{notice}</div></div>}
    {editing && <ChecklistEditor item={editing.item} canSave={canWrite} busy={busy} pending={pending}
      failure={failure} offline={offline} recovery={failure?.recovery === "reload" ? recovery : null} onClose={closeEditor}
      onSave={(title) => pending ? void save(pending.operation, pending.key)
        : void save(editing.item ? { action: "rename", item: editing.item, title } : { action: "create", title })} />}
  </main>;
}

function ChecklistEditor({ item, canSave, busy, pending, failure, offline, recovery, onClose, onSave }: {
  item: ChecklistItem | null; canSave: boolean; busy: boolean; pending: Pending | null;
  failure: Failure | null; offline: boolean; recovery: ReactNode;
  onClose(): void; onSave(title: string): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    field.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = title.trim();
    if (!normalized) { setInvalid(true); return; }
    if (canSave) onSave(normalized);
  }
  return <dialog className="dialog" ref={dialog} aria-labelledby="checklist-editor-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="dialog-form" onSubmit={submit}>
      <header className="dialog-head">
        <h2 id="checklist-editor-title">{item ? "編輯清單項目" : "新增清單項目"}</h2>
        <button className="icon-button" type="button" aria-label="關閉" disabled={busy} onClick={onClose}><Icon name="close" size={20} /></button>
      </header>
      <div className="field-group">
        <label htmlFor="list-name">項目名稱</label>
        <input className="field" id="list-name" placeholder="例如：暖暖包" required maxLength={item ? 200 : 50}
          ref={field} value={title} readOnly={busy || !!pending} aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "checklist-invalid" : undefined}
          onChange={(event) => { setTitle(event.target.value); setInvalid(false); }} />
        {invalid && <p id="checklist-invalid" role="alert">請輸入項目名稱。</p>}
        {offline && <p role="status">重新連線後即可保存必備清單。</p>}
        {failure && <p role="alert">{failure.message}</p>}
      </div>
      <div className="dialog-actions">
        {recovery}
        <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>取消</button>
        <button className="primary-button" type="submit" disabled={!canSave}>
          {busy ? "保存中…" : pending ? "重試" : item ? "儲存" : "新增"}
        </button>
      </div>
    </form>
  </dialog>;
}
