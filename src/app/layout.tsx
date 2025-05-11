import type {Metadata} from 'next';
import { Geist } from 'next/font/google'; // Corrected import for Geist Sans
import { GeistMono } from 'next/font/google'; // Corrected import for Geist Mono
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/react';


const geistSans = Geist({ // Geist Sans
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = GeistMono({ // Geist Mono
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AetherChat - Intelligent Live Chat',
  description: 'AI-powered live chat for seamless customer communication and appointment scheduling.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
