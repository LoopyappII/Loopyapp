import ContactoContent from "@/components/ContactoContent";

export const metadata = {
  title: "Contacto · Loopy",
  description:
    "Escríbenos o llámanos. Nuestra oficina está en Marla Center, Murcia.",
  alternates: { canonical: "/contacto" },
};

export default function ContactoPage() {
  return <ContactoContent />;
}
