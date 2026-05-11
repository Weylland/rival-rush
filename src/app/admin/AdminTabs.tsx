"use client";

import { useState } from "react";
import { EA } from "@/lib/design";
import { AdminClient } from "./AdminClient";
import { ContactsClient } from "./ContactsClient";
import type { Contact } from "./ContactsClient";

interface Player {
  id: string;
  pseudo: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  neverPlayed: boolean;
}

type Tab = "players" | "contacts";

export function AdminTabs({ players, contacts }: { players: Player[]; contacts: Contact[] }) {
  const [tab, setTab] = useState<Tab>("players");
  const newMessages = contacts.filter((c) => c.status === "new").length;

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {([
          { value: "players" as Tab, label: `Joueurs`, badge: players.length, badgeColor: undefined as string | undefined },
          { value: "contacts" as Tab, label: "Messages", badge: newMessages, badgeColor: EA.pink as string | undefined },
        ]).map(({ value, label, badge, badgeColor }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                fontFamily: "var(--font-display)", fontSize: 15,
                color: active ? EA.violetDeep : "rgba(255,255,255,0.55)",
                background: active ? EA.white : "rgba(255,255,255,0.08)",
                border: `2.5px solid ${active ? EA.ink : "rgba(255,255,255,0.15)"}`,
                borderRadius: 999, padding: "10px 22px",
                cursor: active ? "default" : "pointer",
                transform: "skewX(-4deg)",
                boxShadow: active ? `3px 3px 0 ${EA.ink}` : "none",
                transition: "all .15s",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, transform: "skewX(4deg)" }}>
                {label}
                {badge > 0 && (
                  <span style={{
                    background: badgeColor ?? EA.cyan,
                    color: badgeColor ? EA.white : EA.violetDeep,
                    borderRadius: 999, padding: "1px 8px",
                    fontSize: 12, fontWeight: 900,
                  }}>
                    {badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "players" ? (
        <AdminClient players={players} />
      ) : (
        <ContactsClient contacts={contacts} />
      )}
    </div>
  );
}
