import type { Metadata } from "next";
import { RR } from "@/lib/design";

export const metadata: Metadata = { title: "Mentions légales — RivalRush" };

const h2: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 20,
  color: RR.cyan,
  transform: "skewX(-4deg)",
  marginTop: 32,
  marginBottom: 8,
};

const p: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  fontWeight: 600,
  color: "rgba(255,255,255,0.7)",
  lineHeight: 1.7,
  margin: 0,
};

export default function MentionsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, color: RR.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${RR.pink}`, marginBottom: 8 }}>
        MENTIONS LÉGALES
      </h1>
      <p style={{ ...p, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Dernière mise à jour : mai 2026</p>

      <h2 style={h2}>Éditeur</h2>
      <p style={p}>
        RivalRush est édité par Nicolas Samier, développeur indépendant.<br />
        Email : {process.env.CONTACT_EMAIL}
      </p>

      <h2 style={h2}>Hébergement</h2>
      <p style={p}>
        L'application est hébergée par Vercel Inc.<br />
        440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
        <a href="https://vercel.com" style={{ color: RR.cyan }}>vercel.com</a>
      </p>

      <h2 style={h2}>Propriété intellectuelle</h2>
      <p style={p}>
        L'ensemble du code source, des assets graphiques et du contenu d'RivalRush est la propriété exclusive de Nicolas Samier.
        Toute reproduction sans autorisation préalable est interdite.
      </p>

      <h2 style={h2}>Responsabilité</h2>
      <p style={p}>
        RivalRush est une application de jeu à usage privé, conçue pour des événements en réseau local.
        L'éditeur ne saurait être tenu responsable de tout dommage direct ou indirect résultant de l'utilisation du service.
      </p>
    </div>
  );
}
