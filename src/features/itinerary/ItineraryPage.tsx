import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { AccessTripSummary, ItineraryCategory, ItineraryItem, SaveTripDayItem, TripDay } from "@travel-book/contracts";
import { Icon, type IconName } from "../../components/Icon";
import { buildDateWindow, chooseDefaultDate } from "./dateWindow";
import type { ItineraryRepository } from "./itineraryRepository";

const categoryIcons: Record<ItineraryCategory, IconName> = {
  food: "food",
  stay: "bed",
  transit: "train",
  sight: "sight",
  shopping: "shop",
};

export function googleMapsSearchUrl(name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

function dateInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function weekdayFor(date: string): string {
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function ItineraryPage({ repository, trip }: { repository: ItineraryRepository; trip: AccessTripSummary }) {
  const defaultDate = useMemo(
    () => chooseDefaultDate(dateInTimezone(trip.displayTimezone), trip.startDate, trip.endDate),
    [trip.displayTimezone, trip.endDate, trip.startDate],
  );
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [day, setDay] = useState<TripDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<ItineraryItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ItineraryItem[]>([]);
  const [formItem, setFormItem] = useState<ItineraryItem | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dates = useMemo(
    () => buildDateWindow(trip.startDate, trip.endDate, selectedDate),
    [selectedDate, trip.endDate, trip.startDate],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setViewingItem(null);
    setEditing(false);
    setDraftItems([]);
    setFormItem(undefined);
    setSaveError(null);
    repository.getDay(selectedDate).then((result) => {
      if (active) setDay(result);
    }).catch(() => {
      if (active) {
        setDay(null);
        setError("目前無法載入這一天的行程，請稍後再試。");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [repository, selectedDate]);

  if (loading && !day) return <main id="main" className="screen"><p className="loading-state">正在載入每日行程⋯</p></main>;
  if (!day || error) return <main id="main" className="screen"><section className="card section-card empty-development"><h1>每日行程</h1><p role="alert">{error}</p></section></main>;

  const visibleDay = editing ? { ...day, items: draftItems } : day;

  function beginEditing() {
    setDraftItems(structuredClone(day!.items));
    setEditing(true);
    setSaveError(null);
  }

  async function finishEditing() {
    setSaving(true);
    setSaveError(null);
    const items: SaveTripDayItem[] = draftItems.map(({ id, title, note, category }, sortOrder) => ({
      id,
      title,
      note,
      category,
      sortOrder,
    }));
    try {
      const saved = await repository.saveDayItems(day!.date, items, day!.version);
      setDay(saved);
      setDraftItems([]);
      setEditing(false);
    } catch {
      setSaveError("目前無法保存行程，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  function saveDraftItem(value: Pick<ItineraryItem, "title" | "note" | "category">) {
    setDraftItems((current) => {
      if (formItem) {
        return current.map((item) => item.id === formItem.id ? { ...item, ...value } : item);
      }
      return [...current, {
        id: crypto.randomUUID(),
        ...value,
        sortOrder: current.length,
        place: null,
      }];
    });
    setFormItem(undefined);
  }

  function deleteDraftItem(id: string) {
    setDraftItems((current) => current
      .filter((item) => item.id !== id)
      .map((item, sortOrder) => ({ ...item, sortOrder })));
  }

  function reorderDraftItem(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setDraftItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((item, sortOrder) => ({ ...item, sortOrder }));
    });
  }

  return <>
    <ItineraryDayView
      day={visibleDay}
      dates={dates}
      selectedDate={selectedDate}
      editing={editing}
      saving={saving}
      onSelectDate={setSelectedDate}
      onViewItem={setViewingItem}
      onToggleEditing={editing ? finishEditing : beginEditing}
      onAddItem={() => setFormItem(null)}
      onEditItem={setFormItem}
      onDeleteItem={deleteDraftItem}
      onReorderItem={reorderDraftItem}
    />
    {saveError && <p className="itinerary-save-error" role="alert">{saveError}</p>}
    {viewingItem && <ItineraryDialog item={viewingItem} onClose={() => setViewingItem(null)} />}
    {formItem !== undefined && <ItineraryItemFormDialog item={formItem} onCancel={() => setFormItem(undefined)} onSubmit={saveDraftItem} />}
  </>;
}

export function ItineraryDayView({
  day,
  dates,
  selectedDate,
  editing = false,
  saving = false,
  onSelectDate,
  onViewItem,
  onToggleEditing = () => undefined,
  onAddItem = () => undefined,
  onEditItem = () => undefined,
  onDeleteItem = () => undefined,
  onReorderItem = () => undefined,
}: {
  day: TripDay;
  dates: readonly string[];
  selectedDate: string;
  editing?: boolean;
  saving?: boolean;
  onSelectDate(date: string): void;
  onViewItem(item: ItineraryItem): void;
  onToggleEditing?(): void;
  onAddItem?(): void;
  onEditItem?(item: ItineraryItem): void;
  onDeleteItem?(id: string): void;
  onReorderItem?(sourceId: string, targetId: string): void;
}) {
  const mappedItems = day.items.filter((item) => item.place !== null && item.place.latitude !== null && item.place.longitude !== null);
  return <main id="main" className="screen">
    <header className="page-heading"><div><p className="eyebrow">Daily plan</p><h1>每日行程</h1></div></header>
    <section className="date-strip" aria-label="選擇日期">
      {dates.map((date) => <button className="date-button" type="button" key={date} onClick={() => onSelectDate(date)} aria-pressed={date === selectedDate}><span>週{weekdayFor(date)}</span><strong>{date.slice(5).replace("-", "/")}</strong></button>)}
    </section>
    <div className="itinerary-grid">
      <section className="card map-card" data-map-provider="openstreetmap" data-map-points={mappedItems.map((item) => item.place!.name).join("|")} aria-label={`OpenStreetMap 每日地點地圖，${mappedItems.length} 個有座標地點`}>
        <MapIllustration count={mappedItems.length} />
        <span className="map-label">{day.city}・{mappedItems.length} 個地點</span>
        <a className="primary-button map-action" href={googleMapsSearchUrl(day.city)} target="_blank" rel="noreferrer"><Icon name="map" size={18} />開啟 Google Maps</a>
      </section>
      <section className="card section-card" aria-labelledby="city-title">
        <div className="city-head"><div><p className="eyebrow">{day.date}・週{day.weekday}</p><h2 id="city-title">{day.city}</h2><p>{editing ? "編輯模式：可新增、修改、刪除或拖曳排序。" : day.summary}</p></div><button className="icon-button" type="button" onClick={onToggleEditing} disabled={saving} aria-label={editing ? "完成行程編輯" : "編輯城市與行程"} aria-pressed={editing}><Icon name={editing ? "check" : "edit"} size={19} /></button></div>
        <div className="schedule-list" style={{ marginTop: "1.25rem" }}>
          {day.items.length ? day.items.map((item, index) => <article className={`schedule-card ${editing ? "is-editing" : ""}`} data-itinerary-card={item.id} key={item.id}>
            <span className={`timeline-icon category-${item.category}`}><Icon name={categoryIcons[item.category]} size={21} /></span>
            <div className="timeline-copy"><strong>{item.title}</strong><p>{item.note}</p>{item.place && <small className="itinerary-place-name">{item.place.name}</small>}<a className="navigate-link" href={googleMapsSearchUrl(item.title)} target="_blank" rel="noreferrer"><Icon name="location" size={14} />導航</a></div>
            {editing ? <div className="schedule-controls"><DragHandle item={item} previousItem={day.items[index - 1]} nextItem={day.items[index + 1]} onReorder={onReorderItem} /><button className="icon-button" type="button" onClick={() => onEditItem(item)} aria-label={`修改${item.title}`}><Icon name="edit" size={17} /></button><button className="icon-button danger-icon" type="button" onClick={() => onDeleteItem(item.id)} aria-label={`刪除${item.title}`}><Icon name="trash" size={17} /></button></div> : <button className="icon-button" type="button" onClick={() => onViewItem(item)} aria-label={`檢視${item.title}`}><Icon name="chevron" size={18} /></button>}
          </article>) : <p className="empty-state">這一天尚未安排細項。</p>}
        </div>
        {editing && <button className="secondary-button add-itinerary-button" type="button" onClick={onAddItem}><Icon name="plus" size={17} />新增行程</button>}
      </section>
    </div>
  </main>;
}

function DragHandle({ item, previousItem, nextItem, onReorder }: {
  item: ItineraryItem;
  previousItem?: ItineraryItem;
  nextItem?: ItineraryItem;
  onReorder(sourceId: string, targetId: string): void;
}) {
  const startY = useRef(0);
  const targetId = useRef(item.id);

  function finish(event: ReactPointerEvent<HTMLSpanElement>) {
    const handle = event.currentTarget;
    if (!handle.hasPointerCapture(event.pointerId)) return;
    handle.releasePointerCapture(event.pointerId);
    const card = handle.closest<HTMLElement>(".schedule-card");
    card?.classList.remove("is-dragging", "is-touch-dragging");
    card?.style.removeProperty("--drag-offset-y");
    document.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
    onReorder(item.id, targetId.current);
  }

  return <span
    className="drag-handle"
    role="button"
    tabIndex={0}
    aria-label={`拖曳${item.title}`}
    onKeyDown={(event) => {
      if (event.key === "ArrowUp" && previousItem) onReorder(item.id, previousItem.id);
      if (event.key === "ArrowDown" && nextItem) onReorder(item.id, nextItem.id);
    }}
    onPointerDown={(event) => {
      startY.current = event.clientY;
      targetId.current = item.id;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.closest(".schedule-card")?.classList.add("is-dragging", "is-touch-dragging");
    }}
    onPointerMove={(event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const deltaY = event.clientY - startY.current;
      event.currentTarget.closest<HTMLElement>(".schedule-card")?.style.setProperty("--drag-offset-y", `${deltaY}px`);
      if (Math.abs(deltaY) < 20) return;
      const candidates = [...document.querySelectorAll<HTMLElement>("[data-itinerary-card]")]
        .filter((element) => element.dataset.itineraryCard !== item.id)
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .sort((a, b) => Math.abs(event.clientY - (a.rect.top + a.rect.height / 2)) - Math.abs(event.clientY - (b.rect.top + b.rect.height / 2)));
      document.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
      if (candidates[0]) {
        targetId.current = candidates[0].element.dataset.itineraryCard ?? item.id;
        candidates[0].element.classList.add("is-drop-target");
      }
    }}
    onPointerUp={finish}
    onPointerCancel={(event) => {
      const card = event.currentTarget.closest<HTMLElement>(".schedule-card");
      card?.classList.remove("is-dragging", "is-touch-dragging");
      card?.style.removeProperty("--drag-offset-y");
      document.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
    }}
  ><Icon name="grip" size={20} /></span>;
}

function MapIllustration({ count }: { count: number }) {
  const markers = [[102, 424], [268, 262], [475, 147], [390, 350], [180, 120]].slice(0, count);
  return <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="600" height="520" fill="#dce7dc" /><g fill="none" stroke="#fffdf8" strokeWidth="18"><path d="M-40 108c120 40 178-48 287-17s182 18 383-49" /><path d="M40 502c48-124 110-158 209-196s170-97 202-330" /><path d="M-30 355c105-45 197-36 281 13s176 54 390 13" /></g><g fill="none" stroke="#c5d5c6" strokeWidth="5"><path d="M20 228c164 26 238-42 348-35s160 41 254 8" /><path d="M128-20c19 120 90 188 78 291s-5 159 35 269" /></g><path d="M102 424c34-93 137-59 166-162s92-128 207-115" fill="none" stroke="#e9785d" strokeWidth="7" strokeLinecap="round" strokeDasharray="10 13" />{markers.map(([x, y], index) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}><circle r="19" fill="#274e43" /><text textAnchor="middle" y="6" fill="white" fontFamily="sans-serif" fontSize="16" fontWeight="700">{index + 1}</text></g>)}</svg>;
}

function ItineraryDialog({ item, onClose }: { item: ItineraryItem; onClose(): void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-dialog-title"><div className="dialog-form"><header className="dialog-head"><h2 id="itinerary-dialog-title">{item.title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="關閉"><Icon name="close" size={20} /></button></header><section className="itinerary-detail"><p>{item.note}</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>關閉</button><a className="primary-button" href={googleMapsSearchUrl(item.title)} target="_blank" rel="noreferrer"><Icon name="location" size={17} />導航</a></div></section></div></section></div>;
}

export function ItineraryItemFormDialog({ item, onCancel, onSubmit }: {
  item: ItineraryItem | null;
  onCancel(): void;
  onSubmit(value: Pick<ItineraryItem, "title" | "note" | "category">): void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      title: String(data.get("title")).trim(),
      note: String(data.get("note")).trim(),
      category: String(data.get("category")) as ItineraryCategory,
    });
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-edit-title"><form className="dialog-form" onSubmit={submit}><header className="dialog-head"><h2 id="itinerary-edit-title">{item ? "修改行程" : "新增行程"}</h2><button className="icon-button" type="button" onClick={onCancel} aria-label="關閉"><Icon name="close" size={20} /></button></header><div className="field-group"><label htmlFor="itinerary-title">行程名稱</label><input className="field" id="itinerary-title" name="title" required maxLength={80} defaultValue={item?.title ?? ""} autoFocus /></div><div className="field-group"><label htmlFor="itinerary-note">內容</label><textarea className="field" id="itinerary-note" name="note" required maxLength={300} defaultValue={item?.note ?? ""} /></div><div className="field-group"><label htmlFor="itinerary-category">類別</label><select className="field" id="itinerary-category" name="category" defaultValue={item?.category ?? "transit"}><option value="transit">交通</option><option value="sight">景點</option><option value="food">食物</option><option value="stay">住宿</option><option value="shopping">逛街</option></select></div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onCancel}>取消</button><button className="primary-button" type="submit">儲存</button></div></form></section></div>;
}
