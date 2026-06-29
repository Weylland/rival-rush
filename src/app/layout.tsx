import type { Metadata } from "next";
import { Righteous, Nunito } from "next/font/google";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PresenceProvider } from "@/components/PresenceProvider";
import { ChallengeNotifier } from "@/components/ChallengeNotifier";
import { PushProvider } from "@/components/PushProvider";
import { NotifPrompt } from "@/components/NotifPrompt";
import { WarningNotifier } from "@/components/WarningNotifier";
import "./globals.css";

const righteous = Righteous({
  weight: "400",
  variable: "--font-righteous",
  subsets: ["latin"],
});

const nunito = Nunito({
  weight: ["400", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RivalRush",
  description: "Mini-jeux en duel · Fête de l'Expression",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  let isInvisible = false;
  if (session) {
    try {
      const { data: prefs } = await createAdminClient()
        .from("players")
        .select("is_invisible")
        .eq("id", session.playerId)
        .single();
      isInvisible = (prefs as { is_invisible?: boolean | null } | null)?.is_invisible ?? false;
    } catch {
      // Column may not exist yet — default to visible
    }
  }

  return (
    <html lang="fr" className={`${righteous.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full">
        {session && (
          <>
            <PresenceProvider playerId={session.playerId} pseudo={session.pseudo} isInvisible={isInvisible} />
            <ChallengeNotifier playerId={session.playerId} />
            <WarningNotifier playerId={session.playerId} />
            <PushProvider playerId={session.playerId} />
            <NotifPrompt />
          </>
        )}
        {children}
      </body>
    </html>
  );
}
