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
Số điện thoại của người dùng: {{{phoneNumber}}}. ID người dùng: {{{userId}}}. Ngày/giờ hiện tại: {{{currentDateTime}}}.

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
3.  Mô phỏng tình trạng lịch trống:
    *   BẠN PHẢI giả định một số khung giờ đã bận. KHÔNG được luôn nói rằng lịch trống.
    *   Nếu một khung giờ cụ thể được yêu cầu (ví dụ: "Cắt tóc ngày mai lúc 3 giờ chiều"):
        *   50% khả năng lịch trống: đặt 'intent: "booked"', cung cấp 'appointmentDetails'.
        *   50% khả năng lịch bận: đặt 'intent: "pending_alternatives"', cung cấp 'suggestedSlots' (2-3 khung giờ thực tế trong tương lai, ví dụ: giờ khác trong cùng ngày, hoặc ngày hôm sau).
    *   Nếu yêu cầu không rõ ràng (ví dụ: "Tôi muốn massage tuần tới"): đặt 'intent: "pending_alternatives"' và cung cấp 2-3 'suggestedSlots'.
4.  Xử lý đổi lịch:
    *   Xác định lịch hẹn nào cần đổi bằng 'originalAppointmentIdToModify'. Nếu không rõ, hãy hỏi để làm rõ.
    *   Hỏi ngày/giờ ưu tiên mới nếu chưa được cung cấp.
    *   Sau đó, mô phỏng tình trạng lịch trống như trên cho khung giờ mới. Nếu trống, 'intent: "rescheduled"'. Nếu không, 'intent: "pending_alternatives"'.
5.  Xử lý hủy lịch:
    *   Xác định lịch hẹn nào cần hủy bằng 'originalAppointmentIdToModify'. Nếu không rõ, hãy hỏi để làm rõ.
    *   Đặt 'intent: "cancelled"'.
6.  Làm rõ: Nếu thiếu thông tin quan trọng (ví dụ: dịch vụ cho đặt lịch mới, lịch hẹn nào cần sửa), đặt 'intent: "clarification_needed"' và chỉ định 'missingInformation'.
7.  Lỗi/Cần hỗ trợ: Nếu yêu cầu quá phức tạp hoặc hoàn toàn không liên quan đến lịch hẹn, đặt 'intent: "error"' hoặc 'requiresAssistance: true'.

Các trường phản hồi:
- intent: "booked", "rescheduled", "cancelled", "pending_alternatives", "clarification_needed", "error", "no_action_needed".
- confirmationMessage: Tin nhắn thân thiện của bạn gửi cho người dùng bằng tiếng Việt. Đây là nội dung người dùng sẽ thấy.
- appointmentDetails: Đối tượng với {service, date, time, branch, status}. Đối với 'booked'/'rescheduled', status phải là 'booked'. Đối với kết quả ban đầu cho đặt lịch mới, bạn có thể bỏ qua 'appointmentId' vì hệ thống sẽ tạo nó.
- originalAppointmentIdToModify: ID của lịch hẹn đang được thay đổi/hủy.
- suggestedSlots: Mảng các {date, time, branch} cho "pending_alternatives".
- missingInformation: Chuỗi mô tả những gì cần thiết cho "clarification_needed" bằng tiếng Việt.
- requiresAssistance: Boolean.

Ví dụ đặt lịch mới: Người dùng nói "Đặt lịch cắt tóc cho tôi vào ngày mai lúc 2 giờ chiều".
Nếu lịch trống: intent="booked", confirmationMessage="OK! Tôi đã đặt lịch Cắt tóc cho bạn vào ngày mai lúc 2:00 chiều.", appointmentDetails={service:"Cắt tóc", date:"<ngày_mai>", time:"2:00 chiều", status:"booked"}.
Nếu lịch bận: intent="pending_alternatives", confirmationMessage="Xin lỗi, 2 giờ chiều đã có người đặt. Bạn thấy 4 giờ chiều hoặc ngày kia lúc 2 giờ chiều thì sao?", suggestedSlots=[{date:"<ngày_mai>", time:"4:00 chiều"}, {date:"<ngày_kia>", time:"2:00 chiều"}].

Ví dụ hủy lịch: Người dùng nói "Hủy lịch hẹn ngày mai của tôi." (Giả sử có một lịch hẹn vào ngày mai với ID 'appt123')
intent="cancelled", confirmationMessage="Lịch hẹn ngày mai của bạn đã được hủy.", originalAppointmentIdToModify="appt123".

Cung cấp ngày theo định dạng YYYY-MM-DD.
Hãy súc tích và hữu ích trong confirmationMessage của bạn.
Nếu nội dung người dùng nhập không liên quan đến lịch hẹn (ví dụ: "Thời tiết hôm nay thế nào?"), hãy đặt intent thành "no_action_needed" và cung cấp một tin nhắn lịch sự bằng tiếng Việt.
`,
});

const scheduleAppointmentFlow = ai.defineFlow(
  {
    name: 'scheduleAppointmentFlowVietnamese', // Changed name
    inputSchema: ScheduleAppointmentInputSchema,
    outputSchema: ScheduleAppointmentOutputSchema,
  },
  async (input) => {
    if (!input.currentDateTime) {
        console.warn("CurrentDateTime is missing, using server's current time as fallback.");
        input.currentDateTime = new Date().toISOString();
    }

    const {output} = await prompt(input);
    
    if (!output) {
      return {
        intent: 'error',
        confirmationMessage: "Tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
        requiresAssistance: true,
      };
    }
    
    if (output.intent === 'booked' || output.intent === 'rescheduled') {
      if (output.appointmentDetails) {
        output.appointmentDetails.status = 'booked';
      } else {
        console.warn("AI indicated 'booked' or 'rescheduled' intent but no appointmentDetails were provided.");
      }
    }
    if (output.intent === 'cancelled' && output.originalAppointmentIdToModify && output.appointmentDetails) {
        output.appointmentDetails.status = 'cancelled';
    }

    return output;
  }
);

