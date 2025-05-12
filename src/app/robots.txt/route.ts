// src/app/robots.txt/route.ts
import { getAppSettings } from '@/app/actions';
import { NextResponse } from 'next/server';

export async function GET() {
  const settings = await getAppSettings();
  const content = settings?.robotsTxtContent || 
`User-agent: *
Allow: /

Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/sitemap.xml
`;
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
