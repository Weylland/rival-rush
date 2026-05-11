"use client";

import { useState, useTransition } from "react";
import { updateContactStatus, type ContactStatus } from "./actions";
import { EA } from "@/lib/design";

export interface Contact {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  new:         { label: "Nouveau",    color: EA.cyan,   bg: "rgba(0,212,232,0.15)" },
  in_progress: { label: "En cours",  color: EA.butter, bg: "rgba(255,233,74,0.15)" },
  done:        { label: "Traité",     color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.08)" },
  spam:        { label: "Spam",       color: EA.pink,   bg: "rgba(255,30,140,0.15)" },
};

const ALL_STATUSES: ContactStatus[] = ["new", "in_progress", "done", "spam"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ContactCard({ contact }: { contact: Contact }) {
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [expanded, setExpanded] = useState(contact.status === "new");
  const [pending, startTransition] = useTransition();

  function handleStatus(next: ContactStatus) {
    startTransition(async () => {
      const res = await updateContactStatus(contact.id, next);
      if (!("error" in res)) setStatus(next);
    });
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div style={{
      background: EA.violetDeep,
      border: `2.5px solid ${status === "new" ? EA.cyan : EA.ink}`,
      borderRadius: 18, overflow: "hidden",
      boxShadow: status === "new" ? `3px 3px 0 ${EA.cyan}` : `2px 2px 0 ${EA.ink}`,
      opacity: status === "spam" ? 0.5 : 1,
      transition: "opacity .2s",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white }}>
              {contact.name}
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
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
            {contact.email} · {formatDate(contact.created_at)}
            {contact.subject && <> · <em style={{ fontStyle: "normal", color: "rgba(255,255,255,0.6)" }}>{contact.subject}</em></>}
          </div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid rgba(255,255,255,0.08)` }}>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
            color: "rgba(255,255,255,0.75)", lineHeight: 1.7,
            whiteSpace: "pre-wrap", margin: "14px 0",
          }}>
            {contact.message}
          </p>

          {/* Status selector */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {ALL_STATUSES.map((s) => {
              const c = STATUS_CONFIG[s];
              const active = status === s;
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
                    cursor: active ? "default" : "pointer",
                    opacity: pending ? 0.6 : 1,
                    transition: "all .15s",
                    textTransform: "uppercase", letterSpacing: 0.5,
                  }}
                >
                  {c.label}
                </button>
              );
            })}

            <a
              href={`mailto:${contact.email}?subject=Re: ${encodeURIComponent(contact.subject ?? "Votre message")}`}
              style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
                color: EA.white, background: "rgba(255,255,255,0.1)",
                border: `2px solid ${EA.ink}`,
                borderRadius: 999, padding: "6px 14px",
                textDecoration: "none", marginLeft: "auto",
              }}
            >
              ✉️ Répondre
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const FILTER_OPTIONS: { value: ContactStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "new", label: "Nouveaux" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Traités" },
  { value: "spam", label: "Spam" },
];

export function ContactsClient({ contacts }: { contacts: Contact[] }) {
  const [filter, setFilter] = useState<ContactStatus | "all">("new");

  const filtered = filter === "all" ? contacts : contacts.filter((c) => c.status === filter);
  const newCount = contacts.filter((c) => c.status === "new").length;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTER_OPTIONS.map(({ value, label }) => {
          const active = filter === value;
          const isNew = value === "new" && newCount > 0;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                fontFamily: "var(--font-display)", fontSize: 13,
                color: active ? EA.violetDeep : "rgba(255,255,255,0.6)",
                background: active ? EA.cyan : "rgba(255,255,255,0.08)",
                border: `2px solid ${active ? EA.ink : "rgba(255,255,255,0.15)"}`,
                borderRadius: 999, padding: "7px 16px",
                cursor: "pointer", transform: "skewX(-3deg)",
                position: "relative",
              }}
            >
              <span style={{ display: "inline-block", transform: "skewX(3deg)" }}>
                {label}
                {isNew && (
                  <span style={{
                    marginLeft: 6, background: EA.pink, color: EA.white,
                    borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 900,
                  }}>
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
          Aucun message
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((c) => <ContactCard key={c.id} contact={c} />)}
        </div>
      )}
    </div>
  );
}
