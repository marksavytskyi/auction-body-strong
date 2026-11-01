import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-[#020202] px-4 text-white">
            <div className="max-w-sm space-y-3 text-center">
                <h1 className="text-lg font-bold">Page not found</h1>
                <Link href="/" className="inline-block text-sm font-bold text-emerald-400 underline underline-offset-4">
                    Go to STRONGG
                </Link>
            </div>
        </div>
    );
}
