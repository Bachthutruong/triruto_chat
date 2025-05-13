// schedule-appointment.ts
'use server';

/**
 * @fileOverview A flow to schedule, reschedule, or cancel appointments using natural language,
 * incorporating business rules and admin-defined appointment rules.
 *
 * - scheduleAppointment - A function that handles the appointment process.
 * Schemas (ScheduleAppointmentInput, ScheduleAppointmentOutput, AppointmentDetailsSchema, AppointmentRuleSchema) are defined in '@/ai/schemas/schedule-appointment-schemas.ts'.
 */

import {ai} from '@/ai/genkit';
import {
    ScheduleAppointmentInputSchema,
    type ScheduleAppointmentInput,
    ScheduleAppointmentOutputSchema,
    type ScheduleAppointmentOutput,
    AppointmentDetailsSchema, // Make sure this is imported if needed by prompt
    type AppointmentRule,
} from '@/ai/schemas/schedule-appointment-schemas';
import {getAppSettings, getAppointmentRules} from '@/app/actions'; // To fetch scheduling rules
import type { AppSettings, SpecificDayRule } from '@/lib/types';
import AppointmentModel from '@/models/Appointment.model'; // To check existing appointments
import { parseISO as dateFnsParseISO, getDay, addMinutes, isBefore, format as dateFnsFormat, isValid as isValidDate } from 'date-fns';
import mongoose from 'mongoose';


