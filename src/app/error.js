"use client";

// One failed render must leave the user a way forward, not a blank page.
export default function RouteError({ reset }) {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-[#020202] px-4 text-white">
            <div className="max-w-sm space-y-3 text-center">
                <h1 className="text-lg font-bold">This page failed to load</h1>
                <p className="text-sm text-white/60">Your data is safe. Try again, or check your connection if this keeps happening.</p>
                <button type="button" onClick={reset} className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-black hover:bg-emerald-600">
                    Try again
                </button>
            </div>
        </div>
    );
}
