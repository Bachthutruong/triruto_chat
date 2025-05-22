
// schedule-appointment.ts
'use server';

/**
 * @fileOverview A flow to schedule, reschedule, or cancel appointments using natural language,
 * incorporating business rules and admin-defined appointment rules.
 *
 * - scheduleAppointment - A function that handles the appointment process.
 * Schemas (ScheduleAppointmentInput, ScheduleAppointmentOutput, AppointmentDetailsSchema, AppointmentRuleSchema) are defined in '@/ai/schemas/schedule-appointment-schemas.ts'.
 */

import { ai } from '@/ai/genkit';
import {
  ScheduleAppointmentInputSchema,
  type ScheduleAppointmentInput,
  ScheduleAppointmentOutputSchema,
  type ScheduleAppointmentOutput,
  AppointmentDetailsSchema,
  type AppointmentRule,
} from '@/ai/schemas/schedule-appointment-schemas';
import { getAppSettings, getAppointmentRules, getBranches, getProductById, getAllProducts } from '@/app/actions';
import type { AppSettings, SpecificDayRule, Branch, ProductItem } from '@/lib/types';
import AppointmentModel, { type IAppointment } from '@/models/Appointment.model';
import { parseISO as dateFnsParseISO, getDay, addMinutes, isBefore, format as dateFnsFormat, isValid as isValidDate, compareAsc, addDays, isEqual } from 'date-fns';
import mongoose from 'mongoose';


