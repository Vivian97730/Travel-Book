import type { TripHome } from "./types";

export const initialTripHome: TripHome = {
  title: "2027 過年東歐遊",
  subtitle: "維也納・哈修塔特・布達佩斯",
  dateLabel: "02/05 (五) - 02/15 (一)",
  durationLabel: "11 天 10 夜",
  travelerCount: 4,
  version: 1,
  flights: [
    {
      direction: "去程",
      duration: "19 小時 05 分",
      legs: [
        { airport: "TPE", city: "桃園", time: "00:20" },
        { airport: "DXB", city: "杜拜轉機", time: "06:15－08:55" },
        { airport: "VIE", city: "維也納", time: "12:25" },
      ],
    },
    {
      direction: "回程",
      duration: "15 小時 55 分",
      legs: [
        { airport: "VIE", city: "維也納", time: "21:45" },
        { airport: "DXB", city: "杜拜轉機", time: "06:25－08:45", dayOffset: 1 },
        { airport: "TPE", city: "桃園", time: "20:40", dayOffset: 1 },
      ],
    },
  ],
  facts: [
    { id: "timezone", icon: "globe", title: "和台灣的時差", content: "冬季慢 7 小時", sortOrder: 0 },
    { id: "exchange-rate", icon: "exchange", title: "參考匯率", content: "EUR 1 ≈ TWD 35.2", sortOrder: 1 },
    { id: "power", icon: "plug", title: "插座形狀", content: "Type C／F，電壓 230V", sortOrder: 2 },
    { id: "water", icon: "water", title: "自來水", content: "奧地利可直接生飲", sortOrder: 3 },
  ],
};
