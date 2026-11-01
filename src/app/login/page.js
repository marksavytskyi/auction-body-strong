"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import { fetchRole, useAuth } from "@/hooks/useAuth";
import { isValidEmail, useSimpleForm } from "@/hooks/useSimpleForm";
import { homeRouteForRole } from "@/lib/rbac";

// A dead connection should fail here in seconds, not after the app-wide
// timeout that exists for long uploads.
const AUTH_TIMEOUT_MS = 20_000;

const INITIAL_VALUES = { email: "", password: "" };

function validate(values) {
    const errors = {};
    if (!values.email) errors.email = "Email is required";
    else if (!isValidEmail(values.email)) errors.email = "Invalid email address";
    if (!values.password) errors.password = "Password is required";
    else if (values.password.length < 6) errors.password = "Password must be at least 6 characters";
    return errors;
}

export default function Page() {
    const router = useRouter();
    const { ready, isLoggedIn, role, roleReady, saveToken } = useAuth();
    const [showPassword, setShowPassword] = React.useState(false);
    // Signing in also flips isLoggedIn; the submit handler owns that redirect.
    const signingIn = useRef(false);

    useEffect(() => {
        if (ready && isLoggedIn && roleReady && !signingIn.current) router.replace(homeRouteForRole(role));
    }, [ready, isLoggedIn, roleReady, role, router]);

    const form = useSimpleForm({
        initialValues: INITIAL_VALUES,
        validate,
        onSubmit: async (values, { setStatus }) => {
            signingIn.current = true;
            try {
                const response = await axiosInstance.post("/auth/login", values, { timeout: AUTH_TIMEOUT_MS });
                const accessToken = response?.data?.access_token;
                if (!accessToken) throw new Error("No access_token in response");
                saveToken(accessToken);
                let accountRole = null;
                try {
                    accountRole = (await fetchRole(accessToken))?.data?.role;
                } catch {
                    // The destination's guard reports this and offers a retry.
                }
                router.replace(homeRouteForRole(accountRole));
            } catch (error) {
                signingIn.current = false;
                setStatus(
                    error?.response || error?.message === "No access_token in response"
                        ? error.response?.data?.detail || "Invalid credentials or something went wrong!"
                        : "Can't reach the server. Check your connection and try again."
                );
            }
        },
    });

    return (
        <div>
            <div className="mb-6 text-center">
                <div className="text-sm font-black italic tracking-tight text-emerald-400 lg:hidden">STRONGG. AUTO</div>
                <h1 className="mt-1 text-2xl font-bold">Sign in</h1>
            </div>

            <form className="space-y-4" onSubmit={form.handleSubmit} noValidate>
                <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-medium text-white/60">Email</label>
                    <Input
                        {...form.field("email")}
                        type="email"
                        inputMode="email"
                        placeholder="Email address"
                        className="h-12 rounded-xl border-white/10 bg-white/5"
                        autoComplete="email"
                        autoCapitalize="none"
                    />
                    {form.shownError("email") && <p role="alert" className="text-xs text-red-400">{form.shownError("email")}</p>}
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="password" className="text-xs font-medium text-white/60">Password</label>
                    <div className="relative">
                        <Input
                            {...form.field("password")}
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            className="h-12 rounded-xl border-white/10 bg-white/5 pr-12"
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-white/40 hover:text-emerald-400"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                    {form.shownError("password") && <p role="alert" className="text-xs text-red-400">{form.shownError("password")}</p>}
                </div>

                {form.status && (
                    <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                        {String(form.status)}
                    </div>
                )}

                <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-emerald-500 text-sm font-bold text-black hover:bg-emerald-600"
                    isLoading={form.isSubmitting}
                    disabled={form.isSubmitting}
                >
                    Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="pt-2 text-center text-sm text-white/40">
                    New to Strongg?{" "}
                    <button
                        type="button"
                        onClick={() => router.push("/register")}
                        className="font-bold text-emerald-500 underline underline-offset-4 hover:text-emerald-400"
                    >
                        Create Account
                    </button>
                </p>
            </form>
        </div>
    );
}