// This prompt focuses on NLU and NLG, guided by TypeScript availability checks.
const scheduleAppointmentPrompt = ai.definePrompt({
  name: 'scheduleAppointmentPromptVietnameseEnhanced', 
  input: { schema: ScheduleAppointmentInputSchema }, 
  output: { schema: ScheduleAppointmentOutputSchema },
  prompt: `Bạn là một trợ lý AI cho một salon/spa, giúp người dùng quản lý lịch hẹn bằng tiếng Việt.
Số điện thoại của người dùng: {{{phoneNumber}}}. ID người dùng: {{{userId}}}. Ngày/giờ hiện tại: {{{currentDateTime}}}.

{{#if availabilityCheckResult}}
**Thông tin kiểm tra lịch trống (từ hệ thống):**
Trạng thái: {{availabilityCheckResult.status}}
{{#if availabilityCheckResult.reason}}Lý do: {{availabilityCheckResult.reason}}{{/if}}
{{#if availabilityCheckResult.suggestedSlots}}
Các khung giờ gợi ý:
{{#each availabilityCheckResult.suggestedSlots}}
- Ngày: {{date}} lúc {{time}}
{{/each}}
{{/if}}
{{#if availabilityCheckResult.confirmedSlot}}
Khung giờ được xác nhận (nếu có thể đặt): Ngày {{availabilityCheckResult.confirmedSlot.date}} lúc {{availabilityCheckResult.confirmedSlot.time}}
{{/if}}
Hãy sử dụng thông tin này để trả lời người dùng một cách tự nhiên.
{{/if}}

{{#if chatHistory}}
Lịch sử trò chuyện (mới nhất ở cuối):
{{{chatHistory}}}
Dựa vào lịch sử này và tin nhắn mới nhất của người dùng để hiểu ngữ cảnh.
{{/if}}

Nội dung người dùng nhập MỚI NHẤT: {{{userInput}}}

{{#if existingAppointments}}
Các lịch hẹn hiện có của người dùng:
{{#each existingAppointments}}
- ID: {{appointmentId}}, Dịch vụ: {{service}}, Ngày: {{date}}, Giờ: {{time}}, Trạng thái: {{status}}{{#if branch}}, Chi nhánh: {{branch}}{{/if}}
{{/each}}
{{else}}
Người dùng không có lịch hẹn nào.
{{/if}}

{{#if appointmentRules.length}}
**Các Quy tắc Đặt lịch Tự động:**
Dưới đây là các quy tắc do quản trị viên cấu hình mà bạn cần tuân theo. Ưu tiên các quy tắc này nếu từ khóa người dùng nhập khớp:
{{#each appointmentRules}}
- **Tên Quy tắc:** {{name}}
  **Từ khóa kích hoạt:** {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  **Điều kiện áp dụng (ví dụ: tag khách hàng, loại dịch vụ, khung giờ):** {{conditions}}
  **Hướng dẫn cho AI (khi quy tắc này khớp):** {{{aiPromptInstructions}}}
---
{{/each}}
Hãy xem xét các quy tắc này khi phân tích yêu cầu đặt lịch của người dùng. Nếu từ khóa của người dùng khớp với một quy tắc, hãy ưu tiên áp dụng các điều kiện và hướng dẫn của quy tắc đó.
{{/if}}

Các dịch vụ có sẵn: Cắt tóc, Tạo kiểu, Nhuộm tóc, Làm móng tay, Làm móng chân, Chăm sóc da mặt, Massage. (Thông tin này chỉ để bạn biết, không cần liệt kê lại trừ khi được hỏi).
Chi nhánh: "Chi nhánh Chính", "Chi nhánh Phụ". (Thông tin này chỉ để bạn biết).

Nhiệm vụ của bạn:
1.  **Hiểu ngữ cảnh**: Dựa trên \`userInput\`, \`chatHistory\`, \`appointmentRules\` (nếu có), và quan trọng nhất là \`availabilityCheckResult\` (nếu có).
2.  **Trích xuất chi tiết ban đầu (nếu chưa có availabilityCheckResult)**: Nếu \`availabilityCheckResult\` không được cung cấp (đây là lượt đầu tiên AI xử lý yêu cầu), hãy cố gắng xác định \`service\`, \`date\` (YYYY-MM-DD), \`time\` (HH:MM), \`branch\` từ \`userInput\` và \`chatHistory\`. Luôn chuyển đổi ngày tương đối ("ngày mai", "tuần tới") thành ngày cụ thể YYYY-MM-DD dựa trên \`currentDateTime\`. Xem xét \`appointmentRules\` để ưu tiên xử lý.
3.  **Tạo phản hồi dựa trên \`availabilityCheckResult\`**:
    *   Nếu \`availabilityCheckResult.status\` là "AVAILABLE" và có \`availabilityCheckResult.confirmedSlot\`: Tạo \`confirmationMessage\` xác nhận lịch hẹn đã được đặt thành công cho khung giờ đó. Đặt \`intent: "booked"\` (hoặc "rescheduled" nếu \`originalAppointmentIdToModify\` có). Đặt \`appointmentDetails\` với thông tin từ \`confirmedSlot\`.
    *   Nếu \`availabilityCheckResult.status\` là "UNAVAILABLE": Tạo \`confirmationMessage\` thông báo lịch không trống, giải thích ngắn gọn dựa trên \`availabilityCheckResult.reason\`. Nếu có \`availabilityCheckResult.suggestedSlots\`, hãy đề xuất chúng cho người dùng. Đặt \`intent: "pending_alternatives"\`.
    *   Nếu \`availabilityCheckResult.status\` là "NEEDS_CLARIFICATION" (do hệ thống không đủ thông tin để kiểm tra): Yêu cầu người dùng cung cấp thông tin còn thiếu. Đặt \`intent: "clarification_needed"\`, điền \`missingInformation\`.
4.  **Xử lý hủy lịch**: Nếu người dùng muốn hủy, xác định \`originalAppointmentIdToModify\` từ \`userInput\` hoặc \`existingAppointments\`. Nếu rõ ràng, đặt \`intent: "cancelled"\` và tạo \`confirmationMessage\` xác nhận hủy. Nếu không rõ, đặt \`intent: "clarification_needed"\`.
5.  **Trả lời câu hỏi chung**: Nếu người dùng chỉ hỏi thông tin chung (ví dụ: "Spa mở cửa mấy giờ?", "Có dịch vụ X không?") và không có ý định đặt/đổi/hủy lịch rõ ràng, hãy trả lời câu hỏi đó và đặt \`intent: "no_action_needed"\`.
6.  **Lỗi/Cần hỗ trợ**: Nếu yêu cầu quá phức tạp, không liên quan, hoặc có lỗi xảy ra, đặt \`intent: "error"\` hoặc \`requiresAssistance: true\`.

Các trường phản hồi:
- intent: "booked", "rescheduled", "cancelled", "pending_alternatives", "clarification_needed", "error", "no_action_needed".
- confirmationMessage: Tin nhắn thân thiện của bạn gửi cho người dùng bằng tiếng Việt.
- appointmentDetails: Đối tượng với {service, date (YYYY-MM-DD), time (HH:MM), branch, status}.
- originalAppointmentIdToModify: ID của lịch hẹn đang được thay đổi/hủy.
- suggestedSlots: Mảng các {date (YYYY-MM-DD), time (HH:MM), branch} cho "pending_alternatives".
- missingInformation: Chuỗi mô tả những gì cần thiết cho "clarification_needed" bằng tiếng Việt.
- requiresAssistance: Boolean.

Hãy súc tích và hữu ích. Luôn dùng định dạng YYYY-MM-DD cho ngày và HH:MM (24 giờ) cho giờ trong \`appointmentDetails\` và \`suggestedSlots\`.
Nếu \`userInput\` là "đặt lịch 2h chiều ngày mai", và \`currentDateTime\` là "2024-07-25T10:00:00Z", thì ngày phải là "2024-07-26" và giờ là "14:00".
`,
});

