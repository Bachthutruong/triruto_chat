// src/app/admin/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Save, Image as ImageIcon, Palette, FileText, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings, updateAppSettings } from '@/app/actions';
import type { AppSettings } from '@/lib/types';

const defaultInitialBrandName = 'AetherChat';

const initialSettingsState: Partial<AppSettings> = {
  brandName: defaultInitialBrandName,
  logoUrl: '',
  greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.', // Customizable part
  suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
  footerText: `© ${new Date().getFullYear()} ${defaultInitialBrandName}. Đã đăng ký Bản quyền.`,
  metaTitle: `${defaultInitialBrandName} - Live Chat Thông Minh`,
  metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
  metaKeywords: [],
  openGraphImageUrl: '',
  robotsTxtContent: "User-agent: *\nAllow: /",
  sitemapXmlContent: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>YOUR_DOMAIN_HERE</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n</urlset>`,
};

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<AppSettings>>(initialSettingsState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedSettings = await getAppSettings();
      if (fetchedSettings) {
        // Merge fetched settings with initial defaults to ensure all form fields have a value
        setSettings({
            brandName: fetchedSettings.brandName || initialSettingsState.brandName,
            logoUrl: fetchedSettings.logoUrl || initialSettingsState.logoUrl,
            greetingMessage: fetchedSettings.greetingMessage || initialSettingsState.greetingMessage,
            suggestedQuestions: fetchedSettings.suggestedQuestions && fetchedSettings.suggestedQuestions.length > 0 ? fetchedSettings.suggestedQuestions : initialSettingsState.suggestedQuestions,
            footerText: fetchedSettings.footerText || initialSettingsState.footerText,
            metaTitle: fetchedSettings.metaTitle || initialSettingsState.metaTitle,
            metaDescription: fetchedSettings.metaDescription || initialSettingsState.metaDescription,
            metaKeywords: fetchedSettings.metaKeywords && fetchedSettings.metaKeywords.length > 0 ? fetchedSettings.metaKeywords : initialSettingsState.metaKeywords,
            openGraphImageUrl: fetchedSettings.openGraphImageUrl || initialSettingsState.openGraphImageUrl,
            robotsTxtContent: fetchedSettings.robotsTxtContent || initialSettingsState.robotsTxtContent,
            sitemapXmlContent: fetchedSettings.sitemapXmlContent || initialSettingsState.sitemapXmlContent,
        });
      } else {
        setSettings(initialSettingsState); 
      }
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải cài đặt ứng dụng.", variant: "destructive" });
      setSettings(initialSettingsState);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSuggestedQuestionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSettings(prev => ({ ...prev, suggestedQuestions: e.target.value.split('\n').map(q => q.trim()).filter(Boolean) }));
  };

  const handleMetaKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, metaKeywords: e.target.value.split(',').map(kw => kw.trim()).filter(Boolean) }));
  };

  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      const { id, updatedAt, ...settingsToSave } = settings;
      await updateAppSettings(settingsToSave as Omit<AppSettings, 'id' | 'updatedAt'>); // Type assertion
      toast({ title: "Thành công", description: "Cài đặt đã được lưu." });
      fetchSettings(); 
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể lưu cài đặt.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p>Đang tải cài đặt...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cài đặt Ứng dụng</h1>
      <p className="text-muted-foreground">Cấu hình giao diện, SEO, và các cài đặt hệ thống khác.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Cài đặt Giao diện & Chào hỏi</CardTitle>
          <CardDescription>Tùy chỉnh giao diện và cảm nhận của ứng dụng, lời chào và câu hỏi gợi ý.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Tên Thương hiệu</Label>
            <Input id="brandName" name="brandName" value={settings.brandName || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">URL Logo</Label>
            <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://example.com/logo.png" value={settings.logoUrl || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="footerText">Chữ Chân trang</Label>
            <Input id="footerText" name="footerText" value={settings.footerText || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="greetingMessage">Lời chào tùy chỉnh (Phần sau "Chào mừng đến [Tên Thương Hiệu]!")</Label>
            <Textarea id="greetingMessage" name="greetingMessage" value={settings.greetingMessage || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="Ví dụ: Tôi là trợ lý AI của bạn..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggestedQuestions">Câu hỏi gợi ý (Mỗi câu một dòng)</Label>
            <Textarea id="suggestedQuestions" name="suggestedQuestions" value={(settings.suggestedQuestions || []).join('\n')} onChange={handleSuggestedQuestionsChange} disabled={isSubmitting} placeholder="Dịch vụ của bạn là gì?\nĐặt lịch hẹn"/>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" /> Cài đặt SEO</CardTitle>
          <CardDescription>Tối ưu hóa ứng dụng của bạn cho các công cụ tìm kiếm.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Tiêu đề Meta</Label>
            <Input id="metaTitle" name="metaTitle" value={settings.metaTitle || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Mô tả Meta</Label>
            <Textarea id="metaDescription" name="metaDescription" value={settings.metaDescription || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaKeywords">Từ khóa Meta (cách nhau bằng dấu phẩy)</Label>
            <Input id="metaKeywords" name="metaKeywords" value={(settings.metaKeywords || []).join(', ')} onChange={handleMetaKeywordsChange} disabled={isSubmitting} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="openGraphImageUrl">URL Hình ảnh OpenGraph</Label>
            <Input id="openGraphImageUrl" name="openGraphImageUrl" type="url" placeholder="https://example.com/og-image.png" value={settings.openGraphImageUrl || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="robotsTxtContent">Nội dung robots.txt</Label>
            <Textarea id="robotsTxtContent" name="robotsTxtContent" rows={5} value={settings.robotsTxtContent || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="sitemapXmlContent">Nội dung sitemap.xml (cơ bản)</Label>
            <Textarea id="sitemapXmlContent" name="sitemapXmlContent" rows={5} value={settings.sitemapXmlContent || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
        </CardContent>
      </Card>
      
      <Separator />

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary" /> Cấu hình Khác</CardTitle>
          <CardDescription>Các cấu hình hệ thống chung (hiện tại chưa có).</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Chưa có cấu hình chung khác.</p>
        </CardContent>
      </Card>

      <div className="py-6 flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isSubmitting || isLoading}>
            <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Đang lưu...' : 'Lưu Tất cả Cài đặt'}
        </Button>
      </div>
    </div>
  );
}
