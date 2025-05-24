// schedule-appointment.ts
'use server';
/**
 * @fileOverview A flow to schedule, reschedule, or cancel appointments using natural language,
 * incorporating business rules (global and service-specific) and admin-defined appointment rules.
 */
import { ai } from '@/ai/genkit';
import { ScheduleAppointmentInputSchema, ScheduleAppointmentOutputSchema, } from '@/ai/schemas/schedule-appointment-schemas';
import { getAppSettings, getAppointmentRules, getBranches } from '@/app/actions'; // Added getProductById
import AppointmentModel from '@/models/Appointment.model';
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
  {{#if availabilityCheckResult.isServiceNotSchedulable}}
  Xin lỗi, dịch vụ này hiện không thể đặt lịch. Bạn có muốn chọn dịch vụ khác không?
  {{else if availabilityCheckResult.suggestedSlots.length}}
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
Khung giờ được xác nhận (nếu có thể đặt): Dịch vụ "{{availabilityCheckResult.confirmedSlot.service}}" vào ngày {{availabilityCheckResult.confirmedSlot.date}} lúc {{availabilityCheckResult.confirmedSlot.time}}{{#if availabilityCheckResult.confirmedSlot.branch}} tại {{availabilityCheckResult.confirmedSlot.branch}}{{/if}}. Thời gian thực hiện dự kiến: {{availabilityCheckResult.confirmedSlot.durationMinutes}} phút.
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
**Các Quy tắc Đặt lịch Tự động (do Admin cấu hình):**
{{#each appointmentRules}}
- **Tên Quy tắc:** {{name}}
  **Từ khóa kích hoạt:** {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  **Điều kiện áp dụng:** {{conditions}}
  **Hướng dẫn cho AI:** {{{aiPromptInstructions}}}
---
{{/each}}
Hãy xem xét các quy tắc này khi phân tích yêu cầu đặt lịch. Nếu từ khóa của người dùng khớp với một quy tắc, hãy ưu tiên áp dụng hướng dẫn của quy tắc đó.
{{/if}}

Nhiệm vụ của bạn:
1.  **Hiểu và duy trì ngữ cảnh**: Bạn PHẢI GHI NHỚ và SỬ DỤNG tất cả thông tin liên quan từ lịch sử trò chuyện. Nếu người dùng đã đề cập "cắt tóc" hoặc bất kỳ dịch vụ nào từ trước, ĐỪNG hỏi lại về dịch vụ. Tương tự, nếu họ đã cung cấp ngày hoặc giờ, GHI NHỚ thông tin đó. Chỉ hỏi về thông tin mà họ CHƯA cung cấp.

2.  **Trích xuất và tích lũy thông tin**: Nếu userInput là từ người dùng, hãy kết hợp thông tin trong tin nhắn mới với thông tin đã biết trước đó trong lịch sử trò chuyện để xây dựng chi tiết đặt lịch đầy đủ. Hãy tích lũy thông tin theo thời gian.

3.  **Khi thu thập đủ thông tin (dịch vụ, ngày, giờ, và chi nhánh nếu cần)**: Đặt intent: "extracted_details_for_booking". KHÔNG cần phải xác nhận từng thông tin một. Hệ thống sẽ kiểm tra lịch và phản hồi lại cho bạn.

4.  **Xử lý chỉ dẫn từ hệ thống (khi userInput bắt đầu bằng "Hệ thống đã..." hoặc "Lịch yêu cầu...")**:
    *   Nếu userInput là "Hệ thống đã xác nhận lịch hẹn..." VÀ availabilityCheckResult.status là "AVAILABLE" VÀ có availabilityCheckResult.confirmedSlot: Tạo confirmationMessage xác nhận lịch hẹn đã được đặt thành công. Đặt intent: "booked" (hoặc "rescheduled"). Đặt appointmentDetails với thông tin từ confirmedSlot.
    *   Nếu userInput là "Lịch yêu cầu không trống..." VÀ availabilityCheckResult.status là "UNAVAILABLE": Tạo confirmationMessage thông báo lịch không trống, giải thích ngắn gọn dựa trên availabilityCheckResult.reason. Nếu có availabilityCheckResult.suggestedSlots, hãy đề xuất chúng. Đặt intent: "pending_alternatives".
    *   Nếu userInput là "Dịch vụ không thể đặt lịch...": Thông báo cho người dùng và gợi ý họ chọn dịch vụ khác. Đặt intent: "clarification_needed", missingInformation: "dịch vụ có thể đặt lịch".

5.  **Giải quyết thiếu thông tin**: Nếu sau khi xem xét lịch sử trò chuyện và tin nhắn mới, vẫn còn thiếu thông tin cần thiết (dịch vụ, ngày, giờ):
    *   intent: "clarification_needed"
    *   Chỉ hỏi về thông tin còn thiếu, KHÔNG hỏi lại thông tin đã biết.

6.  **Trả lời câu hỏi chung**: Nếu người dùng chỉ hỏi thông tin chung và không có ý định đặt/đổi/hủy lịch rõ ràng, hãy trả lời câu hỏi đó và đặt intent: "no_action_needed".

7.  **Lỗi/Cần hỗ trợ**: Nếu yêu cầu quá phức tạp, không liên quan, hoặc có lỗi xảy ra, đặt intent: "error" hoặc requiresAssistance: true.

Các trường phản hồi:
- intent: "extracted_details_for_booking", "booked", "rescheduled", "cancelled", "pending_alternatives", "clarification_needed", "error", "no_action_needed".
- confirmationMessage: Tin nhắn thân thiện của bạn gửi cho người dùng bằng tiếng Việt.
- appointmentDetails: Đối tượng với {service, date (YYYY-MM-DD), time (HH:MM), branch, status}.
- originalAppointmentIdToModify: ID của lịch hẹn đang được thay đổi/hủy.
- suggestedSlots: Mảng các {date (YYYY-MM-DD), time (HH:MM), branch} cho "pending_alternatives".
- missingInformation: Chuỗi mô tả những gì cần thiết cho "clarification_needed" bằng tiếng Việt.
- requiresAssistance: Boolean.

Luôn dùng định dạng YYYY-MM-DD cho date và HH:MM (24 giờ) cho time trong appointmentDetails và suggestedSlots.
Nếu userInput là "đặt lịch 2h chiều ngày mai", và currentDateTime là "2024-07-25T10:00:00Z", thì date phải là "2024-07-26" và time là "14:00".
`,
});
async function findNextAvailableSlots(originalRequestDate, originalRequestTime, // The time that was found to be unavailable
serviceName, effectiveRules, // Rules specific to the service
serviceDuration, globalAppSettings, // For global off-days, etc.
branchId, // Branch context for filtering existing appointments
maxSuggestions = 3, searchLimitDays = 7) {
    var _a, _b, _c, _d, _e;
    const suggestions = [];
    let currentDateToSearch = new Date(originalRequestDate);
    for (let dayOffset = 0; dayOffset < searchLimitDays; dayOffset++) {
        const currentDate = addDays(currentDateToSearch, dayOffset);
        const currentDayString = dateFnsFormat(currentDate, 'yyyy-MM-dd');
        const currentDayOfWeek = getDay(currentDate);
        // Determine if the day is off using service-specific rules first, then global
        let dayIsOff = false;
        let activeWorkingHours = effectiveRules.workingHours; // Use service-specific working hours
        let activeNumStaff = effectiveRules.numberOfStaff; // Use service-specific staff count
        // Check service-specific specificDayRules
        const serviceSpecificRuleForDay = (_a = effectiveRules.specificDayRules) === null || _a === void 0 ? void 0 : _a.find(rule => rule.date === currentDayString);
        if (serviceSpecificRuleForDay) {
            if (serviceSpecificRuleForDay.isOff)
                dayIsOff = true;
            activeWorkingHours = serviceSpecificRuleForDay.workingHours && serviceSpecificRuleForDay.workingHours.length > 0
                ? serviceSpecificRuleForDay.workingHours
                : activeWorkingHours;
            activeNumStaff = (_b = serviceSpecificRuleForDay.numberOfStaff) !== null && _b !== void 0 ? _b : activeNumStaff;
        }
        else {
            // Fallback to service's general weekly off days
            if ((_c = effectiveRules.weeklyOffDays) === null || _c === void 0 ? void 0 : _c.includes(currentDayOfWeek))
                dayIsOff = true;
            // Fallback to service's general one-time off dates
            if ((_d = effectiveRules.oneTimeOffDates) === null || _d === void 0 ? void 0 : _d.includes(currentDayString))
                dayIsOff = true;
        }
        // If still not determined as off by service rules, check global AppSettings for one-time off dates (holidays etc)
        if (!dayIsOff && ((_e = globalAppSettings.oneTimeOffDates) === null || _e === void 0 ? void 0 : _e.includes(currentDayString)))
            dayIsOff = true;
        if (dayIsOff || activeWorkingHours.length === 0 || activeNumStaff <= 0) {
            continue;
        }
        const appointmentQuery = { date: currentDayString, service: serviceName, status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] } };
        if (branchId)
            appointmentQuery.branchId = new mongoose.Types.ObjectId(branchId);
        const existingAppointmentsOnThisDayForService = await AppointmentModel.find(appointmentQuery).lean();
        for (const slotTime of activeWorkingHours) {
            if (dayOffset === 0 && isEqual(currentDate, originalRequestDate) && compareAsc(dateFnsParseISO(`${currentDayString}T${slotTime}`), dateFnsParseISO(`${currentDayString}T${originalRequestTime}`)) <= 0) {
                continue; // Skip current or past slots on the original request day
            }
            const slotStartDateTime = dateFnsParseISO(`${currentDayString}T${slotTime}:00.000Z`);
            if (!isValidDate(slotStartDateTime))
                continue;
            const slotEndDateTime = addMinutes(slotStartDateTime, serviceDuration);
            let overlappingCount = 0;
            for (const exAppt of existingAppointmentsOnThisDayForService) {
                const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`);
                if (!isValidDate(exApptStart))
                    continue;
                // Determine duration for the existing appointment (important: for *that* service)
                // This part might need to fetch that specific product's duration if it's variable and not stored on appt.
                // For simplicity here, assume all appointments for this service use `serviceDuration`.
                const exApptEnd = addMinutes(exApptStart, serviceDuration);
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
export async function checkRealAvailability(targetDateObj, targetTime, globalAppSettings, // Global settings for fallbacks (like OOO messages) and overall structure
serviceName, // Name of the service being booked
effectiveRules, // Merged rules specific to THIS service
serviceDuration, // Duration of THIS service
branchId // Optional branch context
) {
    var _a, _b, _c, _d, _e;
    const targetDateString = dateFnsFormat(targetDateObj, 'yyyy-MM-dd');
    const targetDayOfWeek = getDay(targetDateObj);
    // Use service-specific rules first
    let currentWorkingHours = effectiveRules.workingHours;
    let currentNumStaff = effectiveRules.numberOfStaff;
    let isDayOff = false;
    const serviceSpecificRuleForDay = (_a = effectiveRules.specificDayRules) === null || _a === void 0 ? void 0 : _a.find(rule => rule.date === targetDateString);
    if (serviceSpecificRuleForDay) {
        if (serviceSpecificRuleForDay.isOff)
            isDayOff = true;
        currentWorkingHours = serviceSpecificRuleForDay.workingHours && serviceSpecificRuleForDay.workingHours.length > 0
            ? serviceSpecificRuleForDay.workingHours
            : currentWorkingHours;
        currentNumStaff = (_b = serviceSpecificRuleForDay.numberOfStaff) !== null && _b !== void 0 ? _b : currentNumStaff;
    }
    else {
        if ((_c = effectiveRules.weeklyOffDays) === null || _c === void 0 ? void 0 : _c.includes(targetDayOfWeek))
            isDayOff = true;
        if ((_d = effectiveRules.oneTimeOffDates) === null || _d === void 0 ? void 0 : _d.includes(targetDateString))
            isDayOff = true;
    }
    // Check global one-time off dates (like public holidays) if service-specific rules don't mark it as off
    if (!isDayOff && ((_e = globalAppSettings.oneTimeOffDates) === null || _e === void 0 ? void 0 : _e.includes(targetDateString)))
        isDayOff = true;
    if (isDayOff) {
        const suggestedAlternativeSlots = await findNextAvailableSlots(addDays(targetDateObj, 1), "00:00", serviceName, effectiveRules, serviceDuration, globalAppSettings, branchId);
        return { isAvailable: false, reason: `Ngày ${targetDateString} là ngày nghỉ cho dịch vụ này.`, suggestedSlots: suggestedAlternativeSlots };
    }
    if (currentWorkingHours.length === 0 || currentNumStaff <= 0) {
        const suggestedAlternativeSlots = await findNextAvailableSlots(addDays(targetDateObj, 1), "00:00", serviceName, effectiveRules, serviceDuration, globalAppSettings, branchId);
        return { isAvailable: false, reason: `Không có giờ làm việc hoặc nhân viên được cấu hình cho dịch vụ "${serviceName}" vào ngày ${targetDateString}.`, suggestedSlots: suggestedAlternativeSlots };
    }
    const requestedStartDateTime = dateFnsParseISO(`${targetDateString}T${targetTime}:00.000Z`);
    if (!isValidDate(requestedStartDateTime)) {
        return { isAvailable: false, reason: `Ngày giờ yêu cầu không hợp lệ: ${targetDateString} ${targetTime}` };
    }
    if (!currentWorkingHours.includes(targetTime)) {
        const suggestedAlternativeSlots = await findNextAvailableSlots(targetDateObj, targetTime, serviceName, effectiveRules, serviceDuration, globalAppSettings, branchId);
        return { isAvailable: false, reason: `Thời gian ${targetTime} không phải là giờ bắt đầu hợp lệ cho dịch vụ "${serviceName}" trong ngày ${targetDateString}. Các giờ có thể đặt: ${currentWorkingHours.join(', ')}.`, suggestedSlots: suggestedAlternativeSlots };
    }
    const appointmentStartDateTime = requestedStartDateTime;
    const appointmentEndDateTime = addMinutes(appointmentStartDateTime, serviceDuration);
    const appointmentQuery = {
        date: targetDateString,
        service: serviceName,
        status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] }
    };
    if (branchId)
        appointmentQuery.branchId = new mongoose.Types.ObjectId(branchId);
    const existingAppointmentsOnDateForService = await AppointmentModel.find(appointmentQuery);
    let overlappingCount = 0;
    for (const exAppt of existingAppointmentsOnDateForService) {
        const exApptStart = dateFnsParseISO(`${exAppt.date}T${exAppt.time}:00.000Z`);
        if (!isValidDate(exApptStart))
            continue;
        // For existing appointments, we assume their duration was correctly calculated at booking.
        // For simplicity, we'll use the current service's duration for overlap check.
        // A more precise check might need to store/fetch duration of *each* existing appointment.
        const exApptEnd = addMinutes(exApptStart, serviceDuration);
        if (isBefore(appointmentStartDateTime, exApptEnd) && isBefore(exApptStart, appointmentEndDateTime)) {
            overlappingCount++;
        }
    }
    if (overlappingCount >= currentNumStaff) {
        const suggestedAlternativeSlots = await findNextAvailableSlots(targetDateObj, targetTime, serviceName, effectiveRules, serviceDuration, globalAppSettings, branchId);
        return { isAvailable: false, reason: `Xin lỗi, đã đủ ${currentNumStaff} nhân viên bận cho dịch vụ "${serviceName}" vào lúc ${targetTime} ngày ${targetDateString}.`, suggestedSlots: suggestedAlternativeSlots };
    }
    return { isAvailable: true };
}
export async function scheduleAppointment(input) {
    const flowResult = await scheduleAppointmentFlow(input);
    return flowResult;
}
const scheduleAppointmentFlow = ai.defineFlow({
    name: 'scheduleAppointmentFlowVietnameseEnhanced',
    inputSchema: ScheduleAppointmentInputSchema,
    outputSchema: ScheduleAppointmentOutputSchema,
}, 
//@ts-ignore
async (input) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    let currentDateTime = input.currentDateTime;
    if (!input.currentDateTime) {
        console.warn("CurrentDateTime is missing, using server's current time.");
        currentDateTime = new Date().toISOString();
    }
    const globalAppSettings = await getAppSettings();
    if (!globalAppSettings) {
        return { intent: 'error', confirmationMessage: "Không thể tải cài đặt hệ thống. Vui lòng thử lại sau.", requiresAssistance: true };
    }
    const appointmentRulesFromDB = await getAppointmentRules();
    const appointmentRulesForAI = appointmentRulesFromDB.map(rule => {
        var _a, _b;
        return ({
            id: rule.id, name: rule.name, keywords: rule.keywords, conditions: rule.conditions,
            aiPromptInstructions: rule.aiPromptInstructions, createdAt: (_a = rule.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString(), updatedAt: (_b = rule.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString(),
        });
    });
    const activeBranches = await getBranches(true);
    const branchNamesForAI = activeBranches.map(b => b.name);
    let promptInputForNLU = Object.assign(Object.assign({}, input), { currentDateTime, appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined, availableBranches: branchNamesForAI.length > 0 ? branchNamesForAI : undefined, availabilityCheckResult: undefined });
    const { output: nluOutput } = await scheduleAppointmentPrompt(promptInputForNLU);
    if (!nluOutput) {
        return { intent: 'error', confirmationMessage: "Tôi gặp sự cố khi xử lý yêu cầu. Thử lại sau.", requiresAssistance: true };
    }
    //@ts-ignore
    if (nluOutput.intent === 'extracted_details_for_booking' &&
        ((_a = nluOutput.appointmentDetails) === null || _a === void 0 ? void 0 : _a.date) && ((_b = nluOutput.appointmentDetails) === null || _b === void 0 ? void 0 : _b.time) &&
        /^\d{4}-\d{2}-\d{2}$/.test(nluOutput.appointmentDetails.date) &&
        /^[0-2][0-9]:[0-5][0-9]$/.test(nluOutput.appointmentDetails.time) &&
        nluOutput.appointmentDetails.service) {
        const targetDate = dateFnsParseISO(nluOutput.appointmentDetails.date);
        const targetTime = nluOutput.appointmentDetails.time;
        const serviceName = nluOutput.appointmentDetails.service;
        const branchNameFromAI = nluOutput.appointmentDetails.branch;
        const targetBranch = activeBranches.find(b => b.name === branchNameFromAI);
        //@ts-ignore
        const productForService = await ProductModel.findOne({ name: serviceName });
        if (!productForService || !productForService.isSchedulable) {
            const systemInstruction = `Dịch vụ "${serviceName}" không thể đặt lịch. Hãy thông báo cho người dùng và hỏi họ muốn chọn dịch vụ nào khác.`;
            const { output: serviceNotSchedulableOutput } = await scheduleAppointmentPrompt(Object.assign(Object.assign({}, promptInputForNLU), { userInput: systemInstruction, availabilityCheckResult: { status: "SERVICE_NOT_SCHEDULABLE", reason: `Dịch vụ ${serviceName} không thể đặt lịch.`, isServiceNotSchedulable: true } }));
            return serviceNotSchedulableOutput || { intent: 'clarification_needed', confirmationMessage: `Xin lỗi, dịch vụ "${serviceName}" hiện không thể đặt lịch. Bạn muốn thử dịch vụ khác không?`, missingInformation: "dịch vụ có thể đặt lịch" };
        }
        if (!isValidDate(targetDate)) {
            const systemInstruction = `Ngày ${nluOutput.appointmentDetails.date} không hợp lệ. Yêu cầu người dùng cung cấp lại ngày.`;
            const { output: invalidDateOutput } = await scheduleAppointmentPrompt(Object.assign(Object.assign({}, promptInputForNLU), { userInput: systemInstruction, availabilityCheckResult: { status: "NEEDS_CLARIFICATION", reason: "Ngày không hợp lệ." } }));
            return invalidDateOutput || { intent: 'clarification_needed', confirmationMessage: "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).", missingInformation: "ngày hợp lệ" };
        }
        const effectiveSchedulingRules = {
            numberOfStaff: (_e = (_d = (_c = productForService.schedulingRules) === null || _c === void 0 ? void 0 : _c.numberOfStaff) !== null && _d !== void 0 ? _d : globalAppSettings.numberOfStaff) !== null && _e !== void 0 ? _e : 1,
            workingHours: ((_g = (_f = productForService.schedulingRules) === null || _f === void 0 ? void 0 : _f.workingHours) === null || _g === void 0 ? void 0 : _g.length) ? productForService.schedulingRules.workingHours : (_h = globalAppSettings.workingHours) !== null && _h !== void 0 ? _h : [],
            weeklyOffDays: ((_k = (_j = productForService.schedulingRules) === null || _j === void 0 ? void 0 : _j.weeklyOffDays) === null || _k === void 0 ? void 0 : _k.length) ? productForService.schedulingRules.weeklyOffDays : (_l = globalAppSettings.weeklyOffDays) !== null && _l !== void 0 ? _l : [],
            oneTimeOffDates: ((_o = (_m = productForService.schedulingRules) === null || _m === void 0 ? void 0 : _m.oneTimeOffDates) === null || _o === void 0 ? void 0 : _o.length) ? productForService.schedulingRules.oneTimeOffDates : (_p = globalAppSettings.oneTimeOffDates) !== null && _p !== void 0 ? _p : [],
            specificDayRules: ((_r = (_q = productForService.schedulingRules) === null || _q === void 0 ? void 0 : _q.specificDayRules) === null || _r === void 0 ? void 0 : _r.length) ? productForService.schedulingRules.specificDayRules : (_s = globalAppSettings.specificDayRules) !== null && _s !== void 0 ? _s : [],
        };
        const serviceDuration = (_v = (_u = (_t = productForService.schedulingRules) === null || _t === void 0 ? void 0 : _t.serviceDurationMinutes) !== null && _u !== void 0 ? _u : globalAppSettings.defaultServiceDurationMinutes) !== null && _v !== void 0 ? _v : 60;
        const availability = await checkRealAvailability(targetDate, targetTime, globalAppSettings, serviceName, effectiveSchedulingRules, serviceDuration, targetBranch === null || targetBranch === void 0 ? void 0 : targetBranch.id);
        if (availability.isAvailable) {
            const systemInstruction = "Hệ thống đã xác nhận lịch hẹn. Hãy tạo tin nhắn xác nhận cuối cùng cho người dùng.";
            const { output: finalConfirmationOutput } = await scheduleAppointmentPrompt(Object.assign(Object.assign({}, promptInputForNLU), { userInput: systemInstruction, availabilityCheckResult: {
                    status: "AVAILABLE",
                    confirmedSlot: {
                        date: nluOutput.appointmentDetails.date, time: nluOutput.appointmentDetails.time,
                        service: serviceName, branch: branchNameFromAI, durationMinutes: serviceDuration
                    },
                    isStatusUnavailable: false,
                } }));
            if (!finalConfirmationOutput)
                return { intent: 'error', confirmationMessage: "Lỗi tạo tin nhắn xác nhận.", requiresAssistance: true };
            return Object.assign(Object.assign({}, finalConfirmationOutput), { appointmentDetails: Object.assign(Object.assign({}, nluOutput.appointmentDetails), { productId: productForService._id.toString(), branchId: targetBranch === null || targetBranch === void 0 ? void 0 : targetBranch.id, status: 'booked' }), originalAppointmentIdToModify: nluOutput.originalAppointmentIdToModify });
        }
        else { // Slot is NOT available
            const systemInstruction = "Lịch yêu cầu không trống. Hãy thông báo cho người dùng và đề xuất các khung giờ sau từ suggestedSlots.";
            const { output: alternativeOutput } = await scheduleAppointmentPrompt(Object.assign(Object.assign({}, promptInputForNLU), { userInput: systemInstruction, availabilityCheckResult: { status: "UNAVAILABLE", reason: availability.reason, suggestedSlots: availability.suggestedSlots, isStatusUnavailable: true, } }));
            if (!alternativeOutput)
                return { intent: 'error', confirmationMessage: "Lỗi gợi ý lịch hẹn thay thế.", requiresAssistance: true };
            return Object.assign(Object.assign({}, alternativeOutput), { suggestedSlots: availability.suggestedSlots || alternativeOutput.suggestedSlots || [] });
        }
    }
    else if (nluOutput.intent === 'cancelled' || nluOutput.intent === 'clarification_needed' || nluOutput.intent === 'no_action_needed' || nluOutput.intent === 'error') {
        if (nluOutput.intent === 'cancelled' && !nluOutput.originalAppointmentIdToModify && ((_x = (_w = input.existingAppointments) === null || _w === void 0 ? void 0 : _w.length) !== null && _x !== void 0 ? _x : 0) > 0) {
            if (((_z = (_y = input.existingAppointments) === null || _y === void 0 ? void 0 : _y.length) !== null && _z !== void 0 ? _z : 0) > 1) {
                return { intent: 'clarification_needed', confirmationMessage: "Bạn có nhiều lịch hẹn. Bạn muốn hủy lịch hẹn nào cụ thể? (Vui lòng cung cấp ID hoặc mô tả chi tiết).", missingInformation: "lịch hẹn cụ thể cần hủy" };
            }
            else if (((_0 = input.existingAppointments) === null || _0 === void 0 ? void 0 : _0.length) === 1) {
                nluOutput.originalAppointmentIdToModify = input.existingAppointments[0].appointmentId;
            }
        }
        return nluOutput;
    }
    else { // Fallback if NLU output is unexpected or details are missing for booking
        return { intent: 'clarification_needed', confirmationMessage: "Tôi chưa hiểu rõ yêu cầu đặt lịch của bạn. Bạn muốn đặt dịch vụ nào, vào ngày giờ nào?", missingInformation: "dịch vụ, ngày, giờ" };
    }
});
