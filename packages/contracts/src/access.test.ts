import { describe, expect, it } from "vitest";
import { parseAccessVerifyResponse } from "./access";

describe("access verification contract", () => {
  it("accepts a verified private trip summary", () => {
    expect(parseAccessVerifyResponse({
      trip: {
        id: "11111111-1111-4111-8111-111111111111",
        title: "2027 奧地利・匈牙利之旅",
        startDate: "2027-02-05",
        endDate: "2027-02-15",
        displayTimezone: "Europe/Vienna",
      },
      resourceVersions: { itinerary: 1, home: 2 },
    })).toEqual({
      ok: true,
      value: {
        trip: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "2027 奧地利・匈牙利之旅",
          startDate: "2027-02-05",
          endDate: "2027-02-15",
          displayTimezone: "Europe/Vienna",
        },
        resourceVersions: { itinerary: 1, home: 2 },
      },
    });
  });

  it("rejects an invalid trip date range and version map", () => {
    const result = parseAccessVerifyResponse({
      trip: {
        id: "not-a-uuid",
        title: "",
        startDate: "2027/02/15",
        endDate: "2027-02-05",
        displayTimezone: "",
      },
      resourceVersions: { itinerary: 0 },
    });

    expect(result.ok).toBe(false);
  });
});
