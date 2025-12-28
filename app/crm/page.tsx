import Link from "next/link";

const CRM_JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
    "carlos.avendano@spartan.cl",
    "hernan.lopez@spartan.cl",
    "walter.gonzalez@spartan.cl",
    "oscar.ortiz@spartan.cl",
    "juan.prieto@spartan.cl",

  ].map((x) => x.trim().toLowerCase())
);

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function Card({
  title,
  desc,
  href,
  icon,
  cta = "Ir al módulo →",
}: {
  title: string;
  desc: string;
  href: string;
  icon: string;
  cta?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold text-[#1f4ed8]">{title}</h2>
        <div className="text-3xl">{icon}</div>
      </div>

      <p className="text-gray-600 leading-relaxed">{desc}</p>

      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-2 text-[#1f4ed8] font-medium hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}

export default async function CrmHome() {
  // Si NO quieres lógica de sesión aquí, déjalo simple.
  // Si quieres ocultar "Distribución" por jefaturas, se hace con sesión (server o client).
  // Para no complicarte: lo dejamos visible y luego lo cerramos con RLS / validación en la página.

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold text-[#1f4ed8] mb-6">CRM</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          title="Prospección (Nuevo)"
          desc="Crea leads y oportunidades desde cero, registra origen, estado, prioridad y seguimiento."
          href="/crm/prospeccion"
          icon="🧩"
          cta="Ir al módulo →"
        />

        <Card
          title="Bandeja"
          desc="Revisa el listado principal, filtra por estado y gestiona el flujo de seguimiento."
          href="/crm/bandeja"
          icon="📥"
          cta="Ir a bandeja →"
        />

        <Card
          title="RRSS (Importar)"
          desc="Importa y normaliza registros desde RRSS para alimentarlos a la bandeja."
          href="/crm/bandeja/rrss"
          icon="🌐"
          cta="Ir al importador →"
        />

        <Card
          title="Mis asignados"
          desc="Muestra solo tus casos asignados y te permite priorizar y cerrar avances."
          href="/crm/bandeja/asignados"
          icon="👤"
          cta="Ir a mis asignados →"
        />

        <Card
          title="Histórico"
          desc="Consulta cierres y actividad histórica, auditoría y trazabilidad de cambios."
          href="/crm/bandeja/historico"
          icon="🕒"
          cta="Ir al histórico →"
        />

        <Card
          title="Distribución (Jefaturas)"
          desc="Asigna y redistribuye casos entre usuarios (visible/usable solo para jefaturas)."
          href="/crm/distribucion"
          icon="🧭"
          cta="Ir a distribución →"
        />

        <Card
          title="Reportería"
          desc="KPIs del CRM: conversiones, tiempos de respuesta, estados y rendimiento."
          href="/crm/reporteria"
          icon="📊"
          cta="Ir a reportería →"
        />
      </div>
    </div>
  );
}
