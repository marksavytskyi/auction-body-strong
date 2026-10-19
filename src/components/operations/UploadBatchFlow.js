"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { UploadCloud, FileText, Loader2 } from "lucide-react";

import { uploadOperationsBatch } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Button } from "@/components/ui/button";

const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;

// Upload only — never parses the CSV itself (the backend is the sole
// source of truth for every row), and never triggers Parts/OurDB/Weight
// automatically after a successful upload (see spec Section 6/8).
export default function UploadBatchFlow({ onUploaded }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback((accepted, rejected) => {
        if (rejected?.length) {
            toast.error("Only .csv files are supported");
            return;
        }
        const next = accepted?.[0];
        if (!next) return;
        if (!next.name.toLowerCase().endsWith(".csv")) {
            toast.error("Only .csv files are supported");
            return;
        }
        if (next.size > MAX_BYTES) {
            toast.error(`File is too large. Max ${MAX_MB}MB`);
            return;
        }
        setFile(next);
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { "text/csv": [".csv"] },
        maxFiles: 1,
        multiple: false,
        noClick: true,
        noKeyboard: true,
    });

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        const t = toast.loading("Uploading batch…");
        try {
            const batch = await uploadOperationsBatch(file);
            toast.success(`Batch #${batch.id} created — ${batch.total_vehicles ?? 0} vehicles`, { id: t });
            setFile(null);
            onUploaded?.(batch);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Upload failed", { id: t });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            {...getRootProps()}
            className={[
                "rounded-2xl border border-dashed p-5 transition-all",
                isDragActive ? "border-emerald-400/70 bg-emerald-500/[0.08]" : "border-white/15 bg-black/25",
            ].join(" ")}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="text-sm font-bold text-white/90">Upload Copart CSV</div>
                    <div className="text-xs text-white/40 mt-0.5">
                        {file ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-300"><FileText className="h-3.5 w-3.5" /> {file.name}</span>
                        ) : (
                            "Drag a .csv file here, or browse — max 25MB."
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={(e) => { e.stopPropagation(); open(); }}>
                        <FileText className="h-4 w-4" /> Browse
                    </Button>
                    <Button
                        type="button"
                        className="rounded-xl"
                        disabled={!file || uploading}
                        onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        Upload
                    </Button>
                </div>
            </div>
        </div>
    );
}