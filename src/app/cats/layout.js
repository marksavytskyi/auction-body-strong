"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Sparkles, FlaskConical, User } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import ModuleSwitcher from "@/components/shell/ModuleSwitcher";
import CatsNav from "@/components/catalytic/CatsNav";
import { setLastModule } from "@/lib/moduleStorage";

export default function CatsLayout({ children }) {
    const router = useRouter();
    const { ready, isLoggedIn, email: userEmail } = useAuth();

    useEffect(() => {
        if (!ready) return;
        if (!isLoggedIn) router.replace("/login");
    }, [ready, isLoggedIn, router]);

    useEffect(() => {
        setLastModule("cats");
    }, []);

    if (!ready) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#020202]">
                <div className="text-white/70 text-sm uppercase tracking-[0.2em]">Loading Cats module...</div>
            </div>
        );
    }

    if (!isLoggedIn) return null;

    return (
        <div className="relative min-h-screen w-full bg-[#020202] text-white overflow-hidden">
            <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "42px 42px" }} />
            <div className="absolute -top-[28rem] -left-[18rem] h-[44rem] w-[44rem] rounded-full bg-sky-500/10 blur-[180px]" />
            <div className="absolute -bottom-[30rem] -right-[18rem] h-[44rem] w-[44rem] rounded-full bg-emerald-500/10 blur-[180px]" />

            <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-12">
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 accent-glow-sm">
                            <FlaskConical className="h-6 w-6 text-sky-400" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-white/45 font-bold">
                                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                                Catalytic Converter Intelligence
                            </div>
                            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight uppercase italic text-gradient">
                                Cats <span className="text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-sky-600">Module</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ModuleSwitcher active="cats" />
                        {userEmail && (
                            <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                                <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                                    <User className="h-3.5 w-3.5 text-sky-400" />
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

                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 }}
                    className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-2"
                >
                    <CatsNav />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                    {children}
                </motion.div>
            </div>
        </div>
    );
}
