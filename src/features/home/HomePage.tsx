import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import heroImage from "../../../dist/assets/hero-winter-pine.jpg";
import { formatDepartureCountdown } from "./countdown";
import type { HomeRepository } from "./homeRepository";
import type { FactIcon, TravelFact, TripHome, WeatherState } from "./types";
import { loadCurrentWeather, weatherDescription } from "./weatherService";

const factIconOptions: Array<{ value: FactIcon; label: string }> = [
  { value: "info", label: "一般資訊" },
  { value: "globe", label: "地區／時差" },
  { value: "exchange", label: "匯率" },
  { value: "plug", label: "電力／插座" },
  { value: "water", label: "飲水" },
];

interface FactFormValue {
  id?: string;
  icon: FactIcon;
  title: string;
  content: string;
}

function createEmptyFact(): FactFormValue {
  return { icon: "info", title: "", content: "" };
}

export function HomePage({ repository, online }: { repository: HomeRepository; online: boolean }) {
  const [home, setHome] = useState<TripHome | null>(null);
  const [facts, setFacts] = useState<TravelFact[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formValue, setFormValue] = useState<FactFormValue | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherState>({ status: "idle" });
  const [now, setNow] = useState(() => new Date());
  const requestedWeather = useRef(false);

  useEffect(() => {
    let active = true;
    repository.getTripHome().then((data) => {
      if (!active) return;
      setHome(data);
      setFacts(data.facts);
    });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (requestedWeather.current || !online) return;
    requestedWeather.current = true;
    setWeather({ status: "loading" });
    loadCurrentWeather()
      .then((snapshot) => setWeather({ status: "ready", snapshot }))
      .catch((error: Error) => setWeather({ status: "error", message: error.message }));
  }, [online]);

  const countdownVisible = weather.status !== "ready" || weather.snapshot.countryCode === "TW" || weather.snapshot.countryCode === null;
  const countdown = useMemo(() => formatDepartureCountdown(now), [now]);

  if (!home) {
    return <main id="main" className="screen"><p className="loading-state">正在載入旅程首頁⋯</p></main>;
  }

  function startEditing() {
    if (!online) return;
    setFacts(structuredClone(home!.facts));
    setEditing(true);
    setMessage(null);
  }

  function cancelEditing() {
    setFacts(home!.facts);
    setEditing(false);
    setFormValue(null);
    setMessage(null);
  }

  async function saveFacts() {
    if (!facts.length || facts.some((fact) => !fact.title.trim() || !fact.content.trim())) {
      setMessage("每張小知識都需要標題與內容。 ");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const saved = await repository.saveTravelFacts(facts, home!.version);
      setHome(saved);
      setFacts(saved.facts);
      setEditing(false);
      setMessage("旅途小知識已儲存於這部裝置。 ");
    } catch (error) {
      setMessage(error instanceof Error && error.message === "VERSION_CONFLICT" ? "資料已更新，請重新載入後再試。 " : "目前無法儲存，請稍後再試。 ");
    } finally {
      setSaving(false);
    }
  }

  function submitFact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValue) return;
    const title = formValue.title.trim();
    const content = formValue.content.trim();
    if (!title || !content) return;

    if (formValue.id) {
      setFacts((current) => current.map((fact) => fact.id === formValue.id ? { ...fact, icon: formValue.icon, title, content } : fact));
    } else {
      setFacts((current) => [...current, { id: crypto.randomUUID(), icon: formValue.icon, title, content, sortOrder: current.length }]);
    }
    setFormValue(null);
  }

  function removeFact(id: string) {
    setFacts((current) => current.filter((fact) => fact.id !== id));
  }

  return (
    <>
    <main id="main" className="screen">
      <header className="page-heading"><div><p className="eyebrow">Trip overview</p><h1>旅程首頁</h1></div></header>
      <section className="home-grid">
        <article className="card hero-card">
          <img className="hero-illustration" src={heroImage} alt="" aria-hidden="true" />
          <div className="hero-veil" />
          <div className="hero-copy">
            <div className="hero-heading">
              <span className="trip-range">{home.dateLabel}・{home.durationLabel}</span>
              <h2 className="hero-title">{home.title}<small>{home.subtitle}</small></h2>
            </div>
            <div className="hero-details">
              <div className="hero-meta">
                {countdownVisible && <div className="hero-metric"><span>距離起飛</span><strong>{countdown}</strong></div>}
                <WeatherMetric state={weather} online={online} />
              </div>
              <p className="location-status"><Icon name="location" size={15} />{weatherStatus(weather, online)}</p>
            </div>
          </div>
        </article>
        <section className="card section-card" aria-labelledby="flights-title">
          <div className="section-head"><div><h2 id="flights-title">航班資訊</h2><p>各段時間依機場當地時區顯示</p></div><Icon name="plane" size={23} /></div>
          <div className="flight-list">
            {home.flights.map((flight) => (
              <article className="flight-row" key={flight.direction}>
                <span className="flight-direction"><Icon name="plane" size={20} /></span>
                <div>
                  <div className="flight-title"><strong>{flight.direction}</strong><span>總旅行時間 {flight.duration}</span></div>
                  <div className="flight-route">
                    {flight.legs.map((leg, index) => (
                      <div className="flight-segment" key={`${flight.direction}-${leg.airport}`}>
                        {index > 0 && <span className="flight-line" />}
                        <div className={`flight-airport ${index === 1 ? "flight-stop" : ""}`}>
                          <strong>{leg.airport}</strong>
                          <span>{leg.city}<br />{leg.time}{leg.dayOffset ? `（＋${leg.dayOffset} 日）` : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="card section-card" aria-labelledby="facts-title">
        <div className="section-head">
          <div><h2 id="facts-title">旅途小知識</h2>{editing && <p>編輯中的內容會在按下儲存後生效。</p>}</div>
          {!editing ? (
            <button className="text-button" type="button" onClick={startEditing} disabled={!online}><Icon name="edit" size={17} />編輯</button>
          ) : (
            <div className="section-actions"><button className="secondary-button" type="button" onClick={cancelEditing}>取消</button><button className="primary-button" type="button" onClick={saveFacts} disabled={saving}><Icon name="check" size={17} />{saving ? "儲存中" : "儲存"}</button></div>
          )}
        </div>
        {!online && <p className="inline-notice"><Icon name="info" size={16} />目前離線，旅途小知識僅供查看。</p>}
        {message && <p className="inline-notice" role="status">{message}</p>}
        <div className="fact-grid">
          {facts.map((fact) => (
            <article className="fact-card" key={fact.id}>
              <span className="fact-icon"><Icon name={fact.icon} size={22} /></span>
              <h3>{fact.title}</h3><p>{fact.content}</p>
              {editing && <div className="fact-actions"><button className="icon-button" type="button" onClick={() => setFormValue({ id: fact.id, icon: fact.icon, title: fact.title, content: fact.content })} aria-label={`編輯${fact.title}`}><Icon name="edit" size={16} /></button><button className="icon-button fact-delete" type="button" onClick={() => removeFact(fact.id)} aria-label={`移除${fact.title}`}><Icon name="trash" size={16} /></button></div>}
            </article>
          ))}
        </div>
        {editing && <button className="secondary-button add-fact-button" type="button" onClick={() => setFormValue(createEmptyFact())}><Icon name="plus" size={17} />新增小知識</button>}
      </section>

    </main>
    {formValue && <FactDialog value={formValue} onChange={setFormValue} onClose={() => setFormValue(null)} onSubmit={submitFact} />}
    </>
  );
}

function WeatherMetric({ state, online }: { state: WeatherState; online: boolean }) {
  if (!online) return <div className="hero-metric"><span>目前天氣</span><strong>離線無法更新</strong></div>;
  if (state.status === "ready") return <div className="hero-metric"><span>目前天氣</span><strong>{state.snapshot.placeLabel} {Math.round(state.snapshot.temperature)}°C・{weatherDescription(state.snapshot.weatherCode)}</strong></div>;
  if (state.status === "error") return <div className="hero-metric"><span>目前天氣</span><strong>暫時無法取得</strong></div>;
  return <div className="hero-metric"><span>目前天氣</span><strong>正在取得⋯</strong></div>;
}

function weatherStatus(state: WeatherState, online: boolean): string {
  if (!online) return "離線狀態；不會更新定位與天氣。";
  if (state.status === "ready") {
    const updated = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit" }).format(new Date(state.snapshot.updatedAt));
    return `天氣來源：${state.snapshot.source}・更新於 ${updated}`;
  }
  if (state.status === "error") return state.message;
  return "只會在進入首頁時取得一次目前位置，不會保存座標。";
}

function FactDialog({ value, onChange, onClose, onSubmit }: { value: FactFormValue; onChange: (value: FactFormValue) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="fact-dialog-title"><form className="dialog-form" onSubmit={onSubmit}><header className="dialog-head"><h2 id="fact-dialog-title">{value.id ? "編輯小知識" : "新增小知識"}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="關閉"><Icon name="close" size={20} /></button></header><div className="field-group"><label htmlFor="fact-icon">圖示</label><select className="field" id="fact-icon" value={value.icon} onChange={(event) => onChange({ ...value, icon: event.target.value as FactIcon })}>{factIconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="field-group"><label htmlFor="fact-title">標題</label><input className="field" id="fact-title" value={value.title} maxLength={40} required onChange={(event) => onChange({ ...value, title: event.target.value })} /></div><div className="field-group"><label htmlFor="fact-content">內容</label><textarea className="field" id="fact-content" value={value.content} maxLength={160} required onChange={(event) => onChange({ ...value, content: event.target.value })} /></div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">套用</button></div></form></section></div>;
}
