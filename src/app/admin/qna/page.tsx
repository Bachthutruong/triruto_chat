'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, MessageCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { KeywordMapping, TrainingData } from '@/lib/types';

// Mock data - replace with API calls
const mockKeywords: KeywordMapping[] = [
  { id: 'kw1', keywords: ['opening hours', 'giờ mở cửa'], response: 'We are open 9 AM - 6 PM daily.', createdAt: new Date(), updatedAt: new Date() },
  { id: 'kw2', keywords: ['location', 'địa chỉ'], response: 'Find us at 123 Main St.', createdAt: new Date(), updatedAt: new Date() },
];

const mockTrainingData: TrainingData[] = [
  { id: 'td1', userInput: 'How much for a haircut?', idealResponse: 'A standard haircut is $50.', label: 'Service Inquiry', status: 'approved', createdAt: new Date() },
  { id: 'td2', userInput: 'My appointment is wrong', idealResponse: '', label: 'Needs Assistance', status: 'pending_review', createdAt: new Date() },
];


export default function AdminQnaPage() {
  const [greeting, setGreeting] = useState('Welcome to AetherChat! How can I help you today?');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(['What are your services?', 'How to book an appointment?']);
  const [keywords, setKeywords] = useState<KeywordMapping[]>(mockKeywords);
  const [trainingData, setTrainingData] = useState<TrainingData[]>(mockTrainingData);

  // TODO: Add state and handlers for editing/adding keywords and training data

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Q&A and AI Training</h1>
      <p className="text-muted-foreground">Manage automated responses and train the AI model.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MessageCircle className="mr-2 h-5 w-5 text-primary" /> Automated Responses</CardTitle>
          <CardDescription>Configure greetings, suggested questions, and keyword-based replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="greeting">Welcome Greeting</Label>
            <Textarea id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
          </div>
          <div>
            <Label>Suggested Questions (comma-separated)</Label>
            <Input 
              value={suggestedQuestions.join(', ')} 
              onChange={(e) => setSuggestedQuestions(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
              placeholder="e.g., Services, Book Appointment"
            />
          </div>
          <Button>Save Greetings & Suggestions</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyword Responses</CardTitle>
          <CardDescription>Define responses for specific keywords.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="mb-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Keyword Response</Button>
          <div className="space-y-2">
            {keywords.map(kw => (
              <div key={kw.id} className="p-3 border rounded-md bg-muted/50">
                <p className="font-semibold">Keywords: <span className="font-normal text-sm">{kw.keywords.join(', ')}</span></p>
                <p className="font-semibold">Response: <span className="font-normal text-sm">{kw.response}</span></p>
                <div className="mt-2 space-x-2">
                  <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3 w-3" /> Edit</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-primary" /> AI Training Data</CardTitle>
          <CardDescription>Review user inputs and assign labels or correct responses for AI training.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="mb-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Training Data</Button>
          <div className="space-y-2">
            {trainingData.map(td => (
              <div key={td.id} className="p-3 border rounded-md bg-muted/50">
                <p><span className="font-semibold">User Input:</span> {td.userInput}</p>
                {td.idealResponse && <p><span className="font-semibold">Ideal Response:</span> {td.idealResponse}</p>}
                <p><span className="font-semibold">Label:</span> {td.label}</p>
                <p><span className="font-semibold">Status:</span> 
                  <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                    td.status === 'approved' ? 'bg-green-100 text-green-700' :
                    td.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'}`}>
                    {td.status.replace('_', ' ')}
                  </span>
                </p>
                <div className="mt-2 space-x-2">
                  <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3 w-3" /> Review/Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
