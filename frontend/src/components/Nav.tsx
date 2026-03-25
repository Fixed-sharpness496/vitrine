"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/clusters", label: "Clusters" },
  { href: "/intent", label: "Intent" },
  { href: "/quality", label: "Quality" },
];

const LOOKER_URL = "https://lookerstudio.google.com/reporting/1bc6db02-16eb-468b-a6df-57928fddcaba";

export default function Nav() {
  const path = usePathname();

  return (
    <nav
      style={{ borderBottom: "1px solid var(--border)" }}
      className="sticky top-0 z-50"
      aria-label="Main navigation"
    >
      <div
        style={{ background: "var(--bg)" }}
        className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between"
      >
        {/* Brand */}
        <Link
          href="/"
          className="label-caps"
          style={{ color: "var(--text)", letterSpacing: "0.2em" }}
        >
          Vitrine
        </Link>

        {/* Links */}
        <ul className="flex items-center gap-8 list-none">
          {LINKS.map(({ href, label }) => {
            const active =
              href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="label-caps transition-colors"
                  style={{
                    color: active ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <a
              href={LOOKER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="label-caps transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Looker ↗
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
