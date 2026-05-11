import type { ReactNode } from "react";
import Link from "next/link";
import { EA } from "@/lib/design";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: EA.violetDeep, color: EA.white }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/lobby"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(255,255,255,0.4)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Retour
          </Link>
        </div>
        {children}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid rgba(255,255,255,0.1)`, display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link href="/legal/mentions" style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}>Mentions légales</Link>
          <Link href="/legal/privacy" style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}>Confidentialité</Link>
          <Link href="/legal/cgu" style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}>CGU</Link>
          <Link href="/contact" style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}>Contact</Link>
        </div>
      </div>
    </div>
  );
}
