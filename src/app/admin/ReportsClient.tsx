"use client";

import { useState, useTransition } from "react";
import { EA } from "@/lib/design";
import { updateReportStatus } from "./actions";

export type ReportStatus = "new" | "reviewed" | "ignored";

export interface Report {
  id: string;
  reporter_id: string;
  reporter_pseudo: string;
  reported_player_id: string;
  reported_pseudo: string;
  game_id: string;
  message_content: string;
  status: ReportStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  new:      { label: "Nouveau",  color: EA.pink,   bg: "rgba(255,30,140,0.15)" },
  reviewed: { label: "Traité",   color: EA.cyan,   bg: "rgba(0,212,232,0.12)" },
  ignored:  { label: "Ignoré",   color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.07)" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ReportCard({ report, onStatusChange }: { report: Report; onStatusChange: (id: string, s: ReportStatus) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cfg = STATUS_CONFIG[report.status];

  function handleStatus(next: ReportStatus) {
    if (next === report.status) return;
    setError(null);
    startTransition(async () => {
      const res = await updateReportStatus(report.id, next);
      if ("error" in res) setError(res.error);
      else onStatusChange(report.id, next);
    });
  }

  return (
    <div style={{
      background: EA.violetDeep,
      border: `2.5px solid ${report.status === "new" ? EA.pink : EA.ink}`,
      borderRadius: 16,
      padding: "14px 16px",
      boxShadow: report.status === "new" ? `3px 3px 0 ${EA.pink}` : `2px 2px 0 ${EA.ink}`,
      opacity: report.status === "ignored" ? 0.55 : 1,
      transition: "opacity .2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.white }}>
              🚩 {report.reporter_pseudo}
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
              signale
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.pink }}>
              {report.reported_pseudo}
            </span>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900,
              color: cfg.color, background: cfg.bg,
              border: `1.5px solid ${cfg.color}`, borderRadius: 999,
              padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.8,
            }}>
              {cfg.label}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {formatDate(report.created_at)} · partie {report.game_id.slice(0, 8)}…
          </div>
        </div>
      </div>

      {/* Message signalé */}
      <div style={{
        margin: "10px 0",
        background: "rgba(255,30,140,0.08)",
        border: `1.5px solid rgba(255,30,140,0.2)`,
        borderRadius: 10, padding: "10px 14px",
        fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
        color: "rgba(255,255,255,0.8)", lineHeight: 1.5,
        wordBreak: "break-word",
      }}>
        &ldquo;{report.message_content}&rdquo;
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["reviewed", "ignored"] as ReportStatus[]).map(s => {
          const c = STATUS_CONFIG[s];
          const active = report.status === s;
          return (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              disabled={pending || active}
              style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
                color: active ? EA.violetDeep : c.color,
                background: active ? c.color : c.bg,
                border: `2px solid ${c.color}`,
                borderRadius: 999, padding: "6px 14px",
                cursor: active || pending ? "default" : "pointer",
                opacity: pending ? 0.6 : 1,
                transition: "all .15s",
                textTransform: "uppercase", letterSpacing: 0.5,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ marginTop: 6, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: EA.pink }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

interface ReportsClientProps {
  reports: Report[];
  onStatusChange: (id: string, s: ReportStatus) => void;
}

export function ReportsClient({ reports, onStatusChange }: ReportsClientProps) {
  const [filter, setFilter] = useState<ReportStatus | "all">("new");

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);
  const newCount = reports.filter(r => r.status === "new").length;

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {([
          { value: "all" as const, label: "Tous" },
          { value: "new" as const, label: "Nouveaux" },
          { value: "reviewed" as const, label: "Traités" },
          { value: "ignored" as const, label: "Ignorés" },
        ]).map(({ value, label }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                fontFamily: "var(--font-display)", fontSize: 13,
                color: active ? EA.violetDeep : "rgba(255,255,255,0.6)",
                background: active ? EA.pink : "rgba(255,255,255,0.08)",
                border: `2px solid ${active ? EA.ink : "rgba(255,255,255,0.15)"}`,
                borderRadius: 999, padding: "7px 16px",
                cursor: "pointer", transform: "skewX(-3deg)",
              }}
            >
              <span style={{ display: "inline-block", transform: "skewX(3deg)" }}>
                {label}
                {value === "new" && newCount > 0 && (
                  <span style={{ marginLeft: 6, background: EA.pink, color: EA.white, borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 900 }}>
                    {newCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "40px 0" }}>
          Aucun signalement
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => (
            <ReportCard key={r.id} report={r} onStatusChange={onStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
