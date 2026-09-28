"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/upload", label: "Upload" },
  { href: "/rubric", label: "Rubric", desktopOnly: true },
];

export function NavLinks() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="flex items-center gap-0.5 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/c/") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`${"desktopOnly" in l ? "hidden sm:inline-flex " : ""}rounded-full px-3 py-1.5 font-medium transition ${
              active ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
