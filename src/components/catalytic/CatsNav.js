"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Search,
    FileStack,
    Boxes,
    ClipboardList,
    Receipt,
    ShieldAlert,
    ShieldCheck,
    Wrench,
    Users,
    Cpu,
    FileSpreadsheet,
    ListChecks,
} from "lucide-react";
import { isModeratorRole, isAdminTierRole, isOwnerRole } from "@/lib/rbac";

// OWNER/ADMIN: full operational nav. Users & Roles is intentionally NOT
// in this shared list — could not positively verify with a real ADMIN
// token that the backend permits ADMIN to call PATCH /users/{id}/role or
// /active (OpenAPI documents no restriction either way, and per product
// direction that silence must not be read as permission). It's appended
// only for OWNER below. Backend remains the enforcement boundary
// regardless — if this changes, update isOwnerRole to isAdminTierRole here.
const ADMIN_TIER_ITEMS = [
    { href: "/cats/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/cats", label: "Lookup", icon: Search, exact: true },
    { href: "/cats/batch", label: "Batch", icon: FileStack },
    { href: "/cats/converters", label: "Converters", icon: Boxes },
    { href: "/cats/observations", label: "Observations", icon: ClipboardList },
    { href: "/cats/sales", label: "Sales", icon: Receipt },
    { href: "/cats/moderation", label: "Moderation", icon: ShieldCheck },
    { href: "/cats/admin/workers", label: "Workers", icon: Wrench },
    { href: "/cats/admin/catdb", label: "CatDB", icon: Cpu },
    { href: "/cats/admin/copart", label: "Copart Imports", icon: FileSpreadsheet },
    { href: "/cats/admin/catdb-batches", label: "CatDB Batches", icon: ListChecks },
    { href: "/cats/admin/corrections", label: "Corrections", icon: ShieldAlert },
];

const OWNER_ONLY_ITEMS = [{ href: "/cats/admin/users", label: "Users & Roles", icon: Users }];

// MODERATOR: a deliberately narrow, moderation-focused slice. No user
// administration, no CatDB, no sales/pricing tools.
const MODERATOR_ITEMS = [
    { href: "/cats/moderation", label: "Moderation", icon: ShieldCheck, exact: true },
    { href: "/cats/admin/workers", label: "Worker Submissions", icon: Wrench },
];

export default function CatsNav({ role }) {
    const pathname = usePathname();
    const isActive = (item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

    const renderLink = (item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
            <Link
                key={item.href}
                href={item.href}
                className={[
                    "inline-flex items-center gap-2 px-4 h-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
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

    const items = isOwnerRole(role) ? [...ADMIN_TIER_ITEMS, ...OWNER_ONLY_ITEMS] : ADMIN_TIER_ITEMS;
    return <nav className="flex flex-wrap items-center gap-1.5">{items.map(renderLink)}</nav>;
}
