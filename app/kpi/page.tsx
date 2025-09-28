import Link from "next/link";

export default function KpiIndexPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#2B6CFF] mb-6">
        📈 Panel KPI
      </h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/kpi/alertas-clientes-comodatos"
          className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold mb-2">🚨 Alertas Comodatos</h2>
          <p className="text-sm text-zinc-600">
            Monitoreo de clientes con comodatos activos sin ventas recientes.
          </p>
        </Link>
      </div>
    </div>
  );
}
