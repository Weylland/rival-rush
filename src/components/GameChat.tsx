"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, blockPlayer, reportMessage } from "@/app/(game)/play/chat/actions";
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

export function GameChat({ gameId, myId, myPseudo: _myPseudo, opponentId, opponentPseudo }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendPending, startSend] = useTransition();
  const [blockPending, startBlock] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  // Charger les messages existants + écouter en temps réel
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

  // Scroll en bas + reset unread quand on ouvre ou que les messages changent
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  function handleToggle() {
    setOpen(o => !o);
    setUnread(0);
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sendPending) return;
    setSendError(null);
    const content = trimmed;
    setInput("");
    startSend(async () => {
      const res = await sendMessage(gameId, content);
      if (!res.ok) setSendError(res.error ?? "Erreur");
    });
  }

  function handleBlock() {
    if (blocked || blockPending) return;
    startBlock(async () => {
      const res = await blockPlayer(opponentId);
      if (res.ok) setBlocked(true);
    });
  }

  function handleReport(msg: Message) {
    if (reported.has(msg.id) || blockPending) return;
    startBlock(async () => {
      const res = await reportMessage(opponentId, gameId, msg.content);
      if (res.ok) setReported(prev => new Set([...prev, msg.id]));
    });
  }

  const visibleMessages = blocked
    ? messages.filter(m => m.player_id === myId)
    : messages;

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={handleToggle}
        title={open ? "Fermer le chat" : "Ouvrir le chat"}
        style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 200,
          width: 52, height: 52, borderRadius: "50%",
          background: open ? EA.violetDeep : EA.cyan,
          border: `2.5px solid ${EA.ink}`,
          boxShadow: open ? `3px 3px 0 ${EA.ink}` : `3px 3px 0 ${EA.pink}, 3px 3px 0 1px ${EA.ink}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: open ? 20 : 24,
          transition: "all .15s",
        }}
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span style={{
            position: "absolute", top: -6, right: -6,
            background: EA.pink, color: EA.white,
            borderRadius: "50%", width: 22, height: 22,
            border: `2px solid ${EA.ink}`,
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Panneau de chat */}
      {open && (
        <div style={{
          position: "fixed", bottom: 84, right: 16, zIndex: 199,
          width: "min(340px, calc(100vw - 32px))",
          maxHeight: "min(480px, calc(100dvh - 120px))",
          background: EA.violetDeep,
          border: `2.5px solid ${EA.ink}`,
          borderRadius: 20,
          boxShadow: `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* En-tête */}
          <div style={{
            padding: "12px 14px",
            background: "rgba(0,0,0,0.2)",
            borderBottom: `2px solid rgba(255,255,255,0.08)`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.white, transform: "skewX(-3deg)" }}>
                💬 {opponentPseudo}
              </div>
              {blocked && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: EA.pink, marginTop: 2 }}>
                  Joueur bloqué — ses messages sont masqués
                </div>
              )}
            </div>
            {!blocked && (
              <button
                onClick={handleBlock}
                disabled={blockPending}
                title="Bloquer ce joueur"
                style={{
                  background: "rgba(255,30,140,0.1)", border: `1.5px solid ${EA.pink}`,
                  borderRadius: 999, padding: "5px 10px",
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                  color: EA.pink, cursor: blockPending ? "wait" : "pointer",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                🚫 Bloquer
              </button>
            )}
          </div>

          {/* Liste des messages */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "12px 10px 4px",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {visibleMessages.length === 0 && (
              <div style={{
                textAlign: "center", padding: "28px 0",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                color: "rgba(255,255,255,0.25)",
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
                }}>
                  <div style={{
                    maxWidth: "82%",
                    background: isMe ? EA.cyan : "rgba(255,255,255,0.1)",
                    border: `2px solid ${isMe ? EA.ink : "rgba(255,255,255,0.12)"}`,
                    borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    padding: "8px 12px",
                    boxShadow: isMe ? `2px 2px 0 ${EA.ink}` : "none",
                  }}>
                    <div style={{
                      fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                      color: isMe ? EA.ink : EA.white,
                      lineHeight: 1.45, wordBreak: "break-word",
                    }}>
                      {msg.content}
                    </div>
                  </div>

                  {/* Actions signalement (messages adverse uniquement) */}
                  {!isMe && (
                    <button
                      onClick={() => handleReport(msg)}
                      disabled={reported.has(msg.id) || blockPending}
                      style={{
                        background: "none", border: "none",
                        cursor: reported.has(msg.id) ? "default" : "pointer",
                        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                        color: reported.has(msg.id) ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)",
                        padding: "2px 2px 0",
                        transition: "color .1s",
                      }}
                      onMouseOver={e => { if (!reported.has(msg.id)) e.currentTarget.style.color = EA.pink; }}
                      onMouseOut={e => { e.currentTarget.style.color = reported.has(msg.id) ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)"; }}
                    >
                      {reported.has(msg.id) ? "✓ signalé" : "🚩 signaler"}
                    </button>
                  )}
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Message d'erreur */}
          {sendError && (
            <div style={{
              padding: "6px 14px",
              background: "rgba(255,30,140,0.12)",
              borderTop: `1px solid rgba(255,30,140,0.2)`,
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
              color: EA.pink, flexShrink: 0,
            }}>
              ⚠ {sendError}
            </div>
          )}

          {/* Saisie */}
          <div style={{
            padding: "10px 10px",
            borderTop: `2px solid rgba(255,255,255,0.08)`,
            display: "flex", gap: 8, flexShrink: 0,
            background: "rgba(0,0,0,0.15)",
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
                flex: 1,
                background: "rgba(255,255,255,0.07)",
                border: `2px solid rgba(255,255,255,0.12)`,
                borderRadius: 12, padding: "9px 12px",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                color: EA.white, outline: "none",
                minWidth: 0,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sendPending}
              style={{
                background: input.trim() && !sendPending ? EA.cyan : "rgba(255,255,255,0.07)",
                border: `2px solid ${input.trim() && !sendPending ? EA.ink : "rgba(255,255,255,0.12)"}`,
                borderRadius: 12, padding: "9px 14px",
                fontFamily: "var(--font-display)", fontSize: 16,
                color: input.trim() && !sendPending ? EA.ink : "rgba(255,255,255,0.2)",
                cursor: input.trim() && !sendPending ? "pointer" : "not-allowed",
                boxShadow: input.trim() && !sendPending ? `2px 2px 0 ${EA.ink}` : "none",
                transition: "all .1s", flexShrink: 0,
              }}
            >
              {sendPending ? "…" : "→"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
