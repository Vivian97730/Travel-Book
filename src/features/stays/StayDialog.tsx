import { useEffect, useRef, useState } from "react";
import { parseStayInput, type Stay, type StayInput } from "@travel-book/contracts";
import { Icon } from "../../components/Icon";

export function stayFailureMessage(error: unknown): { conflict: boolean; message: string } {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : error instanceof Error ? error.message : "";
  return code === "VERSION_CONFLICT"
    ? { conflict: true, message: "住宿已由其他裝置更新，草稿仍保留。重新載入會捨棄本次草稿並顯示最新資料。" }
    : { conflict: false, message: code === "RESOURCE_NOT_FOUND" ? "這筆住宿已不存在，草稿仍保留。請取消並重新載入清單。" : code === "ACCESS_DENIED" ? "私人連結已失效，草稿仍保留，請取得新的連結。" : "目前無法保存住宿，草稿仍保留，請稍後重試。" };
}

export function StayDialog({ stay, online, startDate, endDate, onClose, onSave, onDelete, onReload }: {
  stay: Stay | null; online: boolean; startDate: string; endDate: string;
  onClose(): void; onSave(input: StayInput): Promise<void>;
  onDelete(): Promise<void>; onReload(): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ReturnType<typeof stayFailureMessage> | null>(null);
  const [value, setValue] = useState<StayInput>(() => stay ? {
    name: stay.name, city: stay.city, address: stay.address,
    startDate: stay.startDate, endDate: stay.endDate, checkin: stay.checkin, checkout: stay.checkout, photo: stay.photo,
  } : { name: "", city: "", address: "", startDate, endDate: "", checkin: "15:00", checkout: "11:00", photo: null });
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    name.current?.focus();
    return () => {
      element?.close();
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector<HTMLElement>('[aria-label="新增住宿"]')?.focus();
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (!online || busy) return;
    setBusy(true);
    setFailure(null);
    try { await action(); } catch (error) { setFailure(stayFailureMessage(error)); } finally { setBusy(false); }
  }
  function field(key: keyof Omit<StayInput, "photo">, label: string, type = "text", maxLength?: number) {
    return <div className="field-group"><label htmlFor={`stay-${key}`}>{label}</label><input
      className="field" id={`stay-${key}`} ref={key === "name" ? name : undefined}
      value={value[key]} type={type} required maxLength={maxLength}
      min={type === "date" ? startDate : undefined} max={type === "date" ? endDate : undefined}
      disabled={busy}
      onChange={(event) => setValue({ ...value, [key]: event.target.value })}
      placeholder={key === "name" ? "貼上 Google Maps 上的住宿名稱" : key === "city" ? "例如：維也納" : key === "address" ? "輸入完整住宿地址" : undefined} />
      {key === "name" && <small className="field-hint">住宿照片搜尋功能尚未開放，將使用預設插畫。</small>}</div>;
  }
  return <dialog ref={dialog} className="dialog" aria-labelledby="stay-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const parsed = parseStayInput(value);
      if (!parsed.ok) { setFailure({ conflict: false, message: parsed.issues[0].message }); return; }
      if (!failure?.conflict) void run(() => onSave(parsed.value));
    }}>
      <header className="dialog-head"><h2 id="stay-dialog-title">{stay ? "編輯住宿" : "新增住宿"}</h2><button className="icon-button" type="button" disabled={busy} onClick={onClose} aria-label="關閉"><Icon name="close" size={20} /></button></header>
      {field("name", "住宿名稱", "text", 80)}
      <section className="stay-photo-finder" data-photo-state="idle" aria-live="polite"><div className="stay-photo-thumb"><Icon name="image" size={24} /></div><div><strong>住宿照片</strong><p>使用冬季山景與房屋插畫</p><small>照片搜尋與作者標示將於後續開放。</small></div></section>
      {field("city", "城市", "text", 40)}
      <div className="date-field-row">{field("startDate", "入住日期", "date")}{field("endDate", "退房日期", "date")}</div>
      {field("address", "地址", "text", 160)}
      <div className="date-field-row">{field("checkin", "Check-in", "time")}{field("checkout", "Check-out", "time")}</div>
      {!online && <p role="status">目前離線，住宿無法保存或刪除。</p>}
      {failure && <div role="alert"><p>{failure.message}</p>{failure.conflict && <button className="secondary-button" type="button" disabled={busy || !online} onClick={() => void run(onReload)}>重新載入最新住宿</button>}</div>}
      <div className="dialog-actions">
        {stay && <button className="danger-button delete-stay-button" type="button" disabled={busy || !online || !!failure?.conflict} onClick={() => { if (window.confirm(`確定刪除「${stay.name}」？`)) void run(onDelete); }}><Icon name="trash" size={17} />刪除住宿</button>}
        <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>取消</button>
        <button className="primary-button" type="submit" disabled={busy || !online || !!failure?.conflict}>{busy ? "處理中…" : "儲存"}</button>
      </div>
    </form>
  </dialog>;
}
