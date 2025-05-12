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
  name: 'scheduleAppointmentPromptVietnamese', // Changed name
  input: {schema: ScheduleAppointmentInputSchema},
  output: {schema: ScheduleAppointmentOutputSchema},
  prompt: `Bạn là một trợ lý AI cho một salon/spa, giúp người dùng quản lý lịch hẹn bằng tiếng Việt.
Số điện thoại của người dùng: {{{phoneNumber}}}. ID người dùng: {{{userId}}}. Ngày/giờ hiện tại được cung cấp cho bạn là: {{{currentDateTime}}}.

Nội dung người dùng nhập: {{{userInput}}}

{{#if existingAppointments}}
Các lịch hẹn hiện có của người dùng:
{{#each existingAppointments}}
- ID: {{appointmentId}}, Dịch vụ: {{service}}, Ngày: {{date}}, Giờ: {{time}}, Trạng thái: {{status}}{{#if branch}}, Chi nhánh: {{branch}}{{/if}}
{{/each}}
{{else}}
Người dùng không có lịch hẹn nào.
{{/if}}

Các dịch vụ có sẵn: Cắt tóc, Tạo kiểu, Nhuộm tóc, Làm móng tay, Làm móng chân, Chăm sóc da mặt, Massage.
Giờ hoạt động: 9 giờ sáng - 6 giờ tối hàng ngày. Các lịch hẹn thường kéo dài 1 tiếng.
Chi nhánh: "Chi nhánh Chính", "Chi nhánh Phụ". Nếu không nói rõ chi nhánh, người dùng có thể chọn hoặc bạn có thể gợi ý Chi nhánh Chính.

Nhiệm vụ của bạn:
1.  Xác định ý định: Người dùng đang cố gắng đặt lịch hẹn mới, đổi lịch hẹn hiện có hay hủy lịch?
2.  Trích xuất chi tiết: Đối với đặt mới/đổi lịch, xác định dịch vụ, ngày, giờ và chi nhánh ưu tiên.
    **Quan trọng về ngày tháng**: Khi người dùng đề cập đến ngày tương đối (ví dụ: "hôm nay", "ngày mai", "tuần tới"), BẠN PHẢI tính toán và cung cấp ngày cụ thể ở định dạng YYYY-MM-DD trong trường 'appointmentDetails.date' dựa trên 'currentDateTime' được cung cấp ({{{currentDateTime}}}). Ví dụ, nếu currentDateTime là '2024-07-25T10:00:00Z' và người dùng muốn "ngày mai", thì 'date' phải là "2024-07-26". Đừng bao giờ trả về các chuỗi như "<ngày_mai>" hoặc "ngày mai" trong trường 'date' của 'appointmentDetails'. Luôn sử dụng định dạng YYYY-MM-DD cho tất cả các trường ngày.
3.  Mô phỏng tình trạng lịch trống:
    *   BẠN PHẢI giả định một số khung giờ đã bận. KHÔNG được luôn nói rằng lịch trống.
    *   Nếu một khung giờ cụ thể được yêu cầu (ví dụ: "Cắt tóc ngày mai lúc 3 giờ chiều", và bạn đã tính toán "ngày mai" thành một ngày YYYY-MM-DD cụ thể dựa trên currentDateTime):
        *   50% khả năng lịch trống: đặt 'intent: "booked"', cung cấp 'appointmentDetails' (bao gồm service, date (ở định dạng YYYY-MM-DD), time, branch, status='booked').
        *   50% khả năng lịch bận: đặt 'intent: "pending_alternatives"', cung cấp 'suggestedSlots' (2-3 khung giờ thực tế trong tương lai, ví dụ: giờ khác trong cùng ngày, hoặc ngày hôm sau, tất cả các ngày phải ở định dạng YYYY-MM-DD).
    *   Nếu yêu cầu không rõ ràng (ví dụ: "Tôi muốn massage tuần tới"): đặt 'intent: "pending_alternatives"' và cung cấp 2-3 'suggestedSlots' với ngày ở định dạng YYYY-MM-DD.
4.  Xử lý đổi lịch:
    *   Xác định lịch hẹn nào cần đổi bằng 'originalAppointmentIdToModify'. Nếu không rõ, hãy hỏi để làm rõ.
    *   Hỏi ngày/giờ ưu tiên mới (ngày phải là YYYY-MM-DD) nếu chưa được cung cấp.
    *   Sau đó, mô phỏng tình trạng lịch trống như trên cho khung giờ mới. Nếu trống, 'intent: "rescheduled"', cung cấp 'appointmentDetails' đầy đủ (date là YYYY-MM-DD) và 'originalAppointmentIdToModify'. Nếu không, 'intent: "pending_alternatives"'.
5.  Xử lý hủy lịch:
    *   Xác định lịch hẹn nào cần hủy bằng 'originalAppointmentIdToModify'. Nếu không rõ, hãy hỏi để làm rõ.
    *   Đặt 'intent: "cancelled"'. Cung cấp 'originalAppointmentIdToModify'. Nếu có thể, 'appointmentDetails' với status='cancelled' và date là YYYY-MM-DD.
6.  Làm rõ: Nếu thiếu thông tin quan trọng (ví dụ: dịch vụ cho đặt lịch mới, lịch hẹn nào cần sửa), đặt 'intent: "clarification_needed"' và chỉ định 'missingInformation'.
7.  Lỗi/Cần hỗ trợ: Nếu yêu cầu quá phức tạp hoặc hoàn toàn không liên quan đến lịch hẹn, đặt 'intent: "error"' hoặc 'requiresAssistance: true'.

Các trường phản hồi:
- intent: "booked", "rescheduled", "cancelled", "pending_alternatives", "clarification_needed", "error", "no_action_needed".
- confirmationMessage: Tin nhắn thân thiện của bạn gửi cho người dùng bằng tiếng Việt. Đây là nội dung người dùng sẽ thấy.
- appointmentDetails: Đối tượng với {service, date (luôn là YYYY-MM-DD), time, branch, status}. Đối với 'booked'/'rescheduled', status phải là 'booked'. Đối với 'cancelled', status nên là 'cancelled'. Đối với kết quả ban đầu cho đặt lịch mới, bạn có thể bỏ qua 'appointmentId' vì hệ thống sẽ tạo nó. PHẢI cung cấp appointmentDetails nếu intent là 'booked' hoặc 'rescheduled'.
- originalAppointmentIdToModify: ID của lịch hẹn đang được thay đổi/hủy. PHẢI cung cấp nếu intent là 'rescheduled' hoặc 'cancelled' và có lịch hẹn cụ thể.
- suggestedSlots: Mảng các {date (YYYY-MM-DD), time, branch} cho "pending_alternatives".
- missingInformation: Chuỗi mô tả những gì cần thiết cho "clarification_needed" bằng tiếng Việt.
- requiresAssistance: Boolean.

Ví dụ đặt lịch mới: Người dùng nói "Đặt lịch cắt tóc cho tôi vào ngày mai lúc 2 giờ chiều". Giả sử currentDateTime là '2024-07-25T10:00:00Z'.
Nếu lịch trống: intent="booked", confirmationMessage="OK! Tôi đã đặt lịch Cắt tóc cho bạn vào ngày 2024-07-26 lúc 2:00 chiều.", appointmentDetails={service:"Cắt tóc", date:"2024-07-26", time:"2:00 chiều", branch:"Chi nhánh Chính", status:"booked"}.
Nếu lịch bận: intent="pending_alternatives", confirmationMessage="Xin lỗi, 2 giờ chiều ngày 2024-07-26 đã có người đặt. Bạn thấy 4 giờ chiều ngày 2024-07-26 hoặc ngày 2024-07-27 lúc 2 giờ chiều thì sao?", suggestedSlots=[{date:"2024-07-26", time:"4:00 chiều"}, {date:"2024-07-27", time:"2:00 chiều"}].

Ví dụ hủy lịch: Người dùng nói "Hủy lịch hẹn ngày mai của tôi." (Giả sử currentDateTime là '2024-07-25T...', vậy ngày mai là 2024-07-26. Giả sử có một lịch hẹn vào ngày 2024-07-26 với ID 'appt123')
intent="cancelled", confirmationMessage="Lịch hẹn ngày 2024-07-26 của bạn đã được hủy.", originalAppointmentIdToModify="appt123", appointmentDetails={appointmentId:"appt123", service:"<tên_dịch_vụ_cũ>", date:"2024-07-26", time:"<giờ_cũ>", status:"cancelled"}.

Hãy súc tích và hữu ích trong confirmationMessage của bạn.
Nếu nội dung người dùng nhập không liên quan đến lịch hẹn (ví dụ: "Thời tiết hôm nay thế nào?"), hãy đặt intent thành "no_action_needed" và cung cấp một tin nhắn lịch sự bằng tiếng Việt.
`,
});

