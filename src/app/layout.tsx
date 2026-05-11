import type { Metadata } from "next";
import { Righteous, Nunito } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${righteous.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
