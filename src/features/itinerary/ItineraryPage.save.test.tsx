import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { sampleTripDays } from "./sampleTripDays";
import { ItineraryPage, ItineraryDayView, ItineraryItemFormDialog } from "./ItineraryPage";

// Run the page's actual event handlers with retained hook state across renders.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: () => undefined,
  useMemo: (compute: () => unknown) => compute(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
}));
vi.mock("../cache/CacheContext", () => ({ useCacheRevision: () => 0, CacheControls: () => null }));

const day = sampleTripDays[1];
beforeEach(() => {
  hooks.values = [day.date, [], structuredClone(day), false, null, day.version, true, structuredClone(day.items), undefined, false, null];
});

function setup() {
  const saveDayItems = vi.fn(async (_date, items, version) => ({ ...day, items: items.map((item: object) => ({ ...item, place: null })), version: version + 1 }));
  function render() {
    hooks.cursor = 0;
    const tree = ItineraryPage({ repository: { getDay: vi.fn(), saveDayItems }, trip: { id: "trip", title: "Trip", startDate: day.date, endDate: day.date, displayTimezone: "Europe/Vienna" } }) as ReactElement<{ children: ReactElement[] }>;
    const children = tree.props.children;
    return {
      view: children.find((child) => child?.type === ItineraryDayView)!.props as React.ComponentProps<typeof ItineraryDayView>,
      dialog: children.find((child) => child?.type === ItineraryItemFormDialog)?.props as React.ComponentProps<typeof ItineraryItemFormDialog> | undefined,
    };
  }
  return { render, saveDayItems };
}

it("writes dialog changes immediately and saves subsequent ordering with the new version", async () => {
  const { render, saveDayItems } = setup();
  render().view.onEditItem!(day.items[0]);
  await render().dialog!.onSubmit({ ...day.items[0], title: "立即保存" });
  expect(saveDayItems).toHaveBeenCalledWith(day.date, expect.arrayContaining([expect.objectContaining({ title: "立即保存" })]), day.version);
  expect(render().dialog).toBeUndefined();
  render().view.onReorderItem!(day.items[0].id, day.items[1].id);
  await render().view.onToggleEditing!();
  const [, items, version] = saveDayItems.mock.calls[1];
  expect(items.slice(0, 2).map((item: { id: string }) => item.id)).toEqual([day.items[1].id, day.items[0].id]);
  expect(items.map((item: { sortOrder: number }) => item.sortOrder)).toEqual(items.map((_: unknown, index: number) => index));
  expect(version).toBe(day.version + 1);
});

it("keeps the dialog open after failure and retries its input", async () => {
  const { render, saveDayItems } = setup();
  render().view.onEditItem!(day.items[0]);
  saveDayItems.mockRejectedValueOnce(new Error("network"));
  const value = { ...day.items[0], title: "保留輸入" };
  await render().dialog!.onSubmit(value);
  expect(render().dialog?.error).toBeTruthy();
  await render().dialog!.onSubmit(value);
  expect(saveDayItems.mock.calls[1][1][0].title).toBe("保留輸入");
  expect(render().dialog).toBeUndefined();
});
