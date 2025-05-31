"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleAppointmentOutputSchema = exports.ScheduleAppointmentInputSchema = exports.AppointmentRuleSchema = exports.AppointmentDetailsSchema = void 0;
// src/ai/schemas/schedule-appointment-schemas.ts
/**
 * @fileOverview Schema definitions for the scheduleAppointment flow.
 */
const genkit_1 = require("genkit");
exports.AppointmentDetailsSchema = genkit_1.z.object({
    appointmentId: genkit_1.z.string().optional().describe('ID lịch hẹn (để trống cho lịch hẹn mới)'),
    userId: genkit_1.z.string().optional().describe('ID người dùng (sẽ được hệ thống điền)'),
    service: genkit_1.z.string().describe('Dịch vụ'),
    productId: genkit_1.z.string().optional().describe('ID của sản phẩm/dịch vụ nếu có'),
    time: genkit_1.z.string().describe('Thời gian hẹn (HH:MM)'),
    date: genkit_1.z.string().describe('Ngày hẹn (YYYY-MM-DD)'),
    branch: genkit_1.z.string().optional().describe('Chi nhánh'),
    branchId: genkit_1.z.string().optional().describe('ID của chi nhánh nếu có'),
    packageType: genkit_1.z.string().optional().describe('Loại gói (ví dụ: "Tiêu chuẩn", "Cao cấp")'),
    priority: genkit_1.z.string().optional().describe('Mức độ ưu tiên (ví dụ: "Cao", "Bình thường")'),
    status: genkit_1.z.enum(['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled']).describe('Trạng thái lịch hẹn'),
    notes: genkit_1.z.string().optional().describe('Ghi chú cho lịch hẹn'),
    createdAt: genkit_1.z.string().datetime().optional().describe('Ngày tạo (sẽ được hệ thống điền)'),
    updatedAt: genkit_1.z.string().datetime().optional().describe('Ngày cập nhật (sẽ được hệ thống điền)'),
    // serviceSpecificDurationMinutes: z.number().optional().describe('Thời gian của dịch vụ cụ thể này (phút). Nếu không có, dùng mặc định.') // Added for AI context
});
exports.AppointmentRuleSchema = genkit_1.z.object({
    id: genkit_1.z.string().describe('ID của quy tắc'),
    name: genkit_1.z.string().describe('Tên của quy tắc đặt lịch.'),
    keywords: genkit_1.z.array(genkit_1.z.string()).describe('Danh sách các từ khóa kích hoạt quy tắc này.'),
    conditions: genkit_1.z.string().describe('Các điều kiện để áp dụng quy tắc (ví dụ: "service:Cắt tóc, time_range:[5PM-8PM]").'),
    aiPromptInstructions: genkit_1.z.string().describe('Hướng dẫn chi tiết cho AI khi quy tắc này khớp.'),
    createdAt: genkit_1.z.string().datetime().optional().describe('Ngày tạo quy tắc.'),
    updatedAt: genkit_1.z.string().datetime().optional().describe('Ngày cập nhật quy tắc gần nhất.'),
});
exports.ScheduleAppointmentInputSchema = genkit_1.z.object({
    userInput: genkit_1.z.string().describe('Nội dung nhập của người dùng yêu cầu hành động liên quan đến lịch hẹn (đặt, đổi, hủy) bằng tiếng Việt.'),
    phoneNumber: genkit_1.z.string().describe('Số điện thoại của người dùng.'),
    userId: genkit_1.z.string().describe('ID duy nhất của người dùng.'),
    existingAppointments: genkit_1.z.array(exports.AppointmentDetailsSchema).optional().describe('Danh sách các lịch hẹn hiện tại của người dùng để cung cấp ngữ cảnh, đặc biệt khi đổi hoặc hủy lịch.'),
    currentDateTime: genkit_1.z.string().datetime().describe('Ngày giờ hiện tại theo định dạng ISO, để giúp xác định ngữ cảnh cho "hôm nay", "ngày mai".'),
    chatHistory: genkit_1.z.string().optional().describe('Lịch sử trò chuyện gần đây của người dùng, để cung cấp ngữ cảnh.'),
    appointmentRules: genkit_1.z.array(exports.AppointmentRuleSchema).optional().describe('Các quy tắc đặt lịch có sẵn để AI xem xét khi xử lý yêu cầu.'),
    availableBranches: genkit_1.z.array(genkit_1.z.string()).optional().describe('Danh sách tên các chi nhánh đang hoạt động để AI gợi ý.'),
    availabilityCheckResult: genkit_1.z.object({
        status: genkit_1.z.enum(["AVAILABLE", "UNAVAILABLE", "NEEDS_CLARIFICATION", "SERVICE_NOT_SCHEDULABLE"]),
        reason: genkit_1.z.string().optional(),
        suggestedSlots: genkit_1.z.array(genkit_1.z.object({ date: genkit_1.z.string(), time: genkit_1.z.string(), service: genkit_1.z.string().optional(), branch: genkit_1.z.string().optional() })).optional(),
        confirmedSlot: genkit_1.z.object({
            date: genkit_1.z.string(),
            time: genkit_1.z.string(),
            service: genkit_1.z.string().optional(),
            branch: genkit_1.z.string().optional(),
            durationMinutes: genkit_1.z.number().optional().describe("Thời gian thực hiện dịch vụ đã xác nhận (phút).")
        }).optional(),
        isStatusUnavailable: genkit_1.z.boolean().optional().describe("Flag indicating if the status is UNAVAILABLE, for Handlebars logic."),
        isServiceNotSchedulable: genkit_1.z.boolean().optional().describe("Flag indicating if the service is not schedulable.")
    }).optional().describe("Kết quả kiểm tra lịch trống từ hệ thống (chỉ dùng nội bộ)."),
});
exports.ScheduleAppointmentOutputSchema = genkit_1.z.object({
    intent: genkit_1.z.enum(['booked', 'rescheduled', 'cancelled', 'pending_alternatives', 'clarification_needed', 'error', 'no_action_needed'])
        .describe('Kết quả của việc đặt lịch hoặc ý định được xác định của người dùng.'),
    confirmationMessage: genkit_1.z.string().describe('Một tin nhắn gửi cho người dùng bằng tiếng Việt về trạng thái lịch hẹn hoặc các bước tiếp theo.'),
    appointmentDetails: exports.AppointmentDetailsSchema.omit({ userId: true, createdAt: true, updatedAt: true })
        .optional()
        .describe('Chi tiết của lịch hẹn đã đặt, đổi hoặc được xác định. `appointmentId` là tùy chọn cho lịch mới.'),
    originalAppointmentIdToModify: genkit_1.z.string().optional().describe('Nếu đổi hoặc hủy lịch, ID của lịch hẹn gốc bị ảnh hưởng.'),
    suggestedSlots: genkit_1.z.array(genkit_1.z.object({
        date: genkit_1.z.string().describe('Ngày gợi ý (YYYY-MM-DD).'),
        time: genkit_1.z.string().describe('Giờ gợi ý (HH:MM).'),
        branch: genkit_1.z.string().optional().describe('Chi nhánh gợi ý.'),
    })).optional().describe('Các khung giờ thay thế được gợi ý nếu khung giờ yêu cầu không có sẵn hoặc để đổi lịch.'),
    missingInformation: genkit_1.z.string().optional().describe('Nếu cần làm rõ, thông tin nào đang thiếu (ví dụ: "loại dịch vụ", "ngày ưu tiên") bằng tiếng Việt.'),
    requiresAssistance: genkit_1.z.boolean().optional().describe('True nếu AI không thể xử lý yêu cầu và cần sự hỗ trợ của con người.'),
});
