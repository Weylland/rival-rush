import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { ChatProvider } from "./chat/ChatSystem";

export default async function GameLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) return <>{children}</>;

  return (
    <ChatProvider myId={session.playerId} myPseudo={session.pseudo}>
      {children}
    </ChatProvider>
  );
}
