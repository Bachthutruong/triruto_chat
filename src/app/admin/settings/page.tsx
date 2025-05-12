'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Save, Image as ImageIcon, Palette, FileText, Settings2 } from 'lucide-react';

export default function AdminSettingsPage() {
  // Dữ liệu mẫu - trong ứng dụng thực tế, dữ liệu này sẽ từ DB
  const [settings, setSettings] = useState({
    brandName: 'AetherChat',
    logoUrl: '',
    footerText: '© 2024 AetherChat. Đã đăng ký Bản quyền.',
    metaTitle: 'AetherChat - Live Chat Thông Minh',
    metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = () => {
    console.log('Đang lưu cài đặt:', settings);
    // Thêm thông báo toast cho thành công/thất bại
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cài đặt Ứng dụng</h1>
      <p className="text-muted-foreground">Cấu hình giao diện, SEO, và các cài đặt hệ thống khác.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Cài đặt Giao diện</CardTitle>
          <CardDescription>Tùy chỉnh giao diện và cảm nhận của ứng dụng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Tên Thương hiệu</Label>
            <Input id="brandName" name="brandName" value={settings.brandName} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">URL Logo</Label>
            <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://example.com/logo.png" value={settings.logoUrl} onChange={handleInputChange} />
            {/* Cân nhắc thêm thành phần tải lên file cho logo ở đây */}
          </div>
           <div className="space-y-2">
            <Label htmlFor="footerText">Chữ Chân trang</Label>
            <Input id="footerText" name="footerText" value={settings.footerText} onChange={handleInputChange} />
          </div>
          <Button onClick={handleSaveSettings}><Save className="mr-2 h-4 w-4" /> Lưu Cài đặt Giao diện</Button>
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
            <Input id="metaTitle" name="metaTitle" value={settings.metaTitle} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Mô tả Meta</Label>
            <Input id="metaDescription" name="metaDescription" value={settings.metaDescription} onChange={handleInputChange} />
          </div>
          {/* Thêm các trường cho từ khóa, OpenGraph, robots.txt, sitemap nếu cần */}
          <Button onClick={handleSaveSettings}><Save className="mr-2 h-4 w-4" /> Lưu Cài đặt SEO</Button>
        </CardContent>
      </Card>
      
      <Separator />

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary" /> Cấu hình Khác</CardTitle>
          <CardDescription>Các cấu hình hệ thống chung.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Placeholder cho các cài đặt chung khác (ví dụ: khóa API, tích hợp).</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper hook for state or import if defined elsewhere
function useState<T>(initialState: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = React.useState(initialState);
    return [state, setState];
}
import React from 'react'; // Ensure React is imported for useState

