import type { ItineraryItem, TripDay } from "@travel-book/contracts";

const cities = [
  ["2027-02-05", "五", "維也納"],
  ["2027-02-06", "六", "維也納"],
  ["2027-02-07", "日", "維也納"],
  ["2027-02-08", "一", "哈修塔特"],
  ["2027-02-09", "二", "哈修塔特"],
  ["2027-02-10", "三", "布達佩斯"],
  ["2027-02-11", "四", "布達佩斯"],
  ["2027-02-12", "五", "布達佩斯"],
  ["2027-02-13", "六", "布達佩斯"],
  ["2027-02-14", "日", "維也納"],
  ["2027-02-15", "一", "返程"],
] as const;

const viennaItems: ItineraryItem[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    title: "搭地鐵前往美泉宮",
    note: "從住宿地點出發，約 25 分鐘",
    category: "transit",
    sortOrder: 0,
    place: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    title: "美泉宮與花園",
    note: "預留 2.5 小時，戶外注意保暖",
    category: "sight",
    sortOrder: 1,
    place: {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Schloss Schonbrunn",
      latitude: 48.1845,
      longitude: 16.3122,
    },
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    title: "中央咖啡館午餐",
    note: "尖峰可能候位，備案在地圖收藏",
    category: "food",
    sortOrder: 2,
    place: {
      id: "30000000-0000-4000-8000-000000000002",
      name: "Cafe Central",
      latitude: 48.2104,
      longitude: 16.3655,
    },
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    title: "維也納舊城散步",
    note: "依體力彈性調整",
    category: "shopping",
    sortOrder: 3,
    place: null,
  },
];

export const sampleTripDays: TripDay[] = cities.map(([date, weekday, city], index) => ({
  date,
  weekday,
  city,
  summary: city === "返程" ? "整理行李並預留充足時間前往機場。" : "今天步調舒緩，景點集中在市中心。",
  version: 1,
  items: index === 1 ? structuredClone(viennaItems) : [],
}));
