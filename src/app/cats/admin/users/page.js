"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, ShieldAlert, Lock } from "lucide-react";

import { listUsers, setUserRole, setUserActive } from "@/lib/catalytic/users";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerOnlyGate } from "@/hooks/useRoleGate";
import { ROLES, isOwnerRole } from "@/lib/rbac";

// Frontend never offers OWNER as a role option, and never lets anyone edit
// an OWNER row or their own row — but this is UX guardrail only. The
// backend is the real authority: any action here can still come back 403,
// and that's shown as-is rather than assumed away.
const ASSIGNABLE_ROLES = [ROLES.WORKER, ROLES.MODERATOR, ROLES.ADMIN];

function RoleSelect({ user, myEmail, onChanged }) {
    const [busy, setBusy] = useState(false);
    const isSelf = user.email === myEmail;
    const locked = isOwnerRole(user.role) || isSelf;

    if (locked) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-white/40" title={isOwnerRole(user.role) ? "Owner role is protected" : "You can't change your own role"}>
                <Lock className="h-3 w-3" /> {user.role}
            </span>
        );
    }

    return (
        <select
            value={user.role}
            disabled={busy}
            onChange={async (e) => {
                const nextRole = e.target.value;
                if (nextRole === user.role) return;
                if (!confirm(`Change ${user.email} from ${user.role} to ${nextRole}?`)) return;
                setBusy(true);
                try {
                    await setUserRole(user.id, nextRole);
                    toast.success(`${user.email} is now ${nextRole}`);
                    onChanged();
                } catch (err) {
                    toast.error(err instanceof CatalyticApiError ? err.message : "Failed to change role");
                } finally {
                    setBusy(false);
                }
            }}
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white outline-none focus:border-emerald-500/50"
        >
            {!ASSIGNABLE_ROLES.includes(user.role) && (
                <option value={user.role} className="bg-[#0c0e13]">{user.role}</option>
            )}
            {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r} className="bg-[#0c0e13]">{r}</option>
            ))}
        </select>
    );
}

function ActiveToggle({ user, myEmail, onChanged }) {
    const [busy, setBusy] = useState(false);
    const isSelf = user.email === myEmail;
    const isOwner = isOwnerRole(user.role);
    const locked = isSelf || isOwner;

    if (isOwner) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-white/40" title="Owner accounts are protected from deactivation here">
                <Lock className="h-3 w-3" /> {user.is_active ? "Active" : "Inactive"}
            </span>
        );
    }

    return (
        <button
            type="button"
            disabled={busy || locked}
            title={isSelf ? "You can't deactivate your own account" : ""}
            onClick={async () => {
                const next = !user.is_active;
                if (!confirm(`${next ? "Activate" : "Deactivate"} ${user.email}?`)) return;
                setBusy(true);
                try {
                    await setUserActive(user.id, next);
                    toast.success(`${user.email} ${next ? "activated" : "deactivated"}`);
                    onChanged();
                } catch (err) {
                    toast.error(err instanceof CatalyticApiError ? err.message : "Failed to update status");
                } finally {
                    setBusy(false);
                }
            }}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                user.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/40"
            }`}
        >
            {user.is_active ? "Active" : "Inactive"}
        </button>
    );
}

export default function UsersRolesPage() {
    const { ready } = useOwnerOnlyGate();
    const { email: myEmail } = useAuth();
    const [users, setUsers] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load users");
            setUsers(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ready) load();
    }, [ready, load]);

    if (!ready) return null;

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-white/90">Users &amp; Roles</h1>
                <p className="text-xs text-white/40 mt-1">Role changes are enforced by the backend — this UI only offers WORKER / MODERATOR / ADMIN and never touches OWNER accounts.</p>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-4 flex items-center gap-2 text-rose-300 text-sm">
                    <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
                </div>
            ) : !users || users.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No users found.</div>
            ) : (
                <div className="overflow-auto rounded-2xl border border-white/10 bg-black/25">
                    <table className="w-full text-sm">
                        <thead className="bg-black/40 sticky top-0">
                            <tr>
                                {["Email", "Role", "Status", ""].map((h) => (
                                    <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className="odd:bg-white/[0.02]">
                                    <td className="px-4 py-2.5 border-b border-white/5 text-white/85 whitespace-nowrap">
                                        {u.email} {u.email === myEmail && <span className="text-[10px] text-white/30">(you)</span>}
                                    </td>
                                    <td className="px-4 py-2.5 border-b border-white/5"><RoleSelect user={u} myEmail={myEmail} onChanged={load} /></td>
                                    <td className="px-4 py-2.5 border-b border-white/5"><ActiveToggle user={u} myEmail={myEmail} onChanged={load} /></td>
                                    <td className="px-4 py-2.5 border-b border-white/5 text-white/30 text-xs">#{u.id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
