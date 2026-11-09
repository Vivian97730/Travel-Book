import { useEffect, useMemo, useState } from "react";
import { captureAccessToken, createAccessTokenStore } from "./app/accessSession";
import { hashForRoute, parseAppHash, type Route } from "./app/routing";
import { Icon, type IconName } from "./components/Icon";
import { ApiHomeRepository } from "./features/home/apiHomeRepository";
import { HomePage } from "./features/home/HomePage";
import { SnapshotHomeRepository } from "./features/home/snapshotHomeRepository";
import { ApiItineraryRepository } from "./features/itinerary/apiItineraryRepository";
import { ItineraryPage } from "./features/itinerary/ItineraryPage";
import {
  deleteHomeSnapshotForToken,
  getHomeSnapshotForToken,
} from "./features/offline/homeSnapshotRepository";
import { IndexedDbHomeSnapshotRepository } from "./features/offline/indexedDbHomeSnapshotRepository";
import { ApiClient, ApiClientError } from "./shared/api/apiClient";
import { ApiStaysRepository } from "./features/stays/apiStaysRepository";
import { StaysPage } from "./features/stays/StaysPage";
import type { AccessVerifyResponse } from "@travel-book/contracts";

const routeItems = [
  ["home", "home", "首頁"],
  ["itinerary", "calendar", "行程"],
  ["stays", "bed", "住宿"],
  ["expenses", "wallet", "記帳"],
  ["lists", "list", "清單"],
] as const satisfies ReadonlyArray<readonly [Route, IconName, string]>;

export type AccessState = "checking" | "ready" | "missing" | "denied" | "offline" | "unconfigured" | "error";

export function shouldRenderVerifiedApp(state: AccessState, hasVerifiedAccess: boolean): boolean {
  return hasVerifiedAccess && (state === "ready" || state === "offline" || state === "checking");
}

function routeFromCurrentHash(): Route {
  const parsed = parseAppHash(window.location.hash);
  return parsed.kind === "route" ? parsed.route : "itinerary";
}

