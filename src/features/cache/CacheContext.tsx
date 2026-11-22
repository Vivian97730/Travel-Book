import { createContext, useContext, useRef, useState, useSyncExternalStore } from "react";
import type { ResourceCache } from "./resourceCache";
export const CacheContext = createContext<ResourceCache | null>(null);
const noop = () => () => {};
const zero = () => 0;
/** Keep editor state untouched; apply background changes after the editor closes. */
export function useCacheRevision(blocked = false) {
  const cache = useContext(CacheContext);
  const revision = useSyncExternalStore(cache?.subscribe ?? noop, cache ? () => cache.revision : zero, zero);
  const applied = useRef(revision);
  if (!blocked) applied.current = revision;
  return applied.current;
}
export function CacheControls({ online, blocked }: { online: boolean; blocked: boolean }) {
  const cache = useContext(CacheContext);
  useCacheRevision();
  const [refreshing, setRefreshing] = useState(false);
  if (!cache) return null;
  return <div className="cache-controls"><button className="secondary-button" type="button" disabled={!online || blocked || refreshing}
    onClick={() => { setRefreshing(true); void cache.refresh().finally(() => setRefreshing(false)); }}>{refreshing ? "更新中…" : "重新整理"}</button>{cache.notice && <span role="status">{blocked && cache.notice === "資料已更新。" ? "已取得更新，完成編輯後顯示。" : cache.notice}</span>}</div>;
}
