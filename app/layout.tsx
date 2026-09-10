import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import SupportChat from "@/components/SupportChat";
import BackgroundDecor from "@/components/BackgroundDecor";
import CookieConsent from "@/components/CookieConsent";
import InstallPrompt from "@/components/InstallPrompt";
import { FAVICON_SRC } from "@/lib/favicon";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = "https://www.directloopy.com";
const DESCRIPTION = "Comparte tu ubicación en tiempo real, de forma simple y segura";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Loopy",
  description: DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Loopy",
    statusBarStyle: "default",
  },
  icons: {
    icon: FAVICON_SRC,
    shortcut: FAVICON_SRC,
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Loopy",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Loopy",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loopy",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#c94fae",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-ES" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased bg-white text-loopy-900">
        {/* Captura `beforeinstallprompt` durante el parseo del HTML, antes de
            que hidrate React: en visitas repetidas (service worker ya
            activo) el evento puede dispararse antes de que monte
            components/InstallPrompt y un listener tardío lo perdería.
            Guarda el evento en window.__loopyBIP y avisa con "loopy:bip".
            Ver lib/useInstallPrompt.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{window.__loopyBIP=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__loopyBIP=e;window.dispatchEvent(new Event("loopy:bip"))});window.addEventListener("appinstalled",function(){window.__loopyBIP=null})}catch(e){}})()`,
          }}
        />
        <BackgroundDecor />
        <RegisterSW />
        {children}
        <SupportChat />
        <CookieConsent />
        <InstallPrompt />
      </body>
    </html>
  );
}
