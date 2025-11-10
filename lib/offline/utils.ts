export function uuid(): string {
    return crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
    });
    }
    
    
    export function isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
    }
    
    
    export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
    });
    }