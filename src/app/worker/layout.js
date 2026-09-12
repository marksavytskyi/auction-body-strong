"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Wrench } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

// Deliberately minimal — a worker standing next to a car on a phone gets
// no admin chrome, no module switcher, no nav tabs. Just identity + logout
// and whatever the page itself renders.
export default function WorkerLayout({ children }) {
    const router = useRouter();
    const { ready, isLoggedIn, email } = useAuth();

    useEffect(() => {
        if (!ready) return;
        if (!isLoggedIn) router.replace("/login");
    }, [ready, isLoggedIn, router]);

    if (!ready) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#020202]">
                <div className="text-white/70 text-sm uppercase tracking-[0.2em]">Loading…</div>
            </div>
        );
    }

    if (!isLoggedIn) return null;

    return (
        <div className="min-h-screen w-full bg-[#020202] text-white">
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 h-14 border-b border-white/10 bg-[#020202]/95 backdrop-blur">
                <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white/85">
                    <Wrench className="h-4 w-4 text-emerald-400" />
                    Cats Capture
                </div>
                <div className="flex items-center gap-2 min-w-0">
                    {email && <span className="text-[11px] text-white/40 truncate max-w-[140px] hidden xs:inline">{email}</span>}
                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-white/15 px-3" onClick={() => router.push("/logout")}>
                        <LogOut className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-5">{children}</div>
        </div>
    );
}
