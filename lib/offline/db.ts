const DB_NAME = "spartan_offline_db";
const STORE = "queue";
const VERSION = 1;


function openDB(): Promise<IDBDatabase> {
return new Promise((resolve, reject) => {
const req = indexedDB.open(DB_NAME, VERSION);
req.onupgradeneeded = () => {
const db = req.result;
if (!db.objectStoreNames.contains(STORE)) {
db.createObjectStore(STORE, { keyPath: "id" });
}
};
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
});
}


export async function dbPut<T>(value: T & { id: string }): Promise<void> {
const db = await openDB();
await new Promise<void>((resolve, reject) => {
const tx = db.transaction(STORE, "readwrite");
tx.oncomplete = () => resolve();
tx.onerror = () => reject(tx.error);
tx.objectStore(STORE).put(value);
});
}


export async function dbGetAll<T>(): Promise<T[]> {
const db = await openDB();
return await new Promise<T[]>((resolve, reject) => {
const tx = db.transaction(STORE, "readonly");
const req = tx.objectStore(STORE).getAll();
req.onsuccess = () => resolve(req.result as T[]);
req.onerror = () => reject(req.error);
});
}


export async function dbDelete(id: string): Promise<void> {
const db = await openDB();
await new Promise<void>((resolve, reject) => {
const tx = db.transaction(STORE, "readwrite");
tx.oncomplete = () => resolve();
tx.onerror = () => reject(tx.error);
tx.objectStore(STORE).delete(id);
});
}