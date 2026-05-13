"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { blockPlayer, reportMessage } from "@/app/(game)/play/chat/actions";
import { EA } from "@/lib/design";

interface Message {
  id: string;
  player_id: string;
  pseudo: string;
  content: string;
  created_at: string;
}

interface Props {
  gameId: string;
  myId: string;
  myPseudo: string;
  opponentId: string;
  opponentPseudo: string;
}

// Filtre basique côté client
const BAD_WORDS = ["pute","putain","connard","connasse","salope","enculé","encule","fdp","nique","niquer"];
function hasProfanity(text: string) {
  const clean = text.toLowerCase().replace(/[^a-z]/g, "");
  return BAD_WORDS.some(w => clean.includes(w.replace(/[^a-z]/g, "")));
}

// Rate limit côté client : max 3 messages en 5s
function useRateLimit() {
  const timestamps = useRef<number[]>([]);
  return () => {
    const now = Date.now();
    timestamps.current = timestamps.current.filter(t => now - t < 5000);
    if (timestamps.current.length >= 3) return false;
    timestamps.current.push(now);
    return true;
  };
}

export function GameChat({ gameId, myId, myPseudo, opponentId, opponentPseudo }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const checkRate = useRateLimit();

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("messages")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as Message[]); });

    const channel = supabase
      .channel(`chat-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => [...prev, msg]);
          if (msg.player_id !== myId && !openRef.current) {
            setUnread(u => u + 1);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId, myId]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  function handleToggle() {
    setOpen(o => !o);
    setUnread(0);
    setShowBlockConfirm(false);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSendError(null);

    if (trimmed.length > 200) { setSendError("Max 200 caractères"); return; }
    if (hasProfanity(trimmed)) { setSendError("Message refusé (contenu inapproprié)"); return; }
    if (!checkRate()) { setSendError("Trop vite ! Attends un peu."); return; }

    setInput("");
    setSending(true);
    try {
      // Insert direct via client Supabase — pas de server action pour éviter
      // la revalidation Next.js qui perturbe les useEffect des game clients
      const supabase = createClient();
      await supabase.from("messages").insert({
        game_id: gameId,
        player_id: myId,
        pseudo: myPseudo,
        content: trimmed,
      });
    } catch {
      setSendError("Erreur d'envoi");
    } finally {
      setSending(false);
    }
  }

  async function handleBlock() {
    if (blocked || blockPending) return;
    setBlockPending(true);
    const res = await blockPlayer(opponentId);
    if (res.ok) { setBlocked(true); setShowBlockConfirm(false); }
    setBlockPending(false);
  }

  async function handleReport(msg: Message) {
    if (reported.has(msg.id) || blockPending) return;
    setBlockPending(true);
    const res = await reportMessage(opponentId, gameId, msg.content);
    if (res.ok) setReported(prev => new Set([...prev, msg.id]));
    setBlockPending(false);
  }

  const visibleMessages = blocked
    ? messages.filter(m => m.player_id === myId)
    : messages;

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={handleToggle}
        title={open ? "Fermer le chat" : "Chat"}
        style={{
          position: "fixed", bottom: 20, left: 20, zIndex: 200,
          width: 44, height: 44, borderRadius: "50%",
          background: open ? "rgba(26,15,94,0.95)" : EA.white,
          border: `2.5px solid ${EA.ink}`,
          boxShadow: open ? "none" : `3px 3px 0 ${EA.cyan}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .15s",
          flexShrink: 0,
        }}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={EA.white} strokeWidth="2.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={EA.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span style={{
            position: "absolute", top: -6, right: -6,
            background: EA.pink, color: EA.white,
            borderRadius: "50%", width: 20, height: 20,
            border: `2px solid ${EA.ink}`,
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Panneau */}
      {open && (
        <div style={{
          position: "fixed", bottom: 72, left: 16, zIndex: 199,
          width: "min(320px, calc(100vw - 32px))",
          maxHeight: "min(420px, calc(100dvh - 100px))",
          background: EA.violetDeep,
          border: `2.5px solid ${EA.ink}`,
          borderRadius: 20,
          boxShadow: `4px 4px 0 ${EA.ink}`,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* En-tête */}
          <div style={{
            padding: "10px 14px",
            background: EA.cyan,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            flexShrink: 0,
          }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 14, color: EA.ink,
              transform: "skewX(-4deg)", letterSpacing: 0.5,
            }}>
              {blocked ? `${opponentPseudo} — bloqué` : opponentPseudo.toUpperCase()}
            </div>

            {!blocked && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowBlockConfirm(v => !v)}
                  style={{
                    background: "rgba(0,0,0,0.15)", border: `1.5px solid rgba(0,0,0,0.25)`,
                    borderRadius: 999, padding: "3px 10px",
                    fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                    color: EA.ink, cursor: "pointer",
                  }}
                >···</button>

                {showBlockConfirm && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: EA.white, border: `2px solid ${EA.ink}`,
                    borderRadius: 12, padding: "6px",
                    boxShadow: `3px 3px 0 ${EA.ink}`,
                    display: "flex", flexDirection: "column", gap: 4,
                    zIndex: 10, minWidth: 140,
                  }}>
                    <button
                      onClick={handleBlock}
                      disabled={blockPending}
                      style={{
                        fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
                        color: EA.pink, background: "rgba(255,30,140,0.08)",
                        border: `1.5px solid ${EA.pink}`, borderRadius: 8,
                        padding: "7px 12px", cursor: "pointer", textAlign: "left",
                      }}
                    >🚫 Bloquer</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "10px 10px 4px",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {visibleMessages.length === 0 && (
              <div style={{
                textAlign: "center", padding: "24px 0",
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                color: "rgba(255,255,255,0.3)",
              }}>
                Dis quelque chose 👋
              </div>
            )}

            {visibleMessages.map(msg => {
              const isMe = msg.player_id === myId;
              return (
                <div key={msg.id} style={{
                  display: "flex", flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  gap: 2,
                }}>
                  <div style={{
                    maxWidth: "80%",
                    background: isMe ? EA.cyan : "rgba(255,255,255,0.1)",
                    border: `2px solid ${isMe ? EA.ink : "rgba(255,255,255,0.1)"}`,
                    borderRadius: isMe ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                    padding: "7px 11px",
                    boxShadow: isMe ? `2px 2px 0 ${EA.ink}` : "none",
                  }}>
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                      color: isMe ? EA.ink : EA.white,
                      lineHeight: 1.45, wordBreak: "break-word",
                    }}>
                      {msg.content}
                    </span>
                  </div>

                  {!isMe && (
                    <button
                      onClick={() => handleReport(msg)}
                      disabled={reported.has(msg.id)}
                      style={{
                        background: "none", border: "none", padding: "0 2px",
                        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                        color: reported.has(msg.id) ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.28)",
                        cursor: reported.has(msg.id) ? "default" : "pointer",
                        transition: "color .1s",
                      }}
                      onMouseOver={e => { if (!reported.has(msg.id)) e.currentTarget.style.color = EA.pink; }}
                      onMouseOut={e => { e.currentTarget.style.color = reported.has(msg.id) ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.28)"; }}
                    >
                      {reported.has(msg.id) ? "✓ signalé" : "🚩 signaler"}
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Erreur */}
          {sendError && (
            <div style={{
              padding: "5px 12px",
              background: "rgba(255,30,140,0.12)",
              borderTop: `1px solid rgba(255,30,140,0.2)`,
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
              color: EA.pink, flexShrink: 0,
            }}>
              ⚠ {sendError}
            </div>
          )}

          {/* Saisie */}
          <div style={{
            padding: "8px 10px",
            borderTop: `2px solid rgba(255,255,255,0.07)`,
            display: "flex", gap: 6, flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value.slice(0, 200)); setSendError(null); }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message..."
              maxLength={200}
              style={{
                flex: 1, minWidth: 0,
                background: "rgba(255,255,255,0.06)",
                border: `2px solid rgba(255,255,255,0.1)`,
                borderRadius: 10, padding: "8px 10px",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                color: EA.white, outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: input.trim() && !sending ? EA.cyan : "rgba(255,255,255,0.06)",
                border: `2px solid ${input.trim() && !sending ? EA.ink : "rgba(255,255,255,0.1)"}`,
                boxShadow: input.trim() && !sending ? `2px 2px 0 ${EA.ink}` : "none",
                cursor: input.trim() && !sending ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .1s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() && !sending ? EA.ink : "rgba(255,255,255,0.2)"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
