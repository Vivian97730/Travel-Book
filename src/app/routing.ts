export const routes = ["home", "itinerary", "stays", "expenses", "lists"] as const;
export type Route = (typeof routes)[number];

export type ParsedAppHash =
  | { kind: "route"; route: Route }
  | { kind: "access"; token: string };

export function parseAppHash(hash: string): ParsedAppHash {
  const accessMatch = /^#\/access\/([A-Za-z0-9._~-]+)$/.exec(hash);
  if (accessMatch) return { kind: "access", token: accessMatch[1] };

  const candidate = hash.replace(/^#\/?/, "") as Route;
  return { kind: "route", route: routes.includes(candidate) ? candidate : "itinerary" };
}

export function hashForRoute(route: Route): string {
  return `#/${route}`;
}
