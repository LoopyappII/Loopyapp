import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import SupportChat from "@/components/SupportChat";
import BackgroundDecor from "@/components/BackgroundDecor";
import { FAVICON_SRC } from "@/lib/favicon";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loopy",
  description: "Compartí tu ubicación en tiempo real, de forma simple y segura",
  manifest: "/manifest.json",
  icons: {
    icon: FAVICON_SRC,
    shortcut: FAVICON_SRC,
    apple: FAVICON_SRC,
  },
};

export const viewport: Viewport = {
  themeColor: "#c94fae",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-ES" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased bg-white text-loopy-900">
        <BackgroundDecor />
        <RegisterSW />
        {children}
        <SupportChat />
      </body>
    </html>
  );
}
