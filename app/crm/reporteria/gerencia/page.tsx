import Link from "next/link";

function Card({
  title,
  desc,
  href,
  icon,
  cta = "Entrar →",
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

export default function ReporteriaGerenciaHome() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold text-[#1f4ed8] mb-6">
        Reportería Gerencial
      </h1>

      <p className="text-gray-600 mb-8">
        Paneles de control para jefaturas y gerencia comercial.  
        Accede a una vista ejecutiva resumida o al detalle por ejecutivo.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title="Resumen Gerencial"
          desc="Indicadores clave del CRM: estados, conversiones, carga de trabajo y resultados globales."
          href="/crm/reporteria/gerencia/resumen"
          icon="📊"
          cta="Ver resumen →"
        />

        <Card
          title="Detalle por Ejecutivo"
          desc="Análisis detallado de oportunidades, estados, tiempos de gestión y desempeño individual."
          href="/crm/reporteria/gerencia/detalle"
          icon="📋"
          cta="Ver detalle →"
        />
      </div>
    </div>
  );
}
