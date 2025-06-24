// src/app/admin/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Save, Image as ImageIconLucide, Palette, FileText, Settings2, CalendarCog, Clock, UsersIcon, CalendarDays, Trash2, PlusCircle, UploadCloud, XCircle, Briefcase, MessagesSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings, updateAppSettings } from '@/app/actions';
import type { AppSettings, SpecificDayRule, BreakTime } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parse, isValid as isValidDateFns } from 'date-fns';
import NextImage from 'next/image';
import { NotificationSettings } from '@/components/NotificationSettings';
import { NotificationDebug } from '@/components/NotificationDebug';

const defaultInitialBrandName = 'Live Chat';
const MAX_LOGO_SIZE_MB = 1;
const MAX_LOGO_SIZE_BYTES = MAX_LOGO_SIZE_MB * 1024 * 1024;

//@ts-ignore
const initialSettingsState: AppSettings = {
  id: '',
  brandName: defaultInitialBrandName,
  logoUrl: '',
  logoDataUri: '',
  greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.',
  greetingMessageNewCustomer: 'Chào mừng bạn lần đầu đến với chúng tôi! Bạn cần hỗ trợ gì ạ?',
  greetingMessageReturningCustomer: 'Chào mừng bạn quay trở lại! Rất vui được gặp lại bạn.',
  suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
  successfulBookingMessageTemplate: "Lịch hẹn của bạn cho {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được đặt thành công!",
  cancelledAppointmentMessageTemplate: "Lịch hẹn {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được hủy thành công.",
  rescheduledAppointmentMessageTemplate: "Lịch hẹn {{service}} đã được đổi thành {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}}.",
  footerText: `© ${new Date().getFullYear()} ${defaultInitialBrandName}. Đã đăng ký Bản quyền.`,
  metaTitle: `Triruto - Trợ lý AI cho giao tiếp khách hàng liền mạch.`,
  metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
  metaKeywords: [],
  openGraphImageUrl: '',
  robotsTxtContent: "User-agent: *\nAllow: /",
  sitemapXmlContent: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>YOUR_DOMAIN_HERE</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n</urlset>`,
  numberOfStaff: 1,
  defaultServiceDurationMinutes: 60,
  workingHours: [],
  breakTimes: [],
  breakTimeNotificationEnabled: false,
  breakTimeNotificationMessage: 'Hiện tại chúng tôi đang trong giờ nghỉ {{breakName}} từ {{startTime}} đến {{endTime}}. Vui lòng liên hệ lại sau hoặc để lại lời nhắn.',
  weeklyOffDays: [],
  oneTimeOffDates: [],
  specificDayRules: [],
  outOfOfficeResponseEnabled: false,
  outOfOfficeMessage: 'Cảm ơn bạn đã liên hệ! Hiện tại chúng tôi đang ngoài giờ làm việc. Vui lòng để lại lời nhắn và chúng tôi sẽ phản hồi sớm nhất có thể.',
  officeHoursStart: "09:00",
  officeHoursEnd: "17:00",
  officeDays: [1, 2, 3, 4, 5],
};

const daysOfWeek = [
  { id: 1, label: 'Thứ 2' }, { id: 2, label: 'Thứ 3' }, { id: 3, label: 'Thứ 4' },
  { id: 4, label: 'Thứ 5' }, { id: 5, label: 'Thứ 6' }, { id: 6, label: 'Thứ 7' },
  { id: 0, label: 'Chủ nhật' }
];

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(initialSettingsState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOneTimeOffDate, setNewOneTimeOffDate] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [newSpecificRuleDate, setNewSpecificRuleDate] = useState('');
  const [newSpecificRuleIsOff, setNewSpecificRuleIsOff] = useState(false);
  const [newSpecificRuleWorkingHours, setNewSpecificRuleWorkingHours] = useState('');
  const [newSpecificRuleStaff, setNewSpecificRuleStaff] = useState('');
  const [newSpecificRuleDuration, setNewSpecificRuleDuration] = useState('');

  // Break time states
  const [newBreakTimeStartTime, setNewBreakTimeStartTime] = useState('');
  const [newBreakTimeEndTime, setNewBreakTimeEndTime] = useState('');
  const [newBreakTimeName, setNewBreakTimeName] = useState('');

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedSettings = await getAppSettings();
      console.log('Fetched settings from server:', fetchedSettings);
      console.log('Fetched specificDayRules:', fetchedSettings?.specificDayRules);
      
      if (fetchedSettings) {
        const mergedSettings: AppSettings = {
          ...initialSettingsState,
          ...fetchedSettings,
          suggestedQuestions: fetchedSettings.suggestedQuestions && fetchedSettings.suggestedQuestions.length > 0 ? fetchedSettings.suggestedQuestions : initialSettingsState.suggestedQuestions || [],
          successfulBookingMessageTemplate: fetchedSettings.successfulBookingMessageTemplate || initialSettingsState.successfulBookingMessageTemplate,
          cancelledAppointmentMessageTemplate: fetchedSettings.cancelledAppointmentMessageTemplate || initialSettingsState.cancelledAppointmentMessageTemplate,
          rescheduledAppointmentMessageTemplate: fetchedSettings.rescheduledAppointmentMessageTemplate || initialSettingsState.rescheduledAppointmentMessageTemplate,
          metaKeywords: fetchedSettings.metaKeywords && fetchedSettings.metaKeywords.length > 0 ? fetchedSettings.metaKeywords : initialSettingsState.metaKeywords || [],
          workingHours: fetchedSettings.workingHours && fetchedSettings.workingHours.length > 0 ? fetchedSettings.workingHours : initialSettingsState.workingHours || [],
          breakTimes: (fetchedSettings.breakTimes || []).map(bt => ({ ...bt, id: bt.id || new Date().getTime().toString() + Math.random() })),
          breakTimeNotificationEnabled: fetchedSettings.breakTimeNotificationEnabled ?? initialSettingsState.breakTimeNotificationEnabled,
          breakTimeNotificationMessage: fetchedSettings.breakTimeNotificationMessage || initialSettingsState.breakTimeNotificationMessage,
          weeklyOffDays: fetchedSettings.weeklyOffDays || initialSettingsState.weeklyOffDays || [],
          oneTimeOffDates: fetchedSettings.oneTimeOffDates || initialSettingsState.oneTimeOffDates || [],
          specificDayRules: (fetchedSettings.specificDayRules || initialSettingsState.specificDayRules || []).map(rule => ({ ...rule, id: rule.id || new Date().getTime().toString() + Math.random() })),
          officeDays: fetchedSettings.officeDays && fetchedSettings.officeDays.length > 0 ? fetchedSettings.officeDays : initialSettingsState.officeDays || [],
        };
        
        console.log('Merged specificDayRules:', mergedSettings.specificDayRules);
        setSettings(mergedSettings);

        if (mergedSettings.logoDataUri) {
          setLogoPreview(mergedSettings.logoDataUri);
        } else if (mergedSettings.logoUrl) {
          setLogoPreview(mergedSettings.logoUrl);
        } else {
          setLogoPreview(null);
        }
      } else {
        setSettings(initialSettingsState);
        setLogoPreview(null);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({ title: "Lỗi", description: "Không thể tải cài đặt ứng dụng.", variant: "destructive" });
      setSettings(initialSettingsState);
      setLogoPreview(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Debug logging
  useEffect(() => {
    console.log('Current settings.specificDayRules:', settings.specificDayRules);
  }, [settings.specificDayRules]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSettings(prev => {
      let processedValue: any = value;
      if (type === 'number') {
        const parsedNum = parseFloat(value);
        processedValue = isNaN(parsedNum) ? undefined : parsedNum;
      }
      return { ...prev, [name]: processedValue };
    });
  };

  const handleCheckboxChange = (name: keyof AppSettings, checked: boolean | 'indeterminate') => {
    setSettings(prev => ({ ...prev, [name]: checked === true }));
  };

  const handleSuggestedQuestionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSettings(prev => ({ ...prev, suggestedQuestions: e.target.value.split('\n').map(q => q.trim()).filter(Boolean) }));
  };

  const handleMetaKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, metaKeywords: e.target.value.split(',').map(kw => kw.trim()).filter(Boolean) }));
  };

  const handleWorkingHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow any input but validate when saving
    setSettings(prev => ({
      ...prev,
      workingHours: value.split(',').map(h => h.trim())
    }));
  };

  // Add a new function to validate working hours before saving
  const validateWorkingHours = (hours: string[]): string[] => {
    return hours.filter(h => {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      return timeRegex.test(h);
    });
  };

  const handleWeeklyOffDayChange = (dayId: number, checked: boolean | 'indeterminate') => {
    setSettings(prev => {
      const currentOffDays = prev.weeklyOffDays || [];
      if (checked === true) {
        return { ...prev, weeklyOffDays: [...currentOffDays, dayId].filter((v, i, a) => a.indexOf(v) === i) };
      } else {
        return { ...prev, weeklyOffDays: currentOffDays.filter(d => d !== dayId) };
      }
    });
  };

  const handleOfficeDayChange = (dayId: number, checked: boolean | 'indeterminate') => {
    setSettings(prev => {
      const currentOfficeDays = prev.officeDays || [];
      if (checked === true) {
        return { ...prev, officeDays: [...currentOfficeDays, dayId].filter((v, i, a) => a.indexOf(v) === i) };
      } else {
        return { ...prev, officeDays: currentOfficeDays.filter(d => d !== dayId) };
      }
    });
  };

  const handleAddOneTimeOffDate = () => {
    if (newOneTimeOffDate && !settings.oneTimeOffDates?.includes(newOneTimeOffDate)) {
      if (!isValidDateFns(parse(newOneTimeOffDate, 'yyyy-MM-dd', new Date()))) {
        toast({ title: "Lỗi định dạng ngày", description: "Vui lòng nhập ngày hợp lệ theo định dạng YYYY-MM-DD", variant: "destructive" });
        return;
      }
      setSettings(prev => ({ ...prev, oneTimeOffDates: [...(prev.oneTimeOffDates || []), newOneTimeOffDate] }));
      setNewOneTimeOffDate('');
    }
  };

  const handleRemoveOneTimeOffDate = (dateToRemove: string) => {
    setSettings(prev => ({ ...prev, oneTimeOffDates: (prev.oneTimeOffDates || []).filter(d => d !== dateToRemove) }));
  };

  const handleAddSpecificRule = () => {
    if (!newSpecificRuleDate) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng chọn ngày cho quy tắc cụ thể.", variant: "destructive" });
      return;
    }
    if (!isValidDateFns(parse(newSpecificRuleDate, 'yyyy-MM-dd', new Date()))) {
      toast({ title: "Lỗi định dạng ngày", description: "Ngày quy tắc cụ thể không hợp lệ. Phải là YYYY-MM-DD", variant: "destructive" });
      return;
    }

    // Parse and validate working hours
    let validatedWorkingHours: string[] | undefined = undefined;
    if (newSpecificRuleWorkingHours.trim() !== '') {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const hourList = newSpecificRuleWorkingHours.split(',').map(h => h.trim()).filter(Boolean);
      const validHours = hourList.filter(h => timeRegex.test(h));
      
      if (validHours.length > 0) {
        validatedWorkingHours = validHours;
      } else if (hourList.length > 0) {
        toast({ title: "Lỗi giờ làm việc", description: "Một hoặc nhiều giờ không hợp lệ. Vui lòng nhập theo định dạng HH:MM (ví dụ: 09:00, 10:00)", variant: "destructive" });
        return;
      }
    }

    // Parse staff number
    let parsedStaff: number | undefined = undefined;
    if (newSpecificRuleStaff.trim() !== '') {
      const staffNum = parseFloat(newSpecificRuleStaff);
      if (isNaN(staffNum) || staffNum < 0) {
        toast({ title: "Lỗi số nhân viên", description: "Số nhân viên phải là số dương.", variant: "destructive" });
        return;
      }
      parsedStaff = staffNum;
    }

    // Parse duration
    let parsedDuration: number | undefined = undefined;
    if (newSpecificRuleDuration.trim() !== '') {
      const durationNum = parseFloat(newSpecificRuleDuration);
      if (isNaN(durationNum) || durationNum < 5) {
        toast({ title: "Lỗi thời gian dịch vụ", description: "Thời gian dịch vụ phải ít nhất 5 phút.", variant: "destructive" });
        return;
      }
      parsedDuration = durationNum;
    }

    const rule: SpecificDayRule = {
      id: new Date().getTime().toString() + Math.random(),
      date: newSpecificRuleDate,
      isOff: newSpecificRuleIsOff,
      workingHours: validatedWorkingHours,
      numberOfStaff: parsedStaff,
      serviceDurationMinutes: parsedDuration,
    };
    
    setSettings(prev => ({ 
      ...prev, 
      specificDayRules: [...(prev.specificDayRules || []), rule] 
    }));
    
    // Reset form
    setNewSpecificRuleDate('');
    setNewSpecificRuleIsOff(false);
    setNewSpecificRuleWorkingHours('');
    setNewSpecificRuleStaff('');
    setNewSpecificRuleDuration('');
    
    // Show success message
    toast({ title: "Thành công", description: "Đã thêm quy tắc ngày cụ thể." });
  };

  const handleRemoveSpecificRule = (idToRemove: string) => {
    setSettings(prev => ({ ...prev, specificDayRules: (prev.specificDayRules || []).filter(rule => rule.id !== idToRemove) }));
  };

  // Break time handlers
  const handleAddBreakTime = () => {
    if (!newBreakTimeStartTime || !newBreakTimeEndTime) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc.", variant: "destructive" });
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newBreakTimeStartTime) || !timeRegex.test(newBreakTimeEndTime)) {
      toast({ title: "Lỗi định dạng", description: "Vui lòng nhập theo định dạng HH:MM (ví dụ: 12:00, 13:30)", variant: "destructive" });
      return;
    }

    // Check if start time is before end time
    const startMinutes = parseInt(newBreakTimeStartTime.split(':')[0]) * 60 + parseInt(newBreakTimeStartTime.split(':')[1]);
    const endMinutes = parseInt(newBreakTimeEndTime.split(':')[0]) * 60 + parseInt(newBreakTimeEndTime.split(':')[1]);

    if (startMinutes >= endMinutes) {
      toast({ title: "Lỗi thời gian", description: "Giờ bắt đầu phải trước giờ kết thúc.", variant: "destructive" });
      return;
    }

    // Check for overlapping break times
    const existingBreakTimes = settings.breakTimes || [];
    const hasOverlap = existingBreakTimes.some(breakTime => {
      const existingStartMinutes = parseInt(breakTime.startTime.split(':')[0]) * 60 + parseInt(breakTime.startTime.split(':')[1]);
      const existingEndMinutes = parseInt(breakTime.endTime.split(':')[0]) * 60 + parseInt(breakTime.endTime.split(':')[1]);
      
      return (startMinutes < existingEndMinutes && endMinutes > existingStartMinutes);
    });

    if (hasOverlap) {
      toast({ title: "Trùng lặp thời gian", description: "Thời gian nghỉ bị trùng với thời gian nghỉ khác.", variant: "destructive" });
      return;
    }

    const newBreakTime: BreakTime = {
      id: new Date().getTime().toString() + Math.random(),
      startTime: newBreakTimeStartTime,
      endTime: newBreakTimeEndTime,
      name: newBreakTimeName.trim() || undefined,
    };

    setSettings(prev => ({ 
      ...prev, 
      breakTimes: [...(prev.breakTimes || []), newBreakTime] 
    }));

    // Reset form
    setNewBreakTimeStartTime('');
    setNewBreakTimeEndTime('');
    setNewBreakTimeName('');

    toast({ title: "Thành công", description: "Đã thêm thời gian nghỉ." });
  };

  const handleRemoveBreakTime = (idToRemove: string) => {
    setSettings(prev => ({ ...prev, breakTimes: (prev.breakTimes || []).filter(breakTime => breakTime.id !== idToRemove) }));
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Lỗi", description: "Chỉ chấp nhận tệp hình ảnh.", variant: "destructive" });
        if (logoInputRef.current) logoInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        toast({ title: "Lỗi", description: `Kích thước logo không được vượt quá ${MAX_LOGO_SIZE_MB}MB.`, variant: "destructive" });
        if (logoInputRef.current) logoInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setSettings(prev => ({ ...prev, logoDataUri: dataUri, logoUrl: '' }));
        setLogoPreview(dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, logoDataUri: undefined, logoUrl: '' }));
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      const settingsToSave: Partial<Omit<AppSettings, 'id' | 'updatedAt'>> = {
        ...settings,
        brandName: settings.brandName || defaultInitialBrandName,
        suggestedQuestions: settings.suggestedQuestions || [],
        metaKeywords: settings.metaKeywords || [],
        workingHours: validateWorkingHours(settings.workingHours || []),
        breakTimes: (settings.breakTimes || []).map(breakTime => {
          const { id: breakTimeId, ...restOfBreakTime } = breakTime;
          return restOfBreakTime;
        }),
        breakTimeNotificationEnabled: settings.breakTimeNotificationEnabled,
        breakTimeNotificationMessage: settings.breakTimeNotificationMessage,
        weeklyOffDays: settings.weeklyOffDays || [],
        oneTimeOffDates: settings.oneTimeOffDates || [],
        specificDayRules: (settings.specificDayRules || []).map(rule => {
          const { id: ruleId, ...restOfRule } = rule;
          return restOfRule;
        }),
        officeDays: settings.officeDays || [],
      };

      // Ensure number fields are numbers or undefined, not NaN
      const numFields: (keyof AppSettings)[] = ['numberOfStaff', 'defaultServiceDurationMinutes'];
      numFields.forEach(field => {
        //@ts-ignore
        if (settingsToSave[field] !== undefined) {
          //@ts-ignore
          const parsed = parseFloat(settingsToSave[field] as any);
          //@ts-ignore
          settingsToSave[field] = isNaN(parsed) ? undefined : parsed as any;
        }
      });

      if (settingsToSave.specificDayRules) {
        settingsToSave.specificDayRules = settingsToSave.specificDayRules.map(rule => {
          const newRule = { ...rule };
          if (newRule.numberOfStaff !== undefined) {
            const parsed = parseFloat(newRule.numberOfStaff as any);
            newRule.numberOfStaff = isNaN(parsed) ? undefined : parsed;
          }
          if (newRule.serviceDurationMinutes !== undefined) {
            const parsed = parseFloat(newRule.serviceDurationMinutes as any);
            newRule.serviceDurationMinutes = isNaN(parsed) ? undefined : parsed;
          }
          return newRule;
        });
      }

      // Log for debugging
      console.log('Saving specificDayRules:', settingsToSave.specificDayRules);

      // Only delete arrays that are explicitly empty, not arrays with data
      if (settingsToSave.weeklyOffDays?.length === 0) delete settingsToSave.weeklyOffDays;
      if (settingsToSave.oneTimeOffDates?.length === 0) delete settingsToSave.oneTimeOffDates;
      if (settingsToSave.officeDays?.length === 0) delete settingsToSave.officeDays;
      if (settingsToSave.suggestedQuestions?.length === 0) delete settingsToSave.suggestedQuestions;
      if (settingsToSave.metaKeywords?.length === 0) delete settingsToSave.metaKeywords;
      if (settingsToSave.workingHours?.length === 0) delete settingsToSave.workingHours;
      if (settingsToSave.breakTimes?.length === 0) delete settingsToSave.breakTimes;
      // Do NOT delete specificDayRules - let it save as empty array if needed
      // if (settingsToSave.specificDayRules?.length === 0) delete settingsToSave.specificDayRules;

      await updateAppSettings(settingsToSave);
      toast({ title: "Thành công", description: "Cài đặt đã được lưu." });
      
      // Re-fetch settings to ensure UI is in sync
      await fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({ title: "Lỗi", description: error.message || "Không thể lưu cài đặt.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoading) {
    return <p>Đang tải cài đặt...</p>;
  }

  return (
    <div className="space-y-6 md:w-[1200px]">
      <h1 className="text-3xl font-bold">Cài đặt Ứng dụng</h1>
      <p className="text-muted-foreground">Cấu hình giao diện, SEO, và các cài đặt hệ thống khác.</p>

      {/* General and Branding Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Giao diện & Thương hiệu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Tên Thương hiệu</Label>
            <Input id="brandName" name="brandName" value={settings.brandName || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUpload">Logo Thương hiệu</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative w-20 h-20 border rounded-md overflow-hidden bg-muted">
                  <NextImage src={logoPreview} alt="Xem trước logo" layout="fill" objectFit="contain" data-ai-hint="logo preview" />
                </div>
              )}
              <div className="flex-grow space-y-2">
                <Input
                  id="logoUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  ref={logoInputRef}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">Tải lên logo (khuyên dùng .png, .svg, tối đa {MAX_LOGO_SIZE_MB}MB).</p>
              </div>
              {logoPreview && (
                <Button variant="ghost" size="icon" onClick={handleRemoveLogo} disabled={isSubmitting} title="Xóa logo đã tải lên">
                  <XCircle className="h-5 w-5 text-destructive" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Hoặc URL Logo bên ngoài</Label>
            <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://example.com/logo.png" value={settings.logoUrl || ''} onChange={(e) => { handleInputChange(e); if (e.target.value) { setLogoPreview(e.target.value); setSettings(prev => ({ ...prev, logoDataUri: undefined })); } }} disabled={isSubmitting} />
            <p className="text-xs text-muted-foreground">Nếu bạn tải lên logo, trường này sẽ bị bỏ qua.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Chữ Chân trang</Label>
            <Input id="footerText" name="footerText" value={settings.footerText || ''} onChange={handleInputChange} disabled={isSubmitting} />
          </div>
        </CardContent>
      </Card>

      {/* Greeting and Initial Interaction Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MessagesSquare className="mr-2 h-5 w-5 text-primary" /> Lời chào & Tương tác Ban đầu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="greetingMessage">Lời chào mặc định</Label>
            <Textarea id="greetingMessage" name="greetingMessage" value={settings.greetingMessage || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="Ví dụ: Chào bạn! Tôi là trợ lý AI của spa..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="greetingMessageNewCustomer">Lời chào cho Khách Mới (tùy chọn)</Label>
            <Textarea id="greetingMessageNewCustomer" name="greetingMessageNewCustomer" value={settings.greetingMessageNewCustomer || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="Ví dụ: Chào mừng bạn lần đầu đến với chúng tôi!" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="greetingMessageReturningCustomer">Lời chào cho Khách Cũ (tùy chọn)</Label>
            <Textarea id="greetingMessageReturningCustomer" name="greetingMessageReturningCustomer" value={settings.greetingMessageReturningCustomer || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="Ví dụ: Chào mừng bạn quay trở lại!" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggestedQuestionsTextarea">Câu hỏi gợi ý ban đầu (Mỗi câu một dòng)</Label>
            <Textarea id="suggestedQuestionsTextarea" name="suggestedQuestions" value={(settings.suggestedQuestions || []).join('\n')} onChange={handleSuggestedQuestionsChange} disabled={isSubmitting} placeholder="Dịch vụ của bạn là gì?\nĐặt lịch hẹn" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="successfulBookingMessageTemplate">Mẫu tin nhắn Đặt lịch thành công</Label>
            <Textarea id="successfulBookingMessageTemplate" name="successfulBookingMessageTemplate" value={settings.successfulBookingMessageTemplate || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="VD: Lịch hẹn cho {{service}} vào {{time}} {{date}} đã được xác nhận!" />
            <p className="text-xs text-muted-foreground">Sử dụng: {'\'{{service}}\''}, {'\'{{date}}\''}, {'\'{{time}}\''}, {'\'{{branch}}\''}.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancelledAppointmentMessageTemplate">Mẫu tin nhắn Hủy lịch hẹn</Label>
            <Textarea id="cancelledAppointmentMessageTemplate" name="cancelledAppointmentMessageTemplate" value={settings.cancelledAppointmentMessageTemplate || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="VD: Lịch hẹn {{service}} vào {{time}} {{date}} đã được hủy thành công." />
            <p className="text-xs text-muted-foreground">Sử dụng: {'\'{{service}}\''}, {'\'{{date}}\''}, {'\'{{time}}\''}, {'\'{{branch}}\''}.</p>
          </div>
          {/* Mẫu tin nhắn Đổi lịch hẹn */}
          {/* <div className="space-y-2">
            <Label htmlFor="rescheduledAppointmentMessageTemplate">Mẫu tin nhắn Đổi lịch hẹn</Label>
            <Textarea id="rescheduledAppointmentMessageTemplate" name="rescheduledAppointmentMessageTemplate" value={settings.rescheduledAppointmentMessageTemplate || ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="VD: Lịch hẹn {{service}} đã được đổi thành {{time}} {{date}}." />
            <p className="text-xs text-muted-foreground">Sử dụng: {'\'{{service}}\''}, {'\'{{date}}\''}, {'\'{{time}}\''}, {'\'{{branch}}\''}.</p>
          </div> */}
        </CardContent>
      </Card>

      {/* Out of Office Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" /> Phản hồi Ngoài giờ Làm việc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="outOfOfficeResponseEnabled" name="outOfOfficeResponseEnabled" checked={settings.outOfOfficeResponseEnabled} onCheckedChange={(checked) => handleCheckboxChange('outOfOfficeResponseEnabled', checked)} disabled={isSubmitting} />
            <Label htmlFor="outOfOfficeResponseEnabled">Bật phản hồi ngoài giờ</Label>
          </div>
          {settings.outOfOfficeResponseEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="outOfOfficeMessage">Nội dung phản hồi ngoài giờ</Label>
                <Textarea id="outOfOfficeMessage" name="outOfOfficeMessage" value={settings.outOfOfficeMessage || ''} onChange={handleInputChange} disabled={isSubmitting} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="officeHoursStart">Giờ bắt đầu làm việc</Label>
                  <Input id="officeHoursStart" name="officeHoursStart" type="time" value={settings.officeHoursStart || ''} onChange={handleInputChange} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="officeHoursEnd">Giờ kết thúc làm việc</Label>
                  <Input id="officeHoursEnd" name="officeHoursEnd" type="time" value={settings.officeHoursEnd || ''} onChange={handleInputChange} disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ngày làm việc trong tuần</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {daysOfWeek.map(day => (
                    <div key={`officeDay-${day.id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`officeDay-${day.id}`}
                        checked={(settings.officeDays || []).includes(day.id)}
                        onCheckedChange={(checked) => handleOfficeDayChange(day.id, checked)}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor={`officeDay-${day.id}`} className="font-normal">{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Break Times Section - Thời gian nghỉ trong ngày */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-md font-semibold">Thời gian Nghỉ trong Ngày</h4>
                <p className="text-sm text-muted-foreground">Cài đặt các khung giờ nghỉ để tránh đặt lịch trong thời gian này</p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="breakTimeNotificationEnabled" 
                  name="breakTimeNotificationEnabled" 
                  checked={settings.breakTimeNotificationEnabled} 
                  onCheckedChange={(checked) => handleCheckboxChange('breakTimeNotificationEnabled', checked)} 
                  disabled={isSubmitting} 
                />
                <Label htmlFor="breakTimeNotificationEnabled">Bật thông báo thời gian nghỉ</Label>
              </div>
            </div>

            {settings.breakTimeNotificationEnabled && (
              <div className="space-y-2">
                <Label htmlFor="breakTimeNotificationMessage">Mẫu tin nhắn thông báo thời gian nghỉ</Label>
                <Textarea 
                  id="breakTimeNotificationMessage" 
                  name="breakTimeNotificationMessage" 
                  value={settings.breakTimeNotificationMessage || ''} 
                  onChange={handleInputChange} 
                  disabled={isSubmitting} 
                  placeholder="VD: Hiện tại chúng tôi đang trong giờ nghỉ {{breakName}} từ {{startTime}} đến {{endTime}}."
                />
                <p className="text-xs text-muted-foreground">Sử dụng: {'\'{{breakName}}\''}, {'\'{{startTime}}\''}, {'\'{{endTime}}\''}.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-md">
              <Input 
                type="time" 
                value={newBreakTimeStartTime} 
                onChange={e => setNewBreakTimeStartTime(e.target.value)} 
                placeholder="Giờ bắt đầu" 
                className="h-9"
                disabled={isSubmitting}
              />
              <Input 
                type="time" 
                value={newBreakTimeEndTime} 
                onChange={e => setNewBreakTimeEndTime(e.target.value)} 
                placeholder="Giờ kết thúc" 
                className="h-9"
                disabled={isSubmitting}
              />
              <Input 
                value={newBreakTimeName} 
                onChange={e => setNewBreakTimeName(e.target.value)} 
                placeholder="Tên thời gian nghỉ (tuỳ chọn)" 
                className="h-9"
                disabled={isSubmitting}
              />
              <Button 
                onClick={handleAddBreakTime} 
                size="sm" 
                className="h-9"
                disabled={isSubmitting}
              >
                <PlusCircle className="mr-1 h-4 w-4" />Thêm thời gian nghỉ
              </Button>
            </div>

            {(settings.breakTimes || []).length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Danh sách thời gian nghỉ hiện tại:</h5>
                {(settings.breakTimes || []).map((breakTime) => (
                  <Card key={breakTime.id} className="p-3 bg-muted/30">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {breakTime.startTime} - {breakTime.endTime}
                          {breakTime.name && <span className="ml-2 text-muted-foreground">({breakTime.name})</span>}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveBreakTime(breakTime.id!)} 
                        className="h-6 w-6"
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SEO Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" /> Cài đặt SEO</CardTitle>
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
            <Label htmlFor="metaKeywordsInput">Từ khóa Meta (cách nhau bằng dấu phẩy)</Label>
            <Input id="metaKeywordsInput" name="metaKeywords" value={(settings.metaKeywords || []).join(', ')} onChange={handleMetaKeywordsChange} disabled={isSubmitting} />
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

      {/* Appointment Scheduling Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarCog className="mr-2 h-5 w-5 text-primary" /> Quy tắc Đặt lịch Chung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="numberOfStaff"><UsersIcon className="inline mr-1 h-4 w-4" />Số nhân viên (chung)</Label>
              <Input id="numberOfStaff" name="numberOfStaff" type="number" min="0" value={settings.numberOfStaff ?? ''} onChange={handleInputChange} disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultServiceDurationMinutes"><Clock className="inline mr-1 h-4 w-4" />Thời gian dịch vụ mặc định (phút)</Label>
              <Input id="defaultServiceDurationMinutes" name="defaultServiceDurationMinutes" type="number" min="5" value={settings.defaultServiceDurationMinutes ?? ''} onChange={handleInputChange} disabled={isSubmitting} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workingHoursInput"><Clock className="inline mr-1 h-4 w-4" />Giờ nhận khách (chung) (HH:MM, cách nhau bằng dấu phẩy)</Label>
            <Input 
              id="workingHoursInput" 
              name="workingHours" 
              value={settings.workingHours?.join(', ') || ''} 
              onChange={handleWorkingHoursChange}
              onBlur={(e) => {
                // Validate on blur
                const hours = e.target.value.split(',').map(h => h.trim());
                const validHours = validateWorkingHours(hours);
                if (validHours.length !== hours.length) {
                  toast({
                    title: "Cảnh báo",
                    description: "Một số giờ không hợp lệ đã được loại bỏ. Vui lòng nhập theo định dạng HH:MM (ví dụ: 09:00)",
                    variant: "destructive"
                  });
                }
                setSettings(prev => ({
                  ...prev,
                  workingHours: validHours
                }));
              }}
              placeholder="Ví dụ: 09:00, 10:00, 13:30, 14:30" 
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">Các giờ bắt đầu của lịch hẹn. Ví dụ: 09:00,10:00,14:00,15:00</p>
          </div>


          <div className="space-y-2">
            <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ hàng tuần (chung)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {daysOfWeek.map(day => (
                <div key={`weeklyOffDay-${day.id}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`weeklyOffDay-${day.id}`}
                    checked={(settings.weeklyOffDays || []).includes(day.id)}
                    onCheckedChange={(checked) => handleWeeklyOffDayChange(day.id, checked)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor={`weeklyOffDay-${day.id}`} className="font-normal">{day.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ Lễ/Đặc biệt (chung)</Label>
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
                  {isValidDateFns(parse(date, 'yyyy-MM-dd', new Date())) ? format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveOneTimeOffDate(date)} disabled={isSubmitting}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <Separator />
          <div>
            <h4 className="text-md font-semibold mb-2">Quy tắc cho Ngày Cụ thể (chung)</h4>
            <p className="text-sm text-muted-foreground mb-3">Ghi đè các quy tắc chung cho một ngày nhất định. Để trống các trường nếu muốn dùng giá trị chung.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border rounded-md mb-4">
              <Input type="date" value={newSpecificRuleDate} onChange={e => setNewSpecificRuleDate(e.target.value)} placeholder="Ngày (YYYY-MM-DD)" className="h-9" />
              <Input value={newSpecificRuleWorkingHours} onChange={e => setNewSpecificRuleWorkingHours(e.target.value)} placeholder="Giờ làm việc (HH:MM, HH:MM)" className="h-9" />
              <Input type="number" value={newSpecificRuleStaff} onChange={e => setNewSpecificRuleStaff(e.target.value)} placeholder="Số nhân viên" className="h-9" />
              <Input type="number" value={newSpecificRuleDuration} onChange={e => setNewSpecificRuleDuration(e.target.value)} placeholder="Thời gian DV (phút)" className="h-9" />
              <div className="flex items-center space-x-2 col-span-full md:col-span-1">
                <Checkbox id="newSpecificRuleIsOff" checked={newSpecificRuleIsOff} onCheckedChange={(checked) => setNewSpecificRuleIsOff(!!checked)} />
                <Label htmlFor="newSpecificRuleIsOff">Ngày nghỉ</Label>
              </div>
              <Button onClick={handleAddSpecificRule} size="sm" className="col-span-full md:col-span-1 h-9"><PlusCircle className="mr-1 h-4 w-4" />Thêm quy tắc ngày</Button>
            </div>

            {(settings.specificDayRules || []).length > 0 && (
              <div className="space-y-2">
                {(settings.specificDayRules || []).map((rule) => (
                  <Card key={rule.id} className="p-3 bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-sm">Ngày: {isValidDateFns(parse(rule.date, 'yyyy-MM-dd', new Date())) ? format(parse(rule.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}</p>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveSpecificRule(rule.id!)} className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
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

      {/* Notification Settings */}
      <NotificationSettings />

      {/* Notification Debug Panel */}
      {/* <NotificationDebug /> */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary" /> Cấu hình Khác</CardTitle>
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
