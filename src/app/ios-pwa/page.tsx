import { EA } from "@/lib/design";

const STEPS = [
  {
    num: "1",
    icon: "⬆️",
    title: 'Appuie sur "Partager"',
    desc: "Dans Safari, appuie sur l'icône de partage en bas de l'écran (carré avec une flèche qui pointe vers le haut).",
  },
  {
    num: "2",
    icon: "➕",
    title: 'Choisis "Sur l\'écran d\'accueil"',
    desc: "Fais défiler la liste et appuie sur « Sur l'écran d'accueil ». Confirme en haut à droite.",
  },
  {
    num: "3",
    icon: "📲",
    title: "Ouvre l'app depuis l'accueil",
    desc: "Ferme Safari et lance Expression Arena depuis l'icône sur ton écran d'accueil.",
  },
  {
    num: "4",
    icon: "🔔",
    title: "Active les notifications",
    desc: "Une fois dans l'app, une popup te demande d'activer les notifications. Accepte pour recevoir les défis !",
  },
];

export default function IosPwaPage() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violet,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.2,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <div style={{ position: "relative", zIndex: 5, maxWidth: 480, margin: "0 auto", padding: "40px 20px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>🍎</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            iOS · Safari
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 32, color: EA.white,
            transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1.1,
          }}>
            ACTIVER LES NOTIFS
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginTop: 10, lineHeight: 1.6 }}>
            Sur iPhone, les notifications push nécessitent d'ajouter l'app à ton écran d'accueil (PWA).
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STEPS.map((step) => (
            <div key={step.num} style={{
              background: EA.violetDeep,
              border: `2.5px solid ${EA.ink}`,
              borderRadius: 20, padding: "16px 18px",
              boxShadow: `4px 4px 0 ${EA.cyan}`,
              display: "flex", alignItems: "flex-start", gap: 14,
            }}>
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                background: EA.pink, border: `2px solid ${EA.ink}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontSize: 18, color: EA.white,
                boxShadow: `2px 2px 0 ${EA.ink}`, transform: "skewX(-4deg)",
              }}>
                {step.num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{step.icon}</span>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white, transform: "skewX(-4deg)" }}>
                    {step.title}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div style={{
          marginTop: 20,
          background: `${EA.butter}22`, border: `2px solid ${EA.butter}`,
          borderRadius: 16, padding: "12px 16px",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            Pourquoi ? Apple n&apos;autorise les notifications push que dans les apps ajoutées à l&apos;écran d&apos;accueil depuis Safari (iOS 16.4+).
          </div>
        </div>

        {/* Back link */}
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <a href="/lobby" style={{
            fontFamily: "var(--font-display)", fontSize: 16, color: EA.cyan,
            textDecoration: "none", display: "inline-block",
            transform: "skewX(-4deg)", borderBottom: `2px solid ${EA.cyan}`, paddingBottom: 2,
          }}>
            ← RETOUR AU LOBBY
          </a>
        </div>
      </div>
    </div>
  );
}
