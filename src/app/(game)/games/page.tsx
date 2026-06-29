import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { RR } from "@/lib/design";

export default async function GamesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div style={{ minHeight: "100dvh", background: RR.violet, position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)", backgroundSize: "16px 16px" }} />

      <div style={{ position: "relative", zIndex: 5, maxWidth: 560, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <Link href="/lobby" style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)", border: `2.5px solid ${RR.ink}`,
            color: RR.white, display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none", fontSize: 18, fontFamily: "var(--font-display)",
            boxShadow: `2px 2px 0 ${RR.ink}`, flexShrink: 0,
          }}>←</Link>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
              Rival Rush
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: RR.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${RR.pink}`, lineHeight: 1 }}>
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
            tagColor={RR.cyan}
            borderColor={RR.cyan}
            shadowColor={RR.pink}
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
            tagColor={RR.pink}
            borderColor={RR.pink}
            shadowColor={RR.butter}
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
            tagColor={RR.butter}
            borderColor={RR.butter}
            shadowColor={RR.cyan}
            rules={[
              { icon: "📐", text: "Grille 7 colonnes × 6 lignes — le challenger joue en premier" },
              { icon: "⬇", text: "Tour par tour : clique sur une colonne, ton jeton tombe en bas" },
              { icon: "🏆", text: "Premier à aligner 4 jetons (horizontal, vertical ou diagonal) gagne" },
              { icon: "🤝", text: "Grille pleine sans alignement = match nul" },
            ]}
          />

          {/* Réflexe */}
          <GameCard
            icon="⚡⚡⚡"
            title="Réflexe"
            tag="Vitesse"
            tagColor={RR.pink}
            borderColor={RR.pink}
            shadowColor={RR.butter}
            rules={[
              { icon: "✋", text: "Les deux joueurs appuient sur PRÊT ? — la manche s'arme automatiquement" },
              { icon: "👀", text: "Attendez le signal — il apparaît après un délai aléatoire (2.5 à 5 secondes)" },
              { icon: "🖐", text: "Dès que le signal s'affiche : TAPEZ le plus vite possible !" },
              { icon: "⚠", text: "Taper avant le signal = faux départ, le signal repart avec un nouveau délai" },
              { icon: "🏆", text: "Premier à remporter 2 manches gagne le match" },
            ]}
          />

          {/* Naval */}
          <GameCard
            icon="🚢⚓🎯"
            title="Bataille Navale"
            tag="Stratégie"
            tagColor="#0ea5e9"
            borderColor="#0ea5e9"
            shadowColor={RR.cyan}
            badge="NEW ✨"
            rules={[
              { icon: "🎲", text: "Bateaux placés aléatoirement : Porte-avions (5), Croiseur (4), 2×Destroyer/Sous-marin (3), Torpilleur (2) — soit 17 cases au total" },
              { icon: "🎯", text: "Tour par tour : clique sur la grille ennemie pour tirer une salve" },
              { icon: "🔥", text: "Touché ! La case est marquée — c'est maintenant au tour de l'adversaire" },
              { icon: "💥", text: "Coulé ! Tout le navire est révélé quand toutes ses cases sont touchées" },
              { icon: "🏆", text: "Coule les 17 cases de la flotte ennemie pour gagner la partie" },
            ]}
          />

          {/* Échecs */}
          <GameCard
            icon="♟♔♛"
            title="Échecs"
            tag="Réflexion"
            tagColor="#9b8ec4"
            borderColor="#9b8ec4"
            shadowColor={RR.pink}
            badge="NEW ✨"
            rules={[
              { icon: "⬜", text: "Blancs (le challenger) jouent en premier — tour par tour jusqu'à l'échec et mat ou la nulle" },
              { icon: "♟", text: "Clique ta pièce pour voir ses coups légaux, puis clique la case destination" },
              { icon: "⚠", text: "Impossible de se mettre en échec — plus aucun coup légal = mat (défaite) ou pat (nulle)" },
              { icon: "👑", text: "Pion promu à la dernière rangée : choisis Dame, Tour, Fou ou Cavalier" },
              { icon: "🏰", text: "Roque et prise en passant supportés — pat = match nul" },
              { icon: "⏱", text: "Cadences au choix : ⚡ Bullet 1 min · 🔥 Blitz 3 min · ♟ Rapide 10 min · ∞ Illimité" },
              { icon: "💀", text: "Temps écoulé = défaite — les deux horloges sont affichées en temps réel sur le plateau" },
            ]}
          />

          {/* Nim */}
          <GameCard
            icon="🔥🔥🔥"
            title="Nim"
            tag="Déduction"
            tagColor={RR.butter}
            borderColor={RR.butter}
            shadowColor={RR.cyan}
            badge="NEW ✨"
            rules={[
              { icon: "🎲", text: "Le tas contient entre 15 et 25 allumettes — tiré au sort à chaque partie" },
              { icon: "✋", text: "Tour par tour : prends 1, 2 ou 3 allumettes" },
              { icon: "💀", text: "Règle misère : celui qui prend la DERNIÈRE allumette PERD" },
              { icon: "🧠", text: "Le nombre aléatoire rend la stratégie parfaite impossible à connaître à l'avance" },
            ]}
          />

          {/* Cochon */}
          <GameCard
            icon="🎲🐷🎲"
            title="Jeu du Cochon"
            tag="Prise de risque"
            tagColor={RR.pink}
            borderColor={RR.pink}
            shadowColor={RR.butter}
            badge="NEW ✨"
            rules={[
              { icon: "🎲", text: "Ton tour : lance le dé autant de fois que tu veux" },
              { icon: "➕", text: "Chaque lancer ajoute sa valeur à ton total du tour" },
              { icon: "💀", text: "Tu fais 1 → tu perds TOUT ce que tu avais accumulé ce tour, et c'est au suivant" },
              { icon: "🏦", text: "À tout moment tu peux « Banquer » pour sécuriser tes points du tour" },
              { icon: "🏆", text: "Premier à atteindre 100 points gagne la partie" },
            ]}
          />

          {/* Mastermind */}
          <GameCard
            icon="🎨🔴🟡"
            title="Mastermind"
            tag="Logique"
            tagColor="#4ADE80"
            borderColor="#4ADE80"
            shadowColor={RR.pink}
            badge="NEW ✨"
            rules={[
              { icon: "🎨", text: "Le serveur génère un code secret de 4 couleurs parmi 6 (répétitions possibles)" },
              { icon: "🔄", text: "Les deux joueurs tentent de deviner le MÊME code, en alternant les essais" },
              { icon: "⚫", text: "Peg noir = bonne couleur à la bonne position" },
              { icon: "⚪", text: "Peg blanc = bonne couleur mais mauvaise position" },
              { icon: "🏆", text: "Premier à obtenir 4 noirs (code exact) gagne · 12 essais max, puis match nul" },
            ]}
          />

          {/* Points */}
          <div style={{
            background: RR.violetDeep, border: `2.5px solid ${RR.ink}`,
            borderRadius: 20, padding: "16px 18px",
            boxShadow: `3px 3px 0 ${RR.ink}`,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
              Système de points
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "Victoire", pts: "+3", color: RR.cyan },
                { label: "Match nul", pts: "+1", color: RR.butter },
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

function GameCard({ icon, title, tag, tagColor, borderColor, shadowColor, badge, rules }: {
  icon: string;
  title: string;
  tag: string;
  tagColor: string;
  borderColor: string;
  shadowColor: string;
  badge?: string;
  rules: { icon: string; text: string }[];
}) {
  return (
    <div style={{
      background: RR.violetDeep,
      border: `2.5px solid ${borderColor}`,
      borderRadius: 22,
      padding: "16px 18px",
      boxShadow: `4px 4px 0 ${shadowColor}, 4px 4px 0 1px ${RR.ink}`,
      position: "relative",
    }}>
      {badge && (
        <div style={{
          position: "absolute", top: -10, right: 14,
          background: RR.butter, border: `2px solid ${RR.ink}`,
          padding: "3px 10px", borderRadius: 999,
          fontFamily: "var(--font-display)", fontSize: 10, color: RR.ink,
          letterSpacing: 0.6, transform: "rotate(2deg)",
          boxShadow: `2px 2px 0 ${RR.ink}`,
        }}>{badge}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: RR.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{title.toUpperCase()}</div>
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
