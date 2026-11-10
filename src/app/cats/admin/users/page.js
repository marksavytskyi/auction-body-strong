"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, ShieldAlert, Lock } from "lucide-react";

import { listUsers, setUserRole, setUserActive, deleteUser, restoreUser } from "@/lib/catalytic/users";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerOnlyGate } from "@/hooks/useRoleGate";
import { ROLES, isOwnerRole } from "@/lib/rbac";

// Phase K.50 — this page is for OWNER accounts, and there can be several. Every rule
// here is a guardrail only: the backend decides, and any refusal is shown as it comes.
const ROLE_OPTIONS = [ROLES.WORKER, ROLES.MODERATOR, ROLES.ADMIN, ROLES.OWNER];

const button = "h-9 rounded-lg border px-2.5 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed";

function statusOf(user) {
    if (user.deleted_at) return { label: "Deleted", tone: "border-rose-500/30 bg-rose-500/10 text-rose-300" };
    if (user.is_active) return { label: "Active", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
    return { label: "Inactive", tone: "border-white/15 bg-white/5 text-white/40" };
}

// Why this row can't be changed, or null.
function lockReason(user, { isSelf, lastOwner }) {
    if (isSelf) return "This is your account: another owner has to change it";
    if (lastOwner) return "The only active owner can't be demoted, deactivated or deleted";
    return null;
}

function dialogFor(pending) {
    const { kind, user, role } = pending;
    if (kind === "role") {
        return {
            title: `Change ${user.email} to ${role}?`,
            body: role === ROLES.OWNER
                ? `${user.email} gets every OWNER right, the same as yours: Users & Roles, deleting users and every owner-only tool.`
                : isOwnerRole(user.role)
                    ? `${user.email} stops being an OWNER and loses owner-only rights at once.`
                    : `${user.email} gets ${role} access from their next request.`,
            confirm: `Make ${role}`,
        };
    }
    if (kind === "deactivate") {
        return {
            title: `Deactivate ${user.email}?`,
            body: "They are signed out on their next request and can't sign in until an owner activates them again. They stay in this list, and nothing they recorded changes.",
            confirm: "Deactivate",
        };
    }
    if (kind === "activate") {
        return { title: `Activate ${user.email}?`, body: "They can sign in again with their role as shown.", confirm: "Activate" };
    }
    if (kind === "restore") {
        return {
            title: `Restore ${user.email}?`,
            body: "They come back to the list deactivated. Signing in again takes a separate Activate.",
            confirm: "Restore",
        };
    }
    return {
        title: `Delete ${user.email}?`,
        body: "They lose access at once and leave this list. Their account isn't erased: captures, reviews, sales, batches and every other record keep their name, and the email stays reserved so nobody can sign up as them. An owner can restore them from Show deleted users.",
        confirm: "Delete user",
    };
}

function UserActions({ user, isSelf, lastOwner, onAsk }) {
    if (user.deleted_at) {
        return <button type="button" onClick={() => onAsk({ kind: "restore", user })} className={`${button} border-white/15 text-white/80`}>Restore</button>;
    }
    const locked = lockReason(user, { isSelf, lastOwner });
    return (
        <div className="flex flex-wrap items-center gap-2" title={locked || undefined}>
            <button
                type="button"
                disabled={Boolean(locked)}
                onClick={() => onAsk({ kind: user.is_active ? "deactivate" : "activate", user })}
                className={`${button} border-white/15 text-white/80`}
            >
                {user.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
                type="button"
                disabled={Boolean(locked)}
                onClick={() => onAsk({ kind: "delete", user })}
                className={`${button} border-rose-500/40 text-rose-300`}
            >
                Delete
            </button>
        </div>
    );
}

function RoleControl({ user, isSelf, lastOwner, onAsk }) {
    const locked = user.deleted_at ? "Restore the user to change their role" : lockReason(user, { isSelf, lastOwner });
    if (locked) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/60" title={locked}>
                <Lock className="h-3 w-3" /> {user.role}
            </span>
        );
    }
    return (
        <select
            aria-label={`Role of ${user.email}`}
            value={user.role}
            onChange={(e) => { if (e.target.value !== user.role) onAsk({ kind: "role", user, role: e.target.value }); }}
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white outline-none focus:border-emerald-500/50"
        >
            {!ROLE_OPTIONS.includes(user.role) && <option value={user.role} className="bg-[#0c0e13]">{user.role}</option>}
            {ROLE_OPTIONS.map((r) => <option key={r} value={r} className="bg-[#0c0e13]">{r}</option>)}
        </select>
    );
}

