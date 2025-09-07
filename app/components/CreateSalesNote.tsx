"use client";

import { useState } from "react";

type DocStatus = "draft" | "sent" | "accepted" | "rejected" | "issued" | "cancelled";

export default function CreateSalesNote() {
  const [customerId, setCustomerId] = useState("83d97533-83fb-4808-a480-0c2154ef3dbb"); 
  const [totalAmount, setTotalAmount] = useState<number>(250000);
  const [status, setStatus] = useState<DocStatus>("draft");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setResultId(null);
    try {
      const res = await fetch("/api/sales-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          total_amount: Number(totalAmount),
          status,
          notes: notes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la nota de venta");
      setResultId(json.data?.id || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3 bg-white">
      <h3 className="text-sm font-semibold">➕ Crear Nota de Venta</h3>
      <label className="block text-sm">
        Customer ID
        <input
          className="mt-1 w-full rounded border px-2 py-1"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Total
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1"
          value={totalAmount}
          onChange={(e) => setTotalAmount(Number(e.target.value))}
        />
      </label>
      <label className="block text-sm">
        Estado
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as DocStatus)}
        >
          <option value="draft">draft</option>
          <option value="sent">sent</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
          <option value="issued">issued</option>
          <option value="cancelled">cancelled</option>
        </select>
      </label>
      <label className="block text-sm">
        Notas
        <textarea
          className="mt-1 w-full rounded border px-2 py-1"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Creando..." : "Crear Nota de Venta"}
      </button>
      {resultId && <div className="text-green-600">✅ Creada con ID: {resultId}</div>}
      {error && <div className="text-red-600">❌ {error}</div>}
    </div>
  );
}
