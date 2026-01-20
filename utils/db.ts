// Basic IndexedDB wrapper for Local-First RO Scanner

const DB_NAME = "ro_scanner_db";
const DB_VERSION = 1;

export interface ScannedPart {
    id: string; // generated UUID or simple random string
    ro_id: string; // basically ro_number for local link
    barcode_value: string;
    quantity: number;
    created_at: string;
    updated_at: string;
}

export interface RO {
    id: string; // same as ro_number for simplicity in local or UUID
    ro_number: string;
    status: "draft" | "finalized";
    created_at: string;
    finalized_at?: string;
}

// Open DB Helper
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("IndexedDB not supported on server side"));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Store for ROs
            if (!db.objectStoreNames.contains("ros")) {
                const roStore = db.createObjectStore("ros", { keyPath: "ro_number" });
                roStore.createIndex("created_at", "created_at", { unique: false });
            }

            // Store for Parts
            if (!db.objectStoreNames.contains("parts")) {
                const partStore = db.createObjectStore("parts", { keyPath: "id" });
                partStore.createIndex("ro_id", "ro_id", { unique: false });
                partStore.createIndex("ro_id_barcode", ["ro_id", "barcode_value"], {
                    unique: true,
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ---------------------- RO Operations ----------------------

export async function createRO(roNumber: string): Promise<{ success: boolean; data?: RO; error?: string }> {
    try {
        const db = await openDB();
        const ro: RO = {
            id: roNumber.toUpperCase(),
            ro_number: roNumber.toUpperCase(),
            status: "draft",
            created_at: new Date().toISOString(),
        };

        return new Promise((resolve) => {
            const tx = db.transaction("ros", "readwrite");
            const store = tx.objectStore("ros");

            // Check existence first (optional, but good for error parity with supabase)
            const checkReq = store.get(ro.ro_number);
            checkReq.onsuccess = () => {
                if (checkReq.result) {
                    resolve({ success: false, error: "RO Number already exists" });
                } else {
                    store.put(ro);
                    tx.oncomplete = () => resolve({ success: true, data: ro });
                    tx.onerror = () => resolve({ success: false, error: "Failed to create RO" });
                }
            };

            checkReq.onerror = () => resolve({ success: false, error: "Database error" });
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getRecentROs(): Promise<{ success: boolean; data?: RO[]; error?: string }> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction("ros", "readonly");
            const store = tx.objectStore("ros");
            const index = store.index("created_at");
            // Getting all and sorting in JS because IndexedDB Cursor sort is primitive (only by key)
            const req = index.getAll();

            req.onsuccess = () => {
                const ros = (req.result || []).sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                resolve({ success: true, data: ros });
            };
            req.onerror = () => resolve({ success: false, error: "Failed to fetch ROs" });
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getRO(roNumber: string): Promise<{ success: boolean; data?: RO; error?: string }> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction("ros", "readonly");
            const store = tx.objectStore("ros");
            const req = store.get(roNumber);

            req.onsuccess = () => {
                if (req.result) resolve({ success: true, data: req.result });
                else resolve({ success: false, error: "RO not found" });
            };
            req.onerror = () => resolve({ success: false, error: "Failed to load RO" });
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function searchRO(query: string): Promise<{ success: boolean; data?: RO[]; error?: string }> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction("ros", "readonly");
            const store = tx.objectStore("ros");
            const req = store.getAll();

            req.onsuccess = () => {
                const all = req.result || [];
                const filtered = all
                    .filter(r => r.ro_number.includes(query.toUpperCase()))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 10);
                resolve({ success: true, data: filtered });
            };
            req.onerror = () => resolve({ success: false, error: "Search failed" });
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function finalizeRO(roNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
        const db = await openDB();
        const tx = db.transaction("ros", "readwrite");
        const store = tx.objectStore("ros");

        return new Promise((resolve) => {
            const req = store.get(roNumber);
            req.onsuccess = () => {
                const ro = req.result;
                if (!ro) {
                    resolve({ success: false, error: "RO not found" });
                    return;
                }

                ro.status = "finalized";
                ro.finalized_at = new Date().toISOString();

                const putReq = store.put(ro);
                putReq.onsuccess = () => resolve({ success: true });
                putReq.onerror = () => resolve({ success: false, error: "Failed to finalize" });
            };
            req.onerror = () => resolve({ success: false, error: "DB Error" });
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ---------------------- Part Operations ----------------------

export async function getScannedParts(roId: string): Promise<{ success: boolean; data?: ScannedPart[]; error?: string }> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction("parts", "readonly");
            const store = tx.objectStore("parts");
            const index = store.index("ro_id");
            const req = index.getAll(roId); // Get all parts for this RO

            req.onsuccess = () => {
                const parts = (req.result || []).sort(
                    (a, b) =>
                        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                );
                resolve({ success: true, data: parts });
            };
            req.onerror = () => resolve({ success: false, error: "Failed to load parts" });
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function scanPart(roId: string, barcode: string): Promise<{ success: boolean; data?: ScannedPart; error?: string }> {
    try {
        const db = await openDB();

        // 1. Verify RO is draft
        const roRes = await getRO(roId);
        if (!roRes.success || !roRes.data) return { success: false, error: "RO not found" };
        if (roRes.data.status !== "draft") return { success: false, error: "RO is finalized" };

        const tx = db.transaction("parts", "readwrite");
        const store = tx.objectStore("parts");
        const index = store.index("ro_id_barcode");

        return new Promise((resolve) => {
            const getReq = index.get([roId, barcode]);

            getReq.onsuccess = () => {
                const existing = getReq.result;

                if (existing) {
                    // Update
                    existing.quantity += 1;
                    existing.updated_at = new Date().toISOString();
                    store.put(existing);
                    tx.oncomplete = () => resolve({ success: true, data: existing });
                } else {
                    // Insert
                    const newPart: ScannedPart = {
                        id: crypto.randomUUID(),
                        ro_id: roId,
                        barcode_value: barcode,
                        quantity: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    store.add(newPart);
                    tx.oncomplete = () => resolve({ success: true, data: newPart });
                }
            };

            getReq.onerror = () => resolve({ success: false, error: "Scan failed" });
        });

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function updatePartQuantity(id: string, qty: number): Promise<{ success: boolean; error?: string }> {
    const db = await openDB();
    const tx = db.transaction("parts", "readwrite");
    const store = tx.objectStore("parts");

    return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => {
            const part = req.result;
            if (!part) { resolve({ success: false, error: "Part not found" }); return; }

            part.quantity = qty;
            part.updated_at = new Date().toISOString();
            store.put(part);
            resolve({ success: true });
        };
        req.onerror = () => resolve({ success: false, error: "Update failed" });
    });
}

export async function deletePart(id: string): Promise<{ success: boolean; error?: string }> {
    const db = await openDB();
    const tx = db.transaction("parts", "readwrite");
    const store = tx.objectStore("parts");
    store.delete(id);
    return new Promise(resolve => {
        tx.oncomplete = () => resolve({ success: true });
        tx.onerror = () => resolve({ success: false, error: "Delete failed" });
    });
}
