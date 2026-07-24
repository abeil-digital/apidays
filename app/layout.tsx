import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apidays — Espace Salarié",
  description: "Gestion des congés et RTT — Espace Salarié",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
