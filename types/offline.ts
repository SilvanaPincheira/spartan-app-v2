export type OfflineStatus = "queued" | "syncing" | "synced" | "failed";


export type AttachmentBase64 = {
name: string;
mime: string;
size: number;
dataBase64: string; // "data:<mime>;base64,<...>"
};


export type DocPayload = {
tipo: "NV" | "COT";
numeroTemporal?: string;
cliente: string;
rut?: string;
items: Array<{
codigo: string;
descripcion: string;
cantidad: number;
precioUnitario: number;
}>;
subtotal?: number;
total?: number;
comentarios?: string;
EMAIL_COL?: string;
};


export type OfflineDoc = {
id: string;
createdAt: number;
updatedAt: number;
retries: number;
status: OfflineStatus;
payload: DocPayload;
attachments?: AttachmentBase64[];
endpoint: string;
method: "POST" | "PUT";
headers?: Record<string, string>;
};