"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isValidEmail, useSimpleForm } from "@/hooks/useSimpleForm";
import { getLastModule } from "@/lib/moduleStorage";
import { homeRouteForRole } from "@/lib/rbac";

const VALID_INVITE_CODE = process.env.NEXT_PUBLIC_REGISTRATION_INVITE_CODE || "";
const AUTH_TIMEOUT_MS = 20_000;

const INITIAL_VALUES = { email: "", password: "", invite_code: "" };

function validate(values) {
    const errors = {};
    if (!values.email) errors.email = "Email is required";
    else if (!isValidEmail(values.email)) errors.email = "Invalid email address";
    if (!values.password) errors.password = "Password is required";
    else if (values.password.length < 6) errors.password = "Password must be at least 6 characters";
    if (!values.invite_code) errors.invite_code = "Invite code is required";
    return errors;
}

function RevealInput({ name, form, shown, onToggle, label, placeholder, autoComplete }) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={name} className="text-xs font-medium text-white/60">{label}</label>
            <div className="relative">
                <Input
                    {...form.field(name)}
                    type={shown ? "text" : "password"}
                    placeholder={placeholder}
                    className="h-12 rounded-xl border-white/10 bg-white/5 pr-12"
                    autoComplete={autoComplete}
                />
                <button
                    type="button"
                    aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                    onClick={onToggle}
                    className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-white/40 hover:text-emerald-400"
                >
                    {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>
            {form.shownError(name) && <p role="alert" className="text-xs text-red-400">{form.shownError(name)}</p>}
        </div>
    );
}

export default function Page() {
    const router = useRouter();
    const { saveToken } = useAuth();
    const [showInviteCode, setShowInviteCode] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);

    const form = useSimpleForm({
        initialValues: INITIAL_VALUES,
        validate,
        onSubmit: async (values, { setStatus, resetForm }) => {
            if (values.invite_code !== VALID_INVITE_CODE) {
                setStatus("Invalid invite code.");
                return;
            }

            try {
                const response = await axiosInstance.post("/auth/register", values, { timeout: AUTH_TIMEOUT_MS });
                const accessToken = response?.data?.access_token;

                resetForm();
                toast.success("Registered successfully!");
                if (!accessToken) {
                    router.push("/login");
                    return;
                }
                saveToken(accessToken);

                if (getLastModule() === "cats") {
                    // Every new registration defaults to WORKER on the
                    // backend — send them straight to the capture flow,
                    // not the admin lookup screen.
                    try {
                        const me = await axiosInstance.get("/auth/me", { timeout: AUTH_TIMEOUT_MS });
                        router.push(homeRouteForRole(me?.data?.role));
                    } catch {
                        router.push("/worker");
                    }
                } else {
                    router.push("/dashboard");
                }
            } catch (error) {
                setStatus(
                    error?.response
                        ? error.response.data?.detail || "Something went wrong!"
                        : "Can't reach the server. Check your connection and try again."
                );
            }
        },
    });

    return (
        <div>
            <div className="mb-6 text-center">
                <div className="text-sm font-black italic tracking-tight text-emerald-400 lg:hidden">STRONGG. AUTO</div>
                <h1 className="mt-1 text-2xl font-bold">Create account</h1>
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

                <RevealInput
                    name="password"
                    form={form}
                    shown={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    label="Password"
                    placeholder="Password"
                    autoComplete="new-password"
                />
                <RevealInput
                    name="invite_code"
                    form={form}
                    shown={showInviteCode}
                    onToggle={() => setShowInviteCode(!showInviteCode)}
                    label="Invite code"
                    placeholder="Invite code"
                    autoComplete="off"
                />

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
                    Create Account <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="pt-2 text-center text-sm text-white/40">
                    Already have an account?{" "}
                    <button
                        type="button"
                        onClick={() => router.push("/login")}
                        className="font-bold text-emerald-500 underline underline-offset-4 hover:text-emerald-400"
                    >
                        Sign In
                    </button>
                </p>
            </form>
        </div>
    );
}
