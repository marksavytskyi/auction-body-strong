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
import { Mail, Lock, KeyRound, Car, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const VALID_INVITE_CODE = process.env.NEXT_PUBLIC_REGISTRATION_INVITE_CODE || "";

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

        if (values.invite_code !== VALID_INVITE_CODE) {
            setStatus("Invalid invite code.");
            setSubmitting(false);
            return;
        }

        try {
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
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <Card className="border-0 bg-transparent shadow-none p-0">
                <CardHeader className="text-center p-0 mb-10">
                    <div className="flex justify-center mb-8">
                        <div className="p-5 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 accent-glow-sm">
                            <Car className="h-12 w-12 text-emerald-500" />
                        </div>
                    </div>
                    <CardTitle className="text-4xl font-black tracking-tighter uppercase italic mb-3 text-gradient">
                        Create <span className="emerald-gradient">Account</span>
                    </CardTitle>
                    <CardDescription className="text-white/40 text-sm font-medium">Join our professional network</CardDescription>
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
                                        <div className="relative group">
                                            <Field
                                                as={Input}
                                                id="email"
                                                name="email"
                                                placeholder="Email address"
                                                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
                                                autoComplete="email"
                                            />
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                                        </div>
                                        {errors.email && touched.email && (
                                            <p className="text-red-400 text-[10px] uppercase tracking-wider font-bold ml-2">{String(errors.email)}</p>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-2">
                                        <div className="relative group">
                                            <Field
                                                as={Input}
                                                id="password"
                                                name="password"
                                                type="password"
                                                placeholder="Password"
                                                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
                                                autoComplete="new-password"
                                            />
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                                        </div>
                                        {errors.password && touched.password && (
                                            <p className="text-red-400 text-[10px] uppercase tracking-wider font-bold ml-2">{String(errors.password)}</p>
                                        )}
                                    </div>

                                    {/* Invite Code */}
                                    <div className="space-y-2">
                                        <div className="relative group">
                                            <Field
                                                as={Input}
                                                id="invite_code"
                                                name="invite_code"
                                                placeholder="Invite code"
                                                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
                                                autoComplete="off"
                                            />
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                                        </div>
                                        {errors.invite_code && touched.invite_code && (
                                            <p className="text-red-400 text-[10px] uppercase tracking-wider font-bold ml-2">{String(errors.invite_code)}</p>
                                        )}
                                    </div>

                                    {status && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                                        >
                                            {String(status)}
                                        </motion.div>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-14 text-sm font-bold uppercase tracking-widest rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black shadow-[0_10px_20px_-10px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98]"
                                    isLoading={isSubmitting}
                                    disabled={isSubmitting}
                                >
                                    Register Now <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>

                                <div className="text-center pt-4">
                                    <p className="text-sm text-white/30 font-medium">
                                        Already have an account?{" "}
                                        <button
                                            type="button"
                                            onClick={() => router.push("/login")}
                                            className="text-emerald-500 hover:text-emerald-400 font-bold transition-all underline underline-offset-4"
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
        </motion.div>
    );
}
