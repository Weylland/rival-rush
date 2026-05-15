export type GameType = "pfc" | "morpion" | "puissance4" | "reflexe" | "naval" | "chess" | "nim" | "pig" | "mastermind" | "plus-ou-moins" | "duel-des";
export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";
export type GameStatus = "waiting" | "playing" | "finished";

export interface Player {
  id: string;
  pseudo: string;
  password: string;
  created_at: string;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  game_type: GameType;
  status: ChallengeStatus;
  created_at: string;
}

export interface Game {
  id: string;
  challenge_id: string;
  game_type: GameType;
  state: PFCState | MorpionState;
  current_turn: string | null;
  winner_id: string | null;
  status: GameStatus;
  created_at: string;
}

export interface PFCRound {
  round: number;
  moves: Record<string, "pierre" | "feuille" | "ciseaux">;
  winner_id: string | null;
}

export interface PFCState {
  rounds: PFCRound[];
  scores: Record<string, number>;
}

export type MorpionBoard = (string | null)[];

export interface MorpionState {
  board: MorpionBoard;
  scores: Record<string, number>;
}

export type Puissance4Board = (string | null)[]; // 42 cells, row * 7 + col, row 0 = top

export interface Puissance4State {
  board: Puissance4Board;
}

export interface TapRound {
  round: number;
  signal_at: string;
  winner_id: string;
  reaction_ms: number;
}

export interface TapState {
  rounds: TapRound[];
  scores: Record<string, number>;
  phase: "idle" | "armed";
  signal_at: string | null;
  current_round: number;
  ready: string[]; // player IDs who clicked "Prêt"
}

export interface NavalShip {
  id: number;
  name: string;
  size: number;
  cells: number[]; // flat indices 0-99 on a 10×10 grid
}

export interface NavalShot {
  cell: number;
  result: "miss" | "hit" | "sunk";
}

export interface NavalState {
  /** Which players have submitted their fleet placement */
  fleets_placed: Record<string, boolean>;
  /** Shots fired by each player */
  shots: Record<string, NavalShot[]>;
  /** Ships that have been fully sunk (revealed to both players) keyed by the defending player */
  sunk_ships: Record<string, NavalShip[]>;
  /** Full fleets revealed once the game is finished */
  revealed_ships?: Record<string, NavalShip[]>;
}

export interface MastermindGuess {
  player_id: string;
  guess: number[];
  blacks: number;
  whites: number;
}

export interface MastermindState {
  /** code is server-side only (game_secrets table) — never in broadcast state */
  guesses: MastermindGuess[];
  /** Only populated once the game is finished */
  revealed_code?: number[];
}

export interface PigState {
  scores: Record<string, number>;
  turn_total: number;
  last_roll: number | null;
}

export interface NimState {
  pile: number;
  initial_pile: number;
  last_taken: number | null;
  last_player_id: string | null;
}

export interface PlusOuMoinsGuess {
  player_id: string;
  value: number;
  feedback: "plus" | "moins" | "exact";
}

export interface PlusOuMoinsState {
  /** secret is server-side only (game_secrets table) — never in broadcast state */
  range_min: number;     // 1 initialement
  range_max: number;     // 100 initialement
  guesses: PlusOuMoinsGuess[];
  scores: Record<string, number>;
  current_round: number; // 1, 2 ou 3
}

export interface DuelDesRound {
  rolls: Record<string, number>; // playerId -> 1-6
  winner_id: string | null;      // null = tie
}

export interface DuelDesState {
  rounds: DuelDesRound[];
  scores: Record<string, number>;
  current_round: number;
}

export type RoomExpiration = "6h" | "12h" | "24h" | "7d" | "permanent";

export interface Room {
  id: string;
  name: string;
  code: string;
  host_id: string;
  is_public: boolean;
  password_hash: string | null;
  max_members: number | null;
  allowed_games: GameType[] | null;
  expires_at: string | null;
  is_open: boolean;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  player_id: string;
  joined_at: string;
}

export interface RoomInvitation {
  id: string;
  room_id: string;
  invited_by_id: string;
  invited_player_id: string;
  status: "pending" | "accepted" | "declined";
  expires_at: string;
  created_at: string;
}

export interface RoomChatMsg {
  id: string;
  room_id: string;
  player_id: string;
  pseudo: string;
  content: string;
  created_at: string;
  avatar_url?: string | null;
}

export interface RoomMemberWithPlayer {
  player_id: string;
  pseudo: string;
  avatar_url: string | null;
  joined_at: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

export interface LeaderboardEntry {
  player_id: string;
  pseudo: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  avatar_url?: string | null;
}

// Supabase Database types (utilisé pour typer createClient)
export interface Database {
  public: {
    Tables: {
      players: {
        Row: Player;
        Insert: Omit<Player, "id" | "created_at">;
        Update: Partial<Omit<Player, "id" | "created_at">>;
      };
      challenges: {
        Row: Challenge;
        Insert: Omit<Challenge, "id" | "created_at">;
        Update: Partial<Omit<Challenge, "id" | "created_at">>;
      };
      games: {
        Row: Game;
        Insert: Omit<Game, "id" | "created_at">;
        Update: Partial<Omit<Game, "id" | "created_at">>;
      };
      leaderboard: {
        Row: LeaderboardEntry;
        Insert: Omit<LeaderboardEntry, "pseudo">;
        Update: Partial<Omit<LeaderboardEntry, "player_id" | "pseudo">>;
      };
    };
  };
}
