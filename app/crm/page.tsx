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

export default function CrmHome() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold text-[#1f4ed8] mb-6">CRM</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          title="Gestión de Prospección"
          desc="Captación de leads: alta manual/CSV, bandeja, asignaciones, RRSS, histórico."
          href="/crm/gestionprospeccion"
          icon="🧩"
          cta="Entrar →"
        />

        <Card
          title="Gestión de Ventas"
          desc="Pipeline comercial, oportunidades, propuestas, seguimiento y cierre."
          href="/crm/gestionventas"
          icon="📈"
          cta="Entrar →"
        />

        <Card
          title="Distribución de Carga"
          desc="Asignación/redistribución operativa de registros (jefaturas / control)."
          href="/crm/distribucioncarga"
          icon="🧭"
          cta="Entrar →"
        />

        <Card
          title="Reportería"
          desc="KPIs del CRM: conversiones, tiempos de respuesta, estados y rendimiento."
          href="/crm/reporteria/gerencia"
          icon="📊"
          cta="Ver KPIs →"
        />
      </div>
    </div>
  );
}
