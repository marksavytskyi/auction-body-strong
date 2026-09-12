"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isAdminTierRole, isOwnerRole, homeRouteForRole } from "@/lib/rbac";

// UX-only guard: redirects a role that has no business being on this page
// to their own home instead of leaving them on a screen that will just
// 403 every API call. The backend remains the real gate — every page that
// uses this still handles a 403 gracefully on its own.
export function useAdminTierGate() {
    const router = useRouter();
    const { roleReady, role } = useAuth();

    useEffect(() => {
        if (!roleReady) return;
        if (!isAdminTierRole(role)) router.replace(homeRouteForRole(role));
    }, [roleReady, role, router]);

    return { ready: roleReady && isAdminTierRole(role) };
}

// Stricter than useAdminTierGate — OWNER only. Used for Users & Roles:
// could not positively verify with a real ADMIN token that the backend
// permits ADMIN to change roles/active-status, so per product direction
// this stays OWNER-only until that's confirmed (see CatsNav.js).
export function useOwnerOnlyGate() {
    const router = useRouter();
    const { roleReady, role } = useAuth();

    useEffect(() => {
        if (!roleReady) return;
        if (!isOwnerRole(role)) router.replace(homeRouteForRole(role));
    }, [roleReady, role, router]);

    return { ready: roleReady && isOwnerRole(role) };
}
