"use client";

import React from "react";
import { PencilLine, Clock, CheckCircle2, XCircle } from "lucide-react";
import { CAPTURE_STATUS } from "@/lib/catalytic/workerCaptures";

const META = {
    [CAPTURE_STATUS.DRAFT]: { label: "Draft", tone: "border-white/20 bg-white/5 text-white/60", icon: PencilLine },
    [CAPTURE_STATUS.PENDING_REVIEW]: { label: "Pending Review", tone: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: Clock },
    [CAPTURE_STATUS.APPROVED]: { label: "Approved", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: CheckCircle2 },
    [CAPTURE_STATUS.REJECTED]: { label: "Rejected", tone: "border-rose-500/30 bg-rose-500/10 text-rose-300", icon: XCircle },
};

export default function CaptureStatusBadge({ status }) {
    const meta = META[status] || { label: status || "Unknown", tone: "border-white/15 bg-white/5 text-white/45", icon: Clock };
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${meta.tone}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
        </span>
    );
}
