export type { FactIcon, FlightLeg, FlightSummary, TravelFact, TripHome } from "@travel-book/contracts";

export interface WeatherSnapshot {
  temperature: number;
  weatherCode: number;
  placeLabel: string;
  countryCode: string | null;
  updatedAt: string;
  source: string;
}

export type WeatherState =
  | { status: "idle" | "loading" }
  | { status: "ready"; snapshot: WeatherSnapshot }
  | { status: "error"; message: string };
