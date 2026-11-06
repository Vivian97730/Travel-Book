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
  it("renders at most five dates and keeps items without coordinates visible", () => {
    const html = renderToStaticMarkup(<ItineraryDayView
      day={sampleTripDays[1]}
      dates={["2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09"]}
      selectedDate="2027-02-06"
      onSelectDate={() => undefined}
      onViewItem={() => undefined}
    />);

    expect((html.match(/class="date-button"/g) ?? [])).toHaveLength(5);
    expect(html).toContain("搭地鐵前往美泉宮");
    expect(html).toContain("維也納舊城散步");
    expect(html).toContain("Schloss Schonbrunn");
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
