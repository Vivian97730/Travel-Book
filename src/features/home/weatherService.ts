import type { WeatherSnapshot } from "./types";

export interface WeatherPosition {
  latitude: number;
  longitude: number;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface WeatherDependencies {
  getPosition?: () => Promise<WeatherPosition>;
  fetcher?: Fetcher;
  now?: () => Date;
}

interface ReverseGeocodeResponse {
  countryCode?: string;
  locality?: string;
  city?: string;
  principalSubdivision?: string;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    time?: string;
  };
}

export function isInTaiwan({ latitude, longitude }: WeatherPosition): boolean {
  return latitude >= 21.7 && latitude <= 25.5 && longitude >= 119.2 && longitude <= 122.2;
}

function getBrowserPosition(): Promise<WeatherPosition> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("此裝置不支援定位。"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      reject,
      {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  });
}

function getLocationError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 1) {
    return "定位權限未開啟，無法取得目前天氣。";
  }
  return "目前無法取得定位或天氣，其他旅程資訊仍可使用。";
}

export async function loadCurrentWeather({
  getPosition = getBrowserPosition,
  fetcher = fetch,
  now = () => new Date(),
}: WeatherDependencies = {}): Promise<WeatherSnapshot> {
  try {
    const { latitude, longitude } = await getPosition();
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
    });

    const [weatherResponse, placeResponse] = await Promise.all([
      fetcher(`https://api.open-meteo.com/v1/forecast?${query}&current=temperature_2m,weather_code&timezone=auto`),
      fetcher(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}&localityLanguage=zh-TW`).catch(() => null),
    ]);

    if (!weatherResponse.ok) throw new Error("WEATHER_UNAVAILABLE");
    const weather = (await weatherResponse.json()) as OpenMeteoResponse;
    const current = weather.current;
    if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") {
      throw new Error("INVALID_WEATHER_RESPONSE");
    }

    let place: ReverseGeocodeResponse = {};
    if (placeResponse?.ok) {
      place = await placeResponse.json().catch(() => ({})) as ReverseGeocodeResponse;
    }
    const countryCode = place.countryCode?.toUpperCase() || null;
    const inTaiwan = countryCode ? countryCode === "TW" : isInTaiwan({ latitude, longitude });

    return {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      placeLabel: place.locality || place.city || place.principalSubdivision || "目前位置",
      countryCode: countryCode || (inTaiwan ? "TW" : null),
      inTaiwan,
      updatedAt: current.time || now().toISOString(),
      source: "Open-Meteo",
    };
  } catch (error) {
    throw new Error(getLocationError(error));
  }
}

export function weatherDescription(code: number): string {
  if (code === 0) return "晴朗";
  if (code <= 3) return "多雲";
  if (code === 45 || code === 48) return "有霧";
  if (code <= 67 || (code >= 80 && code <= 82)) return "有雨";
  if (code <= 77 || (code >= 85 && code <= 86)) return "下雪";
  if (code >= 95) return "雷雨";
  return "天氣狀態未知";
}
