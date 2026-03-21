import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {ThemeProvider} from "@/components/theme-provider";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "STRONGG. AUTO",
  description: "Advanced Vehicle Auction Intelligence & Pricing Analysis",
};


import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }) {
    return (
        <>
            <html lang="en" suppressHydrationWarning>
            <head />
            <body>
            <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                disableTransitionOnChange
            >
                {children}
                <Toaster 
                    position="top-right" 
                    toastOptions={{
                        className: 'rounded-xl bg-zinc-900 text-white border border-white/10 text-sm font-medium',
                        duration: 4000,
                    }}
                />
            </ThemeProvider>
            </body>
            </html>
        </>
    )
}
