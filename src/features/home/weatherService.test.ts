import { describe, expect, it, vi } from "vitest";
import { isInTaiwan, loadCurrentWeather, weatherDescription, type WeatherPosition } from "./weatherService";

function successfulFetcher(countryCode: string | null, placeLabel: string) {
  return vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async (input) => {
    if (input.startsWith("https://api.open-meteo.com/")) {
      return Response.json({
        current: {
          temperature_2m: 6.4,
          weather_code: 2,
          time: "2027-02-01T12:00",
        },
      });
    }
    return Response.json({ countryCode, locality: placeLabel });
  });
}

async function loadAt(position: WeatherPosition, countryCode: string | null, placeLabel: string) {
  const getPosition = vi.fn(async () => position);
  const fetcher = successfulFetcher(countryCode, placeLabel);
  const snapshot = await loadCurrentWeather({ getPosition, fetcher });
  return { fetcher, getPosition, snapshot };
}

describe("isInTaiwan", () => {
  it("recognizes a coordinate in Taipei", () => {
    expect(isInTaiwan({ latitude: 25.033, longitude: 121.5654 })).toBe(true);
  });

  it("does not classify Vienna as Taiwan", () => {
    expect(isInTaiwan({ latitude: 48.2082, longitude: 16.3738 })).toBe(false);
  });
});

describe("loadCurrentWeather", () => {
  it("requests location once and returns a Taiwan weather snapshot", async () => {
    const { fetcher, getPosition, snapshot } = await loadAt(
      { latitude: 25.033, longitude: 121.5654 },
      "tw",
      "臺北",
    );

    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(snapshot).toMatchObject({
      temperature: 6.4,
      weatherCode: 2,
      placeLabel: "臺北",
      countryCode: "TW",
      inTaiwan: true,
      source: "Open-Meteo",
    });
  });

  it("marks a resolved location outside Taiwan", async () => {
    const { snapshot } = await loadAt(
      { latitude: 48.2082, longitude: 16.3738 },
      "AT",
      "維也納",
    );

    expect(snapshot).toMatchObject({ placeLabel: "維也納", countryCode: "AT", inTaiwan: false });
  });

  it("keeps weather available when reverse geocoding fails", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async (input) => {
      if (input.startsWith("https://api.open-meteo.com/")) {
        return Response.json({ current: { temperature_2m: 3, weather_code: 1 } });
      }
      throw new Error("REVERSE_GEOCODE_UNAVAILABLE");
    });

    const snapshot = await loadCurrentWeather({
      getPosition: async () => ({ latitude: 48.2082, longitude: 16.3738 }),
      fetcher,
      now: () => new Date("2027-02-01T00:00:00Z"),
    });

    expect(snapshot).toMatchObject({
      placeLabel: "目前位置",
      countryCode: null,
      inTaiwan: false,
      updatedAt: "2027-02-01T00:00:00.000Z",
    });
  });

  it.each([
    ["permission denied", { code: 1 }, "定位權限未開啟，無法取得目前天氣。"],
    ["position timeout", { code: 3 }, "目前無法取得定位或天氣，其他旅程資訊仍可使用。"],
  ])("returns a stable message for %s", async (_label, error, message) => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

    await expect(loadCurrentWeather({
      getPosition: async () => { throw error; },
      fetcher,
    })).rejects.toThrow(message);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a stable failure when the weather service is unavailable", async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 503 }));

    await expect(loadCurrentWeather({
      getPosition: async () => ({ latitude: 25.033, longitude: 121.5654 }),
      fetcher,
    })).rejects.toThrow("目前無法取得定位或天氣，其他旅程資訊仍可使用。");
  });

  it("sends coordinates only to the two public adapters and never returns or logs them", async () => {
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    const { fetcher, snapshot } = await loadAt(
      { latitude: 25.033, longitude: 121.5654 },
      "TW",
      "臺北",
    );

    const requestedHosts = fetcher.mock.calls.map(([input]) => new URL(input).hostname);
    expect(requestedHosts).toEqual(["api.open-meteo.com", "api.bigdatacloud.net"]);
    expect(snapshot).not.toHaveProperty("latitude");
    expect(snapshot).not.toHaveProperty("longitude");
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    for (const spy of consoleSpies) spy.mockRestore();
  });
});

describe("weatherDescription", () => {
  it("translates common WMO weather codes", () => {
    expect(weatherDescription(0)).toBe("晴朗");
    expect(weatherDescription(61)).toBe("有雨");
    expect(weatherDescription(71)).toBe("下雪");
  });
});
