"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateSuggestedRepliesOutputSchema = exports.GenerateSuggestedRepliesInputSchema = void 0;
// src/ai/schemas/generate-suggested-replies-schemas.ts
/**
 * @fileOverview Schema definitions for the generateSuggestedReplies flow.
 *
 * - GenerateSuggestedRepliesInputSchema - Zod schema for input.
 * - GenerateSuggestedRepliesInput - TypeScript type for input.
 * - GenerateSuggestedRepliesOutputSchema - Zod schema for output.
 * - GenerateSuggestedRepliesOutput - TypeScript type for output.
 */
const genkit_1 = require("genkit");
exports.GenerateSuggestedRepliesInputSchema = genkit_1.z.object({
    latestMessage: genkit_1.z.string().describe('Tin nhắn mới nhất trong cuộc trò chuyện.'),
});
exports.GenerateSuggestedRepliesOutputSchema = genkit_1.z.object({
    suggestedReplies: genkit_1.z.array(genkit_1.z.string()).describe('Một mảng các câu trả lời gợi ý bằng tiếng Việt.'),
});
