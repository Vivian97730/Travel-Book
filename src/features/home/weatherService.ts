import type { WeatherSnapshot } from "./types";

interface Position {
  latitude: number;
  longitude: number;
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

export function isInTaiwan({ latitude, longitude }: Position): boolean {
  return latitude >= 21.7 && latitude <= 25.5 && longitude >= 119.2 && longitude <= 122.2;
}

function getPosition(): Promise<GeolocationPosition> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("此裝置不支援定位。"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 10_000,
    });
  });
}

function getLocationError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 1) {
    return "定位權限未開啟，無法取得目前天氣。";
  }
  return "目前無法取得定位或天氣，其他旅程資訊仍可使用。";
}

export async function loadCurrentWeather(): Promise<WeatherSnapshot> {
  try {
    const position = await getPosition();
    const { latitude, longitude } = position.coords;
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
    });

    const [weatherResponse, placeResponse] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${query}&current=temperature_2m,weather_code&timezone=auto`),
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}&localityLanguage=zh-TW`),
    ]);

    if (!weatherResponse.ok) throw new Error("WEATHER_UNAVAILABLE");
    const weather = (await weatherResponse.json()) as OpenMeteoResponse;
    const current = weather.current;
    if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") {
      throw new Error("INVALID_WEATHER_RESPONSE");
    }

    let place: ReverseGeocodeResponse = {};
    if (placeResponse.ok) place = (await placeResponse.json()) as ReverseGeocodeResponse;

    return {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      placeLabel: place.locality || place.city || place.principalSubdivision || "目前位置",
      countryCode: place.countryCode?.toUpperCase() || (isInTaiwan({ latitude, longitude }) ? "TW" : null),
      updatedAt: current.time || new Date().toISOString(),
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
