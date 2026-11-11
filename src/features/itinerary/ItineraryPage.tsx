import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { AccessTripSummary, ItineraryCategory, ItineraryItem, SaveTripDayItem, Stay, TripDay } from "@travel-book/contracts";
import { Icon, type IconName } from "../../components/Icon";
import { buildDateWindow, chooseDefaultDate } from "./dateWindow";
import { ItineraryMap, type ItineraryMapLocation } from "./ItineraryMap";
import type { StaysRepository } from "../stays/staysRepository";
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

export interface ItinerarySaveFailure {
  kind: "conflict" | "retry";
  message: string;
  actionLabel: "重新載入" | "重試保存";
}

export function itinerarySaveFailureFor(error: unknown): ItinerarySaveFailure {
  const code = typeof error === "object" && error !== null && "code" in error
    ? error.code
    : error instanceof Error
      ? error.message
      : null;
  return code === "VERSION_CONFLICT"
    ? {
        kind: "conflict",
        message: "資料已由其他裝置更新，草稿仍保留；請重新載入最新行程。",
        actionLabel: "重新載入",
      }
    : {
        kind: "retry",
        message: "目前無法保存行程，草稿仍保留；請稍後重試。",
        actionLabel: "重試保存",
      };
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

export function ItineraryPage({ repository, trip, staysRepository, online = true }: { repository: ItineraryRepository; trip: AccessTripSummary; staysRepository?: StaysRepository | null; online?: boolean }) {
  const defaultDate = useMemo(
    () => chooseDefaultDate(dateInTimezone(trip.displayTimezone), trip.startDate, trip.endDate),
    [trip.displayTimezone, trip.endDate, trip.startDate],
  );
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [stays, setStays] = useState<Stay[]>([]);
  const [day, setDay] = useState<TripDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<ItineraryItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ItineraryItem[]>([]);
  const [formItem, setFormItem] = useState<ItineraryItem | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<ItinerarySaveFailure | null>(null);
  const dates = useMemo(
    () => buildDateWindow(trip.startDate, trip.endDate),
    [trip.endDate, trip.startDate],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setViewingItem(null);
    setEditing(false);
    setDraftItems([]);
    setFormItem(undefined);
    setSaveFailure(null);
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

  useEffect(() => {
    if (!staysRepository) return;
    let active = true;
    staysRepository.getStays().then((result) => {
      if (active) setStays(result);
    }).catch(() => {
      if (active) setStays([]);
    });
    return () => { active = false; };
  }, [staysRepository, online]);

  if (loading && !day) return <main id="main" className="screen"><p className="loading-state">正在載入每日行程⋯</p></main>;
  if (!day || error) return <main id="main" className="screen"><section className="card section-card empty-development"><h1>每日行程</h1><p role="alert">{error}</p></section></main>;

  const visibleDay = editing ? { ...day, items: draftItems } : day;

  function beginEditing() {
    setDraftItems(structuredClone(day!.items));
    setEditing(true);
    setSaveFailure(null);
  }

  async function finishEditing() {
    setSaving(true);
    setSaveFailure(null);
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
    } catch (caught) {
      setSaveFailure(itinerarySaveFailureFor(caught));
    } finally {
      setSaving(false);
    }
  }

  async function reloadAfterConflict() {
    setSaving(true);
    try {
      const refreshed = await repository.getDay(day!.date);
      setDay(refreshed);
      setDraftItems([]);
      setEditing(false);
      setSaveFailure(null);
    } catch {
      setSaveFailure({
        kind: "conflict",
        message: "目前無法重新載入最新行程，草稿仍保留；請稍後再試。",
        actionLabel: "重新載入",
      });
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
      stays={stays}
      dates={dates}
      selectedDate={selectedDate}
      online={online}
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
    {saveFailure && <ItinerarySaveRecovery
      failure={saveFailure}
      busy={saving}
      onRecover={saveFailure.kind === "conflict" ? reloadAfterConflict : finishEditing}
    />}
    {viewingItem && <ItineraryDialog item={viewingItem} onClose={() => setViewingItem(null)} />}
    {formItem !== undefined && <ItineraryItemFormDialog item={formItem} onCancel={() => setFormItem(undefined)} onSubmit={saveDraftItem} />}
  </>;
}

export function ItinerarySaveRecovery({ failure, busy, onRecover }: {
  failure: ItinerarySaveFailure;
  busy: boolean;
  onRecover(): void;
}) {
  return <section className="itinerary-save-error" aria-label="行程保存狀態">
    <p role="alert">{failure.message}</p>
    <button className="secondary-button" type="button" disabled={busy} onClick={onRecover}>
      {failure.actionLabel}
    </button>
  </section>;
}

export function ItineraryDayView({
  day,
  stays = [],
  dates,
  selectedDate,
  online = true,
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
  stays?: readonly Stay[];
  dates: readonly string[];
  selectedDate: string;
  online?: boolean;
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
  const canEdit = editing && online;
  const dailyStays = stays.filter((stay) => stay.startDate <= day.date && day.date < stay.endDate);
  const mappedItems: ItineraryMapLocation[] = day.items.flatMap((item, index) => {
    if (item.place === null || item.place.latitude === null || item.place.longitude === null) return [];
    return [{
      id: item.place.id,
      name: item.place.name,
      latitude: item.place.latitude,
      longitude: item.place.longitude,
      order: index + 1,
    }];
  });
  return <main id="main" className="screen">
    <header className="page-heading"><div><p className="eyebrow">Daily plan</p><h1>每日行程</h1></div></header>
    <section className="date-strip" aria-label="選擇日期">
      {dates.map((date) => <button className="date-button" type="button" key={date} onClick={() => onSelectDate(date)} disabled={!online} aria-pressed={date === selectedDate}><span>週{weekdayFor(date)}</span><strong>{date.slice(5).replace("-", "/")}</strong></button>)}
    </section>
    <div className="itinerary-grid">
      <section className="card map-card" data-map-provider="openstreetmap" data-map-points={mappedItems.map((item) => item.name).join("|")} aria-label={`OpenStreetMap 每日地點地圖，${mappedItems.length} 個有座標地點`}>
        <ItineraryMap key={day.date} city={day.city} locations={mappedItems} online={online} />
        <span className="map-label">{day.city}・{mappedItems.length} 個地點</span>
        <a className="primary-button map-action" href={googleMapsSearchUrl(day.city)} target="_blank" rel="noreferrer"><Icon name="map" size={18} />開啟 Google Maps</a>
      </section>
      <section className="card section-card" aria-labelledby="city-title">
        <div className="city-head"><div><p className="eyebrow">{day.date}・週{day.weekday}</p><h2 id="city-title">{day.city}</h2><p>{editing ? (online ? "編輯模式：可新增、修改、刪除或拖曳排序。" : "離線唯讀：草稿已保留，連線後可繼續編輯。") : day.summary}</p></div><button className="icon-button" type="button" onClick={onToggleEditing} disabled={saving || !online} aria-label={editing ? "完成行程編輯" : "編輯城市與行程"} aria-pressed={editing}><Icon name={editing ? "check" : "edit"} size={19} /></button></div>
        <div className="schedule-list" style={{ marginTop: "1.25rem" }}>
          {day.items.map((item, index) => <article className={`schedule-card ${canEdit ? "is-editing" : ""}`} data-itinerary-card={item.id} key={item.id}>
            <span className={`timeline-icon category-${item.category}`}><Icon name={categoryIcons[item.category]} size={21} /></span>
            <div className="timeline-copy"><strong>{item.title}</strong><p>{item.note}</p>{item.place && <small className="itinerary-place-name">{item.place.name}</small>}<a className="navigate-link" href={googleMapsSearchUrl(item.title)} target="_blank" rel="noreferrer"><Icon name="location" size={14} />導航</a></div>
            {canEdit ? <div className="schedule-controls"><DragHandle item={item} previousItem={day.items[index - 1]} nextItem={day.items[index + 1]} onReorder={onReorderItem} /><button className="icon-button" type="button" onClick={() => onEditItem(item)} aria-label={`修改${item.title}`}><Icon name="edit" size={17} /></button><button className="icon-button danger-icon" type="button" onClick={() => onDeleteItem(item.id)} aria-label={`刪除${item.title}`}><Icon name="trash" size={17} /></button></div> : <button className="icon-button" type="button" onClick={() => onViewItem(item)} aria-label={`檢視${item.title}`}><Icon name="chevron" size={18} /></button>}
          </article>)}
          {dailyStays.map((stay) => <article className="schedule-card" key={stay.id}>
            <span className="timeline-icon category-stay"><Icon name="bed" size={21} /></span>
            <div className="timeline-copy">
              <strong>{stay.name}</strong>
              <p>{stay.address}</p>
              <small className="itinerary-place-name">
                {day.date === stay.startDate ? `Check-in ${stay.checkin} 後` : "住宿"}
              </small>
              <a className="navigate-link" href={googleMapsSearchUrl(stay.name)} target="_blank" rel="noreferrer"><Icon name="location" size={14} />導航</a>
            </div>
          </article>)}
          {!day.items.length && !dailyStays.length && <p className="empty-state">這一天尚未安排細項。</p>}
        </div>
        {canEdit && <button className="secondary-button add-itinerary-button" type="button" onClick={onAddItem}><Icon name="plus" size={17} />新增行程</button>}
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

function useDialogAccessibility(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = "button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])";
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

    if (!dialog.contains(document.activeElement)) {
      (dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ?? focusable()[0])?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!dialog?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return dialogRef;
}

function ItineraryDialog({ item, onClose }: { item: ItineraryItem; onClose(): void }) {
  const dialogRef = useDialogAccessibility(onClose);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-dialog-title"><div className="dialog-form"><header className="dialog-head"><h2 id="itinerary-dialog-title">{item.title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="關閉"><Icon name="close" size={20} /></button></header><section className="itinerary-detail"><p>{item.note}</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>關閉</button><a className="primary-button" href={googleMapsSearchUrl(item.title)} target="_blank" rel="noreferrer"><Icon name="location" size={17} />導航</a></div></section></div></section></div>;
}

export function ItineraryItemFormDialog({ item, onCancel, onSubmit }: {
  item: ItineraryItem | null;
  onCancel(): void;
  onSubmit(value: Pick<ItineraryItem, "title" | "note" | "category">): void;
}) {
  const dialogRef = useDialogAccessibility(onCancel);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      title: String(data.get("title")).trim(),
      note: String(data.get("note")).trim(),
      category: String(data.get("category")) as ItineraryCategory,
    });
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section ref={dialogRef} className="dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-edit-title"><form className="dialog-form" onSubmit={submit}><header className="dialog-head"><h2 id="itinerary-edit-title">{item ? "修改行程" : "新增行程"}</h2><button className="icon-button" type="button" onClick={onCancel} aria-label="關閉"><Icon name="close" size={20} /></button></header><div className="field-group"><label htmlFor="itinerary-title">行程名稱</label><input className="field" id="itinerary-title" name="title" required maxLength={80} defaultValue={item?.title ?? ""} data-dialog-initial-focus /></div><div className="field-group"><label htmlFor="itinerary-note">內容</label><textarea className="field" id="itinerary-note" name="note" required maxLength={300} defaultValue={item?.note ?? ""} /></div><div className="field-group"><label htmlFor="itinerary-category">類別</label><select className="field itinerary-category-field" id="itinerary-category" name="category" defaultValue={item?.category ?? "transit"}><option value="transit">交通</option><option value="sight">景點</option><option value="food">食物</option><option value="stay">住宿</option><option value="shopping">逛街</option></select></div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onCancel}>取消</button><button className="primary-button" type="submit">儲存</button></div></form></section></div>;
}
