// app/crm/gestionprospeccion/page.tsx
import Link from "next/link";

type CardItem = {
  title: string;
  desc: string;
  href: string;
  icon: string;
  badge?: string;
};

export default function GestionProspeccionPage() {
  const cards: CardItem[] = [
    {
      title: "Prospección (Nuevo)",
      desc: "Crea leads y oportunidades desde cero, registra origen, estado, prioridad y seguimiento.",
      href: "/crm/gestionprospeccion/nuevo",
      icon: "🧩",
    },
    {
      title: "Bandeja",
      desc: "Revisa el listado principal, filtra por estado y gestiona el flujo de seguimiento.",
      href: "/crm/gestionprospeccion/bandeja",
      icon: "📥",
    },
    {
      title: "RRSS (Importar)",
      desc: "Importa y normaliza registros desde RRSS para alimentarlos a la bandeja.",
      href: "/crm/gestionprospeccion/rrss",
      icon: "🌐",
    },
    {
      title: "Mis asignados",
      desc: "Muestra solo tus casos asignados y te permite priorizar y cerrar avances.",
      href: "/crm/gestionprospeccion/bandeja/asignados",
      icon: "👤",
      badge: "Opcional",
    },
    {
      title: "Histórico",
      desc: "Consulta cierres y actividad histórica, auditoría y trazabilidad de cambios.",
      href: "/crm/gestionprospeccion/historico",
      icon: "🕒",
    },
    {
      title: "Distribución (Jefaturas)",
      desc: "Asigna y redistribuye casos entre usuarios (visible/usable solo para jefaturas).",
      href: "/crm/gestionprospeccion/distribucion",
      icon: "🧭",
    },
    {
      title: "Reportería",
      desc: "KPIs del CRM: conversiones, tiempos de respuesta, estados y rendimiento.",
      href: "/crm/gestionprospeccion/reporteria",
      icon: "📊",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1f4ed8]">CRM</h1>
        <p className="text-gray-600 mt-1">
          Gestión de Prospección: captura, seguimiento y control de leads/oportunidades.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.href}
            className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold text-[#1f4ed8]">
                  {c.title}
                </h2>
                <div className="text-2xl">{c.icon}</div>
              </div>

              {c.badge && (
                <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  {c.badge}
                </span>
              )}

              <p className="text-gray-600 mt-3">{c.desc}</p>
            </div>

            <div className="mt-5">
              <Link
                href={c.href}
                className="text-[#1f4ed8] font-semibold hover:underline"
              >
                Ir al módulo →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
