"use client";

import { FinalEntry } from "@/actions/ro-actions";
import { Download, ChevronLeft, FileText } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function FinalsList({ entries }: { entries: FinalEntry[] }) {

    const handleExport = async (entry: FinalEntry) => {
        const supabase = createClient();
        const { data: parts } = await supabase
            .from("ro_final_parts")
            .select("barcode_value, quantity")
            .eq("final_entry_id", entry.id);

        if (!parts) return;

        const csvContent = "data:text/csv;charset=utf-8,"
            + "RO Number,Barcode,Quantity\n"
            + parts.map(p => `${entry.ro_number},${p.barcode_value},${p.quantity}`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${entry.ro_number}_final.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container-mobile space-y-6">
            <header className="flex items-center gap-4">
                <Link href="/" className="text-gray-500">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold">Finalized ROs</h1>
            </header>

            <div className="space-y-3">
                {entries.map((entry) => (
                    <div key={entry.id} className="card flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FileText className="text-green-600 w-5 h-5" />
                            <div>
                                <div className="font-mono font-bold text-lg">{entry.ro_number}</div>
                                <div className="text-sm text-gray-500">
                                    {new Date(entry.finalized_at).toLocaleDateString()} {new Date(entry.finalized_at).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleExport(entry)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                            title="Export CSV"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                ))}

                {entries.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No finalized ROs yet.</p>
                )}
            </div>
        </div>
    );
}
