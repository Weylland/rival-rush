/** Résout les deux joueurs d'une partie du point de vue de `myId`. Pur. */

interface DuoInput {
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl?: string | null;
  p2AvatarUrl?: string | null;
  p1AvatarColor?: string | null;
  p2AvatarColor?: string | null;
}

export interface Duo {
  iAmP1: boolean;
  opponentId: string;
  myPseudo: string;
  opPseudo: string;
  myAvatarUrl: string | null;
  opAvatarUrl: string | null;
  myAvatarColor: string | null;
  opAvatarColor: string | null;
}

export function resolveDuo({
  myId, p1Id, p2Id, p1Pseudo, p2Pseudo,
  p1AvatarUrl = null, p2AvatarUrl = null,
  p1AvatarColor = null, p2AvatarColor = null,
}: DuoInput): Duo {
  const iAmP1 = myId === p1Id;
  return {
    iAmP1,
    opponentId: iAmP1 ? p2Id : p1Id,
    myPseudo: iAmP1 ? p1Pseudo : p2Pseudo,
    opPseudo: iAmP1 ? p2Pseudo : p1Pseudo,
    myAvatarUrl: iAmP1 ? p1AvatarUrl : p2AvatarUrl,
    opAvatarUrl: iAmP1 ? p2AvatarUrl : p1AvatarUrl,
    myAvatarColor: iAmP1 ? p1AvatarColor : p2AvatarColor,
    opAvatarColor: iAmP1 ? p2AvatarColor : p1AvatarColor,
  };
}
