import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItineraryDayView, googleMapsSearchUrl } from "./ItineraryPage";
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
    expect(html).not.toContain("新增行程");
    expect(html).not.toContain("編輯城市與行程");
  });

  it("uses each itinerary title as the Google Maps search query", () => {
    expect(googleMapsSearchUrl("中央咖啡館午餐")).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E5%A4%AE%E5%92%96%E5%95%A1%E9%A4%A8%E5%8D%88%E9%A4%90",
    );
  });
});
