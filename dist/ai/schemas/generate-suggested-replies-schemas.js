// src/ai/schemas/generate-suggested-replies-schemas.ts
/**
 * @fileOverview Schema definitions for the generateSuggestedReplies flow.
 *
 * - GenerateSuggestedRepliesInputSchema - Zod schema for input.
 * - GenerateSuggestedRepliesInput - TypeScript type for input.
 * - GenerateSuggestedRepliesOutputSchema - Zod schema for output.
 * - GenerateSuggestedRepliesOutput - TypeScript type for output.
 */
import { z } from 'genkit';
export const GenerateSuggestedRepliesInputSchema = z.object({
    latestMessage: z.string().describe('Tin nhắn mới nhất trong cuộc trò chuyện.'),
});
export const GenerateSuggestedRepliesOutputSchema = z.object({
    suggestedReplies: z.array(z.string()).describe('Một mảng các câu trả lời gợi ý bằng tiếng Việt.'),
});
