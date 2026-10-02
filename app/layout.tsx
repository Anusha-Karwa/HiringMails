import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { HiringBackdrop, LogoMark } from "@/components/HiringBackdrop";
import { NavLinks } from "@/components/NavLinks";
import { getStore } from "@/lib/store";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Kargo Hire",
  description: "Rank PM and SPM applicants against the pattern in Arjun's best hires. The system recommends; Arjun decides.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4ad1c4",
};

export const dynamic = "force-dynamic";
// Belt and braces: no page may serve a cached database read.
export const fetchCache = "force-no-store";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const memory = getStore().kind === "memory";
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">
        <HiringBackdrop />
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
          <div className="container-page flex items-center justify-between gap-3 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark />
              <span className="hidden whitespace-nowrap font-display text-xl font-semibold text-ink sm:inline">
                Kargo<span className="text-brand-600"> Hire</span>
              </span>
            </Link>
            <NavLinks />
          </div>
        </header>
        {memory && (
          <p className="bg-amber-50 py-1.5 text-center text-xs text-amber-800">
            Demo storage: Supabase isn&apos;t connected, so candidates vanish on restart.
          </p>
        )}
        <main className="container-page flex-1 pb-20 pt-8 sm:pt-10">{children}</main>
        <footer className="border-t border-line bg-white/70">
          <p className="container-page py-5 text-center text-xs text-faint">
            Kargo Hire · The system recommends. Arjun decides. · Names and contact details never reach the AI.
          </p>
        </footer>
      </body>
    </html>
  );
}
