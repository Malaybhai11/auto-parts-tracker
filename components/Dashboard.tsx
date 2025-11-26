"use client";

import { useState, useTransition } from "react";
import { createRO, searchRO, RO } from "@/actions/ro-actions";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function Dashboard({ recentROs }: { recentROs: RO[] }) {
    const [roNumber, setRoNumber] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<RO[]>([]);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!roNumber.trim()) return;

        startTransition(async () => {
            const res = await createRO(roNumber);
            if (res.error) {
                setError(res.error);
            } else if (res.data) {
                router.push(`/ro/${res.data.ro_number}`);
            }
        });
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        const res = await searchRO(query);
        if (res.success && res.data) {
            setSearchResults(res.data);
        }
    };

    return (
        <div className="container-mobile space-y-8">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Parts Tracker</h1>
                <Link href="/finals" className="text-blue-600 font-medium">
                    Finals
                </Link>
            </header>

            {/* Create RO Section */}
            <section className="card space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Plus className="w-5 h-5" /> New Repair Order
                </h2>
                <form onSubmit={handleCreate} className="space-y-3">
                    <input
                        type="text"
                        placeholder="Enter RO Number (e.g. R12345)"
                        className="input uppercase"
                        value={roNumber}
                        onChange={(e) => setRoNumber(e.target.value)}
                        disabled={isPending}
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={isPending || !roNumber.trim()}
                        className="btn btn-primary w-full flex justify-center items-center gap-2"
                    >
                        {isPending ? <Loader2 className="animate-spin" /> : "Start RO"}
                    </button>
                </form>
            </section>

            {/* Search Section */}
            <section className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search RO..."
                        className="input pl-10"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

                {/* Search Results or Recent List */}
                <div className="space-y-3">
                    <h3 className="font-medium text-gray-500">
                        {searchQuery ? "Search Results" : "Recent ROs"}
                    </h3>

                    <div className="space-y-2">
                        {(searchQuery ? searchResults : recentROs).map((ro) => (
                            <Link
                                key={ro.id}
                                href={`/ro/${ro.ro_number}`}
                                className="card flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="text-blue-500 w-5 h-5" />
                                    <span className="font-mono font-bold text-lg">{ro.ro_number}</span>
                                </div>
                                {ro.status === "finalized" ? (
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> FINAL
                                    </span>
                                ) : (
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">
                                        DRAFT
                                    </span>
                                )}
                            </Link>
                        ))}

                        {!searchQuery && recentROs.length === 0 && (
                            <p className="text-center text-gray-400 py-4">No recent ROs found.</p>
                        )}

                        {searchQuery && searchResults.length === 0 && (
                            <p className="text-center text-gray-400 py-4">No results found.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
