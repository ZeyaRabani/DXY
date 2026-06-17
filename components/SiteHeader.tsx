"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const V1_TABS = [
  { href: "/v1", label: "Dashboard" },
  { href: "/v1/data", label: "Data" },
  { href: "/v1/patterns", label: "Patterns" },
  { href: "/v1/methodology", label: "Methodology" },
];

const V2_TABS = [
  { href: "/v2", label: "Dashboard" },
  { href: "/v2/data", label: "Data" },
  { href: "/v2/patterns", label: "Patterns" },
  { href: "/v2/ai", label: "AI Assistant" },
  { href: "/v2/methodology", label: "Methodology" },
];

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const version = pathname.startsWith("/v2") ? "v2" : pathname.startsWith("/v1") ? "v1" : null;
  const tabs = version === "v2" ? V2_TABS : version === "v1" ? V1_TABS : [];

  const isActive = (href: string) =>
    href === `/${version}` ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
          DXY Research
        </Link>

        {version && (
          <div className="flex items-center rounded-md border border-border bg-panel p-0.5 text-xs">
            <Link
              href="/v1"
              className={`rounded px-2 py-1 ${version === "v1" ? "bg-panel-2 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              V1
            </Link>
            <Link
              href="/v2"
              className={`rounded px-2 py-1 ${version === "v2" ? "bg-panel-2 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              V2
            </Link>
          </div>
        )}

        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${
                isActive(t.href)
                  ? "bg-panel text-foreground"
                  : "text-muted hover:bg-panel hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
