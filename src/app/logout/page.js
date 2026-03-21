"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function Page() {
    const { logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        logout();
        router.push("/login");
    }, [logout, router]);

    return null;
}