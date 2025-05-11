// schedule-appointment.ts
'use server';

/**
 * @fileOverview A flow to schedule, reschedule, or cancel appointments using natural language.
 *
 * - scheduleAppointment - A function that handles the appointment process.
 * Schemas (ScheduleAppointmentInput, ScheduleAppointmentOutput, AppointmentDetailsSchema) are defined in '@/ai/schemas/schedule-appointment-schemas.ts'.
 */

import {ai} from '@/ai/genkit';
import {
    ScheduleAppointmentInputSchema,
    type ScheduleAppointmentInput,
    ScheduleAppointmentOutputSchema,
    type ScheduleAppointmentOutput
} from '@/ai/schemas/schedule-appointment-schemas';


export async function scheduleAppointment(input: ScheduleAppointmentInput): Promise<ScheduleAppointmentOutput> {
  return scheduleAppointmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scheduleAppointmentPrompt',
  input: {schema: ScheduleAppointmentInputSchema},
  output: {schema: ScheduleAppointmentOutputSchema},
  prompt: `You are an AI assistant for a salon/spa, helping users manage appointments.
User's phone number: {{{phoneNumber}}}. User ID: {{{userId}}}. Current date/time: {{{currentDateTime}}}.

User Input: {{{userInput}}}

{{#if existingAppointments}}
User's existing appointments:
{{#each existingAppointments}}
- ID: {{appointmentId}}, Service: {{service}}, Date: {{date}}, Time: {{time}}, Status: {{status}}{{#if branch}}, Branch: {{branch}}{{/if}}
{{/each}}
{{else}}
User has no existing appointments.
{{/if}}

Available services: Haircut, Styling, Coloring, Manicure, Pedicure, Facial, Massage.
Operating Hours: 9 AM - 6 PM daily. Appointments are typically 1 hour long.
Branches: "Main Street Branch", "Oak Avenue Annex". If branch is not specified, user might pick or you can suggest Main Street Branch.

Your tasks:
1.  Determine Intent: Is the user trying to book a new appointment, reschedule an existing one, or cancel one?
2.  Extract Details: For new bookings/reschedules, identify service, preferred date, time, and branch.
3.  Simulate Availability:
    *   You MUST assume some slots are busy. Do NOT always say a slot is available.
    *   If a specific slot (e.g., "Haircut tomorrow at 3 PM") is requested:
        *   50% chance it's available: set 'intent: "booked"', provide 'appointmentDetails'.
        *   50% chance it's busy: set 'intent: "pending_alternatives"', provide 'suggestedSlots' (2-3 realistic future slots, e.g., different time same day, or next day).
    *   If the request is vague (e.g., "I want a massage next week"): set 'intent: "pending_alternatives"' and provide 2-3 'suggestedSlots'.
4.  Handle Reschedules:
    *   Identify which appointment to reschedule using 'originalAppointmentIdToModify'. If unclear, ask for clarification.
    *   Ask for new preferred date/time if not provided.
    *   Then, simulate availability as above for the new slot. If available, 'intent: "rescheduled"'. If not, 'intent: "pending_alternatives"'.
5.  Handle Cancellations:
    *   Identify which appointment to cancel using 'originalAppointmentIdToModify'. If unclear, ask for clarification.
    *   Set 'intent: "cancelled"'.
6.  Clarification: If crucial information is missing (e.g., service for a new booking, which appointment to modify), set 'intent: "clarification_needed"' and specify 'missingInformation'.
7.  Error/Assistance: If the request is too complex or completely unrelated to appointments, set 'intent: "error"' or 'requiresAssistance: true'.

Response Fields:
- intent: "booked", "rescheduled", "cancelled", "pending_alternatives", "clarification_needed", "error", "no_action_needed".
- confirmationMessage: Your friendly textual response to the user. This is what the user will see.
- appointmentDetails: Object with {service, date, time, branch, status}. For 'booked'/'rescheduled', status should be 'booked'. For initial output for a new booking, 'appointmentId' can be omitted by you as the system will generate it.
- originalAppointmentIdToModify: ID of appointment being changed/cancelled.
- suggestedSlots: Array of {date, time, branch} for "pending_alternatives".
- missingInformation: String describing what's needed for "clarification_needed".
- requiresAssistance: Boolean.

Example for new booking: User says "Book a haircut for tomorrow at 2 PM".
If available: intent="booked", confirmationMessage="OK! I've booked a Haircut for you tomorrow at 2:00 PM.", appointmentDetails={service:"Haircut", date:"<tomorrow's_date>", time:"2:00 PM", status:"booked"}.
If busy: intent="pending_alternatives", confirmationMessage="Sorry, 2 PM is booked. How about 4 PM or the day after at 2 PM?", suggestedSlots=[{date:"<tomorrow's_date>", time:"4:00 PM"}, {date:"<day_after_tomorrow_date>", time:"2:00 PM"}].

Example for cancellation: User says "Cancel my appointment for tomorrow." (Assume one appointment for tomorrow with ID 'appt123')
intent="cancelled", confirmationMessage="Your appointment for tomorrow has been cancelled.", originalAppointmentIdToModify="appt123".

Provide dates in YYYY-MM-DD format.
Be concise and helpful in your confirmationMessage.
If the user input is not related to appointments (e.g. "What's the weather?"), set intent to "no_action_needed" and provide a polite message.
`,
});

const scheduleAppointmentFlow = ai.defineFlow(
  {
    name: 'scheduleAppointmentFlow',
    inputSchema: ScheduleAppointmentInputSchema,
    outputSchema: ScheduleAppointmentOutputSchema,
  },
  async (input) => {
    // Add a check to ensure input.currentDateTime is valid if necessary
    if (!input.currentDateTime) {
        // Fallback or throw error if currentDateTime is crucial and missing
        console.warn("CurrentDateTime is missing, using server's current time as fallback.");
        input.currentDateTime = new Date().toISOString();
    }

    const {output} = await prompt(input);
    
    if (!output) {
      // Handle cases where the prompt might not return an output (e.g. model error, safety block)
      return {
        intent: 'error',
        confirmationMessage: "I'm having trouble processing your request right now. Please try again later.",
        requiresAssistance: true,
      };
    }
    
    // Post-processing: If AI marks as booked/rescheduled, ensure appointmentDetails has status 'booked'.
    if (output.intent === 'booked' || output.intent === 'rescheduled') {
      if (output.appointmentDetails) {
        output.appointmentDetails.status = 'booked';
      } else {
        // This case implies an issue with the AI's output if it says booked but provides no details.
        console.warn("AI indicated 'booked' or 'rescheduled' intent but no appointmentDetails were provided.");
        // Potentially change intent to error or clarification_needed
      }
    }
    if (output.intent === 'cancelled' && output.originalAppointmentIdToModify && output.appointmentDetails) {
        // For cancellation, appointmentDetails can reflect the cancelled appointment's state
        output.appointmentDetails.status = 'cancelled';
    }


    return output;
  }
);
