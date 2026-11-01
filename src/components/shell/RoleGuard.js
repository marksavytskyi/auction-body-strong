"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { homeRouteForRole } from "@/lib/rbac";

// Nothing inside renders, and so nothing inside fetches, until /auth/me has
// confirmed the role is allowed here. This is routing, not security: the backend
// still has to authorize every call.
export default function RoleGuard({ allow, loadingLabel = "Loading…", children }) {
    const router = useRouter();
    const { ready, isLoggedIn, role, roleReady, retryRole } = useAuth();

    useEffect(() => {
        if (ready && !isLoggedIn) router.replace("/login");
    }, [ready, isLoggedIn, router]);

    useEffect(() => {
        if (ready && isLoggedIn && roleReady && role && !allow(role)) router.replace(homeRouteForRole(role));
    }, [ready, isLoggedIn, roleReady, role, allow, router]);

    if (ready && !isLoggedIn) return null;

    if (!ready || !roleReady) {
        return (
            <div className="flex min-h-dvh w-full items-center justify-center bg-[#020202]">
                <div className="text-sm text-white/70">{loadingLabel}</div>
            </div>
        );
    }

    if (!role) {
        return (
            <div className="flex min-h-dvh w-full items-center justify-center bg-[#020202] px-4 text-white">
                <div className="max-w-sm space-y-3 text-center">
                    <h1 className="text-lg font-bold">Couldn&apos;t verify your account</h1>
                    <p className="text-sm text-white/60">Check your connection and try again.</p>
                    <div className="flex justify-center gap-2">
                        <button type="button" onClick={retryRole} className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-black hover:bg-emerald-600">
                            Try again
                        </button>
                        <button type="button" onClick={() => router.push("/logout")} className="h-11 rounded-xl border border-white/15 px-5 text-sm font-bold text-white/80">
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return allow(role) ? children : null;
}
