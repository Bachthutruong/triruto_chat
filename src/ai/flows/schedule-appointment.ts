// schedule-appointment.ts
'use server';

/**
 * @fileOverview A flow to schedule appointments using natural language.
 *
 * - scheduleAppointment - A function that handles the appointment scheduling process.
 * - ScheduleAppointmentInput - The input type for the scheduleAppointment function.
 * - ScheduleAppointmentOutput - The return type for the scheduleAppointment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScheduleAppointmentInputSchema = z.object({
  userInput: z.string().describe('The user input requesting an appointment.'),
  phoneNumber: z.string().describe('The user\u0027s phone number.'),
});
export type ScheduleAppointmentInput = z.infer<typeof ScheduleAppointmentInputSchema>;

const ScheduleAppointmentOutputSchema = z.object({
  confirmationMessage: z.string().describe('A message confirming the appointment details or suggesting available slots.'),
  appointmentDetails: z.optional(z.object({
    service: z.string().describe('The type of service requested.'),
    time: z.string().describe('The scheduled time for the appointment.'),
    date: z.string().describe('The scheduled date for the appointment.'),
  })),
});
export type ScheduleAppointmentOutput = z.infer<typeof ScheduleAppointmentOutputSchema>;

export async function scheduleAppointment(input: ScheduleAppointmentInput): Promise<ScheduleAppointmentOutput> {
  return scheduleAppointmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scheduleAppointmentPrompt',
  input: {schema: ScheduleAppointmentInputSchema},
  output: {schema: ScheduleAppointmentOutputSchema},
  prompt: `You are an AI assistant helping users schedule appointments. 
  The user will provide input in natural language, and your task is to understand their preferences (service, time, etc.) and suggest available slots or confirm the appointment if the details are clear.
  Consider the user's phone number to check their history and preferences, if available.

  User Input: {{{userInput}}}
  Phone Number: {{{phoneNumber}}}

  Respond with a confirmation message or suggested time slots.
  If the user asks to cancel or reschedule, guide them appropriately.
  Output a JSON object with a confirmationMessage and appointmentDetails if available.
  appointmentDetails should include service, time and date. If the service, time or data are not available, omit the appointmentDetails field.
  `, 
});

const scheduleAppointmentFlow = ai.defineFlow(
  {
    name: 'scheduleAppointmentFlow',
    inputSchema: ScheduleAppointmentInputSchema,
    outputSchema: ScheduleAppointmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
