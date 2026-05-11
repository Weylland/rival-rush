import type { Metadata } from "next";
import Link from "next/link";
import { EA } from "@/lib/design";
import { ScreenBg } from "@/components/ui/screen-bg";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact — ExpressionArena",
  description: "Une question, un bug, une idée ? Envoie-moi un message.",
};

export default function ContactPage() {
  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden" }}>
      <ScreenBg />
      <SvgBlob color={EA.pink} style={{ width: 420, height: 380, top: -160, right: -120, opacity: 0.4, animation: "ea-float 7s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 300, height: 280, bottom: -100, left: -80, opacity: 0.3, animation: "ea-float 9s ease-in-out infinite reverse" }} />
      <Star color={EA.cyan} size={32} style={{ top: "18%", left: "6%", animation: "ea-spin-slow 12s linear infinite" }} />
      <Star color={EA.butter} size={20} style={{ bottom: "25%", right: "8%", animation: "ea-float 5s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 620, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <Link
            href="/lobby"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: `2px solid ${EA.ink}`,
              color: EA.white, textDecoration: "none", fontSize: 18,
              boxShadow: `2px 2px 0 ${EA.ink}`, flexShrink: 0,
            }}
          >
            ←
          </Link>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 2 }}>
              ExpressionArena
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.cyan}`, lineHeight: 1 }}>
              CONTACT
            </div>
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 28, lineHeight: 1.6 }}>
          Un bug, une idée d'amélioration, une question sur l'app ?<br />
          Je réponds en général sous 48h.
        </p>

        <ContactForm />

        {/* Footer légal */}
        <div style={{ marginTop: 48, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { href: "/legal/mentions", label: "Mentions légales" },
            { href: "/legal/privacy", label: "Confidentialité" },
            { href: "/legal/cgu", label: "CGU" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", textDecoration: "underline" }}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
