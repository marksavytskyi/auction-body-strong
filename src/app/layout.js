import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "STRONGG. AUTO",
  description: "Advanced Vehicle Auction Intelligence & Pricing Analysis",
};

export const viewport = {
  themeColor: "#020202",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className="dark">
            <body>
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        className: 'rounded-xl bg-zinc-900 text-white border border-white/10 text-sm font-medium',
                        duration: 4000,
                    }}
                />
            </body>
        </html>
    )
}
