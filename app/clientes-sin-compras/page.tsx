"use client";

import { useState } from "react";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxDyX6bc4a6BezqqYfxu5uneavhp6rI3uuSW2kMjTpERN7Q1J7DsTc5PpuNgbqTuHrP0Q/exec";

  async function handleActualizarEmails() {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(SCRIPT_URL);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setMessage(data.message || "Operación completada");
    } catch (error: any) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <button
        className={`px-4 py-2 bg-blue-600 text-white rounded ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={handleActualizarEmails}
        disabled={loading}
      >
        {loading ? "Actualizando…" : "Actualizar Emails"}
      </button>

      {message && (
        <p className="mt-4">{message}</p>
      )}
    </div>
  );
}
