"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, FileStack, Boxes, ClipboardList, Receipt, ShieldAlert } from "lucide-react";

const NAV_ITEMS = [
    { href: "/cats", label: "Lookup", icon: Search, exact: true },
    { href: "/cats/batch", label: "Batch", icon: FileStack },
    { href: "/cats/converters", label: "Converters", icon: Boxes },
    { href: "/cats/observations", label: "Observations", icon: ClipboardList },
    { href: "/cats/sales", label: "Sales", icon: Receipt },
];

const ADMIN_ITEM = { href: "/cats/admin", label: "Corrections", icon: ShieldAlert };

export default function CatsNav() {
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

    return (
        <nav className="flex flex-wrap items-center gap-1.5">
            {NAV_ITEMS.map(renderLink)}
            <span className="mx-1 h-5 w-px bg-white/10 hidden sm:block" />
            {renderLink(ADMIN_ITEM)}
        </nav>
    );
}
