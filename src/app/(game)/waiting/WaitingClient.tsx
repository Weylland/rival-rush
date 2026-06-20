"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelChallenge } from "@/app/(game)/lobby/actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { GameType } from "@/types/database";

const TIPS: Record<GameType | "global", string[]> = {
  pfc: [
    "Les joueurs stressés jouent souvent Pierre en premier — commence par Feuille.",
    "Après une défaite, ton adversaire va rarement rejouer le même signe.",
    "Tu viens de gagner ? L'adversaire va souvent jouer ce qui aurait battu ton choix.",
    "Deux fois le même signe d'affilée ? Il s'y attend — change.",
    "La Feuille est statistiquement le choix le moins joué. Exploite ça.",
    "Après une Feuille perdante, beaucoup de joueurs passent instinctivement aux Ciseaux.",
    "Si l'adversaire est imprévisible, joue aléatoirement — le hasard vaut parfois mieux que la stratégie.",
  ],
  morpion: [
    "Prends le centre au premier coup si possible — il est impliqué dans 4 des 8 alignements gagnants.",
    "Les coins valent plus que les côtés : un coin permet 3 alignements, un côté seulement 2.",
    "Face à un centre adverse, réponds par un coin — jamais un côté.",
    "Crée une double menace (deux aligner en même temps) : ton adversaire ne peut en bloquer qu'une.",
    "La \"fourche\" (attaquer sur deux axes simultanément) est imbattable si elle n'est pas anticipée.",
    "Jouer en diagonale coins opposés dès le début force l'adversaire dans une position défensive.",
    "Vérifier chaque tour si l'adversaire peut gagner au suivant — bloquer passe avant attaquer.",
  ],
  puissance4: [
    "La colonne centrale est décisive : elle est impliquée dans presque tous les alignements longs.",
    "Construis des doubles menaces : deux alignements qui ne peuvent être bloqués qu'à un seul endroit.",
    "Méfie-toi du piège \"7\" : une menace au sol + une en l'air dans la même colonne.",
    "Ne remplis pas une colonne trop tôt — tu risques d'offrir à l'adversaire la case du dessus.",
    "Si tu joues en deuxième, force les blocages : oblige-le à défendre plutôt qu'attaquer.",
    "Vise plusieurs axes en même temps : diagonal + horizontal crée des situations impossibles à bloquer.",
    "Compter les cases restantes par colonne évite de jouer dans une colonne pleine.",
    "Un alignement en bas de grille est plus sûr qu'en hauteur : les cases du bas sont jouables immédiatement.",
  ],
  reflexe: [
    "Pose ton doigt en survol de l'écran avant le signal — chaque milliseconde compte.",
    "Ne fixe pas le bouton : fixe l'ensemble de l'écran, tu détectes le changement plus vite en vision périphérique.",
    "Respire régulièrement avant la manche — apnée et tension ralentissent tes réflexes.",
    "Anticiper = faux départ. Attends le signal, ne prévoie pas.",
    "Si tu as perdu de peu, résiste à l'envie de taper plus tôt au prochain round — l'adversaire compte dessus.",
    "La régularité bat la précipitation : un bon rythme de respiration donne de meilleurs temps.",
  ],
  naval: [
    "Commence par tirer en diagonale espacée (un coup sur deux cases) pour balayer la grille efficacement.",
    "Les grands bateaux (5-4 cases) ne tiennent pas en bord de grille — commence par le centre.",
    "Dès un touché, tire dans les 4 directions adjacentes pour trouver l'orientation du bateau.",
    "Une fois l'orientation trouvée, continue dans la même direction jusqu'à couler.",
    "Le Torpilleur (2 cases) est le plus difficile à trouver — réserve les zones restantes pour lui.",
    "Compte les cases touchées : 5+4+3+3+2 = 17 au total. Suivi ta progression avec le tracker de flotte.",
    "Si l'adversaire touche mais ne coule pas, c'est qu'il cherche l'orientation — regarde où il tire ensuite.",
  ],
  chess: [
    "Contrôle le centre dès le début : e4, d4, e5, d5 sont les cases les plus stratégiques.",
    "Développe tes pièces mineures (Cavaliers et Fous) avant de roquer — ne bouge pas deux fois la même pièce en ouverture.",
    "Le Roi est en sécurité derrière ses pions après le roque — castle tôt, castle souvent.",
    "Les Cavaliers sont forts au centre, les Fous sont forts sur les diagonales ouvertes.",
    "Un pion de plus en fin de partie peut gagner la partie — ne sacrifie pas de pions sans raison.",
    "Avant chaque coup, demande-toi : mon adversaire peut-il me faire mat ou capturer une pièce importante ?",
    "La Dame est puissante mais vulnérable au début — ne la joue pas trop tôt sans protection.",
  ],
  mastermind: [
    "Commence par un guess avec 4 couleurs toutes différentes — tu élimines un max d'un coup.",
    "Les pegs noirs = bonne couleur, bonne place. Les blancs = bonne couleur, mauvaise place.",
    "Si tu as 0 pegs sur un guess, aucune de ces 4 couleurs n'est dans le code.",
    "Utilise les infos de l'adversaire aussi — ses résultats t'aident à réduire les possibilités.",
    "Il existe toujours une stratégie pour trouver en 5 coups max — mais il faut y réfléchir.",
  ],
  pig: [
    "Lance le dé autant de fois que tu veux — mais un 1 et tu perds tout ce tour.",
    "Banquer tôt c'est sûr, banquer tard c'est risqué. Trouve ton équilibre.",
    "Si tu es loin derrière, prends plus de risques — c'est souvent ton seul espoir.",
    "En tête ? Banque dès 15-20 points par tour, ne laisse pas l'adversaire revenir.",
    "Un adversaire qui lance 5 fois de suite finit souvent par faire 1. Regarde-le suer.",
  ],
  nim: [
    "La stratégie parfaite existe au Nim classique — mais misère change tout. Ne te fie pas à tes calculs habituels.",
    "Le tas est aléatoire : impossible de savoir à l'avance si tu as l'avantage. Réfléchis coup par coup.",
    "Laisser 1 allumette à ton adversaire, c'est le faire perdre. Vise ça.",
    "Prendre 3 quand il en reste 4 te laisse gagner si l'adversaire ne prend qu'1. Mais il peut faire pareil…",
    "Misère = celui qui vide le tas PERD. Garde toujours ça en tête avant de prendre.",
  ],
  "plus-ou-moins": [
    "Commence toujours par 50 — tu élimines la moitié des nombres d'un coup.",
    "Après chaque réponse, vise le milieu de la zone restante. C'est la stratégie parfaite.",
    "10 essais suffisent en théorie pour trouver n'importe quel nombre entre 1 et 100.",
    "Regarde les coups de l'adversaire — ils te donnent aussi des infos sur le nombre !",
    "La zone rétrécit à chaque coup. Surveille le thermomètre : BRÛLANT = t'es tout proche.",
  ],
  "duel-des": [
    "Pur hasard — personne n'a d'avantage. Profite juste du stress de l'attente !",
    "Première à 3 victoires de manche. Chaque round compte, surtout les égalités !",
    "L'adversaire a lancé mais tu ne vois pas son dé — l'inconnu, c'est tout le sel du jeu.",
    "Égalité de manche = personne ne marque. Ça peut se jouer en 3 manches… ou en 10.",
    "La pression monte à 2-2. C'est là que le jeu commence vraiment.",
  ],
  global: [
    "Un match nul, c'est mieux qu'une défaite — chaque point au classement compte.",
    "Les meilleures décisions se prennent calme. Prends 2 secondes avant de jouer.",
    "Rejoue après une défaite : le plus dur, c'est de revenir. Les champions reviennent.",
  ],
};

