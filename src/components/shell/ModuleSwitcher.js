"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Wrench, FlaskConical, LayoutDashboard } from "lucide-react";
import { setLastModule } from "@/lib/moduleStorage";
import { useAuth } from "@/hooks/useAuth";
import { isAdminTierRole } from "@/lib/rbac";
import { isOperationsUiEnabled } from "@/lib/operations/featureFlag";

const BASE_MODULES = [
    { id: "parts", label: "Parts", href: "/dashboard", icon: Wrench },
    { id: "cats", label: "Cats", href: "/cats", icon: FlaskConical },
];

const OPERATIONS_MODULE = { id: "operations", label: "Operations", href: "/operations", icon: LayoutDashboard };

export default function ModuleSwitcher({ active }) {
    const router = useRouter();
    // Operations is hidden from this switcher unless ALL of: the frontend
    // feature flag is on, the user is authenticated, and their role is
    // OWNER/ADMIN — the backend remains the real enforcement boundary
    // regardless (every /operations/* page/API call still handles a 403
    // on its own), this only controls whether the entry point is shown.
    const { isLoggedIn, roleReady, role } = useAuth();
    const showOperations = isOperationsUiEnabled() && isLoggedIn && roleReady && isAdminTierRole(role);
    const MODULES = showOperations ? [...BASE_MODULES, OPERATIONS_MODULE] : BASE_MODULES;

    return (
        <div
            role="tablist"
            aria-label="Product module"
            className="flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 sm:inline-flex sm:w-auto"
        >
            {MODULES.map(({ id, label, href, icon: Icon }) => {
                const isActive = id === active;
                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                            setLastModule(id);
                            if (!isActive) router.push(href);
                        }}
                        className={[
                            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 h-9 text-xs font-bold uppercase tracking-wider transition-colors sm:flex-none sm:px-3.5",
                            isActive
                                ? "bg-emerald-500 text-black"
                                : "text-white/50 hover:text-white hover:bg-white/5",
                        ].join(" ")}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
