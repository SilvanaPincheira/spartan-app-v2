import { dbDelete, dbGetAll, dbPut } from "./db";
import { OfflineDoc, OfflineStatus } from "@/types/offline";




export async function queueAdd(doc: OfflineDoc) {
await dbPut<OfflineDoc>({ ...doc });
}


export async function queueAll(): Promise<OfflineDoc[]> {
return await dbGetAll<OfflineDoc>();
}


export async function queueRemove(id: string) {
await dbDelete(id);
}


export async function queueUpdateStatus(id: string, status: OfflineStatus, retries?: number) {
const all = await queueAll();
const found = all.find((d) => d.id === id);
if (!found) return;
found.status = status;
found.updatedAt = Date.now();
if (typeof retries === "number") found.retries = retries;
await dbPut(found);
}