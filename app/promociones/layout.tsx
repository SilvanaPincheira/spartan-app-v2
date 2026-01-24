"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PromocionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const Item = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 700,
          background: active ? "#111827" : "#f3f4f6",
          color: active ? "white" : "#111827",
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Promociones
      </h1>

      {/* Submenú */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Item href="/promociones/maquinas" label="Máquinas" />
        <Item href="/promociones/papeles" label="Papeles" />
      </div>

      {children}
    </div>
  );
}
