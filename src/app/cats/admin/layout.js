"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isAdminTierRole, homeRouteForRole } from "@/lib/rbac";

// Everything under /cats/admin/* is OWNER/ADMIN tier. MODERATOR and WORKER
// are routed to their own home rather than shown a raw 403 — the actual
// enforcement is server-side regardless (every API call here still checks
// its own response), this just avoids dead-end navigation.
export default function CatsAdminSectionLayout({ children }) {
    const router = useRouter();
    const { roleReady, role } = useAuth();

    useEffect(() => {
        if (!roleReady) return;
        if (!isAdminTierRole(role)) router.replace(homeRouteForRole(role));
    }, [roleReady, role, router]);

    if (!roleReady || !isAdminTierRole(role)) {
        return (
            <div className="flex items-center justify-center py-16 text-white/40 text-sm uppercase tracking-wider">
                Loading…
            </div>
        );
    }

    return children;
}
