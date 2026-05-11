import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { EA } from "@/lib/design";

export default async function GamesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div style={{ minHeight: "100dvh", background: EA.violet, position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)", backgroundSize: "16px 16px" }} />

      <div style={{ position: "relative", zIndex: 5, maxWidth: 560, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <Link href="/lobby" style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)", border: `2.5px solid ${EA.ink}`,
            color: EA.white, display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none", fontSize: 18, fontFamily: "var(--font-display)",
            boxShadow: `2px 2px 0 ${EA.ink}`, flexShrink: 0,
          }}>←</Link>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
              Expression Arena
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1 }}>
              LES JEUX
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* PFC */}
          <GameCard
            icon="✊✋✌"
            title="Pierre Feuille Ciseaux"
            tag="Réflexes"
            tagColor={EA.cyan}
            borderColor={EA.cyan}
            shadowColor={EA.pink}
            rules={[
              { icon: "🤝", text: "Les deux joueurs choisissent simultanément : Pierre, Feuille ou Ciseaux" },
              { icon: "⚔", text: "Pierre écrase Ciseaux · Ciseaux coupe Feuille · Feuille enveloppe Pierre" },
              { icon: "🔄", text: "Choix identiques = manche nulle, on rejoue" },
              { icon: "🏆", text: "Premier à 2 victoires de manche gagne le match (max 3 manches)" },
              { icon: "🤝", text: "Si 1-1 après 3 manches : match nul" },
            ]}
          />

          {/* Morpion */}
          <GameCard
            icon="⨯⭕⨯"
            title="Morpion"
            tag="Tactique"
            tagColor={EA.pink}
            borderColor={EA.pink}
            shadowColor={EA.butter}
            rules={[
              { icon: "📐", text: "Grille 3×3 — le challenger joue × en premier" },
              { icon: "🔄", text: "Tour par tour : clique sur une case vide pour placer ton symbole" },
              { icon: "🏆", text: "Premier à aligner 3 symboles (horizontal, vertical ou diagonal) gagne" },
              { icon: "🤝", text: "Toutes les cases remplies sans alignement = match nul" },
            ]}
          />

          {/* Puissance 4 */}
          <GameCard
            icon="🔴🟡🔴"
            title="Puissance 4"
            tag="Stratégie"
            tagColor={EA.butter}
            borderColor={EA.butter}
            shadowColor={EA.cyan}
            rules={[
              { icon: "📐", text: "Grille 7 colonnes × 6 lignes — le challenger joue en premier" },
              { icon: "⬇", text: "Tour par tour : clique sur une colonne, ton jeton tombe en bas" },
              { icon: "🏆", text: "Premier à aligner 4 jetons (horizontal, vertical ou diagonal) gagne" },
              { icon: "🤝", text: "Grille pleine sans alignement = match nul" },
            ]}
          />

          {/* Points */}
          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 20, padding: "16px 18px",
            boxShadow: `3px 3px 0 ${EA.ink}`,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
              Système de points
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "Victoire", pts: "+3", color: EA.cyan },
                { label: "Match nul", pts: "+1", color: EA.butter },
                { label: "Défaite", pts: "+0", color: "rgba(255,255,255,0.35)" },
              ].map(({ label, pts, color }) => (
                <div key={label} style={{
                  flex: 1, textAlign: "center",
                  background: "rgba(255,255,255,0.05)", border: `1.5px solid rgba(255,255,255,0.12)`,
                  borderRadius: 14, padding: "10px 8px",
                }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color, transform: "skewX(-4deg)", lineHeight: 1 }}>{pts}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameCard({ icon, title, tag, tagColor, borderColor, shadowColor, rules }: {
  icon: string;
  title: string;
  tag: string;
  tagColor: string;
  borderColor: string;
  shadowColor: string;
  rules: { icon: string; text: string }[];
}) {
  return (
    <div style={{
      background: EA.violetDeep,
      border: `2.5px solid ${borderColor}`,
      borderRadius: 22,
      padding: "16px 18px",
      boxShadow: `4px 4px 0 ${shadowColor}, 4px 4px 0 1px ${EA.ink}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{title.toUpperCase()}</div>
          <span style={{
            display: "inline-block", marginTop: 4,
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: tagColor, background: `${tagColor}22`,
            border: `1.5px solid ${tagColor}`, borderRadius: 999,
            padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.8,
          }}>{tag}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rules.map(({ icon: rIcon, text }, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{rIcon}</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
