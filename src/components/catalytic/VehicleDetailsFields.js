"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckCircle2, Hash, Keyboard, Loader2, ScanLine } from "lucide-react";

import { CatalyticApiError } from "@/lib/catalytic/api";
import { lookupVin } from "@/lib/catalytic/workerCaptures";
import { CHECK_DIGIT_WARNING, VIN_LENGTH, normalizeVin, validateVin } from "@/lib/catalytic/vin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The camera and OCR code load only when a worker taps Scan VIN.
const VinScanner = dynamic(() => import("./VinScanner"), { ssr: false });

const FIELDS = ["year", "make", "model", "engine"];

const vehicleLine = (r) => [r.year, r.make, r.model].filter(Boolean).join(" ");

export function vehicleCanContinue(value) {
    const vin = normalizeVin(value.vin);
    if (vin && !validateVin(vin).valid) return false;
    return Boolean(vin) || Boolean(value.year && value.make.trim() && value.model.trim());
}

// VIN entry and the four vehicle fields, for a new capture and for editing one. Every field
// stays editable whatever a lookup filled in.
//
// autofill: a decoder's answer goes straight into the fields a worker hasn't typed in. A
// vehicle already known to STRONGG is always offered, never applied unasked, and so is
// anything found while editing, where the fields already hold the worker's saved values.
export default function VehicleDetailsFields({ value, onChange, autofill = false, captureId = null }) {
    const [scanning, setScanning] = useState(false);
    const [lookup, setLookup] = useState({ state: "idle", result: null });
    const [touchedVin, setTouchedVin] = useState(false);
    const vinInputRef = useRef(null);
    const typed = useRef(new Set());
    const lastLooked = useRef(captureId ? normalizeVin(value.vin) : "");
    const requestId = useRef(0);
    const valueRef = useRef(value);
    valueRef.current = value;

    const check = validateVin(value.vin);
    const fieldsWithResult = useCallback((result) => {
        const next = { ...valueRef.current };
        FIELDS.forEach((name) => {
            if (result[name] && !typed.current.has(name)) next[name] = String(result[name]);
        });
        return next;
    }, []);

    const runLookup = useCallback(async (vin) => {
        lastLooked.current = vin;
        const id = ++requestId.current;
        setLookup({ state: "loading", result: null });
        try {
            const result = await lookupVin(vin);
            if (id !== requestId.current) return;
            setLookup({ state: "done", result });
            if (autofill && !result.found_existing && result.source !== "NONE") onChange(fieldsWithResult(result));
        } catch (error) {
            if (id !== requestId.current) return;
            setLookup({
                state: "failed",
                result: { message: error instanceof CatalyticApiError && error.status === 400 ? error.message : "VIN lookup failed. Please enter the details manually." },
            });
        }
    }, [autofill, fieldsWithResult, onChange]);

    useEffect(() => {
        const vin = normalizeVin(value.vin);
        if (validateVin(vin).valid && vin !== lastLooked.current) {
            runLookup(vin);
        } else if (!vin || vin.length !== VIN_LENGTH) {
            requestId.current += 1;
            lastLooked.current = captureId && vin === lastLooked.current ? vin : "";
            setLookup((current) => (current.state === "idle" ? current : { state: "idle", result: null }));
        }
    }, [value.vin, runLookup, captureId]);

    const setField = (name, next) => {
        if (next) typed.current.add(name);
        else typed.current.delete(name);
        onChange({ ...value, [name]: next });
    };

    const useDetails = () => {
        const { result } = lookup;
        const next = { ...value };
        FIELDS.forEach((name) => {
            if (result[name]) next[name] = String(result[name]);
        });
        onChange(next);
        FIELDS.forEach((name) => result[name] && typed.current.delete(name));
        setLookup({ ...lookup, applied: true });
    };

    const result = lookup.result;
    const offerResult = result && lookup.state === "done" && result.source !== "NONE" && (result.found_existing || !autofill);
    const showEngineMessage = lookup.state === "done" && result?.source !== "NONE" && !result?.engine && !value.engine.trim();

    return (
        <>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-3">
                <Label className="text-white/70 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> VIN
                </Label>
                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" className="h-14 rounded-2xl" onClick={() => setScanning(true)}>
                        <ScanLine className="mr-1.5 h-5 w-5" /> Scan VIN
                    </Button>
                    <Button type="button" variant="outline" className="h-14 rounded-2xl border-white/15" onClick={() => vinInputRef.current?.focus()}>
                        <Keyboard className="mr-1.5 h-4 w-4" /> Enter Manually
                    </Button>
                </div>
                <Input
                    ref={vinInputRef}
                    aria-label="VIN"
                    value={value.vin}
                    onChange={(e) => {
                        setTouchedVin(true);
                        onChange({ ...value, vin: normalizeVin(e.target.value).slice(0, VIN_LENGTH) });
                    }}
                    onBlur={() => setTouchedVin(true)}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Scan or type VIN"
                    className="h-14 rounded-xl bg-white/5 border-white/10 font-mono uppercase text-base"
                />
                {value.vin.length > 0 && value.vin.length !== VIN_LENGTH && !touchedVin && (
                    <p className="text-[11px] text-white/35">{value.vin.length}/{VIN_LENGTH} characters</p>
                )}
                {value.vin.length > 0 && touchedVin && check.errors.map((error) => (
                    <p key={error} role="alert" className="text-xs text-rose-300">{error}</p>
                ))}
                {check.valid && !check.checkDigitOk && <p className="text-xs text-amber-300">{CHECK_DIGIT_WARNING}</p>}

                {lookup.state === "loading" && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-white/60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking up this VIN…
                    </p>
                )}
                {lookup.state === "failed" && <p role="status" className="text-xs text-amber-300">{result.message}</p>}
                {lookup.state === "done" && result.source === "NONE" && <p role="status" className="text-xs text-amber-300">{result.message}</p>}

                {offerResult && (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2" data-testid="vehicle-found">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            {result.found_existing ? "Vehicle found" : "VIN decoded"}
                        </div>
                        <div className="text-sm font-bold text-white/90">{vehicleLine(result)}</div>
                        {result.engine && <div className="text-xs text-white/60">{result.engine}</div>}
                        {lookup.applied ? (
                            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Details applied. You can still change them.</p>
                        ) : (
                            <Button type="button" variant="outline" className="h-11 w-full rounded-xl border-white/15" onClick={useDetails}>
                                Use Vehicle Details
                            </Button>
                        )}
                    </div>
                )}
                {lookup.state === "done" && result.own_capture && result.own_capture.id !== captureId && (
                    <p className="text-xs text-amber-200">
                        You already have this vehicle in progress.{" "}
                        <Link href={`/worker/captures/${result.own_capture.id}`} className="font-bold underline">Open it</Link> instead of starting again.
                    </p>
                )}
                {lookup.state === "done" && result.approved_elsewhere && (
                    <p className="text-xs text-amber-200">This VIN already has an approved submission, so a moderator will need to resolve this one by hand.</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label htmlFor="vehicle-year" className="text-white/60 text-xs uppercase tracking-wider">Year</Label>
                    <Input id="vehicle-year" type="number" inputMode="numeric" value={value.year} onChange={(e) => setField("year", e.target.value)} placeholder="2018" className="h-12 rounded-xl bg-white/5 border-white/10 text-base" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="vehicle-make" className="text-white/60 text-xs uppercase tracking-wider">Make</Label>
                    <Input id="vehicle-make" value={value.make} onChange={(e) => setField("make", e.target.value)} placeholder="Ford" className="h-12 rounded-xl bg-white/5 border-white/10 text-base" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="vehicle-model" className="text-white/60 text-xs uppercase tracking-wider">Model</Label>
                    <Input id="vehicle-model" value={value.model} onChange={(e) => setField("model", e.target.value)} placeholder="F-150" className="h-12 rounded-xl bg-white/5 border-white/10 text-base" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="vehicle-engine" className="text-white/60 text-xs uppercase tracking-wider">Engine</Label>
                    <Input id="vehicle-engine" value={value.engine} onChange={(e) => setField("engine", e.target.value)} placeholder="3.5L" className="h-12 rounded-xl bg-white/5 border-white/10 text-base" />
                </div>
            </div>
            {showEngineMessage && <p role="status" className="text-xs text-amber-300">{result.message}</p>}

            {scanning && (
                <VinScanner
                    onClose={() => {
                        setScanning(false);
                    }}
                    onDetected={(vin) => {
                        setScanning(false);
                        setTouchedVin(true);
                        lastLooked.current = lastLooked.current === vin ? "" : lastLooked.current;
                        onChange({ ...valueRef.current, vin });
                    }}
                />
            )}
        </>
    );
}
