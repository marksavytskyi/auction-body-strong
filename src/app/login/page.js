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
import { Mail, Lock, Car } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const LoginSchema = Yup.object().shape({
    email: Yup.string().email("Invalid email address").required("Email is required"),
    password: Yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
});

export default function Page() {
    const router = useRouter();
    const { saveToken } = useAuth();

    const handleSubmit = async (values, { setSubmitting, setStatus }) => {
        setSubmitting(true);
        setStatus(undefined);

        try {
            const response = await axiosInstance.post("/auth/login", values);

            const accessToken = response?.data?.access_token;
            if (!accessToken) throw new Error("No access_token in response");

            saveToken(accessToken);
            router.push("/dashboard");
        } catch (error) {
            const msg =
                error?.response?.data?.detail ||
                error?.message ||
                "Invalid credentials or something went wrong!";
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
                <CardDescription className="text-white/50">Next-Gen Vehicle Auction Intelligence</CardDescription>
            </CardHeader>

            <CardContent className="p-0">
                <Formik
                    initialValues={{ email: "", password: "" }}
                    validationSchema={LoginSchema}
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
                                            autoComplete="current-password"
                                        />
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                    </div>
                                    {errors.password && touched.password && (
                                        <p className="text-red-400 text-xs font-medium ml-1">{String(errors.password)}</p>
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
                                Sign In
                            </Button>

                            <div className="text-center">
                                <p className="text-sm text-white/40">
                                    Don’t have an account?{" "}
                                    <button
                                        type="button"
                                        onClick={() => router.push("/register")}
                                        className="text-accent hover:underline font-semibold transition-all"
                                    >
                                        Create one
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