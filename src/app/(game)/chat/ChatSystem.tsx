"use client";

import {
  createContext, useCallback, useContext, useEffect,
  useRef, useState, useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import {
  sendLobbyMessage, sendDirectMessage,
  getOrCreateConversation, markConversationRead,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LobbyMsg {
  id: string; player_id: string; pseudo: string;
  content: string; created_at: string;
  avatar_url?: string | null;
}

interface Conv {
  id: string; p1_id: string; p2_id: string;
  otherPseudo: string; otherAvatarUrl: string | null;
  lastContent: string | null; lastAt: string | null; lastSenderId: string | null;
  unread: number;
}

interface DMsg {
  id: string; conversation_id: string; sender_id: string;
  pseudo: string; content: string; created_at: string;
}

interface OnlinePlayer {
  player_id: string; pseudo: string; avatar_url?: string | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ChatCtxValue {
  openDM: (recipientId: string, recipientPseudo: string) => void;
  totalUnread: number;
}

const ChatCtx = createContext<ChatCtxValue>({ openDM: () => {}, totalUnread: 0 });
export const useChatOpen = () => useContext(ChatCtx);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// ── ChatProvider ──────────────────────────────────────────────────────────────

export function ChatProvider({
  children, myId, myPseudo,
}: { children: React.ReactNode; myId: string; myPseudo: string }) {
  const [isOpen, setIsOpen]               = useState(false);
  const [tab, setTab]                     = useState<"lobby" | "dms">("lobby");
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [activeConvPseudo, setActiveConvPseudo] = useState("");

  const [lobbyMessages, setLobbyMessages] = useState<LobbyMsg[]>([]);
  const avatarCacheRef = useRef<Map<string, string | null>>(new Map());
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeMessages, setActiveMessages] = useState<DMsg[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [showNewDm, setShowNewDm]         = useState(false);

  const [lobbyInput, setLobbyInput]       = useState("");
  const [dmInput, setDmInput]             = useState("");
  const [sendingLobby, startLobby]        = useTransition();
  const [sendingDm, startDm]              = useTransition();
  const [pendingDm, startPendingDm]       = useTransition();

  const lobbyRef    = useRef<HTMLDivElement>(null);
  const dmRef       = useRef<HTMLDivElement>(null);
  const lobbyInput$ = useRef<HTMLInputElement>(null);
  const dmInput$    = useRef<HTMLInputElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadLobby = useCallback(async () => {
    const supabase = createClient();
    const { data: msgs } = await supabase
      .from("lobby_chat").select("*")
      .order("created_at", { ascending: true }).limit(100);
    if (!msgs) return;

    // Load avatars for unique players
    const ids = [...new Set(msgs.map(m => m.player_id))];
    if (ids.length > 0) {
      const { data: players } = await supabase
        .from("players").select("id, avatar_url").in("id", ids);
      for (const p of players ?? []) {
        avatarCacheRef.current.set(p.id, (p.avatar_url as string | null) ?? null);
      }
    }

    setLobbyMessages(msgs.map(m => ({ ...m, avatar_url: avatarCacheRef.current.get(m.player_id) ?? null })));
  }, []);

  const loadConversations = useCallback(async () => {
    const supabase = createClient();

    const { data: rawConvs } = await supabase
      .from("conversations")
      .select("id, p1_id, p2_id")
      .or(`p1_id.eq.${myId},p2_id.eq.${myId}`);

    if (!rawConvs || rawConvs.length === 0) { setConversations([]); return; }

    const convIds = rawConvs.map(c => c.id);
    const partnerIds = rawConvs.map(c => c.p1_id === myId ? c.p2_id : c.p1_id);

    const [{ data: players }, { data: reads }, { data: lastMsgs }] = await Promise.all([
      supabase.from("players").select("id, pseudo, avatar_url").in("id", partnerIds),
      supabase.from("conversation_reads").select("conversation_id, read_at").eq("player_id", myId),
      supabase.from("direct_messages").select("conversation_id, sender_id, content, created_at")
        .in("conversation_id", convIds).order("created_at", { ascending: false }).limit(convIds.length * 3),
    ]);

    const playerMap = new Map((players ?? []).map(p => [p.id, p]));
    const readMap   = new Map((reads ?? []).map(r => [r.conversation_id, r.read_at]));

    // Last message per conversation
    const lastMsgMap = new Map<string, { sender_id: string; content: string; created_at: string }>();
    for (const m of lastMsgs ?? []) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
    }

    const convs: Conv[] = rawConvs.map(c => {
      const partnerId = c.p1_id === myId ? c.p2_id : c.p1_id;
      const partner   = playerMap.get(partnerId);
      const readAt    = readMap.get(c.id);
      const lastMsg   = lastMsgMap.get(c.id);

      // Unread = last message is from partner AND is newer than my read_at
      const unread =
        lastMsg && lastMsg.sender_id !== myId &&
        (!readAt || lastMsg.created_at > readAt) ? 1 : 0;

      return {
        id: c.id, p1_id: c.p1_id, p2_id: c.p2_id,
        otherPseudo: partner?.pseudo ?? "?",
        otherAvatarUrl: (partner?.avatar_url as string | null) ?? null,
        lastContent: lastMsg?.content ?? null,
        lastAt: lastMsg?.created_at ?? null,
        lastSenderId: lastMsg?.sender_id ?? null,
        unread,
      };
    }).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

    setConversations(convs);
  }, [myId]);

  const loadConvMessages = useCallback(async (convId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("direct_messages").select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true }).limit(100);
    if (data) setActiveMessages(data);
  }, []);

  const loadOnlinePlayers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("presence").select("player_id, pseudo")
      .neq("player_id", myId);
    if (data) setOnlinePlayers(data);
  }, [myId]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadLobby();
    loadConversations();
  }, [loadLobby, loadConversations]);

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    const lobbyCh = supabase.channel("lobby-chat-sys")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_chat" }, async (p) => {
        const raw = p.new as LobbyMsg;
        // Fetch avatar if not cached
        if (!avatarCacheRef.current.has(raw.player_id)) {
          const { data: player } = await supabase
            .from("players").select("avatar_url").eq("id", raw.player_id).maybeSingle();
          avatarCacheRef.current.set(raw.player_id, (player?.avatar_url as string | null) ?? null);
        }
        const msg: LobbyMsg = { ...raw, avatar_url: avatarCacheRef.current.get(raw.player_id) ?? null };
        setLobbyMessages(prev => [...prev.slice(-99), msg]);
      }).subscribe();

    const dmCh = supabase.channel("dm-sys")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (p) => {
        const msg = p.new as DMsg;
        // Active conversation
        setActiveMessages(prev =>
          prev.length > 0 && prev[0].conversation_id === msg.conversation_id
            ? [...prev, msg] : prev
        );
        // Update conversation list
        setConversations(prev => {
          const exists = prev.find(c => c.id === msg.conversation_id);
          if (exists) {
            return prev.map(c => c.id !== msg.conversation_id ? c : {
              ...c,
              lastContent: msg.content,
              lastAt: msg.created_at,
              lastSenderId: msg.sender_id,
              unread: msg.sender_id !== myId && c.id !== activeConvId ? c.unread + 1 : 0,
            }).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
          }
          // New conversation appearing — reload
          loadConversations();
          return prev;
        });
      }).subscribe();

    return () => { supabase.removeChannel(lobbyCh); supabase.removeChannel(dmCh); };
  }, [myId, activeConvId, loadConversations]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────

  useEffect(() => { lobbyRef.current?.scrollTo({ top: lobbyRef.current.scrollHeight, behavior: "smooth" }); }, [lobbyMessages]);
  useEffect(() => { dmRef.current?.scrollTo({ top: dmRef.current.scrollHeight, behavior: "smooth" }); }, [activeMessages]);

  // ── Active conversation ───────────────────────────────────────────────────

  useEffect(() => {
    if (!activeConvId) return;
    loadConvMessages(activeConvId);
    markConversationRead(activeConvId);
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unread: 0 } : c));
  }, [activeConvId, loadConvMessages]);

  // ── openDM (exposed via context) ──────────────────────────────────────────

  const openDM = useCallback(async (recipientId: string, recipientPseudo: string, _avatarUrl?: string | null) => {
    setIsOpen(true);
    setTab("dms");
    setShowNewDm(false);
    setActiveConvPseudo(recipientPseudo);

    const res = await getOrCreateConversation(recipientId);
    if ("conversationId" in res && res.conversationId) {
      setActiveConvId(res.conversationId);
      await loadConversations();
    }
  }, [loadConversations]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSendLobby(e: React.FormEvent) {
    e.preventDefault();
    const txt = lobbyInput.trim();
    if (!txt || sendingLobby) return;
    setLobbyInput("");
    startLobby(async () => { await sendLobbyMessage(txt); });
    lobbyInput$.current?.focus();
  }

  function handleSendDm(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConvId) return;
    const txt = dmInput.trim();
    if (!txt || sendingDm) return;
    setDmInput("");
    // Optimistic
    const optimistic: DMsg = {
      id: `opt-${Date.now()}`, conversation_id: activeConvId,
      sender_id: myId, pseudo: myPseudo, content: txt,
      created_at: new Date().toISOString(),
    };
    setActiveMessages(prev => [...prev, optimistic]);
    startDm(async () => { await sendDirectMessage(activeConvId, txt); });
    dmInput$.current?.focus();
  }

  async function handleStartDm(player: OnlinePlayer) {
    setShowNewDm(false);
    openDM(player.player_id, player.pseudo);
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const drawerW = 400; // px — desktop width

  return (
    <ChatCtx.Provider value={{ openDM, totalUnread }}>
      {children}

      {/* Floating button */}
      <button
        aria-label="Ouvrir le chat"
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: "fixed", bottom: 64, right: 16, zIndex: 210,
          width: 48, height: 48, borderRadius: "50%",
          background: isOpen ? EA.cyan : EA.violetDeep,
          border: `2.5px solid ${EA.ink}`,
          color: EA.white, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
          boxShadow: `3px 3px 0 ${EA.ink}`,
          transition: "background 0.2s",
        }}
      >
        💬
        {totalUnread > 0 && !isOpen && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 9,
            background: EA.pink, border: `2px solid ${EA.ink}`,
            fontFamily: "var(--font-display)", fontSize: 11,
            color: EA.white, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px",
          }}>{totalUnread > 9 ? "9+" : totalUnread}</span>
        )}
      </button>

      {/* Drawer backdrop (mobile) */}
      {isOpen && (
        <div
          aria-hidden
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 215,
            background: "rgba(15,8,60,0.55)",
            display: "block",
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: "fixed", zIndex: 220,
        right: 0, top: 0, bottom: 0,
        width: drawerW,
        background: EA.violetDeep,
        borderLeft: `2.5px solid ${EA.ink}`,
        boxShadow: `-6px 0 0 ${EA.ink}`,
        display: "flex", flexDirection: "column",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px 0",
          borderBottom: `2px solid rgba(255,255,255,0.08)`,
          paddingBottom: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeConvId && (
              <button
                onClick={() => { setActiveConvId(null); setActiveMessages([]); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
              >←</button>
            )}
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.white, transform: "skewX(-4deg)" }}>
              {activeConvId ? activeConvPseudo.toUpperCase() : "💬 CHAT"}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
          >×</button>
        </div>

        {/* Tabs (seulement hors conversation active) */}
        {!activeConvId && (
          <div style={{ display: "flex", borderBottom: `2px solid rgba(255,255,255,0.08)`, padding: "0 18px" }}>
            {(["lobby", "dms"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setShowNewDm(false); }}
                style={{
                  flex: 1, padding: "10px 0",
                  background: "none", border: "none",
                  borderBottom: tab === t ? `3px solid ${EA.cyan}` : "3px solid transparent",
                  fontFamily: "var(--font-display)", fontSize: 14,
                  color: tab === t ? EA.cyan : "rgba(255,255,255,0.4)",
                  cursor: "pointer", transition: "color 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {t === "lobby" ? "🌐 LOBBY" : (
                  <>💬 MESSAGES{conversations.reduce((n, c) => n + c.unread, 0) > 0 && (
                    <span style={{
                      background: EA.pink, borderRadius: 8, padding: "1px 5px",
                      fontSize: 10, color: EA.white,
                    }}>{conversations.reduce((n, c) => n + c.unread, 0)}</span>
                  )}</>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Lobby tab ── */}
        {!activeConvId && tab === "lobby" && (
          <>
            <div ref={lobbyRef} style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {lobbyMessages.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, paddingTop: 40 }}>
                  Personne n'a encore écrit ici…<br />Lance la conversation !
                </div>
              )}
              {lobbyMessages.map(m => {
                const isMe = m.player_id === myId;
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                    {!isMe && (
                      <Avatar name={m.pseudo} src={m.avatar_url ?? null} color={EA.cyan} size={28} />
                    )}
                    <div style={{ maxWidth: "75%" }}>
                      {!isMe && (
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan, marginBottom: 3, transform: "skewX(-3deg)" }}>
                          {m.pseudo}
                        </div>
                      )}
                      <div style={{
                        background: isMe ? EA.cyan : "rgba(255,255,255,0.08)",
                        border: `2px solid ${isMe ? EA.ink : "rgba(255,255,255,0.1)"}`,
                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "8px 12px",
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                        color: isMe ? EA.ink : EA.white,
                        wordBreak: "break-word",
                      }}>{m.content}</div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2, textAlign: isMe ? "right" : "left" }}>
                        {fmtTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleSendLobby} style={{ padding: "12px 18px 16px", borderTop: `2px solid rgba(255,255,255,0.08)`, display: "flex", gap: 8 }}>
              <input
                ref={lobbyInput$}
                value={lobbyInput}
                onChange={e => setLobbyInput(e.target.value)}
                placeholder="Message global…"
                maxLength={300}
                disabled={sendingLobby}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.07)", border: `2px solid rgba(255,255,255,0.15)`,
                  borderRadius: 12, padding: "10px 14px",
                  fontFamily: "var(--font-sans)", fontSize: 13, color: EA.white,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!lobbyInput.trim() || sendingLobby}
                style={{
                  background: EA.cyan, border: `2px solid ${EA.ink}`,
                  borderRadius: 12, padding: "0 16px",
                  fontFamily: "var(--font-display)", fontSize: 14, color: EA.ink,
                  cursor: !lobbyInput.trim() || sendingLobby ? "default" : "pointer",
                  opacity: !lobbyInput.trim() ? 0.4 : 1,
                  boxShadow: `2px 2px 0 ${EA.ink}`,
                  transition: "opacity 0.15s",
                }}
              >↑</button>
            </form>
          </>
        )}

        {/* ── DMs tab — conversation list ── */}
        {!activeConvId && tab === "dms" && !showNewDm && (
          <>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {conversations.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, paddingTop: 40, padding: "40px 24px" }}>
                  Aucun message privé.<br />Clique sur un joueur dans le lobby pour lui écrire.
                </div>
              )}
              {conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setActiveConvId(c.id); setActiveConvPseudo(c.otherPseudo); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 18px",
                    background: "none", border: "none",
                    borderBottom: `1px solid rgba(255,255,255,0.06)`,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar name={c.otherPseudo} src={c.otherAvatarUrl} color={EA.pink} size={40} />
                    {c.unread > 0 && (
                      <span style={{
                        position: "absolute", top: -3, right: -3,
                        width: 14, height: 14, borderRadius: "50%",
                        background: EA.pink, border: `2px solid ${EA.violetDeep}`,
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: c.unread > 0 ? EA.white : "rgba(255,255,255,0.7)", transform: "skewX(-3deg)" }}>
                      {c.otherPseudo.toUpperCase()}
                    </div>
                    {c.lastContent && (
                      <div style={{
                        fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                        color: c.unread > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.lastSenderId === myId ? "Toi : " : ""}{c.lastContent}
                      </div>
                    )}
                  </div>
                  {c.lastAt && (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                      {fmtTime(c.lastAt)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ padding: "12px 18px 16px", borderTop: `2px solid rgba(255,255,255,0.08)` }}>
              <button
                onClick={() => { setShowNewDm(true); loadOnlinePlayers(); }}
                style={{
                  width: "100%", background: EA.pink, border: `2.5px solid ${EA.ink}`,
                  borderRadius: 14, padding: "12px",
                  fontFamily: "var(--font-display)", fontSize: 15, color: EA.ink,
                  cursor: "pointer", transform: "skewX(-4deg)",
                  boxShadow: `3px 3px 0 ${EA.ink}`,
                }}
              >
                <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>✏️ NOUVEAU MESSAGE</span>
              </button>
            </div>
          </>
        )}

        {/* ── DMs tab — nouvelle conversation ── */}
        {!activeConvId && tab === "dms" && showNewDm && (
          <>
            <div style={{ padding: "12px 18px 8px", borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
              <button
                onClick={() => setShowNewDm(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 700 }}
              >← Retour</button>
            </div>
            <div style={{ padding: "12px 18px 8px" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                Joueurs disponibles
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {onlinePlayers.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, padding: "24px" }}>
                  Aucun joueur en ligne pour l'instant.
                </div>
              )}
              {onlinePlayers.map(p => (
                <button
                  key={p.player_id}
                  onClick={() => handleStartDm(p)}
                  disabled={pendingDm}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 18px",
                    background: "none", border: "none",
                    borderBottom: `1px solid rgba(255,255,255,0.06)`,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <Avatar name={p.pseudo} src={p.avatar_url ?? null} color={EA.cyan} size={36} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-3deg)" }}>
                    {p.pseudo.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Conversation view ── */}
        {activeConvId && (
          <>
            <div ref={dmRef} style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {activeMessages.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, paddingTop: 40 }}>
                  Commencez la conversation !
                </div>
              )}
              {activeMessages.map(m => {
                const isMe = m.sender_id === myId;
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ maxWidth: "80%" }}>
                      <div style={{
                        background: isMe ? EA.pink : "rgba(255,255,255,0.08)",
                        border: `2px solid ${isMe ? EA.ink : "rgba(255,255,255,0.1)"}`,
                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "8px 12px",
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                        color: isMe ? EA.ink : EA.white,
                        wordBreak: "break-word",
                      }}>{m.content}</div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2, textAlign: isMe ? "right" : "left" }}>
                        {fmtTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleSendDm} style={{ padding: "12px 18px 16px", borderTop: `2px solid rgba(255,255,255,0.08)`, display: "flex", gap: 8 }}>
              <input
                ref={dmInput$}
                value={dmInput}
                onChange={e => setDmInput(e.target.value)}
                placeholder={`Message à ${activeConvPseudo}…`}
                maxLength={500}
                disabled={sendingDm}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.07)", border: `2px solid rgba(255,255,255,0.15)`,
                  borderRadius: 12, padding: "10px 14px",
                  fontFamily: "var(--font-sans)", fontSize: 13, color: EA.white,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!dmInput.trim() || sendingDm}
                style={{
                  background: EA.pink, border: `2px solid ${EA.ink}`,
                  borderRadius: 12, padding: "0 16px",
                  fontFamily: "var(--font-display)", fontSize: 14, color: EA.ink,
                  cursor: !dmInput.trim() || sendingDm ? "default" : "pointer",
                  opacity: !dmInput.trim() ? 0.4 : 1,
                  boxShadow: `2px 2px 0 ${EA.ink}`,
                  transition: "opacity 0.15s",
                }}
              >↑</button>
            </form>
          </>
        )}
      </div>
    </ChatCtx.Provider>
  );
}
