"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, FileSpreadsheet, UploadCloud, ArrowRight, RefreshCw } from "lucide-react";

import { uploadImport, listImports } from "@/lib/catalytic/copartImport";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/catalytic/StatusPill";
import { useAdminTierGate } from "@/hooks/useRoleGate";

const STATUS_TONE = {
    COMPLETED: "success",
    PROCESSING: "progress",
    FAILED: "danger",
};

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function ImportRow({ imp }) {
    const stats = imp.stats || {};
    return (
        <Link
            href={`/cats/admin/copart/${imp.id}`}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.05] hover:border-white/20 transition-all sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl border border-sky-500/20 bg-sky-500/10 shrink-0">
                    <FileSpreadsheet className="h-4 w-4 text-sky-400" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-bold text-white/90 truncate">{imp.filename || `Import #${imp.id}`}</div>
                    <div className="text-[11px] text-white/40">{fmtDate(imp.created_at)}</div>
                </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs">
                <StatusPill label={imp.status} tone={STATUS_TONE[imp.status] || "neutral"} />
                <div className="flex items-center gap-3 text-white/60">
                    <span><b className="text-white/90">{imp.total_rows ?? 0}</b> total</span>
                    <span className="text-emerald-300"><b>{stats.ready_for_catdb_rows ?? 0}</b> ready</span>
                    <span className="text-sky-300"><b>{stats.queued_rows ?? 0}</b> queued</span>
                    <span className="text-white/50"><b>{stats.completed_rows ?? 0}</b> done</span>
                    {stats.failed_rows > 0 && <span className="text-rose-300"><b>{stats.failed_rows}</b> failed</span>}
                    {imp.invalid_rows > 0 && <span className="text-amber-300/80">{imp.invalid_rows} invalid</span>}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white/30" />
            </div>
        </Link>
    );
}

export default function CopartImportsPage() {
    const { ready } = useAdminTierGate();
    const router = useRouter();
    const fileInputRef = useRef(null);

    const [imports, setImports] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await listImports();
            setImports(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load Copart imports");
            setImports(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ready) load();
    }, [ready, load]);

    const handleFile = async (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".csv")) {
            toast.error("Only .csv files are supported");
            return;
        }
        setUploading(true);
        try {
            const imp = await uploadImport(file);
            toast.success(`Imported ${imp.total_rows ?? 0} rows`);
            router.push(`/cats/admin/copart/${imp.id}`);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    if (!ready) {
        return <div className="flex items-center justify-center py-16 text-white/40 text-sm uppercase tracking-wider">Loading…</div>;
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-sky-400" /> Copart Imports
                    </h1>
                    <p className="text-xs text-white/40 mt-1">Upload a Copart export CSV, then build CatDB batches from its ready vehicles.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button type="button" onClick={load} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} isLoading={uploading} className="rounded-xl">
                        <UploadCloud className="h-4 w-4" /> Upload Copart CSV
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !imports || imports.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center">
                    <FileSpreadsheet className="h-8 w-8 text-white/20 mx-auto mb-3" />
                    <div className="text-sm text-white/50 font-medium">No Copart imports yet.</div>
                    <div className="text-xs text-white/35 mt-1">Upload a CSV to get started.</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {imports.map((imp) => (
                        <ImportRow key={imp.id} imp={imp} />
                    ))}
                </div>
            )}
        </div>
    );
}
