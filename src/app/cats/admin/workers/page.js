"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wrench, ArrowRight } from "lucide-react";

import { listUsers, setUserActive } from "@/lib/catalytic/users";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { isWorkerRole } from "@/lib/rbac";
import toast from "react-hot-toast";

// Per-worker submission counts live on the detail page (one bounded fetch
// per worker opened), not here — computing them for every row up front
// would mean one /moderation/captures call per worker on every page load.
// See BACKEND GAPS: a GET /users?role=WORKER with embedded counts, or a
// dedicated worker-summary endpoint, would let this list show them too.
export default function WorkersListPage() {
    const [users, setUsers] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listUsers();
            setUsers((Array.isArray(data) ? data : []).filter((u) => isWorkerRole(u.role)));
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load workers");
            setUsers(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-emerald-400" /> Workers
                </h1>
                <p className="text-xs text-white/40 mt-1">Human field workers submitting vehicle/catalyst captures.</p>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !users || users.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No workers found.</div>
            ) : (
                <div className="space-y-2">
                    {users.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                            <div>
                                <div className="text-sm font-bold text-white/90">{u.email}</div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const next = !u.is_active;
                                        if (!confirm(`${next ? "Activate" : "Deactivate"} ${u.email}?`)) return;
                                        try {
                                            await setUserActive(u.id, next);
                                            toast.success(`${u.email} ${next ? "activated" : "deactivated"}`);
                                            load();
                                        } catch (e) {
                                            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to update");
                                        }
                                    }}
                                    className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                        u.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/40"
                                    }`}
                                >
                                    {u.is_active ? "Active" : "Inactive"}
                                </button>
                            </div>
                            <Link href={`/cats/admin/workers/${u.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 hover:text-emerald-200">
                                Details <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
