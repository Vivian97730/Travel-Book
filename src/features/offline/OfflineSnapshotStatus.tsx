import { useEffect, useState } from "react";
import type { SnapshotInfo } from "./coreSnapshots";

export function OfflineSnapshotStatus({ read }: { read: () => Promise<SnapshotInfo | null | undefined> }) {
  const [info, setInfo] = useState<SnapshotInfo | null | undefined>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    read().then((value) => { if (active) setInfo(value ?? null); }, () => { if (active) setInfo(null); });
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [read]);
  if (info === undefined) return null;
  return <p className="offline-snapshot-status" role="status">{info
    ? <>最近同步 <time dateTime={info.syncedAt}>{new Date(info.syncedAt).toLocaleString("zh-TW")}</time>
      {" ・ "}快照版本 {info.snapshotVersion}{" ・ "}{Date.parse(info.expiresAt) <= now ? "已過期" : "未過期"}</>
    : "此裝置沒有可用的離線快照。"}</p>;
}
