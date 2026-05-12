import type { Metadata } from "next";
import { Righteous, Nunito } from "next/font/google";
import { getSession } from "@/lib/auth";
import { PresenceProvider } from "@/components/PresenceProvider";
import { ChallengeNotifier } from "@/components/ChallengeNotifier";
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
  title: "ExpressionArena",
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

  return (
    <html lang="fr" className={`${righteous.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full">
        {session && (
          <>
            <PresenceProvider playerId={session.playerId} pseudo={session.pseudo} />
            <ChallengeNotifier playerId={session.playerId} />
          </>
        )}
        {children}
      </body>
    </html>
  );
}
