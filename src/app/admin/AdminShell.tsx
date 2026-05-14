"use client";

import { useState, useEffect } from "react";
import { EA } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar, type SectionId } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { DashboardClient } from "./DashboardClient";
import { AdminClient } from "./AdminClient";
import { ChatAdminClient } from "./ChatAdminClient";
import { RoomsAdminClient } from "./RoomsAdminClient";
import { GameConfigClient } from "./GameConfigClient";
import { ContactsClient } from "./ContactsClient";
import { ReportsClient } from "./ReportsClient";
import { ActivityClient } from "./ActivityClient";
import { WarningsClient } from "./WarningsClient";
import { PresenceClient } from "./PresenceClient";
import { GamesBrowserClient } from "./GamesBrowserClient";
import { ChallengesClient } from "./ChallengesClient";
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

export interface SectionMeta {
  id: SectionId;
  group: string;
  label: string;
  icon: string;
  badge?: number;
  badgeColor?: string;
  accent: string;
  title: string;
  subtitle?: string;
}

export function AdminShell({
  players,
  contacts: initialContacts,
  reports: initialReports,
}: {
  players: Player[];
  contacts: Contact[];
  reports: Report[];
}) {
  const [section, setSection] = useState<SectionId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [onlineCount, setOnlineCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [activeGames, setActiveGames] = useState(0);
  const [pendingChallenges, setPendingChallenges] = useState(0);

  // Responsive
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 980px)");
    const apply = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setSidebarOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Realtime contact alerts
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("admin-shell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts" },
        (payload) => setContacts((prev) => [payload.new as Contact, ...prev]),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        () => fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenges" },
        () => fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_notifications" },
        () => fetchCounts(),
      )
      .subscribe();

    fetchCounts();
    const tick = setInterval(fetchCounts, 30_000);

    async function fetchCounts() {
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from("presence").select("*", { count: "exact", head: true }),
        supabase
          .from("player_notifications")
          .select("*", { count: "exact", head: true })
          .eq("seen", false),
        supabase
          .from("games")
          .select("*", { count: "exact", head: true })
          .eq("status", "playing"),
        supabase
          .from("challenges")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      setOnlineCount(r1.count ?? 0);
      setWarningCount(r2.count ?? 0);
      setActiveGames(r3.count ?? 0);
      setPendingChallenges(r4.count ?? 0);
    }

    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  // Section config (also drives sidebar)
  const newContacts = contacts.filter((c) => c.status === "new").length;
  const newReports = reports.filter((r) => r.status === "new").length;

  const sections: SectionMeta[] = [
    {
      id: "dashboard",
      group: "APERÇU",
      label: "Dashboard",
      icon: "📊",
      accent: EA.cyan,
      title: "Tableau de bord",
      subtitle: "Vue d'ensemble en temps réel",
    },
    {
      id: "activity",
      group: "APERÇU",
      label: "Activité",
      icon: "📡",
      accent: EA.cyan,
      title: "Flux d'activité",
      subtitle: "Événements récents en direct",
    },
    {
      id: "players",
      group: "COMMUNAUTÉ",
      label: "Joueurs",
      icon: "👥",
      badge: players.length,
      accent: EA.violet,
      title: "Joueurs",
      subtitle: `${players.length} comptes inscrits`,
    },
    {
      id: "warnings",
      group: "COMMUNAUTÉ",
      label: "Avertissements",
      icon: "⚠️",
      badge: warningCount,
      badgeColor: warningCount > 0 ? EA.pink : undefined,
      accent: EA.pink,
      title: "Avertissements",
      subtitle: "Notifications envoyées aux joueurs",
    },
    {
      id: "presence",
      group: "COMMUNAUTÉ",
      label: "En ligne",
      icon: "🟢",
      badge: onlineCount,
      badgeColor: onlineCount > 0 ? "#4ade80" : undefined,
      accent: "#4ade80",
      title: "Présence",
      subtitle: "Joueurs connectés en temps réel",
    },
    {
      id: "chats",
      group: "MODÉRATION",
      label: "Chats",
      icon: "💬",
      accent: EA.cyan,
      title: "Modération du chat",
      subtitle: "Lobby, salles et messages privés",
    },
    {
      id: "reports",
      group: "MODÉRATION",
      label: "Signalements",
      icon: "🚩",
      badge: newReports,
      badgeColor: newReports > 0 ? EA.pink : undefined,
      accent: EA.pink,
      title: "Signalements",
      subtitle: "Rapports envoyés par les joueurs",
    },
    {
      id: "rooms",
      group: "ESPACES",
      label: "Salles",
      icon: "🏠",
      accent: EA.butter,
      title: "Salles privées",
      subtitle: "Toutes les salles créées",
    },
    {
      id: "games-config",
      group: "JEUX",
      label: "Configuration",
      icon: "⚙️",
      accent: EA.butter,
      title: "Configuration des jeux",
      subtitle: "Activer / désactiver, ajuster les points",
    },
    {
      id: "games-browser",
      group: "JEUX",
      label: "Parties",
      icon: "🎯",
      badge: activeGames,
      badgeColor: activeGames > 0 ? EA.cyan : undefined,
      accent: EA.butter,
      title: "Toutes les parties",
      subtitle: "Historique, parties en cours, force end",
    },
    {
      id: "challenges",
      group: "JEUX",
      label: "Défis",
      icon: "⚔️",
      badge: pendingChallenges,
      badgeColor: pendingChallenges > 0 ? EA.cyan : undefined,
      accent: EA.butter,
      title: "Défis",
      subtitle: "Challenges en attente, refusés, annulés",
    },
    {
      id: "contacts",
      group: "CONTACT",
      label: "Messages",
      icon: "📩",
      badge: newContacts,
      badgeColor: newContacts > 0 ? EA.pink : undefined,
      accent: EA.pink,
      title: "Messages de contact",
      subtitle: "Formulaire public reçu",
    },
  ];

  const current = sections.find((s) => s.id === section) ?? sections[0];

  function handleSectionChange(id: SectionId) {
    setSection(id);
    if (!isDesktop) setSidebarOpen(false);
  }

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

  const totalAlerts = newContacts + newReports + warningCount;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0218",
        color: EA.white,
        position: "relative",
      }}
    >
      {/* Global admin styles */}
      <style>{`
        .ea-admin-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .ea-admin-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .ea-admin-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .ea-admin-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        @keyframes ea-admin-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
        @keyframes ea-admin-glow {
          0%, 100% { box-shadow: 0 0 0 rgba(0,212,232,0); }
          50% { box-shadow: 0 0 20px rgba(0,212,232,0.4); }
        }
        @keyframes ea-admin-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes ea-admin-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ea-admin-slide-in {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .ea-admin-section { animation: ea-admin-fade-in .3s ease-out; }
        .ea-admin-pulse-dot { animation: ea-admin-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Subtle bg pattern */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            "radial-gradient(circle at 25% 30%, rgba(0,212,232,0.18) 0, transparent 40%), radial-gradient(circle at 75% 70%, rgba(255,30,140,0.16) 0, transparent 45%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.08,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1.4px)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Mobile backdrop */}
      {!isDesktop && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 50,
            animation: "ea-admin-fade-in .2s",
          }}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        sections={sections}
        currentId={current.id}
        onSelect={handleSectionChange}
        isDesktop={isDesktop}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div
        style={{
          marginLeft: isDesktop ? 264 : 0,
          minHeight: "100dvh",
          position: "relative",
          zIndex: 1,
          transition: "margin-left .25s ease",
        }}
      >
        <AdminHeader
          title={current.title}
          subtitle={current.subtitle}
          accent={current.accent}
          icon={current.icon}
          onMenuClick={() => setSidebarOpen(true)}
          showMenu={!isDesktop}
          alerts={totalAlerts}
        />

        <main
          className="ea-admin-scroll"
          style={{
            padding: isDesktop ? "32px 40px 60px" : "20px 16px 60px",
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          <div key={current.id} className="ea-admin-section">
            {current.id === "dashboard" && <DashboardClient />}
            {current.id === "activity" && <ActivityClient />}
            {current.id === "players" && <AdminClient players={players} />}
            {current.id === "warnings" && <WarningsClient />}
            {current.id === "presence" && <PresenceClient />}
            {current.id === "chats" && <ChatAdminClient />}
            {current.id === "reports" && (
              <ReportsClient
                reports={reports}
                onStatusChange={handleReportStatusChange}
              />
            )}
            {current.id === "rooms" && <RoomsAdminClient />}
            {current.id === "games-config" && <GameConfigClient />}
            {current.id === "games-browser" && <GamesBrowserClient />}
            {current.id === "challenges" && <ChallengesClient />}
            {current.id === "contacts" && (
              <ContactsClient
                contacts={contacts}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
