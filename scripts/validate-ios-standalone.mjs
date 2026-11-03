import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../dist/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const worker = readFileSync(new URL("../dist/service-worker.js", import.meta.url), "utf8");

const checks = [
  [!app.includes('draggable="${state.itineraryEditing}"'), "行程卡片不可依賴原生 draggable"],
  [!app.includes('addEventListener("dragstart"'), "排序不可依賴原生 dragstart"],
  [app.includes('addEventListener("pointerdown"'), "排序需使用 Pointer Events"],
  [app.includes("is-touch-dragging"), "拖曳時需顯示卡片移動狀態"],
  [styles.includes("@supports (-webkit-touch-callout: none)"), "需提供 iOS WebKit 表單修正"],
  [styles.includes("-webkit-appearance: none"), "日期與時間欄位需移除 iOS 固有最小寬度"],
  [styles.includes("min-inline-size: 0"), "表單欄位需允許縮小至容器寬度"],
  [worker.includes('request.mode === "navigate"'), "PWA 導覽需優先取得新版頁面"],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error(failures.map((message) => `FAIL: ${message}`).join("\n"));
  process.exit(1);
}

console.log("iOS standalone regression checks passed");
