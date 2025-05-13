// src/app/admin/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Save, Image as ImageIcon, Palette, FileText, Settings2, CalendarCog, Clock, UsersIcon, CalendarDays, Trash2, PlusCircle, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings, updateAppSettings } from '@/app/actions';
import type { AppSettings, SpecificDayRule } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parse } from 'date-fns';

const defaultInitialBrandName = 'AetherChat';

const initialSettingsState: Partial<AppSettings> = {
  brandName: defaultInitialBrandName,
  logoUrl: '',
  greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.',
  suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
  footerText: `© ${new Date().getFullYear()} ${defaultInitialBrandName}. Đã đăng ký Bản quyền.`,
  metaTitle: `${defaultInitialBrandName} - Live Chat Thông Minh`,
  metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
  metaKeywords: [],
  openGraphImageUrl: '',
  robotsTxtContent: "User-agent: *\nAllow: /",
  sitemapXmlContent: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>YOUR_DOMAIN_HERE</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n</urlset>`,
  numberOfStaff: 1,
  defaultServiceDurationMinutes: 60,
  workingHours: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
  weeklyOffDays: [],
  oneTimeOffDates: [],
  specificDayRules: [],
};

const daysOfWeek = [
  { id: 0, label: 'Chủ nhật' }, { id: 1, label: 'Thứ 2' }, { id: 2, label: 'Thứ 3' },
  { id: 3, label: 'Thứ 4' }, { id: 4, label: 'Thứ 5' }, { id: 5, label: 'Thứ 6' },
  { id: 6, label: 'Thứ 7' }
];

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<AppSettings>>(initialSettingsState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOneTimeOffDate, setNewOneTimeOffDate] = useState('');

  // State for new specific day rule
  const [newSpecificRuleDate, setNewSpecificRuleDate] = useState('');
  const [newSpecificRuleIsOff, setNewSpecificRuleIsOff] = useState(false);
  const [newSpecificRuleWorkingHours, setNewSpecificRuleWorkingHours] = useState('');
  const [newSpecificRuleStaff, setNewSpecificRuleStaff] = useState('');
  const [newSpecificRuleDuration, setNewSpecificRuleDuration] = useState('');


  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedSettings = await getAppSettings();
      if (fetchedSettings) {
        setSettings({
            ...initialSettingsState, // Start with defaults
            ...fetchedSettings, // Override with fetched values
            // Ensure arrays are always initialized
            suggestedQuestions: fetchedSettings.suggestedQuestions && fetchedSettings.suggestedQuestions.length > 0 ? fetchedSettings.suggestedQuestions : initialSettingsState.suggestedQuestions,
            metaKeywords: fetchedSettings.metaKeywords && fetchedSettings.metaKeywords.length > 0 ? fetchedSettings.metaKeywords : initialSettingsState.metaKeywords,
            workingHours: fetchedSettings.workingHours && fetchedSettings.workingHours.length > 0 ? fetchedSettings.workingHours : initialSettingsState.workingHours,
            weeklyOffDays: fetchedSettings.weeklyOffDays || [],
            oneTimeOffDates: fetchedSettings.oneTimeOffDates || [],
            specificDayRules: (fetchedSettings.specificDayRules || []).map(rule => ({...rule, id: rule.id || new Date().getTime().toString()})), // ensure ID
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
    const { name, value, type } = e.target;
    const isNumberField = type === 'number';
    setSettings(prev => ({ ...prev, [name]: isNumberField ? (value === '' ? undefined : Number(value)) : value }));
  };
  
  const handleSuggestedQuestionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSettings(prev => ({ ...prev, suggestedQuestions: e.target.value.split('\n').map(q => q.trim()).filter(Boolean) }));
  };

  const handleMetaKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, metaKeywords: e.target.value.split(',').map(kw => kw.trim()).filter(Boolean) }));
  };

  const handleWorkingHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, workingHours: e.target.value.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)) }));
  };
  
  const handleWeeklyOffDayChange = (dayId: number, checked: boolean) => {
    setSettings(prev => {
      const currentOffDays = prev.weeklyOffDays || [];
      if (checked) {
        return { ...prev, weeklyOffDays: [...currentOffDays, dayId] };
      } else {
        return { ...prev, weeklyOffDays: currentOffDays.filter(d => d !== dayId) };
      }
    });
  };

  const handleAddOneTimeOffDate = () => {
    if (newOneTimeOffDate && !settings.oneTimeOffDates?.includes(newOneTimeOffDate)) {
      try {
        // Validate date format "YYYY-MM-DD"
        parse(newOneTimeOffDate, 'yyyy-MM-dd', new Date());
        setSettings(prev => ({ ...prev, oneTimeOffDates: [...(prev.oneTimeOffDates || []), newOneTimeOffDate] }));
        setNewOneTimeOffDate('');
      } catch (error) {
        toast({title: "Lỗi định dạng ngày", description: "Vui lòng nhập ngày theo định dạng YYYY-MM-DD", variant: "destructive"});
      }
    }
  };

  const handleRemoveOneTimeOffDate = (dateToRemove: string) => {
    setSettings(prev => ({ ...prev, oneTimeOffDates: (prev.oneTimeOffDates || []).filter(d => d !== dateToRemove) }));
  };
  
  const handleSpecificRuleChange = (index: number, field: keyof SpecificDayRule, value: any) => {
    setSettings(prev => {
      const rules = [...(prev.specificDayRules || [])];
      rules[index] = { ...rules[index], [field]: value };
      return { ...prev, specificDayRules: rules };
    });
  };
  
  const handleAddSpecificRule = () => {
    if (!newSpecificRuleDate) {
        toast({title: "Thiếu thông tin", description: "Vui lòng chọn ngày cho quy tắc cụ thể.", variant: "destructive"});
        return;
    }
     try {
        parse(newSpecificRuleDate, 'yyyy-MM-dd', new Date()); // Validate date
    } catch (error) {
        toast({title: "Lỗi định dạng ngày", description: "Ngày quy tắc cụ thể không hợp lệ. Phải là YYYY-MM-DD", variant: "destructive"});
        return;
    }

    const rule: SpecificDayRule = {
      id: new Date().getTime().toString(), // Temporary unique ID for client-side
      date: newSpecificRuleDate,
      isOff: newSpecificRuleIsOff,
      workingHours: newSpecificRuleWorkingHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)).length > 0 ? newSpecificRuleWorkingHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)) : undefined,
      numberOfStaff: newSpecificRuleStaff !== '' ? Number(newSpecificRuleStaff) : undefined,
      serviceDurationMinutes: newSpecificRuleDuration !== '' ? Number(newSpecificRuleDuration) : undefined,
    };
    setSettings(prev => ({ ...prev, specificDayRules: [...(prev.specificDayRules || []), rule] }));
    // Reset new specific rule form
    setNewSpecificRuleDate('');
    setNewSpecificRuleIsOff(false);
    setNewSpecificRuleWorkingHours('');
    setNewSpecificRuleStaff('');
    setNewSpecificRuleDuration('');
  };

  const handleRemoveSpecificRule = (idToRemove: string) => {
    setSettings(prev => ({ ...prev, specificDayRules: (prev.specificDayRules || []).filter(rule => rule.id !== idToRemove)}));
  };


  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      const { id, updatedAt, ...settingsToSave } = settings;
      // Filter out specific rules with empty date, just in case
      const finalSettingsToSave = {
          ...settingsToSave,
          specificDayRules: (settingsToSave.specificDayRules || []).filter(rule => rule.date && rule.date.trim() !== '')
      };
      await updateAppSettings(finalSettingsToSave as Omit<AppSettings, 'id' | 'updatedAt'>);
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
          <CardTitle className="flex items-center"><CalendarCog className="mr-2 h-5 w-5 text-primary" /> Cài đặt Quy tắc Đặt lịch</CardTitle>
          <CardDescription>Thiết lập các quy tắc chung cho việc đặt lịch hẹn tự động.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="numberOfStaff"><UsersIcon className="inline mr-1 h-4 w-4" />Số lượng nhân viên có thể phục vụ cùng lúc</Label>
              <Input id="numberOfStaff" name="numberOfStaff" type="number" min="0" value={settings.numberOfStaff ?? ''} onChange={handleInputChange} disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultServiceDurationMinutes"><Clock className="inline mr-1 h-4 w-4" />Thời gian dịch vụ mặc định (phút)</Label>
              <Input id="defaultServiceDurationMinutes" name="defaultServiceDurationMinutes" type="number" min="5" value={settings.defaultServiceDurationMinutes ?? ''} onChange={handleInputChange} disabled={isSubmitting} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workingHours"><CalendarIcon className="inline mr-1 h-4 w-4" />Giờ nhận khách (HH:MM, cách nhau bằng dấu phẩy)</Label>
            <Input id="workingHours" name="workingHours" value={(settings.workingHours || []).join(', ')} onChange={handleWorkingHoursChange} placeholder="Ví dụ: 09:00, 10:00, 13:30, 14:30" disabled={isSubmitting} />
            <p className="text-xs text-muted-foreground">Các giờ bắt đầu của lịch hẹn. Ví dụ: 09:00,10:00,14:00,15:00</p>
          </div>
          
          <div className="space-y-2">
            <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ hàng tuần</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {daysOfWeek.map(day => (
                <div key={day.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`weeklyOffDay-${day.id}`}
                    checked={(settings.weeklyOffDays || []).includes(day.id)}
                    onCheckedChange={(checked) => handleWeeklyOffDayChange(day.id, !!checked)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor={`weeklyOffDay-${day.id}`} className="font-normal">{day.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ Lễ/Đặc biệt (một lần)</Label>
            <div className="flex gap-2 items-center">
              <Input 
                type="date" 
                value={newOneTimeOffDate} 
                onChange={e => setNewOneTimeOffDate(e.target.value)} 
                disabled={isSubmitting}
                className="max-w-xs"
              />
              <Button type="button" onClick={handleAddOneTimeOffDate} disabled={isSubmitting || !newOneTimeOffDate} size="sm">Thêm ngày nghỉ</Button>
            </div>
            <ul className="mt-2 space-y-1">
              {(settings.oneTimeOffDates || []).map(date => (
                <li key={date} className="flex items-center justify-between text-sm p-1 bg-muted/50 rounded">
                  {format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveOneTimeOffDate(date)} disabled={isSubmitting}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          
          <Separator />
           <div>
            <h4 className="text-md font-semibold mb-2">Quy tắc cho Ngày Cụ thể</h4>
            <p className="text-sm text-muted-foreground mb-3">Ghi đè các quy tắc chung cho một ngày nhất định. Để trống các trường nếu muốn dùng giá trị chung.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border rounded-md mb-4">
                <Input type="date" value={newSpecificRuleDate} onChange={e => setNewSpecificRuleDate(e.target.value)} placeholder="Ngày (YYYY-MM-DD)" className="h-9"/>
                <Input value={newSpecificRuleWorkingHours} onChange={e => setNewSpecificRuleWorkingHours(e.target.value)} placeholder="Giờ làm việc (HH:MM, HH:MM)" className="h-9"/>
                <Input type="number" value={newSpecificRuleStaff} onChange={e => setNewSpecificRuleStaff(e.target.value)} placeholder="Số nhân viên" className="h-9"/>
                <Input type="number" value={newSpecificRuleDuration} onChange={e => setNewSpecificRuleDuration(e.target.value)} placeholder="Thời gian DV (phút)" className="h-9"/>
                <div className="flex items-center space-x-2 col-span-full md:col-span-1">
                    <Checkbox id="newSpecificRuleIsOff" checked={newSpecificRuleIsOff} onCheckedChange={(checked) => setNewSpecificRuleIsOff(!!checked)} />
                    <Label htmlFor="newSpecificRuleIsOff">Ngày nghỉ</Label>
                </div>
                <Button onClick={handleAddSpecificRule} size="sm" className="col-span-full md:col-span-1 h-9"><PlusCircle className="mr-1 h-4 w-4"/>Thêm quy tắc ngày</Button>
            </div>

            {(settings.specificDayRules || []).length > 0 && (
              <div className="space-y-2">
                {(settings.specificDayRules || []).map((rule, index) => (
                  <Card key={rule.id || index} className="p-3 bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-sm">Ngày: {format(parse(rule.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</p>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveSpecificRule(rule.id!)} className="h-6 w-6">
                           <Trash2 className="h-3 w-3 text-destructive"/>
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <p>Ngày nghỉ: {rule.isOff ? <span className="text-red-500">Có</span> : 'Không'}</p>
                        <p>Giờ làm việc: {rule.workingHours?.join(', ') || <span className="italic">Như chung</span>}</p>
                        <p>Số nhân viên: {rule.numberOfStaff !== undefined ? rule.numberOfStaff : <span className="italic">Như chung</span>}</p>
                        <p>Thời gian DV: {rule.serviceDurationMinutes !== undefined ? `${rule.serviceDurationMinutes} phút` : <span className="italic">Như chung</span>}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </CardContent>
      </Card>

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

