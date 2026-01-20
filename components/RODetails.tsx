"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getScannedParts, scanPart, updatePartQuantity, deletePart, finalizeRO, RO, ScannedPart, getRO } from "@/utils/db";
import Scanner from "@/components/Scanner";
import { Trash2, Edit2, Check, X, Loader2, AlertTriangle, Save, RefreshCw, ChevronLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export default function RODetails({ roNumber }: { roNumber: string }) {
    const [ro, setRo] = useState<RO | null>(null);
    const [parts, setParts] = useState<ScannedPart[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState<number>(0);
    const [error, setError] = useState("");

    // Manual Entry State
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualBarcode, setManualBarcode] = useState("");
    const [manualConfirmOpen, setManualConfirmOpen] = useState(false);

    // Keyboard Buffer
    const [scanBuffer, setScanBuffer] = useState("");
    const [lastKeyTime, setLastKeyTime] = useState(0);

    const router = useRouter();
    const manualInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [roNumber]);

    const loadData = async () => {
        setIsLoading(true);
        // Load RO
        const roRes = await getRO(roNumber);
        if (roRes.data) {
            setRo(roRes.data);
            // Load Parts if RO exists
            const partsRes = await getScannedParts(roNumber); // roNumber is ID
            if (partsRes.data) {
                setParts(partsRes.data);
            }
        } else {
            setError("RO not found");
        }
        setIsLoading(false);
    };

    // Keyboard Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input is focused (unless it's the hidden scanner input logic, but we use global listener here)
            // If manual input is focused, let it handle keys
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
                return;
            }

            const currentTime = Date.now();

            if (e.key === "Enter") {
                if (scanBuffer.length > 0) {
                    handleScan(scanBuffer);
                    setScanBuffer("");
                }
            } else if (e.key.length === 1) {
                // If time between keys is too long, reset buffer (human typing vs scanner)
                if (currentTime - lastKeyTime > 100 && scanBuffer.length > 0) {
                    setScanBuffer(""); // Reset if too slow (likely manual typing outside input)
                }
                setScanBuffer(prev => prev + e.key);
                setLastKeyTime(currentTime);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [scanBuffer, lastKeyTime]); // Dependencies might cause re-bind, but needed for state access. 
    // Optimization: Buffer could be ref if we don't need render updates, but state is safer for now.

    const handleScan = async (barcode: string) => {
        if (!ro) return;
        if (ro.status === "finalized") return;

        setError("");
        // Optimistic update could be done here, but DB is fast enough locally
        const res = await scanPart(ro.ro_number, barcode);
        if (res.success && res.data) {
            loadData(); // Reload to get updated order/qty
        } else if (res.error) {
            setError(res.error);
        }
    };

    // Manual Entry Logic
    const validateManualInput = (code: string) => {
        // Simple length check, can be Regex
        return code.trim().length >= 3;
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = manualBarcode.trim().toUpperCase();
        if (!code) return;

        if (!validateManualInput(code)) {
            setError("Invalid barcode format (min 3 chars).");
            return;
        }

        // Open confirm if it looks weird? For now just confirm automatically or we can add a step.
        // User asked for "Confirm before adding".
        setManualConfirmOpen(true);
    };

    const confirmManualAdd = async () => {
        const code = manualBarcode.trim().toUpperCase();
        await handleScan(code);
        setManualBarcode("");
        setManualConfirmOpen(false);
        setShowManualInput(false);
        // refocus logic if needed
    };

    // Export Logic
    const exportXLSX = () => {
        if (!ro || parts.length === 0) return;

        const rows = parts.map((p) => ({
            Barcode: p.barcode_value,
            Quantity: p.quantity,
            "Last Scanned": new Date(p.updated_at).toLocaleString()
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, ro.ro_number);

        XLSX.writeFile(wb, `${ro.ro_number}.xlsx`);
    };

    const handleUpdateQty = async (id: string) => {
        if (editQty < 1) return;
        const res = await updatePartQuantity(id, editQty);
        if (res.error) setError(res.error);
        else {
            setEditingId(null);
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this part?")) return;
        const res = await deletePart(id);
        if (res.error) setError(res.error);
        else loadData();
    };

    const handleFinalize = async () => {
        if (!ro) return;
        if (!confirm("Finalize this RO? This cannot be undone.")) return;

        const res = await finalizeRO(ro.ro_number);
        if (res.error) setError(res.error);
        else router.refresh(); // Or reload data
    };

    if (isLoading) {
        return <div className="flex justify-center h-screen items-center"><Loader2 className="animate-spin w-8 h-8" /></div>;
    }

    if (!ro) {
        return <div className="p-4">RO Not Found</div>;
    }

    const isFinalized = ro.status === "finalized";

    return (
        <div className="container-mobile space-y-6 pb-24">
            <header className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.push("/")} className="text-gray-500 hover:text-gray-900">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold font-mono">{ro.ro_number}</h1>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold mt-1 ${isFinalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {ro.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                <button onClick={exportXLSX} className="text-blue-600 flex items-center gap-1 text-sm font-medium">
                    <Download className="w-4 h-4" /> Export
                </button>
            </header>

            {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg flex items-center gap-2 relative">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                    <button onClick={() => setError("")} className="absolute top-2 right-2 text-red-500"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Scanner & Manual Entry */}
            {!isFinalized && (
                <section className="space-y-4">
                    <Scanner
                        onScan={handleScan}
                        isScanning={isScanning}
                        setIsScanning={setIsScanning}
                    />

                    <div className="flex justify-center">
                        <button
                            onClick={() => setShowManualInput(!showManualInput)}
                            className="text-sm text-blue-600 font-medium underline"
                        >
                            {showManualInput ? "Hide Manual Entry" : "Enter Barcode Manually"}
                        </button>
                    </div>

                    {showManualInput && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            {!manualConfirmOpen ? (
                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input
                                        ref={manualInputRef}
                                        type="text"
                                        placeholder="Enter Part Number"
                                        className="input uppercase flex-1"
                                        value={manualBarcode}
                                        onChange={(e) => setManualBarcode(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualBarcode.trim()}
                                        className="btn btn-primary"
                                    >
                                        Verify
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm font-medium text-center">Add part <span className="font-mono font-bold bg-yellow-200 dark:bg-yellow-900 px-1">{manualBarcode}</span>?</p>
                                    <div className="flex gap-2">
                                        <button onClick={confirmManualAdd} className="btn btn-primary flex-1">Confirm Add</button>
                                        <button onClick={() => setManualConfirmOpen(false)} className="btn bg-gray-200 text-gray-800 flex-1 hover:bg-gray-300">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
                                    {new Date(part.updated_at).toLocaleTimeString()}
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
            {!isFinalized && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800 z-50">
                    <button
                        onClick={handleFinalize}
                        disabled={parts.length === 0}
                        className="btn btn-primary w-full bg-green-600 hover:bg-green-700 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-5 h-5" />
                        Finalize RO
                    </button>
                </div>
            )}
        </div>
    );
}
