import type { Metadata } from "next";
import { RR } from "@/lib/design";

export const metadata: Metadata = { title: "CGU — RivalRush" };

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

export default function CguPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, color: RR.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${RR.pink}`, marginBottom: 8 }}>
        CGU
      </h1>
      <p style={{ ...p, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Conditions Générales d'Utilisation — Dernière mise à jour : mai 2026</p>

      <h2 style={h2}>1. Présentation</h2>
      <p style={p}>
        RivalRush est une application de mini-jeux en duel destinée aux événements festifs en réseau local.
        L'accès est réservé aux participants invités à la soirée.
      </p>

      <h2 style={h2}>2. Accès au service</h2>
      <p style={p}>
        L'inscription nécessite un pseudo et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants.
        Un seul compte par joueur. Les comptes inactifs peuvent être supprimés par l'administrateur en fin de soirée.
      </p>

      <h2 style={h2}>3. Règles de conduite</h2>
      <p style={p}>
        Les joueurs s'engagent à :
      </p>
      <ul style={{ ...p, paddingLeft: 20, marginTop: 8 }}>
        <li>Choisir un pseudo respectueux et non offensant.</li>
        <li>Jouer fair-play — pas de triche, pas de manipulation des scores.</li>
        <li>Ne pas perturber les parties des autres joueurs.</li>
      </ul>

      <h2 style={h2}>4. Fonctionnement des parties</h2>
      <p style={p}>
        Un défi doit être accepté pour démarrer une partie. Quitter une partie en cours est considéré comme un forfait
        et attribue la victoire à l'adversaire. Le classement est mis à jour en temps réel.
      </p>

      <h2 style={h2}>5. Suppression de compte</h2>
      <p style={p}>
        Vous pouvez supprimer votre compte à tout moment depuis la page Settings. Cette action supprime
        l'intégralité de vos données (parties, scores, présence) de façon irréversible.
      </p>

      <h2 style={h2}>6. Limitation de responsabilité</h2>
      <p style={p}>
        Le service est fourni "en l'état", à titre gratuit, sans garantie de disponibilité.
        L'éditeur ne peut être tenu responsable de pertes de données ou d'interruptions de service.
      </p>

      <h2 style={h2}>7. Droit applicable</h2>
      <p style={p}>
        Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence des juridictions françaises.
      </p>
    </div>
  );
}
