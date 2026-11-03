import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "./components/Icon";
import { HomePage } from "./features/home/HomePage";
import { BrowserHomeRepository } from "./features/home/homeRepository";

const routes = [
  ["home", "home", "首頁"],
  ["itinerary", "calendar", "行程"],
  ["stays", "bed", "住宿"],
  ["expenses", "wallet", "記帳"],
  ["lists", "list", "清單"],
] as const;

type Route = (typeof routes)[number][0];

function routeFromHash(): Route {
  const candidate = window.location.hash.slice(1) as Route;
  return routes.some(([route]) => route === candidate) ? candidate : "itinerary";
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [online, setOnline] = useState(navigator.onLine);
  const repository = useMemo(() => new BrowserHomeRepository(), []);

  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash());
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  function navigate(next: Route) {
    window.location.hash = next;
  }

  return <div className="app-shell">
    <header className="topbar"><button className="brand brand-button" type="button" onClick={() => navigate("itinerary")}><span className="brand-mark">旅</span><span>Travel Book</span></button><div className="topbar-side"><span className="sync-label">{online ? "首頁功能開發版" : "離線唯讀"}</span><span className="avatar" aria-label="4 位同行者">4 人</span></div></header>
    {route === "home" ? <HomePage repository={repository} online={online} /> : <ComingSoon route={route} onHome={() => navigate("home")} />}
    <nav className="bottom-nav" aria-label="主要導覽">
      {routes.map(([value, icon, label]) => <button className="nav-button" type="button" key={value} onClick={() => navigate(value)} aria-current={route === value ? "page" : undefined}><Icon name={icon as IconName} size={20} /><span>{label}</span></button>)}
    </nav>
  </div>;
}

function ComingSoon({ route, onHome }: { route: Exclude<Route, "home">; onHome: () => void }) {
  const label = routes.find(([value]) => value === route)?.[2];
  return <main id="main" className="screen"><header className="page-heading"><div><p className="eyebrow">In development</p><h1>{label}</h1></div></header><section className="card section-card empty-development"><h2>這個頁面將在後續功能切片開發</h2><p>目前先完成首頁的正式功能。既有完整互動 prototype 仍保留在 <code>dist</code> 目錄。</p><button className="primary-button" type="button" onClick={onHome}>查看首頁</button></section></main>;
}
