// src/ai/schemas/answer-user-question-schemas.ts
/**
 * @fileOverview Schema definitions for the answerUserQuestion flow.
 *
 * - AnswerUserQuestionInputSchema - Zod schema for input.
 * - AnswerUserQuestionInput - TypeScript type for input.
 * - AnswerUserQuestionOutputSchema - Zod schema for output.
 * - AnswerUserQuestionOutput - TypeScript type for output.
 */
import { z } from 'genkit';

export const AnswerUserQuestionInputSchema = z.object({
  question: z.string().describe('Câu hỏi từ người dùng.'),
  chatHistory: z.string().optional().describe('Lịch sử trò chuyện của người dùng.'),
  mediaDataUri: z.string().optional().describe("Một tệp phương tiện (hình ảnh, tài liệu) dưới dạng URI dữ liệu. Định dạng dự kiến: 'data:<mimetype>;base64,<encoded_data>#filename=urlencodedfilename.ext'"),
});
export type AnswerUserQuestionInput = z.infer<typeof AnswerUserQuestionInputSchema>;

export const AnswerUserQuestionOutputSchema = z.object({
  answer: z.string().describe('Câu trả lời cho câu hỏi của người dùng bằng tiếng Việt.'),
});
export type AnswerUserQuestionOutput = z.infer<typeof AnswerUserQuestionOutputSchema>;

