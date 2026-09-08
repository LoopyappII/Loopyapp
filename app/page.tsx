import type { Metadata } from "next";
import MagnifierLanding from "@/components/MagnifierLanding";

export const metadata: Metadata = {
  title: "Loopy · Comparte tu ubicación en tiempo real",
  description:
    "Crea un Loopy y comparte tu ubicación en tiempo real con tu familia o pareja, o supervisa a quien más te importa. Ubicación compartida, sin complicaciones.",
  alternates: { canonical: "/" },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Loopy",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web, iOS, Android",
  description:
    "Aplicación para compartir ubicación en tiempo real entre familia, pareja o grupos de amigos.",
  url: "https://www.directloopy.com",
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <MagnifierLanding />
    </>
  );
}
