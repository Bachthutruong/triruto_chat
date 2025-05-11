// src/ai/schemas/schedule-appointment-schemas.ts
/**
 * @fileOverview Schema definitions for the scheduleAppointment flow.
 *
 * - AppointmentDetailsSchema - Zod schema for appointment details.
 * - ScheduleAppointmentInputSchema - Zod schema for input.
 * - ScheduleAppointmentInput - TypeScript type for input.
 * - ScheduleAppointmentOutputSchema - Zod schema for output.
 * - ScheduleAppointmentOutput - TypeScript type for output.
 */
import { z } from 'genkit';

export const AppointmentDetailsSchema = z.object({
  appointmentId: z.string(),
  userId: z.string(),
  service: z.string(),
  time: z.string(),
  date: z.string(),
  branch: z.string().optional(),
  packageType: z.string().optional(),
  priority: z.string().optional(),
  status: z.enum(['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled']),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ScheduleAppointmentInputSchema = z.object({
  userInput: z.string().describe('The user input requesting an appointment action (book, reschedule, cancel).'),
  phoneNumber: z.string().describe('The user\u0027s phone number.'),
  userId: z.string().describe('The unique ID of the user.'),
  existingAppointments: z.array(AppointmentDetailsSchema).optional().describe('A list of the user\'s current appointments for context, especially for rescheduling or cancellation.'),
  currentDateTime: z.string().datetime().describe('The current date and time in ISO format, to help determine context for "today", "tomorrow".'),
});
export type ScheduleAppointmentInput = z.infer<typeof ScheduleAppointmentInputSchema>;

export const ScheduleAppointmentOutputSchema = z.object({
  intent: z.enum(['booked', 'rescheduled', 'cancelled', 'pending_alternatives', 'clarification_needed', 'error', 'no_action_needed'])
    .describe('The outcome of the scheduling attempt or the identified user intent.'),
  confirmationMessage: z.string().describe('A message to the user about the appointment status or next steps.'),
  appointmentDetails: AppointmentDetailsSchema.omit({ userId: true, createdAt: true, updatedAt: true, packageType: true, priority: true, notes: true })
    .merge(z.object({ appointmentId: z.string().optional() }))
    .optional()
    .describe('Details of the booked, rescheduled, or identified appointment. For new bookings, ID might be pending.'),
  originalAppointmentIdToModify: z.string().optional().describe('If rescheduling or cancelling, the ID of the original appointment being affected.'),
  suggestedSlots: z.array(z.object({
    date: z.string().describe('Suggested date (YYYY-MM-DD).'),
    time: z.string().describe('Suggested time (e.g., "2:00 PM").'),
    branch: z.string().optional().describe('Suggested branch.'),
  })).optional().describe('Suggested alternative slots if the requested one is unavailable or for rescheduling.'),
  missingInformation: z.string().optional().describe('If clarification is needed, what information is missing (e.g., "service type", "preferred date").'),
  requiresAssistance: z.boolean().optional().describe('True if the AI cannot handle the request and human assistance is needed.'),
});
export type ScheduleAppointmentOutput = z.infer<typeof ScheduleAppointmentOutputSchema>;
