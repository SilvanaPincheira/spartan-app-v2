"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ---------------- Gauge SVG sin dependencias ---------------- */
function Gauge({ value = 0, size = 260 }: { value?: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const angle = (-90 + (v / 100) * 180) * (Math.PI / 180);

  const polar = (cx: number, cy: number, r: number, a: number) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  });
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const p0 = polar(cx, cy, r, a0);
    const p1 = polar(cx, cy, r, a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };

  const w = size;
  const h = Math.round(size * 0.6);
  const cx = w / 2;
  const cy = h;
  const r = Math.round(w * 0.42);
  const stroke = Math.max(8, Math.round(size * 0.06));

  const needleLen = r - stroke / 2;
  const needle = polar(cx, cy, needleLen, angle);

  return (
    <svg width={w} height={h + 8} viewBox={`0 0 ${w} ${h + 8}`}>
      <path d={arc(cx, cy, r, -Math.PI / 2, Math.PI / 2)} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <path d={arc(cx, cy, r, -Math.PI / 2, -Math.PI / 6)} stroke="#ef4444" strokeWidth={stroke} fill="none" />
      <path d={arc(cx, cy, r, -Math.PI / 6, Math.PI / 6)} stroke="#f59e0b" strokeWidth={stroke} fill="none" />
      <path d={arc(cx, cy, r, Math.PI / 6, Math.PI / 2)} stroke="#22c55e" strokeWidth={stroke} fill="none" />
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#2B6CFF" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={6} fill="#1d4ed8" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={h - stroke * 0.3} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111827">
        {Math.round(v)}%
      </text>
    </svg>
  );
}

/* ---------------- Datos de ejemplo ---------------- */
const topVendedores = [
  { name: "Alexandra", ventas: 12000000 },
  { name: "Cristian", ventas: 10800000 },
  { name: "Silvana", ventas: 9500000 },
  { name: "Nelson", ventas: 8800000 },
  { name: "Valentina", ventas: 7900000 },
];

const topProductos = [
  { name: "Desinfectante X", ventas: 9500000 },
  { name: "Limpiador Multiuso", ventas: 8300000 },
  { name: "Detergente Industrial", ventas: 7200000 },
  { name: "Aromatizante", ventas: 6100000 },
  { name: "Pasta Pulidora", ventas: 5900000 },
];

/* ---------------- Pantalla principal ---------------- */
export default function GerencialPanel() {
  const [menu, setMenu] = useState("Inicio");

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-800">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-zinc-200 p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#2B6CFF] mb-4">SPARTAN ONE GERENCIAL</h1>
          <nav className="space-y-1">
            {[
              "Inicio",
              "Facturación",
              "Productos",
              "Comodatos",
              "Ejecutivos",
              "Metas",
              "Rendimiento",
              "Login",
            ].map((item) => (
              <button
                key={item}
                onClick={() => setMenu(item)}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  menu === item
                    ? "bg-[#2B6CFF] text-white"
                    : "hover:bg-zinc-100 text-zinc-700"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <p className="text-xs text-zinc-400 text-center">© 2025 SpartanOne</p>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <header className="bg-white shadow-sm rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#2B6CFF]">{menu}</h2>
            <p className="text-sm text-zinc-600">Panel de indicadores gerenciales</p>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-sm">{new Date().toLocaleDateString("es-CL", { dateStyle: "full" })}</p>
            <p className="font-semibold text-emerald-600">🚀 Información consolidada en tiempo real</p>
          </div>
        </header>

        {/* Tarjetas principales */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { titulo: "Ventas del mes", valor: "$11.000.000", color: "blue", delta: "+9,8%" },
            { titulo: "Cumplimiento Meta", valor: "82%", color: "emerald" },
            { titulo: "Pedidos Pendientes", valor: "14", color: "orange" },
          ].map((card, i) => (
            <div
              key={i}
              className={`bg-${card.color}-50 border border-${card.color}-200 rounded-xl p-4 text-center shadow-sm`}
            >
              <h3 className="text-sm font-medium text-zinc-600">{card.titulo}</h3>
              <p className={`text-2xl font-bold text-${card.color}-600`}>{card.valor}</p>
              {card.delta && <p className="text-xs text-emerald-600 mt-1">▲ {card.delta}</p>}
            </div>
          ))}
        </div>

        {/* Gauge horizontal */}
        <div className="flex justify-center bg-white shadow rounded-2xl py-8">
          <div className="w-[600px]">
            <Gauge value={82} size={260} />
            <p className="text-center text-sm mt-2 font-medium text-zinc-700">
              Cumplimiento Global de Ventas
            </p>
          </div>
        </div>

        {/* Reportes inferiores */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h3 className="font-semibold text-[#2B6CFF] mb-3">Top 5 Vendedores</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topVendedores}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="ventas" fill="#2B6CFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h3 className="font-semibold text-[#2B6CFF] mb-3">Top 5 Productos Más Vendidos</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProductos}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="ventas" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
