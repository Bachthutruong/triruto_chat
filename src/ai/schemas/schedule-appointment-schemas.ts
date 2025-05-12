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
  appointmentId: z.string().describe('ID lịch hẹn'),
  userId: z.string().describe('ID người dùng'),
  service: z.string().describe('Dịch vụ'),
  time: z.string().describe('Thời gian hẹn'),
  date: z.string().describe('Ngày hẹn (YYYY-MM-DD)'),
  branch: z.string().optional().describe('Chi nhánh'),
  packageType: z.string().optional().describe('Loại gói'),
  priority: z.string().optional().describe('Mức độ ưu tiên'),
  status: z.enum(['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled']).describe('Trạng thái lịch hẹn'),
  notes: z.string().optional().describe('Ghi chú'),
  createdAt: z.string().datetime().describe('Ngày tạo'),
  updatedAt: z.string().datetime().describe('Ngày cập nhật'),
});

export const ScheduleAppointmentInputSchema = z.object({
  userInput: z.string().describe('Nội dung nhập của người dùng yêu cầu hành động liên quan đến lịch hẹn (đặt, đổi, hủy) bằng tiếng Việt.'),
  phoneNumber: z.string().describe('Số điện thoại của người dùng.'),
  userId: z.string().describe('ID duy nhất của người dùng.'),
  existingAppointments: z.array(AppointmentDetailsSchema).optional().describe('Danh sách các lịch hẹn hiện tại của người dùng để cung cấp ngữ cảnh, đặc biệt khi đổi hoặc hủy lịch.'),
  currentDateTime: z.string().datetime().describe('Ngày giờ hiện tại theo định dạng ISO, để giúp xác định ngữ cảnh cho "hôm nay", "ngày mai".'),
});
export type ScheduleAppointmentInput = z.infer<typeof ScheduleAppointmentInputSchema>;

export const ScheduleAppointmentOutputSchema = z.object({
  intent: z.enum(['booked', 'rescheduled', 'cancelled', 'pending_alternatives', 'clarification_needed', 'error', 'no_action_needed'])
    .describe('Kết quả của việc đặt lịch hoặc ý định được xác định của người dùng.'),
  confirmationMessage: z.string().describe('Một tin nhắn gửi cho người dùng bằng tiếng Việt về trạng thái lịch hẹn hoặc các bước tiếp theo.'),
  appointmentDetails: AppointmentDetailsSchema.omit({ userId: true, createdAt: true, updatedAt: true, packageType: true, priority: true, notes: true })
    .merge(z.object({ appointmentId: z.string().optional() }))
    .optional()
    .describe('Chi tiết của lịch hẹn đã đặt, đổi hoặc được xác định. Đối với đặt lịch mới, ID có thể đang chờ xử lý.'),
  originalAppointmentIdToModify: z.string().optional().describe('Nếu đổi hoặc hủy lịch, ID của lịch hẹn gốc bị ảnh hưởng.'),
  suggestedSlots: z.array(z.object({
    date: z.string().describe('Ngày gợi ý (YYYY-MM-DD).'),
    time: z.string().describe('Giờ gợi ý (ví dụ: "2:00 chiều").'),
    branch: z.string().optional().describe('Chi nhánh gợi ý.'),
  })).optional().describe('Các khung giờ thay thế được gợi ý nếu khung giờ yêu cầu không có sẵn hoặc để đổi lịch.'),
  missingInformation: z.string().optional().describe('Nếu cần làm rõ, thông tin nào đang thiếu (ví dụ: "loại dịch vụ", "ngày ưu tiên") bằng tiếng Việt.'),
  requiresAssistance: z.boolean().optional().describe('True nếu AI không thể xử lý yêu cầu và cần sự hỗ trợ của con người.'),
});
export type ScheduleAppointmentOutput = z.infer<typeof ScheduleAppointmentOutputSchema>;

