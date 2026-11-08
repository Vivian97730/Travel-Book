import { describe, expect, it } from "vitest";
import { formatDepartureCountdown } from "./countdown";

describe("formatDepartureCountdown", () => {
  it("uses the Taipei departure instant", () => {
    expect(formatDepartureCountdown(new Date("2027-02-03T00:00:00+08:00"))).toBe("2 天 0 小時 20 分");
  });

  it("shows the started state after departure", () => {
    expect(formatDepartureCountdown(new Date("2027-02-05T00:20:00+08:00"))).toBe("旅程已開始");
    expect(formatDepartureCountdown(new Date("2027-02-04T16:20:00Z"))).toBe("旅程已開始");
  });

  it("keeps the final minute before departure", () => {
    expect(formatDepartureCountdown(new Date("2027-02-05T00:19:00+08:00"))).toBe("0 天 0 小時 1 分");
  });
});
