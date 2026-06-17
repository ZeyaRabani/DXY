export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>DXY OHLC source: Yahoo Finance (DX-Y.NYB)</span>
          <span>Volume source: UUP ETF proxy</span>
          <span>CPI/NFP event dates: estimated</span>
        </div>
        <p className="mt-2 max-w-3xl">
          Research and educational use only. Pattern statistics are historical
          frequencies, not predictions or trading advice. Daily data updates
          after the New York close.
        </p>
      </div>
    </footer>
  );
}
