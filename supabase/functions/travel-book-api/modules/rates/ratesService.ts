import type { ExchangeRateSnapshot, ExpenseCurrency, ForeignExpenseCurrency } from "../../../../../packages/contracts/src/index.ts";
import type { OfficialRate } from "./officialRates.ts";

export type RateClaim = { snapshot: ExchangeRateSnapshot } | { claimed: boolean };

export interface RateCache {
  claim(currency: ForeignExpenseCurrency, date: string, version: number, lease: string): Promise<RateClaim>;
  finish(currency: ForeignExpenseCurrency, date: string, version: number, lease: string, rate: OfficialRate | null): Promise<ExchangeRateSnapshot | null>;
}

type RateProvider = (currency: ForeignExpenseCurrency, date: string) => Promise<OfficialRate | null>;

const formulaVersion = 2;
const taipeiDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" });

export function isRateRequestDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith("0000-")
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

export function isRateRequestCurrency(currency: string): currency is ExpenseCurrency {
  return currency === "TWD" || currency === "EUR" || currency === "HUF";
}

export class RatesService {
  constructor(
    private readonly cache: RateCache,
    private readonly provider: RateProvider,
    private readonly now = () => new Date(),
  ) {}

  async getRate(currency: ExpenseCurrency, date: string) {
    if (currency === "TWD") return { currency, date, rate: "1", snapshot: null };
    const snapshot = date > taipeiDate.format(this.now()) ? null : await this.getSnapshot(currency, date);
    return { currency, date, rate: snapshot?.rate ?? null, snapshot };
  }

  private async getSnapshot(currency: ForeignExpenseCurrency, date: string) {
    const lease = crypto.randomUUID();
    const deadline = Date.now() + 11_000;
    do {
      const claim = await this.cache.claim(currency, date, formulaVersion, lease);
      if ("snapshot" in claim) return claim.snapshot;
      if (claim.claimed) {
        const result = await this.provider(currency, date).catch(() => null);
        return this.cache.finish(currency, date, formulaVersion, lease, result);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    } while (Date.now() < deadline);
    return null;
  }
}
