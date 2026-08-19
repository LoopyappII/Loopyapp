import Link from "next/link";
import { NavbarLogo } from "@/components/LoopyLogo";

export const metadata = {
  title: "Política de privacidad · Loopy",
};

export default function PrivacidadPage() {
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
              Política de privacidad
            </h1>
            <p className="text-xs text-loopy-700/60 mb-8">
              Última actualización: julio de 2026
            </p>

            <div className="space-y-6 text-sm leading-relaxed text-loopy-700">
              <p>
                En <strong className="text-loopy-900">Loopy</strong> nos tomamos en
                serio la protección de tus datos personales, especialmente de tu
                ubicación. Esta política explica qué datos recogemos, para qué los
                usamos y qué derechos tienes.
              </p>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  1. Responsable del tratamiento
                </h2>
                <p>
                  <strong className="text-loopy-900">LOOPER CASHLINE SL</strong>,
                  titular de la aplicación Loopy (loopy.company), es responsable
                  del tratamiento de tus datos personales. Puedes contactarnos en{" "}
                  <a
                    href="mailto:hola@loopy.company"
                    className="text-bridge font-medium hover:underline"
                  >
                    hola@loopy.company
                  </a>
                  .
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  2. Datos que recopilamos
                </h2>
                <p>Recopilamos los siguientes datos:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Datos de registro: nombre, correo electrónico y contraseña.</li>
                  <li>
                    Datos de ubicación geográfica precisa, únicamente mientras
                    usas la Aplicación y participas en un Loopy activo.
                  </li>
                  <li>
                    Datos de uso de la Aplicación (Loopys creados, zonas
                    definidas, eventos de entrada/salida de zonas).
                  </li>
                  <li>
                    Datos técnicos básicos necesarios para el funcionamiento del
                    servicio (identificador de sesión, tipo de dispositivo).
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  3. Finalidad y base legal
                </h2>
                <p>
                  Tratamos tus datos para prestar el Servicio (compartir
                  ubicación dentro de tus Loopys, gestionar tu cuenta y
                  suscripción), en base a la ejecución del contrato de uso
                  aceptado al registrarte (art. 6.1.b RGPD). El acceso a tu
                  ubicación se basa además en tu consentimiento explícito, que
                  puedes retirar en cualquier momento desactivando los permisos de
                  ubicación o abandonando el Loopy correspondiente.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  4. Con quién compartimos tus datos
                </h2>
                <p>
                  Tu ubicación solo es visible para los miembros del Loopy al que
                  perteneces, según el modo configurado (Espejo o Supervisión).
                  Además, utilizamos proveedores tecnológicos que actúan como
                  encargados del tratamiento para operar la Aplicación:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Supabase (base de datos y autenticación).</li>
                  <li>Vercel (alojamiento e infraestructura).</li>
                  <li>Resend (envío de correos transaccionales).</li>
                </ul>
                <p className="mt-2">
                  Estos proveedores pueden procesar datos fuera del Espacio
                  Económico Europeo; en esos casos se aplican garantías
                  adecuadas conforme al RGPD (como cláusulas contractuales
                  tipo). No vendemos ni cedemos tus datos a terceros con fines
                  publicitarios.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  5. Conservación de los datos
                </h2>
                <p>
                  Conservamos tus datos mientras mantengas tu cuenta activa. El
                  historial de ubicaciones se conserva por el tiempo mínimo
                  necesario para el funcionamiento del Servicio. Puedes solicitar
                  la eliminación de tu cuenta y datos asociados en cualquier
                  momento.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  6. Tus derechos
                </h2>
                <p>
                  Puedes ejercer en cualquier momento tus derechos de acceso,
                  rectificación, supresión, limitación, portabilidad y oposición
                  al tratamiento de tus datos, escribiendo a{" "}
                  <a
                    href="mailto:hola@loopy.company"
                    className="text-bridge font-medium hover:underline"
                  >
                    hola@loopy.company
                  </a>
                  . También tienes derecho a presentar una reclamación ante la
                  Agencia Española de Protección de Datos (AEPD) si consideras
                  que el tratamiento no se ajusta a la normativa vigente.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  7. Seguridad
                </h2>
                <p>
                  Aplicamos medidas técnicas y organizativas razonables para
                  proteger tus datos frente a accesos no autorizados, pérdida o
                  alteración, incluyendo cifrado en tránsito y controles de
                  acceso basados en autenticación.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  8. Menores de edad
                </h2>
                <p>
                  Loopy no está dirigido a menores de edad sin supervisión de un
                  adulto responsable. Si detectamos una cuenta creada por un
                  menor sin la debida autorización, procederemos a su
                  cancelación.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  9. Cookies y tecnologías similares
                </h2>
                <p>
                  Al acceder a la Aplicación te mostramos un aviso que te
                  permite aceptar o rechazar el uso de cookies no esenciales.
                  Utilizamos los siguientes tipos de cookies:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <strong className="text-loopy-900">
                      Cookies esenciales:
                    </strong>{" "}
                    las cookies de sesión de autenticación de Supabase, que
                    son necesarias para que el inicio de sesión funcione
                    correctamente. No son opcionales y no requieren tu
                    consentimiento previo.
                  </li>
                  <li>
                    <strong className="text-loopy-900">
                      Cookie no esencial:
                    </strong>{" "}
                    la cookie del widget de traducción de Google (googtrans),
                    que solo se activa si aceptas cookies en el aviso y sirve
                    únicamente para recordar el idioma que elegiste para
                    traducir la página.
                  </li>
                </ul>
                <p className="mt-2">
                  Tu elección (aceptar o rechazar) se guarda de forma local en
                  tu navegador (localStorage) y no se comparte con terceros.
                  Puedes cambiarla en cualquier momento borrando los datos o
                  las cookies del sitio desde la configuración de tu
                  navegador. No utilizamos cookies de publicidad de terceros.
                </p>
              </div>

              <div>
                <h2 className="text-base font-bold text-loopy-900 mb-2">
                  10. Cambios en esta política
                </h2>
                <p>
                  Podemos actualizar esta Política de Privacidad para reflejar
                  cambios legales o del Servicio. Te notificaremos cambios
                  relevantes a través de la Aplicación o por correo electrónico.
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
