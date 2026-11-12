import { describe, expect, it, vi } from "vitest";
import { fetchOfficialRate } from "./officialRates";
import { RatesService, type RateCache } from "./ratesService";
import type { ExchangeRateSnapshot } from "../../../../../packages/contracts/src/index";

describe("Frankfurter exchange rates", () => {
  it.each([["EUR", 37.038], ["HUF", 0.10177]] as const)(
    "requests %s without credentials and selects the latest eligible TWD rate",
    async (currency, rate) => {
      const fetcher = vi.fn(async () => Response.json([
        { date: "2026-05-04", base: currency, quote: "TWD", rate },
        { date: "2026-05-06", base: currency, quote: "TWD", rate: 1 },
        { date: "2026-05-05", base: currency, quote: "USD", rate: 1 },
        { date: "2026-05-05", base: currency, quote: "TWD", rate: -1 },
        { date: "2026-05-03", base: currency, quote: "TWD", rate: 2 },
      ]));
      await expect(fetchOfficialRate(currency, "2026-05-05", fetcher)).resolves.toEqual({
        rate: String(rate), sourceDate: "2026-05-04", source: "FRANKFURTER_V2",
      });
      expect(fetcher).toHaveBeenCalledWith(
        `https://api.frankfurter.dev/v2/rates?base=${currency}&quotes=TWD&from=2026-04-21&to=2026-05-05`,
        { signal: expect.any(AbortSignal) },
      );
    },
  );

  it("returns no snapshot if the date range has no valid data", async () => {
    await expect(fetchOfficialRate("EUR", "2026-05-05", async () => Response.json([]))).resolves.toBeNull();
  });

  it("treats an upstream HTTP failure as unavailable", async () => {
    await expect(fetchOfficialRate("EUR", "2026-05-05", async () =>
      new Response(null, { status: 503 }))).rejects.toThrow("RATE_PROVIDER_UNAVAILABLE");
  });
});

const snapshot: ExchangeRateSnapshot = {
  id: "11111111-1111-4111-8111-111111111111", baseCurrency: "EUR", quoteCurrency: "TWD",
  rate: "36.36", source: "FRANKFURTER_V2", sourceDate: "2026-10-30",
  fetchedAt: "2026-11-12T00:00:00Z", formulaVersion: 2,
};
const now = () => new Date("2026-11-11T16:30:00Z");

describe("rates service", () => {
  it("reuses a successful snapshot for parallel and later requests", async () => {
    let loading = false;
    let cached: ExchangeRateSnapshot | null = null;
    const cache: RateCache = {
      claim: async () => {
        if (cached) return { snapshot: cached };
        if (loading) return { claimed: false };
        loading = true;
        return { claimed: true };
      },
      finish: async () => cached = snapshot,
    };
    const provider = vi.fn(async () => ({ rate: snapshot.rate, source: snapshot.source, sourceDate: snapshot.sourceDate }));
    const service = new RatesService(cache, provider, now);
    const otherInstance = new RatesService(cache, provider, now);
    const [first, second] = await Promise.all([service.getRate("EUR", "2026-11-01"), otherInstance.getRate("EUR", "2026-11-01")]);
    expect(first).toEqual(second);
    expect(first.snapshot).toEqual(snapshot);
    expect((await service.getRate("EUR", "2026-11-01")).snapshot).toEqual(snapshot);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("returns a nullable rate on provider failure and skips cache for TWD", async () => {
    const cache = { claim: vi.fn(async () => ({ claimed: true })), finish: vi.fn(async () => null) };
    const service = new RatesService(cache, async () => { throw new Error("Provider offline"); }, now);
    await expect(service.getRate("TWD", "2026-11-12")).resolves.toMatchObject({ rate: "1", snapshot: null });
    expect(cache.claim).not.toHaveBeenCalled();
    await expect(service.getRate("EUR", "2026-11-12")).resolves.toMatchObject({ rate: null, snapshot: null });
    expect(cache.finish).toHaveBeenCalledWith("EUR", "2026-11-12", 2, expect.any(String), null);
  });

  it("uses the latest published rate for a future expense and shares today's lookup", async () => {
    let cached: ExchangeRateSnapshot | null = null;
    const cache: RateCache = {
      claim: vi.fn(async () => cached ? { snapshot: cached } : { claimed: true }),
      finish: vi.fn(async () => cached = snapshot),
    };
    const provider = vi.fn(async () => ({ rate: snapshot.rate, source: snapshot.source, sourceDate: snapshot.sourceDate }));
    const service = new RatesService(cache, provider, now);
    await expect(service.getRate("EUR", "2027-02-05")).resolves.toEqual({
      currency: "EUR", date: "2027-02-05", rate: snapshot.rate, snapshot,
    });
    await expect(service.getRate("EUR", "2026-11-12")).resolves.toMatchObject({ snapshot });
    expect(provider).toHaveBeenCalledExactlyOnceWith("EUR", "2026-11-12");
    expect(cache.claim).toHaveBeenCalledWith("EUR", "2026-11-12", 2, expect.any(String));
  });
});
