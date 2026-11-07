import type { SaveTripDayItem, TripDay } from "@travel-book/contracts";
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

  async saveDayItems(date: string, items: readonly SaveTripDayItem[], expectedVersion: number): Promise<TripDay> {
    const current = this.days.get(date);
    if (!current) throw new Error("RESOURCE_NOT_FOUND");
    if (current.version !== expectedVersion) throw new Error("VERSION_CONFLICT");

    const placesByItemId = new Map(current.items.map((item) => [item.id, item.place]));
    const saved: TripDay = {
      ...current,
      version: current.version + 1,
      items: items.map((item) => ({ ...item, place: structuredClone(placesByItemId.get(item.id) ?? null) })),
    };
    this.days.set(date, structuredClone(saved));
    return structuredClone(saved);
  }
}
