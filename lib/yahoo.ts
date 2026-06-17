import "server-only";

// Yahoo Finance chart API. No key required; a browser-like User-Agent avoids
// the occasional 403. We only use the daily (interval=1d) series.
const UA =
  "Mozilla/5.0 (compatible; DXYResearchBot/1.0; +https://github.com/ZeyaRabani/DXY)";

export interface YahooBar {
  date: string; // YYYY-MM-DD in the exchange's calendar
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooSeries {
  bars: YahooBar[];
  gmtoffset: number; // seconds
  timezone: string;
}

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

async function fetchChart(symbol: string, range: string): Promise<YahooSeries> {
  let lastErr: unknown = null;
  for (const host of HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${range}&interval=1d`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error(`Yahoo ${symbol}: empty result`);
      const meta = result.meta ?? {};
      const gmtoffset: number = meta.gmtoffset ?? 0;
      const ts: number[] = result.timestamp ?? [];
      const q = result.indicators?.quote?.[0] ?? {};
      const bars: YahooBar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i];
        const h = q.high?.[i];
        const l = q.low?.[i];
        const c = q.close?.[i];
        if (o == null || h == null || l == null || c == null) continue;
        const date = new Date((ts[i] + gmtoffset) * 1000)
          .toISOString()
          .slice(0, 10);
        bars.push({
          date,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: q.volume?.[i] ?? 0,
        });
      }
      return { bars, gmtoffset, timezone: meta.timezone ?? "America/New_York" };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Yahoo ${symbol}: failed`);
}

export function fetchDxy(range = "6mo"): Promise<YahooSeries> {
  return fetchChart("DX-Y.NYB", range);
}

export function fetchUup(range = "6mo"): Promise<YahooSeries> {
  return fetchChart("UUP", range);
}