export const scheduleAppointmentPrompt = ai.definePrompt({
  name: 'scheduleAppointmentPromptVietnameseEnhanced',
  input: { schema: ScheduleAppointmentInputSchema },
  output: { schema: ScheduleAppointmentOutputSchema },
  prompt: `Bạn là một trợ lý AI cho một salon/spa, giúp người dùng quản lý lịch hẹn bằng tiếng Việt.
Số điện thoại của người dùng: {{{phoneNumber}}}. ID người dùng: {{{userId}}}. Ngày/giờ hiện tại: {{{currentDateTime}}}.

{{#if availableBranches.length}}
**Các chi nhánh có thể đặt lịch:**
{{#each availableBranches}}
- {{{this}}}
{{/each}}
Nếu người dùng chưa chọn chi nhánh và có nhiều chi nhánh, hãy hỏi họ muốn đặt ở chi nhánh nào. Nếu chỉ có một chi nhánh, bạn có thể ngầm định chọn chi nhánh đó.
{{/if}}

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
  {{else}}
    {{#if availabilityCheckResult.isStatusUnavailable}}
    Rất tiếc, hiện tại không có khung giờ nào phù hợp trong thời gian tới. Bạn có muốn thử tìm kiếm vào một ngày khác xa hơn không?
    {{/if}}
  {{/if}}
{{#if availabilityCheckResult.confirmedSlot}}
Khung giờ được xác nhận (nếu có thể đặt): Ngày {{availabilityCheckResult.confirmedSlot.date}} lúc {{availabilityCheckResult.confirmedSlot.time}}{{#if availabilityCheckResult.confirmedSlot.branch}} tại {{availabilityCheckResult.confirmedSlot.branch}}{{/if}}.
Hãy sử dụng thông tin này để trả lời người dùng một cách tự nhiên.
{{/if}}
{{/if}}

{{#if chatHistory}}
Lịch sử trò chuyện (mới nhất ở cuối):
{{{chatHistory}}}
Dựa vào lịch sử này và tin nhắn mới nhất của người dùng để hiểu ngữ cảnh. Lưu ý: Bạn PHẢI GHI NHỚ thông tin dịch vụ, ngày và giờ mà người dùng đã cung cấp từ trước trong lịch sử này, KHÔNG được hỏi lại các thông tin họ đã cung cấp.
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

Các dịch vụ có sẵn (tham khảo): Cắt tóc, Tạo kiểu, Nhuộm tóc, Làm móng tay, Làm móng chân, Chăm sóc da mặt, Massage, Gội đầu dưỡng sinh. (Đây chỉ là gợi ý, bạn hãy dựa vào thông tin sản phẩm/dịch vụ được cung cấp trong products nếu có).

Nhiệm vụ của bạn:
1.  **Hiểu và duy trì ngữ cảnh**: Bạn PHẢI GHI NHỚ và SỬ DỤNG tất cả thông tin liên quan từ lịch sử trò chuyện. Nếu người dùng đã đề cập "cắt tóc" hoặc bất kỳ dịch vụ nào từ trước, ĐỪNG hỏi lại về dịch vụ. Tương tự, nếu họ đã cung cấp ngày hoặc giờ, GHI NHỚ thông tin đó. Chỉ hỏi về thông tin mà họ CHƯA cung cấp.

2.  **Trích xuất và tích lũy thông tin**: Nếu userInput là từ người dùng, hãy kết hợp thông tin trong tin nhắn mới với thông tin đã biết trước đó trong lịch sử trò chuyện để xây dựng chi tiết đặt lịch đầy đủ. Hãy tích lũy thông tin theo thời gian. Ví dụ, nếu người dùng trước đây đã nói "cắt tóc", và giờ họ nói "ngày mai lúc 3 giờ chiều", thì tất cả thông tin dịch vụ và thời gian đều đã được thu thập.

3.  **Khi thu thập đủ thông tin**: Một khi bạn đã thu thập đầy đủ thông tin cần thiết (dịch vụ, ngày, giờ, và chi nhánh nếu cần), hãy xác nhận tất cả thông tin cùng một lúc và đặt intent: "booked". KHÔNG cần phải xác nhận từng thông tin một.

4.  **Xử lý chỉ dẫn từ hệ thống**:
    *   Nếu userInput là "Hệ thống đã xác nhận lịch hẹn..." VÀ availabilityCheckResult.status là "AVAILABLE" VÀ có availabilityCheckResult.confirmedSlot: Tạo confirmationMessage xác nhận lịch hẹn đã được đặt thành công cho khung giờ đó. Đặt intent: "booked" (hoặc "rescheduled" nếu originalAppointmentIdToModify có). Đặt appointmentDetails với thông tin từ confirmedSlot.
    *   Nếu userInput là "Lịch yêu cầu không trống..." VÀ availabilityCheckResult.status là "UNAVAILABLE": Tạo confirmationMessage thông báo lịch không trống, giải thích ngắn gọn dựa trên availabilityCheckResult.reason. Nếu có availabilityCheckResult.suggestedSlots, hãy đề xuất chúng cho người dùng. Đặt intent: "pending_alternatives".

5.  **Giải quyết thiếu thông tin**: Nếu sau khi xem xét lịch sử trò chuyện và tin nhắn mới, vẫn còn thiếu thông tin cần thiết:
    *   intent: "clarification_needed"
    *   Chỉ hỏi về thông tin còn thiếu, KHÔNG hỏi lại thông tin đã biết.
    *   Ví dụ, nếu đã biết dịch vụ là "cắt tóc" nhưng chưa biết thời gian, chỉ hỏi "Bạn muốn đặt cắt tóc vào ngày và giờ nào?"

6.  **Đảm bảo ghi nhớ thông tin đã cung cấp**:
    *   Dịch vụ: Nếu người dùng đã nói "cắt tóc", đừng bao giờ hỏi lại "bạn muốn đặt dịch vụ gì?". 
    *   Ngày giờ: Nếu người dùng đã nói "ngày mai lúc 3h chiều", luôn nhớ rằng đó là thông tin về ngày và giờ.
    *   Tích lũy thông tin qua nhiều tin nhắn - nếu tin nhắn đầu tiên nói về dịch vụ, tin nhắn thứ hai nói về ngày, thì cả hai thông tin đều phải được tích hợp vào yêu cầu cuối cùng.

7.  **Trả lời câu hỏi chung**: Nếu người dùng chỉ hỏi thông tin chung (ví dụ: "Spa mở cửa mấy giờ?", "Có dịch vụ X không?") và không có ý định đặt/đổi/hủy lịch rõ ràng, hãy trả lời câu hỏi đó và đặt intent: "no_action_needed".

8.  **Lỗi/Cần hỗ trợ**: Nếu yêu cầu quá phức tạp, không liên quan, hoặc có lỗi xảy ra, đặt intent: "error" hoặc requiresAssistance: true.

Các trường phản hồi:
- intent: "booked", "rescheduled", "cancelled", "pending_alternatives", "clarification_needed", "error", "no_action_needed".
- confirmationMessage: Tin nhắn thân thiện của bạn gửi cho người dùng bằng tiếng Việt.
- appointmentDetails: Đối tượng với {service, date (YYYY-MM-DD), time (HH:MM), branch, status}.
- originalAppointmentIdToModify: ID của lịch hẹn đang được thay đổi/hủy.
- suggestedSlots: Mảng các {date (YYYY-MM-DD), time (HH:MM), branch} cho "pending_alternatives".
- missingInformation: Chuỗi mô tả những gì cần thiết cho "clarification_needed" bằng tiếng Việt.
- requiresAssistance: Boolean.

Hãy súc tích và hữu ích. Luôn dùng định dạng YYYY-MM-DD cho date và HH:MM (24 giờ) cho time trong appointmentDetails và suggestedSlots.
Nếu userInput là "đặt lịch 2h chiều ngày mai", và currentDateTime là "2024-07-25T10:00:00Z", thì ngày phải là "2024-07-26" và giờ là "14:00".
`,
});

