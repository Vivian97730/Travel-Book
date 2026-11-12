import { isRecord, type ForeignExpenseCurrency } from "../../../../../packages/contracts/src/index.ts";

export interface OfficialRate {
  rate: string;
  source: string;
  sourceDate: string;
}

export async function fetchOfficialRate(
  currency: ForeignExpenseCurrency, requestedDate: string, fetcher: typeof fetch = fetch,
): Promise<OfficialRate | null> {
  const start = new Date(`${requestedDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 14);
  const from = start.toISOString().slice(0, 10);
  const query = new URLSearchParams({ base: currency, quotes: "TWD", from, to: requestedDate });
  const response = await fetcher(`https://api.frankfurter.dev/v2/rates?${query}`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("RATE_PROVIDER_UNAVAILABLE");
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("RATE_PROVIDER_INVALID_RESPONSE");

  let latest: OfficialRate | null = null;
  for (const row of body) {
    if (!isRecord(row) || row.base !== currency || row.quote !== "TWD"
      || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
      || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date
      || row.date < from || row.date > requestedDate
      || typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0) continue;

    if (!latest || row.date > latest.sourceDate) {
      const rate = row.rate.toFixed(12).replace(/\.?0+$/, "");
      if (/^\d+(?:\.\d+)?$/.test(rate) && rate !== "0") {
        latest = { rate, source: "FRANKFURTER_V2", sourceDate: row.date };
      }
    }
  }
  return latest;
}
