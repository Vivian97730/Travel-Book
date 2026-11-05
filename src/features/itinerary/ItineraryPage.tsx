import { useEffect, useMemo, useState } from "react";
import type { AccessTripSummary, ItineraryCategory, ItineraryItem, TripDay } from "@travel-book/contracts";
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
  const dates = useMemo(
    () => buildDateWindow(trip.startDate, trip.endDate, selectedDate),
    [selectedDate, trip.endDate, trip.startDate],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setViewingItem(null);
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

  return <>
    <ItineraryDayView
      day={day}
      dates={dates}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      onViewItem={setViewingItem}
    />
    {viewingItem && <ItineraryDialog item={viewingItem} onClose={() => setViewingItem(null)} />}
  </>;
}

export function ItineraryDayView({ day, dates, selectedDate, onSelectDate, onViewItem }: {
  day: TripDay;
  dates: readonly string[];
  selectedDate: string;
  onSelectDate(date: string): void;
  onViewItem(item: ItineraryItem): void;
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
        <div className="city-head"><div><p className="eyebrow">{day.date}・週{day.weekday}</p><h2 id="city-title">{day.city}</h2><p>{day.summary}</p></div></div>
        <div className="schedule-list" style={{ marginTop: "1.25rem" }}>
          {day.items.length ? day.items.map((item) => <article className="schedule-card" key={item.id}>
            <span className={`timeline-icon category-${item.category}`}><Icon name={categoryIcons[item.category]} size={21} /></span>
            <div className="timeline-copy"><strong>{item.title}</strong><p>{item.note}</p>{item.place && <small className="itinerary-place-name">{item.place.name}</small>}<a className="navigate-link" href={googleMapsSearchUrl(item.title)} target="_blank" rel="noreferrer"><Icon name="location" size={14} />導航</a></div>
            <button className="icon-button" type="button" onClick={() => onViewItem(item)} aria-label={`檢視${item.title}`}><Icon name="chevron" size={18} /></button>
          </article>) : <p className="empty-state">這一天尚未安排細項。</p>}
        </div>
      </section>
    </div>
  </main>;
}

function MapIllustration({ count }: { count: number }) {
  const markers = [[102, 424], [268, 262], [475, 147], [390, 350], [180, 120]].slice(0, count);
  return <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="600" height="520" fill="#dce7dc" /><g fill="none" stroke="#fffdf8" strokeWidth="18"><path d="M-40 108c120 40 178-48 287-17s182 18 383-49" /><path d="M40 502c48-124 110-158 209-196s170-97 202-330" /><path d="M-30 355c105-45 197-36 281 13s176 54 390 13" /></g><g fill="none" stroke="#c5d5c6" strokeWidth="5"><path d="M20 228c164 26 238-42 348-35s160 41 254 8" /><path d="M128-20c19 120 90 188 78 291s-5 159 35 269" /></g><path d="M102 424c34-93 137-59 166-162s92-128 207-115" fill="none" stroke="#e9785d" strokeWidth="7" strokeLinecap="round" strokeDasharray="10 13" />{markers.map(([x, y], index) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}><circle r="19" fill="#274e43" /><text textAnchor="middle" y="6" fill="white" fontFamily="sans-serif" fontSize="16" fontWeight="700">{index + 1}</text></g>)}</svg>;
}

function ItineraryDialog({ item, onClose }: { item: ItineraryItem; onClose(): void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-dialog-title"><div className="dialog-form"><header className="dialog-head"><h2 id="itinerary-dialog-title">{item.title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="關閉"><Icon name="close" size={20} /></button></header><section className="itinerary-detail"><p>{item.note}</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>關閉</button><a className="primary-button" href={googleMapsSearchUrl(item.title)} target="_blank" rel="noreferrer"><Icon name="location" size={17} />導航</a></div></section></div></section></div>;
}
