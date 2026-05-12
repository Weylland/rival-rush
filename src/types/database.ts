export type GameType = "pfc" | "morpion" | "puissance4" | "reflexe";
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
}

export interface LeaderboardEntry {
  player_id: string;
  pseudo: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
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
