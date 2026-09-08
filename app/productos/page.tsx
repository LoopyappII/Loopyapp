import ProductosContent from "@/components/ProductosContent";

export const metadata = {
  title: "Productos · Loopy",
  description:
    "Loopy se adapta a cada grupo: descubrí los casos de uso para compartir ubicación en tiempo real en familia, en pareja o entre amigos.",
  alternates: { canonical: "/productos" },
};

export default function ProductosPage() {
  return <ProductosContent />;
}
