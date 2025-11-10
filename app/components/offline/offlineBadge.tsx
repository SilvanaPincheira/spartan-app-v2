"use client";
import * as React from "react";
import { useOfflineSync } from "@/lib/hooks/useOfflineSync";


export default function OfflineBadge() {
const { online, count, isSyncing, syncNow } = useOfflineSync();


return (
<div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-lg bg-white/90 backdrop-blur">
<div className={`h-3 w-3 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
<span className="text-sm font-medium">
{online ? 'Conectado' : 'Sin conexión'}
</span>
<span className="text-xs text-neutral-500">Pendientes: {count}</span>
<button
onClick={syncNow}
disabled={!online || isSyncing}
className="text-xs rounded-md border px-2 py-1 disabled:opacity-50 hover:bg-neutral-50"
>
{isSyncing ? 'Sincronizando…' : 'Forzar sync'}
</button>
</div>
);
}