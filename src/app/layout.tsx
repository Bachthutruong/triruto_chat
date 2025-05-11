
import type {Metadata} from 'next';
import { Inter, Roboto_Mono } from 'next/font/google'; // Changed from Geist and GeistMono
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/react';


const interFont = Inter({ // Use Inter as a replacement for Geist Sans
  variable: '--font-geist-sans', // Keep original CSS variable name for compatibility
  subsets: ['latin'],
  display: 'swap',
});

const robotoMonoFont = Roboto_Mono({ // Use Roboto_Mono as a replacement for Geist Mono
  variable: '--font-geist-mono', // Keep original CSS variable name for compatibility
  subsets: ['latin'],
  display: 'swap',
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
      <body className={`${interFont.variable} ${robotoMonoFont.variable} font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
