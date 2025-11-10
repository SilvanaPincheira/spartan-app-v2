import { useCallback, useEffect, useMemo, useState } from "react";
import { queueAll, queueRemove, queueUpdateStatus } from "@/lib/offline/queue";
import { OfflineDoc } from "@/types/offline";
import { useOnlineStatus } from "./useOnlineStatus";


export function useOfflineSync() {
const online = useOnlineStatus();
const [pending, setPending] = useState<OfflineDoc[]>([]);
const [isSyncing, setIsSyncing] = useState(false);


const refresh = useCallback(async () => {
const all = await queueAll();
setPending(all);
}, []);


const count = useMemo(() => pending.length, [pending]);


const syncNow = useCallback(async () => {
if (!online) return;
const all = await queueAll();
if (!all.length) return;


setIsSyncing(true);
for (const doc of all) {
try {
await queueUpdateStatus(doc.id, "syncing", doc.retries);
const res = await fetch(doc.endpoint, {
method: doc.method,
headers: {
'Content-Type': 'application/json',
'X-Idempotency-Key': doc.id,
...(doc.headers || {}),
},
body: JSON.stringify({ ...doc.payload, attachments: doc.attachments }),
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
await queueRemove(doc.id);
} catch (err) {
const retries = (doc.retries || 0) + 1;
await queueUpdateStatus(doc.id, "failed", retries);
}
}
setIsSyncing(false);
await refresh();
}, [online, refresh]);


useEffect(() => { refresh(); }, [refresh]);
useEffect(() => { if (online) syncNow(); }, [online, syncNow]);


return { pending, count, isSyncing, refresh, syncNow, online };
}