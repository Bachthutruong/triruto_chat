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
  latestMessage: z.string().describe('The latest message in the chat.'),
});
export type GenerateSuggestedRepliesInput = z.infer<typeof GenerateSuggestedRepliesInputSchema>;

export const GenerateSuggestedRepliesOutputSchema = z.object({
  suggestedReplies: z.array(z.string()).describe('An array of suggested replies.'),
});
export type GenerateSuggestedRepliesOutput = z.infer<typeof GenerateSuggestedRepliesOutputSchema>;
