import { redirect } from "next/navigation";

export default function LoopIndexPage({ params }: { params: { id: string } }) {
  redirect(`/loop/${params.id}/mapa`);
}
