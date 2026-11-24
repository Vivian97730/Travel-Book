import { useEffect, useRef, useState } from "react";
import type { ItineraryPlace, PlaceSearchCandidate } from "@travel-book/contracts";

export function PlaceSearchField({ initialQuery, city, place, search, onSelect }: {
  initialQuery: string; city: string; place: ItineraryPlace | null;
  search(query: string, city: string): Promise<PlaceSearchCandidate[]>;
  onSelect(place: ItineraryPlace | null): void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [searchCity, setSearchCity] = useState(city);
  const [results, setResults] = useState<PlaceSearchCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);

  function changed() {
    revision.current++;
    setResults(null);
    setBusy(false);
    setError(null);
  }
  async function runSearch() {
    const current = ++revision.current;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const candidates = await search(query.trim(), searchCity.trim());
      if (current === revision.current) setResults(candidates);
    } catch (caught) {
      if (current === revision.current) setError(caught instanceof Error && "code" in caught && caught.code === "RATE_LIMITED"
        ? "搜尋忙碌中，請稍後再試。仍可先儲存行程。"
        : "地點搜尋暫時無法使用，仍可先儲存行程，之後再補選地點。");
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }
  return <fieldset className="itinerary-place-search">
    <legend>地點（選填）</legend>
    <p className="place-search-help" id="place-search-help">搜尋公開地點並選取正確地址，小地圖會自動標記。只會將地點名稱與城市傳送至地理編碼服務，請勿輸入私人資料。</p>
    <div className="field-group"><label htmlFor="place-query">地點名稱</label><input className="field" id="place-query" value={query} maxLength={120} aria-describedby="place-search-help" onChange={(e) => { changed(); setQuery(e.target.value); }} /></div>
    <div className="field-group"><label htmlFor="place-city">搜尋城市</label><input className="field" id="place-city" value={searchCity} maxLength={80} onChange={(e) => { changed(); setSearchCity(e.target.value); }} /></div>
    <button type="button" className="secondary-button" disabled={busy || query.trim().length < 2 || !searchCity.trim()} onClick={runSearch}>{busy ? "搜尋中⋯" : "搜尋地點"}</button>
    {busy && <p role="status">正在搜尋地點⋯</p>}
    {error && <p role="alert">{error}</p>}
    {results && <div className="place-search-results" aria-label="地點搜尋結果">
      <p role="status">{results.length ? "請核對地址後選取地點。" : "找不到地點，請調整名稱或城市；也可以先儲存行程。"}</p>
      {results.map((candidate) => <button key={candidate.id} type="button" className="place-search-result" aria-pressed={place?.id === candidate.id} onClick={() => onSelect({ id: candidate.id, name: candidate.name, latitude: candidate.latitude, longitude: candidate.longitude })}>
        <strong>{candidate.name}</strong><span>{candidate.address}</span>
      </button>)}
    </div>}
    <div className="place-search-selection" aria-live="polite">
      <p>{place ? `已選地點：${place.name}` : "尚未選取地點，儲存後不會新增地圖標記。"}</p>
      {place && <button className="secondary-button" type="button" onClick={() => onSelect(null)}>移除地點</button>}
    </div>
    <a className="place-search-help" href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>
    <a className="place-search-help" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">搜尋圖資 © OpenStreetMap contributors</a>
  </fieldset>;
}
