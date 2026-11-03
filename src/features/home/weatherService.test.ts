import { describe, expect, it } from "vitest";
import { isInTaiwan, weatherDescription } from "./weatherService";

describe("isInTaiwan", () => {
  it("recognizes a coordinate in Taipei", () => {
    expect(isInTaiwan({ latitude: 25.033, longitude: 121.5654 })).toBe(true);
  });

  it("does not classify Vienna as Taiwan", () => {
    expect(isInTaiwan({ latitude: 48.2082, longitude: 16.3738 })).toBe(false);
  });
});

describe("weatherDescription", () => {
  it("translates common WMO weather codes", () => {
    expect(weatherDescription(0)).toBe("晴朗");
    expect(weatherDescription(61)).toBe("有雨");
    expect(weatherDescription(71)).toBe("下雪");
  });
});
