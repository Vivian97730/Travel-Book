import type { TripDay } from "@travel-book/contracts";
import type { ItineraryRepository } from "./itineraryRepository";

export class FakeItineraryRepository implements ItineraryRepository {
  private readonly days: Map<string, TripDay>;

  constructor(days: readonly TripDay[]) {
    this.days = new Map(days.map((day) => [day.date, structuredClone(day)]));
  }

  async getDay(date: string): Promise<TripDay> {
    const day = this.days.get(date);
    if (!day) throw new Error("RESOURCE_NOT_FOUND");
    return structuredClone(day);
  }
}
