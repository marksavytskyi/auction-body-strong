"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Wrench, FlaskConical } from "lucide-react";
import { setLastModule } from "@/lib/moduleStorage";

const MODULES = [
    { id: "parts", label: "Parts", href: "/dashboard", icon: Wrench },
    { id: "cats", label: "Cats", href: "/cats", icon: FlaskConical },
];

export default function ModuleSwitcher({ active }) {
    const router = useRouter();

    return (
        <div
            role="tablist"
            aria-label="Product module"
            className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-md"
        >
            {MODULES.map(({ id, label, href, icon: Icon }) => {
                const isActive = id === active;
                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                            setLastModule(id);
                            if (!isActive) router.push(href);
                        }}
                        className={[
                            "inline-flex items-center gap-1.5 rounded-xl px-3.5 h-9 text-xs font-bold uppercase tracking-wider transition-all",
                            isActive
                                ? "bg-emerald-500 text-black shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)]"
                                : "text-white/50 hover:text-white hover:bg-white/5",
                        ].join(" ")}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
