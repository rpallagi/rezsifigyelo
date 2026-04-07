import "@/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/app/provider";
import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: {
    default: "Rezsi Figyelő — Közüzemi mérőállás nyilvántartó",
    template: "%s | Rezsi Figyelő",
  },
  description:
    "Közüzemi mérőállás nyilvántartó webapp bérlők és ingatlan tulajdonosok számára. Mérőállás rögzítés, fogyasztás követés, számlázás.",
  keywords: [
    "rezsi",
    "mérőállás",
    "közüzemi",
    "bérlő",
    "bérbeadó",
    "fogyasztás",
    "számlázás",
  ],
  authors: [{ name: "Rezsi Figyelő" }],
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
