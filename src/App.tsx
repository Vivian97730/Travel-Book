import { ResourceCache } from "./features/cache/resourceCache";
import { cachedHome, cachedStays, cachedItinerary, cachedChecklist, cachedExpenses } from "./features/cache/cachedRepositories";
import { CacheContext } from "./features/cache/CacheContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { captureAccessToken, createAccessTokenStore } from "./app/accessSession";
import { hashForRoute, parseAppHash, type Route } from "./app/routing";
import { Icon, type IconName } from "./components/Icon";
import { ApiSharedChecklistRepository } from "./features/checklists/apiSharedChecklistRepository";
import { ChecklistsPage } from "./features/checklists/ChecklistsPage";
import { MemberSession } from "./features/members/MemberSession";
import { LegacyChecklistImport } from "./features/members/LegacyChecklistImport";
import { ApiExpensesRepository } from "./features/expenses/apiExpensesRepository";
import { ExpensesPage } from "./features/expenses/ExpensesPage";
import { ApiHomeRepository } from "./features/home/apiHomeRepository";
import { HomePage } from "./features/home/HomePage";
import { SnapshotHomeRepository } from "./features/home/snapshotHomeRepository";
import { CoreSnapshots } from "./features/offline/coreSnapshots";
import { OfflineSnapshotStatus } from "./features/offline/OfflineSnapshotStatus";
import { snapshotRepositories } from "./features/offline/snapshotRepositories";
import { buildDateWindow } from "./features/itinerary/dateWindow";
import { ApiItineraryRepository } from "./features/itinerary/apiItineraryRepository";
import { ItineraryPage } from "./features/itinerary/ItineraryPage";
import {
  deleteHomeSnapshotForToken,
  getHomeSnapshotForToken,
  hashAccessToken,
} from "./features/offline/homeSnapshotRepository";
import { IndexedDbHomeSnapshotRepository } from "./features/offline/indexedDbHomeSnapshotRepository";
import { ApiClient, ApiClientError } from "./shared/api/apiClient";
import { ApiStaysRepository } from "./features/stays/apiStaysRepository";
import { IndexedDbStaysSnapshots } from "./features/stays/staysSnapshot";
import { SnapshotStaysRepository } from "./features/stays/snapshotStaysRepository";
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
  const accessStore = useMemo(() => createAccessTokenStore(() => window.localStorage, {
    read: () => document.cookie,
    write: (value) => { document.cookie = value; },
    path: import.meta.env.BASE_URL,
  }), []);
  const [accessToken, setAccessToken] = useState<string | null>(() => captureAccessToken({
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search,
    replaceUrl: (url) => window.history.replaceState(null, "", url),
  }) ?? accessStore.get());
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [verifiedAccess, setVerifiedAccess] = useState<AccessVerifyResponse | null>(null);
  const [route, setRoute] = useState<Route>(routeFromCurrentHash);
  const [online, setOnline] = useState(navigator.onLine);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const coreSnapshots = useMemo(() => new CoreSnapshots(), []);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const cache = useMemo(() => {
    if (!accessToken || !apiBaseUrl) return null;
    const scope = hashAccessToken(`${apiBaseUrl}\n${accessToken}`);
    return new ResourceCache({
      async get(key) {
        const entry = await coreSnapshots.get(await scope, `cache:${key}`);
        return entry ? { data: entry.data, syncedAt: Date.parse(entry.syncedAt) } : undefined;
      },
      async put(key, entry) { await coreSnapshots.put(await scope, `cache:${key}`, entry.data, entry.syncedAt); },
      async delete(key) { await coreSnapshots.deleteResource(await scope, `cache:${key}`); },
    }, Date.now, () => { setVerifiedAccess(null); setAccessAttempt((value) => value + 1); });
  }, [accessToken, apiBaseUrl, coreSnapshots]);
  useEffect(() => cache?.attach(), [cache]);
  const staysSnapshots = useMemo(() => new IndexedDbStaysSnapshots(), []);
  const staysSnapshotRepository = useMemo(
    () => apiBaseUrl && accessToken && verifiedAccess
      ? new SnapshotStaysRepository(
          new ApiStaysRepository(apiBaseUrl, accessToken), staysSnapshots, accessToken, verifiedAccess,
          () => navigator.onLine,
        )
      : null,
    [apiBaseUrl, accessToken, staysSnapshots, verifiedAccess],
  );
  const homeSnapshots = useMemo(() => new IndexedDbHomeSnapshotRepository(), []);
  const homeSnapshotRepository = useMemo(
    () => apiBaseUrl && accessToken && verifiedAccess
      ? new SnapshotHomeRepository(
          new ApiHomeRepository(apiBaseUrl, accessToken),
          homeSnapshots,
          accessToken,
          verifiedAccess,
          () => navigator.onLine,
        )
      : null,
    [accessToken, apiBaseUrl, homeSnapshots, verifiedAccess],
  );
  const [checklistRevision, setChecklistRevision] = useState(0);
  const tokenHash = useMemo(() => accessToken ? hashAccessToken(accessToken) : null, [accessToken]);
  const core = useMemo(() => apiBaseUrl && accessToken && tokenHash ? snapshotRepositories(
    new ApiItineraryRepository(apiBaseUrl, accessToken),
    new ApiSharedChecklistRepository(apiBaseUrl, accessToken), coreSnapshots, tokenHash, () => navigator.onLine,
  ) : null, [accessToken, apiBaseUrl, coreSnapshots, tokenHash]);
  const homeRepository = useMemo(() => homeSnapshotRepository && cache ? cachedHome(homeSnapshotRepository, cache) : null, [homeSnapshotRepository, cache]);
  const staysRepository = useMemo(() => staysSnapshotRepository && cache ? cachedStays(staysSnapshotRepository, cache) : null, [staysSnapshotRepository, cache]);
  const itineraryRepository = useMemo(() => core && cache ? cachedItinerary(core.itineraryRepository, cache) : null, [core, cache]);
  const sharedChecklistRepository = useMemo(() => core && cache ? cachedChecklist(core.checklistRepository, cache) : null, [core, cache]);
  const readChecklistInfo = useMemo(() => async () => tokenHash
    ? coreSnapshots.get(await tokenHash, "checklist") : null, [coreSnapshots, tokenHash]);
  const readDayInfo = useMemo(() => async (date: string) => tokenHash
    ? coreSnapshots.get(await tokenHash, "day:" + date) : null, [coreSnapshots, tokenHash]);
  const readPageInfo = useMemo(() => async () => {
    if (!tokenHash) return null;
    const hash = await tokenHash;
    return route === "home" ? homeSnapshots.get(hash) : staysSnapshots.get(hash, { includeExpired: true });
  }, [homeSnapshots, route, staysSnapshots, tokenHash]);
  const expensesRepository = useMemo(
    () => apiBaseUrl && accessToken && cache ? cachedExpenses(new ApiExpensesRepository(apiBaseUrl, accessToken), cache) : null,
    [accessToken, apiBaseUrl, cache],
  );
  const currentSnapshotRepositories = useRef({ homeRepository: homeSnapshotRepository, staysRepository: staysSnapshotRepository });
  useEffect(() => {
    const homeRepository = homeSnapshotRepository;
    const staysRepository = staysSnapshotRepository;
    const previous = currentSnapshotRepositories.current;
    if (previous.homeRepository !== homeRepository) void previous.homeRepository?.stopSaving();
    if (previous.staysRepository !== staysRepository) void previous.staysRepository?.stopSaving();
    currentSnapshotRepositories.current = { homeRepository, staysRepository };
  }, [homeSnapshotRepository, staysSnapshotRepository]);

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
      Promise.all([
        getHomeSnapshotForToken(homeSnapshots, accessToken).catch(() => null),
        hashAccessToken(accessToken).then((hash) => staysSnapshots.get(hash)).catch(() => null),
        tokenHash?.then((hash) => coreSnapshots.access(hash)).catch(() => null),
      ]).then(([home, stays, access]) => {
          if (!active) return;
          setVerifiedAccess(access ?? home?.access ?? stays?.access ?? null);
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
        accessStore.set(accessToken);
        void core?.rememberAccess(verified);
        setVerifiedAccess(verified);
        setAccessState("ready");
      }
    }).catch(async (error: unknown) => {
      if (!active) return;
      if (error instanceof ApiClientError && error.code === "ACCESS_DENIED") {
        const snapshots = currentSnapshotRepositories.current;
        await Promise.allSettled([snapshots.homeRepository?.stopSaving(), snapshots.staysRepository?.stopSaving()]);
        if (!active) return;
        await cache?.stop();
        await Promise.allSettled([
          apiBaseUrl && hashAccessToken(`${apiBaseUrl}\n${accessToken}`).then((hash) => coreSnapshots.delete(hash)),
          core?.revoke(),
          deleteHomeSnapshotForToken(homeSnapshots, accessToken),
          hashAccessToken(accessToken).then((hash) => staysSnapshots.delete(hash)),
        ]);
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
  }, [accessStore, accessToken, apiBaseUrl, core, coreSnapshots, homeSnapshots, staysSnapshots, online, tokenHash, accessAttempt, cache]);

  useEffect(() => {
    const updateRoute = () => {
      const captured = captureAccessToken({
        hash: window.location.hash,
        pathname: window.location.pathname,
        search: window.location.search,
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

  useEffect(() => {
    if (!online || accessState !== "ready" || !verifiedAccess || !core || !homeRepository || !staysRepository || !sharedChecklistRepository || !itineraryRepository) return;
    let active = true;
    const { startDate, endDate } = verifiedAccess.trip;
    void Promise.allSettled([
      homeRepository.getTripHome(), staysRepository.getStays(), sharedChecklistRepository.getSharedChecklist(),
      (async () => {
        for (const date of buildDateWindow(startDate, endDate)) {
          if (!active || !navigator.onLine) break;
          await itineraryRepository.getDay(date).catch(() => undefined);
        }
      })(),
    ]);
    return () => { active = false; };
  }, [accessState, core, homeRepository, online, staysRepository, verifiedAccess, itineraryRepository, sharedChecklistRepository]);

  function navigate(next: Route) {
    window.location.hash = hashForRoute(next);
  }

  if (!verifiedAccess || !homeRepository || !itineraryRepository || !shouldRenderVerifiedApp(accessState, true)) {
    return <AccessStatus state={accessState} online={online} />;
  }

  return <CacheContext.Provider value={cache}><MemberSession cache={cache ?? undefined} key={`${verifiedAccess.trip.id}:${accessToken}`} tripId={verifiedAccess.trip.id} token={accessToken!} baseUrl={apiBaseUrl!} online={online}>
    {(member, personalChecklistRepository, switchMember) => <div className="app-shell">
    <header className="topbar"><button className="brand brand-button" type="button" onClick={() => navigate("itinerary")}><span className="brand-mark">旅</span><span>Travel Book</span></button><div className="topbar-side"><span className="sync-label">{online ? "首頁功能開發版" : "離線唯讀"}</span><button className="avatar member-switch" type="button" disabled={!online} title="切換使用者" aria-label={`目前使用者：${member.displayName}，切換使用者`} onClick={switchMember}>{member.displayName}</button></div></header>
    {route === "lists" && <LegacyChecklistImport key={member.id} member={member} repository={personalChecklistRepository} online={online} onImported={() => setChecklistRevision((value) => value + 1)} />}
    {!online && (route === "home" || route === "stays") && <OfflineSnapshotStatus read={readPageInfo} />}
    {route === "home" ? <HomePage repository={homeRepository} online={online} /> : route === "itinerary" ? <ItineraryPage repository={itineraryRepository} staysRepository={staysRepository} trip={verifiedAccess.trip} online={online} readSnapshotInfo={readDayInfo} /> : route === "stays" && staysRepository ? <StaysPage repository={staysRepository} online={online} startDate={verifiedAccess.trip.startDate} endDate={verifiedAccess.trip.endDate} /> : route === "expenses" && expensesRepository ? <ExpensesPage repository={expensesRepository} online={online} /> : route === "lists" && sharedChecklistRepository ? <ChecklistsPage key={`${member.id}:${checklistRevision}`} shared={sharedChecklistRepository} personal={personalChecklistRepository} online={online} readSnapshotInfo={readChecklistInfo} /> : <ComingSoon route={route} onHome={() => navigate("home")} />}
    <nav className="bottom-nav" aria-label="主要導覽">
      {routeItems.map(([value, icon, label]) => <button className="nav-button" type="button" key={value} onClick={() => navigate(value)} aria-current={route === value ? "page" : undefined}><Icon name={icon} size={20} /><span>{label}</span></button>)}
    </nav>
  </div>}
  </MemberSession></CacheContext.Provider>;
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
