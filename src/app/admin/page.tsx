import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { EA } from "@/lib/design";
import { SvgBlob } from "@/components/ui/blob";
import { AdminClient } from "./AdminClient";
import { AdminLoginForm } from "./AdminLoginForm";
import type { LeaderboardEntry } from "@/types/database";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuth = cookieStore.get("ea_admin")?.value === process.env.ADMIN_SECRET;

  if (!isAuth) {
    return <AdminLoginForm />;
  }

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("leaderboard_with_pseudo")
    .select("*")
    .order("pseudo", { ascending: true });

  const players = (rows ?? []) as LeaderboardEntry[];

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.2,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />
      <SvgBlob color={EA.pink} style={{ width: 400, height: 360, top: -120, right: -100, opacity: 0.5, animation: "ea-float 7s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 680, margin: "0 auto", padding: "40px 24px 100px" }}>
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 2 }}>
              ADMIN
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
              GESTION JOUEURS
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
              {players.length} joueur{players.length !== 1 ? "s" : ""} · supprimer recalcule le leaderboard des adversaires
            </div>
          </div>
          <form action={async () => {
            "use server";
            const store = await cookies();
            store.delete("ea_admin");
          }}>
            <style>{`
              .ea-admin-logout { transition: transform .1s, box-shadow .1s; }
              .ea-admin-logout:hover { transform: translate(3px,3px); box-shadow: none !important; }
            `}</style>
            <button
              type="submit"
              title="Déconnexion"
              className="ea-admin-logout"
              style={{
                marginTop: 8,
                width: 44, height: 44,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,30,140,0.12)",
                border: `2.5px solid ${EA.pink}`,
                borderRadius: "50%",
                boxShadow: `3px 3px 0 ${EA.ink}`,
                cursor: "pointer",
                color: EA.pink,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </button>
          </form>
        </div>

        <AdminClient
          players={players.map((p) => ({
            id: p.player_id,
            pseudo: p.pseudo,
            wins: p.wins,
            losses: p.losses,
            draws: p.draws,
            points: p.points,
          }))}
        />
      </div>
    </div>
  );
}
