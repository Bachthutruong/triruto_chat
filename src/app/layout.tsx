
import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/react';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { SocketProvider } from '@/contexts/SocketContext'; // Import SocketProvider
import { getAppSettings } from './actions';

const interFont = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

const robotoMonoFont = Roboto_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  return {
    title: settings?.metaTitle || 'Triruto',
    description: settings?.metaDescription || 'Live chat tích hợp AI cho giao tiếp khách hàng và đặt lịch hẹn liền mạch.',
    keywords: settings?.metaKeywords || ['live chat', 'AI', 'chatbot', 'customer support', 'vietnamese'],
    openGraph: settings?.openGraphImageUrl ? {
      images: [settings.openGraphImageUrl],
      title: settings?.metaTitle || 'Triruto',
      description: settings?.metaDescription || 'Live chat tích hợp AI cho giao tiếp khách hàng và đặt lịch hẹn liền mạch.',
    } : {
      title: settings?.metaTitle || 'Triruto',
      description: settings?.metaDescription || 'Live chat tích hợp AI cho giao tiếp khách hàng và đặt lịch hẹn liền mạch.',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appSettings = await getAppSettings();

  return (
    <html lang="vi">
      <body className={`${interFont.variable} ${robotoMonoFont.variable} font-sans antialiased`}>
        <SocketProvider> {/* SocketProvider should wrap AppSettingsProvider and children */}
          <AppSettingsProvider settings={appSettings}>
            {children}
          </AppSettingsProvider>
        </SocketProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
