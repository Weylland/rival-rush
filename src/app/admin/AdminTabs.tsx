"use client";

import { useState, useEffect } from "react";
import { EA } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import { AdminClient } from "./AdminClient";
import { ContactsClient } from "./ContactsClient";
import { ReportsClient } from "./ReportsClient";
import { DashboardClient } from "./DashboardClient";
import { ChatAdminClient } from "./ChatAdminClient";
import { RoomsAdminClient } from "./RoomsAdminClient";
import { GameConfigClient } from "./GameConfigClient";
import type { Contact } from "./ContactsClient";
import type { Report, ReportStatus } from "./ReportsClient";
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

type Tab =
  | "dashboard"
  | "players"
  | "chat"
  | "rooms"
  | "games"
  | "contacts"
  | "reports";

export function AdminTabs({
  players,
  contacts: initialContacts,
  reports: initialReports,
}: {
  players: Player[];
  contacts: Contact[];
  reports: Report[];
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [reports, setReports] = useState<Report[]>(initialReports);

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
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function handleStatusChange(id: string, newStatus: ContactStatus) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
    );
  }

  function handleDelete(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function handleReportStatusChange(id: string, newStatus: ReportStatus) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
    );
  }

  const newMessages = contacts.filter((c) => c.status === "new").length;
  const newReports = reports.filter((r) => r.status === "new").length;

  const tabConfig: {
    value: Tab;
    label: string;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { value: "dashboard", label: "📊 Tableau" },
    { value: "players", label: "👥 Joueurs", badge: players.length },
    { value: "chat", label: "💬 Chat" },
    { value: "rooms", label: "🏠 Salles" },
    { value: "games", label: "🎮 Jeux" },
    {
      value: "contacts",
      label: "📩 Messages",
      badge: newMessages,
      badgeColor: EA.pink,
    },
    {
      value: "reports",
      label: "🚩 Signalements",
      badge: newReports,
      badgeColor: EA.pink,
    },
  ];

  return (
    <div>
      {/* Tab bar — scrollable on mobile */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 24,
          overflowX: "auto",
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        {tabConfig.map(({ value, label, badge, badgeColor }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                color: active ? EA.violetDeep : "rgba(255,255,255,0.55)",
                background: active ? EA.white : "rgba(255,255,255,0.08)",
                border: `2.5px solid ${active ? EA.ink : "rgba(255,255,255,0.15)"}`,
                borderRadius: 999,
                padding: "9px 18px",
                cursor: active ? "default" : "pointer",
                transform: "skewX(-4deg)",
                boxShadow: active ? `3px 3px 0 ${EA.ink}` : "none",
                transition: "all .15s",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  transform: "skewX(4deg)",
                }}
              >
                {label}
                {badge !== undefined && badge > 0 && (
                  <span
                    style={{
                      background: badgeColor ?? EA.cyan,
                      color: badgeColor ? EA.white : EA.violetDeep,
                      borderRadius: 999,
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panels — mounted but hidden to preserve state */}
      <div style={{ display: tab === "dashboard" ? "block" : "none" }}>
        <DashboardClient />
      </div>
      <div style={{ display: tab === "players" ? "block" : "none" }}>
        <AdminClient players={players} />
      </div>
      <div style={{ display: tab === "chat" ? "block" : "none" }}>
        <ChatAdminClient />
      </div>
      <div style={{ display: tab === "rooms" ? "block" : "none" }}>
        <RoomsAdminClient />
      </div>
      <div style={{ display: tab === "games" ? "block" : "none" }}>
        <GameConfigClient />
      </div>
      <div style={{ display: tab === "contacts" ? "block" : "none" }}>
        <ContactsClient
          contacts={contacts}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      </div>
      <div style={{ display: tab === "reports" ? "block" : "none" }}>
        <ReportsClient
          reports={reports}
          onStatusChange={handleReportStatusChange}
        />
      </div>
    </div>
  );
}
