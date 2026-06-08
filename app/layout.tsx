import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "English Lab",
  description: "Practice English with voice recording, screen recording, and teleprompter tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-base font-bold tracking-tight text-white">
              Engvidilearning
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/voice" className="text-zinc-400 hover:text-white transition-colors">
                Voice
              </Link>
              <Link href="/camera" className="text-zinc-400 hover:text-white transition-colors">
                Camera
              </Link>
              <Link href="/screen" className="text-zinc-400 hover:text-white transition-colors">
                Screen
              </Link>
              <Link href="/teleprompter" className="text-zinc-400 hover:text-white transition-colors">
                Teleprompter
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
