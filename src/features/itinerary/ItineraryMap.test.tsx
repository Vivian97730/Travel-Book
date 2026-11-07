import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItineraryMap, type ItineraryMapLocation } from "./ItineraryMap";

const locations: ItineraryMapLocation[] = [
  { id: "place-1", name: "Schloss Schonbrunn", latitude: 48.1845, longitude: 16.3122, order: 2 },
  { id: "place-2", name: "Cafe Central", latitude: 48.2104, longitude: 16.3655, order: 3 },
];

describe("itinerary map interface", () => {
  it("exposes the configured locations and visible attribution while tiles load", () => {
    const html = renderToStaticMarkup(<ItineraryMap city="維也納" locations={locations} online />);

    expect(html).toContain('data-map-status="loading"');
    expect(html).toContain('data-map-points="Schloss Schonbrunn|Cafe Central"');
    expect(html).toContain('data-map-orders="2|3"');
    expect(html).toContain("維也納 OpenStreetMap 街道地圖，2 個有座標地點");
    expect(html).toContain("正在載入街道地圖");
    expect(html).toContain("© OpenStreetMap contributors");
  });

  it("does not load tiles offline and explains that navigation remains available", () => {
    const html = renderToStaticMarkup(<ItineraryMap city="維也納" locations={locations} online={false} />);

    expect(html).toContain('data-map-status="offline"');
    expect(html).toContain("離線時不載入街道圖磚");
    expect(html).toContain("外部導航仍可使用");
  });

  it("shows an understandable state when no itinerary places have coordinates", () => {
    const html = renderToStaticMarkup(<ItineraryMap city="維也納" locations={[]} online />);

    expect(html).toContain('data-map-status="empty"');
    expect(html).toContain("這一天尚無可顯示的地點座標");
  });
});
