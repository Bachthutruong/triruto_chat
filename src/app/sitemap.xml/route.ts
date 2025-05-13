// src/app/sitemap.xml/route.ts
import { getAppSettings } from '@/app/actions';
import { NextResponse } from 'next/server';

export async function GET() {
  const settings = await getAppSettings();
  // Ensure NEXT_PUBLIC_SITE_URL is set in your .env or .env.local file for production
  // Ensure it includes the protocol (http or https)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'; 
  
  const defaultSitemapContent = 
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/enter-phone</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/login</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${siteUrl}/register</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

  const content = settings?.sitemapXmlContent ? settings.sitemapXmlContent.replace(/YOUR_DOMAIN_HERE/g, siteUrl) : defaultSitemapContent;

  return new NextResponse(content, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