function getTip(gameType: GameType): string {
  const pool = [...(TIPS[gameType] ?? []), ...TIPS.global];
  return pool[Math.floor(Math.random() * pool.length)];
}

interface Props {
  challengeId: string;
  myPseudo: string;
  myAvatarUrl: string | null;
  myAvatarColor: string | null;
  opponentPseudo: string;
  gameType: GameType;
  opponentIsOffline: boolean;
}

export function WaitingClient({ challengeId, myPseudo, myAvatarUrl, myAvatarColor, opponentPseudo, gameType, opponentIsOffline }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [, startTransition] = useTransition();
  const tip = getTip(gameType);

  // Guard : si la partie existe déjà (retour arrière depuis /play ou /result)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("games")
      .select("id, game_type, status")
      .eq("challenge_id", challengeId)
      .maybeSingle()
      .then(({ data: game }) => {
        if (!game) return;
        if (game.status === "finished") {
          router.replace(`/result?game_id=${game.id}`);
        } else {
          router.replace(`/play/${game.game_type as string}?game_id=${game.id}`);
        }
      });
  }, [challengeId, router]);

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`challenge-${challengeId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "challenges",
        filter: `id=eq.${challengeId}`,
      }, (payload) => {
        const updated = payload.new as { status: string };
        if (updated.status === "declined" || updated.status === "cancelled") {
          router.replace("/lobby");
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "games",
        filter: `challenge_id=eq.${challengeId}`,
      }, (payload) => {
        const game = payload.new as { id: string; game_type: GameType };
        // replace : efface /waiting de l'historique → retour arrière = lobby
        router.replace(`/play/${game.game_type}?game_id=${game.id}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [challengeId, router]);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />
      <SvgBlob color={EA.pink} style={{ width: desktop ? 560 : 300, height: desktop ? 480 : 260, top: -160, right: -130, opacity: 0.8, animation: "ea-float 4s ease-in-out infinite" }} />
      <SvgBlob color={EA.cyan} style={{ width: desktop ? 480 : 280, height: desktop ? 420 : 240, bottom: -160, left: -120, opacity: 0.75, animation: "ea-float 6s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <SvgBlob color={EA.butter} style={{ width: desktop ? 320 : 200, height: desktop ? 280 : 180, top: "40%", left: -120, opacity: 0.35, animation: "ea-float 9s ease-in-out infinite" }}
        path="M 40 20 Q 80 0 130 25 Q 190 55 170 120 Q 155 180 85 175 Q 15 170 10 105 Q -5 45 40 20 Z" />
      <Star color={EA.butter} size={desktop ? 34 : 20} style={{ top: "10%", left: "6%", animation: "ea-spin-slow 12s linear infinite" }} />
      <Star color={EA.white} size={desktop ? 20 : 14} style={{ top: "7%", right: "8%", animation: "ea-spin-slow 16s linear infinite reverse" }} />
      <Star color={EA.cyan} size={desktop ? 18 : 12} style={{ bottom: "20%", right: "6%", animation: "ea-float 5s ease-in-out infinite" }} />
      <Star color={EA.pink} size={desktop ? 15 : 10} style={{ top: "35%", right: "5%", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.butter} size={desktop ? 13 : 9} style={{ bottom: "8%", left: "9%", transform: "rotate(-20deg)" }} />

      {/* Centered content */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: desktop ? 640 : "100%",
        margin: "0 auto",
        flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: desktop ? "60px 48px" : "60px 24px",
        gap: desktop ? 40 : 28,
      }}>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 14 : 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
            MATCHMAKING
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 52 : 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
            ON ATTEND...
          </div>
        </div>

        {/* Players VS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: desktop ? 40 : 12, width: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: desktop ? 10 : 6 }}>
            <Avatar name={myPseudo} src={myAvatarUrl} color={myAvatarColor ?? EA.butter} ring={EA.cyan} size={desktop ? 96 : 72} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 15, color: EA.white, transform: "skewX(-4deg)" }}>
              {myPseudo.toUpperCase()}
            </div>
            <div style={{ background: EA.cyan, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: desktop ? "5px 16px" : "3px 10px", fontFamily: "var(--font-display)", fontSize: desktop ? 14 : 10, color: EA.ink, letterSpacing: 1, boxShadow: `2px 2px 0 ${EA.ink}` }}>
              ✓ PRÊT·E
            </div>
          </div>

          <div style={{
            width: desktop ? 72 : 50, height: desktop ? 72 : 50, borderRadius: "50%",
            background: EA.pink, border: `2.5px solid ${EA.ink}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: desktop ? 26 : 18, color: EA.white,
            transform: "skewX(-8deg) rotate(-6deg)",
            boxShadow: `3px 3px 0 ${EA.butter}`, flexShrink: 0,
          }}>VS</div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: desktop ? 10 : 6 }}>
            <div style={{
              width: desktop ? 96 : 72, height: desktop ? 96 : 72, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: `2.5px dashed ${opponentIsOffline ? EA.butter : EA.cyan}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: desktop ? 40 : 28,
              color: opponentIsOffline ? EA.butter : EA.cyan,
              animation: "ea-pulse 1.4s ease-in-out infinite",
            }}>{opponentIsOffline ? "📬" : "?"}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 15, color: "rgba(255,255,255,0.5)", transform: "skewX(-4deg)" }}>
              {opponentPseudo.toUpperCase()}
            </div>
            <div style={{ background: opponentIsOffline ? "rgba(255,233,74,0.15)" : "rgba(26,15,94,0.55)", border: `2px solid ${opponentIsOffline ? EA.butter : EA.ink}`, borderRadius: 999, padding: desktop ? "5px 16px" : "3px 10px", fontFamily: "var(--font-display)", fontSize: desktop ? 14 : 10, color: opponentIsOffline ? EA.butter : EA.cyan, letterSpacing: 1 }}>
              {opponentIsOffline ? "📵 HORS LIGNE" : "⏳ ARRIVE"}
            </div>
          </div>
        </div>

        {/* Loading dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: desktop ? 14 : 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: desktop ? 18 : 14, height: desktop ? 18 : 14, borderRadius: "50%",
              background: i === 0 ? EA.cyan : i === 1 ? EA.pink : EA.butter,
              border: `2px solid ${EA.ink}`,
              animation: `ea-bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
            }} />
          ))}
        </div>

        <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: desktop ? 18 : 14, fontWeight: 800, color: EA.white, opacity: 0.85, textAlign: "center" }}>
          {opponentIsOffline
            ? `Invitation envoyée à ${opponentPseudo} — il a 5 min pour accepter`
            : `${opponentPseudo} se connecte au match...`}
        </div>

        {/* Tip */}
        <div style={{
          width: "100%",
          background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: desktop ? 22 : 18, padding: desktop ? "16px 20px" : "12px 14px",
          display: "flex", alignItems: "center", gap: desktop ? 14 : 10,
          boxShadow: `4px 4px 0 ${EA.cyan}`,
        }}>
          <div style={{ background: EA.butter, border: `2px solid ${EA.ink}`, width: desktop ? 44 : 32, height: desktop ? 44 : 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: desktop ? 22 : 16, flexShrink: 0 }}>💡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 12, color: EA.cyan, letterSpacing: 1 }}>ASTUCE</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 11, fontWeight: 800, color: EA.white, opacity: 0.85, marginTop: 1 }}>{tip}</div>
          </div>
        </div>

        <button
          onClick={() => {
            startTransition(async () => {
              await cancelChallenge(challengeId);
              router.push("/lobby");
            });
          }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 12, fontWeight: 800,
            color: "rgba(255,255,255,0.55)", textDecoration: "underline",
          }}>
          Annuler le défi
        </button>
      </div>
    </div>
  );
}
