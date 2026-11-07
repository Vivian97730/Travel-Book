import { describe, expect, it } from "vitest";
import { parseSaveTravelFactsRequest, parseTripHome } from "./home";

const validHome = {
  title: "2027 過年東歐遊",
  subtitle: "維也納・哈修塔特・布達佩斯",
  dateLabel: "02/05－02/15",
  durationLabel: "11 天 10 夜",
  travelerCount: 4,
  version: 3,
  flights: [{
    direction: "去程",
    duration: "16 小時 05 分",
    legs: [
      { airport: "TPE", city: "桃園", time: "00:20" },
      { airport: "VIE", city: "維也納", time: "12:25" },
    ],
  }],
  facts: [{
    id: "fact-timezone",
    icon: "globe",
    title: "時差",
    content: "冬季慢 7 小時。",
    sortOrder: 0,
  }],
};

describe("trip home contract", () => {
  it("accepts the persisted home response", () => {
    expect(parseTripHome(validHome)).toEqual({ ok: true, value: validHome });
  });

  it("rejects invalid versions and incomplete facts", () => {
    const result = parseTripHome({
      ...validHome,
      version: -1,
      facts: [{ ...validHome.facts[0], title: "" }],
    });

    expect(result).toEqual({
      ok: false,
      issues: [
        { path: "version", message: "版本必須是非負整數。" },
        { path: "facts[0].title", message: "小知識標題不得為空。" },
      ],
    });
  });
});

describe("save travel facts request contract", () => {
  it("accepts an ordered fact batch", () => {
    const request = {
      expectedVersion: 3,
      facts: [{
        id: "50000000-0000-4000-8000-000000000001",
        icon: "globe",
        title: "時差",
        content: "冬季慢 7 小時。",
        sortOrder: 0,
      }],
    };

    expect(parseSaveTravelFactsRequest(request)).toEqual({ ok: true, value: request });
  });

  it("rejects invalid versions, ids, text, icons, and ordering", () => {
    const result = parseSaveTravelFactsRequest({
      expectedVersion: 0,
      facts: [{ id: "new-fact", icon: "unknown", title: " ", content: "", sortOrder: 2 }],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { path: "expectedVersion", message: "預期版本必須是正整數。" },
        { path: "facts[0].id", message: "小知識 ID 格式不正確。" },
        { path: "facts[0].icon", message: "小知識圖示不支援。" },
        { path: "facts[0].title", message: "小知識標題不得為空。" },
        { path: "facts[0].content", message: "小知識內容不得為空。" },
        { path: "facts[0].sortOrder", message: "小知識排序必須從 0 連續編號。" },
      ]),
    });
  });
});
