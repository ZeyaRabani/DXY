import Link from "next/link";

const VERSIONS = [
  {
    href: "/v1",
    tag: "V1",
    title: "Original Dashboard",
    desc: "The original single-table DXY view: latest daily candle, daily/weekly/monthly close bias, a filterable history table, and basic pattern stats.",
    points: [
      "Latest daily row + close bias",
      "Filter by date, weekday, closes, event week",
      "Basic weekday & event pattern stats",
    ],
  },
  {
    href: "/v2",
    tag: "V2",
    title: "Expanded Research + AI",
    desc: "Separate daily / weekly / monthly datasets with richer fields, weekly pattern studies, CPI/NFP/normal-week comparisons, UUP volume proxy, and a natural-language research assistant.",
    points: [
      "Daily, weekly & monthly datasets",
      "Weekly pattern stats + event-week comparison",
      "AI assistant — ask in plain English",
    ],
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          US Dollar Index (DXY) research
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          A public research workspace for studying historical DXY behaviour —
          daily, weekly and monthly close bias and repeating calendar patterns.
          Data runs from 1986 to today, sourced from Yahoo Finance and refreshed
          after each New York close. Pick a version to begin.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {VERSIONS.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            className="group flex flex-col rounded-xl border border-border bg-panel p-5 transition-colors hover:border-accent/60 hover:bg-panel-2"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                {v.tag}
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{v.title}</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{v.desc}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {v.points.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent">
              Open {v.tag}
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted">
        DXY OHLC source: Yahoo Finance (DX-Y.NYB) · Volume source: UUP ETF proxy ·
        CPI/NFP event dates: estimated
      </p>
    </div>
  );
}
