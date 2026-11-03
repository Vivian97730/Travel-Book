export type FactIcon = "globe" | "exchange" | "plug" | "water" | "info";

export interface TravelFact {
  id: string;
  icon: FactIcon;
  title: string;
  content: string;
  sortOrder: number;
}

export interface FlightLeg {
  airport: string;
  city: string;
  time: string;
  dayOffset?: number;
}

export interface FlightSummary {
  direction: "去程" | "回程";
  duration: string;
  legs: FlightLeg[];
}

export interface TripHome {
  title: string;
  subtitle: string;
  dateLabel: string;
  durationLabel: string;
  travelerCount: number;
  version: number;
  flights: FlightSummary[];
  facts: TravelFact[];
}

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
