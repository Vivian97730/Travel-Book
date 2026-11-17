import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// The font stylesheet must not block the module before private access starts.
const fontStylesheet = document.querySelector<HTMLTemplateElement>("#app-fonts");
if (fontStylesheet) document.head.append(fontStylesheet.content.cloneNode(true));

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}app-shell-worker.js`, {
    updateViaCache: "none",
  }).catch(() => undefined);
}