async function findNextAvailableSlots(
  originalRequestDate: Date,
  originalRequestTime: string,
  appSettings: AppSettings, 
  serviceDuration: number, 
  getAppointmentsForDate: (dateString: string, branchId?: string) => Promise<Pick<IAppointment, 'date' | 'time' | 'service' | 'branchId'>[]>,
  maxSuggestions = 3,
  searchLimitDays = 7
): Promise<{ date: string; time: string; branch?: string }[]> {
  const suggestions: { date: string; time: string; branch?: string }[] = [];
  let currentDateToSearch = new Date(originalRequestDate);

  for (let dayOffset = 0; dayOffset < searchLimitDays; dayOffset++) {
    const currentDate = addDays(currentDateToSearch, dayOffset);
    const currentDayString = dateFnsFormat(currentDate, 'yyyy-MM-dd');
    const currentDayOfWeek = getDay(currentDate);

    let dayIsOff = false;
    let activeWorkingHours = appSettings.workingHours || [];
    let activeNumStaff = appSettings.numberOfStaff || 1;

    const specificRuleForDay = appSettings.specificDayRules?.find(rule => rule.date === currentDayString);
    if (specificRuleForDay) {
      if (specificRuleForDay.isOff) dayIsOff = true;
      activeWorkingHours = specificRuleForDay.workingHours && specificRuleForDay.workingHours.length > 0
        ? specificRuleForDay.workingHours
        : activeWorkingHours;
      activeNumStaff = specificRuleForDay.numberOfStaff ?? activeNumStaff;
    } else {
      if (appSettings.weeklyOffDays?.includes(currentDayOfWeek)) dayIsOff = true;
      if (appSettings.oneTimeOffDates?.includes(currentDayString)) dayIsOff = true;
    }

    if (dayIsOff || activeWorkingHours.length === 0 || activeNumStaff <= 0) {
      continue;
    }

    const existingAppointmentsOnThisDay = await getAppointmentsForDate(currentDayString);

    for (const slotTime of activeWorkingHours) {
      // Skip past slots on the original request day
      if (dayOffset === 0 && isEqual(currentDate, originalRequestDate) && compareAsc(dateFnsParseISO(`${currentDayString}T${slotTime}`), dateFnsParseISO(`${currentDayString}T${originalRequestTime}`)) < 0) {
        continue;
      }

      const slotStartDateTime = dateFnsParseISO(`${currentDayString}T${slotTime}:00.000Z`);
      if (!isValidDate(slotStartDateTime)) continue;

      const slotEndDateTime = addMinutes(slotStartDateTime, serviceDuration);

      let overlappingCount = 0;
      for (const exAppt of existingAppointmentsOnThisDay) {
        const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`);
        if (!isValidDate(exApptStart)) continue;

        // Determine duration for the existing appointment
        let exApptDuration = appSettings.defaultServiceDurationMinutes || 60;
        const exApptSpecificRule = appSettings.specificDayRules?.find(r => r.date === exAppt.date);
        if (exApptSpecificRule && exApptSpecificRule.serviceDurationMinutes) {
          exApptDuration = exApptSpecificRule.serviceDurationMinutes;
        }
        // Potentially fetch product-specific duration if needed in future, for now using global/daily override
        const exApptEnd = addMinutes(exApptStart, exApptDuration);

        // Check for overlap
        if (isBefore(slotStartDateTime, exApptEnd) && isBefore(exApptStart, slotEndDateTime)) {
          overlappingCount++;
        }
      }

      if (overlappingCount < activeNumStaff) {
        suggestions.push({ date: currentDayString, time: slotTime });
        if (suggestions.length >= maxSuggestions) {
          return suggestions;
        }
      }
    }
    if (suggestions.length >= maxSuggestions) {
      return suggestions;
    }
  }
  return suggestions;
}


export async function checkRealAvailability(
  targetDateObj: Date,
  targetTime: string,
  appSettings: AppSettings,
  serviceDurationMinutesOverride?: number
): Promise<{
  isAvailable: boolean;
  reason?: string;
  suggestedSlots?: { date: string; time: string; service?: string; branch?: string }[]
}> {

  const effectiveServiceDuration = serviceDurationMinutesOverride || appSettings.defaultServiceDurationMinutes || 60;

  const targetDateString = dateFnsFormat(targetDateObj, 'yyyy-MM-dd');
  const targetDayOfWeek = getDay(targetDateObj);

  let currentWorkingHours = appSettings.workingHours || [];
  let currentNumStaff = appSettings.numberOfStaff || 1;
  let isDayOff = false;

  const specificRuleForDay = appSettings.specificDayRules?.find(rule => rule.date === targetDateString);

  if (specificRuleForDay) {
    if (specificRuleForDay.isOff) isDayOff = true;
    currentWorkingHours = specificRuleForDay.workingHours && specificRuleForDay.workingHours.length > 0
      ? specificRuleForDay.workingHours
      : currentWorkingHours;
    currentNumStaff = specificRuleForDay.numberOfStaff ?? currentNumStaff;
  } else {
    if (appSettings.weeklyOffDays?.includes(targetDayOfWeek)) isDayOff = true;
    if (appSettings.oneTimeOffDates?.includes(targetDateString)) isDayOff = true;
  }

  if (isDayOff) {
    const suggestedAlternativeSlots = await findNextAvailableSlots(
      addDays(targetDateObj, 1), // Start searching from the next day
      "00:00", // Start search from beginning of the day
      appSettings,
      effectiveServiceDuration,
      async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service branchId').lean()
    );
    return {
      isAvailable: false,
      reason: `Ngày ${targetDateString} là ngày nghỉ.`,
      suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time, branch: s.branch }))
    };
  }

  if (currentWorkingHours.length === 0 || currentNumStaff <= 0) {
    const suggestedAlternativeSlots = await findNextAvailableSlots(
      addDays(targetDateObj, 1),
      "00:00",
      appSettings,
      effectiveServiceDuration,
      async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service branchId').lean()
    );
    return {
      isAvailable: false,
      reason: `Không có giờ làm việc hoặc nhân viên được cấu hình cho ngày ${targetDateString}.`,
      suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time, branch: s.branch }))
    };
  }

  const requestedStartDateTime = dateFnsParseISO(`${targetDateString}T${targetTime}:00.000Z`);
  if (!isValidDate(requestedStartDateTime)) {
    return { isAvailable: false, reason: `Ngày giờ yêu cầu không hợp lệ: ${targetDateString} ${targetTime}` };
  }

  if (!currentWorkingHours.includes(targetTime)) {
     const suggestedAlternativeSlots = await findNextAvailableSlots(
      targetDateObj, // Start search from original request day
      targetTime,    // And original request time
      appSettings,
      effectiveServiceDuration,
      async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service branchId').lean()
    );
    return {
      isAvailable: false,
      reason: `Thời gian ${targetTime} không phải là giờ bắt đầu dịch vụ hợp lệ trong ngày ${targetDateString}. Các giờ có thể đặt: ${currentWorkingHours.join(', ')}.`,
      suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time, branch: s.branch }))
    };
  }

  const appointmentStartDateTime = requestedStartDateTime;
  const appointmentEndDateTime = addMinutes(appointmentStartDateTime, effectiveServiceDuration);

  const existingAppointmentsOnDate = await AppointmentModel.find({
    date: targetDateString,
    status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] }
  });

  let overlappingCount = 0;
  for (const exAppt of existingAppointmentsOnDate) {
    const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`);
    if (!isValidDate(exApptStart)) continue;
    
    let exApptDuration = appSettings.defaultServiceDurationMinutes || 60; // Default
    const exApptSpecificRule = appSettings.specificDayRules?.find(r => r.date === exAppt.date);
    if (exApptSpecificRule && exApptSpecificRule.serviceDurationMinutes) {
      exApptDuration = exApptSpecificRule.serviceDurationMinutes;
    }
    // Add logic here to fetch product-specific duration if Appointment model links to Product and product has serviceDuration
    const exApptEnd = addMinutes(exApptStart, exApptDuration);

    // Check for overlap
    if (isBefore(appointmentStartDateTime, exApptEnd) && isBefore(exApptStart, appointmentEndDateTime)) {
      overlappingCount++;
    }
  }

  if (overlappingCount >= currentNumStaff) {
    const suggestedAlternativeSlots = await findNextAvailableSlots(
      targetDateObj,
      targetTime,
      appSettings,
      effectiveServiceDuration,
      async (dateStr: string) => AppointmentModel.find({ date: dateStr, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } }, 'date time service branchId').lean()
    );
    return {
      isAvailable: false,
      reason: `Xin lỗi, đã đủ ${currentNumStaff} nhân viên bận vào lúc ${targetTime} ngày ${targetDateString}.`,
      suggestedSlots: suggestedAlternativeSlots.map(s => ({ date: s.date, time: s.time, branch: s.branch }))
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

    const appSettings = await getAppSettings();
    if (!appSettings) {
      return {
        intent: 'error',
        confirmationMessage: "Không thể tải cài đặt hệ thống để kiểm tra lịch. Vui lòng thử lại sau.",
        requiresAssistance: true,
      };
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

    const activeBranches = await getBranches(true);
    const branchNamesForAI = activeBranches.map(b => b.name);

    // First call to AI for NLU - understanding user intent and extracting details
    let promptInputForNLU: ScheduleAppointmentInput = {
      ...input,
      currentDateTime,
      appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
      availableBranches: branchNamesForAI.length > 0 ? branchNamesForAI : undefined,
      availabilityCheckResult: undefined, // No check result for the first NLU call
    };
    const { output: nluOutput } = await scheduleAppointmentPrompt(promptInputForNLU);

    if (!nluOutput) {
      return {
        intent: 'error',
        confirmationMessage: "Tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
        requiresAssistance: true,
      };
    }

    // If AI extracted details for booking/rescheduling and service is present
    if ((nluOutput.intent === 'booked' || nluOutput.intent === 'rescheduled') &&
      nluOutput.appointmentDetails?.date && nluOutput.appointmentDetails?.time &&
      /^\d{4}-\d{2}-\d{2}$/.test(nluOutput.appointmentDetails.date) &&
      /^[0-2][0-9]:[0-5][0-9]$/.test(nluOutput.appointmentDetails.time) &&
      nluOutput.appointmentDetails.service // Ensure service is extracted
    ) {
      const targetDate = dateFnsParseISO(nluOutput.appointmentDetails.date);
      const targetTime = nluOutput.appointmentDetails.time;
      // const serviceName = nluOutput.appointmentDetails.service; // Service name extracted by AI

      if (!isValidDate(targetDate)) {
        // This scenario ideally should be handled by AI NLU by asking for clarification
        return {
          intent: 'clarification_needed',
          confirmationMessage: "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).",
          missingInformation: "ngày hợp lệ",
        };
      }
      
      // Check real availability using global settings (as per current logic)
      const availability = await checkRealAvailability(
        targetDate, 
        targetTime, 
        appSettings,
        appSettings.defaultServiceDurationMinutes // Pass global default duration
      );

      if (availability.isAvailable) {
        // Slot is available, prepare for final confirmation message
        const promptInputForFinalConfirmation: ScheduleAppointmentInput = {
          ...input, // Keep original context like chat history, user ID
          userInput: "Hệ thống đã xác nhận lịch hẹn. Hãy tạo tin nhắn xác nhận cuối cùng cho người dùng.", // System instruction
          currentDateTime,
          appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
          availableBranches: branchNamesForAI.length > 0 ? branchNamesForAI : undefined,
          availabilityCheckResult: {
            status: "AVAILABLE",
            confirmedSlot: { // Pass the confirmed slot details for AI to use in message
              date: nluOutput.appointmentDetails.date,
              time: nluOutput.appointmentDetails.time,
              service: nluOutput.appointmentDetails.service,
              branch: nluOutput.appointmentDetails.branch, // Branch from NLU if any
            },
            isStatusUnavailable: false,
          },
        };
        const { output: finalConfirmationOutput } = await scheduleAppointmentPrompt(promptInputForFinalConfirmation);

        if (!finalConfirmationOutput) {
          return { intent: 'error', confirmationMessage: "Lỗi tạo tin nhắn xác nhận lịch hẹn.", requiresAssistance: true };
        }
        // Return the confirmation from AI, along with AI's extracted details
        return {
          ...finalConfirmationOutput, // Contains intent: "booked" and confirmationMessage from AI
          appointmentDetails: { // Ensure details are from original NLU or confirmed slot
            ...nluOutput.appointmentDetails,
            status: 'booked', // Set status to booked by system
          },
          originalAppointmentIdToModify: nluOutput.originalAppointmentIdToModify, // Pass through if rescheduling
        };

      } else {
        // Slot is NOT available, prepare to inform user and suggest alternatives
        const promptInputForAlternatives: ScheduleAppointmentInput = {
          ...input,
          userInput: "Lịch yêu cầu không trống. Hãy thông báo cho người dùng và đề xuất các khung giờ sau từ suggestedSlots.", // System instruction
          currentDateTime,
          appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
          availableBranches: branchNamesForAI.length > 0 ? branchNamesForAI : undefined,
          availabilityCheckResult: { // Pass the unavailability result
            status: "UNAVAILABLE",
            reason: availability.reason,
            suggestedSlots: availability.suggestedSlots, // System suggested slots
            isStatusUnavailable: true,
          }
        };
        const { output: alternativeOutput } = await scheduleAppointmentPrompt(promptInputForAlternatives);
        if (!alternativeOutput) {
          return { intent: 'error', confirmationMessage: "Lỗi khi gợi ý lịch hẹn thay thế.", requiresAssistance: true };
        }
        // Return AI's response (which should include suggested slots)
        return {
          ...alternativeOutput, // Contains intent: "pending_alternatives" and confirmationMessage
          suggestedSlots: availability.suggestedSlots || alternativeOutput.suggestedSlots || [], // Ensure suggestedSlots are passed
        };
      }
    } else if (nluOutput.intent === 'cancelled' || nluOutput.intent === 'clarification_needed' || nluOutput.intent === 'no_action_needed' || nluOutput.intent === 'error') {
      // Handle cases where NLU doesn't result in booking or needs more info
      if (nluOutput.intent === 'cancelled' && !nluOutput.originalAppointmentIdToModify && (input.existingAppointments?.length ?? 0) > 0) {
        // If AI wants to cancel but didn't pick which one, and user has appointments
        if ((input.existingAppointments?.length ?? 0) > 1) {
          return {
            intent: 'clarification_needed',
            confirmationMessage: "Bạn có nhiều lịch hẹn. Bạn muốn hủy lịch hẹn nào cụ thể? (Vui lòng cung cấp ID hoặc mô tả chi tiết).",
            missingInformation: "lịch hẹn cụ thể cần hủy",
          };
        } else if (input.existingAppointments?.length === 1) {
          // If only one appointment, AI can assume to cancel that one
          nluOutput.originalAppointmentIdToModify = input.existingAppointments[0].appointmentId;
        }
      }
      // Ensure suggestedSlots time format is correct if AI generated them in NLU (less likely now with system suggestions)
      if (nluOutput.intent === 'pending_alternatives' && nluOutput.suggestedSlots) {
        for (const slot of nluOutput.suggestedSlots) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^[0-2][0-9]:[0-5][0-9]$/.test(slot.time)) {
            // This is a safeguard, but system-generated slots should already be in correct format.
            // If AI itself suggests slots initially, they might need reformatting or clarification.
            try {
              const parsedTime = Date.parse(`1970/01/01 ${slot.time}`); // Attempt to parse common time formats
              if (!isNaN(parsedTime)) {
                slot.time = dateFnsFormat(new Date(parsedTime), "HH:mm");
              } else {
                console.warn("AI suggested invalid time format in initial NLU, requesting clarification:", slot);
                return { // Ask user to clarify the time
                  intent: 'clarification_needed',
                  confirmationMessage: "Định dạng giờ gợi ý không hợp lệ. Bạn có thể cung cấp lại giờ mong muốn (HH:MM)?",
                  missingInformation: "giờ hợp lệ (HH:MM)",
                };
              }
            } catch (e) {
              console.warn("AI suggested invalid time format in initial NLU, requesting clarification:", slot);
               return {
                intent: 'clarification_needed',
                confirmationMessage: "Định dạng giờ gợi ý không hợp lệ. Bạn có thể cung cấp lại giờ mong muốn (HH:MM)?",
                missingInformation: "giờ hợp lệ (HH:MM)",
              };
            }
          }
        }
      }
      return nluOutput; // Return NLU output directly for these intents
    } else {
      // Fallback if NLU output is unexpected or details are missing for booking
      return {
        intent: 'clarification_needed',
        confirmationMessage: "Tôi chưa hiểu rõ yêu cầu đặt lịch của bạn. Bạn muốn đặt dịch vụ nào, vào ngày giờ nào?",
        missingInformation: "dịch vụ, ngày, giờ",
      };
    }
  }
);

