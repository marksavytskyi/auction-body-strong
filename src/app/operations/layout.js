"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Boxes, ShieldAlert } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import RoleGuard from "@/components/shell/RoleGuard";
import { isAdminTierRole } from "@/lib/rbac";
import { isOperationsUiEnabled } from "@/lib/operations/featureFlag";
import { Button } from "@/components/ui/button";
import ModuleSwitcher from "@/components/shell/ModuleSwitcher";
import { setLastModule } from "@/lib/moduleStorage";

// Same shell pattern as src/app/cats/layout.js (background, header,
// module switcher) — a new top-level module, not a rewrite of an
// existing one. Gated three ways, all enforced here independently of
// ModuleSwitcher hiding its own nav entry: the frontend feature flag,
// login, and OWNER/ADMIN role. The backend remains the real boundary —
// every /operations/* API call still 403s on its own for anyone who
// gets here some other way.
export default function OperationsLayout({ children }) {
    const flagEnabled = isOperationsUiEnabled();

    if (!flagEnabled) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#020202] text-white px-4">
                <div className="max-w-md text-center space-y-3">
                    <ShieldAlert className="h-8 w-8 text-amber-400 mx-auto" />
                    <div className="text-lg font-bold">Operations is not enabled</div>
                    <p className="text-sm text-white/50">
                        This frontend build has the Operations module disabled. Set NEXT_PUBLIC_OPERATIONS_ENABLED=true to enable it.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <RoleGuard allow={isAdminTierRole} loadingLabel="Loading Operations…">
            <OperationsShell>{children}</OperationsShell>
        </RoleGuard>
    );
}

function OperationsShell({ children }) {
    const router = useRouter();
    const { email: userEmail } = useAuth();

    useEffect(() => {
        setLastModule("operations");
    }, []);

    return (
        <div className="min-h-screen w-full bg-[#020202] text-white">

            <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 md:py-5">
                <div
                    className="mb-3 flex flex-wrap items-center gap-2 md:mb-4"
                >
                    <h1 className="mr-auto inline-flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                        <Boxes className="h-5 w-5 text-emerald-400" />
                        Operations
                    </h1>

                    <div className="order-last w-full sm:order-none sm:w-auto">
                        <ModuleSwitcher active="operations" />
                    </div>
                    {userEmail && <span className="hidden max-w-[220px] truncate text-xs text-white/50 lg:inline">{userEmail}</span>}
                    <Button variant="outline" className="h-9 rounded-xl border-white/15 px-3" aria-label="Logout" onClick={() => router.push("/logout")}>
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                </div>

                {children}
            </div>
        </div>
    );
}
