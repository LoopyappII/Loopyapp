"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
  keywords: string[];
}

const SUPPORT_EMAIL = "info@directloopy.com";

const FAQS: FaqItem[] = [
  {
    q: "¿Qué es Loopy?",
    a: "Loopy es una app para compartir tu ubicación en tiempo real de forma simple y segura, organizada en \"Loopys\" (grupos).",
    keywords: ["que es loopy", "loopy", "aplicacion", "app"],
  },
  {
    q: "¿Qué es un Loopy?",
    a: "Un Loopy es un grupo donde sus miembros comparten ubicación entre sí, según el modo que elijan: Espejo o Supervisión.",
    keywords: ["que es un loop", "loop", "grupo"],
  },
  {
    q: "Diferencia entre Modo Espejo y Supervisión",
    a: "En Modo Espejo eres el responsable del grupo: ves a todos sus miembros en directo, geolocalizados y sin errores, y ellos también te ven a ti. En Modo Supervisión, la persona responsable ve la ubicación de quienes acompaña, pero no al revés.",
    keywords: ["espejo", "supervision", "modo", "diferencia", "roles"],
  },
  {
    q: "¿Cómo invito a alguien a mi Loopy?",
    a: "Compártele el código de invitación que aparece en tu Loopy. Esa persona lo ingresa desde \"Unirse a un Loopy\" en su panel.",
    keywords: ["invitar", "codigo", "invitacion", "unirse", "sumar", "agregar"],
  },
  {
    q: "¿Qué son las zonas seguras?",
    a: "Son áreas que tú defines (como tu casa o el colegio). Loopy te avisa cuando un miembro entra o sale de esa zona.",
    keywords: ["zona segura", "zona", "alerta", "entra", "sale"],
  },
  {
    q: "¿Cuánto cuesta Loopy?",
    a: "Los primeros 2 días son gratis, sin tarjeta. Después la suscripción es de 14€ por mes y puedes cancelarla cuando quieras.",
    keywords: ["precio", "cuesta", "costo", "suscripcion", "pago", "plan", "gratis"],
  },
  {
    q: "¿Quién puede ver mi ubicación?",
    a: "Solo los miembros de tu Loopy, según el modo elegido. La base de datos aplica reglas de seguridad para que nadie fuera del Loopy pueda verla.",
    keywords: ["privacidad", "seguridad", "quien ve", "ubicacion", "datos"],
  },
  {
    q: "¿Funciona en iPhone y Android?",
    a: "Sí. Loopy es una PWA: la abres desde el navegador y puedes instalarla en la pantalla de inicio en ambos sistemas.",
    keywords: ["iphone", "android", "celular", "movil", "instalar", "pwa"],
  },
  {
    q: "¿Cómo cancelo mi cuenta?",
    a: "Escríbenos por este chat o a nuestro email y te ayudamos a cancelarla sin vueltas.",
    keywords: ["cancelar", "baja", "eliminar cuenta", "borrar cuenta"],
  },
  {
    q: "Olvidé mi contraseña",
    a: "Por ahora escríbenos con el email de tu cuenta y te ayudamos a restablecer tu contraseña manualmente.",
    keywords: ["contraseña", "password", "olvide", "recuperar", "clave"],
  },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function matchFaq(input: string): FaqItem | null {
  const norm = normalize(input);
  if (!norm) return null;
  let best: FaqItem | null = null;
  let bestScore = 0;
  for (const item of FAQS) {
    let score = 0;
    for (const kw of item.keywords) {
      if (norm.includes(normalize(kw))) score += kw.split(" ").length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

interface Msg {
  from: "bot" | "user";
  text: string;
  escalate?: boolean;
}

export default function SupportChat() {
  const pathname = usePathname();
  // /loop/[id]/* routes render BottomTabBar (components/loop/BottomTabBar.tsx),
  // sticky at the bottom of a max-w-md phone-width shell. This bubble is
  // fixed bottom-4 right-4 with a much higher z-index, so on that route
  // family it sits directly on top of the tab bar's rightmost (SOS) tab.
  // Shift it up to clear the tab bar's height + safe-area inset there;
  // every other route keeps the original bottom-4.
  const isLoopRoute = pathname?.startsWith("/loop/") ?? false;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "bot",
      text: "¡Hola! Soy el asistente de soporte de Loopy 👋 Elige una pregunta de abajo o escribe la tuya.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const match = matchFaq(trimmed);
    setMessages((prev) => [
      ...prev,
      { from: "user", text: trimmed },
      match
        ? { from: "bot", text: match.a }
        : {
            from: "bot",
            text: "No tengo una respuesta clara para eso todavía. Te ofrezco mandarlo directo a nuestro equipo por email para que te respondan a la brevedad.",
            escalate: true,
          },
    ]);
    setInput("");
  }

  function handleQuickQuestion(item: FaqItem) {
    setMessages((prev) => [...prev, { from: "user", text: item.q }, { from: "bot", text: item.a }]);
  }

  function escalate(prefill?: string) {
    const transcript = messages.map((m) => `${m.from === "bot" ? "Loopy" : "Yo"}: ${m.text}`).join("\n");
    const body = `${prefill ? prefill + "\n\n" : ""}Conversación previa:\n${transcript}`.slice(0, 1800);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      "Consulta de soporte - Loopy"
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  }

  return (
    <div
      className={`fixed ${
        isLoopRoute ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-4"
      } right-4 z-[9999] flex flex-col items-end`}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mb-3 w-[92vw] max-w-[340px] h-[440px] max-h-[70vh] bg-white rounded-2xl border border-loopy-100 shadow-[0_12px_44px_rgba(35,42,82,0.25)] flex flex-col overflow-hidden origin-bottom-right"
          >
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white shrink-0">
            <span className="font-semibold text-sm">Soporte Loopy</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
              className="text-white/90 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-loopy-50/40">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    m.from === "user"
                      ? "bg-loopy-900 text-white rounded-br-sm"
                      : "bg-white text-loopy-900 border border-loopy-100 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {m.text}
                  {m.escalate && (
                    <button
                      type="button"
                      onClick={() => escalate()}
                      className="mt-2 block w-full text-center text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white shadow-sm"
                    >
                      Enviar por email a soporte
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-3 pb-2 flex gap-1.5 flex-wrap border-t border-loopy-50 pt-2 max-h-20 overflow-y-auto shrink-0">
            {FAQS.map((item) => (
              <button
                key={item.q}
                type="button"
                onClick={() => handleQuickQuestion(item)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-loopy-100 text-loopy-700 hover:border-bridge/50 hover:text-loopy-900 transition-colors"
              >
                {item.q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 px-3 py-2 border-t border-loopy-100 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              className="flex-1 px-3 py-2 rounded-full border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            />
            <button
              type="submit"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white shadow-[0_4px_16px_rgba(131,76,156,0.5)]"
              aria-label="Enviar"
            >
              <Send size={15} />
            </button>
          </form>

          <button
            type="button"
            onClick={() => escalate("Tengo una consulta que no encontré en las preguntas frecuentes.")}
            className="text-[11px] text-loopy-700/70 hover:text-loopy-900 underline underline-offset-2 pb-2 shrink-0 self-center"
          >
            ¿No encuentras tu respuesta? Escríbenos por email
          </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir chat de soporte"
        className="w-14 h-14 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white shadow-cta hover:shadow-cta-hover flex items-center justify-center"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
}
