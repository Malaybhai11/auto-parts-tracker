"use client";

import { useState, useTransition, useEffect } from "react";
import { RO, ScannedPart, scanPart, updatePartQuantity, deletePart, finalizeRO } from "@/actions/ro-actions";
import Scanner from "@/components/Scanner";
import { Trash2, Edit2, Check, X, Loader2, AlertTriangle, Save, WifiOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RODetails({ ro, initialParts }: { ro: RO; initialParts: ScannedPart[] }) {
    const [parts, setParts] = useState<ScannedPart[]>(initialParts);
    const [isScanning, setIsScanning] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState<number>(0);
    const [error, setError] = useState("");
    const [pendingScans, setPendingScans] = useState<string[]>([]);
    const router = useRouter();

    // Load pending scans from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem(`pending_scans_${ro.id}`);
        if (saved) {
            setPendingScans(JSON.parse(saved));
        }
    }, [ro.id]);

    const savePendingScans = (scans: string[]) => {
        setPendingScans(scans);
        localStorage.setItem(`pending_scans_${ro.id}`, JSON.stringify(scans));
    };

    const handleScan = async (barcode: string) => {
        setIsScanning(false);

        startTransition(async () => {
            try {
                const res = await scanPart(ro.id, barcode);
                if (res.error) {
                    setError(res.error);
                } else {
                    router.refresh();
                }
            } catch (e) {
                // Network error likely
                const newPending = [...pendingScans, barcode];
                savePendingScans(newPending);
                setError("Offline: Scan saved locally. Sync when online.");
            }
        });
    };

    const handleSync = async () => {
        if (pendingScans.length === 0) return;

        setError("");
        let remaining = [...pendingScans];

        // Process sequentially to avoid race conditions
        const failed: string[] = [];

        for (const barcode of pendingScans) {
            try {
                const res = await scanPart(ro.id, barcode);
                if (res.error) {
                    failed.push(barcode);
                }
            } catch (e) {
                failed.push(barcode);
            }
        }

        savePendingScans(failed);
        router.refresh();

        if (failed.length === 0) {
            setError("");
        } else {
            setError("Some scans could not be synced. Check connection.");
        }
    };

    // Sync parts when initialParts updates
    if (initialParts !== parts && !isPending) {
        setParts(initialParts);
    }

    const handleUpdateQty = async (id: string) => {
        if (editQty < 1) return;
        startTransition(async () => {
            const res = await updatePartQuantity(id, editQty);
            if (res.error) setError(res.error);
            else {
                setEditingId(null);
                router.refresh();
            }
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this part?")) return;
        startTransition(async () => {
            const res = await deletePart(id);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    const handleFinalize = async () => {
        if (pendingScans.length > 0) {
            setError("Cannot finalize with pending offline scans. Please sync first.");
            return;
        }
        if (!confirm("Finalize this RO? This cannot be undone.")) return;
        startTransition(async () => {
            const res = await finalizeRO(ro.id, ro.ro_number);
            if (res.error) setError(res.error);
            else router.push("/");
        });
    };

    const isFinalized = ro.status === "finalized";

    return (
        <div className="container-mobile space-y-6 pb-20">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-mono">{ro.ro_number}</h1>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold mt-1 ${isFinalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {ro.status.toUpperCase()}
                    </span>
                </div>
                <button onClick={() => router.push("/")} className="text-gray-500">
                    <X className="w-6 h-6" />
                </button>
            </header>

            {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {pendingScans.length > 0 && (
                <div className="bg-orange-100 text-orange-800 p-3 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <WifiOff className="w-5 h-5" />
                        <span>{pendingScans.length} offline scans pending</span>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={isPending}
                        className="bg-orange-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sync
                    </button>
                </div>
            )}

            {/* Scanner */}
            {!isFinalized && (
                <section>
                    <Scanner
                        onScan={handleScan}
                        isScanning={isScanning}
                        setIsScanning={setIsScanning}
                    />
                </section>
            )}

            {/* Parts List */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Scanned Parts ({parts.length})</h2>

                <div className="space-y-3">
                    {parts.map((part) => (
                        <div key={part.id} className="card flex justify-between items-center">
                            <div className="flex-1">
                                <div className="font-mono font-bold text-lg">{part.barcode_value}</div>
                                <div className="text-sm text-gray-500">
                                    Added: {new Date(part.updated_at).toLocaleTimeString()}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {editingId === part.id ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            className="w-16 p-1 border rounded text-center"
                                            value={editQty}
                                            onChange={(e) => setEditQty(parseInt(e.target.value) || 0)}
                                        />
                                        <button onClick={() => handleUpdateQty(part.id)} className="text-green-600 p-1">
                                            <Save className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="text-gray-500 p-1">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl font-bold">x{part.quantity}</span>
                                        {!isFinalized && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingId(part.id);
                                                        setEditQty(part.quantity);
                                                    }}
                                                    className="text-blue-500 p-1 bg-blue-50 rounded"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(part.id)}
                                                    className="text-red-500 p-1 bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {parts.length === 0 && (
                        <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                            No parts scanned yet.
                        </div>
                    )}
                </div>
            </section>

            {/* Finalize Button */}
            {!isFinalized && parts.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                    <button
                        onClick={handleFinalize}
                        disabled={isPending}
                        className="btn btn-primary w-full bg-green-600 hover:bg-green-700 flex justify-center items-center gap-2"
                    >
                        {isPending ? <Loader2 className="animate-spin" /> : <Check className="w-5 h-5" />}
                        Finalize RO
                    </button>
                </div>
            )}
        </div>
    );
}
