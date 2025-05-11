'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, CalendarCog } from 'lucide-react';

type AppointmentRule = {
  id: string;
  name: string;
  keywords: string[];
  conditions: string; // e.g., "service:haircut, time:after_5pm, branch:main"
  aiPromptInstructions: string; // Specific instructions for AI for this rule
};

const mockRules: AppointmentRule[] = [
  { id: 'rule1', name: 'Evening Haircut Rule', keywords: ['haircut evening', 'tóc tối'], conditions: 'service:Haircut, time:[5PM-8PM]', aiPromptInstructions: 'Prioritize Main Street Branch for evening haircuts. If full, suggest Oak Avenue.' },
  { id: 'rule2', name: 'Weekend Massage Special', keywords: ['massage weekend', 'massage cuối tuần'], conditions: 'service:Massage, day:[Sat,Sun]', aiPromptInstructions: 'Mention the 10% weekend discount for massages.' },
];

export default function AdminAppointmentRulesPage() {
  const [rules, setRules] = useState<AppointmentRule[]>(mockRules);
  // TODO: Add state and handlers for editing/adding rules

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Appointment Rules</h1>
          <p className="text-muted-foreground">Configure rules to guide the AI in scheduling appointments.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Rule
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarCog className="mr-2 h-5 w-5 text-primary" /> Current Rules</CardTitle>
          <CardDescription>These rules help the AI understand complex booking requests and suggest appropriate slots.</CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p>No appointment rules configured yet.</p>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <Card key={rule.id} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="font-semibold">Keywords:</span> {rule.keywords.join(', ')}</p>
                    <p><span className="font-semibold">Conditions:</span> {rule.conditions}</p>
                    <div>
                      <span className="font-semibold">AI Prompt Instructions:</span>
                      <p className="mt-1 p-2 bg-background border rounded text-xs">{rule.aiPromptInstructions}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3 w-3" /> Edit Rule</Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Delete Rule</Button>
                     </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for form to add/edit rules */}
      <Card className="mt-6">
        <CardHeader>
            <CardTitle>Add/Edit Rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label htmlFor="ruleName">Rule Name</Label>
                <Input id="ruleName" placeholder="e.g., VIP Early Booking"/>
            </div>
            <div>
                <Label htmlFor="ruleKeywords">Keywords (comma-separated)</Label>
                <Input id="ruleKeywords" placeholder="e.g., vip booking, early access"/>
            </div>
            <div>
                <Label htmlFor="ruleConditions">Conditions (e.g., key:value, key:[val1,val2])</Label>
                <Input id="ruleConditions" placeholder="e.g., customer_tag:VIP, service:Facial"/>
            </div>
            <div>
                <Label htmlFor="ruleAiInstructions">AI Prompt Instructions</Label>
                <Textarea id="ruleAiInstructions" placeholder="Detailed instructions for the AI when this rule matches..."/>
            </div>
            <Button>Save Rule</Button>
        </CardContent>
      </Card>

    </div>
  );
}
