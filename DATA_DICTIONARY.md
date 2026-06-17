# DXY Data Handoff

## Files

- `data/v1/dxy_daily_v1.csv`
  - Original daily dashboard data.
  - 10,333 rows.
  - Coverage: 1986-01-01 to 2026-06-16.

- `data/v2/dxy_daily_v2.csv`
  - Enriched daily data.
  - 10,333 rows.
  - Coverage: 1986-01-01 to 2026-06-16.

- `data/v2/dxy_weekly_v2.csv`
  - One row per ISO week.
  - 2,112 rows.
  - Coverage: 1986-01-01 to 2026-06-16.

- `data/v2/dxy_monthly_v2.csv`
  - One row per calendar month.
  - 486 rows.
  - Coverage: 1986-01-01 to 2026-06-16.

## Sources

- DXY OHLC: Yahoo Finance chart endpoint, symbol `DX-Y.NYB`.
- Volume proxy: Yahoo Finance chart endpoint, symbol `UUP`.
- CPI/NFP labels: estimated week-level rules.

## Important Notes

- DXY index volume from Yahoo is `0`, so V2 uses `UUP` ETF volume as a no-key proxy.
- UUP did not exist for the oldest data, so early proxy-volume rows can be `0`.
- CPI/NFP dates are estimated, not exact official historical release timestamps.
- `ToH`, `ToL`, and exact news labels are intentionally excluded.

## Key V2 Concepts

- `d_close`, `w_close`, `m_close`: bullish/bearish candle direction.
- `wh`, `wl`: weekday of weekly high/low.
- `*_range_bucket`: broad range bucket for safer statistical filtering.
- `body_points`, `upper_wick_points`, `lower_wick_points`: candle-shape fields.
- `close_position_pct`: close location inside the candle range.
- `prev_day_close`, `prev_week_close`, `prev_month_close`: lagged context.
- `event_type`: `normal`, `cpi`, `nfp`, or `both`.

## Expected Example AI Answer

Question:

> What was the weekly close when the high of the week was Monday and the monthly close was bearish?

Expected result from V2 weekly table:

- Matching weeks: 396
- Bullish weekly close: 25
- Bearish weekly close: 371
- Bearish share: 93.69%

Human-style reply:

> I found 396 matching weeks. Out of those, 25 ended bullish and 371 ended bearish. The stronger side was bearish: 371 vs 25, or 93.69% bearish. With a very strong distinction like that, this condition points to a bearish weekly close bias. I would treat it as a bias filter, not a full trade signal by itself.
