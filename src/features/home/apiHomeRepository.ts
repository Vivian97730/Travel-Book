import type { TravelFact, TripHome } from "@travel-book/contracts";
import { ApiClient } from "../../shared/api/apiClient";
import type { HomeRepository } from "./homeRepository";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiHomeRepository implements HomeRepository {
  private readonly client: ApiClient;

  constructor(baseUrl: string, private readonly accessToken: string, fetcher: Fetcher = fetch) {
    this.client = new ApiClient(baseUrl, fetcher);
  }

  getTripHome(): Promise<TripHome> {
    return this.client.getTripHome(this.accessToken);
  }

  async saveTravelFacts(_facts: TravelFact[], _expectedVersion: number): Promise<TripHome> {
    throw new Error("HOME_FACTS_WRITE_NOT_AVAILABLE");
  }
}
