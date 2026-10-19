"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Boxes, Sparkles, User, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/hooks/useAuth";
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
    const router = useRouter();
    const { ready, isLoggedIn, email: userEmail, role, roleReady } = useAuth();
    const flagEnabled = isOperationsUiEnabled();

    useEffect(() => {
        if (!ready) return;
        if (!isLoggedIn) router.replace("/login");
    }, [ready, isLoggedIn, router]);

    useEffect(() => {
        if (!roleReady || !isLoggedIn) return;
        if (!isAdminTierRole(role)) router.replace("/dashboard");
    }, [roleReady, isLoggedIn, role, router]);

    useEffect(() => {
        setLastModule("operations");
    }, []);

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

    if (!ready || !roleReady) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#020202]">
                <div className="text-white/70 text-sm uppercase tracking-[0.2em]">Loading Operations module...</div>
            </div>
        );
    }

    if (!isLoggedIn || !isAdminTierRole(role)) return null;

    return (
        <div className="relative min-h-screen w-full bg-[#020202] text-white overflow-hidden">
            <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "42px 42px" }} />
            <div className="absolute -top-[28rem] -left-[18rem] h-[44rem] w-[44rem] rounded-full bg-emerald-500/10 blur-[180px]" />
            <div className="absolute -bottom-[30rem] -right-[18rem] h-[44rem] w-[44rem] rounded-full bg-amber-500/10 blur-[180px]" />

            <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-12">
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
                            <Boxes className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-white/45 font-bold">
                                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                Vehicle Recovery Orchestration
                            </div>
                            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight uppercase italic text-gradient">
                                Operations
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ModuleSwitcher active="operations" />
                        {userEmail && (
                            <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <User className="h-3.5 w-3.5 text-emerald-400" />
                                </div>
                                <span className="text-xs font-bold text-white/70 tracking-wide select-none">{userEmail}</span>
                            </div>
                        )}
                        <Button variant="outline" className="rounded-2xl border-white/15 h-11 px-5" onClick={() => router.push("/logout")}>
                            <LogOut className="mr-1.5 h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                    {children}
                </motion.div>
            </div>
        </div>
    );
}
