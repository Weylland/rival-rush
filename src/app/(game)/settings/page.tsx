import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { EA } from "@/lib/design";
import { ScreenBg } from "@/components/ui/screen-bg";
import { SvgBlob } from "@/components/ui/blob";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden" }}>
      <ScreenBg />
      <SvgBlob color={EA.cyan} style={{ width: 380, height: 340, top: -140, left: -100, opacity: 0.4, animation: "ea-float 8s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 300, height: 280, bottom: -120, right: -80, opacity: 0.3, animation: "ea-float 10s ease-in-out infinite reverse" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <Link
            href="/lobby"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: `2px solid ${EA.ink}`,
              color: EA.white, textDecoration: "none", fontSize: 18,
              boxShadow: `2px 2px 0 ${EA.ink}`,
              flexShrink: 0,
            }}
          >
            ←
          </Link>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
              Compte
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1 }}>
              SETTINGS
            </div>
          </div>
        </div>

        <SettingsClient initialPseudo={session.pseudo} initialAvatarUrl={session.avatarUrl} isGuest={session.isGuest} />
      </div>
    </div>
  );
}
