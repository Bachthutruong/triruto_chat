'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Save, Image as ImageIcon, Palette, FileText, Settings2 } from 'lucide-react';

export default function AdminSettingsPage() {
  // Mock state for settings - in a real app, this would come from a DB
  const [settings, setSettings] = useState({
    brandName: 'AetherChat',
    logoUrl: '',
    footerText: '© 2024 AetherChat. All rights reserved.',
    metaTitle: 'AetherChat - Intelligent Live Chat',
    metaDescription: 'AI-powered live chat for seamless customer communication.',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = () => {
    console.log('Saving settings:', settings);
    // Add toast notification for success/failure
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Application Settings</h1>
      <p className="text-muted-foreground">Configure interface, SEO, and other system settings.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Interface Settings</CardTitle>
          <CardDescription>Customize the look and feel of the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand Name</Label>
            <Input id="brandName" name="brandName" value={settings.brandName} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://example.com/logo.png" value={settings.logoUrl} onChange={handleInputChange} />
            {/* Consider a file upload component here for logos */}
          </div>
           <div className="space-y-2">
            <Label htmlFor="footerText">Footer Text</Label>
            <Input id="footerText" name="footerText" value={settings.footerText} onChange={handleInputChange} />
          </div>
          <Button onClick={handleSaveSettings}><Save className="mr-2 h-4 w-4" /> Save Interface Settings</Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" /> SEO Settings</CardTitle>
          <CardDescription>Optimize your application for search engines.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input id="metaTitle" name="metaTitle" value={settings.metaTitle} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Input id="metaDescription" name="metaDescription" value={settings.metaDescription} onChange={handleInputChange} />
          </div>
          {/* Add fields for keywords, OpenGraph, robots.txt, sitemap as needed */}
          <Button onClick={handleSaveSettings}><Save className="mr-2 h-4 w-4" /> Save SEO Settings</Button>
        </CardContent>
      </Card>
      
      <Separator />

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary" /> Other Configurations</CardTitle>
          <CardDescription>General system configurations.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Placeholder for other general settings (e.g., API keys, integrations).</p>
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
