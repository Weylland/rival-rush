import { RR } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";

interface Props {
  pseudo: string;
  avatarUrl: string | null;
  score: number;
  /** Couleur d'accent (score + halo de tour). */
  accent: string;
  avatarColor: string;
  active: boolean;
}

/** Colonne joueur (avatar + pseudo + score) de Plus-ou-Moins. */
export function PlayerScore({ pseudo, avatarUrl, score, accent, avatarColor, active }: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        padding: 3, borderRadius: "50%",
        border: active ? `3px solid ${accent}` : `3px solid transparent`,
        boxShadow: active ? `0 0 14px ${accent}` : "none",
        transition: "border 0.3s, box-shadow 0.3s",
      }}>
        <Avatar name={pseudo} src={avatarUrl} color={avatarColor} ring={RR.cyan} size={48} />
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: RR.white, transform: "skewX(-4deg)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {pseudo.toUpperCase()}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: accent, lineHeight: 1 }}>{score}</div>
    </div>
  );
}
