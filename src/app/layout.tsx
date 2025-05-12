
import type {Metadata} from 'next';
import { Inter, Roboto_Mono } from 'next/font/google'; 
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/react';


const interFont = Inter({ 
  variable: '--font-geist-sans', 
  subsets: ['latin', 'vietnamese'], // Added vietnamese subset
  display: 'swap',
});

const robotoMonoFont = Roboto_Mono({ 
  variable: '--font-geist-mono', 
  subsets: ['latin', 'vietnamese'], // Added vietnamese subset
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AetherChat - Live Chat Thông Minh',
  description: 'Live chat tích hợp AI cho giao tiếp khách hàng và đặt lịch hẹn liền mạch.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi"> {/* Changed lang to vi */}
      <body className={`${interFont.variable} ${robotoMonoFont.variable} font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