const scheduleAppointmentFlow = ai.defineFlow(
  {
    name: 'scheduleAppointmentFlowVietnamese',
    inputSchema: ScheduleAppointmentInputSchema,
    outputSchema: ScheduleAppointmentOutputSchema,
  },
  async (input) => {
    if (!input.currentDateTime) {
        // This should ideally not happen if actions.ts always provides it.
        console.warn("CurrentDateTime is missing in scheduleAppointmentFlow input, using server's current time as fallback.");
        input.currentDateTime = new Date().toISOString();
    }

    const {output} = await prompt(input);
    
    if (!output) { // Prompt call failed entirely
      return {
        intent: 'error',
        confirmationMessage: "Tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
        requiresAssistance: true,
      };
    }
    
    // Validate specific intents and ensure data integrity (date format, required fields)
    if (output.intent === 'booked' || output.intent === 'rescheduled') {
      if (
        output.appointmentDetails &&
        output.appointmentDetails.service &&
        output.appointmentDetails.date &&
        /^\d{4}-\d{2}-\d{2}$/.test(output.appointmentDetails.date) && // Validate YYYY-MM-DD format
        output.appointmentDetails.time
      ) {
        output.appointmentDetails.status = 'booked'; 
        
        if (output.intent === 'rescheduled' && !output.originalAppointmentIdToModify) {
            // AI indicated 'rescheduled' but no originalAppointmentIdToModify
            console.warn("[AI Flow] AI indicated 'rescheduled' but no originalAppointmentIdToModify was provided. Output:", JSON.stringify(output));
            return {
                intent: 'clarification_needed',
                confirmationMessage: "Tôi cần biết bạn muốn đổi lịch hẹn nào. Bạn có thể cung cấp ID lịch hẹn hoặc mô tả lịch hẹn đó được không?",
                missingInformation: "lịch hẹn gốc cần đổi",
                requiresAssistance: true, // Requires assistance because AI made a logical error
            };
        }
      } else {
        // Critical appointmentDetails are missing or date is malformed
        console.warn("[AI Flow] AI indicated 'booked' or 'rescheduled' but crucial appointmentDetails (service, date (YYYY-MM-DD), or time) were missing/invalid. Output:", JSON.stringify(output));
        return {
            intent: 'clarification_needed',
            confirmationMessage: "Xin lỗi, tôi chưa thể xác nhận đầy đủ thông tin lịch hẹn (dịch vụ, ngày YYYY-MM-DD, giờ). Bạn vui lòng cung cấp lại được không?",
            missingInformation: "dịch vụ, ngày (định dạng YYYY-MM-DD), giờ",
            requiresAssistance: true, // Likely needs assistance if AI can't provide basic details
        };
      }
    }
    
    if (output.intent === 'cancelled') {
        if (!output.originalAppointmentIdToModify) {
            console.warn("[AI Flow] AI indicated 'cancelled' but no originalAppointmentIdToModify was provided. Output:", JSON.stringify(output));
            return {
                intent: 'clarification_needed',
                confirmationMessage: "Tôi cần biết bạn muốn hủy lịch hẹn nào. Bạn có thể cung cấp ID lịch hẹn hoặc mô tả lịch hẹn đó được không?",
                missingInformation: "lịch hẹn gốc cần hủy",
                requiresAssistance: true,
            };
        }
        if (output.appointmentDetails) {
            output.appointmentDetails.status = 'cancelled';
            // Also validate date format if present for cancelled appointment details
            if (output.appointmentDetails.date && !/^\d{4}-\d{2}-\d{2}$/.test(output.appointmentDetails.date)) {
                 console.warn("[AI Flow] AI provided 'cancelled' appointmentDetails with malformed date. Correcting or removing if problematic downstream.", JSON.stringify(output.appointmentDetails));
                 // Depending on strictness, you might nullify the date or the whole appointmentDetails here
                 // For now, let it pass but be aware.
            }
        }
    }
    
    // Ensure suggestedSlots also have valid date formats if present
    if (output.intent === 'pending_alternatives' && output.suggestedSlots) {
        for (const slot of output.suggestedSlots) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
                console.warn("[AI Flow] AI provided 'pending_alternatives' with a malformed date in suggestedSlots. Slot:", JSON.stringify(slot));
                // This could lead to issues if user selects this.
                // Consider filtering out malformed slots or returning a clarification_needed/error.
                return {
                    intent: 'error',
                    confirmationMessage: "Tôi gặp chút vấn đề với việc gợi ý lịch hẹn. Định dạng ngày không đúng. Vui lòng thử lại.",
                    requiresAssistance: true,
                };
            }
        }
    }


    return output;
  }
);

