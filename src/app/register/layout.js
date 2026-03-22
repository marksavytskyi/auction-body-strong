export default function AuthLayout({ children }) {
    return (
        <div className="w-screen h-screen flex bg-background text-foreground overflow-hidden">
            <div className="hidden lg:flex basis-1/2 relative h-full flex-col items-center justify-center text-center bg-[#020202] border-r border-white/5 overflow-hidden">
                {/* Background Pattern/Grid */}
                <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
                
                {/* Modern Abstract Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-20%] w-[100%] h-[100%] bg-emerald-500/10 blur-[180px] rounded-full animate-pulse transition-all duration-1000"></div>
                    <div className="absolute bottom-[-20%] right-[-20%] w-[90%] h-[90%] bg-blue-500/10 blur-[180px] rounded-full animate-pulse transition-all duration-1000" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute top-[20%] right-[10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[150px] rounded-full animate-pulse transition-all duration-1000" style={{ animationDelay: '1.5s' }}></div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-12 space-y-12">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass-card border-white/10 accent-glow-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981] animate-pulse"></div>
                        <span className="text-xs font-bold text-white uppercase tracking-[0.25em]">v2.0 Advanced Engine</span>
                    </div>
                    
                    <div className="space-y-4">
                        <h1 className="text-7xl font-black tracking-tighter italic">
                            STRONGG.<br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-emerald-600">AUTO</span>
                        </h1>
                        <div className="h-1.5 w-24 bg-emerald-500 mx-auto rounded-full"></div>
                    </div>

                    <p className="text-lg text-white/60 font-medium max-w-md mx-auto leading-relaxed">
                        Redefining vehicle auction intelligence with <span className="text-white">real-time</span> pricing analytics and predictive modeling.
                    </p>
                </div>

                {/* Bottom Footer Info */}
                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/20">
                    <span>Precision. Data. Speed.</span>
                    <span>© 2026 STRONGG INDUSTRIES</span>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-hidden">
                {/* Small glow for the form area */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>
                
                <div className="w-full max-w-[420px] z-10">
                    {children}
                </div>
            </div>
        </div>
    )
}