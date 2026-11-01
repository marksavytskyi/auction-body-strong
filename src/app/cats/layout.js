"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, FlaskConical } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { canUseMainApp } from "@/lib/rbac";
import RoleGuard from "@/components/shell/RoleGuard";
import { Button } from "@/components/ui/button";
import ModuleSwitcher from "@/components/shell/ModuleSwitcher";
import CatsNav from "@/components/catalytic/CatsNav";
import { setLastModule } from "@/lib/moduleStorage";

// A WORKER only has backend permission for /worker/captures/*, so the guard sends
// that role to /worker before anything here renders or fetches.
export default function CatsLayout({ children }) {
    return (
        <RoleGuard allow={canUseMainApp} loadingLabel="Loading Cats…">
            <CatsShell>{children}</CatsShell>
        </RoleGuard>
    );
}

function CatsShell({ children }) {
    const router = useRouter();
    const { email: userEmail, role } = useAuth();

    useEffect(() => {
        setLastModule("cats");
    }, []);

    return (
        <div className="min-h-screen w-full bg-[#020202] text-white">

            <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 md:py-5">
                <div
                    className="mb-3 flex flex-wrap items-center gap-2 md:mb-4"
                >
                    <h1 className="mr-auto inline-flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                        <FlaskConical className="h-5 w-5 text-sky-400" />
                        Cats
                    </h1>

                    <div className="order-last w-full sm:order-none sm:w-auto">
                        <ModuleSwitcher active="cats" />
                    </div>
                    {userEmail && <span className="hidden max-w-[220px] truncate text-xs text-white/50 lg:inline">{userEmail}</span>}
                    <Button variant="outline" className="h-9 rounded-xl border-white/15 px-3" aria-label="Logout" onClick={() => router.push("/logout")}>
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                </div>

                <div
                    className="mb-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1"
                >
                    <CatsNav role={role} />
                </div>

                {children}
            </div>
        </div>
    );
}
