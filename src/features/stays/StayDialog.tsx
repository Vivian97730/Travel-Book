import { StayPhoto } from "./StayPhoto";
import { prepareStayPhoto } from "./prepareStayPhoto";
import type { StaysRepository } from "./staysRepository";
import { useEffect, useRef, useState } from "react";
import { parseStayInput, type Stay, type StayInput } from "@travel-book/contracts";
import { Icon } from "../../components/Icon";

export function stayFailureMessage(error: unknown): { conflict: boolean; message: string } {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : error instanceof Error ? error.message : "";
  return code === "VERSION_CONFLICT"
    ? { conflict: true, message: "住宿已由其他裝置更新，草稿仍保留。重新載入會捨棄本次草稿並顯示最新資料。" }
    : { conflict: false, message: code === "RESOURCE_NOT_FOUND" ? "這筆住宿已不存在，草稿仍保留。請取消並重新載入清單。" : code === "ACCESS_DENIED" ? "私人連結已失效，草稿仍保留，請取得新的連結。" : "目前無法保存住宿，草稿仍保留，請稍後重試。" };
}

export function StayDialog({ stay, online, startDate, endDate, onClose, onSave, onDelete, onReload, repository }: {
  repository?: StaysRepository;
  stay: Stay | null; online: boolean; startDate: string; endDate: string;
  onClose(): void; onSave(input: StayInput): Promise<void>;
  onDelete(): Promise<void>; onReload(): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!selected) { setPreview(null); return; }
    const url = URL.createObjectURL(selected);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selected]);
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
      disabled={busy || photoBusy}
      onChange={(event) => setValue({ ...value, [key]: event.target.value })}
      placeholder={key === "name" ? "貼上 Google Maps 上的住宿名稱" : key === "city" ? "例如：維也納" : key === "address" ? "輸入完整住宿地址" : undefined} />
      </div>;
  }
  return <dialog ref={dialog} className="dialog" aria-labelledby="stay-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy && !photoBusy) onClose(); }}>
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const parsed = parseStayInput(value);
      if (!parsed.ok) { setFailure({ conflict: false, message: parsed.issues[0].message }); return; }
      if (photoBusy) return;
      if (!failure?.conflict) void run(async () => {
        let photo = parsed.value.photo;
        if (selected) {
          if (!repository?.uploadPhoto) throw new Error("照片服務尚未開放。");
          photo = await repository.uploadPhoto(selected);
          setValue((current) => ({ ...current, photo }));
          setSelected(null);
        }
        await onSave({ ...parsed.value, photo });
      });
    }}>
      <header className="dialog-head"><h2 id="stay-dialog-title">{stay ? "編輯住宿" : "新增住宿"}</h2><button className="icon-button" type="button" disabled={busy || photoBusy} onClick={onClose} aria-label="關閉"><Icon name="close" size={20} /></button></header>
      {field("name", "住宿名稱", "text", 80)}
      <section className="stay-photo-finder" data-photo-state={photoBusy ? "loading" : selected || value.photo ? "ready" : "idle"} aria-live="polite">
        <div className="stay-photo-thumb">{preview ? <img src={preview} alt="住宿照片預覽" onError={() => { setSelected(null); setPhotoError("圖片無法讀取，將使用預設插畫。"); }} /> : <StayPhoto photo={value.photo} repository={repository} online={online} alt="住宿照片預覽" fallback={<Icon name="image" size={24} />} />}</div>
        <div><strong>住宿照片</strong>{(photoBusy || selected || value.photo) && <p>{photoBusy ? "正在處理圖片…" : "已選擇住宿照片"}</p>}
          <button className="secondary-button stay-photo-select" type="button" disabled={busy || photoBusy || !online || !repository?.uploadPhoto} onClick={() => photoInput.current?.click()}>選擇檔案</button><input ref={photoInput} id="stay-photo" aria-label="住宿照片檔案" hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || photoBusy || !online || !repository?.uploadPhoto} onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file) return;
            setPhotoBusy(true); setPhotoError(null);
            void prepareStayPhoto(file).then(setSelected).catch((error: unknown) => setPhotoError(error instanceof Error ? error.message : "圖片無法讀取，請重新選擇。" )).finally(() => setPhotoBusy(false));
          }} />
          <small>JPEG、PNG 或 WebP，最大 10 MB。未上傳或讀取失敗時使用預設插畫。</small>
          {(selected || value.photo) && <button type="button" className="danger-button stay-photo-remove" disabled={busy || photoBusy || !online} onClick={() => { setSelected(null); setValue((current) => ({ ...current, photo: null })); setPhotoError(null); }}>移除照片</button>}
          {photoError && <p role="alert">{photoError}</p>}
        </div>
      </section>
      {field("city", "城市", "text", 40)}
      <div className="date-field-row">{field("startDate", "入住日期", "date")}{field("endDate", "退房日期", "date")}</div>
      {field("address", "地址", "text", 160)}
      <div className="date-field-row">{field("checkin", "Check-in", "time")}{field("checkout", "Check-out", "time")}</div>
      {!online && <p role="status">目前離線，住宿無法保存或刪除。</p>}
      {failure && <div role="alert"><p>{failure.message}</p>{failure.conflict && <button className="secondary-button" type="button" disabled={busy || photoBusy || !online} onClick={() => void run(onReload)}>重新載入最新住宿</button>}</div>}
      <div className="dialog-actions">
        {stay && <button className="danger-button delete-stay-button" type="button" disabled={busy || photoBusy || !online || !!failure?.conflict} onClick={() => { if (window.confirm(`確定刪除「${stay.name}」？`)) void run(onDelete); }}><Icon name="trash" size={17} />刪除住宿</button>}
        <button className="secondary-button" type="button" disabled={busy || photoBusy} onClick={onClose}>取消</button>
        <button className="primary-button" type="submit" disabled={busy || photoBusy || !online || !!failure?.conflict}>{busy ? "處理中…" : "儲存"}</button>
      </div>
    </form>
  </dialog>;
}