// Helper function to check availability based on business rules
async function checkRealAvailability(
  targetDate: Date, // Date object
  targetTime: string, // HH:MM format
  serviceDurationMinutesOverride?: number
): Promise<{ isAvailable: boolean; reason?: string; suggestedSlots?: { date: string; time: string }[] }> {
  const appSettings = await getAppSettings();
  if (!appSettings) {
    return { isAvailable: false, reason: "Không thể tải quy tắc đặt lịch của hệ thống." };
  }

  const effectiveServiceDuration = serviceDurationMinutesOverride || appSettings.defaultServiceDurationMinutes || 60;
  const effectiveNumStaff = appSettings.numberOfStaff || 1;
  const generalWorkingHours = appSettings.workingHours || [];
  const weeklyOffDays = appSettings.weeklyOffDays || []; // 0 (Sun) - 6 (Sat)
  const oneTimeOffDates = appSettings.oneTimeOffDates || []; // "YYYY-MM-DD"
  const specificDayRules = appSettings.specificDayRules || [];

  const targetDateString = dateFnsFormat(targetDate, 'yyyy-MM-dd');
  const targetDayOfWeek = getDay(targetDate);

  let currentWorkingHours = generalWorkingHours;
  let currentNumStaff = effectiveNumStaff;
  let currentServiceDuration = effectiveServiceDuration;

  const specificRuleForDay = specificDayRules.find(rule => rule.date === targetDateString);

  if (specificRuleForDay) {
    if (specificRuleForDay.isOff) {
      return { isAvailable: false, reason: `Ngày ${targetDateString} là ngày nghỉ theo lịch đặc biệt.` };
    }
    currentWorkingHours = specificRuleForDay.workingHours && specificRuleForDay.workingHours.length > 0 ? specificRuleForDay.workingHours : generalWorkingHours;
    currentNumStaff = specificRuleForDay.numberOfStaff ?? effectiveNumStaff;
    currentServiceDuration = specificRuleForDay.serviceDurationMinutes ?? effectiveServiceDuration;
  } else {
    if (weeklyOffDays.includes(targetDayOfWeek)) {
      return { isAvailable: false, reason: `Ngày ${targetDateString} (thứ ${targetDayOfWeek + 1}) là ngày nghỉ cố định hàng tuần.` };
    }
    if (oneTimeOffDates.includes(targetDateString)) {
      return { isAvailable: false, reason: `Ngày ${targetDateString} là ngày nghỉ lễ/đặc biệt.` };
    }
  }
  
  // Check if targetTime is a valid start time within currentWorkingHours
  if (!currentWorkingHours.includes(targetTime)) {
     // A more sophisticated check could see if targetTime fits within a slot defined by currentWorkingHours and currentServiceDuration.
     // For now, we assume targetTime must be one of the explicit start times.
    return { isAvailable: false, reason: `Thời gian ${targetTime} không phải là giờ bắt đầu dịch vụ hợp lệ.` };
  }

  // Check for staff availability
  const appointmentStartDateTime = dateFnsParseISO(`${targetDateString}T${targetTime}:00.000Z`);
  if (!isValidDate(appointmentStartDateTime)) {
      return { isAvailable: false, reason: "Ngày giờ không hợp lệ." };
  }
  const appointmentEndDateTime = addMinutes(appointmentStartDateTime, currentServiceDuration);

  const existingAppointmentsOnDate = await AppointmentModel.find({
    date: targetDateString,
    status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } // Consider all non-cancelled/completed
  });

  let overlappingCount = 0;
  for (const exAppt of existingAppointmentsOnDate) {
    const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`); // Assuming exAppt.time is HH:MM
    if (!isValidDate(exApptStart)) continue;

    // Determine duration for existing appointment (could be specific rule for its date or default)
    let exApptDuration = appSettings.defaultServiceDurationMinutes || 60;
    const exApptSpecificRule = specificDayRules.find(r => r.date === exAppt.date);
    if (exApptSpecificRule && exApptSpecificRule.serviceDurationMinutes) {
        exApptDuration = exApptSpecificRule.serviceDurationMinutes;
    }
    
    const exApptEnd = addMinutes(exApptStart, exApptDuration);

    // Check overlap: (StartA < EndB) && (StartB < EndA)
    if (isBefore(appointmentStartDateTime, exApptEnd) && isBefore(exApptStart, appointmentEndDateTime)) {
      overlappingCount++;
    }
  }

  if (overlappingCount >= currentNumStaff) {
    // TODO: Implement logic to find and suggest alternative slots
    return { isAvailable: false, reason: `Xin lỗi, đã đủ khách vào lúc ${targetTime} ngày ${targetDateString}.` };
  }
  
  return { isAvailable: true };
}


export async function scheduleAppointment(input: ScheduleAppointmentInput): Promise<ScheduleAppointmentOutput> {
  const flowResult = await scheduleAppointmentFlow(input);
  // The flowResult from scheduleAppointmentFlow should now be the final validated output.
  return flowResult;
}


const scheduleAppointmentFlow = ai.defineFlow(
  {
    name: 'scheduleAppointmentFlowVietnameseEnhanced',
    inputSchema: ScheduleAppointmentInputSchema,
    outputSchema: ScheduleAppointmentOutputSchema,
  },
  async (input) => {
    let currentDateTime = input.currentDateTime;
    if (!input.currentDateTime) {
        console.warn("CurrentDateTime is missing, using server's current time.");
        currentDateTime = new Date().toISOString();
    }

    // Fetch admin-defined appointment rules
    const appointmentRulesFromDB = await getAppointmentRules();
    const appointmentRulesForAI: AppointmentRule[] = appointmentRulesFromDB.map(rule => ({
        id: rule.id,
        name: rule.name,
        keywords: rule.keywords,
        conditions: rule.conditions,
        aiPromptInstructions: rule.aiPromptInstructions,
        createdAt: rule.createdAt?.toISOString(),
        updatedAt: rule.updatedAt?.toISOString(),
    }));


    // Initial AI call to parse user input and understand intent
    let promptInputForNLU: ScheduleAppointmentInput = { 
        ...input, 
        currentDateTime,
        appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
    };
    const { output: nluOutput } = await scheduleAppointmentPrompt(promptInputForNLU);

    if (!nluOutput) {
      return {
        intent: 'error',
        confirmationMessage: "Tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
        requiresAssistance: true,
      };
    }
    
    // If AI determines booking/rescheduling intent AND provides date/time
    if ((nluOutput.intent === 'booked' || nluOutput.intent === 'rescheduled') && 
        nluOutput.appointmentDetails?.date && nluOutput.appointmentDetails?.time &&
        /^\d{4}-\d{2}-\d{2}$/.test(nluOutput.appointmentDetails.date) && // Validate YYYY-MM-DD format
        /^[0-2][0-9]:[0-5][0-9]$/.test(nluOutput.appointmentDetails.time) // Validate HH:MM format
    ) {
      const targetDate = dateFnsParseISO(nluOutput.appointmentDetails.date);
      const targetTime = nluOutput.appointmentDetails.time; // HH:MM

      if (!isValidDate(targetDate)) {
        return {
            intent: 'clarification_needed',
            confirmationMessage: "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).",
            missingInformation: "ngày hợp lệ",
        };
      }

      // Perform real availability check using TypeScript logic
      const availability = await checkRealAvailability(targetDate, targetTime);

      if (availability.isAvailable) {
        // Slot is available, proceed with AI confirmation message generation
        const promptInputForConfirmation: ScheduleAppointmentInput = {
          ...input,
          currentDateTime,
          appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
          availabilityCheckResult: {
            status: "AVAILABLE",
            confirmedSlot: {
              date: nluOutput.appointmentDetails.date,
              time: nluOutput.appointmentDetails.time,
              service: nluOutput.appointmentDetails.service, 
              branch: nluOutput.appointmentDetails.branch,
            }
          },
        };
        // Re-call prompt with availability info to generate final confirmation message
        const {output: confirmedOutput} = await scheduleAppointmentPrompt(promptInputForConfirmation); 
        
        if (!confirmedOutput) {
             return { intent: 'error', confirmationMessage: "Lỗi xác nhận lịch hẹn.", requiresAssistance: true };
        }

        return {
          ...confirmedOutput, // Use AI's generated message
          intent: nluOutput.intent, 
          appointmentDetails: { 
            ...nluOutput.appointmentDetails,
            status: 'booked', 
          },
          originalAppointmentIdToModify: nluOutput.originalAppointmentIdToModify,
        };

      } else {
        // Slot is unavailable, inform AI to generate message with reason/alternatives
        const promptInputForAlternatives: ScheduleAppointmentInput = {
          ...input,
          currentDateTime,
          appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
          availabilityCheckResult: {
            status: "UNAVAILABLE",
            reason: availability.reason,
            suggestedSlots: availability.suggestedSlots, 
          }
        };
         const {output: alternativeOutput} = await scheduleAppointmentPrompt(promptInputForAlternatives);
         if (!alternativeOutput) {
             return { intent: 'error', confirmationMessage: "Lỗi khi gợi ý lịch hẹn thay thế.", requiresAssistance: true };
         }
        return {
            ...alternativeOutput, 
            intent: 'pending_alternatives', 
            suggestedSlots: availability.suggestedSlots || alternativeOutput.suggestedSlots || [], 
        };
      }
    } else if (nluOutput.intent === 'cancelled' || nluOutput.intent === 'clarification_needed' || nluOutput.intent === 'no_action_needed' || nluOutput.intent === 'error') {
         if (nluOutput.intent === 'cancelled' && !nluOutput.originalAppointmentIdToModify && (input.existingAppointments?.length ?? 0) > 0) {
            // If multiple appointments exist and AI didn't specify one for cancellation
            if ((input.existingAppointments?.length ?? 0) > 1) {
                return {
                    intent: 'clarification_needed',
                    confirmationMessage: "Bạn có nhiều lịch hẹn. Bạn muốn hủy lịch hẹn nào cụ thể? (Vui lòng cung cấp ID hoặc mô tả chi tiết).",
                    missingInformation: "lịch hẹn cụ thể cần hủy",
                };
            } else if (input.existingAppointments?.length === 1) {
                 // Auto-select the only existing appointment if not specified
                 nluOutput.originalAppointmentIdToModify = input.existingAppointments[0].appointmentId;
            }
        }
        // Validate specific parts of nluOutput if necessary, e.g., date formats in suggestedSlots
        if (nluOutput.intent === 'pending_alternatives' && nluOutput.suggestedSlots) {
            for (const slot of nluOutput.suggestedSlots) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^[0-2][0-9]:[0-5][0-9]$/.test(slot.time)) {
                    // Attempt to reformat if it looks like a common AI mistake, e.g. "2 PM"
                    try {
                        const parsedTime = Date.parse(`1970/01/01 ${slot.time}`); // Try to parse common time formats
                        if (!isNaN(parsedTime)) {
                            slot.time = dateFnsFormat(new Date(parsedTime), "HH:mm");
                        } else {
                             console.warn("AI suggested invalid time format, requesting clarification:", slot);
                             return {
                                intent: 'clarification_needed',
                                confirmationMessage: "Định dạng giờ gợi ý không hợp lệ. Bạn có thể cung cấp lại giờ mong muốn (HH:MM)?",
                                missingInformation: "giờ hợp lệ (HH:MM)",
                             };
                        }
                    } catch (e) {
                        console.warn("AI suggested invalid time format, requesting clarification:", slot);
                        return {
                            intent: 'clarification_needed',
                            confirmationMessage: "Định dạng giờ gợi ý không hợp lệ. Bạn có thể cung cấp lại giờ mong muốn (HH:MM)?",
                            missingInformation: "giờ hợp lệ (HH:MM)",
                        };
                    }
                }
            }
        }
        return nluOutput;
    } else {
         // Fallback if AI output is not structured as expected for booking/rescheduling
         return {
            intent: 'clarification_needed',
            confirmationMessage: "Tôi chưa hiểu rõ yêu cầu đặt lịch của bạn. Bạn muốn đặt dịch vụ nào, vào ngày giờ nào?",
            missingInformation: "dịch vụ, ngày, giờ",
         };
    }
  }
);
