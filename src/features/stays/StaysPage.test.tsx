import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StayCard, StaysContent } from "./StaysPage";
import { StayDialog, stayFailureMessage } from "./StayDialog";

it("keeps dialog prefill, form order and failure recovery explicit", () => {
  const stay = { id: "test", version: 1, name: "住宿草稿", city: "維也納", address: "測試地址", startDate: "2027-02-05", endDate: "2027-02-08", checkin: "15:00", checkout: "11:00", placeId: null, photo: null };
  const html = renderToStaticMarkup(<StayDialog stay={stay} online={false} startDate="2027-02-05" endDate="2027-02-15" onClose={() => undefined} onSave={async () => undefined} onDelete={async () => undefined} onReload={async () => undefined} />);
  expect(html).toContain('value="住宿草稿"');
  expect(html).toContain("編輯住宿");
  expect(html).toContain("刪除住宿");
  expect(html.indexOf("入住日期")).toBeLessThan(html.indexOf("退房日期"));
  expect(html).toContain("目前離線");
  expect(stayFailureMessage({ code: "VERSION_CONFLICT" })).toMatchObject({ conflict: true });
  expect(stayFailureMessage(new Error("network")).message).toContain("草稿仍保留");
});

it("renders Prototype lodging details and name-based navigation", () => {
  const html = renderToStaticMarkup(<StayCard index={0} stay={{
    id: "test", version: 1, name: "示意住宿", city: "維也納", address: "示意地址",
    startDate: "2027-02-05", endDate: "2027-02-08", checkin: "15:00", checkout: "11:00",
    placeId: null, photo: null,
  }} />);
  expect(html).toContain("3 晚");
  expect(html).toContain("15:00 後");
  expect(html).toContain("11:00 前");
  expect(html).toContain(encodeURIComponent("示意住宿"));
  expect(html).toContain('class="stay-visual"><svg');
  expect(html).toContain('disabled=""');
  expect(renderToStaticMarkup(<StaysContent stays={[]} />)).toContain("尚未新增住宿。");
});
