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
import {UserRound, Mail, Lock} from "lucide-react"
import axiosInstance from "@/utils/axios";
import {useRouter} from "next/navigation";

const RegisterSchema = Yup.object().shape({
    fullName: Yup.string().required('Full Name is required'),
    email: Yup.string().email('Invalid email address').required('Email is required'),
    password: Yup.string()
        .min(6, 'Password must be at least 6 characters')
        .required('Password is required'),
});

const Page = () => {
    const router = useRouter()
    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true)

        try {
const response = axiosInstance.post("/auth/register", {data: values})
            console.log("response", response)
            alert("Form submitted successfully!");
            resetForm();
            await router.push("/login")
        } catch(error) {
            console.error("Error submitting form:", error);
            alert("Something went wrong!");
        } finally {
            setSubmitting(false); // Disable the "Submitting" state
        }

    };

    return (
        <Card className="w-full flex flex-col align-middle justify-center">
            <CardHeader>
                <CardTitle>Hello!</CardTitle>
                <CardDescription>Sign Up to Get Started</CardDescription>
            </CardHeader>
            <CardContent>
                <Formik
                    initialValues={{
                        fullName: '',
                        email: '',
                        password: '',
                    }}
                    validationSchema={RegisterSchema}
                    onSubmit={handleSubmit}
                >
                    {({ errors, touched, isSubmitting, dirty, isValid }) => {
                        return  <Form>
                            <div className="grid w-full items-center gap-4">
                                {/* Full Name Field */}

                                <div className="space-y-1.5">
                                    <div className={"w-full h-max relative"}>
                                        <Field
                                            as={Input}
                                            id="fullName"
                                            name="fullName"
                                            placeholder={"Full name"}
                                            className={"pl-[40px]"}
                                        >

                                        </Field>
                                        <UserRound className={"space-y-0 absolute top-1/2 left-6 transform -translate-x-1/2 -translate-y-1/2"} />
                                    </div>
                                    {errors.fullName && touched.fullName && (
                                        <p className="text-red-500 text-sm">{errors.fullName}</p>
                                    )}
                                </div>

                                {/* Email Field */}
                                <div className="space-y-1.5">
                                    <div className={"w-full h-max relative"}>
                                        <Field
                                            as={Input}
                                            id="email"
                                            name="email"
                                            placeholder="Enter your email address"
                                            className={"pl-[40px]"}
                                        />
                                        <Mail className={"space-y-0 absolute top-1/2 left-6 transform -translate-x-1/2 -translate-y-1/2"} />
                                    </div>


                                    {errors.email && touched.email && (
                                        <p className="text-red-500 text-sm">{errors.email}</p>
                                    )}
                                </div>

                                {/* Password Field */}
                                <div className="space-y-1.5">
                                    <div className={"w-full h-max relative"}>
                                        <Field
                                            as={Input}
                                            id="password"
                                            name="password"
                                            type="password"
                                            placeholder="Enter your password"
                                            className={"pl-[40px]"}
                                        />
                                        <Lock className={"space-y-0 absolute top-1/2 left-6 transform -translate-x-1/2 -translate-y-1/2"} />
                                    </div>


                                    {errors.password && touched.password && (
                                        <p className="text-red-500 text-sm">{errors.password}</p>
                                    )}
                                </div>
                            </div>

                            <CardFooter className="flex justify-center mt-4">
                                <Button type="submit" className={"rounded-full w-full px-0 bg-accent h-[48px]"} isLoading={isSubmitting} disabled={isSubmitting}>Register</Button>
                            </CardFooter>
                        </Form>

                    }}
                </Formik>
            </CardContent>
        </Card>
    );
}
export default Page