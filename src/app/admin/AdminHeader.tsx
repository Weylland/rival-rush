"use client";

import { useEffect, useState } from "react";
import { RR } from "@/lib/design";

interface Props {
  title: string;
  subtitle?: string;
  accent: string;
  icon: string;
  onMenuClick: () => void;
  showMenu: boolean;
  alerts: number;
}

export function AdminHeader({
  title,
  subtitle,
  accent,
  icon,
  onMenuClick,
  showMenu,
  alerts,
}: Props) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "rgba(10,2,24,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1.5px solid rgba(255,255,255,0.06)`,
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {showMenu && (
        <button
          onClick={onMenuClick}
          aria-label="Menu"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: `1.5px solid rgba(255,255,255,0.1)`,
            color: RR.white,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 16,
              height: 2,
              background: "currentColor",
              borderRadius: 2,
            }}
          />
          <span
            style={{
              width: 16,
              height: 2,
              background: "currentColor",
              borderRadius: 2,
            }}
          />
          <span
            style={{
              width: 16,
              height: 2,
              background: "currentColor",
              borderRadius: 2,
            }}
          />
        </button>
      )}

      {/* Section icon + title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}30 0%, ${accent}15 100%)`,
            border: `1.5px solid ${accent}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
            boxShadow: `0 0 24px ${accent}20`,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: RR.white,
              transform: "skewX(-4deg)",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.45)",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right cluster */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Lien vers le site */}
        <a
          href="/lobby"
          target="_blank"
          rel="noopener noreferrer"
          title="Ouvrir le site"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "rgba(0,212,232,0.08)",
            border: `1.5px solid rgba(0,212,232,0.25)`,
            borderRadius: 999,
            textDecoration: "none",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0,212,232,0.18)";
            e.currentTarget.style.borderColor = "rgba(0,212,232,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0,212,232,0.08)";
            e.currentTarget.style.borderColor = "rgba(0,212,232,0.25)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: RR.cyan }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11, fontWeight: 900,
            color: RR.cyan,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}>
            Site
          </span>
        </a>

        {alerts > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: "rgba(255,30,140,0.12)",
              border: `1.5px solid ${RR.pink}50`,
              borderRadius: 999,
            }}
            title={`${alerts} alerte${alerts > 1 ? "s" : ""} en attente`}
          >
            <span
              className="rr-admin-pulse-dot"
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: RR.pink,
                boxShadow: `0 0 8px ${RR.pink}`,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 900,
                color: RR.pink,
              }}
            >
              {alerts}
            </span>
          </div>
        )}

        {/* Live status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "rgba(74,222,128,0.1)",
            border: `1.5px solid rgba(74,222,128,0.3)`,
            borderRadius: 999,
          }}
        >
          <span
            className="rr-admin-pulse-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "#4ade80",
              boxShadow: "0 0 8px #4ade80",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fontWeight: 900,
              color: "#4ade80",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            LIVE
          </span>
        </div>

        {/* Clock */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: 1,
            padding: "6px 12px",
            background: "rgba(255,255,255,0.04)",
            border: `1.5px solid rgba(255,255,255,0.08)`,
            borderRadius: 999,
            fontVariantNumeric: "tabular-nums",
            minWidth: 78,
            textAlign: "center",
          }}
        >
          {time}
        </div>
      </div>
    </header>
  );
}
