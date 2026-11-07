import { describe, expect, it } from "vitest";
import { parseSaveTripDayRequest, parseTripDay } from "./itinerary";

const validDay = {
  date: "2027-02-06",
  weekday: "六",
  city: "維也納",
  summary: "今天步調舒緩，景點集中在市中心。",
  version: 1,
  items: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "美泉宮與花園",
      note: "預留 2.5 小時，戶外注意保暖",
      category: "sight",
      sortOrder: 0,
      place: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Schloss Schonbrunn",
        latitude: 48.1845,
        longitude: 16.3122,
      },
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "維也納舊城散步",
      note: "依體力彈性調整",
      category: "shopping",
      sortOrder: 1,
      place: null,
    },
  ],
};

describe("trip day contract", () => {
  it("accepts ordered itinerary items with optional coordinates", () => {
    expect(parseTripDay(validDay)).toEqual({ ok: true, value: validDay });
  });

  it("rejects invalid dates, categories, coordinates, and ordering", () => {
    const result = parseTripDay({
      ...validDay,
      date: "06/02/2027",
      items: [{
        ...validDay.items[0],
        category: "unknown",
        sortOrder: -1,
        place: { ...validDay.items[0].place, latitude: 91 },
      }],
    });

    expect(result).toEqual({
      ok: false,
      issues: [
        { path: "date", message: "日程日期格式不正確。" },
        { path: "items[0].category", message: "行程分類不支援。" },
        { path: "items[0].sortOrder", message: "排序必須是非負整數。" },
        { path: "items[0].place.latitude", message: "緯度必須介於 -90 與 90 之間。" },
      ],
    });
  });
});

describe("save trip day request contract", () => {
  it("accepts one ordered item batch without exposing place writes", () => {
    const request = {
      expectedVersion: 3,
      items: [{
        id: "20000000-0000-4000-8000-000000000001",
        title: "中央咖啡館午餐",
        note: "預留一小時",
        category: "food",
        sortOrder: 0,
      }],
    };

    expect(parseSaveTripDayRequest(request)).toEqual({ ok: true, value: request });
  });

  it("rejects invalid versions, item ids, text, categories, and non-contiguous ordering", () => {
    const result = parseSaveTripDayRequest({
      expectedVersion: 0,
      items: [{ id: "new-item", title: " ", note: "", category: "other", sortOrder: 2 }],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { path: "expectedVersion", message: "預期版本必須是正整數。" },
        { path: "items[0].id", message: "行程項目 ID 格式不正確。" },
        { path: "items[0].title", message: "行程名稱不得為空。" },
        { path: "items[0].note", message: "行程內容不得為空。" },
        { path: "items[0].category", message: "行程分類不支援。" },
        { path: "items[0].sortOrder", message: "行程排序必須從 0 連續編號。" },
      ]),
    });
  });
});
