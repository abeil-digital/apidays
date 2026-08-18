import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Test typo (14/08/2026, voir CONTEXTE.md) — remplace la pile système par une
// police web chargée réellement (Inter n'était référencée que par son nom,
// jamais chargée, donc jamais réellement utilisée).
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Apidays — Espace Salarié",
  description: "Gestion des congés et RTT — Espace Salarié",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`h-full antialiased ${manrope.variable}`}>
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
