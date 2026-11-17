import type { KeyboardEvent } from "react";

export function keepDialogTabFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
    "button, a[href], input, select, textarea, [tabindex]",
  )].filter((element) => element.tabIndex >= 0 && !element.matches(":disabled")
    && element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible");
  const edge = event.shiftKey ? controls[0] : controls.at(-1);
  if (controls.length && document.activeElement === edge) {
    event.preventDefault();
    (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
  }
}
