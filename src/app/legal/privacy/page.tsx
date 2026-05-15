import type { Metadata } from "next";
import { EA } from "@/lib/design";

export const metadata: Metadata = { title: "Politique de confidentialité — ExpressionArena" };

const h2: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 20,
  color: EA.cyan,
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

export default function PrivacyPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginBottom: 8 }}>
        CONFIDENTIALITÉ
      </h1>
      <p style={{ ...p, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Dernière mise à jour : mai 2026</p>

      <h2 style={h2}>Données collectées</h2>
      <p style={p}>
        ExpressionArena collecte uniquement les données strictement nécessaires au fonctionnement du jeu :
      </p>
      <ul style={{ ...p, paddingLeft: 20, marginTop: 8 }}>
        <li><strong>Pseudo</strong> — nom d'affichage choisi librement, sans lien avec votre identité réelle.</li>
        <li><strong>Mot de passe</strong> — stocké sous forme hachée (bcrypt), jamais en clair.</li>
        <li><strong>Photo de profil</strong> — optionnelle, stockée dans Supabase Storage (supprimée avec le compte).</li>
        <li><strong>Scores et parties</strong> — historique de jeu (victoires, défaites, égalités).</li>
        <li><strong>Messages</strong> — messages du lobby, des salles et messages privés entre joueurs.</li>
        <li><strong>Présence</strong> — statut en ligne ou en partie, mis à jour en temps réel et supprimé à la déconnexion.</li>
      </ul>

      <h2 style={h2}>Aucune donnée personnelle</h2>
      <p style={p}>
        Aucune adresse email, numéro de téléphone, nom réel ou donnée de localisation n'est collecté.
        Il n'y a pas de tracking publicitaire, pas de cookies tiers.
      </p>

      <h2 style={h2}>Stockage</h2>
      <p style={p}>
        Les données sont stockées dans une base PostgreSQL hébergée par Supabase (Union européenne).
        Un cookie httpOnly <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 4 }}>ea_session</code> est déposé dans votre navigateur pour maintenir la session (durée 30 jours, JWT signé).
      </p>

      <h2 style={h2}>Durée de conservation</h2>
      <p style={p}>
        Les données sont conservées jusqu'à suppression du compte. Vous pouvez supprimer votre compte à tout moment depuis la page <strong>Settings</strong>.
        La suppression entraîne l'effacement immédiat et irréversible de toutes vos données : compte, parties, scores, messages, photo de profil et préférences.
      </p>

      <h2 style={h2}>Vos droits (RGPD)</h2>
      <p style={p}>
        Vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
        Pour toute demande : <a href="mailto:samiernicolas62@gmail.com" style={{ color: EA.cyan }}>samiernicolas62@gmail.com</a>
      </p>

      <h2 style={h2}>Contact DPA</h2>
      <p style={p}>
        Responsable du traitement : Nicolas Samier — samiernicolas62@gmail.com
      </p>
    </div>
  );
}
