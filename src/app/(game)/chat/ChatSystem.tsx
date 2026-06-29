"use client";

import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState, useTransition,
} from "react";
import { usePathname } from "next/navigation";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import {
  sendLobbyMessage, sendDirectMessage,
  getOrCreateConversation, markConversationRead,
} from "./actions";
import { sendRoomMessage } from "@/app/(game)/room/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LobbyMsg {
  id: string; player_id: string; pseudo: string;
  content: string; created_at: string;
  avatar_url?: string | null;
  avatar_color?: string | null;
}

interface Conv {
  id: string; p1_id: string; p2_id: string;
  otherPseudo: string; otherAvatarUrl: string | null; otherAvatarColor?: string | null;
  lastContent: string | null; lastAt: string | null; lastSenderId: string | null;
  unread: number;
}

interface DMsg {
  id: string; conversation_id: string; sender_id: string;
  pseudo: string; content: string; created_at: string; deleted?: boolean;
}

interface OnlinePlayer {
  player_id: string; pseudo: string; avatar_url?: string | null; avatar_color?: string | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ChatCtxValue {
  openDM: (recipientId: string, recipientPseudo: string) => void;
  totalUnread: number;
  /** Déclare l'adversaire courant (page de jeu) → le bouton chat ouvre sa conversation. */
  setGameOpponent: (opponent: { id: string; pseudo: string } | null) => void;
}

const ChatCtx = createContext<ChatCtxValue>({ openDM: () => {}, totalUnread: 0, setGameOpponent: () => {} });
export const useChatOpen = () => useContext(ChatCtx);

/**
 * À appeler dans une page de jeu : enregistre l'adversaire le temps de la partie.
 * Quand un adversaire est enregistré, le bouton chat flottant ouvre directement
 * la conversation privée avec lui.
 */
export function useGameOpponent(opponentId: string, opponentPseudo: string) {
  const { setGameOpponent } = useContext(ChatCtx);
  useEffect(() => {
    setGameOpponent({ id: opponentId, pseudo: opponentPseudo });
    return () => setGameOpponent(null);
  }, [opponentId, opponentPseudo, setGameOpponent]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// AudioContext singleton — créé lors du premier geste utilisateur
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    return _audioCtx;
  } catch { return null; }
}

function unlockAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function playDmSound() {
  try {
    if (localStorage.getItem("ea_sounds_enabled") === "false") return;
    const ctx = getAudioCtx();
    if (!ctx || ctx.state === "suspended") return;
    const notes = [1047, 1319]; // Do5, Mi5
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {}
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// ── ChatProvider ──────────────────────────────────────────────────────────────

interface RoomMembership { id: string; name: string; code: string }

export function ChatProvider({
  children, myId, myPseudo, roomMemberships, blockedUserIds = [],
}: {
  children: React.ReactNode; myId: string; myPseudo: string;
  roomMemberships: RoomMembership[];
  blockedUserIds?: string[];
}) {
  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);

  // Local memberships — seeded from server prop, enriched client-side when needed
  const [localMemberships, setLocalMemberships] = useState<RoomMembership[]>(roomMemberships);
  useEffect(() => { setLocalMemberships(roomMemberships); }, [roomMemberships]);

  // Derive the active room from the current URL — only when actually inside /room/[code]/...
  const pathname = usePathname();
  const { activeRoomId, activeRoomName } = useMemo(() => {
    const match = pathname?.match(/^\/room\/([^/?#]+)/);
    if (!match) return { activeRoomId: null, activeRoomName: null };
    const code = decodeURIComponent(match[1]).toLowerCase();
    const room = localMemberships.find(r => r.code.toLowerCase() === code);
    return room
      ? { activeRoomId: room.id, activeRoomName: room.name }
      : { activeRoomId: null, activeRoomName: null };
  }, [pathname, localMemberships]);

  // When on /room/CODE but the room isn't in our membership list yet (just joined,
  // layout server re-render not propagated yet), fetch it directly from the client.
  useEffect(() => {
    const match = pathname?.match(/^\/room\/([^/?#]+)/);
    if (!match) return;
    const code = decodeURIComponent(match[1]).toUpperCase();
    if (localMemberships.some(r => r.code.toUpperCase() === code)) return;
    const supabase = createClient();
    supabase.from("rooms").select("id, name, code").eq("code", code).maybeSingle()
      .then(({ data: room }) => {
        if (!room) return;
        setLocalMemberships(prev => {
          if (prev.some(r => r.id === room.id)) return prev;
          return [...prev, { id: room.id as string, name: room.name as string, code: room.code as string }];
        });
      });
  }, [pathname, localMemberships]);

  const [isOpen, setIsOpen]               = useState(false);
  const [gameOpponent, setGameOpponent]   = useState<{ id: string; pseudo: string } | null>(null);
  const [tab, setTab]                     = useState<"lobby" | "dms">("lobby");
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [activeConvPseudo, setActiveConvPseudo] = useState("");

  const [lobbyMessages, setLobbyMessages] = useState<LobbyMsg[]>([]);
  const avatarCacheRef = useRef<Map<string, string | null>>(new Map());
  const colorCacheRef  = useRef<Map<string, string | null>>(new Map());
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeMessages, setActiveMessages] = useState<DMsg[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [showNewDm, setShowNewDm]         = useState(false);
  const [dmSearch, setDmSearch]           = useState("");
  const [dmAllPlayers, setDmAllPlayers]   = useState<OnlinePlayer[]>([]);
  const [dmLoading, setDmLoading]         = useState(false);

  const [lobbyInput, setLobbyInput]       = useState("");
  const [dmInput, setDmInput]             = useState("");
  const [sendingLobby, startLobby]        = useTransition();
  const [sendingDm, startDm]              = useTransition();
  const [pendingDm, startPendingDm]       = useTransition();

  const desktop = useIsDesktop();

  const pushedHistoryRef = useRef(false);

  const lobbyRef    = useRef<HTMLDivElement>(null);
  const dmRef       = useRef<HTMLDivElement>(null);
  const lobbyInput$ = useRef<HTMLInputElement>(null);
  const dmInput$    = useRef<HTMLInputElement>(null);
  // Empêche le son pendant le chargement initial des messages
  const soundReadyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { soundReadyRef.current = true; }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Back-gesture interception ─────────────────────────────────────────────

  // Push a fake history entry when chat opens so the back gesture closes it.
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ chatOpen: true }, "");
      pushedHistoryRef.current = true;
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePop = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        setIsOpen(false);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Close chat and clean up the fake history entry when closed programmatically.
  const closeChat = useCallback(() => {
    setIsOpen(false);
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadLobby = useCallback(async () => {
    // Clear immediately so we never show stale messages from the previous room/lobby
    setLobbyMessages([]);
    const supabase = createClient();
    // If in a room, load room chat; otherwise load global lobby chat
    const { data: msgs } = activeRoomId
      ? await supabase.from("room_chat").select("*").eq("room_id", activeRoomId).order("created_at", { ascending: true }).limit(100)
      : await supabase.from("lobby_chat").select("*").order("created_at", { ascending: true }).limit(100);
    if (!msgs) return;

    const ids = [...new Set(msgs.map(m => m.player_id))];
    if (ids.length > 0) {
      const { data: players } = await supabase.from("players").select("id, avatar_url, avatar_color").in("id", ids);
      for (const p of players ?? []) {
        avatarCacheRef.current.set(p.id, (p.avatar_url as string | null) ?? null);
        colorCacheRef.current.set(p.id, (p.avatar_color as string | null) ?? null);
      }
    }
    setLobbyMessages(
      msgs
        .filter(m => !blockedSet.has(m.player_id))
        .map(m => ({ ...m, avatar_url: avatarCacheRef.current.get(m.player_id) ?? null, avatar_color: colorCacheRef.current.get(m.player_id) ?? null }))
    );
  }, [activeRoomId, blockedSet]);

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
      supabase.from("players").select("id, pseudo, avatar_url, avatar_color").in("id", partnerIds),
      supabase.from("conversation_reads").select("conversation_id, read_at").eq("player_id", myId),
      supabase.from("direct_messages").select("conversation_id, sender_id, content, created_at")
        .in("conversation_id", convIds).eq("deleted", false).order("created_at", { ascending: false }).limit(convIds.length * 3),
    ]);

    const playerMap = new Map((players ?? []).map(p => [p.id, p]));
    const readMap   = new Map((reads ?? []).map(r => [r.conversation_id, r.read_at]));

    // Last message per conversation
    const lastMsgMap = new Map<string, { sender_id: string; content: string; created_at: string }>();
    for (const m of lastMsgs ?? []) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
    }

    const convs: Conv[] = rawConvs
      .filter(c => {
        const partnerId = c.p1_id === myId ? c.p2_id : c.p1_id;
        return !blockedSet.has(partnerId);
      })
      .map(c => {
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
          otherAvatarColor: (partner?.avatar_color as string | null) ?? null,
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
      .eq("deleted", false)
      .order("created_at", { ascending: true }).limit(100);
    if (data) setActiveMessages(data);
  }, []);

  const loadOnlinePlayers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("presence").select("player_id, pseudo")
      .neq("player_id", myId);
    if (data) setOnlinePlayers(data.filter(p => !blockedSet.has(p.player_id)));
  }, [myId, blockedSet]);

  // ── Lazy-load all players for new DM panel ────────────────────────────────

  useEffect(() => {
    if (!showNewDm) { setDmSearch(""); return; }
    setDmLoading(true);
    const supabase = createClient();
    supabase
      .from("players")
      .select("id, pseudo, avatar_url, avatar_color")
      .neq("id", myId)
      .then(({ data }) => {
        if (data) {
          setDmAllPlayers(
            data
              .filter(p => !blockedSet.has(p.id as string))
              .map(p => ({
                player_id: p.id as string,
                pseudo: p.pseudo as string,
                avatar_url: (p.avatar_url as string | null) ?? null,
                avatar_color: (p.avatar_color as string | null) ?? null,
              }))
          );
        }
        setDmLoading(false);
      });
  }, [showNewDm, myId, blockedSet]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadLobby();
    loadConversations();
  }, [loadLobby, loadConversations]);

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    const lobbyTable = activeRoomId ? "room_chat" : "lobby_chat";
    const lobbyFilter = activeRoomId ? { event: "INSERT" as const, schema: "public", table: "room_chat", filter: `room_id=eq.${activeRoomId}` } : { event: "INSERT" as const, schema: "public", table: "lobby_chat" };

    const lobbyCh = supabase.channel("lobby-chat-sys")
      .on("postgres_changes", lobbyFilter, async (p) => {
        const raw = p.new as LobbyMsg;
        if (blockedSet.has(raw.player_id)) return;
        if (!avatarCacheRef.current.has(raw.player_id)) {
          const { data: player } = await supabase.from("players").select("avatar_url, avatar_color").eq("id", raw.player_id).maybeSingle();
          avatarCacheRef.current.set(raw.player_id, (player?.avatar_url as string | null) ?? null);
          colorCacheRef.current.set(raw.player_id, (player?.avatar_color as string | null) ?? null);
        }
        const msg: LobbyMsg = { ...raw, avatar_url: avatarCacheRef.current.get(raw.player_id) ?? null, avatar_color: colorCacheRef.current.get(raw.player_id) ?? null };
        setLobbyMessages(prev => [...prev.slice(-99), msg]);
      }).subscribe();

    const dmCh = supabase.channel("dm-sys")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (p) => {
        const msg = p.new as DMsg;
        if (msg.sender_id !== myId && blockedSet.has(msg.sender_id)) return;

        // Son de notification pour les DMs reçus
        if (
          soundReadyRef.current &&
          msg.sender_id !== myId &&
          (!isOpen || activeConvId !== msg.conversation_id)
        ) {
          playDmSound();
        }

        // Active conversation — replace any matching optimistic message instead of duplicating
        setActiveMessages(prev => {
          if (prev.length === 0 || prev[0].conversation_id !== msg.conversation_id) return prev;
          if (prev.some(m => m.id === msg.id)) return prev; // already added
          const withoutOptimistic = prev.filter(m =>
            !(m.id.startsWith("opt-") && m.sender_id === msg.sender_id && m.content === msg.content)
          );
          return [...withoutOptimistic, msg];
        });
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
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (p) => {
        const updated = p.new as DMsg;
        if (updated.deleted) {
          setActiveMessages(prev => prev.filter(m => m.id !== updated.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(lobbyCh); supabase.removeChannel(dmCh); };
  }, [myId, activeConvId, activeRoomId, isOpen, loadConversations, blockedSet]);

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
    unlockAudio();
    setLobbyInput("");
    startLobby(async () => {
      if (activeRoomId) await sendRoomMessage(activeRoomId, txt);
      else await sendLobbyMessage(txt);
    });
    lobbyInput$.current?.focus();
  }

  function handleSendDm(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConvId) return;
    const txt = dmInput.trim();
    if (!txt || sendingDm) return;
    unlockAudio();
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

  const drawerW = desktop ? 400 : "100dvw";

  return (
    <ChatCtx.Provider value={{ openDM, totalUnread, setGameOpponent }}>
      {children}

      {/* Floating chat button — bas-gauche mobile, bas-droite desktop */}
      <button
        aria-label="Ouvrir le chat"
        onClick={() => {
          unlockAudio();
          if (isOpen) closeChat();
          else if (gameOpponent) openDM(gameOpponent.id, gameOpponent.pseudo);
          else setIsOpen(true);
        }}
        style={{
          position: "fixed",
          bottom: 20,
          left: desktop ? "auto" : 16,
          right: desktop ? 16 : "auto",
          zIndex: 210,
          height: 56,
          width: desktop ? "auto" : 56,
          padding: desktop ? "0 20px 0 14px" : 0,
          borderRadius: desktop ? 999 : "50%",
          background: isOpen ? RR.cyan : RR.pink,
          border: `2.5px solid ${RR.ink}`,
          color: RR.white, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: desktop ? 8 : 0,
          boxShadow: `4px 4px 0 ${RR.ink}`,
          transition: "background 0.2s, transform 0.1s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = `2px 2px 0 ${RR.ink}`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `4px 4px 0 ${RR.ink}`; }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {desktop && (
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: 0.5 }}>
            {isOpen ? "FERMER" : "CHAT"}
          </span>
        )}
        {totalUnread > 0 && !isOpen && (
          <span style={{
            position: "absolute", top: -5, right: desktop ? -5 : -5,
            minWidth: 20, height: 20, borderRadius: 10,
            background: RR.butter, border: `2px solid ${RR.ink}`,
            fontFamily: "var(--font-display)", fontSize: 11,
            color: RR.ink, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", fontWeight: 900,
          }}>{totalUnread > 9 ? "9+" : totalUnread}</span>
        )}
      </button>

      {/* Drawer backdrop (mobile) */}
      {isOpen && (
        <div
          aria-hidden
          onClick={closeChat}
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
        background: RR.violetDeep,
        borderLeft: `2.5px solid ${RR.ink}`,
        boxShadow: `-6px 0 0 ${RR.ink}`,
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
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: RR.white, transform: "skewX(-4deg)" }}>
              {activeConvId ? activeConvPseudo.toUpperCase() : "💬 CHAT"}
            </span>
          </div>
          <button
            onClick={closeChat}
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
                  borderBottom: tab === t ? `3px solid ${RR.cyan}` : "3px solid transparent",
                  fontFamily: "var(--font-display)", fontSize: 14,
                  color: tab === t ? RR.cyan : "rgba(255,255,255,0.4)",
                  cursor: "pointer", transition: "color 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {t === "lobby" ? (activeRoomId ? `🏠 ${activeRoomName?.toUpperCase() ?? "SALLE"}` : "🌐 LOBBY") : (
                  <>💬 MESSAGES{conversations.reduce((n, c) => n + c.unread, 0) > 0 && (
                    <span style={{
                      background: RR.pink, borderRadius: 8, padding: "1px 5px",
                      fontSize: 10, color: RR.white,
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
                      <Avatar name={m.pseudo} src={m.avatar_url ?? null} color={m.avatar_color ?? RR.cyan} size={28} />
                    )}
                    <div style={{ maxWidth: "75%" }}>
                      {!isMe && (
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: RR.cyan, marginBottom: 3, transform: "skewX(-3deg)" }}>
                          {m.pseudo}
                        </div>
                      )}
                      <div style={{
                        background: isMe ? RR.cyan : "rgba(255,255,255,0.08)",
                        border: `2px solid ${isMe ? RR.ink : "rgba(255,255,255,0.1)"}`,
                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "8px 12px",
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                        color: isMe ? RR.ink : RR.white,
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
                  fontFamily: "var(--font-sans)", fontSize: 13, color: RR.white,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!lobbyInput.trim() || sendingLobby}
                style={{
                  background: RR.cyan, border: `2px solid ${RR.ink}`,
                  borderRadius: 12, padding: "0 16px",
                  fontFamily: "var(--font-display)", fontSize: 14, color: RR.ink,
                  cursor: !lobbyInput.trim() || sendingLobby ? "default" : "pointer",
                  opacity: !lobbyInput.trim() ? 0.4 : 1,
                  boxShadow: `2px 2px 0 ${RR.ink}`,
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
                    <Avatar name={c.otherPseudo} src={c.otherAvatarUrl} color={c.otherAvatarColor ?? RR.cyan} size={40} />
                    {c.unread > 0 && (
                      <span style={{
                        position: "absolute", top: -3, right: -3,
                        width: 14, height: 14, borderRadius: "50%",
                        background: RR.pink, border: `2px solid ${RR.violetDeep}`,
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: c.unread > 0 ? RR.white : "rgba(255,255,255,0.7)", transform: "skewX(-3deg)" }}>
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
                  width: "100%", background: RR.pink, border: `2.5px solid ${RR.ink}`,
                  borderRadius: 14, padding: "12px",
                  fontFamily: "var(--font-display)", fontSize: 15, color: RR.ink,
                  cursor: "pointer", transform: "skewX(-4deg)",
                  boxShadow: `3px 3px 0 ${RR.ink}`,
                }}
              >
                <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>✏️ NOUVEAU MESSAGE</span>
              </button>
            </div>
          </>
        )}

        {/* ── DMs tab — nouvelle conversation ── */}
        {!activeConvId && tab === "dms" && showNewDm && (() => {
          const onlineIds = new Set(onlinePlayers.map(p => p.player_id));
          const q = dmSearch.trim().toLowerCase();
          const filtered = dmAllPlayers
            .filter(p => !q || p.pseudo.toLowerCase().includes(q))
            .sort((a, b) => {
              const ao = onlineIds.has(a.player_id), bo = onlineIds.has(b.player_id);
              if (ao !== bo) return ao ? -1 : 1;
              return a.pseudo.localeCompare(b.pseudo);
            });
          return (
            <>
              <div style={{ padding: "12px 18px 8px", borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                <button
                  onClick={() => setShowNewDm(false)}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 700 }}
                >← Retour</button>
              </div>
              {/* Search input */}
              <div style={{ padding: "10px 14px", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Rechercher un joueur…"
                  value={dmSearch}
                  onChange={e => setDmSearch(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.07)",
                    border: `1.5px solid ${dmSearch ? RR.cyan : "rgba(255,255,255,0.15)"}`,
                    borderRadius: 10, padding: "8px 12px",
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                    color: RR.white, outline: "none",
                    transition: "border-color 0.15s",
                  }}
                />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {dmLoading && (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, padding: "24px" }}>
                    Chargement…
                  </div>
                )}
                {!dmLoading && filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, padding: "24px" }}>
                    {q ? `Aucun joueur pour "${q}"` : "Aucun autre joueur inscrit."}
                  </div>
                )}
                {!dmLoading && filtered.map(p => {
                  const isOnline = onlineIds.has(p.player_id);
                  return (
                    <button
                      key={p.player_id}
                      onClick={() => handleStartDm(p)}
                      disabled={pendingDm}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 18px",
                        background: "none", border: "none",
                        borderBottom: `1px solid rgba(255,255,255,0.06)`,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        opacity: pendingDm ? 0.6 : 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Avatar name={p.pseudo} src={p.avatar_url ?? null} color={p.avatar_color ?? RR.cyan} size={34} />
                        <span style={{
                          position: "absolute", bottom: 0, right: 0,
                          width: 9, height: 9, borderRadius: "50%",
                          background: isOnline ? "#1ee29a" : "rgba(255,255,255,0.2)",
                          border: `1.5px solid ${RR.violetDeep}`,
                        }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: RR.white, transform: "skewX(-3deg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.pseudo.toUpperCase()}
                        </div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: isOnline ? "#1ee29a" : "rgba(255,255,255,0.3)", marginTop: 1 }}>
                          {isOnline ? "En ligne" : "Hors ligne"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

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
                        background: isMe ? RR.pink : "rgba(255,255,255,0.08)",
                        border: `2px solid ${isMe ? RR.ink : "rgba(255,255,255,0.1)"}`,
                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "8px 12px",
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                        color: isMe ? RR.ink : RR.white,
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
                  fontFamily: "var(--font-sans)", fontSize: 13, color: RR.white,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!dmInput.trim() || sendingDm}
                style={{
                  background: RR.pink, border: `2px solid ${RR.ink}`,
                  borderRadius: 12, padding: "0 16px",
                  fontFamily: "var(--font-display)", fontSize: 14, color: RR.ink,
                  cursor: !dmInput.trim() || sendingDm ? "default" : "pointer",
                  opacity: !dmInput.trim() ? 0.4 : 1,
                  boxShadow: `2px 2px 0 ${RR.ink}`,
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
