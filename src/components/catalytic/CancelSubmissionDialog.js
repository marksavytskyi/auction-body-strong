"use client";

import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import { cancelCapture } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";

export default function CancelSubmissionDialog({ capture, onCancelled, onClose }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const running = useRef(false);

    const confirm = async () => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setError("");
        try {
            const updated = await cancelCapture(capture.id, { expectedRevision: capture.revision });
            toast.success("Submission cancelled");
            onCancelled(updated);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to cancel the submission");
            running.current = false;
            setBusy(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Cancel this submission?">
            <div className="w-full max-w-md rounded-3xl bg-[#0a0a0a] border border-white/10 p-5 space-y-4">
                <h2 className="text-lg font-black text-white/90">Cancel this submission?</h2>
                <p className="text-sm text-white/60">It will be removed from the moderator review queue.</p>
                {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                <div className="grid grid-cols-1 gap-2">
                    <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15" disabled={busy} onClick={onClose}>
                        Keep Submission
                    </Button>
                    <Button type="button" variant="destructive" className="h-12 rounded-2xl" isLoading={busy} disabled={busy} onClick={confirm}>
                        Cancel Submission
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
