export const routeNames = ["home", "itinerary", "stays", "expenses", "lists"] as const;

export type Route = (typeof routeNames)[number];

export function routeFromHash(hash: string): Route {
  const candidate = hash.replace(/^#\/?/, "") as Route;
  return routeNames.includes(candidate) ? candidate : "itinerary";
}

export function hashForRoute(route: Route): string {
  return `#/${route}`;
}
