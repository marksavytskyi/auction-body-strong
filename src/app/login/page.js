'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Mail, Lock } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import {useAuth} from "@/hooks/useAuth";

// Validation schema for login form
const LoginSchema = Yup.object().shape({
    email: Yup.string().email('Invalid email address').required('Email is required'),
    password: Yup.string()
        .min(6, 'Password must be at least 6 characters')
        .required('Password is required'),
});

const Page = () => {
    const router = useRouter();
    const { isLoggedIn, setToken, logout, token } = useAuth();


    const handleSubmit = async (values, { setSubmitting }) => {
        setSubmitting(true)
        try {
            const response = await axiosInstance.post("/auth/login", { data: values });
            console.log("response", response)
            if(response.data.success) {
                setToken(response.data.data.token)
                alert("Login successful!");
                await router.push("/dashboard");
            }

        } catch (error) {
            console.error("Error logging in:", error);
            alert("Invalid credentials or something went wrong!");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="w-full flex flex-col align-middle justify-center">
            <CardHeader>
                <CardTitle>Welcome Back!</CardTitle>
                <CardDescription>Please log in to continue</CardDescription>
            </CardHeader>
            <CardContent>
                <Formik
                    initialValues={{
                        email: '',
                        password: '',
                    }}
                    validationSchema={LoginSchema}
                    onSubmit={handleSubmit}
                >
                    {({ errors, touched, isSubmitting }) => (
                        <Form>
                            <div className="grid w-full items-center gap-4">
                                {/* Email Field */}
                                <div className="space-y-1.5">
                                    <div className="w-full h-max relative">
                                        <Field
                                            as={Input}
                                            id="email"
                                            name="email"
                                            placeholder="Enter your email address"
                                            className="pl-[40px]"
                                        />

                                        <Mail className="absolute top-1/2 left-6 transform -translate-x-1/2 -translate-y-1/2" />
                                    </div>
                                    {errors.email && touched.email && (
                                        <p className="text-red-500 text-sm">{errors.email}</p>
                                    )}
                                </div>

                                {/* Password Field */}
                                <div className="space-y-1.5">
                                    <div className="w-full h-max relative">
                                        <Field
                                            as={Input}
                                            id="password"
                                            name="password"
                                            type="password"
                                            placeholder="Enter your password"
                                            className="pl-[40px]"
                                        />
                                        <Lock className="absolute top-1/2 left-6 transform -translate-x-1/2 -translate-y-1/2" />
                                    </div>
                                    {errors.password && touched.password && (
                                        <p className="text-red-500 text-sm">{errors.password}</p>
                                    )}
                                </div>
                            </div>

                            <CardFooter className="flex justify-center mt-4">
                                <Button type="submit" className="rounded-full w-full px-0 bg-accent h-[48px]" isLoading={isSubmitting} disabled={isSubmitting}>Login</Button>
                            </CardFooter>
                        </Form>
                    )}
                </Formik>
            </CardContent>
        </Card>
    );
};

export default Page;
