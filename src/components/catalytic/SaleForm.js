"use client";

import React, { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
    "w-full h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all";

const CONDITIONS = ["", "new", "used", "damaged", "core"];

export default function SaleForm({ onSubmit, isSubmitting }) {
    const [form, setForm] = useState({
        physical_code: "",
        buyer: "",
        sale_price: "",
        currency: "USD",
        sale_date: "",
        quantity: "1",
        condition: "",
        notes: "",
    });

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const canSubmit = form.physical_code.trim() && form.sale_price !== "" && Number(form.quantity) > 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        // buyer/currency/condition/notes are non-nullable strings on the
        // backend (default "") — never send null for them, only "".
        onSubmit({
            physical_code: form.physical_code.trim(),
            buyer: form.buyer.trim(),
            sale_price: Number(form.sale_price),
            currency: form.currency || "USD",
            sale_date: form.sale_date ? `${form.sale_date}T00:00:00Z` : null,
            quantity: Number(form.quantity) || 1,
            condition: form.condition,
            notes: form.notes.trim(),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Physical Code</Label>
                <Input value={form.physical_code} onChange={set("physical_code")} placeholder="ABC123" className="h-11 rounded-xl bg-white/5 border-white/10 font-mono uppercase" />
            </div>

            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Buyer (optional)</Label>
                <Input value={form.buyer} onChange={set("buyer")} placeholder="Buyer name / company" className="h-11 rounded-xl bg-white/5 border-white/10" />
            </div>

            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Sale Date</Label>
                <Input type="date" value={form.sale_date} onChange={set("sale_date")} className="h-11 rounded-xl bg-white/5 border-white/10" />
            </div>

            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Sale Price</Label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={set("sale_price")} placeholder="185.00" className="h-11 rounded-xl bg-white/5 border-white/10" />
            </div>

            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Currency</Label>
                <select className={selectClass} value={form.currency} onChange={set("currency")}>
                    {["USD", "EUR", "GBP"].map((c) => (
                        <option key={c} value={c} className="bg-[#0c0e13]">{c}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Quantity</Label>
                <Input type="number" min="1" value={form.quantity} onChange={set("quantity")} className="h-11 rounded-xl bg-white/5 border-white/10" />
            </div>

            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Condition</Label>
                <select className={selectClass} value={form.condition} onChange={set("condition")}>
                    {CONDITIONS.map((c) => (
                        <option key={c} value={c} className="bg-[#0c0e13]">{c || "Unspecified"}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Notes (optional)</Label>
                <textarea
                    value={form.notes}
                    onChange={set("notes")}
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
            </div>

            <div className="sm:col-span-2">
                <Button type="submit" className="w-full h-12 rounded-2xl" isLoading={isSubmitting} disabled={isSubmitting || !canSubmit}>
                    <Receipt className="mr-1.5 h-4 w-4" />
                    Record Sale
                </Button>
            </div>
        </form>
    );
}
