"use client";

import React from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { Search, Calendar, Car, Cog, Wrench, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Bounds match the backend's LookupRequest schema (year: 1980-2030) so
// invalid input is caught client-side instead of round-tripping a 422.
const LookupSchema = Yup.object().shape({
    year: Yup.number()
        .typeError("Year must be a number")
        .min(1980, "Year must be 1980 or later")
        .max(2030, "Year must be 2030 or earlier")
        .required("Year is required"),
    make: Yup.string().required("Make is required"),
    model: Yup.string().required("Model is required"),
    engine: Yup.string(),
    vin: Yup.string()
        .transform((v) => (v ? v.trim().toUpperCase() : v))
        .test("vin-len", "VIN should be 17 characters", (v) => !v || v.length === 17),
});

const fieldClass = "pl-11 h-12 bg-white/5 border-white/10 rounded-2xl focus:border-sky-500/50 focus:ring-sky-500/20 transition-all";
const iconClass = "absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-white/25 group-focus-within:text-sky-400 transition-colors";

export default function VehicleLookupForm({ onSubmit, isSubmitting }) {
    return (
        <Formik
            initialValues={{ year: "", make: "", model: "", engine: "", vin: "" }}
            validationSchema={LookupSchema}
            onSubmit={onSubmit}
        >
            {({ errors, touched }) => (
                <Form className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="year" className="text-white/60 text-xs uppercase tracking-wider">Year</Label>
                        <div className="relative group">
                            <Field as={Input} id="year" name="year" type="number" placeholder="2007" className={fieldClass} />
                            <Calendar className={iconClass} />
                        </div>
                        {errors.year && touched.year && <p className="text-red-400 text-[10px] font-bold ml-1">{String(errors.year)}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="make" className="text-white/60 text-xs uppercase tracking-wider">Make</Label>
                        <div className="relative group">
                            <Field as={Input} id="make" name="make" placeholder="Toyota" className={fieldClass} />
                            <Car className={iconClass} />
                        </div>
                        {errors.make && touched.make && <p className="text-red-400 text-[10px] font-bold ml-1">{String(errors.make)}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="model" className="text-white/60 text-xs uppercase tracking-wider">Model</Label>
                        <div className="relative group">
                            <Field as={Input} id="model" name="model" placeholder="Prius" className={fieldClass} />
                            <Cog className={iconClass} />
                        </div>
                        {errors.model && touched.model && <p className="text-red-400 text-[10px] font-bold ml-1">{String(errors.model)}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="engine" className="text-white/60 text-xs uppercase tracking-wider">Engine <span className="text-white/30 normal-case">(optional)</span></Label>
                        <div className="relative group">
                            <Field as={Input} id="engine" name="engine" placeholder="1.5 Hybrid" className={fieldClass} />
                            <Wrench className={iconClass} />
                        </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="vin" className="text-white/60 text-xs uppercase tracking-wider">VIN <span className="text-white/30 normal-case">(optional)</span></Label>
                        <div className="relative group">
                            <Field as={Input} id="vin" name="vin" placeholder="17-character VIN" maxLength={17} className={`${fieldClass} uppercase`} />
                            <Hash className={iconClass} />
                        </div>
                        {errors.vin && touched.vin && <p className="text-red-400 text-[10px] font-bold ml-1">{String(errors.vin)}</p>}
                    </div>

                    <div className="sm:col-span-2">
                        <Button
                            type="submit"
                            className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-black shadow-[0_10px_20px_-10px_rgba(14,165,233,0.4)]"
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                        >
                            <Search className="mr-1.5 h-4 w-4" />
                            Look Up Vehicle
                        </Button>
                    </div>
                </Form>
            )}
        </Formik>
    );
}
