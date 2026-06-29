"use client";

import { RR } from "@/lib/design";
import { logout } from "@/app/(auth)/login/actions";
import type { SectionMeta } from "./AdminShell";

export type SectionId =
  | "dashboard"
  | "activity"
  | "players"
  | "admins"
  | "warnings"
  | "presence"
  | "chats"
  | "reports"
  | "rooms"
  | "games-config"
  | "games-browser"
  | "challenges"
  | "contacts"
  | "affiche";

interface Props {
  sections: SectionMeta[];
  currentId: SectionId;
  onSelect: (id: SectionId) => void;
  isDesktop: boolean;
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({
  sections,
  currentId,
  onSelect,
  isDesktop,
  open,
  onClose,
}: Props) {
  const visible = isDesktop || open;

  // Group sections
  const groups: { name: string; items: SectionMeta[] }[] = [];
  for (const s of sections) {
    let group = groups.find((g) => g.name === s.group);
    if (!group) {
      group = { name: s.group, items: [] };
      groups.push(group);
    }
    group.items.push(s);
  }

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        width: 264,
        background:
          "linear-gradient(180deg, #060114 0%, #0a0220 50%, #06010f 100%)",
        borderRight: `1.5px solid rgba(255,255,255,0.06)`,
        zIndex: 100,
        transform: visible ? "translateX(0)" : "translateX(-100%)",
        transition: "transform .3s cubic-bezier(.4,0,.2,1)",
        display: "flex",
        flexDirection: "column",
        boxShadow: visible ? "0 0 60px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* Brand header */}
      <div
        style={{
          padding: "22px 22px 18px",
          borderBottom: `1.5px solid rgba(255,255,255,0.05)`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${RR.cyan} 0%, ${RR.pink} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: `0 4px 16px rgba(255,30,140,0.4), inset 0 1px 0 rgba(255,255,255,0.3)`,
            flexShrink: 0,
          }}
        >
          ◆
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              color: RR.white,
              transform: "skewX(-4deg)",
              letterSpacing: 0.5,
              lineHeight: 1.1,
            }}
          >
            EXPRESSION
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 9,
              fontWeight: 900,
              color: RR.cyan,
              textTransform: "uppercase",
              letterSpacing: 2.5,
              marginTop: 2,
            }}
          >
            ADMIN PANEL
          </div>
        </div>
        {!isDesktop && (
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: `1.5px solid rgba(255,255,255,0.1)`,
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="rr-admin-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {groups.map((group) => (
          <div key={group.name}>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 9,
                fontWeight: 900,
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: 2,
                padding: "0 12px 8px",
              }}
            >
              {group.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.map((item) => {
                const active = item.id === currentId;
                const hasBadge = item.badge !== undefined && item.badge > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: active
                        ? `linear-gradient(90deg, rgba(0,212,232,0.15) 0%, rgba(0,212,232,0.04) 100%)`
                        : "transparent",
                      border: active
                        ? `1.5px solid rgba(0,212,232,0.3)`
                        : `1.5px solid transparent`,
                      cursor: active ? "default" : "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "all .15s",
                      fontFamily: "var(--font-sans)",
                      color: active ? RR.white : "rgba(255,255,255,0.65)",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.04)";
                        e.currentTarget.style.color = RR.white;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                      }
                    }}
                  >
                    {active && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: -1,
                          top: 8,
                          bottom: 8,
                          width: 3,
                          borderRadius: 999,
                          background: item.accent,
                          boxShadow: `0 0 10px ${item.accent}`,
                        }}
                      />
                    )}
                    <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>
                      {item.icon}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: active ? 800 : 700,
                      }}
                    >
                      {item.label}
                    </span>
                    {hasBadge && (
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 10,
                          fontWeight: 900,
                          color: item.badgeColor ? RR.white : "rgba(255,255,255,0.7)",
                          background: item.badgeColor ?? "rgba(255,255,255,0.1)",
                          borderRadius: 999,
                          padding: "2px 7px",
                          minWidth: 18,
                          textAlign: "center",
                          lineHeight: 1.4,
                          boxShadow: item.badgeColor
                            ? `0 0 8px ${item.badgeColor}80`
                            : "none",
                        }}
                      >
                        {item.badge! > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / logout */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: `1.5px solid rgba(255,255,255,0.05)`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${RR.violet} 0%, ${RR.violetDeep} 100%)`,
            border: `1.5px solid rgba(255,255,255,0.15)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            color: RR.white,
            flexShrink: 0,
          }}
        >
          👑
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 900,
              color: RR.white,
            }}
          >
            Admin
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Session active
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Déconnexion"
            aria-label="Déconnexion"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(255,30,140,0.1)",
              border: `1.5px solid rgba(255,30,140,0.3)`,
              color: RR.pink,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = RR.pink;
              e.currentTarget.style.color = RR.white;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,30,140,0.1)";
              e.currentTarget.style.color = RR.pink;
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
