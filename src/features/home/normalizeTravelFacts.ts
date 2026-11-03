import type { TravelFact } from "./types";

export function normalizeTravelFacts(facts: TravelFact[]): TravelFact[] {
  return facts.map((fact, index) => ({
    ...fact,
    title: fact.title.trim(),
    content: fact.content.trim(),
    sortOrder: index,
  }));
}
