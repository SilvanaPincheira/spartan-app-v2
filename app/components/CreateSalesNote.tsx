"use client";

import { useState } from "react";

type Status =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "issued"
  | "cancelled";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function CreateSalesNote() {
  const [form, setForm] = useState({
    customer_id: "",
    note_date: todayISO(),
    related_quote: "",
    subtotal: "",
    tax: "",
    total: "",
    total_amount: "",
    status: "draft" as Status,
    document_number: "",
    pdf_url: "",
    created_by: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const update = (k: string, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!form.customer_id) {
      setErr("Ingresa el Customer ID (UUID del cliente).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customer_id: form.customer_id.trim(),
        note_date: form.note_date || todayISO(),
        related_quote: form.related_quote || null,
        subtotal: form.subtotal ? Number(form.subtotal) : 0,
        tax: form.tax ? Number(form.tax) : 0,
        total: form.total ? Number(form.total) : 0,
        total_amount: form.total_amount ? Number(form.total_amount) : null,
        status: form.status,
        document_number: form.document_number || null,
        pdf_url: form.pdf_url || null,
        created_by: form.created_by || null,
        notes: form.notes?.trim() || null,
      };

      const res = await fetch("/api/sales-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error al crear la nota.");

      setMsg(`✅ Nota creada con ID: ${json.data.id}`);
      // Limpia algunos campos pero conserva customer_id y status
      setForm((s) => ({
        ...s,
        note_date: todayISO(),
        related_quote: "",
        subtotal: "",
        tax: "",
        total: "",
        total_amount: "",
        document_number: "",
        pdf_url: "",
        created_by: "",
        notes: "",
      }));
    } catch (e: any) {
      setErr(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">
        ➕ Crear Nota de Venta
      </h2>

      {msg && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          Customer ID (UUID) *
          <input
            value={form.customer_id}
            onChange={(e) => update("customer_id", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="83d97533-83fb-4808-a480-0c2154ef3dbb"
            required
          />
        </label>

        <label className="text-sm">
          Fecha
          <input
            type="date"
            value={form.note_date}
            onChange={(e) => update("note_date", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>

        <label className="text-sm">
          Related Quote (UUID)
          <input
            value={form.related_quote}
            onChange={(e) => update("related_quote", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="opcional"
          />
        </label>

        <label className="text-sm">
          Subtotal
          <input
            type="number"
            inputMode="decimal"
            value={form.subtotal}
            onChange={(e) => update("subtotal", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 text-right"
            placeholder="0"
          />
        </label>

        <label className="text-sm">
          Impuesto (tax)
          <input
            type="number"
            inputMode="decimal"
            value={form.tax}
            onChange={(e) => update("tax", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 text-right"
            placeholder="0"
          />
        </label>

        <label className="text-sm">
          Total
          <input
            type="number"
            inputMode="decimal"
            value={form.total}
            onChange={(e) => update("total", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 text-right"
            placeholder="0"
          />
        </label>

        <label className="text-sm">
          Total (numeric)
          <input
            type="number"
            inputMode="decimal"
            value={form.total_amount}
            onChange={(e) => update("total_amount", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 text-right"
            placeholder="ej: 250000"
          />
        </label>

        <label className="text-sm">
          Estado
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            <option value="draft">draft</option>
            <option value="sent">sent</option>
            <option value="accepted">accepted</option>
            <option value="rejected">rejected</option>
            <option value="issued">issued</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>

        <label className="text-sm">
          Nº Documento
          <input
            value={form.document_number}
            onChange={(e) => update("document_number", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="opcional"
          />
        </label>

        <label className="text-sm">
          PDF URL
          <input
            value={form.pdf_url}
            onChange={(e) => update("pdf_url", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="https://..."
          />
        </label>

        <label className="text-sm">
          Creado por
          <input
            value={form.created_by}
            onChange={(e) => update("created_by", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="usuario o email"
          />
        </label>

        <label className="text-sm md:col-span-2">
          Notas
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            rows={3}
            placeholder="Observaciones…"
          />
        </label>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className={`rounded px-4 py-2 text-white ${loading ? "bg-zinc-400" : "bg-[#2B6CFF] hover:bg-[#1F5AE6]"}`}
          >
            {loading ? "Guardando..." : "Guardar Nota de Venta"}
          </button>
          <button
            type="button"
            className="rounded bg-zinc-200 px-3 py-2 text-sm hover:bg-zinc-300"
            onClick={() =>
              setForm({
                customer_id: "",
                note_date: todayISO(),
                related_quote: "",
                subtotal: "",
                tax: "",
                total: "",
                total_amount: "",
                status: "draft",
                document_number: "",
                pdf_url: "",
                created_by: "",
                notes: "",
              })
            }
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
}

