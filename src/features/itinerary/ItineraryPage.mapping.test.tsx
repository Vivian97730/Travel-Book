import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { ItineraryDayView } from "./ItineraryPage";
import { ItineraryMap } from "./ItineraryMap";
import { sampleTripDays } from "./sampleTripDays";
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: () => undefined,
  useRef: (initial: unknown) => ({ current: initial }),
  useMemo: (compute: () => unknown) => compute(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
}));
beforeEach(() => { hooks.values = []; hooks.cursor = 0; });
function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}
function render() {
  hooks.cursor = 0;
  const original = sampleTripDays[1];
  const day = { ...original, items: [original.items[1], { ...original.items[2], place: original.items[1].place }, original.items[0]] };
  return elements(ItineraryDayView({ day, dates: [day.date], selectedDate: day.date, onSelectDate: () => undefined }));
}
it("links markers to distinct item IDs even when two items share a place", () => {
  let nodes = render();
  const map = nodes.find((node) => node.type === ItineraryMap)!;
  const props = map.props as React.ComponentProps<typeof ItineraryMap>;
  expect(props.locations.map(({ id, order }) => [id, order])).toEqual([[sampleTripDays[1].items[1].id, 1], [sampleTripDays[1].items[2].id, 2]]);
  props.onSelectItem!(sampleTripDays[1].items[2].id);
  nodes = render();
  expect(nodes.filter((node) => node.props["data-map-highlighted"] === "true").map((node) => node.props["data-itinerary-card"])).toEqual([sampleTripDays[1].items[2].id]);
});
it("selects the map location from the numbered list button and omits missing coordinates", () => {
  let nodes = render();
  const buttons = nodes.filter((node) => node.props.className === "itinerary-order");
  expect(buttons.map((node) => node.props.disabled)).toEqual([false, false]);
  (buttons[1].props.onClick as () => void)();
  nodes = render();
  expect(nodes.find((node) => node.type === ItineraryMap)!.props.selectedItem).toMatchObject({ id: sampleTripDays[1].items[2].id });
  expect(nodes.some((node) => node.props["data-map-highlighted"] === "true")).toBe(false);
});
