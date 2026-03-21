export default function AuthLayout({ children }) {
    return (
        <div className="w-screen h-screen flex bg-background text-foreground overflow-hidden">
            <div className="hidden lg:flex basis-3/5 relative h-full flex-col items-center justify-center text-center bg-[#0a0a0a] border-r border-white/5">
                {/* Modern Abstract Background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
                    <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-500/10 blur-[120px] rounded-full"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-12">
                    <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">v2.0 Intelligence</span>
                    </div>
                    <h1 className="text-6xl font-black mb-6 tracking-tighter italic">
                        STRONGG. <span className="text-emerald-500">AUTO</span>
                    </h1>
                    <p className="text-xl text-white/50 font-medium max-w-md mx-auto leading-relaxed">
                        Advanced vehicle auction intelligence and real-time pricing analytics.
                    </p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
                <div className="w-full max-w-[440px] z-10">
                    {children}
                </div>
            </div>
        </div>
    )
}