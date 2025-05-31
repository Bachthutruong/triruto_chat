"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnswerUserQuestionOutputSchema = exports.AnswerUserQuestionInputSchema = void 0;
// src/ai/schemas/answer-user-question-schemas.ts
/**
 * @fileOverview Schema definitions for the answerUserQuestion flow.
 *
 * - AnswerUserQuestionInputSchema - Zod schema for input.
 * - AnswerUserQuestionInput - TypeScript type for input.
 * - AnswerUserQuestionOutputSchema - Zod schema for output.
 * - AnswerUserQuestionOutput - TypeScript type for output.
 */
const genkit_1 = require("genkit");
exports.AnswerUserQuestionInputSchema = genkit_1.z.object({
    question: genkit_1.z.string().describe('Câu hỏi từ người dùng.'),
    chatHistory: genkit_1.z.string().optional().describe('Lịch sử trò chuyện của người dùng.'),
    mediaDataUri: genkit_1.z.string().optional().describe("Một tệp phương tiện (hình ảnh, tài liệu) dưới dạng URI dữ liệu. Định dạng dự kiến: 'data:&lt;mimetype&gt;;base64,&lt;encoded_data&gt;'"),
    relevantTrainingData: genkit_1.z.array(genkit_1.z.object({
        userInput: genkit_1.z.string(),
        idealResponse: genkit_1.z.string().optional(),
    })).optional().describe('Các ví dụ huấn luyện đã được phê duyệt có liên quan để giúp hướng dẫn câu trả lời.'),
});
exports.AnswerUserQuestionOutputSchema = genkit_1.z.object({
    answer: genkit_1.z.string().describe('Câu trả lời cho câu hỏi của người dùng bằng tiếng Việt.'),
});
