export default function AuthLayout({ children }) {
    return (
        <div className="flex min-h-dvh w-full bg-[#020202] text-white">
            <div className="hidden basis-1/2 flex-col items-center justify-center gap-4 border-r border-white/5 px-12 text-center lg:flex">
                <div className="text-7xl font-black italic tracking-tighter">
                    STRONGG.<br />
                    <span className="text-emerald-400">AUTO</span>
                </div>
                <p className="max-w-md text-lg text-white/60">Vehicle auction pricing and analysis.</p>
            </div>

            <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-[420px]">{children}</div>
            </div>
        </div>
    );
}
