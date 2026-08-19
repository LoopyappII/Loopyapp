import Link from "next/link";
import { NavbarLogo } from "@/components/LoopyLogo";

export const metadata = {
  title: "Términos y condiciones · Loopy",
};

export default function TerminosPage() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <div className="relative z-10 flex flex-col flex-1">
        <header className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto w-full">
          <Link href="/">
            <NavbarLogo size={30} dark />
          </Link>
          <Link
            href="/"
            className="text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
          >
            &larr; Volver
          </Link>
        </header>

        <section className="flex-1 px-6 pb-16">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card border border-loopy-100 p-8 md:p-10">
            <h1 className="text-2xl md:text-3xl font-extrabold text-loopy-900 mb-1">
              Términos y condiciones de uso
            </h1>
            <p className="text-xs text-loopy-700/60 mb-8">
              Última actualización: julio de 2026
            </p>

            <div className="space-y-6 text-sm leading-relaxed text-loopy-700">
              <p>
                Los presentes Términos y Condiciones regulan el acceso y uso de la
                aplicación <strong className="text-loopy-900">Loopy</strong> (en
                adelante, "la Aplicación" o "el Servicio"), propiedad de{" "}
                <strong className="text-loopy-900">LOOPER CAPITAL SL</strong>{" "}
                (CIF B73946113), bajo la gestión de{" "}
                <strong className="text-loopy-900">LOOPER CASHLINE SL</strong>{" "}
                (CIF B73981417) (en adelante, "Loopy" o "nosotros"), disponible
                a través de{" "}
                <span className="text-loopy-900">loopy.company</span>. El uso de la
                Aplicación implica la aceptación plena de estos términos.
              </p>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  1. Objeto del servicio
                </h2>
                <p>
                  Loopy es una aplicación que permite crear grupos ("Loopys") para
                  compartir ubicación en tiempo real entre sus miembros, con dos
                  modalidades: <strong>Modo Espejo</strong> (todos los miembros se
                  ven entre sí) y <strong>Modo Supervisión</strong> (un supervisor
                  visualiza la ubicación de los demás miembros del Loopy). El
                  Servicio también permite definir zonas de interés y recibir
                  notificaciones al entrar o salir de ellas.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  2. Registro y cuenta de usuario
                </h2>
                <p>
                  Para usar Loopy es necesario crear una cuenta con un correo
                  electrónico válido y confirmar dicho correo. El usuario es
                  responsable de mantener la confidencialidad de sus credenciales
                  de acceso y de toda la actividad realizada desde su cuenta. El
                  usuario debe ser mayor de edad o contar con autorización de su
                  tutor legal para utilizar el Servicio.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  3. Uso de la ubicación
                </h2>
                <p>
                  El funcionamiento de Loopy requiere acceso a la ubicación
                  geográfica del dispositivo del usuario mientras la Aplicación
                  está en uso. El usuario controla en todo momento con quién
                  comparte su ubicación a través de los Loopys a los que se une, y
                  puede abandonar un Loopy en cualquier momento para dejar de
                  compartir su ubicación. Más detalles sobre el tratamiento de
                  estos datos en nuestra{" "}
                  <Link
                    href="/privacidad"
                    className="text-bridge font-medium hover:underline"
                  >
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  4. Planes y precios
                </h2>
                <p>
                  Loopy ofrece un periodo de prueba gratuito seguido de una
                  suscripción de pago según las condiciones indicadas en la
                  Aplicación en el momento de la contratación. Los precios pueden
                  actualizarse; cualquier cambio será comunicado con antelación
                  razonable. El usuario puede cancelar su suscripción en cualquier
                  momento desde los ajustes de su cuenta.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  5. Obligaciones del usuario
                </h2>
                <p>
                  El usuario se compromete a utilizar la Aplicación de forma
                  lícita, sin vulnerar derechos de terceros y, en particular, a no
                  crear Loopys ni compartir ubicación de terceras personas sin su
                  consentimiento expreso. El uso indebido del Servicio para
                  fines de acoso, control no consentido o vigilancia ilegítima
                  está expresamente prohibido y podrá dar lugar a la suspensión
                  de la cuenta.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  6. Propiedad intelectual
                </h2>
                <p>
                  El software, diseño, marca y demás elementos de Loopy son
                  propiedad de LOOPER CAPITAL SL (CIF B73946113), gestionados
                  por LOOPER CASHLINE SL (CIF B73981417), o de sus
                  licenciantes. No se concede al usuario ningún derecho sobre estos elementos más allá
                  del uso personal de la Aplicación conforme a estos términos.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  7. Limitación de responsabilidad
                </h2>
                <p>
                  Loopy se ofrece "tal cual". No garantizamos la disponibilidad
                  ininterrumpida del Servicio ni la exactitud absoluta de los
                  datos de geolocalización, que dependen de la tecnología del
                  dispositivo y la conectividad del usuario. Loopy no sustituye
                  sistemas de emergencia oficiales.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  8. Modificaciones
                </h2>
                <p>
                  Podemos actualizar estos Términos para reflejar cambios legales
                  o del Servicio. Notificaremos cambios relevantes a través de la
                  Aplicación o por correo electrónico.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  9. Legislación aplicable
                </h2>
                <p>
                  Estos Términos se rigen por la legislación española. Para
                  cualquier controversia, las partes se someten a los juzgados y
                  tribunales que correspondan conforme a la normativa de
                  protección de consumidores aplicable.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  10. Contacto
                </h2>
                <p>
                  Para cualquier consulta sobre estos Términos, puedes escribirnos
                  a{" "}
                  <a
                    href="mailto:info@directloopy.com"
                    className="text-bridge font-medium hover:underline"
                  >
                    info@directloopy.com
                  </a>
                  .
                </p>
              </div>

              <p className="text-xs text-loopy-700/50 pt-4 border-t border-loopy-100">
                Este documento es una plantilla general y no constituye
                asesoramiento legal. Recomendamos su revisión por un profesional
                del derecho antes de su publicación definitiva.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
