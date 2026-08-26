import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { LiveShell } from "@/components/live-shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "AETHERA — Live Airspace Intelligence",
  description: "Real-time 3D airspace visualization of observed aircraft.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <LiveShell>{children}</LiveShell>
      </body>
    </html>
  );
}
