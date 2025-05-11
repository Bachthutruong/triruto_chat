// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { loginUser } from '@/app/actions';
import type { UserSession } from '@/lib/types';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const session = await loginUser(phoneNumber, password);
      if (session) {
        sessionStorage.setItem('aetherChatUserSession', JSON.stringify(session));
        toast({
          title: 'Login Successful',
          description: `Welcome back, ${session.name || session.phoneNumber}!`,
        });
        if (session.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (session.role === 'staff') {
          router.push('/staff/dashboard');
        } else {
          // Should not happen for login page, but as a fallback
          router.push('/');
        }
      } else {
        throw new Error('Invalid credentials or user not found.');
      }
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader userSession={null} onLogout={() => {}} />
      <main className="flex-grow container mx-auto py-12 px-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center">
                <LogIn className="mr-2 h-6 w-6 text-primary" /> Staff & Admin Login
            </CardTitle>
            <CardDescription>Access your AetherChat dashboard.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Don't have an account? <Link href="/register" className="text-primary hover:underline">Register here</Link>
              </p>
              <p className="text-sm text-muted-foreground">
                Are you a customer? <Link href="/" className="text-primary hover:underline">Go to Chat</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