export default function UsersRolesPage() {
    const { ready } = useOwnerOnlyGate();
    const { email: myEmail } = useAuth();
    const [users, setUsers] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [showDeleted, setShowDeleted] = useState(false);
    const [pending, setPending] = useState(null);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listUsers({ includeDeleted: showDeleted });
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load users");
            setUsers(null);
        } finally {
            setIsLoading(false);
        }
    }, [showDeleted]);

    useEffect(() => {
        if (ready) load();
    }, [ready, load]);

    if (!ready) return null;

    const activeOwners = (users || []).filter((u) => isOwnerRole(u.role) && u.is_active && !u.deleted_at).length;
    const rowFacts = (u) => ({
        isSelf: u.email === myEmail,
        lastOwner: isOwnerRole(u.role) && u.is_active && !u.deleted_at && activeOwners <= 1,
    });

    const ask = (next) => {
        setTyped("");
        setPending(next);
    };

    const confirm = async () => {
        if (!pending || busy) return;
        const { kind, user, role } = pending;
        setBusy(true);
        try {
            if (kind === "role") await setUserRole(user.id, role);
            else if (kind === "deactivate") await setUserActive(user.id, false);
            else if (kind === "activate") await setUserActive(user.id, true);
            else if (kind === "restore") await restoreUser(user.id);
            else await deleteUser(user.id);
            const done = { role: `${user.email} is now ${role}`, deactivate: `${user.email} deactivated`, activate: `${user.email} activated`, restore: `${user.email} restored, still deactivated`, delete: `${user.email} deleted` };
            toast.success(done[kind]);
            setPending(null);
            await load();
        } catch (err) {
            toast.error(err instanceof CatalyticApiError ? err.message : "That change didn't go through");
        } finally {
            setBusy(false);
        }
    };

    const needsTyping = pending?.kind === "delete";
    const action = pending ? dialogFor(pending) : null;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90">Users &amp; Roles</h1>
                    <p className="text-xs text-white/40 mt-1">
                        Owners manage every account here, including other owners. You can&apos;t change your own account, and the last active owner is always kept.
                    </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-white/60">
                    <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="h-4 w-4" />
                    Show deleted users
                </label>
            </div>

            {isLoading && !users ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-4 flex items-center gap-2 text-rose-300 text-sm">
                    <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
                </div>
            ) : !users || users.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No users found.</div>
            ) : (
                <>
                    <div className="hidden md:block overflow-auto rounded-2xl border border-white/10 bg-black/25">
                        <table className="w-full text-sm">
                            <thead className="bg-black/40 sticky top-0">
                                <tr>
                                    {["Email", "Role", "Status", "Actions"].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const facts = rowFacts(u);
                                    const status = statusOf(u);
                                    return (
                                        <tr key={u.id} className="odd:bg-white/[0.02]">
                                            <td className="px-4 py-2.5 border-b border-white/5 text-white/85 whitespace-nowrap">
                                                {u.email} {facts.isSelf && <span className="text-[10px] text-white/30">(you)</span>}
                                            </td>
                                            <td className="px-4 py-2.5 border-b border-white/5"><RoleControl user={u} {...facts} onAsk={ask} /></td>
                                            <td className="px-4 py-2.5 border-b border-white/5">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status.tone}`}>{status.label}</span>
                                            </td>
                                            <td className="px-4 py-2.5 border-b border-white/5"><UserActions user={u} {...facts} onAsk={ask} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden space-y-2" aria-label="Users">
                        {users.map((u) => {
                            const facts = rowFacts(u);
                            const status = statusOf(u);
                            return (
                                <div key={u.id} className="space-y-2.5 rounded-xl border border-white/10 bg-black/25 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 break-all text-sm text-white/85">
                                            {u.email} {facts.isSelf && <span className="text-[10px] text-white/30">(you)</span>}
                                        </div>
                                        <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status.tone}`}>{status.label}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <RoleControl user={u} {...facts} onAsk={ask} />
                                        <UserActions user={u} {...facts} onAsk={ask} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {pending && (
                <ConfirmDialog
                    action={action}
                    busy={busy}
                    onConfirm={confirm}
                    onClose={() => setPending(null)}
                    confirmDisabled={needsTyping && typed.trim().toLowerCase() !== pending.user.email.toLowerCase()}
                >
                    {needsTyping && (
                        <label className="block space-y-1.5 text-xs text-white/60">
                            <span>Type <b className="text-white/85">{pending.user.email}</b> to confirm</span>
                            <input
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                aria-label="Type the email to confirm"
                                autoComplete="off"
                                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white outline-none focus:border-rose-500/50 sm:text-sm"
                            />
                        </label>
                    )}
                </ConfirmDialog>
            )}
        </div>
    );
}
