"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Search,
    Boxes,
    ClipboardList,
    Receipt,
    ShieldCheck,
    Wrench,
    Users,
    Cpu,
} from "lucide-react";
import { isModeratorRole, isAdminTierRole } from "@/lib/rbac";

// Phase K.51: the eight approved CATS sections. Vehicle CSV uploads and batches live in
// Operations; human workers in Users & Roles; CatDB jobs and devices in CatDB
// Automation. Batch, Copart Imports, CatDB Batches, Corrections and Workers were
// removed: their old addresses redirect (next.config.mjs) and no data was removed.
// Users & Roles is shown to ADMIN too, with owner-only actions hidden; the backend
// decides every action either way.
const ADMIN_TIER_ITEMS = [
    { href: "/cats/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/cats", label: "Lookup", icon: Search, exact: true },
    { href: "/cats/converters", label: "Converters", icon: Boxes },
    { href: "/cats/observations", label: "Observations", icon: ClipboardList },
    { href: "/cats/moderation", label: "Moderation", icon: ShieldCheck },
    { href: "/cats/sales", label: "Sales", icon: Receipt },
    { href: "/cats/admin/catdb", label: "CatDB Automation", icon: Cpu },
    { href: "/cats/admin/users", label: "Users & Roles", icon: Users },
];

// MODERATOR: a deliberately narrow, moderation-focused slice. No user
// administration, no CatDB, no sales/pricing tools.
const MODERATOR_ITEMS = [
    { href: "/cats/moderation", label: "Moderation", icon: ShieldCheck, exact: true },
    { href: "/cats/moderation", label: "Worker Submissions", icon: Wrench, exact: true },
];

export default function CatsNav({ role }) {
    const pathname = usePathname();
    const isActive = (item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

    const renderLink = (item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
            <Link
                key={item.label}
                href={item.href}
                className={[
                    "inline-flex items-center gap-2 px-4 h-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap",
                    active
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                        : "border border-transparent text-white/50 hover:text-white hover:bg-white/5",
                ].join(" ")}
            >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
            </Link>
        );
    };

    if (isModeratorRole(role)) {
        return <nav className="flex flex-wrap items-center gap-1.5">{MODERATOR_ITEMS.map(renderLink)}</nav>;
    }

    if (!isAdminTierRole(role)) {
        // Role not resolved yet (or some unrecognized value) — render
        // nothing rather than guess at admin tools. The layout/page-level
        // guards handle redirecting WORKER away from this shell entirely.
        return null;
    }

    return <nav aria-label="CATS" className="flex flex-wrap items-center gap-1.5">{ADMIN_TIER_ITEMS.map(renderLink)}</nav>;
}
