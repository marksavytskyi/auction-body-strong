"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { Mail, Lock, KeyRound, Car } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";

const RegisterSchema = Yup.object().shape({
    email: Yup.string().email("Invalid email address").required("Email is required"),
    password: Yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
    invite_code: Yup.string().required("Invite code is required"),
});

export default function Page() {
    const router = useRouter();

    const handleSubmit = async (values, { setSubmitting, resetForm, setStatus }) => {
        setSubmitting(true);
        setStatus(undefined);

        try {
            // backend ожидает: { email, password, invite_code }
            await axiosInstance.post("/auth/register", values);

            resetForm();
            toast.success("Registered successfully! Now login.");
            router.push("/login");
        } catch (error) {
            const msg =
                error?.response?.data?.detail ||
                error?.message ||
                "Something went wrong!";
            setStatus(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="border-0 bg-transparent shadow-none backdrop-blur-0 p-0">
            <CardHeader className="text-center p-0 mb-8">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-accent/10 rounded-2xl border border-accent/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                        <Car className="h-10 w-10 text-accent" />
                    </div>
                </div>
                <CardTitle className="text-3xl font-black tracking-tighter uppercase italic mb-2">
                    STRONGG. <span className="text-accent">AUTO</span>
                </CardTitle>
                <CardDescription className="text-white/50">Create your professional account</CardDescription>
            </CardHeader>

            <CardContent className="p-0">
                <Formik
                    initialValues={{ email: "", password: "", invite_code: "" }}
                    validationSchema={RegisterSchema}
                    onSubmit={handleSubmit}
                >
                    {({ errors, touched, isSubmitting, status }) => (
                        <Form className="space-y-6">
                            <div className="space-y-4">
                                {/* Email */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Field
                                            as={Input}
                                            id="email"
                                            name="email"
                                            placeholder="Email address"
                                            className="pl-11"
                                            autoComplete="email"
                                        />
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    </div>
                                    {errors.email && touched.email && (
                                        <p className="text-red-400 text-xs font-medium ml-1">{String(errors.email)}</p>
                                    )}
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Field
                                            as={Input}
                                            id="password"
                                            name="password"
                                            type="password"
                                            placeholder="Password"
                                            className="pl-11"
                                            autoComplete="new-password"
                                        />
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    </div>
                                    {errors.password && touched.password && (
                                        <p className="text-red-400 text-xs font-medium ml-1">{String(errors.password)}</p>
                                    )}
                                </div>

                                {/* Invite code */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Field
                                            as={Input}
                                            id="invite_code"
                                            name="invite_code"
                                            placeholder="Invite code"
                                            className="pl-11"
                                            autoComplete="off"
                                        />
                                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    </div>
                                    {errors.invite_code && touched.invite_code && (
                                        <p className="text-red-400 text-xs font-medium ml-1">{String(errors.invite_code)}</p>
                                    )}
                                </div>

                                {status && (
                                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                        {String(status)}
                                    </div>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 text-base"
                                isLoading={isSubmitting}
                                disabled={isSubmitting}
                            >
                                Create Account
                            </Button>

                            <div className="text-center">
                                <p className="text-sm text-white/40">
                                    Already have an account?{" "}
                                    <button
                                        type="button"
                                        onClick={() => router.push("/login")}
                                        className="text-accent hover:underline font-semibold transition-all"
                                    >
                                        Sign In
                                    </button>
                                </p>
                            </div>
                        </Form>
                    )}
                </Formik>
            </CardContent>
        </Card>
    );
}