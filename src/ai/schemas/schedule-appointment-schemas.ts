// src/ai/schemas/schedule-appointment-schemas.ts
/**
 * @fileOverview Schema definitions for the scheduleAppointment flow.
 *
 * - AppointmentDetailsSchema - Zod schema for appointment details.
 * - AppointmentRuleSchema - Zod schema for appointment rules.
 * - ScheduleAppointmentInputSchema - Zod schema for input.
 * - ScheduleAppointmentInput - TypeScript type for input.
 * - ScheduleAppointmentOutputSchema - Zod schema for output.
 * - ScheduleAppointmentOutput - TypeScript type for output.
 */
import { z } from 'genkit';

export const AppointmentDetailsSchema = z.object({
  appointmentId: z.string().optional().describe('ID lịch hẹn (để trống cho lịch hẹn mới)'), // Made optional
  userId: z.string().optional().describe('ID người dùng (sẽ được hệ thống điền)'), // Made optional
  service: z.string().describe('Dịch vụ'),
  time: z.string().describe('Thời gian hẹn (ví dụ: "2:00 chiều", "14:00")'),
  date: z.string().describe('Ngày hẹn (YYYY-MM-DD)'),
  branch: z.string().optional().describe('Chi nhánh'),
  packageType: z.string().optional().describe('Loại gói (ví dụ: "Tiêu chuẩn", "Cao cấp")'),
  priority: z.string().optional().describe('Mức độ ưu tiên (ví dụ: "Cao", "Bình thường")'),
  status: z.enum(['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled']).describe('Trạng thái lịch hẹn'),
  notes: z.string().optional().describe('Ghi chú cho lịch hẹn'),
  createdAt: z.string().datetime().optional().describe('Ngày tạo (sẽ được hệ thống điền)'), // Made optional
  updatedAt: z.string().datetime().optional().describe('Ngày cập nhật (sẽ được hệ thống điền)'), // Made optional
});

export const AppointmentRuleSchema = z.object({
  id: z.string().describe('ID của quy tắc'),
  name: z.string().describe('Tên của quy tắc đặt lịch.'),
  keywords: z.array(z.string()).describe('Danh sách các từ khóa kích hoạt quy tắc này.'),
  conditions: z.string().describe('Các điều kiện để áp dụng quy tắc (ví dụ: "service:Cắt tóc, time_range:[5PM-8PM]").'),
  aiPromptInstructions: z.string().describe('Hướng dẫn chi tiết cho AI khi quy tắc này khớp.'),
  createdAt: z.string().datetime().optional().describe('Ngày tạo quy tắc.'),
  updatedAt: z.string().datetime().optional().describe('Ngày cập nhật quy tắc gần nhất.'),
});
export type AppointmentRule = z.infer<typeof AppointmentRuleSchema>;

export const ScheduleAppointmentInputSchema = z.object({
  userInput: z.string().describe('Nội dung nhập của người dùng yêu cầu hành động liên quan đến lịch hẹn (đặt, đổi, hủy) bằng tiếng Việt.'),
  phoneNumber: z.string().describe('Số điện thoại của người dùng.'),
  userId: z.string().describe('ID duy nhất của người dùng.'),
  existingAppointments: z.array(AppointmentDetailsSchema).optional().describe('Danh sách các lịch hẹn hiện tại của người dùng để cung cấp ngữ cảnh, đặc biệt khi đổi hoặc hủy lịch.'),
  currentDateTime: z.string().datetime().describe('Ngày giờ hiện tại theo định dạng ISO, để giúp xác định ngữ cảnh cho "hôm nay", "ngày mai".'),
  chatHistory: z.string().optional().describe('Lịch sử trò chuyện gần đây của người dùng, để cung cấp ngữ cảnh.'),
  appointmentRules: z.array(AppointmentRuleSchema).optional().describe('Các quy tắc đặt lịch có sẵn để AI xem xét khi xử lý yêu cầu.'),
  // This field is for internal system use to pass pre-checked availability to the AI
  // It should not typically be set directly by the client calling the flow initially.
  availabilityCheckResult: z.object({
    status: z.enum(["AVAILABLE", "UNAVAILABLE", "NEEDS_CLARIFICATION"]),
    reason: z.string().optional(),
    suggestedSlots: z.array(z.object({ date: z.string(), time: z.string(), service: z.string().optional(), branch: z.string().optional() })).optional(),
    confirmedSlot: z.object({ date: z.string(), time: z.string(), service: z.string().optional(), branch: z.string().optional() }).optional(),
    isStatusUnavailable: z.boolean().optional().describe("Flag indicating if the status is UNAVAILABLE, for Handlebars logic."),
  }).optional().describe("Kết quả kiểm tra lịch trống từ hệ thống (chỉ dùng nội bộ)."),
});
export type ScheduleAppointmentInput = z.infer<typeof ScheduleAppointmentInputSchema>;

export const ScheduleAppointmentOutputSchema = z.object({
  intent: z.enum(['booked', 'rescheduled', 'cancelled', 'pending_alternatives', 'clarification_needed', 'error', 'no_action_needed'])
    .describe('Kết quả của việc đặt lịch hoặc ý định được xác định của người dùng.'),
  confirmationMessage: z.string().describe('Một tin nhắn gửi cho người dùng bằng tiếng Việt về trạng thái lịch hẹn hoặc các bước tiếp theo.'),
  appointmentDetails: AppointmentDetailsSchema.omit({ userId: true, createdAt: true, updatedAt: true }) // Omit system-managed fields for AI output
    .optional()
    .describe('Chi tiết của lịch hẹn đã đặt, đổi hoặc được xác định. `appointmentId` là tùy chọn cho lịch mới.'),
  originalAppointmentIdToModify: z.string().optional().describe('Nếu đổi hoặc hủy lịch, ID của lịch hẹn gốc bị ảnh hưởng.'),
  suggestedSlots: z.array(z.object({
    date: z.string().describe('Ngày gợi ý (YYYY-MM-DD).'),
    time: z.string().describe('Giờ gợi ý (ví dụ: "2:00 chiều", "14:00").'), // Adjusted description to include 14:00 example
    branch: z.string().optional().describe('Chi nhánh gợi ý.'),
  })).optional().describe('Các khung giờ thay thế được gợi ý nếu khung giờ yêu cầu không có sẵn hoặc để đổi lịch.'),
  missingInformation: z.string().optional().describe('Nếu cần làm rõ, thông tin nào đang thiếu (ví dụ: "loại dịch vụ", "ngày ưu tiên") bằng tiếng Việt.'),
  requiresAssistance: z.boolean().optional().describe('True nếu AI không thể xử lý yêu cầu và cần sự hỗ trợ của con người.'),
});
export type ScheduleAppointmentOutput = z.infer<typeof ScheduleAppointmentOutputSchema>;
