import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ItineraryDayView,
  ItineraryItemFormDialog,
  ItinerarySaveRecovery,
  googleMapsSearchUrl,
  itinerarySaveFailureFor,
} from "./ItineraryPage";
import { sampleTripDays } from "./sampleTripDays";

describe("itinerary page public behavior", () => {
  it("renders the full trip date range and keeps items without coordinates visible", () => {
    const html = renderToStaticMarkup(<ItineraryDayView
      day={sampleTripDays[1]}
      dates={["2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09", "2027-02-10", "2027-02-11", "2027-02-12", "2027-02-13", "2027-02-14", "2027-02-15"]}
      selectedDate="2027-02-06"
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
    />);

    expect((html.match(/class="date-button"/g) ?? [])).toHaveLength(11);
    expect(html).toContain("02/05");
    expect(html).toContain("02/15");
    expect(html).toContain("搭地鐵前往美泉宮");
    expect(html).toContain("維也納舊城散步");
    expect(html).toContain("Schloss Schonbrunn");
    expect(html).toContain('data-map-points="Schloss Schonbrunn|Cafe Central"');
    expect(html).toContain('data-map-orders="2|3"');
    expect(html).toContain("編輯城市與行程");
    expect(html).not.toContain("新增行程");
    expect(html).not.toContain("修改中央咖啡館午餐");
    expect(html).not.toContain("刪除中央咖啡館午餐");
  });

  it("uses each itinerary title as the Google Maps search query", () => {
    expect(googleMapsSearchUrl("中央咖啡館午餐")).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E5%A4%AE%E5%92%96%E5%95%A1%E9%A4%A8%E5%8D%88%E9%A4%90",
    );
  });

  it("shows mutation controls only after entering itinerary edit mode", () => {
    const html = renderToStaticMarkup(<ItineraryDayView
      day={sampleTripDays[1]}
      dates={["2027-02-05", "2027-02-06"]}
      selectedDate="2027-02-06"
      editing
      saving={false}
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
      onToggleEditing={() => undefined}
      onAddItem={() => undefined}
      onEditItem={() => undefined}
      onDeleteItem={() => undefined}
      onReorderItem={() => undefined}
    />);

    expect(html).toContain("完成行程編輯");
    expect(html).toContain("新增行程");
    expect(html).toContain("修改中央咖啡館午餐");
    expect(html).toContain("刪除中央咖啡館午餐");
    expect(html).toContain("拖曳中央咖啡館午餐");
    expect(html).not.toContain("檢視中央咖啡館午餐");
  });

  it("keeps the loaded itinerary readable but disables new actions offline", () => {
    const html = renderToStaticMarkup(<ItineraryDayView
      day={sampleTripDays[1]}
      dates={["2027-02-05", "2027-02-06"]}
      selectedDate="2027-02-06"
      online={false}
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
      onToggleEditing={() => undefined}
    />);

    expect(html).toContain("中央咖啡館午餐");
    expect(html).toContain("開啟 Google Maps");
    expect(html).toContain('data-map-status="offline"');
    expect(html).toContain("離線時不載入街道圖磚");
    expect(html).toMatch(/class="date-button"[^>]*disabled=""/);
    expect(html).toMatch(/disabled=""[^>]*aria-label="編輯城市與行程"/);
  });

  it("preserves an existing draft while hiding all mutation controls offline", () => {
    const draftDay = structuredClone(sampleTripDays[1]);
    draftDay.items[2] = { ...draftDay.items[2], title: "中央咖啡館草稿" };
    const html = renderToStaticMarkup(<ItineraryDayView
      day={draftDay}
      dates={["2027-02-05", "2027-02-06"]}
      selectedDate="2027-02-06"
      online={false}
      editing
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
      onToggleEditing={() => undefined}
      onAddItem={() => undefined}
      onEditItem={() => undefined}
      onDeleteItem={() => undefined}
      onReorderItem={() => undefined}
    />);

    expect(html).toContain("中央咖啡館草稿");
    expect(html).toContain("離線唯讀：草稿已保留，連線後可繼續編輯。");
    expect(html).toMatch(/disabled=""[^>]*aria-label="完成行程編輯"/);
    expect(html).not.toContain("新增行程");
    expect(html).not.toContain("修改中央咖啡館草稿");
    expect(html).not.toContain("刪除中央咖啡館草稿");
    expect(html).not.toContain("拖曳中央咖啡館草稿");
  });

  it("keeps the map in sync when draft items without coordinates are added or mapped items are deleted", () => {
    const withAddedItem = structuredClone(sampleTripDays[1]);
    withAddedItem.items.push({
      id: "20000000-0000-4000-8000-000000000005",
      title: "晚間音樂會",
      note: "現場取票",
      category: "sight",
      sortOrder: withAddedItem.items.length,
      place: null,
    });
    const addedHtml = renderToStaticMarkup(<ItineraryDayView
      day={withAddedItem}
      dates={["2027-02-06"]}
      selectedDate="2027-02-06"
      editing
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
    />);

    expect(addedHtml).toContain("晚間音樂會");
    expect(addedHtml).toContain('data-map-points="Schloss Schonbrunn|Cafe Central"');
    expect(addedHtml).toContain("維也納・2 個地點");

    const withDeletedMappedItem = structuredClone(withAddedItem);
    withDeletedMappedItem.items = withDeletedMappedItem.items
      .filter((item) => item.title !== "中央咖啡館午餐")
      .map((item, sortOrder) => ({ ...item, sortOrder }));
    const deletedHtml = renderToStaticMarkup(<ItineraryDayView
      day={withDeletedMappedItem}
      dates={["2027-02-06"]}
      selectedDate="2027-02-06"
      editing
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
    />);

    expect(deletedHtml).toContain('data-map-points="Schloss Schonbrunn"');
    expect(deletedHtml).toContain('data-map-orders="2"');
    expect(deletedHtml).toContain("維也納・1 個地點");
    expect(deletedHtml).not.toContain("Cafe Central");
  });

  it("renders the Prototype item fields for add and edit dialogs", () => {
    const html = renderToStaticMarkup(<ItineraryItemFormDialog
      item={sampleTripDays[1].items[2]}
      onCancel={() => undefined}
      onSubmit={() => undefined}
    />);

    expect(html).toContain("修改行程");
    expect(html).toContain("行程名稱");
    expect(html).toContain("內容");
    expect(html).toContain("類別");
    expect(html).toContain("中央咖啡館午餐");
    expect(html).toContain("食物");
    expect(html).toContain('class="field itinerary-category-field"');
    expect(html).toContain('name="category"');
    expect(html).toContain('<option value="transit">交通</option>');
    expect(html).toContain('<option value="shopping">逛街</option>');
    expect(html).toContain('<option value="food" selected="">食物</option>');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("data-dialog-initial-focus");
  });

  it("offers reload for version conflicts and retry for other save failures", () => {
    const conflict = itinerarySaveFailureFor(Object.assign(new Error("request failed"), {
      code: "VERSION_CONFLICT",
    }));
    const unavailable = itinerarySaveFailureFor(new Error("network unavailable"));

    expect(conflict).toMatchObject({ kind: "conflict", actionLabel: "重新載入" });
    expect(unavailable).toMatchObject({ kind: "retry", actionLabel: "重試保存" });
    expect(conflict.message).toContain("草稿仍保留");
    expect(unavailable.message).toContain("草稿仍保留");

    const conflictHtml = renderToStaticMarkup(<ItinerarySaveRecovery
      failure={conflict}
      busy={false}
      onRecover={() => undefined}
    />);
    const unavailableHtml = renderToStaticMarkup(<ItinerarySaveRecovery
      failure={unavailable}
      busy={false}
      onRecover={() => undefined}
    />);

    expect(conflictHtml).toContain("重新載入");
    expect(unavailableHtml).toContain("重試保存");
    expect(conflictHtml).toContain('role="alert"');
  });
});

it("places overnight stays after editable items and excludes checkout day", () => {
  const day = sampleTripDays[1];
  const common = {
    city: day.city, address: "測試地址", checkin: "15:00", checkout: "11:00",
    placeId: null, version: 1, photo: null,
  };
  const stays = [
    { ...common, id: "previous", name: "已退房住宿", startDate: "2027-02-05", endDate: day.date },
    { ...common, id: "current", name: "今晚住宿", startDate: day.date, endDate: "2027-02-08" },
    { ...common, id: "future", name: "尚未入住", startDate: "2027-02-08", endDate: "2027-02-09" },
  ];
  const html = renderToStaticMarkup(<ItineraryDayView
    day={day} dates={[day.date]} selectedDate={day.date} stays={stays} editing
    onSelectDate={() => undefined} onViewItem={() => undefined}
  />);
  expect(html.indexOf("今晚住宿")).toBeGreaterThan(html.indexOf(day.items.at(-1)!.title));
  expect(html).toContain("Check-in 15:00 後");
  expect(html).toContain(encodeURIComponent("今晚住宿"));
  expect(html).not.toMatch(/已退房住宿|尚未入住|拖曳今晚住宿|修改今晚住宿|刪除今晚住宿/);
});
