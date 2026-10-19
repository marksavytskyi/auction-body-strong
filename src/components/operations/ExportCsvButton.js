"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { Download, Loader2 } from "lucide-react";

import { downloadOperationsBatchExportCsv } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Button } from "@/components/ui/button";

// Triggers a real browser download of the backend-generated CSV
// (GET .../export) — never reconstructs the CSV from already-loaded
// table rows, and never fetches only the current page. The filename is
// whatever the backend's Content-Disposition header named (see
// downloadOperationsBatchExportCsv); CSV contents are never logged.
export default function ExportCsvButton({ batchId }) {
    const [busy, setBusy] = useState(false);

    const handleExport = async () => {
        setBusy(true);
        try {
            const { blob, filename } = await downloadOperationsBatchExportCsv(batchId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to export batch CSV");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handleExport} disabled={busy} isLoading={busy}>
            {!busy && <Download className="h-3.5 w-3.5" />} Export CSV
        </Button>
    );
}
