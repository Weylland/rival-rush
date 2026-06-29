"use client";

import { RR } from "@/lib/design";

export function AfficheClient() {
  function downloadPdf() {
    window.open("/affiche.html#print", "_blank", "noopener");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1.5px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: RR.white,
              marginBottom: 6,
            }}
          >
            Affiche A4 à imprimer
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
            }}
          >
            QR code vers <b style={{ color: RR.cyan }}>rival-rush.vercel.app</b>. Clique sur «
            Télécharger en PDF », puis dans la boîte d&apos;impression choisis{" "}
            <b style={{ color: RR.butter }}>Destination → Enregistrer au format PDF</b> (format A4,
            marges « Aucune »).
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={downloadPdf}
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 900,
              fontSize: 14,
              color: RR.white,
              background: `linear-gradient(135deg, ${RR.cyan} 0%, ${RR.pink} 100%)`,
              border: "none",
              borderRadius: 12,
              padding: "12px 22px",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(255,30,140,0.35)",
            }}
          >
            ⬇ Télécharger en PDF
          </button>
          <a
            href="/affiche.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 800,
              fontSize: 14,
              color: RR.white,
              background: "rgba(255,255,255,0.06)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "12px 22px",
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ↗ Ouvrir dans un onglet
          </a>
        </div>
      </div>

      {/* Aperçu */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1.5px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <iframe
          src="/affiche.html"
          title="Aperçu de l'affiche"
          style={{
            width: 420,
            height: 594,
            maxWidth: "100%",
            border: "none",
            borderRadius: 8,
            background: "#3a2aa0",
          }}
        />
      </div>
    </div>
  );
}
