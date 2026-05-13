"use client";

import { useState, useEffect } from "react";
import { EA } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import { AdminClient } from "./AdminClient";
import { ContactsClient } from "./ContactsClient";
import type { Contact } from "./ContactsClient";
import type { ContactStatus } from "./actions";

interface Player {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  neverPlayed: boolean;
}

type Tab = "players" | "contacts";

export function AdminTabs({ players, contacts: initialContacts }: { players: Player[]; contacts: Contact[] }) {
  const [tab, setTab] = useState<Tab>("players");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);

  // Realtime — nouveaux messages entrants
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-contacts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts" },
        (payload) => {
          setContacts((prev) => [payload.new as Contact, ...prev]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function handleStatusChange(id: string, newStatus: ContactStatus) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
  }

  function handleDelete(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  const newMessages = contacts.filter((c) => c.status === "new").length;

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {([
          { value: "players" as Tab, label: "Joueurs", badge: players.length, badgeColor: undefined as string | undefined },
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

      {/* Les deux panels restent montés — display none pour éviter le reset au changement d'onglet */}
      <div style={{ display: tab === "players" ? "block" : "none" }}>
        <AdminClient players={players} />
      </div>
      <div style={{ display: tab === "contacts" ? "block" : "none" }}>
        <ContactsClient
          contacts={contacts}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
