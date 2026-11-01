"use client";

import React from "react";
import { Search, Calendar, Car, Cog, Wrench, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSimpleForm } from "@/hooks/useSimpleForm";

const INITIAL_VALUES = { year: "", make: "", model: "", engine: "", vin: "" };

// Bounds match the backend's LookupRequest schema (year: 1980-2030) so
// invalid input is caught client-side instead of round-tripping a 422.
function validate(values) {
    const errors = {};
    const year = Number(values.year);
    if (values.year === "") errors.year = "Year is required";
    else if (Number.isNaN(year)) errors.year = "Year must be a number";
    else if (year < 1980) errors.year = "Year must be 1980 or later";
    else if (year > 2030) errors.year = "Year must be 2030 or earlier";
    if (!values.make) errors.make = "Make is required";
    if (!values.model) errors.model = "Model is required";
    const vin = values.vin.trim();
    if (vin && vin.length !== 17) errors.vin = "VIN should be 17 characters";
    return errors;
}

const fieldClass = "pl-11 h-12 bg-white/5 border-white/10 rounded-2xl focus:border-sky-500/50 focus:ring-sky-500/20";
const iconClass = "absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-white/25 group-focus-within:text-sky-400";
const labelClass = "text-white/60 text-xs uppercase tracking-wider";

function FieldError({ message }) {
    return message ? <p role="alert" className="text-red-400 text-[10px] font-bold ml-1">{message}</p> : null;
}

export default function VehicleLookupForm({ onSubmit }) {
    const form = useSimpleForm({
        initialValues: INITIAL_VALUES,
        validate,
        // Callers still receive a setSubmitting helper; this form tracks its own state.
        onSubmit: (values) => onSubmit({ ...values, year: Number(values.year) }, { setSubmitting: () => {} }),
    });

    return (
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit} noValidate>
            <div className="space-y-1.5">
                <Label htmlFor="year" className={labelClass}>Year</Label>
                <div className="relative group">
                    <Input {...form.field("year")} type="number" inputMode="numeric" placeholder="2007" className={fieldClass} />
                    <Calendar className={iconClass} />
                </div>
                <FieldError message={form.shownError("year")} />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="make" className={labelClass}>Make</Label>
                <div className="relative group">
                    <Input {...form.field("make")} placeholder="Toyota" className={fieldClass} />
                    <Car className={iconClass} />
                </div>
                <FieldError message={form.shownError("make")} />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="model" className={labelClass}>Model</Label>
                <div className="relative group">
                    <Input {...form.field("model")} placeholder="Prius" className={fieldClass} />
                    <Cog className={iconClass} />
                </div>
                <FieldError message={form.shownError("model")} />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="engine" className={labelClass}>Engine <span className="text-white/30 normal-case">(optional)</span></Label>
                <div className="relative group">
                    <Input {...form.field("engine")} placeholder="1.5 Hybrid" className={fieldClass} />
                    <Wrench className={iconClass} />
                </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="vin" className={labelClass}>VIN <span className="text-white/30 normal-case">(optional)</span></Label>
                <div className="relative group">
                    <Input {...form.field("vin")} placeholder="17-character VIN" maxLength={17} className={`${fieldClass} uppercase`} />
                    <Hash className={iconClass} />
                </div>
                <FieldError message={form.shownError("vin")} />
            </div>

            <div className="sm:col-span-2">
                <Button
                    type="submit"
                    className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-black"
                    isLoading={form.isSubmitting}
                    disabled={form.isSubmitting}
                >
                    <Search className="mr-1.5 h-4 w-4" />
                    Look Up Vehicle
                </Button>
            </div>
        </form>
    );
}
