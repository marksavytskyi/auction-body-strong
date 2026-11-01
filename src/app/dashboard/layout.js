"use client";

import RoleGuard from "@/components/shell/RoleGuard";
import { canUseMainApp } from "@/lib/rbac";

export default function DashboardLayout({ children }) {
    return <RoleGuard allow={canUseMainApp}>{children}</RoleGuard>;
}
