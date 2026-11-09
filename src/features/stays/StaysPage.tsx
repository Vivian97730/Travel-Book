import { useEffect, useState } from "react";
import type { Stay, StayInput } from "@travel-book/contracts";
import { StayDialog } from "./StayDialog";
import { Icon } from "../../components/Icon";
import type { StaysRepository } from "./staysRepository";

export function StayIllustration({ index }: { index: number }) {
  const [bg, accent] = index % 3 === 0 ? ["#e3f0f4", "#77a9bd"] : index % 3 === 1 ? ["#dce9e0", "#6f9d82"] : ["#f9ddd4", "#d36b54"];
  return <svg viewBox="0 0 500 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="500" height="300" fill={bg} /><circle cx="405" cy="62" r="35" fill="#f4d889" /><path d="M0 245 118 116l92 99 82-124 101 128 107-95v176H0z" fill={accent} opacity=".62" /><path d="M0 263c126-44 217 5 315-19 82-20 132-4 185 15v41H0z" fill="#274e43" opacity=".68" /><g transform={`translate(${80 + index * 28} 152)`}><rect x="0" y="32" width="126" height="86" rx="8" fill="#fffdf8" /><path d="m-14 36 77-53 78 53z" fill="#a94135" /><path d="M25 60h76M63 32v86" fill="none" stroke="#274e43" strokeWidth="5" /></g></svg>;
}

export function StayCard({ stay, index, onEdit }: { stay: Stay; index: number; onEdit?: (stay: Stay) => void }) {
  const nights = Math.round((Date.parse(stay.endDate) - Date.parse(stay.startDate)) / 86400000);
  const date = `${stay.startDate.slice(5).replace("-", "／")}－${stay.endDate.slice(5).replace("-", "／")}`;
  return <article className="card stay-card"><div className="stay-visual"><StayIllustration index={index} /></div><div><span className="stay-date">{date}・{stay.city}・{nights} 晚</span><h2>{stay.name}</h2><p className="stay-address"><Icon name="location" size={17} />{stay.address}</p><div className="stay-times"><div className="stay-time"><span>CHECK-IN</span><strong>{stay.checkin} 後</strong></div><div className="stay-time"><span>CHECK-OUT</span><strong>{stay.checkout} 前</strong></div></div><div className="stay-actions" style={{ marginTop: "1rem" }}><a className="primary-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Icon name="location" size={17} />導航</a><button className="secondary-button" type="button" disabled={!onEdit} onClick={() => onEdit?.(stay)}><Icon name="edit" size={17} />編輯</button></div></div></article>;
}

export function StaysContent({ stays, onEdit }: { stays: readonly Stay[]; onEdit?: (stay: Stay) => void }) {
  return <section className="stay-list">{stays.length ? [...stays].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)).map((stay, index) => <StayCard key={stay.id} stay={stay} index={index} onEdit={onEdit} />) : <p className="empty-state">尚未新增住宿。</p>}</section>;
}

export function StaysPage({ repository, online, startDate = "2027-02-05", endDate = "2027-02-15" }: { repository: StaysRepository; online: boolean; startDate?: string; endDate?: string }) {
  const [stays, setStays] = useState<Stay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{ stay: Stay | null; key: number } | null>(null);
  useEffect(() => {
    let active = true;
    setError(null);
    if (!online) return () => { active = false; };
    repository.getStays().then((data) => { if (active) setStays(data); }).catch((error: unknown) => {
      if (active) setError(typeof error === "object" && error !== null && "code" in error && error.code === "ACCESS_DENIED"
        ? "私人連結已失效，請重新開啟家人分享的連結。" : "目前無法讀取住宿，請稍後重試。");
    });
    return () => { active = false; };
  }, [repository, online, retry]);
  async function save(input: StayInput) {
    if (!online || !editor) throw new Error("OFFLINE_READ_ONLY");
    const saved = editor.stay
      ? await repository.updateStay(editor.stay.id, input, editor.stay.version)
      : await repository.createStay(input);
    setStays((current) => [...(current ?? []).filter((stay) => stay.id !== saved.id), saved]);
    setEditor(null);
  }
  async function remove() {
    if (!online || !editor?.stay) throw new Error("OFFLINE_READ_ONLY");
    await repository.deleteStay(editor.stay.id, editor.stay.version);
    setStays((current) => (current ?? []).filter((stay) => stay.id !== editor.stay!.id));
    setEditor(null);
  }
  async function reloadEditor() {
    if (!online || !editor?.stay) return;
    const latest = await repository.getStays();
    const stay = latest.find((item) => item.id === editor.stay!.id);
    if (!stay) throw new Error("RESOURCE_NOT_FOUND");
    setStays(latest);
    setEditor({ stay, key: editor.key + 1 });
  }
  return <main id="main" className="screen"><header className="page-heading"><div><p className="eyebrow">Stays</p><h1>住宿</h1></div><button className="primary-button" type="button" aria-label="新增住宿" disabled={!online || stays === null || !!error} onClick={() => setEditor({ stay: null, key: 0 })}><Icon name="plus" size={18} /><span>新增住宿</span></button></header>
    {!online && <p role="status">目前離線，住宿為唯讀。{stays === null ? "連線後即可讀取住宿資料。" : ""}</p>}
    {error ? <section className="card section-card"><p role="alert">{error}</p><button className="secondary-button" type="button" disabled={!online} onClick={() => setRetry((value) => value + 1)}>重新載入</button></section>
      : stays === null ? online && <p className="loading-state" role="status">正在讀取住宿…</p>
      : <StaysContent stays={stays} onEdit={online ? (stay) => setEditor({ stay, key: 0 }) : undefined} />}
    {editor && <StayDialog key={editor.key} stay={editor.stay} online={online} startDate={startDate} endDate={endDate}
      onClose={() => setEditor(null)} onSave={save} onDelete={remove} onReload={reloadEditor} />}
  </main>;
}
