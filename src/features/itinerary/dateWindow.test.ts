import { describe, expect, it } from "vitest";
import { buildDateWindow, chooseDefaultDate } from "./dateWindow";

const startDate = "2027-02-05";
const endDate = "2027-02-15";

describe("itinerary date window", () => {
  it.each([
    ["2027-01-01", "2027-02-05"],
    ["2027-02-10", "2027-02-10"],
    ["2027-03-01", "2027-02-15"],
  ])("selects the appropriate trip day for %s", (today, expected) => {
    expect(chooseDefaultDate(today, startDate, endDate)).toBe(expected);
  });

  it("shows no more than five days and keeps the selected date visible", () => {
    expect(buildDateWindow(startDate, endDate, "2027-02-10")).toEqual([
      "2027-02-08",
      "2027-02-09",
      "2027-02-10",
      "2027-02-11",
      "2027-02-12",
    ]);
    expect(buildDateWindow(startDate, endDate, "2027-02-15")).toEqual([
      "2027-02-11",
      "2027-02-12",
      "2027-02-13",
      "2027-02-14",
      "2027-02-15",
    ]);
  });
});
