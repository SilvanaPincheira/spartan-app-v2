import Link from "next/link";

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

export default function GestionProspeccionHome() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold text-[#1f4ed8] mb-2">CRM · Gestión de Prospección</h1>
      <div className="text-gray-600 mb-6">
        Módulos operativos para captación, bandeja, carga RRSS, histórico y asignaciones.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          title="Nuevo Prospecto"
          desc="Crea leads y oportunidades desde cero, registra origen, estado, prioridad y seguimiento."
          href="/crm/gestionprospeccion/nuevo"
          icon="🧩"
          cta="Crear prospecto →"
        />

        <Card
          title="Bandeja"
          desc="Revisa el listado principal, filtra por estado y gestiona el flujo de seguimiento."
          href="/crm/gestionprospeccion/bandeja"
          icon="📥"
          cta="Ir a bandeja →"
        />

        <Card
          title="RRSS (Importar)"
          desc="Importa y normaliza registros desde RRSS para alimentarlos a la bandeja."
          href="/crm/gestionprospeccion/rrss"
          icon="🌐"
          cta="Ir al importador →"
        />

        <Card
          title="Mis asignados"
          desc="Muestra solo tus casos asignados y te permite priorizar y cerrar avances."
          href="/crm/gestionprospeccion/bandeja/asignados"
          icon="👤"
          cta="Ir a mis asignados →"
        />

        <Card
          title="Histórico"
          desc="Consulta cierres y actividad histórica, auditoría y trazabilidad de cambios."
          href="/crm/gestionprospeccion/historico"
          icon="🕒"
          cta="Ir al histórico →"
        />

        <Card
          title="Distribución (Jefaturas)"
          desc="Asigna y redistribuye casos entre usuarios (visible/usable solo para jefaturas)."
          href="/crm/gestionprospeccion/distribucion"
          icon="🧭"
          cta="Ir a distribución →"
        />
      </div>
    </div>
  );
}