export default function App() {
  const accessStore = useMemo(() => createAccessTokenStore(window.localStorage), []);
  const [accessToken, setAccessToken] = useState<string | null>(() => captureAccessToken({
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search,
    store: accessStore,
    replaceUrl: (url) => window.history.replaceState(null, "", url),
  }) ?? accessStore.get());
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [verifiedAccess, setVerifiedAccess] = useState<AccessVerifyResponse | null>(null);
  const [route, setRoute] = useState<Route>(routeFromCurrentHash);
  const [online, setOnline] = useState(navigator.onLine);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const staysRepository = useMemo(
    () => apiBaseUrl && accessToken ? new ApiStaysRepository(apiBaseUrl, accessToken) : null,
    [apiBaseUrl, accessToken],
  );
  const homeSnapshots = useMemo(() => new IndexedDbHomeSnapshotRepository(), []);
  const homeRepository = useMemo(
    () => apiBaseUrl && accessToken && verifiedAccess
      ? new SnapshotHomeRepository(
          new ApiHomeRepository(apiBaseUrl, accessToken),
          homeSnapshots,
          accessToken,
          verifiedAccess,
          () => online,
        )
      : null,
    [accessToken, apiBaseUrl, homeSnapshots, online, verifiedAccess],
  );
  const itineraryRepository = useMemo(
    () => apiBaseUrl && accessToken ? new ApiItineraryRepository(apiBaseUrl, accessToken) : null,
    [accessToken, apiBaseUrl],
  );

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      setAccessState((current) => current === "denied" ? current : "missing");
      return () => { active = false; };
    }
    if (!apiBaseUrl) {
      setAccessState("unconfigured");
      return () => { active = false; };
    }
    if (!online) {
      setAccessState("checking");
      getHomeSnapshotForToken(homeSnapshots, accessToken)
        .then((snapshot) => {
          if (!active) return;
          setVerifiedAccess(snapshot?.access ?? null);
          setAccessState("offline");
        })
        .catch(() => {
          if (!active) return;
          setVerifiedAccess(null);
          setAccessState("offline");
        });
      return () => { active = false; };
    }

    setAccessState("checking");
    new ApiClient(apiBaseUrl).verifyAccess(accessToken).then((verified) => {
      if (active) {
        setVerifiedAccess(verified);
        setAccessState("ready");
      }
    }).catch(async (error: unknown) => {
      if (!active) return;
      if (error instanceof ApiClientError && error.code === "ACCESS_DENIED") {
        await deleteHomeSnapshotForToken(homeSnapshots, accessToken).catch(() => undefined);
        if (!active) return;
        accessStore.clear();
        setAccessToken(null);
        setVerifiedAccess(null);
        setAccessState("denied");
      } else {
        setAccessState("error");
      }
    });
    return () => { active = false; };
  }, [accessStore, accessToken, apiBaseUrl, homeSnapshots, online]);

  useEffect(() => {
    const updateRoute = () => {
      const captured = captureAccessToken({
        hash: window.location.hash,
        pathname: window.location.pathname,
        search: window.location.search,
        store: accessStore,
        replaceUrl: (url) => window.history.replaceState(null, "", url),
      });
      if (captured) {
        setAccessToken(captured);
        setVerifiedAccess(null);
        setRoute("itinerary");
      } else {
        setRoute(routeFromCurrentHash());
      }
    };
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [accessStore]);

  function navigate(next: Route) {
    window.location.hash = hashForRoute(next);
  }

  if (!verifiedAccess || !homeRepository || !itineraryRepository || !shouldRenderVerifiedApp(accessState, true)) {
    return <AccessStatus state={accessState} online={online} />;
  }

  return <div className="app-shell">
    <header className="topbar"><button className="brand brand-button" type="button" onClick={() => navigate("itinerary")}><span className="brand-mark">旅</span><span>Travel Book</span></button><div className="topbar-side"><span className="sync-label">{online ? "首頁功能開發版" : "離線唯讀"}</span><span className="avatar" aria-label="4 位同行者">4 人</span></div></header>
    {route === "home" ? <HomePage repository={homeRepository} online={online} /> : route === "itinerary" ? <ItineraryPage repository={itineraryRepository} trip={verifiedAccess.trip} online={online} /> : route === "stays" && staysRepository ? <StaysPage repository={staysRepository} online={online} startDate={verifiedAccess.trip.startDate} endDate={verifiedAccess.trip.endDate} /> : <ComingSoon route={route} onHome={() => navigate("home")} />}
    <nav className="bottom-nav" aria-label="主要導覽">
      {routeItems.map(([value, icon, label]) => <button className="nav-button" type="button" key={value} onClick={() => navigate(value)} aria-current={route === value ? "page" : undefined}><Icon name={icon} size={20} /><span>{label}</span></button>)}
    </nav>
  </div>;
}

function AccessStatus({ state, online }: { state: AccessState; online: boolean }) {
  const content = {
    checking: ["正在確認私人連結", "確認完成後會自動開啟旅程。"],
    missing: ["需要私人連結", "請使用家人分享的完整 Travel Book 私人連結開啟。"],
    denied: ["私人連結已失效", "請向家人取得新的私人連結。"],
    offline: ["目前無法驗證私人連結", "連上網路後重新開啟，即可進入旅程。"],
    unconfigured: ["正式服務尚未設定", "請完成 Supabase Edge Function 網址設定後再試。"],
    error: ["暫時無法確認私人連結", "請稍後重新整理；已保存的連結不會因這次失敗而清除。"],
    ready: ["", ""],
  }[state];
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">旅</span><span>Travel Book</span></div><div className="topbar-side"><span className="sync-label">{online ? "私人旅程" : "離線"}</span></div></header>
    <main id="main" className="screen"><section className="card section-card empty-development"><h1>{content[0]}</h1><p>{content[1]}</p></section></main>
  </div>;
}

function ComingSoon({ route, onHome }: { route: Exclude<Route, "home">; onHome: () => void }) {
  const label = routeItems.find(([value]) => value === route)?.[2];
  return <main id="main" className="screen"><header className="page-heading"><div><p className="eyebrow">In development</p><h1>{label}</h1></div></header><section className="card section-card empty-development"><h2>這個頁面將在後續功能切片開發</h2><p>目前先完成首頁的正式功能。既有完整互動 prototype 仍保留在 <code>dist</code> 目錄。</p><button className="primary-button" type="button" onClick={onHome}>查看首頁</button></section></main>;
}
