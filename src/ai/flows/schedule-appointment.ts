
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
import AppointmentModel, { type IAppointment } from '@/models/Appointment.model'; // To check existing appointments
import { parseISO as dateFnsParseISO, getDay, addMinutes, isBefore, format as dateFnsFormat, isValid as isValidDate, compareAsc, addDays, isEqual } from 'date-fns';
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
{{#if availabilityCheckResult.suggestedSlots.length}}
Các khung giờ gợi ý (do hệ thống đề xuất):
{{#each availabilityCheckResult.suggestedSlots}}
- Ngày: {{date}} lúc {{time}}{{#if branch}} tại {{branch}}{{/if}}
{{/each}}
Hãy sử dụng thông tin này để trả lời người dùng một cách tự nhiên.
{{else if (eq availabilityCheckResult.status "UNAVAILABLE")}}
Rất tiếc, hiện tại không có khung giờ nào phù hợp trong thời gian tới. Bạn có muốn thử tìm kiếm vào một ngày khác xa hơn không?
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

async function findNextAvailableSlots(
  originalRequestDate: Date, // The date for which the initial check was made
  originalRequestTime: string, // The HH:MM time for which the initial check failed due to capacity
  appSettings: AppSettings,
  serviceDuration: number, // Duration of the service being booked
  getAppointmentsForDate: (dateString: string) => Promise<Pick<IAppointment, 'date' | 'time' | 'service'>[]>,
  maxSuggestions = 3,
  searchLimitDays = 7 // Search up to 7 days in the future
): Promise<{ date: string; time: string }[]> {
  const suggestions: { date: string; time: string }[] = [];

  for (let dayOffset = 0; dayOffset < searchLimitDays; dayOffset++) {
    const currentDate = addDays(originalRequestDate, dayOffset);
    const currentDateString = dateFnsFormat(currentDate, 'yyyy-MM-dd');
    const currentDayOfWeek = getDay(currentDate);

    let dayIsOff = false;
    let activeWorkingHours = appSettings.workingHours || [];
    let activeNumStaff = appSettings.numberOfStaff || 1;
    // Note: We use the originally requested `serviceDuration` for finding slots for *that* service.
    // A specificDayRule's serviceDuration might imply different types of services are offered that day,
    // but we are trying to fit the user's requested service.

    const specificRuleForDay = appSettings.specificDayRules?.find(rule => rule.date === currentDateString);
    if (specificRuleForDay) {
      if (specificRuleForDay.isOff) dayIsOff = true;
      activeWorkingHours = specificRuleForDay.workingHours && specificRuleForDay.workingHours.length > 0
                            ? specificRuleForDay.workingHours
                            : activeWorkingHours;
      activeNumStaff = specificRuleForDay.numberOfStaff ?? activeNumStaff;
      // If specificDayRule.serviceDurationMinutes is set, it defines the *slots* on that day.
      // If it doesn't match `serviceDuration`, this day might not be suitable for this service.
      // For now, we'll assume a slot is viable if we can fit `serviceDuration`.
    } else {
      if (appSettings.weeklyOffDays?.includes(currentDayOfWeek)) dayIsOff = true;
      if (appSettings.oneTimeOffDates?.includes(currentDateString)) dayIsOff = true;
    }

    if (dayIsOff || activeWorkingHours.length === 0 || activeNumStaff <= 0) {
      continue; // Skip this day
    }

    const existingAppointmentsOnThisDay = await getAppointmentsForDate(currentDateString);

    for (const slotTime of activeWorkingHours) {
      // If it's the original requested day, only consider slots *after* the original target time
      if (dayOffset === 0 && compareAsc(dateFnsParseISO(`${currentDateString}T${slotTime}`), dateFnsParseISO(`${currentDateString}T${originalRequestTime}`)) <= 0) {
        continue;
      }

      const slotStartDateTime = dateFnsParseISO(`${currentDateString}T${slotTime}:00.000Z`);
      if (!isValidDate(slotStartDateTime)) continue;
      
      const slotEndDateTime = addMinutes(slotStartDateTime, serviceDuration);

      let overlappingCount = 0;
      for (const exAppt of existingAppointmentsOnThisDay) {
        const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`);
        if (!isValidDate(exApptStart)) continue;

        let exApptDuration = appSettings.defaultServiceDurationMinutes || 60;
        const exApptSpecificRule = appSettings.specificDayRules?.find(r => r.date === exAppt.date);
        if (exApptSpecificRule && exApptSpecificRule.serviceDurationMinutes) {
            exApptDuration = exApptSpecificRule.serviceDurationMinutes;
        }
        // Future: could use exAppt.service to find its specific duration from product list
        
        const exApptEnd = addMinutes(exApptStart, exApptDuration);

        if (isBefore(slotStartDateTime, exApptEnd) && isBefore(exApptStart, slotEndDateTime)) {
          overlappingCount++;
        }
      }

      if (overlappingCount < activeNumStaff) {
        suggestions.push({ date: currentDateString, time: slotTime });
        if (suggestions.length >= maxSuggestions) {
          return suggestions;
        }
      }
    }
  }
  return suggestions;
}


// Helper function to check availability based on business rules
async function checkRealAvailability(
  targetDateObj: Date, // Date object for the requested day
  targetTime: string, // HH:MM format for the requested time
  serviceDurationMinutesOverride?: number
): Promise<{ 
    isAvailable: boolean; 
    reason?: string; 
    suggestedSlots?: { date: string; time: string; service?: string; branch?: string }[] 
}> {
  const appSettings = await getAppSettings();
  if (!appSettings) {
    return { isAvailable: false, reason: "Không thể tải quy tắc đặt lịch của hệ thống." };
  }

  // Use the service duration from override if provided, else from app settings, else default to 60
  const effectiveServiceDuration = serviceDurationMinutesOverride || appSettings.defaultServiceDurationMinutes || 60;
  
  const targetDateString = dateFnsFormat(targetDateObj, 'yyyy-MM-dd');
  const targetDayOfWeek = getDay(targetDateObj);

  // Determine current day's operational parameters
  let currentWorkingHours = appSettings.workingHours || [];
  let currentNumStaff = appSettings.numberOfStaff || 1;
  // currentDayServiceDuration is not strictly needed here as we use effectiveServiceDuration for the check
  let isDayOff = false;

  const specificRuleForDay = appSettings.specificDayRules?.find(rule => rule.date === targetDateString);

  if (specificRuleForDay) {
    if (specificRuleForDay.isOff) isDayOff = true;
    currentWorkingHours = specificRuleForDay.workingHours && specificRuleForDay.workingHours.length > 0 
                            ? specificRuleForDay.workingHours 
                            : currentWorkingHours;
    currentNumStaff = specificRuleForDay.numberOfStaff ?? currentNumStaff;
    // specificRuleForDay.serviceDurationMinutes would define the "slot size" for that day,
    // but effectiveServiceDuration is what we're trying to fit.
  } else {
    if (appSettings.weeklyOffDays?.includes(targetDayOfWeek)) isDayOff = true;
    if (appSettings.oneTimeOffDates?.includes(currentDateString)) isDayOff = true;
  }

  if (isDayOff) {
    // Try to find alternatives starting from the next day
    const suggestedAlternativeSlots = await findNextAvailableSlots(
        addDays(targetDateObj, 1), // Start search from next day
        "00:00", // Dummy time, not relevant as we search whole days
        appSettings, 
        effectiveServiceDuration, 
        async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service').lean()
    );
    return { 
        isAvailable: false, 
        reason: `Ngày ${targetDateString} là ngày nghỉ.`,
        suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time }))
    };
  }

  if (currentWorkingHours.length === 0 || currentNumStaff <= 0) {
     const suggestedAlternativeSlots = await findNextAvailableSlots(
        addDays(targetDateObj, 1), 
        "00:00",
        appSettings, 
        effectiveServiceDuration, 
        async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service').lean()
    );
    return { 
        isAvailable: false, 
        reason: `Không có giờ làm việc hoặc nhân viên được cấu hình cho ngày ${targetDateString}.`,
        suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time }))
    };
  }

  const requestedStartDateTime = dateFnsParseISO(`${targetDateString}T${targetTime}:00.000Z`);
  if (!isValidDate(requestedStartDateTime)) {
      return { isAvailable: false, reason: `Ngày giờ yêu cầu không hợp lệ: ${targetDateString} ${targetTime}` };
  }

  if (!currentWorkingHours.includes(targetTime)) {
     const suggestedAlternativeSlots = await findNextAvailableSlots(
        targetDateObj, 
        targetTime, // Pass original target time to start search after it on the same day
        appSettings, 
        effectiveServiceDuration, 
        async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service').lean()
    );
     return { 
        isAvailable: false, 
        reason: `Thời gian ${targetTime} không phải là giờ bắt đầu dịch vụ hợp lệ trong ngày ${targetDateString}. Các giờ có thể đặt: ${currentWorkingHours.join(', ')}.`,
        suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time }))
    };
  }

  const appointmentStartDateTime = requestedStartDateTime; // Already parsed and validated
  const appointmentEndDateTime = addMinutes(appointmentStartDateTime, effectiveServiceDuration);

  const existingAppointmentsOnDate = await AppointmentModel.find({
    date: targetDateString,
    status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] }
  });

  let overlappingCount = 0;
  for (const exAppt of existingAppointmentsOnDate) {
    const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`);
    if (!isValidDate(exApptStart)) continue;

    let exApptDuration = appSettings.defaultServiceDurationMinutes || 60;
    const exApptSpecificRule = appSettings.specificDayRules?.find(r => r.date === exAppt.date);
    if (exApptSpecificRule && exApptSpecificRule.serviceDurationMinutes) {
        exApptDuration = exApptSpecificRule.serviceDurationMinutes;
    }
    
    const exApptEnd = addMinutes(exApptStart, exApptDuration);

    if (isBefore(appointmentStartDateTime, exApptEnd) && isBefore(exApptStart, appointmentEndDateTime)) {
      overlappingCount++;
    }
  }

  if (overlappingCount >= currentNumStaff) {
    const suggestedAlternativeSlots = await findNextAvailableSlots(
        targetDateObj, 
        targetTime, // Pass the failed time to search after it
        appSettings, 
        effectiveServiceDuration,
        async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service').lean()
    );
    return { 
        isAvailable: false, 
        reason: `Xin lỗi, đã đủ ${currentNumStaff} nhân viên bận vào lúc ${targetTime} ngày ${targetDateString}.`,
        suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time }))
    };
  }
  
  return { isAvailable: true };
}


export async function scheduleAppointment(input: ScheduleAppointmentInput): Promise<ScheduleAppointmentOutput> {
  const flowResult = await scheduleAppointmentFlow(input);
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
    
    if ((nluOutput.intent === 'booked' || nluOutput.intent === 'rescheduled') && 
        nluOutput.appointmentDetails?.date && nluOutput.appointmentDetails?.time &&
        /^\d{4}-\d{2}-\d{2}$/.test(nluOutput.appointmentDetails.date) && 
        /^[0-2][0-9]:[0-5][0-9]$/.test(nluOutput.appointmentDetails.time)
    ) {
      const targetDate = dateFnsParseISO(nluOutput.appointmentDetails.date); // This should be date object
      const targetTime = nluOutput.appointmentDetails.time; // HH:MM

      if (!isValidDate(targetDate)) {
        return {
            intent: 'clarification_needed',
            confirmationMessage: "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).",
            missingInformation: "ngày hợp lệ",
        };
      }
      
      // Determine service duration for checkRealAvailability. 
      // For now, we'll let checkRealAvailability use its default or settings.
      // Future: if nluOutput.appointmentDetails.service is present,
      // we could look up its duration from a product/service list and pass as override.
      const availability = await checkRealAvailability(targetDate, targetTime, undefined /* serviceDurationMinutesOverride */);

      if (availability.isAvailable) {
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
        const {output: confirmedOutput} = await scheduleAppointmentPrompt(promptInputForConfirmation); 
        
        if (!confirmedOutput) {
             return { intent: 'error', confirmationMessage: "Lỗi xác nhận lịch hẹn.", requiresAssistance: true };
        }

        return {
          ...confirmedOutput,
          intent: nluOutput.intent, 
          appointmentDetails: { 
            ...nluOutput.appointmentDetails,
            status: 'booked', 
          },
          originalAppointmentIdToModify: nluOutput.originalAppointmentIdToModify,
        };

      } else {
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
            if ((input.existingAppointments?.length ?? 0) > 1) {
                return {
                    intent: 'clarification_needed',
                    confirmationMessage: "Bạn có nhiều lịch hẹn. Bạn muốn hủy lịch hẹn nào cụ thể? (Vui lòng cung cấp ID hoặc mô tả chi tiết).",
                    missingInformation: "lịch hẹn cụ thể cần hủy",
                };
            } else if (input.existingAppointments?.length === 1) {
                 nluOutput.originalAppointmentIdToModify = input.existingAppointments[0].appointmentId;
            }
        }
        if (nluOutput.intent === 'pending_alternatives' && nluOutput.suggestedSlots) {
            for (const slot of nluOutput.suggestedSlots) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^[0-2][0-9]:[0-5][0-9]$/.test(slot.time)) {
                    try {
                        const parsedTime = Date.parse(`1970/01/01 ${slot.time}`); 
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
         return {
            intent: 'clarification_needed',
            confirmationMessage: "Tôi chưa hiểu rõ yêu cầu đặt lịch của bạn. Bạn muốn đặt dịch vụ nào, vào ngày giờ nào?",
            missingInformation: "dịch vụ, ngày, giờ",
         };
    }
  }
);

